import { KategoriCapaian, JenisUjiHafalan } from "@prisma/client";
import { getWitaDateString } from "@/lib/wita-date";

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
  const safeHalaman = Math.max(0, Number(totalHalaman) || 0);
  const juz = Math.floor(safeHalaman / HALAMAN_PER_JUZ);
  const rawSisa = safeHalaman - juz * HALAMAN_PER_JUZ;
  const sisaHalaman = parseFloat(rawSisa.toFixed(1));

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
  const witaStr = getWitaDateString(date);
  const day = witaStr ? parseInt(witaStr.split("-")[2], 10) : date.getDate();
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
  targetBulananHalaman: number | null | undefined,
  modalAwalHalaman: number = 0
): {
  totalHalaman: number;
  modalAwalHalaman: number;
  akumulasiTotalHalaman: number;
  konversi: { juz: number; sisaHalaman: number; label: string };
  konversiAkumulasi: { juz: number; sisaHalaman: number; label: string };
  persentase: number;
  isTercapai: boolean;
  hasTarget: boolean;
} {
  const safeModal = Math.max(0, Number(modalAwalHalaman) || 0);
  const totalHalaman = parseFloat(
    (
      (Number(realisasiHalaman.p1) || 0) +
      (Number(realisasiHalaman.p2) || 0) +
      (Number(realisasiHalaman.p3) || 0) +
      (Number(realisasiHalaman.p4) || 0)
    ).toFixed(1)
  );
  const akumulasiTotalHalaman = parseFloat((safeModal + totalHalaman).toFixed(1));
  const konversi = konversiHalamanKeJuz(totalHalaman);
  const konversiAkumulasi = konversiHalamanKeJuz(akumulasiTotalHalaman);

  if (targetBulananHalaman === null || targetBulananHalaman === undefined || targetBulananHalaman <= 0) {
    return {
      totalHalaman,
      modalAwalHalaman: safeModal,
      akumulasiTotalHalaman,
      konversi,
      konversiAkumulasi,
      persentase: 0,
      isTercapai: false,
      hasTarget: false,
    };
  }

  const target = targetBulananHalaman;
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
    hasTarget: true,
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
  targetBulananHalaman?: number | null;
}): {
  modalAwalHalaman: number;
  konversiAwal: { juz: number; sisaHalaman: number; label: string };
  tambahanBulanIni: number;
  konversiTambahan: { juz: number; sisaHalaman: number; label: string };
  totalAkumulasiHalaman: number;
  konversiAkumulasi: { juz: number; sisaHalaman: number; label: string };
  persentaseTarget: number;
  isTercapai: boolean;
  hasTarget: boolean;
} {
  const modalAwal = Math.max(0, Number(params.modalAwalHalaman) || 0);
  const p1 = Math.max(0, Number(params.pekan.p1) || 0);
  const p2 = Math.max(0, Number(params.pekan.p2) || 0);
  const p3 = Math.max(0, Number(params.pekan.p3) || 0);
  const p4 = Math.max(0, Number(params.pekan.p4) || 0);
  const tambahanBulanIni = parseFloat((p1 + p2 + p3 + p4).toFixed(1));
  const totalAkumulasiHalaman = parseFloat((modalAwal + tambahanBulanIni).toFixed(1));

  const hasTarget = typeof params.targetBulananHalaman === "number" && params.targetBulananHalaman > 0;
  let persentaseTarget = 0;
  let isTercapai = false;

  if (hasTarget && params.targetBulananHalaman) {
    const target = params.targetBulananHalaman;
    persentaseTarget = Math.min(200, parseFloat(((tambahanBulanIni / target) * 100).toFixed(1)));
    isTercapai = persentaseTarget >= 100;
  }

  return {
    modalAwalHalaman: modalAwal,
    konversiAwal: konversiHalamanKeJuz(modalAwal),
    tambahanBulanIni,
    konversiTambahan: konversiHalamanKeJuz(tambahanBulanIni),
    totalAkumulasiHalaman,
    konversiAkumulasi: konversiHalamanKeJuz(totalAkumulasiHalaman),
    persentaseTarget,
    isTercapai,
    hasTarget,
  };
}

/**
 * Hitung kepatuhan frekuensi per pekan untuk Sabqi, Manzil, Mufar
 */
