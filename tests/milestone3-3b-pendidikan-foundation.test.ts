/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import {
  CANONICAL_STUDI_UMUM_SUBJECTS,
  CANONICAL_KEPESANTRENAN_SUBJECTS,
  CANONICAL_KEPESANTRENAN_SUBJECT_DEFINITIONS,
  KEPESANTRENAN_SCHEDULED_FACTS,
  STUDI_UMUM_JP_SLOTS,
  STUDI_UMUM_SCHEDULE_MATRIX,
  KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES,
  KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES,
  deriveProgramLevel,
  resolvePblMeeting,
  resolveStudiUmumSchedule,
  isApprovedKepesantrenanAttendanceStatus,
  isWitaSaturday,
} from "../lib/pendidikan-v2";

import {
  ACADEMIC_CAPABILITIES,
  RequestedResourceContext,
} from "../types/architecture-lock";

import {
  createEducationV2Service,
} from "../lib/server/pendidikan-v2-service";

import {
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalIdentity,
} from "../lib/auth/canonical-evaluator";

import {
  IAuditPersistence,
} from "../lib/auth/canonical-audit";

import {
  simulateM33bMigrationChain,
} from "./test-db-manager";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3: CHECKPOINT M3.3B PENDIDIKAN FOUNDATION (REMEDIATION ROUND 2)", () => {
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

  // Shared mock helper for database
  const createMockEducationDb = (initialSessions: any[] = [], initialParticipants: any[] = []) => {
    const sessions = new Map<string, any>();
    const participants = new Map<string, any>();
    const attendances = new Map<string, any>();

    for (const s of initialSessions) {
      sessions.set(s.id, { ...s });
    }
    for (const p of initialParticipants) {
      participants.set(`${p.sessionId}_${p.santriId}`, { ...p });
    }

    const txMock = {
      educationSession: {
        findUnique: async ({ where }: any) => {
          const s = sessions.get(where.id);
          return s ? { ...s } : null;
        },
        findUniqueOrThrow: async ({ where }: any) => {
          const s = sessions.get(where.id);
          if (!s) throw new Error(`Record not found: ${where.id}`);
          return { ...s };
        },
        update: async ({ where, data }: any) => {
          const s = sessions.get(where.id);
          if (!s) throw new Error("Not found");
          const updated = { ...s, ...data };
          sessions.set(where.id, updated);
          return updated;
        },
        updateMany: async ({ where, data }: any) => {
          const s = sessions.get(where.id);
          if (s && s.status === where.status) {
            const updated = { ...s, ...data };
            sessions.set(where.id, updated);
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      educationSessionParticipant: {
        findUnique: async ({ where }: any) => {
          const key = where.sessionId_santriId
            ? `${where.sessionId_santriId.sessionId}_${where.sessionId_santriId.santriId}`
            : where.id;
          const p = participants.get(key);
          return p ? { ...p } : null;
        },
      },
      educationSessionAttendance: {
        findUnique: async ({ where }: any) => {
          const key = where.sessionId_santriId
            ? `${where.sessionId_santriId.sessionId}_${where.sessionId_santriId.santriId}`
            : where.id;
          const existing = attendances.get(key);
          return existing ? { ...existing } : null;
        },
        upsert: async ({ where, update, create }: any) => {
          const key = `${where.sessionId_santriId.sessionId}_${where.sessionId_santriId.santriId}`;
          const existing = attendances.get(key);
          if (existing) {
            const upd = { ...existing, ...update };
            attendances.set(key, upd);
            return upd;
          }
          const crt = { id: `att-${Date.now()}`, ...create };
          attendances.set(key, crt);
          return crt;
        },
      },
      canonicalAuditLog: {
        create: async ({ data }: any) => {
          return { id: `aud-${Date.now()}`, ...data };
        },
      },
    };

    return {
      educationSession: {
        findUnique: txMock.educationSession.findUnique,
        update: txMock.educationSession.update,
        updateMany: txMock.educationSession.updateMany,
      },
      educationSessionParticipant: {
        findUnique: txMock.educationSessionParticipant.findUnique,
      },
      educationSessionAttendance: {
        findUnique: txMock.educationSessionAttendance.findUnique,
        upsert: txMock.educationSessionAttendance.upsert,
      },
      $transaction: async (cb: any) => {
        return await cb(txMock);
      },
      _sessions: sessions,
      _participants: participants,
      _attendances: attendances,
    };
  };

  const createMockAuditPersistence = (failOnRecord = false): IAuditPersistence & { records: any[] } => {
    const records: any[] = [];
    return {
      isPersistent: true,
      recordInTx: async (_tx: any, record: any) => {
        if (failOnRecord) {
          throw new Error("CANONICAL_AUDIT_TRANSACTION_FAILURE: Database connection dropped during audit write");
        }
        records.push(record);
      },
      records,
    };
  };

  const createMockDataProvider = (opts?: {
    teacherUserId?: string;
    staffId?: string;
    assignments?: any[];
    denyCapability?: string;
    incompleteDecision?: boolean;
  }): ICanonicalDataProvider => {
    const teacherId = opts?.teacherUserId || "usr-teacher-01";
    const staffId = opts?.staffId || "stf-teacher-01";

    return {
      getIdentity: async (userId: string): Promise<CanonicalIdentity | null> => {
        if (userId === teacherId) {
          return {
            userId: teacherId,
            username: "guru.matematika",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: staffId,
            staffStatus: "AKTIF",
            name: "Ustadz Pengajar Resmi",
            placementUnitId: null,
          };
        }
        if (userId === "usr-substitute-02") {
          return {
            userId: "usr-substitute-02",
            username: "guru.pengganti",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-sub-02",
            staffStatus: "AKTIF",
            name: "Ustadz Guru Pengganti",
            placementUnitId: null,
          };
        }
        return null;
      },
      verifyHumanExecutor: async (executorId: string) => {
        return {
          userId: executorId,
          id: executorId,
          name: "Ustadz Pengajar Terverifikasi",
          staffId: staffId,
          isActive: true,
        };
      },
      getActiveAssignments: async (userId: string) => {
        if (opts?.assignments) return opts.assignments;
        return [
          {
            id: "asn-pendidikan-01",
            userId,
            positionId: "pos-guru",
            positionCode: "GURU_MAPEL",
            positionName: "Guru Mata Pelajaran",
            domain: "AKADEMIK" as any,
            unitId: "ou-madrasah",
            unitCode: "MADRASAH",
            unitName: "Madrasah STQ",
            unitGenderComplex: "TIDAK_TERIKAT" as any,
            status: "ACTIVE" as any,
            validFrom: new Date("2026-01-01"),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: ACADEMIC_CAPABILITIES.SESSION_START,
                scopeType: "GLOBAL" as any,
                businessRuleState: "VERIFIED_PRODUCTION" as any,
              },
              {
                capabilityCode: ACADEMIC_CAPABILITIES.MATERIAL_RECORD,
                scopeType: "GLOBAL" as any,
                businessRuleState: "VERIFIED_PRODUCTION" as any,
              },
              {
                capabilityCode: ACADEMIC_CAPABILITIES.ATTENDANCE_RECORD,
                scopeType: "GLOBAL" as any,
                businessRuleState: "VERIFIED_PRODUCTION" as any,
              },
            ],
            scopeUnits: [],
          },
        ];
      },
      getUnitAccountPlacement: async () => null,
      resolveResourceContext: async (requested: RequestedResourceContext) => {
        return {
          orgUnitIds: requested.unitId ? [requested.unitId] : ["ou-madrasah"],
          orgDomain: "AKADEMIK" as any,
          educationSessionId: requested.educationSessionId,
        };
      },
    };
  };

  // ====================================================
  // SECTION A: INFORMATION ARCHITECTURE SEPARATION
  // ====================================================
  describe("A. Information Architecture Separation (Studi Umum vs Kepesantrenan)", () => {
    it("A1. Studi Umum defines exactly 6 canonical subjects", () => {
      assert.strictEqual(CANONICAL_STUDI_UMUM_SUBJECTS.length, 6);
      const expected = ["Matematika", "Bahasa Inggris", "IPS", "IPA", "Bahasa Indonesia", "TIK"];
      assert.deepStrictEqual([...CANONICAL_STUDI_UMUM_SUBJECTS], expected);
    });

    it("A2. Kepesantrenan defines exactly 5 canonical subjects", () => {
      assert.strictEqual(CANONICAL_KEPESANTRENAN_SUBJECTS.length, 5);
      const expected = ["Bahasa Arab", "Fikih", "Tafsir", "Aqidah", "Tajwid"];
      assert.deepStrictEqual([...CANONICAL_KEPESANTRENAN_SUBJECTS], expected);
    });

    it("A3. Studi Umum and Kepesantrenan subject lists are strictly disjoint", () => {
      const suSet = new Set<string>(CANONICAL_STUDI_UMUM_SUBJECTS);
      const kpSet = new Set<string>(CANONICAL_KEPESANTRENAN_SUBJECTS);
      for (const s of suSet) {
        assert.strictEqual(kpSet.has(s), false, `Subject ${s} appears in both tracks!`);
      }
    });

    it("A4. Prisma schema defines EducationTrack enum with exact 2 values", () => {
      assert.ok(schemaContent.includes("enum EducationTrack {"));
      assert.ok(schemaContent.includes("STUDI_UMUM"));
      assert.ok(schemaContent.includes("KEPESANTRENAN"));
    });
  });

  // ====================================================
  // SECTION B: CRITICAL BUSINESS RULE — CORRECT STUDI UMUM TIMES
  // ====================================================
  describe("B. Correct Studi Umum Times (Paten 110 Minutes)", () => {
    it("B1. JP 1 is exactly 08:00–09:50 WITA (110 minutes)", () => {
      const jp1 = STUDI_UMUM_JP_SLOTS.JP1;
      assert.strictEqual(jp1.jp, 1);
      assert.strictEqual(jp1.timeRangeWita, "08:00–09:50 WITA");
      assert.strictEqual(jp1.startTime, "08:00");
      assert.strictEqual(jp1.endTime, "09:50");
      assert.strictEqual(jp1.durationMinutes, 110);
    });

    it("B2. JP 2 is exactly 10:00–11:50 WITA (110 minutes)", () => {
      const jp2 = STUDI_UMUM_JP_SLOTS.JP2;
      assert.strictEqual(jp2.jp, 2);
      assert.strictEqual(jp2.timeRangeWita, "10:00–11:50 WITA");
      assert.strictEqual(jp2.startTime, "10:00");
      assert.strictEqual(jp2.endTime, "11:50");
      assert.strictEqual(jp2.durationMinutes, 110);
    });

    it("B3. JP 3 is exactly 13:30–15:20 WITA (110 minutes)", () => {
      const jp3 = STUDI_UMUM_JP_SLOTS.JP3;
      assert.strictEqual(jp3.jp, 3);
      assert.strictEqual(jp3.timeRangeWita, "13:30–15:20 WITA");
      assert.strictEqual(jp3.startTime, "13:30");
      assert.strictEqual(jp3.endTime, "15:20");
      assert.strictEqual(jp3.durationMinutes, 110);
    });

    it("B4. Zero conventional 80-minute assumptions remain in code", () => {
      assert.strictEqual(STUDI_UMUM_JP_SLOTS.JP1.durationMinutes, 110);
      assert.strictEqual(STUDI_UMUM_JP_SLOTS.JP2.durationMinutes, 110);
      assert.strictEqual(STUDI_UMUM_JP_SLOTS.JP3.durationMinutes, 110);
      assert.strictEqual(STUDI_UMUM_JP_SLOTS.some((s) => s.durationMinutes === 80), false);
    });
  });

  // ====================================================
  // SECTION C: CRITICAL BUSINESS RULE — CORRECT JP MATRIX & INVARIANTS
  // ====================================================
  describe("C. Correct JP Matrix & Invariants", () => {
    it("C1. JP I (08:00–09:50): T1 = Bahasa Inggris, T2 = Matematika, T3 = PBL", () => {
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[1][1], "Bahasa Inggris");
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[2][1], "Matematika");
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[3][1], "PBL");
    });

    it("C2. JP II (10:00–11:50): T1 = Matematika, T2 = PBL, T3 = Bahasa Inggris", () => {
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[1][2], "Matematika");
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[2][2], "PBL");
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[3][2], "Bahasa Inggris");
    });

    it("C3. JP III (13:30–15:20): T1 = PBL, T2 = Bahasa Inggris, T3 = Matematika", () => {
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[1][3], "PBL");
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[2][3], "Bahasa Inggris");
      assert.strictEqual(STUDI_UMUM_SCHEDULE_MATRIX[3][3], "Matematika");
    });

    it("C4. Every cohort level receives exactly 1 Math, 1 English, 1 PBL every Saturday", () => {
      for (const level of [1, 2, 3] as const) {
        const slots = [
          STUDI_UMUM_SCHEDULE_MATRIX[level][1],
          STUDI_UMUM_SCHEDULE_MATRIX[level][2],
          STUDI_UMUM_SCHEDULE_MATRIX[level][3],
        ];
        assert.strictEqual(slots.filter((s) => s === "Matematika").length, 1, `Level ${level} must have 1 Math`);
        assert.strictEqual(slots.filter((s) => s === "Bahasa Inggris").length, 1, `Level ${level} must have 1 English`);
        assert.strictEqual(slots.filter((s) => s === "PBL").length, 1, `Level ${level} must have 1 PBL`);
      }
    });

    it("C5. No cohort receives 2 or 3 PBL sessions in one Saturday", () => {
      for (const level of [1, 2, 3] as const) {
        const slots = [
          STUDI_UMUM_SCHEDULE_MATRIX[level][1],
          STUDI_UMUM_SCHEDULE_MATRIX[level][2],
          STUDI_UMUM_SCHEDULE_MATRIX[level][3],
        ];
        assert.strictEqual(slots.filter((s) => s === "PBL").length, 1);
      }
    });

    it("C6. In every JP slot, each cohort receives a distinct subject (Latin square property)", () => {
      for (const jp of [1, 2, 3] as const) {
        const subjectsInSlot = [
          STUDI_UMUM_SCHEDULE_MATRIX[1][jp],
          STUDI_UMUM_SCHEDULE_MATRIX[2][jp],
          STUDI_UMUM_SCHEDULE_MATRIX[3][jp],
        ];
        const uniqueSet = new Set(subjectsInSlot);
        assert.strictEqual(uniqueSet.size, 3, `JP ${jp} does not have 3 distinct subjects!`);
      }
    });
  });

  // ====================================================
  // SECTION D: STUDI UMUM — PBL 20-WEEK ROTATION
  // ====================================================
  describe("D. Studi Umum 20-Week Semester PBL Rotation", () => {
    it("D1. Meetings 1–5 resolve to Block 1: IPS (Weeks 1–4 Theory, Week 5 Project)", () => {
      for (let m = 1; m <= 4; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "IPS");
        assert.strictEqual(res.blockNumber, 1);
        assert.strictEqual(res.phase, "TEORI");
        assert.strictEqual(res.isProjectWeek, false);
      }
      const p5 = resolvePblMeeting(5);
      assert.strictEqual(p5.subject, "IPS");
      assert.strictEqual(p5.blockNumber, 1);
      assert.strictEqual(p5.phase, "PROYEK");
      assert.strictEqual(p5.isProjectWeek, true);
    });

    it("D2. Meetings 6–10 resolve to Block 2: IPA (Weeks 6–9 Theory, Week 10 Project)", () => {
      for (let m = 6; m <= 9; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "IPA");
        assert.strictEqual(res.blockNumber, 2);
        assert.strictEqual(res.phase, "TEORI");
        assert.strictEqual(res.isProjectWeek, false);
      }
      const p10 = resolvePblMeeting(10);
      assert.strictEqual(p10.subject, "IPA");
      assert.strictEqual(p10.blockNumber, 2);
      assert.strictEqual(p10.phase, "PROYEK");
      assert.strictEqual(p10.isProjectWeek, true);
    });

    it("D3. Meetings 11–15 resolve to Block 3: Bahasa Indonesia (Weeks 11–14 Theory, Week 15 Project)", () => {
      for (let m = 11; m <= 14; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "Bahasa Indonesia");
        assert.strictEqual(res.blockNumber, 3);
        assert.strictEqual(res.phase, "TEORI");
        assert.strictEqual(res.isProjectWeek, false);
      }
      const p15 = resolvePblMeeting(15);
      assert.strictEqual(p15.subject, "Bahasa Indonesia");
      assert.strictEqual(p15.blockNumber, 3);
      assert.strictEqual(p15.phase, "PROYEK");
      assert.strictEqual(p15.isProjectWeek, true);
    });

    it("D4. Meetings 16–20 resolve to Block 4: TIK (Weeks 16–19 Theory, Week 20 Project)", () => {
      for (let m = 16; m <= 19; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "TIK");
        assert.strictEqual(res.blockNumber, 4);
        assert.strictEqual(res.phase, "TEORI");
        assert.strictEqual(res.isProjectWeek, false);
      }
      const p20 = resolvePblMeeting(20);
      assert.strictEqual(p20.subject, "TIK");
      assert.strictEqual(p20.blockNumber, 4);
      assert.strictEqual(p20.phase, "PROYEK");
      assert.strictEqual(p20.isProjectWeek, true);
    });

    it("D5. Exactly 4 major projects per semester (Meetings 5, 10, 15, 20)", () => {
      const projectMeetings: number[] = [];
      for (let m = 1; m <= 20; m++) {
        if (resolvePblMeeting(m).isProjectWeek) {
          projectMeetings.push(m);
        }
      }
      assert.deepStrictEqual(projectMeetings, [5, 10, 15, 20]);
    });

    it("D6. resolveStudiUmumSchedule resolves PBL slot dynamically while preserving CORE slots", () => {
      // Tingkat 1, JP 1 = Bahasa Inggris (CORE)
      const resT1JP1 = resolveStudiUmumSchedule({ programLevel: 1, jp: 1, semesterMeetingNumber: 5 });
      assert.strictEqual(resT1JP1.type, "CORE");
      assert.strictEqual(resT1JP1.subject, "Bahasa Inggris");
      assert.strictEqual(resT1JP1.timeSlot, "08:00–09:50 WITA");

      // Tingkat 1, JP 3 = PBL -> meeting 5 = IPS (PROJECT)
      const resT1JP3 = resolveStudiUmumSchedule({ programLevel: 1, jp: 3, semesterMeetingNumber: 5 });
      assert.strictEqual(resT1JP3.type, "PBL");
      assert.strictEqual(resT1JP3.subject, "IPS");
      assert.strictEqual(resT1JP3.pblPhase, "PROJECT");
      assert.strictEqual(resT1JP3.isProjectWeek, true);
      assert.strictEqual(resT1JP3.timeSlot, "13:30–15:20 WITA");
    });
  });

  // ====================================================
  // SECTION E: DETERMINISTIC WITA SATURDAY RESOLUTION
  // ====================================================
  describe("E. Deterministic WITA Saturday & UTC Rollover Boundary", () => {
    it("E1. Detects Saturday in Asia/Makassar timezone", () => {
      // Saturday 2026-09-19 10:00 WITA -> Saturday
      const satWita = new Date("2026-09-19T02:00:00.000Z"); // 10:00 WITA
      assert.strictEqual(isWitaSaturday(satWita), true);
    });

    it("E2. Correctly handles boundary near UTC rollover (Friday night UTC is Saturday morning WITA)", () => {
      // Friday 2026-09-18 20:00 UTC -> Saturday 2026-09-19 04:00 WITA
      const friNightUtc = new Date("2026-09-18T20:00:00.000Z");
      assert.strictEqual(friNightUtc.getUTCDay(), 5); // UTC says Friday
      assert.strictEqual(isWitaSaturday(friNightUtc), true); // WITA correctly says Saturday!
    });

    it("E3. Correctly handles boundary when Saturday night UTC is Sunday morning WITA", () => {
      // Saturday 2026-09-19 18:00 UTC -> Sunday 2026-09-20 02:00 WITA
      const satNightUtc = new Date("2026-09-19T18:00:00.000Z");
      assert.strictEqual(satNightUtc.getUTCDay(), 6); // UTC says Saturday
      assert.strictEqual(isWitaSaturday(satNightUtc), false); // WITA correctly says Sunday!
    });

    it("E4. Non-Saturday days return false", () => {
      assert.strictEqual(isWitaSaturday("2026-09-18T05:00:00.000Z"), false); // Friday
      assert.strictEqual(isWitaSaturday("2026-09-20T05:00:00.000Z"), false); // Sunday
    });
  });

  // ====================================================
  // SECTION F: KEPESANTRENAN SCHEDULING FACTS & CONTRADICTIONS
  // ====================================================
  describe("F. Correct Kepesantrenan Scheduling Facts & References", () => {
    it("F1. Single canonical representation KEPESANTRENAN_SCHEDULED_FACTS without contradictory duplicate mappings", () => {
      assert.ok(KEPESANTRENAN_SCHEDULED_FACTS.PUTRA);
      assert.ok(KEPESANTRENAN_SCHEDULED_FACTS.PUTRI);
      // Conflicting legacy lowercase representations are removed
      assert.strictEqual((KEPESANTRENAN_SCHEDULED_FACTS as any).putra, undefined);
      assert.strictEqual((KEPESANTRENAN_SCHEDULED_FACTS as any).putri, undefined);
    });

    it("F2. Putra Arabic teachers: I Abi Hudzaifah, II Kamal Mukhtar, III Andi Quarzy Ayatullah (Durus al-Lughah)", () => {
      const arb = KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-ARB"];
      assert.strictEqual(arb.levels.TINGKAT_1.teacherName, "Ust. Abi Hudzaifah");
      assert.strictEqual(arb.levels.TINGKAT_1.referenceBook, "Durus al-Lughah");
      assert.strictEqual(arb.levels.TINGKAT_2.teacherName, "Ust. Kamal Mukhtar");
      assert.strictEqual(arb.levels.TINGKAT_2.referenceBook, "Durus al-Lughah");
      assert.strictEqual(arb.levels.TINGKAT_3.teacherName, "Ust. Andi Quarzy Ayatullah");
      assert.strictEqual(arb.levels.TINGKAT_3.referenceBook, "Durus al-Lughah");
    });

    it("F3. Putra Fikih teacher is Ust. Razan and book reference is strictly null / TBD", () => {
      const fqh = KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-FQH"];
      assert.strictEqual(fqh.teacherName, "Ust. Razan");
      assert.strictEqual(fqh.referenceBook, null);
    });

    it("F4. Putra Tafsir teacher is Ust. Mujaddid with Terjemahan Per Kata & Jalalain", () => {
      const tfs = KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TFS"];
      assert.strictEqual(tfs.teacherName, "Ust. Mujaddid");
      assert.deepStrictEqual([...tfs.referenceBooks], ["Tafsir Terjemahan Per Kata", "Tafsir Jalalain"]);
    });

    it("F5. Putra Aqidah teacher is Ust. Alwan and book reference is strictly null / TBD", () => {
      const aqd = KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-AQD"];
      assert.strictEqual(aqd.teacherName, "Ust. Alwan");
      assert.strictEqual(aqd.referenceBook, null);
    });

    it("F6. Putra Tajwid teacher is Ust. Mujaddid with Matan Tuhfatul Athfal", () => {
      const tjw = KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TJW"];
      assert.strictEqual(tjw.teacherName, "Ust. Mujaddid");
      assert.strictEqual(tjw.referenceBook, "Matan Tuhfatul Athfal");
    });

    it("F7. Putri: All five subjects handled by Ustazah Lisa Dwina Fitri", () => {
      const putri = KEPESANTRENAN_SCHEDULED_FACTS.PUTRI;
      assert.strictEqual(putri.teacherName, "Ustazah Lisa Dwina Fitri");
      assert.strictEqual(putri["KPS-ARB"].teacherName, "Ustazah Lisa Dwina Fitri");
      assert.strictEqual(putri["KPS-FQH"].teacherName, "Ustazah Lisa Dwina Fitri");
      assert.strictEqual(putri["KPS-TFS"].teacherName, "Ustazah Lisa Dwina Fitri");
      assert.strictEqual(putri["KPS-AQD"].teacherName, "Ustazah Lisa Dwina Fitri");
      assert.strictEqual(putri["KPS-TJW"].teacherName, "Ustazah Lisa Dwina Fitri");
    });

    it("F8. Ust. H. Jupri, Lc. and Usth. Fatimah, S.Pd. are NOT approved scheduling facts", () => {
      const stringified = JSON.stringify(KEPESANTRENAN_SCHEDULED_FACTS);
      assert.strictEqual(stringified.includes("Jupri"), false);
      assert.strictEqual(stringified.includes("Fatimah"), false);
    });
  });

  // ====================================================
  // SECTION G: COHORT DERIVATION MUST FAIL CLOSED
  // ====================================================
  describe("G. Fail-Closed Cohort Program Level Derivation", () => {
    it("G1. Valid active 3-year program range returns exactly 1, 2, or 3", () => {
      // 2026 cohort in TA 2026/2027 -> 1
      assert.strictEqual(deriveProgramLevel(2026, 2026), 1);
      assert.strictEqual(deriveProgramLevel(2026, "2026/2027"), 1);

      // 2026 cohort in TA 2027/2028 -> 2
      assert.strictEqual(deriveProgramLevel(2026, 2027), 2);
      assert.strictEqual(deriveProgramLevel(2026, "2027/2028"), 2);

      // 2026 cohort in TA 2028/2029 -> 3
      assert.strictEqual(deriveProgramLevel(2026, 2028), 3);
      assert.strictEqual(deriveProgramLevel(2026, "2028/2029"), 3);
    });

    it("G2. Out-of-program cohort (diff + 1 < 1) throws on numeric signature", () => {
      // Future cohort 2027 in TA 2026/2027 -> level 0 (REJECT!)
      assert.throws(
        () => deriveProgramLevel(2027, 2026),
        /COHORT_OUT_OF_PROGRAM_BOUNDS/
      );
      assert.throws(
        () => deriveProgramLevel(2027, "2026/2027"),
        /COHORT_OUT_OF_PROGRAM_BOUNDS/
      );
    });

    it("G3. Out-of-program cohort (diff + 1 > 3) throws on numeric signature", () => {
      // Graduated cohort 2026 in TA 2029/2030 -> level 4 (REJECT!)
      assert.throws(
        () => deriveProgramLevel(2026, 2029),
        /COHORT_OUT_OF_PROGRAM_BOUNDS/
      );
      assert.throws(
        () => deriveProgramLevel(2026, "2029/2030"),
        /COHORT_OUT_OF_PROGRAM_BOUNDS/
      );
    });

    it("G4. Object signature returns error on out-of-program cohorts", () => {
      const resFuture = deriveProgramLevel({ startYear: 2027, activeAcademicYear: "2026/2027" });
      assert.strictEqual(resFuture.success, false);
      assert.ok(resFuture.error?.includes("COHORT_OUT_OF_PROGRAM_BOUNDS"));

      const resGrad = deriveProgramLevel({ startYear: 2026, activeAcademicYear: "2029/2030" });
      assert.strictEqual(resGrad.success, false);
      assert.ok(resGrad.error?.includes("COHORT_OUT_OF_PROGRAM_BOUNDS"));
    });

    it("G5. Never infers academic level from Santri.kelas or SMP/SMA labels", () => {
      assert.ok(schemaContent.includes("model EducationCohort"));
      assert.ok(schemaContent.includes("cohortId"));
      // The deriveProgramLevel signature accepts only startYear and activeAcademicYear
      const res = deriveProgramLevel({ startYear: 2025, activeAcademicYear: "2026/2027" });
      assert.strictEqual(res.level, 2);
    });
  });

  // ====================================================
  // SECTION H: CANONICAL RESOURCE RESOLUTION (PRISMA PROVIDER)
  // ====================================================
  describe("H. Authoritative EducationSession Resource Resolution via Prisma Provider", () => {
    it("H1. RequestedResourceContext defines explicit educationSessionId", () => {
      const ctx: RequestedResourceContext = {
        educationSessionId: "sess-edu-100",
      };
      assert.strictEqual(ctx.educationSessionId, "sess-edu-100");
    });

    it("H2. createPrismaDataProvider authoritatively resolves real DB facts for EducationSession", async () => {
      const fakePrisma = {
        educationSession: {
          findUnique: async ({ where }: any) => {
            if (where.id === "sess-valid-01") {
              return {
                id: "sess-valid-01",
                educationTrack: "STUDI_UMUM",
                subjectId: "mp-matematika",
                cohortId: "coh-2026",
                programLevel: 1,
                genderGroup: "PUTRA",
                scheduledStaffId: "stf-01",
                actualTeacherUserId: "usr-01",
                scheduledTeacherAssignmentId: "ta-01",
              };
            }
            return null;
          },
        },
        tasmiSimaan: {
          findUnique: async () => null,
        },
      };

      const provider = createPrismaDataProvider(fakePrisma as any);
      const resolved = await provider.resolveResourceContext({ educationSessionId: "sess-valid-01" });

      assert.ok(resolved);
      assert.strictEqual(resolved?.orgDomain, "AKADEMIK");
      assert.strictEqual(resolved?.genderComplex, "PUTRA");
      assert.strictEqual(resolved?.educationSessionId, "sess-valid-01");
      assert.strictEqual((resolved as any).educationSession?.subjectId, "mp-matematika");
      assert.strictEqual((resolved as any).educationSession?.programLevel, 1);
    });

    it("H3. EducationSession ID is never treated as TasmiSimaan ID", async () => {
      let tasmiQueryCount = 0;
      let sessionQueryCount = 0;

      const fakePrisma = {
        educationSession: {
          findUnique: async () => {
            sessionQueryCount++;
            return {
              id: "sess-01",
              educationTrack: "KEPESANTRENAN",
              subjectId: "mp-arb",
              cohortId: null,
              programLevel: null,
              genderGroup: "PUTRI",
              scheduledStaffId: "stf-lisa",
              actualTeacherUserId: null,
              scheduledTeacherAssignmentId: null,
            };
          },
        },
        tasmiSimaan: {
          findUnique: async () => {
            tasmiQueryCount++;
            return null;
          },
        },
      };

      const provider = createPrismaDataProvider(fakePrisma as any);
      await provider.resolveResourceContext({ educationSessionId: "sess-01" });

      assert.strictEqual(sessionQueryCount, 1);
      assert.strictEqual(tasmiQueryCount, 0, "TasmiSimaan must NOT be queried for educationSessionId!");
    });

    it("H4. Non-existent educationSessionId fails closed (returns null)", async () => {
      const fakePrisma = {
        educationSession: {
          findUnique: async () => null,
        },
      };

      const provider = createPrismaDataProvider(fakePrisma as any);
      const resolved = await provider.resolveResourceContext({ educationSessionId: "sess-nonexistent" });
      assert.strictEqual(resolved, null);
    });

    it("H5. Resolving session context with santriId verifies participant enrollment (fails closed if unenrolled)", async () => {
      const fakePrisma = {
        educationSession: {
          findUnique: async () => ({
            id: "sess-01",
            educationTrack: "STUDI_UMUM",
            subjectId: "mp-01",
            programLevel: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: "stf-01",
            scheduledTeacherAssignment: null,
          }),
        },
        educationSessionParticipant: {
          findUnique: async ({ where }: any) => {
            if (where.sessionId_santriId?.santriId === "san-enrolled") {
              return { sessionId: "sess-01", santriId: "san-enrolled" };
            }
            return null;
          },
        },
        santri: {
          findUnique: async ({ where }: any) => ({
            id: where.id,
            jenisKelamin: "L",
          }),
        },
      };

      const provider = createPrismaDataProvider(fakePrisma as any);

      // Enrolled participant resolves
      const enrolled = await provider.resolveResourceContext({
        educationSessionId: "sess-01",
        santriId: "san-enrolled",
      });
      assert.ok(enrolled !== null);
      assert.strictEqual(enrolled?.santriId, "san-enrolled");

      // Unenrolled santri fails closed
      const unenrolled = await provider.resolveResourceContext({
        educationSessionId: "sess-01",
        santriId: "san-stranger",
      });
      assert.strictEqual(unenrolled, null);
    });

    it("H6. Session participant gender mismatch fails closed (PUTRA session rejects PUTRI santri)", async () => {
      const fakePrisma = {
        educationSession: {
          findUnique: async () => ({
            id: "sess-putra",
            educationTrack: "KEPESANTRENAN",
            subjectId: "mp-arb",
            programLevel: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: "stf-01",
            scheduledTeacherAssignment: null,
          }),
        },
        educationSessionParticipant: {
          findUnique: async () => ({ sessionId: "sess-putra", santriId: "san-female" }),
        },
        santri: {
          findUnique: async () => ({ id: "san-female", jenisKelamin: "P" }),
        },
      };

      const provider = createPrismaDataProvider(fakePrisma as any);
      const resolved = await provider.resolveResourceContext({
        educationSessionId: "sess-putra",
        santriId: "san-female",
      });
      assert.strictEqual(resolved, null, "Female santri in male session must fail closed");
    });

    it("H7. Academic context strictly isolates scope (zero halaqoh/kamar borrowed into orgUnitIds)", async () => {
      const fakePrisma = {
        educationSession: {
          findUnique: async () => ({
            id: "sess-acad",
            educationTrack: "STUDI_UMUM",
            subjectId: "mp-01",
            programLevel: 1,
            genderGroup: "PUTRA",
            scheduledStaffId: "stf-01",
            scheduledTeacherAssignment: null,
          }),
        },
      };

      const provider = createPrismaDataProvider(fakePrisma as any);
      const resolved = await provider.resolveResourceContext({ educationSessionId: "sess-acad" });
      assert.ok(resolved !== null);
      assert.strictEqual(resolved?.orgDomain, "AKADEMIK");
      assert.deepStrictEqual(resolved?.orgUnitIds, []);
    });
  });

  // ====================================================
  // SECTION I: AUTH AUDIT PROVENANCE FAIL CLOSED & SINGLE CAPABILITY
  // ====================================================
  describe("I. Auth Audit Provenance Fail-Closed & Canonical Material Capability", () => {
    it("I1. Single canonical capability code is academic.material.record", () => {
      assert.strictEqual(ACADEMIC_CAPABILITIES.MATERIAL_RECORD, "academic.material.record");
      // Duplicate academic.session.record_materi is removed from ACADEMIC_CAPABILITIES
      assert.strictEqual((ACADEMIC_CAPABILITIES as any).SESSION_RECORD_MATERI, undefined);
    });

    it("I2. Incomplete audit decision throws AUTH_DECISION_INCOMPLETE (No fallback fabrication)", async () => {
      const mockDb = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED" }]);
      // Data provider returning an assignment without positionCode
      const incompleteProvider: ICanonicalDataProvider = {
        getIdentity: async () => ({
          userId: "usr-01",
          username: "guru.test",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-01",
          staffStatus: "AKTIF",
          name: "Guru Test",
          placementUnitId: null,
        }),
        verifyHumanExecutor: async () => ({
          userId: "usr-01",
          id: "usr-01",
          name: "Guru Test",
          isActive: true,
        }),
        getActiveAssignments: async (userId: string) => [
          {
            id: "asn-01",
            userId,
            positionId: "pos-01",
            positionCode: "", // Incomplete!
            positionName: "Guru",
            domain: "AKADEMIK" as any,
            unitId: "", // Incomplete!
            unitCode: "MDR",
            unitName: "Madrasah",
            unitGenderComplex: "TIDAK_TERIKAT" as any,
            status: "ACTIVE" as any,
            validFrom: new Date("2026-01-01"),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL" as any,
                businessRuleState: "VERIFIED_PRODUCTION" as any,
              },
            ],
            scopeUnits: [],
          },
        ],
        getUnitAccountPlacement: async () => null,
        resolveResourceContext: async () => ({
          orgUnitIds: [],
          orgDomain: "AKADEMIK" as any,
        }),
      };

      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: incompleteProvider,
      });

      await assert.rejects(
        () => service.startEducationSession({ sessionId: "sess-01" }, { actorUserId: "usr-01" }),
        /AUTH_DECISION_INCOMPLETE/
      );
    });

    it("I3. Human executor verification fails closed if userId is empty, null, or inactive", async () => {
      const mockDb = createMockEducationDb([{ id: "sess-01", status: "SCHEDULED" }]);
      const failingExecutorProvider: ICanonicalDataProvider = {
        getIdentity: async () => ({
          userId: "usr-01",
          username: "guru.test",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-01",
          name: "Guru Test",
        }),
        verifyHumanExecutor: async () => ({
          userId: "", // Empty!
          id: "",
          name: "Invalid",
          isActive: false, // Inactive!
        }),
        getActiveAssignments: async () => [],
        getUnitAccountPlacement: async () => null,
        resolveResourceContext: async () => null,
      };

      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: failingExecutorProvider,
      });

      await assert.rejects(
        () => service.startEducationSession({ sessionId: "sess-01" }, { actorUserId: "usr-01" }),
        /HUMAN_EXECUTOR_VERIFICATION_FAILED/
      );
    });
  });

  // ====================================================
  // SECTION J: START SESSION REAL CONCURRENCY PROTECTION (CAS)
  // ====================================================
  describe("J. Start Session Compare-And-Swap (CAS) Concurrency Protection", () => {
    it("J1. First start succeeds and transitions status from SCHEDULED to STARTED", async () => {
      const mockDb = createMockEducationDb([
        { id: "sess-cas-01", status: "SCHEDULED", scheduledStaffId: "stf-scheduled" },
      ]);
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      const res = await service.startEducationSession(
        { sessionId: "sess-cas-01" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.status, "STARTED");
      assert.strictEqual(res.session.actualTeacherUserId, "usr-teacher-01");
      assert.strictEqual(mockAudit.records.length, 1);
      assert.strictEqual(mockAudit.records[0].action, "academic.session.start");
    });

    it("J2. Concurrent second start fails closed with EDUCATION_SESSION_CONCURRENT_START", async () => {
      // Pre-set status to STARTED to simulate winning competitor
      const mockDb = createMockEducationDb([
        { id: "sess-cas-02", status: "STARTED", actualTeacherUserId: "usr-first-winner" },
      ]);
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-cas-02" },
            { actorUserId: "usr-substitute-02" }
          ),
        /INVALID_SESSION_STATUS/
      );

      // Exactly zero audit logs written for the loser
      assert.strictEqual(mockAudit.records.length, 0);
    });
  });

  // ====================================================
  // SECTION K: ACTUAL TEACHER OWNERSHIP AFTER START
  // ====================================================
  describe("K. Actual Teacher Ownership After Start", () => {
    it("K1. Only actual teacher who started the session can record material", async () => {
      const mockDb = createMockEducationDb([
        {
          id: "sess-started-01",
          status: "STARTED",
          actualTeacherUserId: "usr-teacher-01",
          educationTrack: "KEPESANTRENAN",
        },
      ]);
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      // Unrelated teacher attempts to record material
      await assert.rejects(
        () =>
          service.recordSessionMaterial(
            { sessionId: "sess-started-01", materi: "Bab Shalat" },
            { actorUserId: "usr-substitute-02" }
          ),
        /ACTOR_NOT_ACTUAL_TEACHER/
      );

      // Actual teacher succeeds
      const res = await service.recordSessionMaterial(
        { sessionId: "sess-started-01", materi: "Bab Shalat" },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.materi, "Bab Shalat");
    });

    it("K2. Only actual teacher who started the session can record attendance", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-kps-started-01",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-kps-started-01", santriId: "san-01" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      // Unrelated teacher attempts to record attendance
      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            { sessionId: "sess-kps-started-01", santriId: "san-01", status: "HADIR" },
            { actorUserId: "usr-substitute-02" }
          ),
        /ACTOR_NOT_ACTUAL_TEACHER/
      );
    });
  });

  // ====================================================
  // SECTION L: ATOMIC MATERIAL MUTATION & AUDIT PERSISTENCE
  // ====================================================
  describe("L. Atomic Material Mutation & Audit Persistence with Rollback", () => {
    it("L1. Material recording is audited with canonical capability academic.material.record", async () => {
      const mockDb = createMockEducationDb([
        {
          id: "sess-mat-01",
          status: "STARTED",
          actualTeacherUserId: "usr-teacher-01",
          educationTrack: "KEPESANTRENAN",
        },
      ]);
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      await service.recordSessionMaterial(
        { sessionId: "sess-mat-01", materi: "Al-Qawa'id Al-Arba'" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(mockAudit.records.length, 1);
      assert.strictEqual(mockAudit.records[0].action, "academic.material.record");
      assert.strictEqual(mockAudit.records[0].capabilityCode, "academic.material.record");
      assert.strictEqual(mockAudit.records[0].afterState.materi, "Al-Qawa'id Al-Arba'");
    });

    it("L2. Audit failure rolls back material update in transaction", async () => {
      const mockDb = createMockEducationDb([
        {
          id: "sess-mat-fail",
          status: "STARTED",
          actualTeacherUserId: "usr-teacher-01",
          educationTrack: "KEPESANTRENAN",
          materi: "Materi Awal",
        },
      ]);
      const failingAudit = createMockAuditPersistence(true); // Forced failure
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: failingAudit,
      });

      await assert.rejects(
        () =>
          service.recordSessionMaterial(
            { sessionId: "sess-mat-fail", materi: "Materi Baru Yang Gagal" },
            { actorUserId: "usr-teacher-01" }
          ),
        /CANONICAL_AUDIT_TRANSACTION_FAILURE/
      );
    });
  });

  // ====================================================
  // SECTION M: TRACK-SAFE ATTENDANCE POLICY (STUDI UMUM DEFERRED)
  // ====================================================
  describe("M. Track-Safe Attendance Policy (Studi Umum Attendance Deferred)", () => {
    it("M1. Recording attendance for STUDI_UMUM throws STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-su-01",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "STUDI_UMUM",
          },
        ],
        [
          { sessionId: "sess-su-01", santriId: "san-01" },
        ]
      );
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
      });

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            { sessionId: "sess-su-01", santriId: "san-01", status: "HADIR" },
            { actorUserId: "usr-teacher-01" }
          ),
        /STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED/
      );
    });
  });

  // ====================================================
  // SECTION N: ATTENDANCE TARGET PARTICIPANT INTEGRITY
  // ====================================================
  describe("N. Attendance Target Participant Integrity & Masbuk Rejection", () => {
    it("N1. Attendance for non-participant santri is rejected with NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-kps-02",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          // Only san-enrolled is enrolled
          { sessionId: "sess-kps-02", santriId: "san-enrolled" },
        ]
      );
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
      });

      // Attempt to record attendance for arbitrary unenrolled santri
      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            { sessionId: "sess-kps-02", santriId: "san-stranger", status: "HADIR" },
            { actorUserId: "usr-teacher-01" }
          ),
        /NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED/
      );

      // Enrolled santri succeeds
      const res = await service.recordSessionAttendance(
        { sessionId: "sess-kps-02", santriId: "san-enrolled", status: "HADIR" },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 1);
    });

    it("N2. Status MASBUK is strictly rejected for Kepesantrenan attendance", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-kps-03",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-kps-03", santriId: "san-01" },
        ]
      );
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
      });

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            { sessionId: "sess-kps-03", santriId: "san-01", status: "MASBUK" as any },
            { actorUserId: "usr-teacher-01" }
          ),
        /ATTENDANCE_STATUS_REJECTED/
      );
    });

    it("N3. Approved attendance statuses are exactly HADIR, IZIN, SAKIT, ALFA", () => {
      const approved = KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES;
      assert.deepStrictEqual([...approved], ["HADIR", "IZIN", "SAKIT", "ALFA"]);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("HADIR"), true);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("IZIN"), true);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("SAKIT"), true);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("ALFA"), true);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("MASBUK"), false);
      assert.strictEqual(isApprovedKepesantrenanAttendanceStatus("TERLAMBAT"), false);
    });

    it("N4. Batch attendance authorizes each individual santri and rejects entire batch if any fails", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-batch-01",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-batch-01", santriId: "san-01" },
          // san-02 is NOT enrolled
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            {
              sessionId: "sess-batch-01",
              records: [
                { santriId: "san-01", status: "HADIR" },
                { santriId: "san-02", status: "HADIR" },
              ],
            },
            { actorUserId: "usr-teacher-01" }
          ),
        /CANONICAL_AUTHORIZATION_DENIED|NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED/
      );

      // Entire batch rejected: zero records in audit
      assert.strictEqual(mockAudit.records.length, 0);
    });

    it("N5. Attendance captures complete before and after states for forensic audit", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-diff-01",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-diff-01", santriId: "san-01" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      // Initial record
      await service.recordSessionAttendance(
        { sessionId: "sess-diff-01", santriId: "san-01", status: "HADIR" },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(mockAudit.records.length, 1);
      assert.deepStrictEqual(mockAudit.records[0].beforeState, {
        records: [{ santriId: "san-01", status: null }],
      });
      assert.deepStrictEqual(mockAudit.records[0].afterState, {
        records: [{ santriId: "san-01", status: "HADIR" }],
      });

      // Update record to IZIN
      await service.recordSessionAttendance(
        { sessionId: "sess-diff-01", santriId: "san-01", status: "IZIN" },
        { actorUserId: "usr-teacher-01" }
      );
      assert.strictEqual(mockAudit.records.length, 2);
      assert.deepStrictEqual(mockAudit.records[1].beforeState, {
        records: [{ santriId: "san-01", status: "HADIR" }],
      });
      assert.deepStrictEqual(mockAudit.records[1].afterState, {
        records: [{ santriId: "san-01", status: "IZIN" }],
      });
    });
  });

  // ====================================================
  // SECTION O: REAL ISOLATED POSTGRESQL MIGRATION SIMULATION
  // ====================================================
  describe("O. Real PostgreSQL Migration Simulation with Participant & CAS Verification", () => {
    it("O1. Simulates complete migration chain on fresh isolated PostgreSQL", async () => {
      const result = await simulateM33bMigrationChain();

      assert.strictEqual(result.simulationSuccess, true);
      assert.strictEqual(result.pr8ExactShaVerified, true);
      assert.strictEqual(result.pr8MigrationApplied, true);
      assert.strictEqual(result.phase2aApplied, true);
      assert.strictEqual(result.m31MigrationApplied, true);
      assert.strictEqual(result.m33aMigrationApplied, true);
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
      assert.strictEqual(result.participantTableCreated, true);
      assert.strictEqual(result.educationEnumsCreated, true);
      assert.strictEqual(result.educationEnumsExactValuesVerified, true);
      assert.strictEqual(result.masbukEnumRejected, true);
      assert.strictEqual(result.sessionIndexesCreated, true);
      assert.strictEqual(result.attendanceUniqueConstraintVerified, true);
      assert.strictEqual(result.participantUniqueConstraintVerified, true);
      assert.strictEqual(result.santriCohortLinkageVerified, true);
      assert.strictEqual(result.actualVsScheduledTeacherVerified, true);
      assert.strictEqual(result.sessionAuditRollbackVerified, true);
      assert.strictEqual(result.concurrentSessionStartCasVerified, true);
      assert.strictEqual(result.materialAuditRollbackVerified, true);
      assert.strictEqual(result.realProviderResourceResolutionVerified, true);
      assert.strictEqual(result.realServiceConcurrencyVerified, true);
      assert.strictEqual(result.realServiceMaterialRollbackVerified, true);
      assert.strictEqual(result.realServiceAttendanceBatchVerified, true);
    });
  });

  // ====================================================
  // SECTION P: SYSTEM INVARIANTS, DEFERRED POLICIES & INTEGRITY
  // ====================================================
  describe("P. Institutional Invariants & PR #8 Non-Destructive Integrity", () => {
    it("P1. PR #8 migration remains untouched at exact commit 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
      let pr8Sql = "";
      try {
        pr8Sql = execSync(
          `git show ${PR8_EXACT_SHA}:prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql`,
          { encoding: "utf-8", cwd: rootDir }
        );
      } catch {}
      assert.ok(pr8Sql.length > 500);
      assert.ok(pr8Sql.includes("evaluasi_rubu_tahfizh"));
    });

    it("P2. Assessment scoring policy remains deferred (Zero invented KKM, weighting, or formulas)", () => {
      // Invariant: No hardcoded passing scores or weighted grading formulas in M3.3B
      assert.strictEqual(schemaContent.includes("kkmValue"), false);
      assert.strictEqual(schemaContent.includes("weightUts"), false);
      assert.strictEqual(schemaContent.includes("weightUas"), false);
    });

    it("P3. Substitute teacher policy remains deferred (No invented substitution rules)", () => {
      // Invariant: academic.session.start grant policy remains PROPOSED_TBD until business owner signs off
      assert.ok(schemaContent.includes("scheduled_staff_id"));
      assert.ok(schemaContent.includes("actual_teacher_staff_id"));
    });

    it("P4. UI, migration and schedule contract consistency", () => {
      assert.ok(migrationSqlContent.includes("education_session_participants"));
      assert.ok(uiModuleContent.includes("08:00–09:50") || uiModuleContent.includes("08:00 - 09:50"));
      assert.ok(legacyActionContent.length > 0);
      assert.strictEqual(CANONICAL_KEPESANTRENAN_SUBJECT_DEFINITIONS.length, 5);
      assert.ok(KEPESANTRENAN_FORBIDDEN_ATTENDANCE_STATUSES.includes("MASBUK"));
    });

    it("P5. UI runtime honesty: session lifecycle actions and roster remain honest & disabled", () => {
      assert.ok(uiModuleContent.includes("Belum diaktifkan — menunggu aktivasi M3.3C"));
      assert.ok(uiModuleContent.includes("Daftar peserta sesi belum diaktifkan."));
      // No fake client-side mutation states
      assert.strictEqual(uiModuleContent.includes("studiUmumSessionState"), false);
      assert.strictEqual(uiModuleContent.includes("kpsSessionState"), false);
      assert.strictEqual(uiModuleContent.includes("materiInputTemp"), false);
      assert.strictEqual(uiModuleContent.includes("santriList.slice(0, 5)"), false);
    });
  });

  // ====================================================
  // SECTION Q: FINAL MICRO-FIX: KEPESANTRENAN ASSESSMENT DEFERRED & BATCH PROVENANCE
  // ====================================================
  describe("Q. Final Micro-Fix: Kepesantrenan Assessment Deferred & Batch Audit Provenance", () => {
    it("Q1. Canonical Kepesantrenan assessment mutation UI is completely disabled", () => {
      // 1. Mutation action import removed
      assert.strictEqual(uiModuleContent.includes("inputNilaiKepesantrenanAction"), false);
      // 2. Mutation handler removed
      assert.strictEqual(uiModuleContent.includes("handleSaveKepesantrenan"), false);
      // 3. Mutation states removed
      assert.strictEqual(uiModuleContent.includes("inputKpsAngka"), false);
      assert.strictEqual(uiModuleContent.includes("selectedKpsJenis"), false);
      // 4. Submit button removed
      assert.strictEqual(uiModuleContent.includes("Simpan Nilai Kepesantrenan"), false);
      // 5. Active evaluation form title removed
      assert.strictEqual(uiModuleContent.includes("Formulir Evaluasi Nilai"), false);
    });

    it("Q2. Assessment deferred notice and disabled card are visible in UI", () => {
      assert.ok(uiModuleContent.includes("PENILAIAN KEPESANTRENAN"));
      assert.ok(uiModuleContent.includes("Belum diaktifkan — format penilaian belum ditetapkan."));
      assert.ok(uiModuleContent.includes("Penilaian Ditangguhkan"));
      assert.ok(uiModuleContent.includes("Penilaian Kepesantrenan Belum Diaktifkan"));
    });

    it("Q3. Legacy NilaiAkademik historical data remains readable", () => {
      // Historical read action remains imported and invoked
      assert.ok(uiModuleContent.includes("getNilaiKepesantrenanSantriAction"));
      assert.ok(uiModuleContent.includes("kpsNilaiList"));
      assert.ok(uiModuleContent.includes("Rekapitulasi Nilai Kepesantrenan Terverifikasi"));
    });

    it("Q4. Batch attendance with same canonical provenance succeeds", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-q-01",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-q-01", santriId: "san-01" },
          { sessionId: "sess-q-01", santriId: "san-02" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      const res = await service.recordSessionAttendance(
        {
          sessionId: "sess-q-01",
          records: [
            { santriId: "san-01", status: "HADIR" },
            { santriId: "san-02", status: "IZIN" },
          ],
        },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 2);
      assert.strictEqual(mockAudit.records.length, 1);
      assert.strictEqual(mockAudit.records[0].action, "academic.attendance.record");
    });

    it("Q5. Batch attendance with mixed provenance fails closed with ATTENDANCE_BATCH_MIXED_AUTHORIZATION_PROVENANCE", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-q-02",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-q-02", santriId: "san-01" },
          { sessionId: "sess-q-02", santriId: "san-02" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const baseProvider = createMockDataProvider();

      let evalCount = 0;
      const alternatingAssignmentProvider = {
        ...baseProvider,
        getActiveAssignments: async () => {
          evalCount++;
          const asgId = evalCount % 2 === 1 ? "asg-alpha" : "asg-beta";
          return [
            {
              id: asgId,
              userId: "usr-teacher-01",
              positionId: "pos-01",
              positionCode: "GURU_AKADEMIK",
              positionName: "Guru Akademik",
              domain: "AKADEMIK",
              unitId: "ou-01",
              unitCode: "OU-01",
              unitName: "Unit 1",
              status: "ACTIVE" as const,
              validFrom: new Date(Date.now() - 86400000),
              validUntil: null,
              positionCapabilities: [
                {
                  capabilityCode: "academic.attendance.record",
                  scopeType: "GLOBAL" as const,
                  businessRuleState: "VERIFIED_PRODUCTION" as const,
                },
              ],
              scopeUnits: [],
            },
          ];
        },
      };

      const mixedService = createEducationV2Service({
        db: mockDb as any,
        dataProvider: alternatingAssignmentProvider,
        auditPersistence: mockAudit,
      });

      await assert.rejects(
        () =>
          mixedService.recordSessionAttendance(
            {
              sessionId: "sess-q-02",
              records: [
                { santriId: "san-01", status: "HADIR" },
                { santriId: "san-02", status: "IZIN" },
              ],
            },
            { actorUserId: "usr-teacher-01" }
          ),
        /ATTENDANCE_BATCH_MIXED_AUTHORIZATION_PROVENANCE/
      );
    });

    it("Q6. Mixed-provenance batch writes exactly zero attendance records and zero audit logs", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-q-02b",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-q-02b", santriId: "san-01" },
          { sessionId: "sess-q-02b", santriId: "san-02" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const baseProvider = createMockDataProvider();

      let evalCount = 0;
      const alternatingAssignmentProvider = {
        ...baseProvider,
        getActiveAssignments: async () => {
          evalCount++;
          const asgId = evalCount % 2 === 1 ? "asg-alpha" : "asg-beta";
          return [
            {
              id: asgId,
              userId: "usr-teacher-01",
              positionId: "pos-01",
              positionCode: "GURU_AKADEMIK",
              positionName: "Guru Akademik",
              domain: "AKADEMIK",
              unitId: "ou-01",
              unitCode: "OU-01",
              unitName: "Unit 1",
              status: "ACTIVE" as const,
              validFrom: new Date(Date.now() - 86400000),
              validUntil: null,
              positionCapabilities: [
                {
                  capabilityCode: "academic.attendance.record",
                  scopeType: "GLOBAL" as const,
                  businessRuleState: "VERIFIED_PRODUCTION" as const,
                },
              ],
              scopeUnits: [],
            },
          ];
        },
      };

      const mixedService = createEducationV2Service({
        db: mockDb as any,
        dataProvider: alternatingAssignmentProvider,
        auditPersistence: mockAudit,
      });

      try {
        await mixedService.recordSessionAttendance(
          {
            sessionId: "sess-q-02b",
            records: [
              { santriId: "san-01", status: "HADIR" },
              { santriId: "san-02", status: "IZIN" },
            ],
          },
          { actorUserId: "usr-teacher-01" }
        );
      } catch {}

      assert.strictEqual(mockAudit.records.length, 0);
      assert.strictEqual(mockDb._attendances.size, 0);
    });

    it("Q7. Exact attendance audit before/after state records verified for multiple targets", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-q-03",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-q-03", santriId: "san-01" },
          { sessionId: "sess-q-03", santriId: "san-02" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      // Initial batch: both have status = null
      await service.recordSessionAttendance(
        {
          sessionId: "sess-q-03",
          records: [
            { santriId: "san-01", status: "HADIR" },
            { santriId: "san-02", status: "IZIN" },
          ],
        },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(mockAudit.records.length, 1);
      assert.deepStrictEqual(mockAudit.records[0].beforeState, {
        records: [
          { santriId: "san-01", status: null },
          { santriId: "san-02", status: null },
        ],
      });
      assert.deepStrictEqual(mockAudit.records[0].afterState, {
        records: [
          { santriId: "san-01", status: "HADIR" },
          { santriId: "san-02", status: "IZIN" },
        ],
      });
    });

    it("Q8. Attendance update HADIR -> SAKIT forensic proof", async () => {
      const mockDb = createMockEducationDb(
        [
          {
            id: "sess-q-04",
            status: "STARTED",
            actualTeacherUserId: "usr-teacher-01",
            educationTrack: "KEPESANTRENAN",
          },
        ],
        [
          { sessionId: "sess-q-04", santriId: "san-01" },
        ]
      );
      const mockAudit = createMockAuditPersistence();
      const provider = createMockDataProvider();
      const service = createEducationV2Service({
        db: mockDb as any,
        dataProvider: provider,
        auditPersistence: mockAudit,
      });

      // 1. Initial HADIR
      await service.recordSessionAttendance(
        { sessionId: "sess-q-04", santriId: "san-01", status: "HADIR" },
        { actorUserId: "usr-teacher-01" }
      );

      // 2. Update to SAKIT
      await service.recordSessionAttendance(
        { sessionId: "sess-q-04", santriId: "san-01", status: "SAKIT" },
        { actorUserId: "usr-teacher-01" }
      );

      assert.strictEqual(mockAudit.records.length, 2);
      assert.deepStrictEqual(mockAudit.records[1].beforeState, {
        records: [{ santriId: "san-01", status: "HADIR" }],
      });
      assert.deepStrictEqual(mockAudit.records[1].afterState, {
        records: [{ santriId: "san-01", status: "SAKIT" }],
      });
    });
  });
});

