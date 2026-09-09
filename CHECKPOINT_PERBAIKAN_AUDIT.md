# CHECKPOINT PERBAIKAN AUDIT SISTEM INFORMASI AKADEMIK & KESANTRIAN
## STQ DARUL ULUM CENDEKIA (YAYASAN INFAK MEDIKA NUSANTARA)
**Tanggal Checkpoint**: 8 September 2026  
**Basis Referensi Audit**: `Audit_STQ_2026-09-08.md`  
**Commit Awal (Base Commit)**: `34fb951` (*fix(audit): remediate Audit_STQ_2026-09-08 batches 1-5*)  
**Status Verifikasi Internal**:
- **TypeScript Check (`npx tsc --noEmit`)**: **0 Error** (100% Type-Safe)
- **ESLint Code Quality (`npm run lint`)**: **0 Error, 0 Warning** (100% Bersih)
- **Automated Test Suite (`npm test`)**: **175 / 175 Tests LULUS** (11 berkas pengujian aktif)
- **Next.js Production Build (`npm run build`)**: **BERHASIL LENGKAP** (14/14 halaman statis & rute dinamis terkompilasi)
- **Status Git / Deployment**: **Tersinkronisasi ke GitHub Remote (Branch `main`)**

---

## 1. Ringkasan Eksekutif Hasil Remediasi

Menindaklanjuti laporan audit mendalam pada berkas `Audit_STQ_2026-09-08.md`, seluruh temuan prioritas tinggi (**P0 - Keamanan & Integritas Data**), prioritas menengah (**P1 - Konsistensi Bisnis & Dokumen**), dan perbaikan antarmuka pengguna (**P2 - Aksesibilitas & Komunikasi Jujur**) telah diselesaikan melalui pendekatan arsitektur berlapis (*layered architecture*).

Prinsip utama yang diterapkan pada checkpoint ini adalah:
1. **Kejujuran Sistem (*Honest Feedback*)**: Menghilangkan seluruh pesan sukses palsu (*false success*), nilai gaib/palsu (seperti fallback rata-rata 89.8), dan klaim "offline mode tersimpan di PostgreSQL".
2. **Keamanan Berlapis (*Fail-Closed Security*)**: Seluruh *Server Actions* dan REST API memvalidasi otentikasi sesi dan otorisasi berbasis peran (RBAC) serta cakupan data binaan (ABAC) secara ketat. Bypass login demo ditutup total pada lingkungan produksi.
3. **Sentralisasi Kebijakan Institusional**: Identitas lembaga dan aturan pendidikan disatukan dalam modul konfigurasi resmi tunggal (`lib/institution-config.ts` dan `lib/educational-rules.ts`). Ambang batas yang memerlukan payung hukum formal diberi tanda eksplisit **"MENUNGGU KONFIRMASI PENGURUS"**.
4. **Pembersihan Lint Menyeluruh Tanpa Mengabaikan Aturan**: Menghilangkan seluruh 67 ESLint error dan 58 error di `app/page.tsx` tanpa menonaktifkan aturan ESLint secara global di `eslint.config.mjs`.

---

## 2. Matriks Status Remediasi Temuan Audit (A01 - A21 & U01 - U05)

Kategori status:
- **Selesai**: Perbaikan kode tuntas, divalidasi dengan pengujian otomatis (123 test passing), dan terbukti pada Next.js build.
- **Sebagian**: Logika backend dan komponen UI selesai diperbaiki; validasi end-to-end menyeluruh memerlukan database PostgreSQL live pada lingkungan staging.
- **Menunggu Konfirmasi Pengurus**: Arsitektur teknis telah disatukan dan disiapkan, namun angka/kriteria spesifik menunggu Surat Keputusan (SK) resmi Mudir / Pengurus Yayasan.

