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
  remediationAdvice?: string;
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
  "COHORTS_ASSIGNED",
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
] as const;

/**
 * Programmatically derived UAT activation capability targets:
 * 1. Education session activation capabilities (4 items)
 * 2. Approved UAT target capabilities from UAT_ACTIVATION_TARGETS manifest (5 items)
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
  UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[1].capabilityCode,
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
    positionCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.positionCode,
    capabilityCode: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[1].capabilityCode,
    expectedScope: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[1].scopeType as "ASSIGNED_UNITS",
    expectedBusinessState: UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH.policies[1].businessRuleState as "APPROVED_TARGET_PENDING_TECHNICAL",
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
 * - 6 Studi Umum subjects (educationTrack: STUDI_UMUM)
 * - 7 Kepesantrenan Putra slots (Bahasa Arab T1, T2, T3, Fikih, Tafsir, Aqidah, Tajwid)
 * - 5 Kepesantrenan Putri slots (Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid)
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
  // Studi Umum: 6 canonical subjects
  { key: "STUDI_UMUM:Matematika", track: "STUDI_UMUM", subjectName: "Matematika" },
  { key: "STUDI_UMUM:Bahasa Inggris", track: "STUDI_UMUM", subjectName: "Bahasa Inggris" },
  { key: "STUDI_UMUM:IPS", track: "STUDI_UMUM", subjectName: "IPS" },
  { key: "STUDI_UMUM:IPA", track: "STUDI_UMUM", subjectName: "IPA" },
  { key: "STUDI_UMUM:Bahasa Indonesia", track: "STUDI_UMUM", subjectName: "Bahasa Indonesia" },
  { key: "STUDI_UMUM:TIK", track: "STUDI_UMUM", subjectName: "TIK" },

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
 * Diagnostic function: Evaluates all 11 canonical production readiness gates.
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

  // Gate 4: Staff Linkage Safety Gate (Relational: User.status=AKTIF, Staff.status=AKTIF, User.staffId == Staff.id)
  try {
    if (db.user) {
      const operationalUsers = await db.user.findMany({
        where: {
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
        const userActive = u.status === "AKTIF" || u.status === "ACTIVE";
        const hasLinkedStaff = !!u.staffId;
        const staffIsActive = u.staffId ? activeStaffIds.has(u.staffId) : false;

        if (!userActive || !hasLinkedStaff || !staffIsActive) {
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

        // Personal Staff Invariant: requires user.accountType=PERSONAL, user.staffId != null, and linked active Staff
        if (pos.requiresPersonalAccount !== false) {
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

      const missingPositions = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !coveredCodes.has(c));

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
              const suList = asg.scopedUnits || asgScopeUnitsMap.get(asg.id) || [];
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
                    accountType: "PERSONAL",
                    staffId: user.staffId,
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
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_REQUIRED_POSITION_CODES.length} required target positions have active user assignments with verified runtime authority`,
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
      const missingPositions = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !coveredCodes.has(c));

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
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_REQUIRED_POSITION_CODES.length} required target positions have active user assignments with verified runtime authority`,
        });
      }
    } else {
      gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect user assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 9: Teaching Assignments Ready (Requires full coverage of 18 canonical slots AND verified runtime authorization path for scheduled teachers against authoritative EducationSession resources)
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

      let allSessions: any[] = [];
      if (db.educationSession) {
        allSessions = await db.educationSession.findMany().catch(() => []);
      }

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

      const usersByStaffId = new Map<string, any>();
      if (db.user) {
        const users = await db.user.findMany().catch(() => []);
        for (const u of users) {
          if (u.staffId) usersByStaffId.set(u.staffId, u);
        }
      }

      let positionsMap = new Map<string, any>();
      if (db.position) {
        const positions = await db.position.findMany().catch(() => []);
        positionsMap = new Map(positions.map((p: any) => [p.id, p]));
      }

      let unitsMap = new Map<string, any>();
      if (db.orgUnit) {
        const units = await db.orgUnit.findMany().catch(() => []);
        unitsMap = new Map(units.map((u: any) => [u.id, u]));
      }

      const assignmentsByUserId = new Map<string, any[]>();
      if (db.assignment) {
        const asgs = await db.assignment.findMany({
          where: {
            status: "ACTIVE",
            OR: [{ validUntil: null }, { validUntil: { gte: now } }],
          },
          include: {
            position: true,
            unit: true,
          },
        }).catch(() => []);
        for (const a of asgs) {
          if (a.userId) {
            const list = assignmentsByUserId.get(a.userId) || [];
            list.push(a);
            assignmentsByUserId.set(a.userId, list);
          }
        }
      }

      const pcsByPositionId = new Map<string, any[]>();
      if (db.positionCapability) {
        const pcs = await db.positionCapability.findMany().catch(() => []);
        for (const pc of pcs) {
          if (pc.positionId) {
            const list = pcsByPositionId.get(pc.positionId) || [];
            list.push(pc);
            pcsByPositionId.set(pc.positionId, list);
          }
        }
      } else if (db.position) {
        for (const p of positionsMap.values()) {
          if (Array.isArray(p.capabilities)) {
            pcsByPositionId.set(p.id, p.capabilities);
          }
        }
      }

      const missingTargets: string[] = [];
      const inactiveStaffTargets: string[] = [];
      const unlinkedUserTargets: string[] = [];
      const unassignedUserTargets: string[] = [];
      const sessionIssues: string[] = [];
      const authIssues: string[] = [];

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
          // 1. Staff check
          const staff = ta.staff || (staffIdStr ? staffMap.get(staffIdStr) : null);
          const staffStatus = staff?.status || ta.staffStatus;
          if (!staffStatus || (staffStatus !== "AKTIF" && staffStatus !== "ACTIVE")) {
            inactiveStaffTargets.push(`${target.key} (staff ${staffIdStr || "unknown"} missing or inactive)`);
            continue;
          }

          // 2. User check
          const usersOnStaff = (staff && Array.isArray(staff.users)) ? staff.users : [];
          const user = (staffIdStr ? usersByStaffId.get(staffIdStr) : null) || usersOnStaff.find((u: any) => u.status === "AKTIF" || u.status === "ACTIVE") || usersOnStaff[0] || ta.user;
          const userStatus = user?.status || ta.userStatus;
          const userAccountType = user?.accountType || ta.userAccountType || "PERSONAL";
          if (!user || (userStatus !== "AKTIF" && userStatus !== "ACTIVE") || userAccountType !== "PERSONAL") {
            unlinkedUserTargets.push(`${target.key} (staff ${staffIdStr} lacks active linked PERSONAL User)`);
            continue;
          }

          // 3. Assignment check
          const userAsgs = (user && Array.isArray(user.assignments))
            ? user.assignments
            : (assignmentsByUserId.get(user.id) || (ta.assignment ? [ta.assignment] : []));
          const activeAsgs = userAsgs.filter((a: any) => {
            if (a.status !== "ACTIVE") return false;
            if (a.validFrom && new Date(a.validFrom) > now) return false;
            if (a.validUntil && new Date(a.validUntil) < now) return false;
            const pos = a.position || (a.positionId ? positionsMap.get(a.positionId) : null);
            if (pos && pos.isActive === false) return false;
            const unit = a.unit || (a.unitId ? unitsMap.get(a.unitId) : null);
            if (unit && unit.isActive === false) return false;
            return true;
          });

          if (activeAsgs.length === 0) {
            unassignedUserTargets.push(`${target.key} (user ${user.id} has no active Assignment)`);
            continue;
          }

          // 4. Resolve Authoritative EducationSession Resource
          const candidateSessions = (
            Array.isArray(ta.educationSessions) ? ta.educationSessions : []
          ).concat(
            Array.isArray(ta.sessions) ? ta.sessions : []
          ).concat(
            ta.session ? [ta.session] : []
          ).concat(
            allSessions.filter((s: any) => {
              if (s.scheduledTeacherAssignmentId && s.scheduledTeacherAssignmentId === ta.id) return true;
              if (s.scheduledStaffId && s.scheduledStaffId === ta.staffId && s.educationTrack === target.track) {
                if (target.genderComplex && s.genderGroup && s.genderGroup !== target.genderComplex) return false;
                return true;
              }
              return false;
            })
          );

          if (candidateSessions.length === 0) {
            sessionIssues.push(`${target.key}: SESSION_AUTHORIZATION_RESOURCE_NOT_READY (no authoritative EducationSession resource found for scheduled teacher assignment)`);
            continue;
          }

          const session = candidateSessions[0];

          // 5. Authoritative Canonical Evaluation against representative session resource
          const requiredCaps = target.track === "KEPESANTRENAN"
            ? REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES
            : REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES;

          const mockAssignments: CanonicalAssignmentWithDetails[] = activeAsgs.map((a: any) => {
            const posId = a.positionId || a.position?.id || "pos-default";
            const posCode = a.position?.code || a.positionCode || "GURU";
            const pcs = (a.position && Array.isArray(a.position.capabilities))
              ? a.position.capabilities
              : (pcsByPositionId.get(posId) || a.capabilities || []);
            return {
              id: a.id,
              userId: user.id,
              positionId: posId,
              positionCode: posCode,
              unitId: a.unitId || a.unit?.id || null,
              status: "ACTIVE",
              validFrom: a.validFrom ? new Date(a.validFrom) : new Date(0),
              validUntil: a.validUntil ? new Date(a.validUntil) : null,
              scopeUnits: (a.scopeUnits || []).map((su: any) => ({ unitId: su.unitId || su })),
              positionCapabilities: pcs.map((pc: any) => ({
                capabilityCode: pc.capabilityCode || pc.code || pc.capability?.code,
                scopeType: pc.scopeType,
                businessRuleState: pc.businessRuleState,
              })),
              unitGenderComplex: a.unit?.genderComplex || a.unitGenderComplex || null,
              domain: a.unit?.domain || a.domain || "AKADEMIK",
            };
          });

          const resolvedContext: ResolvedResourceContext = {
            educationSessionId: session.id,
            educationSession: {
              id: session.id,
              educationTrack: session.educationTrack,
              subjectId: session.subjectId || session.mapelId || ta.mapelId || "mapel-1",
              cohortId: session.cohortId || null,
              programLevel: session.programLevel || null,
              genderGroup: session.genderGroup || (target.genderComplex ? target.genderComplex : null),
              scheduledStaffId: session.scheduledStaffId || staff.id,
              actualTeacherUserId: session.actualTeacherUserId || user.id,
              scheduledTeacherAssignmentId: session.scheduledTeacherAssignmentId || ta.id,
            },
            orgDomain: "AKADEMIK",
            genderComplex: (session.genderGroup || target.genderComplex || undefined) as any,
            orgUnitIds: session.orgUnitIds || [],
          };

          let slotAuthOk = true;
          for (const cap of requiredCaps) {
            let matchPc: any = null;
            for (const asg of activeAsgs) {
              const posId = asg.positionId || asg.position?.id;
              const pcs = (asg.position && Array.isArray(asg.position.capabilities))
                ? asg.position.capabilities
                : (pcsByPositionId.get(posId) || asg.capabilities || []);
              const found = pcs.find((p: any) => (p.capabilityCode || p.code || p.capability?.code) === cap);
              if (found) {
                matchPc = found;
                break;
              }
            }

            if (!matchPc) {
              slotAuthOk = false;
              authIssues.push(`${target.key}: grant ${cap} missing on active positions (ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY)`);
              break;
            }

            if (matchPc.businessRuleState === "APPROVED_TARGET_PENDING_TECHNICAL") {
              slotAuthOk = false;
              authIssues.push(`${target.key}: grant ${cap} is APPROVED_TARGET_PENDING_TECHNICAL (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              break;
            }

            if (matchPc.businessRuleState === "PROPOSED_TBD") {
              slotAuthOk = false;
              authIssues.push(`${target.key}: grant ${cap} is PROPOSED_TBD (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              break;
            }

            // Invoke canonical authorization evaluator with representative session context
            const authDecision = await authorizeCanonical({
              identity: {
                userId: user.id,
                username: user.username || `user-${user.id}`,
                status: user.status || "AKTIF",
                accountType: "PERSONAL",
                staffId: user.staffId,
                mockAssignments,
              } as any,
              capability: cap,
              resourceContext: { educationSessionId: session.id },
              resolvedContext,
            });

            if (authDecision.decision !== "ALLOW") {
              slotAuthOk = false;
              if (authDecision.code === "SCOPE_MISMATCH" || authDecision.reasonCode === "SCOPE_MISMATCH" || authDecision.reasonCode === "INVALID_RESOURCE_CONTEXT") {
                authIssues.push(`${target.key}: grant ${cap} SCOPE_MISMATCH: ${authDecision.reason}`);
              } else {
                authIssues.push(`${target.key}: grant ${cap} denied (${authDecision.code || "ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY"}): ${authDecision.reason}`);
              }
              break;
            }
          }

          if (slotAuthOk) {
            slotSatisfied = true;
            break;
          }
        }

        if (!slotSatisfied && matchingTas.length > 0 && authIssues.length === 0 && sessionIssues.length === 0 && unassignedUserTargets.length === 0 && unlinkedUserTargets.length === 0 && inactiveStaffTargets.length === 0) {
          missingTargets.push(target.key);
        }
      }

      if (missingTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing teaching assignment coverage: ${missingTargets.join(", ")}`,
          remediationAdvice: "Requires active teaching assignments with valid staff, mapel, track, and gender in M3.3C2",
        });
      } else if (inactiveStaffTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Teaching assignments point to inactive or missing Staff: ${inactiveStaffTargets.join(", ")}`,
          remediationAdvice: "Scheduled teachers must be active Staff in database",
        });
      } else if (unlinkedUserTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Scheduled teachers lack active linked PERSONAL User: ${unlinkedUserTargets.join(", ")}`,
          remediationAdvice: "BLOCKED_IDENTITY_LINKAGE: Scheduled teachers must be linked to active PERSONAL User accounts",
        });
      } else if (unassignedUserTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Scheduled teachers lack active Assignment: ${unassignedUserTargets.join(", ")}`,
          remediationAdvice: "Scheduled teachers must have active Assignment to active Position and OrgUnit",
        });
      } else if (sessionIssues.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `SESSION_AUTHORIZATION_RESOURCE_NOT_READY: ${sessionIssues.join("; ")}`,
          remediationAdvice: "Requires authoritative EducationSession resources to prove runtime authorization for scheduled teachers",
        });
      } else if (authIssues.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY: ${authIssues.join("; ")}`,
          remediationAdvice: "AUTHORIZATION_GRANT_NOT_RUNTIME_READY: Requires Business Owner approved and verified production PositionCapability mappings with compatible scope in M3.3C2",
        });
      } else {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length} required teaching assignment slots covered with verified runtime authorization chain`,
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
        user_id: string | null;
        user_status: string | null;
        user_account_type: string | null;
        assignment_id: string | null;
        position_id: string | null;
        position_is_active: boolean | null;
        capability_code: string | null;
        scope_type: string | null;
        business_rule_state: string | null;
        session_id: string | null;
      }>>(`
        SELECT 
          ta."id", 
          ta."education_track", 
          ta."gender_complex", 
          ta."pedagogical_level", 
          ta."staff_id",
          s."status" as staff_status,
          m."nama" as mapel_nama, 
          m."kode_mapel" as mapel_kode,
          u."id" as user_id,
          u."status" as user_status,
          u."account_type" as user_account_type,
          a."id" as assignment_id,
          p."id" as position_id,
          p."is_active" as position_is_active,
          pc."capability_code",
          pc."scope_type",
          pc."business_rule_state",
          es."id" as session_id
        FROM "teaching_assignments" ta
        JOIN "mata_pelajaran" m ON ta."mapel_id" = m."id"
        LEFT JOIN "staff" s ON ta."staff_id" = s."id"
        LEFT JOIN "users" u ON u."staff_id" = s."id"
        LEFT JOIN "assignments" a ON a."user_id" = u."id" 
          AND a."status" = 'ACTIVE' 
          AND (a."valid_from" IS NULL OR a."valid_from" <= NOW())
          AND (a."valid_until" IS NULL OR a."valid_until" >= NOW())
        LEFT JOIN "positions" p ON a."position_id" = p."id" AND p."is_active" = true
        LEFT JOIN "org_units" o ON a."unit_id" = o."id" AND o."is_active" = true
        LEFT JOIN "position_capabilities" pc ON pc."position_id" = p."id"
        LEFT JOIN "education_sessions" es ON (
          es."scheduled_teacher_assignment_id" = ta."id"
          OR (es."scheduled_staff_id" = ta."staff_id" AND es."education_track"::text = ta."education_track"::text)
        )
        WHERE ta."is_active" = true 
          AND (ta."valid_from" IS NULL OR ta."valid_from" <= NOW())
          AND (ta."valid_until" IS NULL OR ta."valid_until" >= NOW())
          AND ta."staff_id" IS NOT NULL;
      `).catch(() => []);

      const missingTargets: string[] = [];
      const inactiveStaffTargets: string[] = [];
      const unlinkedUserTargets: string[] = [];
      const unassignedUserTargets: string[] = [];
      const sessionIssues: string[] = [];
      const authIssues: string[] = [];

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

        const taIds = Array.from(new Set(matchingRows.map((r) => r.id)));
        let slotSatisfied = false;

        for (const taId of taIds) {
          const taRows = matchingRows.filter((r) => r.id === taId);
          const first = taRows[0];

          if (!first.staff_status || !['AKTIF', 'ACTIVE'].includes(first.staff_status)) {
            inactiveStaffTargets.push(`${target.key} (staff ${first.staff_id} missing or inactive)`);
            continue;
          }

          if (!first.user_id || !['AKTIF', 'ACTIVE'].includes(first.user_status || '') || first.user_account_type !== 'PERSONAL') {
            unlinkedUserTargets.push(`${target.key} (staff ${first.staff_id} lacks active linked PERSONAL User)`);
            continue;
          }

          if (!first.assignment_id || first.position_is_active === false) {
            unassignedUserTargets.push(`${target.key} (user ${first.user_id} has no active Assignment)`);
            continue;
          }

          if (!first.session_id) {
            sessionIssues.push(`${target.key}: SESSION_AUTHORIZATION_RESOURCE_NOT_READY (no authoritative EducationSession resource found for scheduled teacher assignment)`);
            continue;
          }

          const requiredCaps = target.track === "KEPESANTRENAN"
            ? REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES
            : REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES;

          let slotAuthOk = true;
          for (const cap of requiredCaps) {
            const matchPc = taRows.find((r) => r.capability_code === cap);
            if (!matchPc) {
              slotAuthOk = false;
              authIssues.push(`${target.key}: grant ${cap} missing on active positions (ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY)`);
              break;
            }

            if (matchPc.business_rule_state !== 'VERIFIED_PRODUCTION') {
              slotAuthOk = false;
              if (matchPc.business_rule_state === 'APPROVED_TARGET_PENDING_TECHNICAL') {
                authIssues.push(`${target.key}: grant ${cap} is APPROVED_TARGET_PENDING_TECHNICAL (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              } else if (matchPc.business_rule_state === 'PROPOSED_TBD') {
                authIssues.push(`${target.key}: grant ${cap} is PROPOSED_TBD (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              } else {
                authIssues.push(`${target.key}: grant ${cap} invalid state ${matchPc.business_rule_state} (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              }
              break;
            }

            // Incompatible scope checks: reject scopes that cannot match EducationSession
            const incompatibleScopes = ['HALAQOH', 'UNIT', 'ASSIGNED_UNITS', 'KAMAR', 'OWN_CHILD', 'SELF'];
            if (incompatibleScopes.includes(matchPc.scope_type || '')) {
              slotAuthOk = false;
              authIssues.push(`${target.key}: grant ${cap} SCOPE_MISMATCH: Incompatible scope ${matchPc.scope_type} for EducationSession resource`);
              break;
            }
          }

          if (slotAuthOk) {
            slotSatisfied = true;
            break;
          }
        }

        if (!slotSatisfied && matchingRows.length > 0 && authIssues.length === 0 && sessionIssues.length === 0 && unassignedUserTargets.length === 0 && unlinkedUserTargets.length === 0 && inactiveStaffTargets.length === 0) {
          missingTargets.push(target.key);
        }
      }

      if (missingTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing teaching assignment coverage: ${missingTargets.join(", ")}`,
        });
      } else if (inactiveStaffTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Teaching assignments point to inactive or missing Staff: ${inactiveStaffTargets.join(", ")}`,
        });
      } else if (unlinkedUserTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Scheduled teachers lack active linked PERSONAL User: ${unlinkedUserTargets.join(", ")}`,
        });
      } else if (unassignedUserTargets.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Scheduled teachers lack active Assignment: ${unassignedUserTargets.join(", ")}`,
        });
      } else if (sessionIssues.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `SESSION_AUTHORIZATION_RESOURCE_NOT_READY: ${sessionIssues.join("; ")}`,
        });
      } else if (authIssues.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY: ${authIssues.join("; ")}`,
        });
      } else {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length} required teaching assignment slots covered with verified runtime authorization chain`,
        });
      }
    } else {
      gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect teaching assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 10: Cohorts Assigned (Evaluates relevant ACTIVE santri population only)
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
        });
      } else if (filteredActive.length === 0) {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: "Zero active santri found in database",
        });
      } else {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: `${unassigned.length} of ${filteredActive.length} active santri lack cohort_id (COHORT_NOT_ASSIGNED)`,
          remediationAdvice: "Requires explicit cohort assignment without deriving from school class or age",
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
        });
      } else if (total === 0) {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: "Zero active santri found in database",
        });
      } else {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: `${unassigned} of ${total} active santri lack cohort_id (COHORT_NOT_ASSIGNED)`,
          remediationAdvice: "Requires explicit cohort assignment without deriving from school class or age",
        });
      }
    } else {
      gates.push({ gate: "COHORTS_ASSIGNED", status: "NOT_READY", details: "Santri repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "COHORTS_ASSIGNED", status: "NOT_READY", details: String(err) });
  }

  // Gate 11: Feature Flag Enabled
  const featureEnabled = process.env.PENDIDIKAN_V2_UAT_ENABLED === "true";
  gates.push({
    gate: "RUNTIME_ACTIVATION_FLAG",
    status: featureEnabled ? "READY" : "NOT_READY",
    details: `PENDIDIKAN_V2_UAT_ENABLED=${process.env.PENDIDIKAN_V2_UAT_ENABLED ?? "false"}`,
    remediationAdvice: featureEnabled ? undefined : "Set PENDIDIKAN_V2_UAT_ENABLED=true in server environment when ready for live UAT",
  });

  const hasBlocked = gates.some((g) => g.status === "BLOCKED");
  const hasNotReady = gates.some((g) => g.status === "NOT_READY");
  const overallStatus: ReadinessStatus = hasBlocked ? "BLOCKED" : hasNotReady ? "NOT_READY" : "READY";

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    gates,
    unlinkedStaffAccounts,
  };
}
