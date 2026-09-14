import { JUZ_LIST } from "@/lib/quran-metadata";

/**
 * Menghitung jumlah Juz yang benar-benar telah tuntas dihafal berdasarkan posisi halaman terakhir
 * Mushaf Madinah (604 halaman) dan status halaman parsial (0.5 halaman).
 *
 * Aturan Kanonikal (Mushaf-Based Boundaries):
 * - Sebuah Juz tuntas jika dan hanya jika posisi halaman santri telah mencapai atau melampaui `endPage` juz tersebut.
 * - Guard Halaman Parsial (Sangat Penting):
 *   Jika posisi halaman santri tepat berada di `endPage` suatu juz (misal: halaman 21 untuk Juz 1),
 *   tetapi halaman tersebut masih berstatus parsial (`isHalamanTerakhirParsial === true` / baru disetor 0.5 halaman),
 *   maka juz tersebut BELUM tuntas penuh (karena ayat-ayat di paruh akhir halaman belum disetor).
 *   Contoh:
 *     - Halaman 21 parsial -> completed juz = 0 (MUFAR TIDAK_BERLAKU)
 *     - Halaman 21 full    -> completed juz = 1 (MUFAR Tier 1)
 *     - Halaman 121 parsial -> completed juz = 5 (Juz 6 belum tuntas)
 *     - Halaman 121 full    -> completed juz = 6 (Juz 6 tuntas, MUFAR Tier 2)
 */
export function getCompletedJuzCount(
  posisiTerakhirHalaman: number,
  isHalamanTerakhirParsial: boolean = false
): number {
  if (typeof posisiTerakhirHalaman !== "number" || isNaN(posisiTerakhirHalaman) || posisiTerakhirHalaman <= 0) {
    return 0;
  }

  let completedJuz = 0;

  for (const j of JUZ_LIST) {
    if (posisiTerakhirHalaman > j.endPage) {
      completedJuz = j.juz;
    } else if (posisiTerakhirHalaman === j.endPage) {
      if (!isHalamanTerakhirParsial) {
        completedJuz = j.juz;
      }
      break;
    } else {
      // Belum mencapai akhir juz ini
      break;
    }
  }

  return completedJuz;
}

/**
 * Menentukan target harian volume MUFAR (Juz/hari) berdasarkan completed Juz kanonikal.
 *
 * Formula Resmi Kebijakan Tahfizh:
 * - 0 juz      -> 0 juz/hari (TIDAK_BERLAKU)
 * - 1–5 juz    -> 1 juz/hari
 * - 6–10 juz   -> 2 juz/hari
 * - 11–15 juz  -> 3 juz/hari
 * - 16–20 juz  -> 4 juz/hari
 * - 21–30 juz  -> 5 juz/hari
 */
export function getDailyMufarTargetJuz(completedJuz: number): number {
  if (typeof completedJuz !== "number" || isNaN(completedJuz) || completedJuz <= 0) {
    return 0;
  }
  if (completedJuz <= 5) return 1;
  if (completedJuz <= 10) return 2;
  if (completedJuz <= 15) return 3;
  if (completedJuz <= 20) return 4;
  return 5;
}

export type WeeklySabaqStatus = "TERCAPAI" | "BELUM_TERCAPAI" | "TARGET_BELUM_DITETAPKAN";

export interface WeeklySabaqProgress {
  target: number | null;
  targetLabel: string;
  actual: number;
  remaining: number | null;
  percentage: number;
  status: WeeklySabaqStatus;
}

/**
 * Menghitung progres target SABAQ pekanan individual santri.
 *
 * Source: TargetSantri.targetPekanan
 * Actual: Jumlah jumlahHalaman SABAQ sah pada pekan WITA berjalan setelah baseline.
 * Exclude: Setoran berstatus DIBATALKAN.
 *
 * Rules:
 * - Jika target missing/null/<= 0: targetLabel = "Target belum ditetapkan", status = "TARGET_BELUM_DITETAPKAN", remaining = null.
 * - Tanpa pembulatan 0.5 (mendukung target pecahan presisi, e.g. 3.5 atau 4.5).
 */
export function calculateWeeklySabaqProgress(
  targetPekanan: number | null | undefined,
  actualPagesThisWeek: number
): WeeklySabaqProgress {
  const actual = typeof actualPagesThisWeek === "number" && !isNaN(actualPagesThisWeek)
    ? Math.max(0, actualPagesThisWeek)
    : 0;

  if (targetPekanan === null || targetPekanan === undefined || isNaN(targetPekanan) || targetPekanan <= 0) {
    return {
      target: null,
      targetLabel: "Target belum ditetapkan",
      actual,
      remaining: null,
      percentage: 0,
      status: "TARGET_BELUM_DITETAPKAN",
    };
  }

  const remaining = Math.max(0, targetPekanan - actual);
  const percentage = Math.min(100, Math.round((actual / targetPekanan) * 100));
  const isTercapai = actual >= targetPekanan;

  return {
    target: targetPekanan,
    targetLabel: `${targetPekanan} Halaman`,
    actual,
    remaining,
    percentage,
    status: isTercapai ? "TERCAPAI" : "BELUM_TERCAPAI",
  };
}

export interface HalaqohWorkloadSummary {
  halaqohId: string;
  halaqohNama: string;
  pembinaNama: string;
  totalSantri: number;
  perluTindakanCount: number;
  belumSetorCount: number;
  sabaqBelumTercapaiCount: number;
  sabaqTertinggalCount?: number;
  mufarBelumTerpenuhiCount: number;
}
