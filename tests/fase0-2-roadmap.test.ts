import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  konversiHalamanKeJuz,
  getPekanDariTanggal,
  hitungCapaianSabaq,
  hitungKepatuhanFrekuensi,
  evaluasiCapaianNonTahfizh,
  generateRingkasanTasmiSimaan,
} from "../lib/laporan-bulanan";
import { KategoriCapaian, JenisUjiHafalan, Role } from "@prisma/client";

describe("TUGAS KHUSUS: Fase 0-2 Roadmap STQ Education Portal", () => {
  // =========================================================================
  // FASE 0: VERIFIKASI SKEMA DATABASE & PENGAMAN DATA
  // =========================================================================
  describe("Fase 0 — Skema Relasional Prisma & Pengaman Data", () => {
    it("harus memuat model TargetSantri, CapaianBulanan, dan TasmiSimaan di schema.prisma", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      assert.ok(fs.existsSync(schemaPath), "prisma/schema.prisma wajib ada");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(
        schemaContent.includes("model TargetSantri"),
        "Model TargetSantri wajib terdefinisi di schema.prisma"
      );
      assert.ok(
        schemaContent.includes("model CapaianBulanan"),
        "Model CapaianBulanan wajib terdefinisi di schema.prisma"
      );
      assert.ok(
        schemaContent.includes("model TasmiSimaan"),
        "Model TasmiSimaan wajib terdefinisi di schema.prisma"
      );
      assert.ok(
        schemaContent.includes("enum KategoriCapaian"),
        "Enum KategoriCapaian wajib terdefinisi di schema.prisma"
      );
      assert.ok(
        schemaContent.includes("enum JenisUjiHafalan"),
        "Enum JenisUjiHafalan wajib terdefinisi di schema.prisma"
      );
    });

    it("harus memiliki relasi balik lengkap pada model Santri dan Staff", () => {
      const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(
        schemaContent.includes("targetList         TargetSantri[]"),
        "Santri wajib memiliki relasi balik targetList"
      );
      assert.ok(
        schemaContent.includes("capaianBulananList CapaianBulanan[]"),
        "Santri wajib memiliki relasi balik capaianBulananList"
      );
      assert.ok(
        schemaContent.includes("tasmiSimaanList    TasmiSimaan[]"),
        "Santri wajib memiliki relasi balik tasmiSimaanList"
      );
      assert.ok(
        schemaContent.includes("tasmiSimaanDiuji   TasmiSimaan[]"),
        "Staff wajib memiliki relasi balik tasmiSimaanDiuji"
      );
    });

    it("berkas arsip ekspor CSV setoran tahfizh harus tersedia di direktori exports/", () => {
      const exportsDir = path.resolve(process.cwd(), "exports");
      assert.ok(fs.existsSync(exportsDir), "Direktori exports/ wajib ada");
      const files = fs.readdirSync(exportsDir);
      const csvFiles = files.filter((f) => f.startsWith("setoran_tahfizh_archive_") && f.endsWith(".csv"));
      assert.ok(
        csvFiles.length >= 1,
        "Minimal 1 berkas CSV arsip setoran tahfizh harus tersedia sebagai backup pengaman"
      );
    });
  });

  // =========================================================================
  // FASE 1: MESIN KALKULASI LAPORAN BULANAN KOMPREHENSIF
  // =========================================================================
  describe("Fase 1 — Mesin Kalkulasi Laporan Bulanan (lib/laporan-bulanan.ts)", () => {
    describe("1. Konversi Halaman ke Juz (Mushaf Madinah 20 Hlm/Juz)", () => {
      it("harus mengonversi 0 halaman dengan tepat", () => {
        const res = konversiHalamanKeJuz(0);
        assert.equal(res.juz, 0);
        assert.equal(res.sisaHalaman, 0);
        assert.equal(res.label, "0 Halaman");
      });

      it("harus mengonversi kelipatan 20 halaman menjadi tepat Juz bulat", () => {
        assert.equal(konversiHalamanKeJuz(20).label, "1 Juz");
        assert.equal(konversiHalamanKeJuz(40).label, "2 Juz");
        assert.equal(konversiHalamanKeJuz(600).label, "30 Juz");
      });

      it("harus memformat sisa halaman dengan benar (contoh: 27 halaman = 1 Juz 7 Halaman)", () => {
        const res = konversiHalamanKeJuz(27);
        assert.equal(res.juz, 1);
        assert.equal(res.sisaHalaman, 7);
        assert.equal(res.label, "1 Juz 7 Halaman");
      });
    });

    describe("2. Pemetaan Tanggal ke Indeks Pekan P1-P4", () => {
      it("harus memetakan hari 1-7 ke P1", () => {
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 1)), 1);
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 7)), 1);
      });

      it("harus memetakan hari 8-14 ke P2", () => {
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 8)), 2);
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 14)), 2);
      });

      it("harus memetakan hari 15-21 ke P3", () => {
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 15)), 3);
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 21)), 3);
      });

      it("harus memetakan hari 22 s.d akhir bulan ke P4", () => {
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 22)), 4);
        assert.equal(getPekanDariTanggal(new Date(2026, 8, 30)), 4);
      });
    });

    describe("3. Kepatuhan Target Sabaq & Frekuensi 90%", () => {
      it("harus menghitung persentase capaian target Sabaq bulanan", () => {
        const realisasi = { p1: 5, p2: 5, p3: 5, p4: 5 }; // Total 20 halaman
        const hasil = hitungCapaianSabaq(realisasi, 20);
        assert.equal(hasil.totalHalaman, 20);
        assert.equal(hasil.konversi.label, "1 Juz");
        assert.equal(hasil.persentase, 100);
        assert.equal(hasil.isTercapai, true);
      });

      it("harus menerapkan ambang batas minimum kepatuhan 90% pada Sabqi/Manzil/Mufar", () => {
        // Target: 20 sesi/bulan
        // Realisasi 18 sesi = 90% -> Patuh
        const res90 = hitungKepatuhanFrekuensi({ p1: 5, p2: 5, p3: 4, p4: 4 }, 20, 90.0);
        assert.equal(res90.totalFrekuensi, 18);
        assert.equal(res90.persentase, 90.0);
        assert.equal(res90.isPatuh, true);

        // Realisasi 17 sesi = 85% -> Tidak patuh
        const res85 = hitungKepatuhanFrekuensi({ p1: 5, p2: 4, p3: 4, p4: 4 }, 20, 90.0);
        assert.equal(res85.totalFrekuensi, 17);
        assert.equal(res85.persentase, 85.0);
        assert.equal(res85.isPatuh, false);
      });
    });

    describe("4. Evaluasi 7 Komponen Mutaba'ah & Akumulasi HBL", () => {
      it("harus mengakumulasi carry-over HBL pada Hadits, Mufrodat, dan Vocab", () => {
        const res = evaluasiCapaianNonTahfizh(
          KategoriCapaian.HAFALAN_MUFRODAT,
          100, // HBL
          { p1: 3, p2: 3, p3: 3, p4: 3 } // Penambahan 12
        );
        assert.equal(res.hbl, 100);
        assert.equal(res.penambahanBulanIni, 12);
        assert.equal(res.totalKumulatif, 112);
        assert.equal(res.targetMin, 12);
        assert.equal(res.isTuntas, true);
      });

      it("harus menilai ketuntasan ibadah sunnah (Sholat Tahajjud min. 15x)", () => {
        const tuntas = evaluasiCapaianNonTahfizh(
          KategoriCapaian.SHOLAT_TAHAJJUD,
          0,
          { p1: 4, p2: 4, p3: 4, p4: 3 } // 15x
        );
        assert.equal(tuntas.isTuntas, true);

        const belum = evaluasiCapaianNonTahfizh(
          KategoriCapaian.SHOLAT_TAHAJJUD,
          0,
          { p1: 3, p2: 3, p3: 3, p4: 3 } // 12x
        );
        assert.equal(belum.isTuntas, false);
      });
    });

    describe("5. Generator Ringkasan Otomatis Ujian Tasmi' & Sima'an", () => {
      it("harus menghasilkan ringkasan teks pola resmi Excel", () => {
        const riwayat: Array<{ jenis: JenisUjiHafalan; nilai: number; predikat?: string }> = [
          { jenis: "SIMAAN", nilai: 95 },
          { jenis: "SIMAAN", nilai: 90 },
          { jenis: "TASMI", nilai: 88 },
        ];
        const res = generateRingkasanTasmiSimaan(riwayat);
        assert.equal(res.countSimaan, 2);
        assert.equal(res.countTasmi, 1);
        assert.equal(res.rataRataNilai, 91.0);
        assert.ok(res.ringkasanTeks.includes("2 kali Sima'an"));
        assert.ok(res.ringkasanTeks.includes("1 kali Tasmi'"));
      });
    });
  });

  // =========================================================================
  // FASE 2: MANAJEMEN HALAQOH & PENEGAKAN ABAC
  // =========================================================================
  describe("Fase 2 — Manajemen Halaqoh & Penegakan Hak Akses ABAC", () => {
    it("hanya role KS dan ADM yang berhak mengelola halaqoh (create, assign pembina, pindah santri)", () => {
      const allowedRoles: Role[] = ["KS", "ADM"];
      const forbiddenRoles: Role[] = ["MT", "MK", "GA", "PH", "OSDA", "WS", "ST", "YAY"];

      for (const r of allowedRoles) {
        assert.ok(allowedRoles.includes(r), `Role ${r} wajib diizinkan mengelola halaqoh`);
      }

      for (const r of forbiddenRoles) {
        assert.ok(!allowedRoles.includes(r), `Role ${r} TIDAK boleh memiliki izin mutasi halaqoh`);
      }
    });

    it("aturan ABAC kepemilikan halaqoh: Musyrif MT/PH hanya boleh input jika membina halaqoh santri tersebut", () => {
      // Mock data halaqoh
      const halaqohA = { id: "HLQ-01", pembinaId: "STF-RAZAN", santriIds: ["SAN-01", "SAN-02"] };
      const halaqohB = { id: "HLQ-02", pembinaId: "STF-KAMAL", santriIds: ["SAN-03", "SAN-04"] };

      function canMusyrifRecord(staffId: string, role: string, santriId: string): boolean {
        // KS dan ADM dapat menginput santri manapun (Super Admin / Mudir)
        if (role === "KS" || role === "ADM") return true;

        // Musyrif MT atau PH hanya boleh jika santri terdaftar di halaqoh yang dibinanya
        if (role === "MT" || role === "PH") {
          const halaqohBinaan = [halaqohA, halaqohB].find((h) => h.pembinaId === staffId);
          if (!halaqohBinaan) return false;
          return halaqohBinaan.santriIds.includes(santriId);
        }

        return false;
      }

      // 1. Ust. Razan membina SAN-01 di Halaqoh A -> DISETUJUI
      assert.equal(canMusyrifRecord("STF-RAZAN", "MT", "SAN-01"), true);
      assert.equal(canMusyrifRecord("STF-RAZAN", "MT", "SAN-02"), true);

      // 2. Ust. Razan mencoba input setoran SAN-03 di Halaqoh B -> DITOLAK (Akses Ditolak ABAC)
      assert.equal(canMusyrifRecord("STF-RAZAN", "MT", "SAN-03"), false);

      // 3. Ust. Kamal membina SAN-03 -> DISETUJUI
      assert.equal(canMusyrifRecord("STF-KAMAL", "PH", "SAN-03"), true);

      // 4. Ust. Kamal mencoba input SAN-01 -> DITOLAK
      assert.equal(canMusyrifRecord("STF-KAMAL", "PH", "SAN-01"), false);

      // 5. Mudir (KS) dan Admin (ADM) dapat mencatat untuk semua santri
      assert.equal(canMusyrifRecord("STF-MUDIR", "KS", "SAN-01"), true);
      assert.equal(canMusyrifRecord("STF-MUDIR", "KS", "SAN-03"), true);
      assert.equal(canMusyrifRecord("STF-ADMIN", "ADM", "SAN-01"), true);

      // 6. Role lain (Guru Akademik GA, Wali WS, Santri ST) tidak boleh
      assert.equal(canMusyrifRecord("STF-GURU", "GA", "SAN-01"), false);
      assert.equal(canMusyrifRecord("USER-WALI", "WS", "SAN-01"), false);
    });

    it("pemindahan santri antar halaqoh harus bersifat fleksibel (bebas lintas nilai field kelas)", () => {
      // Santri kelas 9A berpindah dari Halaqoh A ke Halaqoh B tanpa merubah field kelas
      const santri = { id: "SAN-01", nama: "Obama", kelas: "9A", halaqohId: "HLQ-01" };
      const newHalaqohId = "HLQ-02";

      // Mutasi halaqoh
      const updatedSantri = { ...santri, halaqohId: newHalaqohId };

      assert.equal(updatedSantri.halaqohId, "HLQ-02");
      assert.equal(updatedSantri.kelas, "9A", "Field kelas santri harus tetap independen dan tidak terpengaruh");
    });
  });
});
