import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

describe("P0 Data Honesty & Production Baseline Metric Integrity (Santri & Halaqoh)", () => {
  const masterDataSantriPath = path.resolve(process.cwd(), "components/dashboard/master-data-santri.tsx");
  const dashboardAdminTUPath = path.resolve(process.cwd(), "components/dashboard/dashboard-admin-tu.tsx");
  const dashboardMusyrifPath = path.resolve(process.cwd(), "components/dashboard/dashboard-musyrif-tahfizh.tsx");
  const berandaModulePath = path.resolve(process.cwd(), "components/modules/beranda-module.tsx");
  const appPagePath = path.resolve(process.cwd(), "app/page.tsx");

  const masterDataSantriContent = fs.readFileSync(masterDataSantriPath, "utf-8");
  const dashboardAdminTUContent = fs.readFileSync(dashboardAdminTUPath, "utf-8");
  const dashboardMusyrifContent = fs.readFileSync(dashboardMusyrifPath, "utf-8");
  const berandaModuleContent = fs.readFileSync(berandaModulePath, "utf-8");
  const appPageContent = fs.readFileSync(appPagePath, "utf-8");

  // =========================================================================
  // 1. ELIMINASI METRIK HARDCODED "57 SANTRI" & "6 HALAQOH"
  // =========================================================================
  describe("1. Eliminasi Metrik Mock/Hardcoded", () => {
    it("tidak boleh memuat string hardcoded '57 Santri Aktif' di master-data-santri.tsx", () => {
      assert.ok(
        !masterDataSantriContent.includes("57 Santri Aktif"),
        "String '57 Santri Aktif' dilarang keras di master-data-santri.tsx"
      );
    });

    it("tidak boleh memuat string hardcoded '6 Halaqoh' di master-data-santri.tsx", () => {
      assert.ok(
        !masterDataSantriContent.includes('"6 Halaqoh"') &&
        !masterDataSantriContent.includes("'6 Halaqoh'"),
        "String '6 Halaqoh' dilarang keras di master-data-santri.tsx"
      );
    });

    it("tidak boleh memuat string hardcoded '5 Kelompok Halaqoh' di master-data-santri.tsx", () => {
      assert.ok(
        !masterDataSantriContent.includes("5 Kelompok Halaqoh"),
        "String '5 Kelompok Halaqoh' dilarang keras di master-data-santri.tsx"
      );
    });

    it("tidak boleh memuat badgeText hardcoded '57 Santri' di dashboard-admin-tu.tsx", () => {
      assert.ok(
        !dashboardAdminTUContent.includes('badgeText="57 Santri"'),
        "badgeText='57 Santri' dilarang keras di dashboard-admin-tu.tsx"
      );
      assert.ok(
        dashboardAdminTUContent.includes("${totalSantri} Santri") ||
        dashboardAdminTUContent.includes("`${totalSantri} Santri`"),
        "DashboardAdminTU harus menggunakan `${totalSantri} Santri` dinamis"
      );
    });
  });

  // =========================================================================
  // 2. INTEGRITAS STATE LOAD ERROR (DATA TIDAK TERSEDIA SAAT GAGAL)
  // =========================================================================
  describe("2. Integritas Penanganan Load Error", () => {
    it("MasterDataSantri menerima prop loadError dan menampilkan banner error saat gagal", () => {
      assert.ok(
        masterDataSantriContent.includes("loadError"),
        "MasterDataSantri harus memiliki prop loadError"
      );
      assert.ok(
        masterDataSantriContent.includes("Data Tidak Tersedia") ||
        masterDataSantriContent.includes("Gagal Memuat Data Santri"),
        "MasterDataSantri harus menyajikan pesan eksplisit saat loadError aktif"
      );
    });

    it("DashboardMusyrifTahfizh menampilkan status 'Data Tidak Tersedia' saat loadError", () => {
      assert.ok(
        dashboardMusyrifContent.includes("loadError"),
        "DashboardMusyrifTahfizh harus menerima prop loadError"
      );
      assert.ok(
        dashboardMusyrifContent.includes("Data Tidak Tersedia"),
        "DashboardMusyrifTahfizh harus menampilkan 'Data Tidak Tersedia' saat error"
      );
    });

    it("BerandaModule memproses santriLoadError secara eksplisit", () => {
      assert.ok(
        berandaModuleContent.includes("santriLoadError"),
        "BerandaModule harus menerima dan memproses santriLoadError"
      );
    });

    it("app/page.tsx tidak lagi menggunakan fallback data mock untuk santriSakitCount", () => {
      assert.ok(
        !appPageContent.includes('izinList.filter((i) => i.jenis === "SAKIT" && i.status === "DISETUJUI").length'),
        "santriSakitCount dilarang fallback ke izinList mock jika rekam medis 0"
      );
      assert.ok(
        appPageContent.includes("const santriSakitCount = activeKesehatanRecordsCount;"),
        "santriSakitCount harus langsung menggunakan activeKesehatanRecordsCount"
      );
    });
  });

  // =========================================================================
  // 3. PENGHAPUSAN AUDIT LOGS MOCK DI PAGE.TSX
  // =========================================================================
  describe("3. Penghapusan Mock Data di Inisialisasi Aplikasi", () => {
    it("INITIAL_AUDIT_LOGS harus kosong [] tanpa aktivitas palsu", () => {
      assert.ok(
        !appPageContent.includes("Ahmad Fauzi"),
        "Mock nama 'Ahmad Fauzi' dilarang ada di audit logs mock"
      );
      assert.ok(
        !appPageContent.includes("Zaid bin Tsabit"),
        "Mock halaqoh 'Zaid bin Tsabit' dilarang ada di audit logs mock"
      );
    });

    it("izinList, pelanggaranHistory, spList diinisialisasi kosong [] tanpa mock data", () => {
      assert.ok(
        appPageContent.includes("useState<IzinItem[]>([])"),
        "izinList harus diinisialisasi kosong []"
      );
      assert.ok(
        appPageContent.includes("useState<PelanggaranRecord[]>([])"),
        "pelanggaranHistory harus diinisialisasi kosong []"
      );
      assert.ok(
        appPageContent.includes("useState<SPRecord[]>([])"),
        "spList harus diinisialisasi kosong []"
      );
    });
  });

  // =========================================================================
  // 4. ELIMINASI SYNTHETIC FALLBACK TAHUN AJARAN & METADATA HALAQOH (Item B)
  // =========================================================================
  describe("4. Eliminasi Synthetic Fallback Tahun Ajaran (Item B)", () => {
    const santriModulePath = path.resolve(process.cwd(), "components/modules/santri-module.tsx");
    const manajemenHalaqohPath = path.resolve(process.cwd(), "components/dashboard/manajemen-halaqoh.tsx");
    const santriModuleContent = fs.readFileSync(santriModulePath, "utf-8");
    const manajemenHalaqohContent = fs.readFileSync(manajemenHalaqohPath, "utf-8");

    it("santri-module.tsx dilarang memalsukan tahunAjaran dengan fallback '2026/2027'", () => {
      assert.ok(
        !santriModuleContent.includes('"2026/2027"') && !santriModuleContent.includes("'2026/2027'"),
        "santri-module.tsx tidak boleh memiliki fallback synthetic '2026/2027'"
      );
      assert.ok(
        santriModuleContent.includes('tahunAjaran: h.tahunAjaran || "-"'),
        "santri-module.tsx harus menggunakan authoritative tahunAjaran atau fallback '-'"
      );
    });

    it("manajemen-halaqoh.tsx dilarang mengisi default newTahunAjaran dengan '2026/2027'", () => {
      assert.ok(
        !manajemenHalaqohContent.includes('useState("2026/2027")') &&
        !manajemenHalaqohContent.includes("useState('2026/2027')"),
        "newTahunAjaran tidak boleh di-default ke '2026/2027', wajib input eksplisit"
      );
      assert.ok(
        manajemenHalaqohContent.includes('TA: {h.tahunAjaran || "-"}'),
        "manajemen-halaqoh.tsx harus merender TA dari data authoritative atau '-'"
      );
      assert.ok(
        manajemenHalaqohContent.includes('{h.halaqohCode || "-"}'),
        "manajemen-halaqoh.tsx harus merender halaqohCode dari data authoritative atau '-'"
      );
    });
  });

  // =========================================================================
  // 5. KONTRAK INTEGRITAS ERROR != EMPTY (Item C)
  // =========================================================================
  describe("5. Kontrak Integritas Error != Empty (Izin, Pelanggaran, SP)", () => {
    const perizinanModulePath = path.resolve(process.cwd(), "components/modules/perizinan-module.tsx");
    const kedisiplinanModulePath = path.resolve(process.cwd(), "components/modules/kedisiplinan-module.tsx");
    const perizinanModuleContent = fs.readFileSync(perizinanModulePath, "utf-8");
    const kedisiplinanModuleContent = fs.readFileSync(kedisiplinanModulePath, "utf-8");

    it("app/page.tsx menggunakan Promise.allSettled untuk isolasi kegagalan perizinan, pelanggaran, SP", () => {
      assert.ok(
        appPageContent.includes("Promise.allSettled(["),
        "app/page.tsx harus menggunakan Promise.allSettled agar kegagalan satu domain tidak mengosongkan domain lainnya"
      );
      assert.ok(
        appPageContent.includes("setIzinLoadError"),
        "app/page.tsx harus mencatat izinLoadError secara mandiri"
      );
      assert.ok(
        appPageContent.includes("setPelanggaranLoadError"),
        "app/page.tsx harus mencatat pelanggaranLoadError secara mandiri"
      );
      assert.ok(
        appPageContent.includes("setSpLoadError"),
        "app/page.tsx harus mencatat spLoadError secara mandiri"
      );
    });

    it("izin fetch failure != zero izin (BerandaModule tidak boleh klaim 'Semua Tuntas' atau 0 berkas saat error)", () => {
      assert.ok(
        berandaModuleContent.includes("izinLoadError"),
        "BerandaModule harus menerima prop izinLoadError"
      );
      assert.ok(
        berandaModuleContent.includes('value={izinLoadError ? "Data Tidak Tersedia" : `${izinPendingCount} Berkas`}'),
        "StatCard Izin Menunggu harus menyajikan 'Data Tidak Tersedia' saat izinLoadError, bukan 0 Berkas"
      );
      assert.ok(
        berandaModuleContent.includes("Gagal memuat permohonan izin santri"),
        "Item antrean izin di BerandaModule harus menampilkan error alert saat izinLoadError aktif"
      );
      assert.ok(
        perizinanModuleContent.includes("Gagal Memuat Data Perizinan"),
        "PerizinanModule harus membedakan fetchError dari legitimate empty list"
      );
    });

    it("pelanggaran fetch failure != zero pelanggaran (KedisiplinanModule tidak boleh klaim 'Tidak ada pelanggaran' saat error)", () => {
      assert.ok(
        kedisiplinanModuleContent.includes("pelanggaranLoadError"),
        "KedisiplinanModule harus melacak pelanggaranLoadError"
      );
      assert.ok(
        kedisiplinanModuleContent.includes("Gagal memuat log pelanggaran"),
        "Tabel pelanggaran harus menampilkan status error eksplisit, bukan klaim bersih/tidak ada saat gagal"
      );
    });

    it("SP fetch failure != zero SP (StatCard Perlu Perhatian & KedisiplinanModule tidak boleh klaim aman saat error)", () => {
      assert.ok(
        berandaModuleContent.includes("spLoadError"),
        "BerandaModule harus menerima prop spLoadError"
      );
      assert.ok(
        berandaModuleContent.includes("spLoadError") &&
        berandaModuleContent.includes('"Data Tidak Lengkap"'),
        "StatCard Perlu Perhatian harus menampilkan 'Data Tidak Lengkap' saat spLoadError aktif"
      );
      assert.ok(
        kedisiplinanModuleContent.includes("spLoadError"),
        "KedisiplinanModule harus melacak spLoadError"
      );
      assert.ok(
        kedisiplinanModuleContent.includes("Gagal memuat status Surat Peringatan (SP)"),
        "KedisiplinanModule harus menampilkan error banner untuk SP saat spLoadError aktif"
      );
    });
  });
});
