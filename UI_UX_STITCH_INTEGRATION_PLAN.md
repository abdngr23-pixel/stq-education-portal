# RENCANA INTEGRASI REDESIGN UI/UX STQ DUC
## Google Stitch, Anti-Slop, Mobile-First, dan PWA (Tahap A — Audit & Perencanaan)

**Proyek:** STQ Education Portal
**Lembaga:** Sekolah Tahfidzhul Qur'an Darul Ulum Cendekia (STQ DUC)
**Pengelola:** Yayasan Infak Medika Nusantara
**Status Dokumen:** Rencana Kerja Tahap A (Audit & Arsitektur)
**Basis Komit:** `18e17610ad821f9b4a70f4ae757c5f0c0437ac38` (`test(p0): isolate tahfizh database and browser verification safely`)
**Tanggal:** 10 September 2026

---

## 1. Kondisi Awal Repositori & Verifikasi Commit

1. **Lokasi Proyek Utama**:
   `D:\stq-education-portal-antigravity\stq-education-portal`
2. **Commit Dasar (HEAD)**:
   `18e1761` (`test(p0): isolate tahfizh database and browser verification safely`) pada branch `main` (sinkron dengan `origin/main`).
3. **Validasi Struktur Direktori Wajib**:
   - `.git` ➔ **Tersedia**
   - `package.json` ➔ **Tersedia**
   - `app` ➔ **Tersedia**
   - `components` ➔ **Tersedia**
   - `prisma` ➔ **Tersedia**
   - `tests` ➔ **Tersedia**
   - `scripts` ➔ **Tersedia**
4. **Kondisi Quality Gates Baseline**:
   - `npm test`: **PASS (247 passed, 0 failed, 92 test suites)**
   - `npm run lint`: **PASS (0 error, 0 warning)**
   - `npx tsc --noEmit`: **PASS (0 galat tipe)**
   - `npm run typecheck:test`: **PASS (0 galat tipe)**
   - `npm run build`: **PASS (Kompilasi sukses)**
   - `E2E Puppeteer P0.1`: **PASS (100% 6 skenario browser & database riil lulus)**

---

## 2. Validasi Lokasi Google Stitch Reference

1. **Lokasi Referensi**:
   `D:\stq-education-portal-antigravity\stitch_stq_education_portal_redesign`
2. **Status Isi Direktori**:
   - Memiliki 1 berkas PRD komprehensif: `prd_redesign_ui_ux_stq_duc_google_stitch.md` (30 KB).
   - Memiliki 18 subdirektori berisi purwarupa HTML, gambar pratinjau (`screen.png`), dan panduan desain (`DESIGN.md`).
3. **Pemeriksaan Khusus Entri `logo_fix_1.png`**:
   - **Temuan**: Entri `logo_fix_1.png` pada folder Stitch **BUKAN merupakan berkas gambar PNG**, melainkan **sebuah direktori/folder** (`isDir: true`) yang di dalamnya memuat tangkapan layar `screen.png` (89 KB).
   - **Keputusan**: **DILARANG MENGGUNAKAN** `logo_fix_1.png` dari folder Stitch sebagai logo. Aplikasi tetap menggunakan logo resmi beresolusi tinggi yang sudah ada di proyek utama:
     - `public/logo.png` (113 KB)
     - `public/logo-duc.png` (113 KB)
     - `public/logo-yayasan.png` (482 KB)
   - Bentuk, warna, rasio, dan proporsi logo resmi STQ DUC dipertahankan 100% tanpa distorsi.
4. **Pemeriksaan Aset Foto**:
   - Subdirektori `professional_modest_portrait_photo_of_an_indonesian_islamic_educator_teacher_or` memuat gambar AI generik 1.58 MB. Berkas ini hanya diperlakukan sebagai referensi visual komposisi, **bukan aset produksi**.

---

## 3. Status Plugin Anti-Slop & Evaluasi Lingkungan CLI

1. **Pemeriksaan Perintah CLI `agy`**:
   - Pemeriksaan melalui PowerShell `Get-Command agy` dan `where.exe agy` menghasilkan status **Command Not Found** (CLI `agy` belum terpasang di PATH lingkungan sistem Windows saat ini).
2. **Kepatuhan Terhadap Larangan Instruksi**:
   - Sesuai instruksi tegas pengguna: *"Jika perintah agy tidak tersedia, jangan mengarang perintah alternatif. Laporkan kendalanya dan minta persetujuan sebelum memakai metode instalasi lain."*
   - Kami **TIDAK menjalankan skrip instalasi alternatif tanpa izin**.
3. **Penerapan Anti-Slop Manual (Mode DURING)**:
   - Seluruh prinsip anti-slop yang mencakup:
     - `antislop` (eliminasi dekorasi palsu & fungsi mubazir)
     - `antislop-ui` (eliminasi card bertumpuk, shadow berlapis-lapis, dan gradient berlebihan)
     - `antislop-copywriting` (penghapusan frasa promosi AI seperti *"Fitur Pintar Otomatis"*, *"Sistem Canggih"*)
     - `antislop-layoutmobile` (target sentuh 44x44px, safe area, form 1 kolom, zero horizontal scroll)
     - `antislop-code` (komponen terfokus, tanpa class Tailwind berulang raksasa, tanpa merusak testid P0.1)
   diterapkan secara ketat dan melekat langsung sebagai acuan arsitektur dalam rencana ini.

---

## 4. Inventarisasi Lengkap Hasil Google Stitch

Berikut adalah inventarisasi detail dari 18 subdirektori dan aset pada `STITCH_REFERENCE_ROOT`:

