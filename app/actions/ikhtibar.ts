'use server';

import prisma from '@/lib/prisma';
import { requireRole, getSession, recordAuditLog } from '@/lib/auth';
import { UserSession } from '@/types/auth';
import { StatusIkhtibar } from '@prisma/client';
import { validasiIkhtibarTahap1, validasiIkhtibarTahap2, MIN_NILAI_IKHTIBAR } from '@/lib/educational-rules';

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

    // Cek apakah santri sudah lulus sempurna juz ini
    const alreadyPassed = await prisma.ikhtibarTahfizh.findFirst({
      where: {
        santriId: formData.santriId,
        juz: formData.juz,
        status: StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2,
      },
    });

    if (alreadyPassed) {
      return {
        success: false,
        message: `Santri telah dinyatakan RESMI LULUS SELESAI Juz ${formData.juz}. Tidak perlu mendaftar ulang.`,
      };
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

    await recordAuditLog({
      userId: session.userId,
      action: 'AJUKAN_IKHTIBAR',
      entity: 'IkhtibarTahfizh',
      entityId: ikhtibar.id,
      details: { santri: santri.nama, juz: formData.juz },
    });

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

    // Validasi aturan bisnis transisi ikhtibar tahap 1
    const validation = validasiIkhtibarTahap1(ikhtibar.status, formData.nilai);
    if (validation.error) {
      return { success: false, message: validation.error };
    }

    const status = (formData.lulus && validation.lulus) ? StatusIkhtibar.LULUS_TAHAP_1 : StatusIkhtibar.MENGULANG;

    const updated = await prisma.ikhtibarTahfizh.update({
      where: { id: formData.ikhtibarId },
      data: {
        nilaiTahap1: formData.nilai,
        catatanTahap1: formData.catatan || (status === StatusIkhtibar.LULUS_TAHAP_1 ? 'Lancar dan makhraj fasih' : `Perlu pemantapan hafalan (Nilai: ${formData.nilai})`),
        tanggalTahap1: new Date(),
        status,
        pengujiTahap1Id: session.staffId || null,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: 'INPUT_IKHTIBAR_TAHAP_1',
      entity: 'IkhtibarTahfizh',
      entityId: ikhtibar.id,
      details: { nilai: formData.nilai, status },
    });

    return {
      success: true,
      message: status === StatusIkhtibar.LULUS_TAHAP_1
        ? `Alhamdulillah, ${ikhtibar.santri.nama} dinyatakan LULUS Ujian Tahap 1 Juz ${ikhtibar.juz} (Nilai: ${formData.nilai}) dan siap maju ke Ujian Tahap 2 (Mudir).`
        : `Hasil Ujian Tahap 1 disimpan. Nilai ${formData.nilai} belum memenuhi ambang batas ${MIN_NILAI_IKHTIBAR}. Santri diminta mengulang hafalan Juz ${ikhtibar.juz}.`,
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
 * Mengadopsi 3 cabang keputusan resmi kurikulum STQ: Lulus, Mengulang Sebagian, Mengulang Satu Juz Penuh
 */
export async function inputHasilTahap2Action(formData: {
  ikhtibarId: string;
  nilai: number; // 0 - 100
  catatan?: string;
  lulus: boolean;
  hasilTahap2?: 'LULUS' | 'MENGULANG_SEBAGIAN' | 'MENGULANG_SATU_JUZ';
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

    // Validasi aturan bisnis transisi ikhtibar tahap 2
    const effectiveJenis = formData.hasilTahap2
      ? formData.hasilTahap2
      : formData.lulus
      ? 'LULUS'
      : formData.nilai >= 60
      ? 'MENGULANG_SEBAGIAN'
      : 'MENGULANG_SATU_JUZ';

    const validation = validasiIkhtibarTahap2(ikhtibar.status, formData.nilai, effectiveJenis);
    if (validation.error) {
      return { success: false, message: validation.error };
    }

    const status = validation.status as StatusIkhtibar;

    const defaultCatatan =
      status === StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2
        ? 'Mumtaz! Disahkan oleh Mudir Pesantren'
        : status === StatusIkhtibar.MENGULANG_SEBAGIAN
        ? `Mengulang sebagian maqra/halaman (Nilai: ${formData.nilai})`
        : `Mengulang satu juz penuh (Nilai: ${formData.nilai})`;

    const updated = await prisma.ikhtibarTahfizh.update({
      where: { id: formData.ikhtibarId },
      data: {
        nilaiTahap2: formData.nilai,
        catatanTahap2: formData.catatan || defaultCatatan,
        tanggalTahap2: new Date(),
        status,
        pengujiTahap2Id: session.staffId || null,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: 'INPUT_IKHTIBAR_TAHAP_2',
      entity: 'IkhtibarTahfizh',
      entityId: ikhtibar.id,
      details: { nilai: formData.nilai, status, disahkanOleh: session.username, hasilTahap2: effectiveJenis },
    });

    const statusMessage =
      status === StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2
        ? `Barakallahu fiik! ${ikhtibar.santri.nama} dinyatakan RESMI LULUS SELESAI JUZ ${ikhtibar.juz} (Nilai: ${formData.nilai}) oleh Mudir Pesantren.`
        : status === StatusIkhtibar.MENGULANG_SEBAGIAN
        ? `Hasil evaluasi disimpan. ${ikhtibar.santri.nama} diminta MENGULANG SEBAGIAN maqra pada Juz ${ikhtibar.juz} (Nilai: ${formData.nilai}).`
        : `Hasil evaluasi disimpan. ${ikhtibar.santri.nama} diminta MENGULANG SATU JUZ PENUH untuk Juz ${ikhtibar.juz} (Nilai: ${formData.nilai}).`;

    return {
      success: true,
      message: statusMessage,
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

/**
 * Ambil Jumlah Antrean Ikhtibar Riil
 * Status aktif/belum selesai sesuai aturan Ikhtibar:
 * - PENGAJUAN
 * - LULUS_TAHAP_1
 * - MENGULANG
 * - MENGULANG_SEBAGIAN
 * - MENGULANG_SATU_JUZ
 * Status selesai (LULUS_SEMPURNA_TAHAP_2) TIDAK dihitung.
 *
 * Otorisasi ABAC Fail-Closed:
 * - Role MT: Hanya menghitung santri dalam halaqoh yang dibinanya.
 *   Jika akun MT tidak memiliki relasi staffId atau halaqoh, return 0 secara fail-closed.
 *   Tidak menghitung seluruh santri pesantren untuk akun MT.
 * - Role KS / ADM / PH: Menghitung seluruh santri pesantren yang antre.
 * - Role ST / WS: Menghitung hanya santri terkait (santriId).
 */
export async function getIkhtibarPendingCountAction(
  sessionOverride?: UserSession
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const session = sessionOverride || (await getSession());
    if (!session) {
      return { success: false, count: 0, error: 'UNAUTHORIZED: Sesi tidak sah atau belum login.' };
    }

    const activeStatuses: StatusIkhtibar[] = [
      StatusIkhtibar.PENGAJUAN,
      StatusIkhtibar.LULUS_TAHAP_1,
      StatusIkhtibar.MENGULANG,
      StatusIkhtibar.MENGULANG_SEBAGIAN,
      StatusIkhtibar.MENGULANG_SATU_JUZ,
    ];

    if (session.role === 'MT') {
      // Fail-closed ABAC: akun MT tanpa relasi staffId menghasilkan 0
      if (!session.staffId) {
        return { success: true, count: 0 };
      }

      // Ambil halaqoh binaan MT
      const halaqohList = await prisma.halaqoh.findMany({
        where: { pembinaId: session.staffId },
        select: { id: true },
      });

      const halaqohIds = halaqohList.map((h) => h.id);
      if (halaqohIds.length === 0) {
        // Fail-closed: MT tanpa halaqoh binaan menghasilkan 0
        return { success: true, count: 0 };
      }

      // Hitung hanya santri dalam halaqoh kewenangannya
      const count = await prisma.ikhtibarTahfizh.count({
        where: {
          status: { in: activeStatuses },
          santri: {
            halaqohId: { in: halaqohIds },
          },
        },
      });

      return { success: true, count };
    }

    if (session.role === 'KS' || session.role === 'ADM' || session.role === 'PH') {
      const count = await prisma.ikhtibarTahfizh.count({
        where: {
          status: { in: activeStatuses },
        },
      });
      return { success: true, count };
    }

    if (session.role === 'ST' || session.role === 'WS') {
      if (!session.santriId) {
        return { success: true, count: 0 };
      }
      const count = await prisma.ikhtibarTahfizh.count({
        where: {
          status: { in: activeStatuses },
          santriId: session.santriId,
        },
      });
      return { success: true, count };
    }

    return { success: true, count: 0 };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, count: 0, error: errorMsg };
  }
}
