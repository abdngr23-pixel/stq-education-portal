import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import {
  isProcessVerifiedTestOwned,
} from "../scripts/verify-test-db-cleanup";
import { isPidRunning, terminateOwnedChildProcess, findFreePort, isPortInUse } from "./test-db-manager";

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
});
