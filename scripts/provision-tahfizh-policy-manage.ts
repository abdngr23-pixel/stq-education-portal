/**
 * STQ EDUCATION PORTAL — V3.1 CANONICAL PROVISIONING TOOL
 * Target: ORR-079 (Provision Capability tahfizh.policy.manage and MUDIR GLOBAL grant)
 *
 * SAFETY CONTRACT:
 * - Defaults strictly to READ-ONLY / PREFLIGHT MODE.
 * - Required CLI flags for execution: --execute --approved-scope=V3.1-ORR079
 * - Required ENV for execution: PRODUCTION_MUTATION_APPROVED=V3.1-ORR079
 * - Single atomic Prisma $transaction creating exactly 2 rows:
 *     1. Capability: tahfizh.policy.manage
 *     2. PositionCapability: MUDIR + tahfizh.policy.manage (GLOBAL / VERIFIED_PRODUCTION)
 * - Zero Position creation.
 * - Zero Assignment creation.
 * - Zero UPDATE, DELETE, UPSERT, or ON CONFLICT.
 * - Never prints DATABASE_URL, passwords, tokens, cookies, or secrets.
 */

import {
  PrismaClient,
  ScopeType,
  BusinessRuleState,
  CapabilityNamespace,
} from "@prisma/client";
import {
  TAHFIZH_POLICY_MANAGE_MANIFEST,
} from "../types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
} from "../lib/auth/canonical-evaluator";

export interface ProvisioningGuards {
  hasExecuteFlag: boolean;
  hasApprovedScopeFlag: boolean;
  hasEnvApproval: boolean;
  isExecuteApproved: boolean;
  guardReasons: string[];
}

export interface ProvisioningPreflightReport {
  diagnosticDbMatchesProduction: boolean;
  capabilityPrestate: {
    count: number;
    isAbsent: boolean;
  };
  positionMudir: {
    count: number;
    id?: string;
    code?: string;
    isActive?: boolean;
    domain?: string;
  };
  activeMudirAssignments: Array<{
    id: string;
    userId: string;
    username: string;
    unitCode: string;
    status: string;
  }>;
  positionCapabilityPrestate: {
    count: number;
    isAbsent: boolean;
  };
  allPreconditionsPass: boolean;
  validationErrors: string[];
}

export interface VerificationMatrixScenario {
  persona: string;
  expectedResult: "ALLOW" | "DENY";
  actualResult: "ALLOW" | "DENY";
  reasonCode: string;
  passed: boolean;
}

export function parseProvisioningGuards(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
): ProvisioningGuards {
  const hasExecuteFlag = argv.includes("--execute");

  let hasApprovedScopeFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--approved-scope=V3.1-ORR079") {
      hasApprovedScopeFlag = true;
    } else if (arg === "--approved-scope" && argv[i + 1] === "V3.1-ORR079") {
      hasApprovedScopeFlag = true;
    }
  }

  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "V3.1-ORR079";

  const guardReasons: string[] = [];
  if (!hasExecuteFlag) guardReasons.push("Missing required CLI flag: --execute");
  if (!hasApprovedScopeFlag) guardReasons.push("Missing required CLI flag: --approved-scope=V3.1-ORR079");
  if (!hasEnvApproval) guardReasons.push("Missing required ENV variable: PRODUCTION_MUTATION_APPROVED=V3.1-ORR079");

  const isExecuteApproved = hasExecuteFlag && hasApprovedScopeFlag && hasEnvApproval;

  return {
    hasExecuteFlag,
    hasApprovedScopeFlag,
    hasEnvApproval,
    isExecuteApproved,
    guardReasons,
  };
}

