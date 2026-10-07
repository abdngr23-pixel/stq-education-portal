/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  executeSupervisoryTakeover,
  validateSupervisoryAuthority,
} from "../lib/server/takeover-service";
import {
  evaluateOsdaMonitoringAccess,
  authorizeOsdaMonitoring,
} from "../lib/server/osda-monitoring-service";
import {
  parseTakeoverGuards,
  preflightTakeoverCapability,
  executeTakeoverProvisioning,
} from "../scripts/provision-w2-takeover-capability";
import {
  parseOsdaMonitorGuards,
  preflightOsdaMonitor,
  executeOsdaMonitorProvisioning,
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

  it("3B: caller-supplied fake positionCode does NOT confer authority without active canonical assignment", async () => {
    // Caller claims to be MUDIR, but has ZERO active assignments in database
    const fakeMudirRes = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "usr-pic", positionCode: "PEMBINA_HALAQOH" },
      takeoverActor: {
        userId: "usr-impostor",
        name: "Impostor Claiming Mudir",
        positionCode: "MUDIR", // Fake caller position
        mockAssignments: [],   // Zero real assignments
      },
      reason: "Mengaku Atasan",
      resourceContext: {
        resourceType: "ChecklistRun",
        resourceId: "run-1",
        domain: OrgDomain.KEASRAMAAN,
      },
      beforeState: {},
      afterState: {},
    });

    assert.equal(fakeMudirRes.success, false);
    assert.equal(fakeMudirRes.code, "CAPABILITY_NOT_GRANTED");
  });

  it("3B: authorizes successfully when caller provides NO positionCode (resolved canonically from DB)", async () => {
    const mockPrisma: any = {
      auditLog: {
        create: async ({ data }: any) => data,
      },
    };

    const mockAssignment = {
      id: "asg-mk-canon",
      userId: "usr-real-mk",
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

    // Caller provides NO positionCode
    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-mudhabbir-1",
      originalPic: {
        userId: "usr-mudhabbir",
        name: "Mudhabbir",
        positionCode: "PEMBINA_HALAQOH",
      },
      takeoverActor: {
        userId: "usr-real-mk",
        name: "Kepala Keasramaan Real",
        // Notice: NO positionCode provided here!
        mockAssignments: [mockAssignment],
      },
      reason: "PIC sakit mendadak.",
      resourceContext: {
        resourceType: "ChecklistRun",
        resourceId: "run-chk-1",
        domain: OrgDomain.KEASRAMAAN,
        unitId: "OU-ASRAMA-PUTRA",
        genderComplex: GenderComplex.PUTRA,
      },
      beforeState: {},
      afterState: {},
      prismaClient: mockPrisma,
    });

    assert.equal(res.success, true);
    assert.ok(res.data);
    // Position code must be resolved canonically
    assert.equal(res.data.takeoverActor.positionCode, "KEPALA_KEASRAMAAN");
  });

  it("3B: strictly denies KEPALA_SEKOLAH even if canonical assignment exists", async () => {
    const mockAssignment = {
      id: "asg-ks-1",
      userId: "usr-ks",
      positionId: "pos-ks",
      positionCode: "KEPALA_SEKOLAH",
      positionName: "Kepala Sekolah",
      domain: "PENDIDIKAN",
      unitId: "OU-SEKOLAH",
      unitCode: "OU-SEKOLAH",
      unitName: "Sekolah",
      unitGenderComplex: GenderComplex.CAMPUR,
      status: AssignmentStatus.ACTIVE,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: "keasramaan.takeover.execute",
          scopeType: ScopeType.GLOBAL,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      ],
      scopeUnits: [],
    };

    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "usr-pic", positionCode: "PEMBINA_HALAQOH" },
      takeoverActor: {
        userId: "usr-ks",
        name: "Kepala Sekolah",
        mockAssignments: [mockAssignment],
      },
      reason: "Takeover keasramaan oleh kepala sekolah",
      resourceContext: {
        resourceType: "ChecklistRun",
        resourceId: "run-1",
        domain: OrgDomain.KEASRAMAAN,
      },
      beforeState: {},
      afterState: {},
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "SUPERVISORY_AUTHORITY_DENIED");
    assert.match(res.reason || "", /KEPALA_SEKOLAH/i);
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

  it("3D: server-side authorizeOsdaMonitoring allows PENGAWAS_SANTRIWATI with active canonical assignment and VERIFIED_PRODUCTION", async () => {
    const mockAssignment = {
      id: "asg-lisa-canon",
      userId: "usr-lisa",
      positionId: "pos-pengawas",
      positionCode: "PENGAWAS_SANTRIWATI",
      positionName: "Pengawas Santriwati",
      domain: "KEASRAMAAN",
      unitId: "OU-OSDA-PUTRI",
      unitCode: "OU-OSDA-PUTRI",
      unitName: "OSDA Putri",
      unitGenderComplex: GenderComplex.PUTRI,
      status: AssignmentStatus.ACTIVE,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: "keasramaan.osda.monitor",
          scopeType: ScopeType.DOMAIN,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      ],
      scopeUnits: [],
    };

    const res = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      actorUsername: "lisa",
      targetResource: {
        resourceId: "osda-eval-1",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
        unitId: "OU-OSDA-PUTRI",
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
    });

    assert.equal(res.allowed, true);
    assert.equal(res.code, "ALLOWED");
    assert.equal(res.positionCode, "PENGAWAS_SANTRIWATI");
  });

  it("3D: server-side authorizeOsdaMonitoring strictly enforces fail-closed boundary rules", async () => {
    const mockAssignment = {
      id: "asg-lisa-canon",
      userId: "usr-lisa",
      positionId: "pos-pengawas",
      positionCode: "PENGAWAS_SANTRIWATI",
      positionName: "Pengawas Santriwati",
      domain: "KEASRAMAAN",
      unitId: "OU-OSDA-PUTRI",
      unitCode: "OU-OSDA-PUTRI",
      unitName: "OSDA Putri",
      unitGenderComplex: GenderComplex.PUTRI,
      status: AssignmentStatus.ACTIVE,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [
        {
          capabilityCode: "keasramaan.osda.monitor",
          scopeType: ScopeType.DOMAIN,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      ],
      scopeUnits: [],
    };

    // 1. Cross-gender PUTRA resource -> GENDER_COMPLEX_DENIED
    const putraRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        resourceId: "osda-putra",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRA,
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
    });
    assert.equal(putraRes.allowed, false);
    assert.equal(putraRes.code, "GENDER_COMPLEX_DENIED");

    // 2. Mutation attempt -> MUTATION_NOT_PERMITTED
    const mutRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        resourceId: "osda-putri",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
      },
      isMutation: true,
      mockAssignments: [mockAssignment],
    });
    assert.equal(mutRes.allowed, false);
    assert.equal(mutRes.code, "MUTATION_NOT_PERMITTED");

    // 3. Username alone with zero assignments -> NO_CANONICAL_ASSIGNMENT
    const noAsgRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa-unassigned",
      actorUsername: "lisa",
      targetResource: {
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
      },
      isMutation: false,
      mockAssignments: [],
    });
    assert.equal(noAsgRes.allowed, false);
    assert.ok(
      ["CAPABILITY_NOT_GRANTED", "NO_CANONICAL_ASSIGNMENT"].includes(noAsgRes.code),
      `Expected fail-closed denial code, got: ${noAsgRes.code}`
    );

    // 4. Ordinary MT assignment -> CAPABILITY_NOT_GRANTED
    const mtAssignment = {
      ...mockAssignment,
      positionCode: "MUSYRIF_TAHFIZH",
      positionCapabilities: [
        {
          capabilityCode: "tahfizh.halaqoh.entry",
          scopeType: ScopeType.ASSIGNED_UNITS,
          businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
        },
      ],
    };
    const mtRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-mt",
      targetResource: {
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
      },
      isMutation: false,
      mockAssignments: [mtAssignment],
    });
    assert.equal(mtRes.allowed, false);
    assert.equal(mtRes.code, "CAPABILITY_NOT_GRANTED");
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

  it("3C: executeTakeoverProvisioning defaults to read-only mode and executes atomic transaction when approved", async () => {
    const caps: any[] = [];
    const pcs: any[] = [];

    const mockPrisma: any = {
      capability: {
        findUnique: async () => caps[0] || null,
        create: async ({ data }: any) => {
          caps.push(data);
          return data;
        },
      },
      position: {
        findUnique: async ({ where }: any) => ({
          id: `pos-${where.code}`,
          code: where.code,
        }),
      },
      positionCapability: {
        findMany: async () =>
          pcs.map((p) => ({
            ...p,
            position: { code: p.positionId === "pos-MUDIR" ? "MUDIR" : "KEPALA_KEASRAMAAN" },
          })),
        findFirst: async ({ where }: any) => pcs.find((p) => p.positionId === where.positionId) || null,
        create: async ({ data }: any) => {
          const record = { id: `pc-${pcs.length + 1}`, ...data };
          pcs.push(record);
          return record;
        },
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
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    // 1. Unapproved guards -> READ_ONLY mode
    const readGuards = parseTakeoverGuards([], {});
    const readRes = await executeTakeoverProvisioning(readGuards, mockPrisma);
    assert.equal(readRes.mode, "READ_ONLY");
    assert.equal(readRes.executed, false);
    assert.equal(caps.length, 0);

    // 2. Approved guards -> EXECUTED atomic transaction
    const appGuards = parseTakeoverGuards(
      ["--execute", "--approved-scope=W2-TAKEOVER"],
      { PRODUCTION_MUTATION_APPROVED: "W2-TAKEOVER" }
    );
    const execRes = await executeTakeoverProvisioning(appGuards, mockPrisma);
    assert.equal(execRes.mode, "EXECUTED");
    assert.equal(execRes.executed, true);
    assert.equal(execRes.createdCapabilityCount, 1);
    assert.equal(execRes.createdPositionCapabilityCount, 2);
    assert.equal(caps[0].code, "keasramaan.takeover.execute");
    assert.equal(pcs.length, 2);
    assert.equal(pcs[0].scopeType, ScopeType.GLOBAL);
    assert.equal(pcs[0].businessRuleState, BusinessRuleState.VERIFIED_PRODUCTION);
    assert.equal(pcs[1].scopeType, ScopeType.DOMAIN);
    assert.equal(pcs[1].businessRuleState, BusinessRuleState.VERIFIED_PRODUCTION);
  });

  it("3E: executeOsdaMonitorProvisioning defaults to read-only mode and executes atomic transaction when approved", async () => {
    const caps: any[] = [];
    const pcs: any[] = [];

    const mockPrisma: any = {
      capability: {
        findUnique: async () => caps[0] || null,
        create: async ({ data }: any) => {
          caps.push(data);
          return data;
        },
      },
      position: {
        findUnique: async ({ where }: any) => ({
          id: `pos-${where.code}`,
          code: where.code,
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
        findMany: async () =>
          pcs.map((p) => ({
            ...p,
            position: { code: "PENGAWAS_SANTRIWATI" },
          })),
        findFirst: async ({ where }: any) => pcs.find((p) => p.positionId === where.positionId) || null,
        create: async ({ data }: any) => {
          const record = { id: `pc-${pcs.length + 1}`, ...data };
          pcs.push(record);
          return record;
        },
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    // 1. Unapproved -> READ_ONLY mode
    const readGuards = parseOsdaMonitorGuards([], {});
    const readRes = await executeOsdaMonitorProvisioning(readGuards, mockPrisma);
    assert.equal(readRes.mode, "READ_ONLY");
    assert.equal(readRes.executed, false);
    assert.equal(caps.length, 0);

    // 2. Approved -> EXECUTED mode
    const appGuards = parseOsdaMonitorGuards(
      ["--execute", "--approved-scope=W2-OSDA-MONITOR"],
      { PRODUCTION_MUTATION_APPROVED: "W2-OSDA-MONITOR" }
    );
    const execRes = await executeOsdaMonitorProvisioning(appGuards, mockPrisma);
    assert.equal(execRes.mode, "EXECUTED");
    assert.equal(execRes.executed, true);
    assert.equal(execRes.createdCapabilityCount, 1);
    assert.equal(caps[0].code, "keasramaan.osda.monitor");
    assert.equal(KEASRAMAAN_OSDA_MONITOR_TARGET_POLICY.isReadOnly, true);
    assert.equal(pcs[0].scopeType, ScopeType.DOMAIN);
    assert.equal(pcs[0].businessRuleState, BusinessRuleState.VERIFIED_PRODUCTION);
  });
});
