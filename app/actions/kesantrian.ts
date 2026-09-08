"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { JenisIzin, StatusIzin, StatusAbsensi, Prisma } from "@prisma/client";

export interface AjukanIzinData {
  santriId: string;
  jenis: JenisIzin;
  tanggalMulai: string; // ISO string
  tanggalSelesai: string; // ISO string
  alasan: string;
}

/**
 * Server Action: Ajukan Perizinan Santri (PH, OSDA, WS, ST)
 */
export async function ajukanIzinAction(input: AjukanIzinData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  try {
    const count = await prisma.perizinanSantri.count();
    const kodeIzin = `IZN-${String(count + 1).padStart(6, "0")}`;

    const newIzin = await prisma.perizinanSantri.create({
      data: {
        kodeIzin,
        santriId: input.santriId,
        jenis: input.jenis,
        tanggalMulai: new Date(input.tanggalMulai),
        tanggalSelesai: new Date(input.tanggalSelesai),
        alasan: input.alasan,
        status: StatusIzin.MENUNGGU_MK,
      },
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "AJUKAN_IZIN",
      entity: "PerizinanSantri",
      entityId: newIzin.id,
      details: {
        kodeIzin,
        santriNis: newIzin.santri.nis,
        jenis: input.jenis,
        diajukanOleh: session.username,
      },
    });

    return {
      success: true,
      message: `Permohonan izin ${newIzin.santri.nama} (${kodeIzin}) berhasil diajukan, menunggu verifikasi Musyrif Keasramaan.`,
      data: newIzin,
    };
  } catch (error) {
    console.error("Gagal mengajukan izin santri:", error);
    return { success: false, message: "Gagal memproses permohonan izin." };
  }
}

/**
 * Server Action: Verifikasi / Approval Perizinan Santri Berjenjang (MK & KS)
 */
export async function verifikasiIzinAction(params: {
  izinId: string;
  action: "APPROVE" | "REJECT" | "ESCALATE_KS";
  catatan?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Hanya MK dan KS yang berhak memberikan approval
  if (session.role !== "MK" && session.role !== "KS") {
    return {
      success: false,
      message: `Role ${session.role} tidak memiliki otoritas untuk memverifikasi perizinan santri.`,
    };
  }

  try {
    const izin = await prisma.perizinanSantri.findUnique({
      where: { id: params.izinId },
      include: { santri: true },
    });

    if (!izin) {
      return { success: false, message: "Data izin tidak ditemukan." };
    }

    let newStatus: StatusIzin = izin.status;
    const updateData: Prisma.PerizinanSantriUpdateInput = {
      catatan: params.catatan || izin.catatan,
    };

    if (params.action === "REJECT") {
      newStatus = StatusIzin.DITOLAK;
    } else if (params.action === "ESCALATE_KS") {
      newStatus = StatusIzin.MENUNGGU_KS;
      if (session.staffId) updateData.disetujuiMK = { connect: { id: session.staffId } };
    } else if (params.action === "APPROVE") {
      // Jika izin PULANG, butuh persetujuan KS
      if (izin.jenis === JenisIzin.PULANG && session.role !== "KS" && izin.status !== StatusIzin.MENUNGGU_KS) {
        newStatus = StatusIzin.MENUNGGU_KS;
        if (session.staffId) updateData.disetujuiMK = { connect: { id: session.staffId } };
      } else {
        newStatus = StatusIzin.DISETUJUI;
        if (session.role === "KS" && session.staffId) {
          updateData.disetujuiKS = { connect: { id: session.staffId } };
        } else if (session.role === "MK" && session.staffId) {
          updateData.disetujuiMK = { connect: { id: session.staffId } };
        }
      }
    }

    updateData.status = newStatus;

    const updated = await prisma.perizinanSantri.update({
      where: { id: params.izinId },
      data: updateData,
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "VERIFIKASI_IZIN",
      entity: "PerizinanSantri",
      entityId: updated.id,
      details: {
        kodeIzin: updated.kodeIzin,
        actionTaken: params.action,
        statusAkhir: newStatus,
        diverifikasiOleh: session.username,
      },
    });

    return {
      success: true,
      message: `Status izin ${updated.kodeIzin} berhasil diperbarui menjadi: ${newStatus}.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal memverifikasi izin:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses verifikasi izin." };
  }
}

/**
 * Server Action: Mengambil daftar perizinan santri
 */
export async function getPerizinanListAction(statusFilter?: StatusIzin) {
  try {
    const where: Prisma.PerizinanSantriWhereInput = {};
    if (statusFilter) where.status = statusFilter;

    const list = await prisma.perizinanSantri.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        santri: true,
        disetujuiMK: true,
        disetujuiKS: true,
      },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil data perizinan:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Catat Absensi Kegiatan Asrama
 */
export async function catatAbsensiAction(params: {
  santriId: string;
  kegiatan: string;
  status: StatusAbsensi;
  catatan?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // MK, OSDA, dan PH yang dapat mencatat absensi asrama
  if (!["MK", "OSDA", "PH", "KS"].includes(session.role)) {
    return { success: false, message: `Role ${session.role} tidak berhak mencatat absensi asrama.` };
  }

  try {
    const record = await prisma.absensi.create({
      data: {
        santriId: params.santriId,
        kegiatan: params.kegiatan,
        status: params.status,
        catatan: params.catatan,
        dicatatOleh: session.username,
      },
      include: { santri: true },
    });

    return {
      success: true,
      message: `Absensi ${record.kegiatan} untuk ${record.santri.nama} (${params.status}) berhasil dicatat.`,
      data: record,
    };
  } catch (error) {
    console.error("Gagal mencatat absensi:", error);
    return { success: false, message: "Gagal mencatat absensi ke pangkalan data." };
  }
}
