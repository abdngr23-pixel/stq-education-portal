# Checkpoint P0.1: Koreksi Validasi Multi-Halaman, Konkurensi, dan Sabaqi Tahfizh

Dokumen ini mendokumentasikan pemenuhan seluruh instruksi perbaikan **KOREKSI P0.1 — VALIDASI MULTI-HALAMAN, KONKURENSI, DAN SABAQI** pada sistem Portal Pendidikan STQ Darul Ulum Cendekia.

---

## 1. Masalah yang Diperbaiki

1. **Multi-Page Sabaq Rejection Bug**:
   - *Masalah*: Pada implementasi sebelumnya di `app/actions/tahfizh.ts`, query pencarian kapasitas hanya mengecek `halamanMulai`, dan menjumlahkan seluruh `jmlHalaman` ke `halMulai` (`existingVolumeOnPage + jmlHalaman > 1.0`). Akibatnya, setoran sah yang mencakup lebih dari satu halaman (contoh: halaman 422–423 dengan volume 2 halaman) salah ditolak karena seolah-olah 2.0 halaman dibebankan sekaligus pada halaman 422.
   - *Solusi*: Dibuat modul murni `lib/tahfizh-page-allocation.ts` yang memecah setoran menjadi peta alokasi per halaman (contoh: 422–423 volume 2 => `{422: 1.0, 423: 1.0}`). Kapasitas diperiksa per halaman individual ($\le 1.0$).

2. **Validasi Kapasitas Halaman Tidak Atomik & Rentan Race Condition**:
   - *Masalah*: Pengecekan kapasitas dilakukan di luar transaksi DB, sehingga jika dua request datang bersamaan dari dua perangkat berbeda, keduanya bisa lolos dan mengakibatkan halaman terisi melebihi 1.0 halaman.
   - *Solusi*: Seluruh alur (pembacaan setoran aktif pasca-baseline, kalkulasi occupancy halaman, validasi kapasitas $\le 1.0$, pembuatan record setoran, dan pencatatan audit log) dibungkus ke dalam satu transaksi atomik PostgreSQL dengan `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`. Mekanisme retry otomatis (3 kali) menangani kegagalan serialisasi (`P2034` / serialization failure) dan menyajikan pesan ramah pengguna tanpa mengekspos error teknis:
     *"Posisi hafalan santri baru saja diperbarui dari perangkat lain. Data telah dimuat ulang. Silakan periksa lalu simpan kembali."*

3. **Fallback Warisan (Modal/Weekday) pada Sabaqi**:
   - *Masalah*: Ketika santri belum memiliki catatan Sabaq aktif pada pekan berjalan, sistem masih mencoba mengambil fallback lama berbasis modal awal kumulatif atau hari dalam sepekan.
   - *Solusi*: Fallback warisan dibersihkan sepenuhnya dari `components/modules/tahfizh-module.tsx`. Jika tidak ada Sabaq sah aktif pekan ini, sistem menyajikan status informatif *"Belum ada Sabaq tersimpan pada pekan ini."* Form input tidak terisi otomatis secara keliru. Jika musyrif ingin input manual, disediakan opsi *"Gunakan Input Manual Sabaqi"* dengan syarat wajib mengisi alasan minimal 5 karakter.

4. **Pengujian Nyata Tanpa Mock Logika**:
   - *Masalah*: Script pengujian terdahulu memanipulasi DOM dengan prepend banner atau mock buatan.
   - *Solusi*: Dibuat pengujian unit produksi murni (`tests/p0-lanjutan-tahfizh.test.ts`), pengujian konkurensi & persistensi nyata pada PostgreSQL terisolasi (`tests/p0-concurrency-persistence.test.ts`), serta verifikasi browser nyata dengan Puppeteer (`scripts/puppeteer-p0-1-verify.ts` & `scripts/puppeteer-p0-lanjutan-verify.ts`) yang mengklik tombol UI sebenarnya, menunggu server action selesai, me-reload halaman, dan memvalidasi persistensi database riil.

5. **Nomor WhatsApp Dummy pada Executable Scripts**:
   - *Masalah*: `prisma/seed.ts` dan `scripts/migrate-sheets-to-pg.ts` masih memiliki fallback nomor telepon dummy (`081299887766` / `081234567890`).
   - *Solusi*: Seluruh nomor telepon dummy dibersihkan menjadi `null` atau string kosong yang dinormalisasi menjadi `null`.

