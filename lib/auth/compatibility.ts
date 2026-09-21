/**
 * STQ ARCHITECTURE LOCK — COMPATIBILITY LAYER
 * Transitional Bridge: Maps legacy identity and authority concepts to canonical models.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_COMPATIBILITY_MAP.md
 *  - docs/STQ_ARCHITECTURE_LOCK.md
 *  - types/architecture-lock.ts
 *
 * NON-NEGOTIABLE BOUNDARY:
 * 1. The compatibility layer is NOT permission authority by itself.
 * 2. It does NOT introduce global Role enum values for institutional positions
 *    (e.g., Kabid Tahfizh, Mudabbir, Health Officer remain Positions, never global Roles).
 * 3. Role remains coarse legacy metadata; canonical access is governed by
 *    Assignment -> Position -> Capability -> Scope.
 */

import { Role, UserSession } from "@/types/auth";
import {
  AccountType,
  OrgDomain,
  AssignmentStatus,
} from "@/types/architecture-lock";

/**
 * Baseline canonical position codes
 */
export const CANONICAL_POSITION_CODES = {
  MUDIR: "MUDIR",
  KABID_TAHFIZH: "KABID_TAHFIZH",
  MUSYRIF_TAHFIZH: "MUSYRIF_TAHFIZH",
  PEMBINA_HALAQOH: "PEMBINA_HALAQOH",
  KEPALA_KEASRAMAAN: "KEPALA_KEASRAMAAN",
  PEMBINA_ASRAMA: "PEMBINA_ASRAMA",
  PETUGAS_PRESENSI: "PETUGAS_PRESENSI",
  PETUGAS_KESEHATAN: "PETUGAS_KESEHATAN",
  ANGGOTA_OSDA: "ANGGOTA_OSDA",
  ANGGOTA_TKS: "ANGGOTA_TKS",
  GURU_AKADEMIK: "GURU_AKADEMIK",
  GURU_KEPESANTRENAN: "GURU_KEPESANTRENAN",
  STAF_ADMIN_TU: "STAF_ADMIN_TU",
  PENGURUS_YAYASAN: "PENGURUS_YAYASAN",
  WALI_SANTRI: "WALI_SANTRI",
  SANTRI: "SANTRI",
  // Aliases pointing strictly to canonical positions (never separate canonical positions)
  MUDABBIR: "PEMBINA_HALAQOH",
  MUDHABBIR: "PEMBINA_HALAQOH",
  KEPALA_SEKOLAH: "MUDIR",
} as const;

/**
 * Canonical position alias mapping.
 * Operational / business terminology aliases must not create duplicate Position records.
 * 1. PEMBINA HALAQOH = MUDHABBIR (Canonical: PEMBINA_HALAQOH)
 * 2. KEPALA SEKOLAH = MUDIR (Canonical: MUDIR)
 */
export const POSITION_ALIASES = {
  "Pembina Halaqoh": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "PEMBINA_HALAQOH": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "Mudhabbir": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "MUDHABBIR": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "Mudabbir": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "MUDABBIR": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "Pembina Kamar": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "PEMBINA_KAMAR": CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
  "Mudir": CANONICAL_POSITION_CODES.MUDIR,
  "MUDIR": CANONICAL_POSITION_CODES.MUDIR,
  "Kepala Sekolah": CANONICAL_POSITION_CODES.MUDIR,
  "KEPALA_SEKOLAH": CANONICAL_POSITION_CODES.MUDIR,
  "KS": CANONICAL_POSITION_CODES.MUDIR,
} as const;

export type CanonicalPositionCode =
  (typeof CANONICAL_POSITION_CODES)[keyof typeof CANONICAL_POSITION_CODES];

/**
 * Structural definition of a legacy role's baseline canonical mapping
 */
export interface LegacyRoleMapping {
  role: Role;
  accountType: AccountType;
  defaultPositionCode: CanonicalPositionCode;
  domain: OrgDomain;
  description: string;
}

/**
 * Explicit mapping matrix for all 10 legacy roles
 */
export const LEGACY_ROLE_MAP: Record<Role, LegacyRoleMapping> = {
  KS: {
    role: "KS",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.MUDIR,
    domain: "INSTITUTIONAL",
    description: "Kepala Sekolah / Mudir Pesantren",
  },
  ADM: {
    role: "ADM",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.STAF_ADMIN_TU,
    domain: "MANAJEMEN",
    description: "Staf Administrasi & Tata Usaha",
  },
  MK: {
    role: "MK",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
    domain: "KEASRAMAAN",
    description: "Kepala / Musyrif Keasramaan",
  },
  MT: {
    role: "MT",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH,
    domain: "TAHFIZH",
    description: "Musyrif Pengampu Halaqoh Tahfizh",
  },
  PH: {
    role: "PH",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.PEMBINA_HALAQOH,
    domain: "TAHFIZH",
    description: "Pembina Pembantu Halaqoh",
  },
  GA: {
    role: "GA",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.GURU_AKADEMIK,
    domain: "AKADEMIK",
    description: "Guru Pengajar Akademik / Mapel",
  },
  OSDA: {
    role: "OSDA",
    accountType: "UNIT",
    defaultPositionCode: CANONICAL_POSITION_CODES.ANGGOTA_OSDA,
    domain: "KEASRAMAAN",
    description: "Akun Unit / Kios Organisasi Santri Darul Ulum",
  },
  WS: {
    role: "WS",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.WALI_SANTRI,
    domain: "INSTITUTIONAL",
    description: "Wali Santri / Orang Tua",
  },
  ST: {
    role: "ST",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.SANTRI,
    domain: "INSTITUTIONAL",
    description: "Santri Mukim",
  },
  YAY: {
    role: "YAY",
    accountType: "PERSONAL",
    defaultPositionCode: CANONICAL_POSITION_CODES.PENGURUS_YAYASAN,
    domain: "INSTITUTIONAL",
    description: "Pengurus Badan Pembina / Pengawas Yayasan",
  },
};

