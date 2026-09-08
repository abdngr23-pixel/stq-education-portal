import { Role } from "@prisma/client";

export { Role };

export interface UserSession {
  userId: string;
  username: string;
  role: Role;
  staffId?: string | null;
  santriId?: string | null;
  name?: string;
}

export interface AuthTokenPayload {
  sub: string;           // userId
  username: string;
  role: Role;
  staffId?: string | null;
  santriId?: string | null;
  iat?: number;
  exp?: number;
}

export const ROLE_LABELS: Record<Role, { title: string; description: string; badgeVariant: "green" | "gold" | "sky" | "orange" | "purple" | "neutral" }> = {
  YAY: {
    title: "Yayasan",
    description: "Melihat laporan strategis dan monitoring",
    badgeVariant: "purple",
  },
  KS: {
    title: "Kepala Sekolah / Mudir",
    description: "Keputusan akademik dan operasional",
    badgeVariant: "gold",
  },
  ADM: {
    title: "Admin / Tata Usaha",
    description: "Administrasi data utama dan sistem",
    badgeVariant: "sky",
  },
  MK: {
    title: "Musyrif Keasramaan",
    description: "Asrama, perizinan, atribut, dan kesehatan",
    badgeVariant: "green",
  },
  MT: {
    title: "Musyrif Tahfizh",
    description: "Halaqoh, setoran harian, dan ikhtibar",
    badgeVariant: "green",
  },
  GA: {
    title: "Guru Akademik",
    description: "Penilaian dan kurikulum akademik",
    badgeVariant: "sky",
  },
  PH: {
    title: "Pembina Halaqoh",
    description: "Pendampingan halaqoh dan kedisiplinan",
    badgeVariant: "orange",
  },
  OSDA: {
    title: "Organisasi Santri (OSDA)",
    description: "Input aktivitas keasramaan terbatas",
    badgeVariant: "neutral",
  },
  WS: {
    title: "Wali Santri",
    description: "Melihat perkembangan anak sendiri",
    badgeVariant: "sky",
  },
  ST: {
    title: "Santri",
    description: "Melihat capaian dan target pribadi",
    badgeVariant: "gold",
  },
};

/**
 * Matriks Hak Akses Modul Sesuai 05_ROLE_PERMISSION_MATRIX.md
 */
export type ModuleName =
  | "dashboard"
  | "santri"
  | "staff"
  | "halaqoh"
  | "setoran"
  | "ikhtibar"
  | "nilai"
  | "kedisiplinan"
  | "kesehatan"
  | "laporanOrtuAsuh"
  | "userManagement"
  | "auditLog";

export type AccessLevel = "NONE" | "READ" | "CRUD" | "OWN_CHILD" | "OWN_SELF";

export const PERMISSION_MATRIX: Record<ModuleName, Partial<Record<Role, AccessLevel>>> = {
  dashboard: {
    YAY: "READ",
    KS: "CRUD",
    ADM: "CRUD",
    MK: "READ",
    MT: "READ",
    GA: "READ",
    PH: "READ",
    WS: "READ",
    ST: "READ",
    OSDA: "READ",
  },
  santri: {
    YAY: "READ",
    KS: "CRUD",
    ADM: "CRUD",
    MK: "READ",
    MT: "READ",
    GA: "READ",
    PH: "READ",
    WS: "OWN_CHILD",
    ST: "OWN_SELF",
  },
  staff: {
    // Sesuai keputusan 2026-07-29: Hanya ADM dan KS
    KS: "READ",
    ADM: "CRUD",
  },
  halaqoh: {
    YAY: "READ",
    KS: "CRUD",
    ADM: "CRUD",
    MK: "READ",
    MT: "CRUD",
    PH: "CRUD",
  },
  setoran: {
    YAY: "READ",
    KS: "READ",
    ADM: "READ",
    MT: "CRUD",
    PH: "CRUD",
    WS: "OWN_CHILD",
    ST: "OWN_SELF",
  },
  ikhtibar: {
    YAY: "READ",
    KS: "CRUD",
    ADM: "READ",
    MT: "CRUD",
    PH: "READ",
    WS: "OWN_CHILD",
    ST: "OWN_SELF",
  },
  nilai: {
    YAY: "READ",
    KS: "CRUD",
    ADM: "READ",
    GA: "CRUD",
    WS: "OWN_CHILD",
    ST: "OWN_SELF",
  },
  kedisiplinan: {
    YAY: "READ",
    KS: "CRUD",
    ADM: "READ",
    MK: "CRUD",
    MT: "READ",
    PH: "CRUD",
    WS: "OWN_CHILD",
    ST: "OWN_SELF",
  },
  kesehatan: {
    KS: "READ",
    MK: "CRUD",
    PH: "READ",
    WS: "OWN_CHILD",
    ST: "OWN_SELF",
    OSDA: "CRUD",
  },
  laporanOrtuAsuh: {
    YAY: "READ",
    KS: "READ",
    ADM: "CRUD",
  },
  userManagement: {
    KS: "CRUD",
    ADM: "CRUD",
  },
  auditLog: {
    KS: "READ",
    ADM: "READ",
    YAY: "READ",
  },
};