| No | Nama Folder / Subdirektori | Jenis Layar & Target Viewport | Berkas yang Ditemukan | Komponen Visual yang Terlihat | Pola Navigasi | Kelebihan | Kelemahan & Unsur AI Slop | Keputusan |
|:---:|---|---|---|---|---|---|---|:---:|
| 1 | `beranda_mudir_stq_duc` | Beranda Mudir (Desktop 1200px) | `code.html`, `screen.png` | Stat ringkas (3 card), daftar antrean persetujuan, agenda hari ini | Sidebar kiri standar dengan grouped menu | Tenang, terfokus, hierarki jelas, warna hijau-emas proporsional | Sedikit kaku pada divider section | **Gunakan (Sebagai Fondasi Beranda Mudir)** |
| 2 | `beranda_mudir_brand_claymorphism_stq_duc` | Beranda Mudir (Desktop 1360px) | `code.html`, `screen.png` | Card dengan shadow lembut, ambient blur background, rounded besar | Floating sidebar rounded, pill tabs | Tampilan visual menarik saat pertama dilihat | Ambient blur ball di latar belakang, radius berlebihan (`rounded-[36px]`) | **Sederhanakan (Hilangkan ambient blur & radius ekstrem)** |
| 3 | `beranda_mudir_claymorphism_stq_duc` | Beranda Mudir (Desktop 1360px) | `code.html`, `screen.png` | Card claymorphism tebal, pill badges | Floating sidebar | Efek kedalaman visual | Bayangan 3 lapis membebani GPU rendering; terasa seperti template Dribbble | **Tolak Varian Ini** |
| 4 | `beranda_mudir_neumorphic_stq_duc` | Beranda Mudir (Desktop 1200px) | `code.html`, `screen.png` | Bevel emboss/deboss, tombol timbul | Sidebar timbul abu-abu | Eksplorasi tekstur | Kontras rendah, melanggar WCAG AA, tampak kusam dan kuno | **Tolak Total (Neumorphic dilarang)** |
| 5 | `beranda_musyrif_tahfizh_stq_duc` | Beranda Musyrif (Desktop 1200px) | `code.html`, `screen.png` | 3 Kartu metrik utama, tombol "+ Catat Setoran" primer tunggal, tabel santri belum setor | Sidebar grouped menu, header dengan waktu WITA | **Sangat tenang, aksi utama sangat dominan, daftar santri bersih tanpa nested card** | Tidak ada | **Gunakan (Fondasi Utama Beranda Musyrif)** |
| 6 | `beranda_musyrif_tahfizh_brand_claymorphism_stq_duc` | Beranda Musyrif (Desktop 1360px) | `code.html`, `screen.png` | Card tebal 24px padding, shadow inset | Floating rounded sidebar | Card antrean santri cukup informatif | Bayangan berlebihan, efek mengambang terlalu tebal | **Sederhanakan (Ambil struktur list santri)** |
| 7 | `beranda_musyrif_tahfizh_claymorphism_stq_duc` | Beranda Musyrif (Desktop 1360px) | `code.html`, `screen.png` | Clay button, card timbul | Floating sidebar | Menarik secara estetika kartu | Tidak cocok untuk lingkungan kerja pesantren sehari-hari | **Tolak Varian Ini** |
| 8 | `catat_setoran_tahfizh_brand_claymorphism_stq_duc` | Form Catat Setoran (Desktop 1360px) | `code.html`, `screen.png` | Stepper 4 langkah, grid 2 kolom (form di kiri, rekap di kanan) | Pill tabs navigasi Tahfizh | Pembagian field setoran | Stepper multi-langkah memperlambat pencatatan harian musyrif di halaqoh | **Sederhanakan (Tolak stepper; tetapkan formulir single-page terfokus)** |
| 9 | `catat_setoran_tahfizh_claymorphism_stq_duc` | Form Catat Setoran (Desktop 1360px) | `code.html`, `screen.png` | Form setoran dengan tombol timbul tebal | Pill navigation | Pemisahan field cukup jelas | Mengaburkan batas input karena kontras bayangan | **Tolak Varian Ini** |
| 10 | `catat_setoran_tahfizh_neumorphic_stq_duc` | Form Catat Setoran (Desktop 1200px) | `code.html`, `screen.png` | Input cekung abu-abu | Sidebar abu-abu | Eksplorasi layout | Kontras sangat buruk, tombol terlihat membingungkan | **Tolak Total** |
| 11 | `daftar_santri_stq_duc` | Daftar Santri (Desktop 1200px) | `code.html`, `screen.png` | 3 vital indicator, search bar, dropdown halaqoh & status, drawer filter lanjutan | Sidebar grouped, header institusi | **Penerapan progressive disclosure filter sangat bagus, tabel maksimal 5 kolom** | Data dummy 124 santri (wajib diganti data riil 57 santri STQ DUC) | **Gunakan (Sebagai Acuan Modul Santri)** |
| 12 | `presensi_santri_mobile_stq_duc` | Presensi Kelompok (Mobile 390px) | `code.html`, `screen.png` | Selector halaqoh, search bar, segmented control 5 status (Hadir, Masbuk, Izin, Sakit, Alfa) | Back button, sticky bottom action bar | **Desain mobile sangat matang, touch-target 44px, segmented control cepat, tanpa horizontal scroll** | Tidak ada | **Gunakan (Fondasi Utama Presensi Mobile)** |
| 13 | `digital_clay` | Token Desain Global | `DESIGN.md` | Palet warna ungu/violet (`#630ed4`), tipografi Nunito Sans | - | Dokumentasi token rapi | Warna ungu mendominasi, tidak sesuai identitas pesantren STQ DUC | **Tolak (Warna tidak sesuai)** |
| 14 | `soft_sculpted_minimal` | Token Desain Global | `DESIGN.md` | Palet warna biru/indigo (`#4d41df`), shadow neumorphic | - | Skala tipografi terstruktur | Warna primer melenceng dari hijau STQ DUC | **Tolak (Warna tidak sesuai)** |
| 15 | `stq_darul_ulum_cendekia_portal` | Token Desain Global Resmi | `DESIGN.md` | Palet hijau zamrud (`#00612a` / `#0e7c3a`), emas (`#7b5800`), Plus Jakarta Sans | - | **100% selaras dengan identitas STQ DUC, kontras WCAG AA, tipografi tenang** | Nilai shadow container-high perlu diperhalus | **Gunakan (Fondasi Design System Aplikasi)** |
| 16 | `logo_fix_1.png` | Folder Tangkapan Layar | `screen.png` | Screenshot kartu logo | - | Pratinjau visual | Folder berpura-pura menjadi file PNG | **Tolak (Gunakan public/logo.png asli)** |
| 17 | `logo_stq_duc` | Mockup Logo Vector | `code.html`, `screen.png` | Logo mockup inline | - | Format vector referensi | Logo utama sudah ada di aplikasi | **Tolak (Pertahankan logo asli)** |
| 18 | `professional_modest_portrait...` | Aset Gambar Profil | `screen.png` | Foto potret ustadz (AI generated) | - | Contoh avatar | File 1.58 MB terlalu berat, hanya untuk referensi | **Referensi Visual Saja** |

