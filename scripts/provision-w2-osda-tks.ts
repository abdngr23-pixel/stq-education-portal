/**
 * STQ EDUCATION PORTAL — W2 STRUCTURAL PROVISIONING SCRIPT
 * Reference: ORR-089 (5 OSDA Division OrgUnits) & ORR-094 (6 TKS Service Unit OrgUnits)
 * Directive: DIR-2026-W2-STRUCTURAL
 *
 * SAFETY CONTRACT:
 * - Defaults strictly to READ-ONLY / PREFLIGHT MODE.
 * - Requires explicit CLI flags: --execute --owner-directive=DIR-2026-W2-STRUCTURAL
 * - Requires explicit ENV flag: PRODUCTION_MUTATION_APPROVED=DIR-2026-W2-STRUCTURAL
 * - Zero user account creation (OrgUnits only; no arbitrary accounts).
 * - Atomic transaction if executed.
 * - Never prints DATABASE_URL, passwords, tokens, or credentials.
 */

import { PrismaClient, OrgUnitType, OrgDomain, GenderComplex } from "@prisma/client";
import prismaDefault from "../lib/prisma";

export interface ExecutionGuardReport {
  hasExecuteFlag: boolean;
  hasOwnerDirectiveFlag: boolean;
  hasEnvApproval: boolean;
  isExecuteApproved: boolean;
  failureReasons: string[];
}

export interface UnitTargetSpec {
  code: string;
  name: string;
  type: OrgUnitType;
  domain: OrgDomain;
  genderComplex: GenderComplex;
  parentCode: string;
}

export const TARGET_OSDA_DIVISIONS: UnitTargetSpec[] = [
  {
    code: "OU-OSDA-KEAMANAN",
    name: "Divisi Keamanan dan Kedisiplinan",
    type: "DIVISION",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-OSDA-ROOT",
  },
  {
    code: "OU-OSDA-PENDIDIKAN",
    name: "Divisi Pendidikan dan Ibadah",
    type: "DIVISION",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-OSDA-ROOT",
  },
  {
    code: "OU-OSDA-KEBERSIHAN",
    name: "Divisi Kebersihan dan Kerapihan",
    type: "DIVISION",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-OSDA-ROOT",
  },
  {
    code: "OU-OSDA-KESEHATAN",
    name: "Divisi Kesehatan",
    type: "DIVISION",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-OSDA-ROOT",
  },
  {
    code: "OU-OSDA-SARPRAS",
    name: "Divisi Sarana dan Prasarana",
    type: "DIVISION",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-OSDA-ROOT",
  },
];

export const TARGET_TKS_SERVICE_UNITS: UnitTargetSpec[] = [
  {
    code: "OU-TKS-DAPUR",
    name: "Dapur dan Gizi",
    type: "SERVICE_UNIT",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-TKS-ROOT",
  },
  {
    code: "OU-TKS-MASJID",
    name: "Masjid",
    type: "SERVICE_UNIT",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-TKS-ROOT",
  },
  {
    code: "OU-TKS-PENDIDIKAN",
    name: "Kantor Pendidikan",
    type: "SERVICE_UNIT",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-TKS-ROOT",
  },
  {
    code: "OU-TKS-YAYASAN",
    name: "Kantor Yayasan",
    type: "SERVICE_UNIT",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-TKS-ROOT",
  },
  {
    code: "OU-TKS-AIR-MINUM",
    name: "Air Minum",
    type: "SERVICE_UNIT",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-TKS-ROOT",
  },
  {
    code: "OU-TKS-AIR-SUMUR",
    name: "Air Sumur",
    type: "SERVICE_UNIT",
    domain: "KEASRAMAAN",
    genderComplex: "CAMPUR",
    parentCode: "OU-TKS-ROOT",
  },
];

