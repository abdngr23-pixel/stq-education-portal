/**
 * SCRIPT: provision-w2-mudir-kamar-manage.ts
 *
 * PURPOSE:
 * Guarded preflight and provisioning preparation for Mudir Kamar Management capability
 * (keasramaan.kamar.manage @ Position MUDIR with GLOBAL scope).
 *
 * LEVEL-0 OWNER POLICY:
 * Kamar structure, Santri room placement, and Mudhabbir appointment are strictly
 * a MUDIR prerogative. Prior drafts for KEPALA_KEASRAMAAN are formally SUPERSEDED.
 *
 * SAFETY INVARIANTS:
 * 1. DEFAULT MODE: READ-ONLY Preflight. Zero production database writes by default.
 * 2. GUARD ENFORCEMENT: Mutation requires BOTH CLI flags:
 *    --execute --approved-scope=W2-MUDIR-KAMAR
 *    AND environment variable:
 *    PRODUCTION_MUTATION_APPROVED=W2-MUDIR-KAMAR
 * 3. NO UPSERT / NO ON CONFLICT: Checks existing rows; reuses exact capability if present.
 * 4. CONFLICT DETECTION: If a conflicting KEPALA_KEASRAMAAN grant exists, refuses to touch it
 *    and returns CONFLICT_REQUIRES_OWNER_AUTHORIZATION.
 */

import { CapabilityNamespace, PrismaClient } from "@prisma/client";
import defaultPrisma from "../lib/prisma";
import {
  KEASRAMAAN_KAMAR_CAPABILITIES,
  MUDIR_KAMAR_MANAGE_TARGET_POLICY,
} from "../types/architecture-lock";

export interface MudirKamarPreflightReport {
  capabilityCount: number;
  capabilityDetails: {
    exists: boolean;
    code?: string;
    namespace?: string;
    name?: string;
  };
  mudirPositionCount: number;
  mudirPositionDetails?: {
    id: string;
    code: string;
    isActive: boolean;
  };
  mudirActiveAssignmentCount: number;
  mudirActiveAssignments: Array<{
    id: string;
    userId: string;
    username?: string;
    status: string;
  }>;
  mudirKamarManageGrantCount: number;
  mudirGrantDetails: Array<{
    id: string;
    scopeType: string;
    businessRuleState: string;
  }>;
  kepalaKeasramaanGrantCount: number;
  kepalaKeasramaanGrantDetails: Array<{
    id: string;
    scopeType: string;
    businessRuleState: string;
  }>;
  conflictingGrantDetected: boolean;
  canExecuteSafely: boolean;
  blockers: string[];
}

export interface MudirKamarProvisionResult {
  mode: "READ_ONLY_PREFLIGHT" | "EXECUTED";
  executed: boolean;
  preflight: MudirKamarPreflightReport;
  targetWriteManifest: {
    capability: {
      action: "REUSE" | "CREATE";
      code: string;
      namespace: CapabilityNamespace;
      name: string;
      description: string;
    };
    positionCapability: {
      action: "CREATE";
      positionCode: string;
      capabilityCode: string;
      scopeType: string;
      businessRuleState: string;
    };
  };
  executionResult?: {
    capabilityActionTaken: string;
    positionCapabilityIdCreated?: string;
  };
}

export async function runMudirKamarManagePreflight(
  prisma: PrismaClient = defaultPrisma
): Promise<MudirKamarPreflightReport> {
  const blockers: string[] = [];

  // 1. Check capability keasramaan.kamar.manage
  const cap = await prisma.capability.findUnique({
    where: { code: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE },
  });

  // 2. Check Position MUDIR
  const mudirPositions = await prisma.position.findMany({
    where: { code: MUDIR_KAMAR_MANAGE_TARGET_POLICY.positionCode },
    include: {
      assignments: {
        where: { status: "ACTIVE" },
        include: { user: { select: { username: true } } },
      },
      capabilities: {
        where: { capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE },
      },
    },
  });

  const mudirPos = mudirPositions[0] || null;

  // 3. Check KEPALA_KEASRAMAAN grants for keasramaan.kamar.manage
  const kkGrants = await prisma.positionCapability.findMany({
    where: {
      position: { code: "KEPALA_KEASRAMAAN" },
      capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
    },
  });

  if (mudirPositions.length === 0) {
    blockers.push("Position 'MUDIR' does not exist in database.");
  }

  if (mudirPos && mudirPos.assignments.length === 0) {
    blockers.push("Position 'MUDIR' has zero active assignments.");
  }

  const conflictingGrantDetected = kkGrants.length > 0;
  if (conflictingGrantDetected) {
    blockers.push(
      "CONFLICT_REQUIRES_OWNER_AUTHORIZATION: Conflicting production grant exists for KEPALA_KEASRAMAAN + keasramaan.kamar.manage."
    );
  }

  const mudirGrants = mudirPos?.capabilities || [];

  return {
    capabilityCount: cap ? 1 : 0,
    capabilityDetails: {
      exists: Boolean(cap),
      code: cap?.code,
      namespace: cap?.namespace,
      name: cap?.name,
    },
    mudirPositionCount: mudirPositions.length,
    mudirPositionDetails: mudirPos
      ? {
          id: mudirPos.id,
          code: mudirPos.code,
          isActive: mudirPos.isActive,
        }
      : undefined,
    mudirActiveAssignmentCount: mudirPos?.assignments.length || 0,
    mudirActiveAssignments: (mudirPos?.assignments || []).map((a) => ({
      id: a.id,
      userId: a.userId,
      username: a.user?.username,
      status: a.status,
    })),
    mudirKamarManageGrantCount: mudirGrants.length,
    mudirGrantDetails: mudirGrants.map((g) => ({
      id: g.id,
      scopeType: g.scopeType,
      businessRuleState: g.businessRuleState,
    })),
    kepalaKeasramaanGrantCount: kkGrants.length,
    kepalaKeasramaanGrantDetails: kkGrants.map((g) => ({
      id: g.id,
      scopeType: g.scopeType,
      businessRuleState: g.businessRuleState,
    })),
    conflictingGrantDetected,
    canExecuteSafely: blockers.length === 0,
    blockers,
  };
}

