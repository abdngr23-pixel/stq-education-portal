/**
 * Centralized WITA (Waktu Indonesia Tengah / Asia/Makassar - UTC+8) Date Engine
 * STQ Education Portal
 *
 * Sesuai temuan A14 & A15 Audit STQ 2026-09-08:
 * Memastikan tanggal operasional presensi, laporan, dan dokumen
 * konsisten di zona waktu WITA (Asia/Makassar), mencegah pergeseran
 * tanggal jika diakses sebelum pukul 08.00 WITA (00.00 UTC).
 */

export const WITA_TIMEZONE = "Asia/Makassar";

/**
 * Mengembalikan string tanggal "YYYY-MM-DD" dalam zona waktu Asia/Makassar (WITA)
 */
export function getTodayWITADateString(date: Date = new Date()): string {
  // en-CA format menghasilkan format standar YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Mengonversi tanggal WITA "YYYY-MM-DD" menjadi objek Date UTC awal hari (00:00:00+08:00)
 */
export function parseWITADate(witaDateStr: string): Date {
  const parts = witaDateStr.split("-");
  if (parts.length !== 3) {
    throw new Error(`Format tanggal tidak valid (harus YYYY-MM-DD): ${witaDateStr}`);
  }
  return new Date(`${witaDateStr}T00:00:00+08:00`);
}

/**
 * Menghasilkan batas awal dan akhir hari dalam UTC untuk query rentang database Prisma
 */
export function getWITADayRange(witaDateStr: string): { startOfDayUTC: Date; endOfDayUTC: Date } {
  const parts = witaDateStr.split("-");
  if (parts.length !== 3) {
    throw new Error(`Format tanggal tidak valid: ${witaDateStr}`);
  }
  const startOfDayUTC = new Date(`${witaDateStr}T00:00:00.000+08:00`);
  const endOfDayUTC = new Date(`${witaDateStr}T23:59:59.999+08:00`);
  return { startOfDayUTC, endOfDayUTC };
}

/**
 * Format tanggal ramah pengguna berbahasa Indonesia dalam zona waktu Asia/Makassar
 */
export function formatWITADate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  }
): string {
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: WITA_TIMEZONE,
  }).format(date);
}

/**
 * Menentukan apakah dua timestamp berada pada tanggal kalender yang sama di WITA
 */
export function isSameWITADay(d1: Date, d2: Date): boolean {
  return getTodayWITADateString(d1) === getTodayWITADateString(d2);
}
