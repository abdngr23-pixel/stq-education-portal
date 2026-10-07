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

  // 3. Track H: Exact deterministic Lisa target discovery via canonical username 'musyirfah.putri'
  const targetUsername = "musyirfah.putri";
  const canonicalUsers = await prisma.user.findMany({
    where: { username: targetUsername },
    include: {
      staff: true,
      assignments: {
        where: { position: { code: "PENGAWAS_SANTRIWATI" }, status: "ACTIVE" },
        include: { position: true, unit: true },
      },
    },
  });

  const validationErrors: string[] = [];

  // Track G: Capability metadata safety checks
  if (existingCap && existingCap.namespace !== "KEASRAMAAN") {
    validationErrors.push(
      `CONFIG_DRIFT: Existing Capability namespace is '${existingCap.namespace}', expected 'KEASRAMAAN'.`
    );
  }

  if (!pengawasPosition) {
    validationErrors.push("Position PENGAWAS_SANTRIWATI does not exist in database.");
  }

  const targetUserCount = canonicalUsers.length;
  let targetAssignmentCount = 0;
  const canonicalAssignments: OsdaMonitorPreflightReport["lisaAssignmentDetails"] = [];

  if (targetUserCount !== 1) {
    validationErrors.push(
      `LISA_PREFLIGHT_TARGET: Target username '${targetUsername}' count must be exactly 1, found ${targetUserCount}.`
    );
  } else {
    const user = canonicalUsers[0];
    targetAssignmentCount = user.assignments.length;
    if (targetAssignmentCount !== 1) {
      validationErrors.push(
        `LISA_PREFLIGHT_TARGET: Target user '${targetUsername}' active PENGAWAS_SANTRIWATI assignment count must be exactly 1, found ${targetAssignmentCount}.`
      );
    }
    for (const a of user.assignments) {
      canonicalAssignments.push({
        id: a.id,
        userId: user.id,
        username: user.username,
        staffName: user.staff?.nama || user.username,
        unitCode: a.unit?.code || "UNKNOWN",
        status: a.status,
      });
    }
  }

  // 4. PositionCapability count for keasramaan.osda.monitor
  const positionCaps = await prisma.positionCapability.findMany({
    where: { capabilityCode },
    include: { position: true },
  });

  const pengawasGrants = positionCaps.filter((pc) => pc.position?.code === "PENGAWAS_SANTRIWATI");
  const unexpectedGrants = positionCaps.filter((pc) => pc.position?.code !== "PENGAWAS_SANTRIWATI");

  if (unexpectedGrants.length > 0) {
    validationErrors.push(
      `CONFLICT_REQUIRES_OWNER_AUTHORIZATION: Unexpected grant(s) found for positions: ${unexpectedGrants.map((u) => u.position?.code || "UNKNOWN").join(", ")}`
    );
  }

  // Track G: Config Drift checks on target grants
  for (const pg of pengawasGrants) {
    if (
      pg.scopeType !== ScopeType.DOMAIN ||
      pg.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
    ) {
      validationErrors.push(
        `CONFIG_DRIFT: Existing PENGAWAS_SANTRIWATI PositionCapability has scope '${pg.scopeType}' and state '${pg.businessRuleState}', expected DOMAIN and VERIFIED_PRODUCTION.`
      );
    }
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
    lisaAssignmentCount: canonicalAssignments.length,
    lisaAssignmentDetails: canonicalAssignments,
    positionCapabilityCount: positionCaps.length,
    positionCapabilityDetails: positionCaps.map((pc) => ({
      id: pc.id,
      positionCode: pc.position?.code || "UNKNOWN",
      scopeType: pc.scopeType,
      businessRuleState: pc.businessRuleState,
    })),
    targetScope: ScopeType.DOMAIN,
    targetBusinessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
    allPreconditionsPass: validationErrors.length === 0,
    validationErrors,
  };
}

export interface OsdaMonitorProvisioningResult {
  mode: "READ_ONLY" | "EXECUTED";
  executed: boolean;
  preflight: OsdaMonitorPreflightReport;
  createdCapabilityCount: number;
  createdPositionCapabilityCount: number;
  pengawasPositionCapabilityId?: string;
  postReport?: OsdaMonitorPreflightReport;
}

