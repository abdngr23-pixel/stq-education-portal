import "server-only";

import { PrismaClient, StatusIkhtibar } from "@prisma/client";
import { UserSession } from "@/types/auth";
import { prisma as defaultPrisma } from "@/lib/prisma";

export interface IkhtibarPendingResult {
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Service server internal untuk menghitung antrean Ikhtibar aktif berbasis ABAC fail-closed.
 * Modul ini dilindungi dengan `server-only` dan tidak boleh diimpor oleh client component.
 *
 * @param session - Sesi pengguna yang telah divalidasi oleh autentikasi server
 * @param db - Klien Prisma (mendukung dependency injection untuk pengujian terisolasi)
 */
export async function getIkhtibarPendingCountForSession(
  session: UserSession | null | undefined,
  db: PrismaClient = defaultPrisma
): Promise<IkhtibarPendingResult> {
  try {
    if (!session) {
      return {
        success: false,
        count: 0,
        error: "Sesi tidak valid atau belum login.",
      };
    }

    const activeStatuses: StatusIkhtibar[] = [
      StatusIkhtibar.PENGAJUAN,
      StatusIkhtibar.LULUS_TAHAP_1,
      StatusIkhtibar.MENGULANG,
      StatusIkhtibar.MENGULANG_SEBAGIAN,
      StatusIkhtibar.MENGULANG_SATU_JUZ,
    ];

    if (session.role === "MT") {
      // Fail-closed ABAC: akun MT tanpa relasi staffId menghasilkan 0
      if (!session.staffId) {
        return { success: true, count: 0 };
      }

      // Ambil halaqoh binaan MT
      const halaqohList = await db.halaqoh.findMany({
        where: { pembinaId: session.staffId },
        select: { id: true },
      });

      const halaqohIds = halaqohList.map((h) => h.id);
      if (halaqohIds.length === 0) {
        // Fail-closed: MT tanpa halaqoh binaan menghasilkan 0
        return { success: true, count: 0 };
      }

      // Hitung hanya santri dalam halaqoh kewenangannya
      const count = await db.ikhtibarTahfizh.count({
        where: {
          status: { in: activeStatuses },
          santri: {
            halaqohId: { in: halaqohIds },
          },
        },
      });

      return { success: true, count };
    }

    if (session.role === "KS" || session.role === "ADM" || session.role === "PH") {
      const count = await db.ikhtibarTahfizh.count({
        where: {
          status: { in: activeStatuses },
        },
      });
      return { success: true, count };
    }

    if (session.role === "ST" || session.role === "WS") {
      if (!session.santriId) {
        return { success: true, count: 0 };
      }
      const count = await db.ikhtibarTahfizh.count({
        where: {
          status: { in: activeStatuses },
          santriId: session.santriId,
        },
      });
      return { success: true, count };
    }

    return { success: true, count: 0 };
  } catch (err: unknown) {
    console.error("[Internal Service] Gagal memuat antrean Ikhtibar:", err);
    return {
      success: false,
      count: 0,
      error: "Gagal memuat antrean Ikhtibar. Silakan coba kembali.",
    };
  }
}
