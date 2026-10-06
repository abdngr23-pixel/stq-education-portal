/**
 * SCRIPT: provision-w2-osda-monitor.ts
 *
 * PURPOSE:
 * Guarded preflight and provisioning preparation for OSDA Putri Monitoring capability
 * (keasramaan.osda.monitor @ Position PENGAWAS_SANTRIWATI with DOMAIN scope).
 *
 * LEVEL-0 OWNER CONTRACT:
 * - Capability: keasramaan.osda.monitor (READ-ONLY)
 * - Target policy: PENGAWAS_SANTRIWATI / DOMAIN KEASRAMAAN / PUTRI containment
 *
 * SAFETY INVARIANTS:
 * 1. DEFAULT: READ-ONLY PREFLIGHT. Zero production database writes by default.
 * 2. Guard requirements for future execution:
 *    CLI: --execute --approved-scope=W2-OSDA-MONITOR
 *    ENV: PRODUCTION_MUTATION_APPROVED=W2-OSDA-MONITOR
 * 3. NO UPSERT / NO ON CONFLICT: Checks existing rows; reuses exact capability if present.
 * 4. DO NOT EXECUTE IN PRE-MERGE HARDENING.
 */

import { PrismaClient, ScopeType, BusinessRuleState } from "@prisma/client";
import defaultPrisma from "../lib/prisma";
import { KEASRAMAAN_CAPABILITIES } from "../types/architecture-lock";

export interface OsdaMonitorPreflightReport {
  capabilityCount: number;
  capabilityDetails: {
    exists: boolean;
    code: string;
    namespace?: string;
    name?: string;
  };
  pengawasPositionCount: number;
  pengawasPositionDetails?: {
    id: string;
    code: string;
    domain: string;
    isActive: boolean;
  };
  lisaAssignmentCount: number;
  lisaAssignmentDetails: Array<{
    id: string;
    userId: string;
    username: string;
    staffName: string;
    unitCode: string;
    status: string;
  }>;
  positionCapabilityCount: number;
  positionCapabilityDetails: Array<{
    id: string;
    positionCode: string;
    scopeType: ScopeType;
    businessRuleState: BusinessRuleState;
  }>;
  targetScope: ScopeType;
  targetBusinessRuleState: BusinessRuleState;
  allPreconditionsPass: boolean;
  validationErrors: string[];
}

export function parseOsdaMonitorGuards(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
): { isExecuteApproved: boolean; guardReasons: string[] } {
  const hasExecuteFlag = argv.includes("--execute");

  let hasApprovedScopeFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--approved-scope=W2-OSDA-MONITOR") {
      hasApprovedScopeFlag = true;
    } else if (arg === "--approved-scope" && argv[i + 1] === "W2-OSDA-MONITOR") {
      hasApprovedScopeFlag = true;
    }
  }

  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "W2-OSDA-MONITOR";

  const guardReasons: string[] = [];
  if (!hasExecuteFlag) guardReasons.push("Missing required CLI flag: --execute");
  if (!hasApprovedScopeFlag) guardReasons.push("Missing required CLI flag: --approved-scope=W2-OSDA-MONITOR");
  if (!hasEnvApproval) guardReasons.push("Missing required ENV variable: PRODUCTION_MUTATION_APPROVED=W2-OSDA-MONITOR");

  const isExecuteApproved = hasExecuteFlag && hasApprovedScopeFlag && hasEnvApproval;
  return { isExecuteApproved, guardReasons };
}