6. **Penanganan Halaman Terakhir Mushaf (Halaman 604 Selesai)**:
   - *Masalah*: Santri yang telah menyelesaikan halaman 604 tidak boleh ditawarkan halaman 605 atau mengisi ulang halaman 604 sebagai hafalan baru.
   - *Solusi*: Jika santri telah menyelesaikan halaman 604 (penuh), form dan tombol simpan Sabaq dinonaktifkan dengan banner resmi dari state aplikasi:
     > **Target hafalan 30 juz telah selesai. Tidak ada halaman Sabaq berikutnya.**
     Santri tetap dapat menyetorkan Sabqi, Manzil, atau Mufar untuk pemeliharaan hafalan.

---

## 2. Arsitektur & Perubahan Implementasi

### A. Modul Alokasi Murni: `lib/tahfizh-page-allocation.ts`
- `allocateSabaqPages(halamanMulai, halamanSelesai, jumlahHalaman)`:
  - Mengonversi rentang dan volume menjadi record per halaman.
  - Memastikan volume merupakan kelipatan 0.5.
  - Halaman awal dialokasikan penuh (1.0), pecahan 0.5 dialokasikan pada halaman terakhir.
- `buildHistoricalPageOccupancy(existingSetoranList, baselineDate)`:
  - Mengagregasikan seluruh setoran SABAQ aktif pasca-baseline menjadi occupancy riil per halaman.
- `validateProposedSabaqAllocation(existingSetoranList, halMulai, halSelesai, jmlHalaman, baselineDate)`:
  - Memeriksa kapasitas setiap halaman dalam rentang ($\le 1.0$).
- `calculateLatestSabaqPosition(sabaqList, modalAwal, baselineDate)`:
  - Menghitung posisi hafalan resmi santri, mendeteksi halaman parsial (0.5), mendeteksi status khatam 30 Juz (halaman 604), dan menyarankan posisi berikutnya secara aman (tanpa menghasilkan halaman 605).

### B. Core Persistence Service: `lib/tahfizh-persistence.ts`
- Menyediakan fungsi inti `saveSetoranTahfizhCore(prisma, { input, context })` yang dapat digunakan baik oleh Server Actions Next.js maupun test suite integrasi.
- Menggunakan `prisma.$transaction` dengan isolasi `Serializable`.
- Menangani idempotensi melalui `clientRequestId` dan mendeteksi duplikasi `P2002` dengan validasi kepemilikan santri.

### C. Server Actions: `app/actions/tahfizh.ts`
- Mengautentikasi sesi aktif musyrif.
- Memanggil `saveSetoranTahfizhCore`.
- Mengembalikan response JSON bersih tanpa memicu payload WhatsApp rutin.

### D. Komponen UI: `components/modules/tahfizh-module.tsx`
- Menghapus referensi fallback lama `hitungReferensiSabaqiKumulatif` dan `sabaqiKumulatifRef`.
- `handleApplySabaqiReference` hanya aktif jika terdapat Sabaq aktif pekan ini.
- Menambahkan penanganan khatam 30 Juz: banner status, input dinonaktifkan, tombol submit Sabaq dinonaktifkan.
- Menambahkan validasi batas juz kurikulum STQ DUC (mencegah setoran melintasi batas juz).

---

## 3. Bukti Pengujian Unit & Integrasi PostgreSQL Terisolasi

Perintah:
```bash
npx dotenv -e .env.test -- npm test
```

Hasil:
```text
▶ INTEGRASI P0.1: Concurrency, Idempotensi, & Persistensi Nyata (PostgreSQL Terisolasi)
  ✔ 1. Konkurensi Nyata: Dua transaksi simultan (Promise.allSettled) mengisi sisa 0.5 halaman yang sama (89.2ms)
  ✔ 2. Idempotensi Nyata & Pemeriksaan Kepemilikan Santri pada P2002 (34.9ms)
  ✔ 3. Validasi Server Alasan Lompatan Halaman SABAQ (Poin 7) (23.1ms)
  ✔ 4. Validasi Server Sabaqi Nyata Tanpa Data Palsu (Poin 5) (14.5ms)
  ✔ 5. Santri Khatam 30 Juz (Halaman 604 Selesai) Dinonaktifkan dari Sabaq Baru (5.9ms)
  ✔ 6. Response Setoran Tidak Memuat Payload WhatsApp Rutin (11.6ms)
✔ INTEGRASI P0.1: Concurrency, Idempotensi, & Persistensi Nyata (PostgreSQL Terisolasi) (7575.4ms)

▶ KOREKSI P0.1 TAHFIZH — Production Unit Tests
  ✔ 1. Setoran satu halaman: 422–422, volume 1 dialokasikan penuh { 422: 1.0 }
  ✔ 2. Setoran dua halaman: 422–423, volume 2 dialokasikan { 422: 1.0, 423: 1.0 }
  ✔ 3. Setoran 3, 5, dan 7 halaman dialokasikan proporsional
  ✔ 4. Setoran 2.5 halaman menjadi 1 + 1 + 0.5 (penuh-penuh-setengah pada halaman terakhir)
  ✔ 5. Penolakan volume/rentang yang tidak konsisten
  ✔ 6. Dua setoran 0.5 pada halaman sama diterima (0.5 + 0.5 = 1.0)
  ✔ 7. Setoran ketiga 0.5 pada halaman yang sudah penuh (1.0) ditolak
  ✔ 8. Setoran berstatus DIBATALKAN tidak menghabiskan kapasitas halaman
  ✔ 9. Posisi terakhir mengambil halaman tertinggi dari alokasi sah
  ✔ 10. Multi-halaman yang menabrak kapasitas sebagian halaman ditolak
  ✔ 11. Validasi batas toleransi kapasitas floating-point aman terhadap pembulatan
  ✔ 12. Santri pada halaman 604 penuh tidak mendapat saran halaman 605
✔ KOREKSI P0.1 TAHFIZH — Production Unit Tests (11.2ms)

ℹ tests 246
ℹ suites 92
ℹ pass 246
ℹ fail 0
```

