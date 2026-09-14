import "server-only";

import { PrismaClient, Prisma, JenisKelamin } from "@prisma/client";
import { UserSession } from "@/types/auth";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { isTodayWita, getWitaDateString } from "@/lib/wita-date";
import { getStartOfWeekWITA } from "@/lib/sabaqi";
import { calculateLatestSabaqPosition } from "@/lib/tahfizh-page-allocation";

import { determineTahfizhDailyStatus, isHariEfektifTahfizh, TahfizhDailyStatus } from "@/lib/tahfizh-status";
import {
  getCompletedJuzCount,
  getDailyMufarTargetJuz,
  calculateWeeklySabaqProgress,
  WeeklySabaqProgress,
} from "@/lib/tahfizh-mufar-tier";

export interface SantriListParams {
  search?: string;
  kelas?: string;
  halaqohId?: string;
  refDate?: Date;
}

export interface SantriListItem {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jenisKelamin: JenisKelamin;
  status: string;
  halaqohId: string | null;
  halaqohNama: string | null;
  halaqoh: string;
  pembina: string;
  namaWali?: string;
  noHpWali?: string;
  modalHalamanAwal: number;
  modalHafalanAwalHalaman: number;
  tanggalBaselineTahfizh: string | null;
  tambahanSabaq: number;
  totalHafalan: number;
  capaianHalaman: number;
  totalHalaman: number;
  capaianJuz: number;
  posisiTerakhirHalaman: number;
  isHalamanTerakhirParsial: boolean;
  targetJuz: number | null;
  targetSabaq: number | null;
  targetSabaqLabel: string;
  targetSabaqBulanan: number | null;
  targetSabaqPekanan: number | null;
  completedJuzCanonical: number;
  targetDailyMufarJuz: number;
  actualDailyMufarJuz: number;
  weeklySabaqProgress: WeeklySabaqProgress;
  statusTahfizhHariIni: TahfizhDailyStatus;
  mufarProgressLabel?: string;
  needsAttention?: boolean;
  attentionReasons?: string[];
  setoranTerakhir: string;
  setoranTerakhirAt: string | null;
  sudahSetorHariIni: boolean;
  nilaiTerakhir: string;
  poinPelanggaran: number;
  bintangKebaikan: number;
}

export interface SantriListResult {
  success: boolean;
  message?: string;
  error?: string;
  data: SantriListItem[];
}

/**
 * Service server internal untuk mengambil data santri terfilter dengan scoping role ABAC.
 * Modul ini dilindungi dengan `server-only` dan tidak boleh diimpor oleh client component.
 *
 * @param params - Filter pencarian, kelas, atau halaqoh
 * @param session - Sesi pengguna yang telah divalidasi oleh autentikasi server
 * @param db - Klien Prisma (mendukung dependency injection untuk pengujian terisolasi)
 */
