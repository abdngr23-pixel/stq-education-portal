/**
 * STQ ARCHITECTURE LOCK — BACKFILL DRY-RUN ENGINE
 * Deterministic Planning Engine for Canonical Structural Backfill.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_ARCHITECTURE_MIGRATION_PLAN.md
 *  - docs/STQ_COMPATIBILITY_MAP.md
 *  - types/architecture-lock.ts
 *
 * SAFETY INVARIANTS:
 * 1. ZERO PRODUCTION DATABASE WRITES.
 * 2. Any uncertain mapping strictly defaults to Assignment.status = 'DRAFT'
 *    and PositionCapability.businessRuleState = 'PROPOSED_TBD'.
 * 3. Never guesses or elevates production authority automatically.
 * 4. Deterministic and idempotent across runs.
 */

import {
  OrgUnitType,
  OrgDomain,
  GenderComplex,
  BusinessRuleState,
  ScopeType,
} from "@/types/architecture-lock";
import { Role } from "@/types/auth";
import { LEGACY_ROLE_MAP, CANONICAL_POSITION_CODES } from "./compatibility";

export interface LegacyUserRecord {
  id: string;
  username: string;
  role: Role;
  status: string;
  staffId?: string | null;
  santriId?: string | null;
  isKepalaBidangTahfidz?: boolean;
  isPetugasPresensiPutri?: boolean;
}

export interface ProposedOrgUnit {
  id: string;
  code: string;
  name: string;
  type: OrgUnitType;
  domain: OrgDomain;
  parentId: string | null;
  genderComplex: GenderComplex;
  isActive: boolean;
}

export interface ProposedPosition {
  id: string;
  code: string;
  name: string;
  domain: OrgDomain;
  allowedUnitTypes: OrgUnitType[];
  isLeadership: boolean;
  requiresPersonalAccount: boolean;
  isActive: boolean;
}

export interface ProposedAssignment {
  id: string;
  userId: string;
  positionCode: string;
  unitCode: string;
  status: "DRAFT"; // STRICT SAFETY: All proposed assignments strictly default to DRAFT (zero runtime authority)
  activationCandidate: boolean; // Explicitly distinguishes review eligibility from actual authoritative status
  reviewCategory: "PENDING_MANUAL_ACTIVATION" | "INACTIVE_USER_ARCHIVED" | "UNRECOGNIZED_ROLE_HOLD";
  validFrom: Date;
  validUntil: Date | null;
  confidence: "HIGH" | "MEDIUM" | "NEEDS_REVIEW";
  notes: string;
}

export interface ProposedPositionCapability {
  positionCode: string;
  capabilityCode: string;
  scopeType: ScopeType;
  businessRuleState: BusinessRuleState;
}

export interface BackfillPlanResult {
  generatedAt: Date;
  totalUsersAnalyzed: number;
  proposedOrgUnits: ProposedOrgUnit[];
  proposedPositions: ProposedPosition[];
  proposedAssignments: ProposedAssignment[];
  proposedPositionCapabilities: ProposedPositionCapability[];
  statistics: {
    totalAssignments: number;
    activeCount: number; // Strictly 0 in Milestone 2 dry-run
    draftCount: number;
    activationCandidatesCount: number;
    needsReviewCount: number;
  };
}

/**
 * Generates the baseline canonical institutional OrgUnit tree
 */
