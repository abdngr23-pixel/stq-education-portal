"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { UserSession } from "@/types/auth";
import { KategoriMapel, JenisNilai } from "@prisma/client";
import {
  KEPESANTRENAN_KODE_MAPEL,
  konversiAngkaKeHurufKepesantrenan as konversiAngkaKeHuruf,
} from "@/lib/educational-rules";

/**
 * Verifikasi apakah sesi pengguna berhak mengelola materi Kepesantrenan
 * Wewenang: KS (Mudir), ADM, MT (Musyrif Tahfizh), PH (Pembina Halaqoh), atau guru mapel terkait.
 * DITOLAK: Guru Akademik umum (GA) yang tidak ditugaskan pada mapel kepesantrenan.
 */
function canManageKepesantrenan(session: UserSession, mapelGuruId?: string | null): boolean {
  if (["KS", "ADM", "MT", "PH"].includes(session.role)) {
    return true;
  }
  if (session.role === "GA" && session.staffId && mapelGuruId === session.staffId) {
    return true;
  }
  return false;
}

/**
 * Server Action: Mengambil daftar 5 Mata Pelajaran Kepesantrenan
 */
export async function getMataPelajaranKepesantrenanAction() {
  try {
    const list = await prisma.mataPelajaran.findMany({
      where: {
        OR: [
          { kategori: KategoriMapel.KEPESANTRENAN },
          { kodeMapel: { in: KEPESANTRENAN_KODE_MAPEL } },
        ],
      },
      include: {
        guru: { select: { id: true, nama: true, staffCode: true } },
      },
      orderBy: { kodeMapel: "asc" },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil mapel kepesantrenan:", error);
    return { success: false, message: "Gagal memuat daftar mata pelajaran kepesantrenan.", data: [] };
  }
}

/**
 * Server Action: Input / Simpan Nilai Mata Pelajaran Kepesantrenan
 */
export async function inputNilaiKepesantrenanAction(params: {
  santriId: string;
  mapelId: string;
  semester: number;
  tahunAjaran: string;
  jenis: JenisNilai;
  angka: number;
  catatan?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // 1. Validasi nilai angka
  if (typeof params.angka !== "number" || params.angka < 0 || params.angka > 100) {
    return { success: false, message: "Nilai angka harus berada dalam rentang 0 hingga 100." };
  }

  try {
    // 2. Cek apakah mapel adalah kepesantrenan
    const mapel = await prisma.mataPelajaran.findUnique({
      where: { id: params.mapelId },
    });

    if (!mapel) {
      return { success: false, message: "Mata pelajaran tidak ditemukan." };
    }

    const isKepesantrenan =
      mapel.kategori === KategoriMapel.KEPESANTRENAN ||
      KEPESANTRENAN_KODE_MAPEL.includes(mapel.kodeMapel);

    if (!isKepesantrenan) {
      return { success: false, message: "Mata pelajaran ini bukan materi kepesantrenan resmi." };
    }

    // 3. Hak akses: Mudir, MT, PH, atau guru yang ditugaskan
    if (!canManageKepesantrenan(session, mapel.guruId)) {
      return {
        success: false,
        message: "Akses Ditolak: Anda tidak memiliki wewenang mengelola penilaian kepesantrenan.",
      };
    }

    // Tentukan guru penilai (staf aktif atau guru mapel)
    const guruId = session.staffId || mapel.guruId;
    if (!guruId) {
      return { success: false, message: "ID guru penilai belum terkonfigurasi pada profil akun Anda." };
    }

    const huruf = konversiAngkaKeHuruf(params.angka);

    // 4. Cari nilai yang sudah ada untuk jenis, semester, dan tahun ajaran yang sama
    const existing = await prisma.nilaiAkademik.findFirst({
      where: {
        santriId: params.santriId,
        mapelId: params.mapelId,
        semester: params.semester,
        tahunAjaran: params.tahunAjaran,
        jenis: params.jenis,
      },
    });

    let savedNilai;
    if (existing) {
      savedNilai = await prisma.nilaiAkademik.update({
        where: { id: existing.id },
        data: {
          angka: params.angka,
          huruf,
          catatan: params.catatan,
          guruId,
        },
        include: { santri: true, mapel: true },
      });
    } else {
      savedNilai = await prisma.nilaiAkademik.create({
        data: {
          santriId: params.santriId,
          mapelId: params.mapelId,
          guruId,
          semester: params.semester,
          tahunAjaran: params.tahunAjaran,
          jenis: params.jenis,
          angka: params.angka,
          huruf,
          catatan: params.catatan,
        },
        include: { santri: true, mapel: true },
      });
    }

    await recordAuditLog({
      userId: session.userId,
      action: "INPUT_NILAI_KEPESANTRENAN",
      entity: "NilaiAkademik",
      entityId: savedNilai.id,
      details: {
        santriNis: savedNilai.santri.nis,
        kodeMapel: mapel.kodeMapel,
        jenis: params.jenis,
        angka: params.angka,
        huruf,
      },
    });

    return {
      success: true,
      message: `Nilai ${mapel.nama} (${params.jenis}) untuk ${savedNilai.santri.nama} berhasil disimpan: ${params.angka} (${huruf}).`,
      data: savedNilai,
    };
  } catch (error) {
    console.error("Gagal menyimpan nilai kepesantrenan:", error);
    return { success: false, message: "Terjadi kesalahan sistem saat menyimpan nilai kepesantrenan." };
  }
}

/**
 * Server Action: Mengambil daftar nilai kepesantrenan santri (ABAC Protected)
 */
export async function getNilaiKepesantrenanSantriAction(params: {
  santriId?: string;
  semester?: number;
  tahunAjaran?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali.", data: [] };
  }

  // ABAC: Santri dan Wali Santri hanya boleh melihat nilainya sendiri
  let effectiveSantriId = params.santriId;
  if (session.role === "ST" || session.role === "WS") {
    if (!session.santriId) {
      return { success: false, message: "Akun belum terhubung dengan data santri.", data: [] };
    }
    effectiveSantriId = session.santriId;
  }

  try {
    const records = await prisma.nilaiAkademik.findMany({
      where: {
        santriId: effectiveSantriId ? effectiveSantriId : undefined,
        semester: params.semester,
        tahunAjaran: params.tahunAjaran,
        mapel: {
          OR: [
            { kategori: KategoriMapel.KEPESANTRENAN },
            { kodeMapel: { in: KEPESANTRENAN_KODE_MAPEL } },
          ],
        },
      },
      include: {
        santri: { select: { id: true, nama: true, nis: true, kelas: true } },
        mapel: { select: { id: true, nama: true, kodeMapel: true, kategori: true } },
        guru: { select: { id: true, nama: true } },
      },
      orderBy: [{ mapel: { kodeMapel: "asc" } }, { createdAt: "desc" }],
    });

    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        santriId: r.santriId,
        santriNama: r.santri.nama,
        santriNis: r.santri.nis,
        santriKelas: r.santri.kelas,
        mapelId: r.mapelId,
        mapelNama: r.mapel.nama,
        kodeMapel: r.mapel.kodeMapel,
        guruNama: r.guru.nama,
        semester: r.semester,
        tahunAjaran: r.tahunAjaran,
        jenis: r.jenis,
        angka: r.angka,
        huruf: r.huruf,
        catatan: r.catatan,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data nilai kepesantrenan:", error);
    return { success: false, message: "Gagal memuat rekap nilai kepesantrenan.", data: [] };
  }
}
