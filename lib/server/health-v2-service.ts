import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";
import {
  CANONICAL_HEALTH_STATUSES_V2,
  HealthStatusV2,
  isCanonicalHealthStatusV2,
  HealthCaseV2DTO,
  HealthCaseV2AuditContext,
  CreateHealthCaseV2Input,
  UpdateHealthCaseV2StatusInput,
} from "@/lib/health-v2";
import { HEALTH_CAPABILITIES, ScopeType } from "@/types/architecture-lock";

export interface HealthCaseV2DetailContext {
  actorUserId: string;
  actorRole?: string;
  positionCode?: string;
  capabilities?: string[];
  isOsdaGeneric?: boolean;
  scopeType?: ScopeType | "KAMAR" | "GLOBAL" | "ASSIGNED_UNITS";
  assignedKamarId?: string | null;
}

export interface HealthCaseV2AggregateContext {
  actorUserId: string;
  actorRole?: string;
  capabilities?: string[];
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
 * - Exact canonical status (DIPANTAU, PULIH, DIRUJUK, DARURAT)
 * - Required keluhan and tindakanAwal
 * - Optional diagnosa: persisted as NULL if empty, never fake default
 * - Dual attribution: technical account + human executor if UNIT account
 * - Rejects UNIT account mutations without verified human executor: UNIT_EXECUTOR_REQUIRED
 */
export async function saveHealthCaseV2Core(
  db: PrismaClient,
  input: CreateHealthCaseV2Input,
  context: HealthCaseV2AuditContext
): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
  // 1. UNIT Account check: human executor required
  if (context.accountType === "UNIT" && (!context.humanExecutorId || context.humanExecutorId.trim() === "")) {
    throw new Error("UNIT_EXECUTOR_REQUIRED: Unit accounts recording health cases require a verified human executor.");
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

  // 3. Validate keluhan & tindakanAwal
  const keluhan = input.keluhan?.trim();
  if (!keluhan) {
    throw new Error("KELUHAN_REQUIRED: Keluhan is required for health case initial record.");
  }

  const tindakanAwal = input.tindakanAwal?.trim();
  if (!tindakanAwal) {
    throw new Error("TINDAKAN_AWAL_REQUIRED: Tindakan awal is required for health case initial record.");
  }

  // 4. Validate and sanitize status
  const rawStatus = input.statusV2 || "DIPANTAU";
  if (!isCanonicalHealthStatusV2(rawStatus)) {
    throw new Error(`INVALID_HEALTH_STATUS_V2: Status '${rawStatus}' is not one of: ${CANONICAL_HEALTH_STATUSES_V2.join(", ")}`);
  }
  const statusV2: HealthStatusV2 = rawStatus;

  // 5. Data honesty: diagnosa is optional, empty/omitted string persists as NULL
  const diagnosa = input.diagnosa && input.diagnosa.trim().length > 0 ? input.diagnosa.trim() : null;
  const catatan = input.catatan && input.catatan.trim().length > 0 ? input.catatan.trim() : null;
  const attachmentUrl = input.attachmentUrl && input.attachmentUrl.trim().length > 0 ? input.attachmentUrl.trim() : null;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  // 6. Persist to additive table health_cases_v2
  const created = await db.healthCaseV2.create({
    data: {
      santriId: santri.id,
      occurredAt,
      keluhan,
      tindakanAwal,
      diagnosa,
      catatan,
      attachmentUrl,
      statusV2,
      recordedByUserId: context.userId,
      recordedByStaffId: context.staffId || null,
    },
  });

  const audit: HealthV2OperationAudit = {
    action: "health.case.create",
    actorUserId: context.userId,
    actorStaffId: context.staffId || null,
    humanExecutorId: context.humanExecutorId || null,
    humanExecutorUsername: context.humanExecutorUsername || null,
    positionCode: context.accountType === "UNIT" ? "OSDA_KESEHATAN_UNIT" : "PETUGAS_KESEHATAN",
    capability: HEALTH_CAPABILITIES.CREATE,
    scope: "GLOBAL",
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
 * - Exact canonical status
 * - UNIT account check
 * - Audit logging with previous and new status
 */
export async function updateHealthCaseV2StatusCore(
  db: PrismaClient,
  input: UpdateHealthCaseV2StatusInput,
  context: HealthCaseV2AuditContext
): Promise<{ success: boolean; data: HealthCaseV2DTO; audit: HealthV2OperationAudit }> {
  // 1. UNIT Account check: human executor required
  if (context.accountType === "UNIT" && (!context.humanExecutorId || context.humanExecutorId.trim() === "")) {
    throw new Error("UNIT_EXECUTOR_REQUIRED: Unit accounts updating health case status require a verified human executor.");
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

  const previousStatus = existing.statusV2 as HealthStatusV2;
  const newStatus = input.newStatus;

  // 4. Update data
  const updatedCatatan = input.catatan && input.catatan.trim().length > 0
    ? (existing.catatan ? `${existing.catatan}\n[Update]: ${input.catatan.trim()}` : input.catatan.trim())
    : existing.catatan;

  const updatedTindakan = input.tindakanTambahan && input.tindakanTambahan.trim().length > 0
    ? `${existing.tindakanAwal}\n[Tindakan Lanjutan]: ${input.tindakanTambahan.trim()}`
    : existing.tindakanAwal;

  const updated = await db.healthCaseV2.update({
    where: { id: input.id },
    data: {
      statusV2: newStatus,
      tindakanAwal: updatedTindakan,
      catatan: updatedCatatan,
    },
  });

  const audit: HealthV2OperationAudit = {
    action: "health.case.update_status",
    actorUserId: context.userId,
    actorStaffId: context.staffId || null,
    humanExecutorId: context.humanExecutorId || null,
    humanExecutorUsername: context.humanExecutorUsername || null,
    positionCode: context.accountType === "UNIT" ? "OSDA_KESEHATAN_UNIT" : "PETUGAS_KESEHATAN",
    capability: HEALTH_CAPABILITIES.UPDATE_STATUS,
    scope: "GLOBAL",
    targetSantriId: existing.santriId,
    previousStatus,
    newStatus,
    occurredAt: existing.occurredAt,
    createdAt: new Date(),
  };

  return {
    success: true,
    data: {
      id: updated.id,
      santriId: updated.santriId,
      occurredAt: updated.occurredAt,
      keluhan: updated.keluhan,
      tindakanAwal: updated.tindakanAwal,
      diagnosa: updated.diagnosa,
      catatan: updated.catatan,
      attachmentUrl: updated.attachmentUrl,
      statusV2: updated.statusV2 as HealthStatusV2,
      recordedByUserId: updated.recordedByUserId,
      recordedByStaffId: updated.recordedByStaffId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
    audit,
  };
}

/**
 * Fetches clinical details of a single Health V2 case.
 * Enforces:
 * - Explicit detail capability (health.case.read_detail)
 * - Generic OSDA membership alone confers zero detail access
 * - Aggregate capability does NOT imply detail capability
 * - Pembina Asrama access is strictly KAMAR-scoped (cannot access cases for santri outside assigned kamar)
 */
export async function getHealthCaseV2DetailCore(
  db: PrismaClient,
  id: string,
  context: HealthCaseV2DetailContext
): Promise<{ success: boolean; data: HealthCaseV2DTO }> {
  // 1. Generic OSDA check: generic OSDA membership confers zero clinical detail capability
  if (context.isOsdaGeneric) {
    throw new Error("DETAIL_ACCESS_DENIED: Generic OSDA membership confers zero clinical detail access.");
  }

  // 2. Capability check: requires health.case.read_detail
  const hasDetailCap = context.capabilities?.includes(HEALTH_CAPABILITIES.READ_DETAIL);
  if (!hasDetailCap) {
    // If only aggregate capability is present, explicitly reject
    const hasAggCap = context.capabilities?.includes(HEALTH_CAPABILITIES.READ_AGGREGATE);
    if (hasAggCap) {
      throw new Error("DETAIL_ACCESS_DENIED: Aggregate capability does not imply detail clinical capability.");
    }
    throw new Error("DETAIL_ACCESS_DENIED: User lacks 'health.case.read_detail' capability.");
  }

  // 3. Find case
  const record = await db.healthCaseV2.findUnique({
    where: { id },
    include: {
      santri: {
        select: {
          id: true,
          nama: true,
          kelas: true,
          kamarPlacements: {
            where: { isActive: true },
            select: { kamarId: true },
          },
        },
      },
    },
  });

  if (!record) {
    throw new Error(`HEALTH_CASE_NOT_FOUND: Health case with ID '${id}' does not exist.`);
  }

  // 4. Scoped access check: Pembina Asrama is KAMAR-scoped
  if (context.scopeType === "KAMAR" || context.assignedKamarId) {
    const assignedKamarId = context.assignedKamarId;
    if (!assignedKamarId) {
      throw new Error("OUT_OF_SCOPE_ACCESS_DENIED: Pembina Asrama has no assigned kamar ID.");
    }

    const activePlacements = record.santri.kamarPlacements;
    const isSantriInAssignedKamar = activePlacements.some((p) => p.kamarId === assignedKamarId);

    if (!isSantriInAssignedKamar) {
      throw new Error(
        `OUT_OF_SCOPE_ACCESS_DENIED: Pembina Asrama for kamar '${assignedKamarId}' cannot access clinical health details for santri '${record.santri.nama}' (different kamar).`
      );
    }
  }

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
    },
  };
}

/**
 * Fetches aggregated Health statistics without exposing clinical details.
 * Enforces:
 * - Requires health.case.read_aggregate (or health.case.read_detail)
 * - Returns counts only: zero diagnosa, zero keluhan, zero patient notes exposed
 */
export async function getHealthCasesV2AggregateCore(
  db: PrismaClient,
  filter: HealthCaseV2AggregateFilter,
  context: HealthCaseV2AggregateContext
): Promise<{ success: boolean; data: HealthCaseV2AggregateResult }> {
  // 1. Check capability
  const hasAggregateCap =
    context.capabilities?.includes(HEALTH_CAPABILITIES.READ_AGGREGATE) ||
    context.capabilities?.includes(HEALTH_CAPABILITIES.READ_DETAIL);

  if (!hasAggregateCap) {
    throw new Error("AGGREGATE_ACCESS_DENIED: User lacks 'health.case.read_aggregate' capability.");
  }

  // 2. Build where filter
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

  // 3. Count by status
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
