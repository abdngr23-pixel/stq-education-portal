/**
 * SCRIPT: reconcile-w2-pembina-kamar-scope.ts
 *
 * PURPOSE:
 * Guarded preflight and scope reconciliation preparation for PEMBINA_HALAQOH
 * multi-room management (ORR-085).
 * Reconciles PositionCapability 'keasramaan.permission.create' from historical 'KAMAR' scope
 * to canonical 'ASSIGNED_UNITS' scope bound via AssignmentScopeUnit.
 *
 * LEVEL-0 OWNER POLICY:
 * One Mudhabbir may manage multiple rooms through assigned units.
 * Mudhabbir is strictly an active Staff with PEMBINA_HALAQOH; never inferred from username/role/name.
 *
 * SAFETY INVARIANTS:
 * 1. DEFAULT MODE: READ-ONLY Preflight. Zero production database writes by default.
 * 2. GUARD ENFORCEMENT: Mutation requires BOTH CLI flags:
 *    --execute --approved-scope=W2-PEMBINA-SCOPE
 *    AND environment variable:
 *    PRODUCTION_MUTATION_APPROVED=W2-PEMBINA-SCOPE
 * 3. SCOPE CONTAINMENT: Target scope is ASSIGNED_UNITS (never DOMAIN or GLOBAL).
 * 4. IMPACT ANALYSIS: Proves exact existing grants and active room assignments before transition.
 */

import { PrismaClient } from "@prisma/client";
import defaultPrisma from "../lib/prisma";

export interface PembinaScopePreflightReport {
  existingGrantCount: number;
  grantDetails?: {
    id: string;
    positionCode: string;
    capabilityCode: string;
    currentScopeType: string;
    targetScopeType: string;
    businessRuleState: string;
  };
  activePembinaAssignmentsCount: number;
  activePembinaAssignments: Array<{
    id: string;
    userId: string;
    username?: string;
    unitId: string;
    scopeUnitsCount: number;
  }>;
  activeSantriPlacementsCount: number;
  scopeContainsAccidentalBroaderAuthority: boolean;
  canExecuteSafely: boolean;
  blockers: string[];
}

export interface PembinaScopeReconciliationResult {
  mode: "READ_ONLY_PREFLIGHT" | "EXECUTED";
  executed: boolean;
  preflight: PembinaScopePreflightReport;
  targetReconciliationPlan: {
    targetPositionCode: "PEMBINA_HALAQOH";
    targetCapabilityCode: "keasramaan.permission.create";
    fromScope: string;
    toScope: "ASSIGNED_UNITS";
    targetBusinessRuleState: "VERIFIED_PRODUCTION";
    assignmentRelationalModel: "AssignmentScopeUnit (multi-room bindings)";
  };
  executionResult?: {
    positionCapabilityIdUpdated?: string;
    scopeTransition: string;
  };
}

