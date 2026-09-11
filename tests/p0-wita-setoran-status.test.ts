// Test Khusus Verifikasi Penentuan Status Setoran Hari Ini Berdasarkan Batas Hari WITA (Asia/Makassar)
// Menjamin Pengujian Terintegrasi Jalur Produksi Server Action (getSantriListAction):
// 1. sudahSetorHariIni = true untuk setoran aktif hari ini (WITA)
// 2. sudahSetorHariIni = false untuk setoran kemarin (WITA)
// 3. sudahSetorHariIni = true untuk setoran pada batas pergantian hari 00:05 WITA
// 4. setoran berstatus DIBATALKAN tidak dihitung (sudahSetorHariIni = false, setoranTerakhirAt = null)
// 5. setoranTerakhirAt memetakan ISO timestamp aktual setoran valid terakhir

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  startTestDatabase,
  stopTestDatabase,
} from "./test-db-manager";
import { isTodayWita, getWitaDateString, parseWITADate } from "../lib/wita-date";
import { getSantriListForSession } from "../lib/server/santri-list-service";
import { UserSession } from "../types/auth";

describe("Verifikasi Status Setoran Hari Ini Berbasis Zona Waktu WITA & Jalur Produksi getSantriListAction", () => {
  let prisma: PrismaClient;

  const SANTRI_ID_TODAY = "santri-wita-today-01";
  const SANTRI_ID_YESTERDAY = "santri-wita-yesterday-02";
  const SANTRI_ID_CANCELLED = "santri-wita-cancelled-03";
  const SANTRI_ID_BOUNDARY = "santri-wita-boundary-04";

  const sessionMT: UserSession = {
    userId: "usr-wita-tester",
    username: "pembina.wita",
    role: "MT",
    staffId: "staff-wita-test-01",
    staffCode: "STF-WITA-01",
    name: "Ust. Pembina WITA",
    halaqohName: "Halaqoh Uji WITA",
    isKepalaBidangTahfidz: false,
    isPetugasPresensiPutri: false,
  };

  let todayMiddayWita: Date;
  let yesterdayWitaDate: Date;
  let earlyMorningWita: Date;

  before(async () => {
    prisma = await startTestDatabase();

    // Siapkan Staff & Halaqoh minimal untuk test
    await prisma.staff.create({
      data: {
        id: "staff-wita-test-01",
        staffCode: "STF-WITA-01",
        nama: "Ust. Pembina WITA",
        roleStaff: "MT",
        status: "AKTIF",
        noHp: "081234567890",
      },
    });

    await prisma.halaqoh.create({
      data: {
        id: "halaqoh-wita-test-01",
        halaqohCode: "HLQ-WITA-01",
        nama: "Halaqoh Uji WITA",
        pembinaId: "staff-wita-test-01",
        tahunAjaran: "2026/2027",
        status: "AKTIF",
      },
    });

    // Buat 4 Santri Uji
    const santriData = [
      { id: SANTRI_ID_TODAY, nis: "WITA-001", nama: "Santri Setor Hari Ini" },
      { id: SANTRI_ID_YESTERDAY, nis: "WITA-002", nama: "Santri Setor Kemarin" },
      { id: SANTRI_ID_CANCELLED, nis: "WITA-003", nama: "Santri Setoran Dibatalkan" },
      { id: SANTRI_ID_BOUNDARY, nis: "WITA-004", nama: "Santri Batas Jam Pergantian Hari" },
    ];

    for (const s of santriData) {
      await prisma.santri.create({
        data: {
          id: s.id,
          nis: s.nis,
          nama: s.nama,
          kelas: "7A",
          jenisKelamin: "L",
          halaqohId: "halaqoh-wita-test-01",
          modalHafalanAwalHalaman: 100,
          status: "AKTIF",
        },
      });
    }

    // Hitung tanggal hari ini di WITA
    const now = new Date();
    const todayWitaStr = getWitaDateString(now); // e.g. "2026-09-11"
    todayMiddayWita = new Date(parseWITADate(todayWitaStr).getTime() + 10 * 3600 * 1000); // pukul 10:00 WITA hari ini
    yesterdayWitaDate = new Date(parseWITADate(todayWitaStr).getTime() - 4 * 3600 * 1000); // pukul 20:00 WITA kemarin malam

    // 1. Setoran santri 1: AKTIF pada hari ini WITA
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-WITA-TODAY",
        santriId: SANTRI_ID_TODAY,
        musyrifId: "staff-wita-test-01",
        tanggal: todayMiddayWita,
        jenis: "SABAQ",
        juz: 6,
        halamanMulai: 101,
        halamanSelesai: 101,
        jumlahHalaman: 1.0,
        nilai: "MUMTAZ",
        status: "AKTIF",
        createdBy: "tester",
      },
    });

    // 2. Setoran santri 2: AKTIF kemarin WITA
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-WITA-YESTERDAY",
        santriId: SANTRI_ID_YESTERDAY,
        musyrifId: "staff-wita-test-01",
        tanggal: yesterdayWitaDate,
        jenis: "SABAQ",
        juz: 6,
        halamanMulai: 101,
        halamanSelesai: 101,
        jumlahHalaman: 1.0,
        nilai: "JAYYID_JIDDAN",
        status: "AKTIF",
        createdBy: "tester",
      },
    });

    // 3. Setoran santri 3: dibuat hari ini WITA tetapi berstatus DIBATALKAN
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-WITA-CANCELLED",
        santriId: SANTRI_ID_CANCELLED,
        musyrifId: "staff-wita-test-01",
        tanggal: todayMiddayWita,
        jenis: "SABAQ",
        juz: 6,
        halamanMulai: 101,
        halamanSelesai: 101,
        jumlahHalaman: 1.0,
        nilai: "MUMTAZ",
        status: "DIBATALKAN",
        catatan: "Dibatalkan karena salah input nama santri",
        createdBy: "tester",
      },
    });

    // 4. Setoran santri 4: tepat di awal hari WITA (00:05 WITA = jam 16:05 UTC kemarin)
    earlyMorningWita = new Date(parseWITADate(todayWitaStr).getTime() + 5 * 60 * 1000); // 00:05 WITA
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-WITA-BOUNDARY",
        santriId: SANTRI_ID_BOUNDARY,
        musyrifId: "staff-wita-test-01",
        tanggal: earlyMorningWita,
        jenis: "SABAQ",
        juz: 6,
        halamanMulai: 101,
        halamanSelesai: 101,
        jumlahHalaman: 1.0,
        nilai: "MUMTAZ",
        status: "AKTIF",
        createdBy: "tester",
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. jalur produksi getSantriListAction: menandai sudahSetorHariIni = true dan setoranTerakhirAt untuk setoran aktif hari ini", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);
    const santriToday = res.data.find((s) => s.id === SANTRI_ID_TODAY);
    assert.ok(santriToday);
    assert.equal(santriToday.sudahSetorHariIni, true);
    assert.equal(santriToday.setoranTerakhirAt, todayMiddayWita.toISOString());
  });

  it("2. jalur produksi getSantriListAction: menandai sudahSetorHariIni = false dan setoranTerakhirAt kemarin untuk setoran kemarin", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);
    const santriYesterday = res.data.find((s) => s.id === SANTRI_ID_YESTERDAY);
    assert.ok(santriYesterday);
    assert.equal(santriYesterday.sudahSetorHariIni, false);
    assert.equal(santriYesterday.setoranTerakhirAt, yesterdayWitaDate.toISOString());
  });

  it("3. jalur produksi getSantriListAction: menandai sudahSetorHariIni = true untuk setoran pada batas jam 00:05 WITA", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);
    const santriBoundary = res.data.find((s) => s.id === SANTRI_ID_BOUNDARY);
    assert.ok(santriBoundary);
    assert.equal(santriBoundary.sudahSetorHariIni, true);
    assert.equal(santriBoundary.setoranTerakhirAt, earlyMorningWita.toISOString());
  });

  it("4. jalur produksi getSantriListAction: mengecualikan setoran DIBATALKAN sehingga sudahSetorHariIni = false dan setoranTerakhirAt = null", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);
    const santriCancelled = res.data.find((s) => s.id === SANTRI_ID_CANCELLED);
    assert.ok(santriCancelled);
    assert.equal(santriCancelled.sudahSetorHariIni, false);
    assert.equal(santriCancelled.setoranTerakhirAt, null, "Setoran berstatus DIBATALKAN tidak boleh menjadi setoranTerakhirAt");
  });

  it("5. fungsi utilitas isTodayWita() konsisten dengan query langsung database", async () => {
    const setoranToday = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_TODAY, status: "AKTIF" },
    });
    assert.ok(setoranToday);
    assert.equal(isTodayWita(setoranToday.tanggal), true);

    const setoranYesterday = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_YESTERDAY, status: "AKTIF" },
    });
    assert.ok(setoranYesterday);
    assert.equal(isTodayWita(setoranYesterday.tanggal), false);

    const setoranBoundary = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_BOUNDARY, status: "AKTIF" },
    });
    assert.ok(setoranBoundary);
    assert.equal(isTodayWita(setoranBoundary.tanggal), true);
  });
});
