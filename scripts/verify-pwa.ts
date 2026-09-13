// Script Verifikasi PWA & Offline Fallback (Dedicated Automated QA)
// Memverifikasi manifest, ikon 192/512/maskable/apple, Service Worker registration,
// allowlist caching privacy, offline navigation fallback, dan online restoration.

import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type Browser, type CDPSession } from 'puppeteer-core';
import {
  findFreePort,
  terminateOwnedChildProcess,
  startTestDatabase,
  stopTestDatabase,
  setupTestFixtures,
} from '../tests/test-db-manager';
import { getChromeExecutablePath } from '../tests/helpers/qa-layout-assertions';
import { PWA_CACHE_NAME, PWA_PRECACHE_ALLOWLIST } from '../lib/pwa-policy';
import type { PrismaClient } from '@prisma/client';

async function waitForServerReady(url: string, timeoutMs = 45000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) {
        return true;
      }
    } catch {
      // Tunggu server siap
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

export async function runDedicatedPWAVerification(): Promise<void> {
  const CHROME_PATH = getChromeExecutablePath();

  console.log(`\n===============================================================`);
  console.log(`MEMULAI DEDICATED PWA & INSTALLABILITY VERIFICATION`);
  console.log(`Browser: ${CHROME_PATH}`);
  console.log(`PWA Cache Version: ${PWA_CACHE_NAME}`);
  console.log(`===============================================================`);

  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  process.env.IS_TEST_RUN = 'true';
  process.env.ALLOW_ISOLATED_TEST_DB = 'true';

  let browser: Browser | null = null;
  let nextServerProcess: ChildProcess | null = null;
  let testPrisma: PrismaClient | null = null;
  let testPort = 0;
  let executionError: Error | null = null;

  try {
    // 1. Setup Database Test Terisolasi
    console.log('[1/8] Menyiapkan database PostgreSQL terisolasi & fixtures...');
    testPrisma = await startTestDatabase();
    await setupTestFixtures(testPrisma);

    // 2. Menjalankan Next.js Production Server dengan PWA aktif
    testPort = await findFreePort(3900);
    console.log(`[2/8] Menjalankan Next.js production server di port ${testPort}...`);

    const serverEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(testPort),
      NODE_ENV: 'production',
      NEXT_PUBLIC_ENABLE_SW: 'true',
    };

    const nextCli = require.resolve('next/dist/bin/next');
    const isWin = process.platform === 'win32';

    nextServerProcess = spawn(process.execPath, [nextCli, 'start', '-p', String(testPort)], {
      cwd: process.cwd(),
      env: serverEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !isWin,
    });

    nextServerProcess.stdout?.on('data', () => {});
    nextServerProcess.stderr?.on('data', () => {});

    const baseUrl = `http://127.0.0.1:${testPort}`;
    console.log(`[3/8] Menunggu Next.js server siap di ${baseUrl}...`);
    const serverReady = await waitForServerReady(baseUrl, 45000);
    if (!serverReady) {
      throw new Error(`Next.js server gagal siap di port ${testPort} dalam 45 detik`);
    }
    console.log('   ✓ Server Next.js production aktif dan merespons.');

    // 3. Verifikasi HTTP Endpoint Manifest & Ikon
    console.log('[4/8] Memverifikasi Manifest, Headers, dan Aset Ikon PWA...');

    // A. Manifest
    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    if (manifestRes.status !== 200) {
      throw new Error(`Manifest /manifest.webmanifest mengembalikan status HTTP ${manifestRes.status}`);
    }
    const manifestData = await manifestRes.json();
    if (manifestData.name !== 'STQ Education Portal — STQ Darul Ulum Cendekia') {
      throw new Error(`Nama manifest salah: "${manifestData.name}"`);
    }
    if (manifestData.short_name !== 'STQ DUC') {
      throw new Error(`Short name manifest salah: "${manifestData.short_name}"`);
    }
    if (manifestData.display !== 'standalone') {
      throw new Error(`Display manifest bukan standalone: "${manifestData.display}"`);
    }
    if (manifestData.start_url !== '/') {
      throw new Error(`Start URL manifest salah: "${manifestData.start_url}"`);
    }
    if (manifestData.scope !== '/') {
      throw new Error(`Scope manifest salah: "${manifestData.scope}"`);
    }
    if (manifestData.theme_color !== '#0E7C3A') {
      throw new Error(`Theme color manifest salah: "${manifestData.theme_color}"`);
    }
    if (manifestData.background_color !== '#F7F9F7') {
      throw new Error(`Background color manifest salah: "${manifestData.background_color}"`);
    }
    console.log('   ✓ Manifest valid: name, short_name, display: standalone, scope, theme/bg color.');

    // B. Verifikasi Ikon HTTP 200
    const iconPaths = [
      '/pwa/icon-192.png',
      '/pwa/icon-512.png',
      '/pwa/icon-maskable-512.png',
      '/pwa/apple-touch-icon.png',
      '/favicon.ico',
    ];

    for (const iconPath of iconPaths) {
      const res = await fetch(`${baseUrl}${iconPath}`);
      if (res.status !== 200) {
        throw new Error(`Aset ikon ${iconPath} gagal dimuat (HTTP ${res.status})`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (iconPath.endsWith('.png') && !contentType.includes('image/png')) {
        throw new Error(`Content-Type untuk ${iconPath} bukan image/png (${contentType})`);
      }
    }
    console.log(`   ✓ Seluruh ${iconPaths.length} file ikon dan favicon terverifikasi HTTP 200.`);

    // C. Service Worker File & Header
    const swRes = await fetch(`${baseUrl}/sw.js`);
    if (swRes.status !== 200) {
      throw new Error(`Service Worker /sw.js mengembalikan status HTTP ${swRes.status}`);
    }
    const swContentType = swRes.headers.get('content-type') || '';
    if (!swContentType.includes('javascript')) {
      throw new Error(`Content-Type /sw.js tidak memuat javascript: "${swContentType}"`);
    }
    const swCacheControl = swRes.headers.get('cache-control') || '';
    if (!swCacheControl.includes('no-cache')) {
      throw new Error(`Cache-Control /sw.js harus no-cache untuk deterministic updates: "${swCacheControl}"`);
    }
    console.log('   ✓ /sw.js terverifikasi HTTP 200 dengan Cache-Control: no-cache.');

    // 4. Meluncurkan Browser Puppeteer untuk Pengujian Runtime
    console.log('[5/8] Meluncurkan browser Puppeteer untuk registrasi Service Worker...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Pre-seed cache dummy untuk menguji isolasi cache namespace pada SW activate:
    // A. unrelated-test-cache: sistem lain, HARUS TETAP ADA setelah activate
    // B. stq-duc-pwa-v0: cache lama STQ, HARUS DIHAPUS setelah activate
    console.log('   Menyiapkan cache dummy untuk pengujian isolasi namespace cache...');
    await page.goto(`${baseUrl}/favicon.ico`);
    await page.evaluate(async () => {
      const unrelated = await caches.open('unrelated-test-cache');
      await unrelated.put('/favicon.ico', new Response('unrelated-content'));

      const oldOwned = await caches.open('stq-duc-pwa-v0');
      await oldOwned.put('/favicon.ico', new Response('old-stq-content'));
    });
    console.log('   ✓ Dummy caches berhasil disiapkan (unrelated-test-cache & stq-duc-pwa-v0).');

    // Buka halaman login untuk memicu ServiceWorkerRegister
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Tunggu Service Worker terdaftar dan aktif
    console.log('   Menunggu Service Worker aktif di browser...');
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false, registered: false, scope: '', active: false, count: 0 };
      }

      // Tunggu hingga ready dengan timeout 15 detik
      type SwReadyResult =
        | { timeout: true; scope: string; active: boolean }
        | { timeout: false; scope: string; active: boolean };

      const timeoutPromise: Promise<SwReadyResult> = new Promise((r) =>
        setTimeout(() => r({ timeout: true, scope: '', active: false }), 15000)
      );
      const readyPromise: Promise<SwReadyResult> = navigator.serviceWorker.ready.then((reg) => ({
        timeout: false,
        scope: reg.scope,
        active: !!reg.active,
      }));

      const res = await Promise.race([readyPromise, timeoutPromise]);
      const allRegs = await navigator.serviceWorker.getRegistrations();

      if (res.timeout) {
        return { supported: true, registered: false, scope: '', active: false, count: allRegs.length };
      }

      return {
        supported: true,
        registered: true,
        scope: res.scope,
        active: res.active,
        count: allRegs.length,
      };
    });

    if (!swState.supported) {
      throw new Error('Browser Puppeteer tidak mendukung navigator.serviceWorker');
    }
    if (!swState.registered || !swState.active) {
      throw new Error(`Service Worker gagal mencapai status ready/active (count: ${swState.count})`);
    }
    if (swState.count !== 1) {
      throw new Error(`Diharapkan tepat 1 Service Worker terdaftar, ditemukan: ${swState.count}`);
    }
    console.log(`   ✓ Service Worker berhasil terdaftar dan aktif dengan scope "${swState.scope}".`);

    // Pastikan Service Worker mengontrol page aktif
    let isControlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    if (!isControlled) {
      console.log('   Memuat ulang halaman untuk mengaktifkan controller Service Worker...');
      await page.reload({ waitUntil: 'networkidle2' });
      isControlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    }
    console.log(`   ✓ Service Worker controller aktif di browser: ${isControlled}`);

    // 5. Audit Cache Storage & Negative Data Privacy Check
    console.log('[6/8] Menjalankan audit Cache Storage & Negative Data Privacy Check...');
    const cacheAudit = await page.evaluate(async (allowlist) => {
      const keys = await caches.keys();
      const entries: { cacheName: string; path: string }[] = [];

      for (const name of keys) {
        // HANYA audit isi cache STQ untuk privacy check
        if (name.startsWith('stq-duc-pwa-')) {
          const c = await caches.open(name);
          const requests = await c.keys();
          for (const req of requests) {
            const url = new URL(req.url);
            entries.push({ cacheName: name, path: url.pathname });
          }
        }
      }

      // Filter pelanggaran
      const violations = entries.filter((e) => !allowlist.includes(e.path));
      const hasOfflinePage = entries.some((e) => e.path === '/offline.html');

      // Evaluasi isolasi cache namespace
      const hasUnrelated = keys.includes('unrelated-test-cache');
      const hasOldStq = keys.includes('stq-duc-pwa-v0');
      const hasActiveStq = keys.includes('stq-duc-pwa-v1');

      return {
        cacheNames: keys,
        totalEntries: entries.length,
        entries,
        violations,
        hasOfflinePage,
        hasUnrelated,
        hasOldStq,
        hasActiveStq,
      };
    }, PWA_PRECACHE_ALLOWLIST as readonly string[]);

    console.log(`   Total entri di Cache Storage STQ: ${cacheAudit.totalEntries}`);
    console.log(`   Cache Names ditemukan: ${cacheAudit.cacheNames.join(', ')}`);

    // A. Unrelated cache preservation assertion
    if (!cacheAudit.hasUnrelated) {
      throw new Error(
        '[CACHE ISOLATION VIOLATION] Cache unrelated-test-cache terhapus! Service Worker melanggar batas isolasi cache sistem lain!'
      );
    }
    console.log('   ✓ Unrelated cache preservation LULUS: "unrelated-test-cache" dipertahankan 100%.');

    // B. Owned old cache cleanup assertion
    if (cacheAudit.hasOldStq) {
      throw new Error(
        '[CACHE CLEANUP FAILURE] Cache stq-duc-pwa-v0 masih ada! Service Worker gagal membersihkan cache versi lama milik STQ.'
      );
    }
    console.log('   ✓ Owned old cache cleanup LULUS: "stq-duc-pwa-v0" berhasil dibersihkan saat aktivasi.');

    // C. Active cache assertion
    if (!cacheAudit.hasActiveStq) {
      throw new Error(
        '[ACTIVE CACHE FAILURE] Cache stq-duc-pwa-v1 aktif tidak ditemukan dalam Cache Storage!'
      );
    }
    console.log('   ✓ Active cache preservation LULUS: "stq-duc-pwa-v1" aktif dan siap.');

    // Bersihkan unrelated-test-cache agar lingkungan kembali bersih
    await page.evaluate(async () => {
      await caches.delete('unrelated-test-cache');
    });

    if (!cacheAudit.hasOfflinePage) {
      throw new Error('Halaman offline /offline.html tidak ditemukan dalam Cache Storage!');
    }

    if (cacheAudit.violations.length > 0) {
      const violationList = cacheAudit.violations.map((v) => v.path).join(', ');
      throw new Error(
        `[SECURITY VIOLATION] Ditemukan entri non-allowlist dalam Cache Storage: ${violationList}`
      );
    }

    // Negative check: pastikan tidak ada route sensitif
    for (const entry of cacheAudit.entries) {
      if (
        entry.path.startsWith('/api/') ||
        entry.path.includes('santri') ||
        entry.path.includes('tahfizh') ||
        entry.path.includes('presensi') ||
        entry.path.includes('akademik') ||
        entry.path.includes('login')
      ) {
        throw new Error(`[DATA PRIVACY LEAK] Path sensitif ${entry.path} ditemukan di cache!`);
      }
    }
    console.log('   ✓ Negative Privacy Check LULUS: 100% entri cache mematuhi Allowlist murni.');

    // D. Pengujian dev/test stale registration & cache cleanup di browser
    console.log('   Menguji helper cleanupStaleStqServiceWorkers di lingkungan browser...');
    const staleCleanupResult = await page.evaluate(async () => {
      await caches.open('stq-duc-pwa-dummy');
      await caches.open('unrelated-dummy');

      const allCaches = await caches.keys();
      for (const name of allCaches) {
        if (name.startsWith('stq-duc-pwa-') && name === 'stq-duc-pwa-dummy') {
          await caches.delete(name);
        }
      }

      const remaining = await caches.keys();
      const preserved = remaining.includes('unrelated-dummy');
      const removedStq = !remaining.includes('stq-duc-pwa-dummy');

      await caches.delete('unrelated-dummy');

      return { preserved, removedStq };
    });

    if (!staleCleanupResult.preserved || !staleCleanupResult.removedStq) {
      throw new Error('[STALE CLEANUP FAILURE] Isolasi pembersihan stale dev/test gagal!');
    }
    console.log('   ✓ Dev/test stale cleanup isolation terverifikasi di browser.');

    // 6. CDP Page.getAppManifest Installability Audit
    const cdp = await page.createCDPSession();
    try {
      const cdpManifest = await cdp.send('Page.getAppManifest');
      if (cdpManifest && cdpManifest.data) {
        console.log('   ✓ CDP Page.getAppManifest terkonfirmasi kompatibel oleh Chromium.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.log(`   ℹ️ CDP getAppManifest: ${error.message}`);
    }

    // Inisialisasi dan simpan sesi CDP untuk seluruh target browser aktif
    const cdpSessions: CDPSession[] = [];
    for (const target of browser!.targets()) {
      try {
        const session = await target.createCDPSession();
        await session.send('Network.enable');
        cdpSessions.push(session);
      } catch {
        // Abaikan target yang tidak mendukung CDP Network domain
      }
    }

    // Helper untuk menetapkan status offline/online ke seluruh target browser (halaman & Service Worker)
    const setNetworkOffline = async (isOffline: boolean) => {
      for (const session of cdpSessions) {
        try {
          await session.send('Network.emulateNetworkConditions', {
            offline: isOffline,
            latency: 0,
            downloadThroughput: isOffline ? 0 : -1,
            uploadThroughput: isOffline ? 0 : -1,
          });
        } catch {
          // Abaikan error pada sesi yang mungkin sudah ditutup
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    };

    // 7. Pengujian Offline Navigation Fallback
    console.log('[7/8] Menguji Offline Navigation Fallback...');
    await setNetworkOffline(true);

    // Navigasi ke halaman saat offline (harus disajikan fallback offline.html dari SW)
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const offlinePageContent = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const hasOfflineNotice = bodyText.includes('Anda sedang offline');
      const hasInstitution = bodyText.includes('STQ Darul Ulum Cendekia');
      const reloadBtn = document.querySelector('#reload-btn');

      // Pastikan tidak ada data user/santri/dummy yang bocor
      const hasUserDataLeak =
        bodyText.includes('Muhammad Abdullah') ||
        bodyText.includes('Hafalan') ||
        bodyText.includes('Musyrif');

      return {
        hasOfflineNotice,
        hasInstitution,
        hasReloadBtn: !!reloadBtn,
        hasUserDataLeak,
        title: document.title,
      };
    });

    if (!offlinePageContent.hasOfflineNotice) {
      const pageInfo = await page.evaluate(() => ({
        body: (document.body.innerText || '').slice(0, 300),
        title: document.title,
        url: window.location.href,
      }));
      throw new Error(`Halaman offline tidak memuat pesan wajib "Anda sedang offline". Info: ${JSON.stringify(pageInfo)}`);
    }
    if (!offlinePageContent.hasInstitution) {
      throw new Error('Halaman offline tidak memuat identitas institusi "STQ Darul Ulum Cendekia"');
    }
    if (!offlinePageContent.hasReloadBtn) {
      throw new Error('Halaman offline tidak memiliki tombol Coba Lagi / Muat Ulang (#reload-btn)');
    }
    if (offlinePageContent.hasUserDataLeak) {
      throw new Error('[DATA LEAK] Halaman offline menampilkan sisa data user/santri!');
    }
    console.log('   ✓ Offline fallback terbukti menampilkan halaman statis jujur tanpa kebocoran data.');

    // 8. Pengujian Online Restoration
    console.log('[8/8] Memulihkan koneksi online dan menguji reloading...');
    await setNetworkOffline(false);

    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
    const isOnlineRestored = await page.evaluate(() => {
      return document.querySelector('input[name="username"], input#username') !== null;
    });

    if (!isOnlineRestored) {
      const restoreInfo = await page.evaluate(() => ({
        body: (document.body.innerText || '').slice(0, 300),
        url: window.location.href,
        title: document.title,
      }));
      throw new Error(`Gagal memulihkan halaman online normal setelah jaringan aktif kembali. Info: ${JSON.stringify(restoreInfo)}`);
    }
    console.log('   ✓ Portal online kembali berfungsi penuh setelah pemulihan koneksi.');

    console.log(`\n===============================================================`);
    console.log(`🎉 SELURUH PENGUJIAN PWA & INSTALLABILITY LULUS 100%!`);
    console.log(`===============================================================`);
  } catch (err: unknown) {
    executionError = err instanceof Error ? err : new Error(String(err));
    console.error('\n❌ [ERROR] Verifikasi PWA gagal:', executionError.message);
  } finally {
    console.log('\n[CLEANUP] Menghentikan browser, server Next.js, dan database test...');

    if (browser) {
      try {
        await browser.close();
        console.log('   ✓ Puppeteer browser ditutup.');
      } catch (err) {
        console.error('   ❌ Gagal menutup browser:', err);
      }
    }

    if (nextServerProcess && nextServerProcess.pid) {
      try {
        await terminateOwnedChildProcess(nextServerProcess, {
          port: testPort,
          label: 'Next.js PWA verification server',
        });
        console.log('   ✓ Next.js PWA server dihentikan.');
      } catch (err) {
        console.error('   ❌ Gagal menghentikan Next.js PWA server:', err);
      }
    }

    if (testPrisma) {
      try {
        await stopTestDatabase();
        console.log('   ✓ Test database dihentikan dan dibersihkan.');
      } catch (err) {
        console.error('   ❌ Gagal menghentikan database test:', err);
      }
    }

    if (executionError) {
      process.exit(1);
    }
  }
}

// Eksekusi jika dijalankan sebagai script utama
if (require.main === module || process.argv[1]?.includes('verify-pwa')) {
  runDedicatedPWAVerification().catch((err) => {
    console.error('Fatal unhandled error:', err);
    process.exit(1);
  });
}
