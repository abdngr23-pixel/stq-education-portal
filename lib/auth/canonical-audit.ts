/**
 * STQ ARCHITECTURE LOCK — CANONICAL AUDIT ABSTRACTION
 * Forensic Execution Snapshot Logger.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_AUTHORIZATION_MODEL.md
 *  - types/architecture-lock.ts
 *
 * INVARIANTS:
 * 1. Immutable forensic record surviving assignment deactivations and staff turnover.
 * 2. Unambiguous attribution: records both technical account identity and verified human executor.
 * 3. Milestone 2 Safety: DOES NOT write indiscriminately to production database.
 *    Isolated test environments and local runs can record actual persistence.
 */

import { CanonicalAuditRecord, ScopeType } from "@/types/architecture-lock";
import prisma from "@/lib/prisma";

export interface CreateAuditRecordParams {
  technicalAccountId: string;
  technicalAccountUsername: string;
  humanExecutorId?: string | null;
  humanExecutorName?: string | null;
  action: string;
  entity: string;
  entityId: string;
  capabilityCode: string;
  assignmentId?: string | null;
  positionCode: string;
  scopeType: ScopeType;
  unitId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  resourceContext?: Record<string, unknown> | null;
  reason?: string | null;
  clientRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: Date;
}

export type AuditDbClient = {
  canonicalAuditLog: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany?: (args?: any) => Promise<any>;
  };
};

/**
 * Audit log sink interface allowing pluggable storage (in-memory for tests, Prisma for DB)
 */
export interface IAuditSink {
  record(entry: CanonicalAuditRecord, tx?: AuditDbClient): Promise<void>;
  queryByEntity?(entity: string, entityId: string): Promise<CanonicalAuditRecord[]>;
}

/**
 * In-memory audit sink for testing and shadow evaluation without production DB side-effects
 */
export class InMemoryAuditSink implements IAuditSink {
  readonly isPersistent: boolean = false;
  private records: CanonicalAuditRecord[] = [];

  async record(entry: CanonicalAuditRecord): Promise<void> {
    this.records.push({ ...entry });
  }

  async queryByEntity(entity: string, entityId: string): Promise<CanonicalAuditRecord[]> {
    return this.records.filter((r) => r.entity === entity && r.entityId === entityId);
  }

  getRecords(): CanonicalAuditRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}

/**
 * Transaction-bound audit persistence interface for atomic business mutations.
 */
export interface IAuditPersistence {
  readonly isPersistent: true;
  recordInTx(tx: AuditDbClient, record: CanonicalAuditRecord): Promise<void>;
}

/**
 * Prisma-backed audit sink for isolated test environments or production write activation
 */
export class PrismaAuditSink implements IAuditSink {
  private client?: AuditDbClient;

  constructor(client?: AuditDbClient) {
    this.client = client;
  }

  async record(entry: CanonicalAuditRecord, tx?: AuditDbClient): Promise<void> {
    // Check safety: only persist if in test mode or if explicitly allowed
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_CANONICAL_AUDIT_WRITES !== "true") {
      if (tx) {
        throw new Error("AUDIT_PERSISTENCE_REQUIRED: Canonical audit writes are disabled in production (ENABLE_CANONICAL_AUDIT_WRITES !== 'true').");
      }
      return;
    }

    const db = tx || this.client || prisma;
    if (!db || !db.canonicalAuditLog || typeof db.canonicalAuditLog.create !== "function") {
      throw new Error("AUDIT_PERSISTENCE_REQUIRED: Database client does not provide canonicalAuditLog model.");
    }
    await db.canonicalAuditLog.create({
      data: {
        id: entry.id,
        technicalAccountId: entry.technicalAccountId,
        technicalAccountUsername: entry.technicalAccountUsername,
        humanExecutorId: entry.humanExecutorId || null,
        humanExecutorName: entry.humanExecutorName || null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        capabilityCode: entry.capabilityCode,
        assignmentId: entry.assignmentId || null,
        positionCode: entry.positionCode,
        scopeType: entry.scopeType,
        unitId: entry.unitId,
        beforeState: (entry.beforeState as unknown as object) || undefined,
        afterState: (entry.afterState as unknown as object) || undefined,
        resourceContext: (entry.resourceContext as unknown as object) || undefined,
        reason: entry.reason || null,
        clientRequestId: entry.clientRequestId || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        createdAt: entry.timestamp,
      },
    });
  }

  async queryByEntity(entity: string, entityId: string): Promise<CanonicalAuditRecord[]> {
    const rows = await prisma.canonicalAuditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      technicalAccountId: r.technicalAccountId,
      technicalAccountUsername: r.technicalAccountUsername,
      humanExecutorId: r.humanExecutorId,
      humanExecutorName: r.humanExecutorName,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId || "",
      capabilityCode: r.capabilityCode,
      assignmentId: r.assignmentId,
      positionCode: r.positionCode,
      scopeType: r.scopeType as ScopeType,
      unitId: r.unitId,
      beforeState: r.beforeState as Record<string, unknown> | null,
      afterState: r.afterState as Record<string, unknown> | null,
      resourceContext: r.resourceContext as Record<string, unknown> | null,
      reason: r.reason,
      clientRequestId: r.clientRequestId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      timestamp: r.createdAt,
    }));
  }
}

