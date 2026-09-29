/* eslint-disable @typescript-eslint/no-explicit-any */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGate5RuntimeActivation,
  checkPendidikanV2ProductionReadiness,
  FORBIDDEN_UNIT_MUTATION_CAPABILITIES,
} from "../lib/server/pendidikan-v2-readiness";
import {
  resolveCanonicalOrgUnitForHalaqoh,
  resolveHalaqohForCanonicalOrgUnit,
} from "../lib/server/halaqoh-canonical-mapping";
import {
  authorizeCanonical,
  createPrismaDataProvider,
} from "../lib/auth/canonical-evaluator";

describe("STQ Education Portal — PR #35 Remediation Round 3 (R3)", () => {
  // =========================================================================
  // R3-BLOCKER-01: LIVE SECURITY INSPECTION DATABASE ERROR MUST BLOCK
  // Invariant: QUERY ERROR != EMPTY RESULT
  // State Machine: SUCCESS | DATABASE_ERROR | INSPECTION_UNAVAILABLE
  // =========================================================================
  describe("R3-BLOCKER-01: Live Security Query Fail-Closed & Inspection State Machine", () => {
    it("1. Prisma positionCapability.findMany throws => RUNTIME_ACTIVATION_FLAG BLOCKED (DATABASE_UNAVAILABLE)", async () => {
      const mockDbWithError = {
        positionCapability: {
          findMany: async () => {
            throw new Error("Connection terminated unexpectedly / DB network failure");
          },
        },
      } as any;

      const report = await checkPendidikanV2ProductionReadiness(mockDbWithError);
      const runtimeGate = report.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");

      assert.ok(runtimeGate, "RUNTIME_ACTIVATION_FLAG gate must be present");
      assert.strictEqual(runtimeGate?.status, "BLOCKED");
      assert.strictEqual(runtimeGate?.blocking, true);
      assert.match(runtimeGate?.details || "", /DATABASE_UNAVAILABLE/i);
      assert.match(runtimeGate?.details || "", /QUERY ERROR != EMPTY RESULT/i);
      assert.match(runtimeGate?.details || "", /Connection terminated unexpectedly/i);
      assert.strictEqual(report.overallStatus, "BLOCKED");
    });

    it("2. Raw SQL inspection throws => RUNTIME_ACTIVATION_FLAG BLOCKED (DATABASE_UNAVAILABLE)", async () => {
      const mockDbRawSqlError = {
        // positionCapability delegate is undefined, fallback to raw SQL inspection
        $queryRawUnsafe: async () => {
          throw new Error("PostgreSQL syntax error or pool timeout during security inspection");
        },
      } as any;

      const report = await checkPendidikanV2ProductionReadiness(mockDbRawSqlError);
      const runtimeGate = report.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");

      assert.ok(runtimeGate);
      assert.strictEqual(runtimeGate?.status, "BLOCKED");
      assert.strictEqual(runtimeGate?.blocking, true);
      assert.match(runtimeGate?.details || "", /DATABASE_UNAVAILABLE/i);
      assert.match(runtimeGate?.details || "", /QUERY ERROR != EMPTY RESULT/i);
      assert.match(runtimeGate?.details || "", /PostgreSQL syntax error/i);
      assert.strictEqual(report.overallStatus, "BLOCKED");
    });

    it("3. Neither inspection interface exists => RUNTIME_ACTIVATION_FLAG BLOCKED (INSPECTION_UNAVAILABLE)", async () => {
      const mockDbNoInspection = {} as any;

      const report = await checkPendidikanV2ProductionReadiness(mockDbNoInspection);
      const runtimeGate = report.gates.find((g) => g.gate === "RUNTIME_ACTIVATION_FLAG");

      assert.ok(runtimeGate);
      assert.strictEqual(runtimeGate?.status, "BLOCKED");
      assert.strictEqual(runtimeGate?.blocking, true);
      assert.match(runtimeGate?.details || "", /INSPECTION_UNAVAILABLE/i);
      assert.match(runtimeGate?.details || "", /No authoritative inspection mechanism available/i);
      assert.strictEqual(report.overallStatus, "BLOCKED");
    });

    it("4. Successful query returning genuinely zero rows => continues normally (SUCCESS)", () => {
      const result = evaluateGate5RuntimeActivation({
        featureFlagEnabled: true,
        userStatus: "AKTIF",
        inspectionState: "SUCCESS",
        livePositionCapabilities: [],
      });

      assert.strictEqual(result.status, "READY");
      assert.strictEqual(result.blocking, true); // Gate 5 gates are blocking quality gates
      assert.match(result.details, /Gate 5 UNIT security prerequisites satisfied/i);
    });

    it("5. Successful query returning forbidden VERIFIED_PRODUCTION mutation row => BLOCKED", () => {
      for (const forbiddenCap of FORBIDDEN_UNIT_MUTATION_CAPABILITIES) {
        const result = evaluateGate5RuntimeActivation({
          featureFlagEnabled: true,
          userStatus: "AKTIF",
          inspectionState: "SUCCESS",
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

    it("6. Successful query returning stale APPROVED_TARGET_PENDING_TECHNICAL create row => zero runtime authority + SUPERSEDED / MUST_NOT_PROMOTE", () => {
      const result = evaluateGate5RuntimeActivation({
        featureFlagEnabled: false,
        userStatus: "SUSPENDED",
        inspectionState: "SUCCESS",
        livePositionCapabilities: [
          {
            positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
            capabilityCode: "keasramaan.permission.create",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
          },
        ],
      });

      assert.notStrictEqual(result.status, "READY");
      assert.match(result.details, /SUPERSEDED \/ MUST_NOT_PROMOTE/i);
      assert.match(result.details, /keasramaan\.permission\.create/i);
    });
  });

  // =========================================================================
  // R3-BLOCKER-02: REMOVE PRODUCTION HALAQOH / ORGUNIT ID FALLBACK
  // Authoritative contract:
  // Halaqoh.halaqohCode -> OrgUnit.code = "OU-" + halaqohCode -> OrgUnit.id
  // ZERO raw ID fallbacks allowed.
  // =========================================================================
  describe("R3-BLOCKER-02: Strict Code-Only Halaqoh Mapping & Zero Raw ID Auth Fallback", () => {
    // TEST 1 — WRONG-ID COLLISION:
    // Halaqoh: id = "shared-id-x", halaqohCode = "HLQ-A", status = AKTIF
    // OrgUnit: id = "shared-id-x", code = "OU-HLQ-B", type = HALAQOH, domain = TAHFIZH, isActive = true
    // There is NO "OU-HLQ-A".
    // EXPECTED: mapping = FAIL CLOSED (null). Never map Halaqoh A to OrgUnit B.
    it("TEST 1 — WRONG-ID COLLISION: returns null (FAIL CLOSED) and never maps Halaqoh A to OrgUnit B despite identical raw IDs", async () => {
      const mockDbCollision = {
        halaqoh: {
          findMany: async ({ where }: any) => {
            if (where.OR?.some((cond: any) => cond.id === "shared-id-x" || cond.halaqohCode === "shared-id-x")) {
              return [
                {
                  id: "shared-id-x",
                  halaqohCode: "HLQ-A",
                  nama: "Halaqoh A",
                  status: "AKTIF",
                },
              ];
            }
            return [];
          },
        },
        orgUnit: {
          findMany: async ({ where }: any) => {
            // Note: OrgUnit with same raw ID "shared-id-x" has code "OU-HLQ-B"
            if (where.code === "OU-HLQ-B" || where.OR?.some((c: any) => c.id === "shared-id-x" || c.code === "shared-id-x")) {
              return [
                {
                  id: "shared-id-x",
                  code: "OU-HLQ-B",
                  type: "HALAQOH",
                  domain: "TAHFIZH",
                  genderComplex: "PUTRA",
                  isActive: true,
                },
              ];
            }
            // There is NO "OU-HLQ-A" in the database
            return [];
          },
        },
      } as any;

      // Forward mapping must fail closed because expected OrgUnit "OU-HLQ-A" does not exist
      const forwardMapping = await resolveCanonicalOrgUnitForHalaqoh("shared-id-x", mockDbCollision);
      assert.strictEqual(
        forwardMapping,
        null,
        "Forward mapping must return null when exact expected OrgUnit code 'OU-HLQ-A' is missing"
      );

      // Reverse mapping from OrgUnit "shared-id-x" (code "OU-HLQ-B") must fail closed because source Halaqoh "HLQ-B" does not exist
      const reverseMapping = await resolveHalaqohForCanonicalOrgUnit("shared-id-x", mockDbCollision);
      assert.strictEqual(
        reverseMapping,
        null,
        "Reverse mapping must return null when source Halaqoh 'HLQ-B' does not exist"
      );
    });

    // TEST 2 — INACTIVE SOURCE BYPASS:
    // Halaqoh: id = "shared-id-y", halaqohCode = "HLQ-INACTIVE", status = NONAKTIF
    // OrgUnit: id = "shared-id-y", code = "OU-HLQ-INACTIVE", active = true
    // EXPECTED: authorization = DENY. The active OrgUnit must NOT resurrect an inactive source Halaqoh.
    it("TEST 2 — INACTIVE SOURCE BYPASS: active OrgUnit must NOT resurrect an inactive source Halaqoh (DENY)", async () => {
      const mockDbInactiveSource = {
        halaqoh: {
          findMany: async ({ where }: any) => {
            if (where.OR?.some((c: any) => c.id === "shared-id-y" || c.halaqohCode === "shared-id-y")) {
              return [
                {
                  id: "shared-id-y",
                  halaqohCode: "HLQ-INACTIVE",
                  nama: "Halaqoh Inactive",
                  status: "NONAKTIF", // Source Halaqoh is NONAKTIF
                },
              ];
            }
            return [];
          },
        },
        orgUnit: {
          findMany: async ({ where }: any) => {
            if (where.code === "OU-HLQ-INACTIVE" || where.OR?.some((c: any) => c.id === "shared-id-y")) {
              return [
                {
                  id: "shared-id-y",
                  code: "OU-HLQ-INACTIVE",
                  type: "HALAQOH",
                  domain: "TAHFIZH",
                  genderComplex: "PUTRA",
                  isActive: true, // OrgUnit happens to be active
                },
              ];
            }
            return [];
          },
          findUnique: async ({ where }: any) => {
            if (where.id === "shared-id-y") {
              return {
                id: "shared-id-y",
                code: "OU-HLQ-INACTIVE",
                name: "OrgUnit Inactive",
                type: "HALAQOH",
                domain: "TAHFIZH",
                genderComplex: "PUTRA",
                isActive: true,
                parentId: null,
              };
            }
            return null;
          },
          findFirst: async () => null,
        },
        santri: {
          findUnique: async () => ({
            id: "santri-inactive-hlq",
            nama: "Santri Inactive Halaqoh",
            jenisKelamin: "L",
            status: "AKTIF",
            halaqohId: "shared-id-y",
          }),
        },
        user: {
          findUnique: async () => ({
            id: "user-musyrif-y",
            username: "musyrif-y",
            status: "AKTIF",
            accountType: "PERSONAL",
            role: "MT",
            staffId: "staff-y",
            staff: { id: "staff-y", nama: "Ust. Y", status: "AKTIF" },
          }),
        },
        assignment: {
          findMany: async () => [
            {
              id: "asg-y",
              userId: "user-musyrif-y",
              positionId: "pos-musyrif",
              status: "ACTIVE",
              validFrom: new Date(0),
              validUntil: null,
              unitId: "shared-id-y",
              unit: {
                id: "shared-id-y",
                code: "OU-HLQ-INACTIVE",
                name: "OrgUnit Inactive",
                type: "HALAQOH",
                domain: "TAHFIZH",
                genderComplex: "PUTRA",
                isActive: true,
                parentId: null,
              },
              position: {
                id: "pos-musyrif",
                code: "MUSYRIF_TAHFIZH",
                name: "Musyrif Tahfizh",
                domain: "TAHFIZH",
                isActive: true,
                requiresPersonalAccount: true,
                capabilities: [
                  {
                    capabilityCode: "tahfizh.mutation",
                    scopeType: "HALAQOH",
                    businessRuleState: "VERIFIED_PRODUCTION",
                  },
                ],
              },
              scopedUnits: [],
            },
          ],
        },
      } as any;

      // 1. Verify forward mapping fails closed for inactive source
      const mapping = await resolveCanonicalOrgUnitForHalaqoh("shared-id-y", mockDbInactiveSource);
      assert.strictEqual(mapping, null, "Inactive source Halaqoh must fail closed");

      // 2. Authorize canonical evaluation: Musyrif assigned to OrgUnit "shared-id-y" attempts to access santri
      const provider = createPrismaDataProvider(mockDbInactiveSource);
      const authRes = await authorizeCanonical({
        identity: {
          userId: "user-musyrif-y",
          username: "musyrif-y",
          status: "AKTIF",
          staffId: "staff-y",
          staffStatus: "AKTIF",
        },
        capability: "tahfizh.mutation",
        resourceContext: {
          santriId: "santri-inactive-hlq",
        },
        dataProvider: provider,
      });

      // Must be DENIED: The active OrgUnit cannot resurrect an inactive source Halaqoh
      assert.strictEqual(
        authRes.decision,
        "DENY",
        "Active OrgUnit must NOT resurrect inactive source Halaqoh: expected DENY"
      );
    });

    // TEST 3 — MISSING SOURCE:
    // Santri points to a missing/invalid Halaqoh mapping.
    // An active OrgUnit happens to use the same raw ID.
    // EXPECTED: DENY / INVALID_RESOURCE_CONTEXT.
    it("TEST 3 — MISSING SOURCE: Santri pointing to unmapped halaqohId fails closed as DENY / INVALID_RESOURCE_CONTEXT", async () => {
      const mockDbMissingSource = {
        halaqoh: {
          findMany: async () => [], // No Halaqoh exists with this ID!
        },
        orgUnit: {
          findMany: async ({ where }: any) => {
            // An active OrgUnit happens to have id = "unmapped-hlq-id" with code "OU-HLQ-OTHER"
            if (where.code === "OU-HLQ-OTHER" || where.OR?.some((c: any) => c.id === "unmapped-hlq-id")) {
              return [
                {
                  id: "unmapped-hlq-id",
                  code: "OU-HLQ-OTHER",
                  type: "HALAQOH",
                  domain: "TAHFIZH",
                  genderComplex: "PUTRA",
                  isActive: true,
                },
              ];
            }
            return [];
          },
          findUnique: async ({ where }: any) => {
            if (where.id === "unmapped-hlq-id") {
              return {
                id: "unmapped-hlq-id",
                code: "OU-HLQ-OTHER",
                name: "OrgUnit Other",
                type: "HALAQOH",
                domain: "TAHFIZH",
                genderComplex: "PUTRA",
                isActive: true,
                parentId: null,
              };
            }
            return null;
          },
          findFirst: async () => null,
        },
        santri: {
          findUnique: async () => ({
            id: "santri-missing-hlq",
            nama: "Santri Missing Halaqoh",
            jenisKelamin: "L",
            status: "AKTIF",
            halaqohId: "unmapped-hlq-id",
          }),
        },
        user: {
          findUnique: async () => ({
            id: "user-musyrif-z",
            username: "musyrif-z",
            status: "AKTIF",
            accountType: "PERSONAL",
            role: "MT",
            staffId: "staff-z",
            staff: { id: "staff-z", nama: "Ust. Z", status: "AKTIF" },
          }),
        },
        assignment: {
          findMany: async () => [
            {
              id: "asg-z",
              userId: "user-musyrif-z",
              positionId: "pos-musyrif",
              status: "ACTIVE",
              validFrom: new Date(0),
              validUntil: null,
              unitId: "unmapped-hlq-id",
              unit: {
                id: "unmapped-hlq-id",
                code: "OU-HLQ-OTHER",
                name: "OrgUnit Other",
                type: "HALAQOH",
                domain: "TAHFIZH",
                genderComplex: "PUTRA",
                isActive: true,
                parentId: null,
              },
              position: {
                id: "pos-musyrif",
                code: "MUSYRIF_TAHFIZH",
                name: "Musyrif Tahfizh",
                domain: "TAHFIZH",
                isActive: true,
                requiresPersonalAccount: true,
                capabilities: [
                  {
                    capabilityCode: "tahfizh.mutation",
                    scopeType: "HALAQOH",
                    businessRuleState: "VERIFIED_PRODUCTION",
                  },
                ],
              },
              scopedUnits: [],
            },
          ],
        },
      } as any;

      const provider = createPrismaDataProvider(mockDbMissingSource);

      // Case A: Santri-targeted evaluation with unmapped halaqohId
      const authResSantri = await authorizeCanonical({
        identity: {
          userId: "user-musyrif-z",
          username: "musyrif-z",
          status: "AKTIF",
          staffId: "staff-z",
          staffStatus: "AKTIF",
        },
        capability: "tahfizh.mutation",
        resourceContext: {
          santriId: "santri-missing-hlq",
        },
        dataProvider: provider,
      });

      assert.strictEqual(authResSantri.decision, "DENY");
      assert.strictEqual(
        authResSantri.code,
        "INVALID_RESOURCE_CONTEXT",
        "Target student with unmapped halaqohId must fail closed as INVALID_RESOURCE_CONTEXT"
      );

      // Case B: Explicit requested.halaqohId evaluation with unmapped halaqohId
      const authResExplicitHalaqoh = await authorizeCanonical({
        identity: {
          userId: "user-musyrif-z",
          username: "musyrif-z",
          status: "AKTIF",
          staffId: "staff-z",
          staffStatus: "AKTIF",
        },
        capability: "tahfizh.mutation",
        resourceContext: {
          halaqohId: "unmapped-hlq-id",
        },
        dataProvider: provider,
      });

      assert.strictEqual(authResExplicitHalaqoh.decision, "DENY");
      assert.strictEqual(
        authResExplicitHalaqoh.code,
        "INVALID_RESOURCE_CONTEXT",
        "Explicit unmapped halaqohId must return null in resolveResourceContext -> INVALID_RESOURCE_CONTEXT"
      );
    });

    // TEST 4 — DISTINCT VALID IDS:
    // Halaqoh.id != OrgUnit.id
    // but:
    // Halaqoh.halaqohCode = HLQ-0001
    // OrgUnit.code = OU-HLQ-0001
    // EXPECTED: ALLOW when scope otherwise valid.
    it("TEST 4 — DISTINCT VALID IDS: Halaqoh.id != OrgUnit.id allows access through code mapping bridge", async () => {
      const HALAQOH_ID = "distinct-hlq-uuid-111";
      const ORG_UNIT_ID = "distinct-ou-uuid-999";

      const mockDbDistinctValid = {
        halaqoh: {
          findMany: async ({ where }: any) => {
            if (
              where.halaqohCode === "HLQ-0001" ||
              where.OR?.some((c: any) => c.id === HALAQOH_ID || c.halaqohCode === "HLQ-0001")
            ) {
              return [
                {
                  id: HALAQOH_ID,
                  halaqohCode: "HLQ-0001",
                  nama: "Halaqoh Distinct 1",
                  status: "AKTIF",
                },
              ];
            }
            return [];
          },
        },
        orgUnit: {
          findMany: async ({ where }: any) => {
            if (
              where.code === "OU-HLQ-0001" ||
              where.OR?.some((c: any) => c.id === ORG_UNIT_ID || c.code === "OU-HLQ-0001")
            ) {
              return [
                {
                  id: ORG_UNIT_ID,
                  code: "OU-HLQ-0001",
                  type: "HALAQOH",
                  domain: "TAHFIZH",
                  genderComplex: "PUTRA",
                  isActive: true,
                },
              ];
            }
            return [];
          },
          findUnique: async ({ where }: any) => {
            if (where.id === ORG_UNIT_ID) {
              return {
                id: ORG_UNIT_ID,
                code: "OU-HLQ-0001",
                name: "OrgUnit Distinct",
                type: "HALAQOH",
                domain: "TAHFIZH",
                genderComplex: "PUTRA",
                isActive: true,
                parentId: null,
              };
            }
            return null;
          },
        },
        santri: {
          findUnique: async () => ({
            id: "santri-distinct-01",
            nama: "Santri Distinct",
            jenisKelamin: "L",
            status: "AKTIF",
            halaqohId: HALAQOH_ID, // Points to Halaqoh.id
          }),
        },
        user: {
          findUnique: async () => ({
            id: "user-musyrif-distinct",
            username: "musyrif-distinct",
            status: "AKTIF",
            accountType: "PERSONAL",
            role: "MT",
            staffId: "staff-distinct",
            staff: { id: "staff-distinct", nama: "Ust. Distinct", status: "AKTIF" },
          }),
        },
        assignment: {
          findMany: async () => [
            {
              id: "asg-distinct",
              userId: "user-musyrif-distinct",
              positionId: "pos-musyrif",
              status: "ACTIVE",
              validFrom: new Date(0),
              validUntil: null,
              unitId: ORG_UNIT_ID, // Points to OrgUnit.id (completely distinct from Halaqoh.id!)
              unit: {
                id: ORG_UNIT_ID,
                code: "OU-HLQ-0001",
                name: "OrgUnit Distinct",
                type: "HALAQOH",
                domain: "TAHFIZH",
                genderComplex: "PUTRA",
                isActive: true,
                parentId: null,
              },
              position: {
                id: "pos-musyrif",
                code: "MUSYRIF_TAHFIZH",
                name: "Musyrif Tahfizh",
                domain: "TAHFIZH",
                isActive: true,
                requiresPersonalAccount: true,
                capabilities: [
                  {
                    capabilityCode: "tahfizh.mutation",
                    scopeType: "HALAQOH",
                    businessRuleState: "VERIFIED_PRODUCTION",
                  },
                ],
              },
              scopedUnits: [],
            },
          ],
        },
      } as any;

      // 1. Verify forward mapping correctly resolves to canonical OrgUnit
      const forwardMapping = await resolveCanonicalOrgUnitForHalaqoh(HALAQOH_ID, mockDbDistinctValid);
      assert.ok(forwardMapping);
      assert.strictEqual(forwardMapping.halaqohId, HALAQOH_ID);
      assert.strictEqual(forwardMapping.orgUnitId, ORG_UNIT_ID);
      assert.strictEqual(forwardMapping.orgUnitCode, "OU-HLQ-0001");

      // 2. Verify reverse mapping correctly resolves to source Halaqoh
      const reverseMapping = await resolveHalaqohForCanonicalOrgUnit(ORG_UNIT_ID, mockDbDistinctValid);
      assert.ok(reverseMapping);
      assert.strictEqual(reverseMapping.halaqohId, HALAQOH_ID);
      assert.strictEqual(reverseMapping.orgUnitId, ORG_UNIT_ID);

      // 3. Authorize canonical evaluation: Musyrif assigned to OrgUnit ORG_UNIT_ID accesses Santri with halaqohId HALAQOH_ID
      const provider = createPrismaDataProvider(mockDbDistinctValid);
      const authRes = await authorizeCanonical({
        identity: {
          userId: "user-musyrif-distinct",
          username: "musyrif-distinct",
          status: "AKTIF",
          staffId: "staff-distinct",
          staffStatus: "AKTIF",
        },
        capability: "tahfizh.mutation",
        resourceContext: {
          santriId: "santri-distinct-01",
        },
        dataProvider: provider,
      });

      assert.strictEqual(
        authRes.decision,
        "ALLOW",
        "Distinct valid IDs must ALLOW access via canonical bridge when codes match"
      );
      assert.strictEqual(authRes.code, "ALLOWED");
    });
  });
});
