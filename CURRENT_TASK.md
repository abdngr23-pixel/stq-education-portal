# CURRENT TASK — STQ EDUCATION PORTAL

## 1. Tujuan Saat Ini
Remediasi Visual QA Pasca-Merge PR #1 (Desktop + Mobile) untuk STQ Education Portal:
1. Menghilangkan data mock/hardcoded di Modul Akademik & Print Rapor (data honesty terjamin, empty state transparan).
2. Memperbaiki responsivitas tabel Rapor Santri pada perangkat seluler (tampilan kartu tersusun/stacked tanpa pemotongan kolom).
3. Memperbaiki koordinasi layout: sticky bottom save bar presensi di atas mobile bottom navigation, scroll-offset/padding header, tab scroll horizontal, touch target $\ge 44 \times 44$ px, dan perbaikan pemotongan teks judul StatCard.
4. Desain institutional netral: kartu mufar bersih hijau `#0E7C3A` (tanpa gradien ungu slop), pengelompokan metrik dashboard musyrif dengan kontras tinggi.
5. Mempertahankan 100% aturan bisnis, ABAC fail-closed, dan proteksi regresi database/P0.1.

## 2. Baseline Commit & Git Working State
* **Repository:** `abdngr23-pixel/stq-education-portal`
* **Baseline Commit (main):** `3aff8798b306b1569b5c0b273abc2816cde11b8e` (Hasil merge PR #1)
* **Working Branch:** `review/post-merge-visual-qa` (TIDAK di-merge ke `main`, menunggu review pengawas)

## 3. Perubahan Berkas
### File Terverifikasi & Dimodifikasi
* `components/modules/akademik-module.tsx` (P0: Hapus data mock hardcoded Obama, empty state jujur; P1: Tampilan stacked card mobile rapor, tab horizontal scroll aman).
* `components/print/print-rapor.tsx` (P0: Hapus fallback hafalan hardcoded "Ali 'Imran: 1-20" -> "-", hapus fallback "MUMTAZ" -> "-", hapus "Tuntas 100%" -> "-", netralkan 6 kriteria kenaikan -> "Belum dinilai", keputusan -> "Belum ditetapkan", catatan pembina -> "Belum ada catatan pembina.").
* `components/dashboard/presensi-harian-mobile.tsx` (P1: Koordinasi floating save bar di atas bottom nav, padding bottom aman `pb-36 sm:pb-24`, peningkatan kontras teks secondary).
* `app/globals.css` (P1: `scroll-padding-top: 4rem`, `scroll-margin-top: 4.5rem`).
* `app/page.tsx` (P1: `mainScrollRef`, `scroll-pt-14 sm:scroll-pt-16`, auto-reset scroll ke atas saat beralih tab).
* `components/modules/tahfizh-module.tsx` (P1: Sub-nav tabs horizontal scroll & touch target $\ge 44$ px; P2: Kartu mufar bersih tanpa gradien ungu slop).
* `components/ui/stat-card.tsx` (P1: Ganti `truncate` dengan `line-clamp-2 break-words leading-tight` agar judul kartu tidak terpotong elipsis).
* `components/dashboard/master-data-santri.tsx` (P1: Kontras teks nomor urut dinaikkan ke `text-slate-500`, aria-label eksplisit pada tombol ikon).
* `components/dashboard/dashboard-musyrif-tahfizh.tsx` (P2: Unifikasi 4 kartu metrik menjadi 1 kontainer terstruktur, pemulihan fokus modal aksesibel).
* `components/navigation/mobile-bottom-nav.tsx` (P1: `data-testid` terstandarisasi untuk navigasi mobile).
* `tests/akademik-data-honesty.test.ts` (Baru: Uji regresi P0 integritas data akademik & responsivitas rapor).
* `scripts/capture-post-merge-qa.ts` (Baru: Script penangkapan bukti visual otomatis multi-viewport).

## 4. Status Quality Gates (100% Lulus)
- [x] `npx tsc --noEmit` (0 error)
- [x] `npm run typecheck:test` (0 error)
- [x] `npm run lint` (0 error, 0 warning)
- [x] `npm test` (332 tests lulus, 111 suites, 0 failures)
- [x] `npm run build` (Next.js 16.3.4 Turbopack berhasil dikompilasi)
- [x] `npx tsx scripts/verify-test-db-cleanup.ts` (Semua 6 skenario pembersihan DB test lulus 100%)
- [x] `npx tsx scripts/puppeteer-p0-1-verify.ts` (Seluruh 6 skenario E2E P0.1 riil lulus 100%)
- [x] `npx tsx scripts/capture-post-merge-qa.ts` (22 tangkapan layar multi-viewport berhasil diambil)
