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
  createHalaqohAction,
  assignPembinaHalaqohAction,
  pindahkanSantriHalaqohAction,
  getAssignableStaffAction,
} from "../app/actions/halaqoh";

describe("P0 RBAC & ABAC Enclosure: Halaqoh Management Actions", () => {
  let prisma: PrismaClient;

  const STAFF_MT1 = "stf-hlq-mt1";
  const STAFF_MT2 = "stf-hlq-mt2";
  const STAFF_KS = "stf-hlq-ks";
  const STAFF_PH1 = "stf-hlq-ph1";
  const STAFF_ADM1 = "stf-hlq-adm1";

  const HALAQOH_1 = "hlq-test-01";
  const HALAQOH_2 = "hlq-test-02";

  const SANTRI_1 = "san-hlq-01";

  const sessionKS: UserSession = {
    userId: "usr-hlq-ks",
    username: "mudir.pesantren",
    name: "K.H. Mudir Pesantren",
    role: "KS",
    staffId: STAFF_KS,
  };

  const sessionADM: UserSession = {
    userId: "usr-hlq-adm",
    username: "admin.pesantren",
    name: "Admin STQ",
    role: "ADM",
  };

  const sessionMT: UserSession = {
    userId: "usr-hlq-mt",
    username: "musyrif.tahfizh",
    name: "Musyrif Tahfizh 1",
    role: "MT",
    staffId: STAFF_MT1,
  };

  const sessionPH: UserSession = {
    userId: "usr-hlq-ph",
    username: "pengasuhan.pesantren",
    name: "Ust. Pengasuhan",
    role: "PH",
  };

  const sessionMK: UserSession = {
    userId: "usr-hlq-mk",
    username: "kesantrian.pesantren",
    name: "Ust. Kesantrian",
    role: "MK",
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Staff
    await prisma.staff.createMany({
      data: [
        { id: STAFF_MT1, staffCode: "STF-MT-01", nama: "Musyrif Tahfizh 1", roleStaff: "MT", status: "AKTIF", noHp: "0811111111" },
        { id: STAFF_MT2, staffCode: "STF-MT-02", nama: "Musyrif Tahfizh 2", roleStaff: "MT", status: "AKTIF", noHp: "0822222222" },
        { id: STAFF_PH1, staffCode: "STF-PH-01", nama: "Mudhabbir Pengasuhan 1", roleStaff: "PH", status: "AKTIF", noHp: "0844444444" },
        { id: STAFF_KS, staffCode: "STF-KS-01", nama: "K.H. Mudir Pesantren", roleStaff: "KS", status: "AKTIF", noHp: "0833333333" },
        { id: STAFF_ADM1, staffCode: "STF-ADM-01", nama: "Staf Tata Usaha", roleStaff: "ADM", status: "AKTIF", noHp: "0855555555" },
      ],
    });

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        { id: sessionKS.userId, username: sessionKS.username, role: "KS", staffId: STAFF_KS, passwordHash: "dummy" },
        { id: sessionADM.userId, username: sessionADM.username, role: "ADM", passwordHash: "dummy" },
        { id: sessionMT.userId, username: sessionMT.username, role: "MT", staffId: STAFF_MT1, passwordHash: "dummy" },
        { id: sessionPH.userId, username: sessionPH.username, role: "PH", passwordHash: "dummy" },
        { id: sessionMK.userId, username: sessionMK.username, role: "MK", passwordHash: "dummy" },
      ],
    });

    // 3. Seed Halaqoh
    await prisma.halaqoh.createMany({
      data: [
        { id: HALAQOH_1, halaqohCode: "HLQ-0001", nama: "Halaqoh Abu Bakar", pembinaId: STAFF_MT1, tahunAjaran: "2024/2025" },
        { id: HALAQOH_2, halaqohCode: "HLQ-0002", nama: "Halaqoh Umar", pembinaId: STAFF_MT2, tahunAjaran: "2024/2025" },
      ],
    });

    // 4. Seed Santri
    await prisma.santri.create({
      data: {
        id: SANTRI_1,
        nis: "SAN-HLQ-001",
        nama: "Santri Pindah Halaqoh",
        halaqohId: HALAQOH_1,
        status: "AKTIF",
        jenisKelamin: "L",
        kelas: "7A",
      },
    });
  });

  after(async () => {
    setTestSession(null);
    await stopTestDatabase();
  });

  // =========================================================================
  // 1. createHalaqohAction Guard Tests
  // =========================================================================
  describe("1. createHalaqohAction Security Guards", () => {
    it("menolak jika tidak ada sesi", async () => {
      setTestSession(null);
      const res = await createHalaqohAction({ nama: "Halaqoh Baru", tahunAjaran: "2024/2025" });
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Sesi telah berakhir"));
    });

    it("menolak MT membuat halaqoh baru", async () => {
      setTestSession(sessionMT);
      const res = await createHalaqohAction({ nama: "Halaqoh MT", tahunAjaran: "2024/2025" });
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Akses Ditolak"));
    });

    it("menolak PH dan MK membuat halaqoh baru", async () => {
      setTestSession(sessionPH);
      const resPH = await createHalaqohAction({ nama: "Halaqoh PH", tahunAjaran: "2024/2025" });
      assert.strictEqual(resPH.success, false);
      assert.ok(resPH.message.includes("Akses Ditolak"));

      setTestSession(sessionMK);
      const resMK = await createHalaqohAction({ nama: "Halaqoh MK", tahunAjaran: "2024/2025" });
      assert.strictEqual(resMK.success, false);
      assert.ok(resMK.message.includes("Akses Ditolak"));
    });

    it("mengizinkan KS membuat halaqoh baru", async () => {
      setTestSession(sessionKS);
      const res = await createHalaqohAction({
        nama: "Halaqoh Utsman",
        pembinaId: STAFF_MT1,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(res.success, true);
      assert.ok(res.message.includes("berhasil dibuat"));
    });

    it("mengizinkan ADM membuat halaqoh baru", async () => {
      setTestSession(sessionADM);
      const res = await createHalaqohAction({
        nama: "Halaqoh Ali",
        pembinaId: STAFF_MT2,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(res.success, true);
      assert.ok(res.message.includes("berhasil dibuat"));
    });

    it("menolak pembuatan halaqoh dengan pembina dari role staf tidak memenuhi syarat (KS, ADM)", async () => {
      setTestSession(sessionKS);
      const resKS = await createHalaqohAction({
        nama: "Halaqoh KS Pembina",
        pembinaId: STAFF_KS,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(resKS.success, false);
      assert.ok(resKS.message.includes("tidak memenuhi syarat"));

      const resADM = await createHalaqohAction({
        nama: "Halaqoh ADM Pembina",
        pembinaId: STAFF_ADM1,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(resADM.success, false);
      assert.ok(resADM.message.includes("tidak memenuhi syarat"));
    });
  });

  // =========================================================================
  // 2. assignPembinaHalaqohAction Guard Tests
  // =========================================================================
  describe("2. assignPembinaHalaqohAction Security Guards", () => {
    it("menolak MT mengubah penugasan pembina halaqoh", async () => {
      setTestSession(sessionMT);
      const res = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_MT2);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Akses Ditolak"));
    });

    it("menolak PH mengubah penugasan pembina halaqoh", async () => {
      setTestSession(sessionPH);
      const res = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_MT2);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Akses Ditolak"));
    });

    it("mengizinkan KS menugaskan pembina halaqoh", async () => {
      setTestSession(sessionKS);
      const res = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_MT2);
      assert.strictEqual(res.success, true);
      assert.ok(res.message.includes("berhasil diperbarui"));

      const h1 = await prisma.halaqoh.findUnique({ where: { id: HALAQOH_1 } });
      assert.strictEqual(h1?.pembinaId, STAFF_MT2);
    });

    it("mengizinkan ADM menugaskan pembina halaqoh", async () => {
      setTestSession(sessionADM);
      const res = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_MT1);
      assert.strictEqual(res.success, true);
      assert.ok(res.message.includes("berhasil diperbarui"));

      const h1 = await prisma.halaqoh.findUnique({ where: { id: HALAQOH_1 } });
      assert.strictEqual(h1?.pembinaId, STAFF_MT1);
    });

    it("menolak penugasan pembina halaqoh dari role staf tidak memenuhi syarat (KS, ADM)", async () => {
      setTestSession(sessionKS);
      const resKS = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_KS);
      assert.strictEqual(resKS.success, false);
      assert.ok(resKS.message.includes("tidak memenuhi syarat"));

      const resADM = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_ADM1);
      assert.strictEqual(resADM.success, false);
      assert.ok(resADM.message.includes("tidak memenuhi syarat"));
    });
  });

  // =========================================================================
  // 3. pindahkanSantriHalaqohAction Guard Tests
  // =========================================================================
  describe("3. pindahkanSantriHalaqohAction Security Guards", () => {
    it("menolak MT memindahkan santri antar-halaqoh", async () => {
      setTestSession(sessionMT);
      const res = await pindahkanSantriHalaqohAction(SANTRI_1, HALAQOH_2);
      assert.strictEqual(res.success, false);
      assert.ok(res.message.includes("Akses Ditolak"));
    });

    it("mengizinkan KS memindahkan santri antar-halaqoh", async () => {
      setTestSession(sessionKS);
      const res = await pindahkanSantriHalaqohAction(SANTRI_1, HALAQOH_2);
      assert.strictEqual(res.success, true);
      assert.ok(res.message.includes("berhasil dipindahkan"));

      const santri = await prisma.santri.findUnique({ where: { id: SANTRI_1 } });
      assert.strictEqual(santri?.halaqohId, HALAQOH_2);
    });

    it("mengizinkan ADM memindahkan santri kembali ke halaqoh asal", async () => {
      setTestSession(sessionADM);
      const res = await pindahkanSantriHalaqohAction(SANTRI_1, HALAQOH_1);
      assert.strictEqual(res.success, true);
      assert.ok(res.message.includes("berhasil dipindahkan"));

      const santri = await prisma.santri.findUnique({ where: { id: SANTRI_1 } });
      assert.strictEqual(santri?.halaqohId, HALAQOH_1);
    });
  });

  // =========================================================================
  // 4. getAssignableStaffAction Guard Tests
  // =========================================================================
  describe("4. getAssignableStaffAction RBAC Protection", () => {
    it("menolak jika tidak ada sesi (data kosong)", async () => {
      setTestSession(null);
      const res = await getAssignableStaffAction();
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.data, []);
    });

    it("menolak MT mengambil daftar staf penugasan (fail closed)", async () => {
      setTestSession(sessionMT);
      const res = await getAssignableStaffAction();
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.data, []);
      assert.ok(res.message.includes("Akses Ditolak"));
    });

    it("menolak PH dan MK mengambil daftar staf penugasan", async () => {
      setTestSession(sessionPH);
      const resPH = await getAssignableStaffAction();
      assert.strictEqual(resPH.success, false);
      assert.deepStrictEqual(resPH.data, []);

      setTestSession(sessionMK);
      const resMK = await getAssignableStaffAction();
      assert.strictEqual(resMK.success, false);
      assert.deepStrictEqual(resMK.data, []);
    });

    it("mengizinkan KS dan ADM mengambil daftar staf penugasan lengkap yang eligible (hanya MT dan PH)", async () => {
      setTestSession(sessionKS);
      const resKS = await getAssignableStaffAction();
      assert.strictEqual(resKS.success, true);
      assert.ok(resKS.data.length >= 3);
      assert.ok(resKS.data.every((s) => s.id && s.staffCode && s.nama && s.status === "AKTIF"));
      // Memastikan hanya staf dengan role MT atau PH yang eligible
      assert.ok(resKS.data.every((s) => s.roleStaff === "MT" || s.roleStaff === "PH"));
      assert.ok(!resKS.data.some((s) => s.id === STAFF_KS || s.id === STAFF_ADM1));
      assert.ok(resKS.data.some((s) => s.id === STAFF_MT1));
      assert.ok(resKS.data.some((s) => s.id === STAFF_PH1));

      setTestSession(sessionADM);
      const resADM = await getAssignableStaffAction();
      assert.strictEqual(resADM.success, true);
      assert.ok(resADM.data.length >= 3);
      assert.ok(resADM.data.every((s) => s.roleStaff === "MT" || s.roleStaff === "PH"));
      assert.ok(!resADM.data.some((s) => s.id === STAFF_KS || s.id === STAFF_ADM1));
    });
  });
});
