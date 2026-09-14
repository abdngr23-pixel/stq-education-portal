# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
PR #6 — Tahfizh Data Integrity & Target Operationalization untuk STQ Education Portal (`abdngr23-pixel/stq-education-portal`):
1. **Eliminasi Total Mock Generator**:
   - Menghapus `generateLaporanBulananMock()` dari seluruh alur produksi (`app/actions/laporan-bulanan.ts` dan `components/dashboard/rekap-laporan-bulanan.tsx`).
   - Bila data gagal dimuat atau halaqoh tidak ditemukan, sistem mengembalikan error jujur (*honest error card*) disertai tombol retry "Coba Lagi" tanpa pernah menampilkan data sintetis yang menyesatkan.
2. **Operasionalisasi Target Santri Individual Tanpa Nilai Sintetik**:
   - Mengoperasionalkan model database `TargetSantri` per santri + jenis setoran (`SABAQ`, `SABQI`, `MANZIL`, `MUFAR`) + bulan + tahun ajaran.
   - Menghilangkan seluruh nilai fallback default (tidak ada fallback 20 halaman, 16 kali, 8 kali, maupun 30 juz).
   - Apabila target belum diatur di database, UI dan laporan menampilkan `"Target belum ditetapkan"` secara jujur.
3. **Eksklusi Menyeluruh Status `DIBATALKAN` Termasuk Finalisasi Bulanan**:
   - Menegakkan filter `{ status: { not: "DIBATALKAN" } }` secara seragam pada seluruh kalkulasi akumulasi hafalan, rekap laporan bulanan, status harian, portal wali (`totalSetoran`, `setoranList`), modul sponsor (`setoranBulanIni`), API rapor santri (`totalSetoranTercatat`), dan `previewFinalisasiBulananAction`.
   - Setoran yang dibatalkan tidak menambah capaian halaman, tidak mengubah status harian menjadi `SELESAI`, dan tidak meluluskan target santri.
4. **Separasi 4 Jenis Setoran & Status Operasional 3-State**:
   - Status harian dievaluasi secara independen untuk 4 jenis: `SABAQ`, `SABQI`, `MANZIL`, dan `MUFAR`.
   - Menggunakan 3 status operasional: `SELESAI`, `BELUM_SELESAI`, dan `TIDAK_BERLAKU`.
   - Setoran salah satu jenis (misal `MANZIL`) tidak otomatis menyelesaikan jenis lainnya (`SABAQ`/`SABQI`).
   - Penyelarasan aplikabilitas SABQI (`lib/sabaqi.ts`): SABQI mensyaratkan adanya SABAQ valid pada pekan berjalan. Tanpa SABAQ pekan ini, SABQI bernilai `TIDAK_BERLAKU` (bukan kegagalan). Setoran dibatalkan tidak membuat SABQI berlaku.
5. **Kalender Monitoring Efektif & Batas WITA**:
   - Monitoring harian dan bulanan dihitung secara presisi berdasarkan zona waktu WITA (Asia/Makassar, UTC+8).
   - Rentang laporan bulanan: 00:00:00.000 WITA awal bulan s.d. 23:59:59.999 WITA akhir bulan via `getWITAMonthRange()`.
   - Perhitungan pekan dalam bulan (`getPekanDariTanggal`) dievaluasi dalam zona waktu Asia/Makassar.
   - Hari efektif hafalan: Senin s.d. Jumat. Hari Sabtu dan Ahad yang belum setor diberi status `TIDAK_BERLAKU` (bukan kegagalan).
   - Santri yang telah mencapai halaman 604 (khatam 30 Juz): status `SABAQ` otomatis menjadi `TIDAK_BERLAKU`.
   - `MUFAR` yang belum memiliki target atau belum wajib bagi santri bersangkutan otomatis berstatus `TIDAK_BERLAKU`.
6. **Penegakan ABAC Otorisasi Fail-Closed & Default-Deny**:
   - Pada `upsertTargetSantriAction`, `getTargetSantriAction`, `getLaporanBulananHalaqohAction`, `previewFinalisasiBulananAction`, dan `prosesRewardTasmiSimaanAction`:
     - Musyrif Tahfizh (MT) dan Pembina Halaqoh (PH) wajib memiliki `staffId` aktif dan hanya berwenang mengakses santri / halaqoh binaannya.
     - MT tanpa `staffId` ditolak fail-closed.
     - Role non-Tahfizh (MK, GA, OSDA, ST, dll.) ditolak (*default-deny*, tidak ada fallback open).
     - Kepala Bidang Tahfidz (`session.isKepalaBidangTahfidz === true`) memiliki kewenangan manajerial global.
   - Pada `recordTasmiSimaanAction`: atribusi penguji gagal secara fail-closed jika `!session.staffId` (tanpa fallback staf acak).
