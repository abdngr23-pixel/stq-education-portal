/**
 * Tahfizh Operational Status Engine
 * STQ Darul Ulum Cendekia
 *
 * Aturan Bisnis Resmi:
 * 1. Hari efektif monitoring Tahfizh adalah Senin–Jumat (WITA, UTC+8).
 * 2. Sabtu (tidak ada kegiatan pokok Tahfizh) dan Ahad (libur) tidak boleh membuat santri berstatus gagal.
 *    Jika santri tidak menyetor pada akhir pekan, status bernilai TIDAK_BERLAKU (bukan BELUM_SELESAI).
 * 3. Status Tahfizh dipisah minimal 4 jenis: SABAQ, SABQI, MANZIL, MUFAR.
 * 4. Tiga kondisi operasional: SELESAI, BELUM_SELESAI, TIDAK_BERLAKU.
 * 5. SABAQ: Jika santri telah khatam mencapai halaman 604, tidak ada kewajiban Sabaq baru (TIDAK_BERLAKU).
 * 6. SABQI: Dipantau terpisah, berasal dari sabaq pekan berjalan sejak Senin WITA.
 * 7. MANZIL: Dipantau terpisah dari Sabaq dan Sabqi. Setoran Manzil tidak membuat Sabaq/Sabqi selesai.
 * 8. MUFAR: Evaluasi volume harian (Juz/hari).
 *    - Hari Efektif:
 *      target <= 0 atau !isApplicable -> TIDAK_BERLAKU
 *      actual >= target               -> SELESAI
 *      actual < target                -> BELUM_SELESAI
 *    - Akhir Pekan (Sabtu/Ahad):
 *      actual > 0                     -> SELESAI
 *      actual = 0                     -> TIDAK_BERLAKU
 * 9. Setoran dengan status DIBATALKAN tidak dihitung dan tidak membuat status menjadi SELESAI.
 */

import { getCompletedJuzCount, getDailyMufarTargetJuz } from "./tahfizh-mufar-tier";

export type OperationalStatus = "SELESAI" | "BELUM_SELESAI" | "TIDAK_BERLAKU";

export interface SetoranSummaryItem {
  jenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR" | string;
  status?: string | null;
  tanggal?: Date | string;
  jumlahJuzMufar?: number | null;
  catatan?: string | null;
}

export interface TahfizhDailyStatus {
  sabaq: OperationalStatus;
  sabqi: OperationalStatus;
  manzil: OperationalStatus;
  mufar: OperationalStatus;
  isHariEfektif: boolean;
  sudahSetorHariIni: boolean;
  actualDailyMufarJuz?: number;
  targetDailyMufarJuz?: number;
}

export interface DetermineTahfizhDailyStatusParams {
  refDate?: Date;
  validSetoranToday: SetoranSummaryItem[];
  posisiTerakhirHalaman: number;
  isHalamanTerakhirParsial?: boolean;
  targetDailyMufarJuz?: number | null;
  actualDailyMufarJuz?: number | null;
  isMufarApplicable?: boolean;
  hasValidSabaqThisWeek?: boolean;
}

/**
 * Menentukan apakah tanggal referensi merupakan hari efektif monitoring Tahfizh (Senin–Jumat di zona waktu WITA).
 * WITA = UTC+8.
 * 0 = Ahad, 6 = Sabtu -> false.
 * 1..5 = Senin..Jumat -> true.
 */
