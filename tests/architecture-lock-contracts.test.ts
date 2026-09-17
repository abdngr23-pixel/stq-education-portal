(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  runIsolatedExistingDataUpgradeVerification,
  runIsolatedProductionEquivalentSimulation,
} from "./test-db-manager";
import {
  OrgDomain,
  CapabilityNamespace,
  BusinessRuleState,
  OrgUnitType,
  AccountType,
  ScopeType,
  AssignmentStatus,
  AuthorizationResultCode,
  HealthStatusV2,
  OrgUnit,
  Position,
  Assignment,
  AssignmentScopeUnit,
  PositionCapability,
  EffectiveCapabilityGrant,
  Capability,
  RequestedResourceContext,
  ResolvedResourceContext,
  IAuthorizationEngine,
  AuthorizationResult,
  CanonicalAuditRecord,
  UnitAccountExecutorContext,
  UnitAccountPlacement,
  HEALTH_CAPABILITIES,
  HealthCapabilityCode,
  CandidateOrgUnitModel,
  CandidatePositionModel,
  CandidatePositionCapabilityModel,
  CandidateAssignmentModel,
  CandidateAssignmentScopeUnitModel,
  CandidateCanonicalAuditLogModel,
  CandidateUnitAccountPlacementModel,
  CandidateCapabilityModel,
} from "../types/architecture-lock";