export async function executeOsdaMonitorProvisioning(
  guards: ReturnType<typeof parseOsdaMonitorGuards>,
  prisma: PrismaClient = defaultPrisma
): Promise<OsdaMonitorProvisioningResult> {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.OSDA_MONITOR;
  const preflight = await preflightOsdaMonitor(prisma);

  if (!guards.isExecuteApproved) {
    return {
      mode: "READ_ONLY",
      executed: false,
      preflight,
      createdCapabilityCount: 0,
      createdPositionCapabilityCount: 0,
    };
  }

  // Pre-execution invariant checks
  if (!preflight.allPreconditionsPass) {
    throw new Error(
      `ABORT_PROVISIONING: Preconditions failed:\n${preflight.validationErrors.join("\n")}`
    );
  }

  let createdCapability = 0;
  let createdPositionCapability = 0;
  let pcId: string | undefined;

  await prisma.$transaction(async (tx) => {
    // 1. Recheck and create Capability if absent (read-only metadata, no mutation)
    let liveCap = await tx.capability.findUnique({
      where: { code: capabilityCode },
    });
    if (!liveCap) {
      liveCap = await tx.capability.create({
        data: {
          code: capabilityCode,
          name: "OSDA Putri Monitoring",
          namespace: "KEASRAMAAN",
          description:
            "Akses read-only monitoring kegiatan santriwati OSDA Putri bagi Pengawas Santriwati tanpa wewenang mutasi.",
        },
      });
      createdCapability++;
    } else if (liveCap.namespace !== "KEASRAMAAN") {
      throw new Error(`CONFIG_DRIFT: Capability namespace is '${liveCap.namespace}', expected 'KEASRAMAAN'.`);
    }

    // Track G: Transactional recheck for unexpected grants
    const unexpectedTxGrants = await tx.positionCapability.findMany({
      where: {
        capabilityCode,
        position: {
          code: { not: "PENGAWAS_SANTRIWATI" },
        },
      },
      include: { position: true },
    });
    if (unexpectedTxGrants.length > 0) {
      throw new Error(
        `CONFLICT_REQUIRES_OWNER_AUTHORIZATION: Unexpected grants found in transaction for positions: ${unexpectedTxGrants.map((u) => u.position?.code).join(", ")}`
      );
    }

    // 2. Resolve PENGAWAS_SANTRIWATI position
    const pengawasPos = await tx.position.findUnique({
      where: { code: "PENGAWAS_SANTRIWATI" },
    });
    if (!pengawasPos) {
      throw new Error("Position 'PENGAWAS_SANTRIWATI' not found in database.");
    }

    // 3. Recheck PositionCapability (DOMAIN / VERIFIED_PRODUCTION)
    const existingPc = await tx.positionCapability.findFirst({
      where: { positionId: pengawasPos.id, capabilityCode },
    });
    if (!existingPc) {
      const pc = await tx.positionCapability.create({
        data: {
          positionId: pengawasPos.id,
          capabilityCode,
          scopeType: ScopeType.DOMAIN,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      });
      pcId = pc.id;
      createdPositionCapability++;
    } else {
      // Track G: Strict match verification. Halts if drift detected.
      if (
        existingPc.scopeType !== ScopeType.DOMAIN ||
        existingPc.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
      ) {
        throw new Error(
          `CONFIG_DRIFT: Existing PENGAWAS_SANTRIWATI PositionCapability has scope '${existingPc.scopeType}' and state '${existingPc.businessRuleState}', expected DOMAIN and VERIFIED_PRODUCTION.`
        );
      }
      pcId = existingPc.id;
    }

    // Invariant: Existing active Lisa PENGAWAS_SANTRIWATI assignment is reused.
    // Zero new Lisa assignments. Zero username-based authorization.
  });

  const postReport = await preflightOsdaMonitor(prisma);

  return {
    mode: "EXECUTED",
    executed: true,
    preflight,
    createdCapabilityCount: createdCapability,
    createdPositionCapabilityCount: createdPositionCapability,
    pengawasPositionCapabilityId: pcId,
    postReport,
  };
}

async function main() {
  console.log("================================================================================");
  console.log(" STQ EDUCATION PORTAL — W2 OSDA PUTRI MONITOR PROVISIONING TOOL");
  console.log("================================================================================");

  const guards = parseOsdaMonitorGuards();
  console.log(`Execution Mode: ${guards.isExecuteApproved ? "EXECUTE MUTATION" : "READ-ONLY PREFLIGHT"}`);

  const result = await executeOsdaMonitorProvisioning(guards, defaultPrisma);

  console.log("\n--- PROVISIONING REPORT ---");
  console.log(`Mode: ${result.mode} (Executed: ${result.executed})`);
  console.log(`Created Capability: ${result.createdCapabilityCount}`);
  console.log(`Created PositionCapability: ${result.createdPositionCapabilityCount}`);

  if (result.mode === "READ_ONLY") {
    console.log("\n[SAFE STOP] Default read-only preflight. Zero database writes performed.");
    for (const r of guards.guardReasons) console.log(`  - ${r}`);
  } else {
    console.log("\n[SUCCESS] Guarded provisioning executed successfully in atomic transaction.");
  }
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
