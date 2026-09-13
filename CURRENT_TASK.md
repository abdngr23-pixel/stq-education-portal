# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
PR #4 Secure PWA & Installability untuk STQ Education Portal (STQ Darul Ulum Cendekia):
1. Mengimplementasikan Progressive Web App (PWA) yang installable pada Android dan Chromium desktop dengan dukungan penuh metadata iOS.
2. Menerapkan arsitektur keamanan **Online-First / Allowlist-Only**:
   - Dilarang menyimpan data santri, Tahfizh, Akademik, Presensi, Kesantrian, API, Server Actions, dan halaman HTML terotentikasi ke Cache Storage.
   - Hanya 7 aset statis publik offline shell yang diizinkan masuk ke Cache Storage (`/offline.html`, `/pwa/icon-192.png`, `/pwa/icon-512.png`, `/pwa/icon-maskable-512.png`, `/pwa/apple-touch-icon.png`, `/logo.png`, `/favicon.ico`).
3. Halaman fallback offline statis yang jujur (`public/offline.html`):
   - Menampilkan identitas STQ Darul Ulum Cendekia resmi dan pesan jelas bahwa koneksi internet diperlukan untuk mengakses data pendidikan terbaru.
   - Tombol interaktif "Coba Lagi / Muat Ulang" tanpa menampilkan data user/fixture kadaluarsa.
4. Service Worker terisolasi & fail-closed (`public/sw.js`):
   - Tanpa dependency eksternal berat (pure vanilla Service Worker).
   - Namespace cache terisolasi (`stq-duc-pwa-`): hanya menghapus cache milik STQ saat aktivasi, tidak pernah menyentuh cache sistem/aplikasi lain.
   - Install precache fail-closed: jika precache aset mandatory offline gagal, instalasi SW dibatalkan (`throw err`) agar tidak mengaktifkan broken offline shell.
   - Navigation request ditangani secara Network-First / Network-Only tanpa pernah menyimpan respons navigasi ke cache.
5. Registrasi Service Worker modular (`components/pwa/service-worker-register.tsx`):
   - Memiliki guard lingkungan yang ketat: hanya aktif pada production build untuk menjaga isolasi lingkungan test/dev.
   - Pada lingkungan dev/test: membersihkan secara best-effort registrasi lama STQ (/sw.js) dan cache STQ (`stq-duc-pwa-`) tanpa menyentuh registrasi/cache lain.
6. Aset Ikon PWA Standar (`public/pwa/`):
   - `icon-192.png` (192×192 px, transparan, contain)
   - `icon-512.png` (512×512 px, transparan, contain)
   - `icon-maskable-512.png` (512×512 px, safe area padding 80% pada background `#F7F9F7`)
   - `apple-touch-icon.png` (180×180 px pada background `#FFFFFF`)
7. Header Keamanan & Kontrol Cache:
   - Menambahkan directive `worker-src 'self'` dan `manifest-src 'self'` pada Content Security Policy di `next.config.ts`.
   - Menambahkan header `Cache-Control: no-cache, no-store, must-revalidate` untuk `/sw.js`.
8. Verifikasi Terotomasi Dedicated PWA (`scripts/verify-pwa.ts` & `npm run qa:pwa`):
   - Menjalankan pengujian manifest, HTTP status ikon, aktivasi Service Worker di Puppeteer, audit allowlist privasi cache (negative check), preservasi cache unrelated, pembersihan cache lama STQ, fallback offline, dan pemulihan online.
   - Terintegrasi penuh ke dalam GitHub Actions CI (`.github/workflows/ci.yml`).

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `65b394de98c7d330f024e4bb3949a89b031a0391` (Hasil merge PR #3 QA Hardening, post-merge CI #57 SUCCESS)
* **Lifecycle Status:**
  - PR #1: **MERGED**
  - PR #2: **MERGED**
  - PR #3: **MERGED** (remote review branches lama telah dihapus dari remote)
* **Current Working Branch:** `review/pwa-secure-installability` (Bekerja pada branch baru dari verified main baseline, TIDAK langsung di `main`, TIDAK auto-merge)

## 3. Perubahan Berkas PR #4
### File Baru
* `public/pwa/icon-192.png` (Ikon PWA 192x192 transparan)
* `public/pwa/icon-512.png` (Ikon PWA 512x512 transparan)
* `public/pwa/icon-maskable-512.png` (Ikon PWA 512x512 maskable dengan safe area 80% pada `#F7F9F7`)
* `public/pwa/apple-touch-icon.png` (Ikon Apple Touch 180x180 pada `#FFFFFF`)
* `public/offline.html` (Fallback offline statis jujur beridentitas resmi STQ DUC)
* `public/sw.js` (Vanilla Service Worker dengan allowlist caching murni)
* `components/pwa/service-worker-register.tsx` (Client component registrasi Service Worker dengan production guard)
* `lib/pwa-policy.ts` (Helper kebijakan keamanan caching & isolasi PWA)
* `tests/pwa-security-policy.test.ts` (Unit test kebijakan allowlist, eksklusi data sensitif, dan integritas manifest)
* `scripts/verify-pwa.ts` (Runner verifikasi otomatis PWA, browser registration, cache privacy audit, dan offline simulation)

### File Dimodifikasi
* `app/manifest.ts` (Manifest PWA lengkap: id, scope, standalone, background #F7F9F7, theme #0E7C3A, icons)
* `app/layout.tsx` (Metadata iOS appleWebApp, icons apple touch, dan mounting `<ServiceWorkerRegister />`)
* `next.config.ts` (CSP worker-src/manifest-src dan Cache-Control no-cache untuk `/sw.js`)
* `scripts/puppeteer-p0-1-verify.ts` (Pembaruan semantik assertion dari "PWA dilarang" menjadi "Test Isolation Guard")
* `package.json` (Menambahkan skrip `qa:pwa`)
* `.github/workflows/ci.yml` (Menambahkan step verifikasi `npm run qa:pwa` pada pipeline CI)
* `CURRENT_TASK.md` (Pembaruan dokumentasi status kerja PR #4)

## 4. Status Quality Gates Lokal
- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 warnings, 0 errors)
- [x] `npm test` — PASS (398/398 passed, 125 suites)
- [x] `npm run build` — PASS (14 rute statis, /manifest.webmanifest statis)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (100% proses/port/temp terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil + Test Isolation Guard)
- [x] `npm run qa:structural` — PASS (98/98 assertions bebas overflow/overlap)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan: manifest, icons, privacy, cross-cache collision, offline fallback)
