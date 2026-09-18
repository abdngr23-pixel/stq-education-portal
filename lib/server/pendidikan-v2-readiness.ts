/**
 * Production Readiness Diagnostic Framework
 * Milestone 3.3C1 — STQ Education Portal
 *
 * Evaluates production readiness gates without executing any mutations or repairs.
 * Missing prerequisites are reported strictly as BLOCKED / NOT_READY.
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
    findMany: (args?: unknown) => Promise<Array<{ id: string; username: string; role: string; staffId: string | null }>>;
  };
  orgUnit?: {
    findMany: (args?: unknown) => Promise<Array<{ id: string; code: string }>>;
  };
  position?: {
    findMany: (args?: unknown) => Promise<Array<{ id: string; code: string }>>;
  };
  capability?: {
    findMany: (args?: unknown) => Promise<Array<{ id: string; code: string }>>;
  };
  santri?: {
    findMany: (args?: unknown) => Promise<Array<{ id: string; nis: string; nama: string; cohortId: string | null }>>;
  };
}

/**
 * Diagnostic function: Evaluates all 11 production readiness gates.
 * STRICTLY READ-ONLY: Executes zero INSERT, UPDATE, DELETE, SEED, or MIGRATION operations.
 */
export async function checkPendidikanV2ProductionReadiness(
  db: ReadinessDbClient
): Promise<ProductionReadinessReport> {
  const gates: ReadinessGateResult[] = [];
  const unlinkedStaffAccounts: string[] = [];

  // Gate 1: M3.3A Schema Applied (Health V2 tables)
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const healthTables = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('health_biometrics', 'health_clinic_visits', 'health_medicine_inventory');
      `);
      const set = new Set(healthTables.map((t) => t.table_name));
      const missing = ['health_biometrics', 'health_clinic_visits', 'health_medicine_inventory'].filter((t) => !set.has(t));
      if (missing.length === 0) {
        gates.push({ gate: "M3_3A_SCHEMA_APPLIED", status: "READY", details: "All Health V2 tables exist" });
      } else {
        gates.push({
          gate: "M3_3A_SCHEMA_APPLIED",
          status: "NOT_READY",
          details: `Missing Health V2 tables: ${missing.join(", ")}`,
          remediationAdvice: "Requires M3.3C2 migration execution in production",
        });
      }
    } else {
      gates.push({ gate: "M3_3A_SCHEMA_APPLIED", status: "NOT_READY", details: "Database does not support catalog reflection" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "M3_3A_SCHEMA_APPLIED", status: "NOT_READY", details: String(err) });
  }

  // Gate 2: M3.3B Schema Applied (Pendidikan V2 tables)
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const eduTables = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('education_sessions', 'education_session_participants', 'education_session_attendances', 'education_teaching_assignments', 'cohorts');
      `);
      const set = new Set(eduTables.map((t) => t.table_name));
      const missing = ['education_sessions', 'education_session_participants', 'education_session_attendances', 'education_teaching_assignments', 'cohorts'].filter((t) => !set.has(t));
      if (missing.length === 0) {
        gates.push({ gate: "M3_3B_SCHEMA_APPLIED", status: "READY", details: "All Pendidikan V2 foundation tables exist" });
      } else {
        gates.push({
          gate: "M3_3B_SCHEMA_APPLIED",
          status: "NOT_READY",
          details: `Missing Pendidikan V2 tables: ${missing.join(", ")}`,
          remediationAdvice: "Requires M3.3C2 migration execution in production",
        });
      }
    } else {
      gates.push({ gate: "M3_3B_SCHEMA_APPLIED", status: "NOT_READY", details: "Database does not support catalog reflection" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "M3_3B_SCHEMA_APPLIED", status: "NOT_READY", details: String(err) });
  }

  // Gate 3: Canonical Audit Table Ready
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const auditTable = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'canonical_audit_logs';
      `);
      if (auditTable.length > 0) {
        gates.push({ gate: "CANONICAL_AUDIT_TABLE_READY", status: "READY", details: "canonical_audit_logs table exists" });
      } else {
        gates.push({ gate: "CANONICAL_AUDIT_TABLE_READY", status: "NOT_READY", details: "canonical_audit_logs table missing" });
      }
    } else {
      gates.push({ gate: "CANONICAL_AUDIT_TABLE_READY", status: "NOT_READY", details: "Cannot inspect audit table" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "CANONICAL_AUDIT_TABLE_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 4: Staff Linkage Safety Gate (Evaluates BLOCKED_IDENTITY_LINKAGE)
  try {
    if (db.user) {
      const operationalUsers = await db.user.findMany({
        where: {
          role: { in: ["GA", "KS", "MT", "PH", "PENGASUHAN"] },
        },
      });
      const unlinked = operationalUsers.filter((u) => !u.staffId);
      for (const u of unlinked) {
        unlinkedStaffAccounts.push(u.username);
      }

      if (unlinked.length > 0) {
        gates.push({
          gate: "STAFF_LINKAGE_READY",
          status: "BLOCKED",
          details: `Operational accounts lacking active linked Staff: ${unlinked.map((u) => u.username).join(", ")}`,
          remediationAdvice: "BLOCKED_IDENTITY_LINKAGE: Cannot authorize via username or display name; requires official Staff relation in M3.3C2",
        });
      } else {
        gates.push({ gate: "STAFF_LINKAGE_READY", status: "READY", details: "All operational accounts have linked Staff" });
      }
    } else {
      gates.push({ gate: "STAFF_LINKAGE_READY", status: "NOT_READY", details: "User repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "STAFF_LINKAGE_READY", status: "NOT_READY", details: String(err) });
  }

  // Gate 5: Required OrgUnits Exist
  try {
    if (db.orgUnit) {
      const units = await db.orgUnit.findMany();
      if (units.length > 0) {
        gates.push({ gate: "REQUIRED_ORG_UNITS_EXIST", status: "READY", details: `Found ${units.length} organizational units` });
      } else {
        gates.push({ gate: "REQUIRED_ORG_UNITS_EXIST", status: "NOT_READY", details: "Zero organizational units found" });
      }
    } else {
      gates.push({ gate: "REQUIRED_ORG_UNITS_EXIST", status: "NOT_READY", details: "OrgUnit repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "REQUIRED_ORG_UNITS_EXIST", status: "NOT_READY", details: String(err) });
  }

  // Gate 6: Required Position Templates Exist
  try {
    if (db.position) {
      const positions = await db.position.findMany();
      const codes = new Set(positions.map((p) => p.code));
      const required = ["GURU_AKADEMIK", "KEPALA_SEKOLAH"];
      const missing = required.filter((c) => !codes.has(c));
      if (missing.length === 0) {
        gates.push({ gate: "POSITION_TEMPLATES_EXIST", status: "READY", details: "Required academic position templates exist" });
      } else {
        gates.push({ gate: "POSITION_TEMPLATES_EXIST", status: "NOT_READY", details: `Missing positions: ${missing.join(", ")}` });
      }
    } else {
      gates.push({ gate: "POSITION_TEMPLATES_EXIST", status: "NOT_READY", details: "Position repository unavailable" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "POSITION_TEMPLATES_EXIST", status: "NOT_READY", details: String(err) });
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

  // Gate 8: User Assignments Exist
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const asgs = await db.$queryRawUnsafe<Array<{ count: string }>>(`
        SELECT count(*)::text as count FROM "user_assignments" WHERE "status" = 'ACTIVE';
      `).catch(() => []);
      const count = parseInt(asgs[0]?.count || "0", 10);
      if (count > 0) {
        gates.push({ gate: "USER_ASSIGNMENTS_EXIST", status: "READY", details: `${count} active user assignments found` });
      } else {
        gates.push({ gate: "USER_ASSIGNMENTS_EXIST", status: "NOT_READY", details: "Zero active user assignments found" });
      }
    } else {
      gates.push({ gate: "USER_ASSIGNMENTS_EXIST", status: "NOT_READY", details: "Cannot inspect user assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "USER_ASSIGNMENTS_EXIST", status: "NOT_READY", details: String(err) });
  }

  // Gate 9: Teaching Assignments Exist
  try {
    if (typeof db.$queryRawUnsafe === "function") {
      const tas = await db.$queryRawUnsafe<Array<{ count: string }>>(`
        SELECT count(*)::text as count FROM "education_teaching_assignments" WHERE "status" = 'ACTIVE';
      `).catch(() => []);
      const count = parseInt(tas[0]?.count || "0", 10);
      if (count > 0) {
        gates.push({ gate: "TEACHING_ASSIGNMENTS_EXIST", status: "READY", details: `${count} active teaching assignments found` });
      } else {
        gates.push({ gate: "TEACHING_ASSIGNMENTS_EXIST", status: "NOT_READY", details: "Zero teaching assignments found" });
      }
    } else {
      gates.push({ gate: "TEACHING_ASSIGNMENTS_EXIST", status: "NOT_READY", details: "Cannot inspect teaching assignments" });
    }
  } catch (err: unknown) {
    gates.push({ gate: "TEACHING_ASSIGNMENTS_EXIST", status: "NOT_READY", details: String(err) });
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
    gate: "FEATURE_FLAG_ENABLED",
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
