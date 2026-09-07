'use server';

import prisma from '@/lib/prisma';
import { requireRole, getSession, recordAuditLog } from '@/lib/auth';
import { StatusIkhtibar } from '@prisma/client';

export interface IkhtibarResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Ajukan Ikhtibar Ujian Tahfizh untuk Santri
 * Akses: MT (Musyrif Tahfizh), KS (Mudir)
 */
export async function ajukanIkhtibarAction(formData: {
  santriId: string;
  juz: number;
}): Promise<IkhtibarResponse> {
  try {
    const session = await requireRole(['MT', 'KS', 'ADM']);

    if (formData.juz < 1 || formData.juz > 30) {
      return { success: false, message: 'Juz harus antara 1 sampai 30.' };
    }

    const santri = await prisma.santri.findUnique({
      where: { id: formData.santriId },
      include: { halaqoh: true },
    });

    if (!santri) {
      return { success: false, message: 'Data santri tidak ditemukan.' };
    }

    // Cek pengujian berjalan untuk juz yang sama
    const existing = await prisma.ikhtibarTahfizh.findFirst({
      where: {
        santriId: formData.santriId,
        juz: formData.juz,
        status: { in: [StatusIkhtibar.PENGAJUAN, StatusIkhtibar.LULUS_TAHAP_1] },
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Santri masih memiliki proses ikhtibar berjalan untuk Juz ${formData.juz}.`,
      };
    }

    const ikhtibar = await prisma.ikhtibarTahfizh.create({
      data: {
        santriId: formData.santriId,
        juz: formData.juz,
        status: StatusIkhtibar.PENGAJUAN,
      },
    });

    await recordAuditLog(
      session.userId,
      'AJUKAN_IKHTIBAR',
      'IkhtibarTahfizh',
      ikhtibar.id,
      { santri: santri.nama, juz: formData.juz }
    );

    return {
      success: true,
      message: `Pendaftaran ikhtibar Juz ${formData.juz} untuk ${santri.nama} berhasil diajukan.`,
      data: ikhtibar,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Input Hasil Ujian Tahap 1 (Kelancaran & Makhraj oleh MT)
 * Akses: MT (Musyrif Tahfizh), KS (Mudir)
 */
export async function inputHasilTahap1Action(formData: {
  ikhtibarId: string;
  nilai: number; // 0 - 100
  catatan?: string;
  lulus: boolean;
}): Promise<IkhtibarResponse> {
  try {
    const session = await requireRole(['MT', 'KS']);

    const ikhtibar = await prisma.ikhtibarTahfizh.findUnique({
      where: { id: formData.ikhtibarId },
      include: { santri: true },
    });

    if (!ikhtibar) {
      return { success: false, message: 'Data ikhtibar tidak ditemukan.' };
    }

    const status = formData.lulus ? StatusIkhtibar.LULUS_TAHAP_1 : StatusIkhtibar.MENGULANG;

    const updated = await prisma.ikhtibarTahfizh.update({
      where: { id: formData.ikhtibarId },
      data: {
        nilaiTahap1: formData.nilai,
        catatanTahap1: formData.catatan || (formData.lulus ? 'Lancar dan makhraj fasih' : 'Perlu pemantapan hafalan'),
        tanggalTahap1: new Date(),
        status,
        pengujiTahap1Id: session.staffId || null,
      },
    });

    await recordAuditLog(
      session.userId,
      'INPUT_IKHTIBAR_TAHAP_1',
      'IkhtibarTahfizh',
      ikhtibar.id,
      { nilai: formData.nilai, status }
    );

    return {
      success: true,
      message: formData.lulus
        ? `Alhamdulillah, ${ikhtibar.santri.nama} dinyatakan LULUS Ujian Tahap 1 Juz ${ikhtibar.juz} dan siap maju ke Ujian Tahap 2 (Mudir).`
        : `Hasil Ujian Tahap 1 disimpan. Santri diminta mengulang hafalan Juz ${ikhtibar.juz}.`,
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Input Hasil Ujian Tahap 2 & Pengesahan Kelulusan Juz (Mudir KS)
 * Akses: KS (Kepala Sekolah / Mudir)
 */
export async function inputHasilTahap2Action(formData: {
  ikhtibarId: string;
  nilai: number; // 0 - 100
  catatan?: string;
  lulus: boolean;
}): Promise<IkhtibarResponse> {
  try {
    const session = await requireRole(['KS']);

    const ikhtibar = await prisma.ikhtibarTahfizh.findUnique({
      where: { id: formData.ikhtibarId },
      include: { santri: true },
    });

    if (!ikhtibar) {
      return { success: false, message: 'Data ikhtibar tidak ditemukan.' };
    }

    if (ikhtibar.status !== StatusIkhtibar.LULUS_TAHAP_1) {
      return {
        success: false,
        message: 'Ikhtibar harus telah lulus Ujian Tahap 1 sebelum diuji oleh Mudir.',
      };
    }

    const status = formData.lulus
      ? StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2
      : StatusIkhtibar.MENGULANG;

    const updated = await prisma.ikhtibarTahfizh.update({
      where: { id: formData.ikhtibarId },
      data: {
        nilaiTahap2: formData.nilai,
        catatanTahap2: formData.catatan || (formData.lulus ? 'Mumtaz! Disahkan oleh Mudir Pesantren' : 'Perlu perbaikan tajwid lanjutan'),
        tanggalTahap2: new Date(),
        status,
        pengujiTahap2Id: session.staffId || null,
      },
    });

    await recordAuditLog(
      session.userId,
      'INPUT_IKHTIBAR_TAHAP_2',
      'IkhtibarTahfizh',
      ikhtibar.id,
      { nilai: formData.nilai, status, disahkanOleh: session.username }
    );

    return {
      success: true,
      message: formData.lulus
        ? `Barakallahu fiik! ${ikhtibar.santri.nama} dinyatakan RESMI LULUS SELESAI JUZ ${ikhtibar.juz} oleh Mudir Pesantren.`
        : `Hasil evaluasi disimpan. Santri diminta mengulang ujian Tahap 2.`,
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Ambil Daftar Riwayat Ikhtibar
 */
export async function getDaftarIkhtibarAction(filterStatus?: StatusIkhtibar): Promise<IkhtibarResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Sesi tidak sah' };
    }

    const list = await prisma.ikhtibarTahfizh.findMany({
      where: filterStatus ? { status: filterStatus } : undefined,
      include: {
        santri: {
          select: { id: true, nis: true, nama: true, kelas: true },
        },
        pengujiTahap1: { select: { nama: true } },
        pengujiTahap2: { select: { nama: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      success: true,
      message: 'Berhasil memuat daftar ikhtibar',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
