'use server';

import prisma from '@/lib/prisma';
import { requireRole, getSession, recordAuditLog } from '@/lib/auth';
import { StatusKesehatan } from '@prisma/client';

export interface KesehatanResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Catat Kejadian / Keluhan Sakit Santri (Poskestren)
 * Akses: OSDA, MK (Musyrif Keasramaan), PH (Pembina Asrama), KS
 */
export async function catatKesehatanAction(formData: {
  santriId: string;
  keluhan: string;
  diagnosa?: string;
  tindakan: string;
  status?: StatusKesehatan;
}): Promise<KesehatanResponse> {
  try {
    const session = await requireRole(['OSDA', 'MK', 'PH', 'KS', 'ADM']);

    const santri = await prisma.santri.findUnique({
      where: { id: formData.santriId },
    });

    if (!santri) {
      return { success: false, message: 'Data santri tidak ditemukan.' };
    }

    const catatan = await prisma.catatanKesehatan.create({
      data: {
        santriId: formData.santriId,
        keluhan: formData.keluhan,
        diagnosa: formData.diagnosa || 'Pemeriksaan awal asrama',
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
 * Akses: MK (Musyrif Keasramaan), KS (Mudir)
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
 * Ambil Daftar Catatan Kesehatan Santri
 */
export async function getDaftarKesehatanAction(filterStatus?: StatusKesehatan): Promise<KesehatanResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Sesi tidak sah' };
    }

    // Jika santri/wali, filter santri terkait
    let santriFilter: { id?: string } | undefined = undefined;
    if (session.role === 'ST' && session.santriId) {
      santriFilter = { id: session.santriId };
    } else if (session.role === 'WS' && session.santriId) {
      santriFilter = { id: session.santriId };
    }

    const list = await prisma.catatanKesehatan.findMany({
      where: {
        status: filterStatus || undefined,
        santri: santriFilter,
      },
      include: {
        santri: {
          select: { id: true, nis: true, nama: true, kelas: true, namaWali: true, noHpWali: true },
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
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
