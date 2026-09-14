# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Status Terkini: PR #6 — Draft Dibuka & Code Audit PASS

PR #6 — Tahfizh Data Integrity & Target Operationalization (`abdngr23-pixel/stq-education-portal`):
* **Draft PR Status:** Draft PR #6 telah resmi dibuka pada branch `review/tahfizh-data-integrity-targets` menuju `main`.
* **PR Link:** [PR #6 — Tahfizh Data Integrity & Target Operationalization](https://github.com/abdngr23-pixel/stq-education-portal/pull/6)
* **Independent ChatGPT Final Code Audit:** **PASS** (Seluruh scope fungsional, integritas data, dan keamanan ABAC telah disetujui).
* **Current Status:** Menunggu eksekusi/verifikasi migrasi skema produksi (`TargetSantri.targetPekanan` dan `targetBulanan` Double Precision) serta otorisasi final merge.

---

## 2. Riwayat Commit & State Git

* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Target PR Base (`main`):** `8ed8688ba9d6483d0d223aae976cac8a27ca7c01`
* **Branch:** `review/tahfizh-data-integrity-targets`
* **Approved Code HEAD:** `79e4c1d6d3f7c3122ab2a42d5d3cff096d4b07c7`

### Jejak Commit PR #6:
1. `d165565` — Commit 1: `feat(tahfizh): operationalize targets, eliminate mock data, and enforce data integrity`
2. `b2f20cb` — Commit 2: `fix(tahfizh): audit remediation for ABAC, fractional targets, SABQI applicability, and WITA boundaries`
3. `cdd3f33` — Commit 3: `fix(tahfizh): final audit remediation for baseline fallback, static fixtures, and ABAC portal wali`
4. `b3b5d58` — Commit 4: `fix(tahfizh): final closeout patch for baseline progress, sabaqi boundaries, and read ABAC`
5. `06ac467` — Commit 5: `fix(security): secure halaqoh read actions, remove static halaqoh fallbacks, and make report period dynamic`
6. `79e4c1d` — Pre-Merge Polish: `fix(tahfizh): pre-merge polish for role-aware halaqoh fetch, stale report prevention, and DB error handling`

---

## 3. Ringkasan Perubahan Utama PR #6

1. **Penghapusan Fake/Mock Operational Tahfizh**:
   - Menghapus fallback array statis, mock santri, mock setoran, dan mock target pada seluruh jalur produksi.
   - Semua data santri, halaqoh, setoran, dan progress di-resolve murni dari PostgreSQL.
2. **Baseline Tahfizh Authoritative**:
   - Boundary resmi: `modalHafalanAwalHalaman + SABAQ sah >= tanggalBaselineTahfizh`.
   - Jika `tanggalBaselineTahfizh` null: sistem fail-closed (`tambahanSabaq: 0`, `totalHafalan: modalAwal`) tanpa aggregate SABAQ historis.
   - Setoran sebelum tanggal baseline dieksklusi dari perhitungan bulanan.
3. **Konsistensi Eksklusi Status DIBATALKAN**:
   - Status `DIBATALKAN` dieksklusi secara seragam dari seluruh agregasi capaian, laporan bulanan, mutabaah, dan progress santri.
4. **TargetSantri sebagai Source of Truth & Target Pecahan 0.5**:
   - Model `TargetSantri` menjadi sumber kebenaran target bulanan dan pekanan.
   - Migrasi tipe kolom `targetPekanan` dan `targetBulanan` ke `Double Precision` (`Float` di Prisma) untuk mendukung target pecahan (0.5 halaman).
5. **Target Akhir Program dari Database**:
   - Target akhir program santri dihitung dinamis dari profil pangkalan data santri, bukan konstanta statis hardcoded.
6. **WITA-Safe Reporting & Dynamic Period**:
   - Boundary penanggalan, awal/akhir bulan, dan rekapitulasi menggunakan `lib/wita-date.ts` (`Asia/Makassar`).
   - Bulan default dinamis mengikuti kalender WITA berjalan.
   - Tahun ajaran dihimpun dinamis dari relasi database `Halaqoh` (zero hardcoded `2026/2027` / `2025/2026`).
   - Komponen rekap laporan bulanan dilengkapi query-key matching untuk mencegah render laporan stale.
7. **Status SABAQ / SABQI / MANZIL / MUFAR**:
   - Validasi kelayakan SABQI berbasis SABAQ sah pekan berjalan setelah effective baseline boundary.
8. **Tahfizh ABAC Hardening & Role Authorization**:
   - Scoping `getHalaqohListAction()` dan `getHalaqohDetailAction()`:
     - KS / ADM / YAY / Kabid Tahfizh: global read.
     - MT / PH: strictly scoped ke `pembinaId === session.staffId` (cross-halaqoh -> deny).
     - Fail-closed error handling pada lookup database otorisasi halaqoh.
     - Minimal projection staf `{ id, nama }` tanpa membocorkan field sensitif.
     - Default-deny untuk unauthenticated dan role tanpa izin.
   - Client `app/page.tsx` bersifat role-aware menggunakan `hasModuleAccess` kanonikal (role tanpa izin halaqoh tidak memicu fetch / banner error palsu).
9. **Reward & Finalization Hardening**:
   - Finalisasi reward dan sertifikat hafalan diverifikasi fail-closed terhadap hak akses pengguna dan capaian aktual.
10. **Portal Wali Tahfizh-related ABAC**:
    - Akses data portal wali (WS) dan santri (ST) dibatasi pada `santriId` yang terhubung ke akun session aktif. Akses ke santri lain ditolak secara eksplisit.
11. **Dynamic Halaqoh DB & Penghapusan Fallback Statis**:
    - Menghapus fallback `getHalaqohByStaff()` dari seluruh jalur autentikasi produksi (`resolveVerifiedSessionPayload`, `loginAction`, `app/page.tsx`).
    - Staf tanpa halaqoh DB menghasilkan `halaqohName: null` (fail-closed).
12. **Migrasi Skema Database**:
    - File migrasi `prisma/migrations/20260914100000_target_santri_float/migration.sql` disiapkan untuk migrasi aman `Double Precision`.

---

## 4. Status Quality Gates Lokal & CI/CD

- [x] `npx tsc --noEmit` — PASS (0 errors)
- [x] `npm run typecheck:test` — PASS (0 errors)
- [x] `npm run lint` — PASS (0 errors, 0 warnings)
- [x] `npm test` — PASS (471/471 tests passed, 127 suites, 55/55 skenario PR #6 lulus)
- [x] `npm run build` — PASS (14 rute Next.js Turbopack terkompilasi, 0 errors)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` — PASS (6/6 skenario multi-cycle PostgreSQL cleanup 100% terisolasi dan bersih)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` — PASS (6/6 skenario riil E2E Puppeteer)
- [x] `npm run qa:structural` — PASS (98/98 structural layout assertions lulus, 0 findings)
- [x] `npm run qa:pwa` — PASS (8/8 tahapan verifikasi Service Worker, cache allowlist, & offline fallback)
- [x] GitHub Actions CI — SUCCESS (Runs: 34811841416, 34811838197)
- [x] Vercel Production Deployments — SUCCESS (`stq-education-portal-app`, `stq-education-portal`)

---

## 5. Rencana Langkah Berikutnya
1. Preflight read-only migrasi skema database produksi (`TargetSantri` float/double precision).
2. Menunggu otorisasi final dari ChatGPT/User untuk eksekusi migrasi produksi dan merge PR #6.
