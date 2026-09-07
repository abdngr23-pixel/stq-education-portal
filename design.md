# STQ Darul Ulum Cendekia — UI/UX Design Specification (design.md)
*Disusun untuk implementasi Web App (Google Apps Script, Tailwind CSS, HTML Service / IDE Gemini Flash)*

---

## 1. Project Overview & Context
- **Nama Produk:** STQ Education Portal (STQ Darul Ulum Cendekia)
- **Fokus Modul MVP Saat Ini:** 
  1. **Dashboard Ringkasan (Musyrif & Pengelola)**
  2. **Form Input Setoran Tahfizh (Mobile-first Quick Entry)**
- **Target Platform:** Mobile-First Web App (Responsive viewport ~390px-430px optimal, scalable ke desktop), Tailwind CSS, GAS HTML Service.
- **Karakter Visual:** Modern Islamic Academic, clean, terpercaya, sejuk (*Deep Emerald Green*, *Warm Neutral Slate*, *Soft Sage accents*).

---

## 2. Design Tokens & Visual Hierarchy

### Color Palette (Tailwind Mappings)
- **Primary (Emerald Deep):** `bg-emerald-800` (#065F46) / `bg-emerald-700` (#047857) — Header portal, tombol utama CTA, navigasi aktif.
- **Primary Accent / Light:** `bg-emerald-50` (#ECFDF5), `text-emerald-700` (#047857), `border-emerald-200` — Highlight card, active pill, status mutqin.
- **Secondary / Warm Sand:** `bg-amber-50` (#FFFBEB), `text-amber-800` (#92400E), `border-amber-200` — Status muroja'ah/perhatian khusus.
- **Surface & Background:**
  - Base App: `bg-slate-50` (#F8FAFC)
  - Card / Modal Surface: `bg-white` (#FFFFFF) with `border border-slate-100` / `border-slate-200`
  - Shadow: `shadow-xs` hingga `shadow-sm` untuk performa ringan di mobile browser & GAS.
- **Typography Colors:**
  - Title & Heading: `text-slate-900` (#0F172A)
  - Body & Label: `text-slate-700` (#334155)
  - Muted / Caption / Timestamp: `text-slate-400` (#94A3B8)
- **Status Badges (Tahfizh Grading):**
  - **Mutqin (Lancar / Istimewa):** `bg-emerald-100 text-emerald-800 border-emerald-300`
  - **Jayyid Jiddan / Jayyid (Baik / Cukup):** `bg-blue-100 text-blue-800 border-blue-200`
  - **Dho'if / Perlu Ulang:** `bg-rose-100 text-rose-800 border-rose-200`

### Typography & Spacing System
- **Font Family:** `font-sans` ('Plus Jakarta Sans', 'Inter', system-ui)
- **Hierarchy:**
  - Page Titles: `text-xl font-bold tracking-tight`
  - Section Titles: `text-base font-semibold text-slate-900`
  - Card Headings / Santri Names: `text-sm font-semibold text-slate-800`
  - Body & Form Labels: `text-xs font-medium text-slate-600`
  - Meta Info / Subtext: `text-[11px] text-slate-400`
- **Component Radii:** `rounded-xl` (12px) untuk cards dan input field, `rounded-2xl` (16px) untuk container header & floating sheets.

---

## 3. Screen Specifications

### A. Screen 1: Dashboard Musyrif & Halaqoh (Mobile View)
1. **Header Bar:**
   - Profil Singkat STQ Darul Ulum Cendekia + Foto/Inisial Ustadz/Musyrif aktif + Notifikasi & Badge Halaqoh (misal: "Halaqoh Utsman bin Affan").
2. **Statistik Cepat (KPI Metric Cards):**
   - Santri Hadir Hari Ini (misal: 14 / 15 Santri)
   - Total Setoran Masuk Hari Ini (Ziyadah & Muroja'ah)
   - Rata-rata Kelancaran (Mutqin Rate: 88%)
3. **Aksi Cepat (Quick Action CTA):**
   - Tombol menonjol: `+ Input Setoran Baru` (membuka form setoran cepat).
   - Filter switch: "Hari Ini" | "Pekan Ini".
4. **Daftar Santri & Status Setoran Terkini (Live Feed List):**
   - List santri dalam halaqoh:
     - Avatar santri, nama lengkap, NISN/ID.
     - Terakhir setoran: Surah & Ayat, Jenis (Ziyadah/Muroja'ah).
     - Badge status mutu (Mutqin / Jayyid).
     - Tombol cepat rekam setoran `+ Setor` per santri.

### B. Screen 2: Form Input Setoran Tahfizh (Quick Mobile Entry)
Dirancang khusus untuk kecepatan input Musyrif saat menyimak hafalan:
1. **Header Form:**
   - Navigasi kembali (`< Dashboard`), Judul "Catat Setoran Tahfizh", indikator tanggal & sesi waktu (Shubuh / Ashar / Maghrib).
2. **Pilih Santri:**
   - Dropdown pencarian santri atau quick chips nama santri halaqoh.
3. **Tipe Setoran:**
   - Segmented control: `[ Ziyadah (Hafalan Baru) ]` | `[ Muroja'ah (Pengulangan) ]` | `[ Tasmi' / Ujian ]`.
4. **Detail Hafalan (Surah, Ayat, Juz):**
   - Pilihan Nama Surah (misal: An-Naba', Al-Baqarah, dsb).
   - Input Ayat Dari & Sampai (`Ayat [ 1 ] s/d [ 20 ]`).
   - Indikator otomatis Juz & Halaman.
5. **Penilaian Kualitas Bacaan:**
   - Tajwid & Makharijul Huruf: Rating / Pilihan Mutqin | Jayyid | Perlu Latihan.
   - Kelancaran Kelancaran: Skala 1 - 100 atau Grade A/B/C.
   - Catatan Khusus Musyrif: Textarea singkat (misal: *"Hati-hati dengung ikhfa di ayat 15"*).
6. **Footer Action Bar:**
   - Tombol Sticky: `Simpan & Lanjut Santri Berikutnya` (Outline) dan `Simpan Setoran` (Primary solid emerald).
   - Notifikasi tersimpan ke Google Sheets / Database secara real-time.

---

## 4. Guidelines untuk Antigravity IDE Gemini Flash 3.8
- **Struktur File GAS:**
  - `Index.html`: Template utama include header Tailwind CDN + script interaksi.
  - `Dashboard.html`: Partial view komponen dashboard.
  - `FormSetoran.html`: Partial view form modal / screen input tahfizh.
  - `Code.gs`: Handler fungsi backend (`doGet`, `simpanSetoran(data)`, `ambilDataHalaqoh()`).
- Gunakan event listener sederhana (vanilla JS) agar ringan dieksekusi dalam Google Apps Script web app modal / standalone page.