export function generateCanonicalBaselineOrgUnits(): ProposedOrgUnit[] {
  return [
    {
      id: "unit-root",
      code: "STQ_ROOT",
      name: "STQ Darul Ulum Cendekia",
      type: "INSTITUTION",
      domain: "INSTITUTIONAL",
      parentId: null,
      genderComplex: "CAMPUR",
      isActive: true,
    },
    {
      id: "unit-domain-tahfizh",
      code: "DOMAIN_TAHFIZH",
      name: "Bidang Ketahfidzhan",
      type: "DOMAIN",
      domain: "TAHFIZH",
      parentId: "unit-root",
      genderComplex: "CAMPUR",
      isActive: true,
    },
    {
      id: "unit-domain-keasramaan",
      code: "DOMAIN_KEASRAMAAN",
      name: "Bidang Keasramaan",
      type: "DOMAIN",
      domain: "KEASRAMAAN",
      parentId: "unit-root",
      genderComplex: "CAMPUR",
      isActive: true,
    },
    {
      id: "unit-domain-akademik",
      code: "DOMAIN_AKADEMIK",
      name: "Bidang Akademik",
      type: "DOMAIN",
      domain: "AKADEMIK",
      parentId: "unit-root",
      genderComplex: "CAMPUR",
      isActive: true,
    },
    {
      id: "unit-domain-manajemen",
      code: "DOMAIN_MANAJEMEN",
      name: "Bidang Manajemen & Tata Usaha",
      type: "DOMAIN",
      domain: "MANAJEMEN",
      parentId: "unit-root",
      genderComplex: "TIDAK_TERIKAT",
      isActive: true,
    },
    {
      id: "unit-asrama-putra",
      code: "ASRAMA_PUTRA",
      name: "Kompleks Asrama Putra",
      type: "ORGANIZATION",
      domain: "KEASRAMAAN",
      parentId: "unit-domain-keasramaan",
      genderComplex: "PUTRA",
      isActive: true,
    },
    {
      id: "unit-asrama-putri",
      code: "ASRAMA_PUTRI",
      name: "Kompleks Asrama Putri",
      type: "ORGANIZATION",
      domain: "KEASRAMAAN",
      parentId: "unit-domain-keasramaan",
      genderComplex: "PUTRI",
      isActive: true,
    },
  ];
}

/**
 * Generates the baseline canonical Position definitions
 */
export function generateCanonicalBaselinePositions(): ProposedPosition[] {
  return [
    {
      id: "pos-mudir",
      code: CANONICAL_POSITION_CODES.MUDIR,
      name: "Mudir / Kepala Sekolah",
      domain: "INSTITUTIONAL",
      allowedUnitTypes: ["INSTITUTION"],
      isLeadership: true,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-kabid-tahfizh",
      code: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
      name: "Kepala Bidang Tahfizh",
      domain: "TAHFIZH",
      allowedUnitTypes: ["DOMAIN"],
      isLeadership: true,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-musyrif-tahfizh",
      code: CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH,
      name: "Musyrif Tahfizh",
      domain: "TAHFIZH",
      allowedUnitTypes: ["HALAQOH", "DOMAIN"],
      isLeadership: false,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-kepala-keasramaan",
      code: CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
      name: "Kepala Keasramaan",
      domain: "KEASRAMAAN",
      allowedUnitTypes: ["DOMAIN", "ORGANIZATION"],
      isLeadership: true,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-staf-admin-tu",
      code: CANONICAL_POSITION_CODES.STAF_ADMIN_TU,
      name: "Staf Administrasi & TU",
      domain: "MANAJEMEN",
      allowedUnitTypes: ["DOMAIN", "INSTITUTION"],
      isLeadership: false,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-wali-santri",
      code: CANONICAL_POSITION_CODES.WALI_SANTRI,
      name: "Wali Santri",
      domain: "INSTITUTIONAL",
      allowedUnitTypes: ["INSTITUTION"],
      isLeadership: false,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-santri",
      code: CANONICAL_POSITION_CODES.SANTRI,
      name: "Santri",
      domain: "INSTITUTIONAL",
      allowedUnitTypes: ["INSTITUTION", "HALAQOH", "KAMAR"],
      isLeadership: false,
      requiresPersonalAccount: true,
      isActive: true,
    },
    {
      id: "pos-anggota-osda",
      code: CANONICAL_POSITION_CODES.ANGGOTA_OSDA,
      name: "Pengurus / Anggota OSDA",
      domain: "KEASRAMAAN",
      allowedUnitTypes: ["ORGANIZATION", "DIVISION"],
      isLeadership: false,
      requiresPersonalAccount: false,
      isActive: true,
    },
    {
      id: "pos-mudabbir",
      code: CANONICAL_POSITION_CODES.MUDABBIR,
      name: "Mudabbir Asrama (Pendamping Kamar)",
      domain: "KEASRAMAAN",
      allowedUnitTypes: ["KAMAR"],
      isLeadership: false,
      requiresPersonalAccount: true,
      isActive: true,
    },
  ];
}

/**
 * Generates verified baseline PositionCapability mappings
 */
