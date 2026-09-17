/**
 * STQ ARCHITECTURE LOCK — CANONICAL TYPE DEFINITIONS
 * Final Contract Closure: Normalized Identity, OrgUnit, Position, Assignment, Capability, Scope, and Health
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * Document Reference: docs/STQ_ARCHITECTURE_LOCK.md
 * Status: ARCHITECTURE_LOCKED
 * Approved Baseline Date: 2026-09-17
 *
 * HIERARCHY OF AUTHORITY & PRECEDENCE RULES:
 * 1. Technical Contract Authority: types/architecture-lock.ts defines the canonical compile-time
 *    and runtime interfaces, data shapes, enums, and engine signatures.
 * 2. Master Architecture Boundary: docs/STQ_ARCHITECTURE_LOCK.md defines the approved system
 *    invariants, non-negotiable boundaries, and structural hierarchy.
 * 3. Business Policy Authority: Capabilities and role-grant matrices are governed by their explicit
 *    BusinessRuleState. Entries marked PROPOSED_TBD are illustrative technical placeholders and do
 *    NOT constitute approved institutional policy.
 * 4. Specialized Deep-Dives: Subordinate documents (STQ_*.md) inherit from Levels 1, 2, and 3.
 */

import { UserSession } from "./auth";

/**
 * High-level institutional structure domains within STQ Darul Ulum Cendekia
 * Health and TKS are structurally enclosed under KEASRAMAAN.
 */
export type OrgDomain =
  | "INSTITUTIONAL"
  | "TAHFIZH"
  | "KEASRAMAAN"
  | "AKADEMIK"
  | "MANAJEMEN";

/**
 * Functional capability namespaces for authorization codes (<namespace>.<entity>.<action>)
 * Decoupled from structural OrgDomain.
 */
export type CapabilityNamespace =
  | "TAHFIZH"
  | "KEASRAMAAN"
  | "HEALTH"
  | "ACADEMIC"
  | "LOGISTICS"
  | "FINANCE"
  | "LETTERS"
  | "SPONSOR"
  | "SYSTEM";

/**
 * Three-state business rule categorization preventing speculative policies from being locked
 */
export type BusinessRuleState =
  | "VERIFIED_PRODUCTION"                  // Observed & verified in current live production
  | "APPROVED_TARGET_PENDING_TECHNICAL"    // Formally approved target policy, pending technical rollout
  | "PROPOSED_TBD";                        // Proposed design, pending Business Owner approval

/**
 * Canonical Organizational Unit classification within the institutional tree
 * Exactly ONE normalized vocabulary across all system layers.
 */
export type OrgUnitType =
  | "INSTITUTION"     // STQ Darul Ulum Cendekia (Root)
  | "DOMAIN"          // Ketahfidzhan, Keasramaan, Akademik, Manajemen
  | "ORGANIZATION"    // Overarching bodies e.g. OSDA (Organisasi Santri), TKS (Tugas Khusus Santri)
  | "DIVISION"        // Sub-bodies e.g. OSDA Divisions (Keamanan, Ibadah, Kesehatan, dll.)
  | "HALAQOH"         // Qur'an Halaqoh (authoritative records backfilled from Halaqoh table)
  | "KAMAR"           // Asrama Rooms (authoritative dormitory structure)
  | "SERVICE_UNIT"    // TKS Units (Dapur, Masjid, Air Minum, Air Sumur, dll.)
  | "USROH"           // Cleaning taskforces under OSDA (cleanliness functionally supervised by Divisi Kebersihan)
  | "ACADEMIC_CLASS"; // Classes (7A, 7B, 8A, dll.)

/**
 * Technical credential account classification
 */
export type AccountType = "PERSONAL" | "UNIT";

/**
 * Gender complex boundary enforcement for organizational units
 */
export type GenderComplex = "PUTRA" | "PUTRI" | "CAMPUR" | "TIDAK_TERIKAT";

/**
 * Canonical Organizational Unit model representation
 */
export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  type: OrgUnitType;
  domain: OrgDomain;
  parentId: string | null; // Canonical parent unit identifier
  genderComplex: GenderComplex;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Position (Jabatan / Peran Fungsional)
 * Position is an organizational template, distinct from technical credential categories.
 */
