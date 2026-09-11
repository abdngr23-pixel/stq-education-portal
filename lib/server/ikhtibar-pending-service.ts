import "server-only";

import { Prisma, PrismaClient, StatusIkhtibar } from "@prisma/client";
import { UserSession } from "@/types/auth";
import { prisma as defaultPrisma } from "@/lib/prisma";

export interface IkhtibarPendingResult {
  success: boolean;
  count: number;
  error?: string;
}

export const ACTIVE_IKHTIBAR_STATUSES: StatusIkhtibar[] = [
  StatusIkhtibar.PENGAJUAN,
  StatusIkhtibar.LULUS_TAHAP_1,
  StatusIkhtibar.MENGULANG,
  StatusIkhtibar.MENGULANG_SEBAGIAN,
  StatusIkhtibar.MENGULANG_SATU_JUZ,
];

/**
 * Helper internal bersama untuk menghasilkan filter scoping ABAC Ikhtibar berbasis wewenang sesi pengguna.
 * Menjamin keselarasan aturan akses antara hitungan antrean dan daftar riwayat ikhtibar.
 *
 * Aturan Akses:
 * - KS (Mudir) & ADM: Global seluruh pesantren.
 * - MT dengan isKepalaBidangTahfidz === true: Global seluruh pesantren.
 * - MT biasa: Terisolasi pada santri dalam halaqoh yang dibina oleh session.staffId.
 * - PH (Pengasuh Halaqoh): Terisolasi pada santri dalam halaqoh yang dibina oleh session.staffId.
 * - ST (Santri) & WS (Wali Santri): Terisolasi pada session.santriId terkait.
 * - Akun MT/PH tanpa staffId atau tanpa halaqoh: Fail-closed (return null -> 0 data).
 * - Akun ST/WS tanpa santriId: Fail-closed (return null -> 0 data).
 * - Peran lain: Fail-closed (return null -> 0 data).
 */
export function buildIkhtibarScopeWhere(
  session: UserSession | null | undefined
): Prisma.IkhtibarTahfizhWhereInput | null {
  if (!session) return null;

  // 1. Global: Mudir (KS), Administrator (ADM), atau MT Kepala Bidang Tahfidz
  if (
    session.role === "KS" ||
    session.role === "ADM" ||
    (session.role === "MT" && session.isKepalaBidangTahfidz)
  ) {
    return {};
  }

  // 2. Scoped Halaqoh: MT biasa dan Pengasuh Halaqoh (PH)
  if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return null;
    }
    return {
      santri: {
        halaqoh: {
          pembinaId: session.staffId,
        },
      },
    };
  }

  // 3. Scoped Santri: Wali Santri (WS) dan Santri Mandiri (ST)
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId) {
      return null;
    }
    return {
      santriId: session.santriId,
    };
  }

  // 4. Peran lain: Fail-closed
  return null;
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

    const scopeWhere = buildIkhtibarScopeWhere(session);
    if (!scopeWhere) {
      return { success: true, count: 0 };
    }

    const count = await db.ikhtibarTahfizh.count({
      where: {
        ...scopeWhere,
        status: { in: ACTIVE_IKHTIBAR_STATUSES },
      },
    });

    return { success: true, count };
  } catch (err: unknown) {
    console.error("[Internal Service] Gagal memuat antrean Ikhtibar:", err);
    return {
      success: false,
      count: 0,
      error: "Gagal memuat antrean Ikhtibar. Silakan coba kembali.",
    };
  }
}
