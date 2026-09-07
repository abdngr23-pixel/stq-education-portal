# 🕌 STQ Education Portal (Darul Ulum Cendekia)

Sistem Informasi Manajemen Terpadu Pondok Pesantren Tahfizh Quran berbasis **Next.js 16 (App Router)**, **Tailwind CSS v4**, **PostgreSQL**, dan **Prisma ORM**, menggantikan sistem lama berbasis Google Apps Script & Google Spreadsheet.

---

## 🌟 Arsitektur & Teknologi

- **Frontend & Routing**: Next.js 16 (App Router), React 19, TypeScript
- **Styling & UI**: Tailwind CSS v4, Lucide Icons, Brand Identity (`#0E7C3A` Emerald Green, `#C9990E` Warm Gold, `sky-50` Canvas)
- **Database & ORM**: PostgreSQL 16+, Prisma ORM v6
- **Autentikasi & Keamanan**: JOSE JWT (HttpOnly Cookie, sliding expiration 7 hari), Bcrypt hashing, Role-Based Access Control (RBAC) & Attribute-Based Access Control (ABAC), Middleware Guard
- **API & Mutasi**: Next.js Server Actions dengan audit logging otomatis

---

## 👥 Matriks 10 Peran Pengguna (RBAC)

Sistem mendukung pemisahan hak akses 10 peran spesifik:

| Kode | Peran | Tanggung Jawab Utama |
|---|---|---|
| **YAY** | Pembina / Pengurus Yayasan | Monitoring eksekutif, rekapitulasi strategis, audit log |
| **KS** | Kepala Sekolah / Mudir STQ | Persetujuan perizinan keluar, pemutihan SP, verifikasi pengajuan anggaran |
| **ADM** | Tata Usaha / Keuangan | Pengajuan belanja bulanan, administrasi surat, pencatatan notulen rapat |
| **MK** | Musyrif Kesantrian | Verifikasi izin keluar/pesantren, absensi shalat berjamaah 3 waktu |
| **MT** | Musyrif Tahfizh | Input setoran Ziyadah & Murojaah, kepemilikan halaqoh santri (ABAC) |
| **GA** | Guru Akademik | Input nilai rapor mata pelajaran (Bahasa Arab, Hadits, Fiqih, Aqidah) |
| **PH** | Pengurus Asrama / Pembina | Pengawasan ketertiban asrama, anugerah Bintang Kebaikan santri |
| **OSDA** | Organisasi Santri DUC | Bantuan pencatatan kedisiplinan dan absensi kegiatan santri |
| **WS** | Wali Santri | Memantau perkembangan hafalan, rapor gabungan, absensi & pelanggaran anak |
| **ST** | Santri Mandiri | Cek jadwal, perizinan, riwayat hafalan & bintang kebaikan pribadi |

---

## 🚀 Fitur Unggulan per Modul

### 1. Tahfizh & Halaqoh (Fase 1)
- Form input setoran Ziyadah & Murojaah dengan filter kepemilikan halaqoh santri (ABAC).
- Standar penilaian tahfizh: `MUMTAZ`, `JAYYID_JIDDAN`, `JAYYID`, `MAQBUL`, `RASYID`.
- Progres juz dan ayat santri secara real-time.

### 2. Akademik & Kesantrian (Fase 2)
- Input nilai angka & predikat otomatis (A, B, C, D) untuk mata pelajaran kepesantrenan.
- **Rapor Gabungan Tahfizh & Akademik**: Menggabungkan nilai hafalan Al-Qur'an dan nilai mata pelajaran dalam satu lembar cetak/ekspor.
- **Perizinan Bertingkat**: Izin keluar mandiri disetujui Musyrif Kesantrian (`MK`), izin menginap / pulang ke rumah dieskalasi otomatis ke Mudir (`KS`).
- **Absensi Terpadu**: 3 Sesi Shalat Berjamaah (Subuh, Ashar, Maghrib) + Sesi KBM Akademik.

