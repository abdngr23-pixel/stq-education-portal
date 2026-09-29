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
export type AccountType = "PERSONAL" | "UNIT" | "SUBJECT";

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
 * Server-resolved metadata for an operational placement, assignment anchor,
 * or relational scope unit. OrgUnit.id is opaque; authorization semantics
 * come exclusively from these authoritative OrgUnit attributes.
 */
export interface CanonicalOperationalUnitContext {
  unitId: string;
  unitCode: string;
  unitType: OrgUnitType;
  domain: OrgDomain;
  genderComplex: GenderComplex;
  parentId: string | null;
  ancestorUnitIds: string[];
  isActive: boolean;
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
  anchorUnit?: CanonicalOperationalUnitContext;
  scopeUnits?: CanonicalOperationalUnitContext[];
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
  educationSessionId?: string;
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
  scopeType?: ScopeType | null;  // Snapshot at time of execution (nullable for SUBJECT_ACCOUNT)
  unitId?: string | null;        // Snapshot at time of execution (nullable for SUBJECT_ACCOUNT)
  authorizationModel?: string | null;
  subjectId?: string | null;
  resourceContext?: Record<string, unknown> | null;
  reason?: string | null;
  clientRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}

export const CANONICAL_HEALTH_STATUSES_V2 = [
  "DIPANTAU",
  "PULIH",
  "DIRUJUK",
  "DARURAT",
] as const;

export type HealthStatusV2 = (typeof CANONICAL_HEALTH_STATUSES_V2)[number];
export type HealthStatusLegacy = "SEMBUH" | "RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "PULANG";
export type HealthStatusBridgeResult = HealthStatusV2 | "UNKNOWN" | "REVIEW_REQUIRED";

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
 * Canonical Academic / Pendidikan Domain Granular Capabilities
 * Formally adhering to <namespace>.<entity>.<action> nomenclature.
 * Note: New capabilities default to PROPOSED_TBD until verified in production.
 */
export const ACADEMIC_CAPABILITIES = {
  SCHEDULE_READ: "academic.schedule.read",
  SESSION_START: "academic.session.start",
  MATERIAL_RECORD: "academic.material.record",
  ATTENDANCE_RECORD: "academic.attendance.record",
  SCORE_INPUT: "academic.score.input",
  SCORE_READ: "academic.score.read",
  RAPOR_PRINT: "academic.rapor.print",
  CURRICULUM_MANAGE: "academic.curriculum.manage",
  SESSION_COMPLETE: "academic.session.complete",
  COHORT_MANAGE: "academic.cohort.manage",
  TEACHING_ASSIGNMENT_MANAGE: "academic.teaching_assignment.manage",
  SESSION_VIEW: "academic.session.view",
} as const;

export type AcademicCapabilityCode =
  (typeof ACADEMIC_CAPABILITIES)[keyof typeof ACADEMIC_CAPABILITIES];

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

export const KEASRAMAAN_KAMAR_CAPABILITIES = {
  INSPECT: "keasramaan.kamar.inspect",
  MANAGE: "keasramaan.kamar.manage",
} as const;

export const STUDENT_PRIVACY_CAPABILITIES = {
  GUARDIAN_CONTACT_READ: "student.guardian_contact.read",
} as const;

/**
 * Approved code-level target policy only. This manifest provisions nothing and
 * grants zero runtime authority while its state remains pending technical.
 */
export const KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY = {
  positionCode: "KEPALA_KEASRAMAAN",
  capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
  scopeType: "DOMAIN",
  domain: "KEASRAMAAN",
  businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
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
    "Aqidah",
  ] as const,
  ACTOR_TYPES: ["TEACHER", "STUDENT"] as const,
  STUDENT_ATTENDANCE_STATUSES: ["HADIR", "IZIN", "SAKIT", "ALFA"] as const,
  FORBIDDEN_STATUSES: ["MASBUK"] as const,
  STATUS_VOCABULARY_POLICY: "CANONICAL_RECONCILED" as const,
  TEACHER_ATTENDANCE_EVIDENCE: "SESSION_START_AUTHENTICATED_EXECUTION" as const,
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
    requiresVerifiedHumanExecutorForMutation: true,
    allowMutation: false,
    operationalModality: "READ_ONLY_MONITORING" as const,
    preventPutraAccess: true,
  },
} as const;

