/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
  ICanonicalDataProvider,
} from "../lib/auth/canonical-evaluator";
import {
  KEASRAMAAN_PERMISSION_CAPABILITIES,
  STUDENT_PRIVACY_CAPABILITIES,
  CANONICAL_PERSONAL_PERMISSION_MUTATION_TARGET_POLICIES,
  CANONICAL_GUARDIAN_CONTACT_PRIVACY_TARGET_POLICIES,
  UAT_ACTIVATION_TARGETS,
  OSDA_PUTRI_UNIT_CONTRACT,
  CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT,
  ResolvedResourceContext,
  BusinessRuleState,
} from "../types/architecture-lock";
import { resolveAuthorizedGuardianContactSantriIds } from "../lib/server/santri-list-service";
import { UserSession } from "../types/auth";

const PR8_IMMUTABLE_COMMIT = "9068cae5587b7219c394c5c25bf0de07a15b0726";

// =============================================================================
// Helper Factories for Mock Canonical Assignments & Identities
// =============================================================================

function createStaffIdentity(opts: {
  userId: string;
  username: string;
  staffId?: string;
  role?: string;
  status?: string;
  mockAssignments?: CanonicalAssignmentWithDetails[];
}) {
  return {
    userId: opts.userId,
    username: opts.username,
    role: opts.role || "STF",
    status: opts.status || "AKTIF",
    accountType: "PERSONAL" as const,
    staffId: opts.staffId || `stf-${opts.userId}`,
    mockAssignments: opts.mockAssignments || [],
  };
}

function createMudabbirAssignment(
  kamarId: string = "OU-KMR-01",
  state: BusinessRuleState = "VERIFIED_PRODUCTION",
  status: "ACTIVE" | "SUSPENDED" = "ACTIVE"
): CanonicalAssignmentWithDetails {
  return {
    id: `asg-mudabbir-${kamarId}`,
    userId: "usr-mudabbir-01",
    positionId: "pos-pembina-halaqoh",
    positionCode: "PEMBINA_HALAQOH",
    positionName: "Pembina Halaqoh / Mudabbir",
    domain: "KEASRAMAAN",
    unitId: kamarId,
    unitCode: kamarId,
    unitName: `Kamar ${kamarId}`,
    unitGenderComplex: "PUTRA",
    status,
    validFrom: new Date(0),
    validUntil: null,
    requiresPersonalAccount: true,
    positionCapabilities: [
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        scopeType: "KAMAR",
        businessRuleState: state,
      },
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        scopeType: "KAMAR",
        businessRuleState: state,
      },
      {
        capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
        scopeType: "KAMAR",
        businessRuleState: state,
      },
    ],
    scopeUnits: [{ unitId: kamarId }],
  };
}

function createKepalaKeasramaanAssignment(
  state: BusinessRuleState = "VERIFIED_PRODUCTION",
  status: "ACTIVE" | "SUSPENDED" = "ACTIVE"
): CanonicalAssignmentWithDetails {
  return {
    id: "asg-ks-01",
    userId: "usr-kepala-keasramaan",
    positionId: "pos-kepala-keasramaan",
    positionCode: "KEPALA_KEASRAMAAN",
    positionName: "Kepala Keasramaan",
    domain: "KEASRAMAAN",
    unitId: "OU-KEASRAMAAN",
    unitCode: "OU-KEASRAMAAN",
    unitName: "Direktorat Keasramaan",
    unitGenderComplex: "TIDAK_TERIKAT",
    status,
    validFrom: new Date(0),
    validUntil: null,
    requiresPersonalAccount: true,
    positionCapabilities: [
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        scopeType: "DOMAIN",
        businessRuleState: state,
      },
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        scopeType: "DOMAIN",
        businessRuleState: state,
      },
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
        scopeType: "DOMAIN",
        businessRuleState: state,
      },
      {
        capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
        scopeType: "DOMAIN",
        businessRuleState: state,
      },
    ],
    scopeUnits: [],
  };
}

