'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  executeSupervisoryTakeover,
  OriginalPicIdentity,
  TakeoverResourceContext,
} from '@/lib/server/takeover-service';

export interface TakeoverActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Server Action for Supervisory Takeover (ORR-086)
 * Enables Atasan to assume responsibility for neglected tasks while strictly preserving
 * the original PIC attribution and audit provenance.
 * Delegates canonical evaluation to executeSupervisoryTakeover in lib/server.
 */
export async function executeSupervisoryTakeoverAction(input: {
  originalAssignmentId: string;
  originalPic: OriginalPicIdentity;
  reason: string;
  resourceContext: TakeoverResourceContext;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
}): Promise<TakeoverActionResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const result = await executeSupervisoryTakeover({
      originalAssignmentId: input.originalAssignmentId,
      originalPic: input.originalPic,
      takeoverActor: {
        userId: session.userId,
        name: session.name || session.username,
      },
      reason: input.reason,
      resourceContext: input.resourceContext,
      beforeState: input.beforeState,
      afterState: input.afterState,
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
