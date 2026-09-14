import "server-only";

import { PrismaClient } from "@prisma/client";
import defaultPrisma from "@/lib/prisma";
import { UserSession } from "@/types/auth";
import { getSantriListForSession } from "@/lib/server/santri-list-service";
import { getIkhtibarPendingCountForSession } from "@/lib/server/ikhtibar-pending-service";
import { isHariEfektifTahfizh, TahfizhDailyStatus } from "@/lib/tahfizh-status";
import { WeeklySabaqProgress } from "@/lib/tahfizh-mufar-tier";

export type TahfizhOperationalFilter =
  | "ALL"
  | "PERLU_TINDAKAN"
  | "BELUM_SETOR"
  | "SABAQ_TERTINGGAL"
  | "MUFAR_BELUM_TERPENUHI"
  | "TARGET_BELUM_DITETAPKAN";

export interface TahfizhMonitoringSantriItem {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  halaqohId: string | null;
  halaqoh: string;
  pembina: string;
  namaWali?: string;
  noHpWali?: string;
  posisiTerakhirHalaman: number;
  capaianJuz: number;
  completedJuzCanonical: number;
  statusTahfizhHariIni: TahfizhDailyStatus;
  weeklySabaq: WeeklySabaqProgress;
  mufarProgressLabel: string;
  needsAttention: boolean;
  attentionReasons: string[];
  setoranTerakhir: string;
  setoranTerakhirAt: string | null;
  sudahSetorHariIni: boolean;
  nilaiTerakhir: string;
  bintangKebaikan: number;
  poinPelanggaran: number;
}

export interface TahfizhMonitoringSummary {
  totalSantri: number;
  sudahSetor: number;
  belumSetor: number;
  perluTindakan: number;
  targetSabaqTertinggal: number;
  mufarBelumTerpenuhi: number;
  targetBelumDitetapkan: number;
  antreanIkhtibar: number;
  antreanIzin: number;
}

export interface HalaqohWorkloadSummary {
  halaqohId: string;
  halaqohNama: string;
  pembinaNama: string;
  totalSantri: number;
  perluTindakanCount: number;
  belumSetorCount: number;
  sabaqTertinggalCount: number;
  mufarBelumTerpenuhiCount: number;
}

export interface TahfizhOperationalMonitoringResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    items: TahfizhMonitoringSantriItem[];
    summary: TahfizhMonitoringSummary;
    isKabidOrManagerial: boolean;
    currentHalaqohName?: string;
    halaqohWorkloads?: HalaqohWorkloadSummary[] | null;
  };
}

export interface GetTahfizhMonitoringParams {
  halaqohId?: string;
  filter?: TahfizhOperationalFilter | string;
  search?: string;
  kelas?: string;
  refDate?: Date;
}

/**
 * Service internal monitoring operasional Tahfizh.
 * Menghasilkan dataset terpadu single-source-of-truth untuk Action Center Musyrif Tahfizh & Kabid/Mudir.
 * Mematuhi prinsip ABAC ketat, bounded batch queries, dan audit trace.
 */
