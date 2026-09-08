/**
 * Centralized Legal & Institutional Configuration
 * STQ Education Portal - STQ Darul Ulum Cendekia
 * Yayasan Infak Medika Nusantara
 *
 * Koreksi Identitas Resmi (Audit STQ 2026-09-08):
 * - Nama Sekolah: STQ Darul Ulum Cendekia (Singkatan: STQ DUC)
 * - Yayasan Pengelola: Yayasan Infak Medika Nusantara
 * - Karakteristik: Sekolah tahfizh full beasiswa untuk yatim dan dhuafa, didukung infak & orang tua asuh
 * - Data legalitas/kontak yang belum terverifikasi dibiarkan kosong ("") tanpa mengarang data palsu.
 */

export interface InstitutionConfig {
  schoolName: string;
  shortName: string;
  yayasanName: string;
  character: string;
  supportedBy: string;
  skKemenag: string;
  nsp: string;
  alamat: string;
  telepon: string;
  email: string;
  kota: string;
  provinsi: string;
  timeZone: string;
  mudirName: string;

  // Compatibility aliases
  readonly name: string;
  readonly pesantrenName: string;
  readonly foundation: string;
  readonly address: string;
  readonly phone: string;
  readonly city: string;
  readonly mudir: string;
  readonly isComplete: boolean;
}

export const INSTITUTION_CONFIG: InstitutionConfig = {
  schoolName: process.env.NEXT_PUBLIC_SCHOOL_NAME || "STQ Darul Ulum Cendekia",
  shortName: process.env.NEXT_PUBLIC_SHORT_NAME || "STQ DUC",
  yayasanName: process.env.NEXT_PUBLIC_YAYASAN_NAME || "Yayasan Infak Medika Nusantara",
  character: "Sekolah Tahfizh Al-Qur'an Full Beasiswa untuk Yatim dan Dhuafa",
  supportedBy: "Didukung oleh Program Infak dan Orang Tua Asuh",

  skKemenag: process.env.NEXT_PUBLIC_SK_KEMENAG || "",
  nsp: process.env.NEXT_PUBLIC_NSP || "",
  alamat: process.env.NEXT_PUBLIC_ALAMAT_SEKOLAH || "Jl. Tamangapa Raya 5, RT.003/RW.003, Tamangapa, Kec. Manggala, Kota Makassar, Sulawesi Selatan 90235",
  telepon: process.env.NEXT_PUBLIC_TELP_SEKOLAH || "085245160499",
  email: process.env.NEXT_PUBLIC_EMAIL_SEKOLAH || "",
  kota: "Makassar",
  provinsi: "Sulawesi Selatan",
  timeZone: "Asia/Makassar",
  mudirName: "Ust. Andi Quarzy Ayatullah, S.H, M.H",

  get name() { return this.schoolName; },
  get pesantrenName() { return this.schoolName; },
  get foundation() { return this.yayasanName; },
  get address() { return this.alamat; },
  get phone() { return this.telepon; },
  get city() { return this.kota; },
  get mudir() { return this.mudirName; },
  get isComplete() {
    return Boolean(this.alamat && this.telepon && this.email && this.skKemenag);
  },
};
