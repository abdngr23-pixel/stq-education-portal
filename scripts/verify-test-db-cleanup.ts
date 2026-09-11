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

async function runCleanupCycle(cycleNumber: number, timeoutMs = 60000): Promise<void> {
  let timerId: NodeJS.Timeout | null = null;
  let cycleCompleted = false;
  let capturedPort: number | null = null;
  let capturedTempDir: string | null = null;
  let capturedMainPid: number | null = null;
  let capturedChildPids: number[] = [];

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`[TIMEOUT] Siklus ${cycleNumber} melebihi batas ${timeoutMs / 1000} detik!`));
    }, timeoutMs);
  });

  try {
    await Promise.race([
      (async () => {
        console.log(`\n================================================================`);
        console.log(`[SIKLUS ${cycleNumber}/3] Menjalankan Pengujian Siklus Start-Stop DB...`);
        console.log(`================================================================`);

        // 1. Start embedded PostgreSQL pada port dinamis
        const prisma = await startTestDatabase();
        verifyTestEnvironment();

        // 2. Catat port, temp directory, PID utama, dan child PID
        capturedPort = getActiveTestPort();
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

        // 4. Stop database
        console.log(`   Menghentikan database...`);
        const stopStart = Date.now();
        await stopTestDatabase();
        const stopDuration = Date.now() - stopStart;
        console.log(`   ✓ stopTestDatabase selesai dalam ${stopDuration}ms.`);

        // 5. Pastikan port tertutup
        const portStillOpen = await isPortInUse(capturedPort);
        if (portStillOpen) {
          throw new Error(`[FAIL] Port ${capturedPort} masih terbuka setelah stopTestDatabase!`);
        }
        console.log(`   ✓ Port ${capturedPort} terverifikasi tertutup.`);

        // 6. Pastikan semua PID milik instance sudah tidak aktif
        const allInstancePids = [capturedMainPid, ...capturedChildPids].filter((p): p is number => typeof p === "number" && p > 0);
        for (const pid of allInstancePids) {
          if (isPidRunning(pid)) {
            throw new Error(`[FAIL] PID ${pid} masih aktif setelah stopTestDatabase!`);
          }
        }
        console.log(`   ✓ Seluruh PID instance ([${allInstancePids.join(", ")}]) terverifikasi berhenti.`);

        // 7. Pastikan direktori temporer sudah terhapus
        if (fs.existsSync(capturedTempDir)) {
          throw new Error(`[FAIL] Direktori temporer ${capturedTempDir} masih ada setelah stopTestDatabase!`);
        }
        console.log(`   ✓ Direktori temporer terverifikasi terhapus.`);

        console.log(`   [SIKLUS ${cycleNumber}/3] LULUS 100%`);
        cycleCompleted = true;
      })(),
      timeoutPromise,
    ]);
  } finally {
    // Batalkan timer timeout agar tidak menahan Node event loop
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }

    // Jika terjadi timeout atau error sebelum teardown selesai, tetap panggil stopTestDatabase()
    if (!cycleCompleted) {
      console.log(`   [CLEANUP FINALLY] Siklus ${cycleNumber} tidak selesai normal, memanggil fallback stopTestDatabase()...`);
      try {
        await stopTestDatabase();
      } catch (cleanupErr: unknown) {
        const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        console.error(`   [CLEANUP FINALLY] Error saat stopTestDatabase di finally:`, msg);
      }

      // Verifikasi port, PID, dan folder temporer bersih setelah timeout/error
      const portToCheck = capturedPort ?? getActiveTestPort();
      if (portToCheck) {
        const portStillOpen = await isPortInUse(portToCheck);
        if (portStillOpen) {
          console.error(`   [FAIL FINALLY] Port ${portToCheck} masih terbuka setelah cleanup fallback!`);
        } else {
          console.log(`   ✓ Port ${portToCheck} terverifikasi tertutup pada cleanup fallback.`);
        }
      }

      const pidsToCheck = [capturedMainPid ?? getActiveMainPid(), ...capturedChildPids, ...getActiveDescendantPids()].filter(
        (p): p is number => typeof p === "number" && p > 0
      );
      for (const pid of pidsToCheck) {
        if (isPidRunning(pid)) {
          console.error(`   [FAIL FINALLY] PID ${pid} masih aktif setelah cleanup fallback!`);
        }
      }

      const tempDirToCheck = capturedTempDir ?? getActiveTempDir();
      if (tempDirToCheck && fs.existsSync(tempDirToCheck)) {
        console.error(`   [FAIL FINALLY] Direktori temporer ${tempDirToCheck} masih tersisa setelah cleanup fallback!`);
      } else if (tempDirToCheck) {
        console.log(`   ✓ Direktori temporer terverifikasi bersih pada cleanup fallback.`);
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
