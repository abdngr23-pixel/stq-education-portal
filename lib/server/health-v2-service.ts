import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";
import {
  CANONICAL_HEALTH_STATUSES_V2,
  HealthStatusV2,
  isCanonicalHealthStatusV2,
  HealthCaseV2DTO,
  HealthCaseV2EventDTO,
  HealthV2RequestContext,
  HealthCaseV2AuditContext,
  CreateHealthCaseV2Input,
  UpdateHealthCaseV2StatusInput,
} from "@/lib/health-v2";
import { HEALTH_CAPABILITIES, ScopeType } from "@/types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalAssignmentWithDetails,
} from "@/lib/auth/canonical-evaluator";
import {
  logCanonicalAudit,
  activeAuditSink,
  IAuditSink,
} from "@/lib/auth/canonical-audit";

/**
 * Service dependencies separated from per-request context.
 * Test runners can supply mock db, mock dataProvider, and mock auditSink here.
 * Production callers instantiate the service with real database and sinks.
 */
export interface HealthV2ServiceDependencies {
  db: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
  auditSink?: IAuditSink;
}

export interface HealthCaseV2DetailContext extends Partial<HealthV2RequestContext> {
  actorUserId: string;
  // Legacy fields retained for backward-compatibility with Round 1 test callers, but ignored at runtime
  actorRole?: string;
  positionCode?: string;
  capabilities?: string[];
  isOsdaGeneric?: boolean;
  scopeType?: ScopeType | "KAMAR" | "GLOBAL" | "ASSIGNED_UNITS";
  assignedKamarId?: string | null;
  dataProvider?: ICanonicalDataProvider;
  now?: Date;
}

export interface HealthCaseV2AggregateContext extends Partial<HealthV2RequestContext> {
  actorUserId: string;
  // Legacy fields retained for backward-compatibility with Round 1 test callers, but ignored at runtime
  actorRole?: string;
  capabilities?: string[];
  dataProvider?: ICanonicalDataProvider;
  now?: Date;
}

export interface HealthCaseV2AggregateFilter {
  startDate?: Date;
  endDate?: Date;
  kamarId?: string;
}

export interface HealthCaseV2AggregateResult {
  totalCases: number;
  activeCases: number;
  recoveredCases: number;
  byStatus: {
    DIPANTAU: number;
    PULIH: number;
    DIRUJUK: number;
    DARURAT: number;
  };
}

export interface HealthV2OperationAudit {
  id?: string;
  action: string;
  actorUserId: string;
  actorStaffId?: string | null;
  humanExecutorId?: string | null;
  humanExecutorUsername?: string | null;
  positionCode?: string | null;
  capability: string;
  scope: string;
  targetSantriId: string;
  previousStatus?: HealthStatusV2 | null;
  newStatus?: HealthStatusV2 | null;
  occurredAt: Date;
  createdAt: Date;
}

/**
 * Executes a database callback within a Prisma transaction if available,
 * or against the database client directly for test mocks.
 */
async function runTransaction<T>(
  db: PrismaClient,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  const maybeTx = db as unknown as { $transaction?: (cb: (tx: PrismaClient) => Promise<T>) => Promise<T> };
  if (typeof maybeTx.$transaction === "function") {
    return maybeTx.$transaction((tx) => fn(tx));
  }
  return fn(db);
}

export interface HealthV2Service {
  createCase(
    input: CreateHealthCaseV2Input,
    context: HealthV2RequestContext
  ): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }>;
  updateCaseStatus(
    input: UpdateHealthCaseV2StatusInput,
    context: HealthV2RequestContext
  ): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }>;
  getCaseDetail(
    id: string,
    context: HealthV2RequestContext
  ): Promise<{ success: boolean; data: HealthCaseV2DTO }>;
  getCasesAggregate(
    filter: HealthCaseV2AggregateFilter,
    context: HealthV2RequestContext
  ): Promise<{ success: boolean; data: HealthCaseV2AggregateResult }>;
}

/**
 * Creates an authoritative Health V2 domain service instance.
 * Separates constructor dependencies (db, dataProvider, auditSink) from request context.
 */
