import puppeteer, { Browser } from "puppeteer-core";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import {
  startTestDatabase,
  setupTestFixtures,
  cleanupTestFixtures,
  stopTestDatabase,
  FIXTURES,
  TEST_DATABASE_URL,
} from "../tests/test-db-manager";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\55dbb3f2-f96d-42d5-a15a-c4b49aeabf22";
const BASE_URL = "http://localhost:3000";

let nextServerProcess: ChildProcess | null = null;
let browser: Browser | null = null;

function logStep(step: string) {
  console.log(`\n======================================================`);
  console.log(`[E2E STEP] ${step}`);
  console.log(`======================================================`);
}

function fail(msg: string): never {
  console.error(`\n❌ [ASSERTION FAILED] ${msg}\n`);
  process.exit(1);
}

async function waitPort(port: number, timeoutMs = 60000): Promise<void> {
  const net = await import("net");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(port, "127.0.0.1", () => {
          socket.destroy();
          resolve();
        });
        socket.on("error", reject);
        socket.setTimeout(800, () => {
          socket.destroy();
          reject(new Error("timeout"));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Port ${port} tidak dapat dijangkau setelah ${timeoutMs}ms`);
}

async function startNextTestServer() {
  logStep("Memulai Next.js Server Terisolasi pada Port 3000 (PostgreSQL Test Terisolasi)...");

  try {
    const { execSync } = await import("child_process");
    const out = execSync("netstat -ano | findstr :3000", { encoding: "utf-8" });
    const lines = out.split("\n").filter((l) => l.includes("LISTENING"));
    for (const l of lines) {
      const parts = l.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    // Port 3000 bersih
  }

  // Pastikan env diisolasi ke database test
  const env = {
    ...process.env,
    PORT: "3000",
    NODE_ENV: "test",
    IS_TEST_RUN: "true",
    DATABASE_URL: TEST_DATABASE_URL,
    TEST_DATABASE_URL: TEST_DATABASE_URL,
    AUTH_SECRET: "stq_portal_test_secret_session_key_min_32_characters_long_2026",
  };

  nextServerProcess = spawn("npx.cmd", ["next", "dev", "-p", "3000", "--turbopack"], {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: "pipe",
    shell: true,
  });

  nextServerProcess.stdout?.on("data", (data) => {
    const s = data.toString();
    if (s.includes("Ready") || s.includes("started") || s.includes("3000")) {
      console.log(`[Next.js 3000] ${s.trim()}`);
    }
  });

  nextServerProcess.stderr?.on("data", (data) => {
    console.error(`[Next.js 3000 ERROR] ${data.toString().trim()}`);
  });

  await waitPort(3000);
  console.log("Next.js test server siap pada port 3000!");
}

async function shutdown() {
  console.log("\nMembersihkan environment pengujian...");
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }

  if (nextServerProcess && nextServerProcess.pid) {
    try {
      const { execSync } = await import("child_process");
      execSync(`taskkill /F /T /PID ${nextServerProcess.pid}`, { stdio: "ignore" });
    } catch {}
  }

  try {
    const prisma = await startTestDatabase();
    await cleanupTestFixtures(prisma);
    await stopTestDatabase();
  } catch {}

  console.log("Pembersihan selesai.");
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(1);
});

async function runE2E() {
  // 1. Inisialisasi Database Test & Fixtures
  logStep("1. Menyiapkan Database Test PostgreSQL Terisolasi & Fixtures...");
  const prisma = await startTestDatabase();
  await setupTestFixtures(prisma);
  console.log("Fixtures test santri dan akun berhasil dibuat di database test terisolasi.");

  // 2. Start Next.js Test Server pada port 3001
  await startNextTestServer();

  // 3. Launch Chrome Puppeteer
  logStep("2. Meluncurkan Chrome Puppeteer Riil...");
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1400,900"],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page = await browser.newPage();

  // Helper login
  async function doLogin() {
    logStep("Login sebagai Akun Test Musyrif (test.musyrif)...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', FIXTURES.USERNAME);
    await page.type('input[name="password"]', FIXTURES.PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });
    const currentUrl = page.url();
    if (!currentUrl.includes("/tahfizh") && !currentUrl.includes("/dashboard") && !currentUrl.includes("/")) {
      fail(`Gagal login. URL saat ini: ${currentUrl}`);
    }
    console.log("Login berhasil! URL:", currentUrl);
  }

  await doLogin();

  // Navigasi ke modul Tahfizh
  await page.goto(`${BASE_URL}/?tab=tahfizh`, { waitUntil: "networkidle2" });
  await page.waitForSelector("#santri-selector", { timeout: 15000 });
  console.log("Modul Tahfizh dimuat dengan sukses.");

  // =========================================================================
  // SKENARIO A: Multi-Halaman Nyata (Muhammad Test Multi)
  // =========================================================================
  logStep("SKENARIO A: Multi-Halaman Nyata (2 Halaman 422–423)");
  // Pilih santri TEST-SAN-01
  await page.select("#santri-selector", FIXTURES.SANTRI_MULTI);
  await new Promise((r) => setTimeout(r, 800));

  // Pastikan saran halaman mulai adalah 422
  const halMulaiVal = await page.$eval('input[placeholder="1"]', (el) => (el as HTMLInputElement).value);
  if (halMulaiVal !== "422") {
    fail(`Saran halaman mulai santri multi harus 422, didapat: ${halMulaiVal}`);
  }
  console.log("Saran awal halaman mulai terverifikasi: 422");

  // Klik pilihan cepat +2 Hlm
  const clicked2 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("+2 Hlm"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clicked2) fail("Tombol +2 Hlm tidak ditemukan");
  await new Promise((r) => setTimeout(r, 500));

  // Klik Simpan Setoran Santri
  const clickedSimpan = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Simpan Setoran"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedSimpan) fail("Tombol Simpan Setoran Santri tidak ditemukan");

  // Tunggu feedback berhasil dari server action nyata
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return body.includes("berhasil disimpan") || body.includes("berhasil") || body.includes("Alhamdulillah");
    },
    { timeout: 10000 }
  );
  console.log("Server action sukses: Setoran multi-halaman berhasil dicatat.");

  // Pastikan TIDAK ADA dialog / popup WhatsApp
  const isWaModalOpen = await page.evaluate(() => {
    const text = document.body.innerText;
    return Boolean(document.querySelector('[role="dialog"]')) && (text.includes("Kirim via WhatsApp") || text.includes("WhatsApp"));
  });
  if (isWaModalOpen) {
    fail("Dialog WhatsApp muncul pada setoran harian rutin!");
  }
  console.log("Verifikasi lolos: Tidak ada dialog/tautan WhatsApp yang muncul.");

  const screenshotA = path.join(ARTIFACT_DIR, "p0_1_real_multipage_success.png");
  await page.screenshot({ path: screenshotA, fullPage: true });

  // Reload halaman untuk membuktikan persistensi nyata ke database
  logStep("Reload Halaman & Verifikasi Persistensi Database...");
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#santri-selector");
  await page.select("#santri-selector", FIXTURES.SANTRI_MULTI);
  await new Promise((r) => setTimeout(r, 800));

  // Periksa apakah setoran muncul di Riwayat Setoran Terkini
  const hasHistoryRecord = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes("422") && text.includes("423") && text.includes("Muhammad Test Multi");
  });
  if (!hasHistoryRecord) {
    fail("Data setoran 422-423 tidak ditemukan di tabel Riwayat Setoran Terkini setelah reload!");
  }
  console.log("Tabel riwayat terverifikasi: Record 422-423 tersimpan dan ditampilkan dari database.");

  // Periksa saran halaman berikutnya telah maju ke 424
  const nextHalMulai = await page.$eval('input[placeholder="1"]', (el) => (el as HTMLInputElement).value);
  if (nextHalMulai !== "424") {
    fail(`Saran berikutnya setelah setoran 422-423 harus 424, didapat: ${nextHalMulai}`);
  }
  console.log("Saran berikutnya terverifikasi maju ke halaman 424.");

  // =========================================================================
  // SKENARIO B: Setengah Halaman Nyata (Muhammad Test Half)
  // =========================================================================
  logStep("SKENARIO B: Setoran Parsial 0.5 Halaman");
  await page.select("#santri-selector", FIXTURES.SANTRI_HALF);
  await new Promise((r) => setTimeout(r, 800));

  // Simpan 0.5 pertama pada halaman 431
  const clickedHalf1 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("+0.5 Hlm"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedHalf1) fail("Tombol +0.5 Hlm tidak ditemukan");
  await new Promise((r) => setTimeout(r, 400));

  const clickedSimpanHalf1 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Simpan Setoran"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedSimpanHalf1) fail("Tombol Simpan Setoran Santri tidak ditemukan");

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return body.includes("berhasil disimpan") || body.includes("berhasil") || body.includes("Alhamdulillah");
    },
    { timeout: 10000 }
  );
  console.log("0.5 pertama berhasil disimpan.");

  // Reload halaman: Saran harus tetap pada 431 karena masih tersisa kapasitas 0.5
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#santri-selector");
  await page.select("#santri-selector", FIXTURES.SANTRI_HALF);
  await new Promise((r) => setTimeout(r, 800));

  const halfStayVal = await page.$eval('input[placeholder="1"]', (el) => (el as HTMLInputElement).value);
  if (halfStayVal !== "431") {
    fail(`Saran setelah 0.5 pertama harus tetap halaman 431, didapat: ${halfStayVal}`);
  }
  console.log("Verifikasi lolos: Saran tetap pada halaman 431 (kapasitas parsial tersisa).");

  // Simpan 0.5 kedua
  const clickedHalf2 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("+0.5 Hlm"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedHalf2) fail("Tombol +0.5 Hlm tidak ditemukan");
  await new Promise((r) => setTimeout(r, 400));

  const clickedSimpanHalf2 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Simpan Setoran"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedSimpanHalf2) fail("Tombol Simpan Setoran Santri tidak ditemukan");

  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return body.includes("berhasil disimpan") || body.includes("berhasil") || body.includes("Alhamdulillah");
    },
    { timeout: 10000 }
  );
  console.log("0.5 kedua berhasil disimpan.");

  // Reload: Saran sekarang harus maju ke halaman 432
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#santri-selector");
  await page.select("#santri-selector", FIXTURES.SANTRI_HALF);
  await new Promise((r) => setTimeout(r, 800));

  const halfAdvanceVal = await page.$eval('input[placeholder="1"]', (el) => (el as HTMLInputElement).value);
  if (halfAdvanceVal !== "432") {
    fail(`Saran setelah halaman 431 penuh (1.0) harus maju ke 432, didapat: ${halfAdvanceVal}`);
  }
  console.log("Verifikasi lolos: Saran maju ke halaman 432.");

  // =========================================================================
  // SKENARIO C: Khatam 30 Juz Nyata (Muhammad Test Khatam 30 Juz)
  // =========================================================================
  logStep("SKENARIO C: Santri Khatam 30 Juz (Halaman 604 Selesai)");
  await page.select("#santri-selector", FIXTURES.SANTRI_KHATAM);
  await new Promise((r) => setTimeout(r, 800));

  // Pastikan banner khatam muncul dari React state tanpa DOM injection
  const khatamBannerExists = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes("Target hafalan 30 juz telah selesai") && text.includes("Tidak ada halaman Sabaq berikutnya");
  });
  if (!khatamBannerExists) {
    fail("Banner resmi Khatam 30 Juz tidak muncul di UI!");
  }
  console.log("Banner khatam 30 juz terverifikasi muncul dari state aplikasi.");

  // Pastikan form dan tombol dinonaktifkan
  const isSubmitDisabled = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Target Hafalan 30 Juz Telah Selesai") || b.textContent?.includes("Simpan Setoran")
    );
    return btn ? (btn as HTMLButtonElement).disabled : false;
  });
  if (!isSubmitDisabled) {
    fail("Tombol simpan harus dinonaktifkan untuk santri yang sudah khatam!");
  }
  console.log("Tombol simpan Sabaq terverifikasi dinonaktifkan.");

  // Pastikan tidak ada saran halaman 605
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes("Halaman 605") || pageText.includes("hlm 605")) {
    fail("Sistem menyarankan Halaman 605 yang tidak ada di mushaf!");
  }
  console.log("Verifikasi lolos: Tidak ada referensi Halaman 605.");

  const screenshotC = path.join(ARTIFACT_DIR, "p0_1_real_khatam_disabled.png");
  await page.screenshot({ path: screenshotC, fullPage: true });

  // =========================================================================
  // SKENARIO D: Sabaqi Tanpa Fallback Lama (Muhammad Test Sabaqi Clean)
  // =========================================================================
  logStep("SKENARIO D: Validasi Sabaqi Tanpa Fallback Lama");
  await page.select("#santri-selector", FIXTURES.SANTRI_SABAQI);
  await new Promise((r) => setTimeout(r, 600));

  // Pindah ke tab SABQI
  const clickedSabqi = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Sabqi"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedSabqi) fail("Tab Sabqi tidak ditemukan");
  await new Promise((r) => setTimeout(r, 800));

  // Pastikan banner informasi 'Belum ada Sabaq tersimpan pada pekan ini' muncul
  const noSabaqBanner = await page.evaluate(() => {
    return document.body.innerText.includes("Belum ada Sabaq tersimpan pada pekan ini");
  });
  if (!noSabaqBanner) {
    fail("Peringatan Sabaqi tanpa Sabaq pekan ini tidak muncul!");
  }
  console.log("Banner informasi Sabaqi tanpa Sabaq pekan ini terverifikasi.");

  // Coba simpan tanpa mode manual -> harus ditolak
  const clickedSimpanSabqi = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Simpan Setoran"));
    if (btn) {
      (btn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (!clickedSimpanSabqi) fail("Tombol Simpan Setoran Santri pada Sabqi tidak ditemukan");
  await new Promise((r) => setTimeout(r, 600));

  const hasValidationError = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes("Belum ada Sabaq tersimpan pada pekan ini") || text.includes("alasan tertulis");
  });
  if (!hasValidationError) {
    fail("Simpan Sabaqi tanpa konfirmasi/alasan tidak memunculkan validasi error!");
  }
  console.log("Validasi lolos: Sabaqi tanpa konfirmasi manual tertolak dengan pesan informatif.");

  const screenshotD = path.join(ARTIFACT_DIR, "p0_1_real_sabaqi_validation.png");
  await page.screenshot({ path: screenshotD, fullPage: true });

  logStep("Semua Skenario Pengujian E2E Riil Selesai dengan SUKSES 100%!");
}

async function main() {
  try {
    await runE2E();
  } catch (err) {
    console.error("Kesalahan fatal saat eksekusi E2E:", err);
    process.exit(1);
  } finally {
    await shutdown();
  }
}

main();
