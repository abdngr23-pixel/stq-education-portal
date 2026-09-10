"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { JenisSetoran, NilaiSetoran, Prisma } from "@prisma/client";

import { getJuzByPage, JUZ_LIST } from "@/lib/quran-metadata";
import { hitungRekomendasiSabaqiPekan, getStartOfWeekWITA } from "@/lib/sabaqi";
import {
  allocateSabaqPages,
} from "@/lib/tahfizh-page-allocation";
import { saveSetoranTahfizhCore } from "@/lib/tahfizh-persistence";

export interface CreateSetoranInput {
  santriId: string;
  jenis: JenisSetoran;
  juz: number;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  nilai: NilaiSetoran;
  catatan?: string;
  clientRequestId?: string;
  alasanLompatanHalaman?: string;
  isManualSabaqi?: boolean;
  alasanManualSabaqi?: string;
}

/**
 * Server Action: Input Setoran Baru (dengan validasi ketat, quran-metadata, dan pencegahan tabrakan konkuren)
 */
export async function createSetoranAction(input: CreateSetoranInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // 1. Role validation: Hanya MT, PH, KS, dan ADM yang boleh input
  if (!["MT", "PH", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: `Role ${session.role} tidak memiliki izin input setoran.` };
  }

  // 2. Validasi Jenis Setoran
  const VALID_JENIS: JenisSetoran[] = ["SABAQ", "SABQI", "MANZIL", "MUFAR"];
  if (!input.jenis || !VALID_JENIS.includes(input.jenis)) {
    return {
      success: false,
      message: "Jenis setoran tidak valid. Harus salah satu dari: SABAQ, SABQI, MANZIL, atau MUFAR.",
    };
  }

  // 3. Validasi Server Nilai Halaman, Volume, & Juz
  const halMulai = Number(input.halamanMulai);
  const halSelesai = Number(input.halamanSelesai);
  const jmlHalaman = Number(input.jumlahHalaman);
  const declaredJuz = Number(input.juz);

  if (!Number.isInteger(declaredJuz) || declaredJuz < 1 || declaredJuz > 30) {
    return { success: false, message: "Juz wajib berupa bilangan bulat antara 1 sampai 30." };
  }

  if (!Number.isInteger(halMulai) || halMulai < 1 || halMulai > 604) {
    return { success: false, message: "Halaman mulai harus berupa bilangan bulat antara 1 sampai 604." };
  }
  if (!Number.isInteger(halSelesai) || halSelesai < 1 || halSelesai > 604) {
    return { success: false, message: "Halaman selesai harus berupa bilangan bulat antara 1 sampai 604." };
  }
  if (halSelesai < halMulai) {
    return { success: false, message: "Halaman selesai tidak boleh lebih kecil dari halaman mulai." };
  }
  if (isNaN(jmlHalaman) || !isFinite(jmlHalaman) || jmlHalaman < 0.5) {
    return { success: false, message: "Jumlah halaman tidak valid. Minimal setoran adalah 0.5 halaman." };
  }

  // Hubungan volume dan rentang halaman secara konsisten
  if (input.jenis === "SABAQ") {
    try {
      allocateSabaqPages(halMulai, halSelesai, jmlHalaman);
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message,
      };
    }
  } else {
    const rentangHalaman = halSelesai - halMulai + 1;
    if (jmlHalaman === 0.5) {
      if (halMulai !== halSelesai) {
        return {
          success: false,
          message: "Untuk setoran 0.5 halaman, halaman mulai dan selesai harus sama.",
        };
      }
    } else if (Number.isInteger(jmlHalaman)) {
      if (jmlHalaman !== rentangHalaman) {
        return {
          success: false,
          message: `Jumlah halaman (${jmlHalaman}) tidak sesuai dengan rentang halaman (${halMulai}–${halSelesai} = ${rentangHalaman} halaman).`,
        };
      }
    } else {
      if (rentangHalaman < Math.floor(jmlHalaman) || rentangHalaman > Math.ceil(jmlHalaman)) {
        return {
          success: false,
          message: `Volume halaman (${jmlHalaman}) tidak konsisten dengan rentang halaman ${halMulai}–${halSelesai}.`,
        };
      }
    }
  }

  // Validasi batas Juz (Mushaf Madinah) untuk halaman mulai dan halaman selesai
  const juzInfo = JUZ_LIST.find((j) => j.juz === declaredJuz);
  if (!juzInfo) {
    return { success: false, message: `Data referensi batas Juz ${declaredJuz} tidak ditemukan.` };
  }
  if (halMulai < juzInfo.startPage || halSelesai > juzInfo.endPage) {
    const juzMulai = getJuzByPage(halMulai);
    const juzSelesai = getJuzByPage(halSelesai);
    if (juzMulai !== juzSelesai) {
      return {
        success: false,
        message: `Rentang halaman ${halMulai}–${halSelesai} melintasi batas Juz (Halaman ${halMulai} adalah Juz ${juzMulai}, sedangkan Halaman ${halSelesai} adalah Juz ${juzSelesai}). Satu transaksi setoran harus dalam satu juz.`,
      };
    }
    return {
      success: false,
      message: `Rentang halaman ${halMulai}–${halSelesai} di luar rentang resmi Juz ${declaredJuz} (Halaman ${juzInfo.startPage}–${juzInfo.endPage}).`,
    };
  }

  try {
    // 4. Verifikasi Keberadaan Santri di Database
    const santri = await prisma.santri.findUnique({
      where: { id: input.santriId },
      select: {
        id: true,
        nama: true,
        nis: true,
        halaqohId: true,
        modalHafalanAwalHalaman: true,
        tanggalBaselineTahfizh: true,
      },
    });

    if (!santri) {
      return { success: false, message: "Data santri tidak ditemukan di pangkalan data." };
    }

    // 5. Data Ownership ABAC: MT/PH hanya boleh input santri binaannya (fail-closed)
    if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return {
          success: false,
          message: "Akses Ditolak: Profil staf pembina Anda belum terhubung. Hubungi Administrator.",
        };
      }

      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: input.santriId } },
        },
      });

      if (!isBinaan && !session.isKepalaBidangTahfidz) {
        return {
          success: false,
          message: "Akses Ditolak: Anda hanya berwenang mencatat setoran santri di dalam halaqoh binaan Anda.",
        };
      }
    }

    // 6. Staf Penilai / Pencatat: Fail-closed (Tanpa fallback staf acak)
    let musyrifStaffId = session.staffId;
    if (!musyrifStaffId) {
      const userWithStaff = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { staffId: true },
      });
      musyrifStaffId = userWithStaff?.staffId || null;
    }

    if (!musyrifStaffId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun Anda tidak memiliki relasi profil staf resmi untuk mencatat setoran.",
      };
    }

    const musyrifStaff = await prisma.staff.findUnique({ where: { id: musyrifStaffId } });
    if (!musyrifStaff) {
      return { success: false, message: "Data staf pengampu/pencatat tidak ditemukan di sistem." };
    }

    // 7. Simpan Setoran menggunakan Core Persistence Service (Atomic Serializable Transaction & Concurrency Protection)
    return await saveSetoranTahfizhCore(prisma, {
      input,
      context: {
        userId: session.userId,
        username: session.username,
        musyrifStaffId: musyrifStaff.id,
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

  // ABAC check
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berwenang melihat data santri Anda sendiri." };
    }
  } else if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Akun MT/PH belum terhubung dengan staf." };
    }
    if (!session.isKepalaBidangTahfidz) {
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: santriId } },
        },
      });
      if (!isBinaan) {
        return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
      }
    }
  }

  try {
    const refDate = tanggalStr ? new Date(tanggalStr) : new Date();
    const startOfWeek = getStartOfWeekWITA(refDate);

    // Ambil seluruh setoran SABAQ tersimpan sejak Senin 00:00:00 WITA sampai waktu referensi
    // Kriteria Ketat: HANYA jenis SABAQ, status BUKAN DIBATALKAN
    const sabaqRecords = await prisma.setoranTahfizh.findMany({
      where: {
        santriId,
        jenis: "SABAQ",
        status: { not: "DIBATALKAN" },
        tanggal: {
          gte: startOfWeek,
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

    if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return { success: false, message: "Akses Ditolak: Profil staf belum terhubung.", data: [] };
      }
      if (!session.isKepalaBidangTahfidz) {
        where.santri = {
          halaqoh: { pembinaId: session.staffId },
        };
      }
    } else if (session.role === "WS" || session.role === "ST") {
      if (!session.santriId) {
        return { success: false, message: "Akun Anda belum terhubung dengan data santri.", data: [] };
      }
      where.santriId = session.santriId;
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

  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat progres santri Anda sendiri." };
    }
  } else if (session.role === "MT" || session.role === "PH") {
    // Fail-closed: MT/PH tanpa staffId wajib langsung ditolak
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Akun MT/PH belum terhubung dengan data staf." };
    }
    if (!session.isKepalaBidangTahfidz) {
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: santriId } },
        },
      });
      if (!isBinaan) {
        return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
      }
    }
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

    const sabaqWhere: Prisma.SetoranTahfizhWhereInput = {
      santriId,
      jenis: "SABAQ",
      status: { not: "DIBATALKAN" },
    };
    if (baselineDate) {
      sabaqWhere.tanggal = { gte: baselineDate };
    }

    const sabaqAggregate = await prisma.setoranTahfizh.aggregate({
      where: sabaqWhere,
      _sum: { jumlahHalaman: true },
    });

    const tambahanSabaq = sabaqAggregate._sum.jumlahHalaman || 0;
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

  // ABAC Check
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat progres santri Anda sendiri." };
    }
  } else if (session.role === "MT" || session.role === "PH") {
    // Fail-closed: MT/PH tanpa staffId wajib langsung ditolak
    if (!session.staffId) {
      return { success: false, message: "Akses Ditolak: Akun MT/PH belum terhubung dengan data staf." };
    }
    if (!session.isKepalaBidangTahfidz) {
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: santriId } },
        },
      });
      if (!isBinaan) {
        return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
      }
    }
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      select: { modalHafalanAwalHalaman: true, tanggalBaselineTahfizh: true },
    });

    const modalAwal = Number(santri?.modalHafalanAwalHalaman) || 0;
    const baselineDate = santri?.tanggalBaselineTahfizh ? new Date(santri.tanggalBaselineTahfizh) : null;

    const sabaqWhere: Prisma.SetoranTahfizhWhereInput = {
      santriId,
      jenis: "SABAQ",
      status: { not: "DIBATALKAN" },
    };
    if (baselineDate) {
      sabaqWhere.tanggal = { gte: baselineDate };
    }

    const sabaqAggregate = await prisma.setoranTahfizh.aggregate({
      where: sabaqWhere,
      _sum: {
        jumlahHalaman: true,
      },
    });

    const tambahanSabaq = sabaqAggregate._sum.jumlahHalaman || 0;
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