/**
 * UAT Rule #3: Santri Search Result Rendering Contract (Reconciled)
 * Renders concise output showing NAMA ONLY in displayText.
 * Kelas and Halaqoh/Kelompok are independent filter controls.
 */
export function formatSantriSearchResult(santri: { nama: string; kelas?: string }): {
  nama: string;
  displayText: string;
  kelas?: string;
} {
  return {
    nama: santri.nama,
    displayText: santri.nama,
    kelas: santri.kelas,
  };
}

/**
 * Canonical Position Contract for Kepesantrenan Teacher (GURU_KEPESANTRENAN)
 * Defines canonical code contract for teacher self-service.
 * Strictly non-production-writing — architecture contract only.
 */
export const GURU_KEPESANTRENAN_POSITION_CONTRACT = {
  code: "GURU_KEPESANTRENAN" as const,
  name: "Guru Kepesantrenan" as const,
  domain: "AKADEMIK" as const,
  requiresPersonalAccount: true as const,
  isLeadership: false as const,
  allowedUnitTypes: ["INSTITUTION"] as const,
  assignmentAnchor: "OU-STQ-ROOT" as const,
  targetCapabilities: [
    "academic.schedule.read",
    "academic.session.start",
    "academic.material.record",
    "academic.attendance.record",
  ] as const,
  scopeType: "GLOBAL" as const,
} as const;

/**
 * Canonical Teacher Mapping Contract for Kepesantrenan Subjects (12 Slots)
 * Per Level-0 Owner Directive DIR-2026-031 (and DIR-2026-028 where relevant to teacher modality).
 * Declarative contract mapping confirmed human teacher names to exact curriculum slots.
 * ZERO production database IDs or User.id hardcoding.
 * Teacher identities are resolved at runtime via Staff/Assignment linkage, NOT static username keys.
 */
export const CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS = [
  // PUTRA SLOTS (7)
  {
    slot: 1,
    genderComplex: "PUTRA" as const,
    subjectName: "Bahasa Arab" as const,
    pedagogicalLevel: "TINGKAT_1" as const,
    teacherName: "Ust. Abi Hudzaifah" as const,
  },
  {
    slot: 2,
    genderComplex: "PUTRA" as const,
    subjectName: "Bahasa Arab" as const,
    pedagogicalLevel: "TINGKAT_2" as const,
    teacherName: "Ust. Kamal Mukhtar" as const,
  },
  {
    slot: 3,
    genderComplex: "PUTRA" as const,
    subjectName: "Bahasa Arab" as const,
    pedagogicalLevel: "TINGKAT_3" as const,
    teacherName: "Ust. Andi Quarzy Ayatullah" as const,
  },
  {
    slot: 4,
    genderComplex: "PUTRA" as const,
    subjectName: "Fikih" as const,
    pedagogicalLevel: null,
    teacherName: "Ust. Razan Mufli" as const,
  },
  {
    slot: 5,
    genderComplex: "PUTRA" as const,
    subjectName: "Tafsir" as const,
    pedagogicalLevel: null,
    teacherName: "Ust. Mujaddid Zhohruddin" as const,
  },
  {
    slot: 6,
    genderComplex: "PUTRA" as const,
    subjectName: "Aqidah" as const,
    pedagogicalLevel: null,
    teacherName: "Ust. Alwan" as const,
  },
  {
    slot: 7,
    genderComplex: "PUTRA" as const,
    subjectName: "Tajwid" as const,
    pedagogicalLevel: null,
    teacherName: "Ust. Mujaddid Zhohruddin" as const,
  },
  // PUTRI SLOTS (5)
  {
    slot: 8,
    genderComplex: "PUTRI" as const,
    subjectName: "Bahasa Arab" as const,
    pedagogicalLevel: null,
    teacherName: "Ustazah Lisa Dwina Fitri" as const,
  },
  {
    slot: 9,
    genderComplex: "PUTRI" as const,
    subjectName: "Fikih" as const,
    pedagogicalLevel: null,
    teacherName: "Ustazah Lisa Dwina Fitri" as const,
  },
  {
    slot: 10,
    genderComplex: "PUTRI" as const,
    subjectName: "Tafsir" as const,
    pedagogicalLevel: null,
    teacherName: "Ustazah Lisa Dwina Fitri" as const,
  },
  {
    slot: 11,
    genderComplex: "PUTRI" as const,
    subjectName: "Aqidah" as const,
    pedagogicalLevel: null,
    teacherName: "Ustazah Lisa Dwina Fitri" as const,
  },
  {
    slot: 12,
    genderComplex: "PUTRI" as const,
    subjectName: "Tajwid" as const,
    pedagogicalLevel: null,
    teacherName: "Ustazah Lisa Dwina Fitri" as const,
  },
] as const;

