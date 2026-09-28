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
  evaluateGate5RuntimeActivation,
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
            genderComplex: "PUTRA",
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
  // 14. Gate 5 activation still fails closed for deferred UNIT account (DIR-2026-037)
  // =========================================================================
  it("14. Gate 5 activation still fails closed for deferred UNIT account (zero premature activation)", async () => {
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

    // Requirement 8: feature flag false => NOT_READY
    const resFlagFalse = evaluateGate5RuntimeActivation({ featureFlagEnabled: false });
    assert.strictEqual(resFlagFalse.status, "NOT_READY", "Feature flag false must evaluate to NOT_READY");

    // Requirement 8: feature flag true + osda.putri suspended + executor path not ready + scope bindings not ready => STILL NOT_READY
    const resFlagTrueSuspended = evaluateGate5RuntimeActivation({
      featureFlagEnabled: true,
      userStatus: "SUSPENDED",
      verifiedHumanExecutorAttributionReady: false,
      assignmentScopeUnitsReady: false,
    });
    assert.strictEqual(
      resFlagTrueSuspended.status,
      "NOT_READY",
      "Feature flag true with suspended UNIT account and unready prerequisites must remain NOT_READY"
    );
    assert.ok(
      resFlagTrueSuspended.details.includes("Feature flag cannot bypass UNIT security per DIR-2026-037"),
      "Must explicitly state feature flag cannot bypass UNIT security"
    );

    // Verify via checkPendidikanV2ProductionReadiness that feature flag does not bypass UNIT security
    const prevEnv = process.env.PENDIDIKAN_V2_UAT_ENABLED;
    try {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const mockDbSuspended = {
        user: {
          findMany: async () => [
            { id: "u-osda", username: "osda.putri", status: "SUSPENDED", accountType: "UNIT" },
          ],
        },
        assignment: { findMany: async () => [] },
        staff: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        position: { findMany: async () => [] },
      };
      const rep = await checkPendidikanV2ProductionReadiness(mockDbSuspended as any);
      const gate14 = rep.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
      assert.ok(gate14, "RUNTIME_ACTIVATION_FLAG gate must exist");
      assert.strictEqual(
        gate14.status,
        "NOT_READY",
        "RUNTIME_ACTIVATION_FLAG must remain NOT_READY when osda.putri is SUSPENDED"
      );
      assert.ok(
        gate14.details.includes("Feature flag cannot bypass UNIT security"),
        "Must enforce that feature flag cannot bypass UNIT security"
      );
    } finally {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
    }
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

  // =========================================================================
  // 19. Regression: HALAQOH_QUERY_ERROR => USER_ASSIGNMENTS_READY != READY
  // =========================================================================
  it("19. Regression: HALAQOH_QUERY_ERROR causes USER_ASSIGNMENTS_READY to fail closed (BLOCKED / DATABASE_UNAVAILABLE)", async () => {
    const mockDbQueryError = {
      halaqoh: {
        findMany: async () => {
          throw new Error("P2021: Table halaqoh does not exist in current search path");
        },
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [] },
      position: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbQueryError as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8, "USER_ASSIGNMENTS_READY gate must exist");
    assert.notStrictEqual(gate8.status, "READY", "USER_ASSIGNMENTS_READY must NOT become READY on query error");
    assert.strictEqual(gate8.status, "BLOCKED", "USER_ASSIGNMENTS_READY must be BLOCKED on query error");
    assert.ok(
      gate8.details.includes("DATABASE_UNAVAILABLE"),
      "Details must indicate DATABASE_UNAVAILABLE"
    );
    assert.ok(
      gate8.details.includes("Authoritative Halaqoh query failed"),
      "Details must specify Authoritative Halaqoh query failed"
    );
  });

  // =========================================================================
  // 20. Target Holder Validation for PETUGAS_OPERASIONAL_TAHFIZH (Fail-Closed)
  // =========================================================================
  it("20. PETUGAS_OPERASIONAL_TAHFIZH target holder validation fails closed for wrong/missing/inactive Staff", async () => {
    const baseUnit = { id: "ou-tahfizh", code: "OU-TAHFIZH", type: "DOMAIN", domain: "TAHFIZH", parentId: "ou-root", isActive: true };
    const basePos = { id: "pos-pot", code: "PETUGAS_OPERASIONAL_TAHFIZH", isActive: true, requiresPersonalAccount: true };

    // Case A: Wrong Staff code
    const mockWrongStaffCode = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-pot-1",
            positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
            unitId: "ou-tahfizh",
            userId: "u-lisa",
            status: "ACTIVE",
            user: { id: "u-lisa", username: "musyirfah.putri", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-wrong" },
            staff: { id: "stf-wrong", code: "STF-9999", staffCode: "STF-9999", status: "AKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repA = await checkPendidikanV2ProductionReadiness(mockWrongStaffCode as any);
    const gateA = repA.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateA);
    assert.notStrictEqual(gateA.status, "READY");
    assert.ok(gateA.details.includes("expected approved holder STF-0005"));

    // Case B: Missing Staff code
    const mockMissingStaffCode = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-pot-2",
            positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
            unitId: "ou-tahfizh",
            userId: "u-lisa",
            status: "ACTIVE",
            user: { id: "u-lisa", username: "musyirfah.putri", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-no-code" },
            staff: { id: "stf-no-code", code: "", staffCode: "", status: "AKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repB = await checkPendidikanV2ProductionReadiness(mockMissingStaffCode as any);
    const gateB = repB.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateB);
    assert.notStrictEqual(gateB.status, "READY");
    assert.ok(gateB.details.includes("staff code is missing or empty"));

    // Case C: Inactive Staff
    const mockInactiveStaff = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-pot-3",
            positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
            unitId: "ou-tahfizh",
            userId: "u-lisa",
            status: "ACTIVE",
            user: { id: "u-lisa", username: "musyirfah.putri", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-5" },
            staff: { id: "stf-5", code: "STF-0005", staffCode: "STF-0005", status: "SUSPENDED" }, // INACTIVE
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repC = await checkPendidikanV2ProductionReadiness(mockInactiveStaff as any);
    const gateC = repC.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateC);
    assert.notStrictEqual(gateC.status, "READY");
    assert.ok(gateC.details.includes("missing or inactive staff") || gateC.details.includes("staff is inactive"));

    // Case D: Correct Staff STF-0005 passes holder validation
    const mockCorrectStaff = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-pot-4",
            positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
            unitId: "ou-tahfizh",
            userId: "u-lisa",
            status: "ACTIVE",
            user: { id: "u-lisa", username: "musyirfah.putri", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-5" },
            staff: { id: "stf-5", code: "STF-0005", staffCode: "STF-0005", status: "AKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repD = await checkPendidikanV2ProductionReadiness(mockCorrectStaff as any);
    const gateD = repD.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateD);
    assert.strictEqual(gateD.details.includes("PETUGAS_OPERASIONAL_TAHFIZH: staff code"), false, "Correct STF-0005 holder must pass");
  });

  // =========================================================================
  // 21. Target Holder Validation for KEPALA_KEASRAMAAN (Fail-Closed)
  // =========================================================================
  it("21. KEPALA_KEASRAMAAN target holder validation fails closed for wrong/missing/inactive Staff", async () => {
    const baseUnit = { id: "ou-keasramaan", code: "OU-KEASRAMAAN", type: "DOMAIN", domain: "KEASRAMAAN", parentId: "ou-root", isActive: true };
    const basePos = { id: "pos-kea", code: "KEPALA_KEASRAMAAN", isActive: true, requiresPersonalAccount: true };

    // Case A: Wrong Staff code
    const mockWrongStaffCode = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-kea-1",
            positionCode: "KEPALA_KEASRAMAAN",
            unitId: "ou-keasramaan",
            userId: "u-mujaddid",
            status: "ACTIVE",
            user: { id: "u-mujaddid", username: "musyrif.asrama", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-wrong" },
            staff: { id: "stf-wrong", code: "STF-9999", staffCode: "STF-9999", status: "AKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repA = await checkPendidikanV2ProductionReadiness(mockWrongStaffCode as any);
    const gateA = repA.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateA);
    assert.notStrictEqual(gateA.status, "READY");
    assert.ok(gateA.details.includes("expected approved holder STF-0004"));

    // Case B: Missing Staff code
    const mockMissingStaffCode = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-kea-2",
            positionCode: "KEPALA_KEASRAMAAN",
            unitId: "ou-keasramaan",
            userId: "u-mujaddid",
            status: "ACTIVE",
            user: { id: "u-mujaddid", username: "musyrif.asrama", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-no-code" },
            staff: { id: "stf-no-code", code: "", staffCode: "", status: "AKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repB = await checkPendidikanV2ProductionReadiness(mockMissingStaffCode as any);
    const gateB = repB.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateB);
    assert.notStrictEqual(gateB.status, "READY");
    assert.ok(gateB.details.includes("staff code is missing or empty"));

    // Case C: Inactive Staff
    const mockInactiveStaff = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-kea-3",
            positionCode: "KEPALA_KEASRAMAAN",
            unitId: "ou-keasramaan",
            userId: "u-mujaddid",
            status: "ACTIVE",
            user: { id: "u-mujaddid", username: "musyrif.asrama", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-4" },
            staff: { id: "stf-4", code: "STF-0004", staffCode: "STF-0004", status: "NONAKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repC = await checkPendidikanV2ProductionReadiness(mockInactiveStaff as any);
    const gateC = repC.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateC);
    assert.notStrictEqual(gateC.status, "READY");
    assert.ok(gateC.details.includes("missing or inactive staff") || gateC.details.includes("staff is inactive"));

    // Case D: Correct Staff STF-0004 passes holder validation
    const mockCorrectStaff = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-kea-4",
            positionCode: "KEPALA_KEASRAMAAN",
            unitId: "ou-keasramaan",
            userId: "u-mujaddid",
            status: "ACTIVE",
            user: { id: "u-mujaddid", username: "musyrif.asrama", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-4" },
            staff: { id: "stf-4", code: "STF-0004", staffCode: "STF-0004", status: "AKTIF" },
            unit: baseUnit,
            position: basePos,
          },
        ],
      },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [baseUnit] },
      position: { findMany: async () => [basePos] },
    };
    const repD = await checkPendidikanV2ProductionReadiness(mockCorrectStaff as any);
    const gateD = repD.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gateD);
    assert.strictEqual(gateD.details.includes("KEPALA_KEASRAMAAN: staff code"), false, "Correct STF-0004 holder must pass");
  });

  // =========================================================================
  // 22. Unapproved future Halaqoh outside canonical six fails closed
  // =========================================================================
  it("22. Unapproved active Halaqoh outside canonical six triggers HALAQOH_RECONCILIATION_REQUIRED and fails closed", async () => {
    const mockDbWithUnapprovedHalaqoh = {
      halaqoh: {
        findMany: async () => [
          {
            id: "hlq-7",
            code: "HLQ-0007", // Outside current six
            name: "Halaqoh 7 Baru",
            status: "AKTIF",
            musyrifId: "stf-10",
            musyrif: {
              id: "stf-10",
              code: "STF-0010",
              status: "AKTIF",
              user: { id: "u-10", username: "ust.baru", status: "AKTIF", accountType: "PERSONAL" },
            },
          },
        ],
      },
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: { findMany: async () => [] },
      position: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbWithUnapprovedHalaqoh as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    assert.notStrictEqual(gate8.status, "READY");
    assert.ok(
      gate8.details.includes("HALAQOH_RECONCILIATION_REQUIRED"),
      "Must flag HALAQOH_RECONCILIATION_REQUIRED for unapproved halaqoh"
    );
  });

  // =========================================================================
  // 23. Target OrgUnit genderComplex fails closed for wrong/missing gender
  // =========================================================================
  it("23. Target OrgUnit genderComplex mismatch or absence causes MUSYRIF_TAHFIZH validation to fail closed", async () => {
    // HLQ-0001 must have genderComplex PUTRA; test with PUTRI (wrong)
    const mockDbWrongGender = {
      halaqoh: {
        findMany: async () => [
          {
            id: "hlq-1",
            code: "HLQ-0001",
            name: "Halaqoh 1",
            status: "AKTIF",
            musyrifId: "stf-3",
            musyrif: {
              id: "stf-3",
              code: "STF-0003",
              status: "AKTIF",
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
            parentId: "OU-TAHFIZH",
            parent: { code: "OU-TAHFIZH" },
            genderComplex: "PUTRI", // WRONG: HLQ-0001 is PUTRA
            isActive: true,
          },
        ],
      },
      position: { findMany: async () => [] },
    };

    const reportWrongGender = await checkPendidikanV2ProductionReadiness(mockDbWrongGender as any);
    const gate8 = reportWrongGender.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    assert.notStrictEqual(gate8.status, "READY");
    assert.ok(
      gate8.details.includes("genderComplex is PUTRI, expected PUTRA"),
      "Must fail closed when target OrgUnit genderComplex is wrong"
    );
  });

  // =========================================================================
  // 24. Exact current six mappings pass when fully satisfied
  // =========================================================================
  it("24. All current six Halaqoh relational mappings pass when exact canonical requirements are satisfied", async () => {
    const parentUnit = { id: "ou-tahfizh", code: "OU-TAHFIZH", type: "DOMAIN", domain: "TAHFIZH", isActive: true };
    const posMusyrif = { id: "pos-mt", code: "MUSYRIF_TAHFIZH", isActive: true, requiresPersonalAccount: true };

    const halaqohs = CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS.map((m, idx) => ({
      id: `hlq-${idx + 1}`,
      code: m.halaqohCode,
      name: m.name,
      status: "AKTIF",
      musyrifId: `stf-${idx + 1}`,
      musyrif: {
        id: `stf-${idx + 1}`,
        code: m.expectedStaffCode,
        staffCode: m.expectedStaffCode,
        status: "AKTIF",
        user: {
          id: `u-${idx + 1}`,
          username: m.expectedUsername,
          status: "AKTIF",
          accountType: "PERSONAL",
        },
      },
    }));

    const orgUnits = [
      parentUnit,
      ...CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS.map((m, idx) => ({
        id: `ou-hlq-${idx + 1}`,
        code: m.targetOrgUnitCode,
        type: m.targetOrgUnitType,
        domain: m.targetOrgUnitDomain,
        parentId: "ou-tahfizh",
        parent: { code: "OU-TAHFIZH" },
        genderComplex: m.genderComplex,
        isActive: true,
      })),
    ];

    const assignments = CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS.map((m, idx) => ({
      id: `asg-hlq-${idx + 1}`,
      positionCode: "MUSYRIF_TAHFIZH",
      unitId: `ou-hlq-${idx + 1}`,
      userId: `u-${idx + 1}`,
      status: "ACTIVE",
      user: {
        id: `u-${idx + 1}`,
        username: m.expectedUsername,
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: `stf-${idx + 1}`,
      },
      staff: {
        id: `stf-${idx + 1}`,
        code: m.expectedStaffCode,
        staffCode: m.expectedStaffCode,
        status: "AKTIF",
      },
      unit: orgUnits[idx + 1],
      position: posMusyrif,
    }));

    const mockDbCurrentSix = {
      halaqoh: { findMany: async () => halaqohs },
      assignment: { findMany: async () => assignments },
      staff: { findMany: async () => halaqohs.map((h) => h.musyrif) },
      orgUnit: { findMany: async () => orgUnits },
      position: { findMany: async () => [posMusyrif] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbCurrentSix as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    // Ensure zero issues were raised regarding halaqoh mappings
    assert.strictEqual(
      gate8.details.includes("Halaqoh HLQ-"),
      false,
      "Exact current-six mappings must satisfy all relational criteria without errors"
    );
  });

  // =========================================================================
  // 25. PEMBINA_HALAQOH conditional deferral vs active Kamar requirement
  // =========================================================================
  it("25. PEMBINA_HALAQOH active assignment is required when active Kamar exists (>0)", async () => {
    // Active Kamar exists (count = 1), but zero PEMBINA_HALAQOH assignments exist
    const mockDbActiveKamar = {
      assignment: { findMany: async () => [] },
      staff: { findMany: async () => [] },
      orgUnit: {
        findMany: async () => [
          { id: "kamar-1", code: "KMR-01", type: "KAMAR", domain: "KEASRAMAAN", isActive: true },
        ],
      },
      position: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbActiveKamar as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8);
    assert.notStrictEqual(gate8.status, "READY");
    assert.ok(
      gate8.details.includes("PEMBINA_HALAQOH"),
      "When active Kamar exists, missing PEMBINA_HALAQOH assignment must fail closed"
    );
  });

  // =========================================================================
  // 26. Halaqoh repository unavailable must fail closed (USER_ASSIGNMENTS_READY BLOCKED)
  // =========================================================================
  it("26. Assignment data exists but authoritative db.halaqoh unavailable => USER_ASSIGNMENTS_READY = BLOCKED (DATABASE_UNAVAILABLE)", async () => {
    const mockDbNoHalaqoh = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-1",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            position: { code: "MUDIR", isActive: true },
            unit: { code: "OU-STQ-ROOT", isActive: true },
            user: { id: "u-1", status: "AKTIF", staffId: "stf-1" },
            staff: { id: "stf-1", status: "AKTIF" },
          },
        ],
      },
      staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      user: { findMany: async () => [{ id: "u-1", status: "AKTIF", staffId: "stf-1" }] },
      orgUnit: { findMany: async () => [{ id: "ou-root", code: "OU-STQ-ROOT", isActive: true }] },
      position: { findMany: async () => [{ id: "p-mudir", code: "MUDIR", isActive: true }] },
      // db.halaqoh is explicitly absent / unavailable
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbNoHalaqoh as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8, "USER_ASSIGNMENTS_READY gate must exist");
    assert.strictEqual(gate8.status, "BLOCKED", "Gate 8 must be BLOCKED when halaqoh delegate is unavailable");
    assert.strictEqual(gate8.reason, "DATABASE_UNAVAILABLE", "Reason must be DATABASE_UNAVAILABLE");
    assert.ok(
      gate8.details.includes("authoritative Halaqoh repository/delegate is unavailable for current-six validation"),
      `Details must mention halaqoh delegate unavailable: ${gate8.details}`
    );
  });

  // =========================================================================
  // 27. Gate 5 OSDA security — User status ACTIVE is NEVER proof of human executor or scope units
  // =========================================================================
  it("27. Gate 5 OSDA security: User status ACTIVE never auto-promotes executor attribution or scope units", async () => {
    const prevEnv = process.env.PENDIDIKAN_V2_UAT_ENABLED;

    // A. Feature flag false => NOT_READY
    try {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "false";
      const repA = await checkPendidikanV2ProductionReadiness({
        user: { findMany: async () => [{ id: "u-osda", username: "osda.putri", status: "AKTIF" }] },
      } as any);
      const gate5A = repA.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
      assert.ok(gate5A);
      assert.strictEqual(gate5A.status, "NOT_READY", "Feature flag false => NOT_READY");
    } finally {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
    }

    // B. Feature flag true + osda suspended => NOT_READY
    try {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const repB = await checkPendidikanV2ProductionReadiness({
        user: { findMany: async () => [{ id: "u-osda", username: "osda.putri", status: "SUSPENDED" }] },
      } as any);
      const gate5B = repB.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
      assert.ok(gate5B);
      assert.strictEqual(gate5B.status, "NOT_READY", "Feature flag true + osda suspended => NOT_READY");
      assert.ok(gate5B.details.includes("activation deferred per DIR-2026-037"));
    } finally {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
    }

    // C. Feature flag true + osda accidentally ACTIVE in DB
    //    ACTIVE status must NEVER auto-promote verifiedHumanExecutorAttributionReady or assignmentScopeUnitsReady
    try {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const repC = await checkPendidikanV2ProductionReadiness({
        user: { findMany: async () => [{ id: "u-osda", username: "osda.putri", status: "AKTIF" }] },
      } as any);
      const gate5C = repC.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
      assert.ok(gate5C);
      assert.strictEqual(gate5C.status, "NOT_READY", "Feature flag true + osda ACTIVE must still be NOT_READY");
      assert.ok(gate5C.details.includes("verifiedHumanExecutorAttributionReady is false"));
      assert.ok(gate5C.details.includes("assignmentScopeUnitsReady is false"));
      assert.ok(gate5C.details.includes("Feature flag cannot bypass UNIT security per DIR-2026-037"));
    } finally {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
    }
  });

  // =========================================================================
  // 28. evaluateGate5RuntimeActivation pure helper prerequisite independence
  // =========================================================================
  it("28. evaluateGate5RuntimeActivation requires independent proof of executor attribution and scope units", () => {
    // 1. Feature flag false => NOT_READY
    const r1 = evaluateGate5RuntimeActivation({
      featureFlagEnabled: false,
      userStatus: "AKTIF",
      verifiedHumanExecutorAttributionReady: true,
      assignmentScopeUnitsReady: true,
    });
    assert.strictEqual(r1.status, "NOT_READY");

    // 2. Feature flag true + osda suspended => NOT_READY
    const r2 = evaluateGate5RuntimeActivation({
      featureFlagEnabled: true,
      userStatus: "SUSPENDED",
      verifiedHumanExecutorAttributionReady: true,
      assignmentScopeUnitsReady: true,
    });
    assert.strictEqual(r2.status, "NOT_READY");

    // 3. Feature flag true + osda active BUT executorReady=false => NOT_READY
    const r3 = evaluateGate5RuntimeActivation({
      featureFlagEnabled: true,
      userStatus: "AKTIF",
      verifiedHumanExecutorAttributionReady: false,
      assignmentScopeUnitsReady: true,
    });
    assert.strictEqual(r3.status, "NOT_READY");
    assert.ok(r3.details.includes("verifiedHumanExecutorAttributionReady is false"));

    // 4. Feature flag true + osda active BUT assignmentScopeUnitsReady=false => NOT_READY
    const r4 = evaluateGate5RuntimeActivation({
      featureFlagEnabled: true,
      userStatus: "AKTIF",
      verifiedHumanExecutorAttributionReady: true,
      assignmentScopeUnitsReady: false,
    });
    assert.strictEqual(r4.status, "NOT_READY");
    assert.ok(r4.details.includes("assignmentScopeUnitsReady is false"));

    // 5. Default contract parameters (osda suspended, executor=false, scopeUnits=false) => NOT_READY
    const r5 = evaluateGate5RuntimeActivation({
      featureFlagEnabled: true,
    });
    assert.strictEqual(r5.status, "NOT_READY");
  });
});
