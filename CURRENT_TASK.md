# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
PR #4 Secure PWA & Installability untuk STQ Education Portal:
1. Mengimplementasikan Progressive Web App (PWA) yang installable pada Android dan Chromium desktop dengan dukungan penuh metadata iOS.
2. Menerapkan arsitektur keamanan **Online-First / Allowlist-Only**:
   - Dilarang menyimpan data santri, Tahfizh, Akademik, Presensi, Kesantrian, API, Server Actions, dan halaman HTML terotentikasi ke Cache Storage.
   - Hanya aset statis publik offline shell yang diizinkan masuk ke Cache Storage (`/offline.html`, ikon PWA, logo, favicon).
3. Halaman fallback offline statis yang jujur (`public/offline.html`):
   - Menampilkan identitas STQ DUC resmi dan pesan jelas bahwa koneksi internet diperlukan untuk mengakses data pendidikan terbaru.
   - Tombol interaktif "Coba Lagi / Muat Ulang" tanpa menampilkan data user/fixture kadaluarsa.
4. Service Worker transparan (`public/sw.js`):
   - Tanpa dependency eksternal berat (pure vanilla Service Worker).
   - Versioned cache name dengan pembersihan cache lama otomatis saat aktivasi.
   - Navigation request ditangani secara Network-First / Network-Only tanpa pernah menyimpan respons navigasi ke cache.
5. Registrasi Service Worker modular (`components/pwa/service-worker-register.tsx`):
   - Memiliki guard lingkungan yang ketat: hanya aktif pada production build untuk menjaga isolasi lingkungan test/dev.
6. Aset Ikon PWA Standar (`public/pwa/`):
   - `icon-192.png` (192×192 px, transparan, contain)
   - `icon-512.png` (512×512 px, transparan, contain)
   - `icon-maskable-512.png` (512×512 px, safe area padding 80% pada background `#F7F9F7`)
   - `apple-touch-icon.png` (180×180 px pada background `#FFFFFF`)
7. Header Keamanan & Kontrol Cache:
   - Menambahkan directive `worker-src 'self'` dan `manifest-src 'self'` pada Content Security Policy di `next.config.ts`.
   - Menambahkan header `Cache-Control: no-cache, no-store, must-revalidate` untuk `/sw.js`.
8. Verifikasi Terotomasi Dedicated PWA (`scripts/verify-pwa.ts` & `npm run qa:pwa`):
   - Menjalankan pengujian manifest, HTTP status ikon, aktivasi Service Worker di Puppeteer, audit allowlist privasi cache (negative check), fallback offline, dan pemulihan online.
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
- [ ] `npx tsc --noEmit`
- [ ] `npm run typecheck:test`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx tsx scripts/verify-test-db-cleanup.ts`
- [ ] `npx tsx scripts/puppeteer-p0-1-verify.ts`
- [ ] `npm run qa:structural`
- [ ] `npm run qa:pwa`
