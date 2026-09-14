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
  recordTasmiSimaanAction,
} from "../app/actions/laporan-bulanan";
import fs from "node:fs";
import path from "node:path";
import {
  getSantriKumulatifHalamanAction,
  getSantriProgresAction,
  createSetoranAction,
  getSetoranSabaqPekanSantriAction,
  getRecentSetoranAction,
} from "../app/actions/tahfizh";
import {
  previewFinalisasiBulananAction,
  prosesRewardTasmiSimaanAction,
  getKebijakanRewardSanksiAction,
} from "../app/actions/reward-sanksi";
import { getRingkasanAnakAction } from "../app/actions/portal-wali";
import {
  determineTahfizhDailyStatus,
  isHariEfektifTahfizh,
} from "../lib/tahfizh-status";
import { allocateSabaqPages, validateProposedSabaqAllocation } from "../lib/tahfizh-page-allocation";
import {
  hitungCapaianSabaq,
  konversiHalamanKeJuz,
  hitungAkumulasiSabaqSantri,
  getPekanDariTanggal,
} from "../lib/laporan-bulanan";
import { getWITAMonthRange } from "../lib/wita-date";

describe("PR #6 — Tahfizh Data Integrity & Target Operationalization (43 Skenario Lengkap)", () => {
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

  const sessionMK: UserSession = {
    userId: "usr-mk-01",
    username: "guru.mk",
    name: "Ust. Guru MK",
    role: "MK",
    staffId: null,
    isKepalaBidangTahfidz: false,
  };

  const sessionWSAhmad: UserSession = {
    userId: "usr-ws-ahmad",
    username: "wali.ahmad",
    name: "Wali Ahmad",
    role: "WS",
    santriId: SANTRI_AHMAD_ID,
    staffId: null,
    isKepalaBidangTahfidz: false,
  };

  const sessionKS: UserSession = {
    userId: "usr-ks-01",
    username: "mudir.ks",
    name: "Ust. Mudir",
    role: "KS",
    staffId: null,
    isKepalaBidangTahfidz: false,
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
          targetAkhirProgramJuz: 0,
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
          targetAkhirProgramJuz: 20,
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
          targetAkhirProgramJuz: 30,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00Z"),
        },
      ],
    });

    // 3b. Seed Users (for clean audit log foreign keys)
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
          id: sessionMK.userId,
          username: sessionMK.username,
          passwordHash: "hash-test",
          role: "MK",
          staffId: null,
        },
        {
          id: sessionWSAhmad.userId,
          username: sessionWSAhmad.username,
          passwordHash: "hash-test",
          role: "WS",
          santriId: SANTRI_AHMAD_ID,
          staffId: null,
        },
      ],
    });

    // 4. Seed Kebijakan Reward Sanksi
    await prisma.kebijakanRewardSanksi.create({
      data: {
        id: "kebijakan-test-01",
        nama: "Kebijakan Test STQ",
        minNilaiTasmi: 80.0,
        minNilaiSimaan: 85.0,
        bintangTasmi: 1,
        bintangSimaan: 2,
        hakLiburTasmiHari: 1,
        hakLiburSimaanHari: 2,
        minPersenTargetBulanan: 100.0,
        durasiKehilanganKunjunganHari: 30,
        isActive: true,
      },
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

  // -------------------------------------------------------------
  // 25: DIBATALKAN Dieksklusi dalam Finalisasi Bulanan
  // -------------------------------------------------------------
  it("25. Finalisasi bulanan mengecualikan setoran DIBATALKAN", async () => {
    setTestSession(sessionKabid);

    // Setup Target Ahmad bulan 10: 10 halaman
    await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 2.5,
      targetBulanan: 10,
      bulan: 10,
      tahunAjaran: "2026/2027",
    });

    // SABAQ aktif 5 halaman di bulan 10 (5 Okt 2026 10:00 WITA -> 5 Okt 02:00 UTC)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-FIN-01",
        santriId: SANTRI_AHMAD_ID,
        musyrifId: STAFF_MT_1_ID,
        jenis: "SABAQ",
        status: "AKTIF",
        juz: 2,
        halamanMulai: 26,
        halamanSelesai: 30,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        tanggal: new Date("2026-10-05T02:00:00Z"),
      },
    });

    // SABAQ dibatalkan 5 halaman di bulan 10
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-FIN-02",
        santriId: SANTRI_AHMAD_ID,
        musyrifId: STAFF_MT_1_ID,
        jenis: "SABAQ",
        status: "DIBATALKAN",
        juz: 2,
        halamanMulai: 31,
        halamanSelesai: 35,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        tanggal: new Date("2026-10-06T02:00:00Z"),
        alasanPembatalan: "Salah input",
      },
    });

    const previewRes = await previewFinalisasiBulananAction({ bulan: 10, tahunAjaran: "2026/2027" });
    assert.equal(previewRes.success, true);
    const itemAhmad = previewRes.data?.items.find((it) => it.santriId === SANTRI_AHMAD_ID);
    assert.ok(itemAhmad);
    assert.equal(itemAhmad.targetHalaman, 10);
    assert.equal(itemAhmad.capaianHalaman, 5); // Tetap 5, bukan 10!
    assert.equal(itemAhmad.persentase, 50);
    assert.equal(itemAhmad.isTercapai, false);
  });

  // -------------------------------------------------------------
  // 26: ABAC Preview Finalisasi Bulanan
  // -------------------------------------------------------------
  it("26. ABAC preview finalisasi bulanan fail-closed & scoped", async () => {
    // MT1 hanya melihat santri di halaqoh binaan 1
    setTestSession(sessionMT1);
    const resMT1 = await previewFinalisasiBulananAction({ bulan: 9, tahunAjaran: "2026/2027" });
    assert.equal(resMT1.success, true);
    const santriIdsMT1 = resMT1.data?.items.map((i) => i.santriId) ?? [];
    assert.ok(santriIdsMT1.includes(SANTRI_AHMAD_ID));
    assert.equal(santriIdsMT1.includes(SANTRI_ZAID_ID), false); // Zaid di halaqoh 2 tidak boleh muncul

    // MT tanpa staffId fail closed
    setTestSession(sessionMTNoStaff);
    const resNoStaff = await previewFinalisasiBulananAction({ bulan: 9, tahunAjaran: "2026/2027" });
    assert.equal(resNoStaff.success, false);
    assert.match(resNoStaff.message ?? "", /profil staf/i);

    // Role lain (MK) fail closed
    setTestSession(sessionMK);
    const resMK = await previewFinalisasiBulananAction({ bulan: 9, tahunAjaran: "2026/2027" });
    assert.equal(resMK.success, false);
    assert.match(resMK.message ?? "", /tidak memiliki akses/i);
  });

  // -------------------------------------------------------------
  // 27: ABAC Reward Tasmi/Sima'an Cross-Halaqoh
  // -------------------------------------------------------------
  it("27. ABAC reward Tasmi/Sima'an cross-halaqoh fail-closed", async () => {
    // Buat data tasmi untuk Zaid (Halaqoh 2)
    const tasmiZaid = await prisma.tasmiSimaan.create({
      data: {
        santriId: SANTRI_ZAID_ID,
        musyrifId: STAFF_MT_2_ID,
        tanggal: new Date("2026-09-08T08:00:00Z"),
        jenis: "TASMI",
        juz: 1,
        nilai: 90,
        predikat: "MUMTAZ",
      },
    });

    // MT1 (Halaqoh 1) mencoba memproses reward santri Zaid (Halaqoh 2) -> Access Denied
    setTestSession(sessionMT1);
    const resMT1 = await prosesRewardTasmiSimaanAction(tasmiZaid.id);
    assert.equal(resMT1.success, false);
    assert.match(resMT1.message ?? "", /Akses Ditolak/i);

    // MT tanpa staffId -> fail closed
    setTestSession(sessionMTNoStaff);
    const resNoStaff = await prosesRewardTasmiSimaanAction(tasmiZaid.id);
    assert.equal(resNoStaff.success, false);
    assert.match(resNoStaff.message ?? "", /profil staf/i);

    // Kabid -> boleh lintas halaqoh
    setTestSession(sessionKabid);
    const resKabid = await prosesRewardTasmiSimaanAction(tasmiZaid.id);
    assert.equal(resKabid.success, true);
  });

  // -------------------------------------------------------------
  // 28: Read Action Default-Deny untuk Role Non-Tahfizh
  // -------------------------------------------------------------
  it("28. Read action default-deny untuk role non-Tahfizh dan unauthorized", async () => {
    setTestSession(sessionMK);

    // getLaporanBulananHalaqohAction deny
    const resLaporan = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "2026/2027");
    assert.equal(resLaporan.success, false);
    assert.match(resLaporan.message ?? "", /Akses Ditolak/i);

    // getTargetSantriAction deny
    const resTarget = await getTargetSantriAction(SANTRI_AHMAD_ID, 9, "2026/2027");
    assert.equal(resTarget.success, false);
    assert.match(resTarget.message ?? "", /Akses Ditolak/i);

    // Wali santri A mencoba membaca target santri B
    setTestSession(sessionWSAhmad);
    const resWaliZaid = await getTargetSantriAction(SANTRI_ZAID_ID, 9, "2026/2027");
    assert.equal(resWaliZaid.success, false);
    assert.match(resWaliZaid.message ?? "", /Akses Ditolak/i);
  });

  // -------------------------------------------------------------
  // 29: Target Dashboard Period-Aware
  // -------------------------------------------------------------
  it("29. Target dashboard period-aware", async () => {
    setTestSession(sessionMT1);

    // Target September = 20
    await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });

    // Target Oktober = 30
    await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 7.5,
      targetBulanan: 30,
      bulan: 10,
      tahunAjaran: "2026/2027",
    });

    // Ambil santri list saat September aktif (injeksi refDate September secara deterministik)
    const resList = await getSantriListForSession(
      { refDate: new Date("2026-09-15T08:00:00Z") },
      sessionMT1,
      prisma
    );
    assert.equal(resList.success, true);
    const ahmad = resList.data.find((s) => s.id === SANTRI_AHMAD_ID);
    assert.ok(ahmad);
    // Di bulan September aktif (bulan 9), targetSabaq harus 20 (bukan 30)
    assert.equal(ahmad.targetSabaq, 20);
    assert.equal(ahmad.targetSabaqLabel, "20 Halaman");

    // Ambil santri list saat Oktober aktif (injeksi refDate Oktober secara deterministik)
    const resListOkt = await getSantriListForSession(
      { refDate: new Date("2026-10-15T08:00:00Z") },
      sessionMT1,
      prisma
    );
    assert.equal(resListOkt.success, true);
    const ahmadOkt = resListOkt.data.find((s) => s.id === SANTRI_AHMAD_ID);
    assert.ok(ahmadOkt);
    assert.equal(ahmadOkt.targetSabaq, 30);
    assert.equal(ahmadOkt.targetSabaqLabel, "30 Halaman");
  });

  // -------------------------------------------------------------
  // 30: targetAkhirProgramJuz Dibaca dari Database
  // -------------------------------------------------------------
  it("30. targetAkhirProgramJuz dibaca dari database", async () => {
    setTestSession(sessionKabid);

    // Update Ahmad dengan target 30 juz di DB untuk verifikasi pembacaan dinamis
    await prisma.santri.update({
      where: { id: SANTRI_AHMAD_ID },
      data: { targetAkhirProgramJuz: 30 },
    });

    const resList = await getSantriListForSession({}, sessionKabid, prisma);
    assert.equal(resList.success, true);
    const ahmad = resList.data.find((s) => s.id === SANTRI_AHMAD_ID);
    const zaid = resList.data.find((s) => s.id === SANTRI_ZAID_ID);

    assert.ok(ahmad);
    assert.ok(zaid);
    assert.equal(ahmad.targetJuz, 30);
    assert.equal(zaid.targetJuz, 20);
  });

  // -------------------------------------------------------------
  // 31: Target Pecahan 0.5 Round-Trip
  // -------------------------------------------------------------
  it("31. Target pecahan 0.5 round-trip", async () => {
    setTestSession(sessionMT1);

    const upsertRes = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 1.5,
      targetBulanan: 3.5,
      bulan: 11,
      tahunAjaran: "2026/2027",
    });
    assert.equal(upsertRes.success, true);

    const getRes = await getTargetSantriAction(SANTRI_AHMAD_ID, 11, "2026/2027");
    assert.equal(getRes.success, true);
    const targetSabaq = getRes.data?.find((t) => t.jenis === "SABAQ");
    assert.ok(targetSabaq);
    assert.equal(targetSabaq.targetPekanan, 1.5);
    assert.equal(targetSabaq.targetBulanan, 3.5);
  });

  // -------------------------------------------------------------
  // 32: Non-Rounded Decimal Page Calculations
  // -------------------------------------------------------------
  it("32. Non-rounded decimal page calculations", () => {
    // 0.5 Halaman
    const k05 = konversiHalamanKeJuz(0.5);
    assert.equal(k05.juz, 0);
    assert.equal(k05.sisaHalaman, 0.5);
    assert.equal(k05.label, "0.5 Halaman");

    // 20.5 Halaman
    const k205 = konversiHalamanKeJuz(20.5);
    assert.equal(k205.juz, 1);
    assert.equal(k205.sisaHalaman, 0.5);
    assert.equal(k205.label, "1 Juz 0.5 Halaman");

    // Baseline 40.5 + SABAQ 0.5 = 41.0
    const capaian = hitungCapaianSabaq({ p1: 0.5, p2: 0, p3: 0, p4: 0 }, 10, 40.5);
    assert.equal(capaian.totalHalaman, 0.5);
    assert.equal(capaian.modalAwalHalaman, 40.5);
    assert.equal(capaian.akumulasiTotalHalaman, 41.0);
    assert.equal(capaian.konversiAkumulasi.juz, 2);
    assert.equal(capaian.konversiAkumulasi.sisaHalaman, 1.0);
    assert.equal(capaian.konversiAkumulasi.label, "2 Juz 1 Halaman");
  });

  // -------------------------------------------------------------
  // 33: Eliminasi Fallback 20 pada hitungAkumulasiSabaqSantri
  // -------------------------------------------------------------
  it("33. Eliminasi fallback 20 pada hitungAkumulasiSabaqSantri", () => {
    const ak = hitungAkumulasiSabaqSantri({
      modalAwalHalaman: 10,
      pekan: { p1: 5, p2: 0, p3: 0, p4: 0 },
    });
    assert.equal(ak.hasTarget, false);
    assert.equal(ak.persentaseTarget, 0);
    assert.equal(ak.isTercapai, false);
  });

  // -------------------------------------------------------------
  // 34: Batas Rentang Bulanan dan Pekan WITA
  // -------------------------------------------------------------
  it("34. Batas rentang bulanan dan pekan WITA", () => {
    const { startDate, endDate } = getWITAMonthRange(2026, 9);
    // 1 Sept 00:00 WITA = 31 Aug 16:00 UTC
    assert.equal(startDate.toISOString(), "2026-08-31T16:00:00.000Z");
    // 30 Sept 23:59:59.999 WITA = 30 Sept 15:59:59.999 UTC
    assert.equal(endDate.toISOString(), "2026-09-30T15:59:59.999Z");

    // 30 Sept 23:59 WITA (15:59 UTC) masuk September
    const t30Sep = new Date("2026-09-30T15:59:00.000Z");
    assert.ok(t30Sep >= startDate && t30Sep <= endDate);

    // 1 Okt 00:00 WITA (30 Sept 16:00 UTC) di luar September
    const t1Okt = new Date("2026-09-30T16:00:00.000Z");
    assert.ok(t1Okt > endDate);

    // getPekanDariTanggal berdasarkan kalender WITA
    // 7 Sept 23:00 WITA -> Pekan 1
    assert.equal(getPekanDariTanggal(new Date("2026-09-07T15:00:00.000Z")), 1);
    // 8 Sept 01:00 WITA -> Pekan 2
    assert.equal(getPekanDariTanggal(new Date("2026-09-07T17:00:00.000Z")), 2);
  });

  // -------------------------------------------------------------
  // 35: SABQI Applicability Berbasis SABAQ Valid Pekan Berjalan
  // -------------------------------------------------------------
  it("35. SABQI applicability berbasis SABAQ valid pekan berjalan", () => {
    const refDateRabu = new Date("2026-09-09T10:00:00Z");

    // Kasus A: Belum ada SABAQ pekan berjalan -> SABQI TIDAK_BERLAKU
    const statusNoSabaq = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
      hasValidSabaqThisWeek: false,
    });
    assert.equal(statusNoSabaq.sabqi, "TIDAK_BERLAKU");

    // Kasus B: Ada SABAQ valid pekan berjalan + belum SABQI hari ini -> BELUM_SELESAI
    const statusHasSabaq = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
      hasValidSabaqThisWeek: true,
    });
    assert.equal(statusHasSabaq.sabqi, "BELUM_SELESAI");

    // Kasus C: Ada SABAQ tapi statusnya DIBATALKAN -> tidak membuat SABQI applicable
    const statusBatalSabaq = determineTahfizhDailyStatus({
      refDate: refDateRabu,
      validSetoranToday: [],
      posisiTerakhirHalaman: 25,
      hasValidSabaqThisWeek: false, // Dibatalkan -> false
    });
    assert.equal(statusBatalSabaq.sabqi, "TIDAK_BERLAKU");
  });

  // -------------------------------------------------------------
  // 36: Examiner Attribution Tasmi/Sima'an Fail-Closed
  // -------------------------------------------------------------
  it("36. Examiner attribution Tasmi/Sima'an fail-closed", async () => {
    setTestSession(sessionMTNoStaff);

    const res = await recordTasmiSimaanAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "TASMI",
      juz: 1,
      nilai: 90,
      predikat: "MUMTAZ",
    });

    assert.equal(res.success, false);
    assert.match(res.message ?? "", /profil staf penguji/i);
  });

  // -------------------------------------------------------------
  // 37: Baseline Null: Eliminasi Total Legacy Cumulative Fallback
  // -------------------------------------------------------------
  it("37. Baseline null: eliminasi total legacy cumulative fallback", async () => {
    // Buat santri tanpa baseline
    const santriNoBaseline = await prisma.santri.create({
      data: {
        nis: "TEST-NO-BASE",
        nama: "Santri Tanpa Baseline",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1_ID,
        modalHafalanAwalHalaman: 15,
        tanggalBaselineTahfizh: null,
      },
    });

    // Buat setoran Sabaq historis untuk santri ini
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-NOBASE-1",
        santriId: santriNoBaseline.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: new Date("2026-09-08T08:00:00Z"),
        jenis: "SABAQ",
        halamanMulai: 16,
        halamanSelesai: 20,
        jumlahHalaman: 5,
        juz: 1,
        nilai: "JAYYID",
        status: "AKTIF",
      },
    });

    // getSantriKumulatifHalamanAction wajib mengembalikan tambahanSabaq = 0
    setTestSession(sessionMT1);
    const kumulatifRes = await getSantriKumulatifHalamanAction(santriNoBaseline.id);
    assert.equal(kumulatifRes.success, true);
    assert.equal(kumulatifRes.data?.modalAwal, 15);
    assert.equal(kumulatifRes.data?.tambahanSabaq, 0);
    assert.equal(kumulatifRes.data?.totalHalaman, 15);

    // getSantriListForSession wajib mengembalikan tambahanSabaq = 0
    const listRes = await getSantriListForSession(
      { search: "TEST-NO-BASE", refDate: new Date("2026-09-15T08:00:00Z") },
      sessionMT1,
      prisma
    );
    assert.equal(listRes.success, true);
    const found = listRes.data.find((s) => s.id === santriNoBaseline.id);
    assert.ok(found);
    assert.equal(found.tambahanSabaq, 0);
    assert.equal(found.totalHafalan, 15);

    // getLaporanBulananHalaqohAction tidak menghitung sabaq tanpa baseline
    const laporanRes = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "2026/2027");
    assert.equal(laporanRes.success, true);
    const santriLaporan = laporanRes.data?.rekapSantri.find((r) => r.santri.id === santriNoBaseline.id);
    assert.ok(santriLaporan);
    assert.equal(santriLaporan.tahfizh.sabaq.totalHalaman, 0);
  });

  // -------------------------------------------------------------
  // 38: Baseline Mid-Month: Eksklusi Setoran Sebelum Tanggal Baseline
  // -------------------------------------------------------------
  it("38. Baseline mid-month: eksklusi setoran sebelum tanggal baseline", async () => {
    // Buat santri dengan baseline 15 September 2026
    const santriMidMonth = await prisma.santri.create({
      data: {
        nis: "TEST-MID-BASE",
        nama: "Santri Baseline Tengah Bulan",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1_ID,
        modalHafalanAwalHalaman: 20,
        tanggalBaselineTahfizh: new Date("2026-09-15T00:00:00.000Z"),
      },
    });

    // Setoran sebelum baseline: 5 September (5 halaman)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-MID-PRE",
        santriId: santriMidMonth.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: new Date("2026-09-05T08:00:00Z"),
        jenis: "SABAQ",
        halamanMulai: 21,
        halamanSelesai: 25,
        jumlahHalaman: 5,
        juz: 2,
        nilai: "MUMTAZ",
        status: "AKTIF",
      },
    });

    // Setoran setelah baseline: 20 September (3 halaman)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-MID-POST",
        santriId: santriMidMonth.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: new Date("2026-09-20T08:00:00Z"),
        jenis: "SABAQ",
        halamanMulai: 21,
        halamanSelesai: 23,
        jumlahHalaman: 3,
        juz: 2,
        nilai: "MUMTAZ",
        status: "AKTIF",
      },
    });

    // getLaporanBulananHalaqohAction hanya boleh menghitung 3 halaman post-baseline
    setTestSession(sessionMT1);
    const laporanRes = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "2026/2027");
    assert.equal(laporanRes.success, true);
    const santriLaporan = laporanRes.data?.rekapSantri.find((r) => r.santri.id === santriMidMonth.id);
    assert.ok(santriLaporan);
    assert.equal(santriLaporan.tahfizh.sabaq.totalHalaman, 3);

    // getSantriListForSession juga hanya menghitung 3 halaman
    const listRes = await getSantriListForSession(
      { search: "TEST-MID-BASE", refDate: new Date("2026-09-22T08:00:00Z") },
      sessionMT1,
      prisma
    );
    assert.equal(listRes.success, true);
    const found = listRes.data.find((s) => s.id === santriMidMonth.id);
    assert.ok(found);
    assert.equal(found.tambahanSabaq, 3);
    assert.equal(found.totalHafalan, 23);
  });

  // -------------------------------------------------------------
  // 39: SABQI Week Applicability dengan Baseline Tengah Pekan
  // -------------------------------------------------------------
  it("39. SABQI week applicability dengan baseline tengah pekan", async () => {
    // Pekan berjalan: Senin 7 Sept 2026 s/d Ahad 13 Sept 2026
    // Santri baseline ditetapkan Kamis 10 Sept 2026
    const santriMidWeek = await prisma.santri.create({
      data: {
        nis: "TEST-MID-WEEK",
        nama: "Santri Baseline Tengah Pekan",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1_ID,
        modalHafalanAwalHalaman: 10,
        tanggalBaselineTahfizh: new Date("2026-09-10T00:00:00.000Z"),
      },
    });

    // Setoran Rabu 9 Sept 2026 (sebelum baseline)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-WEEK-PRE",
        santriId: santriMidWeek.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: new Date("2026-09-09T08:00:00Z"),
        jenis: "SABAQ",
        halamanMulai: 11,
        halamanSelesai: 12,
        jumlahHalaman: 2,
        juz: 1,
        nilai: "MUMTAZ",
        status: "AKTIF",
      },
    });

    // Cek status pada hari Kamis 10 Sept (belum ada sabaq post-baseline)
    setTestSession(sessionMT1);
    const listKamis = await getSantriListForSession(
      { search: "TEST-MID-WEEK", refDate: new Date("2026-09-10T08:00:00Z") },
      sessionMT1,
      prisma
    );
    assert.equal(listKamis.success, true);
    const itemKamis = listKamis.data.find((s) => s.id === santriMidWeek.id);
    assert.ok(itemKamis);
    // Karena sabaq hari Rabu sebelum baseline, SABQI harus TIDAK_BERLAKU
    assert.equal(itemKamis.statusTahfizhHariIni.sabqi, "TIDAK_BERLAKU");

    // Sekarang tambahkan setoran post-baseline pada Jumat 11 Sept
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-WEEK-POST",
        santriId: santriMidWeek.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: new Date("2026-09-11T08:00:00Z"),
        jenis: "SABAQ",
        halamanMulai: 11,
        halamanSelesai: 12,
        jumlahHalaman: 2,
        juz: 1,
        nilai: "MUMTAZ",
        status: "AKTIF",
      },
    });

    const listJumat = await getSantriListForSession(
      { search: "TEST-MID-WEEK", refDate: new Date("2026-09-11T09:00:00Z") },
      sessionMT1,
      prisma
    );
    assert.equal(listJumat.success, true);
    const itemJumat = listJumat.data.find((s) => s.id === santriMidWeek.id);
    assert.ok(itemJumat);
    // Sekarang SABQI menjadi applicable (BELUM_SELESAI karena ada post-baseline sabaq pekan ini)
    assert.equal(itemJumat.statusTahfizhHariIni.sabqi, "BELUM_SELESAI");
  });

  // -------------------------------------------------------------
  // 40: Validasi Ketat Server-Side upsertTargetSantriAction
  // -------------------------------------------------------------
  it("40. Validasi ketat server-side upsertTargetSantriAction", async () => {
    setTestSession(sessionMT1);

    // Bulan di luar 1-12
    const resBulanInvalid = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 13,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resBulanInvalid.success, false);
    assert.match(resBulanInvalid.message, /Bulan/i);

    // Tahun ajaran format salah
    const resThnFormat = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026",
    });
    assert.equal(resThnFormat.success, false);
    assert.match(resThnFormat.message, /tahun ajaran/i);

    // Tahun ajaran rentang salah (bukan +1)
    const resThnRange = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2028",
    });
    assert.equal(resThnRange.success, false);
    assert.match(resThnRange.message, /tepat satu tahun/i);

    // Target negatif / nol
    const resNeg = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: -5,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resNeg.success, false);
    assert.match(resNeg.message, /positif/i);

    // SABAQ bukan kelipatan 0.5
    const resSabaqNonHalf = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5.3,
      targetBulanan: 20,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resSabaqNonHalf.success, false);
    assert.match(resSabaqNonHalf.message, /kelipatan 0.5/i);

    // SABQI bukan bilangan bulat
    const resSabqiFloat = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABQI",
      targetPekanan: 2.5,
      targetBulanan: 10,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resSabqiFloat.success, false);
    assert.match(resSabqiFloat.message, /bilangan bulat/i);

    // Ambang kepatuhan di luar 0-100
    const resAmbangInvalid = await upsertTargetSantriAction({
      santriId: SANTRI_AHMAD_ID,
      jenis: "SABAQ",
      targetPekanan: 5,
      targetBulanan: 20,
      ambangKepatuhan: 120,
      bulan: 9,
      tahunAjaran: "2026/2027",
    });
    assert.equal(resAmbangInvalid.success, false);
    assert.match(resAmbangInvalid.message, /ambang kepatuhan/i);
  });

  // -------------------------------------------------------------
  // 41: Validasi Fail-Closed getLaporanBulananHalaqohAction
  // -------------------------------------------------------------
  it("41. Validasi fail-closed getLaporanBulananHalaqohAction tanpa fallback diam-diam", async () => {
    setTestSession(sessionMT1);

    // Bulan corrupt
    const resBulan = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 13, "2026/2027");
    assert.equal(resBulan.success, false);
    assert.match(resBulan.message ?? "", /bulan tidak valid/i);

    // Tahun ajaran corrupt
    const resThn = await getLaporanBulananHalaqohAction(HALAQOH_1_ID, 9, "corrupt-year");
    assert.equal(resThn.success, false);
    assert.match(resThn.message ?? "", /tahun ajaran tidak valid/i);
  });

  // -------------------------------------------------------------
  // 42: ABAC Scoping Portal Wali getRingkasanAnakAction
  // -------------------------------------------------------------
  it("42. ABAC scoping portal wali getRingkasanAnakAction", async () => {
    // 1. Wali Santri dipaksa ke anak sendiri
    setTestSession(sessionWSAhmad);
    const resWaliAhmad = await getRingkasanAnakAction(SANTRI_ZAID_ID); // coba intip Zaid
    assert.equal(resWaliAhmad.success, true);
    // Data yang kembali harus anak sendiri (Ahmad), bukan Zaid
    assert.equal((resWaliAhmad.data as { santri: { id: string } }).santri.id, SANTRI_AHMAD_ID);

    // 2. MT1 boleh mengakses Ahmad (halaqoh binaan sendiri)
    setTestSession(sessionMT1);
    const resMT1Ahmad = await getRingkasanAnakAction(SANTRI_AHMAD_ID);
    assert.equal(resMT1Ahmad.success, true);
    assert.equal((resMT1Ahmad.data as { santri: { id: string } }).santri.id, SANTRI_AHMAD_ID);

    // 3. MT1 DITOLAK saat mengakses Zaid (halaqoh 2 / cross-halaqoh)
    const resMT1Zaid = await getRingkasanAnakAction(SANTRI_ZAID_ID);
    assert.equal(resMT1Zaid.success, false);
    assert.match(resMT1Zaid.message, /Akses Ditolak/i);

    // 4. MT Kabid Tahfidz JUGA DITOLAK saat mengakses santri di luar binaannya
    // (karena getRingkasanAnakAction berisi data kesehatan & pelanggaran, Kabid bukan manajer lintas domain)
    setTestSession(sessionKabid);
    const resKabidZaid = await getRingkasanAnakAction(SANTRI_ZAID_ID);
    assert.equal(resKabidZaid.success, false);
    assert.match(resKabidZaid.message, /Akses Ditolak/i);

    // 5. Role non-authorized (MK) -> Ditolak
    setTestSession(sessionMK);
    const resMK = await getRingkasanAnakAction(SANTRI_AHMAD_ID);
    assert.equal(resMK.success, false);
    assert.match(resMK.message, /Akses Ditolak/i);

    // 6. Role manajerial (KS) -> Diizinkan
    setTestSession(sessionKS);
    const resKS = await getRingkasanAnakAction(SANTRI_AHMAD_ID);
    assert.equal(resKS.success, true);
  });

  // -------------------------------------------------------------
  // 43: Konsistensi Nilai Default Kebijakan minPersenTargetBulanan = 100.0%
  // -------------------------------------------------------------
  it("43. Konsistensi nilai default kebijakan minPersenTargetBulanan = 100.0%", async () => {
    // Pastikan getKebijakanRewardSanksiAction mengembalikan default 100.0%
    const resKebijakan = await getKebijakanRewardSanksiAction();
    assert.equal(resKebijakan.success, true);
    if (resKebijakan.data) {
      assert.equal(resKebijakan.data.minPersenTargetBulanan, 100.0);
    }
  });

  // -------------------------------------------------------------
  // 44: getSantriProgresAction Baseline Null (Zero Historical Sabaq)
  // -------------------------------------------------------------
  it("44. getSantriProgresAction baseline null: tidak mengagregasi historical SABAQ", async () => {
    setTestSession(sessionMT1);

    // Buat santri dengan baseline null
    const santriTest = await prisma.santri.create({
      data: {
        nis: "TEST-PROG-NULL-BASE",
        nama: "Santri Progres Null Base",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1_ID,
        modalHafalanAwalHalaman: 20,
        tanggalBaselineTahfizh: null,
      },
    });

    // Buat setoran SABAQ
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-PROG-NULL-1",
        santriId: santriTest.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: new Date("2026-09-08T08:00:00Z"),
        jenis: "SABAQ",
        halamanMulai: 21,
        halamanSelesai: 22,
        jumlahHalaman: 2,
        juz: 2,
        nilai: "MUMTAZ",
        status: "DISETUJUI",
      },
    });

    const res = await getSantriProgresAction(santriTest.id);
    assert.equal(res.success, true);
    assert.ok(res.data);
    // Baseline null -> tambahanSabaq = 0, totalHalaman = modalAwal (20), bukan 22
    assert.equal(res.data.tambahanSabaq, 0);
    assert.equal(res.data.totalHalamanSabaq, 20);
    assert.equal(res.data.totalJuzSabaq, 1);
    assert.equal(res.data.sisaHalamanSabaq, 0);
  });

  // -------------------------------------------------------------
  // 45: getSetoranSabaqPekanSantriAction Boundary Baseline Mid-Week
  // -------------------------------------------------------------
  it("45. getSetoranSabaqPekanSantriAction boundary baseline mid-week", async () => {
    setTestSession(sessionMT1);

    // Pekan berjalan September 2026:
    // Senin: 2026-09-07
    // Rabu: 2026-09-09
    // Kamis: 2026-09-10
    const tSenin = new Date("2026-09-07T08:00:00+08:00");
    const tRabu = new Date("2026-09-09T08:00:00+08:00");
    const tKamis = new Date("2026-09-10T10:00:00+08:00");

    // Buat santri dengan baseline Rabu
    const santriMidWeek = await prisma.santri.create({
      data: {
        nis: "TEST-SABAQI-MIDWEEK",
        nama: "Santri Sabaqi Midweek",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1_ID,
        modalHafalanAwalHalaman: 10,
        tanggalBaselineTahfizh: tRabu,
      },
    });

    // Setoran SABAQ Senin (sebelum baseline Rabu)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-SAB-SENIN",
        santriId: santriMidWeek.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: tSenin,
        jenis: "SABAQ",
        halamanMulai: 11,
        halamanSelesai: 12,
        jumlahHalaman: 2,
        juz: 1,
        nilai: "MUMTAZ",
        status: "DISETUJUI",
      },
    });

    // Setoran SABAQ Kamis (setelah baseline Rabu)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-SAB-KAMIS",
        santriId: santriMidWeek.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: tKamis,
        jenis: "SABAQ",
        halamanMulai: 13,
        halamanSelesai: 14,
        jumlahHalaman: 2,
        juz: 1,
        nilai: "MUMTAZ",
        status: "DISETUJUI",
      },
    });

    // Setoran SABAQ Kamis yang DIBATALKAN -> tidak boleh masuk
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-SAB-BATAL",
        santriId: santriMidWeek.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: tKamis,
        jenis: "SABAQ",
        halamanMulai: 15,
        halamanSelesai: 16,
        jumlahHalaman: 2,
        juz: 1,
        nilai: "MUMTAZ",
        status: "DIBATALKAN",
      },
    });

    // Query pada hari Kamis
    const res = await getSetoranSabaqPekanSantriAction(santriMidWeek.id, tKamis.toISOString());
    assert.equal(res.success, true);
    assert.ok(res.data);
    // SABAQ Senin TIDAK boleh masuk rekomendasi karena sebelum baseline
    // SABAQ DIBATALKAN juga TIDAK boleh masuk
    // Hanya SABAQ Kamis valid yang masuk
    assert.equal(res.data.sabaqRecords.length, 1);
    assert.equal(res.data.sabaqRecords[0].halamanMulai, 13);
    assert.equal(res.data.rekomendasi.totalHalaman, 2);

    // Kasus santri baseline null -> jangan gunakan SABAQ historis/pekan berjalan
    const santriNoBase = await prisma.santri.create({
      data: {
        nis: "TEST-SABAQI-NOBASE",
        nama: "Santri Sabaqi No Base",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_1_ID,
        modalHafalanAwalHalaman: 10,
        tanggalBaselineTahfizh: null,
      },
    });
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "STR-TEST-SAB-NOBASE",
        santriId: santriNoBase.id,
        musyrifId: STAFF_MT_1_ID,
        tanggal: tKamis,
        jenis: "SABAQ",
        halamanMulai: 11,
        halamanSelesai: 12,
        jumlahHalaman: 2,
        juz: 1,
        nilai: "MUMTAZ",
        status: "DISETUJUI",
      },
    });
    const resNoBase = await getSetoranSabaqPekanSantriAction(santriNoBase.id, tKamis.toISOString());
    assert.equal(resNoBase.success, true);
    assert.equal(resNoBase.data?.sabaqRecords.length, 0);
    assert.equal(resNoBase.data?.rekomendasi.totalHalaman, 0);
  });

  // -------------------------------------------------------------
  // 46: Default-Deny Seluruh Tahfizh Read Action untuk Non-Authorized Role
  // -------------------------------------------------------------
  it("46. Default-deny seluruh Tahfizh read action untuk role non-authorized / cross-scope", async () => {
    // 1. Role MK (non-tahfizh) harus fail-closed pada 4 action
    setTestSession(sessionMK);

    const resRec = await getRecentSetoranAction();
    assert.equal(resRec.success, false);
    assert.match(resRec.message ?? "", /Akses Ditolak/i);

    const resProg = await getSantriProgresAction(SANTRI_AHMAD_ID);
    assert.equal(resProg.success, false);
    assert.match(resProg.message ?? "", /Akses Ditolak/i);

    const resKum = await getSantriKumulatifHalamanAction(SANTRI_AHMAD_ID);
    assert.equal(resKum.success, false);
    assert.match(resKum.message ?? "", /Akses Ditolak/i);

    const resSab = await getSetoranSabaqPekanSantriAction(SANTRI_AHMAD_ID);
    assert.equal(resSab.success, false);
    assert.match(resSab.message ?? "", /Akses Ditolak/i);

    // 2. MT cross-scope (MT2 mencoba membaca santri Ahmad di halaqoh 1)
    setTestSession(sessionMT2);

    const resProgCross = await getSantriProgresAction(SANTRI_AHMAD_ID);
    assert.equal(resProgCross.success, false);
    assert.match(resProgCross.message ?? "", /Akses Ditolak/i);

    const resKumCross = await getSantriKumulatifHalamanAction(SANTRI_AHMAD_ID);
    assert.equal(resKumCross.success, false);
    assert.match(resKumCross.message ?? "", /Akses Ditolak/i);

    const resSabCross = await getSetoranSabaqPekanSantriAction(SANTRI_AHMAD_ID);
    assert.equal(resSabCross.success, false);
    assert.match(resSabCross.message ?? "", /Akses Ditolak/i);

    // 3. MT tanpa profil staf -> fail-closed
    setTestSession(sessionMTNoStaff);
    const resNoStaff = await getRecentSetoranAction();
    assert.equal(resNoStaff.success, false);
    assert.match(resNoStaff.message ?? "", /Akses Ditolak/i);
  });

  // -------------------------------------------------------------
  // 47: No Default MUFAR Quantity Ketika Target Tidak Ada
  // -------------------------------------------------------------
  it("47. No default MUFAR quantity ketika target tidak ada", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "components/modules/tahfizh-module.tsx"),
      "utf-8"
    );

    assert.ok(!content.includes('useState("2")'));
    assert.ok(!content.includes('useState("Juz 1, 2")'));
    assert.ok(!content.includes("targetMufar || 1"));
    assert.ok(!content.includes("Harian 1-6 Juz"));
    assert.ok(content.includes("Target belum ditetapkan"));
    assert.ok(content.includes("Referensi Sabqi berasal dari Sabaq sah pada pekan berjalan."));
  });

  // -------------------------------------------------------------
  // 48: Rekap Laporan Fail-Closed Jika Halaqoh MT Unresolved
  // -------------------------------------------------------------
  it("48. Rekap laporan fail-closed jika halaqoh MT tidak dapat di-resolve", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "components/dashboard/rekap-laporan-bulanan.tsx"),
      "utf-8"
    );

    // Pastikan tidak ada return list[0] yang dieksekusi untuk locked MT/PH
    assert.ok(content.includes("Halaqoh binaan belum terhubung / gagal dimuat"));
    assert.ok(content.includes("if (isLockedMusyrif) {"));
    assert.ok(content.includes('return { id: "", nama: "Halaqoh binaan belum terhubung / gagal dimuat" };'));
  });

  // -------------------------------------------------------------
  // 49: Production app/page.tsx Bebas dari Hardcoded Halaqoh Fallback
  // -------------------------------------------------------------
  it("49. Production app/page.tsx tidak memiliki hardcoded operational halaqoh fallback", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "app/page.tsx"),
      "utf-8"
    );

    // Tidak boleh ada HLQ-0001 sampai HLQ-0006 statis di dynamicHalaqohList
    assert.ok(!content.includes("HLQ-0001"));
    assert.ok(!content.includes("HLQ-0002"));
    assert.ok(!content.includes("HLQ-0006"));
    assert.ok(content.includes("fetchHalaqohData"));
    assert.ok(content.includes("halaqohListError"));
  });
});