---

## 4. Bukti Screenshot Verifikasi Browser Riil (Puppeteer)

Dijalankan menggunakan script `scripts/puppeteer-p0-1-verify.ts` pada instance terisolasi Next.js dan PostgreSQL:

1. **Skenario A — Multi-halaman Nyata (422–423, Volume 2 Halaman)**:
   - File: `p0_1_real_multipage_success.png`
   - Bukti: Mengklik tombol UI sebenarnya `+2 Hlm`, mengklik `Simpan Setoran Santri`, menerima respons sukses dari server action riil, memverifikasi tidak ada dialog WhatsApp, me-reload halaman, membuktikan record 422–423 tersimpan di tabel riwayat database, dan saran otomatis maju ke 424.
2. **Skenario B — Setoran Parsial 0.5 Halaman**:
   - Bukti: Menyimpan 0.5 pertama pada halaman 431, me-reload dan memastikan saran tetap di halaman 431. Menyimpan 0.5 kedua, me-reload dan memastikan saran maju ke halaman 432.
3. **Skenario C — Santri Khatam 30 Juz (Halaman 604 Selesai)**:
   - File: `p0_1_real_khatam_disabled.png`
   - Bukti: Santri dengan posisi resmi halaman 604 dipilih. Banner status resmi *"Target hafalan 30 juz telah selesai. Tidak ada halaman Sabaq berikutnya."* muncul langsung dari state React aplikasi. Form input dan tombol Simpan dinonaktifkan. Tidak ada saran halaman 605.
4. **Skenario D — Validasi Sabaqi Tanpa Fallback Lama**:
   - File: `p0_1_real_sabaqi_validation.png`
   - Bukti: Memilih santri tanpa Sabaq pekan ini. Banner informasi kuning *"Belum ada Sabaq tersimpan pada pekan ini."* muncul. Form input tidak terisi otomatis data palsu. Saat tombol simpan diklik tanpa konfirmasi manual, muncul validasi penolakan yang tepat.

---

## 5. Laporan Status Akun Read-Only

Berdasarkan audit pangkalan data PostgreSQL produksi:

| Username | Role | Status di Database | Status Otorisasi Sistem |
| :--- | :---: | :---: | :--- |
| `musyrif.tahfizh` | **MT** | AKTIF | **Otorisasi Penuh (Pembina Halaqoh Ust. Razan Mufli, S.Pd)** |
| `razan.mt` | **MT** | AKTIF | **Read-Only (Fail-closed: Akun demo/monitoring tanpa staff_id)** |
| `musyrifah.putri` | **MT** | AKTIF | **Read-Only (Fail-closed: Akun demo santriwati tanpa staff_id)** |
| `pembina.halaqoh` | **PH** | AKTIF | **Read-Only (Fail-closed: Akun demo pemantau halaqoh tanpa staff_id)** |

---

## 6. Hasil Quality Gates Pra-Commit

Semua perintah quality gate berhasil lolos 100% tanpa error:
- `npx prisma validate` ➔ **PASS** (Schema valid 🚀)
- `npx tsc --noEmit` ➔ **PASS** (Zero TypeScript errors)
- `npm run lint` ➔ **PASS** (Zero lint errors, zero warnings)
- `npm test` ➔ **PASS** (246 tests passed, 0 failed)
- `npm run build` ➔ **PASS** (Next.js production build succeeded)