export async function provisionMudirKamarManage(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env,
  prisma: PrismaClient = defaultPrisma
): Promise<MudirKamarProvisionResult> {
  const hasExecute = argv.includes("--execute");
  const hasScope = argv.includes("--approved-scope=W2-MUDIR-KAMAR");
  const hasEnv = env.PRODUCTION_MUTATION_APPROVED === "W2-MUDIR-KAMAR";

  const preflight = await runMudirKamarManagePreflight(prisma);

  const targetWriteManifest: MudirKamarProvisionResult["targetWriteManifest"] = {
    capability: {
      action: preflight.capabilityDetails.exists ? "REUSE" : "CREATE",
      code: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
      namespace: CapabilityNamespace.KEASRAMAAN,
      name: "Manajemen Struktur Kamar & Mudhabbir",
      description: "Prerogatif Mudir untuk membuat/mengedit Kamar, penempatan santri, dan penetapan Mudhabbir (ORR-082/085)",
    },
    positionCapability: {
      action: "CREATE",
      positionCode: MUDIR_KAMAR_MANAGE_TARGET_POLICY.positionCode,
      capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
      scopeType: "GLOBAL",
      businessRuleState: "VERIFIED_PRODUCTION",
    },
  };

  if (!hasExecute || !hasScope || !hasEnv) {
    return {
      mode: "READ_ONLY_PREFLIGHT",
      executed: false,
      preflight,
      targetWriteManifest,
    };
  }

  if (!preflight.canExecuteSafely) {
    throw new Error(
      `ABORT: Cannot execute provisioning due to preflight blockers: ${preflight.blockers.join("; ")}`
    );
  }

  // EXECUTE TRANSACTIONALLY WITHOUT UPSERT OR ON CONFLICT
  return await prisma.$transaction(async (tx) => {
    let capabilityAction = "REUSED";
    let capRow = await tx.capability.findUnique({
      where: { code: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE },
    });

    if (!capRow) {
      capRow = await tx.capability.create({
        data: {
          code: targetWriteManifest.capability.code,
          namespace: targetWriteManifest.capability.namespace,
          name: targetWriteManifest.capability.name,
          description: targetWriteManifest.capability.description,
          isDangerous: false,
        },
      });
      capabilityAction = "CREATED";
    }

    const mudirPos = await tx.position.findUnique({
      where: { code: MUDIR_KAMAR_MANAGE_TARGET_POLICY.positionCode },
    });
    if (!mudirPos) {
      throw new Error("Position MUDIR not found inside transaction.");
    }

    const existingGrant = await tx.positionCapability.findFirst({
      where: {
        positionId: mudirPos.id,
        capabilityCode: capRow.code,
      },
    });

    if (existingGrant) {
      throw new Error(
        `ABORT: PositionCapability for MUDIR + ${capRow.code} already exists (ID: ${existingGrant.id}).`
      );
    }

    const newGrant = await tx.positionCapability.create({
      data: {
        positionId: mudirPos.id,
        capabilityCode: capRow.code,
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
      },
    });

    return {
      mode: "EXECUTED",
      executed: true,
      preflight,
      targetWriteManifest,
      executionResult: {
        capabilityActionTaken: capabilityAction,
        positionCapabilityIdCreated: newGrant.id,
      },
    };
  });
}

// Direct CLI invocation
if (require.main === module) {
  provisionMudirKamarManage()
    .then((result) => {
      console.log("=== W2 MUDIR KAMAR MANAGE PROVISIONING REPORT ===");
      console.log(`MODE: ${result.mode} (Executed: ${result.executed})`);
      console.log("PREFLIGHT:", JSON.stringify(result.preflight, null, 2));
      console.log("TARGET WRITE MANIFEST:", JSON.stringify(result.targetWriteManifest, null, 2));
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
