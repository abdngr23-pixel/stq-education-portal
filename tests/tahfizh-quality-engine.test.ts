(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, StatusIkhtibar, JenisUjiHafalan } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
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

describe("PR #8 — Tahfizh Quality & Evaluation Engine (Comprehensive Test Suite)", () => {
  let prisma: PrismaClient;

  // Master Test Entities
  const STAFF_MT_1_ID = "stf-q-mt-01";
  const STAFF_MT_2_ID = "stf-q-mt-02";
  const STAFF_KABID_ID = "stf-q-kabid";
  const STAFF_MUDIR_ID = "stf-q-mudir";

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
    santriId: SANTRI_1_ID,
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
    await prisma.santri.deleteMany();
    await prisma.halaqoh.deleteMany();
    await prisma.user.deleteMany();
    await prisma.staff.deleteMany();

    // Create staff
    await prisma.staff.createMany({
      data: [
        { id: STAFF_MT_1_ID, staffCode: "STF-Q01", nama: "Ust. Musyrif Q1", roleStaff: "MT", status: "AKTIF", noHp: "08111111111" },
        { id: STAFF_MT_2_ID, staffCode: "STF-Q02", nama: "Ust. Musyrif Q2", roleStaff: "MT", status: "AKTIF", noHp: "08222222222" },
        { id: STAFF_KABID_ID, staffCode: "STF-QK", nama: "Ust. Kabid Q", roleStaff: "MT", isKepalaBidangTahfidz: true, status: "AKTIF", noHp: "08333333333" },
        { id: STAFF_MUDIR_ID, staffCode: "STF-QM", nama: "Kyai Mudir Q", roleStaff: "KS", status: "AKTIF", noHp: "08444444444" },
      ],
    });

    // Create users
    await prisma.user.createMany({
      data: [
        { id: sessionMT1.userId, username: sessionMT1.username, passwordHash: "dummy", role: "MT", staffId: STAFF_MT_1_ID },
        { id: sessionMT2.userId, username: sessionMT2.username, passwordHash: "dummy", role: "MT", staffId: STAFF_MT_2_ID },
        { id: sessionKabid.userId, username: sessionKabid.username, passwordHash: "dummy", role: "MT", staffId: STAFF_KABID_ID },
        { id: sessionMudir.userId, username: sessionMudir.username, passwordHash: "dummy", role: "KS", staffId: STAFF_MUDIR_ID },
        { id: sessionWali.userId, username: sessionWali.username, passwordHash: "dummy", role: "WS" },
        { id: sessionSantri.userId, username: sessionSantri.username, passwordHash: "dummy", role: "ST" },
      ],
    });

    // Create halaqoh
    await prisma.halaqoh.createMany({
      data: [
        { id: HALAQOH_1_ID, halaqohCode: "HLQ-Q01", nama: "Halaqoh Utsman (MT1)", pembinaId: STAFF_MT_1_ID, tahunAjaran: "2026/2027", status: "AKTIF" },
        { id: HALAQOH_2_ID, halaqohCode: "HLQ-Q02", nama: "Halaqoh Ali (MT2)", pembinaId: STAFF_MT_2_ID, tahunAjaran: "2026/2027", status: "AKTIF" },
      ],
    });

    // Create santri
    await prisma.santri.createMany({
      data: [
        { id: SANTRI_1_ID, nis: "SAN-Q01", nama: "Ahmad Santri Q1", kelas: "7A", jenisKelamin: "L", halaqohId: HALAQOH_1_ID, status: "AKTIF" },
        { id: SANTRI_2_ID, nis: "SAN-Q02", nama: "Bilal Santri Q2", kelas: "7A", jenisKelamin: "L", halaqohId: HALAQOH_2_ID, status: "AKTIF" },
        { id: SANTRI_3_ID, nis: "SAN-Q03", nama: "Choirul Santri Q3", kelas: "7B", jenisKelamin: "L", halaqohId: HALAQOH_1_ID, status: "AKTIF" },
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
});
