"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { SantriStatus, JenisKelamin } from "@prisma/client";

import { getSantriListForSession, SantriListParams } from "@/lib/server/santri-list-service";

export interface CreateSantriInput {
  nis: string;
  nama: string;
  kelas: string;
  jenisKelamin: JenisKelamin;
  isYatimDhuafa?: boolean;
  namaWali?: string;
  noHpWali?: string;
  halaqohId?: string;
}

/**
 * Mengambil daftar santri dengan filter pencarian dan relasi halaqoh
 * Server Action pembungkus tipis: autentikasi sesi server & delegasi ke internal service.
 * Signature produksi murni tanpa parameter sessionOverride untuk mencegah manipulasi sesi dari klien browser.
 */
export async function getSantriListAction(params?: SantriListParams) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return { success: false, message: "Sesi tidak valid atau belum login.", error: "Sesi tidak valid atau belum login.", data: [] };
    }
    return await getSantriListForSession(params, session, prisma);
  } catch (error) {
    console.error("[Action Error] getSantriListAction:", error);
    return { success: false, message: "Gagal mengambil data santri.", error: "Gagal mengambil data santri.", data: [] };
  }
}

/**
 * Atur Baseline Modal Hafalan Awal Santri (Khusus KS & ADM)
 * Dilengkapi audit trail lengkap: alasan, petugas pengubah, nilai lama, nilai baru.
 */
export async function updateBaselineModalSantriAction(input: {
  santriId: string;
  modalHafalanAwalHalaman: number;
  tanggalBaselineTahfizh?: string | null;
  alasan: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi tidak valid atau belum login." };
  }

  // Khusus KS dan ADM (fail-closed)
  if (session.role !== "KS" && session.role !== "ADM") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Mudir (KS) dan Administrator (ADM) yang berwenang mengatur baseline modal hafalan.",
    };
  }

  if (typeof input.modalHafalanAwalHalaman !== "number" || isNaN(input.modalHafalanAwalHalaman) || input.modalHafalanAwalHalaman < 0) {
    return { success: false, message: "Nilai modal hafalan awal harus berupa angka positif atau nol." };
  }

  if (!input.alasan || input.alasan.trim().length < 5) {
    return { success: false, message: "Alasan penetapan/perubahan baseline wajib diisi (minimal 5 karakter)." };
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: input.santriId },
      select: { id: true, nama: true, nis: true, modalHafalanAwalHalaman: true, tanggalBaselineTahfizh: true },
    });

    if (!santri) {
      return { success: false, message: "Data santri tidak ditemukan." };
    }

    const baselineDate = input.tanggalBaselineTahfizh ? new Date(input.tanggalBaselineTahfizh) : new Date();

    const updated = await prisma.santri.update({
      where: { id: input.santriId },
      data: {
        modalHafalanAwalHalaman: input.modalHafalanAwalHalaman,
        tanggalBaselineTahfizh: baselineDate,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "UPDATE_BASELINE_MODAL",
      entity: "Santri",
      entityId: santri.id,
      details: {
        santriNis: santri.nis,
        santriNama: santri.nama,
        modalSebelumnya: santri.modalHafalanAwalHalaman,
        modalBaru: input.modalHafalanAwalHalaman,
        tanggalBaseline: baselineDate.toISOString(),
        alasan: input.alasan.trim(),
        petugas: session.username,
        rolePetugas: session.role,
      },
    });

    return {
      success: true,
      message: `Baseline modal hafalan ${santri.nama} berhasil diperbarui menjadi ${input.modalHafalanAwalHalaman} halaman.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal memperbarui baseline modal hafalan:", error);
    return { success: false, message: "Gagal menyimpan perubahan ke database." };
  }
}

/**
 * Batalkan Setoran Tahfizh (Soft Cancel dengan status DIBATALKAN dan alasan)
 * Tidak menghapus riwayat secara permanen.
 */
export async function batalkanSetoranTahfizhAction(input: {
  setoranId: string;
  alasan: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["KS", "ADM", "MT", "PH"].includes(session.role)) {
    return { success: false, message: "Akses Ditolak: Anda tidak berwenang membatalkan setoran." };
  }

  if (!input.alasan || input.alasan.trim().length < 5) {
    return { success: false, message: "Alasan pembatalan setoran wajib diisi (minimal 5 karakter)." };
  }

  try {
    const setoran = await prisma.setoranTahfizh.findUnique({
      where: { id: input.setoranId },
      include: { santri: true },
    });

    if (!setoran) {
      return { success: false, message: "Data setoran tidak ditemukan." };
    }

    if (setoran.status === "DIBATALKAN") {
      return { success: false, message: "Setoran ini sudah dalam status DIBATALKAN sebelumnya." };
    }

    // MT/PH ABAC: harus pembina dari halaqoh santri
    if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return { success: false, message: "Akses Ditolak: Profil staf belum terhubung." };
      }
      if (!session.isKepalaBidangTahfidz) {
        const isBinaan = await prisma.halaqoh.findFirst({
          where: {
            pembinaId: session.staffId,
            santriList: { some: { id: setoran.santriId } },
          },
        });
        if (!isBinaan) {
          return { success: false, message: "Akses Ditolak: Anda hanya berwenang membatalkan setoran halaqoh binaan Anda." };
        }
      }
    }

    const updated = await prisma.setoranTahfizh.update({
      where: { id: input.setoranId },
      data: {
        status: "DIBATALKAN",
        alasanPembatalan: input.alasan.trim(),
        dibatalkanAt: new Date(),
        dibatalkanBy: session.username,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "CANCEL_SETORAN",
      entity: "SetoranTahfizh",
      entityId: setoran.id,
      details: {
        setoranCode: setoran.setoranCode,
        santriNis: setoran.santri.nis,
        santriNama: setoran.santri.nama,
        halaman: `${setoran.halamanMulai}-${setoran.halamanSelesai}`,
        jumlahHalaman: setoran.jumlahHalaman,
        alasan: input.alasan.trim(),
        petugas: session.username,
        rolePetugas: session.role,
      },
    });

    return {
      success: true,
      message: `Setoran ${setoran.setoranCode} berhasil dibatalkan.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal membatalkan setoran:", error);
    return { success: false, message: "Gagal membatalkan setoran di database." };
  }
}

