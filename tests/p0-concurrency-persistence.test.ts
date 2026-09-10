import test, { describe, before, after } from "node:test";
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
        clientRequestId: "INITIAL-HALF-431",
      },
      context: testContext,
    });
    assert.equal(initialHalf.success, true, "Setoran 0.5 pertama harus berhasil");

    // 2. Jalankan dua request simultan dengan Promise.allSettled untuk mengisi sisa kapasitas 0.5
    const reqA = saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_HALF,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 431,
        halamanSelesai: 431,
        jumlahHalaman: 0.5,
        nilai: "JAYYID_JIDDAN",
        clientRequestId: `CONC-A-${Date.now()}`,
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
        clientRequestId: `CONC-B-${Date.now()}`,
      },
      context: testContext,
    });

    const [resA, resB] = await Promise.allSettled([reqA, reqB]);

    const resultA = resA.status === "fulfilled" ? resA.value : null;
    const resultB = resB.status === "fulfilled" ? resB.value : null;

    const successes = [resultA, resultB].filter((r) => r?.success === true);
    const failures = [resultA, resultB].filter((r) => r?.success === false);

    // Assert: Maksimal 1 transaksi berhasil mengisi sisa kapasitas
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

    // 4. Verifikasi Audit Log hanya dibuat untuk transaksi yang berhasil
    const failedClientRequestId = failures[0]?.message?.includes("CONC-A")
      ? "CONC-A"
      : "CONC-B";

    const allAuditLogs = await prisma.auditLog.findMany({
      where: {
        action: "CREATE_SETORAN",
        userId: testContext.userId,
      },
    });
    assert.equal(allAuditLogs.length, 2);
    const auditClientIds = allAuditLogs.map((log) => (log.details as { clientRequestId?: string })?.clientRequestId);
    assert.equal(auditClientIds.includes(failedClientRequestId), false);

    // Total audit log yang dibuat harus 2: (1 untuk initial 0.5 + 1 untuk transaksi konkuren yang menang)
    const logsForHalaman431 = allAuditLogs.filter((log) => {
      const d = log.details as { halaman?: string };
      return d?.halaman === "431-431";
    });
    assert.equal(
      logsForHalaman431.length,
      2,
      `Audit log hanya boleh dibuat untuk transaksi yang berhasil (total 2), tetapi didapat ${logsForHalaman431.length}`
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

    // Request ketiga dengan clientRequestId sama tetapi santri BERBEDA: Harus DITOLAK (Poin 6)
    const res3 = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_HALF, // Santri berbeda!
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
    assert.equal(res3.success, false);
    assert.match(res3.message, /Akses Ditolak/i);
  });

  test("3. Validasi Server Alasan Lompatan Halaman SABAQ (Poin 7)", async () => {
    // Santri SANTRI_MULTI posisi hafalan sekarang adalah halaman 423.
    // Saran resmi sistem berikutnya adalah Halaman 424.
    // Jika musyrif melompat ke Halaman 426 (tetap di Juz 22):

    // A. Tanpa alasan -> Harus Ditolak
    const resTanpaAlasan = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 426, // Melompat dari saran 424
        halamanSelesai: 426,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        alasanLompatanHalaman: "",
      },
      context: testContext,
    });
    assert.equal(resTanpaAlasan.success, false);
    assert.match(resTanpaAlasan.message, /minimal 5 karakter/i);

    // B. Alasan terlalu pendek (< 5 karakter) -> Harus Ditolak
    const resAlasanPendek = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 426,
        halamanSelesai: 426,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        alasanLompatanHalaman: "tes",
      },
      context: testContext,
    });
    assert.equal(resAlasanPendek.success, false);
    assert.match(resAlasanPendek.message, /minimal 5 karakter/i);

    // C. Alasan valid (>= 5 karakter) -> Harus Diterima & Dicatat ke Audit Log
    const alasanSah = "Santri diuji pada halaqoh khusus akselerasi";
    const resAlasanSah = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_MULTI,
        jenis: "SABAQ",
        juz: 22,
        halamanMulai: 426,
        halamanSelesai: 426,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        alasanLompatanHalaman: alasanSah,
      },
      context: testContext,
    });
    assert.equal(resAlasanSah.success, true);

    // Verifikasi catatan di AuditLog
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        entityId: resAlasanSah.data?.id,
        action: "CREATE_SETORAN",
      },
    });
    assert.ok(auditRecord);
    const details = auditRecord.details as { alasanLompatanHalaman?: string };
    assert.equal(details.alasanLompatanHalaman, alasanSah);
  });

  test("4. Validasi Server Sabaqi Nyata Tanpa Data Palsu (Poin 5)", async () => {
    // Santri SANTRI_SABAQI belum memiliki catatan setoran Sabaq pekan ini.

    // A. Sabaqi reguler tanpa Sabaq pekan ini -> Ditolak
    const resRegular = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "SABQI",
        juz: 5,
        halamanMulai: 82, // Hlm 82-86 ada di Juz 5
        halamanSelesai: 86,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        isManualSabaqi: false,
      },
      context: testContext,
    });
    assert.equal(resRegular.success, false);
    assert.match(resRegular.message, /Belum ada Sabaq tersimpan pada pekan ini/i);

    // B. Sabaqi manual tanpa alasan -> Ditolak
    const resManualTanpaAlasan = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "SABQI",
        juz: 5,
        halamanMulai: 82,
        halamanSelesai: 86,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        isManualSabaqi: true,
        alasanManualSabaqi: "",
      },
      context: testContext,
    });
    assert.equal(resManualTanpaAlasan.success, false);
    assert.match(resManualTanpaAlasan.message, /minimal 5 karakter/i);

    // C. Sabaqi manual dengan alasan valid -> Diterima
    const resManualSah = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "SABQI",
        juz: 5,
        halamanMulai: 82,
        halamanSelesai: 86,
        jumlahHalaman: 5,
        nilai: "MUMTAZ",
        isManualSabaqi: true,
        alasanManualSabaqi: "Mengulang hafalan sabaqi pekan lalu karena baru sembuh sakit",
      },
      context: testContext,
    });
    assert.equal(resManualSah.success, true);
  });

  test("5. Santri Khatam 30 Juz (Halaman 604 Selesai) Dinonaktifkan dari Sabaq Baru", async () => {
    // Santri SANTRI_KHATAM telah menyelesaikan Halaman 604 penuh.
    const resKhatam = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_KHATAM,
        jenis: "SABAQ",
        juz: 30,
        halamanMulai: 604,
        halamanSelesai: 604,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
      },
      context: testContext,
    });
    assert.equal(resKhatam.success, false);
    assert.match(resKhatam.message, /Target hafalan 30 juz telah selesai/i);
  });

  test("6. Response Setoran Tidak Memuat Payload WhatsApp Rutin", async () => {
    const res = await saveSetoranTahfizhCore(prisma, {
      input: {
        santriId: FIXTURES.SANTRI_SABAQI,
        jenis: "MANZIL",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 20,
        jumlahHalaman: 20,
        nilai: "MUMTAZ",
      },
      context: testContext,
    });
    assert.equal(res.success, true);
    // Pastikan tidak ada tautan wa.me, dialog WhatsApp, atau pemicu popup
    const resKeys = Object.keys(res);
    assert.equal(resKeys.includes("waLink"), false);
    assert.equal(resKeys.includes("whatsAppUrl"), false);
    assert.equal(resKeys.includes("showWhatsAppModal"), false);
  });
});
