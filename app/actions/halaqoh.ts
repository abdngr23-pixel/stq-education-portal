"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export interface CreateHalaqohInput {
  nama: string;
  pembinaId?: string;
  tahunAjaran: string;
}

/**
 * Server Action: Mengambil daftar halaqoh (dengan otorisasi sesi & scoping ABAC)
 */
export async function getHalaqohListAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, data: [], message: "Sesi telah berakhir. Silakan login kembali." };
  }

  const where: Prisma.HalaqohWhereInput = {};

  if (["KS", "ADM", "YAY"].includes(session.role) || session.isKepalaBidangTahfidz) {
    // Read global diperbolehkan untuk KS, ADM, YAY, dan Kabid Tahfidz
  } else if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { success: false, data: [], message: "Akses Ditolak: Profil staf belum terhubung." };
    }
    where.pembinaId = session.staffId;
  } else if (session.role === "MK") {
    // MK diperbolehkan membaca daftar halaqoh untuk monitoring data santri / asrama
  } else {
    return { success: false, data: [], message: "Akses Ditolak: Anda tidak memiliki wewenang untuk melihat daftar halaqoh." };
  }

  try {
    const list = await prisma.halaqoh.findMany({
      where,
      orderBy: { nama: "asc" },
      select: {
        id: true,
        halaqohCode: true,
        nama: true,
        tahunAjaran: true,
        status: true,
        pembina: {
          select: {
            id: true,
            nama: true,
            staffCode: true,
          },
        },
        _count: {
          select: { santriList: true },
        },
      },
    });

    return { success: true, data: list, message: "Berhasil mengambil data halaqoh." };
  } catch (error) {
    console.error("Gagal mengambil data halaqoh:", error);
    return { success: false, data: [], message: "Gagal mengambil data halaqoh dari pangkalan data." };
  }
}

/**
 * Server Action: Mengambil detail halaqoh dan daftar santri di dalamnya (ABAC fail-closed)
 */
export async function getHalaqohDetailAction(halaqohId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!halaqohId) {
    return { success: false, message: "ID halaqoh wajib diberikan." };
  }

  if (["KS", "ADM", "YAY"].includes(session.role) || session.isKepalaBidangTahfidz) {
    // Read global diperbolehkan
  } else if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Profil staf belum terhubung." };
    }
    try {
      const checkBinaan = await prisma.halaqoh.findFirst({
        where: { id: halaqohId, pembinaId: session.staffId },
        select: { id: true },
      });
      if (!checkBinaan) {
        return { success: false, message: "Akses Ditolak: Anda hanya berwenang melihat detail halaqoh binaan Anda sendiri." };
      }
    } catch (err) {
      console.error("Gagal memverifikasi hak akses halaqoh:", err);
      return { success: false, message: "Gagal memverifikasi wewenang halaqoh dari pangkalan data." };
    }
  } else if (session.role === "MK") {
    // MK diperbolehkan membaca detail halaqoh untuk kebutuhan asrama
  } else {
    return { success: false, message: "Akses Ditolak: Anda tidak memiliki wewenang untuk melihat detail halaqoh ini." };
  }

  try {
    const halaqoh = await prisma.halaqoh.findUnique({
      where: { id: halaqohId },
      select: {
        id: true,
        halaqohCode: true,
        nama: true,
        tahunAjaran: true,
        status: true,
        pembina: {
          select: {
            id: true,
            nama: true,
          },
        },
        santriList: {
          where: { status: "AKTIF" },
          orderBy: { nama: "asc" },
          select: {
            id: true,
            nis: true,
            nama: true,
            kelas: true,
            jenisKelamin: true,
            status: true,
          },
        },
      },
    });

    if (!halaqoh) {
      return { success: false, message: "Halaqoh tidak ditemukan" };
    }

    const ikhwanList = halaqoh.santriList.filter((s) => s.jenisKelamin === "L");
    const akhwatList = halaqoh.santriList
      .filter((s) => s.jenisKelamin === "P")
      .sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));

    return { success: true, data: { ...halaqoh, santriList: [...ikhwanList, ...akhwatList] } };
  } catch (error) {
    console.error("Gagal mengambil detail halaqoh:", error);
    return { success: false, message: "Terjadi kesalahan saat memuat detail halaqoh" };
  }
}

/**
 * Server Action: Buat Halaqoh Baru (Wewenang KS & ADM)
 */
export async function createHalaqohAction(input: CreateHalaqohInput) {
  void input;
  return {
    success: false,
    message: "Fitur pembuatan halaqoh baru belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Tugaskan / Ganti Pembina Musyrif Halaqoh (Wewenang KS & ADM)
 */
export async function assignPembinaHalaqohAction(halaqohId: string, pembinaId: string) {
  void halaqohId;
  void pembinaId;
  return {
    success: false,
    message: "Fitur penugasan pembina halaqoh belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Pindahkan Santri ke Halaqoh Lain (Wewenang KS & ADM)
 */
export async function pindahkanSantriHalaqohAction(santriId: string, newHalaqohId: string) {
  void santriId;
  void newHalaqohId;
  return {
    success: false,
    message: "Fitur pemindahan santri halaqoh belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).",
    errorCode: "POLICY_NOT_ACTIVE",
    error: "POLICY_NOT_ACTIVE",
  };
}

/**
 * Server Action: Mengambil daftar staf yang dapat ditugaskan sebagai pembina halaqoh (Restricted to KS & ADM)
 */
export async function getAssignableStaffAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali.", data: [] };
  }

  if (!["KS", "ADM"].includes(session.role)) {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Kepala Sekolah / Mudir dan Admin yang berwenang mengambil daftar staf penugasan halaqoh.",
      data: [],
    };
  }

  try {
    const staffList = await prisma.staff.findMany({
      where: {
        status: "AKTIF",
        roleStaff: { in: ["MT", "PH"] },
      },
      select: {
        id: true,
        staffCode: true,
        nama: true,
        roleStaff: true,
        status: true,
      },
      orderBy: { staffCode: "asc" },
    });

    return {
      success: true,
      data: staffList,
      message: "Berhasil memuat daftar staf pembina.",
    };
  } catch (error) {
    console.error("Gagal mengambil daftar staf pembina:", error);
    return {
      success: false,
      message: "Gagal memuat daftar staf dari basis data.",
      data: [],
    };
  }
}

