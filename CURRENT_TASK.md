# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
PR #6 — Tahfizh Data Integrity & Target Operationalization untuk STQ Education Portal (`abdngr23-pixel/stq-education-portal`):
1. **Eliminasi Total Mock Generator & Isolasi Fixtures**:
   - Menghapus `generateLaporanBulananMock()`, `MASTER_HALAQOH_LIST`, dan `MASTER_SANTRI_57` dari seluruh library produksi (`lib/laporan-bulanan.ts`) dan UI komponen.
   - Seluruh mock data dipindahkan ke `tests/fixtures/laporan-bulanan-fixtures.ts` khusus untuk pengujian regresi.
   - Bila data gagal dimuat atau halaqoh tidak ditemukan, sistem mengembalikan error jujur (*honest error card*) disertai tombol retry "Coba Lagi" tanpa pernah menampilkan data sintetis.
2. **Eliminasi Total Old Cumulative Fallback Baseline**:
   - Formula resmi: `modalHafalanAwalHalaman + SABAQ sah setelah tanggalBaselineTahfizh` adalah satu-satunya formula hafalan resmi.
   - Jika `tanggalBaselineTahfizh` bernilai null / belum ditetapkan: sistem TIDAK menjumlahkan seluruh SABAQ historis dan TIDAK menganggapnya sebagai post-baseline (`tambahanSabaq: 0`, `totalHafalan: modalAwal`). Berlaku seragam di `app/actions/tahfizh.ts`, `lib/server/santri-list-service.ts`, dan `app/actions/laporan-bulanan.ts`.
   - Santri dengan baseline tengah bulan: setoran SABAQ sebelum tanggal baseline dieksklusi dari perhitungan capaian bulanan.
   - Aplikabilitas SABQI mensyaratkan SABAQ sah terjadi pada/setelah `max(startOfWeek, baselineDate)`.
3. **Pemisahan Domain PR #6 & PR #7 (Decoupling Target Mufar)**:
   - PR #6 tidak memvalidasi atau memaksakan formula dinamis 1–5 juz/hari (kewenangan PR #7).
   - Seluruh pemanggilan `hitungTargetMufar()` dihapus dari `app/actions/laporan-bulanan.ts`, `components/dashboard/rekap-laporan-bulanan.tsx`, dan `components/modules/tahfizh-module.tsx`.
   - Menggunakan target resmi santri dari `TargetSantri` (atau state `"Target belum ditetapkan"` bila null).
4. **Validasi Server-Side Ketat Target Santri & Laporan Bulanan**:
   - `upsertTargetSantriAction()`: validasi bulan (1–12), tahunAjaran `YYYY/YYYY` (+1 tahun), target finit > 0, SABAQ kelipatan 0.5, SABQI/MANZIL/MUFAR bilangan bulat, ambang kepatuhan 0–100.
   - `getLaporanBulananHalaqohAction()`: fail-closed saat parameter bulan atau tahun ajaran corrupt (tanpa silent fallback).
5. **Pengetatan ABAC Portal Wali Lintas-Domain (`app/actions/portal-wali.ts`)**:
   - `getRingkasanAnakAction`: WS/ST dibatasi ke anak sendiri (`session.santriId`).
   - Pembina MT/PH wajib terhubung `staffId` dan hanya berwenang mengakses santri di halaqoh binaan sendiri (tolak cross-halaqoh).
   - Flag `isKepalaBidangTahfidz` tidak memberikan hak manajerial lintas-domain (kesehatan, pelanggaran, mapel). Hak manajerial global lintas-domain hanya untuk KS, ADM, YAY.
   - Role non-authorized (MK, GMR) ditolak (*default-deny*).
6. **Konsistensi Kebijakan Default Reward/Sanksi**:
   - `minPersenTargetBulanan` diselaraskan ke default resmi 100.0% (sesuai schema `@default(100.0)`) di `getKebijakanRewardSanksiAction()`, `previewFinalisasiBulananAction()`, dan `reward-evaluasi-tab.tsx`.
7. **Penyelarasan Nilai Terakhir Rapor**:
   - `app/page.tsx` line 793 diperbaiki dari hardcoded `"MUMTAZ"` menjadi `santri.nilaiTerakhir || "Belum ada data"`.