---

## 5. Audit Kepadatan UI Aplikasi Saat Ini (Masalah As-Is)

Berdasarkan audit mendalam pada berkas-berkas antarmuka aktif (`components/modules/*`, `components/dashboard/*`, dan `app/page.tsx`):

### 5.1 Kepadatan Visual & Card Bertumpuk (Nested Cards)
1. **Modul Tahfizh (`components/modules/tahfizh-module.tsx`, 109 KB)**:
   - Dalam satu layar saat ini ditampilkan:
     - 4 tab jenis setoran (SABAQ, SABQI, MANZIL, MUFAR).
     - Banner fitur pintar Al-Pakistani lengkap dengan penjelasan panjang.
     - 4 kartu konversi otomatis bertumpuk di dalam card container gradien hijau.
     - Pilihan cepat 6 tombol (+0.5, +1, +2, +3, +5, +7 Hlm).
     - Formulir input mulai, jumlah, selesai, nilai, catatan.
     - Form Sabaqi manual beserta checkbox dan alasan.
     - Tabel riwayat 10 setoran terakhir di samping/bawah form.
     - Peringatan melintasi batas juz dan banner khatam.
   - **Beban Pengguna**: Musyrif harus memindai terlalu banyak elemen visual padat saat hanya ingin mencatat 1 setoran sabaq rutin santri.
2. **Beranda Modul (`components/modules/beranda-module.tsx`)**:
   - Menampilkan greeting, statistik santri, ringkasan izin, ringkasan ikhtibar, santri sakit, kalender mini, dan kotak saran dalam satu dashboard panjang.

### 5.2 Kepadatan Navigasi (Sidebar Raksasa)
1. **Sidebar Desktop (`components/navigation/app-sidebar.tsx`)**:
   - Menampilkan daftar flat hingga 16 item menu sekaligus tanpa pengelompokan yang ringkas.
   - Akun dengan banyak hak akses (misal Admin/Mudir) mengalami kelelahan visual (choice fatigue) karena menu berjejer dari atas ke bawah.
2. **Ketiadaan Mobile Shell Khusus**:
   - Di perangkat seluler, sidebar hanya disembunyikan/dimunculkan melalui tombol hamburger standar, belum ada bottom navigation bar untuk akses jempol yang ergonomis.

### 5.3 Copywriting Berbau AI Slop
1. Pada `tahfizh-module.tsx`:
   - *"Fitur Pintar Otomatis Konversi Hafalan (Standar Mushaf Madinah: 1 Juz = 20 Halaman)"* ➔ Terlalu panjang dan bernada promosi.
   - *"Otomatis Menjadi 21 Juz 4 Halaman"* ➔ Seharusnya cukup label netral: *"Total: 21 juz 4 halaman"*.
   - *"Pencatatan setoran Al-Qur'an terpadu dengan kalkulasi otomatis..."* ➔ Redundan, pengguna sudah tahu ini modul Tahfizh.
2. Pada `master-data-santri.tsx`:
   - Penjelasan teknis mengenai sinkronisasi spreadsheet dan query database tampil di layar operasional staf.

---

## 6. Pemetaan Layar Stitch ke Modul Aplikasi STQ