export function hitungKepatuhanFrekuensi(
  realisasiFrekuensi: { p1: number; p2: number; p3: number; p4: number },
  targetBulananFrekuensi: number | null | undefined,
  ambangKepatuhanPercent: number = 90.0
): {
  totalFrekuensi: number;
  persentase: number;
  isPatuh: boolean;
  hasTarget: boolean;
} {
  const totalFrekuensi =
    realisasiFrekuensi.p1 + realisasiFrekuensi.p2 + realisasiFrekuensi.p3 + realisasiFrekuensi.p4;

  if (targetBulananFrekuensi === null || targetBulananFrekuensi === undefined) {
    return {
      totalFrekuensi,
      persentase: 0,
      isPatuh: false,
      hasTarget: false,
    };
  }

  const target = Math.max(1, targetBulananFrekuensi);
  const persentase = parseFloat(((totalFrekuensi / target) * 100).toFixed(1));
  const isPatuh = persentase >= ambangKepatuhanPercent;

  return { totalFrekuensi, persentase, isPatuh, hasTarget: true };
}

export {
  getStartOfWeekWITA,
  hitungRekomendasiSabaqiPekan,
  type SetoranSabaqItem,
  type RekomendasiSabaqi,
} from "@/lib/sabaqi";
import { hitungRekomendasiSabaqiPekan, type SetoranSabaqItem } from "@/lib/sabaqi";

export interface ReferensiSabaqiKumulatif {
  hariNama: string;       // e.g. "Senin", "Selasa", dll.
  polaKeterangan: string; // Sumber keterangan resmi
  halamanMulai: number;
  halamanSelesai: number;
  totalHalaman: number;
  labelLengkap: string;
  hasSabaq?: boolean;
}

/**
 * Menghitung rentang referensi Sabaqi kumulatif pekanan (Senin - Jumat)
 * Berdasarkan Dokumen Acuan Program Tahfidz STQ DUC 2026:
 * Murni dihitung dari setoran SABAQ nyata santri yang tersimpan pada pekan berjalan (WITA).
 * Tidak menambah halaman secara artifisial berdasarkan faktor hari kerja.
 */
