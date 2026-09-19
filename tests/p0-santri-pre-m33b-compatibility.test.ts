/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, SantriStatus } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { getSantriListForSession } from "../lib/server/santri-list-service";
import { UserSession } from "../types/auth";

describe("P0 DATA SANTRI — PRE-M3.3B SCHEMA COMPATIBILITY REGRESSION TEST", () => {
  let prisma: PrismaClient;

  const sessionAdmin: UserSession = {
    userId: "USR-ADMIN-01",
    username: "admin.test",
    role: "ADM",
    name: "Administrator Test",
  };

  const sessionMusyrif: UserSession = {
    userId: "USR-MT-01",
    username: "musyrif.test",
    role: "MT",
    name: "Ust. Pembina Pre-M33B",
    staffId: "STF-TEST-PRE-01",
  };

  before(async () => {
    try {
      console.log("[P0-TEST] 01 start");
      prisma = await startTestDatabase();
      console.log("[P0-TEST] 02 postgres initialized");

      // Strictly establish PRE-M3.3B state:
      // 1. Drop santri.cohort_id (introduced in M3.3B migration)
      await prisma.$executeRawUnsafe(`ALTER TABLE "test_portal"."santri" DROP COLUMN IF EXISTS "cohort_id" CASCADE;`);

      // 2. Drop M3.3B education tables to ensure schema stops strictly before M3.3B
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "test_portal"."education_sessions" CASCADE;`);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "test_portal"."teaching_assignments" CASCADE;`);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "test_portal"."education_cohorts" CASCADE;`);
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "test_portal"."EducationTrack" CASCADE;`);
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "test_portal"."PedagogicalLevel" CASCADE;`);
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "test_portal"."EducationSessionStatus" CASCADE;`);
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "test_portal"."EducationAttendanceStatus" CASCADE;`);

      // Verify santri.cohort_id strictly does NOT exist
      const checkCohort = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'test_portal'
            AND table_name = 'santri'
            AND column_name = 'cohort_id'
        ) as "exists"
      `;
      assert.strictEqual(checkCohort[0].exists, false, "FATAL: Pre-M3.3B check failed: cohort_id still exists!");
      console.log("[P0-TEST] 03 schema ready");

      // 3. Seed test fixtures
      await prisma.staff.create({
        data: {
          id: "STF-TEST-PRE-01",
          staffCode: "STF-PRE-01",
          nama: "Ust. Pembina Pre-M33B",
          roleStaff: "MT",
          noHp: "081234567890",
          status: "AKTIF",
        },
      });

      await prisma.halaqoh.create({
        data: {
          id: "HLQ-TEST-PRE-01",
          halaqohCode: "HLQ-PRE-01",
          nama: "Halaqoh Al-Fatihah",
          tahunAjaran: "2026/2027",
          pembinaId: "STF-TEST-PRE-01",
          status: "AKTIF",
        },
      });

      // 4 Santri: 2 Putra (L), 2 Putri (P)
      // Ahmad (L): modal 20 hlm, baseline 2026-09-01
      await prisma.santri.create({
        data: {
          id: "SAN-PRE-001",
          nis: "SAN-001",
          nama: "Ahmad Ikhwan",
          kelas: "7A",
          jenisKelamin: "L",
          status: SantriStatus.AKTIF,
          halaqohId: "HLQ-TEST-PRE-01",
          modalHafalanAwalHalaman: 20,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
          targetAkhirProgramJuz: 30,
          namaWali: "Wali Ahmad",
          noHpWali: "081234567890",
        },
        select: { id: true },
      });

      // Budi (L): modal 40 hlm, baseline 2026-09-01
      await prisma.santri.create({
        data: {
          id: "SAN-PRE-002",
          nis: "SAN-002",
          nama: "Budi Ikhwan",
          kelas: "7B",
          jenisKelamin: "L",
          status: SantriStatus.AKTIF,
          halaqohId: "HLQ-TEST-PRE-01",
          modalHafalanAwalHalaman: 40,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
          targetAkhirProgramJuz: 30,
        },
        select: { id: true },
      });

      // Zahra (P): modal 10 hlm, baseline 2026-09-01
      await prisma.santri.create({
        data: {
          id: "SAN-PRE-003",
          nis: "SAN-003",
          nama: "Zahra Akhwat",
          kelas: "7A",
          jenisKelamin: "P",
          status: SantriStatus.AKTIF,
          halaqohId: "HLQ-TEST-PRE-01",
          modalHafalanAwalHalaman: 10,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
        },
        select: { id: true },
      });

      // Aisyah (P): modal 15 hlm, baseline 2026-09-01
      await prisma.santri.create({
        data: {
          id: "SAN-PRE-004",
          nis: "SAN-004",
          nama: "Aisyah Akhwat",
          kelas: "7B",
          jenisKelamin: "P",
          status: SantriStatus.AKTIF,
          halaqohId: "HLQ-TEST-PRE-01",
          modalHafalanAwalHalaman: 15,
          tanggalBaselineTahfizh: new Date("2026-09-01T00:00:00.000Z"),
        },
        select: { id: true },
      });

      // Seed setoran SABAQ: Ahmad setor 5 halaman
      await prisma.setoranTahfizh.create({
        data: {
          setoranCode: "SET-PRE-001",
          santriId: "SAN-PRE-001",
          musyrifId: "STF-TEST-PRE-01",
          tanggal: new Date("2026-09-02T08:00:00.000Z"),
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 21,
          halamanSelesai: 25,
          jumlahHalaman: 5,
          nilai: "JAYYID",
          status: "AKTIF",
          createdBy: "admin.test",
        },
      });

      // Seed setoran SABAQ: Zahra setor 2 halaman
      await prisma.setoranTahfizh.create({
        data: {
          setoranCode: "SET-PRE-002",
          santriId: "SAN-PRE-003",
          musyrifId: "STF-TEST-PRE-01",
          tanggal: new Date("2026-09-02T08:00:00.000Z"),
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 11,
          halamanSelesai: 12,
          jumlahHalaman: 2,
          nilai: "MUMTAZ",
          status: "AKTIF",
          createdBy: "admin.test",
        },
      });

      console.log("[P0-TEST] 04 fixture ready");
    } catch (err) {
      console.error("[P0-TEST] Setup failed, stopping test database...", err);
      await stopTestDatabase();
      throw err;
    }
  });

  after(async () => {
    console.log("[P0-TEST] 07 prisma disconnected");
    await stopTestDatabase();
    console.log("[P0-TEST] 08 postgres stopped");
    console.log("[P0-TEST] 09 cleanup complete");
  });

  it("1. Confirms test database is strictly PRE-M3.3B (santri.cohort_id does NOT exist)", async () => {
    const result: any = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'test_portal'
          AND table_name = 'santri'
          AND column_name = 'cohort_id'
      ) as "exists";
    `;
    assert.strictEqual(result[0].exists, false, "Pre-M3.3B database must not have cohort_id column");
  });

  it("2. Proves unprojected santri query FAILS with P2022 against pre-M3.3B schema", async () => {
    await assert.rejects(
      async () => {
        // Default scalar selection without explicit select fails with P2022
        await (prisma.santri as any).findMany({
          where: { status: SantriStatus.AKTIF },
        });
      },
      (err: any) => {
        assert.strictEqual(err.code, "P2022", "Expected P2022 error due to missing cohort_id");
        assert.ok(
          err.message.includes("cohort_id"),
          `Expected error message to mention cohort_id, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it("3. Proves getSantriListForSession succeeds against pre-M3.3B schema with ZERO P2022 errors", async () => {
    const res = await getSantriListForSession(undefined, sessionAdmin, prisma);
    console.log("[P0-TEST] 05 service executed");

    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 4, "Expected 4 santri returned");
  });

  it("4. Verifies SantriListItem contract & Tahfizh calculations", async () => {
    const res = await getSantriListForSession(undefined, sessionAdmin, prisma);
    assert.strictEqual(res.success, true);

    const ahmad = res.data.find((s) => s.id === "SAN-PRE-001");
    assert.ok(ahmad, "Ahmad must be present");
    assert.strictEqual(ahmad.nis, "SAN-001");
    assert.strictEqual(ahmad.nama, "Ahmad Ikhwan");
    assert.strictEqual(ahmad.kelas, "7A");
    assert.strictEqual(ahmad.jenisKelamin, "L");
    assert.strictEqual(ahmad.modalHafalanAwalHalaman, 20);
    assert.strictEqual(ahmad.tambahanSabaq, 5);
    assert.strictEqual(ahmad.totalHafalan, 25);
    assert.strictEqual(ahmad.setoranTerakhir, "SABAQ Juz 1 Hlm 21-25");
    assert.strictEqual(ahmad.nilaiTerakhir, "JAYYID");

    const zahra = res.data.find((s) => s.id === "SAN-PRE-003");
    assert.ok(zahra, "Zahra must be present");
    assert.strictEqual(zahra.nis, "SAN-003");
    assert.strictEqual(zahra.nama, "Zahra Akhwat");
    assert.strictEqual(zahra.jenisKelamin, "P");
    assert.strictEqual(zahra.modalHafalanAwalHalaman, 10);
    assert.strictEqual(zahra.tambahanSabaq, 2);
    assert.strictEqual(zahra.totalHafalan, 12);
    assert.strictEqual(zahra.setoranTerakhir, "SABAQ Juz 1 Hlm 11-12");
    assert.strictEqual(zahra.nilaiTerakhir, "MUMTAZ");

    const budi = res.data.find((s) => s.id === "SAN-PRE-002");
    assert.ok(budi);
    assert.strictEqual(budi.totalHafalan, 40);

    const aisyah = res.data.find((s) => s.id === "SAN-PRE-004");
    assert.ok(aisyah);
    assert.strictEqual(aisyah.totalHafalan, 15);
  });

  it("5. Verifies gender sorting (Ikhwan by NIS asc, then Akhwat by Nama asc)", async () => {
    const res = await getSantriListForSession(undefined, sessionAdmin, prisma);
    assert.strictEqual(res.success, true);

    const names = res.data.map((s) => s.nama);
    // Expected:
    // Ikhwan: SAN-001 Ahmad Ikhwan, SAN-002 Budi Ikhwan
    // Akhwat: Aisyah Akhwat, Zahra Akhwat (alphabetical by nama)
    assert.deepStrictEqual(names, [
      "Ahmad Ikhwan",
      "Budi Ikhwan",
      "Aisyah Akhwat",
      "Zahra Akhwat",
    ]);
  });

  it("6. Verifies Error != Empty contract on unauthenticated or unauthorized sessions", async () => {
    // A. Unauthenticated session (null)
    const unauthRes = await getSantriListForSession(undefined, null, prisma);
    assert.strictEqual(unauthRes.success, false);
    assert.ok(unauthRes.error);
    assert.strictEqual(unauthRes.error, "Sesi tidak valid atau belum login.");
    assert.deepStrictEqual(unauthRes.data, []);

    // B. Musyrif session scoped to their own halaqoh
    const musyrifRes = await getSantriListForSession(undefined, sessionMusyrif, prisma);
    assert.strictEqual(musyrifRes.success, true);
    assert.strictEqual(musyrifRes.data.length, 4);

    // C. Musyrif without staffId fails-closed (Error != Empty)
    const brokenMusyrif: UserSession = {
      ...sessionMusyrif,
      staffId: undefined,
    };
    const brokenRes = await getSantriListForSession(undefined, brokenMusyrif, prisma);
    assert.strictEqual(brokenRes.success, false);
    assert.ok(brokenRes.error);
    assert.ok(brokenRes.error.includes("belum terhubung"));
  });

  it("7. Verifies mutation compatibility on pre-M3.3B schema (update and create with explicit select)", async () => {
    // A. Update santri with explicit select
    const updated = await prisma.santri.update({
      where: { id: "SAN-PRE-001" },
      data: {
        modalHafalanAwalHalaman: 22,
      },
      select: {
        id: true,
        nis: true,
        nama: true,
        modalHafalanAwalHalaman: true,
      },
    });
    assert.strictEqual(updated.modalHafalanAwalHalaman, 22);

    // B. Create santri with explicit select
    const created = await prisma.santri.create({
      data: {
        id: "SAN-PRE-005",
        nis: "SAN-005",
        nama: "Santri Baru Pre-M33B",
        kelas: "7A",
        jenisKelamin: "L",
        status: SantriStatus.AKTIF,
        halaqohId: "HLQ-TEST-PRE-01",
      },
      select: {
        id: true,
        nis: true,
        nama: true,
        kelas: true,
        jenisKelamin: true,
        status: true,
      },
    });
    assert.strictEqual(created.id, "SAN-PRE-005");
    assert.strictEqual(created.nama, "Santri Baru Pre-M33B");
  });

  it("8. Verifies forward compatibility: continues to succeed after M3.3B cohort_id column is added", async () => {
    // Add cohort_id column to simulate M3.3B migration deployment
    await prisma.$executeRawUnsafe(`ALTER TABLE "test_portal"."santri" ADD COLUMN "cohort_id" TEXT;`);

    // Verify cohort_id exists now
    const checkCohort: any = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'test_portal'
          AND table_name = 'santri'
          AND column_name = 'cohort_id'
      ) as "exists";
    `;
    assert.strictEqual(checkCohort[0].exists, true);

    // Query should still succeed with explicit select
    const res = await getSantriListForSession(undefined, sessionAdmin, prisma);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.length, 5); // 4 initial + 1 created in test 7
    console.log("[P0-TEST] 06 assertions passed");
  });
});
