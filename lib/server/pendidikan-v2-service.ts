/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { PrismaClient, EducationAttendanceStatus } from "@prisma/client";
import { ScopeType, CanonicalAuditRecord } from "@/types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalAuthorizationDecision,
} from "@/lib/auth/canonical-evaluator";
import {
  IAuditPersistence,
  PrismaAuditPersistence,
  AuditDbClient,
} from "@/lib/auth/canonical-audit";
import {
  isApprovedKepesantrenanAttendanceStatus,
  resolvePblMeeting,
  EducationSessionReadDTO,
} from "@/lib/pendidikan-v2";
import { getWITADayRange, getWitaDateString } from "@/lib/wita-date";

export interface PendidikanV2ServiceDependencies {
  db: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
  auditPersistence?: IAuditPersistence;
}

export interface PendidikanV2RequestContext {
  actorUserId: string;
  clientRequestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface StartEducationSessionInput {
  sessionId: string;
}

export interface RecordSessionMaterialInput {
  sessionId: string;
  materi: string;
}

export interface RecordSessionAttendanceItem {
  santriId: string;
  status: EducationAttendanceStatus;
  note?: string;
}

export interface RecordSessionAttendanceInput {
  sessionId: string;
  santriId?: string;
  status?: EducationAttendanceStatus;
  note?: string;
  records?: RecordSessionAttendanceItem[];
}

/**
 * Validates canonical authorization decision provenance.
 * MUST fail closed: Never fabricates GURU_MAPEL, GLOBAL, or fake unit IDs.
 */
function validateAuditProvenance(authDecision: CanonicalAuthorizationDecision): {
  assignmentId: string;
  positionCode: string;
  capabilityCode: string;
  scopeType: ScopeType;
  unitId: string;
} {
  const assignmentId = authDecision.assignmentId;
  const positionCode = authDecision.positionCode;
  const capabilityCode = authDecision.capabilityCode;
  const scopeType = authDecision.scopeType as ScopeType | undefined;
  const unitId = authDecision.grantUsed?.anchorUnitId || authDecision.evaluatedUnitIds?.[0];

  if (!assignmentId || !positionCode || !capabilityCode || !scopeType || !unitId) {
    throw new Error(
      "AUTH_DECISION_INCOMPLETE: Keputusan otorisasi kanonikal tidak lengkap untuk kebutuhan audit forensik"
    );
  }

  return {
    assignmentId,
    positionCode,
    capabilityCode,
    scopeType,
    unitId,
  };
}

export class PendidikanV2Service {
  private db: PrismaClient;
  private dataProvider: ICanonicalDataProvider;
  private auditPersistence: IAuditPersistence;

  constructor(deps: PendidikanV2ServiceDependencies) {
    this.db = deps.db;
    this.dataProvider = deps.dataProvider || createPrismaDataProvider(deps.db);
    this.auditPersistence = deps.auditPersistence || new PrismaAuditPersistence();
  }

