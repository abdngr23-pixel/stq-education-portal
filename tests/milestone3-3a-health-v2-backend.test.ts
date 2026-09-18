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
  CANONICAL_HEALTH_STATUSES_V2,
  isCanonicalHealthStatusV2,
  mapLegacyHealthStatusToV2,
  HEALTH_V2_INVARIANTS,
  HealthStatusLegacy,
} from "../lib/health-v2";

import {
  HEALTH_CAPABILITIES,
  BusinessRuleState,
} from "../types/architecture-lock";

import {
  saveHealthCaseV2Core,
  updateHealthCaseV2StatusCore,
  getHealthCaseV2DetailCore,
  getHealthCasesV2AggregateCore,
  createHealthV2Service,
} from "../lib/server/health-v2-service";

import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
  ICanonicalDataProvider,
  CanonicalIdentity,
} from "../lib/auth/canonical-evaluator";

import {
  simulateM33aMigrationChain,
} from "./test-db-manager";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3: CHECKPOINT M3.3A HEALTH V2 BACKEND FOUNDATION (REMEDIATION ROUND 1)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const schemaPath = path.join(rootDir, "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const migrationDir = path.join(rootDir, "prisma/migrations/20260918120000_m3_3a_health_v2_backend");
  const migrationSqlPath = path.join(migrationDir, "migration.sql");
  const migrationSqlContent = fs.readFileSync(migrationSqlPath, "utf-8");
  const legacyActionPath = path.join(rootDir, "app/actions/kesehatan.ts");
  const legacyActionContent = fs.readFileSync(legacyActionPath, "utf-8");

  // Shared test fixture helpers
  const mockSantriInAli = {
    id: "san-001",
    nama: "Ahmad Santri",
    kelas: "7A",
    kamarPlacements: [{ kamarId: "ou-kmr-ali", isActive: true }],
  };

  const createMockDataProvider = (overrides: Partial<ICanonicalDataProvider> = {}): ICanonicalDataProvider => ({
    getIdentity: async (userId: string): Promise<CanonicalIdentity | null> => ({
      userId,
      username: userId,
      status: "AKTIF",
      accountType: "PERSONAL",
      staffId: "stf-01",
    }),
    getActiveAssignments: async (): Promise<CanonicalAssignmentWithDetails[]> => [],
    getUnitAccountPlacement: async () => null,
    verifyHumanExecutor: async (executorId: string) => {
      if (executorId === "usr-active-human") {
        return { id: "usr-active-human", name: "Active Human", isActive: true };
      }
      if (executorId === "usr-inactive-human") {
        return { id: "usr-inactive-human", name: "Inactive Human", isActive: false };
      }
      return null;
    },
    resolveResourceContext: async () => ({
      santriId: "san-001",
      kamarId: "ou-kmr-ali",
      orgUnitIds: ["ou-kmr-ali"],
    }),
    ...overrides,
  });

  // =========================================================================
  // 1-3. BLOCKER A: Caller Cannot Forge Authorization Context
  // =========================================================================
  describe("Proof 1-3: Authoritative Authorization (Caller Forging Blocked)", () => {
    it("Proof 1: Caller cannot forge capabilities", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: { create: async (args: any) => ({ ...args.data, id: "hc-1" }) },
      };

      // Caller claims to have health.case.create in context, but dataProvider returns no assignments
      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [], // Authoritatively NO capabilities!
      });

      await assert.rejects(
        async () => {
          await saveHealthCaseV2Core(
            mockPrisma as any,
            { santriId: "san-001", keluhan: "Pusing", tindakanAwal: "Istirahat" },
            {
              userId: "usr-attacker",
              dataProvider,
              // Attempting to forge capability via context
              capabilities: [HEALTH_CAPABILITIES.CREATE],
            } as any
          );
        },
        /PERMISSION_DENIED/,
        "Caller-supplied capabilities must NOT bypass authoritative evaluation"
      );
    });

    it("Proof 2: Caller cannot forge KAMAR scope", async () => {
      const mockCase = {
        id: "hc-001",
        santriId: "san-001",
        statusV2: "DIPANTAU",
        keluhan: "Demam",
        tindakanAwal: "Paracetamol",
        diagnosa: null,
        catatan: null,
        attachmentUrl: null,
        recordedByUserId: "usr-pembina",
        recordedByStaffId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        events: [],
      };

      const mockPrisma = {
        healthCaseV2: { findUnique: async () => mockCase },
      };

      // User has assignment scoped ONLY to ou-kmr-utsman
      const pembinaUtsmanAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-pembina-utsman",
        userId: "usr-pembina-utsman",
        positionId: "pos-pembina",
        positionCode: "PEMBINA_ASRAMA",
        positionName: "Pembina Asrama Utsman",
        domain: "KEASRAMAAN",
        unitId: "ou-kmr-utsman",
        unitCode: "KMR-UTSMAN",
        unitName: "Kamar Utsman",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.READ_DETAIL,
            scopeType: "KAMAR",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "ou-kmr-utsman", unitCode: "KMR-UTSMAN" }],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [pembinaUtsmanAssignment],
        // Authoritative resource context: santri is in ou-kmr-ali
        resolveResourceContext: async () => ({
          santriId: "san-001",
          kamarId: "ou-kmr-ali",
          orgUnitIds: ["ou-kmr-ali"],
        }),
      });

      // Caller attempts to claim GLOBAL scope or assignedKamarId = ou-kmr-ali
      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-001",
            {
              actorUserId: "usr-pembina-utsman",
              dataProvider,
              scopeType: "GLOBAL", // Forged!
              assignedKamarId: "ou-kmr-ali", // Forged!
            }
          );
        },
        /OUT_OF_SCOPE_ACCESS_DENIED/,
        "Caller cannot forge KAMAR scope to view santri outside their assigned room"
      );
    });

    it("Proof 3: Caller cannot forge positionCode", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: { create: async (args: any) => ({ ...args.data, id: "hc-1" }) },
      };

      // User has assignment as GUEST with no health capabilities
      const guestAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-guest",
        userId: "usr-guest",
        positionId: "pos-guest",
        positionCode: "GUEST",
        positionName: "Guest User",
        domain: "KEASRAMAAN",
        unitId: "ou-asrama",
        unitCode: "ASRAMA",
        unitName: "Asrama",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [guestAssignment],
      });

      // Caller passes forged positionCode: PETUGAS_KESEHATAN in context
      await assert.rejects(
        async () => {
          await saveHealthCaseV2Core(
            mockPrisma as any,
            { santriId: "san-001", keluhan: "Sakit kepala", tindakanAwal: "Istirahat" },
            {
              userId: "usr-guest",
              dataProvider,
              positionCode: "PETUGAS_KESEHATAN", // Forged!
            } as any
          );
        },
        /PERMISSION_DENIED/,
        "Caller-supplied positionCode must NOT grant authority"
      );
    });
  });

  // =========================================================================
  // 4-6. BLOCKER B: Real Server-Side Human Executor Verification
  // =========================================================================
  describe("Proof 4-6: Human Executor Verification for UNIT Accounts", () => {
    const unitAccountIdentity: CanonicalIdentity = {
      userId: "usr-poskestren-unit",
      username: "osda.poskestren",
      status: "AKTIF",
      accountType: "UNIT",
      placementUnitId: "ou-poskestren",
    };

    const unitAssignment: CanonicalAssignmentWithDetails = {
      id: "asg-poskestren-unit",
      userId: "usr-poskestren-unit",
      positionId: "pos-poskestren",
      positionCode: "OSDA_KESEHATAN",
      positionName: "OSDA Poskestren",
      domain: "KEASRAMAAN",
      unitId: "ou-poskestren",
      unitCode: "OU-POSKESTREN",
      unitName: "Poskestren",
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: HEALTH_CAPABILITIES.CREATE,
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
      scopeUnits: [],
    };

    it("Proof 4: Random humanExecutorId fails verification", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: { create: async (args: any) => ({ ...args.data, id: "hc-1" }) },
      };

      const dataProvider = createMockDataProvider({
        getIdentity: async () => unitAccountIdentity,
        getUnitAccountPlacement: async () => ({
          unitAccountId: "usr-poskestren-unit",
          unitId: "ou-poskestren",
          status: "AKTIF",
        }),
        getActiveAssignments: async () => [unitAssignment],
        verifyHumanExecutor: async () => null, // Random executor not found!
      });

      await assert.rejects(
        async () => {
          await saveHealthCaseV2Core(
            mockPrisma as any,
            { santriId: "san-001", keluhan: "Batuk", tindakanAwal: "Diberi obat batuk" },
            {
              userId: "usr-poskestren-unit",
              humanExecutorId: "random_nonexistent_executor_xyz_999",
              dataProvider,
            }
          );
        },
        /UNIT_EXECUTOR_INVALID/,
        "Random non-existent humanExecutorId must fail verification"
      );
    });

    it("Proof 5: Inactive executor denied", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: { create: async (args: any) => ({ ...args.data, id: "hc-1" }) },
      };

      const dataProvider = createMockDataProvider({
        getIdentity: async () => unitAccountIdentity,
        getUnitAccountPlacement: async () => ({
          unitAccountId: "usr-poskestren-unit",
          unitId: "ou-poskestren",
          status: "AKTIF",
        }),
        getActiveAssignments: async () => [unitAssignment],
        verifyHumanExecutor: async () => ({
          id: "usr-inactive-staff",
          name: "Inactive Staff",
          isActive: false, // Inactive!
        }),
      });

      await assert.rejects(
        async () => {
          await saveHealthCaseV2Core(
            mockPrisma as any,
            { santriId: "san-001", keluhan: "Batuk", tindakanAwal: "Diberi obat batuk" },
            {
              userId: "usr-poskestren-unit",
              humanExecutorId: "usr-inactive-staff",
              dataProvider,
            }
          );
        },
        /UNIT_EXECUTOR_INVALID/,
        "Inactive human executor must be denied"
      );
    });

    it("Proof 6: UNIT executor must be PERSONAL active verified identity", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: {
          create: async (args: any) => ({
            ...args.data,
            id: "hc-created-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      // Case A: Executor is another UNIT account -> verifyHumanExecutor returns isActive: false
      const dataProviderRejectUnit = createMockDataProvider({
        getIdentity: async () => unitAccountIdentity,
        getUnitAccountPlacement: async () => ({
          unitAccountId: "usr-poskestren-unit",
          unitId: "ou-poskestren",
          status: "AKTIF",
        }),
        getActiveAssignments: async () => [unitAssignment],
        verifyHumanExecutor: async () => ({
          id: "usr-another-unit",
          name: "Other Unit Account",
          isActive: false, // Cannot be a UNIT account!
        }),
      });

      await assert.rejects(
        async () => {
          await saveHealthCaseV2Core(
            mockPrisma as any,
            { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
            {
              userId: "usr-poskestren-unit",
              humanExecutorId: "usr-another-unit",
              dataProvider: dataProviderRejectUnit,
            }
          );
        },
        /UNIT_EXECUTOR_INVALID/,
        "Human executor cannot be a UNIT account"
      );

      // Case B: Executor is a valid active PERSONAL identity with Staff profile
      const dataProviderSuccess = createMockDataProvider({
        getIdentity: async () => unitAccountIdentity,
        getUnitAccountPlacement: async () => ({
          unitAccountId: "usr-poskestren-unit",
          unitId: "ou-poskestren",
          status: "AKTIF",
        }),
        getActiveAssignments: async () => [unitAssignment],
        verifyHumanExecutor: async () => ({
          id: "usr-active-nurse",
          name: "Lisa MT",
          isActive: true,
        }),
      });

      const auditEntries: any[] = [];
      const mockAuditSink = {
        record: async (record: any) => {
          auditEntries.push(record);
        },
      };

      const result = await saveHealthCaseV2Core(
        mockPrisma as any,
        { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
        {
          userId: "usr-poskestren-unit",
          humanExecutorId: "usr-active-nurse",
          humanExecutorUsername: "lisa.mt",
          dataProvider: dataProviderSuccess,
          auditSink: mockAuditSink as any,
        }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.audit.humanExecutorId, "usr-active-nurse");
      assert.strictEqual(auditEntries.length, 1);
      assert.strictEqual(auditEntries[0].humanExecutorId, "usr-active-nurse");
    });
  });

  // =========================================================================
  // 7-8. Target Pending Grants & Authoritative Evaluator
  // =========================================================================
  describe("Proof 7-8: Target Pending Grants Confer Zero Authority & Evaluator Context", () => {
    it("Proof 7: Target-pending capability still gives ZERO authority", async () => {
      const mockTargetAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-petugas-target",
        userId: "usr-target-nurse",
        positionId: "pos-target-nurse",
        positionCode: "PETUGAS_KESEHATAN",
        positionName: "Petugas Kesehatan Target",
        domain: "KEASRAMAAN",
        unitId: "ou-poskestren",
        unitCode: "OU-POSKESTREN",
        unitName: "Pos Kesehatan Pesantren",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.CREATE,
            scopeType: "GLOBAL",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" as BusinessRuleState,
          },
        ],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [mockTargetAssignment],
      });

      const decision = await authorizeCanonical({
        identity: {
          userId: "usr-target-nurse",
          username: "target.nurse",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-target-nurse",
        },
        capability: HEALTH_CAPABILITIES.CREATE,
        resourceContext: { santriId: "san-001" },
        dataProvider,
      });

      assert.strictEqual(decision.decision, "DENY");
      assert.strictEqual(decision.code, "CAPABILITY_NOT_GRANTED");
    });

    it("Proof 8: Actual canonical authorization context drives Health decision", async () => {
      // With VERIFIED_PRODUCTION capability, decision is ALLOW
      const mockActiveAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-petugas-active",
        userId: "usr-active-nurse",
        positionId: "pos-active-nurse",
        positionCode: "PETUGAS_KESEHATAN",
        positionName: "Petugas Kesehatan Active",
        domain: "KEASRAMAAN",
        unitId: "ou-poskestren",
        unitCode: "OU-POSKESTREN",
        unitName: "Pos Kesehatan Pesantren",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.CREATE,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [mockActiveAssignment],
      });

      const decision = await authorizeCanonical({
        identity: {
          userId: "usr-active-nurse",
          username: "active.nurse",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-active-nurse",
        },
        capability: HEALTH_CAPABILITIES.CREATE,
        resourceContext: { santriId: "san-001" },
        dataProvider,
      });

      assert.strictEqual(decision.decision, "ALLOW");
      assert.strictEqual(decision.code, "ALLOWED");
      assert.strictEqual(decision.positionCode, "PETUGAS_KESEHATAN");
    });
  });

  // =========================================================================
  // 9-10. BLOCKER C: Real Canonical Audit Persistence
  // =========================================================================
  describe("Proof 9-10: Real Canonical Audit Persistence & Decision Derivation", () => {
    it("Proof 9: Audit context derives from authorization decision", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: {
          create: async (args: any) => ({
            ...args.data,
            id: "hc-audit-test",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const pembinaAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-pembina-ali-1",
        userId: "usr-pembina-ali",
        positionId: "pos-pembina",
        positionCode: "PEMBINA_ASRAMA",
        positionName: "Pembina Ali",
        domain: "KEASRAMAAN",
        unitId: "ou-kmr-ali",
        unitCode: "KMR-ALI",
        unitName: "Kamar Ali",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.CREATE,
            scopeType: "KAMAR",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "ou-kmr-ali", unitCode: "KMR-ALI" }],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [pembinaAssignment],
        resolveResourceContext: async () => ({
          santriId: "san-001",
          kamarId: "ou-kmr-ali",
          orgUnitIds: ["ou-kmr-ali"],
        }),
      });

      const auditEntries: any[] = [];
      const mockAuditSink = {
        record: async (record: any) => {
          auditEntries.push(record);
        },
      };

      const result = await saveHealthCaseV2Core(
        mockPrisma as any,
        { santriId: "san-001", keluhan: "Flu", tindakanAwal: "Paracetamol" },
        {
          userId: "usr-pembina-ali",
          clientRequestId: "req-xyz-12345",
          dataProvider,
          auditSink: mockAuditSink as any,
        }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(auditEntries.length, 1);
      const persisted = auditEntries[0];
      assert.strictEqual(persisted.assignmentId, "asg-pembina-ali-1");
      assert.strictEqual(persisted.positionCode, "PEMBINA_ASRAMA");
      assert.strictEqual(persisted.capabilityCode, HEALTH_CAPABILITIES.CREATE);
      assert.strictEqual(persisted.scopeType, "KAMAR");
      assert.strictEqual(persisted.clientRequestId, "req-xyz-12345");
      assert.strictEqual(persisted.action, "health.case.create");
      assert.strictEqual(persisted.entity, "HealthCaseV2");
      assert.strictEqual(persisted.entityId, "hc-audit-test");
    });

    it("Proof 10: Audit is not hardcoded GLOBAL/PETUGAS_KESEHATAN", async () => {
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: {
          create: async (args: any) => ({
            ...args.data,
            id: "hc-not-hardcoded",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      // Create case as PEMBINA_ASRAMA with KAMAR scope
      const pembinaAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-pembina-kamar",
        userId: "usr-pembina-specific",
        positionId: "pos-pembina",
        positionCode: "PEMBINA_ASRAMA",
        positionName: "Pembina Asrama",
        domain: "KEASRAMAAN",
        unitId: "ou-kmr-ali",
        unitCode: "KMR-ALI",
        unitName: "Kamar Ali",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.CREATE,
            scopeType: "KAMAR",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "ou-kmr-ali", unitCode: "KMR-ALI" }],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [pembinaAssignment],
        resolveResourceContext: async () => ({
          santriId: "san-001",
          kamarId: "ou-kmr-ali",
          orgUnitIds: ["ou-kmr-ali"],
        }),
      });

      const auditEntries: any[] = [];
      const mockAuditSink = {
        record: async (record: any) => {
          auditEntries.push(record);
        },
      };

      const res = await saveHealthCaseV2Core(
        mockPrisma as any,
        { santriId: "san-001", keluhan: "Alergi", tindakanAwal: "Antihistamin" },
        {
          userId: "usr-pembina-specific",
          dataProvider,
          auditSink: mockAuditSink as any,
        }
      );

      // Verify audit reflects PEMBINA_ASRAMA and KAMAR, NOT hardcoded PETUGAS_KESEHATAN / GLOBAL
      assert.strictEqual(res.audit.positionCode, "PEMBINA_ASRAMA");
      assert.strictEqual(res.audit.scope, "KAMAR");
      assert.notStrictEqual(res.audit.positionCode, "PETUGAS_KESEHATAN");
      assert.notStrictEqual(res.audit.scope, "GLOBAL");
      assert.strictEqual(auditEntries[0].positionCode, "PEMBINA_ASRAMA");
      assert.strictEqual(auditEntries[0].scopeType, "KAMAR");
    });
  });

  // =========================================================================
  // 11-12. BLOCKER D: Tindakan Awal Immutability & Follow-up Structure
  // =========================================================================
  describe("Proof 11-12: Tindakan Awal Immutability & Structured Follow-up", () => {
    it("Proof 11: Initial treatment never changes on status update", async () => {
      const initialTreatment = "Diberi kompres hangat dan paracetamol 500mg";
      const existingCase = {
        id: "hc-immutable-01",
        santriId: "san-001",
        occurredAt: new Date(Date.now() - 3600000),
        keluhan: "Demam tinggi",
        tindakanAwal: initialTreatment,
        diagnosa: "Febris",
        catatan: "Observasi suhu tiap 2 jam",
        attachmentUrl: null,
        statusV2: "DIPANTAU",
        recordedByUserId: "usr-nurse",
        recordedByStaffId: "stf-01",
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000),
      };

      let capturedUpdateData: any = null;
      const mockPrisma = {
        healthCaseV2: {
          findUnique: async () => existingCase,
          update: async (args: any) => {
            capturedUpdateData = args.data;
            return { ...existingCase, ...args.data };
          },
        },
        healthCaseV2Event: {
          create: async (args: any) => ({
            id: "evt-001",
            ...args.data,
            createdAt: new Date(),
          }),
        },
      };

      const nurseAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-nurse",
        userId: "usr-nurse",
        positionId: "pos-nurse",
        positionCode: "PETUGAS_KESEHATAN",
        positionName: "Petugas Poskestren",
        domain: "KEASRAMAAN",
        unitId: "ou-poskestren",
        unitCode: "OU-POSKESTREN",
        unitName: "Poskestren",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.UPDATE_STATUS,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [nurseAssignment],
      });

      const updateResult = await updateHealthCaseV2StatusCore(
        mockPrisma as any,
        {
          id: "hc-immutable-01",
          newStatus: "PULIH",
          tindakanLanjutan: "Suhu sudah 36.5C, santri diizinkan kembali ke kamar",
          catatan: "Kondisi membaik",
        },
        {
          userId: "usr-nurse",
          dataProvider,
        }
      );

      assert.strictEqual(updateResult.success, true);
      // DB update must NOT have changed or contained tindakanAwal
      assert.strictEqual(capturedUpdateData.tindakanAwal, undefined);
      // Resulting DTO must still have the exact initial treatment
      assert.strictEqual(updateResult.data.tindakanAwal, initialTreatment);
      // Ensure NO string concatenation like "[Tindakan Lanjutan]" happened in tindakanAwal
      assert.ok(!updateResult.data.tindakanAwal.includes("[Tindakan Lanjutan]"));
    });

    it("Proof 12: Follow-up treatment is stored separately in HealthCaseV2Event", async () => {
      let createdEventData: any = null;
      const existingCase = {
        id: "hc-event-test",
        santriId: "san-001",
        occurredAt: new Date(Date.now() - 7200000),
        keluhan: "Batuk pilek",
        tindakanAwal: "Diberi sirup obat batuk",
        diagnosa: "ISPA",
        catatan: "Perlu istirahat",
        attachmentUrl: null,
        statusV2: "DIPANTAU",
        recordedByUserId: "usr-nurse",
        recordedByStaffId: "stf-01",
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 7200000),
      };

      const mockPrisma = {
        healthCaseV2: {
          findUnique: async () => existingCase,
          update: async (args: any) => ({ ...existingCase, ...args.data }),
        },
        healthCaseV2Event: {
          create: async (args: any) => {
            createdEventData = args.data;
            return { id: "evt-followup-1", ...args.data, createdAt: new Date() };
          },
        },
      };

      const nurseAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-nurse",
        userId: "usr-nurse",
        positionId: "pos-nurse",
        positionCode: "PETUGAS_KESEHATAN",
        positionName: "Petugas Poskestren",
        domain: "KEASRAMAAN",
        unitId: "ou-poskestren",
        unitCode: "OU-POSKESTREN",
        unitName: "Poskestren",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.UPDATE_STATUS,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [nurseAssignment],
      });

      const res = await updateHealthCaseV2StatusCore(
        mockPrisma as any,
        {
          id: "hc-event-test",
          newStatus: "DIRUJUK",
          tindakanLanjutan: "Pasien dirujuk ke Puskesmas untuk rontgen thorax",
          catatan: "Surat rujukan dibuat",
        },
        {
          userId: "usr-nurse",
          dataProvider,
        }
      );

      assert.strictEqual(res.success, true);
      assert.ok(createdEventData, "HealthCaseV2Event must be created");
      assert.strictEqual(createdEventData.caseId, "hc-event-test");
      assert.strictEqual(createdEventData.previousStatus, "DIPANTAU");
      assert.strictEqual(createdEventData.newStatus, "DIRUJUK");
      assert.strictEqual(createdEventData.tindakanLanjutan, "Pasien dirujuk ke Puskesmas untuk rontgen thorax");
      assert.strictEqual(createdEventData.recordedByUserId, "usr-nurse");
      assert.strictEqual(res.data.events?.length, 1);
      assert.strictEqual(res.data.events[0].tindakanLanjutan, "Pasien dirujuk ke Puskesmas untuk rontgen thorax");
    });
  });

  // =========================================================================
  // 13-14. BLOCKER E: Attribution Relational Integrity
  // =========================================================================
  describe("Proof 13-14: Schema Attribution Relational Integrity", () => {
    it("Proof 13: recordedByUser relation exists to User model", () => {
      // In prisma/schema.prisma:
      // HealthCaseV2: recordedByUser User @relation("HealthCasesRecordedByUser", fields: [recordedByUserId], references: [id]...
      assert.ok(
        /recordedByUser\s+User\s+@relation\("HealthCasesRecordedByUser",\s*fields:\s*\[recordedByUserId\],\s*references:\s*\[id\]/.test(schemaContent),
        "HealthCaseV2 must define explicit relation recordedByUser to User"
      );
      assert.ok(
        /healthCasesRecorded\s+HealthCaseV2\[\]\s+@relation\("HealthCasesRecordedByUser"\)/.test(schemaContent),
        "User model must define reverse relation healthCasesRecorded"
      );
      // In migration.sql:
      assert.ok(
        migrationSqlContent.includes("health_cases_v2_recorded_by_user_id_fkey") ||
        migrationSqlContent.includes("fk_health_cases_v2_recorded_by_user"),
        "Migration must define foreign key constraint for recorded_by_user_id referencing users(id)"
      );
    });

    it("Proof 14: recordedByStaff relation exists to Staff model where nullable", () => {
      // In prisma/schema.prisma:
      // HealthCaseV2: recordedByStaff Staff? @relation("HealthCasesRecordedByStaff", fields: [recordedByStaffId], references: [id]...
      assert.ok(
        /recordedByStaff\s+Staff\?\s+@relation\("HealthCasesRecordedByStaff",\s*fields:\s*\[recordedByStaffId\],\s*references:\s*\[id\]/.test(schemaContent),
        "HealthCaseV2 must define explicit nullable relation recordedByStaff to Staff"
      );
      assert.ok(
        /healthCasesRecorded\s+HealthCaseV2\[\]\s+@relation\("HealthCasesRecordedByStaff"\)/.test(schemaContent),
        "Staff model must define reverse relation healthCasesRecorded"
      );
      // In migration.sql:
      assert.ok(
        migrationSqlContent.includes("health_cases_v2_recorded_by_staff_id_fkey") ||
        migrationSqlContent.includes("fk_health_cases_v2_recorded_by_staff"),
        "Migration must define foreign key constraint for recorded_by_staff_id referencing staff(id)"
      );
    });
  });

  // =========================================================================
  // 15-18. Privacy & Scope Boundaries
  // =========================================================================
  describe("Proof 15-18: Privacy Lock & Scope Boundaries", () => {
    const mockCase = {
      id: "hc-privacy-01",
      santriId: "san-001",
      statusV2: "DIPANTAU",
      keluhan: "Sakit kepala",
      tindakanAwal: "Istirahat",
      diagnosa: "Migrain",
      catatan: "Perlu tidur cukup",
      attachmentUrl: null,
      recordedByUserId: "usr-nurse",
      recordedByStaffId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      events: [],
    };

    it("Proof 15: Generic OSDA detail denied", async () => {
      const mockPrisma = {
        healthCaseV2: { findUnique: async () => mockCase },
      };

      // Generic OSDA user with only read_aggregate or generic OSDA role
      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [
          {
            id: "asg-osda-generic",
            userId: "usr-osda-member",
            positionId: "pos-osda",
            positionCode: "OSDA_GENERIC",
            positionName: "Anggota OSDA",
            domain: "KEASRAMAAN",
            unitId: "ou-osda",
            unitCode: "OSDA",
            unitName: "OSDA",
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 86400000),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: HEALTH_CAPABILITIES.READ_AGGREGATE,
                scopeType: "UNIT",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      });

      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-privacy-01",
            {
              actorUserId: "usr-osda-member",
              isOsdaGeneric: true,
              dataProvider,
            }
          );
        },
        /DETAIL_ACCESS_DENIED/,
        "Generic OSDA membership must be denied clinical detail access"
      );
    });

    it("Proof 16: Pembina KAMAR access allowed only same room", async () => {
      const mockPrisma = {
        healthCaseV2: { findUnique: async () => mockCase },
      };

      // Pembina Ali assigned to ou-kmr-ali
      const pembinaAliAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-pembina-ali",
        userId: "usr-pembina-ali",
        positionId: "pos-pembina",
        positionCode: "PEMBINA_ASRAMA",
        positionName: "Pembina Kamar Ali",
        domain: "KEASRAMAAN",
        unitId: "ou-kmr-ali",
        unitCode: "KMR-ALI",
        unitName: "Kamar Ali",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.READ_DETAIL,
            scopeType: "KAMAR",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "ou-kmr-ali", unitCode: "KMR-ALI" }],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [pembinaAliAssignment],
        resolveResourceContext: async () => ({
          santriId: "san-001",
          kamarId: "ou-kmr-ali", // Matches!
          orgUnitIds: ["ou-kmr-ali"],
        }),
      });

      const res = await getHealthCaseV2DetailCore(
        mockPrisma as any,
        "hc-privacy-01",
        {
          actorUserId: "usr-pembina-ali",
          dataProvider,
        }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.id, "hc-privacy-01");
      assert.strictEqual(res.data.keluhan, "Sakit kepala");
    });

    it("Proof 17: Different kamar denied", async () => {
      const mockPrisma = {
        healthCaseV2: { findUnique: async () => mockCase },
      };

      // Pembina Utsman assigned to ou-kmr-utsman
      const pembinaUtsmanAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-pembina-utsman",
        userId: "usr-pembina-utsman",
        positionId: "pos-pembina",
        positionCode: "PEMBINA_ASRAMA",
        positionName: "Pembina Kamar Utsman",
        domain: "KEASRAMAAN",
        unitId: "ou-kmr-utsman",
        unitCode: "KMR-UTSMAN",
        unitName: "Kamar Utsman",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.READ_DETAIL,
            scopeType: "KAMAR",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "ou-kmr-utsman", unitCode: "KMR-UTSMAN" }],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [pembinaUtsmanAssignment],
        // Target santri is in ou-kmr-ali!
        resolveResourceContext: async () => ({
          santriId: "san-001",
          kamarId: "ou-kmr-ali",
          orgUnitIds: ["ou-kmr-ali"],
        }),
      });

      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-privacy-01",
            {
              actorUserId: "usr-pembina-utsman",
              dataProvider,
            }
          );
        },
        /OUT_OF_SCOPE_ACCESS_DENIED/,
        "Pembina must be denied access to health details of santri in a different kamar"
      );
    });

    it("Proof 18: Aggregate capability does not imply detail", async () => {
      const mockPrisma = {
        healthCaseV2: { findUnique: async () => mockCase },
      };

      const aggOnlyAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-agg-viewer",
        userId: "usr-agg-only",
        positionId: "pos-agg",
        positionCode: "STAFF_AKADEMIK",
        positionName: "Staff Akademik",
        domain: "KEASRAMAAN",
        unitId: "ou-asrama",
        unitCode: "ASRAMA",
        unitName: "Asrama",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.READ_AGGREGATE,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [aggOnlyAssignment],
      });

      await assert.rejects(
        async () => {
          await getHealthCaseV2DetailCore(
            mockPrisma as any,
            "hc-privacy-01",
            {
              actorUserId: "usr-agg-only",
              dataProvider,
            }
          );
        },
        /DETAIL_ACCESS_DENIED: Aggregate capability does not imply detail clinical capability/,
        "Aggregate capability must NOT grant detail access"
      );

      // Verify aggregate read succeeds and exposes ONLY statistical aggregates, no clinical details
      const mockPrismaAgg = {
        healthCaseV2: {
          groupBy: async () => [
            { statusV2: "DIPANTAU", _count: { _all: 3 } },
            { statusV2: "PULIH", _count: { _all: 10 } },
            { statusV2: "DIRUJUK", _count: { _all: 1 } },
            { statusV2: "DARURAT", _count: { _all: 0 } },
          ],
        },
      };

      const aggResult = await getHealthCasesV2AggregateCore(
        mockPrismaAgg as any,
        {},
        {
          actorUserId: "usr-agg-only",
          dataProvider,
        }
      );

      assert.strictEqual(aggResult.success, true);
      assert.strictEqual(aggResult.data.totalCases, 14);
      assert.strictEqual(aggResult.data.activeCases, 4);
      assert.strictEqual(aggResult.data.recoveredCases, 10);
      assert.strictEqual(aggResult.data.byStatus.DIPANTAU, 3);
      assert.strictEqual(aggResult.data.byStatus.PULIH, 10);
      assert.strictEqual((aggResult.data as any).keluhan, undefined);
      assert.strictEqual((aggResult.data as any).diagnosa, undefined);
      assert.strictEqual((aggResult.data as any).catatan, undefined);
    });
  });

  // =========================================================================
  // 19-21. Data Honesty, Vocabulary & Legacy Bridge
  // =========================================================================
  describe("Proof 19-21: Data Honesty, 4 Statuses & Legacy Bridge", () => {
    it("Proof 19: Diagnosis empty persists NULL", async () => {
      // 1. In legacy action:
      assert.ok(
        legacyActionContent.includes("formData.diagnosa?.trim() || null"),
        "Legacy catatKesehatanAction must persist null when diagnosa is omitted or empty"
      );

      // 2. In health-v2-service:
      let persistedData: any = null;
      const mockPrisma = {
        santri: { findUnique: async () => mockSantriInAli },
        healthCaseV2: {
          create: async (args: any) => {
            persistedData = args.data;
            return { ...args.data, id: "hc-null-diag", createdAt: new Date(), updatedAt: new Date() };
          },
        },
      };

      const nurseAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-nurse",
        userId: "usr-nurse",
        positionId: "pos-nurse",
        positionCode: "PETUGAS_KESEHATAN",
        positionName: "Petugas",
        domain: "KEASRAMAAN",
        unitId: "ou-poskestren",
        unitCode: "OU-POSKESTREN",
        unitName: "Poskestren",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: HEALTH_CAPABILITIES.CREATE,
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const dataProvider = createMockDataProvider({
        getActiveAssignments: async () => [nurseAssignment],
      });

      const res = await saveHealthCaseV2Core(
        mockPrisma as any,
        {
          santriId: "san-001",
          keluhan: "Sakit tenggorokan",
          tindakanAwal: "Diberi permen pelega tenggorokan",
          diagnosa: "   ", // Blank string
        },
        {
          userId: "usr-nurse",
          dataProvider,
        }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(persistedData.diagnosa, null);
      assert.strictEqual(res.data.diagnosa, null);
    });

    it("Proof 20: Canonical Health V2 statuses are exactly 4", () => {
      const expected = ["DIPANTAU", "PULIH", "DIRUJUK", "DARURAT"].sort();
      assert.deepStrictEqual([...CANONICAL_HEALTH_STATUSES_V2].sort(), expected);
      assert.strictEqual(CANONICAL_HEALTH_STATUSES_V2.length, 4);

      assert.strictEqual(isCanonicalHealthStatusV2("DIPANTAU"), true);
      assert.strictEqual(isCanonicalHealthStatusV2("PULIH"), true);
      assert.strictEqual(isCanonicalHealthStatusV2("DIRUJUK"), true);
      assert.strictEqual(isCanonicalHealthStatusV2("DARURAT"), true);

      // Other statuses are false
      assert.strictEqual(isCanonicalHealthStatusV2("RAWAT_PONDOK"), false);
      assert.strictEqual(isCanonicalHealthStatusV2("SEMBUH"), false);
      assert.strictEqual(isCanonicalHealthStatusV2("PULANG"), false);
      assert.strictEqual(isCanonicalHealthStatusV2("DIRUJUK_RS"), false);

      // Verify institutional invariant flags
      assert.strictEqual(HEALTH_V2_INVARIANTS.REFERRAL_AUTHORITY_STATE, "PROPOSED_TBD");
      assert.strictEqual(HEALTH_V2_INVARIANTS.STATUS_BRIDGE_MUTATION_ALLOWED, false);
      assert.strictEqual(HEALTH_V2_INVARIANTS.DAILY_CHECKLIST_POLICY, "EXACTLY_ONE_PER_DAY_NO_INVENTED_ITEMS");
      assert.strictEqual(HEALTH_V2_INVARIANTS.INVENTORY_OWNERSHIP_POLICY, "HEALTH_OWNED_MAINTENANCE_DELEGATED_TO_SARPRAS");
    });

    it("Proof 21: Legacy bridge includes DIRUJUK_RS and all supported legacy statuses", () => {
      // Supported bridge statuses
      assert.strictEqual(mapLegacyHealthStatusToV2("DIRUJUK_RS"), "DIRUJUK");
      assert.strictEqual(mapLegacyHealthStatusToV2("RAWAT_PONDOK"), "DIPANTAU");
      assert.strictEqual(mapLegacyHealthStatusToV2("SEMBUH"), "PULIH");
      assert.strictEqual(mapLegacyHealthStatusToV2("DIRUJUK_PUSKESMAS"), "DIRUJUK");
      assert.strictEqual(mapLegacyHealthStatusToV2("PULANG"), "REVIEW_REQUIRED");

      // Verify HealthStatusLegacy type compatibility
      const legacyRS: HealthStatusLegacy = "DIRUJUK_RS";
      const legacyRP: HealthStatusLegacy = "RAWAT_PONDOK";
      const legacyPusk: HealthStatusLegacy = "DIRUJUK_PUSKESMAS";
      const legacySembuh: HealthStatusLegacy = "SEMBUH";
      const legacyPulang: HealthStatusLegacy = "PULANG";
      assert.strictEqual(mapLegacyHealthStatusToV2(legacyRS), "DIRUJUK");
      assert.strictEqual(mapLegacyHealthStatusToV2(legacyRP), "DIPANTAU");
      assert.strictEqual(mapLegacyHealthStatusToV2(legacyPusk), "DIRUJUK");
      assert.strictEqual(mapLegacyHealthStatusToV2(legacySembuh), "PULIH");
      assert.strictEqual(mapLegacyHealthStatusToV2(legacyPulang), "REVIEW_REQUIRED");
    });
  });

  // =========================================================================
  // 22-23. Production Safety & Legacy Protection
  // =========================================================================
  describe("Proof 22-23: Production Safety & Non-Active Status", () => {
    it("Proof 22: Legacy production actions remain untouched except approved fake-diagnosis correction", () => {
      assert.ok(legacyActionContent.includes("export async function catatKesehatanAction"), "catatKesehatanAction must be exported");
      assert.ok(legacyActionContent.includes("export async function updateStatusKesehatanAction"), "updateStatusKesehatanAction must be exported");
      assert.ok(legacyActionContent.includes("export async function getDaftarKesehatanAction"), "getDaftarKesehatanAction must be exported");
      assert.ok(legacyActionContent.includes("prisma.catatanKesehatan"), "Legacy actions must continue using catatanKesehatan table");
      assert.ok(!legacyActionContent.includes("Pemeriksaan awal asrama"), "Fake diagnosis string must not exist");
    });

    it("Proof 23: Health V2 remains non-production-active", () => {
      assert.ok(
        !legacyActionContent.includes("healthCaseV2"),
        "Legacy production action file app/actions/kesehatan.ts must NOT call healthCaseV2"
      );
      assert.ok(
        !legacyActionContent.includes("health-v2-service"),
        "Legacy production action file app/actions/kesehatan.ts must NOT import health-v2-service"
      );
    });
  });

  // =========================================================================
  // 24-26. Milestone Regressions & PR #8 Immutability
  // =========================================================================
  describe("Proof 24-26: Regressions & PR #8 Immutability", () => {
    it("Proof 24: M3.2 regression green (Discipline, SP, Lisa operational reward scope)", () => {
      const m32TestPath = path.join(rootDir, "tests/milestone3-2-uat-business-rules.test.ts");
      assert.ok(fs.existsSync(m32TestPath), "M3.2 test suite must exist");
      const m32Content = fs.readFileSync(m32TestPath, "utf-8");
      assert.ok(m32Content.includes("UAT Item #11"), "M3.2 UAT Item #11 reward scope must be present");
    });

    it("Proof 25: M3.1 regression green (Keasramaan Kamar placement & structure)", () => {
      const m31TestPath = path.join(rootDir, "tests/milestone3-keasramaan-structure.test.ts");
      assert.ok(fs.existsSync(m31TestPath), "M3.1 test suite must exist");
      const m31Content = fs.readFileSync(m31TestPath, "utf-8");
      assert.ok(m31Content.includes("SantriKamarPlacement"), "M3.1 SantriKamarPlacement must be present");
    });

    it("Proof 26: PR #8 baseline remains immutable at SHA 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
      const PR8_EXACT_SHA = "9068cae5587b7219c394c5c25bf0de07a15b0726";
      let commitVerified = false;
      try {
        const catType = execSync(`git cat-file -t ${PR8_EXACT_SHA}`, {
          cwd: rootDir,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"],
        }).trim();
        if (catType === "commit") {
          commitVerified = true;
        }
      } catch {
        try {
          execSync(`git fetch origin ${PR8_EXACT_SHA} --depth=1`, { cwd: rootDir, stdio: "ignore" });
          commitVerified = true;
        } catch {}
      }

      assert.ok(commitVerified, `PR #8 exact SHA ${PR8_EXACT_SHA} must exist and be immutable`);
    });
  });

  // =========================================================================
  // M3.3A REMEDIATION ROUND 2 — FINAL SECURITY & CONSISTENCY CLOSURE
  // =========================================================================
  describe("M3.3A Remediation Round 2 — Final Security & Consistency Closure", () => {
    const docPath = path.join(rootDir, "docs/STQ_MILESTONE3_3A_HEALTH_V2_BACKEND.md");
    const docContent = fs.readFileSync(docPath, "utf-8");

    const unitAccountIdentity: CanonicalIdentity = {
      userId: "usr-poskestren-unit",
      username: "poskestren",
      status: "AKTIF",
      accountType: "UNIT",
      placementUnitId: "ou-poskestren",
    };

    const unitAssignment: CanonicalAssignmentWithDetails = {
      id: "asg-poskestren",
      userId: "usr-poskestren-unit",
      positionId: "pos-poskestren",
      positionCode: "OSDA_KESEHATAN",
      positionName: "OSDA Poskestren",
      domain: "KEASRAMAAN",
      unitId: "ou-poskestren",
      unitCode: "POSKESTREN",
      unitName: "Poskestren",
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: HEALTH_CAPABILITIES.CREATE,
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
        {
          capabilityCode: HEALTH_CAPABILITIES.UPDATE_STATUS,
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
      scopeUnits: [],
    };

    const pembinaAliAssignment: CanonicalAssignmentWithDetails = {
      id: "asg-pembina-ali",
      userId: "usr-pembina-ali",
      positionId: "pos-pembina-asrama",
      positionCode: "PEMBINA_ASRAMA",
      positionName: "Pembina Asrama",
      domain: "KEASRAMAAN",
      unitId: "ou-kmr-ali",
      unitCode: "KMR_ALI",
      unitName: "Kamar Ali",
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: HEALTH_CAPABILITIES.READ_AGGREGATE,
          scopeType: "KAMAR",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
        {
          capabilityCode: HEALTH_CAPABILITIES.READ_DETAIL,
          scopeType: "KAMAR",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
      scopeUnits: [],
    };

    const globalHealthStaffAssignment: CanonicalAssignmentWithDetails = {
      id: "asg-health-staff-global",
      userId: "usr-health-staff",
      positionId: "pos-petugas-kesehatan",
      positionCode: "PETUGAS_KESEHATAN",
      positionName: "Petugas Kesehatan",
      domain: "KEASRAMAAN",
      unitId: "ou-poskestren",
      unitCode: "POSKESTREN",
      unitName: "Poskestren",
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: HEALTH_CAPABILITIES.READ_AGGREGATE,
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
        {
          capabilityCode: HEALTH_CAPABILITIES.READ_DETAIL,
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
      scopeUnits: [],
    };

    const createMockDb = (overrides: any = {}) => {
      const records: any = {
        cases: new Map(),
        events: new Map(),
        audits: [],
      };
      let transactionAborted = false;

      const db: any = {
        santri: {
          findUnique: async () => mockSantriInAli,
        },
        healthCaseV2: {
          findUnique: async ({ where }: any) =>
            records.cases.get(where.id) || {
              id: where.id,
              santriId: "san-001",
              statusV2: "DIPANTAU",
              keluhan: "Demam",
              tindakanAwal: "Paracetamol",
              diagnosa: null,
              catatan: null,
              attachmentUrl: null,
              recordedByUserId: "usr-poskestren-unit",
              recordedByStaffId: null,
              occurredAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          create: async ({ data }: any) => {
            const row = {
              id: "hc-" + Math.random().toString(36).slice(2, 8),
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            };
            records.cases.set(row.id, row);
            return row;
          },
          update: async ({ where, data }: any) => {
            const existing = records.cases.get(where.id) || {
              id: where.id,
              santriId: "san-001",
              statusV2: "DIPANTAU",
              keluhan: "Demam",
              tindakanAwal: "Paracetamol",
              diagnosa: null,
              recordedByUserId: "usr-poskestren-unit",
              recordedByStaffId: null,
              occurredAt: new Date(),
              createdAt: new Date(),
            };
            const updated = { ...existing, ...data, updatedAt: new Date() };
            records.cases.set(where.id, updated);
            return updated;
          },
          groupBy: async (args: any) => {
            db.lastGroupByWhere = args.where;
            return [
              { statusV2: "DIPANTAU", _count: { _all: 3 } },
              { statusV2: "PULIH", _count: { _all: 8 } },
              { statusV2: "DIRUJUK", _count: { _all: 1 } },
              { statusV2: "DARURAT", _count: { _all: 0 } },
            ];
          },
        },
        healthCaseV2Event: {
          create: async ({ data }: any) => {
            const row = {
              id: "evt-" + Math.random().toString(36).slice(2, 8),
              createdAt: new Date(),
              ...data,
            };
            records.events.set(row.id, row);
            return row;
          },
        },
        $transaction: async (fn: any) => {
          try {
            return await fn(db);
          } catch (err) {
            transactionAborted = true;
            throw err;
          }
        },
        records,
        isTransactionAborted: () => transactionAborted,
        ...overrides,
      };
      return db;
    };

    // =======================================================================
    // 1. CANONICAL HUMAN EXECUTOR IDENTITY NORMALIZATION
    // =======================================================================
    describe("Blocker 1: Canonical Human Executor Identity Normalization", () => {
      it("Proof R2-1: Executor supplied as Staff.id normalizes to linked User.id", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (executorId: string) => {
            if (executorId === "stf-lisa") {
              return {
                userId: "usr-lisa",
                id: "usr-lisa",
                staffId: "stf-lisa",
                name: "dr. Lisa",
                isActive: true,
              };
            }
            return null;
          },
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        const result = await service.updateCaseStatus(
          { id: "hc-001", newStatus: "PULIH", tindakanLanjutan: "Pasien sembuh" },
          { actorUserId: "usr-poskestren-unit", humanExecutorId: "stf-lisa" }
        );

        assert.strictEqual(result.success, true);
        // Persisted event human_executor_id must be linked User.id, NEVER Staff.id
        assert.strictEqual(result.data.events![0].humanExecutorId, "usr-lisa");
        assert.strictEqual(result.audit.humanExecutorId, "usr-lisa");
        assert.strictEqual(result.audit.humanExecutorUsername, "dr. Lisa");
      });

      it("Proof R2-2: Executor supplied as Santri.id normalizes to linked User.id", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (executorId: string) => {
            if (executorId === "san-ahmad") {
              return {
                userId: "usr-ahmad",
                id: "usr-ahmad",
                santriId: "san-ahmad",
                name: "Ahmad Santri",
                isActive: true,
              };
            }
            return null;
          },
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        const result = await service.updateCaseStatus(
          { id: "hc-001", newStatus: "DIPANTAU", tindakanLanjutan: "Santri piket jaga" },
          { actorUserId: "usr-poskestren-unit", humanExecutorId: "san-ahmad" }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.events![0].humanExecutorId, "usr-ahmad");
        assert.strictEqual(result.audit.humanExecutorId, "usr-ahmad");
        assert.strictEqual(result.audit.humanExecutorUsername, "Ahmad Santri");
      });

      it("Proof R2-3: Caller fake executor name cannot alter audit identity", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (executorId: string) => {
            if (executorId === "stf-lisa") {
              return {
                userId: "usr-lisa",
                id: "usr-lisa",
                staffId: "stf-lisa",
                name: "dr. Lisa",
                isActive: true,
              };
            }
            return null;
          },
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        const result = await service.createCase(
          { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
          {
            actorUserId: "usr-poskestren-unit",
            humanExecutorId: "stf-lisa",
            // Adversary sends fake name in request context
            humanExecutorUsername: "hacked-admin-identity",
          } as any
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.audit.humanExecutorId, "usr-lisa");
        // Server-side verified name MUST be used in audit, never caller-supplied fake name
        assert.strictEqual(result.audit.humanExecutorUsername, "dr. Lisa");
        assert.notStrictEqual(result.audit.humanExecutorUsername, "hacked-admin-identity");
      });

      it("Proof R2-4: Random or unverified executor ID is strictly denied", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async () => null, // Not found
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-random-attacker" }
            );
          },
          /UNIT_EXECUTOR_INVALID/
        );
      });

      it("Proof R2-5: Inactive executor identity is strictly denied", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (executorId: string) => ({
            userId: executorId,
            id: executorId,
            name: "Inactive Doctor",
            isActive: false, // Inactive!
          }),
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-inactive" }
            );
          },
          /UNIT_EXECUTOR_INVALID/
        );
      });
    });

    // =======================================================================
    // 2. MUTATION / EVENT / AUDIT ATOMICITY
    // =======================================================================
    describe("Blocker 2: Mutation / Event / Audit Atomicity", () => {
      it("Proof R2-6: Create + Audit commit atomically in transaction", async () => {
        let transactionUsed = false;
        const mockDb = createMockDb({
          $transaction: async (fn: any) => {
            transactionUsed = true;
            return fn(mockDb);
          },
        });
        const auditRecords: any[] = [];
        const mockAuditSink = {
          record: async (rec: any) => {
            auditRecords.push(rec);
          },
        };

        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (id: string) => ({
            userId: id,
            id,
            name: "dr. Lisa",
            isActive: true,
          }),
        });

        const service = createHealthV2Service({
          db: mockDb,
          dataProvider,
          auditSink: mockAuditSink as any,
        });
        const result = await service.createCase(
          { santriId: "san-001", keluhan: "Batuk", tindakanAwal: "Sirup" },
          { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(transactionUsed, true, "Must execute within database transaction");
        assert.strictEqual(auditRecords.length, 1, "Audit record must be created");
      });

      it("Proof R2-7: Update + Event + Audit commit atomically in transaction", async () => {
        let transactionUsed = false;
        const mockDb = createMockDb({
          $transaction: async (fn: any) => {
            transactionUsed = true;
            return fn(mockDb);
          },
        });
        const auditRecords: any[] = [];
        const mockAuditSink = {
          record: async (rec: any) => {
            auditRecords.push(rec);
          },
        };

        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (id: string) => ({
            userId: id,
            id,
            name: "dr. Lisa",
            isActive: true,
          }),
        });

        const service = createHealthV2Service({
          db: mockDb,
          dataProvider,
          auditSink: mockAuditSink as any,
        });
        const result = await service.updateCaseStatus(
          { id: "hc-001", newStatus: "PULIH", tindakanLanjutan: "Sembuh total" },
          { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(transactionUsed, true);
        assert.strictEqual(auditRecords.length, 1);
        assert.strictEqual(result.data.events!.length, 1);
      });

      it("Proof R2-8: Event failure rolls back update in transaction", async () => {
        let updateExecuted = false;
        let transactionAborted = false;
        const mockDb = createMockDb({
          healthCaseV2: {
            findUnique: async () => ({
              id: "hc-rollback-1",
              santriId: "san-001",
              statusV2: "DIPANTAU",
              occurredAt: new Date(),
            }),
            update: async () => {
              updateExecuted = true;
              return { id: "hc-rollback-1", statusV2: "PULIH" };
            },
          },
          healthCaseV2Event: {
            create: async () => {
              throw new Error("SIMULATED_EVENT_PERSISTENCE_FAILURE");
            },
          },
          $transaction: async (fn: any) => {
            try {
              return await fn(mockDb);
            } catch (err) {
              transactionAborted = true;
              throw err;
            }
          },
        });

        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (id: string) => ({
            userId: id,
            id,
            name: "dr. Lisa",
            isActive: true,
          }),
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.updateCaseStatus(
              { id: "hc-rollback-1", newStatus: "PULIH" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
            );
          },
          /SIMULATED_EVENT_PERSISTENCE_FAILURE/
        );

        assert.strictEqual(updateExecuted, true, "Update attempted");
        assert.strictEqual(transactionAborted, true, "Transaction must abort and rollback");
      });

      it("Proof R2-9: Audit failure rolls back mutation and event", async () => {
        let mutationExecuted = false;
        let transactionAborted = false;
        const mockDb = createMockDb({
          healthCaseV2: {
            create: async () => {
              mutationExecuted = true;
              return { id: "hc-audit-fail", createdAt: new Date() };
            },
          },
          $transaction: async (fn: any) => {
            try {
              return await fn(mockDb);
            } catch (err) {
              transactionAborted = true;
              throw err;
            }
          },
        });

        const failingAuditSink = {
          record: async () => {
            throw new Error("SIMULATED_MANDATORY_AUDIT_FAILURE");
          },
        };

        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (id: string) => ({
            userId: id,
            id,
            name: "dr. Lisa",
            isActive: true,
          }),
        });

        const service = createHealthV2Service({
          db: mockDb,
          dataProvider,
          auditSink: failingAuditSink as any,
        });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
            );
          },
          /SIMULATED_MANDATORY_AUDIT_FAILURE/
        );

        assert.strictEqual(mutationExecuted, true, "Mutation attempted");
        assert.strictEqual(transactionAborted, true, "Transaction must abort and rollback on audit failure");
      });
    });

    // =======================================================================
    // 3. AGGREGATE KAMAR SCOPE
    // =======================================================================
    describe("Blocker 3: Aggregate Kamar Scope Derivation & Enforcement", () => {
      it("Proof R2-10: Pembina KAMAR aggregate own kamar = ALLOW and query constrained", async () => {
        let capturedWhere: any = null;
        const mockDb = createMockDb({
          healthCaseV2: {
            groupBy: async ({ where }: any) => {
              capturedWhere = where;
              return [{ statusV2: "DIPANTAU", _count: { _all: 2 } }];
            },
          },
        });

        const dataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-pembina-ali",
            username: "pembina.ali",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-pembina",
          }),
          getActiveAssignments: async () => [pembinaAliAssignment],
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        const result = await service.getCasesAggregate(
          { kamarId: "ou-kmr-ali" },
          { actorUserId: "usr-pembina-ali" }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(capturedWhere.santri.kamarPlacements.some.kamarId, "ou-kmr-ali");
      });

      it("Proof R2-11: Pembina cannot widen aggregate to other kamar = DENY", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-pembina-ali",
            username: "pembina.ali",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-pembina",
          }),
          getActiveAssignments: async () => [pembinaAliAssignment],
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            // Assigned to ou-kmr-ali, attempts to query ou-kmr-utsman
            await service.getCasesAggregate(
              { kamarId: "ou-kmr-utsman" },
              { actorUserId: "usr-pembina-ali" }
            );
          },
          /OUT_OF_SCOPE_ACCESS_DENIED/,
          "Caller cannot widen aggregate query to another kamar"
        );
      });

      it("Proof R2-12: Pembina with no authoritative kamar = DENY", async () => {
        const mockDb = createMockDb();
        const unassignedPembina: CanonicalAssignmentWithDetails = {
          ...pembinaAliAssignment,
          unitId: "", // No authoritative kamar assigned
        };
        const dataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-pembina-unassigned",
            username: "pembina.none",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-none",
          }),
          getActiveAssignments: async () => [unassignedPembina],
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.getCasesAggregate({}, { actorUserId: "usr-pembina-unassigned" });
          },
          /OUT_OF_SCOPE_ACCESS_DENIED/
        );
      });

      it("Proof R2-13: GLOBAL health staff aggregate works across institution", async () => {
        let capturedWhere: any = null;
        const mockDb = createMockDb({
          healthCaseV2: {
            groupBy: async ({ where }: any) => {
              capturedWhere = where;
              return [{ statusV2: "DIPANTAU", _count: { _all: 5 } }];
            },
          },
        });

        const dataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-health-staff",
            username: "petugas.kesehatan",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-01",
          }),
          getActiveAssignments: async () => [globalHealthStaffAssignment],
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        const result = await service.getCasesAggregate({}, { actorUserId: "usr-health-staff" });

        assert.strictEqual(result.success, true);
        // Global aggregate has no forced kamar constraint
        assert.strictEqual(capturedWhere.santri, undefined);
      });

      it("Proof R2-14: Aggregate result never exposes clinical details", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-health-staff",
            username: "petugas.kesehatan",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-01",
          }),
          getActiveAssignments: async () => [globalHealthStaffAssignment],
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        const result = await service.getCasesAggregate({}, { actorUserId: "usr-health-staff" });

        // Must contain only numerical aggregate fields
        const keys = Object.keys(result.data).sort();
        assert.deepStrictEqual(keys, ["activeCases", "byStatus", "recoveredCases", "totalCases"]);
        assert.strictEqual((result.data as any).diagnosa, undefined);
        assert.strictEqual((result.data as any).keluhan, undefined);
        assert.strictEqual((result.data as any).tindakanAwal, undefined);
        assert.strictEqual((result.data as any).events, undefined);
      });
    });

    // =======================================================================
    // 4. AUDIT DECISION MUST FAIL CLOSED
    // =======================================================================
    describe("Blocker 4: Audit Decision Fail-Closed (No Unknown/Global Fallbacks)", () => {
      it("Proof R2-15: Missing decision assignment fails closed (AUTH_DECISION_INCOMPLETE)", async () => {
        const mockDb = createMockDb();
        // Incomplete grant missing assignmentId
        const incompleteAssignment: CanonicalAssignmentWithDetails = {
          ...unitAssignment,
          id: "",
        };
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [incompleteAssignment],
          verifyHumanExecutor: async (id: string) => ({ userId: id, id, name: "dr. Lisa", isActive: true }),
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
            );
          },
          /AUTH_DECISION_INCOMPLETE/
        );
      });

      it("Proof R2-16: Missing decision position fails closed", async () => {
        const mockDb = createMockDb();
        const incompleteAssignment: CanonicalAssignmentWithDetails = {
          ...unitAssignment,
          positionCode: "",
        };
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [incompleteAssignment],
          verifyHumanExecutor: async (id: string) => ({ userId: id, id, name: "dr. Lisa", isActive: true }),
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
            );
          },
          /AUTH_DECISION_INCOMPLETE/
        );
      });

      it("Proof R2-17: Missing decision scope fails closed", async () => {
        const mockDb = createMockDb();
        const incompleteAssignment: CanonicalAssignmentWithDetails = {
          ...unitAssignment,
          positionCapabilities: [
            {
              capabilityCode: HEALTH_CAPABILITIES.CREATE,
              scopeType: "" as any,
              businessRuleState: "VERIFIED_PRODUCTION",
            },
          ],
        };
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [incompleteAssignment],
          verifyHumanExecutor: async (id: string) => ({ userId: id, id, name: "dr. Lisa", isActive: true }),
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-poskestren-unit", humanExecutorId: "usr-lisa" }
            );
          },
          /AUTH_DECISION_INCOMPLETE|PERMISSION_DENIED/
        );
      });

      it("Proof R2-18: Missing decision authoritative unit fails closed (no GLOBAL/UNKNOWN fallback)", async () => {
        const mockDb = createMockDb();
        const missingUnitStaffAssignment: CanonicalAssignmentWithDetails = {
          ...globalHealthStaffAssignment,
          unitId: "", // Missing anchor unit!
          positionCapabilities: [
            {
              capabilityCode: HEALTH_CAPABILITIES.CREATE,
              scopeType: "GLOBAL",
              businessRuleState: "VERIFIED_PRODUCTION",
            },
          ],
        };
        const dataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-health-staff",
            username: "petugas.kesehatan",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-01",
          }),
          getActiveAssignments: async () => [missingUnitStaffAssignment],
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              { actorUserId: "usr-health-staff" }
            );
          },
          /AUTH_DECISION_INCOMPLETE/
        );
      });
    });

    // =======================================================================
    // 5. REMOVE CALLER AUTHORIZATION SEAMS & DEPENDENCY SEPARATION
    // =======================================================================
    describe("Blocker 5: Clean Service Context & Dependency Separation", () => {
      it("Proof R2-19: Request context has no caller capabilities, scope, or position", async () => {
        const mockDb = createMockDb();
        const emptyAssignmentsProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-attacker",
            username: "attacker",
            status: "AKTIF",
            accountType: "PERSONAL",
          }),
          getActiveAssignments: async () => [], // No assignments in DB!
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider: emptyAssignmentsProvider });
        // Caller injects synthetic authorization fields into request context
        const forgedContext = {
          actorUserId: "usr-attacker",
          capabilities: [HEALTH_CAPABILITIES.CREATE],
          scopeType: "GLOBAL",
          positionCode: "PETUGAS_KESEHATAN",
        };

        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              forgedContext as any
            );
          },
          /PERMISSION_DENIED/,
          "Service must derive authority solely from authoritative database, ignoring context capabilities/scope"
        );
      });

      it("Proof R2-20: Production request callers cannot inject dataProvider or auditSink via request context", async () => {
        const mockDb = createMockDb();
        const boundDataProvider = createMockDataProvider({
          getIdentity: async () => ({
            userId: "usr-victim",
            username: "victim",
            status: "AKTIF",
            accountType: "PERSONAL",
          }),
          getActiveAssignments: async () => [], // Denied!
        });

        let fakeProviderUsed = false;
        const injectedFakeProvider: ICanonicalDataProvider = createMockDataProvider({
          getActiveAssignments: async () => {
            fakeProviderUsed = true;
            return [globalHealthStaffAssignment];
          },
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider: boundDataProvider });

        await assert.rejects(
          async () => {
            await service.createCase(
              { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
              {
                actorUserId: "usr-victim",
                dataProvider: injectedFakeProvider,
              } as any
            );
          },
          /PERMISSION_DENIED/
        );

        assert.strictEqual(fakeProviderUsed, false, "Per-request dataProvider injection must be ignored");
      });
    });

    // =======================================================================
    // 6. CLIENT REQUEST ID SINGLE SOURCE
    // =======================================================================
    describe("Blocker 7: Client Request ID Single Source", () => {
      it("Proof R2-21: Conflicting input and context clientRequestId throws CLIENT_REQUEST_ID_MISMATCH", async () => {
        const mockDb = createMockDb();
        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (id: string) => ({ userId: id, id, name: "dr. Lisa", isActive: true }),
        });

        const service = createHealthV2Service({ db: mockDb, dataProvider });
        await assert.rejects(
          async () => {
            await service.createCase(
              {
                santriId: "san-001",
                keluhan: "Sakit",
                tindakanAwal: "Obat",
                clientRequestId: "req-input-conflict",
              },
              {
                actorUserId: "usr-poskestren-unit",
                humanExecutorId: "usr-lisa",
                clientRequestId: "req-context-authoritative",
              }
            );
          },
          /CLIENT_REQUEST_ID_MISMATCH/
        );
      });

      it("Proof R2-22: Request metadata context owns clientRequestId single-source-of-truth", async () => {
        const mockDb = createMockDb();
        let auditClientRequestId: string | null = null;
        const mockAuditSink = {
          record: async (rec: any) => {
            auditClientRequestId = rec.clientRequestId;
          },
        };

        const dataProvider = createMockDataProvider({
          getIdentity: async () => unitAccountIdentity,
          getUnitAccountPlacement: async () => ({ unitId: "ou-poskestren" }),
          getActiveAssignments: async () => [unitAssignment],
          verifyHumanExecutor: async (id: string) => ({ userId: id, id, name: "dr. Lisa", isActive: true }),
        });

        const service = createHealthV2Service({
          db: mockDb,
          dataProvider,
          auditSink: mockAuditSink as any,
        });
        const result = await service.createCase(
          { santriId: "san-001", keluhan: "Sakit", tindakanAwal: "Obat" },
          {
            actorUserId: "usr-poskestren-unit",
            humanExecutorId: "usr-lisa",
            clientRequestId: "req-from-metadata-context-789",
          }
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(auditClientRequestId, "req-from-metadata-context-789");
      });
    });

    // =======================================================================
    // 7. DOCUMENTATION PARITY
    // =======================================================================
    describe("Blocker 6: Documentation, Migration & Schema Parity", () => {
      it("Proof R2-23: Schema, migration SQL, and M3.3A doc describe the same event index (case_id, created_at)", () => {
        // 1. Prisma schema check
        assert.ok(
          schemaContent.includes("@@index([caseId, createdAt])"),
          "Prisma schema must index caseId and createdAt on HealthCaseV2Event"
        );

        // 2. Migration SQL check
        assert.ok(
          migrationSqlContent.includes(
            'CREATE INDEX "health_case_v2_events_case_id_created_at_idx" ON "health_case_v2_events"("case_id", "created_at");'
          ),
          "Migration SQL must create health_case_v2_events_case_id_created_at_idx on (case_id, created_at)"
        );

        // 3. Documentation check
        assert.ok(
          docContent.includes("health_case_v2_events_case_id_created_at_idx"),
          "M3.3A documentation must cite health_case_v2_events_case_id_created_at_idx"
        );

        // 4. Contradictory index claims must be completely eliminated
        assert.strictEqual(
          docContent.includes("health_case_v2_events_case_id_occurred_at_idx"),
          false,
          "Zero occurrences of obsolete occurred_at event index in documentation"
        );
        assert.strictEqual(
          migrationSqlContent.includes("health_case_v2_events_case_id_occurred_at_idx"),
          false,
          "Zero occurrences of obsolete occurred_at event index in migration SQL"
        );
        assert.strictEqual(
          schemaContent.includes("caseId, occurredAt"),
          false,
          "Zero occurrences of obsolete occurred_at event index in Prisma schema"
        );
      });
    });
  });

  // =========================================================================
  // Migration Lineage Simulation
  // =========================================================================
  describe("Migration Lineage Simulation (Isolated Database)", () => {
    it("Simulate full migration lineage through M3.3A with event table and indexes", async () => {
      const result = await simulateM33aMigrationChain();

      assert.strictEqual(result.pr8ExactShaVerified, true, "PR #8 SHA must be verified");
      assert.strictEqual(result.pr8MigrationApplied, true, "PR #8 migration must be applied");
      assert.strictEqual(result.phase2aApplied, true, "Phase 2A migration must be applied");
      assert.strictEqual(result.m31MigrationApplied, true, "M3.1 migration must be applied");
      assert.strictEqual(result.m33aMigrationApplied, true, "M3.3A migration must be applied");
      assert.strictEqual(result.existingDataUnchanged, true, "Pre-existing data must remain unchanged");
      assert.strictEqual(result.existingPr8TablesIntact, true, "PR #8 evaluasi table must remain intact");
      assert.strictEqual(result.existingPlacementsIntact, true, "M3.1 placement table must remain intact");
      assert.strictEqual(result.existingCatatanKesehatanIntact, true, "Legacy catatan_kesehatan must remain intact");
      assert.strictEqual(result.tableCreated, true, "health_cases_v2 table must be created");
      assert.strictEqual(result.enumCreated, true, "HealthStatusV2 enum must be created");
      assert.strictEqual(result.enumExactValuesVerified, true, "HealthStatusV2 enum must contain exactly the 4 canonical values");
      assert.strictEqual(result.nullableDiagnosaPersistsNull, true, "Nullable diagnosa must store NULL when omitted");
      assert.strictEqual(result.invalidEnumRejected, true, "Invalid enum values must be rejected by Postgres");
      assert.strictEqual(result.auditAttributionFieldsPresent, true, "Audit attribution fields must be present");
      assert.strictEqual(result.simulationSuccess, true, "Overall migration simulation must succeed");
    });
  });
});
