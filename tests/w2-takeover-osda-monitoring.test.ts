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
import { GenderComplex, OrgDomain } from "@prisma/client";
import {
  PENGAWAS_SANTRIWATI_POSITION_CONTRACT,
  KEASRAMAAN_CAPABILITIES,
} from "../types/architecture-lock";

describe("W2 Track B — Supervisory Takeover (ORR-086)", () => {
  it("allows Atasan (MUDIR / KEPALA_KEASRAMAAN) to execute takeover preserving full provenance", async () => {
    const mockAuditLogs: any[] = [];
    const mockPrisma: any = {
      auditLog: {
        create: async ({ data }: any) => {
          mockAuditLogs.push(data);
          return data;
        },
      },
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
    assert.equal(record.takeoverActor.userId, "usr-mk-supervisor");
    assert.equal(record.takeoverActor.positionCode, "KEPALA_KEASRAMAAN");
    assert.equal(record.reason, "Petugas utama berhalangan hadir dan checklist kebersihan malam belum dijalankan.");
    assert.ok(record.timestamp instanceof Date);
    assert.equal(record.resourceContext.resourceType, "ChecklistRun");
    assert.equal(record.resourceContext.resourceId, "run-chk-101");
    assert.deepEqual(record.beforeState, { status: "DRAFT", lastUpdatedBy: "usr-mudhabbir-1" });
    assert.deepEqual(record.afterState, { status: "PERFORMED", lastUpdatedBy: "usr-mk-supervisor" });

    // Strict invariant checks
    assert.equal(record.attributionPreserved, true);
    assert.equal(record.workflowActivated, false);

    // Audit log check
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, "SUPERVISORY_TAKEOVER");
    assert.equal(mockAuditLogs[0].entity, "ChecklistRun");
  });

  it("strictly denies subordinate or peer from executing takeover", async () => {
    const res = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-room-202",
      originalPic: {
        userId: "usr-pic-1",
        name: "Staff 1",
        positionCode: "PEMBINA_HALAQOH",
      },
      takeoverActor: {
        userId: "usr-peer-2",
        name: "Staff 2",
        positionCode: "PEMBINA_HALAQOH", // Peer, NOT supervisor
      },
      reason: "Menggantikan teman",
      resourceContext: {
        resourceType: "ChecklistRun",
        resourceId: "run-202",
        domain: OrgDomain.KEASRAMAAN,
      },
      beforeState: {},
      afterState: {},
    });

    assert.equal(res.success, false);
    assert.equal(res.code, "SUPERVISORY_AUTHORITY_DENIED");
    assert.match(res.reason || "", /bukan merupakan Atasan \/ Supervisor/i);
  });

  it("strictly denies cross-domain takeover without jurisdiction", () => {
    const check = validateSupervisoryAuthority(
      {
        userId: "usr-kabid-tahfizh",
        positionCode: "KABID_TAHFIZH",
        domain: OrgDomain.TAHFIZH,
      },
      OrgDomain.KEASRAMAAN
    );

    assert.equal(check.authorized, false);
    assert.match(check.reason || "", /tidak memiliki wewenang supervisi atas domain 'KEASRAMAAN'/i);
  });

  it("rejects takeover if mandatory provenance is missing", async () => {
    const resNoAssignment = await executeSupervisoryTakeover({
      originalAssignmentId: "",
      originalPic: { userId: "usr-pic", positionCode: "STAFF" },
      takeoverActor: { userId: "usr-ks", positionCode: "MUDIR" },
      reason: "Kelalaian",
      resourceContext: { resourceType: "Run", resourceId: "1", domain: OrgDomain.KEASRAMAAN },
      beforeState: {},
      afterState: {},
    });
    assert.equal(resNoAssignment.success, false);
    assert.equal(resNoAssignment.code, "INVALID_ASSIGNMENT_ID");

    const resNoReason = await executeSupervisoryTakeover({
      originalAssignmentId: "asg-1",
      originalPic: { userId: "usr-pic", positionCode: "STAFF" },
      takeoverActor: { userId: "usr-ks", positionCode: "MUDIR" },
      reason: "",
      resourceContext: { resourceType: "Run", resourceId: "1", domain: OrgDomain.KEASRAMAAN },
      beforeState: {},
      afterState: {},
    });
    assert.equal(resNoReason.success, false);
    assert.equal(resNoReason.code, "REASON_REQUIRED");
  });
});

describe("W2 Track C — OSDA PUTRI Monitoring Policy (ORR-048 / DIR-2026-016)", () => {
  it("reconciles capability contract: PENGAWAS_SANTRIWATI targetCapabilities includes keasramaan.osda.monitor", () => {
    assert.equal(KEASRAMAAN_CAPABILITIES.OSDA_MONITOR, "keasramaan.osda.monitor");
    assert.ok(
      (PENGAWAS_SANTRIWATI_POSITION_CONTRACT.targetCapabilities as readonly string[]).includes(
        "keasramaan.osda.monitor"
      )
    );
  });

  it("allows PENGAWAS_SANTRIWATI to read/monitor OSDA PUTRI without username hardcoding", () => {
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

  it("strictly denies PENGAWAS_SANTRIWATI from accessing OSDA PUTRA (Zero PUTRA Leakage)", () => {
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

  it("strictly denies ALL OSDA mutations for PENGAWAS_SANTRIWATI (READ-ONLY Invariant)", () => {
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

  it("denies monitoring access to generic/unauthorized positions", () => {
    const res = evaluateOsdaMonitoringAccess({
      actorPositionCode: "GURU_KEPESANTRENAN",
      actorGenderComplex: GenderComplex.PUTRI,
      targetGenderComplex: GenderComplex.PUTRI,
      isMutation: false,
    });

    assert.equal(res.allowed, false);
    assert.equal(res.code, "CAPABILITY_NOT_GRANTED");
  });
});
