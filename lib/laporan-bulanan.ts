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
 * Target Mufar Dinamis berdasarkan Dokumen Acuan Program Tahfidz STQ DUC 2026.
 * Diukur dalam jumlah Juz per HARI berdasarkan TOTAL hafalan santri saat ini:
 * - 1-5 Juz   : 1 juz/hari
 * - 6-10 Juz  : 2 juz/hari
 * - 11-15 Juz : 3 juz/hari
 * - 16-20 Juz : 4 juz/hari
 * - 21-30 Juz : 5 juz/hari
 *
 * @param totalHafalanJuz - Jumlah juz total hafalan santri saat ini
 * @returns Target Mufar dalam satuan juz per hari (1 sampai 5)
 */
export function hitungTargetMufar(totalHafalanJuz: number): number {
  const juz = Math.max(0, Math.floor(totalHafalanJuz));
  if (juz <= 0) return 1;
  if (juz <= 5) return 1;
  if (juz <= 10) return 2;
  if (juz <= 15) return 3;
  if (juz <= 20) return 4;
  return 5; // 21-30 Juz
}

export interface ReferensiSabaqiKumulatif {
  hariNama: string;       // e.g. "Senin", "Selasa", "Rabu", "Kamis", "Jumat"
  polaKeterangan: string; // e.g. "Hafalan hari ini saja", "Kumulatif Senin–Rabu"
  halamanMulai: number;
  halamanSelesai: number;
  totalHalaman: number;
  labelLengkap: string;
}

/**
 * Menghitung rentang referensi Sabaqi kumulatif harian (Senin - Jumat)
 * Berdasarkan Dokumen Acuan Program Tahfidz STQ DUC 2026:
 * - Senin : murojaah hafalan hari Senin saja
 * - Selasa: murojaah hafalan Senin - Selasa
 * - Rabu  : murojaah hafalan Senin - Rabu
 * - Kamis : murojaah hafalan Senin - Kamis
 * - Jumat : murojaah hafalan Senin - Jumat (seluruh pekan berjalan)
 */
