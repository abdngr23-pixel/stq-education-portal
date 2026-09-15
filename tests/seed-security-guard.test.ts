import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isDemonstrablyLocalOrTestDatabase,
  validateSeedExecutionSafety,
  SeedSecurityError,
} from "../lib/seed-guard";

describe("Seed Security Guard & Production Protection Suite", () => {
  const SAFE_LOCAL_URL = "postgresql://postgres:postgrespassword@127.0.0.1:5433/stq_test?schema=test_portal";

  // 1. Production target rejected
  it("1. Database target produksi / cloud wajib ditolak mutlak", () => {
    const cloudUrls = [
      "prisma://accelerate.prisma-data.net/?api_key=secret_token",
      "postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      "postgresql://stq_user:pass@ep-cool-fog-123.ap-southeast-1.aws.neon.tech/neondb",
      "postgresql://admin:secret@prod-db.c7x8y9.rds.amazonaws.com:5432/stq_prod",
      "postgresql://root:secret@stq-production.railway.app:5432/railway",
      "postgres://user:pass@dpg-abc1234-a.oregon-postgres.render.com/stq_prod",
      "postgresql://user:pass@192.168.1.100:5432/stq_prod", // non-loopback IP
    ];

    for (const url of cloudUrls) {
      assert.equal(
        isDemonstrablyLocalOrTestDatabase(url),
        false,
        `URL ${url} seharusnya ditolak sebagai non-local target`
      );

      assert.throws(
        () =>
          validateSeedExecutionSafety({
            nodeEnv: "development",
            allowDestructiveSeed: "true",
            databaseUrl: url,
          }),
        (err: unknown) => {
          assert.ok(err instanceof SeedSecurityError);
          assert.match((err as Error).message, /does not resolve to an approved local/);
          return true;
        },
        `URL ${url} wajib melempar SeedSecurityError`
      );
    }
  });

  // 2. Production NODE_ENV rejected
  it("2. NODE_ENV === 'production' wajib menolak eksekusi seed bahkan pada host lokal", () => {
    assert.throws(
      () =>
        validateSeedExecutionSafety({
          nodeEnv: "production",
          allowDestructiveSeed: "true",
          databaseUrl: SAFE_LOCAL_URL,
        }),
      (err: unknown) => {
        assert.ok(err instanceof SeedSecurityError);
        assert.match((err as Error).message, /strictly forbidden when NODE_ENV is 'production'/);
        return true;
      }
    );
  });

  // 3. Missing explicit seed flag rejected
  it("3. Tidak adanya flag eksplisit ALLOW_DESTRUCTIVE_SEED='true' wajib menolak eksekusi", () => {
    const invalidFlags = [undefined, "", "false", "0", "ALLOW", "yes"];

    for (const flag of invalidFlags) {
      assert.throws(
        () =>
          validateSeedExecutionSafety({
            nodeEnv: "development",
            allowDestructiveSeed: flag,
            databaseUrl: SAFE_LOCAL_URL,
          }),
        (err: unknown) => {
          assert.ok(err instanceof SeedSecurityError);
          assert.match((err as Error).message, /ALLOW_DESTRUCTIVE_SEED='true' is required/);
          return true;
        },
        `Flag '${flag}' wajib ditolak`
      );
    }
  });

  // 4. Approved isolated test/dev target allowed
  it("4. Target lokal / isolated test database dengan konfigurasi valid diizinkan", () => {
    const validLocalUrls = [
      SAFE_LOCAL_URL,
      "postgresql://postgres:password@localhost:5432/stq_dev",
      "postgresql://postgres:password@127.0.0.1:5432/stq_dev",
      "postgresql://postgres:password@[::1]:5432/stq_dev",
      "postgresql://postgres:password@0.0.0.0:5432/stq_dev",
      "postgresql://postgres:password@stq-test-db:5432/stq_test",
    ];

    for (const url of validLocalUrls) {
      assert.equal(
        isDemonstrablyLocalOrTestDatabase(url),
        true,
        `URL lokal ${url} seharusnya disetujui`
      );

      const result = validateSeedExecutionSafety({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: url,
      });

      assert.ok(result.targetDatabaseHost);
      assert.ok(result.resolvedSeedPassword.length >= 16);
      assert.equal(result.isEphemeralPassword, true);
    }
  });

  // 5. Guard executes before any deleteMany in prisma/seed.ts
  it("5. Guard keamanan diverifikasi terpanggil SEBELUM deleteMany() dalam prisma/seed.ts", () => {
    const seedSourcePath = fs.existsSync(path.resolve(process.cwd(), "prisma/seed.ts"))
      ? path.resolve(process.cwd(), "prisma/seed.ts")
      : path.resolve(__dirname, "../prisma/seed.ts");
    const seedCode = fs.readFileSync(seedSourcePath, "utf8");

    const guardCallIndex = seedCode.indexOf("validateSeedExecutionSafety()");
    const deleteManyIndex = seedCode.indexOf("deleteMany()");
    const prismaInitIndex = seedCode.indexOf("new PrismaClient()");

    assert.ok(guardCallIndex !== -1, "validateSeedExecutionSafety() wajib dipanggil di prisma/seed.ts");
    assert.ok(deleteManyIndex !== -1, "deleteMany() ada di prisma/seed.ts");
    assert.ok(
      guardCallIndex < deleteManyIndex,
      "Guard keamanan wajib dieksekusi sebelum pemanggilan deleteMany() pertama"
    );
    assert.ok(
      guardCallIndex < prismaInitIndex,
      "Guard keamanan wajib dieksekusi sebelum instansiasi new PrismaClient()"
    );
  });

  // 6. Hardcoded default password removed from seed.ts
  it("6. Plaintext 'password123' tidak boleh ada lagi dalam prisma/seed.ts", () => {
    const seedSourcePath = fs.existsSync(path.resolve(process.cwd(), "prisma/seed.ts"))
      ? path.resolve(process.cwd(), "prisma/seed.ts")
      : path.resolve(__dirname, "../prisma/seed.ts");
    const seedCode = fs.readFileSync(seedSourcePath, "utf8");

    assert.ok(
      !seedCode.includes("password123"),
      "Plaintext hardcoded password123 wajib dihapus seluruhnya dari prisma/seed.ts"
    );
  });

  // 7. STQ_SEED_DEFAULT_PASSWORD validation & ephemeral fallback
  it("7. STQ_SEED_DEFAULT_PASSWORD divalidasi panjang minimalnya dan ephemeral acak dihasilkan jika tidak disetel", () => {
    // Terlalu pendek (< 12 karakter) -> wajib ditolak
    assert.throws(
      () =>
        validateSeedExecutionSafety({
          nodeEnv: "development",
          allowDestructiveSeed: "true",
          databaseUrl: SAFE_LOCAL_URL,
          seedPassword: "short",
        }),
      (err: unknown) => {
        assert.ok(err instanceof SeedSecurityError);
        assert.match((err as Error).message, /must be at least 12 characters/);
        return true;
      }
    );

    // Panjang valid (>= 12 karakter) -> diterima
    const validExplicit = validateSeedExecutionSafety({
      nodeEnv: "development",
      allowDestructiveSeed: "true",
      databaseUrl: SAFE_LOCAL_URL,
      seedPassword: "strong-dev-seed-password-2026",
    });
    assert.equal(validExplicit.resolvedSeedPassword, "strong-dev-seed-password-2026");
    assert.equal(validExplicit.isEphemeralPassword, false);

    // Ephemeral acak unik per eksekusi saat tidak disetel
    const run1 = validateSeedExecutionSafety({
      nodeEnv: "development",
      allowDestructiveSeed: "true",
      databaseUrl: SAFE_LOCAL_URL,
    });
    const run2 = validateSeedExecutionSafety({
      nodeEnv: "development",
      allowDestructiveSeed: "true",
      databaseUrl: SAFE_LOCAL_URL,
    });
    assert.equal(run1.isEphemeralPassword, true);
    assert.equal(run2.isEphemeralPassword, true);
    assert.notEqual(run1.resolvedSeedPassword, run2.resolvedSeedPassword);
    assert.ok(run1.resolvedSeedPassword.length >= 20);
  });
});
