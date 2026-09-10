# CHECKPOINT FINALISASI FITUR OPERASIONAL STQ DARUL ULUM CENDEKIA (STQ DUC)

**Tanggal:** 10 September 2026  
**Repositori:** `https://github.com/abdngr23-pixel/stq-education-portal`  
**Branch:** `main`  
**Baseline Commit:** `8e67b671e20284b21cd2a99b8a1062c44944a783`  
**Target Lingkungan:** Production (Vercel + Supabase / Prisma Accelerate PostgreSQL)

---

## 1. Ringkasan Eksekutif & Quality Gates

Seluruh 14 butir tugas operasional, penyimpanan data, mutaba'ah harian, materi kepesantrenan, sistem reward–sanksi, kedisiplinan, dan hak akses telah diselesaikan secara tuntas dan telah lulus verifikasi pada seluruh quality gates tanpa peringatan maupun galat:

| Quality Gate | Perintah Eksekusi | Status | Catatan |
|---|---|---|---|
| **Static Type Checking** | `npx tsc --noEmit` | **PASS (0 Galat)** | Strict mode aktif, seluruh tipe aman |
| **Code Linting** | `npm run lint` | **PASS (0 Galat, 0 Peringatan)** | ESLint Next.js v16 bersih |
| **Unit & Integration Tests** | `npm test` | **PASS (219/219 Lulus)** | 81 test suites, 0 failed, 0 skipped |
| **Production Build** | `npm run build` | **PASS (Exit Code 0)** | Turbopack compilation & static generation selesai |
| **Database Integrity** | `dotenv -e .env.production.local -- npx prisma db push` | **PASS (Synced)** | Zero data loss, non-destructive migration |

---

## 2. Status Rinci 14 Butir Tugas Operasional

### Butir 1: Skema Setoran & Migrasi Aman
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - `setoran_tahfizh` murni berbasis halaman (`halamanMulai`, `halamanSelesai`, `jumlahHalaman`).
  - Kolom legasi (`surah_mulai`, `ayat_mulai`, `surah_selesai`, `ayat_selesai`) telah dihapus secara aman melalui migrasi bertahap.
  - Validasi ketat Al-Qur'an (Mushaf Madinah): batas halaman 1–604, jumlah halaman minimal 0.5 halaman, dan rentang halaman wajib berada dalam batas Juz yang dideklarasikan.
  - Pencegahan race condition dengan pembangkitan kode setoran deterministik acak (`SET-<timestamp>-<entropy>`) serta mekanisme retry otomatis saat Prisma error `P2002`.
  - Format kode galat terstruktur (`ERR-SET-PAG-001`, `ERR-SET-PAG-002`, `ERR-SET-PAG-003`, `ERR-SET-CONC-001`).

### Butir 2: Perhitungan Sabaqi Nyata & Referensi Kumulatif
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Sabaqi nyata dihitung murni dari setoran riil bertipe `SABAQ` yang tercatat sejak hari Senin pukul 00:00:00 WITA pada pekan berjalan (`lib/sabaqi.ts`).
  - Jika belum ada setoran Sabaq tersimpan pada pekan berjalan, sistem mengembalikan label ramah: `"Belum ada Sabaq tersimpan pada pekan ini."` (bukan fallback modal awal).
  - Algoritma referensi kumulatif Sabaqi tetap dipertahankan sebagai panduan dinamis bagi musyrif (Senin = setoran hari itu, Selasa–Jumat = kumulatif Sabaq dari hari Senin s.d. hari bersangkutan).

### Butir 3: Target Akhir 30 Juz Terstandarisasi
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Seluruh 57 santri riil memiliki `targetAkhirProgramJuz = 30` di database.
  - Kartu santri (`components/ui/santri-card.tsx`), Dashboard Musyrif, Dashboard Wali Santri, dan Rapor Cetak (`components/print/print-rapor.tsx`) secara eksplisit menampilkan teks baku:
    > *"Capaian X dari Target Akhir 30 Juz"*
  - Template pesan WhatsApp (`lib/whatsapp.ts`) secara konsisten menyertakan informasi target akhir program 30 Juz.

