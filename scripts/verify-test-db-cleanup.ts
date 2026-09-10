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

async function runCleanupCycle(cycleNumber: number) {
  console.log(`\n================================================================`);
  console.log(`[SIKLUS ${cycleNumber}/3] Menjalankan Pengujian Siklus Start-Stop DB...`);
  console.log(`================================================================`);

  // 1. Start embedded PostgreSQL pada port dinamis
  const prisma = await startTestDatabase();
  verifyTestEnvironment();

  // 2. Catat port, temp directory, PID utama, dan child PID
  const port = getActiveTestPort();
  const tempDir = getActiveTempDir();
  const mainPid = getActiveMainPid();
  const childPids = getActiveDescendantPids();

  console.log(`   Port: ${port}`);
  console.log(`   TempDir: ${tempDir}`);
  console.log(`   Main PID: ${mainPid}`);
  console.log(`   Child PIDs: [${childPids.join(", ")}]`);

  if (!tempDir || !fs.existsSync(tempDir)) {
    throw new Error(`[FAIL] Direktori temporer ${tempDir} tidak ditemukan setelah start!`);
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
  const portStillOpen = await isPortInUse(port);
  if (portStillOpen) {
    throw new Error(`[FAIL] Port ${port} masih terbuka setelah stopTestDatabase!`);
  }
  console.log(`   ✓ Port ${port} terverifikasi tertutup.`);

  // 6. Pastikan semua PID milik instance sudah tidak aktif
  const allInstancePids = [mainPid, ...childPids].filter((p): p is number => typeof p === "number" && p > 0);
  for (const pid of allInstancePids) {
    if (isPidRunning(pid)) {
      throw new Error(`[FAIL] PID ${pid} masih aktif setelah stopTestDatabase!`);
    }
  }
  console.log(`   ✓ Seluruh PID instance ([${allInstancePids.join(", ")}]) terverifikasi berhenti.`);

  // 7. Pastikan direktori temporer sudah terhapus
  if (fs.existsSync(tempDir)) {
    throw new Error(`[FAIL] Direktori temporer ${tempDir} masih ada setelah stopTestDatabase!`);
  }
  console.log(`   ✓ Direktori temporer terverifikasi terhapus.`);

  console.log(`   [SIKLUS ${cycleNumber}/3] LULUS 100%`);
}

async function main() {
  console.log("Memulai Verifikasi Cleanup PostgreSQL Test Terfokus (3 Siklus)...");
  const overallStart = Date.now();

  for (let i = 1; i <= 3; i++) {
    // Timeout per siklus: 35 detik
    await Promise.race([
      runCleanupCycle(i),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[TIMEOUT] Siklus ${i} melebihi batas 35 detik!`)), 35000)
      ),
    ]);
  }

  const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log(`\n🎉 SELURUH 3 SIKLUS VERIFIKASI CLEANUP LULUS DALAM ${totalTime}s!`);
  console.log("Proses Node dapat selesai secara normal tanpa dipaksa.");
}

main().catch((err) => {
  console.error("\n❌ VERIFIKASI CLEANUP GAGAL:", err.message);
  process.exit(1);
});
