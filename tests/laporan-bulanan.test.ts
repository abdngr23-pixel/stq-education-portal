import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  konversiHalamanKeJuz,
  getPekanDariTanggal,
  hitungCapaianSabaq,
  hitungAkumulasiSabaqSantri,
  hitungKepatuhanFrekuensi,
  hitungTargetMufar,
  hitungReferensiSabaqiKumulatif,
  evaluasiCapaianNonTahfizh,
  generateRingkasanTasmiSimaan,
  generateLaporanBulananMock,
  MASTER_HALAQOH_LIST,
  MASTER_SANTRI_57,
} from "../lib/laporan-bulanan";
import { ALL_MUSYRIF_TAHFIZH_ACCOUNTS } from "../types/auth";
import { KategoriCapaian, JenisUjiHafalan } from "@prisma/client";

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

    it("harus menghitung fitur pintar otomatis santri Muhammad Fardhan (317 + 16 = 333 Hlm -> 16 Juz 13 Halaman)", () => {
      // Kasus riil santri Muhammad Fardhan:
      // Modal awal: 317 Halaman (15 Juz 17 Halaman)
      // Pekan 1: +3, Pekan 2: +3, Pekan 3: +3, Pekan 4: +7 (Total tambahan = 16 Halaman)
      // Total hafalan bulan ini: 333 Halaman -> Otomatis tampilkan 16 Juz 13 Halaman
      const hasil = hitungAkumulasiSabaqSantri({
        modalAwalHalaman: 317,
        pekan: { p1: 3, p2: 3, p3: 3, p4: 7 },
        targetBulananHalaman: 20,
      });

      assert.equal(hasil.modalAwalHalaman, 317);
      assert.equal(hasil.konversiAwal.label, "15 Juz 17 Halaman");
      assert.equal(hasil.tambahanBulanIni, 16);
      assert.equal(hasil.totalAkumulasiHalaman, 333);
      assert.equal(hasil.konversiAkumulasi.juz, 16);
      assert.equal(hasil.konversiAkumulasi.sisaHalaman, 13);
      assert.equal(hasil.konversiAkumulasi.label, "16 Juz 13 Halaman");

      // Verifikasi juga melalui hitungCapaianSabaq dengan modal awal
      const hasilSabaq = hitungCapaianSabaq({ p1: 3, p2: 3, p3: 3, p4: 7 }, 20, 317);
      assert.equal(hasilSabaq.totalHalaman, 16);
      assert.equal(hasilSabaq.modalAwalHalaman, 317);
      assert.equal(hasilSabaq.akumulasiTotalHalaman, 333);
      assert.equal(hasilSabaq.konversiAkumulasi.label, "16 Juz 13 Halaman");
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

  describe("6. Master Halaqoh & Distribusi 57 Santri Riil DUC", () => {
    it("harus memiliki 6 master halaqoh resmi STQ DUC", () => {
      assert.equal(MASTER_HALAQOH_LIST.length, 6);
      assert.equal(MASTER_HALAQOH_LIST[0].id, "HLQ-0001");
      assert.equal(MASTER_HALAQOH_LIST[1].id, "HLQ-0002");
      assert.equal(MASTER_HALAQOH_LIST[2].id, "HLQ-0003");
      assert.equal(MASTER_HALAQOH_LIST[3].id, "HLQ-0004");
      assert.equal(MASTER_HALAQOH_LIST[4].id, "HLQ-0005");
      assert.equal(MASTER_HALAQOH_LIST[5].id, "HLQ-0006");
    });

    it("harus memiliki tepat 57 santri pada master database", () => {
      assert.equal(MASTER_SANTRI_57.length, 57);
    });

    it("harus mengembalikan seluruh 57 santri ketika halaqohId = 'ALL'", () => {
      const allReport = generateLaporanBulananMock("ALL", 9, "2026/2027");
      assert.equal(allReport.halaqoh.id, "ALL");
      assert.match(allReport.halaqoh.nama, /Semua Halaqoh/);
      assert.equal(allReport.rekapSantri.length, 57);
    });

    it("harus memfilter santri secara akurat per-halaqoh saat dipilih", () => {
      // HLQ-0001: Ust. Razan Mufli (5 santri)
      const razan = generateLaporanBulananMock("HLQ-0001", 9, "2026/2027");
      assert.equal(razan.rekapSantri.length, 5);
      assert.equal(razan.rekapSantri[0].santri.nis, "SAN-0001");
      assert.equal(razan.rekapSantri[1].santri.nis, "SAN-0002");

      // HLQ-0002: Ust. Kamal (9 santri)
      const kamal = generateLaporanBulananMock("HLQ-0002", 9, "2026/2027");
      assert.equal(kamal.rekapSantri.length, 9);
      assert.equal(kamal.rekapSantri[0].santri.nis, "SAN-0006");

      // HLQ-0003: Ust. Rizaldi (10 santri)
      const rizaldi = generateLaporanBulananMock("HLQ-0003", 9, "2026/2027");
      assert.equal(rizaldi.rekapSantri.length, 10);
      assert.equal(rizaldi.rekapSantri[0].santri.nis, "SAN-0015");

      // HLQ-0004: Ust. Abi Hudzaifah (10 santri)
      const hudzaifah = generateLaporanBulananMock("HLQ-0004", 9, "2026/2027");
      assert.equal(hudzaifah.rekapSantri.length, 10);
      assert.equal(hudzaifah.rekapSantri[0].santri.nis, "SAN-0025");

      // HLQ-0005: Ust. Alwan (13 santri)
      const alwan = generateLaporanBulananMock("HLQ-0005", 9, "2026/2027");
      assert.equal(alwan.rekapSantri.length, 13);
      assert.equal(alwan.rekapSantri[0].santri.nis, "SAN-0035");

      // HLQ-0006: Ustadzah Lisa Dwina Fitri (10 santri)
      const lisa = generateLaporanBulananMock("HLQ-0006", 9, "2026/2027");
      assert.equal(lisa.rekapSantri.length, 10);
      assert.equal(lisa.rekapSantri[0].santri.nis, "SAN-0048");

      // Total kumulatif harus tepat 57 santri
      const total =
        razan.rekapSantri.length +
        kamal.rekapSantri.length +
        rizaldi.rekapSantri.length +
        hudzaifah.rekapSantri.length +
        alwan.rekapSantri.length +
        lisa.rekapSantri.length;
      assert.equal(total, 57);
    });
  });

  describe("8. Target Mufar Dinamis (ACUAN_PROGRAM_TAHFIDZ_STQ_DUC_2026.docx)", () => {
    it("harus menghitung target Mufar 1 juz/hari untuk hafalan 1-5 Juz", () => {
      assert.equal(hitungTargetMufar(0), 1);
      assert.equal(hitungTargetMufar(1), 1);
      assert.equal(hitungTargetMufar(3), 1);
      assert.equal(hitungTargetMufar(5), 1);
    });

    it("harus menghitung target Mufar 2 juz/hari untuk hafalan 6-10 Juz", () => {
      assert.equal(hitungTargetMufar(6), 2);
      assert.equal(hitungTargetMufar(8), 2);
      assert.equal(hitungTargetMufar(10), 2);
    });

    it("harus menghitung target Mufar 3 juz/hari untuk hafalan 11-15 Juz", () => {
      assert.equal(hitungTargetMufar(11), 3);
      assert.equal(hitungTargetMufar(14), 3);
      assert.equal(hitungTargetMufar(15), 3);
    });

    it("harus menghitung target Mufar 4 juz/hari untuk hafalan 16-20 Juz", () => {
      assert.equal(hitungTargetMufar(16), 4);
      assert.equal(hitungTargetMufar(18), 4);
      assert.equal(hitungTargetMufar(20), 4);
    });

    it("harus menghitung target Mufar 5 juz/hari untuk hafalan 21-30 Juz", () => {
      assert.equal(hitungTargetMufar(21), 5);
      assert.equal(hitungTargetMufar(25), 5);
      assert.equal(hitungTargetMufar(30), 5);
    });

    it("harus otomatis menaikkan target saat hafalan santri bertambah (misal 5 juz ke 6 juz)", () => {
      const targetSebelum = hitungTargetMufar(5);
      const targetSesudah = hitungTargetMufar(6);
      assert.equal(targetSebelum, 1);
      assert.equal(targetSesudah, 2);
    });

    it("harus menghasilkan target dinamis dalam laporan bulanan mock per santri", () => {
      const mock = generateLaporanBulananMock("HLQ-0001", 9, "2026/2027");
      // Santri Obama (capaian 22 juz) -> target 5 juz/hari
      const obama = mock.rekapSantri.find((s) => s.santri.nis === "SAN-0001");
      assert.ok(obama);
      const obamaMufar = obama.tahfizh.mufar as { targetHarianJuz: number; targetLabel: string };
      assert.equal(obamaMufar.targetHarianJuz, 5);
      assert.equal(obamaMufar.targetLabel, "5 Juz/hari");

      // Santri Fardhan (capaian 16 juz) -> target 4 juz/hari
      const fardhan = mock.rekapSantri.find((s) => s.santri.nis === "SAN-0002");
      assert.ok(fardhan);
      const fardhanMufar = fardhan.tahfizh.mufar as { targetHarianJuz: number; targetLabel: string };
      assert.equal(fardhanMufar.targetHarianJuz, 4);
      assert.equal(fardhanMufar.targetLabel, "4 Juz/hari");
    });
  });

  describe("9. Pola Setoran Sabaqi Kumulatif (Senin-Jumat)", () => {
    it("harus menghitung referensi hari Senin (murojaah hafalan hari itu saja)", () => {
      // Senin: 2026-09-07
      const senin = new Date(2026, 8, 7);
      const ref = hitungReferensiSabaqiKumulatif({
        tanggal: senin,
        modalAwalHalaman: 317,
      });

      assert.equal(ref.hariNama, "Senin");
      assert.match(ref.polaKeterangan, /Senin saja/i);
      assert.equal(ref.totalHalaman, 1);
      assert.equal(ref.halamanMulai, 318);
      assert.equal(ref.halamanSelesai, 318);
    });

    it("harus menghitung referensi hari Selasa (kumulatif Senin-Selasa)", () => {
      // Selasa: 2026-09-08
      const selasa = new Date(2026, 8, 8);
      const ref = hitungReferensiSabaqiKumulatif({
        tanggal: selasa,
        modalAwalHalaman: 317,
      });

      assert.equal(ref.hariNama, "Selasa");
      assert.match(ref.polaKeterangan, /Senin–Selasa/i);
      assert.equal(ref.totalHalaman, 2);
      assert.equal(ref.halamanMulai, 318);
      assert.equal(ref.halamanSelesai, 319);
    });

    it("harus menghitung referensi hari Rabu (kumulatif Senin-Rabu)", () => {
      // Rabu: 2026-09-09
      const rabu = new Date(2026, 8, 9);
      const ref = hitungReferensiSabaqiKumulatif({
        tanggal: rabu,
        modalAwalHalaman: 317,
      });

      assert.equal(ref.hariNama, "Rabu");
      assert.match(ref.polaKeterangan, /Senin–Rabu/i);
      assert.equal(ref.totalHalaman, 3);
      assert.equal(ref.halamanMulai, 318);
      assert.equal(ref.halamanSelesai, 320);
    });

    it("harus menghitung referensi hari Kamis (kumulatif Senin-Kamis)", () => {
      // Kamis: 2026-09-10
      const kamis = new Date(2026, 8, 10);
      const ref = hitungReferensiSabaqiKumulatif({
        tanggal: kamis,
        modalAwalHalaman: 317,
      });

      assert.equal(ref.hariNama, "Kamis");
      assert.match(ref.polaKeterangan, /Senin–Kamis/i);
      assert.equal(ref.totalHalaman, 4);
      assert.equal(ref.halamanMulai, 318);
      assert.equal(ref.halamanSelesai, 321);
    });

    it("harus menghitung referensi hari Jumat (kumulatif seluruh pekan berjalan)", () => {
      // Jumat: 2026-09-11
      const jumat = new Date(2026, 8, 11);
      const ref = hitungReferensiSabaqiKumulatif({
        tanggal: jumat,
        modalAwalHalaman: 317,
      });

      assert.equal(ref.hariNama, "Jumat");
      assert.match(ref.polaKeterangan, /seluruh pekan/i);
      assert.equal(ref.totalHalaman, 5);
      assert.equal(ref.halamanMulai, 318);
      assert.equal(ref.halamanSelesai, 322);
    });
  });

  describe("10. Otoritas Kepala Bidang Tahfidz vs Musyrif Biasa (ABAC)", () => {
    it("Ust. Razan Mufli (Kepala Bidang Tahfidz) harus memiliki flag isKepalaBidangTahfidz = true", () => {
      const razan = ALL_MUSYRIF_TAHFIZH_ACCOUNTS.find((a) => a.username === "razan.mt");
      assert.ok(razan);
      assert.equal(razan.isKepalaBidangTahfidz, true);
    });

    it("Musyrif selain Kepala Bidang Tahfidz (misal Lisa MT) tidak boleh memiliki flag isKepalaBidangTahfidz = true", () => {
      const lisa = ALL_MUSYRIF_TAHFIZH_ACCOUNTS.find((a) => a.username === "lisa.mt");
      assert.ok(lisa);
      assert.equal(Boolean(lisa.isKepalaBidangTahfidz), false);
    });
  });
});