export async function getSantriListForSession(
  params?: SantriListParams,
  session?: UserSession | null,
  db: PrismaClient = defaultPrisma
): Promise<SantriListResult> {
  try {
    if (!session) {
      return { success: false, message: "Sesi tidak valid atau belum login.", error: "Sesi tidak valid atau belum login.", data: [] };
    }

    const where: Prisma.SantriWhereInput = {};

    // Scoping berdasarkan Role
    if (session.role === "WS" || session.role === "ST") {
      if (!session.santriId) {
        return {
          success: false,
          message: "Akun Anda belum terhubung dengan data santri resmi. Silakan hubungi admin.",
          error: "Akun Anda belum terhubung dengan data santri resmi. Silakan hubungi admin.",
          data: [],
        };
      }
      where.id = session.santriId;
    } else if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return {
          success: false,
          message: "Profil staf pembina Anda belum terhubung. Silakan hubungi admin.",
          error: "Profil staf pembina Anda belum terhubung. Silakan hubungi admin.",
          data: [],
        };
      }
      if (session.isKepalaBidangTahfidz) {
        if (params?.halaqohId && params.halaqohId !== "ALL") {
          where.halaqohId = params.halaqohId;
        }
      } else {
        const halaqohDibina = await db.halaqoh.findMany({
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

    const list = await db.santri.findMany({
      where,
      orderBy: { nis: "asc" },
      include: {
        halaqoh: {
          include: { pembina: true },
        },
        setoranList: {
          orderBy: [
            { tanggal: "desc" },
            { createdAt: "desc" },
          ],
          select: {
            jenis: true,
            status: true,
            tanggal: true,
            createdAt: true,
            halamanMulai: true,
            halamanSelesai: true,
            jumlahHalaman: true,
            jumlahJuzMufar: true,
            catatan: true,
            juz: true,
            nilai: true,
          },
        },
        targetList: {
          select: {
            jenis: true,
            targetPekanan: true,
            targetBulanan: true,
            ambangKepatuhan: true,
            bulan: true,
            tahunAjaran: true,
          },
        },
        _count: {
          select: {
            pelanggaranList: true,
            bintangList: true,
          },
        },
      },
    });

    const ikhwanList = list.filter((s) => s.jenisKelamin === "L");
    const akhwatList = list
      .filter((s) => s.jenisKelamin === "P")
      .sort((a, b) =>
        a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
      );
    const sortedList = [...ikhwanList, ...akhwatList];

    const mappedData: SantriListItem[] = sortedList.map((s) => {
      const modalAwal = s.modalHafalanAwalHalaman || 0;
      const baselineDate = s.tanggalBaselineTahfizh ? new Date(s.tanggalBaselineTahfizh) : null;

      // Filter SABAQ aktif (non-dibatalkan) yang terjadi setelah tanggal baseline
      // ATURAN RESMI: Jika tanggalBaselineTahfizh tidak tersedia, TIDAK BOLEH menganggap riwayat SABAQ sebagai post-baseline
      const sabaqAfterBaseline = baselineDate
        ? (s.setoranList || []).filter((st) => {
            if (st.jenis !== "SABAQ" || st.status === "DIBATALKAN") return false;
            return new Date(st.tanggal) >= baselineDate;
          })
        : [];

      const tambahanSabaq = sabaqAfterBaseline.reduce((acc, cur) => acc + (cur.jumlahHalaman || 0), 0);
      const totalHafalan = modalAwal + tambahanSabaq;
      const capaianJuz = Math.floor(totalHafalan / 20);

      // Setoran valid non-batal untuk pelacakan status harian WITA & ringkasan aktivitas terbaru
      const validSetoranList = (s.setoranList || []).filter((st) => st.status !== "DIBATALKAN");
      const latestSetoran = validSetoranList[0] || null;
      const nilaiTerakhir = latestSetoran ? latestSetoran.nilai : "Belum ada data";

      const sabaqPosition = calculateLatestSabaqPosition(
        sabaqAfterBaseline.map((st) => ({
          jenis: st.jenis,
          status: "AKTIF",
          halamanMulai: st.halamanMulai,
          halamanSelesai: st.halamanSelesai,
          jumlahHalaman: st.jumlahHalaman,
          tanggal: st.tanggal,
        })),
        modalAwal,
        s.tanggalBaselineTahfizh
      );

      const posisiTerakhirHalaman = sabaqPosition.posisiTerakhirHalaman;
      const isHalamanTerakhirParsial = sabaqPosition.isHalamanTerakhirParsial;

      // Target individual dari TargetSantri berbasis periode aktif WITA
      const targetRefDate = params?.refDate || new Date();
      const nowWitaStr = getWitaDateString(targetRefDate);
      const [nowYearStr, nowMonthStr] = nowWitaStr.split("-");
      const activeMonth = parseInt(nowMonthStr, 10);
      const activeYearNum = parseInt(nowYearStr, 10);
      const defaultTahunAjaran = activeMonth >= 7
        ? `${activeYearNum}/${activeYearNum + 1}`
        : `${activeYearNum - 1}/${activeYearNum}`;
      const targetTahunAjaran = s.halaqoh?.tahunAjaran || defaultTahunAjaran;

      const targetList = s.targetList || [];
      const sabaqTarget = targetList.find(
        (t) => t.jenis === "SABAQ" && t.bulan === activeMonth && t.tahunAjaran === targetTahunAjaran
      );

      const targetSabaq = sabaqTarget?.targetBulanan ?? null;
      const targetSabaqLabel = targetSabaq !== null ? `${targetSabaq} Halaman` : "Target belum ditetapkan";
      const targetSabaqBulanan = targetSabaq;
      const targetSabaqPekanan = sabaqTarget?.targetPekanan ?? null;

      // Cek apakah ada SABAQ sah pada pekan berjalan sejak Senin 00:00 WITA (untuk applicability SABQI & progres pekanan)
      // Wajib memerlukan baselineDate dan SABAQ harus terjadi >= max(startOfWeek, baselineDate)
      const startOfWeek = getStartOfWeekWITA(targetRefDate);
      const minValidSabaqDate = baselineDate
        ? (baselineDate > startOfWeek ? baselineDate : startOfWeek)
        : null;
      const sabaqThisWeek = minValidSabaqDate
        ? validSetoranList.filter(
            (st) => st.jenis === "SABAQ" && new Date(st.tanggal) >= minValidSabaqDate
          )
        : [];
      const hasValidSabaqThisWeek = sabaqThisWeek.length > 0;
      const actualSabaqPagesThisWeek = sabaqThisWeek.reduce((sum, st) => sum + (st.jumlahHalaman || 0), 0);
      const weeklySabaqProgress = calculateWeeklySabaqProgress(targetSabaqPekanan, actualSabaqPagesThisWeek);

      // Metrik MUFAR kanonikal berbasis completed Juz Mushaf Madinah & Tier Resmi
      const completedJuzCanonical = getCompletedJuzCount(posisiTerakhirHalaman, isHalamanTerakhirParsial);
      const targetDailyMufarJuz = getDailyMufarTargetJuz(completedJuzCanonical);
      const isMufarApplicable = completedJuzCanonical >= 1;

      // Status setoran 4 jenis (SABAQ, SABQI, MANZIL, MUFAR) berdasarkan batas hari WITA & volume actual MUFAR
      // Locked Contract: jumlahJuzMufar adalah satu-satunya source of truth volume MUFAR
      const setoranHariIni = validSetoranList.filter((st) => isTodayWita(st.tanggal, targetRefDate));
      const setoranMufarHariIni = setoranHariIni.filter((st) => st.jenis === "MUFAR");
      const actualDailyMufarJuz = setoranMufarHariIni.reduce((sum, st) => {
        if (typeof st.jumlahJuzMufar === "number" && !isNaN(st.jumlahJuzMufar) && st.jumlahJuzMufar > 0) {
          return sum + st.jumlahJuzMufar;
        }
        return sum;
      }, 0);

      const statusTahfizhHariIni = determineTahfizhDailyStatus({
        validSetoranToday: setoranHariIni,
        posisiTerakhirHalaman,
        isHalamanTerakhirParsial,
        targetDailyMufarJuz,
        actualDailyMufarJuz,
        isMufarApplicable,
        hasValidSabaqThisWeek,
        refDate: targetRefDate,
      });

      const setoranTerakhirAt = latestSetoran ? latestSetoran.tanggal.toISOString() : null;

      // Label visual untuk MUFAR
      let mufarProgressLabel: string;
      if (targetDailyMufarJuz <= 0 || statusTahfizhHariIni.mufar === "TIDAK_BERLAKU") {
        mufarProgressLabel = "Tidak Berlaku";
      } else if (statusTahfizhHariIni.mufar === "SELESAI") {
        mufarProgressLabel = `Tercapai (${actualDailyMufarJuz}/${targetDailyMufarJuz} Juz)`;
      } else {
        mufarProgressLabel = `${actualDailyMufarJuz}/${targetDailyMufarJuz} Juz`;
      }

      const isEffective = isHariEfektifTahfizh(targetRefDate);
      const attentionReasons: string[] = [];
      if (isEffective) {
        if (!statusTahfizhHariIni.sudahSetorHariIni) {
          attentionReasons.push("Belum menyetorkan hafalan hari ini");
        }
        if (
          statusTahfizhHariIni.mufar === "BELUM_SELESAI" &&
          statusTahfizhHariIni.sudahSetorHariIni
        ) {
          attentionReasons.push(
            `Target harian Mufar belum terpenuhi (${actualDailyMufarJuz}/${targetDailyMufarJuz} Juz)`
          );
        }
      }
      const needsAttention = attentionReasons.length > 0;

      return {
        id: s.id,
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
        completedJuzCanonical,
        targetDailyMufarJuz,
        actualDailyMufarJuz,
        weeklySabaqProgress,
        statusTahfizhHariIni,
        mufarProgressLabel,
        needsAttention,
        attentionReasons,
        targetJuz: s.targetAkhirProgramJuz && s.targetAkhirProgramJuz > 0 ? s.targetAkhirProgramJuz : null,
        targetSabaq,
        targetSabaqLabel,
        targetSabaqBulanan,
        targetSabaqPekanan,
        setoranTerakhir: latestSetoran
          ? `${latestSetoran.jenis} Juz ${latestSetoran.juz} Hlm ${latestSetoran.halamanMulai}-${latestSetoran.halamanSelesai}`
          : "-",
        setoranTerakhirAt,
        sudahSetorHariIni: statusTahfizhHariIni.sudahSetorHariIni,
        nilaiTerakhir,
        poinPelanggaran: s._count.pelanggaranList || 0,
        bintangKebaikan: s._count.bintangList || 0,
      };
    });

    return { success: true, data: mappedData };
  } catch (error) {
    console.error("[Internal Service] Gagal mengambil data santri:", error);
    return { success: false, message: "Gagal mengambil data santri.", error: "Gagal memuat data santri", data: [] };
  }
}
