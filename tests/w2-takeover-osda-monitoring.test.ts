/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  executeSupervisoryTakeover,
  validateSupervisoryAuthority,
} from "../lib/server/takeover-service";
import {
  evaluateOsdaMonitoringAccess,
} from "../lib/server/osda-monitoring-service";
import {
  parseTakeoverGuards,
  preflightTakeoverCapability,
} from "../scripts/provision-w2-takeover-capability";
import {
  parseOsdaMonitorGuards,
  preflightOsdaMonitor,
} from "../scripts/provision-w2-osda-monitor";
import { GenderComplex, OrgDomain, ScopeType, BusinessRuleState, AssignmentStatus } from "@prisma/client";
import {
  PENGAWAS_SANTRIWATI_POSITION_CONTRACT,
  KEASRAMAAN_CAPABILITIES,
  KEASRAMAAN_TAKEOVER_MUDIR_TARGET_POLICY,
  KEASRAMAAN_TAKEOVER_KEPALA_KEASRAMAAN_TARGET_POLICY,
  KEASRAMAAN_OSDA_MONITOR_TARGET_POLICY,
} from "../types/architecture-lock";

describe("W2 Track 3 — Supervisory Takeover (ORR-086)", () => {
  it("3A: strictly allows MUDIR (GLOBAL) and KEPALA_KEASRAMAAN (DOMAIN KEASRAMAAN)", () => {
    // Mudir has GLOBAL authority
    const mudirCheck = validateSupervisoryAuthority(
      { userId: "usr-mudir", positionCode: "MUDIR" },
      OrgDomain.KEASRAMAAN
    );
    assert.equal(mudirCheck.authorized, true);

    // Kepala Keasramaan has authority over KEASRAMAAN
    const mkCheck = validateSupervisoryAuthority(
      { userId: "usr-mk", positionCode: "KEPALA_KEASRAMAAN", domain: OrgDomain.KEASRAMAAN },
      OrgDomain.KEASRAMAAN
    );
    assert.equal(mkCheck.authorized, true);
  });

  it("3A: strictly denies noncanonical KEPALA_SEKOLAH for Keasramaan takeover", () => {
    const ksCheck = validateSupervisoryAuthority(
      { userId: "usr-ks", positionCode: "KEPALA_SEKOLAH" },
      OrgDomain.KEASRAMAAN
    );
    assert.equal(ksCheck.authorized, false);
    assert.match(ksCheck.reason || "", /KEPALA_SEKOLAH.*bukan merupakan otoritas supervisi kanonikal/i);
  });

  it("3A: strictly denies subordinate or peer from executing takeover", () => {
    const peerCheck = validateSupervisoryAuthority(
      { userId: "usr-peer", positionCode: "PEMBINA_HALAQOH" },
      OrgDomain.KEASRAMAAN
    );
    assert.equal(peerCheck.authorized, false);
    assert.match(peerCheck.reason || "", /bukan merupakan Atasan \/ Supervisor berwenang/i);

    const subordinateCheck = validateSupervisoryAuthority(
      { userId: "usr-santri", positionCode: "SANTRI" },
      OrgDomain.KEASRAMAAN
    );
    assert.equal(subordinateCheck.authorized, false);
  });

  it("3A: strictly denies cross-domain takeover for KEPALA_KEASRAMAAN without jurisdiction", () => {
    const wrongDomainCheck = validateSupervisoryAuthority(
      { userId: "usr-mk", positionCode: "KEPALA_KEASRAMAAN", domain: OrgDomain.KEASRAMAAN },
      OrgDomain.TAHFIZH
    );
    assert.equal(wrongDomainCheck.authorized, false);
    assert.match(wrongDomainCheck.reason || "", /hanya memiliki wewenang supervisi atas domain 'KEASRAMAAN'/i);
  });

  it("3B & 3F: executes takeover with canonical authorization, preserving complete provenance", async () => {
    const mockAuditLogs: any[] = [];
    const mockPrisma: any = {
      auditLog: {
        create: async ({ data }: any) => {
          mockAuditLogs.push(data);
          return data;
        },
      },
    };

    // Valid canonical mock assignment granting keasramaan.takeover.execute
    const mockAssignment = {
      id: "asg-mk-1",
      userId: "usr-mk-supervisor",
      positionId: "pos-mk",
      positionCode: "KEPALA_KEASRAMAAN",
      positionName: "Kepala Keasramaan",
      domain: "KEASRAMAAN",
      unitId: "OU-ASRAMA-ROOT",
      unitCode: "OU-ASRAMA-ROOT",
      unitName: "Asrama Root",
      unitGenderComplex: GenderComplex.CAMPUR,
      status: AssignmentStatus.ACTIVE,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: "keasramaan.takeover.execute",
          scopeType: ScopeType.DOMAIN,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      ],
      scopeUnits: [],
    };

    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-mudhabbir-room-101",
      originalPic: {
        userId: "usr-mudhabbir-1",
        name: "Ahmad Mudhabbir",
        positionCode: "PEMBINA_HALAQOH",
      },
      takeoverActor: {
        userId: "usr-mk-supervisor",
        name: "Ust. Fulan MK",
        positionCode: "KEPALA_KEASRAMAAN",
        domain: OrgDomain.KEASRAMAAN,
        mockAssignments: [mockAssignment],
      },
      reason: "Petugas utama berhalangan hadir dan checklist kebersihan malam belum dijalankan.",
      resourceContext: {
        resourceType: "ChecklistRun",
        resourceId: "run-chk-101",
        domain: OrgDomain.KEASRAMAAN,
        unitId: "OU-ASRAMA-PUTRA",
        kamarId: "OU-KAMAR-101",
        genderComplex: GenderComplex.PUTRA,
      },
      beforeState: { status: "DRAFT", lastUpdatedBy: "usr-mudhabbir-1" },
      afterState: { status: "PERFORMED", lastUpdatedBy: "usr-mk-supervisor" },
      prismaClient: mockPrisma,
    });

    assert.equal(res.success, true);
    assert.ok(res.data);

    const record = res.data;
    // Verify all 7 provenance attributes
    assert.equal(record.originalAssignmentId, "asg-mudhabbir-room-101");
    assert.equal(record.originalPic.userId, "usr-mudhabbir-1");
    assert.equal(record.originalPic.name, "Ahmad Mudhabbir");
    assert.equal(record.originalPic.positionCode, "PEMBINA_HALAQOH");
    assert.equal(record.takeoverActor.userId, "usr-mk-supervisor");
    assert.equal(record.takeoverActor.name, "Ust. Fulan MK");
    assert.equal(record.takeoverActor.positionCode, "KEPALA_KEASRAMAAN");
    assert.equal(record.reason, "Petugas utama berhalangan hadir dan checklist kebersihan malam belum dijalankan.");
    assert.ok(record.timestamp instanceof Date);
    assert.equal(record.resourceContext.resourceType, "ChecklistRun");
    assert.equal(record.resourceContext.resourceId, "run-chk-101");
    assert.deepEqual(record.beforeState, { status: "DRAFT", lastUpdatedBy: "usr-mudhabbir-1" });
    assert.deepEqual(record.afterState, { status: "PERFORMED", lastUpdatedBy: "usr-mk-supervisor" });

    // Invariants
    assert.equal(record.attributionPreserved, true);
    assert.equal(record.workflowActivated, false);

    // Audit log check
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, "SUPERVISORY_TAKEOVER");
    assert.equal(mockAuditLogs[0].entity, "ChecklistRun");
  });

  it("3B: fails closed when capability is not granted or zero production grants", async () => {
    // User with zero assignments
    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "usr-pic", positionCode: "PEMBINA_HALAQOH" },
      takeoverActor: {
        userId: "usr-mk",
        positionCode: "KEPALA_KEASRAMAAN",
        domain: OrgDomain.KEASRAMAAN,
        mockAssignments: [], // Zero assignments
      },
      reason: "Kelalaian PIC",
      resourceContext: {
        resourceType: "ChecklistRun",
        resourceId: "run-1",
        domain: OrgDomain.KEASRAMAAN,
      },
      beforeState: {},
      afterState: {},
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "CAPABILITY_NOT_GRANTED");
  });

  it("3F: rejects takeover if mandatory provenance is missing", async () => {
    const resNoAssignment = await executeSupervisoryTakeover({
      originalAssignmentId: "",
      originalPic: { userId: "usr-pic", positionCode: "STAFF" },
      takeoverActor: { userId: "usr-mudir", positionCode: "MUDIR" },
      reason: "Kelalaian",
      resourceContext: { resourceType: "Run", resourceId: "1", domain: OrgDomain.KEASRAMAAN },
      beforeState: {},
      afterState: {},
      skipCanonicalAuthForTesting: true,
    });
    assert.equal(resNoAssignment.success, false);
    assert.equal(resNoAssignment.code, "INVALID_ASSIGNMENT_ID");

    const resNoReason = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "usr-pic", positionCode: "STAFF" },
      takeoverActor: { userId: "usr-mudir", positionCode: "MUDIR" },
      reason: "",
      resourceContext: { resourceType: "Run", resourceId: "1", domain: OrgDomain.KEASRAMAAN },
      beforeState: {},
      afterState: {},
      skipCanonicalAuthForTesting: true,
    });
    assert.equal(resNoReason.success, false);
    assert.equal(resNoReason.code, "REASON_REQUIRED");

    const resNoPic = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "", positionCode: "" },
      takeoverActor: { userId: "usr-mudir", positionCode: "MUDIR" },
      reason: "Kelalaian",
      resourceContext: { resourceType: "Run", resourceId: "1", domain: OrgDomain.KEASRAMAAN },
      beforeState: {},
      afterState: {},
      skipCanonicalAuthForTesting: true,
    });
    assert.equal(resNoPic.success, false);
    assert.equal(resNoPic.code, "INVALID_ORIGINAL_PIC");

    const resNoResource = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "usr-pic", positionCode: "STAFF" },
      takeoverActor: { userId: "usr-mudir", positionCode: "MUDIR" },
      reason: "Kelalaian",
      resourceContext: { resourceType: "", resourceId: "", domain: OrgDomain.KEASRAMAAN },
      beforeState: {},
      afterState: {},
      skipCanonicalAuthForTesting: true,
    });
    assert.equal(resNoResource.success, false);
    assert.equal(resNoResource.code, "INVALID_RESOURCE_CONTEXT");
  });

  it("3B: verifies takeover target policy declarations", () => {
    assert.equal(KEASRAMAAN_TAKEOVER_MUDIR_TARGET_POLICY.positionCode, "MUDIR");
    assert.equal(KEASRAMAAN_TAKEOVER_MUDIR_TARGET_POLICY.capabilityCode, "keasramaan.takeover.execute");
    assert.equal(KEASRAMAAN_TAKEOVER_MUDIR_TARGET_POLICY.scopeType, "GLOBAL");

    assert.equal(KEASRAMAAN_TAKEOVER_KEPALA_KEASRAMAAN_TARGET_POLICY.positionCode, "KEPALA_KEASRAMAAN");
    assert.equal(KEASRAMAAN_TAKEOVER_KEPALA_KEASRAMAAN_TARGET_POLICY.capabilityCode, "keasramaan.takeover.execute");
    assert.equal(KEASRAMAAN_TAKEOVER_KEPALA_KEASRAMAAN_TARGET_POLICY.scopeType, "DOMAIN");
    assert.equal(KEASRAMAAN_TAKEOVER_KEPALA_KEASRAMAAN_TARGET_POLICY.domain, "KEASRAMAAN");
  });
});

