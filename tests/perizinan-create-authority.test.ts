(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, JenisKelamin, JenisIzin, Role } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { ajukanIzinAction } from "../app/actions/kesantrian";

describe("PR #11 Write Authority Alignment: Perizinan Create / Record Authority Lock", () => {
  let prisma: PrismaClient;

  const STAFF_KS = "stf-pzn-ks";
  const STAFF_MK = "stf-pzn-mk";
  const SANTRI_1 = "san-pzn-01";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staff records for KS and MK
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_KS,
          staffCode: "STF-PZN-KS",
          nama: "Kiai Mudir Pesantren",
          noHp: "081234567890",
          roleStaff: "KS",
          status: "AKTIF",
        },
        {
          id: STAFF_MK,
          staffCode: "STF-PZN-MK",
          nama: "Ustadz Musyrif Keasramaan",
          noHp: "081234567891",
          roleStaff: "MK",
          status: "AKTIF",
        },
      ],
    });

    // 2. User records for KS and MK (for audit log FK)
    await prisma.user.createMany({
      data: [
        {
          id: "usr-pzn-ks",
          username: "mudir.stq",
          role: "KS",
          staffId: STAFF_KS,
          passwordHash: "dummy-hash",
        },
        {
          id: "usr-pzn-mk",
          username: "musyrif.keasramaan",
          role: "MK",
          staffId: STAFF_MK,
          passwordHash: "dummy-hash",
        },
      ],
    });

    // 3. Santri record
    await prisma.santri.create({
      data: {
        id: SANTRI_1,
        nis: "SAN-PZN-001",
        nama: "Santri Uji Perizinan",
        kelas: "7A",
        jenisKelamin: JenisKelamin.L,
      },
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  it("unauthenticated -> DENY: harus menolak pengajuan izin tanpa sesi dan zero DB writes", async () => {
    setTestSession(null);
    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-09-20T08:00:00.000Z",
      tanggalSelesai: "2026-09-22T17:00:00.000Z",
      alasan: "Keperluan keluarga darurat",
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message, /login/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: Jumlah perizinan tidak boleh berubah");
  });

  const DENIED_ROLES: Role[] = ["ADM", "MT", "PH", "OSDA", "GA", "YAY", "WS", "ST"];

  for (const role of DENIED_ROLES) {
    it(`${role} -> DENY: role ${role} dilarang mencatat izin santri dan zero DB writes`, async () => {
      const mockSession: UserSession = {
        userId: `usr-pzn-${role.toLowerCase()}`,
        username: `user.${role.toLowerCase()}`,
        name: `Pengguna ${role}`,
        role: role,
      };
      setTestSession(mockSession);

      const initialCount = await prisma.perizinanSantri.count();

      const res = await ajukanIzinAction({
        santriId: SANTRI_1,
        jenis: JenisIzin.KELUAR_KOMPLEK,
        tanggalMulai: "2026-09-20T08:00:00.000Z",
        tanggalSelesai: "2026-09-20T17:00:00.000Z",
        alasan: `Pengajuan uji coba oleh role ${role}`,
      });

      assert.strictEqual(res.success, false, `Role ${role} harus ditolak`);
      assert.match(res.message, /kewenangan|Akses ditolak/i);

      const postCount = await prisma.perizinanSantri.count();
      assert.strictEqual(
        postCount,
        initialCount,
        `Zero DB writes: Pemanggilan oleh role ${role} tidak boleh menambah record perizinan di DB`
      );
    });
  }

  it("KS -> ALLOW: Mudir (KS) berhak membuat / mencatat perizinan santri secara resmi", async () => {
    const sessionKS: UserSession = {
      userId: "usr-pzn-ks",
      username: "mudir.stq",
      name: "Mudir Pesantren",
      role: "KS",
      staffId: STAFF_KS,
    };
    setTestSession(sessionKS);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-09-21T08:00:00.000Z",
      tanggalSelesai: "2026-09-23T17:00:00.000Z",
      alasan: "Izin resmi oleh Mudir untuk urusan keluarga penting",
    });

    assert.strictEqual(res.success, true, "Mudir (KS) harus berhasil mengajukan/mencatat izin");
    assert.ok(res.data?.id, "Harus mengembalikan data izin yang dibuat");

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount + 1, "DB write harus bertambah tepat 1 record");
  });

  it("MK -> ALLOW: Musyrif Keasramaan (MK) berhak membuat / mencatat perizinan santri secara resmi", async () => {
    const sessionMK: UserSession = {
      userId: "usr-pzn-mk",
      username: "musyrif.keasramaan",
      name: "Musyrif Keasramaan",
      role: "MK",
      staffId: STAFF_MK,
    };
    setTestSession(sessionMK);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-24T08:00:00.000Z",
      tanggalSelesai: "2026-09-24T12:00:00.000Z",
      alasan: "Izin keluar komplek berobat didampingi",
    });

    assert.strictEqual(res.success, true, "Musyrif Keasramaan (MK) harus berhasil mengajukan/mencatat izin");
    assert.ok(res.data?.id, "Harus mengembalikan data izin yang dibuat");

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount + 1, "DB write harus bertambah tepat 1 record");
  });
});
