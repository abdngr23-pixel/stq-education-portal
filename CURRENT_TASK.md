# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
PR #5 — P0 Authentication Production Hardening untuk STQ Education Portal (`abdngr23-pixel/stq-education-portal`):
1. **Database-Only & Fail-Closed Authentication**:
   - Menghapus seluruh kemungkinan autentikasi produksi melalui akun demo, katalog statis (`ALL_STAFF_ACCOUNTS`, `DEMO_ACCOUNTS`), password universal (`password123`), atau fallback saat database gagal.
   - Pada `app/actions/auth.ts` (`loginAction`): jika database tidak tersedia atau timeout, autentikasi fail-closed tanpa membuat session cookie dan mengembalikan error aman/generik.
   - Jika user tidak terdaftar atau password salah: mengembalikan respon invalid credentials generik tanpa membocorkan eksistensi user.
   - Jika akun berstatus nonaktif: ditolak dengan pesan status penangguhan yang aman.
   - Session hanya diterbitkan jika user ditemukan di PostgreSQL (Prisma), berstatus `AKTIF`, dan lolos `verifyPassword()` terhadap hash database.
2. **REST API Login Hardening**:
   - Pada `app/api/v1/auth/login/route.ts`: menghapus seluruh fallback ke `DEMO_ACCOUNTS`, `ALL_STAFF_ACCOUNTS`, dan `password123`.
   - Menegakkan kontrak API: DB unavailable -> 503 fail-closed (tanpa token); unknown user / wrong password -> 401; inactive user -> 403; valid DB user -> 200 + JWT token + HttpOnly secure cookie.
   - Dilarang membuat identitas sintetik (`user_<role>`, `stf_<role>`) pada jalur login produksi.
3. **Isolasi Demo & Development**:
   - `quickDemoLoginAction` dilindungi batas tegas server-side: hanya aktif jika `NODE_ENV !== "production" && STQ_ENABLE_DEMO_LOGIN === "true"`.
   - Di lingkungan produksi, `quickDemoLoginAction` selalu ditolak secara fail-closed.
   - `app/login/page.tsx`: Demo Switcher hanya dirender jika `NODE_ENV !== "production" && NEXT_PUBLIC_ENABLE_DEMO === "true"`.
4. **Session & Cookie Security**:
   - `HttpOnly = true`, `secure = (process.env.NODE_ENV === "production")`, `sameSite = "lax"`.
   - `lib/auth.ts`: secara ketat menolak token beridentitas sintetik (`user_`, `stf_`) di lingkungan produksi.
5. **Negative Security Regression Tests**:
   - Membuat `tests/auth-production-hardening.test.ts` yang memvalidasi ke-11 skenario regresi keamanan menggunakan PostgreSQL test database terisolasi.

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `2bcc49a26b5d49aa09ebf52639b3e655e81ff142` (Hasil merge PR #4 Secure PWA & Installability, post-merge CI #64 SUCCESS)
* **Lifecycle Status:**
  - PR #1: **MERGED**
  - PR #2: **MERGED**
  - PR #3: **MERGED**
  - PR #4: **MERGED** (branch PR #4 `review/pwa-secure-installability` sudah dihapus dari remote)
* **Current Working Branch:** `review/auth-production-hardening` (Dibuat dari verified baseline main, TIDAK langsung di `main`, TIDAK auto-merge)

## 3. Perubahan Berkas PR #5
### File Baru
* `tests/auth-production-hardening.test.ts` (11 skenario negative security tests pembuktian database-only, fail-closed, isolasi demo, dan penolakan kredensial statis)

### File Dimodifikasi
* `app/actions/auth.ts` (Database-only & fail-closed `loginAction`, isolasi `quickDemoLoginAction`, secure cookie produksi)
* `app/api/v1/auth/login/route.ts` (Eliminasi fallback katalog statis & universal password, kontrak 503/401/403/200 fail-closed)
* `lib/auth.ts` (Penolakan identitas sintetik `user_`/`stf_` di produksi, ekspor helper predikat `isDemoLoginAllowed()`)
* `app/login/page.tsx` (Pengetatan logika render demo switcher menjadi AND: `NODE_ENV !== "production" && NEXT_PUBLIC_ENABLE_DEMO === "true"`)
* `.env.example` (Dokumentasi konfigurasi `STQ_ENABLE_DEMO_LOGIN` khusus non-produksi)
* `CURRENT_TASK.md` (Dokumentasi status kerja PR #5)

## 4. Status Quality Gates Lokal
- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 warnings, 0 errors)
- [x] `npm test` — PASS (409/409 passed, 126 suites)
- [x] `npm run build` — PASS (14 rute statis, 0 errors)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (100% proses/port/temp terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil)
- [x] `npm run qa:structural` — PASS (98/98 assertions bebas overflow/overlap)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan: manifest, icons, privacy, cross-cache collision, offline fallback)
