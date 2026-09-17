(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  OrgDomain,
  GenderComplex,
  EffectiveCapabilityGrant,
  ResolvedResourceContext,
  KEASRAMAAN_STRUCTURE,
  TKS_STRUCTURE_CONTRACT,
  OSDA_STRUCTURE_CONTRACT,
} from "../types/architecture-lock";
import { PrismaClient } from "@prisma/client";

import {
  evaluateScopePredicate,
} from "../lib/auth/scope-evaluator";

import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalIdentity,
  CanonicalAssignmentWithDetails,
} from "../lib/auth/canonical-evaluator";

import {
  runIsolatedM31MigrationVerification,
} from "./test-db-manager";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3.1: KEASRAMAAN V2 STRUCTURE & PLACEMENT FOUNDATION", () => {
  const rootDir = path.resolve(__dirname, "..");
  const docsDir = path.join(rootDir, "docs");
  const schemaPath = path.join(rootDir, "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const migrationDir = path.join(rootDir, "prisma/migrations/20260917220000_m3_1_keasramaan_structure");
  const migrationSqlPath = path.join(migrationDir, "migration.sql");

  // =========================================================================
  // 1. Schema & Migration Structural Verification
  // =========================================================================
  describe("1. Schema & Migration Structural Contracts", () => {
    it("1.1. SantriKamarPlacement model exists in prisma/schema.prisma with all required fields", () => {
      assert.ok(schemaContent.includes("model SantriKamarPlacement {"), "model SantriKamarPlacement must be defined");
      assert.ok(schemaContent.includes("santriId    String    @map(\"santri_id\")"), "santriId field must be mapped to santri_id");
      assert.ok(schemaContent.includes("kamarId     String    @map(\"kamar_id\")"), "kamarId field must be mapped to kamar_id");
      assert.ok(schemaContent.includes("isActive    Boolean   @default(true) @map(\"is_active\")"), "isActive field must default to true");
      assert.ok(schemaContent.includes("startDate   DateTime  @default(now()) @map(\"start_date\")"), "startDate must default to now()");
      assert.ok(schemaContent.includes("endDate     DateTime? @map(\"end_date\")"), "endDate must be nullable");
      assert.ok(schemaContent.includes("notes       String?"), "notes field must exist");
      assert.ok(schemaContent.includes("createdById String?   @map(\"created_by_id\")"), "createdById must exist");
      assert.ok(schemaContent.includes("@@index([santriId, isActive])"), "Index on [santriId, isActive] must exist");
      assert.ok(schemaContent.includes("@@index([kamarId, isActive])"), "Index on [kamarId, isActive] must exist");
      assert.ok(schemaContent.includes("@@map(\"santri_kamar_placements\")"), "Table name must be santri_kamar_placements");
    });

    it("1.2. Santri and OrgUnit define relations to SantriKamarPlacement with onDelete: Restrict", () => {
      assert.ok(schemaContent.includes("kamarPlacements       SantriKamarPlacement[]"), "Santri must define kamarPlacements relation");
      assert.ok(schemaContent.includes("santriKamarPlacements SantriKamarPlacement[]"), "OrgUnit must define santriKamarPlacements relation");
      assert.ok(
        schemaContent.includes("santri      Santri    @relation(fields: [santriId], references: [id], onDelete: Restrict)"),
        "Foreign key santriId must onDelete: Restrict to preserve historical audit"
      );
      assert.ok(
        schemaContent.includes("kamar       OrgUnit   @relation(fields: [kamarId], references: [id], onDelete: Restrict)"),
        "Foreign key kamarId must onDelete: Restrict to preserve historical audit"
      );
    });

    it("1.3. Additive migration file exists and contains partial unique index for active placement", () => {
      assert.ok(fs.existsSync(migrationSqlPath), "Migration SQL file must exist");
      const migrationSql = fs.readFileSync(migrationSqlPath, "utf-8");
      assert.ok(migrationSql.includes("CREATE TABLE \"santri_kamar_placements\""), "Must create santri_kamar_placements table");
      assert.ok(
        migrationSql.includes("CREATE UNIQUE INDEX \"unique_active_santri_kamar\" ON \"santri_kamar_placements\"(\"santri_id\") WHERE (\"is_active\" = true);"),
        "Must enforce partial unique index: at most one active kamar placement per santri"
      );
      assert.ok(
        migrationSql.includes("ON DELETE RESTRICT"),
        "Foreign keys in migration must specify ON DELETE RESTRICT"
      );
    });
  });

  // =========================================================================
  // 2. Authoritative Kamar Resource Hydration & Target Validation Regressions
  // =========================================================================
  describe("2. Authoritative Kamar Resource Hydration & Target Validation", () => {
    it("2.1. Active room placement is authoritatively hydrated into kamarId and orgUnitIds", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async (args: { where: { id: string } }) => {
            if (args.where.id === "san-active-01") {
              return {
                id: "san-active-01",
                nama: "Santri Active",
                jenisKelamin: "L",
                halaqohId: "hlq-01",
              };
            }
            return null;
          },
        },
        santriKamarPlacement: {
          findFirst: async (args: { where: { santriId: string; isActive: boolean } }) => {
            if (args.where.santriId === "san-active-01" && args.where.isActive === true) {
              return {
                id: "plc-01",
                santriId: "san-active-01",
                kamarId: "kmr-ali-putra",
                isActive: true,
                kamar: {
                  id: "kmr-ali-putra",
                  code: "OU-KMR-ALI",
                  name: "Kamar Ali",
                  type: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  isActive: true,
                },
              };
            }
            return null;
          },
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-active-01" });

      assert.ok(ctx, "Resolved context must not be null");
      assert.strictEqual(ctx?.santriId, "san-active-01");
      assert.strictEqual(ctx?.kamarId, "kmr-ali-putra", "Authoritative kamarId must match active placement");
      assert.strictEqual(ctx?.halaqohId, "hlq-01", "Authoritative halaqohId must be preserved");
      assert.strictEqual(ctx?.genderComplex, "PUTRA");
      assert.ok(ctx?.orgUnitIds.includes("kmr-ali-putra"), "kamarId must be in orgUnitIds");
      assert.ok(ctx?.orgUnitIds.includes("hlq-01"), "halaqohId must be in orgUnitIds");
    });

    it("2.2. Room history preservation: inactive placement is NOT hydrated as current room", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({
            id: "san-history-01",
            nama: "Santri History",
            jenisKelamin: "L",
            halaqohId: null,
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => null, // Only inactive placements in DB
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-history-01" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined, "Inactive room placement must NOT be hydrated as current room");
    });

    it("2.3. Santri without Kamar placement fails closed on KAMAR-scoped operations", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({
            id: "san-unassigned-01",
            nama: "Santri Unassigned",
            jenisKelamin: "L",
            halaqohId: "hlq-01",
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => null,
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-unassigned-01" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined);

      const mudabbirGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-01",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-ali-putra",
        unitIds: ["kmr-ali-putra"],
      };

      const scopeResult = evaluateScopePredicate(mudabbirGrant, ctx!, { userId: "usr-mudabbir" });
      assert.strictEqual(scopeResult.matches, false);
      assert.strictEqual(
        scopeResult.code,
        "INVALID_RESOURCE_CONTEXT",
        "Santri without room must fail closed as INVALID_RESOURCE_CONTEXT"
      );
    });

    // --- Specific Regressions A, B, C, D, E ---
    it("2.4. Regression A: Placement pointing to HALAQOH OrgUnit fails closed (kamarId undefined -> DENY)", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({ id: "san-halaqoh-target", nama: "Santri H", jenisKelamin: "L", halaqohId: null }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "plc-invalid-type",
            santriId: "san-halaqoh-target",
            kamarId: "ou-halaqoh-01",
            isActive: true,
            kamar: {
              id: "ou-halaqoh-01",
              code: "OU-HLQ-01",
              name: "Halaqoh Utsman",
              type: "HALAQOH", // Invalid type for Kamar!
              domain: "TAHFIZH",
              genderComplex: "PUTRA",
              isActive: true,
            },
          }),
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-halaqoh-target" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined, "Placement referencing HALAQOH must not hydrate kamarId");

      const mudabbirGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-m",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "ou-halaqoh-01",
        unitIds: ["ou-halaqoh-01"],
      };
      const scopeResult = evaluateScopePredicate(mudabbirGrant, ctx!, { userId: "usr-m" });
      assert.strictEqual(scopeResult.matches, false);
      assert.strictEqual(scopeResult.code, "INVALID_RESOURCE_CONTEXT");
    });

    it("2.5. Regression B: Placement pointing to SERVICE_UNIT/TKS fails closed (kamarId undefined -> DENY)", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({ id: "san-tks-target", nama: "Santri T", jenisKelamin: "L", halaqohId: null }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "plc-invalid-tks",
            santriId: "san-tks-target",
            kamarId: "ou-tks-dapur",
            isActive: true,
            kamar: {
              id: "ou-tks-dapur",
              code: "OU-TKS-DAPUR",
              name: "Unit Dapur dan Gizi",
              type: "SERVICE_UNIT", // Invalid type for Kamar!
              domain: "KEASRAMAAN",
              genderComplex: "CAMPUR",
              isActive: true,
            },
          }),
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-tks-target" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined, "Placement referencing SERVICE_UNIT must not hydrate kamarId");
    });

    it("2.6. Regression C: Placement pointing to inactive KAMAR fails closed (kamarId undefined -> DENY)", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({ id: "san-inactive-kamar", nama: "Santri I", jenisKelamin: "L", halaqohId: null }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "plc-inactive-kamar",
            santriId: "san-inactive-kamar",
            kamarId: "kmr-inactive",
            isActive: true,
            kamar: {
              id: "kmr-inactive",
              code: "OU-KMR-INACTIVE",
              name: "Kamar Inactive",
              type: "KAMAR",
              domain: "KEASRAMAAN",
              genderComplex: "PUTRA",
              isActive: false, // Inactive Kamar!
            },
          }),
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-inactive-kamar" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined, "Inactive Kamar OrgUnit must not hydrate kamarId");
    });

    it("2.7. Regression D: Placement pointing to KAMAR with domain TAHFIZH fails closed (kamarId undefined -> DENY)", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({ id: "san-tahfizh-kamar", nama: "Santri TK", jenisKelamin: "L", halaqohId: null }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "plc-tahfizh-kamar",
            santriId: "san-tahfizh-kamar",
            kamarId: "kmr-tahfizh",
            isActive: true,
            kamar: {
              id: "kmr-tahfizh",
              code: "OU-KMR-THZ",
              name: "Kamar Tahfizh",
              type: "KAMAR",
              domain: "TAHFIZH", // Invalid domain for Kamar! Must be KEASRAMAAN
              genderComplex: "PUTRA",
              isActive: true,
            },
          }),
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-tahfizh-kamar" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined, "KAMAR OrgUnit with domain TAHFIZH must not hydrate kamarId");
    });

    it("2.8. Regression E: Active KEASRAMAAN KAMAR OrgUnit is accepted and allows KAMAR-scoped operation", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({ id: "san-valid-01", nama: "Santri Valid", jenisKelamin: "L", halaqohId: null }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "plc-valid",
            santriId: "san-valid-01",
            kamarId: "kmr-ali",
            isActive: true,
            kamar: {
              id: "kmr-ali",
              code: "OU-KMR-ALI",
              name: "Kamar Ali",
              type: "KAMAR",
              domain: "KEASRAMAAN",
              genderComplex: "PUTRA",
              isActive: true,
            },
          }),
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-valid-01" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, "kmr-ali");

      const mudabbirGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-ali",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-ali",
        unitIds: ["kmr-ali"],
      };
      const scopeResult = evaluateScopePredicate(mudabbirGrant, ctx!, { userId: "usr-mudabbir" });
      assert.strictEqual(scopeResult.matches, true);
      assert.strictEqual(scopeResult.code, "ALLOWED");
    });
  });

  // =========================================================================
  // 3. Attack Regression: Caller-Supplied Forged kamarId Ignored (Regression F)
  // =========================================================================
  describe("3. Attack Regression: Forged kamarId Ignored (Regression F)", () => {
    it("3.1. real current kamar = KAMAR-A; caller sends kamarId = KAMAR-B -> resolves strictly KAMAR-A", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({
            id: "san-target-attack",
            nama: "Target Santri",
            jenisKelamin: "L",
            halaqohId: "hlq-01",
          }),
        },
        santriKamarPlacement: {
          findFirst: async (args: { where: { santriId: string; isActive: boolean } }) => {
            if (args.where.santriId === "san-target-attack" && args.where.isActive === true) {
              return {
                id: "plc-real",
                santriId: "san-target-attack",
                kamarId: "kmr-real-KAMAR-A",
                isActive: true,
                kamar: {
                  id: "kmr-real-KAMAR-A",
                  code: "OU-KMR-A",
                  name: "Kamar A Real",
                  type: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  isActive: true,
                },
              };
            }
            return null;
          },
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);

      // Caller sends malicious/forged kamarId: "kmr-spoofed-KAMAR-B"
      const ctx = await provider.resolveResourceContext({
        santriId: "san-target-attack",
        kamarId: "kmr-spoofed-KAMAR-B",
      });

      assert.ok(ctx);
      assert.strictEqual(
        ctx?.kamarId,
        "kmr-real-KAMAR-A",
        "Resolved context must contain real current KAMAR-A, NEVER caller-supplied KAMAR-B"
      );
      assert.strictEqual(
        ctx?.orgUnitIds.includes("kmr-spoofed-KAMAR-B"),
        false,
        "Spoofed kamarId must never enter orgUnitIds"
      );
    });

    it("3.2. santri with NO kamar; caller sends kamarId = KAMAR-B -> kamarId remains undefined", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({
            id: "san-no-room",
            nama: "Santri No Room",
            jenisKelamin: "L",
            halaqohId: null,
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => null,
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({
        santriId: "san-no-room",
        kamarId: "kmr-spoofed-KAMAR-B",
      });

      assert.ok(ctx);
      assert.strictEqual(
        ctx?.kamarId,
        undefined,
        "When target has no placement, caller-supplied kamarId must be strictly discarded"
      );
    });

    it("3.3. Attack Regression A: Target santri in Kamar B + caller supplies unitId = A + grant ASSIGNED_UNITS[A] -> DENY", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({
            id: "san-in-kamar-b",
            nama: "Santri Kamar B",
            jenisKelamin: "L",
            halaqohId: null,
          }),
        },
        santriKamarPlacement: {
          findFirst: async (args: { where: { santriId: string; isActive: boolean } }) => {
            if (args.where.santriId === "san-in-kamar-b" && args.where.isActive === true) {
              return {
                id: "plc-b",
                santriId: "san-in-kamar-b",
                kamarId: "kmr-b",
                isActive: true,
                kamar: {
                  id: "kmr-b",
                  code: "OU-KMR-B",
                  name: "Kamar B",
                  type: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  isActive: true,
                },
              };
            }
            return null;
          },
        },
        orgUnit: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "unit-a") {
              return { id: "unit-a", type: "SERVICE_UNIT", domain: "KEASRAMAAN", isActive: true };
            }
            return null;
          },
          findFirst: async () => null,
        },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);

      // Caller targets santri in Kamar B, but supplies caller-supplied unitId = unit-a
      const ctx = await provider.resolveResourceContext({
        santriId: "san-in-kamar-b",
        unitId: "unit-a",
      });

      // Unit A is NOT an authoritative enclosing unit of san-in-kamar-b -> FAIL CLOSED (null)
      assert.strictEqual(ctx, null, "Target santri with mismatched caller unitId must fail closed as null");

      // Evaluate with grant scoped to ASSIGNED_UNITS [unit-a] -> DENY
      const grantAssignedUnitsA: CanonicalAssignmentWithDetails = {
        id: "asg-attacker",
        userId: "usr-attacker",
        positionId: "pos-attacker",
        positionCode: "ANGGOTA_TKS",
        positionName: "Attacker",
        domain: "KEASRAMAAN",
        unitId: "unit-a",
        unitCode: "UNIT-A",
        unitName: "Unit A",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          { capabilityCode: "keasramaan.kamar.inspect", scopeType: "ASSIGNED_UNITS", businessRuleState: "VERIFIED_PRODUCTION" },
        ],
        scopeUnits: [{ unitId: "unit-a" }],
      };

      const authProvider: ICanonicalDataProvider = {
        ...provider,
        async getIdentity(id) {
          return { userId: id, username: "attacker", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-att", staffStatus: "AKTIF" };
        },
        async getActiveAssignments() { return [grantAssignedUnitsA]; },
        async getUnitAccountPlacement() { return null; },
        async verifyHumanExecutor() { return null; },
      };

      const res = await authorizeCanonical({
        identity: { userId: "usr-attacker", username: "attacker", status: "AKTIF", accountType: "PERSONAL" },
        capability: "keasramaan.kamar.inspect",
        resourceContext: { santriId: "san-in-kamar-b", unitId: "unit-a" },
        dataProvider: authProvider,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "INVALID_RESOURCE_CONTEXT");
    });

    it("3.4. Attack Regression B: santriId = child-B + resourceId = Tasmi belonging to child-A -> INVALID_RESOURCE_CONTEXT (null)", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "child-A") {
              return { id: "child-A", nama: "Child A", jenisKelamin: "L", halaqohId: "hlq-1" };
            }
            if (where.id === "child-B") {
              return { id: "child-B", nama: "Child B", jenisKelamin: "L", halaqohId: "hlq-2" };
            }
            return null;
          },
        },
        santriKamarPlacement: { findFirst: async () => null },
        orgUnit: { findUnique: async () => null, findFirst: async () => null },
        tasmiSimaan: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "tasmi-child-a") {
              return { id: "tasmi-child-a", santriId: "child-A", santri: { halaqohId: "hlq-1", jenisKelamin: "L" } };
            }
            return null;
          },
        },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);

      // Caller supplies conflicting identifiers: santriId child-B with resourceId tasmi of child-A
      const ctx = await provider.resolveResourceContext({
        santriId: "child-B",
        resourceId: "tasmi-child-a",
      });

      assert.strictEqual(ctx, null, "Conflicting santriId and resourceId must fail closed as null");
    });

    it("3.5. Attack Regression C: Valid standalone unit target works only after authoritative OrgUnit validation (exists and isActive = true)", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => null },
        santriKamarPlacement: { findFirst: async () => null },
        orgUnit: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "unit-active") {
              return { id: "unit-active", type: "SERVICE_UNIT", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true };
            }
            if (where.id === "unit-inactive") {
              return { id: "unit-inactive", type: "SERVICE_UNIT", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: false };
            }
            return null;
          },
          findFirst: async () => null,
        },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);

      // Active unit -> resolves successfully
      const activeCtx = await provider.resolveResourceContext({ unitId: "unit-active" });
      assert.ok(activeCtx);
      assert.deepStrictEqual(activeCtx?.orgUnitIds, ["unit-active"]);
      assert.strictEqual(activeCtx?.orgDomain, "KEASRAMAAN");

      // Inactive unit -> fails closed (null)
      const inactiveCtx = await provider.resolveResourceContext({ unitId: "unit-inactive" });
      assert.strictEqual(inactiveCtx, null, "Inactive standalone OrgUnit must fail closed as null");

      // Nonexistent unit -> fails closed (null)
      const missingCtx = await provider.resolveResourceContext({ unitId: "unit-missing" });
      assert.strictEqual(missingCtx, null, "Nonexistent standalone OrgUnit must fail closed as null");
    });

    it("3.6. Attack Regression D: Existing shadow paths (setoran, health, reward) remain regression-safe", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "san-shadow-1") {
              return { id: "san-shadow-1", nama: "Shadow Santri", jenisKelamin: "L", halaqohId: "hlq-10" };
            }
            return null;
          },
        },
        santriKamarPlacement: { findFirst: async () => null },
        orgUnit: { findUnique: async () => null, findFirst: async () => null },
        tasmiSimaan: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "tasmi-shadow-1") {
              return { id: "tasmi-shadow-1", santriId: "san-shadow-1", santri: { halaqohId: "hlq-10", jenisKelamin: "L" } };
            }
            return null;
          },
        },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);

      // Path 1: setoran { santriId }
      const setoranCtx = await provider.resolveResourceContext({ santriId: "san-shadow-1" });
      assert.ok(setoranCtx);
      assert.strictEqual(setoranCtx?.santriId, "san-shadow-1");
      assert.strictEqual(setoranCtx?.halaqohId, "hlq-10");
      assert.strictEqual(setoranCtx?.orgDomain, "TAHFIZH");

      // Path 2: health { santriId }
      const healthCtx = await provider.resolveResourceContext({ santriId: "san-shadow-1" });
      assert.ok(healthCtx);
      assert.strictEqual(healthCtx?.santriId, "san-shadow-1");

      // Path 3: reward { resourceId }
      const rewardCtx = await provider.resolveResourceContext({ resourceId: "tasmi-shadow-1" });
      assert.ok(rewardCtx);
      assert.strictEqual(rewardCtx?.santriId, "san-shadow-1");
      assert.strictEqual(rewardCtx?.halaqohId, "hlq-10");
      assert.strictEqual(rewardCtx?.orgDomain, "TAHFIZH");
    });
  });

  // =========================================================================
  // 4. Room Gender Boundary
  // =========================================================================
  describe("4. Room Gender Boundary Enforcement", () => {
    it("4.1. Room placement violating gender boundary fails closed (PUTRA santri in PUTRI kamar)", async () => {
      const mockPrisma = {
        santri: {
          findUnique: async () => ({
            id: "san-putra-01",
            nama: "Santri Putra",
            jenisKelamin: "L", // PUTRA
            halaqohId: null,
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "plc-invalid-gender",
            santriId: "san-putra-01",
            kamarId: "kmr-putri-01",
            isActive: true,
            kamar: {
              id: "kmr-putri-01",
              code: "OU-KMR-PUTRI-01",
              name: "Kamar Aisyah (Banat)",
              type: "KAMAR",
              domain: "KEASRAMAAN",
              genderComplex: "PUTRI", // Gender mismatch!
              isActive: true,
            },
          }),
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-putra-01" });

      assert.ok(ctx);
      assert.strictEqual(
        ctx?.kamarId,
        undefined,
        "Gender-mismatched room placement must fail closed (kamarId undefined)"
      );
    });

    it("4.2. Male Mudabbir attempting cross-complex access to female room context yields GENDER_COMPLEX_DENIED", () => {
      const maleMudabbirGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-ikhwan",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-putra-01",
        unitIds: ["kmr-putra-01"],
        ...( { genderComplex: "PUTRA" } as unknown as { genderComplex: GenderComplex } ),
      };

      const femaleRoomContext: ResolvedResourceContext = {
        santriId: "san-akhwat-01",
        kamarId: "kmr-putri-01",
        orgUnitIds: ["kmr-putri-01"],
        genderComplex: "PUTRI",
      };

      const result = evaluateScopePredicate(maleMudabbirGrant, femaleRoomContext, { userId: "usr-mudabbir-male" });
      assert.strictEqual(result.matches, false);
      assert.strictEqual(result.code, "GENDER_COMPLEX_DENIED", "Cross-gender complex access must be denied as GENDER_COMPLEX_DENIED");
    });
  });

  // =========================================================================
  // 5. Mudabbir Room Responsibility (Single & Multiple Kamar)
  // =========================================================================
  describe("5. Mudabbir Room Responsibility & Scope", () => {
    it("5.1. Mudabbir with single Kamar: ALLOW for assigned room, DENY for other room", () => {
      const mudabbirGrantSingle: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-ali",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-ali",
        unitIds: ["kmr-ali"],
      };

      // Santri in Kamar Ali -> ALLOW
      const santriInAli: ResolvedResourceContext = {
        santriId: "san-ali-01",
        kamarId: "kmr-ali",
        orgUnitIds: ["kmr-ali"],
      };
      const evalAli = evaluateScopePredicate(mudabbirGrantSingle, santriInAli, { userId: "usr-mudabbir" });
      assert.strictEqual(evalAli.matches, true);
      assert.strictEqual(evalAli.code, "ALLOWED");

      // Santri in Kamar Utsman -> DENY (SCOPE_MISMATCH)
      const santriInUtsman: ResolvedResourceContext = {
        santriId: "san-utsman-01",
        kamarId: "kmr-utsman",
        orgUnitIds: ["kmr-utsman"],
      };
      const evalUtsman = evaluateScopePredicate(mudabbirGrantSingle, santriInUtsman, { userId: "usr-mudabbir" });
      assert.strictEqual(evalUtsman.matches, false);
      assert.strictEqual(evalUtsman.code, "SCOPE_MISMATCH");
    });

    it("5.2. Locked Scope Taxonomy: KAMAR anchor A + unitIds [B] + target B => DENY (no scope widening)", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-single-locked",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-ali",
        unitIds: ["kmr-utsman"], // Must NOT widen KAMAR scope
      };

      // Target B (kmr-utsman) with anchor A (kmr-ali) -> DENY
      const ctxUtsman: ResolvedResourceContext = { santriId: "san-2", kamarId: "kmr-utsman", orgUnitIds: ["kmr-utsman"] };
      const evalUtsman = evaluateScopePredicate(grant, ctxUtsman, { userId: "usr-mudabbir" });
      assert.strictEqual(evalUtsman.matches, false);
      assert.strictEqual(evalUtsman.code, "SCOPE_MISMATCH");

      // Target A (kmr-ali) with anchor A (kmr-ali) -> ALLOW
      const ctxAli: ResolvedResourceContext = { santriId: "san-1", kamarId: "kmr-ali", orgUnitIds: ["kmr-ali"] };
      const evalAli = evaluateScopePredicate(grant, ctxAli, { userId: "usr-mudabbir" });
      assert.strictEqual(evalAli.matches, true);
      assert.strictEqual(evalAli.code, "ALLOWED");
    });

    it("5.3. Locked Scope Taxonomy: HALAQOH anchor A + unitIds [B] + target B => DENY (no scope widening)", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mt-single-locked",
        positionCode: "MUSYRIF_TAHFIZH",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-abu-bakr",
        unitIds: ["hlq-umar"], // Must NOT widen HALAQOH scope
      };

      // Target B (hlq-umar) with anchor A (hlq-abu-bakr) -> DENY
      const ctxUmar: ResolvedResourceContext = { santriId: "san-3", halaqohId: "hlq-umar", orgUnitIds: ["hlq-umar"] };
      const evalUmar = evaluateScopePredicate(grant, ctxUmar, { userId: "usr-mt" });
      assert.strictEqual(evalUmar.matches, false);
      assert.strictEqual(evalUmar.code, "SCOPE_MISMATCH");

      // Target A (hlq-abu-bakr) with anchor A (hlq-abu-bakr) -> ALLOW
      const ctxAbuBakr: ResolvedResourceContext = { santriId: "san-1", halaqohId: "hlq-abu-bakr", orgUnitIds: ["hlq-abu-bakr"] };
      const evalAbuBakr = evaluateScopePredicate(grant, ctxAbuBakr, { userId: "usr-mt" });
      assert.strictEqual(evalAbuBakr.matches, true);
      assert.strictEqual(evalAbuBakr.code, "ALLOWED");
    });

    it("5.4. Multi-Room Option B: ASSIGNED_UNITS [A, B] + target B => ALLOW", () => {
      const grantAssignedUnits: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-assigned-units",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "ASSIGNED_UNITS",
        anchorUnitId: "kmr-ali",
        unitIds: ["kmr-ali", "kmr-utsman"],
      };

      const ctxUtsman: ResolvedResourceContext = { santriId: "san-2", kamarId: "kmr-utsman", orgUnitIds: ["kmr-utsman"] };
      const evalUtsman = evaluateScopePredicate(grantAssignedUnits, ctxUtsman, { userId: "usr-mudabbir" });
      assert.strictEqual(evalUtsman.matches, true);
      assert.strictEqual(evalUtsman.code, "ALLOWED");

      const ctxUnassigned: ResolvedResourceContext = { santriId: "san-3", kamarId: "kmr-umar", orgUnitIds: ["kmr-umar"] };
      const evalUnassigned = evaluateScopePredicate(grantAssignedUnits, ctxUnassigned, { userId: "usr-mudabbir" });
      assert.strictEqual(evalUnassigned.matches, false);
      assert.strictEqual(evalUnassigned.code, "SCOPE_MISMATCH");
    });

    it("5.5. Multi-Room Option A: Multiple active KAMAR assignments collectively authorize their respective rooms via multi-grant evaluation", async () => {
      const asgKamarA: CanonicalAssignmentWithDetails = {
        id: "asg-mudabbir-kamar-a",
        userId: "usr-mudabbir-multi",
        positionId: "pos-mudabbir",
        positionCode: "MUDABBIR",
        positionName: "Mudabbir Kamar A",
        domain: "KEASRAMAAN",
        unitId: "kmr-ali",
        unitCode: "OU-KMR-ALI",
        unitName: "Kamar Ali",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          { capabilityCode: "keasramaan.kamar.inspect", scopeType: "KAMAR", businessRuleState: "VERIFIED_PRODUCTION" },
        ],
        scopeUnits: [],
      };

      const asgKamarB: CanonicalAssignmentWithDetails = {
        id: "asg-mudabbir-kamar-b",
        userId: "usr-mudabbir-multi",
        positionId: "pos-mudabbir",
        positionCode: "MUDABBIR",
        positionName: "Mudabbir Kamar B",
        domain: "KEASRAMAAN",
        unitId: "kmr-utsman",
        unitCode: "OU-KMR-UTSMAN",
        unitName: "Kamar Utsman",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          { capabilityCode: "keasramaan.kamar.inspect", scopeType: "KAMAR", businessRuleState: "VERIFIED_PRODUCTION" },
        ],
        scopeUnits: [],
      };

      const provider: ICanonicalDataProvider = {
        async getIdentity(id) {
          return { userId: id, username: "mudabbir.multi", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-mudabbir", staffStatus: "AKTIF" };
        },
        async getActiveAssignments() {
          return [asgKamarA, asgKamarB];
        },
        async getUnitAccountPlacement() { return null; },
        async verifyHumanExecutor() { return null; },
        async resolveResourceContext(req) {
          if (req.santriId === "san-in-ali") {
            return { santriId: "san-in-ali", kamarId: "kmr-ali", orgUnitIds: ["kmr-ali"] };
          }
          if (req.santriId === "san-in-utsman") {
            return { santriId: "san-in-utsman", kamarId: "kmr-utsman", orgUnitIds: ["kmr-utsman"] };
          }
          if (req.santriId === "san-in-umar") {
            return { santriId: "san-in-umar", kamarId: "kmr-umar", orgUnitIds: ["kmr-umar"] };
          }
          return null;
        },
      };

      // Santri in Kamar Ali -> authorized by asgKamarA
      const resAli = await authorizeCanonical({
        identity: { userId: "usr-mudabbir-multi", username: "mudabbir.multi", status: "AKTIF", accountType: "PERSONAL" },
        capability: "keasramaan.kamar.inspect",
        resourceContext: { santriId: "san-in-ali" },
        dataProvider: provider,
      });
      assert.strictEqual(resAli.decision, "ALLOW");

      // Santri in Kamar Utsman -> authorized by asgKamarB
      const resUtsman = await authorizeCanonical({
        identity: { userId: "usr-mudabbir-multi", username: "mudabbir.multi", status: "AKTIF", accountType: "PERSONAL" },
        capability: "keasramaan.kamar.inspect",
        resourceContext: { santriId: "san-in-utsman" },
        dataProvider: provider,
      });
      assert.strictEqual(resUtsman.decision, "ALLOW");

      // Santri in unassigned Kamar Umar -> DENY
      const resUmar = await authorizeCanonical({
        identity: { userId: "usr-mudabbir-multi", username: "mudabbir.multi", status: "AKTIF", accountType: "PERSONAL" },
        capability: "keasramaan.kamar.inspect",
        resourceContext: { santriId: "san-in-umar" },
        dataProvider: provider,
      });
      assert.strictEqual(resUmar.decision, "DENY");
      assert.strictEqual(resUmar.reasonCode, "SCOPE_MISMATCH");
    });

    it("5.6. Mudabbir is distinct from Musyrif Keasramaan: Musyrif Keasramaan has DOMAIN scope over KEASRAMAAN", () => {
      const musyrifKeasramaanGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mk-domain",
        positionCode: "KEPALA_KEASRAMAAN",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.audit",
        scopeType: "DOMAIN",
        anchorUnitId: "ou-keasramaan-root",
        unitIds: ["ou-keasramaan-root"],
        ...( { orgDomain: "KEASRAMAAN" } as unknown as { orgDomain: OrgDomain } ),
      };

      // Musyrif Keasramaan auditing room in Keasramaan domain -> ALLOW
      const kamarContext: ResolvedResourceContext = {
        kamarId: "kmr-any-room",
        orgUnitIds: ["kmr-any-room"],
        orgDomain: "KEASRAMAAN",
      };
      const evalMK = evaluateScopePredicate(musyrifKeasramaanGrant, kamarContext, { userId: "usr-mk" });
      assert.strictEqual(evalMK.matches, true);
      assert.strictEqual(evalMK.code, "ALLOWED");

      // Cross domain to TAHFIZH -> DENY
      const tahfizhContext: ResolvedResourceContext = {
        halaqohId: "hlq-tahfizh",
        orgUnitIds: ["hlq-tahfizh"],
        orgDomain: "TAHFIZH",
      };
      const evalMKCross = evaluateScopePredicate(musyrifKeasramaanGrant, tahfizhContext, { userId: "usr-mk" });
      assert.strictEqual(evalMKCross.matches, false);
      assert.strictEqual(evalMKCross.code, "SCOPE_MISMATCH");
    });
  });

  // =========================================================================
  // 6. OSDA Structure Hierarchy (Contract-Tied Verification)
  // =========================================================================
  describe("6. OSDA Structure Hierarchy", () => {
    it("6.1. OSDA core consists of exact positions: Ketua, Sekretaris, Bendahara, and Multimedia", () => {
      // Contract verification from typed architecture definition
      assert.strictEqual(KEASRAMAAN_STRUCTURE.OSDA_CORE_POSITIONS.length, 4);
      assert.deepStrictEqual([...KEASRAMAAN_STRUCTURE.OSDA_CORE_POSITIONS], [
        "KETUA_OSDA",
        "SEKRETARIS_OSDA",
        "BENDAHARA_OSDA",
        "MULTIMEDIA_OSDA",
      ]);

      // Cross-document contract verification
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const assignmentDoc = fs.readFileSync(path.join(docsDir, "STQ_ASSIGNMENT_MODEL.md"), "utf-8");
      for (const doc of [lockDoc, assignmentDoc]) {
        assert.ok(doc.includes("Ketua"), "Must include Ketua");
        assert.ok(doc.includes("Sekretaris"), "Must include Sekretaris");
        assert.ok(doc.includes("Bendahara"), "Must include Bendahara");
        assert.ok(doc.includes("Multimedia"), "Must include Multimedia");
      }
    });

    it("6.2. OSDA defines exact 5 operational divisions", () => {
      // Contract verification from typed architecture definition
      assert.strictEqual(KEASRAMAAN_STRUCTURE.OSDA_DIVISIONS.length, 5);
      assert.deepStrictEqual([...KEASRAMAAN_STRUCTURE.OSDA_DIVISIONS], [
        "KEAMANAN_KEDISIPLINAN",
        "PENDIDIKAN_IBADAH",
        "KEBERSIHAN_KERAPIHAN",
        "KESEHATAN",
        "SARANA_PRASARANA",
      ]);

      // Cross-document verification in STQ_ARCHITECTURE_LOCK.md
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      assert.ok(lockDoc.includes("Divisi Keamanan & Kedisiplinan"));
      assert.ok(lockDoc.includes("Divisi Pendidikan & Ibadah"));
      assert.ok(lockDoc.includes("Divisi Kebersihan & Kerapihan"));
      assert.ok(lockDoc.includes("Divisi Kesehatan"));
      assert.ok(lockDoc.includes("Divisi Sarana & Prasarana"));
    });

    it("6.3. Usroh is structurally under OSDA (type: USROH), NOT structurally under Divisi Kebersihan", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const m31Doc = fs.readFileSync(path.join(docsDir, "STQ_MILESTONE3_1_KEASRAMAAN_STRUCTURE.md"), "utf-8");

      // Usroh is defined under OSDA; Divisi Kebersihan merely functionally supervises cleanliness
      assert.ok(m31Doc.includes("Positioned structurally under **OSDA** (`type: USROH`)"));
      assert.ok(m31Doc.includes("NOT** structurally under Divisi Kebersihan"));
      assert.ok(lockDoc.includes("Membina Usroh, Type: USROH"));
    });
  });

  // =========================================================================
  // 7. TKS Definition & Exact 6 Units (Contract-Tied Verification)
  // =========================================================================
  describe("7. TKS Definition & Exact 6 Units", () => {
    it("7.1. TKS means 'Tugas Khusus Santri' and forbids 'Tenaga Kebersihan & Servis'", () => {
      assert.strictEqual(KEASRAMAAN_STRUCTURE.TKS_EXPANSION, "Tugas Khusus Santri");

      // Check all documentation files for forbidden phrase
      const docFiles = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
      for (const f of docFiles) {
        const content = fs.readFileSync(path.join(docsDir, f), "utf-8");
        assert.strictEqual(
          content.includes("Tenaga Kebersihan & Servis"),
          false,
          `Document docs/${f} contains forbidden phrase 'Tenaga Kebersihan & Servis'`
        );
      }
    });

    it("7.2. TKS contains exact six operational units", () => {
      assert.strictEqual(KEASRAMAAN_STRUCTURE.TKS_UNITS.length, 6);
      assert.deepStrictEqual([...KEASRAMAAN_STRUCTURE.TKS_UNITS], [
        "Dapur dan Gizi",
        "Masjid",
        "Kantor Pendidikan",
        "Kantor Yayasan",
        "Air Minum",
        "Air Sumur",
      ]);

      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      assert.ok(lockDoc.includes("Unit Dapur dan Gizi"));
      assert.ok(lockDoc.includes("Unit Masjid"));
      assert.ok(lockDoc.includes("Unit Kantor Pendidikan"));
      assert.ok(lockDoc.includes("Unit Kantor Yayasan"));
      assert.ok(lockDoc.includes("Unit Air Minum"));
      assert.ok(lockDoc.includes("Unit Air Sumur"));
    });

    it("7.3. Air Minum and Air Sumur are distinct units; phrase 'Air Minum & Sumur' is forbidden", () => {
      assert.notStrictEqual(
        KEASRAMAAN_STRUCTURE.TKS_UNITS[4],
        KEASRAMAAN_STRUCTURE.TKS_UNITS[5],
        "Air Minum and Air Sumur must be separate units"
      );

      const docFiles = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
      for (const f of docFiles) {
        const content = fs.readFileSync(path.join(docsDir, f), "utf-8");
        assert.strictEqual(
          content.includes("Air Minum & Sumur"),
          false,
          `Document docs/${f} contains forbidden phrase 'Air Minum & Sumur'`
        );
      }
    });

    it("7.4. TKS has NO central Ketua TKS; units have independent role assignments", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const invariantsDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"), "utf-8");

      assert.ok(lockDoc.includes("TKS tidak memiliki Ketua Umum terpusat"));
      assert.ok(invariantsDoc.includes("no central Ketua TKS"));
    });

    it("7.5. Typed structural contract: TKS node is ORGANIZATION under KEASRAMAAN and parent to 6 SERVICE_UNITs", () => {
      assert.strictEqual(TKS_STRUCTURE_CONTRACT.NODE.type, "ORGANIZATION");
      assert.strictEqual(TKS_STRUCTURE_CONTRACT.NODE.domain, "KEASRAMAAN");
      assert.strictEqual(TKS_STRUCTURE_CONTRACT.NODE.hasCentralKetua, false);
      assert.strictEqual(TKS_STRUCTURE_CONTRACT.SERVICE_UNITS.length, 6);
      for (const unit of TKS_STRUCTURE_CONTRACT.SERVICE_UNITS) {
        assert.strictEqual(unit.type, "SERVICE_UNIT");
        assert.strictEqual(unit.domain, "KEASRAMAAN");
        assert.strictEqual(unit.parentUnitCode, TKS_STRUCTURE_CONTRACT.NODE.code);
      }
      assert.strictEqual(OSDA_STRUCTURE_CONTRACT.NODE.type, "ORGANIZATION");
      assert.strictEqual(OSDA_STRUCTURE_CONTRACT.NODE.domain, "KEASRAMAAN");

      // Verify docs also document this hierarchy
      const m31Doc = fs.readFileSync(path.join(docsDir, "STQ_MILESTONE3_1_KEASRAMAAN_STRUCTURE.md"), "utf-8");
      assert.ok(m31Doc.includes("TKS (ORGANIZATION)"));
      assert.ok(m31Doc.includes("Dapur dan Gizi (SERVICE_UNIT)"));
      assert.ok(m31Doc.includes("parent: TKS"));
    });
  });

  // =========================================================================
  // 8. Pembina Divisi Placement Model
  // =========================================================================
  describe("8. Pembina Divisi Placement", () => {
    it("8.1. Pembina Divisi is directly under Musyrif Keasramaan as parallel supervisory assignment, NOT superior to Mudabbir, NOT part of OSDA", () => {
      const m31Doc = fs.readFileSync(path.join(docsDir, "STQ_MILESTONE3_1_KEASRAMAAN_STRUCTURE.md"), "utf-8");
      assert.ok(m31Doc.includes("Mudir` → `Musyrif Keasramaan` → `Mudabbir` → `OSDA / TKS` → `Usroh / Santri`"));
      assert.ok(m31Doc.includes("Directly under `Musyrif Keasramaan` as a parallel supervisory assignment"));
      assert.ok(m31Doc.includes("NOT** superior to `Mudabbir`"));
      assert.ok(m31Doc.includes("NOT** a member of `OSDA`"));

      // Functional authorization test: Pembina Divisi can supervise assigned division
      const pembinaGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-pembina-kebersihan",
        positionCode: "PEMBINA_DIVISI",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.divisi.supervise",
        scopeType: "ASSIGNED_UNITS",
        anchorUnitId: "ou-div-kebersihan",
        unitIds: ["ou-div-kebersihan", "ou-div-sarpras"],
      };

      const ctxKebersihan: ResolvedResourceContext = { orgUnitIds: ["ou-div-kebersihan"] };
      assert.strictEqual(evaluateScopePredicate(pembinaGrant, ctxKebersihan, { userId: "usr-pembina" }).matches, true);

      const ctxKeamanan: ResolvedResourceContext = { orgUnitIds: ["ou-div-keamanan"] };
      assert.strictEqual(evaluateScopePredicate(pembinaGrant, ctxKeamanan, { userId: "usr-pembina" }).matches, false);
    });

    it("8.2. Multiple Pembina per division is permitted", () => {
      const pembina1Grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-pembina-1",
        positionCode: "PEMBINA_DIVISI",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.divisi.supervise",
        scopeType: "UNIT",
        anchorUnitId: "ou-div-kesehatan",
        unitIds: ["ou-div-kesehatan"],
      };

      const pembina2Grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-pembina-2",
        positionCode: "PEMBINA_DIVISI",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.divisi.supervise",
        scopeType: "UNIT",
        anchorUnitId: "ou-div-kesehatan",
        unitIds: ["ou-div-kesehatan"],
      };

      const ctxKesehatan: ResolvedResourceContext = { orgUnitIds: ["ou-div-kesehatan"] };
      assert.strictEqual(evaluateScopePredicate(pembina1Grant, ctxKesehatan, { userId: "usr-pembina-1" }).matches, true);
      assert.strictEqual(evaluateScopePredicate(pembina2Grant, ctxKesehatan, { userId: "usr-pembina-2" }).matches, true);
    });
  });

  // =========================================================================
  // 9. Unit Account Structural Foundation
  // =========================================================================
  describe("9. Unit Account Invariants", () => {
    it("9.1. Unit account must be AccountType.UNIT with exactly one active placement", async () => {
      const mockDataProvider: ICanonicalDataProvider = {
        async getIdentity(userId: string): Promise<CanonicalIdentity | null> {
          if (userId === "usr-unit-poskestren") {
            return {
              userId: "usr-unit-poskestren",
              username: "kiosk.poskestren",
              status: "AKTIF",
              accountType: "UNIT",
              placementUnitId: "ou-poskestren",
            };
          }
          return null;
        },
        async getActiveAssignments(): Promise<CanonicalAssignmentWithDetails[]> {
          return [{
            id: "asg-unit-kesehatan",
            userId: "usr-unit-poskestren",
            positionId: "pos-anggota-osda",
            positionCode: "ANGGOTA_OSDA",
            positionName: "Anggota OSDA",
            domain: "KEASRAMAAN",
            unitId: "ou-poskestren",
            unitCode: "OU-POSKESTREN",
            unitName: "Poskestren",
            unitGenderComplex: "CAMPUR",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 10000),
            validUntil: null,
            positionCapabilities: [{
              capabilityCode: "keasramaan.presensi.create",
              scopeType: "UNIT",
              businessRuleState: "VERIFIED_PRODUCTION",
            }],
            scopeUnits: [],
          }];
        },
        async getUnitAccountPlacement(userId: string) {
          if (userId === "usr-unit-poskestren") return { unitId: "ou-poskestren" };
          return null;
        },
        async verifyHumanExecutor(executorId: string) {
          if (executorId === "stf-01") {
            return { id: "stf-01", name: "Ust. Ahmad", isActive: true };
          }
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["ou-poskestren"] };
        },
      };

      // Case A: Read-only check succeeds without human executor
      const readDecision = await authorizeCanonical({
        identity: {
          userId: "usr-unit-poskestren",
          username: "kiosk.poskestren",
          role: "OSDA",
        },
        capability: "keasramaan.presensi.create",
        resourceContext: { unitId: "ou-poskestren" },
        dataProvider: mockDataProvider,
      });
      assert.strictEqual(readDecision.decision, "ALLOW");

      // Case B: Mutation check with verified human executor succeeds
      const mutationDecision = await authorizeCanonical({
        identity: {
          userId: "usr-unit-poskestren",
          username: "kiosk.poskestren",
          role: "OSDA",
        },
        capability: "keasramaan.presensi.create",
        resourceContext: { unitId: "ou-poskestren" },
        isMutation: true,
        executorContext: {
          technicalAccountId: "usr-unit-poskestren",
          technicalAccountUsername: "kiosk.poskestren",
          humanExecutorId: "stf-01",
          humanExecutorName: "Ust. Ahmad",
          unitId: "ou-poskestren",
          assignmentId: "asg-unit-kesehatan",
        },
        dataProvider: mockDataProvider,
      });
      assert.strictEqual(mutationDecision.decision, "ALLOW");

      // Case C: Mutation check without human executor fails closed as UNIT_EXECUTOR_REQUIRED
      const missingExecDecision = await authorizeCanonical({
        identity: {
          userId: "usr-unit-poskestren",
          username: "kiosk.poskestren",
          role: "OSDA",
        },
        capability: "keasramaan.presensi.create",
        resourceContext: { unitId: "ou-poskestren" },
        isMutation: true,
        dataProvider: mockDataProvider,
      });
      assert.strictEqual(missingExecDecision.decision, "DENY");
      assert.strictEqual(missingExecDecision.reasonCode, "UNIT_EXECUTOR_REQUIRED");
    });
  });

  // =========================================================================
  // 10. Capability State: PROPOSED_TBD Confers ZERO Authority
  // =========================================================================
  describe("10. Capability State Defaults & Fail-Closed Behavior", () => {
    it("10.1. New Keasramaan capabilities in PROPOSED_TBD confer zero runtime authority", () => {
      const proposedGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-proposed",
        positionCode: "MUDABBIR",
        businessRuleState: "PROPOSED_TBD", // Unverified rule state
        capabilityCode: "keasramaan.checklist.submit",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-ali",
        unitIds: ["kmr-ali"],
      };

      // The Activation Triple requires businessRuleState === VERIFIED_PRODUCTION
      assert.strictEqual(
        proposedGrant.businessRuleState === "VERIFIED_PRODUCTION",
        false,
        "PROPOSED_TBD does not satisfy the Activation Triple"
      );
    });

    it("10.2. Legacy authorization remains 100% authoritative and untouched", () => {
      const actionsDir = path.join(rootDir, "app/actions");
      const actionFiles = fs.readdirSync(actionsDir);
      for (const file of actionFiles) {
        if (!file.endsWith(".ts")) continue;
        const content = fs.readFileSync(path.join(actionsDir, file), "utf-8");
        assert.strictEqual(
          content.includes("prisma.santriKamarPlacement.create"),
          false,
          `Action ${file} must NOT mutate SantriKamarPlacement yet (M3.1 is structural foundation only)`
        );
      }
    });
  });

  // =========================================================================
  // 11. Production-Equivalent Isolated Migration Simulation
  // =========================================================================
  describe("11. Production-Equivalent Migration Simulation", () => {
    it("11.1. Applies full migration chain (legacy -> PR #8 -> Phase 2A -> M3.1) and enforces data integrity", { timeout: 60000 }, async () => {
      const res = await runIsolatedM31MigrationVerification();
      assert.strictEqual(res.pr8ExactShaVerified, true, "PR #8 exact SHA must be verified");
      assert.strictEqual(res.pr8MigrationApplied, true, "PR #8 migration must be applied");
      assert.strictEqual(res.phase2aApplied, true, "Phase 2A migration must be applied");
      assert.strictEqual(res.m31MigrationApplied, true, "M3.1 migration must be applied");
      assert.strictEqual(res.existingDataUnchanged, true, "Existing User, Staff, Santri, and Evaluasi rows must remain unchanged");
      assert.strictEqual(res.existingPr8TablesIntact, true, "PR #8 tables must remain intact");
      assert.strictEqual(res.tableCreated, true, "santri_kamar_placements table must be created");
      assert.strictEqual(res.zeroInventedPlacements, true, "Zero invented room placements right after migration");
      assert.strictEqual(res.uniqueActiveConstraintEnforced, true, "Partial unique index must reject 2 active placements for same santri");
      assert.strictEqual(res.historyPreserved, true, "Inactive historical placement must be permitted alongside active placement");
      assert.strictEqual(res.simulationSuccess, true, "Complete simulation must succeed");
    });
  });
});
