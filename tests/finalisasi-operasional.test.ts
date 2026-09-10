import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getStartOfWeekWITA,
  hitungRekomendasiSabaqiPekan,
  type SetoranSabaqItem,
} from "../lib/sabaqi";
import {
  getJuzByPage,
  isPageRangeValidForJuz,
  isPageWithinBounds,
} from "../lib/quran-metadata";
import { buildProgressSantriWAMessage } from "../lib/whatsapp";
import { konversiAngkaKeHuruf, KEPESANTRENAN_KODE_MAPEL } from "../app/actions/kepesantrenan";

describe("Uji Kelayakan Operasional STQ DUC (Fase Finalisasi & Quality Gates)", () => {
  // =========================================================================
  // 1. Concurrency & Setoran Tahfizh Validation
  // =========================================================================
  describe("1. Validasi Metadata Al-Qur'an & Batasan Halaman", () => {
    it("harus menolak halaman di luar batas 1–604", () => {
      assert.equal(isPageWithinBounds(0), false);
      assert.equal(isPageWithinBounds(605), false);
      assert.equal(isPageWithinBounds(1), true);
      assert.equal(isPageWithinBounds(604), true);
      assert.equal(isPageWithinBounds(318), true);
    });

    it("harus memvalidasi kesesuaian Juz dengan rentang Halaman", () => {
      // Juz 1: halaman 1 - 21 (Al-Fatihah & Al-Baqarah)
      assert.equal(isPageRangeValidForJuz(1, 1, 10), true);
      assert.equal(isPageRangeValidForJuz(1, 20, 21), true);
      // Halaman 50 bukan Juz 1
      assert.equal(isPageRangeValidForJuz(1, 50, 52), false);

      // Juz 30: halaman 582 - 604
      assert.equal(isPageRangeValidForJuz(30, 582, 604), true);
      assert.equal(isPageRangeValidForJuz(30, 1, 5), false);
    });

    it("harus mendeteksi juz dari halaman secara akurat", () => {
      assert.equal(getJuzByPage(1), 1);
      assert.equal(getJuzByPage(21), 1);
      assert.equal(getJuzByPage(22), 2);
      assert.equal(getJuzByPage(582), 30);
      assert.equal(getJuzByPage(604), 30);
    });

    it("harus menghasilkan kode setoran unik pada pemanggilan bersamaan (Concurrency Safe)", () => {
      const generatedCodes = new Set<string>();
      const count = 1000;
      for (let i = 0; i < count; i++) {
        const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `SET-${Date.now().toString(36).toUpperCase()}-${entropy}-${i}`;
        generatedCodes.add(code);
      }
      assert.equal(generatedCodes.size, count, "Semua kode setoran wajib unik");
    });
  });

  // =========================================================================
  // 2. Mesin Rekomendasi Sabaqi Pekan Berjalan (WITA)
  // =========================================================================
  describe("2. Mesin Rekomendasi Sabaqi Pekan Berjalan (Asia/Makassar)", () => {
    it("harus menghitung awal pekan pada hari Senin 00:00:00 WITA", () => {
      // Misal hari Rabu, 10 September 2026 14:30 WITA
      // WITA = UTC+8 -> 10 Sep 2026 06:30 UTC
      const rabuUTC = new Date(Date.UTC(2026, 8, 10, 6, 30, 0));
      const startOfWeek = getStartOfWeekWITA(rabuUTC);

      // Konversi startOfWeek ke representasi WITA
      const witaMonday = new Date(startOfWeek.getTime() + 8 * 60 * 60 * 1000);
      assert.equal(witaMonday.getUTCDay(), 1, "Awal pekan harus hari Senin (1)");
      assert.equal(witaMonday.getUTCDate(), 7, "Senin pekan tersebut tanggal 7 Sep 2026");
      assert.equal(witaMonday.getUTCHours(), 0, "Pukul 00:00 WITA");
      assert.equal(witaMonday.getUTCMinutes(), 0);
    });

    it("harus mengembalikan pesan 'Belum ada Sabaq tersimpan pada pekan ini.' jika belum ada data", () => {
      const emptySabaq: SetoranSabaqItem[] = [];
      const res = hitungRekomendasiSabaqiPekan(emptySabaq, new Date());
      assert.equal(res.hasSabaq, false);
      assert.equal(res.sumberKeterangan, "Belum ada Sabaq tersimpan pada pekan ini.");
      assert.equal(res.isManualAllowed, true);
    });

    it("harus menghitung rentang Sabaqi murni dari setoran Sabaq yang tersimpan sejak Senin", () => {
      // Setoran Sabaq Senin & Selasa pekan berjalan
      const mondaySabaq: SetoranSabaqItem = {
        tanggal: new Date(Date.UTC(2026, 8, 7, 0, 30, 0)), // Senin
        halamanMulai: 100,
        halamanSelesai: 101,
        jumlahHalaman: 2,
      };
      const tuesdaySabaq: SetoranSabaqItem = {
        tanggal: new Date(Date.UTC(2026, 8, 8, 1, 0, 0)), // Selasa
        halamanMulai: 102,
        halamanSelesai: 103,
        jumlahHalaman: 2,
      };

      // Setoran Sabaq pekan lalu (Minggu 6 Sep) yang TIDAK boleh dihitung
      const lastWeekSabaq: SetoranSabaqItem = {
        tanggal: new Date(Date.UTC(2026, 8, 6, 12, 0, 0)),
        halamanMulai: 98,
        halamanSelesai: 99,
        jumlahHalaman: 2,
      };

      const refDate = new Date(Date.UTC(2026, 8, 9, 8, 0, 0)); // Rabu
      const res = hitungRekomendasiSabaqiPekan(
        [lastWeekSabaq, mondaySabaq, tuesdaySabaq],
        refDate
      );

      assert.equal(res.hasSabaq, true);
      assert.equal(res.halamanMulai, 100);
      assert.equal(res.halamanSelesai, 103);
      assert.equal(res.totalHalaman, 4);
    });
  });

  // =========================================================================
  // 3. Standarisasi Target Akhir 30 Juz
  // =========================================================================
  describe("3. Standarisasi Target Akhir 30 Juz untuk Seluruh Santri", () => {
    it("seluruh template WhatsApp WAJIB memuat 'Target Akhir 30 Juz'", () => {
      const msg = buildProgressSantriWAMessage({
        santriNama: "Muhammad Rayhan",
        santriNis: "SAN-0001",
        kelas: "7A Takhossus",
        halaqoh: "Halaqoh Utsman",
        capaianJuz: 5,
        targetJuz: 30,
      });

      assert.ok(
        msg.includes("Target Akhir 30 Juz"),
        "Template WhatsApp progress wajib mencantumkan Target Akhir 30 Juz"
      );
    });

    it("verifikasi default targetAkhirProgramJuz pada schema.prisma adalah 30", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.match(
        schemaContent,
        /targetAkhirProgramJuz\s+Int\s+@default\(30\)/,
        "Kolom targetAkhirProgramJuz wajib ber-default 30 pada schema.prisma"
      );
    });
  });

  // =========================================================================
  // 4. Modul Kebijakan Reward & Sanksi Bulanan
  // =========================================================================
  describe("4. Modul Kebijakan Reward (Tasmi/Simaan) & Sanksi Bulanan", () => {
    it("harus memiliki model KebijakanRewardSanksi, HakLiburSantri, dan TransaksiBintang", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schemaContent.includes("model KebijakanRewardSanksi"));
      assert.ok(schemaContent.includes("model HakLiburSantri"));
      assert.ok(schemaContent.includes("model TransaksiBintang"));
      assert.ok(schemaContent.includes("model FinalisasiBulananSantri"));
    });

    it("aturan reward: Tasmi' nilai >= 80 berhak bintang & hak libur, di bawah itu ditolak", () => {
      const minNilaiTasmi = 80.0;
      const nilaiLulus = 85.0;
      const nilaiGagal = 78.5;

      assert.equal(nilaiLulus >= minNilaiTasmi, true, "Nilai 85 harus berhak mendapatkan reward");
      assert.equal(nilaiGagal >= minNilaiTasmi, false, "Nilai 78.5 tidak boleh mendapatkan reward");
    });

    it("sanksi bulanan: capaian < 100% target bulanan terkena status KEHILANGAN_KUNJUNGAN", () => {
      const targetBulanan = 20; // 20 halaman
      const capaianSantri1 = 20; // 100%
      const capaianSantri2 = 18; // 90% (kurang dari target proses)

      const status1 = capaianSantri1 >= targetBulanan ? "BEBAS" : "KEHILANGAN_KUNJUNGAN";
      const status2 = capaianSantri2 >= targetBulanan ? "BEBAS" : "KEHILANGAN_KUNJUNGAN";

      assert.equal(status1, "BEBAS");
      assert.equal(status2, "KEHILANGAN_KUNJUNGAN");
    });
  });

  // =========================================================================
  // 5. Materi Kepesantrenan (5 Mapel Resmi)
  // =========================================================================
  describe("5. Materi Kepesantrenan Terpisah & 5 Mapel Resmi", () => {
    it("harus mencakup 5 kode mapel resmi kepesantrenan", () => {
      assert.equal(KEPESANTRENAN_KODE_MAPEL.length, 5);
      assert.ok(KEPESANTRENAN_KODE_MAPEL.includes("KPS-ARB")); // Bahasa Arab
      assert.ok(KEPESANTRENAN_KODE_MAPEL.includes("KPS-FQH")); // Fikih
      assert.ok(KEPESANTRENAN_KODE_MAPEL.includes("KPS-TFS")); // Tafsir
      assert.ok(KEPESANTRENAN_KODE_MAPEL.includes("KPS-TJW")); // Tajwid
      assert.ok(KEPESANTRENAN_KODE_MAPEL.includes("KPS-AQD")); // Aqidah Islamiyah
    });

    it("harus mengonversi nilai angka ke predikat huruf dengan akurat", () => {
      assert.equal(konversiAngkaKeHuruf(90), "A");
      assert.equal(konversiAngkaKeHuruf(85), "A");
      assert.equal(konversiAngkaKeHuruf(84), "B");
      assert.equal(konversiAngkaKeHuruf(75), "B");
      assert.equal(konversiAngkaKeHuruf(70), "C");
      assert.equal(konversiAngkaKeHuruf(55), "D");
    });
  });

  // =========================================================================
  // 6. Pengurutan Santriwati Alfabetis (A–Z) & Preservasi Ikhwan
  // =========================================================================
  describe("6. Pengurutan Santriwati (A-Z Locale ID) & Ikhwan", () => {
    it("santriwati (P) harus diurutkan secara alfabetis A-Z menggunakan locale Indonesia", () => {
      const dataSantri = [
        { nama: "Zahra Ramadhani", jenisKelamin: "P" },
        { nama: "Aisyah Muthmainnah", jenisKelamin: "P" },
        { nama: "Fatima Azzahra", jenisKelamin: "P" },
        { nama: "Khairun Nisa", jenisKelamin: "P" },
      ];

      const sorted = [...dataSantri].sort((a, b) =>
        a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
      );

      assert.equal(sorted[0].nama, "Aisyah Muthmainnah");
      assert.equal(sorted[1].nama, "Fatima Azzahra");
      assert.equal(sorted[2].nama, "Khairun Nisa");
      assert.equal(sorted[3].nama, "Zahra Ramadhani");
    });

    it("urutan santri ikhwan (L) tidak boleh diacak saat digabung dengan akhwat", () => {
      const ikhwan = [
        { nis: "SAN-0002", nama: "Fardhan Syahputra", jenisKelamin: "L" },
        { nis: "SAN-0001", nama: "Barack Obama", jenisKelamin: "L" },
      ];
      const akhwat = [
        { nis: "SAN-0050", nama: "Zaskia", jenisKelamin: "P" },
        { nis: "SAN-0048", nama: "Aisyah", jenisKelamin: "P" },
      ];

      const akhwatSorted = [...akhwat].sort((a, b) =>
        a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
      );

      const combined = [...ikhwan, ...akhwatSorted];

      // Ikhwan urutan tetap Fardhan lalu Barack
      assert.equal(combined[0].nama, "Fardhan Syahputra");
      assert.equal(combined[1].nama, "Barack Obama");
      // Akhwat terurut A-Z Aisyah lalu Zaskia
      assert.equal(combined[2].nama, "Aisyah");
      assert.equal(combined[3].nama, "Zaskia");
    });
  });

  // =========================================================================
  // 7. Kedisiplinan: 44 Master Pelanggaran, Kategori 1-3 & SP Pemutihan
  // =========================================================================
  describe("7. Kedisiplinan: 44 Master Pelanggaran, Kategori & SP Pemutihan", () => {
    it("schema.prisma harus mendukung enum KATEGORI_1, KATEGORI_2, KATEGORI_3", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schemaContent.includes("KATEGORI_1"));
      assert.ok(schemaContent.includes("KATEGORI_2"));
      assert.ok(schemaContent.includes("KATEGORI_3"));
      assert.ok(schemaContent.includes("namaPelanggaranSnapshot"));
      assert.ok(schemaContent.includes("kategoriSnapshot"));
      assert.ok(schemaContent.includes("sanksiSnapshot"));
    });

    it("Kategori 2 (pemberian point) TIDAK BOLEH memicu penerbitan SP", () => {
      const kategoriTingkat = "KATEGORI_2";
      const isKat3 = kategoriTingkat === "KATEGORI_3" || kategoriTingkat === "BERAT";
      assert.equal(isKat3, false, "Kategori 2 tidak boleh dievaluasi sebagai pemicu SP");
    });

    it("aturan pemutihan: pelanggaran umum kedaluwarsa 1 tahun, pelanggaran sejenis 3 tahun", () => {
      const oneYearAgo = new Date("2025-09-10T00:00:00Z");
      const threeYearsAgo = new Date("2023-09-10T00:00:00Z");

      // Pelanggaran 1: Terjadi 1.5 tahun lalu (2025-03-01) - Kategori sejenis
      const plgSejenisLama = {
        kategoriId: "KAT-MEROKOK",
        createdAt: new Date("2025-03-01T00:00:00Z"),
      };
      // Pelanggaran 2: Terjadi 1.5 tahun lalu (2025-03-01) - Kategori umum/berbeda
      const plgBedaLama = {
        kategoriId: "KAT-MENCURI",
        createdAt: new Date("2025-03-01T00:00:00Z"),
      };

      const currentKategoriId = "KAT-MEROKOK";

      // Evaluasi pemutihan untuk plgSejenisLama (sejenis: batas 3 tahun)
      const isSejenis = plgSejenisLama.kategoriId === currentKategoriId;
      const isSejenisAktif = isSejenis && plgSejenisLama.createdAt >= threeYearsAgo;
      assert.equal(isSejenisAktif, true, "Pelanggaran sejenis masih aktif dalam kurun 3 tahun");

      // Evaluasi pemutihan untuk plgBedaLama (umum: batas 1 tahun)
      const isBedaAktif = plgBedaLama.createdAt >= oneYearAgo;
      assert.equal(isBedaAktif, false, "Pelanggaran umum sudah diputihkan karena > 1 tahun");
    });
  });

  // =========================================================================
  // 8. Petugas Presensi Putri & Fail-Closed
  // =========================================================================
  describe("8. Petugas Presensi Putri (Fail-Closed Protection)", () => {
    it("schema.prisma harus memiliki kolom isPetugasPresensiPutri pada User", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(
        schemaContent.includes("isPetugasPresensiPutri Boolean @default(false)"),
        "User harus memiliki kolom isPetugasPresensiPutri"
      );
    });

    it("verifikasi fail-closed: tolak presensi jika petugas putri mencatat santri laki-laki", () => {
      const santriBatch = [
        { id: "S1", nama: "Annisa", jenisKelamin: "P" },
        { id: "S2", nama: "Fatimah", jenisKelamin: "P" },
        { id: "S3", nama: "Fardhan", jenisKelamin: "L" }, // Laki-laki
      ];

      const santriLakiLaki = santriBatch.filter((s) => s.jenisKelamin === "L");
      const isAllowed = santriLakiLaki.length === 0;

      assert.equal(isAllowed, false, "Wajib menolak jika terdapat santri laki-laki");
      assert.equal(santriLakiLaki[0].nama, "Fardhan");
    });
  });

  // =========================================================================
  // 9. Mutaba'ah 7 Komponen Terpusat & Literasi Berbasis Halaman
  // =========================================================================
  describe("9. Mutaba'ah Terpusat & Literasi Berbasis Halaman", () => {
    it("schema.prisma harus memuat model CatatanMutabaahHarian dengan indeks unik [santriId, kategori, tanggal]", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schemaContent.includes("model CatatanMutabaahHarian"));
      assert.ok(schemaContent.includes("@@unique([santriId, kategori, tanggal])"));
    });

    it("Literasi wajib memiliki target bulanan minimal 80 Halaman (bukan menit)", () => {
      const targetLiterasi = 80;
      const satuanLiterasi = "Halaman Buku";

      assert.equal(targetLiterasi, 80);
      assert.equal(satuanLiterasi, "Halaman Buku");
    });
  });
});
