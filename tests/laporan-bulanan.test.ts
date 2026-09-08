import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  konversiHalamanKeJuz,
  getPekanDariTanggal,
  hitungCapaianSabaq,
  hitungKepatuhanFrekuensi,
  evaluasiCapaianNonTahfizh,
  generateRingkasanTasmiSimaan,
} from "../lib/laporan-bulanan";
import { KategoriCapaian, JenisUjiHafalan, NilaiSetoran } from "@prisma/client";

describe("Aturan Konversi & Laporan Bulanan (Roadmap v2)", () => {
  describe("1. Konversi Halaman ke Juz (Standar Mushaf Madinah 20 Hlm/Juz)", () => {
    it("harus mengonversi 0 halaman dengan tepat", () => {
      const res = konversiHalamanKeJuz(0);
      assert.equal(res.juz, 0);
      assert.equal(res.sisaHalaman, 0);
      assert.equal(res.label, "0 Halaman");
    });

    it("harus mengonversi 15 halaman (< 1 Juz) menjadi '15 Halaman'", () => {
      const res = konversiHalamanKeJuz(15);
      assert.equal(res.juz, 0);
      assert.equal(res.sisaHalaman, 15);
      assert.equal(res.label, "15 Halaman");
    });

    it("harus mengonversi tepat 20 halaman menjadi '1 Juz'", () => {
      const res = konversiHalamanKeJuz(20);
      assert.equal(res.juz, 1);
      assert.equal(res.sisaHalaman, 0);
      assert.equal(res.label, "1 Juz");
    });

    it("harus mengonversi 45 halaman menjadi '2 Juz 5 Halaman'", () => {
      const res = konversiHalamanKeJuz(45);
      assert.equal(res.juz, 2);
      assert.equal(res.sisaHalaman, 5);
      assert.equal(res.label, "2 Juz 5 Halaman");
    });

    it("harus mengonversi 600 halaman menjadi '30 Juz'", () => {
      const res = konversiHalamanKeJuz(600);
      assert.equal(res.juz, 30);
      assert.equal(res.sisaHalaman, 0);
      assert.equal(res.label, "30 Juz");
    });
  });

  describe("2. Penentuan Indeks Pekan (P1-P4)", () => {
    it("harus memetakan tanggal 1-7 ke Pekan 1", () => {
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 3)), 1);
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 7)), 1);
    });

    it("harus memetakan tanggal 8-14 ke Pekan 2", () => {
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 8)), 2);
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 14)), 2);
    });

    it("harus memetakan tanggal 15-21 ke Pekan 3", () => {
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 15)), 3);
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 21)), 3);
    });

    it("harus memetakan tanggal 22 ke atas ke Pekan 4", () => {
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 22)), 4);
      assert.equal(getPekanDariTanggal(new Date(2026, 8, 30)), 4);
    });
  });

  describe("3. Perhitungan Capaian Sabaq & Kepatuhan Frekuensi", () => {
    it("harus menghitung capaian target Sabaq bulanan dengan benar", () => {
      const realisasi = { p1: 10, p2: 10, p3: 15, p4: 10 }; // Total 45 hlm
      const hasil = hitungCapaianSabaq(realisasi, 40);

      assert.equal(hasil.totalHalaman, 45);
      assert.equal(hasil.konversi.label, "2 Juz 5 Halaman");
      assert.equal(hasil.persentase, 112.5);
      assert.equal(hasil.isTercapai, true);
    });

    it("harus mengevaluasi kepatuhan frekuensi Sabqi dengan ambang 90%", () => {
      // Target 16 sesi per bulan (4 sesi/pekan * 4)
      const patuh = hitungKepatuhanFrekuensi({ p1: 4, p2: 4, p3: 4, p4: 3 }, 16, 90.0); // 15/16 = 93.8%
      assert.equal(patuh.totalFrekuensi, 15);
      assert.equal(patuh.isPatuh, true);

      const tidakPatuh = hitungKepatuhanFrekuensi({ p1: 3, p2: 3, p3: 3, p4: 3 }, 16, 90.0); // 12/16 = 75.0%
      assert.equal(tidakPatuh.totalFrekuensi, 12);
      assert.equal(tidakPatuh.isPatuh, false);
    });
  });

  describe("4. Evaluasi 7 Komponen Mutaba'ah Non-Tahfizh & HBL Carry-over", () => {
    it("harus menghitung HBL carry-over kumulatif hafalan hadits", () => {
      // Bulan lalu hafal 8 hadits. Bulan ini bertambah: P1=1, P2=1, P3=1, P4=1 (Total +4, target min 4)
      const res = evaluasiCapaianNonTahfizh(
        KategoriCapaian.HAFALAN_HADITS,
        8,
        { p1: 1, p2: 1, p3: 1, p4: 1 }
      );

      assert.equal(res.hbl, 8);
      assert.equal(res.penambahanBulanIni, 4);
      assert.equal(res.totalKumulatif, 12);
      assert.equal(res.targetMin, 4);
      assert.equal(res.isTuntas, true);
    });

    it("harus menandai belum tuntas jika sholat tahajjud di bawah 15 malam", () => {
      const res = evaluasiCapaianNonTahfizh(
        KategoriCapaian.SHOLAT_TAHAJJUD,
        0,
        { p1: 3, p2: 3, p3: 3, p4: 3 } // Total 12 malam
      );

      assert.equal(res.penambahanBulanIni, 12);
      assert.equal(res.targetMin, 15);
      assert.equal(res.isTuntas, false);
    });
  });

  describe("5. Generator Ringkasan Teks Tasmi' & Sima'an", () => {
    it("harus menyusun ringkasan teks otomatis pola Excel", () => {
      const riwayat = [
        { jenis: JenisUjiHafalan.SIMAAN, nilai: 95 },
        { jenis: JenisUjiHafalan.SIMAAN, nilai: 90 },
        { jenis: JenisUjiHafalan.TASMI, nilai: 94 },
      ];

      const res = generateRingkasanTasmiSimaan(riwayat);
      assert.equal(res.countSimaan, 2);
      assert.equal(res.countTasmi, 1);
      assert.equal(res.rataRataNilai, 93.0);
      assert.match(res.ringkasanTeks, /Telah melakukan 2 kali Sima'an dan 1 kali Tasmi'/);
      assert.match(res.ringkasanTeks, /rata-rata nilai 93/);
    });

    it("harus menangani kasus jika belum pernah ada ujian", () => {
      const res = generateRingkasanTasmiSimaan([]);
      assert.equal(res.countTasmi, 0);
      assert.equal(res.countSimaan, 0);
      assert.match(res.ringkasanTeks, /Belum melaksanakan/);
    });
  });
});
