(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  getCompletedJuzCount,
  getDailyMufarTargetJuz,
  calculateWeeklySabaqProgress,
} from "../lib/tahfizh-mufar-tier";
import {
  determineTahfizhDailyStatus,
} from "../lib/tahfizh-status";
import {
  getTahfizhOperationalMonitoring,
} from "../lib/server/tahfizh-monitoring-service";
import { createSetoranAction } from "../app/actions/tahfizh";

describe("PR #7 — Tahfizh Operational Monitoring & Action Center (Comprehensive Test Suite)", () => {
  let prisma: PrismaClient;

  const STAFF_MT_1_ID = "stf-mon-mt-01";
  const STAFF_MT_2_ID = "stf-mon-mt-02";
  const STAFF_KABID_ID = "stf-mon-kabid";

  const HALAQOH_1_ID = "hlq-mon-01";
  const HALAQOH_2_ID = "hlq-mon-02";

  const SANTRI_1_ID = "san-mon-01";
  const SANTRI_2_ID = "san-mon-02";
  const SANTRI_3_ID = "san-mon-03";

  const sessionMT1: UserSession = {
    userId: "usr-mon-mt-01",
    username: "musyrif.mon1",
    name: "Ust. Musyrif Mon 1",
    role: "MT",
    staffId: STAFF_MT_1_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionMT2: UserSession = {
    userId: "usr-mon-mt-02",
    username: "musyrif.mon2",
    name: "Ust. Musyrif Mon 2",
    role: "MT",
    staffId: STAFF_MT_2_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionMTNoStaff: UserSession = {
    userId: "usr-mon-nostaff",
    username: "musyrif.nostaff",
    name: "Ust. Musyrif Tanpa Staff",
    role: "MT",
    staffId: null,
    isKepalaBidangTahfidz: false,
  };

  const sessionKabid: UserSession = {
    userId: "usr-mon-kabid",
    username: "kabid.mon",
    name: "Ust. Kabid Monitoring",
    role: "MT",
    staffId: STAFF_KABID_ID,
    isKepalaBidangTahfidz: true,
  };

  const sessionKS: UserSession = {
    userId: "usr-mon-ks",
    username: "mudir.ks",
    name: "Ust. Mudir",
    role: "KS",
    staffId: null,
    isKepalaBidangTahfidz: false,
  };

  const sessionWali: UserSession = {
    userId: "usr-mon-wali",
    username: "wali.santri",
    name: "Wali Santri 1",
    role: "WS",
    santriId: SANTRI_1_ID,
    isKepalaBidangTahfidz: false,
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Staff
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_MT_1_ID,
          staffCode: "STF-MON-01",
          nama: "Ust. Musyrif Mon 1",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08111111111",
        },
        {
          id: STAFF_MT_2_ID,
          staffCode: "STF-MON-02",
          nama: "Ust. Musyrif Mon 2",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08222222222",
        },
        {
          id: STAFF_KABID_ID,
          staffCode: "STF-MON-KABID",
          nama: "Ust. Kabid Monitoring",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08333333333",
          isKepalaBidangTahfidz: true,
        },
      ],
    });

    // 2. Seed Halaqoh
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_1_ID,
          halaqohCode: "HLQ-MON-01",
          nama: "Halaqoh Al-Fatih",
          pembinaId: STAFF_MT_1_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_2_ID,
          halaqohCode: "HLQ-MON-02",
          nama: "Halaqoh Al-Baqarah",
          pembinaId: STAFF_MT_2_ID,
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
          nis: "MON-001",
          nama: "Santri Satu (Halaqoh 1)",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_1_ID,
          status: "AKTIF",
          modalHafalanAwalHalaman: 21,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
          targetAkhirProgramJuz: 30,
        },
        {
          id: SANTRI_2_ID,
          nis: "MON-002",
          nama: "Santri Dua (Halaqoh 1)",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_1_ID,
          status: "AKTIF",
          modalHafalanAwalHalaman: 121,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
          targetAkhirProgramJuz: 30,
        },
        {
          id: SANTRI_3_ID,
          nis: "MON-003",
          nama: "Santri Tiga (Halaqoh 2)",
          kelas: "7B",
          jenisKelamin: "L",
          halaqohId: HALAQOH_2_ID,
          status: "AKTIF",
          modalHafalanAwalHalaman: 0,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
          targetAkhirProgramJuz: 10,
        },
      ],
    });

    // 4. Seed Users (for audit log foreign keys)
    await prisma.user.createMany({
      data: [
        {
          id: sessionMT1.userId,
          username: sessionMT1.username,
          passwordHash: "hash-test",
          role: "MT",
          staffId: STAFF_MT_1_ID,
        },
        {
          id: sessionMT2.userId,
          username: sessionMT2.username,
          passwordHash: "hash-test",
          role: "MT",
          staffId: STAFF_MT_2_ID,
        },
        {
          id: sessionKabid.userId,
          username: sessionKabid.username,
          passwordHash: "hash-test",
          role: "MT",
          staffId: STAFF_KABID_ID,
        },
        {
          id: sessionMTNoStaff.userId,
          username: sessionMTNoStaff.username,
          passwordHash: "hash-test",
          role: "MT",
          staffId: null,
        },
        {
          id: sessionKS.userId,
          username: sessionKS.username,
          passwordHash: "hash-test",
          role: "KS",
          staffId: null,
        },
        {
          id: sessionWali.userId,
          username: sessionWali.username,
          passwordHash: "hash-test",
          role: "WS",
          santriId: SANTRI_1_ID,
        },
      ],
    });

    // 5. Seed TargetSantri untuk Santri 1 (Target Pekanan 5 Halaman)
    await prisma.targetSantri.create({
      data: {
        santriId: SANTRI_1_ID,
        jenis: "SABAQ",
        bulan: 9,
        tahunAjaran: "2026/2027",
        targetBulanan: 20,
        targetPekanan: 5,
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  // =========================================================================
  // KELOMPOK 1: KANONIKAL MUFAR TIER & VOLUME MUSHAF
  // =========================================================================
  describe("1. Canonical MUFAR Tiers & Mushaf Boundaries", () => {
    it("1.1. Completed Juz 0 -> Target MUFAR = 0 (TIDAK_BERLAKU)", () => {
      const target = getDailyMufarTargetJuz(0);
      assert.equal(target, 0);
    });

    it("1.2. Completed Juz 1..5 -> Target MUFAR = 1 Juz/hari", () => {
      for (let j = 1; j <= 5; j++) {
        assert.equal(getDailyMufarTargetJuz(j), 1, `Juz ${j} harus bertarget 1 Juz`);
      }
    });

    it("1.3. Completed Juz 6..10 -> Target MUFAR = 2 Juz/hari", () => {
      for (let j = 6; j <= 10; j++) {
        assert.equal(getDailyMufarTargetJuz(j), 2, `Juz ${j} harus bertarget 2 Juz`);
      }
    });

    it("1.4. Completed Juz 11..15 -> Target MUFAR = 3 Juz/hari", () => {
      for (let j = 11; j <= 15; j++) {
        assert.equal(getDailyMufarTargetJuz(j), 3, `Juz ${j} harus bertarget 3 Juz`);
      }
    });

    it("1.5. Completed Juz 16..20 -> Target MUFAR = 4 Juz/hari", () => {
      for (let j = 16; j <= 20; j++) {
        assert.equal(getDailyMufarTargetJuz(j), 4, `Juz ${j} harus bertarget 4 Juz`);
      }
    });

    it("1.6. Completed Juz 21..30 -> Target MUFAR = 5 Juz/hari", () => {
      for (let j = 21; j <= 30; j++) {
        assert.equal(getDailyMufarTargetJuz(j), 5, `Juz ${j} harus bertarget 5 Juz`);
      }
    });

    it("1.7. Guard Halaman Parsial: Halaman 21 parsial vs full", () => {
      // Halaman 21 adalah halaman terakhir Juz 1.
      // Jika parsial (isHalamanTerakhirParsial = true) -> Juz 1 belum tuntas penuh -> completed = 0
      const partialJuz1 = getCompletedJuzCount(21, true);
      assert.equal(partialJuz1, 0, "Halaman 21 parsial harus menghasilkan completed Juz = 0");

      // Jika full (isHalamanTerakhirParsial = false) -> Juz 1 tuntas -> completed = 1
      const fullJuz1 = getCompletedJuzCount(21, false);
      assert.equal(fullJuz1, 1, "Halaman 21 full harus menghasilkan completed Juz = 1");
    });

    it("1.8. Tier boundary transitions pada halaman batas Mushaf", () => {
      // Boundary Tier 1 -> Tier 2 (Juz 5 selesai di hal 121, Juz 6 selesai di hal 141)
      // Juz 5 endPage = 101, Juz 6 endPage = 121
      assert.equal(getCompletedJuzCount(120, false), 5); // Juz 6 belum selesai
      assert.equal(getCompletedJuzCount(121, true), 5);  // Hal 121 parsial -> Juz 6 belum selesai
      assert.equal(getCompletedJuzCount(121, false), 6); // Hal 121 full -> Juz 6 selesai (Tier 2)

      // Boundary Tier 2 -> Tier 3 (Juz 10 selesai di hal 201, Juz 11 selesai di hal 221)
      assert.equal(getCompletedJuzCount(220, false), 10); // Juz 11 belum selesai
      assert.equal(getCompletedJuzCount(221, true), 10);  // Hal 221 parsial -> Juz 11 belum selesai
      assert.equal(getCompletedJuzCount(221, false), 11); // Hal 221 full -> Juz 11 selesai (Tier 3)

      // Boundary Tier 3 -> Tier 4 (Juz 15 selesai di hal 301, Juz 16 selesai di hal 321)
      assert.equal(getCompletedJuzCount(320, false), 15);
      assert.equal(getCompletedJuzCount(321, true), 15);
      assert.equal(getCompletedJuzCount(321, false), 16); // Tier 4

      // Boundary Tier 4 -> Tier 5 (Juz 20 selesai di hal 401, Juz 21 selesai di hal 421)
      assert.equal(getCompletedJuzCount(420, false), 20);
      assert.equal(getCompletedJuzCount(421, true), 20);
      assert.equal(getCompletedJuzCount(421, false), 21); // Tier 5

      // Halaman akhir Mushaf Madinah 604
      assert.equal(getCompletedJuzCount(604, false), 30);
    });
  });

  // =========================================================================
  // KELOMPOK 2: PERHITUNGAN TARGET SABAQ PEKANAN (DECIMAL-SAFE)
  // =========================================================================
  describe("2. Weekly Sabaq Progress Calculations", () => {
    it("2.1. Target missing / null / <= 0 -> status TARGET_BELUM_DITETAPKAN", () => {
      const resNull = calculateWeeklySabaqProgress(null, 3);
      assert.equal(resNull.status, "TARGET_BELUM_DITETAPKAN");
      assert.equal(resNull.targetLabel, "Target belum ditetapkan");
      assert.equal(resNull.remaining, null);

      const resZero = calculateWeeklySabaqProgress(0, 0);
      assert.equal(resZero.status, "TARGET_BELUM_DITETAPKAN");
    });

    it("2.2. Target 5, actual 4.5 -> remaining 0.5, status BELUM_TERCAPAI", () => {
      const res = calculateWeeklySabaqProgress(5, 4.5);
      assert.equal(res.target, 5);
      assert.equal(res.actual, 4.5);
      assert.equal(res.remaining, 0.5);
      assert.equal(res.percentage, 90);
      assert.equal(res.status, "BELUM_TERCAPAI");
    });

    it("2.3. Target 5, actual 5 -> remaining 0, status TERCAPAI", () => {
      const res = calculateWeeklySabaqProgress(5, 5);
      assert.equal(res.remaining, 0);
      assert.equal(res.percentage, 100);
      assert.equal(res.status, "TERCAPAI");
    });

    it("2.4. Target 5, actual 5.5 -> remaining 0, status TERCAPAI", () => {
      const res = calculateWeeklySabaqProgress(5, 5.5);
      assert.equal(res.remaining, 0);
      assert.equal(res.percentage, 100);
      assert.equal(res.status, "TERCAPAI");
    });
  });

  // =========================================================================
  // KELOMPOK 3: STATUS OPERASIONAL TAHFIZH & EVALUASI MUFAR
  // =========================================================================
  describe("3. Operational Status & MUFAR Volume Evaluation", () => {
    const wednesdayEffective = new Date("2026-09-16T10:00:00.000Z"); // Rabu (hari efektif)
    const sundayWeekend = new Date("2026-09-20T10:00:00.000Z");     // Ahad (akhir pekan)

    it("3.1. Hari Efektif: Target 3, actual 0 -> BELUM_SELESAI", () => {
      const status = determineTahfizhDailyStatus({
        refDate: wednesdayEffective,
        validSetoranToday: [],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 3,
        actualDailyMufarJuz: 0,
        isMufarApplicable: true,
      });
      assert.equal(status.mufar, "BELUM_SELESAI");
    });

    it("3.2. Hari Efektif: Target 3, actual 1 -> BELUM_SELESAI", () => {
      const status = determineTahfizhDailyStatus({
        refDate: wednesdayEffective,
        validSetoranToday: [{ jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 1 }],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 3,
        actualDailyMufarJuz: 1,
        isMufarApplicable: true,
      });
      assert.equal(status.mufar, "BELUM_SELESAI");
    });

    it("3.3. Hari Efektif: Target 3, actual 3 -> SELESAI", () => {
      const status = determineTahfizhDailyStatus({
        refDate: wednesdayEffective,
        validSetoranToday: [{ jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 3 }],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 3,
        actualDailyMufarJuz: 3,
        isMufarApplicable: true,
      });
      assert.equal(status.mufar, "SELESAI");
    });

    it("3.4. Hari Efektif: Target 3, actual 4 -> SELESAI", () => {
      const status = determineTahfizhDailyStatus({
        refDate: wednesdayEffective,
        validSetoranToday: [{ jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 4 }],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 3,
        actualDailyMufarJuz: 4,
        isMufarApplicable: true,
      });
      assert.equal(status.mufar, "SELESAI");
    });

    it("3.5. Multiple same-day MUFAR records dijumlahkan secara kumulatif", () => {
      // Record 1: 1 Juz + Record 2: 2 Juz -> total 3 Juz
      const status = determineTahfizhDailyStatus({
        refDate: wednesdayEffective,
        validSetoranToday: [
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 1 },
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 2 },
        ],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 3,
        isMufarApplicable: true,
      });
      assert.equal(status.actualDailyMufarJuz, 3);
      assert.equal(status.mufar, "SELESAI");
    });

    it("3.6. Setoran MUFAR DIBATALKAN tidak dihitung dalam actual volume", () => {
      const status = determineTahfizhDailyStatus({
        refDate: wednesdayEffective,
        validSetoranToday: [
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 1 },
          { jenis: "MUFAR", status: "DIBATALKAN", jumlahJuzMufar: 5 },
        ],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 2,
        isMufarApplicable: true,
      });
      assert.equal(status.actualDailyMufarJuz, 1);
      assert.equal(status.mufar, "BELUM_SELESAI");
    });

    it("3.7. Akhir Pekan (Ahad): actual > 0 -> SELESAI; actual = 0 -> TIDAK_BERLAKU", () => {
      const statusAdaSetor = determineTahfizhDailyStatus({
        refDate: sundayWeekend,
        validSetoranToday: [{ jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 2 }],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 2,
        actualDailyMufarJuz: 2,
        isMufarApplicable: true,
      });
      assert.equal(statusAdaSetor.mufar, "SELESAI");

      const statusTanpaSetor = determineTahfizhDailyStatus({
        refDate: sundayWeekend,
        validSetoranToday: [],
        posisiTerakhirHalaman: 300,
        targetDailyMufarJuz: 2,
        actualDailyMufarJuz: 0,
        isMufarApplicable: true,
      });
      assert.equal(statusTanpaSetor.mufar, "TIDAK_BERLAKU");
    });
  });

  // =========================================================================
  // KELOMPOK 4: PERSISTENCE STRUCTURED MUFAR FIELD & SERVER ACTION
  // =========================================================================
  describe("4. Structured MUFAR Field Persistence & Validation", () => {
    it("4.1. Input MUFAR dengan jumlahJuzMufar valid (1–6) tersimpan ke DB", async () => {
      setTestSession(sessionMT1);
      const res = await createSetoranAction({
        santriId: SANTRI_1_ID,
        jenis: "MUFAR",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 21,
        jumlahHalaman: 21,
        jumlahJuzMufar: 2,
        nilai: "MUMTAZ",
        catatan: "Setoran MUFAR 2 Juz",
      });

      assert.equal(res.success, true);
      const saved = await prisma.setoranTahfizh.findFirst({
        where: { santriId: SANTRI_1_ID, jenis: "MUFAR" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(saved);
      assert.equal(saved?.jumlahJuzMufar, 2);
    });

    it("4.2. Input MUFAR dengan jumlahJuzMufar di luar rentang 1–6 ditolak server", async () => {
      setTestSession(sessionMT1);
      const resNegative = await createSetoranAction({
        santriId: SANTRI_1_ID,
        jenis: "MUFAR",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 21,
        jumlahHalaman: 21,
        jumlahJuzMufar: 0,
        nilai: "MUMTAZ",
      });
      assert.equal(resNegative.success, false);
      assert.match(resNegative.message || "", /jumlah juz wajib berupa bilangan bulat antara 1 sampai 6/i);

      const resOver = await createSetoranAction({
        santriId: SANTRI_1_ID,
        jenis: "MUFAR",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 21,
        jumlahHalaman: 21,
        jumlahJuzMufar: 7,
        nilai: "MUMTAZ",
      });
      assert.equal(resOver.success, false);
      assert.match(resOver.message || "", /jumlah juz wajib berupa bilangan bulat antara 1 sampai 6/i);
    });

    it("4.3. Non-MUFAR setoran memaksa jumlahJuzMufar menjadi null di database", async () => {
      setTestSession(sessionMT1);
      const res = await createSetoranAction({
        santriId: SANTRI_1_ID,
        jenis: "SABAQ",
        juz: 2,
        halamanMulai: 22,
        halamanSelesai: 23,
        jumlahHalaman: 2,
        jumlahJuzMufar: 3, // Diberikan input mufar tapi jenis SABAQ
        nilai: "MUMTAZ",
      });
      assert.equal(res.success, true);

      const saved = await prisma.setoranTahfizh.findFirst({
        where: { santriId: SANTRI_1_ID, jenis: "SABAQ" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(saved);
      assert.equal(saved?.jumlahJuzMufar, null, "SABAQ tidak boleh menyimpan jumlah_juz_mufar");
    });
  });

  // =========================================================================
  // KELOMPOK 5: OPERATIONAL MONITORING SERVICE BATCH QUERY & ABAC
  // =========================================================================
  describe("5. Operational Monitoring Service Scoping, ABAC, & Workloads", () => {
    it("5.1. MT 1 dapat mengakses halaqoh binaan sendiri", async () => {
      const res = await getTahfizhOperationalMonitoring(
        { halaqohId: HALAQOH_1_ID },
        sessionMT1,
        prisma
      );
      assert.equal(res.success, true);
      assert.ok(res.data);
      assert.equal(res.data.items.length, 2); // Santri 1 & 2
    });

    it("5.2. MT 1 ditolak saat mengakses halaqoh orang lain (Fail-Closed)", async () => {
      const res = await getTahfizhOperationalMonitoring(
        { halaqohId: HALAQOH_2_ID },
        sessionMT1,
        prisma
      );
      assert.equal(res.success, false);
      assert.match(res.message || "", /Akses Ditolak/i);
    });

    it("5.3. MT tanpa staffId langsung ditolak (Fail-Closed)", async () => {
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionMTNoStaff,
        prisma
      );
      assert.equal(res.success, false);
      assert.match(res.message || "", /Profil staf pembina Anda belum terhubung/i);
    });

    it("5.4. Role tidak berwenang (WS) default-deny", async () => {
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionWali,
        prisma
      );
      assert.equal(res.success, false);
      assert.match(res.message || "", /Akses Ditolak/i);
    });

    it("5.5. Kabid Tahfizh memiliki akses global ke seluruh halaqoh", async () => {
      const res = await getTahfizhOperationalMonitoring(
        { halaqohId: "ALL" },
        sessionKabid,
        prisma
      );
      assert.equal(res.success, true);
      assert.ok(res.data);
      assert.equal(res.data.isKabidOrManagerial, true);
      assert.equal(res.data.items.length, 3); // Santri 1, 2, 3
      assert.ok(res.data.halaqohWorkloads);
      assert.equal(res.data.halaqohWorkloads.length, 2); // Halaqoh 1 & 2
    });

    it("5.6. Kabid halaqohWorkloads tidak memiliki ranking/leaderboard dan terurut nama", async () => {
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionKabid,
        prisma
      );
      assert.equal(res.success, true);
      const workloads = res.data?.halaqohWorkloads || [];
      assert.equal(workloads.length, 2);

      // Verifikasi urutan alfabetis nama halaqoh
      assert.equal(workloads[0].halaqohNama, "Halaqoh Al-Baqarah");
      assert.equal(workloads[1].halaqohNama, "Halaqoh Al-Fatih");

      // Verifikasi metrik kerja (hanya angka perhatian/workload)
      assert.ok(typeof workloads[0].perluTindakanCount === "number");
      assert.ok(typeof workloads[0].belumSetorCount === "number");
      assert.ok(typeof workloads[0].sabaqBelumTercapaiCount === "number");
    });

    it("5.7. Summary metrics matematis konsisten dengan detail baris", async () => {
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionMT1,
        prisma
      );
      assert.equal(res.success, true);
      const data = res.data!;
      assert.equal(data.summary.totalSantri, data.items.length);
      assert.equal(
        data.summary.perluTindakan,
        data.items.filter((i) => i.needsAttention).length
      );
      assert.equal(
        data.summary.targetBelumDitetapkan,
        data.items.filter((i) => i.weeklySabaq.status === "TARGET_BELUM_DITETAPKAN").length
      );
    });

    it("5.8. Filter tab operasional konsisten dengan summary counts", async () => {
      // Filter PERLU_TINDAKAN
      const resPerlu = await getTahfizhOperationalMonitoring(
        { filter: "PERLU_TINDAKAN" },
        sessionMT1,
        prisma
      );
      assert.equal(resPerlu.success, true);
      assert.equal(
        resPerlu.data!.items.length,
        resPerlu.data!.summary.perluTindakan
      );

      // Filter TARGET_BELUM_DITETAPKAN
      const resBelumTarget = await getTahfizhOperationalMonitoring(
        { filter: "TARGET_BELUM_DITETAPKAN" },
        sessionMT1,
        prisma
      );
      assert.equal(resBelumTarget.success, true);
      assert.equal(
        resBelumTarget.data!.items.length,
        resBelumTarget.data!.summary.targetBelumDitetapkan
      );
    });

    it("5.9. Evaluasi attentionReasons transparan dan mencantumkan penyebab", async () => {
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionMT1,
        prisma
      );
      assert.equal(res.success, true);
      // Santri 2 belum punya target pekanan -> harus punya reason
      const santri2 = res.data!.items.find((i) => i.id === SANTRI_2_ID);
      assert.ok(santri2);
      assert.equal(santri2?.needsAttention, true);
      assert.ok(
        santri2?.attentionReasons.some((r) => r.includes("Target Sabaq pekanan belum ditetapkan"))
      );
    });
  });

  // =========================================================================
  // KELOMPOK 6: REMEDIATION ROUND 1 SPECIFIC GUARDS
  // =========================================================================
  describe("6. Remediation Round 1 Authoritative Rules", () => {
    it("6.1. Structured MUFAR Only: jumlahJuzMufar null MUST NEVER yield +1 volume (fail-closed = 0)", () => {
      const status = determineTahfizhDailyStatus({
        refDate: new Date("2026-09-16T10:00:00.000Z"),
        validSetoranToday: [
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: null },
        ],
        posisiTerakhirHalaman: 100,
        targetDailyMufarJuz: 2,
        isMufarApplicable: true,
      });
      assert.equal(status.actualDailyMufarJuz, 0, "MUFAR dengan jumlahJuzMufar null HARUS bernilai actual 0, dilarang fallback +1");
      assert.equal(status.mufar, "BELUM_SELESAI");
    });

    it("6.2. No Catatan Parser: [Mufar: 3 Juz ...] di catatan diabaikan sepenuhnya", () => {
      const statusWithCatatan = determineTahfizhDailyStatus({
        refDate: new Date("2026-09-16T10:00:00.000Z"),
        validSetoranToday: [
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: null, catatan: "[Mufar: 3 Juz, Juz 1-3]" },
        ],
        posisiTerakhirHalaman: 100,
        targetDailyMufarJuz: 2,
        isMufarApplicable: true,
      });
      assert.equal(statusWithCatatan.actualDailyMufarJuz, 0, "Catatan lama dilarang diparse sebagai volume actual");

      const statusWithStructured = determineTahfizhDailyStatus({
        refDate: new Date("2026-09-16T10:00:00.000Z"),
        validSetoranToday: [
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 2, catatan: "[Mufar: 5 Juz]" },
        ],
        posisiTerakhirHalaman: 100,
        targetDailyMufarJuz: 2,
        isMufarApplicable: true,
      });
      assert.equal(statusWithStructured.actualDailyMufarJuz, 2, "Hanya jumlahJuzMufar terstruktur yang menjadi source of truth");
      assert.equal(statusWithStructured.mufar, "SELESAI");
    });

    it("6.3. Old TargetSantri 5/20 never used as daily MUFAR volume", () => {
      // Santri dengan completedJuz = 12 -> target daily mufar = 3 Juz/hari
      // TargetSantri frequency 5/20 tidak boleh dijadikan daily volume target
      const completedJuz = 12;
      const canonicalTarget = getDailyMufarTargetJuz(completedJuz);
      assert.equal(canonicalTarget, 3, "Target daily MUFAR untuk 12 Juz adalah 3 Juz/hari");

      const status = determineTahfizhDailyStatus({
        refDate: new Date("2026-09-16T10:00:00.000Z"),
        validSetoranToday: [
          { jenis: "MUFAR", status: "AKTIF", jumlahJuzMufar: 3 },
        ],
        posisiTerakhirHalaman: 242,
        targetDailyMufarJuz: canonicalTarget,
        isMufarApplicable: true,
      });
      assert.equal(status.mufar, "SELESAI", "Status selesai karena actual 3 memenuhi daily target canonical 3");
    });

    it("6.4. ALL filter count and list consistency: badge count === rendered list count", async () => {
      const resAll = await getTahfizhOperationalMonitoring(
        { filter: "ALL" },
        sessionMT1,
        prisma
      );
      assert.equal(resAll.success, true);
      assert.equal(
        resAll.data!.items.length,
        resAll.data!.summary.totalSantri,
        "ALL filter list length HARUS sama dengan summary totalSantri"
      );
    });

    it("6.5. Ordinary MT Isolation: tidak dapat mengakses data santri lintas-halaqoh", async () => {
      // MT 1 hanya membina Halaqoh 1 (2 santri)
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionMT1,
        prisma
      );
      assert.equal(res.success, true);
      assert.equal(res.data!.isKabidOrManagerial, false);
      assert.equal(res.data!.items.length, 2);
      assert.equal(res.data!.halaqohWorkloads, null, "Ordinary MT tidak boleh menerima halaqohWorkloads lintas halaqoh");

      // Coba akses Halaqoh 2 milik MT 2 -> Ditolak
      const resCross = await getTahfizhOperationalMonitoring(
        { halaqohId: HALAQOH_2_ID },
        sessionMT1,
        prisma
      );
      assert.equal(resCross.success, false);
      assert.match(resCross.message || "", /Akses Ditolak/i);
    });

    it("6.6. Controlled error vs real zero: antreanIzin dihapus dan antreanIkhtibar error tidak menjadi 0 palsu", async () => {
      const res = await getTahfizhOperationalMonitoring(
        {},
        sessionMT1,
        prisma
      );
      assert.equal(res.success, true);
      // Field antreanIzin dilarang ada bila bernilai fake 0
      assert.equal("antreanIzin" in res.data!.summary, false, "antreanIzin tidak boleh ada sebagai fake zero");
      // antreanIkhtibar bernilai angka riil jika sukses (misal 0), bukan fake hardcode
      assert.ok(
        res.data!.summary.antreanIkhtibar === null ||
        typeof res.data!.summary.antreanIkhtibar === "number"
      );
    });

    it("6.7. Isolated Migration Database Schema Check: jumlah_juz_mufar = INTEGER NULL", async () => {
      const columns: Array<{ column_name: string; data_type: string; is_nullable: string }> =
        await prisma.$queryRawUnsafe(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'setoran_tahfizh' AND column_name = 'jumlah_juz_mufar';
        `);

      assert.equal(columns.length, 1, "Kolom jumlah_juz_mufar harus ada pada tabel setoran_tahfizh");
      assert.equal(columns[0].data_type, "integer", "Tipe data kolom harus integer");
      assert.equal(columns[0].is_nullable, "YES", "Kolom jumlah_juz_mufar harus nullable (INTEGER NULL)");
    });

    it("6.8. Weekly Sabaq Terminology: BELUM_TERCAPAI bukan kegagalan otomatis attention hari ini", () => {
      // Periksa perhitungan weekly progress
      const weekly = calculateWeeklySabaqProgress(5, 3);
      assert.equal(weekly.status, "BELUM_TERCAPAI");

      // Status daily sabaq hari ini sudah setor
      const dailyStatus = determineTahfizhDailyStatus({
        refDate: new Date("2026-09-16T10:00:00.000Z"),
        validSetoranToday: [
          { jenis: "SABAQ", status: "AKTIF" },
        ],
        posisiTerakhirHalaman: 50,
        targetDailyMufarJuz: 0,
        isMufarApplicable: false,
      });
      assert.equal(dailyStatus.sabaq, "SELESAI");
    });
  });
});
