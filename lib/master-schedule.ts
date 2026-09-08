/**
 * Master Schedule & Alur Pendidikan Halaqoh STQ
 * Single Source of Truth
 *
 * Sesuai temuan A16 Audit STQ 2026-09-08:
 * Menyelaraskan seluruh jadwal sesi halaqoh, shalat fardhu, dan ibadah sunnah
 * dengan Buku Panduan Kurikulum Pesantren STQ.
 */

export interface SesiItem {
  id: string;
  label: string;
  short: string;
  waktuMulai: string;
  waktuSelesai: string;
  kategori: "SHALAT" | "SUNNAH" | "HALAQOH";
  target?: string;
  desc?: string;
  icon?: string;
}

export const MASTER_SESI_SHALAT: SesiItem[] = [
  { id: "Sholat Subuh", label: "Shalat Subuh (04.45 WITA)", short: "Subuh", waktuMulai: "04:45", waktuSelesai: "05:30", kategori: "SHALAT" },
  { id: "Sholat Dzuhur", label: "Shalat Dzuhur (12.15 WITA)", short: "Dzuhur", waktuMulai: "12:15", waktuSelesai: "13:00", kategori: "SHALAT" },
  { id: "Sholat Ashar", label: "Shalat Ashar (15.30 WITA)", short: "Ashar", waktuMulai: "15:30", waktuSelesai: "16:00", kategori: "SHALAT" },
  { id: "Sholat Maghrib", label: "Shalat Maghrib (18.15 WITA)", short: "Maghrib", waktuMulai: "18:15", waktuSelesai: "19:00", kategori: "SHALAT" },
  { id: "Sholat Isya", label: "Shalat Isya (19.30 WITA)", short: "Isya", waktuMulai: "19:30", waktuSelesai: "20:00", kategori: "SHALAT" },
];

export const MASTER_SESI_SUNNAH: SesiItem[] = [
  {
    id: "Sholat Tahajjud",
    label: "Sholat Tahajjud & Qiyamul Lail (03.15–04.15 WITA)",
    short: "Tahajjud",
    waktuMulai: "03:15",
    waktuSelesai: "04:15",
    kategori: "SUNNAH",
    target: "15 Malam/Bulan",
    desc: "Qiyamul Lail & sholat tahajjud santri di asrama & masjid",
    icon: "🌙",
  },
  {
    id: "Sholat Dhuha",
    label: "Sholat Dhuha (07.15–08.00 WITA)",
    short: "Dhuha",
    waktuMulai: "07:15",
    waktuSelesai: "08:00",
    kategori: "SUNNAH",
    target: "15 Pagi/Bulan",
    desc: "Shalat sunnah Dhuha pagi sebelum jam KBM / halaqoh",
    icon: "☀️",
  },
  {
    id: "Puasa Sunnah",
    label: "Puasa Sunnah (Senin & Kamis / Ayyamul Bidh)",
    short: "Puasa Sunnah",
    waktuMulai: "04:45",
    waktuSelesai: "18:15",
    kategori: "SUNNAH",
    target: "6 Hari/Bulan",
    desc: "Puasa sunnah Senin-Kamis serta Ayyamul Bidh",
    icon: "🍃",
  },
];

/**
 * Master Jadwal Halaqoh sesuai Alur Pendidikan & Standar Kurikulum Pesantren:
 * - Sesi 1: 05.45–07.00 WITA (Sabaq Pagi)
 * - Sesi 2: 09.00–10.30 WITA (Sabqi Pagi)
 * - Sesi 3: 13.00–15.00 WITA (Halaqoh Siang & Pemantapan)
 * - Sesi 4: 16.00–17.00 WITA (Manzil Sore)
 * - Sesi 5: 20.00–21.30 WITA (Muroja'ah Mandiri & Setoran Malam)
 */
export const MASTER_SESI_HALAQOH: SesiItem[] = [
  {
    id: "Halaqah Ba'da Shubuh",
    label: "Halaqah 1: Ba'da Shubuh (05.45–07.00 WITA)",
    short: "Halaqah Shubuh (Sabaq)",
    waktuMulai: "05:45",
    waktuSelesai: "07:00",
    kategori: "HALAQOH",
    desc: "Setoran hafalan baru (Sabaq) pagi",
  },
  {
    id: "Halaqah Pagi (Dhuha)",
    label: "Halaqah 2: Pagi / Dhuha (09.00–10.30 WITA)",
    short: "Halaqah Dhuha (Sabqi)",
    waktuMulai: "09:00",
    waktuSelesai: "10:30",
    kategori: "HALAQOH",
    desc: "Muroja'ah hafalan baru (Sabqi)",
  },
  {
    id: "Halaqah Siang",
    label: "Halaqah 3: Siang (13.00–15.00 WITA)",
    short: "Halaqah Siang",
    waktuMulai: "13:00",
    waktuSelesai: "15:00",
    kategori: "HALAQOH",
    desc: "Pemantapan hafalan dan tahsin santri",
  },
  {
    id: "Halaqah Ba'da Ashar",
    label: "Halaqah 4: Ba'da Ashar (16.00–17.00 WITA)",
    short: "Halaqah Ashar (Manzil)",
    waktuMulai: "16:00",
    waktuSelesai: "17:00",
    kategori: "HALAQOH",
    desc: "Muroja'ah hafalan lama (Manzil)",
  },
  {
    id: "Halaqah Ba'da Isya",
    label: "Halaqah 5: Ba'da Isya (20.00–21.30 WITA)",
    short: "Halaqah Isya (Murojaah Mandiri)",
    waktuMulai: "20:00",
    waktuSelesai: "21:30",
    kategori: "HALAQOH",
    desc: "Muroja'ah mandiri dan persiapan sabaq esok hari",
  },
];
