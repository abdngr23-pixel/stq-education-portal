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

    // 5. Create valid started EducationSession for Matematika
    await prisma.educationSession.create({
      data: {
        id: "sess-mat-valid-01",
        educationTrack: "STUDI_UMUM",
        status: "STARTED",
        subjectId: MAPEL_MAT,
        startedByUserId: USER_MAT_ID,
        actualTeacherName: "Bpk. Hendra Gunawan, M.Pd",
        scheduledDate: new Date("2026-09-20T08:00:00.000Z"),
        jp: 2,
        programLevel: 1,
        participants: {
          create: [
            {
              santriId: SANTRI_ID,
            },
          ],
        },
      },
    });

    // 6. Create valid started EducationSession for Bahasa Inggris
    await prisma.educationSession.create({
      data: {
        id: "sess-big-valid-01",
        educationTrack: "STUDI_UMUM",
        status: "STARTED",
        subjectId: MAPEL_BIG,
        startedByUserId: USER_BIG_ID,
        actualTeacherName: "Miss Sarah",
        scheduledDate: new Date("2026-09-20T10:00:00.000Z"),
        jp: 2,
        programLevel: 1,
        participants: {
          create: [
            {
              santriId: SANTRI_ID,
            },
          ],
        },
      },
    });

    // 7. Create Santri outside session scope
    await prisma.santri.create({
      data: {
        id: "san-out-of-scope",
        nis: "SAN-OUT-01",
        nama: "Santri Luar Sesi",
        kelas: "7B",
        jenisKelamin: JenisKelamin.L,
      },
    });

    // 8. Create PERSONAL user with active subject binding (attack vector)
    const MAPEL_IPA = "mapel-test-ipa";
    await prisma.mataPelajaran.create({
      data: {
        id: MAPEL_IPA,
        kodeMapel: "IPA",
        nama: "Ilmu Pengetahuan Alam",
        kategori: "UMUM",
      },
    });
    await prisma.user.create({
      data: {
        id: "usr-personal-with-bind",
        username: "personal.attacker",
        role: "GA",
        accountType: AccountType.PERSONAL,
        passwordHash: "dummy-hash",
      },
    });
    await prisma.academicSubjectAccountBinding.create({
      data: {
        id: "bind-personal-ipa",
        userId: "usr-personal-with-bind",
        subjectId: MAPEL_IPA,
        isActive: true,
      },
    });

    // 9. Create ADM user
    await prisma.user.create({
      data: {
        id: "usr-admin-test",
        username: "admin.test",
        role: "ADM",
        passwordHash: "dummy-hash",
      },
    });

    // 10. Create Kepesantrenan mapel
    await prisma.mataPelajaran.create({
      data: {
        id: "mapel-kepesantrenan-01",
        kodeMapel: "FKH",
        nama: "Fikih Asrama",
        kategori: "KEPESANTRENAN",
      },
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
      educationSessionId: "sess-mat-valid-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 90,
      namaPengajarSnapshot: "Bpk. Hendra Gunawan",
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message || "", /login|sesi/i);
  });

  it("2. SUBJECT account before valid session -> DENY grade mutation", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    // Call without educationSessionId
    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_MAT,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 90,
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message || "", /educationSessionId|sesi pembelajaran/i);
  });

  it("3. SUBJECT account A + valid session A -> ALLOW (snapshot strictly derived from session.actualTeacherName)", async () => {
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

    // Notice client passes forged namaPengajarSnapshot: "HACKER_CLIENT_NAME"
    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_MAT,
      educationSessionId: "sess-mat-valid-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 92,
      catatan: "Pemahaman aljabar sangat baik",
      namaPengajarSnapshot: "HACKER_FORGED_NAME", // Client-forged snapshot must be IGNORED!
    });

    assert.strictEqual(res.success, true, "Subject account must be allowed to write grades for valid started session");
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
    // CRITICAL: Snapshot derived from session.actualTeacherName, NOT client-supplied snapshot!
    assert.strictEqual(
      record.namaPengajarSnapshot,
      "Bpk. Hendra Gunawan, M.Pd",
      "namaPengajarSnapshot must be derived server-side from EducationSession.actualTeacherName"
    );
    assert.strictEqual(record.dicatatOlehUserId, USER_MAT_ID, "dicatatOlehUserId must record subject account userId");
    assert.strictEqual(record.huruf, "A", "Huruf must be calculated dynamically");
  });

  it("4. SUBJECT account A -> CROSS-SUBJECT WRITE to Subject B is strictly DENIED server-side (Zero DB writes)", async () => {
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
      educationSessionId: "sess-big-valid-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 88,
      catatan: "Percobaan cross-subject write",
    });

    assert.strictEqual(res.success, false, "Cross-subject grade write must be denied server-side");
    assert.match(res.message || "", /Akses Ditolak: Sesi pembelajaran ini dimulai oleh akun lain|Akses Ditolak: Akun mata pelajaran tidak berwenang/i);

    // Verify ZERO writes to DB
    const postBigCount = await prisma.nilaiAkademik.count({
      where: { mapelId: MAPEL_BIG },
    });
    assert.strictEqual(postBigCount, initialBigCount, "Zero DB writes: Subject B must have no records added");
  });

  it("5. Participant outside session scope -> DENY", async () => {
    const sessionMat: UserSession = {
      userId: USER_MAT_ID,
      username: "tech.mapel.matematika",
      name: "Akun Mapel Matematika",
      role: "GA",
    };
    setTestSession(sessionMat);

    const res = await inputNilaiAction({
      santriId: "san-out-of-scope", // Not in sess-mat-valid-01 participants!
      mapelId: MAPEL_MAT,
      educationSessionId: "sess-mat-valid-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 85,
    });

    assert.strictEqual(res.success, false, "Santri outside session scope must be denied");
    assert.match(res.message || "", /di luar cakupan peserta sesi/i);
  });

  it("6. PERSONAL user + active subject binding -> DENY subject-account authority", async () => {
    const sessionPersonal: UserSession = {
      userId: "usr-personal-with-bind",
      username: "personal.attacker",
      name: "Personal User Attacker",
      role: "GA",
    };
    setTestSession(sessionPersonal);

    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_MAT,
      educationSessionId: "sess-mat-valid-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 85,
    });

    // PERSONAL user does NOT have accountType = SUBJECT, nor are they the teacher of the session
    assert.strictEqual(res.success, false, "Personal user must not gain subject-account grading authority");
    assert.match(res.message || "", /Akses Ditolak/i);
  });

  it("7. ADM role calling inputNilaiAction -> DENY (cannot widen ADM authority)", async () => {
    const sessionAdmin: UserSession = {
      userId: "usr-admin-test",
      username: "admin.test",
      name: "Admin User",
      role: "ADM",
    };
    setTestSession(sessionAdmin);

    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: MAPEL_MAT,
      educationSessionId: "sess-mat-valid-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 95,
    });

    assert.strictEqual(res.success, false, "ADM must not have direct grade write authority");
    assert.match(res.message || "", /Role ADM tidak memiliki hak akses/i);
  });

  it("8. GA calling inputNilaiAction for Kepesantrenan mapel -> DENY (cannot bypass Kepesantrenan authorization)", async () => {
    const sessionGA: UserSession = {
      userId: "usr-ga-regular",
      username: "guru.akademik",
      name: "Guru Akademik Biasa",
      role: "GA",
    };
    setTestSession(sessionGA);

    const res = await inputNilaiAction({
      santriId: SANTRI_ID,
      mapelId: "mapel-kepesantrenan-01",
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.TUGAS,
      angka: 88,
    });

    assert.strictEqual(res.success, false, "GA cannot input grades for Kepesantrenan subjects");
    assert.match(res.message || "", /tidak memiliki wewenang mengelola penilaian kepesantrenan/i);
  });

  it("9. SUBJECT account A -> READ grades for bound Subject A succeeds", async () => {
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

  it("10. SUBJECT account A -> READ grades without mapelId filter is auto-scoped to bound Subject A", async () => {
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

  it("11. SUBJECT account A -> CROSS-SUBJECT READ for Subject B is strictly DENIED server-side", async () => {
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

  it("12. SUBJECT account A -> GET RAPOR GABUNGAN cross-domain report is strictly DENIED server-side", async () => {
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
