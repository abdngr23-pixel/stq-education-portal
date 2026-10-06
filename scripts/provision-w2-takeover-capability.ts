/**
 * SCRIPT: provision-w2-takeover-capability.ts
 *
 * PURPOSE:
 * Guarded preflight and provisioning preparation for Supervisory Takeover capability
 * (keasramaan.takeover.execute).
 * Target policies:
 * - MUDIR: GLOBAL supervisory authority
 * - KEPALA_KEASRAMAAN: DOMAIN / KEASRAMAAN supervisory authority
 *
 * SAFETY INVARIANTS:
 * 1. DEFAULT: READ-ONLY PREFLIGHT. Zero production database writes by default.
 * 2. Guard requirements for future execution:
 *    CLI: --execute --approved-scope=W2-TAKEOVER
 *    ENV: PRODUCTION_MUTATION_APPROVED=W2-TAKEOVER
 * 3. NO UPSERT / NO ON CONFLICT: Checks existing rows; reuses exact capability if present.
 * 4. Conflicting grants (e.g. KEPALA_SEKOLAH, MT, etc.) detected and blocked.
 * 5. DO NOT EXECUTE IN PRE-MERGE HARDENING.
 */

import { PrismaClient, ScopeType, BusinessRuleState } from "@prisma/client";
import defaultPrisma from "../lib/prisma";
import { KEASRAMAAN_CAPABILITIES } from "../types/architecture-lock";

export interface TakeoverPreflightReport {
  capabilityCount: number;
  capabilityDetails: {
    exists: boolean;
    code: string;
    namespace?: string;
    name?: string;
  };
  mudirGrantCount: number;
  mudirGrantState?: BusinessRuleState | "ABSENT";
  mudirGrantScope?: ScopeType;
  kepalaKeasramaanGrantCount: number;
  kepalaKeasramaanGrantState?: BusinessRuleState | "ABSENT";
  kepalaKeasramaanGrantScope?: ScopeType;
  conflictingGrants: Array<{
    id: string;
    positionCode: string;
    scopeType: ScopeType;
    businessRuleState: BusinessRuleState;
  }>;
  activeRelevantAssignments: Array<{
    id: string;
    userId: string;
    username: string;
    positionCode: string;
    unitCode: string;
    status: string;
  }>;
  allPreconditionsPass: boolean;
  validationErrors: string[];
}

export function parseTakeoverGuards(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
): { isExecuteApproved: boolean; guardReasons: string[] } {
  const hasExecuteFlag = argv.includes("--execute");

  let hasApprovedScopeFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--approved-scope=W2-TAKEOVER") {
      hasApprovedScopeFlag = true;
    } else if (arg === "--approved-scope" && argv[i + 1] === "W2-TAKEOVER") {
      hasApprovedScopeFlag = true;
    }
  }

  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "W2-TAKEOVER";

  const guardReasons: string[] = [];
  if (!hasExecuteFlag) guardReasons.push("Missing required CLI flag: --execute");
  if (!hasApprovedScopeFlag) guardReasons.push("Missing required CLI flag: --approved-scope=W2-TAKEOVER");
  if (!hasEnvApproval) guardReasons.push("Missing required ENV variable: PRODUCTION_MUTATION_APPROVED=W2-TAKEOVER");

  const isExecuteApproved = hasExecuteFlag && hasApprovedScopeFlag && hasEnvApproval;
  return { isExecuteApproved, guardReasons };
}

