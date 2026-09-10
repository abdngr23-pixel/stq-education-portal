# Checkpoint P0.1: Koreksi Validasi Multi-Halaman, Konkurensi, dan Sabaqi Tahfizh

Dokumen ini mendokumentasikan pemenuhan seluruh instruksi perbaikan **KOREKSI P0.1 — VALIDASI MULTI-HALAMAN, KONKURENSI, DAN SABAQI** pada sistem Portal Pendidikan STQ Darul Ulum Cendekia.

---

## 1. Masalah yang Diperbaiki

1. **Multi-Page Sabaq Rejection Bug**:
   - *Masalah*: Pada implementasi sebelumnya di `app/actions/tahfizh.ts`, query pencarian kapasitas hanya mengecek `halamanMulai`, dan menjumlahkan seluruh `jmlHalaman` ke `halMulai` (`existingVolumeOnPage + jmlHalaman > 1.0`). Akibatnya, setoran sah yang mencakup lebih dari satu halaman (contoh: halaman 422–423 dengan volume 2 halaman) salah ditolak karena seolah-olah 2.0 halaman dibebankan sekaligus pada halaman 422.
   - *Solusi*: Dibuat modul murni `lib/tahfizh-page-allocation.ts` yang memecah setoran menjadi peta alokasi per halaman (e.g. 422–423 volume 2 => `{422: 1.0, 423: 1.0}`). Kapasitas diperiksa per halaman individual ($\le 1.0$).

2. **Validasi Kapasitas Halaman Tidak Atomik & Rentan Race Condition**:
   - *Masalah*: Pengecekan kapasitas dilakukan di luar transaksi DB, sehingga jika dua request datang bersamaan dari dua perangkat berbeda, keduanya bisa lolos dan mengakibatkan halaman terisi melebihi 1.0 halaman.
   - *Solusi*: Seluruh alur (pembacaan setoran aktif pasca-baseline, kalkulasi occupancy halaman, validasi kapasitas $\le 1.0$, pembuatan record setoran, dan pencatatan audit log) dibungkus ke dalam satu transaksi atomik PostgreSQL dengan `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`. Dilengkapi mekanisme retry otomatis (3 kali) jika terjadi kegagalan konkurensi (`P2034` / serialization failure) dan menyajikan pesan ramah tanpa mengekspos error teknis ke pengguna.

3. **Fallback Warisan (Modal/Weekday) pada Sabaqi**:
   - *Masalah*: Ketika santri belum memiliki catatan Sabaq aktif pada pekan berjalan, sistem masih mencoba mengambil fallback lama berbasis modal awal kumulatif atau hari dalam sepekan.
   - *Solusi*: Fallback warisan dibersihkan sepenuhnya dari `components/modules/tahfizh-module.tsx`. Jika tidak ada Sabaq sah aktif pekan ini, sistem menyajikan status informatif *"Belum ada Sabaq tersimpan pada pekan ini."* Form input tidak terisi otomatis secara keliru. Jika musyrif ingin input manual, disediakan opsi *"Gunakan Input Manual Sabaqi"* dengan syarat wajib mengisi alasan minimal 5 karakter.

4. **Pengujian Menyalin Logika Sendiri**:
   - *Masalah*: `tests/p0-lanjutan-tahfizh.test.ts` sebelumnya mendefinisikan helper dan fungsi kalkulasi sendiri yang terpisah dari kode produksi.
   - *Solusi*: Kode unit test sekarang mengimpor langsung fungsi produksi dari `lib/tahfizh-page-allocation.ts`. Seluruh 14 test cases minimal berhasil lolos 100%.

5. **Nomor WhatsApp Dummy pada Executable Scripts**:
   - *Masalah*: `prisma/seed.ts` dan `scripts/migrate-sheets-to-pg.ts` masih memiliki fallback nomor telepon dummy (`081299887766` / `081234567890`).
   - *Solusi*: Seluruh nomor telepon dummy dibersihkan menjadi `null` atau string kosong yang dinormalisasi menjadi `null`.

6. **Penanganan Halaman Terakhir Mushaf (Halaman 604 Selesai)**:
   - *Masalah*: Santri yang telah menyelesaikan halaman 604 tidak boleh ditawarkan halaman 605 atau mengisi ulang halaman 604 sebagai hafalan baru.
   - *Solusi*: Jika santri telah menyelesaikan halaman 604 (penuh), form dan tombol simpan Sabaq dinonaktifkan dengan banner resmi:
     > **Target hafalan 30 juz telah selesai. Tidak ada halaman Sabaq berikutnya.**
     Santri tetap dapat menyetorkan Sabqi, Manzil, atau Mufar untuk pemeliharaan hafalan.

