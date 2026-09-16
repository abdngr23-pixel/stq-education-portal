(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, JenisKelamin, TingkatPelanggaran, Role } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { catatPelanggaranAction } from "../app/actions/kedisiplinan";

describe("PR #11 Write Authority Alignment: Kedisiplinan Create / Record Authority Lock", () => {
  let prisma: PrismaClient;

  const STAFF_KS = "stf-dsp-ks";
  const STAFF_MK = "stf-dsp-mk";
  const STAFF_MT = "stf-dsp-mt";
  const STAFF_PH = "stf-dsp-ph";

  const USER_KS = "usr-dsp-ks";
  const USER_MK = "usr-dsp-mk";
  const USER_MT = "usr-dsp-mt";
  const USER_PH = "usr-dsp-ph";

  const SANTRI_1 = "san-dsp-01";
  const KATEGORI_1 = "kat-dsp-01";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staff records
    await prisma.staff.createMany({
      data: [
        {
          id: STAFF_KS,
          staffCode: "STF-DSP-KS",
          nama: "Kiai Mudir STQ",
          noHp: "081234567890",
          roleStaff: "KS",
          status: "AKTIF",
        },
        {
          id: STAFF_MK,
          staffCode: "STF-DSP-MK",
          nama: "Ustadz Musyrif Keasramaan",
          noHp: "081234567891",
          roleStaff: "MK",
          status: "AKTIF",
        },
        {
          id: STAFF_MT,
          staffCode: "STF-DSP-MT",
          nama: "Ustadz Musyrif Tahfizh",
          noHp: "081234567892",
          roleStaff: "MT",
          status: "AKTIF",
        },
        {
          id: STAFF_PH,
          staffCode: "STF-DSP-PH",
          nama: "Ustadz Pembina Halaqoh",
          noHp: "081234567893",
          roleStaff: "PH",
          status: "AKTIF",
        },
      ],
    });

    // 2. User records linked to staff
    await prisma.user.createMany({
      data: [
        {
          id: USER_KS,
          username: "mudir.stq",
          role: "KS",
          staffId: STAFF_KS,
          passwordHash: "dummy-hash",
        },
        {
          id: USER_MK,
          username: "musyrif.mk",
          role: "MK",
          staffId: STAFF_MK,
          passwordHash: "dummy-hash",
        },
        {
          id: USER_MT,
          username: "musyrif.mt",
          role: "MT",
          staffId: STAFF_MT,
          passwordHash: "dummy-hash",
        },
        {
          id: USER_PH,
          username: "pembina.ph",
          role: "PH",
          staffId: STAFF_PH,
          passwordHash: "dummy-hash",
        },
      ],
    });

    // 3. Santri record
    await prisma.santri.create({
      data: {
        id: SANTRI_1,
        nis: "SAN-DSP-001",
        nama: "Santri Uji Kedisiplinan",
        kelas: "7A",
        jenisKelamin: JenisKelamin.L,
      },
    });

    // 4. KategoriPelanggaran record
    await prisma.kategoriPelanggaran.create({
      data: {
        id: KATEGORI_1,
        kode: "PLG-KAT1-TEST",
        nama: "Keterlambatan Sholat Berjamaah",
        tingkat: TingkatPelanggaran.KATEGORI_1,
        poinDasar: 5,
        sanksi: "Teguran lisan & adab sholat",
      },
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  it("unauthenticated -> DENY: harus menolak catat pelanggaran tanpa sesi dan zero DB writes", async () => {
    setTestSession(null);

    const initialPelanggaran = await prisma.pelanggaranSantri.count();
    const initialSP = await prisma.suratPeringatan.count();
    const initialAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

    const res = await catatPelanggaranAction({
      santriId: SANTRI_1,
      kategoriId: KATEGORI_1,
      kronologi: "Terlambat sholat subuh tanpa udzur syar'i",
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message, /login/i);

    const postPelanggaran = await prisma.pelanggaranSantri.count();
    const postSP = await prisma.suratPeringatan.count();
    const postAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

    assert.strictEqual(postPelanggaran, initialPelanggaran, "Zero DB writes: PelanggaranSantri tidak bertambah");
    assert.strictEqual(postSP, initialSP, "Zero DB writes: SuratPeringatan tidak bertambah");
    assert.strictEqual(postAudit, initialAudit, "Zero DB writes: AuditLog tidak bertambah");
  });

  const DENIED_ROLES: Role[] = ["ADM", "MT", "PH", "OSDA", "GA", "YAY", "WS", "ST"];

  for (const role of DENIED_ROLES) {
    it(`${role} -> DENY: role ${role} dilarang mencatat pelanggaran santri dan zero DB writes`, async () => {
      const mockSession: UserSession = {
        userId: `usr-dsp-${role.toLowerCase()}`,
        username: `user.${role.toLowerCase()}`,
        name: `Pengguna ${role}`,
        role: role,
      };
      setTestSession(mockSession);

      const initialPelanggaran = await prisma.pelanggaranSantri.count();
      const initialSP = await prisma.suratPeringatan.count();
      const initialAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

      const res = await catatPelanggaranAction({
        santriId: SANTRI_1,
        kategoriId: KATEGORI_1,
        kronologi: `Percobaan pencatatan pelanggaran oleh role ${role}`,
      });

      assert.strictEqual(res.success, false, `Role ${role} harus ditolak`);
      assert.match(res.message, /kewenangan|Akses ditolak/i);

      const postPelanggaran = await prisma.pelanggaranSantri.count();
      const postSP = await prisma.suratPeringatan.count();
      const postAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

      assert.strictEqual(postPelanggaran, initialPelanggaran, `Zero DB writes: PelanggaranSantri tidak berubah untuk ${role}`);
      assert.strictEqual(postSP, initialSP, `Zero DB writes: SuratPeringatan tidak berubah untuk ${role}`);
      assert.strictEqual(postAudit, initialAudit, `Zero DB writes: AuditLog tidak berubah untuk ${role}`);
    });
  }

  it("MT with valid staffId -> still DENY: Musyrif Tahfizh tidak boleh menulis pelanggaran meski memiliki profil staf", async () => {
    const sessionMT: UserSession = {
      userId: USER_MT,
      username: "musyrif.mt",
      name: "Ustadz MT Resmi",
      role: "MT",
      staffId: STAFF_MT,
    };
    setTestSession(sessionMT);

    const initialPelanggaran = await prisma.pelanggaranSantri.count();
    const initialSP = await prisma.suratPeringatan.count();
    const initialAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

    const res = await catatPelanggaranAction({
      santriId: SANTRI_1,
      kategoriId: KATEGORI_1,
      kronologi: "MT mencoba mencatat pelanggaran santri",
    });

    assert.strictEqual(res.success, false, "MT harus ditolak mencatat pelanggaran");
    assert.match(res.message, /kewenangan|Akses ditolak/i);

    const postPelanggaran = await prisma.pelanggaranSantri.count();
    const postSP = await prisma.suratPeringatan.count();
    const postAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

    assert.strictEqual(postPelanggaran, initialPelanggaran, "Zero DB writes: PelanggaranSantri tidak bertambah");
    assert.strictEqual(postSP, initialSP, "Zero DB writes: SuratPeringatan tidak bertambah");
    assert.strictEqual(postAudit, initialAudit, "Zero DB writes: AuditLog tidak bertambah");
  });

  it("PH with valid staffId -> still DENY: Pembina Halaqoh tidak boleh menulis pelanggaran meski memiliki profil staf", async () => {
    const sessionPH: UserSession = {
      userId: USER_PH,
      username: "pembina.ph",
      name: "Ustadz PH Resmi",
      role: "PH",
      staffId: STAFF_PH,
    };
    setTestSession(sessionPH);

    const initialPelanggaran = await prisma.pelanggaranSantri.count();
    const initialSP = await prisma.suratPeringatan.count();
    const initialAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

    const res = await catatPelanggaranAction({
      santriId: SANTRI_1,
      kategoriId: KATEGORI_1,
      kronologi: "PH mencoba mencatat pelanggaran santri",
    });

    assert.strictEqual(res.success, false, "PH harus ditolak mencatat pelanggaran");
    assert.match(res.message, /kewenangan|Akses ditolak/i);

    const postPelanggaran = await prisma.pelanggaranSantri.count();
    const postSP = await prisma.suratPeringatan.count();
    const postAudit = await prisma.auditLog.count({ where: { action: "CATAT_PELANGGARAN" } });

    assert.strictEqual(postPelanggaran, initialPelanggaran, "Zero DB writes: PelanggaranSantri tidak bertambah");
    assert.strictEqual(postSP, initialSP, "Zero DB writes: SuratPeringatan tidak bertambah");
    assert.strictEqual(postAudit, initialAudit, "Zero DB writes: AuditLog tidak bertambah");
  });

  it("KS -> ALLOW: Mudir (KS) berhak mencatat pelanggaran santri", async () => {
    const sessionKS: UserSession = {
      userId: USER_KS,
      username: "mudir.stq",
      name: "Kiai Mudir STQ",
      role: "KS",
      staffId: STAFF_KS,
    };
    setTestSession(sessionKS);

    const initialPelanggaran = await prisma.pelanggaranSantri.count();

    const res = await catatPelanggaranAction({
      santriId: SANTRI_1,
      kategoriId: KATEGORI_1,
      kronologi: "Pencatatan resmi pelanggaran oleh Mudir Pesantren",
    });

    assert.strictEqual(res.success, true, "Mudir (KS) harus berhasil mencatat pelanggaran");
    assert.ok(res.data?.id, "Harus mengembalikan ID pelanggaran");

    const postPelanggaran = await prisma.pelanggaranSantri.count();
    assert.strictEqual(postPelanggaran, initialPelanggaran + 1, "PelanggaranSantri harus bertambah 1");
  });

  it("MK -> ALLOW: Musyrif Keasramaan (MK) berhak mencatat pelanggaran santri", async () => {
    const sessionMK: UserSession = {
      userId: USER_MK,
      username: "musyrif.mk",
      name: "Ustadz Musyrif Keasramaan",
      role: "MK",
      staffId: STAFF_MK,
    };
    setTestSession(sessionMK);

    const initialPelanggaran = await prisma.pelanggaranSantri.count();

    const res = await catatPelanggaranAction({
      santriId: SANTRI_1,
      kategoriId: KATEGORI_1,
      kronologi: "Pencatatan resmi pelanggaran oleh Musyrif Keasramaan",
    });

    assert.strictEqual(res.success, true, "Musyrif Keasramaan (MK) harus berhasil mencatat pelanggaran");
    assert.ok(res.data?.id, "Harus mengembalikan ID pelanggaran");

    const postPelanggaran = await prisma.pelanggaranSantri.count();
    assert.strictEqual(postPelanggaran, initialPelanggaran + 1, "PelanggaranSantri harus bertambah 1");
  });
});
