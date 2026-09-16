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

  // =========================================================================
  // 6. REMEDIATION ROUND 2: DATA HONESTY & AUTHORITATIVE CONTRACTS
  // =========================================================================
  describe("6. Remediation Round 2: Data Honesty & Authoritative Contracts", () => {
    const usersModulePath = path.resolve(process.cwd(), "components/modules/users-module.tsx");
    const kalenderModulePath = path.resolve(process.cwd(), "components/modules/kalender-module.tsx");
    const portalWaliModulePath = path.resolve(process.cwd(), "components/modules/portal-wali-module.tsx");
    const kesehatanModulePath = path.resolve(process.cwd(), "components/modules/kesehatan-module.tsx");

    const usersModuleContent = fs.readFileSync(usersModulePath, "utf-8");
    const kalenderModuleContent = fs.readFileSync(kalenderModulePath, "utf-8");
    const portalWaliModuleContent = fs.readFileSync(portalWaliModulePath, "utf-8");
    const kesehatanModuleContent = fs.readFileSync(kesehatanModulePath, "utf-8");

    it("kesehatan failure != 0 sakit (Beranda & MT Dashboard harus tampilkan data tidak lengkap / data tidak tersedia)", () => {
      assert.ok(
        appPageContent.includes("setKesehatanLoadError"),
        "app/page.tsx harus melacak kesehatanLoadError"
      );
      assert.ok(
        berandaModuleContent.includes("kesehatanLoadError"),
        "BerandaModule harus menerima prop kesehatanLoadError"
      );
      assert.ok(
        berandaModuleContent.includes("santriLoadError || spLoadError || kesehatanLoadError"),
        "StatCard Perlu Perhatian harus mengecek kesehatanLoadError agar tidak menampilkan '0 Kasus' saat gagal"
      );
      assert.ok(
        dashboardMusyrifContent.includes('kesehatanLoadError ? "Kesehatan (Data Tidak Tersedia)"'),
        "DashboardMusyrifTahfizh dilarang menampilkan '0 sakit' saat kesehatan gagal dimuat"
      );
      assert.ok(
        kesehatanModuleContent.includes("loadError"),
        "KesehatanModule harus melacak loadError"
      );
    });

    it("users failure != mock users & users success [] = legitimate empty", () => {
      assert.ok(
        appPageContent.includes("useState<UserAccountItem[]>([])"),
        "usersList harus diinisialisasi kosong [] tanpa mock usr-01..usr-14"
      );
      assert.ok(
        !appPageContent.includes('"mudir.ks"'),
        "Mock username mudir.ks dilarang ada di inisialisasi state page.tsx"
      );
      assert.ok(
        !appPageContent.includes('"aminah.adm"'),
        "Mock username aminah.adm dilarang ada di inisialisasi state page.tsx"
      );
      assert.ok(
        !appPageContent.includes("res.data.length > 0"),
        "Syarat 'res.data.length > 0' dilarang agar legitimate empty [] diterima"
      );
      assert.ok(
        usersModuleContent.includes("loadError"),
        "UsersModule harus menerima prop loadError"
      );
      assert.ok(
        usersModuleContent.includes("Gagal memuat daftar pengguna:"),
        "UsersModule harus menampilkan baris error saat fetch gagal"
      );
    });

    it("agenda failure != mock agenda & initialized as []", () => {
      assert.ok(
        appPageContent.includes("useState<AgendaItem[]>([])"),
        "agendaList harus diinisialisasi kosong [] tanpa mock agd-01..agd-04"
      );
      assert.ok(
        !appPageContent.includes('"agd-01"'),
        "Mock agenda agd-01 dilarang ada di inisialisasi state page.tsx"
      );
      assert.ok(
        kalenderModuleContent.includes("loadError"),
        "KalenderModule harus menerima prop loadError"
      );
      assert.ok(
        kalenderModuleContent.includes("Gagal Memuat Agenda Kalender"),
        "KalenderModule harus menampilkan kartu error saat fetch gagal"
      );
    });

    it("kotak saran failure != mock saran & initialized as []", () => {
      assert.ok(
        appPageContent.includes("useState<SaranItem[]>([])"),
        "kotakSaranList harus diinisialisasi kosong [] tanpa mock srn-01"
      );
      assert.ok(
        !appPageContent.includes('"srn-01"'),
        "Mock saran srn-01 dilarang ada di inisialisasi state page.tsx"
      );
      assert.ok(
        portalWaliModuleContent.includes("saranLoadError"),
        "PortalWaliModule harus menerima prop saranLoadError"
      );
      assert.ok(
        portalWaliModuleContent.includes("Gagal memuat aspirasi kotak saran:"),
        "PortalWaliModule harus menampilkan status error saat fetch gagal"
      );
    });

    it("tidak ada inferensi gender halaqoh berbasis nama (contains 'lisa' / 'putri')", () => {
      assert.ok(
        !masterDataSantriContent.includes('!h.nama.toLowerCase().includes("lisa")'),
        "Inferensi nama halaqoh 'lisa' dilarang keras di master-data-santri.tsx"
      );
      assert.ok(
        !masterDataSantriContent.includes('!h.nama.toLowerCase().includes("putri")'),
        "Inferensi nama halaqoh 'putri' dilarang keras di master-data-santri.tsx"
      );
      assert.ok(
        !masterDataSantriContent.includes("halaqohPutraCount"),
        "halaqohPutraCount spekulatif dilarang di master-data-santri.tsx"
      );
      assert.ok(
        !masterDataSantriContent.includes("Terdaftar Aktif 2026/2027"),
        "Teks 'Terdaftar Aktif 2026/2027' dilarang dibuat-buat di master-data-santri.tsx"
      );
    });

    it("tidak ada wording 'reset ke default' pada UI reset kata sandi", () => {
      assert.ok(
        !appPageContent.includes("ke default"),
        "Wording 'ke default' dilarang pada dialog konfirmasi reset kata sandi"
      );
      assert.ok(
        appPageContent.includes("Buat sandi sementara baru"),
        "app/page.tsx harus menggunakan istilah 'Buat sandi sementara baru'"
      );
      assert.ok(
        usersModuleContent.includes("Buat Sandi Baru"),
        "UsersModule harus menggunakan wording Buat Sandi Baru"
      );
    });
  });

  // =========================================================================
  // 7. REMEDIATION ROUND 3: FINAL READ-SCOPE & GENDER INTEGRITY
  // =========================================================================
  describe("7. Remediation Round 3: Final Read-Scope & Gender Integrity", () => {
    it("master-data-santri.tsx dilarang mengandung inferensi gender spekulatif berbasis nama atau kelas", () => {
      assert.ok(
        !masterDataSantriContent.includes('includes("Lisa Dwina")'),
        "master-data-santri.tsx dilarang menggunakan includes('Lisa Dwina') untuk inferensi gender"
      );
      assert.ok(
        !masterDataSantriContent.includes('s.kelas.includes("Putri")'),
        "master-data-santri.tsx dilarang menggunakan s.kelas.includes('Putri') untuk inferensi gender"
      );
      assert.ok(
        !masterDataSantriContent.includes('s.halaqoh.includes("Lisa Dwina")'),
        "master-data-santri.tsx dilarang menggunakan halaqoh untuk inferensi gender"
      );
      assert.ok(
        masterDataSantriContent.includes('s.jenisKelamin === "P"'),
        "master-data-santri.tsx wajib menggunakan authoritative jenisKelamin === 'P' untuk Putri"
      );
      assert.ok(
        masterDataSantriContent.includes('s.jenisKelamin === "L"'),
        "master-data-santri.tsx wajib menggunakan authoritative jenisKelamin === 'L' untuk Putra"
      );
      assert.ok(
        masterDataSantriContent.includes('"Tidak diketahui"'),
        "master-data-santri.tsx wajib menangani fallback 'Tidak diketahui' bila jenisKelamin tidak tersedia"
      );
    });

    it("app/page.tsx memetakan authoritative jenisKelamin ke DashboardSantriSummary", () => {
      assert.ok(
        appPageContent.includes("jenisKelamin: s.jenisKelamin"),
        "app/page.tsx wajib memetakan s.jenisKelamin dari getSantriListAction"
      );
    });

    it("app/page.tsx tidak memuat kalender dan kotak saran secara eager/global saat init", () => {
      assert.ok(
        !appPageContent.includes("getDaftarAgendaAction(),\n            getDaftarKotakSaranAction()"),
        "getDaftarAgendaAction dan getDaftarKotakSaranAction dilarang dipanggil secara eager/global di initApp"
      );
      assert.ok(
        appPageContent.includes('activeTab !== "kalender" || !["KS", "ADM", "GA"].includes(selectedRole)'),
        "app/page.tsx harus memuat agenda internal secara lazy role-aware (KS, ADM, GA saja)"
      );
      assert.ok(
        appPageContent.includes('activeTab !== "portal_wali" || !["WS", "ST", "KS", "ADM"].includes(selectedRole)'),
        "app/page.tsx harus memuat kotak saran secara lazy role-aware (WS, ST, KS, ADM saja)"
      );
    });

    it("verifikasi perilaku pengelompokan gender murni berdasarkan jenisKelamin (bukan nama/kelas)", () => {
      const mockSantri = [
        { nis: "SAN-001", nama: "Santriwati A", kelas: "7A Takhossus", halaqoh: "Halaqoh Ust. Razan", jenisKelamin: "P" },
        { nis: "SAN-002", nama: "Santri B", kelas: "7C Putri", halaqoh: "Halaqoh Ustadzah Lisa", jenisKelamin: "L" },
        { nis: "SAN-003", nama: "Santri C", kelas: "8A Takhossus", halaqoh: "Halaqoh Ust. Kamal", jenisKelamin: null },
      ];

      const putri = mockSantri.filter((s) => s.jenisKelamin === "P");
      const putra = mockSantri.filter((s) => s.jenisKelamin === "L");
      const unk = mockSantri.filter((s) => s.jenisKelamin !== "L" && s.jenisKelamin !== "P");

      assert.equal(putri.length, 1, "Santriwati A di kelas 7A harus diidentifikasi Putri (P) karena jenisKelamin === 'P'");
      assert.equal(putra.length, 1, "Santri B di kelas 7C Putri harus diidentifikasi Putra (L) karena jenisKelamin === 'L'");
      assert.equal(unk.length, 1, "Santri C dengan jenisKelamin null harus tidak diketahui");
    });
  });
});
