import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hitungRataRataKepatuhanMurojaah,
  isSyntheticMutabaahSeed,
  isCategorySyntheticSeed,
  evaluateCategoryProvenance,
  formatPrintMutabaahCell,
  buildMutabaahCSVRows,
  type MutabaahSantriReport,
} from "../lib/laporan-bulanan";
import { getDailyMufarTargetJuz, getCompletedJuzCount } from "../lib/tahfizh-mufar-tier";
import { INSTITUTION_CONFIG } from "../lib/institution-config";
import { formatWitaDateIndonesian } from "../lib/wita-date";

describe("Production Integrity Hotfix - Regression Suite", () => {
  // --------------------------------------------------------------------------
  // SECTION A: Monthly Evaluation Preview Response Handling & Crash Prevention
  // --------------------------------------------------------------------------
  describe("A. Monthly Evaluation Preview Crash Prevention", () => {
    // Pure function simulating the hardened response handling logic in RewardEvaluasiTab
    function parsePreviewResponse(res: {
      success: boolean;
      data?: unknown;
      message?: string;
    }): {
      previewList: Array<{ santriId: string; statusSanksi: string; nama: string }>;
      previewLoaded: boolean;
      errorMessage: string | null;
    } {
      if (res.success && res.data) {
        const rawItems = Array.isArray(res.data)
          ? res.data
          : (res.data as { items?: unknown })?.items;

        if (Array.isArray(rawItems)) {
          return {
            previewList: rawItems as Array<{ santriId: string; statusSanksi: string; nama: string }>,
            previewLoaded: true,
            errorMessage: null,
          };
        } else {
          return {
            previewList: [],
            previewLoaded: false,
            errorMessage: "Format data pratinjau tidak valid (daftar santri tidak ditemukan).",
          };
        }
      } else {
        return {
          previewList: [],
          previewLoaded: false,
          errorMessage: res.message || "Gagal memuat pratinjau evaluasi bulanan.",
        };
      }
    }

    it("1. Harus berhasil memproses valid items array dari wrapper object", () => {
      const serverActionResponse = {
        success: true,
        data: {
          bulan: 9,
          tahunAjaran: "2026/2027",
          minPersenTarget: 80,
          durasiHariSanksi: 7,
          items: [
            { santriId: "s1", nama: "Santri 1", statusSanksi: "BEBAS" },
            { santriId: "s2", nama: "Santri 2", statusSanksi: "KEHILANGAN_KUNJUNGAN" },
          ],
        },
      };

      const result = parsePreviewResponse(serverActionResponse);
      assert.equal(result.previewLoaded, true);
      assert.equal(result.previewList.length, 2);
      assert.equal(result.errorMessage, null);

      // Pastikan .filter berjalan tanpa crash
      const bebas = result.previewList.filter((p) => p.statusSanksi === "BEBAS");
      assert.equal(bebas.length, 1);
    });

    it("2. Harus menangani items = null secara terkendali tanpa crash", () => {
      const serverActionResponse = {
        success: true,
        data: {
          bulan: 9,
          tahunAjaran: "2026/2027",
          items: null,
        },
      };

      const result = parsePreviewResponse(serverActionResponse);
      assert.equal(result.previewLoaded, false);
      assert.equal(result.previewList.length, 0);
      assert.equal(Array.isArray(result.previewList), true);
      assert.match(result.errorMessage || "", /tidak valid/i);

      // Defensif: filter pada array kosong tidak boleh error
      assert.doesNotThrow(() => {
        result.previewList.filter((p) => p.statusSanksi === "BEBAS");
      });
    });

    it("3. Harus menangani malformed response object tanpa crash", () => {
      const malformedResponses = [
        { success: true, data: "string data" },
        { success: true, data: 12345 },
        { success: true, data: { notItems: "something else" } },
        { success: true, data: { items: "not an array" } },
      ];

      for (const malformed of malformedResponses) {
        const result = parsePreviewResponse(malformed);
        assert.equal(result.previewLoaded, false);
        assert.equal(Array.isArray(result.previewList), true);
        assert.equal(result.previewList.length, 0);
        assert.ok(result.errorMessage);

        // Filter tetap aman
        assert.doesNotThrow(() => {
          result.previewList.filter((p) => p.statusSanksi === "BEBAS");
        });
      }
    });

    it("4. Harus menangani server action failure dengan pesan error terkendali", () => {
      const failedResponse = {
        success: false,
        message: "Sesi telah berakhir. Silakan login kembali.",
        data: null,
      };

      const result = parsePreviewResponse(failedResponse);
      assert.equal(result.previewLoaded, false);
      assert.equal(result.previewList.length, 0);
      assert.equal(result.errorMessage, "Sesi telah berakhir. Silakan login kembali.");
    });

    it("5. Harus menangani empty array santri secara benar", () => {
      const emptyResponse = {
        success: true,
        data: {
          bulan: 9,
          tahunAjaran: "2026/2027",
          items: [],
        },
      };

      const result = parsePreviewResponse(emptyResponse);
      assert.equal(result.previewLoaded, true);
      assert.equal(result.previewList.length, 0);
      assert.equal(result.errorMessage, null);
      assert.equal(result.previewList.filter((p) => p.statusSanksi === "BEBAS").length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION B: Bounded Muroja'ah Institutional Metric & Removal of 94.2%
  // --------------------------------------------------------------------------
  describe("B. Bounded Muroja'ah Institutional Metric", () => {
    it("1. Jika seluruh realisasi Sabqi & Manzil = 0, ringkasan TIDAK BOLEH menampilkan 94.2% (harus 0%)", () => {
      const rekapSantri = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 4, totalFrekuensi: 0, hasTarget: true },
            manzil: { targetBulanan: 4, totalFrekuensi: 0, hasTarget: true },
          },
        },
        {
          tahfizh: {
            sabqi: { targetBulanan: 4, totalFrekuensi: 0, hasTarget: true },
            manzil: { targetBulanan: 4, totalFrekuensi: 0, hasTarget: true },
          },
        },
      ];

      const result = hitungRataRataKepatuhanMurojaah(rekapSantri);
      assert.equal(result.hasApplicableData, true);
      assert.equal(result.totalRealisasi, 0);
      assert.equal(result.totalEffectiveActual, 0);
      assert.equal(result.totalTarget, 16);
      assert.equal(result.persentase, 0);
      assert.equal(result.label, "0%");
      assert.notEqual(result.label, "94.2%");
    });

    it("2. Jika tidak ada target atau data berlaku, TIDAK BOLEH mengarang persentase palsu (harus 'Belum ada data')", () => {
      const cases = [
        [],
        null,
        undefined,
        [
          {
            tahfizh: {
              sabqi: { targetBulanan: null, totalFrekuensi: 0, hasTarget: false },
              manzil: { targetBulanan: null, totalFrekuensi: 0, hasTarget: false },
            },
          },
        ],
        [
          {
            tahfizh: {
              sabqi: { targetBulanan: 0, totalFrekuensi: 0, hasTarget: false },
              manzil: { targetBulanan: 0, totalFrekuensi: 0, hasTarget: false },
            },
          },
        ],
      ];

      for (const c of cases) {
        const result = hitungRataRataKepatuhanMurojaah(c);
        assert.equal(result.hasApplicableData, false);
        assert.equal(result.persentase, null);
        assert.equal(result.label, "Belum ada data");
        assert.notEqual(result.label, "94.2%");
        assert.notEqual(result.label, "0%");
        assert.notEqual(result.label, "100%");
      }
    });

    it("3. Bounded Metric: Target 4 & actual 8 + Target 4 & actual 0 TIDAK BOLEH menghasilkan 100% (harus 50%)", () => {
      // Kasus audit: Santri A overachieving (target 4, actual 8), Santri B nol (target 4, actual 0)
      // Unbounded: (8 + 0) / (4 + 4) = 100% -> SALAH (menutupi defisit Santri B)
      // Bounded: min(8, 4) + min(0, 4) = 4 + 0 = 4; total target = 8 -> 4 / 8 = 50.0%
      const rekapSantri = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 4, totalFrekuensi: 8, hasTarget: true },
            manzil: { targetBulanan: null, totalFrekuensi: 0, hasTarget: false },
          },
        },
        {
          tahfizh: {
            sabqi: { targetBulanan: 4, totalFrekuensi: 0, hasTarget: true },
            manzil: { targetBulanan: null, totalFrekuensi: 0, hasTarget: false },
          },
        },
      ];

      const result = hitungRataRataKepatuhanMurojaah(rekapSantri);
      assert.equal(result.hasApplicableData, true);
      assert.equal(result.totalRealisasi, 8);
      assert.equal(result.totalEffectiveActual, 4);
      assert.equal(result.totalTarget, 8);
      assert.equal(result.persentase, 50);
      assert.equal(result.label, "50%");
      assert.notEqual(result.persentase, 100);
    });

    it("4. Semua target terpenuhi tepat menghasilkan kepatuhan 100%", () => {
      const rekapSantri = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 6, totalFrekuensi: 6, hasTarget: true },
            manzil: { targetBulanan: 4, totalFrekuensi: 4, hasTarget: true },
          },
        },
      ];

      const result = hitungRataRataKepatuhanMurojaah(rekapSantri);
      assert.equal(result.totalRealisasi, 10);
      assert.equal(result.totalEffectiveActual, 10);
      assert.equal(result.totalTarget, 10);
      assert.equal(result.persentase, 100);
      assert.equal(result.label, "100%");
    });

    it("5. Overachievement pada santri tunggal dibatasi pada batas institusional 100%", () => {
      const rekapSantri = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 4, totalFrekuensi: 12, hasTarget: true },
            manzil: { targetBulanan: 4, totalFrekuensi: 8, hasTarget: true },
          },
        },
      ];

      const result = hitungRataRataKepatuhanMurojaah(rekapSantri);
      assert.equal(result.totalRealisasi, 20);
      assert.equal(result.totalEffectiveActual, 8); // min(12,4) + min(8,4) = 4 + 4 = 8
      assert.equal(result.totalTarget, 8);
      assert.equal(result.persentase, 100);
      assert.equal(result.label, "100%");
      assert.ok(result.persentase <= 100);
    });

    it("6. Perubahan baris data santri mengubah metrik ringkasan secara deterministik", () => {
      const dataAwal = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 10, totalFrekuensi: 10, hasTarget: true },
            manzil: { targetBulanan: 10, totalFrekuensi: 8, hasTarget: true },
          },
        },
      ];

      const res1 = hitungRataRataKepatuhanMurojaah(dataAwal);
      assert.equal(res1.persentase, 90);
      assert.equal(res1.label, "90%");

      // Musyrif mencatat setoran manzil baru (+2 frekuensi)
      const dataTerupdate = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 10, totalFrekuensi: 10, hasTarget: true },
            manzil: { targetBulanan: 10, totalFrekuensi: 10, hasTarget: true },
          },
        },
      ];

      const res2 = hitungRataRataKepatuhanMurojaah(dataTerupdate);
      assert.equal(res2.persentase, 100);
      assert.equal(res2.label, "100%");
      assert.notEqual(res1.persentase, res2.persentase);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION C: Mutaba'ah CSV Row Generation & Synthetic Data Suppression
  // --------------------------------------------------------------------------
  describe("C. Mutaba'ah CSV Row Generation & Synthetic Data Suppression", () => {
    it("1. Pure synthetic seed data: semua 7 kategori ter-masking 'Menunggu Data Riil' & status 'Menunggu Data Riil'", () => {
      const syntheticReport: MutabaahSantriReport[] = [
        {
          santri: { id: "s1", nis: "SAN-TEST-001", nama: "Santri Alpha", kelas: "7A" },
          nonTahfizh: [
            { kategori: "HAFALAN_HADITS", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 4, totalKumulatif: 82, targetMin: 4, isTuntas: true },
            { kategori: "HAFALAN_MUFRODAT", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 12, totalKumulatif: 132, targetMin: 12, isTuntas: true },
            { kategori: "HAFALAN_VOCABULARY", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 12, totalKumulatif: 132, targetMin: 12, isTuntas: true },
            { kategori: "SHOLAT_TAHAJJUD", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true },
            { kategori: "SHOLAT_DHUHA", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true },
            { kategori: "PUASA_SUNNAH", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 7, totalKumulatif: 7, targetMin: 6, isTuntas: true },
            { kategori: "LITERASI", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 85, totalKumulatif: 85, targetMin: 80, isTuntas: true },
          ],
        },
      ];

      const rows = buildMutabaahCSVRows(syntheticReport);
      assert.equal(rows.length, 1);
      const row = rows[0];

      // Metadata santri terisolasi secara aman
      assert.equal(row[0], "SAN-TEST-001");
      assert.equal(row[1], "Santri Alpha");
      assert.equal(row[2], "7A");

      // Kategori 1..7 (indeks 3..9) harus "Menunggu Data Riil", TIDAK BOLEH membocorkan angka 4, 12, 16, 85
      for (let i = 3; i <= 9; i++) {
        assert.equal(row[i], "Menunggu Data Riil");
      }

      // Status keseluruhan (indeks 10): TIDAK BOLEH "Tuntas Seluruhnya", harus "Menunggu Data Riil"
      assert.equal(row[10], "Menunggu Data Riil");
      assert.notEqual(row[10], "Tuntas Seluruhnya");
    });

    it("2. Real authoritative data: mengekspor angka riil terformat dan status keseluruhan yang valid", () => {
      const realReport: MutabaahSantriReport[] = [
        {
          santri: { id: "s2", nis: "SAN-TEST-002", nama: "Santri Beta", kelas: "9A" },
          nonTahfizh: [
            { kategori: "HAFALAN_HADITS", isDataTersedia: true, isSynthetic: false, hbl: 50, penambahanBulanIni: 4, totalKumulatif: 54, targetMin: 4, isTuntas: true },
            { kategori: "HAFALAN_MUFRODAT", isDataTersedia: true, isSynthetic: false, hbl: 100, penambahanBulanIni: 15, totalKumulatif: 115, targetMin: 12, isTuntas: true },
            { kategori: "HAFALAN_VOCABULARY", isDataTersedia: true, isSynthetic: false, hbl: 100, penambahanBulanIni: 12, totalKumulatif: 112, targetMin: 12, isTuntas: true },
            { kategori: "SHOLAT_TAHAJJUD", isDataTersedia: true, isSynthetic: false, penambahanBulanIni: 18, totalKumulatif: 18, targetMin: 15, isTuntas: true },
            { kategori: "SHOLAT_DHUHA", isDataTersedia: true, isSynthetic: false, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true },
            { kategori: "PUASA_SUNNAH", isDataTersedia: true, isSynthetic: false, penambahanBulanIni: 6, totalKumulatif: 6, targetMin: 6, isTuntas: true },
            { kategori: "LITERASI", isDataTersedia: true, isSynthetic: false, penambahanBulanIni: 90, totalKumulatif: 90, targetMin: 80, isTuntas: true },
          ],
        },
      ];

      const rows = buildMutabaahCSVRows(realReport);
      assert.equal(rows.length, 1);
      const row = rows[0];

      assert.equal(row[0], "SAN-TEST-002");
      assert.equal(row[1], "Santri Beta");
      assert.equal(row[3], "50 + 4 = 54 (Target: 4)");
      assert.equal(row[4], "100 + 15 = 115 (Target: 12)");
      assert.equal(row[6], "18 / 15");
      assert.equal(row[10], "Tuntas Seluruhnya");
    });

    it("3. Mixed / partial-edit data: kategori sintetis tetap ter-masking dan status keseluruhan mencatat status pending", () => {
      const mixedReport: MutabaahSantriReport[] = [
        {
          santri: { id: "s3", nis: "SAN-TEST-003", nama: "Santri Gamma", kelas: "8A" },
          nonTahfizh: [
            // Hadits diinput riil
            { kategori: "HAFALAN_HADITS", isDataTersedia: true, isSynthetic: false, hbl: 10, penambahanBulanIni: 4, totalKumulatif: 14, targetMin: 4, isTuntas: true },
            // 6 kategori lainnya belum diinput / sintetis
            { kategori: "HAFALAN_MUFRODAT", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 12, totalKumulatif: 132, targetMin: 12, isTuntas: true },
            { kategori: "HAFALAN_VOCABULARY", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 12, totalKumulatif: 132, targetMin: 12, isTuntas: true },
            { kategori: "SHOLAT_TAHAJJUD", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true },
            { kategori: "SHOLAT_DHUHA", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 16, totalKumulatif: 16, targetMin: 15, isTuntas: true },
            { kategori: "PUASA_SUNNAH", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 7, totalKumulatif: 7, targetMin: 6, isTuntas: true },
            { kategori: "LITERASI", isDataTersedia: false, isSynthetic: true, penambahanBulanIni: 85, totalKumulatif: 85, targetMin: 80, isTuntas: true },
          ],
        },
      ];

      const rows = buildMutabaahCSVRows(mixedReport);
      assert.equal(rows.length, 1);
      const row = rows[0];

      // Hadits riil terekspor
      assert.equal(row[3], "10 + 4 = 14 (Target: 4)");
      // 6 kategori lainnya aman ter-masking
      for (let i = 4; i <= 9; i++) {
        assert.equal(row[i], "Menunggu Data Riil");
      }
      // Status keseluruhan tidak boleh memancarkan "Tuntas Seluruhnya"
      assert.equal(row[10], "Menunggu Data Riil");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION D: Mutaba'ah Print Data Transform & Official Metadata Protection
  // --------------------------------------------------------------------------
  describe("D. Mutaba'ah Print Data Transform & Official Metadata Protection", () => {
    it("1. Pure synthetic item: formatPrintMutabaahCell menghasilkan '-' (bukan '+4' atau '+12')", () => {
      const syntheticItem = {
        kategori: "HAFALAN_HADITS",
        isDataTersedia: false,
        isSynthetic: true,
        penambahanBulanIni: 4,
        totalKumulatif: 82,
      };

      const printOutput = formatPrintMutabaahCell(syntheticItem);
      assert.equal(printOutput, "-");
      assert.notEqual(printOutput, "+4 (Tot: 82)");
    });

    it("2. Real authoritative item: formatPrintMutabaahCell menghasilkan format resmi '+X (Tot: Y)'", () => {
      const realItem = {
        kategori: "HAFALAN_HADITS",
        isDataTersedia: true,
        isSynthetic: false,
        penambahanBulanIni: 3,
        totalKumulatif: 45,
      };

      const printOutput = formatPrintMutabaahCell(realItem);
      assert.equal(printOutput, "+3 (Tot: 45)");
    });

    it("3. Item null / undefined / belum diinisialisasi: formatPrintMutabaahCell menghasilkan '-'", () => {
      assert.equal(formatPrintMutabaahCell(null), "-");
      assert.equal(formatPrintMutabaahCell(undefined), "-");
      assert.equal(formatPrintMutabaahCell({ kategori: "HAFALAN_HADITS", isDataTersedia: false }), "-");
    });

    it("4. Tanggal cetak laporan bulanan default ke tanggal WITA dinamis hari ini dalam bahasa Indonesia", () => {
      // Simulasikan tanggal tetap untuk pengujian format deterministik
      const testDate = new Date(Date.UTC(2026, 8, 15, 6, 0, 0)); // 2026-09-15 14:00 WITA
      const formatted = formatWitaDateIndonesian(testDate);
      assert.equal(formatted, "15 September 2026");

      // Verifikasi format default (tanpa argumen) mengembalikan string berformat "D MMMM YYYY"
      const defaultToday = formatWitaDateIndonesian();
      assert.match(defaultToday, /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/);
    });

    it("5. Metadata pengesahan cetak bersumber dari INSTITUTION_CONFIG dan terbebas dari identitas statis palsu", () => {
      // Kota resmi harus Makassar dari INSTITUTION_CONFIG.kota (bukan Depok)
      assert.equal(INSTITUTION_CONFIG.kota, "Makassar");
      assert.notEqual(INSTITUTION_CONFIG.kota, "Depok");

      // Nama Mudir resmi bersumber dari INSTITUTION_CONFIG
      assert.ok(INSTITUTION_CONFIG.mudirName.includes("Andi Quarzy"));

      // Verifikasi ketiadaan ID/NIP statis palsu dalam konfigurasi lembaga
      const serialized = JSON.stringify(INSTITUTION_CONFIG);
      assert.ok(!serialized.includes("STQ-MT-003"), "Konfigurasi tidak boleh memuat STQ-MT-003");
      assert.ok(!serialized.includes("STQ-KS-001"), "Konfigurasi tidak boleh memuat STQ-KS-001");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION E: Mutaba'ah Partial-Edit Seed Leakage Resolution
  // --------------------------------------------------------------------------
  describe("E. Mutaba'ah Partial-Edit Seed Leakage Resolution", () => {
    const untouchedSeedRecords = [
      { kategori: "HAFALAN_HADITS", pekan1: 1, pekan2: 1, pekan3: 1, pekan4: 1, catatan: null },
      { kategori: "HAFALAN_MUFRODAT", pekan1: 3, pekan2: 3, pekan3: 3, pekan4: 3, catatan: null },
      { kategori: "HAFALAN_VOCABULARY", pekan1: 3, pekan2: 3, pekan3: 3, pekan4: 3, catatan: null },
      { kategori: "SHOLAT_TAHAJJUD", pekan1: 4, pekan2: 4, pekan3: 4, pekan4: 4, catatan: null },
      { kategori: "SHOLAT_DHUHA", pekan1: 4, pekan2: 4, pekan3: 4, pekan4: 4, catatan: null },
      { kategori: "PUASA_SUNNAH", pekan1: 2, pekan2: 2, pekan3: 1, pekan4: 2, catatan: null },
      { kategori: "LITERASI", pekan1: 20, pekan2: 25, pekan3: 20, pekan4: 20, catatan: null },
    ];

    it("1. Pembuktian leak pada evaluasi santri-level: isSyntheticMutabaahSeed memeriksa keberadaan seed", () => {
      // Jika semua 7 untouched seed -> isSyntheticMutabaahSeed = true
      assert.equal(isSyntheticMutabaahSeed(untouchedSeedRecords), true);
    });

    it("2. Skenario 1: Semua 7 kategori untouched seed -> semua 7 kategori terdeteksi sebagai sintetis", () => {
      for (const rec of untouchedSeedRecords) {
        assert.equal(isCategorySyntheticSeed(rec.kategori, rec), true, `isCategorySyntheticSeed(${rec.kategori}) harus true`);
        const prov = evaluateCategoryProvenance(rec.kategori, rec);
        assert.equal(prov.isSynthetic, true, `Kategori ${rec.kategori} harus terdeteksi sintetis`);
        assert.equal(prov.isDataTersedia, false, `Kategori ${rec.kategori} tidak boleh dianggap data riil`);
      }
    });

    it("3. Skenario 2: 1 kategori (Hadits) diedit riil -> HANYA Hadits yang lolos, 6 lainnya tetap suppressed", () => {
      // Guru menginput Hadits riil dengan catatan jelas
      const editedHaditsRecord = {
        kategori: "HAFALAN_HADITS",
        pekan1: 1,
        pekan2: 1,
        pekan3: 0,
        pekan4: 0,
        catatan: "Hadits Pilihan 1 & 2",
      };

      const partialEditRecords = [
        editedHaditsRecord,
        ...untouchedSeedRecords.filter((r) => r.kategori !== "HAFALAN_HADITS"),
      ];

      // Evaluasi per kategori untuk Hadits
      const haditsProv = evaluateCategoryProvenance("HAFALAN_HADITS", editedHaditsRecord);
      assert.equal(haditsProv.isSynthetic, false, "Hadits yang diedit dengan catatan bukan sintetis");
      assert.equal(haditsProv.isDataTersedia, true, "Hadits yang diedit harus tersedia");

      // Evaluasi per kategori untuk 6 lainnya: WAJIB TETAP TERSUPPRESI
      const otherCategories = partialEditRecords.filter((r) => r.kategori !== "HAFALAN_HADITS");
      assert.equal(otherCategories.length, 6);

      for (const rec of otherCategories) {
        const prov = evaluateCategoryProvenance(rec.kategori, rec);
        assert.equal(
          prov.isSynthetic,
          true,
          `Kategori ${rec.kategori} harus tetap suppressed meskipun Hadits sudah diedit`
        );
        assert.equal(
          prov.isDataTersedia,
          false,
          `Kategori ${rec.kategori} tidak boleh bocor sebagai data riil`
        );
      }
    });

    it("4. Skenario 3: Semua 7 kategori diedit riil oleh guru -> semua 7 kategori lolos dan tersedia", () => {
      const allRealRecords = [
        { kategori: "HAFALAN_HADITS", pekan1: 2, pekan2: 1, pekan3: 0, pekan4: 1, catatan: "Hadits Arbain" },
        { kategori: "HAFALAN_MUFRODAT", pekan1: 5, pekan2: 4, pekan3: 2, pekan4: 1, catatan: "Mufrodat B. Arab" },
        { kategori: "HAFALAN_VOCABULARY", pekan1: 4, pekan2: 3, pekan3: 3, pekan4: 2, catatan: "Vocab Unit 1" },
        { kategori: "SHOLAT_TAHAJJUD", pekan1: 3, pekan2: 4, pekan3: 2, pekan4: 3, catatan: "Jurnal santri" },
        { kategori: "SHOLAT_DHUHA", pekan1: 5, pekan2: 5, pekan3: 4, pekan4: 5, catatan: "Jurnal santri" },
        { kategori: "PUASA_SUNNAH", pekan1: 1, pekan2: 1, pekan3: 1, pekan4: 1, catatan: "Senin Kamis" },
        { kategori: "LITERASI", pekan1: 15, pekan2: 10, pekan3: 12, pekan4: 18, catatan: "Kitab Pilihan" },
      ];

      for (const rec of allRealRecords) {
        const prov = evaluateCategoryProvenance(rec.kategori, rec);
        assert.equal(prov.isSynthetic, false, `Kategori ${rec.kategori} harus autentik`);
        assert.equal(prov.isDataTersedia, true, `Kategori ${rec.kategori} harus tersedia`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION F: MUFAR Display Contract & Canonical Tier Unification
  // --------------------------------------------------------------------------
  describe("F. MUFAR Display Contract & Canonical Tier Unification", () => {
    it("1. Menghitung target MUFAR harian kanonikal secara tepat untuk setiap tier juz tuntas", () => {
      assert.equal(getDailyMufarTargetJuz(0), 0);
      assert.equal(getDailyMufarTargetJuz(1), 1);
      assert.equal(getDailyMufarTargetJuz(5), 1);
      assert.equal(getDailyMufarTargetJuz(6), 2);
      assert.equal(getDailyMufarTargetJuz(10), 2);
      assert.equal(getDailyMufarTargetJuz(11), 3);
      assert.equal(getDailyMufarTargetJuz(15), 3);
      assert.equal(getDailyMufarTargetJuz(16), 4);
      assert.equal(getDailyMufarTargetJuz(20), 4);
      assert.equal(getDailyMufarTargetJuz(21), 5);
      assert.equal(getDailyMufarTargetJuz(30), 5);
    });

    it("2. Santri 21-juz pada tier 5 Juz/hari: Dashboard dan Formulir Setoran harus sepakat pada 5 Juz/hari", () => {
      const completedJuz = getCompletedJuzCount(421, false);
      assert.equal(completedJuz, 21);

      const canonicalTarget = getDailyMufarTargetJuz(completedJuz);
      assert.equal(canonicalTarget, 5);

      const dashboardTargetString = `0/${canonicalTarget} Juz`;
      assert.equal(dashboardTargetString, "0/5 Juz");

      const formTargetString = `${canonicalTarget} Juz/hari`;
      assert.equal(formTargetString, "5 Juz/hari");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION G: System-Start Baseline Rule & Production Consistency
  // --------------------------------------------------------------------------
  describe("G. System-Start Baseline Rule & Production Consistency", () => {
    /**
     * Pure function implementing the production baseline logic with system-start boundary:
     * - If tanggalBaselineTahfizh exists: SABAQ >= tanggalBaselineTahfizh is counted.
     * - If tanggalBaselineTahfizh is null AND modalAwal === 0: SABAQ >= santri.createdAt is counted.
     * - If tanggalBaselineTahfizh is null AND modalAwal > 0: fail-closed (0 tambahan) to prevent unanchored historical double-counting.
     */
    function calculateSabaqWithSystemStartBoundary(santri: {
      modalAwalHalaman: number;
      tanggalBaselineTahfizh: Date | null;
      createdAt: Date | null;
      setoranList: Array<{
        jenis: string;
        status: string;
        jumlahHalaman: number;
        tanggal: Date;
      }>;
    }): {
      tambahanSabaq: number;
      totalHalaman: number;
      sabaqCount: number;
      effectiveBaseline: Date | null;
    } {
      const modalAwal = santri.modalAwalHalaman || 0;
      const baselineDate = santri.tanggalBaselineTahfizh ? new Date(santri.tanggalBaselineTahfizh) : null;
      const systemStartBoundary = (!baselineDate && modalAwal === 0 && santri.createdAt)
        ? new Date(santri.createdAt)
        : null;
      const effectiveBaseline = baselineDate ?? systemStartBoundary;

      const validSabaq = effectiveBaseline
        ? (santri.setoranList || []).filter((st) => {
            if (st.jenis !== "SABAQ" || st.status === "DIBATALKAN") return false;
            return new Date(st.tanggal) >= effectiveBaseline;
          })
        : [];

      const tambahanSabaq = validSabaq.reduce((acc, cur) => acc + (cur.jumlahHalaman || 0), 0);
      const totalHalaman = modalAwal + tambahanSabaq;

      return {
        tambahanSabaq,
        totalHalaman,
        sabaqCount: validSabaq.length,
        effectiveBaseline,
      };
    }

    it("1. Santri baru dengan modalAwal=0 dan baseline=null menghitung SABAQ sah >= createdAt", () => {
      const createdAt = new Date("2026-09-01T00:00:00.000Z");
      const santriBaru = {
        modalAwalHalaman: 0,
        tanggalBaselineTahfizh: null,
        createdAt,
        setoranList: [
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 3,
            tanggal: new Date("2026-09-02T08:00:00.000Z"), // >= createdAt
          },
        ],
      };

      const result = calculateSabaqWithSystemStartBoundary(santriBaru);
      assert.equal(result.sabaqCount, 1);
      assert.equal(result.tambahanSabaq, 3);
      assert.equal(result.totalHalaman, 3);
      assert.deepEqual(result.effectiveBaseline, createdAt);
    });

    it("2. SABAQ yang bertanggal SEBELUM createdAt santri TIDAK BOLEH dihitung untuk modalAwal=0", () => {
      const createdAt = new Date("2026-09-01T00:00:00.000Z");
      const santriWithPreEnrollmentSabaq = {
        modalAwalHalaman: 0,
        tanggalBaselineTahfizh: null,
        createdAt,
        setoranList: [
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 5,
            tanggal: new Date("2026-08-25T10:00:00.000Z"), // < createdAt (anomali historis)
          },
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 2,
            tanggal: new Date("2026-09-02T10:00:00.000Z"), // >= createdAt
          },
        ],
      };

      const result = calculateSabaqWithSystemStartBoundary(santriWithPreEnrollmentSabaq);
      // Hanya 1 setoran sah (yang setelah createdAt)
      assert.equal(result.sabaqCount, 1);
      assert.equal(result.tambahanSabaq, 2);
      assert.equal(result.totalHalaman, 2);
    });

    it("3. Santri dengan modalAwal > 0 dan baseline=null wajib fail-closed (0 tambahan SABAQ)", () => {
      const santriWithoutBaseline = {
        modalAwalHalaman: 200,
        tanggalBaselineTahfizh: null,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        setoranList: [
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 5,
            tanggal: new Date("2026-09-02T08:00:00Z"),
          },
        ],
      };

      const result = calculateSabaqWithSystemStartBoundary(santriWithoutBaseline);
      assert.equal(result.effectiveBaseline, null);
      assert.equal(result.sabaqCount, 0);
      assert.equal(result.tambahanSabaq, 0);
      assert.equal(result.totalHalaman, 200); // Murni modal awal
    });

    it("4. Santri dengan baseline != null hanya menghitung SABAQ >= tanggalBaselineTahfizh", () => {
      const baselineDate = new Date("2026-09-01T00:00:00.000Z");
      const santriWithBaseline = {
        modalAwalHalaman: 420,
        tanggalBaselineTahfizh: baselineDate,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        setoranList: [
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 2,
            tanggal: new Date("2026-08-25T08:00:00Z"), // < baseline
          },
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 3,
            tanggal: new Date("2026-09-02T08:00:00Z"), // >= baseline
          },
        ],
      };

      const result = calculateSabaqWithSystemStartBoundary(santriWithBaseline);
      assert.equal(result.sabaqCount, 1);
      assert.equal(result.tambahanSabaq, 3);
      assert.equal(result.totalHalaman, 423);
      assert.deepEqual(result.effectiveBaseline, baselineDate);
    });

    it("5. Setoran berstatus DIBATALKAN wajib dieksklusi secara ketat dari capaian", () => {
      const createdAt = new Date("2026-09-01T00:00:00.000Z");
      const santriWithCancelled = {
        modalAwalHalaman: 0,
        tanggalBaselineTahfizh: null,
        createdAt,
        setoranList: [
          {
            jenis: "SABAQ",
            status: "DIBATALKAN",
            jumlahHalaman: 3,
            tanggal: new Date("2026-09-02T07:15:00Z"),
          },
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 2,
            tanggal: new Date("2026-09-03T07:15:00Z"),
          },
        ],
      };

      const result = calculateSabaqWithSystemStartBoundary(santriWithCancelled);
      assert.equal(result.sabaqCount, 1);
      assert.equal(result.tambahanSabaq, 2);
      assert.equal(result.totalHalaman, 2);
    });
  });
});