export function createHealthV2Service(deps: HealthV2ServiceDependencies): HealthV2Service {
  const db = deps.db;
  const dataProvider = deps.dataProvider || createPrismaDataProvider(db);
  const auditSink = deps.auditSink || activeAuditSink;

  return {
    /**
     * Creates a new Health V2 Case in the database.
     * Enforces:
     * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
     * - Server-side canonical human executor verification (Blocker 1)
     * - Mutation and audit atomicity inside transaction; rolls back on failure (Blocker 2)
     * - Audit decision fail-closed: missing provenance throws AUTH_DECISION_INCOMPLETE (Blocker 4)
     * - Request context owns clientRequestId single-source-of-truth (Blocker 7)
     * - Data honesty: optional diagnosa persists as NULL if empty
     * - Tindakan awal immutable
     */
    async createCase(
      input: CreateHealthCaseV2Input,
      context: HealthV2RequestContext
    ): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
      const actorUserId = context.actorUserId || (context as unknown as { userId?: string }).userId;
      if (!actorUserId || actorUserId.trim() === "") {
        throw new Error("AUTHENTICATION_REQUIRED: actorUserId is required.");
      }

      // Blocker 7: Single source of truth for clientRequestId
      if (
        input.clientRequestId &&
        context.clientRequestId &&
        input.clientRequestId !== context.clientRequestId
      ) {
        throw new Error(
          `CLIENT_REQUEST_ID_MISMATCH: Input clientRequestId '${input.clientRequestId}' does not match context clientRequestId '${context.clientRequestId}'.`
        );
      }
      const clientRequestId = context.clientRequestId ?? input.clientRequestId ?? null;
      const now = context.now || new Date();

      // 1. Authoritative Identity Hydration
      const identity = await dataProvider.getIdentity(actorUserId);
      if (!identity || identity.status !== "AKTIF") {
        throw new Error(`AUTHENTICATION_REQUIRED: User '${actorUserId}' does not exist or is not active.`);
      }

      // 2. Validate target santri existence
      if (!input.santriId || input.santriId.trim() === "") {
        throw new Error("SANTRI_REQUIRED: santriId must be provided.");
      }

      const santri = await db.santri.findUnique({
        where: { id: input.santriId },
        select: { id: true, nama: true },
      });
      if (!santri) {
        throw new Error(`SANTRI_NOT_FOUND: Santri with ID '${input.santriId}' does not exist.`);
      }

      // 3. Resolve authoritative resource context
      const resolvedResourceContext = await dataProvider.resolveResourceContext(
        { santriId: santri.id },
        actorUserId,
        HEALTH_CAPABILITIES.CREATE
      );

      // 4. Authoritative Canonical Evaluation
      const authDecision = await authorizeCanonical({
        identity,
        capability: HEALTH_CAPABILITIES.CREATE,
        resourceContext: { santriId: santri.id },
        resolvedContext: resolvedResourceContext || undefined,
        executorContext: context.humanExecutorId
          ? {
              technicalAccountId: actorUserId,
              technicalAccountUsername: identity.username,
              humanExecutorId: context.humanExecutorId,
              humanExecutorName: "", // Server resolves verified identity; caller name ignored
              unitId: identity.placementUnitId || "",
              assignmentId: "",
            }
          : undefined,
        isMutation: true,
        now,
        dataProvider,
      });

      if (authDecision.decision !== "ALLOW") {
        if (authDecision.reasonCode === "UNIT_EXECUTOR_REQUIRED") {
          throw new Error("UNIT_EXECUTOR_REQUIRED: Unit accounts recording health cases require a verified human executor.");
        }
        if (authDecision.reasonCode === "UNIT_EXECUTOR_INVALID") {
          throw new Error(`UNIT_EXECUTOR_INVALID: ${authDecision.reason}`);
        }
        if (authDecision.code === "SCOPE_MISMATCH") {
          throw new Error(`OUT_OF_SCOPE_ACCESS_DENIED: ${authDecision.reason}`);
        }
        throw new Error(`PERMISSION_DENIED: ${authDecision.reason}`);
      }

      // 5. Blocker 4: Authoritative Audit Provenance Must Fail Closed (No Fallbacks)
      const authoritativeUnitId =
        authDecision.grantUsed?.anchorUnitId || authDecision.evaluatedUnitIds?.[0];
      if (
        !authDecision.assignmentId ||
        !authDecision.positionCode ||
        !authDecision.capabilityCode ||
        !authDecision.scopeType ||
        !authoritativeUnitId
      ) {
        throw new Error(
          "AUTH_DECISION_INCOMPLETE: Authorization decision is missing required authoritative provenance (assignmentId, positionCode, capabilityCode, scopeType, or authoritative unitId)."
        );
      }

      // 6. Blocker 1: Server-side canonical executor identity normalization
      let canonicalExecutorUserId: string | null = null;
      let canonicalExecutorName: string | null = null;
      if (authDecision.verifiedExecutor) {
        canonicalExecutorUserId = authDecision.verifiedExecutor.userId || authDecision.verifiedExecutor.id || null;
        canonicalExecutorName = authDecision.verifiedExecutor.name;
      } else if (context.humanExecutorId) {
        const verified = await dataProvider.verifyHumanExecutor(context.humanExecutorId);
        if (!verified || !verified.isActive) {
          throw new Error("UNIT_EXECUTOR_INVALID: Human executor profile is not active or could not be verified.");
        }
        canonicalExecutorUserId = verified.userId || verified.id || null;
        canonicalExecutorName = verified.name;
      }

      // 7. Validate keluhan & tindakanAwal
      const keluhan = input.keluhan?.trim();
      if (!keluhan) {
        throw new Error("KELUHAN_REQUIRED: Keluhan is required for health case initial record.");
      }

      const tindakanAwal = input.tindakanAwal?.trim();
      if (!tindakanAwal) {
        throw new Error("TINDAKAN_AWAL_REQUIRED: Tindakan awal is required for health case initial record.");
      }

      // 8. Validate and sanitize status
      const rawStatus = input.statusV2 || "DIPANTAU";
      if (!isCanonicalHealthStatusV2(rawStatus)) {
        throw new Error(`INVALID_HEALTH_STATUS_V2: Status '${rawStatus}' is not one of: ${CANONICAL_HEALTH_STATUSES_V2.join(", ")}`);
      }
      const statusV2: HealthStatusV2 = rawStatus;

      // 9. Data honesty: diagnosa optional, empty persists as NULL
      const diagnosa = input.diagnosa && input.diagnosa.trim().length > 0 ? input.diagnosa.trim() : null;
      const catatan = input.catatan && input.catatan.trim().length > 0 ? input.catatan.trim() : null;
      const attachmentUrl = input.attachmentUrl && input.attachmentUrl.trim().length > 0 ? input.attachmentUrl.trim() : null;
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

      // 10. Blocker 2: Atomic Transaction (HealthCaseV2 create + canonical audit create)
      const { created, canonicalAuditRecord } = await runTransaction(db, async (tx) => {
        const createdRecord = await tx.healthCaseV2.create({
          data: {
            santriId: santri.id,
            occurredAt,
            keluhan,
            tindakanAwal,
            diagnosa,
            catatan,
            attachmentUrl,
            statusV2,
            recordedByUserId: actorUserId,
            recordedByStaffId: identity.staffId || null,
          },
        });

        const auditLog = await logCanonicalAudit(
          {
            technicalAccountId: actorUserId,
            technicalAccountUsername: identity.username,
            humanExecutorId: canonicalExecutorUserId,
            humanExecutorName: canonicalExecutorName,
            action: "health.case.create",
            entity: "HealthCaseV2",
            entityId: createdRecord.id,
            capabilityCode: authDecision.capabilityCode!,
            assignmentId: authDecision.assignmentId!,
            positionCode: authDecision.positionCode!,
            scopeType: authDecision.scopeType as ScopeType,
            unitId: authoritativeUnitId,
            beforeState: null,
            afterState: {
              id: createdRecord.id,
              santriId: createdRecord.santriId,
              statusV2: createdRecord.statusV2,
              keluhan: createdRecord.keluhan,
              tindakanAwal: createdRecord.tindakanAwal,
              diagnosa: createdRecord.diagnosa,
            },
            resourceContext: {
              santriId: santri.id,
              kamarId: resolvedResourceContext?.kamarId || null,
            },
            reason: null,
            clientRequestId,
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null,
            timestamp: createdRecord.createdAt,
          },
          auditSink,
          tx
        );

        return { created: createdRecord, canonicalAuditRecord: auditLog };
      });

      const audit: HealthV2OperationAudit = {
        id: canonicalAuditRecord.id,
        action: canonicalAuditRecord.action,
        actorUserId: canonicalAuditRecord.technicalAccountId,
        actorStaffId: identity.staffId || null,
        humanExecutorId: canonicalAuditRecord.humanExecutorId,
        humanExecutorUsername: canonicalAuditRecord.humanExecutorName,
        positionCode: canonicalAuditRecord.positionCode,
        capability: canonicalAuditRecord.capabilityCode,
        scope: canonicalAuditRecord.scopeType,
        targetSantriId: santri.id,
        previousStatus: null,
        newStatus: statusV2,
        occurredAt: created.occurredAt,
        createdAt: created.createdAt,
      };

      return {
        success: true,
        data: {
          id: created.id,
          santriId: created.santriId,
          occurredAt: created.occurredAt,
          keluhan: created.keluhan,
          tindakanAwal: created.tindakanAwal,
          diagnosa: created.diagnosa,
          catatan: created.catatan,
          attachmentUrl: created.attachmentUrl,
          statusV2: created.statusV2 as HealthStatusV2,
          recordedByUserId: created.recordedByUserId,
          recordedByStaffId: created.recordedByStaffId,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        audit,
      };
    },

    /**
     * Updates status of an existing Health V2 Case.
     * Enforces:
     * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
     * - Server-side canonical human executor verification (Blocker 1)
     * - Mutation, Event, and Audit atomicity inside transaction; rolls back on failure (Blocker 2)
     * - Audit decision fail-closed: missing provenance throws AUTH_DECISION_INCOMPLETE (Blocker 4)
     * - Tindakan awal immutability: initial treatment is NEVER modified
     * - Follow-up treatment recorded separately in HealthCaseV2Event
     * - Request context owns clientRequestId single-source-of-truth (Blocker 7)
     */
    async updateCaseStatus(
      input: UpdateHealthCaseV2StatusInput,
      context: HealthV2RequestContext
    ): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
      const actorUserId = context.actorUserId || (context as unknown as { userId?: string }).userId;
      if (!actorUserId || actorUserId.trim() === "") {
        throw new Error("AUTHENTICATION_REQUIRED: actorUserId is required.");
      }

      // Blocker 7: Single source of truth for clientRequestId
      if (
        input.clientRequestId &&
        context.clientRequestId &&
        input.clientRequestId !== context.clientRequestId
      ) {
        throw new Error(
          `CLIENT_REQUEST_ID_MISMATCH: Input clientRequestId '${input.clientRequestId}' does not match context clientRequestId '${context.clientRequestId}'.`
        );
      }
      const clientRequestId = context.clientRequestId ?? input.clientRequestId ?? null;
      const now = context.now || new Date();

      // 1. Authoritative Identity Hydration
      const identity = await dataProvider.getIdentity(actorUserId);
      if (!identity || identity.status !== "AKTIF") {
        throw new Error(`AUTHENTICATION_REQUIRED: User '${actorUserId}' does not exist or is not active.`);
      }

      // 2. Validate canonical status
      if (!isCanonicalHealthStatusV2(input.newStatus)) {
        throw new Error(`INVALID_HEALTH_STATUS_V2: Status '${input.newStatus}' is not one of: ${CANONICAL_HEALTH_STATUSES_V2.join(", ")}`);
      }

      // 3. Find existing case
      const existing = await db.healthCaseV2.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new Error(`HEALTH_CASE_NOT_FOUND: Health case with ID '${input.id}' does not exist.`);
      }

      // 4. Resolve authoritative resource context
      const resolvedResourceContext = await dataProvider.resolveResourceContext(
        { santriId: existing.santriId },
        actorUserId,
        HEALTH_CAPABILITIES.UPDATE_STATUS
      );

      // 5. Authoritative Canonical Evaluation
      const authDecision = await authorizeCanonical({
        identity,
        capability: HEALTH_CAPABILITIES.UPDATE_STATUS,
        resourceContext: { santriId: existing.santriId },
        resolvedContext: resolvedResourceContext || undefined,
        executorContext: context.humanExecutorId
          ? {
              technicalAccountId: actorUserId,
              technicalAccountUsername: identity.username,
              humanExecutorId: context.humanExecutorId,
              humanExecutorName: "", // Server resolves verified identity; caller name ignored
              unitId: identity.placementUnitId || "",
              assignmentId: "",
            }
          : undefined,
        isMutation: true,
        now,
        dataProvider,
      });

      if (authDecision.decision !== "ALLOW") {
        if (authDecision.reasonCode === "UNIT_EXECUTOR_REQUIRED") {
          throw new Error("UNIT_EXECUTOR_REQUIRED: Unit accounts updating health case status require a verified human executor.");
        }
        if (authDecision.reasonCode === "UNIT_EXECUTOR_INVALID") {
          throw new Error(`UNIT_EXECUTOR_INVALID: ${authDecision.reason}`);
        }
        if (authDecision.code === "SCOPE_MISMATCH") {
          throw new Error(`OUT_OF_SCOPE_ACCESS_DENIED: ${authDecision.reason}`);
        }
        throw new Error(`PERMISSION_DENIED: ${authDecision.reason}`);
      }

      // 6. Blocker 4: Authoritative Audit Provenance Must Fail Closed (No Fallbacks)
      const authoritativeUnitId =
        authDecision.grantUsed?.anchorUnitId || authDecision.evaluatedUnitIds?.[0];
      if (
        !authDecision.assignmentId ||
        !authDecision.positionCode ||
        !authDecision.capabilityCode ||
        !authDecision.scopeType ||
        !authoritativeUnitId
      ) {
        throw new Error(
          "AUTH_DECISION_INCOMPLETE: Authorization decision is missing required authoritative provenance (assignmentId, positionCode, capabilityCode, scopeType, or authoritative unitId)."
        );
      }

      // 7. Blocker 1: Server-side canonical executor identity normalization
      let canonicalExecutorUserId: string | null = null;
      let canonicalExecutorName: string | null = null;
      if (authDecision.verifiedExecutor) {
        canonicalExecutorUserId = authDecision.verifiedExecutor.userId || authDecision.verifiedExecutor.id || null;
        canonicalExecutorName = authDecision.verifiedExecutor.name;
      } else if (context.humanExecutorId) {
        const verified = await dataProvider.verifyHumanExecutor(context.humanExecutorId);
        if (!verified || !verified.isActive) {
          throw new Error("UNIT_EXECUTOR_INVALID: Human executor profile is not active or could not be verified.");
        }
        canonicalExecutorUserId = verified.userId || verified.id || null;
        canonicalExecutorName = verified.name;
      }

      const previousStatus = existing.statusV2 as HealthStatusV2;
      const newStatus = input.newStatus;
      const tindakanLanjutan = input.tindakanLanjutan?.trim() || input.tindakanTambahan?.trim() || null;

      // Tindakan Awal Immutability: initial treatment is NEVER modified
      const updatedCatatan = input.catatan && input.catatan.trim().length > 0
        ? input.catatan.trim()
        : existing.catatan;

      // 8. Blocker 2: Atomic Transaction (HealthCaseV2 update + HealthCaseV2Event create + canonical audit create)
      const { updated, event, canonicalAuditRecord } = await runTransaction(db, async (tx) => {
        const updatedRecord = await tx.healthCaseV2.update({
          where: { id: input.id },
          data: {
            statusV2: newStatus,
            // tindakanAwal strictly untouched
            catatan: updatedCatatan,
          },
        });

        // Persist separate event for follow-up treatment history
        // ONLY verified canonical User.id is stored in human_executor_id
        const eventRecord = await tx.healthCaseV2Event.create({
          data: {
            caseId: existing.id,
            previousStatus,
            newStatus,
            tindakanLanjutan,
            catatan: input.catatan?.trim() || null,
            recordedByUserId: actorUserId,
            recordedByStaffId: identity.staffId || null,
            humanExecutorId: canonicalExecutorUserId,
          },
        });

        const auditLog = await logCanonicalAudit(
          {
            technicalAccountId: actorUserId,
            technicalAccountUsername: identity.username,
            humanExecutorId: canonicalExecutorUserId,
            humanExecutorName: canonicalExecutorName,
            action: "health.case.update_status",
            entity: "HealthCaseV2",
            entityId: existing.id,
            capabilityCode: authDecision.capabilityCode!,
            assignmentId: authDecision.assignmentId!,
            positionCode: authDecision.positionCode!,
            scopeType: authDecision.scopeType as ScopeType,
            unitId: authoritativeUnitId,
            beforeState: {
              statusV2: previousStatus,
              catatan: existing.catatan,
            },
            afterState: {
              statusV2: newStatus,
              tindakanLanjutan,
              catatan: updatedCatatan,
              eventId: eventRecord.id,
            },
            resourceContext: {
              santriId: existing.santriId,
              kamarId: resolvedResourceContext?.kamarId || null,
            },
            reason: null,
            clientRequestId,
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null,
            timestamp: new Date(),
          },
          auditSink,
          tx
        );

        return { updated: updatedRecord, event: eventRecord, canonicalAuditRecord: auditLog };
      });

      const audit: HealthV2OperationAudit = {
        id: canonicalAuditRecord.id,
        action: canonicalAuditRecord.action,
        actorUserId: canonicalAuditRecord.technicalAccountId,
        actorStaffId: identity.staffId || null,
        humanExecutorId: canonicalAuditRecord.humanExecutorId,
        humanExecutorUsername: canonicalAuditRecord.humanExecutorName,
        positionCode: canonicalAuditRecord.positionCode,
        capability: canonicalAuditRecord.capabilityCode,
        scope: canonicalAuditRecord.scopeType,
        targetSantriId: existing.santriId,
        previousStatus,
        newStatus,
        occurredAt: existing.occurredAt,
        createdAt: canonicalAuditRecord.timestamp,
      };

      const eventDto: HealthCaseV2EventDTO = {
        id: event.id,
        caseId: event.caseId,
        previousStatus: event.previousStatus as HealthStatusV2 | null,
        newStatus: event.newStatus as HealthStatusV2,
        tindakanLanjutan: event.tindakanLanjutan,
        catatan: event.catatan,
        recordedByUserId: event.recordedByUserId,
        recordedByStaffId: event.recordedByStaffId,
        humanExecutorId: event.humanExecutorId,
        createdAt: event.createdAt,
      };

      return {
        success: true,
        data: {
          id: updated.id,
          santriId: updated.santriId,
          occurredAt: updated.occurredAt,
          keluhan: updated.keluhan,
          tindakanAwal: updated.tindakanAwal, // Immutability preserved
          diagnosa: updated.diagnosa,
          catatan: updated.catatan,
          attachmentUrl: updated.attachmentUrl,
          statusV2: updated.statusV2 as HealthStatusV2,
          recordedByUserId: updated.recordedByUserId,
          recordedByStaffId: updated.recordedByStaffId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          events: [eventDto],
        },
        audit,
      };
    },

    /**
     * Fetches clinical details of a single Health V2 case.
     * Enforces:
     * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
     * - Explicit detail capability (health.case.read_detail)
     * - Generic OSDA membership alone confers zero detail access
     * - Aggregate capability does NOT imply detail capability
     * - Pembina Asrama access is strictly KAMAR-scoped (different kamar -> OUT_OF_SCOPE_ACCESS_DENIED)
     */
    async getCaseDetail(
      id: string,
      context: HealthV2RequestContext
    ): Promise<{ success: boolean; data: HealthCaseV2DTO }> {
      const actorUserId = context.actorUserId || (context as unknown as { userId?: string }).userId;
      if (!actorUserId || actorUserId.trim() === "") {
        throw new Error("AUTHENTICATION_REQUIRED: actorUserId is required.");
      }
      const now = context.now || new Date();

      // 1. Authoritative Identity Hydration
      const identity = await dataProvider.getIdentity(actorUserId);
      if (!identity || identity.status !== "AKTIF") {
        throw new Error(`AUTHENTICATION_REQUIRED: User '${actorUserId}' does not exist or is not active.`);
      }

      // 2. Find case
      const record = await db.healthCaseV2.findUnique({
        where: { id },
        include: {
          events: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!record) {
        throw new Error(`HEALTH_CASE_NOT_FOUND: Health case with ID '${id}' does not exist.`);
      }

      // 3. Resolve authoritative resource context for target santri
      const resolvedResourceContext = await dataProvider.resolveResourceContext(
        { santriId: record.santriId },
        actorUserId,
        HEALTH_CAPABILITIES.READ_DETAIL
      );

      // 4. Authoritative Canonical Evaluation for Detail Read (Blocker A)
      const detailAuthDecision = await authorizeCanonical({
        identity,
        capability: HEALTH_CAPABILITIES.READ_DETAIL,
        resourceContext: { santriId: record.santriId },
        resolvedContext: resolvedResourceContext || undefined,
        isMutation: false,
        now,
        dataProvider,
      });

      if (detailAuthDecision.decision !== "ALLOW") {
        // Check if user has aggregate capability only
        const aggAuthDecision = await authorizeCanonical({
          identity,
          capability: HEALTH_CAPABILITIES.READ_AGGREGATE,
          resourceContext: { santriId: record.santriId },
          resolvedContext: resolvedResourceContext || undefined,
          isMutation: false,
          now,
          dataProvider,
        });

        if (aggAuthDecision.decision === "ALLOW") {
          throw new Error("DETAIL_ACCESS_DENIED: Aggregate capability does not imply detail clinical capability.");
        }

        if (detailAuthDecision.code === "SCOPE_MISMATCH") {
          throw new Error(
            "OUT_OF_SCOPE_ACCESS_DENIED: Pembina Asrama cannot access clinical health details for santri in a different kamar."
          );
        }

        throw new Error("DETAIL_ACCESS_DENIED: User lacks 'health.case.read_detail' capability.");
      }

      const events: HealthCaseV2EventDTO[] = (record.events || []).map((e) => ({
        id: e.id,
        caseId: e.caseId,
        previousStatus: e.previousStatus as HealthStatusV2 | null,
        newStatus: e.newStatus as HealthStatusV2,
        tindakanLanjutan: e.tindakanLanjutan,
        catatan: e.catatan,
        recordedByUserId: e.recordedByUserId,
        recordedByStaffId: e.recordedByStaffId,
        humanExecutorId: e.humanExecutorId,
        createdAt: e.createdAt,
      }));

      return {
        success: true,
        data: {
          id: record.id,
          santriId: record.santriId,
          occurredAt: record.occurredAt,
          keluhan: record.keluhan,
          tindakanAwal: record.tindakanAwal,
          diagnosa: record.diagnosa,
          catatan: record.catatan,
          attachmentUrl: record.attachmentUrl,
          statusV2: record.statusV2 as HealthStatusV2,
          recordedByUserId: record.recordedByUserId,
          recordedByStaffId: record.recordedByStaffId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          events,
        },
      };
    },

    /**
     * Fetches aggregated Health statistics without exposing clinical details.
     * Enforces:
     * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
     * - Blocker 3: Aggregate authorization and DB filtering derive allowed scope server-side from canonical grant
     *   - KAMAR: derived from authoritative assignment; query constrained to that kamar; cannot widen
     *   - GLOBAL: institutional aggregate allowed
     *   - Pembina with no authoritative kamar: DENY
     * - Returns counts only: zero diagnosa, zero keluhan, zero patient notes exposed
     */
    async getCasesAggregate(
      filter: HealthCaseV2AggregateFilter,
      context: HealthV2RequestContext
    ): Promise<{ success: boolean; data: HealthCaseV2AggregateResult }> {
      const actorUserId = context.actorUserId || (context as unknown as { userId?: string }).userId;
      if (!actorUserId || actorUserId.trim() === "") {
        throw new Error("AUTHENTICATION_REQUIRED: actorUserId is required.");
      }
      const now = context.now || new Date();

      // 1. Authoritative Identity Hydration
      const identity = await dataProvider.getIdentity(actorUserId);
      if (!identity || identity.status !== "AKTIF") {
        throw new Error(`AUTHENTICATION_REQUIRED: User '${actorUserId}' does not exist or is not active.`);
      }

      // 2. Blocker 3: Authoritative Grant & Scope Resolution from canonical active assignments
      const activeAssignments = await dataProvider.getActiveAssignments(actorUserId, now);

      const validGrants: Array<{
        assignment: CanonicalAssignmentWithDetails;
        capabilityCode: string;
        scopeType: ScopeType;
      }> = [];

      for (const a of activeAssignments) {
        const capabilities =
          a.positionCapabilities ||
          (a as unknown as { position?: { capabilities?: typeof a.positionCapabilities } }).position
            ?.capabilities ||
          [];
        for (const pc of capabilities) {
          if (
            (pc.capabilityCode === HEALTH_CAPABILITIES.READ_AGGREGATE ||
              pc.capabilityCode === HEALTH_CAPABILITIES.READ_DETAIL) &&
            pc.businessRuleState === "VERIFIED_PRODUCTION"
          ) {
            validGrants.push({
              assignment: a,
              capabilityCode: pc.capabilityCode,
              scopeType: pc.scopeType as ScopeType,
            });
          }
        }
      }

      if (validGrants.length === 0) {
        throw new Error("AGGREGATE_ACCESS_DENIED: User lacks 'health.case.read_aggregate' capability.");
      }

      const globalGrant = validGrants.find((g) => g.scopeType === "GLOBAL");
      const kamarGrant = validGrants.find((g) => g.scopeType === "KAMAR");
      const unitGrant = validGrants.find((g) => g.scopeType === "UNIT" || g.scopeType === "ASSIGNED_UNITS");

      let forcedKamarId: string | null = null;
      let forcedUnitIds: string[] | null = null;

      if (globalGrant) {
        // GLOBAL institutional aggregate
        const authDecision = await authorizeCanonical({
          identity,
          capability: globalGrant.capabilityCode,
          resourceContext: {},
          isMutation: false,
          now,
          dataProvider,
        });
        if (authDecision.decision !== "ALLOW") {
          throw new Error(`AGGREGATE_ACCESS_DENIED: ${authDecision.reason}`);
        }
        // Caller filter may narrow to a specific room if requested
        if (filter.kamarId) {
          forcedKamarId = filter.kamarId;
        }
      } else if (kamarGrant) {
        // PEMBINA_ASRAMA: derive authoritative kamar from canonical assignment
        const authoritativeKamarId = kamarGrant.assignment.unitId;
        if (!authoritativeKamarId || authoritativeKamarId.trim() === "") {
          throw new Error("OUT_OF_SCOPE_ACCESS_DENIED: Pembina Asrama has no authoritative kamar assignment.");
        }

        // Authorize strictly for authoritative room
        const authDecision = await authorizeCanonical({
          identity,
          capability: kamarGrant.capabilityCode,
          resourceContext: { kamarId: authoritativeKamarId },
          resolvedContext: { kamarId: authoritativeKamarId, orgUnitIds: [authoritativeKamarId] },
          isMutation: false,
          now,
          dataProvider,
        });

        if (authDecision.decision !== "ALLOW") {
          throw new Error(`AGGREGATE_ACCESS_DENIED: ${authDecision.reason}`);
        }

        // Caller cannot widen to another kamar!
        if (filter.kamarId && filter.kamarId !== authoritativeKamarId) {
          throw new Error(
            `OUT_OF_SCOPE_ACCESS_DENIED: Caller cannot widen aggregate query to kamar '${filter.kamarId}' outside authoritative assigned kamar '${authoritativeKamarId}'.`
          );
        }

        // Must be constrained to authoritative room
        forcedKamarId = authoritativeKamarId;
      } else if (unitGrant) {
        if (unitGrant.scopeType === "UNIT") {
          const unitId = unitGrant.assignment.unitId;
          if (!unitId) {
            throw new Error("OUT_OF_SCOPE_ACCESS_DENIED: Unit assignment has no unitId.");
          }
          forcedUnitIds = [unitId];
        } else {
          forcedUnitIds = unitGrant.assignment.scopeUnits.map((su) => su.unitId);
        }
      } else {
        throw new Error("AGGREGATE_ACCESS_DENIED: User has no valid scope for aggregate read.");
      }

      // 3. Build Prisma where clause
      const where: Prisma.HealthCaseV2WhereInput = {};

      if (filter.startDate || filter.endDate) {
        where.occurredAt = {};
        if (filter.startDate) {
          where.occurredAt.gte = filter.startDate;
        }
        if (filter.endDate) {
          where.occurredAt.lte = filter.endDate;
        }
      }

      if (forcedKamarId) {
        where.santri = {
          kamarPlacements: {
            some: {
              kamarId: forcedKamarId,
              isActive: true,
            },
          },
        };
      } else if (forcedUnitIds && forcedUnitIds.length > 0) {
        where.santri = {
          kamarPlacements: {
            some: {
              kamarId: { in: forcedUnitIds },
              isActive: true,
            },
          },
        };
      }

      // 4. Query group by status - counts only, zero clinical detail
      const grouped = await db.healthCaseV2.groupBy({
        by: ["statusV2"],
        where,
        _count: {
          _all: true,
        },
      });

      const byStatus: Record<HealthStatusV2, number> = {
        DIPANTAU: 0,
        PULIH: 0,
        DIRUJUK: 0,
        DARURAT: 0,
      };

      let totalCases = 0;
      for (const item of grouped) {
        const status = item.statusV2 as HealthStatusV2;
        if (status in byStatus) {
          byStatus[status] = item._count._all;
          totalCases += item._count._all;
        }
      }

      const activeCases = byStatus.DIPANTAU + byStatus.DIRUJUK + byStatus.DARURAT;
      const recoveredCases = byStatus.PULIH;

      return {
        success: true,
        data: {
          totalCases,
          activeCases,
          recoveredCases,
          byStatus,
        },
      };
    },
  };
}

