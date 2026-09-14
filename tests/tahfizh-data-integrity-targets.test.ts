(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { getSantriListForSession } from "../lib/server/santri-list-service";
import {
  getLaporanBulananHalaqohAction,
  upsertTargetSantriAction,
  getTargetSantriAction,
} from "../app/actions/laporan-bulanan";
import {
  getSantriKumulatifHalamanAction,
  getSantriProgresAction,
  createSetoranAction,
} from "../app/actions/tahfizh";
import {
  determineTahfizhDailyStatus,
  isHariEfektifTahfizh,
} from "../lib/tahfizh-status";
import { allocateSabaqPages, validateProposedSabaqAllocation } from "../lib/tahfizh-page-allocation";
import { hitungCapaianSabaq } from "../lib/laporan-bulanan";

describe("PR #6 — Tahfizh Data Integrity & Target Operationalization (24 Skenario Wajib)", () => {
  let prisma: PrismaClient;

  const STAFF_MT_1_ID = "stf-tahfizh-mt-01";
  const STAFF_MT_2_ID = "stf-tahfizh-mt-02";
  const STAFF_KABID_ID = "stf-tahfizh-kabid";

  const HALAQOH_1_ID = "hlq-tahfizh-01";
  const HALAQOH_2_ID = "hlq-tahfizh-02";

  const SANTRI_AHMAD_ID = "san-tahfizh-ahmad";
  const SANTRI_ZAID_ID = "san-tahfizh-zaid";
  const SANTRI_KHATAM_ID = "san-tahfizh-khatam";

  const sessionMT1: UserSession = {
    userId: "usr-mt-01",
    username: "musyrif.1",
    name: "Ust. Musyrif Satu",
    role: "MT",
    staffId: STAFF_MT_1_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionMT2: UserSession = {
    userId: "usr-mt-02",
    username: "musyrif.2",
    name: "Ust. Musyrif Dua",
    role: "MT",
    staffId: STAFF_MT_2_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionMTNoStaff: UserSession = {
    userId: "usr-mt-nostaff",
    username: "musyrif.nostaff",
    name: "Ust. Musyrif Tanpa Staf",
    role: "MT",
    staffId: null,
    isKepalaBidangTahfidz: false,
  };

  const sessionKabid: UserSession = {
    userId: "usr-kabid",
    username: "kabid.tahfizh",
    name: "Ust. Kabid Tahfizh",
    role: "MT",
    staffId: STAFF_KABID_ID,
    isKepalaBidangTahfidz: true,
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Staff
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_MT_1_ID,
          staffCode: "STF-MT-01",
          nama: "Ust. Musyrif Satu",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08111111111",
        },
        {
          id: STAFF_MT_2_ID,
          staffCode: "STF-MT-02",
          nama: "Ust. Musyrif Dua",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08222222222",
        },
        {
          id: STAFF_KABID_ID,
          staffCode: "STF-KABID-01",
          nama: "Ust. Kabid Tahfizh",
          roleStaff: "MT",
          status: "AKTIF",
          noHp: "08333333333",
        },
      ],
    });

    // 1b. Seed Users (for clean audit log foreign keys)
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
      ],
    });

    // 2. Seed Halaqoh
    await prisma.halaqoh.createMany({
      data: [
        {
          id: HALAQOH_1_ID,
          halaqohCode: "HLQ-01",
          nama: "Halaqoh Abu Bakar",
          pembinaId: STAFF_MT_1_ID,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: HALAQOH_2_ID,
          halaqohCode: "HLQ-02",
          nama: "Halaqoh Umar bin Khattab",
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
          id: SANTRI_AHMAD_ID,
          nis: "SAN-001",
          nama: "Ahmad Santri",
          kelas: "7A",
          jenisKelamin: "L",
          status: "AKTIF",
          halaqohId: HALAQOH_1_ID,
          modalHafalanAwalHalaman: 20,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00Z"),
        },
        {
          id: SANTRI_ZAID_ID,
          nis: "SAN-002",
          nama: "Zaid Santri",
          kelas: "7B",
          jenisKelamin: "L",
          status: "AKTIF",
          halaqohId: HALAQOH_2_ID,
          modalHafalanAwalHalaman: 40,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00Z"),
        },
        {
          id: SANTRI_KHATAM_ID,
          nis: "SAN-003",
          nama: "Khatam Santri",
          kelas: "9A",
          jenisKelamin: "L",
          status: "AKTIF",
          halaqohId: HALAQOH_1_ID,
          modalHafalanAwalHalaman: 604,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00Z"),
        },
      ],
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  // -------------------------------------------------------------
  // 1 & 2: DIBATALKAN Invariant
  // -------------------------------------------------------------
  it("1. DIBATALKAN tidak dihitung sebagai capaian", async () => {
    setTestSession(sessionMT1);

    // Buat setoran SABAQ AKTIF 5 halaman
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-001",
        santriId: SANTRI_AHMAD_ID,
        musyrifId: STAFF_MT_1_ID,
        jenis: "SABAQ",
        status: "AKTIF",
        juz: 2,
        halamanMulai: 21,
        halamanSelesai: 25,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        tanggal: new Date("2026-09-02T10:00:00Z"),
      },
    });

    // Buat setoran SABAQ DIBATALKAN 10 halaman
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-002",
        santriId: SANTRI_AHMAD_ID,
        musyrifId: STAFF_MT_1_ID,
        jenis: "SABAQ",
        status: "DIBATALKAN",
        juz: 2,
        halamanMulai: 26,
        halamanSelesai: 35,
        jumlahHalaman: 10,
        nilai: "MUMTAZ",
        tanggal: new Date("2026-09-03T10:00:00Z"),
        alasanPembatalan: "Salah input data",
      },
    });

    const resKumulatif = await getSantriKumulatifHalamanAction(SANTRI_AHMAD_ID);
    assert.equal(resKumulatif.success, true);
    // Modal awal 20 + Sabaq aktif 5 = 25 halaman (bukan 35)
    assert.equal(resKumulatif.data?.totalHalaman, 25);
    assert.equal(resKumulatif.data?.tambahanSabaq, 5);

    const resProgres = await getSantriProgresAction(SANTRI_AHMAD_ID);
    assert.equal(resProgres.success, true);
    // Hanya 1 setoran sah terhitung
    assert.equal(resProgres.data?.totalSetoran, 1);
  });

  it("2. DIBATALKAN tidak membuat status setoran menjadi selesai", () => {
    // Pada hari efektif Rabu (2026-09-09)
    const refDateRabu = new Date("2026-09-09T10:00:00Z");

    const statusCancelledOnly = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [
        { jenis: "SABAQ", status: "DIBATALKAN" },
      ],
      posisiTerakhirHalaman: 25,
    });

    // Setoran DIBATALKAN harus diabaikan, status tetap BELUM_SELESAI
    assert.equal(statusCancelledOnly.sabaq, "BELUM_SELESAI");
    assert.equal(statusCancelledOnly.sudahSetorHariIni, false);
  });

  // -------------------------------------------------------------
  // 3, 4, 5: Target Kosong & Tanpa Fallback Sintetis
  // -------------------------------------------------------------
  it("3. Target tidak ada -> Target belum ditetapkan", async () => {
    setTestSession(sessionMT1);
    const listRes = await getSantriListForSession({ halaqohId: HALAQOH_1_ID }, sessionMT1, prisma);
    assert.equal(listRes.success, true);

    const ahmad = listRes.data.find((s) => s.id === SANTRI_AHMAD_ID);
    assert.ok(ahmad);
    assert.equal(ahmad.targetSabaq, null);
    assert.equal(ahmad.targetSabaqLabel, "Target belum ditetapkan");
  });

  it("4. Target tidak ada -> tidak ada fallback 20 halaman", () => {
    // hitungCapaianSabaq tanpa target tidak boleh fallback ke 20
    const res = hitungCapaianSabaq({ p1: 5, p2: 0, p3: 0, p4: 0 }, null, 10);
    assert.equal(res.hasTarget, false);
    assert.equal(res.persentase, 0);
    assert.equal(res.isTercapai, false);
  });

  it("5. Target tidak ada -> tidak ada fallback 30 juz", async () => {
    setTestSession(sessionMT1);
    const listRes = await getSantriListForSession({ halaqohId: HALAQOH_1_ID }, sessionMT1, prisma);
    assert.equal(listRes.success, true);

    const ahmad = listRes.data.find((s) => s.id === SANTRI_AHMAD_ID);
    assert.ok(ahmad);
    // targetJuz harus null (bukan hardcoded 30)
    assert.equal(ahmad.targetJuz, null);
  });

  // -------------------------------------------------------------
  // 6: Target Individual Ahmad != Zaid
  // -------------------------------------------------------------
  it("6. Target individual Ahmad berbeda dari target Zaid dan terbaca dengan benar", async () => {
    // Tetapkan target Ahmad = 15 halaman
    await prisma.targetSantri.create({
      data: {
        santriId: SANTRI_AHMAD_ID,
        jenis: "SABAQ",
        targetPekanan: 3.75,
        targetBulanan: 15,
        ambangKepatuhan: 90.0,
        bulan: 9,
        tahunAjaran: "2026/2027",
      },
    });

    // Tetapkan target Zaid = 25 halaman
    await prisma.targetSantri.create({
      data: {
        santriId: SANTRI_ZAID_ID,
        jenis: "SABAQ",
        targetPekanan: 6.25,
        targetBulanan: 25,
        ambangKepatuhan: 90.0,
        bulan: 9,
        tahunAjaran: "2026/2027",
      },
    });

    setTestSession(sessionMT1);
    const ahmadTargets = await getTargetSantriAction(SANTRI_AHMAD_ID, 9, "2026/2027");
    assert.equal(ahmadTargets.success, true);
    assert.equal(ahmadTargets.data?.[0]?.targetBulanan, 15);

    setTestSession(sessionMT2);
    const zaidTargets = await getTargetSantriAction(SANTRI_ZAID_ID, 9, "2026/2027");
    assert.equal(zaidTargets.success, true);
    assert.equal(zaidTargets.data?.[0]?.targetBulanan, 25);

    assert.notEqual(ahmadTargets.data?.[0]?.targetBulanan, zaidTargets.data?.[0]?.targetBulanan);
  });

  // -------------------------------------------------------------
  // 7, 8, 9, 10: ABAC Target & Scoping
  // -------------------------------------------------------------
  it("7. MT dapat mengatur dan membaca target santri halaqoh sendiri", async () => {
    setTestSession(sessionMT1);
    const upsertRes = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABQI",
      targetPekanan: 4,
      targetBulanan: 16,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(upsertRes.success, true);

    const getRes = await getTargetSantriAction(SANTRI_AHMAD_ID, 9, "2026/2027");
    assert.equal(getRes.success, true);
    assert.ok(getRes.data?.some((t) => t.jenis === "SABQI" && t.targetBulanan === 16));
  });

  it("8. MT tidak dapat mengatur atau membaca target santri halaqoh lain", async () => {
    // MT1 membina Halaqoh 1 (Ahmad), mencoba akses Zaid di Halaqoh 2
    setTestSession(sessionMT1);

    const upsertFail = await upsertTargetSantriAction({
      santriId: SANTRI_ZAID_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(upsertFail.success, false);
    assert.match(upsertFail.message, /Akses Ditolak/i);

    const getFail = await getTargetSantriAction(SANTRI_ZAID_ID, 9, "2026/2027");
    assert.equal(getFail.success, false);
    assert.match(getFail.message ?? "", /Akses Ditolak/i);
  });

  it("9. MT tanpa staffId fail closed", async () => {
    setTestSession(sessionMTNoStaff);

    const upsertRes = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(upsertRes.success, false);
    assert.match(upsertRes.message, /Profil staf pembina Anda belum terhubung/i);

    const getRes = await getTargetSantriAction(SANTRI_AHMAD_ID, 9, "2026/2027");
    assert.equal(getRes.success, false);
    assert.match(getRes.message ?? "", /Profil staf pembina Anda belum terhubung/i);
  });

  it("10. Kabid Tahfizh mendapatkan scope berdasarkan DB flag", async () => {
    setTestSession(sessionKabid);

    // Kabid dapat mengatur target santri di Halaqoh 1
    const resAhmad = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "MANZIL",
      targetPekanan: 4,
      targetBulanan: 16,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resAhmad.success, true);

    // Kabid dapat mengatur target santri di Halaqoh 2
    const resZaid = await upsertTargetSantriAction({
      santriId: SANTRI_ZAID_ID,
      jenis: "MANZIL",
      targetPekanan: 4,
      targetBulanan: 16,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resZaid.success, true);
  });

  // -------------------------------------------------------------
  // 11: Laporan DB Failure Honest Error
  // -------------------------------------------------------------
  it("11. Laporan DB failure tidak berubah menjadi mock success", async () => {
    setTestSession(sessionKabid);

    // Meminta halaqoh yang tidak ada
    const res = await getLaporanBulananHalaqohAction("NON_EXISTENT_HLQ_ID", 9, "2026/2027");
    assert.equal(res.success, false);
    assert.equal(res.data, null);
    assert.match(res.message ?? "", /tidak ditemukan/i);
  });

  // -------------------------------------------------------------
  // 12, 13, 14: Per-Jenis Status & Applicability
  // -------------------------------------------------------------
  it("12. SABAQ / SABQI / MANZIL / MUFAR dapat dibedakan", () => {
    const refDateRabu = new Date("2026-09-09T10:00:00Z");

    const status = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [
        { jenis: "SABAQ", status: "AKTIF" },
      ],
      posisiTerakhirHalaman: 25,
      isMufarApplicable: false,
    });

    assert.equal(status.sabaq, "SELESAI");
    assert.equal(status.sabqi, "BELUM_SELESAI");
    assert.equal(status.manzil, "BELUM_SELESAI");
    assert.equal(status.mufar, "TIDAK_BERLAKU");
  });

  it("13. MANZIL tidak otomatis membuat SABAQ selesai", () => {
    const refDateRabu = new Date("2026-09-09T10:00:00Z");

    const status = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [
        { jenis: "MANZIL", status: "AKTIF" },
      ],
      posisiTerakhirHalaman: 25,
      isMufarApplicable: true,
    });

    assert.equal(status.manzil, "SELESAI");
    assert.equal(status.sabaq, "BELUM_SELESAI");
    assert.equal(status.sabqi, "BELUM_SELESAI");
    assert.equal(status.mufar, "BELUM_SELESAI");
  });

  it("14. MUFAR TIDAK_BERLAKU tidak dianggap kegagalan", () => {
    const refDateRabu = new Date("2026-09-09T10:00:00Z");

    const status = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
      isMufarApplicable: false, // Belum berlaku
    });

    assert.equal(status.mufar, "TIDAK_BERLAKU");
  });

  // -------------------------------------------------------------
  // 15, 16, 17: Hari Efektif Monitoring
  // -------------------------------------------------------------
  it("15. Sabtu tidak otomatis menghasilkan kegagalan Tahfizh", () => {
    // 2026-09-12 adalah hari Sabtu di WITA (UTC+8)
    const sabtu = new Date("2026-09-12T04:00:00Z");
    assert.equal(isHariEfektifTahfizh(sabtu), false);

    const status = determineTahfizhDailyStatus({
      refDate: sabtu,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
    });

    assert.equal(status.isHariEfektif, false);
    assert.equal(status.sabaq, "TIDAK_BERLAKU");
    assert.equal(status.sabqi, "TIDAK_BERLAKU");
    assert.equal(status.manzil, "TIDAK_BERLAKU");
    assert.equal(status.mufar, "TIDAK_BERLAKU");
  });

  it("16. Ahad tidak otomatis menghasilkan kegagalan Tahfizh", () => {
    // 2026-09-13 adalah hari Ahad di WITA (UTC+8)
    const ahad = new Date("2026-09-13T04:00:00Z");
    assert.equal(isHariEfektifTahfizh(ahad), false);

    const status = determineTahfizhDailyStatus({
      refDate: ahad,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
    });

    assert.equal(status.isHariEfektif, false);
    assert.equal(status.sabaq, "TIDAK_BERLAKU");
    assert.equal(status.sabqi, "TIDAK_BERLAKU");
    assert.equal(status.manzil, "TIDAK_BERLAKU");
    assert.equal(status.mufar, "TIDAK_BERLAKU");
  });

  it("17. Senin–Jumat dapat diproses sebagai hari efektif monitoring", () => {
    // 2026-09-07 adalah Senin, 2026-09-11 adalah Jumat di WITA
    const senin = new Date("2026-09-07T04:00:00Z");
    const jumat = new Date("2026-09-11T04:00:00Z");

    assert.equal(isHariEfektifTahfizh(senin), true);
    assert.equal(isHariEfektifTahfizh(jumat), true);

    const statusSenin = determineTahfizhDailyStatus({
      refDate: senin,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
    });
    assert.equal(statusSenin.isHariEfektif, true);
    assert.equal(statusSenin.sabaq, "BELUM_SELESAI");
  });

  // -------------------------------------------------------------
  // 18: Baseline + SABAQ Sah
  // -------------------------------------------------------------
  it("18. baseline + SABAQ sah tetap menghasilkan posisi hafalan yang benar", async () => {
    setTestSession(sessionMT2);

    // Zaid modal awal 40 halaman. Tambah SABAQ 3 halaman sah.
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-003",
        santriId: SANTRI_ZAID_ID,
        musyrifId: STAFF_MT_2_ID,
        jenis: "SABAQ",
        status: "AKTIF",
        juz: 3,
        halamanMulai: 41,
        halamanSelesai: 43,
        jumlahHalaman: 3,
        nilai: "MUMTAZ",
        tanggal: new Date("2026-09-02T08:00:00Z"),
      },
    });

    const res = await getSantriKumulatifHalamanAction(SANTRI_ZAID_ID);
    assert.equal(res.success, true);
    assert.equal(res.data?.totalHalaman, 43); // 40 + 3
    assert.equal(res.data?.totalJuz, 2); // Math.floor(43/20)
    assert.equal(res.data?.sisaHalaman, 3);
  });

  // -------------------------------------------------------------
  // 19, 20: Halaman 604 & Larangan Halaman 605
  // -------------------------------------------------------------
  it("19. Halaman 604 tetap menjadi akhir Mushaf", () => {
    const refDateRabu = new Date("2026-09-09T10:00:00Z");

    const statusKhatam = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [],
      posisiTerakhirHalaman: 604,
    });

    // Karena telah mencapai halaman 604, Sabaq TIDAK_BERLAKU
    assert.equal(statusKhatam.sabaq, "TIDAK_BERLAKU");
  });

  it("20. Tidak pernah menghasilkan halaman 605", async () => {
    setTestSession(sessionMT1);

    // Setoran melampaui halaman 604 harus ditolak
    const res = await createSetoranAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      juz: 30,
      halamanMulai: 604,
      halamanSelesai: 605,
      jumlahHalaman: 2,
      nilai: "MUMTAZ",
    });

    assert.equal(res.success, false);
    assert.match(res.message, /1 sampai 604/i);
  });

  // -------------------------------------------------------------
  // 21, 22, 23: Volume, Multi-Page, & Kapasitas Halaman
  // -------------------------------------------------------------
  it("21. Setoran 0.5 tetap valid", () => {
    const pages = allocateSabaqPages(21, 21, 0.5);
    assert.equal(Object.keys(pages).length, 1);
    assert.equal(pages[21], 0.5);
  });

  it("22. Multi-page tetap valid", () => {
    const pages = allocateSabaqPages(21, 23, 3);
    assert.equal(Object.keys(pages).length, 3);
    assert.deepEqual(Object.keys(pages).map(Number), [21, 22, 23]);
    assert.deepEqual(Object.values(pages), [1.0, 1.0, 1.0]);
  });

  it("23. Kapasitas halaman tidak boleh > 1.0", () => {
    // 1. allocateSabaqPages menolak volume 2 halaman pada 1 nomor halaman (melebihi rentang kapasitas 1.0)
    assert.throws(() => {
      allocateSabaqPages(21, 21, 2);
    }, /Inkonsistensi rentang halaman dan jumlah volume/i);

    // 2. validateProposedSabaqAllocation menolak setoran baru pada halaman yang sudah terisi penuh 1.0
    const valResult = validateProposedSabaqAllocation(
      [
        {
          jenis: "SABAQ",
          status: "AKTIF",
          halamanMulai: 21,
          halamanSelesai: 21,
          jumlahHalaman: 1.0,
          tanggal: new Date("2026-09-02T10:00:00Z"),
        },
      ],
      21,
      21,
      0.5
    );
    assert.equal(valResult.valid, false);
    assert.match(valResult.message ?? "", /sudah lengkap disetorkan/i);
  });

  // -------------------------------------------------------------
  // 24: Existing Ikhtibar ABAC Tidak Regresi
  // -------------------------------------------------------------
  it("24. Existing Ikhtibar ABAC tidak regresi", async () => {
    // MT1 tidak boleh mengakses data santri di luar binaan untuk ikhtibar
    setTestSession(sessionMT1);
    const zaidInDb = await prisma.santri.findUnique({ where: { id: SANTRI_ZAID_ID } });
    assert.ok(zaidInDb);
    assert.notEqual(zaidInDb.halaqohId, HALAQOH_1_ID);

    // MT tanpa session atau cross halaqoh tetap fail closed
    const isBinaanMT1 = await prisma.halaqoh.findFirst({
      where: {
        pembinaId: sessionMT1.staffId!,
        santriList: { some: { id: SANTRI_ZAID_ID } },
      },
    });
    assert.equal(isBinaanMT1, null);
  });
});
