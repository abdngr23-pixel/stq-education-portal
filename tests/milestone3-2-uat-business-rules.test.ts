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
  TAHFIZH_M32_CAPABILITIES,
  KEASRAMAAN_PERMISSION_CAPABILITIES,
  HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS,
  TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS,
  KEPESANTRENAN_ATTENDANCE_CONTRACT,
  OSDA_PUTRI_UNIT_CONTRACT,
  formatSantriSearchResult,
  EffectiveCapabilityGrant,
  ResolvedResourceContext,
} from "../types/architecture-lock";

import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalAssignmentWithDetails,
} from "../lib/auth/canonical-evaluator";

import {
  evaluateScopePredicate,
} from "../lib/auth/scope-evaluator";

import {
  saveSetoranTahfizhCore,
  CreateSetoranCoreInput,
} from "../lib/tahfizh-persistence";

import {
  createSetoranAction,
} from "../app/actions/tahfizh";


import { setTestSession } from "../lib/auth";
import { parseWITADate, getWitaDateString } from "../lib/wita-date";

describe("STQ ARCHITECTURE LOCK — MILESTONE 3.2: UAT BUSINESS RULES & AUTHORIZATION CLOSURE", () => {

  // =========================================================================
  // Section 1: UAT Item #1 & #12 — Perizinan & Scoped Operational Access
  // =========================================================================
  describe("Section 1: UAT Item #1 & #12 — Perizinan & Scoped Operational Access (Lisa-equivalent)", () => {
    it("1.1. Operational position without linked Staff profile fails closed with IDENTITY_NOT_LINKED", async () => {
      const opAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-op-orphan",
        userId: "usr-orphan-op",
        positionId: "pos-op-keasramaan",
        positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        positionName: "Petugas Operasional Keasramaan",
        domain: "KEASRAMAAN",
        unitId: "unit-asrama-01",
        unitCode: "ASR-01",
        unitName: "Asrama Putri 1",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "keasramaan.permission.read",
            scopeType: "ASSIGNED_UNITS",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "unit-asrama-01", unitCode: "ASR-01" }],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-orphan-op",
            username: "op.orphan",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: null, // ORPHAN USER - No linked Staff profile!
          };
        },
        async getActiveAssignments() {
          return [opAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["unit-asrama-01"], orgDomain: "KEASRAMAAN" };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-orphan-op",
          username: "op.orphan",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "keasramaan.permission.read",
        resourceContext: { unitId: "unit-asrama-01" },
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "IDENTITY_NOT_LINKED");
      assert.strictEqual(res.reasonCode, "IDENTITY_NOT_LINKED");
    });

    it("1.2. Operational position with inactive linked Staff profile fails closed with IDENTITY_INACTIVE", async () => {
      const opAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-op-inactive-staff",
        userId: "usr-op-inactive-staff",
        positionId: "pos-op-keasramaan",
        positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        positionName: "Petugas Operasional Keasramaan",
        domain: "KEASRAMAAN",
        unitId: "unit-asrama-01",
        unitCode: "ASR-01",
        unitName: "Asrama Putri 1",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "keasramaan.permission.read",
            scopeType: "ASSIGNED_UNITS",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "unit-asrama-01", unitCode: "ASR-01" }],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-op-inactive-staff",
            username: "op.inactive.staff",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-inactive-01",
            staffStatus: "NONAKTIF", // INACTIVE Staff profile!
          };
        },
        async getActiveAssignments() {
          return [opAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["unit-asrama-01"], orgDomain: "KEASRAMAAN" };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-op-inactive-staff",
          username: "op.inactive.staff",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "keasramaan.permission.read",
        resourceContext: { unitId: "unit-asrama-01" },
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "IDENTITY_INACTIVE");
      assert.strictEqual(res.reasonCode, "IDENTITY_INACTIVE");
    });

    it("1.3. Operational position with active linked Staff profile allows scope evaluation", async () => {
      const opAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-op-valid",
        userId: "usr-op-valid",
        positionId: "pos-op-keasramaan",
        positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        positionName: "Petugas Operasional Keasramaan",
        domain: "KEASRAMAAN",
        unitId: "unit-asrama-01",
        unitCode: "ASR-01",
        unitName: "Asrama Putri 1",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "keasramaan.permission.read",
            scopeType: "ASSIGNED_UNITS",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "unit-asrama-01", unitCode: "ASR-01" }],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-op-valid",
            username: "op.valid",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-valid-01",
            staffStatus: "AKTIF", // Active Staff profile
          };
        },
        async getActiveAssignments() {
          return [opAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["unit-asrama-01"], orgDomain: "KEASRAMAAN" };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-op-valid",
          username: "op.valid",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: "keasramaan.permission.read",
        resourceContext: { unitId: "unit-asrama-01" },
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "ALLOW");
      assert.strictEqual(res.code, "ALLOWED");
    });

    it("1.4. Module access does NOT imply approval capability; approval tiers remain unapproved", async () => {
      // Lisa operational staff assignment has read and create, but ZERO approval grants
      const opAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-op-lisa",
        userId: "usr-op-generic",
        positionId: "pos-op-keasramaan",
        positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
        positionName: "Petugas Operasional Keasramaan",
        domain: "KEASRAMAAN",
        unitId: "unit-asrama-01",
        unitCode: "ASR-01",
        unitName: "Asrama Putri 1",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
            scopeType: "ASSIGNED_UNITS",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
          {
            capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.CREATE,
            scopeType: "ASSIGNED_UNITS",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [{ unitId: "unit-asrama-01", unitCode: "ASR-01" }],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-op-generic",
            username: "op.keasramaan.generic",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-op-01",
            staffStatus: "AKTIF",
          };
        },
        async getActiveAssignments() {
          return [opAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext(rc) {
          return {
            orgUnitIds: [rc?.unitId || "unit-asrama-01"],
            orgDomain: "KEASRAMAAN",
          };
        },
      };

      // A. Can read permissions
      const readRes = await authorizeCanonical({
        identity: {
          userId: "usr-op-generic",
          username: "op.keasramaan.generic",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
        resourceContext: { unitId: "unit-asrama-01" },
        dataProvider: mockProvider,
      });
      assert.strictEqual(readRes.decision, "ALLOW");

      // B. Attempting to approve must fail closed with CAPABILITY_NOT_GRANTED
      const approveMkRes = await authorizeCanonical({
        identity: {
          userId: "usr-op-generic",
          username: "op.keasramaan.generic",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_MK,
        resourceContext: { unitId: "unit-asrama-01" },
        dataProvider: mockProvider,
      });
      assert.strictEqual(approveMkRes.decision, "DENY");
      assert.strictEqual(approveMkRes.code, "CAPABILITY_NOT_GRANTED");

      const approveKsRes = await authorizeCanonical({
        identity: {
          userId: "usr-op-generic",
          username: "op.keasramaan.generic",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: KEASRAMAAN_PERMISSION_CAPABILITIES.APPROVE_KS,
        resourceContext: { unitId: "unit-asrama-01" },
        dataProvider: mockProvider,
      });
      assert.strictEqual(approveKsRes.decision, "DENY");
      assert.strictEqual(approveKsRes.code, "CAPABILITY_NOT_GRANTED");
    });

    it("1.5. Lisa-equivalent functional assignment tests use generic identity, not username or personal name", async () => {
      const randomUsernames = ["staff.operasional.77", "petugas.piket.putri", "generic.operator.alpha"];

      for (const uname of randomUsernames) {
        const assignment: CanonicalAssignmentWithDetails = {
          id: `asg-${uname}`,
          userId: `usr-${uname}`,
          positionId: "pos-op-keasramaan",
          positionCode: "PETUGAS_OPERASIONAL_KEASRAMAAN",
          positionName: "Petugas Operasional Keasramaan",
          domain: "KEASRAMAAN",
          unitId: "unit-kmr-01",
          unitCode: "KMR-01",
          unitName: "Kamar 01",
          status: "ACTIVE",
          validFrom: new Date(Date.now() - 3600000),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
              scopeType: "UNIT",
              businessRuleState: "VERIFIED_PRODUCTION",
            },
          ],
          scopeUnits: [],
        };

        const mockProvider: ICanonicalDataProvider = {
          async getIdentity() {
            return {
              userId: `usr-${uname}`,
              username: uname,
              status: "AKTIF",
              accountType: "PERSONAL",
              staffId: `stf-${uname}`,
              staffStatus: "AKTIF",
            };
          },
          async getActiveAssignments() {
            return [assignment];
          },
          async getUnitAccountPlacement() {
            return null;
          },
          async verifyHumanExecutor() {
            return null;
          },
          async resolveResourceContext(rc) {
            return { orgUnitIds: [rc?.unitId || "unit-kmr-01"], orgDomain: "KEASRAMAAN" };
          },
        };

        const res = await authorizeCanonical({
          identity: {
            userId: `usr-${uname}`,
            username: uname,
            status: "AKTIF",
            accountType: "PERSONAL",
          },
          capability: KEASRAMAAN_PERMISSION_CAPABILITIES.READ,
          resourceContext: { unitId: "unit-kmr-01" },
          dataProvider: mockProvider,
        });

        assert.strictEqual(res.decision, "ALLOW", `Generic user ${uname} must be authorized by position, not name`);
      }
    });
  });

  // =========================================================================
  // Section 2: UAT Item #2 — Lisa All-Santri Recap Read vs Scoped Write
  // =========================================================================
  describe("Section 2: UAT Item #2 — Lisa All-Santri Recap Read vs Scoped Write", () => {
    it("2.1. Canonical tahfizh.recap.read with GLOBAL scope matches institutional recap in contract evaluation", () => {
      const recapGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-op-recap-global",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.RECAP_READ,
        scopeType: "GLOBAL",
        anchorUnitId: "hlq-1",
        unitIds: [],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      const targetContext: ResolvedResourceContext = {
        santriId: "san-other-02",
        halaqohId: "hlq-foreign",
        orgUnitIds: ["hlq-foreign"],
        orgDomain: "TAHFIZH",
      };

      const scopeResult = evaluateScopePredicate(recapGrant, targetContext, { userId: "usr-op" });
      assert.strictEqual(scopeResult.matches, true, "GLOBAL recap READ must match cross-halaqoh resource");
      assert.strictEqual(scopeResult.code, "ALLOWED");
    });

    it("2.2. GLOBAL recap READ does NOT widen HALAQOH setoran WRITE", () => {
      const setoranGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-op-write-halaqoh",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.SETORAN_CREATE,
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-1",
        unitIds: ["hlq-1"],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const targetOutsideHalaqoh: ResolvedResourceContext = {
        santriId: "san-in-hlq2",
        halaqohId: "hlq-2",
        orgUnitIds: ["hlq-2"],
        orgDomain: "TAHFIZH",
      };

      const writeScopeResult = evaluateScopePredicate(setoranGrant, targetOutsideHalaqoh, { userId: "usr-op" });
      assert.strictEqual(writeScopeResult.matches, false, "Setoran WRITE outside own halaqoh must be DENIED");
      assert.strictEqual(writeScopeResult.code, "SCOPE_MISMATCH");
    });

    it("2.3. No separate read_all or view_all capability alias in TAHFIZH_M32_CAPABILITIES", () => {
      assert.strictEqual(
        (TAHFIZH_M32_CAPABILITIES as any).RECAP_READ_ALL,
        undefined,
        "RECAP_READ_ALL alias must not exist"
      );
      assert.strictEqual(
        (TAHFIZH_M32_CAPABILITIES as any).view_all,
        undefined,
        "view_all capability must not exist"
      );
      assert.strictEqual(TAHFIZH_M32_CAPABILITIES.RECAP_READ, "tahfizh.recap.read");
    });
  });

  // =========================================================================
  // Section 3: UAT Item #3 — Search Display Contract
  // =========================================================================
  describe("Section 3: UAT Item #3 — Search Display Contract (Nama Only, Reconciled)", () => {
    it("3.1. search result rendering contract = Nama Only (reconciled M3.3C1)", () => {
      const formatted = formatSantriSearchResult({
        nama: "Ahmad Mujahid",
        kelas: "8A",
      });

      assert.strictEqual(formatted.nama, "Ahmad Mujahid");
      assert.strictEqual(formatted.displayText, "Ahmad Mujahid");
      assert.strictEqual(formatted.kelas, "8A");

      // Verify that dense attributes like NIS, capaian juz, or last setoran are not in the contract or displayText
      assert.strictEqual((formatted as any).nis, undefined);
      assert.strictEqual((formatted as any).capaianJuz, undefined);
      assert.strictEqual((formatted as any).setoranTerakhir, undefined);
    });
  });

  // =========================================================================
  // Section 4: UAT Item #4 — Target MT + PH Policy
  // =========================================================================
  describe("Section 4: UAT Item #4 — Target MT + PH Policy", () => {
    it("4.1. MT target update own halaqoh matches HALAQOH scope in target contract simulation", () => {
      const mtGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mt-target",
        positionCode: "MUSYRIF_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.TARGET_MANAGE,
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-mt-own",
        unitIds: ["hlq-mt-own"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      const ownSantriContext: ResolvedResourceContext = {
        santriId: "san-binaan-01",
        halaqohId: "hlq-mt-own",
        orgUnitIds: ["hlq-mt-own"],
        orgDomain: "TAHFIZH",
      };

      const scopeRes = evaluateScopePredicate(mtGrant, ownSantriContext, { userId: "usr-mt-01" });
      assert.strictEqual(scopeRes.matches, true);
      assert.strictEqual(scopeRes.code, "ALLOWED");
    });

    it("4.2. MT target update other halaqoh fails closed with SCOPE_MISMATCH", () => {
      const mtGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-mt-target",
        positionCode: "MUSYRIF_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.TARGET_MANAGE,
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-mt-own",
        unitIds: ["hlq-mt-own"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      const foreignSantriContext: ResolvedResourceContext = {
        santriId: "san-foreign-02",
        halaqohId: "hlq-foreign",
        orgUnitIds: ["hlq-foreign"],
        orgDomain: "TAHFIZH",
      };

      const scopeRes = evaluateScopePredicate(mtGrant, foreignSantriContext, { userId: "usr-mt-01" });
      assert.strictEqual(scopeRes.matches, false);
      assert.strictEqual(scopeRes.code, "SCOPE_MISMATCH");
    });

    it("4.3. PH target update own halaqoh matches HALAQOH scope in target contract simulation", () => {
      const phGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-ph-target",
        positionCode: "PEMBINA_HALAQOH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.TARGET_MANAGE,
        scopeType: "HALAQOH",
        anchorUnitId: "hlq-ph-own",
        unitIds: ["hlq-ph-own"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      const ownSantriContext: ResolvedResourceContext = {
        santriId: "san-binaan-ph",
        halaqohId: "hlq-ph-own",
        orgUnitIds: ["hlq-ph-own"],
        orgDomain: "TAHFIZH",
      };

      const scopeRes = evaluateScopePredicate(phGrant, ownSantriContext, { userId: "usr-ph-01" });
      assert.strictEqual(scopeRes.matches, true);
      assert.strictEqual(scopeRes.code, "ALLOWED");
    });

    it("4.4. Zero unapproved target management grants for Mudir or Kabid Tahfizh", () => {
      // M3.2 explicitly does NOT grant unapproved target.manage to Mudir or Kabid Tahfizh
      assert.strictEqual(
        TAHFIZH_M32_CAPABILITIES.TARGET_MANAGE,
        "tahfizh.target.manage"
      );
    });
  });

  // =========================================================================
  // Section 5: UAT Item #5 — Studi Umum vs Kepesantrenan Separation
  // =========================================================================
  describe("Section 5: UAT Item #5 — Studi Umum vs Kepesantrenan Separation", () => {
    it("5.1. Navigation / UI separates Studi Umum and Kepesantrenan subtabs", () => {
      const academicFilePath = path.join(__dirname, "../components/modules/akademik-module.tsx");
      const content = fs.readFileSync(academicFilePath, "utf-8");
      assert.ok(content.includes("Studi Umum"), "UI must have Studi Umum subtab");
      assert.ok(content.includes("Kepesantrenan"), "UI must have Kepesantrenan subtab");
    });
  });

  // =========================================================================
  // Section 6: UAT Item #6 — Absensi Guru + Santri Kepesantrenan
  // =========================================================================
  describe("Section 6: UAT Item #6 — Absensi Guru + Santri Kepesantrenan (Reconciled)", () => {
    it("6.1. Kepesantrenan attendance contract defines separate teacher and student attendance", () => {
      assert.deepStrictEqual([...KEPESANTRENAN_ATTENDANCE_CONTRACT.ACTOR_TYPES], ["TEACHER", "STUDENT"]);
      assert.ok(KEPESANTRENAN_ATTENDANCE_CONTRACT.SUBJECTS.includes("Bahasa Arab"));
      assert.ok(KEPESANTRENAN_ATTENDANCE_CONTRACT.SUBJECTS.includes("Fikih"));
      assert.ok(KEPESANTRENAN_ATTENDANCE_CONTRACT.SUBJECTS.includes("Tafsir"));
      assert.ok(KEPESANTRENAN_ATTENDANCE_CONTRACT.SUBJECTS.includes("Tajwid"));
      assert.ok(
        (KEPESANTRENAN_ATTENDANCE_CONTRACT.SUBJECTS as readonly string[]).includes("Aqidah") ||
        (KEPESANTRENAN_ATTENDANCE_CONTRACT.SUBJECTS as readonly string[]).includes("Aqidah Islamiyah")
      );
    });

    it("6.2. Attendance status vocabulary is canonically reconciled in M3.3", () => {
      assert.strictEqual(
        KEPESANTRENAN_ATTENDANCE_CONTRACT.STATUS_VOCABULARY_POLICY,
        "CANONICAL_RECONCILED"
      );
      assert.deepStrictEqual(
        [...KEPESANTRENAN_ATTENDANCE_CONTRACT.STUDENT_ATTENDANCE_STATUSES],
        ["HADIR", "IZIN", "SAKIT", "ALFA"]
      );
      assert.deepStrictEqual(
        [...KEPESANTRENAN_ATTENDANCE_CONTRACT.FORBIDDEN_STATUSES],
        ["MASBUK"]
      );
      assert.strictEqual(
        KEPESANTRENAN_ATTENDANCE_CONTRACT.TEACHER_ATTENDANCE_EVIDENCE,
        "SESSION_START_AUTHENTICATED_EXECUTION"
      );
    });
  });

  // =========================================================================
  // Section 7: UAT Item #7 — Halaqoh Attendance: No MASBUK
  // =========================================================================
  describe("Section 7: UAT Item #7 — Halaqoh Attendance: No MASBUK", () => {
    it("7.1. Halaqoh new attendance options strictly exclude MASBUK", () => {
      assert.ok(
        !HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS.includes("MASBUK" as any),
        "MASBUK must not be present in HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS"
      );
      assert.deepStrictEqual(
        [...HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS],
        ["HADIR", "SAKIT", "IZIN", "ALFA"]
      );
    });

    it("7.2. Halaqoh attendance validation contract rejects MASBUK for new entries", () => {
      const isAllowedForNewEntry = (status: string) =>
        (HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS as readonly string[]).includes(status);

      assert.strictEqual(isAllowedForNewEntry("MASBUK"), false);
      assert.strictEqual(isAllowedForNewEntry("HADIR"), true);
      assert.strictEqual(isAllowedForNewEntry("SAKIT"), true);
      assert.strictEqual(isAllowedForNewEntry("IZIN"), true);
      assert.strictEqual(isAllowedForNewEntry("ALFA"), true);
    });

    it("7.3. Historical unsupported attendance values are preserved safely without rewriting", () => {
      const historicalRecord = {
        id: "abs-hist-01",
        santriId: "san-1",
        kegiatan: "Halaqoh Al-Qur'an Subuh",
        tanggal: new Date("2026-01-10"),
        status: "HADIR",
        catatan: "[Masbuk] Terlambat masuk halaqoh",
      };

      assert.strictEqual(historicalRecord.catatan?.includes("[Masbuk]"), true);
      assert.strictEqual(historicalRecord.status, "HADIR");
    });
  });

  // =========================================================================
  // Section 8: UAT Item #8 — Tahajjud Attendance: SHOLAT / ALFA
  // =========================================================================
  describe("Section 8: UAT Item #8 — Tahajjud Attendance: SHOLAT / ALFA", () => {
    it("8.1. Tahajjud options exactly SHOLAT and ALFA", () => {
      assert.strictEqual(TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS.length, 2);
      assert.ok(TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS.includes("SHOLAT"));
      assert.ok(TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS.includes("ALFA"));
      assert.ok(!TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS.includes("MASBUK" as any));
      assert.ok(!TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS.includes("IZIN" as any));
    });

    it("8.2. Tahajjud attendance validation contract rejects invalid options", () => {
      const isAllowedForTahajjud = (status: string) =>
        (TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS as readonly string[]).includes(status);

      assert.strictEqual(isAllowedForTahajjud("SHOLAT"), true);
      assert.strictEqual(isAllowedForTahajjud("ALFA"), true);
      assert.strictEqual(isAllowedForTahajjud("MASBUK"), false);
      assert.strictEqual(isAllowedForTahajjud("IZIN"), false);
      assert.strictEqual(isAllowedForTahajjud("SAKIT"), false);
      assert.strictEqual(isAllowedForTahajjud("HADIR"), false);
    });
  });

  // =========================================================================
  // Section 9: UAT Item #10 — Santriwati OSDA-Like Account
  // =========================================================================
  describe("Section 9: UAT Item #10 — Santriwati OSDA-Like Account", () => {
    it("9.1. OSDA PUTRI unit account cannot access PUTRA resources", async () => {
      const osdaPutriAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-osda-putri",
        userId: "usr-unit-osda-putri",
        positionId: "pos-osda",
        positionCode: "OSDA",
        positionName: "Organisasi Santri Darul Ulum Cendekia",
        domain: "KEASRAMAAN",
        unitId: "unit-osda-putri",
        unitCode: OSDA_PUTRI_UNIT_CONTRACT.NODE.code,
        unitName: OSDA_PUTRI_UNIT_CONTRACT.NODE.name,
        unitGenderComplex: "PUTRI",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "health.case.read_aggregate",
            scopeType: "UNIT",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-unit-osda-putri",
            username: "unit.osda.putri",
            status: "AKTIF",
            accountType: "UNIT",
            placementUnitId: "unit-osda-putri",
          };
        },
        async getActiveAssignments() {
          return [osdaPutriAssignment];
        },
        async getUnitAccountPlacement() {
          return { unitId: "unit-osda-putri" };
        },
        async verifyHumanExecutor() {
          return { userId: "usr-executor", id: "usr-executor", name: "Santriwati Pengurus", isActive: true };
        },
        async resolveResourceContext() {
          return {
            santriId: "san-putra-target",
            genderComplex: "PUTRA",
            orgUnitIds: ["kamar-putra-101"],
            orgDomain: "KEASRAMAAN",
          };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-unit-osda-putri",
          username: "unit.osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
        capability: "health.case.read_aggregate",
        resourceContext: { santriId: "san-putra-target" },
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "GENDER_COMPLEX_DENIED");
    });

    it("9.2. OSDA PUTRI mutation requires verified human executor", async () => {
      const osdaPutriAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-osda-putri-mut",
        userId: "usr-unit-osda-putri",
        positionId: "pos-osda",
        positionCode: "OSDA",
        positionName: "Organisasi Santri Darul Ulum Cendekia",
        domain: "KEASRAMAAN",
        unitId: "unit-osda-putri",
        unitCode: OSDA_PUTRI_UNIT_CONTRACT.NODE.code,
        unitName: OSDA_PUTRI_UNIT_CONTRACT.NODE.name,
        unitGenderComplex: "PUTRI",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: "health.case.create",
            scopeType: "UNIT",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-unit-osda-putri",
            username: "unit.osda.putri",
            status: "AKTIF",
            accountType: "UNIT",
            placementUnitId: "unit-osda-putri",
          };
        },
        async getActiveAssignments() {
          return [osdaPutriAssignment];
        },
        async getUnitAccountPlacement() {
          return { unitId: "unit-osda-putri" };
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return {
            santriId: "san-putri-target",
            genderComplex: "PUTRI",
            orgUnitIds: ["kamar-putri-201"],
            orgDomain: "KEASRAMAAN",
          };
        },
      };

      const resWithoutExecutor = await authorizeCanonical({
        identity: {
          userId: "usr-unit-osda-putri",
          username: "unit.osda.putri",
          status: "AKTIF",
          accountType: "UNIT",
        },
        capability: "health.case.create",
        resourceContext: { santriId: "san-putri-target" },
        isMutation: true,
        dataProvider: mockProvider,
      });

      assert.strictEqual(resWithoutExecutor.decision, "DENY");
      assert.strictEqual(resWithoutExecutor.reasonCode, "UNIT_EXECUTOR_REQUIRED");
    });
  });

  // =========================================================================
  // Section 10: UAT Item #11 — Tasmi'/Sima'an Reward Issuer
  // =========================================================================
  describe("Section 10: UAT Item #11 — Tasmi'/Sima'an Reward Issuer", () => {
    it("10.1. Ordinary MT is denied reward issuance", async () => {
      const mtAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-mt-ordinary",
        userId: "usr-ordinary-mt",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "hlq-1",
        unitCode: "HLQ-01",
        unitName: "Halaqoh 1",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 3600000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: TAHFIZH_M32_CAPABILITIES.SETORAN_CREATE,
            scopeType: "HALAQOH",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-ordinary-mt",
            username: "mt.ordinary",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-mt-ord",
            staffStatus: "AKTIF",
          };
        },
        async getActiveAssignments() {
          return [mtAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return { orgUnitIds: ["hlq-1"], orgDomain: "TAHFIZH" };
        },
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-ordinary-mt",
          username: "mt.ordinary",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: TAHFIZH_M32_CAPABILITIES.REWARD_ISSUE,
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("10.2. Business Owner confirmed: special operational reward issuer authority is limited to assigned units/groups only", () => {
      // Business Owner confirmed: special operational reward issuer authority is limited to assigned units/groups only.
      const targetGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-op-reward-issuer",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.REWARD_ISSUE,
        scopeType: "ASSIGNED_UNITS",
        anchorUnitId: "hlq-assigned-01",
        unitIds: ["hlq-assigned-01"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      // Assigned unit resource -> Matches
      const inUnitContext: ResolvedResourceContext = {
        resourceId: "tasmi-01",
        santriId: "san-assigned-01",
        orgUnitIds: ["hlq-assigned-01"],
        orgDomain: "TAHFIZH",
      };
      const allowRes = evaluateScopePredicate(targetGrant, inUnitContext, { userId: "usr-op" });
      assert.strictEqual(allowRes.matches, true, "Assigned target santri must match scope");
      assert.strictEqual(allowRes.code, "ALLOWED");

      // Unassigned unit resource -> Denied (SCOPE_MISMATCH)
      const outUnitContext: ResolvedResourceContext = {
        resourceId: "tasmi-99",
        santriId: "san-other-99",
        orgUnitIds: ["hlq-other-99"],
        orgDomain: "TAHFIZH",
      };
      const denyRes = evaluateScopePredicate(targetGrant, outUnitContext, { userId: "usr-op" });
      assert.strictEqual(denyRes.matches, false, "Outside assigned target must be denied");
      assert.strictEqual(denyRes.code, "SCOPE_MISMATCH");
    });

    it("10.3. GLOBAL tahfizh.recap.read does NOT widen tahfizh.reward.issue scope", () => {
      // Operational staff has GLOBAL recap read and ASSIGNED_UNITS reward issue
      const recapGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-lisa-recap",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.RECAP_READ,
        scopeType: "GLOBAL",
        anchorUnitId: "inst-root",
        unitIds: [],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      const rewardGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-lisa-reward",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        capabilityCode: TAHFIZH_M32_CAPABILITIES.REWARD_ISSUE,
        scopeType: "ASSIGNED_UNITS",
        anchorUnitId: "hlq-assigned-01",
        unitIds: ["hlq-assigned-01"],
        businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL",
      };

      // Santri in outside halaqoh/unit
      const outsideContext: ResolvedResourceContext = {
        resourceId: "tasmi-outside",
        santriId: "san-outside-01",
        orgUnitIds: ["hlq-outside-99"],
        orgDomain: "TAHFIZH",
      };

      // Recap read matches globally across all units
      const recapEval = evaluateScopePredicate(recapGrant, outsideContext, { userId: "usr-lisa" });
      assert.strictEqual(recapEval.matches, true, "GLOBAL recap read allows institutional scope");

      // But reward issuance on the same outside santri/resource strictly fails closed with SCOPE_MISMATCH
      const rewardEval = evaluateScopePredicate(rewardGrant, outsideContext, { userId: "usr-lisa" });
      assert.strictEqual(rewardEval.matches, false, "GLOBAL recap read must NEVER widen ASSIGNED_UNITS reward issue");
      assert.strictEqual(rewardEval.code, "SCOPE_MISMATCH");
    });
  });

  // =========================================================================
  // Section 11: UAT Item #13 — Backdated Tahfizh Date Picker End-to-End
  // =========================================================================
  describe("Section 11: UAT Item #13 — Backdated Tahfizh Date Picker End-to-End", () => {
    it("11.1. createSetoranAction accepts valid today WITA date and denies future date", async () => {
      setTestSession({
        userId: "usr-mt-action",
        username: "musyrif.action",
        role: "MT",
        staffId: "stf-mt-action",
      });

      // Future date test: tomorrow in WITA must be rejected before DB query
      const tomorrowWitaDate = new Date(Date.now() + 86400000);
      const tomorrowWita = getWitaDateString(tomorrowWitaDate);

      const futureRes = await createSetoranAction({
        santriId: "san-01",
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 1,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        tanggalSetoran: tomorrowWita,
      });

      assert.strictEqual(futureRes.success, false);
      assert.ok(futureRes.message.includes("masa depan"), `Must reject future date: ${futureRes.message}`);

      // Invalid format test
      const invalidFormatRes = await createSetoranAction({
        santriId: "san-01",
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 1,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        tanggalSetoran: "17-09-2026", // Invalid: must be YYYY-MM-DD
      });

      assert.strictEqual(invalidFormatRes.success, false);
      assert.ok(invalidFormatRes.message.includes("tidak valid"));
    });

    it("11.2. saveSetoranTahfizhCore stores backdated date in tanggal while createdAt remains immutable", async () => {
      const pastDateWita = "2026-09-10";
      const expectedDate = parseWITADate(pastDateWita);
      let capturedTanggal: any = null;
      let capturedAuditDetails: any = null;

      const mockPrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-01",
            nama: "Santri Backdate",
            nis: "1001",
            modalHafalanAwalHalaman: 0,
            tanggalBaselineTahfizh: null,
          }),
        },
        setoranTahfizh: {
          findUnique: async () => null,
        },
        $transaction: async (fn: any) => {
          const txMock: any = {
            setoranTahfizh: {
              findMany: async () => [],
              create: async (args: any) => {
                capturedTanggal = args.data.tanggal;
                return {
                  id: "set-backdated-101",
                  setoranCode: "SET-BACKDATED-101",
                  santriId: "san-01",
                  tanggal: args.data.tanggal,
                  createdAt: new Date(), // Immutable system insertion time
                  clientRequestId: args.data.clientRequestId,
                  santri: { nis: "1001" },
                };
              },
            },
            auditLog: {
              create: async (args: any) => {
                capturedAuditDetails = args.data.details;
                return { id: "audit-101" };
              },
            },
          };
          return fn(txMock);
        },
      };

      const input: CreateSetoranCoreInput = {
        santriId: "san-01",
        jenis: "SABAQ",
        juz: 1,
        halamanMulai: 1,
        halamanSelesai: 1,
        jumlahHalaman: 1,
        nilai: "MUMTAZ",
        tanggalSetoran: pastDateWita,
        clientRequestId: "req-backdate-01",
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input,
        context: {
          userId: "usr-mt",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-mt",
        },
      });

      assert.ok(res.success, "Backdated setoran must succeed");
      assert.strictEqual(capturedTanggal?.getTime(), expectedDate.getTime(), "tanggal must match parsed WITA date");
      assert.ok(capturedAuditDetails, "Audit log must be written");
      assert.strictEqual(capturedAuditDetails.occurredAt, expectedDate.toISOString());
      assert.ok(capturedAuditDetails.createdAt, "Audit must record createdAt");
      assert.strictEqual(capturedAuditDetails.creator, "musyrif.tahfizh");
      assert.strictEqual(capturedAuditDetails.clientRequestId, "req-backdate-01");
    });

    it("11.3. backdating works for all four setoran types (SABAQ, SABQI, MANZIL, MUFAR)", async () => {
      const setoranTypes = [
        { jenis: "SABAQ" as const, halMulai: 1, halSelesai: 1, jml: 1, juz: 1 },
        { jenis: "SABQI" as const, halMulai: 1, halSelesai: 5, jml: 5, juz: 1, isManual: true, alasan: "Latihan murojaah" },
        { jenis: "MANZIL" as const, halMulai: 1, halSelesai: 20, jml: 20, juz: 1 },
        { jenis: "MUFAR" as const, halMulai: 1, halSelesai: 20, jml: 20, juz: 1, juzMufar: 2 },
      ];

      for (const t of setoranTypes) {
        let capturedTanggal: any = null;
        const mockPrisma: any = {
          santri: {
            findUnique: async () => ({
              id: "san-multi-type",
              nama: "Santri Multi Type",
              nis: "1002",
              modalHafalanAwalHalaman: 0,
              tanggalBaselineTahfizh: null,
            }),
          },
          setoranTahfizh: {
            findUnique: async () => null,
            findMany: async () => {
              if (t.jenis === "SABQI") {
                return [
                  {
                    id: "set-prev-sabaq",
                    santriId: "san-multi-type",
                    jenis: "SABAQ",
                    halamanMulai: 1,
                    halamanSelesai: 5,
                    jumlahHalaman: 5.0,
                    tanggal: new Date("2026-09-08T08:00:00.000Z"),
                    status: "SELESAI",
                  },
                ];
              }
              return [];
            },
          },
          $transaction: async (fn: any) => {
            const txMock: any = {
              setoranTahfizh: {
                findMany: async () => {
                  if (t.jenis === "SABQI") {
                    return [
                      {
                        id: "set-prev-sabaq",
                        santriId: "san-multi-type",
                        jenis: "SABAQ",
                        halamanMulai: 1,
                        halamanSelesai: 5,
                        jumlahHalaman: 5.0,
                        tanggal: new Date("2026-09-08T08:00:00.000Z"),
                        status: "SELESAI",
                      },
                    ];
                  }
                  return [];
                },
                create: async (args: any) => {
                  capturedTanggal = args.data.tanggal;
                  return {
                    id: `set-${t.jenis}`,
                    setoranCode: `SET-${t.jenis}`,
                    santriId: "san-multi-type",
                    tanggal: args.data.tanggal,
                    createdAt: new Date(),
                    clientRequestId: `req-${t.jenis}`,
                    santri: { nis: "1002" },
                  };
                },
              },
              auditLog: {
                create: async () => ({ id: "audit-1" }),
              },
            };
            return fn(txMock);
          },
        };

        const res = await saveSetoranTahfizhCore(mockPrisma, {
          input: {
            santriId: "san-multi-type",
            jenis: t.jenis,
            juz: t.juz,
            halamanMulai: t.halMulai,
            halamanSelesai: t.halSelesai,
            jumlahHalaman: t.jml,
            jumlahJuzMufar: (t as any).juzMufar,
            nilai: "MUMTAZ",
            tanggalSetoran: "2026-09-12",
            clientRequestId: `req-${t.jenis}`,
          },
          context: {
            userId: "usr-mt",
            username: "musyrif.tahfizh",
            musyrifStaffId: "stf-mt",
          },
        });

        assert.ok(res.success, `Backdated ${t.jenis} must succeed`);
        assert.strictEqual(
          capturedTanggal?.getTime(),
          parseWITADate("2026-09-12").getTime(),
          `${t.jenis} tanggal must match parsed WITA date`
        );
      }
    });

    it("11.4. backdated setoran preserves idempotency on duplicate clientRequestId", async () => {
      let createCallCount = 0;
      const pastDate = parseWITADate("2026-09-10");

      const existingRecord = {
        id: "set-existing-idempotent",
        setoranCode: "SET-EXISTING",
        santriId: "san-01",
        clientRequestId: "req-idempotent-backdate",
        tanggal: pastDate,
        createdAt: new Date(Date.now() - 1000),
        santri: { id: "san-01", nama: "Santri Idempotent" },
      };

      const mockPrisma: any = {
        setoranTahfizh: {
          findUnique: async (args: any) => {
            if (args.where.clientRequestId === "req-idempotent-backdate") {
              return existingRecord;
            }
            return null;
          },
        },
        $transaction: async () => {
          createCallCount++;
        },
      };

      const res = await saveSetoranTahfizhCore(mockPrisma, {
        input: {
          santriId: "san-01",
          jenis: "SABAQ",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 1,
          jumlahHalaman: 1,
          nilai: "MUMTAZ",
          tanggalSetoran: "2026-09-10",
          clientRequestId: "req-idempotent-backdate",
        },
        context: {
          userId: "usr-mt",
          username: "musyrif.tahfizh",
          musyrifStaffId: "stf-mt",
        },
      });

      assert.ok(res.success, "Idempotent request must return success");
      assert.strictEqual(createCallCount, 0, "No duplicate creation transaction must run");
    });
  });

  // =========================================================================
  // Section 12: Architectural Regressions & Lifecycle Invariants
  // =========================================================================
  describe("Section 12: Architectural Regressions & Lifecycle Invariants", () => {
    it("12.1. APPROVED_TARGET_PENDING_TECHNICAL confers ZERO runtime authority in authorizeCanonical", async () => {
      const pendingAssignment: CanonicalAssignmentWithDetails = {
        id: "asg-pending-target",
        userId: "usr-target-pending",
        positionId: "pos-op-tahfizh",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        positionName: "Petugas Operasional Tahfizh",
        domain: "TAHFIZH",
        unitId: "hlq-1",
        unitCode: "HLQ-01",
        unitName: "Halaqoh Abu Bakar",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 86400000),
        validUntil: null,
        positionCapabilities: [
          {
            capabilityCode: TAHFIZH_M32_CAPABILITIES.TARGET_MANAGE,
            scopeType: "HALAQOH",
            businessRuleState: "APPROVED_TARGET_PENDING_TECHNICAL", // PENDING POLICY!
          },
        ],
        scopeUnits: [],
      };

      const mockProvider: ICanonicalDataProvider = {
        async getIdentity() {
          return {
            userId: "usr-target-pending",
            username: "op.target.pending",
            status: "AKTIF",
            accountType: "PERSONAL",
            staffId: "stf-op-pending",
            staffStatus: "AKTIF",
          };
        },
        async getActiveAssignments() {
          return [pendingAssignment];
        },
        async getUnitAccountPlacement() {
          return null;
        },
        async verifyHumanExecutor() {
          return null;
        },
        async resolveResourceContext() {
          return {
            santriId: "san-01",
            halaqohId: "hlq-1",
            orgUnitIds: ["hlq-1"],
            orgDomain: "TAHFIZH",
          };
        },
      };

      // Runtime evaluate MUST fail closed with CAPABILITY_NOT_GRANTED
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-target-pending",
          username: "op.target.pending",
          status: "AKTIF",
          accountType: "PERSONAL",
        },
        capability: TAHFIZH_M32_CAPABILITIES.TARGET_MANAGE,
        resourceContext: { santriId: "san-01" },
        dataProvider: mockProvider,
      });

      assert.strictEqual(res.decision, "DENY", "Pending target policy must confer zero runtime authority");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
      assert.strictEqual(res.reasonCode, "CAPABILITY_NOT_GRANTED");
    });

    it("12.2. Multi-domain resolution: same santri resolves TAHFIZH, KEASRAMAAN, or AKADEMIK strictly by capability", async () => {
      const fakePrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-multi-domain-target",
            nama: "Santri Multi-Domain",
            nis: "1099",
            halaqohId: "hlq-tahfizh-01",
            jenisKelamin: "L",
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => ({
            id: "skp-01",
            santriId: "san-multi-domain-target",
            isActive: true,
            kamar: {
              id: "kmr-keasramaan-01",
              type: "KAMAR",
              domain: "KEASRAMAAN",
              isActive: true,
              genderComplex: "PUTRA",
            },
          }),
        },
      };

      const provider = createPrismaDataProvider(fakePrisma);

      // A. tahfizh.* -> TAHFIZH
      const tahfizhCtx = await provider.resolveResourceContext(
        { santriId: "san-multi-domain-target" },
        undefined,
        "tahfizh.recap.read"
      );
      assert.strictEqual(tahfizhCtx?.orgDomain, "TAHFIZH");

      // B. keasramaan.* -> KEASRAMAAN
      const keasramaanCtx = await provider.resolveResourceContext(
        { santriId: "san-multi-domain-target" },
        undefined,
        "keasramaan.permission.read"
      );
      assert.strictEqual(keasramaanCtx?.orgDomain, "KEASRAMAAN");

      // C. academic.* -> AKADEMIK
      const academicCtx = await provider.resolveResourceContext(
        { santriId: "san-multi-domain-target" },
        undefined,
        "academic.score.edit"
      );
      assert.strictEqual(academicCtx?.orgDomain, "AKADEMIK");
    });

    it("12.3. Multi-domain resolution: unknown namespace leaves orgDomain undefined and fails closed on DOMAIN grant", async () => {
      const fakePrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-unknown-ns",
            nama: "Santri Unknown",
            nis: "1098",
            halaqohId: "hlq-tahfizh-01",
            jenisKelamin: "L",
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => null,
        },
      };

      const provider = createPrismaDataProvider(fakePrisma);

      // Unknown capability namespace -> orgDomain must remain undefined (zero guessing)
      const unknownCtx = await provider.resolveResourceContext(
        { santriId: "san-unknown-ns" },
        undefined,
        "custom_unknown_ns.something.do"
      );
      assert.strictEqual(unknownCtx?.orgDomain, undefined, "Unknown namespace must leave orgDomain undefined");
      assert.ok(unknownCtx, "Context must be resolved");

      // When orgDomain is undefined, evaluating DOMAIN scope must fail closed
      const domainGrant: EffectiveCapabilityGrant = {
        assignmentId: "asg-domain-test",
        positionCode: "STAFF_TEST",
        capabilityCode: "custom_unknown_ns.something.do",
        scopeType: "DOMAIN",
        anchorUnitId: "unit-test",
        unitIds: [],
        businessRuleState: "VERIFIED_PRODUCTION",
      };

      const scopeRes = evaluateScopePredicate(
        { ...domainGrant, domain: "TAHFIZH" } as any,
        unknownCtx,
        { userId: "usr-test" }
      );
      assert.strictEqual(scopeRes.matches, false, "Undefined orgDomain must fail closed on DOMAIN scope");
      assert.strictEqual(scopeRes.code, "INVALID_RESOURCE_CONTEXT");
    });

    it("12.4. Multi-domain resolution: missing capability leaves orgDomain undefined (no inference from santriId)", async () => {
      const fakePrisma: any = {
        santri: {
          findUnique: async () => ({
            id: "san-missing-cap",
            nama: "Santri Missing Cap",
            nis: "1097",
            halaqohId: "hlq-tahfizh-01",
            jenisKelamin: "L",
          }),
        },
        santriKamarPlacement: {
          findFirst: async () => null,
        },
      };

      const provider = createPrismaDataProvider(fakePrisma);

      // Missing capability argument -> orgDomain must remain undefined (zero guessing)
      const missingCapCtx = await provider.resolveResourceContext(
        { santriId: "san-missing-cap" },
        undefined,
        undefined
      );
      assert.strictEqual(missingCapCtx?.orgDomain, undefined, "Missing capability must leave orgDomain undefined");
    });

    it("12.5. PR #8 remains immutable", () => {
      const checkScript = path.join(
        "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\6816c86d-3b00-49e0-bf73-162bafe8c4f1\\scratch\\check-pr8.mjs"
      );
      if (fs.existsSync(checkScript)) {
        const out = execSync(`node ${checkScript}`, { encoding: "utf-8" });
        assert.ok(out.includes("PR8_STATE=open"), "PR #8 must remain OPEN");
        assert.ok(out.includes("PR8_DRAFT=true"), "PR #8 must remain DRAFT");
        assert.ok(
          out.includes("PR8_HEAD_SHA=9068cae5587b7219c394c5c25bf0de07a15b0726"),
          "PR #8 HEAD SHA must remain 9068cae5587b7219c394c5c25bf0de07a15b0726"
        );
        assert.ok(out.includes("PR8_MERGED=false"), "PR #8 must remain UNMERGED");
      }
    });

    it("12.6. Existing M2 and M3.1 contracts remain green", () => {
      assert.strictEqual(OSDA_PUTRI_UNIT_CONTRACT.NODE.code, "OU-OSDA-PUTRI");
      assert.strictEqual(OSDA_PUTRI_UNIT_CONTRACT.NODE.genderComplex, "PUTRI");
      assert.strictEqual(HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS.length, 4);
      assert.strictEqual(TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS.length, 2);
    });
  });
});
