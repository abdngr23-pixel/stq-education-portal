/**
 * STQ ARCHITECTURE LOCK — CANONICAL TYPE DEFINITIONS
 * Phase 1 Remediation V3-B: Normalized Identity, OrgUnit, Position, Assignment, Capability, Scope, and Health
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * Document Reference: docs/STQ_ARCHITECTURE_LOCK.md
 * Status: PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW
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
  | "USROH"           // Cleaning groups under OSDA Kebersihan
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
  parentUnitId?: string | null;
  parentId?: string | null; // Canonical Prisma schema alias (@map("parent_id"))
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
 * Canonical Assignment Lifecycle Status
 * Exactly ONE normalized lifecycle across all documents, schemas, and runtime contracts.
 */
export type AssignmentStatus =
  | "DRAFT"      // Not authoritative / pending activation
  | "ACTIVE"     // Currently grants authority (only ACTIVE within validFrom-validUntil grants capability)
  | "SUSPENDED"  // Temporarily grants zero authority
  | "EXPIRED"    // Naturally lapsed past validUntil
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
 * Relational Position-Capability Mapping with fine-grained Scope modeling
 * Single source of truth for scopeType per capability.
 */
export interface PositionCapability {
  id: string;
  positionId: string;
  capabilityCode: string;
  scopeType: ScopeType;
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
}

/**
 * Fine-grained Capability definition
 * Format: <namespace>.<entity>.<action>
 */
export interface Capability {
  code: string;
  namespace: CapabilityNamespace;
  name: string;
  description: string;
  isDangerous: boolean;
  ruleState: BusinessRuleState;
}

/**
 * Caller-supplied resource parameters (Strictly untrusted target identifiers)
 * Callers can NEVER supply or influence permitted child IDs or authorized boundaries.
 */
export interface RequestedResourceContext {
  santriId?: string;
  targetUserId?: string;
  resourceId?: string;
  halaqohId?: string;
  kamarId?: string;
  unitId?: string;
  [key: string]: unknown;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidatePositionModel {
  id: string;
  code: string;
  name: string;
  domain: OrgDomain;
  isLeadership: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidatePositionCapabilityModel {
  id: string;
  positionId: string;
  capabilityCode: string;
  scopeType: ScopeType;
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