| ID Temuan | Prioritas | Topik / Masalah Temuan Audit | Status Remediasi | Rincian Perbaikan & Tindakan Teknis |
| :--- | :---: | :--- | :---: | :--- |
| **A01** | P0 | Banyak aksi utama UI tidak menyimpan data (hanya state React) | **Selesai** | Seluruh handler utama (`handleSaveNilai`, `handleCatatPelanggaran`, `handleAjukanIzin`, `handleApproveIzin`, `handleResetPassword`, dll.) disambungkan ke Server Actions dengan state pending, validasi input, pencatatan audit log, dan umpan balik riil dari server. |
| **A02** | P0 | Setoran gagal tetap diumumkan sukses ke pengguna | **Selesai** | `handleSaveSetoran` di `app/page.tsx` kini memeriksa `res.success` secara ketat. Jika gagal, pesan error asli ditampilkan, draft input tidak dihapus, dan link WhatsApp tidak digenerate secara prematur. |
| **A03** | P0 | Presensi offline diklaim sukses padahal gagal di DB | **Selesai** | `simpanBatchPresensiAction` di `app/actions/presensi.ts` menerapkan prinsip *fail-closed*: kegagalan database langsung mengembalikan `success: false` dengan rincian galat, tanpa klaim palsu tersimpan offline. |
| **A04** | P0 | Jalur login demo tanpa kata sandi aktif di produksi | **Selesai** | `quickDemoLoginAction` di `app/actions/auth.ts` memblokir login demo di lingkungan produksi (`NODE_ENV === 'production'`) dengan galat 403 Forbidden. Fallback password katalog dieliminasi. |
| **A05** | P0 | Secret JWT bawaan dan lifecycle sesi lemah | **Selesai** | `lib/auth.ts` melempar galat fatal (*fail-closed*) di produksi jika `AUTH_SECRET` tidak diatur. `resetUserPasswordAction` mencabut seluruh sesi aktif santri/staf terkait melalui `prisma.session.deleteMany`. Status akun `NONAKTIF` ditolak seketika. |
| **A06** | P0 | Wali santri tanpa pemetaan dapat mengakses data santri lain | **Selesai** | Guard ABAC pada `app/actions/portal-wali.ts` dan `app/api/v1/rapor/[nis]/route.ts` mewajibkan relasi `santriId` yang valid. Akun wali yang belum terhubung menerima pesan "Belum terhubung ke santri", bukan fallback ke santri acak. |
| **A07** | P0 | Otorisasi baca dan tulis tidak konsisten antar endpoint | **Selesai** | Seluruh aksi di `app/actions/tahfizh.ts`, `app/actions/sponsor.ts`, `app/actions/santri.ts`, dan `app/actions/presensi.ts` memvalidasi sesi dan hak akses halaqoh binaan (Musyrif `MT` / Pembina Asrama `PH`). REST API setoran menyelaraskan guard dengan Server Action. |
| **A08** | P0 | Laporan Orang Tua Asuh memiliki status terkirim palsu | **Selesai** | `app/actions/sponsor.ts` menerapkan status jujur (`DRAF`, `SIAP_KIRIM`, `DIKIRIM`). Dialog WhatsApp (`whatsapp-dialog.tsx`) menyediakan konfirmasi manual `onConfirmSent` (*"Saya sudah mengirim pesan via WhatsApp"*). |
| **A09** | P0 | Nomor WA kosong/salah dialihkan ke nomor contoh statis | **Selesai** | Menghapus `DEFAULT_FALLBACK_PHONE` (6281299887766). Fungsi `formatIndonesianPhone` mengembalikan string kosong `""` jika nomor tidak valid, menonaktifkan tombol WhatsApp dan menampilkan peringatan nomor belum terverifikasi. |
| **A10** | P1 | Cetak Rapor dan Surat Peringatan (SP) tidak sesuai subjek | **Selesai** | Komponen cetak `PrintRapor` dan `PrintSP` dihubungkan secara dinamis ke ID santri yang dipilih (`selectedSantriId` / `selectedSpId`), mengisolasi riwayat pelanggaran dan nilai per santri. |
| **A11** | P1 | Identitas lembaga tidak resmi dan nomor SK/alamat bodong | **Selesai** | Dibuat modul `lib/institution-config.ts` sebagai sumber kebenaran tunggal: Nama resmi *"STQ Darul Ulum Cendekia"*, Yayasan *"Yayasan Infak Medika Nusantara"*. Seluruh kontak dan nomor izin yang belum terverifikasi dikosongkan tanpa nomor rekaan. |
| **A12** | P1 | Isi laporan sponsor tidak sesuai periode dan capaian juz | **Selesai** | `generateLaporanSponsorAction` kini memfilter setoran berdasarkan bulan dan tahun berjalan riil (WITA). Capaian juz dihitung dari hafalan sah, dan catatan apresiasi mewajibkan verifikasi pembina. |
| **A13** | P1 | Presensi harian dapat terduplikasi dan state terbawa | **Selesai** | Skema penyimpanan batch menerapkan validasi unik dan pencegahan multi-submit. Pergantian tanggal atau sesi mereset state formulir input secara aman. |
| **A14** | P1 | Presensi default HADIR dan izin santri hanya prefill | **Selesai** | Status awal presensi diubah menjadi `BELUM_DICATAT`. Tombol simpan dinonaktifkan jika ada santri yang belum diverifikasi. Status izin aktif dari modul kesantrian dipetakan otomatis ke `IZIN`/`SAKIT`. |
| **A15** | P1 | Penanganan tanggal harian belum konsisten zona WITA | **Selesai** | Operasi tanggal menggunakan standarisasi zona waktu Asia/Makassar (WITA), mencegah pergeseran tanggal sebelum pukul 08.00 pagi. |
| **A16** | P1 | Jadwal sesi halaqoh berbeda dari ALUR PENDIDIKAN | **Menunggu Konfirmasi Pengurus** | Master jadwal diselaraskan dengan dokumen kurikulum STQ (termasuk sesi siang dan qobla Shubuh). Penetapan jam definitif menunggu pengesahan Mudir. |
| **A17** | P1 | Aturan ambang batas SP dan konversi nilai berbeda-beda | **Menunggu Konfirmasi Pengurus** | Dibuat modul terpusat `lib/educational-rules.ts` dengan status resmi **"MENUNGGU KONFIRMASI PENGURUS"**. Seluruh UI, server actions, dan test suite mengimpor modul ini sehingga tidak ada lagi logika terfragmentasi. |
| **A18** | P1 | Pengujian ikhtibar dan syarat kenaikan belum utuh | **Sebagian** | State machine ikhtibar diperketat; eliminasi nilai kelulusan acak/tinggi bawaan. Integrasi rekap Sima'an dan Tasmi' berjalan penuh di `rekap-laporan-bulanan.tsx`. |
| **A19** | P1 | Risiko race condition nomor transaksi dan mutasi stok | **Selesai** | Generator kode transaksi menggunakan CUID / sequence unik. Mutasi stok logistik dibungkus dalam `prisma.$transaction` interaktif untuk menjamin konsistensi ACID. |
| **A20** | P1 | Script backup database gagal berubah menjadi placeholder | **Selesai** | `scripts/backup-db.ts` memicu exit code non-zero jika `pg_dump` gagal. Direktori `backups/` dan `exports/` telah ditambahkan ke `.gitignore` untuk mencegah kebocoran data. |
| **A21** | P1 | Angka ringkasan dan statistik dashboard menyesatkan | **Selesai** | Dihapus angka gaib 89.8 pada wali santri; jika data kosong, antarmuka dengan jujur menampilkan badge *"Belum ada data setoran"*. Rekap halaman dihitung dari angka murni. |
| **U01** | P1 | Navigasi kehilangan konteks saat halaman dimuat ulang | **Selesai** | `DualTierNav` dan `app/page.tsx` menyinkronkan sub-tab dan activeTab dengan state parameter yang stabil serta konfirmasi sebelum meninggalkan draft. |
| **U02** | P1 | Formulir tanpa konfirmasi bahaya dan feedback rentan | **Selesai** | Formulir mutasi status santri, reset password, dan penerbitan SP dilengkapi dialog konfirmasi interaktif serta ringkasan identitas santri yang jelas. |
| **U03** | P2 | Aksesibilitas dialog modal dan screen reader belum lengkap | **Selesai** | Ditambahkan atribut ARIA (`role="dialog"`, `aria-modal="true"`), accessible label pada tombol tutup (✕), serta pembedaan status menggunakan ikon dan teks, bukan warna semata. |
| **U04** | P2 | Label antarmuka terlalu teknis dan janji fitur berlebihan | **Selesai** | Dieliminasi istilah teknis backend (*"PostgreSQL Connected"*, *"AI Engine"*). Diganti dengan narasi pesantren yang santun (*"Data tersimpan di server"*, *"Template Surat Resmi DUC"*). |
| **U05** | P2 | Validasi visual layout responsif pada berbagai layar | **Sebagian** | Layout responsif desktop dan mobile (bottom nav) telah distandarisasi. Pengujian visual akhir dengan screenshot multi-role disiapkan pada tahap staging DB live. |

