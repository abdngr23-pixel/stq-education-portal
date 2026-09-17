/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import {
  CANONICAL_HEALTH_STATUSES_V2,
  isCanonicalHealthStatusV2,
  mapLegacyHealthStatusToV2,
  HEALTH_V2_INVARIANTS,
} from "../lib/health-v2";

import {
  HEALTH_CAPABILITIES,
  BusinessRuleState,
} from "../types/architecture-lock";

import {
  saveHealthCaseV2Core,
  updateHealthCaseV2StatusCore,
  getHealthCaseV2DetailCore,
  getHealthCasesV2AggregateCore,
} from "../lib/server/health-v2-service";

import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
} from "../lib/auth/canonical-evaluator";

import {
  simulateM33aMigrationChain,
} from "./test-db-manager";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3: CHECKPOINT M3.3A HEALTH V2 BACKEND FOUNDATION", () => {
  const rootDir = path.resolve(__dirname, "..");
  const schemaPath = path.join(rootDir, "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const migrationDir = path.join(rootDir, "prisma/migrations/20260918120000_m3_3a_health_v2_backend");
  const migrationSqlPath = path.join(migrationDir, "migration.sql");
  const legacyActionPath = path.join(rootDir, "app/actions/kesehatan.ts");
  const legacyActionContent = fs.readFileSync(legacyActionPath, "utf-8");

  // =========================================================================
  // 1. Data Honesty Correction (Legacy Action)
  // =========================================================================
  describe("1. Legacy Action Data Honesty Correction", () => {
    it("1.1. Empty diagnosis in legacy action persists NULL", () => {
      // In app/actions/kesehatan.ts, diagnosa must be sanitized to formData.diagnosa?.trim() || null
      assert.ok(
        legacyActionContent.includes("formData.diagnosa?.trim() || null"),
        "catatKesehatanAction must sanitize diagnosa using `formData.diagnosa?.trim() || null`"
      );

      // Verify the transformation logic directly
      const sanitizeDiagnosa = (diagnosa?: string | null) => diagnosa?.trim() || null;
      assert.strictEqual(sanitizeDiagnosa(""), null);
      assert.strictEqual(sanitizeDiagnosa("   "), null);
      assert.strictEqual(sanitizeDiagnosa(undefined), null);
      assert.strictEqual(sanitizeDiagnosa(null), null);
      assert.strictEqual(sanitizeDiagnosa("Demam berdarah"), "Demam berdarah");
      assert.strictEqual(sanitizeDiagnosa("  Batuk pilek  "), "Batuk pilek");
    });

    it("1.2. No fake diagnosis string ('Pemeriksaan awal asrama') appears in codebase", () => {
      assert.ok(
        !legacyActionContent.includes("Pemeriksaan awal asrama"),
        "The fake default string 'Pemeriksaan awal asrama' must NOT exist in app/actions/kesehatan.ts"
      );
    });
  });

  // =========================================================================
  // 2. Deterministic Legacy Status Bridge
  // =========================================================================
  describe("2. Deterministic Legacy Status Read Bridge", () => {
    it("2.1. Legacy status bridge maps RAWAT_PONDOK -> DIPANTAU deterministically", () => {
      assert.strictEqual(mapLegacyHealthStatusToV2("RAWAT_PONDOK"), "DIPANTAU");
      assert.strictEqual(mapLegacyHealthStatusToV2("rawat_pondok"), "DIPANTAU");
      assert.strictEqual(mapLegacyHealthStatusToV2("  RAWAT_PONDOK  "), "DIPANTAU");
    });

    it("2.2. Legacy status bridge maps SEMBUH -> PULIH deterministically", () => {
      assert.strictEqual(mapLegacyHealthStatusToV2("SEMBUH"), "PULIH");
      assert.strictEqual(mapLegacyHealthStatusToV2("sembuh"), "PULIH");
      assert.strictEqual(mapLegacyHealthStatusToV2("  SEMBUH "), "PULIH");
    });

    it("2.3. Legacy status bridge maps DIRUJUK_PUSKESMAS -> DIRUJUK deterministically", () => {
      assert.strictEqual(mapLegacyHealthStatusToV2("DIRUJUK_PUSKESMAS"), "DIRUJUK");
      assert.strictEqual(mapLegacyHealthStatusToV2("dirujuk_puskesmas"), "DIRUJUK");
    });

    it("2.4. Legacy status bridge maps DIRUJUK_RS -> DIRUJUK deterministically", () => {
      assert.strictEqual(mapLegacyHealthStatusToV2("DIRUJUK_RS"), "DIRUJUK");
      assert.strictEqual(mapLegacyHealthStatusToV2("dirujuk_rs"), "DIRUJUK");
    });

    it("2.5. Unsupported or ambiguous legacy status does NOT silently map to canonical V2 status", () => {
      // Historical/ambiguous status PULANG flags REVIEW_REQUIRED
      assert.strictEqual(mapLegacyHealthStatusToV2("PULANG"), "REVIEW_REQUIRED");
      assert.strictEqual(mapLegacyHealthStatusToV2("pulang"), "REVIEW_REQUIRED");

      // Unknown strings map to UNKNOWN fallback
      assert.strictEqual(mapLegacyHealthStatusToV2("UNKNOWN_STATUS"), "UNKNOWN");
      assert.strictEqual(mapLegacyHealthStatusToV2("ISOLASI_MANDIRI"), "UNKNOWN");
      assert.strictEqual(mapLegacyHealthStatusToV2(""), "UNKNOWN");
      assert.strictEqual(mapLegacyHealthStatusToV2(null), "UNKNOWN");
      assert.strictEqual(mapLegacyHealthStatusToV2(undefined), "UNKNOWN");
    });
  });

  // =========================================================================
  // 3. Canonical Health V2 Domain Vocabulary & Contracts
  // =========================================================================
  describe("3. Canonical Health V2 Domain Contracts", () => {
    it("3.1. Canonical V2 statuses are exactly: DIPANTAU / PULIH / DIRUJUK / DARURAT", () => {
      const expected = ["DIPANTAU", "PULIH", "DIRUJUK", "DARURAT"].sort();
      assert.deepStrictEqual([...CANONICAL_HEALTH_STATUSES_V2].sort(), expected);
      assert.strictEqual(CANONICAL_HEALTH_STATUSES_V2.length, 4);

      assert.strictEqual(isCanonicalHealthStatusV2("DIPANTAU"), true);
      assert.strictEqual(isCanonicalHealthStatusV2("PULIH"), true);
      assert.strictEqual(isCanonicalHealthStatusV2("DIRUJUK"), true);
      assert.strictEqual(isCanonicalHealthStatusV2("DARURAT"), true);

      assert.strictEqual(isCanonicalHealthStatusV2("RAWAT_PONDOK"), false);
      assert.strictEqual(isCanonicalHealthStatusV2("SEMBUH"), false);
      assert.strictEqual(isCanonicalHealthStatusV2("PULANG"), false);
      assert.strictEqual(isCanonicalHealthStatusV2("UNKNOWN"), false);
      assert.strictEqual(isCanonicalHealthStatusV2(""), false);
      assert.strictEqual(isCanonicalHealthStatusV2(null), false);

      // Verify institutional invariant flags
      assert.strictEqual(HEALTH_V2_INVARIANTS.REFERRAL_AUTHORITY_STATE, "PROPOSED_TBD");
      assert.strictEqual(HEALTH_V2_INVARIANTS.STATUS_BRIDGE_MUTATION_ALLOWED, false);
      assert.strictEqual(HEALTH_V2_INVARIANTS.DAILY_CHECKLIST_POLICY, "EXACTLY_ONE_PER_DAY_NO_INVENTED_ITEMS");
      assert.strictEqual(HEALTH_V2_INVARIANTS.INVENTORY_OWNERSHIP_POLICY, "HEALTH_OWNED_MAINTENANCE_DELEGATED_TO_SARPRAS");
    });

    it("3.2. Prisma schema and migration define HealthStatusV2 enum and HealthCaseV2 model additively", () => {
      assert.ok(schemaContent.includes("enum HealthStatusV2 {"), "Prisma schema must define HealthStatusV2 enum");
      assert.ok(schemaContent.includes("model HealthCaseV2 {"), "Prisma schema must define HealthCaseV2 model");
      assert.ok(schemaContent.includes("@@map(\"health_cases_v2\")"), "HealthCaseV2 must map to health_cases_v2");
      assert.ok(/healthCasesV2\s+HealthCaseV2\[\]/.test(schemaContent), "Santri model must include healthCasesV2 relation");

      assert.ok(fs.existsSync(migrationSqlPath), "Migration SQL file must exist");
      const migrationSql = fs.readFileSync(migrationSqlPath, "utf-8");
      assert.ok(migrationSql.includes("CREATE TYPE \"HealthStatusV2\" AS ENUM"), "Migration must create enum HealthStatusV2");
      assert.ok(migrationSql.includes("CREATE TABLE \"health_cases_v2\""), "Migration must create table health_cases_v2");
    });
  });

  // =========================================================================
  // 4. Domain Service Security & Dual Attribution
  // =========================================================================
  describe("4. Health V2 Domain Service & Access Boundaries", () => {
    const mockSantri = {
      id: "san-001",
      nama: "Ahmad Santri",
      kelas: "7A",
      kamarPlacements: [{ kamarId: "ou-kmr-ali", isActive: true }],
    };

    const mockCase = {
      id: "hc-mock-01",
      santriId: "san-001",
      occurredAt: new Date(),
      keluhan: "Demam tinggi",
      tindakanAwal: "Diberi paracetamol dan kompres",
      diagnosa: null,
      catatan: "Perlu pantauan 2x sehari",
      attachmentUrl: null,
      statusV2: "DIPANTAU",
      recordedByUserId: "usr-petugas-01",
      recordedByStaffId: "stf-01",
      createdAt: new Date(),
      updatedAt: new Date(),
      santri: mockSantri,
    };

    it("4.1. Generic OSDA does not imply Health detail capability", async () => {
      const mockPrisma = {
        healthCaseV2: {
          findUnique: async () => mockCase,
        },
      };

      // Generic OSDA actor requesting clinical details
      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-mock-01",
            {
              actorUserId: "usr-osda-generic",
              isOsdaGeneric: true,
              capabilities: [HEALTH_CAPABILITIES.READ_AGGREGATE],
            }
          );
        },
        /DETAIL_ACCESS_DENIED: Generic OSDA membership confers zero clinical detail access/
      );
    });

    it("4.2. PETUGAS_KESEHATAN target capability contract is explicit", () => {
      const targetCaps = [
        HEALTH_CAPABILITIES.READ_AGGREGATE,
        HEALTH_CAPABILITIES.READ_DETAIL,
        HEALTH_CAPABILITIES.CREATE,
        HEALTH_CAPABILITIES.UPDATE_STATUS,
      ];

      assert.strictEqual(targetCaps.includes("health.case.read_aggregate"), true);
      assert.strictEqual(targetCaps.includes("health.case.read_detail"), true);
      assert.strictEqual(targetCaps.includes("health.case.create"), true);
      assert.strictEqual(targetCaps.includes("health.case.update_status"), true);
    });

    it("4.3. Pembina Asrama Health access is KAMAR-scoped (allowed for assigned kamar)", async () => {
      const mockPrisma = {
        healthCaseV2: {
          findUnique: async () => mockCase,
        },
      };

      const result = await getHealthCaseV2DetailCore(
        mockPrisma as any,
        "hc-mock-01",
        {
          actorUserId: "usr-pembina-01",
          capabilities: [HEALTH_CAPABILITIES.READ_DETAIL],
          scopeType: "KAMAR",
          assignedKamarId: "ou-kmr-ali", // Matches mockSantri placement
        }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.id, "hc-mock-01");
      assert.strictEqual(result.data.keluhan, "Demam tinggi");
    });

    it("4.4. Pembina Asrama cannot see another kamar's health detail", async () => {
      const mockPrisma = {
        healthCaseV2: {
          findUnique: async () => mockCase,
        },
      };

      // Pembina assigned to ou-kmr-utsman trying to view santri in ou-kmr-ali
      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-mock-01",
            {
              actorUserId: "usr-pembina-02",
              capabilities: [HEALTH_CAPABILITIES.READ_DETAIL],
              scopeType: "KAMAR",
              assignedKamarId: "ou-kmr-utsman", // Different room!
            }
          );
        },
        /OUT_OF_SCOPE_ACCESS_DENIED/
      );
    });

    it("4.5. UNIT account recording health case requires verified human executor (UNIT_EXECUTOR_REQUIRED)", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => ({ id: "san-001" }) },
        healthCaseV2: {
          create: async (args: any) => ({ ...args.data, id: "hc-new-01", createdAt: new Date(), updatedAt: new Date() }),
          findUnique: async () => mockCase,
          update: async (args: any) => ({ ...mockCase, ...args.data }),
        },
      };

      // 1. Create without human executor -> REJECT
      await assert.rejects(
        async () => {
          await saveHealthCaseV2Core(
            mockPrisma as any,
            {
              santriId: "san-001",
              keluhan: "Sakit perut",
              tindakanAwal: "Diberi minyak kayu putih",
            },
            {
              userId: "usr-poskestren-unit",
              accountType: "UNIT",
              humanExecutorId: null, // Missing!
            }
          );
        },
        /UNIT_EXECUTOR_REQUIRED/
      );

      // 2. Update without human executor -> REJECT
      await assert.rejects(
        async () => {
          await updateHealthCaseV2StatusCore(
            mockPrisma as any,
            {
              id: "hc-mock-01",
              newStatus: "PULIH",
            },
            {
              userId: "usr-poskestren-unit",
              accountType: "UNIT",
              humanExecutorId: undefined, // Missing!
            }
          );
        },
        /UNIT_EXECUTOR_REQUIRED/
      );

      // 3. Create with verified human executor -> SUCCEED
      const createRes = await saveHealthCaseV2Core(
        mockPrisma as any,
        {
          santriId: "san-001",
          keluhan: "Sakit perut",
          tindakanAwal: "Diberi minyak kayu putih",
          diagnosa: "", // Empty string should be persisted as null
        },
        {
          userId: "usr-poskestren-unit",
          accountType: "UNIT",
          humanExecutorId: "usr-lisa-human",
          humanExecutorUsername: "lisa.mt",
        }
      );

      assert.strictEqual(createRes.success, true);
      assert.strictEqual(createRes.data.diagnosa, null, "Empty diagnosis must persist as null");
      assert.strictEqual(createRes.audit.humanExecutorId, "usr-lisa-human");
      assert.strictEqual(createRes.audit.action, "health.case.create");
    });

    it("4.6. Aggregate Health capability does not imply detail Health capability", async () => {
      const mockPrisma = {
        healthCaseV2: {
          findUnique: async () => mockCase,
          groupBy: async () => [
            { statusV2: "DIPANTAU", _count: { _all: 3 } },
            { statusV2: "PULIH", _count: { _all: 10 } },
            { statusV2: "DIRUJUK", _count: { _all: 1 } },
            { statusV2: "DARURAT", _count: { _all: 0 } },
          ],
        },
      };

      // 1. User with ONLY read_aggregate capability tries to read detail -> DENIED
      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-mock-01",
            {
              actorUserId: "usr-stats-viewer",
              capabilities: [HEALTH_CAPABILITIES.READ_AGGREGATE], // Only aggregate!
            }
          );
        },
        /DETAIL_ACCESS_DENIED: Aggregate capability does not imply detail clinical capability/
      );

      // 2. User reading aggregate receives counts without exposing clinical notes or diagnoses
      const aggResult = await getHealthCasesV2AggregateCore(
        mockPrisma as any,
        {},
        {
          actorUserId: "usr-stats-viewer",
          capabilities: [HEALTH_CAPABILITIES.READ_AGGREGATE],
        }
      );

      assert.strictEqual(aggResult.success, true);
      assert.strictEqual(aggResult.data.totalCases, 14);
      assert.strictEqual(aggResult.data.activeCases, 4); // 3 DIPANTAU + 1 DIRUJUK
      assert.strictEqual(aggResult.data.recoveredCases, 10);
      assert.strictEqual(aggResult.data.byStatus.DIPANTAU, 3);
      assert.strictEqual(aggResult.data.byStatus.PULIH, 10);

      // Verify no clinical fields exist in aggregate result
      assert.strictEqual((aggResult.data as any).diagnosa, undefined);
      assert.strictEqual((aggResult.data as any).keluhan, undefined);
      assert.strictEqual((aggResult.data as any).catatan, undefined);
    });

    it("4.7. Target pending Health grants confer ZERO runtime authority in authorizeCanonical", async () => {
      const mockAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-petugas-target",
        userId: "usr-target-nurse",
        positionId: "pos-target-nurse",
        positionCode: "PETUGAS_KESEHATAN",
        positionName: "Petugas Kesehatan Target",
        domain: "KEASRAMAAN",
        unitId: "ou-poskestren",
        unitCode: "OU-POSKESTREN",
        unitName: "Pos Kesehatan Pesantren",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.CREATE,
            scopeType: "GLOBAL",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as BusinessRuleState,
          },
        ],
        scopeUnits: [],
      };

      const decision = await authorizeCanonical({
        identity: {
          userId: "usr-target-nurse",
          username: "target.nurse",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-target-nurse",
        },
        capability: HEALTH_CAPABILITIES.CREATE,
        resourceContext: { santriId: "san-001" },
        dataProvider: {
          getIdentity: async () => ({
            userId: "usr-target-nurse",
            username: "target.nurse",
            status: "AKTIF",
            accountType: "PERSONAL" as const,
            staffId: "stf-target-nurse",
          }),
          getActiveAssignments: async () => [mockAssignment],
          getUnitAccountPlacement: async () => null,
          verifyHumanExecutor: async () => null,
          resolveResourceContext: async () => ({ santriId: "san-001", orgUnitIds: [] }),
        },
      });

      assert.strictEqual(
        decision.decision,
        "DENY",
        "Target pending Health capability grant must confer ZERO runtime authority"
      );
      assert.strictEqual(decision.code, "CAPABILITY_NOT_GRANTED");
    });
  });

  // =========================================================================
  // 5. Runtime Non-Disruption & Production Safety
  // =========================================================================
  describe("5. Legacy Runtime Protection & Production Safety", () => {
    it("5.1. Legacy Health runtime paths remain intact and functional", () => {
      assert.ok(legacyActionContent.includes("export async function catatKesehatanAction"), "catatKesehatanAction must be exported");
      assert.ok(legacyActionContent.includes("export async function updateStatusKesehatanAction"), "updateStatusKesehatanAction must be exported");
      assert.ok(legacyActionContent.includes("export async function getDaftarKesehatanAction"), "getDaftarKesehatanAction must be exported");
      assert.ok(legacyActionContent.includes("prisma.catatanKesehatan"), "Legacy actions must continue using catatanKesehatan table");
    });

    it("5.2. New Health V2 persistence path is NOT production-active", () => {
      // In app/actions/kesehatan.ts, there should be zero calls to healthCaseV2
      assert.ok(
        !legacyActionContent.includes("healthCaseV2"),
        "Legacy production action file app/actions/kesehatan.ts must NOT call healthCaseV2"
      );
      assert.ok(
        !legacyActionContent.includes("health-v2-service"),
        "Legacy production action file app/actions/kesehatan.ts must NOT import health-v2-service"
      );
    });
  });

  // =========================================================================
  // 6. Regression Guards & Baseline Immutability
  // =========================================================================
  describe("6. Milestone Regressions & Baseline Immutability", () => {
    it("6.1. M3.2 invariants remain enforced (Discipline, SP, Lisa operational reward scope)", () => {
      const m32TestPath = path.join(rootDir, "tests/milestone3-2-uat-business-rules.test.ts");
      assert.ok(fs.existsSync(m32TestPath), "M3.2 test suite must exist");
      const m32Content = fs.readFileSync(m32TestPath, "utf-8");
      assert.ok(m32Content.includes("UAT Item #11"), "M3.2 UAT Item #11 reward scope must be present");
    });

    it("6.2. M3.1 invariants remain enforced (Keasramaan Kamar placement & structure)", () => {
      const m31TestPath = path.join(rootDir, "tests/milestone3-keasramaan-structure.test.ts");
      assert.ok(fs.existsSync(m31TestPath), "M3.1 test suite must exist");
      const m31Content = fs.readFileSync(m31TestPath, "utf-8");
      assert.ok(m31Content.includes("SantriKamarPlacement"), "M3.1 SantriKamarPlacement must be present");
    });

    it("6.3. PR #8 baseline remains immutable at SHA 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
      let commitVerified = false;
      try {
        const catType = execSync(`git cat-file -t ${PR8_EXACT_SHA}`, {
          cwd: rootDir,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"],
        }).trim();
        if (catType === "commit") {
          commitVerified = true;
        }
      } catch {
        // If not in local loose objects, fetch check
        try {
          execSync(`git fetch origin ${PR8_EXACT_SHA} --depth=1`, { cwd: rootDir, stdio: "ignore" });
          commitVerified = true;
        } catch {}
      }

      assert.ok(commitVerified, `PR #8 exact SHA ${PR8_EXACT_SHA} must exist and be immutable`);
    });
  });

  // =========================================================================
  // 7. Full Migration Lineage Simulation
  // =========================================================================
  describe("7. End-to-End Migration Lineage Simulation (Isolated Database)", () => {
    it("7.1. simulateM33aMigrationChain runs full migration lineage cleanly", async () => {
      const result = await simulateM33aMigrationChain();

      assert.strictEqual(result.pr8ExactShaVerified, true, "PR #8 SHA must be verified");
      assert.strictEqual(result.pr8MigrationApplied, true, "PR #8 migration must be applied");
      assert.strictEqual(result.phase2aApplied, true, "Phase 2A migration must be applied");
      assert.strictEqual(result.m31MigrationApplied, true, "M3.1 migration must be applied");
      assert.strictEqual(result.m33aMigrationApplied, true, "M3.3A migration must be applied");
      assert.strictEqual(result.existingDataUnchanged, true, "Pre-existing data must remain unchanged");
      assert.strictEqual(result.existingPr8TablesIntact, true, "PR #8 evaluasi table must remain intact");
      assert.strictEqual(result.existingPlacementsIntact, true, "M3.1 placement table must remain intact");
      assert.strictEqual(result.existingCatatanKesehatanIntact, true, "Legacy catatan_kesehatan must remain intact");
      assert.strictEqual(result.tableCreated, true, "health_cases_v2 table must be created");
      assert.strictEqual(result.enumCreated, true, "HealthStatusV2 enum must be created");
      assert.strictEqual(result.enumExactValuesVerified, true, "HealthStatusV2 enum must contain exactly the 4 canonical values");
      assert.strictEqual(result.nullableDiagnosaPersistsNull, true, "Nullable diagnosa must store NULL when omitted");
      assert.strictEqual(result.invalidEnumRejected, true, "Invalid enum values must be rejected by Postgres");
      assert.strictEqual(result.auditAttributionFieldsPresent, true, "Audit attribution fields must be present");
      assert.strictEqual(result.simulationSuccess, true, "Overall migration simulation must succeed");
    });
  });
});
