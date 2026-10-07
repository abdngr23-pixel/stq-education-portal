import {
  PrismaClient,
  ChecklistRunStatus,
  ChecklistItemStatus,
  OrgDomain,
  OrgUnitType,
} from "@prisma/client";
import * as crypto from "crypto";
import defaultPrisma from "@/lib/prisma";

/**
 * Canonical JSON stringifier with recursive deterministic key sorting.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return "null";
  }
  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson((obj as Record<string, unknown>)[k])}`
  );
  return "{" + entries.join(",") + "}";
}

/**
 * Derives canonical deterministic SHA-256 fingerprint for ChecklistRun creation payload.
 * Normalizes templateId, targetUnitId, scheduledDate, and metadata.
 */
export function computeChecklistPayloadHash(payload: {
  templateId: string;
  targetUnitId?: string | null;
  scheduledDate?: Date | string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  let normDate: string | null = null;
  if (payload.scheduledDate) {
    const d = payload.scheduledDate instanceof Date ? payload.scheduledDate : new Date(payload.scheduledDate);
    normDate = isNaN(d.getTime()) ? String(payload.scheduledDate) : d.toISOString();
  }
  const canonicalObj = {
    templateId: (payload.templateId || "").trim(),
    targetUnitId: payload.targetUnitId ? payload.targetUnitId.trim() : null,
    scheduledDate: normDate,
    metadata: payload.metadata || null,
  };
  const canonicalString = canonicalizeJson(canonicalObj);
  return crypto.createHash("sha256").update(canonicalString).digest("hex");
}

export interface ChecklistTemplateItemSchema {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
}

export interface CreateChecklistTemplateParams {
  code: string;
  name: string;
  domain?: OrgDomain;
  version?: number;
  targetOrgUnitType?: OrgUnitType;
  schema: ChecklistTemplateItemSchema[];
  metadata?: Record<string, unknown>;
  prismaClient?: PrismaClient;
}

export interface CreateChecklistRunParams {
  templateId: string;
  targetUnitId?: string;
  scheduledDate?: Date;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
  prismaClient?: PrismaClient;
}

export interface PerformChecklistItemInput {
  itemKey: string;
  status: ChecklistItemStatus;
  notes?: string;
  photoUrl?: string;
}

export interface RecordChecklistPerformanceParams {
  runId: string;
  performedById: string;
  items: PerformChecklistItemInput[];
  notes?: string;
  clientRequestId?: string;
  expectedVersion?: number;
  prismaClient?: PrismaClient;
}

export interface ReviewChecklistItemInput {
  itemKey: string;
  checkedStatus: ChecklistItemStatus;
  checkedNotes?: string;
}

export interface ReviewChecklistRunParams {
  runId: string;
  checkedById: string;
  decision: "COMPLETED" | "NEEDS_CORRECTION";
  correctionNotes?: string;
  itemsReview?: ReviewChecklistItemInput[];
  expectedVersion?: number;
  prismaClient?: PrismaClient;
}

export interface ChecklistServiceResult<T = unknown> {
  success: boolean;
  code?: string;
  reason?: string;
  data?: T;
  isIdempotentReplay?: boolean;
}

/**
 * 1. Create Checklist Template (Versioned & Immutable)
 * Logical code can repeat across versions: unique(code, version).
 * For a new version: same logical code, version = previous + 1.
 * Old template rows remain immutable and preserved.
 */
export async function createChecklistTemplate(
  params: CreateChecklistTemplateParams
): Promise<ChecklistServiceResult> {
  const prisma = params.prismaClient || defaultPrisma;

  if (!params.code || !params.code.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Template code is required." };
  }
  if (!params.name || !params.name.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Template name is required." };
  }
  if (!Array.isArray(params.schema) || params.schema.length === 0) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Schema must contain at least one checklist item definition." };
  }

  try {
    const code = params.code.trim();
    let versionToUse = params.version;

    if (!versionToUse) {
      const latest = await prisma.checklistTemplate.findFirst({
        where: { code },
        orderBy: { version: "desc" },
      });
      versionToUse = latest ? latest.version + 1 : 1;
    } else {
      const existing = await prisma.checklistTemplate.findUnique({
        where: {
          code_version: {
            code,
            version: versionToUse,
          },
        },
      });
      if (existing) {
        return {
          success: false,
          code: "DUPLICATE_TEMPLATE_VERSION",
          reason: `ChecklistTemplate with code '${code}' and version ${versionToUse} already exists.`,
        };
      }
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        code,
        name: params.name.trim(),
        domain: params.domain || "KEASRAMAAN",
        targetOrgUnitType: params.targetOrgUnitType,
        version: versionToUse,
        isActive: true,
        schema: JSON.parse(JSON.stringify(params.schema)),
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    return {
      success: true,
      data: template,
    };
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to create checklist template: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 2. Create Checklist Run
 * Implements offline idempotency via clientRequestId
 */
export async function createChecklistRun(
  params: CreateChecklistRunParams
): Promise<ChecklistServiceResult> {
  const prisma = params.prismaClient || defaultPrisma;

  if (!params.templateId) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "templateId is required." };
  }

  const incomingPayloadHash = computeChecklistPayloadHash({
    templateId: params.templateId,
    targetUnitId: params.targetUnitId,
    scheduledDate: params.scheduledDate,
    metadata: params.metadata,
  });

  try {
    // 1. Offline Idempotency Check: if clientRequestId supplied and already exists, replay or detect conflict
    if (params.clientRequestId && params.clientRequestId.trim()) {
      const existingRun = await prisma.checklistRun.findUnique({
        where: { clientRequestId: params.clientRequestId.trim() },
        include: { items: true, template: true },
      });
      if (existingRun) {
        const existingHash =
          existingRun.requestPayloadHash ||
          computeChecklistPayloadHash({
            templateId: existingRun.templateId,
            targetUnitId: existingRun.targetUnitId,
            scheduledDate: existingRun.scheduledDate,
            metadata: existingRun.metadata as Record<string, unknown> | null,
          });

        if (existingHash !== incomingPayloadHash) {
          return {
            success: false,
            code: "CONFLICT_CLIENT_REQUEST_ID",
            reason: `Duplicate clientRequestId '${params.clientRequestId}' with conflicting payload fingerprint.`,
          };
        }

        return {
          success: true,
          data: existingRun,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Fetch template
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: params.templateId },
    });
    if (!template || !template.isActive) {
      return {
        success: false,
        code: "TEMPLATE_NOT_FOUND_OR_INACTIVE",
        reason: `Active ChecklistTemplate with ID '${params.templateId}' not found.`,
      };
    }

    // 3. Target OrgUnit validation if provided
    if (params.targetUnitId) {
      const targetUnit = await prisma.orgUnit.findUnique({
        where: { id: params.targetUnitId },
      });
      if (!targetUnit || !targetUnit.isActive) {
        return {
          success: false,
          code: "TARGET_UNIT_NOT_FOUND_OR_INACTIVE",
          reason: `Target OrgUnit '${params.targetUnitId}' not found or inactive.`,
        };
      }
    }

    const schemaItems = (template.schema as unknown as ChecklistTemplateItemSchema[]) || [];

    return await prisma.$transaction(async (tx) => {
      const run = await tx.checklistRun.create({
        data: {
          templateId: template.id,
          templateVersion: template.version,
          targetUnitId: params.targetUnitId || null,
          status: ChecklistRunStatus.DRAFT,
          clientRequestId: params.clientRequestId?.trim() || null,
          requestPayloadHash: incomingPayloadHash,
          version: 1,
          scheduledDate: params.scheduledDate || null,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
          items: {
            create: schemaItems.map((item) => ({
              itemKey: item.key,
              label: item.label,
              status: ChecklistItemStatus.PENDING,
            })),
          },
        },
        include: {
          items: true,
          template: true,
        },
      });

      return {
        success: true,
        data: run,
      };
    });
  } catch (err: unknown) {
    const errorObj = err as Record<string, unknown> | undefined;
    const isUniqueViolation =
      errorObj?.code === "P2002" ||
      (typeof errorObj?.message === "string" &&
        (errorObj.message.includes("Unique constraint") ||
          errorObj.message.includes("client_request_id")));

    if (isUniqueViolation && params.clientRequestId && params.clientRequestId.trim()) {
      const existingRun = await prisma.checklistRun.findUnique({
        where: { clientRequestId: params.clientRequestId.trim() },
        include: { items: true, template: true },
      });

      if (existingRun) {
        const existingHash =
          existingRun.requestPayloadHash ||
          computeChecklistPayloadHash({
            templateId: existingRun.templateId,
            targetUnitId: existingRun.targetUnitId,
            scheduledDate: existingRun.scheduledDate,
            metadata: existingRun.metadata as Record<string, unknown> | null,
          });

        if (existingHash !== incomingPayloadHash) {
          return {
            success: false,
            code: "CONFLICT_CLIENT_REQUEST_ID",
            reason: `Duplicate clientRequestId '${params.clientRequestId}' with conflicting payload fingerprint.`,
          };
        }

        return {
          success: true,
          data: existingRun,
          isIdempotentReplay: true,
        };
      }
    }

    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to create checklist run: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 3. Record Checklist Performance (PERFORMED state)
 * Implements optimistic concurrency conflict detection
 * STRICTLY decoupled from WF-07: NEVER creates automatic discipline violations.
 * ATOMIC GUARANTEE: Claim version CAS BEFORE mutating items. Loser performs ZERO writes.
 */
export async function recordChecklistPerformance(
  params: RecordChecklistPerformanceParams
): Promise<ChecklistServiceResult> {
  const prisma = params.prismaClient || defaultPrisma;

  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.checklistRun.findUnique({
        where: { id: params.runId },
        include: { items: true },
      });
      if (!run) {
        throw new Error(`ChecklistRun with ID '${params.runId}' not found.`);
      }

      // Concurrency Conflict Detection
      if (
        params.expectedVersion !== undefined &&
        run.version !== params.expectedVersion
      ) {
        return {
          success: false,
          code: "CONFLICT_VERSION_MISMATCH",
          reason: `Version conflict: Expected version ${params.expectedVersion}, but current version is ${run.version}.`,
          data: run,
        };
      }

      // Lifecycle Guard: must be DRAFT or NEEDS_CORRECTION
      if (
        run.status !== ChecklistRunStatus.DRAFT &&
        run.status !== ChecklistRunStatus.NEEDS_CORRECTION
      ) {
        return {
          success: false,
          code: "INVALID_LIFECYCLE_STATE",
          reason: `Cannot perform checklist run in status '${run.status}'. Must be DRAFT or NEEDS_CORRECTION.`,
          data: run,
        };
      }

      const now = new Date();
      const expectedVer = params.expectedVersion !== undefined ? params.expectedVersion : run.version;

      // 1. ATOMIC CAS CLAIM FIRST: UPDATE ... WHERE id=? AND version=expectedVersion
      const updateResult = await tx.checklistRun.updateMany({
        where: {
          id: run.id,
          version: expectedVer,
        },
        data: {
          status: ChecklistRunStatus.PERFORMED,
          performedAt: now,
          performedById: params.performedById,
          notes: params.notes || run.notes,
          version: { increment: 1 },
        },
      });

      // 2. REQUIRE AFFECTED COUNT = 1; IF COUNT = 0, RETURN CONFLICT_VERSION_MISMATCH WITH ZERO ITEM WRITES!
      if (updateResult.count === 0) {
        const latest = await tx.checklistRun.findUnique({
          where: { id: run.id },
          include: { items: true, template: true },
        });
        return {
          success: false,
          code: "CONFLICT_VERSION_MISMATCH",
          reason: `Version conflict: Expected version ${expectedVer}, but current version is ${latest?.version}.`,
          data: latest,
        };
      }

      // 3. ONLY AFTER SUCCESSFUL CLAIM MUTATE ITEMS
      for (const itemInput of params.items) {
        const itemExists = run.items.find((i) => i.itemKey === itemInput.itemKey);
        if (itemExists) {
          await tx.checklistItem.update({
            where: { id: itemExists.id },
            data: {
              status: itemInput.status,
              notes: itemInput.notes || undefined,
              photoUrl: itemInput.photoUrl || undefined,
            },
          });
        }
      }

      const updatedRun = await tx.checklistRun.findUnique({
        where: { id: run.id },
        include: { items: true, template: true },
      });

      return {
        success: true,
        data: updatedRun,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to record checklist performance: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 4. Official Review Checklist Run (COMPLETED or NEEDS_CORRECTION)
 * STRICTLY decoupled from WF-07: zero automatic discipline violations.
 * ATOMIC GUARANTEE: Claim version CAS BEFORE mutating items. Loser performs ZERO writes.
 */
export async function reviewChecklistRun(
  params: ReviewChecklistRunParams
): Promise<ChecklistServiceResult> {
  const prisma = params.prismaClient || defaultPrisma;

  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.checklistRun.findUnique({
        where: { id: params.runId },
        include: { items: true },
      });
      if (!run) {
        throw new Error(`ChecklistRun with ID '${params.runId}' not found.`);
      }

      // Concurrency Conflict Detection
      if (
        params.expectedVersion !== undefined &&
        run.version !== params.expectedVersion
      ) {
        return {
          success: false,
          code: "CONFLICT_VERSION_MISMATCH",
          reason: `Version conflict: Expected version ${params.expectedVersion}, but current version is ${run.version}.`,
          data: run,
        };
      }

      // Lifecycle Guard: Must be PERFORMED or UNDER_REVIEW
      if (
        run.status !== ChecklistRunStatus.PERFORMED &&
        run.status !== ChecklistRunStatus.UNDER_REVIEW
      ) {
        return {
          success: false,
          code: "INVALID_LIFECYCLE_STATE",
          reason: `Cannot review checklist run in status '${run.status}'. Must be PERFORMED.`,
          data: run,
        };
      }

      const now = new Date();
      const targetStatus =
        params.decision === "COMPLETED"
          ? ChecklistRunStatus.COMPLETED
          : ChecklistRunStatus.NEEDS_CORRECTION;
      const expectedVer = params.expectedVersion !== undefined ? params.expectedVersion : run.version;

      // 1. ATOMIC CAS CLAIM FIRST: UPDATE ... WHERE id=? AND version=expectedVersion
      const updateResult = await tx.checklistRun.updateMany({
        where: {
          id: run.id,
          version: expectedVer,
        },
        data: {
          status: targetStatus,
          checkedAt: now,
          checkedById: params.checkedById,
          correctionNotes:
            params.decision === "NEEDS_CORRECTION"
              ? params.correctionNotes || run.correctionNotes
              : null,
          version: { increment: 1 },
        },
      });

      // 2. REQUIRE AFFECTED COUNT = 1; IF COUNT = 0, RETURN CONFLICT_VERSION_MISMATCH WITH ZERO ITEM WRITES!
      if (updateResult.count === 0) {
        const latest = await tx.checklistRun.findUnique({
          where: { id: run.id },
          include: { items: true, template: true },
        });
        return {
          success: false,
          code: "CONFLICT_VERSION_MISMATCH",
          reason: `Version conflict: Expected version ${expectedVer}, but current version is ${latest?.version}.`,
          data: latest,
        };
      }

      // 3. ONLY AFTER SUCCESSFUL CLAIM MUTATE ITEMS
      if (params.itemsReview && params.itemsReview.length > 0) {
        for (const reviewItem of params.itemsReview) {
          const itemExists = run.items.find((i) => i.itemKey === reviewItem.itemKey);
          if (itemExists) {
            await tx.checklistItem.update({
              where: { id: itemExists.id },
              data: {
                checkedStatus: reviewItem.checkedStatus,
                checkedNotes: reviewItem.checkedNotes || undefined,
              },
            });
          }
        }
      }

      const updatedRun = await tx.checklistRun.findUnique({
        where: { id: run.id },
        include: { items: true, template: true },
      });

      return {
        success: true,
        data: updatedRun,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to review checklist run: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 5. Inspect Checklist Run
 */
export async function getChecklistRunById(
  runId: string,
  prismaClient?: PrismaClient
): Promise<ChecklistServiceResult> {
  const prisma = prismaClient || defaultPrisma;

  try {
    const run = await prisma.checklistRun.findUnique({
      where: { id: runId },
      include: {
        template: true,
        targetUnit: true,
        performedBy: {
          select: { id: true, username: true, staff: { select: { nama: true } } },
        },
        checkedBy: {
          select: { id: true, username: true, staff: { select: { nama: true } } },
        },
        items: {
          orderBy: { itemKey: "asc" },
        },
      },
    });

    if (!run) {
      return {
        success: false,
        code: "NOT_FOUND",
        reason: `ChecklistRun '${runId}' not found.`,
      };
    }

    return {
      success: true,
      data: run,
    };
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to inspect checklist run: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
