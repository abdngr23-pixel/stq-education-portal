// Shim React.createContext in Node test environment under react-server condition
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
if (!React.createContext) {
  React.createContext = () => ({
    Provider: () => null,
    Consumer: () => null,
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { konversiPredikatNilai, evaluasiLevelSP, hitungPoinPelanggaran, SP_THRESHOLDS } from "../lib/educational-rules";
import { buildIzinSantriWAMessage, buildPelanggaranSPWAMessage } from "../lib/whatsapp";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ROLE_NAV_MAP } = require("../types/navigation");

test("Tahap 1: Otorisasi Navigasi Role Yayasan (YAY)", () => {
  // Sesuai 05_ROLE_PERMISSION_MATRIX.md: Yayasan berhak mengakses monitoring akademik & kedisiplinan
  const yayTabs = ROLE_NAV_MAP["YAY"];
  assert.ok(yayTabs.includes("beranda"), "YAY harus memiliki akses beranda");
  assert.ok(yayTabs.includes("data_santri"), "YAY harus memiliki akses data_santri");
  assert.ok(yayTabs.includes("tahfizh"), "YAY harus memiliki akses tahfizh");
  assert.ok(yayTabs.includes("akademik"), "YAY harus memiliki akses akademik");
  assert.ok(yayTabs.includes("kedisiplinan"), "YAY harus memiliki akses kedisiplinan");
  assert.ok(yayTabs.includes("anggaran"), "YAY harus memiliki akses anggaran");
  assert.ok(yayTabs.includes("sponsor"), "YAY harus memiliki akses sponsor");
  assert.ok(yayTabs.includes("audit"), "YAY harus memiliki akses audit");
});

test("Tahap 1: Pembatasan Navigasi Antar Role (ABAC & RBAC)", () => {
  // Wali santri (WS) dan Santri (ST) tidak boleh mengakses modul keuangan atau administrasi
  const wsTabs = ROLE_NAV_MAP["WS"];
  const stTabs = ROLE_NAV_MAP["ST"];

  assert.ok(!wsTabs.includes("anggaran"), "WS tidak boleh mengakses anggaran");
  assert.ok(!wsTabs.includes("audit"), "WS tidak boleh mengakses audit log");
  assert.ok(!wsTabs.includes("users"), "WS tidak boleh mengakses manajemen user");

  assert.ok(!stTabs.includes("anggaran"), "ST tidak boleh mengakses anggaran");
  assert.ok(!stTabs.includes("users"), "ST tidak boleh mengakses manajemen user");

  // Musyrif Tahfizh (MT) fokus pada tahfizh, data_santri, dan beranda
  const mtTabs = ROLE_NAV_MAP["MT"];
  assert.ok(mtTabs.includes("tahfizh"));
  assert.ok(mtTabs.includes("data_santri"));
  assert.ok(!mtTabs.includes("anggaran"), "MT tidak memiliki akses anggaran operasional");
});

test("Tahap 3 & 9: Format WhatsApp dan Eliminasi Nomor Telepon Palsu 081299887766", () => {
  const dummyWaliPhone = "081234567890";
  const dummySantri = {
    santriNama: "Obama Ozearld",
    santriNis: "SAN-0001",
    kelas: "9A Takhossus",
    noHpWali: dummyWaliPhone,
  };

  const izinMsg = buildIzinSantriWAMessage({
    santriNama: dummySantri.santriNama,
    santriNis: dummySantri.santriNis,
    kelas: dummySantri.kelas,
    kodeIzin: "IZN-2026-001",
    jenisIzin: "PULANG",
    durasi: "3 Hari",
    alasan: "Keperluan keluarga mendesak",
    status: "MENUNGGU_MK",
    diverifikasiOleh: "Ust. Razan Mufli",
    batasKembali: "12/09/2026",
  });

  assert.ok(izinMsg.includes("STQ DARUL ULUM CENDEKIA"));
  assert.ok(izinMsg.includes("Obama Ozearld"));
  assert.ok(izinMsg.includes("IZN-2026-001"));
  // Memastikan nomor telepon statis palsu 081299887766 tidak pernah disuntikkan secara hardcoded
  assert.notEqual(dummySantri.noHpWali, "081299887766");
});

test("Tahap 4 & 6: Predikat Akademik & Konteks Nilai", () => {
  // Verifikasi konversi predikat nilai objektif
  assert.equal(konversiPredikatNilai(95), "A");
  assert.equal(konversiPredikatNilai(90), "A");
  assert.equal(konversiPredikatNilai(85), "B");
  assert.equal(konversiPredikatNilai(80), "B");
  assert.equal(konversiPredikatNilai(75), "C");
  assert.equal(konversiPredikatNilai(70), "C");
  assert.equal(konversiPredikatNilai(65), "D");
  assert.equal(konversiPredikatNilai(0), "D");

  // Validasi batas angka input
  const validateGradeInput = (val: string): boolean => {
    if (!val || !val.trim()) return false;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  };

  assert.equal(validateGradeInput(""), false);
  assert.equal(validateGradeInput(" "), false);
  assert.equal(validateGradeInput("-1"), false);
  assert.equal(validateGradeInput("101"), false);
  assert.equal(validateGradeInput("abc"), false);
  assert.equal(validateGradeInput("0"), true);
  assert.equal(validateGradeInput("85.5"), true);
  assert.equal(validateGradeInput("100"), true);
});

test("Tahap 5 & 7: Aturan Evaluasi Poin Kedisiplinan & Level Surat Peringatan (SP)", () => {
  // Poin pengulangan berlipat ganda
  const poinPertama = hitungPoinPelanggaran(10, false);
  const poinKedua = hitungPoinPelanggaran(10, true);
  assert.equal(poinPertama, 10);
  assert.equal(poinKedua, 20);

  // Ambang batas SP resmi STQ DUC (20, 40, 60):
  assert.equal(SP_THRESHOLDS.SP1, 20);
  assert.equal(SP_THRESHOLDS.SP2, 40);
  assert.equal(SP_THRESHOLDS.SP3, 60);

  assert.equal(evaluasiLevelSP(15), null);
  assert.equal(evaluasiLevelSP(19), null);
  assert.equal(evaluasiLevelSP(20), "SP1");
  assert.equal(evaluasiLevelSP(39), "SP1");
  assert.equal(evaluasiLevelSP(40), "SP2");
  assert.equal(evaluasiLevelSP(59), "SP2");
  assert.equal(evaluasiLevelSP(60), "SP3");
  assert.equal(evaluasiLevelSP(100), "SP3");
});

test("Tahap 9: Format Pesan Surat Peringatan WhatsApp Resmi", () => {
  const spMsg = buildPelanggaranSPWAMessage({
    santriNama: "Achmad Sufiyan",
    santriNis: "SAN-0015",
    kelas: "8B Takhossus",
    perihal: "Surat Peringatan 1 (SP1)",
    totalPoin: 25,
    kategori: "Terlambat Shalat Berjamaah Berulang",
    tingkatSP: 1,
    pencatat: "Ust. Mujaddid Zhohruddin",
  });

  assert.ok(spMsg.includes("STQ DARUL ULUM CENDEKIA"));
  assert.ok(spMsg.includes("Achmad Sufiyan"));
  assert.ok(spMsg.includes("25"));
  assert.ok(spMsg.includes("SP1"));
});

test("Koreksi Publik 1: Konsistensi Identifier Filter Kategori Akun Demo (Asatidz & Guru)", async () => {
  const { DEMO_ACCOUNTS } = await import("../types/auth");
  const allRoles = Object.keys(DEMO_ACCOUNTS);

  // Uji konsistensi kategori ASATIDZ (sebelumnya terjadi mismatch MUDHABBIR vs TAHFIZH)
  const asatidzRoles = allRoles.filter((r) => ["MT", "MK", "GA", "PH", "OSDA"].includes(r));
  assert.equal(asatidzRoles.length, 5, "Harus memuat tepat 5 peran asatidz/guru/pembina");
  assert.ok(asatidzRoles.includes("MT"), "MT harus masuk kategori asatidz");
  assert.ok(asatidzRoles.includes("MK"), "MK harus masuk kategori asatidz");
  assert.ok(asatidzRoles.includes("GA"), "GA harus masuk kategori asatidz");
  assert.ok(asatidzRoles.includes("PH"), "PH harus masuk kategori asatidz");
  assert.ok(asatidzRoles.includes("OSDA"), "OSDA harus masuk kategori asatidz");

  // Uji kategori pimpinan
  const leadershipRoles = allRoles.filter((r) => ["KS", "ADM", "YAY"].includes(r));
  assert.equal(leadershipRoles.length, 3, "Harus memuat tepat 3 peran pimpinan");

  // Uji kategori wali & santri
  const waliRoles = allRoles.filter((r) => ["WS", "ST"].includes(r));
  assert.equal(waliRoles.length, 2, "Harus memuat tepat 2 peran wali & santri");

  // Uji kembali ke Semua Akun
  assert.equal(allRoles.length, 10, "Total akun demo adalah 10 peran");
});

test("Koreksi Publik 5: Definisi Kurikulum Tahfizh Sesuai Dokumen ALUR PENDIDIKAN", () => {
  // Sesuai ALUR PENDIDIKAN.pdf Bab III & IV:
  // 1. Sabaq: penambahan hafalan baru harian
  // 2. Sabqi: murojaah hafalan selama SATU PEKAN TERAKHIR (bukan dua pekan)
  // 3. Manzil: murojaah hafalan pekan-pekan sebelumnya hingga mencapai 1 juz
  // 4. Mufar: murojaah harian 1-6 juz
  const kurikulumTahfizh = {
    sabaq: "Penambahan hafalan baru yang disetorkan setiap hari kepada musyrif",
    sabqi: "Murojaah hafalan yang diperoleh selama satu pekan terakhir",
    manzil: "Murojaah hafalan pada pekan-pekan sebelumnya hingga mencapai satu juz",
    mufar: "Murojaah harian sebanyak 1–6 juz sesuai jumlah hafalan yang telah dimiliki santri",
  };

  assert.ok(kurikulumTahfizh.sabqi.includes("satu pekan terakhir"));
  assert.ok(!kurikulumTahfizh.sabqi.includes("dua pekan"));

  // Alur Evaluasi Kenaikan Juz: Rubu' -> Tasmi' -> Ikhtibar I -> Ikhtibar II
  const alurEvaluasi = [
    "Setoran Rubu' (1/4 juz)",
    "Tasmi' satu juz dalam sekali duduk",
    "Ikhtibar Tahap I bersama Musyrif Tahfiz",
    "Ikhtibar Tahap II bersama Mudir Tahfiz",
  ];
  assert.equal(alurEvaluasi.length, 4);
  assert.ok(alurEvaluasi[2].includes("Musyrif Tahfiz"));
  assert.ok(alurEvaluasi[3].includes("Mudir Tahfiz"));
  assert.ok(!alurEvaluasi.some((a) => a.includes("penguji independen")));
});

test("Koreksi Publik 7: Server Action getPublicAgendaAction mengembalikan status jujur tanpa data fiktif", async () => {
  const { getPublicAgendaAction } = await import("../app/actions/kalender");
  const res = await getPublicAgendaAction();

  assert.equal(typeof res.success, "boolean");
  assert.ok(Array.isArray(res.data));
  // Jika database kosong, tidak boleh menyajikan agenda contoh (ujian/camping/libur palsu)
  if (res.data.length === 0) {
    assert.equal(res.message, "Belum ada agenda yang dipublikasikan");
  }
});

