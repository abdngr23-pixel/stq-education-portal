/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Production Readiness Diagnostic Framework
 * Milestone 3.3C1 — STQ Education Portal
 *
 * Evaluates canonical production readiness gates without executing any mutations or repairs.
 * Missing prerequisites are reported strictly as BLOCKED / NOT_READY.
 * STRICTLY READ-ONLY: Executes zero INSERT, UPDATE, DELETE, SEED, or MIGRATION operations.
 */

import {
  ACADEMIC_CAPABILITIES,
  OSDA_STRUCTURE_CONTRACT,
  TKS_STRUCTURE_CONTRACT,
  OSDA_PUTRI_UNIT_CONTRACT,
  UAT_ACTIVATION_TARGETS,
  ResolvedResourceContext,
} from "@/types/architecture-lock";
import { CANONICAL_POSITION_CODES } from "@/lib/auth/compatibility";
import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
} from "@/lib/auth/canonical-evaluator";

export type ReadinessStatus = "READY" | "BLOCKED" | "NOT_READY";

export interface ReadinessGateResult {
  gate: string;
  status: ReadinessStatus;
  details: string;
  reason?: string;
  remediationAdvice?: string;
  blocking?: boolean;
}

export interface ProductionReadinessReport {
  overallStatus: ReadinessStatus;
  timestamp: string;
  gates: ReadinessGateResult[];
  unlinkedStaffAccounts: string[];
}

export interface ReadinessDbClient {
  $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  user?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      username: string;
      status: string;
      role: string;
      staffId: string | null;
      accountType?: string;
      [key: string]: any;
    }>>;
  };
  staff?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      status: string;
      [key: string]: any;
    }>>;
  };
  orgUnit?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      code: string;
      isActive?: boolean;
      [key: string]: any;
    }>>;
  };
  position?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      code: string;
      isActive?: boolean;
      requiresPersonalAccount?: boolean;
      capabilities?: any[];
      [key: string]: any;
    }>>;
  };
  positionCapability?: {
    findMany: (args?: any) => Promise<Array<{
      id?: string;
      positionId: string;
      capabilityCode: string;
      scopeType?: string;
      businessRuleState: string;
      [key: string]: any;
    }>>;
  };
  capability?: {
    findMany: (args?: any) => Promise<Array<{ code: string; [key: string]: any }>>;
  };
  santri?: {
    findMany: (args?: any) => Promise<Array<{ id: string; nis?: string; nama?: string; status?: string; cohortId?: string | null; halaqohId?: string | null; [key: string]: any }>>;
    findFirst?: (args?: any) => Promise<any>;
    findUnique?: (args?: any) => Promise<any>;
  };
  santriKamarPlacement?: {
    findMany?: (args?: any) => Promise<any>;
    findFirst?: (args?: any) => Promise<any>;
  };
  assignmentScopeUnit?: {
    findMany?: (args?: any) => Promise<any>;
    findFirst?: (args?: any) => Promise<any>;
  };
  educationCohort?: {
    findMany: (args?: any) => Promise<Array<{ id: string; code: string; isActive: boolean; [key: string]: any }>>;
  };
  mataPelajaran?: {
    findMany: (args?: any) => Promise<Array<{ id: string; nama: string; kodeMapel?: string; [key: string]: any }>>;
  };
  teachingAssignment?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      mapelId?: string;
      mapel?: { id?: string; nama: string; kodeMapel?: string };
      staffId?: string | null;
      staff?: { id: string; status: string; [key: string]: any };
      user?: { id: string; status: string; accountType?: string; [key: string]: any };
      assignment?: any;
      educationTrack: string;
      genderComplex: string;
      pedagogicalLevel?: string | null;
      isActive: boolean;
      validFrom?: Date;
      validUntil?: Date | null;
      [key: string]: any;
    }>>;
  };
  assignment?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      userId?: string;
      user?: any;
      positionId?: string;
      position?: { id?: string; code: string; name?: string; domain?: string; isActive?: boolean; capabilities?: any[]; [key: string]: any };
      unitId?: string;
      unit?: { id?: string; code: string; name?: string; isActive?: boolean; [key: string]: any };
      status: string;
      validFrom?: Date;
      validUntil: Date | null;
      [key: string]: any;
    }>>;
  };
  educationSession?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      educationTrack: string;
      subjectId: string;
      cohortId?: string | null;
      programLevel?: number | null;
      genderGroup?: string | null;
      scheduledStaffId?: string | null;
      actualTeacherUserId?: string | null;
      scheduledTeacherAssignmentId?: string | null;
      status?: string;
      [key: string]: any;
    }>>;
    findFirst?: (args?: any) => Promise<any>;
  };
  [key: string]: any;
}

export const CANONICAL_READINESS_GATE_NAMES = [
  "M3_3A_SCHEMA_READY",
  "M3_3B_SCHEMA_READY",
  "CANONICAL_AUDIT_READY",
  "STAFF_LINKAGE_READY",
  "REQUIRED_ORG_UNITS_READY",
  "REQUIRED_POSITIONS_READY",
  "CAPABILITIES_REGISTERED",
  "USER_ASSIGNMENTS_READY",
  "TEACHING_ASSIGNMENTS_READY",
  "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY",
  "STALE_POSITION_CAPABILITY_POLICY_READY",
  "COHORTS_ASSIGNED",
  "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
  "RUNTIME_ACTIVATION_FLAG",
] as const;

/**
 * Required OrgUnits derived programmatically from canonical contract constants
 */
export const CANONICAL_REQUIRED_ORG_UNIT_CODES = [
  OSDA_STRUCTURE_CONTRACT.NODE.code,
  OSDA_PUTRI_UNIT_CONTRACT.NODE.code,
  TKS_STRUCTURE_CONTRACT.NODE.code,
] as const;

/**
 * Required Position codes derived programmatically from approved UAT targets + verified managerial positions
 * Strictly excludes unapproved / invented codes (e.g. PEMBINA_ASRAMA)
 */
export const CANONICAL_REQUIRED_POSITION_CODES = [
  CANONICAL_POSITION_CODES.MUDIR,
  CANONICAL_POSITION_CODES.KABID_TAHFIZH,
  CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN,
  UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.positionCode,
  UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.positionCode,
  UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.positionCode,
  UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.positionCode,
  CANONICAL_POSITION_CODES.GURU_KEPESANTRENAN,
] as const;

/**
 * Programmatically derived UAT activation capability targets:
 * 1. Education session activation capabilities (4 items)
 * 2. Approved UAT target capabilities from UAT_ACTIVATION_TARGETS manifest (4 items)
 * Deferred capabilities (academic.score.input, academic.rapor.print, etc.) are excluded.
 */
export const EDUCATION_SESSION_ACTIVATION_CAPABILITIES = [
  ACADEMIC_CAPABILITIES.SCHEDULE_READ,
  ACADEMIC_CAPABILITIES.SESSION_START,
  ACADEMIC_CAPABILITIES.MATERIAL_RECORD,
  ACADEMIC_CAPABILITIES.ATTENDANCE_RECORD,
] as const;

export const APPROVED_UAT_TARGET_CAPABILITY_CODES = [
  UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].capabilityCode,
  UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.capabilityCode,
  UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].capabilityCode,
  UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].capabilityCode,
] as const;

export const REQUIRED_UAT_ACTIVATION_CAPABILITIES = [
  ...EDUCATION_SESSION_ACTIVATION_CAPABILITIES,
  ...APPROVED_UAT_TARGET_CAPABILITY_CODES,
] as const;

export const REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES = [
  ACADEMIC_CAPABILITIES.SCHEDULE_READ,
  ACADEMIC_CAPABILITIES.SESSION_START,
  ACADEMIC_CAPABILITIES.MATERIAL_RECORD,
] as const;

export const REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES = [
  ACADEMIC_CAPABILITIES.SCHEDULE_READ,
  ACADEMIC_CAPABILITIES.SESSION_START,
  ACADEMIC_CAPABILITIES.MATERIAL_RECORD,
  ACADEMIC_CAPABILITIES.ATTENDANCE_RECORD,
] as const;

/**
 * Approved UAT target effective grant policy definitions (M3.3C1).
 * Declarative policy manifest for approved UAT targets.
 * Note: businessRuleState remains APPROVED_TARGET_PENDING_TECHNICAL (ZERO runtime authority before M3.3C2).
 */
export interface UatTargetPolicySpec {
  positionCode: string;
  capabilityCode: string;
  expectedScope: "GLOBAL" | "ASSIGNED_UNITS" | "HALAQOH";
  expectedBusinessState: "APPROVED_TARGET_PENDING_TECHNICAL";
}

export const CANONICAL_UAT_TARGET_POLICIES: readonly UatTargetPolicySpec[] = [
  {
    positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.positionCode,
    capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].capabilityCode,
    expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].scopeType as "GLOBAL",
    expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[0].businessRuleState as "APPROVED_TARGET_PENDING_TECHNICAL",
  },
  {
    positionCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.positionCode,
    capabilityCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.capabilityCode,
    expectedScope: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.scopeType as "HALAQOH",
    expectedBusinessState: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.MUSYRIF_TAHFIZH.businessRuleState as "APPROVED_TARGET_PENDING_TECHNICAL",
  },
  {
    positionCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.positionCode,
    capabilityCode: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.capabilityCode,
    expectedScope: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.scopeType as "HALAQOH",
    expectedBusinessState: UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT.PEMBINA_HALAQOH.businessRuleState as "APPROVED_TARGET_PENDING_TECHNICAL",
  },
  {
    positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.positionCode,
    capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].capabilityCode,
    expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].scopeType as "ASSIGNED_UNITS",
    expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].businessRuleState as "APPROVED_TARGET_PENDING_TECHNICAL",
  },
  {
    positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.positionCode,
    capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].capabilityCode,
    expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].scopeType as "ASSIGNED_UNITS",
    expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[1].businessRuleState as "APPROVED_TARGET_PENDING_TECHNICAL",
  },
] as const;

/**
 * Required Teaching Assignment coverage targets:
 * Exactly 12 Kepesantrenan scheduling coverage targets:
 * - 7 Kepesantrenan Putra slots (Bahasa Arab T1, T2, T3, Fikih, Tafsir, Aqidah, Tajwid)
 * - 5 Kepesantrenan Putri slots (Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid)
 * Note: Studi Umum authorization is binding-based (AcademicSubjectAccountBinding),
 * NOT TeachingAssignment-based.
 */
export interface TeachingAssignmentCoverageTarget {
  key: string;
  track: "STUDI_UMUM" | "KEPESANTRENAN";
  subjectName: string;
  subjectAliases?: string[];
  genderComplex?: "PUTRA" | "PUTRI";
  pedagogicalLevel?: "TINGKAT_1" | "TINGKAT_2" | "TINGKAT_3";
}

