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

    const mockOriginalAssignment = {
      id: "asg-mudhabbir-room-101",
      userId: "usr-mudhabbir-1",
      positionId: "pos-ph",
      positionCode: "PEMBINA_HALAQOH",
      positionName: "Pembina Halaqoh",
      domain: "KEASRAMAAN",
      unitId: "OU-ASRAMA-PUTRA",
      unitCode: "OU-ASRAMA-PUTRA",
      unitName: "Asrama Putra",
      unitGenderComplex: GenderComplex.PUTRA,
      status: AssignmentStatus.ACTIVE,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [],
      scopeUnits: [],
      user: {
        id: "usr-mudhabbir-1",
        staffProfile: { nama: "Ahmad Mudhabbir" },
      },
      position: { code: "PEMBINA_HALAQOH" },
      unit: { id: "OU-ASRAMA-PUTRA", domain: OrgDomain.KEASRAMAAN, genderComplex: GenderComplex.PUTRA },
    };

    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-mudhabbir-room-101",
      mockAssignments: [mockAssignment, mockOriginalAssignment],
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
        mockAssignments: [mockAssignment, mockOriginalAssignment],
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

  it("Track D & E: ignores caller-supplied spoofed originalPic and spoofed resourceContext", async () => {
    const mockAssignment = {
      id: "asg-mk-super",
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

    const mockOriginalAssignment = {
      id: "asg-real-ph",
      userId: "usr-real-ph-id",
      positionId: "pos-ph",
      positionCode: "PEMBINA_HALAQOH",
      positionName: "Pembina Halaqoh",
      domain: "KEASRAMAAN",
      unitId: "OU-ASRAMA-PUTRA",
      unitCode: "OU-ASRAMA-PUTRA",
      unitName: "Asrama Putra",
      unitGenderComplex: GenderComplex.PUTRA,
      status: AssignmentStatus.ACTIVE,
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [],
      scopeUnits: [],
      user: {
        id: "usr-real-ph-id",
        staffProfile: { nama: "Ust. Real PH" },
      },
      position: { code: "PEMBINA_HALAQOH" },
      unit: { id: "OU-ASRAMA-PUTRA", domain: OrgDomain.KEASRAMAAN, genderComplex: GenderComplex.PUTRA },
    };

    // Caller attempts to spoof original PIC and resource context
    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-real-ph",
      mockAssignments: [mockAssignment, mockOriginalAssignment],
      originalPic: {
        userId: "usr-impostor-pic",
        name: "Impostor Claims Ownership",
        positionCode: "MUDIR",
      },
      takeoverActor: {
        userId: "usr-mk-supervisor",
        name: "Kepala Keasramaan",
        positionCode: "KEPALA_KEASRAMAAN",
        domain: OrgDomain.KEASRAMAAN,
        mockAssignments: [mockAssignment, mockOriginalAssignment],
      },
      reason: "Ambil alih tugas rutin kamar",
      resourceType: "ChecklistRun",
      resourceId: "run-chk-real",
      resourceContext: {
        domain: OrgDomain.TAHFIZH, // Spoofed domain claim
        genderComplex: GenderComplex.PUTRI, // Spoofed gender claim
      },
    });

    assert.equal(res.success, true);
    assert.ok(res.data);
    // Server-resolved PIC derived strictly from database / assignment
    assert.equal(res.data.originalPic.userId, "usr-real-ph-id");
    assert.equal(res.data.originalPic.name, "Ust. Real PH");
    assert.equal(res.data.originalPic.positionCode, "PEMBINA_HALAQOH");
    // Server-resolved domain derived from unit / assignment
    assert.equal(res.data.resourceContext.domain, OrgDomain.KEASRAMAAN);
    assert.equal(res.data.workflowActivated, false);
  });

  it("Track E: fails closed if original assignment is inactive", async () => {
    const mockAssignment = {
      id: "asg-mk-super",
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

    const mockInactiveAssignment = {
      id: "asg-inactive-ph",
      userId: "usr-inactive-ph",
      positionId: "pos-ph",
      positionCode: "PEMBINA_HALAQOH",
      status: "INACTIVE", // Inactive assignment
      validFrom: new Date(Date.now() - 86400000),
      validUntil: null,
      positionCapabilities: [],
      scopeUnits: [],
      user: { id: "usr-inactive-ph", staffProfile: { nama: "Inactive Staff" } },
      position: { code: "PEMBINA_HALAQOH" },
      unit: { id: "OU-ASRAMA-PUTRA", domain: OrgDomain.KEASRAMAAN },
    };

    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-inactive-ph",
      mockAssignments: [mockAssignment, mockInactiveAssignment as any],
      takeoverActor: {
        userId: "usr-mk-supervisor",
        positionCode: "KEPALA_KEASRAMAAN",
        mockAssignments: [mockAssignment, mockInactiveAssignment as any],
      },
      reason: "Ambil alih tugas mantan petugas",
      resourceType: "ChecklistRun",
      resourceId: "run-chk-1",
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "ORIGINAL_ASSIGNMENT_INACTIVE");
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

  it("Track F: server-side authorizeOsdaMonitoring allows PENGAWAS_SANTRIWATI with actual PUTRI OSDA unit and VERIFIED_PRODUCTION", async () => {
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

    const mockOrgUnits = [
      {
        id: "OU-OSDA-PUTRI",
        code: "OU-OSDA-PUTRI",
        name: "OSDA Putri",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
        isActive: true,
      },
    ];

    const res = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      actorUsername: "lisa",
      targetResource: {
        unitId: "OU-OSDA-PUTRI",
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
      mockOrgUnits,
    });

    assert.equal(res.allowed, true);
    assert.equal(res.code, "ALLOWED");
    assert.equal(res.positionCode, "PENGAWAS_SANTRIWATI");
  });

  it("Track F: REQUIRED ATTACK TESTS against authorizeOsdaMonitoring", async () => {
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

    const mockOrgUnits = [
      {
        id: "OU-OSDA-PUTRI",
        code: "OU-OSDA-PUTRI",
        name: "OSDA Putri",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
        isActive: true,
      },
      {
        id: "OU-OSDA-PUTRA",
        code: "OU-OSDA-PUTRA",
        name: "OSDA Putra",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRA,
        isActive: true,
      },
      {
        id: "OU-NON-OSDA",
        code: "OU-SEKOLAH-PUTRI",
        name: "Sekolah Putri Non-OSDA",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
        isActive: true,
      },
      {
        id: "OU-OSDA-INACTIVE",
        code: "OU-OSDA-INACTIVE",
        name: "OSDA Putri Inaktif",
        domain: OrgDomain.KEASRAMAAN,
        genderComplex: GenderComplex.PUTRI,
        isActive: false,
      },
    ];

    // Attack 1: PUTRA unit ID + caller claims PUTRI => DENY
    const putraRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        unitId: "OU-OSDA-PUTRA", // Actual unit is PUTRA
        genderComplex: GenderComplex.PUTRI, // Caller falsely claims PUTRI
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
      mockOrgUnits,
    });
    assert.equal(putraRes.allowed, false);
    assert.equal(putraRes.code, "GENDER_COMPLEX_DENIED");

    // Attack 2: non-OSDA unit ID + caller claims OSDA => DENY
    const nonOsdaRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        unitId: "OU-NON-OSDA",
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
      mockOrgUnits,
    });
    assert.equal(nonOsdaRes.allowed, false);
    assert.equal(nonOsdaRes.code, "NON_OSDA_UNIT");

    // Attack 3: inactive OSDA PUTRI unit => DENY
    const inactiveRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        unitId: "OU-OSDA-INACTIVE",
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
      mockOrgUnits,
    });
    assert.equal(inactiveRes.allowed, false);
    assert.equal(inactiveRes.code, "UNIT_INACTIVE");

    // Attack 4: unknown unit => DENY
    const unknownRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        unitId: "OU-UNKNOWN-999",
      },
      isMutation: false,
      mockAssignments: [mockAssignment],
      mockOrgUnits,
    });
    assert.equal(unknownRes.allowed, false);
    assert.equal(unknownRes.code, "RESOURCE_NOT_FOUND");

    // Attack 5: PUTRI OSDA actual unit + mutation => DENY
    const mutRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa",
      targetResource: {
        unitId: "OU-OSDA-PUTRI",
      },
      isMutation: true,
      mockAssignments: [mockAssignment],
      mockOrgUnits,
    });
    assert.equal(mutRes.allowed, false);
    assert.equal(mutRes.code, "MUTATION_NOT_PERMITTED");

    // Attack 6: username alone without canonical assignment => DENY
    const noAsgRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-lisa-unassigned",
      actorUsername: "lisa",
      targetResource: {
        unitId: "OU-OSDA-PUTRI",
      },
      isMutation: false,
      mockAssignments: [],
      mockOrgUnits,
    });
    assert.equal(noAsgRes.allowed, false);
    assert.ok(
      ["CAPABILITY_NOT_GRANTED", "NO_CANONICAL_ASSIGNMENT"].includes(noAsgRes.code),
      `Expected fail-closed denial code, got: ${noAsgRes.code}`
    );

    // Attack 7: ordinary MT => DENY
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
        unitId: "OU-OSDA-PUTRI",
      },
      isMutation: false,
      mockAssignments: [mtAssignment],
      mockOrgUnits,
    });
    assert.equal(mtRes.allowed, false);
    assert.equal(mtRes.code, "CAPABILITY_NOT_GRANTED");

    // Attack 8: generic OSDA => DENY
    const osdaAssignment = {
      ...mockAssignment,
      positionCode: "OSDA",
      positionCapabilities: [],
    };
    const osdaRes = await authorizeOsdaMonitoring({
      actorUserId: "usr-generic-osda",
      targetResource: {
        unitId: "OU-OSDA-PUTRI",
      },
      isMutation: false,
      mockAssignments: [osdaAssignment],
      mockOrgUnits,
    });
    assert.equal(osdaRes.allowed, false);
    assert.equal(osdaRes.code, "CAPABILITY_NOT_GRANTED");
  });
});