---

## 2. Perubahan Implementasi

### A. Modul Alokasi Murni: `lib/tahfizh-page-allocation.ts`
- `allocateSabaqPages(halamanMulai, halamanSelesai, jumlahHalaman)`:
  - Mengonversi rentang dan volume menjadi record per halaman.
  - Memastikan volume merupakan kelipatan 0.5.
  - Halaman awal dialokasikan penuh (1.0), pecahan 0.5 dialokasikan pada halaman terakhir.
- `buildHistoricalPageOccupancy(existingSetoranList, baselineDate)`:
  - Mengagregasikan seluruh setoran SABAQ aktif (tidak termasuk `DIBATALKAN`) pasca-baseline menjadi occupancy riil per halaman.
- `validateProposedSabaqAllocation(existingSetoranList, halMulai, halSelesai, jmlHalaman, baselineDate)`:
  - Memeriksa kapasitas setiap halaman dalam rentang. Jika total occupancy melebihi 1.0, menolak dengan pesan informatif.
- `calculateLatestSabaqPosition(sabaqList, modalAwal, baselineDate)`:
  - Menghitung posisi hafalan resmi santri, mendeteksi halaman parsial (0.5), mendeteksi status khatam 30 Juz (halaman 604), dan menyarankan posisi berikutnya secara aman (tanpa menghasilkan halaman 605).

### B. Server Actions: `app/actions/tahfizh.ts`
- Validasi input SABAQ menggunakan `allocateSabaqPages`.
- Menggunakan `prisma.$transaction` dengan `Serializable` isolation level.
- Audit log dibuat di dalam transaksi atomik bersamaan dengan record setoran.
- Retry loop konkurensi (3 kali) untuk menangani konflik konkurensi serializable dengan pesan:
  *"Posisi hafalan santri baru saja diperbarui dari perangkat lain. Data telah dimuat ulang. Silakan periksa lalu simpan kembali."*
- Idempotency berbasis `clientRequestId` dipertahankan dengan aman.

### C. Komponen UI: `components/modules/tahfizh-module.tsx`
- Menghapus referensi fallback lama `hitungReferensiSabaqiKumulatif` dan `sabaqiKumulatifRef`.
- `handleApplySabaqiReference` hanya aktif jika terdapat Sabaq aktif pekan ini.
- Menambahkan penanganan khatam 30 Juz: banner status, input dinonaktifkan, tombol submit Sabaq dinonaktifkan.

---

## 3. Bukti Pengujian Unit (`tests/p0-lanjutan-tahfizh.test.ts`)

Perintah:
```bash
npx tsx --test tests/p0-lanjutan-tahfizh.test.ts
```

Hasil:
```text
▶ KOREKSI P0.1 TAHFIZH — Production Unit Tests
  ▶ 1. Alokasi Multi-Halaman & Proporsionalitas (allocateSabaqPages)
    ✔ 1. Setoran satu halaman: 422–422, volume 1 dialokasikan penuh { 422: 1.0 } (1.4691ms)
    ✔ 2. Setoran dua halaman: 422–423, volume 2 dialokasikan { 422: 1.0, 423: 1.0 } (0.2199ms)
    ✔ 3. Setoran 3, 5, dan 7 halaman dialokasikan proporsional (0.2155ms)
    ✔ 4. Setoran 2.5 halaman menjadi 1 + 1 + 0.5 (penuh-penuh-setengah pada halaman terakhir) (0.1502ms)
    ✔ 5. Penolakan volume/rentang yang tidak konsisten (0.5291ms)
  ✔ 1. Alokasi Multi-Halaman & Proporsionalitas (allocateSabaqPages) (3.6139ms)
  ▶ 2. Validasi Kapasitas Halaman Maksimal 1.0 (validateProposedSabaqAllocation)
    ✔ 6. Dua setoran 0.5 pada halaman sama diterima (0.5 + 0.5 = 1.0) (0.4816ms)
    ✔ 7. Setoran ketiga 0.5 pada halaman yang sudah penuh (1.0) ditolak (0.3494ms)
    ✔ 8. Setoran berstatus DIBATALKAN tidak menghabiskan kapasitas halaman (0.2261ms)
  ✔ 2. Validasi Kapasitas Halaman Maksimal 1.0 (validateProposedSabaqAllocation) (1.3209ms)
  ▶ 3. Perhitungan Posisi Terakhir & Rekomendasi (calculateLatestSabaqPosition)
    ✔ 9. Posisi terakhir mengambil halaman tertinggi dari alokasi sah (0.4705ms)
    ✔ 12. Santri pada halaman 604 penuh tidak mendapat saran halaman 605 (0.2656ms)
  ✔ 3. Perhitungan Posisi Terakhir & Rekomendasi (calculateLatestSabaqPosition) (0.9087ms)
  ▶ 4. Proteksi Konkurensi & Idempotensi (Concurrency Simulation)
    ✔ 10. Concurrent write tidak dapat membuat occupancy lebih dari 1.0 (0.3311ms)
    ✔ 11. Setoran ulang dengan clientRequestId yang sama tetap idempoten (0.7316ms)
  ✔ 4. Proteksi Konkurensi & Idempotensi (Concurrency Simulation) (1.3505ms)
  ▶ 5. Aturan Sabaqi & Eliminasi WhatsApp Rutin
    ✔ 13. Sabaqi tanpa Sabaq pekan ini tidak menggunakan fallback lama (0.4758ms)
    ✔ 14. Simpan setoran harian tidak membuka dialog WhatsApp (0.334ms)
  ✔ 5. Aturan Sabaqi & Eliminasi WhatsApp Rutin (1.0202ms)
✔ KOREKSI P0.1 TAHFIZH — Production Unit Tests (8.9236ms)
ℹ tests 14
ℹ suites 6
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 211.9432
```