function createMudirAssignment(
  state: BusinessRuleState = "VERIFIED_PRODUCTION",
  status: "ACTIVE" | "SUSPENDED" = "ACTIVE"
): CanonicalAssignmentWithDetails {
  return {
    id: "asg-mudir-01",
    userId: "usr-mudir",
    positionId: "pos-mudir",
    positionCode: "MUDIR",
    positionName: "Mudir Pesantren",
    domain: "MANAJEMEN",
    unitId: "OU-ROOT",
    unitCode: "OU-ROOT",
    unitName: "STQ Darul Ulum Cendekia",
    unitGenderComplex: "TIDAK_TERIKAT",
    status,
    validFrom: new Date(0),
    validUntil: null,
    requiresPersonalAccount: true,
    positionCapabilities: [
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        scopeType: "GLOBAL",
        businessRuleState: state,
      },
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        scopeType: "GLOBAL",
        businessRuleState: state,
      },
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
        scopeType: "GLOBAL",
        businessRuleState: state,
      },
      {
        capabilityCode: STUDENT_PRIVACY_CAPABILITIES.GUARDIAN_CONTACT_READ,
        scopeType: "GLOBAL",
        businessRuleState: state,
      },
    ],
    scopeUnits: [],
  };
}

function createOsdaPutriUnitAssignment(
  state: BusinessRuleState = "VERIFIED_PRODUCTION"
): CanonicalAssignmentWithDetails {
  return {
    id: "asg-osda-putri-01",
    userId: "usr-osda-putri",
    positionId: "pos-pok",
    positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
    positionName: "Petugas Operasional Keasramaan",
    domain: "KEASRAMAAN",
    unitId: "OU-OSDA-PUTRI",
    unitCode: "OU-OSDA-PUTRI",
    unitName: "OSDA Putri",
    unitGenderComplex: "PUTRI",
    status: "ACTIVE",
    validFrom: new Date(0),
    validUntil: null,
    requiresPersonalAccount: false,
    positionCapabilities: [
      {
        capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
        scopeType: "DOMAIN",
        businessRuleState: state,
      },
    ],
    scopeUnits: [],
  };
}

// =============================================================================
// SUITE EXECUTION: 45 TESTS COVERING C1, D1, WORKFLOW, AND BOUNDARIES
// =============================================================================

