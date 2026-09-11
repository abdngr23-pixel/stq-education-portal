import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";
import { UserSession } from "@/types/auth";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { isTodayWita } from "@/lib/wita-date";
import { calculateLatestSabaqPosition } from "@/lib/tahfizh-page-allocation";

export interface SantriListParams {
  search?: string;
  kelas?: string;
  halaqohId?: string;
}

export interface SantriListItem {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
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
  targetJuz: number;
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
          orderBy: { tanggal: "desc" },
        },
        _count: {
          select: { pelanggaranList: true },
        },
      },
    });

    const mappedData: SantriListItem[] = list.map((s) => {
      const modalAwal = s.modalHafalanAwalHalaman || 0;
      const baselineDate = s.tanggalBaselineTahfizh ? new Date(s.tanggalBaselineTahfizh) : null;

      // Filter SABAQ aktif (non-dibatalkan) yang terjadi setelah tanggal baseline
      const sabaqAfterBaseline = (s.setoranList || []).filter((st) => {
        if (st.jenis !== "SABAQ" || st.status === "DIBATALKAN") return false;
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

      // Hitung total bintang kebaikan
      const totalBintang = (s.setoranList || []).reduce((acc, cur) => {
        if (cur.status === "DIBATALKAN") return acc;
        if (cur.nilai === "MUMTAZ") return acc + 2;
        if (cur.nilai === "JAYYID_JIDDAN") return acc + 1;
        return acc;
      }, 0);

      return {
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
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
        targetJuz: 30,
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
    console.error("[Internal Service] Gagal mengambil data santri:", error);
    return { success: false, message: "Gagal mengambil data santri.", error: "Gagal memuat data santri", data: [] };
  }
}
