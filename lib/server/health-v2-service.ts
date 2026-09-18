import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";
import {
  CANONICAL_HEALTH_STATUSES_V2,
  HealthStatusV2,
  isCanonicalHealthStatusV2,
  HealthCaseV2DTO,
  HealthCaseV2EventDTO,
  HealthCaseV2AuditContext,
  CreateHealthCaseV2Input,
  UpdateHealthCaseV2StatusInput,
} from "@/lib/health-v2";
import { HEALTH_CAPABILITIES, ScopeType } from "@/types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
} from "@/lib/auth/canonical-evaluator";
import {
  logCanonicalAudit,
  activeAuditSink,
  IAuditSink,
} from "@/lib/auth/canonical-audit";

export interface HealthCaseV2DetailContext {
  actorUserId: string;
  actorRole?: string;
  positionCode?: string;
  capabilities?: string[];
  isOsdaGeneric?: boolean;
  scopeType?: ScopeType | "KAMAR" | "GLOBAL" | "ASSIGNED_UNITS";
  assignedKamarId?: string | null;
  dataProvider?: ICanonicalDataProvider;
  now?: Date;
}

export interface HealthCaseV2AggregateContext {
  actorUserId: string;
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
 * Creates a new Health V2 Case in the database.
 * Enforces:
 * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
 * - Required server-side human executor verification for UNIT accounts (Blocker B)
 * - Real canonical audit persistence with context derived from authorization decision (Blocker C)
 * - Exact canonical status (DIPANTAU, PULIH, DIRUJUK, DARURAT)
 * - Required keluhan and tindakanAwal
 * - Optional diagnosa: persisted as NULL if empty, never fake default (Data honesty)
 * - Relational integrity: recordedByUser -> User, recordedByStaff -> Staff (Blocker E)
 */
export async function saveHealthCaseV2Core(
  db: PrismaClient,
  input: CreateHealthCaseV2Input,
  context: HealthCaseV2AuditContext
): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
  const dataProvider: ICanonicalDataProvider =
    context.dataProvider || createPrismaDataProvider(db);
  const auditSink: IAuditSink = context.auditSink || activeAuditSink;
  const now = context.now || new Date();

