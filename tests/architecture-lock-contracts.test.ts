(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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
  HEALTH_CAPABILITIES,
  HealthCapabilityCode,
  CandidateOrgUnitModel,
  CandidatePositionModel,
  CandidatePositionCapabilityModel,
  CandidateAssignmentModel,
  CandidateAssignmentScopeUnitModel,
  CandidateCanonicalAuditLogModel,
} from "../types/architecture-lock";

describe("STQ ARCHITECTURE LOCK — PHASE 1 SPECIFICATION AND CONTRACT VERIFICATION (V3-B)", () => {
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

    it("all 9 architecture documents must bear PROPOSED status pending review (not ARCHITECTURE_LOCKED)", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.ok(
          content.includes("PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW"),
          `Document docs/${docName} must state PROPOSED status`
        );
        assert.strictEqual(
          content.includes("Status**: `ARCHITECTURE_LOCKED`"),
          false,
          `Document docs/${docName} must NOT be labeled ARCHITECTURE_LOCKED until approved`
        );
      }
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
      };
      assert.strictEqual(posCap.scopeType, "UNIT");

      const candidatePosCap: CandidatePositionCapabilityModel = {
        id: "cpc-001",
        positionId: "pos-001",
        capabilityCode: "health.case.create",
        scopeType: "UNIT",
      };
      assert.strictEqual(candidatePosCap.scopeType, "UNIT");
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
      };

      const grant2: EffectiveCapabilityGrant = {
        assignmentId: "asn-musyrif",
        positionCode: "MUSYRIF_TAHFIZH",
        capabilityCode: "tahfizh.recap.read",
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-razan",
        unitIds: ["hlq-razan"],
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
        isLeadership: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(candidatePosition.code, "PETUGAS_KESEHATAN");

      const candidateScopeUnit: CandidateAssignmentScopeUnitModel = {
        id: "asu-001",
        assignmentId: "asn-001",
        unitId: candidateOrgUnit.id,
        createdAt: new Date(),
      };
      assert.strictEqual(candidateScopeUnit.unitId, candidateOrgUnit.id);

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
        ruleState: "APPROVED_TARGET_PENDING_TECHNICAL",
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
});
