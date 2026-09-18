import "server-only";

import { PrismaClient, EducationAttendanceStatus } from "@prisma/client";
import { ScopeType, CanonicalAuditRecord } from "@/types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
} from "@/lib/auth/canonical-evaluator";
import {
  IAuditPersistence,
  PrismaAuditPersistence,
  AuditDbClient,
} from "@/lib/auth/canonical-audit";
import {
  isApprovedKepesantrenanAttendanceStatus,
} from "@/lib/pendidikan-v2";

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
   * "MULAI PEMBELAJARAN"
   * Teacher attendance evidence is the authenticated teacher clicking "Mulai Pembelajaran".
   * Derives actual teacher from authenticated identity; preserves scheduled teacher separately.
   */
  async startEducationSession(
    input: StartEducationSessionInput,
    context: PendidikanV2RequestContext
  ) {
    const { sessionId } = input;
    const { actorUserId, clientRequestId, ipAddress, userAgent } = context;

    if (!actorUserId || typeof actorUserId !== "string" || !actorUserId.trim()) {
      throw new Error("ACTOR_USER_ID_REQUIRED: Identitas pengguna autentikasi wajib disertakan");
    }

    // 1. Resolve human executor
    const executor = await this.dataProvider.verifyHumanExecutor(actorUserId);
    if (!executor || !executor.isActive) {
      throw new Error("ACTOR_NOT_ACTIVE: Akun pengguna tidak dalam status aktif");
    }

    // 2. Resolve identity and ensure staff link
    const technicalIdentity = await this.dataProvider.getIdentity(actorUserId);
    if (!technicalIdentity || technicalIdentity.status !== "AKTIF") {
      throw new Error("AUTHENTICATION_REQUIRED: Pengguna tidak terdaftar atau tidak aktif");
    }

    if (!technicalIdentity.staffId) {
      throw new Error("TEACHER_STAFF_RECORD_REQUIRED: Pengguna wajib memiliki profil staf pendidik aktif untuk memulai pembelajaran");
    }

    // 3. Authorize via canonical evaluator
    const authDecision = await authorizeCanonical({
      identity: technicalIdentity,
      capability: "academic.session.start",
      resourceContext: { resourceId: sessionId },
      dataProvider: this.dataProvider,
      isMutation: true,
    });

    if (authDecision.decision !== "ALLOW") {
      throw new Error(
        `CANONICAL_AUTHORIZATION_DENIED: Pengguna tidak memiliki wewenang untuk memulai sesi pembelajaran (${authDecision.reason || authDecision.reasonCode})`
      );
    }

    const staffId = technicalIdentity.staffId;

    // 4. Transactional compare-and-swap state transition & audit
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

      const startedAt = new Date();

      const updatedSession = await tx.educationSession.update({
        where: { id: sessionId },
        data: {
          status: "STARTED",
          startedAt,
          actualTeacherUserId: actorUserId,
          actualTeacherStaffId: staffId,
          updatedAt: startedAt,
        },
      });

      // 5. Atomic persistent audit log
      const auditRecord: CanonicalAuditRecord = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        technicalAccountId: actorUserId,
        technicalAccountUsername: technicalIdentity.username,
        humanExecutorId: executor.id,
        humanExecutorName: executor.name,
        action: "academic.session.start",
        entity: "EducationSession",
        entityId: sessionId,
        capabilityCode: authDecision.capabilityCode || "academic.session.start",
        assignmentId: authDecision.assignmentId,
        positionCode: authDecision.positionCode || "GURU_MAPEL",
        scopeType: (authDecision.scopeType || "GLOBAL") as ScopeType,
        unitId: authDecision.grantUsed?.anchorUnitId || authDecision.evaluatedUnitIds?.[0] || "ou-madrasah",
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
        resourceContext: { sessionId, educationTrack: currentSession.educationTrack },
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
   * Material is manually entered by the teacher.
   */
  async recordSessionMaterial(
    input: RecordSessionMaterialInput,
    context: PendidikanV2RequestContext
  ) {
    const { sessionId, materi } = input;
    const { actorUserId } = context;

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

    // 2. Authorize actor
    const authDecision = await authorizeCanonical({
      identity: technicalIdentity,
      capability: "academic.session.record_materi",
      resourceContext: { resourceId: sessionId },
      dataProvider: this.dataProvider,
      isMutation: true,
    });

    if (authDecision.decision !== "ALLOW") {
      throw new Error(
        `CANONICAL_AUTHORIZATION_DENIED: Pengguna tidak berwenang mencatat materi pembelajaran (${authDecision.reason || authDecision.reasonCode})`
      );
    }

    // 3. Gating check: Must be STARTED
    const currentSession = await this.db.educationSession.findUnique({
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

    const recordedAt = new Date();
    const updated = await this.db.educationSession.update({
      where: { id: sessionId },
      data: {
        materi: materi.trim(),
        materiRecordedAt: recordedAt,
        materiRecordedByUserId: actorUserId,
        updatedAt: recordedAt,
      },
    });

    return {
      success: true,
      session: updated,
    };
  }

  /**
   * RECORD STUDENT ATTENDANCE
   * Gated: Only permitted after session status is STARTED.
   * Valid statuses: HADIR, IZIN, SAKIT, ALFA (Strictly NO MASBUK).
   */
  async recordSessionAttendance(
    input: RecordSessionAttendanceInput,
    context: PendidikanV2RequestContext
  ) {
    const { sessionId } = input;
    const { actorUserId, clientRequestId, ipAddress, userAgent } = context;

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

    // 3. Authorize actor
    const authDecision = await authorizeCanonical({
      identity: technicalIdentity,
      capability: "academic.attendance.record",
      resourceContext: { resourceId: sessionId },
      dataProvider: this.dataProvider,
      isMutation: true,
    });

    if (authDecision.decision !== "ALLOW") {
      throw new Error(
        `CANONICAL_AUTHORIZATION_DENIED: Pengguna tidak berwenang mencatat presensi santri (${authDecision.reason || authDecision.reasonCode})`
      );
    }

    // 4. Gating check: Session must be STARTED, run inside transaction with atomic audit
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

      // Record audit
      const auditRecord: CanonicalAuditRecord = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        technicalAccountId: actorUserId,
        technicalAccountUsername: technicalIdentity.username,
        humanExecutorId: executor?.id || actorUserId,
        humanExecutorName: executor?.name || technicalIdentity.username,
        action: "academic.attendance.record",
        entity: "EducationSessionAttendance",
        entityId: sessionId,
        capabilityCode: authDecision.capabilityCode || "academic.attendance.record",
        assignmentId: authDecision.assignmentId,
        positionCode: authDecision.positionCode || "GURU_MAPEL",
        scopeType: (authDecision.scopeType || "GLOBAL") as ScopeType,
        unitId: authDecision.grantUsed?.anchorUnitId || authDecision.evaluatedUnitIds?.[0] || "ou-madrasah",
        beforeState: null,
        afterState: {
          sessionId,
          recordedCount: results.length,
        },
        resourceContext: { sessionId, educationTrack: currentSession.educationTrack },
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
