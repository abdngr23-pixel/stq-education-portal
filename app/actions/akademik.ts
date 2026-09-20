"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { JenisNilai } from "@prisma/client";
import { konversiPredikatNilai, KEPESANTRENAN_KODE_MAPEL, canManageKepesantrenan } from "@/lib/educational-rules";

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
export async function inputNilaiAction(input: InputNilaiData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // ADM is strictly denied from academic and kepesantrenan grading
  if (session.role === "ADM") {
    return {
      success: false,
      message: "Akses Ditolak: Role ADM tidak memiliki hak akses untuk menginput nilai akademik.",
    };
  }

  try {
    const mapel = await prisma.mataPelajaran.findUnique({
      where: { id: input.mapelId },
      select: { id: true, nama: true, kodeMapel: true, kategori: true },
    });

    if (!mapel) {
      return { success: false, message: "Mata pelajaran tidak ditemukan." };
    }

    const isKepesantrenan =
      mapel.kategori === "KEPESANTRENAN" ||
      KEPESANTRENAN_KODE_MAPEL.includes(mapel.kodeMapel);

    // Prevent generic endpoint bypass for Kepesantrenan subjects
    if (isKepesantrenan && !canManageKepesantrenan(session)) {
      return {
        success: false,
        message: "Akses Ditolak: Anda tidak memiliki wewenang mengelola penilaian kepesantrenan.",
      };
    }

    let guruStaffId: string | null = null;
    let namaPengajarSnapshot: string | null = null;

    // Check technical identity & subject binding
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, status: true, accountType: true },
    });

    const binding = await prisma.academicSubjectAccountBinding.findUnique({
      where: { userId: session.userId },
    });

    if (binding || user?.accountType === "SUBJECT") {
      if (!user || user.status !== "AKTIF") {
        return {
          success: false,
          message: "Akses Ditolak: Akun mata pelajaran tidak aktif.",
        };
      }

      if (user.accountType !== "SUBJECT") {
        return {
          success: false,
          message: "Akses Ditolak: Hanya akun teknikal mata pelajaran (SUBJECT) yang berwenang menggunakan binding mata pelajaran.",
        };
      }

      if (!binding || !binding.isActive || binding.userId !== session.userId) {
        return {
          success: false,
          message: "Akses Ditolak: Akun tidak memiliki binding aktif mata pelajaran.",
        };
      }

      if (binding.subjectId !== input.mapelId) {
        return {
          success: false,
          message: "Akses Ditolak: Akun mata pelajaran tidak berwenang menginput nilai untuk mata pelajaran lain.",
        };
      }

      // Requirement 3: Grading MUST follow a valid started session
      if (!input.educationSessionId || !input.educationSessionId.trim()) {
        return {
          success: false,
          message: "Akses Ditolak: Penilaian mata pelajaran wajib menyertakan ID sesi pembelajaran (educationSessionId) yang valid dan telah dimulai.",
        };
      }

      const educationSession = await prisma.educationSession.findUnique({
        where: { id: input.educationSessionId.trim() },
        include: {
          participants: {
            select: { santriId: true },
          },
        },
      });

      if (!educationSession) {
        return {
          success: false,
          message: "Akses Ditolak: Sesi pembelajaran tidak ditemukan.",
        };
      }

      if (educationSession.educationTrack !== "STUDI_UMUM") {
        return {
          success: false,
          message: "Akses Ditolak: Sesi pembelajaran bukan sesi Studi Umum.",
        };
      }

      if (educationSession.status !== "STARTED" && educationSession.status !== "COMPLETED") {
        return {
          success: false,
          message: `Akses Ditolak: Sesi pembelajaran belum dimulai (status: ${educationSession.status}).`,
        };
      }

      if (educationSession.startedByUserId !== session.userId) {
        return {
          success: false,
          message: "Akses Ditolak: Sesi pembelajaran ini tidak dimulai oleh akun mata pelajaran Anda.",
        };
      }

      if (binding.subjectId !== educationSession.subjectId || input.mapelId !== educationSession.subjectId) {
        return {
          success: false,
          message: "Akses Ditolak: Mata pelajaran sesi tidak sesuai dengan binding akun Anda.",
        };
      }

      // Target Santri belongs to valid session participant scope
      const isParticipant = educationSession.participants.some((p) => p.santriId === input.santriId);
      if (!isParticipant) {
        return {
          success: false,
          message: "Akses Ditolak: Santri berada di luar cakupan peserta sesi pembelajaran ini.",
        };
      }

      // namaPengajarSnapshot MUST be derived SERVER-SIDE from EducationSession.actualTeacherName
      namaPengajarSnapshot = educationSession.actualTeacherName || null;
      if (!namaPengajarSnapshot) {
        return {
          success: false,
          message: "Akses Ditolak: Sesi pembelajaran tidak memiliki nama pengajar aktual yang valid.",
        };
      }
    } else if (session.role !== "GA" && session.role !== "KS") {
      return {
        success: false,
        message: `Role ${session.role} tidak memiliki hak akses untuk menginput nilai akademik.`,
      };
    } else {
      // For GA / KS:
      if (session.staffId) {
        const guruStaff = await prisma.staff.findUnique({ where: { id: session.staffId } });
        if (guruStaff) {
          guruStaffId = guruStaff.id;
          namaPengajarSnapshot = guruStaff.nama;
        }
      }
    }

    // Konversi angka ke predikat huruf menggunakan single source of truth
    const huruf = konversiPredikatNilai(Number(input.angka));

    const nilaiRecord = await prisma.nilaiAkademik.create({
      data: {
        santriId: input.santriId,
        mapelId: input.mapelId,
        guruId: guruStaffId,
        namaPengajarSnapshot,
        dicatatOlehUserId: session.userId,
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
        namaPengajarSnapshot,
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

  // Validasi Kepemilikan Data ABAC (Fail-closed)
  const binding = await prisma.academicSubjectAccountBinding.findUnique({
    where: { userId: session.userId },
  });
  if (binding && binding.isActive) {
    return { success: false, message: "Akses Ditolak: Akun mata pelajaran hanya berwenang mengakses data mata pelajarannya sendiri." };
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

  let effectiveSantriId = params?.santriId;
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId) {
      return { success: false, message: "Akun belum terhubung dengan data santri.", data: [] };
    }
    effectiveSantriId = session.santriId;
  }

  // Validasi isolasi akun mata pelajaran (1 technical account = 1 subject)
  const binding = await prisma.academicSubjectAccountBinding.findUnique({
    where: { userId: session.userId },
  });

  if (binding && binding.isActive) {
    if (params?.mapelId && params.mapelId !== binding.subjectId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun mata pelajaran tidak berwenang melihat nilai untuk mata pelajaran lain.",
        data: [],
      };
    }
  }

  const effectiveMapelId = binding && binding.isActive ? binding.subjectId : params?.mapelId;

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

