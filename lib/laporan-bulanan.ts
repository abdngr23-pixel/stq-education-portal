import { KategoriCapaian, JenisUjiHafalan } from "@prisma/client";

/**
 * Standar Mushaf Madinah: 1 Juz = 20 Halaman
 */
export const HALAMAN_PER_JUZ = 20;

/**
 * Ambang batas minimum 7 komponen non-tahfizh per bulan
 */
export const TARGET_MIN_KOMPONEN: Record<KategoriCapaian, { target: number; satuan: string; label: string }> = {
  HAFALAN_HADITS: { target: 4, satuan: "Hadits", label: "Hafalan Hadits" },
  HAFALAN_MUFRODAT: { target: 12, satuan: "Kosakata", label: "Mufrodat (B. Arab)" },
  HAFALAN_VOCABULARY: { target: 12, satuan: "Vocab", label: "Vocabulary (B. Inggris)" },
  SHOLAT_TAHAJJUD: { target: 15, satuan: "Malam", label: "Sholat Tahajjud" },
  SHOLAT_DHUHA: { target: 15, satuan: "Pagi", label: "Sholat Dhuha" },
  PUASA_SUNNAH: { target: 6, satuan: "Hari", label: "Puasa Sunnah" },
  LITERASI: { target: 80, satuan: "Halaman", label: "Literasi Kitab/Buku" },
};

/**
 * Konversi akumulasi halaman ke format "X Juz Y Halaman"
 * Contoh: 45 halaman = 2 Juz 5 Halaman
 */
export function konversiHalamanKeJuz(totalHalaman: number): {
  juz: number;
  sisaHalaman: number;
  label: string;
} {
  const safeHalaman = Math.max(0, Math.round(totalHalaman));
  const juz = Math.floor(safeHalaman / HALAMAN_PER_JUZ);
  const sisaHalaman = safeHalaman % HALAMAN_PER_JUZ;

  let label = "";
  if (juz > 0 && sisaHalaman > 0) {
    label = `${juz} Juz ${sisaHalaman} Halaman`;
  } else if (juz > 0) {
    label = `${juz} Juz`;
  } else {
    label = `${sisaHalaman} Halaman`;
  }

  return { juz, sisaHalaman, label };
}

/**
 * Menentukan indeks pekan (1, 2, 3, atau 4) dari tanggal dalam bulan berjalan
 * - Hari 1-7: Pekan 1
 * - Hari 8-14: Pekan 2
 * - Hari 15-21: Pekan 3
 * - Hari 22+: Pekan 4
 */
