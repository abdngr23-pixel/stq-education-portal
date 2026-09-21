/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GURU_KEPESANTRENAN_POSITION_CONTRACT,
  UAT_ACTIVATION_TARGETS,
} from "../types/architecture-lock";
import { CANONICAL_POSITION_CODES, LEGACY_ROLE_MAP } from "../lib/auth/compatibility";
import {
  type CanonicalIdentity,
  type CanonicalAssignmentWithDetails,
  type ICanonicalDataProvider,
} from "../lib/auth/canonical-evaluator";
import {
  evaluateKepesantrenanAcademicAuthPolicies,
  evaluateStalePositionCapabilityPolicy,
  KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES,
  KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES,
  CANONICAL_UAT_TARGET_POLICIES,
  APPROVED_UAT_TARGET_CAPABILITY_CODES,
  checkPendidikanV2ProductionReadiness,
} from "../lib/server/pendidikan-v2-readiness";
import {
  PendidikanV2Service,
  validateKepesantrenanTeacherGrant,
} from "../lib/server/pendidikan-v2-service";
import { generateCanonicalBaselineCapabilities } from "../lib/auth/backfill-dry-run";

describe("GATE 5 — RUNTIME AUTHORIZATION REMEDIATION TEST SUITE (24 SCENARIOS)", () => {
  // Helper to create a mock data provider for canonical authorization
  function createMockDataProvider(opts: {
    identities?: Record<string, CanonicalIdentity>;
    assignments?: Record<string, CanonicalAssignmentWithDetails[]>;
  }): ICanonicalDataProvider {
    const identities = opts.identities || {};
    const assignments = opts.assignments || {};

    return {
      getIdentity: async (userId: string) => identities[userId] || null,
      getActiveAssignments: async (userId: string) => assignments[userId] || [],
      getUnitAccountPlacement: async () => null,
      verifyHumanExecutor: async () => null,
      resolveResourceContext: async (requested: any) => ({
        orgUnitIds: ["ou-root"],
        educationSessionId: requested.educationSessionId,
      }),
    };
  }

  // 1. Legacy role without GURU_KEPESANTRENAN cannot start Kepesantrenan
  it("1. Legacy role without GURU_KEPESANTRENAN cannot start Kepesantrenan", async () => {
    const actorId = "user-legacy-mt";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.legacy",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-legacy",
          staffStatus: "AKTIF",
          name: "Ustadz Legacy",
        },
      },
      assignments: {
        [actorId]: [],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-1",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tahfidz",
      status: "SCHEDULED",
      scheduledStaffId: "stf-legacy",
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        updateMany: async () => ({ count: 1 }),
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-1", actualTeacherName: "Ustadz Legacy" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("CANONICAL_AUTHORIZATION_DENIED") ||
          err.message.includes("CAPABILITY_NOT_GRANTED"),
          `Expected denial but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 2. GURU_KEPESANTRENAN with ACTIVE assignment but PC not VERIFIED_PRODUCTION => DENY
  it("2. GURU_KEPESANTRENAN with ACTIVE assignment but PC not VERIFIED_PRODUCTION => DENY", async () => {
    const actorId = "user-guru-pending";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.pending",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-pending",
          staffStatus: "AKTIF",
          name: "Ustadz Pending",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-2",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tahfidz",
      status: "SCHEDULED",
      scheduledStaffId: "stf-pending",
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        updateMany: async () => ({ count: 1 }),
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-2", actualTeacherName: "Ustadz Pending" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("CANONICAL_AUTHORIZATION_DENIED") ||
          err.message.includes("STATE_NOT_VERIFIED") ||
          err.message.includes("CAPABILITY_NOT_GRANTED"),
          `Expected denial due to unverified PC but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 3. VERIFIED GURU_KEPESANTRENAN actor assigned to scheduled session => start ALLOW
  it("3. VERIFIED GURU_KEPESANTRENAN actor assigned to scheduled session => start ALLOW", async () => {
    const actorId = "user-guru-verified";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.verified",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-verified",
          staffStatus: "AKTIF",
          name: "Ustadz Verified",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    let updatedData: any = null;
    const sessionRecord: any = {
      id: "ses-kep-3",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tahfidz",
      status: "SCHEDULED",
      scheduledStaffId: "stf-verified",
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        findUniqueOrThrow: async () => sessionRecord,
        updateMany: async ({ data }: any) => {
          updatedData = data;
          Object.assign(sessionRecord, data, { status: "STARTED" });
          return { count: 1 };
        },
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      canonicalAuditLog: { create: async () => ({}) },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    const result = await service.startEducationSession(
      { sessionId: "ses-kep-3", actualTeacherName: "Ustadz Verified" },
      { actorUserId: actorId }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.session.status, "STARTED");
    assert.strictEqual(updatedData.actualTeacherUserId, actorId);
    assert.strictEqual(updatedData.actualTeacherStaffId, "stf-verified");
    assert.strictEqual(updatedData.actualTeacherName, "Ustadz Verified");
  });

  // 4. VERIFIED teacher attempts another Staff's scheduled session => DENY
  it("4. VERIFIED teacher attempts another Staff's scheduled session => DENY", async () => {
    const actorId = "user-guru-a";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.a",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-a",
          staffStatus: "AKTIF",
          name: "Ustadz A",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-4",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tahfidz",
      status: "SCHEDULED",
      scheduledStaffId: "stf-b", // Scheduled for teacher B, not teacher A
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        updateMany: async () => ({ count: 1 }),
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-4", actualTeacherName: "Ustadz A" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("KEPESANTRENAN_SCHEDULED_TEACHER_MISMATCH"),
          `Expected KEPESANTRENAN_SCHEDULED_TEACHER_MISMATCH but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 5. Teacher with missing staffId => DENY
  it("5. Teacher with missing staffId => DENY", async () => {
    const actorId = "user-orphan-guru";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.orphan",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: null, // No Staff linkage
          name: "Ustadz Orphan",
        },
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-5",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tahfidz",
      status: "SCHEDULED",
      scheduledStaffId: "stf-any",
    };

    const mockDb: any = {
      educationSession: { findUnique: async () => sessionRecord },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-5", actualTeacherName: "Ustadz Orphan" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("TEACHER_STAFF_LINKAGE_REQUIRED"),
          `Expected TEACHER_STAFF_LINKAGE_REQUIRED but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 6. Session with missing scheduledStaffId => DENY
  it("6. Session with missing scheduledStaffId => DENY", async () => {
    const actorId = "user-guru-6";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.six",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-6",
          staffStatus: "AKTIF",
          name: "Ustadz Six",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-6",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tahfidz",
      status: "SCHEDULED",
      scheduledStaffId: null, // Missing scheduled staff
      scheduledTeacherAssignment: null,
    };

    const mockDb: any = {
      educationSession: { findUnique: async () => sessionRecord },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-6", actualTeacherName: "Ustadz Six" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("KEPESANTRENAN_SCHEDULED_TEACHER_REQUIRED"),
          `Expected KEPESANTRENAN_SCHEDULED_TEACHER_REQUIRED but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 7. Teacher A cannot read Teacher B Kepesantrenan schedule row
  it("7. Teacher A cannot read Teacher B Kepesantrenan schedule row", async () => {
    const actorId = "user-teacher-a";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.a",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-a",
          staffStatus: "AKTIF",
          name: "Ustadz A",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.schedule.read",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionsInDb = [
      {
        id: "ses-a",
        educationTrack: "KEPESANTRENAN",
        subjectId: "sub-1",
        status: "SCHEDULED",
        scheduledStaffId: "stf-a",
        subject: { nama: "Tahfidz A" },
        scheduledStaff: { nama: "Ustadz A" },
        participants: [],
      },
      {
        id: "ses-b",
        educationTrack: "KEPESANTRENAN",
        subjectId: "sub-1",
        status: "SCHEDULED",
        scheduledStaffId: "stf-b", // Belongs to Teacher B
        subject: { nama: "Tahfidz B" },
        scheduledStaff: { nama: "Ustadz B" },
        participants: [],
      },
      {
        id: "ses-umum",
        educationTrack: "STUDI_UMUM",
        subjectId: "sub-mat",
        status: "SCHEDULED",
        scheduledStaffId: null,
        subject: { nama: "Matematika" },
        scheduledStaff: null,
        participants: [],
      },
    ];

    const mockDb: any = {
      educationSession: {
        findMany: async () => sessionsInDb,
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    const dtos = await service.getEducationSessions({}, { actorUserId: actorId });

    // Session B must NOT be visible to Teacher A
    const sessionIds = dtos.map((d: any) => d.sessionId);
    assert.ok(sessionIds.includes("ses-a"), "Teacher A's session must be visible");
    assert.ok(!sessionIds.includes("ses-b"), "Teacher B's session must NOT be visible to Teacher A");
  });

  // 8. Teacher A cannot record material for Teacher B session
  it("8. Teacher A cannot record material for Teacher B session", async () => {
    const actorId = "user-teacher-a";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.a",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-a",
          staffStatus: "AKTIF",
          name: "Ustadz A",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.material.record",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-started-by-b",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-1",
      status: "STARTED",
      actualTeacherUserId: "user-teacher-b",
      actualTeacherStaffId: "stf-b",
      actualTeacherName: "Ustadz B",
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        update: async () => sessionRecord,
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.recordSessionMaterial(
          { sessionId: "ses-started-by-b", materi: "Bab Tajwid Baru" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("ACTOR_NOT_ACTUAL_TEACHER"),
          `Expected ACTOR_NOT_ACTUAL_TEACHER but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 9. Teacher A cannot record attendance for Teacher B session
  it("9. Teacher A cannot record attendance for Teacher B session", async () => {
    const actorId = "user-teacher-a";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.a",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-a",
          staffStatus: "AKTIF",
          name: "Ustadz A",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.attendance.record",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-started-by-b",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-1",
      status: "STARTED",
      actualTeacherUserId: "user-teacher-b",
      actualTeacherStaffId: "stf-b",
      actualTeacherName: "Ustadz B",
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.recordSessionAttendance(
          { sessionId: "ses-started-by-b", records: [{ santriId: "san-1", status: "HADIR" }] },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("ACTOR_NOT_ACTUAL_TEACHER"),
          `Expected ACTOR_NOT_ACTUAL_TEACHER but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 10. Started session records server-authoritative actualTeacherUserId and actualTeacherStaffId
  it("10. Started session records server-authoritative actualTeacherUserId and actualTeacherStaffId", async () => {
    const actorId = "user-authoritative";
    const staffId = "stf-authoritative";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.authoritative",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: staffId,
          staffStatus: "AKTIF",
          name: "Ustadz Authoritative",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    let updatePayload: any = null;
    const sessionRecord: any = {
      id: "ses-auth-10",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-1",
      status: "SCHEDULED",
      scheduledStaffId: staffId,
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        findUniqueOrThrow: async () => sessionRecord,
        updateMany: async ({ data }: any) => {
          updatePayload = data;
          Object.assign(sessionRecord, data, { status: "STARTED" });
          return { count: 1 };
        },
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      canonicalAuditLog: { create: async () => ({}) },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    await service.startEducationSession(
      { sessionId: "ses-auth-10", actualTeacherName: "Ustadz Authoritative" },
      { actorUserId: actorId }
    );

    assert.strictEqual(updatePayload.actualTeacherUserId, actorId);
    assert.strictEqual(updatePayload.actualTeacherStaffId, staffId);
    assert.strictEqual(updatePayload.startedByUserId, actorId);
  });

  // 11. Kepesantrenan client-provided actualTeacherName cannot impersonate another Staff
  it("11. Kepesantrenan client-provided actualTeacherName cannot impersonate another Staff", async () => {
    const actorId = "user-real-teacher";
    const staffId = "stf-real";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.real",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: staffId,
          staffStatus: "AKTIF",
          name: "Ustadz Asli",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-1",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    let updatePayload: any = null;
    const sessionRecord: any = {
      id: "ses-impersonate-11",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-1",
      status: "SCHEDULED",
      scheduledStaffId: staffId,
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        findUniqueOrThrow: async () => sessionRecord,
        updateMany: async ({ data }: any) => {
          updatePayload = data;
          Object.assign(sessionRecord, data, { status: "STARTED" });
          return { count: 1 };
        },
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      canonicalAuditLog: { create: async () => ({}) },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    // Client maliciously passes a different teacher's name
    await service.startEducationSession(
      { sessionId: "ses-impersonate-11", actualTeacherName: "Ustadz Palsu Impersonator" },
      { actorUserId: actorId }
    );

    // Client-supplied name MUST be ignored; server uses identity name
    assert.strictEqual(updatePayload.actualTeacherName, "Ustadz Asli");
    assert.notStrictEqual(updatePayload.actualTeacherName, "Ustadz Palsu Impersonator");
  });

  // 12. Studi Umum manual actualTeacherName behavior remains unchanged
  it("12. Studi Umum manual actualTeacherName behavior remains unchanged", async () => {
    const actorId = "user-sub-ipa";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "subject.ipa",
          role: "GA",
          accountType: "SUBJECT",
          status: "AKTIF",
          staffId: null,
          name: "Akun Mapel IPA",
        },
      },
    });

    let updatePayload: any = null;
    const sessionRecord: any = {
      id: "ses-umum-12",
      educationTrack: "STUDI_UMUM",
      subjectId: "sub-ipa",
      status: "SCHEDULED",
      scheduledStaffId: null,
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        findUniqueOrThrow: async () => sessionRecord,
        updateMany: async ({ data }: any) => {
          updatePayload = data;
          Object.assign(sessionRecord, data, { status: "STARTED" });
          return { count: 1 };
        },
      },
      academicSubjectAccountBinding: {
        findUnique: async () => ({
          userId: actorId,
          subjectId: "sub-ipa",
          isActive: true,
        }),
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      canonicalAuditLog: { create: async () => ({}) },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    await service.startEducationSession(
      { sessionId: "ses-umum-12", actualTeacherName: "Budi Santoso, S.Pd" },
      { actorUserId: actorId }
    );

    // Studi umum preserves the manually entered human teacher name
    assert.strictEqual(updatePayload.actualTeacherName, "Budi Santoso, S.Pd");
    assert.strictEqual(updatePayload.startedByUserId, actorId);
  });

  // 13. Studi Umum SUBJECT binding authority remains unchanged
  it("13. Studi Umum SUBJECT binding authority remains unchanged", async () => {
    const actorId = "user-sub-mat";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "subject.matematika",
          role: "GA",
          accountType: "SUBJECT",
          status: "AKTIF",
          staffId: null,
          name: "Akun Mapel Matematika",
        },
      },
    });

    const sessionRecord: any = {
      id: "ses-umum-13",
      educationTrack: "STUDI_UMUM",
      subjectId: "sub-ipa", // Mismatch: user is bound to sub-matematika
      status: "SCHEDULED",
      scheduledStaffId: null,
    };

    const mockDb: any = {
      educationSession: { findUnique: async () => sessionRecord },
      academicSubjectAccountBinding: {
        findUnique: async () => ({
          userId: actorId,
          subjectId: "sub-matematika", // Bound to math, not IPA
          isActive: true,
        }),
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-umum-13", actualTeacherName: "Guru Matematika" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("SUBJECT_BINDING_MISMATCH"),
          `Expected SUBJECT_BINDING_MISMATCH but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // 14. Kepesantrenan owner policy manifest contains EXACTLY the 4 required capabilities
  it("14. Kepesantrenan owner policy manifest contains EXACTLY the 4 required capabilities", () => {
    assert.strictEqual(KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.length, 4);
    assert.strictEqual(KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES.length, 4);

    const expectedCaps = [
      "academic.schedule.read",
      "academic.session.start",
      "academic.material.record",
      "academic.attendance.record",
    ];

    for (const cap of expectedCaps) {
      assert.ok(
        KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES.includes(cap as any),
        `Required capabilities must include ${cap}`
      );
      const policy = KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.find(
        (p) => p.capabilityCode === cap
      );
      assert.ok(policy, `Approved manifest must include policy for ${cap}`);
      assert.strictEqual(policy?.positionCode, "GURU_KEPESANTRENAN");
      assert.strictEqual(policy?.scopeType, "GLOBAL");
    }
  });

  // 15. Partial academic manifest cannot READY
  it("15. Partial academic manifest cannot READY", () => {
    // Only 3 of 4 capabilities present in activePcs
    const activePcs = [
      {
        capabilityCode: "academic.schedule.read",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.session.start",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.material.record",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      // academic.attendance.record missing
    ];

    const result = evaluateKepesantrenanAcademicAuthPolicies(activePcs);
    assert.strictEqual(result.status, "NOT_READY");
    assert.ok(result.details.includes("academic.attendance.record"));
  });

  // 16. POT reward issue absent from approved target manifests
  it("16. POT reward issue absent from approved target manifests", () => {
    const potPolicies = UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies as readonly any[];
    const foundInTargets = potPolicies.find((p) => p.capabilityCode === "tahfizh.reward.issue");
    assert.strictEqual(foundInTargets, undefined, "POT tahfizh.reward.issue must be absent from UAT_ACTIVATION_TARGETS");

    const foundInCanonical = CANONICAL_UAT_TARGET_POLICIES.find(
      (p) => p.positionCode === "PETUGAS_OPERASIONAL_TAHFIZH" && p.capabilityCode === "tahfizh.reward.issue"
    );
    assert.strictEqual(foundInCanonical, undefined, "POT tahfizh.reward.issue must be absent from CANONICAL_UAT_TARGET_POLICIES");

    assert.ok(
      !APPROVED_UAT_TARGET_CAPABILITY_CODES.includes("tahfizh.reward.issue" as any),
      "tahfizh.reward.issue must not be in APPROVED_UAT_TARGET_CAPABILITY_CODES"
    );
  });

  // 17. POT recap read GLOBAL remains approved target
  it("17. POT recap read GLOBAL remains approved target", () => {
    const potPolicies = UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies;
    const recapPolicy = potPolicies.find((p) => p.capabilityCode === "tahfizh.recap.read");
    assert.ok(recapPolicy, "POT tahfizh.recap.read must be present");
    assert.strictEqual(recapPolicy?.scopeType, "GLOBAL");
    assert.strictEqual(recapPolicy?.businessRuleState, "APPROVED_TARGET_PENDING_TECHNICAL");
  });

  // 18. MUDIR reward issuance remains approved/verified
  it("18. MUDIR reward issuance remains approved/verified", () => {
    const baselineCaps = generateCanonicalBaselineCapabilities();
    const mudirReward = baselineCaps.find(
      (c) => c.positionCode === CANONICAL_POSITION_CODES.MUDIR && c.capabilityCode === "tahfizh.reward.issue"
    );
    assert.ok(mudirReward, "MUDIR must have tahfizh.reward.issue capability");
    assert.strictEqual(mudirReward?.businessRuleState, "VERIFIED_PRODUCTION");
    assert.strictEqual(mudirReward?.scopeType, "GLOBAL");
  });

  // 19. KABID_TAHFIZH reward issuance remains approved/verified
  it("19. KABID_TAHFIZH reward issuance remains approved/verified", () => {
    const baselineCaps = generateCanonicalBaselineCapabilities();
    const kabidReward = baselineCaps.find(
      (c) => c.positionCode === CANONICAL_POSITION_CODES.KABID_TAHFIZH && c.capabilityCode === "tahfizh.reward.issue"
    );
    assert.ok(kabidReward, "KABID_TAHFIZH must have tahfizh.reward.issue capability");
    assert.strictEqual(kabidReward?.businessRuleState, "VERIFIED_PRODUCTION");
    assert.strictEqual(kabidReward?.scopeType, "DOMAIN");
  });

  // 20. Stale POT reward row pending => stale-policy gate NOT_READY
  it("20. Stale POT reward row pending => stale-policy gate NOT_READY", () => {
    const staleRows = [
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "ASSIGNED_UNITS",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
      },
    ];

    const gateResult = evaluateStalePositionCapabilityPolicy(staleRows);
    assert.strictEqual(gateResult.status, "NOT_READY");
    assert.strictEqual(gateResult.blocking, true);
    assert.ok(gateResult.details.includes("STALE_POSITION_CAPABILITY_POLICY_REQUIRES_CLEANUP"));
    assert.ok(gateResult.details.includes("PETUGAS_OPERASIONAL_TAHFIZH / tahfizh.reward.issue"));
  });

  // 21. Stale POT reward row VERIFIED_PRODUCTION => stale-policy gate BLOCKED
  it("21. Stale POT reward row VERIFIED_PRODUCTION => stale-policy gate BLOCKED", () => {
    const staleRows = [
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "ASSIGNED_UNITS",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
      },
    ];

    const gateResult = evaluateStalePositionCapabilityPolicy(staleRows);
    assert.strictEqual(gateResult.status, "BLOCKED");
    assert.strictEqual(gateResult.blocking, true);
    assert.ok(gateResult.details.includes("UNAUTHORIZED_STALE_RUNTIME_AUTHORITY"));
    assert.ok(gateResult.details.includes("VERIFIED_PRODUCTION"));
  });

  // 22. Stale POT reward row absent => stale-policy gate READY
  it("22. Stale POT reward row absent => stale-policy gate READY", () => {
    const gateResult = evaluateStalePositionCapabilityPolicy([]);
    assert.strictEqual(gateResult.status, "READY");
    assert.strictEqual(gateResult.blocking, true);
    assert.ok(gateResult.details.includes("No stale PETUGAS_OPERASIONAL_TAHFIZH"));
  });

  // 23. Feature flag false still prevents mutation
  it("23. Feature flag false still prevents mutation", async () => {
    const origEnv = process.env.PENDIDIKAN_V2_UAT_ENABLED;
    process.env.PENDIDIKAN_V2_UAT_ENABLED = "false";

    try {
      const service = new PendidikanV2Service({ db: {} as any, dataProvider: {} as any });
      await assert.rejects(
        async () => {
          await service.startEducationSession(
            { sessionId: "ses-1", actualTeacherName: "Guru" },
            { actorUserId: "user-1" }
          );
        },
        (err: any) => {
          assert.ok(
            err.message.includes("PENDIDIKAN_V2_UAT_NOT_ENABLED"),
            `Expected PENDIDIKAN_V2_UAT_NOT_ENABLED but got: ${err.message}`
          );
          return true;
        }
      );
    } finally {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = origEnv;
    }
  });

  // 24. OSDA behavior unchanged and remains fail-closed
  it("24. OSDA behavior unchanged and remains fail-closed", () => {
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OSDA_PUTRI.businessRuleState,
      "APPROVED_TARGET_PENDING_TECHNICAL"
    );
    // OSDA cannot map to GURU_KEPESANTRENAN
    assert.notStrictEqual((LEGACY_ROLE_MAP as any).OSDA, "GURU_KEPESANTRENAN");
    // Position contract for GURU_KEPESANTRENAN is properly defined
    assert.strictEqual(GURU_KEPESANTRENAN_POSITION_CONTRACT.code, "GURU_KEPESANTRENAN");
    assert.strictEqual(GURU_KEPESANTRENAN_POSITION_CONTRACT.requiresPersonalAccount, true);
    assert.strictEqual(GURU_KEPESANTRENAN_POSITION_CONTRACT.isLeadership, false);
  });
});

describe("GATE 5 — ROUND 2 STRICT RUNTIME HARDENING TESTS (SCENARIOS A - L)", () => {
  function createMockDataProvider(opts: {
    identities?: Record<string, CanonicalIdentity>;
    assignments?: Record<string, CanonicalAssignmentWithDetails[]>;
  }): ICanonicalDataProvider {
    const identities = opts.identities || {};
    const assignments = opts.assignments || {};

    return {
      getIdentity: async (userId: string) => identities[userId] || null,
      getActiveAssignments: async (userId: string) => assignments[userId] || [],
      getUnitAccountPlacement: async () => null,
      verifyHumanExecutor: async () => null,
      resolveResourceContext: async (requested: any) => ({
        orgUnitIds: ["ou-root"],
        educationSessionId: requested.educationSessionId,
      }),
    };
  }

  // A. MUDIR with ACTIVE assignment + VERIFIED academic.session.start + scheduled Staff match => DENY because Position != GURU_KEPESANTRENAN
  it("A. MUDIR with ACTIVE assignment + VERIFIED academic.session.start + scheduled Staff match => DENY because Position != GURU_KEPESANTRENAN", async () => {
    const actorId = "user-mudir";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "mudir",
          role: "KS",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-mudir",
          staffStatus: "AKTIF",
          name: "Kyai Mudir",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-mudir",
            userId: actorId,
            positionId: "pos-mudir",
            positionCode: "MUDIR",
            positionName: "Mudir Pesantren",
            domain: "PESANTREN",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-a",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-fikih",
      status: "SCHEDULED",
      scheduledStaffId: "stf-mudir",
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
        updateMany: async () => ({ count: 1 }),
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-a", actualTeacherName: "Ustadz Guru" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("KEPESANTRENAN_GURU_POSITION_REQUIRED"),
          `Expected KEPESANTRENAN_GURU_POSITION_REQUIRED but got: ${err.message}`
        );
        return true;
      }
    );
  });

  // B. Other non-GURU Position with VERIFIED academic.schedule.read => cannot read Kepesantrenan session
  it("B. Other non-GURU Position with VERIFIED academic.schedule.read => cannot read Kepesantrenan session", async () => {
    const actorId = "user-musyrif-tahfizh";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "musyrif.tahfizh",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-musyrif",
          staffStatus: "AKTIF",
          name: "Musyrif Tahfizh",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-mt",
            userId: actorId,
            positionId: "pos-mt",
            positionCode: "MUSYRIF_TAHFIZH",
            positionName: "Musyrif Tahfizh",
            domain: "TAHFIZH",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.schedule.read",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-b",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-aqidah",
      status: "SCHEDULED",
      scheduledStaffId: "stf-musyrif", // even if scheduledStaffId happens to match
      scheduledDate: new Date("2026-09-21T08:00:00Z"),
    };

    const mockDb: any = {
      educationSession: {
        findMany: async () => [sessionRecord],
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    // Non-GURU position grant is rejected by validateKepesantrenanTeacherGrant
    await assert.rejects(
      async () => {
        await service.getEducationSessions(undefined, { actorUserId: actorId });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("PERMISSION_DENIED"),
          `Expected PERMISSION_DENIED because row was filtered out, got: ${err.message}`
        );
        return true;
      }
    );
  });

  // C. Teacher schedule read: scheduledStaff = other teacher, actualTeacherStaff = actor => row remains hidden
  it("C. Teacher schedule read: scheduledStaff = other teacher, actualTeacherStaff = actor => row remains hidden", async () => {
    const actorId = "user-guru-c";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.c",
          role: "MT",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-c",
          staffStatus: "AKTIF",
          name: "Ustadz C",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-c",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.schedule.read",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-c",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-tafsir",
      status: "STARTED",
      scheduledStaffId: "stf-other-teacher", // Other teacher scheduled
      actualTeacherStaffId: "stf-c",         // Actor is actualTeacherStaffId
      actualTeacherUserId: actorId,
      scheduledDate: new Date("2026-09-21T08:00:00Z"),
    };

    const mockDb: any = {
      educationSession: {
        findMany: async () => [sessionRecord],
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    // Enforce scheduled match only — actualTeacherStaffId match is removed as alternative
    await assert.rejects(
      async () => {
        await service.getEducationSessions(undefined, { actorUserId: actorId });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("PERMISSION_DENIED"),
          `Expected row to be hidden and throw PERMISSION_DENIED, got: ${err.message}`
        );
        return true;
      }
    );
  });

  // D. Material: actualTeacherUserId matches actor, actualTeacherStaffId = null => DENY
  it("D. Material: actualTeacherUserId matches actor, actualTeacherStaffId = null => DENY", async () => {
    const actorId = "user-guru-d";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.d",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-d",
          staffStatus: "AKTIF",
          name: "Ustadz D",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-d",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.material.record",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-d",
      educationTrack: "KEPESANTRENAN",
      status: "STARTED",
      actualTeacherUserId: actorId,
      actualTeacherStaffId: null, // Null staff id
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.recordSessionMaterial(
          { sessionId: "ses-kep-d", materi: "Bab 1: Fikih Thaharah" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("ACTOR_NOT_ACTUAL_TEACHER"),
          `Expected ACTOR_NOT_ACTUAL_TEACHER due to null actualTeacherStaffId, got: ${err.message}`
        );
        return true;
      }
    );
  });

  // E. Attendance: actualTeacherUserId matches actor, actualTeacherStaffId = null => DENY
  it("E. Attendance: actualTeacherUserId matches actor, actualTeacherStaffId = null => DENY", async () => {
    const actorId = "user-guru-e";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.e",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-e",
          staffStatus: "AKTIF",
          name: "Ustadz E",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-e",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.attendance.record",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-e",
      educationTrack: "KEPESANTRENAN",
      status: "STARTED",
      actualTeacherUserId: actorId,
      actualTeacherStaffId: null, // Null staff id
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => sessionRecord,
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(mockDb),
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });

    await assert.rejects(
      async () => {
        await service.recordSessionAttendance(
          { sessionId: "ses-kep-e", santriId: "san-1", status: "HADIR" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("ACTOR_NOT_ACTUAL_TEACHER"),
          `Expected ACTOR_NOT_ACTUAL_TEACHER due to null actualTeacherStaffId, got: ${err.message}`
        );
        return true;
      }
    );
  });

  // F. DTO materialAvailable false when actualTeacherStaffId missing
  it("F. DTO materialAvailable false when actualTeacherStaffId missing", async () => {
    const actorId = "user-guru-f";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.f",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-f",
          staffStatus: "AKTIF",
          name: "Ustadz F",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-f",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.schedule.read",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
              {
                capabilityCode: "academic.material.record",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-f",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-fikih",
      scheduledStaffId: "stf-f",
      status: "STARTED",
      actualTeacherUserId: actorId,
      actualTeacherStaffId: null, // missing
      scheduledDate: new Date("2026-09-21T08:00:00Z"),
    };

    const mockDb: any = {
      educationSession: {
        findMany: async () => [sessionRecord],
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    const dtos = await service.getEducationSessions(undefined, { actorUserId: actorId });

    assert.strictEqual(dtos.length, 1);
    assert.strictEqual(dtos[0].materialAvailable, false);
    assert.strictEqual(dtos[0].materialDeniedReason, "ACTOR_NOT_ACTUAL_TEACHER");
  });

  // G. DTO attendanceAvailable false when actualTeacherStaffId missing
  it("G. DTO attendanceAvailable false when actualTeacherStaffId missing", async () => {
    const actorId = "user-guru-g";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.g",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-g",
          staffStatus: "AKTIF",
          name: "Ustadz G",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-g",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.schedule.read",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
              {
                capabilityCode: "academic.attendance.record",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const sessionRecord: any = {
      id: "ses-kep-g",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-fikih",
      scheduledStaffId: "stf-g",
      status: "STARTED",
      actualTeacherUserId: actorId,
      actualTeacherStaffId: null, // missing
      scheduledDate: new Date("2026-09-21T08:00:00Z"),
    };

    const mockDb: any = {
      educationSession: {
        findMany: async () => [sessionRecord],
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
    };

    const service = new PendidikanV2Service({ db: mockDb, dataProvider });
    const dtos = await service.getEducationSessions(undefined, { actorUserId: actorId });

    assert.strictEqual(dtos.length, 1);
    assert.strictEqual(dtos[0].attendanceAvailable, false);
    assert.strictEqual(dtos[0].attendanceDeniedReason, "ACTOR_NOT_ACTUAL_TEACHER");
  });

  // H. Canonical ALLOW from wrong Position does not satisfy Kepesantrenan self-service
  it("H. Canonical ALLOW from wrong Position does not satisfy Kepesantrenan self-service", () => {
    const wrongDecision: any = {
      decision: "ALLOW",
      code: "SUCCESS",
      assignmentId: "asg-pot",
      positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
      capabilityCode: "academic.session.start",
      scopeType: "GLOBAL",
      grantUsed: {
        assignmentId: "asg-pot",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        capabilityCode: "academic.session.start",
        scopeType: "GLOBAL",
        anchorUnitId: "ou-root",
        unitIds: ["ou-root"],
        businessRuleState: "VERIFIED_PRODUCTION",
      },
    };

    assert.throws(
      () => {
        validateKepesantrenanTeacherGrant(wrongDecision, "academic.session.start");
      },
      (err: any) => {
        assert.ok(
          err.message.includes("KEPESANTRENAN_GURU_POSITION_REQUIRED"),
          `Expected KEPESANTRENAN_GURU_POSITION_REQUIRED, got: ${err.message}`
        );
        return true;
      }
    );
  });

  // I. Extra VERIFIED MUDIR academic policy + all four valid GURU policies => academic policy readiness BLOCKED
  it("I. Extra VERIFIED MUDIR academic policy + all four valid GURU policies => academic policy readiness BLOCKED", () => {
    const activePcs = [
      {
        capabilityCode: "academic.schedule.read",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.session.start",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.material.record",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.attendance.record",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      // Extra unapproved row with VERIFIED_PRODUCTION
      {
        capabilityCode: "academic.session.start",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "MUDIR", isActive: true },
      },
    ];

    const result = evaluateKepesantrenanAcademicAuthPolicies(activePcs);
    assert.strictEqual(result.status, "BLOCKED");
    assert.strictEqual(result.blocking, true);
    assert.ok(result.details.includes("UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY"));
    assert.ok(result.details.includes("MUDIR:academic.session.start:GLOBAL"));
  });

  // J. Extra pending unapproved academic policy => academic policy readiness NOT_READY
  it("J. Extra pending unapproved academic policy => academic policy readiness NOT_READY", () => {
    const activePcs = [
      {
        capabilityCode: "academic.schedule.read",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.session.start",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.material.record",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      {
        capabilityCode: "academic.attendance.record",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "GURU_KEPESANTRENAN", isActive: true },
      },
      // Extra unapproved row with APPROVED_TARGET_PENDING_TECHNICAL
      {
        capabilityCode: "academic.schedule.read",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "MUSYRIF_TAHFIZH", isActive: true },
      },
    ];

    const result = evaluateKepesantrenanAcademicAuthPolicies(activePcs);
    assert.strictEqual(result.status, "NOT_READY");
    assert.strictEqual(result.blocking, true);
    assert.ok(result.details.includes("UNAPPROVED_KEPESANTRENAN_ACADEMIC_POLICY_PRESENT"));
    assert.ok(result.details.includes("MUSYRIF_TAHFIZH:academic.schedule.read:GLOBAL"));
  });

  // K. Stale policy raw-query failure => never READY
  it("K. Stale policy raw-query failure => never READY", async () => {
    const mockDb: any = {
      $queryRawUnsafe: async (query: string) => {
        if (query.includes("tahfizh.reward.issue")) {
          throw new Error("DB_CONNECTION_TIMEOUT: Query timed out");
        }
        return [];
      },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDb);
    const staleGate = report.gates.find((g) => g.gate === "STALE_POSITION_CAPABILITY_POLICY_READY");

    assert.ok(staleGate, "Gate STALE_POSITION_CAPABILITY_POLICY_READY must be present");
    assert.notStrictEqual(staleGate?.status, "READY", "Gate must NEVER be READY on query failure");
    assert.strictEqual(staleGate?.status, "NOT_READY");
    assert.strictEqual(staleGate?.blocking, true);
    assert.ok(staleGate?.details.includes("DATABASE_QUERY_FAILED"));
  });

  // L. Schedule TOCTOU: pre-check A, transaction reload B => zero session mutation
  it("L. Schedule TOCTOU: pre-check A, transaction reload B => zero session mutation", async () => {
    const actorId = "user-guru-l";
    const dataProvider = createMockDataProvider({
      identities: {
        [actorId]: {
          userId: actorId,
          username: "ust.l",
          accountType: "PERSONAL",
          status: "AKTIF",
          staffId: "stf-l-a",
          staffStatus: "AKTIF",
          name: "Ustadz L",
        },
      },
      assignments: {
        [actorId]: [
          {
            id: "asg-l",
            userId: actorId,
            positionId: "pos-guru-kep",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-root",
            unitCode: "ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(2020, 1, 1),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    let updateCallCount = 0;
    let auditRecordCount = 0;

    // Initial read: Teacher A ("stf-l-a") is scheduled
    const initialSession: any = {
      id: "ses-kep-toctou",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-hadits",
      status: "SCHEDULED",
      scheduledStaffId: "stf-l-a",
    };

    // Transaction reload: Teacher B ("stf-l-b") is scheduled (concurrent schedule change)
    const inTxSession: any = {
      id: "ses-kep-toctou",
      educationTrack: "KEPESANTRENAN",
      subjectId: "sub-hadits",
      status: "SCHEDULED",
      scheduledStaffId: "stf-l-b", // Changed behind the back!
    };

    const mockDb: any = {
      educationSession: {
        findUnique: async () => initialSession,
      },
      educationSessionParticipant: { findMany: async () => [] },
      educationSessionAttendance: { findMany: async () => [] },
      $transaction: async (fn: any) => {
        const txDb: any = {
          educationSession: {
            findUnique: async () => inTxSession,
            updateMany: async () => {
              updateCallCount++;
              return { count: 1 };
            },
          },
          educationSessionParticipant: { findMany: async () => [] },
          educationSessionAttendance: { findMany: async () => [] },
        };
        return fn(txDb);
      },
    };

    const mockAuditPersistence = {
      recordInTx: async () => {
        auditRecordCount++;
      },
    };

    const service = new PendidikanV2Service({
      db: mockDb,
      dataProvider,
      auditPersistence: mockAuditPersistence as any,
    });

    await assert.rejects(
      async () => {
        await service.startEducationSession(
          { sessionId: "ses-kep-toctou", actualTeacherName: "Ustadz Guru" },
          { actorUserId: actorId }
        );
      },
      (err: any) => {
        assert.ok(
          err.message.includes("KEPESANTRENAN_SCHEDULED_TEACHER_MISMATCH"),
          `Expected KEPESANTRENAN_SCHEDULED_TEACHER_MISMATCH TOCTOU rejection, got: ${err.message}`
        );
        return true;
      }
    );

    // Verify ZERO mutation and ZERO audit write occurred
    assert.strictEqual(updateCallCount, 0, "Zero updateMany calls must occur on TOCTOU failure");
    assert.strictEqual(auditRecordCount, 0, "Zero audit records must be written on TOCTOU failure");
  });
});
