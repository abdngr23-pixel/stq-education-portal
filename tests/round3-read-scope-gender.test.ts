(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import { getDaftarKotakSaranAction } from "../app/actions/portal-wali";
import { getDaftarAgendaAction, getPublicAgendaAction } from "../app/actions/kalender";

describe("Remediation Round 3: Kotak Saran ABAC Fail-Closed & Calendar Read RBAC", () => {
  let prisma: PrismaClient;

  // Test data IDs
  const USER_WS1 = "usr-r3-ws-01";
  const USER_WS_UNLINKED = "usr-r3-ws-unlinked";
  const USER_ST1 = "usr-r3-st-01";
  const USER_ST_UNLINKED = "usr-r3-st-unlinked";
  const USER_KS = "usr-r3-ks-01";
  const USER_ADM = "usr-r3-adm-01";
  const USER_GA = "usr-r3-ga-01";
  const USER_MT = "usr-r3-mt-01";
  const USER_PH = "usr-r3-ph-01";
  const USER_MK = "usr-r3-mk-01";
  const USER_YAY = "usr-r3-yay-01";

  const SANTRI_1 = "santri-r3-01";
  const SANTRI_2 = "santri-r3-02";
  const SANTRI_3 = "santri-r3-03";

  const SARAN_WS1_ID = "srn-r3-01";
  const SARAN_OTHER_ID = "srn-r3-02";
  const SARAN_ST1_ID = "srn-r3-03";

  const AGENDA_PUBLIC_ID = "agd-r3-public";
  const AGENDA_INTERNAL_ID = "agd-r3-internal";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Santri
    await prisma.santri.createMany({
      data: [
        { id: SANTRI_1, nis: "SAN-R3-01", nama: "Ahmad Santri 1", kelas: "7A", jenisKelamin: "L" },
        { id: SANTRI_2, nis: "SAN-R3-02", nama: "Santri Mandiri 2", kelas: "8A", jenisKelamin: "L" },
        { id: SANTRI_3, nis: "SAN-R3-03", nama: "Fathimah Santri 3", kelas: "7C", jenisKelamin: "P" },
      ],
    });

    // 2. Seed Users
    await prisma.user.createMany({
      data: [
        { id: USER_WS1, username: "wali.ahmad", role: "WS", santriId: SANTRI_1, passwordHash: "dummy" },
        { id: USER_WS_UNLINKED, username: "wali.unlinked", role: "WS", santriId: null, passwordHash: "dummy" },
        { id: USER_ST1, username: "santri.mandiri", role: "ST", santriId: SANTRI_2, passwordHash: "dummy" },
        { id: USER_ST_UNLINKED, username: "santri.unlinked", role: "ST", santriId: null, passwordHash: "dummy" },
        { id: USER_KS, username: "mudir.ks", role: "KS", passwordHash: "dummy" },
        { id: USER_ADM, username: "admin.tu", role: "ADM", passwordHash: "dummy" },
        { id: USER_GA, username: "sarpras.ga", role: "GA", passwordHash: "dummy" },
        { id: USER_MT, username: "musyrif.mt", role: "MT", passwordHash: "dummy" },
        { id: USER_PH, username: "pembina.ph", role: "PH", passwordHash: "dummy" },
        { id: USER_MK, username: "kesantrian.mk", role: "MK", passwordHash: "dummy" },
        { id: USER_YAY, username: "pengurus.yay", role: "YAY", passwordHash: "dummy" },
      ],
    });

    // 3. Seed Kotak Saran records
    await prisma.kotakSaran.createMany({
      data: [
        {
          id: SARAN_WS1_ID,
          pengirimId: USER_WS1,
          nama: "Wali Ahmad",
          noHp: "081234567890",
          santriId: SANTRI_1,
          kategori: "AKADEMIK",
          pesan: "Aspirasi wali Ahmad untuk santri 1",
          status: "BARU",
        },
        {
          id: SARAN_OTHER_ID,
          pengirimId: "usr-other",
          nama: "Wali Fathimah",
          noHp: "089999999999",
          santriId: SANTRI_3,
          kategori: "KESEHATAN",
          pesan: "Aspirasi wali Fathimah untuk santri 3",
          status: "BARU",
        },
        {
          id: SARAN_ST1_ID,
          pengirimId: USER_ST1,
          nama: "Santri Mandiri",
          santriId: SANTRI_2,
          kategori: "SARPRAS",
          pesan: "Aspirasi santri mandiri untuk santri 2",
          status: "BARU",
        },
      ],
    });

    // 4. Seed Kalender Akademik
    await prisma.kalenderAkademik.createMany({
      data: [
        {
          id: AGENDA_PUBLIC_ID,
          judul: "Ujian Tahfizh Terbuka",
          tanggalMulai: new Date("2026-10-01"),
          kategori: "TAHFIZH",
          targetPeserta: "SEMUA",
          lokasi: "Masjid Utama",
        },
        {
          id: AGENDA_INTERNAL_ID,
          judul: "Rapat Internal Pengasuhan & TU",
          tanggalMulai: new Date("2026-10-05"),
          kategori: "KEGIATAN_SANTRI",
          targetPeserta: "ASATIDZ",
          lokasi: "Ruang Rapat",
        },
      ],
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  // =========================================================================
  // A. P0 — KOTAK SARAN READ ABAC MUST FAIL CLOSED
  // =========================================================================
  describe("A. Kotak Saran Read ABAC Fail-Closed", () => {
    it("1. unauthenticated -> rejected + data []", async () => {
      setTestSession(null);
      const res = await getDaftarKotakSaranAction();
      assert.equal(res.success, false, "Harus ditolak saat unauthenticated");
      assert.ok(res.message.includes("Akses Ditolak"), "Pesan harus Akses Ditolak");
      assert.deepEqual(res.data, [], "Data harus array kosong []");
    });

    it("2. WS own -> own records only", async () => {
      setTestSession({
        userId: USER_WS1,
        username: "wali.ahmad",
        name: "Wali Ahmad",
        role: "WS",
        santriId: SANTRI_1,
      });

      const res = await getDaftarKotakSaranAction();
      assert.equal(res.success, true, "WS terhubung harus berhasil");
      assert.ok(Array.isArray(res.data), "Data harus array");
      const ids = res.data?.map((s) => s.id);
      assert.ok(ids?.includes(SARAN_WS1_ID), "Harus melihat sarannya sendiri");
      assert.ok(!ids?.includes(SARAN_OTHER_ID), "Dilarang melihat saran milik santri/wali lain (SANTRI_3)");
    });

    it("3. WS unlinked -> never global (only own pengirimId or empty)", async () => {
      setTestSession({
        userId: USER_WS_UNLINKED,
        username: "wali.unlinked",
        name: "Wali Unlinked",
        role: "WS",
        santriId: undefined,
      });

      const res = await getDaftarKotakSaranAction();
      assert.equal(res.success, true, "WS unlinked request boleh dievaluasi");
      assert.ok(Array.isArray(res.data), "Data harus array");
      // Tidak punya saran dengan pengirimId USER_WS_UNLINKED -> harus kosong, DILARANG GLOBAL!
      assert.equal(res.data?.length, 0, "WS unlinked tidak boleh melihat record global santri lain!");
    });

    it("4. ST own -> own records only", async () => {
      setTestSession({
        userId: USER_ST1,
        username: "santri.mandiri",
        name: "Santri Mandiri",
        role: "ST",
        santriId: SANTRI_2,
      });

      const res = await getDaftarKotakSaranAction();
      assert.equal(res.success, true, "ST terhubung harus berhasil");
      const ids = res.data?.map((s) => s.id);
      assert.ok(ids?.includes(SARAN_ST1_ID), "Harus melihat sarannya sendiri");
      assert.ok(!ids?.includes(SARAN_OTHER_ID), "Dilarang melihat saran milik santri/wali lain");
    });

    it("5. ST unlinked -> never global", async () => {
      setTestSession({
        userId: USER_ST_UNLINKED,
        username: "santri.unlinked",
        name: "Santri Unlinked",
        role: "ST",
        santriId: undefined,
      });

      const res = await getDaftarKotakSaranAction();
      assert.equal(res.success, true);
      assert.equal(res.data?.length, 0, "ST unlinked tidak boleh melihat record global!");
    });

    it("6. unrelated roles (MT, PH, MK, GA, OSDA, YAY) -> rejected + data []", async () => {
      const forbiddenRoles: UserSession["role"][] = ["MT", "PH", "MK", "GA", "OSDA", "YAY"];

      for (const role of forbiddenRoles) {
        setTestSession({
          userId: `usr-test-${role.toLowerCase()}`,
          username: `user.${role.toLowerCase()}`,
          name: `User ${role}`,
          role,
        });

        const res = await getDaftarKotakSaranAction();
        assert.equal(res.success, false, `Role ${role} harus ditolak membaca kotak saran`);
        assert.ok(res.message.includes("Akses Ditolak"), `Role ${role} harus menerima pesan Akses Ditolak`);
        assert.deepEqual(res.data, [], `Role ${role} harus menerima data []`);
      }
    });

    it("7. KS / ADM -> managerial scope (can view all records)", async () => {
      // KS Test
      setTestSession({
        userId: USER_KS,
        username: "mudir.ks",
        name: "K.H. Mudir",
        role: "KS",
      });
      const resKS = await getDaftarKotakSaranAction();
      assert.equal(resKS.success, true, "KS harus diizinkan");
      assert.ok((resKS.data?.length ?? 0) >= 3, "KS harus dapat melihat seluruh saran secara manajerial");

      // ADM Test
      setTestSession({
        userId: USER_ADM,
        username: "admin.tu",
        name: "Admin TU",
        role: "ADM",
      });
      const resADM = await getDaftarKotakSaranAction();
      assert.equal(resADM.success, true, "ADM harus diizinkan");
      assert.ok((resADM.data?.length ?? 0) >= 3, "ADM harus dapat melihat seluruh saran secara manajerial");
    });

    it("8. DTO sanitization -> only returns id, nama, kategori, pesan, tanggapan, status (no internal PII)", async () => {
      setTestSession({
        userId: USER_KS,
        username: "mudir.ks",
        name: "K.H. Mudir",
        role: "KS",
      });

      const res = await getDaftarKotakSaranAction();
      assert.ok(res.success && res.data && res.data.length > 0);
      const firstItem = res.data[0] as unknown as Record<string, unknown>;
      // Wajib ada
      assert.ok("id" in firstItem, "DTO harus memiliki id");
      assert.ok("nama" in firstItem, "DTO harus memiliki nama");
      assert.ok("kategori" in firstItem, "DTO harus memiliki kategori");
      assert.ok("pesan" in firstItem, "DTO harus memiliki pesan");
      assert.ok("tanggapan" in firstItem, "DTO harus memiliki tanggapan");
      assert.ok("status" in firstItem, "DTO harus memiliki status");

      // Dilarang bocor
      assert.equal(firstItem.noHp, undefined, "noHp dilarang bocor pada DTO");
      assert.equal(firstItem.pengirimId, undefined, "pengirimId dilarang bocor pada DTO");
      assert.equal(firstItem.santriId, undefined, "santriId dilarang bocor pada DTO");
      assert.equal(firstItem.santri, undefined, "relasi santri internal dilarang bocor pada DTO");
    });
  });

  // =========================================================================
  // B. P1 — INTERNAL CALENDAR MUST NOT BE GLOBAL/PUBLIC
  // =========================================================================
  describe("B. Internal Calendar Read RBAC", () => {
    it("1. KS internal read PASS", async () => {
      setTestSession({
        userId: USER_KS,
        username: "mudir.ks",
        name: "K.H. Mudir",
        role: "KS",
      });

      const res = await getDaftarAgendaAction();
      assert.equal(res.success, true, "KS harus diizinkan membaca agenda internal");
      const items = Array.isArray(res.data) ? res.data : [];
      assert.ok(items.length >= 2, "KS harus melihat semua agenda");
    });

    it("2. ADM internal read PASS", async () => {
      setTestSession({
        userId: USER_ADM,
        username: "admin.tu",
        name: "Admin TU",
        role: "ADM",
      });

      const res = await getDaftarAgendaAction();
      assert.equal(res.success, true, "ADM harus diizinkan membaca agenda internal");
      const items = Array.isArray(res.data) ? res.data : [];
      assert.ok(items.length >= 2, "ADM harus melihat semua agenda");
    });

    it("3. GA internal read PASS", async () => {
      setTestSession({
        userId: USER_GA,
        username: "sarpras.ga",
        name: "Petugas Sarpras",
        role: "GA",
      });

      const res = await getDaftarAgendaAction();
      assert.equal(res.success, true, "GA harus diizinkan membaca agenda internal (ROLE_NAV_MAP)");
      const items = Array.isArray(res.data) ? res.data : [];
      assert.ok(items.length >= 2, "GA harus melihat semua agenda");
    });

    it("4. WS and ST internal read DENY", async () => {
      // WS
      setTestSession({
        userId: USER_WS1,
        username: "wali.ahmad",
        name: "Wali Ahmad",
        role: "WS",
      });
      const resWS = await getDaftarAgendaAction();
      assert.equal(resWS.success, false, "WS harus ditolak membaca agenda internal");
      assert.deepEqual(resWS.data, [], "WS harus menerima data []");

      // ST
      setTestSession({
        userId: USER_ST1,
        username: "santri.mandiri",
        name: "Santri Mandiri",
        role: "ST",
      });
      const resST = await getDaftarAgendaAction();
      assert.equal(resST.success, false, "ST harus ditolak membaca agenda internal");
      assert.deepEqual(resST.data, [], "ST harus menerima data []");
    });

    it("5. MT, PH, MK, OSDA, YAY internal read DENY", async () => {
      const nonCalendarRoles: UserSession["role"][] = ["MT", "PH", "MK", "OSDA", "YAY"];

      for (const role of nonCalendarRoles) {
        setTestSession({
          userId: `usr-cal-${role.toLowerCase()}`,
          username: `cal.${role.toLowerCase()}`,
          name: `User ${role}`,
          role,
        });

        const res = await getDaftarAgendaAction();
        assert.equal(res.success, false, `Role ${role} harus ditolak membaca agenda internal`);
        assert.deepEqual(res.data, [], `Role ${role} harus menerima data []`);
      }
    });

    it("6. public agenda returns only targetPeserta === 'SEMUA'", async () => {
      // Unauthenticated call to getPublicAgendaAction
      setTestSession(null);
      const res = await getPublicAgendaAction();
      assert.equal(res.success, true, "Public agenda harus berhasil dibuka tanpa sesi");
      const items = Array.isArray(res.data) ? (res.data as Array<{ id: string }>) : [];
      assert.ok(items.length > 0, "Public agenda harus mengembalikan item");

      // Harus hanya mengembalikan yang targetPeserta === 'SEMUA' (yaitu AGENDA_PUBLIC_ID)
      const ids = items.map((a) => a.id);
      assert.ok(ids.includes(AGENDA_PUBLIC_ID), "Agenda publik SEMUA harus ada");
      assert.ok(!ids.includes(AGENDA_INTERNAL_ID), "Agenda internal ASATIDZ dilarang bocor ke publik!");
    });
  });
});