| Modul Aplikasi Saat Ini | Komponen Saat Ini | Layar Stitch Terkait | Peran Pengguna | Aksi Utama (Primary Action) | Rencana Desktop | Rencana Mobile |
|---|---|---|---|---|---|---|
| **Beranda Mudir** | `dashboard-mudir-ks.tsx`, `beranda-module.tsx` | `beranda_mudir_stq_duc` | KS (Mudir) | Tinjau persetujuan yang menunggu | Maksimal 3 kartu ringkasan, antrean persetujuan prioritas, agenda terdekat | Tampilan vertikal, tombol aksi persetujuan cepat (Setujui/Tolak) |
| **Beranda Musyrif Tahfizh** | `dashboard-musyrif-tahfizh.tsx` | `beranda_musyrif_tahfizh_stq_duc` | MT (Musyrif Tahfizh) | **+ Catat Setoran** | 3 metrik (Halaqoh, Setoran Hari Ini, Ujian Siap), list santri belum setor | Ringkas 2 kartu metrik, sticky button catat setoran, tap santri langsung isi |
| **Catat Setoran Tahfizh** | `tahfizh-module.tsx` | `catat_setoran_tahfizh_brand_claymorphism_stq_duc` (disederhanakan) | MT, PH | **Simpan Setoran** | Form Catat Setoran adalah single-page focused form tanpa wizard dan tanpa visual stepper | Form 1 kolom terfokus, touch-target 44px, sticky simpan di bawah |
| **Riwayat Setoran** | `tahfizh-module.tsx` (bagian bawah) | Disatukan dari landing Tahfizh Stitch | MT, PH, KS | Filter & cari setoran | Dipindahkan ke tab terpisah "Riwayat Setoran", tabel ringkas 5 kolom | List row dengan badge tanggal & status, tap untuk detail |
| **Ujian Hafalan / Tasmi'** | `tahfizh-module.tsx` (sub-tab) | Tab Ujian Hafalan Stitch | MT, KS | Nilai ujian hafalan | Antrean santri siap tasmi'/ikhtibar terpisah dari form setoran harian | Card ringkas nama santri & juz yang diuji, modal input nilai |
| **Data Santri** | `master-data-santri.tsx`, `santri-module.tsx` | `daftar_santri_stq_duc` | ADM, KS, MT, GA | Cari & buka profil santri | 3 kartu ringkasan santri, search bar, dropdown filter halaqoh, tabel 5 kolom | List row (Avatar, Nama, NIS, Halaqoh, Status), tap untuk buka profil |
| **Presensi Santri** | `presensi-module.tsx`, `presensi-harian-mobile.tsx` | `presensi_santri_mobile_stq_duc` | MK, MT, Mudhabbir | **Simpan Presensi Sesi** | Desktop table presensi dengan filter sesi/tanggal | **Mobile First: Segmented control Hadir/Masbuk/Izin/Sakit/Alfa, safe area, sticky simpan** |
| **Mutaba'ah Harian** | `mutabaah-harian-tab.tsx` | Spesifikasi Bab 10.6 PRD Stitch | MK, Pembina Asrama | Simpan mutaba'ah kategori | Pilihan kategori di atas (Hadits, Mufrodat, Sholat, Literasi), bukan 7 tabel bersamaan | Satu kategori per tampilan, input cepat checklist / angka halaman literasi |
| **Kepesantrenan** | Sub-modul di `akademik-module.tsx` | Spesifikasi Bab 10.7 PRD Stitch | Mudir, Musyrif/Musyrifah | Input nilai kepesantrenan | Form pilih materi ➔ halaqoh ➔ input nilai kelompok | Form 1 kolom, fokus satu materi |
| **Akademik Sekolah** | `akademik-module.tsx` | Spesifikasi Bab 10.8 PRD Stitch | GA (Guru Akademik) | Input nilai mapel | Form pilih mapel ➔ kelas ➔ input nilai santri | Input nilai dengan navigasi baris mudah |
| **Kedisiplinan** | `kedisiplinan-module.tsx` | Spesifikasi Bab 10.9 PRD Stitch | MK, Mudir | Catat pelanggaran / SP | Searchable select dari 44 master pelanggaran, timeline pelanggaran | Form pencatatan cepat 1 kolom, list riwayat terpisah |
| **Perizinan** | `perizinan-module.tsx` | Spesifikasi Bab 10.10 PRD Stitch | MK, KS, Wali | Pengesahan izin santri | Antrean perizinan berupa task list prioritas, tombol Setujui/Tolak jelas | Card list perizinan dengan tombol aksi langsung |
| **Kesehatan** | `kesehatan-module.tsx` | Spesifikasi Bab 10.11 PRD Stitch | Petugas Medis, MK | Catat riwayat sakit | List santri dalam perawatan, tombol catat pemeriksaan terpisah | Card santri sakit, form input keluhan & tindakan |
| **Orang Tua Asuh** | `sponsor-module.tsx` | Spesifikasi Bab 10.12 PRD Stitch | Yayasan, Admin | Siapkan laporan bulanan | Daftar santri terhubung OTA, status pengiriman laporan | List santri & status OTA |
| **Laporan Bulanan** | `rekap-laporan-bulanan.tsx` | Spesifikasi Bab 10.13 PRD Stitch | KS, MT, Yayasan | **Finalisasi Laporan** | Halaman review kelengkapan data sebelum finalisasi, tanpa tabel campur aduk | Ringkasan pencapaian per halaqoh |
| **Operasional & Sistem** | `logistik-module.tsx`, `anggaran-module.tsx`, `surat-module.tsx`, `kalender-module.tsx`, `users-module.tsx`, `audit-module.tsx` | Spesifikasi Bab 10.14 & 10.15 | ADM, KS | Operasional umum | Mengikuti design system baru: Header bersih, search, tabel 5 kolom, drawer detail | Form dan list yang responsif |

---

## 7. Varian Desain Terpilih & Alasan Pemilihan

### 7.1 Varian Terpilih: **STQ Clean Institutional Minimalist**
Menggabungkan fondasi token warna dan tipografi resmi dari `stq_darul_ulum_cendekia_portal/DESIGN.md` dengan tata letak fungsional tenang dari `beranda_musyrif_tahfizh_stq_duc` dan `daftar_santri_stq_duc`, serta mengadopsi struktur alur `catat_setoran_tahfizh_brand_claymorphism_stq_duc` yang disederhanakan secara radikal.

