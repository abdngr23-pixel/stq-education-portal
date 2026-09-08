"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusPengajuan } from "@prisma/client";

export interface AjukanKebutuhanData {
  judul: string;
  kategori: string;
  nominal: number;
  keterangan: string;
}

/**
 * Server Action: Ajukan Kebutuhan Operasional Bulanan (Khusus ADM)
 */
export async function ajukanKebutuhanAction(input: AjukanKebutuhanData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Hanya ADM (Admin/TU) yang berwenang mengajukan kebutuhan operasional
  if (session.role !== "ADM" && session.role !== "KS") {
    return {
      success: false,
      message: `Role ${session.role} tidak berwenang membuat pengajuan kebutuhan operasional.`,
    };
  }

  try {
    const count = await prisma.pengajuanBulanan.count();
    const kodePengajuan = `AJU-${String(count + 1).padStart(6, "0")}`;

    const newPengajuan = await prisma.pengajuanBulanan.create({
      data: {
        kodePengajuan,
        judul: input.judul.trim(),
        kategori: input.kategori,
        nominal: Number(input.nominal),
        keterangan: input.keterangan.trim(),
        status: StatusPengajuan.DIAJUKAN,
        diajukanOleh: session.username,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "AJUKAN_KEBUTUHAN",
      entity: "PengajuanBulanan",
      entityId: newPengajuan.id,
      details: {
        kodePengajuan,
        judul: input.judul,
        nominal: input.nominal,
      },
    });

    return {
      success: true,
      message: `Pengajuan ${newPengajuan.kodePengajuan} ("${newPengajuan.judul}") sebesar Rp ${newPengajuan.nominal.toLocaleString("id-ID")} berhasil diajukan untuk verifikasi Mudir/KS.`,
      data: newPengajuan,
    };
  } catch (error) {
    console.error("Gagal membuat pengajuan:", error);
    return { success: false, message: "Gagal menyimpan pengajuan ke database." };
  }
}

/**
 * Server Action: Verifikasi & Persetujuan Pengajuan Anggaran (Khusus Mudir / KS)
 */
export async function verifikasiPengajuanAction(params: {
  pengajuanId: string;
  status: "DISETUJUI_KS" | "DITOLAK" | "DICAIRKAN";
  catatanKS?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Hanya KS (Kepala Sekolah/Mudir) yang berhak memberikan approval anggaran
  if (session.role !== "KS") {
    return {
      success: false,
      message: "Hanya Kepala Sekolah / Mudir (KS) yang memiliki kewenangan menyetujui anggaran operasional.",
    };
  }

  try {
    const updated = await prisma.pengajuanBulanan.update({
      where: { id: params.pengajuanId },
      data: {
        status: params.status,
        disetujuiOleh: session.username,
        catatanKS: params.catatanKS,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "VERIFIKASI_PENGAJUAN",
      entity: "PengajuanBulanan",
      entityId: updated.id,
      details: {
        kodePengajuan: updated.kodePengajuan,
        statusAkhir: params.status,
        catatan: params.catatanKS,
        disetujuiOleh: session.username,
      },
    });

    return {
      success: true,
      message: `Pengajuan ${updated.kodePengajuan} berhasil diperbarui menjadi: ${params.status}.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal memverifikasi pengajuan:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses verifikasi." };
  }
}

/**
 * Server Action: Catat Notulen Rapat Asatidz
 */
export async function catatNotulenAction(params: {
  judulRapat: string;
  tempat: string;
  peserta: string;
  isiNotulen: string;
  tindakLanjut: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  if (session.role !== "ADM" && session.role !== "KS") {
    return { success: false, message: "Hanya Admin (ADM) dan Mudir (KS) yang dapat mendokumentasikan notulen rapat." };
  }

  try {
    const notulen = await prisma.notulenRapat.create({
      data: {
        judulRapat: params.judulRapat,
        tempat: params.tempat,
        peserta: params.peserta,
        isiNotulen: params.isiNotulen,
        tindakLanjut: params.tindakLanjut,
        notulis: session.username,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "CATAT_NOTULEN",
      entity: "NotulenRapat",
      entityId: notulen.id,
      details: { judulRapat: notulen.judulRapat },
    });

    return {
      success: true,
      message: `Notulen "${notulen.judulRapat}" berhasil didokumentasikan.`,
      data: notulen,
    };
  } catch (error) {
    console.error("Gagal mencatat notulen:", error);
    return { success: false, message: "Gagal menyimpan notulen ke database." };
  }
}

/**
 * Server Action: Mengambil daftar pengajuan anggaran bulanan (Khusus ADM, KS, YAY)
 */
export async function getPengajuanAnggaranListAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu.", data: [] };
  }

  // Hak akses: ADM, KS, YAY
  if (!["ADM", "KS", "YAY"].includes(session.role)) {
    return {
      success: false,
      message: `Role ${session.role} tidak berwenang melihat daftar anggaran operasional.`,
      data: [],
    };
  }

  try {
    const list = await prisma.pengajuanBulanan.findMany({
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: list.map((item) => ({
        id: item.id,
        kode: item.kodePengajuan,
        judul: item.judul,
        kategori: item.kategori,
        nominal: item.nominal,
        status: item.status,
        diajukanOleh: item.diajukanOleh,
        keterangan: item.keterangan || "",
        disetujuiOleh: item.disetujuiOleh,
        catatanKS: item.catatanKS,
        tanggal: item.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
        createdAt: item.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data pengajuan anggaran:", error);
    return { success: false, message: "Gagal memuat data anggaran dari server.", data: [] };
  }
}

