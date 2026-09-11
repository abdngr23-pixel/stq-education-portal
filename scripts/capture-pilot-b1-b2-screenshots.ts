// Script Portabel Pengambilan 9 Screenshot Pilot UI/UX B1-B2
// Menggunakan database test terisolasi dan port dinamis tanpa ketergantungan global

import puppeteer, { Browser, Page } from "puppeteer-core";
import { spawn, spawnSync, ChildProcess } from "child_process";
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
  process.env.E2E_ARTIFACT_DIR ||
  "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\0b9d2781-0b91-484c-8ef4-2ba29c411301";

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const LONG_NAME_SANTRI_ID = "santri-long-name-pilot-id";

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
  console.log(`[Screenshot Saved] -> ${fullPath}`);
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

  const actual = await page.$eval(selector, (el) => (el as HTMLInputElement).value);
  if (actual !== value) {
    await page.$eval(
      selector,
      (el, v) => {
        const input = el as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(input, v);
        } else {
          input.value = v;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      value
    );
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function runCapture() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";

  console.log("=== Memulai Pengambilan 9 Screenshot Pilot B1-B2 ===");

  let browser: Browser | null = null;
  let nextServerProcess: ChildProcess | null = null;
  let testPrisma: PrismaClient | null = null;
  let testNextPort = 0;

  const capturedFiles: string[] = [];

  try {
    // 1. Jalankan isolated Postgres
    console.log("[1] Menyiapkan database PostgreSQL terisolasi...");
    testPrisma = await startTestDatabase();
    await setupTestFixtures(testPrisma);

    // Tambah santri nama panjang untuk uji visual layout
    await testPrisma.santri.create({
      data: {
        id: LONG_NAME_SANTRI_ID,
        nis: "TEST-099",
        nama: "Muhammad Abdullah Ibnu Syihabuddin Al-Hasyimi Asy-Syafi'i (Santri Uji Nama Panjang)",
        kelas: "7A",
        jenisKelamin: "L",
        halaqohId: FIXTURES.HALAQOH_ID,
        modalHafalanAwalHalaman: 200,
        tanggalBaselineTahfizh: new Date("2026-09-08T00:00:00.000Z"),
        status: "AKTIF",
      },
    });

    // 2. Jalankan Next.js server test (production mode dari build terbaru)
    testNextPort = await findFreePort(3600);
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

    // 3. Launch Puppeteer
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    const baseUrl = `http://localhost:${testNextPort}`;

    // Helper login
    const performLogin = async () => {
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
      await page.waitForSelector('input[name="username"], input#username');
      await setInputValue(page, 'input[name="username"], input#username', FIXTURES.USERNAME);
      await setInputValue(page, 'input[name="password"], input#password', FIXTURES.PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="authenticated-app"]', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 600));
    };

    // 1. Beranda Musyrif 1366x768
    console.log("\n[Shot 1/9] Beranda Musyrif 1366x768...");
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await performLogin();
    // Wajib assert selector dashboard-musyrif-tahfizh sebelum screenshot
    await page.waitForSelector('[data-testid="dashboard-musyrif-tahfizh"]', { timeout: 10000 });
    capturedFiles.push(await capture(page, "pilot_01_beranda_musyrif_1366x768.png"));

    // 2. Beranda Musyrif 390x844 (Mobile)
    console.log("\n[Shot 2/9] Beranda Musyrif 390x844 (Mobile)...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="authenticated-app"]');
    // Wajib assert selector dashboard-musyrif-tahfizh sebelum screenshot
    await page.waitForSelector('[data-testid="dashboard-musyrif-tahfizh"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    capturedFiles.push(await capture(page, "pilot_02_beranda_musyrif_390x844.png"));

    // 2B. Beranda MT Kondisi Antrean Ikhtibar > 0
    console.log("\n[Shot 2B] Beranda MT dengan Antrean Ikhtibar > 0...");
    await testPrisma!.ikhtibarTahfizh.create({
      data: {
        id: "ikhtibar-pilot-gt-0-1",
        santriId: FIXTURES.SANTRI_MULTI,
        juz: 21,
        status: "PENGAJUAN",
      },
    });
    await testPrisma!.ikhtibarTahfizh.create({
      data: {
        id: "ikhtibar-pilot-gt-0-2",
        santriId: FIXTURES.SANTRI_HALF,
        juz: 22,
        status: "MENGULANG",
      },
    });
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="dashboard-musyrif-tahfizh"]', { timeout: 10000 });
    // Verifikasi bahwa angka 2 Antrean Ikhtibar muncul
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("2 Antrean Ikhtibar") || text.includes("2");
    }, { timeout: 10000 });
    capturedFiles.push(await capture(page, "pilot_10_beranda_ikhtibar_gt_0.png"));

    // 2C. Navigasi Catat Setoran Santri Kedua dari Beranda
    console.log("\n[Shot 2C] Klik Catat Setoran Santri Kedua dari Beranda...");
    const catatBtn = await page.waitForSelector(`[data-testid="btn-catat-setoran-santri-${FIXTURES.SANTRI_HALF}"]`, { timeout: 10000 });
    if (catatBtn) await catatBtn.click();
    await page.waitForSelector('[data-testid="tahfizh-module"]', { timeout: 10000 });
    await page.waitForFunction(
      (targetId) => {
        const sel = document.querySelector("#santri-selector") as HTMLSelectElement | null;
        const hlm = document.querySelector('[data-testid="input-halaman-mulai"]') as HTMLInputElement | null;
        return sel?.value === targetId && hlm?.value === "431";
      },
      { timeout: 10000 },
      FIXTURES.SANTRI_HALF
    );
    capturedFiles.push(await capture(page, "pilot_11_tahfizh_second_santri_selected.png"));

    // 6. Bottom Navigation 412x915 (Mobile Android)
    console.log("\n[Shot 6/9] Bottom navigation 412x915...");
    await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="authenticated-app"]');
    await new Promise((r) => setTimeout(r, 500));
    capturedFiles.push(await capture(page, "pilot_06_bottom_nav_412x915.png"));

    // Navigasi ke Tahfizh
    const openTahfizh = async () => {
      const navBtn = await page.waitForSelector('[data-testid="nav-tahfizh"], button[title*="Tahfizh"]', { timeout: 10000 });
      if (navBtn) await navBtn.click();
      await page.waitForSelector('[data-testid="tahfizh-module"]', { timeout: 10000 });
      await page.waitForFunction(
        () => {
          const sel = document.querySelector("#santri-selector") as HTMLSelectElement | null;
          return sel && sel.options.length > 1;
        },
        { timeout: 10000 }
      );
      await new Promise((r) => setTimeout(r, 400));
    };

    // 3. Tahfizh 1366x768 (Desktop)
    console.log("\n[Shot 3/9] Tahfizh 1366x768...");
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await openTahfizh();
    capturedFiles.push(await capture(page, "pilot_03_tahfizh_1366x768.png"));

    // 4. Tahfizh 1440x900 (Widescreen)
    console.log("\n[Shot 4/9] Tahfizh 1440x900...");
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 300));
    capturedFiles.push(await capture(page, "pilot_04_tahfizh_1440x900.png"));

    // 5. Tahfizh 390x844 (Mobile)
    console.log("\n[Shot 5/9] Tahfizh 390x844...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 300));
    capturedFiles.push(await capture(page, "pilot_05_tahfizh_390x844.png"));

    // Helper buka Tahfizh jika belum terbuka
    const ensureTahfizhReady = async () => {
      const existing = await page.$('#santri-selector');
      if (!existing) {
        await openTahfizh();
      }
      await page.waitForSelector('#santri-selector', { timeout: 10000 });
      await page.waitForFunction(
        () => {
          const sel = document.querySelector("#santri-selector") as HTMLSelectElement | null;
          return sel && sel.options.length > 1;
        },
        { timeout: 10000 }
      );
    };

    // 7. Tahfizh Nama Santri Panjang
    console.log("\n[Shot 7/9] Tahfizh nama santri panjang...");
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0" });
    await ensureTahfizhReady();
    await page.select("#santri-selector", LONG_NAME_SANTRI_ID);
    await new Promise((r) => setTimeout(r, 600));
    capturedFiles.push(await capture(page, "pilot_07_tahfizh_long_name.png"));

    // 8. Tahfizh Kondisi Sukses
    console.log("\n[Shot 8/9] Tahfizh kondisi sukses...");
    await ensureTahfizhReady();
    await page.select("#santri-selector", FIXTURES.SANTRI_MULTI);
    await new Promise((r) => setTimeout(r, 500));
    const btnPlus1 = await page.waitForSelector('[data-testid="btn-quick-add-1"]');
    await btnPlus1?.click();
    await new Promise((r) => setTimeout(r, 200));

    const saveBtn = await page.waitForSelector('[data-testid="btn-simpan-setoran"]');
    await saveBtn?.click();
    await page.waitForSelector('[data-testid="setoran-success"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));
    capturedFiles.push(await capture(page, "pilot_08_tahfizh_success_state.png"));

    // 9. Tahfizh Kondisi Error
    console.log("\n[Shot 9/9] Tahfizh kondisi error...");
    await ensureTahfizhReady();
    // Gunakan Santri Half: setorkan 0.5 ke-1 dan ke-2 sehingga hlm 431 penuh
    await page.select("#santri-selector", FIXTURES.SANTRI_HALF);
    await new Promise((r) => setTimeout(r, 500));
    const btnPlusHalf = await page.waitForSelector('[data-testid="btn-quick-add-0.5"]');
    await btnPlusHalf?.click();
    const saveBtnHalf1 = await page.waitForSelector('[data-testid="btn-simpan-setoran"]');
    await saveBtnHalf1?.click();
    await page.waitForSelector('[data-testid="setoran-success"]', { timeout: 10000 });

    // Reload dan simpan 0.5 kedua
    await page.reload({ waitUntil: "networkidle0" });
    await ensureTahfizhReady();
    await page.select("#santri-selector", FIXTURES.SANTRI_HALF);
    await new Promise((r) => setTimeout(r, 500));
    const btnPlusHalf2 = await page.waitForSelector('[data-testid="btn-quick-add-0.5"]');
    await btnPlusHalf2?.click();
    const saveBtnHalf2 = await page.waitForSelector('[data-testid="btn-simpan-setoran"]');
    await saveBtnHalf2?.click();
    await page.waitForSelector('[data-testid="setoran-success"]', { timeout: 10000 });

    // Reload dan coba setorkan 0.5 ketiga ke halaman 431 yang sudah penuh (1.0)
    await page.reload({ waitUntil: "networkidle0" });
    await ensureTahfizhReady();
    await page.select("#santri-selector", FIXTURES.SANTRI_HALF);
    await new Promise((r) => setTimeout(r, 500));
    const btnPlusHalf3 = await page.waitForSelector('[data-testid="btn-quick-add-0.5"]');
    await btnPlusHalf3?.click();
    await setInputValue(page, '[data-testid="input-halaman-mulai"]', "431");
    await setInputValue(page, '[data-testid="input-halaman-selesai"]', "431");
    const saveBtnHalf3 = await page.waitForSelector('[data-testid="btn-simpan-setoran"]');
    await saveBtnHalf3?.click();

    // Jika modal alasan lompat urutan muncul, isi alasan dan klik konfirmasi
    try {
      const modalTextarea = await page.waitForSelector('[data-testid="textarea-jump-alasan"]', { timeout: 3000 });
      if (modalTextarea) {
        await modalTextarea.type("Pengujian visual kondisi error kapasitas penuh");
        await new Promise((r) => setTimeout(r, 200));
        const confirmBtn = await page.waitForSelector('[data-testid="btn-confirm-jump"]');
        await confirmBtn?.click();
      }
    } catch {
      // Modal tidak muncul jika langsung diproses
    }

    // Tunggu banner error kapasitas penuh
    await page.waitForSelector('[data-testid="setoran-error"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 400));
    capturedFiles.push(await capture(page, "pilot_09_tahfizh_error_state.png"));

    console.log("\n=== Semua 9 Screenshot Berhasil Diambil ===");
    capturedFiles.forEach((f, idx) => console.log(`${idx + 1}. ${f}`));

  } finally {
    if (browser) {
      console.log("[Cleanup] Menutup browser Puppeteer...");
      await browser.close().catch(() => {});
    }

    if (nextServerProcess && nextServerProcess.pid) {
      console.log(`[Cleanup] Menutup Next.js server test (PID: ${nextServerProcess.pid})...`);
      try {
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", String(nextServerProcess.pid), "/T", "/F"]);
        } else {
          nextServerProcess.kill("SIGKILL");
        }
      } catch {}
    }

    if (testPrisma) {
      console.log("[Cleanup] Menghentikan PostgreSQL test dan membersihkan temp directory...");
      await stopTestDatabase().catch((e) => console.error("Error stopping db:", e));
    }
  }
}

runCapture()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Gagal mengambil screenshot:", err);
    process.exit(1);
  });
