import puppeteer, { Browser, Page, ElementHandle } from "puppeteer-core";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  startTestDatabase,
  setupTestFixtures,
  setupStressTestRaporFixtures,
  stopTestDatabase,
  findFreePort,
  FIXTURES,
  RAPOR_STRESS_FIXTURES,
} from "../tests/test-db-manager";
import {
  getChromeExecutablePath,
  getArtifactDirectories,
  assertNoHorizontalOverflow,
  assertNoStickyCollision,
  assertContentNotObscured,
  assertTouchTargets,
  assertMobileBottomNav,
  assertHeaderOffset,
  assertCriticalTextClipping,
  formatFindingsTable,
  VisualFinding,
  AssertionResult,
} from "../tests/helpers/qa-layout-assertions";

export interface QARunnerOptions {
  captureScreenshots: boolean;
  failOnStructuralError?: boolean;
}

export interface QARunnerSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  findings: VisualFinding[];
  screenshotsCaptured: string[];
}

/**
 * Helper fail-closed untuk memvalidasi keberadaan kontrol navigasi wajib.
 * Merekam kegagalan eksplisit jika kontrol tidak ditemukan di DOM (tidak ada silent skip).
 */
async function requireControl(
  page: Page,
  selector: string,
  label: string,
  pageName: string,
  viewport: string,
  recordAssertion: (result: AssertionResult) => void
): Promise<ElementHandle<Element> | null> {
  const el = await page.$(selector);
  if (!el) {
    recordAssertion({
      passed: false,
      category: "Required Navigation Control",
      page: pageName,
      viewport,
      details: `[FAIL] ${pageName} ${viewport}: required control "${label}" (${selector}) was not found`,
      finding: {
        severity: "P1",
        page: pageName,
        viewport,
        component: selector,
        issue: `Required navigation control "${label}" tidak ditemukan di DOM`,
        measurement: `document.querySelector('${selector}') === null`,
        recommendation: `Pastikan kontrol navigasi "${label}" tersedia dengan selector "${selector}".`,
      },
    });
    return null;
  }
  return el;
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

async function safeCapture(
  page: Page,
  filename: string,
  options: { capture: boolean; artifactDir: string; docsDir: string; fullPage?: boolean }
): Promise<string | null> {
  if (!options.capture) return null;

  const fullPath = path.join(options.artifactDir, filename);
  await page.screenshot({ path: fullPath, fullPage: options.fullPage ?? true });
  const docsPath = path.join(options.docsDir, filename);
  try {
    fs.copyFileSync(fullPath, docsPath);
  } catch {}
  console.log(`📸 [Screenshot Tersimpan] -> ${filename}`);
  return fullPath;
}

export async function runVisualQAChecks(options: QARunnerOptions): Promise<QARunnerSummary> {
  const CHROME_PATH = getChromeExecutablePath();
  const { artifactDir, docsDir } = getArtifactDirectories();

  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.IS_TEST_RUN = "true";
  process.env.ALLOW_ISOLATED_TEST_DB = "true";

  let browser: Browser | null = null;
  let nextServerProcess: ChildProcess | null = null;
  let testPrisma: PrismaClient | null = null;
  let testNextPort = 0;

  const allResults: AssertionResult[] = [];
  const findings: VisualFinding[] = [];
  const capturedFiles: string[] = [];

  const recordAssertion = (res: AssertionResult) => {
    allResults.push(res);
    if (!res.passed) {
      console.warn(`⚠️ [LAYOUT ASSERTION ISSUE] [${res.page}] (${res.viewport}): ${res.details}`);
      if (res.finding) {
        findings.push(res.finding);
      }
    }
  };

  try {
    console.log(`\n===============================================================`);
    console.log(`MEMULAI STRUCTURAL QA & VISUAL VERIFICATION (LINTAS PLATFORM)`);
    console.log(`Browser: ${CHROME_PATH}`);
    console.log(`Capture Screenshots: ${options.captureScreenshots ? "YA" : "TIDAK (STRUCTURAL CHECKS ONLY)"}`);
    console.log(`Artifact Directory: ${artifactDir}`);
    console.log(`===============================================================`);

    console.log("[1] Menyiapkan database PostgreSQL terisolasi & fixtures...");
    testPrisma = await startTestDatabase();
    await setupTestFixtures(testPrisma);
    await setupStressTestRaporFixtures(testPrisma);

    // Tambah 1 santri extra agar total santri > 5
    await testPrisma.santri.upsert({
      where: { id: "santri-qa-extra-01" },
      update: {},
      create: {
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
    if (!ready) throw new Error("Next.js server gagal siap dalam batas waktu yang ditentukan!");

    console.log("[4] Meluncurkan Puppeteer browser...");
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    // Login sebagai Musyrif Tahfizh
    console.log("[5] Melakukan otentikasi Musyrif Tahfizh...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="text"], input[name="username"]', FIXTURES.USERNAME);
    await page.type('input[type="password"]', FIXTURES.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="authenticated-app"]', { timeout: 15000 });

    // =========================================================================
    // A. DESKTOP VIEWPORTS (1366x768, 1440x900, 1920x1080)
    // =========================================================================
    const desktopViewports = [
      { name: "desktop_1366x768", width: 1366, height: 768 },
      { name: "desktop_1440x900", width: 1440, height: 900 },
      { name: "desktop_1920x1080", width: 1920, height: 1080 },
    ];

    console.log("\n[6] Memulai pengujian Desktop Viewports...");
    for (const vp of desktopViewports) {
      console.log(`\n--- Desktop: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 400));

      // 1. Beranda
      recordAssertion(await assertNoHorizontalOverflow(page, "Beranda", vp.name));
      recordAssertion(
        await assertCriticalTextClipping(page, "Beranda", vp.name, [
          { selector: "h1, h2", label: "Judul Beranda", required: true },
          { selector: "[data-testid=\"stat-card-title\"]", label: "Judul StatCard", required: false },
        ])
      );
      const capBeranda = await safeCapture(page, `qa_beranda_${vp.name}.png`, {
        capture: options.captureScreenshots,
        artifactDir,
        docsDir,
      });
      if (capBeranda) capturedFiles.push(capBeranda);

      // 2. Navigasi ke Tahfizh
      const navTahfizh = await requireControl(
        page,
        'button[data-testid="nav-tahfizh"]',
        "Navigasi Desktop Tahfizh",
        "Tahfizh Desktop",
        vp.name,
        recordAssertion
      );
      if (navTahfizh) {
        await navTahfizh.click();
        await new Promise((r) => setTimeout(r, 600));
        recordAssertion(await assertNoHorizontalOverflow(page, "Tahfizh", vp.name));
        recordAssertion(
          await assertCriticalTextClipping(page, "Tahfizh", vp.name, [
            { selector: "h1, h2, h3", label: "Judul Modul Tahfizh", required: true },
          ])
        );
        const capTahfizh = await safeCapture(page, `qa_tahfizh_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capTahfizh) capturedFiles.push(capTahfizh);
      }

      // 3. Navigasi ke Data Santri
      const navSantri = await requireControl(
        page,
        'button[data-testid="nav-data_santri"]',
        "Navigasi Desktop Data Santri",
        "Data Santri Desktop",
        vp.name,
        recordAssertion
      );
      if (navSantri) {
        await navSantri.click();
        await new Promise((r) => setTimeout(r, 600));
        recordAssertion(await assertNoHorizontalOverflow(page, "Data Santri", vp.name));
        recordAssertion(
          await assertCriticalTextClipping(page, "Data Santri", vp.name, [
            { selector: "h1, h2, h3", label: "Judul Master Data Santri", required: true },
          ])
        );
        const capSantri = await safeCapture(page, `qa_data_santri_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capSantri) capturedFiles.push(capSantri);
      }

      // 4. Navigasi ke Akademik
      const navAkademik = await requireControl(
        page,
        'button[data-testid="nav-akademik"]',
        "Navigasi Desktop Akademik",
        "Akademik Desktop",
        vp.name,
        recordAssertion
      );
      if (navAkademik) {
        await navAkademik.click();
        await new Promise((r) => setTimeout(r, 600));

        // Subtab Input Nilai (Empty state)
        recordAssertion(await assertNoHorizontalOverflow(page, "Akademik (Empty State)", vp.name));
        const capAkademikEmpty = await safeCapture(page, `qa_akademik_empty_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capAkademikEmpty) capturedFiles.push(capAkademikEmpty);

        // Subtab Rapor Santri (Pratinjau dengan Data Rapor Riil)
        const subTabRapor = await requireControl(
          page,
          'button[data-testid="subtab-rapor"]',
          "Subtab Rapor Santri",
          "Akademik Desktop",
          vp.name,
          recordAssertion
        );
        if (subTabRapor) {
          await subTabRapor.click();
          await new Promise((r) => setTimeout(r, 600));

          // Pilih santri stress test
          const selectSantri = await requireControl(
            page,
            'select[data-testid="select-santri-rapor"]',
            "Selector Santri Rapor",
            "Akademik Desktop",
            vp.name,
            recordAssertion
          );
          if (selectSantri) {
            await page.select('select[data-testid="select-santri-rapor"]', RAPOR_STRESS_FIXTURES.SANTRI_NIS);
            await new Promise((r) => setTimeout(r, 600));
          }

          recordAssertion(await assertNoHorizontalOverflow(page, "Akademik (Rapor Data)", vp.name));
          recordAssertion(
            await assertCriticalTextClipping(page, "Akademik (Rapor Data)", vp.name, [
              { selector: "h3, h4", label: "Judul Rapor & Mata Pelajaran", required: true },
            ])
          );

          if (vp.width === 1366) {
            const capRaporData = await safeCapture(page, `qa_akademik_rapor_data_desktop_1366x768.png`, {
              capture: options.captureScreenshots,
              artifactDir,
              docsDir,
            });
            if (capRaporData) capturedFiles.push(capRaporData);

            // Buka Modal Cetak Rapor
            const btnCetakModal = await requireControl(
              page,
              'button[data-testid="btn-cetak-rapor-modal"]',
              "Tombol Cetak Rapor Modal",
              "Modal Cetak Rapor Desktop",
              vp.name,
              recordAssertion
            );
            if (btnCetakModal) {
              await btnCetakModal.click();
              await new Promise((r) => setTimeout(r, 600));

              recordAssertion(await assertNoHorizontalOverflow(page, "Modal Cetak Rapor", vp.name));
              const capPrintModal = await safeCapture(page, `qa_rapor_print_preview_desktop_1366x768.png`, {
                capture: options.captureScreenshots,
                artifactDir,
                docsDir,
                fullPage: false,
              });
              if (capPrintModal) capturedFiles.push(capPrintModal);

              // Tutup modal
              const btnClose = await requireControl(
                page,
                'button[data-testid="btn-close-print-modal"]',
                "Tombol Tutup Modal Cetak Rapor",
                "Modal Cetak Rapor Desktop",
                vp.name,
                recordAssertion
              );
              if (btnClose) {
                await btnClose.click();
                await new Promise((r) => setTimeout(r, 400));
              }
            }
          }
        }
      }

      // Kembalikan ke Beranda
      const navBeranda = await requireControl(
        page,
        'button[data-testid="nav-beranda"]',
        "Navigasi Beranda",
        "Beranda Desktop",
        vp.name,
        recordAssertion
      );
      if (navBeranda) await navBeranda.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // =========================================================================
    // B. MOBILE VIEWPORTS (360x800, 390x844, 412x915)
    // =========================================================================
    const mobileViewports = [
      { name: "mobile_360x800", width: 360, height: 800, isMobile: true, hasTouch: true },
      { name: "mobile_390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
      { name: "mobile_412x915", width: 412, height: 915, isMobile: true, hasTouch: true },
    ];

    console.log("\n[7] Memulai pengujian Mobile Viewports (termasuk 360x800 minimum)...");
    for (const vp of mobileViewports) {
      console.log(`\n--- Mobile: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
      await new Promise((r) => setTimeout(r, 400));

      // 1. Beranda Mobile
      const navBerandaMobile = await requireControl(
        page,
        'button[data-testid="mobile-nav-beranda"]',
        "Navigasi Mobile Beranda",
        "Beranda Mobile",
        vp.name,
        recordAssertion
      );
      if (navBerandaMobile) await navBerandaMobile.click();
      await new Promise((r) => setTimeout(r, 500));

      recordAssertion(await assertNoHorizontalOverflow(page, "Beranda Mobile", vp.name));
      recordAssertion(await assertMobileBottomNav(page, "Beranda Mobile", vp.name, 'nav[data-testid="mobile-bottom-nav"]', { required: true }));
      recordAssertion(
        await assertTouchTargets(page, "Beranda Mobile", vp.name, [
          { selector: 'button[data-testid="mobile-nav-beranda"]', label: "Tombol Nav Beranda", required: true },
          { selector: 'button[data-testid="mobile-nav-tahfizh"]', label: "Tombol Nav Tahfizh", required: true },
          { selector: 'button[data-testid="mobile-nav-presensi"]', label: "Tombol Nav Presensi", required: true },
          { selector: 'button[data-testid="mobile-nav-data_santri"]', label: "Tombol Nav Santri", required: true },
        ])
      );
      recordAssertion(
        await assertHeaderOffset(page, "Beranda Mobile", vp.name, "h1, h2, h3", "header", { required: true })
      );
      const capBerandaMobile = await safeCapture(page, `qa_beranda_${vp.name}.png`, {
        capture: options.captureScreenshots,
        artifactDir,
        docsDir,
      });
      if (capBerandaMobile) capturedFiles.push(capBerandaMobile);

      // 2. Tahfizh Mobile
      const navTahfizhMobile = await requireControl(
        page,
        'button[data-testid="mobile-nav-tahfizh"]',
        "Navigasi Mobile Tahfizh",
        "Tahfizh Mobile",
        vp.name,
        recordAssertion
      );
      if (navTahfizhMobile) {
        await navTahfizhMobile.click();
        await new Promise((r) => setTimeout(r, 600));

        recordAssertion(await assertNoHorizontalOverflow(page, "Tahfizh Mobile", vp.name));
        recordAssertion(await assertMobileBottomNav(page, "Tahfizh Mobile", vp.name, 'nav[data-testid="mobile-bottom-nav"]', { required: true }));
        recordAssertion(
          await assertTouchTargets(page, "Tahfizh Mobile", vp.name, [
            { selector: 'button[data-testid="tab-setoran"]', label: "Tab Setoran Harian", required: true },
            { selector: 'button[data-testid="tab-laporan"]', label: "Tab Rekap Bulanan", required: true },
          ])
        );
        recordAssertion(
          await assertHeaderOffset(page, "Tahfizh Mobile", vp.name, "h1, h2, h3", "header", { required: true })
        );
        const capTahfizhMobile = await safeCapture(page, `qa_tahfizh_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capTahfizhMobile) capturedFiles.push(capTahfizhMobile);
      }

      // 3. Presensi Mobile
      const navPresensiMobile = await requireControl(
        page,
        'button[data-testid="mobile-nav-presensi"]',
        "Navigasi Mobile Presensi",
        "Presensi Mobile",
        vp.name,
        recordAssertion
      );
      if (navPresensiMobile) {
        await navPresensiMobile.click();
        await new Promise((r) => setTimeout(r, 600));

        recordAssertion(await assertNoHorizontalOverflow(page, "Presensi Mobile", vp.name));
        recordAssertion(await assertMobileBottomNav(page, "Presensi Mobile", vp.name, 'nav[data-testid="mobile-bottom-nav"]', { required: true }));
        recordAssertion(
          await assertHeaderOffset(page, "Presensi Mobile", vp.name, "h1, h2, h3", "header", { required: true })
        );

        // Pemeriksaan Khusus Presensi: Sticky Save Bar vs Bottom Nav Collision (REQUIRED)
        recordAssertion(
          await assertNoStickyCollision(
            page,
            "Presensi Mobile",
            vp.name,
            '[data-testid="floating-save-bar"]',
            'nav[data-testid="mobile-bottom-nav"]',
            { required: true }
          )
        );

        // Pemeriksaan Khusus Presensi: Konten Terakhir Tidak Tertutup Sticky Area (REQUIRED)
        recordAssertion(
          await assertContentNotObscured(
            page,
            "Presensi Mobile",
            vp.name,
            '[data-testid="santri-presensi-list"] > *:last-child',
            ['[data-testid="floating-save-bar"]', 'nav[data-testid="mobile-bottom-nav"]'],
            { required: true }
          )
        );

        const capPresensiMobile = await safeCapture(page, `qa_presensi_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capPresensiMobile) capturedFiles.push(capPresensiMobile);
      }

      // 4. Data Santri Mobile
      const navSantriMobile = await requireControl(
        page,
        'button[data-testid="mobile-nav-data_santri"]',
        "Navigasi Mobile Data Santri",
        "Data Santri Mobile",
        vp.name,
        recordAssertion
      );
      if (navSantriMobile) {
        await navSantriMobile.click();
        await new Promise((r) => setTimeout(r, 600));

        recordAssertion(await assertNoHorizontalOverflow(page, "Data Santri Mobile", vp.name));
        recordAssertion(await assertMobileBottomNav(page, "Data Santri Mobile", vp.name, 'nav[data-testid="mobile-bottom-nav"]', { required: true }));
        recordAssertion(
          await assertHeaderOffset(page, "Data Santri Mobile", vp.name, "h1, h2, h3", "header", { required: true })
        );

        const capSantriMobile = await safeCapture(page, `qa_data_santri_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capSantriMobile) capturedFiles.push(capSantriMobile);
      }

      // 5. Akademik Mobile (buka drawer menu "Lainnya" jika navigasi langsung tidak ada)
      let navAkademikMobile = await page.$('button[data-testid="mobile-nav-akademik"]');
      let accessedViaDrawer = false;
      if (!navAkademikMobile) {
        const moreBtn = await page.$('button[aria-label="Buka Menu Tambahan"], nav button:last-child');
        if (moreBtn) {
          await moreBtn.click();
          await new Promise((r) => setTimeout(r, 400));
          navAkademikMobile = await page.$('button[data-testid="mobile-nav-akademik"]');
          accessedViaDrawer = !!navAkademikMobile;
        }
      }

      if (!navAkademikMobile) {
        recordAssertion({
          passed: false,
          category: "Required Navigation Control",
          page: "Akademik Mobile",
          viewport: vp.name,
          details: `[FAIL] Akademik Mobile ${vp.name}: Tidak ditemukan jalur navigasi yang valid menuju modul Akademik (gagal langsung maupun via menu Lainnya).`,
          finding: {
            severity: "P1",
            page: "Akademik Mobile",
            viewport: vp.name,
            component: 'button[data-testid="mobile-nav-akademik"]',
            issue: "Jalur navigasi menuju modul Akademik tidak ditemukan di bottom nav maupun menu tambahan",
            measurement: "navAkademikMobile === null",
            recommendation: "Pastikan item navigasi Akademik tersedia secara langsung atau melalui drawer menu Lainnya.",
          },
        });
      } else {
        recordAssertion({
          passed: true,
          category: "Required Navigation Control",
          page: "Akademik Mobile",
          viewport: vp.name,
          details: `Jalur valid menuju modul Akademik berhasil ditemukan (${accessedViaDrawer ? "melalui drawer menu Lainnya" : "navigasi langsung"}).`,
        });

        await navAkademikMobile.click();
        await new Promise((r) => setTimeout(r, 600));

        recordAssertion(await assertNoHorizontalOverflow(page, "Akademik Mobile", vp.name));
        recordAssertion(await assertMobileBottomNav(page, "Akademik Mobile", vp.name, 'nav[data-testid="mobile-bottom-nav"]', { required: true }));
        recordAssertion(
          await assertTouchTargets(page, "Akademik Mobile", vp.name, [
            { selector: 'button[data-testid="subtab-input_nilai"]', label: "Subtab Input Nilai", required: true },
            { selector: 'button[data-testid="subtab-rapor"]', label: "Subtab Rapor Santri", required: true },
            { selector: 'button[data-testid="subtab-kepesantrenan"]', label: "Subtab Kepesantrenan", required: true },
          ])
        );
        recordAssertion(
          await assertHeaderOffset(page, "Akademik Mobile", vp.name, "h1, h2, h3", "header", { required: true })
        );

        const capAkademikMobile = await safeCapture(page, `qa_akademik_${vp.name}.png`, {
          capture: options.captureScreenshots,
          artifactDir,
          docsDir,
        });
        if (capAkademikMobile) capturedFiles.push(capAkademikMobile);

        // Subtab Rapor Santri Mobile (Data Terisi Stress Test)
        const subTabRaporMobile = await requireControl(
          page,
          'button[data-testid="subtab-rapor"]',
          "Subtab Rapor Santri Mobile",
          "Akademik Mobile",
          vp.name,
          recordAssertion
        );
        if (subTabRaporMobile) {
          await subTabRaporMobile.click();
          await new Promise((r) => setTimeout(r, 600));

          // Pilih santri stress test
          const selectSantriMobile = await requireControl(
            page,
            'select[data-testid="select-santri-rapor"]',
            "Selector Santri Rapor Mobile",
            "Akademik Mobile",
            vp.name,
            recordAssertion
          );
          if (selectSantriMobile) {
            await page.select('select[data-testid="select-santri-rapor"]', RAPOR_STRESS_FIXTURES.SANTRI_NIS);
            await new Promise((r) => setTimeout(r, 600));
          }

          recordAssertion(await assertNoHorizontalOverflow(page, "Akademik Mobile (Rapor Data)", vp.name));
          recordAssertion(
            await assertCriticalTextClipping(page, "Akademik Mobile (Rapor Data)", vp.name, [
              { selector: "h4, strong", label: "Judul Mapel Rapor Mobile", required: true },
            ])
          );

          const capRaporDataMobile = await safeCapture(
            page,
            `qa_akademik_rapor_data_${vp.name}.png`,
            {
              capture: options.captureScreenshots,
              artifactDir,
              docsDir,
            }
          );
          if (capRaporDataMobile) capturedFiles.push(capRaporDataMobile);

          // Jika viewport 360x800, buka Print Preview Modal di mobile
          if (vp.name === "mobile_360x800") {
            const btnCetakModalMobile = await requireControl(
              page,
              'button[data-testid="btn-cetak-rapor-modal"]',
              "Tombol Cetak Rapor Modal Mobile",
              "Modal Cetak Rapor Mobile",
              vp.name,
              recordAssertion
            );
            if (btnCetakModalMobile) {
              await btnCetakModalMobile.click();
              await new Promise((r) => setTimeout(r, 600));

              recordAssertion(await assertNoHorizontalOverflow(page, "Modal Cetak Rapor Mobile", vp.name));
              const capPrintMobile = await safeCapture(
                page,
                `qa_rapor_print_preview_mobile_360x800.png`,
                {
                  capture: options.captureScreenshots,
                  artifactDir,
                  docsDir,
                  fullPage: false,
                }
              );
              if (capPrintMobile) capturedFiles.push(capPrintMobile);

              const btnCloseMobile = await requireControl(
                page,
                'button[data-testid="btn-close-print-modal"]',
                "Tombol Tutup Modal Cetak Rapor Mobile",
                "Modal Cetak Rapor Mobile",
                vp.name,
                recordAssertion
              );
              if (btnCloseMobile) {
                await btnCloseMobile.click();
                await new Promise((r) => setTimeout(r, 400));
              }
            }
          }
        }
      }
    }

    // =========================================================================
    // C. LAPORAN & RINGKASAN QA
    // =========================================================================
    const totalChecks = allResults.length;
    const failedChecks = allResults.filter((r) => !r.passed).length;
    const passedChecks = totalChecks - failedChecks;

    console.log(`\n===============================================================`);
    console.log(`RINGKASAN HASIL QA STRUCTURAL & LAYOUT AUDIT`);
    console.log(`Total Quality Assertions : ${totalChecks}`);
    console.log(`Lolos (PASS)             : ${passedChecks}`);
    console.log(`Gagal / Finding (FAIL)   : ${failedChecks}`);
    console.log(`Screenshots Diambil      : ${capturedFiles.length}`);
    console.log(`===============================================================`);

    if (findings.length > 0) {
      console.log(`\n📋 TABEL TEMUAN VISUAL (VISUAL FINDINGS):`);
      console.log(formatFindingsTable(findings));
      console.log("\nCATATAN: Temuan dicatat sebagai finding QA dan TIDAK diubah desainnya pada PR #3 ini.");
    } else {
      console.log(`\n✅ Seluruh structural layout assertions PASS 100% tanpa finding!`);
    }

    if (failedChecks > 0 && options.failOnStructuralError) {
      throw new Error(`[QA_STRUCTURAL_FAILED] Terdapat ${failedChecks} assertion structural yang gagal!`);
    }

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      findings,
      screenshotsCaptured: capturedFiles,
    };
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
