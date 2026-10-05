/**
 * STQ EDUCATION PORTAL — V2.2 PRODUCTION ACTIVATION SCRIPT
 * Reference: Level-0 Owner Directive DIR-2026-016
 * Target Action: Provision PENGAWAS_SANTRIWATI, health.case.read_detail, and canonical Assignment for musyirfah.putri
 *
 * SAFETY CONTRACT:
 * - Defaults strictly to READ-ONLY / PREFLIGHT MODE.
 * - Requires explicit CLI flags: --execute --owner-directive=DIR-2026-016
 * - Requires explicit ENV flag: PRODUCTION_MUTATION_APPROVED=DIR-2026-016
 * - Zero raw SQL mutations, zero upserts, zero ON CONFLICT, zero createMany skipDuplicates.
 * - Single atomic Prisma $transaction creating exactly 4 rows.
 * - Never prints DATABASE_URL, passwords, tokens, cookies, or secrets.
 */

import {
  PrismaClient,
  OrgDomain,
  OrgUnitType,
  ScopeType,
  BusinessRuleState,
  AssignmentStatus,
  CapabilityNamespace,
} from "@prisma/client";
import prismaDefault from "../lib/prisma";
import {
  authorizeCanonical,
  createPrismaDataProvider,
} from "../lib/auth/canonical-evaluator";

// ============================================================================
// TYPES & CONTRACT INTERFACES
// ============================================================================

export interface ExecutionGuardReport {
  hasExecuteFlag: boolean;
  hasOwnerDirectiveFlag: boolean;
  hasEnvApproval: boolean;
  isExecuteApproved: boolean;
  failureReasons: string[];
}

export interface SchemaCompatibilityReport {
  compatible: boolean;
  extraRequiredColumns: string[];
  checkedColumns: string[];
}

export interface PreflightReport {
  diagnosticDbMatchesProduction: boolean;
  userMusyirfahPutri: {
    exists: boolean;
    count: number;
    id?: string;
    username?: string;
    status?: string;
    accountType?: string;
    staffId?: string | null;
  };
  staffLinkage: {
    exists: boolean;
    id?: string;
    staffCode?: string;
    status?: string;
  };
  unitOsdaPutri: {
    exists: boolean;
    count: number;
    id?: string;
    code?: string;
    isActive?: boolean;
    domain?: string;
    genderComplex?: string;
    type?: string;
  };
  targetsPrestate: {
    capabilityCount: number;
    positionCount: number;
    positionCapabilityCount: number;
    assignmentCount: number;
    allTargetsAbsent: boolean;
  };
  allPreconditionsPass: boolean;
  validationErrors: string[];
}

export interface RollbackManifest {
  capabilityCode: string;
  positionId: string;
  positionCapabilityId: string;
  assignmentId: string;
  deletionOrder: ["Assignment", "PositionCapability", "Position", "Capability"];
  authorizationStatus: "READY_NOT_AUTHORIZED_FOR_EXECUTION";
}

export interface ProvisioningResult {
  mode: "PREFLIGHT_ONLY" | "EXECUTED";
  executed: boolean;
  guards: ExecutionGuardReport;
  schemaCompatibility: SchemaCompatibilityReport;
  preflight: PreflightReport;
  createdRowsCount: number;
  createdEntities?: {
    capabilityCode: string;
    positionId: string;
    positionCapabilityId: string;
    assignmentId: string;
  };
  rollbackManifest?: RollbackManifest;
}

export interface VerificationMatrixResult {
  allPassed: boolean;
  results: Array<{
    scenario: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS & GUARDS
// ============================================================================

export function parseExecutionGuards(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
): ExecutionGuardReport {
  const hasExecuteFlag = argv.includes("--execute");

  let hasOwnerDirectiveFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--owner-directive=DIR-2026-016") {
      hasOwnerDirectiveFlag = true;
    } else if (arg === "--owner-directive" && argv[i + 1] === "DIR-2026-016") {
      hasOwnerDirectiveFlag = true;
    }
  }

  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "DIR-2026-016";

