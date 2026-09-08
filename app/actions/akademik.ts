"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { JenisNilai } from "@prisma/client";
import { konversiPredikatNilai } from "@/lib/educational-rules";

export interface InputNilaiData {
  santriId: string;
  mapelId: string;
  semester: number;
  tahunAjaran: string;
  jenis: JenisNilai;
  angka: number;
  catatan?: string;
}

/**
 * Server Action: Input Nilai Akademik (Khusus GA & KS)
 */
export async function inputNilaiAction(input: InputNilaiData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // 1. Role validation: Hanya GA (Guru Akademik) dan KS (Kepala Sekolah)
  if (session.role !== "GA" && session.role !== "KS") {
    return {
      success: false,
      message: `Role ${session.role} tidak memiliki hak akses untuk menginput nilai akademik.`,
    };
  }

  try {
    const guruStaff = session.staffId
      ? await prisma.staff.findUnique({ where: { id: session.staffId } })
      : await prisma.staff.findFirst({ where: { roleStaff: "GA" } });

    if (!guruStaff) {
      return { success: false, message: "Data staf pengajar tidak ditemukan." };
    }

    // Konversi angka ke predikat huruf menggunakan single source of truth
    const huruf = konversiPredikatNilai(Number(input.angka));

    const nilaiRecord = await prisma.nilaiAkademik.create({
      data: {
        santriId: input.santriId,
        mapelId: input.mapelId,
        guruId: guruStaff.id,
        semester: Number(input.semester),
        tahunAjaran: input.tahunAjaran,
        jenis: input.jenis,
        angka: Number(input.angka),
        huruf,
        catatan: input.catatan,
      },
      include: {
        santri: true,
        mapel: true,
      },
    });

    // Audit log
    await recordAuditLog({
      userId: session.userId,
      action: "INPUT_NILAI",
      entity: "NilaiAkademik",
      entityId: nilaiRecord.id,
      details: {
        santriNis: nilaiRecord.santri.nis,
        mapel: nilaiRecord.mapel.nama,
        angka: input.angka,
        huruf,
      },
    });

    return {
      success: true,
      message: `Nilai ${nilaiRecord.mapel.nama} untuk ${nilaiRecord.santri.nama} berhasil disimpan (${huruf} - ${input.angka}).`,
      data: nilaiRecord,
    };
  } catch (error) {
    console.error("Gagal menyimpan nilai akademik:", error);
    return { success: false, message: "Gagal menyimpan nilai ke pangkalan data." };
  }
}

/**
 * Server Action: Mengambil daftar mata pelajaran
 */
export async function getMataPelajaranListAction() {
  try {
    const list = await prisma.mataPelajaran.findMany({
      orderBy: { kodeMapel: "asc" },
      include: { guru: true },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil mata pelajaran:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mengambil Nilai Santri & Rapor Terintegrasi (Tahfizh + Akademik + Asrama)
 */
export async function getRaporGabunganAction(santriId: string, semester: number = 1) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Validasi Kepemilikan Data ABAC
  if (session.role === "ST" && session.santriId !== santriId) {
    return { success: false, message: "Anda hanya berhak melihat rapor Anda sendiri." };
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      include: {
        halaqoh: { include: { pembina: true } },
        nilaiList: {
          where: { semester },
          include: { mapel: true, guru: true },
          orderBy: { mapel: { kodeMapel: "asc" } },
        },
        setoranList: {
          take: 10,
          orderBy: { tanggal: "desc" },
        },
        perizinanList: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
        absensiList: {
          take: 10,
          orderBy: { tanggal: "desc" },
        },
      },
    });

    if (!santri) {
      return { success: false, message: "Data santri tidak ditemukan." };
    }

    // Kalkulasi rata-rata nilai akademik
    const totalAngka = santri.nilaiList.reduce((acc, curr) => acc + curr.angka, 0);
    const rataRataAkademik = santri.nilaiList.length > 0 ? (totalAngka / santri.nilaiList.length).toFixed(1) : "0";

    // Hitung capaian tahfizh
    const maxJuz = santri.setoranList.reduce((max, s) => Math.max(max, s.juz), 0);

    return {
      success: true,
      data: {
        santri,
        ringkasan: {
          rataRataAkademik,
          totalMapelDinilai: santri.nilaiList.length,
          capaianJuzTertinggi: maxJuz,
          totalSetoran: santri.setoranList.length,
          totalIzin: santri.perizinanList.length,
        },
      },
    };
  } catch (error) {
    console.error("Gagal mengambil rapor gabungan:", error);
    return { success: false, message: "Terjadi kesalahan saat mengolah rapor gabungan." };
  }
}

/**
 * Server Action: Mengambil daftar nilai akademik santri berdasarkan filter kelas, mapel, semester, dan jenis
 */
export async function getNilaiAkademikListAction(params?: {
  santriId?: string;
  kelas?: string;
  mapelId?: string;
  semester?: number;
  jenis?: JenisNilai;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu.", data: [] };
  }

  let effectiveSantriId = params?.santriId;
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId) {
      return { success: false, message: "Akun belum terhubung dengan data santri.", data: [] };
    }
    effectiveSantriId = session.santriId;
  }

  try {
    const list = await prisma.nilaiAkademik.findMany({
      where: {
        santriId: effectiveSantriId,
        mapelId: params?.mapelId,
        semester: params?.semester,
        jenis: params?.jenis,
        santri: params?.kelas ? { kelas: params.kelas } : undefined,
      },
      include: {
        santri: { select: { id: true, nama: true, nis: true, kelas: true } },
        mapel: { select: { id: true, nama: true, kodeMapel: true, kategori: true } },
        guru: { select: { id: true, nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: list.map((item) => ({
        id: item.id,
        santriId: item.santriId,
        santriNama: item.santri.nama,
        santriNis: item.santri.nis,
        kelas: item.santri.kelas,
        mapelId: item.mapelId,
        mapelNama: item.mapel.nama,
        mapelKategori: item.mapel.kategori,
        semester: item.semester,
        tahunAjaran: item.tahunAjaran,
        jenis: item.jenis,
        angka: item.angka,
        huruf: item.huruf,
        catatan: item.catatan || "",
        guruNama: item.guru?.nama || "Guru Pengajar",
        createdAt: item.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil daftar nilai akademik:", error);
    return { success: false, message: "Gagal memuat daftar nilai dari server.", data: [] };
  }
}

