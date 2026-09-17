(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import {
  ScopeType,
  BusinessRuleState,
  AssignmentStatus,
  OrgDomain,
  GenderComplex,
  EffectiveCapabilityGrant,
  RequestedResourceContext,
  ResolvedResourceContext,
} from "../types/architecture-lock";
import { Role, UserSession } from "../types/auth";

import {
  CANONICAL_POSITION_CODES,
  LEGACY_ROLE_MAP,
  resolveLegacyRoleToCanonical,
  resolveUserEffectivePosition,
  isLegacyRoleMapped,
} from "../lib/auth/compatibility";

import {
  evaluateScopePredicate,
  evaluateGenderComplexBoundary,
} from "../lib/auth/scope-evaluator";

import {
  authorizeCanonical,
  CanonicalAssignmentWithDetails,
  ICanonicalDataProvider,
} from "../lib/auth/canonical-evaluator";

import {
  validateUnitAccountExecutionContext,
  createUnitAccountExecutorContext,
} from "../lib/auth/unit-account";

import {
  InMemoryAuditSink,
  recordCanonicalAudit,
  setAuditSink,
} from "../lib/auth/canonical-audit";

import {
  evaluateShadowAuthorization,
  InMemoryParitySink,
  setActiveParitySink,
} from "../lib/auth/shadow-engine";

import {
  generateProposedCanonicalState,
  LegacyUserRecord,
} from "../lib/auth/backfill-dry-run";

describe("STQ ARCHITECTURE LOCK — MILESTONE 2: COMPATIBILITY & CANONICAL AUTHORIZATION ENGINE", () => {
  // =========================================================================
  // 1. Compatibility Layer & Operational Flags
  // =========================================================================
  describe("1. Legacy Role Compatibility Mapping & Operational Flags", () => {
    const allLegacyRoles: Role[] = [
      "KS",
      "ADM",
      "MK",
      "MT",
      "PH",
      "GA",
      "OSDA",
      "WS",
      "ST",
      "YAY",
    ];

    it("1.1. maps all 10 legacy roles deterministically to canonical positions and domains", () => {
      for (const role of allLegacyRoles) {
        assert.ok(isLegacyRoleMapped(role), `Legacy role ${role} must be mapped`);
        const mapping = resolveLegacyRoleToCanonical(role);
        assert.strictEqual(mapping.role, role);
        assert.ok(mapping.defaultPositionCode, `Position code missing for ${role}`);
        assert.ok(mapping.domain, `Domain missing for ${role}`);
        assert.ok(mapping.accountType, `Account type missing for ${role}`);
      }

      assert.strictEqual(LEGACY_ROLE_MAP.KS.defaultPositionCode, CANONICAL_POSITION_CODES.MUDIR);
      assert.strictEqual(LEGACY_ROLE_MAP.KS.domain, "INSTITUTIONAL");
      assert.strictEqual(LEGACY_ROLE_MAP.ADM.defaultPositionCode, CANONICAL_POSITION_CODES.STAF_ADMIN_TU);
      assert.strictEqual(LEGACY_ROLE_MAP.ADM.domain, "MANAJEMEN");
      assert.strictEqual(LEGACY_ROLE_MAP.MK.defaultPositionCode, CANONICAL_POSITION_CODES.KEPALA_KEASRAMAAN);
      assert.strictEqual(LEGACY_ROLE_MAP.MK.domain, "KEASRAMAAN");
      assert.strictEqual(LEGACY_ROLE_MAP.MT.defaultPositionCode, CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH);
      assert.strictEqual(LEGACY_ROLE_MAP.MT.domain, "TAHFIZH");
      assert.strictEqual(LEGACY_ROLE_MAP.PH.defaultPositionCode, CANONICAL_POSITION_CODES.PEMBINA_HALAQOH);
      assert.strictEqual(LEGACY_ROLE_MAP.PH.domain, "TAHFIZH");
      assert.strictEqual(LEGACY_ROLE_MAP.GA.defaultPositionCode, CANONICAL_POSITION_CODES.GURU_AKADEMIK);
      assert.strictEqual(LEGACY_ROLE_MAP.GA.domain, "AKADEMIK");
      assert.strictEqual(LEGACY_ROLE_MAP.OSDA.defaultPositionCode, CANONICAL_POSITION_CODES.ANGGOTA_OSDA);
      assert.strictEqual(LEGACY_ROLE_MAP.OSDA.accountType, "UNIT");
      assert.strictEqual(LEGACY_ROLE_MAP.WS.defaultPositionCode, CANONICAL_POSITION_CODES.WALI_SANTRI);
      assert.strictEqual(LEGACY_ROLE_MAP.ST.defaultPositionCode, CANONICAL_POSITION_CODES.SANTRI);
      assert.strictEqual(LEGACY_ROLE_MAP.YAY.defaultPositionCode, CANONICAL_POSITION_CODES.PENGURUS_YAYASAN);
    });

    it("1.2. resolves operational flag Staff.isKepalaBidangTahfidz to KABID_TAHFIZH", () => {
      const regularMt = resolveUserEffectivePosition({
        role: "MT",
        isKepalaBidangTahfidz: false,
      });
      assert.strictEqual(regularMt.positionCode, CANONICAL_POSITION_CODES.MUSYRIF_TAHFIZH);
      assert.strictEqual(regularMt.domain, "TAHFIZH");

      const kabidMt = resolveUserEffectivePosition({
        role: "MT",
        isKepalaBidangTahfidz: true,
      });
      assert.strictEqual(kabidMt.positionCode, CANONICAL_POSITION_CODES.KABID_TAHFIZH);
      assert.strictEqual(kabidMt.domain, "TAHFIZH");
      assert.strictEqual(kabidMt.isLeadership, true);
    });

    it("1.3. resolves operational flag User.isPetugasPresensiPutri to PETUGAS_PRESENSI", () => {
      const presensiStaff = resolveUserEffectivePosition({
        role: "MK",
        isPetugasPresensiPutri: true,
      });
      assert.strictEqual(presensiStaff.positionCode, CANONICAL_POSITION_CODES.PETUGAS_PRESENSI);
      assert.strictEqual(presensiStaff.domain, "KEASRAMAAN");
    });

    it("1.4. fails closed on unmapped or arbitrary role values", () => {
      assert.strictEqual(isLegacyRoleMapped("SUPERADMIN" as Role), false);
      const res = resolveLegacyRoleToCanonical("UNKNOWN_ROLE" as Role);
      assert.strictEqual(res.defaultPositionCode, "UNMAPPED_LEGACY_ROLE");
      assert.strictEqual(res.domain, "MANAJEMEN");
    });
  });

  // =========================================================================
  // 2. Canonical Scope Evaluator Across All 8 ScopeTypes
  // =========================================================================
  describe("2. Canonical Scope Evaluator Across All 8 ScopeTypes", () => {
    const subject = {
      userId: "usr-musyrif-1",
      staffId: "stf-musyrif-1",
      santriId: null,
    };

    it("2.1. GLOBAL Scope: permits institutional access regardless of specific unit or context", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-1",
        positionCode: "MUDIR",
        capabilityCode: "tahfizh.reward.policy.edit",
        scopeType: "GLOBAL",
        anchorUnitId: "unit-root",
        unitIds: ["unit-root"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const res = evaluateScopePredicate(grant, undefined, subject);
      assert.strictEqual(res.matches, true);
      assert.strictEqual(res.code, "ALLOWED");
      assert.strictEqual(res.evaluatedScope, "GLOBAL");
    });

    it("2.2. DOMAIN Scope: matches target domain and rejects cross-domain", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-2",
        positionCode: "KABID_TAHFIZH",
        capabilityCode: "tahfizh.monitoring.view",
        scopeType: "DOMAIN",
        anchorUnitId: "unit-tahfizh",
        unitIds: ["unit-tahfizh"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };
      (grant as unknown as { orgDomain: OrgDomain }).orgDomain = "TAHFIZH";

      // Same domain -> Allowed
      const sameDomainCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-tahfizh-1"],
        orgDomain: "TAHFIZH",
      };
      const allowRes = evaluateScopePredicate(grant, sameDomainCtx, subject);
      assert.strictEqual(allowRes.matches, true);
      assert.strictEqual(allowRes.code, "ALLOWED");

      // Different domain -> Denied
      const diffDomainCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-keasramaan-1"],
        orgDomain: "KEASRAMAAN",
      };
      const denyRes = evaluateScopePredicate(grant, diffDomainCtx, subject);
      assert.strictEqual(denyRes.matches, false);
      assert.strictEqual(denyRes.code, "SCOPE_MISMATCH");
    });

    it("2.3. UNIT Scope: matches exact anchor unit and rejects other units", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-3",
        positionCode: "KEPALA_UNIT",
        capabilityCode: "unit.view",
        scopeType: "UNIT",
        anchorUnitId: "unit-kesehatan",
        unitIds: ["unit-kesehatan"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const matchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-kesehatan"],
      };
      assert.strictEqual(evaluateScopePredicate(grant, matchCtx, subject).matches, true);

      const mismatchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-dapur"],
      };
      const res = evaluateScopePredicate(grant, mismatchCtx, subject);
      assert.strictEqual(res.matches, false);
      assert.strictEqual(res.code, "SCOPE_MISMATCH");
    });

    it("2.4. ASSIGNED_UNITS Scope: matches any unit in unitIds array", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-4",
        positionCode: "PETUGAS_KESEHATAN",
        capabilityCode: "health.record.create",
        scopeType: "ASSIGNED_UNITS",
        anchorUnitId: "unit-main",
        unitIds: ["unit-a", "unit-b", "unit-c"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      assert.strictEqual(
        evaluateScopePredicate(grant, { orgUnitIds: ["unit-b"] }, subject).matches,
        true
      );
      assert.strictEqual(
        evaluateScopePredicate(grant, { orgUnitIds: ["unit-x"] }, subject).matches,
        false
      );
    });

    it("2.5. HALAQOH Scope: matches halaqohId in assigned halaqohs", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-5",
        positionCode: "MUSYRIF_TAHFIZH",
        capabilityCode: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        anchorUnitId: "unit-tahfizh",
        unitIds: ["unit-tahfizh"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const matchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-tahfizh"],
        halaqohId: "hlq-abu-bakr",
        assignedHalaqohIds: ["hlq-abu-bakr", "hlq-umar"],
      };
      assert.strictEqual(evaluateScopePredicate(grant, matchCtx, subject).matches, true);

      const mismatchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-tahfizh"],
        halaqohId: "hlq-utsman",
        assignedHalaqohIds: ["hlq-abu-bakr"],
      };
      const res = evaluateScopePredicate(grant, mismatchCtx, subject);
      assert.strictEqual(res.matches, false);
      assert.strictEqual(res.code, "SCOPE_MISMATCH");
    });

    it("2.6. KAMAR Scope: matches kamarId in assigned kamars", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-6",
        positionCode: "MUDABBIR",
        capabilityCode: "keasramaan.kamar.inspect",
        scopeType: "KAMAR",
        anchorUnitId: "unit-asrama",
        unitIds: ["unit-asrama"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const matchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-asrama"],
        kamarId: "kmr-ali-1",
        assignedKamarIds: ["kmr-ali-1"],
      };
      assert.strictEqual(evaluateScopePredicate(grant, matchCtx, subject).matches, true);

      const mismatchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-asrama"],
        kamarId: "kmr-ali-2",
        assignedKamarIds: ["kmr-ali-1"],
      };
      assert.strictEqual(evaluateScopePredicate(grant, mismatchCtx, subject).matches, false);
    });

    it("2.7. OWN_CHILD Scope: matches child in guardian linked santri IDs", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-7",
        positionCode: "WALI_SANTRI",
        capabilityCode: "santri.rapor.view",
        scopeType: "OWN_CHILD",
        anchorUnitId: "unit-portal",
        unitIds: ["unit-portal"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const matchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-portal"],
        santriId: "san-child-1",
        guardianLinkedSantriIds: ["san-child-1", "san-child-2"],
      };
      assert.strictEqual(evaluateScopePredicate(grant, matchCtx, subject).matches, true);

      const mismatchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-portal"],
        santriId: "san-other-child",
        guardianLinkedSantriIds: ["san-child-1"],
      };
      assert.strictEqual(evaluateScopePredicate(grant, mismatchCtx, subject).matches, false);
    });

    it("2.8. SELF Scope: matches own userId or santriId", () => {
      const grant: EffectiveCapabilityGrant = {
        assignmentId: "asg-8",
        positionCode: "SANTRI",
        capabilityCode: "santri.profile.view",
        scopeType: "SELF",
        anchorUnitId: "unit-portal",
        unitIds: ["unit-portal"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const matchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-portal"],
        targetUserId: "usr-musyrif-1",
      };
      assert.strictEqual(evaluateScopePredicate(grant, matchCtx, subject).matches, true);

      const mismatchCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-portal"],
        targetUserId: "usr-someone-else",
      };
      assert.strictEqual(evaluateScopePredicate(grant, mismatchCtx, subject).matches, false);
    });

    it("2.9. Gender Complex Boundary: enforces PUTRA vs PUTRI segregation and fails closed", () => {
      assert.strictEqual(evaluateGenderComplexBoundary("PUTRA", "PUTRA"), true);
      assert.strictEqual(evaluateGenderComplexBoundary("PUTRI", "PUTRI"), true);
      assert.strictEqual(evaluateGenderComplexBoundary("PUTRA", "PUTRI"), false);
      assert.strictEqual(evaluateGenderComplexBoundary("PUTRI", "PUTRA"), false);
      assert.strictEqual(evaluateGenderComplexBoundary("CAMPUR", "PUTRA"), true);
      assert.strictEqual(evaluateGenderComplexBoundary("PUTRA", "CAMPUR"), true);
      assert.strictEqual(evaluateGenderComplexBoundary("TIDAK_TERIKAT", "PUTRI"), true);

      // Scoped evaluation with gender complex mismatch -> GENDER_COMPLEX_DENIED
      const putraGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-putra",
        positionCode: "MUSYRIF_TAHFIZH",
        capabilityCode: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        anchorUnitId: "unit-tahfizh-putra",
        unitIds: ["unit-tahfizh-putra"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };
      (putraGrant as unknown as { genderComplex: GenderComplex }).genderComplex = "PUTRA";

      const putriCtx: ResolvedResourceContext = {
        orgUnitIds: ["unit-tahfizh-putri"],
        genderComplex: "PUTRI",
        halaqohId: "hlq-maryam",
        assignedHalaqohIds: ["hlq-maryam"],
      };

      const res = evaluateScopePredicate(putraGrant, putriCtx, subject);
      assert.strictEqual(res.matches, false);
      assert.strictEqual(res.code, "GENDER_COMPLEX_DENIED");
    });
  });

  // =========================================================================
  // 3. Canonical Evaluator & The Activation Triple (Fail-Closed)
  // =========================================================================
  describe("3. Canonical Evaluator & The Activation Triple (Fail-Closed Default Closure)", () => {
    it("3.1. denies unauthenticated session or missing userId", async () => {
      const res = await authorizeCanonical({
        identity: null,
        capability: "tahfizh.setoran.create",
      });
      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "UNAUTHENTICATED");
      assert.strictEqual(res.reasonCode, "UNAUTHENTICATED");
    });

    it("3.2. denies inactive user identity", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-inactive",
          username: "inactive.user",
          status: "NONAKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.setoran.create",
      });
      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "IDENTITY_INACTIVE");
      assert.strictEqual(res.reasonCode, "IDENTITY_INACTIVE");
    });

    it("3.3. denies user with zero active assignments", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-no-asg",
          username: "no.assignments",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.setoran.create",
      });
      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
      assert.strictEqual(res.reasonCode, "NO_ACTIVE_ASSIGNMENTS");
    });

    it("3.4. denies DRAFT or non-ACTIVE assignments", async () => {
      const mockAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-draft",
        userId: "usr-draft-asg",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "unit-thf",
        unitCode: "THF-01",
        unitName: "Tahfizh Unit",
        status: "DRAFT", // strictly DRAFT
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.setoran.create",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-draft-asg",
            username: "draft.user",
            status: "AKTIF",
            accountType: "PERSONAL",
          };
        },
        async getActiveAssignments() {
          return [mockAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["unit-thf"] };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-draft-asg",
          username: "draft.user",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.setoran.create",
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("3.5. Activation Triple: denies PROPOSED_TBD and APPROVED_TARGET_PENDING_TECHNICAL grants", async () => {
      const unverifiedAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-unverified",
        userId: "usr-active",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "unit-thf",
        unitCode: "THF-01",
        unitName: "Tahfizh Unit",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.setoran.create",
            scopeType: "GLOBAL",
            businessRuleState: "PROPOSED_TBD", // Unverified rule
          },
          {
            capabilityCode: "tahfizh.target.edit",
            scopeType: "GLOBAL",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", // Pending technical rule
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-active",
            username: "active.user",
            status: "AKTIF",
            accountType: "PERSONAL",
          };
        },
        async getActiveAssignments() {
          return [unverifiedAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["unit-thf"] };
        },
      };

      // PROPOSED_TBD must confer ZERO authority
      const resTbd = await authorizeCanonical({
        identity: {
          userId: "usr-active",
          username: "active.user",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.setoran.create",
        dataProvider: mockProvider,
      });
      assert.strictEqual(resTbd.decision, "DENY");
      assert.strictEqual(resTbd.code, "CAPABILITY_NOT_GRANTED");

      // APPROVED_TARGET_PENDING_TECHNICAL must confer ZERO production authority
      const resPending = await authorizeCanonical({
        identity: {
          userId: "usr-active",
          username: "active.user",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.target.edit",
        dataProvider: mockProvider,
      });
      assert.strictEqual(resPending.decision, "DENY");
      assert.strictEqual(resPending.code, "CAPABILITY_NOT_GRANTED");
    });

    it("3.6. Activation Triple: grants ALLOW when ACTIVE + VERIFIED_PRODUCTION + explicit scopeType match", async () => {
      const verifiedAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-verified",
        userId: "usr-active",
        positionId: "pos-mudir",
        positionCode: "MUDIR",
        positionName: "Mudir Pesantren",
        domain: "INSTITUTIONAL",
        unitId: "unit-root",
        unitCode: "ROOT",
        unitName: "STQ Pusat",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-active",
            username: "mudir.user",
            status: "AKTIF",
            accountType: "PERSONAL",
          };
        },
        async getActiveAssignments() {
          return [verifiedAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["unit-root"] };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-active",
          username: "mudir.user",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.reward.issue",
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "ALLOW");
      assert.strictEqual(res.code, "ALLOWED");
      assert.strictEqual(res.reasonCode, "ALLOWED");
      assert.strictEqual(res.positionCode, "MUDIR");
      assert.strictEqual(res.scopeType, "GLOBAL");
    });

    it("3.7. Fail-Closed Error Handling: returns ERROR and DATABASE_UNAVAILABLE on DB exceptions", async () => {
      const failingProvider: ICanonicalDataProvider = {
        async getIdentity() {
          throw new Error("Connection pool timeout (simulated DB failure)");
        },
        async getActiveAssignments() {
          throw new Error("Connection lost");
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return null;
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-test",
          username: "test.user",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "tahfizh.setoran.create",
        dataProvider: failingProvider,
      });

      assert.strictEqual(res.decision, "ERROR");
      assert.strictEqual(res.code, "SYSTEM_FAIL_CLOSED");
      assert.strictEqual(res.reasonCode, "DATABASE_UNAVAILABLE");
      assert.ok(res.reason.includes("Connection lost"));
    });
  });

  // =========================================================================
  // 4. Tahfizh Business-Rule Parity
  // =========================================================================
  describe("4. Tahfizh Business-Rule Parity", () => {
    function createTahfizhProvider(assignments: CanonicalAssignmentWithDetails[]): ICanonicalDataProvider {
      return {
        async getIdentity(id) {
          return { userId: id, username: "thf.user", status: "AKTIF", accountType: "PERSONAL" };
        },
        async getActiveAssignments() {
          return assignments;
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext(req) {
          return {
            orgUnitIds: req.unitId ? [req.unitId] : ["unit-tahfizh"],
            halaqohId: req.halaqohId,
            assignedHalaqohIds: req.halaqohId ? [req.halaqohId] : [],
          };
        },
      };
    }

    it("4.1. Mudir & Kabid Tahfizh can issue rewards; ordinary MT cannot", async () => {
      // 1. Mudir Assignment
      const mudirAsg: CanonicalAssignmentWithDetails = {
        id: "asg-mudir",
        userId: "usr-mudir",
        positionId: "pos-mudir",
        positionCode: "MUDIR",
        positionName: "Mudir",
        domain: "INSTITUTIONAL",
        unitId: "unit-root",
        unitCode: "ROOT",
        unitName: "Root",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      // 2. Kabid Tahfizh Assignment
      const kabidAsg: CanonicalAssignmentWithDetails = {
        id: "asg-kabid",
        userId: "usr-kabid",
        positionId: "pos-kabid",
        positionCode: "KABID_TAHFIZH",
        positionName: "Kabid Tahfizh",
        domain: "TAHFIZH",
        unitId: "unit-tahfizh",
        unitCode: "THF",
        unitName: "Tahfizh",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "DOMAIN",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      // 3. Ordinary MT Assignment (cannot issue rewards)
      const mtAsg: CanonicalAssignmentWithDetails = {
        id: "asg-mt",
        userId: "usr-mt",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "unit-tahfizh",
        unitCode: "THF",
        unitName: "Tahfizh",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.setoran.create",
            scopeType: "HALAQOH",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      // Evaluate Mudir -> ALLOW
      const mudirRes = await authorizeCanonical({
        identity: { userId: "usr-mudir", username: "mudir", status: "AKTIF", accountType: "PERSONAL" },
        capability: "tahfizh.reward.issue",
        dataProvider: createTahfizhProvider([mudirAsg]),
      });
      assert.strictEqual(mudirRes.decision, "ALLOW");

      // Evaluate Kabid -> ALLOW
      const kabidRes = await authorizeCanonical({
        identity: { userId: "usr-kabid", username: "kabid", status: "AKTIF", accountType: "PERSONAL" },
        capability: "tahfizh.reward.issue",
        resourceContext: { unitId: "unit-tahfizh" },
        resolvedContext: { orgUnitIds: ["unit-tahfizh"], orgDomain: "TAHFIZH" },
        dataProvider: createTahfizhProvider([kabidAsg]),
      });
      assert.strictEqual(kabidRes.decision, "ALLOW");

      // Evaluate Ordinary MT -> DENY
      const mtRes = await authorizeCanonical({
        identity: { userId: "usr-mt", username: "mt", status: "AKTIF", accountType: "PERSONAL" },
        capability: "tahfizh.reward.issue",
        dataProvider: createTahfizhProvider([mtAsg]),
      });
      assert.strictEqual(mtRes.decision, "DENY");
      assert.strictEqual(mtRes.code, "CAPABILITY_NOT_GRANTED");
    });

    it("4.2. Mudir ONLY can edit reward policy; Kabid and MT denied", async () => {
      const mudirPolicyAsg: CanonicalAssignmentWithDetails = {
        id: "asg-mudir-policy",
        userId: "usr-mudir",
        positionId: "pos-mudir",
        positionCode: "MUDIR",
        positionName: "Mudir",
        domain: "INSTITUTIONAL",
        unitId: "unit-root",
        unitCode: "ROOT",
        unitName: "Root",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.policy.edit",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const kabidPolicyAsg: CanonicalAssignmentWithDetails = {
        id: "asg-kabid-no-policy",
        userId: "usr-kabid",
        positionId: "pos-kabid",
        positionCode: "KABID_TAHFIZH",
        positionName: "Kabid Tahfizh",
        domain: "TAHFIZH",
        unitId: "unit-tahfizh",
        unitCode: "THF",
        unitName: "Tahfizh",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "DOMAIN",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      // Mudir -> ALLOW
      const mudirRes = await authorizeCanonical({
        identity: { userId: "usr-mudir", username: "mudir", status: "AKTIF", accountType: "PERSONAL" },
        capability: "tahfizh.reward.policy.edit",
        dataProvider: createTahfizhProvider([mudirPolicyAsg]),
      });
      assert.strictEqual(mudirRes.decision, "ALLOW");

      // Kabid -> DENY
      const kabidRes = await authorizeCanonical({
        identity: { userId: "usr-kabid", username: "kabid", status: "AKTIF", accountType: "PERSONAL" },
        capability: "tahfizh.reward.policy.edit",
        dataProvider: createTahfizhProvider([kabidPolicyAsg]),
      });
      assert.strictEqual(kabidRes.decision, "DENY");
      assert.strictEqual(kabidRes.code, "CAPABILITY_NOT_GRANTED");
    });
  });

  // =========================================================================
  // 5. Health Legacy Parity
  // =========================================================================
  describe("5. Health Legacy Parity Matrix", () => {
    function createHealthProvider(assignment: CanonicalAssignmentWithDetails): ICanonicalDataProvider {
      return {
        async getIdentity(id) {
          return { userId: id, username: "health.user", status: "AKTIF", accountType: "PERSONAL" };
        },
        async getActiveAssignments() {
          return [assignment];
        },
        async getUnitAccountPlacement() {
          return { unitId: "unit-osda" };
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext(req) {
          return {
            orgUnitIds: [req.unitId || "unit-kesehatan"],
            santriId: req.santriId,
          };
        },
      };
    }

    it("5.1. HEALTH_RECORD_CREATE: permitted for KS, MK, and ADM", async () => {
      for (const pos of ["MUDIR", "KEPALA_KEASRAMAAN", "STAF_ADMIN_TU"]) {
        const asg: CanonicalAssignmentWithDetails = {
          id: `asg-${pos}`,
          userId: `usr-${pos}`,
          positionId: `pos-${pos}`,
          positionCode: pos,
          positionName: pos,
          domain: pos === "MUDIR" ? "INSTITUTIONAL" : pos === "KEPALA_KEASRAMAAN" ? "KEASRAMAAN" : "MANAJEMEN",
          unitId: "unit-root",
          unitCode: "ROOT",
          unitName: "Root",
          status: "ACTIVE",
          validFrom: new Date(0),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: "health.record.create",
              scopeType: "GLOBAL",
              businessRuleState: "VERIFIED_PRODUCTION",
            },
          ],
          scopeUnits: [],
        };

        const res = await authorizeCanonical({
          identity: { userId: `usr-${pos}`, username: pos.toLowerCase(), status: "AKTIF", accountType: "PERSONAL" },
          capability: "health.record.create",
          dataProvider: createHealthProvider(asg),
        });
        assert.strictEqual(res.decision, "ALLOW", `Position ${pos} must be allowed to create health record`);
      }
    });

    it("5.2. HEALTH_RECORD_UPDATE_STATUS: permitted for KS and MK, strictly DENIED to ADM", async () => {
      // ADM Position: only has health.record.create, not update_status
      const admAsg: CanonicalAssignmentWithDetails = {
        id: "asg-adm",
        userId: "usr-adm",
        positionId: "pos-adm",
        positionCode: "STAF_ADMIN_TU",
        positionName: "Admin TU",
        domain: "MANAJEMEN",
        unitId: "unit-root",
        unitCode: "ROOT",
        unitName: "Root",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "health.record.create",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const admRes = await authorizeCanonical({
        identity: { userId: "usr-adm", username: "admin", status: "AKTIF", accountType: "PERSONAL" },
        capability: "health.record.update_status",
        dataProvider: createHealthProvider(admAsg),
      });
      assert.strictEqual(admRes.decision, "DENY");
      assert.strictEqual(admRes.code, "CAPABILITY_NOT_GRANTED");

      // MK Position: has health.record.update_status
      const mkAsg: CanonicalAssignmentWithDetails = {
        id: "asg-mk",
        userId: "usr-mk",
        positionId: "pos-mk",
        positionCode: "KEPALA_KEASRAMAAN",
        positionName: "Musyrif Keasramaan",
        domain: "KEASRAMAAN",
        unitId: "unit-asrama",
        unitCode: "ASR",
        unitName: "Asrama",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "health.record.update_status",
            scopeType: "DOMAIN",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const mkRes = await authorizeCanonical({
        identity: { userId: "usr-mk", username: "mk", status: "AKTIF", accountType: "PERSONAL" },
        capability: "health.record.update_status",
        resolvedContext: { orgUnitIds: ["unit-asrama"], orgDomain: "KEASRAMAAN" },
        dataProvider: createHealthProvider(mkAsg),
      });
      assert.strictEqual(mkRes.decision, "ALLOW");
    });

    it("5.3. Scoped Read: WS permitted for own child, ST for self; OSDA has no health access", async () => {
      // WS with OWN_CHILD scope
      const wsAsg: CanonicalAssignmentWithDetails = {
        id: "asg-ws",
        userId: "usr-ws",
        positionId: "pos-ws",
        positionCode: "WALI_SANTRI",
        positionName: "Wali Santri",
        domain: "MANAJEMEN",
        unitId: "unit-portal",
        unitCode: "PORTAL",
        unitName: "Portal",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "health.record.view_scoped",
            scopeType: "OWN_CHILD",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const wsResAllow = await authorizeCanonical({
        identity: { userId: "usr-ws", username: "wali", status: "AKTIF", accountType: "PERSONAL" },
        capability: "health.record.view_scoped",
        resolvedContext: {
          orgUnitIds: ["unit-portal"],
          santriId: "san-child-1",
          guardianLinkedSantriIds: ["san-child-1"],
        },
        dataProvider: createHealthProvider(wsAsg),
      });
      assert.strictEqual(wsResAllow.decision, "ALLOW");

      const wsResDeny = await authorizeCanonical({
        identity: { userId: "usr-ws", username: "wali", status: "AKTIF", accountType: "PERSONAL" },
        capability: "health.record.view_scoped",
        resolvedContext: {
          orgUnitIds: ["unit-portal"],
          santriId: "san-other-child",
          guardianLinkedSantriIds: ["san-child-1"],
        },
        dataProvider: createHealthProvider(wsAsg),
      });
      assert.strictEqual(wsResDeny.decision, "DENY");
      assert.strictEqual(wsResDeny.code, "SCOPE_MISMATCH");

      // OSDA has zero health capabilities
      const osdaAsg: CanonicalAssignmentWithDetails = {
        id: "asg-osda",
        userId: "usr-osda",
        positionId: "pos-osda",
        positionCode: "ANGGOTA_OSDA",
        positionName: "Anggota OSDA",
        domain: "KEASRAMAAN",
        unitId: "unit-osda",
        unitCode: "OSDA",
        unitName: "OSDA",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "keasramaan.presensi.create",
            scopeType: "UNIT",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const osdaRes = await authorizeCanonical({
        identity: { userId: "usr-osda", username: "osda", status: "AKTIF", accountType: "UNIT" },
        capability: "health.record.view_scoped",
        dataProvider: createHealthProvider(osdaAsg),
      });
      assert.strictEqual(osdaRes.decision, "DENY");
      assert.strictEqual(osdaRes.code, "CAPABILITY_NOT_GRANTED");
    });
  });

  // =========================================================================
  // 6. Unit Account Semantics & Dual Attribution
  // =========================================================================
  describe("6. Unit Account Semantics & Dual Attribution", () => {
    it("6.1. enforces single placement invariant and human executor on mutations", () => {
      // Read-only station operation does not require human executor
      const readRes = validateUnitAccountExecutionContext({
        accountType: "UNIT",
        isMutation: false,
        activePlacementUnitId: "unit-kios-1",
      });
      assert.strictEqual(readRes.isValid, true);

      // Mutation without human executor is rejected
      const mutNoExecRes = validateUnitAccountExecutionContext({
        accountType: "UNIT",
        isMutation: true,
        activePlacementUnitId: "unit-kios-1",
        executorContext: null,
      });
      assert.strictEqual(mutNoExecRes.isValid, false);
      assert.strictEqual(mutNoExecRes.errorCode, "UNIT_EXECUTOR_REQUIRED");

      // Mutation with valid human executor is accepted
      const mutValidRes = validateUnitAccountExecutionContext({
        accountType: "UNIT",
        isMutation: true,
        activePlacementUnitId: "unit-kios-1",
        executorContext: {
          technicalAccountId: "usr-kios-1",
          technicalAccountUsername: "kios.putra",
          humanExecutorId: "stf-operator-1",
          humanExecutorName: "Ust. Operator",
          unitId: "unit-kios-1",
          assignmentId: "asg-kios-1",
        },
      });
      assert.strictEqual(mutValidRes.isValid, true);

      // Mismatch between executor context unit and account placement is rejected
      const mutMismatchRes = validateUnitAccountExecutionContext({
        accountType: "UNIT",
        isMutation: true,
        activePlacementUnitId: "unit-kios-1",
        executorContext: {
          technicalAccountId: "usr-kios-1",
          technicalAccountUsername: "kios.putra",
          humanExecutorId: "stf-operator-1",
          humanExecutorName: "Ust. Operator",
          unitId: "unit-kios-OTHER",
          assignmentId: "asg-kios-1",
        },
      });
      assert.strictEqual(mutMismatchRes.isValid, false);
      assert.strictEqual(mutMismatchRes.errorCode, "UNIT_PLACEMENT_MISMATCH");
    });

    it("6.2. creates valid UnitAccountExecutorContext and rejects empty humanExecutorId", () => {
      const ctx = createUnitAccountExecutorContext({
        technicalAccountId: "usr-pos-1",
        technicalAccountUsername: "pos.keasramaan",
        humanExecutorId: "stf-101",
        humanExecutorName: "Ahmad",
        unitId: "unit-asr-1",
        assignmentId: "asg-101",
      });
      assert.strictEqual(ctx.humanExecutorId, "stf-101");
      assert.strictEqual(ctx.humanExecutorName, "Ahmad");

      assert.throws(() => {
        createUnitAccountExecutorContext({
          technicalAccountId: "usr-pos-1",
          technicalAccountUsername: "pos.keasramaan",
          humanExecutorId: "   ",
          humanExecutorName: "Ahmad",
          unitId: "unit-asr-1",
          assignmentId: "asg-101",
        });
      }, /humanExecutorId/);
    });
  });

  // =========================================================================
  // 7. Forensic Audit Snapshot Logger
  // =========================================================================
  describe("7. Forensic Audit Snapshot Logger", () => {
    let memorySink: InMemoryAuditSink;

    beforeEach(() => {
      memorySink = new InMemoryAuditSink();
      setAuditSink(memorySink);
    });

    it("7.1. captures immutable dual attribution snapshot in memory sink without DB writes", async () => {
      const auditEntry = {
        technicalAccountId: "usr-kiosk-putra",
        technicalAccountUsername: "kiosk.putra",
        humanExecutorId: "stf-musyrif-01",
        humanExecutorName: "Ust. Musyrif",
        action: "MUTATE_SETORAN",
        entity: "SetoranTahfizh",
        entityId: "setoran-123",
        capabilityCode: "tahfizh.setoran.create",
        positionCode: "MUSYRIF_TAHFIZH",
        scopeType: "HALAQOH" as ScopeType,
        unitId: "unit-tahfizh-putra",
        beforeState: null,
        afterState: { juz: 30, halaman: 582, nilai: "A" },
        resourceContext: { halaqohId: "hlq-abu-bakr" },
        reason: "Setoran harian santri",
      };

      await recordCanonicalAudit(auditEntry);

      const records = memorySink.getRecords();
      assert.strictEqual(records.length, 1);
      const saved = records[0];
      assert.strictEqual(saved.technicalAccountId, "usr-kiosk-putra");
      assert.strictEqual(saved.humanExecutorId, "stf-musyrif-01");
      assert.strictEqual(saved.capabilityCode, "tahfizh.setoran.create");
      assert.strictEqual(saved.scopeType, "HALAQOH");
    });
  });

  // =========================================================================
  // 8. Shadow & Parity Engine
  // =========================================================================
  describe("8. Shadow & Parity Engine (Zero Production Disruption)", () => {
    let paritySink: InMemoryParitySink;

    beforeEach(() => {
      paritySink = new InMemoryParitySink();
      setActiveParitySink(paritySink);
    });

    it("8.1. dual-evaluates and strictly preserves LEGACY authority at runtime", async () => {
      // Scenario A: Legacy ALLOW, Canonical ALLOW -> MATCH_ALLOW, runtimeAllowed = true
      const sessionA: UserSession = {
        userId: "usr-ks",
        username: "mudir.stq",
        role: "KS",
      };
      const resA = await evaluateShadowAuthorization({
        session: sessionA,
        capabilityCode: "health.record.create",
        legacyCheck: () => true, // Legacy allows
        paritySink,
      });
      assert.strictEqual(resA.runtimeAllowed, true);

      // Scenario B: Legacy ALLOW, Canonical DENY -> MISMATCH_LEGACY_ALLOW, runtimeAllowed = true (Legacy preserves!)
      const resB = await evaluateShadowAuthorization({
        session: sessionA,
        capabilityCode: "nonexistent.capability",
        legacyCheck: () => true, // Legacy allows
        paritySink,
      });
      assert.strictEqual(resB.runtimeAllowed, true); // Legacy preserved!
      assert.strictEqual(resB.parityRecord.parityStatus, "MISMATCH_LEGACY_ALLOW");

      // Scenario C: Legacy DENY, Canonical ALLOW -> MISMATCH_CANONICAL_ALLOW, runtimeAllowed = false (Legacy preserves!)
      const resC = await evaluateShadowAuthorization({
        session: sessionA,
        capabilityCode: "health.record.create",
        legacyCheck: () => false, // Legacy denies
        paritySink,
      });
      assert.strictEqual(resC.runtimeAllowed, false); // Legacy preserved!
    });

    it("8.2. telemetry record contains zero PII", async () => {
      const session: UserSession = {
        userId: "usr-musyrif",
        username: "musyrif.1",
        role: "MT",
      };

      const res = await evaluateShadowAuthorization({
        session,
        capabilityCode: "tahfizh.setoran.create",
        legacyCheck: () => true,
        resourceType: "SetoranTahfizh",
        resourceId: "set-001",
        paritySink,
      });

      const jsonStr = JSON.stringify(res.parityRecord);
      assert.strictEqual(jsonStr.includes("password"), false);
      assert.strictEqual(jsonStr.includes("wali_phone"), false);
      assert.strictEqual(jsonStr.includes("nik"), false);
    });
  });

  // =========================================================================
  // 9. Backfill Dry-Run Engine Determinism
  // =========================================================================
  describe("9. Backfill Dry-Run Engine Determinism (Zero DB Writes)", () => {
    it("9.1. produces deterministic, idempotent output across multiple runs", () => {
      const mockLegacyUsers: LegacyUserRecord[] = [
        { id: "u-1", username: "mudir", role: "KS", status: "AKTIF" },
        { id: "u-2", username: "admin", role: "ADM", status: "AKTIF" },
        { id: "u-3", username: "kabid", role: "MT", status: "AKTIF", isKepalaBidangTahfidz: true },
        { id: "u-4", username: "musyrif", role: "MT", status: "AKTIF" },
        { id: "u-5", username: "kiosk_putra", role: "OSDA", status: "AKTIF" },
      ];

      const run1 = generateProposedCanonicalState(mockLegacyUsers);
      const run2 = generateProposedCanonicalState(mockLegacyUsers);

      assert.deepStrictEqual(run1.proposedOrgUnits, run2.proposedOrgUnits);
      assert.deepStrictEqual(run1.proposedPositions, run2.proposedPositions);
      assert.deepStrictEqual(run1.proposedAssignments, run2.proposedAssignments);
      assert.deepStrictEqual(run1.proposedPositionCapabilities, run2.proposedPositionCapabilities);
    });

    it("9.2. unmapped or uncertain assignments strictly default to DRAFT and PROPOSED_TBD", () => {
      const ambiguousUsers: LegacyUserRecord[] = [
        { id: "u-ambiguous", username: "ambiguous", role: "GA", status: "NONAKTIF" },
      ];

      const plan = generateProposedCanonicalState(ambiguousUsers);
      const asg = plan.proposedAssignments.find((a) => a.userId === "u-ambiguous");
      assert.ok(asg, "Proposed assignment must exist");
      assert.strictEqual(asg.status, "DRAFT", "Ambiguous / inactive legacy user assignment must default to DRAFT");
    });
  });

  // =========================================================================
  // 10. Automated Parity Matrix (20+ Precise Scenarios)
  // =========================================================================
  describe("10. Automated Parity Matrix (24 Comprehensive Verification Scenarios)", () => {
    interface ParityScenario {
      id: number;
      name: string;
      role: Role;
      positionCode: string;
      capability: string;
      scopeType: ScopeType;
      ruleState: BusinessRuleState;
      assignmentStatus: AssignmentStatus;
      resourceContext: RequestedResourceContext;
      resolvedContext?: ResolvedResourceContext;
      expectedDecision: "ALLOW" | "DENY" | "ERROR";
      expectedReasonCode: string;
    }

    const scenarios: ParityScenario[] = [
      {
        id: 1,
        name: "Mudir - Institutional Reward Issue",
        role: "KS",
        positionCode: "MUDIR",
        capability: "tahfizh.reward.issue",
        scopeType: "GLOBAL",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-root" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 2,
        name: "Mudir - Reward Policy Edit",
        role: "KS",
        positionCode: "MUDIR",
        capability: "tahfizh.reward.policy.edit",
        scopeType: "GLOBAL",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-root" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 3,
        name: "Kabid Tahfizh - Reward Issue in Domain",
        role: "MT",
        positionCode: "KABID_TAHFIZH",
        capability: "tahfizh.reward.issue",
        scopeType: "DOMAIN",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-tahfizh" },
        resolvedContext: { orgUnitIds: ["unit-tahfizh"], orgDomain: "TAHFIZH" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 4,
        name: "Kabid Tahfizh - Reward Policy Edit (Denied)",
        role: "MT",
        positionCode: "KABID_TAHFIZH",
        capability: "tahfizh.reward.policy.edit",
        scopeType: "DOMAIN",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-tahfizh" },
        expectedDecision: "DENY",
        expectedReasonCode: "CAPABILITY_NOT_GRANTED",
      },
      {
        id: 5,
        name: "MT - Setoran Create in Assigned Halaqoh (Allowed)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-tahfizh", halaqohId: "hlq-1" },
        resolvedContext: { orgUnitIds: ["unit-tahfizh"], halaqohId: "hlq-1", assignedHalaqohIds: ["hlq-1"] },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 6,
        name: "MT - Setoran Create in Other Halaqoh (Denied)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-tahfizh", halaqohId: "hlq-2" },
        resolvedContext: { orgUnitIds: ["unit-tahfizh"], halaqohId: "hlq-2", assignedHalaqohIds: ["hlq-1"] },
        expectedDecision: "DENY",
        expectedReasonCode: "SCOPE_MISMATCH",
      },
      {
        id: 7,
        name: "MT - Reward Issue (Denied)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.reward.issue",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-tahfizh" },
        expectedDecision: "DENY",
        expectedReasonCode: "CAPABILITY_NOT_GRANTED",
      },
      {
        id: 8,
        name: "KS - Health Record Create (Allowed)",
        role: "KS",
        positionCode: "MUDIR",
        capability: "health.record.create",
        scopeType: "GLOBAL",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-root" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 9,
        name: "MK - Health Record Update Status (Allowed)",
        role: "MK",
        positionCode: "KEPALA_KEASRAMAAN",
        capability: "health.record.update_status",
        scopeType: "DOMAIN",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-asrama" },
        resolvedContext: { orgUnitIds: ["unit-asrama"], orgDomain: "KEASRAMAAN" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 10,
        name: "ADM - Health Record Create (Allowed)",
        role: "ADM",
        positionCode: "STAF_ADMIN_TU",
        capability: "health.record.create",
        scopeType: "GLOBAL",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-root" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 11,
        name: "ADM - Health Record Update Status (Denied)",
        role: "ADM",
        positionCode: "STAF_ADMIN_TU",
        capability: "health.record.update_status",
        scopeType: "GLOBAL",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-root" },
        expectedDecision: "DENY",
        expectedReasonCode: "CAPABILITY_NOT_GRANTED",
      },
      {
        id: 12,
        name: "GA - Academic Grade Edit in Assigned Class (Allowed)",
        role: "GA",
        positionCode: "GURU_AKADEMIK",
        capability: "academic.grade.edit",
        scopeType: "ASSIGNED_UNITS",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "class-7a" },
        resolvedContext: { orgUnitIds: ["class-7a"] },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 13,
        name: "GA - Health Record Create (Denied)",
        role: "GA",
        positionCode: "GURU_AKADEMIK",
        capability: "health.record.create",
        scopeType: "ASSIGNED_UNITS",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "class-7a" },
        expectedDecision: "DENY",
        expectedReasonCode: "CAPABILITY_NOT_GRANTED",
      },
      {
        id: 14,
        name: "PH - Halaqoh View (Allowed)",
        role: "PH",
        positionCode: "PEMBINA_HALAQOH",
        capability: "tahfizh.monitoring.view",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { halaqohId: "hlq-1" },
        resolvedContext: { orgUnitIds: ["unit-tahfizh"], halaqohId: "hlq-1", assignedHalaqohIds: ["hlq-1"] },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 15,
        name: "OSDA - Generic OSDA Health Access (Denied)",
        role: "OSDA",
        positionCode: "ANGGOTA_OSDA",
        capability: "health.record.view_scoped",
        scopeType: "UNIT",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-osda" },
        expectedDecision: "DENY",
        expectedReasonCode: "CAPABILITY_NOT_GRANTED",
      },
      {
        id: 16,
        name: "WS - Own Child View (Allowed)",
        role: "WS",
        positionCode: "WALI_SANTRI",
        capability: "santri.rapor.view",
        scopeType: "OWN_CHILD",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { santriId: "san-child-1" },
        resolvedContext: { orgUnitIds: ["unit-portal"], santriId: "san-child-1", guardianLinkedSantriIds: ["san-child-1"] },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 17,
        name: "WS - Other Child View (Denied)",
        role: "WS",
        positionCode: "WALI_SANTRI",
        capability: "santri.rapor.view",
        scopeType: "OWN_CHILD",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { santriId: "san-other-2" },
        resolvedContext: { orgUnitIds: ["unit-portal"], santriId: "san-other-2", guardianLinkedSantriIds: ["san-child-1"] },
        expectedDecision: "DENY",
        expectedReasonCode: "SCOPE_MISMATCH",
      },
      {
        id: 18,
        name: "ST - Self Profile Read (Allowed)",
        role: "ST",
        positionCode: "SANTRI",
        capability: "santri.profile.view",
        scopeType: "SELF",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { targetUserId: "usr-sc-18" },
        resolvedContext: { orgUnitIds: ["unit-portal"], targetUserId: "usr-sc-18" },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 19,
        name: "ST - Other Santri Profile Mutation (Denied)",
        role: "ST",
        positionCode: "SANTRI",
        capability: "santri.profile.edit",
        scopeType: "SELF",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { targetUserId: "usr-sc-other" },
        resolvedContext: { orgUnitIds: ["unit-portal"], targetUserId: "usr-sc-other" },
        expectedDecision: "DENY",
        expectedReasonCode: "SCOPE_MISMATCH",
      },
      {
        id: 20,
        name: "Unit Account Kiosk - Read Info without Human Executor (Allowed)",
        role: "OSDA",
        positionCode: "ANGGOTA_OSDA",
        capability: "keasramaan.presensi.view",
        scopeType: "UNIT",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-kios" },
        resolvedContext: { orgUnitIds: ["unit-kios"] },
        expectedDecision: "ALLOW",
        expectedReasonCode: "ALLOWED",
      },
      {
        id: 21,
        name: "Cross-Gender Complex Boundary Violation (Denied)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { unitId: "unit-putri" },
        resolvedContext: { orgUnitIds: ["unit-putri"], genderComplex: "PUTRI", halaqohId: "hlq-1", assignedHalaqohIds: ["hlq-1"] },
        expectedDecision: "DENY",
        expectedReasonCode: "GENDER_COMPLEX_DENIED",
      },
      {
        id: 22,
        name: "Draft Assignment Status (Denied)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "DRAFT", // Inactive assignment
        resourceContext: { halaqohId: "hlq-1" },
        resolvedContext: { orgUnitIds: ["unit-thf"], halaqohId: "hlq-1", assignedHalaqohIds: ["hlq-1"] },
        expectedDecision: "DENY",
        expectedReasonCode: "NO_ACTIVE_ASSIGNMENTS",
      },
      {
        id: 23,
        name: "Unverified Rule State PROPOSED_TBD (Denied)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        ruleState: "PROPOSED_TBD", // Unverified rule
        assignmentStatus: "ACTIVE",
        resourceContext: { halaqohId: "hlq-1" },
        resolvedContext: { orgUnitIds: ["unit-thf"], halaqohId: "hlq-1", assignedHalaqohIds: ["hlq-1"] },
        expectedDecision: "DENY",
        expectedReasonCode: "CAPABILITY_NOT_GRANTED",
      },
      {
        id: 24,
        name: "Database Failure on Assignment Query (Returns ERROR / DATABASE_UNAVAILABLE)",
        role: "MT",
        positionCode: "MUSYRIF_TAHFIZH",
        capability: "tahfizh.setoran.create",
        scopeType: "HALAQOH",
        ruleState: "VERIFIED_PRODUCTION",
        assignmentStatus: "ACTIVE",
        resourceContext: { halaqohId: "hlq-1" },
        expectedDecision: "ERROR",
        expectedReasonCode: "DATABASE_UNAVAILABLE",
      },
    ];

    for (const sc of scenarios) {
      it(`Scenario #${sc.id}: ${sc.name} -> ${sc.expectedDecision} (${sc.expectedReasonCode})`, async () => {
        const userId = `usr-sc-${sc.id}`;
        const unitId = sc.resourceContext.unitId || (sc.scopeType === "HALAQOH" ? sc.resourceContext.halaqohId : undefined) || "unit-anchor";

        // Build mock assignment unless scenario 24 (error) or capability not assigned
        const hasCapability = !["MT - Reward Issue (Denied)", "ADM - Health Record Update Status (Denied)", "GA - Health Record Create (Denied)", "OSDA - Generic OSDA Health Access (Denied)", "Kabid Tahfizh - Reward Policy Edit (Denied)"].includes(sc.name);

        let domain: OrgDomain = "INSTITUTIONAL";
        if (["KABID_TAHFIZH", "MUSYRIF_TAHFIZH", "PEMBINA_HALAQOH"].includes(sc.positionCode)) {
          domain = "TAHFIZH";
        } else if (["KEPALA_KEASRAMAAN", "MUDABBIR", "PETUGAS_PRESENSI", "ANGGOTA_OSDA"].includes(sc.positionCode)) {
          domain = "KEASRAMAAN";
        } else if (["GURU_AKADEMIK"].includes(sc.positionCode)) {
          domain = "AKADEMIK";
        } else if (["STAF_ADMIN_TU"].includes(sc.positionCode)) {
          domain = "MANAJEMEN";
        }

        const assignment: CanonicalAssignmentWithDetails = {
          id: `asg-sc-${sc.id}`,
          userId,
          positionId: `pos-${sc.positionCode}`,
          positionCode: sc.positionCode,
          positionName: sc.positionCode,
          domain,
          unitId,
          unitCode: "ANC",
          unitName: "Anchor Unit",
          unitGenderComplex: sc.id === 21 ? "PUTRA" : undefined,
          status: sc.assignmentStatus,
          validFrom: new Date(0),
          validUntil: null,
          positionCapabilities: hasCapability
            ? [
                {
                  capabilityCode: sc.capability,
                  scopeType: sc.scopeType,
                  businessRuleState: sc.ruleState,
                },
              ]
            : [],
          scopeUnits: sc.scopeType === "ASSIGNED_UNITS" ? [{ unitId: "class-7a", unitCode: "7A" }] : [],
        };

        const provider: ICanonicalDataProvider = {
          async getIdentity() {
            return {
              userId,
              username: `user.${sc.id}`,
              status: "AKTIF",
              accountType: sc.role === "OSDA" ? "UNIT" : "PERSONAL",
            };
          },
          async getActiveAssignments() {
            if (sc.id === 24) {
              throw new Error("Simulated DB connection failure");
            }
            return [assignment];
          },
          async getUnitAccountPlacement() {
            return { unitId: "unit-kios" };
          },
          async verifyHumanExecutor() {
            return null;
          },
          async resolveResourceContext() {
            return sc.resolvedContext || { orgUnitIds: [unitId] };
          },
        };

        const res = await authorizeCanonical({
          identity: {
            userId,
            username: `user.${sc.id}`,
            status: "AKTIF",
            accountType: sc.role === "OSDA" ? "UNIT" : "PERSONAL",
          },
          capability: sc.capability,
          resourceContext: sc.resourceContext,
          resolvedContext: sc.resolvedContext,
          dataProvider: provider,
        });

        assert.strictEqual(
          res.decision,
          sc.expectedDecision,
          `Decision mismatch in Scenario ${sc.id}: expected ${sc.expectedDecision}, got ${res.decision} (${res.reason})`
        );
        assert.strictEqual(
          res.reasonCode,
          sc.expectedReasonCode,
          `ReasonCode mismatch in Scenario ${sc.id}: expected ${sc.expectedReasonCode}, got ${res.reasonCode}`
        );
      });
    }
  });

  // =========================================================================
  // 11. Legacy Invariants & Runtime Safety
  // =========================================================================
  describe("11. Legacy Invariants & Runtime Safety", () => {
    it("11.1. legacy runtime authorization remains 100% authoritative and untouched", () => {
      const rootDir = path.resolve(__dirname, "..");
      const actionsDir = path.join(rootDir, "app/actions");
      const actionFiles = fs.readdirSync(actionsDir);

      for (const file of actionFiles) {
        if (!file.endsWith(".ts")) continue;
        const content = fs.readFileSync(path.join(actionsDir, file), "utf-8");
        // Server actions must not rely on canonical tables for live access yet
        assert.strictEqual(
          content.includes("prisma.assignment.find"),
          false,
          `Action ${file} must NOT query prisma.assignment yet (Phase 2 runs in shadow mode)`
        );
      }
    });

    it("11.2. canonical authorization engine code is isolated under lib/auth", () => {
      const rootDir = path.resolve(__dirname, "..");
      const authDir = path.join(rootDir, "lib/auth");
      assert.ok(fs.existsSync(authDir), "lib/auth directory must exist");
      const files = fs.readdirSync(authDir);
      assert.ok(files.includes("compatibility.ts"));
      assert.ok(files.includes("scope-evaluator.ts"));
      assert.ok(files.includes("canonical-evaluator.ts"));
      assert.ok(files.includes("unit-account.ts"));
      assert.ok(files.includes("canonical-audit.ts"));
      assert.ok(files.includes("shadow-engine.ts"));
      assert.ok(files.includes("backfill-dry-run.ts"));
    });
  });
});
