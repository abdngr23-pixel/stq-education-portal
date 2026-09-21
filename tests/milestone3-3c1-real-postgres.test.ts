/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import {
  checkPendidikanV2ProductionReadiness,
  evaluateKepesantrenanAcademicAuthPolicies,
  CANONICAL_READINESS_GATE_NAMES,
  CANONICAL_REQUIRED_POSITION_CODES,
  CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS,
  REQUIRED_UAT_ACTIVATION_CAPABILITIES,
  EDUCATION_SESSION_ACTIVATION_CAPABILITIES,
  APPROVED_UAT_TARGET_CAPABILITY_CODES,
  REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES,
  REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES,
  CANONICAL_UAT_TARGET_POLICIES,
} from "../lib/server/pendidikan-v2-readiness";
import { PendidikanV2Service } from "../lib/server/pendidikan-v2-service";
import {
  createPrismaDataProvider,
  authorizeCanonical,
} from "../lib/auth/canonical-evaluator";
import {
  matchStudiUmumSession,
  matchKepesantrenanSession,
} from "../lib/pendidikan-v2";
import { UAT_ACTIVATION_TARGETS } from "../types/architecture-lock";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3.3C1: REAL POSTGRESQL ROUND 2 PROOF", () => {
  let prisma: PrismaClient;
  let service: PendidikanV2Service;
  let dataProvider: any;

  before(async () => {
    // Start isolated PostgreSQL with complete prisma/schema.prisma pushed
    prisma = await startTestDatabase();
    dataProvider = createPrismaDataProvider(prisma);
    service = new PendidikanV2Service({ db: prisma, dataProvider });
  });

  after(async () => {
    await stopTestDatabase();
  });

  // =========================================================================
  // 1. REAL POSTGRESQL CATALOG & ENUM DETECTION
  // =========================================================================
  describe("1. Real PostgreSQL Catalog & Enum Verification", () => {
    it("1.1 Detects actual M3.3A tables (health_cases_v2, health_case_v2_events) and enum (HealthStatusV2)", async () => {
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema IN ('public', CURRENT_SCHEMA)
          AND table_name IN ('health_cases_v2', 'health_case_v2_events');
      `);
      const tableNames = tables.map((t) => t.table_name);
      assert.ok(tableNames.includes("health_cases_v2"), "health_cases_v2 table must exist");
      assert.ok(tableNames.includes("health_case_v2_events"), "health_case_v2_events table must exist");

      const enums = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(`
        SELECT typname FROM pg_type WHERE typname = 'HealthStatusV2';
      `);
      assert.strictEqual(enums.length, 1, "HealthStatusV2 enum must exist in PostgreSQL catalog");
    });

    it("1.2 Detects actual M3.3B tables and enums", async () => {
      const expectedTables = [
        "education_cohorts",
        "teaching_assignments",
        "education_sessions",
        "education_session_participants",
        "education_session_attendances",
      ];
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema IN ('public', CURRENT_SCHEMA)
          AND table_name = ANY($1::text[]);
      `, expectedTables);
      const foundNames = new Set(tables.map((t) => t.table_name));
      for (const t of expectedTables) {
        assert.ok(foundNames.has(t), `Table ${t} must exist in isolated PostgreSQL`);
      }

      const expectedEnums = [
        "EducationTrack",
        "PedagogicalLevel",
        "EducationSessionStatus",
        "EducationAttendanceStatus",
      ];
      const enums = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(`
        SELECT typname FROM pg_type WHERE typname = ANY($1::text[]);
      `, expectedEnums);
      const foundEnums = new Set(enums.map((e) => e.typname));
      for (const e of expectedEnums) {
        assert.ok(foundEnums.has(e), `Enum ${e} must exist in isolated PostgreSQL`);
      }
    });

    it("1.3 Real enum values: MASBUK is rejected by PostgreSQL EducationAttendanceStatus enum", async () => {
      const enumValues = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'EducationAttendanceStatus';
      `);
      const labels = enumValues.map((v) => v.enumlabel);
      assert.ok(labels.includes("HADIR"));
      assert.ok(labels.includes("IZIN"));
      assert.ok(labels.includes("SAKIT"));
      assert.ok(labels.includes("ALFA"));
      assert.ok(!labels.includes("MASBUK"), "MASBUK must NEVER exist in EducationAttendanceStatus enum");
    });

    it("1.4 service.checkSchemaReadiness confirms ready=true on real PostgreSQL", async () => {
      const readiness = await service.checkSchemaReadiness();
      assert.strictEqual(readiness.ready, true);
    });
  });

  // =========================================================================
  // 2. PRODUCTION READINESS GATES ON REAL POSTGRESQL (FAIL-CLOSED STAFF LINKAGE)
  // =========================================================================
  describe("2. Production Readiness Gates & Strict Staff Linkage", () => {
    it("2.1 Zero active Staff reports NOT_READY/BLOCKED with BLOCKED_IDENTITY_LINKAGE", async () => {
      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const staffGate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(staffGate, "STAFF_LINKAGE_READY gate must be present");
      assert.ok(["BLOCKED", "NOT_READY"].includes(staffGate.status));
      assert.ok(staffGate.remediationAdvice?.includes("BLOCKED_IDENTITY_LINKAGE"));
    });

    it("2.2 Missing/inactive Staff linkage reports BLOCKED with unlinked accounts", async () => {
      // Seed operational user without staffId
      await prisma.user.create({
        data: {
          id: "usr-razan-unlinked",
          username: "razan.mt",
          role: "MT",
          passwordHash: "dummy",
          status: "AKTIF",
        },
      });

      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const staffGate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(staffGate);
      assert.strictEqual(staffGate.status, "BLOCKED");
      assert.ok(staffGate.details.includes("razan.mt"));
      assert.ok(report.unlinkedStaffAccounts.includes("razan.mt"));
      assert.ok(staffGate.remediationAdvice?.includes("BLOCKED_IDENTITY_LINKAGE"));
    });

    it("2.3 checkPendidikanV2ProductionReadiness gates exactly equal CANONICAL_READINESS_GATE_NAMES", async () => {
      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const gateNames = report.gates.map((g) => g.gate);
      assert.deepStrictEqual(gateNames, Array.from(CANONICAL_READINESS_GATE_NAMES));
      assert.strictEqual(gateNames.length, 13);
    });

    it("2.4 Required positions gate: missing target positions => NOT_READY, PEMBINA_ASRAMA not required", async () => {
      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const posGate = report.gates.find((g) => g.gate === "REQUIRED_POSITIONS_READY");
      assert.ok(posGate);
      assert.strictEqual(posGate.status, "NOT_READY");
      assert.ok(posGate.details.includes("MUDIR"));
      // Assert PEMBINA_ASRAMA is NOT required
      assert.ok(!CANONICAL_REQUIRED_POSITION_CODES.includes("PEMBINA_ASRAMA" as any));
      assert.ok(!posGate.details.includes("PEMBINA_ASRAMA"), "PEMBINA_ASRAMA must not be in missing required positions");
    });

    it("2.5 TeachingAssignment readiness: one assignment only => NOT_READY, complete fixture coverage => READY", async () => {
      // 1. Partial: only one assignment
      const partialMockDb = {
        teachingAssignment: {
          findMany: async () => [
            {
              id: "ta-mat-1",
              mapel: { nama: "Matematika" },
              staffId: "stf-1",
              educationTrack: "STUDI_UMUM",
              genderComplex: "CAMPUR",
              isActive: true,
              validUntil: null,
            },
          ],
        },
      };
      const partialReport = await checkPendidikanV2ProductionReadiness(partialMockDb as any);
      const partialGate = partialReport.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(partialGate);
      assert.strictEqual(partialGate.status, "NOT_READY");
      assert.ok(partialGate.details.includes("Missing teaching assignment coverage"));

      // 2. Complete coverage: all 18 canonical slots with full relational authorization chain
      const createMockSlotAssignments = (opts?: {
        staffStatus?: string | null;
        hasStaff?: boolean;
        hasUser?: boolean;
        userStatus?: string;
        accountType?: string;
        hasAssignment?: boolean;
        assignmentStatus?: string;
        positionActive?: boolean;
        businessRuleState?: "PROPOSED_TBD" | "APPROVED_TARGET_PENDING_TECHNICAL" | "VERIFIED_PRODUCTION";
        grantCapabilities?: string[];
        overrideSlot?: { index: number; patch: (base: any) => any };
      }) => {
        const staffStatus = opts?.staffStatus ?? "AKTIF";
        const hasStaff = opts?.hasStaff ?? true;
        const hasUser = opts?.hasUser ?? true;
        const userStatus = opts?.userStatus ?? "AKTIF";
        const accountType = opts?.accountType ?? "PERSONAL";
        const hasAssignment = opts?.hasAssignment ?? true;
        const assignmentStatus = opts?.assignmentStatus ?? "ACTIVE";
        const positionActive = opts?.positionActive ?? true;
        const businessRuleState = opts?.businessRuleState ?? "VERIFIED_PRODUCTION";
        const grantCapabilities = opts?.grantCapabilities ?? [
          "academic.schedule.read",
          "academic.session.start",
          "academic.material.record",
          "academic.attendance.record",
        ];

        return CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => {
          const base = {
            id: `ta-slot-${idx}`,
            mapel: { nama: t.subjectName },
            staffId: hasStaff ? `stf-${idx}` : null,
            educationTrack: t.track,
            genderComplex: t.genderComplex || "CAMPUR",
            pedagogicalLevel: t.pedagogicalLevel || null,
            isActive: true,
            validUntil: null,
            educationSessions: [
              {
                id: `sess-slot-${idx}`,
                educationTrack: t.track,
                subjectId: `mp-${idx}`,
                genderGroup: t.genderComplex || "CAMPUR",
                programLevel: idx % 3 + 1,
                scheduledStaffId: hasStaff ? `stf-${idx}` : null,
                scheduledTeacherAssignmentId: `ta-slot-${idx}`,
              },
            ],
            staff: hasStaff
              ? {
                  id: `stf-${idx}`,
                  status: staffStatus,
                  users: hasUser
                    ? [
                        {
                          id: `usr-${idx}`,
                          status: userStatus,
                          accountType: accountType,
                          assignments: hasAssignment
                            ? [
                                {
                                  id: `asg-${idx}`,
                                  status: assignmentStatus,
                                  validFrom: new Date(Date.now() - 86400000),
                                  validUntil: null,
                                  unit: { id: "ou-1", isActive: true },
                                  position: {
                                    id: `pos-${idx}`,
                                    isActive: positionActive,
                                    capabilities: grantCapabilities.map((capCode) => ({
                                      capabilityCode: capCode,
                                      scopeType: "GLOBAL",
                                      businessRuleState,
                                      capability: { code: capCode, isBlocked: false },
                                    })),
                                  },
                                },
                              ]
                            : [],
                        },
                      ]
                    : [],
                }
              : null,
          };

          if (opts?.overrideSlot && opts.overrideSlot.index === idx) {
            return opts.overrideSlot.patch(base);
          }
          return base;
        });
      };

      const fullMockDb = {
        teachingAssignment: {
          findMany: async () => createMockSlotAssignments(),
        },
      };
      const fullReport = await checkPendidikanV2ProductionReadiness(fullMockDb as any);
      const fullGate = fullReport.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(fullGate);
      assert.strictEqual(fullGate.status, "READY");
      assert.ok(fullGate.details.includes("All 12 required teaching assignment slots covered with verified planning metadata"));
    });

    it("2.6 Cohort readiness: inactive historical santri with no cohort does NOT block; active santri without cohort DOES block", async () => {
      // 1. Active santri without cohort blocks with COHORT_NOT_ASSIGNED
      const blockedMockDb = {
        santri: {
          findMany: async () => [
            { id: "san-1", nis: "S001", nama: "Santri Aktif", status: "AKTIF", cohortId: null },
          ],
        },
      };
      const blockedReport = await checkPendidikanV2ProductionReadiness(blockedMockDb as any);
      const blockedGate = blockedReport.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
      assert.ok(blockedGate);
      assert.strictEqual(blockedGate.status, "NOT_READY");
      assert.ok(blockedGate.details.includes("COHORT_NOT_ASSIGNED"));

      // 2. Inactive/alumni santri (LULUS, MUTASI, KELUAR) without cohort does NOT block if active santri has cohort
      const readyMockDb = {
        santri: {
          findMany: async (args?: any) => {
            const all = [
              { id: "san-1", nis: "S001", nama: "Santri Aktif", status: "AKTIF", cohortId: "coh-1" },
              { id: "san-2", nis: "S002", nama: "Alumni Lulus", status: "LULUS", cohortId: null },
              { id: "san-3", nis: "S003", nama: "Santri Mutasi", status: "MUTASI", cohortId: null },
            ];
            if (args?.where?.status === "AKTIF") {
              return all.filter((s) => s.status === "AKTIF");
            }
            return all;
          },
        },
      };
      const readyReport = await checkPendidikanV2ProductionReadiness(readyMockDb as any);
      const readyGate = readyReport.gates.find((g) => g.gate === "COHORTS_ASSIGNED");
      assert.ok(readyGate);
      assert.strictEqual(readyGate.status, "READY");
      assert.ok(readyGate.details.includes("All 1 active santri have explicit cohort assigned"));
    });

    // -------------------------------------------------------------------------
    // SECTION 9 PROOFS: M3.3C1 FINAL AUTHORIZATION-READINESS SURGICAL FIX
    // -------------------------------------------------------------------------
    it("2.7 Proof 1: Required capability missing => CAPABILITIES_REGISTERED NOT_READY", async () => {
      // 8 of 9 capabilities present, missing academic.session.start
      const incompleteCaps = REQUIRED_UAT_ACTIVATION_CAPABILITIES.filter((c) => c !== "academic.session.start");
      const mockDb = {
        capability: {
          findMany: async () => incompleteCaps.map((c) => ({ code: c })),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const capGate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(capGate);
      assert.strictEqual(capGate.status, "NOT_READY");
      assert.ok(capGate.details.includes("academic.session.start"));
    });

    it("2.8 Proof 2: Deferred unrelated academic capability missing (e.g. academic.score.input) => must NOT block C1 live-UAT capability registration gate", async () => {
      // Exactly the 8 required capabilities; deferred capabilities (score.input, rapor.print, etc.) are absent
      const mockDb = {
        capability: {
          findMany: async () => REQUIRED_UAT_ACTIVATION_CAPABILITIES.map((c) => ({ code: c })),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const capGate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(capGate);
      assert.strictEqual(capGate.status, "READY");
      assert.ok(capGate.details.includes("All 8 required activation capabilities registered"));
    });

    it("2.9 Proof 3: All required activation capability rows present => registration gate READY", async () => {
      // Programmatic verification of capability subsets derived from UAT_ACTIVATION_TARGETS
      assert.strictEqual(EDUCATION_SESSION_ACTIVATION_CAPABILITIES.length, 4);
      assert.strictEqual(APPROVED_UAT_TARGET_CAPABILITY_CODES.length, 4);
      assert.strictEqual(REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES.length, 3);
      assert.strictEqual(REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES.length, 4);
      assert.strictEqual(REQUIRED_UAT_ACTIVATION_CAPABILITIES.length, 8);

      const mockDb = {
        capability: {
          findMany: async () => [
            ...REQUIRED_UAT_ACTIVATION_CAPABILITIES.map((c) => ({ code: c })),
            { code: "unrelated.capability.extra" },
          ],
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const capGate = report.gates.find((g) => g.gate === "CAPABILITIES_REGISTERED");
      assert.ok(capGate);
      assert.strictEqual(capGate.status, "READY");
    });

    it("2.10 Proof 4: TeachingAssignment with inactive Staff => TEACHING_ASSIGNMENTS_READY NOT_READY", async () => {
      // Helper function from test 2.5 scope
      const createSlotsWithInactiveStaff = () =>
        CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
          id: `ta-slot-${idx}`,
          mapel: { nama: t.subjectName },
          staffId: `stf-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex || "CAMPUR",
          pedagogicalLevel: t.pedagogicalLevel || null,
          isActive: true,
          validUntil: null,
          staff: {
            id: `stf-${idx}`,
            // First slot has inactive staff
            status: idx === 0 ? "NON_AKTIF" : "AKTIF",
            users: [
              {
                id: `usr-${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                assignments: [
                  {
                    id: `asg-${idx}`,
                    status: "ACTIVE",
                    validFrom: new Date(Date.now() - 86400000),
                    validUntil: null,
                    unit: { id: "ou-1", isActive: true },
                    position: {
                      id: `pos-${idx}`,
                      isActive: true,
                      capabilities: [
                        "academic.schedule.read",
                        "academic.session.start",
                        "academic.material.record",
                        "academic.attendance.record",
                      ].map((capCode) => ({
                        capabilityCode: capCode,
                        businessRuleState: "VERIFIED_PRODUCTION",
                        capability: { code: capCode, isBlocked: false },
                      })),
                    },
                  },
                ],
              },
            ],
          },
        }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => createSlotsWithInactiveStaff(),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("inactive or missing Staff"));
    });

    it("2.11 Proof 5: Active scheduled Staff with valid planning slots => PLANNING_READY, but unprovisioned academic PositionCapability => AUTH_POLICY_NOT_READY", async () => {
      const createSlotsWithoutAssignment = () =>
        CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
          id: `ta-slot-${idx}`,
          mapel: { nama: t.subjectName },
          staffId: `stf-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex || "CAMPUR",
          pedagogicalLevel: t.pedagogicalLevel || null,
          isActive: true,
          validUntil: null,
          staff: {
            id: `stf-${idx}`,
            status: "AKTIF",
            users: [
              {
                id: `usr-${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                assignments: [], // NO active assignments
              },
            ],
          },
        }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => createSlotsWithoutAssignment(),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const planningGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(planningGate);
      assert.strictEqual(planningGate.status, "READY"); // PLANNING_READY
      assert.ok(planningGate.details.includes("All 12 required teaching assignment slots covered"));

      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY"); // AUTH_POLICY_NOT_READY
      assert.ok(authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    it("2.12 Proof 6: Valid planning slots => PLANNING_READY, but PositionCapability PROPOSED_TBD => AUTH_POLICY_NOT_READY", async () => {
      const createSlotsWithProposedTbd = () =>
        CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
          id: `ta-slot-${idx}`,
          mapel: { nama: t.subjectName },
          staffId: `stf-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex || "CAMPUR",
          pedagogicalLevel: t.pedagogicalLevel || null,
          isActive: true,
          validUntil: null,
          educationSessions: [
            {
              id: `sess-tbd-${idx}`,
              educationTrack: t.track,
              subjectId: `mp-${idx}`,
              genderGroup: t.genderComplex || "CAMPUR",
              scheduledStaffId: `stf-${idx}`,
              scheduledTeacherAssignmentId: `ta-slot-${idx}`,
            },
          ],
          staff: {
            id: `stf-${idx}`,
            status: "AKTIF",
            users: [
              {
                id: `usr-${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                assignments: [
                  {
                    id: `asg-${idx}`,
                    status: "ACTIVE",
                    validFrom: new Date(Date.now() - 86400000),
                    validUntil: null,
                    unit: { id: "ou-1", isActive: true },
                    position: {
                      id: `pos-${idx}`,
                      code: "GURU_KEPESANTRENAN",
                      isActive: true,
                      capabilities: [
                        "academic.schedule.read",
                        "academic.session.start",
                        "academic.material.record",
                        "academic.attendance.record",
                      ].map((capCode) => ({
                        capabilityCode: capCode,
                        scopeType: "GLOBAL",
                        businessRuleState: "PROPOSED_TBD", // PROPOSED_TBD => NOT READY
                        capability: { code: capCode, isBlocked: false },
                      })),
                    },
                  },
                ],
              },
            ],
          },
        }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => createSlotsWithProposedTbd(),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const planningGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(planningGate);
      assert.strictEqual(planningGate.status, "READY"); // PLANNING_READY
      assert.ok(planningGate.details.includes("All 12 required teaching assignment slots covered"));

      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY"); // AUTH_POLICY_NOT_READY
      assert.ok(authGate.details.includes("PROPOSED_TBD"));
      assert.ok(authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));

      // Pure evaluator proves PROPOSED_TBD causes NOT_READY with PROPOSED_TBD
      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(
        [
          { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "PROPOSED_TBD", position: { code: "GURU_TEST", isActive: true } },
        ],
        {
          approvedPolicies: [
            { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" },
          ],
        }
      );
      assert.strictEqual(evalResult.status, "NOT_READY");
      assert.ok(evalResult.details.includes("PROPOSED_TBD"));
    });

    it("2.13 Proof 7: Valid planning slots => PLANNING_READY, but PositionCapability APPROVED_TARGET_PENDING_TECHNICAL => AUTH_POLICY_NOT_READY", async () => {
      const createSlotsWithPendingTechnical = () =>
        CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
          id: `ta-slot-${idx}`,
          mapel: { nama: t.subjectName },
          staffId: `stf-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex || "CAMPUR",
          pedagogicalLevel: t.pedagogicalLevel || null,
          isActive: true,
          validUntil: null,
          educationSessions: [
            {
              id: `sess-pending-${idx}`,
              educationTrack: t.track,
              subjectId: `mp-${idx}`,
              genderGroup: t.genderComplex || "CAMPUR",
              scheduledStaffId: `stf-${idx}`,
              scheduledTeacherAssignmentId: `ta-slot-${idx}`,
            },
          ],
          staff: {
            id: `stf-${idx}`,
            status: "AKTIF",
            users: [
              {
                id: `usr-${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                assignments: [
                  {
                    id: `asg-${idx}`,
                    status: "ACTIVE",
                    validFrom: new Date(Date.now() - 86400000),
                    validUntil: null,
                    unit: { id: "ou-1", isActive: true },
                    position: {
                      id: `pos-${idx}`,
                      code: "GURU_KEPESANTRENAN",
                      isActive: true,
                      capabilities: [
                        "academic.schedule.read",
                        "academic.session.start",
                        "academic.material.record",
                        "academic.attendance.record",
                      ].map((capCode) => ({
                        capabilityCode: capCode,
                        scopeType: "GLOBAL",
                        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", // Policy approved but NOT runtime authoritative
                        capability: { code: capCode, isBlocked: false },
                      })),
                    },
                  },
                ],
              },
            ],
          },
        }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => createSlotsWithPendingTechnical(),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const planningGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(planningGate);
      assert.strictEqual(planningGate.status, "READY"); // PLANNING_READY
      assert.ok(planningGate.details.includes("All 12 required teaching assignment slots covered"));

      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY"); // AUTH_POLICY_NOT_READY
      assert.ok(authGate.details.includes("APPROVED_TARGET_PENDING_TECHNICAL"));
      assert.ok(authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));

      // Pure evaluator proves APPROVED_TARGET_PENDING_TECHNICAL causes NOT_READY with APPROVED_TARGET_PENDING_TECHNICAL
      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(
        [
          { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", position: { code: "GURU_TEST", isActive: true } },
        ],
        {
          approvedPolicies: [
            { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" },
          ],
        }
      );
      assert.strictEqual(evalResult.status, "NOT_READY");
      assert.ok(evalResult.details.includes("APPROVED_TARGET_PENDING_TECHNICAL"));
    });

    it("2.14 Proof 8: Test-only VERIFIED_PRODUCTION capability + active relational chain => runtime authorization readiness PASS", async () => {
      const createVerifiedSlots = () =>
        CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
          id: `ta-slot-${idx}`,
          mapel: { nama: t.subjectName },
          staffId: `stf-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex || "CAMPUR",
          pedagogicalLevel: t.pedagogicalLevel || null,
          isActive: true,
          validUntil: null,
          educationSessions: [
            {
              id: `sess-verified-${idx}`,
              educationTrack: t.track,
              subjectId: `mp-${idx}`,
              genderGroup: t.genderComplex || "CAMPUR",
              scheduledStaffId: `stf-${idx}`,
              scheduledTeacherAssignmentId: `ta-slot-${idx}`,
            },
          ],
          staff: {
            id: `stf-${idx}`,
            status: "AKTIF",
            users: [
              {
                id: `usr-${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                assignments: [
                  {
                    id: `asg-${idx}`,
                    status: "ACTIVE",
                    validFrom: new Date(Date.now() - 86400000),
                    validUntil: null,
                    unit: { id: "ou-1", isActive: true },
                    position: {
                      id: `pos-${idx}`,
                      code: "GURU_KEPESANTRENAN",
                      isActive: true,
                      capabilities: [
                        "academic.schedule.read",
                        "academic.session.start",
                        "academic.material.record",
                        "academic.attendance.record",
                      ].map((capCode) => ({
                        capabilityCode: capCode,
                        scopeType: "GLOBAL",
                        businessRuleState: "VERIFIED_PRODUCTION",
                        capability: { code: capCode, isBlocked: false },
                      })),
                    },
                  },
                ],
              },
            ],
          },
        }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => createVerifiedSlots(),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY");
      assert.ok(gate.details.includes("All 12 required teaching assignment slots covered with verified planning metadata"));

      // With canonical GURU_KEPESANTRENAN policy and VERIFIED_PRODUCTION grants => READY
      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "READY");
      assert.ok(authGate.details.includes("verified with active VERIFIED_PRODUCTION grants"));

      // Pure evaluator proves complete synthetic manifest with VERIFIED_PRODUCTION grants is READY
      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(
        [
          { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
        ],
        {
          approvedPolicies: [
            { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" },
          ],
        }
      );
      assert.strictEqual(evalResult.status, "READY");
    });

    it("2.15 Proof 9: Unrelated active Assignment must not satisfy teacher auth readiness", async () => {
      const createSlotsWithUnrelatedAssignments = () =>
        CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
          id: `ta-slot-${idx}`,
          mapel: { nama: t.subjectName },
          staffId: `stf-${idx}`,
          educationTrack: t.track,
          genderComplex: t.genderComplex || "CAMPUR",
          pedagogicalLevel: t.pedagogicalLevel || null,
          isActive: true,
          validUntil: null,
          educationSessions: [
            {
              id: `sess-unrelated-${idx}`,
              educationTrack: t.track,
              subjectId: `mp-${idx}`,
              genderGroup: t.genderComplex || "CAMPUR",
              scheduledStaffId: `stf-${idx}`,
              scheduledTeacherAssignmentId: `ta-slot-${idx}`,
            },
          ],
          staff: {
            id: `stf-${idx}`,
            status: "AKTIF",
            users: [
              {
                id: `usr-${idx}`,
                status: "AKTIF",
                accountType: "PERSONAL",
                assignments: [
                  {
                    id: `asg-${idx}`,
                    status: "ACTIVE",
                    validFrom: new Date(Date.now() - 86400000),
                    validUntil: null,
                    unit: { id: "ou-1", isActive: true },
                    position: {
                      id: `pos-${idx}`,
                      isActive: true,
                      capabilities: [
                        "tahfizh.recap.read",
                        "keasramaan.permission.read",
                      ].map((capCode) => ({
                        capabilityCode: capCode,
                        scopeType: "GLOBAL",
                        businessRuleState: "VERIFIED_PRODUCTION",
                        capability: { code: capCode, isBlocked: false },
                      })),
                    },
                  },
                ],
              },
            ],
          },
        }));

      const mockDb = {
        teachingAssignment: {
          findMany: async () => createSlotsWithUnrelatedAssignments(),
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "READY"); // PLANNING_READY
      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY"); // AUTH_POLICY_NOT_READY
      assert.ok(authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    it("2.16 Proof 10 & Real PostgreSQL: Unprovisioned academic teacher policy honestly reports NOT_READY without fabrication", async () => {
      // In isolated test PostgreSQL, before M3.3C2 teacher policies are provisioned, readiness reports honestly
      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const gate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("Missing teaching assignment coverage"));

      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY");
      assert.ok(authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY"));
    });

    it("2.17 USER_ASSIGNMENTS_READY: Stale/inactive assignment chains are not counted as READY", async () => {
      const mockDb = {
        assignment: {
          findMany: async () => [
            {
              id: "asg-inactive",
              status: "INACTIVE",
              validFrom: new Date(Date.now() - 86400000),
              validUntil: null,
              user: { id: "u-1", status: "AKTIF", staffId: "stf-1", staff: { id: "stf-1", status: "AKTIF" } },
              position: { id: "pos-1", code: "MUDIR", isActive: true, requiresPersonalAccount: true },
              unit: { id: "ou-1", isActive: true },
            },
          ],
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(gate.details.includes("MUDIR"));
    });
  });

  // =========================================================================
  // 3. REAL RELATIONAL SEEDING & COLLISION CASES
  // =========================================================================
  describe("3. Real Relational Seed & Disambiguation Collision Proofs", () => {
    const MAT_MAPEL_ID = "mp-su-mat";
    const ARB_MAPEL_ID = "mp-kp-arb";
    const FQH_MAPEL_ID = "mp-kp-fqh";

    const COHORT_1_ID = "coh-c1-1";
    const COHORT_2_ID = "coh-c1-2";

    const STF_AHMAD = "stf-c1-ahmad";
    const STF_ZAID = "stf-c1-zaid";
    const STF_ABI = "stf-c1-abi";
    const STF_KAMAL = "stf-c1-kamal";
    const STF_ANDI = "stf-c1-andi";
    const STF_LISA = "stf-c1-lisa";

    const USR_AHMAD = "usr-c1-ahmad";
    const USR_ZAID = "usr-c1-zaid";
    const USR_ABI = "usr-c1-abi";
    const USR_LISA = "usr-c1-lisa";

    const POS_GURU = "pos-c1-guru";
    const OU_AKADEMIK = "ou-c1-akd";

    before(async () => {
      // 1. Relational MataPelajaran
      await prisma.mataPelajaran.createMany({
        data: [
          { id: MAT_MAPEL_ID, nama: "Matematika", kodeMapel: "MAT", kategori: "UMUM" },
          { id: ARB_MAPEL_ID, nama: "Bahasa Arab", kodeMapel: "ARB", kategori: "DINIYAH" },
          { id: FQH_MAPEL_ID, nama: "Fikih", kodeMapel: "FQH", kategori: "DINIYAH" },
        ],
      });

      // 2. Relational Cohorts
      await prisma.educationCohort.createMany({
        data: [
          { id: COHORT_1_ID, code: "TINGKAT_1", startYear: 2026, tahunAjaranMasuk: "2026/2027" },
          { id: COHORT_2_ID, code: "TINGKAT_2", startYear: 2025, tahunAjaranMasuk: "2025/2026" },
        ],
      });

      // 3. Relational Staff
      await prisma.staff.createMany({
        data: [
          { id: STF_AHMAD, staffCode: "STF-C1-01", nama: "Ust. Ahmad", noHp: "081100000001", roleStaff: "GA", status: "AKTIF" },
          { id: STF_ZAID, staffCode: "STF-C1-02", nama: "Ust. Zaid", noHp: "081100000002", roleStaff: "GA", status: "AKTIF" },
          { id: STF_ABI, staffCode: "STF-C1-03", nama: "Ust. Abi Hudzaifah", noHp: "081100000003", roleStaff: "GA", status: "AKTIF" },
          { id: STF_KAMAL, staffCode: "STF-C1-04", nama: "Ust. Kamal Mukhtar", noHp: "081100000004", roleStaff: "GA", status: "AKTIF" },
          { id: STF_ANDI, staffCode: "STF-C1-05", nama: "Ust. Andi Quarzy Ayatullah", noHp: "081100000005", roleStaff: "GA", status: "AKTIF" },
          { id: STF_LISA, staffCode: "STF-C1-06", nama: "Ustazah Lisa Dwina Fitri", noHp: "081100000006", roleStaff: "GA", status: "AKTIF" },
        ],
      });

      // 4. Relational Users linked to Staff
      await prisma.user.createMany({
        data: [
          { id: USR_AHMAD, username: "guru.ahmad", staffId: STF_AHMAD, status: "AKTIF", role: "GA", passwordHash: "dummy" },
          { id: USR_ZAID, username: "guru.zaid", staffId: STF_ZAID, status: "AKTIF", role: "GA", passwordHash: "dummy" },
          { id: USR_ABI, username: "guru.abi", staffId: STF_ABI, status: "AKTIF", role: "GA", passwordHash: "dummy" },
          { id: USR_LISA, username: "guru.lisa", staffId: STF_LISA, status: "AKTIF", role: "GA", passwordHash: "dummy" },
        ],
      });

      // 5. OrgUnit & Position
      await prisma.orgUnit.create({
        data: { id: OU_AKADEMIK, code: "OU-AKADEMIK", name: "Unit Akademik", type: "SERVICE_UNIT", domain: "AKADEMIK", genderComplex: "PUTRA" },
      });
      await prisma.position.create({
        data: { id: POS_GURU, code: "GURU_AKADEMIK", name: "Guru Akademik", domain: "AKADEMIK" },
      });

      // Capabilities
      const capCodes = [
        "academic.schedule.read",
        "academic.session.start",
        "academic.material.record",
        "academic.attendance.record",
      ];
      for (const c of capCodes) {
        await prisma.capability.upsert({
          where: { code: c },
          update: {},
          create: { code: c, name: c, namespace: "ACADEMIC", description: c },
        });
        await prisma.positionCapability.upsert({
          where: { positionId_capabilityCode: { positionId: POS_GURU, capabilityCode: c } },
          update: {},
          create: {
            positionId: POS_GURU,
            capabilityCode: c,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        });
      }

      // User assignments
      for (const uid of [USR_AHMAD, USR_ZAID, USR_ABI, USR_LISA]) {
        await prisma.assignment.create({
          data: {
            userId: uid,
            positionId: POS_GURU,
            unitId: OU_AKADEMIK,
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            createdById: uid,
          },
        });
      }

      // 6. Teaching Assignments
      await prisma.teachingAssignment.createMany({
        data: [
          { id: "ta-mat-ahmad", mapelId: MAT_MAPEL_ID, staffId: STF_AHMAD, educationTrack: "STUDI_UMUM", genderComplex: "PUTRA", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-abi", mapelId: ARB_MAPEL_ID, staffId: STF_ABI, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_1", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-kamal", mapelId: ARB_MAPEL_ID, staffId: STF_KAMAL, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_2", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-andi", mapelId: ARB_MAPEL_ID, staffId: STF_ANDI, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_3", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-lisa", mapelId: ARB_MAPEL_ID, staffId: STF_LISA, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRI", isActive: true, validFrom: new Date(Date.now() - 86400000) },
        ],
      });

      // 7. Seed Colliding & Distinct EducationSessions
      // 1) Same subject, different date (2026-09-21 vs 2026-09-22)
      await prisma.educationSession.createMany({
        data: [
          {
            id: "sess-col-date-1",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            scheduledTeacherAssignmentId: "ta-mat-ahmad",
            status: "SCHEDULED",
          },
          {
            id: "sess-col-date-2",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-22T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 2,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            scheduledTeacherAssignmentId: "ta-mat-ahmad",
            status: "SCHEDULED",
          },
          // 2) Same subject, same date, different cohort (Tingkat 1 vs Tingkat 2)
          {
            id: "sess-col-coh-1",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-23T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 3,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            status: "SCHEDULED",
          },
          {
            id: "sess-col-coh-2",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-23T00:00:00Z"),
            cohortId: COHORT_2_ID,
            programLevel: 2,
            jp: 1,
            semesterMeetingNumber: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ZAID,
            status: "SCHEDULED",
          },
          // 3) Same subject, same date, same cohort, different JP (JP 1 vs JP 2)
          {
            id: "sess-col-jp-1",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-24T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 4,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            status: "SCHEDULED",
          },
          {
            id: "sess-col-jp-2",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-24T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 2,
            semesterMeetingNumber: 5,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            status: "SCHEDULED",
          },
          // 4) Bahasa Arab PUTRA T1 on 2026-09-21
          {
            id: "sess-kps-arb-t1",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            programLevel: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ABI,
            scheduledTeacherAssignmentId: "ta-arb-abi",
            status: "SCHEDULED",
          },
          // 4b) Bahasa Arab PUTRA T1 on 2026-09-28 (Weekly recurring collision test)
          {
            id: "sess-kps-arb-t1-week2",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-28T00:00:00Z"),
            programLevel: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ABI,
            scheduledTeacherAssignmentId: "ta-arb-abi",
            status: "SCHEDULED",
          },
          // 5) Bahasa Arab PUTRA T2
          {
            id: "sess-kps-arb-t2",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            programLevel: 2,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_KAMAL,
            scheduledTeacherAssignmentId: "ta-arb-kamal",
            status: "SCHEDULED",
          },
          // 6) Bahasa Arab PUTRA T3
          {
            id: "sess-kps-arb-t3",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            programLevel: 3,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ANDI,
            scheduledTeacherAssignmentId: "ta-arb-andi",
            status: "SCHEDULED",
          },
          // 7) PUTRI session
          {
            id: "sess-kps-putri",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            genderGroup: "PUTRI",
            scheduledStaffId: STF_LISA,
            scheduledTeacherAssignmentId: "ta-arb-lisa",
            status: "SCHEDULED",
          },
          // 8) Missing scheduled teacher session
          {
            id: "sess-no-teacher",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-25T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            genderGroup: "PUTRA",
            status: "SCHEDULED",
          },
        ],
      });
    });

    it("3.1 Unauthenticated getEducationSessions strictly throws AUTHENTICATION_REQUIRED", async () => {
      await assert.rejects(
        async () => service.getEducationSessions(),
        /AUTHENTICATION_REQUIRED/
      );
      await assert.rejects(
        async () => service.getEducationSessions(undefined, { actorUserId: "" }),
        /AUTHENTICATION_REQUIRED/
      );
    });

    it("3.2 Authenticated read returns real relational subject name, code, and teacher display", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });
      assert.ok(dtos.length >= 8);

      const matSession = dtos.find((d) => d.sessionId === "sess-col-date-1");
      assert.ok(matSession);
      assert.strictEqual(matSession.subject, "Matematika");
      assert.strictEqual(matSession.subjectCode, "MAT");
      assert.strictEqual(matSession.scheduledTeacherDisplay, "Ust. Ahmad");
      assert.strictEqual(matSession.scheduledStaffId, STF_AHMAD);
    });

    it("3.3 WITA date filter operates accurately across date boundaries", async () => {
      const dtos21 = await service.getEducationSessions({ date: "2026-09-21" }, { actorUserId: USR_AHMAD });
      const ids21 = dtos21.map((d) => d.sessionId);
      assert.ok(ids21.includes("sess-col-date-1"));
      assert.ok(!ids21.includes("sess-col-date-2"), "Must not leak 2026-09-22 session into 2026-09-21 filter");

      const dtos22 = await service.getEducationSessions({ date: "2026-09-22" }, { actorUserId: USR_AHMAD });
      const ids22 = dtos22.map((d) => d.sessionId);
      assert.ok(ids22.includes("sess-col-date-2"));
      assert.ok(!ids22.includes("sess-col-date-1"));
    });

    it("3.4 Collision Case 1: Same subject, different dates resolved without first-record ambiguity", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchDate1 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-21",
        subjectName: "Matematika",
        jp: 1,
        programLevel: 1,
      });
      assert.ok(matchDate1);
      assert.strictEqual(matchDate1.sessionId, "sess-col-date-1");

      const matchDate2 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-22",
        subjectName: "Matematika",
        jp: 1,
        programLevel: 1,
      });
      assert.ok(matchDate2);
      assert.strictEqual(matchDate2.sessionId, "sess-col-date-2");
    });

    it("3.5 Collision Case 2: Same subject, same date, different cohorts resolved strictly", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchCoh1 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-23",
        subjectName: "Matematika",
        cohortId: COHORT_1_ID,
      });
      assert.ok(matchCoh1);
      assert.strictEqual(matchCoh1.sessionId, "sess-col-coh-1");

      const matchCoh2 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-23",
        subjectName: "Matematika",
        cohortId: COHORT_2_ID,
      });
      assert.ok(matchCoh2);
      assert.strictEqual(matchCoh2.sessionId, "sess-col-coh-2");
    });

    it("3.6 Collision Case 3: Same subject, same date, same cohort, different JP resolved strictly", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchJp1 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-24",
        subjectName: "Matematika",
        jp: 1,
      });
      assert.ok(matchJp1);
      assert.strictEqual(matchJp1.sessionId, "sess-col-jp-1");

      const matchJp2 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-24",
        subjectName: "Matematika",
        jp: 2,
      });
      assert.ok(matchJp2);
      assert.strictEqual(matchJp2.sessionId, "sess-col-jp-2");
    });

    it("3.7 Collision Cases 4, 5, 6 & Date Disambiguation: Bahasa Arab PUTRA T1 on 2026-09-21 vs 2026-09-28 resolves exact requested date without aliasing", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      // Selecting 2026-09-28 must return ONLY the second session
      const matchWeek2 = matchKepesantrenanSession(dtos, {
        scheduledDate: "2026-09-28",
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_1",
      });
      assert.ok(matchWeek2);
      assert.strictEqual(matchWeek2.sessionId, "sess-kps-arb-t1-week2");
      assert.strictEqual(matchWeek2.scheduledDate, "2026-09-28");
      assert.strictEqual(matchWeek2.scheduledTeacherDisplay, "Ust. Abi Hudzaifah");

      // Selecting 2026-09-21 returns ONLY the first session
      const matchWeek1 = matchKepesantrenanSession(dtos, {
        scheduledDate: "2026-09-21",
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_1",
      });
      assert.ok(matchWeek1);
      assert.strictEqual(matchWeek1.sessionId, "sess-kps-arb-t1");
      assert.strictEqual(matchWeek1.scheduledDate, "2026-09-21");

      // Distinct levels on same date: T2 & T3
      const matchT2 = matchKepesantrenanSession(dtos, {
        scheduledDate: "2026-09-21",
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_2",
      });
      assert.ok(matchT2);
      assert.strictEqual(matchT2.sessionId, "sess-kps-arb-t2");
      assert.strictEqual(matchT2.scheduledTeacherDisplay, "Ust. Kamal Mukhtar");

      const matchT3 = matchKepesantrenanSession(dtos, {
        scheduledDate: "2026-09-21",
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_3",
      });
      assert.ok(matchT3);
      assert.strictEqual(matchT3.sessionId, "sess-kps-arb-t3");
      assert.strictEqual(matchT3.scheduledTeacherDisplay, "Ust. Andi Quarzy Ayatullah");
    });

    it("3.8 Collision Case 7: PUTRI session and strict gender isolation (No gender aliasing)", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchPutri = matchKepesantrenanSession(dtos, {
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRI",
      });
      assert.ok(matchPutri);
      assert.strictEqual(matchPutri.sessionId, "sess-kps-putri");
      assert.strictEqual(matchPutri.genderGroup, "PUTRI");
      assert.strictEqual(matchPutri.scheduledTeacherDisplay, "Ustazah Lisa Dwina Fitri");

      // Searching for PUTRI must NEVER return PUTRA
      const leakCheck = matchKepesantrenanSession(
        dtos.filter((d) => d.genderGroup === "PUTRI"),
        { subjectName: "Bahasa Arab", genderGroup: "PUTRA" }
      );
      assert.strictEqual(leakCheck, undefined);
    });

    it("3.9 Authorization proof: Direct Subject account binding without Staff profile or assignment", async () => {
      const USR_TECH_MAT = "usr-c1-tech-mat";
      await prisma.user.create({
        data: {
          id: USR_TECH_MAT,
          username: "tech.mapel.mat",
          staffId: null,
          status: "AKTIF",
          accountType: "SUBJECT",
          role: "GA",
          passwordHash: "dummy",
        },
      });
      await prisma.academicSubjectAccountBinding.create({
        data: {
          userId: USR_TECH_MAT,
          subjectId: MAT_MAPEL_ID,
          isActive: true,
        },
      });

      // 1. Correct authorized subject account without Staff/Assignment (tech.mapel.mat for sess-col-date-1)
      const dtosMat = await service.getEducationSessions(undefined, { actorUserId: USR_TECH_MAT });
      const matSess = dtosMat.find((d) => d.sessionId === "sess-col-date-1");
      assert.ok(matSess, "Must allow reading own-subject session");
      assert.strictEqual(matSess.mutationAvailable, true);
      assert.strictEqual(matSess.mutationDeniedReason, null);
      // Studi Umum attendance is deferred
      assert.strictEqual(matSess.attendanceAvailable, false);
      assert.strictEqual(matSess.attendanceDeniedReason, "STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED");
      // Must exclude other subject sessions
      assert.strictEqual(dtosMat.find((d) => d.sessionId === "sess-col-ipa-1"), undefined, "Must exclude other subject sessions");

      // 2. Non-subject user (Ust. Ahmad calling sess-col-date-1) => DENY mutation (requires SUBJECT account)
      const dtosAhmad = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });
      const ahmadSess = dtosAhmad.find((d) => d.sessionId === "sess-col-date-1");
      assert.ok(ahmadSess);
      assert.strictEqual(ahmadSess.mutationAvailable, false);
      assert.strictEqual(ahmadSess.mutationDeniedReason, "SUBJECT_ACCOUNT_REQUIRED");

      // 3. Subject account bound to a different subject (IPA) has direct access to IPA but NOT Math
      const IPA_MAPEL_ID = "mapel-c1-ipa";
      await prisma.mataPelajaran.create({
        data: { id: IPA_MAPEL_ID, nama: "Ilmu Pengetahuan Alam", kodeMapel: "IPA", kategori: "UMUM" },
      });
      await prisma.educationSession.create({
        data: {
          id: "sess-col-ipa-1",
          educationTrack: "STUDI_UMUM",
          subjectId: IPA_MAPEL_ID,
          scheduledDate: new Date("2026-09-23T00:00:00Z"),
          cohortId: COHORT_1_ID,
          programLevel: 1,
          jp: 1,
          status: "SCHEDULED",
        },
      });

      const USR_TECH_OTHER = "usr-c1-tech-other";
      await prisma.user.create({
        data: {
          id: USR_TECH_OTHER,
          username: "tech.mapel.other",
          staffId: null,
          status: "AKTIF",
          accountType: "SUBJECT",
          role: "GA",
          passwordHash: "dummy",
        },
      });
      await prisma.academicSubjectAccountBinding.create({
        data: {
          userId: USR_TECH_OTHER,
          subjectId: IPA_MAPEL_ID,
          isActive: true,
        },
      });
      const dtosOther = await service.getEducationSessions(undefined, { actorUserId: USR_TECH_OTHER });
      const ipaSess = dtosOther.find((d) => d.sessionId === "sess-col-ipa-1");
      assert.ok(ipaSess, "Must allow reading own-subject IPA session");
      const otherSess = dtosOther.find((d) => d.sessionId === "sess-col-date-1");
      assert.strictEqual(otherSess, undefined, "Must exclude cross-subject Math session from other subject account read");

      // 4. Subject account with NO binding fails closed on schedule read
      const USR_TECH_NO_BIND = "usr-c1-tech-nobind";
      await prisma.user.create({
        data: {
          id: USR_TECH_NO_BIND,
          username: "tech.mapel.nobind",
          staffId: null,
          status: "AKTIF",
          accountType: "SUBJECT",
          role: "GA",
          passwordHash: "dummy",
        },
      });
      await assert.rejects(
        () => service.getEducationSessions(undefined, { actorUserId: USR_TECH_NO_BIND }),
        /PERMISSION_DENIED/,
        "Subject account without binding must fail closed"
      );
    });
  });

  // =========================================================================
  // 4. SECTION 7 REAL POSTGRESQL EFFECTIVE GRANT & SCOPE AUTHORIZATION CLOSURE PROOFS
  // =========================================================================
  describe("4. Section 7 Real PostgreSQL Effective Grant & Scope Authorization Closure Proofs", () => {
    const OU_AKADEMIK = "ou-c1-akd";
    const USR_AHMAD = "usr-c1-ahmad";
    const STF_AHMAD = "stf-c1-ahmad";

    const createAllRequiredAssignments = (opts?: {
      overridePosCode?: string;
      overridePatch?: (base: any) => any;
      defaultBusinessRuleState?: "PROPOSED_TBD" | "APPROVED_TARGET_PENDING_TECHNICAL" | "VERIFIED_PRODUCTION";
      policyOverrides?: Map<string, { scope?: string; state?: string; remove?: boolean }>;
    }) => {
      const defaultState = opts?.defaultBusinessRuleState ?? "VERIFIED_PRODUCTION";

      return CANONICAL_REQUIRED_POSITION_CODES.map((posCode, idx) => {
        const targetPolicies = CANONICAL_UAT_TARGET_POLICIES.filter((p) => p.positionCode === posCode);

        const capabilities = targetPolicies
          .map((p) => {
            const override = opts?.policyOverrides?.get(p.capabilityCode);
            return {
              capabilityCode: p.capabilityCode,
              scopeType: override?.scope ?? p.expectedScope,
              businessRuleState: override?.state ?? defaultState,
              capability: { code: p.capabilityCode, isBlocked: false },
            };
          })
          .filter((c) => {
            const override = opts?.policyOverrides?.get(c.capabilityCode);
            return !override?.remove;
          });

        if (capabilities.length === 0) {
          capabilities.push({
            capabilityCode: "academic.schedule.read",
            scopeType: "GLOBAL",
            businessRuleState: defaultState,
            capability: { code: "academic.schedule.read", isBlocked: false },
          });
        }

        const base = {
          id: `asg-req-${idx}`,
          userId: `usr-req-${idx}`,
          positionId: `pos-req-${idx}`,
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 86400000),
          validUntil: null,
          unitId: `ou-req-${idx}`,
          scopeUnits: [{ unitId: `ou-req-${idx}` }],
          user: {
            id: `usr-req-${idx}`,
            username: `user.req.${idx}`,
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: `stf-req-${idx}`,
            staff: { id: `stf-req-${idx}`, status: "AKTIF" },
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

        if (opts?.overridePosCode === posCode && opts.overridePatch) {
          return opts.overridePatch(base);
        }
        return base;
      });
    };

    it("4.1 Proof 1: academic.session.start configured with scopeType = HALAQOH against EducationSession => NOT_READY (SCOPE_MISMATCH) & authorizeCanonical DENY", async () => {
      // 1. Direct authorizeCanonical evaluation
      const halaqohIdentity = {
        userId: "usr-halaqoh-teacher",
        username: "guru.halaqoh",
        accountType: "PERSONAL" as const,
        staffId: "stf-halaqoh",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Guru Halaqoh",
      };
      const halaqohAssignment = {
        id: "asg-halaqoh-1",
        userId: "usr-halaqoh-teacher",
        positionId: "pos-halaqoh",
        positionCode: "GURU_HALAQOH",
        unitId: "ou-halaqoh-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [],
        positionCapabilities: [
          {
            capabilityCode: "academic.session.start",
            scopeType: "HALAQOH" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authRes = await authorizeCanonical({
        identity: halaqohIdentity,
        capability: "academic.session.start",
        resourceContext: {
          educationSessionId: "sess-col-date-1",
        },
        dataProvider: {
          getIdentity: async () => halaqohIdentity,
          getActiveAssignments: async () => [halaqohAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => ({
            educationSessionId: "sess-col-date-1",
            orgDomain: "AKADEMIK",
            orgUnitIds: [OU_AKADEMIK],
            genderComplex: "PUTRA",
          }),
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.ok(
        authRes.code === "SCOPE_MISMATCH" || authRes.code === "INVALID_RESOURCE_CONTEXT",
        `Expected SCOPE_MISMATCH or INVALID_RESOURCE_CONTEXT, got ${authRes.code}`
      );

      // 2. Gate 9 check with HALAQOH scope
      const mockSlots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-slot-${idx}`,
        mapel: { nama: t.subjectName },
        staffId: `stf-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex || "CAMPUR",
        pedagogicalLevel: t.pedagogicalLevel || null,
        isActive: true,
        validUntil: null,
        educationSessions: [
          {
            id: `sess-slot-${idx}`,
            educationTrack: t.track,
            subjectId: `mp-${idx}`,
            genderGroup: t.genderComplex || "CAMPUR",
            programLevel: (idx % 3) + 1,
            scheduledStaffId: `stf-${idx}`,
            scheduledTeacherAssignmentId: `ta-slot-${idx}`,
          },
        ],
        staff: {
          id: `stf-${idx}`,
          status: "AKTIF",
          users: [
            {
              id: `usr-${idx}`,
              status: "AKTIF",
              accountType: "PERSONAL",
              assignments: [
                {
                  id: `asg-${idx}`,
                  status: "ACTIVE",
                  validFrom: new Date(Date.now() - 86400000),
                  validUntil: null,
                  unit: { id: OU_AKADEMIK, isActive: true },
                  position: {
                    id: `pos-${idx}`,
                    isActive: true,
                    capabilities: [
                      "academic.schedule.read",
                      "academic.session.start",
                      "academic.material.record",
                      "academic.attendance.record",
                    ].map((capCode) => ({
                      capabilityCode: capCode,
                      // Incompatible academic scope HALAQOH
                      scopeType: capCode === "academic.session.start" ? "HALAQOH" : "GLOBAL",
                      businessRuleState: "VERIFIED_PRODUCTION",
                      capability: { code: capCode, isBlocked: false },
                    })),
                  },
                },
              ],
            },
          ],
        },
      }));

      const report = await checkPendidikanV2ProductionReadiness({
        teachingAssignment: { findMany: async () => mockSlots },
      } as any);

      const teachingGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(teachingGate);
      assert.strictEqual(teachingGate.status, "READY");

      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY");
      assert.ok(
        authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY")
      );
    });

    it("4.2 Proof 2: academic.session.start with runtime-compatible effective grant against real EducationSession => ALLOW: true & TEACHING_ASSIGNMENTS_READY can be READY", async () => {
      // 1. Direct authorizeCanonical against real PostgreSQL database seeded in Section 3
      const ahmadIdentity = {
        userId: USR_AHMAD,
        username: "guru.ahmad",
        accountType: "PERSONAL" as const,
        staffId: STF_AHMAD,
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Ust. Ahmad",
      };

      const authRes = await authorizeCanonical({
        identity: ahmadIdentity,
        capability: "academic.session.start",
        resourceContext: {
          educationSessionId: "sess-col-date-1",
        },
        dataProvider,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "GLOBAL");

      // 2. Full coverage with GLOBAL scope + representative sessions => READY
      const mockSlots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-slot-${idx}`,
        mapel: { nama: t.subjectName },
        staffId: `stf-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex || "CAMPUR",
        pedagogicalLevel: t.pedagogicalLevel || null,
        isActive: true,
        validUntil: null,
        educationSessions: [
          {
            id: `sess-slot-${idx}`,
            educationTrack: t.track,
            subjectId: `mp-${idx}`,
            genderGroup: t.genderComplex || "CAMPUR",
            programLevel: (idx % 3) + 1,
            scheduledStaffId: `stf-${idx}`,
            scheduledTeacherAssignmentId: `ta-slot-${idx}`,
          },
        ],
        staff: {
          id: `stf-${idx}`,
          status: "AKTIF",
          users: [
            {
              id: `usr-${idx}`,
              status: "AKTIF",
              accountType: "PERSONAL",
              assignments: [
                {
                  id: `asg-${idx}`,
                  status: "ACTIVE",
                  validFrom: new Date(Date.now() - 86400000),
                  validUntil: null,
                  unit: { id: OU_AKADEMIK, isActive: true },
                  position: {
                    id: `pos-${idx}`,
                    code: "GURU_KEPESANTRENAN",
                    isActive: true,
                    capabilities: [
                      "academic.schedule.read",
                      "academic.session.start",
                      "academic.material.record",
                      "academic.attendance.record",
                    ].map((capCode) => ({
                      capabilityCode: capCode,
                      scopeType: "GLOBAL",
                      businessRuleState: "VERIFIED_PRODUCTION",
                      capability: { code: capCode, isBlocked: false },
                    })),
                  },
                },
              ],
            },
          ],
        },
      }));

      const report = await checkPendidikanV2ProductionReadiness({
        teachingAssignment: { findMany: async () => mockSlots },
      } as any);

      const teachingGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(teachingGate);
      assert.strictEqual(teachingGate.status, "READY");

      // With canonical GURU_KEPESANTRENAN policy and VERIFIED_PRODUCTION grants => READY
      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "READY");

      // Pure evaluator proves runtime-compatible effective grant evaluates to READY
      const evalResult = evaluateKepesantrenanAcademicAuthPolicies(
        [
          { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
          { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_TEST", isActive: true } },
        ],
        {
          approvedPolicies: [
            { positionCode: "GURU_TEST", capabilityCode: "academic.schedule.read", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.session.start", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.material.record", scopeType: "GLOBAL" },
            { positionCode: "GURU_TEST", capabilityCode: "academic.attendance.record", scopeType: "GLOBAL" },
          ],
        }
      );
      assert.strictEqual(evalResult.status, "READY");
    });

    it("4.3 Proof 3: Academic grant exists but scope cannot match resource (UNIT outside containment) => NOT_READY & SCOPE_MISMATCH", async () => {
      const unitIdentity = {
        userId: "usr-unit-mismatch",
        username: "guru.unit.mismatch",
        accountType: "PERSONAL" as const,
        staffId: "stf-unit-mismatch",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Guru Mismatched Unit",
      };
      const unitAssignment = {
        id: "asg-unit-mismatch",
        userId: "usr-unit-mismatch",
        positionId: "pos-unit-mismatch",
        positionCode: "GURU_UNIT",
        unitId: "ou-different-campus",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [],
        positionCapabilities: [
          {
            capabilityCode: "academic.session.start",
            scopeType: "UNIT" as const,
            anchorUnitId: "ou-different-campus",
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authRes = await authorizeCanonical({
        identity: unitIdentity,
        capability: "academic.session.start",
        resourceContext: {
          educationSessionId: "sess-col-date-1",
        },
        dataProvider: {
          getIdentity: async () => unitIdentity,
          getActiveAssignments: async () => [unitAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => ({
            educationSessionId: "sess-col-date-1",
            orgDomain: "AKADEMIK",
            orgUnitIds: [OU_AKADEMIK], // sess-col-date-1 is in OU_AKADEMIK, not ou-different-campus
            genderComplex: "PUTRA",
          }),
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "SCOPE_MISMATCH");

      // Gate 9 should report SCOPE_MISMATCH
      const mockSlots = CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.map((t, idx) => ({
        id: `ta-slot-${idx}`,
        mapel: { nama: t.subjectName },
        staffId: `stf-${idx}`,
        educationTrack: t.track,
        genderComplex: t.genderComplex || "CAMPUR",
        pedagogicalLevel: t.pedagogicalLevel || null,
        isActive: true,
        validUntil: null,
        educationSessions: [
          {
            id: `sess-slot-${idx}`,
            educationTrack: t.track,
            subjectId: `mp-${idx}`,
            genderGroup: t.genderComplex || "CAMPUR",
            programLevel: (idx % 3) + 1,
            scheduledStaffId: `stf-${idx}`,
            scheduledTeacherAssignmentId: `ta-slot-${idx}`,
          },
        ],
        staff: {
          id: `stf-${idx}`,
          status: "AKTIF",
          users: [
            {
              id: `usr-${idx}`,
              status: "AKTIF",
              accountType: "PERSONAL",
              assignments: [
                {
                  id: `asg-${idx}`,
                  status: "ACTIVE",
                  validFrom: new Date(Date.now() - 86400000),
                  validUntil: null,
                  unit: { id: "ou-different-campus", isActive: true },
                  position: {
                    id: `pos-${idx}`,
                    isActive: true,
                    capabilities: [
                      "academic.schedule.read",
                      "academic.session.start",
                      "academic.material.record",
                      "academic.attendance.record",
                    ].map((capCode) => ({
                      capabilityCode: capCode,
                      // UNIT scope with different anchorUnitId
                      scopeType: "UNIT",
                      anchorUnitId: "ou-different-campus",
                      businessRuleState: "VERIFIED_PRODUCTION",
                      capability: { code: capCode, isBlocked: false },
                    })),
                  },
                },
              ],
            },
          ],
        },
      }));

      const report = await checkPendidikanV2ProductionReadiness({
        teachingAssignment: { findMany: async () => mockSlots },
      } as any);

      const teachingGate = report.gates.find((g) => g.gate === "TEACHING_ASSIGNMENTS_READY");
      assert.ok(teachingGate);
      assert.strictEqual(teachingGate.status, "READY");

      const authGate = report.gates.find((g) => g.gate === "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY");
      assert.ok(authGate);
      assert.strictEqual(authGate.status, "NOT_READY");
      assert.ok(
        authGate.details.includes("KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY")
      );
    });

    it("4.4 Proof 4: PETUGAS_OPERASIONAL_TAHFIZH assignment exists but tahfizh.recap.read PositionCapability missing => USER_ASSIGNMENTS_READY = NOT_READY", async () => {
      const assignments = createAllRequiredAssignments({
        policyOverrides: new Map([["tahfizh.recap.read", { remove: true }]]),
      });

      const mockDb = {
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () => [],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("tahfizh.recap.read") && userGate.details.includes("missing"),
        "Must flag missing tahfizh.recap.read capability"
      );
    });

    it("4.5 Proof 5: PositionCapability exists with wrong scope (ASSIGNED_UNITS instead of GLOBAL) => target policy mismatch / NOT_READY", async () => {
      const assignments = createAllRequiredAssignments({
        policyOverrides: new Map([["tahfizh.recap.read", { scope: "ASSIGNED_UNITS" }]]),
      });

      const mockDb = {
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () => [],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("expected GLOBAL, found ASSIGNED_UNITS"),
        "Must flag scope mismatch between GLOBAL and ASSIGNED_UNITS"
      );
    });

    it("4.6 Proof 6: PositionCapability exists with correct target scope but APPROVED_TARGET_PENDING_TECHNICAL => TARGET_POLICY_READY, RUNTIME_NOT_READY (POLICY_APPROVED_NOT_RUNTIME_ACTIVE)", async () => {
      const assignments = createAllRequiredAssignments({
        defaultBusinessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      });

      const mockDb = {
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () => [],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("TARGET_POLICY_READY"),
        "Must record TARGET_POLICY_READY in gate details"
      );
      assert.ok(
        userGate.details.includes("POLICY_APPROVED_NOT_RUNTIME_ACTIVE"),
        "Must report RUNTIME_NOT_READY: POLICY_APPROVED_NOT_RUNTIME_ACTIVE"
      );
    });

    it("4.7 Proof 7: TEST-ONLY fixture with VERIFIED_PRODUCTION + correct scope/resource => runtime readiness proof succeeds (USER_ASSIGNMENTS_READY = READY)", async () => {
      const assignments = createAllRequiredAssignments({
        defaultBusinessRuleState: "VERIFIED_PRODUCTION",
      });

      const mockDb = {
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () => [],
        },
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
          findMany: async () => {
            return CANONICAL_REQUIRED_POSITION_CODES.map((_, idx) => ({
              id: `san-req-${idx}`,
              halaqohId: `ou-req-${idx}`,
              status: "AKTIF",
            }));
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
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "READY");
      assert.ok(
        userGate.details.includes(`All ${CANONICAL_REQUIRED_POSITION_CODES.length} required target positions have active user assignments`),
        "Must verify all required target positions are ready"
      );
    });

    it("4.8 Proof 8: Active personal Assignment with User.staffId = null => USER_ASSIGNMENTS_READY = NOT_READY", async () => {
      const assignments = createAllRequiredAssignments({
        overridePosCode: "MUDIR",
        overridePatch: (base) => ({
          ...base,
          user: {
            ...base.user,
            staffId: null,
            staff: null,
          },
        }),
      });

      const mockDb = {
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () => [],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("missing linked staff (staffId is null)"),
        "Must fail closed when active personal assignment user has staffId = null"
      );
    });

    it("4.9 Proof 9: staffId points to missing/inactive Staff => USER_ASSIGNMENTS_READY = NOT_READY", async () => {
      const assignments = createAllRequiredAssignments({
        overridePosCode: "MUDIR",
        overridePatch: (base) => ({
          ...base,
          user: {
            ...base.user,
            staff: {
              ...base.user.staff,
              status: "NONAKTIF",
            },
          },
        }),
      });

      const mockDb = {
        assignment: {
          findMany: async () => assignments,
        },
        positionCapability: {
          findMany: async () => [],
        },
      };

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("missing or inactive staff"),
        "Must fail closed when staff is inactive or missing"
      );
    });
  });

  const createUatAssignments = (opts?: {
    overridePosCode?: string;
    overridePatch?: (base: any) => any;
    defaultBusinessRuleState?: "PROPOSED_TBD" | "APPROVED_TARGET_PENDING_TECHNICAL" | "VERIFIED_PRODUCTION";
    policyOverrides?: Map<string, { scope?: string; state?: string; remove?: boolean }>;
  }) => {
    const defaultState = opts?.defaultBusinessRuleState ?? "VERIFIED_PRODUCTION";

    return CANONICAL_REQUIRED_POSITION_CODES.map((posCode, idx) => {
      const targetPolicies = CANONICAL_UAT_TARGET_POLICIES.filter((p) => p.positionCode === posCode);

      const capabilities = targetPolicies
        .map((p) => {
          const override = opts?.policyOverrides?.get(p.capabilityCode);
          return {
            capabilityCode: p.capabilityCode,
            scopeType: override?.scope ?? p.expectedScope,
            businessRuleState: override?.state ?? defaultState,
            capability: { code: p.capabilityCode, isBlocked: false },
          };
        })
        .filter((c) => {
          const override = opts?.policyOverrides?.get(c.capabilityCode);
          return !override?.remove;
        });

      if (capabilities.length === 0) {
        capabilities.push({
          capabilityCode: "academic.schedule.read",
          scopeType: "GLOBAL",
          businessRuleState: defaultState,
          capability: { code: "academic.schedule.read", isBlocked: false },
        });
      }

      const base = {
        id: `asg-uat-${idx}`,
        userId: `usr-uat-${idx}`,
        positionId: `pos-uat-${idx}`,
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        unitId: `ou-uat-${idx}`,
        scopeUnits: [{ unitId: `ou-uat-${idx}` }],
        scopedUnits: [{ unitId: `ou-uat-${idx}`, unit: { id: `ou-uat-${idx}`, isActive: true } }],
        user: {
          id: `usr-uat-${idx}`,
          username: `user.uat.${idx}`,
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: `stf-uat-${idx}`,
          staff: { id: `stf-uat-${idx}`, status: "AKTIF" },
        },
        position: {
          id: `pos-uat-${idx}`,
          code: posCode,
          name: posCode,
          isActive: true,
          requiresPersonalAccount: true,
          domain: posCode.includes("KEASRAMAAN") ? "KEASRAMAAN" : "TAHFIZH",
          capabilities,
        },
      };

      if (opts?.overridePosCode === posCode && opts.overridePatch) {
        return opts.overridePatch(base);
      }
      return base;
    });
  };

  // =========================================================================
  // 5. MILESTONE 3.3C1 FINAL UAT TARGET RESOURCE-SCOPE CLOSURE PROOFS
  // =========================================================================
  describe("5. Milestone 3.3C1 Final UAT Target Resource-Scope Closure Proofs", () => {

    const createDefaultMockDb = (
      assignments: any[],
      overrides?: {
        santriFindFirst?: (args: any) => Promise<any>;
        santriFindMany?: (args: any) => Promise<any>;
        placementFindFirst?: (args: any) => Promise<any>;
        placementFindMany?: (args: any) => Promise<any>;
      }
    ) => ({
      assignment: { findMany: async () => assignments },
      positionCapability: { findMany: async () => [] },
      santri: {
        findFirst:
          overrides?.santriFindFirst ??
          (async (args: any) => {
            const hId = args?.where?.halaqohId;
            if (typeof hId === "string") {
              return { id: `san-${hId}`, halaqohId: hId, status: "AKTIF" };
            }
            if (args?.where?.halaqohId?.in && Array.isArray(args.where.halaqohId.in)) {
              const matched = args.where.halaqohId.in[0];
              if (matched) return { id: `san-${matched}`, halaqohId: matched, status: "AKTIF" };
            }
            return { id: "san-uat-default", halaqohId: "ou-tahfizh-unit-1", status: "AKTIF" };
          }),
        findMany:
          overrides?.santriFindMany ??
          (async () => [
            { id: "san-uat-1", halaqohId: "ou-tahfizh-unit-1", status: "AKTIF" },
            { id: "san-own-1", halaqohId: "hlq-unit-1", status: "AKTIF" },
          ]),
      },
      santriKamarPlacement: {
        findFirst:
          overrides?.placementFindFirst ??
          (async (args: any) => {
            if (args?.where?.kamarId?.in && Array.isArray(args.where.kamarId.in)) {
              const kId = args.where.kamarId.in[0];
              if (kId) return { id: `skp-${kId}`, kamarId: kId, santriId: `san-${kId}`, isActive: true, santri: { status: "AKTIF" } };
            }
            return { id: "skp-default", kamarId: "asr-putra-1", santriId: "san-asr-1", isActive: true, santri: { status: "AKTIF" } };
          }),
        findMany:
          overrides?.placementFindMany ??
          (async () => [
            { id: "skp-1", kamarId: "asr-putra-1", santriId: "san-asr-1", isActive: true, santri: { status: "AKTIF" } },
          ]),
      },
    });

    it("5.1 Proof 1: tahfizh.reward.issue (ASSIGNED_UNITS): resource outside assigned units => SCOPE_MISMATCH & Gate 8 NOT_READY", async () => {
      // 1. Runtime authorizeCanonical evaluation
      const lisaIdentity = {
        userId: "usr-lisa",
        username: "lisa.operasional",
        accountType: "PERSONAL" as const,
        staffId: "stf-lisa",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Lisa Operasional",
      };
      const lisaAssignment = {
        id: "asg-lisa-reward-1",
        userId: "usr-lisa",
        positionId: "pos-lisa",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        unitId: "ou-tahfizh-unit-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [{ unitId: "ou-tahfizh-unit-1" }],
        scopedUnits: [{ unitId: "ou-tahfizh-unit-1", unit: { id: "ou-tahfizh-unit-1", isActive: true } }],
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "ASSIGNED_UNITS" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authDeny = await authorizeCanonical({
        identity: lisaIdentity,
        capability: "tahfizh.reward.issue",
        resolvedContext: {
          resourceId: "rw-outside-1",
          orgUnitIds: ["ou-tahfizh-unit-99"],
          orgDomain: "TAHFIZH",
        },
        dataProvider: {
          getIdentity: async () => lisaIdentity,
          getActiveAssignments: async () => [lisaAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authDeny.decision, "DENY");
      assert.strictEqual(authDeny.code, "SCOPE_MISMATCH");

      // 2. Gate 8 Production Readiness Check (tested via ASSIGNED_UNITS policy santri.kamar.manage)
      const assignments = createUatAssignments({
        overridePosCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        overridePatch: (base) => ({
          ...base,
          unitId: "ou-asr-unit-1",
          scopedUnits: [{ unitId: "ou-asr-unit-1", unit: { id: "ou-asr-unit-1", isActive: true } }],
        }),
      });

      const mockDb = createDefaultMockDb(assignments, {
        placementFindFirst: async (args: any) => {
          if (args?.where?.kamarId?.in?.includes("ou-asr-unit-1")) {
            return null; // No active santri placement in permitted unit
          }
          return { id: "skp-default", kamarId: "ou-default", santriId: "san-default", isActive: true, santri: { status: "AKTIF" } };
        },
        placementFindMany: async () => [
          { id: "skp-outside", kamarId: "ou-asr-unit-99", santriId: "san-outside", isActive: true, santri: { status: "AKTIF" } },
        ],
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("SCOPE_MISMATCH") && userGate.details.includes("PETUGAS_OPERASIONAL_KEASRAMAAN"),
        `Expected SCOPE_MISMATCH failure, got: ${userGate.details}`
      );
    });

    it("5.2 Proof 2: tahfizh.reward.issue (ASSIGNED_UNITS): resource inside assigned units with VERIFIED_PRODUCTION => ALLOW & Gate 8 READY", async () => {
      // 1. Runtime authorizeCanonical evaluation
      const lisaIdentity = {
        userId: "usr-lisa",
        username: "lisa.operasional",
        accountType: "PERSONAL" as const,
        staffId: "stf-lisa",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Lisa Operasional",
      };
      const lisaAssignment = {
        id: "asg-lisa-reward-1",
        userId: "usr-lisa",
        positionId: "pos-lisa",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        unitId: "ou-tahfizh-unit-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [{ unitId: "ou-tahfizh-unit-1" }],
        scopedUnits: [{ unitId: "ou-tahfizh-unit-1", unit: { id: "ou-tahfizh-unit-1", isActive: true } }],
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "ASSIGNED_UNITS" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authAllow = await authorizeCanonical({
        identity: lisaIdentity,
        capability: "tahfizh.reward.issue",
        resolvedContext: {
          resourceId: "rw-inside-1",
          orgUnitIds: ["ou-tahfizh-unit-1"],
          orgDomain: "TAHFIZH",
        },
        dataProvider: {
          getIdentity: async () => lisaIdentity,
          getActiveAssignments: async () => [lisaAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authAllow.decision, "ALLOW");
      assert.strictEqual(authAllow.code, "ALLOWED");

      // 2. Gate 8 Production Readiness Check
      const assignments = createUatAssignments({
        overridePosCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        overridePatch: (base) => ({
          ...base,
          unitId: "ou-tahfizh-unit-1",
          scopedUnits: [{ unitId: "ou-tahfizh-unit-1", unit: { id: "ou-tahfizh-unit-1", isActive: true } }],
        }),
      });

      const mockDb = createDefaultMockDb(assignments);

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "READY");
    });

    it("5.3 Proof 3: tahfizh.target.manage (HALAQOH): target santri in assigned halaqoh with VERIFIED_PRODUCTION => ALLOW & Gate 8 READY", async () => {
      // 1. Runtime authorizeCanonical evaluation
      const musyrifIdentity = {
        userId: "usr-musyrif-1",
        username: "musyrif.1",
        accountType: "PERSONAL" as const,
        staffId: "stf-musyrif-1",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Musyrif Tahfizh 1",
      };
      const musyrifAssignment = {
        id: "asg-mt-1",
        userId: "usr-musyrif-1",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        unitId: "hlq-unit-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [],
        scopedUnits: [],
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.target.manage",
            scopeType: "HALAQOH" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authAllow = await authorizeCanonical({
        identity: musyrifIdentity,
        capability: "tahfizh.target.manage",
        resolvedContext: {
          santriId: "san-own-1",
          halaqohId: "hlq-unit-1",
          orgUnitIds: ["hlq-unit-1"],
          orgDomain: "TAHFIZH",
        },
        dataProvider: {
          getIdentity: async () => musyrifIdentity,
          getActiveAssignments: async () => [musyrifAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authAllow.decision, "ALLOW");
      assert.strictEqual(authAllow.code, "ALLOWED");

      // 2. Gate 8 Production Readiness Check
      const assignments = createUatAssignments({
        overridePosCode: "MUSYRIF_TAHFIZH",
        overridePatch: (base) => ({
          ...base,
          unitId: "hlq-unit-1",
          scopedUnits: [],
        }),
      });

      const mockDb = createDefaultMockDb(assignments);

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "READY");
    });

    it("5.4 Proof 4: tahfizh.target.manage (HALAQOH): target santri in different halaqoh => DENY (SCOPE_MISMATCH) & Gate 8 NOT_READY", async () => {
      // 1. Runtime authorizeCanonical evaluation
      const musyrifIdentity = {
        userId: "usr-musyrif-1",
        username: "musyrif.1",
        accountType: "PERSONAL" as const,
        staffId: "stf-musyrif-1",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Musyrif Tahfizh 1",
      };
      const musyrifAssignment = {
        id: "asg-mt-1",
        userId: "usr-musyrif-1",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        unitId: "hlq-unit-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [],
        scopedUnits: [],
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.target.manage",
            scopeType: "HALAQOH" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authDeny = await authorizeCanonical({
        identity: musyrifIdentity,
        capability: "tahfizh.target.manage",
        resolvedContext: {
          santriId: "san-diff-2",
          halaqohId: "hlq-different-99",
          orgUnitIds: ["hlq-different-99"],
          orgDomain: "TAHFIZH",
        },
        dataProvider: {
          getIdentity: async () => musyrifIdentity,
          getActiveAssignments: async () => [musyrifAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authDeny.decision, "DENY");
      assert.strictEqual(authDeny.code, "SCOPE_MISMATCH");

      // 2. Gate 8 Production Readiness Check
      const assignments = createUatAssignments({
        overridePosCode: "MUSYRIF_TAHFIZH",
        overridePatch: (base) => ({
          ...base,
          unitId: "hlq-unit-1",
          scopedUnits: [],
        }),
      });

      const mockDb = createDefaultMockDb(assignments, {
        santriFindFirst: async (args: any) => {
          if (args?.where?.halaqohId === "hlq-unit-1") {
            return null; // Mismatched: no active santri in anchor unit hlq-unit-1
          }
          return { id: "san-default", halaqohId: "ou-default", status: "AKTIF" };
        },
        santriFindMany: async () => [
          { id: "san-diff-2", halaqohId: "hlq-different-99", status: "AKTIF" },
        ],
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("SCOPE_MISMATCH") && userGate.details.includes("tahfizh.target.manage"),
        `Expected SCOPE_MISMATCH for tahfizh.target.manage, got: ${userGate.details}`
      );
    });

    it("5.5 Proof 5: keasramaan.permission.read (ASSIGNED_UNITS): resource outside assigned asrama unit => DENY (SCOPE_MISMATCH) & Gate 8 NOT_READY", async () => {
      // 1. Runtime authorizeCanonical evaluation
      const keasramaanIdentity = {
        userId: "usr-asrama-op",
        username: "asrama.op",
        accountType: "PERSONAL" as const,
        staffId: "stf-asrama-op",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Petugas Asrama Putra",
      };
      const keasramaanAssignment = {
        id: "asg-asr-1",
        userId: "usr-asrama-op",
        positionId: "pos-asr-op",
        positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        unitId: "asr-putra-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [{ unitId: "asr-putra-1" }],
        scopedUnits: [{ unitId: "asr-putra-1", unit: { id: "asr-putra-1", isActive: true } }],
        positionCapabilities: [
          {
            capabilityCode: "keasramaan.permission.read",
            scopeType: "ASSIGNED_UNITS" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authDeny = await authorizeCanonical({
        identity: keasramaanIdentity,
        capability: "keasramaan.permission.read",
        resolvedContext: {
          resourceId: "perm-outside-1",
          orgUnitIds: ["asr-putri-2"], // Outside unit
          orgDomain: "KEASRAMAAN",
        },
        dataProvider: {
          getIdentity: async () => keasramaanIdentity,
          getActiveAssignments: async () => [keasramaanAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authDeny.decision, "DENY");
      assert.strictEqual(authDeny.code, "SCOPE_MISMATCH");

      // 2. Gate 8 Production Readiness Check
      const assignments = createUatAssignments({
        overridePosCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        overridePatch: (base) => ({
          ...base,
          unitId: "asr-putra-1",
          scopedUnits: [{ unitId: "asr-putra-1", unit: { id: "asr-putra-1", isActive: true } }],
        }),
      });

      const mockDb = createDefaultMockDb(assignments, {
        placementFindFirst: async (args: any) => {
          if (args?.where?.kamarId?.in?.includes("asr-putra-1")) {
            return null; // No active placement in permitted unit
          }
          return { id: "skp-default", kamarId: "asr-putra-1", santriId: "san-1", isActive: true, santri: { status: "AKTIF" } };
        },
        placementFindMany: async () => [
          { id: "skp-outside", kamarId: "asr-putri-2", santriId: "san-2", isActive: true, santri: { status: "AKTIF" } },
        ],
      });

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("SCOPE_MISMATCH") && userGate.details.includes("keasramaan.permission.read"),
        `Expected SCOPE_MISMATCH for keasramaan.permission.read, got: ${userGate.details}`
      );
    });

    it("5.6 Proof 6: keasramaan.permission.read (ASSIGNED_UNITS): resource inside assigned asrama unit with VERIFIED_PRODUCTION => ALLOW & Gate 8 READY", async () => {
      // 1. Runtime authorizeCanonical evaluation
      const keasramaanIdentity = {
        userId: "usr-asrama-op",
        username: "asrama.op",
        accountType: "PERSONAL" as const,
        staffId: "stf-asrama-op",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Petugas Asrama Putra",
      };
      const keasramaanAssignment = {
        id: "asg-asr-1",
        userId: "usr-asrama-op",
        positionId: "pos-asr-op",
        positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        unitId: "asr-putra-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [{ unitId: "asr-putra-1" }],
        scopedUnits: [{ unitId: "asr-putra-1", unit: { id: "asr-putra-1", isActive: true } }],
        positionCapabilities: [
          {
            capabilityCode: "keasramaan.permission.read",
            scopeType: "ASSIGNED_UNITS" as const,
            businessRuleState: "VERIFIED_PRODUCTION" as const,
          },
        ],
      };

      const authAllow = await authorizeCanonical({
        identity: keasramaanIdentity,
        capability: "keasramaan.permission.read",
        resolvedContext: {
          resourceId: "perm-inside-1",
          orgUnitIds: ["asr-putra-1"],
          orgDomain: "KEASRAMAAN",
        },
        dataProvider: {
          getIdentity: async () => keasramaanIdentity,
          getActiveAssignments: async () => [keasramaanAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authAllow.decision, "ALLOW");
      assert.strictEqual(authAllow.code, "ALLOWED");

      // 2. Gate 8 Production Readiness Check
      const assignments = createUatAssignments({
        overridePosCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        overridePatch: (base) => ({
          ...base,
          unitId: "asr-putra-1",
          scopedUnits: [{ unitId: "asr-putra-1", unit: { id: "asr-putra-1", isActive: true } }],
        }),
      });

      const mockDb = createDefaultMockDb(assignments);

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "READY");
    });

    it("5.7 Proof 7: APPROVED_TARGET_PENDING_TECHNICAL confers zero runtime authority => TARGET_POLICY_READY: true, RUNTIME_NOT_READY: POLICY_APPROVED_NOT_RUNTIME_ACTIVE", async () => {
      // 1. Production Readiness Check: target policy definition matches, but state is APPROVED_TARGET_PENDING_TECHNICAL
      const assignments = createUatAssignments({
        defaultBusinessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      });

      const mockDb = createDefaultMockDb(assignments);

      const report = await checkPendidikanV2ProductionReadiness(mockDb as any);
      const userGate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(userGate);
      assert.strictEqual(userGate.status, "NOT_READY");
      assert.ok(
        userGate.details.includes("TARGET_POLICY_READY, RUNTIME_NOT_READY"),
        `Expected TARGET_POLICY_READY, RUNTIME_NOT_READY, got: ${userGate.details}`
      );
      assert.ok(
        userGate.details.includes("POLICY_APPROVED_NOT_RUNTIME_ACTIVE"),
        `Expected POLICY_APPROVED_NOT_RUNTIME_ACTIVE, got: ${userGate.details}`
      );

      // 2. Runtime authorizeCanonical evaluation strictly denies when grant is not VERIFIED_PRODUCTION
      const targetIdentity = {
        userId: "usr-pending-target",
        username: "pending.target",
        accountType: "PERSONAL" as const,
        staffId: "stf-pending",
        staffStatus: "AKTIF",
        status: "AKTIF",
        name: "Pending Target Staff",
      };
      const pendingAssignment = {
        id: "asg-pending-1",
        userId: "usr-pending-target",
        positionId: "pos-pending",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        unitId: "ou-tahfizh-1",
        status: "ACTIVE" as const,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        scopeUnits: [{ unitId: "ou-tahfizh-1" }],
        scopedUnits: [{ unitId: "ou-tahfizh-1", unit: { id: "ou-tahfizh-1", isActive: true } }],
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "ASSIGNED_UNITS" as const,
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
          },
        ],
      };

      const authRes = await authorizeCanonical({
        identity: targetIdentity,
        capability: "tahfizh.reward.issue",
        resolvedContext: {
          resourceId: "rw-inside-1",
          orgUnitIds: ["ou-tahfizh-1"],
          orgDomain: "TAHFIZH",
        },
        dataProvider: {
          getIdentity: async () => targetIdentity,
          getActiveAssignments: async () => [pendingAssignment] as any,
          getUnitAccountPlacement: async () => null,
          resolveResourceContext: async () => null,
          verifyHumanExecutor: async () => null,
        },
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(
        authRes.code,
        "CAPABILITY_NOT_GRANTED",
        "APPROVED_TARGET_PENDING_TECHNICAL must confer zero runtime authority"
      );
    });

    it("5.8 Proof 8: exact CANONICAL_UAT_TARGET_POLICIES matches UAT_ACTIVATION_TARGETS definitions with no legacy aliases", () => {
      // 1. Exact count is 5 (POT tahfizh.reward.issue removed per Gate 5 owner mandate)
      assert.strictEqual(CANONICAL_UAT_TARGET_POLICIES.length, 5, "Must have exactly 5 canonical UAT target policies");

      // 2. Build expected list directly from UAT_ACTIVATION_TARGETS
      const expectedPolicies = [
        {
          positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.positionCode,
          capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].capabilityCode,
          expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].scopeType,
          expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].businessRuleState,
        },
        {
          positionCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.positionCode,
          capabilityCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.capabilityCode,
          expectedScope: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.scopeType,
          expectedBusinessState: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.businessRuleState,
        },
        {
          positionCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.positionCode,
          capabilityCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.capabilityCode,
          expectedScope: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.scopeType,
          expectedBusinessState: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.businessRuleState,
        },
        {
          positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.positionCode,
          capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].capabilityCode,
          expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].scopeType,
          expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].businessRuleState,
        },
        {
          positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.positionCode,
          capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].capabilityCode,
          expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].scopeType,
          expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].businessRuleState,
        },
      ];

      for (let i = 0; i < expectedPolicies.length; i++) {
        const actual = CANONICAL_UAT_TARGET_POLICIES[i];
        const exp = expectedPolicies[i];
        assert.strictEqual(actual.positionCode, exp.positionCode);
        assert.strictEqual(actual.capabilityCode, exp.capabilityCode);
        assert.strictEqual(actual.expectedScope, exp.expectedScope);
        assert.strictEqual(actual.expectedBusinessState, exp.expectedBusinessState);
      }

      // 3. Explicitly verify NO invalid/unapproved policy names are present
      const allCapabilityCodes = CANONICAL_UAT_TARGET_POLICIES.map((p) => p.capabilityCode);
      assert.ok(!allCapabilityCodes.includes("keasramaan.perizinan.approve" as any), "keasramaan.perizinan.approve must NOT be in canonical UAT targets");
      assert.ok(!allCapabilityCodes.includes("health.record.write" as any), "health.record.write must NOT be in canonical UAT targets");
      assert.ok(!allCapabilityCodes.includes("tahfizh.halaqoh.manage" as any), "tahfizh.halaqoh.manage must NOT be in canonical UAT targets");
      assert.ok(!allCapabilityCodes.includes("tahfizh.reward.issue" as any), "tahfizh.reward.issue must NOT be in canonical UAT targets");
    });
  });

  // =========================================================================
  // 6. REAL DATABASE RESOURCE SCOPE CLOSURE PROOFS (A THROUGH J)
  // =========================================================================
  describe("6. Real Database Resource Scope Closure Proofs", () => {
    const OU_S6_HLQ_A = "ou-s6-hlq-a";
    const OU_S6_HLQ_B = "ou-s6-hlq-b";
    const OU_S6_HLQ_C = "ou-s6-hlq-c";
    const OU_S6_HLQ_EMPTY = "ou-s6-hlq-empty";
    const OU_S6_KMR_1 = "ou-s6-kmr-1";
    const OU_S6_KMR_2 = "ou-s6-kmr-2";

    const POS_S6_OP_TAHFIZH = "pos-s6-op-tahfizh";
    const POS_S6_MUSYRIF = "pos-s6-musyrif";
    const POS_S6_OP_ASR = "pos-s6-op-asr";

    const STF_S6_OP_TAHFIZH = "stf-s6-op-tahfizh";
    const USR_S6_OP_TAHFIZH = "usr-s6-op-tahfizh";

    const STF_S6_MUSYRIF = "stf-s6-musyrif";
    const USR_S6_MUSYRIF = "usr-s6-musyrif";

    const STF_S6_SCOPED = "stf-s6-scoped";
    const USR_S6_SCOPED = "usr-s6-scoped";

    const STF_S6_EMPTY = "stf-s6-empty";
    const USR_S6_EMPTY = "usr-s6-empty";

    const STF_S6_OP_ASR = "stf-s6-op-asr";
    const USR_S6_OP_ASR = "usr-s6-op-asr";

    const SAN_S6_A = "san-s6-a";
    const SAN_S6_B = "san-s6-b";
    const SAN_S6_C = "san-s6-c";
    const SAN_S6_KMR_1 = "san-s6-kmr-1";
    const SAN_S6_KMR_2 = "san-s6-kmr-2";

    before(async () => {
      // 1. OrgUnits
      await prisma.orgUnit.createMany({
        data: [
          { id: OU_S6_HLQ_A, code: "OU-S6-HLQ-A", name: "Halaqoh S6 A", type: "HALAQOH", domain: "TAHFIZH", genderComplex: "PUTRA", isActive: true },
          { id: OU_S6_HLQ_B, code: "OU-S6-HLQ-B", name: "Halaqoh S6 B", type: "HALAQOH", domain: "TAHFIZH", genderComplex: "PUTRA", isActive: true },
          { id: OU_S6_HLQ_C, code: "OU-S6-HLQ-C", name: "Halaqoh S6 C", type: "HALAQOH", domain: "TAHFIZH", genderComplex: "PUTRA", isActive: true },
          { id: OU_S6_HLQ_EMPTY, code: "OU-S6-HLQ-EMPTY", name: "Halaqoh S6 Empty", type: "HALAQOH", domain: "TAHFIZH", genderComplex: "PUTRA", isActive: true },
          { id: OU_S6_KMR_1, code: "OU-S6-KMR-1", name: "Kamar S6 1", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
          { id: OU_S6_KMR_2, code: "OU-S6-KMR-2", name: "Kamar S6 2", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
        ],
      });

      // 2. Positions
      await prisma.position.upsert({
        where: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
        update: {},
        create: { id: POS_S6_OP_TAHFIZH, code: "PETUGAS_OPERASIONAL_TAHFIZH", name: "Petugas Operasional Tahfizh", domain: "TAHFIZH" },
      });
      await prisma.position.upsert({
        where: { code: "MUSYRIF_TAHFIZH" },
        update: {},
        create: { id: POS_S6_MUSYRIF, code: "MUSYRIF_TAHFIZH", name: "Musyrif Tahfizh", domain: "TAHFIZH" },
      });
      await prisma.position.upsert({
        where: { code: "PETUGAS_OPERASIONAL_KEASRAMAAN" },
        update: {},
        create: { id: POS_S6_OP_ASR, code: "PETUGAS_OPERASIONAL_KEASRAMAAN", name: "Petugas Operasional Keasramaan", domain: "KEASRAMAAN" },
      });

      const posOpTahfizh = await prisma.position.findUniqueOrThrow({ where: { code: "PETUGAS_OPERASIONAL_TAHFIZH" } });
      const posMusyrif = await prisma.position.findUniqueOrThrow({ where: { code: "MUSYRIF_TAHFIZH" } });
      const posOpAsr = await prisma.position.findUniqueOrThrow({ where: { code: "PETUGAS_OPERASIONAL_KEASRAMAAN" } });

      // 3. Capabilities & PositionCapabilities
      const testCaps = [
        { code: "tahfizh.reward.issue", posId: posOpTahfizh.id, scope: "ASSIGNED_UNITS", domain: "TAHFIZH" },
        { code: "tahfizh.target.manage", posId: posMusyrif.id, scope: "HALAQOH", domain: "TAHFIZH" },
        { code: "keasramaan.permission.read", posId: posOpAsr.id, scope: "ASSIGNED_UNITS", domain: "KEASRAMAAN" },
        { code: "keasramaan.permission.create", posId: posOpAsr.id, scope: "ASSIGNED_UNITS", domain: "KEASRAMAAN" },
      ];

      for (const cap of testCaps) {
        await prisma.capability.upsert({
          where: { code: cap.code },
          update: {},
          create: { code: cap.code, name: cap.code, namespace: cap.domain as any, description: cap.code },
        });
        await prisma.positionCapability.upsert({
          where: { positionId_capabilityCode: { positionId: cap.posId, capabilityCode: cap.code } },
          update: { scopeType: cap.scope as any, businessRuleState: "VERIFIED_PRODUCTION" },
          create: {
            positionId: cap.posId,
            capabilityCode: cap.code,
            scopeType: cap.scope as any,
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        });
      }

      // 4. Staff
      await prisma.staff.createMany({
        data: [
          { id: STF_S6_OP_TAHFIZH, staffCode: "STF-S6-01", nama: "Ust. S6 Tahfizh Op", noHp: "081200000001", roleStaff: "MT", status: "AKTIF" },
          { id: STF_S6_MUSYRIF, staffCode: "STF-S6-02", nama: "Ust. S6 Musyrif", noHp: "081200000002", roleStaff: "MT", status: "AKTIF" },
          { id: STF_S6_SCOPED, staffCode: "STF-S6-03", nama: "Ust. S6 Scoped", noHp: "081200000003", roleStaff: "MT", status: "AKTIF" },
          { id: STF_S6_EMPTY, staffCode: "STF-S6-04", nama: "Ust. S6 Empty", noHp: "081200000004", roleStaff: "MT", status: "AKTIF" },
          { id: STF_S6_OP_ASR, staffCode: "STF-S6-05", nama: "Ust. S6 Asrama Op", noHp: "081200000005", roleStaff: "MK", status: "AKTIF" },
        ],
      });

      // 5. Users
      await prisma.user.createMany({
        data: [
          { id: USR_S6_OP_TAHFIZH, username: "s6.op.tahfizh", staffId: STF_S6_OP_TAHFIZH, status: "AKTIF", role: "MT", passwordHash: "dummy" },
          { id: USR_S6_MUSYRIF, username: "s6.musyrif", staffId: STF_S6_MUSYRIF, status: "AKTIF", role: "MT", passwordHash: "dummy" },
          { id: USR_S6_SCOPED, username: "s6.scoped", staffId: STF_S6_SCOPED, status: "AKTIF", role: "MT", passwordHash: "dummy" },
          { id: USR_S6_EMPTY, username: "s6.empty", staffId: STF_S6_EMPTY, status: "AKTIF", role: "MT", passwordHash: "dummy" },
          { id: USR_S6_OP_ASR, username: "s6.op.asrama", staffId: STF_S6_OP_ASR, status: "AKTIF", role: "MK", passwordHash: "dummy" },
        ],
      });

      // 6. Assignments
      await prisma.assignment.createMany({
        data: [
          { id: "asg-s6-op-tahfizh", userId: USR_S6_OP_TAHFIZH, positionId: posOpTahfizh.id, unitId: OU_S6_HLQ_A, status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: USR_S6_OP_TAHFIZH },
          { id: "asg-s6-musyrif", userId: USR_S6_MUSYRIF, positionId: posMusyrif.id, unitId: OU_S6_HLQ_A, status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: USR_S6_MUSYRIF },
          { id: "asg-s6-scoped", userId: USR_S6_SCOPED, positionId: posOpTahfizh.id, unitId: OU_S6_HLQ_A, status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: USR_S6_SCOPED },
          { id: "asg-s6-empty", userId: USR_S6_EMPTY, positionId: posMusyrif.id, unitId: OU_S6_HLQ_EMPTY, status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: USR_S6_EMPTY },
          { id: "asg-s6-op-asr", userId: USR_S6_OP_ASR, positionId: posOpAsr.id, unitId: OU_S6_KMR_1, status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: USR_S6_OP_ASR },
        ],
      });

      // 7. AssignmentScopeUnit (Real Prisma relation)
      await prisma.assignmentScopeUnit.create({
        data: {
          assignmentId: "asg-s6-scoped",
          unitId: OU_S6_HLQ_B,
        },
      });

      // 7b. Halaqoh (Required for Santri foreign key)
      await prisma.halaqoh.createMany({
        data: [
          { id: OU_S6_HLQ_A, halaqohCode: "HLQ-S6-A", nama: "Halaqoh S6 A", pembinaId: STF_S6_MUSYRIF, tahunAjaran: "2026/2027", status: "AKTIF" },
          { id: OU_S6_HLQ_B, halaqohCode: "HLQ-S6-B", nama: "Halaqoh S6 B", pembinaId: STF_S6_MUSYRIF, tahunAjaran: "2026/2027", status: "AKTIF" },
          { id: OU_S6_HLQ_C, halaqohCode: "HLQ-S6-C", nama: "Halaqoh S6 C", pembinaId: STF_S6_MUSYRIF, tahunAjaran: "2026/2027", status: "AKTIF" },
          { id: OU_S6_HLQ_EMPTY, halaqohCode: "HLQ-S6-EMPTY", nama: "Halaqoh S6 Empty", pembinaId: STF_S6_MUSYRIF, tahunAjaran: "2026/2027", status: "AKTIF" },
        ],
      });

      // 8. Santri
      await prisma.santri.createMany({
        data: [
          { id: SAN_S6_A, nis: "SAN-S6-001", nama: "Santri S6 A", kelas: "7A", jenisKelamin: "L", status: "AKTIF", halaqohId: OU_S6_HLQ_A },
          { id: SAN_S6_B, nis: "SAN-S6-002", nama: "Santri S6 B", kelas: "7A", jenisKelamin: "L", status: "AKTIF", halaqohId: OU_S6_HLQ_B },
          { id: SAN_S6_C, nis: "SAN-S6-003", nama: "Santri S6 C", kelas: "7A", jenisKelamin: "L", status: "AKTIF", halaqohId: OU_S6_HLQ_C },
          { id: SAN_S6_KMR_1, nis: "SAN-S6-004", nama: "Santri S6 Kamar 1", kelas: "7A", jenisKelamin: "L", status: "AKTIF" },
          { id: SAN_S6_KMR_2, nis: "SAN-S6-005", nama: "Santri S6 Kamar 2", kelas: "7A", jenisKelamin: "L", status: "AKTIF" },
        ],
      });

      // 9. SantriKamarPlacement (Real Prisma relation)
      await prisma.santriKamarPlacement.createMany({
        data: [
          { id: "skp-s6-1", santriId: SAN_S6_KMR_1, kamarId: OU_S6_KMR_1, isActive: true },
          { id: "skp-s6-2", santriId: SAN_S6_KMR_2, kamarId: OU_S6_KMR_2, isActive: true },
        ],
      });
    });

    it("6.1 Proof A: tahfizh.reward.issue ASSIGNED_UNITS: Assignment scope Halaqoh A, target santri in Halaqoh A => ALLOW", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_OP_TAHFIZH, username: "s6.op.tahfizh", accountType: "PERSONAL", status: "AKTIF" },
        capability: "tahfizh.reward.issue",
        resourceContext: { santriId: SAN_S6_A },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "ALLOW");
      assert.strictEqual(auth.code, "ALLOWED");
      assert.strictEqual(auth.scopeType, "ASSIGNED_UNITS");
    });

    it("6.2 Proof B: Same assignment: target santri in Halaqoh B => DENY / SCOPE_MISMATCH", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_OP_TAHFIZH, username: "s6.op.tahfizh", accountType: "PERSONAL", status: "AKTIF" },
        capability: "tahfizh.reward.issue",
        resourceContext: { santriId: SAN_S6_B },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "DENY");
      assert.strictEqual(auth.code, "SCOPE_MISMATCH");
    });

    it("6.3 Proof C: tahfizh.target.manage HALAQOH: own Halaqoh A => ALLOW", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_MUSYRIF, username: "s6.musyrif", accountType: "PERSONAL", status: "AKTIF" },
        capability: "tahfizh.target.manage",
        resourceContext: { santriId: SAN_S6_A },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "ALLOW");
      assert.strictEqual(auth.code, "ALLOWED");
      assert.strictEqual(auth.scopeType, "HALAQOH");
    });

    it("6.4 Proof D: tahfizh.target.manage HALAQOH: cross Halaqoh B => DENY / SCOPE_MISMATCH", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_MUSYRIF, username: "s6.musyrif", accountType: "PERSONAL", status: "AKTIF" },
        capability: "tahfizh.target.manage",
        resourceContext: { santriId: SAN_S6_B },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "DENY");
      assert.strictEqual(auth.code, "SCOPE_MISMATCH");
    });

    it("6.5 Proof E: tahfizh.reward.issue ASSIGNED_UNITS using AssignmentScopeUnit: anchor Halaqoh A, scoped Halaqoh B, target santri in B => ALLOW", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_SCOPED, username: "s6.scoped", accountType: "PERSONAL", status: "AKTIF" },
        capability: "tahfizh.reward.issue",
        resourceContext: { santriId: SAN_S6_B },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "ALLOW");
      assert.strictEqual(auth.code, "ALLOWED");
      assert.strictEqual(auth.scopeType, "ASSIGNED_UNITS");
    });

    it("6.6 Proof F: Target santri in Halaqoh C (outside anchor + scoped set) => DENY / SCOPE_MISMATCH", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_SCOPED, username: "s6.scoped", accountType: "PERSONAL", status: "AKTIF" },
        capability: "tahfizh.reward.issue",
        resourceContext: { santriId: SAN_S6_C },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "DENY");
      assert.strictEqual(auth.code, "SCOPE_MISMATCH");
    });

    it("6.7 Proof G: Assignment with anchor unit having zero active santri => TARGET_RESOURCE_SCOPE_NOT_READY", async () => {
      const count = await prisma.santri.count({ where: { halaqohId: OU_S6_HLQ_EMPTY } });
      assert.strictEqual(count, 0, "Empty halaqoh must have zero santri");

      // Full required position coverage where MUSYRIF_TAHFIZH is assigned to empty halaqoh
      const assignments = createUatAssignments({
        overridePosCode: "MUSYRIF_TAHFIZH",
        overridePatch: (base) => ({
          ...base,
          unitId: OU_S6_HLQ_EMPTY,
          scopedUnits: [],
        }),
      });

      const report = await checkPendidikanV2ProductionReadiness({
        assignment: { findMany: async () => assignments },
        positionCapability: { findMany: async () => [] },
        santri: prisma.santri,
        santriKamarPlacement: prisma.santriKamarPlacement,
      } as any);

      const gate = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate);
      assert.strictEqual(gate.status, "NOT_READY");
      assert.ok(
        gate.details.includes("TARGET_RESOURCE_SCOPE_NOT_READY") || gate.details.includes("SCOPE_MISMATCH"),
        `Expected TARGET_RESOURCE_SCOPE_NOT_READY or SCOPE_MISMATCH for empty anchor unit, got: ${gate.details}`
      );
    });

    it("6.8 Proof H: Keasramaan target: actual active SantriKamarPlacement in permitted unit => ALLOW", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_OP_ASR, username: "s6.op.asrama", accountType: "PERSONAL", status: "AKTIF" },
        capability: "keasramaan.permission.read",
        resourceContext: { santriId: SAN_S6_KMR_1 },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "ALLOW");
      assert.strictEqual(auth.code, "ALLOWED");
      assert.strictEqual(auth.scopeType, "ASSIGNED_UNITS");
    });

    it("6.9 Proof I: Keasramaan target: active SantriKamarPlacement outside assigned unit => DENY / SCOPE_MISMATCH", async () => {
      const auth = await authorizeCanonical({
        identity: { userId: USR_S6_OP_ASR, username: "s6.op.asrama", accountType: "PERSONAL", status: "AKTIF" },
        capability: "keasramaan.permission.read",
        resourceContext: { santriId: SAN_S6_KMR_2 },
        dataProvider,
      });
      assert.strictEqual(auth.decision, "DENY");
      assert.strictEqual(auth.code, "SCOPE_MISMATCH");
    });

    it("6.10 Proof J: Call checkPendidikanV2ProductionReadiness(prisma) on real PostgreSQL and assert Gate 8 fails closed", async () => {
      const report = await checkPendidikanV2ProductionReadiness(prisma);
      assert.ok(report);
      assert.ok(Array.isArray(report.gates));
      assert.strictEqual(report.gates.length, CANONICAL_READINESS_GATE_NAMES.length);

      const gate8 = report.gates.find((g) => g.gate === "USER_ASSIGNMENTS_READY");
      assert.ok(gate8);
      assert.strictEqual(gate8.status, "NOT_READY");
      assert.ok(gate8.details.length > 0);
      assert.notStrictEqual(report.overallStatus, "READY", "Production readiness must not be READY when gates are NOT_READY or BLOCKED");
    });
  });
});
