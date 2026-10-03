"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { JenisNilai } from "@prisma/client";

export interface InputNilaiData {
  santriId: string;
  mapelId: string;
  semester: number;
  tahunAjaran: string;
  jenis: JenisNilai;
  angka: number;
  catatan?: string;
  namaPengajarSnapshot?: string;
  educationSessionId?: string;
}

/**
 * Server Action: Input Nilai Akademik (Khusus GA, KS, dan Akun Mata Pelajaran)
 */
export async function inputNilaiAction(input: InputNilaiData): Promise<{
  success: boolean;
  message: string;
  errorCode?: string;
  error?: string;
  data?: unknown;
}> {
  void input;
  return {
    success: false,
    message: "Fitur perubahan dan penginputan nilai belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
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

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true, accountType: true },
  });

  if (!user || user.status !== "AKTIF") {
    return { success: false, message: "Akses Ditolak: Pengguna tidak ditemukan atau tidak aktif." };
  }

  // D. Consolidated report: SUBJECT account must NEVER access getRaporGabunganAction (regardless of binding, role, staffId)
  if (user.accountType === "SUBJECT") {
    return {
      success: false,
      message: "Akses Ditolak: Akun mata pelajaran hanya berwenang mengakses data mata pelajarannya sendiri.",
    };
  }

  if (session.role === "ST" && session.santriId !== santriId) {
    return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat rapor Anda sendiri." };
  }
  if (session.role === "WS" && session.santriId !== santriId) {
    return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat rapor ananda Anda sendiri." };
  }
  if ((session.role === "MT" || session.role === "PH") && !session.isKepalaBidangTahfidz) {
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Profil staf pembina Anda belum terhubung. Hubungi Admin." };
    }
    const isBinaan = await prisma.halaqoh.findFirst({
      where: {
        pembinaId: session.staffId,
        santriList: { some: { id: santriId } },
      },
    });
    if (!isBinaan) {
      return {
        success: false,
        message: "Akses Ditolak: Anda hanya berwenang melihat rapor santri di dalam halaqoh binaan Anda.",
      };
    }
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      select: {
        id: true,
        nis: true,
        nama: true,
        kelas: true,
        jenisKelamin: true,
        status: true,
        isYatimDhuafa: true,
        targetAkhirProgramJuz: true,
        modalHafalanAwalHalaman: true,
        tanggalBaselineTahfizh: true,
        namaWali: true,
        noHpWali: true,
        halaqohId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
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

  // 1. Fetch user to inspect accountType and status
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true, accountType: true },
  });

  if (!user) {
    return { success: false, message: "Pengguna tidak ditemukan.", data: [] };
  }

  let effectiveMapelId = params?.mapelId;

  // 2. SUBJECT Account Authority Validation (Fail-closed)
  if (user.accountType === "SUBJECT") {
    // A. require User.status = AKTIF
    if (user.status !== "AKTIF") {
      return {
        success: false,
        message: "Akses Ditolak: Akun subjek tidak aktif.",
        data: [],
      };
    }

    // B. require active AcademicSubjectAccountBinding
    const binding = await prisma.academicSubjectAccountBinding.findUnique({
      where: { userId: session.userId },
    });

    if (!binding || !binding.isActive || !binding.subjectId || binding.userId !== session.userId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun subjek tidak memiliki binding mata pelajaran aktif yang valid.",
        data: [],
      };
    }

    // C. Force mapelId = binding.subjectId. If caller requests another mapel: DENY.
    if (params?.mapelId && params.mapelId !== binding.subjectId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun mata pelajaran tidak berwenang melihat nilai untuk mata pelajaran lain.",
        data: [],
      };
    }

    effectiveMapelId = binding.subjectId;
  } else {
    // PERSONAL / UNIT account:
    // Accidental or malicious subject binding does NOT grant SUBJECT authority.
    effectiveMapelId = params?.mapelId;
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
        mapelId: effectiveMapelId,
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