### 3. Kedisiplinan & Administrasi (Fase 3)
- **Logika Pelanggaran Cerdas**: Deteksi pengulangan pelanggaran otomatis menggandakan poin sanksi (`poin x 2`).
- **Trigger SP Otomatis**: Surat Peringatan SP1 (akumulasi poin >= 30), SP2 (>= 60), SP3 (>= 100) diterbitkan otomatis.
- **Pemutihan Sanksi**: Wewenang khusus Mudir (`KS`) untuk memutihkan SP setelah pembinaan.
- **Bintang Kebaikan**: Pencatatan poin perilaku positif dan keteladanan santri oleh Pembina (`PH`).
- **Pengajuan Belanja Bulanan**: Alur verifikasi anggaran transparan diajukan TU (`ADM`) dan disetujui Mudir (`KS`).
- **Notulen Rapat**: Arsip digital agenda, keputusan, dan tindak lanjut rapat pesantren.

### 4. Integrasi Eksternal & Surat AI (Fase 4)
- **Portal Orang Tua Asuh / Sponsor**: Pengelolaan data donatur tetap, alokasi santri asuh, dan pelacakan donasi bulanan.
- **WhatsApp API Dispatcher**: Generator pesan dan notifikasi berkala otomatis ke WhatsApp orang tua asuh mengenai progres hafalan & akhlak santri.
- **Generator Surat AI Resmi**: Otomatisasi pembuatan dokumen resmi ber-kop surat STQ Darul Ulum Cendekia dengan penomoran standar (`.../STQ-DUC/...`) untuk Surat Izin Pulang, SP Pelanggaran, dan Surat Keterangan Aktif.

### 5. Modul Lanjutan & Logistik Asrama (Fase 6)
- **Ikhtibar Ujian Tahfizh 2 Tahap**: Alur pendaftaran ujian $\rightarrow$ Penilaian kelancaran oleh Musyrif Tahfizh (`MT`) $\rightarrow$ Ujian akhir & legalitas kelulusan juz oleh Mudir Pesantren (`KS`).
- **Poskestren (Kesehatan Santri)**: Rekam riwayat keluhan/gejala santri, tindakan medis P3K, dan eskalasi rujukan berjenjang (`RAWAT_PONDOK` $\rightarrow$ `DIRUJUK_PUSKESMAS` $\rightarrow$ `DIRUJUK_RS` $\rightarrow$ `SEMBUH`).
- **Inventaris & Logistik Asrama**: Manajemen stok sembako dapur (beras, minyak), obat UKS, dan ATK kantor dengan pelacakan mutasi masuk (donasi wali/belanja) dan mutasi keluar (konsumsi harian).
- **Format Cetak Dokumen Resmi A4**: Dukungan cetak langsung ber-kop surat resmi STQ Darul Ulum Cendekia untuk Rapor Gabungan Santri dan Surat Dinas Resmi.

### 6. Portal Wali, Kalender Akademik & REST API (Fase 7)
- **Portal Wali Santri & Santri Mandiri (Parent Experience)**: Kartu identitas santri, capaian hafalan Al-Qur'an (total baris, juz mutqin), status perizinan aktif, riwayat berobat Poskestren, dan apresiasi Bintang Santri.
- **Kotak Saran Aspirasi**: Formulir pengaduan, masukan, dan aspirasi wali santri dengan status penanganan (`BARU`, `DIPROSES`, `DITANGGAPI`) dan tanggapan langsung pengurus.
- **Agenda & Kalender Akademik**: Pelacakan event tahunan, ujian tahfizh, liburan santri, dan jadwal pertemuan wali santri.
- **Manajemen Pengguna & Staf**: Manajemen terpusat untuk 10 peran, reset kata sandi instan, dan toggle aktivasi status akun.
### 7. Quality Assurance, Audit Trail, Ekspor Data & PWA (Fase 8)
- **Suite Pengujian Unit Otomatis (`npm test`)**: 18 pengujian logika bisnis inti (sanksi doubling poin x2, pemicu SP1-SP3, konversi predikat nilai A-D, perizinan berjenjang, ikhtibar 2 tahap, mutasi logistik) dengan zero external dependencies via Node Native Test Runner.
- **Audit Trail & Monitoring Mutasi Transaksi**: Tab audit interaktif khusus Pembina Yayasan (`YAY`), Mudir (`KS`), dan Tata Usaha (`ADM`) untuk melacak seluruh transaksi mutasi sistem real-time.
- **Ekspor Data CSV Terpadu**: Generator unduh dokumen CSV/Excel untuk data Tahfizh Santri, Surat Peringatan Kedisiplinan, Stok Logistik Gudang, dan Jejak Audit.
- **Progressive Web App (PWA) Manifest**: Dukungan instalasi aplikasi langsung di smartphone (*Add to Home Screen*) asatidz dan wali santri via `/manifest.webmanifest`.

