(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, StatusIkhtibar } from "@prisma/client";
import {
  startTestDatabase,
  stopTestDatabase,
} from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  ajukanIkhtibarAction,
  inputHasilTahap1Action,
  inputHasilTahap2Action,
  getDaftarIkhtibarAction,
} from "../app/actions/ikhtibar";

describe("P1 Audit Keamanan ABAC Ikhtibar (Multi-Role & Cross-Halaqoh Isolation)", () => {
  let prisma: PrismaClient;

  const STAFF_MT1 = "staff-mt-01";
  const STAFF_MT2 = "staff-mt-02";
  const STAFF_KS = "staff-ks-01";

  const HALAQOH_1 = "halaqoh-abac-01";
  const HALAQOH_2 = "halaqoh-abac-02";

  const SANTRI_H1 = "santri-abac-h1";
  const SANTRI_H2 = "santri-abac-h2";

  const sessionMT1: UserSession = {
    userId: "user-mt1",
    username: "musyrif.one",
    name: "Musyrif Satu",
    role: "MT",
    staffId: STAFF_MT1,
    isKepalaBidangTahfidz: false,
  };

  const sessionMT2: UserSession = {
    userId: "user-mt2",
    username: "musyrif.two",
    name: "Musyrif Dua",
    role: "MT",
    staffId: STAFF_MT2,
    isKepalaBidangTahfidz: false,
  };

  const sessionMTNoStaff: UserSession = {
    userId: "user-mt-nostaff",
    username: "musyrif.unassigned",
    name: "Musyrif Unassigned",
    role: "MT",
    staffId: undefined,
    isKepalaBidangTahfidz: false,
  };

  const sessionKS: UserSession = {
    userId: "user-ks",
    username: "mudir.pesantren",
    name: "K.H. Mudir Pesantren",
    role: "KS",
    staffId: STAFF_KS,
    isKepalaBidangTahfidz: false,
  };

  let ikhtibarSantriH1Id: string = "";
  let ikhtibarSantriH2Id: string = "";

  before(async () => {
    prisma = await startTestDatabase();

    // 0. Seed Users for Audit Logs
    await prisma.user.create({
      data: {
        id: "user-mt1",
        username: "musyrif.one",
        passwordHash: "mock-hash",
        role: "MT",
        status: "AKTIF",
      },
    });
    await prisma.user.create({
      data: {
        id: "user-mt2",
        username: "musyrif.two",
        passwordHash: "mock-hash",
        role: "MT",
        status: "AKTIF",
      },
    });
    await prisma.user.create({
      data: {
        id: "user-ks",
        username: "mudir.pesantren",
        passwordHash: "mock-hash",
        role: "KS",
        status: "AKTIF",
      },
    });

    // 1. Seed Staff
    await prisma.staff.create({
      data: {
        id: STAFF_MT1,
        staffCode: "STF-MT-01",
        nama: "Musyrif Satu",
        roleStaff: "MT",
        status: "AKTIF",
        noHp: "0811111111",
      },
    });

    await prisma.staff.create({
      data: {
        id: STAFF_MT2,
        staffCode: "STF-MT-02",
        nama: "Musyrif Dua",
        roleStaff: "MT",
        status: "AKTIF",
        noHp: "0822222222",
      },
    });

    await prisma.staff.create({
      data: {
        id: STAFF_KS,
        staffCode: "STF-KS-01",
        nama: "K.H. Mudir Pesantren",
        roleStaff: "KS",
        status: "AKTIF",
        noHp: "0833333333",
      },
    });

    // 2. Seed Halaqoh
    await prisma.halaqoh.create({
      data: {
        id: HALAQOH_1,
        halaqohCode: "HLQ-ABAC-01",
        nama: "Halaqoh Abu Bakar",
        pembinaId: STAFF_MT1,
        tahunAjaran: "2026/2027",
        status: "AKTIF",
      },
    });

    await prisma.halaqoh.create({
      data: {
        id: HALAQOH_2,
        halaqohCode: "HLQ-ABAC-02",
        nama: "Halaqoh Umar bin Khattab",
        pembinaId: STAFF_MT2,
        tahunAjaran: "2026/2027",
        status: "AKTIF",
      },
    });

    // 3. Seed Santri
    await prisma.santri.create({
      data: {
        id: SANTRI_H1,
        nis: "SAN-ABAC-01",
        nama: "Santri Binaan MT1",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1,
      },
    });

    await prisma.santri.create({
      data: {
        id: SANTRI_H2,
        nis: "SAN-ABAC-02",
        nama: "Santri Binaan MT2",
        kelas: "7B",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_2,
      },
    });

    // 4. Buat ikhtibar eksisting untuk Santri H2 langsung via Prisma (status PENGAJUAN)
    const ikhtibarH2 = await prisma.ikhtibarTahfizh.create({
      data: {
        santriId: SANTRI_H2,
        juz: 1,
        status: StatusIkhtibar.PENGAJUAN,
      },
    });
    ikhtibarSantriH2Id = ikhtibarH2.id;
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  it("1. Negative ABAC: MT1 ditolak saat mengajukan ikhtibar untuk santri halaqoh lain (SANTRI_H2)", async () => {
    setTestSession(sessionMT1);
    const res = await ajukanIkhtibarAction({
      santriId: SANTRI_H2,
      juz: 2,
    });

    assert.equal(res.success, false);
    assert.match(
      res.message,
      /hanya berwenang mengajukan ikhtibar untuk santri halaqoh binaan/i
    );
  });

  it("2. Fail-Closed ABAC: MT tanpa staffId ditolak saat mengajukan ikhtibar", async () => {
    setTestSession(sessionMTNoStaff);
    const res = await ajukanIkhtibarAction({
      santriId: SANTRI_H1,
      juz: 1,
    });

    assert.equal(res.success, false);
    assert.match(res.message, /Profil staf pembina belum terhubung/i);
  });

  it("3. Positive ABAC: MT1 berhasil mengajukan ikhtibar untuk santri dalam halaqohnya (SANTRI_H1)", async () => {
    setTestSession(sessionMT1);
    const res = await ajukanIkhtibarAction({
      santriId: SANTRI_H1,
      juz: 1,
    });

    assert.equal(res.success, true);
    assert.ok(res.data);
    ikhtibarSantriH1Id = (res.data as { id: string }).id;
    assert.ok(ikhtibarSantriH1Id);
  });

  it("4. Negative & Positive Isolation: MT1 ditolak saat menilai Tahap 1 santri halaqoh 2, namun MT2 diizinkan", async () => {
    // MT1 ditolak menilai santri halaqoh 2
    setTestSession(sessionMT1);
    const resMT1 = await inputHasilTahap1Action({
      ikhtibarId: ikhtibarSantriH2Id,
      nilai: 85,
      lulus: true,
      catatan: "Ujian lintas halaqoh tidak diizinkan",
    });

    assert.equal(resMT1.success, false);
    assert.match(
      resMT1.message,
      /hanya berwenang menilai ikhtibar untuk santri halaqoh binaan/i
    );

    // MT2 diizinkan menilai santri binaannya sendiri (halaqoh 2)
    setTestSession(sessionMT2);
    const resMT2 = await inputHasilTahap1Action({
      ikhtibarId: ikhtibarSantriH2Id,
      nilai: 85,
      lulus: true,
      catatan: "Penilaian oleh pembina sah",
    });

    assert.equal(resMT2.success, true);
    assert.equal((resMT2.data as { pengujiTahap1Id: string }).pengujiTahap1Id, STAFF_MT2);
  });

  it("5. Positive ABAC: MT1 berhasil menilai Tahap 1 santri halaqoh binaannya (SANTRI_H1)", async () => {
    setTestSession(sessionMT1);
    const res = await inputHasilTahap1Action({
      ikhtibarId: ikhtibarSantriH1Id,
      nilai: 88,
      lulus: true,
      catatan: "Lancar dan fasih",
    });

    assert.equal(res.success, true);
    assert.equal((res.data as { status: StatusIkhtibar }).status, StatusIkhtibar.LULUS_TAHAP_1);
    assert.equal((res.data as { pengujiTahap1Id: string }).pengujiTahap1Id, STAFF_MT1);
  });

  it("6. Negative ABAC: MT1 ditolak saat mencoba menginput hasil Tahap 2 (Khusus Mudir / KS)", async () => {
    setTestSession(sessionMT1);
    const res = await inputHasilTahap2Action({
      ikhtibarId: ikhtibarSantriH1Id,
      nilai: 90,
      lulus: true,
      hasilTahap2: "LULUS",
    });

    assert.equal(res.success, false);
    assert.match(res.message, /Gagal menyimpan hasil ujian Tahap 2/i);
  });

  it("7. Positive ABAC: KS berhasil mengesahkan hasil Tahap 2 dan meluluskan santri", async () => {
    setTestSession(sessionKS);
    const res = await inputHasilTahap2Action({
      ikhtibarId: ikhtibarSantriH1Id,
      nilai: 92,
      lulus: true,
      hasilTahap2: "LULUS",
      catatan: "Mumtaz! Disahkan Mudir",
    });

    assert.equal(res.success, true);
    assert.equal(
      (res.data as { status: StatusIkhtibar }).status,
      StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2
    );
  });

  it("8. Scoping ABAC: getDaftarIkhtibarAction untuk MT1 hanya menampilkan santri halaqohnya", async () => {
    setTestSession(sessionMT1);
    const res = await getDaftarIkhtibarAction();

    assert.equal(res.success, true);
    const list = res.data as Array<{ santri: { id: string; nama: string } }>;
    assert.ok(list.length >= 1);

    // Semua santri dalam list harus milik halaqoh 1 (SANTRI_H1)
    for (const item of list) {
      assert.equal(item.santri.id, SANTRI_H1);
      assert.notEqual(item.santri.id, SANTRI_H2);
    }
  });

  it("9. Scoping ABAC: getDaftarIkhtibarAction untuk KS menampilkan seluruh ikhtibar pesantren", async () => {
    setTestSession(sessionKS);
    const res = await getDaftarIkhtibarAction();

    assert.equal(res.success, true);
    const list = res.data as Array<{ santri: { id: string; nama: string } }>;
    const santriIds = list.map((i) => i.santri.id);

    // KS dapat melihat santri dari halaqoh 1 dan halaqoh 2
    assert.ok(santriIds.includes(SANTRI_H1));
    assert.ok(santriIds.includes(SANTRI_H2));
  });

  it("10. Public Fail-Closed: seluruh aksi ikhtibar ditolak jika tanpa sesi autentikasi", async () => {
    setTestSession(null);

    const resAjukan = await ajukanIkhtibarAction({ santriId: SANTRI_H1, juz: 3 });
    assert.equal(resAjukan.success, false);

    const resTahap1 = await inputHasilTahap1Action({ ikhtibarId: ikhtibarSantriH1Id, nilai: 80, lulus: true });
    assert.equal(resTahap1.success, false);

    const resTahap2 = await inputHasilTahap2Action({ ikhtibarId: ikhtibarSantriH1Id, nilai: 80, lulus: true });
    assert.equal(resTahap2.success, false);

    const resDaftar = await getDaftarIkhtibarAction();
    assert.equal(resDaftar.success, false);
  });
});