export async function getTahfizhOperationalMonitoring(
  params?: GetTahfizhMonitoringParams,
  session?: UserSession | null,
  db: PrismaClient = defaultPrisma
): Promise<TahfizhOperationalMonitoringResult> {
  try {
    if (!session) {
      return {
        success: false,
        message: "Sesi tidak valid atau belum login.",
        error: "Sesi tidak valid atau belum login.",
      };
    }

    // 1. Role Allowlist ABAC
    const ALLOWED_ROLES = ["MT", "PH", "KS", "ADM", "YAY"];
    if (!ALLOWED_ROLES.includes(session.role)) {
      return {
        success: false,
        message: "Akses Ditolak: Anda tidak memiliki wewenang untuk mengakses monitoring operasional Tahfizh.",
        error: "FORBIDDEN_ROLE",
      };
    }

    const isKabid = Boolean(session.isKepalaBidangTahfidz);
    const isManagerial = ["KS", "ADM", "YAY"].includes(session.role);
    const isKabidOrManagerial = isKabid || isManagerial;

    // 2. Strict MT/PH scoping & fail-closed check
    if (!isKabidOrManagerial && (session.role === "MT" || session.role === "PH")) {
      if (!session.staffId) {
        return {
          success: false,
          message: "Akses Ditolak: Profil staf pembina Anda belum terhubung. Silakan hubungi admin.",
          error: "STAFF_ID_MISSING",
        };
      }

      // Ambil halaqoh binaan MT
      const halaqohDibina = await db.halaqoh.findMany({
        where: { pembinaId: session.staffId },
        select: { id: true, nama: true },
      });
      const allowedHalaqohIds = halaqohDibina.map((h) => h.id);

      // Jika MT mencoba mengakses halaqoh tertentu di luar binaannya -> FAIL CLOSED
      if (params?.halaqohId && params.halaqohId !== "ALL" && !allowedHalaqohIds.includes(params.halaqohId)) {
        return {
          success: false,
          message: "Akses Ditolak: Anda tidak memiliki akses ke halaqoh ini.",
          error: "CROSS_HALAQOH_FORBIDDEN",
        };
      }
    }

    // 3. Ambil data santri lengkap menggunakan canonical batch service
    const santriListRes = await getSantriListForSession(
      {
        halaqohId: params?.halaqohId,
        search: params?.search,
        kelas: params?.kelas,
        refDate: params?.refDate,
      },
      session,
      db
    );

    if (!santriListRes.success) {
      return {
        success: false,
        message: santriListRes.message || "Gagal memuat data santri.",
        error: santriListRes.error || "QUERY_ERROR",
      };
    }

    const refDate = params?.refDate || new Date();
    const isEffective = isHariEfektifTahfizh(refDate);

    // 4. Transform dan evaluasi Needs-Attention serta MUFAR progress label
    const allItems: TahfizhMonitoringSantriItem[] = santriListRes.data.map((s) => {
      const reasons: string[] = [];

      // Evaluasi Target Sabaq Pekanan
      if (s.weeklySabaqProgress.status === "TARGET_BELUM_DITETAPKAN") {
        reasons.push("Target Sabaq pekanan belum ditetapkan");
      } else if (s.weeklySabaqProgress.status === "BELUM_TERCAPAI") {
        reasons.push(`Target Sabaq pekanan tertinggal (${s.weeklySabaqProgress.remaining} hal lagi)`);
      }

      // Evaluasi Harian pada Hari Efektif
      if (isEffective) {
        if (s.statusTahfizhHariIni.sabaq === "BELUM_SELESAI") {
          reasons.push("Belum setor Sabaq hari ini");
        }
        if (s.statusTahfizhHariIni.mufar === "BELUM_SELESAI") {
          reasons.push(
            `Target MUFAR hari ini belum tuntas (${s.actualDailyMufarJuz}/${s.targetDailyMufarJuz} Juz)`
          );
        }
      }

      const needsAttention = reasons.length > 0;

      // Label visual untuk MUFAR
      let mufarProgressLabel: string;
      if (s.targetDailyMufarJuz <= 0 || s.statusTahfizhHariIni.mufar === "TIDAK_BERLAKU") {
        mufarProgressLabel = "Tidak Berlaku";
      } else if (s.statusTahfizhHariIni.mufar === "SELESAI") {
        mufarProgressLabel = `Tercapai (${s.actualDailyMufarJuz}/${s.targetDailyMufarJuz} Juz)`;
      } else {
        mufarProgressLabel = `${s.actualDailyMufarJuz}/${s.targetDailyMufarJuz} Juz`;
      }

      return {
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        halaqohId: s.halaqohId,
        halaqoh: s.halaqoh,
        pembina: s.pembina,
        namaWali: s.namaWali,
        noHpWali: s.noHpWali,
        posisiTerakhirHalaman: s.posisiTerakhirHalaman,
        capaianJuz: s.capaianJuz,
        completedJuzCanonical: s.completedJuzCanonical,
        statusTahfizhHariIni: s.statusTahfizhHariIni,
        weeklySabaq: s.weeklySabaqProgress,
        mufarProgressLabel,
        needsAttention,
        attentionReasons: reasons,
        setoranTerakhir: s.setoranTerakhir,
        setoranTerakhirAt: s.setoranTerakhirAt,
        sudahSetorHariIni: s.sudahSetorHariIni,
        nilaiTerakhir: s.nilaiTerakhir,
        bintangKebaikan: s.bintangKebaikan,
        poinPelanggaran: s.poinPelanggaran,
      };
    });

    // 5. Antrean Ikhtibar
    let antreanIkhtibar = 0;
    try {
      const ikhtibarRes = await getIkhtibarPendingCountForSession(session, db);
      if (ikhtibarRes.success && typeof ikhtibarRes.count === "number") {
        antreanIkhtibar = ikhtibarRes.count;
      }
    } catch {
      antreanIkhtibar = 0;
    }

    // 6. Hitung Summary Metrics (Basis Seluruh Santri pada Scope Aktif)
    const totalSantri = allItems.length;
    const sudahSetor = allItems.filter((i) => i.sudahSetorHariIni).length;
    const belumSetor = totalSantri - sudahSetor;
    const perluTindakan = allItems.filter((i) => i.needsAttention).length;
    const targetSabaqTertinggal = allItems.filter(
      (i) => i.weeklySabaq.status === "BELUM_TERCAPAI"
    ).length;
    const mufarBelumTerpenuhi = allItems.filter(
      (i) => i.statusTahfizhHariIni.mufar === "BELUM_SELESAI"
    ).length;
    const targetBelumDitetapkan = allItems.filter(
      (i) => i.weeklySabaq.status === "TARGET_BELUM_DITETAPKAN"
    ).length;

    const summary: TahfizhMonitoringSummary = {
      totalSantri,
      sudahSetor,
      belumSetor,
      perluTindakan,
      targetSabaqTertinggal,
      mufarBelumTerpenuhi,
      targetBelumDitetapkan,
      antreanIkhtibar,
      antreanIzin: 0,
    };

    // 7. Filter items sesuai tab operasional jika diberikan
    const activeFilter = (params?.filter || "ALL").toUpperCase();
    let filteredItems = allItems;

    switch (activeFilter) {
      case "PERLU_TINDAKAN":
        filteredItems = allItems.filter((i) => i.needsAttention);
        break;
      case "BELUM_SETOR":
        filteredItems = allItems.filter((i) => !i.sudahSetorHariIni);
        break;
      case "SABAQ_TERTINGGAL":
        filteredItems = allItems.filter((i) => i.weeklySabaq.status === "BELUM_TERCAPAI");
        break;
      case "MUFAR_BELUM_TERPENUHI":
        filteredItems = allItems.filter(
          (i) => i.statusTahfizhHariIni.mufar === "BELUM_SELESAI"
        );
        break;
      case "TARGET_BELUM_DITETAPKAN":
        filteredItems = allItems.filter(
          (i) => i.weeklySabaq.status === "TARGET_BELUM_DITETAPKAN"
        );
        break;
      case "ALL":
      default:
        filteredItems = allItems;
        break;
    }

    // 8. Workload Summary per Halaqoh (khusus Kabid / Mudir / Managerial, zero ranking/leaderboard)
    let halaqohWorkloads: HalaqohWorkloadSummary[] | null = null;
    if (isKabidOrManagerial) {
      const allHalaqoh = await db.halaqoh.findMany({
        include: { pembina: true },
        orderBy: { nama: "asc" },
      });

      halaqohWorkloads = allHalaqoh.map((hlq) => {
        const santriHalaqoh = allItems.filter((i) => i.halaqohId === hlq.id);
        return {
          halaqohId: hlq.id,
          halaqohNama: hlq.nama,
          pembinaNama: hlq.pembina?.nama || "-",
          totalSantri: santriHalaqoh.length,
          perluTindakanCount: santriHalaqoh.filter((s) => s.needsAttention).length,
          belumSetorCount: santriHalaqoh.filter((s) => !s.sudahSetorHariIni).length,
          sabaqTertinggalCount: santriHalaqoh.filter(
            (s) => s.weeklySabaq.status === "BELUM_TERCAPAI"
          ).length,
          mufarBelumTerpenuhiCount: santriHalaqoh.filter(
            (s) => s.statusTahfizhHariIni.mufar === "BELUM_SELESAI"
          ).length,
        };
      });
    }

    // Resolve halaqoh name jika single halaqoh
    let currentHalaqohName: string | undefined = undefined;
    if (params?.halaqohId && params.halaqohId !== "ALL") {
      const hlq = await db.halaqoh.findUnique({
        where: { id: params.halaqohId },
        select: { nama: true },
      });
      if (hlq) currentHalaqohName = hlq.nama;
    } else if (!isKabidOrManagerial && allItems.length > 0) {
      currentHalaqohName = allItems[0].halaqoh;
    }

    return {
      success: true,
      data: {
        items: filteredItems,
        summary,
        isKabidOrManagerial,
        currentHalaqohName,
        halaqohWorkloads,
      },
    };
  } catch (error) {
    console.error("[TahfizhMonitoringService] Gagal menjalankan monitoring operasional:", error);
    return {
      success: false,
      message: "Terjadi kesalahan internal saat memuat data monitoring operasional.",
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    };
  }
}
