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
3. **Eksklusi Menyeluruh Status `DIBATALKAN`**:
   - Menegakkan filter `{ status: { not: "DIBATALKAN" } }` secara seragam pada seluruh kalkulasi akumulasi hafalan, rekap laporan bulanan, status harian, portal wali (`totalSetoran`, `setoranList`), modul sponsor (`setoranBulanIni`), dan API rapor santri (`totalSetoranTercatat`).
   - Setoran yang dibatalkan tidak menambah capaian halaman dan tidak mengubah status harian menjadi `SELESAI`.
4. **Separasi 4 Jenis Setoran & Status Operasional 3-State**:
   - Status harian dievaluasi secara independen untuk 4 jenis: `SABAQ`, `SABQI`, `MANZIL`, dan `MUFAR`.
   - Menggunakan 3 status operasional: `SELESAI`, `BELUM_SELESAI`, dan `TIDAK_BERLAKU`.
   - Setoran salah satu jenis (misal `MANZIL`) tidak otomatis menyelesaikan jenis lainnya (`SABAQ`/`SABQI`).
5. **Kalender Monitoring Efektif & Batas Khatam**:
   - Monitoring harian dihitung berdasarkan zona waktu WITA (Asia/Makassar, UTC+8).
   - Hari efektif hafalan: Senin s.d. Jumat. Hari Sabtu dan Ahad yang belum setor diberi status `TIDAK_BERLAKU` (bukan kegagalan).
   - Santri yang telah mencapai halaman 604 (khatam 30 Juz): status `SABAQ` otomatis menjadi `TIDAK_BERLAKU`.
   - `MUFAR` yang belum memiliki target atau belum wajib bagi santri bersangkutan otomatis berstatus `TIDAK_BERLAKU`.
6. **Penegakan ABAC Otorisasi Fail-Closed**:
   - Pada `upsertTargetSantriAction` dan `getTargetSantriAction`: Musyrif Tahfizh (MT) dan Pembina Halaqoh (PH) wajib memiliki `staffId` aktif dan hanya berwenang mengakses santri di dalam halaqoh binaannya.
   - Kepala Bidang Tahfidz (`session.isKepalaBidangTahfidz === true`) memiliki kewenangan manajerial lintas halaqoh.
   - Tanpa `staffId` atau saat mengakses di luar binaan: ditolak secara fail-closed.
7. **Integritas Kapasitas Halaman & Multi-Page**:
   - Mendukung pecahan volume 0.5 dan multi-page setoran berurutan melalui `lib/tahfizh-page-allocation.ts`.
   - Menjaga batas kapasitas halaman maksimal 1.0 halaman (menolak akumulasi volume > 1.0 pada nomor halaman yang sama).
   - Menjaga rentang batas Mushaf Madinah: 1 s.d. 604 (menolak halaman >= 605).

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `8ed8688ba9d6483d0d223aae976cac8a27ca7c01`
* **Lifecycle Status:**
  - PR #1: **MERGED**
  - PR #2: **MERGED**
  - PR #3: **MERGED**
  - PR #4: **MERGED**
  - PR #5: **MERGED**
* **Current Working Branch:** `review/tahfizh-data-integrity-targets` (Dibuat dari verified baseline main, TIDAK langsung di `main`, TIDAK auto-merge, TIDAK membuka PR sebelum audit)

## 3. Perubahan Berkas PR #6
### File Baru
* `lib/tahfizh-status.ts` (Evaluasi 3-state `OperationalStatus`: `SELESAI`, `BELUM_SELESAI`, `TIDAK_BERLAKU`, deteksi hari efektif Senin–Jumat WITA, penanganan khatam 604, penanganan MUFAR kondisional)
* `tests/tahfizh-data-integrity-targets.test.ts` (24 skenario pengujian komprehensif data integrity dan operasionalisasi target tahfizh dengan PostgreSQL test database terisolasi)

### File Dimodifikasi
* `lib/laporan-bulanan.ts` (Eliminasi fallback nilai 20 hlm & sintetik pada helper kalkulasi capaian dan kepatuhan)
* `lib/server/santri-list-service.ts` (Include relasi `targetList`, eliminasi default 30 juz, pemetaan `targetSabaqLabel`, integrasi `determineTahfizhDailyStatus`)
* `app/actions/laporan-bulanan.ts` (Eliminasi import dan pemanggilan `generateLaporanBulananMock`, integrasi formula baseline riil, filter `status: { not: "DIBATALKAN" }`, operasionalisasi `TargetSantri`, ABAC Kabid Tahfidz, penambahan `getTargetSantriAction`)
* `components/dashboard/rekap-laporan-bulanan.tsx` (Eliminasi mock, penambahan honest error card dengan tombol "Coba Lagi", render label "Target belum ditetapkan" pada tabel dan ekspor CSV)
* `components/ui/santri-card.tsx` (Eliminasi fallback 30 Juz, menampilkan "Target belum ditetapkan" jika target kosong/falsy)
* `components/modules/tahfizh-module.tsx` (Drawer detail santri menampilkan target operasional riil atau "Target belum ditetapkan")
* `components/modules/beranda-module.tsx` (Penyesuaian tipe `DashboardSantriSummary` dengan field target & status harian)
* `app/page.tsx` (Pemetaan targetSabaqLabel dan statusTahfizhHariIni pada beranda)
* `app/actions/portal-wali.ts` (Eksklusi `status: { not: "DIBATALKAN" }` pada `totalSetoran` dan `setoranList`)
* `app/actions/sponsor.ts` (Eksklusi `status: { not: "DIBATALKAN" }` pada `setoranBulanIni`)
* `app/api/v1/rapor/[nis]/route.ts` (Eksklusi `status: { not: "DIBATALKAN" }` pada `totalSetoranTercatat`)
* `CURRENT_TASK.md` (Dokumentasi status kerja PR #6)

## 4. Status Quality Gates Lokal
- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 warnings, 0 errors)
- [x] `npm test` — PASS (441/441 tests passed, 127 suites, 24/24 skenario PR #6 lulus)
- [x] `npm run build` — PASS (14 rute terkompilasi, 0 errors)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (100% proses/port/temp terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil)
- [x] `npm run qa:structural` — PASS (98/98 assertions bebas overflow/overlap)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan: manifest, icons, privacy, cross-cache collision, offline fallback)
