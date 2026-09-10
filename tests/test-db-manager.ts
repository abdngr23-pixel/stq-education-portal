import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import fs from "fs";
import net from "net";
import bcrypt from "bcryptjs";

export const TEST_PORT = 5433;
export const TEST_DB_NAME = "postgres";
export const TEST_DATABASE_URL = `postgresql://postgres:postgrespassword@127.0.0.1:${TEST_PORT}/${TEST_DB_NAME}?schema=test_portal`;

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
};

let embeddedPgInstance: EmbeddedPostgres | null = null;
let testPrismaClient: PrismaClient | null = null;

function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
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

/**
 * Validasi ketat lingkungan pengujian:
 * 1. NODE_ENV harus test
 * 2. URL database bukan URL produksi
 */
export function verifyTestEnvironment(databaseUrl = TEST_DATABASE_URL) {
  if (process.env.NODE_ENV !== "test") {
    process.env.NODE_ENV = "test";
  }

  const isProdUrl =
    databaseUrl.includes("accelerate.prisma-data.net") ||
    databaseUrl.includes("production") ||
    databaseUrl.includes("stq-education-portal-app");

  if (isProdUrl) {
    throw new Error(
      `FATAL: URL database yang terdeteksi (${databaseUrl.slice(0, 30)}...) adalah database produksi! Pengujian dibatalkan demi keamanan data produksi.`
    );
  }
}

/**
 * Inisialisasi dan jalankan database test PostgreSQL terisolasi
 */
export async function startTestDatabase(): Promise<PrismaClient> {
  verifyTestEnvironment(TEST_DATABASE_URL);

  const alreadyRunning = await isPortOpen(TEST_PORT);
  if (!alreadyRunning) {
    try {
      if (process.platform === "win32") {
        execSync("taskkill /F /IM postgres.exe", { stdio: "ignore" });
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {}

    const dataDir = "D:/stq-education-portal-antigravity/stq-education-portal/data/db";
    embeddedPgInstance = new EmbeddedPostgres({
      port: TEST_PORT,
      database: TEST_DB_NAME,
      user: "postgres",
      password: "postgrespassword",
      persistent: true,
    });

    if (!fs.existsSync(dataDir)) {
      await embeddedPgInstance.initialise();
    }
    await embeddedPgInstance.start();

    // Tunggu hingga port benar-benar siap menerima koneksi
    for (let i = 0; i < 20; i++) {
      if (await isPortOpen(TEST_PORT)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Push skema prisma ke database test
  try {
    execSync(`npx dotenv -e .env.test -- prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss`, {
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        NODE_ENV: "test",
      },
      stdio: "pipe",
    });
  } catch (err) {
    console.error("Gagal melakukan prisma db push ke database test:", err);
    throw err;
  }

  testPrismaClient = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL,
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

  // 1. Bersihkan sisa fixture lama jika ada
  await cleanupTestFixtures(prisma);

  const baselineDate = new Date("2026-09-08T00:00:00.000Z");
  const hashedPassword = await bcrypt.hash(FIXTURES.PASSWORD, 10);

  // 2. Buat Staff
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

  // 3. Buat Halaqoh
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

  // 4. Buat User Account
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

  // 5. Buat Santri Fixtures
  // A. Santri Multi-halaman (Modal 421 di akhir Juz 21, sehingga hafalan berikutnya 422 di Juz 22)
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
 * Hentikan test database dan tutup koneksi
 */
export async function stopTestDatabase() {
  if (testPrismaClient) {
    await testPrismaClient.$disconnect();
    testPrismaClient = null;
  }
  if (embeddedPgInstance) {
    try {
      if (process.platform === "win32") {
        execSync("taskkill /F /IM postgres.exe", { stdio: "ignore" });
      } else {
        await embeddedPgInstance.stop();
      }
    } catch {
      // ignore
    }
    embeddedPgInstance = null;
  }
}