describe("W2 Track 3D — OSDA PUTRI Monitoring Policy (ORR-048 / DIR-2026-016)", () => {
  it("3D: reconciles capability contract: PENGAWAS_SANTRIWATI targetCapabilities includes keasramaan.osda.monitor", () => {
    assert.equal(KEASRAMAAN_CAPABILITIES.OSDA_MONITOR, "keasramaan.osda.monitor");
    assert.ok(
      (PENGAWAS_SANTRIWATI_POSITION_CONTRACT.targetCapabilities as readonly string[]).includes(
        "keasramaan.osda.monitor"
      )
    );
    assert.equal(KEASRAMAAN_OSDA_MONITOR_TARGET_POLICY.positionCode, "PENGAWAS_SANTRIWATI");
    assert.equal(KEASRAMAAN_OSDA_MONITOR_TARGET_POLICY.capabilityCode, "keasramaan.osda.monitor");
    assert.equal(KEASRAMAAN_OSDA_MONITOR_TARGET_POLICY.isReadOnly, true);
    assert.equal(KEASRAMAAN_OSDA_MONITOR_TARGET_POLICY.genderContainment, "PUTRI");
  });

  it("3D: allows PENGAWAS_SANTRIWATI to read/monitor OSDA PUTRI without username hardcoding", () => {
    const res = evaluateOsdaMonitoringAccess({
      actorPositionCode: "PENGAWAS_SANTRIWATI",
      actorGenderComplex: GenderComplex.PUTRI,
      targetGenderComplex: GenderComplex.PUTRI,
      targetDomain: OrgDomain.KEASRAMAAN,
      isMutation: false,
    });

    assert.equal(res.allowed, true);
    assert.equal(res.code, "ALLOWED");
  });

  it("3D: strictly denies PENGAWAS_SANTRIWATI from accessing OSDA PUTRA (Zero PUTRA Leakage)", () => {
    const res = evaluateOsdaMonitoringAccess({
      actorPositionCode: "PENGAWAS_SANTRIWATI",
      actorGenderComplex: GenderComplex.PUTRI,
      targetGenderComplex: GenderComplex.PUTRA, // Boundary test
      targetDomain: OrgDomain.KEASRAMAAN,
      isMutation: false,
    });

    assert.equal(res.allowed, false);
    assert.equal(res.code, "GENDER_COMPLEX_DENIED");
    assert.match(res.reason, /melarang akses terhadap sumber daya OSDA PUTRA/i);
  });

  it("3D: strictly denies ALL OSDA mutations for PENGAWAS_SANTRIWATI (READ-ONLY Invariant)", () => {
    const res = evaluateOsdaMonitoringAccess({
      actorPositionCode: "PENGAWAS_SANTRIWATI",
      actorGenderComplex: GenderComplex.PUTRI,
      targetGenderComplex: GenderComplex.PUTRI,
      targetDomain: OrgDomain.KEASRAMAAN,
      isMutation: true, // Mutation test
    });

    assert.equal(res.allowed, false);
    assert.equal(res.code, "MUTATION_NOT_PERMITTED");
    assert.match(res.reason, /Seluruh mutasi operasional OSDA ditolak/i);
  });

  it("3D: strictly denies ordinary MT, generic OSDA, and unrelated positions", () => {
    const resMT = evaluateOsdaMonitoringAccess({
      actorPositionCode: "MUSYRIF_TAHFIZH",
      targetGenderComplex: GenderComplex.PUTRI,
      isMutation: false,
    });
    assert.equal(resMT.allowed, false);
    assert.equal(resMT.code, "CAPABILITY_NOT_GRANTED");

    const resOSDA = evaluateOsdaMonitoringAccess({
      actorPositionCode: "OSDA",
      targetGenderComplex: GenderComplex.PUTRI,
      isMutation: false,
    });
    assert.equal(resOSDA.allowed, false);
    assert.equal(resOSDA.code, "CAPABILITY_NOT_GRANTED");

    const resGuru = evaluateOsdaMonitoringAccess({
      actorPositionCode: "GURU_KEPESANTRENAN",
      targetGenderComplex: GenderComplex.PUTRI,
      isMutation: false,
    });
    assert.equal(resGuru.allowed, false);
    assert.equal(resGuru.code, "CAPABILITY_NOT_GRANTED");
  });

  it("3D: strictly denies username Lisa alone without canonical assignment", () => {
    const resLisaAlone = evaluateOsdaMonitoringAccess({
      actorUsername: "lisa",
      targetGenderComplex: GenderComplex.PUTRI,
      isMutation: false,
    });
    assert.equal(resLisaAlone.allowed, false);
    assert.equal(resLisaAlone.code, "CAPABILITY_NOT_GRANTED");
    assert.match(resLisaAlone.reason, /Username 'lisa' saja tanpa penugasan kanonikal/i);

    const resNoAssignment = evaluateOsdaMonitoringAccess({
      actorPositionCode: "PENGAWAS_SANTRIWATI",
      targetGenderComplex: GenderComplex.PUTRI,
      isMutation: false,
      hasCanonicalAssignment: false,
    });
    assert.equal(resNoAssignment.allowed, false);
    assert.equal(resNoAssignment.code, "NO_CANONICAL_ASSIGNMENT");
  });
});