export function hitungReferensiSabaqiKumulatif(params: {
  tanggal?: Date;
  modalAwalHalaman: number;
  pekanBerjalanSabaqHalaman?: number;
}): ReferensiSabaqiKumulatif {
  const date = params.tanggal || new Date();
  const dayIndex = date.getDay(); // 0: Ahad, 1: Senin, 2: Selasa, 3: Rabu, 4: Kamis, 5: Jumat, 6: Sabtu

  let hariNama = "Senin";
  let factorHari = 1;
  const totalHariPekan = 5;

  if (dayIndex === 1) {
    hariNama = "Senin";
    factorHari = 1;
  } else if (dayIndex === 2) {
    hariNama = "Selasa";
    factorHari = 2;
  } else if (dayIndex === 3) {
    hariNama = "Rabu";
    factorHari = 3;
  } else if (dayIndex === 4) {
    hariNama = "Kamis";
    factorHari = 4;
  } else if (dayIndex === 5) {
    hariNama = "Jumat";
    factorHari = 5;
  } else {
    // Akhir pekan (Sabtu/Ahad): evaluasi review kumulatif penuh 5 hari
    hariNama = dayIndex === 6 ? "Sabtu (Review)" : "Ahad (Review)";
    factorHari = 5;
  }

  const sabaqPekan = Math.max(1, params.pekanBerjalanSabaqHalaman || 5);
  // Hitung akumulasi halaman dari hari Senin s.d. hari input saat ini
  const halamanMurojaah = Math.max(1, Math.round((sabaqPekan / totalHariPekan) * factorHari));
  
  const halamanMulai = Math.max(1, params.modalAwalHalaman + 1);
  const halamanSelesai = Math.min(604, halamanMulai + halamanMurojaah - 1);
  const totalHalaman = Math.max(1, halamanSelesai - halamanMulai + 1);

  const polaKeterangan =
    dayIndex === 1
      ? "Hafalan baru hari Senin saja"
      : dayIndex === 5
      ? "Kumulatif seluruh pekan berjalan (Senin–Jumat)"
      : `Kumulatif hafalan baru Senin–${hariNama}`;

  const labelLengkap = `Hlm ${halamanMulai}–${halamanSelesai} (${totalHalaman} Hlm, ${polaKeterangan})`;

  return {
    hariNama,
    polaKeterangan,
    halamanMulai,
    halamanSelesai,
    totalHalaman,
    labelLengkap,
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

/**
 * 6 Master Halaqoh Resmi STQ Darul Ulum Cendekia
 */
export const MASTER_HALAQOH_LIST = [
  { id: "HLQ-0001", code: "HLQ-0001", nama: "Halaqoh Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan)", pembina: "Ust. Razan Mufli, S.Pd", staffId: "STF-003", role: "MT" },
  { id: "HLQ-0002", code: "HLQ-0002", nama: "Halaqoh Ust. Kamal (Mudhabbir)", pembina: "Ust. Kamal", staffId: "STF-006", role: "PH" },
  { id: "HLQ-0003", code: "HLQ-0003", nama: "Halaqoh Ust. Rizaldi (Mudhabbir)", pembina: "Ust. Rizaldi", staffId: "STF-007", role: "PH" },
  { id: "HLQ-0004", code: "HLQ-0004", nama: "Halaqoh Ust. Abi Hudzaifah (Mudhabbir)", pembina: "Ust. Abi Hudzaifah", staffId: "STF-008", role: "PH" },
  { id: "HLQ-0005", code: "HLQ-0005", nama: "Halaqoh Ust. Alwan (Mudhabbir)", pembina: "Ust. Alwan", staffId: "STF-009", role: "PH" },
  { id: "HLQ-0006", code: "HLQ-0006", nama: "Halaqoh Ustadzah Lisa Dwina Fitri (Musyrifah Putri)", pembina: "Ustadzah Lisa Dwina Fitri", staffId: "STF-005", role: "MT" },
] as const;

/**
 * 57 Santri Riil STQ Darul Ulum Cendekia Terdistribusi ke 6 Halaqoh
 */
export const MASTER_SANTRI_57 = [
  // 1. Halaqoh Ust. Razan Mufli, S.Pd (5 santri)
  { id: "cm_santri_1", nis: "SAN-0001", nama: "Obama Ozearld Egberted Turizqi", kelas: "9A Takhossus", halaqohId: "HLQ-0001", halaqohNama: "Halaqoh Ust. Razan Mufli, S.Pd", modalAwal: 420, p1: 6, p2: 6, p3: 6, p4: 6 },
  { id: "cm_santri_2", nis: "SAN-0002", nama: "Muhammad Fardhan", kelas: "9A Takhossus", halaqohId: "HLQ-0001", halaqohNama: "Halaqoh Ust. Razan Mufli, S.Pd", modalAwal: 317, p1: 3, p2: 3, p3: 3, p4: 7 },
  { id: "cm_santri_3", nis: "SAN-0003", nama: "Muh. Fauzan", kelas: "9A Takhossus", halaqohId: "HLQ-0001", halaqohNama: "Halaqoh Ust. Razan Mufli, S.Pd", modalAwal: 360, p1: 5, p2: 5, p3: 6, p4: 5 },
  { id: "cm_santri_4", nis: "SAN-0004", nama: "Khubaib", kelas: "9A Takhossus", halaqohId: "HLQ-0001", halaqohNama: "Halaqoh Ust. Razan Mufli, S.Pd", modalAwal: 420, p1: 5, p2: 5, p3: 6, p4: 6 },
  { id: "cm_santri_5", nis: "SAN-0005", nama: "Abd. Riziq Ardi", kelas: "9A Takhossus", halaqohId: "HLQ-0001", halaqohNama: "Halaqoh Ust. Razan Mufli, S.Pd", modalAwal: 420, p1: 5, p2: 6, p3: 6, p4: 6 },

  // 2. Halaqoh Ust. Kamal (9 santri)
  { id: "cm_santri_6", nis: "SAN-0006", nama: "Muhammad Amirul Hanif Al-Fatih", kelas: "8A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 240, p1: 3, p2: 3, p3: 3, p4: 3 },
  { id: "cm_santri_7", nis: "SAN-0007", nama: "Muh. Riski Isral Wijaya", kelas: "8A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 250, p1: 4, p2: 3, p3: 4, p4: 4 },
  { id: "cm_santri_8", nis: "SAN-0008", nama: "Muhammad Ridwan Kamil", kelas: "8A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 190, p1: 3, p2: 2, p3: 3, p4: 2 },
  { id: "cm_santri_9", nis: "SAN-0009", nama: "Ahmad Ripai", kelas: "8A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 190, p1: 3, p2: 3, p3: 2, p4: 2 },
  { id: "cm_santri_10", nis: "SAN-0010", nama: "Muhammad Mikhael", kelas: "8A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 195, p1: 3, p2: 3, p3: 2, p4: 2 },
  { id: "cm_santri_11", nis: "SAN-0011", nama: "Arya Idris", kelas: "7A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 95, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_12", nis: "SAN-0012", nama: "Muhammad Ghozy Ma'Arif", kelas: "7A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 98, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_13", nis: "SAN-0013", nama: "Muhammad Walied", kelas: "7A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 95, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_14", nis: "SAN-0014", nama: "Hilmy Mutawakkil Al Muntashir", kelas: "8A Takhossus", halaqohId: "HLQ-0002", halaqohNama: "Halaqoh Ust. Kamal", modalAwal: 280, p1: 5, p2: 4, p3: 5, p4: 4 },

  // 3. Halaqoh Ust. Rizaldi (10 santri)
  { id: "cm_santri_15", nis: "SAN-0015", nama: "Achmad Sufiyan", kelas: "8B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 155, p1: 3, p2: 3, p3: 3, p4: 2 },
  { id: "cm_santri_16", nis: "SAN-0016", nama: "Muh. Rifki Pria Herman", kelas: "8B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 150, p1: 3, p2: 3, p3: 3, p4: 2 },
  { id: "cm_santri_17", nis: "SAN-0017", nama: "Muh Fadhlih Aksa", kelas: "7B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 75, p1: 2, p2: 2, p3: 2, p4: 2 },
  { id: "cm_santri_18", nis: "SAN-0018", nama: "Muhammad Rizky Ashari", kelas: "7B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 90, p1: 3, p2: 2, p3: 3, p4: 2 },
  { id: "cm_santri_19", nis: "SAN-0019", nama: "Hafidzh Asri", kelas: "7B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 55, p1: 2, p2: 2, p3: 2, p4: 2 },
  { id: "cm_santri_20", nis: "SAN-0020", nama: "Qonit Su'Adiy", kelas: "7B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 95, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_21", nis: "SAN-0021", nama: "Raja Muddin", kelas: "8B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 115, p1: 3, p2: 3, p3: 2, p4: 3 },
  { id: "cm_santri_22", nis: "SAN-0022", nama: "M. Alief Pratama", kelas: "8B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 135, p1: 3, p2: 3, p3: 3, p4: 2 },
  { id: "cm_santri_23", nis: "SAN-0023", nama: "Muh Fadhlan Aksa", kelas: "7B Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 95, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_24", nis: "SAN-0024", nama: "Muhammad Azaky", kelas: "9A Takhossus", halaqohId: "HLQ-0003", halaqohNama: "Halaqoh Ust. Rizaldi", modalAwal: 295, p1: 5, p2: 5, p3: 5, p4: 6 },

  // 4. Halaqoh Ust. Abi Hudzaifah (10 santri)
  { id: "cm_santri_25", nis: "SAN-0025", nama: "Syahrul Haq", kelas: "7A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 95, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_26", nis: "SAN-0026", nama: "Iksanul Haq", kelas: "7A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 75, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_27", nis: "SAN-0027", nama: "M. Alamsyah", kelas: "7A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 55, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_28", nis: "SAN-0028", nama: "Ahmad Fausan Al Farisi", kelas: "8A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 115, p1: 3, p2: 2, p3: 3, p4: 2 },
  { id: "cm_santri_29", nis: "SAN-0029", nama: "Abdul Karim", kelas: "7A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 55, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_30", nis: "SAN-0030", nama: "Muhammad Asfa Ilham Ridwan", kelas: "8A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 115, p1: 3, p2: 3, p3: 3, p4: 2 },
  { id: "cm_santri_31", nis: "SAN-0031", nama: "Khaerul Azam Abu Bakar", kelas: "8A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 115, p1: 3, p2: 3, p3: 2, p4: 3 },
  { id: "cm_santri_32", nis: "SAN-0032", nama: "Muh. Alif Ihsan", kelas: "8A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 115, p1: 3, p2: 3, p3: 3, p4: 2 },
  { id: "cm_santri_33", nis: "SAN-0033", nama: "Muh. Imran Maulana Sahid", kelas: "7A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 75, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_34", nis: "SAN-0034", nama: "Affan Garatta", kelas: "9A Takhossus", halaqohId: "HLQ-0004", halaqohNama: "Halaqoh Ust. Abi Hudzaifah", modalAwal: 275, p1: 5, p2: 4, p3: 5, p4: 4 },

  // 5. Halaqoh Ust. Alwan (13 santri)
  { id: "cm_santri_35", nis: "SAN-0035", nama: "Laode Hisyam Arqana", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 55, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_36", nis: "SAN-0036", nama: "Xavier Omar Syarif Hidayatullah", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 35, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_37", nis: "SAN-0037", nama: "Muhammad Syafiq", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 35, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_38", nis: "SAN-0038", nama: "Andi Muhammad Ghazi Al Fatih", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 55, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_39", nis: "SAN-0039", nama: "Zulkifli", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 35, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_40", nis: "SAN-0040", nama: "M. Dzul Jalaali Walikhrom Rf", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 15, p1: 1, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_41", nis: "SAN-0041", nama: "Abdullah Khairun Nizham", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 55, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_42", nis: "SAN-0042", nama: "Andi Muh Rizky S", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 15, p1: 1, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_43", nis: "SAN-0043", nama: "Muhammad Rifky Firjatullah", kelas: "8B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 95, p1: 3, p2: 2, p3: 2, p4: 2 },
  { id: "cm_santri_44", nis: "SAN-0044", nama: "Rahmatullah S.", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 35, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_45", nis: "SAN-0045", nama: "Ade Naufal", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 55, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_46", nis: "SAN-0046", nama: "Hafiz Abd Aziz", kelas: "8B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 95, p1: 3, p2: 2, p3: 2, p4: 2 },
  { id: "cm_santri_47", nis: "SAN-0047", nama: "Badar Fayyadh Nabil", kelas: "7B Takhossus", halaqohId: "HLQ-0005", halaqohNama: "Halaqoh Ust. Alwan", modalAwal: 15, p1: 1, p2: 1, p3: 1, p4: 1 },

  // 6. Halaqoh Ustadzah Lisa Dwina Fitri (10 santri)
  { id: "cm_santri_48", nis: "SAN-0048", nama: "Habiba Asri", kelas: "9C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 410, p1: 5, p2: 5, p3: 5, p4: 6 },
  { id: "cm_santri_49", nis: "SAN-0049", nama: "Meisya Arrahma", kelas: "9C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 335, p1: 4, p2: 4, p3: 4, p4: 4 },
  { id: "cm_santri_50", nis: "SAN-0050", nama: "Rahmawati", kelas: "8C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 215, p1: 3, p2: 3, p3: 3, p4: 3 },
  { id: "cm_santri_51", nis: "SAN-0051", nama: "Annisa Az Zahrah A.", kelas: "8C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 235, p1: 4, p2: 3, p3: 3, p4: 3 },
  { id: "cm_santri_52", nis: "SAN-0052", nama: "Aisyah Muthmainnah", kelas: "8C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 195, p1: 3, p2: 3, p3: 2, p4: 3 },
  { id: "cm_santri_53", nis: "SAN-0053", nama: "Nur Aqsa", kelas: "7C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 55, p1: 2, p2: 2, p3: 1, p4: 1 },
  { id: "cm_santri_54", nis: "SAN-0054", nama: "Sri Ramadhaniyanti", kelas: "7C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 35, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_55", nis: "SAN-0055", nama: "Farhana", kelas: "7C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 75, p1: 2, p2: 2, p3: 2, p4: 1 },
  { id: "cm_santri_56", nis: "SAN-0056", nama: "Rushaifa Rustam", kelas: "7C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 35, p1: 2, p2: 1, p3: 1, p4: 1 },
  { id: "cm_santri_57", nis: "SAN-0057", nama: "Naafilah Kaltsum Aslan", kelas: "7C Putri", halaqohId: "HLQ-0006", halaqohNama: "Halaqoh Ustadzah Lisa Dwina Fitri", modalAwal: 95, p1: 3, p2: 2, p3: 3, p4: 2 },
];

/**
 * Generator Laporan Bulanan Mock Realistis berbasis 57 Santri & 6 Halaqoh
 */
export function generateLaporanBulananMock(
  halaqohId: string,
  bulan: number = 9,
  tahunAjaran: string = "2026/2027"
) {
  const isAll = !halaqohId || halaqohId.toUpperCase() === "ALL";
  const matchedHalaqoh = MASTER_HALAQOH_LIST.find(
    (h) => h.id === halaqohId || h.code === halaqohId || h.nama.toLowerCase().includes(halaqohId.toLowerCase())
  );

  const halaqohMeta = isAll
    ? {
        id: "ALL",
        nama: "Semua Halaqoh (Rekap Gabungan Seluruh Pesantren)",
        pembina: "Seluruh Pembina & Musyrif STQ DUC",
        tahunAjaran,
      }
    : {
        id: matchedHalaqoh ? matchedHalaqoh.id : (halaqohId || "HLQ-0001"),
        nama: matchedHalaqoh ? matchedHalaqoh.nama : "Halaqoh Ust. Razan Mufli, S.Pd",
        pembina: matchedHalaqoh ? matchedHalaqoh.pembina : "Ust. Razan Mufli, S.Pd",
        tahunAjaran,
      };

  const santriFiltered = isAll
    ? MASTER_SANTRI_57
    : MASTER_SANTRI_57.filter(
        (s) => s.halaqohId === halaqohMeta.id || s.halaqohNama.toLowerCase().includes((matchedHalaqoh?.nama || halaqohId).toLowerCase())
      );

  const rekapSantri = santriFiltered.map((s) => {
    const sabaqPages = { p1: s.p1, p2: s.p2, p3: s.p3, p4: s.p4 };
    const targetSabaq = 20;
    const rekapSabaq = hitungCapaianSabaq(sabaqPages, targetSabaq, s.modalAwal);

    const sabqiFreq = { p1: 4, p2: 4, p3: 4, p4: 4 };
    const rekapSabqi = hitungKepatuhanFrekuensi(sabqiFreq, 16, 90.0);

    const manzilFreq = { p1: 4, p2: 4, p3: 4, p4: 4 };
    const rekapManzil = hitungKepatuhanFrekuensi(manzilFreq, 16, 90.0);

    const totalJuzSantri = rekapSabaq.konversiAkumulasi.juz || 1;
    const targetMufarJuzHarian = hitungTargetMufar(totalJuzSantri);
    const mufarFreq = { p1: 5, p2: 5, p3: 5, p4: 5 };
    const rekapMufar = hitungKepatuhanFrekuensi(mufarFreq, 20, 90.0);

    const nonTahfizh = [
      { kategori: "HAFALAN_HADITS" as const, label: "Hafalan Hadits", satuan: "Hadits", hbl: 78, p1: 1, p2: 1, p3: 1, p4: 1, penambahanBulanIni: 4, totalKumulatif: 82, targetMin: 4, isTuntas: true, statusLabel: "Tuntas (4/4)" },
      { kategori: "HAFALAN_MUFRODAT" as const, label: "Mufrodat (B. Arab)", satuan: "Kosakata", hbl: 250, p1: 3, p2: 3, p3: 3, p4: 3, penambahanBulanIni: 12, totalKumulatif: 262, targetMin: 12, isTuntas: true, statusLabel: "Tuntas (12/12)" },
      { kategori: "HAFALAN_VOCABULARY" as const, label: "Vocabulary (B. Inggris)", satuan: "Vocab", hbl: 250, p1: 3, p2: 3, p3: 3, p4: 3, penambahanBulanIni: 12, totalKumulatif: 262, targetMin: 12, isTuntas: true, statusLabel: "Tuntas (12/12)" },
      { kategori: "SHOLAT_TAHAJJUD" as const, label: "Sholat Tahajjud", satuan: "Malam", hbl: 0, p1: 4, p2: 4, p3: 4, p4: 4, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true, statusLabel: "Tuntas (16/15)" },
      { kategori: "SHOLAT_DHUHA" as const, label: "Sholat Dhuha", satuan: "Pagi", hbl: 0, p1: 4, p2: 4, p3: 4, p4: 4, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true, statusLabel: "Tuntas (16/15)" },
      { kategori: "PUASA_SUNNAH" as const, label: "Puasa Sunnah", satuan: "Hari", hbl: 0, p1: 2, p2: 2, p3: 1, p4: 2, penambahanBulanIni: 7, totalKumulatif: 7, targetMin: 6, isTuntas: true, statusLabel: "Tuntas (7/6)" },
      { kategori: "LITERASI" as const, label: "Literasi Kitab/Buku", satuan: "Halaman", hbl: 0, p1: 20, p2: 25, p3: 20, p4: 20, penambahanBulanIni: 85, totalKumulatif: 85, targetMin: 80, isTuntas: true, statusLabel: "Tuntas (85/80)" },
    ];

    const tasmiSimaan = {
      countTasmi: 2,
      countSimaan: 1,
      rataRataNilai: 92.5,
      ringkasanTeks: "Telah melakukan 1 kali Sima'an dan 2 kali Tasmi' dengan rata-rata nilai 92.5 (Mumtaz).",
      riwayat: [
        { jenis: "SIMAAN" as const, juz: 30, nilai: 95, predikat: "MUMTAZ" as const, tanggal: new Date() },
        { jenis: "TASMI" as const, juz: 22, nilai: 90, predikat: "MUMTAZ" as const, tanggal: new Date() },
      ],
    };

    return {
      santri: {
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        halaqoh: s.halaqohNama,
      },
      tahfizh: {
        sabaq: {
          targetBulanan: targetSabaq,
          pekan: sabaqPages,
          ...rekapSabaq,
        },
        sabqi: {
          targetBulanan: 16,
          pekan: sabqiFreq,
          ...rekapSabqi,
        },
        manzil: {
          targetBulanan: 16,
          pekan: manzilFreq,
          ...rekapManzil,
        },
        mufar: {
          targetBulanan: 20,
          targetHarianJuz: targetMufarJuzHarian,
          targetLabel: `${targetMufarJuzHarian} Juz/hari`,
          pekan: mufarFreq,
          ...rekapMufar,
        },
      },
      nonTahfizh,
      tasmiSimaan,
    };
  });

  return {
    halaqoh: halaqohMeta,
    periode: {
      bulan,
      tahunAjaran,
      tahunKalender: 2026,
    },
    rekapSantri,
  };
}

