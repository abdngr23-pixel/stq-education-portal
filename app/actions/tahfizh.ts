"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { JenisSetoran, NilaiSetoran, Prisma } from "@prisma/client";

import { hitungRekomendasiSabaqiPekan, getStartOfWeekWITA } from "@/lib/sabaqi";
import { executeCanonicalCreateSetoran } from "@/lib/tahfizh-persistence";
import {
  getTahfizhOperationalMonitoring,
  GetTahfizhMonitoringParams,
} from "@/lib/server/tahfizh-monitoring-service";
import { MistakeCounts } from "@/lib/tahfizh-quality";

export interface CreateSetoranInput {
  santriId: string;
  jenis: JenisSetoran;
  juz: number;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  jumlahJuzMufar?: number | null;
  nilaiTajwid: NilaiSetoran;
  nilaiFashahah: NilaiSetoran;
  nilaiKelancaran: NilaiSetoran;
  rincianKesalahan: MistakeCounts;
  nilai?: NilaiSetoran;
  catatan?: string;
  clientRequestId?: string;
  alasanLompatanHalaman?: string;
  isManualSabaqi?: boolean;
  alasanManualSabaqi?: string;
}

/**
 * Server Action: Input Setoran Baru (mendelegasikan ke eksekutor kanonikal tunggal)
 */
export async function createSetoranAction(input: CreateSetoranInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    return await executeCanonicalCreateSetoran(prisma, {
      input,
      session: {
        userId: session.userId,
        username: session.username,
        role: session.role,
        staffId: session.staffId,
        isKepalaBidangTahfidz: session.isKepalaBidangTahfidz,
      },
    });
  } catch (error) {
    const errorRef = `ERR-SET-${Date.now().toString(36).toUpperCase()}`;
    console.error(`[${errorRef}] Gagal menyimpan setoran:`, (error as Error)?.message || error);
    return {
      success: false,
      message: `Gagal menyimpan setoran ke pangkalan data. Kode Referensi: ${errorRef}`,
      errorRef,
    };
  }
}

/**
 * Server Action: Mengambil rekomendasi Sabaqi santri berdasarkan setoran SABAQ nyata pekan berjalan (WITA)
 */
export async function getSetoranSabaqPekanSantriAction(santriId: string, tanggalStr?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!santriId) {
    return { success: false, message: "ID santri wajib diberikan." };
  }

  // Explicit Allowlist ABAC
  if (["KS", "ADM", "YAY"].includes(session.role) || session.isKepalaBidangTahfidz) {
    // Diizinkan membaca global
  } else if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Akun MT/PH belum terhubung dengan staf." };
    }
    const isBinaan = await prisma.halaqoh.findFirst({
      where: {
        pembinaId: session.staffId,
        santriList: { some: { id: santriId } },
      },
    });
    if (!isBinaan) {
      return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
    }
  } else if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berwenang melihat data santri Anda sendiri." };
    }
  } else {
    return { success: false, message: "Akses Ditolak: Anda tidak memiliki wewenang untuk melihat rekomendasi Sabaqi santri ini." };
  }

  try {
    const refDate = tanggalStr ? new Date(tanggalStr) : new Date();
    const startOfWeek = getStartOfWeekWITA(refDate);

    // Ambil data santri untuk verifikasi tanggal baseline tahfizh
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      select: { tanggalBaselineTahfizh: true },
    });

    if (!santri) {
      return { success: false, message: "Santri tidak ditemukan." };
    }

    // Canonical rule: Jika baseline belum ditetapkan, jangan gunakan SABAQ historis/pekan berjalan sebagai referensi official Sabaqi
    if (!santri.tanggalBaselineTahfizh) {
      return {
        success: true,
        data: {
          rekomendasi: hitungRekomendasiSabaqiPekan([], refDate),
          sabaqRecords: [],
          startOfWeekWITA: startOfWeek.toISOString(),
        },
      };
    }

    const baselineDate = new Date(santri.tanggalBaselineTahfizh);
    // Boundary baseline: max(getStartOfWeekWITA(refDate), tanggalBaselineTahfizh)
    const effectiveStart = baselineDate > startOfWeek ? baselineDate : startOfWeek;

    // Ambil seluruh setoran SABAQ tersimpan sejak effectiveStart sampai waktu referensi
    // Kriteria Ketat: HANYA jenis SABAQ, status BUKAN DIBATALKAN
    const sabaqRecords = await prisma.setoranTahfizh.findMany({
      where: {
        santriId,
        jenis: "SABAQ",
        status: { not: "DIBATALKAN" },
        tanggal: {
          gte: effectiveStart,
          lte: refDate,
        },
      },
      orderBy: { tanggal: "asc" },
      select: {
        id: true,
        tanggal: true,
        halamanMulai: true,
        halamanSelesai: true,
        jumlahHalaman: true,
        juz: true,
      },
    });

    const rekomendasi = hitungRekomendasiSabaqiPekan(
      sabaqRecords.map((s) => ({
        id: s.id,
        tanggal: s.tanggal,
        halamanMulai: s.halamanMulai,
        halamanSelesai: s.halamanSelesai,
        jumlahHalaman: s.jumlahHalaman,
      })),
      refDate
    );

    return {
      success: true,
      data: {
        rekomendasi,
        sabaqRecords,
        startOfWeekWITA: startOfWeek.toISOString(),
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data Sabaq pekan:", error);
    return { success: false, message: "Gagal menghitung Sabaqi santri dari database." };
  }
}

