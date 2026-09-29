(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import {
  evaluateGate5RuntimeActivation,
  checkPendidikanV2ProductionReadiness,
  FORBIDDEN_UNIT_MUTATION_CAPABILITIES,
} from "../lib/server/pendidikan-v2-readiness";

describe("R2-BLOCKER-02 — Live UNIT Mutation Capability Detection", () => {
  describe("Pure Evaluation: evaluateGate5RuntimeActivation()", () => {
    it("1. VERIFIED_PRODUCTION forbidden UNIT mutation row immediately fails closed as BLOCKED", () => {
      for (const forbiddenCap of FORBIDDEN_UNIT_MUTATION_CAPABILITIES) {
        const result = evaluateGate5RuntimeActivation({
          featureFlagEnabled: true,
          userStatus: "AKTIF",
          livePositionCapabilities: [
            {
              positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
              capabilityCode: forbiddenCap,
              businessRuleState: "VERIFIED_PRODUCTION",
            },
          ],
        });

        assert.strictEqual(result.status, "BLOCKED");
        assert.strictEqual(result.blocking, true);
        assert.match(result.details, /UNAUTHORIZED_UNIT_MUTATION_RUNTIME_AUTHORITY/i);
        assert.match(result.details, /Gate5B eligibility = NO/i);
        assert.ok(result.details.includes(forbiddenCap));
      }
    });

    it("2. APPROVED_TARGET_PENDING_TECHNICAL stale/superseded row confers zero runtime authority and reports SUPERSEDED / MUST_NOT_PROMOTE", () => {
      const result = evaluateGate5RuntimeActivation({
        featureFlagEnabled: false,
        userStatus: "SUSPENDED",
        livePositionCapabilities: [
          {
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            capabilityCode: "keasramaan.permission.create",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
          },
        ],
      });

      // Does not grant runtime authority
      assert.notStrictEqual(result.status, "READY");
      assert.match(result.details, /SUPERSEDED \/ MUST_NOT_PROMOTE/i);
      assert.match(result.details, /keasramaan\.permission\.create/i);
    });

    it("3. READ-ONLY VERIFIED_PRODUCTION keasramaan.permission.read row is permitted", () => {
      const result = evaluateGate5RuntimeActivation({
        featureFlagEnabled: true,
        userStatus: "AKTIF",
        livePositionCapabilities: [
          {
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            capabilityCode: "keasramaan.permission.read",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
      });

      assert.strictEqual(result.status, "READY");
      assert.match(result.details, /READ-ONLY monitoring per DIR-2026-038/i);
    });
  });

  describe("Real Database State Detection: checkPendidikanV2ProductionReadiness()", () => {
    let prisma: PrismaClient;

    before(async () => {
      prisma = await startTestDatabase();
    });

    after(async () => {
      await stopTestDatabase();
    });

    it("4. Live DB injection of VERIFIED_PRODUCTION PETUGAS_OPERASIONAL_KEASRAMAAN -> keasramaan.permission.create causes Gate 5 to FAIL CLOSED (BLOCKED)", async () => {
      // 1. Ensure position & capabilities exist in database
      const pos = await prisma.position.upsert({
        where: { code: "PETUGAS_OPERASIONAL_KEASRAMAAN" },
        update: {},
        create: {
          id: "pos-keasramaan-unit-test",
          code: "PETUGAS_OPERASIONAL_KEASRAMAAN",
          name: "Petugas Operasional Keasramaan",
          domain: "KEASRAMAAN",
          allowedUnitTypes: ["DIVISION", "ORGANIZATION"],
          isActive: true,
          requiresPersonalAccount: false,
        },
      });

      await prisma.capability.upsert({
        where: { code: "keasramaan.permission.create" },
        update: {},
        create: {
          code: "keasramaan.permission.create",
          namespace: "KEASRAMAAN",
          name: "Create Permission",
          description: "Permission create",
        },
      });

      // 2. Inject forbidden VERIFIED_PRODUCTION mutation capability
      const capRow = await prisma.positionCapability.upsert({
        where: {
          positionId_capabilityCode: {
            positionId: pos.id,
            capabilityCode: "keasramaan.permission.create",
          },
        },
        update: {
          businessRuleState: "VERIFIED_PRODUCTION",
        },
        create: {
          id: "cap-live-mutation-injection",
          positionId: pos.id,
          capabilityCode: "keasramaan.permission.create",
          scopeType: "UNIT",
          businessRuleState: "VERIFIED_PRODUCTION",
        },
      });

      // 3. Execute authoritative production readiness check
      const report = await checkPendidikanV2ProductionReadiness(prisma);

      // 4. Assert Gate 5 readiness immediately fails closed
      assert.strictEqual(report.overallStatus, "BLOCKED", "Overall readiness must be BLOCKED when live UNIT mutation capability is active");
      const runtimeGate = report.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
      assert.ok(runtimeGate, "RUNTIME_ACTIVATION_FLAG gate must be present");
      assert.strictEqual(runtimeGate?.status, "BLOCKED");
      assert.match(runtimeGate?.details || "", /UNAUTHORIZED_UNIT_MUTATION_RUNTIME_AUTHORITY/i);
      assert.match(runtimeGate?.details || "", /Gate5B eligibility = NO/i);
      assert.match(runtimeGate?.details || "", /keasramaan\.permission\.create/i);

      // 5. Cleanup / demote back to stale target state
      await prisma.positionCapability.update({
        where: { id: capRow.id },
        data: { businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL" },
      });

      // 6. Verify stale target state is reported as SUPERSEDED / MUST_NOT_PROMOTE
      const reportStale = await checkPendidikanV2ProductionReadiness(prisma);
      const runtimeGateStale = reportStale.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");
      assert.ok(runtimeGateStale);
      assert.match(runtimeGateStale?.details || "", /SUPERSEDED \/ MUST_NOT_PROMOTE/i);
    });
  });
});
