(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
if (!React.createContext) {
  React.createContext = () => ({
    Provider: () => null,
    Consumer: () => null,
  });
}

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, JenisKelamin, StatusKesehatan, Role } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession, PERMISSION_MATRIX } from "../types/auth";
import {
  getDaftarKesehatanAction,
  catatKesehatanAction,
  updateStatusKesehatanAction,
} from "../app/actions/kesehatan";

describe("PR #11 Final Health Read Authority Alignment: Global Health Data Access Lock", () => {
  let prisma: PrismaClient;

  const SANTRI_1 = "san-kes-01";
  const SANTRI_2 = "san-kes-02";

  const KES_1 = "kes-rec-01";
  const KES_2 = "kes-rec-02";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Santri records
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_1,
          nis: "SAN-KES-001",
          nama: "Ahmad Santri Sehat",
          kelas: "7A",
          jenisKelamin: JenisKelamin.L,
          namaWali: "Bapak Ahmad",
          noHpWali: "081111111111",
        },
        {
          id: SANTRI_2,
          nis: "SAN-KES-002",
          nama: "Budi Santri Rawat",
          kelas: "8B",
          jenisKelamin: JenisKelamin.L,
          namaWali: "Bapak Budi",
          noHpWali: "082222222222",
        },
      ],
    });

    // 2. CatatanKesehatan records
    await prisma.catatanKesehatan.createMany({
      data: [
        {
          id: KES_1,
          santriId: SANTRI_1,
          keluhan: "Demam ringan 37.8 C",
          diagnosa: "Gejala flu musiman",
          tindakan: "Istirahat dan paracetamol",
          status: StatusKesehatan.RAWAT_PONDOK,
          dicatatOleh: "Petugas Poskestren",
        },
        {
          id: KES_2,
          santriId: SANTRI_2,
          keluhan: "Sakit lambung akut",
          diagnosa: "Dispepsia",
          tindakan: "Rujukan puskesmas",
          status: StatusKesehatan.DIRUJUK_PUSKESMAS,
          dicatatOleh: "Petugas Poskestren",
        },
      ],
    });

    // 3. User records for test sessions
    await prisma.user.createMany({
      data: [
        { id: "usr-kes-ks", username: "mudir.stq", role: "KS", passwordHash: "dummy" },
        { id: "usr-kes-mk", username: "musyrif.keasramaan", role: "MK", passwordHash: "dummy" },
        { id: "usr-kes-adm", username: "admin.tu", role: "ADM", passwordHash: "dummy" },
        { id: "usr-kes-ws1", username: "wali.ahmad", role: "WS", santriId: SANTRI_1, passwordHash: "dummy" },
        { id: "usr-kes-st2", username: "santri.budi", role: "ST", santriId: SANTRI_2, passwordHash: "dummy" },
        { id: "usr-kes-osda", username: "pengurus.osda", role: "OSDA", passwordHash: "dummy" },
        { id: "usr-kes-ks-create", username: "mudir.create", role: "KS", passwordHash: "dummy" },
        { id: "usr-kes-mk-create", username: "mk.create", role: "MK", passwordHash: "dummy" },
        { id: "usr-kes-adm-create", username: "adm.create", role: "ADM", passwordHash: "dummy" },
        { id: "usr-kes-ks-upd", username: "mudir.upd", role: "KS", passwordHash: "dummy" },
        { id: "usr-kes-mk-upd", username: "mk.upd", role: "MK", passwordHash: "dummy" },
        { id: "usr-kes-adm-upd", username: "adm.upd", role: "ADM", passwordHash: "dummy" },
        { id: "usr-kes-osda-upd", username: "osda.upd", role: "OSDA", passwordHash: "dummy" },
      ],
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  it("1. unauthenticated -> DENY: harus menolak akses tanpa sesi dan mengembalikan data []", async () => {
    setTestSession(null);
    const res = await getDaftarKesehatanAction();

    assert.strictEqual(res.success, false);
    assert.match(res.message, /sesi|otentikasi/i);
    assert.deepStrictEqual(res.data, []);
  });

  it("2. KS -> global ALLOW: Mudir (KS) dapat membaca seluruh data kesehatan santri", async () => {
    const sessionKS: UserSession = {
      userId: "usr-kes-ks",
      username: "mudir.stq",
      name: "Mudir Pesantren",
      role: "KS",
    };
    setTestSession(sessionKS);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 2, "KS harus melihat seluruh record kesehatan santri");
  });

  it("3. MK -> global ALLOW: Musyrif Keasramaan (MK) dapat membaca seluruh data kesehatan santri", async () => {
    const sessionMK: UserSession = {
      userId: "usr-kes-mk",
      username: "musyrif.keasramaan",
      name: "Musyrif Keasramaan",
      role: "MK",
    };
    setTestSession(sessionMK);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 2, "MK harus melihat seluruh record kesehatan santri");
  });

  it("4. ADM -> global ALLOW: Admin / TU (ADM) dapat membaca seluruh data kesehatan santri", async () => {
    const sessionADM: UserSession = {
      userId: "usr-kes-adm",
      username: "admin.tu",
      name: "Admin Tata Usaha",
      role: "ADM",
    };
    setTestSession(sessionADM);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 2, "ADM harus melihat seluruh record kesehatan santri");
  });

  it("5. WS linked -> own child only: Wali Santri terhubung hanya dapat membaca data anak sendiri", async () => {
    const sessionWS: UserSession = {
      userId: "usr-kes-ws1",
      username: "wali.ahmad",
      name: "Wali Ahmad",
      role: "WS",
      santriId: SANTRI_1,
    };
    setTestSession(sessionWS);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 1, "WS hanya melihat data anaknya sendiri");
    assert.strictEqual((res.data[0] as { santriId: string }).santriId, SANTRI_1);
  });

  it("6. ST linked -> own self only: Santri terhubung hanya dapat membaca data pribadi", async () => {
    const sessionST: UserSession = {
      userId: "usr-kes-st2",
      username: "santri.budi",
      name: "Santri Budi",
      role: "ST",
      santriId: SANTRI_2,
    };
    setTestSession(sessionST);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 1, "ST hanya melihat data pribadinya");
    assert.strictEqual((res.data[0] as { santriId: string }).santriId, SANTRI_2);
  });

  it("7. WS unlinked -> DENY (fail closed) dan ST unlinked -> DENY (fail closed)", async () => {
    setTestSession({
      userId: "usr-kes-ws-unlinked",
      username: "wali.unlinked",
      name: "Wali Belum Terhubung",
      role: "WS",
      santriId: null,
    });
    const resWS = await getDaftarKesehatanAction();
    assert.strictEqual(resWS.success, false, "WS tanpa santriId harus ditolak fail-closed");
    assert.deepStrictEqual(resWS.data, []);

    setTestSession({
      userId: "usr-kes-st-unlinked",
      username: "santri.unlinked",
      name: "Santri Belum Terhubung",
      role: "ST",
      santriId: null,
    });
    const resST = await getDaftarKesehatanAction();
    assert.strictEqual(resST.success, false, "ST tanpa santriId harus ditolak fail-closed");
    assert.deepStrictEqual(resST.data, []);
  });

  it("8. generic OSDA -> DENY: OSDA tanpa penugasan kanonikal dilarang membaca data kesehatan", async () => {
    const sessionOSDA: UserSession = {
      userId: "usr-kes-osda",
      username: "pengurus.osda",
      name: "Pengurus Santri OSDA",
      role: "OSDA",
    };
    setTestSession(sessionOSDA);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, false, "Generic OSDA harus ditolak");
    assert.match(res.message, /Akses Ditolak|tidak memiliki otorisasi/i);
    assert.deepStrictEqual(res.data, [], "Generic OSDA tidak boleh melihat record santri mana pun");
  });

  const UNAUTHORIZED_ROLES: Role[] = ["MT", "PH", "GA", "YAY"];
  for (const role of UNAUTHORIZED_ROLES) {
    it(`9. ${role} -> DENY: role ${role} tidak memiliki otorisasi membaca data kesehatan`, async () => {
      const session: UserSession = {
        userId: `usr-kes-${role.toLowerCase()}`,
        username: `user.${role.toLowerCase()}`,
        name: `Pengguna ${role}`,
        role: role,
      };
      setTestSession(session);

      const res = await getDaftarKesehatanAction();
      assert.strictEqual(res.success, false, `Role ${role} harus ditolak`);
      assert.match(res.message, /Akses Ditolak|tidak memiliki otorisasi/i);
      assert.deepStrictEqual(res.data, []);
    });
  }

  it("10. PII Sanitization: noHpWali dan namaWali tidak pernah bocor ke client", async () => {
    const sessionKS: UserSession = {
      userId: "usr-kes-ks-pii",
      username: "mudir.pii",
      name: "Mudir Pesantren",
      role: "KS",
    };
    setTestSession(sessionKS);

    const res = await getDaftarKesehatanAction();
    assert.strictEqual(res.success, true);
    for (const item of (res.data as Array<{ santri?: Record<string, unknown> }>)) {
      assert.strictEqual(item.santri?.noHpWali, undefined, "noHpWali tidak boleh ada di payload");
      assert.strictEqual(item.santri?.namaWali, undefined, "namaWali tidak boleh ada di payload");
    }
  });

  it("11. UI/Navigation Enclosure: generic OSDA disembunyikan dari navigasi modul kesehatan", async () => {
    const { ROLE_NAV_MAP, ROLE_MOBILE_PRIMARY } = await import("../types/navigation");
    const osdaNav = ROLE_NAV_MAP.OSDA;
    const osdaMobile = ROLE_MOBILE_PRIMARY.OSDA;

    assert.strictEqual(
      osdaNav.includes("kesehatan"),
      false,
      "ROLE_NAV_MAP.OSDA tidak boleh menyertakan 'kesehatan'"
    );
    assert.strictEqual(
      osdaMobile.includes("kesehatan"),
      false,
      "ROLE_MOBILE_PRIMARY.OSDA tidak boleh menyertakan 'kesehatan'"
    );

    assert.strictEqual(ROLE_NAV_MAP.KS.includes("kesehatan"), true, "KS harus memiliki akses kesehatan");
    assert.strictEqual(ROLE_NAV_MAP.MK.includes("kesehatan"), true, "MK harus memiliki akses kesehatan");
    assert.strictEqual(ROLE_NAV_MAP.ADM.includes("kesehatan"), true, "ADM harus memiliki akses kesehatan");
  });

  it("12. Source Contract Guard: dilarang memperkenalkan isPetugasKesehatan, Mudabbir role alias, atau name heuristic", () => {
    const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    assert.strictEqual(
      schemaContent.includes("isPetugasKesehatan"),
      false,
      "schema.prisma dilarang menambahkan field ad-hoc isPetugasKesehatan"
    );
    assert.strictEqual(
      schemaContent.includes("MUDABBIR"),
      false,
      "schema.prisma dilarang menambahkan enum Role MUDABBIR sebelum STQ Architecture Lock"
    );

    const kesehatanActionPath = path.resolve(__dirname, "../app/actions/kesehatan.ts");
    const actionContent = fs.readFileSync(kesehatanActionPath, "utf-8");
    assert.strictEqual(
      actionContent.includes("isPetugasKesehatan"),
      false,
      "app/actions/kesehatan.ts dilarang menggunakan isPetugasKesehatan"
    );
    assert.strictEqual(
      actionContent.includes("username.includes") || actionContent.includes("username ==="),
      false,
      "app/actions/kesehatan.ts dilarang menggunakan username heuristic"
    );
  });

  it("13. Health Create Authority: KS, MK, ADM create PASS", async () => {
    // 13.1. KS create PASS
    setTestSession({
      userId: "usr-kes-ks-create",
      username: "mudir.create",
      name: "Mudir Pesantren",
      role: "KS",
    });
    const resKS = await catatKesehatanAction({
      santriId: SANTRI_1,
      keluhan: "Batuk pilek KS",
      diagnosa: "ISPA",
      tindakan: "Sirup obat batuk",
      status: StatusKesehatan.RAWAT_PONDOK,
    });
    assert.strictEqual(resKS.success, true, "KS create harus PASS");

    // 13.2. MK create PASS
    setTestSession({
      userId: "usr-kes-mk-create",
      username: "mk.create",
      name: "Musyrif Keasramaan",
      role: "MK",
    });
    const resMK = await catatKesehatanAction({
      santriId: SANTRI_1,
      keluhan: "Sakit kepala MK",
      diagnosa: "Cephalgia",
      tindakan: "Paracetamol",
      status: StatusKesehatan.RAWAT_PONDOK,
    });
    assert.strictEqual(resMK.success, true, "MK create harus PASS");

    // 13.3. ADM create PASS
    setTestSession({
      userId: "usr-kes-adm-create",
      username: "adm.create",
      name: "Admin Tata Usaha",
      role: "ADM",
    });
    const resADM = await catatKesehatanAction({
      santriId: SANTRI_2,
      keluhan: "Alergi gatal ADM",
      diagnosa: "Urtikaria",
      tindakan: "Antihistamin",
      status: StatusKesehatan.RAWAT_PONDOK,
    });
    assert.strictEqual(resADM.success, true, "ADM create harus PASS");
  });

  it("14. Health Update Status Authority: KS update PASS, MK update PASS, ADM update DENY, generic OSDA update DENY", async () => {
    // 14.1. KS update PASS
    setTestSession({
      userId: "usr-kes-ks-upd",
      username: "mudir.upd",
      name: "Mudir Pesantren",
      role: "KS",
    });
    const resKS = await updateStatusKesehatanAction({
      id: KES_1,
      status: StatusKesehatan.RAWAT_PONDOK,
      tindakanTambahan: "Observasi lanjutan oleh Mudir",
    });
    assert.strictEqual(resKS.success, true, "KS update harus PASS");

    // 14.2. MK update PASS
    setTestSession({
      userId: "usr-kes-mk-upd",
      username: "mk.upd",
      name: "Musyrif Keasramaan",
      role: "MK",
    });
    const resMK = await updateStatusKesehatanAction({
      id: KES_1,
      status: StatusKesehatan.SEMBUH,
      tindakanTambahan: "Sembuh total diverifikasi MK",
    });
    assert.strictEqual(resMK.success, true, "MK update harus PASS");

    // 14.3. ADM update DENY
    setTestSession({
      userId: "usr-kes-adm-upd",
      username: "adm.upd",
      name: "Admin Tata Usaha",
      role: "ADM",
    });
    const resADM = await updateStatusKesehatanAction({
      id: KES_1,
      status: StatusKesehatan.DIRUJUK_PUSKESMAS,
      tindakanTambahan: "Upaya update dari ADM",
    });
    assert.strictEqual(resADM.success, false, "ADM update harus DENY");
    assert.match(resADM.message, /FORBIDDEN|tidak memiliki akses|akses ditolak|tidak memiliki wewenang|otorisasi/i);

    // 14.4. generic OSDA update DENY
    setTestSession({
      userId: "usr-kes-osda-upd",
      username: "osda.upd",
      name: "Pengurus OSDA",
      role: "OSDA",
    });
    const resOSDA = await updateStatusKesehatanAction({
      id: KES_1,
      status: StatusKesehatan.SEMBUH,
      tindakanTambahan: "Upaya update dari generic OSDA",
    });
    assert.strictEqual(resOSDA.success, false, "generic OSDA update harus DENY");
    assert.match(resOSDA.message, /FORBIDDEN|tidak memiliki akses|akses ditolak|tidak memiliki wewenang|otorisasi/i);
  });

  it("15. UI / Component Guards: generic OSDA update UI absent, ADM update UI absent, KS/MK update UI present", () => {
    const componentPath = path.resolve(__dirname, "../components/modules/kesehatan-module.tsx");
    const componentContent = fs.readFileSync(componentPath, "utf-8");

    // 15.1. Update Status UI is guarded strictly by ["MK", "KS"].includes(userRole)
    assert.strictEqual(
      componentContent.includes('["MK", "KS"].includes(userRole)'),
      true,
      "Update status UI harus dijaga strictly dengan ['MK', 'KS'].includes(userRole)"
    );

    // 15.2. Generic OSDA and ADM are not in the Update Status UI guard
    assert.strictEqual(
      componentContent.includes('["MK", "OSDA", "KS"].includes(userRole)'),
      false,
      "Generic OSDA dilarang ada di guard update status UI"
    );

    // 15.3. Generic OSDA detail controls absent
    assert.strictEqual(
      componentContent.includes('selectedDetail && userRole !== "OSDA"'),
      true,
      "Generic OSDA tidak boleh menerima detail dialog / controls"
    );
    assert.strictEqual(
      componentContent.includes('if (userRole === "OSDA") return;'),
      true,
      "Generic OSDA row click harus no-op"
    );

    // 15.4. handleUpdateStatus client-side guard
    assert.strictEqual(
      componentContent.includes('if (!["MK", "KS"].includes(userRole))'),
      true,
      "handleUpdateStatus harus memiliki guard client-side untuk KS dan MK saja"
    );
  });

  it("16. Legacy Coarse PERMISSION_MATRIX Guard: ADM does not falsely claim unrestricted CRUD", () => {
    // Coarse matrix cannot represent READ + CREATE without UPDATE without inventing a new level.
    // Therefore ADM must NOT be "CRUD", and server actions remain authoritative.
    assert.notStrictEqual(
      PERMISSION_MATRIX.kesehatan.ADM,
      "CRUD",
      "PERMISSION_MATRIX.kesehatan.ADM dilarang bernilai CRUD"
    );
    assert.strictEqual(
      PERMISSION_MATRIX.kesehatan.ADM,
      "READ",
      "PERMISSION_MATRIX.kesehatan.ADM harus bernilai READ (transisional/non-authoritative)"
    );
    assert.strictEqual(
      PERMISSION_MATRIX.kesehatan.KS,
      "CRUD",
      "PERMISSION_MATRIX.kesehatan.KS harus bernilai CRUD"
    );
    assert.strictEqual(
      PERMISSION_MATRIX.kesehatan.MK,
      "CRUD",
      "PERMISSION_MATRIX.kesehatan.MK harus bernilai CRUD"
    );
  });
});