/**
 * Prisma-backed transaction audit persistence for atomic mutation execution.
 */
export class PrismaAuditPersistence implements IAuditPersistence {
  readonly isPersistent = true as const;

  async recordInTx(tx: AuditDbClient, record: CanonicalAuditRecord): Promise<void> {
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_CANONICAL_AUDIT_WRITES !== "true") {
      throw new Error("AUDIT_PERSISTENCE_REQUIRED: Canonical audit writes are disabled in production (ENABLE_CANONICAL_AUDIT_WRITES !== 'true').");
    }

    if (!tx || !tx.canonicalAuditLog || typeof tx.canonicalAuditLog.create !== "function") {
      throw new Error("AUDIT_PERSISTENCE_REQUIRED: Transaction client does not provide canonicalAuditLog model.");
    }

    try {
      await tx.canonicalAuditLog.create({
        data: {
          id: record.id,
          technicalAccountId: record.technicalAccountId,
          technicalAccountUsername: record.technicalAccountUsername,
          humanExecutorId: record.humanExecutorId || null,
          humanExecutorName: record.humanExecutorName || null,
          action: record.action,
          entity: record.entity,
          entityId: record.entityId,
          capabilityCode: record.capabilityCode,
          assignmentId: record.assignmentId || null,
          positionCode: record.positionCode,
          scopeType: record.scopeType,
          unitId: record.unitId,
          beforeState: (record.beforeState as unknown as object) || undefined,
          afterState: (record.afterState as unknown as object) || undefined,
          resourceContext: (record.resourceContext as unknown as object) || undefined,
          reason: record.reason || null,
          clientRequestId: record.clientRequestId || null,
          ipAddress: record.ipAddress || null,
          userAgent: record.userAgent || null,
          createdAt: record.timestamp,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`AUDIT_PERSISTENCE_FAILED: Failed to persist canonical audit in transaction: ${msg}`);
    }
  }
}

/**
 * Global default audit sink (In-memory by default to fail-safe against accidental production writes)
 */
export let activeAuditSink: IAuditSink = new InMemoryAuditSink();

export function setActiveAuditSink(sink: IAuditSink): void {
  activeAuditSink = sink;
}

/**
 * Creates and dispatches a canonical audit record
 */
export async function logCanonicalAudit(
  params: CreateAuditRecordParams,
  sink: IAuditSink = activeAuditSink,
  tx?: AuditDbClient
): Promise<CanonicalAuditRecord> {
  const record: CanonicalAuditRecord = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    technicalAccountId: params.technicalAccountId,
    technicalAccountUsername: params.technicalAccountUsername,
    humanExecutorId: params.humanExecutorId || null,
    humanExecutorName: params.humanExecutorName || null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    capabilityCode: params.capabilityCode,
    assignmentId: params.assignmentId || null,
    positionCode: params.positionCode,
    scopeType: params.scopeType,
    unitId: params.unitId,
    beforeState: params.beforeState || null,
    afterState: params.afterState || null,
    resourceContext: params.resourceContext || null,
    reason: params.reason || null,
    clientRequestId: params.clientRequestId || null,
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    timestamp: params.timestamp || new Date(),
  };

  await sink.record(record, tx);
  return record;
}

export const setAuditSink = setActiveAuditSink;
export const recordCanonicalAudit = logCanonicalAudit;

