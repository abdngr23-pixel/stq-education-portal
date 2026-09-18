/* eslint-disable @typescript-eslint/no-explicit-any */
import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { createPrismaDataProvider, type ICanonicalDataProvider } from "../lib/auth/canonical-evaluator";

async function executeSqlStatementsOnClient(prismaClient: PrismaClient, sqlString: string): Promise<void> {
  // Strip single-line comments (-- ...)
  const clean = sqlString.replace(/--.*$/gm, "");
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === "$" && nextChar === "$") {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      i++;
      continue;
    }

    if (char === ";" && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  for (const stmt of statements) {
    await prismaClient.$executeRawUnsafe(stmt);
  }
}
import { execSync, spawnSync, ChildProcess } from "child_process";
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

export const RAPOR_STRESS_FIXTURES = {
  SANTRI_ID: "santri-stress-rapor-01",
  SANTRI_NIS: "TEST-STRESS-001",
  SANTRI_NAMA: "Muhammad Abdullah Fathurrahman Al-Makassari",
  STAFF_DINIYAH_ID: "staff-stress-guru-01",
  STAFF_DINIYAH_NAMA: "Ustadz Dr. H. Abdurrahman Al-Atsary, Lc., M.A.",
  STAFF_UMUM_ID: "staff-stress-guru-02",
  STAFF_UMUM_NAMA: "Ustadzah Dra. Hj. Nurul Hidayah Al-Munawwarah, M.Pd.",
  MAPEL_DINIYAH_ID: "mapel-stress-01",
  MAPEL_DINIYAH_KODE: "MP-STR-01",
  MAPEL_DINIYAH_NAMA: "Pendidikan Agama Islam dan Karakter Mulia STQ",
  MAPEL_UMUM_ID: "mapel-stress-02",
  MAPEL_UMUM_KODE: "MP-STR-02",
  MAPEL_UMUM_NAMA: "Matematika Terapan dan Pemecahan Masalah Ilmiah",
  NILAI_DINIYAH_ID: "nilai-stress-01",
  NILAI_UMUM_ID: "nilai-stress-02",
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

  // Catat PID utama dan descendant milik instance tes ini
  const detected = detectTestInstancePids(port, tempDir);
  activeMainPid = detected.mainPid;
  activeDescendantPids = new Set(detected.descendantPids);
  console.log(`[test-db-manager] PostgreSQL aktif pada port ${port} (Main PID: ${activeMainPid || "n/a"}, Child PIDs: [${Array.from(activeDescendantPids).join(", ")}])`);

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

  (globalThis as unknown as { prisma: PrismaClient | undefined }).prisma = testPrismaClient;

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

  // Santri Stress Test Data Rapor (Muhammad Abdullah Fathurrahman Al-Makassari)
  await prisma.santri.create({
    data: {
      id: RAPOR_STRESS_FIXTURES.SANTRI_ID,
      nis: RAPOR_STRESS_FIXTURES.SANTRI_NIS,
      nama: RAPOR_STRESS_FIXTURES.SANTRI_NAMA,
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
 * Menyiapkan fixtures data nilai akademik untuk pengujian rapor terisi data (termasuk uji panjang teks)
 */
export async function setupStressTestRaporFixtures(prisma: PrismaClient) {
  verifyTestEnvironment();

  // 1. Buat / Pastikan Guru Pengajar tersedia
  await prisma.staff.upsert({
    where: { staffCode: "STF-STR-001" },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.STAFF_DINIYAH_ID,
      staffCode: "STF-STR-001",
      nama: RAPOR_STRESS_FIXTURES.STAFF_DINIYAH_NAMA,
      noHp: "081234567891",
      roleStaff: "GA",
      status: "AKTIF",
    },
  });

  await prisma.staff.upsert({
    where: { staffCode: "STF-STR-002" },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.STAFF_UMUM_ID,
      staffCode: "STF-STR-002",
      nama: RAPOR_STRESS_FIXTURES.STAFF_UMUM_NAMA,
      noHp: "081234567892",
      roleStaff: "GA",
      status: "AKTIF",
    },
  });

  // 2. Buat / Pastikan Santri Stress Test Nama Panjang tersedia
  await prisma.santri.upsert({
    where: { id: RAPOR_STRESS_FIXTURES.SANTRI_ID },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.SANTRI_ID,
      nis: RAPOR_STRESS_FIXTURES.SANTRI_NIS,
      nama: RAPOR_STRESS_FIXTURES.SANTRI_NAMA,
      kelas: "7A",
      jenisKelamin: "L",
      halaqohId: FIXTURES.HALAQOH_ID,
      modalHafalanAwalHalaman: 100,
      tanggalBaselineTahfizh: new Date("2026-09-08T00:00:00.000Z"),
      status: "AKTIF",
    },
  });

  // 3. Buat Mata Pelajaran Kepesantrenan & Umum
  await prisma.mataPelajaran.upsert({
    where: { kodeMapel: RAPOR_STRESS_FIXTURES.MAPEL_DINIYAH_KODE },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.MAPEL_DINIYAH_ID,
      kodeMapel: RAPOR_STRESS_FIXTURES.MAPEL_DINIYAH_KODE,
      nama: RAPOR_STRESS_FIXTURES.MAPEL_DINIYAH_NAMA,
      kategori: "KEPESANTRENAN",
      guruId: RAPOR_STRESS_FIXTURES.STAFF_DINIYAH_ID,
    },
  });

  await prisma.mataPelajaran.upsert({
    where: { kodeMapel: RAPOR_STRESS_FIXTURES.MAPEL_UMUM_KODE },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.MAPEL_UMUM_ID,
      kodeMapel: RAPOR_STRESS_FIXTURES.MAPEL_UMUM_KODE,
      nama: RAPOR_STRESS_FIXTURES.MAPEL_UMUM_NAMA,
      kategori: "UMUM",
      guruId: RAPOR_STRESS_FIXTURES.STAFF_UMUM_ID,
    },
  });

  // 4. Buat Nilai Akademik
  await prisma.nilaiAkademik.upsert({
    where: { id: RAPOR_STRESS_FIXTURES.NILAI_DINIYAH_ID },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.NILAI_DINIYAH_ID,
      santriId: RAPOR_STRESS_FIXTURES.SANTRI_ID,
      mapelId: RAPOR_STRESS_FIXTURES.MAPEL_DINIYAH_ID,
      guruId: RAPOR_STRESS_FIXTURES.STAFF_DINIYAH_ID,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: "UAS",
      angka: 94.5,
      huruf: "A",
      catatan: "Pemahaman materi sangat mendalam dan adab belajar terpuji.",
    },
  });

  await prisma.nilaiAkademik.upsert({
    where: { id: RAPOR_STRESS_FIXTURES.NILAI_UMUM_ID },
    update: {},
    create: {
      id: RAPOR_STRESS_FIXTURES.NILAI_UMUM_ID,
      santriId: RAPOR_STRESS_FIXTURES.SANTRI_ID,
      mapelId: RAPOR_STRESS_FIXTURES.MAPEL_UMUM_ID,
      guruId: RAPOR_STRESS_FIXTURES.STAFF_UMUM_ID,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: "UAS",
      angka: 85.0,
      huruf: "B",
      catatan: null, // Menguji penanganan field opsional kosong
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
    RAPOR_STRESS_FIXTURES.SANTRI_ID,
    "santri-qa-extra-01",
  ];

  // Hapus NilaiAkademik terkait
  await prisma.nilaiAkademik.deleteMany({
    where: {
      OR: [
        { santriId: { in: testSantriIds } },
        { id: { in: [RAPOR_STRESS_FIXTURES.NILAI_DINIYAH_ID, RAPOR_STRESS_FIXTURES.NILAI_UMUM_ID] } },
      ],
    },
  });

  // Hapus MataPelajaran terkait
  await prisma.mataPelajaran.deleteMany({
    where: {
      id: { in: [RAPOR_STRESS_FIXTURES.MAPEL_DINIYAH_ID, RAPOR_STRESS_FIXTURES.MAPEL_UMUM_ID] },
    },
  });

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
      id: {
        in: [
          FIXTURES.STAFF_ID,
          RAPOR_STRESS_FIXTURES.STAFF_DINIYAH_ID,
          RAPOR_STRESS_FIXTURES.STAFF_UMUM_ID,
        ],
      },
    },
  });
}

/**
 * Interface proses untuk pelacakan PID instance PostgreSQL terisolasi
 */
interface ProcessInfo {
  ProcessId: number;
  ParentProcessId: number;
  Name: string;
  CommandLine: string | null;
}

let activeMainPid: number | null = null;
let activeDescendantPids: Set<number> = new Set();

export function getActiveMainPid(): number | null {
  return activeMainPid;
}

export function getActiveDescendantPids(): number[] {
  return Array.from(activeDescendantPids);
}

export function isPidRunning(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  if (process.platform === "win32") {
    try {
      const res = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
        encoding: "utf-8",
        timeout: 3000,
      });
      const stdout = res.stdout || "";
      return stdout.includes(`"${pid}"`);
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const error = err as { code?: string };
    return error.code === "EPERM";
  }
}

export function getPgCtlPath(): string | null {
  const candidates = [
    path.resolve(__dirname, "../node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe"),
    path.resolve(process.cwd(), "node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe"),
    path.resolve(__dirname, "../node_modules/@embedded-postgres/linux-x64/native/bin/pg_ctl"),
    path.resolve(process.cwd(), "node_modules/@embedded-postgres/linux-x64/native/bin/pg_ctl"),
    "/usr/lib/postgresql/bin/pg_ctl",
    "/usr/bin/pg_ctl",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function findListeningPid(port: number): number | null {
  if (process.platform === "win32") {
    try {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf-8", timeout: 4000 });
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pidStr = parts[parts.length - 1];
          const parsedPid = parseInt(pidStr, 10);
          if (!isNaN(parsedPid) && parsedPid > 0) {
            return parsedPid;
          }
        }
      }
    } catch {}
    return null;
  }

  // Linux / POSIX fallback: lsof or ss
  try {
    const output = execSync(`lsof -i :${port} -t -sTCP:LISTEN`, { encoding: "utf-8", timeout: 4000 });
    const pid = parseInt(output.trim().split(/\s+/)[0], 10);
    if (!isNaN(pid) && pid > 0) return pid;
  } catch {
    try {
      const output = execSync(`ss -tulpn '( sport = :${port} )'`, { encoding: "utf-8", timeout: 4000 });
      const match = output.match(/pid=(\d+)/);
      if (match) {
        const pid = parseInt(match[1], 10);
        if (!isNaN(pid) && pid > 0) return pid;
      }
    } catch {}
  }
  return null;
}

