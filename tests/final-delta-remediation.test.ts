/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { resolveMudabbirPermissionCapability, setTestSession } from "../lib/auth";
import { saveSetoranTahfizhCore } from "../lib/tahfizh-persistence";
import { hitungRekomendasiSabaqiPekan } from "../lib/sabaqi";
import { PendidikanV2Service } from "../lib/server/pendidikan-v2-service";
import { PrismaAuditPersistence } from "../lib/auth/canonical-audit";
import { inputNilaiAction } from "../app/actions/akademik";
import { JenisNilai } from "@prisma/client";
import prisma from "../lib/prisma";

const prismaModule = prisma as any;

describe("PR #28 FINAL DELTA REMEDIATION REGRESSION SUITE", () => {
  const rootDir = path.resolve(__dirname, "..");

  // =========================================================================
  // 1. MUDHABBIR RUNTIME CAPABILITY STATE — FAIL CLOSED
  // =========================================================================
  describe("1. Mudhabbir Runtime Capability State (VERIFIED_PRODUCTION Only)", () => {
    it("1.1. VERIFIED_PRODUCTION grants runtime capability ALLOW", async () => {
      const savedUserFindUnique = prismaModule.user.findUnique;
      const savedAssignmentFindMany = prismaModule.assignment.findMany;

      try {
        prismaModule.user.findUnique = async () => ({ id: "usr-mudabbir-verified", status: "AKTIF" });
        prismaModule.assignment.findMany = async () => [
          {
            id: "asg-mudabbir-1",
            positionId: "pos-pembina",
            position: {
              capabilities: [
                {
                  capabilityCode: "keasramaan.permission.create",
                  scopeType: "ROOM_UNIT",
                  businessRuleState: "VERIFIED_PRODUCTION",
                },
              ],
            },
          },
        ];

        const result = await resolveMudabbirPermissionCapability("usr-mudabbir-verified");
        assert.strictEqual(result.authorized, true, "VERIFIED_PRODUCTION must be ALLOWED");
        assert.strictEqual(result.assignmentId, "asg-mudabbir-1");
        assert.strictEqual(result.scopeType, "ROOM_UNIT");
      } finally {
        prismaModule.user.findUnique = savedUserFindUnique;
        prismaModule.assignment.findMany = savedAssignmentFindMany;
      }
    });

    it("1.2. APPROVED_TARGET_PENDING_TECHNICAL is strictly DENIED (Zero runtime authority)", async () => {
      const savedUserFindUnique = prismaModule.user.findUnique;
      const savedAssignmentFindMany = prismaModule.assignment.findMany;

      try {
        prismaModule.user.findUnique = async () => ({ id: "usr-mudabbir-pending", status: "AKTIF" });
        prismaModule.assignment.findMany = async () => [
          {
            id: "asg-mudabbir-pending",
            positionId: "pos-pembina",
            position: {
              capabilities: [
                {
                  capabilityCode: "keasramaan.permission.create",
                  scopeType: "ROOM_UNIT",
                  businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
                },
              ],
            },
          },
        ];

        const result = await resolveMudabbirPermissionCapability("usr-mudabbir-pending");
        assert.strictEqual(result.authorized, false, "APPROVED_TARGET_PENDING_TECHNICAL must be DENIED");
        assert.match(result.reason || "", /harus VERIFIED_PRODUCTION/);
      } finally {
        prismaModule.user.findUnique = savedUserFindUnique;
        prismaModule.assignment.findMany = savedAssignmentFindMany;
      }
    });

    it("1.3. PROPOSED_TBD is strictly DENIED (Zero runtime authority)", async () => {
      const savedUserFindUnique = prismaModule.user.findUnique;
      const savedAssignmentFindMany = prismaModule.assignment.findMany;

      try {
        prismaModule.user.findUnique = async () => ({ id: "usr-mudabbir-tbd", status: "AKTIF" });
        prismaModule.assignment.findMany = async () => [
          {
            id: "asg-mudabbir-tbd",
            positionId: "pos-pembina",
            position: {
              capabilities: [
                {
                  capabilityCode: "keasramaan.permission.create",
                  scopeType: "ROOM_UNIT",
                  businessRuleState: "PROPOSED_TBD",
                },
              ],
            },
          },
        ];

        const result = await resolveMudabbirPermissionCapability("usr-mudabbir-tbd");
        assert.strictEqual(result.authorized, false, "PROPOSED_TBD must be DENIED");
        assert.match(result.reason || "", /harus VERIFIED_PRODUCTION/);
      } finally {
        prismaModule.user.findUnique = savedUserFindUnique;
        prismaModule.assignment.findMany = savedAssignmentFindMany;
      }
    });
  });

  // =========================================================================
  // 2. SABAQI BACKDATE MUST NOT USE FUTURE SABAQ
  // =========================================================================
  describe("2. Sabaqi Backdate Temporal Causal Invariant", () => {
    it("2.1. Backdated Tuesday Sabaqi MUST DENY if Sabaq was only recorded on Friday of same week", async () => {
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-sabaqi-temporal",
            nama: "Santri Temporal",
            nis: "1009",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async (args: any) => {
            const allSabaq = [
              {
                id: "set-sabaq-monday",
                santriId: "san-sabaqi-temporal",
                jenis: "SABAQ",
                halamanMulai: 10,
                halamanSelesai: 10,
                jumlahHalaman: 1.0,
                tanggal: new Date("2026-09-07T08:00:00.000Z"), // Monday
                status: "SELESAI",
              },
              {
                id: "set-sabaq-friday",
                santriId: "san-sabaqi-temporal",
                jenis: "SABAQ",
                halamanMulai: 12,
                halamanSelesai: 12,
                jumlahHalaman: 1.0,
                tanggal: new Date("2026-09-11T08:00:00.000Z"), // Friday
                status: "SELESAI",
              },
            ];

            if (args.where?.tanggal) {
              const { gte, lte } = args.where.tanggal;
              return allSabaq.filter((s) => s.tanggal >= gte && s.tanggal <= lte);
            }
            return allSabaq;
          },
        },
      };

      // Tuesday 2026-09-08: Try to record Sabaqi for page 12
      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-sabaqi-temporal",
          jenis: "SABQI",
          juz: 1,
          halamanMulai: 12,
          halamanSelesai: 12,
          jumlahHalaman: 1.0,
          nilai: "JAYYID",
          tanggalSetoran: "2026-09-08", // Tuesday
          clientRequestId: "req-temporal-tuesday",
        },
        context: {
          userId: "usr-mt",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-mt",
        },
      });

      assert.strictEqual(res.success, false, "Tuesday Sabaqi must be DENIED when page 12 was only recorded on Friday");
      assert.match(res.message, /tidak termasuk dalam materi Sabaq/i);
    });

    it("2.2. Tuesday Sabaqi ALLOWED when Monday Sabaq covered the requested pages", async () => {
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-sabaqi-temporal-ok",
            nama: "Santri Temporal OK",
            nis: "1010",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async (args: any) => {
            const allSabaq = [
              {
                id: "set-sabaq-monday-10",
                santriId: "san-sabaqi-temporal-ok",
                jenis: "SABAQ",
                halamanMulai: 10,
                halamanSelesai: 10,
                jumlahHalaman: 1.0,
                tanggal: new Date("2026-09-07T08:00:00.000Z"), // Monday
                status: "SELESAI",
              },
            ];
            if (args.where?.tanggal) {
              const { gte, lte } = args.where.tanggal;
              return allSabaq.filter((s) => s.tanggal >= gte && s.tanggal <= lte);
            }
            return allSabaq;
          },
        },
        $transaction: async (fn: any) => {
          const tx: any = {
            setoranTahfizh: {
              findMany: async () => [
                {
                  id: "set-sabaq-monday-10",
                  santriId: "san-sabaqi-temporal-ok",
                  jenis: "SABAQ",
                  halamanMulai: 10,
                  halamanSelesai: 10,
                  jumlahHalaman: 1.0,
                  tanggal: new Date("2026-09-07T08:00:00.000Z"),
                  status: "SELESAI",
                },
              ],
              create: async (args: any) => ({
                id: "set-sabqi-ok",
                setoranCode: "SET-SABQI",
                santriId: "san-sabaqi-temporal-ok",
                tanggal: args.data.tanggal,
                createdAt: new Date(),
                santri: { nis: "1010" },
              }),
            },
            auditLog: {
              create: async () => ({ id: "aud-1" }),
            },
          };
          return await fn(tx);
        },
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-sabaqi-temporal-ok",
          jenis: "SABQI",
          juz: 1,
          halamanMulai: 10,
          halamanSelesai: 10,
          jumlahHalaman: 1.0,
          nilai: "MUMTAZ",
          tanggalSetoran: "2026-09-08", // Tuesday
          clientRequestId: "req-temporal-tuesday-ok",
        },
        context: {
          userId: "usr-mt",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-mt",
        },
      });

      assert.strictEqual(res.success, true, `Tuesday Sabaqi must SUCCEED when covered by Monday Sabaq (err: ${res.message})`);
    });
  });

  // =========================================================================
  // 3. SABAQI MALFORMED COVERAGE MUST FAIL CLOSED
  // =========================================================================
  describe("3. Sabaqi Malformed Coverage Fail-Closed", () => {
    it("3.1. Malformed stored SABAQ record fails closed with DATA_INTEGRITY_ERROR (no fallback expansion)", async () => {
      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-malformed",
            nama: "Santri Malformed",
            nis: "1011",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
          findMany: async () => [
            {
              id: "set-malformed-sabaq",
              santriId: "san-malformed",
              jenis: "SABAQ",
              // Range 1 to 10 (10 pages) but jumlahHalaman is 1.0 -> allocateSabaqPages will fail
              halamanMulai: 1,
              halamanSelesai: 10,
              jumlahHalaman: 1.0,
              tanggal: new Date("2026-09-07T08:00:00.000Z"),
              status: "SELESAI",
            },
          ],
        },
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-malformed",
          jenis: "SABQI",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1.0,
          nilai: "JAYYID",
          tanggalSetoran: "2026-09-08",
          clientRequestId: "req-malformed-1",
        },
        context: {
          userId: "usr-mt",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-mt",
        },
      });

      assert.strictEqual(res.success, false, "Must fail closed on malformed stored SABAQ");
      assert.match(res.message, /DATA_INTEGRITY_ERROR/);
    });
  });

  // =========================================================================
  // 4. STUDI UMUM GRADING = SUBJECT ACCOUNT ONLY
  // =========================================================================
  describe("4. Studi Umum Grading Authority Lockdown", () => {
    it("4.1. GA attempting Studi Umum grade mutation is DENIED", async () => {
      const originalUserFind = prismaModule.user.findUnique;
      const originalMapelFind = prismaModule.mataPelajaran.findUnique;

      try {
        setTestSession({
          userId: "usr-ga-teacher",
          username: "guru.umum",
          role: "GA",
          name: "Guru Umum",
        });

        prismaModule.user.findUnique = async () => ({
          id: "usr-ga-teacher",
          status: "AKTIF",
          accountType: "INDIVIDUAL",
        });

        prismaModule.mataPelajaran.findUnique = async () => ({
          id: "mapel-mat-umum",
          nama: "Matematika",
          kodeMapel: "MAT",
          kategori: "UMUM",
        });

        const res = await inputNilaiAction({
          santriId: "san-1",
          mapelId: "mapel-mat-umum",
          semester: 1,
          tahunAjaran: "2026/2027",
          jenis: JenisNilai.TUGAS,
          angka: 85,
        });

        assert.strictEqual(res.success, false, "GA must be DENIED from Studi Umum grading");
        assert.match(res.message, /akun teknikal mata pelajaran \(SUBJECT\)/i);
      } finally {
        setTestSession(undefined);
        prismaModule.user.findUnique = originalUserFind;
        prismaModule.mataPelajaran.findUnique = originalMapelFind;
      }
    });

    it("4.2. KS attempting Studi Umum grade mutation is DENIED", async () => {
      const originalUserFind = prismaModule.user.findUnique;
      const originalMapelFind = prismaModule.mataPelajaran.findUnique;

      try {
        setTestSession({
          userId: "usr-ks-head",
          username: "kepala.sekolah",
          role: "KS",
          name: "Kepala Sekolah",
        });

        prismaModule.user.findUnique = async () => ({
          id: "usr-ks-head",
          status: "AKTIF",
          accountType: "INDIVIDUAL",
        });

        prismaModule.mataPelajaran.findUnique = async () => ({
          id: "mapel-mat-umum",
          nama: "Matematika",
          kodeMapel: "MAT",
          kategori: "UMUM",
        });

        const res = await inputNilaiAction({
          santriId: "san-1",
          mapelId: "mapel-mat-umum",
          semester: 1,
          tahunAjaran: "2026/2027",
          jenis: JenisNilai.TUGAS,
          angka: 90,
        });

        assert.strictEqual(res.success, false, "KS must be DENIED from Studi Umum grading");
        assert.match(res.message, /akun teknikal mata pelajaran \(SUBJECT\)/i);
      } finally {
        setTestSession(undefined);
        prismaModule.user.findUnique = originalUserFind;
        prismaModule.mataPelajaran.findUnique = originalMapelFind;
      }
    });

    it("4.3. ADM attempting Studi Umum grade mutation is DENIED", async () => {
      try {
        setTestSession({
          userId: "usr-adm",
          username: "admin",
          role: "ADM",
          name: "Administrator",
        });

        const res = await inputNilaiAction({
          santriId: "san-1",
          mapelId: "mapel-mat-umum",
          semester: 1,
          tahunAjaran: "2026/2027",
          jenis: JenisNilai.TUGAS,
          angka: 95,
        });

        assert.strictEqual(res.success, false, "ADM must be strictly DENIED from grading");
        assert.match(res.message, /Role ADM tidak memiliki hak akses/i);
      } finally {
        setTestSession(undefined);
      }
    });

    it("4.4. Valid SUBJECT account with matching binding, valid started session and participant ALLOWED", async () => {
      const originalUserFind = prismaModule.user.findUnique;
      const originalMapelFind = prismaModule.mataPelajaran.findUnique;
      const originalBindingFind = prismaModule.academicSubjectAccountBinding.findUnique;
      const originalSessionFind = prismaModule.educationSession.findUnique;
      const originalNilaiCreate = prismaModule.nilaiAkademik.create;

      try {
        setTestSession({
          userId: "usr-tech-mat",
          username: "tech.mapel.mat",
          role: "GA",
          name: "Akun Mapel Matematika",
        });

        prismaModule.user.findUnique = async () => ({
          id: "usr-tech-mat",
          status: "AKTIF",
          accountType: "SUBJECT",
        });

        prismaModule.mataPelajaran.findUnique = async () => ({
          id: "mapel-mat-umum",
          nama: "Matematika",
          kodeMapel: "MAT",
          kategori: "UMUM",
        });

        prismaModule.academicSubjectAccountBinding.findUnique = async () => ({
          id: "binding-mat-1",
          userId: "usr-tech-mat",
          subjectId: "mapel-mat-umum",
          isActive: true,
        });

        prismaModule.educationSession.findUnique = async () => ({
          id: "sess-mat-1",
          educationTrack: "STUDI_UMUM",
          status: "STARTED",
          startedByUserId: "usr-tech-mat",
          subjectId: "mapel-mat-umum",
          actualTeacherName: "Ust. Handoko, M.Pd.",
          participants: [{ santriId: "san-1" }],
        });

        prismaModule.nilaiAkademik.create = async (args: any) => ({
          id: "nilai-1",
          ...args.data,
          santri: { nama: "Santri Satu", nis: "1001" },
          mapel: { nama: "Matematika" },
        });

        prismaModule.auditLog = {
          create: async () => ({ id: "aud-nilai-1" }),
        };

        const res = await inputNilaiAction({
          santriId: "san-1",
          mapelId: "mapel-mat-umum",
          educationSessionId: "sess-mat-1",
          semester: 1,
          tahunAjaran: "2026/2027",
          jenis: JenisNilai.TUGAS,
          angka: 88,
        });

        assert.strictEqual(res.success, true, `SUBJECT account with valid session must be ALLOWED (err: ${res.message})`);
        assert.strictEqual(res.data?.namaPengajarSnapshot, "Ust. Handoko, M.Pd.");
      } finally {
        setTestSession(undefined);
        prismaModule.user.findUnique = originalUserFind;
        prismaModule.mataPelajaran.findUnique = originalMapelFind;
        prismaModule.academicSubjectAccountBinding.findUnique = originalBindingFind;
        prismaModule.educationSession.findUnique = originalSessionFind;
        prismaModule.nilaiAkademik.create = originalNilaiCreate;
      }
    });
  });

  // =========================================================================
  // 5. EDUCATION READ DTO MUST MATCH SERVER AUTHORITY
  // =========================================================================
  describe("5. Education Read DTO Authority Alignment", () => {
    it("5.1. Studi Umum sessions: mutationAvailable is true ONLY for matching SUBJECT account, attendance is deferred", async () => {
      const mockDb: any = {
        educationSession: {
          findMany: async () => [
            {
              id: "sess-su-mat",
              educationTrack: "STUDI_UMUM",
              subjectId: "mapel-mat",
              status: "SCHEDULED",
              scheduledDate: new Date("2026-09-21T00:00:00Z"),
              scheduledStaffId: "stf-ahmad",
              subject: { nama: "Matematika", kodeMapel: "MAT" },
            },
          ],
        },
        educationSessionParticipant: {},
        educationSessionAttendance: {},
        academicSubjectAccountBinding: {
          findUnique: async (args: any) => {
            if (args.where?.userId === "usr-tech-mat") {
              return { userId: "usr-tech-mat", subjectId: "mapel-mat", isActive: true };
            }
            return null;
          },
        },
      };

      const mockDataProvider: any = {
        getIdentity: async (userId: string) => {
          if (userId === "usr-tech-mat") {
            return { userId, status: "AKTIF", accountType: "SUBJECT", username: "tech.mat" };
          }
          if (userId === "usr-ga-human") {
            return { userId, status: "AKTIF", accountType: "INDIVIDUAL", role: "GA", username: "guru.ahmad", staffId: "stf-ahmad" };
          }
          return null;
        },
        getActiveAssignments: async () => [
          {
            id: "asg-mock-read",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            positionId: "pos-mock-read",
            positionCode: "GURU",
            unitId: "ou-mock-1",
            scopeUnits: [],
            positionCapabilities: [
              {
                capabilityCode: "academic.schedule.read",
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
                capability: { code: "academic.schedule.read", isBlocked: false },
              },
            ],
          },
        ],
        getUnitAccountPlacement: async () => null,
        resolveResourceContext: async () => ({
          targetEntityId: "sess-su-mat",
          orgUnitIds: ["ou-mock-1"],
        }),
      };

      const service = new PendidikanV2Service({
        db: mockDb,
        dataProvider: mockDataProvider,
      } as any);

      // Call as matching SUBJECT account
      const dtosSubject = await service.getEducationSessions(undefined, { actorUserId: "usr-tech-mat" });
      const suSubjectSess = dtosSubject.find((d) => d.sessionId === "sess-su-mat");
      assert.ok(suSubjectSess);
      assert.strictEqual(suSubjectSess.mutationAvailable, true, "Matching SUBJECT account has mutationAvailable = true");
      assert.strictEqual(suSubjectSess.mutationDeniedReason, null);
      assert.strictEqual(suSubjectSess.attendanceAvailable, false, "Studi Umum attendance must be false");
      assert.strictEqual(suSubjectSess.attendanceDeniedReason, "STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED");

      // Call as human teacher (GA) without SUBJECT account
      const dtosHuman = await service.getEducationSessions(undefined, { actorUserId: "usr-ga-human" });
      const suHumanSess = dtosHuman.find((d) => d.sessionId === "sess-su-mat");
      assert.ok(suHumanSess);
      assert.strictEqual(suHumanSess.mutationAvailable, false, "Human GA has mutationAvailable = false");
      assert.strictEqual(suHumanSess.mutationDeniedReason, "SUBJECT_ACCOUNT_REQUIRED");
    });
  });

  // =========================================================================
  // 6. SUBJECT AUDIT PROVENANCE PERSISTENCE
  // =========================================================================
  describe("6. Subject Audit Provenance Persistence", () => {
    it("6.1. PrismaAuditPersistence.recordInTx passes authorizationModel and subjectId into database write", async () => {
      let capturedAuditData: any = null;
      const mockTx: any = {
        canonicalAuditLog: {
          create: async (args: any) => {
            capturedAuditData = args.data;
            return { id: args.data.id, ...args.data };
          },
        },
      };

      const persistence = new PrismaAuditPersistence();
      await persistence.recordInTx(mockTx, {
        id: "aud-subject-test",
        technicalAccountId: "usr-tech-mat",
        technicalAccountUsername: "tech.mapel.mat",
        humanExecutorId: null,
        humanExecutorName: null,
        action: "academic.session.start",
        entity: "EducationSession",
        entityId: "sess-mat-1",
        capabilityCode: "academic.session.start",
        assignmentId: null,
        positionCode: "SUBJECT_ACCOUNT",
        scopeType: null,
        unitId: null,
        authorizationModel: "SUBJECT_ACCOUNT",
        subjectId: "mapel-mat-id",
        beforeState: null,
        afterState: null,
        resourceContext: {
          educationSessionId: "sess-mat-1",
          actualTeacherName: "Ust. Handoko, M.Pd.",
        },
        timestamp: new Date(),
      });

      assert.ok(capturedAuditData, "Audit write must have occurred");
      assert.strictEqual(capturedAuditData.authorizationModel, "SUBJECT_ACCOUNT");
      assert.strictEqual(capturedAuditData.subjectId, "mapel-mat-id");
      assert.strictEqual(capturedAuditData.scopeType, null);
      assert.strictEqual(capturedAuditData.unitId, null);
      assert.strictEqual(capturedAuditData.assignmentId, null);
    });

    it("6.2. Schema and migration files define authorization_model and subject_id columns", () => {
      const schema = fs.readFileSync(path.join(rootDir, "prisma/schema.prisma"), "utf-8");
      const migration = fs.readFileSync(
        path.join(rootDir, "prisma/migrations/20260920080000_prelaunch_reconciliation/migration.sql"),
        "utf-8"
      );

      assert.ok(
        /authorizationModel\s+String\?\s+@map\("authorization_model"\)/.test(schema),
        "schema.prisma must define authorizationModel"
      );
      assert.ok(
        /subjectId\s+String\?\s+@map\("subject_id"\)/.test(schema),
        "schema.prisma must define subjectId"
      );
      assert.ok(
        migration.includes('ADD COLUMN "authorization_model" TEXT'),
        "migration.sql must add authorization_model column"
      );
      assert.ok(
        migration.includes('ADD COLUMN "subject_id" TEXT'),
        "migration.sql must add subject_id column"
      );
    });
  });

  // =========================================================================
  // 7. SABAQI HELPER CLEANUP
  // =========================================================================
  describe("7. Sabaqi Helper Fail-Closed Cleanup", () => {
    it("7.1. hitungRekomendasiSabaqiPekan returns isManualAllowed === false unconditionally", () => {
      const emptyRes = hitungRekomendasiSabaqiPekan([]);
      assert.strictEqual(emptyRes.isManualAllowed, false, "Empty Sabaq must have isManualAllowed === false");

      const withSabaqRes = hitungRekomendasiSabaqiPekan([
        {
          tanggal: new Date(),
          halamanMulai: 1,
          halamanSelesai: 2,
          jumlahHalaman: 2,
        },
      ]);
      assert.strictEqual(withSabaqRes.isManualAllowed, false, "Populated Sabaq must have isManualAllowed === false");
    });

    it("7.2. lib/sabaqi.ts has no stale manual allowance comments", () => {
      const sabaqiFile = fs.readFileSync(path.join(rootDir, "lib/sabaqi.ts"), "utf-8");
      assert.ok(
        !sabaqiFile.includes("izinkan Musyrif menginput manual"),
        "lib/sabaqi.ts must not contain stale manual allowance comment"
      );
    });
  });
});
