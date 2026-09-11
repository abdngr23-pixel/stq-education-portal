# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
Pemulihan konteks, pembersihan ruang lingkup premature (B3 & PWA), perbaikan hang cleanup PostgreSQL test di Windows, dan persiapan Pilot UI/UX B1–B2 STQ DUC (Fondasi Desain, Beranda Musyrif Tahfizh, Form Catat Setoran Tahfizh).

## 2. Baseline Commit
* **Commit Baseline:** `18e17610ad821f9b4a70f4ae757c5f0c0437ac38` (`18e1761`)
* **Branch Utama:** `main` (wajib tetap berada pada baseline commit di atas).

## 3. Batasan Berkas
### File yang Boleh Berubah (Runtime B1–B2 & Test DB Hardening)
* `app/globals.css` (Fondasi token desain STQ Clean Institutional Minimalist)
* `app/layout.tsx` (Font Plus Jakarta Sans, viewport, metadata)
* `components/dashboard/dashboard-musyrif-tahfizh.tsx` (Pilot Beranda Musyrif: terhubung langsung untuk role MT pada beranda-module.tsx, data-testid="dashboard-musyrif-tahfizh", 1 primary action, 3 metrik operasional riil berbasis batas hari WITA, flat list santri)
* `components/modules/beranda-module.tsx` (Integrasi minimal: render DashboardMusyrifTahfizh jika role === "MT", role lain tetap beranda existing)
* `components/modules/tahfizh-module.tsx` (Pilot Catat Setoran: single-page focused form tanpa wizard dan tanpa visual stepper, ringkasan 5 data disederhanakan)
* `tests/test-db-manager.ts` (Hardening cleanup PostgreSQL test: PID tracking, process verification postgres.exe cegah PID reuse, safe temp deletion path.relative)
* `scripts/puppeteer-p0-1-verify.ts` (Konfigurasi path artefak screenshot E2E dinamis)

### File Dokumentasi & Verifikasi yang Dibuat/Diperbarui
* `CURRENT_TASK.md`
* `PROJECT_DECISIONS.md`
* `UI_UX_STITCH_INTEGRATION_PLAN.md`
* `UI_UX_LOCAL_IMPLEMENTATION_AUDIT.md`
* `CHECKPOINT_UI_UX_PILOT_B1_B2.md`
* `scripts/verify-test-db-cleanup.ts` (Verifikasi siklus start-stop test DB dengan try/finally)

### File yang DILARANG Berubah (Wajib Identik dengan HEAD `18e1761`)
* Modul B3 non-pilot (Akademik, Anggaran, Audit, Kalender, Kedisiplinan, Kesehatan, Logistik, Perizinan, Portal Wali, Sponsor, Surat, Users) serta fitur PWA B4.
* Seluruh berkas PWA/B4: `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`.
* Skema basis data: `prisma/schema.prisma` dan migrasi database.
* File otentikasi & login demo: `components/auth/demo-account-switcher.tsx`.

