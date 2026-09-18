/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Production Readiness Diagnostic Framework
 * Milestone 3.3C1 — STQ Education Portal
 *
 * Evaluates canonical production readiness gates without executing any mutations or repairs.
 * Missing prerequisites are reported strictly as BLOCKED / NOT_READY.
 * STRICTLY READ-ONLY: Executes zero INSERT, UPDATE, DELETE, SEED, or MIGRATION operations.
 */

import { ACADEMIC_CAPABILITIES } from "@/types/architecture-lock";

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
    findMany: (args?: any) => Promise<Array<{ id: string; nis: string; nama: string; cohortId: string | null }>>;
  };
  educationCohort?: {
    findMany: (args?: any) => Promise<Array<{ id: string; code: string; isActive: boolean }>>;
  };
  teachingAssignment?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      mapelId: string;
      staffId: string;
      educationTrack: string;
      genderComplex: string;
      pedagogicalLevel: string | null;
      isActive: boolean;
      validFrom: Date;
      validUntil: Date | null;
    }>>;
  };
  assignment?: {
    findMany: (args?: any) => Promise<Array<{
      id: string;
      status: string;
      validUntil: Date | null;
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
      const requiredCodes = ["OU-OSDA-ROOT", "OU-OSDA-PUTRI", "OU-TKS-ROOT"];
      const missing = requiredCodes.filter((c) => !unitCodes.has(c));
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
      const required = [
        "MUDIR",
        "KABID_TAHFIZH",
        "MUSYRIF_TAHFIZH",
        "PEMBINA_HALAQOH",
        "PETUGAS_OPERASIONAL_TAHFIZH",
        "PETUGAS_OPERASIONAL_KEASRAMAAN",
        "KEPALA_KEASRAMAAN",
        "PEMBINA_ASRAMA",
      ];
      const missing = required.filter((c) => !codes.has(c));
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

  // Gate 8: User Assignments Ready
  try {
    if (db.assignment) {
      const now = new Date();
      const asgs = await db.assignment.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
      });
      if (asgs.length > 0) {
        gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "READY", details: `${asgs.length} active user assignments found` });
      } else {
        gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: "Zero active user assignments found" });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const asgs = await db.$queryRawUnsafe<Array<{ count: string }>>(`
        SELECT count(*)::text as count FROM "assignments" 
        WHERE "status" = 'ACTIVE' 
          AND ("valid_until" IS NULL OR "valid_until" >= NOW());
      `).catch(() => []);
      const count = parseInt(asgs[0]?.count || "0", 10);
      if (count > 0) {
        gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "READY", details: `${count} active user assignments found` });
      } else {
        gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: "Zero active user assignments found" });
      }
    } else {
      gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect user assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "USER_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 9: Teaching Assignments Ready (Requires active teaching_assignments with linked Staff, Mapel, Track, Gender)
  try {
    if (db.teachingAssignment) {
      const tas = await db.teachingAssignment.findMany();
      const now = new Date();
      const validTas = tas.filter(
        (ta) => ta.isActive && (!ta.validUntil || new Date(ta.validUntil) >= now) && ta.staffId && ta.mapelId
      );
      if (validTas.length > 0) {
        gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "READY", details: `${validTas.length} active teaching assignments found` });
      } else {
        gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: "Zero valid active teaching assignments found" });
      }
    } else if (typeof db.$queryRawUnsafe === "function") {
      const tas = await db.$queryRawUnsafe<Array<{ count: string }>>(`
        SELECT count(*)::text as count FROM "teaching_assignments" 
        WHERE "is_active" = true 
          AND ("valid_until" IS NULL OR "valid_until" >= NOW())
          AND "staff_id" IS NOT NULL
          AND "mapel_id" IS NOT NULL;
      `).catch(() => []);
      const count = parseInt(tas[0]?.count || "0", 10);
      if (count > 0) {
        gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "READY", details: `${count} active teaching assignments found` });
      } else {
        gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: "Zero valid active teaching assignments found" });
      }
    } else {
      gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: "Cannot inspect teaching assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "TEACHING_ASSIGNMENTS_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 10: Cohorts Assigned
  try {
    if (db.santri) {
      const santris = await db.santri.findMany();
      const unassigned = santris.filter((s) => !s.cohortId);
      if (santris.length > 0 && unassigned.length === 0) {
        gates.push({ gate: "COHORTS_ASSIGNED", status: "READY", details: `All ${santris.length} santri have explicit cohort assigned` });
      } else if (santris.length === 0) {
        gates.push({ gate: "COHORTS_ASSIGNED", status: "NOT_READY", details: "Zero santri found in database" });
      } else {
        gates.push({
          gate: "COHORTS_ASSIGNED",
          status: "NOT_READY",
          details: `${unassigned.length} of ${santris.length} santri lack cohort_id (COHORT_NOT_ASSIGNED)`,
          remediationAdvice: "Requires explicit cohort assignment without deriving from school class",
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
