import puppeteer, { Browser } from "puppeteer-core";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { PrismaClient } from "@prisma/client";
import {
  startTestDatabase,
  setupTestFixtures,
  cleanupTestFixtures,
  stopTestDatabase,
  findFreePort,
  isPortInUse,
  FIXTURES,
  getActiveTestDatabaseUrl,
  getActiveTestPort,
  terminateOwnedChildProcess,
} from "../tests/test-db-manager";
import { getChromeExecutablePath } from "../tests/helpers/qa-layout-assertions";

const CHROME_PATH = getChromeExecutablePath();
const ARTIFACT_DIR =
  process.env.E2E_ARTIFACT_DIR ||
  process.env.ARTIFACT_DIR ||
  path.join(os.tmpdir(), "stq-e2e-artifacts");

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function fail(message: string): never {
  throw new Error(`[REWARD_EVALUASI_ASSERTION_FAILED] ${message}`);
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
      // Server warming up
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

export async function runRewardEvaluasiBrowserRegression() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";

  console.log("================================================================================");
  console.log("🚀 BROWSER REGRESSION: REWARD & EVALUASI BULANAN PRATINJAU NO-CRASH TEST");
  console.log("================================================================================");

  let browser: Browser | null = null;
  let nextServerProcess: ChildProcess | null = null;
  let testPrisma: PrismaClient | null = null;
  let executionError: Error | null = null;

  let testPgPort = 0;
  let testNextPort = 0;
  let testDbUrl = "";

  const pageErrors: string[] = [];

  try {
    console.log("\n[1] Mempersiapkan PostgreSQL test terisolasi...");
    testPrisma = await startTestDatabase();
    testPgPort = getActiveTestPort();
    testDbUrl = getActiveTestDatabaseUrl();
    console.log(`   ✓ DB Port: ${testPgPort}, URL: ${testDbUrl.replace(/:[^:@]+@/, ":***@")}`);

    console.log("\n[2] Mempersiapkan fixtures data...");
    await setupTestFixtures(testPrisma);
    console.log("   ✓ Fixtures siap.");

    console.log("\n[3] Mencari port Next.js test...");
    testNextPort = await findFreePort(3200);
    const BASE_URL = `http://127.0.0.1:${testNextPort}`;
    console.log(`   ✓ BASE_URL: ${BASE_URL}`);

    if (await isPortInUse(testNextPort)) {
      fail(`Port ${testNextPort} terpakai.`);
    }

    const rootDir = path.resolve(__dirname, "..");
    const testDistDir = path.join(rootDir, ".next-test-reward-e2e");
    if (fs.existsSync(testDistDir)) {
      try {
        fs.rmSync(testDistDir, { recursive: true, force: true });
      } catch {}
    }

    console.log("\n[4] Memulai Next.js dev server...");
    const nextCli = require.resolve("next/dist/bin/next");
    const isWin = process.platform === "win32";

    nextServerProcess = spawn(
      process.execPath,
      [nextCli, "dev", "-p", testNextPort.toString(), "-H", "127.0.0.1"],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          PORT: testNextPort.toString(),
          NEXT_DIST_DIR: ".next-test-reward-e2e",
          DATABASE_URL: testDbUrl,
          TEST_DATABASE_URL: testDbUrl,
          NODE_ENV: "test",
          IS_TEST_RUN: "true",
          ALLOW_ISOLATED_TEST_DB: "true",
          AUTH_SECRET: "stq_portal_test_secret_session_key_min_32_characters_long_2026",
        },
        detached: !isWin,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const isReady = await waitForServerReady(`${BASE_URL}/login`, 60000);
    if (!isReady) {
      fail(`Next.js test server di ${BASE_URL} gagal siap.`);
    }
    console.log("   ✓ Next.js server test merespons.");

    console.log("\n[5] Meluncurkan browser Chrome...");
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    page.on("pageerror", (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   [PAGE ERROR DETECTED]: ${msg}`);
      pageErrors.push(msg);
    });

    // Login
    console.log("\n[6] Login sebagai Musyrif...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="text"], input[name="username"]', FIXTURES.USERNAME);
    await page.type('input[type="password"]', FIXTURES.PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      { timeout: 15000 }
    );
    console.log("   ✓ Login berhasil.");

    // Navigate to Tahfizh
    console.log("\n[7] Navigasi ke Modul Tahfizh...");
    await page.waitForSelector('[data-testid="authenticated-app"]', { timeout: 15000 });
    const navBtn = await page.waitForSelector('[data-testid="nav-tahfizh"], button[title*="Tahfizh"]', { timeout: 10000 });
    if (!navBtn) fail("Navigasi Tahfizh tidak ditemukan.");
    await navBtn.click();
    await page.waitForSelector('[data-testid="tahfizh-module"]', { timeout: 10000 });
    console.log("   ✓ Modul Tahfizh terbuka.");

    // Click Tab Reward & Evaluasi
    console.log("\n[8] Membuka Sub-Tab Reward & Evaluasi Bulanan...");
    const tabRewardBtn = await page.waitForSelector('[data-testid="tab-reward_evaluasi"]', { timeout: 10000 });
    if (!tabRewardBtn) fail("Tab Reward & Evaluasi Bulanan tidak ditemukan.");
    await tabRewardBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    console.log("   ✓ Sub-Tab Reward & Evaluasi Bulanan aktif.");

    // Click Muat Pratinjau
    console.log("\n[9] Menekan tombol 'Muat Pratinjau'...");
    const btnMuatPratinjau = await page.waitForSelector('[data-testid="btn-muat-pratinjau"]', { timeout: 10000 });
    if (!btnMuatPratinjau) fail("Tombol Muat Pratinjau tidak ditemukan.");
    await btnMuatPratinjau.click();

    // Tunggu respon pratinjau (tabel muncul atau teks santri terhitung)
    console.log("   Menunggu hasil kalkulasi pratinjau...");
    await page.waitForFunction(
      () => {
        const bodyText = document.body.innerText;
        return (
          bodyText.includes("Total Santri Dievaluasi") ||
          bodyText.includes("Tidak ada data santri") ||
          bodyText.includes("Format data pratinjau tidak valid")
        );
      },
      { timeout: 15000 }
    );
    console.log("   ✓ Pratinjau berhasil dimuat tanpa crash!");

    // Capture screenshot
    const screenshotPath = path.join(ARTIFACT_DIR, "qa_reward_evaluasi_preview.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   📸 Screenshot tersimpan di: ${screenshotPath}`);

    // Pastikan tidak ada crash / TypeError
    const crashErrors = pageErrors.filter((e) =>
      e.includes("filter is not a function") ||
      e.includes("TypeError") ||
      e.includes("Cannot read properties of undefined")
    );
    if (crashErrors.length > 0) {
      fail(`Terjadi crash pada halaman saat memuat pratinjau: ${crashErrors.join("; ")}`);
    }
    console.log("   ✓ Zero TypeError / previewList.filter crash terverifikasi.");

    // Section B Check: Buka Tab Rekap Bulanan DUC dan periksa StatCard Kepatuhan Muroja'ah
    console.log("\n[10] Memeriksa StatCard Rekap Bulanan DUC (Bebas dari hardcoded 94.2%)...");
    const tabLaporanBtn = await page.waitForSelector('[data-testid="tab-laporan"]', { timeout: 10000 });
    if (tabLaporanBtn) {
      await tabLaporanBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const pageText = await page.evaluate(() => document.body.innerText);
      // Hardcoded 94.2% harus sama sekali tidak ada di halaman
      if (pageText.includes("94.2%")) {
        fail("Halaman masih memuat nilai fiktif hardcoded 94.2%!");
      }
      console.log("   ✓ Nilai hardcoded 94.2% terbukti telah dihilangkan!");
    }

    console.log("\n================================================================================");
    console.log("🎉 SELURUH VERIFIKASI BROWSER PRE-PR #8 INTEGRITY HOTFIX BERHASIL!");
    console.log("================================================================================");
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`\n❌ [TEST EXECUTION FAILED]: ${error.message}`);
    executionError = error;
  } finally {
    console.log("\n[CLEANUP] Membersihkan resource pengujian...");
    if (browser) {
      try {
        await browser.close();
        console.log("   ✓ Browser Chrome ditutup.");
      } catch {}
    }

    if (nextServerProcess) {
      try {
        await terminateOwnedChildProcess(nextServerProcess);
        console.log("   ✓ Next.js server test dihentikan.");
      } catch {}
    }

    if (testPrisma) {
      try {
        await cleanupTestFixtures(testPrisma);
        console.log("   ✓ Fixtures test dibersihkan.");
      } catch {}
    }

    try {
      await stopTestDatabase();
      console.log("   ✓ Embedded PostgreSQL test dihentikan.");
    } catch {}

    if (executionError) {
      process.exitCode = 1;
      throw executionError;
    }
  }
}

if (require.main === module) {
  runRewardEvaluasiBrowserRegression().catch(() => {
    process.exit(1);
  });
}
