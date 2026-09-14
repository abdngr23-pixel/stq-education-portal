(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, StatusIkhtibar, JenisUjiHafalan, NilaiSetoran } from "@prisma/client";
import { startTestDatabase, stopTestDatabase, runIsolatedMigrationChainVerification } from "./test-db-manager";
import { setTestSession, createSessionToken } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  NILAI_SETORAN_ORDER,
  NILAI_SETORAN_RANK,
  VALID_NILAI_SETORAN_VALUES,
  deriveOverallNilai,
  mistakeCountsSchema,
  DEFAULT_MISTAKE_COUNTS,
  compareQualityDimension,
  calculateQualityTrend,
  CANONICAL_MISTAKE_KEYS,
  MISTAKE_LABELS,
} from "../lib/tahfizh-quality";
import { setoranSchema, evaluasiRubuSchema } from "../lib/validations";
import { saveSetoranTahfizhCore } from "../lib/tahfizh-persistence";
import { createSetoranAction } from "../app/actions/tahfizh";
import { createEvaluasiRubuAction, getEvaluasiRubuListAction } from "../app/actions/rubu";
import { recordTasmiSimaanAction } from "../app/actions/laporan-bulanan";
import { inputHasilTahap1Action, inputHasilTahap2Action } from "../app/actions/ikhtibar";
import { getSantriListForSession } from "../lib/server/santri-list-service";
import { GET as getSetoranApi, POST as postSetoranApi } from "../app/api/v1/setoran/route";