/**
 * Server Action: Mengambil riwayat setoran terbaru (dengan otorisasi sesi & scoping ABAC)
 */
export async function getRecentSetoranAction(limit: number = 10) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu.", data: [] };
  }

  try {
    const where: Prisma.SetoranTahfizhWhereInput = {
      status: { not: "DIBATALKAN" },
    };

    // Explicit Allowlist ABAC
    if (["KS", "ADM", "YAY"].includes(session.role) || session.isKepalaBidangTahfidz) {
      // Diizinkan membaca global
    } else if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return { success: false, message: "Akses Ditolak: Profil staf belum terhubung.", data: [] };
      }
      where.santri = {
        halaqoh: { pembinaId: session.staffId },
      };
    } else if (session.role === "WS" || session.role === "ST") {
      if (!session.santriId) {
        return { success: false, message: "Akun Anda belum terhubung dengan data santri.", data: [] };
      }
      where.santriId = session.santriId;
    } else {
      return { success: false, message: "Akses Ditolak: Anda tidak memiliki wewenang untuk melihat data setoran.", data: [] };
    }

    const list = await prisma.setoranTahfizh.findMany({
      where,
      take: limit,
      orderBy: { tanggal: "desc" },
      include: {
        santri: {
          include: { halaqoh: true },
        },
        musyrif: true,
      },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil riwayat setoran:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mengambil data ringkasan progres santri (dengan otorisasi sesi & scoping ABAC)
 */
export async function getSantriProgresAction(santriId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Explicit Allowlist ABAC
  if (["KS", "ADM", "YAY"].includes(session.role) || session.isKepalaBidangTahfidz) {
    // Diizinkan membaca global
  } else if (session.role === "MT" || session.role === "PH") {
    // Fail-closed: MT/PH tanpa staffId wajib langsung ditolak
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Akun MT/PH belum terhubung dengan data staf." };
    }
    const isBinaan = await prisma.halaqoh.findFirst({
      where: {
        pembinaId: session.staffId,
        santriList: { some: { id: santriId } },
      },
    });
    if (!isBinaan) {
      return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
    }
  } else if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat progres santri Anda sendiri." };
    }
  } else {
    return { success: false, message: "Akses Ditolak: Anda tidak memiliki wewenang untuk melihat data santri ini." };
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      include: {
        halaqoh: { include: { pembina: true } },
        setoranList: {
          where: { status: { not: "DIBATALKAN" } },
          orderBy: { tanggal: "desc" },
          take: 5,
        },
      },
    });

    if (!santri) return { success: false, message: "Santri tidak ditemukan" };

    const totalSetoran = await prisma.setoranTahfizh.count({
      where: { santriId, status: { not: "DIBATALKAN" } },
    });

    const modalAwal = Number(santri.modalHafalanAwalHalaman) || 0;
    const baselineDate = santri.tanggalBaselineTahfizh ? new Date(santri.tanggalBaselineTahfizh) : null;

    // Canonical rule: modalHafalanAwalHalaman + valid SABAQ >= tanggalBaselineTahfizh
    // Jika baseline null: tambahanSabaq = 0. Jangan aggregate historical SABAQ.
    let tambahanSabaq = 0;
    if (baselineDate) {
      const sabaqAggregate = await prisma.setoranTahfizh.aggregate({
        where: {
          santriId,
          jenis: "SABAQ",
          status: { not: "DIBATALKAN" },
          tanggal: { gte: baselineDate },
        },
        _sum: { jumlahHalaman: true },
      });
      tambahanSabaq = sabaqAggregate._sum.jumlahHalaman || 0;
    }

    const totalHalaman = modalAwal + tambahanSabaq;
    const totalJuz = Math.floor(totalHalaman / 20);
    const sisaHalaman = totalHalaman % 20;

    return {
      success: true,
      data: {
        ...santri,
        totalSetoran,
        modalHalamanAwal: modalAwal,
        tambahanSabaq,
        totalHalamanSabaq: totalHalaman,
        totalJuzSabaq: totalJuz,
        sisaHalamanSabaq: sisaHalaman,
        capaianLabel: `${totalJuz} Juz ${sisaHalaman} Halaman`,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data progres santri:", error);
    return { success: false, message: "Gagal mengambil data progres" };
  }
}

