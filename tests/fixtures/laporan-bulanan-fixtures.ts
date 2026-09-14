/**
 * Test Fixtures & Legacy Mock Generator untuk Pengujian Rekap Laporan Bulanan
 * File ini HANYA digunakan oleh test suite dan TIDAK boleh diimpor oleh kode produksi di lib/ atau app/.
 */

import {
  hitungCapaianSabaq,
  hitungKepatuhanFrekuensi,
} from "../../lib/laporan-bulanan";

/**
 * 6 Master Halaqoh Fixtures untuk Pengujian Unit
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
 * 57 Santri Fixtures untuk Pengujian Unit
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
 * Formula target Mufar legacy untuk keperluan verifikasi fixture uji
 */
export function hitungTargetMufarLegacy(totalHafalanJuz: number): number {
  if (totalHafalanJuz <= 5) return 1;
  if (totalHafalanJuz <= 10) return 2;
  if (totalHafalanJuz <= 15) return 3;
  if (totalHafalanJuz <= 20) return 4;
  return 5;
}

export const hitungTargetMufar = hitungTargetMufarLegacy;

/**
 * Generator Laporan Bulanan Mock khusus test environment
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
    const targetMufarJuzHarian = hitungTargetMufarLegacy(totalJuzSantri);
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