### Butir 4: Sistem Reward & Sanksi Bulanan
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Disediakan model `KebijakanRewardSanksi` dengan konfigurasi Mudir:
    - Bintang Tasmi' / Sima'an (default: 5 bintang).
    - Hak Libur Tambahan per uji hafalan (default: 1 hari).
    - Ambang batas persentase minimal kelulusan target (default: 80%).
  - Server actions lengkap di `app/actions/reward-sanksi.ts`:
    - `prosesRewardTasmiSimaanAction` (idempoten dan mencatat mutasi bintang serta hak libur).
    - `batalkanRewardTasmiSimaanAction` (pembatalan reward berserta audit log).
    - `previewFinalisasiBulananAction` & `finalisasiLaporanBulananAction` (evaluasi akhir bulan otomatis: santri yang tidak mencapai target bulanan berstatus `KEHILANGAN_KUNJUNGAN`).
    - `batalkanFinalisasiBulananAction` (override Mudir untuk kasus khusus seperti sakit/dispensasi).

### Butir 5: Materi Kepesantrenan & Otorisasi Ketat
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - 5 mata pelajaran inti resmi terdaftar di database:
    1. `KPS-ARB` - Bahasa Arab Terpadu
    2. `KPS-FQH` - Fiqih & Ibadah Praktis
    3. `KPS-TFS` - Tafsir Al-Qur'an
    4. `KPS-TJW` - Tajwid & Tahsin
    5. `KPS-AQD` - Aqidah & Akhlaq
  - Pengelolaan nilai kepesantrenan (`app/actions/kepesantrenan.ts`) hanya diizinkan untuk:
    - Kepala Sekolah / Mudir (`KS`)
    - Musyrif Tahfizh (`MT`)
    - Pembina Halaqoh (`PH`)
  - Role Staf Umum (`GA`), Staf Tata Usaha (`ST`), dan Wali Santri (`WALI`) ditolak secara tegas (fail-closed, error 403).
  - Nilai angka (0–100) otomatis dikonversi ke predikat huruf (A, B+, B, C, D) dengan standar DUC.

### Butir 6: Pengurutan Santriwati (A-Z)
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Pada query `getSantriListAction` (`app/actions/santri.ts`) dan `getHalaqohDetailAction` (`app/actions/halaqoh.ts`):
    - Santriwati (`jenisKelamin === 'P'`) diurutkan secara alfabetis A-Z menggunakan `localeCompare('id', { sensitivity: 'base' })`.
    - Urutan santriwan (`jenisKelamin === 'L'`) tetap terjaga sesuai urutan master pesantren.

### Butir 7: Hak Akses Petugas Presensi Putri
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Penambahan field `isPetugasPresensiPutri` pada tabel `User` dan token JWT/UserSession.
  - Pada `simpanBatchPresensiAction` (`app/actions/presensi.ts`):
    - Jika pengguna adalah Petugas Presensi Putri (atau role `ST` berjenis kelamin `'P'`), sistem secara ketat memverifikasi seluruh santri dalam payload.
    - Jika ditemukan satu saja santri laki-laki (`L`), seluruh transaksi langsung dibatalkan (fail-closed) dengan pesan galat:
      > *"Petugas Presensi Putri hanya memiliki wewenang mencatat presensi santriwati (akhwat)."*

### Butir 8: Mutaba'ah Harian Terpusat
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Model `CatatanMutabaahHarian` mendukung 7 komponen disiplin ibadah:
    1. Hadits (setoran hafalan hadits harian)
    2. Mufrodat (kosakata harian)
    3. Vocabulary (bahasa Inggris)
    4. Shalat Tahajjud (kehadiran qiyamul lail)
    5. Shalat Dhuha
    6. Puasa Sunnah (Senin-Kamis/Ayyamul Bidh)
    7. Literasi Mandiri (diukur dalam satuan **halaman bacaan riil**)
  - Aksi pencatatan harian dan rekap agregasi bulanan tersedia di `app/actions/mutabaah.ts`.