/**
 * Server Action: Hitung Total Halaman Kumulatif Santri dari Modal Baseline + Setoran SABAQ
 * Sabqi / Manzil / Mufar tidak menambah total kumulatif (itu muroja'ah).
 * Setoran DIBATALKAN dikecualikan.
 */
export async function getSantriKumulatifHalamanAction(santriId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // Explicit Allowlist ABAC
  if (["KS", "ADM", "YAY"].includes(session.role) || session.isKepalaBidangTahfidz) {
    // Diizinkan membaca global
  } else if (session.role === "MT" || session.role === "PH") {
    // Fail-closed: MT/PH tanpa staffId wajib langsung ditolak
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Akun MT/PH belum terhubung dengan data staf." };
    }
    const isBinaan = await prisma.halaqoh.findFirst({
      where: {
        pembinaId: session.staffId,
        santriList: { some: { id: santriId } },
      },
    });
    if (!isBinaan) {
      return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
    }
  } else if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat progres santri Anda sendiri." };
    }
  } else {
    return { success: false, message: "Akses Ditolak: Anda tidak memiliki wewenang untuk melihat kumulatif santri ini." };
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      select: { modalHafalanAwalHalaman: true, tanggalBaselineTahfizh: true },
    });

    const modalAwal = Number(santri?.modalHafalanAwalHalaman) || 0;
    const baselineDate = santri?.tanggalBaselineTahfizh ? new Date(santri.tanggalBaselineTahfizh) : null;

    let tambahanSabaq = 0;
    if (baselineDate) {
      const sabaqAggregate = await prisma.setoranTahfizh.aggregate({
        where: {
          santriId,
          jenis: "SABAQ",
          status: { not: "DIBATALKAN" },
          tanggal: { gte: baselineDate },
        },
        _sum: {
          jumlahHalaman: true,
        },
      });
      tambahanSabaq = sabaqAggregate._sum.jumlahHalaman || 0;
    }
    const totalHalaman = modalAwal + tambahanSabaq;
    const totalJuz = Math.floor(totalHalaman / 20);
    const sisaHalaman = totalHalaman % 20;
    const label = totalJuz > 0 && sisaHalaman > 0
      ? `${totalJuz} Juz ${sisaHalaman} Halaman`
      : totalJuz > 0
      ? `${totalJuz} Juz`
      : `${sisaHalaman} Halaman`;

    return {
      success: true,
      data: {
        modalAwal,
        tambahanSabaq,
        totalHalaman,
        totalJuz,
        sisaHalaman,
        label,
      },
    };
  } catch (error) {
    console.error("Gagal menghitung kumulatif santri:", error);
    return { success: false, message: "Gagal menghitung kumulatif santri." };
  }
}

/**
 * Server Action: Mengambil data monitoring operasional Tahfizh terpadu untuk Musyrif & Mudir.
 */
export async function getTahfizhOperationalMonitoringAction(params?: GetTahfizhMonitoringParams) {
  const session = await getCurrentSession();
  return await getTahfizhOperationalMonitoring(params, session, prisma);
}


