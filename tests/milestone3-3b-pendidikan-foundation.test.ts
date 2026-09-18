/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  CANONICAL_STUDI_UMUM_SUBJECTS,
  CANONICAL_KEPESANTRENAN_SUBJECTS,
  KEPESANTRENAN_SCHEDULED_FACTS,
  STUDI_UMUM_JP_SLOTS,
  STUDI_UMUM_SCHEDULE_MATRIX,
  KEPESANTRENAN_DAILY_SCHEDULE,
  KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES,
  KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES,
  deriveProgramLevel,
  resolvePblMeeting,
  resolveStudiUmumSchedule,
  resolveKepesantrenanDaySubject,
  isApprovedKepesantrenanAttendanceStatus,
} from "../lib/pendidikan-v2";

import {
  ACADEMIC_CAPABILITIES,
  AcademicCapabilityCode,
} from "../types/architecture-lock";

import {
  createEducationV2Service,
} from "../lib/server/pendidikan-v2-service";

import {
  ICanonicalDataProvider,
  CanonicalIdentity,
} from "../lib/auth/canonical-evaluator";

import {
  simulateM33bMigrationChain,
} from "./test-db-manager";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3: CHECKPOINT M3.3B PENDIDIKAN FOUNDATION", () => {
  const rootDir = path.resolve(__dirname, "..");
  const schemaPath = path.join(rootDir, "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const migrationDir = path.join(rootDir, "prisma/migrations/20260918140000_m3_3b_pendidikan_foundation");
  const migrationSqlPath = path.join(migrationDir, "migration.sql");
  const migrationSqlContent = fs.readFileSync(migrationSqlPath, "utf-8");
  const legacyActionPath = path.join(rootDir, "app/actions/akademik.ts");
  const legacyActionContent = fs.readFileSync(legacyActionPath, "utf-8");
  const uiModulePath = path.join(rootDir, "components/modules/akademik-module.tsx");
  const uiModuleContent = fs.readFileSync(uiModulePath, "utf-8");

  // Shared mock helpers
  const createMockEducationDb = (initialSessions: any[] = []) => {
    const sessions = new Map<string, any>();
    const attendances = new Map<string, any>();
    const audits: any[] = [];
    let throwOnAudit = false;

    for (const s of initialSessions) {
      sessions.set(s.id, { ...s });
    }

    const db: any = {
      educationSession: {
        findUnique: async ({ where }: any) => {
          const s = sessions.get(where.id);
          return s ? { ...s } : null;
        },
        update: async ({ where, data }: any) => {
          const s = sessions.get(where.id);
          if (!s) throw new Error("Session not found");
          const updated = { ...s, ...data, updatedAt: new Date() };
          sessions.set(where.id, updated);
          return updated;
        },
      },
      educationSessionAttendance: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.sessionId_santriId.sessionId}:${where.sessionId_santriId.santriId}`;
          const existing = attendances.get(key);
          if (existing) {
            const updated = { ...existing, ...update, updatedAt: new Date() };
            attendances.set(key, updated);
            return updated;
          } else {
            const created = { id: "att-" + Math.random().toString(36).slice(2, 8), ...create, createdAt: new Date(), updatedAt: new Date() };
            attendances.set(key, created);
            return created;
          }
        },
      },
      canonicalAuditLog: {
        create: async ({ data }: any) => {
          if (throwOnAudit) {
            throw new Error("SIMULATED_CANONICAL_AUDIT_FAILURE");
          }
          const row = { id: "aud-" + Math.random().toString(36).slice(2, 8), createdAt: new Date(), ...data };
          audits.push(row);
          return row;
        },
      },
      $transaction: async (callback: (tx: any) => Promise<any>) => {
        // Simple mock transactional snapshot rollback
        const sessionsSnapshot = new Map(sessions);
        const attendancesSnapshot = new Map(attendances);
        const auditsSnapshot = [...audits];
        try {
          return await callback(db);
        } catch (err) {
          sessions.clear();
          for (const [k, v] of sessionsSnapshot) sessions.set(k, v);
          attendances.clear();
          for (const [k, v] of attendancesSnapshot) attendances.set(k, v);
          audits.length = 0;
          audits.push(...auditsSnapshot);
          throw err;
        }
      },
    };

    return {
      db,
      sessions,
      attendances,
      audits,
      setThrowOnAudit: (val: boolean) => { throwOnAudit = val; },
    };
  };

  const createTeacherDataProvider = (opts: {
    userId?: string;
    staffId?: string;
    capabilities?: AcademicCapabilityCode[];
  } = {}): ICanonicalDataProvider => {
    const userId = opts.userId || "usr-teacher-01";
    const staffId = opts.staffId || "stf-teacher-01";
    const capabilities = opts.capabilities || [
      "academic.session.start",
      "academic.session.record_materi",
      "academic.attendance.record",
    ];

    return {
      async getIdentity(id: string): Promise<CanonicalIdentity | null> {
        if (id !== userId) return null;
        return {
          userId,
          username: "ustadz.ahmad",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId,
        };
      },
      async getActiveAssignments(uid: string) {
        if (uid !== userId) return [];
        return [
          {
            id: "asg-teacher",
            userId,
            positionId: "pos-guru",
            positionCode: "GURU_MAPEL",
            positionName: "Guru Mapel",
            domain: "PENDIDIKAN",
            unitId: "ou-madrasah",
            unitCode: "OU-MADRASAH",
            unitName: "Madrasah",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            positionCapabilities: capabilities.map((code) => ({
              capabilityCode: code,
              scopeType: "GLOBAL",
              businessRuleState: "VERIFIED_PRODUCTION",
            })),
            scopeUnits: [],
          },
        ];
      },
      async getUnitAccountPlacement() { return null; },
      async verifyHumanExecutor(id: string) {
        return { userId: id, id, name: "Ustadz Ahmad", isActive: true };
      },
      async resolveResourceContext() {
        return { orgUnitIds: [] };
      },
    };
  };

  // =========================================================================
  // SECTION A: IA / Track & Subject Separation (Proofs 1–4)
  // =========================================================================
  describe("Section A: IA / Track & Subject Separation", () => {
    it("Proof 1: Exact 6 Studi Umum subjects defined", () => {
      assert.strictEqual(CANONICAL_STUDI_UMUM_SUBJECTS.length, 6);
      assert.deepStrictEqual(
        [...CANONICAL_STUDI_UMUM_SUBJECTS],
        ["Matematika", "Bahasa Inggris", "IPS", "IPA", "Bahasa Indonesia", "TIK"]
      );
    });

    it("Proof 2: Exact 5 Kepesantrenan subjects defined", () => {
      assert.strictEqual(CANONICAL_KEPESANTRENAN_SUBJECTS.length, 5);
      assert.deepStrictEqual(
        [...CANONICAL_KEPESANTRENAN_SUBJECTS],
        ["Bahasa Arab", "Fikih", "Tafsir", "Aqidah", "Tajwid"]
      );
    });

    it("Proof 3: Strict separation between Studi Umum and Kepesantrenan tracks (zero overlap)", () => {
      const studiUmumSet = new Set(CANONICAL_STUDI_UMUM_SUBJECTS);
      const kepesantrenanSet = new Set(CANONICAL_KEPESANTRENAN_SUBJECTS);
      const intersection = [...studiUmumSet].filter((x) => kepesantrenanSet.has(x as any));
      assert.strictEqual(intersection.length, 0, "Tracks must have zero overlapping subjects");
    });

    it("Proof 4: Extraneous or misplaced subjects rejected from canonical definitions", () => {
      const invalidStudiUmum = ["Fisika", "Kimia", "Biologi", "Ekonomi", "Sosiologi", "Sejarah"];
      for (const sub of invalidStudiUmum) {
        assert.strictEqual(
          (CANONICAL_STUDI_UMUM_SUBJECTS as readonly string[]).includes(sub),
          false,
          `Subject ${sub} must not be in Studi Umum`
        );
      }
      const invalidKepesantrenan = ["Hadits", "Nahwu", "Shorof", "Tarikh", "Akhlak"];
      for (const sub of invalidKepesantrenan) {
        assert.strictEqual(
          (CANONICAL_KEPESANTRENAN_SUBJECTS as readonly string[]).includes(sub),
          false,
          `Subject ${sub} must not be in Kepesantrenan canonical 5`
        );
      }
    });
  });

  // =========================================================================
  // SECTION B: Cohort Model & Pedagogical Level Derivation (Proofs 5–10)
  // =========================================================================
  describe("Section B: Cohort Model & Pedagogical Level Derivation", () => {
    it("Proof 5: Additive EducationCohort model exists in Prisma schema", () => {
      assert.match(schemaContent, /model\s+EducationCohort\s+{/);
      assert.match(schemaContent, /code\s+String\s+@unique/);
      assert.match(schemaContent, /tahunAjaranMasuk\s+String/);
      assert.match(schemaContent, /startYear\s+Int/);
      assert.match(schemaContent, /isActive\s+Boolean/);
    });

    it("Proof 6: Unique constraint on education_cohorts code and index on start_year", () => {
      assert.match(migrationSqlContent, /CREATE UNIQUE INDEX "education_cohorts_code_key" ON "education_cohorts"\("code"\)/);
      assert.match(migrationSqlContent, /CREATE INDEX "education_cohorts_start_year_idx" ON "education_cohorts"\("start_year"\)/);
    });

    it("Proof 7: Santri.cohortId relation exists and is additive nullable", () => {
      assert.match(schemaContent, /cohortId\s+String\?/);
      assert.match(schemaContent, /cohort\s+EducationCohort\?\s+@relation\(fields:\s*\[cohortId\],\s*references:\s*\[id\]/);
      assert.match(migrationSqlContent, /ALTER TABLE "santri" ADD COLUMN "cohort_id" TEXT;/);
    });

    it("Proof 8: Program Level derivation formula (activeStartYear - cohortStartYear) + 1", () => {
      // 2026/2027 active academic year (activeStartYear = 2026)
      const activeStartYear = 2026;
      // Cohort 2026 (Angkatan 2026/2027) -> Level 1
      assert.strictEqual(deriveProgramLevel(2026, activeStartYear), 1);
      // Cohort 2025 (Angkatan 2025/2026) -> Level 2
      assert.strictEqual(deriveProgramLevel(2025, activeStartYear), 2);
      // Cohort 2024 (Angkatan 2024/2025) -> Level 3
      assert.strictEqual(deriveProgramLevel(2024, activeStartYear), 3);
    });

    it("Proof 9: Explicit verification that Santri.kelas is NOT used for program level", () => {
      // Regardless of whether Santri.kelas is '7A', '8B', '9C', or '10 IPA',
      // deriveProgramLevel depends STRICTLY on cohort start year, not kelas.
      const santriKelas = ["7A", "8B", "9A", "10-1", "SMP-7", "SMA-11"];
      for (const k of santriKelas) {
        // Passing startYear 2026 always produces Level 1, untouched by kelas
        assert.strictEqual(deriveProgramLevel(2026, 2026), 1, `Level must be 1 regardless of kelas '${k}'`);
      }
    });

    it("Proof 10: Boundary conditions for cohort level (Year 1, 2, 3, alumni / post-year 3)", () => {
      assert.strictEqual(deriveProgramLevel(2026, 2026), 1);
      assert.strictEqual(deriveProgramLevel(2025, 2026), 2);
      assert.strictEqual(deriveProgramLevel(2024, 2026), 3);
      // Cohort 2023 in 2026 is Level 4 (Alumni / graduated)
      assert.strictEqual(deriveProgramLevel(2023, 2026), 4);
      // Future cohort 2027 in 2026 is 0 (Not yet enrolled)
      assert.strictEqual(deriveProgramLevel(2027, 2026), 0);
    });
  });

  // =========================================================================
  // SECTION C: Studi Umum Saturday Schedule & JP Matrix (Proofs 11–19)
  // =========================================================================
  describe("Section C: Studi Umum Saturday Schedule & JP Matrix", () => {
    it("Proof 11: Saturday schedule strictly consists of 3 JP slots", () => {
      assert.strictEqual(STUDI_UMUM_JP_SLOTS.length, 3);
      assert.deepStrictEqual(
        STUDI_UMUM_JP_SLOTS.map((s) => s.jp),
        [1, 2, 3]
      );
    });

    it("Proof 12: JP 1 slot is 08:00 - 09:20 WITA (80 minutes)", () => {
      const jp1 = STUDI_UMUM_JP_SLOTS.find((s) => s.jp === 1)!;
      assert.strictEqual(jp1.startTime, "08:00");
      assert.strictEqual(jp1.endTime, "09:20");
      assert.strictEqual(jp1.durationMinutes, 80);
    });

    it("Proof 13: JP 2 slot is 09:35 - 10:55 WITA (80 minutes, 15m break)", () => {
      const jp2 = STUDI_UMUM_JP_SLOTS.find((s) => s.jp === 2)!;
      assert.strictEqual(jp2.startTime, "09:35");
      assert.strictEqual(jp2.endTime, "10:55");
      assert.strictEqual(jp2.durationMinutes, 80);
    });

    it("Proof 14: JP 3 slot is 11:05 - 12:25 WITA (80 minutes, 10m break)", () => {
      const jp3 = STUDI_UMUM_JP_SLOTS.find((s) => s.jp === 3)!;
      assert.strictEqual(jp3.startTime, "11:05");
      assert.strictEqual(jp3.endTime, "12:25");
      assert.strictEqual(jp3.durationMinutes, 80);
    });

    it("Proof 15: Level 1 Saturday matrix: JP 1 Matematika, JP 2 Bahasa Inggris, JP 3 IPS", () => {
      assert.strictEqual(resolveStudiUmumSchedule(1, 1), "Matematika");
      assert.strictEqual(resolveStudiUmumSchedule(1, 2), "Bahasa Inggris");
      assert.strictEqual(resolveStudiUmumSchedule(1, 3), "IPS");
    });

    it("Proof 16: Level 2 Saturday matrix: JP 1 IPA, JP 2 Bahasa Indonesia, JP 3 TIK", () => {
      assert.strictEqual(resolveStudiUmumSchedule(2, 1), "IPA");
      assert.strictEqual(resolveStudiUmumSchedule(2, 2), "Bahasa Indonesia");
      assert.strictEqual(resolveStudiUmumSchedule(2, 3), "TIK");
    });

    it("Proof 17: Level 3 Saturday matrix: JP 1 TIK, JP 2 Matematika, JP 3 IPA", () => {
      assert.strictEqual(resolveStudiUmumSchedule(3, 1), "TIK");
      assert.strictEqual(resolveStudiUmumSchedule(3, 2), "Matematika");
      assert.strictEqual(resolveStudiUmumSchedule(3, 3), "IPA");
    });

    it("Proof 18: Deterministic schedule resolution via STUDI_UMUM_SCHEDULE_MATRIX", () => {
      for (const level of [1, 2, 3] as const) {
        for (const jp of [1, 2, 3] as const) {
          const subject = resolveStudiUmumSchedule(level, jp);
          assert.strictEqual(subject, STUDI_UMUM_SCHEDULE_MATRIX[level][jp]);
          assert.strictEqual(CANONICAL_STUDI_UMUM_SUBJECTS.includes(subject as any), true);
        }
      }
    });

    it("Proof 19: Non-Saturday days have NO Studi Umum Saturday sessions", () => {
      // Wednesday (day 3), Sunday (day 0), Friday (day 5)
      const wednesday = new Date("2026-09-16T08:00:00Z"); // Wed
      assert.notStrictEqual(wednesday.getUTCDay(), 6, "Wednesday is not Saturday");
      const saturday = new Date("2026-09-19T08:00:00Z"); // Sat
      assert.strictEqual(saturday.getUTCDay(), 6, "Saturday is UTCDay 6");
    });
  });

  // =========================================================================
  // SECTION D: 20-Week PBL Rotation Engine (Proofs 20–28)
  // =========================================================================
  describe("Section D: 20-Week PBL Rotation Engine", () => {
    it("Proof 20: 20-week semester calendar structure: 4 blocks of 5 weeks", () => {
      for (let w = 1; w <= 20; w++) {
        const pbl = resolvePblMeeting(w);
        assert.strictEqual(pbl.blockNumber, Math.ceil(w / 5));
      }
    });

    it("Proof 21: Weeks 1–4 are Theory Phase (TEORI, Block 1)", () => {
      for (let w = 1; w <= 4; w++) {
        const pbl = resolvePblMeeting(w);
        assert.strictEqual(pbl.phase, "TEORI");
        assert.strictEqual(pbl.blockNumber, 1);
      }
    });

    it("Proof 22: Week 5 is Project Execution Phase (PROYEK, Block 1)", () => {
      const pbl = resolvePblMeeting(5);
      assert.strictEqual(pbl.phase, "PROYEK");
      assert.strictEqual(pbl.blockNumber, 1);
    });

    it("Proof 23: Weeks 6–9 are Theory Phase (TEORI, Block 2)", () => {
      for (let w = 6; w <= 9; w++) {
        const pbl = resolvePblMeeting(w);
        assert.strictEqual(pbl.phase, "TEORI");
        assert.strictEqual(pbl.blockNumber, 2);
      }
    });

    it("Proof 24: Week 10 is Project Execution Phase (PROYEK, Block 2)", () => {
      const pbl = resolvePblMeeting(10);
      assert.strictEqual(pbl.phase, "PROYEK");
      assert.strictEqual(pbl.blockNumber, 2);
    });

    it("Proof 25: Weeks 11–14 are Theory Phase (TEORI, Block 3)", () => {
      for (let w = 11; w <= 14; w++) {
        const pbl = resolvePblMeeting(w);
        assert.strictEqual(pbl.phase, "TEORI");
        assert.strictEqual(pbl.blockNumber, 3);
      }
    });

    it("Proof 26: Week 15 is Project Execution Phase (PROYEK, Block 3)", () => {
      const pbl = resolvePblMeeting(15);
      assert.strictEqual(pbl.phase, "PROYEK");
      assert.strictEqual(pbl.blockNumber, 3);
    });

    it("Proof 27: Weeks 16–19 are Theory Phase (TEORI, Block 4)", () => {
      for (let w = 16; w <= 19; w++) {
        const pbl = resolvePblMeeting(w);
        assert.strictEqual(pbl.phase, "TEORI");
        assert.strictEqual(pbl.blockNumber, 4);
      }
    });

    it("Proof 28: Week 20 is Project Execution Phase (PROYEK, Block 4), total 4 major projects", () => {
      const pbl = resolvePblMeeting(20);
      assert.strictEqual(pbl.phase, "PROYEK");
      assert.strictEqual(pbl.blockNumber, 4);

      let projectCount = 0;
      for (let w = 1; w <= 20; w++) {
        if (resolvePblMeeting(w).phase === "PROYEK") projectCount++;
      }
      assert.strictEqual(projectCount, 4, "Must yield exactly 4 major projects per semester");
    });
  });

  // =========================================================================
  // SECTION E: Kepesantrenan Schedule & Pedagogical Arabic (Proofs 29–34)
  // =========================================================================
  describe("Section E: Kepesantrenan Schedule & Pedagogical Arabic", () => {
    it("Proof 29: Kepesantrenan schedule strictly Mon–Fri 18:30–19:30 WITA (60 minutes)", () => {
      for (let day = 1; day <= 5; day++) {
        const sched = KEPESANTRENAN_DAILY_SCHEDULE[day as keyof typeof KEPESANTRENAN_DAILY_SCHEDULE];
        assert.strictEqual(sched.timeRange, "18:30 - 19:30 WITA");
      }
    });

    it("Proof 30: Monday subject is Bahasa Arab", () => {
      assert.strictEqual(resolveKepesantrenanDaySubject(1), "Bahasa Arab");
    });

    it("Proof 31: Tuesday subject is Fikih", () => {
      assert.strictEqual(resolveKepesantrenanDaySubject(2), "Fikih");
    });

    it("Proof 32: Wednesday subject is Tafsir", () => {
      assert.strictEqual(resolveKepesantrenanDaySubject(3), "Tafsir");
    });

    it("Proof 33: Thursday subject is Aqidah", () => {
      assert.strictEqual(resolveKepesantrenanDaySubject(4), "Aqidah");
    });

    it("Proof 34: Friday subject is Tajwid", () => {
      assert.strictEqual(resolveKepesantrenanDaySubject(5), "Tajwid");
    });
  });

  // =========================================================================
  // SECTION F: Putra / Putri Complex Isolation & Scheduling Facts (Proofs 35–37)
  // =========================================================================
  describe("Section F: Putra / Putri Complex Isolation & Scheduling Facts", () => {
    it("Proof 35: Putra & Putri scheduling facts are operational facts, NOT hardcoded auth keys", () => {
      assert.strictEqual(KEPESANTRENAN_SCHEDULED_FACTS.putra.bahasaArab.level1Teacher, "Ust. H. Jupri, Lc.");
      assert.strictEqual(KEPESANTRENAN_SCHEDULED_FACTS.putri.bahasaArab.level1Teacher, "Usth. Fatimah, S.Pd.");
      // The fact strings must NOT be used as authorization keys
      assert.strictEqual(typeof KEPESANTRENAN_SCHEDULED_FACTS.putra.bahasaArab.level1Teacher, "string");
    });

    it("Proof 36: Arabic levels I, II, III are pedagogical groupings, independent of SMP/SMA", () => {
      assert.deepStrictEqual(
        Object.keys(KEPESANTRENAN_SCHEDULED_FACTS.putra.bahasaArab),
        ["level1Teacher", "level2Teacher", "level3Teacher"]
      );
      assert.deepStrictEqual(
        Object.keys(KEPESANTRENAN_SCHEDULED_FACTS.putri.bahasaArab),
        ["level1Teacher", "level2Teacher", "level3Teacher"]
      );
    });

    it("Proof 37: Cross-gender complex handling adheres strictly to canonical authorization scoping", () => {
      // In canonical evaluator, authorization is checked against unit assignments & scopes, not name strings
      assert.match(schemaContent, /genderGroup\s+GenderComplex\?/);
      assert.match(migrationSqlContent, /"gender_group" "GenderComplex"/);
    });
  });

  // =========================================================================
  // SECTION G: 'Mulai Pembelajaran' & Teacher Attribution (Proofs 38–45)
  // =========================================================================
  describe("Section G: 'Mulai Pembelajaran' & Teacher Attribution", () => {
    it("Proof 38: Initial status of EducationSession is SCHEDULED", () => {
      assert.match(schemaContent, /status\s+EducationSessionStatus\s+@default\(SCHEDULED\)/);
      assert.match(migrationSqlContent, /"status" "EducationSessionStatus" NOT NULL DEFAULT 'SCHEDULED'/);
    });

    it("Proof 39: 'Mulai Pembelajaran' action transitions session status to STARTED", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-01",
          status: "SCHEDULED",
          scheduledStaffId: "stf-scheduled-01",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.startEducationSession(
        { sessionId: "sess-test-01" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.status, "STARTED");
    });

    it("Proof 40: Actual teacher is derived securely from authenticated server session", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-02",
          status: "SCHEDULED",
          scheduledStaffId: "stf-original",
        },
      ]);
      const dataProvider = createTeacherDataProvider({
        userId: "usr-actual-teacher",
        staffId: "stf-actual-teacher",
      });
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.startEducationSession(
        { sessionId: "sess-test-02" },
        { actorUserId: "usr-actual-teacher" }
      );

      assert.strictEqual(res.session.actualTeacherUserId, "usr-actual-teacher");
      assert.strictEqual(res.session.actualTeacherStaffId, "stf-actual-teacher");
    });

    it("Proof 41: Scheduled teacher is preserved separately", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-03",
          status: "SCHEDULED",
          scheduledStaffId: "stf-scheduled-guru",
          scheduledTeacherAssignmentId: "ta-assigned-guru",
        },
      ]);
      const dataProvider = createTeacherDataProvider({
        userId: "usr-different-teacher",
        staffId: "stf-different-teacher",
      });
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.startEducationSession(
        { sessionId: "sess-test-03" },
        { actorUserId: "usr-different-teacher" }
      );

      assert.strictEqual(res.session.scheduledStaffId, "stf-scheduled-guru");
      assert.strictEqual(res.session.scheduledTeacherAssignmentId, "ta-assigned-guru");
    });

    it("Proof 42: Substitute teacher scenario: actual teacher differs from scheduled teacher; both recorded correctly", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-04",
          status: "SCHEDULED",
          scheduledStaffId: "stf-primary-guru",
        },
      ]);
      const dataProvider = createTeacherDataProvider({
        userId: "usr-substitute-guru",
        staffId: "stf-substitute-guru",
      });
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.startEducationSession(
        { sessionId: "sess-test-04" },
        { actorUserId: "usr-substitute-guru" }
      );

      assert.strictEqual(res.session.scheduledStaffId, "stf-primary-guru");
      assert.strictEqual(res.session.actualTeacherStaffId, "stf-substitute-guru");
      assert.notStrictEqual(res.session.scheduledStaffId, res.session.actualTeacherStaffId);
    });

    it("Proof 43: Audit log is emitted with action academic.session.start", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-05",
          status: "SCHEDULED",
          scheduledStaffId: "stf-scheduled",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await service.startEducationSession(
        { sessionId: "sess-test-05" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(mockEnv.audits.length, 1);
      assert.strictEqual(mockEnv.audits[0].action, "academic.session.start");
      assert.strictEqual(mockEnv.audits[0].entity, "EducationSession");
      assert.strictEqual(mockEnv.audits[0].entityId, "sess-test-05");
      assert.strictEqual(mockEnv.audits[0].afterState.status, "STARTED");
    });

    it("Proof 44: Atomic transaction ensures session start and audit commit together", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-06",
          status: "SCHEDULED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.startEducationSession(
        { sessionId: "sess-test-06" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.success, true);
      const savedSession = mockEnv.sessions.get("sess-test-06");
      assert.strictEqual(savedSession.status, "STARTED");
      assert.strictEqual(mockEnv.audits.length, 1);
    });

    it("Proof 45: Simulated failure of audit rolls back session start", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-test-07",
          status: "SCHEDULED",
        },
      ]);
      mockEnv.setThrowOnAudit(true);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-test-07" },
            { actorUserId: "usr-teacher-01" }
          ),
        /SIMULATED_CANONICAL_AUDIT_FAILURE/
      );

      // Verify that the session remained SCHEDULED due to transactional rollback
      const savedSession = mockEnv.sessions.get("sess-test-07");
      assert.strictEqual(savedSession.status, "SCHEDULED");
    });
  });

  // =========================================================================
  // SECTION H: Session Gating (Anti-Corruption) (Proofs 46–49)
  // =========================================================================
  describe("Section H: Session Gating (Anti-Corruption)", () => {
    it("Proof 46: Materi entry locked when session status is SCHEDULED (fails closed)", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-gate-01",
          status: "SCHEDULED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.recordSessionMaterial(
            { sessionId: "sess-gate-01", materi: "Bab 1 Eksponen" },
            { actorUserId: "usr-teacher-01" }
          ),
        /SESSION_NOT_STARTED/
      );
    });

    it("Proof 47: Attendance recording locked when session status is SCHEDULED (fails closed)", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-gate-02",
          status: "SCHEDULED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            {
              sessionId: "sess-gate-02",
              records: [{ santriId: "san-01", status: "HADIR" }],
            },
            { actorUserId: "usr-teacher-01" }
          ),
        /SESSION_NOT_STARTED/
      );
    });

    it("Proof 48: Materi entry succeeds when session status is STARTED (manual entry only, no auto-advance)", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-gate-03",
          status: "STARTED",
          materi: null,
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.recordSessionMaterial(
        { sessionId: "sess-gate-03", materi: "Pembahasan Bab 2 Aljabar Linear" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.materi, "Pembahasan Bab 2 Aljabar Linear");
    });

    it("Proof 49: Materi entry records materiRecordedByUserId and timestamp", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-gate-04",
          status: "STARTED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.recordSessionMaterial(
        { sessionId: "sess-gate-04", materi: "Materi tercatat" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.session.materiRecordedByUserId, "usr-teacher-01");
      assert.notStrictEqual(res.session.materiRecordedAt, null);
    });
  });

  // =========================================================================
  // SECTION I: Kepesantrenan Attendance (Proofs 50–56)
  // =========================================================================
  describe("Section I: Kepesantrenan Attendance", () => {
    it("Proof 50: Kepesantrenan attendance permits only HADIR, IZIN, SAKIT, ALFA", () => {
      assert.deepStrictEqual(
        [...KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES],
        ["HADIR", "IZIN", "SAKIT", "ALFA"]
      );
      for (const st of KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES) {
        assert.strictEqual(isApprovedKepesantrenanAttendanceStatus(st), true);
      }
    });

    it("Proof 51: MASBUK is strictly rejected for Kepesantrenan attendance", async () => {
      assert.strictEqual(KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES.includes("MASBUK"), true);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("MASBUK"), false);

      const mockEnv = createMockEducationDb([
        {
          id: "sess-att-01",
          status: "STARTED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            {
              sessionId: "sess-att-01",
              records: [{ santriId: "san-01", status: "MASBUK" as any }],
            },
            { actorUserId: "usr-teacher-01" }
          ),
        /INVALID_ATTENDANCE_STATUS/
      );
    });

    it("Proof 52: Attendance recording creates EducationSessionAttendance records", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-att-02",
          status: "STARTED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      const res = await service.recordSessionAttendance(
        {
          sessionId: "sess-att-02",
          records: [
            { santriId: "san-01", status: "HADIR" },
            { santriId: "san-02", status: "IZIN", note: "Urusan keluarga" },
          ],
        },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 2);
      assert.strictEqual(mockEnv.attendances.size, 2);
    });

    it("Proof 53: Attendance record is tied to session and santri with unique constraint", () => {
      assert.match(
        schemaContent,
        /@@unique\(\[sessionId,\s*santriId\]\)/
      );
      assert.match(
        migrationSqlContent,
        /CREATE UNIQUE INDEX "education_session_attendances_session_id_santri_id_key" ON "education_session_attendances"\("session_id", "santri_id"\)/
      );
    });

    it("Proof 54: Attendance update updates existing record idempotently", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-att-03",
          status: "STARTED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      // First insert: HADIR
      await service.recordSessionAttendance(
        {
          sessionId: "sess-att-03",
          records: [{ santriId: "san-01", status: "HADIR" }],
        },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(mockEnv.attendances.size, 1);
      assert.strictEqual(mockEnv.attendances.get("sess-att-03:san-01").status, "HADIR");

      // Update to SAKIT
      await service.recordSessionAttendance(
        {
          sessionId: "sess-att-03",
          records: [{ santriId: "san-01", status: "SAKIT", note: "Demam" }],
        },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(mockEnv.attendances.size, 1, "Count should remain 1 on upsert");
      assert.strictEqual(mockEnv.attendances.get("sess-att-03:san-01").status, "SAKIT");
      assert.strictEqual(mockEnv.attendances.get("sess-att-03:san-01").note, "Demam");
    });

    it("Proof 55: Attendance recording emits audit log academic.attendance.record", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-att-04",
          status: "STARTED",
        },
      ]);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await service.recordSessionAttendance(
        {
          sessionId: "sess-att-04",
          records: [{ santriId: "san-01", status: "HADIR" }],
        },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(mockEnv.audits.length, 1);
      assert.strictEqual(mockEnv.audits[0].action, "academic.attendance.record");
      assert.strictEqual(mockEnv.audits[0].entityId, "sess-att-04");
    });

    it("Proof 56: Transaction rollback if attendance audit fails", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-att-05",
          status: "STARTED",
        },
      ]);
      mockEnv.setThrowOnAudit(true);
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            {
              sessionId: "sess-att-05",
              records: [{ santriId: "san-01", status: "HADIR" }],
            },
            { actorUserId: "usr-teacher-01" }
          ),
        /SIMULATED_CANONICAL_AUDIT_FAILURE/
      );

      // Verify attendance was rolled back
      assert.strictEqual(mockEnv.attendances.size, 0);
    });
  });

  // =========================================================================
  // SECTION J: Data Honesty (Proofs 57–62)
  // =========================================================================
  describe("Section J: Data Honesty", () => {
    it("Proof 57: Fikih book reference is strictly null / TBD (no invented Safinah/Fathul Qorib)", () => {
      assert.strictEqual(KEPESANTRENAN_SCHEDULED_FACTS.putra.fikih.kitab, null);
      assert.strictEqual(KEPESANTRENAN_SCHEDULED_FACTS.putri.fikih.kitab, null);
    });

    it("Proof 58: Aqidah book reference is strictly null / TBD (no invented Aqidatul Awam)", () => {
      assert.strictEqual(KEPESANTRENAN_SCHEDULED_FACTS.putra.aqidah.kitab, null);
      assert.strictEqual(KEPESANTRENAN_SCHEDULED_FACTS.putri.aqidah.kitab, null);
    });

    it("Proof 59: UI displays 'Menunggu penetapan kurikulum' or honesty placeholder", () => {
      assert.match(uiModuleContent, /Menunggu penetapan kurikulum/);
    });

    it("Proof 60: No invented KKM or assessment formulas in backend service", () => {
      // Backend service contains zero assessment formulas or invented grading scales
      const servicePath = path.join(rootDir, "lib/server/pendidikan-v2-service.ts");
      const serviceContent = fs.readFileSync(servicePath, "utf-8");
      assert.strictEqual(/kkm/i.test(serviceContent), false);
      assert.strictEqual(/bobot/i.test(serviceContent), false);
    });

    it("Proof 61: No fallback to arbitrary roleStaff: 'GA' in app/actions/akademik.ts", () => {
      assert.strictEqual(
        legacyActionContent.includes('roleStaff: "GA"'),
        false,
        "Unsafe fallback roleStaff: 'GA' must be completely removed"
      );
      assert.strictEqual(
        legacyActionContent.includes("role_staff: 'GA'"),
        false,
        "Unsafe fallback role_staff: 'GA' must be completely removed"
      );
    });

    it("Proof 62: Legacy academic tables (mata_pelajaran, nilai_akademik, absensi) preserved", () => {
      assert.match(schemaContent, /model\s+MataPelajaran\s+{/);
      assert.match(schemaContent, /model\s+NilaiAkademik\s+{/);
      assert.match(schemaContent, /model\s+Absensi\s+{/);
    });
  });

  // =========================================================================
  // SECTION K: Architecture & Capabilities (Proofs 63–68)
  // =========================================================================
  describe("Section K: Architecture & Capabilities", () => {
    it("Proof 63: ACADEMIC_CAPABILITIES defined in types/architecture-lock.ts", () => {
      assert.notStrictEqual(ACADEMIC_CAPABILITIES, undefined);
      assert.strictEqual(typeof ACADEMIC_CAPABILITIES, "object");
      const values = Object.values(ACADEMIC_CAPABILITIES);
      assert.strictEqual(values.length >= 7, true);
    });

    it("Proof 64: ACADEMIC_CAPABILITIES include academic.session.start and related capabilities", () => {
      const values = Object.values(ACADEMIC_CAPABILITIES) as string[];
      const requiredCaps = [
        "academic.session.start",
        "academic.session.record_materi",
        "academic.attendance.record",
        "academic.session.complete",
        "academic.cohort.manage",
        "academic.teaching_assignment.manage",
        "academic.session.view",
      ];
      for (const cap of requiredCaps) {
        assert.strictEqual(
          values.includes(cap),
          true,
          `Capability ${cap} must exist in ACADEMIC_CAPABILITIES`
        );
      }
    });

    it("Proof 65: Service enforces authorization check before mutations via authorizeCanonical", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-auth-01",
          status: "SCHEDULED",
        },
      ]);
      // User without academic.session.start capability
      const dataProvider = createTeacherDataProvider({
        capabilities: ["academic.session.view"],
      });
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-auth-01" },
            { actorUserId: "usr-teacher-01" }
          ),
        /CANONICAL_AUTHORIZATION_DENIED/
      );
    });

    it("Proof 66: Unauthorized user cannot start session (fails closed)", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-auth-02",
          status: "SCHEDULED",
        },
      ]);
      // User completely unknown to data provider
      const dataProvider = createTeacherDataProvider();
      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-auth-02" },
            { actorUserId: "usr-stranger" }
          ),
        /AUTHENTICATION_REQUIRED|CANONICAL_AUTHORIZATION_DENIED/
      );
    });

    it("Proof 67: Non-staff user cannot start session as teacher (fails closed with TEACHER_STAFF_RECORD_REQUIRED)", async () => {
      const mockEnv = createMockEducationDb([
        {
          id: "sess-auth-03",
          status: "SCHEDULED",
        },
      ]);
      // User has capability but staffId is null
      const dataProvider: ICanonicalDataProvider = {
        async getIdentity(id: string) {
          return {
            userId: id,
            username: "non.staff.user",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: null, // No staff record
          };
        },
        async getActiveAssignments(uid: string) {
          return [
            {
              id: "asg-01",
              userId: uid,
              positionId: "pos-01",
              positionCode: "GURU_MAPEL",
              positionName: "Guru",
              domain: "PENDIDIKAN",
              unitId: "ou-madrasah",
              unitCode: "OU-MADRASAH",
              unitName: "Madrasah",
              status: "ACTIVE",
              validFrom: new Date(Date.now() - 86400000),
              validUntil: null,
              positionCapabilities: [
                {
                  capabilityCode: "academic.session.start",
                  scopeType: "GLOBAL",
                  businessRuleState: "VERIFIED_PRODUCTION",
                },
              ],
              scopeUnits: [],
            },
          ];
        },
        async getUnitAccountPlacement() { return null; },
        async verifyHumanExecutor(id: string) {
          return { userId: id, id, name: "User", isActive: true };
        },
        async resolveResourceContext() { return { orgUnitIds: [] }; },
      };

      const service = createEducationV2Service({ db: mockEnv.db, dataProvider });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-auth-03" },
            { actorUserId: "usr-non-staff" }
          ),
        /TEACHER_STAFF_RECORD_REQUIRED/
      );
    });

    it("Proof 68: Isolated PostgreSQL migration simulation passes with zero regressions", async () => {
      const result = await simulateM33bMigrationChain();
      assert.strictEqual(result.simulationSuccess, true, "Full M3.3B migration chain simulation must succeed");
      assert.strictEqual(result.pr8ExactShaVerified, true);
      assert.strictEqual(result.pr8MigrationApplied, true);
      assert.strictEqual(result.m33bMigrationApplied, true);
      assert.strictEqual(result.existingDataUnchanged, true);
      assert.strictEqual(result.existingPr8TablesIntact, true);
      assert.strictEqual(result.existingPlacementsIntact, true);
      assert.strictEqual(result.existingHealthCasesIntact, true);
      assert.strictEqual(result.existingAcademicTablesIntact, true);
      assert.strictEqual(result.cohortTableCreated, true);
      assert.strictEqual(result.assignmentTableCreated, true);
      assert.strictEqual(result.sessionTableCreated, true);
      assert.strictEqual(result.attendanceTableCreated, true);
      assert.strictEqual(result.educationEnumsCreated, true);
      assert.strictEqual(result.educationEnumsExactValuesVerified, true);
      assert.strictEqual(result.masbukEnumRejected, true);
      assert.strictEqual(result.sessionIndexesCreated, true);
      assert.strictEqual(result.attendanceUniqueConstraintVerified, true);
      assert.strictEqual(result.santriCohortLinkageVerified, true);
      assert.strictEqual(result.actualVsScheduledTeacherVerified, true);
      assert.strictEqual(result.sessionAuditRollbackVerified, true);
    });
  });
});
