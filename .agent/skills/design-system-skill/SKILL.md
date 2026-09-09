---
name: design-system-skill
description: Use this skill whenever building or modifying UI components, pages, or styling for the STQ Education Portal. Ensures visual consistency with the established pesantren design system.
---

# Design System Skill — STQ Education Portal

## Palet Warna
- `--color-primary` Emerald `#0E7C3A` — aksi utama, navbar, tombol primer
- `--color-accent` Gold `#C9990E` — HANYA untuk elemen apresiasi (Bintang Kebaikan,
  badge kelulusan juz, progres hafalan). JANGAN dipakai sebagai warna dekoratif umum.
- `--color-canvas` sky-50 — background HALAMAN, bukan background kartu (kartu tetap putih)
- Warna danger/sanksi: merah yang tenang (bukan merah alarm terang) — nuansa pembinaan,
  bukan hukuman

## Komponen Reusable (jangan duplikat versi berbeda per halaman)
- **Metric Card**: label 11-13px abu-abu di atas, angka besar (18-24px medium weight) di bawah
- **Kartu Santri**: avatar/inisial, nama, halaqoh/kelas, status terakhir — dipakai ulang
  di dashboard Musyrif, Wali Santri, Guru Akademik
- **Badge status**: varian warna berbeda per predikat (Mumtaz/Jayyid Jiddan/Jayyid/
  Maqbul/Dhoif), kontras teks harus benar (bukan hitam polos di atas warna gelap)

## Navigasi
- Dual-Tier Navigation: tier atas identitas+role switcher, tier bawah menu modul
  dengan ikon konsisten (satu ikon = satu makna, tidak berubah antar halaman)
- Bottom Navigation mobile (≤390px): MAKSIMAL 4 item utama, sisanya masuk "Lainnya"

## Mode Cetak
Dokumen resmi (rapor, SP, surat) pakai layout A4 print-only TERPISAH dari mode layar
— hitam-putih/kop formal, JANGAN pakai palet emerald/gold di dokumen cetak resmi.

## Tipografi
Sans-serif netral (Inter/Poppins) untuk UI layar. Hindari font dekoratif Arab-style
di UI — cukup di kop surat cetak.
