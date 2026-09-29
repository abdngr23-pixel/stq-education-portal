(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import {
  resolveCanonicalOrgUnitForHalaqoh,
  resolveHalaqohForCanonicalOrgUnit,
  mapOrgUnitIdsToHalaqohIds,
  mapHalaqohIdsToOrgUnitIds,
  HalaqohMappingError,
} from "../lib/server/halaqoh-canonical-mapping";
import {
  authorizeCanonical,
  createPrismaDataProvider,
} from "../lib/auth/canonical-evaluator";

describe("R2-BLOCKER-03 — Authoritative Halaqoh ID Namespace & Canonical Mapping Bridge", () => {
  let prisma: PrismaClient;

  // DISTINCT test IDs to prove we never assume Halaqoh.id === OrgUnit.id
  const HALAQOH_1_ID = "halaqoh-db-id-1";
  const HALAQOH_1_CODE = "HLQ-0001";
  const ORG_UNIT_1_ID = "orgunit-db-id-99";
  const ORG_UNIT_1_CODE = "OU-HLQ-0001";

  const HALAQOH_2_ID = "halaqoh-db-id-2";
  const HALAQOH_2_CODE = "HLQ-0002";
  const ORG_UNIT_2_ID = "orgunit-db-id-100";
  const ORG_UNIT_2_CODE = "OU-HLQ-0002";

  const INACTIVE_HALAQOH_ID = "halaqoh-db-id-inactive";
  const INACTIVE_HALAQOH_CODE = "HLQ-INACT-01";
  const INACTIVE_ORG_UNIT_ID = "orgunit-db-id-inact";
  const INACTIVE_ORG_UNIT_CODE = "OU-HLQ-INACT-01";

  const STAFF_ID = "stf-bridge-01";
  const USER_ID = "usr-bridge-musyrif-1";
  const SANTRI_1_ID = "san-bridge-01";
  const SANTRI_2_ID = "san-bridge-02";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staff
    await prisma.staff.create({
      data: {
        id: STAFF_ID,
        staffCode: "STF-BR-01",
        nama: "Ust. Musyrif Bridge",
        roleStaff: "MT",
        status: "AKTIF",
        noHp: "08999",
      },
    });

    // 2. Halaqoh with distinct IDs
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_1_ID,
          halaqohCode: HALAQOH_1_CODE,
          nama: "Halaqoh Bridge 1",
          pembinaId: STAFF_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_2_ID,
          halaqohCode: HALAQOH_2_CODE,
          nama: "Halaqoh Bridge 2",
          pembinaId: STAFF_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: INACTIVE_HALAQOH_ID,
          halaqohCode: INACTIVE_HALAQOH_CODE,
          nama: "Halaqoh Inactive",
          pembinaId: STAFF_ID,
          tahunAjaran: "2026/2027",
          status: "NONAKTIF",
        },
      ],
    });

    // 3. OrgUnits with DISTINCT IDs and "OU-" + code
    await prisma.orgUnit.createMany({
      data: [
        {
          id: ORG_UNIT_1_ID,
          code: ORG_UNIT_1_CODE,
          name: "OrgUnit Halaqoh 1",
          type: "HALAQOH",
          domain: "TAHFIZH",
          genderComplex: "PUTRA",
          isActive: true,
        },
        {
          id: ORG_UNIT_2_ID,
          code: ORG_UNIT_2_CODE,
          name: "OrgUnit Halaqoh 2",
          type: "HALAQOH",
          domain: "TAHFIZH",
          genderComplex: "PUTRA",
          isActive: true,
        },
        {
          id: INACTIVE_ORG_UNIT_ID,
          code: INACTIVE_ORG_UNIT_CODE,
          name: "OrgUnit Inactive",
          type: "HALAQOH",
          domain: "TAHFIZH",
          genderComplex: "PUTRA",
          isActive: false, // Inactive
        },
      ],
    });

    // 4. Santri referencing Halaqoh.id
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_1_ID,
          nis: "BR-001",
          nama: "Santri In Halaqoh 1",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_1_ID, // References Halaqoh.id "halaqoh-db-id-1"
          status: "AKTIF",
        },
        {
          id: SANTRI_2_ID,
          nis: "BR-002",
          nama: "Santri In Halaqoh 2",
          kelas: "7B",
          jenisKelamin: "L", // PUTRA
          halaqohId: HALAQOH_2_ID, // References Halaqoh.id "halaqoh-db-id-2"
          status: "AKTIF",
        },
      ],
    });

    // 5. User
    await prisma.user.create({
      data: {
        id: USER_ID,
        username: "bridge.musyrif",
        passwordHash: "hash",
        role: "MT",
        status: "AKTIF",
        staffId: STAFF_ID,
      },
    });

    // 6. Canonical Position & PositionCapability
    await prisma.capability.upsert({
      where: { code: "tahfizh.recap.read" },
      update: {},
      create: {
        code: "tahfizh.recap.read",
        namespace: "TAHFIZH",
        name: "Recap Read",
        description: "Recap Read",
      },
    });

    const pos = await prisma.position.upsert({
      where: { code: "MUSYRIF_TAHFIZH" },
      update: {},
      create: {
        id: "pos-bridge-musyrif",
        code: "MUSYRIF_TAHFIZH",
        name: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        allowedUnitTypes: ["HALAQOH"],
        isActive: true,
      },
    });

    await prisma.positionCapability.upsert({
      where: {
        positionId_capabilityCode: {
          positionId: pos.id,
          capabilityCode: "tahfizh.recap.read",
        },
      },
      update: {
        businessRuleState: "VERIFIED_PRODUCTION",
      },
      create: {
        id: "cap-bridge-musyrif-recap",
        positionId: pos.id,
        capabilityCode: "tahfizh.recap.read",
        scopeType: "HALAQOH",
        businessRuleState: "VERIFIED_PRODUCTION",
      },
    });

    // 7. Assignment anchored to OrgUnit.id = "orgunit-db-id-99" (NOT halaqoh-db-id-1)
    await prisma.assignment.create({
      data: {
        id: "asg-bridge-musyrif-1",
        userId: USER_ID,
        positionId: pos.id,
        unitId: ORG_UNIT_1_ID, // Anchored to OrgUnit.id "orgunit-db-id-99"
        status: "ACTIVE",
        createdById: USER_ID,
        validFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. resolveCanonicalOrgUnitForHalaqoh maps distinct Halaqoh.id to canonical OrgUnit.id", async () => {
    const mapping = await resolveCanonicalOrgUnitForHalaqoh(HALAQOH_1_ID, prisma);
    assert.ok(mapping);
    assert.strictEqual(mapping.halaqohId, HALAQOH_1_ID);
    assert.strictEqual(mapping.halaqohCode, HALAQOH_1_CODE);
    assert.strictEqual(mapping.orgUnitId, ORG_UNIT_1_ID);
    assert.strictEqual(mapping.orgUnitCode, ORG_UNIT_1_CODE);
    assert.strictEqual(mapping.genderComplex, "PUTRA");
  });

  it("2. resolveHalaqohForCanonicalOrgUnit maps canonical OrgUnit.id to distinct Halaqoh.id", async () => {
    const mapping = await resolveHalaqohForCanonicalOrgUnit(ORG_UNIT_1_ID, prisma);
    assert.ok(mapping);
    assert.strictEqual(mapping.halaqohId, HALAQOH_1_ID);
    assert.strictEqual(mapping.orgUnitId, ORG_UNIT_1_ID);
  });

  it("3. createPrismaDataProvider.resolveResourceContext translates Santri.halaqohId to canonical OrgUnit.id", async () => {
    const provider = createPrismaDataProvider(prisma);
    const resolved = await provider.resolveResourceContext({ santriId: SANTRI_1_ID }, USER_ID);

    assert.ok(resolved);
    assert.strictEqual(resolved.santriId, SANTRI_1_ID);
    // Crucial: context.halaqohId MUST be canonical OrgUnit.id, NOT Halaqoh.id
    assert.strictEqual(resolved.halaqohId, ORG_UNIT_1_ID);
    assert.ok(resolved.orgUnitIds.includes(ORG_UNIT_1_ID));
    assert.strictEqual(resolved.genderComplex, "PUTRA");
  });

  it("4. Scope evaluator HALAQOH matches through bridge mapping with distinct IDs", async () => {
    const provider = createPrismaDataProvider(prisma);

    // Musyrif has grant for OrgUnit.id = "orgunit-db-id-99".
    // Target Santri has halaqohId = "halaqoh-db-id-1".
    // Evaluator must ALLOW because mapping bridges halaqoh-db-id-1 -> orgunit-db-id-99.
    const allowRes = await authorizeCanonical({
      identity: { userId: USER_ID },
      capability: "tahfizh.recap.read",
      resourceContext: { santriId: SANTRI_1_ID },
      dataProvider: provider,
    });

    assert.strictEqual(allowRes.decision, "ALLOW");
    assert.strictEqual(allowRes.code, "ALLOWED");
  });

  it("5. Cross-halaqoh access fails closed with SCOPE_MISMATCH", async () => {
    const provider = createPrismaDataProvider(prisma);

    // Target Santri in Halaqoh 2 ("halaqoh-db-id-2" -> "orgunit-db-id-100")
    // Musyrif ONLY has grant for OrgUnit 1 ("orgunit-db-id-99")
    const denyRes = await authorizeCanonical({
      identity: { userId: USER_ID },
      capability: "tahfizh.recap.read",
      resourceContext: { santriId: SANTRI_2_ID },
      dataProvider: provider,
    });

    assert.strictEqual(denyRes.decision, "DENY");
    assert.strictEqual(denyRes.code, "SCOPE_MISMATCH");
  });

  it("6. mapOrgUnitIdsToHalaqohIds translates canonical OrgUnit scopes back to authoritative Halaqoh IDs", async () => {
    const halaqohIds = await mapOrgUnitIdsToHalaqohIds([ORG_UNIT_1_ID, ORG_UNIT_2_ID], prisma);
    assert.deepStrictEqual(halaqohIds, [HALAQOH_1_ID, HALAQOH_2_ID]);
  });

  it("7. mapHalaqohIdsToOrgUnitIds translates Halaqoh IDs to canonical OrgUnit IDs", async () => {
    const orgUnitIds = await mapHalaqohIdsToOrgUnitIds([HALAQOH_1_ID, HALAQOH_2_ID], prisma);
    assert.deepStrictEqual(orgUnitIds, [ORG_UNIT_1_ID, ORG_UNIT_2_ID]);
  });

  it("8. Missing mapping fails closed (returns null / empty)", async () => {
    const nonexistent = await resolveCanonicalOrgUnitForHalaqoh("nonexistent-halaqoh-id", prisma);
    assert.strictEqual(nonexistent, null);

    const nonexistentReverse = await resolveHalaqohForCanonicalOrgUnit("nonexistent-orgunit-id", prisma);
    assert.strictEqual(nonexistentReverse, null);

    const emptyHalaqohs = await mapOrgUnitIdsToHalaqohIds(["nonexistent-ou"], prisma);
    assert.deepStrictEqual(emptyHalaqohs, []);
  });

  it("9. Inactive source Halaqoh fails closed", async () => {
    const inactiveHalaqoh = await resolveCanonicalOrgUnitForHalaqoh(INACTIVE_HALAQOH_ID, prisma);
    assert.strictEqual(inactiveHalaqoh, null, "Inactive halaqoh source must fail closed");
  });

  it("10. Inactive canonical OrgUnit fails closed", async () => {
    const inactiveOrgUnit = await resolveHalaqohForCanonicalOrgUnit(INACTIVE_ORG_UNIT_ID, prisma);
    assert.strictEqual(inactiveOrgUnit, null, "Inactive OrgUnit must fail closed");
  });

  it("11. Ambiguous / duplicate mapping source throws HalaqohMappingError", async () => {
    const mockAmbiguousDb = {
      halaqoh: {
        findMany: () => Promise.resolve([
          { id: "h1", halaqohCode: "HLQ-DUP", nama: "H1", status: "AKTIF" },
          { id: "h2", halaqohCode: "HLQ-DUP", nama: "H2", status: "AKTIF" },
        ]),
      },
      orgUnit: {
        findMany: () => Promise.resolve([]),
      },
    } as unknown as PrismaClient;

    await assert.rejects(
      async () => {
        await resolveCanonicalOrgUnitForHalaqoh("HLQ-DUP", mockAmbiguousDb);
      },
      (err: unknown) => {
        assert.ok(err instanceof HalaqohMappingError);
        assert.strictEqual(err.code, "AMBIGUOUS_HALAQOH_SOURCE");
        return true;
      }
    );
  });

  it("12. Database query failure throws HalaqohMappingError (DATABASE_ERROR) instead of returning empty", async () => {
    const brokenDb = {
      halaqoh: {
        findMany: () => Promise.reject(new Error("FATAL_POSTGRES_DISCONNECTED")),
      },
      orgUnit: {
        findMany: () => Promise.reject(new Error("FATAL_POSTGRES_DISCONNECTED")),
      },
    } as unknown as PrismaClient;

    await assert.rejects(
      async () => {
        await resolveCanonicalOrgUnitForHalaqoh(HALAQOH_1_ID, brokenDb);
      },
      (err: unknown) => {
        assert.ok(err instanceof HalaqohMappingError);
        assert.strictEqual(err.code, "DATABASE_ERROR");
        return true;
      }
    );
  });
});
