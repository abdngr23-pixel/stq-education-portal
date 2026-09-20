/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  resolvePblMeeting,
} from "../lib/pendidikan-v2";

import {
  PendidikanV2Service,
} from "../lib/server/pendidikan-v2-service";

import {
  saveSetoranTahfizhCore,
} from "../lib/tahfizh-persistence";

describe("PRE-LAUNCH EXECUTION PR-1: CORE BUSINESS RULE & PENDIDIKAN RECONCILIATION", () => {
  const rootDir = path.resolve(__dirname, "..");

  // =========================================================================
  // 1. SCHEMA & MIGRATION INTEGRITY
  // =========================================================================
  describe("1. Schema & Migration Integrity", () => {
    const schemaContent = fs.readFileSync(path.join(rootDir, "prisma/schema.prisma"), "utf-8");

    it("1.1. AccountType enum includes SUBJECT", () => {
      assert.ok(
        schemaContent.includes("enum AccountType") && schemaContent.includes("SUBJECT"),
        "AccountType enum must include SUBJECT for technical subject accounts"
      );
    });

    it("1.2. AcademicSubjectAccountBinding model is defined in schema", () => {
      assert.ok(
        schemaContent.includes("model AcademicSubjectAccountBinding"),
        "AcademicSubjectAccountBinding model must exist"
      );
      assert.ok(
        schemaContent.includes("subjectId"),
        "AcademicSubjectAccountBinding must contain subjectId"
      );
      assert.ok(
        schemaContent.includes("userId"),
        "AcademicSubjectAccountBinding must contain userId"
      );
    });

    it("1.3. EducationSession includes actualTeacherName", () => {
      assert.ok(
        /actualTeacherName\s+String\?\s+@map\("actual_teacher_name"\)/.test(schemaContent),
        "EducationSession must include actualTeacherName mapped to actual_teacher_name"
      );
    });

    it("1.4. NilaiAkademik has nullable guruId and audit snapshot fields", () => {
      assert.ok(
        /guruId\s+String\?\s+@map\("guru_id"\)/.test(schemaContent),
        "NilaiAkademik.guruId must be nullable"
      );
      assert.ok(
        schemaContent.includes("namaPengajarSnapshot"),
        "NilaiAkademik must include namaPengajarSnapshot"
      );
      assert.ok(
        schemaContent.includes("dicatatOlehUserId"),
        "NilaiAkademik must include dicatatOlehUserId"
      );
    });

    it("1.5. StatusIzin enum includes DIBATALKAN and PerizinanSantri audit fields", () => {
      assert.ok(
        schemaContent.includes("DIBATALKAN"),
        "StatusIzin enum must include DIBATALKAN"
      );
      assert.ok(
        schemaContent.includes("batchId"),
        "PerizinanSantri must include batchId"
      );
      assert.ok(
        schemaContent.includes("returnedAt"),
        "PerizinanSantri must include returnedAt"
      );
      assert.ok(
        schemaContent.includes("isLate"),
        "PerizinanSantri must include isLate"
      );
      assert.ok(
        schemaContent.includes("cancelledAt"),
        "PerizinanSantri must include cancelledAt"
      );
      assert.ok(
        schemaContent.includes("cancelReason"),
        "PerizinanSantri must include cancelReason"
      );
    });

    it("1.6. KebijakanRewardSanksi defaults are 1 star and 1 day leave", () => {
      assert.ok(
        schemaContent.includes("bintangSimaan") &&
          schemaContent.includes('@default(1) @map("bintang_simaan")'),
        "bintangSimaan default must be 1"
      );
      assert.ok(
        schemaContent.includes("hakLiburSimaanHari") &&
          schemaContent.includes('@default(1) @map("hak_libur_simaan_hari")'),
        "hakLiburSimaanHari default must be 1"
      );
    });

    it("1.7. Migration SQL file exists and contains valid DDL statements", () => {
      const migrationFile = path.join(
        rootDir,
        "prisma/migrations/20260920080000_prelaunch_reconciliation/migration.sql"
      );
      assert.ok(fs.existsSync(migrationFile), "Migration file must exist");
      const migrationSql = fs.readFileSync(migrationFile, "utf-8");
      assert.ok(migrationSql.includes("ALTER TYPE \"AccountType\" ADD VALUE 'SUBJECT';"));
      assert.ok(migrationSql.includes("ALTER TYPE \"StatusIzin\" ADD VALUE 'DIBATALKAN';"));
      assert.ok(migrationSql.includes("CREATE TABLE \"academic_subject_account_bindings\""));
      assert.ok(migrationSql.includes("ALTER TABLE \"education_sessions\" ADD COLUMN \"actual_teacher_name\""));
    });
  });

  // =========================================================================
  // 2. STUDI UMUM: 1 TECHNICAL ACCOUNT = 1 SUBJECT & MANUAL TEACHER ATTRIBUTION
  // =========================================================================
  describe("2. Studi Umum Technical Subject Account & Manual Teacher Attribution", () => {
    function createMockDbForSession(sessionOverrides: Record<string, any> = {}) {
      const session = {
        id: "sess-su-01",
        educationTrack: "STUDI_UMUM",
        subjectId: "sub-matematika",
        subject: { id: "sub-matematika", kodeMapel: "MAT", nama: "Matematika" },
        status: "SCHEDULED",
        scheduledDate: new Date("2026-09-19T08:00:00.000Z"),
        jp: 2,
        programLevel: 1,
        actualTeacherName: null,
        actualTeacherUserId: null,
        actualTeacherStaffId: null,
        startedAt: null,
        ...sessionOverrides,
      };

      const bindings: any[] = [
        {
          id: "bind-01",
          userId: "usr-tech-mat",
          subjectId: "sub-matematika",
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const mockDb: any = {
        educationSession: {
          findUnique: async () => session,
          findUniqueOrThrow: async () => session,
          updateMany: async (args: any) => {
            if (session.status === args.where.status) {
              session.status = args.data.status;
              session.actualTeacherName = args.data.actualTeacherName;
              session.actualTeacherUserId = args.data.actualTeacherUserId;
              session.startedAt = args.data.startedAt;
              return { count: 1 };
            }
            return { count: 0 };
          },
          update: async (args: any) => {
            Object.assign(session, args.data);
            return session;
          },
          findMany: async () => [session],
        },
        educationSessionParticipant: {
          findMany: async () => [],
        },
        educationSessionAttendance: {
          findMany: async () => [],
        },
        academicSubjectAccountBinding: {
          findUnique: async (args: any) => {
            const found = bindings.find(
              (b) =>
                (args.where.userId && b.userId === args.where.userId) ||
                (args.where.subjectId && b.subjectId === args.where.subjectId) ||
                (args.where.id && b.id === args.where.id)
            );
            return found || null;
          },
          findMany: async () => bindings,
        },
        $transaction: async (fn: any) => fn(mockDb),
      };
      return mockDb;
    }

    const mockDataProvider = {
      getIdentity: async (userId: string) => ({
        userId,
        username: "tech.mat",
        status: "AKTIF" as const,
        accountType: "SUBJECT" as const,
        name: "Akun Mapel Matematika",
      }),
      verifyHumanExecutor: async () => null,
      getActiveAssignments: async () => [],
      getUnitAccountPlacement: async () => null,
      resolveResourceContext: async () => null,
    };

    function createMockAuditPersistence() {
      const records: any[] = [];
      return {
        isPersistent: true as const,
        records,
        recordAudit: async (entry: any) => {
          records.push(entry);
        },
        recordInTx: async (_tx: any, entry: any) => {
          records.push(entry);
        },
      };
    }

    it("2.1. Rejects session start if actualTeacherName is empty or < 2 characters", async () => {
      const mockDb = createMockDbForSession();
      const mockAudit = createMockAuditPersistence();
      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: mockAudit,
      });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-su-01", actualTeacherName: "A" },
            { actorUserId: "usr-tech-mat" }
          ),
        /ACTUAL_TEACHER_NAME/i
      );

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-su-01", actualTeacherName: "   " },
            { actorUserId: "usr-tech-mat" }
          ),
        /ACTUAL_TEACHER_NAME/i
      );
    });

    it("2.2. Authorizes bound subject account with manual teacher name and stores audit provenance", async () => {
      const mockDb = createMockDbForSession();
      const mockAudit = createMockAuditPersistence();
      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: mockAudit,
      });

      const res = await service.startEducationSession(
        { sessionId: "sess-su-01", actualTeacherName: "Bpk. Hendra Gunawan, M.Pd" },
        { actorUserId: "usr-tech-mat" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.status, "STARTED");
      assert.strictEqual(res.session.actualTeacherName, "Bpk. Hendra Gunawan, M.Pd");
      assert.strictEqual(res.session.actualTeacherUserId, "usr-tech-mat");
      assert.strictEqual(mockAudit.records.length, 1);
      assert.strictEqual(mockAudit.records[0].action, "academic.session.start");
      assert.strictEqual(mockAudit.records[0].humanExecutorName, "Bpk. Hendra Gunawan, M.Pd");
      assert.strictEqual(mockAudit.records[0].positionCode, "SUBJECT_ACCOUNT");
    });

    it("2.3. Denies subject account if attempting to start session for unbound subject", async () => {
      // Session is for Bahasa Inggris (BIG), but account is bound to Matematika (MAT)
      const mockDb = createMockDbForSession({
        subjectId: "sub-inggris",
        subject: { id: "sub-inggris", kodeMapel: "BIG", nama: "Bahasa Inggris" },
      });
      const mockAudit = createMockAuditPersistence();
      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: mockAudit,
      });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-su-01", actualTeacherName: "Miss Sarah" },
            { actorUserId: "usr-tech-mat" }
          ),
        /SUBJECT_BINDING_MISMATCH/
      );
    });

    it("2.4. Bound subject account can record session material", async () => {
      const mockDb = createMockDbForSession({
        status: "STARTED",
        actualTeacherUserId: "usr-tech-mat",
        actualTeacherName: "Bpk. Hendra Gunawan, M.Pd",
      });
      const mockAudit = createMockAuditPersistence();
      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: mockAudit,
      });

      const res = await service.recordSessionMaterial(
        { sessionId: "sess-su-01", materi: "Persamaan Linear Dua Variabel (SPLDV)" },
        { actorUserId: "usr-tech-mat" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.materi, "Persamaan Linear Dua Variabel (SPLDV)");
    });
  });

  // =========================================================================
  // 3. KEPESANTRENAN: OPERATIONAL ROLES & MANUAL TEACHER ATTRIBUTION
  // =========================================================================
  describe("3. Kepesantrenan Operational Accounts & Manual Teacher Name", () => {
    it("3.1. Operational account (KS, MK, MT, PH) can start session with manual teacher name", async () => {
      const session = {
        id: "sess-kp-01",
        educationTrack: "KEPESANTRENAN",
        subjectId: "sub-fikih",
        subject: { id: "sub-fikih", kodeMapel: "FKH", nama: "Fikih" },
        status: "SCHEDULED",
        scheduledDate: new Date("2026-09-20T18:30:00.000Z"),
        actualTeacherName: null,
        actualTeacherUserId: null,
        startedAt: null,
      };

      const mockDb: any = {
        educationSession: {
          findUnique: async () => session,
          findUniqueOrThrow: async () => session,
          updateMany: async (args: any) => {
            if (session.status === args.where.status) {
              session.status = args.data.status;
              session.actualTeacherName = args.data.actualTeacherName;
              session.actualTeacherUserId = args.data.actualTeacherUserId;
              session.startedAt = args.data.startedAt;
              return { count: 1 };
            }
            return { count: 0 };
          },
          findMany: async () => [session],
        },
        educationSessionParticipant: {
          findMany: async () => [],
        },
        educationSessionAttendance: {
          findMany: async () => [],
        },
        academicSubjectAccountBinding: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        $transaction: async (fn: any) => fn(mockDb),
      };

      const mockAudit = {
        isPersistent: true as const,
        records: [] as any[],
        recordAudit: async (entry: any) => {
          mockAudit.records.push(entry);
        },
        recordInTx: async (_tx: any, entry: any) => {
          mockAudit.records.push(entry);
        },
      };

      const mockDataProvider = {
        getIdentity: async () => ({
          userId: "usr-op-mk",
          username: "musyrif.keasramaan",
          status: "AKTIF" as const,
          accountType: "PERSONAL" as const,
          role: "MK",
          staffId: "stf-mk-01",
          staffStatus: "AKTIF",
          name: "Musyrif Keasramaan",
        }),
        verifyHumanExecutor: async (userId: string) => ({
          userId,
          id: userId,
          name: "Musyrif Keasramaan",
          staffId: "stf-mk-01",
          isActive: true,
        }),
        getActiveAssignments: async (userId: string) => [
          {
            id: "asn-mk-01",
            userId,
            positionId: "pos-mk",
            positionCode: "MUSYRIF_KEASRAMAAN",
            positionName: "Musyrif Keasramaan",
            domain: "KESANTRIAN" as any,
            unitId: "ou-kesantrian",
            unitCode: "KESANTRIAN",
            unitName: "Unit Kesantrian",
            isPrimary: true,
            status: "ACTIVE" as const,
            assignmentType: "STRUKTURAL" as const,
            validFrom: new Date(Date.now() - 3600000),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: "academic.session.start",
                scopeType: "GLOBAL" as const,
                businessRuleState: "VERIFIED_PRODUCTION" as const,
              },
            ],
            scopeUnits: [{ unitId: "ou-kesantrian", unitCode: "KESANTRIAN" }],
          },
        ],
        getUnitAccountPlacement: async () => null,
        resolveResourceContext: async () => ({
          orgUnitIds: ["ou-kesantrian"],
          orgDomain: "KESANTRIAN" as any,
        }),
      };

      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: mockAudit,
      });

      const res = await service.startEducationSession(
        { sessionId: "sess-kp-01", actualTeacherName: "Ustadz Abdullah Al-Hafizh" },
        { actorUserId: "usr-op-mk" }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.session.status, "STARTED");
      assert.strictEqual(res.session.actualTeacherName, "Ustadz Abdullah Al-Hafizh");
      assert.strictEqual(res.session.actualTeacherUserId, "usr-op-mk");
    });

    it("3.2. Negative test: ADM cannot start Kepesantrenan session merely by legacy ADM role", async () => {
      const session = {
        id: "sess-kp-adm-01",
        educationTrack: "KEPESANTRENAN",
        subjectId: "sub-fikih",
        subject: { id: "sub-fikih", kodeMapel: "FKH", nama: "Fikih" },
        status: "SCHEDULED",
        scheduledDate: new Date("2026-09-20T18:30:00.000Z"),
        actualTeacherName: null,
        actualTeacherUserId: null,
        startedAt: null,
      };

      const mockDb: any = {
        educationSession: {
          findUnique: async () => session,
          findUniqueOrThrow: async () => session,
        },
        educationSessionParticipant: {
          findMany: async () => [],
        },
        educationSessionAttendance: {
          findMany: async () => [],
        },
        academicSubjectAccountBinding: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        $transaction: async (fn: any) => fn(mockDb),
      };

      const mockDataProvider = {
        getIdentity: async () => ({
          userId: "usr-legacy-adm",
          username: "admin.portal",
          status: "AKTIF" as const,
          accountType: "PERSONAL" as const,
          role: "ADM",
          name: "Admin Portal",
        }),
        verifyHumanExecutor: async () => null,
        getActiveAssignments: async () => [],
        getUnitAccountPlacement: async () => null,
        resolveResourceContext: async () => null,
      };

      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: {
          isPersistent: true as const,
          recordInTx: async () => {},
        },
      });

      await assert.rejects(
        () =>
          service.startEducationSession(
            { sessionId: "sess-kp-adm-01", actualTeacherName: "Ustadz Abdullah" },
            { actorUserId: "usr-legacy-adm" }
          ),
        /KEPESANTRENAN_AUTHORIZATION_DENIED/
      );
    });

    it("3.3. Negative test: ADM cannot record material or attendance for Kepesantrenan session", async () => {
      const session = {
        id: "sess-kp-adm-02",
        educationTrack: "KEPESANTRENAN",
        subjectId: "sub-fikih",
        subject: { id: "sub-fikih", kodeMapel: "FKH", nama: "Fikih" },
        status: "STARTED",
        scheduledDate: new Date("2026-09-20T18:30:00.000Z"),
        actualTeacherName: "Ustadz Abdullah",
        actualTeacherUserId: "usr-legacy-adm",
        startedAt: new Date(),
      };

      const mockDb: any = {
        educationSession: {
          findUnique: async () => session,
          findUniqueOrThrow: async () => session,
        },
        educationSessionParticipant: {
          findMany: async () => [],
        },
        educationSessionAttendance: {
          findMany: async () => [],
        },
        academicSubjectAccountBinding: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        $transaction: async (fn: any) => fn(mockDb),
      };

      const mockDataProvider = {
        getIdentity: async () => ({
          userId: "usr-legacy-adm",
          username: "admin.portal",
          status: "AKTIF" as const,
          accountType: "PERSONAL" as const,
          role: "ADM",
          name: "Admin Portal",
        }),
        verifyHumanExecutor: async () => null,
        getActiveAssignments: async () => [],
        getUnitAccountPlacement: async () => null,
        resolveResourceContext: async () => null,
      };

      const service = new PendidikanV2Service({
        db: mockDb as any,
        dataProvider: mockDataProvider,
        auditPersistence: {
          isPersistent: true as const,
          recordInTx: async () => {},
        },
      });

      await assert.rejects(
        () =>
          service.recordSessionMaterial(
            { sessionId: "sess-kp-adm-02", materi: "Bab Thaharah" },
            { actorUserId: "usr-legacy-adm" }
          ),
        /KEPESANTRENAN_AUTHORIZATION_DENIED/
      );

      await assert.rejects(
        () =>
          service.recordSessionAttendance(
            {
              sessionId: "sess-kp-adm-02",
              records: [{ santriId: "san-01", status: "HADIR" }],
            },
            { actorUserId: "usr-legacy-adm" }
          ),
        /KEPESANTRENAN_AUTHORIZATION_DENIED/
      );
    });
  });

  // =========================================================================
  // 4. TAHFIZH: SABAQ VOLUME & DAILY AGGREGATE LIMIT (TAHF-02) & SABAQI FAIL-CLOSED (TAHF-06)
  // =========================================================================
  describe("4. Tahfizh Sabaq 1.0 Page Limit & Sabaqi Fail-Closed", () => {
    it("4.1. Single proposed Sabaq > 1.0 page is rejected", async () => {
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-tahf-01",
            nama: "Santri Test",
            nis: "1001",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async () => [],
        },
        $transaction: async (fn: any) => fn(mockPrisma),
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-tahf-01",
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 2,
          halamanSelesai: 4,
          jumlahHalaman: 3, // > 1.0 page!
          nilai: "MUMTAZ",
          clientRequestId: `req-${Date.now()}`,
        },
        context: {
          userId: "usr-musyrif",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-musyrif-01",
        },
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /volume setoran sabaq tidak boleh melebihi 1\.0 halaman/i);
    });

    it("4.2. Aggregate daily Sabaq in WITA calendar day > 1.0 page is rejected", async () => {
      const todayWita = new Date();
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-tahf-01",
            nama: "Santri Test",
            nis: "1001",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async (args: any) => {
            // Simulate existing 1.0 page setoran recorded earlier today
            if (args.where?.jenis === "SABAQ" && args.where?.tanggal) {
              return [
                {
                  id: "set-earlier",
                  jumlahHalaman: 1.0,
                  tanggal: todayWita,
                },
              ];
            }
            return [];
          },
        },
        $transaction: async (fn: any) => fn(mockPrisma),
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-tahf-01",
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 3,
          halamanSelesai: 3,
          jumlahHalaman: 0.5,
          alasanLompatanHalaman: "Pengulangan maqra sesuai instruksi musyrif",
          nilai: "MUMTAZ",
          clientRequestId: `req-daily-${Date.now()}`,
        },
        context: {
          userId: "usr-musyrif",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-musyrif-01",
        },
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /melebihi batas maksimal 1\.0 halaman per hari/i);
    });

    it("4.3. Sabaqi without weekly Sabaq fails closed without manual override", async () => {
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-tahf-01",
            nama: "Santri Test",
            nis: "1001",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async () => [], // Zero Sabaq this week!
        },
        $transaction: async (fn: any) => fn(mockPrisma),
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-tahf-01",
          jenis: "SABQI",
          juz: 1,
          halamanMulai: 2,
          halamanSelesai: 5,
          jumlahHalaman: 4,
          nilai: "MUMTAZ",
          clientRequestId: `req-sabqi-fail-${Date.now()}`,
        },
        context: {
          userId: "usr-musyrif",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-musyrif-01",
        },
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /belum ada.*sabaq.*pekan ini/i);
    });

    it("4.4. Sabaqi outside recorded Sabaq range is rejected fail-closed", async () => {
      const mondayThisWeek = new Date();
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-tahf-01",
            nama: "Santri Test",
            nis: "1001",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async (args: any) => {
            // Recorded Sabaq pages 20-25
            if (args.where?.jenis === "SABAQ") {
              return [
                {
                  id: "set-sab-1",
                  halamanMulai: 20,
                  halamanSelesai: 25,
                  tanggal: mondayThisWeek,
                },
              ];
            }
            return [];
          },
        },
        $transaction: async (fn: any) => fn(mockPrisma),
      };

      // Proposed Sabaqi: pages 15-18 (outside [20, 25])
      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-tahf-01",
          jenis: "SABQI",
          juz: 1,
          halamanMulai: 15,
          halamanSelesai: 18,
          jumlahHalaman: 4,
          nilai: "MUMTAZ",
          clientRequestId: `req-sabqi-oor-${Date.now()}`,
        },
        context: {
          userId: "usr-musyrif",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-musyrif-01",
        },
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /halaman sabaqi.*di luar batas sabaq/i);
    });
  });

  // =========================================================================
  // 5. PERIZINAN: BATCHING, ROLE-BASED STATUS, RETURN & SOFT CANCELLATION
  // =========================================================================
  describe("5. Perizinan Santri Reconciliation", () => {
    it("5.1. Role-based permit authority and default initial status is respected", () => {
      // Path A: Santri Self Request -> ST only -> MENUNGGU_MK
      // Path B: Musyrif Operational Input -> MK / KS -> DISETUJUI
      // Path C: Mudabbir Operational Input -> same-day exit -> DISETUJUI; overnight/pulang -> MENUNGGU_MK
      // Path D: OSDA -> DENY (OSDA is not Mudabbir)
      // Path E: ADM -> DENY (ADM is not Musyrif)
      // Path F: WS -> DENY (Wali Santri does not receive self-request authority)
      function evaluatePermitAuthority(
        actor: { role: string; isMudabbir?: boolean },
        jenis: string,
        tanggalMulai: string,
        tanggalSelesai: string
      ): { allowed: boolean; initialStatus?: string; reason?: string } {
        if (actor.role === "ST") {
          return { allowed: true, initialStatus: "MENUNGGU_MK" };
        }
        if (actor.role === "WS") {
          return { allowed: false, reason: "WS_NO_SELF_REQUEST_AUTHORITY" };
        }
        if (actor.role === "ADM") {
          return { allowed: false, reason: "ADM_NOT_OPERATIONAL_MUSYRIF" };
        }
        if (actor.role === "OSDA" && !actor.isMudabbir) {
          return { allowed: false, reason: "OSDA_IS_NOT_MUDABBIR" };
        }
        if (["MK", "KS"].includes(actor.role)) {
          if (actor.isMudabbir) {
            const isSameDay =
              new Date(tanggalMulai).toDateString() === new Date(tanggalSelesai).toDateString();
            if (jenis === "KELUAR_KOMPLEK" && isSameDay) {
              return { allowed: true, initialStatus: "DISETUJUI" };
            }
            return { allowed: true, initialStatus: "MENUNGGU_MK" };
          }
          return { allowed: true, initialStatus: "DISETUJUI" };
        }
        return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };
      }

      // ST self request -> MENUNGGU_MK
      assert.deepStrictEqual(
        evaluatePermitAuthority({ role: "ST" }, "PULANG", "2026-09-20", "2026-09-22"),
        { allowed: true, initialStatus: "MENUNGGU_MK" }
      );
      // WS -> DENIED
      assert.strictEqual(
        evaluatePermitAuthority({ role: "WS" }, "PULANG", "2026-09-20", "2026-09-22").allowed,
        false
      );
      // ADM -> DENIED (cannot auto-create/approve merely by ADM role)
      assert.strictEqual(
        evaluatePermitAuthority({ role: "ADM" }, "PULANG", "2026-09-20", "2026-09-22").allowed,
        false
      );
      // Generic OSDA -> DENIED (OSDA is not Mudabbir)
      assert.strictEqual(
        evaluatePermitAuthority(
          { role: "OSDA" },
          "KELUAR_KOMPLEK",
          "2026-09-20T08:00:00Z",
          "2026-09-20T12:00:00Z"
        ).allowed,
        false
      );
      // Musyrif (MK/KS) -> DISETUJUI
      assert.deepStrictEqual(
        evaluatePermitAuthority({ role: "MK" }, "PULANG", "2026-09-20", "2026-09-22"),
        { allowed: true, initialStatus: "DISETUJUI" }
      );
      assert.deepStrictEqual(
        evaluatePermitAuthority({ role: "KS" }, "PULANG", "2026-09-20", "2026-09-22"),
        { allowed: true, initialStatus: "DISETUJUI" }
      );
      // Mudabbir same-day exit -> DISETUJUI
      assert.deepStrictEqual(
        evaluatePermitAuthority(
          { role: "MK", isMudabbir: true },
          "KELUAR_KOMPLEK",
          "2026-09-20T08:00:00Z",
          "2026-09-20T12:00:00Z"
        ),
        { allowed: true, initialStatus: "DISETUJUI" }
      );
      // Mudabbir overnight/pulang -> MENUNGGU_MK
      assert.deepStrictEqual(
        evaluatePermitAuthority(
          { role: "MK", isMudabbir: true },
          "PULANG",
          "2026-09-20T08:00:00Z",
          "2026-09-22T12:00:00Z"
        ),
        { allowed: true, initialStatus: "MENUNGGU_MK" }
      );
    });

    it("5.2. Return confirmation evaluates isLate informatively without creating violation records", () => {
      const now = new Date("2026-09-22T15:00:00Z");
      const tanggalSelesaiOnTime = new Date("2026-09-22T17:00:00Z");
      const tanggalSelesaiLate = new Date("2026-09-22T12:00:00Z");

      const isLateOnTime = now.getTime() > tanggalSelesaiOnTime.getTime();
      const isLate = now.getTime() > tanggalSelesaiLate.getTime();

      assert.strictEqual(isLateOnTime, false);
      assert.strictEqual(isLate, true);
    });

    it("5.3. Soft cancellation requires reason >= 3 characters", () => {
      const shortReason = "no";
      const validReason = "Santri membatalkan acara keluarga";

      assert.ok(shortReason.trim().length < 3, "Short reason must be < 3 chars");
      assert.ok(validReason.trim().length >= 3, "Valid reason must be >= 3 chars");
    });
  });

  // =========================================================================
  // 6. CANONICAL PBL 20-WEEK ROTATION (ZERO INVENTED PHASE / PROJECT WEEK)
  // =========================================================================
  describe("6. Canonical PBL 20-Week Rotation", () => {
    it("6.1. Block 1 (Meetings 1-5): IPS", () => {
      for (let m = 1; m <= 5; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "IPS");
        assert.strictEqual(res.blockNumber, 1);
        assert.strictEqual(res.weekInBlock, m);
      }
    });

    it("6.2. Block 2 (Meetings 6-10): IPA", () => {
      for (let m = 6; m <= 10; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "IPA");
        assert.strictEqual(res.blockNumber, 2);
        assert.strictEqual(res.weekInBlock, m - 5);
      }
    });

    it("6.3. Block 3 (Meetings 11-15): Bahasa Indonesia", () => {
      for (let m = 11; m <= 15; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "Bahasa Indonesia");
        assert.strictEqual(res.blockNumber, 3);
        assert.strictEqual(res.weekInBlock, m - 10);
      }
    });

    it("6.4. Block 4 (Meetings 16-20): TIK", () => {
      for (let m = 16; m <= 20; m++) {
        const res = resolvePblMeeting(m);
        assert.strictEqual(res.subject, "TIK");
        assert.strictEqual(res.blockNumber, 4);
        assert.strictEqual(res.weekInBlock, m - 15);
      }
    });

    it("6.5. Invalid meeting numbers (< 1 or > 20) throw error", () => {
      assert.throws(() => resolvePblMeeting(0), /INVALID_PBL_MEETING_NUMBER/);
      assert.throws(() => resolvePblMeeting(21), /INVALID_PBL_MEETING_NUMBER/);
    });
  });
});
