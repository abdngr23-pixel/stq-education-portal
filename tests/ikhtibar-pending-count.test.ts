(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, StatusIkhtibar } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { getIkhtibarPendingCountForSession } from "../lib/server/ikhtibar-pending-service";
import { UserSession } from "../types/auth";

describe("P0 - Penghitungan Antrean Ikhtibar Riil Berbasis ABAC Fail-Closed (All Roles)", () => {
  let prisma: PrismaClient;

  const STAFF_MT_ID = "staff-mt-ikhtibar-01";
  const STAFF_PH_ID = "staff-ph-ikhtibar-02";
  const STAFF_OTHER_ID = "staff-other-ikhtibar-03";

  const HALAQOH_MT_ID = "hlq-mt-ikhtibar-01";
  const HALAQOH_PH_ID = "hlq-ph-ikhtibar-02";
  const HALAQOH_OTHER_ID = "hlq-other-ikhtibar-03";

  const SANTRI_MT_ID = "santri-mt-01";
  const SANTRI_PH_ID = "santri-ph-01";
  const SANTRI_OTHER_ID = "santri-other-01";

  // Sesi Uji
  const sessionMT: UserSession = {
    userId: "usr-mt-test",
    username: "musyrif.tahfizh",
    role: "MT",
    staffId: STAFF_MT_ID,
    name: "Ust. MT Biasa",
    isKepalaBidangTahfidz: false,
  };

  const sessionMTKabid: UserSession = {
    userId: "usr-mt-kabid",
    username: "kabid.tahfidz",
    role: "MT",
    staffId: STAFF_MT_ID,
    name: "Ust. MT Kabid",
    isKepalaBidangTahfidz: true,
  };

  const sessionPH: UserSession = {
    userId: "usr-ph-test",
    username: "pengasuh.halaqoh",
    role: "PH",
    staffId: STAFF_PH_ID,
    name: "Ust. PH",
  };

  const sessionPHNoStaff: UserSession = {
    userId: "usr-ph-nostaff",
    username: "ph.nostaff",
    role: "PH",
    staffId: undefined,
    name: "PH Tanpa Staff",
  };

  const sessionKS: UserSession = {
    userId: "usr-ks-test",
    username: "mudir.stq",
    role: "KS",
    staffId: "staff-ks-01",
    name: "K.H. Mudir STQ",
  };

  const sessionADM: UserSession = {
    userId: "usr-adm-test",
    username: "admin.stq",
    role: "ADM",
    name: "Admin STQ",
  };

  const sessionST: UserSession = {
    userId: "usr-st-test",
    username: "santri.st",
    role: "ST",
    santriId: SANTRI_MT_ID,
    name: "Santri MT 1",
  };

  const sessionWS: UserSession = {
    userId: "usr-ws-test",
    username: "wali.santri",
    role: "WS",
    santriId: SANTRI_PH_ID,
    name: "Wali Santri PH",
  };

  const sessionSTNoSantri: UserSession = {
    userId: "usr-st-nosantri",
    username: "santri.nosantri",
    role: "ST",
    santriId: undefined,
    name: "Santri Unlinked",
  };

  const sessionWSNoSantri: UserSession = {
    userId: "usr-ws-nosantri",
    username: "wali.nosantri",
    role: "WS",
    santriId: undefined,
    name: "Wali Unlinked",
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staff
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_MT_ID,
          staffCode: "STF-MT-01",
          nama: "Ust. MT Biasa",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08111111111",
        },
        {
          id: STAFF_PH_ID,
          staffCode: "STF-PH-02",
          nama: "Ust. PH",
          roleStaff: "PH",
          status: "AKTIF",
          noHp: "08222222222",
        },
        {
          id: STAFF_OTHER_ID,
          staffCode: "STF-OTH-03",
          nama: "Ust. Halaqoh Lain",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08333333333",
        },
        {
          id: "staff-ks-01",
          staffCode: "STF-KS-01",
          nama: "K.H. Mudir STQ",
          roleStaff: "KS",
          status: "AKTIF",
          noHp: "08444444444",
        },
      ],
    });

    // 2. Halaqoh
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_MT_ID,
          halaqohCode: "HLQ-MT-01",
          nama: "Halaqoh Utsman (MT)",
          pembinaId: STAFF_MT_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_PH_ID,
          halaqohCode: "HLQ-PH-02",
          nama: "Halaqoh Umar (PH)",
          pembinaId: STAFF_PH_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_OTHER_ID,
          halaqohCode: "HLQ-OTH-03",
          nama: "Halaqoh Ali (Lain)",
          pembinaId: STAFF_OTHER_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
      ],
    });

    // 3. Santri
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_MT_ID,
          nis: "ST-MT-001",
          nama: "Santri MT",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_MT_ID,
          status: "AKTIF",
        },
        {
          id: SANTRI_PH_ID,
          nis: "ST-PH-001",
          nama: "Santri PH",
          kelas: "7B",
          jenisKelamin: "L",
          halaqohId: HALAQOH_PH_ID,
          status: "AKTIF",
        },
        {
          id: SANTRI_OTHER_ID,
          nis: "ST-OTH-001",
          nama: "Santri Lain",
          kelas: "8A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_OTHER_ID,
          status: "AKTIF",
        },
      ],
    });

    // 4. Buat 1 pengajuan aktif per santri (Total 3 pengajuan aktif di pesantren)
    await prisma.ikhtibarTahfizh.createMany({
      data: [
        {
          id: "ikh-mt-active",
          santriId: SANTRI_MT_ID,
          juz: 1,
          status: StatusIkhtibar.PENGAJUAN,
        },
        {
          id: "ikh-ph-active",
          santriId: SANTRI_PH_ID,
          juz: 2,
          status: StatusIkhtibar.LULUS_TAHAP_1,
        },
        {
          id: "ikh-other-active",
          santriId: SANTRI_OTHER_ID,
          juz: 3,
          status: StatusIkhtibar.MENGULANG_SEBAGIAN,
        },
      ],
    });

    // 5. Buat 1 ikhtibar selesai (LULUS_SEMPURNA_TAHAP_2) untuk Santri MT
    await prisma.ikhtibarTahfizh.create({
      data: {
        id: "ikh-mt-completed",
        santriId: SANTRI_MT_ID,
        juz: 30,
        status: StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2,
        nilaiTahap1: 95,
        nilaiTahap2: 95,
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. PH hanya menghitung santri dalam halaqoh binaannya", async () => {
    const res = await getIkhtibarPendingCountForSession(sessionPH, prisma);
    assert.equal(res.success, true);
    assert.equal(res.count, 1, "PH hanya boleh menghitung 1 antrean milik halaqoh binaannya");
  });

  it("2. PH tidak menghitung antrean halaqoh lain", async () => {
    const res = await getIkhtibarPendingCountForSession(sessionPH, prisma);
    assert.equal(res.success, true);
    // Di pesantren ada 3 antrean aktif total, PH hanya mendapat 1
    assert.notEqual(res.count, 3, "PH tidak boleh melihat seluruh antrean pesantren");
  });

  it("3. PH tanpa staffId memperoleh 0 secara fail-closed", async () => {
    const res = await getIkhtibarPendingCountForSession(sessionPHNoStaff, prisma);
    assert.equal(res.success, true);
    assert.equal(res.count, 0, "PH tanpa staffId wajib fail-closed ke 0");
  });

  it("4. MT biasa hanya menghitung antrean halaqohnya", async () => {
    const res = await getIkhtibarPendingCountForSession(sessionMT, prisma);
    assert.equal(res.success, true);
    assert.equal(res.count, 1, "MT biasa hanya boleh menghitung 1 antrean milik halaqohnya");
  });

  it("5. MT Kepala Bidang menghitung seluruh halaqoh (global)", async () => {
    const res = await getIkhtibarPendingCountForSession(sessionMTKabid, prisma);
    assert.equal(res.success, true);
    assert.equal(res.count, 3, "MT Kepala Bidang Tahfidz berwenang melihat total 3 antrean aktif pesantren");
  });

  it("6. KS dan ADM menghitung seluruh halaqoh (global)", async () => {
    const resKS = await getIkhtibarPendingCountForSession(sessionKS, prisma);
    assert.equal(resKS.success, true);
    assert.equal(resKS.count, 3, "KS Mudir berwenang melihat total 3 antrean aktif pesantren");

    const resADM = await getIkhtibarPendingCountForSession(sessionADM, prisma);
    assert.equal(resADM.success, true);
    assert.equal(resADM.count, 3, "Administrator berwenang melihat total 3 antrean aktif pesantren");
  });

  it("7. ST dan WS hanya menghitung antrean santri terkait", async () => {
    const resST = await getIkhtibarPendingCountForSession(sessionST, prisma);
    assert.equal(resST.success, true);
    assert.equal(resST.count, 1, "Santri mandiri hanya melihat antrean miliknya");

    const resWS = await getIkhtibarPendingCountForSession(sessionWS, prisma);
    assert.equal(resWS.success, true);
    assert.equal(resWS.count, 1, "Wali santri hanya melihat antrean santri binaannya");
  });

  it("8. ST dan WS tanpa santriId memperoleh 0 secara fail-closed", async () => {
    const resST = await getIkhtibarPendingCountForSession(sessionSTNoSantri, prisma);
    assert.equal(resST.success, true);
    assert.equal(resST.count, 0, "ST tanpa santriId wajib fail-closed ke 0");

    const resWS = await getIkhtibarPendingCountForSession(sessionWSNoSantri, prisma);
    assert.equal(resWS.success, true);
    assert.equal(resWS.count, 0, "WS tanpa santriId wajib fail-closed ke 0");
  });

  it("9. Status selesai LULUS_SEMPURNA_TAHAP_2 tidak dihitung sebagai antrean", async () => {
    // Santri MT memiliki 1 pengajuan aktif (ikh-mt-active) dan 1 selesai (ikh-mt-completed)
    // Jika selesai ikut terhitung, count akan bernilai 2. Karena diabaikan, count tetap 1.
    const res = await getIkhtibarPendingCountForSession(sessionMT, prisma);
    assert.equal(res.success, true);
    assert.equal(res.count, 1, "Status LULUS_SEMPURNA_TAHAP_2 tidak boleh dihitung sebagai antrean");
  });
});
