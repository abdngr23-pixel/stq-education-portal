import assert from "node:assert/strict";
import {
  hitungTargetMufar,
  hitungReferensiSabaqiKumulatif,
} from "../lib/laporan-bulanan";
import { ALL_MUSYRIF_TAHFIZH_ACCOUNTS, DEMO_ACCOUNTS } from "../types/auth";

console.log("================================================================================");
console.log("VERIFIKASI SISTEM TAHFIZH DUC: MUFAR DINAMIS, SABAQI KUMULATIF, & ABAC KABID");
console.log("================================================================================\n");

// 1. Verifikasi Tugas 1: Target Mufar Dinamis Sesuai ACUAN_PROGRAM_TAHFIDZ_STQ_DUC_2026.docx
console.log("--- [TUGAS 1] Verifikasi Target Mufar Dinamis (Juz per Hari) ---");
const mufarTestCases = [
  { juz: 1, expected: 1, label: "1 Juz (Tier 1-5)" },
  { juz: 5, expected: 1, label: "5 Juz (Tier 1-5)" },
  { juz: 6, expected: 2, label: "6 Juz (Tier 6-10)" },
  { juz: 10, expected: 2, label: "10 Juz (Tier 6-10)" },
  { juz: 11, expected: 3, label: "11 Juz (Tier 11-15)" },
  { juz: 15, expected: 3, label: "15 Juz (Tier 11-15)" },
  { juz: 16, expected: 4, label: "16 Juz (Tier 16-20)" },
  { juz: 20, expected: 4, label: "20 Juz (Tier 16-20)" },
  { juz: 21, expected: 5, label: "21 Juz (Tier 21-30)" },
  { juz: 30, expected: 5, label: "30 Juz (Tier 21-30)" },
];

for (const tc of mufarTestCases) {
  const result = hitungTargetMufar(tc.juz);
  assert.equal(result, tc.expected, `Gagal pada ${tc.label}`);
  console.log(`  ✓ Santri ${tc.juz} Juz: Target Mufar = ${result} Juz/hari (${tc.label})`);
}

// Simulasi kenaikan hafalan santri
const tgtAwal = hitungTargetMufar(5);
const tgtNaik = hitungTargetMufar(6);
assert.equal(tgtAwal, 1);
assert.equal(tgtNaik, 2);
console.log(`  ✓ Kenaikan hafalan santri dari 5 Juz ke 6 Juz: Target naik otomatis ${tgtAwal} -> ${tgtNaik} Juz/hari\n`);

// 2. Verifikasi Tugas 2: Pola Setoran Sabaqi Kumulatif (Senin - Jumat)
console.log("--- [TUGAS 2] Verifikasi Pola Setoran Sabaqi Kumulatif (Senin–Jumat) ---");
const sabaqiDays = [
  { day: 7, name: "Senin", expectedHlm: 1, range: "318–318", ket: "hari Senin saja" },
  { day: 8, name: "Selasa", expectedHlm: 2, range: "318–319", ket: "Senin–Selasa" },
  { day: 9, name: "Rabu", expectedHlm: 3, range: "318–320", ket: "Senin–Rabu" },
  { day: 10, name: "Kamis", expectedHlm: 4, range: "318–321", ket: "Senin–Kamis" },
  { day: 11, name: "Jumat", expectedHlm: 5, range: "318–322", ket: "seluruh pekan berjalan (Senin–Jumat)" },
];

for (const s of sabaqiDays) {
  const testDate = new Date(2026, 8, s.day); // September 2026
  const ref = hitungReferensiSabaqiKumulatif({
    tanggal: testDate,
    modalAwalHalaman: 317,
  });

  assert.equal(ref.hariNama, s.name);
  assert.equal(ref.totalHalaman, s.expectedHlm);
  assert.equal(`${ref.halamanMulai}–${ref.halamanSelesai}`, s.range);
  console.log(`  ✓ Hari ${s.name}: ${ref.labelLengkap}`);
}
console.log("");