/**
 * Proposed Assignment blueprint derived during compatibility analysis or dry-run
 */
export interface ProposedAssignmentMapping {
  positionCode: CanonicalPositionCode | string;
  unitDomain: OrgDomain;
  suggestedUnitCode: string;
  status: AssignmentStatus;
  isLeadership: boolean;
  notes: string;
  source: "ROLE_DEFAULT" | "FLAG_OVERRIDE" | "CUSTOM_EXTENSION";
}

/**
 * Resolves a UserSession into its proposed canonical position assignments.
 * Deterministic and fail-closed: preserves all legacy flags without mutating live state.
 */
export function resolveLegacySessionToProposedAssignments(
  session: UserSession
): ProposedAssignmentMapping[] {
  if (!session || !session.role) {
    return [];
  }

  const roleDef = LEGACY_ROLE_MAP[session.role];
  if (!roleDef) {
    return [];
  }

  const result: ProposedAssignmentMapping[] = [];

  // 1. Primary Baseline Position from Role
  result.push({
    positionCode: roleDef.defaultPositionCode,
    unitDomain: roleDef.domain,
    suggestedUnitCode: `unit-domain-${roleDef.domain.toLowerCase()}`,
    status: "ACTIVE",
    isLeadership: session.role === "KS" || session.role === "MK",
    notes: `Mapped from baseline legacy role ${session.role}`,
    source: "ROLE_DEFAULT",
  });

  // 2. Operational Flag: Kepala Bidang Tahfizh
  // Ust. Razan Mufli or any staff flagged as Kabid receives KABID_TAHFIZH
  if (session.isKepalaBidangTahfidz) {
    result.push({
      positionCode: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
      unitDomain: "TAHFIZH",
      suggestedUnitCode: "unit-bidang-tahfizh",
      status: "ACTIVE",
      isLeadership: true,
      notes: "Derived from legacy Staff.isKepalaBidangTahfidz flag",
      source: "FLAG_OVERRIDE",
    });
  }

  // 3. Operational Flag: Petugas Presensi Putri
  if (session.isPetugasPresensiPutri) {
    result.push({
      positionCode: CANONICAL_POSITION_CODES.PETUGAS_PRESENSI,
      unitDomain: "KEASRAMAAN",
      suggestedUnitCode: "unit-asrama-putri",
      status: "ACTIVE",
      isLeadership: false,
      notes: "Derived from legacy User.isPetugasPresensiPutri flag",
      source: "FLAG_OVERRIDE",
    });
  }

  return result;
}

/**
 * Returns all position codes associated with a legacy session
 */
export function getCanonicalPositionCodesForSession(
  session: UserSession
): string[] {
  const assignments = resolveLegacySessionToProposedAssignments(session);
  return assignments.map((a) => a.positionCode);
}

/**
 * Verifies if an arbitrary value is a recognized legacy Role
 */
export function isLegacyRole(value: unknown): value is Role {
  return typeof value === "string" && value in LEGACY_ROLE_MAP;
}

/**
 * Determines AccountType for a given legacy role
 */
export function getAccountTypeForLegacyRole(role: Role): AccountType {
  return LEGACY_ROLE_MAP[role]?.accountType || "PERSONAL";
}

export const isLegacyRoleMapped = isLegacyRole;

export function resolveLegacyRoleToCanonical(role: Role): LegacyRoleMapping {
  if (role in LEGACY_ROLE_MAP) {
    return LEGACY_ROLE_MAP[role];
  }
  return {
    role,
    accountType: "PERSONAL",
    defaultPositionCode: "UNMAPPED_LEGACY_ROLE" as CanonicalPositionCode,
    domain: "MANAJEMEN",
    description: "Unmapped legacy role",
  };
}

export function resolveUserEffectivePosition(params: {
  role: Role;
  isKepalaBidangTahfidz?: boolean;
  isPetugasPresensiPutri?: boolean;
}): {
  positionCode: CanonicalPositionCode;
  domain: OrgDomain;
  isLeadership: boolean;
} {
  if (params.isKepalaBidangTahfidz) {
    return {
      positionCode: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
      domain: "TAHFIZH",
      isLeadership: true,
    };
  }
  if (params.isPetugasPresensiPutri) {
    return {
      positionCode: CANONICAL_POSITION_CODES.PETUGAS_PRESENSI,
      domain: "KEASRAMAAN",
      isLeadership: false,
    };
  }
  const mapping = resolveLegacyRoleToCanonical(params.role);
  return {
    positionCode: mapping.defaultPositionCode,
    domain: mapping.domain,
    isLeadership: params.role === "KS" || params.role === "MK",
  };
}

