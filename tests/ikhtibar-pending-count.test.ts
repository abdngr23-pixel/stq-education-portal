// Test Verifikasi Penghitungan Antrean Ikhtibar Riil Berbasis ABAC Fail-Closed
// Memenuhi P0 Koreksi Final:
// 1. Tidak ada antrean menghasilkan 0
// 2. Satu pengajuan menghasilkan 1
// 3. Pengajuan halaqoh lain tidak dihitung untuk MT
// 4. Ujian selesai (LULUS_SEMPURNA_TAHAP_2) tidak dihitung
// 5. Akun MT tanpa relasi staff/halaqoh memperoleh 0 secara fail-closed

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, StatusIkhtibar } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { getIkhtibarPendingCountAction } from "../app/actions/ikhtibar";
import { UserSession } from "../types/auth";

describe("P0 - Penghitungan Antrean Ikhtibar Riil Berbasis ABAC Fail-Closed", () => {
  let prisma: PrismaClient;

  const STAFF_MT_ID = "staff-mt-ikhtibar-01";
  const HALAQOH_MT_ID = "hlq-mt-ikhtibar-01";
  const SANTRI_MT_1_ID = "santri-mt-01";
  const SANTRI_MT_2_ID = "santri-mt-02";

  const STAFF_OTHER_ID = "staff-other-ikhtibar-02";
  const HALAQOH_OTHER_ID = "hlq-other-ikhtibar-02";
  const SANTRI_OTHER_ID = "santri-other-01";

  const sessionMT: UserSession = {
    userId: "usr-mt-test",
    username: "musyrif.tahfizh",
    role: "MT",
    staffId: STAFF_MT_ID,
    staffCode: "STF-MT-01",
    name: "Ust. Musyrif Tahfizh",
    halaqohName: "Halaqoh Utsman",
    isKepalaBidangTahfidz: false,
    isPetugasPresensiPutri: false,
  };

  const sessionMTNoStaff: UserSession = {
    userId: "usr-mt-nostaff",
    username: "musyrif.nostaff",
    role: "MT",
    name: "Musyrif Tanpa Staff",
    isKepalaBidangTahfidz: false,
    isPetugasPresensiPutri: false,
  };

  const sessionMTNoHalaqoh: UserSession = {
    userId: "usr-mt-nohlq",
    username: "musyrif.nohlq",
    role: "MT",
    staffId: "staff-isolated-nohlq",
    name: "Musyrif Tanpa Halaqoh",
    isKepalaBidangTahfidz: false,
    isPetugasPresensiPutri: false,
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Buat Staff MT utama & Staff Lain
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_MT_ID,
          staffCode: "STF-MT-01",
          nama: "Ust. Musyrif Tahfizh",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08111111111",
        },
        {
          id: STAFF_OTHER_ID,
          staffCode: "STF-OTHER-02",
          nama: "Ust. Halaqoh Lain",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08222222222",
        },
        {
          id: "staff-isolated-nohlq",
          staffCode: "STF-NOHLQ-03",
          nama: "Ust. Tanpa Halaqoh",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08333333333",
        },
      ],
    });

    // 2. Buat Halaqoh MT utama & Halaqoh Lain
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_MT_ID,
          halaqohCode: "HLQ-MT-01",
          nama: "Halaqoh Utsman",
          pembinaId: STAFF_MT_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_OTHER_ID,
          halaqohCode: "HLQ-OTHER-02",
          nama: "Halaqoh Ali",
          pembinaId: STAFF_OTHER_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
      ],
    });

    // 3. Buat Santri
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_MT_1_ID,
          nis: "ST-MT-001",
          nama: "Santri MT 1",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_MT_ID,
          status: "AKTIF",
        },
        {
          id: SANTRI_MT_2_ID,
          nis: "ST-MT-002",
          nama: "Santri MT 2",
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: HALAQOH_MT_ID,
          status: "AKTIF",
        },
        {
          id: SANTRI_OTHER_ID,
          nis: "ST-OTH-001",
          nama: "Santri Halaqoh Lain",
          kelas: "7B",
          jenisKelamin: "L",
          halaqohId: HALAQOH_OTHER_ID,
          status: "AKTIF",
        },
      ],
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. tidak ada antrean menghasilkan 0", async () => {
    const res = await getIkhtibarPendingCountAction(sessionMT);
    assert.equal(res.success, true);
    assert.equal(res.count, 0);
  });

  it("2. satu pengajuan menghasilkan 1", async () => {
    const item = await prisma.ikhtibarTahfizh.create({
      data: {
        id: "ikh-01",
        santriId: SANTRI_MT_1_ID,
        juz: 1,
        status: StatusIkhtibar.PENGAJUAN,
      },
    });

    const res = await getIkhtibarPendingCountAction(sessionMT);
    assert.equal(res.success, true);
    assert.equal(res.count, 1);

    // Cleanup
    await prisma.ikhtibarTahfizh.delete({ where: { id: item.id } });
  });

  it("3. pengajuan halaqoh lain tidak dihitung untuk MT", async () => {
    // Buat pengajuan untuk santri halaqoh lain
    const itemOther = await prisma.ikhtibarTahfizh.create({
      data: {
        id: "ikh-other-01",
        santriId: SANTRI_OTHER_ID,
        juz: 1,
        status: StatusIkhtibar.PENGAJUAN,
      },
    });

    const res = await getIkhtibarPendingCountAction(sessionMT);
    assert.equal(res.success, true);
    assert.equal(res.count, 0, "Pengajuan halaqoh lain tidak boleh terhitung untuk akun MT");

    // Cleanup
    await prisma.ikhtibarTahfizh.delete({ where: { id: itemOther.id } });
  });

  it("4. ujian selesai (LULUS_SEMPURNA_TAHAP_2) tidak dihitung", async () => {
    // Buat record ikhtibar selesai
    const itemLulus = await prisma.ikhtibarTahfizh.create({
      data: {
        id: "ikh-lulus-01",
        santriId: SANTRI_MT_1_ID,
        juz: 1,
        status: StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2,
        nilaiTahap1: 95,
        nilaiTahap2: 92,
      },
    });

    const res = await getIkhtibarPendingCountAction(sessionMT);
    assert.equal(res.success, true);
    assert.equal(res.count, 0, "Ujian yang sudah lulus sempurna tidak boleh dihitung sebagai antrean");

    // Cleanup
    await prisma.ikhtibarTahfizh.delete({ where: { id: itemLulus.id } });
  });

  it("5. akun MT tanpa relasi staff/halaqoh memperoleh 0 secara fail-closed", async () => {
    // Tambahkan 1 pengajuan aktif di database
    const item = await prisma.ikhtibarTahfizh.create({
      data: {
        id: "ikh-failclosed-01",
        santriId: SANTRI_MT_1_ID,
        juz: 2,
        status: StatusIkhtibar.PENGAJUAN,
      },
    });

    // Kasus 5a: MT tanpa staffId
    const resNoStaff = await getIkhtibarPendingCountAction(sessionMTNoStaff);
    assert.equal(resNoStaff.success, true);
    assert.equal(resNoStaff.count, 0, "Akun MT tanpa staffId wajib memperoleh 0 secara fail-closed");

    // Kasus 5b: MT dengan staffId tapi belum di-assign ke halaqoh mana pun
    const resNoHalaqoh = await getIkhtibarPendingCountAction(sessionMTNoHalaqoh);
    assert.equal(resNoHalaqoh.success, true);
    assert.equal(resNoHalaqoh.count, 0, "Akun MT tanpa halaqoh binaan wajib memperoleh 0 secara fail-closed");

    // Kasus 5c: MT berwenang melihat antreannya
    const resValid = await getIkhtibarPendingCountAction(sessionMT);
    assert.equal(resValid.success, true);
    assert.equal(resValid.count, 1);

    // Cleanup
    await prisma.ikhtibarTahfizh.delete({ where: { id: item.id } });
  });
});
