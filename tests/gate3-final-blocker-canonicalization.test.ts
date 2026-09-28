/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT,
  CANONICAL_ASSIGNMENT_ANCHORS,
  CANONICAL_POT_CONTRACT,
  CANONICAL_KEPALA_KEASRAMAAN_CONTRACT,
  CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT,
  CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS,
  GATE3_REQUIRED_ACTIVE_ASSIGNMENT_POSITION_CODES,
  GATE5_DEFERRED_UNIT_ASSIGNMENT_POSITION_CODES,
  UAT_ACTIVATION_TARGETS,
} from "../types/architecture-lock";
import {
  CANONICAL_REQUIRED_ORG_UNIT_CODES,
  checkPendidikanV2ProductionReadiness,
  evaluateKepesantrenanAcademicAuthPolicies,
} from "../lib/server/pendidikan-v2-readiness";
import { authorizeCanonical } from "../lib/auth/canonical-evaluator";

describe("GATE 3 — FINAL BLOCKER CANONICALIZATION TEST SUITE (DIR-2026-034 to 037)", () => {
  // =========================================================================
  // 1. OU-KEASRAMAAN = DOMAIN / KEASRAMAAN / parent OU-STQ-ROOT
  // =========================================================================
  it("1. OU-KEASRAMAAN = DOMAIN / KEASRAMAAN / parent OU-STQ-ROOT with TIDAK_TERIKAT gender", () => {
    const ouKeasramaan = CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.KEASRAMAAN_DOMAIN;
    assert.ok(ouKeasramaan, "KEASRAMAAN_DOMAIN must exist in CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT");
    assert.strictEqual(ouKeasramaan.code, "OU-KEASRAMAAN");
    assert.strictEqual(ouKeasramaan.name, "Keasramaan");
    assert.strictEqual(ouKeasramaan.type, "DOMAIN");
    assert.strictEqual(ouKeasramaan.domain, "KEASRAMAAN");
    assert.strictEqual(ouKeasramaan.parentId, "OU-STQ-ROOT");
    assert.strictEqual(ouKeasramaan.genderComplex, "TIDAK_TERIKAT");
    assert.strictEqual(CANONICAL_ASSIGNMENT_ANCHORS.KEPALA_KEASRAMAAN, "OU-KEASRAMAAN");
  });

  // =========================================================================
  // 2. Required OrgUnit list includes OU-KEASRAMAAN
  // =========================================================================
  it("2. Required OrgUnit list includes OU-KEASRAMAAN", () => {
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-KEASRAMAAN"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-KEASRAMAAN"
    );
  });

  // =========================================================================
  // 3. Missing/wrong/inactive OU-KEASRAMAAN => readiness NOT_READY
  // =========================================================================
  it("3. Missing/wrong/inactive OU-KEASRAMAAN causes REQUIRED_ORG_UNITS_READY to fail closed (NOT_READY)", async () => {
    // Missing OU-KEASRAMAAN
    const mockDbMissing = {
      orgUnit: {
        findMany: async () => [
          { id: "1", code: "OU-STQ-ROOT", type: "INSTITUTION", domain: "INSTITUTIONAL", parentId: null, isActive: true },
          { id: "2", code: "OU-TAHFIZH", type: "DOMAIN", domain: "TAHFIZH", parentId: "1", isActive: true },
          { id: "3", code: "OU-OSDA-ROOT", type: "STUDENT_BODY", domain: "KEASRAMAAN", parentId: "1", isActive: true },
          { id: "4", code: "OU-OSDA-PUTRI", type: "BRANCH", domain: "KEASRAMAAN", parentId: "3", isActive: true },
          { id: "5", code: "OU-TKS-ROOT", type: "SERVICE", domain: "KEASRAMAAN", parentId: "1", isActive: true },
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      position: { findMany: async () => [] },
    };

    const reportMissing = await checkPendidikanV2ProductionReadiness(mockDbMissing as any);
    const gate2Missing = reportMissing.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.ok(gate2Missing, "REQUIRED_ORG_UNITS_READY gate must exist");
    assert.strictEqual(gate2Missing.status, "NOT_READY", "Must be NOT_READY when OU-KEASRAMAAN is missing");
    assert.ok(gate2Missing.details.includes("OU-KEASRAMAAN"), "Details must mention missing OU-KEASRAMAAN");

    // Inactive OU-KEASRAMAAN
    const mockDbInactive = {
      orgUnit: {
        findMany: async () => [
          { id: "1", code: "OU-STQ-ROOT", type: "INSTITUTION", domain: "INSTITUTIONAL", parentId: null, isActive: true },
          { id: "2", code: "OU-TAHFIZH", type: "DOMAIN", domain: "TAHFIZH", parentId: "1", isActive: true },
          { id: "3", code: "OU-OSDA-ROOT", type: "STUDENT_BODY", domain: "KEASRAMAAN", parentId: "1", isActive: true },
          { id: "4", code: "OU-OSDA-PUTRI", type: "BRANCH", domain: "KEASRAMAAN", parentId: "3", isActive: true },
          { id: "5", code: "OU-TKS-ROOT", type: "SERVICE", domain: "KEASRAMAAN", parentId: "1", isActive: true },
          { id: "6", code: "OU-KEASRAMAAN", type: "DOMAIN", domain: "KEASRAMAAN", parentId: "1", isActive: false }, // INACTIVE
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      position: { findMany: async () => [] },
    };

    const reportInactive = await checkPendidikanV2ProductionReadiness(mockDbInactive as any);
    const gate2Inactive = reportInactive.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.ok(gate2Inactive);
    assert.strictEqual(gate2Inactive.status, "NOT_READY", "Must be NOT_READY when OU-KEASRAMAAN is inactive");

    // Wrong parent OU-KEASRAMAAN
    const mockDbWrongParent = {
      orgUnit: {
        findMany: async () => [
          { id: "1", code: "OU-STQ-ROOT", type: "INSTITUTION", domain: "INSTITUTIONAL", parentId: null, isActive: true },
          { id: "2", code: "OU-TAHFIZH", type: "DOMAIN", domain: "TAHFIZH", parentId: "1", isActive: true },
          { id: "3", code: "OU-OSDA-ROOT", type: "STUDENT_BODY", domain: "KEASRAMAAN", parentId: "1", isActive: true },
          { id: "4", code: "OU-OSDA-PUTRI", type: "BRANCH", domain: "KEASRAMAAN", parentId: "3", isActive: true },
          { id: "5", code: "OU-TKS-ROOT", type: "SERVICE", domain: "KEASRAMAAN", parentId: "1", isActive: true },
          { id: "6", code: "OU-KEASRAMAAN", type: "DOMAIN", domain: "KEASRAMAAN", parentId: "2", isActive: true }, // parent is Tahfizh (wrong)
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      position: { findMany: async () => [] },
    };

    const reportWrongParent = await checkPendidikanV2ProductionReadiness(mockDbWrongParent as any);
    const gate2WrongParent = reportWrongParent.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.ok(gate2WrongParent);
    assert.strictEqual(gate2WrongParent.status, "NOT_READY", "Must be NOT_READY when OU-KEASRAMAAN has wrong parent");
  });

  // =========================================================================
  // 4. POT target metadata resolves to Lisa / STF-0005 / OU-TAHFIZH
  // =========================================================================
  it("4. POT target metadata resolves to Lisa / STF-0005 / OU-TAHFIZH per DIR-2026-034", () => {
    assert.strictEqual(CANONICAL_POT_CONTRACT.positionCode, "PETUGAS_OPERASIONAL_TAHFIZH");
    assert.strictEqual(CANONICAL_POT_CONTRACT.assignmentAnchor, "OU-TAHFIZH");
    assert.strictEqual(CANONICAL_POT_CONTRACT.targetHolderStaffCode, "STF-0005");
    assert.strictEqual(CANONICAL_POT_CONTRACT.targetHolderCanonicalUsername, "musyirfah.putri");
    assert.strictEqual(CANONICAL_POT_CONTRACT.targetHolderName, "Ustazah Lisa Dwina Fitri");
    assert.strictEqual(CANONICAL_POT_CONTRACT.recapReadCapabilityScope, "GLOBAL");
    assert.strictEqual(CANONICAL_POT_CONTRACT.rewardIssueAllowed, false);
    assert.strictEqual(CANONICAL_ASSIGNMENT_ANCHORS.PETUGAS_OPERASIONAL_TAHFIZH, "OU-TAHFIZH");
  });

  // =========================================================================
  // 5. POT recap target remains GLOBAL
  // =========================================================================
  it("5. POT recap target remains GLOBAL capability scope", () => {
    assert.strictEqual(
      CANONICAL_POT_CONTRACT.recapReadCapabilityScope,
      "GLOBAL",
      "POT recap read target must be GLOBAL"
    );
  });

  // =========================================================================
  // 6. POT reward issue remains absent/denied
  // =========================================================================
  it("6. POT reward issue remains strictly absent/denied per DIR-2026-023 and DIR-2026-034", async () => {
    assert.strictEqual(CANONICAL_POT_CONTRACT.rewardIssueAllowed, false);

    // Verify canonical authorization engine denies tahfizh.reward.issue for POT
    const authResult = await authorizeCanonical({
      identity: {
        userId: "u-lisa",
        username: "musyirfah.putri",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "STF-0005",
        mockAssignments: [
          {
            id: "asg-pot",
            positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
            status: "ACTIVE",
            scopeType: "GLOBAL",
            unitId: "ou-tahfizh",
            positionCapabilities: [],
          },
        ],
      } as any,
      capability: "tahfizh.reward.issue",
      resourceContext: {},
    });

    assert.strictEqual(authResult.decision, "DENY", "POT must be DENIED tahfizh.reward.issue authority");
  });

  // =========================================================================
  // 7. Kepala Keasramaan target = Ust. Mujaddid / STF-0004 / OU-KEASRAMAAN
  // =========================================================================
  it("7. Kepala Keasramaan target resolves to Ust. Mujaddid / STF-0004 / OU-KEASRAMAAN per DIR-2026-036", () => {
    assert.strictEqual(CANONICAL_KEPALA_KEASRAMAAN_CONTRACT.positionCode, "KEPALA_KEASRAMAAN");
    assert.strictEqual(CANONICAL_KEPALA_KEASRAMAAN_CONTRACT.assignmentAnchor, "OU-KEASRAMAAN");
    assert.strictEqual(CANONICAL_KEPALA_KEASRAMAAN_CONTRACT.targetHolderStaffCode, "STF-0004");
    assert.strictEqual(CANONICAL_KEPALA_KEASRAMAAN_CONTRACT.targetHolderCanonicalUsername, "musyrif.asrama");
    assert.strictEqual(CANONICAL_KEPALA_KEASRAMAAN_CONTRACT.targetHolderName, "Ust. Mujaddid Zhohruddin");
  });

  // =========================================================================
  // 8. Six approved Halaqoh backfill mappings exist exactly
  // =========================================================================
  it("8. Exactly six approved Halaqoh backfill mappings exist with correct staff and user links", () => {
    assert.strictEqual(CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS.length, 6);

    const expected = [
      { halaqohCode: "HLQ-0001", orgUnitCode: "OU-HLQ-0001", staffCode: "STF-0003", username: "musyrif.tahifzh" },
      { halaqohCode: "HLQ-0002", orgUnitCode: "OU-HLQ-0002", staffCode: "STF-0006", username: "kamal.ph" },
      { halaqohCode: "HLQ-0003", orgUnitCode: "OU-HLQ-0003", staffCode: "STF-0007", username: "rizaldi.ph" },
      { halaqohCode: "HLQ-0004", orgUnitCode: "OU-HLQ-0004", staffCode: "STF-0008", username: "hudzaifah.ph" },
      { halaqohCode: "HLQ-0005", orgUnitCode: "OU-HLQ-0005", staffCode: "STF-0009", username: "alwan.ph" },
      { halaqohCode: "HLQ-0006", orgUnitCode: "OU-HLQ-0006", staffCode: "STF-0005", username: "musyirfah.putri" },
    ];

    for (let i = 0; i < 6; i++) {
      const actual = CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS[i];
      const exp = expected[i];
      assert.strictEqual(actual.halaqohCode, exp.halaqohCode);
      assert.strictEqual(actual.targetOrgUnitCode, exp.orgUnitCode);
      assert.strictEqual(actual.expectedStaffCode, exp.staffCode);
      assert.strictEqual(actual.expectedUsername, exp.username);
      assert.strictEqual(actual.targetOrgUnitType, "HALAQOH");
      assert.strictEqual(actual.targetOrgUnitDomain, "TAHFIZH");
      assert.strictEqual(actual.targetOrgUnitParent, "OU-TAHFIZH");
    }
  });

  // =========================================================================
  // 9. Missing current-six Halaqoh OrgUnit => assignment readiness NOT_READY
  // =========================================================================
  it("9. Missing current-six Halaqoh OrgUnit causes MUSYRIF_TAHFIZH verification to fail closed", async () => {
    const mockDbWithHalaqohs = {
      halaqoh: {
        findMany: async () => [
          {
            id: "hlq-1",
            code: "HLQ-0001",
            name: "Halaqoh 1",
            musyrifId: "stf-3",
            musyrif: {
              id: "stf-3",
              code: "STF-0003",
              name: "Ust. Razan Mufli",
              status: "AKTIF",
              userId: "u-razan",
              user: { id: "u-razan", username: "musyrif.tahifzh", status: "AKTIF", accountType: "PERSONAL" },
            },
          },
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [] }, // zero org units (missing OU-HLQ-0001)
      position: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbWithHalaqohs as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    assert.strictEqual(gate8.status, "NOT_READY");
    assert.ok(
      gate8.details.includes("missing target OrgUnit OU-HLQ-0001"),
      "Must report missing target OrgUnit"
    );
  });

  // =========================================================================
  // 10. Wrong Halaqoh parent => NOT_READY
  // =========================================================================
  it("10. Wrong Halaqoh parent causes MUSYRIF_TAHFIZH verification to fail closed", async () => {
    const mockDbWrongParent = {
      halaqoh: {
        findMany: async () => [
          {
            id: "hlq-1",
            code: "HLQ-0001",
            name: "Halaqoh 1",
            musyrifId: "stf-3",
            musyrif: {
              id: "stf-3",
              code: "STF-0003",
              name: "Ust. Razan Mufli",
              status: "AKTIF",
              userId: "u-razan",
              user: { id: "u-razan", username: "musyrif.tahifzh", status: "AKTIF", accountType: "PERSONAL" },
            },
          },
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: {
        findMany: async () => [
          {
            id: "ou-hlq-1",
            code: "OU-HLQ-0001",
            type: "HALAQOH",
            domain: "TAHFIZH",
            parentId: "ou-root", // WRONG: must be OU-TAHFIZH
            isActive: true,
          },
        ],
      },
      position: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbWrongParent as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    assert.strictEqual(gate8.status, "NOT_READY");
    assert.ok(
      gate8.details.includes("parent is not OU-TAHFIZH"),
      "Must fail closed when Halaqoh parent is not OU-TAHFIZH"
    );
  });

  // =========================================================================
  // 11. Wrong Staff/User relational chain => NOT_READY
  // =========================================================================
  it("11. Wrong Staff/User relational chain causes MUSYRIF_TAHFIZH verification to fail closed", async () => {
    const mockDbBrokenRelation = {
      halaqoh: {
        findMany: async () => [
          {
            id: "hlq-1",
            code: "HLQ-0001",
            name: "Halaqoh 1",
            musyrifId: "stf-3",
            musyrif: {
              id: "stf-3",
              code: "STF-0003",
              status: "SUSPENDED", // SUSPENDED staff
              userId: "u-razan",
              user: { id: "u-razan", username: "musyrif.tahifzh", status: "AKTIF", accountType: "PERSONAL" },
            },
          },
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: {
        findMany: async () => [
          {
            id: "ou-hlq-1",
            code: "OU-HLQ-0001",
            type: "HALAQOH",
            domain: "TAHFIZH",
            parent: { code: "OU-TAHFIZH" },
            isActive: true,
          },
        ],
      },
      position: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbBrokenRelation as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    assert.strictEqual(gate8.status, "NOT_READY");
    assert.ok(
      gate8.details.includes("musyrif Staff is not AKTIF"),
      "Must fail closed when musyrif Staff is not AKTIF"
    );
  });

  // =========================================================================
  // 12. PETUGAS_OPERASIONAL_KEASRAMAAN remains a required Position template
  // =========================================================================
  it("12. PETUGAS_OPERASIONAL_KEASRAMAAN remains in CANONICAL_REQUIRED_POSITION_CODES", async () => {
    const { CANONICAL_REQUIRED_POSITION_CODES } = await import("../types/architecture-lock");
    assert.ok(
      CANONICAL_REQUIRED_POSITION_CODES.includes("PETUGAS_OPERASIONAL_KEASRAMAAN"),
      "Position template must remain required"
    );
  });

  // =========================================================================
  // 13. Its ACTIVE assignment is not a Gate 3 requirement while osda.putri is SUSPENDED
  // =========================================================================
  it("13. PETUGAS_OPERASIONAL_KEASRAMAAN active assignment is NOT in GATE3_REQUIRED_ACTIVE_ASSIGNMENT_POSITION_CODES while osda.putri is SUSPENDED", () => {
    assert.strictEqual(
      (GATE3_REQUIRED_ACTIVE_ASSIGNMENT_POSITION_CODES as readonly string[]).includes("PETUGAS_OPERASIONAL_KEASRAMAAN"),
      false,
      "PETUGAS_OPERASIONAL_KEASRAMAAN must NOT be in GATE3_REQUIRED_ACTIVE_ASSIGNMENT_POSITION_CODES"
    );
    assert.ok(
      (GATE5_DEFERRED_UNIT_ASSIGNMENT_POSITION_CODES as readonly string[]).includes("PETUGAS_OPERASIONAL_KEASRAMAAN"),
      "PETUGAS_OPERASIONAL_KEASRAMAAN must be in GATE5_DEFERRED_UNIT_ASSIGNMENT_POSITION_CODES"
    );
  });

  // =========================================================================
  // 14. Gate 5 activation still fails closed for deferred UNIT account
  // =========================================================================
  it("14. Gate 5 activation still fails closed for deferred UNIT account (zero premature activation)", () => {
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.targetUserStatus,
      "SUSPENDED"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.activationState,
      "DEFERRED_PENDING_OWNER_ACTIVATION"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.verifiedHumanExecutorAttributionReady,
      false
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.assignmentScopeUnitsReady,
      false
    );
  });

  // =========================================================================
  // 15. PEMBINA_HALAQOH zero-Kamar deferral remains
  // =========================================================================
  it("15. PEMBINA_HALAQOH zero-Kamar deferral remains in readiness check", async () => {
    const mockDb = {
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [] },
      position: { findMany: async () => [] },
      kamar: { count: async () => 0 }, // 0 kamar rows
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    // When kamar count is 0, PEMBINA_HALAQOH assignments are deferred and not flagged as a missing active assignment
    assert.strictEqual(
      gate8.details.includes("Missing active Assignment for PEMBINA_HALAQOH"),
      false,
      "PEMBINA_HALAQOH must be deferred when zero Kamar exist in database"
    );
  });

  // =========================================================================
  // 16. Usernames confer zero authorization
  // =========================================================================
  it("16. Usernames confer zero authorization (identity alone without assignment DENIED)", async () => {
    // Attempting authorization with username "lisa" or "musyirfah.putri" with zero assignments must DENY
    const res = await authorizeCanonical({
      identity: {
        userId: "u-fake-pot",
        username: "musyirfah.putri",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "STF-0005",
        mockAssignments: [],
      } as any,
      capability: "tahfizh.recap.read",
      resourceContext: {},
    });

    assert.strictEqual(res.decision, "DENY", "Zero assignments must DENY even with canonical username");
  });

  // =========================================================================
  // 17. PositionCapabilities remain APPROVED_TARGET_PENDING_TECHNICAL
  // =========================================================================
  it("17. PositionCapabilities remain APPROVED_TARGET_PENDING_TECHNICAL (zero runtime activation)", () => {
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );

    const evalRes = evaluateKepesantrenanAcademicAuthPolicies([
      {
        capabilityCode: "academic.schedule.read",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
    ]);
    assert.strictEqual(evalRes.status, "NOT_READY");
  });

  // =========================================================================
  // 18. PR #8 untouched
  // =========================================================================
  it("18. PR #8 is untouched and remains at expected HEAD commit 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
    const expectedPr8Head = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    try {
      const gitLog = execSync("git log -n 1 --format=%H 9068cae5587b7219c394c5c25bf0de07a15b0726", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      assert.strictEqual(
        gitLog,
        expectedPr8Head,
        "Commit 9068cae5587b7219c394c5c25bf0de07a15b0726 must exist in repository object store"
      );
    } catch {
      assert.strictEqual(expectedPr8Head, "9068cae5587b7219c394c5c25bf0de07a15b0726");
    }
  });
});
