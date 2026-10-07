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

  const mudirGrant = positionCaps.find((pc) => pc.position?.code === "MUDIR");
  const mkGrant = positionCaps.find((pc) => pc.position?.code === "KEPALA_KEASRAMAAN");
  const conflicting = positionCaps.filter(
    (pc) => pc.position?.code !== "MUDIR" && pc.position?.code !== "KEPALA_KEASRAMAAN"
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

  // Track G: Capability metadata safety checks
  if (existingCap && existingCap.namespace !== "KEASRAMAAN") {
    validationErrors.push(
      `CONFIG_DRIFT: Existing Capability namespace is '${existingCap.namespace}', expected 'KEASRAMAAN'.`
    );
  }

  // Track G: Config Drift checks on target grants
  if (mudirGrant) {
    if (
      mudirGrant.scopeType !== ScopeType.GLOBAL ||
      mudirGrant.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
    ) {
      validationErrors.push(
        `CONFIG_DRIFT: Existing MUDIR grant has scope '${mudirGrant.scopeType}' and state '${mudirGrant.businessRuleState}', expected GLOBAL and VERIFIED_PRODUCTION.`
      );
    }
  }

  if (mkGrant) {
    if (
      mkGrant.scopeType !== ScopeType.DOMAIN ||
      mkGrant.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
    ) {
      validationErrors.push(
        `CONFIG_DRIFT: Existing KEPALA_KEASRAMAAN grant has scope '${mkGrant.scopeType}' and state '${mkGrant.businessRuleState}', expected DOMAIN and VERIFIED_PRODUCTION.`
      );
    }
  }

  if (conflicting.length > 0) {
    validationErrors.push(
      `CONFLICT_REQUIRES_OWNER_AUTHORIZATION: Found ${conflicting.length} unexpected grant(s) for positions: ${conflicting.map((c) => c.position?.code || "UNKNOWN").join(", ")}`
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
      positionCode: c.position?.code || "UNKNOWN",
      scopeType: c.scopeType,
      businessRuleState: c.businessRuleState,
    })),
    activeRelevantAssignments,
    allPreconditionsPass: validationErrors.length === 0,
    validationErrors,
  };
}

export interface TakeoverProvisioningResult {
  mode: "READ_ONLY" | "EXECUTED";
  executed: boolean;
  preflight: TakeoverPreflightReport;
  createdCapabilityCount: number;
  createdPositionCapabilityCount: number;
  mudirPositionCapabilityId?: string;
  kepalaKeasramaanPositionCapabilityId?: string;
  postReport?: TakeoverPreflightReport;
}

