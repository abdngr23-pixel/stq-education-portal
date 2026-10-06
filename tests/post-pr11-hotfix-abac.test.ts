(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { prosesRewardTasmiSimaanAction, updateKebijakanRewardSanksiAction } from "../app/actions/reward-sanksi";
import { getStatusKesehatanSemantics } from "../lib/kesehatan-status";

describe("POST-PR11 HOTFIX VERIFICATION SUITE", () => {
  let prisma: PrismaClient;
  let validTasmiId = "";

  before(async () => {
    prisma = await startTestDatabase();

    await prisma.orgUnit.createMany({
      data: [
        { id: "ou-pr11-hlq", code: "OU-HLQ-PR11", name: "Halaqoh PR11", type: "HALAQOH", domain: "TAHFIZH", genderComplex: "PUTRA", isActive: true },
      ],
      skipDuplicates: true,
    });

    const posMudir = await prisma.position.upsert({
      where: { code: "MUDIR" },
      update: {},
      create: { id: "pos-pr11-mudir", code: "MUDIR", name: "Mudir", domain: "INSTITUTIONAL" },
    });
    const posKabid = await prisma.position.upsert({
      where: { code: "KABID_TAHFIZH" },
      update: {},
      create: { id: "pos-pr11-kabid", code: "KABID_TAHFIZH", name: "Kepala Bidang Tahfizh", domain: "TAHFIZH" },
    });

    await prisma.capability.upsert({
      where: { code: "tahfizh.reward.issue" },
      update: {},
      create: { code: "tahfizh.reward.issue", name: "tahfizh.reward.issue", namespace: "TAHFIZH", description: "Reward Issue" },
    });
    await prisma.capability.upsert({
      where: { code: "tahfizh.policy.manage" },
      update: {},
      create: { code: "tahfizh.policy.manage", name: "tahfizh.policy.manage", namespace: "TAHFIZH", description: "Policy Manage" },
    });

    await prisma.positionCapability.upsert({
      where: { positionId_capabilityCode: { positionId: posMudir.id, capabilityCode: "tahfizh.reward.issue" } },
      update: { scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
      create: { positionId: posMudir.id, capabilityCode: "tahfizh.reward.issue", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
    });
    await prisma.positionCapability.upsert({
      where: { positionId_capabilityCode: { positionId: posMudir.id, capabilityCode: "tahfizh.policy.manage" } },
      update: { scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
      create: { positionId: posMudir.id, capabilityCode: "tahfizh.policy.manage", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION" },
    });
    await prisma.positionCapability.upsert({
      where: { positionId_capabilityCode: { positionId: posKabid.id, capabilityCode: "tahfizh.reward.issue" } },
      update: { scopeType: "DOMAIN", businessRuleState: "VERIFIED_PRODUCTION" },
      create: { positionId: posKabid.id, capabilityCode: "tahfizh.reward.issue", scopeType: "DOMAIN", businessRuleState: "VERIFIED_PRODUCTION" },
    });

    await prisma.staff.createMany({
      data: [
        { id: "stf-razan", staffCode: "STF-RZ", nama: "Ust. Razan", roleStaff: "MT", status: "AKTIF", noHp: "0811" },
        { id: "stf-mudir", staffCode: "STF-MD", nama: "K.H. Mudir", roleStaff: "KS", status: "AKTIF", noHp: "0812" },
      ],
      skipDuplicates: true,
    });

    await prisma.user.createMany({
      data: [
        { id: "usr-kabid-razan", username: "musyrif.tahfizh", role: "MT", staffId: "stf-razan", passwordHash: "dummy" },
        { id: "usr-mudir", username: "mudir", role: "KS", staffId: "stf-mudir", passwordHash: "dummy" },
      ],
      skipDuplicates: true,
    });

    await prisma.assignment.createMany({
      data: [
        { id: "asg-pr11-mudir", userId: "usr-mudir", positionId: posMudir.id, unitId: "ou-pr11-hlq", status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: "usr-mudir" },
        { id: "asg-pr11-kabid", userId: "usr-kabid-razan", positionId: posKabid.id, unitId: "ou-pr11-hlq", status: "ACTIVE", validFrom: new Date(Date.now() - 86400000), createdById: "usr-kabid-razan" },
      ],
      skipDuplicates: true,
    });

    const santri = await prisma.santri.create({
      data: {
        id: "san-pr11",
        nis: "PR11-001",
        nama: "Santri PR11",
        status: "AKTIF",
        jenisKelamin: "L",
        kelas: "7A",
      },
    });

    const tasmi = await prisma.tasmiSimaan.create({
      data: {
        id: "ts-pr11",
        santri: { connect: { id: santri.id } },
        musyrif: { connect: { id: "stf-razan" } },
        jenis: "TASMI",
        juz: 1,
        tanggal: new Date(),
        nilai: 90,
        predikat: "MUMTAZ",
      },
    });
    validTasmiId = tasmi.id;
  });

  after(async () => {
    setTestSession(null);
    await stopTestDatabase();
  });

  // =========================================================================
  // CASE F: Health Data Honesty — Eliminasi False "Sehat"
  // =========================================================================
  describe("CASE F: Health Data Honesty (Eliminasi False 'Sehat')", () => {
    it("1. SUCCESS + catatan sembuh => Sehat", () => {
      const res = getStatusKesehatanSemantics([{ id: "k1", keluhan: "Demam", status: "SEMBUH" }], null);
      assert.strictEqual(res.label, "Sehat");
      assert.strictEqual(res.isErrorOrEmpty, false);
    });

    it("2. SUCCESS + catatan medis aktif => Format status riil (Bukan 'Sehat')", () => {
      const resRawat = getStatusKesehatanSemantics([{ id: "k2", keluhan: "Flu", status: "RAWAT_PONDOK" }], null);
      assert.strictEqual(resRawat.label, "RAWAT PONDOK");
      assert.notStrictEqual(resRawat.label, "Sehat");

      const resRujuk = getStatusKesehatanSemantics([{ id: "k3", keluhan: "Luka", status: "DIRUJUK_PUSKESMAS" }], null);
      assert.strictEqual(resRujuk.label, "DIRUJUK PUSKESMAS");
    });

    it("3. SUCCESS + tidak ada catatan medis => 'Belum ada data kesehatan' (Bukan 'Sehat')", () => {
      const resEmpty = getStatusKesehatanSemantics([], null);
      assert.strictEqual(resEmpty.label, "Belum ada data kesehatan");
      assert.strictEqual(resEmpty.isErrorOrEmpty, true);
      assert.notStrictEqual(resEmpty.label, "Sehat");
    });

    it("4. FETCH ERROR / SERVER ERROR => 'Gagal memuat data kesehatan' (Bukan 'Sehat')", () => {
      const resErr = getStatusKesehatanSemantics(null, "Database connection timeout");
      assert.strictEqual(resErr.label, "Gagal memuat data kesehatan");
      assert.strictEqual(resErr.isErrorOrEmpty, true);
      assert.notStrictEqual(resErr.label, "Sehat");
    });

    it("5. AUTHORIZATION ERROR => 'Akses data kesehatan tidak tersedia' (Bukan 'Sehat')", () => {
      const resAuth = getStatusKesehatanSemantics(null, "Akses Ditolak: Otorisasi tidak memadai");
      assert.strictEqual(resAuth.label, "Akses data kesehatan tidak tersedia");
      assert.strictEqual(resAuth.isErrorOrEmpty, true);
      assert.notStrictEqual(resAuth.label, "Sehat");
    });

    it("6. UNDEFINED DATA / UNINITIALIZED => 'Data kesehatan tidak tersedia' (Bukan 'Sehat')", () => {
      const resUndef = getStatusKesehatanSemantics(undefined, null);
      assert.strictEqual(resUndef.label, "Data kesehatan tidak tersedia");
      assert.strictEqual(resUndef.isErrorOrEmpty, true);
      assert.notStrictEqual(resUndef.label, "Sehat");
    });

    it("7. Source audit: Tidak ada lagi fallback 'Sehat' pada portal-wali-module.tsx", () => {
      const fileContent = fs.readFileSync(
        path.resolve(process.cwd(), "components/modules/portal-wali-module.tsx"),
        "utf-8"
      );
      assert.ok(!fileContent.includes(': "Sehat"'), "Fallback ternary statis ': \"Sehat\"' dilarang ada di portal-wali-module");
    });
  });

  // =========================================================================
  // CASE A & C: Reward Issuer Authority (Mudir & Kabid Tahfizh ALLOW)
  // =========================================================================
  describe("CASE A & C: Otoritas Penerbitan Reward (Mudir & Kabid Tahfizh)", () => {
    it("Case A: Kabid Tahfizh (isKepalaBidangTahfidz = true) berwenang memproses reward", async () => {
      const kabidSession: UserSession = {
        userId: "usr-kabid-razan",
        username: "musyrif.tahfizh",
        name: "Ust. Razan Mufli, S.Pd",
        role: "MT",
        staffId: "stf-razan",
        isKepalaBidangTahfidz: true,
      };
      setTestSession(kabidSession);

      const res = await prosesRewardTasmiSimaanAction(validTasmiId);
      assert.notStrictEqual(res.message, "Akses Ditolak: Penerbitan reward Tasmi'/Sima'an hanya berwenang dilakukan oleh Mudir atau Kabid Tahfizh.");
      assert.ok(!res.message.includes("Akses Ditolak"), "Kabid Tahfizh must pass the authorization guard");
    });

    it("Case C: Mudir (role = KS) berwenang memproses reward", async () => {
      const mudirSession: UserSession = {
        userId: "usr-mudir",
        username: "mudir",
        name: "K.H. Mudir",
        role: "KS",
        staffId: "stf-mudir",
        isKepalaBidangTahfidz: false,
      };
      setTestSession(mudirSession);

      const res = await prosesRewardTasmiSimaanAction(validTasmiId);
      assert.notStrictEqual(res.message, "Akses Ditolak: Penerbitan reward Tasmi'/Sima'an hanya berwenang dilakukan oleh Mudir atau Kabid Tahfizh.");
      assert.ok(!res.message.includes("Akses Ditolak"), "Mudir must pass the authorization guard");
    });
  });

  // =========================================================================
  // CASE B & D: Reward Issuer Rejection (Ordinary MT & ADM/MK/PH DENY)
  // =========================================================================
  describe("CASE B & D: Penolakan Otoritas Penerbitan Reward Selain Mudir & Kabid", () => {
    it("Case B: Ordinary MT (isKepalaBidangTahfidz = false) DITOLAK memproses reward", async () => {
      const ordinaryMtSession: UserSession = {
        userId: "usr-lisa-mt",
        username: "lisa.mt",
        name: "Ustadzah Lisa",
        role: "MT",
        staffId: "stf-lisa",
        isKepalaBidangTahfidz: false,
      };
      setTestSession(ordinaryMtSession);

      const res = await prosesRewardTasmiSimaanAction("any-id");
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Mudir atau Kabid Tahfizh"), "Ordinary MT must be denied reward issuance");
    });

    it("Case D1: Admin (role = ADM) DITOLAK memproses reward", async () => {
      const admSession: UserSession = {
        userId: "usr-adm",
        username: "admin",
        name: "Admin TU",
        role: "ADM",
        staffId: "stf-adm",
      };
      setTestSession(admSession);

      const res = await prosesRewardTasmiSimaanAction("any-id");
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Mudir atau Kabid Tahfizh"), "ADM must be denied reward issuance");
    });

    it("Case D2: Musyrif Keasramaan (role = MK) DITOLAK memproses reward", async () => {
      const mkSession: UserSession = {
        userId: "usr-mk",
        username: "musyrif.asrama",
        name: "Ust. Mujaddid Zhohruddin",
        role: "MK",
        staffId: "stf-mk",
      };
      setTestSession(mkSession);

      const res = await prosesRewardTasmiSimaanAction("any-id");
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Mudir atau Kabid Tahfizh"), "MK must be denied reward issuance");
    });

    it("Case D3: Pembina Halaqoh (role = PH) DITOLAK memproses reward", async () => {
      const phSession: UserSession = {
        userId: "usr-ph",
        username: "kamal.ph",
        name: "Ust. Kamal",
        role: "PH",
        staffId: "stf-ph",
      };
      setTestSession(phSession);

      const res = await prosesRewardTasmiSimaanAction("any-id");
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Mudir atau Kabid Tahfizh"), "PH must be denied reward issuance");
    });
  });

  // =========================================================================
  // CASE B: Setoran Write Boundary Enforcement
  // =========================================================================
  describe("CASE B: Enclosure Setoran Write Boundary", () => {
    it("createSetoranAction tidak boleh mengizinkan bypass Kabid untuk cross-halaqoh setoran", () => {
      const tahfizhActionContent = fs.readFileSync(
        path.resolve(process.cwd(), "app/actions/tahfizh.ts"),
        "utf-8"
      );
      assert.ok(
        !tahfizhActionContent.includes("!isBinaan && !session.isKepalaBidangTahfidz"),
        "createSetoranAction must not bypass halaqoh check with !session.isKepalaBidangTahfidz"
      );
      assert.ok(
        tahfizhActionContent.includes("if (!isBinaan)"),
        "createSetoranAction must enforce strict halaqoh check if (!isBinaan)"
      );
    });

    it("tahfizh-module.tsx selector memfilter santriList berdasarkan halaqoh untuk MT/PH", () => {
      const tahfizhModuleContent = fs.readFileSync(
        path.resolve(process.cwd(), "components/modules/tahfizh-module.tsx"),
        "utf-8"
      );
      assert.ok(
        tahfizhModuleContent.includes("setoranSantriList"),
        "tahfizh-module must define setoranSantriList"
      );
      assert.ok(
        tahfizhModuleContent.includes("currentHalaqohName"),
        "setoranSantriList must filter using currentHalaqohName"
      );
    });
  });

  // =========================================================================
  // CASE E: MK Health Session & UI Integrity
  // =========================================================================
  describe("CASE E: MK Health Integrity", () => {
    it("lib/auth.ts resolveVerifiedSessionPayload menggunakan timeout aman (>= 8000ms) dengan cleanup", () => {
      const authContent = fs.readFileSync(
        path.resolve(process.cwd(), "lib/auth.ts"),
        "utf-8"
      );
      assert.ok(!authContent.includes("setTimeout(() => reject(new Error(\"DB_TIMEOUT\")), 2000)"), "Aggressive 2000ms timeout must be removed");
      assert.ok(authContent.includes("8000"), "Safe timeout must be configured");
      assert.ok(authContent.includes("clearTimeout"), "Timer must be cleaned up");
    });
  });

  // =========================================================================
  // POST-PR12: Kebijakan Policy Edit Authorization & Copy Clarity
  // =========================================================================
  describe("POST-PR12: Kebijakan Policy Edit Authorization & Copy Clarity", () => {
    it("updateKebijakanRewardSanksiAction HANYA dapat diakses oleh Mudir (KS)", async () => {
      // 1. Kabid Tahfizh (role = MT, isKepalaBidangTahfidz = true) DITOLAK mengedit kebijakan
      const kabidSession: UserSession = {
        userId: "usr-kabid",
        username: "musyrif.tahfizh",
        name: "Ust. Razan Mufli, S.Pd",
        role: "MT",
        staffId: "stf-razan",
        isKepalaBidangTahfidz: true,
      };
      setTestSession(kabidSession);
      const resKabid = await updateKebijakanRewardSanksiAction({
        minNilaiTasmi: 80,
        minNilaiSimaan: 85,
        bintangTasmi: 1,
        bintangSimaan: 2,
        hakLiburTasmiHari: 1,
        hakLiburSimaanHari: 2,
        minPersenTargetBulanan: 100,
        durasiKehilanganKunjunganHari: 30,
      });
      assert.strictEqual(resKabid.success, false);
      assert.ok(resKabid.message.includes("Hanya Mudir (KS)"), "Kabid must NOT have policy edit authority");

      // 2. Ordinary MT DITOLAK mengedit kebijakan
      const mtSession: UserSession = {
        userId: "usr-lisa",
        username: "lisa.mt",
        name: "Ustadzah Lisa Dwina Fitri",
        role: "MT",
        staffId: "stf-lisa",
        isKepalaBidangTahfidz: false,
      };
      setTestSession(mtSession);
      const resMT = await updateKebijakanRewardSanksiAction({
        minNilaiTasmi: 80,
        minNilaiSimaan: 85,
        bintangTasmi: 1,
        bintangSimaan: 2,
        hakLiburTasmiHari: 1,
        hakLiburSimaanHari: 2,
        minPersenTargetBulanan: 100,
        durasiKehilanganKunjunganHari: 30,
      });
      assert.strictEqual(resMT.success, false);
      assert.ok(resMT.message.includes("Hanya Mudir (KS)"), "Ordinary MT must NOT have policy edit authority");
    });

    it("Copy clarity: ambiguous 'Read-Only (Hanya Mudir)' copy is removed and replaced", () => {
      const rewardTabContent = fs.readFileSync(
        path.resolve(process.cwd(), "components/dashboard/reward-evaluasi-tab.tsx"),
        "utf-8"
      );
      assert.ok(
        !rewardTabContent.includes("Read-Only (Hanya Mudir)"),
        "Ambiguous copy 'Read-Only (Hanya Mudir)' must be completely eliminated"
      );
      assert.ok(
        rewardTabContent.includes("Kebijakan hanya dapat diedit oleh Mudir"),
        "Clear unambiguous copy 'Kebijakan hanya dapat diedit oleh Mudir' must be present"
      );
    });
  });
});