export function generateCanonicalBaselineCapabilities(): ProposedPositionCapability[] {
  return [
    // Mudir
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "tahfizh.student.read",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "tahfizh.recap.read",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "tahfizh.reward.issue",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "tahfizh.policy.manage",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "health.case.read_aggregate",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "health.case.read_detail",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "health.case.create",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUDIR,
      capabilityCode: "health.case.update_status",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },

    // Kabid Tahfizh
    {
      positionCode: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
      capabilityCode: "tahfizh.student.read",
      scopeType: "DOMAIN",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
      capabilityCode: "tahfizh.recap.read",
      scopeType: "DOMAIN",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
      capabilityCode: "tahfizh.reward.issue",
      scopeType: "DOMAIN",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    // Note: tahfizh.policy.manage is intentionally NOT granted to Kabid Tahfizh (Mudir only)

    // Musyrif Tahfizh (Ordinary)
    {
      positionCode: CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH,
      capabilityCode: "tahfizh.student.read",
      scopeType: "HALAQOH",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH,
      capabilityCode: "tahfizh.setoran.create",
      scopeType: "HALAQOH",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH,
      capabilityCode: "tahfizh.recap.read",
      scopeType: "HALAQOH",
      businessRuleState: "VERIFIED_PRODUCTION",
    },

    // Kepala Keasramaan (MK)
    {
      positionCode: CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
      capabilityCode: "health.case.read_aggregate",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
      capabilityCode: "health.case.read_detail",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
      capabilityCode: "health.case.create",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
      capabilityCode: "health.case.update_status",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },

    // Admin TU (ADM)
    {
      positionCode: CANONICAL_POSITION_CODES.STAF_ADMIN_TU,
      capabilityCode: "tahfizh.recap.read",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.STAF_ADMIN_TU,
      capabilityCode: "health.case.read_aggregate",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.STAF_ADMIN_TU,
      capabilityCode: "health.case.read_detail",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.STAF_ADMIN_TU,
      capabilityCode: "health.case.create",
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    // Note: health.case.update_status is strictly DENIED to ADM

    // Wali Santri (WS)
    {
      positionCode: CANONICAL_POSITION_CODES.WALI_SANTRI,
      capabilityCode: "health.case.read_aggregate",
      scopeType: "OWN_CHILD",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.WALI_SANTRI,
      capabilityCode: "health.case.read_detail",
      scopeType: "OWN_CHILD",
      businessRuleState: "VERIFIED_PRODUCTION",
    },

    // Santri (ST)
    {
      positionCode: CANONICAL_POSITION_CODES.SANTRI,
      capabilityCode: "health.case.read_aggregate",
      scopeType: "SELF",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.SANTRI,
      capabilityCode: "health.case.read_detail",
      scopeType: "SELF",
      businessRuleState: "VERIFIED_PRODUCTION",
    },

    // Proposed TBD examples (Confer ZERO authority at runtime)
    {
      positionCode: CANONICAL_POSITION_CODES.MUDABBIR,
      capabilityCode: "health.case.create",
      scopeType: "KAMAR",
      businessRuleState: "PROPOSED_TBD",
    },
    {
      positionCode: CANONICAL_POSITION_CODES.ANGGOTA_OSDA,
      capabilityCode: "health.case.read_aggregate",
      scopeType: "UNIT",
      businessRuleState: "PROPOSED_TBD",
    },
  ];
}

/**
 * Plans deterministic backfill assignments for a set of legacy users.
 * Does NOT mutate the database.
 */
export function planBackfillAssignments(
  users: LegacyUserRecord[],
  baseDate: Date = new Date()
): BackfillPlanResult {
  const proposedOrgUnits = generateCanonicalBaselineOrgUnits();
  const proposedPositions = generateCanonicalBaselinePositions();
  const proposedPositionCapabilities = generateCanonicalBaselineCapabilities();

  const proposedAssignments: ProposedAssignment[] = [];

  let activationCandidatesCount = 0;
  let needsReviewCount = 0;

  for (const user of users) {
    const roleMapping = LEGACY_ROLE_MAP[user.role];

    if (!roleMapping) {
      // Unrecognized role -> Needs review, fail-closed
      proposedAssignments.push({
        id: `asg-unrec-${user.id}`,
        userId: user.id,
        positionCode: "UNKNOWN",
        unitCode: "STQ_ROOT",
        status: "DRAFT",
        activationCandidate: false,
        reviewCategory: "UNRECOGNIZED_ROLE_HOLD",
        validFrom: baseDate,
        validUntil: null,
        confidence: "NEEDS_REVIEW",
        notes: `Unrecognized legacy role: ${String(user.role)}. Kept as DRAFT.`,
      });
      needsReviewCount++;
      continue;
    }

    // Safety Invariant: In Milestone 2 dry-run, ALL proposed assignments strictly default to DRAFT.
    // Active legacy status marks the user as an activationCandidate for deliberate manual review,
    // NEVER as an automatically active runtime authority.
    const isUserActive = user.status === "AKTIF";
    if (isUserActive) {
      activationCandidatesCount++;
    }

    // Anchor unit mapping based on domain
    let unitCode = "STQ_ROOT";
    if (roleMapping.domain === "TAHFIZH") {
      unitCode = "DOMAIN_TAHFIZH";
    } else if (roleMapping.domain === "KEASRAMAAN") {
      unitCode = "DOMAIN_KEASRAMAAN";
    } else if (roleMapping.domain === "AKADEMIK") {
      unitCode = "DOMAIN_AKADEMIK";
    } else if (roleMapping.domain === "MANAJEMEN") {
      unitCode = "DOMAIN_MANAJEMEN";
    }

    proposedAssignments.push({
      id: `asg-${user.id}-${roleMapping.defaultPositionCode.toLowerCase()}`,
      userId: user.id,
      positionCode: roleMapping.defaultPositionCode,
      unitCode,
      status: "DRAFT",
      activationCandidate: isUserActive,
      reviewCategory: isUserActive ? "PENDING_MANUAL_ACTIVATION" : "INACTIVE_USER_ARCHIVED",
      validFrom: baseDate,
      validUntil: null,
      confidence: isUserActive ? "HIGH" : "MEDIUM",
      notes: `Deterministic mapping from legacy role ${user.role} (status: ${user.status})`,
    });

    // Handle Operational Flag: isKepalaBidangTahfidz
    if (user.isKepalaBidangTahfidz) {
      proposedAssignments.push({
        id: `asg-${user.id}-kabid-tahfizh`,
        userId: user.id,
        positionCode: CANONICAL_POSITION_CODES.KABID_TAHFIZH,
        unitCode: "DOMAIN_TAHFIZH",
        status: "DRAFT",
        activationCandidate: isUserActive,
        reviewCategory: isUserActive ? "PENDING_MANUAL_ACTIVATION" : "INACTIVE_USER_ARCHIVED",
        validFrom: baseDate,
        validUntil: null,
        confidence: "HIGH",
        notes: "Derived from Staff.isKepalaBidangTahfidz = true",
      });
      if (isUserActive) activationCandidatesCount++;
    }

    // Handle Operational Flag: isPetugasPresensiPutri
    if (user.isPetugasPresensiPutri) {
      proposedAssignments.push({
        id: `asg-${user.id}-presensi-putri`,
        userId: user.id,
        positionCode: CANONICAL_POSITION_CODES.PETUGAS_PRESENSI,
        unitCode: "ASRAMA_PUTRI",
        status: "DRAFT",
        activationCandidate: isUserActive,
        reviewCategory: isUserActive ? "PENDING_MANUAL_ACTIVATION" : "INACTIVE_USER_ARCHIVED",
        validFrom: baseDate,
        validUntil: null,
        confidence: "HIGH",
        notes: "Derived from User.isPetugasPresensiPutri = true",
      });
      if (isUserActive) activationCandidatesCount++;
    }
  }

  return {
    generatedAt: baseDate,
    totalUsersAnalyzed: users.length,
    proposedOrgUnits,
    proposedPositions,
    proposedAssignments,
    proposedPositionCapabilities,
    statistics: {
      totalAssignments: proposedAssignments.length,
      activeCount: 0, // Zero automatic active authority in dry-run
      draftCount: proposedAssignments.length,
      activationCandidatesCount,
      needsReviewCount,
    },
  };
}

export const generateProposedCanonicalState = planBackfillAssignments;

