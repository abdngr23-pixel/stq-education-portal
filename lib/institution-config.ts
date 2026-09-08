/**
 * Centralized Legal & Institutional Configuration
 * STQ Education Portal - Pesantren Tahfizh Al-Qur'an
 *
 * Sesuai temuan A11 Audit STQ 2026-09-08:
 * Menggantikan nama contoh (Darul Ulum Cendekia) dengan identitas resmi
 * Yayasan Infak Medika Nusantara dan konfigurasi legalitas terpusat.
 */

export interface InstitutionConfig {
  yayasanName: string;
  pesantrenName: string;
  shortName: string;
  skKemenag: string;
  nsp: string;
  alamat: string;
  telepon: string;
  email: string;
  kota: string;
  provinsi: string;
  timeZone: string;
  mudirName: string;

  // Aliases for intuitive property access
  readonly name: string;
  readonly foundation: string;
  readonly address: string;
  readonly phone: string;
  readonly city: string;
  readonly mudir: string;
}

export const INSTITUTION_CONFIG: InstitutionConfig = {
  yayasanName: process.env.NEXT_PUBLIC_YAYASAN_NAME || "Yayasan Infak Medika Nusantara",
  pesantrenName: process.env.NEXT_PUBLIC_PESANTREN_NAME || "Pondok Pesantren & STQ Infak Medika Nusantara",
  shortName: process.env.NEXT_PUBLIC_SHORT_NAME || "STQ IMN",
  // Legal numbers are configurable or left empty if unverified by administrators (no fake literals)
  skKemenag: process.env.NEXT_PUBLIC_SK_KEMENAG || "SK Kemenag RI (Dalam Proses Registrasi)",
  nsp: process.env.NEXT_PUBLIC_NSP || "NSP: (Konfirmasi Sekretariat)",
  alamat: process.env.NEXT_PUBLIC_ALAMAT_PESANTREN || "Jl. Rutan No. 12, Kel. Gunung Sari, Kec. Rappocini, Kota Makassar, Sulawesi Selatan 90222",
  telepon: process.env.NEXT_PUBLIC_TELP_PESANTREN || "0812-4242-6789",
  email: process.env.NEXT_PUBLIC_EMAIL_PESANTREN || "stq@infakmedikanusantara.org",
  kota: "Makassar",
  provinsi: "Sulawesi Selatan",
  timeZone: "Asia/Makassar",
  mudirName: "Ust. Andi Quarzy Ayatullah, S.H, M.H",

  get name() { return this.pesantrenName; },
  get foundation() { return this.yayasanName; },
  get address() { return this.alamat; },
  get phone() { return this.telepon; },
  get city() { return this.kota; },
  get mudir() { return this.mudirName; },
};