### 7.2 Alasan Pemilihan
1. **Kesesuaian Nilai & Identitas Lembaga**:
   - Mempertahankan warna hijau zamrud resmi (`#0E7C3A`) dan emas institusi (`#7B5800`), bukan ungu atau biru generik.
   - Menciptakan suasana tenang, bersih, teduh, dan berwibawa khas pesantren Al-Qur'an.
2. **Keterbacaan & Kontras Maksimal (WCAG AA)**:
   - Menghilangkan bayangan kusam abu-abu gelap (neumorphism) yang membuat mata lelah.
   - Menggunakan kontras teks `#151E19` di atas latar belakang bersih `#F2FCF3` / `#FFFFFF`.
3. **Kinerja Rendering Ringan**:
   - Menghindari filter `blur-3xl` berukuran 40rem di latar belakang yang memicu frame-drop pada browser ponsel musyrif di lapangan.
   - Menggunakan bayangan 1 lapis tipis (`shadow-xs` / `shadow-sm`) yang ramah baterai dan performa.

### 7.3 Unsur Stitch yang Digunakan vs Ditolak Tegas (Anti-Slop)

| Unsur Desain | Status | Rincian Alasan |
|---|:---:|---|
| **Struktur Stepper Catat Setoran** | **DITOLAK** | Ditolak demi kelancaran & kecepatan pencatatan harian musyrif: Form Catat Setoran adalah single-page focused form tanpa wizard dan tanpa visual stepper. |
| **Segmented Control Presensi Mobile** | **DIGUNAKAN** | Sangat cepat untuk jempol di ponsel; 5 opsi status sejajar dengan target sentuh 44px. |
| **Grouped Sidebar Navigation** | **DIGUNAKAN** | Merapikan 16 modul menjadi 5–7 kelompok menu yang ringkas. |
| **Drawer Filter Lanjutan (Progressive Disclosure)** | **DIGUNAKAN** | Menyembunyikan filter kompleks dari layar utama; hanya muncul jika dipanggil pengguna. |
| **Receipt Ringkas Pasca-Simpan** | **DIGUNAKAN** | Memberikan kepastian feedback data tersimpan tanpa membuka WhatsApp otomatis. |
| **Glow Ambient Blur Bola-Bola Besar** | **DITOLAK** | Unsur dekoratif AI slop yang tidak memiliki nilai fungsional dan memberatkan GPU ponsel. |
| **Neumorphic Inset / Outset Bevel** | **DITOLAK** | Kontras sangat rendah, membingungkan pengguna nonteknis, tampak kotor dan usang. |
| **Claymorphism Ekstrem (3-Layer Shadows)** | **DITOLAK** | Menjadikan UI tampak seperti mainan plastik; diganti dengan subtle card border 1px yang elegan. |
| **Palet Warna Ungu / Violet (Digital Clay)** | **DITOLAK** | Menyimpang dari identitas resmi STQ Darul Ulum Cendekia. |
| **Teks Promosi Bombastis** | **DITOLAK** | Seluruh frasa *"Fitur Pintar Otomatis"*, *"Sistem Mutakhir"* dihapus dan diganti label manusiawi. |
| **Card di dalam Card (Nested Cards)** | **DITOLAK** | Dilarang membungkus section di dalam card bertingkat-tingkat. Gunakan pembagi (divider) atau spasi. |

---

## 8. Design Tokens yang Direncanakan

### 8.1 Palet Warna (Tailwind & CSS Tokens)
```css
:root {
  /* Brand Primary: Hijau Institusi */
  --color-primary: #0E7C3A;
  --color-primary-hover: #0B642E;
  --color-primary-light: #EFF8F2;
  --color-primary-container: #E6F0E8;

  /* Brand Secondary: Emas Prestasi */
  --color-gold: #B8860B;
  --color-gold-hover: #9E7309;
  --color-gold-light: #FFF8E6;

  /* Netral / Surface */
  --color-bg-app: #F7F9F7;
  --color-surface-card: #FFFFFF;
  --color-border: #DDE3DF;
  --color-border-subtle: #EBEFECE6;

  /* Tipografi Netral */
  --color-text-title: #151E19;
  --color-text-body: #3F4A44;
  --color-text-muted: #68736D;

  /* State Semantik */
  --color-error: #C9362B;
  --color-error-bg: #FDF2F2;
  --color-warning: #A86408;
  --color-warning-bg: #FEF7EC;
  --color-info: #2563A6;
  --color-info-bg: #EFF6FC;
}
```

### 8.2 Skala Tipografi (Plus Jakarta Sans)
- **H1 (Judul Halaman)**: Desktop `30px` (line-height `38px`, font-weight `700`); Mobile `24px` (`32px`).
- **H2 (Judul Seksi)**: `20px`–`22px` (`28px`, font-weight `600`).
- **H3 (Sub-seksi/Modal)**: `18px` (`24px`, font-weight `600`).
- **Body Regular (Teks Isi)**: `14px`–`16px` (`22px`–`24px`, font-weight `400`).
- **Body Mobile Input**: Minimal `16px` untuk mencegah zoom otomatis yang mengganggu pada browser iOS Safari.
- **Caption / Keterangan**: Minimal `12px` (`16px`, font-weight `500`). **Dilarang memakai ukuran teks di bawah 12px untuk informasi operasional.**