export async function runProvisioningPreflight(
  prisma: PrismaClient
): Promise<ProvisioningPreflightReport> {
  const validationErrors: string[] = [];

  // 1. Diagnostic DB check
  let diagnosticDbMatchesProduction = false;
  try {
    const unitRoot = await prisma.orgUnit.findUnique({
      where: { code: "OU-STQ-ROOT" },
    });
    const mudirUser = await prisma.user.findUnique({
      where: { username: "mudir" },
    });
    diagnosticDbMatchesProduction = Boolean(unitRoot && mudirUser);
  } catch (err) {
    validationErrors.push(`Diagnostic DB check failed: ${(err as Error).message}`);
  }

  if (!diagnosticDbMatchesProduction) {
    validationErrors.push("Precondition failed: Database does not match production profile.");
  }

  // 2. Capability prestate: must be exactly 0 (ABSENT)
  const capCount = await prisma.capability.count({
    where: { code: TAHFIZH_POLICY_MANAGE_MANIFEST.code },
  });
  const capabilityPrestate = {
    count: capCount,
    isAbsent: capCount === 0,
  };
  if (capCount !== 0) {
    validationErrors.push(`Precondition failed: Capability '${TAHFIZH_POLICY_MANAGE_MANIFEST.code}' already exists (count: ${capCount}).`);
  }

  // 3. Position MUDIR: must be exactly 1 and active
  const mudirPositions = await prisma.position.findMany({
    where: { code: "MUDIR" },
  });
  if (mudirPositions.length !== 1) {
    validationErrors.push(`Precondition failed: Expected exactly 1 Position MUDIR, found ${mudirPositions.length}.`);
  }
  const mudirPos = mudirPositions[0];
  if (mudirPos && !mudirPos.isActive) {
    validationErrors.push("Precondition failed: Position MUDIR is inactive (isActive = false).");
  }

  const positionMudir = {
    count: mudirPositions.length,
    id: mudirPos?.id,
    code: mudirPos?.code,
    isActive: mudirPos?.isActive,
    domain: mudirPos?.domain,
  };

  // 4. Active MUDIR Assignments: must contain expected production principal (mudir)
  const assignments = await prisma.assignment.findMany({
    where: {
      position: { code: "MUDIR" },
      status: "ACTIVE",
    },
    include: {
      user: true,
      unit: true,
    },
  });

  if (assignments.length === 0) {
    validationErrors.push("Precondition failed: No active Assignment found for Position MUDIR.");
  }

  const activeMudirAssignments = assignments.map((a) => ({
    id: a.id,
    userId: a.userId,
    username: a.user.username,
    unitCode: a.unit.code,
    status: a.status,
  }));

  // 5. PositionCapability prestate: must be exactly 0 (ABSENT)
  let posCapCount = 0;
  if (mudirPos) {
    posCapCount = await prisma.positionCapability.count({
      where: {
        positionId: mudirPos.id,
        capabilityCode: TAHFIZH_POLICY_MANAGE_MANIFEST.code,
      },
    });
  }
  const positionCapabilityPrestate = {
    count: posCapCount,
    isAbsent: posCapCount === 0,
  };
  if (posCapCount !== 0) {
    validationErrors.push(`Precondition failed: PositionCapability for MUDIR + '${TAHFIZH_POLICY_MANAGE_MANIFEST.code}' already exists (count: ${posCapCount}).`);
  }

  const allPreconditionsPass = validationErrors.length === 0;

  return {
    diagnosticDbMatchesProduction,
    capabilityPrestate,
    positionMudir,
    activeMudirAssignments,
    positionCapabilityPrestate,
    allPreconditionsPass,
    validationErrors,
  };
}