/**
 * Declarative UAT Activation Target Policy Manifest (M3.3C1)
 * Declarative target truth only — strictly NON-PRODUCTION-WRITING.
 * All target policies remain APPROVED_TARGET_PENDING_TECHNICAL.
 */
export const UAT_ACTIVATION_TARGETS = {
  // A. Operational Tahfizh
  OPERATIONAL_TAHFIZH: {
    positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
    policies: [
      {
        capabilityCode: "tahfizh.recap.read",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        notes: "GLOBAL read of Tahfizh recap across all santri. Does not widen setoran write or reward issuance.",
      },
    ],
  },
  // B. Target Management
  TARGET_MANAGEMENT: {
    MUSYRIF_TAHFIZH: {
      positionCode: "MUSYRIF_TAHFIZH",
      capabilityCode: "tahfizh.target.manage",
      scopeType: "HALAQOH",
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      notes: "Own assigned halaqoh only. Cross-halaqoh modifications denied.",
    },
    PEMBINA_HALAQOH: {
      positionCode: "PEMBINA_HALAQOH",
      capabilityCode: "tahfizh.target.manage",
      scopeType: "HALAQOH",
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      notes: "Own assigned halaqoh only. Cross-halaqoh modifications denied.",
    },
  },
  // C. Operational Keasramaan (DIR-2026-038)
  OPERATIONAL_KEASRAMAAN: {
    positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
    policies: [
      {
        capabilityCode: "keasramaan.permission.read",
        scopeType: "DOMAIN",
        domain: "KEASRAMAAN",
        genderComplex: "PUTRI",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        notes: "DOMAIN read of Keasramaan permissions for PUTRI santriwati per DIR-2026-038. Mutation strictly denied.",
      },
    ],
    deniedCapabilities: [
      "keasramaan.permission.create",
      "keasramaan.permission.update",
      "keasramaan.permission.approve_mk",
      "keasramaan.permission.approve_ks",
    ],
    deniedApprovalCapabilities: ["keasramaan.permission.approve_mk", "keasramaan.permission.approve_ks"],
    notes: "Read-only Keasramaan monitoring for PUTRI domain per DIR-2026-038. All mutation capabilities strictly denied for this UNIT account.",
  },
  // D. OSDA PUTRI Unit Account (DIR-2026-038)
  OSDA_PUTRI: {
    accountCode: "OU-OSDA-PUTRI",
    accountType: "UNIT",
    genderComplex: "PUTRI",
    maxActivePlacements: 1,
    operationalModality: "READ_ONLY_MONITORING",
    allowMutation: false,
    requiresVerifiedHumanExecutorForMutation: true,
    requiresVerifiedHumanExecutor: true,
    preventPutraAccess: true,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
    notes: "Santriwati technical operational unit account for READ-ONLY monitoring per DIR-2026-038. Strictly prevents PUTRA data leakage.",
  },
} as const;

