/**
 * STQ ARCHITECTURE LOCK — CANONICAL TYPE DEFINITIONS
 * Phase 1 Remediation: Normalized Identity, OrgUnit, Position, Assignment, Capability, and Scope
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * Document Reference: docs/STQ_ARCHITECTURE_LOCK.md
 * Status: PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW
 */

import { UserSession } from "./auth";

/**
 * High-level institutional domains within STQ Darul Ulum Cendekia
 */
export type STQDomain =
  | "INSTITUTIONAL"
  | "TAHFIZH"
  | "KEASRAMAAN"
  | "KESEHATAN"
  | "AKADEMIK"
  | "MANAJEMEN"
  | "LOGISTIK"
  | "SISTEM";

/**
 * Canonical Organizational Unit classification within the institutional tree
 * Exactly ONE normalized vocabulary across all system layers.
 */
export type OrgUnitType =
  | "INSTITUTION"     // STQ Darul Ulum Cendekia (Root)
  | "DOMAIN"          // Ketahfidzhan, Keasramaan, Akademik, Manajemen, dll.
  | "ORGANIZATION"    // Overarching bodies e.g. OSDA (Organisasi Santri Darul Ulum Cendekia)
  | "DIVISION"        // Sub-bodies e.g. OSDA Divisions (Keamanan, Ibadah, Kesehatan, dll.)
  | "HALAQOH"         // Qur'an Halaqoh (Ust. Razan, Ustdz. Lisa, dll.)
  | "KAMAR"           // Asrama Rooms (Abu Bakar, Umar, Putri, dll.)
  | "SERVICE_UNIT"    // TKS Units (Dapur, Masjid, Air, dll.) - no alias "WORK_UNIT"
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
  domain: STQDomain;
  parentUnitId?: string | null;
  genderComplex: GenderComplex;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Position (Jabatan / Peran Fungsional)
 * Position is NOT a global Role enum; it is an organizational role associated with units.
 */
export interface Position {
  id: string;
  code: string;
  name: string;
  domain: STQDomain;
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
 * Connects an Identity (User) to a Position within an OrgUnit under an active Scope.
 * Subject integrity: userId is the required non-nullable foreign key to User.
 */
export interface Assignment {
  id: string;
  userId: string; // Foreign key to User (technical identity / principal)
  positionId: string;
  unitId: string;
  scopeType: ScopeType;
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
 * Replaces non-relational string arrays for ASSIGNED_UNITS with full FK integrity.
 */
export interface AssignmentScopeUnit {
  id: string;
  assignmentId: string;
  unitId: string;
  createdAt: Date;
}

/**
 * Relational Position-Capability Mapping with fine-grained Scope modeling
 * Enables one Position to hold capability A at DOMAIN scope and capability B at UNIT scope.
 */
export interface PositionCapability {
  id: string;
  positionId: string;
  capabilityCode: string;
  scopeType: ScopeType;
}

/**
 * Fine-grained Capability definition
 * Format: <domain>.<entity>.<action>
 */
export interface Capability {
  code: string;
  domain: STQDomain;
  name: string;
  description: string;
  isDangerous: boolean;
  isLocked: boolean; // true = verified & locked; false = proposed / requires business owner approval
}

/**
 * Contextual attributes passed to the authorization engine during server-side evaluation
 */
export interface ResourceContext {
  santriId?: string;
  halaqohId?: string;
  kamarId?: string;
  unitId?: string;
  domainId?: string;
  targetUserId?: string;
  gender?: "PUTRA" | "PUTRI";
  guardianLinkedSantriIds?: string[]; // Supports one guardian -> multiple children relationally
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
  | "ASSIGNMENT_INACTIVE"
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
  effectiveScope?: ScopeType;
  assignmentId?: string;
  positionCode?: string;
  unitId?: string;
}

/**
 * Canonical Server-Side Authorization Engine Public Contract
 * Exactly ONE normalized interface contract.
 */
export interface IAuthorizationEngine {
  /**
   * Full server-side authorization check (Capability + Scope vs Resource Context)
   */
  authorize(
    session: UserSession | null,
    capabilityCode: string,
    context?: ResourceContext
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
   * Resolves permitted scope type and concrete unit IDs for a capability
   */
  resolveScopes(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<{ scopeType: ScopeType; unitIds: string[] }>;

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