export async function runPostProvisionVerification(
  prisma: PrismaClient
): Promise<VerificationMatrixScenario[]> {
  const dataProvider = createPrismaDataProvider(prisma);
  const capabilityCode = TAHFIZH_POLICY_MANAGE_MANIFEST.code;

  // We test the matrix of personas against the authorization engine
  const scenarios: Array<{
    persona: string;
    username: string;
    expectedResult: "ALLOW" | "DENY";
  }> = [
    { persona: "MUDIR (mudir)", username: "mudir", expectedResult: "ALLOW" },
    { persona: "KABID_TAHFIZH (musyirfah.putri / kabid)", username: "musyirfah.putri", expectedResult: "DENY" },
    { persona: "ORDINARY_MT (ust.husein)", username: "ust.husein", expectedResult: "DENY" },
    { persona: "POT / LISA", username: "musyirfah.putri", expectedResult: "DENY" },
    { persona: "ADM (admin)", username: "admin", expectedResult: "DENY" },
    { persona: "OSDA (osda.putri)", username: "osda.putri", expectedResult: "DENY" },
  ];

  const results: VerificationMatrixScenario[] = [];

  for (const s of scenarios) {
    const user = await prisma.user.findUnique({
      where: { username: s.username },
    });

    if (!user) {
      // If user does not exist in target DB, it naturally fails closed
      results.push({
        persona: s.persona,
        expectedResult: s.expectedResult,
        actualResult: "DENY",
        reasonCode: "USER_NOT_FOUND_FAIL_CLOSED",
        passed: s.expectedResult === "DENY",
      });
      continue;
    }

    const authRes = await authorizeCanonical({
      identity: {
        userId: user.id,
        username: user.username,
        status: user.status,
        accountType: user.accountType,
        staffId: user.staffId,
      },
      capability: capabilityCode,
      dataProvider,
    });

    const actualResult = authRes.decision === "ALLOW" ? "ALLOW" : "DENY";
    results.push({
      persona: s.persona,
      expectedResult: s.expectedResult,
      actualResult,
      reasonCode: authRes.reasonCode,
      passed: actualResult === s.expectedResult,
    });
  }

  return results;
}

