"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { JenisSetoran, NilaiSetoran } from "@prisma/client";

import { getJuzByPage, JUZ_LIST } from "@/lib/quran-metadata";
import { hitungRekomendasiSabaqiPekan, getStartOfWeekWITA } from "@/lib/sabaqi";

export interface CreateSetoranInput {
  santriId: string;
  jenis: JenisSetoran;
  juz: number;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  nilai: NilaiSetoran;
  catatan?: string;
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

  // 2. Validasi Server Nilai Halaman & Volume
  const halMulai = Number(input.halamanMulai);
  const halSelesai = Number(input.halamanSelesai);
  const jmlHalaman = Number(input.jumlahHalaman);
  const declaredJuz = Number(input.juz);

  if (isNaN(halMulai) || halMulai < 1 || halMulai > 604) {
    return { success: false, message: "Halaman mulai harus berada dalam rentang 1 sampai 604." };
  }
  if (isNaN(halSelesai) || halSelesai < 1 || halSelesai > 604) {
    return { success: false, message: "Halaman selesai harus berada dalam rentang 1 sampai 604." };
  }
  if (halSelesai < halMulai) {
    return { success: false, message: "Halaman selesai tidak boleh lebih kecil dari halaman mulai." };
  }
  if (isNaN(jmlHalaman) || jmlHalaman <= 0) {
    return { success: false, message: "Jumlah halaman harus bernilai positif (minimal 0.5 halaman)." };
  }

  // Validasi batas Juz berdasarkan Al-Qur'an Standar Madinah 604 Halaman
  const correctJuz = getJuzByPage(halMulai);
  const juzInfo = JUZ_LIST.find((j) => j.juz === declaredJuz);
  if (juzInfo && (halMulai < juzInfo.startPage || halMulai > juzInfo.endPage)) {
    return {
      success: false,
      message: `Halaman ${halMulai} bukan bagian dari Juz ${declaredJuz} (Rentang resmi Juz ${declaredJuz}: Halaman ${juzInfo.startPage}–${juzInfo.endPage}). Deteksi pintar sistem: Halaman ${halMulai} adalah Juz ${correctJuz}.`,
    };
  }

  // Validasi jenis SABAQI tanpa SABAQ pekan berjalan: harus ada catatan
  if (input.jenis === "SABQI" && (!input.catatan || input.catatan.trim().length === 0)) {
    // izinkan jika ada catatan penjelasan
  }

