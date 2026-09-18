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
    findMany: (args?: any) => Promise<Array<{ id: string; username: string; status: string; role: string; staffId: string | null }>>;
  };
  staff?: {
    findMany: (args?: any) => Promise<Array<{ id: string; status: string }>>;
  };
  orgUnit?: {
    findMany: (args?: any) => Promise<Array<{ id: string; code: string }>>;
  };
  position?: {
    findMany: (args?: any) => Promise<Array<{ id: string; code: string }>>;
  };
  capability?: {
    findMany: (args?: any) => Promise<Array<{ code: string; [key: string]: any }>>;
  };
  santri?: {
    findMany: (args?: any) => Promise<Array<{ id: string; nis: string; nama: string; status?: string; cohortId: string | null }>>;
  };
  educationCohort?: {
    findMany: (args?: any) => Promise<Array<{ id: string; code: string; isActive: boolean }>>;
  };
  mataPelajaran?: {
    findMany: (args?: any) => Promise<Array<{ id: string; nama: string; kodeMapel?: string }>>;
  };
  teachingAssignment?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      mapelId?: string;
      mapel?: { id?: string; nama: string; kodeMapel?: string };
      staffId?: string | null;
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
      positionId?: string;
      position?: { id?: string; code: string };
      status: string;
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

  // Gate 7: Required Capabilities Registered
  try {
    if (db.capability) {
      const caps = await db.capability.findMany();
      const capCodes = new Set(caps.map((c) => c.code));
      const missing = Object.values(ACADEMIC_CAPABILITIES).filter((c: string) => !capCodes.has(c));
      if (missing.length === 0) {
        gates.push({ gate: "CAPABILITIES_REGISTERED", status: "READY", details: "All 12 academic capabilities registered" });
      } else {
        gates.push({ gate: "CAPABILITIES_REGISTERED", status: "NOT_READY", details: `Missing capabilities: ${missing.join(", ")}` });
      }
    } else {
      gates.push({ gate: "CAPABILITIES_REGISTERED", status: "NOT_READY", details: "Capability repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "CAPABILITIES_REGISTERED", status: "NOT_READY", details: String(err) });
  }

  // Gate 8: User Assignments Ready (Verifies active coverage of all approved target positions)
  try {
    if (db.assignment) {
      const now = new Date();
      const asgs = await db.assignment.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        include: {
          position: true,
        },
      });

      let positionIdToCode = new Map<string, string>();
      if (db.position && asgs.some((a: any) => !a.position && a.positionId)) {
        const positions = await db.position.findMany().catch(() => []);
        positionIdToCode = new Map(positions.map((p: any) => [p.id, p.code]));
      }

      const coveredCodes = new Set<string>();
      for (const a of asgs) {
        const code = a.position?.code || (a.positionId ? positionIdToCode.get(a.positionId) : null) || (a as any).positionCode;
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
        WHERE a."status" = 'ACTIVE' 
          AND (a."valid_until" IS NULL OR a."valid_until" >= NOW());
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

  // Gate 9: Teaching Assignments Ready (Requires full coverage of 18 canonical slots: 6 Studi Umum, 7 Kps Putra, 5 Kps Putri)
  try {
    if (db.teachingAssignment) {
      const now = new Date();
      const tas = await db.teachingAssignment.findMany({
        where: {
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        include: {
          mapel: true,
        },
      });

      let mapelIdToObj = new Map<string, { nama: string; kodeMapel?: string }>();
      if (db.mataPelajaran && tas.some((t: any) => !t.mapel && t.mapelId)) {
        const mapels = await db.mataPelajaran.findMany().catch(() => []);
        mapelIdToObj = new Map(mapels.map((m: any) => [m.id, { nama: m.nama, kodeMapel: m.kodeMapel }]));
      }

      const missingTargets: string[] = [];

      for (const target of CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS) {
        const hasMatch = tas.some((ta: any) => {
          if (!ta.isActive) return false;
          if (ta.validUntil && new Date(ta.validUntil) < now) return false;
          if (!ta.staffId) return false;
          if (ta.educationTrack !== target.track) return false;

          // Gender check
          if (target.genderComplex && ta.genderComplex !== target.genderComplex) {
            return false;
          }

          // Pedagogical level check
          if (target.pedagogicalLevel && ta.pedagogicalLevel !== target.pedagogicalLevel) {
            return false;
          }

          // Subject resolution
          const mapelObj = ta.mapel || (ta.mapelId ? mapelIdToObj.get(ta.mapelId) : null);
          const subjectName = mapelObj?.nama || ta.mapelNama || ta.subjectName;

          if (!subjectName) return false;
          if (subjectName === target.subjectName) return true;
          if (target.subjectAliases && target.subjectAliases.includes(subjectName)) return true;
          return false;
        });

        if (!hasMatch) {
          missingTargets.push(target.key);
        }
      }

      if (missingTargets.length === 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length} required teaching assignment slots covered`,
        });
      } else {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing teaching assignment coverage: ${missingTargets.join(", ")}`,
          remediationAdvice: "Requires active teaching assignments with valid staff, mapel, track, and gender in M3.3C2",
        });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const rows = await db.$queryRawUnsafe<Array<{
        id: string;
        education_track: string;
        gender_complex: string;
        pedagogical_level: string | null;
        mapel_nama: string;
        mapel_kode: string;
      }>>(`
        SELECT 
          ta."id", 
          ta."education_track", 
          ta."gender_complex", 
          ta."pedagogical_level", 
          m."nama" as mapel_nama, 
          m."kode_mapel" as mapel_kode
        FROM "teaching_assignments" ta
        JOIN "mata_pelajaran" m ON ta."mapel_id" = m."id"
        WHERE ta."is_active" = true 
          AND (ta."valid_until" IS NULL OR ta."valid_until" >= NOW())
          AND ta."staff_id" IS NOT NULL;
      `).catch(() => []);

      const missingTargets: string[] = [];
      for (const target of CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS) {
        const hasMatch = rows.some((r) => {
          if (r.education_track !== target.track) return false;
          if (target.genderComplex && r.gender_complex !== target.genderComplex) return false;
          if (target.pedagogicalLevel && r.pedagogical_level !== target.pedagogicalLevel) return false;
          if (r.mapel_nama === target.subjectName) return true;
          if (target.subjectAliases && target.subjectAliases.includes(r.mapel_nama)) return true;
          return false;
        });
        if (!hasMatch) {
          missingTargets.push(target.key);
        }
      }

      if (missingTargets.length === 0) {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "READY",
          details: `All ${CANONICAL_TEACHING_ASSIGNMENT_COVERAGE_TARGETS.length} required teaching assignment slots covered`,
        });
      } else {
        gates.push({
          gate: "TEACHING_ASSIGNMENTS_READY",
          status: "NOT_READY",
          details: `Missing teaching assignment coverage: ${missingTargets.join(", ")}`,
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
