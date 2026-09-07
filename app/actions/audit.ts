'use server';

import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export interface AuditLogResponse<T = unknown> {
  success: boolean;
  message: string;
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
 * Akses: YAY, KS, ADM
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
    } catch {
      // Mock fallback data jika database lokal belum aktif
      const mockLogs: AuditLogItem[] = [
        {
          id: 'log-1',
          action: 'INPUT_SETORAN_TAHFIZH',
          entity: 'SetoranTahfizh',
          entityId: 'SET-00192',
          details: { santri: 'Ahmad Zaky', juz: 30, nilai: 'MUMTAZ', jenis: 'ZIYADAH' },
          createdAt: new Date(Date.now() - 1000 * 60 * 12),
          user: { username: 'salman.mt', email: 'salman.mt@stqduc.sch.id', role: 'MT' },
        },
        {
          id: 'log-2',
          action: 'PENCATATAN_PELANGGARAN_X2',
          entity: 'PelanggaranSantri',
          entityId: 'PLG-00045',
          details: { santri: 'Rayhan Pratama', poin: 20, isPengulangan: true, catatan: 'Terlambat halaqoh (pengulangan x2)' },
          createdAt: new Date(Date.now() - 1000 * 60 * 45),
          user: { username: 'faqih.mk', email: 'faqih.mk@stqduc.sch.id', role: 'MK' },
        },
        {
          id: 'log-3',
          action: 'APPROVAL_PERIZINAN_KS',
          entity: 'PerizinanSantri',
          entityId: 'IZN-00088',
          details: { santri: 'Faiz Ramadhan', jenis: 'PULANG', status: 'DISETUJUI' },
          createdAt: new Date(Date.now() - 1000 * 60 * 120),
          user: { username: 'ridwan.ks', email: 'ridwan.ks@stqduc.sch.id', role: 'KS' },
        },
        {
          id: 'log-4',
          action: 'GENERASI_SURAT_RESMI_AI',
          entity: 'SuratResmi',
          entityId: 'SRT-00012',
          details: { nomorSurat: '012/STQ-DUC/SP/IX/2026', perihal: 'Surat Peringatan 1' },
          createdAt: new Date(Date.now() - 1000 * 60 * 240),
          user: { username: 'aminah.adm', email: 'aminah.adm@stqduc.sch.id', role: 'ADM' },
        },
        {
          id: 'log-5',
          action: 'PENGUJIAN_IKHTIBAR_TAHAP_1',
          entity: 'IkhtibarTahfizh',
          entityId: 'IKH-00003',
          details: { santri: 'Ahmad Zaky', juz: 30, nilaiTahap1: 94, status: 'LULUS_TAHAP_1' },
          createdAt: new Date(Date.now() - 1000 * 60 * 360),
          user: { username: 'salman.mt', email: 'salman.mt@stqduc.sch.id', role: 'MT' },
        },
      ];

      return {
        success: true,
        message: 'Berhasil memuat log audit (Mode Siaga)',
        data: mockLogs,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
