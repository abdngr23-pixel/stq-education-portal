// Modul Utilitas Penentu Waktu WITA (Asia/Makassar, UTC+8)
// Standar Resmi STQ Darul Ulum Cendekia untuk Batas Operasional Pesantren

const witaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Makassar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Format tanggal lokal di zona waktu Asia/Makassar (WITA / UTC+8) dalam format YYYY-MM-DD.
 */
export function getWitaDateString(date?: Date | string | number | null): string {
  if (arguments.length === 0) {
    return witaDateFormatter.format(new Date());
  }
  if (date === null || date === undefined || date === "") return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return witaDateFormatter.format(d);
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD WITA.
 * Menerima customDate opsional untuk keperluan pengujian.
 */
export function getTodayWITADateString(customDate?: Date | string | number | null): string {
  return getWitaDateString(customDate ?? new Date());
}

/**
 * Parse string YYYY-MM-DD menjadi awal hari (00:00:00.000 WITA) dalam objek Date UTC.
 * 00:00 WITA = 16:00 UTC hari sebelumnya (karena WITA = UTC+8).
 */
export function parseWITADate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Jam 00:00:00 WITA setara dengan jam 16:00:00 UTC hari sebelumnya
  // Contoh: 2026-09-11 00:00 WITA -> Date.UTC(2026, 8, 11, -8, 0, 0) -> 2026-09-10 16:00:00Z
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
}

/**
 * Mengembalikan rentang UTC [startOfDayUTC, endOfDayUTC] untuk tanggal YYYY-MM-DD WITA tertentu.
 */
export function getWITADayRange(dateStr: string): { startOfDayUTC: Date; endOfDayUTC: Date } {
  const startOfDayUTC = parseWITADate(dateStr);
  const endOfDayUTC = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startOfDayUTC, endOfDayUTC };
}

/**
 * Memeriksa apakah dua tanggal berada pada hari kalender yang sama di zona WITA.
 */
export function isSameDayWita(
  date1: Date | string | number | null | undefined,
  date2: Date | string | number | null | undefined
): boolean {
  if (!date1 || !date2) return false;
  const str1 = getWitaDateString(date1);
  const str2 = getWitaDateString(date2);
  if (!str1 || !str2) return false;
  return str1 === str2;
}

/**
 * Memeriksa apakah tanggal yang diberikan adalah hari ini di zona WITA.
 */
export function isTodayWita(date: Date | string | number | null | undefined, now?: Date): boolean {
  if (!date) return false;
  const todayStr = getTodayWITADateString(now);
  const targetStr = getWitaDateString(date);
  if (!targetStr) return false;
  return targetStr === todayStr;
}

/**
 * Memeriksa apakah tanggal yang diberikan adalah kemarin di zona WITA.
 */
export function isYesterdayWita(date: Date | string | number | null | undefined, now?: Date): boolean {
  if (!date) return false;
  const base = now ? new Date(now) : new Date();
  const yesterday = new Date(base.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getWitaDateString(yesterday);
  const targetStr = getWitaDateString(date);
  if (!targetStr) return false;
  return targetStr === yesterdayStr;
}

const witaIndonesianDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Format tanggal dalam bahasa Indonesia di zona waktu Asia/Makassar (WITA / UTC+8).
 * Contoh output: "12 September 2026"
 */
export function formatWitaDateIndonesian(date?: Date | string | number | null): string {
  if (date === null || date === undefined || date === "") {
    return witaIndonesianDateFormatter.format(new Date());
  }
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return witaIndonesianDateFormatter.format(d);
}
