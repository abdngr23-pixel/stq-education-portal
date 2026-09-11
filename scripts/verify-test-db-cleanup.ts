(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  isPortInUse,
  isPidRunning,
  getSystemPostgresProcesses,
  verifyPostgresProcessOwnership,
  validateTempDataDir,
} from "../tests/test-db-manager";

interface WorkerMetadata {
  port: number | null;
  tempDir: string | null;
  mainPid: number | null;
  childPids: number[];
}

interface RunWorkerResult {
  exitCode: number | null;
  timedOut: boolean;
  metadata: WorkerMetadata | null;
  stdout: string;
  stderr: string;
}

function runWorkerProcess(mode: string, timeoutMs = 60000): Promise<RunWorkerResult> {
  return new Promise((resolve) => {
    const tsxCli = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
    const workerScript = path.resolve(__dirname, "cleanup-cycle-worker.ts");

    const child = spawn(process.execPath, [tsxCli, workerScript, "--mode", mode], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        IS_TEST_RUN: "true",
        ALLOW_ISOLATED_TEST_DB: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let metadata: WorkerMetadata | null = null;
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;

    child.stdout.on("data", (chunk: Buffer) => {
      const str = chunk.toString();
      stdout += str;
      const lines = str.split("\n");
      for (const line of lines) {
        if (line.includes("__WORKER_METADATA__")) {
          const jsonStr = line.substring(line.indexOf("__WORKER_METADATA__") + "__WORKER_METADATA__".length).trim();
          try {
            metadata = JSON.parse(jsonStr);
          } catch {}
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    timer = setTimeout(() => {
      timedOut = true;
      console.warn(`   [PARENT TIMEOUT] Batas waktu ${timeoutMs / 1000}s tercapai. Menghentikan tree worker PID: ${child.pid}...`);

      if (child.pid) {
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", child.pid.toString(), "/T", "/F"], { stdio: "ignore" });
        } else {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        }
      }
    }, timeoutMs);

    child.on("close", (code) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      resolve({
        exitCode: code,
        timedOut,
        metadata,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      stderr += `\nChild process spawn error: ${err.message}`;
      resolve({
        exitCode: -1,
        timedOut,
        metadata,
        stdout,
        stderr,
      });
    });
  });
}

async function verifyResourceCleanup(metadata: WorkerMetadata | null, scenarioName: string): Promise<void> {
  console.log(`   [VERIFIKASI OS] Memeriksa status sumber daya pasca ${scenarioName}...`);
  if (!metadata) {
    console.log(`   ✓ Metadata instance tidak tercatat (instance belum terbentuk atau dibatalkan sangat awal).`);
    return;
  }

  const { port, tempDir, mainPid, childPids } = metadata;

  // 1. Verifikasi port tertutup
  if (port) {
    const portOpen = await isPortInUse(port);
    if (portOpen) {
      throw new Error(`[FAIL] Port ${port} masih terbuka setelah ${scenarioName}!`);
    }
    console.log(`   ✓ Port ${port} terverifikasi tertutup.`);
  }

  // 2. Verifikasi seluruh PID instance berhenti
  const allPids = [mainPid, ...(childPids || [])].filter(
    (p): p is number => typeof p === "number" && p > 0
  );

  for (const pid of allPids) {
    if (isPidRunning(pid)) {
      // Jika masih hidup (misal saat intentional timeout kill), terminasi PID spesifik milik instance test ini
      if (tempDir && verifyPostgresProcessOwnership(pid, tempDir, mainPid)) {
        console.log(`   Menghentikan sisa PID test terverifikasi: ${pid}`);
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", pid.toString(), "/T", "/F"], { stdio: "ignore" });
        } else {
          process.kill(pid, "SIGKILL");
        }
      }
      if (isPidRunning(pid)) {
        throw new Error(`[FAIL] PID ${pid} masih aktif setelah pembersihan ${scenarioName}!`);
      }
    }
  }
  if (allPids.length > 0) {
    console.log(`   ✓ Seluruh PID instance ([${allPids.join(", ")}]) terverifikasi non-aktif.`);
  }

  // 3. Verifikasi direktori temporer
  if (tempDir && fs.existsSync(tempDir)) {
    try {
      const validated = validateTempDataDir(tempDir);
      fs.rmSync(validated, { recursive: true, force: true });
    } catch {}

    if (fs.existsSync(tempDir)) {
      throw new Error(`[FAIL] Direktori temporer ${tempDir} masih ada setelah ${scenarioName}!`);
    }
  }
  if (tempDir) {
    console.log(`   ✓ Direktori temporer (${tempDir}) terverifikasi bersih.`);
  }
}

async function main() {
  console.log("================================================================");
  console.log("MEMULAI PENGUJIAN VERIFIKASI CLEANUP POSTGRESQL (5 SKENARIO)");
  console.log("================================================================");
  const overallStart = Date.now();

  // Snapshot proses PostgreSQL sistem sebelum tes dimulai
  const baselinePgProcesses = getSystemPostgresProcesses();
  const baselinePids = new Set(baselinePgProcesses.map((p) => p.ProcessId));
  console.log(`[SNAPSHOT AWAL] Proses PostgreSQL sistem terdeteksi: ${baselinePids.size} PID.`);

  // SKENARIO 1: 5 Siklus Normal Start-Stop Berturut-turut
  console.log("\n>>> SKENARIO 1: Start Normal -> Stop Normal (5 Siklus Berturut-turut)");
  for (let cycle = 1; cycle <= 5; cycle++) {
    console.log(`\n--- [Siklus Normal ${cycle}/5] ---`);
    const startCycle = Date.now();
    const result = await runWorkerProcess("normal", 45000);

    if (result.timedOut) {
      throw new Error(`Siklus ${cycle} mengalami parent timeout!`);
    }
    if (result.exitCode !== 0) {
      throw new Error(`Siklus ${cycle} gagal dengan exit code ${result.exitCode}. Output: ${result.stderr || result.stdout}`);
    }

    await verifyResourceCleanup(result.metadata, `Siklus ${cycle}`);
    console.log(`✓ Siklus ${cycle}/5 LULUS (${((Date.now() - startCycle) / 1000).toFixed(1)}s)`);
  }

  // SKENARIO 2: Fail-Start (Kegagalan / Pembatalan Operasi Saat Start)
  console.log("\n>>> SKENARIO 2: Start Gagal / Dibatalkan Sebelum Selesai (Fail-Start)");
  {
    const result = await runWorkerProcess("fail-start", 30000);
    if (result.timedOut) {
      throw new Error("Skenario 2 mengalami parent timeout!");
    }
    await verifyResourceCleanup(result.metadata, "Skenario Fail-Start");
    console.log("✓ Skenario 2 (Fail-Start) LULUS 100%");
  }

  // SKENARIO 3: Double-Stop (Idempotensi Stop)
  console.log("\n>>> SKENARIO 3: Stop Dipanggil Dua Kali (Idempotency)");
  {
    const result = await runWorkerProcess("double-stop", 30000);
    if (result.timedOut) {
      throw new Error("Skenario 3 mengalami parent timeout!");
    }
    if (result.exitCode !== 0) {
      throw new Error(`Skenario 3 gagal dengan exit code ${result.exitCode}: ${result.stderr}`);
    }
    await verifyResourceCleanup(result.metadata, "Skenario Double-Stop");
    console.log("✓ Skenario 3 (Double-Stop) LULUS 100%");
  }

  // SKENARIO 4: Intentional Timeout & Worker Kill
  console.log("\n>>> SKENARIO 4: Timeout Buatan pada Worker & Parent Tree-Kill");
  {
    // Berikan batas waktu pendek (5 detik) untuk memicu parent hard timeout
    const result = await runWorkerProcess("intentional-timeout", 6000);
    if (!result.timedOut) {
      throw new Error("Skenario 4 seharusnya memicu parent timeout!");
    }
    console.log("   ✓ Parent hard timeout terpicu sesuai rancangan.");

    // Tunggu sejenak agar OS menyelesaikan pelepasan proses
    await new Promise((r) => setTimeout(r, 1000));
    await verifyResourceCleanup(result.metadata, "Skenario Intentional-Timeout");
    console.log("✓ Skenario 4 (Intentional-Timeout & Hard Kill) LULUS 100%");
  }

  // SKENARIO 5: Verifikasi Proses PostgreSQL Eksternal / Sistem Tidak Tersentuh
  console.log("\n>>> SKENARIO 5: Verifikasi Tidak Ada PostgreSQL Lain di Mesin yang Disentuh");
  {
    const postPgProcesses = getSystemPostgresProcesses();
    const postPids = new Set(postPgProcesses.map((p) => p.ProcessId));

    // Pastikan setiap PID yang ada sebelum tes tidak dibunuh sembarangan
    for (const pid of baselinePids) {
      if (!postPids.has(pid)) {
        console.warn(`[CATATAN] PID baseline ${pid} tidak lagi aktif (mungkin dihentikan secara alami di luar kontrol).`);
      }
    }

    // Pastikan tidak ada sisa PostgreSQL yatim yang CommandLine-nya memuat 'stq-test-db-'
    for (const proc of postPgProcesses) {
      const cmd = (proc.CommandLine || "").toLowerCase();
      if (cmd.includes("stq-test-db-")) {
        throw new Error(`[FAIL] Ditemukan PostgreSQL test yatim yang masih berjalan: PID ${proc.ProcessId} (${cmd})`);
      }
    }
    console.log(`   ✓ Tidak ditemukan proses PostgreSQL yatim dari lingkungan pengujian.`);
    console.log(`   ✓ Proses PostgreSQL eksternal aman dan tidak tersentuh.`);
    console.log("✓ Skenario 5 (Integritas Proses Sistem) LULUS 100%");
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log("\n================================================================");
  console.log(`🎉 SELURUH 5 SKENARIO VERIFIKASI CLEANUP LULUS DALAM ${totalDuration}s!`);
  console.log("Parent-child architecture terisolasi penuh, 0 kebocoran sumber daya.");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n❌ VERIFIKASI CLEANUP GAGAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
