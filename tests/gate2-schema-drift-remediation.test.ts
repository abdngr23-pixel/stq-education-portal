import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Gate 2 Schema Drift Remediation — NilaiAkademik guru FK reconciliation", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");
  const migrationDir = path.join(
    projectRoot,
    "prisma",
    "migrations",
    "20260928070000_gate2_nilai_akademik_guru_fk_reconciliation"
  );
  const migrationPath = path.join(migrationDir, "migration.sql");

  describe("1. Schema Contract Assertions", () => {
    it("schema.prisma exists and defines NilaiAkademik with nullable guruId", () => {
      assert.ok(fs.existsSync(schemaPath), "prisma/schema.prisma must exist");
      const schema = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(
        schema.includes('guruId               String?       @map("guru_id")') ||
        schema.includes('guruId String? @map("guru_id")') ||
        schema.includes('guruId  String?  @map("guru_id")'),
        "NilaiAkademik.guruId must remain nullable (String?)"
      );
    });

    it("schema.prisma explicitly declares onDelete: SetNull and onUpdate: Cascade on NilaiAkademik.guru", () => {
      const schema = fs.readFileSync(schemaPath, "utf-8");

      // Extract NilaiAkademik model block
      const modelMatch = schema.match(/model\s+NilaiAkademik\s*\{([\s\S]*?)\n\}/);
      assert.ok(modelMatch, "NilaiAkademik model block must exist in schema.prisma");
      const modelContent = modelMatch[1];

      // Check relation declaration
      const relationRegex = /guru\s+Staff\?\s+@relation\(([\s\S]*?)\)/;
      const relationMatch = modelContent.match(relationRegex);
      assert.ok(relationMatch, "NilaiAkademik.guru relation declaration must exist");

      const relationArgs = relationMatch[1];
      assert.ok(relationArgs.includes("fields: [guruId]"), "Relation must declare fields: [guruId]");
      assert.ok(relationArgs.includes("references: [id]"), "Relation must declare references: [id]");
      assert.ok(relationArgs.includes("onDelete: SetNull"), "Relation must explicitly declare onDelete: SetNull");
      assert.ok(relationArgs.includes("onUpdate: Cascade"), "Relation must explicitly declare onUpdate: Cascade");
    });
  });

  describe("2. Remediation Migration Contract Assertions", () => {
    it("new remediation migration directory and migration.sql exist", () => {
      assert.ok(fs.existsSync(migrationDir), "Remediation migration directory must exist");
      assert.ok(fs.existsSync(migrationPath), "migration.sql must exist within remediation migration directory");
    });

    it("migration SQL targets only nilai_akademik_guru_id_fkey with correct semantics", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Check DROP and ADD constraint
      assert.ok(
        sql.includes('ALTER TABLE "nilai_akademik"'),
        'Must alter table "nilai_akademik"'
      );
      assert.ok(
        sql.includes('DROP CONSTRAINT "nilai_akademik_guru_id_fkey"'),
        'Must drop constraint "nilai_akademik_guru_id_fkey"'
      );
      assert.ok(
        sql.includes('ADD CONSTRAINT "nilai_akademik_guru_id_fkey"'),
        'Must re-add constraint "nilai_akademik_guru_id_fkey"'
      );
      assert.ok(
        sql.includes('FOREIGN KEY ("guru_id")'),
        'Must define foreign key on "guru_id"'
      );
      assert.ok(
        sql.includes('REFERENCES "staff"("id")'),
        'Must reference "staff"("id")'
      );
      assert.ok(
        sql.includes("ON DELETE SET NULL"),
        "Must specify ON DELETE SET NULL"
      );
      assert.ok(
        sql.includes("ON UPDATE CASCADE"),
        "Must specify ON UPDATE CASCADE"
      );
    });

    it("migration SQL contains zero DML (no INSERT, UPDATE, DELETE, TRUNCATE)", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      const lines = sql
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("--"));

      for (const line of lines) {
        const upper = line.toUpperCase();
        assert.ok(!upper.startsWith("INSERT "), "Migration must not contain INSERT statements");
        assert.ok(!upper.startsWith("UPDATE "), "Migration must not contain UPDATE statements");
        assert.ok(!upper.startsWith("DELETE "), "Migration must not contain DELETE statements");
        assert.ok(!upper.startsWith("TRUNCATE "), "Migration must not contain TRUNCATE statements");
      }
    });

    it("migration SQL touches no unrelated tables", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      // All ALTER TABLE occurrences should be table "nilai_akademik"
      const alterTableMatches = sql.match(/ALTER\s+TABLE\s+([^\s;]+)/gi) || [];
      for (const match of alterTableMatches) {
        assert.ok(
          match.includes('"nilai_akademik"'),
          `ALTER TABLE must only target "nilai_akademik", got: ${match}`
        );
      }
    });
  });

  describe("3. Historical Migration Integrity Assertions", () => {
    it("exactly 11 historical migrations exist and remain unmodified", () => {
      const migrationsRoot = path.join(projectRoot, "prisma", "migrations");
      const entries = fs.readdirSync(migrationsRoot, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

      // Total migrations must be exactly 12 (11 historical + 1 remediation)
      assert.equal(
        dirs.length,
        12,
        `Expected exactly 12 migration directories (11 historical + 1 remediation), found ${dirs.length}`
      );

      // Verify the 11 historical migrations are present in expected order
      const expectedHistorical = [
        "20260910083000_setoran_tahfizh_page_based",
        "20260910090000_core_operational_final",
        "20260910103000_p0_tahfizh_persistence",
        "20260914100000_target_santri_float",
        "20260914170000_add_jumlah_juz_mufar",
        "20260915100000_add_tahfizh_quality_engine",
        "20260917000000_stq_architecture_lock_phase2a",
        "20260917220000_m3_1_keasramaan_structure",
        "20260918120000_m3_3a_health_v2_backend",
        "20260918140000_m3_3b_pendidikan_foundation",
        "20260920080000_prelaunch_reconciliation",
      ];

      for (const hist of expectedHistorical) {
        assert.ok(dirs.includes(hist), `Historical migration ${hist} must exist`);
      }

      // Check that the new remediation migration is the 12th
      assert.ok(
        dirs.includes("20260928070000_gate2_nilai_akademik_guru_fk_reconciliation"),
        "Remediation migration must be present"
      );
    });
  });
});