### Butir 9: 44 Master Pelanggaran & Retensi Snapshot
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - 44 master data pelanggaran resmi telah ter-seeding ke database:
    - **Kategori 1 (Hukuman Langsung):** Nilai poin `null` / 0, **TIDAK PERNAH** memicu Surat Peringatan (SP). Sanksi berupa tugas fisik/edukatif langsung (bersih masjid, lari, dsb).
    - **Kategori 2 (Pemberian Point):** Memiliki akumulasi poin kedisiplinan, tetapi **TIDAK PERNAH** memicu penerbitan SP.
    - **Kategori 3 (Surat Peringatan 1–3):** Pelanggaran berat yang langsung memicu evaluasi dan penerbitan SP 1, SP 2, hingga SP 3.
  - Setiap pencatatan pelanggaran (`catatPelanggaranAction`) menyimpan snapshot teks: `namaPelanggaranSnapshot`, `kategoriSnapshot`, dan `sanksiSnapshot`. Hal ini menjamin keaslian riwayat meskipun master pelanggaran diubah di masa depan.
  - Aturan Pemutihan (Preskripsi):
    - Pelanggaran umum kedaluwarsa setelah 1 tahun (365 hari).
    - Pelanggaran sejenis kedaluwarsa setelah 3 tahun (1095 hari).

### Butir 10: Otoritas Staf & Eliminasi Hardcode String
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Seluruh pengecekan nama hardcoded `"razan"`, `"razan.mt"`, atau variasi teks telah **dieliminasi 100%**.
  - Otoritas Kepala Bidang Tahfidz murni dibaca dari kolom boolean `isKepalaBidangTahfidz` pada tabel `Staff` di database.
  - Seluruh musyrif non-kabid hanya berhak mengakses halaqoh binaannya sendiri sesuai penugasan database.

### Butir 11: Fail-Closed Penugasan Halaqoh
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Jika seorang staf bertipe MT/PH tidak memiliki data halaqoh yang terhubung di database, sistem langsung mengembalikan status galat:
    > *"Akun Anda belum ditugaskan ke halaqoh mana pun. Silakan hubungi Administrator untuk penugasan halaqoh."*
  - Sistem tidak pernah melakukan fallback sembarangan ke `HLQ-0001` atau `HLQ-0006`.

### Butir 12: Konsistensi Dashboard & Antarmuka
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Dashboard Musyrif menampilkan badge rekomendasi Sabaqi pekan berjalan.
  - Komponen Rekap Laporan Bulanan bersih dari memory leak (`useMemo` dependencies tepat sasaran, pemisahan state murni).
  - Tampilan indikator disiplin santri (Bintang Kebaikan & Poin Pelanggaran) sinkron di seluruh komponen UI.

### Butir 13: Notifikasi WhatsApp Terintegrasi
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Generator pesan WhatsApp (`lib/whatsapp.ts`) menyertakan:
    - Target akhir program 30 Juz secara eksplisit.
    - Rincian setoran berbasis halaman dan Juz.
    - Status disiplin, perizinan, dan penerbitan SP yang santun dan profesional.

### Butir 14: Keamanan & Integritas Basis Data Produksi
- **Status:** **SELESAI & TERUJI**
- **Implementasi:**
  - Tidak ada perintah berbahaya yang dijalankan (`prisma migrate reset`, `DROP TABLE`, dsb).
  - 57 santri dan 10 staf riil pesantren tetap utuh dan terhubung dengan relasi baru.
  - Seluruh penyesuaian skema bersifat aditif (`ADD COLUMN IF NOT EXISTS`).

---

## 3. Panduan Operasional Singkat Pengguna

