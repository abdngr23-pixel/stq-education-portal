import puppeteer, { Browser, Page } from "puppeteer-core";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  startTestDatabase,
  setupTestFixtures,
  stopTestDatabase,
  findFreePort,
  FIXTURES,
} from "../tests/test-db-manager";

const CHROME_PATH =
  process.env.CHROME_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome");

const ARTIFACT_DIR =
  process.env.PILOT_SCREENSHOT_DIR ||
  process.env.ARTIFACT_DIR ||
  "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\0b9d2781-0b91-484c-8ef4-2ba29c411301";

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function waitForServerReady(url: string, timeoutMs = 45000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) {
        return true;
      }
    } catch {
      // Tunggu hingga server siap
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = { fullPage: true }) {
  const fullPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: options.fullPage });
  console.log(`📸 [Screenshot Saved] -> ${filename}`);
  return fullPath;
}

async function setInputValue(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector);
  await page.focus(selector);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
  await new Promise((r) => setTimeout(r, 100));
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "before";
  console.log(`\n===============================================================`);
  console.log(`MEMULAI PENANGKAPAN BUKTI VISUAL HYBRID DASHBOARD (MODE: ${mode.toUpperCase()})`);
  console.log(`===============================================================`);

  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";

  let browser: Browser | null = null;
  let nextServerProcess: ChildProcess | null = null;
  let testPrisma: PrismaClient | null = null;
  let testNextPort = 0;

  try {
    console.log("[1] Menyiapkan database PostgreSQL terisolasi...");
    testPrisma = await startTestDatabase();
    await setupTestFixtures(testPrisma);

    // Tambah 1 antrean ikhtibar aktif agar metrik ikhtibar dan tugas hari ini terlihat hidup
    await testPrisma.ikhtibarTahfizh.create({
      data: {
        id: "ikh-shot-1",
        santriId: FIXTURES.SANTRI_MULTI,
        juz: 21,
        status: "PENGAJUAN",
      },
    });

    if (mode === "after") {
      // Tambah 2 santri tambahan agar total santri halaqoh menjadi 7 (> 5)
      // sehingga tombol 'Lihat Semua (7)' aktif dan modal dapat diuji secara visual
      await testPrisma.santri.create({
        data: {
          id: "santri-test-extra-01",
          nis: "TEST-006",
          nama: "Hammam Fathurrahman",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: FIXTURES.HALAQOH_ID,
          modalHafalanAwalHalaman: 100,
          tanggalBaselineTahfizh: new Date("2026-09-08T00:00:00.000Z"),
          status: "AKTIF",
        },
      });

      await testPrisma.santri.create({
        data: {
          id: "santri-test-extra-02",
          nis: "TEST-007",
          nama: "Ibrahim Al-Ghazi",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: FIXTURES.HALAQOH_ID,
          modalHafalanAwalHalaman: 150,
          tanggalBaselineTahfizh: new Date("2026-09-08T00:00:00.000Z"),
          status: "AKTIF",
        },
      });
    }

    // Jalankan Next.js server test (production mode dari build terbaru)
    testNextPort = await findFreePort(3700);
    console.log(`[2] Menjalankan Next.js server di port ${testNextPort}...`);
    const serverEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(testNextPort),
      NODE_ENV: "production",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      AUTH_SECRET: "stq_portal_test_secret_session_key_min_32_characters_long_2026",
    };

    nextServerProcess = spawn("npx", ["next", "start", "-p", String(testNextPort)], {
      env: serverEnv,
      stdio: "pipe",
      shell: true,
      cwd: path.resolve(__dirname, ".."),
    });

    const isReady = await waitForServerReady(`http://localhost:${testNextPort}/login`, 45000);
    if (!isReady) throw new Error("Next.js server gagal merespons login dalam 45s.");
    console.log(`[Server Ready] http://localhost:${testNextPort}`);

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    const baseUrl = `http://localhost:${testNextPort}`;

    const performLogin = async () => {
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
      await page.waitForSelector('input[name="username"], input#username');
      await setInputValue(page, 'input[name="username"], input#username', FIXTURES.USERNAME);
      await setInputValue(page, 'input[name="password"], input#password', FIXTURES.PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="authenticated-app"]', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 600));
    };

    // 1. Desktop 1440x900
    console.log("\n[1/5] Mengambil screenshot Desktop 1440x900...");
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await performLogin();
    await page.waitForSelector('[data-testid="dashboard-musyrif-tahfizh"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    await capture(page, `${mode}_01_desktop_1440x900.png`);

    // 2. Mobile 390x844
    console.log("\n[2/5] Mengambil screenshot Mobile 390x844...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="dashboard-musyrif-tahfizh"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    await capture(page, `${mode}_02_mobile_390x844.png`);

    // 3. Mobile Kecil 360x800
    console.log("\n[3/5] Mengambil screenshot Mobile Kecil 360x800...");
    await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="dashboard-musyrif-tahfizh"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    await capture(page, `${mode}_03_mobile_360x800.png`);

    // 4. Daftar Santri Belum Setor (Desktop View)
    console.log("\n[4/5] Mengambil screenshot Seksi Santri Belum Setor...");
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="santri-belum-setor-list"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    await capture(page, `${mode}_04_santri_belum_setor.png`);

    // 4B. Jika mode 'after', cek tombol Lihat Semua dan buka Modal
    if (mode === "after") {
      const btnLihatSemua = await page.$('[data-testid="btn-lihat-semua-santri"]');
      if (btnLihatSemua) {
        console.log("\n[4B] Mengambil screenshot Modal Lihat Semua Santri...");
        await btnLihatSemua.click();
        await page.waitForSelector('[data-testid="modal-semua-santri"]', { timeout: 5000 });
        await new Promise((r) => setTimeout(r, 500));
        await capture(page, `${mode}_05_modal_lihat_semua.png`);

        // Tutup modal
        const closeBtn = await page.$('[data-testid="btn-close-modal-santri"]');
        if (closeBtn) await closeBtn.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // 5. Halaman Tahfizh setelah memilih satu santri
    console.log("\n[5/5] Mengambil screenshot Halaman Tahfizh (Santri Terpilih)...");
    const catatBtn = await page.waitForSelector(
      `[data-testid="btn-catat-setoran-santri-${FIXTURES.SANTRI_HALF}"]`,
      { timeout: 5000 }
    );
    if (catatBtn) {
      await catatBtn.click();
      await page.waitForSelector('[data-testid="tahfizh-module"]', { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 800));
      await capture(page, `${mode}_06_tahfizh_santri_selected.png`);
    }

    console.log(`\n✅ SELURUH SCREENSHOT MODE ${mode.toUpperCase()} BERHASIL DISIMPAN!`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (nextServerProcess) {
      if (process.platform === "win32" && nextServerProcess.pid) {
        spawn("taskkill", ["/PID", nextServerProcess.pid.toString(), "/T", "/F"]);
      } else {
        nextServerProcess.kill("SIGKILL");
      }
    }
    await stopTestDatabase().catch(() => {});
  }
}

main().catch((err) => {
  console.error("❌ Gagal mengambil screenshot:", err);
  process.exit(1);
});
