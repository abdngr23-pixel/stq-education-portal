# CHECKPOINT P0 LANJUTAN: POSISI OTOMATIS, FILTER SETORAN SAH, & ELIMINASI WHATSAPP RUTIN

Dokumen ini merekam penyelesaian instruksi P0 Lanjutan pada commit baseline `d255621` untuk aplikasi **STQ Darul Ulum Cendekia (STQ DUC)**.

---

## 1. RINGKASAN EKSEKUTIF

Perbaikan P0 Lanjutan ini menyempurnakan alur operasional pencatatan setoran tahfizh harian dengan 6 pilar utama:
1. **Pembersihan Nilai Form Hardcoded**: Menghapus nilai awal statis `582`, `582`, `30` pada form setoran tahfizh, diganti dengan state awal kosong / *null-safe*.
2. **Sumber Kebenaran Posisi Terakhir Santri**: Posisi lanjutan hafalan baru hanya ditentukan oleh setoran jenis `SABAQ` yang sah (`status != 'DIBATALKAN'`) setelah tanggal baseline (`tanggal >= tanggalBaselineTahfizh`). Setoran jenis `SABQI`, `MANZIL`, `MUFAR`, atau dibatalkan tidak memajukan posisi hafalan baru.
3. **Pengisian Otomatis Saran Posisi SABAQ**: Satu fungsi sinkronisasi terpusat (`applySuggestedSabaqPosition`) otomatis mengisi `halamanMulai = posisiTerakhir + 1`, `halamanSelesai = halamanMulai`, dan `juz` sesuai nomor halaman mushaf. Form langsung terisi saat santri dimuat, dipilih, beralih tab ke Sabaq, setelah setoran tersimpan, maupun saat data direfresh.
4. **Penanganan Kasus Khusus Setengah Halaman (0.5 Halaman)**: Jika setoran terakhir adalah 0.5 halaman, saran halaman tetap pada nomor halaman yang sama dengan volume 0.5 hingga genap 1.0 halaman. Server secara ketat mencegah akumulasi setoran Sabaq pada satu nomor halaman melebihi kapasitas 1.0 halaman.
5. **Form Tetap Fleksibel dengan Dialog Konfirmasi**: Musyrif tetap dapat mengubah halaman secara manual. Jika input berbeda dari saran otomatis (lompat maju, pengulangan halaman yang sudah disetor, atau mundur), sistem menampilkan modal konfirmasi terperinci dan mewajibkan alasan minimal 5 karakter yang dicatat ke audit log.
6. **Eliminasi WhatsApp Rutin & Fallback Nomor Dummy**: Menghapus popup/dialog WhatsApp otomatis setelah simpan setoran harian tahfizh dan menggantinya dengan feedback sukses standar yang menampilkan posisi terkini santri. Menghapus seluruh nomor fallback dummy statis (`081234567890`) dari modul perizinan.

---

## 2. BERKAS YANG DIUBAH

| No | Berkas | Rincian Perubahan |
|---|---|---|
| 1 | `components/modules/tahfizh-module.tsx` | Menghapus default hardcoded `582`, mengimplementasikan `applySuggestedSabaqPosition`, menambahkan synchronous lock (`submitLockRef`), memperbarui modal peringatan sequence jump, menghapus `WhatsAppDialog` dan `buildSetoranTahfizhWAMessage` dari flow harian, menambahkan banner khatam 604. |
| 2 | `app/actions/santri.ts` | Memperbaiki `posisiTerakhirHalaman` agar secara eksklusif bersumber dari SABAQ aktif post-baseline, menghitung `isHalamanTerakhirParsial`, dan menyertakannya ke objek kembalian santri. |
| 3 | `app/actions/tahfizh.ts` | Menambahkan validasi kapasitas halaman $\le 1.0$ untuk SABAQ, validasi server untuk SABQI manual (`isManualSabaqi`, `alasanManualSabaqi` $\ge 5$ karakter), verifikasi kepemilikan santri pada `clientRequestId` idempotensi, dan filter `status: { not: "DIBATALKAN" }` pada `getSetoranSabaqPekanSantriAction`. |
| 4 | `components/modules/perizinan-module.tsx` | Menghapus nomor fallback dummy statis `"081234567890"`. Jika nomor HP wali kosong, sistem tidak membuka WhatsApp dan menampilkan pesan informatif. |
| 5 | `components/modules/beranda-module.tsx` | Menambahkan properti `isHalamanTerakhirParsial?: boolean` pada tipe `DashboardSantriSummary`. |
| 6 | `app/page.tsx` | Memetakan properti `isHalamanTerakhirParsial` dari server action ke modul Tahfizh. |
| 7 | `tests/p0-lanjutan-tahfizh.test.ts` | Suite unit test lengkap (16 skenario pengujian) mencakup posisi otomatis, kasus 0.5 halaman, filter sabaqi, batas 604, dan deteksi perbedaan saran. |
| 8 | `scripts/puppeteer-p0-lanjutan-verify.ts` | Skrip pengujian browser interaktif dan pengambilan screenshot bukti visual UI. |

