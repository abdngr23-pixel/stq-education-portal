import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateSabaqPages,
  buildHistoricalPageOccupancy,
  validateProposedSabaqAllocation,
  calculateLatestSabaqPosition,
} from "../lib/tahfizh-page-allocation";

describe("KOREKSI P0.1 TAHFIZH — Production Unit Tests", () => {
  describe("1. Alokasi Multi-Halaman & Proporsionalitas (allocateSabaqPages)", () => {
    it("1. Setoran satu halaman: 422–422, volume 1 dialokasikan penuh { 422: 1.0 }", () => {
      const alloc = allocateSabaqPages(422, 422, 1);
      assert.deepEqual(alloc, { 422: 1.0 });
    });

    it("2. Setoran dua halaman: 422–423, volume 2 dialokasikan { 422: 1.0, 423: 1.0 }", () => {
      const alloc = allocateSabaqPages(422, 423, 2);
      assert.deepEqual(alloc, { 422: 1.0, 423: 1.0 });
    });

    it("3. Setoran 3, 5, dan 7 halaman dialokasikan proporsional", () => {
      // 3 Halaman: 422-424, vol 3
      const alloc3 = allocateSabaqPages(422, 424, 3);
      assert.deepEqual(alloc3, { 422: 1.0, 423: 1.0, 424: 1.0 });

      // 5 Halaman: 422-426, vol 5
      const alloc5 = allocateSabaqPages(422, 426, 5);
      assert.deepEqual(alloc5, { 422: 1.0, 423: 1.0, 424: 1.0, 425: 1.0, 426: 1.0 });

      // 7 Halaman: 422-428, vol 7
      const alloc7 = allocateSabaqPages(422, 428, 7);
      assert.equal(Object.keys(alloc7).length, 7);
      for (let p = 422; p <= 428; p++) {
        assert.equal(alloc7[p], 1.0);
      }
    });

    it("4. Setoran 2.5 halaman menjadi 1 + 1 + 0.5 (penuh-penuh-setengah pada halaman terakhir)", () => {
      const alloc = allocateSabaqPages(422, 424, 2.5);
      assert.deepEqual(alloc, { 422: 1.0, 423: 1.0, 424: 0.5 });
    });

    it("5. Penolakan volume/rentang yang tidak konsisten", () => {
      // Rentang 1 halaman diajukan volume 2
      assert.throws(() => allocateSabaqPages(422, 422, 2), /Inkonsistensi rentang halaman/);

      // Rentang 3 halaman diajukan volume 1
      assert.throws(() => allocateSabaqPages(422, 424, 1), /Inkonsistensi rentang halaman/);

      // Volume 0 atau negatif
      assert.throws(() => allocateSabaqPages(422, 422, 0), /Jumlah halaman tidak valid/);
      assert.throws(() => allocateSabaqPages(422, 422, -1), /Jumlah halaman tidak valid/);

      // Bukan kelipatan 0.5 (misal 0.7)
      assert.throws(() => allocateSabaqPages(422, 422, 0.7), /Jumlah halaman tidak valid/);

      // Halaman selesai lebih kecil dari mulai
      assert.throws(() => allocateSabaqPages(425, 422, 1), /Rentang halaman tidak valid/);
    });
  });

  describe("2. Validasi Kapasitas Halaman Maksimal 1.0 (validateProposedSabaqAllocation)", () => {
    it("6. Dua setoran 0.5 pada halaman sama diterima (0.5 + 0.5 = 1.0)", () => {
      const existing = [
        {
          id: "s-1",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 422,
          halamanSelesai: 422,
          jumlahHalaman: 0.5,
          tanggal: new Date("2026-09-08T08:00:00Z"),
        },
      ];

      const check = validateProposedSabaqAllocation(existing, 422, 422, 0.5);
      assert.equal(check.valid, true);
    });

    it("7. Setoran ketiga 0.5 pada halaman yang sudah penuh (1.0) ditolak", () => {
      const existing = [
        {
          id: "s-1",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 422,
          halamanSelesai: 422,
          jumlahHalaman: 0.5,
          tanggal: new Date("2026-09-08T08:00:00Z"),
        },
        {
          id: "s-2",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 422,
          halamanSelesai: 422,
          jumlahHalaman: 0.5,
          tanggal: new Date("2026-09-08T09:00:00Z"),
        },
      ];

      const check = validateProposedSabaqAllocation(existing, 422, 422, 0.5);
      assert.equal(check.valid, false);
      assert.match(check.message || "", /sudah lengkap disetorkan|melebihi kapasitas/);
    });

    it("8. Setoran berstatus DIBATALKAN tidak menghabiskan kapasitas halaman", () => {
      const existing = [
        {
          id: "s-cancelled-1",
          jenis: "SABAQ",
          status: "DIBATALKAN",
          halamanMulai: 582,
          halamanSelesai: 582,
          jumlahHalaman: 1.0,
          tanggal: new Date("2026-09-08T08:00:00Z"),
        },
        {
          id: "s-cancelled-2",
          jenis: "SABAQ",
          status: "DIBATALKAN",
          halamanMulai: 582,
          halamanSelesai: 582,
          jumlahHalaman: 1.0,
          tanggal: new Date("2026-09-08T09:00:00Z"),
        },
      ];

      const occupancy = buildHistoricalPageOccupancy(existing);
      assert.equal(occupancy[582] || 0, 0);

      const check = validateProposedSabaqAllocation(existing, 582, 582, 1.0);
      assert.equal(check.valid, true);
    });
  });

  describe("3. Perhitungan Posisi Terakhir & Rekomendasi (calculateLatestSabaqPosition)", () => {
    it("9. Posisi terakhir mengambil halaman tertinggi dari alokasi sah", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const sabaqList = [
        {
          id: "s-1",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 421,
          halamanSelesai: 423,
          jumlahHalaman: 3.0,
          tanggal: new Date("2026-09-09T08:00:00Z"),
        },
      ];

      const pos = calculateLatestSabaqPosition(sabaqList, 420, baseline);
      assert.equal(pos.posisiTerakhirHalaman, 423);
      assert.equal(pos.isHalamanTerakhirParsial, false);
      assert.equal(pos.saranHalamanMulai, 424);
      assert.equal(pos.saranJumlahHalaman, 1.0);
      assert.equal(pos.saranHalamanSelesai, 424);
    });

    it("12. Santri pada halaman 604 penuh tidak mendapat saran halaman 605", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const sabaqList = [
        {
          id: "s-khatam",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 604,
          halamanSelesai: 604,
          jumlahHalaman: 1.0,
          tanggal: new Date("2026-09-09T08:00:00Z"),
        },
      ];

      const pos = calculateLatestSabaqPosition(sabaqList, 603, baseline);
      assert.equal(pos.posisiTerakhirHalaman, 604);
      assert.equal(pos.isKhatam30Juz, true);
      assert.equal(pos.isHalamanTerakhirParsial, false);
      assert.equal(pos.saranHalamanMulai, null);
      assert.equal(pos.saranJumlahHalaman, null);
      assert.equal(pos.saranHalamanSelesai, null);
    });
  });

  describe("4. Proteksi Kapasitas Multi-Halaman & Alokasi Parsial", () => {
    it("10. Multi-halaman yang menabrak kapasitas sebagian halaman ditolak", () => {
      // Halaman 423 sudah terisi 0.5 oleh setoran sebelumnya
      const baseState = [
        {
          id: "s-exist-423",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 423,
          halamanSelesai: 423,
          jumlahHalaman: 0.5,
          tanggal: new Date("2026-09-09T08:00:00Z"),
        },
      ];

      // Pengajuan setoran 2 halaman: 422–423 volume 2 (memerlukan 1.0 pada 422 dan 1.0 pada 423)
      // Halaman 423 akan menjadi 0.5 + 1.0 = 1.5 (> 1.0) -> Harus DITOLAK
      const checkOverCapacity = validateProposedSabaqAllocation(baseState, 422, 423, 2.0);
      assert.equal(checkOverCapacity.valid, false);
      assert.match(checkOverCapacity.message || "", /melebihi kapasitas 1 halaman/i);
    });

    it("11. Validasi batas toleransi kapasitas floating-point aman terhadap pembulatan", () => {
      // Dua setoran 0.5 berturut-turut
      const state = [
        {
          id: "s-1",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 500,
          halamanSelesai: 500,
          jumlahHalaman: 0.5,
          tanggal: new Date("2026-09-09T08:00:00Z"),
        },
      ];

      const checkSecond = validateProposedSabaqAllocation(state, 500, 500, 0.5);
      assert.equal(checkSecond.valid, true);

      // Setelah 0.5 kedua tersimpan
      const stateFull = [
        ...state,
        {
          id: "s-2",
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 500,
          halamanSelesai: 500,
          jumlahHalaman: 0.5,
          tanggal: new Date("2026-09-09T09:00:00Z"),
        },
      ];

      // Setoran ketiga harus ditolak
      const checkThird = validateProposedSabaqAllocation(stateFull, 500, 500, 0.5);
      assert.equal(checkThird.valid, false);
    });
  });
});
