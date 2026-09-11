import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

describe("P1 Guard: Penguncian Mock Session Khusus Explicit Test Runtime", () => {
  const rootDir = path.resolve(__dirname, "..");
  const testDbUrl = "postgresql://postgres:pass@127.0.0.1:5433/stq_test?schema=test_portal";
  const runnerScript = path.resolve(__dirname, "helpers/session-guard-runner.ts");

  assert.ok(
    fs.existsSync(runnerScript),
    `File runner session guard harus ada di ${runnerScript}`
  );

  function runSnippetWithEnv(envOverrides: Record<string, string | undefined>): {
    stdout: string;
    stderr: string;
    status: number | null;
  } {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TEST_DATABASE_URL: testDbUrl,
      ...envOverrides,
    };

    // Bersihkan undefined
    for (const key of Object.keys(env)) {
      if (env[key] === undefined) {
        delete env[key];
      }
    }

    const tsxCli = require.resolve("tsx/cli");
    const res = spawnSync(
      process.execPath,
      [tsxCli, "--conditions=react-server", runnerScript],
      {
        cwd: rootDir,
        env,
        encoding: "utf-8",
      }
    );

    return {
      stdout: res.stdout || "",
      stderr: res.stderr || "",
      status: res.status,
    };
  }

  it("1. Ketiga flag test aktif (NODE_ENV=test, IS_TEST_RUN=true, ALLOW_ISOLATED_TEST_DB=true) -> mock dapat digunakan", () => {
    const res = runSnippetWithEnv({
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    });

    assert.equal(res.status, 0, `Proses gagal: ${res.stderr || res.stdout}`);
    assert.match(res.stdout, /RESULT_SESSION_ID:mock-user-guard/);
  });

  it("2. NODE_ENV=development -> mock tidak digunakan (mengabaikan mock dan fallback ke cookie riil)", () => {
    const res = runSnippetWithEnv({
      NODE_ENV: "development",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    });

    assert.equal(res.status, 0, `Proses gagal: ${res.stderr || res.stdout}`);
    assert.match(res.stdout, /RESULT_SESSION_ID:NULL/);
  });

  it("3. NODE_ENV=production -> mock tidak digunakan (mencegah manipulasi sesi di produksi)", () => {
    const res = runSnippetWithEnv({
      NODE_ENV: "production",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: "true",
    });

    assert.equal(res.status, 0, `Proses gagal: ${res.stderr || res.stdout}`);
    assert.match(res.stdout, /RESULT_SESSION_ID:NULL/);
  });

  it("4. Hanya IS_TEST_RUN=true tanpa ALLOW_ISOLATED_TEST_DB -> mock tidak digunakan", () => {
    const res = runSnippetWithEnv({
      NODE_ENV: "test",
      IS_TEST_RUN: "true",
      ALLOW_ISOLATED_TEST_DB: undefined,
    });

    assert.equal(res.status, 0, `Proses gagal: ${res.stderr || res.stdout}`);
    assert.match(res.stdout, /RESULT_SESSION_ID:NULL/);
  });
});
