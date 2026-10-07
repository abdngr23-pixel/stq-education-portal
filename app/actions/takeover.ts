'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { executeSupervisoryTakeover } from '@/lib/server/takeover-service';

export interface TakeoverActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface SupervisoryTakeoverActionInput {
  originalAssignmentId: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  // Non-authoritative display snapshot hints, strictly ignored for authorization and provenance
  displayHints?: {
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  };
}

/**
 * Server Action for Supervisory Takeover (ORR-086)
 * Server receives only selectors / business inputs: originalAssignmentId, resourceType, resourceId, reason.
 * Does NOT accept or trust caller-supplied originalPic or resolved authorization context.
 * Server resolves all entities, PIC provenance, and resource context directly from DB.
 */
export async function executeSupervisoryTakeoverAction(
  input: SupervisoryTakeoverActionInput
): Promise<TakeoverActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await executeSupervisoryTakeover({
      originalAssignmentId: input.originalAssignmentId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      reason: input.reason,
      takeoverActor: {
        userId: session.userId,
        name: session.name || session.username,
      },
      beforeState: input.displayHints?.beforeState,
      afterState: input.displayHints?.afterState,
      prismaClient: prisma,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.reason || 'Pengambilalihan tugas gagal.',
        error: result.code,
      };
    }

    return {
      success: true,
      message: 'Pengambilalihan tugas (supervisory takeover) berhasil dicatat dengan atribusi utuh.',
      data: result.data,
    };
  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat memproses pengambilalihan tugas.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