export interface Position {
  id: string;
  code: string;
  name: string;
  domain: OrgDomain;
  allowedUnitTypes: OrgUnitType[];
  isLeadership: boolean;
  requiresPersonalAccount: boolean;
  isActive: boolean;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Unit Account Placement Binding
 * Business invariant: AccountType.UNIT belongs to exactly ONE operational placement unit.
 */
export interface UnitAccountPlacement {
  id: string;
  userId: string;
  unitId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Canonical Scope Types for fine-grained authorization containment
 * Capability is evaluated BEFORE scope.
 * GLOBAL does NOT mean unrestricted access; it means institutional scope for the granted capability.
 */
export type ScopeType =
  | "GLOBAL"          // Institutional breadth for the specific granted capability (Mudir, Yayasan)
  | "DOMAIN"          // Entire domain breadth (e.g. Kabid Tahfizh across all halaqoh for supervision)
  | "UNIT"            // Specific organizational unit of assignment
  | "ASSIGNED_UNITS"  // Set of specific units bound relationally via AssignmentScopeUnit
  | "HALAQOH"         // Own halaqoh binaan (Musyrif Tahfizh)
  | "KAMAR"           // Own kamar asrama binaan (Mudabbir)
  | "OWN_CHILD"       // Relationally linked children of guardian (Wali Santri)
  | "SELF";           // Personal record of the authenticated subject (Santri/Staff)

/**
 * Lifecycle states of an Assignment
 */
export type AssignmentStatus =
  | "DRAFT"      // Proposed assignment, not yet authoritative
  | "ACTIVE"     // Currently active and granting authority within valid window
  | "SUSPENDED"  // Temporarily suspended (e.g. leave, investigation)
  | "EXPIRED"    // Naturally reached validUntil timestamp
  | "REVOKED";   // Explicitly terminated administratively

/**
 * Canonical Assignment
 * Connects an Identity (User) to a Position within an OrgUnit.
 * Scope is NOT stored on Assignment; PositionCapability.scopeType is the single source of truth.
 */
export interface Assignment {
  id: string;
  userId: string; // Foreign key to User (technical identity / principal)
  positionId: string;
  unitId: string; // Anchor organizational unit
  status: AssignmentStatus;
  validFrom: Date;
  validUntil?: Date | null;
  notes?: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Relational Scope Unit Binding
 * Supplies additional permitted unit IDs when PositionCapability.scopeType is ASSIGNED_UNITS.
 */
export interface AssignmentScopeUnit {
  id: string;
  assignmentId: string;
  unitId: string;
  createdAt: Date;
}

/**
 * Relational Position-Capability Mapping with fine-grained Scope and Grant Lifecycle State
 * Single source of truth for scopeType per capability and lifecycle state of the grant.
 */
export interface PositionCapability {
  id: string;
  positionId: string;
  capabilityCode: string;
  scopeType: ScopeType;
  businessRuleState: BusinessRuleState;
}

/**
 * Resolved capability grant derived from an active assignment and its position capabilities
 */
export interface EffectiveCapabilityGrant {
  assignmentId: string;
  positionCode: string;
  capabilityCode: string;
  scopeType: ScopeType;
  anchorUnitId: string;
  unitIds: string[];
  businessRuleState: BusinessRuleState;
}

/**
 * Fine-grained Capability definition (Pure semantic action definition)
 * Format: <namespace>.<entity>.<action>
 * Note: BusinessRuleState belongs to the grant mapping (PositionCapability), not to the capability definition.
 */
export interface Capability {
  code: string;
  namespace: CapabilityNamespace;
  name: string;
  description: string;
  isDangerous: boolean;
}

/**
 * Caller-supplied resource parameters (Strictly untrusted target identifiers)
 * Callers can NEVER supply or influence permitted child IDs, authorization relations, or arbitrary keys.
 */
export interface RequestedResourceContext {
  santriId?: string;
  targetUserId?: string;
  resourceId?: string;
  halaqohId?: string;
  kamarId?: string;
  unitId?: string;
}

/**
 * Server-hydrated authoritative resource attributes evaluated by the authorization engine
 */
export interface ResolvedResourceContext {
  santriId?: string;
  halaqohId?: string;
  kamarId?: string;
  orgUnitIds: string[];
  guardianLinkedSantriIds?: string[]; // Authoritatively hydrated server-side from Guardian table
  genderComplex?: GenderComplex;
  orgDomain?: OrgDomain;
  [key: string]: unknown;
}

/**
 * Canonical Authorization Result Code Union
 * Exactly ONE normalized union across all layers.
 */
export type AuthorizationResultCode =
  | "ALLOWED"
  | "UNAUTHENTICATED"
  | "IDENTITY_NOT_LINKED"
  | "IDENTITY_INACTIVE"
  | "CAPABILITY_NOT_GRANTED"
  | "INVALID_RESOURCE_CONTEXT"
  | "SCOPE_MISMATCH"
  | "ASSIGNMENT_NOT_ACTIVE"
  | "ASSIGNMENT_EXPIRED"
  | "GENDER_COMPLEX_DENIED"
  | "SYSTEM_FAIL_CLOSED";

/**
 * Outcome of an authorization evaluation
 */
export interface AuthorizationResult {
  allowed: boolean;
  code: AuthorizationResultCode;
  reason?: string;
  grantUsed?: EffectiveCapabilityGrant; // Identifies the specific grant that authorized the request
  effectiveScope?: ScopeType;
  assignmentId?: string;
  positionCode?: string;
  unitId?: string;
}

/**
 * Canonical Server-Side Authorization Engine Public Contract
 * Exactly ONE normalized interface contract supporting multi-grant evaluation.
 */
export interface IAuthorizationEngine {
  /**
   * Full server-side authorization check (Capability + Scope vs Authoritative Context)
   * Evaluates all effective grants; returns ALLOW if at least one grant matches.
   */
  authorize(
    session: UserSession | null,
    capabilityCode: string,
    context?: RequestedResourceContext
  ): Promise<AuthorizationResult>;

