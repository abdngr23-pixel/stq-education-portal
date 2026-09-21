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
} from "../lib/server/pendidikan-v2-readiness";
import { authorizeCanonical } from "../lib/auth/canonical-evaluator";

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
        return {
          id: `asg-req-${idx}`,
          userId: `u-1`,
          positionId: `pos-req-${idx}`,
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          unitId: `ou-req-${idx}`,
          scopeUnits: [{ unitId: `ou-req-${idx}` }],
          user: {
            id: `u-1`,
            username: `ust.ahmad`,
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: `stf-1`,
            staff: { id: `stf-1`, status: "AKTIF" },
          },
          position: {
            id: `pos-req-${idx}`,
            code: posCode,
            name: posCode,
            isActive: true,
            requiresPersonalAccount: true,
            domain: "AKADEMIK",
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
          ],
        },
        staff: {
          findMany: async () => [{ id: "stf-1", status: "AKTIF" }],
        },
        // Gate 5: Org units
        orgUnit: {
          findMany: async () => [
            { id: "ou-1", code: "OU-OSDA-ROOT", isActive: true },
            { id: "ou-2", code: "OU-OSDA-PUTRI", isActive: true },
            { id: "ou-3", code: "OU-TKS-ROOT", isActive: true },
          ],
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
              return [];
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
        // Gate 9: Teaching assignments (all 12 covered)
        teachingAssignment: {
          findMany: async () => slots,
        },
        // Gate 10: 57 santri without cohort => NOT_READY
        santri: {
          findFirst: async (args: any) => {
            const hId = args?.where?.halaqohId;
            if (typeof hId === "string") {
              return { id: `san-${hId}`, halaqohId: hId, status: "AKTIF" };
            }
            if (args?.where?.halaqohId?.in && Array.isArray(args.where.halaqohId.in)) {
              const matched = args.where.halaqohId.in[0];
              return { id: `san-${matched}`, halaqohId: matched, status: "AKTIF" };
            }
            return { id: "san-default", halaqohId: "ou-req-3", status: "AKTIF" };
          },
          findMany: async (args?: any) => {
            if (args?.where?.status === "AKTIF" && !args?.where?.halaqohId) {
              return Array.from({ length: 57 }, (_, i) => ({ id: `san-${i}`, status: "AKTIF", cohortId: null }));
            }
            return CANONICAL_REQUIRED_POSITION_CODES.map((_, idx) => ({
              id: `san-req-${idx}`,
              halaqohId: `ou-req-${idx}`,
              status: "AKTIF",
              cohortId: null,
            }));
          },
        },
      };

      const prevEnv = process.env.PENDIDIKAN_V2_UAT_ENABLED;
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true"; // Gate 11 is READY
      try {
        const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
        const cohortGate = report.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
        assert.ok(cohortGate);
        assert.strictEqual(cohortGate.status, "NOT_READY");
        assert.strictEqual(cohortGate.blocking, false);

        // Verify that COHORTS_ASSIGNED is excluded from blocking gates
        const blockingGates = report.gates.filter((g) => g.blocking !== false);
        assert.ok(!blockingGates.some((g) => g.gate === "COHORTS_ASSIGNED"));

        // All operational blocking gates (except unprovisioned auth policy gate) are READY
        const operationalBlockingGates = blockingGates.filter(
          (g) => g.gate !== "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY"
        );
        assert.ok(operationalBlockingGates.every((g) => g.status === "READY"));
      } finally {
        process.env.PENDIDIKAN_V2_UAT_ENABLED = prevEnv;
      }
    });

    it("D. If another blocking gate is NOT_READY, overallStatus remains NOT_READY", async () => {
      const mockDb = {
        santri: {
          findMany: async () => [{ id: "san-1", status: "AKTIF", cohortId: null }],
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
      assert.ok(authPolicyGate.details.includes("Missing owner-approved Kepesantrenan academic authorization policies") || authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
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
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("Missing owner-approved Kepesantrenan academic authorization policies"));
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
      assert.strictEqual(authPolicyGate.status, "NOT_READY");
      assert.ok(authPolicyGate.details.includes("Missing owner-approved Kepesantrenan academic authorization policies"));
      assert.ok(authPolicyGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
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
      assert.strictEqual(res.status, "NOT_READY");
      assert.ok(res.details.includes("invalid/undefined scopeType"));
      assert.ok(res.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
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
      assert.strictEqual(res.status, "NOT_READY");
      assert.ok(res.details.includes("Missing owner-approved Kepesantrenan academic authorization policies"));
      assert.ok(res.details.includes("GURU_TEST:academic.material.record:GLOBAL"));
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
      assert.strictEqual(res.status, "NOT_READY");
      assert.ok(res.details.includes("Missing owner-approved Kepesantrenan academic authorization policies"));
      assert.strictEqual(KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.length, 4);
    });
  });
});