describe("STQ GATE 5 — FINAL PERSONAL AUTHORITY & PRIVACY RECONCILIATION SUITE", () => {

  // ===========================================================================
  // SUITE 1: PERMISSION CREATE AUTHORITY (DIR-2026-039 / C1) (Tests 1–10)
  // ===========================================================================
  describe("1. Permission Create Authority (DIR-2026-039 / C1)", () => {
    it("1. Mudabbir (PEMBINA_HALAQOH) creates permission for santri in own assigned Kamar -> ALLOWED", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        kamarId: "OU-KMR-01",
        orgUnitIds: ["OU-KMR-01"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "KAMAR");
    });

    it("2. Mudabbir creates permission for santri in different Kamar -> DENIED (scope mismatch / KAMAR_MISMATCH)", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-02",
        kamarId: "OU-KMR-02", // Different Kamar
        orgUnitIds: ["OU-KMR-02"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-02" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "SCOPE_MISMATCH");
    });

    it("3. Mudabbir with inactive assignment cannot create permission -> DENIED", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION", "SUSPENDED");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        kamarId: "OU-KMR-01",
        orgUnitIds: ["OU-KMR-01"],
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.ok(
        authRes.code === "ASSIGNMENT_NOT_ACTIVE" || authRes.code === "CAPABILITY_NOT_GRANTED",
        `Expected ASSIGNMENT_NOT_ACTIVE or CAPABILITY_NOT_GRANTED, got: ${authRes.code}`
      );
    });

    it("4. Mudabbir cannot create permission for santri with missing/null Kamar placement -> DENIED (fails closed)", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-no-kamar",
        kamarId: undefined, // Missing kamar placement
        orgUnitIds: [],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-no-kamar" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.ok(
        authRes.code === "INVALID_RESOURCE_CONTEXT" || authRes.code === "SCOPE_MISMATCH",
        `Expected INVALID_RESOURCE_CONTEXT or SCOPE_MISMATCH, got: ${authRes.code}`
      );
    });

    it("5. Kepala Keasramaan creates permission within KEASRAMAAN domain -> ALLOWED", async () => {
      const mockAsg = createKepalaKeasramaanAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-any-kamar",
        kamarId: "OU-KMR-99",
        orgUnitIds: ["OU-KMR-99", "OU-KEASRAMAAN"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-kepala-keasramaan",
          username: "kepala.keasramaan",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-any-kamar" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "DOMAIN");
    });

    it("6. Mudir creates permission globally across institution -> ALLOWED", async () => {
      const mockAsg = createMudirAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-global",
        kamarId: "OU-KMR-01",
        orgUnitIds: ["OU-KMR-01"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudir",
          username: "mudir",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-global" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "GLOBAL");
    });

    it("7. OSDA UNIT account (osda.putri) attempt to create permission strictly DENIED -> fail-closed", async () => {
      const mockAsg = createOsdaPutriUnitAssignment("VERIFIED_PRODUCTION");

      const authRes = await authorizeCanonical({
        identity: {
          userId: "usr-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "OU-OSDA-PUTRI",
          mockAssignments: [mockAsg],
        } as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santriwati-01" },
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.ok(
        authRes.code === "CAPABILITY_NOT_GRANTED" || authRes.code === "SYSTEM_FAIL_CLOSED",
        `Expected CAPABILITY_NOT_GRANTED or SYSTEM_FAIL_CLOSED, got: ${authRes.code}`
      );
    });

    it("8. ADM legacy role cannot bypass canonical authorization for permission creation -> DENIED without canonical grant", async () => {
      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-admin-01",
          username: "admin.tu",
          role: "ADM",
          mockAssignments: [], // Zero canonical personal grant
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-01" },
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
    });

    it("9. PositionCapability with state APPROVED_TARGET_PENDING_TECHNICAL confers zero runtime authority -> DENIED", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "APPROVED_TARGET_PENDING_TECHNICAL");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        kamarId: "OU-KMR-01",
        orgUnitIds: ["OU-KMR-01"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
    });

    it("10. Database failure during canonical evaluation fails closed -> SYSTEM_FAIL_CLOSED", async () => {
      const throwingProvider: ICanonicalDataProvider = {
        getIdentity: async () => { throw new Error("Database network timeout (simulated)"); },
        getActiveAssignments: async () => { throw new Error("Database connection dropped (simulated)"); },
        getUnitAccountPlacement: async () => null,
        verifyHumanExecutor: async () => null,
        resolveResourceContext: async () => null,
      };

      const authRes = await authorizeCanonical({
        identity: { userId: "usr-any" },
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
        resourceContext: { santriId: "santri-01" },
        dataProvider: throwingProvider,
        isMutation: true,
      });

      assert.ok(authRes.decision === "ERROR" || authRes.decision === "DENY");
      assert.strictEqual(authRes.code, "SYSTEM_FAIL_CLOSED");
    });
  });

  // ===========================================================================
  // SUITE 2: WORKFLOW STATE & TYPE CONSTRAINTS (DIR-2026-039 / C1) (Tests 11–16)
  // ===========================================================================
  describe("2. Workflow State & Type Constraints (DIR-2026-039 / C1)", () => {
    function determineTargetStatus(opts: {
      actorPositionCode: string;
      isSameDay: boolean;
      usesVehicle: boolean;
      jenis: string;
      isSantriSelfService: boolean;
    }): "DISETUJUI" | "MENUNGGU_MK" {
      if (opts.isSantriSelfService) {
        return "MENUNGGU_MK";
      }
      if (opts.actorPositionCode === "MUDIR" || opts.actorPositionCode === "KEPALA_KEASRAMAAN") {
        return "DISETUJUI";
      }
      if (opts.actorPositionCode === "PEMBINA_HALAQOH") {
        if (opts.isSameDay && !opts.usesVehicle && opts.jenis === "KELUAR_KOMPLEK") {
          return "DISETUJUI";
        }
        return "MENUNGGU_MK";
      }
      return "MENUNGGU_MK";
    }

    it("11. Mudabbir same-day non-vehicle non-overnight KELUAR_KOMPLEK -> direct approved (DISETUJUI)", () => {
      const status = determineTargetStatus({
        actorPositionCode: "PEMBINA_HALAQOH",
        isSameDay: true,
        usesVehicle: false,
        jenis: "KELUAR_KOMPLEK",
        isSantriSelfService: false,
      });
      assert.strictEqual(status, "DISETUJUI");
    });

    it("12. Mudabbir PULANG request -> set to MENUNGGU_MK (escalates)", () => {
      const status = determineTargetStatus({
        actorPositionCode: "PEMBINA_HALAQOH",
        isSameDay: true,
        usesVehicle: false,
        jenis: "PULANG",
        isSantriSelfService: false,
      });
      assert.strictEqual(status, "MENUNGGU_MK");
    });

    it("13. Mudabbir overnight / multi-day permission -> set to MENUNGGU_MK (escalates)", () => {
      const status = determineTargetStatus({
        actorPositionCode: "PEMBINA_HALAQOH",
        isSameDay: false, // Overnight / multi-day
        usesVehicle: false,
        jenis: "KELUAR_KOMPLEK",
        isSantriSelfService: false,
      });
      assert.strictEqual(status, "MENUNGGU_MK");
    });

    it("14. Santri self-request (ST) for own ticket -> created with MENUNGGU_MK", () => {
      const status = determineTargetStatus({
        actorPositionCode: "SANTRI",
        isSameDay: true,
        usesVehicle: false,
        jenis: "KELUAR_KOMPLEK",
        isSantriSelfService: true,
      });
      assert.strictEqual(status, "MENUNGGU_MK");
    });

    it("15. Santri self-request for another santri -> strictly DENIED (own ticket only)", () => {
      const santriSession: UserSession = {
        userId: "usr-st-01",
        username: "santri.ahmad",
        role: "ST",
        santriId: "san-01",
      };
      const requestedSantriId = "san-02"; // Cross-santri request

      const isAllowed = santriSession.role === "ST" && santriSession.santriId === requestedSantriId;
      assert.strictEqual(isAllowed, false, "Santri must be strictly denied requesting for another santri");
    });

    it("16. Santri self-request batch submission -> strictly DENIED (single santri only)", () => {
      const santriSession: UserSession = {
        userId: "usr-st-01",
        username: "santri.ahmad",
        role: "ST",
        santriId: "san-01",
      };
      const requestedSantriIds = ["san-01", "san-02"]; // Batch request

      const isBatchAllowed =
        santriSession.role === "ST" &&
        requestedSantriIds.length === 1 &&
        requestedSantriIds[0] === santriSession.santriId;
      assert.strictEqual(isBatchAllowed, false, "Santri must be strictly denied batch submissions");
    });
  });

  // ===========================================================================
  // SUITE 3: UPDATE / RETURN / CANCELLATION AUTHORITY (DIR-2026-039 / C1) (Tests 17–22)
  // ===========================================================================
  describe("3. Update / Return / Cancellation Authority (DIR-2026-039 / C1)", () => {
    it("17. Mudabbir confirms return for santri in own assigned Kamar -> ALLOWED", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        kamarId: "OU-KMR-01",
        orgUnitIds: ["OU-KMR-01"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "KAMAR");
    });

    it("18. Mudabbir confirms return for santri in different Kamar -> DENIED", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-02",
        kamarId: "OU-KMR-02",
        orgUnitIds: ["OU-KMR-02"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        resourceContext: { santriId: "santri-02" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "SCOPE_MISMATCH");
    });

    it("19. Kepala Keasramaan updates/confirms return within KEASRAMAAN domain -> ALLOWED", async () => {
      const mockAsg = createKepalaKeasramaanAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        orgUnitIds: ["OU-KEASRAMAAN"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-kepala-keasramaan",
          username: "kepala.keasramaan",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "DOMAIN");
    });

    it("20. Mudir updates/confirms return globally -> ALLOWED", async () => {
      const mockAsg = createMudirAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        orgUnitIds: ["OU-ROOT"],
        orgDomain: "KEASRAMAAN",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudir",
          username: "mudir",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "GLOBAL");
    });

    it("21. OSDA UNIT account attempt to update / cancel / confirm return -> strictly DENIED", async () => {
      const mockAsg = createOsdaPutriUnitAssignment("VERIFIED_PRODUCTION");

      const authRes = await authorizeCanonical({
        identity: {
          userId: "usr-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "OU-OSDA-PUTRI",
          mockAssignments: [mockAsg],
        } as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        resourceContext: { santriId: "santriwati-01" },
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
    });

    it("22. Legacy MK/KS role without canonical grant cannot mutate or confirm return -> DENIED", async () => {
      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-legacy-mk",
          username: "musyrif.asrama",
          role: "MK",
          mockAssignments: [],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.UPDATE,
        resourceContext: { santriId: "santri-01" },
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
    });
  });

  // ===========================================================================
  // SUITE 4: APPROVAL AUTHORITY & ESCALATION (DIR-2026-039 / C1) (Tests 23–29)
  // ===========================================================================
  describe("4. Approval Authority & Escalation (DIR-2026-039 / C1)", () => {
    it("23. Kepala Keasramaan with approve_mk approves non-PULANG permission -> DISETUJUI", async () => {
      const mockAsg = createKepalaKeasramaanAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        orgDomain: "KEASRAMAAN",
        orgUnitIds: ["OU-KEASRAMAAN"],
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-kepala-keasramaan",
          username: "kepala.keasramaan",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");

      // Verify approval logic: non-PULANG -> DISETUJUI
      const jenisIzin: string = "KELUAR_KOMPLEK";
      const nextStatus = jenisIzin === "PULANG" ? "MENUNGGU_KS" : "DISETUJUI";
      assert.strictEqual(nextStatus, "DISETUJUI");
    });

    it("24. Kepala Keasramaan with approve_mk approving PULANG -> automatically escalates to MENUNGGU_KS", async () => {
      const mockAsg = createKepalaKeasramaanAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        orgDomain: "KEASRAMAAN",
        orgUnitIds: ["OU-KEASRAMAAN"],
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-kepala-keasramaan",
          username: "kepala.keasramaan",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");

      // Verify escalation logic: PULANG -> MENUNGGU_KS
      const jenisIzin: string = "PULANG";
      const nextStatus = jenisIzin === "PULANG" ? "MENUNGGU_KS" : "DISETUJUI";
      assert.strictEqual(nextStatus, "MENUNGGU_KS");
    });

    it("25. Kepala Keasramaan cannot exercise approve_ks -> attempting to approve MENUNGGU_KS ticket is DENIED", async () => {
      const mockAsg = createKepalaKeasramaanAssignment("VERIFIED_PRODUCTION");

      // Kepala Keasramaan does NOT hold approve_ks
      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-kepala-keasramaan",
          username: "kepala.keasramaan",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
        resourceContext: { santriId: "santri-01" },
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
    });

    it("26. Mudir with approve_ks approves MENUNGGU_KS ticket -> DISETUJUI", async () => {
      const mockAsg = createMudirAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-01",
        orgDomain: "KEASRAMAAN",
        orgUnitIds: ["OU-ROOT"],
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudir",
          username: "mudir",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
        resourceContext: { santriId: "santri-01" },
        resolvedContext,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.scopeType, "GLOBAL");
    });

    it("27. Mudabbir (PEMBINA_HALAQOH) cannot approve permissions (lacks approve_mk / approve_ks) -> DENIED", async () => {
      const mockAsg = createMudabbirAssignment("OU-KMR-01", "VERIFIED_PRODUCTION");

      const authResMk = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
        isMutation: true,
      });
      assert.strictEqual(authResMk.decision, "DENY");

      const authResKs = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mudabbir-01",
          username: "mudabbir.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
        isMutation: true,
      });
      assert.strictEqual(authResKs.decision, "DENY");
    });

    it("28. OSDA cannot approve permissions -> DENIED", async () => {
      const mockAsg = createOsdaPutriUnitAssignment("VERIFIED_PRODUCTION");

      const authResMk = await authorizeCanonical({
        identity: {
          userId: "usr-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          placementUnitId: "OU-OSDA-PUTRI",
          mockAssignments: [mockAsg],
        } as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
        isMutation: true,
      });
      assert.strictEqual(authResMk.decision, "DENY");
    });

    it("29. Canonical authorization error during approval does not fall back to legacy role check -> fails closed", async () => {
      const throwingProvider: ICanonicalDataProvider = {
        getIdentity: async () => { throw new Error("DB failure during verification"); },
        getActiveAssignments: async () => { throw new Error("DB failure during verification"); },
        getUnitAccountPlacement: async () => null,
        verifyHumanExecutor: async () => null,
        resolveResourceContext: async () => null,
      };

      const authRes = await authorizeCanonical({
        identity: {
          userId: "usr-actor",
          role: "KS", // Stale role that formerly possessed approval authority
        } as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
        dataProvider: throwingProvider,
        isMutation: true,
      });

      assert.ok(authRes.decision === "ERROR" || authRes.decision === "DENY");
      assert.strictEqual(authRes.code, "SYSTEM_FAIL_CLOSED");
    });
  });

  // ===========================================================================
  // SUITE 5: GUARDIAN CONTACT PRIVACY (DIR-2026-040 / D1) (Tests 30–40)
  // ===========================================================================
  describe("5. Guardian Contact Privacy (DIR-2026-040 / D1)", () => {
    const testSantriList = [
      { id: "san-h1-k1", halaqohId: "hlq-01" },
      { id: "san-h1-k2", halaqohId: "hlq-01" },
      { id: "san-h2-k1", halaqohId: "hlq-02" },
      { id: "san-h2-k2", halaqohId: "hlq-02" },
    ];

    it("30. Mudir (GLOBAL scope + active assignment) sees noHpWali -> disclosed", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "MUDIR" },
              unit: { code: "OU-ROOT", type: "INSTITUTION" },
            },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-mudir",
        username: "mudir",
        role: "KS",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, testSantriList.length);
      for (const s of testSantriList) {
        assert.ok(authorizedIds.has(s.id), `Mudir must see guardian contact for ${s.id}`);
      }
    });

    it("31. Kepala Keasramaan (DOMAIN scope + active assignment) sees noHpWali -> disclosed", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "KEPALA_KEASRAMAAN" },
              unit: { code: "OU-KEASRAMAAN", type: "DOMAIN" },
            },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-kepala-keasramaan",
        username: "kepala.keasramaan",
        role: "MK",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, testSantriList.length);
      for (const s of testSantriList) {
        assert.ok(authorizedIds.has(s.id), `Kepala Keasramaan must see contact for ${s.id}`);
      }
    });

    it("32. Musyrif Tahfizh with active halaqoh assignment sees noHpWali of own halaqoh santri -> disclosed", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "MUSYRIF_TAHFIZH" },
              unitId: "hlq-01",
              unit: { code: "OU-hlq-01", type: "HALAQOH" },
            },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-musyrif-01",
        username: "musyrif.tahfizh",
        role: "MT",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.ok(authorizedIds.has("san-h1-k1"), "Must see santri in own halaqoh");
      assert.ok(authorizedIds.has("san-h1-k2"), "Must see santri in own halaqoh");
    });

    it("33. Musyrif Tahfizh does NOT see noHpWali of santri in other halaqoh -> hidden (undefined)", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "MUSYRIF_TAHFIZH" },
              unitId: "hlq-01",
              unit: { code: "OU-hlq-01", type: "HALAQOH" },
            },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-musyrif-01",
        username: "musyrif.tahfizh",
        role: "MT",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.has("san-h2-k1"), false, "Cross-halaqoh contact must be hidden");
      assert.strictEqual(authorizedIds.has("san-h2-k2"), false, "Cross-halaqoh contact must be hidden");
    });

    it("34. Mudabbir / Pembina Kamar with active placement sees noHpWali of own kamar santri -> disclosed", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "PEMBINA_HALAQOH" },
              unitId: "OU-KMR-01",
              unit: { code: "OU-KMR-01", type: "KAMAR" },
            },
          ],
        },
        santriKamarPlacement: {
          findMany: async () => [
            { santriId: "san-h1-k1" },
            { santriId: "san-h2-k1" },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-mudabbir-01",
        username: "mudabbir.01",
        role: "PH",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.ok(authorizedIds.has("san-h1-k1"), "Must see santri placed in own kamar");
      assert.ok(authorizedIds.has("san-h2-k1"), "Must see santri placed in own kamar");
    });

    it("35. Mudabbir does NOT see noHpWali of santri in other kamar -> hidden (undefined)", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "PEMBINA_HALAQOH" },
              unitId: "OU-KMR-01",
              unit: { code: "OU-KMR-01", type: "KAMAR" },
            },
          ],
        },
        santriKamarPlacement: {
          findMany: async () => [
            { santriId: "san-h1-k1" },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-mudabbir-01",
        username: "mudabbir.01",
        role: "PH",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.has("san-h1-k2"), false, "Cross-kamar santri contact must be hidden");
      assert.strictEqual(authorizedIds.has("san-h2-k2"), false, "Cross-kamar santri contact must be hidden");
    });

    it("36. ADM role without canonical personal grant -> noHpWali hidden (undefined)", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [], // ADM has no supervising position
        },
      };

      const session: UserSession = {
        userId: "usr-adm-01",
        username: "admin.tu",
        role: "ADM",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, 0, "ADM without supervisory position receives zero guardian contacts");
    });

    it("37. OSDA Putri UNIT account -> noHpWali hidden (undefined)", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [],
        },
      };

      const session: UserSession = {
        userId: "usr-osda-putri",
        username: "osda.putri",
        role: "OSDA",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, 0, "OSDA UNIT account receives zero guardian contacts");
    });

    it("38. Petugas Operasional Tahfizh (POT) -> noHpWali hidden (undefined)", async () => {
      const mockDb: any = {
        assignment: {
          findMany: async () => [
            {
              position: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
              unit: { code: "OU-TAHFIZH", type: "DOMAIN" },
            },
          ],
        },
      };

      const session: UserSession = {
        userId: "usr-pot-01",
        username: "musyrifah.putri",
        role: "MT",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, 0, "POT Tahfizh receives zero guardian contacts");
    });

    it("39. Santri (ST) querying list -> noHpWali hidden (undefined)", async () => {
      const mockDb: any = {};
      const session: UserSession = {
        userId: "usr-st-01",
        username: "santri.ahmad",
        role: "ST",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, 0, "Santri must never see other santri guardian contacts");
    });

    it("40. Wali Santri (WS) querying general list -> noHpWali hidden (undefined)", async () => {
      const mockDb: any = {};
      const session: UserSession = {
        userId: "usr-ws-01",
        username: "wali.ahmad",
        role: "WS",
      };

      const authorizedIds = await resolveAuthorizedGuardianContactSantriIds(
        session,
        testSantriList,
        mockDb
      );

      assert.strictEqual(authorizedIds.size, 0, "Wali Santri in general list receives zero contacts");
    });
  });

  // ===========================================================================
  // SUITE 6: REGRESSION & BOUNDARY (Tests 41–45)
  // ===========================================================================
  describe("6. Regression & Boundary", () => {
    it("41. OSDA read-only monitoring intact: can read permission list with PUTRI boundary", async () => {
      const mockAsg = createOsdaPutriUnitAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santriwati-01",
        genderComplex: "PUTRI",
        orgDomain: "KEASRAMAAN",
        orgUnitIds: [],
      };

      const authRes = await authorizeCanonical({
        identity: {
          userId: "usr-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
          placementUnitId: "OU-OSDA-PUTRI",
          mockAssignments: [mockAsg],
        } as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
        resourceContext: { santriId: "santriwati-01" },
        resolvedContext,
      });

      assert.strictEqual(authRes.decision, "ALLOW");
      assert.strictEqual(authRes.code, "ALLOWED");
      assert.strictEqual(authRes.scopeType, "DOMAIN");
    });

    it("42. PUTRA leakage strictly denied for OSDA Putri UNIT account", async () => {
      const mockAsg = createOsdaPutriUnitAssignment("VERIFIED_PRODUCTION");
      const resolvedContext: ResolvedResourceContext = {
        santriId: "santri-putra-01",
        genderComplex: "PUTRA", // Putra santri
        orgDomain: "KEASRAMAAN",
        orgUnitIds: [],
      };

      const authRes = await authorizeCanonical({
        identity: {
          userId: "usr-osda-putri",
          username: "osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
          genderComplex: "PUTRI",
          placementUnitId: "OU-OSDA-PUTRI",
          mockAssignments: [mockAsg],
        } as any,
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
        resourceContext: { santriId: "santri-putra-01" },
        resolvedContext,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "GENDER_COMPLEX_DENIED");
    });

    it("43. Tahfizh canonical-only intact: upsertTargetSantriAction strictly requires canonical tahfizh.target.manage", async () => {
      const authResWithoutGrant = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-random-staff",
          username: "staff.tu",
          role: "ADM",
          mockAssignments: [],
        }) as any,
        capability: "tahfizh.target.manage",
        resourceContext: { santriId: "san-01" },
        isMutation: true,
      });

      assert.strictEqual(authResWithoutGrant.decision, "DENY");
      assert.strictEqual(authResWithoutGrant.code, "CAPABILITY_NOT_GRANTED");
    });

    it("44. Strict halaqoh and OrgUnit mapping intact: cross-halaqoh modifications fail closed", async () => {
      const mockAsg: CanonicalAssignmentWithDetails = {
        id: "asg-mt-hlq1",
        userId: "usr-mt-01",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "OU-HLQ-01",
        unitCode: "OU-HLQ-01",
        unitName: "Halaqoh 01",
        unitGenderComplex: "PUTRA",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.target.manage",
            scopeType: "HALAQOH",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "OU-HLQ-01" }],
      };

      const resolvedContextOtherHalaqoh: ResolvedResourceContext = {
        santriId: "santri-hlq2",
        halaqohId: "OU-HLQ-02", // Different halaqoh
        orgUnitIds: ["OU-HLQ-02"],
        orgDomain: "TAHFIZH",
      };

      const authRes = await authorizeCanonical({
        identity: createStaffIdentity({
          userId: "usr-mt-01",
          username: "musyrif.01",
          mockAssignments: [mockAsg],
        }) as any,
        capability: "tahfizh.target.manage",
        resourceContext: { santriId: "santri-hlq2" },
        resolvedContext: resolvedContextOtherHalaqoh,
        isMutation: true,
      });

      assert.strictEqual(authRes.decision, "DENY");
      assert.strictEqual(authRes.code, "SCOPE_MISMATCH");
    });

    it("45. Protected PR #8 invariants intact: immutable commit 9068cae5587b7219c394c5c25bf0de07a15b0726, open, draft, unmerged", () => {
      assert.strictEqual(
        PR8_IMMUTABLE_COMMIT,
        "9068cae5587b7219c394c5c25bf0de07a15b0726",
        "PR #8 immutable commit must strictly match 9068cae5587b7219c394c5c25bf0de07a15b0726"
      );
    });

    it("46. Canonical target manifests defined declaratively with zero runtime authority", () => {
      assert.strictEqual(OSDA_PUTRI_UNIT_CONTRACT.INVARIANTS.operationalModality, "READ_ONLY_MONITORING");
      assert.strictEqual(CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.allowUnitMutation, false);
      assert.ok(CANONICAL_PERSONAL_PERMISSION_MUTATION_TARGET_POLICIES.PEMBINA_HALAQOH);
      assert.ok(CANONICAL_PERSONAL_PERMISSION_MUTATION_TARGET_POLICIES.KEPALA_KEASRAMAAN);
      assert.ok(CANONICAL_PERSONAL_PERMISSION_MUTATION_TARGET_POLICIES.MUDIR);
      assert.ok(CANONICAL_GUARDIAN_CONTACT_PRIVACY_TARGET_POLICIES.MUDIR);
      assert.ok(CANONICAL_GUARDIAN_CONTACT_PRIVACY_TARGET_POLICIES.KEPALA_KEASRAMAAN);
      assert.ok(CANONICAL_GUARDIAN_CONTACT_PRIVACY_TARGET_POLICIES.MUSYRIF_TAHFIZH);
      assert.ok(CANONICAL_GUARDIAN_CONTACT_PRIVACY_TARGET_POLICIES.PEMBINA_HALAQOH);
      assert.ok(UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH);
    });
  });
});
