(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, StatusIzin, Role } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { getPerizinanListAction } from "../app/actions/kesantrian";

describe("R2-BLOCKER-04 — OSDA Putri Read Path Actor Gender Boundary Enforcement", () => {
  let prisma: PrismaClient;

  const OU_KEASRAMAAN_PUTRA_ID = "ou-keasramaan-putra-id";
  const OU_KEASRAMAAN_PUTRI_ID = "ou-keasramaan-putri-id";

  const USER_OSDA_PUTRA_ID = "usr-osda-putra-test";
  const USER_OSDA_PUTRI_ID = "usr-osda-putri-test";

  const SANTRI_PUTRA_ID = "san-pzn-putra-01";
  const SANTRI_PUTRI_ID = "san-pzn-putri-01";

  const sessionOsdaPutra: UserSession = {
    userId: USER_OSDA_PUTRA_ID,
    username: "osda.putra",
    role: "OSDA" as Role,
    name: "OSDA Keamanan Putra",
  };

  const sessionOsdaPutri: UserSession = {
    userId: USER_OSDA_PUTRI_ID,
    username: "osda.putri",
    role: "OSDA" as Role,
    name: "OSDA Keamanan Putri",
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Create OrgUnits: PUTRA vs PUTRI
    await prisma.orgUnit.createMany({
      data: [
        {
          id: OU_KEASRAMAAN_PUTRA_ID,
          code: "OU-DIV-KEAMANAN-PUTRA",
          name: "Divisi Keamanan OSDA Putra",
          type: "DIVISION",
          domain: "KEASRAMAAN",
          genderComplex: "PUTRA",
          isActive: true,
        },
        {
          id: OU_KEASRAMAAN_PUTRI_ID,
          code: "OU-DIV-KEAMANAN-PUTRI",
          name: "Divisi Keamanan OSDA Putri",
          type: "DIVISION",
          domain: "KEASRAMAAN",
          genderComplex: "PUTRI",
          isActive: true,
        },
      ],
    });

    // 2. Create Users: PUTRA UNIT vs PUTRI UNIT
    await prisma.user.createMany({
      data: [
        {
          id: USER_OSDA_PUTRA_ID,
          username: "osda.putra",
          passwordHash: "hash-test",
          role: "OSDA",
          accountType: "UNIT",
          status: "AKTIF",
        },
        {
          id: USER_OSDA_PUTRI_ID,
          username: "osda.putri",
          passwordHash: "hash-test",
          role: "OSDA",
          accountType: "UNIT",
          status: "AKTIF",
        },
      ],
    });

    // 3. Create Unit Account Placements
    await prisma.unitAccountPlacement.createMany({
      data: [
        {
          id: "uap-osda-putra",
          userId: USER_OSDA_PUTRA_ID,
          unitId: OU_KEASRAMAAN_PUTRA_ID,
        },
        {
          id: "uap-osda-putri",
          userId: USER_OSDA_PUTRI_ID,
          unitId: OU_KEASRAMAAN_PUTRI_ID,
        },
      ],
    });

    // 4. Create Capability & Position
    await prisma.capability.upsert({
      where: { code: "keasramaan.permission.read" },
      update: {},
      create: {
        code: "keasramaan.permission.read",
        namespace: "KEASRAMAAN",
        name: "Read Keasramaan Permissions",
        description: "Read permission list",
      },
    });

    const pos = await prisma.position.upsert({
      where: { code: "PETUGAS_OPERASIONAL_KEASRAMAAN" },
      update: {},
      create: {
        id: "pos-keasramaan-operational-test",
        code: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        name: "Petugas Operasional Keasramaan",
        domain: "KEASRAMAAN",
        allowedUnitTypes: ["DIVISION", "ORGANIZATION"],
        isActive: true,
        requiresPersonalAccount: false,
      },
    });

    await prisma.positionCapability.upsert({
      where: {
        positionId_capabilityCode: {
          positionId: pos.id,
          capabilityCode: "keasramaan.permission.read",
        },
      },
      update: {
        businessRuleState: "VERIFIED_PRODUCTION",
      },
      create: {
        id: "pc-keasramaan-perm-read-test",
        positionId: pos.id,
        capabilityCode: "keasramaan.permission.read",
        scopeType: "DOMAIN",
        businessRuleState: "VERIFIED_PRODUCTION",
      },
    });

    // 5. Assignments for both UNIT accounts
    await prisma.assignment.createMany({
      data: [
        {
          id: "asg-osda-putra-test",
          userId: USER_OSDA_PUTRA_ID,
          positionId: pos.id,
          unitId: OU_KEASRAMAAN_PUTRA_ID,
          status: "ACTIVE",
          createdById: USER_OSDA_PUTRA_ID,
          validFrom: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: "asg-osda-putri-test",
          userId: USER_OSDA_PUTRI_ID,
          positionId: pos.id,
          unitId: OU_KEASRAMAAN_PUTRI_ID,
          status: "ACTIVE",
          createdById: USER_OSDA_PUTRI_ID,
          validFrom: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });

    // 6. Create Santri: 1 Putra, 1 Putri
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_PUTRA_ID,
          nis: "PZN-PUTRA-01",
          nama: "Santri Putra Keasramaan",
          kelas: "7A",
          jenisKelamin: "L",
          status: "AKTIF",
        },
        {
          id: SANTRI_PUTRI_ID,
          nis: "PZN-PUTRI-01",
          nama: "Santriwati Putri Keasramaan",
          kelas: "7B",
          jenisKelamin: "P",
          status: "AKTIF",
        },
      ],
    });

    // 7. Create PerizinanSantri: 1 for Putra, 1 for Putri
    await prisma.perizinanSantri.createMany({
      data: [
        {
          id: "pzn-row-putra",
          kodeIzin: "IZN-PUTRA-001",
          santriId: SANTRI_PUTRA_ID,
          jenis: "PULANG",
          alasan: "Keperluan keluarga",
          status: StatusIzin.DISETUJUI,
          diajukanOlehUserId: USER_OSDA_PUTRA_ID,
          tanggalMulai: new Date("2026-09-20T00:00:00Z"),
          tanggalSelesai: new Date("2026-09-22T00:00:00Z"),
        },
        {
          id: "pzn-row-putri",
          kodeIzin: "IZN-PUTRI-001",
          santriId: SANTRI_PUTRI_ID,
          jenis: "PULANG",
          alasan: "Keperluan keluarga",
          status: StatusIzin.DISETUJUI,
          diajukanOlehUserId: USER_OSDA_PUTRI_ID,
          tanggalMulai: new Date("2026-09-20T00:00:00Z"),
          tanggalSelesai: new Date("2026-09-22T00:00:00Z"),
        },
      ],
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. Hypothetical PUTRA UNIT holding keasramaan.permission.read is strictly DENIED access to PUTRI perizinan", async () => {
    setTestSession(sessionOsdaPutra);

    const res = await getPerizinanListAction();

    // Must be DENIED with zero data and GENDER_COMPLEX_DENIED error code
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "GENDER_COMPLEX_DENIED");
    assert.deepStrictEqual(res.data, []);
    assert.match(res.message, /GENDER_COMPLEX_DENIED|tidak berwenang mengakses data santriwati PUTRI/i);
  });

  it("2. Authoritative osda.putri PUTRI UNIT holding VERIFIED_PRODUCTION read is ALLOWED to read PUTRI records", async () => {
    setTestSession(sessionOsdaPutri);

    const res = await getPerizinanListAction();

    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 1);
    const item0 = res.data[0] as { kodeIzin: string; santri: { jenisKelamin: string } };
    assert.strictEqual(item0.kodeIzin, "IZN-PUTRI-001");
    assert.strictEqual(item0.santri.jenisKelamin, "P");
  });

  it("3. Zero PUTRA data leakage: all returned records strictly belong to female santri (jenisKelamin = 'P')", async () => {
    setTestSession(sessionOsdaPutri);

    const res = await getPerizinanListAction();

    assert.strictEqual(res.success, true);
    for (const record of res.data as Array<{ santri: { jenisKelamin: string }; santriId: string }>) {
      assert.strictEqual(record.santri.jenisKelamin, "P", "PUTRA records must never leak into OSDA Putri monitoring");
      assert.notStrictEqual(record.santriId, SANTRI_PUTRA_ID);
    }
  });

  it("4. Unplaced UNIT account or UNIT without canonical placement fails closed (GENDER_COMPLEX_DENIED)", async () => {
    const sessionUnplacedUnit: UserSession = {
      userId: "usr-unplaced-unit",
      username: "osda.unplaced",
      role: "OSDA" as Role,
      name: "Unplaced OSDA Unit",
    };

    // User in DB without placement
    await prisma.user.create({
      data: {
        id: sessionUnplacedUnit.userId,
        username: sessionUnplacedUnit.username,
        passwordHash: "hash-test",
        role: "OSDA",
        accountType: "UNIT",
        status: "AKTIF",
      },
    });

    setTestSession(sessionUnplacedUnit);
    const res = await getPerizinanListAction();

    assert.strictEqual(res.success, false);
    assert.deepStrictEqual(res.data, []);
  });
});
