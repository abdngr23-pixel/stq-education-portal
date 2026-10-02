'use server';

import prisma from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';
import {
  authorizeCanonical,
  createPrismaDataProvider,
  type ICanonicalDataProvider,
} from '@/lib/auth/canonical-evaluator';

export interface AuditLogResponse<T = unknown> {
  success: boolean;
  message: string;
  errorCode?: string;
  data?: T;
  error?: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: Date;
  user: {
    username: string;
    email: string | null;
    role: string;
  };
}

export interface GetAuditLogsOptions {
  dataProvider?: ICanonicalDataProvider;
  now?: Date;
}

/**
 * Mengambil daftar catatan jejak audit transaksi (Audit Trail)
 * Otorisasi Kanonikal:
 * - Kapabilitas: `system.audit.read`
 * - Posisi yang disetujui Owner: `MUDIR`
 * - Cakupan: `GLOBAL`
 * - State: `VERIFIED_PRODUCTION` (Active runtime requirement)
 * - ADM & role YAY: Ditolak (DENY)
 */
export async function getAuditLogsAction(
  options?: GetAuditLogsOptions
): Promise<AuditLogResponse<AuditLogItem[]>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.userId) {
      return {
        success: false,
        message: 'UNAUTHORIZED: Silakan login terlebih dahulu.',
        errorCode: 'UNAUTHORIZED',
        error: 'UNAUTHORIZED',
        data: [],
      };
    }

    const dataProvider = options?.dataProvider || createPrismaDataProvider(prisma);

    const authDecision = await authorizeCanonical({
      identity: session,
      capability: 'system.audit.read',
      dataProvider,
      now: options?.now,
    });

    if (authDecision.decision !== 'ALLOW') {
      const isSystemError =
        authDecision.decision === 'ERROR' ||
        authDecision.code === 'SYSTEM_FAIL_CLOSED';

      return {
        success: false,
        message: isSystemError
          ? 'Gagal memverifikasi wewenang: basis data otorisasi tidak dapat diakses.'
          : `FORBIDDEN: ${authDecision.reason || 'Anda tidak memiliki wewenang membaca log audit lembaga.'}`,
        errorCode: authDecision.code || 'FORBIDDEN',
        error: authDecision.code || 'FORBIDDEN',
        data: [],
      };
    }

    // Hanya lakukan query basis data SETELAH otorisasi kanonikal ALLOW
    try {
      const logs = await prisma.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              username: true,
              email: true,
              role: true,
            },
          },
        },
      });

      const formatted: AuditLogItem[] = logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details as Record<string, unknown> | null,
        createdAt: log.createdAt,
        user: {
          username: log.user?.username || 'Sistem',
          email: log.user?.email || null,
          role: log.user?.role || 'SISTEM',
        },
      }));

      return {
        success: true,
        message: 'Berhasil memuat log audit',
        data: formatted,
      };
    } catch (err: unknown) {
      console.error('[Action Error] getAuditLogsAction (findMany):', err);
      return {
        success: false,
        message: 'Gagal memuat log audit dari basis data.',
        errorCode: 'AUDIT_LOG_QUERY_FAILED',
        error: 'AUDIT_LOG_QUERY_FAILED',
        data: [],
      };
    }
  } catch (err: unknown) {
    console.error('[Action Error] getAuditLogsAction (auth):', err);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem',
      errorCode: 'INTERNAL_ERROR',
      error: 'INTERNAL_ERROR',
      data: [],
    };
  }
}