export const CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS: readonly TeachingAssignmentCoverageTarget[] = [
  // Kepesantrenan PUTRA: 7 canonical slots
  { key: "KEPESANTRENAN:PUTRA:Bahasa Arab:TINGKAT_1", track: "KEPESANTRENAN", subjectName: "Bahasa Arab", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_1" },
  { key: "KEPESANTRENAN:PUTRA:Bahasa Arab:TINGKAT_2", track: "KEPESANTRENAN", subjectName: "Bahasa Arab", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_2" },
  { key: "KEPESANTRENAN:PUTRA:Bahasa Arab:TINGKAT_3", track: "KEPESANTRENAN", subjectName: "Bahasa Arab", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_3" },
  { key: "KEPESANTRENAN:PUTRA:Fikih", track: "KEPESANTRENAN", subjectName: "Fikih", subjectAliases: ["Fiqih", "Fiqih Ibadah"], genderComplex: "PUTRA" },
  { key: "KEPESANTRENAN:PUTRA:Tafsir", track: "KEPESANTRENAN", subjectName: "Tafsir", genderComplex: "PUTRA" },
  { key: "KEPESANTRENAN:PUTRA:Aqidah", track: "KEPESANTRENAN", subjectName: "Aqidah", subjectAliases: ["Aqidah Islamiyah"], genderComplex: "PUTRA" },
  { key: "KEPESANTRENAN:PUTRA:Tajwid", track: "KEPESANTRENAN", subjectName: "Tajwid", genderComplex: "PUTRA" },

  // Kepesantrenan PUTRI: 5 canonical slots
  { key: "KEPESANTRENAN:PUTRI:Bahasa Arab", track: "KEPESANTRENAN", subjectName: "Bahasa Arab", genderComplex: "PUTRI" },
  { key: "KEPESANTRENAN:PUTRI:Fikih", track: "KEPESANTRENAN", subjectName: "Fikih", subjectAliases: ["Fiqih", "Fiqih Ibadah"], genderComplex: "PUTRI" },
  { key: "KEPESANTRENAN:PUTRI:Tafsir", track: "KEPESANTRENAN", subjectName: "Tafsir", genderComplex: "PUTRI" },
  { key: "KEPESANTRENAN:PUTRI:Aqidah", track: "KEPESANTRENAN", subjectName: "Aqidah", subjectAliases: ["Aqidah Islamiyah"], genderComplex: "PUTRI" },
  { key: "KEPESANTRENAN:PUTRI:Tajwid", track: "KEPESANTRENAN", subjectName: "Tajwid", genderComplex: "PUTRI" },
] as const;

/**
 * Required academic capabilities for Kepesantrenan runtime authorization.
 * Evaluated under KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY gate.
 */
export const KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES = [
  ACADEMIC_CAPABILITIES.SCHEDULE_READ,
  ACADEMIC_CAPABILITIES.SESSION_START,
  ACADEMIC_CAPABILITIES.MATERIAL_RECORD,
  ACADEMIC_CAPABILITIES.ATTENDANCE_RECORD,
] as const;

/**
 * Owner-Approved Kepesantrenan Academic Authority Policy Manifest.
 * Represents ONLY explicit owner-approved position-to-capability-and-scope mappings
 * for Kepesantrenan academic runtime authority.
 *
 * Owner policy defined for GURU_KEPESANTRENAN teacher self-service.
 */
export interface KepesantrenanApprovedAcademicAuthPolicy {
  positionCode: string;
  capabilityCode: string;
  scopeType: string;
}

export const KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES: readonly KepesantrenanApprovedAcademicAuthPolicy[] = [
  {
    positionCode: "GURU_KEPESANTRENAN",
    capabilityCode: "academic.schedule.read",
    scopeType: "GLOBAL",
  },
  {
    positionCode: "GURU_KEPESANTRENAN",
    capabilityCode: "academic.session.start",
    scopeType: "GLOBAL",
  },
  {
    positionCode: "GURU_KEPESANTRENAN",
    capabilityCode: "academic.material.record",
    scopeType: "GLOBAL",
  },
  {
    positionCode: "GURU_KEPESANTRENAN",
    capabilityCode: "academic.attendance.record",
    scopeType: "GLOBAL",
  },
];

export interface KepesantrenanAuthPolicyEvaluationOptions {
  approvedPolicies?: readonly KepesantrenanApprovedAcademicAuthPolicy[];
}

export interface KepesantrenanAuthPolicyEvaluationResult {
  status: ReadinessStatus;
  details: string;
  reason?: string;
  remediationAdvice?: string;
  blocking: true;
}

/**
 * Evaluates runtime authorization policy readiness for Kepesantrenan actions.
 * Fail-closed: Requires explicit match on positionCode, capabilityCode, scopeType,
 * and businessRuleState === "VERIFIED_PRODUCTION" against KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES.
 */
export function evaluateKepesantrenanAcademicAuthPolicies(
  activePcs: Array<{
    capabilityCode: string;
    scopeType?: string | null;
    businessRuleState?: string | null;
    position?: { code?: string; isActive?: boolean } | null;
  }>,
  options?: KepesantrenanAuthPolicyEvaluationOptions
): KepesantrenanAuthPolicyEvaluationResult {
  const approvedPolicies = options?.approvedPolicies ?? KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES;

  // If approved policies manifest is empty, fail-closed immediately:
  if (!approvedPolicies || approvedPolicies.length === 0) {
    return {
      status: "NOT_READY",
      details: "OWNER_APPROVED_KEPESANTRENAN_ACADEMIC_POLICY_NOT_DEFINED: No owner-approved Kepesantrenan academic PositionCapability policy has been defined (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)",
      remediationAdvice: "Awaiting owner/governance approval of Kepesantrenan academic PositionCapability policy manifest and formal promotion to VERIFIED_PRODUCTION in M3.3C2",
      blocking: true,
    };
  }

  // Required capability coverage:
  // Validate that approvedPolicies contains at least one explicit owner-approved policy entry for EACH required capability.
  const coveredCapabilities = new Set(approvedPolicies.map((p) => p.capabilityCode));
  const missingRequiredCaps = KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES.filter(
    (cap) => !coveredCapabilities.has(cap)
  );
  if (missingRequiredCaps.length > 0) {
    return {
      status: "NOT_READY",
      details: `OWNER_APPROVED_KEPESANTRENAN_POLICY_INCOMPLETE: Missing owner-approved policy definitions for required capabilities: ${missingRequiredCaps.join(", ")} (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)`,
      remediationAdvice: `Owner-approved manifest must define explicit policy mappings for all required capabilities: ${KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES.join(", ")}`,
      blocking: true,
    };
  }

  // If no active PositionCapabilities exist in database:
  if (!activePcs || activePcs.length === 0) {
    return {
      status: "NOT_READY",
      details: "No active PositionCapability rows provisioned in database matching owner-approved policies (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)",
      remediationAdvice: "Requires provisioning explicit PositionCapability records matching approved policies in M3.3C2",
      blocking: true,
    };
  }

  // Must verify that EVERY approved policy entry is satisfied by an active PositionCapability in DB:
  // - position.code must match approvedPolicy.positionCode exactly (no legacy role, no username, no capability-alone match)
  // - capabilityCode must match approvedPolicy.capabilityCode exactly
  // - scopeType must be explicit, not null/undefined/empty, and must match approvedPolicy.scopeType exactly
  // - businessRuleState must equal "VERIFIED_PRODUCTION"
  const missingPolicies: string[] = [];
  const pendingTechnical: string[] = [];
  const proposedTbd: string[] = [];
  const scopeMismatches: string[] = [];
  const invalidScope: string[] = [];
  const verifiedPolicies: string[] = [];

  // Detect any unapproved PositionCapability rows for the 4 Kepesantrenan academic capabilities
  const kepesantrenanCapSet = new Set<string>(KEPESANTRENAN_REQUIRED_ACADEMIC_AUTH_CAPABILITIES);
  const unapprovedVerified: string[] = [];
  const unapprovedPending: string[] = [];

  for (const pc of activePcs) {
    if (!kepesantrenanCapSet.has(pc.capabilityCode)) continue;
    const posCode = pc.position?.code;
    const isApproved = approvedPolicies.some(
      (ap) => ap.positionCode === posCode && ap.capabilityCode === pc.capabilityCode && ap.scopeType === pc.scopeType
    );

    if (!isApproved) {
      const desc = `${posCode || "UNKNOWN"}:${pc.capabilityCode}:${pc.scopeType || "NONE"}`;
      if (pc.businessRuleState === "VERIFIED_PRODUCTION") {
        unapprovedVerified.push(desc);
      } else {
        unapprovedPending.push(desc);
      }
    }
  }

  // Priority 1: Unauthorized VERIFIED authority has highest severity (immediately BLOCKED)
  if (unapprovedVerified.length > 0) {
    return {
      status: "BLOCKED",
      blocking: true,
      reason: "UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY",
      details: `UNAUTHORIZED_KEPESANTRENAN_ACADEMIC_RUNTIME_AUTHORITY: Unapproved PositionCapability rows with VERIFIED_PRODUCTION status detected for Kepesantrenan academic capabilities: ${unapprovedVerified.join(", ")}`,
      remediationAdvice: "Revoke and remove unauthorized VERIFIED_PRODUCTION PositionCapability rows immediately",
    };
  }

  // Priority 2: Unapproved pending authority prevents readiness (immediately NOT_READY)
  if (unapprovedPending.length > 0) {
    return {
      status: "NOT_READY",
      blocking: true,
      reason: "UNAPPROVED_KEPESANTRENAN_ACADEMIC_POLICY_PRESENT",
      details: `UNAPPROVED_KEPESANTRENAN_ACADEMIC_POLICY_PRESENT: Unapproved PositionCapability rows detected for Kepesantrenan academic capabilities: ${unapprovedPending.join(", ")}`,
      remediationAdvice: "Remove unapproved PositionCapability records from database",
    };
  }

  for (const policy of approvedPolicies) {
    const policyKey = `${policy.positionCode}:${policy.capabilityCode}:${policy.scopeType}`;

    // Find candidate by position.code + capabilityCode
    const matchingCandidates = activePcs.filter(
      (pc) => pc.position?.code === policy.positionCode && pc.capabilityCode === policy.capabilityCode
    );

    if (matchingCandidates.length === 0) {
      missingPolicies.push(policyKey);
      continue;
    }

    // Strict scope validation: scopeType must be explicit, not null/undefined/empty
    const hasUndefinedOrNullScope = matchingCandidates.some(
      (pc) => pc.scopeType === null || pc.scopeType === undefined || (typeof pc.scopeType === "string" && pc.scopeType.trim() === "")
    );
    if (hasUndefinedOrNullScope) {
      invalidScope.push(`${policyKey} (scopeType is undefined/null/empty)`);
    }

    const exactMatch = matchingCandidates.find((pc) => {
      if (!pc.scopeType || pc.scopeType !== policy.scopeType) return false;
      if (pc.businessRuleState !== "VERIFIED_PRODUCTION") return false;
      return true;
    });

    if (exactMatch) {
      verifiedPolicies.push(policyKey);
    } else {
      const withScopeMatch = matchingCandidates.filter((pc) => pc.scopeType === policy.scopeType);
      if (withScopeMatch.length > 0) {
        if (withScopeMatch.some((pc) => pc.businessRuleState === "APPROVED_TARGET_PENDING_TECHNICAL")) {
          pendingTechnical.push(policyKey);
        } else if (withScopeMatch.some((pc) => pc.businessRuleState === "PROPOSED_TBD")) {
          proposedTbd.push(policyKey);
        } else {
          missingPolicies.push(policyKey);
        }
      } else {
        const actualScopes = matchingCandidates.map((pc) => pc.scopeType ?? "undefined").join(", ");
        scopeMismatches.push(`${policyKey} (actual scope: [${actualScopes}], expected: ${policy.scopeType})`);
      }
    }
  }

  if (verifiedPolicies.length === approvedPolicies.length) {
    return {
      status: "READY",
      details: `Kepesantrenan academic runtime authorization policy verified with active VERIFIED_PRODUCTION grants for: ${verifiedPolicies.join(", ")}`,
      blocking: true,
    };
  }

  if (invalidScope.length > 0) {
    return {
      status: "NOT_READY",
      details: `Kepesantrenan academic policy has invalid/undefined scopeType: ${invalidScope.join("; ")} (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)`,
      remediationAdvice: "scopeType must be explicit and valid",
      blocking: true,
    };
  }

  if (scopeMismatches.length > 0) {
    return {
      status: "NOT_READY",
      details: `Kepesantrenan academic policy scope mismatch against approved manifest: ${scopeMismatches.join("; ")} (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)`,
      remediationAdvice: "PositionCapability scopeType must match owner-approved policy manifest exactly",
      blocking: true,
    };
  }

  if (pendingTechnical.length > 0) {
    return {
      status: "NOT_READY",
      details: `Kepesantrenan academic policy grant is APPROVED_TARGET_PENDING_TECHNICAL for: ${pendingTechnical.join("; ")} (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY: policy approved but not runtime authoritative)`,
      remediationAdvice: "Requires formal promotion of APPROVED_TARGET_PENDING_TECHNICAL policy to VERIFIED_PRODUCTION in M3.3C2",
      blocking: true,
    };
  }

  if (proposedTbd.length > 0) {
    return {
      status: "NOT_READY",
      details: `Kepesantrenan academic policy grant is PROPOSED_TBD for: ${proposedTbd.join(", ")} (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)`,
      remediationAdvice: "PROPOSED_TBD policies must be reviewed and approved by owner before runtime activation",
      blocking: true,
    };
  }

  return {
    status: "NOT_READY",
    details: `Missing owner-approved Kepesantrenan academic authorization policies: ${missingPolicies.join(", ")} (KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY)`,
    remediationAdvice: "Requires explicit PositionCapability mappings with VERIFIED_PRODUCTION matching approved policy manifest",
    blocking: true,
  };
}

export interface StalePositionCapabilityPolicyEvaluationResult {
  status: ReadinessStatus;
  details: string;
  blocking: true;
  remediationAdvice?: string;
}

/**
 * Evaluates stale PositionCapability policy cleanup (M3.3C2 gate).
 * Explicitly rejects stale PETUGAS_OPERASIONAL_TAHFIZH -> tahfizh.reward.issue policy.
 * - If absent: READY
 * - If APPROVED_TARGET_PENDING_TECHNICAL or PROPOSED_TBD: NOT_READY, blocking=true
 * - If VERIFIED_PRODUCTION: BLOCKED, blocking=true
 */
export function evaluateStalePositionCapabilityPolicy(
  staleRows: Array<{
    positionCode?: string;
    capabilityCode?: string;
    businessRuleState?: string | null;
  }>
): StalePositionCapabilityPolicyEvaluationResult {
  if (!staleRows || staleRows.length === 0) {
    return {
      status: "READY",
      details: "No stale PETUGAS_OPERASIONAL_TAHFIZH / tahfizh.reward.issue policy rows found",
      blocking: true,
    };
  }

  const verified = staleRows.filter((r) => r.businessRuleState === "VERIFIED_PRODUCTION");
  if (verified.length > 0) {
    return {
      status: "BLOCKED",
      details: "UNAUTHORIZED_STALE_RUNTIME_AUTHORITY: Stale PETUGAS_OPERASIONAL_TAHFIZH / tahfizh.reward.issue row exists with VERIFIED_PRODUCTION status",
      remediationAdvice: "Revoke and remove unauthorized VERIFIED_PRODUCTION stale authority immediately",
      blocking: true,
    };
  }

  return {
    status: "NOT_READY",
    details: "STALE_POSITION_CAPABILITY_POLICY_REQUIRES_CLEANUP: Stale PETUGAS_OPERASIONAL_TAHFIZH / tahfizh.reward.issue row exists and requires cleanup before activation",
    remediationAdvice: "Remove stale PETUGAS_OPERASIONAL_TAHFIZH / tahfizh.reward.issue target row in database",
    blocking: true,
  };
}

/**
 * Diagnostic function: Evaluates all canonical production readiness gates.
 * STRICTLY READ-ONLY: Executes zero INSERT, UPDATE, DELETE, SEED, or MIGRATION operations.
 */
export async function checkPendidikanV2ProductionReadiness(
  db: ReadinessDbClient
): Promise<ProductionReadinessReport> {
  const gates: ReadinessGateResult[] = [];
  const unlinkedStaffAccounts: string[] = [];

  // Gate 1: M3.3A Schema Applied (Exact tables: health_cases_v2, health_case_v2_events; Enum: HealthStatusV2)
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const tables = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema IN ('public', CURRENT_SCHEMA) 
          AND table_name IN ('health_cases_v2', 'health_case_v2_events');
      `);
      const set = new Set(tables.map((t) => t.table_name));
      const missing = ['health_cases_v2', 'health_case_v2_events'].filter((t) => !set.has(t));

      const enums = await db.$queryRawUnsafe<Array<{ typname: string }>>(`
        SELECT typname FROM pg_type WHERE typname = 'HealthStatusV2';
      `);
      const enumSet = new Set(enums.map((e) => e.typname));
      const missingEnums = ['HealthStatusV2'].filter((e) => !enumSet.has(e));

      if (missing.length === 0 && missingEnums.length === 0) {
        gates.push({ gate: "M3_3A_SCHEMA_READY", status: "READY", details: "All Health V2 tables and enums exist" });
      } else {
        const issues = [...missing.map((m) => `table:${m}`), ...missingEnums.map((e) => `enum:${e}`)];
        gates.push({
          gate: "M3_3A_SCHEMA_READY",
          status: "NOT_READY",
          details: `Missing Health V2 schema: ${issues.join(", ")}`,
          remediationAdvice: "Requires M3.3C2 migration execution in production",
        });
      }
    } else {
      gates.push({ gate: "M3_3A_SCHEMA_READY", status: "NOT_READY", details: "Database does not support catalog reflection" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "M3_3A_SCHEMA_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 2: M3.3B Schema Applied (Exact tables: education_cohorts, teaching_assignments, education_sessions, education_session_participants, education_session_attendances)
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const eduTables = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema IN ('public', CURRENT_SCHEMA) 
          AND table_name IN ('education_cohorts', 'teaching_assignments', 'education_sessions', 'education_session_participants', 'education_session_attendances');
      `);
      const set = new Set(eduTables.map((t) => t.table_name));
      const missing = ['education_cohorts', 'teaching_assignments', 'education_sessions', 'education_session_participants', 'education_session_attendances'].filter((t) => !set.has(t));

      const eduEnums = await db.$queryRawUnsafe<Array<{ typname: string }>>(`
        SELECT typname FROM pg_type 
        WHERE typname IN ('EducationTrack', 'PedagogicalLevel', 'EducationSessionStatus', 'EducationAttendanceStatus');
      `);
      const enumSet = new Set(eduEnums.map((e) => e.typname));
      const missingEnums = ['EducationTrack', 'PedagogicalLevel', 'EducationSessionStatus', 'EducationAttendanceStatus'].filter((e) => !enumSet.has(e));

      if (missing.length === 0 && missingEnums.length === 0) {
        gates.push({ gate: "M3_3B_SCHEMA_READY", status: "READY", details: "All Pendidikan V2 foundation tables and enums exist" });
      } else {
        const issues = [...missing.map((m) => `table:${m}`), ...missingEnums.map((e) => `enum:${e}`)];
        gates.push({
          gate: "M3_3B_SCHEMA_READY",
          status: "NOT_READY",
          details: `Missing Pendidikan V2 schema: ${issues.join(", ")}`,
          remediationAdvice: "Requires M3.3C2 migration execution in production",
        });
      }
    } else {
      gates.push({ gate: "M3_3B_SCHEMA_READY", status: "NOT_READY", details: "Database does not support catalog reflection" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "M3_3B_SCHEMA_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 3: Canonical Audit Table Ready
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const auditTable = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema IN ('public', CURRENT_SCHEMA) AND table_name = 'canonical_audit_logs';
      `);
      if (auditTable.length > 0) {
        gates.push({ gate: "CANONICAL_AUDIT_READY", status: "READY", details: "canonical_audit_logs table exists" });
      } else {
        gates.push({ gate: "CANONICAL_AUDIT_READY", status: "NOT_READY", details: "canonical_audit_logs table missing" });
      }
    } else {
      gates.push({ gate: "CANONICAL_AUDIT_READY", status: "NOT_READY", details: "Cannot inspect audit table" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "CANONICAL_AUDIT_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 4: Staff Linkage Safety Gate
  // Applies strictly to active PERSONAL accounts requiring human Staff identity.
  // Strictly excludes AccountType.SUBJECT, AccountType.UNIT / ORGANIZATION_UNIT, and inactive accounts.
  try {
    if (db.user) {
      const operationalUsers = await db.user.findMany({
        where: {
          accountType: "PERSONAL",
          status: "AKTIF",
          role: { in: ["GA", "KS", "MT", "PH", "MK"] },
        },
      });

      // Query active staff records to cross-reference
      let activeStaffIds = new Set<string>();
      if (db.staff) {
        const staffRecords = await db.staff.findMany();
        activeStaffIds = new Set(
          staffRecords.filter((s) => s.status === "AKTIF" || s.status === "ACTIVE").map((s) => s.id)
        );
      } else if (typeof db.$queryRawUnsafe === "function") {
        const staffRows = await db.$queryRawUnsafe<Array<{ id: string }>>(`
          SELECT id FROM "staff" WHERE status IN ('AKTIF', 'ACTIVE');
        `).catch(() => []);
        activeStaffIds = new Set(staffRows.map((s) => s.id));
      }

      const blockedAccounts: string[] = [];
      for (const u of operationalUsers) {
        // Semantic filtering guard: only ACTIVE PERSONAL accounts with operational roles
        const accountType = u.accountType || "PERSONAL";
        if (accountType === "SUBJECT" || accountType === "UNIT" || accountType === "ORGANIZATION_UNIT") {
          continue;
        }
        if (accountType !== "PERSONAL") {
          continue;
        }

        const status = u.status || "AKTIF";
        if (status === "NONAKTIF" || status === "SUSPENDED" || (status !== "AKTIF" && status !== "ACTIVE")) {
          continue;
        }

        const operationalRoles = ["GA", "KS", "MT", "PH", "MK"];
        if (!operationalRoles.includes(u.role)) {
          continue;
        }

        const hasLinkedStaff = !!u.staffId;
        const staffIsActive = u.staffId ? activeStaffIds.has(u.staffId) : false;

        if (!hasLinkedStaff || !staffIsActive) {
          unlinkedStaffAccounts.push(u.username);
          blockedAccounts.push(u.username);
        }
      }

      if (blockedAccounts.length > 0) {
        gates.push({
          gate: "STAFF_LINKAGE_READY",
          status: "BLOCKED",
          details: `Operational accounts lacking active linked Staff: ${blockedAccounts.join(", ")}`,
          remediationAdvice: "BLOCKED_IDENTITY_LINKAGE: Cannot authorize via username or display name; requires active User linked to active Staff relation in M3.3C2",
        });
      } else if (activeStaffIds.size === 0) {
        gates.push({
          gate: "STAFF_LINKAGE_READY",
          status: "BLOCKED",
          details: "Zero active staff members found in database",
          remediationAdvice: "BLOCKED_IDENTITY_LINKAGE: No active Staff records found in database",
        });
      } else {
        gates.push({ gate: "STAFF_LINKAGE_READY", status: "READY", details: "All operational accounts have active linked Staff" });
      }
    } else {
      gates.push({ gate: "STAFF_LINKAGE_READY", status: "NOT_READY", details: "User repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "STAFF_LINKAGE_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 5: Required OrgUnits Exist (Approved Canonical Contracts from Architecture Lock / M3.1)
  try {
    if (db.orgUnit) {
      const units = await db.orgUnit.findMany();
      const unitCodes = new Set(units.map((u) => u.code));
      const missing = CANONICAL_REQUIRED_ORG_UNIT_CODES.filter((c) => !unitCodes.has(c));
      if (missing.length === 0) {
        gates.push({ gate: "REQUIRED_ORG_UNITS_READY", status: "READY", details: "All required organizational units exist" });
      } else {
        gates.push({ gate: "REQUIRED_ORG_UNITS_READY", status: "NOT_READY", details: `Missing required OrgUnits: ${missing.join(", ")}` });
      }
    } else {
      gates.push({ gate: "REQUIRED_ORG_UNITS_READY", status: "NOT_READY", details: "OrgUnit repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "REQUIRED_ORG_UNITS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 6: Required Position Templates Exist (Approved Institutional Activation Targets)
  try {
    if (db.position) {
      const positions = await db.position.findMany();
      const codes = new Set(positions.map((p) => p.code));
      const missing = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !codes.has(c));
      if (missing.length === 0) {
        gates.push({ gate: "REQUIRED_POSITIONS_READY", status: "READY", details: "All required position templates exist" });
      } else {
        gates.push({ gate: "REQUIRED_POSITIONS_READY", status: "NOT_READY", details: `Missing positions: ${missing.join(", ")}` });
      }
    } else {
      gates.push({ gate: "REQUIRED_POSITIONS_READY", status: "NOT_READY", details: "Position repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "REQUIRED_POSITIONS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 7: Required Capabilities Registered (Verifies exact required activation capabilities)
  try {
    if (db.capability) {
      const caps = await db.capability.findMany();
      const capCodes = new Set(caps.map((c: any) => c.code));
      const missing = REQUIRED_UAT_ACTIVATION_CAPABILITIES.filter((c) => !capCodes.has(c));
      if (missing.length === 0) {
        gates.push({
          gate: "CAPABILITIES_REGISTERED",
          status: "READY",
          details: `All ${REQUIRED_UAT_ACTIVATION_CAPABILITIES.length} required activation capabilities registered`,
        });
      } else {
        gates.push({
          gate: "CAPABILITIES_REGISTERED",
          status: "NOT_READY",
          details: `Missing required activation capabilities: ${missing.join(", ")}`,
          remediationAdvice: "Requires registration of all required UAT activation capabilities in database",
        });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const rows = await db.$queryRawUnsafe<Array<{ code: string }>>(`
        SELECT "code" FROM "capabilities";
      `).catch(() => []);
      const capCodes = new Set(rows.map((r) => r.code));
      const missing = REQUIRED_UAT_ACTIVATION_CAPABILITIES.filter((c) => !capCodes.has(c));
      if (missing.length === 0) {
        gates.push({
          gate: "CAPABILITIES_REGISTERED",
          status: "READY",
          details: `All ${REQUIRED_UAT_ACTIVATION_CAPABILITIES.length} required activation capabilities registered`,
        });
      } else {
        gates.push({
          gate: "CAPABILITIES_REGISTERED",
          status: "NOT_READY",
          details: `Missing required activation capabilities: ${missing.join(", ")}`,
        });
      }
    } else {
      gates.push({ gate: "CAPABILITIES_REGISTERED", status: "NOT_READY", details: "Capability repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "CAPABILITIES_REGISTERED", status: "NOT_READY", details: String(err) });
  }

  // Gate 8: User Assignments Ready (Verifies active coverage of all approved target positions with active user/position/orgUnit/staff chains and UAT target policy validation)
  try {
    const now = new Date();
    if (db.assignment) {
      const asgs = await db.assignment.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        include: {
          position: true,
          user: true,
          unit: true,
          scopedUnits: {
            include: {
              unit: true,
            },
          },
        },
      });

      const asgScopeUnitsMap = new Map<string, any[]>();
      if (db.assignmentScopeUnit?.findMany && asgs.some((a: any) => !a.scopedUnits)) {
        const allScopeUnits = await db.assignmentScopeUnit.findMany({
          include: { unit: true },
        }).catch(() => []);
        for (const su of allScopeUnits) {
          const list = asgScopeUnitsMap.get(su.assignmentId) || [];
          list.push(su);
          asgScopeUnitsMap.set(su.assignmentId, list);
        }
      }

      let usersMap = new Map<string, any>();
      if (db.user && asgs.some((a: any) => !a.user && a.userId)) {
        const users = await db.user.findMany().catch(() => []);
        usersMap = new Map(users.map((u: any) => [u.id, u]));
      }

      let positionsMap = new Map<string, any>();
      if (db.position) {
        const positions = await db.position.findMany().catch(() => []);
        positionsMap = new Map(positions.map((p: any) => [p.id, p]));
      }

      let unitsMap = new Map<string, any>();
      if (db.orgUnit && asgs.some((a: any) => !a.unit && a.unitId)) {
        const units = await db.orgUnit.findMany().catch(() => []);
        unitsMap = new Map(units.map((u: any) => [u.id, u]));
      }

      let staffMap = new Map<string, any>();
      if (db.staff) {
        const staffs = await db.staff.findMany().catch(() => []);
        staffMap = new Map(staffs.map((s: any) => [s.id, s]));
      }

      const coveredCodes = new Set<string>();
      const assignmentIssues: string[] = [];
      for (const a of asgs) {
        if (a.status !== "ACTIVE") continue;
        if (a.validFrom && new Date(a.validFrom) > now) continue;
        if (a.validUntil && new Date(a.validUntil) < now) continue;

        const pos = a.position || (a.positionId ? positionsMap.get(a.positionId) : null) || (a.positionCode ? { code: a.positionCode, isActive: true } : null);
        if (!pos || pos.isActive === false) continue;

        const unit = a.unit || (a.unitId ? unitsMap.get(a.unitId) : null);
        if (unit && unit.isActive === false) continue;

        const user = a.user || (a.userId ? usersMap.get(a.userId) : null);
        if (!user || !(user.status === "AKTIF" || user.status === "ACTIVE")) continue;

        // Explicit Account Modality Validation (Gate 5 Hardening)
        if (pos.code === "PETUGAS_OPERASIONAL_KEASRAMAAN") {
          if (user.accountType && user.accountType !== "UNIT") {
            assignmentIssues.push(`Assignment ${a.id} for ${pos.code}: user accountType is not UNIT (${user.accountType})`);
            continue;
          }
          if (pos.requiresPersonalAccount === true) {
            assignmentIssues.push(`Assignment ${a.id} for ${pos.code}: position requiresPersonalAccount=true is incompatible with UNIT modality`);
            continue;
          }
        } else if (pos.requiresPersonalAccount !== false) {
          if (user.accountType && user.accountType !== "PERSONAL") {
            assignmentIssues.push(`Assignment ${a.id} for ${pos.code}: user accountType is not PERSONAL (${user.accountType})`);
            continue;
          }
          if (!user.staffId) {
            assignmentIssues.push(`Assignment ${a.id} for ${pos.code}: user ${user.id} missing linked staff (staffId is null)`);
            continue;
          }
          const staff = staffMap.get(user.staffId) || (user.staff ? user.staff : null) || (a.staff ? a.staff : null);
          if (!staff || !(staff.status === "AKTIF" || staff.status === "ACTIVE")) {
            assignmentIssues.push(`Assignment ${a.id} for ${pos.code}: user ${user.id} staffId ${user.staffId} has missing or inactive staff`);
            continue;
          }
        }

        const code = pos.code || a.positionCode;
        if (code) coveredCodes.add(code);
      }

      // Check active Kamar units count
      const activeKamars = Array.from(unitsMap.values()).filter((u) => u.type === "KAMAR" && u.isActive !== false);
      const activeKamarCount = activeKamars.length;

      let missingPositions = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !coveredCodes.has(c));
      let deferredPembinaHalaqoh = false;
      if (activeKamarCount === 0 && missingPositions.includes("PEMBINA_HALAQOH")) {
        // Zero active kamar exists -> PEMBINA_HALAQOH room assignment is deferred
        missingPositions = missingPositions.filter((c) => c !== "PEMBINA_HALAQOH");
        deferredPembinaHalaqoh = true;
      }

      // Gather position capabilities for UAT target policies validation
      const pcsByPosCode = new Map<string, any[]>();
      if (db.positionCapability) {
        const allPcs = await db.positionCapability.findMany().catch(() => []);
        for (const pc of allPcs) {
          const pos = positionsMap.get(pc.positionId) || Array.from(positionsMap.values()).find((p) => p.id === pc.positionId);
          const pCode = pos?.code || pc.positionCode;
          if (pCode) {
            const list = pcsByPosCode.get(pCode) || [];
            list.push(pc);
            pcsByPosCode.set(pCode, list);
          }
        }
      }
      for (const pos of positionsMap.values()) {
        if (pos.code && Array.isArray(pos.capabilities)) {
          const list = pcsByPosCode.get(pos.code) || [];
          for (const c of pos.capabilities) {
            if (!list.some((existing) => (existing.capabilityCode || existing.code) === (c.capabilityCode || c.code))) {
              list.push(c);
            }
          }
          pcsByPosCode.set(pos.code, list);
        }
      }
      for (const a of asgs) {
        const pCode = a.position?.code || (a.positionId ? positionsMap.get(a.positionId)?.code : null) || a.positionCode;
        if (pCode) {
          const caps = a.position?.capabilities || a.capabilities || [];
          if (Array.isArray(caps) && caps.length > 0) {
            const list = pcsByPosCode.get(pCode) || [];
            for (const c of caps) {
              if (!list.some((existing) => (existing.capabilityCode || existing.code) === (c.capabilityCode || c.code))) {
                list.push(c);
              }
            }
            pcsByPosCode.set(pCode, list);
          }
        }
      }

      const policyIssues: string[] = [];
      const pendingTechnicalIssues: string[] = [];

      for (const target of CANONICAL_UAT_TARGET_POLICIES) {
        const pcs = pcsByPosCode.get(target.positionCode) || [];
        const matchPc = pcs.find((p: any) => (p.capabilityCode || p.code || p.capability?.code) === target.capabilityCode);

        if (!matchPc) {
          policyIssues.push(`${target.positionCode}: missing PositionCapability for ${target.capabilityCode}`);
          continue;
        }

        const scope = matchPc.scopeType || matchPc.scope;
        if (scope !== target.expectedScope) {
          policyIssues.push(`${target.positionCode}: target policy scope mismatch for ${target.capabilityCode} (expected ${target.expectedScope}, found ${scope || "NONE"})`);
          continue;
        }

        if (matchPc.businessRuleState !== "VERIFIED_PRODUCTION") {
          if (matchPc.businessRuleState === target.expectedBusinessState) {
            pendingTechnicalIssues.push(`${target.positionCode}: grant ${target.capabilityCode} is APPROVED_TARGET_PENDING_TECHNICAL (TARGET_POLICY_READY, RUNTIME_NOT_READY: POLICY_APPROVED_NOT_RUNTIME_ACTIVE)`);
          } else {
            policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} has invalid state ${matchPc.businessRuleState}`);
          }
        } else {
          // matchPc is VERIFIED_PRODUCTION -> Validate Effective Resource-Scope Readiness from REAL Database
          const matchingAsgs = asgs.filter((a: any) => {
            const pCode = a.position?.code || (a.positionId ? positionsMap.get(a.positionId)?.code : null) || a.positionCode;
            return pCode === target.positionCode;
          });

          for (const asg of matchingAsgs) {
            const user = asg.user || (asg.userId ? usersMap.get(asg.userId) : null);
            if (!user) {
              policyIssues.push(`${target.positionCode}: assignment ${asg.id} has no linked user`);
              continue;
            }

            if (target.expectedScope === "HALAQOH") {
              const anchorUnit = asg.unit?.isActive !== false ? (asg.unitId || asg.unit?.id) : null;

              if (!anchorUnit) {
                policyIssues.push(`${target.positionCode}: assignment ${asg.id} has scope HALAQOH but no active anchor halaqoh configured (TARGET_RESOURCE_SCOPE_NOT_READY)`);
                continue;
              }

              // Resolve ACTUAL active Santri from database
              let repSantri: any = null;
              if (db.santri?.findFirst) {
                repSantri = await db.santri.findFirst({
                  where: {
                    status: "AKTIF",
                    halaqohId: anchorUnit,
                  },
                  select: { id: true, halaqohId: true, status: true },
                }).catch(() => null);
              } else if (db.santri?.findMany) {
                const santris = await db.santri.findMany().catch(() => []);
                repSantri = santris.find((s: any) => (s.status === "AKTIF" || !s.status) && s.halaqohId === anchorUnit) || null;
              }

              if (!repSantri) {
                // Check if any active santri exists outside this halaqoh to distinguish SCOPE_MISMATCH from TARGET_RESOURCE_SCOPE_NOT_READY
                let outsideSantri: any = null;
                if (db.santri?.findFirst) {
                  outsideSantri = await db.santri.findFirst({
                    where: {
                      status: "AKTIF",
                      halaqohId: { not: anchorUnit },
                    },
                    select: { id: true, halaqohId: true },
                  }).catch(() => null);
                } else if (db.santri?.findMany) {
                  const santris = await db.santri.findMany().catch(() => []);
                  outsideSantri = santris.find((s: any) => (s.status === "AKTIF" || !s.status) && s.halaqohId && s.halaqohId !== anchorUnit) || null;
                }

                if (outsideSantri && outsideSantri.halaqohId) {
                  policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} SCOPE_MISMATCH: santri halaqoh ${outsideSantri.halaqohId} does not match assigned halaqoh ${anchorUnit} (runtime NOT_READY)`);
                } else {
                  policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} TARGET_RESOURCE_SCOPE_NOT_READY (no representative active santri found in assigned halaqoh ${anchorUnit})`);
                }
                continue;
              }

              // Perform canonical runtime evaluation against real representative santri
              const mockAssignment: CanonicalAssignmentWithDetails = {
                id: asg.id,
                userId: user.id,
                positionId: asg.positionId || asg.position?.id || "pos-id",
                positionCode: target.positionCode,
                positionName: asg.position?.name || target.positionCode,
                domain: asg.position?.domain || "TAHFIZH",
                unitId: anchorUnit,
                unitCode: asg.unit?.code || "OU-HLQ",
                unitName: asg.unit?.name || "Halaqoh",
                status: "ACTIVE",
                validFrom: asg.validFrom ? new Date(asg.validFrom) : new Date(0),
                validUntil: asg.validUntil ? new Date(asg.validUntil) : null,
                positionCapabilities: [
                  {
                    capabilityCode: target.capabilityCode,
                    scopeType: "HALAQOH",
                    businessRuleState: "VERIFIED_PRODUCTION",
                  },
                ],
                scopeUnits: [],
              };

              const resolvedContext: ResolvedResourceContext = {
                santriId: repSantri.id,
                halaqohId: repSantri.halaqohId,
                orgUnitIds: [repSantri.halaqohId],
                orgDomain: "TAHFIZH",
              };

              const authRes = await authorizeCanonical({
                identity: {
                  userId: user.id,
                  username: user.username || `user-${user.id}`,
                  status: user.status || "AKTIF",
                  accountType: "PERSONAL",
                  staffId: user.staffId,
                  mockAssignments: [mockAssignment],
                } as any,
                capability: target.capabilityCode,
                resourceContext: { santriId: repSantri.id },
                resolvedContext,
              });

              if (authRes.decision !== "ALLOW") {
                policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} ${authRes.code}: ${authRes.reason} (runtime NOT_READY)`);
              }
            } else if (target.expectedScope === "ASSIGNED_UNITS") {
              const anchorUnit = asg.unit?.isActive !== false ? (asg.unitId || asg.unit?.id) : null;
              const suList = asg.scopedUnits || asg.scopeUnits || asgScopeUnitsMap.get(asg.id) || [];
              const scopedUnits = suList
                .filter((su: any) => (su.unit ? su.unit.isActive !== false : true))
                .map((su: any) => su.unitId || su.unit?.id)
                .filter(Boolean);
              const permittedUnits = Array.from(new Set([anchorUnit, ...scopedUnits].filter(Boolean)));

              if (permittedUnits.length === 0) {
                policyIssues.push(`${target.positionCode}: assignment ${asg.id} has scope ASSIGNED_UNITS but zero active anchor or scoped units configured (TARGET_RESOURCE_SCOPE_NOT_READY)`);
                continue;
              }

              if (target.positionCode === "PETUGAS_OPERASIONAL_TAHFIZH") {
                // Real Tahfizh Representative Resource: find active santri whose halaqoh is in permittedUnits
                let targetSantri: any = null;
                if (db.santri?.findFirst) {
                  targetSantri = await db.santri.findFirst({
                    where: {
                      status: "AKTIF",
                      halaqohId: { in: permittedUnits },
                    },
                    select: { id: true, halaqohId: true, status: true },
                  }).catch(() => null);
                } else if (db.santri?.findMany) {
                  const santris = await db.santri.findMany().catch(() => []);
                  targetSantri = santris.find((s: any) => (s.status === "AKTIF" || !s.status) && s.halaqohId && permittedUnits.includes(s.halaqohId)) || null;
                }

                if (!targetSantri) {
                  // Check if active santri exists outside permittedUnits
                  let outsideSantri: any = null;
                  if (db.santri?.findFirst) {
                    outsideSantri = await db.santri.findFirst({
                      where: {
                        status: "AKTIF",
                        halaqohId: { notIn: permittedUnits },
                      },
                      select: { id: true, halaqohId: true },
                    }).catch(() => null);
                  } else if (db.santri?.findMany) {
                    const santris = await db.santri.findMany().catch(() => []);
                    outsideSantri = santris.find((s: any) => (s.status === "AKTIF" || !s.status) && s.halaqohId && !permittedUnits.includes(s.halaqohId)) || null;
                  }

                  if (outsideSantri && outsideSantri.halaqohId) {
                    policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} SCOPE_MISMATCH: resource units [${outsideSantri.halaqohId}] not in assigned units [${permittedUnits.join(", ")}] (runtime NOT_READY)`);
                  } else {
                    policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} TARGET_RESOURCE_SCOPE_NOT_READY (no representative active santri found in assigned units [${permittedUnits.join(", ")}])`);
                  }
                  continue;
                }

                // Canonical runtime check
                const mockAssignment: CanonicalAssignmentWithDetails = {
                  id: asg.id,
                  userId: user.id,
                  positionId: asg.positionId || asg.position?.id || "pos-id",
                  positionCode: target.positionCode,
                  positionName: asg.position?.name || target.positionCode,
                  domain: asg.position?.domain || "TAHFIZH",
                  unitId: anchorUnit || permittedUnits[0],
                  unitCode: asg.unit?.code || "OU-TAF",
                  unitName: asg.unit?.name || "Tahfizh",
                  status: "ACTIVE",
                  validFrom: asg.validFrom ? new Date(asg.validFrom) : new Date(0),
                  validUntil: asg.validUntil ? new Date(asg.validUntil) : null,
                  positionCapabilities: [
                    {
                      capabilityCode: target.capabilityCode,
                      scopeType: "ASSIGNED_UNITS",
                      businessRuleState: "VERIFIED_PRODUCTION",
                    },
                  ],
                  scopeUnits: scopedUnits.map((u: string) => ({ unitId: u })),
                };

                const resolvedContext: ResolvedResourceContext = {
                  santriId: targetSantri.id,
                  halaqohId: targetSantri.halaqohId,
                  orgUnitIds: [targetSantri.halaqohId],
                  orgDomain: "TAHFIZH",
                };

                const authRes = await authorizeCanonical({
                  identity: {
                    userId: user.id,
                    username: user.username || `user-${user.id}`,
                    status: user.status || "AKTIF",
                    accountType: "PERSONAL",
                    staffId: user.staffId,
                    mockAssignments: [mockAssignment],
                  } as any,
                  capability: target.capabilityCode,
                  resourceContext: { santriId: targetSantri.id },
                  resolvedContext,
                });

                if (authRes.decision !== "ALLOW") {
                  policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} ${authRes.code}: ${authRes.reason} (runtime NOT_READY)`);
                }
              } else if (target.positionCode === "PETUGAS_OPERASIONAL_KEASRAMAAN") {
                // Real Keasramaan Representative Resource: find active SantriKamarPlacement in permittedUnits
                let activePlacement: any = null;
                if (db.santriKamarPlacement?.findFirst) {
                  activePlacement = await db.santriKamarPlacement.findFirst({
                    where: {
                      isActive: true,
                      kamarId: { in: permittedUnits },
                      santri: { status: "AKTIF" },
                    },
                    include: { kamar: true, santri: true },
                  }).catch(() => null);
                } else if (db.santriKamarPlacement?.findMany) {
                  const placements = await db.santriKamarPlacement.findMany().catch(() => []);
                  activePlacement = placements.find(
                    (p: any) => p.isActive && permittedUnits.includes(p.kamarId) && (!p.santri?.status || p.santri.status === "AKTIF")
                  ) || null;
                }

                if (!activePlacement) {
                  // Check if active placement exists outside permittedUnits
                  let outsidePlacement: any = null;
                  if (db.santriKamarPlacement?.findFirst) {
                    outsidePlacement = await db.santriKamarPlacement.findFirst({
                      where: {
                        isActive: true,
                        kamarId: { notIn: permittedUnits },
                        santri: { status: "AKTIF" },
                      },
                      include: { kamar: true },
                    }).catch(() => null);
                  } else if (db.santriKamarPlacement?.findMany) {
                    const placements = await db.santriKamarPlacement.findMany().catch(() => []);
                    outsidePlacement = placements.find(
                      (p: any) => p.isActive && !permittedUnits.includes(p.kamarId) && (!p.santri?.status || p.santri.status === "AKTIF")
                    ) || null;
                  }

                  if (outsidePlacement && outsidePlacement.kamarId) {
                    policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} SCOPE_MISMATCH: resource units [${outsidePlacement.kamarId}] not in assigned units [${permittedUnits.join(", ")}] (runtime NOT_READY)`);
                  } else {
                    policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} TARGET_RESOURCE_SCOPE_NOT_READY (no representative active santri kamar placement found in assigned units [${permittedUnits.join(", ")}])`);
                  }
                  continue;
                }

                // Canonical runtime check
                const mockAssignment: CanonicalAssignmentWithDetails = {
                  id: asg.id,
                  userId: user.id,
                  positionId: asg.positionId || asg.position?.id || "pos-id",
                  positionCode: target.positionCode,
                  positionName: asg.position?.name || target.positionCode,
                  domain: asg.position?.domain || "KEASRAMAAN",
                  unitId: anchorUnit || permittedUnits[0],
                  unitCode: asg.unit?.code || "OU-ASR",
                  unitName: asg.unit?.name || "Keasramaan",
                  status: "ACTIVE",
                  validFrom: asg.validFrom ? new Date(asg.validFrom) : new Date(0),
                  validUntil: asg.validUntil ? new Date(asg.validUntil) : null,
                  positionCapabilities: [
                    {
                      capabilityCode: target.capabilityCode,
                      scopeType: "ASSIGNED_UNITS",
                      businessRuleState: "VERIFIED_PRODUCTION",
                    },
                  ],
                  scopeUnits: scopedUnits.map((u: string) => ({ unitId: u })),
                };

                const resolvedContext: ResolvedResourceContext = {
                  santriId: activePlacement.santriId,
                  kamarId: activePlacement.kamarId,
                  orgUnitIds: [activePlacement.kamarId],
                  orgDomain: "KEASRAMAAN",
                };

                const authRes = await authorizeCanonical({
                  identity: {
                    userId: user.id,
                    username: user.username || `user-${user.id}`,
                    status: user.status || "AKTIF",
                    accountType: "UNIT",
                    placementUnitId: anchorUnit || permittedUnits[0],
                    mockAssignments: [mockAssignment],
                  } as any,
                  capability: target.capabilityCode,
                  resourceContext: { santriId: activePlacement.santriId },
                  resolvedContext,
                });

                if (authRes.decision !== "ALLOW") {
                  policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} ${authRes.code}: ${authRes.reason} (runtime NOT_READY)`);
                }
              }
            }
          }
        }
      }

      if (missingPositions.length > 0) {
        const issuesSuffix = assignmentIssues.length > 0 ? ` (${assignmentIssues.join("; ")})` : "";
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing active user assignments for required positions: ${missingPositions.join(", ")}${issuesSuffix}`,
          remediationAdvice: "Requires active assignments linking active Users and active Staff to approved positions in M3.3C2",
        });
      } else if (policyIssues.length > 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Target policy definition mismatch: ${policyIssues.join("; ")}`,
          remediationAdvice: "PositionCapability mappings must match approved UAT targets in scope and definition",
        });
      } else if (pendingTechnicalIssues.length > 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `TARGET_POLICY_READY, RUNTIME_NOT_READY: ${pendingTechnicalIssues.join("; ")}`,
          remediationAdvice: "Requires formal promotion of APPROVED_TARGET_PENDING_TECHNICAL policies to VERIFIED_PRODUCTION in M3.3C2",
        });
      } else {
        const deferredNote = deferredPembinaHalaqoh ? " (PEMBINA_HALAQOH deferred: zero active Kamar)" : "";
        const expectedCount = CANONICAL_REQUIRED_POSITION_CODES.length - (deferredPembinaHalaqoh ? 1 : 0);
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${expectedCount} required target positions have active user assignments with verified runtime authority${deferredNote}`,
        });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const asgRows = await db.$queryRawUnsafe<Array<{ code: string }>>(`
        SELECT DISTINCT p."code" 
        FROM "assignments" a
        JOIN "positions" p ON a."position_id" = p."id"
        LEFT JOIN "org_units" o ON a."unit_id" = o."id"
        LEFT JOIN "users" u ON a."user_id" = u."id"
        LEFT JOIN "staff" s ON u."staff_id" = s."id"
        WHERE a."status" = 'ACTIVE' 
          AND (a."valid_from" IS NULL OR a."valid_from" <= NOW())
          AND (a."valid_until" IS NULL OR a."valid_until" >= NOW())
          AND p."is_active" = true
          AND (o."id" IS NULL OR o."is_active" = true)
          AND (
            p."requires_personal_account" = false 
            OR (
              u."id" IS NOT NULL
              AND u."status" IN ('AKTIF', 'ACTIVE')
              AND (u."account_type" IS NULL OR u."account_type" = 'PERSONAL')
              AND u."staff_id" IS NOT NULL
              AND s."id" IS NOT NULL
              AND s."status" IN ('AKTIF', 'ACTIVE')
            )
          );
      `).catch(() => []);
      const coveredCodes = new Set(asgRows.map((r) => r.code));

      const kamarRows = await db.$queryRawUnsafe<Array<{ count: string }>>(`
        SELECT COUNT(*)::text as count FROM "org_units" WHERE "type" = 'KAMAR' AND "is_active" = true;
      `).catch(() => [{ count: "0" }]);
      const activeKamarCount = parseInt(kamarRows[0]?.count || "0", 10);

      let missingPositions = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !coveredCodes.has(c));
      let deferredPembinaHalaqoh = false;
      if (activeKamarCount === 0 && missingPositions.includes("PEMBINA_HALAQOH")) {
        missingPositions = missingPositions.filter((c) => c !== "PEMBINA_HALAQOH");
        deferredPembinaHalaqoh = true;
      }

      const pcRows = await db.$queryRawUnsafe<Array<{
        position_code: string;
        capability_code: string;
        scope_type: string;
        business_rule_state: string;
      }>>(`
        SELECT 
          p."code" as position_code,
          pc."capability_code",
          pc."scope_type",
          pc."business_rule_state"
        FROM "positions" p
        JOIN "position_capabilities" pc ON pc."position_id" = p."id"
        WHERE p."code" IN ('PETUGAS_OPERASIONAL_TAHFIZH', 'MUSYRIF_TAHFIZH', 'PEMBINA_HALAQOH', 'PETUGAS_OPERASIONAL_KEASRAMAAN')
          AND p."is_active" = true;
      `).catch(() => []);

      const policyIssues: string[] = [];
      const pendingTechnicalIssues: string[] = [];

      for (const target of CANONICAL_UAT_TARGET_POLICIES) {
        const matchPc = pcRows.find(
          (r) => r.position_code === target.positionCode && r.capability_code === target.capabilityCode
        );

        if (!matchPc) {
          policyIssues.push(`${target.positionCode}: missing PositionCapability for ${target.capabilityCode}`);
          continue;
        }

        if (matchPc.scope_type !== target.expectedScope) {
          policyIssues.push(`${target.positionCode}: target policy scope mismatch for ${target.capabilityCode} (expected ${target.expectedScope}, found ${matchPc.scope_type || "NONE"})`);
          continue;
        }

        if (matchPc.business_rule_state !== "VERIFIED_PRODUCTION") {
          if (matchPc.business_rule_state === target.expectedBusinessState) {
            pendingTechnicalIssues.push(`${target.positionCode}: grant ${target.capabilityCode} is APPROVED_TARGET_PENDING_TECHNICAL (TARGET_POLICY_READY, RUNTIME_NOT_READY: POLICY_APPROVED_NOT_RUNTIME_ACTIVE)`);
          } else {
            policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} has invalid state ${matchPc.business_rule_state}`);
          }
        } else {
          policyIssues.push(`${target.positionCode}: grant ${target.capabilityCode} TARGET_RESOURCE_SCOPE_VALIDATION_UNAVAILABLE (relational resource scope validation requires Prisma client)`);
        }
      }

      if (missingPositions.length > 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing active user assignments for required positions: ${missingPositions.join(", ")}`,
          remediationAdvice: "Requires active assignments linking active Users and active Staff to approved positions in M3.3C2",
        });
      } else if (policyIssues.length > 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Target policy definition mismatch: ${policyIssues.join("; ")}`,
        });
      } else if (pendingTechnicalIssues.length > 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `TARGET_POLICY_READY, RUNTIME_NOT_READY: ${pendingTechnicalIssues.join("; ")}`,
          remediationAdvice: "Requires formal promotion of APPROVED_TARGET_PENDING_TECHNICAL policies to VERIFIED_PRODUCTION in M3.3C2",
        });
      } else {
        const deferredNote = deferredPembinaHalaqoh ? " (PEMBINA_HALAQOH deferred: zero active Kamar)" : "";
        const expectedCount = CANONICAL_REQUIRED_POSITION_CODES.length - (deferredPembinaHalaqoh ? 1 : 0);
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${expectedCount} required target positions have active user assignments with verified runtime authority${deferredNote}`,
        });
      }
    } else {
      gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect user assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 9: Teaching Assignments Ready (Validates planning / scheduled-teacher coverage for the 12 Kepesantrenan slots)
  // TeachingAssignment represents planning / scheduled-teacher metadata only, NOT authorization.
  try {
    const now = new Date();
    if (db.teachingAssignment) {
      const tas = await db.teachingAssignment.findMany({
        where: {
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        include: {
          mapel: true,
          staff: true,
        },
      });

      let mapelIdToObj = new Map<string, { nama: string; kodeMapel?: string }>();
      if (db.mataPelajaran && tas.some((t: any) => !t.mapel && t.mapelId)) {
        const mapels = await db.mataPelajaran.findMany().catch(() => []);
        mapelIdToObj = new Map(mapels.map((m: any) => [m.id, { nama: m.nama, kodeMapel: m.kodeMapel }]));
      }

      let staffMap = new Map<string, any>();
      if (db.staff) {
        const staffs = await db.staff.findMany().catch(() => []);
        staffMap = new Map(staffs.map((s: any) => [s.id, s]));
      }

      const missingTargets: string[] = [];
      const inactiveStaffTargets: string[] = [];

      for (const target of CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS) {
        const matchingTas = tas.filter((ta: any) => {
          if (!ta.isActive) return false;
          if (ta.validFrom && new Date(ta.validFrom) > now) return false;
          if (ta.validUntil && new Date(ta.validUntil) < now) return false;
          if (!ta.staffId) return false;
          if (ta.educationTrack !== target.track) return false;
          if (target.genderComplex && ta.genderComplex !== target.genderComplex) return false;
          if (target.pedagogicalLevel && ta.pedagogicalLevel !== target.pedagogicalLevel) return false;

          const mapelObj = ta.mapel || (ta.mapelId ? mapelIdToObj.get(ta.mapelId) : null);
          const subjectName = mapelObj?.nama || ta.mapelNama || ta.subjectName;
          if (!subjectName) return false;
          if (subjectName === target.subjectName) return true;
          if (target.subjectAliases && target.subjectAliases.includes(subjectName)) return true;
          return false;
        });

        if (matchingTas.length === 0) {
          missingTargets.push(target.key);
          continue;
        }

        let slotSatisfied = false;
        for (const ta of matchingTas) {
          const staffIdStr = typeof ta.staffId === "string" ? ta.staffId : "";
          const staff = ta.staff || (staffIdStr ? staffMap.get(staffIdStr) : null);
          const staffStatus = staff?.status || ta.staffStatus;
          if (!staffStatus || (staffStatus !== "AKTIF" && staffStatus !== "ACTIVE")) {
            inactiveStaffTargets.push(`${target.key} (staff ${staffIdStr || "unknown"} missing or inactive)`);
            continue;
          }

          slotSatisfied = true;
          break;
        }

        if (!slotSatisfied && matchingTas.length > 0 && inactiveStaffTargets.length === 0) {
          missingTargets.push(target.key);
        }
      }

      if (missingTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing teaching assignment coverage: ${missingTargets.join(", ")}`,
          remediationAdvice: "Requires active teaching assignments with valid staff, mapel, track, and gender in M3.3C2",
          blocking: true,
        });
      } else if (inactiveStaffTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Teaching assignments point to inactive or missing Staff: ${inactiveStaffTargets.join(", ")}`,
          remediationAdvice: "Scheduled teachers must be active Staff in database",
          blocking: true,
        });
      } else {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length} required teaching assignment slots covered with verified planning metadata`,
          blocking: true,
        });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const rows = await db.$queryRawUnsafe<Array<{
        id: string;
        education_track: string;
        gender_complex: string;
        pedagogical_level: string | null;
        staff_id: string;
        staff_status: string | null;
        mapel_nama: string;
        mapel_kode: string;
      }>>(`
        SELECT 
          ta."id", 
          ta."education_track", 
          ta."gender_complex", 
          ta."pedagogical_level", 
          ta."staff_id",
          s."status" as staff_status,
          m."nama" as mapel_nama, 
          m."kode_mapel" as mapel_kode
        FROM "teaching_assignments" ta
        JOIN "mata_pelajaran" m ON ta."mapel_id" = m."id"
        LEFT JOIN "staff" s ON ta."staff_id" = s."id"
        WHERE ta."is_active" = true 
          AND (ta."valid_from" IS NULL OR ta."valid_from" <= NOW())
          AND (ta."valid_until" IS NULL OR ta."valid_until" >= NOW())
          AND ta."staff_id" IS NOT NULL;
      `).catch(() => []);

      const missingTargets: string[] = [];
      const inactiveStaffTargets: string[] = [];

      for (const target of CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS) {
        const matchingRows = rows.filter((r) => {
          if (r.education_track !== target.track) return false;
          if (target.genderComplex && r.gender_complex !== target.genderComplex) return false;
          if (target.pedagogicalLevel && r.pedagogical_level !== target.pedagogicalLevel) return false;
          if (r.mapel_nama === target.subjectName) return true;
          if (target.subjectAliases && target.subjectAliases.includes(r.mapel_nama)) return true;
          return false;
        });

        if (matchingRows.length === 0) {
          missingTargets.push(target.key);
          continue;
        }

        const first = matchingRows[0];
        if (!first.staff_status || !['AKTIF', 'ACTIVE'].includes(first.staff_status)) {
          inactiveStaffTargets.push(`${target.key} (staff ${first.staff_id} missing or inactive)`);
          continue;
        }
      }

      if (missingTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing teaching assignment coverage: ${missingTargets.join(", ")}`,
          blocking: true,
        });
      } else if (inactiveStaffTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Teaching assignments point to inactive or missing Staff: ${inactiveStaffTargets.join(", ")}`,
          blocking: true,
        });
      } else {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length} required teaching assignment slots covered with verified planning metadata`,
          blocking: true,
        });
      }
    } else {
      gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect teaching assignments", blocking: true });
    }
  } catch (err: unknown) {
    gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err), blocking: true });
  }

  // Gate 10: Kepesantrenan Academic Runtime Authorization Policy Ready
  // Evaluates runtime authorization policy readiness for Kepesantrenan actions.
  // Requires explicit owner-approved PositionCapability with businessRuleState === "VERIFIED_PRODUCTION"
  // matching KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES manifest.
  // Current owner-approved manifest is EMPTY; fails closed (NOT_READY, blocking=true)
  // with OWNER_APPROVED_KEPESANTRENAN_ACADEMIC_POLICY_NOT_DEFINED and KEPESANTRENAN_ACADEMIC_AUTH_POLICY_NOT_RUNTIME_READY.
  try {
    let pcs: Array<{ capabilityCode: string; scopeType?: string | null; businessRuleState?: string | null; position?: { code?: string; isActive?: boolean } | null }> = [];
    let queryExecuted = false;

    if (db.positionCapability?.findMany) {
      queryExecuted = true;
      pcs = await db.positionCapability.findMany({
        include: { position: true },
      });
    } else if (db.position?.findMany) {
      queryExecuted = true;
      const positions = await db.position.findMany();
      for (const p of positions) {
        if (p.isActive !== false && Array.isArray(p.capabilities)) {
          for (const c of p.capabilities) {
            pcs.push({
              capabilityCode: c.capabilityCode || c.code,
              scopeType: c.scopeType ?? c.scope,
              businessRuleState: c.businessRuleState,
              position: p,
            });
          }
        }
      }
    } else if (db.assignment?.findMany) {
      queryExecuted = true;
      const assignments = await db.assignment.findMany();
      for (const a of assignments) {
        if (a.status === "ACTIVE" && a.position?.isActive !== false && Array.isArray(a.position?.capabilities)) {
          for (const c of a.position.capabilities) {
            pcs.push({
              capabilityCode: c.capabilityCode || c.code,
              scopeType: c.scopeType ?? c.scope,
              businessRuleState: c.businessRuleState,
              position: a.position,
            });
          }
        }
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      queryExecuted = true;
      const rows = await db.$queryRawUnsafe<Array<{
        capability_code: string;
        scope_type: string | null;
        business_rule_state: string | null;
        position_code: string;
        position_active: boolean;
      }>>(`
        SELECT 
          pc."capability_code",
          pc."scope_type",
          pc."business_rule_state",
          p."code" as position_code,
          p."is_active" as position_active
        FROM "position_capabilities" pc
        JOIN "positions" p ON pc."position_id" = p."id"
        WHERE p."is_active" = true;
      `);
      pcs = rows.map((r) => ({
        capabilityCode: r.capability_code,
        scopeType: r.scope_type,
        businessRuleState: r.business_rule_state,
        position: { code: r.position_code, isActive: r.position_active },
      }));
    }

    if (!queryExecuted && db.teachingAssignment?.findMany) {
      queryExecuted = true;
      const tas = await db.teachingAssignment.findMany();
      for (const ta of tas) {
        if (ta?.staff?.users) {
          for (const u of ta.staff.users) {
            if (u.assignments) {
              for (const a of u.assignments) {
                if (a.position?.capabilities) {
                  for (const c of a.position.capabilities) {
                    pcs.push({
                      capabilityCode: c.capabilityCode || c.code,
                      scopeType: c.scopeType ?? c.scope,
                      businessRuleState: c.businessRuleState,
                      position: a.position,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!queryExecuted) {
      gates.push({
        gate: "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY",
        status: "NOT_READY",
        reason: "DATABASE_UNAVAILABLE",
        details: "DATABASE_UNAVAILABLE: Interface database tidak tersedia untuk memverifikasi kebijakan otorisasi akademik Kepesantrenan",
        remediationAdvice: "Database connection must provide positionCapability or query interface",
        blocking: true,
      });
    } else {
      const activePcs = pcs.filter((pc) => !pc.position || pc.position.isActive !== false);

      const evaluation = evaluateKepesantrenanAcademicAuthPolicies(activePcs, {
        approvedPolicies: KEPESANTRENAN_APPROVED_ACADEMIC_AUTH_POLICIES,
      });

      gates.push({
        gate: "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY",
        status: evaluation.status,
        details: evaluation.details,
        reason: evaluation.reason,
        remediationAdvice: evaluation.remediationAdvice,
        blocking: true,
      });
    }
  } catch (err: unknown) {
    gates.push({
      gate: "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY",
      status: "NOT_READY",
      reason: "DATABASE_QUERY_FAILED",
      details: `DATABASE_QUERY_FAILED: Gagal memverifikasi kebijakan otorisasi akademik Kepesantrenan (${err instanceof Error ? err.message : String(err)})`,
      remediationAdvice: "Periksa koneksi database dan skema tabel position_capabilities",
      blocking: true,
    });
  }

  // Gate 11: Stale Position Capability Policy Ready (Rejects stale PETUGAS_OPERASIONAL_TAHFIZH -> tahfizh.reward.issue)
  try {
    let staleRows: Array<{ positionCode?: string; capabilityCode?: string; businessRuleState?: string | null }> = [];
    if (db.positionCapability) {
      const rows = await db.positionCapability.findMany({
        where: {
          capabilityCode: "tahfizh.reward.issue",
          position: {
            code: "PETUGAS_OPERASIONAL_TAHFIZH",
          },
        },
        include: {
          position: true,
        },
      });
      staleRows = rows.map((r: any) => ({
        positionCode: r.position?.code ?? r.positionCode,
        capabilityCode: r.capabilityCode,
        businessRuleState: r.businessRuleState,
      }));
    } else if (typeof db.$queryRawUnsafe === "function") {
      const rows = await db.$queryRawUnsafe<Array<{ capability_code: string; business_rule_state: string; position_code: string }>>(`
        SELECT pc.capability_code, pc.business_rule_state::text, p.code as position_code
        FROM position_capabilities pc
        JOIN positions p ON p.id = pc.position_id
        WHERE p.code = 'PETUGAS_OPERASIONAL_TAHFIZH' AND pc.capability_code = 'tahfizh.reward.issue';
      `);
      staleRows = rows.map((r: any) => ({
        positionCode: r.position_code,
        capabilityCode: r.capability_code,
        businessRuleState: r.business_rule_state,
      }));
    } else {
      gates.push({
        gate: "STALE_POSITION_CAPABILITY_POLICY_READY",
        status: "NOT_READY",
        details: "DATABASE_UNAVAILABLE: PositionCapability repository unavailable to verify stale policies",
        remediationAdvice: "Database connection must provide PositionCapability repository or query interface",
        blocking: true,
      });
      staleRows = null as any;
    }

    if (staleRows !== null) {
      const staleGateResult = evaluateStalePositionCapabilityPolicy(staleRows);
      gates.push({
        gate: "STALE_POSITION_CAPABILITY_POLICY_READY",
        status: staleGateResult.status,
        details: staleGateResult.details,
        remediationAdvice: staleGateResult.remediationAdvice,
        blocking: true,
      });
    }
  } catch (err: unknown) {
    gates.push({
      gate: "STALE_POSITION_CAPABILITY_POLICY_READY",
      status: "NOT_READY",
      details: `DATABASE_QUERY_FAILED: Gagal memverifikasi kebijakan basi (${err instanceof Error ? err.message : String(err)})`,
      remediationAdvice: "Periksa koneksi database dan skema tabel position_capabilities",
      blocking: true,
    });
  }

  // Gate 12: Cohorts Assigned (Evaluates relevant ACTIVE santri population only)
  // DEFERRED_INFORMATIONAL: Cohort assignment deferred by owner lock; COHORT_NOT_REQUIRED_FOR_RUNTIME
  try {
    if (db.santri) {
      const activeSantris = await db.santri.findMany({
        where: { status: "AKTIF" },
      });
      const filteredActive = activeSantris.filter((s: any) => !s.status || s.status === "AKTIF");
      const unassigned = filteredActive.filter((s: any) => !s.cohortId);

      if (filteredActive.length > 0 && unassigned.length === 0) {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "READY",
          details: `All ${filteredActive.length} active santri have explicit cohort assigned`,
          blocking: false,
        });
      } else if (filteredActive.length === 0) {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: "Zero active santri found in database",
          blocking: false,
        });
      } else {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: `${unassigned.length} of ${filteredActive.length} active santri lack cohort_id (COHORT_NOT_ASSIGNED; DEFERRED_INFORMATIONAL, COHORT_NOT_REQUIRED_FOR_RUNTIME)`,
          remediationAdvice: "DEFERRED_INFORMATIONAL: Cohort assignment deferred; COHORT_NOT_REQUIRED_FOR_RUNTIME because EducationSessionParticipant attaches directly",
          blocking: false,
        });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const rows = await db.$queryRawUnsafe<Array<{ total: string; unassigned: string }>>(`
        SELECT 
          COUNT(*)::text as total,
          COUNT(*) FILTER (WHERE "cohort_id" IS NULL)::text as unassigned
        FROM "santri"
        WHERE "status" = 'AKTIF';
      `).catch(() => []);
      const total = parseInt(rows[0]?.total || "0", 10);
      const unassigned = parseInt(rows[0]?.unassigned || "0", 10);
      if (total > 0 && unassigned === 0) {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "READY",
          details: `All ${total} active santri have explicit cohort assigned`,
          blocking: false,
        });
      } else if (total === 0) {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: "Zero active santri found in database",
          blocking: false,
        });
      } else {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: `${unassigned} of ${total} active santri lack cohort_id (COHORT_NOT_ASSIGNED; DEFERRED_INFORMATIONAL, COHORT_NOT_REQUIRED_FOR_RUNTIME)`,
          remediationAdvice: "DEFERRED_INFORMATIONAL: Cohort assignment deferred; COHORT_NOT_REQUIRED_FOR_RUNTIME because EducationSessionParticipant attaches directly",
          blocking: false,
        });
      }
    } else {
      gates.push({ gate: "COHORTS_ASSIGNED", status: "NOT_READY", details: "Santri repository unavailable", blocking: false });
    }
  } catch (err: unknown) {
    gates.push({ gate: "COHORTS_ASSIGNED", status: "NOT_READY", details: String(err), blocking: false });
  }

  // Gate: Keasramaan Kamar Configuration Ready (Gate 5 Remediation)
  // Case A: active Kamar count = 0 => NOT_READY, CONFIGURATION_NOT_CREATED / DEFERRED, blocking = false
  // Case B: active Kamar count > 0 => validate topology, placements, and Mudhabbir coverage
  // Database / query failure => NOT_READY, DATABASE_UNAVAILABLE, blocking = true
  try {
    if (db.orgUnit) {
      let kamars: any[];
      try {
        const rawKamars = await db.orgUnit.findMany({
          where: { type: "KAMAR", isActive: true },
        });
        kamars = Array.isArray(rawKamars) ? rawKamars.filter((k: any) => k.type === "KAMAR") : [];
      } catch (err: unknown) {
        gates.push({
          gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
          status: "BLOCKED",
          reason: "DATABASE_UNAVAILABLE",
          details: `Database error querying Kamar configuration: ${err instanceof Error ? err.message : String(err)}`,
          blocking: true,
        });
        throw err;
      }

      if (kamars.length === 0) {
        gates.push({
          gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
          status: "NOT_READY",
          reason: "CONFIGURATION_NOT_CREATED / DEFERRED",
          details: "Zero active Kamar configured; kamar topology deferred.",
          blocking: false,
        });
      } else {
        const kamarIssues: string[] = [];
        let requiredQueryFailure: string | null = null;

        // 1. Check kamar domain and gender
        for (const k of kamars) {
          if (k.domain !== "KEASRAMAAN") {
            kamarIssues.push(`Kamar ${k.id} (${k.code}) has invalid domain ${k.domain} (must be KEASRAMAAN)`);
          }
          if (!k.genderComplex || (k.genderComplex !== "PUTRA" && k.genderComplex !== "PUTRI" && k.genderComplex !== "CAMPUR")) {
            kamarIssues.push(`Kamar ${k.id} (${k.code}) has invalid or missing genderComplex (${k.genderComplex})`);
          }
        }

        // 2. Validate SantriKamarPlacement
        if (db.santriKamarPlacement && typeof db.santriKamarPlacement.findMany === "function") {
          try {
            const placements = await db.santriKamarPlacement.findMany({
              where: { isActive: true },
              include: { santri: true, kamar: true },
            });

            const placementsBySantri = new Map<string, number>();
            for (const p of placements) {
              const count = (placementsBySantri.get(p.santriId) || 0) + 1;
              placementsBySantri.set(p.santriId, count);
              if (count > 1) {
                kamarIssues.push(`Santri ${p.santriId} has multiple active kamar placements`);
              }
              if (
                !p.kamar ||
                p.kamar.type !== "KAMAR" ||
                p.kamar.domain !== "KEASRAMAAN" ||
                p.kamar.isActive !== true
              ) {
                kamarIssues.push(`Placement ${p.id} targets an inactive or non-KEASRAMAAN KAMAR`);
              } else if (p.santri) {
                const sGender = p.santri.jenisKelamin === "L" ? "PUTRA" : p.santri.jenisKelamin === "P" ? "PUTRI" : "CAMPUR";
                if (p.kamar.genderComplex !== "CAMPUR" && p.kamar.genderComplex !== "TIDAK_TERIKAT" && sGender !== p.kamar.genderComplex) {
                  kamarIssues.push(`Placement ${p.id} violates gender boundary: santri ${sGender} in ${p.kamar.genderComplex} room`);
                }
              }
            }
          } catch (err: unknown) {
            requiredQueryFailure = `SantriKamarPlacement query failed: ${err instanceof Error ? err.message : String(err)}`;
          }
        } else {
          requiredQueryFailure = "Required SantriKamarPlacement repository/delegate unavailable while active Kamar exist";
        }

        // 3. Validate Mudhabbir coverage for each kamar
        if (!requiredQueryFailure && db.assignment && typeof db.assignment.findMany === "function") {
          try {
            const now = new Date();
            const mudhabbirAssignments = await db.assignment.findMany({
              where: {
                status: "ACTIVE",
                validFrom: { lte: now },
                OR: [{ validUntil: null }, { validUntil: { gte: now } }],
                position: { code: "PEMBINA_HALAQOH", isActive: true },
              },
              include: {
                user: { include: { staff: true } },
                unit: true,
              },
            });

            const coveredKamarIds = new Set<string>();
            for (const asg of mudhabbirAssignments) {
              const u = asg.user;
              if (!u || u.accountType !== "PERSONAL" || u.status !== "AKTIF") continue;
              if (!u.staff || u.staff.status !== "AKTIF") continue;
              if (
                asg.unitId &&
                asg.unit?.type === "KAMAR" &&
                asg.unit?.domain === "KEASRAMAAN" &&
                asg.unit?.isActive === true
              ) {
                coveredKamarIds.add(asg.unitId);
              }
            }

            for (const k of kamars) {
              if (!coveredKamarIds.has(k.id)) {
                kamarIssues.push(`Kamar ${k.name || k.id} lacks active PERSONAL PEMBINA_HALAQOH assignment`);
              }
            }
          } catch (err: unknown) {
            requiredQueryFailure = `Mudhabbir Assignment query failed: ${err instanceof Error ? err.message : String(err)}`;
          }
        } else if (!requiredQueryFailure) {
          requiredQueryFailure = "Required Assignment repository/delegate unavailable while active Kamar exist";
        }

        if (requiredQueryFailure) {
          gates.push({
            gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
            status: "BLOCKED",
            reason: "DATABASE_UNAVAILABLE",
            details: requiredQueryFailure,
            blocking: true,
          });
        } else if (kamarIssues.length > 0) {
          gates.push({
            gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
            status: "NOT_READY",
            details: `Kamar configuration incomplete: ${kamarIssues.join("; ")}`,
            blocking: true,
          });
        } else {
          gates.push({
            gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
            status: "READY",
            details: `All ${kamars.length} active Kamar have valid topology, placement consistency, and coherent Mudhabbir assignments`,
            blocking: true,
          });
        }
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      let kamarRows: Array<{ id: string; code: string; domain: string; gender_complex: string }>;
      try {
        kamarRows = await db.$queryRawUnsafe<Array<{ id: string; code: string; domain: string; gender_complex: string }>>(`
          SELECT "id", "code", "domain", "gender_complex"
          FROM "org_units"
          WHERE "type" = 'KAMAR' AND "is_active" = true;
        `);
      } catch (err: unknown) {
        gates.push({
          gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
          status: "BLOCKED",
          reason: "DATABASE_UNAVAILABLE",
          details: `Database error querying Kamar: ${err instanceof Error ? err.message : String(err)}`,
          blocking: true,
        });
        throw err;
      }

      if (kamarRows.length === 0) {
        gates.push({
          gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
          status: "NOT_READY",
          reason: "CONFIGURATION_NOT_CREATED / DEFERRED",
          details: "Zero active Kamar configured; kamar topology deferred.",
          blocking: false,
        });
      } else {
        const kamarIssues: string[] = [];
        for (const k of kamarRows) {
          if (k.domain !== "KEASRAMAAN") {
            kamarIssues.push(`Kamar ${k.id} (${k.code}) has invalid domain ${k.domain}`);
          }
          if (!k.gender_complex || !["PUTRA", "PUTRI", "CAMPUR"].includes(k.gender_complex)) {
            kamarIssues.push(`Kamar ${k.id} (${k.code}) has invalid genderComplex ${k.gender_complex}`);
          }
        }

        try {
          const placementIssues = await db.$queryRawUnsafe<Array<{ issue_code: string; entity_id: string }>>(`
            SELECT 'MULTIPLE_ACTIVE_PLACEMENT' AS issue_code, p."santri_id" AS entity_id
            FROM "santri_kamar_placements" p
            WHERE p."is_active" = true
            GROUP BY p."santri_id"
            HAVING COUNT(*) > 1
            UNION ALL
            SELECT 'INVALID_ACTIVE_PLACEMENT_TARGET' AS issue_code, p."id" AS entity_id
            FROM "santri_kamar_placements" p
            JOIN "santri" s ON s."id" = p."santri_id"
            LEFT JOIN "org_units" k ON k."id" = p."kamar_id"
            WHERE p."is_active" = true
              AND (
                k."id" IS NULL OR k."type" <> 'KAMAR' OR k."domain" <> 'KEASRAMAAN' OR k."is_active" <> true
                OR (k."gender_complex" NOT IN ('CAMPUR', 'TIDAK_TERIKAT') AND
                    k."gender_complex" <> CASE s."jenis_kelamin" WHEN 'L' THEN 'PUTRA' WHEN 'P' THEN 'PUTRI' ELSE 'CAMPUR' END)
              );
          `);
          for (const issue of placementIssues) {
            kamarIssues.push(`${issue.issue_code}: ${issue.entity_id}`);
          }

          const coveredKamars = await db.$queryRawUnsafe<Array<{ unit_id: string }>>(`
            SELECT DISTINCT a."unit_id"
            FROM "assignments" a
            JOIN "positions" p ON a."position_id" = p."id"
            JOIN "users" u ON a."user_id" = u."id"
            JOIN "staff" s ON u."staff_id" = s."id"
            JOIN "org_units" k ON a."unit_id" = k."id"
            WHERE a."status" = 'ACTIVE'
              AND a."valid_from" <= NOW()
              AND (a."valid_until" IS NULL OR a."valid_until" >= NOW())
              AND p."code" = 'PEMBINA_HALAQOH'
              AND p."is_active" = true
              AND u."account_type" = 'PERSONAL'
              AND u."status" = 'AKTIF'
              AND s."status" = 'AKTIF'
              AND k."type" = 'KAMAR'
              AND k."domain" = 'KEASRAMAAN'
              AND k."is_active" = true;
          `);

          const coveredSet = new Set(coveredKamars.map((r) => r.unit_id));
          const missingCoverage = kamarRows.filter((k) => !coveredSet.has(k.id));

          if (missingCoverage.length > 0) {
            kamarIssues.push(`${missingCoverage.length} of ${kamarRows.length} active Kamar lack active PEMBINA_HALAQOH assignment`);
          }
        } catch (rawErr: unknown) {
          gates.push({
            gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
            status: "BLOCKED",
            reason: "DATABASE_UNAVAILABLE",
            details: `Database error executing raw SQL validation: ${rawErr instanceof Error ? rawErr.message : String(rawErr)}`,
            blocking: true,
          });
          throw rawErr;
        }

        if (kamarIssues.length > 0) {
          gates.push({
            gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
            status: "NOT_READY",
            details: `Kamar configuration incomplete: ${kamarIssues.join("; ")}`,
            blocking: true,
          });
        } else {
          gates.push({
            gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
            status: "READY",
            details: `All ${kamarRows.length} active Kamar have coherent Mudhabbir assignments`,
            blocking: true,
          });
        }
      }
    } else {
      gates.push({
        gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
        status: "BLOCKED",
        reason: "DATABASE_UNAVAILABLE",
        details: "No authoritative Kamar repository or query mechanism (db.orgUnit or db.$queryRawUnsafe) is available.",
        blocking: true,
      });
    }
  } catch (err: unknown) {
    if (!gates.some((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY")) {
      gates.push({
        gate: "KEASRAMAAN_KAMAR_CONFIGURATION_READY",
        status: "BLOCKED",
        reason: "DATABASE_UNAVAILABLE",
        details: String(err),
        blocking: true,
      });
    }
  }

  // Gate 11: Feature Flag Enabled
  const featureEnabled = process.env.PENDIDIKAN_V2_UAT_ENABLED === "true";
  gates.push({
    gate: "RUNTIME_ACTIVATION_FLAG",
    status: featureEnabled ? "READY" : "NOT_READY",
    details: `PENDIDIKAN_V2_UAT_ENABLED=${process.env.PENDIDIKAN_V2_UAT_ENABLED ?? "false"}`,
    remediationAdvice: featureEnabled ? undefined : "Set PENDIDIKAN_V2_UAT_ENABLED=true in server environment when ready for live UAT",
  });

  const blockingGates = gates.filter((g) => g.blocking !== false);
  const hasBlocked = blockingGates.some((g) => g.status === "BLOCKED");
  const hasNotReady = blockingGates.some((g) => g.status === "NOT_READY");
  const overallStatus: ReadinessStatus = hasBlocked ? "BLOCKED" : hasNotReady ? "NOT_READY" : "READY";

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    gates,
    unlinkedStaffAccounts,
  };
}