export interface DemoAccount {
  role: Role;
  username: string;
  email: string;
  password: string;
  name: string;
  roleTitle: string;
  description: string;
  badgeVariant: "green" | "gold" | "sky" | "orange" | "purple" | "neutral";
  defaultCluster: "tahfizh" | "kesantrian" | "manajemen" | "wali" | "sistem";
  defaultTab: string;
}

export const DEMO_ACCOUNTS: Record<Role, DemoAccount> = {
  KS: {
    role: "KS",
    username: "mudir",
    email: "mudir@duc-tahfizh.sch.id",
    password: "password123",
    name: "Ust. Andi Quarzy Ayatullah, S.H, M.H",
    roleTitle: "Kepala Sekolah / Mudir",
    description: "Wewenang eksekutif tertinggi, pengesahan izin pulang, ikhtibar munaqasyah tahap 2 & kebijakan",
    badgeVariant: "gold",
    defaultCluster: "tahfizh",
    defaultTab: "tahfizh",
  },
  ADM: {
    role: "ADM",
    username: "admin",
    email: "admin@duc-tahfizh.sch.id",
    password: "password123",
    name: "Siti Aminah, S.Kom.",
    roleTitle: "Admin / Tata Usaha",
    description: "Pengelolaan sistem, pengajuan anggaran, generator surat AI, manajemen user & password reset",
    badgeVariant: "sky",
    defaultCluster: "manajemen",
    defaultTab: "administrasi",
  },
  MT: {
    role: "MT",
    username: "musyrif.tahfizh",
    email: "musyrif.tahfizh@duc-tahfizh.sch.id",
    password: "password123",
    name: "Ust. Razan Mufli, S.Pd",
    roleTitle: "Musyrif Ketahfidzhan",
    description: "Input setoran harian (Sabaq, Sabqi, Manzil), pengesahan ikhtibar tahap 1 & mutaba'ah",
    badgeVariant: "green",
    defaultCluster: "tahfizh",
    defaultTab: "tahfizh",
  },
  MK: {
    role: "MK",
    username: "musyrif.asrama",
    email: "musyrif.asrama@duc-tahfizh.sch.id",
    password: "password123",
    name: "Ust. Mujaddid Zhohruddin",
    roleTitle: "Musyrif Keasramaan",
    description: "Persetujuan izin lokal santri, pencatatan pelanggaran (Poin x2), SP1-SP3 & logistik asrama",
    badgeVariant: "green",
    defaultCluster: "kesantrian",
    defaultTab: "kesantrian",
  },
  GA: {
    role: "GA",
    username: "guru.akademik",
    email: "guru@duc-tahfizh.sch.id",
    password: "password123",
    name: "Ustzh. Nurul Hidayah, S.Pd.",
    roleTitle: "Guru Akademik",
    description: "Input nilai mata pelajaran (angka otomatis predikat A-D), cetak rapor santri & agenda",
    badgeVariant: "sky",
    defaultCluster: "tahfizh",
    defaultTab: "akademik",
  },
  WS: {
    role: "WS",
    username: "walisantri",
    email: "wali.fatih@gmail.com",
    password: "password123",
    name: "Hendra Wijaya (Wali Santri Fatih)",
    roleTitle: "Wali Santri",
    description: "Portal Wali: Monitoring setoran juz anak, status SPP/infaq & pengajuan izin santri",
    badgeVariant: "sky",
    defaultCluster: "wali",
    defaultTab: "portal_wali",
  },
  ST: {
    role: "ST",
    username: "santri.fatih",
    email: "fatih@duc-tahfizh.sch.id",
    password: "password123",
    name: "Muhammad Fatih Al-Ayyubi",
    roleTitle: "Santri",
    description: "Portal Mandiri Santri: Melihat capaian hafalan pribadi, target juz & agenda harian",
    badgeVariant: "gold",
    defaultCluster: "wali",
    defaultTab: "portal_wali",
  },
  YAY: {
    role: "YAY",
    username: "yayasan",
    email: "yayasan@duc-tahfizh.sch.id",
    password: "password123",
    name: "Drs. H. Muhammad Arifin",
    roleTitle: "Pengurus Yayasan",
    description: "Monitoring strategis pesantren, transparansi laporan donatur, anggaran & audit log",
    badgeVariant: "purple",
    defaultCluster: "manajemen",
    defaultTab: "administrasi",
  },
  PH: {
    role: "PH",
    username: "pembina.halaqoh",
    email: "pembina@duc-tahfizh.sch.id",
    password: "password123",
    name: "Ust. Kamal",
    roleTitle: "Mudhabbir (Pembina Halaqoh)",
    description: "Pendampingan halaqoh Al-Qur'an, pemantauan adab santri & monitoring kedisiplinan",
    badgeVariant: "orange",
    defaultCluster: "tahfizh",
    defaultTab: "tahfizh",
  },
  OSDA: {
    role: "OSDA",
    username: "osda",
    email: "osda@duc-tahfizh.sch.id",
    password: "password123",
    name: "Rayyan Al-Ghifari (Ketua OSDA)",
    roleTitle: "Organisasi Santri (OSDA)",
    description: "Input poskestren santri sakit, pencatatan mutasi logistik barang asrama",
    badgeVariant: "neutral",
    defaultCluster: "kesantrian",
    defaultTab: "kesehatan",
  },
};

