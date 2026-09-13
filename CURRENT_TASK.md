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
   - `lib/auth.ts`: unified resolver `resolveVerifiedSessionPayload()` digunakan secara konsisten oleh `getCurrentSession()` (Cookie) dan `getAuthFromRequest()` (Bearer & Cookie).
   - Di lingkungan produksi (`NODE_ENV === "production"`), validasi sesi fail-closed: jika DB unavailable/timeout, Prisma error, user tidak ditemukan di DB (deleted), user nonaktif, role drift, atau identitas sintetik (`user_`, `stf_`) -> sesi mutlak ditolak (`null`).
   - Mutable authorization attributes di-hydrate langsung dari PostgreSQL terkini: `staffId`, `staffCode`, `santriId`, `isKepalaBidangTahfidz`, dan `isPetugasPresensiPutri` (perubahan hak akses langsung efektif tanpa mempercayai klaim JWT lama).
5. **Negative Security Regression Tests**:
   - Menambahkan dan memvalidasi ke-19 skenario auth security pada `tests/auth-production-hardening.test.ts` menggunakan PostgreSQL test database terisolasi.

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
* `tests/auth-production-hardening.test.ts` (19 skenario auth security negative tests pembuktian database-only, fail-closed, isolasi demo, penolakan kredensial statis, penolakan deleted/nonaktif user, role drift, eliminasi privilege lama dari JWT, unifikasi Cookie & Bearer fail-closed, dan hidrasi atribut otorisasi dari PostgreSQL terkini)

### File Dimodifikasi
* `app/actions/auth.ts` (Database-only & fail-closed `loginAction`, eliminasi static fallback demo accounts pada `getCurrentUserAction`, isolasi `quickDemoLoginAction`, secure cookie produksi)
* `app/api/v1/auth/login/route.ts` (Eliminasi fallback katalog statis & universal password, kontrak 503/401/403/200 fail-closed)
* `lib/auth.ts` (Unified resolver `resolveVerifiedSessionPayload()`, production session fail-closed, DB unavailable/timeout -> session ditolak, deleted/nonaktif user -> session ditolak, role drift -> session ditolak, synthetic identity -> ditolak, unifikasi `getCurrentSession()` dan `getAuthFromRequest()`, serta hidrasi mutable authorization attributes dari PostgreSQL: `staffId`, `staffCode`, `santriId`, `isKepalaBidangTahfidz`, `isPetugasPresensiPutri`)
* `app/login/page.tsx` (Pengetatan logika render demo switcher menjadi AND: `NODE_ENV !== "production" && NEXT_PUBLIC_ENABLE_DEMO === "true"`)
* `.env.example` (Dokumentasi konfigurasi `STQ_ENABLE_DEMO_LOGIN` khusus non-produksi)
* `CURRENT_TASK.md` (Dokumentasi status kerja PR #5)

## 4. Status Quality Gates Lokal
- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 warnings, 0 errors)
- [x] `npm test` — PASS (417/417 tests passed, 126 suites)
- [x] `npm run build` — PASS (14 rute statis, 0 errors)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (100% proses/port/temp terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil)
- [x] `npm run qa:structural` — PASS (98/98 assertions bebas overflow/overlap)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan: manifest, icons, privacy, cross-cache collision, offline fallback)
