'use server';

import prisma from '@/lib/prisma';
import { requireRole, getSession, recordAuditLog } from '@/lib/auth';
import { StatusKesehatan, Prisma } from '@prisma/client';
import { shadowAuthorizeIfEnabled } from '@/lib/auth/shadow-engine';
import { createPrismaDataProvider } from '@/lib/auth/canonical-evaluator';

export interface KesehatanResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Catat Kejadian / Keluhan Sakit Santri (Poskestren)
 * Akses PR #11 Baseline: KS (Mudir), MK (Musyrif Keasramaan), ADM (Admin/TU)
 * Catatan Bisnis: Mudabbir & OSDA Petugas Kesehatan berhak secara bisnis (ALLOW),
 * namun implementasi teknis ditangguhkan (deferred) ke STQ Architecture Lock / Keasramaan V2 assignment model.
 */
export async function catatKesehatanAction(formData: {
  santriId: string;
  keluhan: string;
  diagnosa?: string;
  tindakan: string;
  status?: StatusKesehatan;
}): Promise<KesehatanResponse> {
  try {
    const session = await requireRole(['KS', 'MK', 'ADM']);

    // Representative Milestone 2 shadow evaluation (Safe-by-default: OFF in production)
    await shadowAuthorizeIfEnabled({
      session,
      capabilityCode: 'health.case.create',
      legacyCheck: () => ['KS', 'MK', 'ADM'].includes(session.role),
      resourceContext: { santriId: formData.santriId },
      resourceType: 'CatatanKesehatan',
      resourceId: formData.santriId,
      isMutation: true,
      dataProviderFactory: () => createPrismaDataProvider(prisma),
    });

    const santri = await prisma.santri.findUnique({
      where: { id: formData.santriId },
      select: { id: true, nama: true },
    });

    if (!santri) {
      return { success: false, message: 'Data santri tidak ditemukan.' };
    }

    const sanitizedDiagnosa = formData.diagnosa?.trim() || null;

    const catatan = await prisma.catatanKesehatan.create({
      data: {
        santriId: formData.santriId,
        keluhan: formData.keluhan,
        diagnosa: sanitizedDiagnosa,
        tindakan: formData.tindakan,
        status: formData.status || StatusKesehatan.RAWAT_PONDOK,
        dicatatOleh: session.username,
      },
    });

    await recordAuditLog(
      session.userId,
      'CATAT_KESEHATAN',
      'CatatanKesehatan',
      catatan.id,
      { santri: santri.nama, keluhan: formData.keluhan, status: catatan.status }
    );

    return {
      success: true,
      message: `Catatan kesehatan untuk ${santri.nama} berhasil disimpan (${catatan.status}).`,
      data: catatan,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Update Status Kesehatan & Rujukan Medis
 * Akses PR #11 Baseline: KS (Mudir), MK (Musyrif Keasramaan)
 * ADM dilarang (DENY update status medis); generic OSDA dilarang (DENY).
 * Catatan Bisnis: Mudabbir & OSDA Petugas Kesehatan berhak secara bisnis (ALLOW),
 * namun implementasi teknis ditangguhkan (deferred) ke STQ Architecture Lock / Keasramaan V2 assignment model.
 */
export async function updateStatusKesehatanAction(formData: {
  id: string;
  status: StatusKesehatan;
  tindakanTambahan?: string;
}): Promise<KesehatanResponse> {
  try {
    const session = await requireRole(['MK', 'KS']);

    const existing = await prisma.catatanKesehatan.findUnique({
      where: { id: formData.id },
      include: { santri: true },
    });

    if (!existing) {
      return { success: false, message: 'Catatan kesehatan tidak ditemukan.' };
    }

    // Representative Milestone 2 shadow evaluation (Safe-by-default: OFF in production)
    await shadowAuthorizeIfEnabled({
      session,
      capabilityCode: 'health.case.update_status',
      legacyCheck: () => ['MK', 'KS'].includes(session.role),
      resourceContext: { santriId: existing.santriId },
      resourceType: 'CatatanKesehatan',
      resourceId: formData.id,
      isMutation: true,
      dataProviderFactory: () => createPrismaDataProvider(prisma),
    });

    const updated = await prisma.catatanKesehatan.update({
      where: { id: formData.id },
      data: {
        status: formData.status,
        tindakan: formData.tindakanTambahan
          ? `${existing.tindakan} | [Update]: ${formData.tindakanTambahan}`
          : existing.tindakan,
      },
    });

    await recordAuditLog(
      session.userId,
      'UPDATE_STATUS_KESEHATAN',
      'CatatanKesehatan',
      existing.id,
      { statusLama: existing.status, statusBaru: formData.status }
    );

    return {
      success: true,
      message: `Status kesehatan ${existing.santri.nama} diperbarui menjadi: ${formData.status}.`,
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Ambil Daftar Catatan Kesehatan Santri (Terkontrol Sesi, RBAC & ABAC Fail-Closed)
 */
export async function getDaftarKesehatanAction(filterStatus?: StatusKesehatan): Promise<KesehatanResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Akses Ditolak: Sesi otentikasi tidak ditemukan.', data: [] };
    }

    const where: Prisma.CatatanKesehatanWhereInput = {};
    if (filterStatus) {
      where.status = filterStatus;
    }

    // Role-based authorization & scoping
    if (session.role === 'WS' || session.role === 'ST') {
      if (!session.santriId) {
        return {
          success: false,
          message: 'Akses Ditolak: Akun belum terhubung dengan data santri.',
          data: [],
        };
      }
      where.santriId = session.santriId;
    } else if (session.role === 'KS' || session.role === 'MK' || session.role === 'ADM') {
      // Otoritas manajerial & medis asrama global (PR #11 Technical Baseline): Mudir (KS), Musyrif Keasramaan (MK), Admin/TU (ADM).
      // Mudabbir & OSDA Petugas Kesehatan: Business authority = ALLOW, namun implementasi teknis ditangguhkan (deferred)
      // ke STQ Architecture Lock karena belum ada model penugasan kanonikal.
    } else {
      // Role tanpa hak akses membaca data kesehatan global (MT, PH, GA, YAY, generic OSDA): FAIL-CLOSED
      return {
        success: false,
        message: `Akses Ditolak: Role ${session.role} tidak memiliki otorisasi membaca data kesehatan.`,
        data: [],
      };
    }

    const list = await prisma.catatanKesehatan.findMany({
      where,
      select: {
        id: true,
        santriId: true,
        keluhan: true,
        diagnosa: true,
        tindakan: true,
        status: true,
        tanggal: true,
        santri: {
          select: {
            id: true,
            nis: true,
            nama: true,
            kelas: true,
          },
        },
      },
      orderBy: { tanggal: 'desc' },
      take: 50,
    });

    return {
      success: true,
      message: 'Berhasil memuat data kesehatan santri',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg, data: [] };
  }
}
