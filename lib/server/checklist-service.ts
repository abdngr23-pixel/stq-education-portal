import {
  PrismaClient,
  ChecklistRunStatus,
  ChecklistItemStatus,
  OrgDomain,
  OrgUnitType,
} from "@prisma/client";
import defaultPrisma from "@/lib/prisma";

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
 * 1. Create Checklist Template (Versioned)
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
    const existing = await prisma.checklistTemplate.findUnique({
      where: { code: params.code.trim() },
    });
    if (existing) {
      return {
        success: false,
        code: "DUPLICATE_TEMPLATE_CODE",
        reason: `ChecklistTemplate with code '${params.code}' already exists.`,
      };
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        code: params.code.trim(),
        name: params.name.trim(),
        domain: params.domain || "KEASRAMAAN",
        targetOrgUnitType: params.targetOrgUnitType,
        version: 1,
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

  try {
    // 1. Offline Idempotency Check: if clientRequestId supplied and already exists, replay
    if (params.clientRequestId && params.clientRequestId.trim()) {
      const existingRun = await prisma.checklistRun.findUnique({
        where: { clientRequestId: params.clientRequestId.trim() },
        include: { items: true, template: true },
      });
      if (existingRun) {
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
  } catch (err) {
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

      // Update item statuses
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

      const now = new Date();
      const updatedRun = await tx.checklistRun.update({
        where: { id: run.id },
        data: {
          status: ChecklistRunStatus.PERFORMED,
          performedAt: now,
          performedById: params.performedById,
          notes: params.notes || run.notes,
          version: run.version + 1,
        },
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

      // Update checked item statuses if supplied
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

      const now = new Date();
      const targetStatus =
        params.decision === "COMPLETED"
          ? ChecklistRunStatus.COMPLETED
          : ChecklistRunStatus.NEEDS_CORRECTION;

      const updatedRun = await tx.checklistRun.update({
        where: { id: run.id },
        data: {
          status: targetStatus,
          checkedAt: now,
          checkedById: params.checkedById,
          correctionNotes:
            params.decision === "NEEDS_CORRECTION"
              ? params.correctionNotes || run.correctionNotes
              : null,
          version: run.version + 1,
        },
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
