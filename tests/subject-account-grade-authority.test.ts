(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, JenisKelamin, JenisNilai, AccountType } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  inputNilaiAction,
  getNilaiAkademikListAction,
  getRaporGabunganAction,
} from "../app/actions/akademik";

describe("PRE-LAUNCH PR-1: Studi Umum Subject Account Grade Isolation & End-to-End Authorization", () => {
  let prisma: PrismaClient;

  const MAPEL_MAT = "mapel-test-mat";
  const MAPEL_BIG = "mapel-test-big";
  const SANTRI_ID = "san-grade-test-01";
  const USER_MAT_ID = "usr-tech-subj-mat";
  const USER_BIG_ID = "usr-tech-subj-big";

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Create 2 distinct subjects
    await prisma.mataPelajaran.createMany({
      data: [
        {
          id: MAPEL_MAT,
          kodeMapel: "MAT",
          nama: "Matematika",
          kategori: "UMUM",
        },
        {
          id: MAPEL_BIG,
          kodeMapel: "BIG",
          nama: "Bahasa Inggris",
          kategori: "UMUM",
        },
      ],
    });

    // 2. Create Santri
    await prisma.santri.create({
      data: {
        id: SANTRI_ID,
        nis: "SAN-TEST-GRADE-01",
        nama: "Ahmad Santri Grade Test",
        kelas: "7A",
        jenisKelamin: JenisKelamin.L,
      },
    });

    // 3. Create Technical Subject Accounts
    await prisma.user.createMany({
      data: [
        {
          id: USER_MAT_ID,
          username: "tech.mapel.matematika",
          role: "GA",
          accountType: AccountType.SUBJECT,
          passwordHash: "dummy-hash",
        },
        {
          id: USER_BIG_ID,
          username: "tech.mapel.binggris",
          role: "GA",
          accountType: AccountType.SUBJECT,
          passwordHash: "dummy-hash",
        },
      ],
    });

    // 4. Bind Technical Accounts: 1 Account = 1 Subject
    await prisma.academicSubjectAccountBinding.createMany({
      data: [
        {
          id: "bind-mat-01",
          userId: USER_MAT_ID,
          subjectId: MAPEL_MAT,
          isActive: true,
        },
        {
          id: "bind-big-01",
          userId: USER_BIG_ID,
          subjectId: MAPEL_BIG,
          isActive: true,
        },
      ],
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  it("1. Unauthenticated call to inputNilaiAction -> DENY", async () => {
    setTestSession(null);
    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_MAT,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 90,
      namaPengajarSnapshot: "Bpk. Hendra Gunawan",
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message || "", /login|sesi/i);
  });

  it("2. SUBJECT account A -> WRITE grade for bound Subject A succeeds (with manual teacher snapshot and nullable guruId)", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    const initialCount = await prisma.nilaiAkademik.count({
      where: { mapelId: MAPEL_MAT },
    });

    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_MAT,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 92,
      catatan: "Pemahaman aljabar sangat baik",
      namaPengajarSnapshot: "Bpk. Hendra Gunawan, M.Pd",
    });

    assert.strictEqual(res.success, true, "Subject account must be allowed to write grades for bound subject");
    assert.match(res.message || "", /berhasil disimpan/i);

    // Verify DB record
    const postCount = await prisma.nilaiAkademik.count({
      where: { mapelId: MAPEL_MAT },
    });
    assert.strictEqual(postCount, initialCount + 1, "Nilai record must be inserted in DB");

    const record = await prisma.nilaiAkademik.findFirst({
      where: {
        santriId: SANTRI_ID,
        mapelId: MAPEL_MAT,
      },
    });
    assert.ok(record, "Nilai record must exist");
    assert.strictEqual(record.guruId, null, "guruId must be null for subject account without staffId");
    assert.strictEqual(record.namaPengajarSnapshot, "Bpk. Hendra Gunawan, M.Pd", "namaPengajarSnapshot must be preserved");
    assert.strictEqual(record.dicatatOlehUserId, USER_MAT_ID, "dicatatOlehUserId must record subject account userId");
    assert.strictEqual(record.huruf, "A", "Huruf must be calculated dynamically");
  });

  it("3. SUBJECT account A -> CROSS-SUBJECT WRITE to Subject B is strictly DENIED server-side (Zero DB writes)", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    const initialBigCount = await prisma.nilaiAkademik.count({
      where: { mapelId: MAPEL_BIG },
    });

    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_BIG, // Target Subject B!
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 88,
      catatan: "Percobaan cross-subject write",
      namaPengajarSnapshot: "Miss Sarah",
    });

    assert.strictEqual(res.success, false, "Cross-subject grade write must be denied server-side");
    assert.match(res.message || "", /Akses Ditolak: Akun mata pelajaran tidak berwenang menginput nilai untuk mata pelajaran lain/i);

    // Verify ZERO writes to DB
    const postBigCount = await prisma.nilaiAkademik.count({
      where: { mapelId: MAPEL_BIG },
    });
    assert.strictEqual(postBigCount, initialBigCount, "Zero DB writes: Subject B must have no records added");
  });

  it("4. SUBJECT account A -> READ grades for bound Subject A succeeds", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    const res = await getNilaiAkademikListAction({
      mapelId: MAPEL_MAT,
      santriId: SANTRI_ID,
    });

    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data) && res.data.length >= 1);
    assert.strictEqual(res.data[0].mapelId, MAPEL_MAT);
  });

  it("5. SUBJECT account A -> READ grades without mapelId filter is auto-scoped to bound Subject A", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    // Call without mapelId parameter
    const res = await getNilaiAkademikListAction({
      santriId: SANTRI_ID,
    });

    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data));
    for (const item of res.data) {
      assert.strictEqual(item.mapelId, MAPEL_MAT, "All returned items must belong only to bound Subject A");
    }
  });

  it("6. SUBJECT account A -> CROSS-SUBJECT READ for Subject B is strictly DENIED server-side", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    const res = await getNilaiAkademikListAction({
      mapelId: MAPEL_BIG, // Query Subject B
      santriId: SANTRI_ID,
    });

    assert.strictEqual(res.success, false, "Cross-subject grade read must be denied server-side");
    assert.match(res.message || "", /Akses Ditolak: Akun mata pelajaran tidak berwenang melihat nilai untuk mata pelajaran lain/i);
    assert.deepStrictEqual(res.data, [], "Must return empty data on access denial");
  });

  it("7. SUBJECT account A -> GET RAPOR GABUNGAN cross-domain report is strictly DENIED server-side", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    const res = await getRaporGabunganAction(SANTRI_ID, 1);

    assert.strictEqual(res.success, false, "Subject account must not access integrated full rapor");
    assert.match(res.message || "", /Akses Ditolak: Akun mata pelajaran hanya berwenang mengakses data mata pelajarannya sendiri/i);
  });
});
