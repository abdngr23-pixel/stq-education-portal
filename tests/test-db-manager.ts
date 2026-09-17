import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";

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
  migrationApplied: boolean;
  tableCreated: boolean;
  uniqueActiveConstraintEnforced: boolean;
  historyPreserved: boolean;
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

    // 3. Terapkan migrasi Phase 2A
    const phase2aSqlPath = path.join(projectRoot, "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql");
    const phase2aSql = fs.readFileSync(phase2aSqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, phase2aSql);

    // 4. Terapkan migrasi M3.1
    const m31SqlPath = path.join(projectRoot, "prisma/migrations/20260917220000_m3_1_keasramaan_structure/migration.sql");
    const m31Sql = fs.readFileSync(m31SqlPath, "utf-8");
    await executeSqlStatementsOnClient(client, m31Sql);

    // 5. Verifikasi bahwa tabel santri_kamar_placements ada
    const tablesRes: Array<{ table_name: string }> = await client.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'santri_kamar_placements';
    `);
    const tableCreated = tablesRes.length === 1;

    // 6. Uji kendala data: masukkan santri uji dan kamar uji
    await client.$executeRawUnsafe(`
      INSERT INTO "santri" ("id", "nis", "nama", "kelas", "jenis_kelamin", "status", "created_at", "updated_at")
      VALUES ('san-test-m31', 'NIS-M31-001', 'Santri M31 Test', '7A', 'L', 'AKTIF', NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "org_units" ("id", "code", "name", "type", "domain", "gender_complex", "is_active", "created_at", "updated_at")
      VALUES ('kmr-test-m31', 'OU-KMR-M31', 'Kamar Ali M31', 'KAMAR', 'KEASRAMAAN', 'PUTRA', true, NOW(), NOW());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "org_units" ("id", "code", "name", "type", "domain", "gender_complex", "is_active", "created_at", "updated_at")
      VALUES ('kmr-test-m31-2', 'OU-KMR-M31-2', 'Kamar Utsman M31', 'KAMAR', 'KEASRAMAAN', 'PUTRA', true, NOW(), NOW());
    `);

    // Masukkan 1 active placement
    await client.$executeRawUnsafe(`
      INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "created_at", "updated_at")
      VALUES ('plc-01', 'san-test-m31', 'kmr-test-m31', true, NOW(), NOW(), NOW());
    `);

    // Coba masukkan active placement kedua untuk santri yang sama -> harus gagal karena unique constraint
    let uniqueActiveConstraintEnforced = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "created_at", "updated_at")
        VALUES ('plc-02', 'san-test-m31', 'kmr-test-m31-2', true, NOW(), NOW(), NOW());
      `);
    } catch {
      uniqueActiveConstraintEnforced = true;
    }

    // Masukkan inactive historical placement untuk santri yang sama -> harus berhasil
    let historyPreserved = false;
    try {
      await client.$executeRawUnsafe(`
        INSERT INTO "santri_kamar_placements" ("id", "santri_id", "kamar_id", "is_active", "start_date", "end_date", "created_at", "updated_at")
        VALUES ('plc-03', 'san-test-m31', 'kmr-test-m31-2', false, NOW() - INTERVAL '30 days', NOW(), NOW(), NOW());
      `);
      historyPreserved = true;
    } catch {}

    return {
      migrationApplied: true,
      tableCreated,
      uniqueActiveConstraintEnforced,
      historyPreserved,
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


