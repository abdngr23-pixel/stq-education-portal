(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
if (!React.createContext) {
  React.createContext = () => ({
    Provider: () => null,
    Consumer: () => null,
  });
}

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  PrismaClient,
  JenisKelamin,
  StatusKesehatan,
  AccountType,
  Role,
  EducationTrack,
  EducationSessionStatus,
  HealthStatusV2,
} from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  PENGAWAS_SANTRIWATI_POSITION_CONTRACT,
  POSITION_ACCOUNT_MODALITY_CONTRACT,
} from "../types/architecture-lock";
import { CANONICAL_POSITION_CODES } from "../lib/auth/compatibility";
import {
  authorizeCanonical,
  createPrismaDataProvider,
} from "../lib/auth/canonical-evaluator";
import {
  PendidikanV2Service,
} from "../lib/server/pendidikan-v2-service";
import {
  createHealthV2Service,
} from "../lib/server/health-v2-service";
import {
  getDaftarKesehatanAction,
  catatKesehatanAction,
} from "../app/actions/kesehatan";

describe("DIR-2026-016 / ORR-047 / ORR-049: Lisa Cross-Domain Corrective Implementation", () => {
  let prisma: PrismaClient;
  let dataProvider: any;
  let healthService: any;

  // Identifiers
  const LISA_USER_ID = "usr-lisa-test";
  const LISA_STAFF_ID = "stf-lisa-test";
  const FOREIGN_TEACHER_USER_ID = "usr-teacher-foreign";
  const FOREIGN_TEACHER_STAFF_ID = "stf-teacher-foreign";
  const SUBJECT_USER_MAT_ID = "usr-subj-mat";
  const SUBJECT_USER_BIG_ID = "usr-subj-big";
  const ORDINARY_MT_USER_ID = "usr-ordinary-mt";
  const GENERIC_OSDA_USER_ID = "usr-generic-osda";
  const MUDIR_KS_USER_ID = "usr-mudir-ks";

  const OU_ROOT_ID = "ou-stq-root-test";
  const OU_OSDA_PUTRI_ID = "ou-osda-putri-test";
  const OU_TAHFIZH_ID = "ou-tahfizh-test";

  const POS_GURU_ID = "pos-guru-kps-test";
  const POS_PENGAWAS_ID = "pos-pengawas-santriwati-test";

  const SUBJ_MAT_ID = "sbj-mat-test";
  const SUBJ_BIG_ID = "sbj-big-test";
  const SUBJ_ARB_ID = "sbj-arb-test";

  const SESS_STUDI_UMUM_ID = "sess-su-mat-test";
  const SESS_KPS_LISA_ID = "sess-kps-lisa-test";
  const SESS_KPS_FOREIGN_ID = "sess-kps-foreign-test";

  const SANTRI_PUTRI_A_ID = "san-putri-a-test";
  const SANTRI_PUTRI_B_ID = "san-putri-b-test";
  const SANTRI_PUTRA_C_ID = "san-putra-c-test";

  const CASE_PUTRI_A_ID = "case-putri-a-test";
  const CASE_PUTRI_B_ID = "case-putri-b-test";
  const CASE_PUTRA_C_ID = "case-putra-c-test";

  before(async () => {
    prisma = await startTestDatabase();
    dataProvider = createPrismaDataProvider(prisma);
    healthService = createHealthV2Service({ db: prisma, dataProvider });

    // 1. Master OrgUnits
    await prisma.orgUnit.createMany({
      data: [
        {
          id: OU_ROOT_ID,
          code: "OU-STQ-ROOT",
          name: "STQ Root",
          type: "INSTITUTION",
          domain: "INSTITUTIONAL",
          genderComplex: "TIDAK_TERIKAT",
          isActive: true,
        },
        {
          id: OU_OSDA_PUTRI_ID,
          code: "OU-OSDA-PUTRI",
          name: "OSDA Putri",
          type: "ORGANIZATION",
          domain: "KEASRAMAAN",
          genderComplex: "PUTRI",
          isActive: true,
          parentId: OU_ROOT_ID,
        },
        {
          id: OU_TAHFIZH_ID,
          code: "OU-TAHFIZH",
          name: "Tahfizh Domain",
          type: "DOMAIN",
          domain: "TAHFIZH",
          genderComplex: "TIDAK_TERIKAT",
          isActive: true,
          parentId: OU_ROOT_ID,
        },
      ],
    });

    // 2. Master Positions
    await prisma.position.createMany({
      data: [
        {
          id: POS_GURU_ID,
          code: "GURU_KEPESANTRENAN",
          name: "Guru Kepesantrenan",
          domain: "AKADEMIK",
          requiresPersonalAccount: true,
          isLeadership: false,
          allowedUnitTypes: ["INSTITUTION"],
          isActive: true,
        },
        {
          id: POS_PENGAWAS_ID,
          code: PENGAWAS_SANTRIWATI_POSITION_CONTRACT.code,
          name: PENGAWAS_SANTRIWATI_POSITION_CONTRACT.name,
          domain: PENGAWAS_SANTRIWATI_POSITION_CONTRACT.domain,
          requiresPersonalAccount: PENGAWAS_SANTRIWATI_POSITION_CONTRACT.requiresPersonalAccount,
          isLeadership: PENGAWAS_SANTRIWATI_POSITION_CONTRACT.isLeadership,
          allowedUnitTypes: [...PENGAWAS_SANTRIWATI_POSITION_CONTRACT.allowedUnitTypes],
          isActive: true,
        },
      ],
    });

    // 2b. Master Capabilities
    await prisma.capability.createMany({
      data: [
        {
          code: "academic.schedule.read",
          namespace: "ACADEMIC",
          name: "Read Academic Schedule",
          description: "Read academic schedule",
          isDangerous: false,
        },
        {
          code: "academic.session.start",
          namespace: "ACADEMIC",
          name: "Start Academic Session",
          description: "Start academic session",
          isDangerous: false,
        },
        {
          code: "health.case.read_detail",
          namespace: "HEALTH",
          name: "Read Health Case Detail",
          description: "Read health case detail",
          isDangerous: false,
        },
        {
          code: "health.case.create",
          namespace: "HEALTH",
          name: "Create Health Case",
          description: "Create health case",
          isDangerous: false,
        },
        {
          code: "health.case.update_status",
          namespace: "HEALTH",
          name: "Update Health Case Status",
          description: "Update health case status",
          isDangerous: false,
        },
        {
          code: "health.case.referral",
          namespace: "HEALTH",
          name: "Refer Health Case",
          description: "Refer health case",
          isDangerous: false,
        },
        {
          code: "keasramaan.permission.create",
          namespace: "KEASRAMAAN",
          name: "Create Keasramaan Permission",
          description: "Create keasramaan permission",
          isDangerous: false,
        },
      ],
      skipDuplicates: true,
    });

    // 3. Position Capabilities
    // GURU_KEPESANTRENAN capabilities (including academic.schedule.read GLOBAL)
    await prisma.positionCapability.createMany({
      data: [
        {
          positionId: POS_GURU_ID,
          capabilityCode: "academic.schedule.read",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
        {
          positionId: POS_GURU_ID,
          capabilityCode: "academic.session.start",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
        // PENGAWAS_SANTRIWATI: ONLY health.case.read_detail DOMAIN
        {
          positionId: POS_PENGAWAS_ID,
          capabilityCode: "health.case.read_detail",
          scopeType: "DOMAIN",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
    });

    // 4. Staff records
    await prisma.staff.createMany({
      data: [
        {
          id: LISA_STAFF_ID,
          staffCode: "STF-0005",
          nama: "Ustazah Lisa Dwina Fitri",
          noHp: "0811111111",
          roleStaff: Role.MT,
          status: "AKTIF",
        },
        {
          id: FOREIGN_TEACHER_STAFF_ID,
          staffCode: "STF-0001",
          nama: "Ust. Foreign Teacher",
          noHp: "0822222222",
          roleStaff: Role.GA,
          status: "AKTIF",
        },
      ],
    });

    // 5. Users
    await prisma.user.createMany({
      data: [
        {
          id: LISA_USER_ID,
          username: "musyirfah.putri",
          role: "MT",
          accountType: AccountType.PERSONAL,
          status: "AKTIF",
          staffId: LISA_STAFF_ID,
          passwordHash: "dummy-hash",
        },
        {
          id: FOREIGN_TEACHER_USER_ID,
          username: "teacher.foreign",
          role: "GA",
          accountType: AccountType.PERSONAL,
          status: "AKTIF",
          staffId: FOREIGN_TEACHER_STAFF_ID,
          passwordHash: "dummy-hash",
        },
        {
          id: SUBJECT_USER_MAT_ID,
          username: "tech.mapel.matematika",
          role: "GA",
          accountType: AccountType.SUBJECT,
          status: "AKTIF",
          passwordHash: "dummy-hash",
        },
        {
          id: SUBJECT_USER_BIG_ID,
          username: "tech.mapel.binggris",
          role: "GA",
          accountType: AccountType.SUBJECT,
          status: "AKTIF",
          passwordHash: "dummy-hash",
        },
        {
          id: ORDINARY_MT_USER_ID,
          username: "ordinary.mt",
          role: "MT",
          accountType: AccountType.PERSONAL,
          status: "AKTIF",
          passwordHash: "dummy-hash",
        },
        {
          id: GENERIC_OSDA_USER_ID,
          username: "generic.osda",
          role: "OSDA",
          accountType: AccountType.UNIT,
          status: "AKTIF",
          passwordHash: "dummy-hash",
        },
        {
          id: MUDIR_KS_USER_ID,
          username: "mudir.stq",
          role: "KS",
          accountType: AccountType.PERSONAL,
          status: "AKTIF",
          passwordHash: "dummy-hash",
        },
      ],
    });

    // 6. Assignments
    // Lisa has GURU_KEPESANTRENAN on OU-STQ-ROOT and PENGAWAS_SANTRIWATI on OU-OSDA-PUTRI
    await prisma.assignment.createMany({
      data: [
        {
          id: "asn-lisa-guru",
          userId: LISA_USER_ID,
          positionId: POS_GURU_ID,
          unitId: OU_ROOT_ID,
          status: "ACTIVE",
          createdById: MUDIR_KS_USER_ID,
        },
        {
          id: "asn-lisa-pengawas",
          userId: LISA_USER_ID,
          positionId: POS_PENGAWAS_ID,
          unitId: OU_OSDA_PUTRI_ID,
          status: "ACTIVE",
          createdById: MUDIR_KS_USER_ID,
        },
        {
          id: "asn-foreign-guru",
          userId: FOREIGN_TEACHER_USER_ID,
          positionId: POS_GURU_ID,
          unitId: OU_ROOT_ID,
          status: "ACTIVE",
          createdById: MUDIR_KS_USER_ID,
        },
      ],
    });

    // 7. Academic Subjects
    await prisma.mataPelajaran.createMany({
      data: [
        {
          id: SUBJ_MAT_ID,
          kodeMapel: "MAT",
          nama: "Matematika",
          kategori: "UMUM",
        },
        {
          id: SUBJ_BIG_ID,
          kodeMapel: "BIG",
          nama: "Bahasa Inggris",
          kategori: "UMUM",
        },
        {
          id: SUBJ_ARB_ID,
          kodeMapel: "ARB",
          nama: "Bahasa Arab",
          kategori: "KEPESANTRENAN",
        },
      ],
    });

    // 8. Subject Account Bindings
    await prisma.academicSubjectAccountBinding.createMany({
      data: [
        {
          id: "bnd-mat",
          userId: SUBJECT_USER_MAT_ID,
          subjectId: SUBJ_MAT_ID,
          isActive: true,
        },
        {
          id: "bnd-big",
          userId: SUBJECT_USER_BIG_ID,
          subjectId: SUBJ_BIG_ID,
          isActive: true,
        },
      ],
    });

    // 9. Education Sessions
    await prisma.educationSession.createMany({
      data: [
        // One STUDI_UMUM session
        {
          id: SESS_STUDI_UMUM_ID,
          educationTrack: EducationTrack.STUDI_UMUM,
          subjectId: SUBJ_MAT_ID,
          scheduledDate: new Date("2026-10-10"),
          status: EducationSessionStatus.SCHEDULED,
        },
        // One Kepesantrenan session scheduled to Lisa
        {
          id: SESS_KPS_LISA_ID,
          educationTrack: EducationTrack.KEPESANTRENAN,
          subjectId: SUBJ_ARB_ID,
          scheduledStaffId: LISA_STAFF_ID,
          scheduledDate: new Date("2026-10-10"),
          status: EducationSessionStatus.SCHEDULED,
        },
        // One Kepesantrenan session scheduled to foreign teacher
        {
          id: SESS_KPS_FOREIGN_ID,
          educationTrack: EducationTrack.KEPESANTRENAN,
          subjectId: SUBJ_ARB_ID,
          scheduledStaffId: FOREIGN_TEACHER_STAFF_ID,
          scheduledDate: new Date("2026-10-10"),
          status: EducationSessionStatus.SCHEDULED,
        },
      ],
    });

    // 10. Santri records: PUTRI A, PUTRI B (different kamar/topology), PUTRA C
    await prisma.santri.createMany({
      data: [
        {
          id: SANTRI_PUTRI_A_ID,
          nis: "SAN-PUTRI-001",
          nama: "Aisyah Putri A",
          kelas: "7A",
          jenisKelamin: JenisKelamin.P,
        },
        {
          id: SANTRI_PUTRI_B_ID,
          nis: "SAN-PUTRI-002",
          nama: "Fatimah Putri B",
          kelas: "8B",
          jenisKelamin: JenisKelamin.P,
        },
        {
          id: SANTRI_PUTRA_C_ID,
          nis: "SAN-PUTRA-001",
          nama: "Ali Putra C",
          kelas: "7A",
          jenisKelamin: JenisKelamin.L,
        },
      ],
    });

    // 11. Health Cases V2 for all three patients
    await prisma.healthCaseV2.createMany({
      data: [
        {
          id: CASE_PUTRI_A_ID,
          santriId: SANTRI_PUTRI_A_ID,
          occurredAt: new Date("2026-10-01"),
          keluhan: "Demam dan pusing santriwati A",
          tindakanAwal: "Istirahat di poskestren putri",
          diagnosa: null, // Test NULL diagnosis
          statusV2: HealthStatusV2.DIPANTAU,
          recordedByUserId: LISA_USER_ID,
        },
        {
          id: CASE_PUTRI_B_ID,
          santriId: SANTRI_PUTRI_B_ID,
          occurredAt: new Date("2026-10-02"),
          keluhan: "Batuk pilek santriwati B",
          tindakanAwal: "Minum obat batuk",
          diagnosa: "Flu",
          statusV2: HealthStatusV2.DIPANTAU,
          recordedByUserId: LISA_USER_ID,
        },
        {
          id: CASE_PUTRA_C_ID,
          santriId: SANTRI_PUTRA_C_ID,
          occurredAt: new Date("2026-10-03"),
          keluhan: "Cedera kaki santri putra C",
          tindakanAwal: "Kompres es",
          diagnosa: "Sprain",
          statusV2: HealthStatusV2.DIPANTAU,
          recordedByUserId: LISA_USER_ID,
        },
      ],
    });

    // 12. CatatanKesehatan (Legacy / Read Path for getDaftarKesehatanAction)
    await prisma.catatanKesehatan.createMany({
      data: [
        {
          id: "ck-putri-a",
          santriId: SANTRI_PUTRI_A_ID,
          keluhan: "Demam dan pusing santriwati A",
          diagnosa: null, // NULL diagnosis
          tindakan: "Istirahat di poskestren putri",
          status: StatusKesehatan.RAWAT_PONDOK,
          dicatatOleh: "musyirfah.putri",
        },
        {
          id: "ck-putri-b",
          santriId: SANTRI_PUTRI_B_ID,
          keluhan: "Batuk pilek santriwati B",
          diagnosa: "Flu",
          tindakan: "Minum obat batuk",
          status: StatusKesehatan.RAWAT_PONDOK,
          dicatatOleh: "musyirfah.putri",
        },
        {
          id: "ck-putra-c",
          santriId: SANTRI_PUTRA_C_ID,
          keluhan: "Cedera kaki santri putra C",
          diagnosa: "Sprain",
          tindakan: "Kompres es",
          status: StatusKesehatan.RAWAT_PONDOK,
          dicatatOleh: "musyrif.asrama",
        },
      ],
    });
  });

  after(async () => {
    setTestSession(undefined);
    await stopTestDatabase();
  });

  // =========================================================================
  // PART A — ORR-047: STRICT STUDI UMUM READ CONTAINMENT
  // =========================================================================
  describe("PART A — ORR-047: Strict Studi Umum Read Containment", () => {
    it("1. Lisa-like PERSONAL actor requesting Studi Umum track directly => PERMISSION_DENIED", async () => {
      const service = new PendidikanV2Service({ db: prisma });

      await assert.rejects(
        () => service.getEducationSessions({ educationTrack: "STUDI_UMUM" }, { actorUserId: LISA_USER_ID }),
        /PERMISSION_DENIED/
      );
    });

    it("2. Lisa-like PERSONAL actor without filter => receives only own Kepesantrenan session (NEVER Studi Umum)", async () => {
      const service = new PendidikanV2Service({ db: prisma });
      const sessions = await service.getEducationSessions(undefined, { actorUserId: LISA_USER_ID });

      assert.strictEqual(sessions.length, 1, "Lisa must see exactly 1 session");
      assert.strictEqual(sessions[0].sessionId, SESS_KPS_LISA_ID);
      assert.strictEqual(sessions[0].educationTrack, "KEPESANTRENAN");

      // Verify ZERO Studi Umum sessions returned
      const hasStudiUmum = sessions.some((s) => s.educationTrack === "STUDI_UMUM");
      assert.strictEqual(hasStudiUmum, false, "Must NEVER receive Studi Umum session");
    });

    it("3. Foreign Kepesantrenan teacher row => strictly excluded for Lisa", async () => {
      const service = new PendidikanV2Service({ db: prisma });
      const sessions = await service.getEducationSessions(undefined, { actorUserId: LISA_USER_ID });

      const hasForeignSession = sessions.some((s) => s.sessionId === SESS_KPS_FOREIGN_ID);
      assert.strictEqual(hasForeignSession, false, "Lisa must not see foreign teacher Kepesantrenan session");
    });

    it("4. SUBJECT account with matching binding => CAN read its own Studi Umum session", async () => {
      const service = new PendidikanV2Service({ db: prisma });
      const sessions = await service.getEducationSessions(undefined, { actorUserId: SUBJECT_USER_MAT_ID });

      assert.strictEqual(sessions.length, 1);
      assert.strictEqual(sessions[0].sessionId, SESS_STUDI_UMUM_ID);
      assert.strictEqual(sessions[0].subjectId, SUBJ_MAT_ID);
    });

    it("5. Wrong SUBJECT binding => DENY / 0 rows (Bahasa Inggris subject account cannot see Matematika session)", async () => {
      const service = new PendidikanV2Service({ db: prisma });

      // There is 1 session in DB (Matematika), but big account is bound to Bahasa Inggris
      await assert.rejects(
        () => service.getEducationSessions(undefined, { actorUserId: SUBJECT_USER_BIG_ID }),
        /PERMISSION_DENIED/
      );
    });
  });

  // =========================================================================
  // PART B — ORR-049: GENERIC ALL-SANTRIWATI HEALTH DETAIL POSITION
  // =========================================================================
  describe("PART B — ORR-049: Generic All-Santriwati Health Detail Position Contract", () => {
    it("1. PENGAWAS_SANTRIWATI contract satisfies exact specifications", () => {
      assert.strictEqual(PENGAWAS_SANTRIWATI_POSITION_CONTRACT.code, "PENGAWAS_SANTRIWATI");
      assert.strictEqual(PENGAWAS_SANTRIWATI_POSITION_CONTRACT.name, "Pengawas Santriwati");
      assert.strictEqual(PENGAWAS_SANTRIWATI_POSITION_CONTRACT.domain, "KEASRAMAAN");
      assert.strictEqual(PENGAWAS_SANTRIWATI_POSITION_CONTRACT.requiresPersonalAccount, true);
      assert.strictEqual(PENGAWAS_SANTRIWATI_POSITION_CONTRACT.isLeadership, false);
      assert.deepStrictEqual(
        [...PENGAWAS_SANTRIWATI_POSITION_CONTRACT.allowedUnitTypes],
        ["ORGANIZATION", "DOMAIN"]
      );
      assert.strictEqual(POSITION_ACCOUNT_MODALITY_CONTRACT.PENGAWAS_SANTRIWATI, "PERSONAL");
      assert.strictEqual(CANONICAL_POSITION_CODES.PENGAWAS_SANTRIWATI, "PENGAWAS_SANTRIWATI");
    });

    it("2. Production anchor unit OU-OSDA-PUTRI invariants verified", async () => {
      const unit = await prisma.orgUnit.findUnique({
        where: { id: OU_OSDA_PUTRI_ID },
      });
      assert.ok(unit);
      assert.strictEqual(unit?.code, "OU-OSDA-PUTRI");
      assert.strictEqual(unit?.isActive, true);
      assert.strictEqual(unit?.domain, "KEASRAMAAN");
      assert.strictEqual(unit?.genderComplex, "PUTRI");
      assert.strictEqual(unit?.type, "ORGANIZATION");
    });
  });

  // =========================================================================
  // HEALTH V2 SERVICE TESTS — SCOPE & GENDER BOUNDARY
  // =========================================================================
  describe("Health V2 Service & Canonical Evaluator: Scope & Gender Boundary", () => {

    it("1. Canonical evaluator: health.case.read_detail for PUTRI patient A => ALLOW", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "health.case.read_detail",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: false,
      });

      assert.strictEqual(decision.decision, "ALLOW");
      assert.strictEqual(decision.positionCode, "PENGAWAS_SANTRIWATI");
      assert.strictEqual(decision.scopeType, "DOMAIN");
    });

    it("2. Canonical evaluator: health.case.read_detail for PUTRI patient B (different topology) => ALLOW", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "health.case.read_detail",
        resourceContext: { santriId: SANTRI_PUTRI_B_ID },
        dataProvider,
        isMutation: false,
      });

      assert.strictEqual(decision.decision, "ALLOW");
      assert.strictEqual(decision.positionCode, "PENGAWAS_SANTRIWATI");
    });

    it("3. Canonical evaluator: health.case.read_detail for PUTRA patient C => DENY / GENDER_COMPLEX_DENIED", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "health.case.read_detail",
        resourceContext: { santriId: SANTRI_PUTRA_C_ID },
        dataProvider,
        isMutation: false,
      });

      assert.strictEqual(decision.decision, "DENY");
      assert.strictEqual(decision.code, "GENDER_COMPLEX_DENIED");
    });

    it("4. HealthV2Service.getCaseDetail PUTRI A => PASS", async () => {
      const res = await healthService.getCaseDetail(CASE_PUTRI_A_ID, { actorUserId: LISA_USER_ID });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.id, CASE_PUTRI_A_ID);
      assert.strictEqual(res.data.santriId, SANTRI_PUTRI_A_ID);
    });

    it("5. HealthV2Service.getCaseDetail PUTRI B => PASS", async () => {
      const res = await healthService.getCaseDetail(CASE_PUTRI_B_ID, { actorUserId: LISA_USER_ID });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.id, CASE_PUTRI_B_ID);
      assert.strictEqual(res.data.santriId, SANTRI_PUTRI_B_ID);
    });

    it("6. HealthV2Service.getCaseDetail PUTRA C => DENY (detail clinical access denied)", async () => {
      await assert.rejects(
        () => healthService.getCaseDetail(CASE_PUTRA_C_ID, { actorUserId: LISA_USER_ID }),
        /DETAIL_ACCESS_DENIED/
      );
    });
  });

  // =========================================================================
  // NO AUTHORITY CREEP
  // =========================================================================
  describe("No Authority Creep: Zero Mutation & Zero Unauthorized Grant", () => {

    it("1. PENGAWAS_SANTRIWATI: health.case.create => DENY", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "health.case.create",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: true,
      });
      assert.strictEqual(decision.decision, "DENY");
    });

    it("2. PENGAWAS_SANTRIWATI: health.case.update_status => DENY", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "health.case.update_status",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: true,
      });
      assert.strictEqual(decision.decision, "DENY");
    });

    it("3. PENGAWAS_SANTRIWATI: health.case.referral => DENY", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "health.case.referral",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: true,
      });
      assert.strictEqual(decision.decision, "DENY");
    });

    it("4. PENGAWAS_SANTRIWATI: keasramaan.permission.create => DENY", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: LISA_USER_ID },
        capability: "keasramaan.permission.create",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: true,
      });
      assert.strictEqual(decision.decision, "DENY");
    });

    it("5. Ordinary MT (without PENGAWAS_SANTRIWATI): health.case.read_detail => DENY", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: ORDINARY_MT_USER_ID },
        capability: "health.case.read_detail",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: false,
      });
      assert.strictEqual(decision.decision, "DENY");
    });

    it("6. Generic OSDA: health.case.read_detail => DENY", async () => {
      const decision = await authorizeCanonical({
        identity: { userId: GENERIC_OSDA_USER_ID },
        capability: "health.case.read_detail",
        resourceContext: { santriId: SANTRI_PUTRI_A_ID },
        dataProvider,
        isMutation: false,
      });
      assert.strictEqual(decision.decision, "DENY");
    });
  });

  // =========================================================================
  // HEALTH READ PATH — END TO END (getDaftarKesehatanAction)
  // =========================================================================
  describe("Health Read Path End-to-End: getDaftarKesehatanAction", () => {
    it("1. PENGAWAS_SANTRIWATI receives only PUTRI records and ZERO PUTRA leakage", async () => {
      const sessionLisa: UserSession = {
        userId: LISA_USER_ID,
        username: "musyirfah.putri",
        name: "Ustazah Lisa Dwina Fitri",
        role: "MT",
      };
      setTestSession(sessionLisa);

      const res = await getDaftarKesehatanAction();
      assert.strictEqual(res.success, true);
      assert.ok(Array.isArray(res.data));

      // Must receive exactly the 2 PUTRI records (PUTRI A and PUTRI B)
      assert.strictEqual((res.data as any[]).length, 2, "Lisa must receive only PUTRI records");
      const returnedSantriIds = (res.data as any[]).map((r: any) => r.santriId);
      assert.ok(returnedSantriIds.includes(SANTRI_PUTRI_A_ID));
      assert.ok(returnedSantriIds.includes(SANTRI_PUTRI_B_ID));
      assert.strictEqual(
        returnedSantriIds.includes(SANTRI_PUTRA_C_ID),
        false,
        "ZERO PUTRA leakage must be enforced"
      );
    });

    it("2. Ordinary MT without position/grant => DENY", async () => {
      const sessionOrdinaryMT: UserSession = {
        userId: ORDINARY_MT_USER_ID,
        username: "ordinary.mt",
        name: "Ordinary MT",
        role: "MT",
      };
      setTestSession(sessionOrdinaryMT);

      const res = await getDaftarKesehatanAction();
      assert.strictEqual(res.success, false);
      assert.match(res.message, /tidak memiliki otorisasi/i);
      assert.deepStrictEqual(res.data, []);
    });

    it("3. Generic OSDA => DENY", async () => {
      const sessionOSDA: UserSession = {
        userId: GENERIC_OSDA_USER_ID,
        username: "generic.osda",
        name: "Generic OSDA",
        role: "OSDA",
      };
      setTestSession(sessionOSDA);

      const res = await getDaftarKesehatanAction();
      assert.strictEqual(res.success, false);
      assert.match(res.message, /tidak memiliki otorisasi/i);
      assert.deepStrictEqual(res.data, []);
    });

    it("4. KS / MK / ADM => global access without regression", async () => {
      const sessionKS: UserSession = {
        userId: MUDIR_KS_USER_ID,
        username: "mudir.stq",
        name: "Mudir Pesantren",
        role: "KS",
      };
      setTestSession(sessionKS);

      const res = await getDaftarKesehatanAction();
      assert.strictEqual(res.success, true);
      assert.strictEqual((res.data as any[]).length, 3, "KS must see all records (PUTRI and PUTRA)");
    });
  });

  // =========================================================================
  // DATA HONESTY CORRECTION
  // =========================================================================
  describe("Data Honesty Correction: Null Diagnosis Preserved & Required Tindakan", () => {
    it("1. catatKesehatanAction rejects empty tindakan (do not invent it)", async () => {
      const sessionKS: UserSession = {
        userId: MUDIR_KS_USER_ID,
        username: "mudir.stq",
        name: "Mudir Pesantren",
        role: "KS",
      };
      setTestSession(sessionKS);

      const res = await catatKesehatanAction({
        santriId: SANTRI_PUTRI_A_ID,
        keluhan: "Sakit perut",
        tindakan: "", // empty tindakan
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /tindakan medis wajib diisi/i);
    });

    it("2. NULL diagnosis remains NULL upon create and database read", async () => {
      const sessionKS: UserSession = {
        userId: MUDIR_KS_USER_ID,
        username: "mudir.stq",
        name: "Mudir Pesantren",
        role: "KS",
      };
      setTestSession(sessionKS);

      const res = await catatKesehatanAction({
        santriId: SANTRI_PUTRI_A_ID,
        keluhan: "Sakit kepala ringan",
        diagnosa: "", // empty diagnosis
        tindakan: "Diberi minum air hangat",
      });

      assert.strictEqual(res.success, true);
      const createdId = (res.data as any)?.id;

      // Verify directly from DB
      const record = await prisma.catatanKesehatan.findUnique({
        where: { id: createdId },
      });
      assert.strictEqual(record?.diagnosa, null, "NULL diagnosis must persist as NULL in database");
    });
  });

  // =========================================================================
  // NAVIGATION ENTITLEMENTS
  // =========================================================================
  describe("Navigation Entitlements: Capability-Derived Visibility", () => {
    it("1. MT with canReadHealthDetail: true => isNavPermitted returns true for kesehatan", async () => {
      const { isNavPermitted } = await import("../types/navigation");
      assert.strictEqual(
        isNavPermitted("kesehatan", "MT", { canReadHealthDetail: true }),
        true
      );
    });

    it("2. Ordinary MT without canReadHealthDetail => isNavPermitted returns false for kesehatan", async () => {
      const { isNavPermitted } = await import("../types/navigation");
      assert.strictEqual(
        isNavPermitted("kesehatan", "MT", { canReadHealthDetail: false }),
        false
      );
      assert.strictEqual(isNavPermitted("kesehatan", "MT"), false);
    });

    it("3. ROLE_NAV_MAP.MT does not contain kesehatan statically", async () => {
      const { ROLE_NAV_MAP } = await import("../types/navigation");
      assert.strictEqual(ROLE_NAV_MAP.MT.includes("kesehatan"), false);
    });

    it("4. ROLE_NAV_MAP.OSDA does not contain kesehatan statically", async () => {
      const { ROLE_NAV_MAP } = await import("../types/navigation");
      assert.strictEqual(ROLE_NAV_MAP.OSDA.includes("kesehatan"), false);
    });

    it("5. KS / MK / ADM retain baseline kesehatan visibility without regression", async () => {
      const { isNavPermitted } = await import("../types/navigation");
      assert.strictEqual(isNavPermitted("kesehatan", "KS"), true);
      assert.strictEqual(isNavPermitted("kesehatan", "MK"), true);
      assert.strictEqual(isNavPermitted("kesehatan", "ADM"), true);
    });
  });
});
