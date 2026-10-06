/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createKamar,
  updateKamar,
  setKamarActive,
  assignMudhabbir,
  assignSantri,
  moveSantri,
  validateUsrohHierarchy,
} from "../lib/server/kamar-management-service";
import {
  evaluateExecutionGuards,
  TARGET_OSDA_DIVISIONS,
  TARGET_TKS_SERVICE_UNITS,
} from "../scripts/provision-w2-osda-tks";
import {
  CanonicalIdentity,
  CanonicalAssignmentWithDetails,
  ICanonicalDataProvider,
} from "../lib/auth/canonical-evaluator";

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
        orgUnitIds: [requested.kamarId].filter(Boolean),
        genderComplex: requested.genderComplex,
        orgDomain: "KEASRAMAAN",
      };
    },
  };
}

describe("W2 REMEDIATION — TRACK A (MUDIR KAMAR CONFIG) & TRACK E/F", () => {
  // Test identities
  const mudirIdentity: CanonicalIdentity = {
    userId: "mudir-user-1",
    username: "mudir.stq",
    status: "AKTIF",
    accountType: "PERSONAL",
    placementUnitId: null,
    staffId: "staff-mudir-1",
    staffStatus: "AKTIF",
  };

  const nonAuthorizedIdentity: CanonicalIdentity = {
    userId: "staff-non-auth",
    username: "guru.akademik",
    status: "AKTIF",
    accountType: "PERSONAL",
    placementUnitId: null,
  };

  const mudirValidAssignment: CanonicalAssignmentWithDetails = {
    id: "asg-mudir-kamar",
    userId: "mudir-user-1",
    positionId: "pos-mudir",
    positionCode: "MUDIR",
    positionName: "Mudir",
    domain: "INSTITUTIONAL",
    unitId: "ou-stq-root",
    unitCode: "OU-STQ-ROOT",
    unitName: "STQ Root",
    status: "ACTIVE",
    validFrom: new Date(0),
    validUntil: null,
    positionCapabilities: [
      {
        capabilityCode: "keasramaan.kamar.manage",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
      },
      {
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
      },
    ],
    scopeUnits: [],
  };

  const mockDataProvider = createMockDataProvider({
    identities: {
      "mudir-user-1": mudirIdentity,
      "staff-non-auth": nonAuthorizedIdentity,
    },
    assignments: {
      "mudir-user-1": [mudirValidAssignment],
      "staff-non-auth": [],
    },
  });

  // 1. Mudir Canonical Authority: ALLOW
  it("1. Mudir with keasramaan.kamar.manage (GLOBAL scope) is authorized to manage Kamar", async () => {
    const mockPrisma = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: {
            findUnique: async () => null,
            create: async (args: any) => ({
              id: "kamar-new-1",
              ...args.data,
            }),
          },
          canonicalAuditLog: {
            create: async () => ({ id: "audit-1" }),
          },
        }),
    } as any;

    const res = await createKamar({
      callerIdentity: mudirIdentity,
      code: "OU-KAMAR-ALI",
      name: "Kamar Ali Bin Abi Thalib",
      genderComplex: "PUTRA",
      prismaClient: mockPrisma,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual((res.data as any)?.code, "OU-KAMAR-ALI");
  });

  // 2. Non-Authorized User: FAIL CLOSED
  it("2. User without keasramaan.kamar.manage capability fails closed (CAPABILITY_NOT_GRANTED)", async () => {
    const res = await createKamar({
      callerIdentity: nonAuthorizedIdentity,
      code: "OU-KAMAR-ALI",
      name: "Kamar Ali Bin Abi Thalib",
      genderComplex: "PUTRA",
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
  });

  // 3. Session Role KS without Canonical Capability: FAIL CLOSED (no session.role bypass)
  it("3. Caller claiming role KS without canonical capability is strictly rejected", async () => {
    const sessionOnlyUser = {
      userId: "fake-ks-user",
      username: "fake.ks",
      role: "KS",
    } as any;

    const res = await createKamar({
      callerIdentity: sessionOnlyUser,
      code: "OU-KAMAR-ALI",
      name: "Kamar Ali Bin Abi Thalib",
      genderComplex: "PUTRA",
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, false);
    assert.ok(["CAPABILITY_NOT_GRANTED", "IDENTITY_NOT_LINKED"].includes(res.code!));
  });

  // 4. Update Kamar (Edit name, code, genderComplex)
  it("4. Mudir can edit Kamar properties (name, genderComplex) with audit trail", async () => {
    const mockKamar = {
      id: "kamar-existing-1",
      code: "OU-KAMAR-USMAN",
      name: "Kamar Usman",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };

    let auditCreated = false;
    const mockPrisma = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: {
            findUnique: async () => mockKamar,
            update: async (args: any) => ({ ...mockKamar, ...args.data }),
          },
          canonicalAuditLog: {
            create: async (args: any) => {
              auditCreated = true;
              assert.strictEqual(args.data.action, "KAMAR_UPDATE");
              assert.strictEqual(args.data.entityId, "kamar-existing-1");
              return { id: "audit-update-1" };
            },
          },
        }),
    } as any;

    const res = await updateKamar({
      callerIdentity: mudirIdentity,
      kamarId: "kamar-existing-1",
      name: "Kamar Utsman Bin Affan (Lantai 2)",
      genderComplex: "PUTRA",
      prismaClient: mockPrisma,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual((res.data as any)?.name, "Kamar Utsman Bin Affan (Lantai 2)");
    assert.strictEqual(auditCreated, true);
  });

  // 5. Soft-disable Kamar
  it("5. Mudir can soft-disable (isActive = false) Kamar OrgUnit", async () => {
    const mockKamar = {
      id: "kamar-active-1",
      code: "OU-KAMAR-UMAR",
      name: "Kamar Umar",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };

    const mockPrisma = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: {
            findUnique: async () => mockKamar,
            update: async (args: any) => ({ ...mockKamar, ...args.data }),
          },
          canonicalAuditLog: {
            create: async () => ({ id: "audit-disable-1" }),
          },
        }),
    } as any;

    const res = await setKamarActive({
      callerIdentity: mudirIdentity,
      kamarId: "kamar-active-1",
      isActive: false,
      prismaClient: mockPrisma,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual((res.data as any)?.isActive, false);
  });

  // 6. Mudhabbir Assignment: Must be PERSONAL account with active Staff
  it("6. Mudhabbir assignment rejects UNIT accounts or missing Staff profile", async () => {
    const mockKamar = {
      id: "kamar-target-1",
      code: "OU-KAMAR-TARGET",
      name: "Kamar Target",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      isActive: true,
    };

    const mockPrismaUnitUser = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: { findUnique: async () => mockKamar },
          user: {
            findUnique: async () => ({
              id: "unit-user-1",
              accountType: "UNIT", // Invalid for Mudhabbir
              status: "AKTIF",
              staff: null,
            }),
          },
        }),
    } as any;

    const res = await assignMudhabbir({
      callerIdentity: mudirIdentity,
      kamarId: "kamar-target-1",
      mudhabbirUserId: "unit-user-1",
      prismaClient: mockPrismaUnitUser,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, false);
    assert.match(res.reason || "", /AccountType\.PERSONAL/);
  });

  // 7. Mudhabbir Assignment: Multi-Kamar Scoping via AssignmentScopeUnit
  it("7. Mudhabbir assignment supports multi-Kamar scoping via AssignmentScopeUnit", async () => {
    const mockKamar1 = { id: "kamar-1", code: "OU-KAMAR-1", name: "Kamar 1", type: "KAMAR", domain: "KEASRAMAAN", isActive: true };
    const mockKamar2 = { id: "kamar-2", code: "OU-KAMAR-2", name: "Kamar 2", type: "KAMAR", domain: "KEASRAMAAN", isActive: true };

    const mockPersonalStaff = {
      id: "user-mudhabbir-1",
      accountType: "PERSONAL",
      status: "AKTIF",
      staff: { id: "staff-1", status: "AKTIF" },
    };

    const mockPosition = {
      id: "pos-ph-1",
      code: "PEMBINA_HALAQOH",
      isActive: true,
    };

    let scopedUnitsCreated: any[] = [];

    const mockPrisma = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: {
            findUnique: async ({ where }: any) => {
              if (where.id === "kamar-1") return mockKamar1;
              if (where.id === "kamar-2") return mockKamar2;
              return null;
            },
          },
          user: { findUnique: async () => mockPersonalStaff },
          position: { findUnique: async () => mockPosition },
          assignment: {
            findMany: async () => [],
            create: async (args: any) => {
              scopedUnitsCreated = args.data.scopedUnits?.create || [];
              return {
                id: "asg-mudhabbir-created",
                ...args.data,
                scopedUnits: scopedUnitsCreated,
              };
            },
          },
          canonicalAuditLog: { create: async () => ({ id: "audit-mudhabbir-1" }) },
        }),
    } as any;

    const res = await assignMudhabbir({
      callerIdentity: mudirIdentity,
      kamarId: "kamar-1",
      mudhabbirUserId: "user-mudhabbir-1",
      additionalKamarIds: ["kamar-2"],
      prismaClient: mockPrisma,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(scopedUnitsCreated.length, 2);
    assert.deepStrictEqual(scopedUnitsCreated.map((u) => u.unitId), ["kamar-1", "kamar-2"]);
  });

  // 8. Santri Placement: Enforces Gender Boundary
  it("8. Santri placement strictly enforces room gender boundaries", async () => {
    const mockPutriKamar = {
      id: "kamar-putri-1",
      code: "OU-KAMAR-AISYAH",
      name: "Kamar Aisyah",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRI",
      isActive: true,
    };

    const mockPutraSantri = {
      id: "santri-putra-1",
      nama: "Ahmad Santri",
      jenisKelamin: "L", // L = PUTRA
      status: "AKTIF",
    };

    const mockPrisma = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: { findUnique: async () => mockPutriKamar },
          santri: { findUnique: async () => mockPutraSantri },
        }),
    } as any;

    const res = await assignSantri({
      callerIdentity: mudirIdentity,
      kamarId: "kamar-putri-1",
      santriIds: ["santri-putra-1"],
      prismaClient: mockPrisma,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, false);
    assert.match(res.reason || "", /Gender boundary violation/);
  });

  // 9. Santri Transfer: Closes Old Placement & Preserves History
  it("9. Santri transfer closes existing placement with endDate and preserves history", async () => {
    const mockTargetKamar = {
      id: "kamar-target-2",
      code: "OU-KAMAR-TARGET-2",
      name: "Kamar Target 2",
      type: "KAMAR",
      domain: "KEASRAMAAN",
      genderComplex: "PUTRA",
      isActive: true,
    };

    const mockSantri = {
      id: "santri-putra-2",
      nama: "Zaid Santri",
      jenisKelamin: "L",
      status: "AKTIF",
    };

    const oldPlacement = {
      id: "placement-old-1",
      santriId: "santri-putra-2",
      kamarId: "kamar-old-1",
      isActive: true,
      startDate: new Date("2026-01-01"),
    };

    let oldPlacementClosed = false;
    let newPlacementCreated = false;

    const mockPrisma = {
      $transaction: async (cb: any) =>
        cb({
          orgUnit: { findUnique: async () => mockTargetKamar },
          santri: { findUnique: async () => mockSantri },
          santriKamarPlacement: {
            findMany: async () => [oldPlacement],
            update: async (args: any) => {
              if (args.where.id === "placement-old-1" && args.data.isActive === false) {
                oldPlacementClosed = true;
              }
              return { ...oldPlacement, ...args.data };
            },
            create: async (args: any) => {
              newPlacementCreated = true;
              return { id: "placement-new-2", ...args.data };
            },
          },
          canonicalAuditLog: { create: async () => ({ id: "audit-transfer-1" }) },
        }),
    } as any;

    const res = await moveSantri({
      callerIdentity: mudirIdentity,
      santriId: "santri-putra-2",
      targetKamarId: "kamar-target-2",
      notes: "Pindah lantai atas",
      prismaClient: mockPrisma,
      dataProvider: mockDataProvider,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(oldPlacementClosed, true);
    assert.strictEqual(newPlacementCreated, true);
    assert.strictEqual((res.data as any)?.kamarId, "kamar-target-2");
  });

  // 10. ORR-091 Usroh Hierarchy Validation: Must have parent OSDA and NOT Divisi Kebersihan
  it("10. Usroh hierarchy validation strictly rejects Divisi Kebersihan as structural parent", () => {
    // Attempt with Divisi Kebersihan as parent
    const resForbidden = validateUsrohHierarchy({
      type: "USROH",
      domain: "KEASRAMAAN",
      parentOrgUnit: {
        id: "ou-divisi-kebersihan",
        code: "OU-OSDA-KEBERSIHAN",
        name: "Divisi Kebersihan dan Kerapihan",
        type: "DIVISION",
        domain: "KEASRAMAAN",
        isActive: true,
      },
    });

    assert.strictEqual(resForbidden.valid, false);
    assert.strictEqual(resForbidden.code, "FORBIDDEN_PARENT_DIVISI_KEBERSIHAN");

    // Valid attempt with OSDA root as parent
    const resValid = validateUsrohHierarchy({
      type: "USROH",
      domain: "KEASRAMAAN",
      parentOrgUnit: {
        id: "ou-osda-root-1",
        code: "OU-OSDA-ROOT",
        name: "Organisasi Santri Darul Ulum Cendekia",
        type: "ORGANIZATION",
        domain: "KEASRAMAAN",
        isActive: true,
      },
    });

    assert.strictEqual(resValid.valid, true);
  });

  // 11. ORR-089 & ORR-094 Structural Provisioning Script Guards
  it("11. Structural provisioning script defaults to read-only preflight and rejects mutation without flags", () => {
    // Test 1: No flags -> READ-ONLY preflight
    const guardsDefault = evaluateExecutionGuards([], { NODE_ENV: "test" });
    assert.strictEqual(guardsDefault.isExecuteApproved, false);
    assert.strictEqual(guardsDefault.hasExecuteFlag, false);

    // Test 2: --execute flag without directive or env -> REJECTED
    const guardsIncomplete = evaluateExecutionGuards(["--execute"], { NODE_ENV: "test" });
    assert.strictEqual(guardsIncomplete.isExecuteApproved, false);
    assert.strictEqual(guardsIncomplete.failureReasons.length, 2);

    // Test 3: Full flags and approved env -> APPROVED
    const guardsApproved = evaluateExecutionGuards(
      ["--execute", "--owner-directive=DIR-2026-W2-STRUCTURAL"],
      { NODE_ENV: "test", PRODUCTION_MUTATION_APPROVED: "DIR-2026-W2-STRUCTURAL" }
    );
    assert.strictEqual(guardsApproved.isExecuteApproved, true);
    assert.strictEqual(guardsApproved.failureReasons.length, 0);

    // Test 4: Verify exact 5 OSDA divisions and 6 TKS service units specified
    assert.strictEqual(TARGET_OSDA_DIVISIONS.length, 5);
    assert.strictEqual(TARGET_TKS_SERVICE_UNITS.length, 6);
  });
});