export async function preflightTakeoverCapability(
  prisma: PrismaClient = defaultPrisma
): Promise<TakeoverPreflightReport> {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.TAKEOVER_EXECUTE;

  // 1. Capability prestate
  const existingCap = await prisma.capability.findUnique({
    where: { code: capabilityCode },
  });

  // 2. Position grants
  const positionCaps = await prisma.positionCapability.findMany({
    where: { capabilityCode },
    include: { position: true },
  });

  const mudirGrant = positionCaps.find((pc) => pc.position.code === "MUDIR");
  const mkGrant = positionCaps.find((pc) => pc.position.code === "KEPALA_KEASRAMAAN");
  const conflicting = positionCaps.filter(
    (pc) => pc.position.code !== "MUDIR" && pc.position.code !== "KEPALA_KEASRAMAAN"
  );

  // 3. Active relevant assignments
  const activeAssignments = await prisma.assignment.findMany({
    where: {
      position: {
        code: { in: ["MUDIR", "KEPALA_KEASRAMAAN"] },
      },
      status: "ACTIVE",
    },
    include: {
      position: true,
      user: true,
      unit: true,
    },
  });

  const activeRelevantAssignments = activeAssignments.map((a) => ({
    id: a.id,
    userId: a.userId,
    username: a.user.username,
    positionCode: a.position.code,
    unitCode: a.unit.code,
    status: a.status,
  }));

  const validationErrors: string[] = [];

  if (conflicting.length > 0) {
    validationErrors.push(
      `CONFLICT_REQUIRES_OWNER_AUTHORIZATION: Found ${conflicting.length} unexpected grant(s) for positions: ${conflicting.map((c) => c.position.code).join(", ")}`
    );
  }

  const mudirAssignments = activeRelevantAssignments.filter((a) => a.positionCode === "MUDIR");
  if (mudirAssignments.length === 0) {
    validationErrors.push("Zero active MUDIR assignments found.");
  }

  const mkAssignments = activeRelevantAssignments.filter((a) => a.positionCode === "KEPALA_KEASRAMAAN");
  if (mkAssignments.length === 0) {
    validationErrors.push("Zero active KEPALA_KEASRAMAAN assignments found.");
  }

  return {
    capabilityCount: existingCap ? 1 : 0,
    capabilityDetails: {
      exists: Boolean(existingCap),
      code: capabilityCode,
      namespace: existingCap?.namespace,
      name: existingCap?.name,
    },
    mudirGrantCount: mudirGrant ? 1 : 0,
    mudirGrantState: mudirGrant ? mudirGrant.businessRuleState : "ABSENT",
    mudirGrantScope: mudirGrant?.scopeType,
    kepalaKeasramaanGrantCount: mkGrant ? 1 : 0,
    kepalaKeasramaanGrantState: mkGrant ? mkGrant.businessRuleState : "ABSENT",
    kepalaKeasramaanGrantScope: mkGrant?.scopeType,
    conflictingGrants: conflicting.map((c) => ({
      id: c.id,
      positionCode: c.position.code,
      scopeType: c.scopeType,
      businessRuleState: c.businessRuleState,
    })),
    activeRelevantAssignments,
    allPreconditionsPass: validationErrors.length === 0,
    validationErrors,
  };
}

async function main() {
  console.log("================================================================================");
  console.log(" STQ EDUCATION PORTAL — W2 SUPERVISORY TAKEOVER PROVISIONING TOOL");
  console.log("================================================================================");

  const guards = parseTakeoverGuards();
  console.log(`Execution Mode: ${guards.isExecuteApproved ? "EXECUTE MUTATION" : "READ-ONLY PREFLIGHT"}`);

  const report = await preflightTakeoverCapability();

  console.log("\n--- PREFLIGHT REPORT ---");
  console.log(`Capability '${report.capabilityDetails.code}': count = ${report.capabilityCount} (${report.capabilityDetails.exists ? "EXISTS" : "ABSENT"})`);
  console.log(`MUDIR Grant: count = ${report.mudirGrantCount}, state = ${report.mudirGrantState}, scope = ${report.mudirGrantScope || "N/A"}`);
  console.log(`KEPALA_KEASRAMAAN Grant: count = ${report.kepalaKeasramaanGrantCount}, state = ${report.kepalaKeasramaanGrantState}, scope = ${report.kepalaKeasramaanGrantScope || "N/A"}`);
  console.log(`Conflicting Grants: count = ${report.conflictingGrants.length}`);
  console.log(`Active Relevant Assignments: count = ${report.activeRelevantAssignments.length}`);
  for (const asg of report.activeRelevantAssignments) {
    console.log(`  - [${asg.positionCode}] ${asg.username} (unit: ${asg.unitCode}, id: ${asg.id})`);
  }

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

  // Future guarded execution mode (only runs when explicitly authorized by owner)
  console.log("\nExecuting atomic provisioning for supervisory takeover...");
  // In pre-merge hardening, this code path is never triggered.
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