/**
 * Tambah Santri Baru (Khusus ADM & KS)
 */
export async function createSantriAction(input: CreateSantriInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  if (session.role !== "ADM" && session.role !== "KS") {
    return { success: false, message: "Hanya Admin (ADM) dan Mudir (KS) yang dapat mendaftarkan santri." };
  }

  try {
    // Cek duplikasi NIS
    const existing = await prisma.santri.findUnique({
      where: { nis: input.nis.trim() },
    });

    if (existing) {
      return { success: false, message: `NIS ${input.nis} sudah terdaftar di sistem.` };
    }

    const newSantri = await prisma.santri.create({
      data: {
        nis: input.nis.trim(),
        nama: input.nama.trim(),
        kelas: input.kelas.trim(),
        jenisKelamin: input.jenisKelamin,
        isYatimDhuafa: Boolean(input.isYatimDhuafa),
        namaWali: input.namaWali?.trim(),
        noHpWali: input.noHpWali?.trim(),
        halaqohId: input.halaqohId || null,
        status: SantriStatus.AKTIF,
        createdBy: session.username,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "CREATE_SANTRI",
      entity: "Santri",
      entityId: newSantri.id,
      details: { nis: newSantri.nis, nama: newSantri.nama, kelas: newSantri.kelas },
    });

    return {
      success: true,
      message: `Santri ${newSantri.nama} (${newSantri.nis}) berhasil ditambahkan.`,
      data: newSantri,
    };
  } catch (error) {
    console.error("Gagal membuat santri:", error);
    return { success: false, message: "Gagal menyimpan santri ke database." };
  }
}
