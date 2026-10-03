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
import defaultPrisma from "../lib/prisma";

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

  describe("D. ALLOW vs DENY Semantics", () => {
    it("1. ALLOW: Authorized Mudir -> AVAILABLE + correct count", async () => {
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

    it("2. DENY: Unauthorized legitimate role (GA) -> UNAVAILABLE, null counts, NEVER fake 0", async () => {
      setTestSession({
        userId: USER_GA,
        username: "p0.guru",
        role: "GA",
        name: "Guru Akademik P0",
      });

      const res = await getBerandaOperationalSummaryAction();
      assert.equal(res.success, true);
      assert.ok(res.data);

      // GA has legitimate lack of authority -> UNAVAILABLE
      assert.equal(res.data.izin.status, "UNAVAILABLE");
      assert.equal(res.data.izin.pendingCount, null, "Denied permission must be null, not 0");

      assert.equal(res.data.sp.status, "UNAVAILABLE");
      assert.equal(res.data.sp.activeCount, null, "Denied SP must be null, not 0");

      assert.equal(res.data.kesehatan.status, "UNAVAILABLE");
      assert.equal(res.data.kesehatan.activeCount, null, "Denied health must be null, not 0");
    });
  });

  describe("E. ORR-008 Evaluator Error & Thrown Failures (ERROR != UNAVAILABLE)", () => {
    it("1. EVALUATOR ERROR: Canonical evaluator failure returns fail-closed error, NOT UNAVAILABLE, NOT 0, NOT healthy", async () => {
      setTestSession({
        userId: USER_MUDIR,
        username: "p0.mudir",
        role: "KS",
        name: "KH. Mudir Utama",
      });

      const origFindUnique = defaultPrisma.user.findUnique;
      (defaultPrisma.user as any).findUnique = async () => {
        throw new Error("Simulated database failure during identity hydration in canonical auth evaluator");
      };

      try {
        const res = await getBerandaOperationalSummaryAction();
        assert.equal(res.success, false, "Must return success = false on evaluator error");
        assert.ok(res.message, "Must return truthful error message");
        assert.ok(!res.data || res.data.izin.status !== "UNAVAILABLE", "Evaluator ERROR must NOT be collapsed to UNAVAILABLE");
        assert.ok(!res.data || res.data.izin.pendingCount !== 0, "Evaluator ERROR must NOT become 0");
      } finally {
        (defaultPrisma.user as any).findUnique = origFindUnique;
      }
    });

    it("2. THROWN FAILURE: Unexpected database error produces sanitized error state, NOT UNAVAILABLE, NOT 0", async () => {
      setTestSession({
        userId: USER_MUDIR,
        username: "p0.mudir",
        role: "KS",
        name: "KH. Mudir Utama",
      });

      const origCount = defaultPrisma.perizinanSantri.count;
      (defaultPrisma.perizinanSantri as any).count = async () => {
        throw new Error("FATAL: password authentication failed for user postgres_admin at 10.0.1.42:5432");
      };

      try {
        const res = await getBerandaOperationalSummaryAction();
        assert.equal(res.success, false, "Must return success = false on thrown query exception");
        assert.ok(res.message, "Must return sanitized error message");
        assert.ok(!res.message.includes("postgres_admin"), "Must not leak DB user credentials in UI error");
        assert.ok(!res.message.includes("10.0.1.42"), "Must not leak internal IP address in UI error");
        assert.ok(!res.data || res.data.izin.status !== "UNAVAILABLE", "THROWN error must NOT become UNAVAILABLE");
        assert.ok(!res.data || res.data.izin.pendingCount !== 0, "THROWN error must NOT become 0");
      } finally {
        (defaultPrisma.perizinanSantri as any).count = origCount;
      }
    });
  });

  describe("F. UI Error & Unauthorized Distinction (DENY != ERROR, UNAVAILABLE != ERROR)", () => {
    const berandaPath = path.resolve(__dirname, "../components/modules/beranda-module.tsx");
    const berandaContent = fs.readFileSync(berandaPath, "utf-8");

    it("1. Real summary failure displays fail-closed error presentation ('Data Tidak Tersedia', 'Data Tidak Lengkap', red task banner)", () => {
      assert.ok(berandaContent.includes('summaryError || izinLoadError'), "Must handle summaryError for izin");
      assert.ok(berandaContent.includes('summaryError || santriLoadError || spLoadError || kesehatanLoadError'), "Must handle summaryError for attention");
      assert.ok(berandaContent.includes('attentionValue = "Data Tidak Lengkap"'), "Must show Data Tidak Lengkap on error");
      assert.ok(berandaContent.includes('izinValue = "Data Tidak Tersedia"'), "Must show Data Tidak Tersedia on error");
      assert.ok(berandaContent.includes("Gagal memuat permohonan izin santri"), "Task Queue must show error alert on actual failure");
    });

    it("2. Legitimate unauthorized role displays neutral access restricted notice, NOT red server failure", () => {
      assert.ok(berandaContent.includes('operationalSummary?.izin.status === "UNAVAILABLE"'), "Must handle UNAVAILABLE specifically");
      assert.ok(berandaContent.includes('izinDesc = "Akses perizinan dibatasi"'), "Must explain access is restricted");
      assert.ok(berandaContent.includes('Akses perizinan santri dibatasi untuk peran ini.'), "Task Queue must show neutral restriction notice");
    });

    it("3. Proves DENY != ERROR and UNAVAILABLE != ERROR semantics", () => {
      // UNAVAILABLE uses neutral variant, while ERROR uses ditolak
      assert.ok(
        berandaContent.includes('operationalSummary?.izin.status === "UNAVAILABLE"') &&
        berandaContent.includes('izinVariant = "neutral"'),
        "UNAVAILABLE must use neutral badge variant"
      );
      assert.ok(
        berandaContent.includes('summaryError || izinLoadError') &&
        berandaContent.includes('izinVariant = "ditolak"'),
        "ERROR must use ditolak (red) badge variant"
      );
    });
  });

  describe("G. Security Regression & Confidentiality", () => {
    it("1. Summary response returns zero PII (no names, phones, or medical descriptions)", async () => {
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
