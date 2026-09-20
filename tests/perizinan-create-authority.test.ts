/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, JenisKelamin, JenisIzin, Role } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  ajukanIzinAction,
  konfirmasiKembaliIzinAction,
  batalkanIzinAction,
} from "../app/actions/kesantrian";

describe("PR #11 Write Authority Alignment: Perizinan Create / Record Authority Lock", () => {
  let prisma: PrismaClient;

  const STAFF_KS = "stf-pzn-ks";
  const STAFF_MK = "stf-pzn-mk";
  const STAFF_MUDABBIR = "stf-pzn-mudabbir";
  const SANTRI_1 = "san-pzn-01";
  const SANTRI_2 = "san-pzn-02";
  const SANTRI_3 = "san-pzn-03";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Position PEMBINA_HALAQOH (Canonical Position for Mudhabbir)
    const posPembina = await prisma.position.upsert({
      where: { code: "PEMBINA_HALAQOH" },
      update: {},
      create: {
        id: "pos-pzn-pembina-halaqoh",
        code: "PEMBINA_HALAQOH",
        name: "Pembina Halaqoh / Mudhabbir",
        domain: "TAHFIZH",
      },
    });

    // 2. OrgUnits for Scope
    await prisma.orgUnit.createMany({
      data: [
        {
          id: "ou-pzn-hlq-01",
          code: "OU-PZN-HLQ-01",
          name: "Halaqoh Mudabbir",
          type: "HALAQOH",
          domain: "TAHFIZH",
          genderComplex: "PUTRA",
        },
        {
          id: "ou-pzn-hlq-02",
          code: "OU-PZN-HLQ-02",
          name: "Halaqoh Lain",
          type: "HALAQOH",
          domain: "TAHFIZH",
          genderComplex: "PUTRA",
        },
      ],
    });

    // 3. Staff records for KS, MK, and Mudabbir
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
        {
          id: STAFF_MUDABBIR,
          staffCode: "STF-PZN-MDB",
          nama: "Ustadz Mudabbir Kamar",
          noHp: "081234567892",
          roleStaff: "PH",
          status: "AKTIF",
        },
      ],
    });

    // 4. Halaqoh records
    await prisma.halaqoh.createMany({
      data: [
        {
          id: "hlq-pzn-01",
          halaqohCode: "HLQ-PZN-01",
          nama: "Halaqoh Utsman",
          pembinaId: STAFF_MUDABBIR,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
        {
          id: "hlq-pzn-02",
          halaqohCode: "HLQ-PZN-02",
          nama: "Halaqoh Ali",
          pembinaId: STAFF_MK,
          tahunAjaran: "2026/2027",
          status: "AKTIF",
        },
      ],
    });

    // 5. Santri records
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_1,
          nis: "SAN-PZN-001",
          nama: "Santri Uji Perizinan 1",
          kelas: "7A",
          jenisKelamin: JenisKelamin.L,
          halaqohId: "hlq-pzn-01",
        },
        {
          id: SANTRI_2,
          nis: "SAN-PZN-002",
          nama: "Santri Uji Perizinan 2",
          kelas: "7A",
          jenisKelamin: JenisKelamin.L,
          halaqohId: "hlq-pzn-01",
        },
        {
          id: SANTRI_3,
          nis: "SAN-PZN-003",
          nama: "Santri Luar Halaqoh 3",
          kelas: "7A",
          jenisKelamin: JenisKelamin.L,
          halaqohId: "hlq-pzn-02",
        },
      ],
    });

    // 6. User records
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
        {
          id: "usr-pzn-adm",
          username: "admin.portal",
          role: "ADM",
          passwordHash: "dummy-hash",
        },
        {
          id: "usr-pzn-osda",
          username: "mudabbir.osda",
          role: "OSDA",
          passwordHash: "dummy-hash",
        },
        {
          id: "usr-pzn-st",
          username: "santri.uji",
          role: "ST",
          santriId: SANTRI_1,
          passwordHash: "dummy-hash",
        },
        {
          id: "usr-pzn-ws",
          username: "wali.uji",
          role: "WS",
          santriId: null,
          passwordHash: "dummy-hash",
        },
        {
          id: "usr-pzn-mudabbir",
          username: "mudabbir.kamar",
          role: "PH",
          staffId: STAFF_MUDABBIR,
          passwordHash: "dummy-hash",
        },
        {
          id: "usr-pzn-no-asg",
          username: "noasg.mudabbir",
          role: "PH",
          passwordHash: "dummy-hash",
        },
      ],
    });

    // 7. Active Assignment for Mudabbir -> Position PEMBINA_HALAQOH
    await prisma.assignment.create({
      data: {
        id: "asg-pzn-mudabbir",
        userId: "usr-pzn-mudabbir",
        positionId: posPembina.id,
        unitId: "ou-pzn-hlq-01",
        status: "ACTIVE",
        createdById: "usr-pzn-ks",
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

  const DENIED_ROLES: Role[] = ["MT", "PH", "GA", "YAY"];

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
    const createdDataKS = res.data as { id?: string } | Array<{ id?: string }> | undefined;
    const ksId = Array.isArray(createdDataKS) ? createdDataKS[0]?.id : createdDataKS?.id;
    assert.ok(ksId, "Harus mengembalikan data izin yang dibuat");

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
    const createdDataMK = res.data as { id?: string } | Array<{ id?: string }> | undefined;
    const mkId = Array.isArray(createdDataMK) ? createdDataMK[0]?.id : createdDataMK?.id;
    assert.ok(mkId, "Harus mengembalikan data izin yang dibuat");

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount + 1, "DB write harus bertambah tepat 1 record");
  });

  it("ADM -> DENY: role ADM dilarang mencatat izin santri secara otomatis merely by role dan zero DB writes", async () => {
    const sessionADM: UserSession = {
      userId: "usr-pzn-adm",
      username: "admin.portal",
      name: "Admin STQ",
      role: "ADM",
    };
    setTestSession(sessionADM);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-09-25T08:00:00.000Z",
      tanggalSelesai: "2026-09-27T17:00:00.000Z",
      alasan: "Izin resmi dicatat langsung oleh Admin",
    });

    assert.strictEqual(res.success, false, "Admin (ADM) dilarang mencatat izin santri secara otomatis merely by role");
    assert.match(res.message, /kewenangan operasional|Akses ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: ADM pemanggilan dilarang menambah data");
  });

  it("OSDA -> DENY: generic OSDA dilarang mencatat izin santri (OSDA is NOT Mudabbir) dan zero DB writes", async () => {
    const sessionOSDA: UserSession = {
      userId: "usr-pzn-osda",
      username: "generic.osda",
      name: "Pengurus OSDA",
      role: "OSDA",
    };
    setTestSession(sessionOSDA);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Izin belanja kebutuhan santri",
    });

    assert.strictEqual(res.success, false, "Generic OSDA dilarang mencatat izin (OSDA is not Mudabbir)");
    assert.match(res.message, /kewenangan perizinan|Mudabbir bukan OSDA|Akses Ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: Generic OSDA dilarang menambah data");
  });

  it("WS -> DENY: role WS dilarang menggunakan santri self-request path dan zero DB writes", async () => {
    const sessionWS: UserSession = {
      userId: "usr-pzn-ws",
      username: "wali.uji",
      name: "Wali Santri",
      role: "WS",
      santriId: SANTRI_1,
    };
    setTestSession(sessionWS);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-09-29T08:00:00.000Z",
      tanggalSelesai: "2026-09-30T17:00:00.000Z",
      alasan: "Wali santri mencoba input perizinan mandiri",
    });

    assert.strictEqual(res.success, false, "Wali Santri dilarang input izin mandiri tanpa persetujuan");
    assert.match(res.message, /Wali Santri tidak berwenang|Akses Ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: WS dilarang menambah data");
  });

  it("1. PEMBINA_HALAQOH active assignment receives Mudhabbir permit authority", async () => {
    const sessionMudabbir: UserSession = {
      userId: "usr-pzn-mudabbir",
      username: "mudabbir.kamar",
      name: "Mudabbir Kamar",
      role: "PH",
      staffId: STAFF_MUDABBIR,
    };
    setTestSession(sessionMudabbir);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Izin beli perlengkapan santri same-day",
    });

    assert.strictEqual(res.success, true, "PEMBINA_HALAQOH active assignment receives Mudhabbir permit authority");
    const createdData = res.data as { id?: string; status?: string } | Array<{ id?: string; status?: string }>;
    const created = Array.isArray(createdData) ? createdData[0] : createdData;
    assert.strictEqual(created?.status, "DISETUJUI", "Izin same-day Mudabbir langsung berstatus DISETUJUI");

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount + 1, "DB write harus bertambah tepat 1 record");
  });

  it("2. A user with only session.isMudabbir=true but NO valid active PEMBINA_HALAQOH assignment is DENIED", async () => {
    const initialCount = await prisma.perizinanSantri.count();
    const sessionSpoofed: UserSession = {
      userId: "usr-pzn-no-asg",
      username: "noasg.mudabbir",
      name: "Unassigned Mudabbir",
      role: "PH",
      isMudabbir: true, // Only session boolean, no active DB assignment
    };
    setTestSession(sessionSpoofed);

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Percobaan izin tanpa assignment di DB",
    });

    assert.strictEqual(res.success, false, "User with only session.isMudabbir=true must be DENIED");
    assert.match(res.message, /kewenangan|Akses ditolak|Akses Ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: unauthorized session boolean must not write to DB");
  });

  it("3. Generic OSDA is DENIED Mudhabbir authority", async () => {
    const initialCount = await prisma.perizinanSantri.count();
    const sessionOSDA: UserSession = {
      userId: "usr-pzn-osda",
      username: "mudabbir.osda",
      name: "Pengurus OSDA",
      role: "OSDA",
      isMudabbir: true, // Even if session flag is set, generic OSDA is not Mudabbir
    };
    setTestSession(sessionOSDA);

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Izin belanja kebutuhan santri",
    });

    assert.strictEqual(res.success, false, "Generic OSDA must be denied Mudhabbir authority");
    assert.match(res.message, /kewenangan perizinan|Mudabbir bukan OSDA|Akses Ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: Generic OSDA must not write to DB");
  });

  it("4. ADM is DENIED Mudhabbir authority", async () => {
    const initialCount = await prisma.perizinanSantri.count();
    const sessionADM: UserSession = {
      userId: "usr-pzn-adm",
      username: "admin.portal",
      name: "Admin STQ",
      role: "ADM",
      isMudabbir: true,
    };
    setTestSession(sessionADM);

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-09-25T08:00:00.000Z",
      tanggalSelesai: "2026-09-27T17:00:00.000Z",
      alasan: "Izin resmi dicatat langsung oleh Admin",
    });

    assert.strictEqual(res.success, false, "ADM must be denied Mudhabbir authority");
    assert.match(res.message, /kewenangan operasional|Akses ditolak|Akses Ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: ADM must not write to DB");
  });

  it("5. Same-day non-vehicle exit by Mudhabbir -> APPROVED (same-day no vehicle -> DISETUJUI)", async () => {
    setTestSession({
      userId: "usr-pzn-mudabbir",
      username: "mudabbir.kamar",
      role: "PH",
      staffId: STAFF_MUDABBIR,
    });
    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Izin keluar membeli kitab di sekitar pesantren jalan kaki",
      usesVehicle: false,
    });
    assert.strictEqual(res.success, true);
    const data = res.data as any;
    assert.strictEqual(data.status, "DISETUJUI");
    assert.strictEqual(data.usesVehicle, false);
  });

  it("6. Vehicle permit escalation relies ONLY on structured usesVehicle (NO text heuristics)", async () => {
    setTestSession({
      userId: "usr-pzn-mudabbir",
      username: "mudabbir.kamar",
      role: "PH",
      staffId: STAFF_MUDABBIR,
    });

    // 1. usesVehicle=false + alasan contains word "kendaraan" -> must NOT escalate solely because of text (DISETUJUI)
    const res1 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Izin jalan kaki membawa perlengkapan kendaraan motor",
      usesVehicle: false,
    });
    assert.strictEqual(res1.success, true);
    const data1 = res1.data as any;
    assert.strictEqual(
      data1.status,
      "DISETUJUI",
      "usesVehicle=false must NOT escalate solely because of vehicle keywords in alasan"
    );
    assert.strictEqual(data1.usesVehicle, false);

    // 2. usesVehicle=true + alasan contains no vehicle-related word -> MUST escalate (MENUNGGU_MK)
    const res2 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Beli kitab dan alat tulis di toko seberang",
      usesVehicle: true,
    });
    assert.strictEqual(res2.success, true);
    const data2 = res2.data as any;
    assert.strictEqual(
      data2.status,
      "MENUNGGU_MK",
      "usesVehicle=true MUST escalate to MENUNGGU_MK even with no vehicle words in alasan"
    );
    assert.strictEqual(data2.usesVehicle, true);

    // 3. same-day no vehicle -> DISETUJUI
    const res3 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T09:00:00.000Z",
      tanggalSelesai: "2026-09-28T15:00:00.000Z",
      alasan: "Ke perpustakaan daerah jalan kaki santai",
      usesVehicle: false,
    });
    assert.strictEqual(res3.success, true);
    const data3 = res3.data as any;
    assert.strictEqual(data3.status, "DISETUJUI", "same-day no vehicle -> DISETUJUI");
    assert.strictEqual(data3.usesVehicle, false);

    // 4. same-day with vehicle -> MENUNGGU_MK
    const res4 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T09:00:00.000Z",
      tanggalSelesai: "2026-09-28T15:00:00.000Z",
      alasan: "Ke perpustakaan daerah antar berkas",
      usesVehicle: true,
    });
    assert.strictEqual(res4.success, true);
    const data4 = res4.data as any;
    assert.strictEqual(data4.status, "MENUNGGU_MK", "same-day with vehicle -> MENUNGGU_MK");
    assert.strictEqual(data4.usesVehicle, true);

    // Backward compatibility alias: input.kendaraan: true -> MENUNGGU_MK
    const res5 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Urusan dinas santri",
      kendaraan: true,
    });
    assert.strictEqual(res5.success, true);
    const data5 = res5.data as any;
    assert.strictEqual(data5.status, "MENUNGGU_MK");
    assert.strictEqual(data5.usesVehicle, true);
  });

  it("7. Pulang -> MENUNGGU_MK regardless of vehicle", async () => {
    setTestSession({
      userId: "usr-pzn-mudabbir",
      username: "mudabbir.kamar",
      role: "PH",
      staffId: STAFF_MUDABBIR,
    });

    // 7A: PULANG without vehicle -> MENUNGGU_MK
    const res1 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-10-01T08:00:00.000Z",
      tanggalSelesai: "2026-10-03T17:00:00.000Z",
      alasan: "Izin kepulangan santri dicatat oleh Mudabbir tanpa kendaraan",
      usesVehicle: false,
    });
    assert.strictEqual(res1.success, true);
    const data1 = res1.data as any;
    assert.strictEqual(data1.status, "MENUNGGU_MK");
    assert.strictEqual(data1.usesVehicle, false);

    // 7B: PULANG with vehicle -> MENUNGGU_MK
    const res2 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-10-01T08:00:00.000Z",
      tanggalSelesai: "2026-10-03T17:00:00.000Z",
      alasan: "Izin kepulangan santri dicatat oleh Mudabbir dengan kendaraan",
      usesVehicle: true,
    });
    assert.strictEqual(res2.success, true);
    const data2 = res2.data as any;
    assert.strictEqual(data2.status, "MENUNGGU_MK");
    assert.strictEqual(data2.usesVehicle, true);
  });

  it("8. Menginap -> MENUNGGU_MK regardless of vehicle", async () => {
    setTestSession({
      userId: "usr-pzn-mudabbir",
      username: "mudabbir.kamar",
      role: "PH",
      staffId: STAFF_MUDABBIR,
    });

    // 8A: Multi-day KELUAR_KOMPLEK without vehicle -> MENUNGGU_MK
    const res1 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-10-01T08:00:00.000Z",
      tanggalSelesai: "2026-10-02T17:00:00.000Z",
      alasan: "Izin keluar bermalam untuk perlombaan santri jalan kaki",
      usesVehicle: false,
    });
    assert.strictEqual(res1.success, true);
    const data1 = res1.data as any;
    assert.strictEqual(data1.status, "MENUNGGU_MK");
    assert.strictEqual(data1.usesVehicle, false);

    // 8B: Same-day but menginap: true with vehicle -> MENUNGGU_MK
    const res2 = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-10-01T08:00:00.000Z",
      tanggalSelesai: "2026-10-01T21:00:00.000Z",
      alasan: "Izin menginap di kerabat",
      menginap: true,
      usesVehicle: true,
    });
    assert.strictEqual(res2.success, true);
    const data2 = res2.data as any;
    assert.strictEqual(data2.status, "MENUNGGU_MK");
    assert.strictEqual(data2.usesVehicle, true);
  });

  it("9. Cross-scope Santri access -> DENY", async () => {
    const initialCount = await prisma.perizinanSantri.count();
    setTestSession({
      userId: "usr-pzn-mudabbir",
      username: "mudabbir.kamar",
      role: "PH",
      staffId: STAFF_MUDABBIR,
    });

    // SANTRI_3 is assigned to hlq-pzn-02 (outside Mudabbir's assignment hlq-pzn-01)
    const res = await ajukanIzinAction({
      santriId: SANTRI_3,
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-09-28T08:00:00.000Z",
      tanggalSelesai: "2026-09-28T16:00:00.000Z",
      alasan: "Izin santri di luar binaan",
    });

    assert.strictEqual(res.success, false, "Cross-scope Santri access must be DENIED");
    assert.match(res.message, /Akses Ditolak.*di luar cakupan binaan/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes on cross-scope access attempt");
  });

  it("10. No duplicate MUDABBIR or KEPALA_SEKOLAH canonical Position is created", async () => {
    const duplicateMudabbir = await prisma.position.findFirst({
      where: {
        code: { in: ["MUDABBIR", "MUDHABBIR"] },
      },
    });
    assert.strictEqual(
      duplicateMudabbir,
      null,
      "Canonical Position for Mudhabbir is PEMBINA_HALAQOH. No MUDABBIR Position record allowed in DB."
    );

    const duplicateKS = await prisma.position.findFirst({
      where: {
        code: "KEPALA_SEKOLAH",
      },
    });
    assert.strictEqual(
      duplicateKS,
      null,
      "Canonical Position for Kepala Sekolah is MUDIR. No KEPALA_SEKOLAH Position record allowed in DB."
    );
  });

  it("ST -> ALLOW: Santri berhak mengajukan permohonan izin mandiri untuk diri sendiri (MENUNGGU_MK)", async () => {
    const sessionST: UserSession = {
      userId: "usr-pzn-st",
      username: "santri.uji",
      name: "Santri Uji",
      role: "ST",
      santriId: SANTRI_1,
    };
    setTestSession(sessionST);

    const initialCount = await prisma.perizinanSantri.count();

    const res = await ajukanIzinAction({
      santriId: SANTRI_1,
      jenis: JenisIzin.PULANG,
      tanggalMulai: "2026-10-05T08:00:00.000Z",
      tanggalSelesai: "2026-10-07T17:00:00.000Z",
      alasan: "Keperluan keluarga di luar kota",
    });

    assert.strictEqual(res.success, true, "Santri mandiri harus berhasil mengajukan izin");
    const createdData = res.data as { id?: string; status?: string } | Array<{ id?: string; status?: string }>;
    const created = Array.isArray(createdData) ? createdData[0] : createdData;
    assert.strictEqual(created?.status, "MENUNGGU_MK", "Izin mandiri santri harus berstatus MENUNGGU_MK");

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount + 1, "DB write harus bertambah tepat 1 record");
  });

  it("ST (batch/other) -> DENY: Santri dilarang mengajukan izin untuk santri lain atau batch", async () => {
    const sessionST: UserSession = {
      userId: "usr-pzn-st",
      username: "santri.uji",
      name: "Santri Uji",
      role: "ST",
      santriId: SANTRI_1,
    };
    setTestSession(sessionST);

    const initialCount = await prisma.perizinanSantri.count();

    const resBatch = await ajukanIzinAction({
      santriIds: [SANTRI_1, "san-other-01"],
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-10-08T08:00:00.000Z",
      tanggalSelesai: "2026-10-08T17:00:00.000Z",
      alasan: "Coba batch oleh santri",
    });

    assert.strictEqual(resBatch.success, false, "Santri dilarang mengajukan batch");
    assert.match(resBatch.message, /maksimal 1 santri|diri sendiri|Akses Ditolak/i);

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount, "Zero DB writes: Percobaan batch santri ditolak");
  });

  it("Musyrif batch -> independent approved tickets with shared batchId", async () => {
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
      santriIds: [SANTRI_1, SANTRI_2],
      jenis: JenisIzin.KELUAR_KOMPLEK,
      tanggalMulai: "2026-10-10T08:00:00.000Z",
      tanggalSelesai: "2026-10-10T16:00:00.000Z",
      alasan: "Izin batch keluar komplek untuk kegiatan asrama",
    });

    assert.strictEqual(res.success, true);
    const dataList = res.data as Array<{ id: string; status: string; batchId: string | null; santriId: string }>;
    assert.ok(Array.isArray(dataList), "Batch submission must return array of tickets");
    assert.strictEqual(dataList.length, 2, "Must create exactly 2 tickets");
    assert.strictEqual(dataList[0].status, "DISETUJUI");
    assert.strictEqual(dataList[1].status, "DISETUJUI");
    assert.notStrictEqual(dataList[0].id, dataList[1].id, "Tickets must have independent IDs");
    assert.ok(dataList[0].batchId, "Batch ID must exist");
    assert.strictEqual(dataList[0].batchId, dataList[1].batchId, "Tickets must share the same batchId");

    const postCount = await prisma.perizinanSantri.count();
    assert.strictEqual(postCount, initialCount + 2, "DB write must increase by exactly 2 records");
  });

  it("Return per Santri: Musyrif confirms return for individual approved ticket", async () => {
    const sessionMK: UserSession = {
      userId: "usr-pzn-mk",
      username: "musyrif.keasramaan",
      name: "Musyrif Keasramaan",
      role: "MK",
      staffId: STAFF_MK,
    };
    setTestSession(sessionMK);

    // Create an approved ticket that is due in the future (on-time return)
    const futureDate = new Date(Date.now() + 86400000);
    const created = await prisma.perizinanSantri.create({
      data: {
        kodeIzin: `IZN-TEST-ONTIME-${Date.now()}`,
        santriId: SANTRI_1,
        jenis: JenisIzin.KELUAR_KOMPLEK,
        status: "DISETUJUI",
        tanggalMulai: new Date(),
        tanggalSelesai: futureDate,
        alasan: "Izin on-time return test",
        diajukanOlehUserId: "usr-pzn-mk",
        diajukanOlehRole: "MK",
      },
    });

    const res = await konfirmasiKembaliIzinAction({ izinId: created.id });
    assert.strictEqual(res.success, true);
    const updated = res.data as any;
    assert.strictEqual(updated.status, "KEMBALI_TERKONFIRMASI");
    assert.strictEqual(updated.isLate, false, "On-time return must have isLate: false");
    assert.ok(updated.returnedAt, "returnedAt must be populated");
    assert.strictEqual(updated.returnedBy, "musyrif.keasramaan");
  });

  it("Late != Violation: Return after deadline sets isLate: true but creates ZERO PelanggaranSantri records", async () => {
    const sessionMK: UserSession = {
      userId: "usr-pzn-mk",
      username: "musyrif.keasramaan",
      name: "Musyrif Keasramaan",
      role: "MK",
      staffId: STAFF_MK,
    };
    setTestSession(sessionMK);

    // Create an approved ticket whose deadline was in the past
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    const created = await prisma.perizinanSantri.create({
      data: {
        kodeIzin: `IZN-TEST-LATE-${Date.now()}`,
        santriId: SANTRI_1,
        jenis: JenisIzin.KELUAR_KOMPLEK,
        status: "DISETUJUI",
        tanggalMulai: new Date(Date.now() - 7200000),
        tanggalSelesai: pastDate,
        alasan: "Izin late return test",
        diajukanOlehUserId: "usr-pzn-mk",
        diajukanOlehRole: "MK",
      },
    });

    const initialPelanggaranCount = await prisma.pelanggaranSantri.count();

    const res = await konfirmasiKembaliIzinAction({ izinId: created.id });
    assert.strictEqual(res.success, true);
    const updated = res.data as any;
    assert.strictEqual(updated.status, "KEMBALI_TERKONFIRMASI");
    assert.strictEqual(updated.isLate, true, "Late return must have isLate: true");

    // CRITICAL: late != violation
    const postPelanggaranCount = await prisma.pelanggaranSantri.count();
    assert.strictEqual(
      postPelanggaranCount,
      initialPelanggaranCount,
      "Zero PelanggaranSantri writes: late return must NOT automatically create violation records"
    );
  });

  it("Soft cancellation preserves actor, timestamp, reason and ZERO deletions", async () => {
    const sessionMK: UserSession = {
      userId: "usr-pzn-mk",
      username: "musyrif.keasramaan",
      name: "Musyrif Keasramaan",
      role: "MK",
      staffId: STAFF_MK,
    };
    setTestSession(sessionMK);

    const created = await prisma.perizinanSantri.create({
      data: {
        kodeIzin: `IZN-TEST-CANCEL-${Date.now()}`,
        santriId: SANTRI_1,
        jenis: JenisIzin.PULANG,
        status: "MENUNGGU_MK",
        tanggalMulai: new Date(),
        tanggalSelesai: new Date(Date.now() + 86400000),
        alasan: "Izin hendak dibatalkan",
        diajukanOlehUserId: "usr-pzn-mk",
        diajukanOlehRole: "MK",
      },
    });

    const totalBeforeCancel = await prisma.perizinanSantri.count();

    const res = await batalkanIzinAction({
      izinId: created.id,
      alasan: "Santri membatalkan rencana pulang karena ada kegiatan madrasah",
    });

    assert.strictEqual(res.success, true);
    const updated = res.data as any;
    assert.strictEqual(updated.status, "DIBATALKAN");
    assert.strictEqual(
      updated.cancelReason,
      "Santri membatalkan rencana pulang karena ada kegiatan madrasah"
    );
    assert.strictEqual(updated.cancelledBy, "musyrif.keasramaan");
    assert.ok(updated.cancelledAt, "cancelledAt timestamp must be recorded");

    // ZERO deletions: record still exists in DB
    const totalAfterCancel = await prisma.perizinanSantri.count();
    assert.strictEqual(totalAfterCancel, totalBeforeCancel, "Zero DB deletions: soft cancellation preserves record in DB");

    const recordInDb = await prisma.perizinanSantri.findUnique({
      where: { id: created.id },
    });
    assert.ok(recordInDb, "Record must still exist in DB");
    assert.strictEqual(recordInDb.status, "DIBATALKAN");
  });

  it("OSDA -> DENY: generic OSDA dilarang konfirmasi kepulangan dan dilarang batalkan izin", async () => {
    const sessionOSDA: UserSession = {
      userId: "usr-pzn-osda",
      username: "generic.osda",
      name: "Pengurus OSDA",
      role: "OSDA",
    };
    setTestSession(sessionOSDA);

    const resReturn = await konfirmasiKembaliIzinAction({ izinId: "any-id" });
    assert.strictEqual(resReturn.success, false);
    assert.match(resReturn.message, /Akses ditolak/i);

    const resCancel = await batalkanIzinAction({ izinId: "any-id", alasan: "OSDA coba batalkan" });
    assert.strictEqual(resCancel.success, false);
    assert.match(resCancel.message, /tidak memiliki hak akses/i);
  });

  it("ADM -> DENY: role ADM dilarang konfirmasi kepulangan dan dilarang batalkan izin merely by role", async () => {
    const sessionADM: UserSession = {
      userId: "usr-pzn-adm",
      username: "admin.portal",
      name: "Admin STQ",
      role: "ADM",
    };
    setTestSession(sessionADM);

    const resReturn = await konfirmasiKembaliIzinAction({ izinId: "any-id" });
    assert.strictEqual(resReturn.success, false);
    assert.match(resReturn.message, /Akses ditolak/i);

    const resCancel = await batalkanIzinAction({ izinId: "any-id", alasan: "ADM coba batalkan" });
    assert.strictEqual(resCancel.success, false);
    assert.match(resCancel.message, /tidak memiliki hak akses/i);
  });
});
