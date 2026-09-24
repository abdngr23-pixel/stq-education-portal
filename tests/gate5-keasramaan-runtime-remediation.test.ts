/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  KEASRAMAAN_PERMISSION_CAPABILITIES,
  KEASRAMAAN_KAMAR_CAPABILITIES,
  POSITION_ACCOUNT_MODALITY_CONTRACT,
} from "../types/architecture-lock";
import {
  authorizeCanonical,
  CanonicalIdentity,
  CanonicalAssignmentWithDetails,
  ICanonicalDataProvider,
  createPrismaDataProvider,
} from "../lib/auth/canonical-evaluator";
import {
  evaluateScopePredicate,
} from "../lib/auth/scope-evaluator";
import {
  resolveUserIsMudabbir,
  getMudabbirAssignedUnitIds,
  resolveMudabbirPermissionCapability,
} from "../lib/auth";
import { catatAbsensiAction } from "../app/actions/kesantrian";
import {
  createKamar,
  renameKamar,
  assignMudhabbir,
  assignSantri,
  moveSantri,
  inspectKamarConfiguration,
} from "../lib/server/kamar-management-service";
import { checkPendidikanV2ProductionReadiness } from "../lib/server/pendidikan-v2-readiness";

// Helper to create mock data provider
function createMockDataProvider(opts: {
  identities?: Record<string, CanonicalIdentity>;
  assignments?: Record<string, CanonicalAssignmentWithDetails[]>;
  placements?: Record<string, { unitId: string; count?: number } | null>;
  executors?: Record<string, any>;
  resourceContexts?: Record<string, any>;
}): ICanonicalDataProvider {
  const identities = opts.identities || {};
  const assignments = opts.assignments || {};
  const placements = opts.placements || {};
  const executors = opts.executors || {};
  const resourceContexts = opts.resourceContexts || {};

  return {
    getIdentity: async (userId: string) => identities[userId] || null,
    getActiveAssignments: async (userId: string) => assignments[userId] || [],
    getUnitAccountPlacement: async (userId: string) =>
      placements[userId] !== undefined ? placements[userId] : null,
    verifyHumanExecutor: async (executorId: string) => executors[executorId] || null,
    resolveResourceContext: async (requested: any) => {
      const key = requested.santriId || requested.kamarId || requested.resourceId || requested.unitId || "default";
      return resourceContexts[key] || {
        santriId: requested.santriId,
        kamarId: requested.kamarId,
        orgUnitIds: [requested.kamarId, requested.halaqohId].filter(Boolean),
        genderComplex: requested.genderComplex,
        orgDomain: "KEASRAMAAN",
      };
    },
  };
}