7. **Pecahan Target Float (0.5) & Non-Rounded Page Calculation**:
   - Skema `TargetSantri` dimigrasikan dari `Int` ke `Float` (`Double Precision`) secara non-destruktif (`prisma/migrations/20260914100000_target_santri_float/migration.sql`).
   - Kalkulasi halaman pada `konversiHalamanKeJuz`, `hitungCapaianSabaq`, dan `hitungAkumulasiSabaqSantri` mempertahankan pecahan desimal (menghilangkan `Math.round()` yang membulatkan 0.5).
   - Eliminasi sisa fallback 20 pada `hitungAkumulasiSabaqSantri` (`hasTarget: boolean`).
8. **Sourcing Dinamis targetAkhirProgramJuz**:
   - Sourcing `targetJuz` bersumber dari database santri (`santri.targetAkhirProgramJuz`), mengeliminasi hardcoded 0 / 30 pada UI dan laporan bila target belum diatur.

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `8ed8688ba9d6483d0d223aae976cac8a27ca7c01`
* **Audited HEAD (Commit 1):** `d1655650386e79a28b7d6231533dbdaac11d7c8c`
* **Working Branch:** `review/tahfizh-data-integrity-targets` (Bekerja pada branch yang sama, commit koreksi audit, TIDAK auto-merge, TIDAK membuka PR sebelum re-audit ChatGPT)

## 3. Perubahan Berkas PR #6
### Migrasi & Skema
* `prisma/schema.prisma` (TargetSantri.targetPekanan & targetBulanan diubah menjadi Float)
* `prisma/migrations/20260914100000_target_santri_float/migration.sql` (ALTER TABLE target_santri ALTER COLUMN ... TYPE DOUBLE PRECISION)

### File Baru
* `lib/tahfizh-status.ts` (Evaluasi 3-state `OperationalStatus`: `SELESAI`, `BELUM_SELESAI`, `TIDAK_BERLAKU`, deteksi hari efektif Senin–Jumat WITA, penanganan khatam 604, penanganan MUFAR kondisional, penyelarasan SABQI pekan berjalan)
* `tests/tahfizh-data-integrity-targets.test.ts` (36 skenario pengujian komprehensif: 24 skenario wajib awal + 12 skenario audit remediation P0/P1 dengan PostgreSQL test database terisolasi)

### File Dimodifikasi
* `app/actions/reward-sanksi.ts` (Eksklusi DIBATALKAN pada previewFinalisasiBulananAction, ABAC MT binaan + Kabid Tahfidz + fail-closed no staffId, ABAC prosesRewardTasmiSimaanAction binaan only)
* `app/actions/laporan-bulanan.ts` (Default-deny read actions untuk role non-Tahfizh, rentang bulanan presisi getWITAMonthRange, atribusi penguji fail-closed tanpa staff acak)
* `lib/laporan-bulanan.ts` (Non-rounded decimal page calculations, eliminasi fallback 20 pada hitungAkumulasiSabaqSantri, evaluasi pekan WITA Asia/Makassar)
* `lib/server/santri-list-service.ts` (Filter targetList periode aktif WITA, sourcing targetAkhirProgramJuz, kalkulasi hasValidSabaqThisWeek dari Senin 00:00 WITA)
* `lib/wita-date.ts` (Penambahan getWITAMonthRange untuk batas 00:00:00.000 WITA awal s.d. 23:59:59.999 WITA akhir bulan)
* `lib/whatsapp.ts` (Penanganan targetJuz dinamis dan label Target Akhir X Juz)
* `components/dashboard/rekap-laporan-bulanan.tsx` (Honest error card, eliminasi mock generator, label Target belum ditetapkan)
* `components/dashboard/dashboard-musyrif-tahfizh.tsx`, `components/dashboard/master-data-santri.tsx`, `components/modules/beranda-module.tsx`, `components/modules/tahfizh-module.tsx`, `components/print/print-rapor.tsx`, `components/ui/santri-card.tsx`, `app/page.tsx` (Penyesuaian targetJuz nullable dan eliminasi hardcoded default 30)
* `app/actions/portal-wali.ts`, `app/actions/sponsor.ts`, `app/api/v1/rapor/[nis]/route.ts` (Eksklusi status DIBATALKAN)
* `CURRENT_TASK.md` (Dokumentasi audit remediation PR #6)

## 4. Status Quality Gates Lokal
- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 warnings, 0 errors)
- [x] `npm test` — PASS (453/453 tests passed, 127 suites, 36/36 skenario PR #6 lulus)
- [x] `npm run build` — PASS (14 rute terkompilasi, 0 errors)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (100% proses/port/temp terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil)
- [x] `npm run qa:structural` — PASS (98/98 assertions bebas overflow/overlap)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan: manifest, icons, privacy, cross-cache collision, offline fallback)
