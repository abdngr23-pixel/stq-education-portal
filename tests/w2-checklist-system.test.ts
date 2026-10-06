/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import {
  createChecklistTemplate,
  createChecklistRun,
  recordChecklistPerformance,
  reviewChecklistRun,
  getChecklistRunById,
} from "../lib/server/checklist-service";
import {
  createChecklistTemplateAction,
  createChecklistRunAction,
  recordChecklistPerformanceAction,
  reviewChecklistRunAction,
} from "../app/actions/checklist";
import {
  parseChecklistSchemaGuards,
  verifyChecklistMigrationSqlAdditive,
} from "../scripts/predeploy-w2-checklist-schema";
import { ChecklistRunStatus, ChecklistItemStatus } from "@prisma/client";

// In-memory mock Prisma client for deterministic, zero-DB-mutation testing
function createMockPrisma() {
  const templates: any[] = [];
  const runs: any[] = [];
  const items: any[] = [];
  const orgUnits: any[] = [
    { id: "OU-ASRAMA-PUTRA", code: "ASR-PA", name: "Asrama Putra", isActive: true },
  ];
  const violationRecords: any[] = []; // Invariant check: MUST REMAIN EMPTY

  const mockTx: any = {
    checklistTemplate: {
      findUnique: async ({ where }: any) => {
        if (where.id) return templates.find((t) => t.id === where.id) || null;
        if (where.code) return templates.find((t) => t.code === where.code) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const record = { id: `tpl_${Date.now()}_${Math.random()}`, ...data, version: 1 };
        templates.push(record);
        return record;
      },
    },
    orgUnit: {
      findUnique: async ({ where }: any) => {
        return orgUnits.find((u) => u.id === where.id) || null;
      },
    },
    checklistRun: {
      findUnique: async ({ where, include }: any) => {
        let run = null;
        if (where.id) run = runs.find((r) => r.id === where.id) || null;
        if (where.clientRequestId) run = runs.find((r) => r.clientRequestId === where.clientRequestId) || null;
        if (run && include?.items) {
          return {
            ...run,
            items: items.filter((i) => i.runId === run.id),
            template: templates.find((t) => t.id === run.templateId) || null,
          };
        }
        return run;
      },
      create: async ({ data, include }: any) => {
        const runId = `run_${Date.now()}_${Math.random()}`;
        const run = {
          id: runId,
          templateId: data.templateId,
          templateVersion: data.templateVersion,
          targetUnitId: data.targetUnitId,
          status: data.status,
          clientRequestId: data.clientRequestId,
          version: data.version,
          scheduledDate: data.scheduledDate,
          metadata: data.metadata,
          performedById: null,
          performedAt: null,
          checkedById: null,
          checkedAt: null,
          correctionNotes: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        runs.push(run);

        if (data.items?.create) {
          for (const itemData of data.items.create) {
            items.push({
              id: `item_${Date.now()}_${Math.random()}`,
              runId,
              itemKey: itemData.itemKey,
              label: itemData.label,
              status: itemData.status,
              notes: null,
              photoUrl: null,
              checkedStatus: null,
              checkedNotes: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        if (include?.items) {
          return {
            ...run,
            items: items.filter((i) => i.runId === runId),
            template: templates.find((t) => t.id === run.templateId) || null,
          };
        }
        return run;
      },
      update: async ({ where, data, include }: any) => {
        const idx = runs.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("Run not found");
        runs[idx] = { ...runs[idx], ...data, updatedAt: new Date() };
        const updated = runs[idx];
        if (include?.items) {
          return {
            ...updated,
            items: items.filter((i) => i.runId === updated.id),
            template: templates.find((t) => t.id === updated.templateId) || null,
          };
        }
        return updated;
      },
    },
    checklistItem: {
      update: async ({ where, data }: any) => {
        const idx = items.findIndex((i) => i.id === where.id);
        if (idx === -1) throw new Error("Item not found");
        items[idx] = { ...items[idx], ...data, updatedAt: new Date() };
        return items[idx];
      },
    },
    pelanggaranSantri: {
      create: async ({ data }: any) => {
        violationRecords.push(data);
        return data;
      },
    },
    $transaction: async (cb: any) => {
      return cb(mockTx);
    },
  };

  return {
    ...mockTx,
    getViolationCount: () => violationRecords.length,
    getRunCount: () => runs.length,
    getTemplateCount: () => templates.length,
  };
}

describe("W2 Checklist System (ORR-098 & ORR-101)", () => {
  it("creates a versioned ChecklistTemplate successfully", async () => {
    const mockPrisma = createMockPrisma();

    const res = await createChecklistTemplate({
      code: "TPL-KEBERSIHAN-KAMAR",
      name: "Checklist Kebersihan Kamar Santri",
      domain: "KEASRAMAAN",
      schema: [
        { key: "lantai_bersih", label: "Lantai disapu dan dipel", required: true },
        { key: "kasur_rapi", label: "Kasur dan sprei tertata rapi", required: true },
        { key: "lemari_tertib", label: "Lemari pakaian tertutup dan tertib", required: false },
      ],
      prismaClient: mockPrisma as any,
    });

    assert.equal(res.success, true);
    assert.ok(res.data);
    const data = res.data as any;
    assert.equal(data.code, "TPL-KEBERSIHAN-KAMAR");
    assert.equal(data.version, 1);
    assert.equal(data.isActive, true);
  });

  it("rejects duplicate template code", async () => {
    const mockPrisma = createMockPrisma();

    await createChecklistTemplate({
      code: "TPL-DUPLICATE",
      name: "Template Satu",
      schema: [{ key: "k1", label: "Item 1" }],
      prismaClient: mockPrisma as any,
    });

    const duplicateRes = await createChecklistTemplate({
      code: "TPL-DUPLICATE",
      name: "Template Dua",
      schema: [{ key: "k2", label: "Item 2" }],
      prismaClient: mockPrisma as any,
    });

    assert.equal(duplicateRes.success, false);
    assert.equal(duplicateRes.code, "DUPLICATE_TEMPLATE_CODE");
  });

  it("creates a ChecklistRun with items matching template schema", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-HARIAN-KAMAR",
      name: "Checklist Harian Kamar",
      schema: [
        { key: "kebersihan", label: "Kebersihan lantai" },
        { key: "kerapihan", label: "Kerapihan kasur" },
      ],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      targetUnitId: "OU-ASRAMA-PUTRA",
      clientRequestId: "req-offline-001",
      prismaClient: mockPrisma as any,
    });

    assert.equal(runRes.success, true);
    const run = runRes.data as any;
    assert.equal(run.status, ChecklistRunStatus.DRAFT);
    assert.equal(run.version, 1);
    assert.equal(run.items.length, 2);
    assert.equal(run.items[0].status, ChecklistItemStatus.PENDING);
  });

  it("idempotently handles duplicate clientRequestId and replays existing run", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-IDEMPOTENT",
      name: "Template Idempotent",
      schema: [{ key: "test", label: "Test" }],
      prismaClient: mockPrisma as any,
    });

    const runRes1 = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      clientRequestId: "offline-uuid-999",
      prismaClient: mockPrisma as any,
    });

    assert.equal(runRes1.success, true);
    assert.equal(runRes1.isIdempotentReplay, undefined);

    const runRes2 = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      clientRequestId: "offline-uuid-999",
      prismaClient: mockPrisma as any,
    });

    assert.equal(runRes2.success, true);
    assert.equal(runRes2.isIdempotentReplay, true);
    assert.equal((runRes2.data as any).id, (runRes1.data as any).id);
  });

  it("records checklist performance and transitions status to PERFORMED", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-INSPECT",
      name: "Template Inspeksi",
      schema: [
        { key: "item_a", label: "Item A" },
        { key: "item_b", label: "Item B" },
      ],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const runId = (runRes.data as any).id;

    const perfRes = await recordChecklistPerformance({
      runId,
      performedById: "usr-mudhabbir-1",
      expectedVersion: 1,
      items: [
        { itemKey: "item_a", status: ChecklistItemStatus.PASS, notes: "Bagus dan bersih" },
        { itemKey: "item_b", status: ChecklistItemStatus.FAIL, notes: "Kasur belum terpasang sprei" },
      ],
      notes: "Pemeriksaan pagi",
      prismaClient: mockPrisma as any,
    });

    assert.equal(perfRes.success, true);
    const updated = perfRes.data as any;
    assert.equal(updated.status, ChecklistRunStatus.PERFORMED);
    assert.equal(updated.performedById, "usr-mudhabbir-1");
    assert.equal(updated.version, 2);

    const itemA = updated.items.find((i: any) => i.itemKey === "item_a");
    const itemB = updated.items.find((i: any) => i.itemKey === "item_b");
    assert.equal(itemA.status, ChecklistItemStatus.PASS);
    assert.equal(itemB.status, ChecklistItemStatus.FAIL);
  });

  it("detects optimistic concurrency conflict if expectedVersion mismatches", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-CONFLICT",
      name: "Template Conflict",
      schema: [{ key: "c1", label: "C1" }],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const runId = (runRes.data as any).id;

    // First update bumps version to 2
    await recordChecklistPerformance({
      runId,
      performedById: "user-1",
      expectedVersion: 1,
      items: [{ itemKey: "c1", status: ChecklistItemStatus.PASS }],
      prismaClient: mockPrisma as any,
    });

    // Concurrent/stale update using expectedVersion = 1 must fail
    const staleRes = await recordChecklistPerformance({
      runId,
      performedById: "user-2",
      expectedVersion: 1,
      items: [{ itemKey: "c1", status: ChecklistItemStatus.FAIL }],
      prismaClient: mockPrisma as any,
    });

    assert.equal(staleRes.success, false);
    assert.equal(staleRes.code, "CONFLICT_VERSION_MISMATCH");
  });

  it("full lifecycle: PERFORMED -> NEEDS_CORRECTION -> PERFORMED -> COMPLETED", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-LIFECYCLE",
      name: "Template Lifecycle",
      schema: [{ key: "k1", label: "Kamar mandi" }],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const runId = (runRes.data as any).id;

    // 1. Perform
    const p1 = await recordChecklistPerformance({
      runId,
      performedById: "mudhabbir",
      expectedVersion: 1,
      items: [{ itemKey: "k1", status: ChecklistItemStatus.FAIL }],
      prismaClient: mockPrisma as any,
    });
    assert.equal(p1.success, true);
    assert.equal((p1.data as any).status, ChecklistRunStatus.PERFORMED);

    // 2. Supervisor Review: NEEDS_CORRECTION
    const r1 = await reviewChecklistRun({
      runId,
      checkedById: "supervisor-ks",
      decision: "NEEDS_CORRECTION",
      correctionNotes: "Lantai masih licin, tolong dibersihkan ulang.",
      expectedVersion: 2,
      prismaClient: mockPrisma as any,
    });
    assert.equal(r1.success, true);
    assert.equal((r1.data as any).status, ChecklistRunStatus.NEEDS_CORRECTION);
    assert.equal((r1.data as any).correctionNotes, "Lantai masih licin, tolong dibersihkan ulang.");

    // 3. Re-perform
    const p2 = await recordChecklistPerformance({
      runId,
      performedById: "mudhabbir",
      expectedVersion: 3,
      items: [{ itemKey: "k1", status: ChecklistItemStatus.PASS, notes: "Sudah dibersihkan ulang" }],
      prismaClient: mockPrisma as any,
    });
    assert.equal(p2.success, true);
    assert.equal((p2.data as any).status, ChecklistRunStatus.PERFORMED);

    // 4. Supervisor Review: COMPLETED
    const r2 = await reviewChecklistRun({
      runId,
      checkedById: "supervisor-ks",
      decision: "COMPLETED",
      expectedVersion: 4,
      prismaClient: mockPrisma as any,
    });
    assert.equal(r2.success, true);
    assert.equal((r2.data as any).status, ChecklistRunStatus.COMPLETED);
    assert.equal((r2.data as any).version, 5);
  });

  it("strictly enforces invariant: failures do NOT automatically create discipline violations", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-DISCIPLINE-ISOLATION",
      name: "Template Isolasi Kedisiplinan",
      schema: [{ key: "d1", label: "Pelanggaran Potensial" }],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const runId = (runRes.data as any).id;

    // Perform with FAIL
    await recordChecklistPerformance({
      runId,
      performedById: "officer-osda",
      items: [{ itemKey: "d1", status: ChecklistItemStatus.FAIL, notes: "Barang terlarang ditemukan" }],
      prismaClient: mockPrisma as any,
    });

    // Review with NEEDS_CORRECTION
    await reviewChecklistRun({
      runId,
      checkedById: "supervisor-ks",
      decision: "NEEDS_CORRECTION",
      correctionNotes: "Perlu ditindaklanjuti secara manual, tanpa auto-violation",
      prismaClient: mockPrisma as any,
    });

    // Invariant verification: Zero records in violation model
    assert.equal(mockPrisma.getViolationCount(), 0);
  });

  it("allows inspecting checklist run with getChecklistRunById", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-INSPECT-RUN",
      name: "Template Inspect",
      schema: [{ key: "i1", label: "Inspect Item" }],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const res = await getChecklistRunById((runRes.data as any).id, mockPrisma as any);
    assert.equal(res.success, true);
    assert.equal((res.data as any).id, (runRes.data as any).id);
  });

  // Track 2A: External Server Mutation Actions Fail-Closed & Zero DB Writes
  it("Track 2A: externally callable checklist mutation actions fail closed with POLICY_NOT_ACTIVE and perform 0 DB writes", async () => {
    // 1. Template creation action
    const tplRes = await createChecklistTemplateAction({
      code: "TPL-FAIL-CLOSED",
      name: "Template Fail Closed",
      schema: [{ key: "f1", label: "Fail Item" }],
    });
    assert.equal(tplRes.success, false);
    assert.equal(tplRes.error, "POLICY_NOT_ACTIVE");
    assert.match(tplRes.message, /POLICY_NOT_ACTIVE/i);

    // 2. Run creation action
    const runRes = await createChecklistRunAction({
      templateId: "tpl-dummy",
    });
    assert.equal(runRes.success, false);
    assert.equal(runRes.error, "POLICY_NOT_ACTIVE");
    assert.match(runRes.message, /POLICY_NOT_ACTIVE/i);

    // 3. Performance recording action
    const perfRes = await recordChecklistPerformanceAction({
      runId: "run-dummy",
      items: [{ itemKey: "f1", status: ChecklistItemStatus.PASS }],
    });
    assert.equal(perfRes.success, false);
    assert.equal(perfRes.error, "POLICY_NOT_ACTIVE");
    assert.match(perfRes.message, /POLICY_NOT_ACTIVE/i);

    // 4. Review action
    const revRes = await reviewChecklistRunAction({
      runId: "run-dummy",
      decision: "COMPLETED",
    });
    assert.equal(revRes.success, false);
    assert.equal(revRes.error, "POLICY_NOT_ACTIVE");
    assert.match(revRes.message, /POLICY_NOT_ACTIVE/i);
  });

  // Track 2D: Idempotency with Conflicting Payload Fails Closed
  it("Track 2D: same clientRequestId + conflicting payload fails closed with CONFLICT_CLIENT_REQUEST_ID", async () => {
    const mockPrisma = createMockPrisma();

    const tpl1 = await createChecklistTemplate({
      code: "TPL-PAYLOAD-1",
      name: "Template Payload 1",
      schema: [{ key: "p1", label: "P1" }],
      prismaClient: mockPrisma as any,
    });
    const tpl2 = await createChecklistTemplate({
      code: "TPL-PAYLOAD-2",
      name: "Template Payload 2",
      schema: [{ key: "p2", label: "P2" }],
      prismaClient: mockPrisma as any,
    });

    const initialRes = await createChecklistRun({
      templateId: (tpl1.data as any).id,
      clientRequestId: "req-conflict-check-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(initialRes.success, true);

    // Replay with DIFFERENT templateId (conflicting payload)
    const conflictRes = await createChecklistRun({
      templateId: (tpl2.data as any).id,
      clientRequestId: "req-conflict-check-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(conflictRes.success, false);
    assert.equal(conflictRes.code, "CONFLICT_CLIENT_REQUEST_ID");
    assert.match(conflictRes.reason || "", /conflicting payload/i);
  });

  // Track 2D: Network Retry with Duplicate clientRequestId
  it("Track 2D: network-style retry with duplicate clientRequestId produces exactly one durable mutation", async () => {
    const mockPrisma = createMockPrisma();

    const tpl = await createChecklistTemplate({
      code: "TPL-RETRY-TEST",
      name: "Template Retry Test",
      schema: [{ key: "r1", label: "R1" }],
      prismaClient: mockPrisma as any,
    });

    // Request 1
    const res1 = await createChecklistRun({
      templateId: (tpl.data as any).id,
      clientRequestId: "network-retry-uuid-777",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);
    assert.equal(res1.isIdempotentReplay, undefined);
    assert.equal(mockPrisma.getRunCount(), 1);

    // Simulated network retry (identical payload + clientRequestId)
    const res2 = await createChecklistRun({
      templateId: (tpl.data as any).id,
      clientRequestId: "network-retry-uuid-777",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, true);
    assert.equal(res2.isIdempotentReplay, true);
    assert.equal((res2.data as any).id, (res1.data as any).id);
    assert.equal(mockPrisma.getRunCount(), 1);
  });

  // Track 2C: Schema Preflight & Guard Safety
  it("Track 2C: migration safety - predeploy script guards enforce read-only default and require approved flags", () => {
    const defaultGuards = parseChecklistSchemaGuards([], {});
    assert.equal(defaultGuards.hasExecuteFlag, false);
    assert.equal(defaultGuards.hasApprovedScopeFlag, false);
    assert.equal(defaultGuards.hasEnvApproval, false);
    assert.equal(defaultGuards.isExecuteApproved, false);

    const partialGuards = parseChecklistSchemaGuards(["--execute"], {});
    assert.equal(partialGuards.isExecuteApproved, false);

    const approvedGuards = parseChecklistSchemaGuards(
      ["--execute", "--approved-scope=W2-CHECKLIST-SCHEMA"],
      { PRODUCTION_MUTATION_APPROVED: "W2-CHECKLIST-SCHEMA" }
    );
    assert.equal(approvedGuards.isExecuteApproved, true);
  });

  // Track 2C: Migration Contents are ADDITIVE ONLY
  it("Track 2C: migration safety - checklist migration SQL is strictly ADDITIVE ONLY with zero destructive statements", async () => {
    const migrationSqlPath = path.join(
      process.cwd(),
      "prisma",
      "migrations",
      "20261006150000_w2_checklist_system",
      "migration.sql"
    );
    const result = await verifyChecklistMigrationSqlAdditive(migrationSqlPath);
    assert.equal(result.isAdditiveOnly, true);
    assert.equal(result.destructiveKeywordsFound.length, 0);
  });
});
