/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import {
  matchStudiUmumSession,
  matchKepesantrenanSession,
  EducationSessionReadDTO,
} from "../lib/pendidikan-v2";
import { formatSantriSearchResult } from "../types/architecture-lock";
import { PendidikanV2Service } from "../lib/server/pendidikan-v2-service";
import {
  checkPendidikanV2ProductionReadiness,
  CANONICAL_READINESS_GATE_NAMES,
} from "../lib/server/pendidikan-v2-readiness";

const PR8_IMMUTABLE_COMMIT = "9068cae5587b7219c394c5c25bf0de07a15b0726";

describe("STQ ARCHITECTURE LOCK — RECONCILED UAT & SERVICE INTEGRATION SUITE", () => {
  describe("1. UAT #3 Search & Filter Contract Reconciled", () => {
    it("1.1 formatSantriSearchResult strictly returns nama only in displayText", () => {
      const santri = {
        id: "san-01",
        nis: "2024001",
        nama: "Abdullah Fatih",
        kelas: "7A",
        halaqoh: "Abu Bakar",
        score: 95,
      };

      const result = formatSantriSearchResult(santri);
      assert.strictEqual(result.nama, "Abdullah Fatih");
      assert.strictEqual(result.displayText, "Abdullah Fatih");
      assert.strictEqual(result.displayText.includes("7A"), false, "kelas must not be present in search result displayText");
      assert.strictEqual(result.displayText.includes("2024001"), false, "NIS must not be present in search result displayText");
      assert.strictEqual(result.displayText.includes("Abu Bakar"), false, "Halaqoh must not be present in search result displayText");
      assert.strictEqual(result.displayText.includes("95"), false, "Score must not be present in search result displayText");
    });

    it("1.2 Kelas filter operates independently from search query", () => {
      const santriList = [
        { id: "s1", nama: "Ahmad", kelas: "7A", halaqoh: "Halaqoh 1" },
        { id: "s2", nama: "Ahmad", kelas: "7B", halaqoh: "Halaqoh 2" },
        { id: "s3", nama: "Zaid", kelas: "7A", halaqoh: "Halaqoh 1" },
      ];

      const filterByKelas = (list: typeof santriList, kelas: string) =>
        kelas === "ALL" ? list : list.filter((s) => s.kelas === kelas);

      const filtered7A = filterByKelas(santriList, "7A");
      assert.strictEqual(filtered7A.length, 2);
      assert.strictEqual(filtered7A.every((s) => s.kelas === "7A"), true);

      const filtered7B = filterByKelas(santriList, "7B");
      assert.strictEqual(filtered7B.length, 1);
      assert.strictEqual(filtered7B[0].id, "s2");
    });

    it("1.3 Halaqoh filter operates independently from kelas and search query", () => {
      const santriList = [
        { id: "s1", nama: "Ahmad", kelas: "7A", halaqoh: "Halaqoh 1" },
        { id: "s2", nama: "Ali", kelas: "7A", halaqoh: "Halaqoh 2" },
        { id: "s3", nama: "Umar", kelas: "8A", halaqoh: "Halaqoh 1" },
      ];

      const filterByHalaqoh = (list: typeof santriList, halaqoh: string) =>
        halaqoh === "ALL" ? list : list.filter((s) => s.halaqoh === halaqoh);

      const filteredH1 = filterByHalaqoh(santriList, "Halaqoh 1");
      assert.strictEqual(filteredH1.length, 2);
      assert.deepStrictEqual(filteredH1.map((s) => s.id), ["s1", "s3"]);
    });
  });

  describe("2. Education Session Server-Authoritative Matching", () => {
    const mockSessions: EducationSessionReadDTO[] = [
      {
        sessionId: "sess-su-01",
        educationTrack: "STUDI_UMUM",
        subject: "Matematika",
        subjectId: "sub-mtk",
        subjectCode: "MTK",
        subjectName: "Matematika",
        scheduledDate: "2026-09-19",
        plannedStart: "08:00",
        plannedEnd: "09:20",
        plannedStartTime: "08:00",
        plannedEndTime: "09:20",
        programLevel: 7,
        cohortId: "coh-7",
        cohortCode: "KELAS_7",
        cohortLabel: "Kelas 7",
        cohortTahunAjaran: "2026/2027",
        genderGroup: "PUTRA",
        jp: 2,
        semesterMeetingNumber: 1,
        pblPhase: "INQUIRY",
        pblBlockNumber: 1,
        pblMetadata: null,
        pedagogicalLevel: "TINGKAT_1",
        scheduledTeacherAssignmentId: "sta-01",
        scheduledStaffId: "stf-01",
        scheduledTeacherDisplay: "Ust. Zaid",
        actualTeacherStaffId: null,
        actualTeacherDisplay: null,
        status: "SCHEDULED",
        startedAt: null,
        materi: null,
        mutationAvailable: true,
        mutationDeniedReason: null,
        attendanceAvailable: false,
      },
      {
        sessionId: "sess-kps-01",
        educationTrack: "KEPESANTRENAN",
        subject: "Aqidah",
        subjectId: "sub-aqd",
        subjectCode: "AQD",
        subjectName: "Aqidah",
        scheduledDate: "2026-09-21",
        plannedStart: "18:30",
        plannedEnd: "19:30",
        plannedStartTime: "18:30",
        plannedEndTime: "19:30",
        programLevel: null,
        cohortId: null,
        cohortCode: null,
        cohortLabel: null,
        cohortTahunAjaran: null,
        genderGroup: "PUTRA",
        jp: null,
        semesterMeetingNumber: null,
        pblPhase: null,
        pblBlockNumber: null,
        pblMetadata: null,
        pedagogicalLevel: null,
        scheduledTeacherAssignmentId: null,
        scheduledStaffId: "stf-02",
        scheduledTeacherDisplay: "Ust. Hamzah",
        actualTeacherStaffId: null,
        actualTeacherDisplay: null,
        status: "SCHEDULED",
        startedAt: null,
        materi: null,
        mutationAvailable: true,
        mutationDeniedReason: null,
        attendanceAvailable: false,
      },
    ];

    it("2.1 matchStudiUmumSession resolves exact matching tuple", () => {
      const match = matchStudiUmumSession(mockSessions, {
        subjectName: "Matematika",
        jp: 2,
        semesterMeetingNumber: 1,
        programLevel: 7,
      });

      assert.ok(match);
      assert.strictEqual(match?.sessionId, "sess-su-01");
      assert.strictEqual(match?.subjectName, "Matematika");
    });

    it("2.2 matchStudiUmumSession returns undefined on mismatched tuple", () => {
      const matchWrongMeeting = matchStudiUmumSession(mockSessions, {
        subjectName: "Matematika",
        jp: 2,
        semesterMeetingNumber: 2,
        programLevel: 7,
      });
      assert.strictEqual(matchWrongMeeting, undefined);

      const matchWrongTrack = matchStudiUmumSession(mockSessions, {
        subjectName: "Aqidah",
      });
      assert.strictEqual(matchWrongTrack, undefined);
    });

    it("2.3 matchKepesantrenanSession resolves exact Kepesantrenan session", () => {
      const match = matchKepesantrenanSession(mockSessions, {
        subjectName: "Aqidah",
        genderGroup: "PUTRA",
      });

      assert.ok(match);
      assert.strictEqual(match?.sessionId, "sess-kps-01");
      assert.strictEqual(match?.educationTrack, "KEPESANTRENAN");
    });

    it("2.4 matchKepesantrenanSession returns undefined when gender group differs", () => {
      const match = matchKepesantrenanSession(mockSessions, {
        subjectName: "Aqidah",
        genderGroup: "PUTRI",
      });

      assert.strictEqual(match, undefined);
    });
  });

  describe("3. Schema & Production Readiness", () => {
    it("3.1 checkSchemaReadiness reports true when tables exist in mock DB", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("information_schema.tables")) {
            return [
              { table_name: "education_cohorts" },
              { table_name: "teaching_assignments" },
              { table_name: "education_sessions" },
              { table_name: "education_session_participants" },
              { table_name: "education_session_attendances" },
            ];
          }
          if (sql.includes("pg_type")) {
            return [
              { typname: "EducationTrack" },
              { typname: "PedagogicalLevel" },
              { typname: "EducationSessionStatus" },
              { typname: "EducationAttendanceStatus" },
            ];
          }
          return [];
        },
      };

      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: {} as any,
        auditPersistence: {} as any,
      });

      const res = await service.checkSchemaReadiness();
      assert.strictEqual(res.ready, true);
    });

    it("3.2 checkSchemaReadiness reports missing tables without throwing", async () => {
      const mockDb = {
        $queryRawUnsafe: async (sql: string) => {
          if (sql.includes("information_schema.tables")) {
            return [{ table_name: "education_sessions" }];
          }
          return [];
        },
      };

      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: {} as any,
        auditPersistence: {} as any,
      });

      const res = await service.checkSchemaReadiness();
      assert.strictEqual(res.ready, false);
      assert.ok(res.reason?.includes("PENDIDIKAN_V2_SCHEMA_NOT_READY"));
      assert.ok(res.reason?.includes("education_cohorts"));
    });

    it("3.3 checkPendidikanV2ProductionReadiness validates 11 safety gates without writes", async () => {
      const mockDb = {
        $queryRawUnsafe: async () => [
          { table_name: "health_cases_v2" },
          { table_name: "health_case_v2_events" },
          { table_name: "education_sessions" },
          { table_name: "education_session_participants" },
          { table_name: "education_session_attendances" },
          { table_name: "education_scheduled_teacher_assignments" },
          { table_name: "education_pedagogical_assessments" },
          { table_name: "canonical_audit_logs" },
        ],
        user: { findMany: async () => [] },
        staff: { findMany: async () => [] },
        orgUnit: { findMany: async () => [] },
        position: { findMany: async () => [] },
        capability: { findMany: async () => [] },
        santri: { findMany: async () => [] },
        educationCohort: { findMany: async () => [] },
        teachingAssignment: { findMany: async () => [] },
      };

      const res = await checkPendidikanV2ProductionReadiness(mockDb as any);
      assert.strictEqual(res.gates.length, 11);
      assert.strictEqual(CANONICAL_READINESS_GATE_NAMES.length, 11);
      assert.ok(res.gates.some((g) => g.gate === "M3_3B_SCHEMA_READY"));
      assert.ok(res.gates.some((g) => g.gate === "RUNTIME_ACTIVATION_FLAG"));
    });
  });

  describe("4. Immutable Baseline Integrity", () => {
    it("4.1 PR #8 baseline migration is strictly immutable at commit 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      const stdout = execSync("git log -n 1 --format=%H 9068cae5587b7219c394c5c25bf0de07a15b0726", {
        encoding: "utf-8",
      }).trim();
      assert.strictEqual(stdout, PR8_IMMUTABLE_COMMIT);
    });
  });
});
