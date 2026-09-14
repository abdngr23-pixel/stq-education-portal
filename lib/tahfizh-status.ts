/**
 * Tahfizh Operational Status Engine
 * STQ Darul Ulum Cendekia
 *
 * Aturan Bisnis Resmi (PR #6):
 * 1. Hari efektif monitoring Tahfizh adalah Senin–Jumat (WITA, UTC+8).
 * 2. Sabtu (tidak ada kegiatan pokok Tahfizh) dan Ahad (libur) tidak boleh membuat santri berstatus gagal.
 *    Jika santri tidak menyetor pada akhir pekan, status bernilai TIDAK_BERLAKU (bukan BELUM_SELESAI).
 * 3. Status Tahfizh dipisah minimal 4 jenis: SABAQ, SABQI, MANZIL, MUFAR.
 * 4. Tiga kondisi operasional: SELESAI, BELUM_SELESAI, TIDAK_BERLAKU.
 * 5. SABAQ: Jika santri telah khatam mencapai halaman 604, tidak ada kewajiban Sabaq baru (TIDAK_BERLAKU).
 * 6. SABQI: Dipantau terpisah, berasal dari sabaq pekan berjalan.
 * 7. MANZIL: Dipantau terpisah dari Sabaq dan Sabqi. Setoran Manzil tidak membuat Sabaq/Sabqi selesai.
 * 8. MUFAR: Conditional/applicable. Jika belum berlaku, status TIDAK_BERLAKU (bukan kegagalan).
 * 9. Setoran dengan status DIBATALKAN tidak dihitung dan tidak membuat status menjadi SELESAI.
 */

export type OperationalStatus = "SELESAI" | "BELUM_SELESAI" | "TIDAK_BERLAKU";

export interface SetoranSummaryItem {
  jenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR" | string;
  status?: string | null;
  tanggal?: Date | string;
}

export interface TahfizhDailyStatus {
  sabaq: OperationalStatus;
  sabqi: OperationalStatus;
  manzil: OperationalStatus;
  mufar: OperationalStatus;
  isHariEfektif: boolean;
  sudahSetorHariIni: boolean;
}

export interface DetermineTahfizhDailyStatusParams {
  refDate?: Date;
  validSetoranToday: SetoranSummaryItem[];
  posisiTerakhirHalaman: number;
  targetMufar?: {
    targetBulanan?: number | null;
    targetPekanan?: number | null;
  } | null;
  isMufarApplicable?: boolean;
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

  // Cek applicability MUFAR:
  // Berlaku jika targetMufar ada dan nilainya > 0, atau parameter isMufarApplicable eksplisit true
  const isMufarApplicable = Boolean(
    params.isMufarApplicable ||
      (params.targetMufar &&
        ((params.targetMufar.targetBulanan ?? 0) > 0 ||
          (params.targetMufar.targetPekanan ?? 0) > 0))
  );

  if (!isEffective) {
    // Akhir pekan (Sabtu & Ahad): Bukan hari pokok monitoring Tahfizh
    // Setoran yang masuk tetap diapresiasi SELESAI, yang belum menyetor berstatus TIDAK_BERLAKU (bukan kegagalan)
    return {
      sabaq: hasSabaq ? "SELESAI" : "TIDAK_BERLAKU",
      sabqi: hasSabqi ? "SELESAI" : "TIDAK_BERLAKU",
      manzil: hasManzil ? "SELESAI" : "TIDAK_BERLAKU",
      mufar: hasMufar ? "SELESAI" : "TIDAK_BERLAKU",
      isHariEfektif: false,
      sudahSetorHariIni,
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

  // 2. SABQI: Murojaah sepekan
  const sabqiStatus: OperationalStatus = hasSabqi ? "SELESAI" : "BELUM_SELESAI";

  // 3. MANZIL: Murojaah hafalan lama, dipantau independen dari Sabaq dan Sabqi
  const manzilStatus: OperationalStatus = hasManzil ? "SELESAI" : "BELUM_SELESAI";

  // 4. MUFAR: Conditional applicability
  let mufarStatus: OperationalStatus;
  if (hasMufar) {
    mufarStatus = "SELESAI";
  } else if (isMufarApplicable) {
    mufarStatus = "BELUM_SELESAI";
  } else {
    mufarStatus = "TIDAK_BERLAKU";
  }

  return {
    sabaq: sabaqStatus,
    sabqi: sabqiStatus,
    manzil: manzilStatus,
    mufar: mufarStatus,
    isHariEfektif: true,
    sudahSetorHariIni,
  };
}