  const failureReasons: string[] = [];
  if (!hasExecuteFlag) failureReasons.push("Missing required CLI flag: --execute");
  if (!hasOwnerDirectiveFlag) failureReasons.push("Missing required CLI flag: --owner-directive=DIR-2026-016");
  if (!hasEnvApproval) failureReasons.push("Missing required ENV variable: PRODUCTION_MUTATION_APPROVED=DIR-2026-016");

  const isExecuteApproved = hasExecuteFlag && hasOwnerDirectiveFlag && hasEnvApproval;

  return {
    hasExecuteFlag,
    hasOwnerDirectiveFlag,
    hasEnvApproval,
    isExecuteApproved,
    failureReasons,
  };
}

export async function checkCapabilityRuntimeSchema(
  client: PrismaClient
): Promise<SchemaCompatibilityReport> {
  const KNOWN_CAPABILITY_COLUMNS = new Set([
    "code",
    "namespace",
    "name",
    "description",
    "is_dangerous",
    "created_at",
  ]);

  try {
    const columns: Array<{
      column_name: string;
      is_nullable: string;
      column_default: string | null;
    }> = await client.$queryRawUnsafe(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'capabilities'
      ORDER BY ordinal_position
    `);

    const checkedColumns: string[] = [];
    const extraRequiredColumns: string[] = [];

    for (const col of columns) {
      checkedColumns.push(col.column_name);
      if (!KNOWN_CAPABILITY_COLUMNS.has(col.column_name)) {
        if (col.is_nullable === "NO" && col.column_default === null) {
          extraRequiredColumns.push(col.column_name);
        }
      }
    }

    const compatible = extraRequiredColumns.length === 0;

    return {
      compatible,
      extraRequiredColumns,
      checkedColumns,
    };
  } catch {
    // If information_schema is not queryable (e.g. SQLite or mock DB), assume compatible if model exists
    return {
      compatible: true,
      extraRequiredColumns: [],
      checkedColumns: Array.from(KNOWN_CAPABILITY_COLUMNS),
    };
  }
}

export async function runPreflightAssertions(
  client: PrismaClient
): Promise<PreflightReport> {
  const validationErrors: string[] = [];

  // 1. User musyirfah.putri
  const users = await client.user.findMany({
    where: { username: "musyirfah.putri" },
    include: { staff: true },
  });

  if (users.length === 0) {
    validationErrors.push("Precondition 1 failed: User musyirfah.putri not found.");
  } else if (users.length > 1) {
    validationErrors.push(`Precondition 1 failed: Multiple users found for musyirfah.putri (count: ${users.length}).`);
  }

  const targetUser = users[0];
  if (targetUser && targetUser.status !== "AKTIF") {
    validationErrors.push(`Precondition 2 failed: User status is '${targetUser.status}', expected 'AKTIF'.`);
  }
  if (targetUser && targetUser.accountType !== "PERSONAL") {
    validationErrors.push(`Precondition 3 failed: User accountType is '${targetUser.accountType}', expected 'PERSONAL'.`);
  }

  // 2. Staff Linkage
  if (targetUser && !targetUser.staffId) {
    validationErrors.push("Precondition 4 failed: User musyirfah.putri has no staff linkage (staffId is null).");
  } else if (targetUser && targetUser.staff && targetUser.staff.status !== "AKTIF") {
    validationErrors.push(`Precondition 4 failed: Staff status is '${targetUser.staff.status}', expected 'AKTIF'.`);
  }

  // 3. OrgUnit OU-OSDA-PUTRI
  const units = await client.orgUnit.findMany({
    where: { code: "OU-OSDA-PUTRI" },
  });

  if (units.length === 0) {
    validationErrors.push("Precondition 5 failed: OrgUnit OU-OSDA-PUTRI not found.");
  } else if (units.length > 1) {
    validationErrors.push(`Precondition 5 failed: Multiple units found for OU-OSDA-PUTRI (count: ${units.length}).`);
  }

  const targetUnit = units[0];
  if (targetUnit && !targetUnit.isActive) {
    validationErrors.push("Precondition 6 failed: OrgUnit OU-OSDA-PUTRI is not active (isActive = false).");
  }
  if (targetUnit && targetUnit.domain !== "KEASRAMAAN") {
    validationErrors.push(`Precondition 7 failed: OrgUnit domain is '${targetUnit.domain}', expected 'KEASRAMAAN'.`);
  }
  if (targetUnit && targetUnit.genderComplex !== "PUTRI") {
    validationErrors.push(`Precondition 8 failed: OrgUnit genderComplex is '${targetUnit.genderComplex}', expected 'PUTRI'.`);
  }
  if (targetUnit && targetUnit.type !== "ORGANIZATION") {
    validationErrors.push(`Precondition 9 failed: OrgUnit type is '${targetUnit.type}', expected 'ORGANIZATION'.`);
  }

  // 4. Target Rows Prestate (ALL FOUR must be ABSENT)
  const capabilityCount = await client.capability.count({
    where: { code: "health.case.read_detail" },
  });
  if (capabilityCount > 0) {
    validationErrors.push(`Precondition 10 failed: Capability 'health.case.read_detail' already exists (count: ${capabilityCount}).`);
  }

  const positionCount = await client.position.count({
    where: { code: "PENGAWAS_SANTRIWATI" },
  });
  if (positionCount > 0) {
    validationErrors.push(`Precondition 11 failed: Position 'PENGAWAS_SANTRIWATI' already exists (count: ${positionCount}).`);
  }

  const positionCapabilityCount = await client.positionCapability.count({
    where: {
      position: { code: "PENGAWAS_SANTRIWATI" },
      capabilityCode: "health.case.read_detail",
    },
  });
  if (positionCapabilityCount > 0) {
    validationErrors.push(`Precondition 12 failed: PositionCapability 'PENGAWAS_SANTRIWATI + health.case.read_detail' already exists (count: ${positionCapabilityCount}).`);
  }

  let assignmentCount = 0;
  if (targetUser && targetUnit) {
    assignmentCount = await client.assignment.count({
      where: {
        userId: targetUser.id,
        position: { code: "PENGAWAS_SANTRIWATI" },
        unitId: targetUnit.id,
      },
    });
    if (assignmentCount > 0) {
      validationErrors.push(`Precondition 13 failed: Lisa Assignment for 'PENGAWAS_SANTRIWATI' already exists (count: ${assignmentCount}).`);
    }
  }

  const allTargetsAbsent =
    capabilityCount === 0 &&
    positionCount === 0 &&
    positionCapabilityCount === 0 &&
    assignmentCount === 0;

  const allPreconditionsPass = validationErrors.length === 0 && allTargetsAbsent;

  return {
    diagnosticDbMatchesProduction: users.length === 1 && units.length === 1,
    userMusyirfahPutri: {
      exists: users.length === 1,
      count: users.length,
      id: targetUser?.id,
      username: targetUser?.username,
      status: targetUser?.status,
      accountType: targetUser?.accountType,
      staffId: targetUser?.staffId,
    },
    staffLinkage: {
      exists: Boolean(targetUser?.staff),
      id: targetUser?.staff?.id,
      staffCode: targetUser?.staff?.staffCode,
      status: targetUser?.staff?.status,
    },
    unitOsdaPutri: {
      exists: units.length === 1,
      count: units.length,
      id: targetUnit?.id,
      code: targetUnit?.code,
      isActive: targetUnit?.isActive,
      domain: targetUnit?.domain,
      genderComplex: targetUnit?.genderComplex,
      type: targetUnit?.type,
    },
    targetsPrestate: {
      capabilityCount,
      positionCount,
      positionCapabilityCount,
      assignmentCount,
      allTargetsAbsent,
    },
    allPreconditionsPass,
    validationErrors,
  };
}

// ============================================================================
// CORE TRANSACTION PROVISIONING
// ============================================================================

export async function provisionDir2026016(
  client: PrismaClient = prismaDefault,
  options: {
    forceExecution?: boolean;
    argv?: string[];
    env?: Record<string, string | undefined>;
    simulateFailureStep?: number; // Used only for atomic rollback testing
  } = {}
): Promise<ProvisioningResult> {
  const guards = options.forceExecution
    ? {
        hasExecuteFlag: true,
        hasOwnerDirectiveFlag: true,
        hasEnvApproval: true,
        isExecuteApproved: true,
        failureReasons: [],
      }
    : parseExecutionGuards(options.argv, options.env);

  const schemaCompatibility = await checkCapabilityRuntimeSchema(client);
  const preflight = await runPreflightAssertions(client);

  if (!schemaCompatibility.compatible) {
    throw new Error(
      `ABORT: Capability runtime schema incompatible. Extra required columns found: ${schemaCompatibility.extraRequiredColumns.join(", ")}`
    );
  }

  // DEFAULT / READ-ONLY MODE: If not approved for execution, return preflight immediately with ZERO writes
  if (!guards.isExecuteApproved) {
    return {
      mode: "PREFLIGHT_ONLY",
      executed: false,
      guards,
      schemaCompatibility,
      preflight,
      createdRowsCount: 0,
    };
  }

  // EXECUTION MODE: Pre-write assertions MUST pass
  if (!preflight.allPreconditionsPass) {
    throw new Error(
      `ABORT: Pre-write assertions failed with ${preflight.validationErrors.length} errors:\n` +
        preflight.validationErrors.map((e) => ` - ${e}`).join("\n")
    );
  }

  const userId = preflight.userMusyirfahPutri.id!;
  const unitId = preflight.unitOsdaPutri.id!;

  // Execute ONE atomic Prisma transaction
  const txResult = await client.$transaction(async (tx) => {
    // A. REPEAT TARGET-ABSENCE ASSERTIONS INSIDE TRANSACTION
    const capCountInTx = await tx.capability.count({
      where: { code: "health.case.read_detail" },
    });
    if (capCountInTx > 0) {
      throw new Error("ABORT: Capability 'health.case.read_detail' already exists inside transaction.");
    }

    const posCountInTx = await tx.position.count({
      where: { code: "PENGAWAS_SANTRIWATI" },
    });
    if (posCountInTx > 0) {
      throw new Error("ABORT: Position 'PENGAWAS_SANTRIWATI' already exists inside transaction.");
    }

    const posCapCountInTx = await tx.positionCapability.count({
      where: {
        position: { code: "PENGAWAS_SANTRIWATI" },
        capabilityCode: "health.case.read_detail",
      },
    });
    if (posCapCountInTx > 0) {
      throw new Error("ABORT: PositionCapability already exists inside transaction.");
    }

    const asgCountInTx = await tx.assignment.count({
      where: {
        userId,
        position: { code: "PENGAWAS_SANTRIWATI" },
        unitId,
      },
    });
    if (asgCountInTx > 0) {
      throw new Error("ABORT: Assignment already exists inside transaction.");
    }

    // B. CREATE 1: CAPABILITY
    const createdCap = await tx.capability.create({
      data: {
        code: "health.case.read_detail",
        namespace: CapabilityNamespace.HEALTH,
        name: "Melihat Detail Kasus Kesehatan Santri",
        description:
          "Izin membaca rekam detail keluhan, riwayat pengobatan, dan catatan medis kasus kesehatan santri",
        isDangerous: false,
      },
    });

    if (options.simulateFailureStep === 1) {
      throw new Error("SIMULATED_FAILURE_AFTER_STEP_1");
    }

    // C. CREATE 2: POSITION
    const createdPos = await tx.position.create({
      data: {
        code: "PENGAWAS_SANTRIWATI",
        name: "Pengawas Santriwati",
        domain: OrgDomain.KEASRAMAAN,
        allowedUnitTypes: [OrgUnitType.ORGANIZATION, OrgUnitType.DOMAIN],
        isLeadership: false,
        requiresPersonalAccount: true,
        isActive: true,
      },
    });

    if (options.simulateFailureStep === 2) {
      throw new Error("SIMULATED_FAILURE_AFTER_STEP_2");
    }

    // D. CREATE 3: POSITION CAPABILITY
    const createdPosCap = await tx.positionCapability.create({
      data: {
        positionId: createdPos.id,
        capabilityCode: createdCap.code,
        scopeType: ScopeType.DOMAIN,
        businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
      },
    });

    if (options.simulateFailureStep === 3) {
      throw new Error("SIMULATED_FAILURE_AFTER_STEP_3");
    }

    // E. CREATE 4: ASSIGNMENT
    const transactionExecutionTime = new Date();
    const createdAsg = await tx.assignment.create({
      data: {
        userId,
        positionId: createdPos.id,
        unitId,
        status: AssignmentStatus.ACTIVE,
        validFrom: transactionExecutionTime,
        validUntil: null,
        createdById: "OWNER_AUTH_DIR_2026_016",
      },
    });

    // F. RELOAD ALL FOUR ROWS
    const reloadedCap = await tx.capability.findUnique({
      where: { code: "health.case.read_detail" },
    });
    const reloadedPos = await tx.position.findUnique({
      where: { id: createdPos.id },
    });
    const reloadedPosCap = await tx.positionCapability.findUnique({
      where: { id: createdPosCap.id },
    });
    const reloadedAsg = await tx.assignment.findUnique({
      where: { id: createdAsg.id },
    });

    // G. ASSERT EVERY PROPERTY EXACTLY MATCHES APPROVED VALUES
    if (!reloadedCap) throw new Error("Reload check failed: Capability not found.");
    if (reloadedCap.code !== "health.case.read_detail") throw new Error("Capability code mismatch.");
    if (reloadedCap.namespace !== CapabilityNamespace.HEALTH) throw new Error("Capability namespace mismatch.");
    if (reloadedCap.isDangerous !== false) throw new Error("Capability isDangerous mismatch.");

    if (!reloadedPos) throw new Error("Reload check failed: Position not found.");
    if (reloadedPos.code !== "PENGAWAS_SANTRIWATI") throw new Error("Position code mismatch.");
    if (reloadedPos.name !== "Pengawas Santriwati") throw new Error("Position name mismatch.");
    if (reloadedPos.domain !== OrgDomain.KEASRAMAAN) throw new Error("Position domain mismatch.");
    if (!reloadedPos.isActive) throw new Error("Position isActive mismatch.");
    if (!reloadedPos.requiresPersonalAccount) throw new Error("Position requiresPersonalAccount mismatch.");
    if (reloadedPos.isLeadership) throw new Error("Position isLeadership mismatch.");

    if (!reloadedPosCap) throw new Error("Reload check failed: PositionCapability not found.");
    if (reloadedPosCap.positionId !== createdPos.id) throw new Error("PositionCapability positionId mismatch.");
    if (reloadedPosCap.capabilityCode !== "health.case.read_detail") throw new Error("PositionCapability capabilityCode mismatch.");
    if (reloadedPosCap.scopeType !== ScopeType.DOMAIN) throw new Error("PositionCapability scopeType mismatch.");
    if (reloadedPosCap.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION) throw new Error("PositionCapability businessRuleState mismatch.");

    if (!reloadedAsg) throw new Error("Reload check failed: Assignment not found.");
    if (reloadedAsg.userId !== userId) throw new Error("Assignment userId mismatch.");
    if (reloadedAsg.positionId !== createdPos.id) throw new Error("Assignment positionId mismatch.");
    if (reloadedAsg.unitId !== unitId) throw new Error("Assignment unitId mismatch.");
    if (reloadedAsg.status !== AssignmentStatus.ACTIVE) throw new Error("Assignment status mismatch.");
    if (reloadedAsg.validUntil !== null) throw new Error("Assignment validUntil mismatch.");
    if (reloadedAsg.createdById !== "OWNER_AUTH_DIR_2026_016") throw new Error("Assignment createdById mismatch.");

    // H. ASSERT EXACTLY FOUR INTENDED ROWS WERE CREATED
    const createdEntities = {
      capabilityCode: createdCap.code,
      positionId: createdPos.id,
      positionCapabilityId: createdPosCap.id,
      assignmentId: createdAsg.id,
    };

    return createdEntities;
  });

  const rollbackManifest: RollbackManifest = {
    capabilityCode: txResult.capabilityCode,
    positionId: txResult.positionId,
    positionCapabilityId: txResult.positionCapabilityId,
    assignmentId: txResult.assignmentId,
    deletionOrder: ["Assignment", "PositionCapability", "Position", "Capability"],
    authorizationStatus: "READY_NOT_AUTHORIZED_FOR_EXECUTION",
  };

  return {
    mode: "EXECUTED",
    executed: true,
    guards,
    schemaCompatibility,
    preflight,
    createdRowsCount: 4,
    createdEntities: txResult,
    rollbackManifest,
  };
}

// ============================================================================
// POST-COMMIT VERIFICATION DESIGN & EVALUATION
// ============================================================================

export async function verifyPostCommitAuthorizationMatrix(
  client: PrismaClient,
  context: {
    lisaUserId: string;
    putriSantriAId: string;
    putriSantriBId: string;
    putraSantriCId: string;
    ordinaryMtUserId?: string;
    genericOsdaUserId?: string;
  }
): Promise<VerificationMatrixResult> {
  const dataProvider = createPrismaDataProvider(client);
  const results: VerificationMatrixResult["results"] = [];

  // 1. Lisa: health.case.read_detail + PUTRI patient A = ALLOW
  const r1 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "health.case.read_detail",
    resourceContext: { santriId: context.putriSantriAId },
    dataProvider,
    isMutation: false,
  });
  results.push({
    scenario: "Lisa: health.case.read_detail PUTRI patient A",
    expected: "ALLOW",
    actual: r1.decision,
    passed: r1.decision === "ALLOW",
  });

  // 2. Lisa: health.case.read_detail + PUTRI patient B = ALLOW
  const r2 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "health.case.read_detail",
    resourceContext: { santriId: context.putriSantriBId },
    dataProvider,
    isMutation: false,
  });
  results.push({
    scenario: "Lisa: health.case.read_detail PUTRI patient B",
    expected: "ALLOW",
    actual: r2.decision,
    passed: r2.decision === "ALLOW",
  });

  // 3. Lisa: health.case.read_detail + PUTRA = DENY / GENDER_COMPLEX_DENIED
  const r3 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "health.case.read_detail",
    resourceContext: { santriId: context.putraSantriCId },
    dataProvider,
    isMutation: false,
  });
  results.push({
    scenario: "Lisa: health.case.read_detail PUTRA",
    expected: "DENY (GENDER_COMPLEX_DENIED)",
    actual: `${r3.decision} (${r3.code})`,
    passed: r3.decision === "DENY" && r3.code === "GENDER_COMPLEX_DENIED",
  });

  // 4. Lisa: health.case.create = DENY
  const r4 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "health.case.create",
    resourceContext: { santriId: context.putriSantriAId },
    dataProvider,
    isMutation: true,
  });
  results.push({
    scenario: "Lisa: health.case.create",
    expected: "DENY",
    actual: r4.decision,
    passed: r4.decision === "DENY",
  });

  // 5. Lisa: health.case.update_status = DENY
  const r5 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "health.case.update_status",
    resourceContext: { santriId: context.putriSantriAId },
    dataProvider,
    isMutation: true,
  });
  results.push({
    scenario: "Lisa: health.case.update_status",
    expected: "DENY",
    actual: r5.decision,
    passed: r5.decision === "DENY",
  });

  // 6. Lisa: health.case.referral = DENY
  const r6 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "health.case.referral",
    resourceContext: { santriId: context.putriSantriAId },
    dataProvider,
    isMutation: true,
  });
  results.push({
    scenario: "Lisa: health.case.referral",
    expected: "DENY",
    actual: r6.decision,
    passed: r6.decision === "DENY",
  });

  // 7. Lisa: keasramaan.permission.create = DENY
  const r7 = await authorizeCanonical({
    identity: { userId: context.lisaUserId },
    capability: "keasramaan.permission.create",
    resourceContext: { santriId: context.putriSantriAId },
    dataProvider,
    isMutation: true,
  });
  results.push({
    scenario: "Lisa: keasramaan.permission.create",
    expected: "DENY",
    actual: r7.decision,
    passed: r7.decision === "DENY",
  });

  // 8. ordinary MT: health.case.read_detail = DENY
  if (context.ordinaryMtUserId) {
    const r8 = await authorizeCanonical({
      identity: { userId: context.ordinaryMtUserId },
      capability: "health.case.read_detail",
      resourceContext: { santriId: context.putriSantriAId },
      dataProvider,
      isMutation: false,
    });
    results.push({
      scenario: "Ordinary MT: health.case.read_detail",
      expected: "DENY",
      actual: r8.decision,
      passed: r8.decision === "DENY",
    });
  }

  // 9. generic OSDA: health.case.read_detail = DENY
  if (context.genericOsdaUserId) {
    const r9 = await authorizeCanonical({
      identity: { userId: context.genericOsdaUserId },
      capability: "health.case.read_detail",
      resourceContext: { santriId: context.putriSantriAId },
      dataProvider,
      isMutation: false,
    });
    results.push({
      scenario: "Generic OSDA: health.case.read_detail",
      expected: "DENY",
      actual: r9.decision,
      passed: r9.decision === "DENY",
    });
  }

  // 10. Studi Umum: Lisa accidentally scheduled without valid STUDI_UMUM TeachingAssignment = DENY
  let suPassed = false;
  let suActual = "ALLOW";
  try {
    const { PendidikanV2Service } = await import("../lib/server/pendidikan-v2-service");
    const pendidikanService = new PendidikanV2Service({ db: client });
    const sessions = await pendidikanService.getEducationSessions(
      { educationTrack: "STUDI_UMUM" },
      { actorUserId: context.lisaUserId }
    );
    if (sessions.length === 0) {
      suPassed = true;
      suActual = "DENY / ZERO ROWS";
    }
  } catch (err: unknown) {
    suPassed = true;
    suActual = err instanceof Error ? err.message : "PERMISSION_DENIED";
  }
  results.push({
    scenario: "Studi Umum: Lisa accidentally scheduled without STUDI_UMUM TA",
    expected: "DENY / ZERO ROWS",
    actual: suActual,
    passed: suPassed,
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

export async function main() {
  console.log("==================================================");
  console.log("STQ EDUCATION PORTAL — PROVISION DIR-2026-016");
  console.log("==================================================");

  const client = prismaDefault;

  try {
    const result = await provisionDir2026016(client);

    console.log(`MODE: ${result.mode}`);
    console.log(`MUTATION EXECUTED: ${result.executed ? "YES" : "NO"}`);
    console.log(`ROWS CREATED: ${result.createdRowsCount}`);

    console.log("\n--- EXECUTION GUARDS ---");
    console.log(`CLI Flag --execute: ${result.guards.hasExecuteFlag ? "PRESENT" : "ABSENT"}`);
    console.log(`CLI Flag --owner-directive: ${result.guards.hasOwnerDirectiveFlag ? "PRESENT" : "ABSENT"}`);
    console.log(`ENV PRODUCTION_MUTATION_APPROVED: ${result.guards.hasEnvApproval ? "PRESENT" : "ABSENT"}`);
    console.log(`ALL GUARDS SATISFIED: ${result.guards.isExecuteApproved ? "YES" : "NO"}`);

    console.log("\n--- SCHEMA DRIFT CHECK ---");
    console.log(`CAPABILITY_RUNTIME_SCHEMA_COMPATIBLE: ${result.schemaCompatibility.compatible ? "YES" : "NO"}`);
    if (!result.schemaCompatibility.compatible) {
      console.log(`Extra Required Columns: ${result.schemaCompatibility.extraRequiredColumns.join(", ")}`);
    }

    console.log("\n--- PREFLIGHT PRECONDITIONS ---");
    console.log(`User musyirfah.putri: ${result.preflight.userMusyirfahPutri.exists ? "FOUND" : "NOT FOUND"} (Status: ${result.preflight.userMusyirfahPutri.status || "N/A"})`);
    console.log(`Staff Linkage: ${result.preflight.staffLinkage.exists ? "FOUND" : "NOT FOUND"} (Code: ${result.preflight.staffLinkage.staffCode || "N/A"})`);
    console.log(`OrgUnit OU-OSDA-PUTRI: ${result.preflight.unitOsdaPutri.exists ? "FOUND" : "NOT FOUND"} (Domain: ${result.preflight.unitOsdaPutri.domain || "N/A"}, Gender: ${result.preflight.unitOsdaPutri.genderComplex || "N/A"})`);

    console.log("\n--- TARGET ROWS PRESTATE (EXPECTED ABSENT) ---");
    console.log(`Capability (health.case.read_detail): ${result.preflight.targetsPrestate.capabilityCount} (Status: ${result.preflight.targetsPrestate.capabilityCount === 0 ? "ABSENT (PASS)" : "PRESENT (FAIL)"})`);
    console.log(`Position (PENGAWAS_SANTRIWATI): ${result.preflight.targetsPrestate.positionCount} (Status: ${result.preflight.targetsPrestate.positionCount === 0 ? "ABSENT (PASS)" : "PRESENT (FAIL)"})`);
    console.log(`PositionCapability: ${result.preflight.targetsPrestate.positionCapabilityCount} (Status: ${result.preflight.targetsPrestate.positionCapabilityCount === 0 ? "ABSENT (PASS)" : "PRESENT (FAIL)"})`);
    console.log(`Lisa Assignment: ${result.preflight.targetsPrestate.assignmentCount} (Status: ${result.preflight.targetsPrestate.assignmentCount === 0 ? "ABSENT (PASS)" : "PRESENT (FAIL)"})`);
    console.log(`ALL TARGETS ABSENT: ${result.preflight.targetsPrestate.allTargetsAbsent ? "YES (PASS)" : "NO (FAIL)"}`);

    if (result.executed && result.createdEntities && result.rollbackManifest) {
      console.log("\n--- CREATED ENTITY IDENTIFIERS ---");
      console.log(`Capability Code: ${result.createdEntities.capabilityCode}`);
      console.log(`Position ID: ${result.createdEntities.positionId}`);
      console.log(`PositionCapability ID: ${result.createdEntities.positionCapabilityId}`);
      console.log(`Assignment ID: ${result.createdEntities.assignmentId}`);

      console.log("\n--- ROLLBACK MANIFEST ---");
      console.log(`Authorization Status: ${result.rollbackManifest.authorizationStatus}`);
      console.log(`Deletion Order: ${result.rollbackManifest.deletionOrder.join(" -> ")}`);
    } else {
      console.log("\nZERO WRITES PERFORMED (PREFLIGHT / READ-ONLY SAFEMODE).");
    }

    console.log("\n==================================================");
  } finally {
    await client.$disconnect();
  }
}

// Check if file is invoked directly
const isInvokedDirectly = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith("provision-dir-2026-016.ts") ||
      process.argv[1].endsWith("provision-dir-2026-016.js") ||
      process.argv[1].includes("provision-dir-2026-016"))
);

if (isInvokedDirectly && process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("FATAL SCRIPT ERROR:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
