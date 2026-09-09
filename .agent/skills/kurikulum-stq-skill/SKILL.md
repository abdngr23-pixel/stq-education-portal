---
name: kurikulum-stq-skill
description: Use this skill whenever working on features related to tahfizh, halaqoh, kenaikan juz, laporan bulanan, or any curriculum/academic logic for STQ Darul Ulum Cendekia. Encodes the pesantren's real operational rules so they aren't lost or reinvented incorrectly across sessions.
---

# Kurikulum STQ Darul Ulum Cendekia — Referensi Wajib

> **Status**: Benar per audit terakhir — 2026-09-09. Ini adalah SNAPSHOT aturan
> operasional riil, BUKAN aturan yang tidak bisa berubah selamanya.

## ATURAN OVERRIDE (baca ini dulu sebelum menerapkan apapun di bawah)
- Kalau pengguna secara EKSPLISIT menyatakan ada perubahan mekanisme/kurikulum
  (misal: "sekarang komponennya bukan 4 lagi", "target Sabqi naik jadi 5x/pekan",
  "ada metode baru selain Al-Pakistani"), PERLAKUKAN pernyataan pengguna sebagai
  BENAR dan otoritatif — jangan menolak atau "mengoreksi balik" ke isi skill ini.
- Setelah menerapkan perubahan yang dikonfirmasi pengguna, TANDAI ke pengguna bahwa
  file skill ini (`kurikulum-stq-skill/SKILL.md`) perlu diperbarui supaya sesi
  berikutnya tidak kembali memakai aturan lama. Jangan otomatis menimpa file ini
  sendiri — ajukan draf pembaruan dulu untuk dikonfirmasi.
- Skill ini adalah *pengingat konteks*, bukan sumber kebenaran mutlak yang mengalahkan
  instruksi langsung dari pengguna tentang kondisi terkini di lapangan.

## Metode Tahfizh Al-Pakistani (4 komponen — JANGAN diubah jadi "Ziyadah/Murojaah")
- **Sabaq**: hafalan baru, diukur dalam HALAMAN, target individual per santri
  (pekanan + bulanan, bukan konstanta global)
- **Sabqi**: murojaah hafalan 1 pekan terakhir, target 4x/pekan, ambang 90%/bulan
- **Manzil**: murojaah hafalan pekan-pekan sebelumnya s.d. 1 juz, target 5x/pekan, ambang 90%
- **Mufar**: murojaah harian 1-6 juz (jaga kualitas hafalan lama), target 5x/pekan, ambang 90%
- Konversi: 1 Juz = 20 Halaman (standar Mushaf Madinah)
- Skala nilai: `MUMTAZ, JAYYID_JIDDAN, JAYYID, MAQBUL, DHOIF` (BUKAN "RASYID")

## Sistem Kenaikan Juz (4 tahap berurutan)
1. Setoran Rubu' (¼ juz)
2. Tasmi' (1 juz dalam sekali duduk)
3. Ikhtibar Tahap I — diuji oleh Musyrif Tahfizh
4. Ikhtibar Tahap II — diuji oleh Mudir Tahfizh
Hasil Tahap II: **Lulus** / **Mengulang sebagian** / **Mengulang satu juz penuh**
(3 hasil berbeda, jangan disederhanakan jadi 1 status "MENGULANG" generik)

## Struktur Halaqoh (PENTING — sering salah diasumsikan)
- Halaqoh **independen dari Kelas** — satu halaqoh bisa berisi santri lintas kelas
  (VII, VIII, IX sekaligus), dikelompokkan berdasarkan level hafalan, bukan angkatan
- Mudir/KS yang menempatkan santri ke halaqoh & menugaskan musyrif penanggung jawab
  (`Halaqoh.pembinaId`) — musyrif TIDAK bisa assign dirinya sendiri
- Musyrif hanya boleh mencatat data untuk santri di halaqoh miliknya sendiri —
  ini WAJIB divalidasi di setiap Server Action yang menulis data santri

## Target Hafalan per Jenjang
| Kelas | Target |
|-------|--------|
| VII | 5-9 Juz |
| VIII | 10-14 Juz |
| IX | 15-20 Juz |
| X-XII | Hingga 30 Juz (sesuai kemampuan) |

## 7 Komponen Non-Tahfizh (WAJIB ada, bukan opsional)
Hafalan Hadits (min 4/bulan), Hafalan Mufrodat (min 12/bulan), Hafalan Vocabulary
(min 12/bulan), Sholat Tahajjud (min 15x/bulan), Sholat Dhuha (min 15x/bulan),
Puasa Sunnah (min 6x/bulan), Literasi (min 80 halaman/bulan). Field Hadits/Mufrodat/
Vocab punya HBL (Hafalan Bulan Lalu) — akumulasi carry-over lintas bulan, TIDAK reset
ke nol tiap awal bulan.

## Mata Pelajaran Kepesantrenan (Senin-Jumat, 18.30-19.30)
Bahasa Arab, **Tafsir**, Fikih, Aqidah, **Tajwid** — BUKAN "Hadits" (istilah lama
yang sudah tidak berlaku sebagai mapel Kepesantrenan)

## Program Studi Umum (Sabtu, 08.00-15.30)
Matematika & Bahasa Inggris (tetap) + PBL bergilir tiap 5 pertemuan
(Bahasa Indonesia, IPA, IPS, TIK)

## Format Laporan Bulanan (mengikuti format Excel resmi yang masih dipakai staf)
Istilah: **HBL** = Hafalan Bulan Lalu, **P1-P4** = Pekan 1 s.d. Pekan 4. Setiap
komponen direkap mingguan lalu dijumlah jadi TOTAL bulanan.
