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
    let primaryProvenance: {
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
      if (!primaryProvenance) {
        primaryProvenance = provenance;
      }
    }

    if (!primaryProvenance) {
      throw new Error("CANONICAL_AUTHORIZATION_DENIED: Tidak ada target presensi yang dapat diotorisasi");
    }
    const provenance = primaryProvenance;

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