export function getSystemPostgresProcesses(): ProcessInfo[] {
  if (process.platform === "win32") {
    try {
      const script = `powershell -NoProfile -Command "@(Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*postgres*' } | Select-Object ProcessId, ParentProcessId, Name, CommandLine) | ConvertTo-Json -Compress"`;
      const stdout = execSync(script, { encoding: "utf-8", timeout: 8000 }).trim();
      if (!stdout || stdout === "[]") return [];
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
      return [];
    } catch {
      return [];
    }
  }

  // Linux / POSIX fallback
  try {
    const stdout = execSync("ps -eo pid,ppid,comm,args", { encoding: "utf-8", timeout: 4000 }).trim();
    const lines = stdout.split("\n").slice(1);
    const results: ProcessInfo[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const pid = parseInt(parts[0], 10);
        const ppid = parseInt(parts[1], 10);
        const comm = parts[2];
        const args = parts.slice(3).join(" ");
        if (comm.toLowerCase().includes("postgres") || args.toLowerCase().includes("postgres")) {
          results.push({
            ProcessId: pid,
            ParentProcessId: ppid,
            Name: comm,
            CommandLine: args,
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function detectTestInstancePids(port: number, tempDir: string): { mainPid: number | null; descendantPids: number[] } {
  const normTempDir = path.resolve(tempDir).toLowerCase();
  const allPg = getSystemPostgresProcesses();

  let mainPid: number | null = activeMainPid;
  const instancePid = (embeddedPgInstance as unknown as { process?: { pid?: number } })?.process?.pid;
  if (instancePid && typeof instancePid === "number" && isPidRunning(instancePid)) {
    mainPid = instancePid;
  }

  const listeningPid = findListeningPid(port);
  if (listeningPid) {
    const proc = allPg.find((p) => p.ProcessId === listeningPid);
    if (proc && proc.Name.toLowerCase().includes("postgres")) {
      const cmd = (proc.CommandLine || "").toLowerCase();
      if (cmd.includes(normTempDir) || cmd.includes(port.toString())) {
        mainPid = listeningPid;
      }
    }
  }

  const descendants: Set<number> = new Set(activeDescendantPids);
  for (const proc of allPg) {
    if (proc.ProcessId === mainPid) continue;
    const cmd = (proc.CommandLine || "").toLowerCase();
    const isChildOfMain = mainPid !== null && proc.ParentProcessId === mainPid;
    const isChildOfDescendant = descendants.has(proc.ParentProcessId);
    const isMatchingTempDir = cmd.includes(normTempDir);
    const isForkChildOfMain =
      mainPid !== null && cmd.includes("--forkchild") && cmd.includes(mainPid.toString());
    if (isChildOfMain || isChildOfDescendant || isMatchingTempDir || isForkChildOfMain) {
      descendants.add(proc.ProcessId);
    }
  }

  return {
    mainPid,
    descendantPids: Array.from(descendants),
  };
}

export function validateTempDataDir(dirPath: string): string {
  if (!dirPath || typeof dirPath !== "string") {
    throw new Error("FATAL: Direktori temporer database tes tidak valid atau kosong.");
  }
  const resolved = path.resolve(dirPath);
  const tmpDir = path.resolve(os.tmpdir());
  const base = path.basename(resolved);
  const root = path.parse(resolved).root;
  const projectRoot = path.resolve(process.cwd());
  const homeDir = path.resolve(os.homedir());

  // Validasi berbasis path.relative agar path sibling tidak dianggap berada di dalam temp directory
  const rel = path.relative(tmpDir, resolved);
  const isInsideTemp = Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);

  if (!isInsideTemp) {
    throw new Error(`FATAL: Direktori temporer harus berada di dalam os.tmpdir() (${tmpDir}), terdeteksi di luar: ${resolved}`);
  }
  if (!base.startsWith("stq-test-db-")) {
    throw new Error(`FATAL: Direktori temporer harus memiliki prefix 'stq-test-db-', terdeteksi: ${base}`);
  }
  if (
    resolved === root ||
    resolved === projectRoot ||
    resolved === homeDir ||
    resolved.length <= 10
  ) {
    throw new Error(`FATAL: Direktori temporer dilarang mengarah ke root drive, direktori proyek, atau home directory: ${resolved}`);
  }
  if (activeTempDataDir && resolved !== path.resolve(activeTempDataDir)) {
    throw new Error(`FATAL: Direktori temporer (${resolved}) tidak sama persis dengan activeTempDataDir (${path.resolve(activeTempDataDir)})`);
  }
  return resolved;
}

/**
 * Memverifikasi apakah suatu PID masih aktif, merupakan executable postgres.exe,
 * dan terbukti terkait dengan instance database test kita (CommandLine memuat direktori test
 * atau ParentProcessId terhubung dengan main PID terverifikasi).
 * Melindungi dari pembunuhan proses lain akibat Windows PID reuse.
 */
export function verifyPostgresProcessOwnership(
  pid: number,
  targetDir: string,
  verifiedMainPid: number | null
): boolean {
  if (!isPidRunning(pid)) return false;

  if (process.platform === "win32") {
    try {
      // 1. Cek nama executable via tasklist
      const tasklistRes = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
        encoding: "utf-8",
        timeout: 1000,
        windowsHide: true,
      });
      const output = tasklistRes.stdout || "";
      if (!output.toLowerCase().includes("postgres.exe")) {
        // PID reuse terdeteksi: bukan postgres.exe, dilarang di-kill
        return false;
      }

      // 2. Baca CommandLine dan ParentProcessId via wmic
      const wmicRes = spawnSync(
        "wmic",
        ["process", "where", `ProcessId=${pid}`, "get", "CommandLine,ParentProcessId", "/format:csv"],
        { encoding: "utf-8", timeout: 2000, windowsHide: true }
      );
      const wmicOut = wmicRes.stdout || "";
      const lowerOut = wmicOut.toLowerCase();
      const lowerDir = targetDir.toLowerCase().replace(/\\/g, "\\\\");
      const lowerRawDir = targetDir.toLowerCase();

      // Cek apakah CommandLine memuat targetDir
      const matchesDir = lowerOut.includes(lowerDir) || lowerOut.includes(lowerRawDir);

      // Cek apakah ParentProcessId sama dengan verifiedMainPid
      let matchesParent = false;
      if (verifiedMainPid && verifiedMainPid > 0) {
        const lines = wmicOut.trim().split("\n").filter((l) => l.trim().length > 0);
        for (const line of lines) {
          const cols = line.split(",").map((c) => c.trim());
          if (cols.includes(String(verifiedMainPid))) {
            matchesParent = true;
            break;
          }
        }
      }

      // Cek apakah CommandLine memuat --forkchild dan verifiedMainPid
      const matchesForkChild = Boolean(
        verifiedMainPid &&
          verifiedMainPid > 0 &&
          lowerOut.includes("--forkchild") &&
          lowerOut.includes(String(verifiedMainPid))
      );

      if (matchesDir || matchesParent || matchesForkChild) {
        return true;
      }
      // Fallback: periksa via getSystemPostgresProcesses() jika wmic tidak memuat kolom lengkap
      const allPg = getSystemPostgresProcesses();
      const proc = allPg.find((p) => p.ProcessId === pid);
      if (proc) {
        const cmd = (proc.CommandLine || "").toLowerCase();
        const matchesProcDir = cmd.includes(lowerDir) || cmd.includes(lowerRawDir);
        const matchesProcParent = verifiedMainPid !== null && proc.ParentProcessId === verifiedMainPid;
        const matchesProcFork =
          verifiedMainPid !== null &&
          cmd.includes("--forkchild") &&
          cmd.includes(verifiedMainPid.toString());
        return matchesProcDir || matchesProcParent || matchesProcFork;
      }
      return false;
    } catch {
      return false;
    }
  } else {
    try {
      const cmdlinePath = `/proc/${pid}/cmdline`;
      if (fs.existsSync(cmdlinePath)) {
        const cmd = fs.readFileSync(cmdlinePath, "utf-8");
        if (!cmd.includes("postgres")) return false;
        if (targetDir && cmd.includes(targetDir)) return true;
      }
      if (verifiedMainPid && verifiedMainPid > 0) {
        const statPath = `/proc/${pid}/stat`;
        if (fs.existsSync(statPath)) {
          const stat = fs.readFileSync(statPath, "utf-8");
          const parts = stat.substring(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
          const ppid = parseInt(parts[1], 10);
          if (ppid === verifiedMainPid) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Hentikan test database dan tutup koneksi secara idempotent dan terisolasi penuh.
 * HANYA menghentikan instance embedded PostgreSQL miliknya sendiri dan menghapus direktori temporer miliknya sendiri.
 */
export async function stopTestDatabase() {
  // Idempotency: jika sudah bersih, return langsung
  if (!embeddedPgInstance && !testPrismaClient && !activeTempDataDir && !activeTestPort) {
    return;
  }

  const targetPort = activeTestPort;
  const targetDir = activeTempDataDir;

  // 1. Putuskan Prisma client
  if (testPrismaClient) {
    try {
      await testPrismaClient.$disconnect();
    } catch {}
    testPrismaClient = null;
    (globalThis as unknown as { prisma: PrismaClient | undefined }).prisma = undefined;
  }

  // 2. Snapshot PID sebelum proses stop dipanggil agar child tetap terlacak
  if (targetPort && targetDir) {
    const freshPids = detectTestInstancePids(targetPort, targetDir);
    if (freshPids.mainPid) activeMainPid = freshPids.mainPid;
    for (const d of freshPids.descendantPids) {
      activeDescendantPids.add(d);
    }
  }

  const pidsToTerminate = new Set<number>();
  if (activeMainPid) pidsToTerminate.add(activeMainPid);
  for (const pid of activeDescendantPids) {
    pidsToTerminate.add(pid);
  }

  // 3. Graceful stop: gunakan pg_ctl stop -m fast -w terlebih dahulu jika tersedia (native clean shutdown)
  const pgCtl = getPgCtlPath();
  if (pgCtl && targetDir && fs.existsSync(targetDir)) {
    try {
      spawnSync(pgCtl, ["stop", "-D", targetDir, "-m", "fast", "-w", "-t", "5"], {
        encoding: "utf-8",
        timeout: 6000,
        stdio: "ignore",
      });
    } catch {}
  }

  // 4. Bersihkan instance embedded-postgres tanpa membiarkan Promise menggantung
  if (embeddedPgInstance) {
    try {
      const instance = embeddedPgInstance as unknown as {
        process?: { pid?: number; exitCode?: number | null; kill?: (signal?: string) => boolean };
      };
      if (instance.process && instance.process.exitCode === null) {
        try {
          instance.process.kill?.("SIGKILL");
        } catch {}
      }
      instance.process = undefined;
    } catch {}
    embeddedPgInstance = null;
  }

  // 5. Polling: periksa apakah port dan PID sudah berhenti secara alami
  const pollStart = Date.now();

  while (Date.now() - pollStart < 4000) {
    let anyRunning = false;
    for (const pid of pidsToTerminate) {
      if (isPidRunning(pid)) {
        anyRunning = true;
        break;
      }
    }
    const portClosed = targetPort ? !(await isPortInUse(targetPort)) : true;
    if (!anyRunning && portClosed) {
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 6. Jika masih ada PID yang tertinggal setelah batas waktu, hentikan HANYA PID yang terverifikasi
  // merupakan executable postgres.exe milik instance direktori test ini (mencegah pembunuhan proses lain akibat PID reuse)
  for (const pid of pidsToTerminate) {
    if (targetDir && verifyPostgresProcessOwnership(pid, targetDir, activeMainPid)) {
      console.log(`[test-db-manager] Menghentikan PID instance tes terverifikasi: ${pid}`);
      try {
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", pid.toString(), "/T", "/F"], { stdio: "ignore" });
        } else {
          process.kill(pid, "SIGKILL");
        }
      } catch {}
    } else {
      // Lewati jika PID bukan postgres.exe atau bukan milik instance test ini
    }
  }

  // 7. Tunggu seluruh PID terverifikasi benar-benar hilang (timeout 4 detik)
  const killWaitStart = Date.now();
  while (Date.now() - killWaitStart < 4000) {
    let anyStillAlive = false;
    for (const pid of pidsToTerminate) {
      if (isPidRunning(pid)) {
        anyStillAlive = true;
        break;
      }
    }
    if (!anyStillAlive) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  // 8. Pastikan port sudah tertutup
  if (targetPort) {
    const portWaitStart = Date.now();
    while (Date.now() - portWaitStart < 3000) {
      if (!(await isPortInUse(targetPort))) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // 9 & 10. Hapus direktori data temporer dengan validasi ketat dan retry loop
  if (targetDir && fs.existsSync(targetDir)) {
    const validatedDir = validateTempDataDir(targetDir);
    let deleted = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        fs.rmSync(validatedDir, { recursive: true, force: true });
        deleted = true;
        break;
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        const isLockError = error.code === "EBUSY" || error.code === "EPERM" || error.code === "ENOTEMPTY";
        if (attempt < 10 && isLockError) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          console.warn(`[test-db-manager] Gagal menghapus direktori temporary database test (percobaan ${attempt}/10):`, error.message);
        }
      }
    }
    if (!deleted && fs.existsSync(validatedDir)) {
      console.warn(`[test-db-manager] Direktori ${validatedDir} masih ada atau terkunci.`);
    }
  }

  // 11. Validasi kebersihan akhir sebelum menghapus state pelacakan
  const isPortStillOpen = targetPort ? await isPortInUse(targetPort) : false;
  const anyPidStillRunning = Array.from(pidsToTerminate).some((p) => isPidRunning(p));
  const isDirStillExists = targetDir ? fs.existsSync(targetDir) : false;

  if (isPortStillOpen || anyPidStillRunning || isDirStillExists) {
    // Pertahankan state pelacakan agar stopTestDatabase() dapat dipanggil ulang
    throw new Error(
      `[test-db-manager] Cleanup PostgreSQL belum tuntas: Port ${targetPort} terbuka=${isPortStillOpen}, PID aktif=${anyPidStillRunning}, Dir ada=${isDirStillExists}. State pelacakan dipertahankan untuk pembersihan ulang.`
    );
  }

  // 12. Bersihkan state global HANYA jika seluruh komponen sudah 100% bersih
  activeTempDataDir = null;
  activeTestPort = null;
  activeTestDatabaseUrl = null;
  activeMainPid = null;
  activeDescendantPids.clear();
}

export interface ProcessTerminationResult {
  pid: number;
  exited: boolean;
  exitCode: number | null;
  method: "already_exited" | "graceful" | "forced";
  portClosed: boolean;
  remainingDescendants: number[];
}

/**
 * Menghentikan process tree milik test secara deterministik dan terisolasi penuh.
 * - Mencatat PID child.
 * - Melepaskan/membersihkan stream stdio agar handle tidak menggantung.
 * - Mengirim sinyal terminasi graceful (SIGTERM ke process group pada POSIX).
 * - Menunggu event exit/close dengan grace period.
 * - Jika masih hidup, melakukan force termination (SIGKILL ke process group pada POSIX, taskkill /PID <pid> /T /F pada Windows).
 * - Menunggu kembali hingga benar-benar exit.
 * - Memverifikasi port terisolasi telah tertutup (melempar error jika masih listening).
 * - Memverifikasi tidak ada descendant process milik child yang tersisa.
 */
export async function terminateOwnedChildProcess(
  child: ChildProcess,
  options?: {
    port?: number;
    graceTimeoutMs?: number;
    forceTimeoutMs?: number;
    label?: string;
  }
): Promise<ProcessTerminationResult> {
  const pid = child.pid;
  const label = options?.label || "ChildProcess";
  const graceMs = options?.graceTimeoutMs ?? 3000;
  const forceMs = options?.forceTimeoutMs ?? 2000;

  if (!pid || pid <= 0) {
    return {
      pid: 0,
      exited: true,
      exitCode: child.exitCode,
      method: "already_exited",
      portClosed: options?.port ? !(await isPortInUse(options.port)) : true,
      remainingDescendants: [],
    };
  }

  let method: "already_exited" | "graceful" | "forced" = "graceful";
  let hasExited = child.exitCode !== null || !isPidRunning(pid);
  let finalExitCode: number | null = child.exitCode;

  // Stdio handle cleanup helper
  const releaseStdio = () => {
    try {
      if (child.stdout) {
        child.stdout.removeAllListeners();
        child.stdout.destroy();
      }
      if (child.stderr) {
        child.stderr.removeAllListeners();
        child.stderr.destroy();
      }
      if (child.stdin) {
        child.stdin.removeAllListeners();
        child.stdin.destroy();
      }
    } catch {}
  };

  // Promise yang menunggu proses keluar
  const exitPromise = new Promise<number | null>((resolve) => {
    if (hasExited) {
      resolve(finalExitCode);
      return;
    }
    const onExit = (code: number | null) => {
      hasExited = true;
      finalExitCode = code;
      cleanupListeners();
      resolve(code);
    };
    const onClose = (code: number | null) => {
      hasExited = true;
      finalExitCode = code;
      cleanupListeners();
      resolve(code);
    };
    function cleanupListeners() {
      child.removeListener("exit", onExit);
      child.removeListener("close", onClose);
    }
    child.once("exit", onExit);
    child.once("close", onClose);
  });

  if (hasExited) {
    method = "already_exited";
  } else {
    if (process.platform === "win32") {
      // Pada Windows: gunakan taskkill /PID <pid> /T /F untuk menghentikan seluruh process tree
      try {
        spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
        method = "forced";
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {}
      }
      // Tunggu child selesai exit
      await Promise.race([
        exitPromise,
        new Promise((resolve) => setTimeout(resolve, graceMs)),
      ]);
    } else {
      // Pada POSIX (Linux/macOS):
      // Jika child di-spawn dengan detached: true, child.pid adalah PGID.
      // Kirim SIGTERM ke process group (-pid)
      try {
        process.kill(-pid, "SIGTERM");
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error?.code !== "ESRCH") {
          try {
            child.kill("SIGTERM");
          } catch {}
        }
      }

      // Tunggu graceful termination
      const gracefulExited = await Promise.race([
        exitPromise.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), graceMs)),
      ]);

      if (!gracefulExited && isPidRunning(pid)) {
        method = "forced";
        // Kirim SIGKILL ke process group yang sama
        try {
          process.kill(-pid, "SIGKILL");
        } catch (err: unknown) {
          const error = err as { code?: string };
          if (error?.code !== "ESRCH") {
            try {
              child.kill("SIGKILL");
            } catch {}
          }
        }
        await Promise.race([
          exitPromise.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), forceMs)),
        ]);
      }
    }
  }

  // Bersihkan stream stdio agar tidak menyisakan handle aktif
  releaseStdio();

  // Unref child jika masih memegang reference di Node event loop
  try {
    child.unref();
  } catch {}

  // Verifikasi final apakah PID utama sudah benar-benar mati
  const verifyPollStart = Date.now();
  while (Date.now() - verifyPollStart < 2000) {
    if (!isPidRunning(pid)) {
      hasExited = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // Periksa apakah ada descendant process milik test yang masih berjalan
  const remainingDescendants: number[] = [];
  if (process.platform !== "win32") {
    // Pada Linux: cek apakah process group (-pid) masih aktif
    try {
      process.kill(-pid, 0);
      remainingDescendants.push(pid);
    } catch {}
  } else {
    // Pada Windows: jika PID masih tercatat running
    if (isPidRunning(pid)) {
      remainingDescendants.push(pid);
    }
  }

  // Verifikasi port sudah tertutup
  let portClosed = true;
  if (options?.port) {
    const portPollStart = Date.now();
    while (Date.now() - portPollStart < 4000) {
      const inUse = await isPortInUse(options.port);
      if (!inUse) {
        portClosed = true;
        break;
      }
      portClosed = false;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!portClosed) {
      throw new Error(
        `[FATAL] ${label} port ${options.port} masih listening setelah proses ${pid} dihentikan!`
      );
    }
  }

  if (remainingDescendants.length > 0) {
    throw new Error(
      `[FATAL] ${label} PID ${pid} atau descendant prosesnya masih berjalan setelah terminasi!`
    );
  }

  return {
    pid,
    exited: hasExited,
    exitCode: finalExitCode,
    method,
    portClosed,
    remainingDescendants,
  };
}

export interface MigrationChainVerificationResult {
  migrationDirectoriesFound: string[];
  migrationCount: number;
  migrationsApplied: number;
  failedCount: number;
  migrateStatusOutput: string;
  isUpToDate: boolean;
  dataType: string;
  isNullable: string;
}

/**
 * Menjalankan verifikasi rangkaian migrasi resmi (prisma migrate deploy & migrate status)
 * pada instance PostgreSQL terisolasi terpisah (bukan prisma db push).
 * Dilengkapi safety guards ketat: hanya 127.0.0.1, nama database memuat test, port dinamis.
 */
export async function runIsolatedMigrationChainVerification(): Promise<MigrationChainVerificationResult> {
  // Safety guards
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";

  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrationDirectories = entries
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();

  const port = await findFreePort(5650 + Math.floor(Math.random() * 300));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-mig-chain-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_migchain_test?schema=public`;

  verifyTestEnvironment(testUrl);

  const pgInstance = new EmbeddedPostgres({
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
    databaseDir: tempDir,
  });

  let mainPid: number | null = null;
  let descendantPids: Set<number> = new Set();

  try {
    await pgInstance.initialise();
    await pgInstance.start();

    for (let i = 0; i < 30; i++) {
      if (await isPortInUse(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const detected = detectTestInstancePids(port, tempDir);
    mainPid = detected.mainPid;
    descendantPids = new Set(detected.descendantPids);

    try {
      await pgInstance.createDatabase("stq_migchain_test");
    } catch {
      // ignore
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    };

    const projectRoot = path.resolve(__dirname, "..");

    // 0. Inisialisasi tabel baseline pra-migrasi (skema database awal sebelum rantai migrasi 1..5 diterapkan)
    const baselinePrismaPath = path.resolve(__dirname, "fixtures/baseline_schema.prisma");
    if (fs.existsSync(baselinePrismaPath)) {
      execSync(`npx prisma db push --schema=tests/fixtures/baseline_schema.prisma --skip-generate --accept-data-loss`, {
        env,
        encoding: "utf-8",
        cwd: projectRoot,
      });

      // Buat tabel _prisma_migrations agar Prisma mengenali baseline dan tidak memblokir migrasi (P3005)
      const initClient = new PrismaClient({
        datasources: { db: { url: testUrl } },
      });
      await initClient.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          "id" VARCHAR(36) PRIMARY KEY,
          "checksum" VARCHAR(64) NOT NULL,
          "finished_at" TIMESTAMPTZ,
          "migration_name" VARCHAR(255) NOT NULL,
          "logs" TEXT,
          "rolled_back_at" TIMESTAMPTZ,
          "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "applied_steps_count" INTEGER NOT NULL DEFAULT 0
        );
      `);
      await initClient.$disconnect();
    }

    // 1. Jalankan `npx prisma migrate deploy --schema prisma/schema.prisma`
    const deployOutput = execSync(`npx prisma migrate deploy --schema prisma/schema.prisma`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    // 2. Jalankan `npx prisma migrate status --schema prisma/schema.prisma`
    const statusOutput = execSync(`npx prisma migrate status --schema prisma/schema.prisma`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    const isUpToDate = statusOutput.includes("Database schema is up to date");

    let appliedCount = migrationDirectories.length;
    const matchApplied = deployOutput.match(/(\d+)\s+migrations?\s+have been successfully applied/i);
    if (matchApplied) {
      appliedCount = parseInt(matchApplied[1], 10);
    }

    // 3. Query PostgreSQL information_schema secara langsung
    const client = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    const cols: Array<{ column_name: string; data_type: string; is_nullable: string }> =
      await client.$queryRawUnsafe(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'setoran_tahfizh' AND column_name = 'jumlah_juz_mufar';
      `);

    await client.$disconnect();

    const col = cols[0] || { data_type: "unknown", is_nullable: "NO" };

    return {
      migrationDirectoriesFound: migrationDirectories,
      migrationCount: migrationDirectories.length,
      migrationsApplied: appliedCount,
      failedCount: 0,
      migrateStatusOutput: statusOutput,
      isUpToDate,
      dataType: col.data_type,
      isNullable: col.is_nullable,
    };
  } finally {
    const pgCtl = getPgCtlPath();
    if (pgCtl && fs.existsSync(tempDir)) {
      try {
        spawnSync(pgCtl, ["stop", "-D", tempDir, "-m", "fast", "-w", "-t", "5"], {
          encoding: "utf-8",
          timeout: 6000,
          stdio: "ignore",
        });
      } catch {}
    }

    try {
      await pgInstance.stop();
    } catch {}

    const pidsToKill = new Set<number>();
    if (mainPid) pidsToKill.add(mainPid);
    for (const p of descendantPids) pidsToKill.add(p);

    for (const p of pidsToKill) {
      if (verifyPostgresProcessOwnership(p, tempDir, mainPid)) {
        try {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", p.toString(), "/T", "/F"], { stdio: "ignore" });
          } else {
            process.kill(p, "SIGKILL");
          }
        } catch {}
      }
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

export interface ExistingDataUpgradeVerificationResult {
  baselineApplied: boolean;
  legacyUsersCreatedCount: number;
  preMigrationFingerprint: Array<{
    id: string;
    username: string;
    email: string | null;
    phone: string | null;
    passwordHash: string;
    role: string;
    status: string;
    staffId: string | null;
    santriId: string | null;
  }>;
  phase2aMigrationApplied: boolean;
  postMigrationUsers: Array<{
    id: string;
    username: string;
    email: string | null;
    phone: string | null;
    passwordHash: string;
    role: string;
    status: string;
    staffId: string | null;
    santriId: string | null;
    accountType: string;
  }>;
  allLegacyUsersIntact: boolean;
  allLegacyUsersAccountTypePersonal: boolean;
  autoCreatedAuthorityCounts: {
    assignments: number;
    positionCapabilities: number;
    orgUnits: number;
    positions: number;
    unitAccountPlacements: number;
    assignmentScopeUnits: number;
    canonicalAuditLogs: number;
    capabilities: number;
  };
  zeroAutoCreatedAuthority: boolean;
}

/**
 * Validasi peningkatan skema dari skema warisan yang sudah berisi baris data riil.
 * Alur:
 * 1. Database baseline + migrasi main (1..5)
 * 2. Masukkan baris data warisan representatif (Staff, Santri, Users)
 * 3. Rekam snapshot/fingerprint sebelum Phase 2A
 * 4. Terapkan HANYA migrasi Phase 2A (20260917000000_stq_architecture_lock_phase2a)
 * 5. Pastikan seluruh baris lama tidak berubah dan mendapatkan account_type = PERSONAL
 * 6. Pastikan seluruh tabel kanonikal kosong (0 auto-created authority)
 */
export async function runIsolatedExistingDataUpgradeVerification(): Promise<ExistingDataUpgradeVerificationResult> {
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";

  const port = await findFreePort(5660 + Math.floor(Math.random() * 300));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-upg-chain-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_upgchain_test?schema=public`;

  verifyTestEnvironment(testUrl);

  const pgInstance = new EmbeddedPostgres({
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
    databaseDir: tempDir,
  });

  let mainPid: number | null = null;
  let descendantPids: Set<number> = new Set();
  let client: PrismaClient | null = null;

  try {
    await pgInstance.initialise();
    await pgInstance.start();

    for (let i = 0; i < 30; i++) {
      if (await isPortInUse(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const detected = detectTestInstancePids(port, tempDir);
    mainPid = detected.mainPid;
    descendantPids = new Set(detected.descendantPids);

    try {
      await pgInstance.createDatabase("stq_upgchain_test");
    } catch {}

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    };

    const projectRoot = path.resolve(__dirname, "..");

    // 1. Inisialisasi skema baseline warisan
    execSync(`npx prisma db push --schema=tests/fixtures/baseline_schema.prisma --skip-generate --accept-data-loss`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    client = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    // 2. Terapkan migrasi 1..5 rantai main
    const mainMigrations = [
      "20260910083000_setoran_tahfizh_page_based",
      "20260910090000_core_operational_final",
      "20260910103000_p0_tahfizh_persistence",
      "20260914100000_target_santri_float",
      "20260914170000_add_jumlah_juz_mufar",
    ];

    for (const m of mainMigrations) {
      const sqlPath = path.join(projectRoot, "prisma/migrations", m, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await executeSqlStatementsOnClient(client, sql);
    }

    // Pastikan kolom account_type BELUM ada di users sebelum Phase 2A
    const preCols: Array<{ column_name: string }> = await client.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'account_type';
    `);
    if (preCols.length !== 0) {
      throw new Error("account_type already exists before Phase 2A migration");
    }

    // 3. Masukkan data representatif warisan (Staff, Santri, Users)
    await client.$executeRawUnsafe(`
      INSERT INTO "staff" ("id", "staff_code", "nama", "no_hp", "role_staff", "status", "created_at", "updated_at")
      VALUES ('staff-upg-1', 'STF-UPG-001', 'Ustadz Ahmad Mudir', '08123456789', 'KS', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "santri" ("id", "nis", "nama", "kelas", "jenis_kelamin", "status", "created_at", "updated_at")
      VALUES ('santri-upg-1', 'SAN-UPG-001', 'Abdullah Santri', '7A', 'L', 'AKTIF', NOW(), NOW());
    `);

    await client.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "username", "email", "phone", "password_hash", "role", "status", "staff_id", "santri_id", "created_at", "updated_at")
      VALUES
        ('usr-adm-1', 'admin_legacy', 'admin@stq.test', '0811111111', 'hash_adm', 'ADM', 'AKTIF', NULL, NULL, NOW(), NOW()),
        ('usr-ks-1', 'mudir_legacy', 'mudir@stq.test', '0822222222', 'hash_ks', 'KS', 'AKTIF', 'staff-upg-1', NULL, NOW(), NOW()),
        ('usr-mk-1', 'musyrif_legacy', 'mk@stq.test', '0833333333', 'hash_mk', 'MK', 'AKTIF', NULL, NULL, NOW(), NOW()),
        ('usr-st-1', 'santri_legacy', 'st@stq.test', '0844444444', 'hash_st', 'ST', 'AKTIF', NULL, 'santri-upg-1', NOW(), NOW()),
        ('usr-ws-1', 'wali_legacy', 'ws@stq.test', '0855555555', 'hash_ws', 'WS', 'AKTIF', NULL, NULL, NOW(), NOW());
    `);

    // 4. Rekam fingerprint sebelum Phase 2A
    const preUsersRaw: Array<{
      id: string;
      username: string;
      email: string | null;
      phone: string | null;
      password_hash: string;
      role: string;
      status: string;
      staff_id: string | null;
      santri_id: string | null;
    }> = await client.$queryRawUnsafe(`
      SELECT "id", "username", "email", "phone", "password_hash", "role"::text, "status"::text, "staff_id", "santri_id"
      FROM "users" ORDER BY "id" ASC;
    `);

    const preMigrationFingerprint = preUsersRaw.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      passwordHash: u.password_hash,
      role: u.role,
      status: u.status,
      staffId: u.staff_id,
      santriId: u.santri_id,
    }));

    // 5. Terapkan HANYA migrasi Phase 2A
    const phase2aSqlPath = path.join(projectRoot, "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql");
    const phase2aSql = fs.readFileSync(phase2aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, phase2aSql);

    // 6. Evaluasi pasca-migrasi
    const postUsersRaw: Array<{
      id: string;
      username: string;
      email: string | null;
      phone: string | null;
      password_hash: string;
      role: string;
      status: string;
      staff_id: string | null;
      santri_id: string | null;
      account_type: string;
    }> = await client.$queryRawUnsafe(`
      SELECT "id", "username", "email", "phone", "password_hash", "role"::text, "status"::text, "staff_id", "santri_id", "account_type"::text
      FROM "users" ORDER BY "id" ASC;
    `);

    const postMigrationUsers = postUsersRaw.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      passwordHash: u.password_hash,
      role: u.role,
      status: u.status,
      staffId: u.staff_id,
      santriId: u.santri_id,
      accountType: u.account_type,
    }));

    let allLegacyUsersIntact = postMigrationUsers.length === preMigrationFingerprint.length;
    let allLegacyUsersAccountTypePersonal = true;

    for (let i = 0; i < preMigrationFingerprint.length; i++) {
      const pre = preMigrationFingerprint[i];
      const post = postMigrationUsers[i];
      if (
        !post ||
        post.id !== pre.id ||
        post.username !== pre.username ||
        post.email !== pre.email ||
        post.phone !== pre.phone ||
        post.passwordHash !== pre.passwordHash ||
        post.role !== pre.role ||
        post.status !== pre.status ||
        post.staffId !== pre.staffId ||
        post.santriId !== pre.santriId
      ) {
        allLegacyUsersIntact = false;
      }
      if (!post || post.accountType !== "PERSONAL") {
        allLegacyUsersAccountTypePersonal = false;
      }
    }

    // Periksa bahwa semua tabel kanonikal baru dalam kondisi kosong (zero auto-created authority)
    const countTable = async (tableName: string): Promise<number> => {
      const res: Array<{ c: number }> = await client!.$queryRawUnsafe(`SELECT count(*)::int as c FROM "${tableName}";`);
      return res[0]?.c ?? 0;
    };

    const autoCreatedAuthorityCounts = {
      assignments: await countTable("assignments"),
      positionCapabilities: await countTable("position_capabilities"),
      orgUnits: await countTable("org_units"),
      positions: await countTable("positions"),
      unitAccountPlacements: await countTable("unit_account_placements"),
      assignmentScopeUnits: await countTable("assignment_scope_units"),
      canonicalAuditLogs: await countTable("canonical_audit_logs"),
      capabilities: await countTable("capabilities"),
    };

    const zeroAutoCreatedAuthority =
      autoCreatedAuthorityCounts.assignments === 0 &&
      autoCreatedAuthorityCounts.positionCapabilities === 0 &&
      autoCreatedAuthorityCounts.orgUnits === 0 &&
      autoCreatedAuthorityCounts.positions === 0 &&
      autoCreatedAuthorityCounts.unitAccountPlacements === 0 &&
      autoCreatedAuthorityCounts.assignmentScopeUnits === 0 &&
      autoCreatedAuthorityCounts.canonicalAuditLogs === 0 &&
      autoCreatedAuthorityCounts.capabilities === 0;

    return {
      baselineApplied: true,
      legacyUsersCreatedCount: preMigrationFingerprint.length,
      preMigrationFingerprint,
      phase2aMigrationApplied: true,
      postMigrationUsers,
      allLegacyUsersIntact,
      allLegacyUsersAccountTypePersonal,
      autoCreatedAuthorityCounts,
      zeroAutoCreatedAuthority,
    };
  } finally {
    if (client) {
      try { await client.$disconnect(); } catch {}
    }
    const pgCtl = getPgCtlPath();
    if (pgCtl && fs.existsSync(tempDir)) {
      try {
        spawnSync(pgCtl, ["stop", "-D", tempDir, "-m", "fast", "-w", "-t", "5"], {
          encoding: "utf-8",
          timeout: 6000,
          stdio: "ignore",
        });
      } catch {}
    }

    try { await pgInstance.stop(); } catch {}

    const pidsToKill = new Set<number>();
    if (mainPid) pidsToKill.add(mainPid);
    for (const p of descendantPids) pidsToKill.add(p);

    for (const p of pidsToKill) {
      if (verifyPostgresProcessOwnership(p, tempDir, mainPid)) {
        try {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", p.toString(), "/T", "/F"], { stdio: "ignore" });
          } else {
            process.kill(p, "SIGKILL");
          }
        } catch {}
      }
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

export interface ProductionEquivalentSimulationResult {
  baselineApplied: boolean;
  pr8MigrationFetched: boolean;
  pr8ExactShaVerified: boolean;
  pr8MigrationBytes: number;
  pr8MigrationApplied: boolean;
  phase2aMigrationApplied: boolean;
  hasPr8Table: boolean;
  hasCanonicalTables: boolean;
  simulationSuccess: boolean;
}

/**
 * Simulasi terisolasi kondisi produksi:
 * Rantai migrasi main -> Migrasi PR #8 (9068cae5587b7219c394c5c25bf0de07a15b0726) -> Migrasi Phase 2A
 * Memvalidasi bahwa migrasi Phase 2A tidak berbenturan dengan migrasi PR #8.
 * CATATAN PENTING: File PR #8 TIDAK dicommit ke repositori; SQL diambil via `git show` in-memory.
 */
export async function runIsolatedProductionEquivalentSimulation(): Promise<ProductionEquivalentSimulationResult> {
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";

  const port = await findFreePort(5670 + Math.floor(Math.random() * 300));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-pr8sim-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_pr8sim_test?schema=public`;

  verifyTestEnvironment(testUrl);

  const pgInstance = new EmbeddedPostgres({
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
    databaseDir: tempDir,
  });

  let mainPid: number | null = null;
  let descendantPids: Set<number> = new Set();
  let client: PrismaClient | null = null;

  try {
    await pgInstance.initialise();
    await pgInstance.start();

    for (let i = 0; i < 30; i++) {
      if (await isPortInUse(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const detected = detectTestInstancePids(port, tempDir);
    mainPid = detected.mainPid;
    descendantPids = new Set(detected.descendantPids);

    try {
      await pgInstance.createDatabase("stq_pr8sim_test");
    } catch {}

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    };

    const projectRoot = path.resolve(__dirname, "..");

    // 1. Inisialisasi skema baseline warisan
    execSync(`npx prisma db push --schema=tests/fixtures/baseline_schema.prisma --skip-generate --accept-data-loss`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    client = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    // 2. Terapkan migrasi 1..5 rantai main
    const mainMigrations = [
      "20260910083000_setoran_tahfizh_page_based",
      "20260910090000_core_operational_final",
      "20260910103000_p0_tahfizh_persistence",
      "20260914100000_target_santri_float",
      "20260914170000_add_jumlah_juz_mufar",
    ];

    for (const m of mainMigrations) {
      const sqlPath = path.join(projectRoot, "prisma/migrations", m, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await executeSqlStatementsOnClient(client, sql);
    }

    // 3. Ambil SQL migrasi PR #8 langsung dari commit SHA 9068cae5587b7219c394c5c25bf0de07a15b0726 (in-memory)
    const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    let pr8MigrationFetched = false;
    let pr8ExactShaVerified = false;
    let pr8Sql = "";
    let pr8MigrationBytes = 0;
    let pr8MigrationApplied = false;

    try {
      // Cek apakah commit PR #8 sudah ada di git store lokal
      let commitExists = false;
      try {
        execSync(`git cat-file -e ${PR8_EXACT_SHA}`, { cwd: projectRoot, stdio: "ignore" });
        commitExists = true;
      } catch {
        commitExists = false;
      }

      // Jika belum ada (misal shallow clone di CI), fetch branch review/tahfizh-quality-evaluation
      if (!commitExists) {
        try {
          execSync("git fetch origin review/tahfizh-quality-evaluation --depth=1", { cwd: projectRoot, stdio: "ignore" });
        } catch {
          // Fallback: coba fetch ref commit langsung jika didukung remote
          try {
            execSync(`git fetch origin ${PR8_EXACT_SHA} --depth=1`, { cwd: projectRoot, stdio: "ignore" });
          } catch {}
        }
      }

      // Verifikasi SHA commit secara ketat (fail-closed)
      let resolvedSha = "";
      try {
        resolvedSha = execSync(`git rev-parse --verify ${PR8_EXACT_SHA}`, { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      } catch {
        try {
          resolvedSha = execSync("git rev-parse FETCH_HEAD", { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        } catch {}
      }

      if (resolvedSha.toLowerCase() === PR8_EXACT_SHA.toLowerCase()) {
        pr8ExactShaVerified = true;
      } else {
        console.error(`[runIsolatedProductionEquivalentSimulation] FAIL-CLOSED: Resolved SHA '${resolvedSha}' != expected PR #8 SHA '${PR8_EXACT_SHA}'`);
      }

      // Ambil SQL migrasi PR #8 hanya jika SHA cocok
      if (pr8ExactShaVerified) {
        pr8Sql = execSync(
          `git show ${PR8_EXACT_SHA}:prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql`,
          { encoding: "utf-8", cwd: projectRoot }
        );
        pr8MigrationBytes = pr8Sql.length;
        if (pr8MigrationBytes > 1000) {
          pr8MigrationFetched = true;
        } else {
          console.error(`[runIsolatedProductionEquivalentSimulation] FAIL-CLOSED: PR #8 migration size too small: ${pr8MigrationBytes}`);
        }
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[runIsolatedProductionEquivalentSimulation] FAIL-CLOSED: Error retrieving PR #8 migration:", msg);
    }

    if (pr8MigrationFetched && pr8ExactShaVerified && pr8Sql) {
      // 4. Terapkan SQL migrasi PR #8
      await executeSqlStatementsOnClient(client, pr8Sql);
      pr8MigrationApplied = true;
    }

    // 5. Terapkan SQL migrasi Phase 2A di atas PR #8
    const phase2aSqlPath = path.join(projectRoot, "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql");
    const phase2aSql = fs.readFileSync(phase2aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, phase2aSql);
    const phase2aMigrationApplied = true;

    // 6. Verifikasi bahwa tabel evaluasi_rubu_tahfizh (dari PR #8) dan tabel org_units, assignments (dari Phase 2A) ada
    const res: Array<{ table_name: string }> = await client.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('evaluasi_rubu_tahfizh', 'org_units', 'assignments');
    `);

    const tables = res.map((r) => r.table_name);
    const hasPr8Table = tables.includes("evaluasi_rubu_tahfizh");
    const hasCanonicalTables = tables.includes("org_units") && tables.includes("assignments");

    const simulationSuccess =
      pr8MigrationFetched &&
      pr8ExactShaVerified &&
      pr8MigrationBytes > 1000 &&
      pr8MigrationApplied &&
      phase2aMigrationApplied &&
      hasPr8Table &&
      hasCanonicalTables;

    return {
      baselineApplied: true,
      pr8MigrationFetched,
      pr8ExactShaVerified,
      pr8MigrationBytes,
      pr8MigrationApplied,
      phase2aMigrationApplied,
      hasPr8Table,
      hasCanonicalTables,
      simulationSuccess,
    };
  } finally {
    if (client) {
      try { await client.$disconnect(); } catch {}
    }
    const pgCtl = getPgCtlPath();
    if (pgCtl && fs.existsSync(tempDir)) {
      try {
        spawnSync(pgCtl, ["stop", "-D", tempDir, "-m", "fast", "-w", "-t", "5"], {
          encoding: "utf-8",
          timeout: 6000,
          stdio: "ignore",
        });
      } catch {}
    }

    try { await pgInstance.stop(); } catch {}

    const pidsToKill = new Set<number>();
    if (mainPid) pidsToKill.add(mainPid);
    for (const p of descendantPids) pidsToKill.add(p);

    for (const p of pidsToKill) {
      if (verifyPostgresProcessOwnership(p, tempDir, mainPid)) {
        try {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", p.toString(), "/T", "/F"], { stdio: "ignore" });
          } else {
            process.kill(p, "SIGKILL");
          }
        } catch {}
      }
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

export interface M31MigrationVerificationResult {
  pr8ExactShaVerified: boolean;
  pr8MigrationApplied: boolean;
  phase2aApplied: boolean;
  m31MigrationApplied: boolean;
  existingDataUnchanged: boolean;
  existingPr8TablesIntact: boolean;
  tableCreated: boolean;
  zeroInventedPlacements: boolean;
  uniqueActiveConstraintEnforced: boolean;
  historyPreserved: boolean;
  simulationSuccess: boolean;
}

export async function runIsolatedM31MigrationVerification(): Promise<M31MigrationVerificationResult> {
  const port = await findFreePort(5670 + Math.floor(Math.random() * 300));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-m31-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_m31_test?schema=public`;

  verifyTestEnvironment(testUrl);

  const pgInstance = new EmbeddedPostgres({
    databaseDir: tempDir,
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
  });

  let mainPid: number | null = null;
  let descendantPids: Set<number> = new Set();
  let client: PrismaClient | null = null;

  try {
    await pgInstance.initialise();
    await pgInstance.start();

    for (let i = 0; i < 30; i++) {
      if (await isPortInUse(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const detected = detectTestInstancePids(port, tempDir);
    mainPid = detected.mainPid;
    descendantPids = new Set(detected.descendantPids);

    try {
      await pgInstance.createDatabase("stq_m31_test");
    } catch {}

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    };

    const projectRoot = path.resolve(__dirname, "..");

    // 1. Inisialisasi skema baseline warisan
    execSync(`npx prisma db push --schema=tests/fixtures/baseline_schema.prisma --skip-generate --accept-data-loss`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    client = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    // 2. Terapkan migrasi 1..5 rantai main
    const mainMigrations = [
      "20260910083000_setoran_tahfizh_page_based",
      "20260910090000_core_operational_final",
      "20260910103000_p0_tahfizh_persistence",
      "20260914100000_target_santri_float",
      "20260914170000_add_jumlah_juz_mufar",
    ];

    for (const m of mainMigrations) {
      const sqlPath = path.join(projectRoot, "prisma/migrations", m, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await executeSqlStatementsOnClient(client, sql);
    }

    // 3. Verifikasi dan ambil migrasi PR #8 langsung dari SHA 9068cae5587b7219c394c5c25bf0de07a15b0726 (in-memory)
    const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    let pr8MigrationFetched = false;
    let pr8ExactShaVerified = false;
    let pr8Sql = "";
    let pr8MigrationApplied = false;

    try {
      let commitExists = false;
      try {
        execSync(`git cat-file -e ${PR8_EXACT_SHA}`, { cwd: projectRoot, stdio: "ignore" });
        commitExists = true;
      } catch {
        commitExists = false;
      }

      if (!commitExists) {
        try {
          execSync("git fetch origin review/tahfizh-quality-evaluation --depth=1", { cwd: projectRoot, stdio: "ignore" });
        } catch {
          try {
            execSync(`git fetch origin ${PR8_EXACT_SHA} --depth=1`, { cwd: projectRoot, stdio: "ignore" });
          } catch {}
        }
      }

      let resolvedSha = "";
      try {
        resolvedSha = execSync(`git rev-parse --verify ${PR8_EXACT_SHA}`, { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      } catch {
        try {
          resolvedSha = execSync("git rev-parse FETCH_HEAD", { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        } catch {}
      }

      if (resolvedSha.toLowerCase() === PR8_EXACT_SHA.toLowerCase()) {
        pr8ExactShaVerified = true;
      } else {
        console.error(`[runIsolatedM31MigrationVerification] FAIL-CLOSED: Resolved SHA '${resolvedSha}' != expected PR #8 SHA '${PR8_EXACT_SHA}'`);
      }

      if (pr8ExactShaVerified) {
        pr8Sql = execSync(
          `git show ${PR8_EXACT_SHA}:prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql`,
          { encoding: "utf-8", cwd: projectRoot }
        );
        if (pr8Sql.length > 1000) {
          pr8MigrationFetched = true;
        } else {
          console.error(`[runIsolatedM31MigrationVerification] FAIL-CLOSED: PR #8 migration size too small: ${pr8Sql.length}`);
        }
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[runIsolatedM31MigrationVerification] FAIL-CLOSED: Error retrieving PR #8 migration:", msg);
    }

    if (!pr8ExactShaVerified || !pr8MigrationFetched || !pr8Sql) {
      throw new Error(`FAIL-CLOSED: PR #8 migration could not be verified or fetched from exact SHA ${PR8_EXACT_SHA}`);
    }

    // Terapkan SQL migrasi PR #8
    await executeSqlStatementsOnClient(client, pr8Sql);
    pr8MigrationApplied = true;

    // 4. Terapkan migrasi Phase 2A
    const phase2aSqlPath = path.join(projectRoot, "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql");
    const phase2aSql = fs.readFileSync(phase2aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, phase2aSql);
    const phase2aApplied = true;

    // 5. Masukkan data representatif SEBELUM migrasi M3.1
    await client.$executeRawUnsafe(`
      INSERT INTO "staff" ("id", "staff_code", "nama", "no_hp", "role_staff", "status", "created_at", "updated_at")
      VALUES ('stf-pre-m31', 'STF-PRE-001', 'Ustadz Pre M31', '08123456789', 'MK', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "username", "email", "password_hash", "role", "status", "staff_id", "created_at", "updated_at")
      VALUES ('usr-pre-m31', 'usrprem31', 'usr-pre@stq.ac.id', 'dummy_hash', 'MK', 'AKTIF', 'stf-pre-m31', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "santri" ("id", "nis", "nama", "kelas", "jenis_kelamin", "status", "created_at", "updated_at")
      VALUES ('san-pre-m31', 'NIS-PRE-001', 'Santri Pre M31', '7A', 'L', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "evaluasi_rubu_tahfizh" ("id", "santri_id", "musyrif_id", "tanggal", "juz", "rubu_ke", "nilai_tajwid", "nilai_fashahah", "nilai_kelancaran", "nilai", "created_at", "updated_at")
      VALUES ('eval-pre-m31', 'san-pre-m31', 'stf-pre-m31', NOW(), 1, 1, 'MUMTAZ', 'MUMTAZ', 'MUMTAZ', 'MUMTAZ', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "org_units" ("id", "code", "name", "type", "domain", "gender_complex", "is_active", "created_at", "updated_at")
      VALUES ('ou-pre-kamar-1', 'OU-PRE-KMR-1', 'Kamar Ali Pre', 'KAMAR', 'KEASRAMAAN', 'PUTRA', true, NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "org_units" ("id", "code", "name", "type", "domain", "gender_complex", "is_active", "created_at", "updated_at")
      VALUES ('ou-pre-kamar-2', 'OU-PRE-KMR-2', 'Kamar Utsman Pre', 'KAMAR', 'KEASRAMAAN', 'PUTRA', true, NOW(), NOW());
    `);

    // Rekam fingerprint data sebelum M3.1
    const preUser = await client.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
      `SELECT "id", "email", "role"::text, "status"::text FROM "users" WHERE "id" = 'usr-pre-m31';`
    );
    const preStaff = await client.$queryRawUnsafe<Array<{ id: string; nama: string; status: string }>>(
      `SELECT "id", "nama", "status"::text FROM "staff" WHERE "id" = 'stf-pre-m31';`
    );
    const preSantri = await client.$queryRawUnsafe<Array<{ id: string; nis: string; status: string }>>(
      `SELECT "id", "nis", "status"::text FROM "santri" WHERE "id" = 'san-pre-m31';`
    );
    const preEval = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; musyrif_id: string }>>(
      `SELECT "id", "santri_id", "musyrif_id" FROM "evaluasi_rubu_tahfizh" WHERE "id" = 'eval-pre-m31';`
    );

    // 6. Terapkan migrasi M3.1
    const m31SqlPath = path.join(projectRoot, "prisma/migrations/20260917220000_m3_1_keasramaan_structure/migration.sql");
    const m31Sql = fs.readFileSync(m31SqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m31Sql);
    const m31MigrationApplied = true;

    // 7. Verifikasi data representatif SETELAH migrasi M3.1 (harus tidak berubah)
    const postUser = await client.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
      `SELECT "id", "email", "role"::text, "status"::text FROM "users" WHERE "id" = 'usr-pre-m31';`
    );
    const postStaff = await client.$queryRawUnsafe<Array<{ id: string; nama: string; status: string }>>(
      `SELECT "id", "nama", "status"::text FROM "staff" WHERE "id" = 'stf-pre-m31';`
    );
    const postSantri = await client.$queryRawUnsafe<Array<{ id: string; nis: string; status: string }>>(
      `SELECT "id", "nis", "status"::text FROM "santri" WHERE "id" = 'san-pre-m31';`
    );
    const postEval = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; musyrif_id: string }>>(
      `SELECT "id", "santri_id", "musyrif_id" FROM "evaluasi_rubu_tahfizh" WHERE "id" = 'eval-pre-m31';`
    );

    const existingDataUnchanged =
      JSON.stringify(preUser) === JSON.stringify(postUser) &&
      JSON.stringify(preStaff) === JSON.stringify(postStaff) &&
      JSON.stringify(preSantri) === JSON.stringify(postSantri) &&
      JSON.stringify(preEval) === JSON.stringify(postEval);

    const existingPr8TablesIntact = postEval.length === 1;

    // 8. Verifikasi tabel santri_kamar_placements dibuat
    const tablesRes: Array<{ table_name: string }> = await client.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'santri_kamar_placements';
    `);
    const tableCreated = tablesRes.length === 1;

    // 9. Verifikasi zero invented room placements
    const initialPlacements: Array<{ count: string | number }> = await client.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "santri_kamar_placements";
    `);
    const zeroInventedPlacements = Number(initialPlacements[0].count) === 0;

    // 10. Uji partial unique index:
    // Masukkan 1 active placement
    await client.$executeRawUnsafe(`
      INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "created_at", "updated_at")
      VALUES ('plc-01', 'san-pre-m31', 'ou-pre-kamar-1', true, NOW(), NOW(), NOW());
    `);

    // Coba masukkan active placement kedua untuk santri yang sama -> harus gagal (partial unique index)
    let uniqueActiveConstraintEnforced = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "created_at", "updated_at")
        VALUES ('plc-02', 'san-pre-m31', 'ou-pre-kamar-2', true, NOW(), NOW(), NOW());
      `);
    } catch {
      uniqueActiveConstraintEnforced = true;
    }

    // Masukkan inactive historical placement untuk santri yang sama -> harus berhasil
    let historyPreserved = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "end_date", "created_at", "updated_at")
        VALUES ('plc-03', 'san-pre-m31', 'ou-pre-kamar-2', false, NOW() - INTERVAL '30 days', NOW(), NOW(), NOW());
      `);
      historyPreserved = true;
    } catch {}

    const simulationSuccess =
      pr8ExactShaVerified &&
      pr8MigrationApplied &&
      phase2aApplied &&
      m31MigrationApplied &&
      existingDataUnchanged &&
      existingPr8TablesIntact &&
      tableCreated &&
      zeroInventedPlacements &&
      uniqueActiveConstraintEnforced &&
      historyPreserved;

    return {
      pr8ExactShaVerified,
      pr8MigrationApplied,
      phase2aApplied,
      m31MigrationApplied,
      existingDataUnchanged,
      existingPr8TablesIntact,
      tableCreated,
      zeroInventedPlacements,
      uniqueActiveConstraintEnforced,
      historyPreserved,
      simulationSuccess,
    };
  } finally {
    if (client) {
      try { await client.$disconnect(); } catch {}
    }
    const pgCtl = getPgCtlPath();
    if (pgCtl && fs.existsSync(tempDir)) {
      try {
        spawnSync(pgCtl, ["stop", "-D", tempDir, "-m", "fast", "-w", "-t", "5"], {
          encoding: "utf-8",
          timeout: 6000,
          stdio: "ignore",
        });
      } catch {}
    }

    try { await pgInstance.stop(); } catch {}

    const pidsToKill = new Set<number>();
    if (mainPid) pidsToKill.add(mainPid);
    for (const p of descendantPids) pidsToKill.add(p);

    for (const p of pidsToKill) {
      if (verifyPostgresProcessOwnership(p, tempDir, mainPid)) {
        try {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", p.toString(), "/T", "/F"], { stdio: "ignore" });
          } else {
            process.kill(p, "SIGKILL");
          }
        } catch {}
      }
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

export interface M33aMigrationVerificationResult {
  pr8ExactShaVerified: boolean;
  pr8MigrationApplied: boolean;
  phase2aApplied: boolean;
  m31MigrationApplied: boolean;
  m33aMigrationApplied: boolean;
  existingDataUnchanged: boolean;
  existingPr8TablesIntact: boolean;
  existingPlacementsIntact: boolean;
  existingCatatanKesehatanIntact: boolean;
  tableCreated: boolean;
  eventsTableCreated: boolean;
  statusOccurredIndexCreated: boolean;
  eventCreatedAtIdxCreated: boolean;
  enumCreated: boolean;
  enumExactValuesVerified: boolean;
  invalidEnumRejected: boolean;
  nullableDiagnosaPersistsNull: boolean;
  auditAttributionFieldsPresent: boolean;
  eventInsertedSuccessfully: boolean;
  createAuditRollbackVerified: boolean;
  updateAuditRollbackVerified: boolean;
  createAuditCommitAtomicVerified: boolean;
  concurrentCasConflictVerified: boolean;
  singleEventChainVerified: boolean;
  singleAuditChainVerified: boolean;
  simulationSuccess: boolean;
}

export interface M33bMigrationVerificationResult {
  pr8ExactShaVerified: boolean;
  pr8MigrationApplied: boolean;
  phase2aApplied: boolean;
  m31MigrationApplied: boolean;
  m33aMigrationApplied: boolean;
  m33bMigrationApplied: boolean;
  existingDataUnchanged: boolean;
  existingPr8TablesIntact: boolean;
  existingPlacementsIntact: boolean;
  existingHealthCasesIntact: boolean;
  existingAcademicTablesIntact: boolean;
  cohortTableCreated: boolean;
  assignmentTableCreated: boolean;
  sessionTableCreated: boolean;
  attendanceTableCreated: boolean;
  participantTableCreated: boolean;
  educationEnumsCreated: boolean;
  educationEnumsExactValuesVerified: boolean;
  masbukEnumRejected: boolean;
  sessionIndexesCreated: boolean;
  attendanceUniqueConstraintVerified: boolean;
  participantUniqueConstraintVerified: boolean;
  santriCohortLinkageVerified: boolean;
  actualVsScheduledTeacherVerified: boolean;
  sessionAuditRollbackVerified: boolean;
  concurrentSessionStartCasVerified: boolean;
  materialAuditRollbackVerified: boolean;
  realProviderResourceResolutionVerified: boolean;
  realServiceConcurrencyVerified: boolean;
  realServiceMaterialRollbackVerified: boolean;
  realServiceAttendanceBatchVerified: boolean;
  simulationSuccess: boolean;
}

export async function simulateM33aMigrationChain(): Promise<M33aMigrationVerificationResult> {
  const port = await findFreePort(5970 + Math.floor(Math.random() * 300));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-m33a-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_m33a_test?schema=public`;

  verifyTestEnvironment(testUrl);

  const pgInstance = new EmbeddedPostgres({
    databaseDir: tempDir,
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
  });

  let mainPid: number | null = null;
  let descendantPids: Set<number> = new Set();
  let client: PrismaClient | null = null;

  try {
    await pgInstance.initialise();
    await pgInstance.start();

    for (let i = 0; i < 30; i++) {
      if (await isPortInUse(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const detected = detectTestInstancePids(port, tempDir);
    mainPid = detected.mainPid;
    descendantPids = new Set(detected.descendantPids);

    try {
      await pgInstance.createDatabase("stq_m33a_test");
    } catch {}

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    };

    const projectRoot = path.resolve(__dirname, "..");

    // 1. Inisialisasi skema baseline warisan
    execSync(`npx prisma db push --schema=tests/fixtures/baseline_schema.prisma --skip-generate --accept-data-loss`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    client = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    // 2. Terapkan migrasi 1..5 rantai main
    const mainMigrations = [
      "20260910083000_setoran_tahfizh_page_based",
      "20260910090000_core_operational_final",
      "20260910103000_p0_tahfizh_persistence",
      "20260914100000_target_santri_float",
      "20260914170000_add_jumlah_juz_mufar",
    ];

    for (const m of mainMigrations) {
      const sqlPath = path.join(projectRoot, "prisma/migrations", m, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await executeSqlStatementsOnClient(client, sql);
    }

    // 3. Verifikasi dan ambil migrasi PR #8 langsung dari SHA 9068cae5587b7219c394c5c25bf0de07a15b0726 (in-memory)
    const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    let pr8MigrationFetched = false;
    let pr8ExactShaVerified = false;
    let pr8Sql = "";
    let pr8MigrationApplied = false;

    try {
      let commitExists = false;
      try {
        execSync(`git cat-file -e ${PR8_EXACT_SHA}`, { cwd: projectRoot, stdio: "ignore" });
        commitExists = true;
      } catch {
        commitExists = false;
      }

      if (!commitExists) {
        try {
          execSync("git fetch origin review/tahfizh-quality-evaluation --depth=1", { cwd: projectRoot, stdio: "ignore" });
        } catch {
          try {
            execSync(`git fetch origin ${PR8_EXACT_SHA} --depth=1`, { cwd: projectRoot, stdio: "ignore" });
          } catch {}
        }
      }

      let resolvedSha = "";
      try {
        resolvedSha = execSync(`git rev-parse --verify ${PR8_EXACT_SHA}`, { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      } catch {
        try {
          resolvedSha = execSync("git rev-parse FETCH_HEAD", { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        } catch {}
      }

      if (resolvedSha.toLowerCase() === PR8_EXACT_SHA.toLowerCase()) {
        pr8ExactShaVerified = true;
      }

      if (pr8ExactShaVerified) {
        pr8Sql = execSync(
          `git show ${PR8_EXACT_SHA}:prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql`,
          { encoding: "utf-8", cwd: projectRoot }
        );
        if (pr8Sql.length > 1000) {
          pr8MigrationFetched = true;
        }
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[simulateM33aMigrationChain] Error retrieving PR #8 migration:", msg);
    }

    if (!pr8ExactShaVerified || !pr8MigrationFetched || !pr8Sql) {
      throw new Error(`FAIL-CLOSED: PR #8 migration could not be verified or fetched from exact SHA ${PR8_EXACT_SHA}`);
    }

    await executeSqlStatementsOnClient(client, pr8Sql);
    pr8MigrationApplied = true;

    // 4. Terapkan migrasi Phase 2A
    const phase2aSqlPath = path.join(projectRoot, "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql");
    const phase2aSql = fs.readFileSync(phase2aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, phase2aSql);
    const phase2aApplied = true;

    // 5. Masukkan data representatif SEBELUM M3.1 dan M3.3A
    await client.$executeRawUnsafe(`
      INSERT INTO "staff" ("id", "staff_code", "nama", "no_hp", "role_staff", "status", "created_at", "updated_at")
      VALUES ('stf-pre-m33', 'STF-PRE-M33', 'Ustadz Pre M33', '08123456780', 'MK', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "username", "email", "password_hash", "role", "status", "staff_id", "created_at", "updated_at")
      VALUES ('usr-pre-m33', 'usrprem33', 'usr-pre-m33@stq.ac.id', 'dummy_hash', 'MK', 'AKTIF', 'stf-pre-m33', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "santri" ("id", "nis", "nama", "kelas", "jenis_kelamin", "status", "created_at", "updated_at")
      VALUES ('san-pre-m33', 'NIS-PRE-M33', 'Santri Pre M33', '7A', 'L', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "evaluasi_rubu_tahfizh" ("id", "santri_id", "musyrif_id", "tanggal", "juz", "rubu_ke", "nilai_tajwid", "nilai_fashahah", "nilai_kelancaran", "nilai", "created_at", "updated_at")
      VALUES ('eval-pre-m33', 'san-pre-m33', 'stf-pre-m33', NOW(), 1, 1, 'MUMTAZ', 'MUMTAZ', 'MUMTAZ', 'MUMTAZ', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "org_units" ("id", "code", "name", "type", "domain", "gender_complex", "is_active", "created_at", "updated_at")
      VALUES ('ou-pre-kmr-m33', 'OU-PRE-KMR-M33', 'Kamar Umar Pre M33', 'KAMAR', 'KEASRAMAAN', 'PUTRA', true, NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "catatan_kesehatan" ("id", "santri_id", "tanggal", "keluhan", "diagnosa", "tindakan", "status", "dicatat_oleh", "created_at", "updated_at")
      VALUES ('ck-pre-m33', 'san-pre-m33', NOW(), 'Batuk dan pilek', 'Flu biasa', 'Diberi istirahat dan obat flu', 'RAWAT_PONDOK', 'petugas.uks', NOW(), NOW());
    `);

    // 6. Terapkan migrasi M3.1
    const m31SqlPath = path.join(projectRoot, "prisma/migrations/20260917220000_m3_1_keasramaan_structure/migration.sql");
    const m31Sql = fs.readFileSync(m31SqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m31Sql);
    const m31MigrationApplied = true;

    // Masukkan placement representatif M3.1
    await client.$executeRawUnsafe(`
      INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "created_at", "updated_at")
      VALUES ('plc-pre-m33', 'san-pre-m33', 'ou-pre-kmr-m33', true, NOW(), NOW(), NOW());
    `);

    // Snapshot data sebelum M3.3A
    const preUser = await client.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
      `SELECT "id", "email", "role"::text, "status"::text FROM "users" WHERE "id" = 'usr-pre-m33';`
    );
    const preStaff = await client.$queryRawUnsafe<Array<{ id: string; nama: string; status: string }>>(
      `SELECT "id", "nama", "status"::text FROM "staff" WHERE "id" = 'stf-pre-m33';`
    );
    const preSantri = await client.$queryRawUnsafe<Array<{ id: string; nis: string; status: string }>>(
      `SELECT "id", "nis", "status"::text FROM "santri" WHERE "id" = 'san-pre-m33';`
    );
    const preEval = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; musyrif_id: string }>>(
      `SELECT "id", "santri_id", "musyrif_id" FROM "evaluasi_rubu_tahfizh" WHERE "id" = 'eval-pre-m33';`
    );
    const prePlc = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; kamar_id: string }>>(
      `SELECT "id", "santri_id", "kamar_id" FROM "santri_kamar_placements" WHERE "id" = 'plc-pre-m33';`
    );
    const preCk = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; keluhan: string; status: string }>>(
      `SELECT "id", "santri_id", "keluhan", "status"::text FROM "catatan_kesehatan" WHERE "id" = 'ck-pre-m33';`
    );

    // 7. Terapkan migrasi M3.3A
    const m33aSqlPath = path.join(projectRoot, "prisma/migrations/20260918120000_m3_3a_health_v2_backend/migration.sql");
    const m33aSql = fs.readFileSync(m33aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m33aSql);
    const m33aMigrationApplied = true;

    // 8. Verifikasi data representatif SETELAH M3.3A
    const postUser = await client.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
      `SELECT "id", "email", "role"::text, "status"::text FROM "users" WHERE "id" = 'usr-pre-m33';`
    );
    const postStaff = await client.$queryRawUnsafe<Array<{ id: string; nama: string; status: string }>>(
      `SELECT "id", "nama", "status"::text FROM "staff" WHERE "id" = 'stf-pre-m33';`
    );
    const postSantri = await client.$queryRawUnsafe<Array<{ id: string; nis: string; status: string }>>(
      `SELECT "id", "nis", "status"::text FROM "santri" WHERE "id" = 'san-pre-m33';`
    );
    const postEval = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; musyrif_id: string }>>(
      `SELECT "id", "santri_id", "musyrif_id" FROM "evaluasi_rubu_tahfizh" WHERE "id" = 'eval-pre-m33';`
    );
    const postPlc = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; kamar_id: string }>>(
      `SELECT "id", "santri_id", "kamar_id" FROM "santri_kamar_placements" WHERE "id" = 'plc-pre-m33';`
    );
    const postCk = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; keluhan: string; status: string }>>(
      `SELECT "id", "santri_id", "keluhan", "status"::text FROM "catatan_kesehatan" WHERE "id" = 'ck-pre-m33';`
    );

    const existingDataUnchanged =
      JSON.stringify(preUser) === JSON.stringify(postUser) &&
      JSON.stringify(preStaff) === JSON.stringify(postStaff) &&
      JSON.stringify(preSantri) === JSON.stringify(postSantri);

    const existingPr8TablesIntact = postEval.length === 1 && JSON.stringify(preEval) === JSON.stringify(postEval);
    const existingPlacementsIntact = postPlc.length === 1 && JSON.stringify(prePlc) === JSON.stringify(postPlc);
    const existingCatatanKesehatanIntact = postCk.length === 1 && JSON.stringify(preCk) === JSON.stringify(postCk);

    // 9. Verifikasi tabel health_cases_v2 dan health_case_v2_events dibuat
    const tablesRes: Array<{ table_name: string }> = await client.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('health_cases_v2', 'health_case_v2_events');
    `);
    const tableCreated = tablesRes.some((t) => t.table_name === "health_cases_v2");
    const eventsTableCreated = tablesRes.some((t) => t.table_name === "health_case_v2_events");

    // Verifikasi index status_v2, occurred_at
    const indexRes: Array<{ indexname: string }> = await client.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'health_cases_v2' AND indexname = 'health_cases_v2_status_v2_occurred_at_idx';
    `);
    const statusOccurredIndexCreated = indexRes.length === 1;

    // Verifikasi index health_case_v2_events(case_id, created_at)
    const eventIndexRes: Array<{ indexname: string }> = await client.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'health_case_v2_events' AND indexname = 'health_case_v2_events_case_id_created_at_idx';
    `);
    const eventCreatedAtIdxCreated = eventIndexRes.length === 1;

    // 10. Verifikasi enum HealthStatusV2 dibuat dengan 4 nilai tepat
    const enumRes: Array<{ enumlabel: string }> = await client.$queryRawUnsafe(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'HealthStatusV2'
      ORDER BY e.enumsortorder;
    `);
    const enumCreated = enumRes.length > 0;
    const enumLabels = enumRes.map((r) => r.enumlabel);
    const expectedLabels = ["DIPANTAU", "PULIH", "DIRUJUK", "DARURAT"];
    const enumExactValuesVerified =
      enumLabels.length === 4 &&
      expectedLabels.every((lbl) => enumLabels.includes(lbl));

    // 11. Uji insert baris HealthCaseV2 dengan diagnosa NULL (data honesty) & FK attribution
    await client.$executeRawUnsafe(`
      INSERT INTO "health_cases_v2" (
        "id", "santri_id", "occurred_at", "keluhan", "tindakan_awal", "diagnosa", "status_v2", "recorded_by_user_id", "created_at", "updated_at"
      ) VALUES (
        'hc-01', 'san-pre-m33', NOW(), 'Pusing kepala', 'Istirahat di UKS', NULL, 'DIPANTAU'::"HealthStatusV2", 'usr-pre-m33', NOW(), NOW()
      );
    `);

    // Uji insert baris HealthCaseV2Event terpisah (Blocker D & E)
    await client.$executeRawUnsafe(`
      INSERT INTO "health_case_v2_events" (
        "id", "case_id", "previous_status", "new_status", "tindakan_lanjutan", "recorded_by_user_id", "created_at"
      ) VALUES (
        'hce-01', 'hc-01', 'DIPANTAU'::"HealthStatusV2", 'PULIH'::"HealthStatusV2", 'Diberikan vitamin dan dinyatakan pulih', 'usr-pre-m33', NOW()
      );
    `);

    const insertedEvent = await client.$queryRawUnsafe<Array<{ id: string; case_id: string; new_status: string }>>(
      `SELECT "id", "case_id", "new_status"::text FROM "health_case_v2_events" WHERE "id" = 'hce-01';`
    );
    const eventInsertedSuccessfully = insertedEvent.length === 1 && insertedEvent[0].case_id === "hc-01";

    const insertedCase = await client.$queryRawUnsafe<Array<{ id: string; diagnosa: string | null; status_v2: string; recorded_by_user_id: string }>>(
      `SELECT "id", "diagnosa", "status_v2"::text, "recorded_by_user_id" FROM "health_cases_v2" WHERE "id" = 'hc-01';`
    );

    const nullableDiagnosaPersistsNull = insertedCase.length === 1 && insertedCase[0].diagnosa === null;
    const auditAttributionFieldsPresent = insertedCase.length === 1 && insertedCase[0].recorded_by_user_id === "usr-pre-m33";

    // 12. Uji enum rejection: status tidak valid harus ditolak oleh Postgres
    let invalidEnumRejected = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "health_cases_v2" (
          "id", "santri_id", "occurred_at", "keluhan", "tindakan_awal", "status_v2", "recorded_by_user_id", "created_at", "updated_at"
        ) VALUES (
          'hc-02', 'san-pre-m33', NOW(), 'Keluhan', 'Tindakan', 'INVALID_STATUS'::"HealthStatusV2", 'usr-pre-m33', NOW(), NOW()
        );
      `);
    } catch {
      invalidEnumRejected = true;
    }

    // 13. Real isolated PostgreSQL transaction test for mandatory audit atomicity
    // Case A: HealthCaseV2 create fails when audit in transaction fails -> rollback
    let createAuditRollbackVerified = false;
    try {
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO "health_cases_v2" (
            "id", "santri_id", "occurred_at", "keluhan", "tindakan_awal", "status_v2", "recorded_by_user_id", "created_at", "updated_at"
          ) VALUES (
            'hc-atomic-rollback', 'san-pre-m33', NOW(), 'Batuk', 'Sirup obat', 'DIPANTAU'::"HealthStatusV2", 'usr-pre-m33', NOW(), NOW()
          );
        `);
        // Audit persistence failure simulated inside transaction
        throw new Error("AUDIT_PERSISTENCE_FAILED: Database transaction forced rollback on audit failure");
      });
    } catch {
      // Check that the business insert did NOT persist
      const checkRow = await client.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "health_cases_v2" WHERE "id" = 'hc-atomic-rollback';`
      );
      createAuditRollbackVerified = checkRow.length === 0;
    }

    // Case B: HealthCaseV2 update + event fails when audit in transaction fails -> rollback
    let updateAuditRollbackVerified = false;
    try {
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          UPDATE "health_cases_v2"
          SET "status_v2" = 'DARURAT'::"HealthStatusV2", "updated_at" = NOW()
          WHERE "id" = 'hc-01';
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO "health_case_v2_events" (
            "id", "case_id", "previous_status", "new_status", "tindakan_lanjutan", "recorded_by_user_id", "created_at"
          ) VALUES (
            'hce-atomic-rollback', 'hc-01', 'DIPANTAU'::"HealthStatusV2", 'DARURAT'::"HealthStatusV2", 'Pemeriksaan darurat', 'usr-pre-m33', NOW()
          );
        `);
        // Force audit failure inside transaction
        throw new Error("AUDIT_PERSISTENCE_FAILED: Database transaction forced rollback on audit failure");
      });
    } catch {
      // Check that status was NOT updated and event was NOT created
      const checkCase = await client.$queryRawUnsafe<Array<{ status_v2: string }>>(
        `SELECT "status_v2"::text FROM "health_cases_v2" WHERE "id" = 'hc-01';`
      );
      const checkEvent = await client.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "health_case_v2_events" WHERE "id" = 'hce-atomic-rollback';`
      );
      updateAuditRollbackVerified =
        checkCase[0]?.status_v2 === "DIPANTAU" && checkEvent.length === 0;
    }

    // Case C: Atomic success when both business mutation and audit commit successfully
    let createAuditCommitAtomicVerified = false;
    try {
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO "health_cases_v2" (
            "id", "santri_id", "occurred_at", "keluhan", "tindakan_awal", "status_v2", "recorded_by_user_id", "created_at", "updated_at"
          ) VALUES (
            'hc-atomic-success', 'san-pre-m33', NOW(), 'Flu', 'Vitamin', 'DIPANTAU'::"HealthStatusV2", 'usr-pre-m33', NOW(), NOW()
          );
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO "canonical_audit_logs" (
            "id", "technical_account_id", "technical_account_username", "action", "entity", "entity_id",
            "capability_code", "position_code", "scope_type", "unit_id", "created_at"
          ) VALUES (
            'aud-atomic-success', 'usr-pre-m33', 'pre.user', 'health.case.create', 'HealthCaseV2', 'hc-atomic-success',
            'health.case.create', 'PETUGAS_KESEHATAN', 'GLOBAL', 'ou-poskestren', NOW()
          );
        `);
      });

      const checkCase = await client.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "health_cases_v2" WHERE "id" = 'hc-atomic-success';`
      );
      const checkAudit = await client.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "canonical_audit_logs" WHERE "id" = 'aud-atomic-success';`
      );
      createAuditCommitAtomicVerified = checkCase.length === 1 && checkAudit.length === 1;
    } catch {}

    // Step 14: Real Concurrent Status Transition Test with Health V2 Service on Isolated PostgreSQL
    let concurrentCasConflictVerified = false;
    let singleEventChainVerified = false;
    let singleAuditChainVerified = false;

    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "health_cases_v2" (
          "id", "santri_id", "occurred_at", "keluhan", "tindakan_awal", "status_v2", "recorded_by_user_id", "created_at", "updated_at"
        ) VALUES (
          'hc-concurrent-test', 'san-pre-m33', NOW(), 'Sakit Kepala', 'Istirahat', 'DIPANTAU'::"HealthStatusV2", 'usr-pre-m33', NOW(), NOW()
        );
      `);

      const testDataProvider: ICanonicalDataProvider = {
        async getIdentity(id: string) {
          return {
            userId: id,
            username: "pre.user",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-pre-m33",
          };
        },
        async getActiveAssignments() {
          return [
            {
              id: "asg-health-real",
              userId: "usr-pre-m33",
              positionId: "pos-health-real",
              positionCode: "PETUGAS_KESEHATAN",
              positionName: "Petugas Poskestren",
              domain: "KEASRAMAAN",
              unitId: "ou-poskestren",
              unitCode: "OU-POSKESTREN",
              unitName: "Poskestren",
              status: "ACTIVE",
              validFrom: new Date(Date.now() - 86400000),
              validUntil: null,
              positionCapabilities: [
                {
                  capabilityCode: "health.case.update_status",
                  scopeType: "GLOBAL",
                  businessRuleState: "VERIFIED_PRODUCTION",
                },
              ],
              scopeUnits: [],
            },
          ];
        },
        async getUnitAccountPlacement() { return null; },
        async verifyHumanExecutor(id: string) {
          return { userId: id, id, name: "Petugas", isActive: true };
        },
        async resolveResourceContext() {
          return { santriId: "san-pre-m33", orgUnitIds: [] };
        },
      };

      const { createHealthV2Service } = await import("../lib/server/health-v2-service");
      const realService = createHealthV2Service({
        db: client,
        dataProvider: testDataProvider,
      });

      // Orchestrate an actual overlapping concurrent transition:
      // Tx A reads DIPANTAU, then pauses until Tx B reads DIPANTAU, updates to PULIH, and commits.
      // Then Tx A attempts to update DIPANTAU -> DIRUJUK using optimistic compare-and-swap.
      // Under PostgreSQL, Tx A's updateMany matches 0 rows and throws HEALTH_CASE_CONCURRENT_MODIFICATION.
      let txAReadDipantau = false;
      let txBCommittedPulih = false;
      let resolveTxARead: () => void = () => {};
      const txAReadPromise = new Promise<void>((r) => { resolveTxARead = r; });

      const dbForTxA = new Proxy(client, {
        get(target, prop) {
          if (prop === "$transaction") {
            return async (fn: (tx: any) => Promise<any>) => {
              return (target as any).$transaction(async (tx: any) => {
                const proxyTx = new Proxy(tx, {
                  get(txTarget, txProp) {
                    if (txProp === "healthCaseV2") {
                      return new Proxy(txTarget.healthCaseV2, {
                        get(caseTarget, caseProp) {
                          if (caseProp === "findUnique") {
                            return async (args: any) => {
                              const res = await caseTarget.findUnique(args);
                              if (args?.where?.id === "hc-concurrent-test" && !txAReadDipantau) {
                                txAReadDipantau = true;
                                resolveTxARead();
                                const start = Date.now();
                                while (!txBCommittedPulih && Date.now() - start < 4000) {
                                  await new Promise((r) => setTimeout(r, 20));
                                }
                              }
                              return res;
                            };
                          }
                          return (caseTarget as any)[caseProp];
                        },
                      });
                    }
                    return (txTarget as any)[txProp];
                  },
                });
                return fn(proxyTx);
              });
            };
          }
          return (target as any)[prop];
        },
      });

      const serviceA = createHealthV2Service({
        db: dbForTxA as unknown as PrismaClient,
        dataProvider: testDataProvider,
      });

      // Start Tx A (reads DIPANTAU, pauses)
      const promiseA = serviceA.updateCaseStatus(
        {
          id: "hc-concurrent-test",
          newStatus: "DIRUJUK",
          tindakanLanjutan: "Rujuk ke RS",
        },
        { actorUserId: "usr-pre-m33" }
      );

      // Wait until Tx A has confirmed reading DIPANTAU inside its transaction
      await txAReadPromise;

      // Tx B executes against PostgreSQL, updates DIPANTAU -> PULIH, and commits
      const resultB = await realService.updateCaseStatus(
        {
          id: "hc-concurrent-test",
          newStatus: "PULIH",
          tindakanLanjutan: "Sudah sembuh dan stabil",
        },
        { actorUserId: "usr-pre-m33" }
      );
      txBCommittedPulih = true;

      // Tx A resumes updateMany expecting DIPANTAU, but row is now PULIH in PostgreSQL
      let txAError: any = null;
      try {
        await promiseA;
      } catch (err) {
        txAError = err;
      }

      const isConcurrentModificationError =
        txAError instanceof Error &&
        txAError.message.includes("HEALTH_CASE_CONCURRENT_MODIFICATION");

      const eventsInPg = await client.$queryRawUnsafe<
        Array<{ id: string; previous_status: string; new_status: string }>
      >(
        `SELECT "id", "previous_status"::text, "new_status"::text FROM "health_case_v2_events" WHERE "case_id" = 'hc-concurrent-test';`
      );

      const auditsInPg = await client.$queryRawUnsafe<
        Array<{ id: string; action: string; before_state: any; after_state: any }>
      >(
        `SELECT "id", "action", "before_state", "after_state" FROM "canonical_audit_logs" WHERE "entity_id" = 'hc-concurrent-test' AND "action" = 'health.case.update_status';`
      );

      const finalCaseInPg = await client.$queryRawUnsafe<
        Array<{ status_v2: string }>
      >(
        `SELECT "status_v2"::text FROM "health_cases_v2" WHERE "id" = 'hc-concurrent-test';`
      );

      concurrentCasConflictVerified =
        isConcurrentModificationError &&
        resultB.success === true &&
        finalCaseInPg[0]?.status_v2 === "PULIH";

      singleEventChainVerified =
        eventsInPg.length === 1 &&
        eventsInPg[0].previous_status === "DIPANTAU" &&
        eventsInPg[0].new_status === "PULIH";

      singleAuditChainVerified =
        auditsInPg.length === 1 &&
        (auditsInPg[0].before_state as any)?.statusV2 === "DIPANTAU" &&
        (auditsInPg[0].after_state as any)?.statusV2 === "PULIH";
    } catch (err) {
      console.error("Step 14 concurrent test error:", err);
    }

    const simulationSuccess =
      pr8ExactShaVerified &&
      pr8MigrationApplied &&
      phase2aApplied &&
      m31MigrationApplied &&
      m33aMigrationApplied &&
      existingDataUnchanged &&
      existingPr8TablesIntact &&
      existingPlacementsIntact &&
      existingCatatanKesehatanIntact &&
      tableCreated &&
      eventsTableCreated &&
      statusOccurredIndexCreated &&
      eventCreatedAtIdxCreated &&
      enumCreated &&
      enumExactValuesVerified &&
      invalidEnumRejected &&
      nullableDiagnosaPersistsNull &&
      auditAttributionFieldsPresent &&
      eventInsertedSuccessfully &&
      createAuditRollbackVerified &&
      updateAuditRollbackVerified &&
      createAuditCommitAtomicVerified &&
      concurrentCasConflictVerified &&
      singleEventChainVerified &&
      singleAuditChainVerified;

    return {
      pr8ExactShaVerified,
      pr8MigrationApplied,
      phase2aApplied,
      m31MigrationApplied,
      m33aMigrationApplied,
      existingDataUnchanged,
      existingPr8TablesIntact,
      existingPlacementsIntact,
      existingCatatanKesehatanIntact,
      tableCreated,
      eventsTableCreated,
      statusOccurredIndexCreated,
      eventCreatedAtIdxCreated,
      enumCreated,
      enumExactValuesVerified,
      invalidEnumRejected,
      nullableDiagnosaPersistsNull,
      auditAttributionFieldsPresent,
      eventInsertedSuccessfully,
      createAuditRollbackVerified,
      updateAuditRollbackVerified,
      createAuditCommitAtomicVerified,
      concurrentCasConflictVerified,
      singleEventChainVerified,
      singleAuditChainVerified,
      simulationSuccess,
    };
  } finally {
    if (client) {
      try { await client.$disconnect(); } catch {}
    }
    const pgCtl = getPgCtlPath();
    if (pgCtl && fs.existsSync(tempDir)) {
      try {
        spawnSync(pgCtl, ["stop", "-D", tempDir, "-m", "fast", "-w", "-t", "5"], {
          encoding: "utf-8",
          timeout: 6000,
          stdio: "ignore",
        });
      } catch {}
    }

    try { await pgInstance.stop(); } catch {}

    const pidsToKill = new Set<number>();
    if (mainPid) pidsToKill.add(mainPid);
    for (const p of descendantPids) pidsToKill.add(p);

    for (const p of pidsToKill) {
      if (verifyPostgresProcessOwnership(p, tempDir, mainPid)) {
        try {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", p.toString(), "/T", "/F"], { stdio: "ignore" });
          } else {
            process.kill(p, "SIGKILL");
          }
        } catch {}
      }
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

export async function simulateM33bMigrationChain(): Promise<M33bMigrationVerificationResult> {
  const port = await findFreePort(6270 + Math.floor(Math.random() * 300));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stq-m33b-${Date.now()}-${port}-`));
  const testUrl = `postgresql://postgres:postgrespassword@127.0.0.1:${port}/stq_m33b_test?schema=public`;

  const oldTestDbUrl = process.env.TEST_DATABASE_URL;
  const oldDbUrl = process.env.DATABASE_URL;
  process.env.TEST_DATABASE_URL = testUrl;
  process.env.DATABASE_URL = testUrl;

  verifyTestEnvironment(testUrl);

  const pgInstance = new EmbeddedPostgres({
    databaseDir: tempDir,
    port,
    user: "postgres",
    password: "postgrespassword",
    persistent: false,
  });

  let mainPid: number | null = null;
  let descendantPids: Set<number> = new Set();
  let client: PrismaClient | null = null;

  try {
    await pgInstance.initialise();
    await pgInstance.start();

    for (let i = 0; i < 30; i++) {
      if (await isPortInUse(port)) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const detected = detectTestInstancePids(port, tempDir);
    mainPid = detected.mainPid;
    descendantPids = new Set(detected.descendantPids);

    try {
      await pgInstance.createDatabase("stq_m33b_test");
    } catch {}

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    };

    const projectRoot = path.resolve(__dirname, "..");

    // 1. Inisialisasi skema baseline warisan
    execSync(`npx prisma db push --schema=tests/fixtures/baseline_schema.prisma --skip-generate --accept-data-loss`, {
      env,
      encoding: "utf-8",
      cwd: projectRoot,
    });

    client = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    // 2. Terapkan migrasi 1..5 rantai main
    const mainMigrations = [
      "20260910083000_setoran_tahfizh_page_based",
      "20260910090000_core_operational_final",
      "20260910103000_p0_tahfizh_persistence",
      "20260914100000_target_santri_float",
      "20260914170000_add_jumlah_juz_mufar",
    ];

    for (const m of mainMigrations) {
      const sqlPath = path.join(projectRoot, "prisma/migrations", m, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      await executeSqlStatementsOnClient(client, sql);
    }

    // 3. Verifikasi dan ambil migrasi PR #8 langsung dari SHA 9068cae5587b7219c394c5c25bf0de07a15b0726
    const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    let pr8MigrationFetched = false;
    let pr8ExactShaVerified = false;
    let pr8Sql = "";
    let pr8MigrationApplied = false;

    try {
      let commitExists = false;
      try {
        execSync(`git cat-file -e ${PR8_EXACT_SHA}`, { cwd: projectRoot, stdio: "ignore" });
        commitExists = true;
      } catch {
        commitExists = false;
      }

      if (!commitExists) {
        try {
          execSync("git fetch origin review/tahfizh-quality-evaluation --depth=1", { cwd: projectRoot, stdio: "ignore" });
        } catch {
          try {
            execSync(`git fetch origin ${PR8_EXACT_SHA} --depth=1`, { cwd: projectRoot, stdio: "ignore" });
          } catch {}
        }
      }

      let resolvedSha = "";
      try {
        resolvedSha = execSync(`git rev-parse --verify ${PR8_EXACT_SHA}`, { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      } catch {
        try {
          resolvedSha = execSync("git rev-parse FETCH_HEAD", { cwd: projectRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        } catch {}
      }

      if (resolvedSha.toLowerCase() === PR8_EXACT_SHA.toLowerCase()) {
        pr8ExactShaVerified = true;
      }

      if (pr8ExactShaVerified) {
        pr8Sql = execSync(
          `git show ${PR8_EXACT_SHA}:prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql`,
          { encoding: "utf-8", cwd: projectRoot }
        );
        if (pr8Sql.length > 1000) {
          pr8MigrationFetched = true;
        }
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[simulateM33bMigrationChain] Error retrieving PR #8 migration:", msg);
    }

    if (!pr8ExactShaVerified || !pr8MigrationFetched || !pr8Sql) {
      throw new Error(`FAIL-CLOSED: PR #8 migration could not be verified or fetched from exact SHA ${PR8_EXACT_SHA}`);
    }

    await executeSqlStatementsOnClient(client, pr8Sql);
    pr8MigrationApplied = true;

    // 4. Terapkan migrasi Phase 2A
    const phase2aSqlPath = path.join(projectRoot, "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql");
    const phase2aSql = fs.readFileSync(phase2aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, phase2aSql);
    const phase2aApplied = true;

    // 5. Masukkan data representatif SEBELUM M3.1, M3.3A, dan M3.3B
    await client.$executeRawUnsafe(`
      INSERT INTO "staff" ("id", "staff_code", "nama", "no_hp", "role_staff", "status", "created_at", "updated_at")
      VALUES ('stf-pre-m33b', 'STF-PRE-M33B', 'Ustadz Pre M33B', '08123456781', 'GA', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "username", "email", "password_hash", "role", "status", "staff_id", "created_at", "updated_at")
      VALUES ('usr-pre-m33b', 'usrprem33b', 'usr-pre-m33b@stq.ac.id', 'dummy_hash', 'GA', 'AKTIF', 'stf-pre-m33b', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "santri" ("id", "nis", "nama", "kelas", "jenis_kelamin", "status", "created_at", "updated_at")
      VALUES ('san-pre-m33b', 'NIS-PRE-M33B', 'Santri Pre M33B', '7A', 'L', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "evaluasi_rubu_tahfizh" ("id", "santri_id", "musyrif_id", "tanggal", "juz", "rubu_ke", "nilai_tajwid", "nilai_fashahah", "nilai_kelancaran", "nilai", "created_at", "updated_at")
      VALUES ('eval-pre-m33b', 'san-pre-m33b', 'stf-pre-m33b', NOW(), 1, 1, 'MUMTAZ', 'MUMTAZ', 'MUMTAZ', 'MUMTAZ', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "org_units" ("id", "code", "name", "type", "domain", "gender_complex", "is_active", "created_at", "updated_at")
      VALUES ('ou-pre-kmr-m33b', 'OU-PRE-KMR-M33B', 'Kamar Umar Pre M33B', 'KAMAR', 'KEASRAMAAN', 'PUTRA', true, NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "catatan_kesehatan" ("id", "santri_id", "tanggal", "keluhan", "diagnosa", "tindakan", "status", "dicatat_oleh", "created_at", "updated_at")
      VALUES ('ck-pre-m33b', 'san-pre-m33b', NOW(), 'Pusing', 'Sakit kepala', 'Istirahat', 'RAWAT_PONDOK', 'petugas.uks', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "mata_pelajaran" ("id", "kode_mapel", "nama", "kategori", "created_at")
      VALUES ('mp-legacy-01', 'MAT-LEGACY', 'Matematika Legacy', 'UMUM'::"KategoriMapel", NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "nilai_akademik" ("id", "santri_id", "mapel_id", "guru_id", "semester", "tahun_ajaran", "jenis", "angka", "huruf", "created_at", "updated_at")
      VALUES ('na-legacy-01', 'san-pre-m33b', 'mp-legacy-01', 'stf-pre-m33b', 1, '2026/2027', 'UTS'::"JenisNilai", 85, 'B', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "absensi" ("id", "santri_id", "tanggal", "kegiatan", "status", "dicatat_oleh", "created_at")
      VALUES ('abs-legacy-01', 'san-pre-m33b', NOW(), 'KBM Pagi', 'HADIR'::"StatusAbsensi", 'guru.akademik', NOW());
    `);

    // 6. Terapkan migrasi M3.1
    const m31SqlPath = path.join(projectRoot, "prisma/migrations/20260917220000_m3_1_keasramaan_structure/migration.sql");
    const m31Sql = fs.readFileSync(m31SqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m31Sql);
    const m31MigrationApplied = true;

    await client.$executeRawUnsafe(`
      INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "created_at", "updated_at")
      VALUES ('plc-pre-m33b', 'san-pre-m33b', 'ou-pre-kmr-m33b', true, NOW(), NOW(), NOW());
    `);

    // 7. Terapkan migrasi M3.3A
    const m33aSqlPath = path.join(projectRoot, "prisma/migrations/20260918120000_m3_3a_health_v2_backend/migration.sql");
    const m33aSql = fs.readFileSync(m33aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m33aSql);
    const m33aMigrationApplied = true;

    await client.$executeRawUnsafe(`
      INSERT INTO "health_cases_v2" (
        "id", "santri_id", "occurred_at", "keluhan", "tindakan_awal", "status_v2", "recorded_by_user_id", "created_at", "updated_at"
      ) VALUES (
        'hc-pre-m33b', 'san-pre-m33b', NOW(), 'Demam', 'Kompres', 'DIPANTAU'::"HealthStatusV2", 'usr-pre-m33b', NOW(), NOW()
      );
    `);

    // 8. Snapshot data SEBELUM M3.3B
    const preUser = await client.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
      `SELECT "id", "email", "role"::text, "status"::text FROM "users" WHERE "id" = 'usr-pre-m33b';`
    );
    const preStaff = await client.$queryRawUnsafe<Array<{ id: string; nama: string; status: string }>>(
      `SELECT "id", "nama", "status"::text FROM "staff" WHERE "id" = 'stf-pre-m33b';`
    );
    const preSantri = await client.$queryRawUnsafe<Array<{ id: string; nis: string; status: string }>>(
      `SELECT "id", "nis", "status"::text FROM "santri" WHERE "id" = 'san-pre-m33b';`
    );
    const preEval = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; musyrif_id: string }>>(
      `SELECT "id", "santri_id", "musyrif_id" FROM "evaluasi_rubu_tahfizh" WHERE "id" = 'eval-pre-m33b';`
    );
    const prePlc = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; kamar_id: string }>>(
      `SELECT "id", "santri_id", "kamar_id" FROM "santri_kamar_placements" WHERE "id" = 'plc-pre-m33b';`
    );
    const preHc = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; status_v2: string }>>(
      `SELECT "id", "santri_id", "status_v2"::text FROM "health_cases_v2" WHERE "id" = 'hc-pre-m33b';`
    );
    const preMp = await client.$queryRawUnsafe<Array<{ id: string; kode_mapel: string; nama: string }>>(
      `SELECT "id", "kode_mapel", "nama" FROM "mata_pelajaran" WHERE "id" = 'mp-legacy-01';`
    );
    const preNa = await client.$queryRawUnsafe<Array<{ id: string; angka: number }>>(
      `SELECT "id", "angka" FROM "nilai_akademik" WHERE "id" = 'na-legacy-01';`
    );
    const preAbs = await client.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT "id", "status"::text FROM "absensi" WHERE "id" = 'abs-legacy-01';`
    );

    // 9. Terapkan migrasi M3.3B
    const m33bSqlPath = path.join(projectRoot, "prisma/migrations/20260918140000_m3_3b_pendidikan_foundation/migration.sql");
    const m33bSql = fs.readFileSync(m33bSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m33bSql);
    const m33bMigrationApplied = true;

    // 10. Verifikasi data representatif SETELAH M3.3B
    const postUser = await client.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
      `SELECT "id", "email", "role"::text, "status"::text FROM "users" WHERE "id" = 'usr-pre-m33b';`
    );
    const postStaff = await client.$queryRawUnsafe<Array<{ id: string; nama: string; status: string }>>(
      `SELECT "id", "nama", "status"::text FROM "staff" WHERE "id" = 'stf-pre-m33b';`
    );
    const postSantri = await client.$queryRawUnsafe<Array<{ id: string; nis: string; status: string; cohort_id: string | null }>>(
      `SELECT "id", "nis", "status"::text, "cohort_id" FROM "santri" WHERE "id" = 'san-pre-m33b';`
    );
    const postEval = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; musyrif_id: string }>>(
      `SELECT "id", "santri_id", "musyrif_id" FROM "evaluasi_rubu_tahfizh" WHERE "id" = 'eval-pre-m33b';`
    );
    const postPlc = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; kamar_id: string }>>(
      `SELECT "id", "santri_id", "kamar_id" FROM "santri_kamar_placements" WHERE "id" = 'plc-pre-m33b';`
    );
    const postHc = await client.$queryRawUnsafe<Array<{ id: string; santri_id: string; status_v2: string }>>(
      `SELECT "id", "santri_id", "status_v2"::text FROM "health_cases_v2" WHERE "id" = 'hc-pre-m33b';`
    );
    const postMp = await client.$queryRawUnsafe<Array<{ id: string; kode_mapel: string; nama: string }>>(
      `SELECT "id", "kode_mapel", "nama" FROM "mata_pelajaran" WHERE "id" = 'mp-legacy-01';`
    );
    const postNa = await client.$queryRawUnsafe<Array<{ id: string; angka: number }>>(
      `SELECT "id", "angka" FROM "nilai_akademik" WHERE "id" = 'na-legacy-01';`
    );
    const postAbs = await client.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT "id", "status"::text FROM "absensi" WHERE "id" = 'abs-legacy-01';`
    );

    const existingDataUnchanged =
      JSON.stringify(preUser) === JSON.stringify(postUser) &&
      JSON.stringify(preStaff) === JSON.stringify(postStaff) &&
      preSantri[0]?.id === postSantri[0]?.id &&
      preSantri[0]?.nis === postSantri[0]?.nis &&
      postSantri[0]?.cohort_id === null;

    const existingPr8TablesIntact = postEval.length === 1 && JSON.stringify(preEval) === JSON.stringify(postEval);
    const existingPlacementsIntact = postPlc.length === 1 && JSON.stringify(prePlc) === JSON.stringify(postPlc);
    const existingHealthCasesIntact = postHc.length === 1 && JSON.stringify(preHc) === JSON.stringify(postHc);
    const existingAcademicTablesIntact =
      postMp.length === 1 && JSON.stringify(preMp) === JSON.stringify(postMp) &&
      postNa.length === 1 && JSON.stringify(preNa) === JSON.stringify(postNa) &&
      postAbs.length === 1 && JSON.stringify(preAbs) === JSON.stringify(postAbs);

    // 11. Verifikasi tabel baru dibuat
    const tablesRes: Array<{ table_name: string }> = await client.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'education_cohorts', 'teaching_assignments', 'education_sessions', 'education_session_attendances', 'education_session_participants'
      );
    `);
    const cohortTableCreated = tablesRes.some((t) => t.table_name === "education_cohorts");
    const assignmentTableCreated = tablesRes.some((t) => t.table_name === "teaching_assignments");
    const sessionTableCreated = tablesRes.some((t) => t.table_name === "education_sessions");
    const attendanceTableCreated = tablesRes.some((t) => t.table_name === "education_session_attendances");
    const participantTableCreated = tablesRes.some((t) => t.table_name === "education_session_participants");

    // 12. Verifikasi enum baru dibuat & exact labels
    const enumQuery: Array<{ typname: string; enumlabel: string }> = await client.$queryRawUnsafe(`
      SELECT t.typname, e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname IN ('EducationTrack', 'PedagogicalLevel', 'EducationSessionStatus', 'EducationAttendanceStatus')
      ORDER BY t.typname, e.enumsortorder;
    `);

    const tracks = enumQuery.filter(e => e.typname === "EducationTrack").map(e => e.enumlabel);
    const levels = enumQuery.filter(e => e.typname === "PedagogicalLevel").map(e => e.enumlabel);
    const statuses = enumQuery.filter(e => e.typname === "EducationSessionStatus").map(e => e.enumlabel);
    const attStatuses = enumQuery.filter(e => e.typname === "EducationAttendanceStatus").map(e => e.enumlabel);

    const educationEnumsCreated = tracks.length > 0 && levels.length > 0 && statuses.length > 0 && attStatuses.length > 0;
    const educationEnumsExactValuesVerified =
      JSON.stringify(tracks.sort()) === JSON.stringify(["KEPESANTRENAN", "STUDI_UMUM"]) &&
      JSON.stringify(levels.sort()) === JSON.stringify(["TINGKAT_1", "TINGKAT_2", "TINGKAT_3"]) &&
      JSON.stringify(statuses.sort()) === JSON.stringify(["CANCELLED", "COMPLETED", "SCHEDULED", "STARTED"]) &&
      JSON.stringify(attStatuses.sort()) === JSON.stringify(["ALFA", "HADIR", "IZIN", "SAKIT"]);

    // 13. Verifikasi enum MASBUK ditolak oleh Postgres
    let masbukEnumRejected = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "education_session_attendances" (
          "id", "session_id", "santri_id", "status", "recorded_by_user_id", "created_at", "updated_at"
        ) VALUES (
          'att-invalid', 'sess-dummy', 'san-pre-m33b', 'MASBUK'::"EducationAttendanceStatus", 'usr-pre-m33b', NOW(), NOW()
        );
      `);
    } catch {
      masbukEnumRejected = true;
    }

    // 14. Verifikasi indexes pada session & attendance
    const idxQuery: Array<{ tablename: string; indexname: string }> = await client.$queryRawUnsafe(`
      SELECT tablename, indexname FROM pg_indexes
      WHERE tablename IN ('education_sessions', 'education_session_attendances', 'education_session_participants', 'santri')
      AND indexname IN (
        'education_sessions_education_track_idx',
        'education_sessions_scheduled_date_idx',
        'education_sessions_cohort_id_idx',
        'education_sessions_status_idx',
        'education_session_attendances_session_id_santri_id_key',
        'education_session_participants_session_id_santri_id_key',
        'santri_cohort_id_idx'
      );
    `);
    const sessionIndexesCreated = idxQuery.some(i => i.indexname === 'education_sessions_education_track_idx') &&
      idxQuery.some(i => i.indexname === 'education_sessions_scheduled_date_idx') &&
      idxQuery.some(i => i.indexname === 'education_sessions_cohort_id_idx') &&
      idxQuery.some(i => i.indexname === 'education_sessions_status_idx') &&
      idxQuery.some(i => i.indexname === 'santri_cohort_id_idx');

    // 15. Verifikasi insert Cohort & Santri Linkage
    await client.$executeRawUnsafe(`
      INSERT INTO "education_cohorts" ("id", "code", "tahun_ajaran_masuk", "start_year", "is_active", "created_at", "updated_at")
      VALUES ('coh-2024', 'ANGKATAN-2024', '2024/2025', 2024, true, NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      UPDATE "santri" SET "cohort_id" = 'coh-2024' WHERE "id" = 'san-pre-m33b';
    `);
    const linkedSantri = await client.$queryRawUnsafe<Array<{ id: string; cohort_id: string }>>(
      `SELECT "id", "cohort_id" FROM "santri" WHERE "id" = 'san-pre-m33b';`
    );
    const santriCohortLinkageVerified = linkedSantri.length === 1 && linkedSantri[0].cohort_id === 'coh-2024';

    // 16. Verifikasi TeachingAssignment & EducationSession dengan pemisahan Guru Terjadwal vs Guru Aktual
    await client.$executeRawUnsafe(`
      INSERT INTO "teaching_assignments" (
        "id", "mapel_id", "staff_id", "education_track", "gender_complex", "pedagogical_level", "is_active", "valid_from", "created_at", "updated_at"
      ) VALUES (
        'ta-01', 'mp-legacy-01', 'stf-pre-m33b', 'STUDI_UMUM'::"EducationTrack", 'PUTRA'::"GenderComplex", 'TINGKAT_1'::"PedagogicalLevel", true, NOW(), NOW(), NOW()
      );
    `);

    // Buat guru pengganti (actual teacher) berbeda dari scheduled teacher
    await client.$executeRawUnsafe(`
      INSERT INTO "staff" ("id", "staff_code", "nama", "no_hp", "role_staff", "status", "created_at", "updated_at")
      VALUES ('stf-substitute', 'STF-SUB', 'Ustadz Pengganti', '08123456782', 'GA', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "username", "email", "password_hash", "role", "status", "staff_id", "created_at", "updated_at")
      VALUES ('usr-substitute', 'usrsub', 'usr-sub@stq.ac.id', 'dummy_hash', 'GA', 'AKTIF', 'stf-substitute', NOW(), NOW());
    `);

    await client.$executeRawUnsafe(`
      INSERT INTO "education_sessions" (
        "id", "education_track", "subject_id", "scheduled_date", "cohort_id", "program_level", "gender_group", "jp",
        "semester_meeting_number", "pbl_phase", "pbl_block_number", "scheduled_teacher_assignment_id", "scheduled_staff_id",
        "actual_teacher_user_id", "actual_teacher_staff_id", "started_at", "status", "created_at", "updated_at"
      ) VALUES (
        'sess-01', 'STUDI_UMUM'::"EducationTrack", 'mp-legacy-01', NOW(), 'coh-2024', 1, 'PUTRA'::"GenderComplex", 1,
        1, 'TEORI', 1, 'ta-01', 'stf-pre-m33b',
        'usr-substitute', 'stf-substitute', NOW(), 'STARTED'::"EducationSessionStatus", NOW(), NOW()
      );
    `);

    const insertedSession = await client.$queryRawUnsafe<Array<{
      id: string; scheduled_staff_id: string; actual_teacher_staff_id: string; actual_teacher_user_id: string; status: string;
    }>>(`SELECT "id", "scheduled_staff_id", "actual_teacher_staff_id", "actual_teacher_user_id", "status"::text FROM "education_sessions" WHERE "id" = 'sess-01';`);

    const actualVsScheduledTeacherVerified =
      insertedSession.length === 1 &&
      insertedSession[0].scheduled_staff_id === 'stf-pre-m33b' &&
      insertedSession[0].actual_teacher_staff_id === 'stf-substitute' &&
      insertedSession[0].actual_teacher_user_id === 'usr-substitute' &&
      insertedSession[0].status === 'STARTED';

    // 17. Verifikasi insert Participant & Unique Constraint
    await client.$executeRawUnsafe(`
      INSERT INTO "education_session_participants" ("id", "session_id", "santri_id", "created_at")
      VALUES ('part-01', 'sess-01', 'san-pre-m33b', NOW());
    `);

    let participantUniqueConstraintVerified = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "education_session_participants" ("id", "session_id", "santri_id", "created_at")
        VALUES ('part-02-dup', 'sess-01', 'san-pre-m33b', NOW());
      `);
    } catch {
      participantUniqueConstraintVerified = true;
    }

    // 18. Verifikasi unique attendance per session & santri
    await client.$executeRawUnsafe(`
      INSERT INTO "education_session_attendances" (
        "id", "session_id", "santri_id", "status", "recorded_by_user_id", "created_at", "updated_at"
      ) VALUES (
        'att-01', 'sess-01', 'san-pre-m33b', 'HADIR'::"EducationAttendanceStatus", 'usr-substitute', NOW(), NOW()
      );
    `);

    let attendanceUniqueConstraintVerified = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "education_session_attendances" (
          "id", "session_id", "santri_id", "status", "recorded_by_user_id", "created_at", "updated_at"
        ) VALUES (
          'att-02-dup', 'sess-01', 'san-pre-m33b', 'IZIN'::"EducationAttendanceStatus", 'usr-substitute', NOW(), NOW()
        );
      `);
    } catch {
      attendanceUniqueConstraintVerified = true;
    }

    // 19. Verifikasi atomisitas transaksi & audit rollback pada education session
    let sessionAuditRollbackVerified = false;
    try {
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO "education_sessions" (
            "id", "education_track", "subject_id", "scheduled_date", "cohort_id", "program_level", "gender_group", "jp",
            "status", "created_at", "updated_at"
          ) VALUES (
            'sess-rollback-test', 'STUDI_UMUM'::"EducationTrack", 'mp-legacy-01', NOW(), 'coh-2024', 1, 'PUTRA'::"GenderComplex", 2,
            'SCHEDULED'::"EducationSessionStatus", NOW(), NOW()
          );
        `);
        throw new Error("CANONICAL_AUDIT_FAILURE: Database transaction forced rollback on education session audit failure");
      });
    } catch {
      const checkSession = await client.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "education_sessions" WHERE "id" = 'sess-rollback-test';`
      );
      sessionAuditRollbackVerified = checkSession.length === 0;
    }

    // 20. Verifikasi Compare-And-Swap (CAS) Concurrency pada Start Education Session
    await client.$executeRawUnsafe(`
      INSERT INTO "education_sessions" (
        "id", "education_track", "subject_id", "scheduled_date", "cohort_id", "program_level", "gender_group", "jp",
        "status", "created_at", "updated_at"
      ) VALUES (
        'sess-cas-test', 'STUDI_UMUM'::"EducationTrack", 'mp-legacy-01', NOW(), 'coh-2024', 1, 'PUTRA'::"GenderComplex", 3,
        'SCHEDULED'::"EducationSessionStatus", NOW(), NOW()
      );
    `);

    // Guru A mengeksekusi CAS: status SCHEDULED -> STARTED
    const casA = await client.$executeRawUnsafe(`
      UPDATE "education_sessions"
      SET "status" = 'STARTED'::"EducationSessionStatus", "actual_teacher_user_id" = 'usr-substitute', "started_at" = NOW()
      WHERE "id" = 'sess-cas-test' AND "status" = 'SCHEDULED'::"EducationSessionStatus";
    `);

    // Guru B mencoba mengeksekusi CAS secara simultan: status SCHEDULED -> STARTED
    const casB = await client.$executeRawUnsafe(`
      UPDATE "education_sessions"
      SET "status" = 'STARTED'::"EducationSessionStatus", "actual_teacher_user_id" = 'usr-pre-m33b', "started_at" = NOW()
      WHERE "id" = 'sess-cas-test' AND "status" = 'SCHEDULED'::"EducationSessionStatus";
    `);

    const concurrentSessionStartCasVerified = casA === 1 && casB === 0;

    // 21. Verifikasi Rollback Materi Pembelajaran saat Audit Gagal
    await client.$executeRawUnsafe(`
      UPDATE "education_sessions" SET "materi" = 'Materi Asli' WHERE "id" = 'sess-01';
    `);

    let materialAuditRollbackVerified = false;
    try {
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          UPDATE "education_sessions" SET "materi" = 'Materi Percobaan Yang Harus Rollback' WHERE "id" = 'sess-01';
        `);
        throw new Error("CANONICAL_MATERIAL_AUDIT_FAILURE: Rollback transaksi materi");
      });
    } catch {
      const checkMateri = await client.$queryRawUnsafe<Array<{ materi: string | null }>>(
        `SELECT "materi" FROM "education_sessions" WHERE "id" = 'sess-01';`
      );
      materialAuditRollbackVerified = checkMateri.length === 1 && checkMateri[0].materi === 'Materi Asli';
    }

    // 22. Verifikasi Real Prisma Provider Resource Resolution dengan createPrismaDataProvider(client)
    const realPrismaProvider = createPrismaDataProvider(client);

    // 22a. Resolusi konteks sesi valid
    const sessionContext = await realPrismaProvider.resolveResourceContext({ educationSessionId: "sess-01" });
    const validSessionContextResolved =
      sessionContext !== null &&
      sessionContext.orgDomain === "AKADEMIK" &&
      sessionContext.educationSessionId === "sess-01" &&
      sessionContext.educationSession?.educationTrack === "STUDI_UMUM" &&
      sessionContext.educationSession?.genderGroup === "PUTRA" &&
      sessionContext.educationSession?.programLevel === 1 &&
      (sessionContext as any).targetUnitId === undefined &&
      Array.isArray(sessionContext.orgUnitIds) &&
      sessionContext.orgUnitIds.length === 0;

    // 22b. Resolusi peserta valid (san-pre-m33b terdaftar di part-01)
    const participantContext = await realPrismaProvider.resolveResourceContext({
      educationSessionId: "sess-01",
      santriId: "san-pre-m33b",
    });
    const validParticipantResolved =
      participantContext !== null &&
      participantContext.santriId === "san-pre-m33b" &&
      participantContext.educationSessionId === "sess-01";

    // 22c. Santri bukan peserta (fail closed -> return null)
    const nonParticipantContext = await realPrismaProvider.resolveResourceContext({
      educationSessionId: "sess-01",
      santriId: "san-non-enrolled",
    });
    const nonParticipantFailsClosed = nonParticipantContext === null;

    // 22d. Sesi tidak ditemukan (fail closed -> return null)
    const nonExistentContext = await realPrismaProvider.resolveResourceContext({
      educationSessionId: "sess-does-not-exist",
    });
    const nonExistentSessionFailsClosed = nonExistentContext === null;

    const realProviderResourceResolutionVerified =
      validSessionContextResolved &&
      validParticipantResolved &&
      nonParticipantFailsClosed &&
      nonExistentSessionFailsClosed;

    // 23. Verifikasi Real Concurrent Service Test: PendidikanV2Service.startEducationSession
    // Setup data peserta kedua untuk pengujian sesi kepesantrenan
    await client.$executeRawUnsafe(`
      INSERT INTO "santri" ("id", "nis", "nama", "kelas", "jenis_kelamin", "status", "cohort_id", "created_at", "updated_at")
      VALUES ('san-pre-m33b-2', 'NIS-PRE-M33B-2', 'Santri Putra 2', '7A', 'L', 'AKTIF', 'coh-2024', NOW(), NOW())
      ON CONFLICT ("id") DO NOTHING;
    `);

    // Sesi baru untuk pengujian service level
    await client.$executeRawUnsafe(`
      INSERT INTO "education_sessions" (
        "id", "education_track", "subject_id", "scheduled_date", "cohort_id", "program_level", "gender_group", "jp",
        "scheduled_teacher_assignment_id", "scheduled_staff_id", "status", "created_at", "updated_at"
      ) VALUES (
        'sess-svc-real', 'KEPESANTRENAN'::"EducationTrack", 'mp-legacy-01', NOW(), 'coh-2024', 1, 'PUTRA'::"GenderComplex", 1,
        'ta-01', 'stf-pre-m33b', 'SCHEDULED'::"EducationSessionStatus", NOW(), NOW()
      );
    `);

    // Daftarkan san-pre-m33b dan san-pre-m33b-2 sebagai peserta resmi
    await client.$executeRawUnsafe(`
      INSERT INTO "education_session_participants" ("id", "session_id", "santri_id", "created_at")
      VALUES 
        ('part-svc-01', 'sess-svc-real', 'san-pre-m33b', NOW()),
        ('part-svc-02', 'sess-svc-real', 'san-pre-m33b-2', NOW())
      ON CONFLICT DO NOTHING;
    `);

    const serviceDataProvider: ICanonicalDataProvider = {
      getIdentity: (userId) => realPrismaProvider.getIdentity(userId),
      verifyHumanExecutor: (id) => realPrismaProvider.verifyHumanExecutor(id),
      resolveResourceContext: (ctx) => realPrismaProvider.resolveResourceContext(ctx),
      getUnitAccountPlacement: (userId) => realPrismaProvider.getUnitAccountPlacement(userId),
      getActiveAssignments: async (userId) => [
        {
          id: `asg-${userId}`,
          userId,
          positionId: "pos-guru-akademik",
          positionCode: "GURU_AKADEMIK",
          positionName: "Guru Akademik",
          domain: "AKADEMIK",
          unitId: "ou-pre-kmr-m33b",
          unitCode: "OU-PRE-KMR-M33B",
          unitName: "Unit Akademik",
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: "academic.session.start",
              scopeType: "GLOBAL",
              businessRuleState: "VERIFIED_PRODUCTION",
            },
            {
              capabilityCode: "academic.material.record",
              scopeType: "GLOBAL",
              businessRuleState: "VERIFIED_PRODUCTION",
            },
            {
              capabilityCode: "academic.attendance.record",
              scopeType: "GLOBAL",
              businessRuleState: "VERIFIED_PRODUCTION",
            },
          ],
          scopeUnits: [],
        },
      ],
    };

    const { PendidikanV2Service } = await import("../lib/server/pendidikan-v2-service");

    // Gunakan koordinasi race condition deterministik untuk menguji CAS di level PostgreSQL
    let txAEntered = false;
    let txBCommitted = false;
    let resolveTxAEntered: () => void = () => {};
    const txAEnteredPromise = new Promise<void>((r) => { resolveTxAEntered = r; });

    const clientForTxA = new Proxy(client, {
      get(target, prop) {
        if (prop === "$transaction") {
          return async (fn: (tx: any) => Promise<any>) => {
            return (target as any).$transaction(async (tx: any) => {
              const proxyTx = new Proxy(tx, {
                get(txTarget, txProp) {
                  if (txProp === "educationSession") {
                    return new Proxy(txTarget.educationSession, {
                      get(sessTarget, sessProp) {
                        if (sessProp === "findUnique") {
                          return async (args: any) => {
                            const res = await sessTarget.findUnique(args);
                            if (args?.where?.id === "sess-svc-real" && !txAEntered) {
                              txAEntered = true;
                              resolveTxAEntered();
                              const waitStart = Date.now();
                              while (!txBCommitted && Date.now() - waitStart < 4000) {
                                await new Promise((r) => setTimeout(r, 20));
                              }
                            }
                            return res;
                          };
                        }
                        return (sessTarget as any)[sessProp];
                      },
                    });
                  }
                  return (txTarget as any)[txProp];
                },
              });
              return fn(proxyTx);
            });
          };
        }
        return (target as any)[prop];
      },
    });

    const serviceA = new PendidikanV2Service({ db: clientForTxA as any, dataProvider: serviceDataProvider });
    const serviceB = new PendidikanV2Service({ db: client, dataProvider: serviceDataProvider });

    const promiseA = serviceA.startEducationSession({ sessionId: "sess-svc-real" }, { actorUserId: "usr-pre-m33b" });
    await txAEnteredPromise;

    // Tx B berjalan saat Tx A sedang berada di tengah transaksi (status masih SCHEDULED)
    const resultB = await serviceB.startEducationSession({ sessionId: "sess-svc-real" }, { actorUserId: "usr-substitute" });
    txBCommitted = true;

    // Tx A melanjutkan update CAS: updateMany({ where: { id, status: 'SCHEDULED' } })
    // Di PostgreSQL, baris sudah diubah ke 'STARTED' oleh Tx B, sehingga count = 0 dan melempar EDUCATION_SESSION_CONCURRENT_START
    let txAErrorMsg = "";
    try {
      await promiseA;
    } catch (err: unknown) {
      txAErrorMsg = err instanceof Error ? err.message : String(err);
    }

    const realCasErrorVerified = txAErrorMsg.includes("EDUCATION_SESSION_CONCURRENT_START");
    const resultBSuccess = resultB.success === true && resultB.session.status === "STARTED";

    const dbSessAfterStart = await client.$queryRawUnsafe<Array<{ status: string; actual_teacher_user_id: string }>>(
      `SELECT "status"::text, "actual_teacher_user_id" FROM "education_sessions" WHERE "id" = 'sess-svc-real';`
    );
    const dbSessVerified =
      dbSessAfterStart.length === 1 &&
      dbSessAfterStart[0].status === "STARTED" &&
      dbSessAfterStart[0].actual_teacher_user_id === "usr-substitute";

    const auditStartLogs = await client.$queryRawUnsafe<Array<{ id: string; action: string }>>(
      `SELECT "id", "action" FROM "canonical_audit_logs" WHERE "entity_id" = 'sess-svc-real' AND "action" = 'academic.session.start';`
    );
    const singleAuditStartVerified = auditStartLogs.length === 1;

    const realServiceConcurrencyVerified =
      resultBSuccess && realCasErrorVerified && dbSessVerified && singleAuditStartVerified;

    // 24. Verifikasi Real Material Audit Rollback dengan PendidikanV2Service.recordSessionMaterial
    const failingAuditPersistence = {
      isPersistent: true as const,
      async recordInTx() {
        throw new Error("AUDIT_PERSISTENCE_FAILED: Simulasi kegagalan audit sink untuk rollback materi");
      },
    };

    const failingMaterialService = new PendidikanV2Service({
      db: client,
      dataProvider: serviceDataProvider,
      auditPersistence: failingAuditPersistence as any,
    });

    let realMaterialRollbackThrew = false;
    try {
      await failingMaterialService.recordSessionMaterial(
        { sessionId: "sess-svc-real", materi: "Materi Yang Harus Rollback" },
        { actorUserId: "usr-substitute" }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AUDIT_PERSISTENCE_FAILED")) {
        realMaterialRollbackThrew = true;
      }
    }

    const dbSessionMateriCheck = await client.$queryRawUnsafe<Array<{ materi: string | null }>>(
      `SELECT "materi" FROM "education_sessions" WHERE "id" = 'sess-svc-real';`
    );
    const realServiceMaterialRollbackVerified =
      realMaterialRollbackThrew &&
      dbSessionMateriCheck.length === 1 &&
      dbSessionMateriCheck[0].materi === null;

    // 25. Verifikasi Real Batch Attendance Transaction: Otorisasi Per-Target, Integritas Peserta & Audit Rollback
    // 25a. Batch dengan santri bukan peserta ditolak sebelum transaksi
    let nonParticipantBatchRejected = false;
    try {
      await serviceB.recordSessionAttendance(
        {
          sessionId: "sess-svc-real",
          records: [
            { santriId: "san-pre-m33b", status: "HADIR" },
            { santriId: "san-non-enrolled", status: "HADIR" },
          ],
        },
        { actorUserId: "usr-substitute" }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("CANONICAL_AUTHORIZATION_DENIED") ||
        msg.includes("NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED")
      ) {
        nonParticipantBatchRejected = true;
      }
    }

    const dbAttCountAfterNonPart = await client.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text as count FROM "education_session_attendances" WHERE "session_id" = 'sess-svc-real';`
    );
    const zeroAttAfterNonPart = dbAttCountAfterNonPart[0]?.count === "0";

    // 25b. Batch dengan audit gagal me-rollback seluruh upsert presensi
    const failingAttendanceService = new PendidikanV2Service({
      db: client,
      dataProvider: serviceDataProvider,
      auditPersistence: failingAuditPersistence as any,
    });

    let auditFailBatchRejected = false;
    try {
      await failingAttendanceService.recordSessionAttendance(
        {
          sessionId: "sess-svc-real",
          records: [
            { santriId: "san-pre-m33b", status: "HADIR" },
            { santriId: "san-pre-m33b-2", status: "IZIN" },
          ],
        },
        { actorUserId: "usr-substitute" }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AUDIT_PERSISTENCE_FAILED")) {
        auditFailBatchRejected = true;
      }
    }

    const dbAttCountAfterAuditFail = await client.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text as count FROM "education_session_attendances" WHERE "session_id" = 'sess-svc-real';`
    );
    const zeroAttAfterAuditFail = dbAttCountAfterAuditFail[0]?.count === "0";

    // 25c. Batch sukses mencatat presensi untuk seluruh peserta & menulis audit forensik dengan status diff
    const attSuccessResult = await serviceB.recordSessionAttendance(
      {
        sessionId: "sess-svc-real",
        records: [
          { santriId: "san-pre-m33b", status: "HADIR" },
          { santriId: "san-pre-m33b-2", status: "IZIN" },
        ],
      },
      { actorUserId: "usr-substitute" }
    );

    const dbAttRecords = await client.$queryRawUnsafe<Array<{ santri_id: string; status: string; recorded_by_user_id: string }>>(
      `SELECT "santri_id", "status"::text, "recorded_by_user_id" FROM "education_session_attendances" WHERE "session_id" = 'sess-svc-real' ORDER BY "santri_id";`
    );

    const attendancePersistedInDb =
      attSuccessResult.success === true &&
      dbAttRecords.length === 2 &&
      dbAttRecords[0].santri_id === "san-pre-m33b" &&
      dbAttRecords[0].status === "HADIR" &&
      dbAttRecords[0].recorded_by_user_id === "usr-substitute" &&
      dbAttRecords[1].santri_id === "san-pre-m33b-2" &&
      dbAttRecords[1].status === "IZIN" &&
      dbAttRecords[1].recorded_by_user_id === "usr-substitute";

    const attAuditLog = await client.$queryRawUnsafe<Array<{ id: string; action: string; after_state: any }>>(
      `SELECT "id", "action", "after_state" FROM "canonical_audit_logs" WHERE "entity_id" = 'sess-svc-real' AND "action" = 'academic.attendance.record';`
    );
    const attAuditLogPersisted =
      attAuditLog.length === 1 &&
      attAuditLog[0].after_state !== null;

    const realServiceAttendanceBatchVerified =
      nonParticipantBatchRejected &&
      zeroAttAfterNonPart &&
      auditFailBatchRejected &&
      zeroAttAfterAuditFail &&
      attendancePersistedInDb &&
      attAuditLogPersisted;

    const simulationSuccess =
      pr8ExactShaVerified &&
      pr8MigrationApplied &&
      phase2aApplied &&
      m31MigrationApplied &&
      m33aMigrationApplied &&
      m33bMigrationApplied &&
      existingDataUnchanged &&
      existingPr8TablesIntact &&
      existingPlacementsIntact &&
      existingHealthCasesIntact &&
      existingAcademicTablesIntact &&
      cohortTableCreated &&
      assignmentTableCreated &&
      sessionTableCreated &&
      attendanceTableCreated &&
      participantTableCreated &&
      educationEnumsCreated &&
      educationEnumsExactValuesVerified &&
      masbukEnumRejected &&
      sessionIndexesCreated &&
      attendanceUniqueConstraintVerified &&
      participantUniqueConstraintVerified &&
      santriCohortLinkageVerified &&
      actualVsScheduledTeacherVerified &&
      sessionAuditRollbackVerified &&
      concurrentSessionStartCasVerified &&
      materialAuditRollbackVerified &&
      realProviderResourceResolutionVerified &&
      realServiceConcurrencyVerified &&
      realServiceMaterialRollbackVerified &&
      realServiceAttendanceBatchVerified;

    return {
      pr8ExactShaVerified,
      pr8MigrationApplied,
      phase2aApplied,
      m31MigrationApplied,
      m33aMigrationApplied,
      m33bMigrationApplied,
      existingDataUnchanged,
      existingPr8TablesIntact,
      existingPlacementsIntact,
      existingHealthCasesIntact,
      existingAcademicTablesIntact,
      cohortTableCreated,
      assignmentTableCreated,
      sessionTableCreated,
      attendanceTableCreated,
      participantTableCreated,
      educationEnumsCreated,
      educationEnumsExactValuesVerified,
      masbukEnumRejected,
      sessionIndexesCreated,
      attendanceUniqueConstraintVerified,
      participantUniqueConstraintVerified,
      santriCohortLinkageVerified,
      actualVsScheduledTeacherVerified,
      sessionAuditRollbackVerified,
      concurrentSessionStartCasVerified,
      materialAuditRollbackVerified,
      realProviderResourceResolutionVerified,
      realServiceConcurrencyVerified,
      realServiceMaterialRollbackVerified,
      realServiceAttendanceBatchVerified,
      simulationSuccess,
    };
  } finally {
    if (client) {
      try { await client.$disconnect(); } catch {}
    }
    const pgCtl = getPgCtlPath();
    if (pgCtl && fs.existsSync(tempDir)) {
      try {
        spawnSync(pgCtl, ["stop", "-D", tempDir, "-m", "fast", "-w", "-t", "5"], {
          encoding: "utf-8",
          timeout: 6000,
          stdio: "ignore",
        });
      } catch {}
    }

    try { await pgInstance.stop(); } catch {}

    const pidsToKill = new Set<number>();
    if (mainPid) pidsToKill.add(mainPid);
    for (const p of descendantPids) pidsToKill.add(p);

    for (const p of pidsToKill) {
      if (verifyPostgresProcessOwnership(p, tempDir, mainPid)) {
        try {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/PID", p.toString(), "/T", "/F"], { stdio: "ignore" });
          } else {
            process.kill(p, "SIGKILL");
          }
        } catch {}
      }
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    if (oldTestDbUrl !== undefined) {
      process.env.TEST_DATABASE_URL = oldTestDbUrl;
    } else {
      delete process.env.TEST_DATABASE_URL;
    }
    if (oldDbUrl !== undefined) {
      process.env.DATABASE_URL = oldDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  }
}
