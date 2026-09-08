import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatIndonesianPhone,
  generateWALink,
  buildSetoranTahfizhWAMessage,
  buildIzinSantriWAMessage,
  buildPelanggaranSPWAMessage,
  buildProgressSantriWAMessage,
  getJenisSetoranLabel,
  getNilaiLabel,
} from "../lib/whatsapp";

describe("WhatsApp Direct Link & Message Generator Tests", () => {
  describe("1. Sanitasi & Format Nomor Telepon Indonesia (formatIndonesianPhone)", () => {
    it("harus mengonversi format awalan 08xx menjadi 628xx standar internasional", () => {
      assert.equal(formatIndonesianPhone("081234567890"), "6281234567890");
      assert.equal(formatIndonesianPhone("085299887766"), "6285299887766");
    });

    it("harus membersihkan karakter pemisah seperti spasi, tanda strip, dan tanda kurung", () => {
      assert.equal(formatIndonesianPhone("0812-3456-7890"), "6281234567890");
      assert.equal(formatIndonesianPhone("(+62) 812 3456 7890"), "6281234567890");
      assert.equal(formatIndonesianPhone("+62812-3456-7890"), "6281234567890");
    });

    it("harus menambahkan awalan 62 jika nomor diawali angka 8 tanpa nol", () => {
      assert.equal(formatIndonesianPhone("81234567890"), "6281234567890");
    });

    it("harus mengembalikan string kosong jika parameter kosong, null, atau tidak valid (mencegah salah sasaran nomor dummy)", () => {
      assert.equal(formatIndonesianPhone(null), "");
      assert.equal(formatIndonesianPhone(""), "");
      assert.equal(formatIndonesianPhone("123"), "");
      assert.equal(generateWALink(null, "Test"), "");
      assert.equal(generateWALink("", "Test"), "");
    });
  });

  describe("2. Generator Tautan Universal WhatsApp (generateWALink)", () => {
    it("harus menghasilkan URL wa.me dengan nomor dan query text yang ter-encode rapi", () => {
      const link = generateWALink("081234567890", "Assalamu'alaikum Warahmatullahi Wabarakatuh");
      assert.ok(link.startsWith("https://wa.me/6281234567890?text="));
      assert.ok(link.includes(encodeURIComponent("Assalamu'alaikum Warahmatullahi Wabarakatuh")));
    });

    it("harus dapat menangani pesan multi-baris dan emoji dengan aman", () => {
      const multiLine = `Laporan Santri 📖\nNama: Ahmad Ghozi\nStatus: Lulus`;
      const link = generateWALink("085211223344", multiLine);
      assert.ok(link.startsWith("https://wa.me/6285211223344?text="));
      assert.ok(link.includes(encodeURIComponent("Ahmad Ghozi")));
    });
  });

  describe("3. Format Label Helper", () => {
    it("harus mengonversi kode jenis setoran ke label resmi", () => {
      assert.equal(getJenisSetoranLabel("SABAQ"), "Sabaq (Hafalan Baru)");
      assert.equal(getJenisSetoranLabel("SABQI"), "Sabqi (Muroja'ah Hafalan Baru)");
      assert.equal(getJenisSetoranLabel("MANZIL"), "Manzil (Muroja'ah Hafalan Mutqin)");
      assert.equal(getJenisSetoranLabel("MUFAR"), "Mufar (Pemantapan Khusus)");
    });

    it("harus mengonversi nilai setoran ke predikat berbobot", () => {
      assert.equal(getNilaiLabel("MUMTAZ"), "Mumtaz (Sempurna / A+)");
      assert.equal(getNilaiLabel("JAYYID_JIDDAN"), "Jayyid Jiddan (Sangat Baik / A)");
      assert.equal(getNilaiLabel("JAYYID"), "Jayyid (Baik / B)");
      assert.equal(getNilaiLabel("MAQBUL"), "Maqbul (Cukup / C)");
      assert.equal(getNilaiLabel("DHOIF"), "Dhoif (Perlu Mengulang / D)");
    });
  });

  describe("4. Template Laporan Setoran Tahfizh (buildSetoranTahfizhWAMessage)", () => {
    it("harus memuat seluruh rincian setoran tahfizh riil", () => {
      const msg = buildSetoranTahfizhWAMessage({
        santriNama: "Obama Ozearld Egberted Turizqi",
        santriNis: "SAN-0001",
        kelas: "9A Takhossus",
        namaWali: "H. Ridwan",
        jenisSetoran: "SABAQ",
        juz: 22,
        surah: "Al-Ahzab",
        ayatMulai: 1,
        ayatSelesai: 35,
        nilai: "MUMTAZ",
        catatan: "Makhraj huruf shad dan dhad sangat fasih",
        jumlahHalaman: 2,
        pembinaNama: "Ust. Razan Mufli, S.Pd",
      });

      assert.ok(msg.includes("Obama Ozearld Egberted Turizqi"));
      assert.ok(msg.includes("SAN-0001"));
      assert.ok(msg.includes("Sabaq (Hafalan Baru)"));
      assert.ok(msg.includes("QS. Al-Ahzab: 1–35"));
      assert.ok(msg.includes("2 Halaman"));
      assert.ok(msg.includes("Mumtaz (Sempurna / A+)"));
      assert.ok(msg.includes("Ust. Razan Mufli, S.Pd"));
      assert.ok(msg.includes("Makhraj huruf shad"));
      assert.ok(msg.includes("https://stq-education-portal-app-two.vercel.app"));
    });
  });

  describe("5. Template Notifikasi Perizinan Santri (buildIzinSantriWAMessage)", () => {
    it("harus memuat status perizinan santri dan batas kepulangan jika izin pulang", () => {
      const msg = buildIzinSantriWAMessage({
        santriNama: "Muhammad Fardhan",
        kelas: "9A",
        kodeIzin: "IZN-000002",
        jenisIzin: "PULANG",
        durasi: "2 Hari",
        alasan: "Menghadiri pernikahan keluarga di Makassar",
        status: "DISETUJUI",
        diverifikasiOleh: "Ust. Mujaddid Zhohruddin (MK) & Mudir (KS)",
        batasKembali: "Ahad pukul 17.00 WITA",
      });

      assert.ok(msg.includes("Muhammad Fardhan"));
      assert.ok(msg.includes("IZN-000002"));
      assert.ok(msg.includes("TELAH DISETUJUI"));
      assert.ok(msg.includes("Ahad pukul 17.00 WITA"));
    });
  });

  describe("6. Template Surat Peringatan & Kedisiplinan (buildPelanggaranSPWAMessage)", () => {
    it("harus menyusun peringatan kedisiplinan dan akumulasi poin santri secara santun", () => {
      const msg = buildPelanggaranSPWAMessage({
        santriNama: "M. Hafidzh",
        kelas: "7B",
        perihal: "Penerbitan 001/SP-1/DUC/2026",
        totalPoin: 30,
        kategori: "Kedisiplinan & Adab Asrama",
        tingkatSP: 1,
        tindakan: "Pemberian tugas murojaah tambahan dan pembinaan musyrif",
      });

      assert.ok(msg.includes("M. Hafidzh"));
      assert.ok(msg.includes("30 Poin"));
      assert.ok(msg.includes("SURAT PERINGATAN (SP 1) TERBIT"));
    });
  });

  describe("7. Template Rangkuman Capaian Hafalan (buildProgressSantriWAMessage)", () => {
    it("harus menghitung persentase capaian dan menampilkan target juz", () => {
      const msg = buildProgressSantriWAMessage({
        santriNama: "Achmad Sufiyan",
        santriNis: "SAN-0015",
        kelas: "8B Takhossus",
        halaqoh: "Halaqoh Ust. Rizaldi",
        capaianJuz: 8,
        targetJuz: 10,
        setoranTerakhir: "Al-A'raf: 1-30",
        nilaiTerakhir: "JAYYID",
        pembinaNama: "Ust. Rizaldi",
      });

      assert.ok(msg.includes("Achmad Sufiyan"));
      assert.ok(msg.includes("*8 Juz* dari target 10 Juz (80%)"));
      assert.ok(msg.includes("Halaqoh Ust. Rizaldi"));
      assert.ok(msg.includes("Ust. Rizaldi"));
    });
  });
});