describe("W2 Track 3C & 3E — Guarded Provisioning Script Invariants", () => {
  it("3C: takeover provisioning guards default to read-only and require all flags", () => {
    // Default: read-only
    const defaultGuards = parseTakeoverGuards([], {});
    assert.equal(defaultGuards.isExecuteApproved, false);
    assert.equal(defaultGuards.guardReasons.length, 3);

    // Missing env: blocked
    const cliOnly = parseTakeoverGuards(["--execute", "--approved-scope=W2-TAKEOVER"], {});
    assert.equal(cliOnly.isExecuteApproved, false);

    // Full approval
    const approved = parseTakeoverGuards(
      ["--execute", "--approved-scope=W2-TAKEOVER"],
      { PRODUCTION_MUTATION_APPROVED: "W2-TAKEOVER" }
    );
    assert.equal(approved.isExecuteApproved, true);
    assert.equal(approved.guardReasons.length, 0);
  });

  it("3C: takeover preflight runs read-only against mock Prisma", async () => {
    const mockPrisma: any = {
      capability: {
        findUnique: async () => null,
      },
      positionCapability: {
        findMany: async () => [],
      },
      assignment: {
        findMany: async () => [
          {
            id: "asg-m",
            userId: "u-m",
            position: { code: "MUDIR" },
            user: { username: "mudir" },
            unit: { code: "OU-STQ-ROOT" },
            status: "ACTIVE",
          },
          {
            id: "asg-mk",
            userId: "u-mk",
            position: { code: "KEPALA_KEASRAMAAN" },
            user: { username: "kepala.keasramaan" },
            unit: { code: "OU-ASRAMA-ROOT" },
            status: "ACTIVE",
          },
        ],
      },
    };

    const report = await preflightTakeoverCapability(mockPrisma);
    assert.equal(report.capabilityCount, 0);
    assert.equal(report.mudirGrantCount, 0);
    assert.equal(report.kepalaKeasramaanGrantCount, 0);
    assert.equal(report.conflictingGrants.length, 0);
    assert.equal(report.activeRelevantAssignments.length, 2);
    assert.equal(report.allPreconditionsPass, true);
  });

  it("3E: osda monitor provisioning guards default to read-only and require all flags", () => {
    // Default: read-only
    const defaultGuards = parseOsdaMonitorGuards([], {});
    assert.equal(defaultGuards.isExecuteApproved, false);
    assert.equal(defaultGuards.guardReasons.length, 3);

    // Missing CLI flag: blocked
    const envOnly = parseOsdaMonitorGuards([], { PRODUCTION_MUTATION_APPROVED: "W2-OSDA-MONITOR" });
    assert.equal(envOnly.isExecuteApproved, false);

    // Full approval
    const approved = parseOsdaMonitorGuards(
      ["--execute", "--approved-scope=W2-OSDA-MONITOR"],
      { PRODUCTION_MUTATION_APPROVED: "W2-OSDA-MONITOR" }
    );
    assert.equal(approved.isExecuteApproved, true);
    assert.equal(approved.guardReasons.length, 0);
  });

  it("3E: osda monitor preflight runs read-only against mock Prisma", async () => {
    const mockPrisma: any = {
      capability: {
        findUnique: async () => null,
      },
      position: {
        findUnique: async () => ({
          id: "pos-pengawas",
          code: "PENGAWAS_SANTRIWATI",
          domain: "KEASRAMAAN",
          isActive: true,
        }),
      },
      staff: {
        findMany: async () => [
          {
            nama: "Ustadzah Lisa",
            user: {
              id: "usr-lisa",
              username: "lisa",
              assignments: [
                {
                  id: "asg-lisa-1",
                  status: "ACTIVE",
                  position: { code: "PENGAWAS_SANTRIWATI" },
                  unit: { code: "OU-OSDA-PUTRI" },
                },
              ],
            },
          },
        ],
      },
      positionCapability: {
        findMany: async () => [],
      },
    };

    const report = await preflightOsdaMonitor(mockPrisma);
    assert.equal(report.capabilityCount, 0);
    assert.equal(report.pengawasPositionCount, 1);
    assert.equal(report.lisaAssignmentCount, 1);
    assert.equal(report.positionCapabilityCount, 0);
    assert.equal(report.targetScope, ScopeType.DOMAIN);
    assert.equal(report.allPreconditionsPass, true);
  });
});