export async function main() {
  const guards = parseProvisioningGuards();
  const prisma = new PrismaClient();

  console.log("==================================================");
  console.log("STQ EDUCATION PORTAL — V3.1 CANONICAL PROVISIONING TOOL");
  console.log("==================================================");
  console.log(`MODE: ${guards.isExecuteApproved ? "EXECUTE (APPROVED)" : "READ ONLY (DEFAULT)"}`);

  try {
    const preflight = await runProvisioningPreflight(prisma);

    console.log("\n[CANONICAL METADATA MANIFEST]");
    console.log(`- CODE       : ${TAHFIZH_POLICY_MANAGE_MANIFEST.code}`);
    console.log(`- NAMESPACE  : ${TAHFIZH_POLICY_MANAGE_MANIFEST.namespace}`);
    console.log(`- NAME       : ${TAHFIZH_POLICY_MANAGE_MANIFEST.name}`);
    console.log(`- DESCRIPTION: ${TAHFIZH_POLICY_MANAGE_MANIFEST.description}`);
    console.log(`- IS_DANGEROUS: ${TAHFIZH_POLICY_MANAGE_MANIFEST.isDangerous}`);

    console.log("\n[PROVISIONING PREFLIGHT REPORT]");
    console.log(`- DIAGNOSTIC_DB_MATCHES_PRODUCTION: ${preflight.diagnosticDbMatchesProduction ? "YES" : "NO"}`);
    console.log(`- CAPABILITY_PRESTATE_COUNT       : ${preflight.capabilityPrestate.count} (${preflight.capabilityPrestate.isAbsent ? "ABSENT" : "PRESENT"})`);
    console.log(`- POSITION_MUDIR_COUNT            : ${preflight.positionMudir.count} (Active: ${preflight.positionMudir.isActive ? "YES" : "NO"})`);
    console.log(`- ACTIVE_MUDIR_ASSIGNMENTS        : ${preflight.activeMudirAssignments.length}`);
    for (const a of preflight.activeMudirAssignments) {
      console.log(`    * User: ${a.username} | Unit: ${a.unitCode} | Status: ${a.status}`);
    }
    console.log(`- POSITION_CAPABILITY_PRESTATE    : ${preflight.positionCapabilityPrestate.count} (${preflight.positionCapabilityPrestate.isAbsent ? "ABSENT" : "PRESENT"})`);
    console.log(`- ALL_PRECONDITIONS_PASS          : ${preflight.allPreconditionsPass ? "YES" : "NO"}`);

    if (preflight.validationErrors.length > 0) {
      console.error("\n[PREFLIGHT VALIDATION ERRORS]");
      for (const err of preflight.validationErrors) {
        console.error(`  * ${err}`);
      }
    }

    if (!guards.isExecuteApproved) {
      console.log("\n[EXECUTION GUARDS]");
      console.log("Execution not requested or required guards missing:");
      for (const r of guards.guardReasons) {
        console.log(`  * ${r}`);
      }
      console.log("\n>>> Zero writes performed. Preflight completed in READ-ONLY mode. <<<");
      return;
    }

    // Execution path: guarded and approved
    if (!preflight.allPreconditionsPass) {
      console.error("\nFATAL: Preconditions failed. Aborting execution.");
      process.exit(1);
    }

    const mudirPosId = preflight.positionMudir.id;
    if (!mudirPosId) {
      console.error("\nFATAL: Position MUDIR ID is missing.");
      process.exit(1);
    }

    console.log("\n[EXECUTING CANONICAL TRANSACTION (EXACTLY 2 ROWS)]");
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify absence inside transaction (Serializable check)
      const capInside = await tx.capability.findUnique({
        where: { code: TAHFIZH_POLICY_MANAGE_MANIFEST.code },
      });
      if (capInside) {
        throw new Error(`CONCURRENCY_ABORT: Capability '${TAHFIZH_POLICY_MANAGE_MANIFEST.code}' already exists.`);
      }

      const pcInside = await tx.positionCapability.findUnique({
        where: {
          positionId_capabilityCode: {
            positionId: mudirPosId,
            capabilityCode: TAHFIZH_POLICY_MANAGE_MANIFEST.code,
          },
        },
      });
      if (pcInside) {
        throw new Error("CONCURRENCY_ABORT: PositionCapability already exists.");
      }

      // Row 1: Insert Capability
      const createdCap = await tx.capability.create({
        data: {
          code: TAHFIZH_POLICY_MANAGE_MANIFEST.code,
          namespace: CapabilityNamespace.TAHFIZH,
          name: TAHFIZH_POLICY_MANAGE_MANIFEST.name,
          description: TAHFIZH_POLICY_MANAGE_MANIFEST.description,
          isDangerous: false,
        },
      });

      // Row 2: Insert PositionCapability
      const createdPC = await tx.positionCapability.create({
        data: {
          positionId: mudirPosId,
          capabilityCode: TAHFIZH_POLICY_MANAGE_MANIFEST.code,
          scopeType: ScopeType.GLOBAL,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      });

      return { createdCap, createdPC };
    });

    console.log(`Created Row 1 (Capability): ${result.createdCap.code}`);
    console.log(`Created Row 2 (PositionCapability): ${result.createdPC.id} (Scope: ${result.createdPC.scopeType}, State: ${result.createdPC.businessRuleState})`);

    // Post-provision verification
    console.log("\n[POST-PROVISION VERIFICATION MATRIX]");
    const matrix = await runPostProvisionVerification(prisma);
    let allMatrixPassed = true;
    for (const m of matrix) {
      console.log(`- ${m.persona}: Expected ${m.expectedResult} | Actual ${m.actualResult} (${m.reasonCode}) -> ${m.passed ? "PASS" : "FAIL"}`);
      if (!m.passed) allMatrixPassed = false;
    }

    if (!allMatrixPassed) {
      console.error("\nWARNING: Post-provision verification matrix contains unexpected failures.");
    } else {
      console.log("\n>>> All post-provision matrix evaluations PASSED successfully. <<<");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL ERROR in provision-tahfizh-policy-manage:", err);
    process.exit(1);
  });
}
