(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PrismaClient,
  JenisIzin,
  StatusIzin,
  StatusSP,
  StatusKesehatan,
  JenisKelamin,
  CapabilityNamespace,
  ScopeType,
  BusinessRuleState,
  AssignmentStatus,
} from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { getBerandaOperationalSummaryAction } from "../app/actions/beranda";

describe("P0 Dashboard Data Honesty + Beranda Summary Remediation", () => {
  let prisma: PrismaClient;

  const STAFF_MUDIR = "stf-p0-mudir";
  const USER_MUDIR = "usr-p0-mudir";
  const USER_GA = "usr-p0-ga";
  const SANTRI_1 = "san-p0-01";
  const HALAQOH_1 = "hlq-p0-01";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staff
    await prisma.staff.create({
      data: {
        id: STAFF_MUDIR,
        staffCode: "STF-MUDIR-P0",
        nama: "KH. Mudir Utama",
        noHp: "08123456789",
        roleStaff: "KS",
        status: "AKTIF",
      },
    });

    // 2. Halaqoh
    await prisma.halaqoh.create({
      data: {
        id: HALAQOH_1,
        halaqohCode: "HLQ-P0-01",
        nama: "Halaqoh Utama",
        pembinaId: STAFF_MUDIR,
        tahunAjaran: "2025/2026",
      },
    });

    // 3. Santri
    await prisma.santri.create({
      data: {
        id: SANTRI_1,
        nis: "SAN-P0-01",
        nama: "Santri P0 Test",
        kelas: "7A",
        jenisKelamin: JenisKelamin.L,
        halaqohId: HALAQOH_1,
        namaWali: "Wali Santri P0",
        noHpWali: "08999999999",
      },
    });

    // 4. Users
    await prisma.user.createMany({
      data: [
        {
          id: USER_MUDIR,
          username: "p0.mudir",
          role: "KS",
          staffId: STAFF_MUDIR,
          passwordHash: "dummy",
        },
        {
          id: USER_GA,
          username: "p0.guru",
          role: "GA",
          passwordHash: "dummy",
        },
      ],
    });

    // 5. Canonical OrgUnit & Positions & PositionCapabilities for Mudir
    const orgUnit = await prisma.orgUnit.create({
      data: {
        id: "ou-p0-inst",
        code: "OU-INST-P0",
        name: "Pesantren STQ DUC",
        type: "INSTITUTION",
        domain: "INSTITUTIONAL",
        genderComplex: "PUTRA",
        isActive: true,
      },
    });

    const posMudir = await prisma.position.create({
      data: {
        id: "pos-p0-mudir",
        code: "MUDIR",
        name: "Mudir",
        domain: "INSTITUTIONAL",
        allowedUnitTypes: ["INSTITUTION"],
        isActive: true,
      },
    });

    await prisma.capability.upsert({
      where: { code: "keasramaan.permission.read" },
      update: {},
      create: {
        code: "keasramaan.permission.read",
        namespace: CapabilityNamespace.KEASRAMAAN,
        name: "Baca Data Perizinan",
        description: "Melihat data perizinan santri",
      },
    });

    await prisma.positionCapability.create({
      data: {
        positionId: posMudir.id,
        capabilityCode: "keasramaan.permission.read",
        scopeType: ScopeType.GLOBAL,
        businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
      },
    });

    await prisma.assignment.create({
      data: {
        id: "asg-p0-mudir",
        userId: USER_MUDIR,
        positionId: posMudir.id,
        unitId: orgUnit.id,
        status: AssignmentStatus.ACTIVE,
        createdById: USER_MUDIR,
      },
    });

    // 6. Test Operational Records
    await prisma.perizinanSantri.create({
      data: {
        kodeIzin: "IZN-P0-001",
        santriId: SANTRI_1,
        jenis: JenisIzin.PULANG,
        tanggalMulai: new Date(),
        tanggalSelesai: new Date(Date.now() + 86400000),
        alasan: "Keperluan keluarga penting",
        status: StatusIzin.MENUNGGU_KS,
      },
    });

    await prisma.suratPeringatan.create({
      data: {
        nomorSP: "SP-P0-001",
        santriId: SANTRI_1,
        tingkatSP: 1,
        totalPoinSaatTerbit: 25,
        status: StatusSP.AKTIF,
      },
    });

    await prisma.catatanKesehatan.create({
      data: {
        santriId: SANTRI_1,
        keluhan: "Demam dan flu",
        diagnosa: "ISPA",
        tindakan: "Istirahat di poskestren dan obat",
        status: StatusKesehatan.RAWAT_PONDOK,
        dicatatOleh: "p0.petugas",
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  describe("A. Static Overfetch Guard", () => {
    it("1. initApp in app/page.tsx does NOT eagerly invoke complete cross-domain datasets", () => {
      const pagePath = path.resolve(__dirname, "../app/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      const initAppMatch = content.match(/const initApp = async \(\) => \{([\s\S]*?)\};/);
      assert.ok(initAppMatch, "initApp function must exist in app/page.tsx");
      const initAppBody = initAppMatch[1];

      assert.ok(!initAppBody.includes("getDaftarKesehatanAction()"), "Must not eagerly invoke getDaftarKesehatanAction");
      assert.ok(!initAppBody.includes("getPerizinanListAction()"), "Must not eagerly invoke getPerizinanListAction");
      assert.ok(!initAppBody.includes("getPelanggaranListAction()"), "Must not eagerly invoke getPelanggaranListAction");
      assert.ok(!initAppBody.includes("getSPListAction()"), "Must not eagerly invoke getSPListAction");
    });

    it("2. app/page.tsx uses lightweight getBerandaOperationalSummaryAction instead", () => {
      const pagePath = path.resolve(__dirname, "../app/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("getBerandaOperationalSummaryAction"), "Must import & invoke getBerandaOperationalSummaryAction");
    });
  });

  describe("B. Not-Loaded != Error Semantics", () => {
    const berandaPath = path.resolve(__dirname, "../components/modules/beranda-module.tsx");
    const berandaContent = fs.readFileSync(berandaPath, "utf-8");

    it("1. Loading state presents neutral 'Memuat...' and NO false red error alerts", () => {
      // Must set neutral loading values
      assert.ok(berandaContent.includes('izinValue = "Memuat..."'), "Must set Memuat... for izin while loading");
      assert.ok(berandaContent.includes('attentionValue = "Memuat..."'), "Must set Memuat... for attention while loading");
      assert.ok(berandaContent.includes("Memuat status perizinan..."), "Task queue must display neutral loading message");
      assert.ok(berandaContent.includes('izinVariant = "neutral"'), "Must use neutral badge variant while loading");
      assert.ok(berandaContent.includes('attentionVariant = "neutral"'), "Must use neutral badge variant for attention while loading");
    });

    it("2. Authoritative empty state presents 0 counts with healthy badges, NOT errors", () => {
      // Must format count as Berkas / Kasus
      assert.ok(berandaContent.includes("`${count} Berkas`"), "Must format loaded count as Berkas");
      assert.ok(berandaContent.includes("`${totalKasus} Kasus`"), "Must format loaded attention count as Kasus");
      assert.ok(berandaContent.includes("Tidak ada permohonan izin santri yang tertunda"), "Task queue must show clean empty status");
    });
  });

  describe("C. ORR-008 Average Hafalan Data Honesty", () => {
    const berandaPath = path.resolve(__dirname, "../components/modules/beranda-module.tsx");
    const berandaContent = fs.readFileSync(berandaPath, "utf-8");

    it("1. When santriLoadError exists, Rata-rata Hafalan displays 'Data Tidak Tersedia' and NEVER fake '0 Juz'", () => {
      // StatCard Rata-rata Hafalan value must be guarded by santriLoadError
      const avgHafalanMatch = berandaContent.match(/<StatCard[\s\S]*?title="Rata-rata Hafalan"[\s\S]*?\r?\n\s*\/>/);
      assert.ok(avgHafalanMatch, "StatCard Rata-rata Hafalan must exist in beranda-module.tsx");
      const avgHafalanCard = avgHafalanMatch[0];

      assert.ok(
        avgHafalanCard.includes('value={santriLoadError ? "Data Tidak Tersedia" : `${avgCapaian} Juz`}'),
        "Rata-rata Hafalan value must fail-closed to 'Data Tidak Tersedia' on santriLoadError"
      );
      assert.ok(
        avgHafalanCard.includes('badgeVariant={santriLoadError ? "ditolak" : "gold"}'),
        "Rata-rata Hafalan badgeVariant must be 'ditolak' on santriLoadError"
      );
      assert.ok(
        !avgHafalanCard.includes('value={`${avgCapaian} Juz`}') &&
        !avgHafalanCard.includes('value="0 Juz"'),
        "Unconditional 0 Juz value is strictly forbidden"
      );
    });

    it("2. When santriList is empty without error, avgCapaian is 0, but with valid gold presentation", () => {
      assert.ok(berandaContent.includes('avgCapaian = totalSantri > 0'), "avgCapaian must compute from actual totalSantri");
    });
  });

  describe("D. Real Summary Endpoint Success for Authorized Mudir", () => {
    it("1. Mudir retrieves authoritative summary counts from production database", async () => {
      setTestSession({
        userId: USER_MUDIR,
        username: "p0.mudir",
        role: "KS",
        name: "KH. Mudir Utama",
      });

      const res = await getBerandaOperationalSummaryAction();
      assert.equal(res.success, true);
      assert.ok(res.data);

      // Izin pending (1 seeded record)
      assert.equal(res.data.izin.status, "AVAILABLE");
      assert.equal(res.data.izin.pendingCount, 1);

      // Active SP (1 seeded record)
      assert.equal(res.data.sp.status, "AVAILABLE");
      assert.equal(res.data.sp.activeCount, 1);

      // Active Health (1 seeded record)
      assert.equal(res.data.kesehatan.status, "AVAILABLE");
      assert.equal(res.data.kesehatan.activeCount, 1);
    });
  });

  describe("E. Real Summary Failure Handling", () => {
    const berandaPath = path.resolve(__dirname, "../components/modules/beranda-module.tsx");
    const berandaContent = fs.readFileSync(berandaPath, "utf-8");

    it("1. When summaryError is set, displays fail-closed error presentation", () => {
      assert.ok(berandaContent.includes('summaryError || izinLoadError'), "Must handle summaryError for izin");
      assert.ok(berandaContent.includes('summaryError || santriLoadError || spLoadError || kesehatanLoadError'), "Must handle summaryError for attention");
      assert.ok(berandaContent.includes('attentionValue = "Data Tidak Lengkap"'), "Must show Data Tidak Lengkap on error");
      assert.ok(berandaContent.includes('izinValue = "Data Tidak Tersedia"'), "Must show Data Tidak Tersedia on error");
    });
  });

  describe("F. Security Regression & Confidentiality", () => {
    it("1. GA (Guru Akademik) role receives UNAVAILABLE for health and SP, NEVER fake 0", async () => {
      setTestSession({
        userId: USER_GA,
        username: "p0.guru",
        role: "GA",
        name: "Guru Akademik P0",
      });

      const res = await getBerandaOperationalSummaryAction();
      assert.equal(res.success, true);
      assert.ok(res.data);

      // GA has no access to permissions, SP, or health
      assert.equal(res.data.izin.status, "UNAVAILABLE");
      assert.equal(res.data.izin.pendingCount, null);

      assert.equal(res.data.sp.status, "UNAVAILABLE");
      assert.equal(res.data.sp.activeCount, null);

      assert.equal(res.data.kesehatan.status, "UNAVAILABLE");
      assert.equal(res.data.kesehatan.activeCount, null);
    });

    it("2. Summary response returns zero PII (no names, phones, or medical descriptions)", async () => {
      setTestSession({
        userId: USER_MUDIR,
        username: "p0.mudir",
        role: "KS",
        name: "KH. Mudir Utama",
      });

      const res = await getBerandaOperationalSummaryAction();
      const stringified = JSON.stringify(res);

      assert.ok(!stringified.includes("08999999999"), "Guardian phone must not be exposed");
      assert.ok(!stringified.includes("Santri P0 Test"), "Santri name must not be exposed");
      assert.ok(!stringified.includes("Wali Santri P0"), "Wali name must not be exposed");
      assert.ok(!stringified.includes("ISPA"), "Medical diagnosis must not be exposed");
    });
  });
});