/**
 * DIR-2026-039 (C1): Canonical Personal Permission Mutation Target Policies
 * Target policies for PERSONAL accounts mutating Keasramaan permissions.
 * State: APPROVED_TARGET_PENDING_TECHNICAL (ZERO runtime authority before Gate 5B promotion).
 */
export const CANONICAL_PERSONAL_PERMISSION_MUTATION_TARGET_POLICIES = {
  PEMBINA_HALAQOH: [
    {
      positionCode: "PEMBINA_HALAQOH" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      scopeType: "KAMAR" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Mudabbir own assigned Kamar create only. Same-day keluar komplek approved, overnight/pulang pending MK.",
    },
    {
      positionCode: "PEMBINA_HALAQOH" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
      scopeType: "KAMAR" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Mudabbir return confirmation and cancellation within own assigned Kamar scope only.",
    },
  ],
  KEPALA_KEASRAMAAN: [
    {
      positionCode: "KEPALA_KEASRAMAAN" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      scopeType: "DOMAIN" as const,
      domain: "KEASRAMAAN" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Kepala Keasramaan domain create authority.",
    },
    {
      positionCode: "KEPALA_KEASRAMAAN" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
      scopeType: "DOMAIN" as const,
      domain: "KEASRAMAAN" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Kepala Keasramaan domain update authority.",
    },
    {
      positionCode: "KEPALA_KEASRAMAAN" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
      scopeType: "DOMAIN" as const,
      domain: "KEASRAMAAN" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Kepala Keasramaan MK-tier approval and escalation authority. Cannot exercise approve_ks.",
    },
  ],
  MUDIR: [
    {
      positionCode: "MUDIR" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      scopeType: "GLOBAL" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Mudir institutional create authority.",
    },
    {
      positionCode: "MUDIR" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
      scopeType: "GLOBAL" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Mudir institutional update authority.",
    },
    {
      positionCode: "MUDIR" as const,
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
      scopeType: "GLOBAL" as const,
      businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
      notes: "Mudir final approval authority.",
    },
  ],
} as const;

/**
 * DIR-2026-040 (D1): Canonical Guardian Contact Privacy Target Policies
 * Dedicated field-level capability for noHpWali disclosure.
 * State: APPROVED_TARGET_PENDING_TECHNICAL (ZERO runtime authority before Gate 5B promotion).
 */
export const CANONICAL_GUARDIAN_CONTACT_PRIVACY_TARGET_POLICIES = {
  MUDIR: {
    positionCode: "MUDIR" as const,
    capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
    scopeType: "GLOBAL" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Mudir institutional access to guardian contacts.",
  },
  KEPALA_KEASRAMAAN: {
    positionCode: "KEPALA_KEASRAMAAN" as const,
    capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
    scopeType: "DOMAIN" as const,
    domain: "KEASRAMAAN" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Kepala Keasramaan domain access to guardian contacts.",
  },
  MUSYRIF_TAHFIZH: {
    positionCode: "MUSYRIF_TAHFIZH" as const,
    capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
    scopeType: "HALAQOH" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Direct supervising Musyrif access to own halaqoh santri guardian contacts.",
  },
  PEMBINA_HALAQOH: {
    positionCode: "PEMBINA_HALAQOH" as const,
    capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
    scopeType: "KAMAR" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Direct supervising Mudabbir access to own kamar santri guardian contacts.",
  },
} as const;