---

## 3. FORMULA KEBENARAN POSISI TERAKHIR & SARAN SABAQ

### 3.1. Penentuan Posisi Terakhir Santri ($P$)
$$\text{SABAQ Valid} = \{ s \in \text{Setoran} \mid s.\text{status} \ne \text{"DIBATALKAN"} \land s.\text{jenis} = \text{"SABAQ"} \land s.\text{tanggal} \ge \text{BaselineDate} \}$$

- Jika $\text{SABAQ Valid} \ne \emptyset$:
  $$P = \text{halamanSelesai dari setoran SABAQ valid terbaru}$$
- Jika $\text{SABAQ Valid} = \emptyset$:
  $$P = \text{modalHafalanAwalHalaman}$$

### 3.2. Penentuan Halaman Terakhir Parsial
Halaman terakhir $P$ dinyatakan **parsial** (`isHalamanTerakhirParsial = true`) jika:
$$\sum_{s \in \text{SABAQ Valid}, s.\text{halamanSelesai} = P} s.\text{jumlahHalaman} < 1.0$$

### 3.3. Formula Saran Halaman Mulai SABAQ
$$\text{Saran Halaman} = \begin{cases} 
P & \text{jika } \text{isHalamanTerakhirParsial} = \text{true} \land P > 0 \\
604 & \text{jika } P \ge 604 \land \text{isHalamanTerakhirParsial} = \text{false} \\
1 & \text{jika } P = 0 \\
\min(604, P + 1) & \text{lainnya}
\end{cases}$$

$$\text{Saran Jumlah Halaman} = \begin{cases} 
0.5 & \text{jika } \text{isHalamanTerakhirParsial} = \text{true} \land P > 0 \\
1 & \text{lainnya}
\end{cases}$$

---

## 4. PENANGANAN KASUS 0.5 HALAMAN & KAPASITAS 1.0 HALAMAN

1. **Client**: Ketika santri menyetor 0.5 halaman (misal santri Obama setor 0.5 pada halaman 422), form berikutnya tetap berada pada halaman 422 dengan volume 0.5. Setelah setoran 0.5 kedua tersimpan (total pada 422 genap 1.0 halaman), form otomatis memajukan saran ke halaman 423 dengan volume 1.
2. **Server Enforcement (`tahfizh.ts`)**: Server menghitung volume kumulatif SABAQ aktif pada halaman terkait. Jika $\text{volume tersimpan} + \text{volume baru} > 1.0$, request ditolak dengan pesan:
   > *"Halaman {X} sudah terakumulasi {Y} halaman. Total setoran SABAQ pada satu halaman tidak boleh melebihi 1.0 halaman."*

---

## 5. FLOW KONFIRMASI PERBEDAAN SARAN (SEQUENCE JUMP WARNING)

Jika musyrif menginput nilai `halamanMulai` yang berbeda dari saran otomatis:
- **Lompat Maju (`input > saran`)**: Tampil peringatan *"Hafalan melompat dari posisi seharusnya"*.
- **Pengulangan (`input = posisiTerakhir` & tidak parsial)**: Tampil peringatan *"Mengulang halaman yang sudah disetor penuh"*.
- **Mundur (`input < posisiTerakhir`)**: Tampil peringatan *"Menyetor halaman sebelum posisi terakhir"*.
- **Persyaratan**: Menampilkan ringkasan Posisi Terakhir, Saran Otomatis, dan Halaman yang Diinput. Mewajibkan alasan tertulis minimal 5 karakter sebelum tombol *"Tetap simpan dengan alasan"* aktif. Alasan dicatat ke `AuditLog`.

---

## 6. ELIMINASI WHATSAPP SETORAN HARIAN & NOMOR DUMMY

1. **Setoran Tahfizh Harian**: Komponen `WhatsAppDialog` dan pemanggilan `buildSetoranTahfizhWAMessage` telah dihilangkan dari alur penyimpanan harian. Setelah penyimpanan berhasil, sistem menampilkan toast banner sukses:
   > *"Alhamdulillah! Setoran SABAQ untuk {Nama} ({Jml} Hlm, Juz {Juz}) berhasil disimpan. Posisi hafalan terkini: Halaman {PosisiTerbaru} ({Konversi})."*
2. **Eliminasi Fallback Dummy**: Nomor dummy `"081234567890"` dihapus sepenuhnya dari `perizinan-module.tsx`. Jika data `noHpWali` tidak tersedia, sistem tidak membuka WhatsApp dan menampilkan notifikasi: *"Nomor WhatsApp wali belum tersedia."*

