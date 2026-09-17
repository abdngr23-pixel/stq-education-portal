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
  ScopeType,
  AssignmentStatus,
  OrgUnit,
  Position,
  Assignment,
  Capability,
  IAuthorizationEngine,
  CanonicalAuditRecord,
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
  // 1. Mandatory Architecture Documents Verification
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
  });

  // =========================================================================
  // 2. Invariants & Business Contract Verification
  // =========================================================================
  describe("2. Architecture Invariants Document Verification", () => {
    it("must document Tahfizh invariants (Kabid supervisory read vs ordinary MT halaqoh write)", () => {
      const invariantsContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"),
        "utf-8"
      );
      assert.ok(
        invariantsContent.includes("Kabid Tahfizh"),
        "Must document Kabid Tahfizh role"
      );
      assert.ok(
        invariantsContent.includes("Setoran WRITE"),
        "Must specify Setoran write boundaries"
      );
      assert.ok(
        invariantsContent.includes("Reward") && invariantsContent.includes("Tasmi'"),
        "Must document Reward issuance authority"
      );
    });

    it("must document Health invariants (KS/MK create & update status vs generic OSDA denial)", () => {
      const invariantsContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"),
        "utf-8"
      );
      assert.ok(
        invariantsContent.includes("generic OSDA"),
        "Must address generic OSDA authorization boundary"
      );
      assert.ok(
        invariantsContent.includes("Petugas Kesehatan"),
        "Must specify OSDA Petugas Kesehatan assignment"
      );
      assert.ok(
        invariantsContent.includes("Health Data Honesty"),
        "Must document elimination of synthetic false Sehat"
      );
    });

    it("must document Mudabbir non-aliasing invariant", () => {
      const invariantsContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"),
        "utf-8"
      );
      assert.ok(
        invariantsContent.includes("Mudabbir ≠ PH"),
        "Mudabbir must not be aliased to PH"
      );
      assert.ok(
        invariantsContent.includes("Mudabbir ≠ MT"),
        "Mudabbir must not be aliased to MT"
      );
      assert.ok(
        invariantsContent.includes("Mudabbir ≠ generic OSDA"),
        "Mudabbir must not be aliased to generic OSDA"
      );
    });

    it("must document Unit Account and Forensic Audit invariants", () => {
      const invariantsContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_INVARIANTS.md"),
        "utf-8"
      );
      assert.ok(
        invariantsContent.includes("human executor"),
        "Unit accounts must enforce human executor attribution"
      );
      assert.ok(
        invariantsContent.includes("AuditLog"),
        "AuditLog must retain technical account and human executor"
      );
    });
  });

  // =========================================================================
  // 3. Architecture Decision Log (ADRs) Verification
  // =========================================================================
  describe("3. Architecture Decision Log Verification", () => {
    it("must document all 8 Architecture Decision Records (ADR-001 through ADR-008)", () => {
      const decisionContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_DECISION_LOG.md"),
        "utf-8"
      );
      const expectedAdrs = [
        "ADR-001",
        "ADR-002",
        "ADR-003",
        "ADR-004",
        "ADR-005",
        "ADR-006",
        "ADR-007",
        "ADR-008",
      ];
      for (const adr of expectedAdrs) {
        assert.ok(
          decisionContent.includes(adr),
          `Missing Architecture Decision Record: ${adr}`
        );
      }
    });
  });

  // =========================================================================
  // 4. Migration Plan Phase Structure Verification
  // =========================================================================
  describe("4. Migration Plan Phase Verification", () => {
    it("must define additive 5-phase migration roadmap without breaking production", () => {
      const migrationContent = fs.readFileSync(
        path.join(docsDir, "STQ_ARCHITECTURE_MIGRATION_PLAN.md"),
        "utf-8"
      );
      assert.ok(migrationContent.includes("Phase A"), "Must define Phase A: Additive Schema");
      assert.ok(migrationContent.includes("Phase B"), "Must define Phase B: Compatibility & Backfill");
      assert.ok(migrationContent.includes("Phase C"), "Must define Phase C: Switch Reads");
      assert.ok(migrationContent.includes("Phase D"), "Must define Phase D: Switch Writes");
      assert.ok(migrationContent.includes("Phase E"), "Must define Phase E: Deprecation & Retirement");
      assert.ok(
        migrationContent.includes("NO PRODUCTION MIGRATION"),
        "Must guarantee no production migration execution during Phase 1"
      );
    });
  });

  // =========================================================================
  // 5. TypeScript Contract Types Verification
  // =========================================================================
  describe("5. TypeScript Architecture Contract Types Verification", () => {
    it("interfaces must support multi-assignment, hierarchical units, and audit attribution", () => {
      // Exercise all imported types to guarantee TypeScript structural validity
      const domain: STQDomain = "KESEHATAN";
      const unitType: OrgUnitType = "DIVISION";
      const defaultScope: ScopeType = "UNIT";
      const activeStatus: AssignmentStatus = "ACTIVE";

      const sampleCapability: Capability = {
        code: "health.case.create",
        domain,
        name: "Catat Kasus Medis",
        description: "Mencatat kasus keluhan medis baru santri",
        isDangerous: false,
      };
      assert.strictEqual(sampleCapability.code, "health.case.create");

      // Mock OrgUnit
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
      assert.strictEqual(sampleOrgUnit.type, "DIVISION");

      // Mock Position
      const samplePosition: Position = {
        id: "pos-petugas-kesehatan",
        code: "PETUGAS_KESEHATAN",
        name: "Petugas Kesehatan OSDA",
        domain,
        allowedUnitTypes: ["DIVISION", "SERVICE_UNIT"],
        defaultScope,
        isLeadership: false,
        requiresPersonalAccount: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(samplePosition.defaultScope, "UNIT");

      // Mock Assignment
      const sampleAssignment: Assignment = {
        id: "asn-001",
        userId: "user-santri-01",
        staffId: null,
        positionId: samplePosition.id,
        unitId: sampleOrgUnit.id,
        scopeType: defaultScope,
        status: activeStatus,
        startDate: new Date("2026-07-01"),
        endDate: new Date("2027-06-30"),
        createdById: "user-mudir",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assert.strictEqual(sampleAssignment.status, "ACTIVE");

      // Mock Audit Record
      const sampleAudit: CanonicalAuditRecord = {
        id: "audit-001",
        technicalAccountId: "unit-account-osda",
        humanExecutorId: "santri-ahmad",
        humanExecutorName: "Ahmad Santri",
        action: "CREATE",
        entity: "CatatanKesehatan",
        entityId: "kesehatan-001",
        capabilityCode: sampleCapability.code,
        assignmentId: sampleAssignment.id,
        scopeType: defaultScope,
        timestamp: new Date(),
      };
      assert.strictEqual(sampleAudit.humanExecutorName, "Ahmad Santri");
      assert.strictEqual(sampleAudit.capabilityCode, "health.case.create");

      // Mock Engine contract implementation check
      const mockEngine: Partial<IAuthorizationEngine> = {
        hasCapability: async () => true,
      };
      assert.ok(mockEngine.hasCapability);
    });
  });
});
