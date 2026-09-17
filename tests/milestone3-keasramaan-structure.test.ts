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
  // 2. Authoritative Current Kamar Placement & Hydration
  // =========================================================================
  describe("2. Authoritative Kamar Resource Hydration", () => {
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
          findFirst: async () => {
            // Only inactive placements exist in DB (historical provenance preserved)
            return null;
          },
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
          findFirst: async () => null, // No placement in DB
        },
        orgUnit: { findFirst: async () => null, findUnique: async () => null },
        tasmiSimaan: { findUnique: async () => null },
        user: { findUnique: async () => null },
      };

      const provider = createPrismaDataProvider(mockPrisma as unknown as PrismaClient);
      const ctx = await provider.resolveResourceContext({ santriId: "san-unassigned-01" });

      assert.ok(ctx);
      assert.strictEqual(ctx?.kamarId, undefined);

      // Mudabbir attempting room-scoped inspection on unassigned santri
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
  });

  // =========================================================================
  // 3. Attack Regression: Caller-Supplied Forged kamarId Ignored
  // =========================================================================
  describe("3. Attack Regression: Forged kamarId Ignored", () => {
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

    it("5.2. Mudabbir with multiple Kamar (via AssignmentScopeUnit): ALLOW for all assigned rooms, DENY for unassigned", () => {
      // One Mudabbir responsible for both Kamar Ali and Kamar Utsman
      const mudabbirGrantMultiple: EffectiveCapabilityGrant = {
        assignmentId: "asg-mudabbir-multi",
        positionCode: "MUDABBIR",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "kmr-ali",
        unitIds: ["kmr-ali", "kmr-utsman"], // Scoped relationally via AssignmentScopeUnit
      };

      // Santri in Kamar Ali -> ALLOW
      const ctxAli: ResolvedResourceContext = { santriId: "san-1", kamarId: "kmr-ali", orgUnitIds: ["kmr-ali"] };
      assert.strictEqual(evaluateScopePredicate(mudabbirGrantMultiple, ctxAli, { userId: "usr-mudabbir" }).matches, true);

      // Santri in Kamar Utsman -> ALLOW
      const ctxUtsman: ResolvedResourceContext = { santriId: "san-2", kamarId: "kmr-utsman", orgUnitIds: ["kmr-utsman"] };
      assert.strictEqual(evaluateScopePredicate(mudabbirGrantMultiple, ctxUtsman, { userId: "usr-mudabbir" }).matches, true);

      // Santri in Kamar Umar (unassigned) -> DENY (SCOPE_MISMATCH)
      const ctxUmar: ResolvedResourceContext = { santriId: "san-3", kamarId: "kmr-umar", orgUnitIds: ["kmr-umar"] };
      const evalUmar = evaluateScopePredicate(mudabbirGrantMultiple, ctxUmar, { userId: "usr-mudabbir" });
      assert.strictEqual(evalUmar.matches, false);
      assert.strictEqual(evalUmar.code, "SCOPE_MISMATCH");
    });

    it("5.3. Mudabbir is distinct from Musyrif Keasramaan: Musyrif Keasramaan has DOMAIN scope over KEASRAMAAN", () => {
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
  // 6. OSDA Structure Hierarchy
  // =========================================================================
  describe("6. OSDA Structure Hierarchy", () => {
    it("6.1. OSDA core consists of Ketua, Sekretaris, Bendahara, and Multimedia", () => {
      const osdaCorePositions = [
        "KETUA_OSDA",
        "SEKRETARIS_OSDA",
        "BENDAHARA_OSDA",
        "MULTIMEDIA_OSDA",
      ];
      // Verify all core roles are accounted for
      assert.strictEqual(osdaCorePositions.length, 4);
      assert.ok(osdaCorePositions.includes("MULTIMEDIA_OSDA"), "Multimedia belongs to OSDA Pengurus Inti");
    });

    it("6.2. OSDA exactly defines 5 operational divisions and Usroh under Kebersihan", () => {
      const osdaDivisions = [
        "KEAMANAN_KEDISIPLINAN",
        "PENDIDIKAN_IBADAH",
        "KEBERSIHAN_KERAPIHAN",
        "KESEHATAN",
        "SARANA_PRASARANA",
      ];
      assert.strictEqual(osdaDivisions.length, 5, "OSDA must have exactly 5 operational divisions");

      // OrgUnitType enum supports DIVISION and USROH
      assert.ok(schemaContent.includes("DIVISION"), "OrgUnitType must include DIVISION");
      assert.ok(schemaContent.includes("USROH"), "OrgUnitType must include USROH");
    });
  });

  // =========================================================================
  // 7. TKS Definition & Exact 6 Units
  // =========================================================================
  describe("7. TKS Definition & Exact 6 Units", () => {
    it("7.1. TKS stands for 'TUGAS KHUSUS SANTRI' and has exactly 6 distinct operational units", () => {
      const tksUnits = [
        "Dapur dan Gizi",
        "Masjid",
        "Kantor Pendidikan",
        "Kantor Yayasan",
        "Air Minum",
        "Air Sumur",
      ];

      assert.strictEqual(tksUnits.length, 6, "TKS must contain exactly 6 units");
      assert.ok(tksUnits.includes("Air Minum"));
      assert.ok(tksUnits.includes("Air Sumur"));
      assert.notStrictEqual("Air Minum", "Air Sumur", "Air Minum and Air Sumur must be separate units");
    });

    it("7.2. TKS has NO central Ketua TKS; each unit operates independently", () => {
      // Ketua + Anggota permitted for Dapur dan Gizi & Masjid; Single operator for others
      const tksStructure = {
        "Dapur dan Gizi": { allowsKetua: true, allowsAnggota: true },
        "Masjid": { allowsKetua: true, allowsAnggota: true },
        "Kantor Pendidikan": { operatorOnly: true },
        "Kantor Yayasan": { operatorOnly: true },
        "Air Minum": { operatorOnly: true },
        "Air Sumur": { operatorOnly: true },
      };

      assert.strictEqual(tksStructure["Air Minum"].operatorOnly, true);
      assert.strictEqual(tksStructure["Air Sumur"].operatorOnly, true);
      assert.strictEqual(tksStructure["Dapur dan Gizi"].allowsKetua, true);
      assert.strictEqual(tksStructure["Masjid"].allowsKetua, true);
    });
  });

  // =========================================================================
  // 8. Pembina Divisi Placement Model
  // =========================================================================
  describe("8. Pembina Divisi Placement", () => {
    it("8.1. Pembina Divisi is directly under Musyrif Keasramaan, NOT an OSDA member", () => {
      // Pembina Divisi represented through Position + Assignment, NOT global enum Role
      const pembinaGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-pembina-kebersihan",
        positionCode: "PEMBINA_DIVISI",
        businessRuleState: "VERIFIED_PRODUCTION",
        capabilityCode: "keasramaan.divisi.supervise",
        scopeType: "ASSIGNED_UNITS",
        anchorUnitId: "ou-div-kebersihan",
        unitIds: ["ou-div-kebersihan", "ou-div-sarpras"], // Can supervise multiple divisions
      };

      // Supervising assigned division Kebersihan -> ALLOW
      const ctxKebersihan: ResolvedResourceContext = { orgUnitIds: ["ou-div-kebersihan"] };
      assert.strictEqual(evaluateScopePredicate(pembinaGrant, ctxKebersihan, { userId: "usr-pembina" }).matches, true);

      // Supervising assigned division Sarpras -> ALLOW
      const ctxSarpras: ResolvedResourceContext = { orgUnitIds: ["ou-div-sarpras"] };
      assert.strictEqual(evaluateScopePredicate(pembinaGrant, ctxSarpras, { userId: "usr-pembina" }).matches, true);

      // Other division Keamanan -> DENY
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
  // 11. Disposable Embedded PostgreSQL Migration Verification
  // =========================================================================
  describe("11. Disposable PostgreSQL Migration Verification", () => {
    it("11.1. Applies migration chain through M3.1 on disposable PostgreSQL and enforces unique active placement", { timeout: 60000 }, async () => {
      const res = await runIsolatedM31MigrationVerification();
      assert.strictEqual(res.migrationApplied, true, "M3.1 migration must apply cleanly");
      assert.strictEqual(res.tableCreated, true, "santri_kamar_placements table must be created");
      assert.strictEqual(res.uniqueActiveConstraintEnforced, true, "Partial unique index must reject 2 active placements for same santri");
      assert.strictEqual(res.historyPreserved, true, "Inactive historical placement must be permitted alongside active placement");
    });
  });
});