export function evaluateExecutionGuards(
  argv: string[],
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ExecutionGuardReport {
  const hasExecuteFlag = argv.includes("--execute");
  const hasOwnerDirectiveFlag = argv.includes("--owner-directive=DIR-2026-W2-STRUCTURAL");
  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "DIR-2026-W2-STRUCTURAL";

  const failureReasons: string[] = [];

  if (hasExecuteFlag) {
    if (!hasOwnerDirectiveFlag) {
      failureReasons.push("Missing required CLI flag: --owner-directive=DIR-2026-W2-STRUCTURAL");
    }
    if (!hasEnvApproval) {
      failureReasons.push("Missing required ENV flag: PRODUCTION_MUTATION_APPROVED=DIR-2026-W2-STRUCTURAL");
    }
  }

  const isExecuteApproved = hasExecuteFlag && hasOwnerDirectiveFlag && hasEnvApproval;

  return {
    hasExecuteFlag,
    hasOwnerDirectiveFlag,
    hasEnvApproval,
    isExecuteApproved,
    failureReasons,
  };
}

export interface UnitPreflightStatus {
  spec: UnitTargetSpec;
  exists: boolean;
  existingId?: string;
  parentExists: boolean;
  parentId?: string;
  driftErrors?: string[];
}

export interface StructuralPreflightReport {
  parentOsdaRoot: { exists: boolean; id?: string; isActive?: boolean };
  parentTksRoot: { exists: boolean; id?: string; isActive?: boolean };
  osdaDivisions: UnitPreflightStatus[];
  tksServiceUnits: UnitPreflightStatus[];
  allParentsExist: boolean;
  missingUnitsCount: number;
  configDrifts: string[];
}

export async function runStructuralPreflight(
  prisma: PrismaClient
): Promise<StructuralPreflightReport> {
  const osdaRoot = await prisma.orgUnit.findUnique({ where: { code: "OU-OSDA-ROOT" } });
  const tksRoot = await prisma.orgUnit.findUnique({ where: { code: "OU-TKS-ROOT" } });

  const parentOsdaReport = {
    exists: Boolean(osdaRoot),
    id: osdaRoot?.id,
    isActive: osdaRoot?.isActive,
  };

  const parentTksReport = {
    exists: Boolean(tksRoot),
    id: tksRoot?.id,
    isActive: tksRoot?.isActive,
  };

  const osdaDivisions: UnitPreflightStatus[] = [];
  for (const spec of TARGET_OSDA_DIVISIONS) {
    const existing = await prisma.orgUnit.findUnique({ where: { code: spec.code } });
    const driftErrors: string[] = [];
    if (existing) {
      if (existing.name !== spec.name) {
        driftErrors.push(`name mismatch for ${spec.code}: expected "${spec.name}", found "${existing.name}"`);
      }
      if (existing.type !== spec.type) {
        driftErrors.push(`type mismatch for ${spec.code}: expected "${spec.type}", found "${existing.type}"`);
      }
      if (existing.domain !== spec.domain) {
        driftErrors.push(`domain mismatch for ${spec.code}: expected "${spec.domain}", found "${existing.domain}"`);
      }
      if (existing.genderComplex !== spec.genderComplex) {
        driftErrors.push(`genderComplex mismatch for ${spec.code}: expected "${spec.genderComplex}", found "${existing.genderComplex}"`);
      }
      if (existing.parentId !== osdaRoot?.id) {
        driftErrors.push(`parent mismatch for ${spec.code}: expected "${osdaRoot?.id}" (${spec.parentCode}), found "${existing.parentId}"`);
      }
    }
    osdaDivisions.push({
      spec,
      exists: Boolean(existing),
      existingId: existing?.id,
      parentExists: Boolean(osdaRoot),
      parentId: osdaRoot?.id,
      driftErrors,
    });
  }

  const tksServiceUnits: UnitPreflightStatus[] = [];
  for (const spec of TARGET_TKS_SERVICE_UNITS) {
    const existing = await prisma.orgUnit.findUnique({ where: { code: spec.code } });
    const driftErrors: string[] = [];
    if (existing) {
      if (existing.name !== spec.name) {
        driftErrors.push(`name mismatch for ${spec.code}: expected "${spec.name}", found "${existing.name}"`);
      }
      if (existing.type !== spec.type) {
        driftErrors.push(`type mismatch for ${spec.code}: expected "${spec.type}", found "${existing.type}"`);
      }
      if (existing.domain !== spec.domain) {
        driftErrors.push(`domain mismatch for ${spec.code}: expected "${spec.domain}", found "${existing.domain}"`);
      }
      if (existing.genderComplex !== spec.genderComplex) {
        driftErrors.push(`genderComplex mismatch for ${spec.code}: expected "${spec.genderComplex}", found "${existing.genderComplex}"`);
      }
      if (existing.parentId !== tksRoot?.id) {
        driftErrors.push(`parent mismatch for ${spec.code}: expected "${tksRoot?.id}" (${spec.parentCode}), found "${existing.parentId}"`);
      }
    }
    tksServiceUnits.push({
      spec,
      exists: Boolean(existing),
      existingId: existing?.id,
      parentExists: Boolean(tksRoot),
      parentId: tksRoot?.id,
      driftErrors,
    });
  }

  const configDrifts = [
    ...osdaDivisions.flatMap((u) => u.driftErrors || []),
    ...tksServiceUnits.flatMap((u) => u.driftErrors || []),
  ];

  const allParentsExist = Boolean(osdaRoot && tksRoot && osdaRoot.isActive && tksRoot.isActive);
  const missingUnitsCount =
    osdaDivisions.filter((u) => !u.exists).length +
    tksServiceUnits.filter((u) => !u.exists).length;

  return {
    parentOsdaRoot: parentOsdaReport,
    parentTksRoot: parentTksReport,
    osdaDivisions,
    tksServiceUnits,
    allParentsExist,
    missingUnitsCount,
    configDrifts,
  };
}

export async function executeStructuralProvisioning(
  prisma: PrismaClient,
  preflight: StructuralPreflightReport
): Promise<{ success: boolean; createdUnits: string[]; message: string }> {
  if (preflight.configDrifts.length > 0) {
    throw new Error(
      `STOP / CONFIG_DRIFT: Existing structural units have configuration drift. Silent repair prohibited. Details: ${preflight.configDrifts.join("; ")}`
    );
  }

  if (!preflight.allParentsExist) {
    throw new Error("PRECONDITION_FAILED: Parent OrgUnits (OU-OSDA-ROOT and OU-TKS-ROOT) must both exist and be active.");
  }

  const createdUnits: string[] = [];

  await prisma.$transaction(async (tx) => {
    // 1. Provision OSDA Divisions
    for (const item of preflight.osdaDivisions) {
      if (item.exists) {
        continue;
      }
      const created = await tx.orgUnit.create({
        data: {
          code: item.spec.code,
          name: item.spec.name,
          type: item.spec.type,
          domain: item.spec.domain,
          genderComplex: item.spec.genderComplex,
          parentId: preflight.parentOsdaRoot.id!,
          isActive: true,
        },
      });
      createdUnits.push(created.code);
    }

    // 2. Provision TKS Service Units
    for (const item of preflight.tksServiceUnits) {
      if (item.exists) {
        continue;
      }
      const created = await tx.orgUnit.create({
        data: {
          code: item.spec.code,
          name: item.spec.name,
          type: item.spec.type,
          domain: item.spec.domain,
          genderComplex: item.spec.genderComplex,
          parentId: preflight.parentTksRoot.id!,
          isActive: true,
        },
      });
      createdUnits.push(created.code);
    }
  });

  return {
    success: true,
    createdUnits,
    message: `Successfully provisioned ${createdUnits.length} structural OrgUnits.`,
  };
}

export async function main() {
  const prisma = prismaDefault;
  const guards = evaluateExecutionGuards(process.argv, process.env);

  console.log("================================================================================");
  console.log(" STQ EDUCATION PORTAL — W2 STRUCTURAL PROVISIONING SCRIPT (ORR-089 & ORR-094)");
  console.log("================================================================================");
  console.log(`Execution Mode: ${guards.isExecuteApproved ? "EXECUTE (MUTATION APPROVED)" : "READ-ONLY PREFLIGHT"}`);
  console.log(`--execute flag: ${guards.hasExecuteFlag}`);
  console.log(`--owner-directive flag: ${guards.hasOwnerDirectiveFlag}`);
  console.log(`PRODUCTION_MUTATION_APPROVED env: ${guards.hasEnvApproval}`);

  if (guards.failureReasons.length > 0) {
    console.log("\nGuard Warnings:");
    for (const reason of guards.failureReasons) {
      console.log(`  - ${reason}`);
    }
  }

  console.log("\n--- Running Preflight Audit ---");
  const preflight = await runStructuralPreflight(prisma);

  console.log(`Parent OU-OSDA-ROOT: ${preflight.parentOsdaRoot.exists ? "FOUND (ID: " + preflight.parentOsdaRoot.id + ")" : "NOT FOUND"}`);
  console.log(`Parent OU-TKS-ROOT:  ${preflight.parentTksRoot.exists ? "FOUND (ID: " + preflight.parentTksRoot.id + ")" : "NOT FOUND"}`);

  console.log("\nORR-089 OSDA Divisions (Target 5 units):");
  for (const item of preflight.osdaDivisions) {
    console.log(`  [${item.exists ? "EXISTS" : "PENDING"}] ${item.spec.code} — ${item.spec.name} (Parent: ${item.spec.parentCode})`);
  }

  console.log("\nORR-094 TKS Service Units (Target 6 units):");
  for (const item of preflight.tksServiceUnits) {
    console.log(`  [${item.exists ? "EXISTS" : "PENDING"}] ${item.spec.code} — ${item.spec.name} (Parent: ${item.spec.parentCode})`);
  }

  console.log(`\nSummary: ${preflight.missingUnitsCount} units pending provisioning.`);
  if (preflight.configDrifts.length > 0) {
    console.log("\nCONFIGURATION DRIFT DETECTED:");
    for (const drift of preflight.configDrifts) {
      console.log(`  [CONFIG_DRIFT] ${drift}`);
    }
  }

  if (!guards.isExecuteApproved) {
    console.log("\nSAFE STOP: Script executed in READ-ONLY mode. ZERO mutations committed.");
    console.log("To execute mutations, supply both flags and environment variable:");
    console.log("  PRODUCTION_MUTATION_APPROVED=DIR-2026-W2-STRUCTURAL npx tsx scripts/provision-w2-osda-tks.ts --execute --owner-directive=DIR-2026-W2-STRUCTURAL");
    return;
  }

  console.log("\nExecuting atomic provisioning transaction...");
  const result = await executeStructuralProvisioning(prisma, preflight);
  console.log(`Result: ${result.message}`);
  console.log(`Created: ${result.createdUnits.join(", ") || "None (already provisioned)"}`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error("FATAL ERROR in provision-w2-osda-tks:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prismaDefault.$disconnect();
    });
}
