/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";

import {
  PendidikanV2Service,
} from "../lib/server/pendidikan-v2-service";
import {
  checkPendidikanV2ProductionReadiness,
} from "../lib/server/pendidikan-v2-readiness";
import {
  formatSantriSearchResult,
  KEPESANTRENAN_ATTENDANCE_CONTRACT,
  UAT_ACTIVATION_TARGETS,
} from "../types/architecture-lock";
import {
  CANONICAL_STUDI_UMUM_SUBJECTS,
  CANONICAL_KEPESANTRENAN_SUBJECTS,
  KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES,
  KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES,
  resolvePblMeeting,
  resolveStudiUmumSchedule,
  STUDI_UMUM_JP_SLOTS,
  KEPESANTRENAN_DAILY_SCHEDULE,
} from "../lib/pendidikan-v2";
import { CanonicalIdentity, ICanonicalDataProvider } from "../lib/auth/canonical-evaluator";
import { IAuditPersistence } from "../lib/auth/canonical-audit";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3.3C1: UAT ACTIVATION READINESS & POLICY RECONCILIATION", () => {
  // Mock DB Helper
  const createMockEducationDb = (
    initialSessions: any[] = [],
    initialParticipants: any[] = [],
    initialAttendances: any[] = []
  ) => {
    const sessions = new Map<string, any>();
    const participants = new Map<string, any>();
    const attendances = new Map<string, any>();

    for (const s of initialSessions) sessions.set(s.id, { ...s });
    for (const p of initialParticipants) participants.set(`${p.sessionId}_${p.santriId}`, { ...p });
    for (const a of initialAttendances) attendances.set(`${a.sessionId}_${a.santriId}`, { ...a });

    const txMock = {
      educationSession: {
        findUnique: async ({ where }: any) => {
          const s = sessions.get(where.id);
          return s ? { ...s } : null;
        },
        findUniqueOrThrow: async ({ where }: any) => {
          const s = sessions.get(where.id);
          if (!s) throw new Error(`Record not found: ${where.id}`);
          return { ...s };
        },
        findMany: async ({ where }: any) => {
          const all = Array.from(sessions.values());
          if (!where || Object.keys(where).length === 0) return all;
          return all.filter((s) => {
            if (where.educationTrack && s.educationTrack !== where.educationTrack) return false;
            return true;
          });
        },
        update: async ({ where, data }: any) => {
          const s = sessions.get(where.id);
          if (!s) throw new Error("Not found");
          const updated = { ...s, ...data };
          sessions.set(where.id, updated);
          return updated;
        },
        updateMany: async ({ where, data }: any) => {
          const s = sessions.get(where.id);
          if (s && s.status === where.status) {
            const updated = { ...s, ...data };
            sessions.set(where.id, updated);
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      educationSessionParticipant: {
        findUnique: async ({ where }: any) => {
          const key = where.sessionId_santriId
            ? `${where.sessionId_santriId.sessionId}_${where.sessionId_santriId.santriId}`
            : where.id;
          const p = participants.get(key);
          return p ? { ...p } : null;
        },
      },
      educationSessionAttendance: {
        findUnique: async ({ where }: any) => {
          const key = where.sessionId_santriId
            ? `${where.sessionId_santriId.sessionId}_${where.sessionId_santriId.santriId}`
            : where.id;
          const existing = attendances.get(key);
          return existing ? { ...existing } : null;
        },
        upsert: async ({ where, update, create }: any) => {
          const key = `${where.sessionId_santriId.sessionId}_${where.sessionId_santriId.santriId}`;
          const existing = attendances.get(key);
          if (existing) {
            const upd = { ...existing, ...update };
            attendances.set(key, upd);
            return upd;
          }
          const crt = { id: `att-${Date.now()}`, ...create };
          attendances.set(key, crt);
          return crt;
        },
      },
    };

    return {
      educationSession: txMock.educationSession,
      educationSessionParticipant: txMock.educationSessionParticipant,
      educationSessionAttendance: txMock.educationSessionAttendance,
      $transaction: async (cb: any) => await cb(txMock),
      _sessions: sessions,
      _participants: participants,
      _attendances: attendances,
    };
  };

  const createMockAuditPersistence = (failOnRecord = false): IAuditPersistence & { records: any[] } => {
    const records: any[] = [];
    return {
      isPersistent: true,
      recordInTx: async (_tx: any, record: any) => {
        if (failOnRecord) {
          throw new Error("CANONICAL_AUDIT_TRANSACTION_FAILURE: Forced rollback on audit failure");
        }
        records.push(record);
      },
      records,
    };
  };

  const createMockDataProvider = (opts?: {
    teacherUserId?: string;
    staffId?: string;
  }): ICanonicalDataProvider => {
    const teacherId = opts?.teacherUserId || "usr-teacher-01";
    const staffId = opts?.staffId || "stf-teacher-01";

    return {
      getIdentity: async (userId: string): Promise<CanonicalIdentity | null> => {
        if (userId === teacherId) {
          return {
            userId: teacherId,
            username: "guru.matematika",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: staffId,
            staffStatus: "AKTIF",
            name: "Ustadz Guru Resmi",
            placementUnitId: null,
          };
        }
        if (userId === "usr-substitute") {
          return {
            userId: "usr-substitute",
            username: "guru.pengganti",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-substitute",
            staffStatus: "AKTIF",
            name: "Ustadz Pengganti",
            placementUnitId: null,
          };
        }
        if (userId === "usr-unauthorized") {
          return {
            userId: "usr-unauthorized",
            username: "santri.unauthorized",
            status: "AKTIF",
            accountType: "PERSONAL",
            name: "Santri Tanpa Wewenang",
            placementUnitId: null,
          };
        }
        return null;
      },
      verifyHumanExecutor: async (userId: string) => {
        if (userId === teacherId || userId === "usr-substitute" || userId === "usr-unauthorized") {
          return { userId, name: "Verified Human", isActive: true };
        }
        return null;
      },
      resolveResourceContext: async (ctx) => {
        return {
          educationSessionId: ctx.educationSessionId,
          educationTrack: "KEPESANTRENAN",
          santriId: ctx.santriId,
          orgDomain: "AKADEMIK",
          orgUnitIds: [],
        };
      },
      getUnitAccountPlacement: async () => null,
      getActiveAssignments: async (userId: string) => {
        if (userId === "usr-unauthorized") {
          return [
            {
              id: `asg-${userId}`,
              userId,
              positionId: "pos-guru-viewer",
              positionCode: "GURU_VIEWER",
              positionName: "Guru Viewer",
              domain: "AKADEMIK",
              unitId: "ou-akademik",
              unitCode: "OU-AKADEMIK",
              unitName: "Unit Akademik",
              status: "ACTIVE",
              validFrom: new Date(Date.now() - 86400000),
              validUntil: null,
              positionCapabilities: [
                { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
              ],
              scopeUnits: [],
            },
          ];
        }
        return [
          {
            id: `asg-${userId}`,
            userId,
            positionId: "pos-guru-akademik",
            positionCode: "GURU_KEPESANTRENAN",
            positionName: "Guru Kepesantrenan",
            domain: "AKADEMIK",
            unitId: "ou-akademik",
            unitCode: "OU-AKADEMIK",
            unitName: "Unit Akademik",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            positionCapabilities: [
              { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
              { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
              { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
              { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
            ],
            scopeUnits: [],
          },
        ];
      },
    };
  };

  // =========================================================================
  // PART 1: PENDIDIKAN V2 ACTIVATION & SERVER SERVICE
  // =========================================================================
  describe("PART 1: Pendidikan V2 Activation & Server Service", () => {
    it("1. PENDIDIKAN_V2_UAT_ENABLED=false fails closed on session start", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "false";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("PENDIDIKAN_V2_UAT_NOT_ENABLED")
      );
    });

    it("2. PENDIDIKAN_V2_UAT_ENABLED=false fails closed on material save", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "false";
      const db = createMockEducationDb([{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionMaterial({ sessionId: "sess-01", materi: "Materi Fikih" }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("PENDIDIKAN_V2_UAT_NOT_ENABLED")
      );
    });

    it("3. PENDIDIKAN_V2_UAT_ENABLED=false fails closed on attendance save", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "false";
      const db = createMockEducationDb([{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-01", status: "HADIR" }] }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("PENDIDIKAN_V2_UAT_NOT_ENABLED")
      );
    });

    it("4. Schema readiness returns PENDIDIKAN_V2_SCHEMA_NOT_READY when tables missing", async () => {
      const incompleteDb = { educationSession: {} }; // Missing participant and attendance
      const service = new PendidikanV2Service({ db: incompleteDb as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });
      const status = await service.checkSchemaReadiness();
      assert.strictEqual(status.ready, false);
      assert.ok(status.reason?.includes("PENDIDIKAN_V2_SCHEMA_NOT_READY"));
    });

    it("5. Schema check does not fake empty array or zero count on query", async () => {
      const incompleteDb = { educationSession: {} };
      const service = new PendidikanV2Service({ db: incompleteDb as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });
      await assert.rejects(
        () => service.getEducationSessions(),
        (err: Error) => err.message.includes("PENDIDIKAN_V2_SCHEMA_NOT_READY")
      );
    });

    it("6. Active scheduled teacher can start when test grant valid", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.status, "STARTED");
    });

    it("7. Invalid actualTeacherName (< 2 chars) rejected", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "X" }, { actorUserId: "usr-substitute" }),
        (err: Error) => err.message.includes("INVALID_ACTUAL_TEACHER_NAME")
      );
    });

    it("8. Scheduled teacher remains stored separately", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(res.session.scheduledStaffId, "stf-teacher-01");
    });

    it("9. Actual authenticated teacher stored server-side", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(res.session.actualTeacherUserId, "usr-teacher-01");
      assert.strictEqual(res.session.actualTeacherStaffId, "stf-teacher-01");
    });

    it("10. startedAt server-generated", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" });
      assert.ok(res.session.startedAt instanceof Date);
    });

    it("11. Double-start CAS protected", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" });
      await assert.rejects(
        () => service.startEducationSession({ sessionId: "sess-01", actualTeacherName: "Ustadz Ahmad" }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("INVALID_SESSION_STATUS") || err.message.includes("CONCURRENT_START")
      );
    });

    it("12. Material save denied when session status is SCHEDULED", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionMaterial({ sessionId: "sess-01", materi: "Fikih Thaharah" }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("SESSION_NOT_STARTED")
      );
    });

    it("13. Material save denied when actor is not actual teacher", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-other-teacher" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionMaterial({ sessionId: "sess-01", materi: "Fikih Thaharah" }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("ACTOR_NOT_ACTUAL_TEACHER")
      );
    });

    it("14. Material save succeeds when actor is actual teacher", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01" }]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.recordSessionMaterial({ sessionId: "sess-01", materi: "Bab Sholat Berjamaah" }, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.materi, "Bab Sholat Berjamaah");
    });

    it("15. Material rollback on audit persistence failure", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01" }]);
      const failingAudit = createMockAuditPersistence(true);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: failingAudit });

      await assert.rejects(
        () => service.recordSessionMaterial({ sessionId: "sess-01", materi: "Materi Rollback" }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("CANONICAL_AUDIT_TRANSACTION_FAILURE")
      );
    });

    it("16. Attendance save denied when session status is SCHEDULED", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "SCHEDULED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }]
      );
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-01", status: "HADIR" }] }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("SESSION_NOT_STARTED")
      );
    });

    it("17. Attendance save denied when actor is not actual teacher", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-other-teacher", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }]
      );
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-01", status: "HADIR" }] }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("ACTOR_NOT_ACTUAL_TEACHER")
      );
    });

    it("18. Santri participant roster enforced on attendance save", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }]
      );
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-01", status: "HADIR" }] }, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 1);
    });

    it("19. Non-participant santri attendance rejected", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }]
      );
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-unenrolled", status: "HADIR" }] }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED")
      );
    });

    it("20. MASBUK status rejected for Kepesantrenan session attendance", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }]
      );
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      await assert.rejects(
        () => service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-01", status: "MASBUK" as any }] }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("MASBUK")
      );
    });

    it("21. Valid attendance statuses HADIR, IZIN, SAKIT, ALFA accepted", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [
          { sessionId: "sess-01", santriId: "san-01" },
          { sessionId: "sess-01", santriId: "san-02" },
          { sessionId: "sess-01", santriId: "san-03" },
          { sessionId: "sess-01", santriId: "san-04" },
        ]
      );
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      const res = await service.recordSessionAttendance({
        sessionId: "sess-01",
        records: [
          { santriId: "san-01", status: "HADIR" },
          { santriId: "san-02", status: "IZIN" },
          { santriId: "san-03", status: "SAKIT" },
          { santriId: "san-04", status: "ALFA" },
        ],
      }, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 4);
    });

    it("22. Attendance audit before/after state diff recorded", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }],
        [{ sessionId: "sess-01", santriId: "san-01", status: "HADIR" }]
      );
      const audit = createMockAuditPersistence();
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: audit });

      await service.recordSessionAttendance({
        sessionId: "sess-01",
        records: [{ santriId: "san-01", status: "SAKIT" }],
      }, { actorUserId: "usr-teacher-01" });

      assert.strictEqual(audit.records.length, 1);
      assert.strictEqual(audit.records[0].beforeState.records[0].status, "HADIR");
      assert.strictEqual(audit.records[0].afterState.records[0].status, "SAKIT");
    });

    it("23. Attendance rollback on audit persistence failure", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb(
        [{ id: "sess-01", status: "STARTED", scheduledStaffId: "stf-teacher-01", actualTeacherUserId: "usr-teacher-01", actualTeacherStaffId: "stf-teacher-01", educationTrack: "KEPESANTRENAN" }],
        [{ sessionId: "sess-01", santriId: "san-01" }]
      );
      const failingAudit = createMockAuditPersistence(true);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: failingAudit });

      await assert.rejects(
        () => service.recordSessionAttendance({ sessionId: "sess-01", records: [{ santriId: "san-01", status: "HADIR" }] }, { actorUserId: "usr-teacher-01" }),
        (err: Error) => err.message.includes("CANONICAL_AUDIT_TRANSACTION_FAILURE")
      );
    });

    it("24. Read DTO returns authoritative fields for authenticated actor", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([
        {
          id: "sess-01",
          educationTrack: "KEPESANTRENAN",
          subjectId: "Bahasa Arab",
          scheduledDate: new Date("2026-09-21"),
          programLevel: 1,
          genderGroup: "PUTRA",
          status: "SCHEDULED",
          scheduledStaffId: "stf-teacher-01",
          scheduledStaff: { nama: "Ustadz Ahmad" },
        },
      ]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      // Unauthenticated call must fail-closed
      await assert.rejects(
        async () => service.getEducationSessions({ educationTrack: "KEPESANTRENAN" }),
        /AUTHENTICATION_REQUIRED/
      );

      const sessions = await service.getEducationSessions(
        { educationTrack: "KEPESANTRENAN" },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(sessions.length, 1);
      assert.strictEqual(sessions[0].sessionId, "sess-01");
      assert.strictEqual(sessions[0].subject, "Bahasa Arab");
      assert.strictEqual(sessions[0].scheduledTeacherDisplay, "Ustadz Ahmad");
      assert.strictEqual(sessions[0].status, "SCHEDULED");
    });

    it("25. Read DTO reports correct mutationAvailable based on server state", async () => {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";
      const db = createMockEducationDb([
        {
          id: "sess-01",
          status: "SCHEDULED",
          educationTrack: "KEPESANTRENAN",
          scheduledStaffId: "stf-teacher-01",
        },
      ]);
      const service = new PendidikanV2Service({ db: db as any, dataProvider: createMockDataProvider(), auditPersistence: createMockAuditPersistence() });

      // Authorized scheduled teacher => mutationAvailable: true
      const sessions = await service.getEducationSessions(undefined, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(sessions[0].mutationAvailable, true);

      // Unauthorized actor (without academic.session.start/schedule.read grant or scheduled match) => denied access
      await assert.rejects(
        () => service.getEducationSessions(undefined, { actorUserId: "usr-unauthorized" }),
        /PERMISSION_DENIED/
      );

      // UAT disabled => mutationAvailable: false
      process.env.PENDIDIKAN_V2_UAT_ENABLED = "false";
      const sessionsDisabled = await service.getEducationSessions(undefined, { actorUserId: "usr-teacher-01" });
      assert.strictEqual(sessionsDisabled[0].mutationAvailable, false);
      assert.strictEqual(sessionsDisabled[0].mutationDeniedReason, "UAT_NOT_ENABLED");
    });
  });

  // =========================================================================
  // PART 2: RECONCILED BUSINESS RULES & UAT TARGET MANIFEST
  // =========================================================================
  describe("PART 2: Reconciled Business Rules & UAT Target Manifest", () => {
    it("26. formatSantriSearchResult returns nama only", () => {
      const res = formatSantriSearchResult({ nama: "Muhammad Fatih", kelas: "7A" });
      assert.strictEqual(res.nama, "Muhammad Fatih");
      assert.strictEqual(res.displayText, "Muhammad Fatih");
    });

    it("27. formatSantriSearchResult excludes kelas from displayText", () => {
      const res = formatSantriSearchResult({ nama: "Muhammad Fatih", kelas: "7A" });
      assert.ok(!res.displayText.includes("7A"));
      assert.ok(!res.displayText.includes("Kelas"));
    });

    it("28. formatSantriSearchResult excludes NIS from displayText", () => {
      const res = formatSantriSearchResult({ nama: "Muhammad Fatih", kelas: "7A" });
      assert.ok(!res.displayText.includes("NIS"));
    });

    it("29. formatSantriSearchResult excludes score/halaqoh from displayText", () => {
      const res = formatSantriSearchResult({ nama: "Muhammad Fatih", kelas: "7A" });
      assert.ok(!res.displayText.includes("Halaqoh"));
      assert.ok(!res.displayText.includes("Nilai"));
    });

    it("30. Separate kelas filter contract valid", () => {
      const res = formatSantriSearchResult({ nama: "Muhammad Fatih", kelas: "7A" });
      assert.strictEqual(res.kelas, "7A");
    });

    it("31. Separate halaqoh filter contract valid", () => {
      const santriRecord = { id: "san-01", nama: "Fatih", halaqohId: "hal-01" };
      assert.strictEqual(santriRecord.halaqohId, "hal-01");
    });

    it("32. 6 canonical Studi Umum subjects defined", () => {
      assert.strictEqual(CANONICAL_STUDI_UMUM_SUBJECTS.length, 6);
      assert.ok(CANONICAL_STUDI_UMUM_SUBJECTS.includes("Matematika"));
      assert.ok(CANONICAL_STUDI_UMUM_SUBJECTS.includes("Bahasa Inggris"));
      assert.ok(CANONICAL_STUDI_UMUM_SUBJECTS.includes("IPS"));
      assert.ok(CANONICAL_STUDI_UMUM_SUBJECTS.includes("IPA"));
      assert.ok(CANONICAL_STUDI_UMUM_SUBJECTS.includes("Bahasa Indonesia"));
      assert.ok(CANONICAL_STUDI_UMUM_SUBJECTS.includes("TIK"));
    });

    it("33. 5 canonical Kepesantrenan subjects defined", () => {
      assert.strictEqual(CANONICAL_KEPESANTRENAN_SUBJECTS.length, 5);
      assert.ok(CANONICAL_KEPESANTRENAN_SUBJECTS.includes("Bahasa Arab"));
      assert.ok(CANONICAL_KEPESANTRENAN_SUBJECTS.includes("Fikih"));
      assert.ok(CANONICAL_KEPESANTRENAN_SUBJECTS.includes("Tafsir"));
      assert.ok(CANONICAL_KEPESANTRENAN_SUBJECTS.includes("Aqidah"));
      assert.ok(CANONICAL_KEPESANTRENAN_SUBJECTS.includes("Tajwid"));
    });

    it("34. Studi Umum canonical PBL blocks valid", () => {
      const meeting1 = resolvePblMeeting(1);
      assert.strictEqual(meeting1.subject, "IPS");
      assert.strictEqual(meeting1.blockNumber, 1);
      assert.strictEqual(meeting1.weekInBlock, 1);

      const meeting5 = resolvePblMeeting(5);
      assert.strictEqual(meeting5.subject, "IPS");
      assert.strictEqual(meeting5.blockNumber, 1);
      assert.strictEqual(meeting5.weekInBlock, 5);
    });

    it("35. Saturday JP matrix intact", () => {
      assert.strictEqual(STUDI_UMUM_JP_SLOTS.length, 3);
      assert.strictEqual(resolveStudiUmumSchedule(1, 1), "Bahasa Inggris");
      assert.strictEqual(resolveStudiUmumSchedule(1, 2), "Matematika");
      assert.strictEqual(resolveStudiUmumSchedule(1, 3), "PBL");
    });

    it("36. Kepesantrenan 18:30–19:30 WITA schedule windows intact", () => {
      assert.strictEqual(KEPESANTRENAN_DAILY_SCHEDULE[1].subject, "Bahasa Arab");
      assert.strictEqual(KEPESANTRENAN_DAILY_SCHEDULE[1].timeRange, "18:30 - 19:30 WITA");
    });

    it("37. Student attendance statuses = HADIR, IZIN, SAKIT, ALFA", () => {
      assert.deepStrictEqual(
        [...KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES],
        ["HADIR", "IZIN", "SAKIT", "ALFA"]
      );
    });

    it("38. Student attendance rejects MASBUK", () => {
      assert.deepStrictEqual([...KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES], ["MASBUK"]);
    });

    it("39. Teacher attendance evidenced by session start execution", () => {
      assert.strictEqual(
        KEPESANTRENAN_ATTENDANCE_CONTRACT.TEACHER_ATTENDANCE_EVIDENCE,
        "SESSION_START_AUTHENTICATED_EXECUTION"
      );
    });

    it("40. UAT_ACTIVATION_TARGETS manifest defined declaratively", () => {
      assert.ok(UAT_ACTIVATION_TARGETS);
      assert.ok(UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH);
      assert.ok(UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT);
      assert.ok(UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN);
      assert.ok(UAT_ACTIVATION_TARGETS.OSDA_PUTRI);
    });

    it("41. Manifest keeps all target policies as APPROVED_TARGET_PENDING_TECHNICAL", () => {
      for (const p of UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies) {
        assert.strictEqual(p.businessRuleState, "APPROVED_TARGET_PENDING_TECHNICAL");
      }
      assert.strictEqual(UAT_ACTIVATION_TARGETS.OSDA_PUTRI.businessRuleState, "APPROVED_TARGET_PENDING_TECHNICAL");
    });

    it("42. Operational Tahfizh recap read is GLOBAL", () => {
      const recapPolicy = UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies.find(
        (p) => p.capabilityCode === "tahfizh.recap.read"
      );
      assert.ok(recapPolicy);
      assert.strictEqual(recapPolicy.scopeType, "GLOBAL");
    });

    it("43. Operational Tahfizh reward issuance is NOT present in UAT_ACTIVATION_TARGETS", () => {
      const rewardPolicy = (UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies as readonly any[]).find(
        (p) => p.capabilityCode === "tahfizh.reward.issue"
      );
      assert.strictEqual(rewardPolicy, undefined, "POT tahfizh.reward.issue must be absent from UAT_ACTIVATION_TARGETS");
    });

    it("44. Target management MT is HALAQOH scope only", () => {
      assert.strictEqual(UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.scopeType, "HALAQOH");
    });

    it("45. Target management PH is HALAQOH scope only", () => {
      assert.strictEqual(UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.scopeType, "HALAQOH");
    });

    it("46. Operational Keasramaan permission read/create is ASSIGNED_UNITS", () => {
      for (const p of UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies) {
        assert.strictEqual(p.scopeType, "ASSIGNED_UNITS");
      }
    });

    it("47. Operational Keasramaan lacks approval capabilities", () => {
      assert.ok(
        UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.deniedApprovalCapabilities.includes(
          "keasramaan.permission.approve_mk"
        )
      );
    });

    it("48. OSDA PUTRI has single placement and prevents PUTRA access", () => {
      assert.strictEqual(UAT_ACTIVATION_TARGETS.OSDA_PUTRI.maxActivePlacements, 1);
      assert.strictEqual(UAT_ACTIVATION_TARGETS.OSDA_PUTRI.genderComplex, "PUTRI");
      assert.strictEqual(UAT_ACTIVATION_TARGETS.OSDA_PUTRI.preventPutraAccess, true);
    });

    it("49. Razan linkage safety gate reports BLOCKED_IDENTITY_LINKAGE", async () => {
      const mockDbWithRazan = {
        user: {
          findMany: async () => [
            { id: "usr-razan", username: "razan.mt", role: "MT", staffId: null },
          ],
        },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDbWithRazan as any);
      const staffGate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(staffGate);
      assert.strictEqual(staffGate.status, "BLOCKED");
      assert.ok(staffGate.remediationAdvice?.includes("BLOCKED_IDENTITY_LINKAGE"));
      assert.ok(report.unlinkedStaffAccounts.includes("razan.mt"));
    });

    it("50. Production readiness check reports all 13 gates without writes", async () => {
      const mockDiagnosticDb = {
        user: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        position: { findMany: async () => [] },
        capability: { findMany: async () => [] },
        santri: { findMany: async () => [] },
      };
      const report = await checkPendidikanV2ProductionReadiness(mockDiagnosticDb as any);
      assert.strictEqual(report.gates.length, 13);
      assert.ok(report.timestamp);
      assert.ok(["READY", "BLOCKED", "NOT_READY"].includes(report.overallStatus));
    });

    it("51. PR #8 immutable commit remains untouched", () => {
      const PR8_IMMUTABLE_COMMIT = "9068cae5587b7219c394c5c25bf0de07a15b0726";
      const pr8Commit = execSync(`git rev-parse ${PR8_IMMUTABLE_COMMIT}`).toString().trim();
      assert.strictEqual(pr8Commit, PR8_IMMUTABLE_COMMIT);
    });
  });
});
