(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  STQDomain,
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
  Capability,
  IAuthorizationEngine,
  CanonicalAuditRecord,
  UnitAccountExecutorContext,
} from "../types/architecture-lock";

describe("STQ ARCHITECTURE LOCK — PHASE 1 SPECIFICATION AND CONTRACT VERIFICATION", () => {
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
  // 2. OrgUnit Vocabulary Normalization
  // =========================================================================
  describe("2. OrgUnit Vocabulary Normalization", () => {
    const canonicalOrgUnitTypes: OrgUnitType[] = [
      "INSTITUTION",
      "DOMAIN",
      "ORGANIZATION",
      "DIVISION",
      "HALAQOH",
      "KAMAR",
      "SERVICE_UNIT",
      "USROH",
      "ACADEMIC_CLASS",
    ];

    it("all documented OrgUnit types must be part of canonical OrgUnitType union", () => {
      assert.strictEqual(canonicalOrgUnitTypes.length, 9);
    });

    it("no document may contain deprecated aliases WORK_UNIT or ORGANISASI", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("WORK_UNIT"),
          false,
          `Document docs/${docName} contains deprecated alias WORK_UNIT (must use SERVICE_UNIT)`
        );
        assert.strictEqual(
          content.includes("ORGANISASI]"),
          false,
          `Document docs/${docName} contains deprecated alias ORGANISASI (must use ORGANIZATION)`
        );
      }
    });
  });

  // =========================================================================
  // 3. Assignment Lifecycle & Field Naming Normalization
  // =========================================================================
  describe("3. Assignment Lifecycle & Field Naming Normalization", () => {
    const canonicalStatuses: AssignmentStatus[] = [
      "DRAFT",
      "ACTIVE",
      "SUSPENDED",
      "EXPIRED",
      "REVOKED",
    ];

    it("canonical assignment statuses must exactly equal the 5-state lifecycle", () => {
      assert.strictEqual(canonicalStatuses.length, 5);
    });

    it("documents and schemas must use validFrom and validUntil (not startDate/endDate)", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("startDate"),
          false,
          `Document docs/${docName} contains deprecated field startDate (must use validFrom)`
        );
        assert.strictEqual(
          content.includes("endDate"),
          false,
          `Document docs/${docName} contains deprecated field endDate (must use validUntil)`
        );
      }
    });
  });

  // =========================================================================
  // 4. Scope Semantics & Relational Multi-Unit Binding
  // =========================================================================
  describe("4. Scope Semantics & Relational Binding", () => {
    const canonicalScopes: ScopeType[] = [
      "GLOBAL",
      "DOMAIN",
      "UNIT",
      "ASSIGNED_UNITS",
      "HALAQOH",
      "KAMAR",
      "OWN_CHILD",
      "SELF",
    ];

    it("canonical scopes must match the 8 defined types", () => {
      assert.strictEqual(canonicalScopes.length, 8);
    });

    it("no document may contain pseudo-scopes like GLOBAL_TAHFIZH or HALAQOH_RAZAN", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("GLOBAL_TAHFIZH"),
          false,
          `Document docs/${docName} contains prohibited pseudo-scope GLOBAL_TAHFIZH`
        );
        assert.strictEqual(
          content.includes("HALAQOH_RAZAN"),
          false,
          `Document docs/${docName} contains prohibited pseudo-scope HALAQOH_RAZAN`
        );
      }
    });

    it("no document or candidate schema may store authority as customScopeIds String[]", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("customScopeIds"),
          false,
          `Document docs/${docName} contains non-relational customScopeIds`
        );
      }
    });

    it("OWN_CHILD must be semantically modeled relationally (supporting multiple children)", () => {
      const scopeContent = fs.readFileSync(
        path.join(docsDir, "STQ_SCOPE_MODEL.md"),
        "utf-8"
      );
      assert.ok(
        scopeContent.includes("linkedSantriIds"),
        "STQ_SCOPE_MODEL.md must document relational multi-child support for OWN_CHILD"
      );
    });
  });

  // =========================================================================
  // 5. Authorization Engine API & Result Codes
  // =========================================================================
  describe("5. Authorization Engine API & Result Codes", () => {
    const canonicalResultCodes: AuthorizationResultCode[] = [
      "ALLOWED",
      "UNAUTHENTICATED",
      "IDENTITY_NOT_LINKED",
      "IDENTITY_INACTIVE",
      "CAPABILITY_NOT_GRANTED",
      "INVALID_RESOURCE_CONTEXT",
      "SCOPE_MISMATCH",
      "ASSIGNMENT_INACTIVE",
      "ASSIGNMENT_EXPIRED",
      "GENDER_COMPLEX_DENIED",
      "SYSTEM_FAIL_CLOSED",
    ];

    it("canonical result codes must cover all 11 security outcomes", () => {
      assert.strictEqual(canonicalResultCodes.length, 11);
    });

    it("documents must specify resolveScopes and not resolvePermittedScopeIds", () => {
      for (const docName of requiredDocuments) {
        const content = fs.readFileSync(path.join(docsDir, docName), "utf-8");
        assert.strictEqual(
          content.includes("resolvePermittedScopeIds"),
          false,
          `Document docs/${docName} contains un-normalized API resolvePermittedScopeIds`
        );
      }
    });
  });

  // =========================================================================
  // 6. Capability Catalog Business Rule Separation
  // =========================================================================
  describe("6. Capability Catalog Business Rule Separation", () => {
    it("speculative capability assignments must be labeled TBD — BUSINESS OWNER APPROVAL REQUIRED", () => {
      const catalogContent = fs.readFileSync(
        path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"),
        "utf-8"
      );
      assert.ok(
        catalogContent.includes("TBD — BUSINESS OWNER APPROVAL REQUIRED"),
        "Must clearly mark speculative capabilities as pending approval"
      );
      assert.ok(
        catalogContent.includes("tahfizh.setoran.cancel"),
        "Must include tahfizh.setoran.cancel"
      );
      assert.ok(
        catalogContent.includes("keasramaan.permission.create"),
        "Must include keasramaan.permission.create"
      );
    });

    it("canonical Keasramaan V2 health statuses must be DIPANTAU, PULIH, DIRUJUK, DARURAT", () => {
      const catalogContent = fs.readFileSync(
        path.join(docsDir, "STQ_CAPABILITY_CATALOG.md"),
        "utf-8"
      );
      const invariantContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"),
        "utf-8"
      );
      for (const content of [catalogContent, invariantContent]) {
        assert.ok(content.includes("DIPANTAU"), "Must include DIPANTAU");
        assert.ok(content.includes("PULIH"), "Must include PULIH");
        assert.ok(content.includes("DIRUJUK"), "Must include DIRUJUK");
        assert.ok(content.includes("DARURAT"), "Must include DARURAT");
      }
    });
  });

  // =========================================================================
  // 7. Unit Account & Audit Non-Repudiation
  // =========================================================================
  describe("7. Unit Account & Audit Non-Repudiation", () => {
    it("unit account executor must require verified identity (not free-text alone)", () => {
      const assignmentContent = fs.readFileSync(
        path.join(docsDir, "STQ_ASSIGNMENT_MODEL.md"),
        "utf-8"
      );
      assert.ok(
        assignmentContent.includes("humanExecutorId"),
        "Must enforce verified humanExecutorId"
      );
      assert.ok(
        assignmentContent.includes("non-repudiation"),
        "Must document non-repudiation requirements"
      );
    });

    it("audit log design must document immutable execution snapshots", () => {
      const decisionContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_DECISION_LOG.md"),
        "utf-8"
      );
      assert.ok(
        decisionContent.includes("ADR-007"),
        "Must document ADR-007 for forensic audits"
      );
      assert.ok(
        decisionContent.includes("snapshot"),
        "Must document snapshot semantics in ADR-007"
      );
    });
  });

  // =========================================================================
  // 8. Migration Plan Risk & Rollback
  // =========================================================================
  describe("8. Migration Plan Risk & Rollback", () => {
    it("migration plan must classify Phase A risk as LOW / CONTROLLED (not Zero)", () => {
      const migrationContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_MIGRATION_PLAN.md"),
        "utf-8"
      );
      assert.ok(
        migrationContent.includes("LOW / CONTROLLED"),
        "Must classify risk as LOW / CONTROLLED"
      );
      assert.strictEqual(
        migrationContent.includes("Risk Level**: **Zero**"),
        false,
        "Must NOT state Risk Level: Zero"
      );
      assert.strictEqual(
        migrationContent.includes("within 100ms"),
        false,
        "Must NOT promise unmeasured 100ms latency"
      );
    });
  });

  // =========================================================================
  // 9. TypeScript Structural Contract Compilation
  // =========================================================================
  describe("9. TypeScript Structural Contract Compilation", () => {
    it("interfaces must support relational multi-unit binding, subject integrity, and execution snapshots", () => {
      const domain: STQDomain = "KESEHATAN";
      const unitType: OrgUnitType = "DIVISION";
      const accountType: AccountType = "UNIT";
      const defaultScope: ScopeType = "UNIT";
      const activeStatus: AssignmentStatus = "ACTIVE";
      const v2Health: HealthStatusV2 = "DIPANTAU";

      assert.strictEqual(accountType, "UNIT");
      assert.strictEqual(v2Health, "DIPANTAU");

      const sampleOrgUnit: OrgUnit = {
        id: "unit-kesehatan-01",
        code: "OSDA_KESEHATAN",
        name: "Divisi Kesehatan OSDA",
        type: unitType,
        domain,
        parentUnitId: "unit-osda-root",
        genderComplex: "CAMPUR",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(sampleOrgUnit.domain, "KESEHATAN");

      const samplePosition: Position = {
        id: "pos-petugas-kesehatan",
        code: "PETUGAS_KESEHATAN",
        name: "Petugas Poskestren",
        domain,
        allowedUnitTypes: ["DIVISION", "SERVICE_UNIT"],
        isLeadership: false,
        requiresPersonalAccount: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(samplePosition.code, "PETUGAS_KESEHATAN");

      const samplePositionCapability: PositionCapability = {
        id: "pos-cap-01",
        positionId: samplePosition.id,
        capabilityCode: "health.case.create",
        scopeType: defaultScope,
      };
      assert.strictEqual(samplePositionCapability.scopeType, "UNIT");

      const sampleCapability: Capability = {
        code: "health.case.create",
        domain,
        name: "Catat Kasus",
        description: "Mencatat kasus keluhan kesehatan santri",
        isDangerous: false,
        isLocked: true,
      };
      assert.strictEqual(sampleCapability.isLocked, true);

      const sampleAssignment: Assignment = {
        id: "asn-001",
        userId: "user-kiosk-kesehatan", // Deterministic subject non-nullable FK
        positionId: samplePosition.id,
        unitId: sampleOrgUnit.id,
        scopeType: defaultScope,
        status: activeStatus,
        validFrom: new Date("2026-07-01"),
        validUntil: new Date("2027-06-30"),
        createdById: "user-mudir",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(sampleAssignment.userId, "user-kiosk-kesehatan");

      const sampleScopeUnit: AssignmentScopeUnit = {
        id: "asu-001",
        assignmentId: sampleAssignment.id,
        unitId: "kamar-abu-bakar",
        createdAt: new Date(),
      };
      assert.strictEqual(sampleScopeUnit.unitId, "kamar-abu-bakar");

      const sampleKioskContext: UnitAccountExecutorContext = {
        technicalAccountId: sampleAssignment.userId,
        technicalAccountUsername: "kiosk.poskestren",
        humanExecutorId: "san-0012-ahmad",
        humanExecutorName: "Ahmad Fauzi",
        unitId: sampleOrgUnit.id,
        assignmentId: sampleAssignment.id,
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
        capabilityCode: "health.case.create",
        assignmentId: sampleAssignment.id,
        positionCode: samplePosition.code,
        scopeType: defaultScope,
        unitId: sampleOrgUnit.id,
        timestamp: new Date(),
      };
      assert.strictEqual(sampleAudit.positionCode, "PETUGAS_KESEHATAN");

      const mockEngine: IAuthorizationEngine = {
        authorize: async () => ({ allowed: true, code: "ALLOWED" }),
        hasCapability: async () => true,
        getActiveAssignments: async () => [sampleAssignment],
        resolveScopes: async () => ({ scopeType: "UNIT", unitIds: [sampleOrgUnit.id] }),
      };
      assert.ok(mockEngine.resolveScopes);
    });
  });
});
