'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
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
 * LOCKED / FAIL-CLOSED: Operational actors for Checklist mutation are not yet
 * approved by Level-0 Business Owner. External invocations fail closed with POLICY_NOT_ACTIVE.
 */
export async function createChecklistTemplateAction(input: {
  code: string;
  name: string;
  domain?: OrgDomain;
  targetOrgUnitType?: OrgUnitType;
  schema: ChecklistTemplateItemSchema[];
  metadata?: Record<string, unknown>;
}): Promise<ChecklistActionResponse> {
  void input;
  return {
    success: false,
    message: 'POLICY_NOT_ACTIVE: Kebijakan operasional aktor checklist belum disetujui oleh Owner.',
    error: 'POLICY_NOT_ACTIVE',
  };
}

/**
 * 2. Create Checklist Run Action (Offline Reliable via clientRequestId)
 * LOCKED / FAIL-CLOSED: Operational actors for Checklist mutation are not yet
 * approved by Level-0 Business Owner. External invocations fail closed with POLICY_NOT_ACTIVE.
 */
export async function createChecklistRunAction(input: {
  templateId: string;
  targetUnitId?: string;
  scheduledDate?: string;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ChecklistActionResponse> {
  void input;
  return {
    success: false,
    message: 'POLICY_NOT_ACTIVE: Kebijakan operasional aktor checklist belum disetujui oleh Owner.',
    error: 'POLICY_NOT_ACTIVE',
  };
}

/**
 * 3. Record Checklist Performance Action
 * LOCKED / FAIL-CLOSED: Operational actors for Checklist mutation are not yet
 * approved by Level-0 Business Owner. External invocations fail closed with POLICY_NOT_ACTIVE.
 */
export async function recordChecklistPerformanceAction(input: {
  runId: string;
  items: PerformChecklistItemInput[];
  notes?: string;
  clientRequestId?: string;
  expectedVersion?: number;
}): Promise<ChecklistActionResponse> {
  void input;
  return {
    success: false,
    message: 'POLICY_NOT_ACTIVE: Kebijakan operasional aktor checklist belum disetujui oleh Owner.',
    error: 'POLICY_NOT_ACTIVE',
  };
}

/**
 * 4. Review Checklist Run Action (Official Check)
 * LOCKED / FAIL-CLOSED: Operational actors for Checklist mutation are not yet
 * approved by Level-0 Business Owner. External invocations fail closed with POLICY_NOT_ACTIVE.
 */
export async function reviewChecklistRunAction(input: {
  runId: string;
  decision: 'COMPLETED' | 'NEEDS_CORRECTION';
  correctionNotes?: string;
  itemsReview?: ReviewChecklistItemInput[];
  expectedVersion?: number;
}): Promise<ChecklistActionResponse> {
  void input;
  return {
    success: false,
    message: 'POLICY_NOT_ACTIVE: Kebijakan operasional aktor checklist belum disetujui oleh Owner.',
    error: 'POLICY_NOT_ACTIVE',
  };
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
