"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
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
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // Wajib Mudir/KS atau Admin
  if (!["KS", "ADM"].includes(session.role)) {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Kepala Sekolah / Mudir dan Admin yang berwenang membuat halaqoh.",
    };
  }

  try {
    const count = await prisma.halaqoh.count();
    const halaqohCode = `HLQ-${String(count + 1).padStart(4, "0")}`;
    let pembinaId = input.pembinaId;
    if (!pembinaId) {
      const defaultStaff = await prisma.staff.findFirst({
        where: { roleStaff: "MT", status: "AKTIF" },
      });
      if (!defaultStaff) {
        return { success: false, message: "Musyrif pembina wajib ditentukan." };
      }
      pembinaId = defaultStaff.id;
    } else {
      const staff = await prisma.staff.findUnique({
        where: { id: pembinaId },
      });
      if (!staff || staff.status !== "AKTIF" || !["MT", "PH"].includes(staff.roleStaff)) {
        return {
          success: false,
          message: "Akses Ditolak: Staf yang dipilih tidak memenuhi syarat sebagai pembina halaqoh (Hanya staf aktif dengan peran MT atau PH).",
        };
      }
    }

    const newHalaqoh = await prisma.halaqoh.create({
      data: {
        halaqohCode,
        nama: input.nama,
        pembinaId,
        tahunAjaran: input.tahunAjaran,
        status: "AKTIF",
        createdBy: session.username,
      },
      include: {
        pembina: true,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "CREATE_HALAQOH",
      entity: "Halaqoh",
      entityId: newHalaqoh.id,
      details: {
        halaqohCode,
        nama: newHalaqoh.nama,
        pembina: (newHalaqoh as { pembina?: { nama?: string } | null }).pembina?.nama,
        tahunAjaran: newHalaqoh.tahunAjaran,
      },
    });

    return {
      success: true,
      message: `Halaqoh "${newHalaqoh.nama}" berhasil dibuat.`,
      data: newHalaqoh,
    };
  } catch (error) {
    console.error("Gagal membuat halaqoh baru:", error);
    return { success: false, message: "Gagal menyimpan halaqoh ke pangkalan data." };
  }
}

/**
 * Server Action: Tugaskan / Ganti Pembina Musyrif Halaqoh (Wewenang KS & ADM)
 */
export async function assignPembinaHalaqohAction(halaqohId: string, pembinaId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["KS", "ADM"].includes(session.role)) {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Kepala Sekolah / Mudir dan Admin yang berwenang menugaskan pembina halaqoh.",
    };
  }

  try {
    const staff = await prisma.staff.findUnique({
      where: { id: pembinaId },
    });

    if (!staff || staff.status !== "AKTIF" || !["MT", "PH"].includes(staff.roleStaff)) {
      return {
        success: false,
        message: "Akses Ditolak: Staf yang dipilih tidak memenuhi syarat sebagai pembina halaqoh (Hanya staf aktif dengan peran MT atau PH).",
      };
    }

    const updated = await prisma.halaqoh.update({
      where: { id: halaqohId },
      data: {
        pembinaId,
      },
      include: {
        pembina: true,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "ASSIGN_PEMBINA_HALAQOH",
      entity: "Halaqoh",
      entityId: updated.id,
      details: {
        halaqohNama: updated.nama,
        pembinaBaru: staff.nama,
      },
    });

    return {
      success: true,
      message: `Pembina halaqoh "${updated.nama}" berhasil diperbarui menjadi ${staff.nama}.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal menugaskan pembina halaqoh:", error);
    return { success: false, message: "Gagal memperbarui pembina halaqoh." };
  }
}

/**
 * Server Action: Pindahkan Santri ke Halaqoh Lain (Wewenang KS & ADM)
 */
export async function pindahkanSantriHalaqohAction(santriId: string, newHalaqohId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["KS", "ADM"].includes(session.role)) {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Kepala Sekolah / Mudir dan Admin yang berwenang memindahkan santri halaqoh.",
    };
  }

  try {
    const halaqohTujuan = await prisma.halaqoh.findUnique({
      where: { id: newHalaqohId },
    });

    if (!halaqohTujuan) {
      return { success: false, message: "Halaqoh tujuan tidak ditemukan." };
    }

    const santri = await prisma.santri.update({
      where: { id: santriId },
      data: {
        halaqohId: newHalaqohId,
      },
      include: {
        halaqoh: true,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "PINDAH_HALAQOH_SANTRI",
      entity: "Santri",
      entityId: santri.id,
      details: {
        santriNama: santri.nama,
        santriNis: santri.nis,
        halaqohBaru: halaqohTujuan.nama,
      },
    });

    return {
      success: true,
      message: `Santri ${santri.nama} berhasil dipindahkan ke ${halaqohTujuan.nama}.`,
      data: santri,
    };
  } catch (error) {
    console.error("Gagal memindahkan santri halaqoh:", error);
    return { success: false, message: "Gagal memperbarui halaqoh santri." };
  }
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