8. **Eksklusi Status `DIBATALKAN` & Separasi 4 Jenis Setoran 3-State**:
   - Status `DIBATALKAN` dieksklusi seragam dari seluruh agregasi capaian, laporan bulanan, status harian, dan preview finalisasi bulanan.
   - Status 3-state (`SELESAI`, `BELUM_SELESAI`, `TIDAK_BERLAKU`) dievaluasi per jenis setoran berbasis hari efektif Senin–Jumat WITA.

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `8ed8688ba9d6483d0d223aae976cac8a27ca7c01`
* **Audited HEAD Commit 1:** `d1655650386e79a28b7d6231533dbdaac11d7c8c`
* **Audited HEAD Commit 2:** `b2f20cbd60f8231cb93939c2dc8c5708bcc04cf8`
* **Working Branch:** `review/tahfizh-data-integrity-targets` (Bekerja pada branch yang sama, commit koreksi audit ke-3, TIDAK auto-merge, TIDAK membuka PR sebelum re-audit ChatGPT)

## 3. Perubahan Berkas PR #6 (Commit 3 Final Remediation)
### File Baru
* `tests/fixtures/laporan-bulanan-fixtures.ts` (Isolasi MASTER_HALAQOH_LIST, MASTER_SANTRI_57, generateLaporanBulananMock, hitungTargetMufarLegacy khusus test fixtures)

### File Dimodifikasi
* `lib/laporan-bulanan.ts` (Pembersihan static mock fixtures, pembersihan hitungReferensiSabaqiKumulatif dari compatibility branches, hanya mengandalkan riil setoranSabaqList)
* `lib/server/santri-list-service.ts` (Eliminasi total old cumulative fallback bila baseline null, pengetatan SABAQ pekan berjalan terhadap baselineDate, dukungan injection refDate untuk determinisme test)
* `app/actions/tahfizh.ts` (getSantriKumulatifHalamanAction: eliminasi fallback kumulatif bila baseline null)
* `app/actions/laporan-bulanan.ts` (Eksklusi sabaq sebelum baseline pada baseline tengah bulan, eliminasi hitungTargetMufar dan target harian juz label, validasi server-side input target santri dan fail-closed laporan bulanan)
* `components/dashboard/rekap-laporan-bulanan.tsx` (Eliminasi static fixture imports, resolusi halaqoh prop fail-closed, label generic Kepala Bidang Tahfidz, pembersihan target mufar)
* `components/modules/tahfizh-module.tsx` (Eliminasi hitungTargetMufar dan dynamic mufar scale 1-5 juz/hari, sinkronisasi murni target terdaftar santri)
* `app/actions/portal-wali.ts` (ABAC ketat getRingkasanAnakAction: MT/PH binaan only, fail-closed no staffId, no cross-domain bypass for Kabid)
* `app/actions/reward-sanksi.ts` & `components/dashboard/reward-evaluasi-tab.tsx` (Penyelarasan canonical default minPersenTargetBulanan = 100.0%)
* `app/page.tsx` (Perbaikan nilaiTerakhir rapor dari hardcoded MUMTAZ menjadi dinamis)
* `tests/laporan-bulanan.test.ts` (Update import fixtures dan pengetatan uji referensi sabaqi murni riil)
* `tests/tahfizh-data-integrity-targets.test.ts` (Perbaikan determinisme Test #29 dengan refDate, penambahan 7 skenario pengujian 37 s.d. 43)
* `scripts/verify-halaqoh-filter.ts` & `scripts/verify-kabid-mufar-sabaqi.ts` (Update import fixtures)
* `CURRENT_TASK.md` (Dokumentasi audit remediation Commit 3)

## 4. Status Quality Gates Lokal
- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 warnings, 0 errors)
- [x] `npm test` — PASS (459/459 tests passed, 127 suites, 43/43 skenario PR #6 lulus)
- [x] `npm run build` — PASS (14 rute terkompilasi, 0 errors)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (100% proses/port/temp terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil E2E)
- [x] `npm run qa:structural` — PASS (98/98 assertions bebas overflow/overlap)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan: manifest, icons, privacy, cross-cache collision, offline fallback)

