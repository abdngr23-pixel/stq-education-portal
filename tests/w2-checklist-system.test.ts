/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import * as fs from "fs";
import {
  createChecklistTemplate,
  createChecklistRun,
  recordChecklistPerformance,
  reviewChecklistRun,
  getChecklistRunById,
  canonicalizeJson,
  computeChecklistPayloadHash,
} from "../lib/server/checklist-service";
import {
  createChecklistTemplateAction,
  createChecklistRunAction,
  recordChecklistPerformanceAction,
  reviewChecklistRunAction,
  getChecklistRunAction,
} from "../app/actions/checklist";
import {
  parseChecklistSchemaGuards,
  verifyChecklistMigrationSqlAdditive,
  runChecklistSchemaPreflight,
} from "../scripts/predeploy-w2-checklist-schema";
import { ChecklistRunStatus, ChecklistItemStatus } from "@prisma/client";

// In-memory mock Prisma client for deterministic, zero-DB-mutation testing
function createMockPrisma() {
  const templates: any[] = [];
  const runs: any[] = [];
  const items: any[] = [];
  const orgUnits: any[] = [
    { id: "OU-ASRAMA-PUTRA", code: "ASR-PA", name: "Asrama Putra", isActive: true },
    { id: "OU-ASRAMA-PUTRI", code: "ASR-PI", name: "Asrama Putri", isActive: true },
  ];
  const violationRecords: any[] = []; // Invariant check: MUST REMAIN EMPTY
  let itemUpdateCount = 0;
  let runUpdateManySuccessCount = 0;

  const mockTx: any = {
    checklistTemplate: {
      findFirst: async ({ where, orderBy }: any) => {
        let matched = templates.filter((t) => !where?.code || t.code === where.code);
        if (orderBy?.version === "desc") {
          matched = [...matched].sort((a, b) => b.version - a.version);
        }
        return matched[0] || null;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return templates.find((t) => t.id === where.id) || null;
        if (where.code_version) {
          return (
            templates.find(
              (t) => t.code === where.code_version.code && t.version === where.code_version.version
            ) || null
          );
        }
        if (where.code) return templates.find((t) => t.code === where.code) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const record = { id: `tpl_${Date.now()}_${Math.random()}`, ...data };
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
        if (data.clientRequestId && runs.some((r) => r.clientRequestId === data.clientRequestId)) {
          const err: any = new Error("Unique constraint failed on the fields: (client_request_id)");
          err.code = "P2002";
          throw err;
        }
        const runId = `run_${Date.now()}_${Math.random()}`;
        const run = {
          id: runId,
          templateId: data.templateId,
          templateVersion: data.templateVersion,
          targetUnitId: data.targetUnitId,
          status: data.status,
          clientRequestId: data.clientRequestId,
          requestPayloadHash: data.requestPayloadHash || null,
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
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (let idx = 0; idx < runs.length; idx++) {
          const r = runs[idx];
          if (r.id === where.id && (where.version === undefined || r.version === where.version)) {
            const newVersion = data.version?.increment ? r.version + data.version.increment : (data.version || r.version);
            runs[idx] = { ...r, ...data, version: newVersion, updatedAt: new Date() };
            count++;
            runUpdateManySuccessCount++;
          }
        }
        return { count };
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
        itemUpdateCount++;
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
    user: {
      count: async ({ where }: any) => {
        if (where?.username === "mudir") return 1;
        return 0;
      },
    },
    $transaction: async (cb: any) => {
      return cb(mockTx);
    },
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes("information_schema.tables")) {
        return [
          { table_name: "checklist_templates" },
          { table_name: "checklist_runs" },
          { table_name: "checklist_items" },
        ];
      }
      if (sql.includes("_prisma_migrations")) {
        // Return simulated list of applied migrations up to the previous one
        return [
          { migration_name: "20260901000000_init" },
          { migration_name: "20260920000000_auth_rbac" },
        ];
      }
      return [];
    },
  };

  return {
    ...mockTx,
    getViolationCount: () => violationRecords.length,
    getRunCount: () => runs.length,
    getTemplateCount: () => templates.length,
    getItemUpdateCount: () => itemUpdateCount,
    getRunUpdateManySuccessCount: () => runUpdateManySuccessCount,
    getRuns: () => runs,
    getItems: () => items,
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

  it("supports real template versioning: logical code can repeat with incrementing immutable versions", async () => {
    const mockPrisma = createMockPrisma();

    // 1. Create version 1
    const v1Res = await createChecklistTemplate({
      code: "TPL-KEBERSIHAN",
      name: "Checklist Kebersihan v1",
      schema: [{ key: "k1", label: "Item 1" }],
      prismaClient: mockPrisma as any,
    });
    assert.equal(v1Res.success, true);
    const v1Data = v1Res.data as any;
    assert.equal(v1Data.version, 1);
    assert.equal(v1Data.code, "TPL-KEBERSIHAN");

    // Create a run against v1
    const runV1 = await createChecklistRun({
      templateId: v1Data.id,
      prismaClient: mockPrisma as any,
    });
    assert.equal(runV1.success, true);
    assert.equal((runV1.data as any).templateVersion, 1);

    // 2. Create version 2 with same code
    const v2Res = await createChecklistTemplate({
      code: "TPL-KEBERSIHAN",
      name: "Checklist Kebersihan v2",
      schema: [{ key: "k1", label: "Item 1" }, { key: "k2", label: "Item 2" }],
      prismaClient: mockPrisma as any,
    });
    assert.equal(v2Res.success, true);
    const v2Data = v2Res.data as any;
    assert.equal(v2Data.version, 2);
    assert.equal(v2Data.code, "TPL-KEBERSIHAN");
    assert.notEqual(v1Data.id, v2Data.id);

    // Old template v1 remains immutable and preserved
    const fetchedV1 = await mockPrisma.checklistTemplate.findUnique({
      where: { id: v1Data.id },
    });
    assert.equal(fetchedV1.version, 1);

    // Create a run against v2
    const runV2 = await createChecklistRun({
      templateId: v2Data.id,
      prismaClient: mockPrisma as any,
    });
    assert.equal(runV2.success, true);
    assert.equal((runV2.data as any).templateVersion, 2);

    // Verify historical run against v1 remains linked to version 1
    const fetchedRunV1 = await mockPrisma.checklistRun.findUnique({
      where: { id: (runV1.data as any).id },
    });
    assert.equal(fetchedRunV1.templateVersion, 1);

    // 3. Reject explicit duplicate (code, version) tuple
    const dupRes = await createChecklistTemplate({
      code: "TPL-KEBERSIHAN",
      name: "Checklist Kebersihan Duplicate v1",
      version: 1,
      schema: [{ key: "k1", label: "Item 1" }],
      prismaClient: mockPrisma as any,
    });
    assert.equal(dupRes.success, false);
    assert.equal(dupRes.code, "DUPLICATE_TEMPLATE_VERSION");
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

  it("atomic optimistic concurrency under real simultaneous transitions: exactly one winner, loser gets CONFLICT_VERSION_MISMATCH", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-CONCURRENT-OPT",
      name: "Template Concurrent Opt",
      schema: [{ key: "c1", label: "C1" }],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const runId = (runRes.data as any).id;

    // Simultaneous updates both targeting expectedVersion = 1
    const [p1, p2] = await Promise.all([
      recordChecklistPerformance({
        runId,
        performedById: "user-alpha",
        expectedVersion: 1,
        items: [{ itemKey: "c1", status: ChecklistItemStatus.PASS }],
        prismaClient: mockPrisma as any,
      }),
      recordChecklistPerformance({
        runId,
        performedById: "user-beta",
        expectedVersion: 1,
        items: [{ itemKey: "c1", status: ChecklistItemStatus.FAIL }],
        prismaClient: mockPrisma as any,
      }),
    ]);

    const successes = [p1, p2].filter((r) => r.success);
    const conflicts = [p1, p2].filter((r) => !r.success && r.code === "CONFLICT_VERSION_MISMATCH");

    assert.equal(successes.length, 1);
    assert.equal(conflicts.length, 1);
  });

  it("NON-NEGOTIABLE Track A: genuinely concurrent calls with same expectedVersion guarantee zero loser item writes and zero loser run writes", async () => {
    const mockPrisma = createMockPrisma();

    const tplRes = await createChecklistTemplate({
      code: "TPL-CONCURRENT-ZERO-WRITE",
      name: "Template Concurrent Zero Write",
      schema: [
        { key: "c1", label: "Check 1" },
        { key: "c2", label: "Check 2" },
      ],
      prismaClient: mockPrisma as any,
    });

    const runRes = await createChecklistRun({
      templateId: (tplRes.data as any).id,
      prismaClient: mockPrisma as any,
    });

    const runId = (runRes.data as any).id;
    const initialItemUpdateCount = mockPrisma.getItemUpdateCount();
    const initialRunUpdateManySuccessCount = mockPrisma.getRunUpdateManySuccessCount();

    // Two genuinely concurrent calls with same expectedVersion = 1
    const [p1, p2] = await Promise.all([
      recordChecklistPerformance({
        runId,
        performedById: "winner-candidate-1",
        expectedVersion: 1,
        items: [
          { itemKey: "c1", status: ChecklistItemStatus.PASS, notes: "Candidate 1 item 1" },
          { itemKey: "c2", status: ChecklistItemStatus.PASS, notes: "Candidate 1 item 2" },
        ],
        prismaClient: mockPrisma as any,
      }),
      recordChecklistPerformance({
        runId,
        performedById: "winner-candidate-2",
        expectedVersion: 1,
        items: [
          { itemKey: "c1", status: ChecklistItemStatus.FAIL, notes: "Candidate 2 item 1" },
          { itemKey: "c2", status: ChecklistItemStatus.FAIL, notes: "Candidate 2 item 2" },
        ],
        prismaClient: mockPrisma as any,
      }),
    ]);

    const winner = p1.success ? p1 : p2;
    const loser = !p1.success ? p1 : p2;

    assert.equal(winner.success, true);
    assert.equal(loser.success, false);
    assert.equal(loser.code, "CONFLICT_VERSION_MISMATCH");

    // Invariant: Final run version was bumped by winner only (from 1 to 2)
    const finalRun = (mockPrisma.getRuns() as any[]).find((r) => r.id === runId);
    assert.equal(finalRun.version, 2);

    // Invariant: Exactly ONE run update succeeded across both calls (winner only)
    assert.equal(mockPrisma.getRunUpdateManySuccessCount() - initialRunUpdateManySuccessCount, 1);

    // Invariant: Exactly the winner's items (2 items) were written. Loser wrote 0 items!
    const totalItemUpdates = mockPrisma.getItemUpdateCount() - initialItemUpdateCount;
    assert.equal(totalItemUpdates, 2); // exactly winner's 2 items

    // Invariant: The item records in DB match winner's payload only, zero partial writes from loser
    const currentItems = (mockPrisma.getItems() as any[]).filter((i) => i.runId === runId);
    if ((winner.data as any).performedById === "winner-candidate-1") {
      assert.equal(currentItems.find((i) => i.itemKey === "c1").status, ChecklistItemStatus.PASS);
      assert.equal(currentItems.find((i) => i.itemKey === "c1").notes, "Candidate 1 item 1");
      assert.equal(currentItems.find((i) => i.itemKey === "c2").status, ChecklistItemStatus.PASS);
      assert.equal(currentItems.find((i) => i.itemKey === "c2").notes, "Candidate 1 item 2");
    } else {
      assert.equal(currentItems.find((i) => i.itemKey === "c1").status, ChecklistItemStatus.FAIL);
      assert.equal(currentItems.find((i) => i.itemKey === "c1").notes, "Candidate 2 item 1");
      assert.equal(currentItems.find((i) => i.itemKey === "c2").status, ChecklistItemStatus.FAIL);
      assert.equal(currentItems.find((i) => i.itemKey === "c2").notes, "Candidate 2 item 2");
    }
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

    // 5. Run detail read action
    const getRes = await getChecklistRunAction("run-dummy");
    assert.equal(getRes.success, false);
    assert.equal(getRes.error, "POLICY_NOT_ACTIVE");
    assert.match(getRes.message, /POLICY_NOT_ACTIVE/i);
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

  // Track 2D: Simultaneous Concurrent Requests with Same clientRequestId Produce Exactly One Mutation
  it("Track 2D: concurrent race with identical clientRequestId results in exactly ONE durable run and IDEMPOTENT_REPLAY", async () => {
    const mockPrisma = createMockPrisma();

    const tpl = await createChecklistTemplate({
      code: "TPL-CONCURRENT-RACE",
      name: "Template Concurrent Race",
      schema: [{ key: "r1", label: "R1" }],
      prismaClient: mockPrisma as any,
    });

    const [res1, res2] = await Promise.all([
      createChecklistRun({
        templateId: (tpl.data as any).id,
        clientRequestId: "simultaneous-race-001",
        prismaClient: mockPrisma as any,
      }),
      createChecklistRun({
        templateId: (tpl.data as any).id,
        clientRequestId: "simultaneous-race-001",
        prismaClient: mockPrisma as any,
      }),
    ]);

    assert.equal(res1.success, true);
    assert.equal(res2.success, true);
    assert.equal(mockPrisma.getRunCount(), 1);
    assert.equal((res1.data as any).id, (res2.data as any).id);

    const replays = [res1.isIdempotentReplay, res2.isIdempotentReplay].filter(Boolean);
    assert.equal(replays.length, 1);
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

  // Track B: Full Idempotency Fingerprint & Canonical Key Ordering
  it("Track B: canonicalizeJson produces deterministic string regardless of metadata object key order", () => {
    const objA = { b: 2, a: 1, c: { z: "foo", y: "bar" } };
    const objB = { a: 1, c: { y: "bar", z: "foo" }, b: 2 };

    assert.equal(canonicalizeJson(objA), canonicalizeJson(objB));
    assert.equal(canonicalizeJson(objA), '{"a":1,"b":2,"c":{"y":"bar","z":"foo"}}');
  });

  it("Track B: computeChecklistPayloadHash produces identical hash for same payload with different metadata key ordering", () => {
    const hash1 = computeChecklistPayloadHash({
      templateId: "tpl-123",
      targetUnitId: "OU-ASRAMA-PUTRA",
      scheduledDate: new Date("2026-10-10T08:00:00Z"),
      metadata: { priority: "HIGH", inspector: "Ust. Ahmad" },
    });
    const hash2 = computeChecklistPayloadHash({
      templateId: "tpl-123",
      targetUnitId: "OU-ASRAMA-PUTRA",
      scheduledDate: new Date("2026-10-10T08:00:00Z"),
      metadata: { inspector: "Ust. Ahmad", priority: "HIGH" },
    });

    assert.equal(hash1, hash2);
  });

  it("Track B: same exact payload with duplicate clientRequestId returns IDEMPOTENT_REPLAY", async () => {
    const mockPrisma = createMockPrisma();
    const tpl = await createChecklistTemplate({
      code: "TPL-FP-SAME",
      name: "Template FP Same",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const templateId = (tpl.data as any).id;
    const scheduledDate = new Date("2026-10-10T00:00:00Z");

    const res1 = await createChecklistRun({
      templateId,
      targetUnitId: "OU-ASRAMA-PUTRA",
      scheduledDate,
      clientRequestId: "req-fp-same-001",
      metadata: { note: "inspection 1" },
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);
    assert.equal(res1.isIdempotentReplay, undefined);

    const res2 = await createChecklistRun({
      templateId,
      targetUnitId: "OU-ASRAMA-PUTRA",
      scheduledDate,
      clientRequestId: "req-fp-same-001",
      metadata: { note: "inspection 1" },
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, true);
    assert.equal(res2.isIdempotentReplay, true);
    assert.equal((res2.data as any).id, (res1.data as any).id);
    assert.equal(mockPrisma.getRunCount(), 1);
  });

  it("Track B: different templateId with duplicate clientRequestId returns CONFLICT_CLIENT_REQUEST_ID", async () => {
    const mockPrisma = createMockPrisma();
    const tpl1 = await createChecklistTemplate({
      code: "TPL-FP-DIFF-TPL-1",
      name: "Template 1",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const tpl2 = await createChecklistTemplate({
      code: "TPL-FP-DIFF-TPL-2",
      name: "Template 2",
      schema: [{ key: "f2", label: "F2" }],
      prismaClient: mockPrisma as any,
    });

    const res1 = await createChecklistRun({
      templateId: (tpl1.data as any).id,
      clientRequestId: "req-diff-tpl-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);

    const res2 = await createChecklistRun({
      templateId: (tpl2.data as any).id,
      clientRequestId: "req-diff-tpl-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, false);
    assert.equal(res2.code, "CONFLICT_CLIENT_REQUEST_ID");
    assert.match(res2.reason || "", /conflicting payload fingerprint/i);
  });

  it("Track B: different targetUnitId with duplicate clientRequestId returns CONFLICT_CLIENT_REQUEST_ID", async () => {
    const mockPrisma = createMockPrisma();
    const tpl = await createChecklistTemplate({
      code: "TPL-FP-DIFF-UNIT",
      name: "Template Unit Test",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const templateId = (tpl.data as any).id;

    const res1 = await createChecklistRun({
      templateId,
      targetUnitId: "OU-ASRAMA-PUTRA",
      clientRequestId: "req-diff-unit-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);

    const res2 = await createChecklistRun({
      templateId,
      targetUnitId: "OU-ASRAMA-PUTRI",
      clientRequestId: "req-diff-unit-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, false);
    assert.equal(res2.code, "CONFLICT_CLIENT_REQUEST_ID");
    assert.match(res2.reason || "", /conflicting payload fingerprint/i);
  });

  it("Track B: different scheduledDate with duplicate clientRequestId returns CONFLICT_CLIENT_REQUEST_ID", async () => {
    const mockPrisma = createMockPrisma();
    const tpl = await createChecklistTemplate({
      code: "TPL-FP-DIFF-DATE",
      name: "Template Date Test",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const templateId = (tpl.data as any).id;

    const res1 = await createChecklistRun({
      templateId,
      scheduledDate: new Date("2026-10-10T00:00:00Z"),
      clientRequestId: "req-diff-date-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);

    const res2 = await createChecklistRun({
      templateId,
      scheduledDate: new Date("2026-10-11T00:00:00Z"),
      clientRequestId: "req-diff-date-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, false);
    assert.equal(res2.code, "CONFLICT_CLIENT_REQUEST_ID");
    assert.match(res2.reason || "", /conflicting payload fingerprint/i);
  });

  it("Track B: different metadata with duplicate clientRequestId returns CONFLICT_CLIENT_REQUEST_ID", async () => {
    const mockPrisma = createMockPrisma();
    const tpl = await createChecklistTemplate({
      code: "TPL-FP-DIFF-META",
      name: "Template Meta Test",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const templateId = (tpl.data as any).id;

    const res1 = await createChecklistRun({
      templateId,
      metadata: { shift: "MORNING" },
      clientRequestId: "req-diff-meta-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);

    const res2 = await createChecklistRun({
      templateId,
      metadata: { shift: "EVENING" },
      clientRequestId: "req-diff-meta-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, false);
    assert.equal(res2.code, "CONFLICT_CLIENT_REQUEST_ID");
    assert.match(res2.reason || "", /conflicting payload fingerprint/i);
  });

  it("Track B: same metadata with different object key ordering returns IDEMPOTENT_REPLAY", async () => {
    const mockPrisma = createMockPrisma();
    const tpl = await createChecklistTemplate({
      code: "TPL-FP-KEY-ORDER",
      name: "Template Key Order Test",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const templateId = (tpl.data as any).id;

    const res1 = await createChecklistRun({
      templateId,
      metadata: { alpha: 1, beta: 2, nested: { x: 10, y: 20 } },
      clientRequestId: "req-key-order-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res1.success, true);

    const res2 = await createChecklistRun({
      templateId,
      metadata: { beta: 2, nested: { y: 20, x: 10 }, alpha: 1 },
      clientRequestId: "req-key-order-001",
      prismaClient: mockPrisma as any,
    });
    assert.equal(res2.success, true);
    assert.equal(res2.isIdempotentReplay, true);
    assert.equal((res2.data as any).id, (res1.data as any).id);
    assert.equal(mockPrisma.getRunCount(), 1);
  });

  it("Track B: parallel conflicting payload results in exactly one durable run and one conflict", async () => {
    const mockPrisma = createMockPrisma();
    const tpl1 = await createChecklistTemplate({
      code: "TPL-PARALLEL-DIFF-1",
      name: "Parallel Diff 1",
      schema: [{ key: "f1", label: "F1" }],
      prismaClient: mockPrisma as any,
    });
    const tpl2 = await createChecklistTemplate({
      code: "TPL-PARALLEL-DIFF-2",
      name: "Parallel Diff 2",
      schema: [{ key: "f2", label: "F2" }],
      prismaClient: mockPrisma as any,
    });

    const [res1, res2] = await Promise.all([
      createChecklistRun({
        templateId: (tpl1.data as any).id,
        clientRequestId: "parallel-diff-req-001",
        prismaClient: mockPrisma as any,
      }),
      createChecklistRun({
        templateId: (tpl2.data as any).id,
        clientRequestId: "parallel-diff-req-001",
        prismaClient: mockPrisma as any,
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const conflicts = [res1, res2].filter((r) => !r.success && r.code === "CONFLICT_CLIENT_REQUEST_ID");

    assert.equal(successes.length, 1);
    assert.equal(conflicts.length, 1);
    assert.equal(mockPrisma.getRunCount(), 1);
  });

  // Track C: Predeploy Exact Migration Set Verification
  it("Track C: predeploy script verifies exact pending migration set difference and enforces {20261006150000_w2_checklist_system}", async () => {
    // When all prior migrations on disk are in _prisma_migrations except 20261006150000_w2_checklist_system:
    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    const diskDirs = fs
      .readdirSync(migrationsDir)
      .filter((f: string) => fs.statSync(path.join(migrationsDir, f)).isDirectory() && !f.startsWith("."));

    const appliedPrior = diskDirs
      .filter((d: string) => d !== "20261006150000_w2_checklist_system")
      .map((d: string) => ({ migration_name: d }));

    const mockPrismaForMigration = {
      user: { count: async () => 1 },
      orgUnit: { count: async () => 1 },
      $queryRawUnsafe: async (sql: string) => {
        if (sql.includes("information_schema.tables")) {
          return [];
        }
        if (sql.includes("_prisma_migrations")) {
          return appliedPrior;
        }
        return [];
      },
    };

    const report = await runChecklistSchemaPreflight(mockPrismaForMigration as any);
    assert.equal(report.expectedPendingSetMatches, true);
    assert.equal(report.otherPendingMigrationsCount, 0);
    assert.deepEqual(report.actualPendingMigrationsList, ["20261006150000_w2_checklist_system"]);
    assert.equal(report.canExecuteSafely, true);
  });
});
