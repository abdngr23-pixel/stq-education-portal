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
} from "@/types/architecture-lock";
import { CANONICAL_POSITION_CODES } from "@/lib/auth/compatibility";

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
    findMany: (args?: any) => Promise<Array<{ id: string; nis: string; nama: string; status?: string; cohortId: string | null; [key: string]: any }>>;
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
      position?: { id?: string; code: string; isActive?: boolean; capabilities?: any[] };
      unitId?: string;
      unit?: { id?: string; code: string; isActive?: boolean };
      status: string;
      validFrom?: Date;
      validUntil: Date | null;
      [key: string]: any;
    }>>;
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

  // Gate 8: User Assignments Ready (Verifies active coverage of all approved target positions with active user/position/orgUnit/staff chains)
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
        },
      });

      let usersMap = new Map<string, any>();
      if (db.user && asgs.some((a: any) => !a.user && a.userId)) {
        const users = await db.user.findMany().catch(() => []);
        usersMap = new Map(users.map((u: any) => [u.id, u]));
      }

      let positionsMap = new Map<string, any>();
      if (db.position && asgs.some((a: any) => !a.position && a.positionId)) {
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
      for (const a of asgs) {
        if (a.status !== "ACTIVE") continue;
        if (a.validFrom && new Date(a.validFrom) > now) continue;
        if (a.validUntil && new Date(a.validUntil) < now) continue;

        const pos = a.position || (a.positionId ? positionsMap.get(a.positionId) : null) || (a.positionCode ? { code: a.positionCode, isActive: true } : null);
        if (!pos || pos.isActive === false) continue;

        const unit = a.unit || (a.unitId ? unitsMap.get(a.unitId) : null);
        if (unit && unit.isActive === false) continue;

        const user = a.user || (a.userId ? usersMap.get(a.userId) : null);
        if (user && !(user.status === "AKTIF" || user.status === "ACTIVE")) continue;

        if (pos.requiresPersonalAccount !== false) {
          if (user) {
            if (user.accountType && user.accountType !== "PERSONAL") continue;
            if (user.staffId) {
              const staff = staffMap.get(user.staffId);
              if (staff && !(staff.status === "AKTIF" || staff.status === "ACTIVE")) continue;
            }
          }
        }

        const code = pos.code || a.positionCode;
        if (code) coveredCodes.add(code);
      }

      const missing = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !coveredCodes.has(c));
      if (missing.length === 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_REQUIRED_POSITION_CODES.length} required target positions have active user assignments`,
        });
      } else {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing active user assignments for required positions: ${missing.join(", ")}`,
          remediationAdvice: "Requires active assignments linking active Users and active Staff to approved positions in M3.3C2",
        });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const rows = await db.$queryRawUnsafe<Array<{ code: string }>>(`
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
          AND (u."id" IS NULL OR u."status" IN ('AKTIF', 'ACTIVE'))
          AND (
            p."requires_personal_account" = false 
            OR u."staff_id" IS NULL 
            OR s."status" IN ('AKTIF', 'ACTIVE')
          );
      `).catch(() => []);
      const coveredCodes = new Set(rows.map((r) => r.code));
      const missing = CANONICAL_REQUIRED_POSITION_CODES.filter((c) => !coveredCodes.has(c));
      if (missing.length === 0) {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_REQUIRED_POSITION_CODES.length} required target positions have active user assignments`,
        });
      } else {
        gates.push({
          gate: "USER_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing active user assignments for required positions: ${missing.join(", ")}`,
        });
      }
    } else {
      gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect user assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 9: Teaching Assignments Ready (Requires full coverage of 18 canonical slots AND verified runtime authorization path for scheduled teachers)
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

          // 4. PositionCapability check
          const requiredCaps = target.track === "KEPESANTRENAN"
            ? REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES
            : REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES;

          let slotAuthOk = true;
          for (const cap of requiredCaps) {
            let capGrantOk = false;
            let lastState: string | null = null;

            for (const asg of activeAsgs) {
              const posId = asg.positionId || asg.position?.id;
              const pcs = (asg.position && Array.isArray(asg.position.capabilities))
                ? asg.position.capabilities
                : (pcsByPositionId.get(posId) || asg.capabilities || []);
              const matchPc = pcs.find((p: any) => p.capabilityCode === cap || p.code === cap || p.capability?.code === cap);
              if (matchPc) {
                lastState = matchPc.businessRuleState;
                if (matchPc.businessRuleState === "VERIFIED_PRODUCTION") {
                  capGrantOk = true;
                  break;
                }
              }
            }

            if (!capGrantOk) {
              slotAuthOk = false;
              if (lastState === "APPROVED_TARGET_PENDING_TECHNICAL") {
                authIssues.push(`${target.key}: grant ${cap} is APPROVED_TARGET_PENDING_TECHNICAL (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              } else if (lastState === "PROPOSED_TBD") {
                authIssues.push(`${target.key}: grant ${cap} is PROPOSED_TBD (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              } else {
                authIssues.push(`${target.key}: grant ${cap} missing on active positions (ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY)`);
              }
              break;
            }
          }

          if (slotAuthOk) {
            slotSatisfied = true;
            break;
          }
        }

        if (!slotSatisfied && matchingTas.length > 0 && authIssues.length === 0 && unassignedUserTargets.length === 0 && unlinkedUserTargets.length === 0 && inactiveStaffTargets.length === 0) {
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
      } else if (authIssues.length > 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY: ${authIssues.join("; ")}`,
          remediationAdvice: "AUTHORIZATION_GRANT_NOT_RUNTIME_READY: Requires Business Owner approved and verified production PositionCapability mappings in M3.3C2",
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
        business_rule_state: string | null;
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
          pc."business_rule_state"
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
        WHERE ta."is_active" = true 
          AND (ta."valid_from" IS NULL OR ta."valid_from" <= NOW())
          AND (ta."valid_until" IS NULL OR ta."valid_until" >= NOW())
          AND ta."staff_id" IS NOT NULL;
      `).catch(() => []);

      const missingTargets: string[] = [];
      const inactiveStaffTargets: string[] = [];
      const unlinkedUserTargets: string[] = [];
      const unassignedUserTargets: string[] = [];
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

          const requiredCaps = target.track === "KEPESANTRENAN"
            ? REQUIRED_KEPESANTRENAN_TEACHER_CAPABILITIES
            : REQUIRED_STUDI_UMUM_TEACHER_CAPABILITIES;

          let slotAuthOk = true;
          for (const cap of requiredCaps) {
            const matchPc = taRows.find((r) => r.capability_code === cap);
            if (!matchPc || matchPc.business_rule_state !== 'VERIFIED_PRODUCTION') {
              slotAuthOk = false;
              if (matchPc?.business_rule_state === 'APPROVED_TARGET_PENDING_TECHNICAL') {
                authIssues.push(`${target.key}: grant ${cap} is APPROVED_TARGET_PENDING_TECHNICAL (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              } else if (matchPc?.business_rule_state === 'PROPOSED_TBD') {
                authIssues.push(`${target.key}: grant ${cap} is PROPOSED_TBD (AUTHORIZATION_GRANT_NOT_RUNTIME_READY)`);
              } else {
                authIssues.push(`${target.key}: grant ${cap} missing on active positions (ACADEMIC_TEACHER_AUTHORIZATION_POLICY_NOT_RUNTIME_READY)`);
              }
              break;
            }
          }

          if (slotAuthOk) {
            slotSatisfied = true;
            break;
          }
        }

        if (!slotSatisfied && matchingRows.length > 0 && authIssues.length === 0 && unassignedUserTargets.length === 0 && unlinkedUserTargets.length === 0 && inactiveStaffTargets.length === 0) {
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
