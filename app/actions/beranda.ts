"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { createPrismaDataProvider, authorizeCanonical } from "@/lib/auth/canonical-evaluator";
import { StatusIzin, StatusSP, StatusKesehatan } from "@prisma/client";

export type SummaryAvailability = "AVAILABLE" | "UNAVAILABLE" | "ERROR";

export interface SummaryMetricItem {
  status: SummaryAvailability;
  count: number | null;
}

export interface BerandaOperationalSummary {
  izin: {
    status: SummaryAvailability;
    pendingCount: number | null;
  };
  sp: {
    status: SummaryAvailability;
    activeCount: number | null;
  };
  kesehatan: {
    status: SummaryAvailability;
    activeCount: number | null;
  };
}

export interface BerandaSummaryResponse {
  success: boolean;
  message?: string;
  data?: BerandaOperationalSummary;
}

/**
 * Server Action: Mengambil ringkasan data operasional Beranda secara aman,
 * teragregasi (count murni tanpa transmisi PII), dan fail-closed sesuai RBAC & ABAC.
 */
export async function getBerandaOperationalSummaryAction(): Promise<BerandaSummaryResponse> {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return {
        success: false,
        message: "Sesi tidak valid atau belum login.",
      };
    }

    // 1. Izin Menunggu (Perizinan)
    let izinStatus: SummaryAvailability = "UNAVAILABLE";
    let izinPendingCount: number | null = null;

    if (session.role === "WS" || session.role === "ST") {
      if (session.santriId) {
        izinPendingCount = await prisma.perizinanSantri.count({
          where: {
            santriId: session.santriId,
            status: { in: [StatusIzin.MENUNGGU_MK, StatusIzin.MENUNGGU_KS] },
          },
        });
        izinStatus = "AVAILABLE";
      } else {
        izinStatus = "UNAVAILABLE";
      }
    } else {
      // Staf/Institusional: Evaluasi kapabilitas keasramaan.permission.read
      const dataProvider = createPrismaDataProvider(prisma);
      const authRes = await authorizeCanonical({
        identity: { userId: session.userId },
        capability: "keasramaan.permission.read",
        dataProvider,
      });

      // ORR-008: ERROR != UNAVAILABLE. Evaluator failure must fail closed with truthful error.
      if (authRes.decision === "ERROR") {
        return {
          success: false,
          message: "Gagal memverifikasi otorisasi perizinan santri.",
        };
      }

      if (authRes.decision === "DENY") {
        // Legitimate absence of permission -> UNAVAILABLE
        izinStatus = "UNAVAILABLE";
        izinPendingCount = null;
      } else if (authRes.decision === "ALLOW") {
        if (authRes.positionCode === "MUDIR" && authRes.scopeType === "GLOBAL") {
          izinPendingCount = await prisma.perizinanSantri.count({
            where: {
              status: { in: [StatusIzin.MENUNGGU_MK, StatusIzin.MENUNGGU_KS] },
            },
          });
          izinStatus = "AVAILABLE";
        } else if (authRes.positionCode === "KEPALA_KEASRAMAAN" && authRes.scopeType === "DOMAIN") {
          izinPendingCount = await prisma.perizinanSantri.count({
            where: {
              status: { in: [StatusIzin.MENUNGGU_MK, StatusIzin.MENUNGGU_KS] },
            },
          });
          izinStatus = "AVAILABLE";
        } else if (authRes.positionCode === "PEMBINA_HALAQOH" && authRes.scopeType === "KAMAR") {
          const kamarId = authRes.grantUsed?.anchorUnitId || authRes.grantUsed?.unitIds?.[0];
          if (kamarId) {
            const placements = await prisma.santriKamarPlacement.findMany({
              where: { kamarId, isActive: true },
              select: { santriId: true },
            });
            const allowedSantriIds = placements.map((p) => p.santriId);
            if (allowedSantriIds.length > 0) {
              izinPendingCount = await prisma.perizinanSantri.count({
                where: {
                  santriId: { in: allowedSantriIds },
                  status: { in: [StatusIzin.MENUNGGU_MK, StatusIzin.MENUNGGU_KS] },
                },
              });
            } else {
              izinPendingCount = 0;
            }
            izinStatus = "AVAILABLE";
          } else {
            izinStatus = "UNAVAILABLE";
          }
        } else {
          izinStatus = "UNAVAILABLE";
        }
      } else {
        return {
          success: false,
          message: "Status otorisasi tidak dikenal.",
        };
      }
    }

    // 2. Active SP (Kedisiplinan)
    let spStatus: SummaryAvailability = "UNAVAILABLE";
    let activeSpCount: number | null = null;

    if (session.role === "WS" || session.role === "ST") {
      if (session.santriId) {
        activeSpCount = await prisma.suratPeringatan.count({
          where: {
            santriId: session.santriId,
            status: StatusSP.AKTIF,
          },
        });
        spStatus = "AVAILABLE";
      }
    } else if (["MK", "KS", "ADM", "YAY"].includes(session.role)) {
      activeSpCount = await prisma.suratPeringatan.count({
        where: { status: StatusSP.AKTIF },
      });
      spStatus = "AVAILABLE";
    } else if (session.role === "MT" || session.role === "PH") {
      if (session.isKepalaBidangTahfidz) {
        activeSpCount = await prisma.suratPeringatan.count({
          where: { status: StatusSP.AKTIF },
        });
        spStatus = "AVAILABLE";
      } else if (session.staffId) {
        activeSpCount = await prisma.suratPeringatan.count({
          where: {
            santri: {
              halaqoh: {
                pembinaId: session.staffId,
              },
            },
            status: StatusSP.AKTIF,
          },
        });
        spStatus = "AVAILABLE";
      }
    }

    // 3. Active Health (Kesehatan)
    let healthStatus: SummaryAvailability = "UNAVAILABLE";
    let activeHealthCount: number | null = null;

    if (session.role === "WS" || session.role === "ST") {
      if (session.santriId) {
        activeHealthCount = await prisma.catatanKesehatan.count({
          where: {
            santriId: session.santriId,
            status: { in: [StatusKesehatan.RAWAT_PONDOK, StatusKesehatan.DIRUJUK_PUSKESMAS, StatusKesehatan.DIRUJUK_RS] },
          },
        });
        healthStatus = "AVAILABLE";
      }
    } else if (session.role === "KS" || session.role === "MK" || session.role === "ADM") {
      activeHealthCount = await prisma.catatanKesehatan.count({
        where: {
          status: { in: [StatusKesehatan.RAWAT_PONDOK, StatusKesehatan.DIRUJUK_PUSKESMAS, StatusKesehatan.DIRUJUK_RS] },
        },
      });
      healthStatus = "AVAILABLE";
    }

    return {
      success: true,
      data: {
        izin: {
          status: izinStatus,
          pendingCount: izinPendingCount,
        },
        sp: {
          status: spStatus,
          activeCount: activeSpCount,
        },
        kesehatan: {
          status: healthStatus,
          activeCount: activeHealthCount,
        },
      },
    };
  } catch (err: unknown) {
    console.error("[getBerandaOperationalSummaryAction] Error:", err);
    return {
      success: false,
      message: "Gagal memuat ringkasan operasional Beranda dari server.",
    };
  }
}