describe("PR #8 — Tahfizh Quality & Evaluation Engine (Comprehensive Test Suite)", () => {
  let prisma: PrismaClient;

  // Master Test Entities
  const STAFF_MT_1_ID = "stf-q-mt-01";
  const STAFF_MT_2_ID = "stf-q-mt-02";
  const STAFF_KABID_ID = "stf-q-kabid";
  const STAFF_MUDIR_ID = "stf-q-mudir";
  const STAFF_PH_ID = "stf-q-ph";
  const STAFF_ADM_ID = "stf-q-adm";
  const STAFF_YAY_ID = "stf-q-yay";

  const HALAQOH_1_ID = "hlq-q-01";
  const HALAQOH_2_ID = "hlq-q-02";

  const SANTRI_1_ID = "san-q-01";
  const SANTRI_2_ID = "san-q-02";
  const SANTRI_3_ID = "san-q-03";

  const sessionMT1: UserSession = {
    userId: "usr-q-mt-01",
    username: "musyrif.q1",
    name: "Ust. Musyrif Q1",
    role: "MT",
    staffId: STAFF_MT_1_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionMT2: UserSession = {
    userId: "usr-q-mt-02",
    username: "musyrif.q2",
    name: "Ust. Musyrif Q2",
    role: "MT",
    staffId: STAFF_MT_2_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionKabid: UserSession = {
    userId: "usr-q-kabid",
    username: "kabid.q",
    name: "Ust. Kabid Q",
    role: "MT",
    staffId: STAFF_KABID_ID,
    isKepalaBidangTahfidz: true,
  };

  const sessionMudir: UserSession = {
    userId: "usr-q-mudir",
    username: "mudir.q",
    name: "Kyai Mudir Q",
    role: "KS",
    staffId: STAFF_MUDIR_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionPH: UserSession = {
    userId: "usr-q-ph",
    username: "pengasuhan.q",
    name: "Ust. Pengasuhan",
    role: "PH",
    staffId: STAFF_PH_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionADM: UserSession = {
    userId: "usr-q-adm",
    username: "admin.q",
    name: "Admin Tahfizh",
    role: "ADM",
    staffId: STAFF_ADM_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionYAY: UserSession = {
    userId: "usr-q-yay",
    username: "yayasan.q",
    name: "Pengurus Yayasan",
    role: "YAY",
    staffId: STAFF_YAY_ID,
    isKepalaBidangTahfidz: false,
  };

  const sessionMTNoStaff: UserSession = {
    userId: "usr-q-mt-nostaff",
    username: "musyrif.nostaff",
    name: "Ust. Musyrif Tanpa Staf",
    role: "MT",
    staffId: undefined,
    isKepalaBidangTahfidz: false,
  };

  const sessionWali: UserSession = {
    userId: "usr-q-wali",
    username: "wali.q",
    name: "Bapak Wali",
    role: "WS",
    santriId: SANTRI_1_ID,
  };

  const sessionSantri: UserSession = {
    userId: "usr-q-santri",
    username: "santri.q",
    name: "Santri Q",
    role: "ST",
    santriId: SANTRI_2_ID,
  };

  before(async () => {
    prisma = await startTestDatabase();

    // Clean up test entities
    await prisma.evaluasiRubuTahfizh.deleteMany();
    await prisma.tasmiSimaan.deleteMany();
    await prisma.ikhtibarTahfizh.deleteMany();
    await prisma.setoranTahfizh.deleteMany();
    await prisma.targetSantri.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.santri.deleteMany();
    await prisma.halaqoh.deleteMany();
    await prisma.staff.deleteMany();

    // Create staff
    await prisma.staff.createMany({
      data: [
        { id: STAFF_MT_1_ID, staffCode: "STF-Q01", nama: "Ust. Musyrif Q1", roleStaff: "MT", status: "AKTIF", noHp: "08111111111" },
        { id: STAFF_MT_2_ID, staffCode: "STF-Q02", nama: "Ust. Musyrif Q2", roleStaff: "MT", status: "AKTIF", noHp: "08222222222" },
        { id: STAFF_KABID_ID, staffCode: "STF-QK", nama: "Ust. Kabid Q", roleStaff: "MT", isKepalaBidangTahfidz: true, status: "AKTIF", noHp: "08333333333" },
        { id: STAFF_MUDIR_ID, staffCode: "STF-QM", nama: "Kyai Mudir Q", roleStaff: "KS", status: "AKTIF", noHp: "08444444444" },
        { id: STAFF_PH_ID, staffCode: "STF-QPH", nama: "Ust. Pengasuhan", roleStaff: "PH", status: "AKTIF", noHp: "08555555555" },
        { id: STAFF_ADM_ID, staffCode: "STF-QADM", nama: "Admin Tahfizh", roleStaff: "ADM", status: "AKTIF", noHp: "08666666666" },
        { id: STAFF_YAY_ID, staffCode: "STF-QYAY", nama: "Yayasan", roleStaff: "YAY", status: "AKTIF", noHp: "08777777777" },
      ],
    });

    // Create halaqoh
    await prisma.halaqoh.createMany({
      data: [
        { id: HALAQOH_1_ID, halaqohCode: "HLQ-Q01", nama: "Halaqoh Utsman (MT1)", pembinaId: STAFF_MT_1_ID, tahunAjaran: "2026/2027", status: "AKTIF" },
        { id: HALAQOH_2_ID, halaqohCode: "HLQ-Q02", nama: "Halaqoh Ali (MT2)", pembinaId: STAFF_MT_2_ID, tahunAjaran: "2026/2027", status: "AKTIF" },
      ],
    });

    // Create santri first so users can link santriId
    await prisma.santri.createMany({
      data: [
        { id: SANTRI_1_ID, nis: "SAN-Q01", nama: "Ahmad Santri Q1", kelas: "7A", jenisKelamin: "L", halaqohId: HALAQOH_1_ID, status: "AKTIF" },
        { id: SANTRI_2_ID, nis: "SAN-Q02", nama: "Bilal Santri Q2", kelas: "7A", jenisKelamin: "L", halaqohId: HALAQOH_2_ID, status: "AKTIF" },
        { id: SANTRI_3_ID, nis: "SAN-Q03", nama: "Choirul Santri Q3", kelas: "7B", jenisKelamin: "L", halaqohId: HALAQOH_1_ID, status: "AKTIF" },
      ],
    });

    // Create users
    await prisma.user.createMany({
      data: [
        { id: sessionMT1.userId, username: sessionMT1.username, passwordHash: "dummy", role: "MT", staffId: STAFF_MT_1_ID },
        { id: sessionMT2.userId, username: sessionMT2.username, passwordHash: "dummy", role: "MT", staffId: STAFF_MT_2_ID },
        { id: sessionKabid.userId, username: sessionKabid.username, passwordHash: "dummy", role: "MT", staffId: STAFF_KABID_ID },
        { id: sessionMudir.userId, username: sessionMudir.username, passwordHash: "dummy", role: "KS", staffId: STAFF_MUDIR_ID },
        { id: sessionPH.userId, username: sessionPH.username, passwordHash: "dummy", role: "PH", staffId: STAFF_PH_ID },
        { id: sessionADM.userId, username: sessionADM.username, passwordHash: "dummy", role: "ADM", staffId: STAFF_ADM_ID },
        { id: sessionYAY.userId, username: sessionYAY.username, passwordHash: "dummy", role: "YAY", staffId: STAFF_YAY_ID },
        { id: sessionWali.userId, username: sessionWali.username, passwordHash: "dummy", role: "WS", santriId: SANTRI_1_ID },
        { id: sessionSantri.userId, username: sessionSantri.username, passwordHash: "dummy", role: "ST", santriId: SANTRI_2_ID },
      ],
    });
  });

  after(async () => {
    setTestSession(null);
    if (prisma) {
      await prisma.evaluasiRubuTahfizh.deleteMany();
      await prisma.tasmiSimaan.deleteMany();
      await prisma.ikhtibarTahfizh.deleteMany();
      await prisma.setoranTahfizh.deleteMany();
      await prisma.auditLog.deleteMany();
      await prisma.santri.deleteMany();
      await prisma.halaqoh.deleteMany();
      await prisma.user.deleteMany();
      await prisma.staff.deleteMany();
      await stopTestDatabase();
    }
  });

  // -------------------------------------------------------------
  // 1. CANONICAL ORDER & COMPARISON
  // -------------------------------------------------------------
  describe("1. Canonical Predicate Order & Overall Derivation", () => {
    it("mematuhi urutan kanonikal: DHOIF < MAQBUL < JAYYID < JAYYID_JIDDAN < MUMTAZ", () => {
      assert.deepEqual(NILAI_SETORAN_ORDER, [
        "DHOIF",
        "MAQBUL",
        "JAYYID",
        "JAYYID_JIDDAN",
        "MUMTAZ",
      ]);

      assert.ok(NILAI_SETORAN_RANK.DHOIF < NILAI_SETORAN_RANK.MAQBUL);
      assert.ok(NILAI_SETORAN_RANK.MAQBUL < NILAI_SETORAN_RANK.JAYYID);
      assert.ok(NILAI_SETORAN_RANK.JAYYID < NILAI_SETORAN_RANK.JAYYID_JIDDAN);
      assert.ok(NILAI_SETORAN_RANK.JAYYID_JIDDAN < NILAI_SETORAN_RANK.MUMTAZ);

      // RASIB tidak boleh ada di VALID_NILAI_SETORAN_VALUES
      assert.equal((VALID_NILAI_SETORAN_VALUES as string[]).includes("RASIB"), false);
      assert.equal(NILAI_SETORAN_ORDER.length, 5);
    });

    it("menurunkan predikat keseluruhan (overall nilai) = dimensi terendah (worst dimension)", () => {
      // MUMTAZ / MUMTAZ / MUMTAZ -> MUMTAZ
      assert.equal(
        deriveOverallNilai({ tajwid: "MUMTAZ", fashahah: "MUMTAZ", kelancaran: "MUMTAZ" }),
        "MUMTAZ"
      );

      // MUMTAZ / JAYYID / JAYYID_JIDDAN -> JAYYID
      assert.equal(
        deriveOverallNilai({ tajwid: "MUMTAZ", fashahah: "JAYYID", kelancaran: "JAYYID_JIDDAN" }),
        "JAYYID"
      );

      // MAQBUL / JAYYID / MUMTAZ -> MAQBUL
      assert.equal(
        deriveOverallNilai({ tajwid: "MAQBUL", fashahah: "JAYYID", kelancaran: "MUMTAZ" }),
        "MAQBUL"
      );

      // DHOIF / MUMTAZ / MUMTAZ -> DHOIF
      assert.equal(
        deriveOverallNilai({ tajwid: "DHOIF", fashahah: "MUMTAZ", kelancaran: "MUMTAZ" }),
        "DHOIF"
      );

      // MUMTAZ / DHOIF / JAYYID -> DHOIF
      assert.equal(
        deriveOverallNilai({ tajwid: "MUMTAZ", fashahah: "DHOIF", kelancaran: "JAYYID" }),
        "DHOIF"
      );
    });

    it("menolak nilai RASIB pada validasi setoran dan evaluasi rubu", () => {
      const invalidSetoran = setoranSchema.safeParse({
        santriId: SANTRI_1_ID,
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 1,
        jumlahHalaman: 1,
        nilaiTajwid: "RASIB",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(invalidSetoran.success, false);

      const invalidRubu = evaluasiRubuSchema.safeParse({
        santriId: SANTRI_1_ID,
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "RASIB",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(invalidRubu.success, false);
    });
  });

  // -------------------------------------------------------------
  // 2. ERROR TAXONOMY CONTRACT
  // -------------------------------------------------------------
  describe("2. Error Taxonomy Contract (8 Canonical Keys)", () => {
    it("memiliki tepat 8 kategori resmi dengan label deskriptif", () => {
      assert.equal(CANONICAL_MISTAKE_KEYS.length, 8);
      CANONICAL_MISTAKE_KEYS.forEach((key) => {
        assert.ok(MISTAKE_LABELS[key], `Label untuk ${key} harus ada`);
        assert.ok(MISTAKE_LABELS[key].label.length > 0);
      });
    });

    it("menerima integer >= 0 dan menolak angka negatif atau desimal", () => {
      const valid = mistakeCountsSchema.safeParse({
        makhrajDanSifat: 0,
        mad: 2,
        ghunnahDanAhkamNunMim: 1,
        waqafIbtida: 0,
        harakatLafadz: 3,
        tawaqqufLupa: 0,
        tasyabuhAyat: 1,
        lainnya: 0,
      });
      assert.equal(valid.success, true);

      const negative = mistakeCountsSchema.safeParse({
        ...DEFAULT_MISTAKE_COUNTS,
        mad: -1,
      });
      assert.equal(negative.success, false);

      const decimal = mistakeCountsSchema.safeParse({
        ...DEFAULT_MISTAKE_COUNTS,
        harakatLafadz: 1.5,
      });
      assert.equal(decimal.success, false);
    });

    it("menolak unknown keys (strict mode)", () => {
      const withExtra = mistakeCountsSchema.safeParse({
        ...DEFAULT_MISTAKE_COUNTS,
        unknownField: 5,
      });
      assert.equal(withExtra.success, false);
    });
  });

  // -------------------------------------------------------------
  // 3. DAILY SETORAN WRITE & SERVER DERIVATION
  // -------------------------------------------------------------
  describe("3. Daily Setoran Structured Quality & Server Derivation", () => {
    it("menyimpan setoran terstruktur dan menurunkan nilai overall dari worst dimension di server", async () => {
      setTestSession(sessionMT1);

      const res = await createSetoranAction({
        santriId: SANTRI_1_ID,
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 1,
        jumlahHalaman: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "JAYYID",
        nilaiKelancaran: "JAYYID_JIDDAN",
        rincianKesalahan: {
          ...DEFAULT_MISTAKE_COUNTS,
          mad: 1,
          harakatLafadz: 2,
        },
        nilai: "MUMTAZ", // Client mencoba klaim MUMTAZ, server WAJIB mengganti dengan hasil derive (JAYYID)
      });

      assert.equal(res.success, true);

      // Verifikasi di database
      const saved = await prisma.setoranTahfizh.findFirst({
        where: { santriId: SANTRI_1_ID },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(saved);
      assert.equal(saved.nilaiTajwid, "MUMTAZ");
      assert.equal(saved.nilaiFashahah, "JAYYID");
      assert.equal(saved.nilaiKelancaran, "JAYYID_JIDDAN");
      assert.equal(saved.nilai, "JAYYID"); // Server-derived single source of truth!
      const mistakes = saved.rincianKesalahan as Record<string, unknown>;
      assert.deepEqual(mistakes.harakatLafadz, 2);

      // Verifikasi AuditLog memuat structured snapshot tanpa PII berlebih
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: saved.id, action: "CREATE_SETORAN" },
      });
      assert.ok(audit);
      const details = audit.details as Record<string, unknown>;
      assert.equal(details.nilaiTajwid, "MUMTAZ");
      assert.equal(details.nilaiFashahah, "JAYYID");
      assert.equal(details.nilaiKelancaran, "JAYYID_JIDDAN");
      assert.equal(details.nilai, "JAYYID");
    });

    it("kompatibilitas baris legacy: null quality tetap dapat dibaca tanpa fabrikasi", async () => {
      // Insert baris legacy buatan (dimensi null)
      const legacy = await prisma.setoranTahfizh.create({
        data: {
          setoranCode: "STR-LEGACY-01",
          santriId: SANTRI_3_ID,
          musyrifId: STAFF_MT_1_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilai: "MUMTAZ",
          nilaiTajwid: null,
          nilaiFashahah: null,
          nilaiKelancaran: null,
          rincianKesalahan: undefined,
          status: "AKTIF",
        },
      });

      assert.equal(legacy.nilaiTajwid, null);
      assert.equal(legacy.nilaiFashahah, null);
      assert.equal(legacy.nilaiKelancaran, null);
      assert.equal(legacy.nilai, "MUMTAZ");

      // Verifikasi santri-list-service membaca baris legacy tanpa memalsukan dimensi
      setTestSession(sessionMT1);
      const listRes = await getSantriListForSession({ search: "Choirul" }, sessionMT1, prisma);
      assert.equal(listRes.success, true);
      const santri3 = listRes.data.find((s) => s.id === SANTRI_3_ID);
      assert.ok(santri3);
      assert.equal(santri3.hasStructuredQuality, false);
      assert.equal(santri3.nilaiTajwidTerakhir, null);
    });

    it("saveSetoranTahfizhCore: menolak setoran baru tanpa 3 dimensi terstruktur (fallback legacy dilarang keras)", async () => {
      const res = await saveSetoranTahfizhCore(prisma, {
        input: {
          santriId: SANTRI_1_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilai: "MUMTAZ",
        } as unknown as Parameters<typeof saveSetoranTahfizhCore>[1]["input"],
        context: {
          userId: sessionMT1.userId,
          username: sessionMT1.username,
          musyrifStaffId: STAFF_MT_1_ID,
        },
      });
      assert.equal(res.success, false);
      assert.match(res.message, /Nilai Tajwid wajib diisi/);
    });

    it("saveSetoranTahfizhCore: menolak setoran dengan rincianKesalahan absen atau tidak lengkap 8 dimensi", async () => {
      const res = await saveSetoranTahfizhCore(prisma, {
        input: {
          santriId: SANTRI_1_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilaiTajwid: "MUMTAZ",
          nilaiFashahah: "MUMTAZ",
          nilaiKelancaran: "MUMTAZ",
        } as unknown as Parameters<typeof saveSetoranTahfizhCore>[1]["input"],
        context: {
          userId: sessionMT1.userId,
          username: sessionMT1.username,
          musyrifStaffId: STAFF_MT_1_ID,
        },
      });
      assert.equal(res.success, false);
      assert.match(res.message, /Rincian kesalahan.*wajib disertakan lengkap/);
    });

    it("POST /api/v1/setoran: menolak legacy-only nilai (400) dan menerima structured quality dengan override overall", async () => {
      const tokenMT = await createSessionToken({
        sub: sessionMT1.userId,
        username: sessionMT1.username,
        role: sessionMT1.role,
        staffId: sessionMT1.staffId,
      });

      // 1. Legacy-only nilai -> 400
      const reqLegacy = new Request("http://localhost:3000/api/v1/setoran", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenMT}`,
        },
        body: JSON.stringify({
          santriId: SANTRI_1_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilai: "MUMTAZ",
        }),
      });
      const resLegacy = await postSetoranApi(reqLegacy);
      assert.equal(resLegacy.status, 400);
      const jsonLegacy = await resLegacy.json();
      assert.equal(jsonLegacy.success, false);
      assert.equal(jsonLegacy.error.code, "VALIDATION_ERROR");

      // 2. Structured quality with incorrect client overall nilai -> succeeds 201 and derives worst dimension
      const reqValid = new Request("http://localhost:3000/api/v1/setoran", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenMT}`,
        },
        body: JSON.stringify({
          santriId: SANTRI_1_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 2,
          halamanSelesai: 2,
          jumlahHalaman: 1,
          nilaiTajwid: "MUMTAZ",
          nilaiFashahah: "JAYYID",
          nilaiKelancaran: "DHOIF",
          rincianKesalahan: DEFAULT_MISTAKE_COUNTS,
          nilai: "MUMTAZ", // Client sends MUMTAZ, server must override with DHOIF
        }),
      });
      const resValid = await postSetoranApi(reqValid);
      assert.equal(resValid.status, 201);
      const jsonValid = await resValid.json();
      assert.equal(jsonValid.success, true);
      assert.equal(jsonValid.data.nilai, "DHOIF");
      assert.equal(jsonValid.data.nilaiTajwid, "MUMTAZ");
      assert.equal(jsonValid.data.nilaiFashahah, "JAYYID");
      assert.equal(jsonValid.data.nilaiKelancaran, "DHOIF");
    });

    it("GET /api/v1/setoran: respon untuk WS dan ST tidak mengekspos dimensi kualitas internal atau evaluator", async () => {
      const tokenWS = await createSessionToken({
        sub: sessionWali.userId,
        username: sessionWali.username,
        role: "WS",
        santriId: SANTRI_1_ID,
      });

      const reqWS = new Request(`http://localhost:3000/api/v1/setoran?santri_id=${SANTRI_1_ID}`, {
        headers: {
          Authorization: `Bearer ${tokenWS}`,
        },
      });

      const resWS = await getSetoranApi(reqWS);
      assert.equal(resWS.status, 200);
      const jsonWS = await resWS.json();
      assert.equal(jsonWS.success, true);
      assert.ok(jsonWS.data.length > 0);

      for (const item of jsonWS.data) {
        assert.equal("nilaiTajwid" in item, false, "nilaiTajwid harus absent dari output WS");
        assert.equal("nilaiFashahah" in item, false, "nilaiFashahah harus absent dari output WS");
        assert.equal("nilaiKelancaran" in item, false, "nilaiKelancaran harus absent dari output WS");
        assert.equal("rincianKesalahan" in item, false, "rincianKesalahan harus absent dari output WS");
        assert.equal("qualityTrend" in item, false, "qualityTrend harus absent dari output WS");
        assert.equal("musyrif" in item, false, "detail musyrif evaluator harus absent dari output WS");
      }

      // Pastikan terdapat data setoran untuk santri 2
      await saveSetoranTahfizhCore(prisma, {
        input: {
          santriId: SANTRI_2_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilaiTajwid: "MUMTAZ",
          nilaiFashahah: "MUMTAZ",
          nilaiKelancaran: "MUMTAZ",
          rincianKesalahan: DEFAULT_MISTAKE_COUNTS,
        },
        context: {
          userId: sessionMT2.userId,
          username: sessionMT2.username,
          musyrifStaffId: STAFF_MT_2_ID,
        },
      });

      const tokenST = await createSessionToken({
        sub: sessionSantri.userId,
        username: sessionSantri.username,
        role: "ST",
        santriId: SANTRI_2_ID,
      });

      const reqST = new Request(`http://localhost:3000/api/v1/setoran?santri_id=${SANTRI_2_ID}`, {
        headers: {
          Authorization: `Bearer ${tokenST}`,
        },
      });

      const resST = await getSetoranApi(reqST);
      assert.equal(resST.status, 200);
      const jsonST = await resST.json();
      assert.equal(jsonST.success, true);
      assert.ok(jsonST.data.length > 0);

      for (const item of jsonST.data) {
        assert.equal("nilaiTajwid" in item, false, "nilaiTajwid harus absent dari output ST");
        assert.equal("nilaiFashahah" in item, false, "nilaiFashahah harus absent dari output ST");
        assert.equal("nilaiKelancaran" in item, false, "nilaiKelancaran harus absent dari output ST");
        assert.equal("rincianKesalahan" in item, false, "rincianKesalahan harus absent dari output ST");
        assert.equal("qualityTrend" in item, false, "qualityTrend harus absent dari output ST");
        assert.equal("musyrif" in item, false, "detail musyrif evaluator harus absent dari output ST");
      }
    });

    it("getSantriListForSession: payload WS dan ST tidak mengekspos properti kualitas (absent, bukan null)", async () => {
      setTestSession(sessionWali);
      const resWali = await getSantriListForSession({}, sessionWali, prisma);
      assert.equal(resWali.success, true);
      assert.ok(resWali.data.length > 0);

      for (const santri of resWali.data) {
        assert.equal("hasStructuredQuality" in santri, false, "hasStructuredQuality harus absent dari output WS");
        assert.equal("nilaiTajwidTerakhir" in santri, false, "nilaiTajwidTerakhir harus absent dari output WS");
        assert.equal("nilaiFashahahTerakhir" in santri, false, "nilaiFashahahTerakhir harus absent dari output WS");
        assert.equal("nilaiKelancaranTerakhir" in santri, false, "nilaiKelancaranTerakhir harus absent dari output WS");
        assert.equal("qualityTrend" in santri, false, "qualityTrend harus absent dari output WS");
        assert.equal("rincianKesalahan" in santri, false, "rincianKesalahan harus absent dari output WS");
      }

      setTestSession(sessionSantri);
      const resSantri = await getSantriListForSession({}, sessionSantri, prisma);
      assert.equal(resSantri.success, true);
      assert.ok(resSantri.data.length > 0);

      for (const santri of resSantri.data) {
        assert.equal("hasStructuredQuality" in santri, false, "hasStructuredQuality harus absent dari output ST");
        assert.equal("nilaiTajwidTerakhir" in santri, false, "nilaiTajwidTerakhir harus absent dari output ST");
        assert.equal("nilaiFashahahTerakhir" in santri, false, "nilaiFashahahTerakhir harus absent dari output ST");
        assert.equal("nilaiKelancaranTerakhir" in santri, false, "nilaiKelancaranTerakhir harus absent dari output ST");
        assert.equal("qualityTrend" in santri, false, "qualityTrend harus absent dari output ST");
        assert.equal("rincianKesalahan" in santri, false, "rincianKesalahan harus absent dari output ST");
      }
    });
  });

  // -------------------------------------------------------------
  // 4. QUALITY TREND & CANCELLATION EXCLUSION
  // -------------------------------------------------------------
  describe("4. Quality Trend & Exclusion of Cancelled Records", () => {
    it("menghitung arah tren kualitas secara kategorikal: MEMBAIK, STABIL, MENURUN, BELUM_CUKUP_DATA", () => {
      assert.equal(compareQualityDimension("JAYYID", "MUMTAZ"), "MEMBAIK");
      assert.equal(compareQualityDimension("MUMTAZ", "JAYYID"), "MENURUN");
      assert.equal(compareQualityDimension("JAYYID", "JAYYID"), "STABIL");
      assert.equal(compareQualityDimension(null, "MUMTAZ"), "BELUM_CUKUP_DATA");
      assert.equal(compareQualityDimension("MUMTAZ", null), "BELUM_CUKUP_DATA");

      const trend = calculateQualityTrend(
        { tajwid: "JAYYID", fashahah: "MUMTAZ", kelancaran: "DHOIF", overall: "DHOIF" },
        { tajwid: "MUMTAZ", fashahah: "MUMTAZ", kelancaran: "JAYYID", overall: "JAYYID" }
      );
      assert.equal(trend.tajwid, "MEMBAIK");
      assert.equal(trend.fashahah, "STABIL");
      assert.equal(trend.kelancaran, "MEMBAIK");
      assert.equal(trend.overall, "MEMBAIK");
    });

    it("mengabaikan setoran berstatus DIBATALKAN dari tren kualitas", async () => {
      setTestSession(sessionMT1);

      // Tambahkan setoran kedua untuk SANTRI_1 (DHOIF)
      await saveSetoranTahfizhCore(prisma, {
        input: {
          santriId: SANTRI_1_ID,
          jenis: "SABQI",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilaiTajwid: "DHOIF",
          nilaiFashahah: "DHOIF",
          nilaiKelancaran: "DHOIF",
          rincianKesalahan: DEFAULT_MISTAKE_COUNTS,
        },
        context: {
          userId: sessionMT1.userId,
          username: sessionMT1.username,
          musyrifStaffId: STAFF_MT_1_ID,
        },
      });

      // Tambahkan setoran ketiga tetapi DIBATALKAN (MUMTAZ palsu)
      await prisma.setoranTahfizh.create({
        data: {
          setoranCode: "STR-CANCELLED-01",
          santriId: SANTRI_1_ID,
          musyrifId: STAFF_MT_1_ID,
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 2,
          halamanSelesai: 2,
          jumlahHalaman: 1,
          nilai: "MUMTAZ",
          nilaiTajwid: "MUMTAZ",
          nilaiFashahah: "MUMTAZ",
          nilaiKelancaran: "MUMTAZ",
          status: "DIBATALKAN",
        },
      });

      const listRes = await getSantriListForSession({ search: "Ahmad" }, sessionMT1, prisma);
      assert.equal(listRes.success, true);
      const santri1 = listRes.data.find((s) => s.id === SANTRI_1_ID);
      assert.ok(santri1);

      // Setoran terakhir yang valid adalah setoran kedua (DHOIF), BUKAN yang DIBATALKAN (MUMTAZ)
      assert.equal(santri1.nilaiTajwidTerakhir, "DHOIF");
      assert.equal(santri1.qualityTrend?.tajwid, "MENURUN"); // dari MUMTAZ (setoran 1) ke DHOIF (setoran 2)
    });
  });

  // -------------------------------------------------------------
  // 5. RUBU' FORMAL EVALUATION & ABAC
  // -------------------------------------------------------------
  describe("5. Evaluasi Rubu' Formal Milestone & ABAC Scoping", () => {
    it("validasi input: juz 1-30, rubuKe 1-4, predikat resmi", async () => {
      setTestSession(sessionMT1);

      // Juz di luar 1-30 ditolak
      const invalidJuz = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 35,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(invalidJuz.success, false);

      // RubuKe di luar 1-4 ditolak
      const invalidRubu = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 1,
        rubuKe: 5,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(invalidRubu.success, false);
    });

    it("mengizinkan ordinary MT mencatat evaluasi Rubu' untuk santri halaqoh binaan", async () => {
      setTestSession(sessionMT1);

      const res = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "JAYYID_JIDDAN",
        nilaiKelancaran: "JAYYID",
        rincianKesalahan: { ...DEFAULT_MISTAKE_COUNTS, mad: 1 },
        catatan: "Rubu pertama juz 1 selesai",
      });

      assert.equal(res.success, true);
      assert.equal(res.data?.nilai, "JAYYID"); // derived from lowest (kelancaran = JAYYID)
    });

    it("mengizinkan multiple attempts (pengulangan evaluasi tanpa blokir unik)", async () => {
      setTestSession(sessionMT1);

      // Attempt kedua untuk juz & rubu yang sama (santri mengulang)
      const res2 = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
        catatan: "Ujian perbaikan rubu 1 tuntas lancar",
      });

      assert.equal(res2.success, true);
      assert.equal(res2.data?.nilai, "MUMTAZ");

      // Cek bahwa kedua catatan tersimpan
      const allRubu = await prisma.evaluasiRubuTahfizh.findMany({
        where: { santriId: SANTRI_1_ID, juz: 1, rubuKe: 1 },
      });
      assert.equal(allRubu.length, 2);
    });

    it("ABAC: menolak MT mencatat evaluasi untuk santri di luar halaqoh binaannya (cross-halaqoh deny)", async () => {
      setTestSession(sessionMT1); // MT1 membina Halaqoh 1 (SANTRI_1 & SANTRI_3), SANTRI_2 di Halaqoh 2

      const res = await createEvaluasiRubuAction({
        santriId: SANTRI_2_ID, // SANTRI_2 milik Halaqoh 2
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });

      assert.equal(res.success, false);
      assert.match(res.message, /Akses Ditolak/);
    });

    it("ABAC: mengizinkan Kabid Tahfizh mencatat evaluasi lintas halaqoh", async () => {
      setTestSession(sessionKabid);

      const res = await createEvaluasiRubuAction({
        santriId: SANTRI_2_ID,
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "JAYYID",
        nilaiFashahah: "JAYYID",
        nilaiKelancaran: "JAYYID",
      });

      assert.equal(res.success, true);
    });

    it("ABAC: menolak Wali Santri dan Santri mengakses evaluasi internal Rubu' (fail-closed)", async () => {
      setTestSession(sessionWali);
      const resWali = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resWali.success, false);
      assert.match(resWali.message, /Akses Ditolak/);

      const listWali = await getEvaluasiRubuListAction();
      assert.equal(listWali.success, false);

      setTestSession(sessionSantri);
      const resSantri = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 1,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resSantri.success, false);
    });

    it("Rubu ABAC: pengujian otoritas menyeluruh untuk seluruh role diizinkan dan ditolak (canonical minimum)", async () => {
      // ALLOWED:
      // 1. Assigned MT (sessionMT1 on SANTRI_1_ID)
      setTestSession(sessionMT1);
      const resMT = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resMT.success, true);

      // 2. Kabid Tahfidz (isKepalaBidangTahfidz = true)
      setTestSession(sessionKabid);
      const resKabid = await createEvaluasiRubuAction({
        santriId: SANTRI_2_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resKabid.success, true);

      // 3. Mudir (KS)
      setTestSession(sessionMudir);
      const resMudir = await createEvaluasiRubuAction({
        santriId: SANTRI_2_ID,
        juz: 2,
        rubuKe: 2,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resMudir.success, true);

      // DENIED:
      // 1. Unassigned MT (sessionMT1 on SANTRI_2_ID)
      setTestSession(sessionMT1);
      const resUnassigned = await createEvaluasiRubuAction({
        santriId: SANTRI_2_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resUnassigned.success, false);
      assert.match(resUnassigned.message, /Akses Ditolak/);

      // 2. Missing staff (sessionMTNoStaff) -> fail-closed
      setTestSession(sessionMTNoStaff);
      const resNoStaff = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resNoStaff.success, false);
      assert.match(resNoStaff.message, /Akses Ditolak/);

      // 3. PH
      setTestSession(sessionPH);
      const resPH = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resPH.success, false);
      assert.match(resPH.message, /Akses Ditolak/);

      // 4. ADM
      setTestSession(sessionADM);
      const resADM = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resADM.success, false);
      assert.match(resADM.message, /Akses Ditolak/);

      // 5. YAY
      setTestSession(sessionYAY);
      const resYAY = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resYAY.success, false);
      assert.match(resYAY.message, /Akses Ditolak/);

      // 6. WS
      setTestSession(sessionWali);
      const resWS = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resWS.success, false);
      assert.match(resWS.message, /Akses Ditolak/);

      // 7. ST
      setTestSession(sessionSantri);
      const resST = await createEvaluasiRubuAction({
        santriId: SANTRI_1_ID,
        juz: 2,
        rubuKe: 1,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });
      assert.equal(resST.success, false);
      assert.match(resST.message, /Akses Ditolak/);

      // Also assert getEvaluasiRubuListAction denies WS, ST, PH, ADM, YAY
      for (const deniedSession of [sessionPH, sessionADM, sessionYAY, sessionWali, sessionSantri]) {
        setTestSession(deniedSession);
        const listRes = await getEvaluasiRubuListAction({});
        assert.equal(listRes.success, false);
        assert.match(listRes.message || "", /Akses Ditolak/);
      }
    });
  });

  // -------------------------------------------------------------
  // 6. TASMI' / SIMA'AN STRUCTURED EXTENSION
  // -------------------------------------------------------------
  describe("6. Tasmi' / Sima'an Structured Quality Extension", () => {
    it("menyimpan dimensi terstruktur tanpa mengubah skor angka 0-100 dan predikat", async () => {
      setTestSession(sessionMT1);

      const res = await recordTasmiSimaanAction({
        santriId: SANTRI_1_ID,
        jenis: JenisUjiHafalan.TASMI,
        juz: 1,
        nilai: 92,
        predikat: "MUMTAZ",
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "JAYYID_JIDDAN",
        nilaiKelancaran: "MUMTAZ",
        rincianKesalahan: { ...DEFAULT_MISTAKE_COUNTS, mad: 2 },
        catatan: "Ujian tasmi 1 juz tuntas",
      });

      assert.equal(res.success, true);

      const saved = await prisma.tasmiSimaan.findFirst({
        where: { santriId: SANTRI_1_ID, jenis: "TASMI" },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(saved);
      assert.equal(saved.nilai, 92); // Nilai angka 0-100 tetap utuh
      assert.equal(saved.predikat, "MUMTAZ"); // Predikat resmi tetap utuh
      assert.equal(saved.nilaiTajwid, "MUMTAZ");
      assert.equal(saved.nilaiFashahah, "JAYYID_JIDDAN");
      assert.equal(saved.nilaiKelancaran, "MUMTAZ");
      assert.ok(saved.rincianKesalahan);
    });

    it("menolak pencatatan Tasmi/Sima'an baru jika dimensi kualitas terstruktur tidak lengkap", async () => {
      setTestSession(sessionMT1);

      const res = await recordTasmiSimaanAction({
        santriId: SANTRI_1_ID,
        jenis: JenisUjiHafalan.TASMI,
        juz: 1,
        nilai: 92,
        predikat: "MUMTAZ",
        nilaiTajwid: "" as unknown as NilaiSetoran,
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
      });

      assert.equal(res.success, false);
      assert.match(res.message, /Ketiga dimensi kualitas.*wajib diisi lengkap/);
    });
  });

  // -------------------------------------------------------------
  // 7. IKHTIBAR STAGE QUALITY EXTENSION
  // -------------------------------------------------------------
  describe("7. Ikhtibar Stage 1 & Stage 2 Quality Extension", () => {
    it("menyimpan dimensi terstruktur Tahap 1 dan Tahap 2 tanpa mengubah ambang kelulusan", async () => {
      // 1. Buat permohonan ikhtibar
      const ikhtibar = await prisma.ikhtibarTahfizh.create({
        data: {
          santriId: SANTRI_1_ID,
          juz: 2,
          status: StatusIkhtibar.PENGAJUAN,
        },
      });

      // 2. Input Tahap 1 oleh MT1
      setTestSession(sessionMT1);
      const resTahap1 = await inputHasilTahap1Action({
        ikhtibarId: ikhtibar.id,
        nilai: 85,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "JAYYID_JIDDAN",
        nilaiKelancaran: "JAYYID_JIDDAN",
        rincianKesalahan: DEFAULT_MISTAKE_COUNTS,
        lulus: true,
      });

      assert.equal(resTahap1.success, true);

      const afterTahap1 = await prisma.ikhtibarTahfizh.findUnique({ where: { id: ikhtibar.id } });
      assert.ok(afterTahap1);
      assert.equal(afterTahap1.status, StatusIkhtibar.LULUS_TAHAP_1);
      assert.equal(afterTahap1.nilaiTahap1, 85);
      assert.equal(afterTahap1.nilaiTajwidTahap1, "MUMTAZ");
      assert.equal(afterTahap1.nilaiFashahahTahap1, "JAYYID_JIDDAN");
      assert.equal(afterTahap1.nilaiKelancaranTahap1, "JAYYID_JIDDAN");

      // 3. Input Tahap 2 oleh Mudir (KS)
      setTestSession(sessionMudir);
      const resTahap2 = await inputHasilTahap2Action({
        ikhtibarId: ikhtibar.id,
        nilai: 90,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
        rincianKesalahan: DEFAULT_MISTAKE_COUNTS,
        lulus: true,
        hasilTahap2: "LULUS",
      });

      assert.equal(resTahap2.success, true);

      const afterTahap2 = await prisma.ikhtibarTahfizh.findUnique({ where: { id: ikhtibar.id } });
      assert.ok(afterTahap2);
      assert.equal(afterTahap2.status, StatusIkhtibar.LULUS_SEMPURNA_TAHAP_2);
      assert.equal(afterTahap2.nilaiTahap2, 90);
      assert.equal(afterTahap2.nilaiTajwidTahap2, "MUMTAZ");
      assert.equal(afterTahap2.nilaiFashahahTahap2, "MUMTAZ");
      assert.equal(afterTahap2.nilaiKelancaranTahap2, "MUMTAZ");
    });

    it("menolak input hasil Tahap 1 atau Tahap 2 jika dimensi kualitas tidak lengkap", async () => {
      const ikhtibar = await prisma.ikhtibarTahfizh.create({
        data: {
          santriId: SANTRI_1_ID,
          juz: 4,
          status: StatusIkhtibar.PENGAJUAN,
        },
      });

      setTestSession(sessionMT1);
      const resT1 = await inputHasilTahap1Action({
        ikhtibarId: ikhtibar.id,
        nilai: 85,
        nilaiTajwid: "" as unknown as NilaiSetoran,
        nilaiFashahah: "MUMTAZ",
        nilaiKelancaran: "MUMTAZ",
        lulus: true,
      });
      assert.equal(resT1.success, false);
      assert.match(resT1.message, /Ketiga dimensi kualitas.*wajib diisi lengkap/);

      await prisma.ikhtibarTahfizh.update({
        where: { id: ikhtibar.id },
        data: {
          status: StatusIkhtibar.LULUS_TAHAP_1,
          nilaiTahap1: 85,
          nilaiTajwidTahap1: "MUMTAZ",
          nilaiFashahahTahap1: "MUMTAZ",
          nilaiKelancaranTahap1: "MUMTAZ",
        },
      });

      setTestSession(sessionMudir);
      const resT2 = await inputHasilTahap2Action({
        ikhtibarId: ikhtibar.id,
        nilai: 85,
        nilaiTajwid: "MUMTAZ",
        nilaiFashahah: "" as unknown as NilaiSetoran,
        nilaiKelancaran: "MUMTAZ",
        lulus: true,
      });
      assert.equal(resT2.success, false);
      assert.match(resT2.message, /Ketiga dimensi kualitas.*wajib diisi lengkap/);
    });
  });

  // -------------------------------------------------------------
  // 8. QUANTITY VS QUALITY SEPARATION
  // -------------------------------------------------------------
  describe("8. Strict Separation Between Quantity and Quality", () => {
    it("tidak mencampuradukkan metrik kuantitas PR #7 dengan predikat kualitas PR #8", async () => {
      setTestSession(sessionMT1);
      const listRes = await getSantriListForSession({ search: "Ahmad" }, sessionMT1, prisma);
      assert.equal(listRes.success, true);
      const santri = listRes.data[0];
      assert.ok(santri);

      // Kuantitas PR #7 tetap murni bilangan halaman/juz
      assert.equal(typeof santri.tambahanSabaq, "number");
      assert.equal(typeof santri.completedJuzCanonical, "number");
      assert.equal(typeof santri.weeklySabaqProgress.percentage, "number");

      // Kualitas PR #8 murni kategorikal
      assert.equal(typeof santri.hasStructuredQuality, "boolean");
      assert.ok(santri.qualityTrend);
      assert.equal(typeof santri.qualityTrend.overall, "string");
      assert.ok(
        ["MEMBAIK", "STABIL", "MENURUN", "BELUM_CUKUP_DATA"].includes(santri.qualityTrend.overall)
      );

      // Tidak ada properti komposit 70/30 atau synthetic quality score
      const santriRecord = (santri as unknown) as Record<string, unknown>;
      assert.equal(santriRecord.compositeKpi, undefined);
      assert.equal(santriRecord.qualityScore, undefined);
      assert.equal(santriRecord.skorKualitas, undefined);
    });
  });

  // -------------------------------------------------------------
  // 9. PR #8 MIGRATION CHAIN VERIFICATION (POSTGRESQL ISOLATED)
  // -------------------------------------------------------------
  describe("9. PR #8 Migration Chain Verification on Isolated PostgreSQL", () => {
    it("memverifikasi seluruh 6 migrasi applied (0 failed, status up to date) dan skema PR #8 terisolasi", { timeout: 90000 }, async () => {
      const res = await runIsolatedMigrationChainVerification();

      assert.ok(res.migrationCount >= 6, `Setidaknya terdapat 6 migrasi repositori, ditemukan: ${res.migrationCount}`);
      assert.equal(res.migrationsApplied, res.migrationCount, "Seluruh 6 migrasi harus berstatus applied");
      assert.equal(res.failedCount, 0, "0 migrasi gagal");
      assert.equal(res.isUpToDate, true, "Status migrasi harus up to date");

      const p8 = res.pr8Schema;
      assert.ok(p8, "pr8Schema harus ada dalam hasil verifikasi migrasi");

      // 1. setoran_tahfizh
      const setoranCols = p8.setoranTahfizhCols;
      const setoranTajwid = setoranCols.find((c) => c.column_name === "nilai_tajwid");
      const setoranFashahah = setoranCols.find((c) => c.column_name === "nilai_fashahah");
      const setoranKelancaran = setoranCols.find((c) => c.column_name === "nilai_kelancaran");
      const setoranKesalahan = setoranCols.find((c) => c.column_name === "rincian_kesalahan");

      assert.ok(setoranTajwid && setoranTajwid.udt_name === "NilaiSetoran" && setoranTajwid.is_nullable === "YES", "setoran.nilai_tajwid harus enum nullable");
      assert.ok(setoranFashahah && setoranFashahah.udt_name === "NilaiSetoran" && setoranFashahah.is_nullable === "YES", "setoran.nilai_fashahah harus enum nullable");
      assert.ok(setoranKelancaran && setoranKelancaran.udt_name === "NilaiSetoran" && setoranKelancaran.is_nullable === "YES", "setoran.nilai_kelancaran harus enum nullable");
      assert.ok(setoranKesalahan && setoranKesalahan.data_type === "jsonb" && setoranKesalahan.is_nullable === "YES", "setoran.rincian_kesalahan harus jsonb nullable");

      // 2. tasmi_simaan
      const tasmiCols = p8.tasmiSimaanCols;
      const tasmiTajwid = tasmiCols.find((c) => c.column_name === "nilai_tajwid");
      const tasmiFashahah = tasmiCols.find((c) => c.column_name === "nilai_fashahah");
      const tasmiKelancaran = tasmiCols.find((c) => c.column_name === "nilai_kelancaran");
      const tasmiKesalahan = tasmiCols.find((c) => c.column_name === "rincian_kesalahan");

      assert.ok(tasmiTajwid && tasmiTajwid.udt_name === "NilaiSetoran" && tasmiTajwid.is_nullable === "YES", "tasmi.nilai_tajwid harus enum nullable");
      assert.ok(tasmiFashahah && tasmiFashahah.udt_name === "NilaiSetoran" && tasmiFashahah.is_nullable === "YES", "tasmi.nilai_fashahah harus enum nullable");
      assert.ok(tasmiKelancaran && tasmiKelancaran.udt_name === "NilaiSetoran" && tasmiKelancaran.is_nullable === "YES", "tasmi.nilai_kelancaran harus enum nullable");
      assert.ok(tasmiKesalahan && tasmiKesalahan.data_type === "jsonb" && tasmiKesalahan.is_nullable === "YES", "tasmi.rincian_kesalahan harus jsonb nullable");

      // 3. ikhtibar_tahfizh (stage 1 & stage 2)
      const ikhtibarCols = p8.ikhtibarTahfizhCols;
      const st1Tajwid = ikhtibarCols.find((c) => c.column_name === "nilai_tajwid_tahap_1");
      const st1Fashahah = ikhtibarCols.find((c) => c.column_name === "nilai_fashahah_tahap_1");
      const st1Kelancaran = ikhtibarCols.find((c) => c.column_name === "nilai_kelancaran_tahap_1");
      const st1Kesalahan = ikhtibarCols.find((c) => c.column_name === "rincian_kesalahan_tahap_1");

      const st2Tajwid = ikhtibarCols.find((c) => c.column_name === "nilai_tajwid_tahap_2");
      const st2Fashahah = ikhtibarCols.find((c) => c.column_name === "nilai_fashahah_tahap_2");
      const st2Kelancaran = ikhtibarCols.find((c) => c.column_name === "nilai_kelancaran_tahap_2");
      const st2Kesalahan = ikhtibarCols.find((c) => c.column_name === "rincian_kesalahan_tahap_2");

      assert.ok(st1Tajwid && st1Tajwid.udt_name === "NilaiSetoran" && st1Tajwid.is_nullable === "YES", "ikhtibar.st1Tajwid harus enum nullable");
      assert.ok(st1Fashahah && st1Fashahah.udt_name === "NilaiSetoran" && st1Fashahah.is_nullable === "YES", "ikhtibar.st1Fashahah harus enum nullable");
      assert.ok(st1Kelancaran && st1Kelancaran.udt_name === "NilaiSetoran" && st1Kelancaran.is_nullable === "YES", "ikhtibar.st1Kelancaran harus enum nullable");
      assert.ok(st1Kesalahan && st1Kesalahan.data_type === "jsonb" && st1Kesalahan.is_nullable === "YES", "ikhtibar.st1Kesalahan harus jsonb nullable");

      assert.ok(st2Tajwid && st2Tajwid.udt_name === "NilaiSetoran" && st2Tajwid.is_nullable === "YES", "ikhtibar.st2Tajwid harus enum nullable");
      assert.ok(st2Fashahah && st2Fashahah.udt_name === "NilaiSetoran" && st2Fashahah.is_nullable === "YES", "ikhtibar.st2Fashahah harus enum nullable");
      assert.ok(st2Kelancaran && st2Kelancaran.udt_name === "NilaiSetoran" && st2Kelancaran.is_nullable === "YES", "ikhtibar.st2Kelancaran harus enum nullable");
      assert.ok(st2Kesalahan && st2Kesalahan.data_type === "jsonb" && st2Kesalahan.is_nullable === "YES", "ikhtibar.st2Kesalahan harus jsonb nullable");

      // 4. evaluasi_rubu_tahfizh
      const rubuCols = p8.evaluasiRubuCols;
      assert.ok(rubuCols.length > 0, "Tabel evaluasi_rubu_tahfizh harus ada");

      const rubuTajwid = rubuCols.find((c) => c.column_name === "nilai_tajwid");
      const rubuFashahah = rubuCols.find((c) => c.column_name === "nilai_fashahah");
      const rubuKelancaran = rubuCols.find((c) => c.column_name === "nilai_kelancaran");
      const rubuNilai = rubuCols.find((c) => c.column_name === "nilai");
      const rubuJuz = rubuCols.find((c) => c.column_name === "juz");
      const rubuKe = rubuCols.find((c) => c.column_name === "rubu_ke");

      assert.equal(rubuTajwid?.is_nullable, "NO", "nilai_tajwid pada evaluasi rubu wajib NOT NULL");
      assert.equal(rubuFashahah?.is_nullable, "NO", "nilai_fashahah pada evaluasi rubu wajib NOT NULL");
      assert.equal(rubuKelancaran?.is_nullable, "NO", "nilai_kelancaran pada evaluasi rubu wajib NOT NULL");
      assert.equal(rubuNilai?.is_nullable, "NO", "nilai pada evaluasi rubu wajib NOT NULL");
      assert.equal(rubuJuz?.data_type, "integer", "juz pada evaluasi rubu harus integer");
      assert.equal(rubuKe?.data_type, "integer", "rubu_ke pada evaluasi rubu harus integer");

      // Constraints: PK, FK santri, FK musyrif
      const constraints = p8.evaluasiRubuConstraints;
      const pk = constraints.find((c) => c.constraint_type === "PRIMARY KEY");
      const fkSantri = constraints.find((c) => c.constraint_name.includes("santri_id"));
      const fkMusyrif = constraints.find((c) => c.constraint_name.includes("musyrif_id"));

      assert.ok(pk, "Primary Key evaluasi_rubu_tahfizh harus ada");
      assert.ok(fkSantri, "Foreign Key santri_id evaluasi_rubu_tahfizh harus ada");
      assert.ok(fkMusyrif, "Foreign Key musyrif_id evaluasi_rubu_tahfizh harus ada");

      // 5. Legacy rows compatibility
      assert.equal(p8.legacyRowsNoBackfillRequired, true, "Baris legacy dapat dibaca dan dibuat tanpa backfill");
    });
  });
});