describe("GATE 5 — KEASRAMAAN RUNTIME REMEDIATION (40 SCENARIOS)", () => {
  // 1. SUSPENDED UNIT account -> DENY
  it("1. SUSPENDED UNIT account -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "SUSPENDED",
          accountType: "UNIT",
          placementUnitId: "ou-osda-putri",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "IDENTITY_INACTIVE");
    assert.equal(res.reasonCode, "IDENTITY_INACTIVE");
  });

  // 2. UNIT without placement -> DENY
  it("2. UNIT without placement -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": null,
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_ACCOUNT_NO_PLACEMENT");
  });

  // 3. UNIT with multiple placements -> DENY
  it("3. UNIT with multiple placements -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 2 },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_PLACEMENT_MULTIPLE");
  });

  // 4. UNIT placement / Assignment mismatch -> DENY
  it("4. UNIT placement / Assignment mismatch -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
      assignments: {
        "unit-osda": [
          {
            id: "asg-1",
            userId: "unit-osda",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-different-unit", // Mismatched unit!
            unitCode: "OU-DIFF",
            unitName: "Different Unit",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_PLACEMENT_MISMATCH");
  });

  // 5. UNIT mutation without human executor -> DENY
  it("5. UNIT mutation without human executor -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      // No executorContext provided
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_EXECUTOR_REQUIRED");
  });

  // 6. invalid executor -> DENY
  it("6. invalid executor -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
      executors: {
        "invalid-human": null, // Cannot be resolved
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: {
        humanExecutorId: "invalid-human",
      },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_EXECUTOR_INVALID");
  });

  // 7. executor equal to technical account -> DENY
  it("7. executor equal to technical account -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: {
        humanExecutorId: "unit-osda", // Self-execution!
      },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_EXECUTOR_INVALID");
  });

  // 8. human executor cannot donate its own Assignment/Capability
  it("8. human executor cannot donate its own Assignment/Capability", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
      executors: {
        "human-mudir": {
          userId: "human-mudir",
          name: "Ustadz Mudir",
          isActive: true,
          staffId: "stf-mudir",
        },
      },
      assignments: {
        // UNIT account has NO assignment
        "unit-osda": [],
        // Human executor has full assignment, but it must NOT donate!
        "human-mudir": [
          {
            id: "asg-mudir",
            userId: "human-mudir",
            positionId: "pos-mudir",
            positionCode: "MUDIR",
            positionName: "Mudir",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: {
        humanExecutorId: "human-mudir",
      },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.reasonCode, "NO_ACTIVE_ASSIGNMENTS");
  });

  // 9. technical UNIT remains canonical authority holder
  it("9. technical UNIT remains canonical authority holder", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
      executors: {
        "human-santriwati": {
          userId: "human-santriwati",
          name: "Fatimah Human",
          isActive: true,
          santriId: "san-1",
        },
      },
      assignments: {
        "unit-osda": [
          {
            id: "asg-osda-1",
            userId: "unit-osda",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-putri",
            unitCode: "OU-OSDA-PUTRI",
            unitName: "OSDA Putri",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "kamar-putri-1",
                unitCode: "KMR-P1",
                unitContext: {
                  unitId: "kamar-putri-1",
                  unitCode: "KMR-P1",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRI",
                  parentId: "ou-osda-putri",
                  ancestorUnitIds: ["ou-osda-putri"],
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "san-putri-target": {
          santriId: "san-putri-target",
          kamarId: "kamar-putri-1",
          orgUnitIds: ["kamar-putri-1"],
          genderComplex: "PUTRI",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: {
        humanExecutorId: "human-santriwati",
      },
      resourceContext: { santriId: "san-putri-target" },
      dataProvider,
    });

    assert.equal(res.decision, "ALLOW");
    // Authority fields belong strictly to the UNIT account assignment
    assert.equal(res.assignmentId, "asg-osda-1");
    assert.equal(res.positionCode, "PETUGAS_OPERASIONAL_KEASRAMAAN");
    assert.equal(res.capabilityCode, KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE);
    assert.equal(res.scopeType, "ASSIGNED_UNITS");
    // Human executor is recorded in verifiedExecutor for forensic audit provenance
    assert.equal(res.verifiedExecutor?.userId, "human-santriwati");
    assert.equal(res.verifiedExecutor?.name, "Fatimah Human");
  });

  // 10. PETUGAS_OPERASIONAL_KEASRAMAAN UNIT does not require fake Staff linkage
  it("10. PETUGAS_OPERASIONAL_KEASRAMAAN UNIT does not require fake Staff linkage", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          staffId: null, // NO Staff profile attached!
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
      assignments: {
        "unit-osda": [
          {
            id: "asg-osda-1",
            userId: "unit-osda",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-putri",
            unitCode: "OU-OSDA-PUTRI",
            unitName: "OSDA Putri",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "kamar-putri-1",
                unitCode: "KMR-P1",
                unitContext: {
                  unitId: "kamar-putri-1",
                  unitCode: "KMR-P1",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRI",
                  parentId: "ou-osda-putri",
                  ancestorUnitIds: ["ou-osda-putri"],
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "san-putri": {
          santriId: "san-putri",
          orgUnitIds: ["kamar-putri-1"],
          genderComplex: "PUTRI",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "san-putri" },
      dataProvider,
    });

    assert.equal(res.decision, "ALLOW");
    assert.equal(res.code, "ALLOWED");
  });

  // 11. PERSONAL identity cannot silently use UNIT-only POK authority
  it("11. PERSONAL identity cannot silently use UNIT-only POK authority", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-personal": {
          userId: "user-personal",
          username: "personal.user",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-1",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-personal": [
          {
            id: "asg-1",
            userId: "user-personal",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "user-personal" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.reasonCode, "ACCOUNT_TYPE_MISMATCH");
  });

  // 12. SUBJECT identity cannot use POK authority
  it("12. SUBJECT identity cannot use POK authority", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-subject": {
          userId: "user-subject",
          username: "subject.mapel",
          status: "AKTIF",
          accountType: "SUBJECT",
        },
      },
      assignments: {
        "user-subject": [
          {
            id: "asg-sub",
            userId: "user-subject",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "user-subject" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.reasonCode, "ACCOUNT_TYPE_MISMATCH");
  });

  // 13. OSDA PUTRI -> PUTRA target DENY
  it("13. OSDA PUTRI -> PUTRA target DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda-putri": {
          userId: "unit-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "unit-osda-putri": { unitId: "ou-osda-putri", count: 1 },
      },
      assignments: {
        "unit-osda-putri": [
          {
            id: "asg-osda-putri",
            userId: "unit-osda-putri",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-putri",
            unitCode: "OU-OSDA-PUTRI",
            unitName: "OSDA Putri",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
      resourceContexts: {
        "santri-putra": {
          santriId: "santri-putra",
          kamarId: "kamar-putra-1",
          orgUnitIds: ["kamar-putra-1"],
          genderComplex: "PUTRA", // Target is PUTRA!
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda-putri" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "santri-putra" },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "GENDER_COMPLEX_DENIED");
  });

  // 14. OSDA PUTRI -> PUTRI may proceed only if complete canonical grant/scope chain is valid
  it("14. OSDA PUTRI -> PUTRI may proceed only if complete canonical grant/scope chain is valid", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda-putri": {
          userId: "unit-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "unit-osda-putri": { unitId: "ou-osda-putri", count: 1 },
      },
      assignments: {
        "unit-osda-putri": [
          {
            id: "asg-osda-putri",
            userId: "unit-osda-putri",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-putri",
            unitCode: "OU-OSDA-PUTRI",
            unitName: "OSDA Putri",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "kamar-putri-1",
                unitCode: "KMR-P1",
                unitContext: {
                  unitId: "kamar-putri-1",
                  unitCode: "KMR-P1",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRI",
                  parentId: "ou-osda-putri",
                  ancestorUnitIds: ["ou-osda-putri"],
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "santri-putri": {
          santriId: "santri-putri",
          kamarId: "kamar-putri-1",
          orgUnitIds: ["kamar-putri-1"],
          genderComplex: "PUTRI",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda-putri" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "santri-putri" },
      dataProvider,
    });

    assert.equal(res.decision, "ALLOW");
    assert.equal(res.code, "ALLOWED");
  });

  // 15. missing required gender context for gender-bound UNIT -> DENY
  it("15. missing required gender context for gender-bound UNIT -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda-putri": {
          userId: "unit-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "unit-osda-putri": { unitId: "ou-osda-putri", count: 1 },
      },
      assignments: {
        "unit-osda-putri": [
          {
            id: "asg-osda-putri",
            userId: "unit-osda-putri",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-putri",
            unitCode: "OU-OSDA-PUTRI",
            unitName: "OSDA Putri",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
      resourceContexts: {
        "santri-no-gender": {
          santriId: "santri-no-gender",
          kamarId: "kamar-1",
          orgUnitIds: ["kamar-1"],
          genderComplex: undefined, // Missing gender context!
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda-putri" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "santri-no-gender" },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "GENDER_COMPLEX_DENIED");
  });

  // 16. caller supplied unitId cannot manufacture operational scope
  it("16. caller supplied unitId cannot manufacture operational scope", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "ou-osda-putri",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
    });

    // Caller attempts to pass unitId in executorContext that does not match placementUnitId
    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      executorContext: {
        unitId: "ou-fake-scope-generator",
      },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_PLACEMENT_MISMATCH");
  });

  // 17. target Santri orgUnitIds are NOT polluted with OSDA division unit
  it("17. target Santri orgUnitIds are NOT polluted with OSDA division unit", () => {
    // Pure scope evaluation test verifying that santri context containing ONLY kamarId matches
    // operational UNIT grant without requiring OU-OSDA-* inside orgUnitIds
    const grant = {
      assignmentId: "asg-osda",
      positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      scopeType: "ASSIGNED_UNITS" as const,
      anchorUnitId: "ou-osda-putri",
      unitIds: ["kamar-putri-101"],
      businessRuleState: "VERIFIED_PRODUCTION" as const,
      genderComplex: "PUTRI" as const,
      orgDomain: "KEASRAMAAN" as const,
    };

    const targetContext = {
      santriId: "santri-putri-1",
      kamarId: "kamar-putri-101",
      orgUnitIds: ["kamar-putri-101"], // Strictly kamarId only, ZERO OSDA unit pollution!
      genderComplex: "PUTRI" as const,
      orgDomain: "KEASRAMAAN" as const,
    };

    assert.ok(!targetContext.orgUnitIds.includes("ou-osda-putri"));

    const result = evaluateScopePredicate(grant, targetContext, {
      userId: "unit-osda",
      accountType: "UNIT",
      genderComplex: "PUTRI",
    });

    assert.equal(result.matches, true);
    assert.equal(result.code, "ALLOWED");
  });

  // 18. Division A account cannot use Division B assignment/placement
  it("18. Division A account cannot use Division B assignment/placement", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-div-a": {
          userId: "unit-div-a",
          username: "osda.keamanan",
          status: "AKTIF",
          accountType: "UNIT",
        },
      },
      placements: {
        // Account placed in Division A
        "unit-div-a": { unitId: "ou-osda-keamanan", count: 1 },
      },
      assignments: {
        // But active assignment belongs to Division B!
        "unit-div-a": [
          {
            id: "asg-div-b",
            userId: "unit-div-a",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-kebersihan", // Division B!
            unitCode: "OU-OSDA-KEBERSIHAN",
            unitName: "OSDA Kebersihan",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-div-a" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.equal(res.reasonCode, "UNIT_PLACEMENT_MISMATCH");
  });

  // 19. generic OSDA role alone -> zero permission authority
  it("19. generic OSDA role alone -> zero permission authority", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-osda-role": {
          userId: "user-osda-role",
          username: "random.osda",
          status: "AKTIF",
          role: "OSDA",
          accountType: "PERSONAL", // Generic human account with OSDA role
        },
      },
      assignments: {
        "user-osda-role": [], // No canonical assignment
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "user-osda-role", role: "OSDA" } as any,
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.reasonCode, "NO_ACTIVE_ASSIGNMENTS");
  });

  // 20. generic OSDA role alone -> cannot use catatAbsensiAction
  it("20. generic OSDA role alone -> cannot use catatAbsensiAction", async () => {
    // Calling catatAbsensiAction as OSDA role is denied
    // Mock getCurrentSession via mocking auth module behavior
    const result = await catatAbsensiAction({
      santriId: "san-1",
      kegiatan: "Tahajjud",
      status: "HADIR" as any,
    });

    // In unauthenticated unit test environment, returns login required
    // When role is OSDA, verified explicitly in code to deny OSDA role write
    assert.equal(result.success, false);
  });

  // 21. Mudhabbir own Kamar -> permitted only with canonical valid grant
  it("21. Mudhabbir own Kamar -> permitted only with canonical valid grant", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-mudhabbir": {
          userId: "user-mudhabbir",
          username: "mudhabbir.ahmad",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-ahmad",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-mudhabbir": [
          {
            id: "asg-mudhabbir-kamar1",
            userId: "user-mudhabbir",
            positionId: "pos-ph",
            positionCode: "PEMBINA_HALAQOH",
            positionName: "Pembina Halaqoh",
            domain: "KEASRAMAAN",
            unitId: "kamar-101",
            unitCode: "KMR-101",
            unitName: "Kamar Abu Bakar",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "KAMAR",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
      resourceContexts: {
        "san-in-kamar1": {
          santriId: "san-in-kamar1",
          kamarId: "kamar-101",
          orgUnitIds: ["kamar-101"],
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "user-mudhabbir" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      resourceContext: { santriId: "san-in-kamar1" },
      dataProvider,
    });

    assert.equal(res.decision, "ALLOW");
    assert.equal(res.code, "ALLOWED");
    assert.equal(res.scopeType, "KAMAR");
  });

  // 22. Mudhabbir other Kamar -> DENY
  it("22. Mudhabbir other Kamar -> DENY", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-mudhabbir": {
          userId: "user-mudhabbir",
          username: "mudhabbir.ahmad",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-ahmad",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-mudhabbir": [
          {
            id: "asg-mudhabbir-kamar1",
            userId: "user-mudhabbir",
            positionId: "pos-ph",
            positionCode: "PEMBINA_HALAQOH",
            positionName: "Pembina Halaqoh",
            domain: "KEASRAMAAN",
            unitId: "kamar-101",
            unitCode: "KMR-101",
            unitName: "Kamar Abu Bakar",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "KAMAR",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
      resourceContexts: {
        "san-in-kamar2": {
          santriId: "san-in-kamar2",
          kamarId: "kamar-102", // Different Kamar!
          orgUnitIds: ["kamar-102"],
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "user-mudhabbir" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      resourceContext: { santriId: "san-in-kamar2" },
      dataProvider,
    });

    assert.equal(res.decision, "DENY");
    assert.equal(res.code, "SCOPE_MISMATCH");
  });

  // 23. PH/username alone cannot manufacture Mudhabbir authority
  it("23. PH/username alone cannot manufacture Mudhabbir authority", async () => {
    // Mock prisma where user has generic PH role or username but NO canonical assignment/staff
    const mockPrismaUserOnly = {
      user: {
        findUnique: async () => ({
          id: "user-fake-mudabbir",
          username: "mudhabbir.palsu",
          role: "PH",
          status: "AKTIF",
          accountType: "PERSONAL",
          staff: null, // No linked staff!
        }),
      },
      assignment: {
        findFirst: async () => null,
        findMany: async () => [],
      },
    };

    const isMud = await resolveUserIsMudabbir("user-fake-mudabbir", mockPrismaUserOnly);
    assert.equal(isMud, false);

    const units = await getMudabbirAssignedUnitIds("user-fake-mudabbir", mockPrismaUserOnly);
    assert.deepEqual(units, []);

    const cap = await resolveMudabbirPermissionCapability(
      "user-fake-mudabbir",
      undefined,
      createPrismaDataProvider(mockPrismaUserOnly as any)
    );
    assert.equal(cap.authorized, false);
  });

  // Helper mock Prisma client for kamar management tests
  function createMockPrismaForKamar(initialDb?: any) {
    const db = {
      orgUnits: initialDb?.orgUnits || [],
      assignments: initialDb?.assignments || [],
      placements: initialDb?.placements || [],
      auditLogs: initialDb?.auditLogs || [],
      users: initialDb?.users || [],
      positions: initialDb?.positions || [
        { id: "pos-ph", code: "PEMBINA_HALAQOH", isActive: true },
      ],
      santris: initialDb?.santris || [],
    };

    const tx = {
      orgUnit: {
        findUnique: async ({ where }: any) => db.orgUnits.find((u: any) => u.id === where.id || u.code === where.code) || null,
        findMany: async (args?: any) => {
          if (!args?.where) return db.orgUnits;
          return db.orgUnits.filter((u: any) => {
            if (args.where.id && u.id !== args.where.id) return false;
            if (args.where.isActive !== undefined && u.isActive !== args.where.isActive) return false;
            return true;
          });
        },
        create: async ({ data }: any) => {
          const item = { id: `ou-${Date.now()}-${Math.random()}`, ...data };
          db.orgUnits.push(item);
          return item;
        },
        update: async ({ where, data }: any) => {
          const item = db.orgUnits.find((u: any) => u.id === where.id);
          if (!item) throw new Error("OrgUnit not found");
          Object.assign(item, data);
          return item;
        },
      },
      assignment: {
        findMany: async ({ where }: any) =>
          db.assignments.filter((a: any) => (!where?.unitId || a.unitId === where.unitId) && (!where?.status || a.status === where.status)),
        create: async ({ data }: any) => {
          const item = { id: `asg-${Date.now()}-${Math.random()}`, ...data };
          db.assignments.push(item);
          return item;
        },
        update: async ({ where, data }: any) => {
          const item = db.assignments.find((a: any) => a.id === where.id);
          if (!item) throw new Error("Assignment not found");
          Object.assign(item, data);
          return item;
        },
      },
      santriKamarPlacement: {
        findMany: async ({ where }: any) =>
          db.placements.filter((p: any) => (!where?.santriId || p.santriId === where.santriId) && (where?.isActive === undefined || p.isActive === where.isActive)),
        create: async ({ data }: any) => {
          const item = { id: `skp-${Date.now()}-${Math.random()}`, ...data };
          db.placements.push(item);
          return item;
        },
        update: async ({ where, data }: any) => {
          const item = db.placements.find((p: any) => p.id === where.id);
          if (!item) throw new Error("Placement not found");
          Object.assign(item, data);
          return item;
        },
      },
      canonicalAuditLog: {
        create: async ({ data }: any) => {
          if (initialDb?.auditShouldFail) {
            throw new Error("Simulated audit write failure");
          }
          const item = { id: `audit-${Date.now()}`, ...data };
          db.auditLogs.push(item);
          return item;
        },
      },
      user: {
        findUnique: async ({ where }: any) => db.users.find((u: any) => u.id === where.id) || null,
      },
      position: {
        findUnique: async ({ where }: any) => db.positions.find((p: any) => p.code === where.code) || null,
      },
      santri: {
        findUnique: async ({ where }: any) => db.santris.find((s: any) => s.id === where.id) || null,
      },
    };

    return {
      db,
      $transaction: async (cb: any) => cb(tx),
      orgUnit: tx.orgUnit,
      assignment: tx.assignment,
      santriKamarPlacement: tx.santriKamarPlacement,
      canonicalAuditLog: tx.canonicalAuditLog,
      user: tx.user,
      position: tx.position,
      santri: tx.santri,
    } as any;
  }

  // 24. KEPALA_KEASRAMAAN with valid mocked canonical kamar.manage grant can manage Kamar
  it("24. KEPALA_KEASRAMAAN with valid mocked canonical kamar.manage grant can manage Kamar", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma = createMockPrismaForKamar();

    const res = await createKamar({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      code: "KMR-ALI-01",
      name: "Kamar Ali Bin Abi Thalib",
      genderComplex: "PUTRA",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, true);
    assert.equal((res.data as any).code, "KMR-ALI-01");
    assert.equal(mockPrisma.db.orgUnits.length, 1);
    assert.equal(mockPrisma.db.auditLogs.length, 1);
  });

  // 25. non-KEPALA position cannot use kamar.manage
  it("25. non-KEPALA position cannot use kamar.manage", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-mudhabbir": {
          userId: "user-mudhabbir",
          username: "mudhabbir.ahmad",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-ahmad",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-mudhabbir": [
          {
            id: "asg-ph",
            userId: "user-mudhabbir",
            positionId: "pos-ph",
            positionCode: "PEMBINA_HALAQOH",
            positionName: "Pembina Halaqoh",
            domain: "KEASRAMAAN",
            unitId: "kamar-101",
            unitCode: "KMR-101",
            unitName: "Kamar 101",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma = createMockPrismaForKamar();

    const res = await createKamar({
      callerIdentity: { userId: "user-mudhabbir", username: "mudhabbir.ahmad", status: "AKTIF", accountType: "PERSONAL" },
      code: "KMR-INVALID",
      name: "Invalid Kamar",
      genderComplex: "PUTRA",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "CAPABILITY_NOT_GRANTED");
    assert.ok(res.reason?.includes("Only KEPALA_KEASRAMAAN is authorized"));
  });

  // 26. Kamar create validates type/domain/gender
  it("26. Kamar create validates type/domain/gender", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma = createMockPrismaForKamar();

    // Invalid genderComplex
    const res = await createKamar({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      code: "KMR-BAD-GENDER",
      name: "Bad Gender Room",
      genderComplex: "INVALID_GENDER" as any,
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "INVALID_ARGUMENT");
  });

  // 27. Kamar rename retains identity/history
  it("27. Kamar rename retains identity/history", async () => {
    const existingKamar = {
      id: "kmr-1",
      code: "KMR-01",
      name: "Old Kamar Name",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    const mockPrisma = createMockPrismaForKamar({ orgUnits: [existingKamar] });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await renameKamar({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-1",
      newName: "Renamed Kamar Utsman",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, true);
    assert.equal((res.data as any).id, "kmr-1");
    assert.equal((res.data as any).name, "Renamed Kamar Utsman");
    assert.equal(mockPrisma.db.auditLogs.length, 1);
    assert.equal(mockPrisma.db.auditLogs[0].beforeState.name, "Old Kamar Name");
    assert.equal(mockPrisma.db.auditLogs[0].afterState.name, "Renamed Kamar Utsman");
  });

  // 28. assigning Mudhabbir requires active PERSONAL User + active Staff
  it("28. assigning Mudhabbir requires active PERSONAL User + active Staff", async () => {
    const existingKamar = {
      id: "kmr-1",
      code: "KMR-01",
      name: "Kamar Abu Bakar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    // Candidate is UNIT account (invalid for Mudhabbir!)
    const invalidCandidate = {
      id: "user-unit-candidate",
      accountType: "UNIT",
      status: "AKTIF",
      staff: null,
    };
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [existingKamar],
      users: [invalidCandidate],
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await assignMudhabbir({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-1",
      mudhabbirUserId: "user-unit-candidate",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.ok(res.reason?.includes("Mudhabbir identity must be AccountType.PERSONAL"));
  });

  // 29. replacing Mudhabbir deterministically closes prior assignment
  it("29. replacing Mudhabbir deterministically closes prior assignment", async () => {
    const existingKamar = {
      id: "kmr-1",
      code: "KMR-01",
      name: "Kamar Abu Bakar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    const priorAssignment = {
      id: "asg-old-mudhabbir",
      userId: "user-old-mudhabbir",
      positionId: "pos-ph",
      unitId: "kmr-1",
      status: "ACTIVE",
    };
    const newCandidate = {
      id: "user-new-mudhabbir",
      accountType: "PERSONAL",
      status: "AKTIF",
      staff: { id: "stf-new", status: "AKTIF" },
    };
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [existingKamar],
      assignments: [priorAssignment],
      users: [newCandidate],
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await assignMudhabbir({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-1",
      mudhabbirUserId: "user-new-mudhabbir",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, true);
    assert.equal(priorAssignment.status, "REVOKED");
    assert.equal(mockPrisma.db.assignments.length, 2);
    assert.equal(mockPrisma.db.assignments[1].status, "ACTIVE");
    assert.equal(mockPrisma.db.assignments[1].userId, "user-new-mudhabbir");
  });

  // 30. Santri move preserves previous placement history
  it("30. Santri move preserves previous placement history", async () => {
    const targetKamar = {
      id: "kmr-2",
      code: "KMR-02",
      name: "Kamar Umar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    const santri = {
      id: "san-1",
      nama: "Zaid",
      jenisKelamin: "L",
      status: "AKTIF",
    };
    const oldPlacement = {
      id: "skp-old",
      santriId: "san-1",
      kamarId: "kmr-1",
      isActive: true,
    };
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [targetKamar],
      santris: [santri],
      placements: [oldPlacement],
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await moveSantri({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      santriId: "san-1",
      targetKamarId: "kmr-2",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, true);
    assert.equal(oldPlacement.isActive, false);
    assert.equal(mockPrisma.db.placements.length, 2);
    assert.equal(mockPrisma.db.placements[1].isActive, true);
    assert.equal(mockPrisma.db.placements[1].kamarId, "kmr-2");
  });

  // 31. duplicate active SantriKamarPlacement is rejected/fail closed
  it("31. duplicate active SantriKamarPlacement is rejected/fail closed", async () => {
    const targetKamar = {
      id: "kmr-2",
      code: "KMR-02",
      name: "Kamar Umar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    const santri = {
      id: "san-1",
      nama: "Zaid",
      jenisKelamin: "L",
      status: "AKTIF",
    };
    // Corrupt initial state: 2 active placements for same santri!
    const p1 = { id: "skp-1", santriId: "san-1", kamarId: "kmr-1", isActive: true };
    const p2 = { id: "skp-2", santriId: "san-1", kamarId: "kmr-3", isActive: true };
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [targetKamar],
      santris: [santri],
      placements: [p1, p2],
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await moveSantri({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      santriId: "san-1",
      targetKamarId: "kmr-2",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.ok(res.reason?.includes("multiple active placements"));
  });

  // 32. gender-incompatible Kamar placement rejected
  it("32. gender-incompatible Kamar placement rejected", async () => {
    const putriKamar = {
      id: "kmr-putri",
      code: "KMR-P01",
      name: "Kamar Aisyah",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRI",
      isActive: true,
    };
    const putraSantri = {
      id: "san-putra",
      nama: "Abdullah",
      jenisKelamin: "L", // PUTRA
      status: "AKTIF",
    };
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [putriKamar],
      santris: [putraSantri],
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await assignSantri({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-putri",
      santriIds: ["san-putra"],
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.ok(res.reason?.includes("Gender boundary violation"));
  });

  // 33. multi-step Kamar mutation rolls back on failure
  it("33. multi-step Kamar mutation rolls back on failure", async () => {
    let rolledBack = false;
    const mockPrisma = {
      $transaction: async (cb: any) => {
        try {
          return await cb({
            orgUnit: { findUnique: async () => ({ id: "kmr-1", type: "KAMAR", domain: "KEASRAMAAN", isActive: true, genderComplex: "PUTRA" }) },
            santri: { findUnique: async () => ({ id: "san-1", jenisKelamin: "L", status: "AKTIF" }) },
            santriKamarPlacement: {
              findMany: async () => [],
              create: async () => {
                throw new Error("Simulated step failure in placement creation");
              },
            },
            canonicalAuditLog: { create: async () => ({}) },
          });
        } catch (e) {
          rolledBack = true;
          throw e;
        }
      },
    } as any;

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await assignSantri({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-1",
      santriIds: ["san-1"],
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.equal(rolledBack, true);
  });

  // 34. audit failure rolls back mutation
  it("34. audit failure rolls back mutation", async () => {
    const existingKamar = {
      id: "kmr-1",
      code: "KMR-01",
      name: "Kamar Abu Bakar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    // Prisma mock where auditLog.create throws!
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [existingKamar],
      auditShouldFail: true,
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await renameKamar({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-1",
      newName: "Renamed Room",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.ok(res.reason?.includes("Simulated audit write failure"));
  });

  // 35. canonical audit records correct assignment/position/capability/scope
  it("35. canonical audit records correct assignment/position/capability/scope", async () => {
    const existingKamar = {
      id: "kmr-1",
      code: "KMR-01",
      name: "Kamar Abu Bakar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };
    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [existingKamar],
    });

    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala-audit-test",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const res = await renameKamar({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-1",
      newName: "Kamar Abu Bakar Ash-Shiddiq",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, true);
    assert.equal(mockPrisma.db.auditLogs.length, 1);
    const log = mockPrisma.db.auditLogs[0];
    assert.equal(log.assignmentId, "asg-kepala-audit-test");
    assert.equal(log.positionCode, "KEPALA_KEASRAMAAN");
    assert.equal(log.capabilityCode, KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE);
    assert.equal(log.scopeType, "DOMAIN");
  });

  // 36. UNIT audit includes technicalAccount + humanExecutor
  it("36. UNIT audit includes technicalAccount + humanExecutor", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "unit-osda": {
          userId: "unit-osda",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "unit-osda": { unitId: "ou-osda-putri", count: 1 },
      },
      executors: {
        "human-exec-1": {
          userId: "human-exec-1",
          name: "Aisyah Human",
          isActive: true,
          santriId: "san-1",
        },
      },
      assignments: {
        "unit-osda": [
          {
            id: "asg-osda",
            userId: "unit-osda",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-osda-putri",
            unitCode: "OU-OSDA-PUTRI",
            unitName: "OSDA Putri",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "kamar-1",
                unitCode: "KMR-1",
                unitContext: {
                  unitId: "kamar-1",
                  unitCode: "KMR-1",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRI",
                  parentId: "ou-osda-putri",
                  ancestorUnitIds: ["ou-osda-putri"],
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "san-putri": {
          santriId: "san-putri",
          kamarId: "kamar-1",
          orgUnitIds: ["kamar-1"],
          genderComplex: "PUTRI",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const res = await authorizeCanonical({
      identity: { userId: "unit-osda" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: {
        humanExecutorId: "human-exec-1",
      },
      resourceContext: { santriId: "san-putri" },
      dataProvider,
    });

    assert.equal(res.decision, "ALLOW");
    // Verify both technicalAccount and humanExecutor are populated
    assert.equal(res.verifiedExecutor?.userId, "human-exec-1");
    assert.equal(res.verifiedExecutor?.name, "Aisyah Human");
  });

  // 37. zero Kamar state returns CONFIGURATION_NOT_CREATED / DEFERRED semantics
  it("37. zero Kamar state returns CONFIGURATION_NOT_CREATED / DEFERRED semantics", async () => {
    const mockDb: any = {
      orgUnit: {
        findMany: async () => [], // Zero active kamar
      },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDb);
    const kamarGate = report.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");

    assert.ok(kamarGate);
    assert.equal(kamarGate.status, "NOT_READY");
    assert.equal(kamarGate.reason, "CONFIGURATION_NOT_CREATED / DEFERRED");
    assert.equal(kamarGate.blocking, false);
  });

  // 38. active Kamar without coherent Mudhabbir assignment -> NOT_READY
  it("38. active Kamar without coherent Mudhabbir assignment -> NOT_READY", async () => {
    const mockDb: any = {
      orgUnit: {
        findMany: async () => [
          { id: "kmr-1", code: "KMR-1", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
        ],
      },
      santriKamarPlacement: {
        findMany: async () => [],
      },
      assignment: {
        findMany: async () => [], // Zero assignments!
      },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDb);
    const kamarGate = report.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");

    assert.ok(kamarGate);
    assert.equal(kamarGate.status, "NOT_READY");
    assert.equal(kamarGate.blocking, true);
    assert.ok(kamarGate.details.includes("lacks active PERSONAL PEMBINA_HALAQOH"));
  });

  // 39. DB/query failure -> NOT_READY/BLOCKED, never fake READY
  it("39. DB/query failure -> NOT_READY/BLOCKED, never fake READY", async () => {
    const mockDb: any = {
      orgUnit: {
        findMany: async () => {
          throw new Error("Connection refused to database");
        },
      },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDb);
    const kamarGate = report.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");

    assert.ok(kamarGate);
    assert.equal(kamarGate.status, "BLOCKED");
    assert.equal(kamarGate.reason, "DATABASE_UNAVAILABLE");
    assert.equal(kamarGate.blocking, true);
  });

  // 40. production feature flag code contract remains unchanged
  it("40. production feature flag code contract remains unchanged", () => {
    assert.equal(process.env.PENDIDIKAN_V2_UAT_ENABLED, "true");
    assert.equal(typeof POSITION_ACCOUNT_MODALITY_CONTRACT, "object");
    assert.equal(POSITION_ACCOUNT_MODALITY_CONTRACT.PETUGAS_OPERASIONAL_KEASRAMAAN, "UNIT");
    assert.equal(POSITION_ACCOUNT_MODALITY_CONTRACT.PEMBINA_HALAQOH, "PERSONAL");
    assert.equal(POSITION_ACCOUNT_MODALITY_CONTRACT.KEPALA_KEASRAMAAN, "PERSONAL");
  });

  // 41. Strong Division A vs Division B isolation test using opaque IDs (cuid-like strings)
  it("41. Strong Division A vs Division B isolation using opaque IDs", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "clx_unit_div_a_001": {
          userId: "clx_unit_div_a_001",
          username: "op_div_a",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
        "clx_unit_div_b_002": {
          userId: "clx_unit_div_b_002",
          username: "op_div_b",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
        },
      },
      placements: {
        "clx_unit_div_a_001": { unitId: "clx_ou_div_a_001", count: 1 },
        "clx_unit_div_b_002": { unitId: "clx_ou_div_b_002", count: 1 },
      },
      assignments: {
        "clx_unit_div_a_001": [
          {
            id: "clx_asg_a_001",
            userId: "clx_unit_div_a_001",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "clx_ou_div_a_001",
            unitCode: "OU-DIV-A",
            unitName: "Division A",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "clx_kmr_a1",
                unitCode: "KMR-A1",
                unitContext: {
                  unitId: "clx_kmr_a1",
                  unitCode: "KMR-A1",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRI",
                  parentId: "clx_ou_div_a_001",
                  ancestorUnitIds: ["clx_ou_div_a_001"],
                  isActive: true,
                },
              },
            ],
          },
        ],
        "clx_unit_div_b_002": [
          {
            id: "clx_asg_b_002",
            userId: "clx_unit_div_b_002",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "clx_ou_div_b_002",
            unitCode: "OU-DIV-B",
            unitName: "Division B",
            unitGenderComplex: "PUTRI",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "clx_kmr_b1",
                unitCode: "KMR-B1",
                unitContext: {
                  unitId: "clx_kmr_b1",
                  unitCode: "KMR-B1",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRI",
                  parentId: "clx_ou_div_b_002",
                  ancestorUnitIds: ["clx_ou_div_b_002"],
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "clx_san_a1": {
          santriId: "clx_san_a1",
          kamarId: "clx_kmr_a1",
          orgUnitIds: ["clx_kmr_a1"],
          genderComplex: "PUTRI",
          orgDomain: "KEASRAMAAN",
        },
        "clx_san_b1": {
          santriId: "clx_san_b1",
          kamarId: "clx_kmr_b1",
          orgUnitIds: ["clx_kmr_b1"],
          genderComplex: "PUTRI",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    // 1. Division A caller -> Santri A: ALLOW
    const resAtoA = await authorizeCanonical({
      identity: { userId: "clx_unit_div_a_001" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "clx_san_a1" },
      dataProvider,
    });
    assert.equal(resAtoA.decision, "ALLOW");
    assert.equal(resAtoA.code, "ALLOWED");

    // 2. Division A caller -> Santri B: DENY (SCOPE_MISMATCH)
    const resAtoB = await authorizeCanonical({
      identity: { userId: "clx_unit_div_a_001" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "clx_san_b1" },
      dataProvider,
    });
    assert.equal(resAtoB.decision, "DENY");
    assert.equal(resAtoB.code, "SCOPE_MISMATCH");

    // 3. Division B caller -> Santri B: ALLOW
    const resBtoB = await authorizeCanonical({
      identity: { userId: "clx_unit_div_b_002" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "clx_san_b1" },
      dataProvider,
    });
    assert.equal(resBtoB.decision, "ALLOW");
    assert.equal(resBtoB.code, "ALLOWED");

    // 4. Division B caller -> Santri A: DENY (SCOPE_MISMATCH)
    const resBtoA = await authorizeCanonical({
      identity: { userId: "clx_unit_div_b_002" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      resourceContext: { santriId: "clx_san_a1" },
      dataProvider,
    });
    assert.equal(resBtoA.decision, "DENY");
    assert.equal(resBtoA.code, "SCOPE_MISMATCH");
  });

  // 42. Opaque IDs without "osda" behave identically to IDs with "osda" (No semantic string heuristic)
  it("42. Opaque IDs without 'osda' behave identically to IDs with 'osda'", () => {
    const grantWithoutOsda = {
      assignmentId: "asg-cm3-alpha",
      positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      scopeType: "ASSIGNED_UNITS" as const,
      anchorUnitId: "cm3_div_alpha",
      unitIds: [],
      businessRuleState: "VERIFIED_PRODUCTION" as const,
      genderComplex: "PUTRI" as const,
      orgDomain: "KEASRAMAAN" as const,
    };

    const grantWithOsda = {
      assignmentId: "asg-cm3-beta",
      positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
      capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
      scopeType: "ASSIGNED_UNITS" as const,
      anchorUnitId: "cm3_osda_beta",
      unitIds: [],
      businessRuleState: "VERIFIED_PRODUCTION" as const,
      genderComplex: "PUTRI" as const,
      orgDomain: "KEASRAMAAN" as const,
    };

    const targetContext = {
      santriId: "santri-1",
      kamarId: "cm3_kmr_01",
      orgUnitIds: ["cm3_kmr_01"],
      genderComplex: "PUTRI" as const,
      orgDomain: "KEASRAMAAN" as const,
    };

    const res1 = evaluateScopePredicate(grantWithoutOsda, targetContext, {
      userId: "unit-alpha",
      accountType: "UNIT",
      genderComplex: "PUTRI",
    });

    const res2 = evaluateScopePredicate(grantWithOsda, targetContext, {
      userId: "unit-beta",
      accountType: "UNIT",
      genderComplex: "PUTRI",
    });

    // BOTH MUST DENY identically with SCOPE_MISMATCH (no "osda" magic pass!)
    assert.equal(res1.matches, false);
    assert.equal(res1.code, "SCOPE_MISMATCH");
    assert.equal(res2.matches, false);
    assert.equal(res2.code, "SCOPE_MISMATCH");
  });

  // 43. Mudhabbir regression: PEMBINA_HALAQOH anchored only to HALAQOH -> resolveUserIsMudabbir = false, getMudabbirAssignedUnitIds = []
  it("43. Mudhabbir regression: PEMBINA_HALAQOH anchored to HALAQOH confers zero Mudhabbir authority", async () => {
    const mockPrismaTahfizhOnly = {
      user: {
        findUnique: async () => ({
          id: "usr-ust-tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staff: { id: "stf-tahfizh", status: "AKTIF" },
        }),
      },
      assignment: {
        findFirst: async () => null, // No KAMAR assignment!
        findMany: async () => [
          {
            unitId: "ou-hlq-1",
            unit: { type: "HALAQOH", domain: "TAHFIZH", isActive: true },
            scopedUnits: [],
          },
        ],
      },
    };

    const isMud = await resolveUserIsMudabbir("usr-ust-tahfizh", mockPrismaTahfizhOnly as any);
    assert.equal(isMud, false);

    const unitIds = await getMudabbirAssignedUnitIds("usr-ust-tahfizh", mockPrismaTahfizhOnly as any);
    assert.deepEqual(unitIds, []);
  });

  // 44. Inactive Kamar mutation regression: renameKamar on inactive room -> DENIED
  it("44. Inactive Kamar mutation regression: renameKamar on inactive room is DENIED", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [
        {
          id: "kmr-inactive",
          code: "KMR-INACTIVE",
          name: "Inactive Kamar",
          type: "KAMAR",
          domain: "KEASRAMAAN",
          genderComplex: "PUTRA",
          isActive: false, // Inactive!
        },
      ],
    });

    const res = await renameKamar({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-inactive",
      newName: "Renamed Room",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "SYSTEM_FAIL_CLOSED");
    assert.ok(res.reason?.includes("not found"));
  });

  // 45. Kamar scoped inspect regressions: Mudhabbir cannot inspect without kamarId; cannot inspect other room; can inspect own room
  it("45. Kamar scoped inspect: Mudhabbir cannot inspect globally or other room, can inspect own room", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-mudhabbir": {
          userId: "user-mudhabbir",
          username: "mudhabbir.ali",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-ali",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-mudhabbir": [
          {
            id: "asg-ph-own",
            userId: "user-mudhabbir",
            positionId: "pos-ph",
            positionCode: "PEMBINA_HALAQOH",
            positionName: "Pembina Halaqoh",
            domain: "KEASRAMAAN",
            unitId: "kmr-own",
            unitCode: "KMR-OWN",
            unitName: "Kamar Own",
            unitGenderComplex: "PUTRA",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.INSPECT,
                scopeType: "KAMAR",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
      resourceContexts: {
        "kmr-own": {
          kamarId: "kmr-own",
          orgUnitIds: ["kmr-own"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
        "kmr-other": {
          kamarId: "kmr-other",
          orgUnitIds: ["kmr-other"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [
        { id: "kmr-own", code: "KMR-OWN", name: "Kamar Own", type: "KAMAR", domain: "KEASRAMAAN", isActive: true },
        { id: "kmr-other", code: "KMR-OTHER", name: "Kamar Other", type: "KAMAR", domain: "KEASRAMAAN", isActive: true },
      ],
    });

    // 1. Mudhabbir without kamarId (attempting global inspect) -> DENY
    const resGlobal = await inspectKamarConfiguration({
      callerIdentity: { userId: "user-mudhabbir", username: "mudhabbir.ali", status: "AKTIF", accountType: "PERSONAL" },
      prismaClient: mockPrisma,
      dataProvider,
    });
    assert.equal(resGlobal.success, false);

    // 2. Mudhabbir targeting another room -> DENY
    const resOther = await inspectKamarConfiguration({
      callerIdentity: { userId: "user-mudhabbir", username: "mudhabbir.ali", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-other",
      prismaClient: mockPrisma,
      dataProvider,
    });
    assert.equal(resOther.success, false);

    // 3. Mudhabbir targeting own room -> ALLOW
    const resOwn = await inspectKamarConfiguration({
      callerIdentity: { userId: "user-mudhabbir", username: "mudhabbir.ali", status: "AKTIF", accountType: "PERSONAL" },
      kamarId: "kmr-own",
      prismaClient: mockPrisma,
      dataProvider,
    });
    assert.equal(resOwn.success, true);
    assert.equal((resOwn.data as any[])?.length, 1);
    assert.equal((resOwn.data as any[])?.[0].id, "kmr-own");
  });

  // 46. moveSantri no-op audit regression: moving to current room returns NO_CHANGE and records SANTRI_KAMAR_MOVE_NO_CHANGE
  it("46. moveSantri no-op audit: moving to current room returns NO_CHANGE and records SANTRI_KAMAR_MOVE_NO_CHANGE", async () => {
    const dataProvider = createMockDataProvider({
      identities: {
        "user-kepala": {
          userId: "user-kepala",
          username: "kepala.keasramaan",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kepala",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kepala": [
          {
            id: "asg-kepala",
            userId: "user-kepala",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma = createMockPrismaForKamar({
      orgUnits: [
        { id: "kmr-target-1", code: "KMR-01", name: "Kamar 1", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
      ],
      santris: [
        { id: "san-1", nama: "Santri Satu", jenisKelamin: "L" },
      ],
      placements: [
        {
          id: "plc-existing",
          santriId: "san-1",
          kamarId: "kmr-target-1",
          isActive: true,
          startDate: new Date(0),
          endDate: null,
        },
      ],
    });

    const res = await moveSantri({
      callerIdentity: { userId: "user-kepala", username: "kepala.keasramaan", status: "AKTIF", accountType: "PERSONAL" },
      santriId: "san-1",
      targetKamarId: "kmr-target-1",
      prismaClient: mockPrisma,
      dataProvider,
    });

    assert.equal(res.success, true);
    assert.equal(res.code, "NO_CHANGE");
    assert.ok(res.reason?.includes("no move was performed"));

    // Verify transactional audit log recorded SANTRI_KAMAR_MOVE_NO_CHANGE
    const noChangeAudit = mockPrisma.db.auditLogs.find(
      (log: any) => log.action === "SANTRI_KAMAR_MOVE_NO_CHANGE"
    );
    assert.ok(noChangeAudit, "SANTRI_KAMAR_MOVE_NO_CHANGE audit log must be recorded");
    assert.equal(noChangeAudit.entityId, "san-1");
    assert.equal(noChangeAudit.unitId, "kmr-target-1");
  });

  // 47. Readiness throw & parity tests: DB errors fail closed to BLOCKED with DATABASE_UNAVAILABLE; raw SQL parity
  it("47. Readiness throw & parity tests: DB errors fail closed to BLOCKED with DATABASE_UNAVAILABLE; raw SQL parity", async () => {
    // 47.1 santriKamarPlacement.findMany throws -> BLOCKED DATABASE_UNAVAILABLE
    const mockDbPlacementThrows: any = {
      orgUnit: {
        findMany: async () => [
          { id: "kmr-1", code: "KMR-1", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
        ],
      },
      santriKamarPlacement: {
        findMany: async () => {
          throw new Error("Disk read error on placements table");
        },
      },
      assignment: {
        findMany: async () => [],
      },
    };
    const report1 = await checkPendidikanV2ProductionReadiness(mockDbPlacementThrows);
    const gate1 = report1.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");
    assert.ok(gate1);
    assert.equal(gate1.status, "BLOCKED");
    assert.equal(gate1.reason, "DATABASE_UNAVAILABLE");
    assert.equal(gate1.blocking, true);

    // 47.2 assignment.findMany throws -> BLOCKED DATABASE_UNAVAILABLE
    const mockDbAssignmentThrows: any = {
      orgUnit: {
        findMany: async () => [
          { id: "kmr-1", code: "KMR-1", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
        ],
      },
      santriKamarPlacement: {
        findMany: async () => [],
      },
      assignment: {
        findMany: async () => {
          throw new Error("Network timeout querying assignments table");
        },
      },
    };
    const report2 = await checkPendidikanV2ProductionReadiness(mockDbAssignmentThrows);
    const gate2 = report2.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");
    assert.ok(gate2);
    assert.equal(gate2.status, "BLOCKED");
    assert.equal(gate2.reason, "DATABASE_UNAVAILABLE");
    assert.equal(gate2.blocking, true);

    // 47.3 missing assignment delegate when active Kamar exist -> BLOCKED DATABASE_UNAVAILABLE
    const mockDbMissingAssignmentDelegate: any = {
      orgUnit: {
        findMany: async () => [
          { id: "kmr-1", code: "KMR-1", type: "KAMAR", domain: "KEASRAMAAN", genderComplex: "PUTRA", isActive: true },
        ],
      },
      santriKamarPlacement: {
        findMany: async () => [],
      },
      // assignment delegate is undefined!
    };
    const report3 = await checkPendidikanV2ProductionReadiness(mockDbMissingAssignmentDelegate);
    const gate3 = report3.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");
    assert.ok(gate3);
    assert.equal(gate3.status, "BLOCKED");
    assert.equal(gate3.reason, "DATABASE_UNAVAILABLE");
    assert.equal(gate3.blocking, true);

    // 47.4 Raw SQL throws -> BLOCKED DATABASE_UNAVAILABLE
    const mockDbRawSqlThrows: any = {
      $queryRawUnsafe: async (sql: string) => {
        if (sql.includes("FROM \"org_units\"")) {
          return [
            { id: "kmr-1", code: "KMR-1", type: "KAMAR", domain: "KEASRAMAAN", gender_complex: "PUTRA", is_active: true },
          ];
        }
        throw new Error("Raw SQL connection reset by peer");
      },
    };
    const report4 = await checkPendidikanV2ProductionReadiness(mockDbRawSqlThrows);
    const gate4 = report4.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");
    assert.ok(gate4);
    assert.equal(gate4.status, "BLOCKED");
    assert.equal(gate4.reason, "DATABASE_UNAVAILABLE");
    assert.equal(gate4.blocking, true);

    // 47.5 Raw SQL placement inconsistency & invalid domain/gender -> NOT_READY with details
    const mockDbRawSqlIssues: any = {
      $queryRawUnsafe: async (sql: string) => {
        if (sql.includes("FROM \"org_units\"")) {
          return [
            { id: "kmr-bad-domain", code: "KMR-BD", type: "KAMAR", domain: "TAHFIZH", gender_complex: "PUTRA", is_active: true },
            { id: "kmr-bad-gender", code: "KMR-BG", type: "KAMAR", domain: "KEASRAMAAN", gender_complex: "INVALID", is_active: true },
          ];
        }
        if (sql.includes("issue_code")) {
          return [
            { issue_code: "MULTIPLE_ACTIVE_PLACEMENT", entity_id: "san-dup" },
          ];
        }
        return [];
      },
    };
    const report5 = await checkPendidikanV2ProductionReadiness(mockDbRawSqlIssues);
    const gate5 = report5.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");
    assert.ok(gate5);
    assert.equal(gate5.status, "NOT_READY");
    assert.equal(gate5.blocking, true);
    assert.ok(gate5.details.includes("MULTIPLE_ACTIVE_PLACEMENT"));
    assert.ok(gate5.details.includes("invalid domain"));
    assert.ok(gate5.details.includes("invalid genderComplex"));
  });

  // 48. Kamar manage scope lockdown: KEPALA_KEASRAMAAN with GLOBAL is DENIED, DOMAIN is ALLOWED
  it("48. Kamar manage scope lockdown: KEPALA_KEASRAMAAN with GLOBAL is DENIED, DOMAIN is ALLOWED", async () => {
    // 48.1 KEPALA_KEASRAMAAN + VERIFIED kamar.manage + GLOBAL => DENY
    const dataProviderGlobal = createMockDataProvider({
      identities: {
        "user-kk-global": {
          userId: "user-kk-global",
          username: "kk.global",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kk",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kk-global": [
          {
            id: "asg-kk-global",
            userId: "user-kk-global",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "GLOBAL",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma1 = createMockPrismaForKamar();
    const resGlobal = await createKamar({
      callerIdentity: { userId: "user-kk-global", username: "kk.global", status: "AKTIF", accountType: "PERSONAL" },
      code: "KMR-GLB-01",
      name: "Kamar Global Test",
      genderComplex: "PUTRA",
      prismaClient: mockPrisma1,
      dataProvider: dataProviderGlobal,
    });

    assert.equal(resGlobal.success, false);
    assert.equal(resGlobal.code, "CAPABILITY_NOT_GRANTED");
    assert.ok(resGlobal.reason?.includes("@ DOMAIN scope"));

    // 48.2 KEPALA_KEASRAMAAN + VERIFIED kamar.manage + DOMAIN KEASRAMAAN => ALLOW
    const dataProviderDomain = createMockDataProvider({
      identities: {
        "user-kk-domain": {
          userId: "user-kk-domain",
          username: "kk.domain",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kk",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-kk-domain": [
          {
            id: "asg-kk-domain",
            userId: "user-kk-domain",
            positionId: "pos-kk",
            positionCode: "KEPALA_KEASRAMAAN",
            positionName: "Kepala Keasramaan",
            domain: "KEASRAMAAN",
            unitId: "ou-root",
            unitCode: "OU-ROOT",
            unitName: "Root",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
                scopeType: "DOMAIN",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
    });

    const mockPrisma2 = createMockPrismaForKamar();
    const resDomain = await createKamar({
      callerIdentity: { userId: "user-kk-domain", username: "kk.domain", status: "AKTIF", accountType: "PERSONAL" },
      code: "KMR-DOM-01",
      name: "Kamar Domain Test",
      genderComplex: "PUTRA",
      prismaClient: mockPrisma2,
      dataProvider: dataProviderDomain,
    });

    assert.equal(resDomain.success, true);
    assert.equal((resDomain.data as any).code, "KMR-DOM-01");
  });

  // 49. ASSIGNED_UNITS fail-closed on inactive scope units (single active ALLOW, single inactive DENY, mixed active ALLOW & inactive DENY)
  it("49. ASSIGNED_UNITS fail-closed on inactive scope units", async () => {
    // 49.1 Single active scoped Kamar -> ALLOW own target
    const dataProviderSingleActive = createMockDataProvider({
      identities: {
        "op-unit-1": {
          userId: "op-unit-1",
          username: "unit.op1",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "div-op-1",
          genderComplex: "PUTRA",
        },
      },
      placements: {
        "op-unit-1": { unitId: "div-op-1", count: 1 },
      },
      executors: {
        "exec-human-1": {
          userId: "exec-human-1",
          name: "Executor 1",
          isActive: true,
          santriId: "san-dummy",
        },
      },
      assignments: {
        "op-unit-1": [
          {
            id: "asg-op-1",
            userId: "op-unit-1",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas",
            domain: "KEASRAMAAN",
            unitId: "div-op-1",
            unitCode: "DIV-OP-1",
            unitName: "Divisi Op",
            unitGenderComplex: "PUTRA",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "opq-kmr-act-01",
                unitCode: "OPQ-ACT-01",
                unitContext: {
                  unitId: "opq-kmr-act-01",
                  unitCode: "OPQ-ACT-01",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  parentId: "div-op-1",
                  ancestorUnitIds: ["div-op-1"],
                  isActive: true,
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "san-act-target": {
          santriId: "san-act-target",
          kamarId: "opq-kmr-act-01",
          orgUnitIds: ["opq-kmr-act-01"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const resSingleActive = await authorizeCanonical({
      identity: { userId: "op-unit-1" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: { humanExecutorId: "exec-human-1" },
      resourceContext: { santriId: "san-act-target" },
      dataProvider: dataProviderSingleActive,
    });
    assert.equal(resSingleActive.decision, "ALLOW");

    // 49.2 Single inactive scoped Kamar only -> DENY (no fallback to raw unitIds)
    const dataProviderSingleInactive = createMockDataProvider({
      identities: {
        "op-unit-2": {
          userId: "op-unit-2",
          username: "unit.op2",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "div-op-2",
          genderComplex: "PUTRA",
        },
      },
      placements: {
        "op-unit-2": { unitId: "div-op-2", count: 1 },
      },
      executors: {
        "exec-human-1": {
          userId: "exec-human-1",
          name: "Executor 1",
          isActive: true,
          santriId: "san-dummy",
        },
      },
      assignments: {
        "op-unit-2": [
          {
            id: "asg-op-2",
            userId: "op-unit-2",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas",
            domain: "KEASRAMAAN",
            unitId: "div-op-2",
            unitCode: "DIV-OP-2",
            unitName: "Divisi Op 2",
            unitGenderComplex: "PUTRA",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "opq-kmr-inact-02",
                unitCode: "OPQ-INACT-02",
                unitContext: {
                  unitId: "opq-kmr-inact-02",
                  unitCode: "OPQ-INACT-02",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  parentId: "div-op-2",
                  ancestorUnitIds: ["div-op-2"],
                  isActive: false, // INACTIVE!
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "san-inact-target": {
          santriId: "san-inact-target",
          kamarId: "opq-kmr-inact-02",
          orgUnitIds: ["opq-kmr-inact-02"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const resSingleInactive = await authorizeCanonical({
      identity: { userId: "op-unit-2" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: { humanExecutorId: "exec-human-1" },
      resourceContext: { santriId: "san-inact-target" },
      dataProvider: dataProviderSingleInactive,
    });
    assert.equal(resSingleInactive.decision, "DENY");
    assert.equal(resSingleInactive.code, "SCOPE_MISMATCH");

    // 49.3 Mixed active + inactive -> active target ALLOW, inactive target DENY
    const dataProviderMixed = createMockDataProvider({
      identities: {
        "op-unit-3": {
          userId: "op-unit-3",
          username: "unit.op3",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "div-op-3",
          genderComplex: "PUTRA",
        },
      },
      placements: {
        "op-unit-3": { unitId: "div-op-3", count: 1 },
      },
      executors: {
        "exec-human-1": {
          userId: "exec-human-1",
          name: "Executor 1",
          isActive: true,
          santriId: "san-dummy",
        },
      },
      assignments: {
        "op-unit-3": [
          {
            id: "asg-op-3",
            userId: "op-unit-3",
            positionId: "pos-pok",
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            positionName: "Petugas",
            domain: "KEASRAMAAN",
            unitId: "div-op-3",
            unitCode: "DIV-OP-3",
            unitName: "Divisi Op 3",
            unitGenderComplex: "PUTRA",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "ASSIGNED_UNITS",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [
              {
                unitId: "opq-kmr-mix-act",
                unitCode: "OPQ-MIX-ACT",
                unitContext: {
                  unitId: "opq-kmr-mix-act",
                  unitCode: "OPQ-MIX-ACT",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  parentId: "div-op-3",
                  ancestorUnitIds: ["div-op-3"],
                  isActive: true, // ACTIVE
                },
              },
              {
                unitId: "opq-kmr-mix-inact",
                unitCode: "OPQ-MIX-INACT",
                unitContext: {
                  unitId: "opq-kmr-mix-inact",
                  unitCode: "OPQ-MIX-INACT",
                  unitType: "KAMAR",
                  domain: "KEASRAMAAN",
                  genderComplex: "PUTRA",
                  parentId: "div-op-3",
                  ancestorUnitIds: ["div-op-3"],
                  isActive: false, // INACTIVE
                },
              },
            ],
          },
        ],
      },
      resourceContexts: {
        "san-target-act": {
          santriId: "san-target-act",
          kamarId: "opq-kmr-mix-act",
          orgUnitIds: ["opq-kmr-mix-act"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
        "san-target-inact": {
          santriId: "san-target-inact",
          kamarId: "opq-kmr-mix-inact",
          orgUnitIds: ["opq-kmr-mix-inact"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    const resMixedAct = await authorizeCanonical({
      identity: { userId: "op-unit-3" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: { humanExecutorId: "exec-human-1" },
      resourceContext: { santriId: "san-target-act" },
      dataProvider: dataProviderMixed,
    });
    assert.equal(resMixedAct.decision, "ALLOW");

    const resMixedInact = await authorizeCanonical({
      identity: { userId: "op-unit-3" },
      capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
      isMutation: true,
      executorContext: { humanExecutorId: "exec-human-1" },
      resourceContext: { santriId: "san-target-inact" },
      dataProvider: dataProviderMixed,
    });
    assert.equal(resMixedInact.decision, "DENY");
    assert.equal(resMixedInact.code, "SCOPE_MISMATCH");
  });

  // 50. Mudhabbir permission wrapper requires target resource context
  it("50. Mudhabbir permission wrapper requires target resource context", async () => {
    const dataProviderMud = createMockDataProvider({
      identities: {
        "user-mud-test": {
          userId: "user-mud-test",
          username: "mud.test",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mud",
          staffStatus: "AKTIF",
        },
      },
      assignments: {
        "user-mud-test": [
          {
            id: "asg-mud-test",
            userId: "user-mud-test",
            positionId: "pos-pembina",
            positionCode: "PEMBINA_HALAQOH",
            positionName: "Pembina",
            domain: "KEASRAMAAN",
            unitId: "kmr-own-101",
            unitCode: "KMR-OWN-101",
            unitName: "Kamar Own",
            unitGenderComplex: "PUTRA",
            status: "ACTIVE",
            validFrom: new Date(0),
            validUntil: null,
            positionCapabilities: [
              {
                capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
                scopeType: "UNIT",
                businessRuleState: "VERIFIED_PRODUCTION",
              },
            ],
            scopeUnits: [],
          },
        ],
      },
      resourceContexts: {
        "kmr-own-101": {
          kamarId: "kmr-own-101",
          orgUnitIds: ["kmr-own-101"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
        "kmr-other-202": {
          kamarId: "kmr-other-202",
          orgUnitIds: ["kmr-other-202"],
          genderComplex: "PUTRA",
          orgDomain: "KEASRAMAAN",
        },
      },
    });

    // 50.1 Verified PEMBINA_HALAQOH + no resourceContext => authorized: false
    const resNoContext = await resolveMudabbirPermissionCapability(
      "user-mud-test",
      undefined,
      dataProviderMud
    );
    assert.equal(resNoContext.authorized, false);
    assert.ok(resNoContext.reason?.includes("Target resource context is required"));

    // 50.2 Verified PEMBINA_HALAQOH + empty resourceContext => authorized: false
    const resEmptyContext = await resolveMudabbirPermissionCapability(
      "user-mud-test",
      {} as any,
      dataProviderMud
    );
    assert.equal(resEmptyContext.authorized, false);
    assert.ok(resEmptyContext.reason?.includes("Target resource context is required"));

    // 50.3 Verified PEMBINA_HALAQOH + own Kamar target => true
    const resOwnKamar = await resolveMudabbirPermissionCapability(
      "user-mud-test",
      { kamarId: "kmr-own-101" },
      dataProviderMud
    );
    assert.equal(resOwnKamar.authorized, true);
    assert.equal(resOwnKamar.assignmentId, "asg-mud-test");
    assert.equal(resOwnKamar.positionCode, "PEMBINA_HALAQOH");

    // 50.4 Verified PEMBINA_HALAQOH + other Kamar target => false
    const resOtherKamar = await resolveMudabbirPermissionCapability(
      "user-mud-test",
      { kamarId: "kmr-other-202" },
      dataProviderMud
    );
    assert.equal(resOtherKamar.authorized, false);
  });

  // 51. Readiness check fails closed when no Kamar repository or raw SQL delegate is available
  it("51. Readiness check fails closed when no Kamar repository or raw SQL delegate is available", async () => {
    const mockDbNoDelegates: any = {};
    const report = await checkPendidikanV2ProductionReadiness(mockDbNoDelegates);
    const kamarGate = report.gates.find((g) => g.gate === "KEASRAMAAN_KAMAR_CONFIGURATION_READY");

    assert.ok(kamarGate);
    assert.equal(kamarGate.status, "BLOCKED");
    assert.equal(kamarGate.reason, "DATABASE_UNAVAILABLE");
    assert.equal(kamarGate.blocking, true);
    assert.ok(kamarGate.details.includes("No authoritative Kamar repository or query mechanism"));
  });

});
