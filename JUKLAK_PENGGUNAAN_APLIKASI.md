# 📖 PETUNJUK PELAKSANAAN (JUKLAK) PENGGUNAAN APLIKASI
## SISTEM INFORMASI AKADEMIK & KESANTRIAN TERPADU
### SEKOLAH TAHFIZHUL QUR'AN DARUL ULUM CENDEKIA
**Yayasan Infak Medika Nusantara — Alumni FKUH**
*Edisi Panduan Resmi: September 2026*

---

## DAFTAR ISI

1. [BAB I: Pendahuluan & Filosofi Sistem](#bab-i-pendahuluan--filosofi-sistem)
2. [BAB II: Peta Peran Pengguna & Wewenang (RBAC & ABAC)](#bab-ii-peta-peran-pengguna--wewenang-rbac--abac)
3. [BAB III: Alur & Mekanisme Modul Tahfizh Al-Qur'an](#bab-iii-alur--mekanisme-modul-tahfizh-al-quran)
4. [BAB IV: Alur & Mekanisme Ujian Ikhtibar 2 Tahap (Tuntas Juz)](#bab-iv-alur--mekanisme-ujian-ikhtibar-2-tahap-tuntas-juz)
5. [BAB V: Alur & Mekanisme Presensi Shalat Berjamaah & Halaqoh](#bab-v-alur--mekanisme-presensi-shalat-berjamaah--halaqoh)
6. [BAB VI: Alur & Mekanisme Perizinan Santri Berjenjang](#bab-vi-alur--mekanisme-perizinan-santri-berjenjang)
7. [BAB VII: Alur Kedisiplinan, Poin Pelanggaran & Surat Peringatan (SP)](#bab-vii-alur-kedisiplinan-poin-pelanggaran--surat-peringatan-sp)
8. [BAB VIII: Alur Penilaian Akademik & Cetak Rapor Gabungan](#bab-viii-alur-penilaian-akademik--cetak-rapor-gabungan)
9. [BAB IX: Alur Pengelolaan Kesehatan Santri (Poskestren)](#bab-ix-alur-pengelolaan-kesehatan-santri-poskestren)
10. [BAB X: Alur Logistik, Pengajuan Anggaran & Administrasi Surat](#bab-x-alur-logistik-pengajuan-anggaran--administrasi-surat)
11. [BAB XI: Alur Komunikasi Donatur / Orang Tua Asuh (Sponsor)](#bab-xi-alur-komunikasi-donatur--orang-tua-asuh-sponsor)
12. [BAB XII: Panduan Khusus Wali Santri & Kotak Saran Aspirasi](#bab-xii-panduan-khusus-wali-santri--kotak-saran-aspirasi)
13. [BAB XIII: Keamanan Akun, Reset Password & Jejak Audit](#bab-xiii-keamanan-akun-reset-password--jejak-audit)
14. [BAB XIV: Tanya Jawab Umum (FAQ) & Penyelesaian Kendala](#bab-xiv-tanya-jawab-umum-faq--penyelesaian-kendala)

---

## BAB I: Pendahuluan & Filosofi Sistem

### 1.1 Filosofi Dasar: "Aplikasi Menyesuaikan Alur Pesantren"
Aplikasi Sistem Informasi STQ Darul Ulum Cendekia dibangun atas prinsip mendasar:
> **"Aplikasi yang menyesuaikan alur nyata pesantren, bukan pesantren yang dipaksa tunduk pada kerumitan teknologi."**

Seluruh fitur, tombol, formulir, dan hak akses di dalam aplikasi dirancang bercermin dari tata tertib, budaya pesantren, serta struktur organisasi riil yang dipimpin oleh Mudir dan Asatidz di STQ Darul Ulum Cendekia. Pengguna tidak perlu menjadi ahli komputer untuk dapat mengoperasikannya; yang dibutuhkan hanyalah menjalankan tugas dan amanah kepengurusan harian secara tertib.

### 1.2 Tiga Nilai Utama Sistem
1. **Kejujuran Data (*Honest System*)**:
   Sistem tidak pernah mengarang data. Jika santri belum menyetor hafalan, rapor akan menampilkan *"Belum ada rekaman nilai"*, bukan nilai buatan. Jika nomor WhatsApp wali santri belum tercatat, sistem melarang pembuatan pesan acak.
2. **Keterbukaan & Transparansi yang Berkeadilan**:
   Setiap transaksi (pencatatan setoran, pemberian sanksi, persetujuan izin, dan mutasi barang logistik) tercatat rapi dalam riwayat audit (*Audit Trail*), sehingga pengurus yayasan dan pimpinan pondok dapat memantau operasional dengan tenang dan adil.
3. **Privasi & Tanggung Jawab Tertutup (*Fail-Closed Privacy*)**:
   Data santri dijaga ketat. Musyrif halaqoh hanya melihat santri yang dibinanya; seorang wali santri hanya diizinkan melihat data putra kandungnya sendiri.

### 1.3 Akses Perangkat
Aplikasi ini dapat diakses melalui peramban web (*Google Chrome*, *Safari*, *Edge*) di laptop, komputer kantor, tablet, maupun smartphone melalui alamat resmi portal STQ. Di perangkat smartphone, aplikasi mendukung mode pemasangan langsung ke layar utama (*Add to Home Screen / PWA*).

---

## BAB II: Peta Peran Pengguna & Wewenang (RBAC & ABAC)

Sistem membagi tugas operasional ke dalam **10 Peran (Role)** agar tidak terjadi tumpang tindih tanggung jawab:

| No | Peran / Singkatan | Pejabat / Pengguna | Tanggung Jawab & Wewenang Utama |
|---|---|---|---|
| 1 | **KS** (Kepala Sekolah) | Mudir Pesantren | Penentu kebijakan tertinggi: menguji Ikhtibar Tahap II, mengesahkan izin kepulangan santri, menyetujui anggaran belanja operasional, dan memberikan pemutihan SP santri. |
| 2 | **MT** (Musyrif Tahfizh) | Asatidz Halaqoh Quran | Mengampu halaqoh santri: mencatat setoran harian berbasis halaman (Metode Al-Pakistani: Sabaq, Sabqi, Manzil, Mufar), menguji Ikhtibar Tahap I, dan mengirimkan mutaba'ah hafalan ke WhatsApp wali santri. |
| 3 | **MK** (Musyrif Kesantrian) | Bagian Kesantrian Pondok | Mengawal disiplin harian: presensi sholat berjamaah 3 waktu, verifikasi awal izin keluar kompleks, dan pencatatan pelanggaran adab santri. |
| 4 | **PH** (Pembina Asrama) | Mudhabbir / Pengasuh Asrama | Pengawasan kehidupan asrama: monitoring ketertiban kamar, piket santri, penanganan kesehatan Poskestren, dan anugerah Bintang Kebaikan. |
| 5 | **GA** (Guru Akademik) | Pengajar Kelas / Mapel | Input nilai akademik kurikulum kepesantrenan (Diniyah) dan studi umum/PBL, serta pemberian catatan evaluasi belajar. |
| 6 | **ADM** (Tata Usaha) | Staf Administrasi & Keuangan | Pengelolaan master data santri & staf, penyusunan agenda kalender pondok, perumusan draf surat kedinasan, dan pengajuan rencana belanja. |
| 7 | **YAY** (Yayasan) | Pengurus Yayasan Infak Medika Nusantara | Pemantauan strategis (*Executive Monitoring*), rekapitulasi capaian pendidikan, transparansi audit trail, dan pemantauan program orang tua asuh. |
| 8 | **WS** (Wali Santri) | Orang Tua / Wali Kandung | Memantau perkembangan hafalan putra, melihat riwayat presensi sholat, mengecek status perizinan, melihat rapor, dan mengirim saran. |
| 9 | **ST** (Santri Mandiri) | Santri STQ DUC | Melihat jadwal harian pribadi, riwayat hafalan yang telah disetorkan, serta apresiasi Bintang Kebaikan yang diraih. |
| 10 | **OSDA** (Organisasi Santri) | Pengurus Santri Senior | Membantu asatidz dalam pencatatan kehadiran kegiatan santri dan penertiban antrean sholat/halaqoh. |

---

## BAB III: Alur & Mekanisme Modul Tahfizh Al-Qur'an

Modul Tahfizh adalah kurikulum inti dan jantung kegiatan pendidikan di Sekolah Tahfizhul Qur'an Darul Ulum Cendekia.

### 3.1 Fakta Dasar: Parameter Setoran Berbasis HALAMAN (Bukan Surah)
Sesuai fakta penerapan riil di lapangan pesantren:
1. **Parameter Utama Setoran adalah HALAMAN**:
   Tolak ukur volume hafalan santri dihitung berdasarkan **jumlah halaman**, bukan nama surah. Hal ini karena panjang surah di dalam Al-Qur'an sangat bervariasi (mulai dari Surah Al-Baqarah yang membentang hingga 48 halaman hingga surah pendek yang hanya 3–4 baris).
2. **Kaidah Standar Mushaf: 1 Juz = 20 Halaman**:
   Mengacu pada versi mushaf standar (Mushaf Madinah / Rasm Utsmani Standar Pojok), **setiap 1 Juz Al-Qur'an memiliki jumlah halaman yang persis sama, yaitu 20 Halaman**.
3. **Fungsi Surah & Ayat**:
   Nama surah dan nomor ayat tetap dicatat sebagai metadata penanda lokasi maqra' bacaan santri yang **dideteksi secara otomatis oleh fitur pintar sistem** saat musyrif memasukkan nomor halaman mushaf (1–604), namun akumulasi capaian hakiki santri mutlak dikonversi dari satuan halaman.

```
+-------------------------------------------------------------------------------+
|               ALUR SETORAN HARIAN METODE AL-PAKISTANI                         |
+-------------------------------------------------------------------------------+
  [Santri Maju ke Halaqoh Membawa Mushaf]
          |
          v
  [Musyrif Memilih Santri & Metode: Sabaq / Sabqi / Manzil / Mufar]
          |
          v
  [Input Parameter: Jumlah Halaman Disetor & Halaman Mushaf]
          |
          +---> Fitur Pintar Mendeteksi Otomatis Nama Surah & Ayat
          |
          +---> [FITUR PINTAR OTOMATIS KONVERSI HAFALAN]:
          |     Sistem Menghitung: Modal Awal Halaman + Tambahan Setoran
          |     Otomatis Dikonversi Menjadi: "[X] Juz [Y] Halaman"
          |
          v
  [Beri Nilai Mutu: Mumtaz, Jayyid Jiddan, Jayyid, Maqbul, Dhoif]
          |
          v
  [Klik Simpan Setoran]
          |
          +---> Pangkalan Data Server Memperbarui Akumulasi Halaman Santri
          |
          +---> Generator WhatsApp Otomatis Mengisi Pesan Berformat Resmi
          |     (Memuat volume halaman & hasil konversi "X Juz Y Halaman")
          |
          v
  [Musyrif Mengirim Laporan Instan 1-Klik ke WhatsApp Wali Santri]
```

### 3.2 Empat Metode Setor Hafalan (Kurikulum Inti: Metode Al-Pakistani)
Sesuai dokumen kurikulum resmi **Alur Pendidikan STQ Darul Ulum Cendekia**, metode setor hafalan menggunakan **Metode Al-Pakistani** yang terdiri dari 4 komponen terstruktur:

| No | Metode Setoran | Definisi & Tujuan Pembelajaran | Parameter & Tolak Ukur |
|---|---|---|---|
| 1 | **Sabaq** | **Penambahan hafalan baru** yang wajib disetorkan setiap hari kepada musyrif halaqoh pada sesi shubuh/pagi. | **Jumlah Halaman Baru Disetor** (misal 0.5, 1, 2, 3 hlm). Diakumulasikan ke total hafalan santri. |
| 2 | **Sabqi** | **Muroja'ah hafalan yang diperoleh selama satu pekan terakhir** guna memantapkan hafalan baru sebelum berpindah halaman. | Frekuensi kelancaran sepekan (Target minimal 16 kali / 4 sesi per pekan). |
| 3 | **Manzil** | **Muroja'ah hafalan pada pekan-pekan sebelumnya** secara berurutan dan bersiklus hingga mencapai satu juz penuh. | Frekuensi putaran juz mutqin (Target minimal 16 kali / 4 sesi per pekan). |
| 4 | **Mufar** | **Muroja'ah harian sebanyak 1–6 juz** sesuai dengan jumlah hafalan yang telah dimiliki santri guna menjaga kualitas dan kemutqinan hafalan lama. | Frekuensi harian (1–6 juz/hari sesuai tingkatan santri). |

### 3.3 Fitur Pintar Otomatis: Konversi Halaman ke Juz & Halaman
Aplikasi dilengkapi mesin kalkulasi otomatis (*Smart Auto-Calculation Engine*) yang menghitung konversi halaman secara seketika (*real-time*).

#### Contoh Riil Kasus Lapangan (Santri Muhammad Fardhan):
- **Modal Hafalan Awal**: Santri atas nama **Muhammad Fardhan** telah memiliki modal hafalan sebelumnya sebanyak **317 Halaman** (Setara **15 Juz 17 Halaman**, karena $317 = (15 \times 20) + 17$).
- **Realisasi Penambahan Sabaq Bulan Ini**:
  - Pekan 1: Tambah **3 Halaman** $\rightarrow$ Total: 320 Halaman (**16 Juz 0 Halaman**)
  - Pekan 2: Tambah **3 Halaman** $\rightarrow$ Total: 323 Halaman (**16 Juz 3 Halaman**)
  - Pekan 3: Tambah **3 Halaman** $\rightarrow$ Total: 326 Halaman (**16 Juz 6 Halaman**)
  - Pekan 4: Tambah **7 Halaman** $\rightarrow$ Total penambahan Sabaq bulan ini: **16 Halaman**.
- **Akumulasi Hafalan Bulan Ini**:
  $$\text{Total Halaman} = 317 + 16 = \mathbf{333\ \text{Halaman}}$$
- **Hasil Konversi Pintar Otomatis Sistem**:
  Tanpa perlu dihitung manual oleh Musyrif, sistem langsung menampilkan:
  $$\mathbf{16\ \text{Juz}\ 13\ \text{Halaman}}$$
  *(Rumus: $333 \div 20 = 16$ Juz sisa $13$ Halaman).*

#### Rumus Konversi Sistem:
$$\text{Total Juz Penuh} = \left\lfloor \frac{\text{Total Halaman}}{20} \right\rfloor$$
$$\text{Sisa Halaman} = \text{Total Halaman} \pmod{20}$$
Sistem merangkumnya menjadi teks format resmi: `"[Juz] Juz [Sisa] Halaman"`.

### 3.4 Parameter Setoran Berbasis Halaman & Juz (Standar Mushaf Madinah)
Sesuai fakta dan alur di lapangan, santri menyetorkan hafalan dengan parameter **Halaman** dan **Juz** (Standar Mushaf Madinah 1 Juz = 20 Halaman, 604 Halaman):
- **Sabaq (Hafalan Baru)**: Musyrif memilih Juz, memasukkan Nomor Halaman Mulai, Jumlah Halaman yang disetor (misal: 0.5, 1, 2, 3, 5, 7 hlm), dan sistem otomatis menghitung Halaman Selesai serta akumulasi capaian.
- **Sabqi (Muroja'ah Sepekan)**: Musyrif menentukan Juz dan rentang halaman hafalan sepekan terakhir yang dimuroja'ah.
- **Manzil (Muroja'ah 1 Juz Penuh)**: Musyrif memilih Juz yang dimuroja'ah secara bersiklus (1 juz penuh = 20 halaman).
- **Mufar (Muroja'ah Harian 1–6 Juz)**: Musyrif memilih volume target harian (1 s/d 6 juz) beserta rincian juz yang disetor.

*Seluruh pengisian setoran berfokus pada halaman dan juz tanpa pembebanan input manual via surah/ayat, selaras dengan metode hafalan Al-Pakistani.*

### 3.5 Standar Penilaian Kelancaran Setoran
Musyrif memberikan predikat mutu tajwid dan kelancaran:
- **MUMTAZ (Istimewa / A+)**: Lancar sempurna, fashahah dan makharijul huruf tepat, waqaf/ibtida' benar.
- **JAYYID JIDDAN (Sangat Baik / A)**: Lancar, ada 1–2 kali perbaikan ringan yang langsung disempurnakan santri.
- **JAYYID (Baik / B)**: Cukup lancar, terdapat beberapa perbaikan hukum tajwid/mad.
- **MAQBUL (Cukup / C)**: Kurang lancar, musyrif memberikan tuntunan beberapa kali.
- **DHOIF (Perlu Mengulang / D)**: Belum menguasai maqra' dengan baik, wajib mengulang sebelum menambah halaman baru.

### 3.6 Mekanisme Laporan WhatsApp ke Wali Santri
Setelah setoran disimpan:
1. Tombol **"Kirim Laporan WA"** aktif secara otomatis apabila nomor kontak wali santri sah dan terdaftar di sistem.
2. Pesan resmi mencantumkan:
   - Identitas santri (Nama, NIS, Kelas, Halaqoh).
   - Jenis setoran (Metode Al-Pakistani: Sabaq / Sabqi / Manzil / Mufar).
   - **Lokasi Maqra' Halaman Mushaf** (Juz dan Rentang Halaman).
   - **Volume Halaman Disetor** (Standar Madinah 20 Hlm/Juz).
   - **Total Akumulasi Terkini** (contoh: *333 Halaman [16 Juz 13 Halaman]*).
   - Predikat nilai dan catatan pembina halaqoh.
3. **Keamanan Anti-Nyasar**: Sistem melarang pengiriman pesan ke nomor acak/palsu jika kontak wali belum terverifikasi di pangkalan data.

---

## BAB IV: Alur & Mekanisme Ujian Ikhtibar 2 Tahap (Tuntas Juz)

Ujian Ikhtibar adalah ujian kelayakan satu juz penuh (20 halaman) yang wajib ditempuh santri sebelum dinyatakan sah menuntaskan suatu juz dan berhak melanjutkan ke juz berikutnya.

```
+------------------------------------------------------------------------------+
|             ALUR RESMI UJIAN IKHTIBAR TUNTAS JUZ (2 TAHAP)                  |
+------------------------------------------------------------------------------+
  [Santri Tuntas 20 Halaman dalam Satu Juz]
                    |
                    v
  [PENGAJUAN]: Musyrif/Santri Mengajukan Pendaftaran Ikhtibar
                    |
                    v
  [TAHAP I - UJI MUSYRIF HALAQOH]
  Pengujian kelancaran & tajwid 20 halaman oleh Musyrif Pembina
  Syarat Lulus: Nilai Minimal 75 (MIN_NILAI_IKHTIBAR)
                    |
          +---------+---------+
          |                   |
    [Nilai < 75]        [Nilai >= 75]
          |                   |
          v                   v
     (MENGULANG)       (LULUS TAHAP I)
  Mengulang Ujian     Status Terbuka untuk Diuji
  Tahap I Musyrif     oleh Mudir Pesantren
                              |
                              v
                [TAHAP II - UJI TERBUKA MUDIR]
                Pengujian komprehensif langsung oleh Pimpinan Pondok
                              |
          +-------------------+-------------------+
          |                                       |
    [LULUS SEMPURNA]                       [BELUM TUNTAS]
          |                                       |
          v                               +-------+-------+
    (RESMI SELESAI JUZ)                   |               |
    - Nilai >= 75                         v               v
    - Berhak lanjut ke Juz berikutnya  (MENGULANG     (MENGULANG
    - Sertifikat/Rapor diterbitkan      SEBAGIAN)      SATU JUZ)
                                       Santri cukup    Santri wajib
                                       memantapkan     murojaah ulang
                                       maqra'/halaman  20 halaman
                                       tertentu saja   secara penuh
```

### 4.1 Tahap I: Pra-Ujian oleh Musyrif Halaqoh
- Musyrif menyimak hafalan santri pada juz yang diajukan.
- Batas kelulusan adalah **nilai 75**.
- Jika santri memperoleh nilai di bawah 75, status menjadi **MENGULANG**, dan santri harus memperkuat hafalannya sebelum dapat mengajukan kembali.
- Jika nilai mencapai 75 atau lebih, status santri naik menjadi **LULUS TAHAP 1**. Pada saat ini, tiket ujian santri otomatis masuk ke meja kerja Mudir.

### 4.2 Tahap II: Ujian Resmi oleh Mudir Pesantren
Mudir Pesantren menguji secara langsung santri yang telah mengantongi tiket kelulusan Tahap I. Dalam Tahap II ini, Mudir memiliki **3 cabang keputusan resmi**:
1. **Lulus Sempurna (`LULUS_SEMPURNA_TAHAP_2`)**:
   Santri dinyatakan resmi tuntas juz. Riwayat capaian juz santri bertambah, dan santri diperkenankan membuka hafalan juz baru.
2. **Mengulang Sebagian (`MENGULANG_SEBAGIAN`)**:
   Diberikan apabila santri secara umum lancar, namun memiliki catatan ketidaklancaran pada beberapa maqra' atau lembar tertentu. Santri tidak perlu mengulang 20 halaman dari awal, melainkan cukup menuntaskan halaman yang dicatat oleh Mudir.
3. **Mengulang Satu Juz Penuh (`MENGULANG_SATU_JUZ`)**:
   Diberikan jika santri belum memenuhi standar kelancaran komprehensif pesantren. Santri dijadwalkan untuk murojaah manzil menyeluruh 20 halaman bersama pembina sebelum dijadwalkan ikhtibar ulang.

---

## BAB V: Alur & Mekanisme Presensi Shalat Berjamaah & Halaqoh

Presensi ibadah adalah instrumen pembinaan kedisiplinan dan spiritual santri di pondok.

### 5.1 Tiga Sesi Shalat Utama
Sistem mencatat presensi pada 3 waktu shalat berjamaah harian yang dipantau ketat:
1. **Sesi Shalat Shubuh**
2. **Sesi Shalat Ashar**
3. **Sesi Shalat Maghrib & Isya (Halaqoh Malam)**

### 5.2 Prinsip "Belum Dicatat" (*Non-Default Presence*)
- Saat formulir presensi dibuka, status santri tidak otomatis diset "Hadir". Status awalnya adalah **BELUM_DICATAT**.
- Hal ini mewajibkan pembina/musyrif untuk benar-benar memeriksa kehadiran fisik santri di shaf masjid, guna mencegah kelalaian pencatatan (*silent omission*).
- Tombol simpan baru dapat diproses apabila seluruh santri dalam kelompok telah diverifikasi.

### 5.3 Opsi Status Kehadiran
- **HADIR**: Santri berada di shaf masjid sebelum iqomah berkumandang.
- **MASBUK**: Santri hadir namun terlambat mengikuti takbiratul ihram imam.
- **IZIN**: Santri telah memiliki izin resmi kesantrian yang disetujui.
- **SAKIT**: Santri sedang beristirahat di UKS Poskestren dalam pengawasan pembina.
- **ALFA**: Santri tidak hadir di masjid tanpa keterangan yang sah.

### 5.4 Integrasi Otomatis dengan Modul Perizinan
Santri yang sedang memegang status **IZIN PULANG** atau **SAKIT** yang telah disetujui di modul perizinan akan **otomatis terdeteksi oleh sistem presensi**. Petugas tidak perlu menandai alfa secara keliru.

---

## BAB VI: Alur & Mekanisme Perizinan Santri Berjenjang

Sistem perizinan santri dirancang bertingkat (*hierarchical*) mengikuti hukum dan tata tertib asrama:

```
                          [JENIS PERIZINAN]
                                  |
                +-----------------+-----------------+
                |                                   |
       [IZIN KELUAR MANDIRI]             [IZIN PULANG / KELUAR KOTA]
    (Lokal, Berobat, Keperluan)          (Menginap di rumah / luar kota)
                |                                   |
                v                                   v
    [Cukup Persetujuan MK]              [TAHAP 1: Verifikasi MK]
     Musyrif Kesantrian menyetujui       Musyrif Kesantrian memeriksa
     Status: DISETUJUI                   kelayakan alasan izin
                |                                   |
                v                                   v
    [Santri Boleh Keluar]               Status: MENUNGGU_KS
                                                    |
                                                    v
                                        [TAHAP 2: Pengesahan MUDIR (KS)]
                                         Mudir Pesantren mengesahkan izin
                                                    |
                                                    v
                                        Status: DISETUJUI & SURAT RESMI
```

### 6.1 Kategori Izin Lokal (Cukup 1 Tingkat: MK / KS)
- Meliputi: Izin keluar komplek membeli kitab/kebutuhan darurat, izin berobat lokal ke klinik terdekat, atau tugas kepesantrenan.
- Wewenang: Dapat langsung disetujui oleh **Musyrif Kesantrian (`MK`)** atau **Mudir (`KS`)**.

### 6.2 Kategori Izin Kepulangan / Menginap (Wajib 2 Tingkat: MK $\rightarrow$ KS)
- Meliputi: Izin kepulangan ke rumah wali, acara keluarga penting, atau perjalanan ke luar kota.
- **Alur Bertingkat**:
  1. Pengajuan masuk ke antrean **Musyrif Kesantrian (`MK`)**. Petugas memeriksa kelayakan, batas waktu, dan catatan kedisiplinan santri. Jika layak, MK memberikan rekomendasi $\rightarrow$ status berubah menjadi **MENUNGGU_KS**.
  2. Berkas otomatis naik ke meja kerja **Mudir Pesantren (`KS`)**.
  3. Mudir memberikan keputusan final: **DISETUJUI** atau **DITOLAK**.
  4. Setelah disetujui, kartu izin kepulangan digital aktif, dan surat izin resmi ber-kop pondok dapat dicetak atau dikirimkan ke WhatsApp orang tua santri.

---

## BAB VII: Alur Kedisiplinan, Poin Pelanggaran & Surat Peringatan (SP)

Pendidikan kedisiplinan di STQ Darul Ulum Cendekia bertujuan membentuk karakter adab dan tanggung jawab santri.

### 7.1 Pencatatan Pelanggaran & Deteksi Pengulangan (Poin Ganda)
- Pelanggaran dicatat oleh Musyrif Kesantrian (`MK`) atau Pembina Asrama (`PH`) dengan mencantumkan santri, kategori pelanggaran, dan kronologi kejadian.
- **Aturan Pelanggaran Berulang (*Repeat Violation*)**:
  Apabila santri melakukan pelanggaran yang sama untuk kedua kalinya atau lebih, sistem secara otomatis melipatgandakan bobot poin sanksi menjadi **2 kali lipat (`poin x 2`)**.
  *Contoh: Masbuk shalat berjamaah bernilai dasar 5 poin. Jika santri mengulanginya, sistem otomatis menetapkan 10 poin.*

### 7.2 Ambang Batas Pemicu Surat Peringatan (SP)
Sistem memantau akumulasi poin pelanggaran aktif santri secara otomatis:
- **Surat Peringatan Pertama (SP-1)**: Terbit jika akumulasi mencapai **20 Poin**.
- **Surat Peringatan Kedua (SP-2)**: Terbit jika akumulasi mencapai **40 Poin**.
- **Surat Peringatan Ketiga (SP-3)**: Terbit jika akumulasi mencapai **60 Poin** (disertai pemanggilan resmi orang tua/wali ke pesantren).

*(Catatan: Angka ambang batas ini tertera dengan label resmi "Status Standar: Menunggu Konfirmasi Pengurus" sebagai acuan operasional sementara menanti Surat Keputusan definitif pimpinan yayasan).*

### 7.3 Cetak Surat Peringatan Resmi (Kop Dinas STQ DUC)
- Surat Peringatan dapat dicetak langsung menggunakan tombol **"Cetak SP"** dengan format standar A4 kedinasan, dilengkapi kop resmi STQ Darul Ulum Cendekia dan Yayasan Infak Medika Nusantara, rincian kronologi pelanggaran, arahan pembinaan adab, serta kolom tanda tangan Mudir dan Pembina.

### 7.4 Pemutihan Poin Pelanggaran
Santri yang telah menjalani masa pembinaan, menunjukkan perubahan akhlak terpuji, dan menuntaskan tugas pembinaan dapat diberikan **Pemutihan Sanksi**.
- **Wewenang**: Tindakan pemutihan sanksi merupakan **hak prerogatif Mudir Pesantren (`KS`)**.
- Poin pelanggaran yang diputihkan akan diarsipkan ke dalam riwayat pembinaan tanpa menghapus rekam jejak historis santri.

---

## BAB VIII: Alur Penilaian Akademik & Cetak Rapor Gabungan

### 8.1 Input Nilai Mata Pelajaran
Guru Pengampu Mata Pelajaran (`GA`) menginput nilai angka (skala 0–100) per semester untuk:
1. **Aspek Kepesantrenan (Diniyah)**: Bahasa Arab, Hadits Arba'in, Fiqih Ibadah, Aqidah Akhlak, Tajwid/Tahsin.
2. **Aspek Studi Umum & Project-Based Learning (PBL)**: Pembelajaran tematik, literasi, dan keterampilan santri.

### 8.2 Konversi Predikat Nilai Otomatis
Sistem mengonversi nilai angka ke dalam predikat mutu:
- **Predikat A (Sangat Baik)**: Nilai $\ge 90$
- **Predikat B (Baik)**: Nilai $80 - 89$
- **Predikat C (Cukup)**: Nilai $70 - 79$
- **Predikat D (Perlu Bimbingan / Remedial)**: Nilai $< 70$

### 8.3 Rapor Gabungan Terpadu (A4 Standar Resmi)
Dokumen Rapor Gabungan santri dapat dicetak kapan saja dengan tata letak resmi yang memuat:
1. **Identitas Santri**: NIS, Nama Lengkap, Kelas, Nama Halaqoh, dan Musyrif Pembina.
2. **Capaian Tahfizh Al-Qur'an**: Total juz mutqin, progres halaman berjalan, nilai setoran terakhir, dan rekapitulasi ikhtibar.
3. **Tabel Nilai Akademik**: Nilai angka, predikat huruf, dan nama guru pengampu.
4. **Kriteria Kelayakan Kenaikan Tingkat (6 Faktor Bab VIII Kurikulum STQ)**:
   - Capaian Tahfiz Tuntas Target
   - Kelulusan Nilai Kepesantrenan
   - Portofolio Studi Umum & PBL
   - Persentase Kehadiran Presensi ($> 85\%$)
   - Catatan Adab & Kedisiplinan (Bebas SP)
   - Keistiqomahan Ibadah Yaumiyah
5. **Legalisasi Tiga Pihak**: Kolom tanda tangan resmi Orang Tua/Wali Santri, Musyrif Halaqoh, dan Mudir Pesantren.

---

## BAB IX: Alur Pengelolaan Kesehatan Santri (Poskestren)

Kesehatan santri dipantau oleh Pembina Asrama (`PH`) bekerja sama dengan staf medis Poskestren Yayasan Infak Medika Nusantara (Alumni FKUH).

### 9.1 Alur Pencatatan Berobat
1. Santri yang merasa kurang sehat melapor ke pos pembina asrama/UKS.
2. Pembina menginput data pemeriksaan: keluhan santri, suhu tubuh ($^\circ\text{C}$), tensi (jika ada), dan tindakan pertolongan pertama (P3K / istirahat / pemberian obat bebas terbatas).
3. Status awal perawatan: **RAWAT_PONDOK**.

### 9.2 Eskalasi Rujukan Medis Berjenjang
Apabila kondisi santri memerlukan penanganan medis lebih lanjut, pembina memperbarui status rujukan secara bertahap:
- **RAWAT_PONDOK**: Santri dirawat di ruang UKS asrama dengan pengawasan istirahat.
- **DIRUJUK_PUSKESMAS**: Santri diantar ke Puskesmas Manggala / fasilitas kesehatan primer terdekat.
- **DIRUJUK_RS**: Kasus darurat yang memerlukan rujukan ke Rumah Sakit rekanan yayasan.
- **SEMBUH**: Santri dinyatakan pulih dan kembali mengikuti halaqoh/KBM normal.

---

## BAB X: Alur Logistik, Pengajuan Anggaran & Administrasi Surat

### 10.1 Manajemen Stok Logistik Asrama
Petugas Logistik mencatat perputaran inventaris pondok yang mencakup 3 kelompok barang:
- **Sembako Dapur**: Beras, minyak goreng, telur, bumbu dapur.
- **Obat-obatan UKS**: Parasetamol, minyak kayu putih, perban, vitamin santri.
- **ATK & Perlengkapan**: Buku setoran, spidol, kertas print rapor, lampu kamar.

**Mekanisme Transaksi**:
- **Mutasi Masuk**: Penambahan stok dari belanja operasional pondok atau sumbangan/infaq wali santri.
- **Mutasi Keluar**: Pengeluaran harian dapur atau distribusi obat santri sakit. Sistem menjaga konsistensi ACID: stok barang tidak dapat bernilai negatif.

### 10.2 Pengajuan Kebutuhan Belanja Operasional Bulanan
1. Staf Tata Usaha (`ADM`) membuat draf pengajuan belanja operasional dengan rincian nama kebutuhan, pos anggaran, estimasi biaya, dan urgensi.
2. Draf otomatis muncul pada dashboard Mudir Pesantren (`KS`).
3. Mudir memeriksa dan menyetujui (*Approve*) atau menolak (*Reject*) disertai catatan arahan.
4. Laporan realisasi belanja dapat dipantau oleh Pengurus Yayasan (`YAY`) demi akuntabilitas keuangan.

### 10.3 Administrasi Penomoran Surat Resmi Pondok
Sistem menyediakan format baku penomoran surat resmi sesuai tata persuratan STQ Darul Ulum Cendekia:
- **Surat Izin Pulang Santri**: `.../STQ-DUC/IZN/...`
- **Surat Peringatan Kedisiplinan**: `.../STQ-DUC/SP/...`
- **Surat Keterangan Aktif Belajar**: `.../STQ-DUC/KET/...`
Seluruh draf surat siap cetak dengan kop dinas resmi, alamat sekretariat Tamangapa Raya, dan identitas Yayasan Infak Medika Nusantara.

---

## BAB XI: Alur Komunikasi Donatur / Orang Tua Asuh (Sponsor)

Program Orang Tua Asuh adalah program beasiswa infak santri yatim dan dhuafa yang diselenggarakan bersama Yayasan Infak Medika Nusantara.

### 11.1 Alokasi Santri Asuh
Pengurus Yayasan (`YAY`) atau Admin (`ADM`) menghubungkan data donatur/sponsor tetap dengan santri asuh yang menerima manfaat beasiswa pendidikan.

### 11.2 Pembuatan Laporan Bulanan Sponsor Otomatis
- Sistem secara otomatis menghimpun capaian hafalan santri asuh selama satu bulan kalender berjalan berdasarkan zona waktu Indonesia Tengah (WITA).
- Laporan merangkum: capaian juz, perkembangan adab dan kedisiplinan, serta kalimat apresiasi dan doa tulus dari musyrif pembina.

### 11.3 Konfirmasi Pengiriman WhatsApp (Anti-Klaim Palsu)
Untuk menjamin kejujuran komunikasi:
- Pembina membuka dialog pengiriman WhatsApp laporan sponsor.
- Status laporan **tidak akan berubah menjadi "Terkirim" hanya karena tombol dibuka**.
- Pembina wajib menekan tombol konfirmasi manual: **"Saya Sudah Mengirim Pesan Ini via WhatsApp"** setelah pesan benar-benar terkirim ke nomor donatur.

---

## BAB XII: Panduan Khusus Wali Santri & Kotak Saran Aspirasi

### 12.1 Akses Khusus Orang Tua / Wali Santri (`WS`)
Wali santri dapat masuk ke aplikasi menggunakan username dan password yang diberikan oleh pihak Tata Usaha saat pendaftaran santri:
- Wali santri **hanya dapat melihat data anak kandungnya sendiri**. Sistem menolak akses terhadap data santri lain.
- Pada halaman utama portal wali, orang tua dapat memantau:
  1. Riwayat setoran Al-Qur'an harian (juz, surah, ayat, dan nilai kelancaran).
  2. Status kehadiran shalat berjamaah 3 waktu.
  3. Status perizinan santri (apakah sedang berada di asrama atau sedang berizin).
  4. Apresiasi **Bintang Kebaikan** santri yang diberikan pembina.
  5. Rekapitulasi Rapor Akademik & Tahfizh berkala.

### 12.2 Kotak Saran & Aspirasi Wali Santri
Pesantren menyediakan saluran komunikasi formal bagi wali santri untuk menyampaikan masukan konstruktif, keluhan, maupun pertanyaan:
1. Wali santri mengisi formulir Kotak Saran dengan memilih kategori (Kurikulum, Asrama/Dapur, Administrasi, atau Umum) dan menuliskan pesan.
2. Pesan masuk ke meja kerja staf dan pimpinan pondok dengan status awal: **BARU**.
3. Pengurus pondok menindaklanjuti dan memberikan tanggapan resmi di sistem. Status pesan diperbarui menjadi **DIPROSES** $\rightarrow$ **DITANGGAPI**.
4. Wali santri dapat membaca tanggapan resmi pondok secara transparan melalui portal.

---

## BAB XIII: Keamanan Akun, Reset Password & Jejak Audit

### 13.1 Standar Keamanan Sandi & Pemutusan Sesi Aktif
- Untuk menjaga keamanan data santri dan asatidz, pengurus Tata Usaha (`ADM`) memiliki wewenang mereset kata sandi pengguna yang lupa password.
- **Prosedur Reset Aman**:
  Sistem membangkitkan kata sandi acak sementara berstandar kriptografi (`DUC-XXXXXX`). Saat password direset, **seluruh token sesi lama pada perangkat santri/staf terkait otomatis dicabut seketika** (`prisma.session.deleteMany`). Pengguna wajib login ulang dengan sandi baru.
- Akun berstatus **NONAKTIF** otomatis ditolak oleh sistem dan tidak dapat login ke portal.

### 13.2 Rekaman Jejak Audit (*Audit Trail*)
Setiap perubahan data krusial di sistem otomatis dicatat ke dalam log audit:
- Waktu pencatatan (standar waktu WITA).
- Pengguna yang melakukan perubahan (User ID & Nama).
- Jenis tindakan (misal: `API_CREATE_SETORAN`, `RESET_PASSWORD`, `APPROVE_IZIN`).
- Data sebelum dan sesudah perubahan.
Log audit ini dapat dipantau oleh Pengurus Yayasan (`YAY`) dan Mudir (`KS`) sebagai instrumen pengawasan mutu dan akuntabilitas syar'i.

---

## BAB XIV: Tanya Jawab Umum (FAQ) & Penyelesaian Kendala

### Q1: Mengapa musyrif tidak dapat melihat nama santri dari halaqoh sebelah?
**Jawab**: Ini adalah fitur keamanan sistem (*Attribute-Based Access Control / ABAC*). Setiap musyrif hanya diberikan wewenang mencatat dan melihat santri yang berada dalam halaqoh binaannya sendiri untuk menjaga fokus pembinaan dan mencegah kekeliruan input antar-asatidz. Jika terjadi perombakan halaqoh, hubungi bagian Tata Usaha (`ADM`) untuk memperbarui pembina halaqoh santri tersebut.

### Q2: Bagaimana jika santri sakit saat jam shalat berjamaah di masjid?
**Jawab**: Pembina Asrama (`PH`) mencatatkan kondisi santri ke dalam modul **Kesehatan (Poskestren)** atau modul **Perizinan** dengan status `SAKIT`. Sistem presensi masjid otomatis menyinkronkan data tersebut sehingga santri tidak ditandai sebagai `ALFA`.

### Q3: Apakah santri yang mendapat nilai 74 pada Ikhtibar Tahap I boleh diuji oleh Mudir?
**Jawab**: Tidak boleh. Sistem menerapkan ambang batas kelulusan minimal nilai 75 pada Ujian Tahap I. Tiket ujian Tahap II Mudir hanya akan terbuka apabila santri telah dinyatakan lulus Tahap I oleh Musyrif pembina.

### Q4: Mengapa tombol kirim WhatsApp tidak dapat diklik?
**Jawab**: Periksa nomor telepon wali santri pada menu Data Santri. Tombol WhatsApp dinonaktifkan oleh sistem jika nomor telepon kosong, kurang digit, atau formatnya tidak valid di Indonesia, demi mencegah pesan rahasia santri salah kirim ke nomor orang lain.

### Q5: Bagaimana jika internet di lokasi pesantren sedang mengalami gangguan?
**Jawab**: Sistem dirancang dengan pesan umpan balik jujur (*honest error reporting*). Jika koneksi ke pangkalan data terputus, sistem akan mengabarkan bahwa data belum berhasil disimpan ke server, dan formulir input Anda tidak akan dihapus. Asatidz disarankan menunggu koneksi stabil sebelum menekan tombol simpan kembali, guna memastikan data tercatat sempurna di peladen pusat.

---

*Dokumen Petunjuk Pelaksanaan (Juklak) ini disusun secara resmi untuk menjadi pedoman bersama bagi seluruh jajaran Yayasan Infak Medika Nusantara, Pimpinan Pondok, Asatidz, Staf Tata Usaha, dan Wali Santri STQ Darul Ulum Cendekia.*
