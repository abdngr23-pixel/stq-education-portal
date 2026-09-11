# PROJECT DECISIONS — STQ EDUCATION PORTAL

Dokumen ini mencatat keputusan arsitektur dan produk yang mengikat secara permanen (invarian sistem) untuk STQ Darul Ulum Cendekia (DUC). Seluruh perbaikan bug, redesign, dan refactoring wajib mematuhi keputusan ini tanpa deviasi.

---

## 1. Desain & Arsitektur Formulir Tahfizh (B2)
* **Single-Page Focused Form dengan Progressive Disclosure:**
  Formulir catat setoran tahfizh (`components/modules/tahfizh-module.tsx`) wajib berupa satu halaman terfokus tunggal. Dilarang menggunakan multi-step wizard, dialog bertingkat, atau visual stepper/breadcrumb buatan (seperti `1. Santri & Posisi → 2. Metode → 3. Rincian → 4. Simpan`).
* **Halaman Mulai Sabaq Mengikuti Posisi Terakhir:**
  Rekomendasi halaman awal Sabaq otomatis mengambil halaman terakhir santri (atau modal awal) yang belum selesai, tanpa mengharuskan input manual ulang.
* **Auto-Fill & Validasi Kapasitas:**
  Maksimal alokasi satu nomor halaman mushaf adalah 1.0 (mendukung kelipatan 0.5 halaman: 0.5 + 0.5 = 1.0 penuh). Jika halaman telah terisi penuh 1.0, setoran berikutnya wajib ditolak oleh server.
* **Proteksi Batas Antarjuz:**
  Setoran tidak boleh melintasi batas akhir juz dalam satu transaksi (misal: halaman 441 akhir Juz 22 tidak boleh disetorkan bersama halaman 442 Juz 23).
* **Santri Khatam 30 Juz (Halaman 604 Selesai):**
  Santri yang telah menyelesaikan halaman 604 otomatis dinonaktifkan dari penambahan Sabaq baru, namun tetap dapat menyetorkan Manzil/Mufar.
* **Validasi Sabaqi Riil:**
  Rekomendasi Sabaqi pekan berjalan murni dihitung dari setoran Sabaq sejak hari Senin (WITA Asia/Makassar). Dilarang membuat fallback modal atau hari kerja palsu.

---

## 2. Komunikasi & WhatsApp
* **Setoran Harian Tidak Membuka WhatsApp:**
  Penyimpanan setoran tahfizh tidak memicu pembukaan jendela/dialog WhatsApp secara otomatis dan tidak menyertakan payload WhatsApp dalam response transaksi rutin.
* **Satu Fungsi Utama Hanya Memiliki Satu Lokasi Utama:**
  Fitur yang sama tidak boleh diduplikasi di berbagai modul atau antarmuka.

---

## 3. Navigasi & App Shell (B1)
* **Gunakan `mobile-bottom-nav.tsx` yang Sudah Ada:**
  Aplikasi hanya menggunakan satu komponen bottom navigation mobile resmi (`components/navigation/mobile-bottom-nav.tsx`). Dilarang membuat navigasi mobile kedua atau floating bar duplikat.
* **Desain Anti-Slop (STQ Clean Institutional Minimalist):**
  - Bersih, profesional, bebas dari elemen generik AI template.
  - Dilarang memakai neumorphism, claymorphism berlebihan, ambient blur, glow dekoratif, dan nested card.
  - Warna tema utama: Hijau Institusional STQ (`#0E7C3A`), aksen emas terbatas (`#B8860B`), latar netral bersih (`#F7F9F7`).
  - Logo resmi tidak boleh diubah bentuk, rasio, warna, atau proporsinya.
  - Aksesibilitas: touch target minimum 44 × 44 piksel, safe-area insets (`env(safe-area-inset-bottom)`), dukungan `prefers-reduced-motion`.

---

## 4. Keamanan, Autentikasi & Data
* **Seluruh Perlindungan P0.1 Dipertahankan:**
  - Concurrency protection via transaksi atomik dan idempotensi request (`clientRequestId`).
  - ABAC (Attribute-Based Access Control) kepemilikan halaqoh tetap ditegakkan secara fail-closed.
* **Login Demo Belum Diubah:**
  Akun demo switcher dan otentikasi login demo baseline dipertahankan tanpa modifikasi role atau mekanisme otentikasi.
* **PWA Belum Diizinkan & Dilarang Cache Data Pribadi:**
  Fase PWA (B4) belum diizinkan. Jika PWA kelak diimplementasikan, Service Worker dilarang keras menyimpan/cache data pribadi santri atau wali di penyimpanan lokal klien offline.
