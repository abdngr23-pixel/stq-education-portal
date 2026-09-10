import test, { describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { saveSetoranTahfizhCore } from "../lib/tahfizh-persistence";
import {
  startTestDatabase,
  setupTestFixtures,
  cleanupTestFixtures,
  stopTestDatabase,
  FIXTURES,
} from "./test-db-manager";

describe("INTEGRASI P0.1: Concurrency, Idempotensi, & Persistensi Nyata (PostgreSQL Terisolasi)", () => {
  let prisma: PrismaClient;

  const testContext = {
    userId: FIXTURES.USER_ID,
    username: FIXTURES.USERNAME,
    musyrifStaffId: FIXTURES.STAFF_ID,
  };

  before(async () => {
    prisma = await startTestDatabase();
  });

  beforeEach(async () => {
    // Reset kondisi fixtures sebelum setiap test agar independen
    await setupTestFixtures(prisma);
  });

  after(async () => {
    if (prisma) {
      await cleanupTestFixtures(prisma);
      await stopTestDatabase();
    }
  });

  test("1. Konkurensi Nyata: Dua transaksi simultan (Promise.allSettled) mengisi sisa 0.5 halaman yang sama", async () => {
    // 1. Catat setoran 0.5 halaman pertama pada Halaman 431 untuk santri SANTRI_HALF
    const initialHalf = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_HALF,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 431,
        halamanSelesai: 431,
        jumlahHalaman: 0.5,
        nilai: "MUMTAZ",
        clientRequestId: `INIT-HALF-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(initialHalf.success, true, "Setoran 0.5 pertama harus berhasil");

    // 2. Jalankan dua request simultan dengan Promise.allSettled untuk mengisi sisa kapasitas 0.5
    const clientRequestIdA = `CONC-REQ-A-${Date.now()}`;
    const clientRequestIdB = `CONC-REQ-B-${Date.now()}`;

    const reqA = saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_HALF,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 431,
        halamanSelesai: 431,
        jumlahHalaman: 0.5,
        nilai: "JAYYID_JIDDAN",
        clientRequestId: clientRequestIdA,
      },
      context: testContext,
    });

    const reqB = saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_HALF,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 431,
        halamanSelesai: 431,
        jumlahHalaman: 0.5,
        nilai: "JAYYID",
        clientRequestId: clientRequestIdB,
      },
      context: testContext,
    });

    const [resA, resB] = await Promise.allSettled([reqA, reqB]);

    const resultA = resA.status === "fulfilled" ? resA.value : null;
    const resultB = resB.status === "fulfilled" ? resB.value : null;

    const successes = [resultA, resultB].filter((r) => r?.success === true);
    const failures = [resultA, resultB].filter((r) => r?.success === false);

    // Assert: Tepat 1 transaksi berhasil mengisi sisa kapasitas
    assert.equal(
      successes.length,
      1,
      `Harus tepat 1 transaksi konkuren yang berhasil, tetapi didapat ${successes.length}`
    );
    assert.equal(
      failures.length,
      1,
      `Harus tepat 1 transaksi konkuren yang ditolak karena kapasitas penuh, tetapi didapat ${failures.length}`
    );

    let winnerRequestId: string;
    let loserRequestId: string;

    if (resultA?.success && !resultB?.success) {
      winnerRequestId = clientRequestIdA;
      loserRequestId = clientRequestIdB;
    } else if (!resultA?.success && resultB?.success) {
      winnerRequestId = clientRequestIdB;
      loserRequestId = clientRequestIdA;
    } else {
      assert.fail(`Tepat 1 request harus berhasil dan 1 gagal`);
    }

    // 3. Verifikasi Occupancy di Database Riil tidak melebihi 1.0
    const recordsInDb = await prisma.setoranTahfizh.findMany({
      where: {
        santriId: FIXTURES.SANTRI_HALF,
        halamanMulai: 431,
        status: { not: "DIBATALKAN" },
      },
    });

    const totalOccupancy = recordsInDb.reduce((sum, r) => sum + r.jumlahHalaman, 0);
    assert.equal(
      totalOccupancy,
      1.0,
      `Occupancy akhir pada halaman 431 di database harus tepat 1.0, tetapi didapat ${totalOccupancy}`
    );

    // 4. Verifikasi Audit Log: Hanya memuat winnerRequestId dan TIDAK memuat loserRequestId
    const allAuditLogs = await prisma.auditLog.findMany({
      where: {
        action: "CREATE_SETORAN",
        userId: testContext.userId,
      },
    });

    const auditClientIds = allAuditLogs.map((log) => {
      const details = log.details as { clientRequestId?: string };
      return details?.clientRequestId;
    });

    assert.ok(
      auditClientIds.includes(winnerRequestId),
      `Audit log harus memuat clientRequestId dari transaksi yang berhasil (${winnerRequestId})`
    );
    assert.equal(
      auditClientIds.includes(loserRequestId),
      false,
      `Audit log dilarang memuat clientRequestId dari transaksi yang gagal (${loserRequestId})`
    );
  });

  test("2. Idempotensi Nyata & Pemeriksaan Kepemilikan Santri pada P2002", async () => {
    const clientRequestId = `IDEMP-TEST-${Date.now()}`;

    // Request pertama: Berhasil
    const res1 = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 422,
        halamanSelesai: 423,
        jumlahHalaman: 2,
        nilai: "MUMTAZ",
        clientRequestId,
      },
      context: testContext,
    });
    assert.equal(res1.success, true);
    assert.ok(res1.data);

    // Request kedua dengan clientRequestId sama dan santri sama: Harus idempoten
    const res2 = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 422,
        halamanSelesai: 423,
        jumlahHalaman: 2,
        nilai: "MUMTAZ",
        clientRequestId,
      },
      context: testContext,
    });
    assert.equal(res2.success, true);
    assert.equal(res2.idempotent, true);
    assert.equal(res2.data?.id, res1.data?.id);

    // Request ketiga dengan clientRequestId sama tetapi santriId berbeda: Wajib ditolak
    const resDifferentSantri = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_HALF,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 431,
        halamanSelesai: 431,
        jumlahHalaman: 0.5,
        nilai: "MUMTAZ",
        clientRequestId,
      },
      context: testContext,
    });
    assert.equal(resDifferentSantri.success, false);
    assert.match(resDifferentSantri.message, /santri berbeda/i);
  });

  test("3. Validasi Server Alasan Lompatan Halaman SABAQ (Poin 7)", async () => {
    // Santri Multi memiliki modal 421, posisi berikutnya yang diharapkan adalah 422.
    // Jika melompat ke halaman 425 tanpa alasan, server wajib menolak.
    const resTanpaAlasan = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 425,
        halamanSelesai: 425,
        jumlahHalaman: 1,
        nilai: "JAYYID",
        clientRequestId: `JUMP-NO-REASON-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resTanpaAlasan.success, false);
    assert.match(resTanpaAlasan.message, /alasan lompatan|pengulangan/i);

    // Jika diberikan alasan minimal 5 karakter, server mengizinkan dan mencatat ke audit log
    const resDenganAlasan = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 425,
        halamanSelesai: 425,
        jumlahHalaman: 1,
        nilai: "JAYYID",
        alasanLompatanHalaman: "Pengulangan maqra khusus sesuai instruksi musyrif",
        clientRequestId: `JUMP-WITH-REASON-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resDenganAlasan.success, true);
    assert.ok(resDenganAlasan.data);

    // Pastikan audit log mencatat alasan lompatan
    const jumpAudit = await prisma.auditLog.findFirst({
      where: {
        entityId: resDenganAlasan.data?.id,
      },
    });
    assert.ok(jumpAudit);
    const details = jumpAudit.details as { alasanLompatanHalaman?: string };
    assert.equal(details?.alasanLompatanHalaman, "Pengulangan maqra khusus sesuai instruksi musyrif");
  });

  test("4. Validasi Server Sabaqi Nyata Tanpa Data Palsu (Poin 5)", async () => {
    // Santri Sabaqi Clean (TEST_SAN_SABAQI) belum memiliki setoran Sabaq pada pekan berjalan.
    // Jika mencoba input Sabaqi tanpa konfirmasi manual, server wajib menolak dengan pesan informatif
    const resSabaqiTanpaManual = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "SABQI",
        juz: 5,
        halamanMulai: 96,
        halamanSelesai: 100,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        clientRequestId: `SABAQI-AUTO-FAIL-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resSabaqiTanpaManual.success, false);
    assert.match(resSabaqiTanpaManual.message, /belum ada sabaq tersimpan pada pekan ini/i);

    // Jika dicentang manual tetapi alasan < 5 karakter: Wajib ditolak
    const resSabaqiShortReason = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "SABQI",
        juz: 5,
        halamanMulai: 96,
        halamanSelesai: 100,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        isManualSabaqi: true,
        alasanManualSabaqi: "abc",
        clientRequestId: `SABAQI-SHORT-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resSabaqiShortReason.success, false);
    assert.match(resSabaqiShortReason.message, /minimal 5 karakter/i);

    // Jika manual dengan alasan valid >= 5 karakter: Diterima
    const resSabaqiValid = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "SABQI",
        juz: 5,
        halamanMulai: 96,
        halamanSelesai: 100,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        isManualSabaqi: true,
        alasanManualSabaqi: "Santri baru pindah halaqoh dan mengulang materi pekan lalu",
        clientRequestId: `SABAQI-VALID-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resSabaqiValid.success, true);
    assert.ok(resSabaqiValid.data);
  });

  test("5. Santri Khatam 30 Juz (Halaman 604 Selesai) Dinonaktifkan dari Sabaq Baru", async () => {
    // SANTRI_KHATAM telah menyelesaikan Halaman 604 penuh di database fixture.
    // Percobaan menambah setoran SABAQ baru (misal Halaman 604 atau 605) harus ditolak tegas oleh server
    const resKhatamSabaq = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_KHATAM,
        jenis: "SABAQ",
        juz: 30,
        halamanMulai: 604,
        halamanSelesai: 604,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        clientRequestId: `KHATAM-SABAQ-REJECT-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resKhatamSabaq.success, false);
    assert.match(resKhatamSabaq.message, /target hafalan 30 juz telah selesai/i);

    // Namun jenis setoran lain (seperti MANZIL atau MUFAR) tetap diizinkan untuk muroja'ah
    const resKhatamManzil = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_KHATAM,
        jenis: "MANZIL",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 20,
        jumlahHalaman: 20,
        nilai: "MUMTAZ",
        clientRequestId: `KHATAM-MANZIL-ALLOW-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resKhatamManzil.success, true);
  });

  test("6. Response Setoran Tidak Memuat Payload WhatsApp Rutin", async () => {
    const res = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 422,
        halamanSelesai: 423,
        jumlahHalaman: 2,
        nilai: "MUMTAZ",
        clientRequestId: `NO-WA-PAYLOAD-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(res.success, true);
    const anyRes = res as Record<string, unknown>;
    assert.equal(anyRes.whatsappUrl, undefined);
    assert.equal(anyRes.waPayload, undefined);
    assert.equal(anyRes.showWhatsAppDialog, undefined);
  });

  test("7. Validasi Server Batas Juz (Setoran Melintasi Batas Juz Wajib Ditolak)", async () => {
    // SANTRI_BATAS_JUZ berada di halaman 441 (akhir Juz 22).
    // Setoran melintasi halaman 441 ke 442 (Juz 23) dalam satu transaksi harus ditolak oleh server
    const resCrossJuz = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_BATAS_JUZ,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 441,
        halamanSelesai: 442,
        jumlahHalaman: 2,
        nilai: "MUMTAZ",
        clientRequestId: `CROSS-JUZ-${Date.now()}`,
      },
      context: testContext,
    });
    assert.equal(resCrossJuz.success, false);
    assert.match(resCrossJuz.message, /batas juz/i);

    // Pastikan tidak ada record yang tersimpan di database
    const dbCount = await prisma.setoranTahfizh.count({
      where: {
        santriId: FIXTURES.SANTRI_BATAS_JUZ,
        halamanMulai: 441,
      },
    });
    assert.equal(dbCount, 0, "Dilarang membuat record di database jika melintasi batas juz");
  });
});
