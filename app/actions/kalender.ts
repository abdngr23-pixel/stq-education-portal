'use server';

import prisma from '@/lib/prisma';
import { getSession, requireRole, recordAuditLog } from '@/lib/auth';

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
 * Mengambil Daftar Agenda Kalender Akademik Internal (RBAC Fail-Closed)
 * - Sesi tidak ada -> Akses ditolak, data []
 * - Sesuai ROLE_NAV_MAP resmi: Hanya KS, ADM, dan GA yang memiliki akses kalender internal
 * - Role lain (WS, ST, MT, PH, MK, OSDA, YAY) -> Akses ditolak, data []
 * Untuk agenda umum/publik bagi wali/santri, gunakan getPublicAgendaAction() (targetPeserta === 'SEMUA').
 */
export async function getDaftarAgendaAction(): Promise<KalenderResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        message: 'Akses Ditolak: Sesi otentikasi tidak ditemukan.',
        data: [],
      };
    }

    if (!['KS', 'ADM', 'GA'].includes(session.role)) {
      return {
        success: false,
        message: 'Akses Ditolak: Role Anda tidak memiliki wewenang mengakses agenda internal.',
        data: [],
      };
    }

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
    return { success: false, message: errorMsg, error: errorMsg, data: [] };
  }
}

/**
 * Mengambil Agenda Publik Resmi (Terbuka untuk Umum / Calon Donatur / Wali)
 * Menampilkan hanya agenda yang aman dan disetujui untuk publik (targetPeserta === "SEMUA").
 * Tidak membuka agenda internal atau informasi pribadi santri/staf.
 */
export async function getPublicAgendaAction(): Promise<KalenderResponse<Array<{
  id: string;
  judul: string;
  deskripsi: string | null;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  kategori: string;
  lokasi: string | null;
}>>> {
  try {
    const list = await prisma.kalenderAkademik.findMany({
      where: {
        targetPeserta: 'SEMUA',
      },
      orderBy: { tanggalMulai: 'asc' },
      take: 10,
    });

    return {
      success: true,
      message: list.length > 0 ? 'Berhasil memuat agenda publik' : 'Belum ada agenda yang dipublikasikan',
      data: list.map((a) => ({
        id: a.id,
        judul: a.judul,
        deskripsi: a.deskripsi,
        tanggalMulai: a.tanggalMulai.toISOString(),
        tanggalSelesai: a.tanggalSelesai ? a.tanggalSelesai.toISOString() : null,
        kategori: a.kategori,
        lokasi: a.lokasi,
      })),
    };
  } catch (err: unknown) {
    // Fail-safe: kembalikan list kosong dengan status jujur tanpa data rekaan
    const errorMsg = err instanceof Error ? err.message : 'Gagal memuat agenda publik';
    return {
      success: false,
      message: 'Belum ada agenda yang dipublikasikan',
      data: [],
      error: errorMsg,
    };
  }
}