### 8. Production Deployment & DevOps Hardening (Fase 9)
- **Otomatisasi Backup Database**: Skrip pencadangan PostgreSQL terjadwal (`npm run db:backup`) dengan kompresi dan rotasi retensi 7 hari.
- **CI/CD GitHub Actions Pipeline**: Workflow otomatisasi pengujian unit (`npm test`), validasi Prisma, dan build Next.js pada setiap pembaruan kode (`.github/workflows/ci.yml`).
- **Production Standalone Dockerfile**: Multi-stage build minimal (< 150MB) berbasis Alpine Linux dan orkestrasi 3 kontainer pada `docker-compose.prod.yml`.
- **Nginx Reverse Proxy & Keamanan**: Konfigurasi siap pakai dengan SSL Let's Encrypt, rate limiting login (5 req/menit), security headers, dan kompresi gzip (`deploy/nginx/stq-nginx.conf`).

---

## 🛠️ Instalasi & Menjalankan Aplikasi

### 1. Prasyarat
- Node.js v18+ (disarankan v20 atau v24)
- Docker Desktop (untuk PostgreSQL lokal) atau pangkalan data PostgreSQL yang aktif

### 2. Menjalankan Database PostgreSQL dengan Docker
```bash
docker compose up -d
```
Database PostgreSQL akan aktif pada `localhost:5432` dengan database `stq_education_db`.

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/stq_education_db?schema=public"
AUTH_SECRET="stq-education-portal-jwt-secret-key-2026-super-secure"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Generate Prisma & Migrasi Database
```bash
npx prisma generate
npx prisma db push
```

### 5. Seeding Data Awal (10 Demo Akun)
```bash
npx prisma db seed
```

### 6. Migrasi Data dari Google Sheets (Opsional)
Jika Anda memiliki data ekspor dari Google Spreadsheet lama:
```bash
npx tsx scripts/migrate-sheets-to-pg.ts
```

### 7. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka browser di `http://localhost:3000` (atau `http://localhost:3001` jika port 3000 terpakai).

---

## 🔑 Akun Demo Siap Uji (1-Click Switcher)

Pada halaman login (`/login`) atau Dashboard, Anda dapat langsung mengklik tombol demo switcher untuk menguji fitur dengan peran berikut:

| Role | Email | Password |
|---|---|---|
| Pembina Yayasan (`YAY`) | `ahmad.yay@stqduc.sch.id` | `password123` |
| Mudir / Kepala Sekolah (`KS`) | `ridwan.ks@stqduc.sch.id` | `password123` |
| Tata Usaha / Keuangan (`ADM`) | `aminah.adm@stqduc.sch.id` | `password123` |
| Musyrif Kesantrian (`MK`) | `faqih.mk@stqduc.sch.id` | `password123` |
| Musyrif Tahfizh (`MT`) | `salman.mt@stqduc.sch.id` | `password123` |
| Guru Akademik (`GA`) | `nurul.ga@stqduc.sch.id` | `password123` |
| Pembina Asrama (`PH`) | `miftah.ph@stqduc.sch.id` | `password123` |
| Pengurus OSDA (`OSDA`) | `fathir.osda@stqduc.sch.id` | `password123` |
| Wali Santri (`WS`) | `wali.faiz@stqduc.sch.id` | `password123` |
| Santri (`ST`) | `faiz.santri@stqduc.sch.id` | `password123` |
