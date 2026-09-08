import { Role } from "@/types/auth";
import {
  Home,
  Users,
  BookCheck,
  GraduationCap,
  CheckCircle2,
  Send,
  AlertTriangle,
  Stethoscope,
  Package,
  DollarSign,
  HeartHandshake,
  FileText,
  Calendar,
  UserCog,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * 15 ID Menu Utama Terstandarisasi STQ Darul Ulum Cendekia
 * Sesuai Prinsip: Satu fungsi memiliki satu lokasi utama.
 */
export type AppNavId =
  | "beranda"
  | "data_santri"
  | "tahfizh"
  | "akademik"
  | "presensi"
  | "perizinan"
  | "kedisiplinan"
  | "kesehatan"
  | "logistik"
  | "anggaran"
  | "sponsor"
  | "surat"
  | "kalender"
  | "users"
  | "audit"
  | "portal_wali";

export type NavCategory =
  | "utama"
  | "tahfizh_akademik"
  | "kesantrian"
  | "manajemen"
  | "sistem";

export interface NavItemDef {
  id: AppNavId;
  label: string;
  icon: LucideIcon;
  category: NavCategory;
  shortDesc: string;
}

/**
 * Definisi Lengkap 15 Menu Terstandarisasi
 */
export const ALL_NAV_ITEMS: Record<AppNavId, NavItemDef> = {
  beranda: {
    id: "beranda",
    label: "Beranda",
    icon: Home,
    category: "utama",
    shortDesc: "Ringkasan kerja & agenda hari ini",
  },
  data_santri: {
    id: "data_santri",
    label: "Data Santri",
    icon: Users,
    category: "tahfizh_akademik",
    shortDesc: "Master data santri & halaqoh",
  },
  tahfizh: {
    id: "tahfizh",
    label: "Tahfizh",
    icon: BookCheck,
    category: "tahfizh_akademik",
    shortDesc: "Setoran, rekap bulanan & ikhtibar",
  },
  akademik: {
    id: "akademik",
    label: "Akademik",
    icon: GraduationCap,
    category: "tahfizh_akademik",
    shortDesc: "Nilai kurikulum & cetak rapor",
  },
  presensi: {
    id: "presensi",
    label: "Presensi",
    icon: CheckCircle2,
    category: "kesantrian",
    shortDesc: "Presensi sholat, halaqoh & ibadah",
  },
  perizinan: {
    id: "perizinan",
    label: "Perizinan",
    icon: Send,
    category: "kesantrian",
    shortDesc: "Pengajuan & antrean izin santri",
  },
  kedisiplinan: {
    id: "kedisiplinan",
    label: "Kedisiplinan",
    icon: AlertTriangle,
    category: "kesantrian",
    shortDesc: "Pelanggaran santri, poin & SP",
  },
  kesehatan: {
    id: "kesehatan",
    label: "Kesehatan",
    icon: Stethoscope,
    category: "kesantrian",
    shortDesc: "Poskestren & rekam medis santri",
  },
  logistik: {
    id: "logistik",
    label: "Logistik",
    icon: Package,
    category: "kesantrian",
    shortDesc: "Inventaris & mutasi stok asrama",
  },
  anggaran: {
    id: "anggaran",
    label: "Anggaran",
    icon: DollarSign,
    category: "manajemen",
    shortDesc: "Pengajuan kebutuhan operasional",
  },
  sponsor: {
    id: "sponsor",
    label: "Orang Tua Asuh",
    icon: HeartHandshake,
    category: "manajemen",
    shortDesc: "Laporan donatur beasiswa santri",
  },
  surat: {
    id: "surat",
    label: "Surat",
    icon: FileText,
    category: "manajemen",
    shortDesc: "Pembuatan draf surat resmi",
  },
  kalender: {
    id: "kalender",
    label: "Kalender",
    icon: Calendar,
    category: "manajemen",
    shortDesc: "Agenda kegiatan pesantren",
  },
  users: {
    id: "users",
    label: "Pengguna",
    icon: UserCog,
    category: "sistem",
    shortDesc: "Manajemen akun & kata sandi",
  },
  audit: {
    id: "audit",
    label: "Riwayat Aktivitas",
    icon: ShieldCheck,
    category: "sistem",
    shortDesc: "Log audit transaksi & kepatuhan",
  },
  portal_wali: {
    id: "portal_wali",
    label: "Portal Santri",
    icon: Users,
    category: "utama",
    shortDesc: "Perkembangan santri & setoran anak",
  },
};

export const CATEGORY_LABELS: Record<NavCategory, string> = {
  utama: "Utama",
  tahfizh_akademik: "Ketahfidzhan & Nilai",
  kesantrian: "Kesantrian & Asrama",
  manajemen: "Manajemen & Kantor",
  sistem: "Sistem & Keamanan",
};

/**
 * Pemetaan Menu yang Diizinkan per Role (RBAC)
 */
export const ROLE_NAV_MAP: Record<Role, AppNavId[]> = {
  KS: [
    "beranda",
    "data_santri",
    "tahfizh",
    "akademik",
    "presensi",
    "perizinan",
    "kedisiplinan",
    "kesehatan",
    "logistik",
    "anggaran",
    "sponsor",
    "surat",
    "kalender",
    "users",
    "audit",
  ],
  ADM: [
    "beranda",
    "data_santri",
    "tahfizh",
    "akademik",
    "presensi",
    "perizinan",
    "kedisiplinan",
    "kesehatan",
    "logistik",
    "anggaran",
    "sponsor",
    "surat",
    "kalender",
    "users",
    "audit",
  ],
  MT: [
    "beranda",
    "tahfizh",
    "presensi",
    "data_santri",
    "akademik",
    "kedisiplinan",
  ],
  PH: [
    "beranda",
    "tahfizh",
    "presensi",
    "data_santri",
    "kedisiplinan",
  ],
  MK: [
    "beranda",
    "presensi",
    "perizinan",
    "kedisiplinan",
    "kesehatan",
    "logistik",
    "data_santri",
  ],
  GA: [
    "beranda",
    "akademik",
    "data_santri",
    "kalender",
  ],
  OSDA: [
    "beranda",
    "kesehatan",
    "logistik",
  ],
  YAY: [
    "beranda",
    "tahfizh",
    "akademik",
    "kedisiplinan",
    "anggaran",
    "sponsor",
    "data_santri",
    "audit",
  ],
  WS: [
    "beranda",
    "portal_wali",
    "tahfizh",
    "perizinan",
  ],
  ST: [
    "beranda",
    "portal_wali",
    "tahfizh",
    "perizinan",
  ],
};

/**
 * Navigasi HP Cepat (Mobile Bottom Bar):
 * Maksimal 4 tab utama + 1 tombol "Lainnya" sesuai tugas spesifik tiap role.
 */
export const ROLE_MOBILE_PRIMARY: Record<Role, AppNavId[]> = {
  MT: ["beranda", "tahfizh", "presensi", "data_santri"],
  PH: ["beranda", "tahfizh", "presensi", "data_santri"],
  MK: ["beranda", "presensi", "perizinan", "kedisiplinan"],
  GA: ["beranda", "akademik", "data_santri", "kalender"],
  KS: ["beranda", "tahfizh", "perizinan", "anggaran"],
  ADM: ["beranda", "data_santri", "surat", "anggaran"],
  YAY: ["beranda", "tahfizh", "anggaran", "sponsor"],
  OSDA: ["beranda", "kesehatan", "logistik"],
  WS: ["beranda", "portal_wali", "tahfizh", "perizinan"],
  ST: ["beranda", "portal_wali", "tahfizh", "perizinan"],
};

/**
 * Normalisasi URL Tab lama ke NavId baru demi kompatibilitas penuh tautan lama
 */
export function normalizeNavTab(rawTab: string | null | undefined): AppNavId {
  if (!rawTab) return "beranda";
  const map: Record<string, AppNavId> = {
    beranda: "beranda",
    data_santri: "data_santri",
    tahfizh: "tahfizh",
    akademik: "akademik",
    presensi: "presensi",
    kesantrian: "perizinan", // kompatibilitas lama
    perizinan: "perizinan",
    kedisiplinan: "kedisiplinan",
    kesehatan: "kesehatan",
    logistik: "logistik",
    administrasi: "anggaran", // kompatibilitas lama
    anggaran: "anggaran",
    sponsor: "sponsor",
    surat: "surat",
    agenda: "kalender", // kompatibilitas lama
    kalender: "kalender",
    users: "users",
    audit: "audit",
    portal_wali: "portal_wali",
    ikhtibar: "tahfizh", // ikhtibar disatukan di tab Tahfizh
  };
  return map[rawTab] || "beranda";
}

export function isNavPermitted(tab: AppNavId, role: Role): boolean {
  if (tab === "beranda") return true;
  return ROLE_NAV_MAP[role]?.includes(tab) ?? false;
}

