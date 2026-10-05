import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSchemaGuards } from "../scripts/predeploy-v3-1-schema";
import {
  parseProvisioningGuards,
} from "../scripts/provision-tahfizh-policy-manage";
import {
  TAHFIZH_POLICY_MANAGE_MANIFEST,
  TAHFIZH_POLICY_MANAGE_TARGET_POLICY,
} from "../types/architecture-lock";
import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
  CanonicalIdentity,
} from "../lib/auth/canonical-evaluator";

describe("BATCH V3.1A — SCRIPT GUARDS & PROVISIONING TESTS", () => {
  describe("1. Predeploy Schema Script Guards (ORR-075)", () => {
    it("fails when all execution flags and env vars are absent (default read-only)", () => {
      const guards = parseSchemaGuards(["node", "script.ts"], {});
      assert.strictEqual(guards.isExecuteApproved, false);
      assert.strictEqual(guards.hasExecuteFlag, false);
      assert.strictEqual(guards.hasApprovedScopeFlag, false);
      assert.strictEqual(guards.hasEnvApproval, false);
      assert.strictEqual(guards.guardReasons.length, 3);
    });

    it("fails when --execute is passed without approved scope or env var", () => {
      const guards = parseSchemaGuards(["node", "script.ts", "--execute"], {});
      assert.strictEqual(guards.isExecuteApproved, false);
      assert.strictEqual(guards.hasExecuteFlag, true);
      assert.strictEqual(guards.hasApprovedScopeFlag, false);
      assert.strictEqual(guards.hasEnvApproval, false);
    });

    it("fails when scope and env var match but --execute flag is absent", () => {
      const guards = parseSchemaGuards(
        ["node", "script.ts", "--approved-scope=V3.1-ORR075"],
        { PRODUCTION_MUTATION_APPROVED: "V3.1-ORR075" }
      );
      assert.strictEqual(guards.isExecuteApproved, false);
      assert.strictEqual(guards.hasExecuteFlag, false);
    });

    it("approves execution only when all 3 guards are present and match V3.1-ORR075", () => {
      const guards = parseSchemaGuards(
        ["node", "script.ts", "--execute", "--approved-scope=V3.1-ORR075"],
        { PRODUCTION_MUTATION_APPROVED: "V3.1-ORR075" }
      );
      assert.strictEqual(guards.isExecuteApproved, true);
      assert.strictEqual(guards.hasExecuteFlag, true);
      assert.strictEqual(guards.hasApprovedScopeFlag, true);
      assert.strictEqual(guards.hasEnvApproval, true);
      assert.strictEqual(guards.guardReasons.length, 0);
    });
  });

  describe("2. Canonical Provisioning Script Guards (ORR-079)", () => {
    it("fails when all execution flags and env vars are absent (default read-only)", () => {
      const guards = parseProvisioningGuards(["node", "script.ts"], {});
      assert.strictEqual(guards.isExecuteApproved, false);
      assert.strictEqual(guards.hasExecuteFlag, false);
      assert.strictEqual(guards.hasApprovedScopeFlag, false);
      assert.strictEqual(guards.hasEnvApproval, false);
      assert.strictEqual(guards.guardReasons.length, 3);
    });

    it("fails when scope is mismatched", () => {
      const guards = parseProvisioningGuards(
        ["node", "script.ts", "--execute", "--approved-scope=WRONG_SCOPE"],
        { PRODUCTION_MUTATION_APPROVED: "V3.1-ORR079" }
      );
      assert.strictEqual(guards.isExecuteApproved, false);
      assert.strictEqual(guards.hasApprovedScopeFlag, false);
    });

    it("approves execution only when all 3 guards are present and match V3.1-ORR079", () => {
      const guards = parseProvisioningGuards(
        ["node", "script.ts", "--execute", "--approved-scope=V3.1-ORR079"],
        { PRODUCTION_MUTATION_APPROVED: "V3.1-ORR079" }
      );
      assert.strictEqual(guards.isExecuteApproved, true);
      assert.strictEqual(guards.hasExecuteFlag, true);
      assert.strictEqual(guards.hasApprovedScopeFlag, true);
      assert.strictEqual(guards.hasEnvApproval, true);
      assert.strictEqual(guards.guardReasons.length, 0);
    });
  });

  describe("3. Canonical Metadata Manifest Verification (ORR-079)", () => {
    it("matches exact catalog contract and naming conventions", () => {
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_MANIFEST.code, "tahfizh.policy.manage");
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_MANIFEST.namespace, "TAHFIZH");
      assert.strictEqual(
        TAHFIZH_POLICY_MANAGE_MANIFEST.description,
        "Mengubah ambang nilai, bintang, dan kebijakan reward Tahfizh."
      );
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_MANIFEST.isDangerous, false);
      assert.strictEqual(
        TAHFIZH_POLICY_MANAGE_MANIFEST.name,
        "Mengelola Kebijakan Reward Tahfizh"
      );
    });

    it("target policy defines MUDIR GLOBAL grant in INSTITUTIONAL domain", () => {
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_TARGET_POLICY.positionCode, "MUDIR");
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_TARGET_POLICY.capabilityCode, "tahfizh.policy.manage");
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_TARGET_POLICY.scopeType, "GLOBAL");
      assert.strictEqual(TAHFIZH_POLICY_MANAGE_TARGET_POLICY.domain, "INSTITUTIONAL");
    });
  });

  describe("4. Post-Provision Authorization Matrix Verification (ORR-079)", () => {
    const mockMudirAssignment: CanonicalAssignmentWithDetails = {
      id: "asg-mudir",
      userId: "usr-mudir",
      positionId: "pos-mudir",
      positionCode: "MUDIR",
      positionName: "Mudir",
      domain: "INSTITUTIONAL",
      unitId: "unit-root",
      unitCode: "OU-STQ-ROOT",
      unitName: "STQ Darul Ulum Cendekia",
      unitGenderComplex: "TIDAK_TERIKAT",
      status: "ACTIVE",
      validFrom: new Date("2026-01-01"),
      validUntil: null,
      requiresPersonalAccount: true,
      positionCapabilities: [
        {
          capabilityCode: "tahfizh.policy.manage",
          scopeType: "GLOBAL",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      ],
      scopeUnits: [],
    };

    const mockKabidAssignment: CanonicalAssignmentWithDetails = {
      id: "asg-kabid",
      userId: "usr-kabid",
      positionId: "pos-kabid",
      positionCode: "KABID_TAHFIZH",
      positionName: "Kepala Bidang Tahfizh",
      domain: "TAHFIZH",
      unitId: "unit-tahfizh",
      unitCode: "OU-TAHFIZH",
      unitName: "Bidang Tahfizh",
      unitGenderComplex: "TIDAK_TERIKAT",
      status: "ACTIVE",
      validFrom: new Date("2026-01-01"),
      validUntil: null,
      requiresPersonalAccount: true,
      positionCapabilities: [], // KABID does NOT hold tahfizh.policy.manage
      scopeUnits: [],
    };

    it("evaluates MUDIR to ALLOW for tahfizh.policy.manage", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mudir",
          username: "mudir",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mudir",
          mockAssignments: [mockMudirAssignment],
        } as unknown as CanonicalIdentity,
        capability: "tahfizh.policy.manage",
      });

      assert.strictEqual(res.decision, "ALLOW");
    });

    it("evaluates KABID_TAHFIZH to DENY for tahfizh.policy.manage", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-kabid",
          username: "kabid",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kabid",
          mockAssignments: [mockKabidAssignment],
        } as unknown as CanonicalIdentity,
        capability: "tahfizh.policy.manage",
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.reasonCode, "CAPABILITY_NOT_GRANTED");
    });
  });
});
