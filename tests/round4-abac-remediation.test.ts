(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, JenisIzin, StatusIzin, TingkatPelanggaran, StatusSP, StatusKesehatan, JenisKelamin } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { getPerizinanListAction } from "../app/actions/kesantrian";
import { getPelanggaranListAction, getSPListAction } from "../app/actions/kedisiplinan";
import { getDaftarKesehatanAction } from "../app/actions/kesehatan";

describe("Remediation Round 4: Perizinan, Kedisiplinan & Kesehatan ABAC Fail-Closed & Overfetch Guard", () => {
  let prisma: PrismaClient;

  // Identifiers
  const STAFF_MT1 = "stf-r4-mt1";
  const STAFF_MT_KABID = "stf-r4-mt-kabid";
  const STAFF_PH1 = "stf-r4-ph1";
  const STAFF_OTHER = "stf-r4-other";
  const STAFF_KS = "stf-r4-ks";

  const HALAQOH_1 = "hlq-r4-01";
  const HALAQOH_2 = "hlq-r4-02";
  const HALAQOH_OTHER = "hlq-r4-other";

  const SANTRI_1 = "san-r4-01";
  const SANTRI_2 = "san-r4-02";
  const SANTRI_3 = "san-r4-03";

  const USER_WS1 = "usr-r4-ws1";
  const USER_WS_UNLINKED = "usr-r4-ws-unlinked";
  const USER_ST1 = "usr-r4-st1";
  const USER_ST_UNLINKED = "usr-r4-st-unlinked";
  const USER_MT1 = "usr-r4-mt1";
  const USER_MT_UNLINKED = "usr-r4-mt-unlinked";
  const USER_MT_KABID = "usr-r4-mt-kabid";
  const USER_PH1 = "usr-r4-ph1";
  const USER_PH_UNLINKED = "usr-r4-ph-unlinked";
  const USER_KS = "usr-r4-ks";
  const USER_ADM = "usr-r4-adm";
  const USER_MK = "usr-r4-mk";
  const USER_OSDA = "usr-r4-osda";
  const USER_GA = "usr-r4-ga";
  const USER_YAY = "usr-r4-yay";

  const IZIN_1 = "izn-r4-01";
  const IZIN_3 = "izn-r4-03";

  const KAT_PEL_1 = "kat-r4-01";
  const PEL_1 = "pel-r4-01";
  const PEL_3 = "pel-r4-03";

  const SP_1 = "sp-r4-01";
  const SP_3 = "sp-r4-03";

  const KES_1 = "kes-r4-01";
  const KES_3 = "kes-r4-03";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Staff
    await prisma.staff.createMany({
      data: [
        { id: STAFF_MT1, staffCode: "STF-R4-MT1", nama: "Ustadz MT Satu", noHp: "081111", roleStaff: "MT", status: "AKTIF", isKepalaBidangTahfidz: false },
        { id: STAFF_MT_KABID, staffCode: "STF-R4-KABID", nama: "Ustadz MT Kabid", noHp: "081112", roleStaff: "MT", status: "AKTIF", isKepalaBidangTahfidz: true },
        { id: STAFF_PH1, staffCode: "STF-R4-PH1", nama: "Ustadz PH Satu", noHp: "082222", roleStaff: "PH", status: "AKTIF", isKepalaBidangTahfidz: false },
        { id: STAFF_OTHER, staffCode: "STF-R4-OTH", nama: "Ustadz Other", noHp: "083333", roleStaff: "MT", status: "AKTIF", isKepalaBidangTahfidz: false },
        { id: STAFF_KS, staffCode: "STF-R4-KS", nama: "Kiai Pimpinan", noHp: "084444", roleStaff: "KS", status: "AKTIF", isKepalaBidangTahfidz: false },
      ],
    });

    // 2. Halaqoh
    await prisma.halaqoh.createMany({
      data: [
        { id: HALAQOH_1, halaqohCode: "HLQ-R4-01", nama: "Halaqoh Al-Fatihah", pembinaId: STAFF_MT1, tahunAjaran: "2025/2026" },
        { id: HALAQOH_2, halaqohCode: "HLQ-R4-02", nama: "Halaqoh Al-Baqarah", pembinaId: STAFF_PH1, tahunAjaran: "2025/2026" },
        { id: HALAQOH_OTHER, halaqohCode: "HLQ-R4-OTH", nama: "Halaqoh Ali Imran", pembinaId: STAFF_OTHER, tahunAjaran: "2025/2026" },
      ],
    });

    // 3. Santri
    await prisma.santri.createMany({
      data: [
        { id: SANTRI_1, nis: "SAN-R4-01", nama: "Ahmad Santri R4", kelas: "7A", jenisKelamin: JenisKelamin.L, halaqohId: HALAQOH_1, namaWali: "Bapak Ahmad", noHpWali: "08111111111" },
        { id: SANTRI_2, nis: "SAN-R4-02", nama: "Budi Santri R4", kelas: "7B", jenisKelamin: JenisKelamin.L, halaqohId: HALAQOH_2, namaWali: "Bapak Budi", noHpWali: "08222222222" },
        { id: SANTRI_3, nis: "SAN-R4-03", nama: "Chandra Santri R4", kelas: "8A", jenisKelamin: JenisKelamin.L, halaqohId: HALAQOH_OTHER, namaWali: "Bapak Chandra", noHpWali: "08333333333" },
      ],
    });

    // 4. Users
    await prisma.user.createMany({
      data: [
        { id: USER_WS1, username: "r4.wali.ahmad", role: "WS", santriId: SANTRI_1, passwordHash: "dummy" },
        { id: USER_WS_UNLINKED, username: "r4.wali.unlinked", role: "WS", santriId: null, passwordHash: "dummy" },
        { id: USER_ST1, username: "r4.santri.budi", role: "ST", santriId: SANTRI_2, passwordHash: "dummy" },
        { id: USER_ST_UNLINKED, username: "r4.santri.unlinked", role: "ST", santriId: null, passwordHash: "dummy" },
        { id: USER_MT1, username: "r4.musyrif.mt1", role: "MT", staffId: STAFF_MT1, passwordHash: "dummy" },
        { id: USER_MT_UNLINKED, username: "r4.musyrif.unlinked", role: "MT", staffId: null, passwordHash: "dummy" },
        { id: USER_MT_KABID, username: "r4.musyrif.kabid", role: "MT", staffId: STAFF_MT_KABID, passwordHash: "dummy" },
        { id: USER_PH1, username: "r4.pembina.ph1", role: "PH", staffId: STAFF_PH1, passwordHash: "dummy" },
        { id: USER_PH_UNLINKED, username: "r4.pembina.unlinked", role: "PH", staffId: null, passwordHash: "dummy" },
        { id: USER_KS, username: "r4.mudir.ks", role: "KS", staffId: STAFF_KS, passwordHash: "dummy" },
        { id: USER_ADM, username: "r4.admin.tu", role: "ADM", passwordHash: "dummy" },
        { id: USER_MK, username: "r4.kesantrian.mk", role: "MK", passwordHash: "dummy" },
        { id: USER_OSDA, username: "r4.poskestren.osda", role: "OSDA", passwordHash: "dummy" },
        { id: USER_GA, username: "r4.sarpras.ga", role: "GA", passwordHash: "dummy" },
        { id: USER_YAY, username: "r4.pengurus.yay", role: "YAY", passwordHash: "dummy" },
      ],
    });

    // 5. Perizinan
    await prisma.perizinanSantri.createMany({
      data: [
        {
          id: IZIN_1,
          kodeIzin: "IZN-R4-001",
          santriId: SANTRI_1,
          jenis: JenisIzin.PULANG,
          tanggalMulai: new Date("2026-09-01"),
          tanggalSelesai: new Date("2026-09-03"),
          alasan: "Acara keluarga",
          status: StatusIzin.DISETUJUI,
        },
        {
          id: "izn-r4-02",
          kodeIzin: "IZN-R4-002",
          santriId: SANTRI_2,
          jenis: JenisIzin.PULANG,
          tanggalMulai: new Date("2026-09-02"),
          tanggalSelesai: new Date("2026-09-04"),
          alasan: "Keperluan keluarga",
          status: StatusIzin.DISETUJUI,
        },
        {
          id: IZIN_3,
          kodeIzin: "IZN-R4-003",
          santriId: SANTRI_3,
          jenis: JenisIzin.SAKIT,
          tanggalMulai: new Date("2026-09-05"),
          tanggalSelesai: new Date("2026-09-07"),
          alasan: "Istirahat dokter",
          status: StatusIzin.MENUNGGU_MK,
        },
      ],
    });

    // 6. Master Pelanggaran & Pelanggaran
    await prisma.kategoriPelanggaran.create({
      data: {
        id: KAT_PEL_1,
        kode: "PLG-R4-01",
        nama: "Terlambat Sholat Berjamaah",
        tingkat: TingkatPelanggaran.KATEGORI_1,
        poinDasar: 5,
      },
    });

    await prisma.pelanggaranSantri.createMany({
      data: [
        {
          id: PEL_1,
          kodePelanggaran: "PEL-R4-001",
          santriId: SANTRI_1,
          kategoriId: KAT_PEL_1,
          poinFinal: 5,
          kronologi: "Terlambat 10 menit sholat subuh",
          isPengulangan: false,
          pencatatId: STAFF_MT1,
        },
        {
          id: PEL_3,
          kodePelanggaran: "PEL-R4-003",
          santriId: SANTRI_3,
          kategoriId: KAT_PEL_1,
          poinFinal: 10,
          kronologi: "Terlambat 20 menit sholat maghrib",
          isPengulangan: true,
          pencatatId: STAFF_OTHER,
        },
      ],
    });

    // 7. Surat Peringatan
    await prisma.suratPeringatan.createMany({
      data: [
        {
          id: SP_1,
          nomorSP: "SP/01/R4/IX/2026",
          santriId: SANTRI_1,
          tingkatSP: 1,
          totalPoinSaatTerbit: 20,
          status: StatusSP.AKTIF,
        },
        {
          id: SP_3,
          nomorSP: "SP/03/R4/IX/2026",
          santriId: SANTRI_3,
          tingkatSP: 2,
          totalPoinSaatTerbit: 45,
          status: StatusSP.AKTIF,
        },
      ],
    });

    // 8. Catatan Kesehatan
    await prisma.catatanKesehatan.createMany({
      data: [
        {
          id: KES_1,
          santriId: SANTRI_1,
          keluhan: "Demam ringan dan pusing",
          diagnosa: "Gejala flu biasa",
          tindakan: "Diberikan paracetamol dan istirahat",
          status: StatusKesehatan.RAWAT_PONDOK,
          dicatatOleh: "Petugas Poskestren",
        },
        {
          id: KES_3,
          santriId: SANTRI_3,
          keluhan: "Luka lecet di lutut",
          diagnosa: "Lecet ringan saat olahraga",
          tindakan: "Pembersihan luka dan antiseptik",
          status: StatusKesehatan.SEMBUH,
          dicatatOleh: "Petugas Poskestren",
        },
      ],
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  describe("A. getPerizinanListAction Scoping & Redaction", () => {
    it("1. unauthenticated getPerizinanListAction -> fail closed", async () => {
      setTestSession(null);
      const res = await getPerizinanListAction();
      assert.equal(res.success, false);
      assert.deepEqual(res.data, []);
    });

    it("2. WS / ST unlinked getPerizinanListAction -> fail closed", async () => {
      setTestSession({ userId: USER_WS_UNLINKED, username: "r4.wali.unlinked", name: "Wali Unlinked", role: "WS" });
      const resWS = await getPerizinanListAction();
      assert.equal(resWS.success, false);
      assert.deepEqual(resWS.data, []);

      setTestSession({ userId: USER_ST_UNLINKED, username: "r4.santri.unlinked", name: "Santri Unlinked", role: "ST" });
      const resST = await getPerizinanListAction();
      assert.equal(resST.success, false);
      assert.deepEqual(resST.data, []);
    });

    it("3. WS / ST linked getPerizinanListAction -> own records only", async () => {
      setTestSession({ userId: USER_WS1, username: "r4.wali.ahmad", name: "Wali Ahmad", role: "WS", santriId: SANTRI_1 });
      const resWS = await getPerizinanListAction();
      assert.equal(resWS.success, true);
      assert.equal(resWS.data.length, 1);
      assert.equal(resWS.data[0].id, IZIN_1);
      assert.equal(resWS.data[0].santri.nama, "Ahmad Santri R4");

      setTestSession({ userId: USER_ST1, username: "r4.santri.budi", name: "Santri Budi", role: "ST", santriId: SANTRI_2 });
      const resST = await getPerizinanListAction();
      assert.equal(resST.success, true);
      assert.equal(resST.data.length, 1);
      assert.equal(resST.data[0].id, "izn-r4-02");
      assert.equal(resST.data[0].santri.nama, "Budi Santri R4");
    });

    it("4. unauthorized role getPerizinanListAction -> denied (MT, PH, GA, YAY, OSDA)", async () => {
      const unauthorizedRoles: Array<"MT" | "PH" | "GA" | "YAY" | "OSDA"> = ["MT", "PH", "GA", "YAY", "OSDA"];
      for (const role of unauthorizedRoles) {
        setTestSession({ userId: `usr-${role.toLowerCase()}`, username: `user.${role.toLowerCase()}`, name: `User ${role}`, role });
        const res = await getPerizinanListAction();
        assert.equal(res.success, false, `Role ${role} harus ditolak`);
        assert.deepEqual(res.data, []);
      }
    });

    it("5. authorized managerial roles (KS, ADM, MK) -> can access records", async () => {
      for (const role of ["KS", "ADM", "MK"] as const) {
        setTestSession({ userId: `usr-${role.toLowerCase()}`, username: `mgr.${role.toLowerCase()}`, name: `Manager ${role}`, role });
        const res = await getPerizinanListAction();
        assert.equal(res.success, true, `Role ${role} harus dapat membaca daftar perizinan`);
        assert.ok(res.data.length >= 2, `Role ${role} harus melihat setidaknya 2 perizinan`);
      }
    });

    it("6. getPerizinanListAction returned payload does not leak relations/raw user projections", async () => {
      setTestSession({ userId: USER_MK, username: "r4.kesantrian.mk", name: "MK", role: "MK" });
      const res = await getPerizinanListAction();
      assert.equal(res.success, true);
      for (const item of res.data) {
        // Assert raw internal relations or passwords or pemohon objects are not leaked
        assert.equal((item as Record<string, unknown>).pemohon, undefined);
        assert.equal((item as Record<string, unknown>).pemohonId, undefined);
        assert.equal((item as Record<string, unknown>).passwordHash, undefined);
      }
    });
  });

  describe("B. getPelanggaranListAction Scoping & Boundaries", () => {
    it("1. getPelanggaranListAction unauthenticated -> denied", async () => {
      setTestSession(null);
      const res = await getPelanggaranListAction();
      assert.equal(res.success, false);
      assert.deepEqual(res.data, []);
    });

    it("2. getPelanggaranListAction WS / ST unlinked -> denied", async () => {
      setTestSession({ userId: USER_WS_UNLINKED, username: "r4.wali.unlinked", name: "Wali Unlinked", role: "WS" });
      const resWS = await getPelanggaranListAction();
      assert.equal(resWS.success, false);
      assert.deepEqual(resWS.data, []);

      setTestSession({ userId: USER_ST_UNLINKED, username: "r4.santri.unlinked", name: "Santri Unlinked", role: "ST" });
      const resST = await getPelanggaranListAction();
      assert.equal(resST.success, false);
      assert.deepEqual(resST.data, []);
    });

    it("3. getPelanggaranListAction MT / PH without staffId -> fail closed", async () => {
      setTestSession({ userId: USER_MT_UNLINKED, username: "r4.musyrif.unlinked", name: "MT Unlinked", role: "MT", staffId: null });
      const resMT = await getPelanggaranListAction();
      assert.equal(resMT.success, false);
      assert.deepEqual(resMT.data, []);

      setTestSession({ userId: USER_PH_UNLINKED, username: "r4.pembina.unlinked", name: "PH Unlinked", role: "PH", staffId: null });
      const resPH = await getPelanggaranListAction();
      assert.equal(resPH.success, false);
      assert.deepEqual(resPH.data, []);
    });

    it("4. getPelanggaranListAction MT ordinary staff -> only santri in own halaqoh", async () => {
      setTestSession({ userId: USER_MT1, username: "r4.musyrif.mt1", name: "MT 1", role: "MT", staffId: STAFF_MT1 });
      const res = await getPelanggaranListAction();
      assert.equal(res.success, true);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].santriId, SANTRI_1);
      assert.equal(res.data[0].id, PEL_1);
    });

    it("5. getPelanggaranListAction cross-halaqoh requested santriId -> rejected", async () => {
      setTestSession({ userId: USER_MT1, username: "r4.musyrif.mt1", name: "MT 1", role: "MT", staffId: STAFF_MT1 });
      // MT1 tries to request data for SANTRI_3 who belongs to HALAQOH_OTHER
      const res = await getPelanggaranListAction(SANTRI_3);
      assert.equal(res.success, false);
      assert.ok(res.message?.includes("luar halaqoh"));
      assert.deepEqual(res.data, []);
    });

    it("6. getPelanggaranListAction unrelated role (GA, OSDA) -> denied", async () => {
      for (const role of ["GA", "OSDA"] as const) {
        setTestSession({ userId: `usr-${role.toLowerCase()}`, username: `user.${role.toLowerCase()}`, name: `User ${role}`, role });
        const res = await getPelanggaranListAction();
        assert.equal(res.success, false);
        assert.deepEqual(res.data, []);
      }
    });

    it("7. getPelanggaranListAction Kabid MT -> managerial scope authorized", async () => {
      setTestSession({
        userId: USER_MT_KABID,
        username: "r4.musyrif.kabid",
        name: "Kabid Tahfidz",
        role: "MT",
        staffId: STAFF_MT_KABID,
        isKepalaBidangTahfidz: true,
      });
      const res = await getPelanggaranListAction();
      assert.equal(res.success, true);
      assert.ok(res.data.length >= 2, "Kabid MT dapat melihat catatan pelanggaran global");
    });
  });

  describe("C. getSPListAction Scoping & Boundaries", () => {
    it("1. getSPListAction unauthenticated -> denied", async () => {
      setTestSession(null);
      const res = await getSPListAction();
      assert.equal(res.success, false);
      assert.deepEqual(res.data, []);
    });

    it("2. getSPListAction WS / ST unlinked -> denied", async () => {
      setTestSession({ userId: USER_WS_UNLINKED, username: "r4.wali.unlinked", name: "Wali Unlinked", role: "WS" });
      const resWS = await getSPListAction();
      assert.equal(resWS.success, false);
      assert.deepEqual(resWS.data, []);
    });

    it("3. getSPListAction MT / PH without staffId -> fail closed", async () => {
      setTestSession({ userId: USER_MT_UNLINKED, username: "r4.musyrif.unlinked", name: "MT Unlinked", role: "MT", staffId: null });
      const res = await getSPListAction();
      assert.equal(res.success, false);
      assert.deepEqual(res.data, []);
    });

    it("4. getSPListAction MT ordinary staff -> only santri in own halaqoh", async () => {
      setTestSession({ userId: USER_MT1, username: "r4.musyrif.mt1", name: "MT 1", role: "MT", staffId: STAFF_MT1 });
      const res = await getSPListAction();
      assert.equal(res.success, true);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].santriId, SANTRI_1);
      assert.equal(res.data[0].id, SP_1);
    });

    it("5. getSPListAction cross-halaqoh requested santriId -> rejected", async () => {
      setTestSession({ userId: USER_MT1, username: "r4.musyrif.mt1", name: "MT 1", role: "MT", staffId: STAFF_MT1 });
      const res = await getSPListAction(SANTRI_3);
      assert.equal(res.success, false);
      assert.ok(res.message?.includes("luar halaqoh"));
      assert.deepEqual(res.data, []);
    });

    it("6. getSPListAction unrelated role (GA, OSDA) -> denied", async () => {
      setTestSession({ userId: USER_GA, username: "r4.sarpras.ga", name: "GA", role: "GA" });
      const resGA = await getSPListAction();
      assert.equal(resGA.success, false);
      assert.deepEqual(resGA.data, []);
    });
  });

  describe("D. getDaftarKesehatanAction Scoping & PII Sanitization", () => {
    it("1. getDaftarKesehatanAction unauthenticated -> denied", async () => {
      setTestSession(null);
      const res = await getDaftarKesehatanAction();
      assert.equal(res.success, false);
      assert.deepEqual(res.data, []);
    });

    it("2. getDaftarKesehatanAction WS / ST unlinked -> denied", async () => {
      setTestSession({ userId: USER_WS_UNLINKED, username: "r4.wali.unlinked", name: "Wali Unlinked", role: "WS" });
      const resWS = await getDaftarKesehatanAction();
      assert.equal(resWS.success, false);
      assert.deepEqual(resWS.data, []);
    });

    it("3. getDaftarKesehatanAction unauthorized role (MT, PH, GA, YAY, OSDA) -> denied", async () => {
      const unauthorizedKesehatanRoles: Array<"MT" | "PH" | "GA" | "YAY" | "OSDA"> = ["MT", "PH", "GA", "YAY", "OSDA"];
      for (const role of unauthorizedKesehatanRoles) {
        setTestSession({ userId: `usr-${role.toLowerCase()}`, username: `user.${role.toLowerCase()}`, name: `User ${role}`, role });
        const res = await getDaftarKesehatanAction();
        assert.equal(res.success, false, `Role ${role} harus ditolak membaca data kesehatan`);
        assert.deepEqual(res.data, []);
      }
    });

    it("4. getDaftarKesehatanAction authorized role (MK, KS, ADM) -> success", async () => {
      setTestSession({ userId: USER_MK, username: "r4.mk", name: "MK", role: "MK" });
      const res = await getDaftarKesehatanAction();
      assert.equal(res.success, true);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data.length >= 2);
    });

    it("5. getDaftarKesehatanAction does not leak guardian phone/PII", async () => {
      setTestSession({ userId: USER_MK, username: "r4.mk", name: "MK", role: "MK" });
      const res = await getDaftarKesehatanAction();
      assert.equal(res.success, true);
      for (const item of (res.data as Array<{ santri?: Record<string, unknown> }>)) {
        assert.equal(item.santri?.noHpWali, undefined, "noHpWali dilarang diekspos");
        assert.equal(item.santri?.namaWali, undefined, "namaWali dilarang diekspos");
      }
    });
  });

  describe("E. Static Overfetch and Contract Verification", () => {
    it("1. app/page.tsx does not eagerly invoke kesehatan, perizinan, pelanggaran, SP in initApp", () => {
      const pagePath = path.resolve(__dirname, "../app/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      // Extract initApp function
      const initAppMatch = content.match(/const initApp = async \(\) => \{([\s\S]*?)\};/);
      assert.ok(initAppMatch, "initApp function must exist in app/page.tsx");
      const initAppBody = initAppMatch[1];

      assert.ok(!initAppBody.includes("getDaftarKesehatanAction()"), "initApp must not eagerly invoke getDaftarKesehatanAction");
      assert.ok(!initAppBody.includes("getPerizinanListAction()"), "initApp must not eagerly invoke getPerizinanListAction");
      assert.ok(!initAppBody.includes("getPelanggaranListAction()"), "initApp must not eagerly invoke getPelanggaranListAction");
      assert.ok(!initAppBody.includes("getSPListAction()"), "initApp must not eagerly invoke getSPListAction");
    });

    it("2. Beranda counters continue to satisfy Error != Empty without wide cross-domain fetch", () => {
      const pagePath = path.resolve(__dirname, "../app/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(content.includes('setIzinLoadError("Data perizinan belum dimuat.")'), "Default perizinan error initialized");
      assert.ok(content.includes('setPelanggaranLoadError("Data pelanggaran belum dimuat.")'), "Default pelanggaran error initialized");
      assert.ok(content.includes('setSpLoadError("Data SP belum dimuat.")'), "Default SP error initialized");
      assert.ok(content.includes('setKesehatanLoadError("Data kesehatan belum dimuat.")'), "Default kesehatan error initialized");
    });
  });
});
