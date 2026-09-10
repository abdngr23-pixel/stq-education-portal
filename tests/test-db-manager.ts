import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import bcrypt from "bcryptjs";

export const FIXTURES = {
  STAFF_ID: "TEST_STF_01",
  HALAQOH_ID: "TEST_HLQ_01",
  USER_ID: "TEST_USR_01",
  USERNAME: "test.musyrif",
  PASSWORD: "password123",
  SANTRI_MULTI: "TEST_SAN_MULTI",
  SANTRI_HALF: "TEST_SAN_HALF",
  SANTRI_KHATAM: "TEST_SAN_KHATAM",
  SANTRI_SABAQI: "TEST_SAN_SABAQI",
  SANTRI_BATAS_JUZ: "TEST_SAN_BATAS_JUZ",
};

export let TEST_DATABASE_URL = "postgresql://postgres:postgrespassword@127.0.0.1:5433/stq_test?schema=test_portal";

let embeddedPgInstance: EmbeddedPostgres | null = null;
let testPrismaClient: PrismaClient | null = null;
let activeTempDataDir: string | null = null;
let activeTestPort: number | null = null;
let activeTestDatabaseUrl: string | null = null;

export function getActiveTestDatabaseUrl(): string {
  if (!activeTestDatabaseUrl) {
    throw new Error("FATAL: Database test belum diinisialisasi atau telah dihentikan!");
  }
  return activeTestDatabaseUrl;
}

export function getActiveTestPort(): number {
  if (!activeTestPort) {
    throw new Error("FATAL: Port database test belum dialokasikan!");
  }
  return activeTestPort;
}

export function getActiveTempDir(): string | null {
  return activeTempDataDir;
}

export function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function findFreePort(startPort = 5500, maxAttempts = 50): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const isFree = await new Promise<boolean>((resolve) => {
      const tester = net.createServer();
      tester.once("error", () => {
        resolve(false);
      });
      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, "127.0.0.1");
    });

    if (isFree) {
      const inUse = await isPortInUse(port);
      if (!inUse) {
        return port;
      }
    }
  }

  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", reject);
    tester.once("listening", () => {
      const p = (tester.address() as net.AddressInfo).port;
      tester.close(() => resolve(p));
    });
    tester.listen(0, "127.0.0.1");
  });
}

/**
 * Validasi ketat lingkungan pengujian:
 * 1. NODE_ENV harus "test" (tidak diubah otomatis)
 * 2. Penanda eksplisit IS_TEST_RUN=true dan ALLOW_ISOLATED_TEST_DB=true wajib ada
 * 3. URL tidak boleh kosong dan harus menggunakan host loopback (127.0.0.1 / localhost)
 * 4. Nama database atau schema harus memiliki penanda test (stq_test / test_portal)
 * 5. Dilarang terhubung ke URL yang mengandung domain / database produksi
 */