/**
 * Canonical Personal Permission Read Target Policies (R1 Remediation)
 * Derived from approved C1 Keasramaan workflow:
 * - MUDIR: GLOBAL
 * - KEPALA_KEASRAMAAN: DOMAIN / KEASRAMAAN
 * - PEMBINA_HALAQOH: KAMAR (only own active Kamar placements)
 * State: APPROVED_TARGET_PENDING_TECHNICAL (ZERO runtime authority before Gate 5B promotion).
 */
export const CANONICAL_PERSONAL_PERMISSION_READ_TARGET_POLICIES = {
  PEMBINA_HALAQOH: {
    positionCode: "PEMBINA_HALAQOH" as const,
    capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
    scopeType: "KAMAR" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Mudabbir own assigned Kamar permission read only.",
  },
  KEPALA_KEASRAMAAN: {
    positionCode: "KEPALA_KEASRAMAAN" as const,
    capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
    scopeType: "DOMAIN" as const,
    domain: "KEASRAMAAN" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Kepala Keasramaan domain permission read authority.",
  },
  MUDIR: {
    positionCode: "MUDIR" as const,
    capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
    scopeType: "GLOBAL" as const,
    businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as const,
    notes: "Mudir institutional permission read authority.",
  },
} as const;

/**
 * Canonical Account Modality Contract (Gate 5 Hardening)
 * Binds positions strictly to their approved account type modality.
 * PETUGAS_OPERASIONAL_KEASRAMAAN -> UNIT only
 * Institutional & managerial positions -> PERSONAL only
 */
export const POSITION_ACCOUNT_MODALITY_CONTRACT: Record<string, AccountType> = {
  PETUGAS_OPERASIONAL_KEASRAMAAN: "UNIT",
  GURU_KEPESANTRENAN: "PERSONAL",
  PEMBINA_HALAQOH: "PERSONAL",
  KEPALA_KEASRAMAAN: "PERSONAL",
  MUDIR: "PERSONAL",
  KABID_TAHFIZH: "PERSONAL",
  MUSYRIF_TAHFIZH: "PERSONAL",
  PETUGAS_OPERASIONAL_TAHFIZH: "PERSONAL",
} as const;

/**
 * Canonical Institutional and Domain Hierarchy Contract (Gate 3 Blocker Resolution)
 * Defines declarative structure approved by Business Owner (DIR-2026-030).
 * Strictly non-production-writing — architecture contract only.
 */
export const CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT = {
  STQ_ROOT: {
    code: "OU-STQ-ROOT" as const,
    name: "STQ Darul Ulum Cendekia" as const,
    type: "INSTITUTION" as const,
    domain: "INSTITUTIONAL" as const,
    parentId: null,
    genderComplex: "TIDAK_TERIKAT" as const,
  },
  TAHFIZH_DOMAIN: {
    code: "OU-TAHFIZH" as const,
    name: "Tahfizh" as const,
    type: "DOMAIN" as const,
    domain: "TAHFIZH" as const,
    parentId: "OU-STQ-ROOT" as const,
    genderComplex: "TIDAK_TERIKAT" as const,
  },
  KEASRAMAAN_DOMAIN: {
    code: "OU-KEASRAMAAN" as const,
    name: "Keasramaan" as const,
    type: "DOMAIN" as const,
    domain: "KEASRAMAAN" as const,
    parentId: "OU-STQ-ROOT" as const,
    genderComplex: "TIDAK_TERIKAT" as const,
  },
} as const;

/**
 * Approved Current Six Halaqoh Canonical OrgUnit Backfill Contract (DIR-2026-035)
 * Declarative target truth mapping source Halaqoh rows to target OrgUnit and Musyrif Tahfizh assignments.
 * Contract: OrgUnit code = "OU-" + source Halaqoh.halaqohCode
 */