export function isHariEfektifTahfizh(date: Date = new Date()): boolean {
  const witaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const day = witaTime.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Menentukan status operasional harian 4 komponen Tahfizh santri (SABAQ, SABQI, MANZIL, MUFAR).
 */
export function determineTahfizhDailyStatus(
  params: DetermineTahfizhDailyStatusParams
): TahfizhDailyStatus {
  const refDate = params.refDate || new Date();
  const isEffective = isHariEfektifTahfizh(refDate);

  // Filter out any cancelled setoran
  const activeSetoran = (params.validSetoranToday || []).filter(
    (s) => s && s.status !== "DIBATALKAN"
  );

  const hasSabaq = activeSetoran.some((s) => s.jenis === "SABAQ");
  const hasSabqi = activeSetoran.some((s) => s.jenis === "SABQI");
  const hasManzil = activeSetoran.some((s) => s.jenis === "MANZIL");
  const hasMufar = activeSetoran.some((s) => s.jenis === "MUFAR");

  const sudahSetorHariIni = hasSabaq || hasSabqi || hasManzil || hasMufar;

  // Cek apakah santri sudah khatam halaman 604
  const isKhatam = (params.posisiTerakhirHalaman || 0) >= 604;

  // Hitung volume actual MUFAR hari ini: LOCKED CONTRACT jumlahJuzMufar adalah satu-satunya source of truth
  // Record MUFAR dengan jumlahJuzMufar null TIDAK BOLEH difabrikasi sebagai 1 juz atau diparse dari catatan
  const calculatedActualMufar = activeSetoran
    .filter((s) => s.jenis === "MUFAR")
    .reduce((sum, s) => {
      if (typeof s.jumlahJuzMufar === "number" && !isNaN(s.jumlahJuzMufar) && s.jumlahJuzMufar > 0) {
        return sum + s.jumlahJuzMufar;
      }
      return sum;
    }, 0);

  const actualDailyMufarJuz = params.actualDailyMufarJuz !== undefined && params.actualDailyMufarJuz !== null
    ? params.actualDailyMufarJuz
    : calculatedActualMufar;

  // Target MUFAR harian kanonikal: HANYA berasal dari completed Juz Mushaf Madinah & Tier Resmi
  // TargetSantri frequency (5/20 kali) TIDAK BOLEH dijadikan volume juz harian
  const completedJuz = getCompletedJuzCount(
    params.posisiTerakhirHalaman || 0,
    params.isHalamanTerakhirParsial
  );
  const canonicalDailyMufarTarget = getDailyMufarTargetJuz(completedJuz);

  const targetDailyMufarJuz =
    params.targetDailyMufarJuz ?? canonicalDailyMufarTarget;

  const isMufarApplicable =
    params.isMufarApplicable ?? targetDailyMufarJuz > 0;

  if (!isEffective) {
    // Akhir pekan (Sabtu & Ahad): Bukan hari pokok monitoring Tahfizh
    // Setoran yang masuk tetap diapresiasi SELESAI, yang belum menyetor berstatus TIDAK_BERLAKU
    return {
      sabaq: hasSabaq ? "SELESAI" : "TIDAK_BERLAKU",
      sabqi: hasSabqi ? "SELESAI" : "TIDAK_BERLAKU",
      manzil: hasManzil ? "SELESAI" : "TIDAK_BERLAKU",
      mufar: actualDailyMufarJuz > 0 ? "SELESAI" : "TIDAK_BERLAKU",
      isHariEfektif: false,
      sudahSetorHariIni,
      actualDailyMufarJuz,
      targetDailyMufarJuz,
    };
  }

  // Hari efektif (Senin–Jumat):
  // 1. SABAQ: Hafalan baru. Jika khatam -> TIDAK_BERLAKU. Jika belum -> BELUM_SELESAI / SELESAI
  let sabaqStatus: OperationalStatus;
  if (hasSabaq) {
    sabaqStatus = "SELESAI";
  } else if (isKhatam) {
    sabaqStatus = "TIDAK_BERLAKU";
  } else {
    sabaqStatus = "BELUM_SELESAI";
  }

  // 2. SABQI: Murojaah sepekan (bersumber dari SABAQ valid pekan berjalan sejak Senin WITA)
  let sabqiStatus: OperationalStatus;
  if (hasSabqi) {
    sabqiStatus = "SELESAI";
  } else if (params.hasValidSabaqThisWeek === false) {
    // Santri belum memiliki setoran SABAQ sah pekan berjalan -> SABQI belum applicable, bukan kegagalan
    sabqiStatus = "TIDAK_BERLAKU";
  } else {
    sabqiStatus = "BELUM_SELESAI";
  }

  // 3. MANZIL: Murojaah hafalan lama, dipantau independen dari Sabaq dan Sabqi
  const manzilStatus: OperationalStatus = hasManzil ? "SELESAI" : "BELUM_SELESAI";

  // 4. MUFAR: Evaluasi volume aktual vs target harian
  let mufarStatus: OperationalStatus;
  if (targetDailyMufarJuz <= 0 || !isMufarApplicable) {
    mufarStatus = "TIDAK_BERLAKU";
  } else if (actualDailyMufarJuz >= targetDailyMufarJuz) {
    mufarStatus = "SELESAI";
  } else {
    mufarStatus = "BELUM_SELESAI";
  }

  return {
    sabaq: sabaqStatus,
    sabqi: sabqiStatus,
    manzil: manzilStatus,
    mufar: mufarStatus,
    isHariEfektif: true,
    sudahSetorHariIni,
    actualDailyMufarJuz,
    targetDailyMufarJuz,
  };
}
