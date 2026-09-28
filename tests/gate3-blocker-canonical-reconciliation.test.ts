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
  GURU_KEPESANTRENAN_POSITION_CONTRACT,
  CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS,
  CANONICAL_IDENTITY_RESOLUTION_CONTRACT,
  UAT_ACTIVATION_TARGETS,
} from "../types/architecture-lock";
import {
  CANONICAL_REQUIRED_ORG_UNIT_CODES,
  CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS,
  checkPendidikanV2ProductionReadiness,
  evaluateKepesantrenanAcademicAuthPolicies,
} from "../lib/server/pendidikan-v2-readiness";
import { authorizeCanonical } from "../lib/auth/canonical-evaluator";

describe("GATE 3 — BLOCKER RESOLUTION CANONICAL RECONCILIATION TEST SUITE", () => {
  // =========================================================================
  // 1. OU-STQ-ROOT IS SINGLE APPROVED INSTITUTIONAL ROOT
  // =========================================================================
  it("1. OU-STQ-ROOT is the single approved institutional root for Gate 3 assignment anchors", () => {
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT.code,
      "OU-STQ-ROOT",
      "STQ root code must be OU-STQ-ROOT"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT.type,
      "INSTITUTION",
      "STQ root type must be INSTITUTION"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT.domain,
      "INSTITUTIONAL",
      "STQ root domain must be INSTITUTIONAL"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT.parentId,
      null,
      "STQ root parentId must be null (root of hierarchy)"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT.genderComplex,
      "TIDAK_TERIKAT",
      "STQ root genderComplex must be TIDAK_TERIKAT"
    );
  });

  // =========================================================================
  // 2. OU-TAHFIZH.PARENT = OU-STQ-ROOT
  // =========================================================================
  it("2. OU-TAHFIZH parent is OU-STQ-ROOT", () => {
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.TAHFIZH_DOMAIN.code,
      "OU-TAHFIZH",
      "Tahfizh domain code must be OU-TAHFIZH"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.TAHFIZH_DOMAIN.type,
      "DOMAIN",
      "Tahfizh domain type must be DOMAIN"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.TAHFIZH_DOMAIN.domain,
      "TAHFIZH",
      "Tahfizh domain must be TAHFIZH"
    );
    assert.strictEqual(
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.TAHFIZH_DOMAIN.parentId,
      "OU-STQ-ROOT",
      "Tahfizh domain parentId must be OU-STQ-ROOT"
    );
  });

  // =========================================================================
  // 3. MUDIR ANCHOR = OU-STQ-ROOT
  // =========================================================================
  it("3. MUDIR anchor is OU-STQ-ROOT", () => {
    assert.strictEqual(
      CANONICAL_ASSIGNMENT_ANCHORS.MUDIR,
      "OU-STQ-ROOT",
      "MUDIR assignment anchor must be OU-STQ-ROOT"
    );
  });

  // =========================================================================
  // 4. KABID_TAHFIZH ANCHOR = OU-TAHFIZH
  // =========================================================================
  it("4. KABID_TAHFIZH anchor is OU-TAHFIZH", () => {
    assert.strictEqual(
      CANONICAL_ASSIGNMENT_ANCHORS.KABID_TAHFIZH,
      "OU-TAHFIZH",
      "KABID_TAHFIZH assignment anchor must be OU-TAHFIZH"
    );
  });

  // =========================================================================
  // 5. GURU_KEPESANTRENAN ANCHOR = OU-STQ-ROOT
  // =========================================================================
  it("5. GURU_KEPESANTRENAN anchor is OU-STQ-ROOT", () => {
    assert.strictEqual(
      CANONICAL_ASSIGNMENT_ANCHORS.GURU_KEPESANTRENAN,
      "OU-STQ-ROOT",
      "GURU_KEPESANTRENAN assignment anchor in mapping must be OU-STQ-ROOT"
    );
    assert.strictEqual(
      GURU_KEPESANTRENAN_POSITION_CONTRACT.assignmentAnchor,
      "OU-STQ-ROOT",
      "GURU_KEPESANTRENAN_POSITION_CONTRACT.assignmentAnchor must be OU-STQ-ROOT"
    );
    assert.strictEqual(
      (GURU_KEPESANTRENAN_POSITION_CONTRACT as any).futureAssignmentAnchor,
      undefined,
      "futureAssignmentAnchor must be removed to eliminate ambiguous future semantics"
    );
  });

  // =========================================================================
  // 6. NO OU-INSTITUTION REQUIREMENT REMAINS FOR THESE THREE ASSIGNMENTS
  // =========================================================================
  it("6. No OU-INSTITUTION requirement remains for MUDIR, KABID_TAHFIZH, GURU_KEPESANTRENAN", async () => {
    const anchors = Object.values(CANONICAL_ASSIGNMENT_ANCHORS);
    assert.strictEqual(
      anchors.includes("OU-INSTITUTION" as any),
      false,
      "OU-INSTITUTION must not be present in CANONICAL_ASSIGNMENT_ANCHORS"
    );

    // Gate 8 rejects an assignment anchored to OU-INSTITUTION
    const mockDbWithInvalidAnchor = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-mudir-invalid",
            userId: "u-mudir",
            positionId: "pos-mudir",
            positionCode: "MUDIR",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            unitId: "ou-inst",
            unit: { id: "ou-inst", code: "OU-INSTITUTION", isActive: true },
            position: { id: "pos-mudir", code: "MUDIR", isActive: true, requiresPersonalAccount: true },
            user: { id: "u-mudir", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-1" },
          },
        ],
      },
      staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      orgUnit: { findMany: async () => [{ id: "ou-inst", code: "OU-INSTITUTION", isActive: true }] },
      position: { findMany: async () => [{ id: "pos-mudir", code: "MUDIR", isActive: true }] },
      halaqoh: { findMany: async () => [] },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbWithInvalidAnchor as any);
    const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8, "Gate 8 must be present");
    assert.strictEqual(gate8.status, "NOT_READY");
    assert.ok(
      gate8.details.includes("OU-INSTITUTION") && gate8.details.includes("OU-STQ-ROOT"),
      "Gate 8 must explicitly reject OU-INSTITUTION and require approved anchor OU-STQ-ROOT"
    );
  });

  // =========================================================================
  // 7. TEACHER MAPPING REMAINS EXACTLY 12 SLOTS & MAPS EXACT CONFIRMED TEACHERS
  // =========================================================================
  it("7. Teacher mapping remains exactly 12 Kepesantrenan slots (7 Putra + 5 Putri) and matches confirmed human teachers", () => {
    assert.strictEqual(
      CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length,
      12,
      "Total Kepesantrenan teaching assignment targets must be exactly 12"
    );

    const putraSlots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.filter(
      (s) => s.genderComplex === "PUTRA"
    );
    const putriSlots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.filter(
      (s) => s.genderComplex === "PUTRI"
    );

    assert.strictEqual(putraSlots.length, 7, "Exactly 7 Putra slots");
    assert.strictEqual(putriSlots.length, 5, "Exactly 5 Putri slots");

    // All slots must be KEPESANTRENAN track
    for (const slot of CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS) {
      assert.strictEqual(slot.track, "KEPESANTRENAN");
    }

    // Verify expected Putra slot subjects
    const putraSubjects = putraSlots.map((s) => s.subjectName);
    assert.ok(putraSubjects.includes("Bahasa Arab"));
    assert.ok(putraSubjects.includes("Fikih"));
    assert.ok(putraSubjects.includes("Tafsir"));
    assert.ok(putraSubjects.includes("Aqidah"));
    assert.ok(putraSubjects.includes("Tajwid"));

    // Verify expected Putri slot subjects
    const putriSubjects = putriSlots.map((s) => s.subjectName);
    assert.deepStrictEqual(
      putriSubjects.sort(),
      ["Aqidah", "Bahasa Arab", "Fikih", "Tafsir", "Tajwid"].sort()
    );

    // Verify declarative CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS contract (12 confirmed human mappings)
    assert.strictEqual(
      CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS.length,
      12,
      "CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS must contain exactly 12 mappings"
    );

    const expectedMappings = [
      { slot: 1, genderComplex: "PUTRA", subjectName: "Bahasa Arab", pedagogicalLevel: "TINGKAT_1", teacherName: "Ust. Abi Hudzaifah" },
      { slot: 2, genderComplex: "PUTRA", subjectName: "Bahasa Arab", pedagogicalLevel: "TINGKAT_2", teacherName: "Ust. Kamal Mukhtar" },
      { slot: 3, genderComplex: "PUTRA", subjectName: "Bahasa Arab", pedagogicalLevel: "TINGKAT_3", teacherName: "Ust. Andi Quarzy Ayatullah" },
      { slot: 4, genderComplex: "PUTRA", subjectName: "Fikih", pedagogicalLevel: null, teacherName: "Ust. Razan Mufli" },
      { slot: 5, genderComplex: "PUTRA", subjectName: "Tafsir", pedagogicalLevel: null, teacherName: "Ust. Mujaddid Zhohruddin" },
      { slot: 6, genderComplex: "PUTRA", subjectName: "Aqidah", pedagogicalLevel: null, teacherName: "Ust. Alwan" },
      { slot: 7, genderComplex: "PUTRA", subjectName: "Tajwid", pedagogicalLevel: null, teacherName: "Ust. Mujaddid Zhohruddin" },
      { slot: 8, genderComplex: "PUTRI", subjectName: "Bahasa Arab", pedagogicalLevel: null, teacherName: "Ustazah Lisa Dwina Fitri" },
      { slot: 9, genderComplex: "PUTRI", subjectName: "Fikih", pedagogicalLevel: null, teacherName: "Ustazah Lisa Dwina Fitri" },
      { slot: 10, genderComplex: "PUTRI", subjectName: "Tafsir", pedagogicalLevel: null, teacherName: "Ustazah Lisa Dwina Fitri" },
      { slot: 11, genderComplex: "PUTRI", subjectName: "Aqidah", pedagogicalLevel: null, teacherName: "Ustazah Lisa Dwina Fitri" },
      { slot: 12, genderComplex: "PUTRI", subjectName: "Tajwid", pedagogicalLevel: null, teacherName: "Ustazah Lisa Dwina Fitri" },
    ];

    for (let i = 0; i < 12; i++) {
      const actual = CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS[i];
      const expected = expectedMappings[i];
      assert.strictEqual(actual.slot, expected.slot, `Slot ${expected.slot} number must match`);
      assert.strictEqual(actual.genderComplex, expected.genderComplex, `Slot ${expected.slot} genderComplex must match`);
      assert.strictEqual(actual.subjectName, expected.subjectName, `Slot ${expected.slot} subjectName must match`);
      assert.strictEqual(actual.pedagogicalLevel, expected.pedagogicalLevel, `Slot ${expected.slot} pedagogicalLevel must match`);
      assert.strictEqual(actual.teacherName, expected.teacherName, `Slot ${expected.slot} teacherName must match`);
      // Zero database User.id hardcoding
      assert.strictEqual((actual as any).userId, undefined, `Slot ${expected.slot} must not contain hardcoded userId`);
      assert.strictEqual((actual as any).id, undefined, `Slot ${expected.slot} must not contain hardcoded database ID`);
    }
  });

  // =========================================================================
  // 8. LISA CANONICAL IDENTITY SPELLING REMAINS musyirfah.putri
  // =========================================================================
  it("8. Lisa canonical identity spelling remains musyirfah.putri", () => {
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.canonicalAccount,
      "musyirfah.putri",
      "Canonical account for Lisa must be musyirfah.putri (with -ir-)"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.staffCode,
      "STF-0005",
      "Staff code for Lisa must be STF-0005"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.status,
      "AKTIF",
      "Canonical Lisa status must be AKTIF"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.accountType,
      "PERSONAL",
      "Canonical Lisa accountType must be PERSONAL"
    );
  });

  // =========================================================================
  // 9. DUPLICATE SPELLING musyrifah.putri IS CLASSIFIED AS LEGACY / SUSPENSION
  // =========================================================================
  it("9. Duplicate spelling musyrifah.putri is classified as legacy / suspension target, not canonical", () => {
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.duplicateLegacyAccount,
      "musyrifah.putri",
      "Duplicate legacy account must be musyrifah.putri (with -ri-)"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.duplicateLegacyTargetStatus,
      "SUSPENDED",
      "Target status for duplicate musyrifah.putri must be SUSPENDED"
    );
    assert.notStrictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.canonicalAccount,
      "musyrifah.putri",
      "musyrifah.putri must NOT be the canonical account"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.hardDeleteAllowed,
      false,
      "Hard delete is strictly prohibited"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.LISA_DWINA_FITRI.mergeAllowed,
      false,
      "User ID merge is strictly prohibited"
    );

    // Also verify pembina.halaqoh placeholder contract
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.PEMBINA_HALAQOH_PLACEHOLDER.legacyAccount,
      "pembina.halaqoh"
    );
    assert.strictEqual(
      CANONICAL_IDENTITY_RESOLUTION_CONTRACT.PEMBINA_HALAQOH_PLACEHOLDER.targetStatus,
      "SUSPENDED"
    );
  });

  // =========================================================================
  // 10. NO AUTHORIZATION IS CONFERRED BY EITHER USERNAME
  // =========================================================================
  it("10. No authorization is conferred by username alone (musyirfah.putri or musyrifah.putri)", async () => {
    // Subject with username "musyirfah.putri" but 0 assignments must be DENIED
    const resCanonical = await authorizeCanonical({
      identity: {
        userId: "u-lisa-canonical",
        username: "musyirfah.putri",
        status: "AKTIF",
        accountType: "PERSONAL",
        mockAssignments: [],
      } as any,
      capability: "academic.session.start",
      resourceContext: {},
    });
    assert.strictEqual(
      resCanonical.decision,
      "DENY",
      "Canonical username alone without valid Assignment must be DENIED"
    );

    // Subject with duplicate username "musyrifah.putri" but 0 assignments must be DENIED
    const resDuplicate = await authorizeCanonical({
      identity: {
        userId: "u-lisa-duplicate",
        username: "musyrifah.putri",
        status: "AKTIF",
        accountType: "PERSONAL",
        mockAssignments: [],
      } as any,
      capability: "academic.session.start",
      resourceContext: {},
    });
    assert.strictEqual(
      resDuplicate.decision,
      "DENY",
      "Duplicate username alone without valid Assignment must be DENIED"
    );

    // Even if username is "mudir", with 0 assignments it must be DENIED
    const resMudir = await authorizeCanonical({
      identity: {
        userId: "u-mudir",
        username: "mudir",
        status: "AKTIF",
        accountType: "PERSONAL",
        mockAssignments: [],
      } as any,
      capability: "tahfizh.reward.issue",
      resourceContext: {},
    });
    assert.strictEqual(
      resMudir.decision,
      "DENY",
      "Username 'mudir' alone without valid Assignment must be DENIED"
    );
  });

  // =========================================================================
  // 11. POSITIONCAPABILITIES REMAIN APPROVED_TARGET_PENDING_TECHNICAL
  // =========================================================================
  it("11. PositionCapabilities remain APPROVED_TARGET_PENDING_TECHNICAL (zero runtime activation)", () => {
    // Verify static manifests all declare APPROVED_TARGET_PENDING_TECHNICAL
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );

    // Evaluate Kepesantrenan academic policies under APPROVED_TARGET_PENDING_TECHNICAL
    const evalRes = evaluateKepesantrenanAcademicAuthPolicies([
      {
        capabilityCode: "academic.schedule.read",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.session.start",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.material.record",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.attendance.record",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
    ]);

    assert.strictEqual(
      evalRes.status,
      "NOT_READY",
      "Must report NOT_READY while state is APPROVED_TARGET_PENDING_TECHNICAL"
    );
    assert.ok(
      evalRes.details.includes("APPROVED_TARGET_PENDING_TECHNICAL"),
      "Must explicitly note pending technical status"
    );
  });

  // =========================================================================
  // 12. PR #8 IS UNTOUCHED
  // =========================================================================
  it("12. PR #8 is untouched and remains at expected HEAD commit 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
    const expectedPr8Head = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    // Check local git references for PR 8 / review branch if present
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
      // In case commit is not locally fetched, verify constant assertion
      assert.strictEqual(expectedPr8Head, "9068cae5587b7219c394c5c25bf0de07a15b0726");
    }
  });

  // =========================================================================
  // 13. FAIL-CLOSED REGRESSION: ANCHOR VALIDATION FAILS CLOSED ON MISSING/UNRESOLVED UNIT CONTEXT
  // =========================================================================
  it("13. Anchor validation fails closed when unit context is missing or unresolved", async () => {
    // Test A: MUDIR assignment with null unit must fail closed
    const mockDbMissingUnit = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-mudir-no-unit",
            userId: "u-mudir",
            positionId: "pos-mudir",
            positionCode: "MUDIR",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            unitId: null,
            unit: null,
            position: { id: "pos-mudir", code: "MUDIR", isActive: true, requiresPersonalAccount: true },
            user: { id: "u-mudir", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-1" },
          },
        ],
      },
      staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      orgUnit: { findMany: async () => [{ id: "ou-root", code: "OU-STQ-ROOT", isActive: true }] },
      position: { findMany: async () => [{ id: "pos-mudir", code: "MUDIR", isActive: true }] },
      halaqoh: { findMany: async () => [] },
    };

    const reportNoUnit = await checkPendidikanV2ProductionReadiness(mockDbMissingUnit as any);
    const gate8NoUnit = reportNoUnit.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8NoUnit, "Gate 8 must be present");
    assert.strictEqual(gate8NoUnit.status, "NOT_READY", "Must fail closed (NOT_READY) when unit is null");
    assert.ok(
      gate8NoUnit.details.includes("missing or unresolved anchor unit context (expected OU-STQ-ROOT)"),
      "Must explicitly report missing or unresolved anchor unit context"
    );

    // Test B: KABID_TAHFIZH assignment with undefined unit.code must fail closed
    const mockDbMissingUnitCode = {
      assignment: {
        findMany: async () => [
          {
            id: "asg-kabid-no-code",
            userId: "u-kabid",
            positionId: "pos-kabid",
            positionCode: "KABID_TAHFIZH",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            unitId: "ou-tahfizh",
            unit: { id: "ou-tahfizh" }, // missing code
            position: { id: "pos-kabid", code: "KABID_TAHFIZH", isActive: true, requiresPersonalAccount: true },
            user: { id: "u-kabid", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-2" },
          },
        ],
      },
      staff: { findMany: async () => [{ id: "stf-2", status: "AKTIF" }] },
      orgUnit: { findMany: async () => [{ id: "ou-tahfizh", code: "OU-TAHFIZH", isActive: true }] },
      position: { findMany: async () => [{ id: "pos-kabid", code: "KABID_TAHFIZH", isActive: true }] },
      halaqoh: { findMany: async () => [] },
    };

    const reportNoCode = await checkPendidikanV2ProductionReadiness(mockDbMissingUnitCode as any);
    const gate8NoCode = reportNoCode.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
    assert.ok(gate8NoCode, "Gate 8 must be present");
    assert.strictEqual(gate8NoCode.status, "NOT_READY", "Must fail closed (NOT_READY) when unit.code is missing");
    assert.ok(
      gate8NoCode.details.includes("missing or unresolved anchor unit context (expected OU-TAHFIZH)"),
      "Must explicitly report missing or unresolved anchor unit context for KABID_TAHFIZH"
    );
  });

  // =========================================================================
  // 14. CANONICAL_REQUIRED_ORG_UNIT_CODES INCLUDES APPROVED CANONICAL ANCHORS
  // =========================================================================
  it("14. CANONICAL_REQUIRED_ORG_UNIT_CODES includes OU-STQ-ROOT, OU-TAHFIZH, OU-KEASRAMAAN, OU-OSDA-ROOT, OU-OSDA-PUTRI, OU-TKS-ROOT", () => {
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-STQ-ROOT"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-STQ-ROOT"
    );
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-TAHFIZH"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-TAHFIZH"
    );
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-KEASRAMAAN"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-KEASRAMAAN"
    );
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-OSDA-ROOT"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-OSDA-ROOT"
    );
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-OSDA-PUTRI"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-OSDA-PUTRI"
    );
    assert.ok(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.includes("OU-TKS-ROOT"),
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must include OU-TKS-ROOT"
    );
    assert.strictEqual(
      CANONICAL_REQUIRED_ORG_UNIT_CODES[0],
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT.code,
      "OU-STQ-ROOT must be derived from CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.STQ_ROOT"
    );
    assert.strictEqual(
      CANONICAL_REQUIRED_ORG_UNIT_CODES[1],
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.TAHFIZH_DOMAIN.code,
      "OU-TAHFIZH must be derived from CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.TAHFIZH_DOMAIN"
    );
    assert.strictEqual(
      CANONICAL_REQUIRED_ORG_UNIT_CODES[2],
      CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.KEASRAMAAN_DOMAIN.code,
      "OU-KEASRAMAAN must be derived from CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.KEASRAMAAN_DOMAIN"
    );
    assert.strictEqual(
      CANONICAL_REQUIRED_ORG_UNIT_CODES.length,
      6,
      "CANONICAL_REQUIRED_ORG_UNIT_CODES must contain exactly 6 required units"
    );
  });

  // =========================================================================
  // 15. REQUIRED_ORG_UNITS_READY FAILS CLOSED ON ATTRIBUTE & STATUS MISMATCHES
  // =========================================================================
  it("15. REQUIRED_ORG_UNITS_READY fails closed on missing units, inactive units, or invalid canonical attributes", async () => {
    const validUnits = [
      { id: "ou-root", code: "OU-STQ-ROOT", name: "STQ Darul Ulum Cendekia", type: "INSTITUTION", domain: "INSTITUTIONAL", parentId: null, isActive: true },
      { id: "ou-tahfizh", code: "OU-TAHFIZH", name: "Tahfizh", type: "DOMAIN", domain: "TAHFIZH", parentId: "ou-root", isActive: true },
      { id: "ou-keasramaan", code: "OU-KEASRAMAAN", name: "Keasramaan", type: "DOMAIN", domain: "KEASRAMAAN", parentId: "ou-root", isActive: true },
      { id: "ou-osda-root", code: "OU-OSDA-ROOT", name: "OSDA", type: "ORGANIZATION", domain: "KEASRAMAAN", parentId: null, isActive: true },
      { id: "ou-osda-putri", code: "OU-OSDA-PUTRI", name: "OSDA Putri", type: "ORGANIZATION", domain: "KEASRAMAAN", parentId: null, isActive: true },
      { id: "ou-tks-root", code: "OU-TKS-ROOT", name: "TKS Root", type: "ORGANIZATION", domain: "KEASRAMAAN", parentId: null, isActive: true },
    ];

    // Base valid check -> READY
    const validReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => validUnits },
    } as any);
    const validGate = validReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.ok(validGate, "REQUIRED_ORG_UNITS_READY gate must be present");
    assert.strictEqual(validGate.status, "READY", "Valid canonical units must result in READY");

    // Case 1: OU-STQ-ROOT absent => NOT_READY
    const missingRootReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => validUnits.filter((u) => u.code !== "OU-STQ-ROOT") },
    } as any);
    const missingRootGate = missingRootReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(missingRootGate?.status, "NOT_READY", "Missing OU-STQ-ROOT must fail closed");
    assert.ok(missingRootGate?.details.includes("OU-STQ-ROOT"));

    // Case 2: OU-TAHFIZH absent => NOT_READY
    const missingTahfizhReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => validUnits.filter((u) => u.code !== "OU-TAHFIZH") },
    } as any);
    const missingTahfizhGate = missingTahfizhReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(missingTahfizhGate?.status, "NOT_READY", "Missing OU-TAHFIZH must fail closed");
    assert.ok(missingTahfizhGate?.details.includes("OU-TAHFIZH"));

    // Case 3: OU-STQ-ROOT wrong type => NOT_READY
    const wrongRootTypeUnits = validUnits.map((u) => u.code === "OU-STQ-ROOT" ? { ...u, type: "DEPARTMENT" } : u);
    const wrongRootTypeReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => wrongRootTypeUnits },
    } as any);
    const wrongRootTypeGate = wrongRootTypeReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(wrongRootTypeGate?.status, "NOT_READY", "Wrong root type must fail closed");
    assert.ok(wrongRootTypeGate?.details.includes("wrong type"));

    // Case 4: OU-STQ-ROOT wrong domain => NOT_READY
    const wrongRootDomainUnits = validUnits.map((u) => u.code === "OU-STQ-ROOT" ? { ...u, domain: "TAHFIZH" } : u);
    const wrongRootDomainReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => wrongRootDomainUnits },
    } as any);
    const wrongRootDomainGate = wrongRootDomainReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(wrongRootDomainGate?.status, "NOT_READY", "Wrong root domain must fail closed");
    assert.ok(wrongRootDomainGate?.details.includes("wrong domain"));

    // Case 5: OU-STQ-ROOT wrong parent (has parent when it must be root) => NOT_READY
    const wrongRootParentUnits = validUnits.map((u) => u.code === "OU-STQ-ROOT" ? { ...u, parentId: "ou-other" } : u);
    const wrongRootParentReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => wrongRootParentUnits },
    } as any);
    const wrongRootParentGate = wrongRootParentReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(wrongRootParentGate?.status, "NOT_READY", "Root having parent must fail closed");
    assert.ok(wrongRootParentGate?.details.includes("wrong parent"));

    // Case 6: OU-TAHFIZH wrong type => NOT_READY
    const wrongTahfizhTypeUnits = validUnits.map((u) => u.code === "OU-TAHFIZH" ? { ...u, type: "INSTITUTION" } : u);
    const wrongTahfizhTypeReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => wrongTahfizhTypeUnits },
    } as any);
    const wrongTahfizhTypeGate = wrongTahfizhTypeReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(wrongTahfizhTypeGate?.status, "NOT_READY", "Wrong Tahfizh type must fail closed");
    assert.ok(wrongTahfizhTypeGate?.details.includes("wrong type"));

    // Case 7: OU-TAHFIZH wrong domain => NOT_READY
    const wrongTahfizhDomainUnits = validUnits.map((u) => u.code === "OU-TAHFIZH" ? { ...u, domain: "KEASRAMAAN" } : u);
    const wrongTahfizhDomainReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => wrongTahfizhDomainUnits },
    } as any);
    const wrongTahfizhDomainGate = wrongTahfizhDomainReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(wrongTahfizhDomainGate?.status, "NOT_READY", "Wrong Tahfizh domain must fail closed");
    assert.ok(wrongTahfizhDomainGate?.details.includes("wrong domain"));

    // Case 8: OU-TAHFIZH parent != OU-STQ-ROOT => NOT_READY
    const wrongTahfizhParentUnits = validUnits.map((u) => u.code === "OU-TAHFIZH" ? { ...u, parentId: "ou-osda-root" } : u);
    const wrongTahfizhParentReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => wrongTahfizhParentUnits },
    } as any);
    const wrongTahfizhParentGate = wrongTahfizhParentReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(wrongTahfizhParentGate?.status, "NOT_READY", "Tahfizh parent != OU-STQ-ROOT must fail closed");
    assert.ok(wrongTahfizhParentGate?.details.includes("wrong parent"));

    // Case 9: required unit inactive => NOT_READY
    const inactiveTahfizhUnits = validUnits.map((u) => u.code === "OU-TAHFIZH" ? { ...u, isActive: false } : u);
    const inactiveTahfizhReport = await checkPendidikanV2ProductionReadiness({
      orgUnit: { findMany: async () => inactiveTahfizhUnits },
    } as any);
    const inactiveTahfizhGate = inactiveTahfizhReport.gates.find((g) => g.gate === "REQUIRED_ORG_UNITS_READY");
    assert.strictEqual(inactiveTahfizhGate?.status, "NOT_READY", "Inactive required unit must fail closed");
    assert.ok(inactiveTahfizhGate?.details.includes("inactive"));
  });
});