export function getPekanDariTanggal(date: Date): 1 | 2 | 3 | 4 {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

/**
 * Hitung kepatuhan target mingguan & bulanan untuk Sabaq (halaman)
 * Mendukung modal awal halaman (HBL) santri dan kalkulasi akumulasi pintar
 */
export function hitungCapaianSabaq(
  realisasiHalaman: { p1: number; p2: number; p3: number; p4: number },
  targetBulananHalaman: number,
  modalAwalHalaman: number = 0
): {
  totalHalaman: number;
  modalAwalHalaman: number;
  akumulasiTotalHalaman: number;
  konversi: { juz: number; sisaHalaman: number; label: string };
  konversiAkumulasi: { juz: number; sisaHalaman: number; label: string };
  persentase: number;
  isTercapai: boolean;
} {
  const safeModal = Math.max(0, Math.round(modalAwalHalaman));
  const totalHalaman =
    realisasiHalaman.p1 + realisasiHalaman.p2 + realisasiHalaman.p3 + realisasiHalaman.p4;
  const akumulasiTotalHalaman = safeModal + totalHalaman;
  const konversi = konversiHalamanKeJuz(totalHalaman);
  const konversiAkumulasi = konversiHalamanKeJuz(akumulasiTotalHalaman);
  const target = Math.max(1, targetBulananHalaman);
  const persentase = Math.min(200, parseFloat(((totalHalaman / target) * 100).toFixed(1)));
  const isTercapai = persentase >= 100;

  return {
    totalHalaman,
    modalAwalHalaman: safeModal,
    akumulasiTotalHalaman,
    konversi,
    konversiAkumulasi,
    persentase,
    isTercapai,
  };
}

/**
 * Fitur Pintar Otomatis: Hitung Akumulasi Setoran Sabaq Santri
 * Berdasarkan standar Mushaf Madinah: 1 Juz = 20 Halaman.
 * Parameter utama hafalan adalah HALAMAN.
 *
 * Contoh Riil Lapangan (Muhammad Fardhan):
 * - Modal Hafalan Awal: 317 Halaman (15 Juz 17 Halaman)
 * - Pekan 1: +3 Halaman
 * - Pekan 2: +3 Halaman
 * - Pekan 3: +3 Halaman
 * - Pekan 4: +7 Halaman
 * - Total Tambahan Bulan Ini: 16 Halaman
 * - Total Akumulasi Terkini: 333 Halaman
 * - Fitur Pintar Otomatis Mengonversi: 16 Juz 13 Halaman (333 / 20 = 16 sisa 13)
 */
export function hitungAkumulasiSabaqSantri(params: {
  modalAwalHalaman: number;
  pekan: { p1: number; p2: number; p3: number; p4: number };
  targetBulananHalaman?: number;
}): {
  modalAwalHalaman: number;
  konversiAwal: { juz: number; sisaHalaman: number; label: string };
  tambahanBulanIni: number;
  konversiTambahan: { juz: number; sisaHalaman: number; label: string };
  totalAkumulasiHalaman: number;
  konversiAkumulasi: { juz: number; sisaHalaman: number; label: string };
  persentaseTarget: number;
  isTercapai: boolean;
} {
  const modalAwal = Math.max(0, Math.round(params.modalAwalHalaman));
  const p1 = Math.max(0, Number(params.pekan.p1) || 0);
  const p2 = Math.max(0, Number(params.pekan.p2) || 0);
  const p3 = Math.max(0, Number(params.pekan.p3) || 0);
  const p4 = Math.max(0, Number(params.pekan.p4) || 0);
  const tambahanBulanIni = p1 + p2 + p3 + p4;
  const totalAkumulasiHalaman = modalAwal + tambahanBulanIni;

  const target = Math.max(1, params.targetBulananHalaman || 20);
  const persentaseTarget = Math.min(200, parseFloat(((tambahanBulanIni / target) * 100).toFixed(1)));
  const isTercapai = persentaseTarget >= 100;

  return {
    modalAwalHalaman: modalAwal,
    konversiAwal: konversiHalamanKeJuz(modalAwal),
    tambahanBulanIni,
    konversiTambahan: konversiHalamanKeJuz(tambahanBulanIni),
    totalAkumulasiHalaman,
    konversiAkumulasi: konversiHalamanKeJuz(totalAkumulasiHalaman),
    persentaseTarget,
    isTercapai,
  };
}

/**
 * Hitung kepatuhan frekuensi per pekan untuk Sabqi, Manzil, Mufar
 */
export function hitungKepatuhanFrekuensi(
  realisasiFrekuensi: { p1: number; p2: number; p3: number; p4: number },
  targetBulananFrekuensi: number,
  ambangKepatuhanPercent: number = 90.0
): {
  totalFrekuensi: number;
  persentase: number;
  isPatuh: boolean;
} {
  const totalFrekuensi =
    realisasiFrekuensi.p1 + realisasiFrekuensi.p2 + realisasiFrekuensi.p3 + realisasiFrekuensi.p4;
  const target = Math.max(1, targetBulananFrekuensi);
  const persentase = parseFloat(((totalFrekuensi / target) * 100).toFixed(1));
  const isPatuh = persentase >= ambangKepatuhanPercent;

  return { totalFrekuensi, persentase, isPatuh };
}

/**
 * Validasi ketuntasan 7 komponen non-tahfizh dengan carry-over HBL
 */
export function evaluasiCapaianNonTahfizh(
  kategori: KategoriCapaian,
  hbl: number,
  pekan: { p1: number; p2: number; p3: number; p4: number },
  customTargetMin?: number
): {
  hbl: number;
  penambahanBulanIni: number;
  totalKumulatif: number;
  targetMin: number;
  isTuntas: boolean;
  statusLabel: string;
} {
  const targetMin = customTargetMin || TARGET_MIN_KOMPONEN[kategori].target;
  const penambahanBulanIni = pekan.p1 + pekan.p2 + pekan.p3 + pekan.p4;
  const totalKumulatif = hbl + penambahanBulanIni;

  // Untuk hadits, mufrodat, vocab: dinilai dari penambahan bulan berjalan
  // Untuk ibadah (tahajjud, dhuha, puasa, literasi): dinilai dari aktivitas bulan ini
  const isTuntas = penambahanBulanIni >= targetMin;
  const statusLabel = isTuntas
    ? `Tuntas (${penambahanBulanIni}/${targetMin})`
    : `Belum Tuntas (${penambahanBulanIni}/${targetMin})`;

  return {
    hbl,
    penambahanBulanIni,
    totalKumulatif,
    targetMin,
    isTuntas,
    statusLabel,
  };
}

/**
 * Generator ringkasan teks otomatis Tasmi' & Sima'an
 * Pola Excel: "Telah melakukan N kali Simaan, M kali Tasmi' (Rata-rata Nilai: X)"
 */
export function generateRingkasanTasmiSimaan(
  riwayat: Array<{ jenis: JenisUjiHafalan; nilai: number; predikat?: string }>
): {
  countTasmi: number;
  countSimaan: number;
  rataRataNilai: number;
  ringkasanTeks: string;
} {
  const countTasmi = riwayat.filter((r) => r.jenis === "TASMI").length;
  const countSimaan = riwayat.filter((r) => r.jenis === "SIMAAN").length;

  if (riwayat.length === 0) {
    return {
      countTasmi: 0,
      countSimaan: 0,
      rataRataNilai: 0,
      ringkasanTeks: "Belum melaksanakan ujian Tasmi' atau Sima'an bulan ini.",
    };
  }

  const sumNilai = riwayat.reduce((acc, curr) => acc + curr.nilai, 0);
  const rataRataNilai = parseFloat((sumNilai / riwayat.length).toFixed(1));

  let predikatGlobal = "Mumtaz";
  if (rataRataNilai < 60) predikatGlobal = "Dhoif";
  else if (rataRataNilai < 70) predikatGlobal = "Maqbul";
  else if (rataRataNilai < 85) predikatGlobal = "Jayyid";
  else if (rataRataNilai < 92) predikatGlobal = "Jayyid Jiddan";

  const ringkasanTeks = `Telah melakukan ${countSimaan} kali Sima'an dan ${countTasmi} kali Tasmi' dengan rata-rata nilai ${rataRataNilai} (${predikatGlobal}).`;

  return {
    countTasmi,
    countSimaan,
    rataRataNilai,
    ringkasanTeks,
  };
}
