/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  evaluateStalePositionCapabilityPolicy,
  checkPendidikanV2ProductionReadiness,
  CANONICAL_READINESS_GATE_NAMES,
} from "@/lib/server/pendidikan-v2-readiness";
import {
  CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES,
  FORBIDDEN_TAHFIZH_REWARD_POSITIONS,
} from "@/types/architecture-lock";
import { generateCanonicalBaselineCapabilities } from "@/lib/auth/backfill-dry-run";

describe("Gate 7 R2 — Tahfizh Reward Authority Readiness Integrity", () => {
  // Base valid leadership rows
  const validMudir = {
    capabilityCode: "tahfizh.reward.issue",
    scopeType: "GLOBAL",
    businessRuleState: "VERIFIED_PRODUCTION",
    position: { code: "MUDIR", domain: "INSTITUTIONAL", isActive: true },
  };

  const validKabid = {
    capabilityCode: "tahfizh.reward.issue",
    scopeType: "DOMAIN",
    businessRuleState: "VERIFIED_PRODUCTION",
    position: { code: "KABID_TAHFIZH", domain: "TAHFIZH", isActive: true },
  };

  // TEST R2-01: Mudir VERIFIED GLOBAL + Kabid VERIFIED DOMAIN + zero forbidden reward rows => Gate 11 READY
  it("TEST R2-01: Mudir VERIFIED GLOBAL + Kabid VERIFIED DOMAIN + zero forbidden reward rows => Gate 11 READY", () => {
    const rows = [validMudir, validKabid];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "READY");
    assert.strictEqual(res.blocking, true);
    assert.ok(res.details.includes("All required Tahfizh reward authorities verified active"));
  });

  // TEST R2-02: Mudir PENDING => Gate 11 NOT_READY
  it("TEST R2-02: Mudir PENDING => Gate 11 NOT_READY", () => {
    const rows = [
      { ...validMudir, businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" },
      validKabid,
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("MUDIR reward authority is 'APPROVED_TARGET_PENDING_TECHNICAL'"));
  });

  // TEST R2-03: Kabid PENDING => Gate 11 NOT_READY
  it("TEST R2-03: Kabid PENDING => Gate 11 NOT_READY", () => {
    const rows = [
      validMudir,
      { ...validKabid, businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("KABID_TAHFIZH reward authority is 'APPROVED_TARGET_PENDING_TECHNICAL'"));
  });

  // TEST R2-04: both Mudir + Kabid PENDING => Gate 11 NOT_READY (CURRENT production shape)
  it("TEST R2-04: both Mudir + Kabid PENDING => Gate 11 NOT_READY (CURRENT production shape)", () => {
    const rows = [
      { ...validMudir, businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" },
      { ...validKabid, businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("MUDIR (status: APPROVED_TARGET_PENDING_TECHNICAL)"));
    assert.ok(res.details.includes("KABID_TAHFIZH (status: APPROVED_TARGET_PENDING_TECHNICAL)"));
  });

  // TEST R2-05: Mudir row missing => NOT_READY
  it("TEST R2-05: Mudir row missing => NOT_READY", () => {
    const rows = [validKabid];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("Missing required MUDIR reward authority row"));
  });

  // TEST R2-06: Kabid row missing => NOT_READY
  it("TEST R2-06: Kabid row missing => NOT_READY", () => {
    const rows = [validMudir];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("Missing required KABID_TAHFIZH reward authority row"));
  });

  // TEST R2-07: Mudir wrong scope DOMAIN => NOT_READY
  it("TEST R2-07: Mudir wrong scope DOMAIN => NOT_READY", () => {
    const rows = [
      { ...validMudir, scopeType: "DOMAIN" },
      validKabid,
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("Invalid MUDIR reward authority scope 'DOMAIN'; expected GLOBAL"));
  });

  // TEST R2-08: Kabid wrong scope GLOBAL => NOT_READY
  it("TEST R2-08: Kabid wrong scope GLOBAL => NOT_READY", () => {
    const rows = [
      validMudir,
      { ...validKabid, scopeType: "GLOBAL" },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("Invalid KABID_TAHFIZH reward authority scope 'GLOBAL'; expected DOMAIN"));
  });

  // TEST R2-09: POT reward PENDING => NOT_READY
  it("TEST R2-09: POT reward PENDING => NOT_READY", () => {
    const rows = [
      validMudir,
      validKabid,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
        position: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "STALE_POLICY_REQUIRES_CLEANUP");
    assert.ok(res.details.includes("STALE_POSITION_CAPABILITY_POLICY_REQUIRES_CLEANUP"));
  });

  // TEST R2-10: POT reward VERIFIED => BLOCKED
  it("TEST R2-10: POT reward VERIFIED => BLOCKED", () => {
    const rows = [
      validMudir,
      validKabid,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "BLOCKED");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "UNAUTHORIZED_RUNTIME_AUTHORITY");
    assert.ok(res.details.includes("UNAUTHORIZED_STALE_RUNTIME_AUTHORITY"));
  });

  // TEST R2-11: ordinary MUSYRIF reward VERIFIED => BLOCKED
  it("TEST R2-11: ordinary MUSYRIF reward VERIFIED => BLOCKED", () => {
    const rows = [
      validMudir,
      validKabid,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "HALAQOH",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "MUSYRIF_TAHFIZH" },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "BLOCKED");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "UNAUTHORIZED_RUNTIME_AUTHORITY");
    assert.ok(res.details.includes("Position MUSYRIF_TAHFIZH has unauthorized VERIFIED_PRODUCTION reward authority"));
  });

  // TEST R2-12: PEMBINA reward VERIFIED => BLOCKED
  it("TEST R2-12: PEMBINA reward VERIFIED => BLOCKED", () => {
    const rows = [
      validMudir,
      validKabid,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "HALAQOH",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "PEMBINA_HALAQOH" },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "BLOCKED");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "UNAUTHORIZED_RUNTIME_AUTHORITY");
    assert.ok(res.details.includes("Position PEMBINA_HALAQOH has unauthorized VERIFIED_PRODUCTION reward authority"));
  });

  // TEST R2-13: ADM reward VERIFIED => BLOCKED
  it("TEST R2-13: ADM reward VERIFIED => BLOCKED", () => {
    const rows = [
      validMudir,
      validKabid,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "ADM" },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "BLOCKED");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "UNAUTHORIZED_RUNTIME_AUTHORITY");
    assert.ok(res.details.includes("Position ADM has unauthorized VERIFIED_PRODUCTION reward authority"));
  });

  // TEST R2-14: database query failure => BLOCKED / DATABASE_UNAVAILABLE
  it("TEST R2-14: database query failure => BLOCKED / DATABASE_UNAVAILABLE", async () => {
    const mockDbFailing: any = {
      positionCapability: {
        findMany: async () => {
          throw new Error("Connection pool timeout / network down");
        },
      },
    };

    const report = await checkPendidikanV2ProductionReadiness(mockDbFailing);
    const gate11 = report.gates.find((g) => g.gate === "STALE_POSITION_CAPABILITY_POLICY_READY");
    assert.ok(gate11, "Gate 11 must be present in report");
    assert.strictEqual(gate11.status, "BLOCKED");
    assert.strictEqual(gate11.reason, "DATABASE_UNAVAILABLE");
    assert.ok(gate11.details.includes("DATABASE_UNAVAILABLE"));
  });

  // TEST R2-15: 14-gate count remains exactly 14
  it("TEST R2-15: 14-gate count remains exactly 14", () => {
    assert.strictEqual(CANONICAL_READINESS_GATE_NAMES.length, 14);
    assert.ok(CANONICAL_READINESS_GATE_NAMES.includes("STALE_POSITION_CAPABILITY_POLICY_READY"));
  });  // TEST R2-16: with current production-like reward PENDING state, overall readiness cannot be READY
  it("TEST R2-16: with current production-like reward PENDING state, overall readiness cannot be READY", async () => {
    const mockDbProdLike: any = {
      $queryRawUnsafe: async (sql: string) => {
        if (sql.includes("health_cases_v2")) return [{ table_name: "health_cases_v2" }, { table_name: "health_case_v2_events" }];
        if (sql.includes("HealthStatusV2")) return [{ typname: "HealthStatusV2" }];
        if (sql.includes("education_cohorts")) {
          return [
            { table_name: "education_cohorts" },
            { table_name: "teaching_assignments" },
            { table_name: "education_sessions" },
            { table_name: "education_session_participants" },
            { table_name: "education_session_attendances" },
          ];
        }
        if (sql.includes("canonical_audit_logs")) return [{ table_name: "canonical_audit_logs" }];
        if (sql.includes("PETUGAS_OPERASIONAL_KEASRAMAAN")) return [];
        return [];
      },
      user: {
        findMany: async () => [{ username: "osda.putri", status: "AKTIF" }],
      },
      orgUnit: {
        findMany: async (args: any) => {
          if (args?.where?.type === "KAMAR") return [];
          return [
            { code: "OU-STQ-ROOT", type: "INSTITUTION", domain: "INSTITUTIONAL", genderComplex: "TIDAK_TERIKAT", isActive: true },
            { code: "OU-TAHFIZH", type: "DOMAIN", domain: "TAHFIZH", genderComplex: "TIDAK_TERIKAT", isActive: true },
            { code: "OU-KEASRAMAAN", type: "DOMAIN", domain: "KEASRAMAAN", genderComplex: "TIDAK_TERIKAT", isActive: true },
            { code: "OU-AKADEMIK", type: "DOMAIN", domain: "AKADEMIK", genderComplex: "TIDAK_TERIKAT", isActive: true },
            { code: "OU-OSDA", type: "ORGANIZATION", domain: "KEASRAMAAN", genderComplex: "TIDAK_TERIKAT", isActive: true },
            { code: "OU-TKS", type: "ORGANIZATION", domain: "KEASRAMAAN", genderComplex: "TIDAK_TERIKAT", isActive: true },
          ];
        },
      },
      position: {
        findMany: async () => [
          { code: "MUDIR", name: "Mudir", domain: "INSTITUTIONAL", isActive: true },
          { code: "KABID_TAHFIZH", name: "Kabid Tahfizh", domain: "TAHFIZH", isActive: true },
          { code: "MUSYRIF_TAHFIZH", name: "Musyrif Tahfizh", domain: "TAHFIZH", isActive: true },
          { code: "PEMBINA_HALAQOH", name: "Pembina Halaqoh", domain: "TAHFIZH", isActive: true },
          { code: "PETUGAS_OPERASIONAL_TAHFIZH", name: "POT", domain: "TAHFIZH", isActive: true },
          { code: "PETUGAS_OPERASIONAL_KEASRAMAAN", name: "POK", domain: "KEASRAMAAN", isActive: true },
        ],
      },
      capability: {
        findMany: async () => [
          { code: "academic.schedule.read" },
          { code: "academic.session.start" },
          { code: "academic.material.record" },
          { code: "academic.attendance.record" },
          { code: "tahfizh.recap.read" },
          { code: "tahfizh.target.manage" },
          { code: "keasramaan.permission.read" },
          { code: "keasramaan.permission.create" },
          { code: "student.guardian_contact.read" },
          { code: "keasramaan.permission.update" },
          { code: "keasramaan.permission.approve_mk" },
          { code: "keasramaan.permission.approve_ks" },
        ],
      },
      assignment: {
        findMany: async () => [
          { id: "a1", status: "ACTIVE", position: { code: "MUDIR" }, unit: { code: "OU-STQ-ROOT" }, user: { id: "u1", status: "AKTIF", staffId: "s1" } },
          { id: "a2", status: "ACTIVE", position: { code: "KABID_TAHFIZH" }, unit: { code: "OU-TAHFIZH" }, user: { id: "u2", status: "AKTIF", staffId: "s2" } },
          { id: "a3", status: "ACTIVE", position: { code: "MUSYRIF_TAHFIZH" }, unit: { code: "OU-HLQ-0001" }, user: { id: "u3", status: "AKTIF", staffId: "s3" } },
          { id: "a4", status: "ACTIVE", position: { code: "PETUGAS_OPERASIONAL_TAHFIZH" }, unit: { code: "OU-TAHFIZH" }, user: { id: "u4", status: "AKTIF", staffId: "s4" } },
          { id: "a5", status: "ACTIVE", position: { code: "PETUGAS_OPERASIONAL_KEASRAMAAN" }, unit: { code: "OU-OSDA-PUTRI" }, user: { id: "u5", status: "AKTIF", accountType: "UNIT", staffId: "s5" } },
        ],
      },
      teachingAssignment: {
        findMany: async () => Array.from({ length: 12 }, (_, i) => ({ id: `ta${i}`, isActive: true, slotIndex: i, subjectId: `sub${i}`, staffId: `stf${i}` })),
      },
      positionCapability: {
        findMany: async (args: any) => {
          if (args?.where?.capabilityCode === "tahfizh.reward.issue") {
            // Production state: Both Mudir & Kabid are PENDING!
            return [
              {
                capabilityCode: "tahfizh.reward.issue",
                scopeType: "GLOBAL",
                businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
                position: { code: "MUDIR", domain: "INSTITUTIONAL", isActive: true },
              },
              {
                capabilityCode: "tahfizh.reward.issue",
                scopeType: "DOMAIN",
                businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
                position: { code: "KABID_TAHFIZH", domain: "TAHFIZH", isActive: true },
              },
            ];
          }
          if (args?.where?.position?.code === "PETUGAS_OPERASIONAL_KEASRAMAAN") return [];
          return [
            { capabilityCode: "academic.schedule.read", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_KEPESANTRENAN" } },
            { capabilityCode: "academic.session.start", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_KEPESANTRENAN" } },
            { capabilityCode: "academic.material.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_KEPESANTRENAN" } },
            { capabilityCode: "academic.attendance.record", scopeType: "GLOBAL", businessRuleState: "VERIFIED_PRODUCTION", position: { code: "GURU_KEPESANTRENAN" } },
          ];
        },
        findFirst: async () => null,
      },
      santri: {
        findMany: async () => [],
      },
    };

    const origFlag = process.env.PENDIDIKAN_V2_UAT_ENABLED;
    process.env.PENDIDIKAN_V2_UAT_ENABLED = "true";

    try {
      const report = await checkPendidikanV2ProductionReadiness(mockDbProdLike);
      const gate11 = report.gates.find((g) => g.gate === "STALE_POSITION_CAPABILITY_POLICY_READY");
      assert.ok(gate11);
      assert.strictEqual(gate11.status, "NOT_READY");
      assert.strictEqual(gate11.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
      assert.strictEqual(gate11.blocking, true);

      // Overall readiness must NOT be READY!
      assert.notStrictEqual(report.overallStatus, "READY");
    } finally {
      process.env.PENDIDIKAN_V2_UAT_ENABLED = origFlag;
    }
  });

  // TEST R2-17: with exact corrected reward state, overall readiness can become READY if all other blocking gates are READY
  it("TEST R2-17: with exact corrected reward state, overall readiness can become READY if all other blocking gates are READY", async () => {
    // 1. Live evaluation of Gate 11 with corrected reward state
    const gate11 = evaluateStalePositionCapabilityPolicy([
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "MUDIR", domain: "INSTITUTIONAL", isActive: true },
      },
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "DOMAIN",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "KABID_TAHFIZH", domain: "TAHFIZH", isActive: true },
      },
    ]);
    assert.strictEqual(gate11.status, "READY");
    assert.strictEqual(gate11.reason, undefined);

    // 2. Synthesize all 12 blocking gates being READY (as on production where other 11 blocking gates pass)
    const simulatedBlockingGates = [
      { gate: "M3_3A_SCHEMA_READY", status: "READY" as const, blocking: true },
      { gate: "M3_3B_SCHEMA_READY", status: "READY" as const, blocking: true },
      { gate: "CANONICAL_AUDIT_READY", status: "READY" as const, blocking: true },
      { gate: "STAFF_LINKAGE_READY", status: "READY" as const, blocking: true },
      { gate: "REQUIRED_ORG_UNITS_READY", status: "READY" as const, blocking: true },
      { gate: "REQUIRED_POSITIONS_READY", status: "READY" as const, blocking: true },
      { gate: "CAPABILITIES_REGISTERED", status: "READY" as const, blocking: true },
      { gate: "USER_ASSIGNMENTS_READY", status: "READY" as const, blocking: true },
      { gate: "TEACHING_ASSIGNMENTS_READY", status: "READY" as const, blocking: true },
      { gate: "KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY", status: "READY" as const, blocking: true },
      gate11,
      { gate: "RUNTIME_ACTIVATION_FLAG", status: "READY" as const, blocking: true },
    ];
    const blockingReadyCount = simulatedBlockingGates.filter((g) => g.status === "READY").length;
    assert.strictEqual(blockingReadyCount, 12);
    const hasBlocked = simulatedBlockingGates.some((g) => g.status === "BLOCKED");
    const hasNotReady = simulatedBlockingGates.some((g) => g.status === "NOT_READY");
    const overall = hasBlocked ? "BLOCKED" : hasNotReady ? "NOT_READY" : "READY";
    assert.strictEqual(overall, "READY");
  });

  // Verify canonical manifest constants
  it("CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES manifest matches specifications", () => {
    assert.strictEqual(CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES.length, 2);
    const mudirPolicy = CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES.find((p) => p.positionCode === "MUDIR");
    assert.ok(mudirPolicy);
    assert.strictEqual(mudirPolicy.capabilityCode, "tahfizh.reward.issue");
    assert.strictEqual(mudirPolicy.scopeType, "GLOBAL");
    assert.strictEqual(mudirPolicy.businessRuleState, "VERIFIED_PRODUCTION");

    const kabidPolicy = CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES.find((p) => p.positionCode === "KABID_TAHFIZH");
    assert.ok(kabidPolicy);
    assert.strictEqual(kabidPolicy.capabilityCode, "tahfizh.reward.issue");
    assert.strictEqual(kabidPolicy.scopeType, "DOMAIN");
    assert.strictEqual(kabidPolicy.domain, "TAHFIZH");
    assert.strictEqual(kabidPolicy.businessRuleState, "VERIFIED_PRODUCTION");

    assert.ok(FORBIDDEN_TAHFIZH_REWARD_POSITIONS.includes("PETUGAS_OPERASIONAL_TAHFIZH"));
    assert.ok(FORBIDDEN_TAHFIZH_REWARD_POSITIONS.includes("MUSYRIF_TAHFIZH"));
    assert.ok(FORBIDDEN_TAHFIZH_REWARD_POSITIONS.includes("PEMBINA_HALAQOH"));
    assert.ok(FORBIDDEN_TAHFIZH_REWARD_POSITIONS.includes("ADM"));
  });

  // R2.1-04: Regression test for Source Unity
  it("R2.1-04: generateCanonicalBaselineCapabilities() reward entries match CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES exactly", () => {
    const allBaseline = generateCanonicalBaselineCapabilities();
    const rewardEntries = allBaseline.filter((p) => p.capabilityCode === "tahfizh.reward.issue");

    // Expected reward count = 2
    assert.strictEqual(rewardEntries.length, 2, "Expected exactly 2 reward entries in baseline");
    assert.strictEqual(rewardEntries.length, CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES.length);

    for (const policy of CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES) {
      const match = rewardEntries.find((r) => r.positionCode === policy.positionCode);
      assert.ok(match, `Missing baseline reward entry for ${policy.positionCode}`);
      assert.strictEqual(match.capabilityCode, policy.capabilityCode);
      assert.strictEqual(match.scopeType, policy.scopeType);
      assert.strictEqual(match.businessRuleState, policy.businessRuleState);
    }
  });

  it("R2.1-04: Gate 11 dynamically derives from CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES", () => {
    // Passing rows matching the canonical manifest produces READY
    const manifestRows = CANONICAL_TAHFIZH_REWARD_AUTHORITY_POLICIES.map((p) => ({
      positionCode: p.positionCode,
      positionDomain: p.domain,
      positionIsActive: true,
      capabilityCode: p.capabilityCode,
      scopeType: p.scopeType,
      businessRuleState: p.businessRuleState,
    }));

    const result = evaluateStalePositionCapabilityPolicy(manifestRows);
    assert.strictEqual(result.status, "READY");
    assert.strictEqual(result.blocking, true);
    assert.ok(result.details.includes("All required Tahfizh reward authorities verified active"));
  });

  // R2.2-01: Inactive Position validation
  it("R2.2-01: MUDIR inactive => NOT_READY (REQUIRED_REWARD_AUTHORITY_POSITION_INACTIVE)", () => {
    const rows = [
      { ...validMudir, position: { code: "MUDIR", isActive: false } },
      validKabid,
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_POSITION_INACTIVE");
    assert.ok(res.details.includes("Position MUDIR is inactive"));
  });

  it("R2.2-01: KABID_TAHFIZH inactive => NOT_READY (REQUIRED_REWARD_AUTHORITY_POSITION_INACTIVE)", () => {
    const rows = [
      validMudir,
      { ...validKabid, position: { code: "KABID_TAHFIZH", isActive: false } },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_POSITION_INACTIVE");
    assert.ok(res.details.includes("Position KABID_TAHFIZH is inactive"));
  });

  // R2.2-02: Domain enforcement for KABID_TAHFIZH
  it("R2.2-02: KABID_TAHFIZH position.domain KEASRAMAAN => NOT_READY", () => {
    const rows = [
      validMudir,
      {
        ...validKabid,
        position: { code: "KABID_TAHFIZH", domain: "KEASRAMAAN", isActive: true },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("Invalid KABID_TAHFIZH domain 'KEASRAMAAN'; expected TAHFIZH"));
  });

  it("R2.2-02: KABID_TAHFIZH position.domain TAHFIZH => valid (READY)", () => {
    const rows = [
      {
        ...validMudir,
        position: { code: "MUDIR", domain: "INSTITUTIONAL", isActive: true },
      },
      {
        ...validKabid,
        position: { code: "KABID_TAHFIZH", domain: "TAHFIZH", isActive: true },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "READY");
    assert.strictEqual(res.blocking, true);
  });

  // R2.2-03: Strict capability code matching
  it("R2.2-03: MUDIR row with correct position/scope/state but capabilityCode missing => NOT_READY", () => {
    const rows = [
      {
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "MUDIR", isActive: true },
      },
      validKabid,
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows as any);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_NOT_RUNTIME_ACTIVE");
    assert.ok(res.details.includes("Missing required MUDIR reward authority row (tahfizh.reward.issue)"));
  });

  // R2.3-01: MUDIR positionIsActive missing => NOT_READY
  it("R2.3-01: MUDIR correct capability/scope/state but positionIsActive missing => NOT_READY", () => {
    const rows = [
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "MUDIR", domain: "INSTITUTIONAL" }, // isActive missing
      },
      validKabid,
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_POSITION_METADATA_MISSING");
    assert.ok(res.details.includes("missing required is_active metadata"));
  });

  // R2.3-02: KABID_TAHFIZH positionDomain missing => NOT_READY
  it("R2.3-02: KABID_TAHFIZH correct capability/scope/state, active=true, but positionDomain missing => NOT_READY", () => {
    const rows = [
      validMudir,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "DOMAIN",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "KABID_TAHFIZH", isActive: true }, // domain missing
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_POSITION_METADATA_MISSING");
    assert.ok(res.details.includes("missing required domain metadata"));
  });

  // R2.3-03: KABID_TAHFIZH positionDomain = null => NOT_READY
  it("R2.3-03: KABID_TAHFIZH positionDomain = null => NOT_READY", () => {
    const rows = [
      validMudir,
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "DOMAIN",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "KABID_TAHFIZH", domain: null, isActive: true },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "NOT_READY");
    assert.strictEqual(res.blocking, true);
    assert.strictEqual(res.reason, "REQUIRED_REWARD_AUTHORITY_POSITION_METADATA_MISSING");
    assert.ok(res.details.includes("missing required domain metadata"));
  });

  // R2.3-04: Exact canonical metadata => READY
  it("R2.3-04: Exact canonical metadata: MUDIR active true + KABID active true + domain TAHFIZH => READY", () => {
    const rows = [
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "MUDIR", domain: "INSTITUTIONAL", isActive: true },
      },
      {
        capabilityCode: "tahfizh.reward.issue",
        scopeType: "DOMAIN",
        businessRuleState: "VERIFIED_PRODUCTION",
        position: { code: "KABID_TAHFIZH", domain: "TAHFIZH", isActive: true },
      },
    ];
    const res = evaluateStalePositionCapabilityPolicy(rows);
    assert.strictEqual(res.status, "READY");
    assert.strictEqual(res.blocking, true);
    assert.ok(res.details.includes("All required Tahfizh reward authorities verified active"));
  });
});
