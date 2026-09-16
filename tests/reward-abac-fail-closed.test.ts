(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, JenisUjiHafalan, NilaiSetoran } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  getDaftarTasmiSimaanEligibleAction,
  prosesRewardTasmiSimaanAction,
} from "../app/actions/reward-sanksi";

describe("P0 ABAC Fail-Closed: Reward & Sanksi Evaluasi Tasmi / Simaan", () => {
  let prisma: PrismaClient;

  const STAFF_MT1 = "staff-reward-mt1";
  const STAFF_MT2 = "staff-reward-mt2";
  const STAFF_KS = "staff-reward-ks";

  const HALAQOH_1 = "hlq-reward-01";
  const HALAQOH_2 = "hlq-reward-02";

  const SANTRI_1 = "santri-reward-01";
  const SANTRI_2 = "santri-reward-02";

  let tasmiSantri1Id = "";
  let tasmiSantri2Id = "";

  const sessionMT1: UserSession = {
    userId: "user-reward-mt1",
    username: "musyrif.h1",
    name: "Musyrif Halaqoh 1",
    role: "MT",
    staffId: STAFF_MT1,
    isKepalaBidangTahfidz: false,
  };

  const sessionMT2: UserSession = {
    userId: "user-reward-mt2",
    username: "musyrif.h2",
    name: "Musyrif Halaqoh 2",
    role: "MT",
    staffId: STAFF_MT2,
    isKepalaBidangTahfidz: false,
  };

  const sessionMTNoStaff: UserSession = {
    userId: "user-reward-mt-nostaff",
    username: "musyrif.unlinked",
    name: "Musyrif Tanpa Profil Staf",
    role: "MT",
    staffId: undefined,
    isKepalaBidangTahfidz: false,
  };

  const sessionMTKabid: UserSession = {
    userId: "user-reward-mt-kabid",
    username: "kabid.tahfizh",
    name: "Kepala Bidang Tahfizh",
    role: "MT",
    staffId: "staff-reward-kabid",
    isKepalaBidangTahfidz: true,
  };

  const sessionKS: UserSession = {
    userId: "user-reward-ks",
    username: "mudir.pesantren",
    name: "K.H. Mudir Pesantren",
    role: "KS",
    staffId: STAFF_KS,
  };

  const sessionADM: UserSession = {
    userId: "user-reward-adm",
    username: "admin.pesantren",
    name: "Admin STQ",
    role: "ADM",
  };

  const sessionPH: UserSession = {
    userId: "user-reward-ph",
    username: "pengasuhan.ph",
    name: "Ust. Pengasuhan",
    role: "PH",
  };

  const sessionMK: UserSession = {
    userId: "user-reward-mk",
    username: "kesantrian.mk",
    name: "Ust. Kesantrian",
    role: "MK",
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Staff records
    await prisma.staff.createMany({
      data: [
        { id: STAFF_MT1, staffCode: "STF-RWD-01", nama: "Musyrif Halaqoh 1", roleStaff: "MT", status: "AKTIF", noHp: "0811111111" },
        { id: STAFF_MT2, staffCode: "STF-RWD-02", nama: "Musyrif Halaqoh 2", roleStaff: "MT", status: "AKTIF", noHp: "0822222222" },
        { id: "staff-reward-kabid", staffCode: "STF-RWD-KB", nama: "Kepala Bidang Tahfizh", roleStaff: "MT", status: "AKTIF", noHp: "0844444444" },
        { id: STAFF_KS, staffCode: "STF-RWD-KS", nama: "K.H. Mudir Pesantren", roleStaff: "KS", status: "AKTIF", noHp: "0833333333" },
      ],
    });

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        { id: sessionMT1.userId, username: sessionMT1.username, role: "MT", staffId: STAFF_MT1, passwordHash: "dummy" },
        { id: sessionMT2.userId, username: sessionMT2.username, role: "MT", staffId: STAFF_MT2, passwordHash: "dummy" },
        { id: sessionMTNoStaff.userId, username: sessionMTNoStaff.username, role: "MT", staffId: null, passwordHash: "dummy" },
        { id: sessionMTKabid.userId, username: sessionMTKabid.username, role: "MT", staffId: "staff-reward-kabid", passwordHash: "dummy" },
        { id: sessionKS.userId, username: sessionKS.username, role: "KS", staffId: STAFF_KS, passwordHash: "dummy" },
        { id: sessionADM.userId, username: sessionADM.username, role: "ADM", passwordHash: "dummy" },
        { id: sessionPH.userId, username: sessionPH.username, role: "PH", passwordHash: "dummy" },
        { id: sessionMK.userId, username: sessionMK.username, role: "MK", passwordHash: "dummy" },
      ],
    });

    // 3. Seed Halaqoh (Halaqoh 1 dibina oleh MT1, Halaqoh 2 dibina oleh MT2)
    await prisma.halaqoh.createMany({
      data: [
        { id: HALAQOH_1, halaqohCode: "HLQ-RWD-01", nama: "Halaqoh Al-Fatihah", pembinaId: STAFF_MT1, tahunAjaran: "2024/2025" },
        { id: HALAQOH_2, halaqohCode: "HLQ-RWD-02", nama: "Halaqoh Al-Baqarah", pembinaId: STAFF_MT2, tahunAjaran: "2024/2025" },
      ],
    });

    // 4. Seed Santri
    await prisma.santri.createMany({
      data: [
        { id: SANTRI_1, nis: "RWD-001", nama: "Ahmad Santri H1", halaqohId: HALAQOH_1, status: "AKTIF", jenisKelamin: "L", kelas: "7A" },
        { id: SANTRI_2, nis: "RWD-002", nama: "Bilal Santri H2", halaqohId: HALAQOH_2, status: "AKTIF", jenisKelamin: "L", kelas: "7B" },
      ],
    });

    // 5. Seed Kebijakan Reward
    await prisma.kebijakanRewardSanksi.create({
      data: {
        id: "kbj-reward-active",
        nama: "Kebijakan Ujian Tahfizh STQ",
        minNilaiTasmi: 80.0,
        minNilaiSimaan: 85.0,
        bintangTasmi: 1,
        bintangSimaan: 2,
        hakLiburTasmiHari: 1,
        hakLiburSimaanHari: 2,
        minPersenTargetBulanan: 100.0,
        durasiKehilanganKunjunganHari: 30,
        isActive: true,
        createdBy: sessionKS.userId,
      },
    });

    // 6. Seed Tasmi/Simaan records (Both eligible with nilai 90.0)
    const t1 = await prisma.tasmiSimaan.create({
      data: {
        santriId: SANTRI_1,
        jenis: JenisUjiHafalan.TASMI,
        juz: 1,
        tanggal: new Date(),
        nilai: 90.0,
        predikat: NilaiSetoran.MUMTAZ,
        catatan: "Lulus Ujian Tasmi Juz 1",
        musyrifId: STAFF_MT1,
      },
    });
    tasmiSantri1Id = t1.id;

    const t2 = await prisma.tasmiSimaan.create({
      data: {
        santriId: SANTRI_2,
        jenis: JenisUjiHafalan.TASMI,
        juz: 2,
        tanggal: new Date(),
        nilai: 92.0,
        predikat: NilaiSetoran.MUMTAZ,
        catatan: "Lulus Ujian Tasmi Juz 2",
        musyrifId: STAFF_MT2,
      },
    });
    tasmiSantri2Id = t2.id;
  });

  after(async () => {
    setTestSession(null);
    await stopTestDatabase();
  });

  // =========================================================================
  // A. getDaftarTasmiSimaanEligibleAction ABAC Tests
  // =========================================================================
  describe("A. getDaftarTasmiSimaanEligibleAction ABAC Scope", () => {
    it("1. Menolak jika tidak ada sesi aktif (fail-closed)", async () => {
      setTestSession(null);
      const res = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.data, []);
      assert.ok(res.message?.includes("Sesi telah berakhir"));
    });

    it("2. Menolak role yang tidak berwenang (PH, MK)", async () => {
      setTestSession(sessionPH);
      const resPH = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resPH.success, false);
      assert.deepStrictEqual(resPH.data, []);
      assert.ok(Boolean(resPH.message?.includes("wewenang") || resPH.message?.includes("Akses Ditolak")));

      setTestSession(sessionMK);
      const resMK = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resMK.success, false);
      assert.deepStrictEqual(resMK.data, []);
      assert.ok(Boolean(resMK.message?.includes("wewenang") || resMK.message?.includes("Akses Ditolak")));
    });

    it("3. MT tanpa profil staf gagal secara terkendali (fail-closed dengan array kosong)", async () => {
      setTestSession(sessionMTNoStaff);
      const res = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.data, []);
      assert.ok(res.message?.includes("Profil staf pembina Anda belum terhubung"));
    });

    it("4. MT biasa hanya melihat santri dari halaqoh binaannya", async () => {
      setTestSession(sessionMT1);
      const resMT1 = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resMT1.success, true);
      assert.ok(resMT1.data.length >= 1);
      // Harus ada santri 1, tidak boleh ada santri 2
      const santri1Found = resMT1.data.some((d) => d.id === tasmiSantri1Id);
      const santri2Found = resMT1.data.some((d) => d.id === tasmiSantri2Id);
      assert.strictEqual(santri1Found, true, "Santri binaan MT1 harus muncul");
      assert.strictEqual(santri2Found, false, "Santri halaqoh MT2 dilarang muncul untuk MT1");
    });

    it("5. MT halaqoh 2 hanya melihat santri binaan halaqoh 2", async () => {
      setTestSession(sessionMT2);
      const resMT2 = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resMT2.success, true);
      assert.ok(resMT2.data.length >= 1);
      const santri1Found = resMT2.data.some((d) => d.id === tasmiSantri1Id);
      const santri2Found = resMT2.data.some((d) => d.id === tasmiSantri2Id);
      assert.strictEqual(santri1Found, false, "Santri halaqoh MT1 dilarang muncul untuk MT2");
      assert.strictEqual(santri2Found, true, "Santri binaan MT2 harus muncul");
    });

    it("6. MT Kabid memiliki managerial scope (dapat melihat seluruh halaqoh)", async () => {
      setTestSession(sessionMTKabid);
      const resKabid = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resKabid.success, true);
      const santri1Found = resKabid.data.some((d) => d.id === tasmiSantri1Id);
      const santri2Found = resKabid.data.some((d) => d.id === tasmiSantri2Id);
      assert.strictEqual(santri1Found, true, "Kabid harus melihat Santri 1");
      assert.strictEqual(santri2Found, true, "Kabid harus melihat Santri 2");
    });

    it("7. KS dan ADM memiliki global scope (melihat seluruh data lintas halaqoh)", async () => {
      setTestSession(sessionKS);
      const resKS = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resKS.success, true);
      assert.ok(resKS.data.some((d) => d.id === tasmiSantri1Id));
      assert.ok(resKS.data.some((d) => d.id === tasmiSantri2Id));

      setTestSession(sessionADM);
      const resADM = await getDaftarTasmiSimaanEligibleAction();
      assert.strictEqual(resADM.success, true);
      assert.ok(resADM.data.some((d) => d.id === tasmiSantri1Id));
      assert.ok(resADM.data.some((d) => d.id === tasmiSantri2Id));
    });
  });

  // =========================================================================
  // B. prosesRewardTasmiSimaanAction ABAC & Write Parity Tests
  // =========================================================================
  describe("B. prosesRewardTasmiSimaanAction ABAC Write Parity", () => {
    it("1. Menolak jika tidak ada sesi", async () => {
      setTestSession(null);
      const res = await prosesRewardTasmiSimaanAction(tasmiSantri1Id);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Sesi telah berakhir"));
    });

    it("2. Menolak role selain MT/KS/ADM", async () => {
      setTestSession(sessionPH);
      const res = await prosesRewardTasmiSimaanAction(tasmiSantri1Id);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("tidak berwenang"));
    });

    it("3. Menolak MT tanpa profil staf (fail closed)", async () => {
      setTestSession(sessionMTNoStaff);
      const res = await prosesRewardTasmiSimaanAction(tasmiSantri1Id);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Profil staf pembina Anda belum terhubung"));
    });

    it("4. Menolak MT memproses reward santri di luar halaqoh binaannya", async () => {
      // MT1 mencoba memproses Santri 2 (milik Halaqoh MT2)
      setTestSession(sessionMT1);
      const resCross = await prosesRewardTasmiSimaanAction(tasmiSantri2Id);
      assert.strictEqual(resCross.success, false);
      assert.ok(resCross.message.includes("Akses Ditolak: Anda hanya berwenang memproses reward Tasmi'/Sima'an santri di dalam halaqoh binaan Anda."));
    });

    it("5. Mengizinkan MT memproses reward santri halaqoh binaannya sendiri", async () => {
      setTestSession(sessionMT1);
      const resValid = await prosesRewardTasmiSimaanAction(tasmiSantri1Id);
      assert.strictEqual(resValid.success, true);
      assert.ok(resValid.message.includes("berhasil diterbitkan"));

      // Verifikasi DB write
      const hakLibur = await prisma.hakLiburSantri.findFirst({
        where: { tasmiSimaanId: tasmiSantri1Id },
      });
      assert.ok(hakLibur !== null, "Hak libur harus berhasil dibuat di database");
      assert.strictEqual(hakLibur?.santriId, SANTRI_1);
    });

    it("6. Idempotensi: Memproses ulang reward yang sama tidak menduplikasi data", async () => {
      setTestSession(sessionMT1);
      const resRetry = await prosesRewardTasmiSimaanAction(tasmiSantri1Id);
      assert.strictEqual(resRetry.success, true);
      assert.ok(resRetry.message.includes("sudah pernah diterbitkan"));

      const count = await prisma.hakLiburSantri.count({
        where: { tasmiSimaanId: tasmiSantri1Id },
      });
      assert.strictEqual(count, 1, "Hak libur tidak boleh diduplikasi");
    });

    it("7. MT Kabid dapat memproses reward santri dari halaqoh manapun", async () => {
      setTestSession(sessionMTKabid);
      const resKabid = await prosesRewardTasmiSimaanAction(tasmiSantri2Id);
      assert.strictEqual(resKabid.success, true);
      assert.ok(resKabid.message.includes("berhasil diterbitkan"));

      const hakLibur2 = await prisma.hakLiburSantri.findFirst({
        where: { tasmiSimaanId: tasmiSantri2Id },
      });
      assert.ok(hakLibur2 !== null, "Hak libur santri 2 berhasil diterbitkan oleh Kabid");
    });
  });
});