### 8.3 Spacing & Radius
- **Grid Acuan**: Kelipatan 4px / 8px (`space-8`: 8px, `space-12`: 12px, `space-16`: 16px, `space-24`: 24px, `space-32`: 32px).
- **Radius Kontrol (Button, Input, Select)**: `10px`–`12px` (`rounded-xl`).
- **Radius Kontainer (Card, Sheet, Modal)**: `14px`–`16px` (`rounded-2xl`).
- **Bayangan (Elevation)**: Maksimal 1 lapis tipis: `box-shadow: 0 1px 3px rgba(21, 30, 25, 0.06), 0 1px 2px rgba(21, 30, 25, 0.04)`.

---

## 9. Arsitektur Navigasi Desktop dan Mobile

### 9.1 Desktop Navigation (Grouped Sidebar)
- **Lebar**: `256px` saat dibuka, `72px` saat diringkas (`collapsed`).
- **Header**: Logo resmi STQ DUC + Nama lembaga.
- **Kelompok Menu (Maksimal 7 Kelompok, Collapsible & Role-Aware)**:
  1. **Beranda**: Dashboard kerja hari ini (tampil berbeda per role).
  2. **Santri**: Data Santri, Profil Santri, Manajemen Halaqoh.
  3. **Pembelajaran**: Tahfizh, Kepesantrenan, Akademik Sekolah, Mutaba'ah Harian.
  4. **Kesantrian**: Presensi Harian, Perizinan Santri, Kedisiplinan & SP, Kesehatan.
  5. **Operasional**: Logistik, Anggaran, Surat Resmi, Kalender Agenda.
  6. **Beasiswa**: Orang Tua Asuh, Laporan Bulanan Beasiswa.
  7. **Sistem**: Manajemen Pengguna, Audit Log Aktivitas.
- **Role Scoping Strict**: Musyrif Tahfizh hanya melihat menu yang relevan (Beranda, Santri, Tahfizh, Presensi); menu administratif disembunyikan.

### 9.2 Mobile Navigation (Bottom Bar + Menu Drawer)
- **Header Mobile**: Tinggi 56px, logo STQ, judul pekerjaan aktif, avatar profil.
- **Bottom Navigation Bar (Maksimal 4 Shortcut Utama Berdasarkan Peran)**:
  - **Untuk Musyrif Tahfizh (MT)**:
    1. `Beranda` (Dashboard tugas hari ini)
    2. `Setoran` (Shortcut langsung ke form Catat Setoran)
    3. `Santri` (Daftar santri halaqohnya)
    4. `Menu` (Membuka bottom sheet/drawer untuk modul lain)
  - **Untuk Musyrif Kesantrian (MK / Pembina Asrama)**:
    1. `Beranda`
    2. `Presensi` (Shortcut cepat presensi sesi)
    3. `Izin & SP`
    4. `Menu`
  - **Untuk Mudir (KS)**:
    1. `Beranda`
    2. `Persetujuan` (Izin, SP, Ujian)
    3. `Laporan`
    4. `Menu`
- **Aturan Interaksi Jempol**:
  - Touch-target minimal `44 × 44 px`.
  - Margin horizontal `16 px` pada sisi layar.
  - Safe-area insets (`env(safe-area-inset-bottom)`) diterapkan penuh.
  - Tidak ada scroll horizontal (overflow-x: hidden di level halaman).

---

## 10. Rencana PWA yang Dapat Dipasang (Installable PWA)

### 10.1 Web App Manifest (`public/manifest.webmanifest`)
- `name`: **STQ Darul Ulum Cendekia**
- `short_name`: **STQ DUC**
- `start_url`: `/`
- `display`: `standalone`
- `background_color`: `#F7F9F7`
- `theme_color`: `#0E7C3A`
- `orientation`: `any`
- `icons`:
  - `icon-192.png` (192 × 192 px, format PNG resmi)
  - `icon-512.png` (512 × 512 px, format PNG resmi)
  - `maskable-512.png` (512 × 512 px dengan safe-zone lingkar)
  - `apple-touch-icon.png` (180 × 180 px untuk iOS Safari)

### 10.2 Service Worker & Kebijakan Cache Terkendali
- **Aset yang Boleh Masuk Cache (Cache-First / Stale-While-Revalidate)**:
  - Berkas build statis JS & CSS Next.js (`/_next/static/*`).
  - Web fonts (`Plus Jakarta Sans` dari Google Fonts / lokal).
  - Aset logo publik dan favicon (`/logo.png`, `/favicon.ico`).
  - Halaman fallback statis offline (`/offline.html`).
- **ATURAN KEAMANAN DATA MUTLAK (DILARANG KERAS MASUK CACHE)**:
  - ❌ Sesi login dan cookie autentikasi JWT.
  - ❌ Seluruh Server Actions Next.js.
  - ❌ Endpoint API privat (`/api/v1/*`).
  - ❌ Data setoran tahfizh, mutaba'ah, presensi, rapor, dan identitas santri.
  - ❌ Catatan medis kesehatan dan pelanggaran kedisiplinan.
  - ❌ Informasi kontak donatur orang tua asuh.

### 10.3 Perilaku Kondisi Offline yang Jujur
- Ketika koneksi internet terputus:
  - Aplikasi mendeteksi event `navigator.onLine === false`.
  - Menampilkan banner status informatif warna netral/amber di bagian atas: *"Anda sedang offline. Koneksi internet diperlukan untuk mencatat dan menyinkronkan data setoran/presensi."*
  - Tombol simpan dinonaktifkan sementara secara transparan.
  - **Dilarang membuat antrean offline palsu (fake optimistic sync)** yang berisiko menyebabkan data hilang atau konflik konkurensi di kemudian hari.

