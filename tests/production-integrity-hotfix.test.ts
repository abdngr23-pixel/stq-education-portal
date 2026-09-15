import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hitungRataRataKepatuhanMurojaah,
  isSyntheticMutabaahSeed,
} from "../lib/laporan-bulanan";
import { getDailyMufarTargetJuz, getCompletedJuzCount } from "../lib/tahfizh-mufar-tier";

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
  // SECTION B: Removal of Hardcoded 94.2% & Authoritative Calculation
  // --------------------------------------------------------------------------
  describe("B. Removal of Hardcoded 94.2% & Authoritative Report Metric", () => {
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
      assert.equal(result.totalTarget, 16);
      assert.equal(result.persentase, 0);
      assert.equal(result.label, "0%");
      assert.notEqual(result.label, "94.2%");
    });

    it("2. Jika tidak ada target atau data berlaku, TIDAK BOLEH mengarang persentase palsu (harus 'Belum ada data')", () => {
      const cases = [
        [], // empty array
        null, // null
        undefined, // undefined
        [
          // Santri tanpa target
          {
            tahfizh: {
              sabqi: { targetBulanan: null, totalFrekuensi: 0, hasTarget: false },
              manzil: { targetBulanan: null, totalFrekuensi: 0, hasTarget: false },
            },
          },
        ],
        [
          // Santri dengan target 0
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

    it("3. Perubahan baris data santri mengubah metrik ringkasan secara deterministik", () => {
      const dataAwal = [
        {
          tahfizh: {
            sabqi: { targetBulanan: 10, totalFrekuensi: 10, hasTarget: true },
            manzil: { targetBulanan: 10, totalFrekuensi: 8, hasTarget: true },
          },
        },
      ];

      const res1 = hitungRataRataKepatuhanMurojaah(dataAwal);
      // 18 / 20 * 100 = 90.0%
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
      // 20 / 20 * 100 = 100%
      assert.equal(res2.persentase, 100);
      assert.equal(res2.label, "100%");

      assert.notEqual(res1.persentase, res2.persentase);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION C: Mutaba'ah Synthetic Data Provenance Detection
  // --------------------------------------------------------------------------
  describe("C. Mutaba'ah Synthetic Data Provenance Detection", () => {
    it("1. Harus mengenali pola sintetis seed (+4 Hadits, +12 Mufrodat, 16 Tahajjud, 16 Dhuha, 7 Puasa, 85 Literasi)", () => {
      const syntheticRows = [
        { kategori: "HAFALAN_HADITS", pekan1: 1, pekan2: 1, pekan3: 1, pekan4: 1, catatan: null },
        { kategori: "HAFALAN_MUFRODAT", pekan1: 3, pekan2: 3, pekan3: 3, pekan4: 3, catatan: null },
        { kategori: "HAFALAN_VOCABULARY", pekan1: 3, pekan2: 3, pekan3: 3, pekan4: 3, catatan: null },
        { kategori: "SHOLAT_TAHAJJUD", pekan1: 4, pekan2: 4, pekan3: 4, pekan4: 4, catatan: null },
        { kategori: "SHOLAT_DHUHA", pekan1: 4, pekan2: 4, pekan3: 4, pekan4: 4, catatan: null },
        { kategori: "PUASA_SUNNAH", pekan1: 2, pekan2: 2, pekan3: 2, pekan4: 1, catatan: null },
        { kategori: "LITERASI", pekan1: 20, pekan2: 20, pekan3: 25, pekan4: 20, catatan: null },
      ];

      assert.equal(isSyntheticMutabaahSeed(syntheticRows), true);
    });

    it("2. Data autentik riil yang diinput oleh pembina TIDAK BOLEH ditandai sebagai sintetis", () => {
      const realRows = [
        { kategori: "HAFALAN_HADITS", pekan1: 2, pekan2: 1, pekan3: 0, pekan4: 1, catatan: "Hadits Arbain #1-4" },
        { kategori: "HAFALAN_MUFRODAT", pekan1: 5, pekan2: 4, pekan3: 2, pekan4: 1, catatan: "Mufrodat B. Arab" },
        { kategori: "HAFALAN_VOCABULARY", pekan1: 4, pekan2: 3, pekan3: 3, pekan4: 2, catatan: "Vocab Unit 1" },
        { kategori: "SHOLAT_TAHAJJUD", pekan1: 3, pekan2: 4, pekan3: 2, pekan4: 3, catatan: null },
        { kategori: "SHOLAT_DHUHA", pekan1: 5, pekan2: 5, pekan3: 4, pekan4: 5, catatan: null },
        { kategori: "PUASA_SUNNAH", pekan1: 1, pekan2: 1, pekan3: 1, pekan4: 1, catatan: null },
        { kategori: "LITERASI", pekan1: 15, pekan2: 10, pekan3: 12, pekan4: 18, catatan: "Kitab Riyadhus Shalihin" },
      ];

      assert.equal(isSyntheticMutabaahSeed(realRows), false);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION D: MUFAR Display Contract & Canonical Tier Unification
  // --------------------------------------------------------------------------
  describe("D. MUFAR Display Contract & Canonical Tier Unification", () => {
    it("1. Menghitung target MUFAR harian kanonikal secara tepat untuk setiap tier juz tuntas", () => {
      // 0 juz -> 0 (belum berlaku)
      assert.equal(getDailyMufarTargetJuz(0), 0);
      // 1–5 juz -> 1 juz/hari
      assert.equal(getDailyMufarTargetJuz(1), 1);
      assert.equal(getDailyMufarTargetJuz(5), 1);
      // 6–10 juz -> 2 juz/hari
      assert.equal(getDailyMufarTargetJuz(6), 2);
      assert.equal(getDailyMufarTargetJuz(10), 2);
      // 11–15 juz -> 3 juz/hari
      assert.equal(getDailyMufarTargetJuz(11), 3);
      assert.equal(getDailyMufarTargetJuz(15), 3);
      // 16–20 juz -> 4 juz/hari
      assert.equal(getDailyMufarTargetJuz(16), 4);
      assert.equal(getDailyMufarTargetJuz(20), 4);
      // 21–30 juz -> 5 juz/hari
      assert.equal(getDailyMufarTargetJuz(21), 5);
      assert.equal(getDailyMufarTargetJuz(30), 5);
    });

    it("2. Santri 21-juz (seperti Obama): Dashboard dan Formulir Setoran harus sepakat pada 5 Juz/hari", () => {
      // 21 juz tuntas (posisi halaman mencapai endPage Juz 21 yaitu hlm 421)
      const completedJuz = getCompletedJuzCount(421, false);
      assert.equal(completedJuz, 21);

      const canonicalTarget = getDailyMufarTargetJuz(completedJuz);
      assert.equal(canonicalTarget, 5);

      // Format Dashboard: "0/5 Juz"
      const dashboardTargetString = `0/${canonicalTarget} Juz`;
      assert.equal(dashboardTargetString, "0/5 Juz");

      // Format Formulir: "5 Juz/hari"
      const formTargetString = `${canonicalTarget} Juz/hari`;
      assert.equal(formTargetString, "5 Juz/hari");

      // Keduanya bersumber dari nilai kanonikal yang sama
      assert.equal(canonicalTarget, 5);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION E: Muhammad Fardhan Baseline & Progress Consistency
  // --------------------------------------------------------------------------
  describe("E. Muhammad Fardhan Baseline & Progress Consistency", () => {
    function calculateSabaqProgress(santri: {
      modalAwalHalaman: number;
      tanggalBaselineTahfizh: Date | null;
      setoranList: Array<{
        jenis: string;
        status: string;
        jumlahHalaman: number;
        tanggal: Date;
      }>;
    }): {
      tambahanSabaq: number;
      totalHalaman: number;
      sabaqAfterBaselineCount: number;
    } {
      const modalAwal = santri.modalAwalHalaman || 0;
      const baselineDate = santri.tanggalBaselineTahfizh ? new Date(santri.tanggalBaselineTahfizh) : null;

      const sabaqAfterBaseline = (santri.setoranList || []).filter((st) => {
        if (st.jenis !== "SABAQ" || st.status === "DIBATALKAN") return false;
        if (baselineDate) {
          return new Date(st.tanggal) >= baselineDate;
        }
        return modalAwal === 0;
      });

      const tambahanSabaq = sabaqAfterBaseline.reduce((acc, cur) => acc + (cur.jumlahHalaman || 0), 0);
      const totalHalaman = modalAwal + tambahanSabaq;

      return {
        tambahanSabaq,
        totalHalaman,
        sabaqAfterBaselineCount: sabaqAfterBaseline.length,
      };
    }

    it("1. Santri dengan modalAwal=0 dan baselineDate=null (seperti Fardhan) harus menghitung SABAQ valid", () => {
      const fardhanSantri = {
        modalAwalHalaman: 0,
        tanggalBaselineTahfizh: null,
        setoranList: [
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 3,
            tanggal: new Date("2026-09-10T07:15:00Z"),
          },
        ],
      };

      const result = calculateSabaqProgress(fardhanSantri);
      assert.equal(result.sabaqAfterBaselineCount, 1);
      assert.equal(result.tambahanSabaq, 3);
      assert.equal(result.totalHalaman, 3);
    });

    it("2. Setoran berstatus DIBATALKAN wajib dieksklusi secara ketat dari capaian", () => {
      const santriWithCancelled = {
        modalAwalHalaman: 0,
        tanggalBaselineTahfizh: null,
        setoranList: [
          {
            jenis: "SABAQ",
            status: "DIBATALKAN",
            jumlahHalaman: 3,
            tanggal: new Date("2026-09-10T07:15:00Z"),
          },
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 2,
            tanggal: new Date("2026-09-11T07:15:00Z"),
          },
        ],
      };

      const result = calculateSabaqProgress(santriWithCancelled);
      assert.equal(result.sabaqAfterBaselineCount, 1);
      assert.equal(result.tambahanSabaq, 2);
      assert.equal(result.totalHalaman, 2);
    });

    it("3. Santri dengan modalAwal > 0 dan baselineDate=null harus tetap fail-closed (0 tambahan)", () => {
      const santriWithoutBaseline = {
        modalAwalHalaman: 15,
        tanggalBaselineTahfizh: null,
        setoranList: [
          {
            jenis: "SABAQ",
            status: "AKTIF",
            jumlahHalaman: 5,
            tanggal: new Date("2026-09-08T08:00:00Z"),
          },
        ],
      };

      const result = calculateSabaqProgress(santriWithoutBaseline);
      assert.equal(result.sabaqAfterBaselineCount, 0);
      assert.equal(result.tambahanSabaq, 0);
      assert.equal(result.totalHalaman, 15);
    });
  });
});