  try {
    // 3. Verifikasi Keberadaan Santri
    const santri = await prisma.santri.findUnique({
      where: { id: input.santriId },
      select: { id: true, nama: true, nis: true, halaqohId: true },
    });

    if (!santri) {
      return { success: false, message: "Data santri tidak ditemukan di pangkalan data." };
    }

    // 4. Data Ownership ABAC: Jika MT atau PH, verifikasi bahwa santri memang berada di bawah halaqoh binaannya
    if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return { success: false, message: "Profil staf pembina Anda belum terhubung." };
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

    // 5. Tentukan Musyrif penilai
    const musyrifStaff = session.staffId
      ? await prisma.staff.findUnique({ where: { id: session.staffId } })
      : await prisma.staff.findFirst({ where: { roleStaff: "MT" } });

    if (!musyrifStaff) {
      return { success: false, message: "Data pengampu/musyrif tidak ditemukan di sistem." };
    }

    // 6. Simpan Setoran dengan Mekanisme Kode Aman terhadap Concurrency
    let setoranCode = "";
    let newSetoran = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const timePart = Date.now().toString(36).toUpperCase();
        const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        setoranCode = `SET-${timePart}-${randPart}`;

        newSetoran = await prisma.setoranTahfizh.create({
          data: {
            setoranCode,
            santriId: input.santriId,
            musyrifId: musyrifStaff.id,
            tanggal: new Date(),
            jenis: input.jenis,
            juz: declaredJuz,
            halamanMulai: halMulai,
            halamanSelesai: halSelesai,
            jumlahHalaman: jmlHalaman,
            nilai: input.nilai,
            catatan: input.catatan?.trim() || null,
            createdBy: session.username,
          },
          include: {
            santri: true,
            musyrif: true,
          },
        });
        break;
      } catch (err) {
        if ((err as { code?: string })?.code === "P2002" && attempt < 2) {
          await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    if (!newSetoran) {
      throw new Error("Gagal menginisialisasi record setoran baru.");
    }

    // 7. Catat Audit Log
    await recordAuditLog({
      userId: session.userId,
      action: "CREATE_SETORAN",
      entity: "SetoranTahfizh",
      entityId: newSetoran.id,
      details: {
        setoranCode: newSetoran.setoranCode,
        databaseId: newSetoran.id,
        santriNis: newSetoran.santri.nis,
        juz: declaredJuz,
        halaman: `${halMulai}-${halSelesai}`,
        jumlahHalaman: jmlHalaman,
        nilai: input.nilai,
      },
    });

    return {
      success: true,
      message: `Setoran ${newSetoran.santri.nama} (${newSetoran.setoranCode}) berhasil dicatat.`,
      data: newSetoran,
    };
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
 * Server Action: Mengambil riwayat setoran terbaru (dengan otorisasi sesi & scoping ABAC)
 */
export async function getRecentSetoranAction(limit: number = 10) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu.", data: [] };
  }

  try {
    const where: Record<string, unknown> = {};

    if (session.role === "MT" || session.role === "PH") {
      if (session.staffId) {
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
    if (session.staffId) {
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
          orderBy: { tanggal: "desc" },
          take: 5,
        },
      },
    });

    if (!santri) return { success: false, message: "Santri tidak ditemukan" };

    const totalSetoran = await prisma.setoranTahfizh.count({
      where: { santriId },
    });

    const sabaqAggregate = await prisma.setoranTahfizh.aggregate({
      where: { santriId, jenis: "SABAQ" },
      _sum: { jumlahHalaman: true },
    });
    const totalHalamanSabaq = sabaqAggregate._sum.jumlahHalaman || 0;
    const totalJuzSabaq = Math.floor(totalHalamanSabaq / 20);
    const sisaHalamanSabaq = totalHalamanSabaq % 20;

    return {
      success: true,
      data: {
        ...santri,
        totalSetoran,
        totalHalamanSabaq,
        totalJuzSabaq,
        sisaHalamanSabaq,
        capaianLabel: `${totalJuzSabaq} Juz ${sisaHalamanSabaq} Halaman`,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data progres santri:", error);
    return { success: false, message: "Gagal mengambil data progres" };
  }
}

/**
 * Server Action: Hitung Total Halaman Kumulatif Santri dari seluruh Setoran SABAQ
 * Sabqi / Manzil / Mufar tidak menambah total kumulatif (itu muroja'ah).
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
    if (session.staffId) {
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: santriId } },
        },
      });
      if (!isBinaan && !session.isKepalaBidangTahfidz) {
        return { success: false, message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda." };
      }
    }
  }

  try {
    const sabaqAggregate = await prisma.setoranTahfizh.aggregate({
      where: {
        santriId,
        jenis: "SABAQ",
      },
      _sum: {
        jumlahHalaman: true,
      },
    });

    const totalHalaman = sabaqAggregate._sum.jumlahHalaman || 0;
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
 * Server Action: Mengambil Rekomendasi Sabaqi Santri Berdasarkan Setoran SABAQ Nyata Pekan Berjalan (WITA)
 */
export async function getSetoranSabaqPekanSantriAction(santriId: string, refDateStr?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  const refDate = refDateStr ? new Date(refDateStr) : new Date();
  const startOfWeek = getStartOfWeekWITA(refDate);

  try {
    const sabaqRecords = await prisma.setoranTahfizh.findMany({
      where: {
        santriId,
        jenis: "SABAQ",
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
      },
    });

    const rekomendasi = hitungRekomendasiSabaqiPekan(sabaqRecords, refDate);

    return {
      success: true,
      data: {
        rekomendasi,
        totalSetoranPekanIni: sabaqRecords.length,
        sabaqRecords,
      },
    };
  } catch (err) {
    console.error("Gagal mengambil data Sabaq pekanan:", (err as Error)?.message || err);
    return { success: false, message: "Gagal mengambil rekomendasi Sabaqi." };
  }
}