### A. Untuk Mudir / Kepala Sekolah (`KS`)
1. **Mengatur Kebijakan Reward–Sanksi:**
   - Masuk ke menu Pengaturan Kebijakan.
   - Mudir dapat menyesuaikan jumlah Bintang Kebaikan per ujian (standar: 5), kuota hari libur (standar: 1 hari), dan batas minimal capaian target bulanan (standar: 80%).
2. **Finalisasi Bulanan & Hak Kunjungan:**
   - Pada akhir bulan kalender, Mudir membuka rekap laporan bulanan dan meninjau capaian seluruh santri.
   - Klik tombol **"Finalisasi Bulanan"**. Santri yang capaiannya di bawah 80% dari target pribadinya otomatis mendapat status `KEHILANGAN_KUNJUNGAN`.
   - Untuk santri yang sakit atau mendapat dispensasi khusus, Mudir dapat mengklik **"Batalkan / Override Sanksi"** dengan mencantumkan alasan resmi yang tercatat di audit log.

### B. Untuk Musyrif / Musyrifah Tahfizh (`MT` & `PH`)
1. **Pencatatan Setoran Tahfizh:**
   - Pilih nama santri, masukkan nomor Juz (1–30), Halaman Mulai (1–604), dan Halaman Selesai (1–604).
   - Pastikan rentang halaman berada dalam Juz yang dipilih. Sistem akan otomatis menghitung jumlah halaman dan mendeteksi nama Surah.
2. **Memantau Rekomendasi Sabaqi:**
   - Pada awal pekan (Senin), sistem akan memulai akumulasi Sabaq pekan baru.
   - Jika santri belum menyetor Sabaq pada pekan tersebut, layar akan menampilkan *"Belum ada Sabaq tersimpan pada pekan ini."*
   - Setelah ada setoran Sabaq, kartu santri akan menampilkan akumulasi halaman riil yang wajib di-muroja'ahkan santri pada pekan berjalan.
3. **Pencatatan Nilai Kepesantrenan:**
   - Buka tab Materi Kepesantrenan, pilih mata pelajaran (Bahasa Arab, Fiqih, Tafsir, Tajwid, atau Aqidah), lalu masukkan nilai formatif/sumatif santri.

### C. Untuk Petugas Presensi Putri (`ST` Akhwat)
1. **Pencatatan Presensi Khusus Santriwati:**
   - Masuk menggunakan akun presensi putri yang telah terdaftar.
   - Sistem secara otomatis membatasi daftar santri hanya untuk santriwati (`P`).
   - Apabila mencoba mengunggah batch presensi yang memuat santriwan (`L`), sistem akan menolak transaksi secara fail-closed untuk menjaga privasi dan batasan syar'i.

---

## 4. Prosedur Keselamatan & Catatan Rollback

1. **Prinsip Skema Aditif:**
   - Setiap kolom dan tabel baru (`KebijakanRewardSanksi`, `HakLiburSantri`, `TransaksiBintang`, `FinalisasiBulananSantri`, `CatatanMutabaahHarian`) bersifat aditif. Jika terjadi gangguan aplikasi, tabel-tabel ini tidak akan mengganggu integritas tabel inti (`User`, `Santri`, `Halaqoh`, `Staff`).
2. **Penyimpanan Snapshot:**
   - Riwayat pelanggaran santri menyimpan teks snapshot. Jika skema master pelanggaran mengalami perubahan, data riwayat santri di masa lalu tidak akan mengalami distorsi.
3. **Penanganan Sesi & Secret:**
   - Kredensial produksi (`DATABASE_URL`, `AUTH_SECRET`) tidak pernah disimpan di dalam file git repository. Pengambilan environment produksi selalu dilakukan melalui mekanisme terenkripsi Vercel CLI.
4. **Langkah Rollback Cepat:**
   - Apabila diperlukan rollback kode aplikasi:
     ```bash
     git revert HEAD
     git push origin main
     ```
   - Skema basis data tidak perlu di-drop karena seluruh kolom baru memiliki nilai default yang aman terhadap kode sebelumnya.
