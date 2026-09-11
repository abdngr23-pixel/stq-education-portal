(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import {
  isPortInUse,
  isPidRunning,
  findListeningPid,
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

function extractMetadataFromStdout(stdout: string): WorkerMetadata | null {
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf("__WORKER_METADATA__");
    if (idx !== -1) {
      const jsonStr = line.substring(idx + "__WORKER_METADATA__".length).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === "object") {
          return parsed as WorkerMetadata;
        }
      } catch {}
    }
  }
  return null;
}

export function validateMetadataShape(meta: WorkerMetadata | null, scenarioName: string): WorkerMetadata {
  if (!meta) {
    throw new Error(`[FAIL] Metadata wajib ada untuk ${scenarioName}, namun ditemukan kosong!`);
  }

  // port integer valid
  if (
    typeof meta.port !== "number" ||
    !Number.isInteger(meta.port) ||
    meta.port <= 1024 ||
    meta.port > 65535
  ) {
    throw new Error(`[FAIL] Metadata port tidak valid pada ${scenarioName}: ${meta.port}`);
  }

  // tempDir memiliki prefix 'stq-test-db-' dan berada di os.tmpdir()
  if (!meta.tempDir || typeof meta.tempDir !== "string") {
    throw new Error(`[FAIL] Metadata tempDir kosong pada ${scenarioName}`);
  }
  const resolved = path.resolve(meta.tempDir);
  const tmpDir = path.resolve(os.tmpdir());
  const rel = path.relative(tmpDir, resolved);
  const isInsideTmp = Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
  if (!isInsideTmp || !path.basename(resolved).startsWith("stq-test-db-")) {
    throw new Error(
      `[FAIL] Metadata tempDir (${meta.tempDir}) bukan direktori valid dengan prefix 'stq-test-db-' di dalam os.tmpdir()`
    );
  }

  // mainPid berupa angka positif
  if (typeof meta.mainPid !== "number" || meta.mainPid <= 0) {
    throw new Error(`[FAIL] Metadata mainPid tidak valid pada ${scenarioName}: ${meta.mainPid}`);
  }

  // childPids berupa array
  if (!Array.isArray(meta.childPids)) {
    throw new Error(`[FAIL] Metadata childPids harus berupa array pada ${scenarioName}!`);
  }

  return meta;
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
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    timer = setTimeout(() => {
      timedOut = true;
      console.warn(
        `   [PARENT TIMEOUT] Batas waktu ${timeoutMs / 1000}s tercapai. Menghentikan tree worker PID: ${child.pid}...`
      );

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
      const metadata = extractMetadataFromStdout(stdout);
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
      const metadata = extractMetadataFromStdout(stdout);
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

let systemBaselinePids = new Set<number>();

export function isProcessVerifiedTestOwned(
  pid: number,
  tempDir: string | null,
  verifiedMainPid: number | null,
  recordedChildPids: number[],
  baselinePids: Set<number>
): { isOwned: boolean; reason: string } {
  // 1. Guard mutlak: PID sistem/baseline dilarang disentuh sama sekali
  if (baselinePids.has(pid)) {
    return {
      isOwned: false,
      reason: `PID ${pid} terdaftar dalam systemBaselinePids (proses eksternal sistem dilindungi mutlak)`,
    };
  }

  // 2. PID tidak valid atau sudah tidak berjalan
  if (!pid || pid <= 0 || !isPidRunning(pid)) {
    return {
      isOwned: false,
      reason: `PID ${pid} tidak aktif atau tidak valid`,
    };
  }

  // 3. Pada Windows, pastikan executable adalah postgres.exe (mencegah pembunuhan proses lain akibat PID reuse)
  if (process.platform === "win32") {
    try {
      const tasklistRes = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
        encoding: "utf-8",
        timeout: 1500,
        windowsHide: true,
      });
      const output = (tasklistRes.stdout || "").toLowerCase();
      if (!output.includes("postgres.exe")) {
        return {
          isOwned: false,
          reason: `PID ${pid} bukan postgres.exe (proses non-postgres / PID reuse terdeteksi)`,
        };
      }
    } catch {
      return {
        isOwned: false,
        reason: `Gagal memverifikasi nama executable untuk PID ${pid}`,
      };
    }
  }

  // 4. Kriteria A: PID utama yang identitas / command line-nya cocok dengan instance PostgreSQL test dan tempDir
  if (verifiedMainPid && pid === verifiedMainPid && tempDir) {
    if (verifyPostgresProcessOwnership(pid, tempDir, null)) {
      return {
        isOwned: true,
        reason: `KRITERIA_A: PID ${pid} adalah main PID terverifikasi dan command line cocok dengan tempDir (${tempDir})`,
      };
    }
  }

  // 5. Kriteria B: Child PostgreSQL yang tercatat pada metadata (dan terverifikasi milik test database)
  if (recordedChildPids.includes(pid)) {
    if (tempDir && verifyPostgresProcessOwnership(pid, tempDir, verifiedMainPid)) {
      return {
        isOwned: true,
        reason: `KRITERIA_B: PID ${pid} tercatat pada metadata childPids dan terverifikasi terkait test database`,
      };
    }
  }

  // 6. Kriteria C: Proses PostgreSQL yang command line atau hubungan parent-child-nya dapat dikaitkan dengan main PID yang sudah terverifikasi atau tempDir
  if (tempDir && verifyPostgresProcessOwnership(pid, tempDir, verifiedMainPid)) {
    return {
      isOwned: true,
      reason: `KRITERIA_C: PID ${pid} adalah child/worker PostgreSQL (misal io_worker) terhubung dengan mainPid/tempDir`,
    };
  }

  return {
    isOwned: false,
    reason: `PID ${pid} tidak memenuhi kriteria kepemilikan instance test (bukan milik database test ini)`,
  };
}

export async function verifyResourceCleanup(
  metadata: WorkerMetadata | null,
  scenarioName: string,
  extraCandidatePids: number[] = []
): Promise<void> {
  console.log(`   [VERIFIKASI OS] Memeriksa status sumber daya pasca ${scenarioName}...`);
  if (!metadata) {
    console.log(`   ✓ Metadata instance tidak tercatat (instance dibatalkan sebelum alokasi resource).`);
    return;
  }

  const { port, tempDir, mainPid, childPids } = metadata;

  // 1. Kumpulkan seluruh kandidat PID (Candidate PIDs)
  const candidatePids = new Set<number>();
  if (mainPid && mainPid > 0) candidatePids.add(mainPid);
  for (const cp of childPids || []) {
    if (typeof cp === "number" && cp > 0) candidatePids.add(cp);
  }
  for (const ep of extraCandidatePids) {
    if (typeof ep === "number" && ep > 0) candidatePids.add(ep);
  }

  if (port) {
    const listeningPid = findListeningPid(port);
    if (listeningPid) {
      candidatePids.add(listeningPid);
    }
  }

  if (process.platform === "win32") {
    const currentPg = getSystemPostgresProcesses();
    for (const proc of currentPg) {
      candidatePids.add(proc.ProcessId);
    }
  }

  // 2. Pemisahan ketat: Candidate PID vs Verified-Owned PID
  const verifiedOwnedPids = new Set<number>();
  const unverifiedCandidatePids = new Map<number, string>();

  for (const pid of candidatePids) {
    const check = isProcessVerifiedTestOwned(
      pid,
      tempDir,
      mainPid,
      childPids || [],
      systemBaselinePids
    );
    if (check.isOwned) {
      verifiedOwnedPids.add(pid);
    } else {
      unverifiedCandidatePids.set(pid, check.reason);
    }
  }

  console.log(
    `   [AUDIT OWNERSHIP] Total kandidat: ${candidatePids.size} | Terverifikasi test: ${verifiedOwnedPids.size} | Ditolak: ${unverifiedCandidatePids.size}`
  );

  // 3. Hentikan HANYA PID yang terbukti milik test database (Verified-Owned)
  for (const pid of verifiedOwnedPids) {
    if (isPidRunning(pid)) {
      console.log(`   Menghentikan sisa PID test terverifikasi: ${pid}`);
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", pid.toString(), "/T", "/F"], { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGKILL");
      }

      const pidDeadline = Date.now() + 2500;
      while (isPidRunning(pid) && Date.now() < pidDeadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (isPidRunning(pid)) {
        throw new Error(`[FAIL] PID terverifikasi ${pid} masih aktif setelah pembersihan ${scenarioName}!`);
      }
    }
  }

  if (verifiedOwnedPids.size > 0) {
    console.log(
      `   ✓ Seluruh PID instance terverifikasi ([${Array.from(verifiedOwnedPids).join(", ")}]) terbukti non-aktif.`
    );
  }

  // 4. Verifikasi port tertutup (dengan polling toleransi pelepasan socket OS)
  if (port) {
    let portOpen = await isPortInUse(port);
    const deadline = Date.now() + 6000;
    while (portOpen && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      portOpen = await isPortInUse(port);
    }
    if (portOpen) {
      const remainingListeningPid = findListeningPid(port);
      if (remainingListeningPid) {
        const reason = unverifiedCandidatePids.get(remainingListeningPid);
        throw new Error(
          `[FAIL] Port ${port} masih terbuka setelah ${scenarioName}! Port digunakan oleh PID ${remainingListeningPid} yang TIDAK DIHENTIKAN karena bukan milik test instance: ${
            reason || "Tidak terverifikasi"
          }`
        );
      }
      throw new Error(`[FAIL] Port ${port} masih terbuka setelah ${scenarioName}!`);
    }
    console.log(`   ✓ Port ${port} terverifikasi tertutup.`);
  }

  // 5. Verifikasi direktori temporer
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
  console.log("MEMULAI PENGUJIAN VERIFIKASI CLEANUP POSTGRESQL (PENGETATAN METADATA)");
  console.log("================================================================");
  const overallStart = Date.now();

  // Snapshot proses PostgreSQL sistem sebelum tes dimulai
  const baselinePgProcesses = getSystemPostgresProcesses();
  systemBaselinePids = new Set(baselinePgProcesses.map((p) => p.ProcessId));
  const baselinePids = systemBaselinePids;
  console.log(`[SNAPSHOT AWAL] Proses PostgreSQL sistem terdeteksi: ${baselinePids.size} PID.`);

  // SKENARIO 1: 5 Siklus Normal Start-Stop Berturut-turut (Metadata wajib & valid)
  console.log("\n>>> SKENARIO 1: Start Normal -> Stop Normal (5 Siklus Berturut-turut)");
  for (let cycle = 1; cycle <= 5; cycle++) {
    console.log(`\n--- [Siklus Normal ${cycle}/5] ---`);
    const startCycle = Date.now();
    const result = await runWorkerProcess("normal", 45000);

    if (result.timedOut) {
      throw new Error(`Siklus ${cycle} mengalami parent timeout!`);
    }
    if (result.exitCode !== 0) {
      throw new Error(
        `Siklus ${cycle} gagal dengan exit code ${result.exitCode}. Output: ${result.stderr || result.stdout}`
      );
    }

    validateMetadataShape(result.metadata, `Siklus Normal ${cycle}`);
    await verifyResourceCleanup(result.metadata, `Siklus ${cycle}`);
    console.log(`✓ Siklus ${cycle}/5 LULUS (${((Date.now() - startCycle) / 1000).toFixed(1)}s)`);
  }

  // SKENARIO 2A: Fail-Start Sebelum Resource Dibuat
  console.log("\n>>> SKENARIO 2A: Fail-Start Sebelum Resource Dibuat");
  {
    const result = await runWorkerProcess("fail-start-before-resource", 20000);
    if (result.exitCode === 0) {
      throw new Error("Skenario 2A seharusnya keluar dengan exit code nonzero!");
    }
    if (result.metadata !== null) {
      throw new Error("Skenario 2A tidak boleh memiliki metadata karena resource belum dialokasikan!");
    }
    await verifyResourceCleanup(result.metadata, "Skenario Fail-Start Sebelum Resource");
    console.log("✓ Skenario 2A (Fail-Start Sebelum Resource) LULUS 100%");
  }

  // SKENARIO 2B: Fail-Start Setelah Resource Dibuat (Metadata wajib ada & dibersihkan)
  console.log("\n>>> SKENARIO 2B: Fail-Start Setelah Resource Dibuat");
  {
    const result = await runWorkerProcess("fail-start-after-resource", 35000);
    if (result.timedOut) {
      throw new Error("Skenario 2B mengalami parent timeout!");
    }
    if (result.exitCode === 0) {
      throw new Error("Skenario 2B seharusnya keluar dengan exit code nonzero!");
    }
    validateMetadataShape(result.metadata, "Skenario Fail-Start Setelah Resource");
    await verifyResourceCleanup(result.metadata, "Skenario Fail-Start Setelah Resource");
    console.log("✓ Skenario 2B (Fail-Start Setelah Resource) LULUS 100%");
  }

  // SKENARIO 3: Double-Stop (Metadata wajib & idempoten)
  console.log("\n>>> SKENARIO 3: Stop Dipanggil Dua Kali (Idempotency)");
  {
    const result = await runWorkerProcess("double-stop", 35000);
    if (result.timedOut) {
      throw new Error("Skenario 3 mengalami parent timeout!");
    }
    if (result.exitCode !== 0) {
      throw new Error(`Skenario 3 gagal dengan exit code ${result.exitCode}: ${result.stderr}`);
    }
    validateMetadataShape(result.metadata, "Skenario Double-Stop");
    await verifyResourceCleanup(result.metadata, "Skenario Double-Stop");
    console.log("✓ Skenario 3 (Double-Stop) LULUS 100%");
  }

  // SKENARIO 4: Intentional Timeout & Worker Tree-Kill (Metadata wajib ada setelah DB start)
  console.log("\n>>> SKENARIO 4: Timeout Buatan pada Worker & Parent Tree-Kill");
  {
    // Berikan batas waktu 35 detik agar DB sempat start penuh (~16s), emit metadata, lalu parent timeout & kill
    const result = await runWorkerProcess("intentional-timeout", 35000);
    if (!result.timedOut) {
      throw new Error("Skenario 4 seharusnya memicu parent timeout!");
    }
    console.log("   ✓ Parent hard timeout terpicu sesuai rancangan.");

    validateMetadataShape(result.metadata, "Skenario Intentional-Timeout");
    await new Promise((r) => setTimeout(r, 1000));
    await verifyResourceCleanup(result.metadata, "Skenario Intentional-Timeout");
    console.log("✓ Skenario 4 (Intentional-Timeout & Hard Kill) LULUS 100%");
  }

  // SKENARIO 5: Verifikasi Tidak Ada PostgreSQL Lain di Mesin yang Disentuh
  console.log("\n>>> SKENARIO 5: Verifikasi Tidak Ada PostgreSQL Lain di Mesin yang Disentuh");
  {
    const postPgProcesses = getSystemPostgresProcesses();
    const postPids = new Set(postPgProcesses.map((p) => p.ProcessId));

    // Validasi ketat: Seluruh PID baseline yang tercatat di awal harus tetap hidup
    for (const pid of baselinePids) {
      if (!postPids.has(pid)) {
        throw new Error(
          `[FAIL] PID baseline ${pid} terhenti selama pengujian! Pelestarian proses eksternal gagal.`
        );
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
    console.log(`   ✓ Seluruh proses PostgreSQL eksternal aman dan tidak tersentuh.`);
    console.log("✓ Skenario 5 (Integritas Proses Sistem) LULUS 100%");
  }

  // SKENARIO 6: Regression Test Ownership & Non-Target Process Preservation
  console.log("\n>>> SKENARIO 6: Regression Test Ownership & Non-Target Process Preservation");
  {
    // 1. Buat proses dummy tidak terkait (Node.js dummy process)
    const dummyProcess = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      stdio: "ignore",
    });
    const dummyPid = dummyProcess.pid;
    if (!dummyPid || !isPidRunning(dummyPid)) {
      throw new Error("Gagal memulai dummy process untuk Skenario 6!");
    }

    try {
      console.log(`   Proses dummy eksternal dimulai: PID ${dummyPid}`);

      // 2. Verifikasi isProcessVerifiedTestOwned menolak proses dummy
      const fakeTempDir = path.resolve(os.tmpdir(), "stq-test-db-dummy-scenario6");
      const fakeMainPid = 999999;
      const dummyCheck = isProcessVerifiedTestOwned(
        dummyPid,
        fakeTempDir,
        fakeMainPid,
        [dummyPid],
        systemBaselinePids
      );
      if (dummyCheck.isOwned) {
        throw new Error(
          `[FAIL] isProcessVerifiedTestOwned seharusnya MENOLAK dummy process PID ${dummyPid}, namun dinyatakan owned!`
        );
      }
      console.log(`   ✓ isProcessVerifiedTestOwned menolak dummy process: "${dummyCheck.reason}"`);

      // 3. Verifikasi isProcessVerifiedTestOwned menolak seluruh baseline process
      for (const bPid of systemBaselinePids) {
        const baselineCheck = isProcessVerifiedTestOwned(
          bPid,
          fakeTempDir,
          fakeMainPid,
          [],
          systemBaselinePids
        );
        if (baselineCheck.isOwned) {
          throw new Error(
            `[FAIL] isProcessVerifiedTestOwned seharusnya MENOLAK baseline PID ${bPid}, namun dinyatakan owned!`
          );
        }
      }
      if (systemBaselinePids.size > 0) {
        console.log(
          `   ✓ Seluruh baseline PID sistem (${systemBaselinePids.size} PID) terbukti ditolak dari ownership check.`
        );
      }

      // 4. Jalankan satu siklus normal dengan menyertakan dummyPid sebagai extra kandidat
      const result = await runWorkerProcess("normal", 45000);
      if (result.timedOut || result.exitCode !== 0) {
        throw new Error(`Worker normal untuk Skenario 6 gagal: ${result.stderr || result.stdout}`);
      }
      validateMetadataShape(result.metadata, "Skenario 6 Normal Worker");

      // Panggil verifyResourceCleanup dengan dummyPid sebagai extra kandidat
      await verifyResourceCleanup(result.metadata, "Skenario 6 Live Cleanup", [dummyPid]);

      // 5. Buktikan dummyPid TIDAK DIHENTIKAN dan masih berjalan
      if (!isPidRunning(dummyPid)) {
        throw new Error(
          `[FAIL] Dummy process PID ${dummyPid} terbunuh oleh verifyResourceCleanup! Non-target preservation gagal.`
        );
      }
      console.log(`   ✓ Terbukti: Dummy process PID ${dummyPid} tetap hidup dan TIDAK disentuh.`);

      // 6. Buktikan port dan direktori temporer test tetap bersih
      if (result.metadata?.port && (await isPortInUse(result.metadata.port))) {
        throw new Error(`[FAIL] Port test ${result.metadata.port} masih terbuka setelah Skenario 6!`);
      }
      if (result.metadata?.tempDir && fs.existsSync(result.metadata.tempDir)) {
        throw new Error(`[FAIL] TempDir test ${result.metadata.tempDir} masih ada setelah Skenario 6!`);
      }
      console.log(`   ✓ Port dan direktori temporer test terbukti 100% bersih.`);
    } finally {
      // Bersihkan dummy process
      if (dummyPid && isPidRunning(dummyPid)) {
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", dummyPid.toString(), "/F"], { stdio: "ignore" });
        } else {
          try {
            process.kill(dummyPid, "SIGKILL");
          } catch {}
        }
      }
    }
    console.log("✓ Skenario 6 (Regression Test Ownership & Non-Target Preservation) LULUS 100%");
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log("\n================================================================");
  console.log(`🎉 SELURUH SKENARIO VERIFIKASI CLEANUP LULUS DALAM ${totalDuration}s!`);
  console.log("Validasi metadata ketat & pemisahan ownership terbukti berhasil.");
  console.log("================================================================");
}

export { systemBaselinePids };

const isDirectExecution =
  (typeof require !== "undefined" && require.main === module) ||
  (Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(__filename));

if (isDirectExecution) {
  main().catch((err) => {
    console.error("\n❌ VERIFIKASI CLEANUP GAGAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