export const ROLE_PERMITTED_CLUSTERS: Record<Role, Array<"tahfizh" | "kesantrian" | "manajemen" | "wali" | "sistem">> = {
  KS: ["tahfizh", "kesantrian", "manajemen", "wali", "sistem"],
  ADM: ["tahfizh", "kesantrian", "manajemen", "wali", "sistem"],
  MT: ["tahfizh", "kesantrian"],
  MK: ["kesantrian"],
  GA: ["tahfizh", "manajemen"],
  PH: ["tahfizh", "kesantrian"],
  OSDA: ["kesantrian"],
  WS: ["wali"],
  ST: ["wali"],
  YAY: ["tahfizh", "manajemen", "sistem"],
};

export const ROLE_PERMITTED_TABS: Record<Role, string[]> = {
  KS: [
    "data_santri",
    "tahfizh", "akademik", "ikhtibar",
    "kesantrian", "kedisiplinan", "kesehatan", "logistik",
    "administrasi", "surat", "sponsor", "agenda",
    "portal_wali",
    "users", "audit"
  ],
  ADM: [
    "data_santri",
    "tahfizh", "akademik", "ikhtibar",
    "kesantrian", "kedisiplinan", "kesehatan", "logistik",
    "administrasi", "surat", "sponsor", "agenda",
    "portal_wali",
    "users", "audit"
  ],
  MT: ["data_santri", "tahfizh", "akademik", "ikhtibar", "kedisiplinan"],
  MK: ["data_santri", "kesantrian", "kedisiplinan", "kesehatan", "logistik"],
  GA: ["data_santri", "akademik", "agenda"],
  PH: ["data_santri", "tahfizh", "kedisiplinan"],
  OSDA: ["kesehatan", "logistik"],
  WS: ["portal_wali"],
  ST: ["portal_wali"],
  YAY: ["data_santri", "tahfizh", "akademik", "administrasi", "sponsor", "audit"],
};

/**
 * Cek apakah role memiliki izin akses modul
 */
export function hasModuleAccess(role: Role, module: ModuleName, requiredLevel: "READ" | "CRUD"): boolean {
  const level = PERMISSION_MATRIX[module]?.[role];
  if (!level) return false;
  if (level === "CRUD") return true;
  if (level === "READ" && requiredLevel === "READ") return true;
  return false;
}

