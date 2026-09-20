/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkPendidikanV2ProductionReadiness,
  CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS,
  CANONICAL_REQUIRED_POSITION_CODES,
  CANONICAL_UAT_TARGET_POLICIES,
  REQUIRED_UAT_ACTIVATION_CAPABILITIES,
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
          findMany: async () => [],
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

        // Overall status MUST ignore non-blocking cohort gate and evaluate to READY
        assert.strictEqual(report.overallStatus, "READY");
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
});
