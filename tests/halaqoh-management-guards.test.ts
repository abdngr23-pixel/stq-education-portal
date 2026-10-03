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

describe("P0 RBAC & ABAC Enclosure: Halaqoh Management Actions (Canonical Scope Lock)", () => {
  let prisma: PrismaClient;

  const STAFF_MT1 = "stf-hlq-mt1";
  const STAFF_MT2 = "stf-hlq-mt2";
  const STAFF_KS = "stf-hlq-ks";
  const STAFF_PH1 = "stf-hlq-ph1";
  const STAFF_ADM1 = "stf-hlq-adm1";
  const STAFF_INAKTIF = "stf-hlq-inaktif";

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
    staffId: STAFF_PH1,
  };

  const sessionMK: UserSession = {
    userId: "usr-hlq-mk",
    username: "musyrif.keasramaan",
    name: "Ust. Keasramaan",
    role: "MK",
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staf Musyrif Tahfizh & Pengasuhan
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_MT1,
          staffCode: "STF-MT-01",
          nama: "Ustadz Zaid Tahfizh",
          noHp: "0811111111",
          roleStaff: "MT",
          status: "AKTIF",
        },
        {
          id: STAFF_MT2,
          staffCode: "STF-MT-02",
          nama: "Ustadz Umar Tahfizh",
          noHp: "0811111112",
          roleStaff: "MT",
          status: "AKTIF",
        },
        {
          id: STAFF_PH1,
          staffCode: "STF-PH-01",
          nama: "Ustadz Ali Pengasuhan",
          noHp: "0811111113",
          roleStaff: "PH",
          status: "AKTIF",
        },
        {
          id: STAFF_KS,
          staffCode: "STF-KS-01",
          nama: "Kiai Mudir STQ",
          noHp: "0811111114",
          roleStaff: "KS",
          status: "AKTIF",
        },
        {
          id: STAFF_ADM1,
          staffCode: "STF-ADM-01",
          nama: "Staf Tata Usaha",
          noHp: "0811111115",
          roleStaff: "ADM",
          status: "AKTIF",
        },
        {
          id: STAFF_INAKTIF,
          staffCode: "STF-OFF-01",
          nama: "Staf Nonaktif",
          noHp: "0811111116",
          roleStaff: "MT",
          status: "NONAKTIF",
        },
      ],
    });

    // 2. Halaqoh Awal
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_1,
          halaqohCode: "HLQ-0001",
          nama: "Halaqoh Al-Fatihah",
          pembinaId: STAFF_MT1,
          tahunAjaran: "2024/2025",
          status: "AKTIF",
        },
        {
          id: HALAQOH_2,
          halaqohCode: "HLQ-0002",
          nama: "Halaqoh Al-Baqarah",
          pembinaId: STAFF_MT2,
          tahunAjaran: "2024/2025",
          status: "AKTIF",
        },
      ],
    });

    // 3. Santri
    await prisma.santri.create({
      data: {
        id: SANTRI_1,
        nis: "SAN-HLQ-01",
        nama: "Abdullah Santri Uji",
        kelas: "7A",
        jenisKelamin: "L",
        halaqohId: HALAQOH_1,
        status: "AKTIF",
      },
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  // =========================================================================
  // 1. createHalaqohAction Guard Tests (POST_LAUNCH_LOCKED)
  // =========================================================================
  describe("1. createHalaqohAction Security Guards (Post-Launch Locked)", () => {
    it("menolak pembuatan halaqoh baru pada Day-1 launch untuk semua peran (zero DB delta)", async () => {
      const initialCount = await prisma.halaqoh.count();

      // Test KS
      setTestSession(sessionKS);
      const resKS = await createHalaqohAction({
        nama: "Halaqoh Baru KS",
        pembinaId: STAFF_MT1,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(resKS.success, false);
      assert.strictEqual(resKS.errorCode, "POLICY_NOT_ACTIVE");
      assert.match(resKS.message, /belum diaktifkan|Post-Launch Locked/i);

      // Test ADM
      setTestSession(sessionADM);
      const resADM = await createHalaqohAction({
        nama: "Halaqoh Baru ADM",
        pembinaId: STAFF_MT1,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(resADM.success, false);
      assert.strictEqual(resADM.errorCode, "POLICY_NOT_ACTIVE");

      // Test MT
      setTestSession(sessionMT);
      const resMT = await createHalaqohAction({
        nama: "Halaqoh Baru MT",
        pembinaId: STAFF_MT1,
        tahunAjaran: "2024/2025",
      });
      assert.strictEqual(resMT.success, false);
      assert.strictEqual(resMT.errorCode, "POLICY_NOT_ACTIVE");

      const postCount = await prisma.halaqoh.count();
      assert.strictEqual(postCount, initialCount, "Zero DB delta: Halaqoh tidak bertambah");
    });
  });

  // =========================================================================
  // 2. assignPembinaHalaqohAction Guard Tests (POST_LAUNCH_LOCKED)
  // =========================================================================
  describe("2. assignPembinaHalaqohAction Security Guards (Post-Launch Locked)", () => {
    it("menolak penugasan pembina halaqoh pada Day-1 launch untuk semua peran (zero DB delta)", async () => {
      const halaqohBefore = await prisma.halaqoh.findUnique({ where: { id: HALAQOH_1 } });

      setTestSession(sessionKS);
      const resKS = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_MT2);
      assert.strictEqual(resKS.success, false);
      assert.strictEqual(resKS.errorCode, "POLICY_NOT_ACTIVE");
      assert.match(resKS.message, /belum diaktifkan|Post-Launch Locked/i);

      setTestSession(sessionADM);
      const resADM = await assignPembinaHalaqohAction(HALAQOH_1, STAFF_MT2);
      assert.strictEqual(resADM.success, false);
      assert.strictEqual(resADM.errorCode, "POLICY_NOT_ACTIVE");

      const halaqohAfter = await prisma.halaqoh.findUnique({ where: { id: HALAQOH_1 } });
      assert.strictEqual(halaqohAfter?.pembinaId, halaqohBefore?.pembinaId, "Zero DB delta: Pembina tidak berubah");
    });
  });

  // =========================================================================
  // 3. pindahkanSantriHalaqohAction Guard Tests (POST_LAUNCH_LOCKED)
  // =========================================================================
  describe("3. pindahkanSantriHalaqohAction Security Guards (Post-Launch Locked)", () => {
    it("menolak pemindahan santri halaqoh pada Day-1 launch untuk semua peran (zero DB delta)", async () => {
      const santriBefore = await prisma.santri.findUnique({ where: { id: SANTRI_1 } });

      setTestSession(sessionKS);
      const resKS = await pindahkanSantriHalaqohAction(SANTRI_1, HALAQOH_2);
      assert.strictEqual(resKS.success, false);
      assert.strictEqual(resKS.errorCode, "POLICY_NOT_ACTIVE");
      assert.match(resKS.message, /belum diaktifkan|Post-Launch Locked/i);

      setTestSession(sessionADM);
      const resADM = await pindahkanSantriHalaqohAction(SANTRI_1, HALAQOH_2);
      assert.strictEqual(resADM.success, false);
      assert.strictEqual(resADM.errorCode, "POLICY_NOT_ACTIVE");

      const santriAfter = await prisma.santri.findUnique({ where: { id: SANTRI_1 } });
      assert.strictEqual(santriAfter?.halaqohId, santriBefore?.halaqohId, "Zero DB delta: Santri tidak berpindah halaqoh");
    });
  });

  // =========================================================================
  // 4. getAssignableStaffAction Guard Tests (ACTIVE READ QUERY)
  // =========================================================================
  describe("4. getAssignableStaffAction RBAC Protection (Read Query)", () => {
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
