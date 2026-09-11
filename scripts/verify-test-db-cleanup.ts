(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import fs from "fs";
import {
  startTestDatabase,
  stopTestDatabase,
  getActiveTestPort,
  getActiveTempDir,
  getActiveMainPid,
  getActiveDescendantPids,
  isPortInUse,
  isPidRunning,
  verifyTestEnvironment,
} from "../tests/test-db-manager";

function safeGetActivePort(): number | null {
  try {
    return getActiveTestPort();
  } catch {
    return null;
  }
}

async function runCleanupCycle(cycleNumber: number, timeoutMs = 60000): Promise<void> {
  console.log(`\n================================================================`);
  console.log(`[SIKLUS ${cycleNumber}/3] Menjalankan Pengujian Siklus Start-Stop DB...`);
  console.log(`================================================================`);

  let capturedPort: number | null = null;
  let capturedTempDir: string | null = null;
  let capturedMainPid: number | null = null;
  let capturedChildPids: number[] = [];
  let isDbStarted = false;
  let isDbStopping = false;
  let isDbStopped = false;
  let cycleCompleted = false;

  const safeStop = async () => {
    if (!isDbStarted || isDbStopped || isDbStopping) return;
    isDbStopping = true;
    try {
      await stopTestDatabase();
      isDbStopped = true;
    } finally {
      isDbStopping = false;
    }
  };

  let timerId: NodeJS.Timeout | null = null;
  let timeoutTriggered = false;

  const cycleExecution = (async () => {
    // 1. Start embedded PostgreSQL pada port dinamis
    const prisma = await startTestDatabase();
    isDbStarted = true;
    verifyTestEnvironment();

    // 2. Catat metadata instance secara aman
    capturedPort = safeGetActivePort();
    capturedTempDir = getActiveTempDir();
    capturedMainPid = getActiveMainPid();
    capturedChildPids = getActiveDescendantPids();

    console.log(`   Port: ${capturedPort}`);
    console.log(`   TempDir: ${capturedTempDir}`);
    console.log(`   Main PID: ${capturedMainPid}`);
    console.log(`   Child PIDs: [${capturedChildPids.join(", ")}]`);

    if (!capturedTempDir || !fs.existsSync(capturedTempDir)) {
      throw new Error(`[FAIL] Direktori temporer ${capturedTempDir} tidak ditemukan setelah start!`);
    }

    // 3. Pastikan koneksi database berhasil via Prisma query
    const testQuery = await prisma.$queryRawUnsafe<{ result: number }[]>("SELECT 1 as result");
    if (!testQuery || testQuery[0]?.result !== 1) {
      throw new Error(`[FAIL] Query test ke database gagal: ${JSON.stringify(testQuery)}`);
    }
    console.log(`   ✓ Koneksi dan query database berhasil.`);

    // Cegah stop ganda jika timeout terpicu saat query berlangsung
    if (timeoutTriggered) {
      throw new Error(`[TIMEOUT] Siklus ${cycleNumber} melebihi batas waktu ${timeoutMs / 1000}s.`);
    }

    // 4. Stop database
    console.log(`   Menghentikan database...`);
    const stopStart = Date.now();
    await safeStop();
    const stopDuration = Date.now() - stopStart;
    console.log(`   ✓ stopTestDatabase selesai dalam ${stopDuration}ms.`);

    // 5. Pastikan port tertutup
    if (capturedPort) {
      const portStillOpen = await isPortInUse(capturedPort);
      if (portStillOpen) {
        throw new Error(`[FAIL] Port ${capturedPort} masih terbuka setelah stopTestDatabase!`);
      }
      console.log(`   ✓ Port ${capturedPort} terverifikasi tertutup.`);
    }

    // 6. Pastikan semua PID milik instance sudah tidak aktif
    const allInstancePids = [capturedMainPid, ...capturedChildPids].filter(
      (p): p is number => typeof p === "number" && p > 0
    );
    for (const pid of allInstancePids) {
      if (isPidRunning(pid)) {
        throw new Error(`[FAIL] PID ${pid} masih aktif setelah stopTestDatabase!`);
      }
    }
    console.log(`   ✓ Seluruh PID instance ([${allInstancePids.join(", ")}]) terverifikasi berhenti.`);

    // 7. Pastikan direktori temporer sudah terhapus
    if (capturedTempDir && fs.existsSync(capturedTempDir)) {
      throw new Error(`[FAIL] Direktori temporer ${capturedTempDir} masih ada setelah stopTestDatabase!`);
    }
    console.log(`   ✓ Direktori temporer terverifikasi terhapus.`);

    console.log(`   [SIKLUS ${cycleNumber}/3] LULUS 100%`);
    cycleCompleted = true;
  })();

  const timeoutPromise = new Promise<void>((_, reject) => {
    timerId = setTimeout(() => {
      timeoutTriggered = true;
      reject(new Error(`[TIMEOUT] Siklus ${cycleNumber} melebihi batas waktu ${timeoutMs / 1000} detik!`));
    }, timeoutMs);
  });

  try {
    await Promise.race([cycleExecution, timeoutPromise]);
  } catch (err: unknown) {
    console.error(`   [ERROR SIKLUS ${cycleNumber}]:`, err instanceof Error ? err.message : String(err));
    // Jangan langsung stopTestDatabase() jika siklus sedang dalam proses stop; tunggu cycleExecution settle
    try {
      await cycleExecution.catch(() => {});
    } catch {}
    await safeStop();
    throw err;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }

    // Jika siklus belum selesai normal, verifikasi pembersihan dan pastikan exit code nonzero bila ada kebocoran
    if (!cycleCompleted) {
      console.log(`   [VERIFIKASI TEARDOWN GAGAL] Memeriksa status sumber daya yang tertinggal...`);
      let lingeringResourceFound = false;

      const portToCheck = capturedPort ?? safeGetActivePort();
      if (portToCheck) {
        const portStillOpen = await isPortInUse(portToCheck);
        if (portStillOpen) {
          console.error(`   [FATAL RESOURCE LEAK] Port ${portToCheck} masih terbuka setelah kegagalan!`);
          lingeringResourceFound = true;
        } else {
          console.log(`   ✓ Port ${portToCheck} terverifikasi tertutup.`);
        }
      }

      const pidsToCheck = [
        capturedMainPid ?? getActiveMainPid(),
        ...capturedChildPids,
        ...getActiveDescendantPids(),
      ].filter((p): p is number => typeof p === "number" && p > 0);

      for (const pid of pidsToCheck) {
        if (isPidRunning(pid)) {
          console.error(`   [FATAL RESOURCE LEAK] PID ${pid} masih aktif setelah kegagalan!`);
          lingeringResourceFound = true;
        }
      }

      const tempDirToCheck = capturedTempDir ?? getActiveTempDir();
      if (tempDirToCheck && fs.existsSync(tempDirToCheck)) {
        console.error(`   [FATAL RESOURCE LEAK] Direktori temporer ${tempDirToCheck} masih tersisa setelah kegagalan!`);
        lingeringResourceFound = true;
      }

      if (lingeringResourceFound) {
        throw new Error(
          `[VERIFIKASI CLEANUP GAGAL] Sumber daya (port/PID/folder) masih tersisa setelah siklus ${cycleNumber} gagal!`
        );
      }
    }
  }
}

async function main() {
  console.log("Memulai Verifikasi Cleanup PostgreSQL Test Terfokus (3 Siklus)...");
  const overallStart = Date.now();

  for (let i = 1; i <= 3; i++) {
    await runCleanupCycle(i, 60000);
  }

  const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log(`\n🎉 SELURUH 3 SIKLUS VERIFIKASI CLEANUP LULUS DALAM ${totalTime}s!`);
  console.log("Proses Node dapat selesai secara normal tanpa dipaksa.");
}

main().catch((err) => {
  console.error("\n❌ VERIFIKASI CLEANUP GAGAL:", err.message);
  process.exit(1);
});
