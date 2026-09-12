import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { execSync, spawnSync } from "child_process";
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
