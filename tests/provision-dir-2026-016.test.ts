(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
if (!React.createContext) {
  React.createContext = () => ({
    Provider: () => null,
    Consumer: () => null,
  });
}

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  PrismaClient,
  Role,
  AccountType,
  JenisKelamin,
  HealthStatusV2,
} from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import {
  provisionDir2026016,
  runPreflightAssertions,
  checkCapabilityRuntimeSchema,
  verifyPostCommitAuthorizationMatrix,
} from "../scripts/provision-dir-2026-016";

describe("DIR-2026-016 Production Activation Script & Guard Hardening", () => {
  let prisma: PrismaClient;

  const ROOT_UNIT_ID = "unit-test-root";
  const OSDA_PUTRI_UNIT_ID = "unit-test-osda-putri";
  const LISA_STAFF_ID = "stf-test-lisa";
  const LISA_USER_ID = "usr-test-lisa";

  const SANTRI_PUTRI_A_ID = "san-test-putri-a";
  const SANTRI_PUTRI_B_ID = "san-test-putri-b";
  const SANTRI_PUTRA_C_ID = "san-test-putra-c";
  const CASE_PUTRI_A_ID = "case-test-putri-a";
  const CASE_PUTRI_B_ID = "case-test-putri-b";
  const CASE_PUTRA_C_ID = "case-test-putra-c";

  before(async () => {
    prisma = await startTestDatabase();
  });

  after(async () => {
    await stopTestDatabase();
  });

  // Helper to reset canonical baseline state (Lisa, Staff, OU-OSDA-PUTRI, and patients present; targets absent)
  async function resetBaselineState() {
    // Delete in reverse dependency order
    await prisma.assignment.deleteMany({});
    await prisma.positionCapability.deleteMany({});
    await prisma.position.deleteMany({});
    await prisma.capability.deleteMany({});
    await prisma.healthCaseV2.deleteMany({});
    await prisma.educationSession.deleteMany({});
    await prisma.santri.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.staff.deleteMany({});
    await prisma.orgUnit.deleteMany({});

    // 1. OrgUnits: ROOT and OU-OSDA-PUTRI
    await prisma.orgUnit.createMany({
      data: [
        {
          id: ROOT_UNIT_ID,
          code: "OU-STQ-ROOT",
          name: "STQ Root",
          type: "INSTITUTION",
          domain: "INSTITUTIONAL",
          genderComplex: "TIDAK_TERIKAT",
          isActive: true,
        },
        {
          id: OSDA_PUTRI_UNIT_ID,
          code: "OU-OSDA-PUTRI",
          name: "OSDA Putri",
          type: "ORGANIZATION",
          domain: "KEASRAMAAN",
          genderComplex: "PUTRI",
          isActive: true,
          parentId: ROOT_UNIT_ID,
        },
      ],
    });

    // 2. Staff for Lisa
    await prisma.staff.create({
      data: {
        id: LISA_STAFF_ID,
        staffCode: "STF-0005",
        nama: "Ustadzah Lisa Dwina Fitri",
        noHp: "081234567890",
        roleStaff: Role.MT,
        status: "AKTIF",
      },
    });

    // 3. User for Lisa
    await prisma.user.create({
      data: {
        id: LISA_USER_ID,
        username: "musyirfah.putri",
        passwordHash: "dummy_hash_test",
        role: Role.MT,
        status: "AKTIF",
        accountType: AccountType.PERSONAL,
        staffId: LISA_STAFF_ID,
      },
    });

    // 4. Santri records: PUTRI A, PUTRI B, PUTRA C
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_PUTRI_A_ID,
          nis: "SAN-PUTRI-001",
          nama: "Santriwati A",
          kelas: "7A",
          jenisKelamin: JenisKelamin.P,
        },
        {
          id: SANTRI_PUTRI_B_ID,
          nis: "SAN-PUTRI-002",
          nama: "Santriwati B",
          kelas: "8B",
          jenisKelamin: JenisKelamin.P,
        },
        {
          id: SANTRI_PUTRA_C_ID,
          nis: "SAN-PUTRA-001",
          nama: "Santri Putra C",
          kelas: "7A",
          jenisKelamin: JenisKelamin.L,
        },
      ],
    });

    // 5. Health Cases V2
    await prisma.healthCaseV2.createMany({
      data: [
        {
          id: CASE_PUTRI_A_ID,
          santriId: SANTRI_PUTRI_A_ID,
          occurredAt: new Date(),
          keluhan: "Pusing",
          tindakanAwal: "Istirahat",
          statusV2: HealthStatusV2.DIPANTAU,
          recordedByUserId: LISA_USER_ID,
        },
        {
          id: CASE_PUTRI_B_ID,
          santriId: SANTRI_PUTRI_B_ID,
          occurredAt: new Date(),
          keluhan: "Demam",
          tindakanAwal: "Minum obat",
          statusV2: HealthStatusV2.DIPANTAU,
          recordedByUserId: LISA_USER_ID,
        },
        {
          id: CASE_PUTRA_C_ID,
          santriId: SANTRI_PUTRA_C_ID,
          occurredAt: new Date(),
          keluhan: "Batuk",
          tindakanAwal: "Istirahat",
          statusV2: HealthStatusV2.DIPANTAU,
          recordedByUserId: LISA_USER_ID,
        },
      ],
    });
  }

  beforeEach(async () => {
    await resetBaselineState();
  });

  // =========================================================================
  // TEST 1: DEFAULT INVOCATION = ZERO WRITES
  // =========================================================================
  it("1. Default invocation (no flags, no env) defaults to PREFLIGHT ONLY and performs ZERO writes", async () => {
    const result = await provisionDir2026016(prisma, {
      argv: ["node", "provision-dir-2026-016.ts"],
      env: {},
    });

    assert.strictEqual(result.mode, "PREFLIGHT_ONLY");
    assert.strictEqual(result.executed, false);
    assert.strictEqual(result.createdRowsCount, 0);
    assert.strictEqual(result.guards.isExecuteApproved, false);

    // Verify 0 rows exist for target entities
    const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
    const posCount = await prisma.position.count({ where: { code: "PENGAWAS_SANTRIWATI" } });
    const asgCount = await prisma.assignment.count({ where: { position: { code: "PENGAWAS_SANTRIWATI" } } });
    assert.strictEqual(capCount, 0);
    assert.strictEqual(posCount, 0);
    assert.strictEqual(asgCount, 0);
  });

  // =========================================================================
  // TEST 2: MISSING OWNER GUARD = ZERO WRITES
  // =========================================================================
  it("2. Missing owner guard flag or env confirmation performs ZERO writes", async () => {
    // Subcase 2a: Has --execute but missing --owner-directive and env
    const r1 = await provisionDir2026016(prisma, {
      argv: ["node", "provision-dir-2026-016.ts", "--execute"],
      env: {},
    });
    assert.strictEqual(r1.mode, "PREFLIGHT_ONLY");
    assert.strictEqual(r1.executed, false);
    assert.strictEqual(r1.createdRowsCount, 0);

    // Subcase 2b: Has --execute and --owner-directive but missing env
    const r2 = await provisionDir2026016(prisma, {
      argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
      env: {},
    });
    assert.strictEqual(r2.mode, "PREFLIGHT_ONLY");
    assert.strictEqual(r2.executed, false);
    assert.strictEqual(r2.createdRowsCount, 0);

    // Subcase 2c: Has env but missing CLI flags
    const r3 = await provisionDir2026016(prisma, {
      argv: ["node", "provision-dir-2026-016.ts"],
      env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
    });
    assert.strictEqual(r3.mode, "PREFLIGHT_ONLY");
    assert.strictEqual(r3.executed, false);
    assert.strictEqual(r3.createdRowsCount, 0);

    // Verify DB remains untouched
    const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
    assert.strictEqual(capCount, 0);
  });

  // =========================================================================
  // TEST 3: ALL TARGETS ABSENT -> EXACTLY FOUR ROWS CREATED
  // =========================================================================
  it("3. All targets absent and guards satisfied -> exactly FOUR rows created & post-commit matrix verified", async () => {
    const result = await provisionDir2026016(prisma, {
      argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
      env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
    });

    assert.strictEqual(result.mode, "EXECUTED");
    assert.strictEqual(result.executed, true);
    assert.strictEqual(result.createdRowsCount, 4);
    assert.ok(result.createdEntities);
    assert.strictEqual(result.createdEntities.capabilityCode, "health.case.read_detail");
    assert.ok(result.createdEntities.positionId);
    assert.ok(result.createdEntities.positionCapabilityId);
    assert.ok(result.createdEntities.assignmentId);

    // Check DB rows directly
    const cap = await prisma.capability.findUnique({ where: { code: "health.case.read_detail" } });
    assert.ok(cap);
    assert.strictEqual(cap?.namespace, "HEALTH");
    assert.strictEqual(cap?.isDangerous, false);

    const pos = await prisma.position.findUnique({ where: { id: result.createdEntities.positionId } });
    assert.ok(pos);
    assert.strictEqual(pos?.code, "PENGAWAS_SANTRIWATI");
    assert.strictEqual(pos?.domain, "KEASRAMAAN");
    assert.strictEqual(pos?.isActive, true);

    const posCap = await prisma.positionCapability.findUnique({ where: { id: result.createdEntities.positionCapabilityId } });
    assert.ok(posCap);
    assert.strictEqual(posCap?.scopeType, "DOMAIN");
    assert.strictEqual(posCap?.businessRuleState, "VERIFIED_PRODUCTION");

    const asg = await prisma.assignment.findUnique({ where: { id: result.createdEntities.assignmentId } });
    assert.ok(asg);
    assert.strictEqual(asg?.status, "ACTIVE");
    assert.strictEqual(asg?.createdById, "OWNER_AUTH_DIR_2026_016");

    // Verify Rollback Manifest
    assert.ok(result.rollbackManifest);
    assert.strictEqual(result.rollbackManifest.authorizationStatus, "READY_NOT_AUTHORIZED_FOR_EXECUTION");
    assert.deepStrictEqual(result.rollbackManifest.deletionOrder, [
      "Assignment",
      "PositionCapability",
      "Position",
      "Capability",
    ]);

    // Verify Post-Commit Authorization Matrix
    const matrix = await verifyPostCommitAuthorizationMatrix(prisma, {
      lisaUserId: LISA_USER_ID,
      putriSantriAId: SANTRI_PUTRI_A_ID,
      putriSantriBId: SANTRI_PUTRI_B_ID,
      putraSantriCId: SANTRI_PUTRA_C_ID,
    });
    assert.strictEqual(matrix.allPassed, true, `Verification matrix failed: ${JSON.stringify(matrix.results)}`);
  });

  // =========================================================================
  // TEST 4: ONE TARGET PRE-EXISTING -> ZERO WRITES / FAIL CLOSED
  // =========================================================================
  it("4. One target pre-existing -> zero writes and fails closed", async () => {
    // Seed capability in advance
    await prisma.capability.create({
      data: {
        code: "health.case.read_detail",
        namespace: "HEALTH",
        name: "Existing Pre-state",
        description: "Already exists",
        isDangerous: false,
      },
    });

    await assert.rejects(
      () =>
        provisionDir2026016(prisma, {
          argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
          env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
        }),
      /ABORT: Pre-write assertions failed/
    );

    // Verify Position and Assignment were NOT created
    const posCount = await prisma.position.count({ where: { code: "PENGAWAS_SANTRIWATI" } });
    const asgCount = await prisma.assignment.count({ where: { position: { code: "PENGAWAS_SANTRIWATI" } } });
    assert.strictEqual(posCount, 0);
    assert.strictEqual(asgCount, 0);
  });

  // =========================================================================
  // TEST 5: WRONG UNIT GENDER -> ZERO WRITES
  // =========================================================================
  it("5. Wrong unit genderComplex -> zero writes and fails closed", async () => {
    // Update OU-OSDA-PUTRI genderComplex to PUTRA
    await prisma.orgUnit.update({
      where: { id: OSDA_PUTRI_UNIT_ID },
      data: { genderComplex: "PUTRA" },
    });

    await assert.rejects(
      () =>
        provisionDir2026016(prisma, {
          argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
          env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
        }),
      /Precondition 8 failed: OrgUnit genderComplex is 'PUTRA', expected 'PUTRI'/
    );

    const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
    assert.strictEqual(capCount, 0);
  });

  // =========================================================================
  // TEST 6: DUPLICATE LISA IDENTITY -> ZERO WRITES
  // =========================================================================
  it("6. Duplicate Lisa identity -> zero writes and fails closed", async () => {
    // Temporarily drop unique index on users.username to insert duplicate Lisa identity
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "users_username_key" CASCADE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_key" CASCADE;`);

    try {
      await prisma.user.create({
        data: {
          id: "usr-test-lisa-duplicate",
          username: "musyirfah.putri",
          passwordHash: "dummy-hash-dup",
          role: Role.MT,
          status: "AKTIF",
          accountType: AccountType.PERSONAL,
          staffId: null,
        },
      });

      // Assert preflight detects multiple users
      const preflight = await runPreflightAssertions(prisma);
      assert.strictEqual(preflight.allPreconditionsPass, false);
      assert.strictEqual(preflight.userMusyirfahPutri.count, 2);

      // Assert provisioning rejects and performs zero writes
      await assert.rejects(
        () =>
          provisionDir2026016(prisma, {
            argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
            env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
          }),
        /Multiple users found for musyirfah.putri/
      );

      const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
      assert.strictEqual(capCount, 0);
    } finally {
      await prisma.user.deleteMany({ where: { id: "usr-test-lisa-duplicate" } });
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");`);
    }
  });

  // =========================================================================
  // TEST 7: MALFORMED CAPABILITY SCHEMA / PRECONDITION -> ZERO WRITES
  // =========================================================================
  it("7. Malformed capability precondition (e.g. inactive staff or non-personal user) -> zero writes", async () => {
    // Make staff NONAKTIF
    await prisma.staff.update({
      where: { id: LISA_STAFF_ID },
      data: { status: "NONAKTIF" },
    });

    await assert.rejects(
      () =>
        provisionDir2026016(prisma, {
          argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
          env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
        }),
      /Precondition 4 failed: Staff status is 'NONAKTIF', expected 'AKTIF'/
    );

    // Also assert schema compatibility check
    const schemaCheck = await checkCapabilityRuntimeSchema(prisma);
    assert.strictEqual(schemaCheck.compatible, true);
    assert.strictEqual(schemaCheck.extraRequiredColumns.length, 0);

    const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
    assert.strictEqual(capCount, 0);
  });

  // =========================================================================
  // TEST 8: INTENTIONAL FAILURE AFTER CREATION #2 -> TRANSACTION ROLLS BACK
  // =========================================================================
  it("8. Intentional failure after creation #2 -> entire transaction rolls back completely", async () => {
    await assert.rejects(
      () =>
        provisionDir2026016(prisma, {
          argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
          env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
          simulateFailureStep: 2,
        }),
      /SIMULATED_FAILURE_AFTER_STEP_2/
    );

    // Assert that Capability and Position were both rolled back!
    const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
    const posCount = await prisma.position.count({ where: { code: "PENGAWAS_SANTRIWATI" } });
    const posCapCount = await prisma.positionCapability.count({ where: { capabilityCode: "health.case.read_detail" } });
    const asgCount = await prisma.assignment.count({ where: { position: { code: "PENGAWAS_SANTRIWATI" } } });

    assert.strictEqual(capCount, 0, "Capability must be rolled back");
    assert.strictEqual(posCount, 0, "Position must be rolled back");
    assert.strictEqual(posCapCount, 0, "PositionCapability must be 0");
    assert.strictEqual(asgCount, 0, "Assignment must be 0");
  });

  // =========================================================================
  // TEST 9: REPEATED EXECUTION AFTER SUCCESSFUL ACTIVATION -> FAIL CLOSED
  // =========================================================================
  it("9. Repeated execution after successful activation -> fail closed, no duplicate rows", async () => {
    // 1st Execution: Success
    const firstResult = await provisionDir2026016(prisma, {
      argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
      env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
    });
    assert.strictEqual(firstResult.createdRowsCount, 4);

    // 2nd Execution with same flags -> MUST THROW and fail closed
    await assert.rejects(
      () =>
        provisionDir2026016(prisma, {
          argv: ["node", "provision-dir-2026-016.ts", "--execute", "--owner-directive=DIR-2026-016"],
          env: { PRODUCTION_MUTATION_APPROVED: "DIR-2026-016" },
        }),
      /ABORT: Pre-write assertions failed/
    );

    // Verify row counts remain EXACTLY 1 for each entity (no duplicates)
    const capCount = await prisma.capability.count({ where: { code: "health.case.read_detail" } });
    const posCount = await prisma.position.count({ where: { code: "PENGAWAS_SANTRIWATI" } });
    const posCapCount = await prisma.positionCapability.count({ where: { capabilityCode: "health.case.read_detail" } });
    const asgCount = await prisma.assignment.count({ where: { position: { code: "PENGAWAS_SANTRIWATI" } } });

    assert.strictEqual(capCount, 1);
    assert.strictEqual(posCount, 1);
    assert.strictEqual(posCapCount, 1);
    assert.strictEqual(asgCount, 1);
  });
});