export interface CanonicalHalaqohMapping {
  halaqohCode: string;
  targetOrgUnitCode: string;
  targetOrgUnitType: "HALAQOH";
  targetOrgUnitDomain: "TAHFIZH";
  targetOrgUnitParent: "OU-TAHFIZH";
  name: string;
  genderComplex: "PUTRA" | "PUTRI";
  staffCode: string;
  expectedStaffCode: string;
  teacherName: string;
  canonicalUsername: string;
  expectedUsername: string;
  parentOrgUnitCode: "OU-TAHFIZH";
}

export const CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS: readonly CanonicalHalaqohMapping[] = [
  {
    halaqohCode: "HLQ-0001",
    targetOrgUnitCode: "OU-HLQ-0001",
    targetOrgUnitType: "HALAQOH",
    targetOrgUnitDomain: "TAHFIZH",
    targetOrgUnitParent: "OU-TAHFIZH",
    name: "Halaqoh Ust. Razan Mufli, S.Pd",
    genderComplex: "PUTRA",
    staffCode: "STF-0003",
    expectedStaffCode: "STF-0003",
    teacherName: "Ust. Razan Mufli, S.Pd",
    canonicalUsername: "musyrif.tahifzh",
    expectedUsername: "musyrif.tahifzh",
    parentOrgUnitCode: "OU-TAHFIZH",
  },
  {
    halaqohCode: "HLQ-0002",
    targetOrgUnitCode: "OU-HLQ-0002",
    targetOrgUnitType: "HALAQOH",
    targetOrgUnitDomain: "TAHFIZH",
    targetOrgUnitParent: "OU-TAHFIZH",
    name: "Halaqoh Ust. Kamal",
    genderComplex: "PUTRA",
    staffCode: "STF-0006",
    expectedStaffCode: "STF-0006",
    teacherName: "Ust. Kamal",
    canonicalUsername: "kamal.ph",
    expectedUsername: "kamal.ph",
    parentOrgUnitCode: "OU-TAHFIZH",
  },
  {
    halaqohCode: "HLQ-0003",
    targetOrgUnitCode: "OU-HLQ-0003",
    targetOrgUnitType: "HALAQOH",
    targetOrgUnitDomain: "TAHFIZH",
    targetOrgUnitParent: "OU-TAHFIZH",
    name: "Halaqoh Ust. Rizaldi",
    genderComplex: "PUTRA",
    staffCode: "STF-0007",
    expectedStaffCode: "STF-0007",
    teacherName: "Ust. Rizaldi",
    canonicalUsername: "rizaldi.ph",
    expectedUsername: "rizaldi.ph",
    parentOrgUnitCode: "OU-TAHFIZH",
  },
  {
    halaqohCode: "HLQ-0004",
    targetOrgUnitCode: "OU-HLQ-0004",
    targetOrgUnitType: "HALAQOH",
    targetOrgUnitDomain: "TAHFIZH",
    targetOrgUnitParent: "OU-TAHFIZH",
    name: "Halaqoh Ust. Abi Hudzaifah",
    genderComplex: "PUTRA",
    staffCode: "STF-0008",
    expectedStaffCode: "STF-0008",
    teacherName: "Ust. Abi Hudzaifah",
    canonicalUsername: "hudzaifah.ph",
    expectedUsername: "hudzaifah.ph",
    parentOrgUnitCode: "OU-TAHFIZH",
  },
  {
    halaqohCode: "HLQ-0005",
    targetOrgUnitCode: "OU-HLQ-0005",
    targetOrgUnitType: "HALAQOH",
    targetOrgUnitDomain: "TAHFIZH",
    targetOrgUnitParent: "OU-TAHFIZH",
    name: "Halaqoh Ust. Alwan",
    genderComplex: "PUTRA",
    staffCode: "STF-0009",
    expectedStaffCode: "STF-0009",
    teacherName: "Ust. Alwan",
    canonicalUsername: "alwan.ph",
    expectedUsername: "alwan.ph",
    parentOrgUnitCode: "OU-TAHFIZH",
  },
  {
    halaqohCode: "HLQ-0006",
    targetOrgUnitCode: "OU-HLQ-0006",
    targetOrgUnitType: "HALAQOH",
    targetOrgUnitDomain: "TAHFIZH",
    targetOrgUnitParent: "OU-TAHFIZH",
    name: "Halaqoh Ustadzah Lisa Dwina Fitri",
    genderComplex: "PUTRI",
    staffCode: "STF-0005",
    expectedStaffCode: "STF-0005",
    teacherName: "Ustadzah Lisa Dwina Fitri",
    canonicalUsername: "musyirfah.putri",
    expectedUsername: "musyirfah.putri",
    parentOrgUnitCode: "OU-TAHFIZH",
  },
] as const;