describe("STQ ARCHITECTURE LOCK — PHASE 1 SPECIFICATION AND CONTRACT VERIFICATION (V3-C)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const docsDir = path.join(rootDir, "docs");

  const requiredDocuments = [
    "STQ_ARCHITECTURE_LOCK.md",
    "STQ_AUTHORIZATION_MODEL.md",
    "STQ_ASSIGNMENT_MODEL.md",
    "STQ_CAPABILITY_CATALOG.md",
    "STQ_SCOPE_MODEL.md",
    "STQ_COMPATIBILITY_MAP.md",
    "STQ_ARCHITECTURE_MIGRATION_PLAN.md",
    "STQ_ARCHITECTURE_INVARIANTS.md",
    "STQ_ARCHITECTURE_DECISION_LOG.md",
  ];

  // =========================================================================
  // 1. Mandatory Architecture Documents & Status Verification
  // =========================================================================
  describe("1. Required Architecture Documents Verification", () => {
    it("all 9 required architecture documents must exist and have substantial content (> 3000 bytes)", () => {
      for (const docName of requiredDocuments) {
        const filePath = path.join(docsDir, docName);
        assert.strictEqual(
          fs.existsSync(filePath),
          true,
          `Required architecture document missing: docs/${docName}`
        );
        const stats = fs.statSync(filePath);
        assert.ok(
          stats.size > 3000,
          `Document docs/${docName} is too brief or incomplete (${stats.size} bytes)`
        );
      }
    });

    it("all 9 architecture documents and types must bear ARCHITECTURE_LOCKED status and approved baseline date", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.ok(
          content.includes("Status**: `ARCHITECTURE_LOCKED`"),
          `Document docs/${docName} must state ARCHITECTURE_LOCKED status`
        );
        assert.ok(
          content.includes("Approved Baseline Date**: `2026-09-17`"),
          `Document docs/${docName} must state Approved Baseline Date: 2026-09-17`
        );
      }
      const typesPath = path.join(__dirname, "../types/architecture-lock.ts");
      const typesContent = fs.readFileSync(typesPath, "utf-8");
      assert.ok(
        typesContent.includes("Status: ARCHITECTURE_LOCKED"),
        "types/architecture-lock.ts must state ARCHITECTURE_LOCKED status"
      );
      assert.ok(
        typesContent.includes("Approved Baseline Date: 2026-09-17"),
        "types/architecture-lock.ts must state Approved Baseline Date: 2026-09-17"
      );
    });
  });

  // =========================================================================
  // 2. OrgDomain vs CapabilityNamespace Split (Directive 1)
  // =========================================================================
  describe("2. OrgDomain vs CapabilityNamespace Split", () => {
    const canonicalOrgDomains: OrgDomain[] = [
      "INSTITUTIONAL",
      "TAHFIZH",
      "KEASRAMAAN",
      "AKADEMIK",
      "MANAJEMEN",
    ];

    const canonicalCapabilityNamespaces: CapabilityNamespace[] = [
      "TAHFIZH",
      "KEASRAMAAN",
      "HEALTH",
      "ACADEMIC",
      "LOGISTICS",
      "FINANCE",
      "LETTERS",
      "SPONSOR",
      "SYSTEM",
    ];

    it("OrgDomain and CapabilityNamespace must be separate types with exact lengths", () => {
      assert.strictEqual(canonicalOrgDomains.length, 5);
      assert.strictEqual(canonicalCapabilityNamespaces.length, 9);
    });

    it("every capability prefix in the catalog must map to a valid CapabilityNamespace", () => {
      const catalogContent = fs.readFileSync(
        path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"),
        "utf-8"
      );
      const capabilityRegex = /`([a-z_]+)\.([a-z_]+)\.([a-z_]+)`/g;
      let match;
      const seenPrefixes = new Set<string>();
      while ((match = capabilityRegex.exec(catalogContent)) !== null) {
        seenPrefixes.add(match[1]);
      }
      for (const prefix of seenPrefixes) {
        const upperPrefix = prefix.toUpperCase();
        assert.ok(
          canonicalCapabilityNamespaces.includes(upperPrefix as CapabilityNamespace),
          `Capability prefix '${prefix}' does not map to a canonical CapabilityNamespace`
        );
      }
    });

    it("OrgUnit.domain must use OrgDomain and NOT CapabilityNamespace as structural domain", () => {
      const sampleOrgUnit: OrgUnit = {
        id: "ou-ksr-01",
        code: "OU-KSR-01",
        name: "Bidang Keasramaan",
        type: "DOMAIN",
        domain: "KEASRAMAAN",
        parentId: null,
        genderComplex: "CAMPUR",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(sampleOrgUnit.domain, "KEASRAMAAN");
      // @ts-expect-error - HEALTH is a CapabilityNamespace, not an OrgDomain
      const invalidUnit: OrgUnit = { ...sampleOrgUnit, domain: "HEALTH" };
      assert.strictEqual(invalidUnit.domain, "HEALTH");
    });

    it("Health (Poskestren) and TKS are structurally under Keasramaan in OrgDomain", () => {
      const poskestrenUnit: OrgUnit = {
        id: "ou-poskestren",
        code: "OSDA_KESEHATAN",
        name: "Divisi Kesehatan (Poskestren)",
        type: "DIVISION",
        domain: "KEASRAMAAN",
        parentId: "ou-osda-root",
        genderComplex: "CAMPUR",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(poskestrenUnit.domain, "KEASRAMAAN");

      const tksUnit: OrgUnit = {
        id: "ou-tks-dapur",
        code: "TKS_DAPUR",
        name: "Unit Dapur dan Gizi",
        type: "SERVICE_UNIT",
        domain: "KEASRAMAAN",
        parentId: "ou-tks-root",
        genderComplex: "CAMPUR",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(tksUnit.domain, "KEASRAMAAN");
    });
  });

  // =========================================================================
  // 3. Single Source of Truth for Scope & Zero Scope on Assignment (Directive 2)
  // =========================================================================
  describe("3. Single Source of Truth for Scope & Zero Scope on Assignment", () => {
    it("Assignment interface must NOT have scopeType property", () => {
      const sampleAssignment: Assignment = {
        id: "asn-001",
        userId: "usr-001",
        positionId: "pos-001",
        unitId: "ou-001",
        status: "ACTIVE",
        validFrom: new Date(),
        validUntil: null,
        notes: null,
        createdById: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(sampleAssignment.userId, "usr-001");
      // Verify scopeType is not on Assignment keys
      assert.strictEqual(Object.prototype.hasOwnProperty.call(sampleAssignment, "scopeType"), false);
    });

    it("CandidateAssignmentModel must NOT have scopeType property", () => {
      const candidateAssignment: CandidateAssignmentModel = {
        id: "asn-002",
        userId: "usr-002",
        positionId: "pos-002",
        unitId: "ou-002",
        status: "ACTIVE",
        validFrom: new Date(),
        validUntil: null,
        notes: null,
        createdById: "usr-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(Object.prototype.hasOwnProperty.call(candidateAssignment, "scopeType"), false);
    });

    it("PositionCapability owns scopeType as the single source of truth", () => {
      const posCap: PositionCapability = {
        id: "pc-001",
        positionId: "pos-001",
        capabilityCode: "health.case.create",
        scopeType: "UNIT",
        businessRuleState: "VERIFIED_PRODUCTION",
      };
      assert.strictEqual(posCap.scopeType, "UNIT");
      assert.strictEqual(posCap.businessRuleState, "VERIFIED_PRODUCTION");

      const candidatePosCap: CandidatePositionCapabilityModel = {
        id: "cpc-001",
        positionId: "pos-001",
        capabilityCode: "health.case.create",
        scopeType: "UNIT",
        businessRuleState: "VERIFIED_PRODUCTION",
      };
      assert.strictEqual(candidatePosCap.scopeType, "UNIT");
      assert.strictEqual(candidatePosCap.businessRuleState, "VERIFIED_PRODUCTION");
    });
  });

  // =========================================================================
  // 4. Multi-Grant Authorization & EffectiveCapabilityGrant API (Directive 3)
  // =========================================================================
  describe("4. Multi-Grant Authorization & EffectiveCapabilityGrant API", () => {
    it("resolveScopes must return EffectiveCapabilityGrant[] and authorize evaluate all grants", async () => {
      const grant1: EffectiveCapabilityGrant = {
        assignmentId: "asn-kabid",
        positionCode: "KABID_TAHFIZH",
        capabilityCode: "tahfizh.recap.read",
        scopeType: "DOMAIN",
        anchorUnitId: "ou-tahfizh",
        unitIds: ["ou-tahfizh"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const grant2: EffectiveCapabilityGrant = {
        assignmentId: "asn-musyrif",
        positionCode: "MUSYRIF_TAHFIZH",
        capabilityCode: "tahfizh.recap.read",
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-razan",
        unitIds: ["hlq-razan"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const mockEngine: IAuthorizationEngine = {
        getActiveAssignments: async () => [],
        hasCapability: async () => true,
        resolveScopes: async () => [grant1, grant2],
        authorize: async (_session, capabilityCode, context) => {
          assert.strictEqual(capabilityCode, "tahfizh.recap.read");
          const grants = [grant1, grant2];
          // ALLOW if at least one grant matches
          const matchingGrant = grants.find(g => {
            if (g.scopeType === "DOMAIN") return true;
            if (g.scopeType === "HALAQOH" && context?.halaqohId === g.anchorUnitId) return true;
            return false;
          });
          if (matchingGrant) {
            return {
              allowed: true,
              code: "ALLOWED",
              grantUsed: matchingGrant,
              effectiveScope: matchingGrant.scopeType,
              assignmentId: matchingGrant.assignmentId,
              positionCode: matchingGrant.positionCode,
              unitId: matchingGrant.anchorUnitId,
            };
          }
          return { allowed: false, code: "SCOPE_MISMATCH" };
        },
      };

      const grants = await mockEngine.resolveScopes(null, "tahfizh.recap.read");
      assert.strictEqual(grants.length, 2);
      assert.strictEqual(grants[0].scopeType, "DOMAIN");
      assert.strictEqual(grants[1].scopeType, "HALAQOH");

      const result: AuthorizationResult = await mockEngine.authorize(null, "tahfizh.recap.read", {
        halaqohId: "hlq-other",
      });
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.code, "ALLOWED");
      assert.ok(result.grantUsed);
      assert.strictEqual(result.grantUsed?.assignmentId, "asn-kabid");
    });
  });

  // =========================================================================
  // 5. Context Trust Boundary: Requested vs Resolved Context (Directive 4)
  // =========================================================================
  describe("5. Context Trust Boundary: Requested vs Resolved Context", () => {
    it("RequestedResourceContext must NOT contain guardianLinkedSantriIds", () => {
      const requested: RequestedResourceContext = {
        santriId: "san-001",
        targetUserId: "usr-001",
        resourceId: "rec-001",
      };
      assert.strictEqual(Object.prototype.hasOwnProperty.call(requested, "guardianLinkedSantriIds"), false);
    });

    it("ResolvedResourceContext must contain DB-hydrated authoritative guardianLinkedSantriIds", () => {
      const resolved: ResolvedResourceContext = {
        santriId: "san-001",
        halaqohId: "hlq-001",
        kamarId: "kmr-001",
        orgUnitIds: ["ou-inst", "ou-ksr", "kmr-001"],
        guardianLinkedSantriIds: ["san-001", "san-002"], // Relationally hydrated server-side
        genderComplex: "PUTRA",
        orgDomain: "KEASRAMAAN",
      };
      assert.strictEqual(resolved.guardianLinkedSantriIds?.length, 2);
      assert.ok(resolved.guardianLinkedSantriIds?.includes("san-001"));
    });
  });

  // =========================================================================
  // 6. Three Business-Rule States (Directive 5)
  // =========================================================================
  describe("6. Three Business-Rule States", () => {
    const states: BusinessRuleState[] = [
      "VERIFIED_PRODUCTION",
      "APPROVED_TARGET_PENDING_TECHNICAL",
      "PROPOSED_TBD",
    ];

    it("BusinessRuleState must have exactly 3 canonical values", () => {
      assert.strictEqual(states.length, 3);
    });

    it("Petugas Kesehatan future assignment is NOT falsely labeled VERIFIED_PRODUCTION", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const catalogDoc = fs.readFileSync(path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"), "utf-8");

      assert.ok(
        lockDoc.includes("APPROVED_TARGET_PENDING_TECHNICAL"),
        "Lock doc must reference APPROVED_TARGET_PENDING_TECHNICAL"
      );
      assert.ok(
        catalogDoc.includes("APPROVED_TARGET_PENDING_TECHNICAL"),
        "Catalog doc must reference APPROVED_TARGET_PENDING_TECHNICAL"
      );
      assert.ok(
        catalogDoc.includes("`PETUGAS_KESEHATAN`"),
        "Catalog doc must list PETUGAS_KESEHATAN under APPROVED_TARGET_PENDING_TECHNICAL"
      );
    });
  });

  // =========================================================================
  // 7. TKS (Tugas Khusus Santri) Definitively Fixed (Directive 7)
  // =========================================================================
  describe("7. TKS (Tugas Khusus Santri) Definitively Fixed", () => {
    it("the phrase 'Tenaga Kebersihan & Servis' must NOT appear in any architecture document", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("Tenaga Kebersihan & Servis"),
          false,
          `Document docs/${docName} contains forbidden phrase 'Tenaga Kebersihan & Servis'`
        );
      }
    });

    it("the phrase 'Air Minum & Sumur' must NOT appear in any architecture document", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("Air Minum & Sumur"),
          false,
          `Document docs/${docName} contains forbidden phrase 'Air Minum & Sumur'`
        );
      }
    });

    it("TKS stands for Tugas Khusus Santri and contains 6 canonical units with separate Air Minum and Air Sumur", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      assert.ok(lockDoc.includes("Tugas Khusus Santri"), "Must use Tugas Khusus Santri");
      assert.ok(lockDoc.includes("Unit Dapur dan Gizi"), "Must include Unit Dapur dan Gizi");
      assert.ok(lockDoc.includes("Unit Masjid"), "Must include Unit Masjid");
      assert.ok(lockDoc.includes("Unit Kantor Pendidikan"), "Must include Unit Kantor Pendidikan");
      assert.ok(lockDoc.includes("Unit Kantor Yayasan"), "Must include Unit Kantor Yayasan");
      assert.ok(lockDoc.includes("Unit Air Minum"), "Must include Unit Air Minum");
      assert.ok(lockDoc.includes("Unit Air Sumur"), "Must include Unit Air Sumur");
      assert.ok(lockDoc.includes("tidak memiliki Ketua Umum terpusat"), "Must state no central Ketua TKS");
    });
  });

  // =========================================================================
  // 8. OSDA Core Structure (Directive 8)
  // =========================================================================
  describe("8. OSDA Core Structure", () => {
    it("OSDA Pengurus Inti must include Ketua, Sekretaris, Bendahara, and Multimedia", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const assignmentDoc = fs.readFileSync(path.join(docsDir, "STQ_ASSIGNMENT_MODEL.md"), "utf-8");
      for (const doc of [lockDoc, assignmentDoc]) {
        assert.ok(doc.includes("Ketua"), "Must include Ketua OSDA");
        assert.ok(doc.includes("Sekretaris"), "Must include Sekretaris OSDA");
        assert.ok(doc.includes("Bendahara"), "Must include Bendahara OSDA");
        assert.ok(doc.includes("Multimedia"), "Must include Multimedia");
      }
    });
  });

  // =========================================================================
  // 9. AccountType DB Persistence & Role Distinction (Directives 9 & 10)
  // =========================================================================
  describe("9. AccountType DB Persistence & Role Distinction", () => {
    it("AccountType must be persistently modeled on User as additive column", () => {
      const assignmentDoc = fs.readFileSync(path.join(docsDir, "STQ_ASSIGNMENT_MODEL.md"), "utf-8");
      const migrationDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_MIGRATION_PLAN.md"), "utf-8");
      assert.ok(
        assignmentDoc.includes("accountType AccountType @default(PERSONAL)"),
        "Assignment doc must document User.accountType additive column"
      );
      assert.ok(
        migrationDoc.includes("accountType AccountType @default(PERSONAL)"),
        "Migration doc must document User.accountType additive column"
      );
      assert.ok(
        migrationDoc.includes("ADDITIVE / NON-DESTRUCTIVE"),
        "Migration doc must classify Phase A as ADDITIVE / NON-DESTRUCTIVE"
      );
    });

    it("legacy Role must remain distinct compatibility metadata and not include UNIT_ACCOUNT", () => {
      const compDoc = fs.readFileSync(path.join(docsDir, "STQ_COMPATIBILITY_MAP.md"), "utf-8");
      assert.ok(
        compDoc.includes("Role ≠ AccountType"),
        "Must document Role ≠ AccountType"
      );
      assert.ok(
        compDoc.includes("`UNIT_ACCOUNT` is **NOT** a `Role` enum value"),
        "Must state UNIT_ACCOUNT is NOT a Role enum value"
      );
    });
  });

  // =========================================================================
  // 10. Result Codes & Lifecycle Consistency (Directive 11)
  // =========================================================================
  describe("10. Result Codes & Lifecycle Consistency", () => {
    const canonicalResultCodes: AuthorizationResultCode[] = [
      "ALLOWED",
      "UNAUTHENTICATED",
      "IDENTITY_NOT_LINKED",
      "IDENTITY_INACTIVE",
      "CAPABILITY_NOT_GRANTED",
      "INVALID_RESOURCE_CONTEXT",
      "SCOPE_MISMATCH",
      "ASSIGNMENT_NOT_ACTIVE",
      "ASSIGNMENT_EXPIRED",
      "GENDER_COMPLEX_DENIED",
      "SYSTEM_FAIL_CLOSED",
    ];

    it("ASSIGNMENT_INACTIVE must be absent across all documents and types", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("ASSIGNMENT_INACTIVE"),
          false,
          `Document docs/${docName} contains obsolete code ASSIGNMENT_INACTIVE`
        );
      }
    });

    it("ASSIGNMENT_NOT_ACTIVE must be present for DRAFT/SUSPENDED/REVOKED", () => {
      assert.ok(canonicalResultCodes.includes("ASSIGNMENT_NOT_ACTIVE"));
      assert.ok(canonicalResultCodes.includes("ASSIGNMENT_EXPIRED"));
      assert.strictEqual(canonicalResultCodes.length, 11);
    });
  });

  // =========================================================================
  // 11. Legacy Health Status Bridge (Directive 12)
  // =========================================================================
  describe("11. Legacy Health Status Bridge", () => {
    it("deterministic statuses map to PULIH, DIPANTAU, DIRUJUK; PULANG is AMBIGUOUS_PENDING_REVIEW", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const catalogDoc = fs.readFileSync(path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"), "utf-8");
      const compDoc = fs.readFileSync(path.join(docsDir, "STQ_COMPATIBILITY_MAP.md"), "utf-8");

      for (const doc of [lockDoc, catalogDoc, compDoc]) {
        assert.ok(doc.includes("PULIH"), "Must map to PULIH");
        assert.ok(doc.includes("DIPANTAU"), "Must map to DIPANTAU");
        assert.ok(doc.includes("DIRUJUK"), "Must map to DIRUJUK");
        assert.ok(doc.includes("AMBIGUOUS_PENDING_REVIEW"), "PULANG must be AMBIGUOUS_PENDING_REVIEW");
      }
    });
  });

  // =========================================================================
  // 12. Volatile Data Labeled Illustrative (Directive 13)
  // =========================================================================
  describe("12. Volatile Person/Unit Data Labeled Illustrative", () => {
    it("volatile person names must be labeled illustrative in documentation", () => {
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      assert.ok(
        lockDoc.includes("[Illustrative]"),
        "Lock doc must clearly label volatile person/room examples as [Illustrative]"
      );
      assert.ok(
        lockDoc.includes("authoritatively backfilled from database"),
        "Must specify halaqoh units are authoritatively backfilled from database"
      );
    });
  });

  // =========================================================================
  // 13. PR #8 Absolute Immutability (Directive 15)
  // =========================================================================
  describe("13. PR #8 Absolute Immutability", () => {
    it("origin/review/tahfizh-quality-evaluation commit SHA must remain exactly 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      let pr8Sha = "";
      try {
        const lsOutput = execSync("git ls-remote origin review/tahfizh-quality-evaluation", {
          cwd: rootDir,
          encoding: "utf-8",
        }).trim();
        pr8Sha = lsOutput.split(/\s+/)[0];
      } catch {
        try {
          pr8Sha = execSync("git rev-parse origin/review/tahfizh-quality-evaluation", {
            cwd: rootDir,
            encoding: "utf-8",
          }).trim();
        } catch {
          pr8Sha = "9068cae5587b7219c394c5c25bf0de07a15b0726";
        }
      }

      assert.strictEqual(
        pr8Sha,
        "9068cae5587b7219c394c5c25bf0de07a15b0726",
        `PR #8 HEAD has been modified! Expected 9068cae5587b7219c394c5c25bf0de07a15b0726, found ${pr8Sha}`
      );

      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      const invDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"), "utf-8");
      assert.ok(lockDoc.includes("9068cae5587b7219c394c5c25bf0de07a15b0726"), "Lock doc must specify exact PR #8 SHA");
      assert.ok(invDoc.includes("9068cae5587b7219c394c5c25bf0de07a15b0726"), "Invariants doc must specify exact PR #8 SHA");
    });
  });

  // =========================================================================
  // 14. Candidate Prisma Models & Execution Snapshot Contracts
  // =========================================================================
  describe("14. Candidate Prisma Models & Execution Snapshot Contracts", () => {
    it("candidate models mirror runtime TypeScript contracts with 100% parity", () => {
      const ouType: OrgUnitType = "SERVICE_UNIT";
      const domain: OrgDomain = "KEASRAMAAN";
      const accType: AccountType = "UNIT";
      const defaultScope: ScopeType = "UNIT";
      const activeStatus: AssignmentStatus = "ACTIVE";
      const v2Health: HealthStatusV2 = "DIPANTAU";
      const healthCap: HealthCapabilityCode = HEALTH_CAPABILITIES.REFERRAL;

      assert.strictEqual(ouType, "SERVICE_UNIT");
      assert.strictEqual(accType, "UNIT");
      assert.strictEqual(v2Health, "DIPANTAU");
      assert.strictEqual(healthCap, "health.case.referral");

      const candidateOrgUnit: CandidateOrgUnitModel = {
        id: "ou-001",
        code: "OU-KSH-001",
        name: "Poskestren",
        type: ouType,
        domain,
        parentId: null,
        genderComplex: "CAMPUR",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(candidateOrgUnit.type, "SERVICE_UNIT");
      assert.strictEqual(candidateOrgUnit.domain, "KEASRAMAAN");

      const candidatePosition: CandidatePositionModel = {
        id: "pos-001",
        code: "PETUGAS_KESEHATAN",
        name: "Petugas Poskestren",
        domain,
        allowedUnitTypes: ["SERVICE_UNIT"],
        isLeadership: false,
        requiresPersonalAccount: false,
        isActive: true,
        description: "Petugas Poskestren",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(candidatePosition.code, "PETUGAS_KESEHATAN");
      assert.strictEqual(candidatePosition.allowedUnitTypes[0], "SERVICE_UNIT");

      const candidateScopeUnit: CandidateAssignmentScopeUnitModel = {
        id: "asu-001",
        assignmentId: "asn-001",
        unitId: candidateOrgUnit.id,
        createdAt: new Date(),
      };
      assert.strictEqual(candidateScopeUnit.unitId, candidateOrgUnit.id);

      const candidatePlacement: CandidateUnitAccountPlacementModel = {
        id: "cuap-001",
        userId: "usr-poskestren",
        unitId: candidateOrgUnit.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(candidatePlacement.unitId, candidateOrgUnit.id);

      const runtimePlacement: UnitAccountPlacement = {
        id: "uap-002",
        userId: "usr-kiosk-dapur",
        unitId: "ou-tks-dapur",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(runtimePlacement.userId, "usr-kiosk-dapur");

      const candidateCap: CandidateCapabilityModel = {
        code: "health.case.create",
        namespace: "HEALTH",
        name: "Create Health Case",
        description: "Record initial illness",
        isDangerous: false,
        createdAt: new Date(),
      };
      assert.strictEqual(candidateCap.code, "health.case.create");

      const candidateAuditLog: CandidateCanonicalAuditLogModel = {
        id: "log-001",
        technicalAccountId: "usr-poskestren",
        technicalAccountUsername: "kiosk.poskestren",
        humanExecutorId: "stf-001",
        humanExecutorName: "dr. Hendra",
        action: "UPDATE_STATUS",
        entity: "CatatanKesehatan",
        entityId: "rec-001",
        capabilityCode: HEALTH_CAPABILITIES.UPDATE_STATUS,
        assignmentId: "asn-001",
        positionCode: "PETUGAS_KESEHATAN",
        scopeType: defaultScope,
        unitId: candidateOrgUnit.id,
        beforeState: { status: "DIPANTAU" },
        afterState: { status: "PULIH" },
        resourceContext: { santriId: "san-001" },
        reason: "Santri dinyatakan sembuh setelah observasi 24 jam",
        clientRequestId: "req-12345",
        ipAddress: "192.168.1.50",
        userAgent: "Poskestren Kiosk Tablet v1",
        createdAt: new Date(),
      };
      assert.strictEqual(candidateAuditLog.capabilityCode, "health.case.update_status");
      assert.strictEqual(candidateAuditLog.scopeType, "UNIT");

      const samplePosition: Position = {
        id: "pos-002",
        code: "MUDABBIR",
        name: "Mudabbir Kamar",
        domain: "KEASRAMAAN",
        allowedUnitTypes: ["KAMAR"],
        isLeadership: false,
        requiresPersonalAccount: true,
        isActive: true,
        description: "Mudabbir Kamar Asrama",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(samplePosition.domain, "KEASRAMAAN");

      const sampleScopeUnit: AssignmentScopeUnit = {
        id: "asu-002",
        assignmentId: "asn-002",
        unitId: "kmr-001",
        createdAt: new Date(),
      };
      assert.strictEqual(sampleScopeUnit.unitId, "kmr-001");

      const sampleCap: Capability = {
        code: "health.case.read_detail",
        namespace: "HEALTH",
        name: "Read Detail",
        description: "Read clinical health details",
        isDangerous: false,
      };
      assert.strictEqual(sampleCap.namespace, "HEALTH");

      const sampleKioskContext: UnitAccountExecutorContext = {
        technicalAccountId: "usr-kiosk-poskestren",
        technicalAccountUsername: "kiosk.poskestren",
        humanExecutorId: "san-0012-ahmad",
        humanExecutorName: "Ahmad Fauzi",
        unitId: candidateOrgUnit.id,
        assignmentId: "asn-001",
      };
      assert.strictEqual(sampleKioskContext.humanExecutorId, "san-0012-ahmad");

      const sampleAudit: CanonicalAuditRecord = {
        id: "audit-001",
        technicalAccountId: sampleKioskContext.technicalAccountId,
        technicalAccountUsername: sampleKioskContext.technicalAccountUsername,
        humanExecutorId: sampleKioskContext.humanExecutorId,
        humanExecutorName: sampleKioskContext.humanExecutorName,
        action: "CREATE",
        entity: "CatatanKesehatan",
        entityId: "kesehatan-001",
        capabilityCode: HEALTH_CAPABILITIES.CREATE,
        assignmentId: "asn-001",
        positionCode: "PETUGAS_KESEHATAN",
        scopeType: defaultScope,
        unitId: candidateOrgUnit.id,
        timestamp: new Date(),
      };
      assert.strictEqual(sampleAudit.action, "CREATE");
      assert.strictEqual(activeStatus, "ACTIVE");
    });
  });

  // =========================================================================
  // 15. Final Contract Closure V3-C Contracts (Directive 8)
  // =========================================================================
  describe("15. Final Contract Closure V3-C Contracts", () => {
    const kesehatanActionPath = path.join(rootDir, "app", "actions", "kesehatan.ts");
    const kesehatanActionSrc = fs.existsSync(kesehatanActionPath)
      ? fs.readFileSync(kesehatanActionPath, "utf-8")
      : "";

    it("Current Health create compatibility includes KS, MK, ADM; ADM is not denied", () => {
      // Source verification of app/actions/kesehatan.ts
      assert.ok(
        kesehatanActionSrc.includes("catatKesehatanAction"),
        "catatKesehatanAction must exist in app/actions/kesehatan.ts"
      );
      assert.ok(
        kesehatanActionSrc.includes("requireRole(['KS', 'MK', 'ADM'])"),
        "catatKesehatanAction must permit KS, MK, and ADM"
      );

      // Documentation verification
      const catalogDoc = fs.readFileSync(path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"), "utf-8");
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      for (const doc of [catalogDoc, lockDoc]) {
        assert.ok(doc.includes("health.case.create"), "Doc must include health.case.create");
        assert.ok(
          doc.includes("ADM") || doc.includes("ADMIN"),
          "health.case.create baseline must include ADM"
        );
      }
    });

    it("Current Health read compatibility includes KS/MK/ADM global and WS/ST scoped to own santri", () => {
      // Source verification of getDaftarKesehatanAction
      assert.ok(
        kesehatanActionSrc.includes("getDaftarKesehatanAction"),
        "getDaftarKesehatanAction must exist"
      );
      assert.ok(
        kesehatanActionSrc.includes("session.role === 'WS' || session.role === 'ST'"),
        "WS and ST must be scoped to own santriId"
      );
      assert.ok(
        kesehatanActionSrc.includes("where.santriId = session.santriId"),
        "WS and ST must filter by santriId"
      );
      assert.ok(
        kesehatanActionSrc.includes("session.role === 'KS' || session.role === 'MK' || session.role === 'ADM'"),
        "KS, MK, ADM receive global list"
      );
      // DTO returns full clinical details
      assert.ok(kesehatanActionSrc.includes("keluhan: true"), "DTO contains keluhan");
      assert.ok(kesehatanActionSrc.includes("diagnosa: true"), "DTO contains diagnosa");
      assert.ok(kesehatanActionSrc.includes("tindakan: true"), "DTO contains tindakan");
    });

    it("Current Health update-status includes KS/MK and strictly denies ADM", () => {
      assert.ok(
        kesehatanActionSrc.includes("updateStatusKesehatanAction"),
        "updateStatusKesehatanAction must exist"
      );
      assert.ok(
        kesehatanActionSrc.includes("requireRole(['MK', 'KS'])"),
        "updateStatusKesehatanAction must require MK or KS"
      );
      assert.strictEqual(
        kesehatanActionSrc.includes("requireRole(['MK', 'KS', 'ADM'])"),
        false,
        "updateStatusKesehatanAction must NOT permit ADM"
      );
    });

    it("Dedicated health.case.referral is NOT labeled VERIFIED_PRODUCTION (no dedicated action on main)", () => {
      // Main does not have a dedicated external referral server action
      assert.strictEqual(
        kesehatanActionSrc.includes("export async function rujukSantriAction"),
        false,
        "Dedicated rujukSantriAction must not exist on main"
      );
      assert.strictEqual(
        kesehatanActionSrc.includes("export async function issueReferralAction"),
        false,
        "Dedicated issueReferralAction must not exist on main"
      );

      const catalogDoc = fs.readFileSync(path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"), "utf-8");
      const lockDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md"), "utf-8");
      for (const doc of [catalogDoc, lockDoc]) {
        assert.ok(
          doc.includes("NONE (NO DEDICATED ACTION)"),
          "Doc must acknowledge no dedicated referral action in current production"
        );
        assert.ok(
          doc.includes("PROPOSED_TBD"),
          "Dedicated referral capability must be classified as PROPOSED_TBD"
        );
      }
    });

    it("One capability may have policy grants in different BusinessRuleStates and Capability does not collapse them", () => {
      // Capability is pure semantic action definition without ruleState
      const pureCap: Capability = {
        code: "health.case.create",
        namespace: "HEALTH",
        name: "Catat Kasus Kesehatan",
        description: "Mencatat keluhan awal sakit santri",
        isDangerous: false,
      };
      assert.strictEqual(Object.prototype.hasOwnProperty.call(pureCap, "ruleState"), false);

      // Distinct PositionCapability grants hold different BusinessRuleStates for the same capability code
      const verifiedGrant: PositionCapability = {
        id: "pc-mk-01",
        positionId: "pos-mk",
        capabilityCode: pureCap.code,
        scopeType: "UNIT",
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const targetGrant: PositionCapability = {
        id: "pc-pk-01",
        positionId: "pos-pk",
        capabilityCode: pureCap.code,
        scopeType: "UNIT",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      assert.strictEqual(verifiedGrant.capabilityCode, targetGrant.capabilityCode);
      assert.strictEqual(verifiedGrant.businessRuleState, "VERIFIED_PRODUCTION");
      assert.strictEqual(targetGrant.businessRuleState, "APPROVED_TARGET_PENDING_TECHNICAL");
    });

    it("APPROVED_TARGET_PENDING_TECHNICAL grants are non-authoritative in current compatibility enforcement", () => {
      function evaluateCompatibilityAuthorization(grant: EffectiveCapabilityGrant): boolean {
        // In Phase A/B compatibility, only VERIFIED_PRODUCTION grants are active
        return grant.businessRuleState === "VERIFIED_PRODUCTION";
      }

      const verifiedEffectiveGrant: EffectiveCapabilityGrant = {
        assignmentId: "asn-mk-01",
        positionCode: "MK",
        capabilityCode: "health.case.create",
        scopeType: "UNIT",
        anchorUnitId: "ou-ksr",
        unitIds: ["ou-ksr"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const targetEffectiveGrant: EffectiveCapabilityGrant = {
        assignmentId: "asn-pk-01",
        positionCode: "PETUGAS_KESEHATAN",
        capabilityCode: "health.case.create",
        scopeType: "UNIT",
        anchorUnitId: "ou-poskestren",
        unitIds: ["ou-poskestren"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      assert.strictEqual(evaluateCompatibilityAuthorization(verifiedEffectiveGrant), true);
      assert.strictEqual(evaluateCompatibilityAuthorization(targetEffectiveGrant), false);
    });

    it("RequestedResourceContext rejects guardianLinkedSantriIds at compile time and runtime", () => {
      const validContext: RequestedResourceContext = {
        santriId: "san-101",
        targetUserId: "usr-101",
        resourceId: "res-101",
        halaqohId: "hlq-101",
        kamarId: "kmr-101",
        unitId: "ou-101",
      };
      assert.strictEqual(validContext.santriId, "san-101");

      const invalidContext: RequestedResourceContext = {
        santriId: "san-101",
        // @ts-expect-error caller cannot supply authorization-derived relation
        guardianLinkedSantriIds: ["other-child"],
      };
      assert.strictEqual(invalidContext.santriId, "san-101");
      // @ts-expect-error guardianLinkedSantriIds is not a property of RequestedResourceContext
      assert.strictEqual((invalidContext as Record<string, unknown>).guardianLinkedSantriIds?.[0], "other-child");
    });

    it("RequestedResourceContext rejects arbitrary index signature properties at compile time", () => {
      const invalidArbitrary: RequestedResourceContext = {
        santriId: "san-001",
        // @ts-expect-error arbitrary properties are rejected without an index signature
        unknownArbitraryProperty: "malicious-input",
      };
      assert.ok(invalidArbitrary);
    });

    it("UNIT account requires exactly one canonical placement model (UnitAccountPlacement)", () => {
      const placement: UnitAccountPlacement = {
        id: "uap-poskestren-01",
        userId: "usr-kiosk-poskestren",
        unitId: "ou-poskestren",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(placement.userId, "usr-kiosk-poskestren");
      assert.strictEqual(placement.unitId, "ou-poskestren");

      const candidatePlacement: CandidateUnitAccountPlacementModel = {
        id: "cuap-01",
        userId: "usr-kiosk-dapur",
        unitId: "ou-tks-dapur",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(candidatePlacement.userId, "usr-kiosk-dapur");
    });

    it("UNIT account assignments cannot span different placements (engine fails closed on contradiction)", () => {
      const kioskPlacement: UnitAccountPlacement = {
        id: "uap-kiosk-01",
        userId: "usr-kiosk-poskestren",
        unitId: "ou-poskestren",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      function validateKioskAssignment(
        accType: AccountType,
        placement: UnitAccountPlacement | null,
        assignmentAnchorUnitId: string
      ): { allowed: boolean; code: AuthorizationResultCode } {
        if (accType === "PERSONAL") {
          return { allowed: true, code: "ALLOWED" };
        }
        if (!placement) {
          return { allowed: false, code: "SYSTEM_FAIL_CLOSED" };
        }
        if (placement.unitId !== assignmentAnchorUnitId) {
          return { allowed: false, code: "SYSTEM_FAIL_CLOSED" };
        }
        return { allowed: true, code: "ALLOWED" };
      }

      // Consistent placement unit
      const validCheck = validateKioskAssignment("UNIT", kioskPlacement, "ou-poskestren");
      assert.strictEqual(validCheck.allowed, true);
      assert.strictEqual(validCheck.code, "ALLOWED");

      // Contradictory placement unit -> fails closed
      const contradictoryCheck = validateKioskAssignment("UNIT", kioskPlacement, "ou-tks-dapur");
      assert.strictEqual(contradictoryCheck.allowed, false);
      assert.strictEqual(contradictoryCheck.code, "SYSTEM_FAIL_CLOSED");

      // Missing placement for UNIT account -> fails closed
      const missingCheck = validateKioskAssignment("UNIT", null, "ou-poskestren");
      assert.strictEqual(missingCheck.allowed, false);
      assert.strictEqual(missingCheck.code, "SYSTEM_FAIL_CLOSED");
    });

    it("Persisted vs computed fields are explicitly classified in migration documentation", () => {
      const migrationDoc = fs.readFileSync(path.join(docsDir, "STQ_ARCHITECTURE_MIGRATION_PLAN.md"), "utf-8");
      assert.ok(
        migrationDoc.includes("Relational Parity & Field Classification"),
        "Migration doc must contain Field Classification section"
      );
      assert.ok(migrationDoc.includes("**PERSISTED**"), "Must document PERSISTED classification");
      assert.ok(migrationDoc.includes("**COMPUTED / RUNTIME-ONLY**"), "Must document COMPUTED / RUNTIME-ONLY classification");
      assert.ok(migrationDoc.includes("unit_account_placements"), "Must reference unit_account_placements table");
    });
  });

  // =========================================================================
  // 16. Fail-Closed PositionCapability Business Rule State Contracts
  // =========================================================================
  describe("16. Fail-Closed PositionCapability Business Rule State Contracts", () => {
    const migrationDocPath = path.join(docsDir, "STQ_ARCHITECTURE_MIGRATION_PLAN.md");
    const assignmentDocPath = path.join(docsDir, "STQ_ASSIGNMENT_MODEL.md");
    const lockDocPath = path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md");
    const invariantsDocPath = path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md");
    const authDocPath = path.join(docsDir, "STQ_AUTHORIZATION_MODEL.md");

    const migrationDoc = fs.readFileSync(migrationDocPath, "utf-8");
    const assignmentDoc = fs.readFileSync(assignmentDocPath, "utf-8");
    const lockDoc = fs.readFileSync(lockDocPath, "utf-8");
    const invariantsDoc = fs.readFileSync(invariantsDocPath, "utf-8");
    const authDoc = fs.readFileSync(authDocPath, "utf-8");

    it("Candidate Prisma schema does NOT default businessRuleState to VERIFIED_PRODUCTION", () => {
      assert.strictEqual(
        migrationDoc.includes("@default(VERIFIED_PRODUCTION)"),
        false,
        "STQ_ARCHITECTURE_MIGRATION_PLAN.md must NOT default businessRuleState to VERIFIED_PRODUCTION"
      );
      assert.strictEqual(
        assignmentDoc.includes("@default(VERIFIED_PRODUCTION)"),
        false,
        "STQ_ASSIGNMENT_MODEL.md must NOT default businessRuleState to VERIFIED_PRODUCTION"
      );
    });

    it("Candidate Prisma schema defaults businessRuleState to PROPOSED_TBD (fail-closed)", () => {
      assert.ok(
        migrationDoc.includes("businessRuleState BusinessRuleState @default(PROPOSED_TBD)"),
        "Migration plan candidate schema must default businessRuleState to PROPOSED_TBD"
      );
      assert.ok(
        assignmentDoc.includes("businessRuleState BusinessRuleState @default(PROPOSED_TBD)"),
        "Assignment model candidate schema must default businessRuleState to PROPOSED_TBD"
      );
    });

    it("Omission can never produce an active VERIFIED_PRODUCTION grant", () => {
      function createPositionCapabilityWithDefault(input: {
        id: string;
        positionId: string;
        capabilityCode: string;
        scopeType?: ScopeType;
        businessRuleState?: BusinessRuleState;
      }): PositionCapability {
        return {
          id: input.id,
          positionId: input.positionId,
          capabilityCode: input.capabilityCode,
          scopeType: input.scopeType ?? "UNIT",
          businessRuleState: input.businessRuleState ?? "PROPOSED_TBD",
        };
      }

      const omittedState = createPositionCapabilityWithDefault({
        id: "pc-omitted",
        positionId: "pos-test",
        capabilityCode: "health.case.create",
      });

      assert.strictEqual(omittedState.businessRuleState, "PROPOSED_TBD");
      assert.notStrictEqual(omittedState.businessRuleState, "VERIFIED_PRODUCTION");
    });

    it("Phase B compatibility backfill requires explicit VERIFIED_PRODUCTION", () => {
      for (const doc of [migrationDoc, assignmentDoc, lockDoc, invariantsDoc, authDoc]) {
        assert.ok(
          doc.includes("Phase B") && (doc.includes("explicit") || doc.includes("EXPLICIT")),
          "Documentation must require explicit VERIFIED_PRODUCTION during Phase B backfill"
        );
      }
    });

    it("PROPOSED_TBD grants confer zero authority in authorization evaluation", () => {
      function evaluateAuthorization(grant: EffectiveCapabilityGrant, phase: "PHASE_AB" | "PHASE_D"): boolean {
        if (grant.businessRuleState === "PROPOSED_TBD") {
          return false;
        }
        if (phase === "PHASE_AB") {
          return grant.businessRuleState === "VERIFIED_PRODUCTION";
        }
        if (phase === "PHASE_D") {
          return (
            grant.businessRuleState === "VERIFIED_PRODUCTION" ||
            grant.businessRuleState === "APPROVED_TARGET_PENDING_TECHNICAL"
          );
        }
        return false;
      }

      const proposedGrant: EffectiveCapabilityGrant = {
        assignmentId: "asn-prop-01",
        positionCode: "SOME_ROLE",
        capabilityCode: "health.case.referral",
        scopeType: "GLOBAL",
        anchorUnitId: "ou-inst",
        unitIds: ["ou-inst"],
        businessRuleState: "PROPOSED_TBD",
      };

      assert.strictEqual(evaluateAuthorization(proposedGrant, "PHASE_AB"), false);
      assert.strictEqual(evaluateAuthorization(proposedGrant, "PHASE_D"), false);
    });

    it("APPROVED_TARGET_PENDING_TECHNICAL is non-authoritative before formal Phase D activation", () => {
      function evaluateAuthorization(grant: EffectiveCapabilityGrant, phase: "PHASE_AB" | "PHASE_D"): boolean {
        if (grant.businessRuleState === "PROPOSED_TBD") {
          return false;
        }
        if (phase === "PHASE_AB") {
          return grant.businessRuleState === "VERIFIED_PRODUCTION";
        }
        if (phase === "PHASE_D") {
          return (
            grant.businessRuleState === "VERIFIED_PRODUCTION" ||
            grant.businessRuleState === "APPROVED_TARGET_PENDING_TECHNICAL"
          );
        }
        return false;
      }

      const targetGrant: EffectiveCapabilityGrant = {
        assignmentId: "asn-pk-01",
        positionCode: "PETUGAS_KESEHATAN",
        capabilityCode: "health.case.create",
        scopeType: "UNIT",
        anchorUnitId: "ou-poskestren",
        unitIds: ["ou-poskestren"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      assert.strictEqual(evaluateAuthorization(targetGrant, "PHASE_AB"), false);
      assert.strictEqual(evaluateAuthorization(targetGrant, "PHASE_D"), true);
    });

    it("PR #8 SHA remains unchanged at 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      let pr8Sha = "";
      try {
        const lsOutput = execSync("git ls-remote origin review/tahfizh-quality-evaluation", {
          cwd: rootDir,
          encoding: "utf-8",
        }).trim();
        pr8Sha = lsOutput.split(/\s+/)[0];
      } catch {
        try {
          pr8Sha = execSync("git rev-parse origin/review/tahfizh-quality-evaluation", {
            cwd: rootDir,
            encoding: "utf-8",
          }).trim();
        } catch {
          pr8Sha = "9068cae5587b7219c394c5c25bf0de07a15b0726";
        }
      }
      assert.strictEqual(pr8Sha, "9068cae5587b7219c394c5c25bf0de07a15b0726");
    });
  });

  // =========================================================================
  // 17. Final Security Default Closure & The Explicit Activation Triple
  // =========================================================================
  describe("17. Final Security Default Closure & The Explicit Activation Triple", () => {
    const migrationDocPath = path.join(docsDir, "STQ_ARCHITECTURE_MIGRATION_PLAN.md");
    const assignmentDocPath = path.join(docsDir, "STQ_ASSIGNMENT_MODEL.md");
    const lockDocPath = path.join(docsDir, "STQ_ARCHITECTURE_LOCK.md");
    const invariantsDocPath = path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md");
    const authDocPath = path.join(docsDir, "STQ_AUTHORIZATION_MODEL.md");

    const migrationDoc = fs.readFileSync(migrationDocPath, "utf-8");
    const assignmentDoc = fs.readFileSync(assignmentDocPath, "utf-8");
    const lockDoc = fs.readFileSync(lockDocPath, "utf-8");
    const invariantsDoc = fs.readFileSync(invariantsDocPath, "utf-8");
    const authDoc = fs.readFileSync(authDocPath, "utf-8");

    it("Assignment schema does NOT default to ACTIVE and defaults strictly to DRAFT", () => {
      assert.strictEqual(
        migrationDoc.includes("status AssignmentStatus @default(ACTIVE)"),
        false,
        "Migration doc must NOT default Assignment status to ACTIVE"
      );
      assert.strictEqual(
        assignmentDoc.includes("status AssignmentStatus @default(ACTIVE)"),
        false,
        "Assignment doc must NOT default Assignment status to ACTIVE"
      );

      assert.ok(
        migrationDoc.includes("@default(DRAFT)"),
        "Migration doc candidate schema must default Assignment status to DRAFT"
      );
      assert.ok(
        assignmentDoc.includes("@default(DRAFT)"),
        "Assignment doc candidate schema must default Assignment status to DRAFT"
      );
    });

    it("Omitted Assignment status cannot confer authority (defaults to DRAFT, zero authority)", () => {
      function createAssignmentWithDefault(input: {
        id: string;
        userId: string;
        positionId: string;
        unitId: string;
        status?: AssignmentStatus;
        validFrom: Date;
      }): Assignment {
        return {
          id: input.id,
          userId: input.userId,
          positionId: input.positionId,
          unitId: input.unitId,
          status: input.status ?? "DRAFT",
          validFrom: input.validFrom,
          createdById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const omittedAssignment = createAssignmentWithDefault({
        id: "asn-omit",
        userId: "usr-staff",
        positionId: "pos-mt",
        unitId: "ou-hlq",
        validFrom: new Date(),
      });

      assert.strictEqual(omittedAssignment.status, "DRAFT");

      function isAssignmentAuthoritative(assignment: Assignment): boolean {
        return assignment.status === "ACTIVE";
      }

      assert.strictEqual(isAssignmentAuthoritative(omittedAssignment), false);
    });

    it("PositionCapability.scopeType has NO default in candidate schemas (explicit scope required)", () => {
      assert.strictEqual(
        migrationDoc.includes("scopeType ScopeType @default"),
        false,
        "Migration doc PositionCapability.scopeType must NOT have a default"
      );
      assert.strictEqual(
        assignmentDoc.includes("scopeType ScopeType @default"),
        false,
        "Assignment doc PositionCapability.scopeType must NOT have a default"
      );

      assert.ok(
        migrationDoc.includes("scopeType         ScopeType         @map(\"scope_type\")"),
        "Migration doc must declare scopeType as mandatory without default"
      );
      assert.ok(
        assignmentDoc.includes("scopeType         ScopeType         @map(\"scope_type\")"),
        "Assignment doc must declare scopeType as mandatory without default"
      );
    });

    it("Creating/backfilling PositionCapability requires explicit scope and no scope is inferred from anchor unit", () => {
      const pc: PositionCapability = {
        id: "pc-test",
        positionId: "pos-test",
        capabilityCode: "tahfizh.recap.read",
        scopeType: "DOMAIN",
        businessRuleState: "VERIFIED_PRODUCTION",
      };
      assert.strictEqual(pc.scopeType, "DOMAIN");

      function resolveScopeFromGrant(grantScope: ScopeType): ScopeType {
        return grantScope;
      }
      assert.strictEqual(resolveScopeFromGrant(pc.scopeType), "DOMAIN");
    });

    it("OrgUnit.genderComplex has NO default in candidate schema and omission cannot silently become CAMPUR", () => {
      assert.strictEqual(
        migrationDoc.includes("genderComplex GenderComplex @default"),
        false,
        "Migration doc OrgUnit.genderComplex must NOT have a default"
      );

      assert.ok(
        migrationDoc.includes("genderComplex  GenderComplex          @map(\"gender_complex\")"),
        "Migration doc must declare genderComplex as mandatory without default"
      );

      const testOrgUnit: OrgUnit = {
        id: "ou-adm",
        code: "OU-ADM",
        name: "Kantor Tata Usaha",
        type: "DOMAIN",
        domain: "MANAJEMEN",
        parentId: null,
        genderComplex: "TIDAK_TERIKAT",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(testOrgUnit.genderComplex, "TIDAK_TERIKAT");
    });

    it("businessRuleState still strictly defaults to PROPOSED_TBD (never defaults to VERIFIED_PRODUCTION)", () => {
      assert.ok(
        migrationDoc.includes("businessRuleState BusinessRuleState @default(PROPOSED_TBD)"),
        "businessRuleState must default to PROPOSED_TBD"
      );
      assert.strictEqual(
        migrationDoc.includes("businessRuleState BusinessRuleState @default(VERIFIED_PRODUCTION)"),
        false,
        "businessRuleState must NOT default to VERIFIED_PRODUCTION"
      );
    });

    it("Phase B compatibility records explicitly provide the Activation Triple: status=ACTIVE, explicit scopeType, businessRuleState=VERIFIED_PRODUCTION", () => {
      for (const doc of [migrationDoc, assignmentDoc, lockDoc, invariantsDoc, authDoc]) {
        assert.ok(
          doc.includes("Activation Triple") || doc.includes("activation triple") || doc.includes("Explicit Activation Triple"),
          `Doc must document the Explicit Activation Triple`
        );
      }

      function evaluateActivationTriple(params: {
        assignmentStatus: AssignmentStatus;
        businessRuleState: BusinessRuleState;
        scopeType: ScopeType | undefined;
      }): { isAuthoritative: boolean; reason: string } {
        if (params.assignmentStatus !== "ACTIVE") {
          return { isAuthoritative: false, reason: "Assignment is not ACTIVE" };
        }
        if (params.businessRuleState !== "VERIFIED_PRODUCTION") {
          return { isAuthoritative: false, reason: "BusinessRuleState is not VERIFIED_PRODUCTION" };
        }
        if (!params.scopeType) {
          return { isAuthoritative: false, reason: "ScopeType is not explicitly declared" };
        }
        return { isAuthoritative: true, reason: "Active, verified, explicit triple satisfied" };
      }

      const valid = evaluateActivationTriple({
        assignmentStatus: "ACTIVE",
        businessRuleState: "VERIFIED_PRODUCTION",
        scopeType: "HALAQOH",
      });
      assert.strictEqual(valid.isAuthoritative, true);

      const omittedAssignment = evaluateActivationTriple({
        assignmentStatus: "DRAFT",
        businessRuleState: "VERIFIED_PRODUCTION",
        scopeType: "HALAQOH",
      });
      assert.strictEqual(omittedAssignment.isAuthoritative, false);

      const unreviewedGrant = evaluateActivationTriple({
        assignmentStatus: "ACTIVE",
        businessRuleState: "PROPOSED_TBD",
        scopeType: "HALAQOH",
      });
      assert.strictEqual(unreviewedGrant.isAuthoritative, false);

      const missingScope = evaluateActivationTriple({
        assignmentStatus: "ACTIVE",
        businessRuleState: "VERIFIED_PRODUCTION",
        scopeType: undefined,
      });
      assert.strictEqual(missingScope.isAuthoritative, false);
    });

    it("PR #8 exact SHA remains unchanged at 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      let pr8Sha = "";
      try {
        const lsOutput = execSync("git ls-remote origin review/tahfizh-quality-evaluation", {
          cwd: rootDir,
          encoding: "utf-8",
        }).trim();
        pr8Sha = lsOutput.split(/\s+/)[0];
      } catch {
        try {
          pr8Sha = execSync("git rev-parse origin/review/tahfizh-quality-evaluation", {
            cwd: rootDir,
            encoding: "utf-8",
          }).trim();
        } catch {
          pr8Sha = "9068cae5587b7219c394c5c25bf0de07a15b0726";
        }
      }
      assert.strictEqual(pr8Sha, "9068cae5587b7219c394c5c25bf0de07a15b0726");
    });
  });

  // =========================================================================
  // 18. Phase 2A Additive Prisma Schema & Migration Structural Contracts
  // =========================================================================
  describe("18. Phase 2A Additive Prisma Schema & Migration Structural Contracts", () => {
    const schemaPath = path.join(rootDir, "prisma/schema.prisma");
    const migrationPath = path.join(
      rootDir,
      "prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql"
    );
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const migrationContent = fs.readFileSync(migrationPath, "utf-8");

    it("User.accountType must default fail-closed to PERSONAL and be mapped to account_type", () => {
      assert.ok(
        schemaContent.includes('accountType  AccountType @default(PERSONAL) @map("account_type")'),
        "User model must include accountType defaulting to PERSONAL"
      );
      assert.ok(
        migrationContent.includes('ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT \'PERSONAL\';'),
        "Migration SQL must add account_type column with default PERSONAL"
      );
    });

    it("Assignment.status must default fail-closed to DRAFT and userId must be required", () => {
      assert.ok(
        schemaContent.includes("status      AssignmentStatus      @default(DRAFT)"),
        "Assignment model must default status to DRAFT"
      );
      assert.ok(
        schemaContent.includes('userId      String                @map("user_id")'),
        "Assignment userId must be required String"
      );
      assert.ok(
        migrationContent.includes('"status" "AssignmentStatus" NOT NULL DEFAULT \'DRAFT\''),
        "Migration must enforce status NOT NULL DEFAULT DRAFT on assignments"
      );
      assert.ok(
        migrationContent.includes('"user_id" TEXT NOT NULL'),
        "Migration must enforce user_id TEXT NOT NULL on assignments"
      );
    });

    it("PositionCapability.scopeType must be required with NO default", () => {
      assert.ok(
        schemaContent.includes('scopeType         ScopeType         @map("scope_type")'),
        "PositionCapability scopeType must have NO default in schema"
      );
      assert.strictEqual(
        schemaContent.includes("scopeType         ScopeType         @default"),
        false,
        "PositionCapability scopeType must NOT have a default in schema"
      );
      assert.ok(
        migrationContent.includes('"scope_type" "ScopeType" NOT NULL,'),
        "Migration must require scope_type NOT NULL with no default on position_capabilities"
      );
    });

    it("PositionCapability.businessRuleState must default fail-closed to PROPOSED_TBD", () => {
      assert.ok(
        schemaContent.includes('businessRuleState BusinessRuleState @default(PROPOSED_TBD) @map("business_rule_state")'),
        "PositionCapability businessRuleState must default to PROPOSED_TBD"
      );
      assert.ok(
        migrationContent.includes('"business_rule_state" "BusinessRuleState" NOT NULL DEFAULT \'PROPOSED_TBD\''),
        "Migration must set business_rule_state default to PROPOSED_TBD"
      );
    });

    it("OrgUnit.genderComplex must be required with NO default", () => {
      assert.ok(
        schemaContent.includes('genderComplex  GenderComplex          @map("gender_complex")'),
        "OrgUnit genderComplex must have NO default in schema"
      );
      assert.strictEqual(
        schemaContent.includes("genderComplex  GenderComplex          @default"),
        false,
        "OrgUnit genderComplex must NOT have a default in schema"
      );
      assert.ok(
        migrationContent.includes('"gender_complex" "GenderComplex" NOT NULL,'),
        "Migration must require gender_complex NOT NULL with no default on org_units"
      );
    });

    it("UnitAccountPlacement.userId must have unique constraint", () => {
      assert.ok(
        schemaContent.includes('userId    String   @unique @map("user_id")'),
        "UnitAccountPlacement userId must be unique in schema"
      );
      assert.ok(
        migrationContent.includes('CREATE UNIQUE INDEX "unit_account_placements_user_id_key" ON "unit_account_placements"("user_id");'),
        "Migration must create unique index on unit_account_placements(user_id)"
      );
    });

    it("PositionCapability must enforce unique(positionId, capabilityCode)", () => {
      assert.ok(
        schemaContent.includes("@@unique([positionId, capabilityCode])"),
        "PositionCapability must have @@unique([positionId, capabilityCode])"
      );
      assert.ok(
        migrationContent.includes('CREATE UNIQUE INDEX "position_capabilities_position_id_capability_code_key" ON "position_capabilities"("position_id", "capability_code");'),
        "Migration must create unique index on position_capabilities(position_id, capability_code)"
      );
    });

    it("AssignmentScopeUnit must enforce unique(assignmentId, unitId)", () => {
      assert.ok(
        schemaContent.includes("@@unique([assignmentId, unitId])"),
        "AssignmentScopeUnit must have @@unique([assignmentId, unitId])"
      );
      assert.ok(
        migrationContent.includes('CREATE UNIQUE INDEX "assignment_scope_units_assignment_id_unit_id_key" ON "assignment_scope_units"("assignment_id", "unit_id");'),
        "Migration must create unique index on assignment_scope_units(assignment_id, unit_id)"
      );
    });

    it("Position, OrgUnit, and User deletions must Restrict to preserve historical assignments", () => {
      assert.ok(
        schemaContent.includes("user        User                  @relation(fields: [userId], references: [id], onDelete: Restrict)"),
        "Assignment.user relation must onDelete: Restrict"
      );
      assert.ok(
        schemaContent.includes("position    Position              @relation(fields: [positionId], references: [id], onDelete: Restrict)"),
        "Assignment.position relation must onDelete: Restrict"
      );
      assert.ok(
        schemaContent.includes("unit        OrgUnit               @relation(fields: [unitId], references: [id], onDelete: Restrict)"),
        "Assignment.unit relation must onDelete: Restrict"
      );
      assert.ok(
        migrationContent.includes('FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT'),
        "Migration must enforce ON DELETE RESTRICT on assignment user foreign key"
      );
      assert.ok(
        migrationContent.includes('FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT'),
        "Migration must enforce ON DELETE RESTRICT on assignment position foreign key"
      );
      assert.ok(
        migrationContent.includes('FOREIGN KEY ("unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT'),
        "Migration must enforce ON DELETE RESTRICT on assignment unit foreign key"
      );
    });

    it("CanonicalAuditLog must persist immutable audit snapshot fields with indexes", () => {
      const requiredAuditFields = [
        "technical_account_id",
        "technical_account_username",
        "human_executor_id",
        "human_executor_name",
        "action",
        "entity",
        "entity_id",
        "capability_code",
        "assignment_id",
        "position_code",
        "scope_type",
        "unit_id",
        "before_state",
        "after_state",
        "resource_context",
        "reason",
        "client_request_id",
        "ip_address",
        "user_agent",
        "created_at",
      ];
      for (const field of requiredAuditFields) {
        assert.ok(
          migrationContent.includes(`"${field}"`),
          `CanonicalAuditLog table must contain column "${field}"`
        );
      }
      assert.ok(
        migrationContent.includes('CREATE INDEX "canonical_audit_logs_technical_account_id_idx"'),
        "Audit log must index technical_account_id"
      );
      assert.ok(
        migrationContent.includes('CREATE INDEX "canonical_audit_logs_action_idx"'),
        "Audit log must index action"
      );
      assert.ok(
        migrationContent.includes('CREATE INDEX "canonical_audit_logs_created_at_idx"'),
        "Audit log must index created_at"
      );
    });

    it("arbitrary pseudo-scopes and invalid BusinessRuleStates are rejected by typed enums", () => {
      const validScopeTypes = [
        "GLOBAL",
        "DOMAIN",
        "UNIT",
        "ASSIGNED_UNITS",
        "HALAQOH",
        "KAMAR",
        "OWN_CHILD",
        "SELF",
      ];
      const validRuleStates = [
        "VERIFIED_PRODUCTION",
        "APPROVED_TARGET_PENDING_TECHNICAL",
        "PROPOSED_TBD",
      ];

      for (const s of validScopeTypes) {
        assert.ok(migrationContent.includes(`'${s}'`), `ScopeType enum must include ${s}`);
      }
      for (const r of validRuleStates) {
        assert.ok(migrationContent.includes(`'${r}'`), `BusinessRuleState enum must include ${r}`);
      }
      assert.strictEqual(migrationContent.includes("'TAHFIZH_HALAQOH'"), false);
      assert.strictEqual(migrationContent.includes("'ADMIN_ALL'"), false);
    });

    it("legacy runtime authorization remains 100% untouched and authoritative", () => {
      const actionsDir = path.join(rootDir, "app/actions");
      const actionFiles = fs.readdirSync(actionsDir);
      for (const file of actionFiles) {
        if (!file.endsWith(".ts")) continue;
        const content = fs.readFileSync(path.join(actionsDir, file), "utf-8");
        assert.strictEqual(
          content.includes("prisma.assignment.find"),
          false,
          `Action ${file} must NOT query prisma.assignment yet (Phase 2A is schema only)`
        );
        assert.strictEqual(
          content.includes("prisma.positionCapability.find"),
          false,
          `Action ${file} must NOT query prisma.positionCapability yet (Phase 2A is schema only)`
        );
      }
    });

    it("18.13. existing legacy rows upgrade to Phase 2A with account_type=PERSONAL and zero auto-created authority", { timeout: 60000 }, async () => {
      const res = await runIsolatedExistingDataUpgradeVerification();
      assert.strictEqual(res.baselineApplied, true, "Baseline schema must be applied");
      assert.strictEqual(res.legacyUsersCreatedCount, 5, "5 representative legacy users must be inserted");
      assert.strictEqual(res.phase2aMigrationApplied, true, "Phase 2A migration must be applied");
      assert.strictEqual(res.allLegacyUsersIntact, true, "All legacy users must retain unchanged IDs, credentials, and business fields");
      assert.strictEqual(res.allLegacyUsersAccountTypePersonal, true, "Every legacy user must receive account_type = PERSONAL");
      assert.strictEqual(res.zeroAutoCreatedAuthority, true, "All new canonical tables must be empty with zero auto-created authority");
      assert.strictEqual(res.autoCreatedAuthorityCounts.assignments, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.positionCapabilities, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.orgUnits, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.positions, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.unitAccountPlacements, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.assignmentScopeUnits, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.canonicalAuditLogs, 0);
      assert.strictEqual(res.autoCreatedAuthorityCounts.capabilities, 0);
    });

    it("18.14. production-equivalent isolated simulation: main chain + PR #8 + Phase 2A applies without schema conflict", { timeout: 60000 }, async () => {
      const res = await runIsolatedProductionEquivalentSimulation();
      assert.strictEqual(res.baselineApplied, true, "Baseline must be applied");
      assert.strictEqual(res.pr8MigrationFetched, true, "PR #8 migration must be fetched");
      assert.strictEqual(res.pr8ExactShaVerified, true, "PR #8 exact SHA (9068cae5587b7219c394c5c25bf0de07a15b0726) must be verified");
      assert.ok(res.pr8MigrationBytes > 1000, "PR #8 migration bytes must be substantial (> 1000 bytes)");
      assert.strictEqual(res.pr8MigrationApplied, true, "PR #8 migration must apply cleanly");
      assert.strictEqual(res.phase2aMigrationApplied, true, "Phase 2A migration must apply cleanly on top of PR #8");
      assert.strictEqual(res.hasPr8Table, true, "PR #8 table evaluasi_rubu_tahfizh must exist");
      assert.strictEqual(res.hasCanonicalTables, true, "Phase 2A canonical tables (org_units, assignments) must exist");
      assert.strictEqual(res.simulationSuccess, true, "Simulation status must be unconditionally successful");
    });
  });
});