export async function preflightOsdaMonitor(
  prisma: PrismaClient = defaultPrisma
): Promise<OsdaMonitorPreflightReport> {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.OSDA_MONITOR;

  // 1. Capability prestate
  const existingCap = await prisma.capability.findUnique({
    where: { code: capabilityCode },
  });

  // 2. Position PENGAWAS_SANTRIWATI
  const pengawasPosition = await prisma.position.findUnique({
    where: { code: "PENGAWAS_SANTRIWATI" },
  });

  // 3. Lisa active assignments for PENGAWAS_SANTRIWATI
  const lisaStaff = await prisma.staff.findMany({
    where: { nama: { contains: "Lisa", mode: "insensitive" } },
    include: {
      user: {
        include: {
          assignments: {
            where: { position: { code: "PENGAWAS_SANTRIWATI" }, status: "ACTIVE" },
            include: { position: true, unit: true },
          },
        },
      },
    },
  });

  const lisaAssignments: OsdaMonitorPreflightReport["lisaAssignmentDetails"] = [];
  for (const s of lisaStaff) {
    if (s.user) {
      for (const a of s.user.assignments) {
        lisaAssignments.push({
          id: a.id,
          userId: s.user.id,
          username: s.user.username,
          staffName: s.nama,
          unitCode: a.unit.code,
          status: a.status,
        });
      }
    }
  }

  // 4. PositionCapability count for keasramaan.osda.monitor
  const positionCaps = await prisma.positionCapability.findMany({
    where: { capabilityCode },
    include: { position: true },
  });

  const validationErrors: string[] = [];

  if (!pengawasPosition) {
    validationErrors.push("Position PENGAWAS_SANTRIWATI does not exist in database.");
  }

  if (lisaAssignments.length === 0) {
    validationErrors.push("Lisa has zero active PENGAWAS_SANTRIWATI assignments.");
  }

  return {
    capabilityCount: existingCap ? 1 : 0,
    capabilityDetails: {
      exists: Boolean(existingCap),
      code: capabilityCode,
      namespace: existingCap?.namespace,
      name: existingCap?.name,
    },
    pengawasPositionCount: pengawasPosition ? 1 : 0,
    pengawasPositionDetails: pengawasPosition
      ? {
          id: pengawasPosition.id,
          code: pengawasPosition.code,
          domain: pengawasPosition.domain,
          isActive: pengawasPosition.isActive,
        }
      : undefined,
    lisaAssignmentCount: lisaAssignments.length,
    lisaAssignmentDetails: lisaAssignments,
    positionCapabilityCount: positionCaps.length,
    positionCapabilityDetails: positionCaps.map((pc) => ({
      id: pc.id,
      positionCode: pc.position.code,
      scopeType: pc.scopeType,
      businessRuleState: pc.businessRuleState,
    })),
    targetScope: ScopeType.DOMAIN,
    targetBusinessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
    allPreconditionsPass: validationErrors.length === 0,
    validationErrors,
  };
}

async function main() {
  console.log("================================================================================");
  console.log(" STQ EDUCATION PORTAL — W2 OSDA PUTRI MONITOR PROVISIONING TOOL");
  console.log("================================================================================");

  const guards = parseOsdaMonitorGuards();
  console.log(`Execution Mode: ${guards.isExecuteApproved ? "EXECUTE MUTATION" : "READ-ONLY PREFLIGHT"}`);

  const report = await preflightOsdaMonitor();

  console.log("\n--- PREFLIGHT REPORT ---");
  console.log(`Capability '${report.capabilityDetails.code}': count = ${report.capabilityCount} (${report.capabilityDetails.exists ? "EXISTS" : "ABSENT"})`);
  console.log(`Position 'PENGAWAS_SANTRIWATI': count = ${report.pengawasPositionCount} (${report.pengawasPositionDetails ? "EXISTS" : "ABSENT"})`);
  console.log(`Lisa PENGAWAS_SANTRIWATI Assignments: count = ${report.lisaAssignmentCount}`);
  for (const asg of report.lisaAssignmentDetails) {
    console.log(`  - ${asg.staffName} (${asg.username}) -> Unit: ${asg.unitCode}, Status: ${asg.status}, ID: ${asg.id}`);
  }
  console.log(`PositionCapability Count: ${report.positionCapabilityCount}`);
  console.log(`Target Scope: ${report.targetScope}`);
  console.log(`Target BusinessRuleState: ${report.targetBusinessRuleState}`);

  if (report.validationErrors.length > 0) {
    console.log("\n[!] Preflight Warnings / Errors:");
    for (const err of report.validationErrors) {
      console.log(`  - ${err}`);
    }
  }

  if (!guards.isExecuteApproved) {
    console.log("\n[SAFE STOP] Guards not met. Execution bypassed. Zero database writes performed.");
    console.log("Guard Reasons:");
    for (const reason of guards.guardReasons) {
      console.log(`  - ${reason}`);
    }
    return;
  }

  // Future guarded execution mode
  console.log("\nExecuting atomic provisioning for OSDA monitor...");
  throw new Error("PROVISIONING_MUTATION_LOCKED: Pre-merge hardening prohibits database mutation.");
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error("[FATAL ERROR]", err);
      process.exit(1);
    })
    .finally(async () => {
      await defaultPrisma.$disconnect();
    });
}