## 4. Pekerjaan yang Sudah Selesai
* [x] **Pemeriksaan Kondisi Git (Gate R0):** `tests/test-db-manager.ts` terverifikasi tracked di HEAD.
* [x] **Verifikasi Backup Lokal:** Direktori `D:\stq-education-portal-antigravity\uiux_local_backup_before_scope_recovery` terverifikasi lengkap memuat `tracked-changes.patch` dan seluruh file untracked.
* [x] **Pemulihan Perubahan Prematur B3 & PWA:** Seluruh berkas B3 non-pilot telah identik dengan HEAD, dan file PWA (`sw.js`, `manifest`, `offline.html`) telah dikeluarkan dari worktree.
* [x] **Instalasi Anti-Slop:** 5 skill anti-slop terpasang di `.agents/skills/` dan pointer terpasang di `AGENTS.md`.
* [x] **Fondasi Desain B1:** Token warna emerald `#0E7C3A`, safe-area insets, touch target $\ge 44 \times 44$ px, Plus Jakarta Sans font.
* [x] **Pilot Beranda Musyrif B2:** Terhubung langsung ke role `MT` di `beranda-module.tsx`, `data-testid="dashboard-musyrif-tahfizh"`, 1 tombol primary action (+ Catat Setoran), 3 metrik operasional riil berbasis WITA (Total Binaan, Sudah Setor Hari Ini, Belum Setor Hari Ini), rumus estimasi palsu dihapus, flat list tanpa nested cards.
* [x] **Pilot Catat Setoran B2:** Form Catat Setoran adalah single-page focused form tanpa wizard dan tanpa visual stepper. (Baseline commit 18e1761 memang sudah single-page tanpa stepper; klaim keliru bahwa stepper dihapus oleh commit pilot telah dihapus dan diselaraskan). Ringkasan 5 data riil disederhanakan anti-slop tanpa mengubah validasi P0.1.
* [x] **Remediasi Hang Cleanup PostgreSQL Test di Windows:**
  - `isPidRunning()` diperbaiki menggunakan `spawnSync("tasklist")` (menghindari false-negative libuv pada Windows).
  - Integrasi native `pg_ctl stop -m fast -w` dari paket `@embedded-postgres` sebelum terminasi proses.
  - Snapshot PID utama dan seluruh descendant process (termasuk background worker `io_worker`) sehingga socket tidak tertahan di `CLOSE_WAIT`.
  - Validasi direktori temporer dengan perlindungan ketat (`validateTempDataDir`).
  - Idempotensi cleanup terjamin.
* [x] **Pengujian Siklus Terfokus:** Script `scripts/verify-test-db-cleanup.ts` lulus 3/3 siklus start-stop dalam 50.5 detik tanpa orphan process.
* [x] **Semua Quality Gates Lulus:**
  - `npx tsc --noEmit` (0 error)
  - `npm run typecheck:test` (0 error)
  - `npm run lint` (0 error)
  - `npm test` (92 suites, 247 tests, durasi 21.3s, exit code 0)
  - `npm run build` (Next.js 16.3.4 compiled 14 routes dalam 13.3s, exit code 0)
  - `npx tsx scripts/puppeteer-p0-1-verify.ts` (6 skenario E2E riil lulus 100%, isolated cleanup tuntas).

## 5. Pekerjaan yang Belum Selesai
* [ ] Eksekusi skrip tangkapan layar pilot B1–B2 sesuai daftar Section P (resolusi desktop 1366x768, 1440x900, mobile 390x844, 412x915, nama santri panjang, sukses, error).
* [ ] Penyusunan dokumen final `CHECKPOINT_UI_UX_PILOT_B1_B2.md`.
* [ ] Publikasi ke branch review `review/uiux-pilot-b1-b2` (menunggu persetujuan pengguna).

## 6. Larangan Tegas
* DILARANG commit atau push langsung ke branch `main`.
* DILARANG merge ke `main`.
* DILARANG deploy ke production / staging (Vercel membuat preview deployment otomatis pada branch review, tetapi TIDAK ADA production deployment).
* DILARANG melanjutkan pengerjaan modul B3 atau PWA/B4 sebelum branch review B1–B2 disetujui.
* DILARANG mengubah skema database Prisma atau migrasi.

## 7. Quality Gates Status
| Quality Gate | Perintah | Status |
| :--- | :--- | :---: |
| **TypeScript App** | `npx tsc --noEmit` | **PASS (0 errors)** |
| **TypeScript Tests** | `npm run typecheck:test` | **PASS (0 errors)** |
| **ESLint** | `npm run lint` | **PASS (0 errors)** |
| **Unit & Integration Tests** | `npm test` | **PASS (92/92 suites, 247/247 tests, 21.3s)** |
| **Production Build** | `npm run build` | **PASS (Compiled in 13.3s)** |
| **Isolated Real E2E** | `npx tsx scripts/puppeteer-p0-1-verify.ts` | **PASS (6/6 scenarios)** |

## 8. Posisi Terakhir Pekerjaan
Hardening PostgreSQL test cleanup selesai dan terverifikasi stabil. Seluruh 6 quality gates lulus 100%. Menunggu pemeriksaan pengguna sebelum melanjutkan pengambilan screenshot pilot dan penyelesaian checkpoint.