---

## 11. Pemetaan Komponen Lama ke Komponen Baru

| Berkas Komponen Saat Ini | Masalah Struktur Saat Ini | Komponen Baru / Refactor Plan | Tanggung Jawab Komponen Baru |
|---|---|---|---|
| `components/modules/tahfizh-module.tsx` (109 KB) | Raksasa, monolitik, mencampur kalkulasi dan teks berulang | `tahfizh-module.tsx` (Single-Page Form Refactor) | Form Catat Setoran adalah single-page focused form tanpa wizard dan tanpa visual stepper; ringkasan 5 data riil disederhanakan anti-slop, mempertahankan seluruh logika P0.1 & `data-testid` |
| `components/dashboard/dashboard-musyrif-tahfizh.tsx` (21 KB) | Metrik terlalu banyak baris, card bertumpuk | `dashboard-musyrif-tahfizh.tsx` (Redesign) | Menampilkan tepat 3 ringkasan vital, tombol utama `+ Catat Setoran`, dan daftar santri belum setor |
| `components/dashboard/dashboard-mudir-ks.tsx` (12 KB) | Terlalu banyak statistik global | `dashboard-mudir-ks.tsx` (Redesign) | Menampilkan antrean persetujuan yang menunggu, agenda terdekat, dan link ke laporan |
| `components/dashboard/presensi-harian-mobile.tsx` (37 KB) | Tampilan form panjang | `presensi-harian-mobile.tsx` (Refactor) | Mengadopsi segmented button 5 status dari Stitch, sticky bottom save bar |
| `components/dashboard/master-data-santri.tsx` (45 KB) | Tabel terlalu lebar dengan 10+ kolom | `master-data-santri.tsx` (Refactor) | Tabel desktop 5 kolom inti + drawer detail santri; mobile list row |
| `components/navigation/app-sidebar.tsx` (7 KB) | Flat list 16 item | `app-sidebar.tsx` (Grouped Sidebar) | 7 kelompok collapsible menu, role-based visibility, status aktif yang tenang |
| `components/ui/*` (Button, Input, Badge, Dialog) | Ad-hoc class styles | Standardized Base UI Atoms | Menggunakan token desain baru yang konsisten, fokus pada aksesibilitas |

---

## 12. Fitur dan Logika Bisnis yang Wajib Dipertahankan

Seluruh fondasi operasional dan keamanan yang sudah berjalan wajib dipertahankan tanpa perubahan:
1. **Aturan Konkurensi & Transaksi P0.1**:
   - `saveSetoranTahfizhCore` dengan transaksi atomik `Serializable`.
   - Idempotensi request dengan `clientRequestId` dan penanganan `P2002`.
   - Retry loop (3x) pada konkurensi data santri.
2. **Kapasitas Halaman Maksimal 1.0**:
   - Validasi alokasi setengah halaman (0.5 + 0.5 = 1.0).
   - Penolakan setoran ketiga yang melebihi kapasitas 1.0.
3. **Proteksi Batas Antarjuz**:
   - Validasi batas juz (Mushaf Madinah 20 hlm/juz).
   - Tombol cepat dinonaktifkan jika melintasi akhir juz.
4. **Kondisi Khatam 30 Juz**:
   - Banner resmi halaman 604 selesai.
   - Form setoran dinonaktifkan; tidak ada rekomendasi Halaman 605.
5. **Validasi Sabaqi Tanpa Fallback**:
   - Merujuk murni pada sabaq sah pekan berjalan (sejak Senin WITA).
   - Wajib konfirmasi alasan manual jika santri belum setor sabaq pekan ini.
6. **Data Ownership & Otorisasi ABAC**:
   - Musyrif hanya mencatat santri di halaqoh binaannya (fail-closed).
   - Petugas Presensi Putri hanya mengakses data santriwati.
7. **Pemberitahuan WhatsApp Tetap Bersih**:
   - Setoran harian sukses **TIDAK membuka dialog WhatsApp**.
8. **Preservasi Selector Pengujian**:
   - Seluruh `data-testid` yang dipakai oleh test runner (`input-halaman-mulai`, `input-jumlah-halaman`, `input-halaman-selesai`, `btn-simpan-setoran`, `recent-setoran-item`, `btn-quick-add-*`, `btn-jenis-*`, `textarea-jump-alasan`, `btn-confirm-jump`, `authenticated-app`, `current-user`, `nav-*`) **WAJIB TETAP ADA**.

---

## 13. Analisis Risiko Regresi & Strategi Mitigasi

| Risiko Potensial | Dampak | Tingkat Risiko | Strategi Mitigasi |
|---|---|:---:|---|
| **Kehilangan `data-testid` saat refactoring komponen** | E2E Puppeteer gagal dijalankan | **Tinggi** | Seluruh atribut `data-testid` dipetakan ke dalam checklist sebelum menyentuh kode TSX. |
| **Gangguan pada alur submit formulir Tahfizh** | Setoran gagal tersimpan di PostgreSQL | **Kritis** | Kontrak Server Action `createSetoranAction` tidak diubah sama sekali; props submit form dipetakan 1-to-1. |
| **Kompilasi CSS/Tailwind rusak pada Next.js 16 (Turbopack)** | Tampilan aplikasi berantakan | **Sedang** | Menggunakan utilitas kelas Tailwind CSS standar yang kompatibel dengan Tailwind v4; verifikasi via `npm run build`. |
| **Perubahan layout merusak tampilan tablet/mobile** | Horizontal scroll atau tombol terpotong keyboard | **Tinggi** | Pengujian browser Puppeteer pada 6 breakpoint viewport resmi (360px hingga 1440px). |
| **Regresi hak akses (ABAC leaking)** | Data santri halaqoh lain terlihat | **Kritis** | Menjalankan suite pengujian keamanan `tests/security-audit-batch1.test.ts` dan `batch2.test.ts`. |

