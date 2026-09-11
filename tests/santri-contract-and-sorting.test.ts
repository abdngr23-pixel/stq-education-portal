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
import { getSantriListForSession } from "../lib/server/santri-list-service";
import { UserSession } from "../types/auth";

describe("Verifikasi Kontrak Data, Sorting Gender & Bintang Kebaikan getSantriListForSession", () => {
  let prisma: PrismaClient;

  const STAFF_ID = "staff-sorting-01";
  const HALAQOH_ID = "halaqoh-sorting-01";

  const sessionMT: UserSession = {
    userId: "user-sorting-01",
    username: "musyrif_sorting",
    name: "Musyrif Sorting Test",
    role: "MT",
    staffId: STAFF_ID,
  };

  before(async () => {
    prisma = await startTestDatabase();

    // Seed Staff
    await prisma.staff.create({
      data: {
        id: STAFF_ID,
        staffCode: "STF-SORTING-01",
        nama: "Musyrif Sorting Test",
        roleStaff: "MT",
        status: "AKTIF",
        noHp: "081234567890",
      },
    });

    // Seed Halaqoh
    await prisma.halaqoh.create({
      data: {
        id: HALAQOH_ID,
        halaqohCode: "HLQ-SORTING-01",
        nama: "Halaqoh Uji Sorting",
        pembinaId: STAFF_ID,
        tahunAjaran: "2026/2027",
        status: "AKTIF",
      },
    });

    // Seed Santri:
    // Ikhwan (L):
    // 1. Ikhwan 2: NIS "IKH-002", Nama "Zaenal Ikhwan"
    // 2. Ikhwan 1: NIS "IKH-001", Nama "Ahmad Ikhwan"
    await prisma.santri.create({
      data: {
        id: "santri-ikh-02",
        nis: "IKH-002",
        nama: "Zaenal Ikhwan",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_ID,
      },
    });

    await prisma.santri.create({
      data: {
        id: "santri-ikh-01",
        nis: "IKH-001",
        nama: "Ahmad Ikhwan",
        kelas: "7A",
        jenisKelamin: "L",
        status: "AKTIF",
        halaqohId: HALAQOH_ID,
      },
    });

    // Akhwat (P):
    // 1. Akhwat Zahra: NIS "AKH-999", Nama "Zahra Akhwat"
    // 2. Akhwat Aisyah: NIS "AKH-111", Nama "Aisyah Akhwat"
    // 3. Akhwat Fatimah: NIS "AKH-555", Nama "Fatimah Akhwat"
    await prisma.santri.create({
      data: {
        id: "santri-akh-03",
        nis: "AKH-999",
        nama: "Zahra Akhwat",
        kelas: "7B",
        jenisKelamin: "P",
        status: "AKTIF",
        halaqohId: HALAQOH_ID,
      },
    });

    await prisma.santri.create({
      data: {
        id: "santri-akh-01",
        nis: "AKH-111",
        nama: "Aisyah Akhwat",
        kelas: "7B",
        jenisKelamin: "P",
        status: "AKTIF",
        halaqohId: HALAQOH_ID,
      },
    });

    await prisma.santri.create({
      data: {
        id: "santri-akh-02",
        nis: "AKH-555",
        nama: "Fatimah Akhwat",
        kelas: "7B",
        jenisKelamin: "P",
        status: "AKTIF",
        halaqohId: HALAQOH_ID,
      },
    });

    // Seed Bintang Kebaikan:
    // Ahmad Ikhwan (santri-ikh-01) memiliki 2 bintang di BintangSantri
    await prisma.bintangSantri.create({
      data: {
        santriId: "santri-ikh-01",
        periode: "September 2026",
        kategori: "TAHFIZH",
        prestasi: "Prestasi Tahfizh 1",
      },
    });
    await prisma.bintangSantri.create({
      data: {
        santriId: "santri-ikh-01",
        periode: "September 2026",
        kategori: "KEDISIPLINAN",
        prestasi: "Disiplin Tepat Waktu",
      },
    });

    // Zaenal Ikhwan (santri-ikh-02) memiliki 0 bintang di BintangSantri,
    // TETAPI memiliki setoran dengan nilai MUMTAZ (untuk membuktikan bintangKebaikan tidak mengambil dari setoran)
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-ZAENAL-MUMTAZ",
        santriId: "santri-ikh-02",
        musyrifId: STAFF_ID,
        tanggal: new Date("2026-09-10T10:00:00Z"),
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 2,
        jumlahHalaman: 2.0,
        nilai: "MUMTAZ",
        status: "AKTIF",
        createdBy: "tester",
      },
    });

    // Seed Setoran santri-akh-01 (Aisyah) dengan 2 setoran pada tanggal sama persis untuk menguji tie-breaker createdAt
    const sameDate = new Date("2026-09-10T08:00:00Z");
    const createdEarlier = new Date("2026-09-10T08:01:00Z");
    const createdLater = new Date("2026-09-10T08:05:00Z");

    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-AISYAH-01",
        santriId: "santri-akh-01",
        musyrifId: STAFF_ID,
        tanggal: sameDate,
        createdAt: createdEarlier,
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 5,
        jumlahHalaman: 5.0,
        nilai: "JAYYID",
        status: "AKTIF",
        createdBy: "tester",
      },
    });

    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-AISYAH-02",
        santriId: "santri-akh-01",
        musyrifId: STAFF_ID,
        tanggal: sameDate,
        createdAt: createdLater,
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 6,
        halamanSelesai: 10,
        jumlahHalaman: 5.0,
        nilai: "MUMTAZ",
        status: "AKTIF",
        createdBy: "tester",
      },
    });

    // Seed Setoran santri-akh-02 (Fatimah) dengan setoran terbaru DIBATALKAN dan setoran valid sebelumnya
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-FATIMAH-VALID",
        santriId: "santri-akh-02",
        musyrifId: STAFF_ID,
        tanggal: new Date("2026-09-09T08:00:00Z"),
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 4,
        jumlahHalaman: 4.0,
        nilai: "MUMTAZ",
        status: "AKTIF",
        createdBy: "tester",
      },
    });
    await prisma.setoranTahfizh.create({
      data: {
        setoranCode: "SET-FATIMAH-CANCELLED",
        santriId: "santri-akh-02",
        musyrifId: STAFF_ID,
        tanggal: new Date("2026-09-10T08:00:00Z"),
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 5,
        halamanSelesai: 8,
        jumlahHalaman: 4.0,
        nilai: "MUMTAZ",
        status: "DIBATALKAN",
        createdBy: "tester",
      },
    });
  });

  after(async () => {
    await stopTestDatabase();
  });

  it("1. Pengurutan santri memisahkan Ikhwan (berdasarkan NIS) dan Akhwat (berdasarkan Nama A-Z)", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);
    assert.equal(res.data.length, 5);

    // Dua santri pertama harus Ikhwan berurutan NIS
    assert.equal(res.data[0].id, "santri-ikh-01");
    assert.equal(res.data[0].nis, "IKH-001");
    assert.equal(res.data[0].nama, "Ahmad Ikhwan");

    assert.equal(res.data[1].id, "santri-ikh-02");
    assert.equal(res.data[1].nis, "IKH-002");
    assert.equal(res.data[1].nama, "Zaenal Ikhwan");

    // Tiga santri berikutnya harus Akhwat berurutan Nama alfabetis (Aisyah, Fatimah, Zahra)
    assert.equal(res.data[2].id, "santri-akh-01");
    assert.equal(res.data[2].nama, "Aisyah Akhwat");

    assert.equal(res.data[3].id, "santri-akh-02");
    assert.equal(res.data[3].nama, "Fatimah Akhwat");

    assert.equal(res.data[4].id, "santri-akh-03");
    assert.equal(res.data[4].nama, "Zahra Akhwat");
  });

  it("2. Field jenisKelamin disertakan pada setiap item SantriListItem", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);

    for (const santri of res.data) {
      assert.ok(
        santri.jenisKelamin === "L" || santri.jenisKelamin === "P",
        `jenisKelamin harus L atau P, didapatkan: ${santri.jenisKelamin}`
      );
    }

    assert.equal(res.data[0].jenisKelamin, "L");
    assert.equal(res.data[2].jenisKelamin, "P");
  });

  it("3. Sumber kebenaran bintangKebaikan adalah count bintangList di database, bukan setoran MUMTAZ", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);

    const ahmad = res.data.find((s) => s.id === "santri-ikh-01");
    const zaenal = res.data.find((s) => s.id === "santri-ikh-02");

    assert.ok(ahmad);
    assert.ok(zaenal);

    // Ahmad memiliki 2 record BintangSantri -> harus 2
    assert.equal(ahmad.bintangKebaikan, 2);

    // Zaenal memiliki 0 record BintangSantri meskipun memiliki setoran MUMTAZ -> harus 0
    assert.equal(zaenal.bintangKebaikan, 0);
  });

  it("4. Pengurutan setoran deterministik dengan createdAt desc sebagai tie-breaker pada tanggal yang sama", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);

    const aisyah = res.data.find((s) => s.id === "santri-akh-01");
    assert.ok(aisyah);

    // SET-AISYAH-02 dibuat belakangan (Hlm 6-10, MUMTAZ), harus terpilih dibanding SET-AISYAH-01 (Hlm 1-5, JAYYID)
    assert.equal(aisyah.setoranTerakhir, "SABAQ Juz 1 Hlm 6-10");
    assert.equal(aisyah.nilaiTerakhir, "MUMTAZ");
  });

  it("5. Setoran berstatus DIBATALKAN diabaikan dalam penentuan setoran terakhir", async () => {
    const res = await getSantriListForSession(undefined, sessionMT, prisma);
    assert.equal(res.success, true);

    const fatimah = res.data.find((s) => s.id === "santri-akh-02");
    assert.ok(fatimah);

    // SET-FATIMAH-CANCELLED (Hlm 5-8) tidak boleh terpilih, harus mengambil SET-FATIMAH-VALID (Hlm 1-4)
    assert.equal(fatimah.setoranTerakhir, "SABAQ Juz 1 Hlm 1-4");
    assert.equal(fatimah.nilaiTerakhir, "MUMTAZ");
  });
});
