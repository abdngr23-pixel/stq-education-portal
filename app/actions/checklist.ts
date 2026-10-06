'use server';

import prisma from '@/lib/prisma';
import { getSession, recordAuditLog } from '@/lib/auth';
import {
  createChecklistTemplate,
  createChecklistRun,
  recordChecklistPerformance,
  reviewChecklistRun,
  getChecklistRunById,
  ChecklistTemplateItemSchema,
  PerformChecklistItemInput,
  ReviewChecklistItemInput,
} from '@/lib/server/checklist-service';
import { OrgDomain, OrgUnitType } from '@prisma/client';

export interface ChecklistActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  isIdempotentReplay?: boolean;
}

/**
 * 1. Create Checklist Template Action
 */
export async function createChecklistTemplateAction(input: {
  code: string;
  name: string;
  domain?: OrgDomain;
  targetOrgUnitType?: OrgUnitType;
  schema: ChecklistTemplateItemSchema[];
  metadata?: Record<string, unknown>;
}): Promise<ChecklistActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await createChecklistTemplate({
      code: input.code,
      name: input.name,
      domain: input.domain,
      targetOrgUnitType: input.targetOrgUnitType,
      schema: input.schema,
      metadata: input.metadata,
      prismaClient: prisma,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.reason || 'Gagal membuat template checklist.',
        error: result.code,
      };
    }

    await recordAuditLog({
      action: 'CREATE_CHECKLIST_TEMPLATE',
      userId: session.userId,
      entity: 'ChecklistTemplate',
      entityId: (result.data as { id: string })?.id,
      details: { code: input.code, name: input.name },
    });

    return {
      success: true,
      message: 'Template checklist berhasil dibuat.',
      data: result.data,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat membuat template checklist.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 2. Create Checklist Run Action (Offline Reliable via clientRequestId)
 */
export async function createChecklistRunAction(input: {
  templateId: string;
  targetUnitId?: string;
  scheduledDate?: string;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ChecklistActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await createChecklistRun({
      templateId: input.templateId,
      targetUnitId: input.targetUnitId,
      scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
      clientRequestId: input.clientRequestId,
      metadata: input.metadata,
      prismaClient: prisma,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.reason || 'Gagal membuat run checklist.',
        error: result.code,
      };
    }

    if (!result.isIdempotentReplay) {
      await recordAuditLog({
        action: 'CREATE_CHECKLIST_RUN',
        userId: session.userId,
        entity: 'ChecklistRun',
        entityId: (result.data as { id: string })?.id,
        details: {
          templateId: input.templateId,
          clientRequestId: input.clientRequestId,
        },
      });
    }

    return {
      success: true,
      message: result.isIdempotentReplay
        ? 'Checklist run ditemukan (idempotent replay).'
        : 'Checklist run berhasil dibuat.',
      data: result.data,
      isIdempotentReplay: result.isIdempotentReplay,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat membuat checklist run.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 3. Record Checklist Performance Action
 */
export async function recordChecklistPerformanceAction(input: {
  runId: string;
  items: PerformChecklistItemInput[];
  notes?: string;
  clientRequestId?: string;
  expectedVersion?: number;
}): Promise<ChecklistActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await recordChecklistPerformance({
      runId: input.runId,
      performedById: session.userId,
      items: input.items,
      notes: input.notes,
      clientRequestId: input.clientRequestId,
      expectedVersion: input.expectedVersion,
      prismaClient: prisma,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.reason || 'Gagal merekam pelaksanaan checklist.',
        error: result.code,
      };
    }

    await recordAuditLog({
      action: 'PERFORM_CHECKLIST_RUN',
      userId: session.userId,
      entity: 'ChecklistRun',
      entityId: input.runId,
      details: {
        itemCount: input.items.length,
        version: (result.data as { version: number })?.version,
      },
    });

    return {
      success: true,
      message: 'Pelaksanaan checklist berhasil direkam.',
      data: result.data,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat merekam pelaksanaan checklist.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 4. Review Checklist Run Action (Official Check)
 */
export async function reviewChecklistRunAction(input: {
  runId: string;
  decision: 'COMPLETED' | 'NEEDS_CORRECTION';
  correctionNotes?: string;
  itemsReview?: ReviewChecklistItemInput[];
  expectedVersion?: number;
}): Promise<ChecklistActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await reviewChecklistRun({
      runId: input.runId,
      checkedById: session.userId,
      decision: input.decision,
      correctionNotes: input.correctionNotes,
      itemsReview: input.itemsReview,
      expectedVersion: input.expectedVersion,
      prismaClient: prisma,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.reason || 'Gagal memverifikasi checklist.',
        error: result.code,
      };
    }

    await recordAuditLog({
      action: 'REVIEW_CHECKLIST_RUN',
      userId: session.userId,
      entity: 'ChecklistRun',
      entityId: input.runId,
      details: {
        decision: input.decision,
        version: (result.data as { version: number })?.version,
      },
    });

    return {
      success: true,
      message:
        input.decision === 'COMPLETED'
          ? 'Checklist disetujui dan ditandai COMPLETED.'
          : 'Checklist ditandai NEEDS_CORRECTION.',
      data: result.data,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat memeriksa checklist.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 5. Get Checklist Run Detail Action
 */
export async function getChecklistRunAction(runId: string): Promise<ChecklistActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await getChecklistRunById(runId, prisma);

    if (!result.success) {
      return {
        success: false,
        message: result.reason || 'Checklist tidak ditemukan.',
        error: result.code,
      };
    }

    return {
      success: true,
      message: 'Data checklist berhasil dimuat.',
      data: result.data,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat data checklist.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
