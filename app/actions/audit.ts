'use server';

import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

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

/**
 * Mengambil daftar catatan jejak audit transaksi (Audit Trail)
 * Akses: YAY, KS, ADM (Legacy role compatibility; canonical capability system.audit.read is PROPOSED_TBD)
 */
export async function getAuditLogsAction(): Promise<AuditLogResponse<AuditLogItem[]>> {
  try {
    await requireRole(['YAY', 'KS', 'ADM']);

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
    const isAuthErr = err instanceof Error && (err.message.includes('UNAUTHORIZED') || err.message.includes('FORBIDDEN'));
    const message = isAuthErr ? (err as Error).message : 'Terjadi kesalahan sistem';
    const errorCode = isAuthErr ? 'AUTH_REQUIRED' : 'INTERNAL_ERROR';
    return {
      success: false,
      message,
      errorCode,
      error: errorCode,
      data: [],
    };
  }
}
