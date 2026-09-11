// Test Khusus Verifikasi Penentuan Status Setoran Hari Ini Berdasarkan Batas Hari WITA (Asia/Makassar)
// Menjamin:
// 1. Setoran hari ini (WITA) menghasilkan sudahSetorHariIni = true
// 2. Setoran kemarin (WITA) menghasilkan sudahSetorHariIni = false
// 3. Setoran sekitar batas pergantian hari UTC/WITA terhitung presisi
// 4. Setoran berstatus DIBATALKAN tidak pernah dihitung sebagai sudah setor

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  startTestDatabase,
  stopTestDatabase,
} from "./test-db-manager";
import { isTodayWita, getWitaDateString, parseWITADate } from "../lib/wita-date";

describe("Verifikasi Status Setoran Hari Ini Berbasis Zona Waktu WITA & Status DIBATALKAN", () => {
  let prisma: PrismaClient;

  const SANTRI_ID_TODAY = "santri-wita-today-01";
  const SANTRI_ID_YESTERDAY = "santri-wita-yesterday-02";
  const SANTRI_ID_CANCELLED = "santri-wita-cancelled-03";
  const SANTRI_ID_BOUNDARY = "santri-wita-boundary-04";

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
    const todayMiddayWita = new Date(parseWITADate(todayWitaStr).getTime() + 10 * 3600 * 1000); // pukul 10:00 WITA hari ini
    const yesterdayWitaDate = new Date(parseWITADate(todayWitaStr).getTime() - 4 * 3600 * 1000); // pukul 20:00 WITA kemarin malam

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
    const earlyMorningWita = new Date(parseWITADate(todayWitaStr).getTime() + 5 * 60 * 1000); // 00:05 WITA
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

  it("harus menandai sudahSetorHariIni = true untuk setoran aktif pada hari ini WITA", async () => {
    const setoran = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_TODAY, status: { not: "DIBATALKAN" } },
      orderBy: { tanggal: "desc" },
    });
    assert.ok(setoran);
    assert.equal(isTodayWita(setoran.tanggal), true);
  });

  it("harus menandai sudahSetorHariIni = false untuk setoran kemarin WITA", async () => {
    const setoran = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_YESTERDAY, status: { not: "DIBATALKAN" } },
      orderBy: { tanggal: "desc" },
    });
    assert.ok(setoran);
    assert.equal(isTodayWita(setoran.tanggal), false);
  });

  it("harus menandai sudahSetorHariIni = true untuk setoran jam 00:05 WITA (meski masih kemarin di UTC)", async () => {
    const setoran = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_BOUNDARY, status: { not: "DIBATALKAN" } },
      orderBy: { tanggal: "desc" },
    });
    assert.ok(setoran);
    // Jam 00:05 WITA adalah tanggal hari ini di WITA
    assert.equal(isTodayWita(setoran.tanggal), true);
  });

  it("tidak boleh menghitung setoran yang berstatus DIBATALKAN", async () => {
    // Query hanya yang bukan DIBATALKAN
    const validSetoran = await prisma.setoranTahfizh.findFirst({
      where: { santriId: SANTRI_ID_CANCELLED, status: { not: "DIBATALKAN" } },
    });
    assert.equal(validSetoran, null);

    // Santri ini tidak memiliki setoran aktif, sehingga status sudahSetorHariIni harus false
    const allValid = await prisma.setoranTahfizh.findMany({
      where: { santriId: SANTRI_ID_CANCELLED, status: "AKTIF" },
    });
    const sudahSetor = allValid.some((st) => isTodayWita(st.tanggal));
    assert.equal(sudahSetor, false);
  });
});