/**
 * Approved Canonical Assignment Anchor Contract (DIR-2026-030, DIR-2026-034, DIR-2026-036)
 * Binds positions to approved target anchor units.
 * Authoritative assignment mapping without hardcoded usernames.
 */
export const CANONICAL_ASSIGNMENT_ANCHORS = {
  MUDIR: "OU-STQ-ROOT" as const,
  KABID_TAHFIZH: "OU-TAHFIZH" as const,
  GURU_KEPESANTRENAN: "OU-STQ-ROOT" as const,
  PETUGAS_OPERASIONAL_TAHFIZH: "OU-TAHFIZH" as const,
  KEPALA_KEASRAMAAN: "OU-KEASRAMAAN" as const,
} as const;

/**
 * Canonical PETUGAS_OPERASIONAL_TAHFIZH Contract (DIR-2026-034)
 */
export const CANONICAL_POT_CONTRACT = {
  positionCode: "PETUGAS_OPERASIONAL_TAHFIZH" as const,
  assignmentAnchor: "OU-TAHFIZH" as const,
  targetHolderStaffCode: "STF-0005" as const,
  targetHolderCanonicalUsername: "musyirfah.putri" as const,
  targetHolderName: "Ustazah Lisa Dwina Fitri" as const,
  recapReadCapabilityScope: "GLOBAL" as const,
  rewardIssueAllowed: false as const,
} as const;

/**
 * Canonical KEPALA_KEASRAMAAN Contract (DIR-2026-036)
 */
export const CANONICAL_KEPALA_KEASRAMAAN_CONTRACT = {
  positionCode: "KEPALA_KEASRAMAAN" as const,
  assignmentAnchor: "OU-KEASRAMAAN" as const,
  targetHolderStaffCode: "STF-0004" as const,
  targetHolderCanonicalUsername: "musyrif.asrama" as const,
  targetHolderName: "Ust. Mujaddid Zhohruddin" as const,
} as const;

/**
 * Canonical PETUGAS_OPERASIONAL_KEASRAMAAN Contract (DIR-2026-037)
 */
export const CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT = {
  positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN" as const,
  targetAccountType: "UNIT" as const,
  targetUsername: "osda.putri" as const,
  targetUserStatus: "SUSPENDED" as const,
  targetOrgUnitCode: "OU-OSDA-PUTRI" as const,
  activationState: "DEFERRED_PENDING_OWNER_ACTIVATION" as const,
  operationalModality: "READ_ONLY_MONITORING" as const, // DIR-2026-038
  approvedCapability: "keasramaan.permission.read" as const,
  approvedScopeType: "DOMAIN" as const,
  approvedDomain: "KEASRAMAAN" as const,
  approvedGenderComplex: "PUTRI" as const,
  deniedCapabilities: [
    "keasramaan.permission.create",
    "keasramaan.permission.update",
    "keasramaan.permission.approve_mk",
    "keasramaan.permission.approve_ks",
  ] as const,
  requiresVerifiedHumanExecutorForMutation: true as const,
  allowUnitMutation: false as const,
  verifiedHumanExecutorAttributionReady: false as const,
  assignmentScopeUnitsReady: false as const,
  gate3ActiveAssignmentRequired: false as const,
} as const;

