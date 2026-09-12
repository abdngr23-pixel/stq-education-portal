# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
PR #3 QA Hardening untuk STQ Education Portal:
1. Menjadikan skrip visual QA (`scripts/capture-post-merge-qa.ts`) portabel lintas platform (Windows, Linux, macOS) tanpa path hardcoded direktori lokal developer (`C:\Users\Lenovo\...`).
2. Menambah viewport minimum seluler `360×800` (melengkapi `390×844` dan `412×915` pada mobile, serta `1366×768`, `1440×900`, `1920×1080` pada desktop).
3. Menambahkan assertion layout struktural otomatis untuk mendeteksi masalah layout nyata:
   - Accidental global horizontal overflow (membedakan scroll internal pada tab strip `overflow-x-auto`).
   - Non-collision check: Sticky action bar vs Mobile Bottom Navigation pada modul Presensi mobile (`rectanglesOverlap`).
   - Aksesibilitas konten: Baris/konten terakhir presensi tidak tertutup secara permanen oleh sticky bottom bar.
   - Deteksi pemotongan teks kritis (critical text clipping).
   - Touch target minimum $\ge 44 \times 44$ px pada kontrol navigasi & aksi utama mobile.
   - Verifikasi single-instance dan safe-area pada Mobile Bottom Navigation.
   - Scroll padding / header offset check: Heading halaman tidak tenggelam di bawah sticky header.
4. Cakupan Rapor Santri terisi data riil (stress test data fixture tanpa mock hardcoded):
   - Pengujian nama panjang santri: *Muhammad Abdullah Fathurrahman Al-Makassari*.
   - Pengujian mata pelajaran & guru nama panjang kurikulum Kepesantrenan dan Umum.
   - Pratinjau cetak rapor resmi dengan tanggal dinamis zona operasional WITA (Asia/Makassar).
5. Memperluas GitHub Actions (`.github/workflows/ci.yml`) agar seluruh quality gates penting dijalankan secara berurutan dan deterministik di CI.
6. Mempertahankan 100% aturan bisnis Tahfizh P0.1, isolasi database PostgreSQL, dan ABAC fail-closed.

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `fa040d3db2a8b67be178bdd0f3a61d70713bcba3` (Hasil merge PR #2)
* **Lifecycle Status:**
  - PR #1: **MERGED**
  - PR #2: **MERGED** (branch `review/post-merge-visual-qa` telah dihapus dari remote)
  - Branch `review/uiux-pilot-b1-b2`: **HISTORIKAL / STALE** (tidak digunakan dan tidak dimerge)
* **Current Working Branch:** `review/qa-hardening` (Bekerja pada branch baru, TIDAK langsung di `main`, TIDAK auto-merge)

## 3. Perubahan Berkas PR #3
### File Dimodifikasi & Baru
* `tests/helpers/qa-layout-assertions.ts` (Baru: Helper reusable assertions layout, non-overlap bounding box, touch target, Chrome resolution portabel, deteksi overflow, formatter tabel visual findings).
* `tests/qa-layout-assertions.test.ts` (Baru: Uji unit komprehensif untuk fungsi overlap rectangle, touch target threshold, path resolution, dan format finding).
* `scripts/qa-runner-core.ts` (Baru: Runner inti QA multi-viewport, assertions struktural layout, setup fixtures stress test, dan screenshot evidence capture).
* `scripts/qa-visual-structural.ts` (Baru: Runner khusus CI untuk validasi struktural layout tanpa beban penulisan disk berlebih).
* `scripts/capture-post-merge-qa.ts` (Dimodifikasi: Refactor total menghapus dependensi path absolut developer, menggunakan `process.cwd()` dan path portabel).
* `scripts/puppeteer-p0-1-verify.ts` (Dimodifikasi: Resolusi path browser lintas platform melalui `getChromeExecutablePath`).
* `scripts/verify-test-db-cleanup.ts` (Dimodifikasi: Dukungan verifikasi proses postgres pada Linux tanpa melemahkan proteksi PID baseline dan kepemilikan instance test).
* `tests/test-db-manager.ts` (Dimodifikasi: Dukungan Linux untuk pg_ctl, port listener via lsof/ss, proses listing via ps, serta fixture stress test data rapor).
* `components/navigation/mobile-bottom-nav.tsx` (Dimodifikasi: Menambahkan `data-testid="mobile-bottom-nav"` untuk testing deterministik).
* `components/dashboard/presensi-harian-mobile.tsx` (Dimodifikasi: Menambahkan `data-testid="floating-save-bar"` dan `data-testid="santri-presensi-list"`).
* `components/modules/akademik-module.tsx` (Dimodifikasi: Menambahkan `data-testid` pada subtab rapor, seleksi santri, tombol cetak, dan tombol tutup modal).
* `package.json` (Dimodifikasi: Menambahkan script `typecheck`, `qa:structural`, dan `qa:visual`).
* `.github/workflows/ci.yml` (Dimodifikasi: Quality gates lengkap berurutan mencakup tsc, typecheck:test, lint, unit test, build, db cleanup, puppeteer P0.1, qa structural, dan upload artifact).
* `CURRENT_TASK.md` (Dimodifikasi: Status disinkronkan dengan repositori GitHub aktual).

## 4. Status Quality Gates Lokal (100% LULUS)
Semua quality gates lokal diverifikasi dan lulus tanpa error/failure:
- [x] `npx tsc --noEmit` (0 error)
- [x] `npm run typecheck:test` (0 error)
- [x] `npm run lint` (0 error, 0 warning)
- [x] `npm test` (376 tests lulus, 124 suites, 0 failures, termasuk fail-closed semantics unit tests)
- [x] `npm run build` (Next.js production build berhasil dikompilasi)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` (Semua 6 skenario pembersihan & preservasi proses DB test lulus 100%)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` (Seluruh 6 skenario E2E Tahfizh P0.1 riil lulus 100%)
- [x] `npm run qa:structural` (98/98 layout assertions LOLOS 100% pada 6 viewports dengan fail-closed semantics)
- [x] `npm run qa:visual` (33 screenshot multi-viewport & stres test data rapor berhasil disimpan)
- [x] Negative Self-Test: Terbukti gagal deterministik (exit code 1, 3 failed assertions) saat selector required sengaja disabotase secara temporer.

Catatan CI Artifact: `npm run qa:structural` di CI berjalan dengan `captureScreenshots: false` secara default demi kecepatan dan efisiensi resource. Step `upload-artifact` menggunakan `if-no-files-found: ignore` secara sah. Screenshot visual hanya dihasilkan saat `npm run qa:visual` dijalankan.
