/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import {
  checkPendidikanV2ProductionReadiness,
} from "../lib/server/pendidikan-v2-readiness";
import { PendidikanV2Service } from "../lib/server/pendidikan-v2-service";
import { createPrismaDataProvider } from "../lib/auth/canonical-evaluator";
import {
  matchStudiUmumSession,
  matchKepesantrenanSession,
} from "../lib/pendidikan-v2";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3.3C1: REAL POSTGRESQL ROUND 2 PROOF", () => {
  let prisma: PrismaClient;
  let service: PendidikanV2Service;
  let dataProvider: any;

  before(async () => {
    // Start isolated PostgreSQL with complete prisma/schema.prisma pushed
    prisma = await startTestDatabase();
    dataProvider = createPrismaDataProvider(prisma);
    service = new PendidikanV2Service({ db: prisma, dataProvider });
  });

  after(async () => {
    await stopTestDatabase();
  });

  // =========================================================================
  // 1. REAL POSTGRESQL CATALOG & ENUM DETECTION
  // =========================================================================
  describe("1. Real PostgreSQL Catalog & Enum Verification", () => {
    it("1.1 Detects actual M3.3A tables (health_cases_v2, health_case_v2_events) and enum (HealthStatusV2)", async () => {
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema IN ('public', CURRENT_SCHEMA)
          AND table_name IN ('health_cases_v2', 'health_case_v2_events');
      `);
      const tableNames = tables.map((t) => t.table_name);
      assert.ok(tableNames.includes("health_cases_v2"), "health_cases_v2 table must exist");
      assert.ok(tableNames.includes("health_case_v2_events"), "health_case_v2_events table must exist");

      const enums = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(`
        SELECT typname FROM pg_type WHERE typname = 'HealthStatusV2';
      `);
      assert.strictEqual(enums.length, 1, "HealthStatusV2 enum must exist in PostgreSQL catalog");
    });

    it("1.2 Detects actual M3.3B tables and enums", async () => {
      const expectedTables = [
        "education_cohorts",
        "teaching_assignments",
        "education_sessions",
        "education_session_participants",
        "education_session_attendances",
      ];
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema IN ('public', CURRENT_SCHEMA)
          AND table_name = ANY($1::text[]);
      `, expectedTables);
      const foundNames = new Set(tables.map((t) => t.table_name));
      for (const t of expectedTables) {
        assert.ok(foundNames.has(t), `Table ${t} must exist in isolated PostgreSQL`);
      }

      const expectedEnums = [
        "EducationTrack",
        "PedagogicalLevel",
        "EducationSessionStatus",
        "EducationAttendanceStatus",
      ];
      const enums = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(`
        SELECT typname FROM pg_type WHERE typname = ANY($1::text[]);
      `, expectedEnums);
      const foundEnums = new Set(enums.map((e) => e.typname));
      for (const e of expectedEnums) {
        assert.ok(foundEnums.has(e), `Enum ${e} must exist in isolated PostgreSQL`);
      }
    });

    it("1.3 Real enum values: MASBUK is rejected by PostgreSQL EducationAttendanceStatus enum", async () => {
      const enumValues = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
        SELECT enumlabel FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'EducationAttendanceStatus';
      `);
      const labels = enumValues.map((v) => v.enumlabel);
      assert.ok(labels.includes("HADIR"));
      assert.ok(labels.includes("IZIN"));
      assert.ok(labels.includes("SAKIT"));
      assert.ok(labels.includes("ALFA"));
      assert.ok(!labels.includes("MASBUK"), "MASBUK must NEVER exist in EducationAttendanceStatus enum");
    });

    it("1.4 service.checkSchemaReadiness confirms ready=true on real PostgreSQL", async () => {
      const readiness = await service.checkSchemaReadiness();
      assert.strictEqual(readiness.ready, true);
    });
  });

  // =========================================================================
  // 2. PRODUCTION READINESS GATES ON REAL POSTGRESQL (FAIL-CLOSED STAFF LINKAGE)
  // =========================================================================
  describe("2. Production Readiness Gates & Strict Staff Linkage", () => {
    it("2.1 Zero active Staff reports NOT_READY/BLOCKED with BLOCKED_IDENTITY_LINKAGE", async () => {
      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const staffGate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(staffGate, "STAFF_LINKAGE_READY gate must be present");
      assert.ok(["BLOCKED", "NOT_READY"].includes(staffGate.status));
      assert.ok(staffGate.remediationAdvice?.includes("BLOCKED_IDENTITY_LINKAGE"));
    });

    it("2.2 Missing/inactive Staff linkage reports BLOCKED with unlinked accounts", async () => {
      // Seed operational user without staffId
      await prisma.user.create({
        data: {
          id: "usr-razan-unlinked",
          username: "razan.mt",
          role: "MT",
          passwordHash: "dummy",
          status: "AKTIF",
        },
      });

      const report = await checkPendidikanV2ProductionReadiness(prisma as any);
      const staffGate = report.gates.find((g) => g.gate === "STAFF_LINKAGE_READY");
      assert.ok(staffGate);
      assert.strictEqual(staffGate.status, "BLOCKED");
      assert.ok(staffGate.details.includes("razan.mt"));
      assert.ok(report.unlinkedStaffAccounts.includes("razan.mt"));
      assert.ok(staffGate.remediationAdvice?.includes("BLOCKED_IDENTITY_LINKAGE"));
    });
  });

  // =========================================================================
  // 3. REAL RELATIONAL SEEDING & COLLISION CASES
  // =========================================================================
  describe("3. Real Relational Seed & Disambiguation Collision Proofs", () => {
    const MAT_MAPEL_ID = "mp-su-mat";
    const ARB_MAPEL_ID = "mp-kp-arb";
    const FQH_MAPEL_ID = "mp-kp-fqh";

    const COHORT_1_ID = "coh-c1-1";
    const COHORT_2_ID = "coh-c1-2";

    const STF_AHMAD = "stf-c1-ahmad";
    const STF_ZAID = "stf-c1-zaid";
    const STF_ABI = "stf-c1-abi";
    const STF_KAMAL = "stf-c1-kamal";
    const STF_ANDI = "stf-c1-andi";
    const STF_LISA = "stf-c1-lisa";

    const USR_AHMAD = "usr-c1-ahmad";
    const USR_ZAID = "usr-c1-zaid";
    const USR_ABI = "usr-c1-abi";
    const USR_LISA = "usr-c1-lisa";

    const POS_GURU = "pos-c1-guru";
    const OU_AKADEMIK = "ou-c1-akd";

    before(async () => {
      // 1. Relational MataPelajaran
      await prisma.mataPelajaran.createMany({
        data: [
          { id: MAT_MAPEL_ID, nama: "Matematika", kodeMapel: "MAT", kategori: "UMUM" },
          { id: ARB_MAPEL_ID, nama: "Bahasa Arab", kodeMapel: "ARB", kategori: "DINIYAH" },
          { id: FQH_MAPEL_ID, nama: "Fikih", kodeMapel: "FQH", kategori: "DINIYAH" },
        ],
      });

      // 2. Relational Cohorts
      await prisma.educationCohort.createMany({
        data: [
          { id: COHORT_1_ID, code: "TINGKAT_1", startYear: 2026, tahunAjaranMasuk: "2026/2027" },
          { id: COHORT_2_ID, code: "TINGKAT_2", startYear: 2025, tahunAjaranMasuk: "2025/2026" },
        ],
      });

      // 3. Relational Staff
      await prisma.staff.createMany({
        data: [
          { id: STF_AHMAD, staffCode: "STF-C1-01", nama: "Ust. Ahmad", noHp: "081100000001", roleStaff: "GA", status: "AKTIF" },
          { id: STF_ZAID, staffCode: "STF-C1-02", nama: "Ust. Zaid", noHp: "081100000002", roleStaff: "GA", status: "AKTIF" },
          { id: STF_ABI, staffCode: "STF-C1-03", nama: "Ust. Abi Hudzaifah", noHp: "081100000003", roleStaff: "GA", status: "AKTIF" },
          { id: STF_KAMAL, staffCode: "STF-C1-04", nama: "Ust. Kamal Mukhtar", noHp: "081100000004", roleStaff: "GA", status: "AKTIF" },
          { id: STF_ANDI, staffCode: "STF-C1-05", nama: "Ust. Andi Quarzy Ayatullah", noHp: "081100000005", roleStaff: "GA", status: "AKTIF" },
          { id: STF_LISA, staffCode: "STF-C1-06", nama: "Ustazah Lisa Dwina Fitri", noHp: "081100000006", roleStaff: "GA", status: "AKTIF" },
        ],
      });

      // 4. Relational Users linked to Staff
      await prisma.user.createMany({
        data: [
          { id: USR_AHMAD, username: "guru.ahmad", staffId: STF_AHMAD, status: "AKTIF", role: "GA", passwordHash: "dummy" },
          { id: USR_ZAID, username: "guru.zaid", staffId: STF_ZAID, status: "AKTIF", role: "GA", passwordHash: "dummy" },
          { id: USR_ABI, username: "guru.abi", staffId: STF_ABI, status: "AKTIF", role: "GA", passwordHash: "dummy" },
          { id: USR_LISA, username: "guru.lisa", staffId: STF_LISA, status: "AKTIF", role: "GA", passwordHash: "dummy" },
        ],
      });

      // 5. OrgUnit & Position
      await prisma.orgUnit.create({
        data: { id: OU_AKADEMIK, code: "OU-AKADEMIK", name: "Unit Akademik", type: "SERVICE_UNIT", domain: "AKADEMIK", genderComplex: "PUTRA" },
      });
      await prisma.position.create({
        data: { id: POS_GURU, code: "GURU_AKADEMIK", name: "Guru Akademik", domain: "AKADEMIK" },
      });

      // Capabilities
      const capCodes = [
        "academic.schedule.read",
        "academic.session.start",
        "academic.material.record",
        "academic.attendance.record",
      ];
      for (const c of capCodes) {
        await prisma.capability.upsert({
          where: { code: c },
          update: {},
          create: { code: c, name: c, namespace: "ACADEMIC", description: c },
        });
        await prisma.positionCapability.upsert({
          where: { positionId_capabilityCode: { positionId: POS_GURU, capabilityCode: c } },
          update: {},
          create: {
            positionId: POS_GURU,
            capabilityCode: c,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        });
      }

      // User assignments
      for (const uid of [USR_AHMAD, USR_ZAID, USR_ABI, USR_LISA]) {
        await prisma.assignment.create({
          data: {
            userId: uid,
            positionId: POS_GURU,
            unitId: OU_AKADEMIK,
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            createdById: uid,
          },
        });
      }

      // 6. Teaching Assignments
      await prisma.teachingAssignment.createMany({
        data: [
          { id: "ta-mat-ahmad", mapelId: MAT_MAPEL_ID, staffId: STF_AHMAD, educationTrack: "STUDI_UMUM", genderComplex: "PUTRA", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-abi", mapelId: ARB_MAPEL_ID, staffId: STF_ABI, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_1", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-kamal", mapelId: ARB_MAPEL_ID, staffId: STF_KAMAL, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_2", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-andi", mapelId: ARB_MAPEL_ID, staffId: STF_ANDI, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRA", pedagogicalLevel: "TINGKAT_3", isActive: true, validFrom: new Date(Date.now() - 86400000) },
          { id: "ta-arb-lisa", mapelId: ARB_MAPEL_ID, staffId: STF_LISA, educationTrack: "KEPESANTRENAN", genderComplex: "PUTRI", isActive: true, validFrom: new Date(Date.now() - 86400000) },
        ],
      });

      // 7. Seed Colliding & Distinct EducationSessions
      // 1) Same subject, different date (2026-09-21 vs 2026-09-22)
      await prisma.educationSession.createMany({
        data: [
          {
            id: "sess-col-date-1",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            scheduledTeacherAssignmentId: "ta-mat-ahmad",
            status: "SCHEDULED",
          },
          {
            id: "sess-col-date-2",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-22T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 2,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            scheduledTeacherAssignmentId: "ta-mat-ahmad",
            status: "SCHEDULED",
          },
          // 2) Same subject, same date, different cohort (Tingkat 1 vs Tingkat 2)
          {
            id: "sess-col-coh-1",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-23T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 3,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            status: "SCHEDULED",
          },
          {
            id: "sess-col-coh-2",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-23T00:00:00Z"),
            cohortId: COHORT_2_ID,
            programLevel: 2,
            jp: 1,
            semesterMeetingNumber: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ZAID,
            status: "SCHEDULED",
          },
          // 3) Same subject, same date, same cohort, different JP (JP 1 vs JP 2)
          {
            id: "sess-col-jp-1",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-24T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            semesterMeetingNumber: 4,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            status: "SCHEDULED",
          },
          {
            id: "sess-col-jp-2",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-24T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 2,
            semesterMeetingNumber: 5,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_AHMAD,
            status: "SCHEDULED",
          },
          // 4) Bahasa Arab PUTRA T1
          {
            id: "sess-kps-arb-t1",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            programLevel: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ABI,
            scheduledTeacherAssignmentId: "ta-arb-abi",
            status: "SCHEDULED",
          },
          // 5) Bahasa Arab PUTRA T2
          {
            id: "sess-kps-arb-t2",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            programLevel: 2,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_KAMAL,
            scheduledTeacherAssignmentId: "ta-arb-kamal",
            status: "SCHEDULED",
          },
          // 6) Bahasa Arab PUTRA T3
          {
            id: "sess-kps-arb-t3",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            programLevel: 3,
            genderGroup: "PUTRA",
            scheduledStaffId: STF_ANDI,
            scheduledTeacherAssignmentId: "ta-arb-andi",
            status: "SCHEDULED",
          },
          // 7) PUTRI session
          {
            id: "sess-kps-putri",
            educationTrack: "KEPESANTRENAN",
            subjectId: ARB_MAPEL_ID,
            scheduledDate: new Date("2026-09-21T00:00:00Z"),
            genderGroup: "PUTRI",
            scheduledStaffId: STF_LISA,
            scheduledTeacherAssignmentId: "ta-arb-lisa",
            status: "SCHEDULED",
          },
          // 8) Missing scheduled teacher session
          {
            id: "sess-no-teacher",
            educationTrack: "STUDI_UMUM",
            subjectId: MAT_MAPEL_ID,
            scheduledDate: new Date("2026-09-25T00:00:00Z"),
            cohortId: COHORT_1_ID,
            programLevel: 1,
            jp: 1,
            genderGroup: "PUTRA",
            status: "SCHEDULED",
          },
        ],
      });
    });

    it("3.1 Unauthenticated getEducationSessions strictly throws AUTHENTICATION_REQUIRED", async () => {
      await assert.rejects(
        async () => service.getEducationSessions(),
        /AUTHENTICATION_REQUIRED/
      );
      await assert.rejects(
        async () => service.getEducationSessions(undefined, { actorUserId: "" }),
        /AUTHENTICATION_REQUIRED/
      );
    });

    it("3.2 Authenticated read returns real relational subject name, code, and teacher display", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });
      assert.ok(dtos.length >= 8);

      const matSession = dtos.find((d) => d.sessionId === "sess-col-date-1");
      assert.ok(matSession);
      assert.strictEqual(matSession.subject, "Matematika");
      assert.strictEqual(matSession.subjectCode, "MAT");
      assert.strictEqual(matSession.scheduledTeacherDisplay, "Ust. Ahmad");
      assert.strictEqual(matSession.scheduledStaffId, STF_AHMAD);
    });

    it("3.3 WITA date filter operates accurately across date boundaries", async () => {
      const dtos21 = await service.getEducationSessions({ date: "2026-09-21" }, { actorUserId: USR_AHMAD });
      const ids21 = dtos21.map((d) => d.sessionId);
      assert.ok(ids21.includes("sess-col-date-1"));
      assert.ok(!ids21.includes("sess-col-date-2"), "Must not leak 2026-09-22 session into 2026-09-21 filter");

      const dtos22 = await service.getEducationSessions({ date: "2026-09-22" }, { actorUserId: USR_AHMAD });
      const ids22 = dtos22.map((d) => d.sessionId);
      assert.ok(ids22.includes("sess-col-date-2"));
      assert.ok(!ids22.includes("sess-col-date-1"));
    });

    it("3.4 Collision Case 1: Same subject, different dates resolved without first-record ambiguity", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchDate1 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-21",
        subjectName: "Matematika",
        jp: 1,
        programLevel: 1,
      });
      assert.ok(matchDate1);
      assert.strictEqual(matchDate1.sessionId, "sess-col-date-1");

      const matchDate2 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-22",
        subjectName: "Matematika",
        jp: 1,
        programLevel: 1,
      });
      assert.ok(matchDate2);
      assert.strictEqual(matchDate2.sessionId, "sess-col-date-2");
    });

    it("3.5 Collision Case 2: Same subject, same date, different cohorts resolved strictly", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchCoh1 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-23",
        subjectName: "Matematika",
        cohortId: COHORT_1_ID,
      });
      assert.ok(matchCoh1);
      assert.strictEqual(matchCoh1.sessionId, "sess-col-coh-1");

      const matchCoh2 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-23",
        subjectName: "Matematika",
        cohortId: COHORT_2_ID,
      });
      assert.ok(matchCoh2);
      assert.strictEqual(matchCoh2.sessionId, "sess-col-coh-2");
    });

    it("3.6 Collision Case 3: Same subject, same date, same cohort, different JP resolved strictly", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchJp1 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-24",
        subjectName: "Matematika",
        jp: 1,
      });
      assert.ok(matchJp1);
      assert.strictEqual(matchJp1.sessionId, "sess-col-jp-1");

      const matchJp2 = matchStudiUmumSession(dtos, {
        scheduledDate: "2026-09-24",
        subjectName: "Matematika",
        jp: 2,
      });
      assert.ok(matchJp2);
      assert.strictEqual(matchJp2.sessionId, "sess-col-jp-2");
    });

    it("3.7 Collision Cases 4, 5, 6: Bahasa Arab PUTRA Tingkat 1, 2, 3 distinguished without ambiguity", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchT1 = matchKepesantrenanSession(dtos, {
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_1",
      });
      assert.ok(matchT1);
      assert.strictEqual(matchT1.sessionId, "sess-kps-arb-t1");
      assert.strictEqual(matchT1.scheduledTeacherDisplay, "Ust. Abi Hudzaifah");

      const matchT2 = matchKepesantrenanSession(dtos, {
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_2",
      });
      assert.ok(matchT2);
      assert.strictEqual(matchT2.sessionId, "sess-kps-arb-t2");
      assert.strictEqual(matchT2.scheduledTeacherDisplay, "Ust. Kamal Mukhtar");

      const matchT3 = matchKepesantrenanSession(dtos, {
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRA",
        pedagogicalLevel: "TINGKAT_3",
      });
      assert.ok(matchT3);
      assert.strictEqual(matchT3.sessionId, "sess-kps-arb-t3");
      assert.strictEqual(matchT3.scheduledTeacherDisplay, "Ust. Andi Quarzy Ayatullah");
    });

    it("3.8 Collision Case 7: PUTRI session and strict gender isolation (No gender aliasing)", async () => {
      const dtos = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });

      const matchPutri = matchKepesantrenanSession(dtos, {
        subjectName: "Bahasa Arab",
        genderGroup: "PUTRI",
      });
      assert.ok(matchPutri);
      assert.strictEqual(matchPutri.sessionId, "sess-kps-putri");
      assert.strictEqual(matchPutri.genderGroup, "PUTRI");
      assert.strictEqual(matchPutri.scheduledTeacherDisplay, "Ustazah Lisa Dwina Fitri");

      // Searching for PUTRI must NEVER return PUTRA
      const leakCheck = matchKepesantrenanSession(
        dtos.filter((d) => d.genderGroup === "PUTRI"),
        { subjectName: "Bahasa Arab", genderGroup: "PUTRA" }
      );
      assert.strictEqual(leakCheck, undefined);
    });

    it("3.9 Authorization proof: Scheduled teacher => mutationAvailable true; wrong/missing teacher => false", async () => {
      // 1. Correct authorized scheduled teacher (Ust. Ahmad for sess-col-date-1)
      const dtosAhmad = await service.getEducationSessions(undefined, { actorUserId: USR_AHMAD });
      const ahmadSess = dtosAhmad.find((d) => d.sessionId === "sess-col-date-1");
      assert.ok(ahmadSess);
      assert.strictEqual(ahmadSess.mutationAvailable, true);
      assert.strictEqual(ahmadSess.mutationDeniedReason, null);

      // 2. Wrong teacher (Ust. Zaid calling sess-col-date-1 where scheduled teacher is Ust. Ahmad)
      const dtosZaid = await service.getEducationSessions(undefined, { actorUserId: USR_ZAID });
      const zaidSess = dtosZaid.find((d) => d.sessionId === "sess-col-date-1");
      assert.ok(zaidSess);
      assert.strictEqual(zaidSess.mutationAvailable, false);
      assert.strictEqual(zaidSess.mutationDeniedReason, "SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED");

      // 3. Missing scheduled teacher (sess-no-teacher)
      const noTeacherSess = dtosAhmad.find((d) => d.sessionId === "sess-no-teacher");
      assert.ok(noTeacherSess);
      assert.strictEqual(noTeacherSess.mutationAvailable, false);
      assert.strictEqual(noTeacherSess.mutationDeniedReason, "SCHEDULED_TEACHER_NOT_RESOLVED");
    });
  });
});