---

## 7. PENCEGAHAN DOUBLE-SUBMIT (SYNCHRONOUS LOCK & IDEMPOTENCY)

1. **Client**: Menggunakan synchronous lock `submitLockRef.current = true` dan `pendingRequestIdRef.current = crypto.randomUUID()`. Setiap aksi ganti santri, ubah form, atau selesai simpan sukses akan mereset `pendingRequestIdRef.current`.
2. **Server**: Jika request dengan `clientRequestId` yang sama diterima berulang:
   - Server memverifikasi bahwa `santriId` request identik dengan `santriId` record yang sudah tersimpan.
   - Mengembalikan record yang sudah ada (*idempotent return*) tanpa menduplikasi baris database baru.

---

## 8. LAPORAN STATUS 4 AKUN PENGGUNA (READ-ONLY)

Sesuai instruksi P0, inspeksi read-only dilakukan terhadap 4 akun pengguna tanpa melakukan perubahan data pada database produksi:

| No | Username | Role User | Relasi Staff | Nama & Kode Staff | Halaqoh Dipimpin | Status Akses Operasional |
|---|---|---|---|---|---|---|
| 1 | `musyrif.tahfizh` | `MT` | ✅ Terhubung (`cmtur0qne016yiwfbmne4htn4`) | Ust. Razan Mufli, S.Pd (`STF-0003`) | Halaqoh Ust. Razan Mufli (`cmtur1j9p017siwfbw4i1w9v9`) | **Normal**. Berhak mengelola santri halaqohnya (Obama & Fardhan), input setoran tahfizh, dan melihat riwayat setoran. |
| 2 | `razan.mt` | `MT` | ❌ `null` | - | - | Dapat login sebagai MT. Karena belum terhubung ke Staff & Halaqoh, query data santri halaqoh menghasilkan daftar kosong (fail-closed ABAC). |
| 3 | `musyrifah.putri` | `MT` | ❌ `null` | - | - | Dapat login sebagai MT. Karena belum terhubung ke Staff & Halaqoh, query data santri halaqoh menghasilkan daftar kosong (fail-closed ABAC). |
| 4 | `pembina.halaqoh` | `PH` | ❌ `null` | - | - | Dapat login sebagai PH. Karena belum terhubung ke Staff & Halaqoh, query data halaqoh menghasilkan daftar kosong (fail-closed ABAC). |

*Catatan: Sesuai batasan P0, tidak ada perubahan pada `staffId`, role, halaqoh, atau data akun di atas.*

---

## 9. HASIL PENGUJIAN UNIT & VERIFIKASI BROWSER

### 9.1. Unit Test Suite (`tests/p0-lanjutan-tahfizh.test.ts`)
- **16 skenario pengujian**: Seluruh 16 tes lulus 100% tanpa kegagalan (0 fail, durasi: ~6.4 ms).
- **Total keseluruhan tes repo**: 244 tests lulus dalam 92 test suites.

### 9.2. Bukti Visual E2E Puppeteer
- `p0_lanjutan_autofill_422.png`: Membuktikan santri Obama (modal 420 + sabaq 421) secara otomatis memunculkan saran `Halaman Mulai = 422`, `Halaman Selesai = 422`, `Juz = 22`.
- `p0_lanjutan_ganti_santri.png`: Membuktikan pergantian ke santri Fardhan otomatis menyesuaikan ke posisi Fardhan (3 Hlm), dan ketika beralih kembali ke Obama langsung kembali ke posisi 421/422 tanpa residu.
- `p0_lanjutan_warning_beda_saran.png`: Membuktikan bahwa pengetikan halaman manual 582 (lompat dari 422) memunculkan dialog konfirmasi urutan halaman dengan rincian Posisi Terakhir (421), Saran Otomatis (422), dan Halaman Diinput (582) serta mewajibkan alasan tertulis $\ge 5$ karakter.
- `p0_lanjutan_no_wa_setoran.png`: Membuktikan bahwa setelah setoran halaman 422 disimpan, posisi santri langsung terbarukan menjadi 422 (+2 Hlm Sabaq), form otomatis maju menyarankan halaman 423, dan **sama sekali tidak ada dialog WhatsApp** yang mengganggu musyrif.

---

## 10. HASIL QUALITY GATES

1. `npx prisma validate`: **LULUS** (Schema valid 🚀).
2. `npx tsc --noEmit`: **LULUS** (0 type errors).
3. `npm run lint`: **LULUS** (0 errors, 0 warnings).
4. `npm test`: **LULUS** (244 passing, 0 failing).
5. `npm run build`: **LULUS** (Compiled successfully, static & dynamic routes verified).
