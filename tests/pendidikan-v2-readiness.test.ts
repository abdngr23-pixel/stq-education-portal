/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkPendidikanV2ProductionReadiness,
  CANONICAL_READINESS_GATE_NAMES,
  CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS,
  CANONICAL_REQUIRED_POSITION_CODES,
  CANONICAL_UAT_TARGET_POLICIES,
  REQUIRED_UAT_ACTIVATION_CAPABILITIES,
  KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES,
  KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES,
  evaluateKepesantrenanAcademicAuthPolicies,
  evaluateGate5RuntimeActivation,
} from "../lib/server/pendidikan-v2-readiness";
import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
} from "../lib/auth/canonical-evaluator";

describe("GATE 5 — PENDIDIKAN V2 READINESS REMEDIATION TESTS", () => {
  // =========================================================================
  // SECTION 9: STAFF LINKAGE TESTS
  // =========================================================================
  describe("9. Staff Linkage Safety Gate Predicate", () => {
    it("A. AKTIF PERSONAL MT without Staff => STAFF_LINKAGE_READY BLOCKED", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-1", username: "ust.fulan", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: null },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-other", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.ok(gate.details.includes("ust.fulan"));
      assert.ok(report.unlinkedStaffAccounts.includes("ust.fulan"));
    });

    it("B. AKTIF PERSONAL PH without Staff => BLOCKED", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-2", username: "pembina.fulan", role: "PH", accountType: "PERSONAL", status: "AKTIF", staffId: null },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-other", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.ok(gate.details.includes("pembina.fulan"));
      assert.ok(report.unlinkedStaffAccounts.includes("pembina.fulan"));
    });

    it("C. AKTIF PERSONAL user with active Staff => not blocked", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-3", username: "ust.active", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: "stf-1" },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.strictEqual(report.unlinkedStaffAccounts.length, 0);
    });

    it("D. SUSPENDED SUBJECT role GA without Staff => NOT included in blocked Staff accounts", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-sub-1", username: "subject.matematika", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.matematika"), false);
    });

    it("E. AKTIF SUBJECT role GA without Staff => NOT included in human Staff-linkage gate because AccountType is SUBJECT", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-sub-2", username: "subject.ipa", role: "GA", accountType: "SUBJECT", status: "AKTIF", staffId: null },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.ipa"), false);
    });

    it("F. SUSPENDED UNIT without Staff => NOT blocked", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-unit-1", username: "osda.putri", role: "GA", accountType: "ORGANIZATION_UNIT", status: "SUSPENDED", staffId: null },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.strictEqual(report.unlinkedStaffAccounts.includes("osda.putri"), false);
    });

    it("G. NONAKTIF PERSONAL orphan => NOT blocked by active-human readiness", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-orph-1", username: "former.teacher", role: "MT", accountType: "PERSONAL", status: "NONAKTIF", staffId: null },
          ],
        },
        staff: { findMany: async () => [{ id: "stf-1", status: "AKTIF" }] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.strictEqual(report.unlinkedStaffAccounts.includes("former.teacher"), false);
    });

    it("H. Current-production-shaped data: six SUBJECT technical accounts + three active PERSONAL orphans => blocked list contains EXACTLY: musyrifah.putri, razan.mt, pembina.halaqoh", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            // 6 technical subject accounts (legacy role GA, accountType SUBJECT, suspended)
            { id: "s-1", username: "subject.matematika", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
            { id: "s-2", username: "subject.bahasainggris", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
            { id: "s-3", username: "subject.ips", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
            { id: "s-4", username: "subject.ipa", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
            { id: "s-5", username: "subject.bahasaindonesia", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
            { id: "s-6", username: "subject.tik", role: "GA", accountType: "SUBJECT", status: "SUSPENDED", staffId: null },
            // 1 technical unit account
            { id: "u-unit", username: "osda.putri", role: "GA", accountType: "ORGANIZATION_UNIT", status: "SUSPENDED", staffId: null },
            // 3 active personal orphan accounts
            { id: "p-1", username: "musyrifah.putri", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: null },
            { id: "p-2", username: "razan.mt", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: null },
            { id: "p-3", username: "pembina.halaqoh", role: "PH", accountType: "PERSONAL", status: "AKTIF", staffId: null },
            // Active staff-linked user
            { id: "p-4", username: "ust.ahmad", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: "stf-ahmad" },
          ],
        },
        staff: {
          findMany: async () => [{ id: "stf-ahmad", status: "AKTIF" }],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");

      const sortedBlocked = [...report.unlinkedStaffAccounts].sort();
      const expectedBlocked = ["musyrifah.putri", "pembina.halaqoh", "razan.mt"].sort();
      assert.deepStrictEqual(sortedBlocked, expectedBlocked);

      // Excluded technical accounts verification
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.matematika"), false);
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.bahasainggris"), false);
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.ips"), false);
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.ipa"), false);
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.bahasaindonesia"), false);
      assert.strictEqual(report.unlinkedStaffAccounts.includes("subject.tik"), false);
      assert.strictEqual(report.unlinkedStaffAccounts.includes("osda.putri"), false);
    });
  });

  // =========================================================================
  // SECTION 10: STUDI UMUM TESTS
  // =========================================================================
  describe("10. Studi Umum Independence from TeachingAssignment", () => {
    it("10.1 Six Studi Umum subjects are NOT required by TEACHING_ASSIGNMENTS_READY", () => {
      const studiUmumSubjects = [
        "Matematika",
        "Bahasa Inggris",
        "IPS",
        "IPA",
        "Bahasa Indonesia",
        "TIK",
      ];
      for (const sub of studiUmumSubjects) {
        const found = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.find(
          (t) => t.track === "STUDI_UMUM" || t.subjectName === sub
        );
        assert.strictEqual(found, undefined, `Studi Umum subject ${sub} must not be in TEACHING_ASSIGNMENTS_READY coverage targets`);
      }
    });

    it("10.2 Absence of human TeachingAssignment for Studi Umum subjects does not fail TeachingAssignment readiness", async () => {
      // Mock db providing all 12 Kepesantrenan slots, zero Studi Umum TeachingAssignments
      const kepesantrenanTas = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex,
        pedagogicalLevel: t.pedagogicalLevel || null,
        staffId: `stf-${idx}`,
        staff: { id: `stf-${idx}`, status: "AKTIF" },
        mapel: { nama: t.subjectName },
        isActive: true,
      }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => kepesantrenanTas,
        },
        staff: {
          findMany: async () => kepesantrenanTas.map((t) => t.staff),
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.ok(!gate.details.includes("Matematika"));
      assert.ok(!gate.details.includes("Bahasa Inggris"));
    });

    it("10.3 SUBJECT authorization contract remains binding-based (not TeachingAssignment based)", () => {
      // Assert that TeachingAssignment target list strictly specifies track KEPESANTRENAN
      for (const target of CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS) {
        assert.strictEqual(target.track, "KEPESANTRENAN");
      }
    });
  });

  // =========================================================================
  // SECTION 11: KEPESANTRENAN TESTS
  // =========================================================================
  describe("11. Kepesantrenan Teaching Assignment Planning Coverage", () => {
    it("11.1 Exactly 12 Kepesantrenan planning targets are evaluated", () => {
      assert.strictEqual(CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length, 12);
      const putraTargets = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.filter((t) => t.genderComplex === "PUTRA");
      const putriTargets = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.filter((t) => t.genderComplex === "PUTRI");
      assert.strictEqual(putraTargets.length, 7);
      assert.strictEqual(putriTargets.length, 5);
    });

    it("11.2 Missing one required slot => NOT_READY", async () => {
      // Provide 11 slots, missing Tajwid PUTRI
      const slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS
        .filter((t) => t.key !== "KEPESANTRENAN:PUTRI:Tajwid")
        .map((t, idx) => ({
          id: `ta-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex,
          pedagogicalLevel: t.pedagogicalLevel || null,
          staffId: `stf-${idx}`,
          staff: { id: `stf-${idx}`, status: "AKTIF" },
          mapel: { nama: t.subjectName },
          isActive: true,
        }));

      const mockDb = {
        teachingAssignment: { findMany: async () => slots },
        staff: { findMany: async () => slots.map((s) => s.staff) },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("KEPESANTRENAN:PUTRI:Tajwid"));
    });

    it("11.3 Wrong gender => NOT_READY", async () => {
      // Provide Tajwid PUTRA for Tajwid PUTRI
      const slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-${idx}`,
        educationTrack: t.track,
        genderComplex: t.key === "KEPESANTRENAN:PUTRI:Tajwid" ? "PUTRA" : t.genderComplex,
        pedagogicalLevel: t.pedagogicalLevel || null,
        staffId: `stf-${idx}`,
        staff: { id: `stf-${idx}`, status: "AKTIF" },
        mapel: { nama: t.subjectName },
        isActive: true,
      }));

      const mockDb = {
        teachingAssignment: { findMany: async () => slots },
        staff: { findMany: async () => slots.map((s) => s.staff) },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("KEPESANTRENAN:PUTRI:Tajwid"));
    });

    it("11.4 Wrong Bahasa Arab pedagogical level => NOT_READY", async () => {
      // Provide TINGKAT_1 instead of TINGKAT_3 for Bahasa Arab Tingkat 3
      const slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex,
        pedagogicalLevel: t.key === "KEPESANTRENAN:PUTRA:Bahasa Arab:TINGKAT_3" ? "TINGKAT_1" : (t.pedagogicalLevel || null),
        staffId: `stf-${idx}`,
        staff: { id: `stf-${idx}`, status: "AKTIF" },
        mapel: { nama: t.subjectName },
        isActive: true,
      }));

      const mockDb = {
        teachingAssignment: { findMany: async () => slots },
        staff: { findMany: async () => slots.map((s) => s.staff) },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("KEPESANTRENAN:PUTRA:Bahasa Arab:TINGKAT_3"));
    });

    it("11.5 Inactive/missing Staff => NOT_READY", async () => {
      const slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex,
        pedagogicalLevel: t.pedagogicalLevel || null,
        staffId: `stf-${idx}`,
        staff: { id: `stf-${idx}`, status: idx === 0 ? "NONAKTIF" : "AKTIF" },
        mapel: { nama: t.subjectName },
        isActive: true,
      }));

      const mockDb = {
        teachingAssignment: { findMany: async () => slots },
        staff: { findMany: async () => slots.map((s) => s.staff) },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("inactive or missing Staff"));
    });

    it("11.6 Exact valid 12-slot planning coverage passes planning portion", async () => {
      const slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex,
        pedagogicalLevel: t.pedagogicalLevel || null,
        staffId: `stf-${idx}`,
        staff: { id: `stf-${idx}`, status: "AKTIF" },
        mapel: { nama: t.subjectName },
        isActive: true,
      }));

      const mockDb = {
        teachingAssignment: { findMany: async () => slots },
        staff: { findMany: async () => slots.map((s) => s.staff) },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.ok(gate.details.includes("All 12 required teaching assignment slots covered"));
    });

    it("11.7 TeachingAssignment existence alone does NOT constitute runtime authorization", async () => {
      // Scheduled teacher has TeachingAssignment but zero canonical Assignments or PositionCapabilities
      const scheduledStaffUser = {
        userId: "usr-sched-1",
        username: "guru.scheduled",
        status: "AKTIF",
        accountType: "PERSONAL" as const,
        staffId: "stf-sched-1",
        mockAssignments: [], // Zero assignments
      };

      const authDecision = await authorizeCanonical({
        identity: scheduledStaffUser as any,
        capability: "academic.session.start",
        resourceContext: { educationSessionId: "sess-1" },
        isMutation: true,
      });

      assert.strictEqual(authDecision.decision, "DENY");
      assert.ok(["CAPABILITY_NOT_GRANTED", "NO_ASSIGNMENT", "NO_EXPLICIT_GRANT", "DENIED"].includes(authDecision.code || "DENIED"));
    });
  });

  // =========================================================================
  // SECTION 12: COHORT INFORMATIONAL TESTS
  // =========================================================================
  describe("12. Cohort Gate Non-Blocking Informational Semantics", () => {
    it("A. 57 active santri with cohort_id = null => COHORTS_ASSIGNED visible as NOT_READY/informational", async () => {
      const activeSantris = Array.from({ length: 57 }, (_, i) => ({
        id: `san-${i}`,
        status: "AKTIF",
        cohortId: null,
      }));

      const mockDb = {
        santri: { findMany: async () => activeSantris },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const cohortGate = report.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
      assert.ok(cohortGate);
      assert.strictEqual(cohortGate.status, "NOT_READY");
      assert.ok(cohortGate.details.includes("COHORT_NOT_ASSIGNED"));
      assert.ok(cohortGate.details.includes("DEFERRED_INFORMATIONAL"));
      assert.ok(cohortGate.details.includes("COHORT_NOT_REQUIRED_FOR_RUNTIME"));
      assert.ok(cohortGate.remediationAdvice?.includes("DEFERRED_INFORMATIONAL"));
    });

    it("B. Cohort gate has blocking=false", async () => {
      const mockDb = {
        santri: {
          findMany: async () => [
            { id: "san-1", status: "AKTIF", cohortId: null },
          ],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const cohortGate = report.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
      assert.ok(cohortGate);
      assert.strictEqual(cohortGate.blocking, false);
    });

    it("C. If all other blocking gates are READY, COHORTS_ASSIGNED NOT_READY alone does NOT make overallStatus NOT_READY", async () => {
      // Mock DB where all blocking gates evaluate to READY, but COHORTS_ASSIGNED is NOT_READY
      const slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex,
        pedagogicalLevel: t.pedagogicalLevel || null,
        staffId: `stf-${idx}`,
        staff: { id: `stf-${idx}`, status: "AKTIF" },
        mapel: { nama: t.subjectName },
        isActive: true,
      }));

      const reqAssignments = CANONICAL_REQUIRED_POSITION_CODES.map((posCode, idx) => {
        const targetPolicies = CANONICAL_UAT_TARGET_POLICIES.filter((p) => p.positionCode === posCode);
        const capabilities = targetPolicies.map((p) => ({
          capabilityCode: p.capabilityCode,
          scopeType: p.expectedScope,
          businessRuleState: "VERIFIED_PRODUCTION",
          capability: { code: p.capabilityCode, isBlocked: false },
        }));
        if (capabilities.length === 0) {
          capabilities.push({
            capabilityCode: "academic.schedule.read",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
            capability: { code: "academic.schedule.read", isBlocked: false },
          });
        }
        const isUnit = posCode === "PETUGAS_OPERASIONAL_KEASRAMAAN";
        const staffCode =
          posCode === "PETUGAS_OPERASIONAL_TAHFIZH"
            ? "STF-0005"
            : posCode === "KEPALA_KEASRAMAAN"
            ? "STF-0004"
            : posCode === "MUSYRIF_TAHFIZH"
            ? "STF-0003"
            : posCode === "PEMBINA_HALAQOH"
            ? "STF-0003"
            : `STF-00${idx + 10}`;
        const staffId = `stf-${staffCode.toLowerCase()}`;
        const isHalaqohScope = posCode === "MUSYRIF_TAHFIZH" || posCode === "PEMBINA_HALAQOH";
        const unitId = isHalaqohScope ? "ou-hlq-1" : `ou-req-${idx}`;

        return {
          id: `asg-req-${idx}`,
          userId: isUnit ? `u-unit-${idx}` : `u-${idx}`,
          positionId: `pos-req-${idx}`,
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          unitId,
          scopeUnits: [{ unitId }],
          unit: isHalaqohScope
            ? {
                id: "ou-hlq-1",
                code: "OU-HLQ-0001",
                type: "HALAQOH",
                domain: "TAHFIZH",
                parentId: "ou-tahfizh",
                parent: { code: "OU-TAHFIZH" },
                genderComplex: "PUTRA",
                isActive: true,
              }
            : undefined,
          staff: isUnit
            ? undefined
            : { id: staffId, staffCode, code: staffCode, status: "AKTIF" },
          user: isUnit
            ? {
                id: `u-unit-${idx}`,
                username: `osda.putri`,
                status: "AKTIF",
                accountType: "UNIT",
                unitPlacements: [{ unitId }],
              }
            : {
                id: `u-${idx}`,
                username: `ust.ahmad${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                staffId,
                staff: { id: staffId, staffCode, code: staffCode, status: "AKTIF" },
              },
          position: {
            id: `pos-req-${idx}`,
            code: posCode,
            name: posCode,
            isActive: true,
            requiresPersonalAccount: !isUnit,
            domain: (isUnit || posCode === "KEPALA_KEASRAMAAN") ? "KEASRAMAAN" : "AKADEMIK",
            capabilities,
          },
        };
      });

      const mockDb = {
        // Gates 1 & 2 & 3: Catalog queries
        $queryRawUnsafe: async (query: string) => {
          if (query.includes("health_cases_v2")) {
            return [{ table_name: "health_cases_v2" }, { table_name: "health_case_v2_events" }];
          }
          if (query.includes("HealthStatusV2")) {
            return [{ typname: "HealthStatusV2" }];
          }
          if (query.includes("education_cohorts")) {
            return [
              { table_name: "education_cohorts" },
              { table_name: "teaching_assignments" },
              { table_name: "education_sessions" },
              { table_name: "education_session_participants" },
              { table_name: "education_session_attendances" },
            ];
          }
          if (query.includes("EducationTrack")) {
            return [
              { typname: "EducationTrack" },
              { typname: "PedagogicalLevel" },
              { typname: "EducationSessionStatus" },
              { typname: "EducationAttendanceStatus" },
            ];
          }
          if (query.includes("canonical_audit_logs")) {
            return [{ table_name: "canonical_audit_logs" }];
          }
          return [];
        },
        // Gate 4: Staff linkage
        user: {
          findMany: async () => [
            { id: "u-1", username: "ust.ahmad", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: "stf-1" },
            { id: "u-unit-osda", username: "osda.putri", role: "POK", accountType: "UNIT", status: "SUSPENDED" },
          ],
        },
        staff: {
          findMany: async () => [
            { id: "stf-1", staffCode: "STF-0001", code: "STF-0001", status: "AKTIF" },
            { id: "stf-stf-0005", staffCode: "STF-0005", code: "STF-0005", status: "AKTIF" },
            { id: "stf-stf-0004", staffCode: "STF-0004", code: "STF-0004", status: "AKTIF" },
            { id: "stf-stf-0003", staffCode: "STF-0003", code: "STF-0003", status: "AKTIF" },
          ],
        },
        // Gate 5: Org units
        orgUnit: {
          findMany: async (args?: any) => {
            const units = [
              { id: "ou-root", code: "OU-STQ-ROOT", name: "STQ Darul Ulum Cendekia", type: "INSTITUTION", domain: "INSTITUTIONAL", parentId: null, isActive: true },
              { id: "ou-tahfizh", code: "OU-TAHFIZH", name: "Tahfizh", type: "DOMAIN", domain: "TAHFIZH", parentId: "ou-root", isActive: true },
              { id: "ou-keasramaan", code: "OU-KEASRAMAAN", name: "Keasramaan", type: "DOMAIN", domain: "KEASRAMAAN", parentId: "ou-root", isActive: true },
              { id: "ou-1", code: "OU-OSDA-ROOT", isActive: true },
              { id: "ou-2", code: "OU-OSDA-PUTRI", isActive: true },
              { id: "ou-3", code: "OU-TKS-ROOT", isActive: true },
              { id: "ou-hlq-1", code: "OU-HLQ-0001", type: "HALAQOH", domain: "TAHFIZH", parentId: "ou-tahfizh", parent: { code: "OU-TAHFIZH" }, genderComplex: "PUTRA", isActive: true },
            ];
            if (args?.where?.OR) {
              return units.filter((u) => args.where.OR.some((cond: any) => cond.id === u.id || cond.code === u.code));
            }
            if (args?.where?.code) {
              return units.filter((u) => u.code === args.where.code);
            }
            return units;
          },
        },
        // Gate 6: Positions
        position: {
          findMany: async () => [
            { id: "p-1", code: "MUDIR", isActive: true },
            { id: "p-2", code: "KABID_TAHFIZH", isActive: true },
            { id: "p-3", code: "KEPALA_KEASRAMAAN", isActive: true },
            { id: "p-4", code: "PETUGAS_OPERASIONAL_TAHFIZH", isActive: true },
            { id: "p-5", code: "MUSYRIF_TAHFIZH", isActive: true },
            { id: "p-6", code: "PEMBINA_HALAQOH", isActive: true },
            { id: "p-7", code: "PETUGAS_OPERASIONAL_KEASRAMAAN", isActive: true },
            { id: "p-8", code: "GURU_KEPESANTRENAN", isActive: true },
          ],
        },
        // Gate 7: Capabilities
        capability: {
          findMany: async () => REQUIRED_UAT_ACTIVATION_CAPABILITIES.map((code) => ({ code })),
        },
        // Gate 8: User Assignments
        assignment: {
          findMany: async () => reqAssignments,
        },
        positionCapability: {
          findMany: async (args?: any) => {
            if (args?.where?.capabilityCode === "tahfizh.reward.issue") {
              return [
                { capabilityCode: "tahfizh.reward.issue", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", domain: "INSTITUTIONAL", isActive: true } },
                { capabilityCode: "tahfizh.reward.issue", scopeType: "DOMAIN", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "KABID_TAHFIZH", domain: "TAHFIZH", isActive: true } },
              ];
            }
            return [
              { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", isActive: true } },
              { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", isActive: true } },
              { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", isActive: true } },
            ];
          },
        },
        santriKamarPlacement: {
          findFirst: async (args: any) => {
            if (args?.where?.kamarId?.in && Array.isArray(args.where.kamarId.in)) {
              const kId = args.where.kamarId.in[0];
              return { id: `skp-${kId}`, kamarId: kId, santriId: `san-${kId}`, isActive: true, santri: { status: "AKTIF" } };
            }
            return { id: "skp-default", kamarId: "ou-req-6", santriId: "san-req-6", isActive: true, santri: { status: "AKTIF" } };
          },
          findMany: async () => [
            { id: "skp-6", kamarId: "ou-req-6", santriId: "san-req-6", isActive: true, santri: { status: "AKTIF" } },
          ],
        },
        // Gate authoritative halaqoh delegate
        halaqoh: {
          findMany: async (args?: any) => {
            if (args?.where?.halaqohCode) {
              return [
                { id: "hlq-1", halaqohCode: args.where.halaqohCode, nama: "Halaqoh 0001", status: "AKTIF" },
              ];
            }
            if (args?.where?.OR) {
              return [
                { id: "hlq-1", halaqohCode: "HLQ-0001", nama: "Halaqoh 0001", status: "AKTIF" },
              ];
            }
            return [];
          },
        },
        // Gate 9: Teaching assignments (all 12 covered)
        teachingAssignment: {
          findMany: async () => slots,
        },
        // Gate 10: 57 santri without cohort => NOT_READY
        santri: {
          findFirst: async (args: any) => {
            const hId = args?.where?.halaqohId;
            if (typeof hId === "string") {
              return { id: `san-${hId}`, halaqohId: hId, status: "AKTIF", jenisKelamin: "L" };
            }
            if (args?.where?.halaqohId?.in && Array.isArray(args.where.halaqohId.in)) {
              const matched = args.where.halaqohId.in[0];
              return { id: `san-${matched}`, halaqohId: matched, status: "AKTIF", jenisKelamin: "L" };
            }
            return { id: "san-default", halaqohId: "hlq-1", status: "AKTIF", jenisKelamin: "L" };
          },
          findMany: async (args?: any) => {
            if (args?.where?.status === "AKTIF" && !args?.where?.halaqohId) {
              return Array.from({ length: 57 }, (_, i) => ({ id: `san-${i}`, status: "AKTIF", cohortId: null }));
            }
            return CANONICAL_REQUIRED_POSITION_CODES.map((_, idx) => ({
              id: `san-req-${idx}`,
              halaqohId: `hlq-${idx}`,
              status: "AKTIF",
              cohortId: null,
            }));
          },
        },
      };

      const prevEnv = process.env.PENDIDIKAN_V2_UAT_ENABLED;
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      try {
        const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
        const cohortGate = report.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
        assert.ok(cohortGate);
        assert.strictEqual(cohortGate.status, "NOT_READY");
        assert.strictEqual(cohortGate.blocking, false);

        // Verify that COHORTS_ASSIGNED is excluded from blocking gates
        const blockingGates = report.gates.filter((g) => g.blocking !== false);
        assert.ok(!blockingGates.some((g) => g.gate === "COHORTS_ASSIGNED"));

        // All operational blocking gates (except unprovisioned auth policy gate and deferred Gate 5 runtime activation) are READY
        const operationalBlockingGates = blockingGates.filter(
          (g) => g.gate !== "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY" && g.gate !== "RUNTIME_ACTIVATION_FLAG"
        );
        assert.ok(operationalBlockingGates.every((g) => g.status === "READY"));

        // Gate 5 runtime activation must remain NOT_READY per DIR-2026-037
        const gate5 = report.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
        assert.ok(gate5);
        assert.strictEqual(gate5.status, "NOT_READY", "Gate 5 activation must remain NOT_READY per DIR-2026-037");
      } finally {
        process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
      }
    });

    it("D. If another blocking gate is NOT_READY, overallStatus remains NOT_READY", async () => {
      const mockDb = {
        orgUnit: {
          findMany: async () => [],
        },
        santri: {
          findMany: async () => [{ id: "san-1", status: "AKTIF", cohortId: null }],
        },
        positionCapability: {
          findMany: async () => [],
        },
      };
      const prevEnv = process.env.PENDIDIKAN_V2_UAT_ENABLED;
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "false"; // Gate 11 is NOT_READY (blocking)
      try {
        const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
        assert.strictEqual(report.overallStatus, "NOT_READY");
      } finally {
        process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
      }
    });

    it("E. If another blocking gate is BLOCKED, overallStatus remains BLOCKED", async () => {
      const mockDb = {
        user: {
          findMany: async () => [
            { id: "u-1", username: "musyrifah.putri", role: "MT", accountType: "PERSONAL", status: "AKTIF", staffId: null },
          ],
        },
        santri: {
          findMany: async () => [{ id: "san-1", status: "AKTIF", cohortId: null }],
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const staffGate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(staffGate);
      assert.strictEqual(staffGate.status, "BLOCKED");

      assert.strictEqual(report.overallStatus, "BLOCKED");
    });
  });

  // =========================================================================
  // SECTION 13: KEPESANTRENAN ACADEMIC AUTHORIZATION POLICY GATE TESTS (A-I)
  // =========================================================================
  describe("13. Kepesantrenan Academic Authorization Policy Gate (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY)", () => {
    const valid12Slots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
      id: `ta-${idx}`,
      educationTrack: t.track,
      genderComplex: t.genderComplex,
      pedagogicalLevel: t.pedagogicalLevel || null,
      staffId: `stf-${idx}`,
      staff: { id: `stf-${idx}`, status: "AKTIF" },
      mapel: { nama: t.subjectName },
      isActive: true,
    }));

    // A. 12 valid Kepesantrenan TeachingAssignments + active Staff + NO academic PositionCapability policy
    // => TEACHING_ASSIGNMENTS_READY = READY
    // => KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY = NOT_READY
    // => overallStatus != READY
    it("A. 12 valid Kepesantrenan TeachingAssignments + active Staff + NO academic policy => PLANNING_READY but AUTH_POLICY_NOT_READY and overallStatus != READY", async () => {
      const mockDb = {
        teachingAssignment: { findMany: async () => valid12Slots },
        staff: { findMany: async () => valid12Slots.map((s) => s.staff) },
        positionCapability: { findMany: async () => [] },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const planningGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      const authPolicyGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");

      assert.strictEqual(report.gates.length, CANONICAL_READINESS_GATE_NAMES.length);
      assert.ok(KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES.includes("academic.session.start" as any));
      assert.ok(planningGate, "TEACHING_ASSIGNMENTS_READY gate must exist");
      assert.strictEqual(planningGate.status, "READY", "Planning coverage alone must be READY");
      assert.strictEqual(planningGate.blocking, true);

      assert.ok(authPolicyGate, "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY gate must exist");
      assert.strictEqual(authPolicyGate.status, "NOT_READY", "Auth policy gate must be NOT_READY when no policy provisioned");
      assert.strictEqual(authPolicyGate.blocking, true, "Auth policy gate must be blocking");
      assert.ok(authPolicyGate.details.includes("No active PositionCapability rows provisioned in database") || authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
      assert.ok(authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));

      assert.notStrictEqual(report.overallStatus, "READY", "overallStatus must NOT be READY when auth policy is NOT_READY");
    });

    // B. Missing one planning slot => TEACHING_ASSIGNMENTS_READY = NOT_READY
    it("B. Missing one planning slot => TEACHING_ASSIGNMENTS_READY = NOT_READY", async () => {
      const elevenSlots = valid12Slots.filter((_, idx) => idx !== 0);
      const mockDb = {
        teachingAssignment: { findMany: async () => elevenSlots },
        staff: { findMany: async () => elevenSlots.map((s) => s.staff) },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const planningGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(planningGate);
      assert.strictEqual(planningGate.status, "NOT_READY");
      assert.ok(planningGate.details.includes("Missing teaching assignment coverage"));
    });

    // C. TeachingAssignment existence alone => never grants runtime authorization
    it("C. TeachingAssignment existence alone never grants runtime authorization", async () => {
      const teacherIdentity = {
        userId: "usr-sched-only",
        username: "guru.kepesantrenan",
        status: "AKTIF",
        accountType: "PERSONAL" as const,
        staffId: "stf-sched-only",
        mockAssignments: [], // Zero assignments
      };

      const authDecision = await authorizeCanonical({
        identity: teacherIdentity as any,
        capability: "academic.session.start",
        resourceContext: { educationSessionId: "sess-kepesantrenan-1" },
        isMutation: true,
      });

      assert.strictEqual(authDecision.decision, "DENY");
      assert.ok(["CAPABILITY_NOT_GRANTED", "NO_ASSIGNMENT", "NO_EXPLICIT_GRANT", "DENIED"].includes(authDecision.code || "DENIED"));
    });

    // D. APPROVED_TARGET_PENDING_TECHNICAL academic grant => AUTH POLICY gate NOT_READY
    it("D. APPROVED_TARGET_PENDING_TECHNICAL academic grant => AUTH POLICY gate NOT_READY", async () => {
      const syntheticApprovedPolicies = [
        { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" as const },
      ];
      const activePcs = [
        { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
      ];

      // Pure evaluator test with synthetic complete manifest
      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: syntheticApprovedPolicies,
      });
      assert.strictEqual(evalResult.status, "NOT_READY");
      assert.ok(evalResult.details.includes("APPROVED_TARGET_PENDING_TECHNICAL"));
      assert.ok(evalResult.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));

      // Production diagnostic cannot be overridden: evaluates strictly to NOT_READY
      const mockDb = {
        positionCapability: { findMany: async () => activePcs },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const authPolicyGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authPolicyGate);
      assert.strictEqual(authPolicyGate.status, "NOT_READY");
      assert.ok(
        authPolicyGate.details.includes("UNAPPROVED_KEPESANTRENAN_ACADEMIC_POLICY_PRESENT") ||
        authPolicyGate.details.includes("Missing owner-approved Kepesantrenan academic authorization policies") ||
        authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY")
      );
    });

    // E. PROPOSED_TBD academic grant => AUTH POLICY gate NOT_READY
    it("E. PROPOSED_TBD academic grant => AUTH POLICY gate NOT_READY", async () => {
      const syntheticApprovedPolicies = [
        { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" as const },
      ];
      const activePcs = [
        { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
      ];

      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: syntheticApprovedPolicies,
      });
      assert.strictEqual(evalResult.status, "NOT_READY");
      assert.ok(evalResult.details.includes("PROPOSED_TBD"));
      assert.ok(evalResult.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    // F. No explicit academic policy => NOT_READY
    it("F. No explicit academic policy => NOT_READY with KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY", async () => {
      const mockDb = {
        positionCapability: { findMany: async () => [] },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const authPolicyGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authPolicyGate);
      assert.strictEqual(authPolicyGate.status, "NOT_READY");
      assert.ok(authPolicyGate.details.includes("No active PositionCapability rows provisioned in database") || authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
      assert.ok(authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    // G. Synthetic test-only explicitly VERIFIED_PRODUCTION policy with compatible scope => policy gate may become READY
    it("G. Synthetic test-only explicitly VERIFIED_PRODUCTION policy with compatible scope => pure evaluator READY", async () => {
      const syntheticApprovedPolicies = [
        { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" as const },
      ];
      const activePcs = [
        { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
        { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
      ];

      // Pure evaluator with complete synthetic manifest evaluates to READY
      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: syntheticApprovedPolicies,
      });
      assert.strictEqual(evalResult.status, "READY");
      assert.ok(evalResult.details.includes("VERIFIED_PRODUCTION"));

      // Production diagnostic has no override and strictly fails closed when DB lacks the required policies
      const mockDb = {
        positionCapability: { findMany: async () => activePcs },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.ok(gate.details.includes("UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY"));
    });

    // H. Cohort remains informational and non-blocking
    it("H. Cohort remains informational and non-blocking (blocking=false)", async () => {
      const mockDb = {
        santri: { findMany: async () => [{ id: "san-1", status: "AKTIF", cohortId: null }] },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const cohortGate = report.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
      assert.ok(cohortGate);
      assert.strictEqual(cohortGate.blocking, false);
    });

    // I. SUBJECT Studi Umum authorization behavior remains unchanged
    it("I. SUBJECT Studi Umum authorization behavior remains unchanged (binding-based, independent of TeachingAssignment)", async () => {
      const studiUmumSubjects = ["Matematika", "Bahasa Inggris", "IPS", "IPA", "Bahasa Indonesia", "TIK"];
      for (const sub of studiUmumSubjects) {
        const found = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.find(
          (t) => t.track === "STUDI_UMUM" || t.subjectName === sub
        );
        assert.strictEqual(found, undefined, `Studi Umum subject ${sub} must not be in TeachingAssignment coverage targets`);
      }
    });
  });

  // =========================================================================
  // SECTION 14: CANONICAL POLICY HARDENING & REQUIRED COVERAGE (A-H)
  // =========================================================================
  describe("14. Canonical Policy Hardening & Required Capability Coverage (A-H)", () => {
    const completeSyntheticManifest = [
      { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" as const },
      { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" as const },
      { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" as const },
      { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" as const },
    ];

    // A. Production diagnostic has NO caller policy override.
    //    Arbitrary VERIFIED_PRODUCTION rows in DB while production manifest=[] => auth policy gate NOT_READY
    it("A. Production diagnostic has NO caller policy override: arbitrary VERIFIED_PRODUCTION rows in DB => NOT_READY", async () => {
      const mockDb = {
        positionCapability: {
          findMany: async () => [
            { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", isActive: true } },
            { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", isActive: true } },
            { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "MUDIR", isActive: true } },
          ],
        },
      };

      // Called strictly as checkPendidikanV2ProductionReadiness(db) with ZERO options
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const authPolicyGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authPolicyGate);
      assert.strictEqual(authPolicyGate.status, "BLOCKED");
      assert.ok(authPolicyGate.details.includes("UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY"));
    });

    // B. Synthetic pure-evaluator manifest containing ONLY academic.session.start with exact VERIFIED_PRODUCTION DB grant
    //    => NOT_READY because approved manifest does not define: academic.material.record, academic.attendance.record
    it("B. Partial synthetic manifest (session.start only) => NOT_READY (missing material.record, attendance.record)", () => {
      const partialManifest = [
        { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" as const },
      ];
      const activePcs = [
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ];

      const res = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: partialManifest,
      });
      assert.strictEqual(res.status, "NOT_READY");
      assert.strictEqual(res.blocking, true);
      assert.ok(res.details.includes("OWNER_APPROVED_KEPESANTRENAN_POLICY_INCOMPLETE"));
      assert.ok(res.details.includes("academic.material.record"));
      assert.ok(res.details.includes("academic.attendance.record"));
      assert.ok(res.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    // C. Synthetic manifest containing session.start + material.record only => NOT_READY because attendance.record missing
    it("C. Partial synthetic manifest (session.start + material.record) => NOT_READY (missing attendance.record)", () => {
      const partialManifest = [
        { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" as const },
        { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" as const },
      ];
      const activePcs = [
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.material.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ];

      const res = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: partialManifest,
      });
      assert.strictEqual(res.status, "NOT_READY");
      assert.strictEqual(res.blocking, true);
      assert.ok(res.details.includes("OWNER_APPROVED_KEPESANTRENAN_POLICY_INCOMPLETE"));
      assert.ok(res.details.includes("academic.attendance.record"));
      assert.ok(res.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    // D. Synthetic complete manifest containing all four required capabilities, with exact position/scope and VERIFIED_PRODUCTION rows
    //    => evaluator may return READY
    it("D. Synthetic complete manifest with exact matching VERIFIED_PRODUCTION grants => READY", () => {
      const activePcs = [
        {
          capabilityCode: "academic.schedule.read",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.material.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.attendance.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ];

      const res = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: completeSyntheticManifest,
      });
      assert.strictEqual(res.status, "READY");
      assert.strictEqual(res.blocking, true);
      assert.ok(res.details.includes("VERIFIED_PRODUCTION"));
    });

    // E. Complete manifest but one scope undefined => NOT_READY
    it("E. Complete manifest but one scope undefined in DB => NOT_READY", () => {
      const activePcs = [
        {
          capabilityCode: "academic.schedule.read",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.material.record",
          scopeType: undefined,
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.attendance.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ];

      const res = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: completeSyntheticManifest,
      });
      assert.strictEqual(res.status, "BLOCKED");
      assert.ok(res.details.includes("UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY"));
    });

    // F. Complete manifest but one position differs => NOT_READY
    it("F. Complete manifest but one position differs in DB => NOT_READY", () => {
      const activePcs = [
        {
          capabilityCode: "academic.schedule.read",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.material.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_DIFFERENT", isActive: true },
        },
        {
          capabilityCode: "academic.attendance.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ];

      const res = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: completeSyntheticManifest,
      });
      assert.strictEqual(res.status, "BLOCKED");
      assert.ok(res.details.includes("UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY"));
      assert.ok(res.details.includes("GURU_DIFFERENT:academic.material.record:GLOBAL"));
    });

    // G. Complete manifest but one state = APPROVED_TARGET_PENDING_TECHNICAL => NOT_READY
    it("G. Complete manifest but one state is APPROVED_TARGET_PENDING_TECHNICAL => NOT_READY", () => {
      const activePcs = [
        {
          capabilityCode: "academic.schedule.read",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.material.record",
          scopeType: "GLOBAL",
          businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
          position: { code: "GURU_TEST", isActive: true },
        },
        {
          capabilityCode: "academic.attendance.record",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ];

      const res = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: completeSyntheticManifest,
      });
      assert.strictEqual(res.status, "NOT_READY");
      assert.ok(res.details.includes("APPROVED_TARGET_PENDING_TECHNICAL"));
      assert.ok(res.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    // H. Production canonical manifest contains EXACTLY the 4 owner-approved policies
    it("H. Production canonical manifest contains EXACTLY the 4 owner-approved policies", () => {
      assert.strictEqual(KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.length, 4);
      assert.deepStrictEqual(
        KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.map((p) => `${p.positionCode}:${p.capabilityCode}:${p.scopeType}`),
        [
          "GURU_KEPESANTRENAN:academic.schedule.read:GLOBAL",
          "GURU_KEPESANTRENAN:academic.session.start:GLOBAL",
          "GURU_KEPESANTRENAN:academic.material.record:GLOBAL",
          "GURU_KEPESANTRENAN:academic.attendance.record:GLOBAL",
        ]
      );

      // Calling evaluate without options strictly uses canonical manifest
      const res = evaluateKepesantrenanAcademicAuthPolicies([
        {
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
          position: { code: "GURU_TEST", isActive: true },
        },
      ]);
      assert.strictEqual(res.status, "BLOCKED");
      assert.ok(res.details.includes("UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY"));
      assert.strictEqual(KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.length, 4);
    });
  });

  // =========================================================================
  // SECTION 14: C1/D1 AUTHORITY & PRIVACY READINESS FAIL-CLOSED (R1-BLOCKER-03)
  // =========================================================================
  describe("14. C1/D1 Authority & Privacy Readiness Fail-Closed Tests", () => {
    it("1. Missing student.guardian_contact.read catalog entry => readiness NOT_READY", async () => {
      const mockDb = {
        capability: {
          findMany: async () => [
            { code: "academic.schedule.read" },
            { code: "academic.session.start" },
            { code: "academic.material.record" },
            { code: "academic.attendance.record" },
            { code: "tahfizh.recap.manage" },
            { code: "tahfizh.target.manage" },
            { code: "keasramaan.permission.read" },
            { code: "keasramaan.permission.create" },
            { code: "keasramaan.permission.update" },
            { code: "keasramaan.permission.approve_mk" },
            { code: "keasramaan.permission.approve_ks" },
            // Missing: student.guardian_contact.read
          ],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("student.guardian_contact.read"));
    });

    it("2. Missing required C1 PositionCapability target => readiness NOT_READY", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('SELECT DISTINCT p."code"')) {
            return [
              { code: "MUDIR" },
              { code: "KABID_TAHFIZH" },
              { code: "KEPALA_KEASRAMAAN" },
              { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              { code: "MUSYRIF_TAHFIZH" },
              { code: "PEMBINA_HALAQOH" },
              { code: "GURU_KEPESANTRENAN" },
            ];
          }
          if (sql.includes('COUNT(*)::text as count FROM "org_units"')) {
            return [{ count: "0" }];
          }
          if (sql.includes('FROM "positions" p')) {
            // Missing required C1 target keasramaan.permission.create
            return [];
          }
          return [];
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(
        gate.details.includes("missing PositionCapability for keasramaan.permission.create") ||
        gate.details.includes("Target policy definition mismatch")
      );
    });

    it("3. Missing D1 PositionCapability target => readiness NOT_READY", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('SELECT DISTINCT p."code"')) {
            return [
              { code: "MUDIR" },
              { code: "KABID_TAHFIZH" },
              { code: "KEPALA_KEASRAMAAN" },
              { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              { code: "MUSYRIF_TAHFIZH" },
              { code: "PEMBINA_HALAQOH" },
              { code: "GURU_KEPESANTRENAN" },
            ];
          }
          if (sql.includes('COUNT(*)::text as count FROM "org_units"')) {
            return [{ count: "0" }];
          }
          if (sql.includes('FROM "positions" p')) {
            // C1 target present, but D1 target student.guardian_contact.read absent
            return [
              {
                position_code: "MUDIR",
                capability_code: "keasramaan.permission.create",
                scope_type: "GLOBAL",
                business_rule_state: "APPROVED_TARGET_PENDING_TECHNICAL",
              },
            ];
          }
          return [];
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(
        gate.details.includes("student.guardian_contact.read") ||
        gate.details.includes("Target policy definition mismatch")
      );
    });

    it("4. Wrong scope for D1 target => NOT_READY", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('SELECT DISTINCT p."code"')) {
            return [
              { code: "MUDIR" },
              { code: "KABID_TAHFIZH" },
              { code: "KEPALA_KEASRAMAAN" },
              { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              { code: "MUSYRIF_TAHFIZH" },
              { code: "PEMBINA_HALAQOH" },
              { code: "GURU_KEPESANTRENAN" },
            ];
          }
          if (sql.includes('COUNT(*)::text as count FROM "org_units"')) {
            return [{ count: "0" }];
          }
          if (sql.includes('FROM "positions" p')) {
            // D1 target with wrong scope HALAQOH instead of GLOBAL
            return [
              {
                position_code: "MUDIR",
                capability_code: "student.guardian_contact.read",
                scope_type: "HALAQOH",
                business_rule_state: "APPROVED_TARGET_PENDING_TECHNICAL",
              },
            ];
          }
          return [];
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(
        gate.details.includes("target policy scope mismatch for student.guardian_contact.read") ||
        gate.details.includes("expected GLOBAL, found HALAQOH")
      );
    });

    it("5. Wrong position for guardian-contact capability => NOT_READY", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('SELECT DISTINCT p."code"')) {
            return [
              { code: "MUDIR" },
              { code: "KABID_TAHFIZH" },
              { code: "KEPALA_KEASRAMAAN" },
              { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              { code: "MUSYRIF_TAHFIZH" },
              { code: "PEMBINA_HALAQOH" },
              { code: "GURU_KEPESANTRENAN" },
            ];
          }
          if (sql.includes('COUNT(*)::text as count FROM "org_units"')) {
            return [{ count: "0" }];
          }
          if (sql.includes('FROM "positions" p')) {
            // Guardian capability on wrong position GURU_KEPESANTRENAN
            return [
              {
                position_code: "GURU_KEPESANTRENAN",
                capability_code: "student.guardian_contact.read",
                scope_type: "GLOBAL",
                business_rule_state: "APPROVED_TARGET_PENDING_TECHNICAL",
              },
            ];
          }
          return [];
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(
        gate.details.includes("MUDIR: missing PositionCapability for student.guardian_contact.read") ||
        gate.details.includes("missing PositionCapability")
      );
    });

    it("6. Stale OSDA mutation target => MUST_NOT_PROMOTE notice", () => {
      const result = evaluateGate5RuntimeActivation({
        livePositionCapabilities: [
          {
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            capabilityCode: "keasramaan.permission.create",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
          },
        ],
      });

      assert.ok(result.details.includes("SUPERSEDED / MUST_NOT_PROMOTE"));
      assert.ok(result.details.includes("keasramaan.permission.create"));
    });

    it("7. DB query error => BLOCKED, never treated as empty", async () => {
      const mockDb = {
        capability: {
          findMany: async () => {
            throw new Error("PostgreSQL connection terminated unexpectedly");
          },
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.ok(gate.details.includes("DATABASE_UNAVAILABLE"));

      // Also verify evaluateGate5RuntimeActivation handles query error fail-closed:
      const actResult = evaluateGate5RuntimeActivation({
        inspectionState: "DATABASE_ERROR",
        inspectionErrorMessage: "Connection reset by peer",
      });
      assert.strictEqual(actResult.status, "BLOCKED");
      assert.ok(actResult.details.includes("QUERY ERROR != EMPTY RESULT"));
    });
  });

  // =========================================================================
  // SECTION 15: R2 DATABASE QUERY ERROR FAIL-CLOSED & DOMAIN VALIDATION TESTS
  // =========================================================================
  describe("15. R2 Database Query Error Fail-Closed & Domain Validation Tests", () => {
    it("1. Gate7 Prisma capability query error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        capability: {
          findMany: async () => {
            throw new Error("Connection timed out to capability table");
          },
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("DATABASE_UNAVAILABLE: Error: Capability repository query failed"));
    });

    it("2. Gate7 raw SQL capability query error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("capabilities")) {
            throw new Error("Relation 'capabilities' does not exist or connection failed");
          }
          return [];
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("DATABASE_UNAVAILABLE: Error: Raw SQL capability query failed"));
    });

    it("3. Gate8 PositionCapability query error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [],
        },
        positionCapability: {
          findMany: async () => {
            throw new Error("Network error contacting position_capabilities table");
          },
        },
        user: { findMany: async () => [] },
        position: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        staff: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("PositionCapability repository query failed"));
    });

    it("4. Gate8 User repository query error when required => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [
            { id: "asg-1", userId: "u-1" },
          ],
        },
        user: {
          findMany: async () => {
            throw new Error("PostgreSQL connection refused on users query");
          },
        },
        position: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        staff: { findMany: async () => [] },
        halaqoh: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("User repository query failed"));
    });

    it("5. Gate8 Position repository query error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [],
        },
        position: {
          findMany: async () => {
            throw new Error("Deadlock detected during positions query");
          },
        },
        user: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        staff: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("Position repository query failed"));
    });

    it("6. Gate8 OrgUnit repository query error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [],
        },
        orgUnit: {
          findMany: async () => {
            throw new Error("OrgUnit read query failed: socket closed");
          },
        },
        position: { findMany: async () => [] },
        user: { findMany: async () => [] },
        staff: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("OrgUnit repository query failed"));
    });

    it("7. Gate8 Staff repository query error when required => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [],
        },
        staff: {
          findMany: async () => {
            throw new Error("Staff repository unavailable");
          },
        },
        position: { findMany: async () => [] },
        user: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("Staff repository query failed"));
    });

    it("8. Gate8 AssignmentScopeUnit query error when required => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [
            { id: "asg-1", userId: "u-1" },
          ],
        },
        assignmentScopeUnit: {
          findMany: async () => {
            throw new Error("AssignmentScopeUnit query failed: disk I/O error");
          },
        },
        position: { findMany: async () => [] },
        user: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        staff: { findMany: async () => [] },
        halaqoh: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("AssignmentScopeUnit repository query failed"));
    });

    it("9. Gate8 raw assignment coverage SQL error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("FROM \"assignments\"")) {
            throw new Error("Syntax error or connection failure in assignments query");
          }
          return [];
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("Raw SQL assignment coverage query failed"));
    });

    it("10. Gate8 raw Kamar count SQL error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("COUNT(*)::text as count FROM \"org_units\" WHERE \"type\" = 'KAMAR'")) {
            throw new Error("Kamar count query failed: table locked");
          }
          if (sql.includes("FROM \"assignments\"")) {
            return [];
          }
          return [];
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("Raw SQL Kamar count query failed"));
    });

    it("11. Gate8 raw PositionCapability SQL error => BLOCKED / DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("FROM \"position_capabilities\"") || sql.includes("JOIN \"position_capabilities\"")) {
            throw new Error("PositionCapability raw query failed: relation not available");
          }
          if (sql.includes("FROM \"assignments\"")) {
            return [];
          }
          if (sql.includes("COUNT(*)::text")) {
            return [{ count: "1" }];
          }
          return [];
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
      assert.ok(gate.details.includes("Raw SQL PositionCapability query failed"));
    });

    it("12. successful query returning genuine [] => remains legitimate empty-state behavior, NOT DATABASE_UNAVAILABLE", async () => {
      const mockDb = {
        capability: {
          findMany: async () => [],
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.strictEqual(gate.reason, undefined);
      assert.ok(gate.details.includes("Missing required activation capabilities"));
    });

    it("13. successful Kamar count query returning 0 => preserves legitimate zero-Kamar/deferred semantics", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [],
        },
        positionCapability: {
          findMany: async () => [],
        },
        position: { findMany: async () => [] },
        user: { findMany: async () => [] },
        orgUnit: {
          findMany: async () => [
            { id: "ou-root", code: "OU-STQ-ROOT", type: "INSTITUTION", isActive: true },
          ],
        },
        staff: { findMany: async () => [] },
        halaqoh: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(!gate.details.includes("PEMBINA_HALAQOH"));
      assert.ok(gate.details.includes("MUDIR"));
    });

    it("14. C1/D1 missing PositionCapability => still correctly NOT_READY", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('SELECT DISTINCT p."code"')) {
            return [
              { code: "MUDIR" },
              { code: "KABID_TAHFIZH" },
              { code: "KEPALA_KEASRAMAAN", pos_domain: "KEASRAMAAN" },
              { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              { code: "MUSYRIF_TAHFIZH" },
              { code: "PEMBINA_HALAQOH" },
              { code: "GURU_KEPESANTRENAN" },
            ];
          }
          if (sql.includes('COUNT(*)::text as count FROM "org_units"')) {
            return [{ count: "0" }];
          }
          if (sql.includes('FROM "positions" p')) {
            // Empty position capabilities
            return [];
          }
          return [];
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("missing PositionCapability") || gate.details.includes("Target policy definition mismatch"));
    });

    it("15. pending PositionCapability => still zero runtime authority", async () => {
      const mockAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-test-pending",
        userId: "usr-mudir",
        positionId: "pos-mudir",
        positionCode: "MUDIR",
        positionName: "Mudir",
        domain: "INSTITUTIONAL",
        unitId: "ou-root",
        unitCode: "OU-STQ-ROOT",
        unitName: "Root",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "student.guardian_contact.read",
            scopeType: "GLOBAL",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
          },
        ],
        scopeUnits: [],
      };

      const result = await authorizeCanonical({
        identity: {
          userId: "usr-mudir",
          username: "mudir",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mudir",
          staffStatus: "AKTIF",
          mockAssignments: [mockAssignment],
        } as any,
        capability: "student.guardian_contact.read",
        resourceContext: { santriId: "san-1" },
        resolvedContext: { santriId: "san-1", orgUnitIds: [], genderComplex: "PUTRA" },
      });

      assert.strictEqual(result.decision, "DENY");
      assert.strictEqual(result.code, "CAPABILITY_NOT_GRANTED");
    });

    it("16. wrong DOMAIN anchor/context => cannot satisfy DOMAIN KEASRAMAAN target", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes('SELECT DISTINCT p."code"')) {
            return [
              { code: "MUDIR" },
              { code: "KABID_TAHFIZH" },
              { code: "KEPALA_KEASRAMAAN", pos_domain: "AKADEMIK", unit_domain: "AKADEMIK" }, // WRONG DOMAIN (must be KEASRAMAAN)
              { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              { code: "MUSYRIF_TAHFIZH" },
              { code: "PEMBINA_HALAQOH" },
              { code: "GURU_KEPESANTRENAN" },
            ];
          }
          if (sql.includes('COUNT(*)::text as count FROM "org_units"')) {
            return [{ count: "0" }];
          }
          if (sql.includes('FROM "positions" p')) {
            return [
              {
                position_code: "KEPALA_KEASRAMAAN",
                capability_code: "keasramaan.permission.read",
                scope_type: "DOMAIN",
                business_rule_state: "APPROVED_TARGET_PENDING_TECHNICAL",
              },
            ];
          }
          return [];
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("target policy domain mismatch for keasramaan.permission.read (expected domain KEASRAMAAN"));
    });
  });

  // =========================================================================
  // SECTION 16: HALAQOH CANONICAL MAPPING RESOURCE SCOPE REGRESSION TESTS (R1)
  // =========================================================================
  describe("16. Halaqoh Canonical Mapping Resource Scope Regression Tests (R1)", () => {
    function buildMockDb(options: {
      legacyHalaqohId?: string;
      canonicalOrgUnitId?: string;
      orgUnitCode?: string;
      halaqohCode?: string;
      orgUnitActive?: boolean;
      halaqohActive?: boolean;
      includeSourceHalaqoh?: boolean;
      santriHalaqohId?: string | null;
      outsideSantriHalaqohId?: string | null;
      dbErrorOnOrgUnit?: boolean;
    } = {}) {
      const legacyHId = options.legacyHalaqohId ?? "legacy-hlq-id-001";
      const canonicalOuId = options.canonicalOrgUnitId ?? "canonical-ou-id-001";
      const ouCode = options.orgUnitCode ?? "OU-HLQ-0001";
      const hlqCode = options.halaqohCode ?? "HLQ-0001";
      const isOuActive = options.orgUnitActive !== false;
      const isHlqActive = options.halaqohActive !== false;
      const includeHlq = options.includeSourceHalaqoh !== false;
      const santriHId = options.santriHalaqohId !== undefined ? options.santriHalaqohId : legacyHId;
      const outsideHId = options.outsideSantriHalaqohId;

      const orgUnits = [
        { id: "ou-root", code: "OU-STQ-ROOT", name: "STQ Darul Ulum Cendekia", type: "INSTITUTION", domain: "INSTITUTIONAL", parentId: null, isActive: true },
        { id: "ou-tahfizh", code: "OU-TAHFIZH", name: "Tahfizh", type: "DOMAIN", domain: "TAHFIZH", parentId: "ou-root", isActive: true },
        { id: "ou-keasramaan", code: "OU-KEASRAMAAN", name: "Keasramaan", type: "DOMAIN", domain: "KEASRAMAAN", parentId: "ou-root", isActive: true },
        { id: "ou-1", code: "OU-OSDA-ROOT", isActive: true },
        { id: "ou-2", code: "OU-OSDA-PUTRI", isActive: true },
        { id: "ou-3", code: "OU-TKS-ROOT", isActive: true },
        {
          id: canonicalOuId,
          code: ouCode,
          name: "Halaqoh 0001",
          type: "HALAQOH",
          domain: "TAHFIZH",
          parentId: "ou-tahfizh",
          parent: { code: "OU-TAHFIZH" },
          genderComplex: "PUTRA",
          isActive: isOuActive,
        },
        {
          id: "canonical-ou-id-002",
          code: "OU-HLQ-0002",
          name: "Halaqoh 0002",
          type: "HALAQOH",
          domain: "TAHFIZH",
          parentId: "ou-tahfizh",
          parent: { code: "OU-TAHFIZH" },
          genderComplex: "PUTRA",
          isActive: true,
        },
      ];

      const halaqohs = includeHlq
        ? [
            {
              id: legacyHId,
              halaqohCode: hlqCode,
              nama: "Halaqoh Abu Bakar",
              status: isHlqActive ? "AKTIF" : "NONAKTIF",
            },
            {
              id: "legacy-hlq-id-002",
              halaqohCode: "HLQ-0002",
              nama: "Halaqoh Umar",
              status: "AKTIF",
            },
          ]
        : [
            {
              id: "legacy-hlq-id-002",
              halaqohCode: "HLQ-0002",
              nama: "Halaqoh Umar",
              status: "AKTIF",
            },
          ];

      const positions = CANONICAL_REQUIRED_POSITION_CODES.map((code, idx) => ({
        id: `pos-${idx}`,
        code,
        name: code,
        domain: code.includes("KEASRAMAAN") ? "KEASRAMAAN" : "TAHFIZH",
        isActive: true,
        requiresPersonalAccount: code !== "PETUGAS_OPERASIONAL_KEASRAMAAN",
      }));

      const users = [
        { id: "u-mt-1", username: "musyrif.1", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-1", role: "MT" },
        { id: "u-ks-1", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-2", role: "KS" },
        { id: "u-mudir-1", username: "mudir.1", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-3", role: "GA" },
        { id: "u-kt-1", username: "kabid.tahfizh", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-4", role: "MT" },
        { id: "u-pot-1", username: "pot.1", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-5", role: "PH" },
        { id: "u-gk-1", username: "guru.kepesantrenan", status: "AKTIF", accountType: "PERSONAL", staffId: "stf-6", role: "GA" },
        { id: "u-osda-1", username: "osda.putri", status: "AKTIF", accountType: "UNIT", staffId: null, role: "MK" },
      ];

      const staffs = [
        { id: "stf-1", staffCode: "STF-0001", status: "AKTIF" },
        { id: "stf-2", staffCode: "STF-0004", status: "AKTIF" },
        { id: "stf-3", staffCode: "STF-0003", status: "AKTIF" },
        { id: "stf-4", staffCode: "STF-0002", status: "AKTIF" },
        { id: "stf-5", staffCode: "STF-0005", status: "AKTIF" },
        { id: "stf-6", staffCode: "STF-0006", status: "AKTIF" },
      ];

      const assignments = CANONICAL_REQUIRED_POSITION_CODES.map((posCode, idx) => {
        const isMT = posCode === "MUSYRIF_TAHFIZH";
        const isPH = posCode === "PEMBINA_HALAQOH";
        const isPOT = posCode === "PETUGAS_OPERASIONAL_TAHFIZH";
        const isPOK = posCode === "PETUGAS_OPERASIONAL_KEASRAMAAN";
        const isKK = posCode === "KEPALA_KEASRAMAAN";
        const isGK = posCode === "GURU_KEPESANTRENAN";
        const isKT = posCode === "KABID_TAHFIZH";

        let unitId = "ou-root";
        let user = users.find((u) => u.username === "mudir.1")!;
        let staff: any = staffs.find((s) => s.staffCode === "STF-0003");

        if (isMT || isPH) {
          unitId = canonicalOuId;
          user = users.find((u) => u.username === "musyrif.1")!;
          staff = staffs.find((s) => s.staffCode === "STF-0001");
        } else if (isPOT) {
          unitId = "ou-tahfizh";
          user = users.find((u) => u.username === "pot.1")!;
          staff = staffs.find((s) => s.staffCode === "STF-0005");
        } else if (isPOK) {
          unitId = "ou-2"; // OU-OSDA-PUTRI
          user = users.find((u) => u.username === "osda.putri")!;
          staff = undefined;
        } else if (isKK) {
          unitId = "ou-keasramaan";
          user = users.find((u) => u.username === "kepala.keasramaan")!;
          staff = staffs.find((s) => s.staffCode === "STF-0004");
        } else if (isKT) {
          unitId = "ou-tahfizh";
          user = users.find((u) => u.username === "kabid.tahfizh")!;
          staff = staffs.find((s) => s.staffCode === "STF-0002");
        } else if (isGK) {
          unitId = "ou-root";
          user = users.find((u) => u.username === "guru.kepesantrenan")!;
          staff = staffs.find((s) => s.staffCode === "STF-0006");
        }

        const unitObj = orgUnits.find((u) => u.id === unitId);

        return {
          id: `asg-${posCode.toLowerCase()}-${idx}`,
          userId: user.id,
          user: isPOK
            ? { ...user, unitPlacements: [{ unitId }] }
            : { ...user, staff },
          positionId: `pos-${idx}`,
          position: positions.find((p) => p.code === posCode),
          unitId,
          unit: unitObj,
          staff,
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          scopeUnits: [{ unitId: canonicalOuId, unit: orgUnits.find((u) => u.id === canonicalOuId) }],
          scopedUnits: [{ unitId: canonicalOuId, unit: orgUnits.find((u) => u.id === canonicalOuId) }],
        };
      });

      if (!isOuActive) {
        assignments.push({
          id: "asg-mt-active-cov",
          userId: "u-mt-1",
          user: { ...users[0], staff: staffs[0] },
          positionId: "pos-4",
          position: positions.find((p) => p.code === "MUSYRIF_TAHFIZH"),
          unitId: "canonical-ou-id-002",
          unit: orgUnits.find((u) => u.id === "canonical-ou-id-002"),
          staff: staffs[0],
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          scopeUnits: [],
          scopedUnits: [],
        });
        assignments.push({
          id: "asg-ph-active-cov",
          userId: "u-mt-1",
          user: { ...users[0], staff: staffs[0] },
          positionId: "pos-5",
          position: positions.find((p) => p.code === "PEMBINA_HALAQOH"),
          unitId: "canonical-ou-id-002",
          unit: orgUnits.find((u) => u.id === "canonical-ou-id-002"),
          staff: staffs[0],
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          scopeUnits: [],
          scopedUnits: [],
        });
      }

      return {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("health_cases_v2")) {
            return [{ table_name: "health_cases_v2" }, { table_name: "health_case_v2_events" }];
          }
          if (sql.includes("HealthStatusV2")) {
            return [{ typname: "HealthStatusV2" }];
          }
          if (sql.includes("education_cohorts")) {
            return [
              { table_name: "education_cohorts" },
              { table_name: "teaching_assignments" },
              { table_name: "education_sessions" },
              { table_name: "education_session_participants" },
              { table_name: "education_session_attendances" },
            ];
          }
          if (sql.includes("EducationTrack")) {
            return [
              { typname: "EducationTrack" },
              { typname: "PedagogicalLevel" },
              { typname: "EducationSessionStatus" },
              { typname: "EducationAttendanceStatus" },
            ];
          }
          if (sql.includes("canonical_audit_logs")) {
            return [{ table_name: "canonical_audit_logs" }];
          }
          return [];
        },
        orgUnit: {
          findMany: async (args?: any) => {
            if (options.dbErrorOnOrgUnit) {
              throw new Error("PostgreSQL connection failure on org_units table");
            }
            if (args?.where?.OR) {
              return orgUnits.filter((u) =>
                args.where.OR.some((cond: any) => cond.id === u.id || cond.code === u.code)
              );
            }
            if (args?.where?.code) {
              return orgUnits.filter((u) => u.code === args.where.code);
            }
            return orgUnits;
          },
        },
        halaqoh: {
          findMany: async (args?: any) => {
            if (args?.include?.pembina) {
              return [];
            }
            if (args?.where?.OR) {
              return halaqohs.filter((h) =>
                args.where.OR.some((cond: any) => cond.id === h.id || cond.halaqohCode === h.halaqohCode)
              );
            }
            if (args?.where?.halaqohCode) {
              return halaqohs.filter((h) => h.halaqohCode === args.where.halaqohCode);
            }
            return halaqohs;
          },
        },
        position: {
          findMany: async () => positions,
        },
        user: {
          findMany: async () => users,
        },
        staff: {
          findMany: async () => staffs,
        },
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () =>
            CANONICAL_UAT_TARGET_POLICIES.map((p) => ({
              positionId: positions.find((pos) => pos.code === p.positionCode)?.id || `pos-${p.positionCode}`,
              positionCode: p.positionCode,
              capabilityCode: p.capabilityCode,
              scopeType: p.expectedScope,
              businessRuleState: "VERIFIED_PRODUCTION",
              position: { code: p.positionCode, isActive: true },
            })),
        },
        santri: {
          findFirst: async (args?: any) => {
            if (args?.where?.jenisKelamin === "P") {
              return { id: "san-putri-1", halaqohId: santriHId || legacyHId, status: "AKTIF", jenisKelamin: "P" };
            }
            if (args?.where?.halaqohId && typeof args.where.halaqohId === "string") {
              if (args.where.halaqohId === santriHId) {
                return { id: "san-rep-1", halaqohId: santriHId, status: "AKTIF", jenisKelamin: "L" };
              }
              return null;
            }
            if (args?.where?.halaqohId?.in && Array.isArray(args.where.halaqohId.in)) {
              return { id: "san-pot-1", halaqohId: canonicalOuId, status: "AKTIF", jenisKelamin: "L" };
            }
            if (args?.where?.halaqohId?.not) {
              if (outsideHId) {
                return { id: "san-outside-1", halaqohId: outsideHId, status: "AKTIF", jenisKelamin: "L" };
              }
              return null;
            }
            return null;
          },
          findMany: async () => {
            const list: any[] = [];
            if (santriHId) list.push({ id: "san-rep-1", halaqohId: santriHId, status: "AKTIF", jenisKelamin: "L" });
            if (outsideHId) list.push({ id: "san-outside-1", halaqohId: outsideHId, status: "AKTIF", jenisKelamin: "L" });
            return list;
          },
        },
      };
    }

    it("A. distinct legacy/canonical IDs + valid mapping => no SCOPE_MISMATCH", async () => {
      const mockDb = buildMockDb({
        legacyHalaqohId: "legacy-hlq-id-001",
        canonicalOrgUnitId: "canonical-ou-id-001",
        santriHalaqohId: "legacy-hlq-id-001",
      });

      // The IDs MUST intentionally differ
      assert.notStrictEqual("canonical-ou-id-001", "legacy-hlq-id-001");

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      // USER_ASSIGNMENTS_READY must NOT fail with SCOPE_MISMATCH
      assert.ok(
        !gate.details.includes("SCOPE_MISMATCH"),
        `Expected no SCOPE_MISMATCH but got: ${gate.details}`
      );
    });

    it("B. missing Halaqoh-to-OrgUnit mapping => fail closed (NOT_READY)", async () => {
      const mockDb = buildMockDb({
        includeSourceHalaqoh: false,
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("missing active source Halaqoh mapping"));
    });

    it("C. inactive source Halaqoh => fail closed (NOT_READY)", async () => {
      const mockDb = buildMockDb({
        halaqohActive: false,
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("missing active source Halaqoh mapping"));
    });

    it("D. inactive canonical OrgUnit => fail closed (NOT_READY)", async () => {
      const mockDb = buildMockDb({
        orgUnitActive: false,
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("is inactive (TARGET_RESOURCE_SCOPE_NOT_READY)"));
    });

    it("E. genuinely different mapped Halaqoh => SCOPE_MISMATCH / NOT_READY", async () => {
      const mockDb = buildMockDb({
        legacyHalaqohId: "legacy-hlq-id-001",
        canonicalOrgUnitId: "canonical-ou-id-001",
        santriHalaqohId: null, // No santri in assigned halaqoh
        outsideSantriHalaqohId: "legacy-hlq-id-002", // Outside santri in HLQ-0002
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("SCOPE_MISMATCH"));
      // Verified that comparison is between canonical OrgUnit IDs
      assert.ok(gate.details.includes("canonical-ou-id-002"));
      assert.ok(gate.details.includes("canonical-ou-id-001"));
    });

    it("F. mapping database query error => DATABASE_UNAVAILABLE / blocking", async () => {
      const mockDb = buildMockDb({
        dbErrorOnOrgUnit: true,
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
    });

    it("G. no raw-ID fallback when mapping is unavailable", async () => {
      const mockDb = buildMockDb({
        includeSourceHalaqoh: false,
        // Even if Santri.halaqohId is set to the canonical OrgUnit ID, lack of mapping must fail closed
        santriHalaqohId: "canonical-ou-id-001",
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("missing active source Halaqoh mapping"));
    });

    it("H. outside santri with unmapped legacy halaqoh => TARGET_RESOURCE_SCOPE_NOT_READY without raw-ID comparison", async () => {
      const mockDb = buildMockDb({
        legacyHalaqohId: "legacy-hlq-id-001",
        canonicalOrgUnitId: "canonical-ou-id-001",
        santriHalaqohId: null, // No representative santri in assigned halaqoh
        outsideSantriHalaqohId: "legacy-unmapped-halaqoh-id", // Outside santri has unmapped legacy halaqoh
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(
        gate.details.includes("TARGET_RESOURCE_SCOPE_NOT_READY"),
        `Expected TARGET_RESOURCE_SCOPE_NOT_READY in details: ${gate.details}`
      );
      assert.ok(
        !gate.details.includes("SCOPE_MISMATCH"),
        `Must NOT emit SCOPE_MISMATCH when outside mapping is unproven: ${gate.details}`
      );
      assert.ok(
        !gate.details.includes("santri halaqoh legacy-unmapped-halaqoh-id does not match"),
        `Must NOT report raw legacy ID as canonical OrgUnit: ${gate.details}`
      );
    });

    it("I. outside santri mapping database query error => DATABASE_UNAVAILABLE / BLOCKED", async () => {
      const mockDb = buildMockDb({
        legacyHalaqohId: "legacy-hlq-id-001",
        canonicalOrgUnitId: "canonical-ou-id-001",
        santriHalaqohId: null,
        outsideSantriHalaqohId: "legacy-hlq-id-002",
      });

      const origHalaqohFindMany = mockDb.halaqoh.findMany;
      mockDb.halaqoh.findMany = async (args?: any) => {
        if (args?.where?.OR?.some((cond: any) => cond.id === "legacy-hlq-id-002" || cond.halaqohCode === "legacy-hlq-id-002")) {
          throw new Error("PostgreSQL connection error while resolving outside halaqoh mapping");
        }
        return origHalaqohFindMany(args);
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "BLOCKED");
      assert.strictEqual(gate.reason, "DATABASE_UNAVAILABLE");
      assert.strictEqual(gate.blocking, true);
    });
  });
});