  /**
   * SERVER-SIDE SCHEMA READINESS GATE
   * Evaluates if required M3.3B tables exist in the database.
   * Returns explicit failure if tables are missing.
   * NEVER returns fake empty [] or zero counts on schema failure.
   */
  async checkSchemaReadiness(): Promise<{ ready: boolean; reason?: string }> {
    try {
      if (typeof (this.db as any).$queryRawUnsafe !== "function") {
        const hasSessions = !!(this.db as any).educationSession;
        const hasParticipants = !!(this.db as any).educationSessionParticipant;
        const hasAttendances = !!(this.db as any).educationSessionAttendance;
        if (!hasSessions || !hasParticipants || !hasAttendances) {
          return {
            ready: false,
            reason: "PENDIDIKAN_V2_SCHEMA_NOT_READY: Struktur tabel Pendidikan V2 tidak lengkap",
          };
        }
        return { ready: true };
      }

      const tables = (await (this.db as any).$queryRawUnsafe(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('public', CURRENT_SCHEMA) 
          AND table_name IN ('education_cohorts', 'teaching_assignments', 'education_sessions', 'education_session_participants', 'education_session_attendances');
      `)) as Array<{ table_name: string }>;

      const tableNames = new Set(tables.map((t: { table_name: string }) => t.table_name));
      const requiredTables = ['education_cohorts', 'teaching_assignments', 'education_sessions', 'education_session_participants', 'education_session_attendances'];
      const missingTables = requiredTables.filter((r) => !tableNames.has(r));

      if (missingTables.length > 0) {
        return {
          ready: false,
          reason: `PENDIDIKAN_V2_SCHEMA_NOT_READY: Tabel berikut belum tersedia di database: ${missingTables.join(", ")}`,
        };
      }

      const enums = (await (this.db as any).$queryRawUnsafe(`
        SELECT typname 
        FROM pg_type 
        WHERE typname IN ('EducationTrack', 'PedagogicalLevel', 'EducationSessionStatus', 'EducationAttendanceStatus');
      `)) as Array<{ typname: string }>;

      const enumNames = new Set(enums.map((e: { typname: string }) => e.typname));
      const requiredEnums = ['EducationTrack', 'PedagogicalLevel', 'EducationSessionStatus', 'EducationAttendanceStatus'];
      const missingEnums = requiredEnums.filter((e) => !enumNames.has(e));

      if (missingEnums.length > 0) {
        return {
          ready: false,
          reason: `PENDIDIKAN_V2_SCHEMA_NOT_READY: Enum berikut belum tersedia di database: ${missingEnums.join(", ")}`,
        };
      }

      return { ready: true };
    } catch (err: unknown) {
      return {
        ready: false,
        reason: `PENDIDIKAN_V2_SCHEMA_NOT_READY: Gagal memverifikasi skema database (${err instanceof Error ? err.message : String(err)})`,
      };
    }
  }

  /**
   * SERVER-AUTHORITATIVE READ DTO QUERY
   * Fetches sessions and returns authoritatively derived DTOs.
   * Never returns fake empty [] if schema is not ready.
   */
  async getEducationSessions(
    filter?: { educationTrack?: "STUDI_UMUM" | "KEPESANTRENAN"; date?: string },
    context?: { actorUserId?: string }
  ): Promise<EducationSessionReadDTO[]> {
    const schemaStatus = await this.checkSchemaReadiness();
    if (!schemaStatus.ready) {
      throw new Error(schemaStatus.reason || "PENDIDIKAN_V2_SCHEMA_NOT_READY: Tabel schema Pendidikan V2 belum tersedia di database");
    }

    // 1. Fail closed on missing or unauthenticated actor
    if (!context?.actorUserId || typeof context.actorUserId !== "string" || !context.actorUserId.trim()) {
      throw new Error("AUTHENTICATION_REQUIRED: Identitas pengguna autentikasi wajib disertakan untuk membaca sesi pembelajaran");
    }

    // 2. Hydrate active canonical identity
    const actorIdentity = await this.dataProvider.getIdentity(context.actorUserId);
    if (!actorIdentity || actorIdentity.status !== "AKTIF") {
      throw new Error("AUTHENTICATION_REQUIRED: Pengguna tidak terdaftar atau tidak aktif");
    }

    // 3. Authorize read access via canonical capability 'academic.schedule.read'
    const globalReadAuth = await authorizeCanonical({
      identity: actorIdentity,
      capability: "academic.schedule.read",
      resourceContext: undefined,
      dataProvider: this.dataProvider,
      isMutation: false,
    });

    if (globalReadAuth.decision !== "ALLOW") {
      throw new Error(
        `PERMISSION_DENIED: Pengguna tidak berwenang membaca jadwal sesi pembelajaran (${globalReadAuth.reason || globalReadAuth.reasonCode})`
      );
    }

    const isUatEnabled = process.env.PENDIDIKAN_V2_UAT_ENABLED === "true";

    const where: any = {};
    if (filter?.educationTrack) {
      where.educationTrack = filter.educationTrack;
    }

    if (filter?.date) {
      const { startOfDayUTC, endOfDayUTC } = getWITADayRange(filter.date);
      where.scheduledDate = {
        gte: startOfDayUTC,
        lte: endOfDayUTC,
      };
    }

    const sessions = await (this.db as any).educationSession.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      include: {
        subject: true,
        cohort: true,
        scheduledStaff: true,
        actualTeacherStaff: true,
        scheduledTeacherAssignment: {
          include: {
            staff: true,
            mapel: true,
          },
        },
      },
    });

    // 4. Session list authorization: Evaluate resource-level schedule-read authority
    const authorizedSessions: any[] = [];
    for (const s of sessions) {
      const sessionReadAuth = await authorizeCanonical({
        identity: actorIdentity,
        capability: "academic.schedule.read",
        resourceContext: {
          educationSessionId: s.id,
        },
        dataProvider: this.dataProvider,
        isMutation: false,
      });

      if (sessionReadAuth.decision === "ALLOW") {
        authorizedSessions.push(s);
      }
    }

    if (sessions.length > 0 && authorizedSessions.length === 0) {
      throw new Error("PERMISSION_DENIED: Akses ke seluruh baris sesi pembelajaran ditolak oleh kebijakan otorisasi");
    }

    // 5. Build authoritative DTOs with per-session authorization evaluations
    const dtos: EducationSessionReadDTO[] = [];

    for (const s of authorizedSessions) {
      const scheduledDateStr = s.scheduledDate instanceof Date
        ? getWitaDateString(s.scheduledDate)
        : String(s.scheduledDate || "");
      const startedAtStr = s.startedAt instanceof Date
        ? s.startedAt.toISOString()
        : (s.startedAt ? String(s.startedAt) : null);

      const subjectDisplay = s.subject?.nama || s.subjectId;
      const subjectName = s.subject?.nama || s.subjectId;
      const subjectCode = s.subject?.kodeMapel || s.subject?.kode || null;

      // Authoritative scheduled staff resolution
      const scheduledStaffId = s.scheduledStaffId || s.scheduledTeacherAssignment?.staffId || null;
      const scheduledTeacherDisplay = s.scheduledStaff?.nama || s.scheduledTeacherAssignment?.staff?.nama || null;
      const actualTeacherDisplay = s.actualTeacherStaff?.nama || null;

      // A. Per-session mutationAvailable calculation
      let mutationAvailable = false;
      let mutationDeniedReason: string | null = null;

      if (!isUatEnabled) {
        mutationDeniedReason = "UAT_NOT_ENABLED";
      } else if (s.status !== "SCHEDULED") {
        mutationDeniedReason = "SESSION_NOT_SCHEDULED";
      } else if (!actorIdentity.staffId) {
        mutationDeniedReason = "STAFF_NOT_LINKED";
      } else if (!scheduledStaffId) {
        mutationDeniedReason = "SCHEDULED_TEACHER_NOT_RESOLVED";
      } else if (actorIdentity.staffId !== scheduledStaffId) {
        mutationDeniedReason = "SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED";
      } else {
        const startDecision = await authorizeCanonical({
          identity: actorIdentity,
          capability: "academic.session.start",
          resourceContext: {
            educationSessionId: s.id,
          },
          dataProvider: this.dataProvider,
          isMutation: true,
        });

        if (startDecision.decision !== "ALLOW") {
          mutationDeniedReason = "CANONICAL_AUTH_DENIED";
        } else {
          mutationAvailable = true;
          mutationDeniedReason = null;
        }
      }

      // B. Per-session materialAvailable calculation
      let materialAvailable = false;
      let materialDeniedReason: string | null = null;

      if (!isUatEnabled) {
        materialDeniedReason = "UAT_NOT_ENABLED";
      } else if (s.status !== "STARTED") {
        materialDeniedReason = "SESSION_NOT_STARTED";
      } else if (!s.actualTeacherUserId || s.actualTeacherUserId !== context.actorUserId) {
        materialDeniedReason = "ACTOR_NOT_ACTUAL_TEACHER";
      } else {
        const matDecision = await authorizeCanonical({
          identity: actorIdentity,
          capability: "academic.material.record",
          resourceContext: {
            educationSessionId: s.id,
          },
          dataProvider: this.dataProvider,
          isMutation: true,
        });

        if (matDecision.decision !== "ALLOW") {
          materialDeniedReason = "CANONICAL_AUTH_DENIED";
        } else {
          materialAvailable = true;
          materialDeniedReason = null;
        }
      }

      // C. Per-session attendanceAvailable calculation
      let attendanceAvailable = false;
      let attendanceDeniedReason: string | null = null;

      if (!isUatEnabled) {
        attendanceDeniedReason = "UAT_NOT_ENABLED";
      } else if (s.educationTrack !== "KEPESANTRENAN") {
        attendanceDeniedReason = "STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED";
      } else if (s.status !== "STARTED") {
        attendanceDeniedReason = "SESSION_NOT_STARTED";
      } else if (!s.actualTeacherUserId || s.actualTeacherUserId !== context.actorUserId) {
        attendanceDeniedReason = "ACTOR_NOT_ACTUAL_TEACHER";
      } else {
        const attDecision = await authorizeCanonical({
          identity: actorIdentity,
          capability: "academic.attendance.record",
          resourceContext: {
            educationSessionId: s.id,
          },
          dataProvider: this.dataProvider,
          isMutation: true,
        });

        if (attDecision.decision !== "ALLOW") {
          attendanceDeniedReason = "CANONICAL_AUTH_DENIED";
        } else {
          attendanceAvailable = true;
          attendanceDeniedReason = null;
        }
      }

      // PBL metadata derivation for Studi Umum
      const pblMetadata = s.semesterMeetingNumber && s.educationTrack === "STUDI_UMUM"
        ? (() => {
            try {
              const p = resolvePblMeeting(s.semesterMeetingNumber);
              return {
                blockNumber: p.blockNumber,
                weekInBlock: p.weekInBlock,
                phase: p.pblPhase,
                isProjectWeek: p.isProjectWeek,
              };
            } catch {
              return null;
            }
          })()
        : null;

      dtos.push({
        sessionId: s.id,
        educationTrack: s.educationTrack,
        subject: subjectDisplay,
        subjectId: s.subjectId,
        subjectCode,
        subjectName,
        scheduledDate: scheduledDateStr,
        plannedStart: s.plannedStartTime || null,
        plannedEnd: s.plannedEndTime || null,
        plannedStartTime: s.plannedStartTime || null,
        plannedEndTime: s.plannedEndTime || null,
        programLevel: s.programLevel ?? null,
        cohortId: s.cohortId || null,
        cohortCode: s.cohort?.code || null,
        cohortLabel: s.cohort?.code || s.cohort?.tahunAjaranMasuk || null,
        cohortTahunAjaran: s.cohort?.tahunAjaranMasuk || null,
        genderGroup: s.genderGroup || null,
        jp: s.jp || null,
        semesterMeetingNumber: s.semesterMeetingNumber || null,
        pblPhase: s.pblPhase || pblMetadata?.phase || null,
        pblBlockNumber: s.pblBlockNumber || pblMetadata?.blockNumber || null,
        pblMetadata,
        pedagogicalLevel: s.scheduledTeacherAssignment?.pedagogicalLevel || null,
        scheduledTeacherAssignmentId: s.scheduledTeacherAssignmentId || null,
        scheduledStaffId,
        scheduledTeacherDisplay,
        actualTeacherUserId: s.actualTeacherUserId || null,
        actualTeacherStaffId: s.actualTeacherStaffId || null,
        actualTeacherDisplay,
        status: s.status,
        startedAt: startedAtStr,
        materi: s.materi || null,
        attendanceAvailable,
        attendanceDeniedReason,
        materialAvailable,
        materialDeniedReason,
        mutationAvailable,
        mutationDeniedReason,
      });
    }

    return dtos;
  }

  /**
   * "MULAI PEMBELAJARAN"
   * Teacher attendance evidence is the authenticated teacher clicking "Mulai Pembelajaran".
   * Derives actual teacher from authenticated identity; preserves scheduled teacher separately.
   * Enforces transactional compare-and-swap (CAS) to prevent concurrent double-starts.
   */
  async startEducationSession(
    input: StartEducationSessionInput,
    context: PendidikanV2RequestContext
  ) {
    const { sessionId } = input;
    const { actorUserId, clientRequestId, ipAddress, userAgent } = context;

    // Server-side activation gate
    if (process.env.PENDIDIKAN_V2_UAT_ENABLED !== "true") {
      throw new Error("PENDIDIKAN_V2_UAT_NOT_ENABLED: Fitur aktivasi UAT Pendidikan V2 belum diaktifkan di tingkat server");
    }

    const schemaStatus = await this.checkSchemaReadiness();
    if (!schemaStatus.ready) {
      throw new Error(schemaStatus.reason || "PENDIDIKAN_V2_SCHEMA_NOT_READY: Tabel schema Pendidikan V2 belum tersedia di database");
    }

    if (!actorUserId || typeof actorUserId !== "string" || !actorUserId.trim()) {
      throw new Error("ACTOR_USER_ID_REQUIRED: Identitas pengguna autentikasi wajib disertakan");
    }

    // 1. Resolve human executor and verify canonical User.id
    const executor = await this.dataProvider.verifyHumanExecutor(actorUserId);
    if (!executor || !executor.isActive || !executor.userId) {
      throw new Error(
        "HUMAN_EXECUTOR_VERIFICATION_FAILED: Identitas pelaksana manusia tidak sah atau tidak aktif"
      );
    }

    // 2. Resolve identity and ensure staff link
    const technicalIdentity = await this.dataProvider.getIdentity(actorUserId);
    if (!technicalIdentity || technicalIdentity.status !== "AKTIF") {
      throw new Error("AUTHENTICATION_REQUIRED: Pengguna tidak terdaftar atau tidak aktif");
    }

    if (!technicalIdentity.staffId) {
      throw new Error(
        "TEACHER_STAFF_RECORD_REQUIRED: Pengguna wajib memiliki profil staf pendidik aktif untuk memulai pembelajaran"
      );
    }

    // 3. Authorize via canonical evaluator (Pass explicit educationSessionId, never generic resourceId)
    const authDecision = await authorizeCanonical({
      identity: technicalIdentity,
      capability: "academic.session.start",
      resourceContext: { educationSessionId: sessionId },
      dataProvider: this.dataProvider,
      isMutation: true,
    });

    if (authDecision.decision !== "ALLOW") {
      throw new Error(
        `CANONICAL_AUTHORIZATION_DENIED: Pengguna tidak memiliki wewenang untuk memulai sesi pembelajaran (${authDecision.reason || authDecision.reasonCode})`
      );
    }

    // 4. Audit provenance verification (Fail-closed: No fallback fabrication)
    const provenance = validateAuditProvenance(authDecision);
    const staffId = technicalIdentity.staffId;

    // 5. Transactional Compare-And-Swap (CAS) state transition & audit
    return await this.db.$transaction(async (tx) => {
      const currentSession = await tx.educationSession.findUnique({
        where: { id: sessionId },
      });

      if (!currentSession) {
        throw new Error(`SESSION_NOT_FOUND: Sesi pembelajaran dengan ID '${sessionId}' tidak ditemukan`);
      }

      if (currentSession.status !== "SCHEDULED") {
        throw new Error(
          `INVALID_SESSION_STATUS: Sesi pembelajaran tidak dapat dimulai karena berstatus '${currentSession.status}'`
        );
      }

      // Substitute / Badal Policy Check (Fail Closed)
      // Resolve authoritative scheduled teacher from session or scheduled assignment
      let authoritativeScheduledStaffId = currentSession.scheduledStaffId;
      if (!authoritativeScheduledStaffId && currentSession.scheduledTeacherAssignmentId) {
        const ta = await (tx as any).teachingAssignment?.findUnique({
          where: { id: currentSession.scheduledTeacherAssignmentId },
        });
        if (ta?.staffId) {
          authoritativeScheduledStaffId = ta.staffId;
        }
      }

      if (!authoritativeScheduledStaffId) {
        throw new Error(
          "SCHEDULED_TEACHER_NOT_RESOLVED: Sesi pembelajaran tidak memiliki guru terjadwal resmi yang valid."
        );
      }

      if (authoritativeScheduledStaffId !== staffId) {
        throw new Error(
          "SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED: Kebijakan guru pengganti (badal) belum disahkan. Sesi hanya dapat dimulai oleh guru terjadwal resmi."
        );
      }

      const startedAt = new Date();

      // Real CAS update: condition on status = SCHEDULED
      const casResult = await tx.educationSession.updateMany({
        where: {
          id: sessionId,
          status: "SCHEDULED",
        },
        data: {
          status: "STARTED",
          startedAt,
          actualTeacherUserId: actorUserId,
          actualTeacherStaffId: staffId,
          updatedAt: startedAt,
        },
      });

      if (casResult.count !== 1) {
        throw new Error(
          "EDUCATION_SESSION_CONCURRENT_START: Terjadi konflik konkurensi saat memulai sesi pembelajaran"
        );
      }

      const updatedSession = await tx.educationSession.findUniqueOrThrow({
        where: { id: sessionId },
      });

      // 6. Atomic persistent audit log
      const auditRecord: CanonicalAuditRecord = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        technicalAccountId: actorUserId,
        technicalAccountUsername: technicalIdentity.username,
        humanExecutorId: executor.userId,
        humanExecutorName: executor.name,
        action: "academic.session.start",
        entity: "EducationSession",
        entityId: sessionId,
        capabilityCode: provenance.capabilityCode,
        assignmentId: provenance.assignmentId,
        positionCode: provenance.positionCode,
        scopeType: provenance.scopeType,
        unitId: provenance.unitId,
        beforeState: {
          status: currentSession.status,
          startedAt: null,
          actualTeacherUserId: null,
          actualTeacherStaffId: null,
          scheduledStaffId: currentSession.scheduledStaffId,
        },
        afterState: {
          status: updatedSession.status,
          startedAt: updatedSession.startedAt,
          actualTeacherUserId: updatedSession.actualTeacherUserId,
          actualTeacherStaffId: updatedSession.actualTeacherStaffId,
          scheduledStaffId: updatedSession.scheduledStaffId,
        },
        resourceContext: { educationSessionId: sessionId, educationTrack: currentSession.educationTrack },
        clientRequestId: clientRequestId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        timestamp: startedAt,
      };

      await this.auditPersistence.recordInTx(tx as unknown as AuditDbClient, auditRecord);

      return {
        success: true,
        session: updatedSession,
      };
    });
  }

  /**
   * RECORD SESSION MATERIAL
   * Gated: Only permitted after session status is STARTED.
   * Actual Teacher Ownership: Only the actual teacher who started the session can record material.
   * Material is manually entered by the teacher.
   * Atomic persistence: Mutation and audit occur in single transaction; audit failure rolls back.
   */
  async recordSessionMaterial(
    input: RecordSessionMaterialInput,
    context: PendidikanV2RequestContext
  ) {
    const { sessionId, materi } = input;
    const { actorUserId, clientRequestId, ipAddress, userAgent } = context;

    // Server-side activation gate
    if (process.env.PENDIDIKAN_V2_UAT_ENABLED !== "true") {
      throw new Error("PENDIDIKAN_V2_UAT_NOT_ENABLED: Fitur aktivasi UAT Pendidikan V2 belum diaktifkan di tingkat server");
    }

    const schemaStatus = await this.checkSchemaReadiness();
    if (!schemaStatus.ready) {
      throw new Error(schemaStatus.reason || "PENDIDIKAN_V2_SCHEMA_NOT_READY: Tabel schema Pendidikan V2 belum tersedia di database");
    }

    if (!actorUserId || typeof actorUserId !== "string" || !actorUserId.trim()) {
      throw new Error("ACTOR_USER_ID_REQUIRED: Identitas pengguna autentikasi wajib disertakan");
    }

    if (!materi || !materi.trim()) {
      throw new Error("MATERIAL_CONTENT_REQUIRED: Materi pembelajaran wajib diisi");
    }

    // 1. Resolve identity
    const technicalIdentity = await this.dataProvider.getIdentity(actorUserId);
    if (!technicalIdentity || technicalIdentity.status !== "AKTIF") {
      throw new Error("AUTHENTICATION_REQUIRED: Pengguna tidak terdaftar atau tidak aktif");
    }

    const executor = await this.dataProvider.verifyHumanExecutor(actorUserId);
    if (!executor || !executor.isActive || !executor.userId) {
      throw new Error(
        "HUMAN_EXECUTOR_VERIFICATION_FAILED: Identitas pelaksana manusia tidak sah atau tidak aktif"
      );
    }

    // 2. Authorize actor with canonical capability 'academic.material.record'
    const authDecision = await authorizeCanonical({
      identity: technicalIdentity,
      capability: "academic.material.record",
      resourceContext: { educationSessionId: sessionId },
      dataProvider: this.dataProvider,
      isMutation: true,
    });

    if (authDecision.decision !== "ALLOW") {
      throw new Error(
        `CANONICAL_AUTHORIZATION_DENIED: Pengguna tidak berwenang mencatat materi pembelajaran (${authDecision.reason || authDecision.reasonCode})`
      );
    }

    const provenance = validateAuditProvenance(authDecision);

    // 3. Atomic transaction: Gating + Actual teacher check + Update + Audit
    return await this.db.$transaction(async (tx) => {
      const currentSession = await tx.educationSession.findUnique({
        where: { id: sessionId },
      });

      if (!currentSession) {
        throw new Error(`SESSION_NOT_FOUND: Sesi pembelajaran dengan ID '${sessionId}' tidak ditemukan`);
      }

      if (currentSession.status !== "STARTED") {
        throw new Error(
          `SESSION_NOT_STARTED: Materi pembelajaran hanya dapat dicatat setelah sesi pembelajaran berstatus STARTED (Status saat ini: '${currentSession.status}')`
        );
      }

      // Actual Teacher Ownership Check
      if (currentSession.actualTeacherUserId !== actorUserId) {
        throw new Error(
          "ACTOR_NOT_ACTUAL_TEACHER: Hanya guru aktual yang memulai sesi ini yang berwenang mencatat materi pembelajaran"
        );
      }

      const recordedAt = new Date();
      const updated = await tx.educationSession.update({
        where: { id: sessionId },
        data: {
          materi: materi.trim(),
          materiRecordedAt: recordedAt,
          materiRecordedByUserId: actorUserId,
          updatedAt: recordedAt,
        },
      });

      const auditRecord: CanonicalAuditRecord = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        technicalAccountId: actorUserId,
        technicalAccountUsername: technicalIdentity.username,
        humanExecutorId: executor.userId,
        humanExecutorName: executor.name,
        action: "academic.material.record",
        entity: "EducationSession",
        entityId: sessionId,
        capabilityCode: provenance.capabilityCode,
        assignmentId: provenance.assignmentId,
        positionCode: provenance.positionCode,
        scopeType: provenance.scopeType,
        unitId: provenance.unitId,
        beforeState: {
          materi: currentSession.materi,
          materiRecordedAt: currentSession.materiRecordedAt,
          materiRecordedByUserId: currentSession.materiRecordedByUserId,
        },
        afterState: {
          materi: updated.materi,
          materiRecordedAt: updated.materiRecordedAt,
          materiRecordedByUserId: updated.materiRecordedByUserId,
        },
        resourceContext: { educationSessionId: sessionId, educationTrack: currentSession.educationTrack },
        clientRequestId: clientRequestId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        timestamp: recordedAt,
      };

      await this.auditPersistence.recordInTx(tx as unknown as AuditDbClient, auditRecord);

      return {
        success: true,
        session: updated,
      };
    });
  }

  /**
   * RECORD STUDENT ATTENDANCE
   * Gated: Only permitted after session status is STARTED.
   * Track-Safe: Only KEPESANTRENAN attendance is enabled in M3.3B. STUDI_UMUM is strictly deferred.
   * Actual Teacher Ownership: Only the actual teacher who started the session can record attendance.
   * Participant Integrity: Santri must be an enrolled participant in EducationSessionParticipant.
   * Valid statuses: HADIR, IZIN, SAKIT, ALFA (Strictly NO MASBUK).
   */
  async recordSessionAttendance(
    input: RecordSessionAttendanceInput,
    context: PendidikanV2RequestContext
  ) {
    const { sessionId } = input;
    const { actorUserId, clientRequestId, ipAddress, userAgent } = context;

    // Server-side activation gate
    if (process.env.PENDIDIKAN_V2_UAT_ENABLED !== "true") {
      throw new Error("PENDIDIKAN_V2_UAT_NOT_ENABLED: Fitur aktivasi UAT Pendidikan V2 belum diaktifkan di tingkat server");
    }

    const schemaStatus = await this.checkSchemaReadiness();
    if (!schemaStatus.ready) {
      throw new Error(schemaStatus.reason || "PENDIDIKAN_V2_SCHEMA_NOT_READY: Tabel schema Pendidikan V2 belum tersedia di database");
    }

    if (!actorUserId || typeof actorUserId !== "string" || !actorUserId.trim()) {
      throw new Error("ACTOR_USER_ID_REQUIRED: Identitas pengguna autentikasi wajib disertakan");
    }

    // Normalize input to records array
    const recordsToProcess: RecordSessionAttendanceItem[] = [];
    if (input.records && Array.isArray(input.records) && input.records.length > 0) {
      recordsToProcess.push(...input.records);
    } else if (input.santriId && input.status) {
      recordsToProcess.push({
        santriId: input.santriId,
        status: input.status,
        note: input.note,
      });
    } else {
      throw new Error("ATTENDANCE_RECORDS_REQUIRED: Data presensi santri wajib disertakan");
    }

    // 1. Validate all statuses (NO MASBUK)
    for (const rec of recordsToProcess) {
      if ((rec.status as string) === "MASBUK") {
        throw new Error(
          "ATTENDANCE_STATUS_REJECTED: Status MASBUK tidak berlaku untuk sesi kepesantrenan"
        );
      }
      if (!isApprovedKepesantrenanAttendanceStatus(rec.status)) {
        throw new Error(
          `INVALID_ATTENDANCE_STATUS: Status presensi '${rec.status}' tidak sah. Status resmi: HADIR, IZIN, SAKIT, ALFA`
        );
      }
    }

    // 2. Resolve identity
    const technicalIdentity = await this.dataProvider.getIdentity(actorUserId);
    if (!technicalIdentity || technicalIdentity.status !== "AKTIF") {
      throw new Error("AUTHENTICATION_REQUIRED: Pengguna tidak terdaftar atau tidak aktif");
    }

    const executor = await this.dataProvider.verifyHumanExecutor(actorUserId);
    if (!executor || !executor.isActive || !executor.userId) {
      throw new Error(
        "HUMAN_EXECUTOR_VERIFICATION_FAILED: Identitas pelaksana manusia tidak sah atau tidak aktif"
      );
    }

    // 3. Authorize actor for EVERY DISTINCT santriId in the batch
    const distinctSantriIds = Array.from(new Set(recordsToProcess.map((r) => r.santriId)));
    let sharedProvenance: {
      assignmentId: string;
      positionCode: string;
      capabilityCode: string;
      scopeType: ScopeType;
      unitId: string;
    } | null = null;

    for (const sId of distinctSantriIds) {
      const authDecision = await authorizeCanonical({
        identity: technicalIdentity,
        capability: "academic.attendance.record",
        resourceContext: { educationSessionId: sessionId, santriId: sId },
        dataProvider: this.dataProvider,
        isMutation: true,
      });

      if (authDecision.decision !== "ALLOW") {
        throw new Error(
          `CANONICAL_AUTHORIZATION_DENIED: Pengguna tidak berwenang mencatat presensi santri '${sId}' (${authDecision.reason || authDecision.reasonCode})`
        );
      }

      const provenance = validateAuditProvenance(authDecision);
      if (!sharedProvenance) {
        sharedProvenance = provenance;
      } else {
        // Enforce that all targets in one batch resolve to the SAME canonical provenance
        const isIdentical =
          sharedProvenance.assignmentId === provenance.assignmentId &&
          sharedProvenance.positionCode === provenance.positionCode &&
          sharedProvenance.capabilityCode === provenance.capabilityCode &&
          sharedProvenance.scopeType === provenance.scopeType &&
          sharedProvenance.unitId === provenance.unitId;

        if (!isIdentical) {
          throw new Error(
            "ATTENDANCE_BATCH_MIXED_AUTHORIZATION_PROVENANCE: Target presensi dalam batch memiliki provenance otorisasi yang berbeda. Seluruh batch ditolak."
          );
        }
      }
    }

    if (!sharedProvenance) {
      throw new Error("CANONICAL_AUTHORIZATION_DENIED: Tidak ada target presensi yang dapat diotorisasi");
    }
    const provenance = sharedProvenance;

    // 4. Atomic transaction: Track check + Gating + Actual teacher check + Participant integrity + Upsert + Audit
    return await this.db.$transaction(async (tx) => {
      const currentSession = await tx.educationSession.findUnique({
        where: { id: sessionId },
      });

      if (!currentSession) {
        throw new Error(`SESSION_NOT_FOUND: Sesi pembelajaran dengan ID '${sessionId}' tidak ditemukan`);
      }

      if (currentSession.status !== "STARTED") {
        throw new Error(
          `SESSION_NOT_STARTED: Presensi santri hanya dapat dicatat setelah sesi pembelajaran berstatus STARTED (Status saat ini: '${currentSession.status}')`
        );
      }

      // Track-Safe Guard: Studi Umum student attendance workflow is strictly DEFERRED in M3.3B
      if (currentSession.educationTrack === "STUDI_UMUM") {
        throw new Error(
          "STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED: Alur presensi santri Studi Umum ditangguhkan pada Milestone 3.3B"
        );
      }

      // Actual Teacher Ownership Check
      if (currentSession.actualTeacherUserId !== actorUserId) {
        throw new Error(
          "ACTOR_NOT_ACTUAL_TEACHER: Hanya guru aktual yang memulai sesi ini yang berwenang mencatat presensi"
        );
      }

      // Participant Integrity Check
      for (const rec of recordsToProcess) {
        const participant = await tx.educationSessionParticipant.findUnique({
          where: {
            sessionId_santriId: {
              sessionId,
              santriId: rec.santriId,
            },
          },
        });
        if (!participant) {
          throw new Error(
            `NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED: Santri '${rec.santriId}' bukan merupakan peserta resmi sesi ini`
          );
        }
      }

      // Load existing attendances for forensic beforeState
      const beforeRecords: { santriId: string; status: EducationAttendanceStatus | null }[] = [];
      const afterRecords: { santriId: string; status: EducationAttendanceStatus }[] = [];

      for (const rec of recordsToProcess) {
        const existing = await tx.educationSessionAttendance.findUnique({
          where: {
            sessionId_santriId: {
              sessionId,
              santriId: rec.santriId,
            },
          },
        });
        beforeRecords.push({
          santriId: rec.santriId,
          status: existing ? existing.status : null,
        });
        afterRecords.push({
          santriId: rec.santriId,
          status: rec.status,
        });
      }

      const recordedAt = new Date();
      const results = [];

      for (const rec of recordsToProcess) {
        const attendance = await tx.educationSessionAttendance.upsert({
          where: {
            sessionId_santriId: {
              sessionId,
              santriId: rec.santriId,
            },
          },
          update: {
            status: rec.status,
            note: rec.note ? rec.note.trim() : null,
            recordedByUserId: actorUserId,
            recordedAt,
            updatedAt: recordedAt,
          },
          create: {
            sessionId,
            santriId: rec.santriId,
            status: rec.status,
            note: rec.note ? rec.note.trim() : null,
            recordedByUserId: actorUserId,
            recordedAt,
          },
        });
        results.push(attendance);
      }

      // Record forensic audit
      const auditRecord: CanonicalAuditRecord = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        technicalAccountId: actorUserId,
        technicalAccountUsername: technicalIdentity.username,
        humanExecutorId: executor.userId,
        humanExecutorName: executor.name,
        action: "academic.attendance.record",
        entity: "EducationSessionAttendance",
        entityId: sessionId,
        capabilityCode: provenance.capabilityCode,
        assignmentId: provenance.assignmentId,
        positionCode: provenance.positionCode,
        scopeType: provenance.scopeType,
        unitId: provenance.unitId,
        beforeState: {
          records: beforeRecords,
        },
        afterState: {
          records: afterRecords,
        },
        resourceContext: { educationSessionId: sessionId, educationTrack: currentSession.educationTrack },
        clientRequestId: clientRequestId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        timestamp: recordedAt,
      };

      await this.auditPersistence.recordInTx(tx as unknown as AuditDbClient, auditRecord);

      return {
        success: true,
        count: results.length,
        attendances: results,
      };
    });
  }
}

export function createPendidikanV2Service(deps: PendidikanV2ServiceDependencies): PendidikanV2Service {
  return new PendidikanV2Service(deps);
}

export const createEducationV2Service = createPendidikanV2Service;
export type EducationV2Service = PendidikanV2Service;