  // 1. Authoritative Identity Hydration
  const identity = await dataProvider.getIdentity(context.userId);
  if (!identity || identity.status !== "AKTIF") {
    throw new Error(`AUTHENTICATION_REQUIRED: User '${context.userId}' does not exist or is not active.`);
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

  // 3. Resolve authoritative resource context (room placement, halaqoh, etc.)
  const resolvedResourceContext = await dataProvider.resolveResourceContext(
    { santriId: santri.id },
    context.userId,
    HEALTH_CAPABILITIES.CREATE
  );

  // 4. Authoritative Canonical Evaluation (Blocker A & B)
  const authDecision = await authorizeCanonical({
    identity,
    capability: HEALTH_CAPABILITIES.CREATE,
    resourceContext: { santriId: santri.id },
    resolvedContext: resolvedResourceContext || undefined,
    executorContext: context.humanExecutorId
      ? {
          technicalAccountId: context.userId,
          technicalAccountUsername: identity.username,
          humanExecutorId: context.humanExecutorId,
          humanExecutorName: context.humanExecutorUsername || "",
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

  // 5. Validate keluhan & tindakanAwal
  const keluhan = input.keluhan?.trim();
  if (!keluhan) {
    throw new Error("KELUHAN_REQUIRED: Keluhan is required for health case initial record.");
  }

  const tindakanAwal = input.tindakanAwal?.trim();
  if (!tindakanAwal) {
    throw new Error("TINDAKAN_AWAL_REQUIRED: Tindakan awal is required for health case initial record.");
  }

  // 6. Validate and sanitize status
  const rawStatus = input.statusV2 || "DIPANTAU";
  if (!isCanonicalHealthStatusV2(rawStatus)) {
    throw new Error(`INVALID_HEALTH_STATUS_V2: Status '${rawStatus}' is not one of: ${CANONICAL_HEALTH_STATUSES_V2.join(", ")}`);
  }
  const statusV2: HealthStatusV2 = rawStatus;

  // 7. Data honesty: diagnosa is optional, empty/omitted string persists as NULL
  const diagnosa = input.diagnosa && input.diagnosa.trim().length > 0 ? input.diagnosa.trim() : null;
  const catatan = input.catatan && input.catatan.trim().length > 0 ? input.catatan.trim() : null;
  const attachmentUrl = input.attachmentUrl && input.attachmentUrl.trim().length > 0 ? input.attachmentUrl.trim() : null;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  // 8. Persist to additive table health_cases_v2 with strengthened relations (Blocker E)
  const created = await db.healthCaseV2.create({
    data: {
      santriId: santri.id,
      occurredAt,
      keluhan,
      tindakanAwal, // Tindakan awal immutable
      diagnosa,
      catatan,
      attachmentUrl,
      statusV2,
      recordedByUserId: context.userId,
      recordedByStaffId: identity.staffId || null,
    },
  });

  // 9. Real Canonical Audit Persistence (Blocker C)
  const canonicalAuditRecord = await logCanonicalAudit(
    {
      technicalAccountId: context.userId,
      technicalAccountUsername: identity.username,
      humanExecutorId: context.humanExecutorId || null,
      humanExecutorName: context.humanExecutorUsername || null,
      action: "health.case.create",
      entity: "HealthCaseV2",
      entityId: created.id,
      capabilityCode: authDecision.capabilityCode || HEALTH_CAPABILITIES.CREATE,
      assignmentId: authDecision.assignmentId || null,
      positionCode: authDecision.positionCode || "UNKNOWN",
      scopeType: (authDecision.scopeType as ScopeType) || "GLOBAL",
      unitId: authDecision.grantUsed?.anchorUnitId || (authDecision.evaluatedUnitIds?.[0] ?? "GLOBAL"),
      beforeState: null,
      afterState: {
        id: created.id,
        santriId: created.santriId,
        statusV2: created.statusV2,
        keluhan: created.keluhan,
        tindakanAwal: created.tindakanAwal,
        diagnosa: created.diagnosa,
      },
      resourceContext: {
        santriId: santri.id,
        kamarId: resolvedResourceContext?.kamarId || null,
      },
      reason: null,
      clientRequestId: context.clientRequestId || null,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      timestamp: created.createdAt,
    },
    auditSink
  );

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
}

/**
 * Updates status of an existing Health V2 Case.
 * Enforces:
 * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
 * - Required server-side human executor verification for UNIT accounts (Blocker B)
 * - Real canonical audit persistence with context derived from authorization decision (Blocker C)
 * - Tindakan Awal Immutability: initial treatment is NEVER overwritten or modified (Blocker D)
 * - Follow-up treatment recorded separately in HealthCaseV2Event (Blocker D)
 * - Exact canonical status validation
 */
export async function updateHealthCaseV2StatusCore(
  db: PrismaClient,
  input: UpdateHealthCaseV2StatusInput,
  context: HealthCaseV2AuditContext
): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
  const dataProvider: ICanonicalDataProvider =
    context.dataProvider || createPrismaDataProvider(db);
  const auditSink: IAuditSink = context.auditSink || activeAuditSink;
  const now = context.now || new Date();

  // 1. Authoritative Identity Hydration
  const identity = await dataProvider.getIdentity(context.userId);
  if (!identity || identity.status !== "AKTIF") {
    throw new Error(`AUTHENTICATION_REQUIRED: User '${context.userId}' does not exist or is not active.`);
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
    context.userId,
    HEALTH_CAPABILITIES.UPDATE_STATUS
  );

  // 5. Authoritative Canonical Evaluation (Blocker A & B)
  const authDecision = await authorizeCanonical({
    identity,
    capability: HEALTH_CAPABILITIES.UPDATE_STATUS,
    resourceContext: { santriId: existing.santriId },
    resolvedContext: resolvedResourceContext || undefined,
    executorContext: context.humanExecutorId
      ? {
          technicalAccountId: context.userId,
          technicalAccountUsername: identity.username,
          humanExecutorId: context.humanExecutorId,
          humanExecutorName: context.humanExecutorUsername || "",
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

  const previousStatus = existing.statusV2 as HealthStatusV2;
  const newStatus = input.newStatus;
  const tindakanLanjutan = input.tindakanLanjutan?.trim() || input.tindakanTambahan?.trim() || null;

  // 6. BLOCKER D — Tindakan Awal Immutability:
  // tindakanAwal is the initial treatment only; it is NEVER overwritten or concatenated.
  // Subsequent treatment/update is stored separately in HealthCaseV2Event.
  const updatedCatatan = input.catatan && input.catatan.trim().length > 0
    ? input.catatan.trim()
    : existing.catatan;

  const updated = await db.healthCaseV2.update({
    where: { id: input.id },
    data: {
      statusV2: newStatus,
      // tindakanAwal is strictly NOT touched
      catatan: updatedCatatan,
    },
  });

  // 7. Persist separate event for follow-up treatment history (Blocker D & E)
  const event = await db.healthCaseV2Event.create({
    data: {
      caseId: existing.id,
      previousStatus,
      newStatus,
      tindakanLanjutan,
      catatan: input.catatan?.trim() || null,
      recordedByUserId: context.userId,
      recordedByStaffId: identity.staffId || null,
      humanExecutorId: context.humanExecutorId || null,
    },
  });

  // 8. Real Canonical Audit Persistence (Blocker C)
  const canonicalAuditRecord = await logCanonicalAudit(
    {
      technicalAccountId: context.userId,
      technicalAccountUsername: identity.username,
      humanExecutorId: context.humanExecutorId || null,
      humanExecutorName: context.humanExecutorUsername || null,
      action: "health.case.update_status",
      entity: "HealthCaseV2",
      entityId: existing.id,
      capabilityCode: authDecision.capabilityCode || HEALTH_CAPABILITIES.UPDATE_STATUS,
      assignmentId: authDecision.assignmentId || null,
      positionCode: authDecision.positionCode || "UNKNOWN",
      scopeType: (authDecision.scopeType as ScopeType) || "GLOBAL",
      unitId: authDecision.grantUsed?.anchorUnitId || (authDecision.evaluatedUnitIds?.[0] ?? "GLOBAL"),
      beforeState: {
        statusV2: previousStatus,
        catatan: existing.catatan,
      },
      afterState: {
        statusV2: newStatus,
        tindakanLanjutan,
        catatan: updatedCatatan,
        eventId: event.id,
      },
      resourceContext: {
        santriId: existing.santriId,
        kamarId: resolvedResourceContext?.kamarId || null,
      },
      reason: null,
      clientRequestId: context.clientRequestId || null,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      timestamp: new Date(),
    },
    auditSink
  );

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
      tindakanAwal: updated.tindakanAwal, // Proved immutable
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
}

/**
 * Fetches clinical details of a single Health V2 case.
 * Enforces:
 * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
 * - Explicit detail capability (health.case.read_detail)
 * - Generic OSDA membership alone confers zero detail access
 * - Aggregate capability does NOT imply detail capability
 * - Pembina Asrama access is strictly KAMAR-scoped (different kamar -> OUT_OF_SCOPE_ACCESS_DENIED)
 */
export async function getHealthCaseV2DetailCore(
  db: PrismaClient,
  id: string,
  context: HealthCaseV2DetailContext
): Promise<{ success: boolean; data: HealthCaseV2DTO }> {
  const dataProvider: ICanonicalDataProvider =
    context.dataProvider || createPrismaDataProvider(db);
  const now = context.now || new Date();

  // 1. Authoritative Identity Hydration
  const identity = await dataProvider.getIdentity(context.actorUserId);
  if (!identity || identity.status !== "AKTIF") {
    throw new Error(`AUTHENTICATION_REQUIRED: User '${context.actorUserId}' does not exist or is not active.`);
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
    context.actorUserId,
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
        `OUT_OF_SCOPE_ACCESS_DENIED: Pembina Asrama cannot access clinical health details for santri in a different kamar.`
      );
    }

    if (context.isOsdaGeneric) {
      throw new Error("DETAIL_ACCESS_DENIED: Generic OSDA membership confers zero clinical detail access.");
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
}

/**
 * Fetches aggregated Health statistics without exposing clinical details.
 * Enforces:
 * - Authoritative evaluation via canonical authorization evaluator (Blocker A)
 * - Requires health.case.read_aggregate (or health.case.read_detail)
 * - Returns counts only: zero diagnosa, zero keluhan, zero patient notes exposed
 */
export async function getHealthCasesV2AggregateCore(
  db: PrismaClient,
  filter: HealthCaseV2AggregateFilter,
  context: HealthCaseV2AggregateContext
): Promise<{ success: boolean; data: HealthCaseV2AggregateResult }> {
  const dataProvider: ICanonicalDataProvider =
    context.dataProvider || createPrismaDataProvider(db);
  const now = context.now || new Date();

  // 1. Authoritative Identity Hydration
  const identity = await dataProvider.getIdentity(context.actorUserId);
  if (!identity || identity.status !== "AKTIF") {
    throw new Error(`AUTHENTICATION_REQUIRED: User '${context.actorUserId}' does not exist or is not active.`);
  }

  // 2. Authoritative Canonical Evaluation for Aggregate Read
  // Allows if either READ_AGGREGATE or READ_DETAIL is granted
  const aggDecision = await authorizeCanonical({
    identity,
    capability: HEALTH_CAPABILITIES.READ_AGGREGATE,
    resourceContext: {},
    isMutation: false,
    now,
    dataProvider,
  });

  let isAllowed = aggDecision.decision === "ALLOW";
  if (!isAllowed) {
    const detailDecision = await authorizeCanonical({
      identity,
      capability: HEALTH_CAPABILITIES.READ_DETAIL,
      resourceContext: {},
      isMutation: false,
      now,
      dataProvider,
    });
    isAllowed = detailDecision.decision === "ALLOW";
  }

  if (!isAllowed) {
    throw new Error("AGGREGATE_ACCESS_DENIED: User lacks 'health.case.read_aggregate' capability.");
  }

  // 3. Build where filter
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

  if (filter.kamarId) {
    where.santri = {
      kamarPlacements: {
        some: {
          kamarId: filter.kamarId,
          isActive: true,
        },
      },
    };
  }

  // 4. Count by status
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
}
