import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runIsolatedMigrationChainVerification } from "./test-db-manager";

describe("Milestone 3.3C2A.1 — PR #8 Migration Ledger + Schema Parity Reconciliation", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const migrationPath = path.join(
    projectRoot,
    "prisma",
    "migrations",
    "20260915100000_add_tahfizh_quality_engine",
    "migration.sql"
  );
  const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");

  describe("1. Historical Migration File & Checksum Verification", () => {
    it("migration file 20260915100000_add_tahfizh_quality_engine/migration.sql exists", () => {
      assert.ok(fs.existsSync(migrationPath), "Migration SQL file must exist in local directory");
    });

    it("restored migration SHA-256 matches production checksum exactly", () => {
      const content = fs.readFileSync(migrationPath);
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      const expectedChecksum = "fc96b177d5219c5b2853c6c86a0fa3d28bce0944890bfde9de2e5d6fe7391467";

      assert.equal(
        hash,
        expectedChecksum,
        `Restored migration checksum (${hash}) must match production ledger (${expectedChecksum})`
      );
    });

    it("migration SQL contains exact DDL for quality breakdown and evaluasi_rubu_tahfizh", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      assert.ok(sql.includes('ALTER TABLE "setoran_tahfizh" ADD COLUMN "nilai_tajwid" "NilaiSetoran"'));
      assert.ok(sql.includes('ADD COLUMN "rincian_kesalahan" JSONB;'));
      assert.ok(sql.includes('ALTER TABLE "tasmi_simaan" ADD COLUMN "nilai_tajwid" "NilaiSetoran"'));
      assert.ok(sql.includes('ALTER TABLE "ikhtibar_tahfizh" ADD COLUMN "nilai_tajwid_tahap_1" "NilaiSetoran"'));
      assert.ok(sql.includes('ADD COLUMN "nilai_tajwid_tahap_2" "NilaiSetoran"'));
      assert.ok(sql.includes('CREATE TABLE "evaluasi_rubu_tahfizh"'));
      assert.ok(sql.includes('CREATE INDEX "evaluasi_rubu_tahfizh_santri_id_tanggal_idx"'));
      assert.ok(sql.includes('CREATE INDEX "evaluasi_rubu_tahfizh_santri_id_juz_rubu_ke_idx"'));
      assert.ok(sql.includes('CREATE INDEX "evaluasi_rubu_tahfizh_musyrif_id_idx"'));
      assert.ok(sql.includes('REFERENCES "santri"("id") ON DELETE CASCADE ON UPDATE CASCADE'));
      assert.ok(sql.includes('REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE'));
    });
  });

  describe("2. Prisma Schema Parity Verification", () => {
    it("schema.prisma defines SetoranTahfizh quality fields", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schema.includes('nilaiTajwid    NilaiSetoran? @map("nilai_tajwid")'));
      assert.ok(schema.includes('nilaiFashahah  NilaiSetoran? @map("nilai_fashahah")'));
      assert.ok(schema.includes('nilaiKelancaran NilaiSetoran? @map("nilai_kelancaran")'));
      assert.ok(schema.includes('rincianKesalahan Json?       @map("rincian_kesalahan")'));
    });

    it("schema.prisma defines TasmiSimaan quality fields", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schema.includes('nilaiTajwid NilaiSetoran?    @map("nilai_tajwid")'));
      assert.ok(schema.includes('nilaiFashahah NilaiSetoran?  @map("nilai_fashahah")'));
      assert.ok(schema.includes('nilaiKelancaran NilaiSetoran? @map("nilai_kelancaran")'));
      assert.ok(schema.includes('rincianKesalahan Json?       @map("rincian_kesalahan")'));
    });

    it("schema.prisma defines IkhtibarTahfizh Tahap 1 and Tahap 2 quality fields", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schema.includes('nilaiTajwidTahap1 NilaiSetoran? @map("nilai_tajwid_tahap_1")'));
      assert.ok(schema.includes('nilaiFashahahTahap1 NilaiSetoran? @map("nilai_fashahah_tahap_1")'));
      assert.ok(schema.includes('nilaiKelancaranTahap1 NilaiSetoran? @map("nilai_kelancaran_tahap_1")'));
      assert.ok(schema.includes('rincianKesalahanTahap1 Json?   @map("rincian_kesalahan_tahap_1")'));
      assert.ok(schema.includes('nilaiTajwidTahap2 NilaiSetoran? @map("nilai_tajwid_tahap_2")'));
      assert.ok(schema.includes('nilaiFashahahTahap2 NilaiSetoran? @map("nilai_fashahah_tahap_2")'));
      assert.ok(schema.includes('nilaiKelancaranTahap2 NilaiSetoran? @map("nilai_kelancaran_tahap_2")'));
      assert.ok(schema.includes('rincianKesalahanTahap2 Json?   @map("rincian_kesalahan_tahap_2")'));
    });

    it("schema.prisma defines EvaluasiRubuTahfizh model and relations", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schema.includes("model EvaluasiRubuTahfizh {"));
      assert.ok(schema.includes('@@map("evaluasi_rubu_tahfizh")'));
      assert.ok(schema.includes("evaluasiRubuDiuji  EvaluasiRubuTahfizh[]"));
      assert.ok(schema.includes("evaluasiRubuList   EvaluasiRubuTahfizh[]"));
    });
  });

  describe("3. Runtime Boundary & Isolation Verification (No PR #8 Runtime Port)", () => {
    it("unauthorized PR #8 runtime files do NOT exist in the codebase", () => {
      const unauthorizedNewFiles = [
        "app/actions/rubu.ts",
        "components/tahfizh/evaluasi-rubu-tab.tsx",
        "lib/tahfizh-quality.ts",
      ];

      for (const relPath of unauthorizedNewFiles) {
        const fullPath = path.join(projectRoot, relPath);
        assert.equal(
          fs.existsSync(fullPath),
          false,
          `File ${relPath} from PR #8 runtime MUST NOT exist in this branch`
        );
      }
    });

    it("tahfizh module does NOT mount or activate EvaluasiRubuTab", () => {
      const tahfizhModulePath = path.join(projectRoot, "components", "modules", "tahfizh-module.tsx");
      const content = fs.readFileSync(tahfizhModulePath, "utf-8");

      assert.equal(
        content.includes("EvaluasiRubuTab"),
        false,
        "EvaluasiRubuTab must NOT be imported or rendered in TahfizhModule"
      );
      assert.equal(
        content.includes("rubu"),
        false,
        "Rubu tab/actions must NOT be referenced in TahfizhModule"
      );
    });
  });

  describe("4. Migration Chain Replay on Isolated PostgreSQL", () => {
    it("full migration chain deploys cleanly from scratch including restored migration", { timeout: 90000 }, async () => {
      const res = await runIsolatedMigrationChainVerification();

      assert.equal(res.migrationCount, 10, "Total 10 migrations must exist in prisma/migrations");
      assert.equal(res.migrationsApplied, 10, "All 10 migrations must apply successfully");
      assert.equal(res.failedCount, 0, "Zero migrations failed");
      assert.equal(res.isUpToDate, true, "Database schema is up to date");
      assert.match(res.migrateStatusOutput, /Database schema is up to date/i);
    });
  });
});