export async function executeTakeoverProvisioning(
  guards: ReturnType<typeof parseTakeoverGuards>,
  prisma: PrismaClient = defaultPrisma
): Promise<TakeoverProvisioningResult> {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.TAKEOVER_EXECUTE;
  const preflight = await preflightTakeoverCapability(prisma);

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
  let mudirPcId: string | undefined;
  let mkPcId: string | undefined;

  await prisma.$transaction(async (tx) => {
    // 1. Recheck and create Capability if absent (no upsert, no update, no delete)
    let liveCap = await tx.capability.findUnique({
      where: { code: capabilityCode },
    });
    if (!liveCap) {
      liveCap = await tx.capability.create({
        data: {
          code: capabilityCode,
          name: "Supervisory Takeover Execution",
          namespace: "KEASRAMAAN",
          description:
            "Otoritas Atasan (Mudir & Kepala Keasramaan) untuk mengambil alih tugas bawahan secara terstruktur tanpa menghilangkan atribusi PIC asli.",
        },
      });
      createdCapability++;
    } else if (liveCap.namespace !== "KEASRAMAAN") {
      throw new Error(`CONFIG_DRIFT: Capability namespace is '${liveCap.namespace}', expected 'KEASRAMAAN'.`);
    }

    // Track G: Transactional recheck for unexpected grants to other positions
    const unexpectedTxGrants = await tx.positionCapability.findMany({
      where: {
        capabilityCode,
        position: {
          code: { notIn: ["MUDIR", "KEPALA_KEASRAMAAN"] },
        },
      },
      include: { position: true },
    });
    if (unexpectedTxGrants.length > 0) {
      throw new Error(
        `CONFLICT_REQUIRES_OWNER_AUTHORIZATION: Unexpected grants found in transaction for positions: ${unexpectedTxGrants.map((u) => u.position?.code).join(", ")}`
      );
    }

    // 2. Resolve Positions
    const mudirPos = await tx.position.findUnique({ where: { code: "MUDIR" } });
    if (!mudirPos) throw new Error("Position 'MUDIR' not found in database.");

    const mkPos = await tx.position.findUnique({ where: { code: "KEPALA_KEASRAMAAN" } });
    if (!mkPos) throw new Error("Position 'KEPALA_KEASRAMAAN' not found in database.");

    // 3. Recheck PositionCapability for MUDIR (GLOBAL / VERIFIED_PRODUCTION)
    const existingMudirPc = await tx.positionCapability.findFirst({
      where: { positionId: mudirPos.id, capabilityCode },
    });
    if (!existingMudirPc) {
      const pc = await tx.positionCapability.create({
        data: {
          positionId: mudirPos.id,
          capabilityCode,
          scopeType: ScopeType.GLOBAL,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      });
      mudirPcId = pc.id;
      createdPositionCapability++;
    } else {
      // Track G: Strict match verification. Halts if drift detected.
      if (
        existingMudirPc.scopeType !== ScopeType.GLOBAL ||
        existingMudirPc.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
      ) {
        throw new Error(
          `CONFIG_DRIFT: Existing MUDIR PositionCapability has scope '${existingMudirPc.scopeType}' and state '${existingMudirPc.businessRuleState}', expected GLOBAL and VERIFIED_PRODUCTION.`
        );
      }
      mudirPcId = existingMudirPc.id;
    }

    // 4. Recheck PositionCapability for KEPALA_KEASRAMAAN (DOMAIN / VERIFIED_PRODUCTION)
    const existingMkPc = await tx.positionCapability.findFirst({
      where: { positionId: mkPos.id, capabilityCode },
    });
    if (!existingMkPc) {
      const pc = await tx.positionCapability.create({
        data: {
          positionId: mkPos.id,
          capabilityCode,
          scopeType: ScopeType.DOMAIN,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      });
      mkPcId = pc.id;
      createdPositionCapability++;
    } else {
      // Track G: Strict match verification. Halts if drift detected.
      if (
        existingMkPc.scopeType !== ScopeType.DOMAIN ||
        existingMkPc.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
      ) {
        throw new Error(
          `CONFIG_DRIFT: Existing KEPALA_KEASRAMAAN PositionCapability has scope '${existingMkPc.scopeType}' and state '${existingMkPc.businessRuleState}', expected DOMAIN and VERIFIED_PRODUCTION.`
        );
      }
      mkPcId = existingMkPc.id;
    }
  });

  const postReport = await preflightTakeoverCapability(prisma);

  return {
    mode: "EXECUTED",
    executed: true,
    preflight,
    createdCapabilityCount: createdCapability,
    createdPositionCapabilityCount: createdPositionCapability,
    mudirPositionCapabilityId: mudirPcId,
    kepalaKeasramaanPositionCapabilityId: mkPcId,
    postReport,
  };
}

async function main() {
  console.log("================================================================================");
  console.log(" STQ EDUCATION PORTAL — W2 SUPERVISORY TAKEOVER PROVISIONING TOOL");
  console.log("================================================================================");

  const guards = parseTakeoverGuards();
  console.log(`Execution Mode: ${guards.isExecuteApproved ? "EXECUTE MUTATION" : "READ-ONLY PREFLIGHT"}`);

  const result = await executeTakeoverProvisioning(guards, defaultPrisma);

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
