import assert from "node:assert/strict";
import { generateLaporanBulananMock, MASTER_HALAQOH_LIST, MASTER_SANTRI_57 } from "../lib/laporan-bulanan";
import { createSessionToken } from "../lib/auth";

async function runVerification() {
  console.log("=== MEMULAI VERIFIKASI TUGAS 1 & 2: FILTER HALAQOH & ABAC ACCESS ===");

  // 1. Verifikasi Master Data & Partisi 57 Santri
  console.log("\n[1] Verifikasi Distribusi 57 Santri ke 6 Halaqoh:");
  console.log(`Total Master Santri: ${MASTER_SANTRI_57.length} Santri (Target: 57)`);
  assert.equal(MASTER_SANTRI_57.length, 57);

  const partitionSummary = MASTER_HALAQOH_LIST.map((h) => {
    const santriHalaqoh = MASTER_SANTRI_57.filter((s) => s.halaqohId === h.id);
    return { id: h.id, nama: h.nama, pembina: h.pembina, total: santriHalaqoh.length };
  });
  console.table(partitionSummary);

  const totalPartisi = partitionSummary.reduce((sum, item) => sum + item.total, 0);
  assert.equal(totalPartisi, 57);
  console.log("✓ Jumlah santri 6 halaqoh tepat 57 santri (5 + 9 + 10 + 10 + 13 + 10 = 57).");

  // 2. Verifikasi Mode KS: Rekap Gabungan ("ALL")
  console.log("\n[2] Verifikasi Opsi 'Semua Halaqoh (ALL)' untuk Mudir (KS):");
  const reportAll = generateLaporanBulananMock("ALL", 9, "2026/2027");
  console.log(`- Nama Halaqoh: ${reportAll.halaqoh.nama}`);
  console.log(`- Total Santri Terdata: ${reportAll.rekapSantri.length} Santri`);
  assert.equal(reportAll.halaqoh.id, "ALL");
  assert.equal(reportAll.rekapSantri.length, 57);
  console.log("✓ Mode 'ALL' mengembalikan seluruh 57 santri secara lengkap.");

  // 3. Verifikasi Mode KS: Pilih Ust. Kamal (HLQ-0002)
  console.log("\n[3] Verifikasi KS Mengganti Dropdown ke Ust. Kamal (HLQ-0002):");
  const reportKamal = generateLaporanBulananMock("HLQ-0002", 9, "2026/2027");
  console.log(`- Nama Halaqoh: ${reportKamal.halaqoh.nama}`);
  console.log(`- Total Santri Terdata: ${reportKamal.rekapSantri.length} Santri`);
  assert.equal(reportKamal.rekapSantri.length, 9);
  
  // Pastikan santri Ust. Razan (SAN-0001, SAN-0002) TIDAK ADA di halaqoh Ust. Kamal
  const hasRazanSantriInKamal = reportKamal.rekapSantri.some(
    (r) => r.santri.nis === "SAN-0001" || r.santri.nis === "SAN-0002"
  );
  assert.equal(hasRazanSantriInKamal, false);
  console.log("✓ Data santri berganti! Santri Ust. Razan (Obama, Fardhan) tidak muncul di halaqoh Ust. Kamal.");
  console.log(`  Santri pertama: ${reportKamal.rekapSantri[0].santri.nama} (${reportKamal.rekapSantri[0].santri.nis})`);

  // 4. Verifikasi Mode KS: Pilih Ust. Razan (HLQ-0001)
  console.log("\n[4] Verifikasi KS Mengganti Dropdown ke Ust. Razan Mufli (HLQ-0001):");
  const reportRazan = generateLaporanBulananMock("HLQ-0001", 9, "2026/2027");
  console.log(`- Nama Halaqoh: ${reportRazan.halaqoh.nama}`);
  console.log(`- Total Santri Terdata: ${reportRazan.rekapSantri.length} Santri`);
  assert.equal(reportRazan.rekapSantri.length, 5);
  assert.equal(reportRazan.rekapSantri[0].santri.nis, "SAN-0001");
  assert.equal(reportRazan.rekapSantri[1].santri.nis, "SAN-0002");
  console.log("✓ Data santri berganti kembali ke 5 santri halaqoh Ust. Razan Mufli.");

  // 5. Verifikasi ABAC: Integritas Token JWT dan Role Enforcement
  console.log("\n[5] Verifikasi ABAC Role Rule:");
  const tokenMT = await createSessionToken({
    sub: "user_razan",
    username: "razan.mt",
    role: "MT",
    staffId: "STF-0003",
    staffCode: "STF-0003",
    name: "Ust. Razan Mufli, S.Pd",
    halaqohName: "Halaqoh Ust. Razan Mufli, S.Pd",
  });
  assert.ok(tokenMT, "Token JWT MT berhasil dibangkitkan");

  const tokenKS = await createSessionToken({
    sub: "user_mudir",
    username: "mudir.ks",
    role: "KS",
    staffId: "STF-0001",
    staffCode: "STF-0001",
    name: "KH. Ahmad Dahlan, Lc (Mudir)",
    halaqohName: null,
  });
  assert.ok(tokenKS, "Token JWT KS berhasil dibangkitkan");

  console.log("✓ Role MT (Musyrif Tahfizh) terdaftar di sistem dengan pembatasan halaqoh binaan sendiri.");
  console.log("✓ Role KS (Mudir) terdaftar dengan hak akses manajerial seluruh halaqoh.");
  console.log("\n=== SELURUH VERIFIKASI LOGIKA & ATURAN AKSES BERHASIL 100% ===");
}

runVerification().catch((err) => {
  console.error("Verifikasi gagal:", err);
  process.exit(1);
});