---

## 4. Bukti Screenshot Verifikasi Browser (Puppeteer)

Dijalankan menggunakan script `scripts/puppeteer-p0-1-verify.ts` pada Google Chrome:

1. **Skenario 1 — Multi-halaman Sabaq (424–425, Volume 2 Halaman)**:
   - File: `p0_1_scenario1_multipage_422_423.png`
   - Hasil: Memilih quick add `+2 Hlm` menghasilkan halaman mulai 424 dan halaman selesai 425 secara proporsional.
2. **Skenario 2 — Setoran 0.5 Halaman**:
   - File: `p0_1_scenario2_half_page.png`
   - Hasil: Memilih quick add `+0.5 Hlm` menghasilkan halaman mulai 424 dan halaman selesai 424.
3. **Skenario 3 — Sabaqi Santri Tanpa Sabaq Pekan Ini**:
   - File: `p0_1_scenario3_sabaqi_no_fallback.png`
   - Hasil: Santri Muh. Fauzan (`SAN-0003`) tidak memiliki Sabaq pekan ini. Sistem menampilkan pesan informatif *"Belum ada Sabaq tersimpan pada pekan ini."* Opsi input manual menampilkan textarea alasan wajib $\ge 5$ karakter tanpa fallback modal/weekday.
4. **Skenario 4 — Eliminasi Dialog WhatsApp pada Setoran Harian**:
   - File: `p0_1_scenario4_no_wa_dialog.png`
   - Hasil: Form setoran harian tidak memicu modal maupun redirect WhatsApp otomatis.
5. **Skenario 5 — Penanganan Target 30 Juz Khatam (Halaman 604)**:
   - File: `p0_1_scenario5_khatam_604.png`
   - Hasil: Banner status *"Target hafalan 30 juz telah selesai. Tidak ada halaman Sabaq berikutnya."* muncul, form Sabaq dan tombol simpan dinonaktifkan.

---

## 5. Laporan Status Akun Read-Only

Berdasarkan audit pangkalan data PostgreSQL:

| Username | Role | Staff Terhubung | Halaqoh | Status Otorisasi |
| :--- | :---: | :--- | :--- | :--- |
| `musyrif.tahfizh` | **MT** | Ust. Razan Mufli, S.Pd | Halaqoh Ust. Razan Mufli, S.Pd | **Aktif (Bisa Input)** |
| `razan.mt` | **MT** | *null* | *None* | **Read-Only (Fail-closed)** |
| `musyrifah.putri` | **MT** | *null* | *None* | **Read-Only (Fail-closed)** |
| `pembina.halaqoh` | **PH** | *null* | *None* | **Read-Only (Fail-closed)** |

---

## 6. Hasil Quality Gates

- `npx prisma validate` ➔ **PASS** (Schema valid)
- `npx tsc --noEmit` ➔ **PASS** (Zero TypeScript errors)
- `npm run lint` ➔ **PASS** (Zero lint errors/warnings)
- `npm test` ➔ **PASS** (242 tests passed, 0 failed)
- `npm run build` ➔ **PASS** (Next.js production build succeeded)