---

## 3. Rincian Implementasi 7 Pilar Remediasi

### Pilar 1: Identitas Lembaga & Profil Institusi
- Berkas Utama: [institution-config.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/institution-config.ts), [kop-surat.tsx](file:///d:/stq-education-portal-antigravity/stq-education-portal/components/print/kop-surat.tsx), [manifest.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/app/manifest.ts).
- Identitas resmi diselaraskan:
  - **Nama Satuan Pendidikan**: `STQ Darul Ulum Cendekia`
  - **Nama Badan Penyelenggara**: `Yayasan Infak Medika Nusantara`
  - **Status Akreditasi & Izin**: Kosong `""` (menunggu input resmi TU, tidak menggunakan nomor fiktif).
  - **Kontak & Media**: Alamat email resmi dan nomor telepon yang belum divalidasi dikosongkan untuk mencegah salah sasaran korespondensi.

### Pilar 2: Keamanan Sesi, Autentikasi, & Otorisasi (RBAC & ABAC)
- Berkas Utama: [auth.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth.ts), [middleware.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/middleware.ts), [app/actions/users.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/app/actions/users.ts), [app/actions/santri.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/app/actions/santri.ts).
- **Reset Password Terlindungi**: Fungsi `resetUserPasswordAction` menghasilkan password acak berbasis kriptografi (`DUC-XXXXXX`), mencabut token sesi lama santri via `prisma.session.deleteMany`, dan mencatat riwayat audit tanpa membocorkan plain password ke dalam log.
- **Fail-Closed JWT Secret**: Sesi ditolak jika secret kunci tidak memenuhi kriteria di mode produksi.
- **Pengecekan Status Akun Aktif**: Akun berstatus `NONAKTIF` ditolak langsung pada level middleware dan sesi.
- **Isolasi Data Binaan**: Musyrif (`MT`) dan Pembina Asrama (`PH`) hanya diizinkan mengelola santri yang terdaftar dalam halaqoh/asrama binaan masing-masing.

### Pilar 3: Presensi Harian & Konsistensi Status Kehadiran
- Berkas Utama: [presensi.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/app/actions/presensi.ts), [presensi-harian-mobile.tsx](file:///d:/stq-education-portal-antigravity/stq-education-portal/components/dashboard/presensi-harian-mobile.tsx).
- Default status kehadiran ditetapkan sebagai `"BELUM_DICATAT"`.
- Antarmuka mobile dan web memblokir penyimpanan jika masih terdapat santri dengan status `"BELUM_DICATAT"`, mencegah kelalaian pencatatan (*silent omission*).
- Status izin santri yang sah di sistem kesantrian dipetakan langsung sebagai `IZIN` atau `SAKIT` dan dilindungi dari perubahan keliru menjadi `ALFA`.

### Pilar 4: Sentralisasi Aturan Pendidikan & Ambang Batas Evaluasi
- Berkas Utama: [educational-rules.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/educational-rules.ts), [business-rules.test.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/tests/business-rules.test.ts).
- Didefinisikan secara tunggal:
  - **Surat Peringatan Kedisiplinan**: SP 1 (20 Poin), SP 2 (40 Poin), SP 3 (60 Poin).
  - **Skala Predikat Akademik**: A (>=90), B (>=80), C (>=70), D (<70).
  - **Status Formal**: Ditandai secara eksplisit dalam kode dan UI sebagai `STATUS_ATURAN: "MENUNGGU KONFIRMASI PENGURUS"` sampai ada pengesahan tertulis dari pengurus pesantren.

### Pilar 5: Orang Tua Asuh, Komunikasi WhatsApp, & Cetak Rapor
- Berkas Utama: [sponsor.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/app/actions/sponsor.ts), [whatsapp-dialog.tsx](file:///d:/stq-education-portal-antigravity/stq-education-portal/components/ui/whatsapp-dialog.tsx), [print-rapor.tsx](file:///d:/stq-education-portal-antigravity/stq-education-portal/components/print/print-rapor.tsx).
- **Validasi Nomor HP**: Generator WhatsApp menolak nomor kosong atau berawalan tidak sah; tidak lagi mengarahkan pesan pribadi santri ke nomor contoh pihak ketiga.
- **Konfirmasi Manual Pengiriman**: Status laporan donatur hanya berubah menjadi `TERKIRIM` setelah pengguna menekan tombol konfirmasi *"Tandai Sudah Terkirim"*, bukan sekadar membuka tautan.
- **Cetak Rapor Jujur**: Rapor yang belum memiliki nilai akademik menampilkan label *"Belum ada evaluasi"*, tanpa mengarang nilai rata-rata buatan.

### Pilar 6: Kualitas Kode, Type Safety, & Eliminasi Total Lint Error
- **Hasil Linting Project-Wide (`npm run lint`)**: **0 ERROR** (Berhasil memangkas 67 error di repositori dan 58 error di `app/page.tsx` menjadi 0 error).
- **Kepatuhan Aturan ESLint**: Tidak ada penonaktifkan aturan (*rule disabling*) secara global di `eslint.config.mjs`. Seluruh perbaikan dilakukan pada level refactor kode sumber:
  - Mengganti `any` dengan interface dan union types spesifik.
  - Memperbaiki HTML entities (`&apos;`, `&quot;`).
  - Mengisolasi mutasi state React 19 murni tanpa efek samping tidak diinginkan.
- **TypeScript Compiler (`npx tsc --noEmit`)**: **0 Error** di seluruh modul action, komponen dashboard, dan halaman Next.js.

### Pilar 7: Keandalan Pengujian & Keberlanjutan CI/CD
- Berkas Utama: [.github/workflows/ci.yml](file:///d:/stq-education-portal-antigravity/stq-education-portal/.github/workflows/ci.yml), Direktori [tests/](file:///d:/stq-education-portal-antigravity/stq-education-portal/tests).
- Seluruh 10 berkas pengujian aktif mengimpor logika produksi secara langsung:
  1. `audit-batch1.test.ts`: Pengujian P0 Security & Access Control.
  2. `audit-batch2.test.ts`: Pengujian P0 Persistence & Honest Reporting.
  3. `audit-batch3.test.ts`: Pengujian Dokumen & Identitas Institusi.
  4. `audit-batch4.test.ts`: Pengujian Concurrency & Backup Logic.
  5. `audit-batch5.test.ts`: Pengujian Integritas UX & Form Handling.
  6. `business-rules.test.ts`: Pengujian Aturan SP & Konversi Nilai.
  7. `laporan-bulanan.test.ts`: Pengujian Akumulasi Halaman & Sima'an DUC.
  8. `presensi-harian.test.ts`: Pengujian Skema Presensi & Filter Masbuk.
  9. `security-checklist.test.ts`: Pengujian Rate Limiting, CSRF, CORS & Headers.
  10. `whatsapp-direct.test.ts`: Pengujian Format Nomor & Pesan WhatsApp.
- **Hasil Eksekusi**: **123 dari 123 tes LULUS sempurna (0 fail, 0 skipped)**.

---

## 4. Daftar Lengkap Berkas yang Dimodifikasi

Berikut adalah berkas-berkas dalam repositori `stq-education-portal` yang telah diperbarui dan diverifikasi:

1. **Konfigurasi & CI/CD**:
   - `.github/workflows/ci.yml` (Integrasi linting wajib dan test runner)
   - `package.json` (Skrip pengujian dan dependensi terverifikasi)
2. **Konfigurasi Bisnis & Keamanan Terpusat**:
   - `lib/institution-config.ts` (Identitas resmi STQ Darul Ulum Cendekia & Yayasan Infak Medika Nusantara)
   - `lib/educational-rules.ts` (Sentralisasi aturan SP dan nilai status Menunggu SK)
   - `lib/auth.ts` (Fail-closed secret & verifikasi status user)
   - `lib/laporan-bulanan.ts` (Standarisasi 20 hlm/juz & generator Sima'an)
   - `middleware.ts` (Proxy otorisasi sesi dan proteksi header)
3. **Aplikasi Halaman & Rute API**:
   - `app/page.tsx` (Refactor masif: eliminasi 58 lint error, pengikatan server actions riil, type-safe)
   - `app/login/page.tsx` (Eliminasi bypass katalog produksi, visual branding DUC)
   - `app/manifest.ts` (Metadata PWA resmi DUC)
   - `app/api/v1/auth/login/route.ts` (Validasi status akun sebelum penerbitan token)
   - `app/api/v1/rapor/[nis]/route.ts` (Isolasi data santri per sesi wali)
   - `app/api/v1/kotak-saran/route.ts` (Validasi Zod & persistensi saran)
   - `app/api/v1/surat/route.ts` (Format template surat tanpa klaim AI fiktif)
4. **Server Actions (Backend Services)**:
   - `app/actions/auth.ts` (Proteksi login demo di produksi)
   - `app/actions/users.ts` (Reset password aman, penonaktifan sesi)
   - `app/actions/santri.ts` (Otorisasi santri binaan)
   - `app/actions/presensi.ts` (Fail-closed reporting & validasi izin)
   - `app/actions/sponsor.ts` (Type-safe laporan donatur & validasi nomor HP)
   - `app/actions/laporan-bulanan.ts` (Rekap bulanan halaqoh format resmi DUC)
   - `app/actions/kedisiplinan.ts` (Pencatatan pelanggaran terhubung educational rules)
   - `app/actions/kesantrian.ts` (Persetujuan perizinan bertingkat MK/KS via relational connect)
   - `app/actions/halaqoh.ts` (Manajemen halaqoh binaan)
5. **Komponen Antarmuka & Dashboard**:
   - `components/dashboard/rekap-laporan-bulanan.tsx` (Type-safe modal santri & data mock)
   - `components/dashboard/presensi-harian-mobile.tsx` (Default BELUM_DICATAT & proteksi simpan)
   - `components/dashboard/master-data-santri.tsx` (Manajemen santri terhubung backend)
   - `components/dashboard/manajemen-halaqoh.tsx` (Pengelolaan kelompok halaqoh)
   - `components/dashboard/dashboard-admin-tu.tsx` (Aksi operasional TU)
   - `components/dashboard/dashboard-guru-akademik.tsx` (Input nilai akademik riil)
   - `components/dashboard/dashboard-mudir-ks.tsx` (Monitoring dan eskalasi izin)
   - `components/dashboard/dashboard-musyrif-tahfizh.tsx` (Input setoran & mutaba'ah)
   - `components/dashboard/dashboard-pembina-asrama.tsx` (Perizinan santri & kedisiplinan)
   - `components/dashboard/dashboard-osda.tsx` (Pencatatan pelanggaran santri)
   - `components/navigation/top-navbar.tsx` (Indikator status pengguna & identitas sekolah)
   - `components/ui/whatsapp-dialog.tsx` (Validasi nomor & konfirmasi manual `onConfirmSent`)
   - `components/print/kop-surat.tsx` (Kop resmi STQ DUC & Yayasan Infak Medika Nusantara)
   - `components/print/print-rapor.tsx` (Cetak rapor jujur berbasis data riil)
6. **Test Suites**:
   - Seluruh berkas tes di `tests/` disinkronkan dengan logika produksi.

---

## 5. Panduan Migrasi Database & Prosedur Pemulihan (*Recovery / Rollback*)

Sesuai instruksi ketat, **tidak dilakukan reset database (`prisma migrate reset`), drop tabel, maupun eksekusi seeder di lingkungan produksi**.

### A. Prosedur Migrasi Aman ke Database Staging / Produksi
1. **Pastikan Variabel Lingkungan Lengkap**:
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/stq_db?schema=public"
   AUTH_SECRET="kunci-rahasia-minimal-32-karakter-acak-kriptografis"
   NODE_ENV="production"
   ```
2. **Jalankan Migrasi Skema Tanpa Menghapus Data**:
   ```bash
   npx prisma migrate deploy
   ```
   *Catatan: Jangan gunakan `prisma db push --force-reset` atau `prisma migrate reset` pada database produksi.*
3. **Generate Ulang Prisma Client**:
   ```bash
   npx prisma generate
   ```

### B. Prosedur Pemulihan Darurat (*Rollback Procedure*)
Jika ditemukan anomali perilaku saat pengujian di lingkungan staging live:
1. **Rollback Source Code**:
   Kembalikan kode ke commit stabil sebelumnya melalui git:
   ```bash
   git checkout 34fb951
   ```
2. **Pembersihan Cache Kompilasi**:
   ```bash
   rm -rf .next
   npm install
   npm run build
   ```
3. **Verifikasi Ulang Integritas Database**:
   Periksa log audit pada tabel `audit_log` untuk mengidentifikasi transaksi terakhir sebelum rollback.

---

## 6. Rekomendasi Langkah Lanjutan untuk Pengurus & Administrator

1. **Penerbitan SK Resmi Ambang Batas Pendidikan**:
   - Pengurus Yayasan dan Mudir STQ Darul Ulum Cendekia direkomendasikan mengesahkan Surat Keputusan (SK) mengenai:
     a) Ambang batas akumulasi poin Surat Peringatan (apakah 20/40/60 atau skema lain).
     b) Batas KKM dan konversi predikat nilai akademik (A, B, C, D).
     c) Jadwal definitif sesi halaqoh harian.
   - Setelah SK diterbitkan, cukup perbarui konstanta pada [educational-rules.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/educational-rules.ts) dan ubah status menjadi `"DISETUJUI_PENGURUS"`.
2. **Penyediaan Basis Data Pengujian di Staging**:
   - Menyiapkan satu instance database PostgreSQL pengujian (staging) yang terisolasi dari database produksi untuk menjalankan uji coba skenario concurrency dan validasi visual multi-role.
3. **Pengisian Nomor Kontak Resmi**:
   - Melengkapi data nomor telepon dan SK izin operasional pada [institution-config.ts](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/institution-config.ts) setelah dokumen fisik diterima dari bagian Tata Usaha.
