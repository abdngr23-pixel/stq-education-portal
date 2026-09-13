import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import {
  isProcessVerifiedTestOwned,
} from "../scripts/verify-test-db-cleanup";
import { isPidRunning, terminateOwnedChildProcess, findFreePort, isPortInUse } from "./test-db-manager";
import { executeQARunnerCleanup, combineExecutionAndCleanupErrors } from "../scripts/qa-runner-core";
import type { Browser } from "puppeteer-core";

describe("Regression Guard: Strict Process Ownership Check Pembersihan Database Test", () => {
  const fakeTempDir = path.resolve(os.tmpdir(), "stq-test-db-unit-ownership-test");
  const fakeMainPid = 999991;

  it("1. Harus menolak mutlak PID yang terdaftar dalam baseline sistem", () => {
    const baseline = new Set<number>([1234, 5678, process.pid]);
    const check = isProcessVerifiedTestOwned(
      process.pid,
      fakeTempDir,
      fakeMainPid,
      [process.pid],
      baseline
    );

    assert.equal(check.isOwned, false, "Baseline PID tidak boleh dinyatakan owned");
    assert.match(check.reason, /systemBaselinePids/, "Alasan harus menyebut baseline sistem dilindungi");
  });

  it("2. Harus menolak proses berjalan baru yang bukan postgres.exe (misal node.exe) dan tidak menghentikannya", async () => {
    const dummy = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      stdio: "ignore",
    });
    const dummyPid = dummy.pid;
    assert.ok(dummyPid && isPidRunning(dummyPid), "Dummy process harus aktif");

    try {
      const baseline = new Set<number>();
      // Walaupun dummyPid dimasukkan sebagai recordedChildPids atau mainPid palsu,
      // harus tetap ditolak karena executable bukan postgres.exe
      const checkAsMain = isProcessVerifiedTestOwned(
        dummyPid,
        fakeTempDir,
        dummyPid,
        [],
        baseline
      );
      assert.equal(checkAsMain.isOwned, false, "Non-postgres tidak boleh diakui sebagai mainPid");
      if (process.platform === "win32") {
        assert.match(checkAsMain.reason, /bukan postgres\.exe/i);
      }

      const checkAsChild = isProcessVerifiedTestOwned(
        dummyPid,
        fakeTempDir,
        fakeMainPid,
        [dummyPid],
        baseline
      );
      assert.equal(checkAsChild.isOwned, false, "Non-postgres tidak boleh diakui sebagai childPid");

      // Pastikan dummy process tetap hidup dan tidak terbunuh oleh check
      assert.equal(isPidRunning(dummyPid), true, "Dummy process harus tetap hidup setelah evaluasi");
    } finally {
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
  });

  it("3. Harus menolak kandidat PID yang tidak aktif atau bernilai tidak valid", () => {
    const baseline = new Set<number>();
    const checkInvalid = isProcessVerifiedTestOwned(-1, fakeTempDir, fakeMainPid, [], baseline);
    assert.equal(checkInvalid.isOwned, false);

    const checkDead = isProcessVerifiedTestOwned(99999999, fakeTempDir, fakeMainPid, [], baseline);
    assert.equal(checkDead.isOwned, false);
  });

  it("4. Harus menolak listeningPid asing yang tidak terhubung dengan tempDir maupun mainPid", () => {
    const baseline = new Set<number>();
    // Simulasikan PID proses saat ini (node) sebagai listening PID asing
    const checkListening = isProcessVerifiedTestOwned(
      process.pid,
      fakeTempDir,
      fakeMainPid,
      [],
      baseline
    );
    assert.equal(checkListening.isOwned, false);
  });

  it("5. terminateOwnedChildProcess harus menghentikan child process tree dan memverifikasi port bebas", async () => {
    const testPort = await findFreePort(6850, 30);
    const dummyServer = spawn(
      process.execPath,
      [
        "-e",
        `
        const http = require('http');
        const server = http.createServer((req, res) => res.end('ok'));
        server.listen(${testPort}, '127.0.0.1');
        setInterval(() => {}, 1000);
        `,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      }
    );

    const start = Date.now();
    while (Date.now() - start < 4000) {
      if (await isPortInUse(testPort)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(await isPortInUse(testPort), true, "Dummy server harus listening pada port");

    const result = await terminateOwnedChildProcess(dummyServer, {
      port: testPort,
      label: "Unit test dummy server",
    });

    assert.equal(result.exited, true, "Proses harus exit");
    assert.equal(result.portClosed, true, "Port harus terverifikasi closed");
    assert.equal(result.remainingDescendants.length, 0, "Tidak boleh ada descendant tersisa");
    assert.equal(isPidRunning(dummyServer.pid!), false, "PID tidak boleh lagi berjalan");
  });

  it("6. terminateOwnedChildProcess harus menangani child yang sudah exit secara idempotent", async () => {
    const deadChild = spawn(process.execPath, ["-e", "process.exit(0);"], {
      stdio: "ignore",
    });

    await new Promise((resolve) => deadChild.on("exit", resolve));

    const result = await terminateOwnedChildProcess(deadChild, {
      label: "Dead child",
    });

    assert.equal(result.exited, true);
    assert.equal(result.method, "already_exited");
  });

  it("7. executeQARunnerCleanup harus FAIL-CLOSED jika terjadi kegagalan pada cleanup", async () => {
    let secondStepExecuted = false;
    await assert.rejects(
      async () => {
        await executeQARunnerCleanup({
          browser: null,
          nextServerProcess: null,
          testNextPort: null,
          testPrisma: null,
          customCleanupSteps: [
            () => {
              throw new Error("Simulasi server cleanup gagal (port macet)");
            },
            () => {
              secondStepExecuted = true;
            },
          ],
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.match(error.message, /Simulasi server cleanup gagal/);
        return true;
      }
    );
    assert.equal(secondStepExecuted, true, "Seluruh tahapan cleanup harus tetap dijalankan meskipun ada step yang gagal");
  });

  it("8. executeQARunnerCleanup harus melempar AggregateError jika multiple cleanup steps gagal", async () => {
    await assert.rejects(
      async () => {
        await executeQARunnerCleanup({
          browser: null,
          nextServerProcess: null,
          testNextPort: null,
          testPrisma: null,
          customCleanupSteps: [
            () => {
              throw new Error("Kegagalan A");
            },
            () => {
              throw new Error("Kegagalan B");
            },
          ],
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AggregateError, "Harus melempar AggregateError");
        assert.equal(err.errors.length, 2);
        const err0 = err.errors[0] as Error;
        const err1 = err.errors[1] as Error;
        assert.match(err0.message, /Kegagalan A/);
        assert.match(err1.message, /Kegagalan B/);
        return true;
      }
    );
  });

  it("9. executeQARunnerCleanup mencatat kegagalan browser.close dan tetap melanjutkan cleanup berikutnya lalu fail-closed", async () => {
    let subsequentCleanupRun = false;
    const fakeBrowser = {
      close: async () => {
        throw new Error("Simulasi browser crash saat close");
      },
    } as unknown as Browser;

    await assert.rejects(
      async () => {
        await executeQARunnerCleanup({
          browser: fakeBrowser,
          nextServerProcess: null,
          testNextPort: null,
          testPrisma: null,
          customCleanupSteps: [
            () => {
              subsequentCleanupRun = true;
            },
          ],
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.match(error.message, /Simulasi browser crash saat close/);
        return true;
      }
    );
    assert.equal(subsequentCleanupRun, true, "Tahapan cleanup berikutnya harus tetap dijalankan meskipun browser close gagal");
  });

  it("10. combineExecutionAndCleanupErrors memprioritaskan error tunggal tanpa nesting yang tidak perlu", () => {
    assert.equal(combineExecutionAndCleanupErrors(null, null), null);

    const primaryOnly = new Error("Primary QA assertion gagal");
    assert.equal(combineExecutionAndCleanupErrors(primaryOnly, null), primaryOnly);

    const cleanupOnly = new Error("Server cleanup gagal");
    assert.equal(combineExecutionAndCleanupErrors(null, cleanupOnly), cleanupOnly);
  });

  it("11. combineExecutionAndCleanupErrors menggabungkan primary error dan cleanup error ke AggregateError tanpa menutupi salah satunya", () => {
    const primary = new Error("Layout overflow terdeteksi pada mobile");
    const cleanup = new Error("Port 3000 masih terbuka");

    const combined = combineExecutionAndCleanupErrors(primary, cleanup);
    assert.ok(combined instanceof AggregateError, "Harus menghasilkan AggregateError");
    assert.equal(combined.errors.length, 2);
    assert.equal(combined.errors[0], primary, "Primary error harus berada di posisi pertama");
    assert.equal(combined.errors[1], cleanup, "Cleanup error harus berada di posisi kedua");
    assert.match(combined.message, /Layout overflow terdeteksi/);
    assert.match(combined.message, /Port 3000 masih terbuka/);
  });
});
