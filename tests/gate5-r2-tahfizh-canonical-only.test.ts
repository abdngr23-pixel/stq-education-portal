(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { getTahfizhOperationalMonitoring } from "../lib/server/tahfizh-monitoring-service";
import { getSantriListForSession } from "../lib/server/santri-list-service";
import {
  getLaporanBulananHalaqohAction,
  upsertTargetSantriAction,
} from "../app/actions/laporan-bulanan";
import { assignCanonicalMusyrif } from "./helpers/canonical-test-seed";

describe("R2-BLOCKER-01 — Elimination of Legacy Tahfizh Authorization Fallback", () => {
  let prisma: PrismaClient;

  const HALAQOH_1_ID = "hlq-r2-01";
  const HALAQOH_2_ID = "hlq-r2-02";

  const SANTRI_1_ID = "san-r2-01";
  const SANTRI_2_ID = "san-r2-02";

  const STAFF_MT1_ID = "stf-r2-mt1";
  const STAFF_MT2_ID = "stf-r2-mt2";
  const STAFF_KS_ID = "stf-r2-ks";
  const STAFF_ADM_ID = "stf-r2-adm";
  const STAFF_YAY_ID = "stf-r2-yay";

  const sessionMT1: UserSession = {
    userId: "usr-r2-mt1",
    username: "musyrif.r2.1",
    role: "MT",
    name: "Ust. Musyrif R2-1",
    staffId: STAFF_MT1_ID,
  };

  const sessionMT2: UserSession = {
    userId: "usr-r2-mt2",
    username: "musyrif.r2.2",
    role: "MT",
    name: "Ust. Musyrif R2-2",
    staffId: STAFF_MT2_ID,
  };

  const sessionLegacyKS: UserSession = {
    userId: "usr-r2-ks-legacy",
    username: "ks.legacy",
    role: "KS",
    name: "Kepala Sekolah Legacy",
    staffId: STAFF_KS_ID,
  };

  const sessionLegacyADM: UserSession = {
    userId: "usr-r2-adm-legacy",
    username: "adm.legacy",
    role: "ADM",
    name: "Admin Legacy",
    staffId: STAFF_ADM_ID,
  };

  const sessionLegacyYAY: UserSession = {
    userId: "usr-r2-yay-legacy",
    username: "yay.legacy",
    role: "YAY",
    name: "Yayasan Legacy",
    staffId: STAFF_YAY_ID,
  };

  const sessionPendingCapUser: UserSession = {
    userId: "usr-r2-pending-cap",
    username: "user.pending.cap",
    role: "MT",
    name: "Ust. Pending Capability",
    staffId: "stf-r2-pending",
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Staff
    await prisma.staff.createMany({
      data: [
        { id: STAFF_MT1_ID, staffCode: "STF-R2-01", nama: "Ust. MT 1", roleStaff: "MT", status: "AKTIF", noHp: "08111" },
        { id: STAFF_MT2_ID, staffCode: "STF-R2-02", nama: "Ust. MT 2", roleStaff: "MT", status: "AKTIF", noHp: "08222" },
        { id: STAFF_KS_ID, staffCode: "STF-R2-KS", nama: "KS Legacy", roleStaff: "KS", status: "AKTIF", noHp: "08333" },
        { id: STAFF_ADM_ID, staffCode: "STF-R2-ADM", nama: "ADM Legacy", roleStaff: "ADM", status: "AKTIF", noHp: "08444" },
        { id: STAFF_YAY_ID, staffCode: "STF-R2-YAY", nama: "YAY Legacy", roleStaff: "YAY", status: "AKTIF", noHp: "08555" },
        { id: "stf-r2-pending", staffCode: "STF-R2-PEND", nama: "Pending Staff", roleStaff: "MT", status: "AKTIF", noHp: "08666" },
      ],
    });

    // 2. Seed Halaqoh
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_1_ID,
          halaqohCode: "HLQ-R2-01",
          nama: "Halaqoh R2 Abu Bakar",
          pembinaId: STAFF_MT1_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_2_ID,
          halaqohCode: "HLQ-R2-02",
          nama: "Halaqoh R2 Umar",
          // MT 1 is legacy pembina on Halaqoh 2 as well to test scope mismatch!
          pembinaId: STAFF_MT1_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
      ],
    });

    // 3. Seed Santri
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_1_ID,
          nis: "R2-001",
          nama: "Santri R2 Satu",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_1_ID,
          status: "AKTIF",
          modalHafalanAwalHalaman: 20,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00Z"),
        },
        {
          id: SANTRI_2_ID,
          nis: "R2-002",
          nama: "Santri R2 Dua",
          kelas: "7B",
          jenisKelamin: "L",
          halaqohId: HALAQOH_2_ID,
          status: "AKTIF",
          modalHafalanAwalHalaman: 40,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00Z"),
        },
      ],
    });

    // 4. Seed Users
    await prisma.user.createMany({
      data: [
        { id: sessionMT1.userId, username: sessionMT1.username, passwordHash: "hash", role: "MT", status: "AKTIF", staffId: STAFF_MT1_ID },
        { id: sessionMT2.userId, username: sessionMT2.username, passwordHash: "hash", role: "MT", status: "AKTIF", staffId: STAFF_MT2_ID },
        { id: sessionLegacyKS.userId, username: sessionLegacyKS.username, passwordHash: "hash", role: "KS", status: "AKTIF", staffId: STAFF_KS_ID },
        { id: sessionLegacyADM.userId, username: sessionLegacyADM.username, passwordHash: "hash", role: "ADM", status: "AKTIF", staffId: STAFF_ADM_ID },
        { id: sessionLegacyYAY.userId, username: sessionLegacyYAY.username, passwordHash: "hash", role: "YAY", status: "AKTIF", staffId: STAFF_YAY_ID },
        { id: sessionPendingCapUser.userId, username: sessionPendingCapUser.username, passwordHash: "hash", role: "MT", status: "AKTIF", staffId: "stf-r2-pending" },
      ],
    });

    // 5. Seed Canonical Architecture Lock Fixtures
    // MT 1 has canonical assignment strictly to HLQ-R2-01
    await assignCanonicalMusyrif(prisma, {
      userId: sessionMT1.userId,
      halaqohCode: "HLQ-R2-01",
    });

    // MT 2 has canonical assignment strictly to HLQ-R2-02
    await assignCanonicalMusyrif(prisma, {
      userId: sessionMT2.userId,
      halaqohCode: "HLQ-R2-02",
    });

    // Position with APPROVED_TARGET_PENDING_TECHNICAL for sessionPendingCapUser
    const posPending = await prisma.position.create({
      data: {
        id: "pos-r2-pending",
        code: "PENDING_TAHFIZH_OPERATOR",
        name: "Pending Tahfizh Operator",
        domain: "TAHFIZH",
        allowedUnitTypes: ["HALAQOH"],
        isActive: true,
      },
    });

    await prisma.positionCapability.createMany({
      data: [
        {
          id: "cap-r2-pending-recap",
          positionId: posPending.id,
          capabilityCode: "tahfizh.recap.read",
          scopeType: "HALAQOH",
          businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        },
        {
          id: "cap-r2-pending-target",
          positionId: posPending.id,
          capabilityCode: "tahfizh.target.manage",
          scopeType: "HALAQOH",
          businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        },
      ],
    });

    const ouHalaqoh1 = await prisma.orgUnit.findUnique({ where: { code: "OU-HLQ-R2-01" } });
    assert.ok(ouHalaqoh1);

    await prisma.assignment.create({
      data: {
        id: "asg-r2-pending",
        userId: sessionPendingCapUser.userId,
        positionId: posPending.id,
        unitId: ouHalaqoh1.id,
        status: "ACTIVE",
        createdById: sessionPendingCapUser.userId,
        validFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. pending PositionCapability cannot access recap through endpoint", async () => {
    // A. Operational monitoring service fails closed
    const resMonitoring = await getTahfizhOperationalMonitoring(
      { halaqohId: HALAQOH_1_ID },
      sessionPendingCapUser,
      prisma
    );
    assert.strictEqual(resMonitoring.success, false);
    assert.match(resMonitoring.message || "", /APPROVED_TARGET_PENDING_TECHNICAL|Akses Ditolak/i);

    // B. Laporan bulanan server action fails closed
    setTestSession(sessionPendingCapUser);
    const resLaporan = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "2026/2027");
    assert.strictEqual(resLaporan.success, false);
    assert.match(resLaporan.message || "", /APPROVED_TARGET_PENDING_TECHNICAL|Akses Ditolak/i);
  });

  it("2. missing canonical assignment cannot access recap despite legacy MT/KS/ADM/YAY role", async () => {
    const legacySessions = [sessionLegacyKS, sessionLegacyADM, sessionLegacyYAY];

    for (const s of legacySessions) {
      // getTahfizhOperationalMonitoring
      const monRes = await getTahfizhOperationalMonitoring({}, s, prisma);
      assert.strictEqual(monRes.success, false, `Role ${s.role} must not access monitoring without canonical assignment`);
      assert.match(monRes.message || "", /Akses Ditolak/i);

      // getLaporanBulananHalaqohAction
      setTestSession(s);
      const lapRes = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "2026/2027");
      assert.strictEqual(lapRes.success, false, `Role ${s.role} must not access recap without canonical assignment`);
      assert.match(lapRes.message || "", /Akses Ditolak/i);

      // getSantriListForSession
      const santriRes = await getSantriListForSession(undefined, s, prisma);
      assert.strictEqual(santriRes.success, false, `Role ${s.role} must not access santri list without canonical assignment`);
      assert.match(santriRes.message || "", /Akses Ditolak/i);
    }
  });

  it("3. pending PositionCapability cannot mutate target through upsertTargetSantriAction", async () => {
    setTestSession(sessionPendingCapUser);

    const upsertRes = await upsertTargetSantriAction({
      santriId: SANTRI_1_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });

    assert.strictEqual(upsertRes.success, false);
    assert.match(upsertRes.message || "", /APPROVED_TARGET_PENDING_TECHNICAL|Akses Ditolak/i);
  });

  it("4. canonical scope mismatch cannot fall back to legacy relation", async () => {
    // MT 1 has canonical assignment ONLY to HLQ-R2-01.
    // In legacy Halaqoh table, Halaqoh 2 has pembinaId = MT 1!
    // Without canonical fallback, MT 1 MUST NOT be able to access Halaqoh 2.
    setTestSession(sessionMT1);

    const monCrossRes = await getTahfizhOperationalMonitoring(
      { halaqohId: HALAQOH_2_ID },
      sessionMT1,
      prisma
    );
    assert.strictEqual(monCrossRes.success, false);
    assert.match(monCrossRes.message || "", /Akses Ditolak|tidak memiliki akses ke halaqoh ini/i);

    const lapCrossRes = await getLaporanBulananHalaqohAction(HALAQOH_2_ID, 9, "2026/2027");
    assert.strictEqual(lapCrossRes.success, false);
    assert.match(lapCrossRes.message || "", /Akses Ditolak|tidak memiliki akses ke halaqoh ini/i);

    // Also mutating target for santri in Halaqoh 2 must fail closed
    const upsertCrossRes = await upsertTargetSantriAction({
      santriId: SANTRI_2_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.strictEqual(upsertCrossRes.success, false);
    assert.match(upsertCrossRes.message || "", /Akses Ditolak|tidak memiliki wewenang/i);
  });

  it("5. database/canonical evaluator failure fails closed", async () => {
    // Pass mock broken db that throws on query
    const brokenDb = {
      user: {
        findUnique: () => Promise.reject(new Error("DB_FATAL_CONN_DROPPED")),
      },
      assignment: {
        findMany: () => Promise.reject(new Error("DB_FATAL_CONN_DROPPED")),
      },
    } as unknown as PrismaClient;

    const res = await getTahfizhOperationalMonitoring({}, sessionMT1, brokenDb);
    assert.strictEqual(res.success, false);
    assert.match(res.message || "", /Akses Ditolak/i);
    assert.match(res.error || "", /SYSTEM_FAIL_CLOSED|FORBIDDEN/);
  });

  it("6. VERIFIED_PRODUCTION grant with valid scope succeeds", async () => {
    setTestSession(sessionMT1);

    // A. Operational monitoring in assigned halaqoh
    const monRes = await getTahfizhOperationalMonitoring(
      { halaqohId: HALAQOH_1_ID },
      sessionMT1,
      prisma
    );
    assert.strictEqual(monRes.success, true);
    assert.ok(monRes.data);

    // B. Laporan bulanan in assigned halaqoh
    const lapRes = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "2026/2027");
    assert.strictEqual(lapRes.success, true);
    assert.ok(lapRes.data);

    // C. Target mutation in assigned halaqoh
    const upsertRes = await upsertTargetSantriAction({
      santriId: SANTRI_1_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.strictEqual(upsertRes.success, true);

    // D. Santri list in assigned halaqoh
    const santriRes = await getSantriListForSession(
      { halaqohId: HALAQOH_1_ID },
      sessionMT1,
      prisma
    );
    assert.strictEqual(santriRes.success, true);
    assert.strictEqual(santriRes.data.length, 1);
    assert.strictEqual(santriRes.data[0].id, SANTRI_1_ID);
  });
});
