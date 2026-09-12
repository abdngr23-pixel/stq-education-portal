import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

describe("P0 Data Honesty & Mobile Accessibility (Akademik & Rapor)", () => {
  const akademikPath = path.resolve(
    process.cwd(),
    "components/modules/akademik-module.tsx"
  );
  const printRaporPath = path.resolve(
    process.cwd(),
    "components/print/print-rapor.tsx"
  );

  const akademikContent = fs.readFileSync(akademikPath, "utf-8");
  const printRaporContent = fs.readFileSync(printRaporPath, "utf-8");

  // =========================================================================
  // 1. ELIMINASI DATA NILAI MOCK / HARDCODED DI AKADEMIK
  // =========================================================================
  describe("1. Eliminasi Data Nilai Mock Akademik", () => {
    it("tidak boleh mendefinisikan konstanta INITIAL_NILAI mock", () => {
      assert.ok(
        !akademikContent.includes("INITIAL_NILAI"),
        "INITIAL_NILAI mock tidak boleh ada di akademik-module.tsx"
      );
    });

    it("tidak boleh menginisialisasi state nilaiList dengan data mock hardcoded", () => {
      assert.ok(
        !akademikContent.includes("useState<NilaiItem[]>(INITIAL_NILAI)"),
        "nilaiList tidak boleh diinisialisasi dengan INITIAL_NILAI"
      );
      assert.ok(
        akademikContent.includes("useState<NilaiItem[]>([])"),
        "nilaiList harus diinisialisasi dengan array kosong []"
      );
    });

    it("tidak boleh ada fallback ke data mock saat getNilaiBySantriId gagal atau kosong", () => {
      assert.ok(
        !akademikContent.includes("setNilaiList(INITIAL_NILAI)"),
        "Fallback ke INITIAL_NILAI dilarang keras saat data kosong/error"
      );
    });

    it("harus memiliki empty state yang jujur saat nilaiList kosong", () => {
      assert.ok(
        akademikContent.includes("Belum ada data nilai untuk santri ini") ||
        akademikContent.includes("Belum ada data nilai"),
        "Komponen harus menampilkan pesan data nilai belum diinput saat array kosong"
      );
    });
  });

  // =========================================================================
  // 2. ELIMINASI FALLBACK HARDCODED DI PRINT RAPOR
  // =========================================================================
  describe("2. Eliminasi Fallback Hardcoded Print Rapor", () => {
    it("tidak boleh memuat fallback hafalan hardcoded 'Ali 'Imran: 1-20'", () => {
      assert.ok(
        !printRaporContent.includes("Ali 'Imran: 1-20") &&
        !printRaporContent.includes("Ali \\'Imran: 1-20"),
        "Fallback hardcoded 'Ali Imran: 1-20' dilarang ada di print-rapor.tsx"
      );
    });

    it("harus menggunakan fallback jujur '-' jika capaian setoran terakhir tidak tersedia", () => {
      assert.ok(
        printRaporContent.includes('{santri.setoranTerakhir || "-"}'),
        "Print rapor harus menampilkan '-' jika data setoran terakhir tidak ada"
      );
    });

    it("tidak boleh memuat predikat hardcoded '(A)' pada rata-rata kepesantrenan", () => {
      assert.ok(
        !printRaporContent.includes("Rata-rata: {avgKepesantrenan} (A)"),
        "Predikat '(A)' tidak boleh di-hardcode pada rata-rata kepesantrenan"
      );
    });

    it("harus menghitung predikat rata-rata secara dinamis via konversiPredikatNilai", () => {
      assert.ok(
        printRaporContent.includes("konversiPredikatNilai"),
        "Print rapor harus memanggil fungsi konversi predikat dinamis"
      );
    });

    it("tidak boleh menganggap 'MUMTAZ' sebagai fallback nilai/predikat jika data tidak ada", () => {
      assert.ok(
        !printRaporContent.includes('"MUMTAZ"') && !printRaporContent.includes("'MUMTAZ'"),
        "String 'MUMTAZ' tidak boleh dijadikan fallback nilai/predikat hardcoded"
      );
    });

    it("tidak boleh memuat klaim kepatuhan 'Tuntas 100%' secara hardcoded", () => {
      assert.ok(
        !printRaporContent.includes("Tuntas 100%"),
        "Klaim 'Tuntas 100%' tidak boleh di-hardcode di tabel aspek tahfizh"
      );
    });

    it("tidak boleh memuat indikator kelayakan/kenaikan semester hardcoded (98.5%, Bebas SP, Istiqomah Jamaah)", () => {
      assert.ok(
        !printRaporContent.includes("98.5%"),
        "Klaim kehadiran 98.5% tidak boleh di-hardcode"
      );
      assert.ok(
        !printRaporContent.includes("Bebas SP (0 Poin)"),
        "Klaim kedisiplinan 'Bebas SP (0 Poin)' tidak boleh di-hardcode"
      );
      assert.ok(
        !printRaporContent.includes("Istiqomah Jamaah"),
        "Klaim ibadah 'Istiqomah Jamaah' tidak boleh di-hardcode"
      );
      assert.ok(
        !printRaporContent.includes("✓ Tuntas Target"),
        "Klaim '✓ Tuntas Target' tidak boleh di-hardcode"
      );
      assert.ok(
        !printRaporContent.includes("✓ Memenuhi KKM"),
        "Klaim '✓ Memenuhi KKM' tidak boleh di-hardcode"
      );
      assert.ok(
        !printRaporContent.includes("✓ Portofolio Lengkap"),
        "Klaim '✓ Portofolio Lengkap' tidak boleh di-hardcode"
      );
    });

    it("kriteria kenaikan semester harus menampilkan status netral 'Belum dinilai' saat data belum tersedia", () => {
      assert.ok(
        printRaporContent.includes("Belum dinilai"),
        "Kriteria semester harus memuat fallback netral 'Belum dinilai'"
      );
    });

    it("keputusan kenaikan tidak boleh otomatis 'NAIK TINGKAT' tanpa data resmi", () => {
      assert.ok(
        printRaporContent.includes("Belum ditetapkan"),
        "Keputusan dewan penguji harus berstatus 'Belum ditetapkan' jika belum ada data resmi"
      );
    });

    it("catatan pembina tidak boleh memuat narasi evaluasi palsu dan harus berstatus jujur", () => {
      assert.ok(
        !printRaporContent.includes("Alhamdulillah ananda istiqomah dalam sabaq dan murojaah"),
        "Narasi evaluasi palsu dilarang keras di catatan pembina"
      );
      assert.ok(
        printRaporContent.includes("Belum ada catatan pembina."),
        "Catatan pembina harus menampilkan 'Belum ada catatan pembina.' saat kosong"
      );
    });
  });

  // =========================================================================
  // 3. RESPONSIVE & MOBILE ACCESSIBILITY PADA TABEL RAPOR
  // =========================================================================
  describe("3. Responsive Layout Rapor Santri", () => {
    it("harus menyediakan tampilan stacked card untuk mobile (md:hidden)", () => {
      assert.ok(
        akademikContent.includes("md:hidden"),
        "Tabel rapor harus menyediakan alternatif mobile stacked card"
      );
    });

    it("sub-nav tabs akademik harus memiliki horizontal scroll container aman untuk mobile", () => {
      assert.ok(
        akademikContent.includes("overflow-x-auto"),
        "Sub-nav tabs akademik harus memiliki container overflow-x-auto"
      );
    });
  });
});