export async function runPembinaScopePreflight(
  prisma: PrismaClient = defaultPrisma
): Promise<PembinaScopePreflightReport> {
  const blockers: string[] = [];

  // 1. Find existing PositionCapability for PEMBINA_HALAQOH + keasramaan.permission.create
  const grants = await prisma.positionCapability.findMany({
    where: {
      position: { code: "PEMBINA_HALAQOH" },
      capabilityCode: "keasramaan.permission.create",
    },
    include: {
      position: true,
    },
  });

  if (grants.length === 0) {
    blockers.push("PositionCapability for PEMBINA_HALAQOH + keasramaan.permission.create not found.");
  } else if (grants.length > 1) {
    blockers.push(
      `Multiple (${grants.length}) PositionCapability rows found for PEMBINA_HALAQOH + keasramaan.permission.create. Expected exactly one.`
    );
  }

  const primaryGrant = grants[0] || null;

  // 2. Count active PEMBINA_HALAQOH assignments
  const activeAssignments = await prisma.assignment.findMany({
    where: {
      position: { code: "PEMBINA_HALAQOH" },
      status: "ACTIVE",
    },
    include: {
      user: { select: { username: true } },
      scopedUnits: true,
    },
  });

  // 3. Count active santri kamar placements
  const activeSantriPlacementsCount = await prisma.santriKamarPlacement.count({
    where: { isActive: true },
  });

  // 4. Verify no accidental broader authority (DOMAIN or GLOBAL)
  const isAccidentalBroader =
    primaryGrant?.scopeType === "GLOBAL" || primaryGrant?.scopeType === "DOMAIN";
  if (isAccidentalBroader) {
    blockers.push(
      `CRITICAL: Existing grant has unexpected broader scope '${primaryGrant?.scopeType}'. Cannot reconcile automatically.`
    );
  }

  return {
    existingGrantCount: grants.length,
    grantDetails: primaryGrant
      ? {
          id: primaryGrant.id,
          positionCode: primaryGrant.position.code,
          capabilityCode: primaryGrant.capabilityCode,
          currentScopeType: primaryGrant.scopeType,
          targetScopeType: "ASSIGNED_UNITS",
          businessRuleState: primaryGrant.businessRuleState,
        }
      : undefined,
    activePembinaAssignmentsCount: activeAssignments.length,
    activePembinaAssignments: activeAssignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      username: a.user?.username,
      unitId: a.unitId,
      scopeUnitsCount: a.scopedUnits.length,
    })),
    activeSantriPlacementsCount,
    scopeContainsAccidentalBroaderAuthority: Boolean(isAccidentalBroader),
    canExecuteSafely: blockers.length === 0,
    blockers,
  };
}

export async function reconcilePembinaKamarScope(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env,
  prisma: PrismaClient = defaultPrisma
): Promise<PembinaScopeReconciliationResult> {
  const hasExecute = argv.includes("--execute");
  const hasScope = argv.includes("--approved-scope=W2-PEMBINA-SCOPE");
  const hasEnv = env.PRODUCTION_MUTATION_APPROVED === "W2-PEMBINA-SCOPE";

  const preflight = await runPembinaScopePreflight(prisma);

  const targetReconciliationPlan: PembinaScopeReconciliationResult["targetReconciliationPlan"] = {
    targetPositionCode: "PEMBINA_HALAQOH",
    targetCapabilityCode: "keasramaan.permission.create",
    fromScope: preflight.grantDetails?.currentScopeType || "KAMAR",
    toScope: "ASSIGNED_UNITS",
    targetBusinessRuleState: "VERIFIED_PRODUCTION",
    assignmentRelationalModel: "AssignmentScopeUnit (multi-room bindings)",
  };

  if (!hasExecute || !hasScope || !hasEnv) {
    return {
      mode: "READ_ONLY_PREFLIGHT",
      executed: false,
      preflight,
      targetReconciliationPlan,
    };
  }

  if (!preflight.canExecuteSafely || !preflight.grantDetails) {
    throw new Error(
      `ABORT: Cannot execute scope reconciliation due to preflight blockers: ${preflight.blockers.join("; ")}`
    );
  }

  // EXECUTE TRANSACTIONALLY
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.positionCapability.update({
      where: { id: preflight.grantDetails!.id },
      data: {
        scopeType: "ASSIGNED_UNITS",
        businessRuleState: "VERIFIED_PRODUCTION",
      },
    });

    return {
      mode: "EXECUTED",
      executed: true,
      preflight,
      targetReconciliationPlan,
      executionResult: {
        positionCapabilityIdUpdated: updated.id,
        scopeTransition: `${preflight.grantDetails!.currentScopeType} -> ${updated.scopeType}`,
      },
    };
  });
}

// Direct CLI invocation
if (require.main === module) {
  reconcilePembinaKamarScope()
    .then((result) => {
      console.log("=== W2 PEMBINA KAMAR SCOPE RECONCILIATION REPORT ===");
      console.log(`MODE: ${result.mode} (Executed: ${result.executed})`);
      console.log("PREFLIGHT:", JSON.stringify(result.preflight, null, 2));
      console.log("TARGET PLAN:", JSON.stringify(result.targetReconciliationPlan, null, 2));
      if (result.executionResult) {
        console.log("EXECUTION RESULT:", JSON.stringify(result.executionResult, null, 2));
      }
    })
    .catch((err) => {
      console.error("FAILED:", err);
      process.exit(1);
    })
    .finally(() => defaultPrisma.$disconnect());
}
