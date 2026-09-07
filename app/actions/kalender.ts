'use server';

import prisma from '@/lib/prisma';
import { requireRole, recordAuditLog } from '@/lib/auth';

export interface KalenderResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Tambah Agenda / Kegiatan Pesantren
 * Akses: ADM, KS
 */
export async function tambahAgendaAction(formData: {
  judul: string;
  deskripsi?: string;
  tanggalMulai: string; // ISO string or YYYY-MM-DD
  tanggalSelesai?: string;
  kategori: string; // "TAHFIZH", "LIBUR", "UJIAN", "KEGIATAN_SANTRI"
  targetPeserta: string; // "SEMUA", "KELAS_7", "KELAS_8", "ASATIDZ"
  lokasi?: string;
}): Promise<KalenderResponse> {
  try {
    const session = await requireRole(['ADM', 'KS']);

    if (!formData.judul.trim() || !formData.tanggalMulai) {
      return { success: false, message: 'Judul dan tanggal mulai agenda wajib diisi.' };
    }

    const agenda = await prisma.kalenderAkademik.create({
      data: {
        judul: formData.judul,
        deskripsi: formData.deskripsi,
        tanggalMulai: new Date(formData.tanggalMulai),
        tanggalSelesai: formData.tanggalSelesai ? new Date(formData.tanggalSelesai) : null,
        kategori: formData.kategori,
        targetPeserta: formData.targetPeserta,
        lokasi: formData.lokasi,
      },
    });

    await recordAuditLog(
      session.userId,
      'TAMBAH_AGENDA_KALENDER',
      'KalenderAkademik',
      agenda.id,
      { judul: formData.judul, kategori: formData.kategori }
    );

    return {
      success: true,
      message: `Agenda "${formData.judul}" berhasil ditambahkan ke kalender akademik.`,
      data: agenda,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Mengambil Daftar Agenda Kalender Akademik
 */
export async function getDaftarAgendaAction(): Promise<KalenderResponse> {
  try {
    const list = await prisma.kalenderAkademik.findMany({
      orderBy: { tanggalMulai: 'asc' },
      take: 50,
    });

    return {
      success: true,
      message: 'Berhasil memuat kalender akademik',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
