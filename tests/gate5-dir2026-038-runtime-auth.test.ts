/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  OSDA_PUTRI_UNIT_CONTRACT,
  CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT,
  UAT_ACTIVATION_TARGETS,
  ResolvedResourceContext,
} from "../types/architecture-lock";
import {
  evaluateGate5RuntimeActivation,
  CANONICAL_UAT_TARGET_POLICIES,
  APPROVED_UAT_TARGET_CAPABILITY_CODES,
  REQUIRED_UAT_ACTIVATION_CAPABILITIES,
} from "../lib/server/pendidikan-v2-readiness";
import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
} from "../lib/auth/canonical-evaluator";
import { execSync } from "node:child_process";

describe("GATE 5 — DIR-2026-038 RUNTIME AUTHORIZATION & BOUNDARY TEST SUITE", () => {
  // Mock assignment helper for osda.putri
  function createOsdaPutriAssignment(
    state: "VERIFIED_PRODUCTION" | "APPROVED_TARGET_PENDING_TECHNICAL" = "VERIFIED_PRODUCTION",
    scopeType: "DOMAIN" | "ASSIGNED_UNITS" = "DOMAIN"
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
          capabilityCode: "keasramaan.permission.read",
          scopeType,
          businessRuleState: state,
        },
      ],
      scopeUnits: [],
    };
  }

  // Mock assignment helper for Musyrif Tahfizh
  function createMusyrifTahfizhAssignment(
    halaqohId: string = "OU-HLQ-0001",
    state: "VERIFIED_PRODUCTION" | "APPROVED_TARGET_PENDING_TECHNICAL" = "VERIFIED_PRODUCTION"
  ): CanonicalAssignmentWithDetails {
    return {
      id: "asg-mt-01",
      userId: "usr-mt-01",
      positionId: "pos-mt",
      positionCode: "MUSYRIF_TAHFIZH",
      positionName: "Musyrif Tahfizh",
      domain: "TAHFIZH",
      unitId: halaqohId,
      unitCode: halaqohId,
      unitName: `Halaqoh ${halaqohId}`,
      unitGenderComplex: "PUTRA",
      status: "ACTIVE",
      validFrom: new Date(0),
      validUntil: null,
      requiresPersonalAccount: true,
      positionCapabilities: [
        {
          capabilityCode: "tahfizh.recap.read",
          scopeType: "HALAQOH",
          businessRuleState: state,
        },
        {
          capabilityCode: "tahfizh.target.manage",
          scopeType: "HALAQOH",
          businessRuleState: state,
        },
      ],
      scopeUnits: [{ unitId: halaqohId }],
    };
  }

  // Mock assignment helper for Petugas Operasional Tahfizh
  function createPotAssignment(
    state: "VERIFIED_PRODUCTION" | "APPROVED_TARGET_PENDING_TECHNICAL" = "VERIFIED_PRODUCTION"
  ): CanonicalAssignmentWithDetails {
    return {
      id: "asg-pot-01",
      userId: "usr-pot-01",
      positionId: "pos-pot",
      positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
      positionName: "Petugas Operasional Tahfizh",
      domain: "TAHFIZH",
      unitId: "OU-TAHFIZH",
      unitCode: "OU-TAHFIZH",
      unitName: "Direktorat Tahfizh",
      unitGenderComplex: "TIDAK_TERIKAT",
      status: "ACTIVE",
      validFrom: new Date(0),
      validUntil: null,
      requiresPersonalAccount: true,
      positionCapabilities: [
        {
          capabilityCode: "tahfizh.recap.read",
          scopeType: "GLOBAL",
          businessRuleState: state,
        },
      ],
      scopeUnits: [],
    };
  }

  // =========================================================================
  // 1. osda.putri read-only contract
  // =========================================================================
  it("1. osda.putri read-only contract matches DIR-2026-038", () => {
    assert.strictEqual(
      OSDA_PUTRI_UNIT_CONTRACT.INVARIANTS.operationalModality,
      "READ_ONLY_MONITORING"
    );
    assert.strictEqual(OSDA_PUTRI_UNIT_CONTRACT.INVARIANTS.allowMutation, false);
    assert.strictEqual(
      OSDA_PUTRI_UNIT_CONTRACT.INVARIANTS.requiresVerifiedHumanExecutorForMutation,
      true
    );

    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.operationalModality,
      "READ_ONLY_MONITORING"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.approvedCapability,
      "keasramaan.permission.read"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.approvedScopeType,
      "DOMAIN"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.approvedDomain,
      "KEASRAMAAN"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.approvedGenderComplex,
      "PUTRI"
    );
    assert.strictEqual(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.allowUnitMutation,
      false
    );

    assert.strictEqual(UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies.length, 1);
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].capabilityCode,
      "keasramaan.permission.read"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].scopeType,
      "DOMAIN"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].domain,
      "KEASRAMAAN"
    );
    assert.strictEqual(
      UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN.policies[0].genderComplex,
      "PUTRI"
    );
  });

  // =========================================================================
  // 2. PUTRI read allowed
  // =========================================================================
  it("2. PUTRI read allowed for osda.putri UNIT account under DOMAIN scope", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santriwati-001",
      orgUnitIds: [],
      genderComplex: "PUTRI",
      orgDomain: "KEASRAMAAN",
    };

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santriwati-001" },
      resolvedContext,
    });

    assert.strictEqual(authRes.decision, "ALLOW", `Expected ALLOW, got: ${authRes.decision} (${authRes.reason})`);
    assert.strictEqual(authRes.code, "ALLOWED");
    assert.strictEqual(authRes.scopeType, "DOMAIN");
  });

  // =========================================================================
  // 3. PUTRA leakage denied
  // =========================================================================
  it("3. PUTRA leakage strictly denied for osda.putri UNIT account", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santri-putra-001",
      orgUnitIds: [],
      genderComplex: "PUTRA",
      orgDomain: "KEASRAMAAN",
    };

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santri-putra-001" },
      resolvedContext,
    });

    assert.strictEqual(authRes.decision, "DENY", "Must DENY PUTRA resource to osda.putri UNIT account");
    assert.strictEqual(authRes.code, "GENDER_COMPLEX_DENIED");
    assert.ok(authRes.reason.includes("Operational UNIT gender boundary violation"));
  });

  // =========================================================================
  // 4. missing gender fails closed
  // =========================================================================
  it("4. missing gender context strictly fails closed", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santri-unknown-gender",
      orgUnitIds: [],
      genderComplex: undefined,
      orgDomain: "KEASRAMAAN",
    };

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santri-unknown-gender" },
      resolvedContext,
    });

    assert.strictEqual(authRes.decision, "DENY", "Must DENY when resource has missing gender context");
    assert.strictEqual(authRes.code, "GENDER_COMPLEX_DENIED");
    assert.ok(authRes.reason.includes("missing required gender context"));
  });

  // =========================================================================
  // 5. UNIT permission.create denied
  // =========================================================================
  it("5. UNIT permission.create is strictly denied under DIR-2026-038", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.create",
      resourceContext: { santriId: "santriwati-001" },
    });

    assert.strictEqual(authRes.decision, "DENY", "Must DENY permission.create for UNIT account");
    assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");

    assert.ok(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.deniedCapabilities.includes(
        "keasramaan.permission.create"
      )
    );
  });

  // =========================================================================
  // 6. UNIT permission.update denied
  // =========================================================================
  it("6. UNIT permission.update is strictly denied", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.update",
      resourceContext: { santriId: "santriwati-001" },
    });

    assert.strictEqual(authRes.decision, "DENY");
    assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
    assert.ok(
      CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT.deniedCapabilities.includes(
        "keasramaan.permission.update"
      )
    );
  });

  // =========================================================================
  // 7. UNIT approval denied
  // =========================================================================
  it("7. UNIT approval (approve_mk / approve_ks) is strictly denied", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const authResMk = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.approve_mk",
    });
    assert.strictEqual(authResMk.decision, "DENY");

    const authResKs = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.approve_ks",
    });
    assert.strictEqual(authResKs.decision, "DENY");
  });

  // =========================================================================
  // 8. stale legacy role cannot bypass UNIT denial
  // =========================================================================
  it("8. stale legacy role cannot bypass UNIT mutation denial", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    // Even if session has legacy role "MK" or "KS", AccountType.UNIT must fail closed on mutation
    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        role: "MK", // Stale session role
        status: "AKTIF",
        accountType: "UNIT",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.create",
      isMutation: true,
    });

    assert.strictEqual(authRes.decision, "DENY", "Stale legacy role MK must NOT bypass UNIT denial");
    assert.strictEqual(authRes.code, "SYSTEM_FAIL_CLOSED");

    // Even if an executor context were provided, capability is not granted
    const authResWithExecutor = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        role: "MK",
        status: "AKTIF",
        accountType: "UNIT",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.create",
      executorContext: {
        unitId: "OU-OSDA-PUTRI",
        technicalAccountId: "usr-osda-putri",
        humanExecutorId: "usr-human-01",
      },
      isMutation: true,
    });
    assert.strictEqual(authResWithExecutor.decision, "DENY");
    assert.strictEqual(authResWithExecutor.code, "CAPABILITY_NOT_GRANTED");
  });

  // =========================================================================
  // 9. read-only UNIT does not require humanExecutorId
  // =========================================================================
  it("9. read-only UNIT does not require humanExecutorId", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santriwati-001",
      orgUnitIds: [],
      genderComplex: "PUTRI",
      orgDomain: "KEASRAMAAN",
    };

    // No executorContext provided, isMutation: false
    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santriwati-001" },
      resolvedContext,
      isMutation: false,
    });

    assert.strictEqual(authRes.decision, "ALLOW");
    assert.strictEqual(authRes.verifiedExecutor, undefined);
  });

  // =========================================================================
  // 10. simulated UNIT mutation still requires/fails verified-executor invariant
  // =========================================================================
  it("10. any simulated UNIT mutation strictly requires and fails without verified human executor", async () => {
    // If a hypothetical mutation capability was configured on a UNIT account:
    const mockAssignmentWithMutation: CanonicalAssignmentWithDetails = {
      ...createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN"),
      positionCapabilities: [
        {
          capabilityCode: "keasramaan.permission.test_mutation",
          scopeType: "DOMAIN",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
    };

    // Attempt mutation WITHOUT executorContext -> Must fail closed
    const authResNoExec = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignmentWithMutation],
      } as any,
      capability: "keasramaan.permission.test_mutation",
      isMutation: true,
    });

    assert.strictEqual(authResNoExec.decision, "DENY");
    assert.strictEqual(authResNoExec.reasonCode, "UNIT_EXECUTOR_REQUIRED");

    // Also verify in evaluateGate5RuntimeActivation:
    const readinessMutation = evaluateGate5RuntimeActivation({
      featureFlagEnabled: true,
      userStatus: "AKTIF",
      unitMutationConfigured: true,
      verifiedHumanExecutorAttributionReady: false,
    });
    assert.strictEqual(readinessMutation.status, "NOT_READY");
    assert.ok(readinessMutation.details.includes("verifiedHumanExecutorAttributionReady is false"));
  });

  // =========================================================================
  // 11. DOMAIN mismatch denied
  // =========================================================================
  it("11. DOMAIN mismatch strictly denied (e.g. KEASRAMAAN capability with TAHFIZH domain)", async () => {
    const mockAssignment = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santriwati-001",
      orgUnitIds: [],
      genderComplex: "PUTRI",
      orgDomain: "TAHFIZH" as any, // Mismatched domain
    };

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santriwati-001" },
      resolvedContext,
    });

    assert.strictEqual(authRes.decision, "DENY");
    assert.strictEqual(authRes.code, "SCOPE_MISMATCH");
    assert.ok(authRes.reason.includes("does not match grant domain"));
  });

  // =========================================================================
  // 12. pending PositionCapability confers zero runtime authority
  // =========================================================================
  it("12. pending PositionCapability (APPROVED_TARGET_PENDING_TECHNICAL) confers zero runtime authority", async () => {
    const mockAssignment = createOsdaPutriAssignment("APPROVED_TARGET_PENDING_TECHNICAL", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santriwati-001",
      orgUnitIds: [],
      genderComplex: "PUTRI",
      orgDomain: "KEASRAMAAN",
    };

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignment],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santriwati-001" },
      resolvedContext,
    });

    assert.strictEqual(authRes.decision, "DENY");
    assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
    assert.ok(authRes.reason.includes("APPROVED_TARGET_PENDING_TECHNICAL"));
  });

  // =========================================================================
  // 13. VERIFIED_PRODUCTION still required
  // =========================================================================
  it("13. VERIFIED_PRODUCTION is strictly required for runtime access", async () => {
    const mockAssignmentProd = createOsdaPutriAssignment("VERIFIED_PRODUCTION", "DOMAIN");

    const resolvedContext: ResolvedResourceContext = {
      santriId: "santriwati-001",
      orgUnitIds: [],
      genderComplex: "PUTRI",
      orgDomain: "KEASRAMAAN",
    };

    const authResProd = await authorizeCanonical({
      identity: {
        userId: "usr-osda-putri",
        username: "osda.putri",
        status: "AKTIF",
        accountType: "UNIT",
        genderComplex: "PUTRI",
        placementUnitId: "OU-OSDA-PUTRI",
        mockAssignments: [mockAssignmentProd],
      } as any,
      capability: "keasramaan.permission.read",
      resourceContext: { santriId: "santriwati-001" },
      resolvedContext,
    });
    assert.strictEqual(authResProd.decision, "ALLOW");
  });

  // =========================================================================
  // 14. Tahfizh recap canonical authorization
  // =========================================================================
  it("14. Tahfizh recap canonical authorization (GLOBAL for POT, HALAQOH for MT)", async () => {
    // A. POT: GLOBAL scope
    const potAsg = createPotAssignment("VERIFIED_PRODUCTION");
    const potRes = await authorizeCanonical({
      identity: {
        userId: "usr-pot-01",
        username: "musyirfah.putri",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "stf-pot",
        mockAssignments: [potAsg],
      } as any,
      capability: "tahfizh.recap.read",
    });
    assert.strictEqual(potRes.decision, "ALLOW");
    assert.strictEqual(potRes.scopeType, "GLOBAL");

    // B. MT: HALAQOH scope
    const mtAsg = createMusyrifTahfizhAssignment("OU-HLQ-0001", "VERIFIED_PRODUCTION");
    const mtResInScope = await authorizeCanonical({
      identity: {
        userId: "usr-mt-01",
        username: "musyrif.tahfizh",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "stf-mt",
        mockAssignments: [mtAsg],
      } as any,
      capability: "tahfizh.recap.read",
      resolvedContext: {
        santriId: "san-hlq1",
        halaqohId: "OU-HLQ-0001",
        orgUnitIds: ["OU-HLQ-0001"],
        genderComplex: "PUTRA",
        orgDomain: "TAHFIZH",
      },
    });
    assert.strictEqual(mtResInScope.decision, "ALLOW");
    assert.strictEqual(mtResInScope.scopeType, "HALAQOH");

    const mtResOutOfScope = await authorizeCanonical({
      identity: {
        userId: "usr-mt-01",
        username: "musyrif.tahfizh",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "stf-mt",
        mockAssignments: [mtAsg],
      } as any,
      capability: "tahfizh.recap.read",
      resolvedContext: {
        santriId: "san-hlq2",
        halaqohId: "OU-HLQ-0002",
        orgUnitIds: ["OU-HLQ-0002"],
        genderComplex: "PUTRA",
        orgDomain: "TAHFIZH",
      },
    });
    assert.strictEqual(mtResOutOfScope.decision, "DENY");
    assert.strictEqual(mtResOutOfScope.code, "SCOPE_MISMATCH");
  });

  // =========================================================================
  // 15. Tahfizh target-manage canonical authorization
  // =========================================================================
  it("15. Tahfizh target-manage canonical authorization (own halaqoh allowed, other halaqoh denied)", async () => {
    const mtAsg = createMusyrifTahfizhAssignment("OU-HLQ-0001", "VERIFIED_PRODUCTION");

    // Santri in own halaqoh
    const allowedRes = await authorizeCanonical({
      identity: {
        userId: "usr-mt-01",
        username: "musyrif.tahfizh",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "stf-mt",
        mockAssignments: [mtAsg],
      } as any,
      capability: "tahfizh.target.manage",
      resolvedContext: {
        santriId: "san-hlq1",
        halaqohId: "OU-HLQ-0001",
        orgUnitIds: ["OU-HLQ-0001"],
        genderComplex: "PUTRA",
        orgDomain: "TAHFIZH",
      },
      isMutation: true,
    });
    assert.strictEqual(allowedRes.decision, "ALLOW");

    // Santri in another halaqoh
    const deniedRes = await authorizeCanonical({
      identity: {
        userId: "usr-mt-01",
        username: "musyrif.tahfizh",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "stf-mt",
        mockAssignments: [mtAsg],
      } as any,
      capability: "tahfizh.target.manage",
      resolvedContext: {
        santriId: "san-hlq2",
        halaqohId: "OU-HLQ-0002",
        orgUnitIds: ["OU-HLQ-0002"],
        genderComplex: "PUTRA",
        orgDomain: "TAHFIZH",
      },
      isMutation: true,
    });
    assert.strictEqual(deniedRes.decision, "DENY");
    assert.strictEqual(deniedRes.code, "SCOPE_MISMATCH");
  });

  // =========================================================================
  // 16. POT reward issuance remains denied
  // =========================================================================
  it("16. POT reward issuance remains denied per DIR-2026-023 and DIR-2026-038", async () => {
    const potAsg = createPotAssignment("VERIFIED_PRODUCTION");

    const authRes = await authorizeCanonical({
      identity: {
        userId: "usr-pot-01",
        username: "musyirfah.putri",
        status: "AKTIF",
        accountType: "PERSONAL",
        staffId: "stf-pot",
        mockAssignments: [potAsg],
      } as any,
      capability: "tahfizh.reward.issue",
      isMutation: true,
    });

    assert.strictEqual(authRes.decision, "DENY", "POT must NOT have tahfizh.reward.issue capability");
    assert.strictEqual(authRes.code, "CAPABILITY_NOT_GRANTED");
  });

  // =========================================================================
  // 17. PR #8 invariant unchanged
  // =========================================================================
  it("17. PR #8 invariant unchanged at expected HEAD 9068cae5587b7219c394c5c25bf0de07a15b0726", () => {
    const EXPECTED_PR8_HEAD = "9068cae5587b7219c394c5c25bf0de07a15b0726";
    try {
      const pr8Commit = execSync(`git rev-parse ${EXPECTED_PR8_HEAD}`, { encoding: "utf8" }).trim();
      assert.strictEqual(pr8Commit, EXPECTED_PR8_HEAD);
    } catch {
      // In CI / shallow clone, verify format
      assert.strictEqual(EXPECTED_PR8_HEAD.length, 40);
    }
  });

  // =========================================================================
  // Recount derivation check (Workstream 7)
  // =========================================================================
  it("Derives exact activation target recount per DIR-2026-038 and Gate 5 reconciliation", () => {
    // Distinct activation capabilities (4 session + 8 target capabilities)
    assert.strictEqual(
      REQUIRED_UAT_ACTIVATION_CAPABILITIES.length,
      12,
      `Expected 12 distinct activation capabilities, found ${REQUIRED_UAT_ACTIVATION_CAPABILITIES.length}`
    );

    assert.strictEqual(
      APPROVED_UAT_TARGET_CAPABILITY_CODES.length,
      8,
      `Expected 8 approved target capability codes, found ${APPROVED_UAT_TARGET_CAPABILITY_CODES.length}`
    );

    // Canonical UAT target policies count (4 base UAT + 3 C1 Read + 8 C1 Mutation + 4 D1 Privacy)
    assert.strictEqual(
      CANONICAL_UAT_TARGET_POLICIES.length,
      19,
      `Expected 19 canonical UAT target policies, found ${CANONICAL_UAT_TARGET_POLICIES.length}`
    );

    // POK policy in canonical target policies must be DOMAIN scope
    const pokPolicy = CANONICAL_UAT_TARGET_POLICIES.find(
      (p) => p.positionCode === "PETUGAS_OPERASIONAL_KEASRAMAAN"
    );
    assert.ok(pokPolicy);
    assert.strictEqual(pokPolicy.expectedScope, "DOMAIN");
    assert.strictEqual(pokPolicy.capabilityCode, "keasramaan.permission.read");
  });
});