---

## 14. Tahapan Implementasi Terstruktur (Roadmap Tahap B)

> **Catatan Penting**: Tahap B hanya akan dimulai setelah Tahap A (dokumen rencana ini) disetujui secara eksplisit oleh pengguna.

### Sub-Tahap B1: Fondasi Desain & App Shell
1. Mendefinisikan variabel CSS dan token desain pada `app/globals.css`.
2. Menyempurnakan komponen atomik: `Button`, `Input`, `Badge`, `Card`, `Dialog`, `EmptyState`.
3. Mengembangkan `AppSidebar` baru dengan navigasi berkelompok (grouped navigation).
4. Membuat `MobileAppShell` dengan header ringkas dan Bottom Navigation Bar berbasis peran.

### Sub-Tahap B2: Halaman Percontohan (Pilot Page)
1. Mengimplementasikan **Beranda Musyrif Tahfizh** (`dashboard-musyrif-tahfizh.tsx`) sesuai varian terpilih (3 metrik + aksi utama tunggal).
2. Mengimplementasikan **Form Catat Setoran Tahfizh** (`tahfizh-module.tsx`) sebagai single-page focused form tanpa wizard dan tanpa visual stepper.
3. Menjelaskan bahwa Vercel membuat preview deployment otomatis pada branch review, tetapi tidak ada production deployment.
4. Berhenti sejenak untuk evaluasi sebelum melanjutkan ke modul lain.

### Sub-Tahap B3: Modul Operasional Lainnya
1. **Beranda Mudir** (`dashboard-mudir-ks.tsx`).
2. **Daftar & Profil Santri** (`master-data-santri.tsx`).
3. **Presensi Santri Mobile** (`presensi-harian-mobile.tsx`).
4. **Mutaba'ah Harian & Literasi** (`mutabaah-harian-tab.tsx`).
5. **Kepesantrenan & Akademik** (`akademik-module.tsx`).
6. **Kedisiplinan, Perizinan, Kesehatan, dan Beasiswa**.

### Sub-Tahap B4: Finalisasi PWA & Audit Cache
1. Menyempurnakan `manifest.webmanifest` dengan ikon resmi multi-resolusi.
2. Mengonfigurasi Service Worker aman (hanya aset statis publik).
3. Mengimplementasikan banner offline yang jujur dan prompt instalasi PWA.
4. Menjalankan audit PWA dan validasi isolasi cache data sensitif.

---

## 15. Kriteria Penerimaan (Acceptance Criteria)

Pekerjaan redesign dinyatakan berhasil dan tuntas apabila:
1. Seluruh 247 pengujian unit dan integrasi (`npm test`) tetap lulus 100%.
2. Linter (`npm run lint`), typecheck (`npx tsc --noEmit` & `npm run typecheck:test`), dan build (`npm run build`) lulus dengan exit code 0.
3. Seluruh 6 skenario E2E Puppeteer P0.1 tetap lulus 100% terhadap database PostgreSQL riil.
4. Tampilan antarmuka terasa tenang, bersih, tidak padat tulisan, dan bebas dari card bersarang (nested card).
5. Pada desktop, sidebar terorganisasi rapi dalam kelompok menu; pada ponsel, tersedia bottom navigation bar 4-item yang ergonomis.
6. Tidak ada horizontal overflow pada viewport mobile (360px, 390px, 412px).
7. Tombol utama (Primary Action) mudah ditemukan dalam waktu kurang dari 5 detik.
8. Setoran tahfizh harian tidak pernah membuka dialog pesan WhatsApp otomatis.
9. Aplikasi dapat dipasang (installable) sebagai PWA pada perangkat yang mendukung.
10. Tidak ada data operasional, nilai, atau sesi login yang tersimpan di cache Service Worker.

---

## 16. Daftar Keputusan yang Memerlukan Persetujuan Pengguna

Sebelum memulai pengerjaan kode pada Tahap B, mohon konfirmasi dan persetujuan atas butir-butir berikut:
1. **Persetujuan Varian Desain**:
   - Apakah Anda menyetujui varian **STQ Clean Institutional Minimalist** (berbasis hijau zamrud `#0E7C3A`, emas `#7B5800`, latar hangat `#F7F9F7`, Plus Jakarta Sans, tanpa neumorphism cekung/cembung, tanpa ambient blur balls, dan tanpa bayangan clay tebal)?
2. **Persetujuan Penanganan Anti-Slop Plugin**:
   - Mengingat perintah `agy` tidak tersedia di PATH lingkungan Windows saat ini, apakah Anda menyetujui bahwa aturan anti-slop ditegakkan secara manual dan ketat melalui checklist pada setiap tahap, tanpa mencoba perintah instalasi shell di luar instruksi resmi?
3. **Persetujuan Alur Pilot Page**:
   - Apakah Anda menyetujui urutan pengerjaan Tahap B dimulai dari **B1 (Fondasi & Shell Navigasi)** lalu **B2 (Pilot: Beranda Musyrif & Catat Setoran Tahfizh)** untuk ditinjau bersama sebelum menyentuh modul-modul lainnya?