  /**
   * Coarse check if session holds capability regardless of scope (used for UI derivation)
   */
  hasCapability(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<boolean>;

  /**
   * Resolves list of all active assignments for a given session
   */
  getActiveAssignments(
    session: UserSession | null
  ): Promise<Assignment[]>;

  /**
   * Resolves all effective capability grants for a session and capability
   */
  resolveScopes(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<EffectiveCapabilityGrant[]>;

  /**
   * Optional helper to construct Prisma WHERE clause filters from effective scope
   */
  buildScopeFilter?(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<Record<string, unknown>>;
}

/**
 * Operational Kiosk / Unit Account Executor Attribution
 * Free-text name alone does NOT confer non-repudiation; humanExecutorId references a verified identity.
 */
export interface UnitAccountExecutorContext {
  technicalAccountId: string;
  technicalAccountUsername: string;
  humanExecutorId: string; // REQUIRED: verified identity from active Staff/Santri record
  humanExecutorName: string; // Immutable display snapshot
  unitId: string;
  assignmentId: string;
}

/**
 * Forensic Audit Record Interface
 * Immutable execution snapshot that survives future assignment deactivations or organizational changes.
 */
export interface CanonicalAuditRecord {
  id: string;
  technicalAccountId: string;
  technicalAccountUsername: string;
  humanExecutorId?: string | null;
  humanExecutorName?: string | null;
  action: string;
  entity: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  capabilityCode: string;
  assignmentId?: string | null;
  positionCode: string; // Snapshot at time of execution
  scopeType: ScopeType;  // Snapshot at time of execution
  unitId: string;        // Snapshot at time of execution
  resourceContext?: Record<string, unknown> | null;
  reason?: string | null;
  clientRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}

/**
 * Keasramaan V2 Health Status Alignment
 */
export type HealthStatusV2 = "DIPANTAU" | "PULIH" | "DIRUJUK" | "DARURAT";
export type HealthStatusLegacy = "SEMBUH" | "RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "PULANG";

/**
 * Canonical Health Domain Granular Capabilities
 * Formally adhering to <namespace>.<entity>.<action> nomenclature.
 */
export const HEALTH_CAPABILITIES = {
  READ_AGGREGATE: "health.case.read_aggregate",
  READ_DETAIL: "health.case.read_detail",
  CREATE: "health.case.create",
  UPDATE_STATUS: "health.case.update_status",
  REFERRAL: "health.case.referral",
} as const;

export type HealthCapabilityCode =
  (typeof HEALTH_CAPABILITIES)[keyof typeof HEALTH_CAPABILITIES];

/**
 * Candidate Prisma Schema Relational Parity Representation
 * Exact 1:1 structural representation for future Phase A additive schema.
 */
export interface CandidateOrgUnitModel {
  id: string;
  code: string;
  name: string;
  type: OrgUnitType;
  domain: OrgDomain;
  parentId: string | null;
  genderComplex: GenderComplex;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidatePositionModel {
  id: string;
  code: string;
  name: string;
  domain: OrgDomain;
  allowedUnitTypes: OrgUnitType[];
  isLeadership: boolean;
  requiresPersonalAccount: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidatePositionCapabilityModel {
  id: string;
  positionId: string;
  capabilityCode: string;
  scopeType: ScopeType;
  businessRuleState: BusinessRuleState;
}

export interface CandidateUnitAccountPlacementModel {
  id: string;
  userId: string;
  unitId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateCapabilityModel {
  code: string;
  namespace: CapabilityNamespace;
  name: string;
  description: string;
  isDangerous: boolean;
  createdAt: Date;
}

export interface CandidateAssignmentModel {
  id: string;
  userId: string;
  positionId: string;
  unitId: string;
  status: AssignmentStatus;
  validFrom: Date;
  validUntil: Date | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateAssignmentScopeUnitModel {
  id: string;
  assignmentId: string;
  unitId: string;
  createdAt: Date;
}

export interface CandidateCanonicalAuditLogModel {
  id: string;
  technicalAccountId: string;
  technicalAccountUsername: string;
  humanExecutorId: string | null;
  humanExecutorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  capabilityCode: string;
  assignmentId: string | null;
  positionCode: string;
  scopeType: ScopeType;
  unitId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  resourceContext: Record<string, unknown> | null;
  reason: string | null;
  clientRequestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Canonical Keasramaan Structure Definitions & Contracts
 * Derived strictly from locked architecture specifications (STQ_ARCHITECTURE_LOCK.md & STQ_MILESTONE3_1_KEASRAMAAN_STRUCTURE.md)
 */
export const KEASRAMAAN_STRUCTURE = {
  OSDA_CORE_POSITIONS: [
    "KETUA_OSDA",
    "SEKRETARIS_OSDA",
    "BENDAHARA_OSDA",
    "MULTIMEDIA_OSDA",
  ] as const,
  OSDA_DIVISIONS: [
    "KEAMANAN_KEDISIPLINAN",
    "PENDIDIKAN_IBADAH",
    "KEBERSIHAN_KERAPIHAN",
    "KESEHATAN",
    "SARANA_PRASARANA",
  ] as const,
  TKS_EXPANSION: "Tugas Khusus Santri" as const,
  TKS_NODE: {
    type: "ORGANIZATION" as const,
    domain: "KEASRAMAAN" as const,
    code: "OU-TKS-ROOT" as const,
    name: "Tugas Khusus Santri" as const,
    hasCentralKetua: false as const,
  },
  TKS_UNITS: [
    "Dapur dan Gizi",
    "Masjid",
    "Kantor Pendidikan",
    "Kantor Yayasan",
    "Air Minum",
    "Air Sumur",
  ] as const,
  TKS_SERVICE_UNITS: [
    { code: "OU-TKS-DAPUR", name: "Dapur dan Gizi", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-MASJID", name: "Masjid", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-PENDIDIKAN", name: "Kantor Pendidikan", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-YAYASAN", name: "Kantor Yayasan", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-AIR-MINUM", name: "Air Minum", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-AIR-SUMUR", name: "Air Sumur", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
  ] as const,
} as const;

/**
 * Minimal Typed Structural Contracts for Keasramaan Sub-Organizations
 */
export const TKS_STRUCTURE_CONTRACT = {
  NODE: {
    type: "ORGANIZATION" as const,
    domain: "KEASRAMAAN" as const,
    code: "OU-TKS-ROOT" as const,
    name: "Tugas Khusus Santri" as const,
    hasCentralKetua: false as const,
  },
  SERVICE_UNITS: [
    { code: "OU-TKS-DAPUR", name: "Dapur dan Gizi", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-MASJID", name: "Masjid", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-PENDIDIKAN", name: "Kantor Pendidikan", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-YAYASAN", name: "Kantor Yayasan", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-AIR-MINUM", name: "Air Minum", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
    { code: "OU-TKS-AIR-SUMUR", name: "Air Sumur", type: "SERVICE_UNIT" as const, domain: "KEASRAMAAN" as const, parentUnitCode: "OU-TKS-ROOT" as const },
  ] as const,
} as const;

export const OSDA_STRUCTURE_CONTRACT = {
  NODE: {
    type: "ORGANIZATION" as const,
    domain: "KEASRAMAAN" as const,
    code: "OU-OSDA-ROOT" as const,
    name: "Organisasi Santri Darul Ulum Cendekia" as const,
  },
} as const;

/**
 * Milestone 3.2 UAT Business Rules — Granular Capabilities
 * Note: Uses canonical tahfizh.recap.read (breadth governed by scope GLOBAL vs HALAQOH)
 */
export const TAHFIZH_M32_CAPABILITIES = {
  RECAP_READ: "tahfizh.recap.read",
  TARGET_MANAGE: "tahfizh.target.manage",
  REWARD_ISSUE: "tahfizh.reward.issue",
  SETORAN_CREATE: "tahfizh.setoran.create",
} as const;

export const KEASRAMAAN_PERMISSION_CAPABILITIES = {
  READ: "keasramaan.permission.read",
  CREATE: "keasramaan.permission.create",
  UPDATE: "keasramaan.permission.update",
  APPROVE_MK: "keasramaan.permission.approve_mk",
  APPROVE_KS: "keasramaan.permission.approve_ks",
} as const;

/**
 * UAT Rule #7: Halaqoh attendance new-entry selectable options
 * MASBUK is strictly excluded from new entries (historical records remain readable).
 */
export const HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS = [
  "HADIR",
  "SAKIT",
  "IZIN",
  "ALFA",
] as const;
export type HalaqohAttendanceNewEntryOption =
  (typeof HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS)[number];

/**
 * UAT Rule #8: Tahajjud attendance new-entry selectable choices
 * Exactly two choices: SHOLAT and ALFA.
 */
export const TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS = [
  "SHOLAT",
  "ALFA",
] as const;
export type TahajjudAttendanceNewEntryOption =
  (typeof TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS)[number];

/**
 * UAT Rule #6: Kepesantrenan Attendance Contract
 * Locks structural separation between Teacher and Student attendance.
 * Attendance status vocabulary remains explicitly TBD / M3.3 BUSINESS DECISION.
 */
export interface KepesantrenanAttendanceRecordContract {
  activitySessionId: string;
  dateTime: Date;
  subjectOrActivity: string; // e.g. "Bahasa Arab", "Fikih", "Tafsir", "Tajwid", "Aqidah Islamiyah"
  personId: string;
  actorType: "TEACHER" | "STUDENT";
  attendanceStatus?: string; // TBD / M3.3 Business Decision
  recorderUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const KEPESANTRENAN_ATTENDANCE_CONTRACT = {
  SUBJECTS: [
    "Bahasa Arab",
    "Fikih",
    "Tafsir",
    "Tajwid",
    "Aqidah Islamiyah",
  ] as const,
  ACTOR_TYPES: ["TEACHER", "STUDENT"] as const,
  STATUS_VOCABULARY_POLICY: "TBD / M3.3 BUSINESS DECISION" as const,
} as const;

/**
 * UAT Rule #10: OSDA PUTRI Unit Account Contract
 * Technical account for santriwati operational unit with zero PUTRA data leakage.
 */
export const OSDA_PUTRI_UNIT_CONTRACT = {
  NODE: {
    code: "OU-OSDA-PUTRI",
    name: "Organisasi Santri Darul Ulum Cendekia Putri",
    type: "ORGANIZATION" as const,
    domain: "KEASRAMAAN" as const,
    genderComplex: "PUTRI" as const,
    parentUnitCode: "OU-OSDA-ROOT" as const,
    accountType: "UNIT" as const,
  },
  INVARIANTS: {
    genderComplex: "PUTRI" as const,
    maxActivePlacements: 1,
    allowMultipleDevices: true,
    requiresVerifiedHumanExecutor: true,
    preventPutraAccess: true,
  },
} as const;

/**
 * UAT Rule #3: Santri Search Result Rendering Contract
 * Renders concise output showing only Nama and Kelas.
 */
export function formatSantriSearchResult(santri: { nama: string; kelas: string }): {
  nama: string;
  kelas: string;
  displayText: string;
} {
  return {
    nama: santri.nama,
    kelas: santri.kelas,
    displayText: `${santri.nama} • Kelas ${santri.kelas}`,
  };
}




