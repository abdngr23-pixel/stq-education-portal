"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { UserSession } from "@/types/auth";
import { SantriStatus, JenisKelamin, Prisma } from "@prisma/client";
import { calculateLatestSabaqPosition } from "@/lib/tahfizh-page-allocation";
import { isTodayWita } from "@/lib/wita-date";

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
 * Dilengkapi otorisasi sesi dan pembatasan cakupan data (ABAC):
 * - Wali / Santri hanya melihat data diri/anak yang sah
 * - MT / PH hanya melihat santri dalam halaqoh binaannya
 * - Admin / Mudir / Manajemen memiliki akses penuh
 */
export async function getSantriListAction(
  params?: {
    search?: string;
    kelas?: string;
    halaqohId?: string;
  },
  sessionOverride?: UserSession
) {
  try {
    const session = sessionOverride || (await getCurrentSession());
    if (!session) {
      return { success: false, message: "Sesi tidak valid atau belum login.", data: [] };
    }

    const where: Prisma.SantriWhereInput = {};

    // Scoping berdasarkan Role
    if (session.role === "WS" || session.role === "ST") {
      if (!session.santriId) {
        return {
          success: false,
          message: "Akun Anda belum terhubung dengan data santri resmi. Silakan hubungi admin.",
          data: [],
        };
      }
      where.id = session.santriId;
    } else if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return {
          success: false,
          message: "Profil staf pembina Anda belum terhubung. Silakan hubungi admin.",
          data: [],
        };
      }
      if (session.isKepalaBidangTahfidz) {
        if (params?.halaqohId && params.halaqohId !== "ALL") {
          where.halaqohId = params.halaqohId;
        }
      } else {
        const halaqohDibina = await prisma.halaqoh.findMany({
          where: { pembinaId: session.staffId },
          select: { id: true },
        });
        const halaqohIds = halaqohDibina.map((h) => h.id);
        if (params?.halaqohId && halaqohIds.includes(params.halaqohId)) {
          where.halaqohId = params.halaqohId;
        } else if (halaqohIds.length > 0) {
          where.halaqohId = { in: halaqohIds };
        } else {
          return { success: true, data: [] };
        }
      }
    } else {
      if (params?.halaqohId && params.halaqohId !== "ALL") {
        where.halaqohId = params.halaqohId;
      }
    }

    if (params?.search) {
      where.OR = [
        { nama: { contains: params.search, mode: "insensitive" } },
        { nis: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params?.kelas) {
      where.kelas = params.kelas;
    }

    const list = await prisma.santri.findMany({
      where,
      orderBy: { nis: "asc" },
      include: {
        halaqoh: {
          include: { pembina: true },
        },
        setoranList: {
          where: { status: { not: "DIBATALKAN" } },
          orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            jenis: true,
            status: true,
            juz: true,
            halamanMulai: true,
            halamanSelesai: true,
            jumlahHalaman: true,
            nilai: true,
            tanggal: true,
            createdAt: true,
          },
        },
        _count: {
          select: { setoranList: true, pelanggaranList: true, bintangList: true },
        },
      },
    });

    // Aturan Pengurutan: Santriwati (P) WAJIB diurutkan secara alfabetis A-Z (locale Indonesia).
    // Santri ikhwan (L) mempertahankan urutan aslinya.
    const ikhwanList = list.filter((s) => s.jenisKelamin === "L");
    const akhwatList = list
      .filter((s) => s.jenisKelamin === "P")
      .sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));

    const sortedList = [...ikhwanList, ...akhwatList];

    const mappedData = sortedList.map((s) => {
      const modalAwal = Number(s.modalHafalanAwalHalaman) || 0;
      const baselineDate = s.tanggalBaselineTahfizh ? new Date(s.tanggalBaselineTahfizh) : null;

      // Rumus Resmi:
      // Total Hafalan = Modal Hafalan Awal + Total jumlahHalaman SABAQ setelah tanggal baseline
      // SABQI, MANZIL, dan MUFAR tidak menambah total hafalan. Setoran DIBATALKAN dikecualikan.
      const sabaqAfterBaseline = (s.setoranList || []).filter((st) => {
        if (st.status === "DIBATALKAN") return false;
        if (st.jenis !== "SABAQ") return false;
        if (!baselineDate) return true;
        return new Date(st.tanggal) >= baselineDate;
      });

      const tambahanSabaq = sabaqAfterBaseline.reduce((acc, cur) => acc + (cur.jumlahHalaman || 0), 0);
      const totalHafalan = modalAwal + tambahanSabaq;
      const capaianJuz = Math.floor(totalHafalan / 20);

      // Setoran valid non-batal untuk pelacakan status harian WITA & ringkasan aktivitas terbaru
      const validSetoranList = (s.setoranList || []).filter((st) => st.status !== "DIBATALKAN");
      const latestSetoran = validSetoranList[0] || null;
      const nilaiTerakhir = latestSetoran ? latestSetoran.nilai : "Belum ada data";

      // Status setoran hari ini berdasarkan zona waktu resmi WITA (Asia/Makassar)
      const sudahSetorHariIni = validSetoranList.some((st) => isTodayWita(st.tanggal));
      const setoranTerakhirAt = latestSetoran ? latestSetoran.tanggal.toISOString() : null;

      // Sesuai Instruksi P0.1:
      // Posisi terakhir Tahfizh HANYA boleh berasal dari SABAQ aktif pasca-baseline.
      // Dihitung melalui modul murni produksi lib/tahfizh-page-allocation.
      const sabaqPosition = calculateLatestSabaqPosition(
        sabaqAfterBaseline.map((st) => ({
          jenis: st.jenis,
          status: "AKTIF",
          halamanMulai: st.halamanMulai,
          halamanSelesai: st.halamanSelesai,
          jumlahHalaman: st.jumlahHalaman,
          tanggal: st.tanggal,
          createdAt: st.createdAt,
        })),
        modalAwal,
        baselineDate
      );
      const posisiTerakhirHalaman = sabaqPosition.posisiTerakhirHalaman;
      const isHalamanTerakhirParsial = sabaqPosition.isHalamanTerakhirParsial;

      // Hitung akumulasi bintang riil dari DB
      const totalBintang = s._count.bintangList || 0;

      return {
        id: s.id, // Primary Key riil PostgreSQL
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        jenisKelamin: s.jenisKelamin,
        status: s.status,
        halaqohId: s.halaqohId,
        halaqohNama: s.halaqoh?.nama || null,
        halaqoh: s.halaqoh?.nama || "Halaqoh",
        pembina: s.halaqoh?.pembina?.nama || "-",
        namaWali: s.namaWali || undefined,
        noHpWali: s.noHpWali || undefined,
        modalHalamanAwal: modalAwal,
        modalHafalanAwalHalaman: modalAwal,
        tanggalBaselineTahfizh: s.tanggalBaselineTahfizh ? s.tanggalBaselineTahfizh.toISOString() : null,
        tambahanSabaq,
        totalHafalan,
        capaianHalaman: totalHafalan,
        totalHalaman: totalHafalan,
        capaianJuz,
        posisiTerakhirHalaman,
        isHalamanTerakhirParsial,
        targetAkhirProgramJuz: s.targetAkhirProgramJuz || 30,
        targetJuz: s.targetAkhirProgramJuz || 30,
        setoranTerakhir: latestSetoran
          ? `${latestSetoran.jenis} Juz ${latestSetoran.juz} Hlm ${latestSetoran.halamanMulai}-${latestSetoran.halamanSelesai}`
          : "-",
        setoranTerakhirAt,
        sudahSetorHariIni,
        nilaiTerakhir,
        poinPelanggaran: s._count.pelanggaranList || 0,
        bintangKebaikan: totalBintang,
      };
    });

    return { success: true, data: mappedData };
  } catch (error) {
    console.error("Gagal mengambil data santri:", error);
    return { success: false, message: "Gagal mengambil data santri.", data: [] };
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