export function hitungReferensiSabaqiKumulatif(params: {
  tanggal?: Date;
  setoranSabaqList?: SetoranSabaqItem[];
  modalAwalHalaman?: number;
  pekanBerjalanSabaqHalaman?: number;
}): ReferensiSabaqiKumulatif {
  const date = params.tanggal || new Date();
  const dayNames = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayIndex = date.getDay();
  const hariNama = dayNames[dayIndex] || "Senin";

  // Perhitungan resmi murni berbasis SABAQ nyata tersimpan pada pekan berjalan (WITA)
  if (params.setoranSabaqList && params.setoranSabaqList.length > 0) {
    const rec = hitungRekomendasiSabaqiPekan(params.setoranSabaqList, date);
    return {
      hariNama,
      polaKeterangan: rec.sumberKeterangan,
      halamanMulai: rec.halamanMulai,
      halamanSelesai: rec.halamanSelesai,
      totalHalaman: rec.totalHalaman,
      labelLengkap: rec.labelLengkap,
      hasSabaq: rec.hasSabaq,
    };
  }

  // Tanpa SABAQ nyata pekan berjalan: tidak ada rentang halaman palsu (hasSabaq = false)
  return {
    hariNama,
    polaKeterangan: "Belum ada Sabaq tersimpan pada pekan ini.",
    halamanMulai: 0,
    halamanSelesai: 0,
    totalHalaman: 0,
    labelLengkap: "Belum ada Sabaq tersimpan pada pekan ini.",
    hasSabaq: false,
  };
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

export interface SabqiManzilReportSantri {
  tahfizh?: {
    sabqi?: {
      targetBulanan?: number | null;
      totalFrekuensi?: number;
      hasTarget?: boolean;
    };
    manzil?: {
      targetBulanan?: number | null;
      totalFrekuensi?: number;
      hasTarget?: boolean;
    };
  };
}

/**
 * Hitung rata-rata kepatuhan muroja'ah (Sabqi & Manzil) murni dari data rekapitulasi santri
 * Tanpa angka rekaan/fallback fiktif (seperti 94.2%).
 *
 * Aturan Integritas Data:
 * - Jika ada target muroja'ah valid: hitung (total frekuensi riil / total target) * 100
 * - Jika seluruh frekuensi riil = 0: menghasilkan persentase 0% (tidak boleh menampilkan angka fiktif)
 * - Jika tidak ada data target/komponen berlaku (denominator = 0 atau belum ada target):
 *   menghasilkan label "Belum ada data", persentase: null
 */
export function hitungRataRataKepatuhanMurojaah(
  rekapSantri: SabqiManzilReportSantri[] | null | undefined
): {
  persentase: number | null;
  label: string;
  totalRealisasi: number;
  totalTarget: number;
  hasApplicableData: boolean;
} {
  if (!rekapSantri || rekapSantri.length === 0) {
    return {
      persentase: null,
      label: "Belum ada data",
      totalRealisasi: 0,
      totalTarget: 0,
      hasApplicableData: false,
    };
  }

  let totalRealisasi = 0;
  let totalTarget = 0;
  let countApplicable = 0;

  for (const item of rekapSantri) {
    const sbqi = item.tahfizh?.sabqi;
    if (sbqi && sbqi.hasTarget && typeof sbqi.targetBulanan === "number" && sbqi.targetBulanan > 0) {
      totalTarget += sbqi.targetBulanan;
      totalRealisasi += sbqi.totalFrekuensi || 0;
      countApplicable++;
    }
    const mzl = item.tahfizh?.manzil;
    if (mzl && mzl.hasTarget && typeof mzl.targetBulanan === "number" && mzl.targetBulanan > 0) {
      totalTarget += mzl.targetBulanan;
      totalRealisasi += mzl.totalFrekuensi || 0;
      countApplicable++;
    }
  }

  if (countApplicable === 0 || totalTarget === 0) {
    return {
      persentase: null,
      label: "Belum ada data",
      totalRealisasi: 0,
      totalTarget: 0,
      hasApplicableData: false,
    };
  }

  const persentase = parseFloat(((totalRealisasi / totalTarget) * 100).toFixed(1));

  return {
    persentase,
    label: `${persentase}%`,
    totalRealisasi,
    totalTarget,
    hasApplicableData: true,
  };
}

/**
 * Mendeteksi apakah data capaian bulanan non-tahfizh merupakan data sintetis bawaan seed
 * (+4 Hadits, +12 Mufrodat, +12 Vocab, 16 Tahajjud, 16 Dhuha, 7 Puasa, 85 Literasi seragam tanpa catatan)
 */
export function isSyntheticMutabaahSeed(
  records: Array<{
    kategori: string;
    pekan1?: number;
    pekan2?: number;
    pekan3?: number;
    pekan4?: number;
    catatan?: string | null;
  }>
): boolean {
  if (!records || records.length === 0) return false;
  const getK = (cat: string) => records.find((r) => r.kategori === cat);
  const hadits = getK("HAFALAN_HADITS");
  const mufrodat = getK("HAFALAN_MUFRODAT");
  const vocab = getK("HAFALAN_VOCABULARY");
  const tahajjud = getK("SHOLAT_TAHAJJUD");
  const dhuha = getK("SHOLAT_DHUHA");
  const puasa = getK("PUASA_SUNNAH");
  const literasi = getK("LITERASI");

  const isSeed =
    hadits?.pekan1 === 1 && hadits?.pekan2 === 1 && hadits?.pekan3 === 1 && hadits?.pekan4 === 1 &&
    mufrodat?.pekan1 === 3 && mufrodat?.pekan2 === 3 && mufrodat?.pekan3 === 3 && mufrodat?.pekan4 === 3 &&
    vocab?.pekan1 === 3 && vocab?.pekan2 === 3 && vocab?.pekan3 === 3 && vocab?.pekan4 === 3 &&
    tahajjud?.pekan1 === 4 && tahajjud?.pekan2 === 4 && tahajjud?.pekan3 === 4 && tahajjud?.pekan4 === 4 &&
    dhuha?.pekan1 === 4 && dhuha?.pekan2 === 4 && dhuha?.pekan3 === 4 && dhuha?.pekan4 === 4 &&
    puasa?.pekan1 === 2 && puasa?.pekan2 === 2 && puasa?.pekan3 === 2 && puasa?.pekan4 === 1 &&
    literasi?.pekan1 === 20 && literasi?.pekan2 === 20 && literasi?.pekan3 === 25 && literasi?.pekan4 === 20 &&
    !hadits?.catatan && !mufrodat?.catatan && !tahajjud?.catatan;

  return Boolean(isSeed);
}