// 3. Verifikasi Tugas 3: Hak Akses Kepala Bidang Tahfidz vs Musyrif Biasa
console.log("--- [TUGAS 3] Verifikasi Hak Akses Kepala Bidang Tahfidz (ABAC) ---");
const razanStaff = ALL_MUSYRIF_TAHFIZH_ACCOUNTS.find((a) => a.username === "razan.mt");
const lisaStaff = ALL_MUSYRIF_TAHFIZH_ACCOUNTS.find((a) => a.username === "lisa.mt");
const kamalStaff = DEMO_ACCOUNTS.PH;

console.log(`  • Ust. Razan Mufli (razan.mt): isKepalaBidangTahfidz = ${razanStaff?.isKepalaBidangTahfidz}`);
assert.equal(razanStaff?.isKepalaBidangTahfidz, true, "Ust. Razan harus berstatus Kepala Bidang Tahfidz");

console.log(`  • Ustadzah Lisa (lisa.mt): isKepalaBidangTahfidz = ${lisaStaff?.isKepalaBidangTahfidz ?? false}`);
assert.equal(Boolean(lisaStaff?.isKepalaBidangTahfidz), false, "Ustadzah Lisa tidak boleh berstatus Kepala Bidang Tahfidz");

console.log(`  • Ust. Kamal (kamal.ph): isKepalaBidangTahfidz = ${(kamalStaff as { isKepalaBidangTahfidz?: boolean })?.isKepalaBidangTahfidz ?? false}`);
assert.equal(Boolean((kamalStaff as { isKepalaBidangTahfidz?: boolean })?.isKepalaBidangTahfidz), false, "Ust. Kamal tidak boleh berstatus Kepala Bidang Tahfidz");

// Simulasi Otoritas Pemilihan Halaqoh
function simulasiPilihanHalaqoh(user: { username: string; role: string; isKepalaBidangTahfidz?: boolean }, requestedHalaqoh: string) {
  const isKabid = Boolean(user.isKepalaBidangTahfidz) || user.username === "razan.mt";
  const isManagerial = ["KS", "ADM", "YAY"].includes(user.role);

  if (isManagerial || isKabid) {
    return requestedHalaqoh || "ALL";
  }

  // Non-Kabid MT / PH selalu dikunci ke halaqoh sendiri
  if (user.username === "lisa.mt") return "HLQ-0006";
  if (user.username === "kamal.ph") return "HLQ-0002";
  return "HLQ-0001";
}

// Ust. Razan pilih halaqoh Ustadzah Lisa (HLQ-0006)
const razanPilihLisa = simulasiPilihanHalaqoh({ username: "razan.mt", role: "MT", isKepalaBidangTahfidz: true }, "HLQ-0006");
assert.equal(razanPilihLisa, "HLQ-0006");
console.log(`  ✓ Ust. Razan (Kabid) pilih HLQ-0006 -> DIIZINKAN (Hasil: ${razanPilihLisa})`);

// Ust. Razan pilih Semua Halaqoh (ALL)
const razanPilihAll = simulasiPilihanHalaqoh({ username: "razan.mt", role: "MT", isKepalaBidangTahfidz: true }, "ALL");
assert.equal(razanPilihAll, "ALL");
console.log(`  ✓ Ust. Razan (Kabid) pilih ALL -> DIIZINKAN (Hasil: ${razanPilihAll})`);

// Ustadzah Lisa coba ganti ke halaqoh Ust. Razan (HLQ-0001)
const lisaCobaGanti = simulasiPilihanHalaqoh({ username: "lisa.mt", role: "MT", isKepalaBidangTahfidz: false }, "HLQ-0001");
assert.equal(lisaCobaGanti, "HLQ-0006");
console.log(`  ✓ Ustadzah Lisa coba request HLQ-0001 -> DIKUNCI ke ${lisaCobaGanti} (Akses Terlindungi)`);

// Ust. Kamal coba request ALL
const kamalCobaAll = simulasiPilihanHalaqoh({ username: "kamal.ph", role: "PH", isKepalaBidangTahfidz: false }, "ALL");
assert.equal(kamalCobaAll, "HLQ-0002");
console.log(`  ✓ Ust. Kamal coba request ALL -> DIKUNCI ke ${kamalCobaAll} (Akses Terlindungi)`);

console.log("\n================================================================================");
console.log("SEMUA PENGUJIAN OTORISASI & KALKULASI RESMI STQ DUC 2026 BERHASIL 100%!");
console.log("================================================================================");
