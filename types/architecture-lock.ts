/**
 * STQ ARCHITECTURE LOCK — CANONICAL TYPE DEFINITIONS
 * Phase 1: Identity, Organizational Unit, Position, Assignment, Capability, and Scope
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * Document Reference: docs/STQ_ARCHITECTURE_LOCK.md
 * Status: ARCHITECTURE_LOCKED (Pure Contract Types - No Production Runtime Mutation)
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
 * Organizational Unit classification within the institutional tree
 */
export type OrgUnitType =
  | "INSTITUTION"     // STQ Darul Ulum Cendekia (Root)
  | "DOMAIN"          // Ketahfidzhan, Keasramaan, Akademik, dll.
  | "DIVISION"        // OSDA Divisions (Keamanan, Ibadah, Kesehatan, dll.)
  | "HALAQOH"         // Qur'an Halaqoh (Ust. Razan, Ustdz. Lisa, dll.)
  | "KAMAR"           // Asrama Rooms (Abu Bakar, Umar, Putri, dll.)
  | "SERVICE_UNIT"    // TKS Units (Dapur, Masjid, Air, dll.)
  | "USROH"           // Cleaning groups under OSDA Kebersihan
  | "ACADEMIC_CLASS"; // Classes (7A, 7B, 8A, dll.)

/**
 * Gender boundary enforcement for organizational units
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
  defaultScope: ScopeType;
  isLeadership: boolean;
  requiresPersonalAccount: boolean;
  isActive: boolean;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Scope Types for fine-grained authorization containment
 */
export type ScopeType =
  | "GLOBAL"          // Seluruh institusi (Mudir, Yayasan)
  | "DOMAIN"          // Seluruh domain fungsional (e.g. Kabid Tahfizh across all halaqoh)
  | "UNIT"            // Unit organisasi spesifik penugasan
  | "ASSIGNED_UNITS"  // Koleksi beberapa unit spesifik (e.g. Mudabbir membina Kamar 1 & Kamar 2)
  | "HALAQOH"         // Halaqoh binaan sendiri (Musyrif Tahfizh)
  | "KAMAR"           // Kamar asrama binaan sendiri (Mudabbir)
  | "OWN_CHILD"       // Data santri anak kandung (Wali Santri)
  | "SELF";           // Data rekam medis/akademik pribadi (Santri/Staff)

/**
 * Lifecycle status of an individual assignment
 */
export type AssignmentStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED";

/**
 * Canonical Assignment
 * Connects an Identity (User / Staff) to a Position within an OrgUnit under an active Scope.
 */
export interface Assignment {
  id: string;
  userId?: string | null;
  staffId?: string | null;
  positionId: string;
  unitId: string;
  scopeType: ScopeType;
  customScopeIds?: string[] | null;
  status: AssignmentStatus;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
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
  [key: string]: unknown;
}

/**
 * Outcome of an authorization evaluation
 */
export interface AuthorizationResult {
  allowed: boolean;
  code:
    | "ALLOWED"
    | "UNAUTHENTICATED"
    | "CAPABILITY_NOT_GRANTED"
    | "SCOPE_MISMATCH"
    | "ASSIGNMENT_EXPIRED"
    | "IDENTITY_NOT_LINKED"
    | "GENDER_COMPLEX_DENIED";
  reason?: string;
  effectiveScope?: ScopeType;
  assignmentId?: string;
  positionCode?: string;
  unitId?: string;
}

/**
 * Public contract for the Canonical Server-Side Authorization Engine
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
   * Resolves permitted resource IDs for a capability (e.g. list of halaqoh IDs or kamar IDs)
   */
  resolvePermittedScopeIds(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<{ scopeType: ScopeType; ids: string[] }>;
}

/**
 * Operational Kiosk / Unit Account Executor Attribution
 * When an operational shared account (e.g. OSDA, Poskestren, Dapur) performs a mutation,
 * the human executor must be identified for non-repudiation.
 */
export interface UnitAccountExecutorContext {
  technicalAccountId: string;
  technicalAccountUsername: string;
  humanExecutorId?: string | null;
  humanExecutorName: string;
  unitId: string;
  assignmentId: string;
}

/**
 * Forensic Audit Record Interface
 */
export interface CanonicalAuditRecord {
  id: string;
  technicalAccountId: string;
  humanExecutorId?: string | null;
  humanExecutorName?: string | null;
  action: string;
  entity: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  capabilityCode: string;
  assignmentId?: string | null;
  scopeType: ScopeType;
  resourceContext?: Record<string, unknown> | null;
  reason?: string | null;
  clientRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}
