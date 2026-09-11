(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import {
  startTestDatabase,
  stopTestDatabase,
  getActiveTestPort,
  getActiveTempDir,
  getActiveMainPid,
  getActiveDescendantPids,
  verifyTestEnvironment,
} from "../tests/test-db-manager";

interface WorkerMetadata {
  port: number | null;
  tempDir: string | null;
  mainPid: number | null;
  childPids: number[];
}

function emitMetadata(metadata: WorkerMetadata) {
  console.log(`__WORKER_METADATA__${JSON.stringify(metadata)}`);
}

function safeGetMetadata(): WorkerMetadata {
  let port: number | null = null;
  try {
    port = getActiveTestPort();
  } catch {}

  return {
    port,
    tempDir: getActiveTempDir(),
    mainPid: getActiveMainPid(),
    childPids: getActiveDescendantPids(),
  };
}

async function runWorker() {
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf("--mode");
  const mode = modeIndex !== -1 && args[modeIndex + 1] ? args[modeIndex + 1] : "normal";

  console.log(`[Worker PID: ${process.pid}] Menjalankan mode: ${mode}`);

  if (mode === "normal") {
    const prisma = await startTestDatabase();
    verifyTestEnvironment();
    const meta = safeGetMetadata();
    emitMetadata(meta);

    // Verifikasi query bekerja
    const testQuery = await prisma.$queryRawUnsafe<{ result: number }[]>("SELECT 1 as result");
    if (!testQuery || testQuery[0]?.result !== 1) {
      throw new Error("Query test ke database gagal!");
    }

    await stopTestDatabase();
    console.log(`[Worker PID: ${process.pid}] Mode normal selesai sukses.`);
    process.exit(0);
  } else if (mode === "fail-start-before-resource") {
    // Skenario 2A: Simulasi kegagalan sebelum sumber daya DB dibuat
    console.log(`[Worker PID: ${process.pid}] Mensimulasikan kegagalan sebelum sumber daya dibuat...`);
    throw new Error("SIMULATED_FAIL_BEFORE_RESOURCE");
  } else if (mode === "fail-start" || mode === "fail-start-after-resource") {
    // Skenario 2B: Simulasi kegagalan setelah sumber daya DB dibuat
    await startTestDatabase();
    const meta = safeGetMetadata();
    emitMetadata(meta);

    console.log(`[Worker PID: ${process.pid}] Mensimulasikan error kegagalan operasi pasca alokasi resource...`);
    try {
      throw new Error("SIMULATED_FAIL_AFTER_RESOURCE");
    } finally {
      await stopTestDatabase();
      console.log(`[Worker PID: ${process.pid}] Cleanup pasca simulasi kegagalan berhasil.`);
    }
    process.exit(0);
  } else if (mode === "double-stop") {
    // Skenario 3: Panggilan stop ganda (idempotency check)
    await startTestDatabase();
    const meta = safeGetMetadata();
    emitMetadata(meta);

    console.log(`[Worker PID: ${process.pid}] Menjalankan stop pertama...`);
    await stopTestDatabase();
    console.log(`[Worker PID: ${process.pid}] Menjalankan stop kedua (harus idempoten)...`);
    await stopTestDatabase();
    console.log(`[Worker PID: ${process.pid}] Stop ganda berhasil tanpa error.`);
    process.exit(0);
  } else if (mode === "intentional-timeout") {
    // Skenario 4: Worker start DB, emit metadata, lalu menahan proses hingga induk memicu hard timeout & tree-kill
    await startTestDatabase();
    const meta = safeGetMetadata();
    emitMetadata(meta);

    console.log(`[Worker PID: ${process.pid}] Database aktif. Menunggu hingga dihentikan oleh parent timeout...`);
    // Tunggu (akan di-kill oleh induk)
    await new Promise((resolve) => setTimeout(resolve, 120000));
    process.exit(0);
  } else {
    throw new Error(`Mode tidak dikenal: ${mode}`);
  }
}

runWorker().catch(async (err) => {
  console.error(`[Worker ERROR PID: ${process.pid}]:`, err.message);
  try {
    await stopTestDatabase();
  } catch {}
  process.exit(1);
});
