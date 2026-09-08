import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTodayWITADateString,
  getWITADayRange,
} from "../lib/wita-date";
import {
  evaluasiLevelSP,
  konversiPredikatNilai,
  hitungPoinPelanggaran,
  validasiIkhtibarTahap1,
  validasiIkhtibarTahap2,
} from "../lib/educational-rules";
import { INSTITUTION_CONFIG } from "../lib/institution-config";
import { MASTER_SESI_HALAQOH } from "../lib/master-schedule";

describe("Audit STQ 2026-09-08 — Remediasi Batch 3 (P1 Educational Logic, Documents & WITA Time)", () => {
  describe("1. A14 & A15: WITA Timezone (Asia/Makassar) Date Engine", () => {
    it("harus menghasilkan tanggal WITA hari ini yang benar sebelum pukul 08.00 WITA (00.00 UTC)", () => {
      // 07:55 WITA pada 8 September 2026 setara dengan 23:55 UTC pada 7 September 2026
      const beforeEightWITA = new Date("2026-09-07T23:55:00.000Z");
      const witaStr = getTodayWITADateString(beforeEightWITA);

      assert.strictEqual(witaStr, "2026-09-08", "Sebelum 08:00 WITA tidak boleh mundur ke tanggal UTC kemarin");
    });

    it("harus menangani waktu tengah malam 00:05 WITA secara tepat", () => {
      // 00:05 WITA pada 8 September 2026 setara dengan 16:05 UTC pada 7 September 2026
      const midnightWITA = new Date("2026-09-07T16:05:00.000Z");
      const witaStr = getTodayWITADateString(midnightWITA);

      assert.strictEqual(witaStr, "2026-09-08");
    });

    it("harus menangani waktu malam 23:55 WITA secara tepat", () => {
      // 23:55 WITA pada 8 September 2026 setara dengan 15:55 UTC pada 8 September 2026
      const lateNightWITA = new Date("2026-09-08T15:55:00.000Z");
      const witaStr = getTodayWITADateString(lateNightWITA);

      assert.strictEqual(witaStr, "2026-09-08");
    });

    it("harus menangani transisi pergantian bulan di WITA", () => {
      // 00:01 WITA pada 1 September 2026 setara dengan 16:01 UTC pada 31 Agustus 2026
      const monthTransition = new Date("2026-08-31T16:01:00.000Z");
      const witaStr = getTodayWITADateString(monthTransition);

      assert.strictEqual(witaStr, "2026-09-01");
    });

    it("getWITADayRange harus menghasilkan rentang awal dan akhir hari yang akurat dalam UTC", () => {
      const range = getWITADayRange("2026-09-08");

      assert.strictEqual(range.startOfDayUTC.toISOString(), "2026-09-07T16:00:00.000Z");
      assert.strictEqual(range.endOfDayUTC.toISOString(), "2026-09-08T15:59:59.999Z");
    });
  });

  describe("2. A17: Single Source of Truth Aturan SP & Nilai Akademik", () => {
    it("harus menerapkan ambang batas SP resmi (SP1: 20, SP2: 40, SP3: 60)", () => {
      assert.strictEqual(evaluasiLevelSP(0), null);
      assert.strictEqual(evaluasiLevelSP(19), null);
      assert.strictEqual(evaluasiLevelSP(20), "SP1");
      assert.strictEqual(evaluasiLevelSP(39), "SP1");
      assert.strictEqual(evaluasiLevelSP(40), "SP2");
      assert.strictEqual(evaluasiLevelSP(59), "SP2");
      assert.strictEqual(evaluasiLevelSP(60), "SP3");
      assert.strictEqual(evaluasiLevelSP(120), "SP3");
    });

    it("harus menerapkan ambang batas nilai akademik resmi (A >= 90, B >= 80, C >= 70, D < 70)", () => {
      assert.strictEqual(konversiPredikatNilai(100), "A");
      assert.strictEqual(konversiPredikatNilai(90), "A");
      assert.strictEqual(konversiPredikatNilai(89.5), "B");
      assert.strictEqual(konversiPredikatNilai(80), "B");
      assert.strictEqual(konversiPredikatNilai(75), "C");
      assert.strictEqual(konversiPredikatNilai(70), "C");
      assert.strictEqual(konversiPredikatNilai(69.9), "D");
      assert.strictEqual(konversiPredikatNilai(0), "D");
    });

    it("harus melipatgandakan poin sanksi jika pelanggaran berulang", () => {
      assert.strictEqual(hitungPoinPelanggaran(15, false), 15);
      assert.strictEqual(hitungPoinPelanggaran(15, true), 30);
    });
  });

  describe("3. A18: Validasi Transisi & Standar Kelulusan Ikhtibar 2 Tahap", () => {
    it("Tahap 1 harus menolak jika status awal bukan PENGAJUAN", () => {
      const res = validasiIkhtibarTahap1("LULUS_SEMPURNA_TAHAP_2", 90);
      assert.strictEqual(res.lulus, false);
      assert.match(res.error || "", /hanya dapat dilakukan untuk pendaftaran berstatus PENGAJUAN/i);
    });

    it("Tahap 1 harus menolak jika nilai di luar rentang 0-100", () => {
      const resUnder = validasiIkhtibarTahap1("PENGAJUAN", -5);
      const resOver = validasiIkhtibarTahap1("PENGAJUAN", 105);
      assert.strictEqual(resUnder.lulus, false);
      assert.strictEqual(resOver.lulus, false);
    });

    it("Tahap 1 harus menandai MENGULANG jika nilai di bawah 75", () => {
      const res = validasiIkhtibarTahap1("PENGAJUAN", 70);
      assert.strictEqual(res.lulus, false);
      assert.strictEqual(res.status, "MENGULANG");
    });

    it("Tahap 1 harus meluluskan jika nilai >= 75 dan status PENGAJUAN", () => {
      const res = validasiIkhtibarTahap1("PENGAJUAN", 85);
      assert.strictEqual(res.lulus, true);
      assert.strictEqual(res.status, "LULUS_TAHAP_1");
    });

    it("Tahap 2 harus menolak jika santri belum lulus Tahap 1", () => {
      const res = validasiIkhtibarTahap2("PENGAJUAN", 90);
      assert.strictEqual(res.lulus, false);
      assert.match(res.error || "", /harus dinyatakan lulus Tahap 1/i);
    });

    it("Tahap 2 harus mengesahkan LULUS_SEMPURNA_TAHAP_2 jika nilai >= 75", () => {
      const res = validasiIkhtibarTahap2("LULUS_TAHAP_1", 92);
      assert.strictEqual(res.lulus, true);
      assert.strictEqual(res.status, "LULUS_SEMPURNA_TAHAP_2");
    });
  });

  describe("4. A11: Sentralisasi Legalitas Lembaga (Yayasan Infak Medika Nusantara)", () => {
    it("harus memuat identitas legal Yayasan Infak Medika Nusantara dan STQ Darul Ulum Cendekia", () => {
      assert.strictEqual(INSTITUTION_CONFIG.schoolName, "STQ Darul Ulum Cendekia");
      assert.strictEqual(INSTITUTION_CONFIG.shortName, "STQ DUC");
      assert.strictEqual(INSTITUTION_CONFIG.yayasanName, "Yayasan Infak Medika Nusantara");
      assert.strictEqual(INSTITUTION_CONFIG.kota, "Makassar");
      assert.strictEqual(INSTITUTION_CONFIG.timeZone, "Asia/Makassar");
    });
  });

  describe("5. A16: Penyelarasan Master Jadwal Halaqoh Standar Kurikulum", () => {
    it("harus mendefinisikan 5 sesi halaqoh mencakup sabaq pagi, sabqi, siang, sore, dan malam", () => {
      assert.strictEqual(MASTER_SESI_HALAQOH.length, 5);
      const ids = MASTER_SESI_HALAQOH.map((s) => s.id);
      assert.ok(ids.includes("Halaqah Ba'da Shubuh"));
      assert.ok(ids.includes("Halaqah Pagi (Dhuha)"));
      assert.ok(ids.includes("Halaqah Siang"));
      assert.ok(ids.includes("Halaqah Ba'da Ashar"));
      assert.ok(ids.includes("Halaqah Ba'da Isya"));
    });
  });
});
