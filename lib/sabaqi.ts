/**
 * Logika Rekomendasi Sabaqi Berbasis Setoran Nyata Pekan Ini (WITA - Asia/Makassar)
 * STQ Darul Ulum Cendekia
 *
 * Aturan Bisnis Resmi (Section C):
 * 1. Awal pekan dihitung dari Senin 00:00:00 WITA.
 * 2. Mengambil setoran SABAQ santri yang benar-benar tersimpan sejak awal pekan sampai tanggal input.
 * 3. Rentang Sabaqi berasal dari data SABAQ tersebut (min halamanMulai s.d. max halamanSelesai).
 * 4. Jika tidak ada Sabaq baru hari ini/pekan ini, rentang tidak bertambah.
 * 5. Jika belum ada Sabaq pekan berjalan, tampilkan "Belum ada Sabaq tersimpan pada pekan ini."
 *    dan izinkan Musyrif menginput manual dengan catatan wajib.
 */

import { getJuzByPage } from "@/lib/quran-metadata";

export interface SetoranSabaqItem {
  id?: string;
  tanggal: Date | string;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
}

export interface RekomendasiSabaqi {
  hasSabaq: boolean;
  halamanMulai: number;
  halamanSelesai: number;
  totalHalaman: number;
  juzMulai: number;
  juzSelesai: number;
  sumberKeterangan: string;
  labelLengkap: string;
  isManualAllowed: boolean;
}

/**
 * Menentukan batas awal pekan (Senin pukul 00:00:00 WITA) dalam objek UTC Date.
 * WITA = UTC+8.
 */
export function getStartOfWeekWITA(refDate: Date = new Date()): Date {
  const witaTime = new Date(refDate.getTime() + 8 * 60 * 60 * 1000);
  const day = witaTime.getUTCDay(); // 0: Ahad, 1: Senin, ..., 6: Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const mondayWita = new Date(witaTime);
  mondayWita.setUTCDate(witaTime.getUTCDate() + diffToMonday);
  mondayWita.setUTCHours(0, 0, 0, 0);

  return new Date(mondayWita.getTime() - 8 * 60 * 60 * 1000);
}

/**
 * Menghitung rekomendasi Sabaqi murni dari setoran SABAQ nyata pekan berjalan.
 */
export function hitungRekomendasiSabaqiPekan(
  setoranSabaqList: SetoranSabaqItem[],
  refDate: Date = new Date()
): RekomendasiSabaqi {
  const startOfWeek = getStartOfWeekWITA(refDate);

  // Ambil hanya setoran SABAQ yang berada dalam rentang pekan berjalan [startOfWeek, refDate]
  const sabaqPekanIni = setoranSabaqList.filter((s) => {
    const t = new Date(s.tanggal);
    return t >= startOfWeek && t <= refDate;
  });

  if (sabaqPekanIni.length === 0) {
    return {
      hasSabaq: false,
      halamanMulai: 0,
      halamanSelesai: 0,
      totalHalaman: 0,
      juzMulai: 1,
      juzSelesai: 1,
      sumberKeterangan: "Belum ada Sabaq tersimpan pada pekan ini.",
      labelLengkap: "Belum ada Sabaq tersimpan pada pekan ini.",
      isManualAllowed: true,
    };
  }

  let minHalaman = Infinity;
  let maxHalaman = -Infinity;
  let totalHalaman = 0;

  for (const item of sabaqPekanIni) {
    const mul = Number(item.halamanMulai);
    const sel = Number(item.halamanSelesai);
    const jml = Number(item.jumlahHalaman);

    if (mul < minHalaman) minHalaman = mul;
    if (sel > maxHalaman) maxHalaman = sel;
    totalHalaman += jml > 0 ? jml : Math.max(0.5, sel - mul + 1);
  }

  if (minHalaman === Infinity) minHalaman = 1;
  if (maxHalaman === -Infinity) maxHalaman = 1;

  const juzMulai = getJuzByPage(minHalaman);
  const juzSelesai = getJuzByPage(maxHalaman);

  const labelRentang =
    minHalaman === maxHalaman
      ? `Halaman ${minHalaman}`
      : `Halaman ${minHalaman}–${maxHalaman}`;

  return {
    hasSabaq: true,
    halamanMulai: minHalaman,
    halamanSelesai: maxHalaman,
    totalHalaman: parseFloat(totalHalaman.toFixed(1)),
    juzMulai,
    juzSelesai,
    sumberKeterangan: "Berdasarkan setoran Sabaq yang tersimpan pada pekan ini.",
    labelLengkap: `${labelRentang} (${totalHalaman} Hlm) — Berdasarkan setoran Sabaq yang tersimpan pada pekan ini.`,
    isManualAllowed: true,
  };
}