/**
 * Backward-compatible wrapper delegating to createHealthV2Service.
 */
export async function saveHealthCaseV2Core(
  db: PrismaClient,
  input: CreateHealthCaseV2Input,
  context: HealthCaseV2AuditContext
): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
  const service = createHealthV2Service({
    db,
    dataProvider: context.dataProvider,
    auditSink: context.auditSink,
  });
  return service.createCase(input, {
    actorUserId: context.actorUserId || context.userId!,
    humanExecutorId: context.humanExecutorId,
    clientRequestId: context.clientRequestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    now: context.now,
  });
}

/**
 * Backward-compatible wrapper delegating to createHealthV2Service.
 */
export async function updateHealthCaseV2StatusCore(
  db: PrismaClient,
  input: UpdateHealthCaseV2StatusInput,
  context: HealthCaseV2AuditContext
): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
  const service = createHealthV2Service({
    db,
    dataProvider: context.dataProvider,
    auditSink: context.auditSink,
  });
  return service.updateCaseStatus(input, {
    actorUserId: context.actorUserId || context.userId!,
    humanExecutorId: context.humanExecutorId,
    clientRequestId: context.clientRequestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    now: context.now,
  });
}

/**
 * Backward-compatible wrapper delegating to createHealthV2Service.
 */
export async function getHealthCaseV2DetailCore(
  db: PrismaClient,
  id: string,
  context: HealthCaseV2DetailContext
): Promise<{ success: boolean; data: HealthCaseV2DTO }> {
  const service = createHealthV2Service({
    db,
    dataProvider: context.dataProvider,
  });
  return service.getCaseDetail(id, {
    actorUserId: context.actorUserId,
    now: context.now,
  });
}

/**
 * Backward-compatible wrapper delegating to createHealthV2Service.
 */
export async function getHealthCasesV2AggregateCore(
  db: PrismaClient,
  filter: HealthCaseV2AggregateFilter,
  context: HealthCaseV2AggregateContext
): Promise<{ success: boolean; data: HealthCaseV2AggregateResult }> {
  const service = createHealthV2Service({
    db,
    dataProvider: context.dataProvider,
  });
  return service.getCasesAggregate(filter, {
    actorUserId: context.actorUserId,
    now: context.now,
  });
}