export function verifyTestEnvironment(databaseUrl?: string) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `FATAL: NODE_ENV harus bernilai "test" untuk menjalankan test suite (terdeteksi: "${process.env.NODE_ENV}"). Pengujian dibatalkan demi melindungi integritas sistem.`
    );
  }

  if (process.env.IS_TEST_RUN !== "true" || process.env.ALLOW_ISOLATED_TEST_DB !== "true") {
    throw new Error(
      `FATAL: Penanda eksplisit keamanan IS_TEST_RUN=true dan ALLOW_ISOLATED_TEST_DB=true wajib disetel. Pengujian dibatalkan.`
    );
  }

  const targetUrl = databaseUrl || activeTestDatabaseUrl || process.env.TEST_DATABASE_URL;
  if (!targetUrl || targetUrl.trim() === "") {
    throw new Error(
      `FATAL: TEST_DATABASE_URL wajib disediakan dan tidak boleh kosong. Dilarang fallback ke DATABASE_URL demi keamanan data!`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error(`FATAL: Format database URL tidak valid: ${targetUrl}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `FATAL: Database pengujian wajib berada pada host loopback (127.0.0.1 atau localhost). Host terdeteksi: "${host}". Pengujian dibatalkan.`
    );
  }

  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const schema = (parsed.searchParams.get("schema") || "").toLowerCase();
  const hasTestIdentifier =
    dbName.includes("test") ||
    dbName.includes("stq_test") ||
    schema.includes("test") ||
    schema.includes("test_portal");

  if (!hasTestIdentifier) {
    throw new Error(
      `FATAL: Nama database ("${dbName}") atau schema ("${schema}") wajib memiliki penanda pengujian (seperti "stq_test" atau "test_portal"). Pengujian dibatalkan.`
    );
  }

  const lowerUrl = targetUrl.toLowerCase();
  if (
    lowerUrl.includes("production") ||
    lowerUrl.includes("accelerate.prisma-data.net") ||
    lowerUrl.includes("neon.tech") ||
    lowerUrl.includes("supabase.co") ||
    lowerUrl.includes("stq-education-portal-app")
  ) {
    throw new Error(
      `FATAL: URL terdeteksi mengandung tanda domain/basis data publik atau produksi! Pengujian dibatalkan.`
    );
  }
}

/**
 * Inisialisasi dan jalankan database test PostgreSQL terisolasi pada port dinamis dan direktori temporer unik.
 * Tidak pernah membunuh proses secara global atau mematikan database milik aplikasi lain.
 */
export async function startTestDatabase(preferredPort?: number): Promise<PrismaClient> {
  // Pastikan penanda test disetel
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";

  const port = preferredPort || (await findFreePort(5500 + Math.floor(Math.random() * 500)));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-test-db-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_test?schema=test_portal`;

  verifyTestEnvironment(testUrl);

  activeTestPort = port;
  activeTempDataDir = tempDir;
  activeTestDatabaseUrl = testUrl;

  process.env.TEST_DATABASE_URL = testUrl;
  TEST_DATABASE_URL = testUrl;

  embeddedPgInstance = new EmbeddedPostgres({
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
    databaseDir: tempDir,
  });

  await embeddedPgInstance.initialise();
  await embeddedPgInstance.start();

  // Tunggu hingga port benar-benar siap menerima koneksi
  for (let i = 0; i < 30; i++) {
    if (await isPortInUse(port)) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  // Pastikan database stq_test dibuat di cluster terisolasi
  try {
    await embeddedPgInstance.createDatabase("stq_test");
  } catch {
    // Abaikan jika sudah dibuat secara otomatis
  }

  // Push skema prisma HANYA ke database test terisolasi yang baru saja dibuat
  try {
    execSync(
      `npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss`,
      {
        env: {
          ...process.env,
          DATABASE_URL: testUrl,
          TEST_DATABASE_URL: testUrl,
          NODE_ENV: "test",
          IS_TEST_RUN: "true",
          ALLOW_ISOLATED_TEST_DB: "true",
        },
        stdio: "pipe",
      }
    );
  } catch (err) {
    console.error("Gagal melakukan prisma db push ke database test terisolasi:", err);
    throw err;
  }

  testPrismaClient = new PrismaClient({
    datasources: {
      db: {
        url: testUrl,
      },
    },
  });

  return testPrismaClient;
}

/**
 * Menyiapkan fixtures data pengujian terisolasi
 */
export async function setupTestFixtures(prisma: PrismaClient) {
  verifyTestEnvironment();
  await cleanupTestFixtures(prisma);

  const baselineDate = new Date("2026-09-08T00:00:00.000Z");
  const hashedPassword = await bcrypt.hash(FIXTURES.PASSWORD, 10);

  // 1. Buat Staff
  await prisma.staff.create({
    data: {
      id: FIXTURES.STAFF_ID,
      staffCode: "STF-TEST-01",
      nama: "Ust. Tester Tahfizh, S.Pd",
      noHp: "081233445566",
      roleStaff: "MT",
      status: "AKTIF",
      isKepalaBidangTahfidz: false,
    },
  });

  // 2. Buat Halaqoh
  await prisma.halaqoh.create({
    data: {
      id: FIXTURES.HALAQOH_ID,
      halaqohCode: "HLQ-TEST-01",
      nama: "Halaqoh Uji Coba Test",
      pembinaId: FIXTURES.STAFF_ID,
      tahunAjaran: "2026/2027",
      status: "AKTIF",
    },
  });

  // 3. Buat User Account
  await prisma.user.create({
    data: {
      id: FIXTURES.USER_ID,
      username: FIXTURES.USERNAME,
      passwordHash: hashedPassword,
      role: "MT",
      status: "AKTIF",
      staffId: FIXTURES.STAFF_ID,
    },
  });

  // 4. Buat Santri Fixtures
  // A. Santri Multi-halaman (Modal 421 di akhir Juz 21, hafalan berikutnya 422 di Juz 22)
  await prisma.santri.create({
    data: {
      id: FIXTURES.SANTRI_MULTI,
      nis: "TEST-001",
      nama: "Muhammad Test Multi",
      kelas: "7A",
      jenisKelamin: "L",
      halaqohId: FIXTURES.HALAQOH_ID,
      modalHafalanAwalHalaman: 421,
      tanggalBaselineTahfizh: baselineDate,
      status: "AKTIF",
    },
  });

  // B. Santri Half-page (Modal 430)
  await prisma.santri.create({
    data: {
      id: FIXTURES.SANTRI_HALF,
      nis: "TEST-002",
      nama: "Muhammad Test Half",
      kelas: "7A",
      jenisKelamin: "L",
      halaqohId: FIXTURES.HALAQOH_ID,
      modalHafalanAwalHalaman: 430,
      tanggalBaselineTahfizh: baselineDate,
      status: "AKTIF",
    },
  });

  // C. Santri Khatam 30 Juz (Modal 603, telah setor SABAQ halaman 604 penuh volume 1.0)
  await prisma.santri.create({
    data: {
      id: FIXTURES.SANTRI_KHATAM,
      nis: "TEST-003",
      nama: "Muhammad Test Khatam 30 Juz",
      kelas: "7A",
      jenisKelamin: "L",
      halaqohId: FIXTURES.HALAQOH_ID,
      modalHafalanAwalHalaman: 603,
      tanggalBaselineTahfizh: baselineDate,
      status: "AKTIF",
    },
  });

  // Catat setoran resmi halaman 604 penuh untuk santri khatam
  await prisma.setoranTahfizh.create({
    data: {
      setoranCode: "SET-TEST-KHATAM-604",
      santriId: FIXTURES.SANTRI_KHATAM,
      musyrifId: FIXTURES.STAFF_ID,
      tanggal: new Date("2026-09-09T08:00:00.000Z"),
      jenis: "SABAQ",
      juz: 30,
      halamanMulai: 604,
      halamanSelesai: 604,
      jumlahHalaman: 1.0,
      nilai: "MUMTAZ",
      status: "AKTIF",
      createdBy: FIXTURES.USERNAME,
    },
  });

  // D. Santri Sabaqi Clean (Modal 100, belum memiliki setoran Sabaq pekan ini)
  await prisma.santri.create({
    data: {
      id: FIXTURES.SANTRI_SABAQI,
      nis: "TEST-004",
      nama: "Muhammad Test Sabaqi Clean",
      kelas: "7A",
      jenisKelamin: "L",
      halaqohId: FIXTURES.HALAQOH_ID,
      modalHafalanAwalHalaman: 100,
      tanggalBaselineTahfizh: baselineDate,
      status: "AKTIF",
    },
  });

  // E. Santri Batas Juz (Modal 440, sehingga saran berikutnya adalah Halaman 441 - halaman terakhir Juz 22)
  await prisma.santri.create({
    data: {
      id: FIXTURES.SANTRI_BATAS_JUZ,
      nis: "TEST-005",
      nama: "Muhammad Test Batas Juz",
      kelas: "7A",
      jenisKelamin: "L",
      halaqohId: FIXTURES.HALAQOH_ID,
      modalHafalanAwalHalaman: 440,
      tanggalBaselineTahfizh: baselineDate,
      status: "AKTIF",
    },
  });
}

/**
 * Membersihkan HANYA fixture yang dibuat oleh pengujian
 */
export async function cleanupTestFixtures(prisma: PrismaClient) {
  verifyTestEnvironment();

  const testSantriIds = [
    FIXTURES.SANTRI_MULTI,
    FIXTURES.SANTRI_HALF,
    FIXTURES.SANTRI_KHATAM,
    FIXTURES.SANTRI_SABAQI,
    FIXTURES.SANTRI_BATAS_JUZ,
  ];

  // Hapus AuditLog terkait
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: FIXTURES.USER_ID },
        { entityId: { in: testSantriIds } },
      ],
    },
  });

  // Hapus Setoran Tahfizh test
  await prisma.setoranTahfizh.deleteMany({
    where: {
      santriId: { in: testSantriIds },
    },
  });

  // Hapus Santri test
  await prisma.santri.deleteMany({
    where: {
      id: { in: testSantriIds },
    },
  });

  // Hapus User test
  await prisma.user.deleteMany({
    where: {
      id: FIXTURES.USER_ID,
    },
  });

  // Hapus Halaqoh test
  await prisma.halaqoh.deleteMany({
    where: {
      id: FIXTURES.HALAQOH_ID,
    },
  });

  // Hapus Staff test
  await prisma.staff.deleteMany({
    where: {
      id: FIXTURES.STAFF_ID,
    },
  });
}

/**
 * Hentikan test database dan tutup koneksi.
 * HANYA menghentikan instance embedded PostgreSQL miliknya sendiri, dan menghapus direktori temporer miliknya sendiri.
 */
export async function stopTestDatabase() {
  if (testPrismaClient) {
    try {
      await testPrismaClient.$disconnect();
    } catch {}
    testPrismaClient = null;
  }

  if (embeddedPgInstance) {
    try {
      await Promise.race([
        embeddedPgInstance.stop(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (err) {
      console.warn("Warning saat menghentikan embedded postgres test:", err);
    }
    embeddedPgInstance = null;
  }

  if (activeTempDataDir && fs.existsSync(activeTempDataDir)) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        fs.rmSync(activeTempDataDir, { recursive: true, force: true });
        break;
      } catch (err) {
        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.warn("Warning saat menghapus direktori temporary database test:", err);
        }
      }
    }
    activeTempDataDir = null;
  }

  activeTestPort = null;
  activeTestDatabaseUrl = null;
}