describe("W2 Track 3C & 3E — Guarded Provisioning Script Invariants", () => {
  it("3C: takeover provisioning guards default to read-only and require all flags", () => {
    const defaultGuards = parseTakeoverGuards([], {});
    assert.equal(defaultGuards.isExecuteApproved, false);
    assert.equal(defaultGuards.guardReasons.length, 3);

    const cliOnly = parseTakeoverGuards(["--execute", "--approved-scope=W2-TAKEOVER"], {});
    assert.equal(cliOnly.isExecuteApproved, false);

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

  it("Track G: takeover preflight stops with CONFIG_DRIFT if existing grants do not match targets", async () => {
    // 1. MUDIR grant with wrong scope (DOMAIN instead of GLOBAL)
    const mockDriftPrisma1: any = {
      capability: { findUnique: async () => ({ code: "keasramaan.takeover.execute", namespace: "KEASRAMAAN" }) },
      positionCapability: {
        findMany: async () => [
          {
            id: "pc-drift-1",
            position: { code: "MUDIR" },
            scopeType: ScopeType.DOMAIN, // WRONG SCOPE
            businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
          },
        ],
      },
      assignment: {
        findMany: async () => [
          { id: "a1", userId: "u1", position: { code: "MUDIR" }, user: { username: "mudir" }, unit: { code: "OU-1" }, status: "ACTIVE" },
          { id: "a2", userId: "u2", position: { code: "KEPALA_KEASRAMAAN" }, user: { username: "mk" }, unit: { code: "OU-1" }, status: "ACTIVE" },
        ],
      },
    };
    const report1 = await preflightTakeoverCapability(mockDriftPrisma1);
    assert.equal(report1.allPreconditionsPass, false);
    assert.ok(report1.validationErrors.some((e) => e.includes("CONFIG_DRIFT")));

    // 2. Unexpected grant to non-target position -> CONFLICT_REQUIRES_OWNER_AUTHORIZATION
    const mockConflictPrisma: any = {
      capability: { findUnique: async () => ({ code: "keasramaan.takeover.execute", namespace: "KEASRAMAAN" }) },
      positionCapability: {
        findMany: async () => [
          {
            id: "pc-conflict-1",
            position: { code: "KEPALA_SEKOLAH" }, // UNEXPECTED
            scopeType: ScopeType.GLOBAL,
            businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
          },
        ],
      },
      assignment: {
        findMany: async () => [
          { id: "a1", userId: "u1", position: { code: "MUDIR" }, user: { username: "mudir" }, unit: { code: "OU-1" }, status: "ACTIVE" },
          { id: "a2", userId: "u2", position: { code: "KEPALA_KEASRAMAAN" }, user: { username: "mk" }, unit: { code: "OU-1" }, status: "ACTIVE" },
        ],
      },
    };
    const report2 = await preflightTakeoverCapability(mockConflictPrisma);
    assert.equal(report2.allPreconditionsPass, false);
    assert.ok(report2.validationErrors.some((e) => e.includes("CONFLICT_REQUIRES_OWNER_AUTHORIZATION")));
  });

  it("3E: osda monitor provisioning guards default to read-only and require all flags", () => {
    const defaultGuards = parseOsdaMonitorGuards([], {});
    assert.equal(defaultGuards.isExecuteApproved, false);
    assert.equal(defaultGuards.guardReasons.length, 3);

    const envOnly = parseOsdaMonitorGuards([], { PRODUCTION_MUTATION_APPROVED: "W2-OSDA-MONITOR" });
    assert.equal(envOnly.isExecuteApproved, false);

    const approved = parseOsdaMonitorGuards(
      ["--execute", "--approved-scope=W2-OSDA-MONITOR"],
      { PRODUCTION_MUTATION_APPROVED: "W2-OSDA-MONITOR" }
    );
    assert.equal(approved.isExecuteApproved, true);
    assert.equal(approved.guardReasons.length, 0);
  });

  it("Track H: osda monitor preflight resolves exact canonical identity musyirfah.putri", async () => {
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
      user: {
        findMany: async ({ where }: any) => {
          if (where?.username === "musyirfah.putri") {
            return [
              {
                id: "usr-lisa",
                username: "musyirfah.putri",
                name: "Ustadzah Lisa",
                staffProfile: { nama: "Ustadzah Lisa" },
                assignments: [
                  {
                    id: "asg-lisa-1",
                    status: "ACTIVE",
                    position: { code: "PENGAWAS_SANTRIWATI" },
                    unit: { code: "OU-OSDA-PUTRI" },
                  },
                ],
              },
            ];
          }
          return [];
        },
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

  it("Track H: osda monitor preflight halts if musyirfah.putri count is not exactly 1", async () => {
    // Zero target users
    const mockZeroPrisma: any = {
      capability: { findUnique: async () => null },
      position: { findUnique: async () => ({ id: "p1", code: "PENGAWAS_SANTRIWATI", isActive: true }) },
      user: { findMany: async () => [] },
      positionCapability: { findMany: async () => [] },
    };
    const zeroReport = await preflightOsdaMonitor(mockZeroPrisma);
    assert.equal(zeroReport.allPreconditionsPass, false);
    assert.ok(zeroReport.validationErrors.some((e) => e.includes("LISA_PREFLIGHT_TARGET")));

    // Multiple target assignments
    const mockMultiPrisma: any = {
      capability: { findUnique: async () => null },
      position: { findUnique: async () => ({ id: "p1", code: "PENGAWAS_SANTRIWATI", isActive: true }) },
      user: {
        findMany: async () => [
          {
            id: "usr-lisa",
            username: "musyirfah.putri",
            assignments: [
              { id: "a1", status: "ACTIVE", unit: { code: "OU-1" } },
              { id: "a2", status: "ACTIVE", unit: { code: "OU-2" } },
            ],
          },
        ],
      },
      positionCapability: { findMany: async () => [] },
    };
    const multiReport = await preflightOsdaMonitor(mockMultiPrisma);
    assert.equal(multiReport.allPreconditionsPass, false);
    assert.ok(multiReport.validationErrors.some((e) => e.includes("LISA_PREFLIGHT_TARGET")));
  });

  it("Track G: osda monitor preflight stops with CONFIG_DRIFT if existing grant does not match DOMAIN", async () => {
    const mockDriftPrisma: any = {
      capability: { findUnique: async () => ({ code: "keasramaan.osda.monitor", namespace: "KEASRAMAAN" }) },
      position: { findUnique: async () => ({ id: "p1", code: "PENGAWAS_SANTRIWATI", isActive: true }) },
      user: {
        findMany: async () => [
          {
            id: "usr-lisa",
            username: "musyirfah.putri",
            assignments: [{ id: "a1", status: "ACTIVE", unit: { code: "OU-1" } }],
          },
        ],
      },
      positionCapability: {
        findMany: async () => [
          {
            id: "pc-drift",
            position: { code: "PENGAWAS_SANTRIWATI" },
            scopeType: ScopeType.GLOBAL, // WRONG SCOPE (expected DOMAIN)
            businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
          },
        ],
      },
    };
    const report = await preflightOsdaMonitor(mockDriftPrisma);
    assert.equal(report.allPreconditionsPass, false);
    assert.ok(report.validationErrors.some((e) => e.includes("CONFIG_DRIFT")));
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
      user: {
        findMany: async () => [
          {
            id: "usr-lisa",
            username: "musyirfah.putri",
            name: "Ustadzah Lisa",
            staffProfile: { nama: "Ustadzah Lisa" },
            assignments: [
              {
                id: "asg-lisa-1",
                status: "ACTIVE",
                position: { code: "PENGAWAS_SANTRIWATI" },
                unit: { code: "OU-OSDA-PUTRI" },
              },
            ],
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
