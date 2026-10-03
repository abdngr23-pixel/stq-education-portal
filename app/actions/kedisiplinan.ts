"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { UserSession } from "@/types/auth";
import { KategoriBintang, Prisma } from "@prisma/client";

export interface CatatPelanggaranData {
  santriId: string;
  kategoriId: string;
  kronologi: string;
}

/**
 * Server Action: Mencatat Pelanggaran Baru
 * Memuat Engine Logika Bisnis:
 * 1. Deteksi Pengulangan otomatis (jika pernah melanggar kategori sama -> poin x2)
 * 2. Akumulasi Poin Pelanggaran
 * 3. Penerbitan otomatis Surat Peringatan (SP 1 >= 20, SP 2 >= 40, SP 3 >= 60)
 */
export interface CatatPelanggaranResultData {
  id: string;
  kodePelanggaran: string;
  poinFinal: number;
  isPengulangan: boolean;
}

export async function catatPelanggaranAction(input: CatatPelanggaranData): Promise<{
  success: boolean;
  message: string;
  errorCode?: string;
  error?: string;
  data?: CatatPelanggaranResultData;
  totalPoin?: number;
}> {
  void input;
  return {
    success: false,
    message: "Fitur perubahan data belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Pemutihan Surat Peringatan (Khusus Kepala Sekolah / Mudir KS)
 */
export async function putihkanSPAction(params: { spId: string; keterangan: string }) {
  void params;
  return {
    success: false,
    message: "Fitur perubahan data belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Menganugerahkan Bintang Santri Teladan
 */
export async function anugerahkanBintangAction(params: {
  santriId: string;
  periode: string;
  kategori: KategoriBintang;
  prestasi: string;
}) {
  void params;
  return {
    success: false,
    message: "Fitur perubahan data belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Mengambil data kategori pelanggaran yang tersedia
 */
export async function getKategoriPelanggaranListAction() {
  try {
    const list = await prisma.kategoriPelanggaran.findMany({
      orderBy: { kode: "asc" },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil kategori:", error);
    return { success: false, data: [] };
  }
}

/**
 * Resolusi Lingkup Otorisasi & Filter Data Kedisiplinan (Pelanggaran & SP)
 * Sesuai Tata Kelola Sementara: IDENTITY + ROLE + ASSIGNMENT + DOMAIN + SCOPE = PERMISSION
 */
async function resolveKedisiplinanScope(
  session: UserSession,
  requestedSantriId?: string
): Promise<
  | { authorized: true; santriId?: string; santriWhere?: Prisma.SantriWhereInput }
  | { authorized: false; message: string }
> {
  // 1. Wali Santri & Santri: Hanya dapat membaca data santri binaan/pribadi
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId) {
      return { authorized: false, message: "Akses Ditolak: Akun belum terhubung dengan data santri." };
    }
    if (requestedSantriId && requestedSantriId !== session.santriId) {
      return { authorized: false, message: "Akses Ditolak: Anda tidak memiliki akses ke data santri lain." };
    }
    return { authorized: true, santriId: session.santriId };
  }

  // 2. Musyrif Tahfizh & Pembina Halaqoh: Memerlukan profil staf aktif
  if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { authorized: false, message: "Akses Ditolak: Profil staf pembina Anda belum terhubung." };
    }
    // Kepala Bidang Tahfidz memiliki akses manajerial menyeluruh
    if (session.isKepalaBidangTahfidz) {
      if (requestedSantriId) {
        return { authorized: true, santriId: requestedSantriId };
      }
      return { authorized: true };
    }
    // Staf biasa: hanya santri dalam halaqoh yang dipimpinnya
    if (requestedSantriId) {
      const santri = await prisma.santri.findUnique({
        where: { id: requestedSantriId },
        select: { id: true, halaqoh: { select: { pembinaId: true } } },
      });
      if (!santri || santri.halaqoh?.pembinaId !== session.staffId) {
        return {
          authorized: false,
          message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda.",
        };
      }
      return { authorized: true, santriId: requestedSantriId };
    }
    return {
      authorized: true,
      santriWhere: {
        halaqoh: {
          pembinaId: session.staffId,
        },
      },
    };
  }

  // 3. Wewenang manajerial & pengawasan (MK, KS, ADM, YAY)
  if (["MK", "KS", "ADM", "YAY"].includes(session.role)) {
    if (requestedSantriId) {
      return { authorized: true, santriId: requestedSantriId };
    }
    return { authorized: true };
  }

  // 4. Role tidak berwenang (GA, OSDA, dll): FAIL-CLOSED
  return {
    authorized: false,
    message: `Akses Ditolak: Role ${session.role} tidak memiliki otorisasi mengakses data kedisiplinan.`,
  };
}

/**
 * Server Action: Mengambil daftar riwayat pelanggaran santri (Terkontrol Sesi & ABAC Fail-Closed)
 */
export async function getPelanggaranListAction(santriId?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi kedaluwarsa. Silakan login kembali.", data: [] };
  }

  const scope = await resolveKedisiplinanScope(session, santriId);
  if (!scope.authorized) {
    return { success: false, message: scope.message, data: [] };
  }

  const where: Prisma.PelanggaranSantriWhereInput = scope.santriId
    ? { santriId: scope.santriId }
    : scope.santriWhere
    ? { santri: scope.santriWhere }
    : {};

  try {
    const records = await prisma.pelanggaranSantri.findMany({
      where,
      include: {
        santri: { select: { id: true, nama: true, nis: true, kelas: true } },
        kategori: { select: { id: true, nama: true, tingkat: true, poinDasar: true } },
        pencatat: { select: { id: true, nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        kode: r.kodePelanggaran,
        santriId: r.santriId,
        santriNama: r.santri?.nama || "Santri",
        santriNis: r.santri?.nis || "",
        santriKelas: r.santri?.kelas || "",
        kategori: r.namaPelanggaranSnapshot || r.kategori?.nama || "Pelanggaran",
        kategoriId: r.kategoriId,
        tingkat: r.kategoriSnapshot || r.kategori?.tingkat || "KATEGORI_2",
        sanksi: r.sanksiSnapshot || (r.poinFinal > 0 ? `${r.poinFinal} Poin` : "-"),
        poin: r.poinFinal,
        isPengulangan: r.isPengulangan,
        kronologi: r.kronologi,
        tanggal: r.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
        pencatat: r.pencatat?.nama || "Musyrif",
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data pelanggaran:", error);
    return { success: false, message: "Gagal memuat catatan pelanggaran dari server.", data: [] };
  }
}

/**
 * Server Action: Mengambil daftar Surat Peringatan / SP resmi (Terkontrol Sesi & ABAC Fail-Closed)
 */
export async function getSPListAction(santriId?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi kedaluwarsa. Silakan login kembali.", data: [] };
  }

  const scope = await resolveKedisiplinanScope(session, santriId);
  if (!scope.authorized) {
    return { success: false, message: scope.message, data: [] };
  }

  const where: Prisma.SuratPeringatanWhereInput = scope.santriId
    ? { santriId: scope.santriId }
    : scope.santriWhere
    ? { santri: scope.santriWhere }
    : {};

  try {
    const records = await prisma.suratPeringatan.findMany({
      where,
      include: {
        santri: { select: { id: true, nama: true, nis: true, kelas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: records.map((sp) => ({
        id: sp.id,
        nomorSP: sp.nomorSP,
        santriId: sp.santriId,
        santriNama: sp.santri?.nama || "Santri",
        santriNis: sp.santri?.nis || "",
        santriKelas: sp.santri?.kelas || "",
        tingkat: sp.tingkatSP,
        totalPoin: sp.totalPoinSaatTerbit,
        status: sp.status,
        keteranganPemutihan: sp.keteranganPemutihan,
        tanggalPemutihan: sp.tanggalPemutihan?.toISOString(),
        tanggal: sp.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
        createdAt: sp.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data SP:", error);
    return { success: false, message: "Gagal memuat data SP dari server.", data: [] };
  }
}

/**
 * Server Action: Mengambil 44 Master Data Kategori Pelanggaran Resmi STQ DUC dari Database
 */
export async function getMasterPelanggaranListAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi kedaluwarsa. Silakan login kembali.", data: [] };
  }

  try {
    const list = await prisma.kategoriPelanggaran.findMany({
      orderBy: [{ tingkat: "asc" }, { kode: "asc" }],
    });

    return {
      success: true,
      data: list.map((k) => ({
        id: k.id, // Primary Key DB asli
        kode: k.kode,
        nama: k.nama,
        tingkat: k.tingkat,
        sanksi: k.sanksi,
        poinDasar: k.poinDasar,
        deskripsi: k.sanksi || "",
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil master kategori pelanggaran:", error);
    return { success: false, message: "Gagal memuat master pelanggaran dari pangkalan data.", data: [] };
  }
}
