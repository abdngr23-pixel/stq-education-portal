/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createChecklistTemplate,
  createChecklistRun,
  recordChecklistPerformance,
  reviewChecklistRun,
  getChecklistRunById,
} from "../lib/server/checklist-service";
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
});