/**
 * Approved Gate 3 Required Active Assignment Positions vs Gate 5 Deferred Positions
 * Decouples Position templates from unconditional Gate 3 active-assignment requirements.
 * Note: PEMBINA_HALAQOH position template is required; its active assignment is conditional
 * (deferred when zero active Kamar exist, but coverage required when active Kamar exist).
 */
export const CANONICAL_REQUIRED_POSITION_CODES = [
  "MUDIR",
  "KABID_TAHFIZH",
  "KEPALA_KEASRAMAAN",
  "PETUGAS_OPERASIONAL_TAHFIZH",
  "MUSYRIF_TAHFIZH",
  "PEMBINA_HALAQOH",
  "PETUGAS_OPERASIONAL_KEASRAMAAN",
  "GURU_KEPESANTRENAN",
] as const;

export const GATE3_REQUIRED_ACTIVE_ASSIGNMENT_POSITION_CODES = [
  "MUDIR",
  "KABID_TAHFIZH",
  "KEPALA_KEASRAMAAN",
  "PETUGAS_OPERASIONAL_TAHFIZH",
  "MUSYRIF_TAHFIZH",
  "PEMBINA_HALAQOH",
  "GURU_KEPESANTRENAN",
] as const;

export const GATE5_DEFERRED_UNIT_ASSIGNMENT_POSITION_CODES = [
  "PETUGAS_OPERASIONAL_KEASRAMAAN",
] as const;

/**
 * Approved Fixed Target Assignment Holders Contract (DIR-2026-034, DIR-2026-036)
 * Maps fixed leadership & operational positions to their verified staff and anchor units.
 * Non-repudiation: Authority is conferred by Position + Assignment + PositionCapability, never username.
 */
export const CANONICAL_TARGET_ASSIGNMENT_HOLDERS = {
  PETUGAS_OPERASIONAL_TAHFIZH: {
    positionCode: "PETUGAS_OPERASIONAL_TAHFIZH" as const,
    staffCode: "STF-0005" as const,
    canonicalUsername: "musyirfah.putri" as const,
    teacherName: "Ustazah Lisa Dwina Fitri" as const,
    anchorUnitCode: "OU-TAHFIZH" as const,
  },
  KEPALA_KEASRAMAAN: {
    positionCode: "KEPALA_KEASRAMAAN" as const,
    staffCode: "STF-0004" as const,
    canonicalUsername: "musyrif.asrama" as const,
    teacherName: "Ust. Mujaddid Zhohruddin" as const,
    anchorUnitCode: "OU-KEASRAMAAN" as const,
  },
} as const;

/**
 * Canonical Identity Resolution Contract (Gate 3 Blocker Resolution, DIR-2026-032 & DIR-2026-033)
 * Distinguishes canonical active accounts from legacy placeholders and duplicate technical accounts.
 * Usernames are identity labels ONLY; they NEVER confer authorization.
 */
export const CANONICAL_IDENTITY_RESOLUTION_CONTRACT = {
  LISA_DWINA_FITRI: {
    canonicalAccount: "musyirfah.putri" as const,
    staffCode: "STF-0005" as const,
    role: "MT" as const,
    status: "AKTIF" as const,
    accountType: "PERSONAL" as const,
    duplicateLegacyAccount: "musyrifah.putri" as const,
    duplicateLegacyTargetStatus: "SUSPENDED" as const,
    hardDeleteAllowed: false as const,
    mergeAllowed: false as const,
  },
  PEMBINA_HALAQOH_PLACEHOLDER: {
    legacyAccount: "pembina.halaqoh" as const,
    role: "PH" as const,
    accountType: "PERSONAL" as const,
    targetStatus: "SUSPENDED" as const,
    hardDeleteAllowed: false as const,
    staffLinkageAllowed: false as const,
  },
} as const;
