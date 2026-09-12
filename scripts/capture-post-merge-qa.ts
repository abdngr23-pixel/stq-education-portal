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
  "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\2e007fd6-5979-4f82-acf8-6442f424e90b";

const DOCS_DIR = path.join(process.cwd(), "docs", "screenshots", "post-merge");

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
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
      // Menunggu server siap
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = { fullPage: true }) {
  const fullPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: options.fullPage });
  const docsPath = path.join(DOCS_DIR, filename);
  try {
    fs.copyFileSync(fullPath, docsPath);
  } catch {}
  console.log(`📸 [Screenshot Saved] -> ${filename}`);
  return fullPath;
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`MEMULAI PENANGKAPAN BUKTI VISUAL POST-MERGE QA REMEDIATION`);
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

    // Tambah 2 santri agar total santri > 5
    await testPrisma.santri.create({
      data: {
        id: "santri-qa-extra-01",
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

    testNextPort = await findFreePort(3800);
    console.log(`[2] Menjalankan Next.js server di port ${testNextPort}...`);
    const serverEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(testNextPort),
      NODE_ENV: "production",
    };

    nextServerProcess = spawn("node", ["./node_modules/next/dist/bin/next", "start", "-p", String(testNextPort)], {
      cwd: process.cwd(),
      env: serverEnv,
      stdio: "pipe",
    });

    const baseUrl = `http://127.0.0.1:${testNextPort}`;
    console.log(`[3] Menunggu Next.js server siap di ${baseUrl}...`);
    const ready = await waitForServerReady(baseUrl);
    if (!ready) throw new Error("Next.js server gagal siap dalam waktu batas!");

    console.log("[4] Meluncurkan browser...");
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Login sebagai Musyrif Tahfizh
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="text"], input[name="username"]', FIXTURES.USERNAME);
    await page.type('input[type="password"]', FIXTURES.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="authenticated-app"]', { timeout: 15000 });

    // -------------------------------------------------------------
    // DESKTOP SCREENSHOTS (1366x768, 1440x900, 1920x1080)
    // -------------------------------------------------------------
    const desktopViewports = [
      { name: "desktop_1366x768", width: 1366, height: 768 },
      { name: "desktop_1440x900", width: 1440, height: 900 },
      { name: "desktop_1920x1080", width: 1920, height: 1080 },
    ];

    for (const vp of desktopViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 400));

      // Beranda
      await capture(page, `qa_beranda_${vp.name}.png`);

      // Navigasi ke Tahfizh
      const navTahfizh = await page.$('button[data-testid="nav-tahfizh"]');
      if (navTahfizh) {
        await navTahfizh.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_tahfizh_${vp.name}.png`);
      }

      // Navigasi ke Data Santri
      const navSantri = await page.$('button[data-testid="nav-data_santri"]');
      if (navSantri) {
        await navSantri.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_data_santri_${vp.name}.png`);
      }

      // Navigasi ke Akademik
      const navAkademik = await page.$('button[data-testid="nav-akademik"]');
      if (navAkademik) {
        await navAkademik.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_akademik_empty_${vp.name}.png`);
      }

      // Kembalikan ke Beranda
      const navBeranda = await page.$('button[data-testid="nav-beranda"]');
      if (navBeranda) await navBeranda.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // -------------------------------------------------------------
    // MOBILE SCREENSHOTS (390x844 - iPhone, 412x915 - Android/Pixel)
    // -------------------------------------------------------------
    const mobileViewports = [
      { name: "mobile_390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
      { name: "mobile_412x915", width: 412, height: 915, isMobile: true, hasTouch: true },
    ];

    for (const vp of mobileViewports) {
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
      await new Promise((r) => setTimeout(r, 400));

      // Beranda Mobile
      const navBerandaMobile = await page.$('button[data-testid="mobile-nav-beranda"]');
      if (navBerandaMobile) await navBerandaMobile.click();
      await new Promise((r) => setTimeout(r, 500));
      await capture(page, `qa_beranda_${vp.name}.png`);

      // Tahfizh Mobile
      const navTahfizhMobile = await page.$('button[data-testid="mobile-nav-tahfizh"]');
      if (navTahfizhMobile) {
        await navTahfizhMobile.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_tahfizh_${vp.name}.png`);
      }

      // Presensi Mobile
      const navPresensiMobile = await page.$('button[data-testid="mobile-nav-presensi"]');
      if (navPresensiMobile) {
        await navPresensiMobile.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_presensi_${vp.name}.png`);
      }

      // Data Santri Mobile
      const navSantriMobile = await page.$('button[data-testid="mobile-nav-data_santri"]');
      if (navSantriMobile) {
        await navSantriMobile.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_data_santri_${vp.name}.png`);
      }

      // Akademik Mobile (buka drawer jika perlu)
      let navAkademikMobile = await page.$('button[data-testid="mobile-nav-akademik"]');
      if (!navAkademikMobile) {
        // Klik tombol "Lainnya"
        const moreBtn = await page.$('button[aria-label="Buka Menu Tambahan"], nav button:last-child');
        if (moreBtn) {
          await moreBtn.click();
          await new Promise((r) => setTimeout(r, 400));
          navAkademikMobile = await page.$('button[data-testid="mobile-nav-akademik"]');
        }
      }
      if (navAkademikMobile) {
        await navAkademikMobile.click();
        await new Promise((r) => setTimeout(r, 600));
        await capture(page, `qa_akademik_mobile_${vp.name}.png`);
      }
    }

    console.log(`\n✅ Penangkapan seluruh visual evidence berhasil!`);
  } catch (err) {
    console.error("❌ Kesalahan saat menangkap visual QA:", err);
    throw err;
  } finally {
    if (browser) await browser.close();
    if (nextServerProcess) {
      nextServerProcess.kill();
      console.log("   ✓ Next.js server test dihentikan.");
    }
    if (testPrisma) {
      await stopTestDatabase();
      console.log("   ✓ Test database dihentikan dan dibersihkan.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
