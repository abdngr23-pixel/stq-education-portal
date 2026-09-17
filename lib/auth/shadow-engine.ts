/**
 * STQ ARCHITECTURE LOCK — SHADOW & PARITY ENGINE
 * Dual-Evaluation Bridge: Evaluates Legacy vs Canonical in Shadow Mode.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_AUTHORIZATION_MODEL.md
 *  - docs/STQ_COMPATIBILITY_MAP.md
 *  - types/architecture-lock.ts
 *
 * NON-NEGOTIABLE RUNTIME INVARIANT:
 * 1. LEGACY AUTHORIZATION REMAINS 100% AUTHORITATIVE.
 * 2. Runtime access decisions ALWAYS follow the legacy authorization result.
 * 3. Canonical decisions are evaluated purely in SHADOW / PARITY mode.
 * 4. Mismatches are recorded without altering real user permissions.
 * 5. Generic logs NEVER expose sensitive guardian or student PII.
 */

import { UserSession } from "@/types/auth";
import {
  RequestedResourceContext,
  ResolvedResourceContext,
  ScopeType,
} from "@/types/architecture-lock";
import {
  authorizeCanonical,
  CanonicalAuthorizationDecision,
  ICanonicalDataProvider,
} from "./canonical-evaluator";

/**
 * Parity Status Classification
 */
export type ParityStatus =
  | "MATCH_ALLOW"               // Both legacy and canonical permit access
  | "MATCH_DENY"                // Both legacy and canonical deny access
  | "MISMATCH_LEGACY_ALLOW"     // Legacy permits, canonical denies (e.g. unmigrated role or missing assignment)
  | "MISMATCH_CANONICAL_ALLOW"  // Canonical permits, legacy denies (e.g. newly modeled fine-grained grant)
  | "ERROR";                    // An error occurred during evaluation

/**
 * Structured Parity Log Record for telemetry and audit
 */
export interface ParityRecord {
  id: string;
  timestamp: Date;
  identityId: string;
  identityUsername: string;
  capabilityCode: string;
  legacyDecision: boolean;
  canonicalDecision: boolean;
  parityStatus: ParityStatus;
  reasonCode: string;
  scopeType?: ScopeType;
  assignmentId?: string;
  positionCode?: string;
  resourceType?: string;
  resourceId?: string; // Anonymized / non-sensitive identifier
  details?: string;
}

/**
 * Storage sink for parity records
 */
export interface IParitySink {
  record(parity: ParityRecord): Promise<void>;
  getRecords(): ParityRecord[];
  clear(): void;
}

/**
 * In-memory sink for testing and local analysis
 */
export class InMemoryParitySink implements IParitySink {
  private records: ParityRecord[] = [];

  async record(parity: ParityRecord): Promise<void> {
    this.records.push({ ...parity });
  }

  getRecords(): ParityRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}

export let activeParitySink: IParitySink = new InMemoryParitySink();

export function setActiveParitySink(sink: IParitySink): void {
  activeParitySink = sink;
}

/**
 * Parameters for shadow dual-evaluation
 */
export interface ShadowEvaluationParams {
  session: UserSession | null;
  capabilityCode: string;
  legacyCheck: () => boolean | Promise<boolean>;
  resourceContext?: RequestedResourceContext;
  resolvedContext?: ResolvedResourceContext;
  resourceType?: string;
  resourceId?: string;
  dataProvider?: ICanonicalDataProvider;
  now?: Date;
  paritySink?: IParitySink;
}

/**
 * Dual-evaluates an action: evaluates legacy check and canonical check in parallel.
 * Returns the LEGACY decision as runtime authoritative outcome, while recording the parity record.
 */
export async function evaluateShadowAuthorization(
  params: ShadowEvaluationParams
): Promise<{
  runtimeAllowed: boolean;
  parityRecord: ParityRecord;
  canonicalDecision: CanonicalAuthorizationDecision;
}> {
  const now = params.now || new Date();
  const sink = params.paritySink || activeParitySink;

  // 1. Evaluate Legacy Authority (Authoritative at runtime)
  let legacyAllowed = false;
  let legacyError: unknown = null;
  try {
    legacyAllowed = await params.legacyCheck();
  } catch (err) {
    legacyError = err;
    legacyAllowed = false;
  }

  // 2. Evaluate Canonical Authority in Shadow Mode (Telemetry only)
  let canonicalRes: CanonicalAuthorizationDecision;
  try {
    canonicalRes = await authorizeCanonical({
      identity: params.session,
      capability: params.capabilityCode,
      resourceContext: params.resourceContext,
      resolvedContext: params.resolvedContext,
      dataProvider: params.dataProvider,
      now,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    canonicalRes = {
      decision: "ERROR",
      code: "SYSTEM_FAIL_CLOSED",
      reasonCode: "CANONICAL_EVALUATOR_EXCEPTION",
      reason: `Exception during canonical evaluation: ${msg}`,
    };
  }

  const canonicalAllowed = canonicalRes.decision === "ALLOW";

  // 3. Classify Parity Status
  let parityStatus: ParityStatus;
  if (legacyError !== null || canonicalRes.decision === "ERROR") {
    parityStatus = "ERROR";
  } else if (legacyAllowed && canonicalAllowed) {
    parityStatus = "MATCH_ALLOW";
  } else if (!legacyAllowed && !canonicalAllowed) {
    parityStatus = "MATCH_DENY";
  } else if (legacyAllowed && !canonicalAllowed) {
    parityStatus = "MISMATCH_LEGACY_ALLOW";
  } else {
    parityStatus = "MISMATCH_CANONICAL_ALLOW";
  }

  // 4. Create and persist Parity Record (Zero PII)
  const parityRecord: ParityRecord = {
    id: `par-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: now,
    identityId: params.session?.userId || "anonymous",
    identityUsername: params.session?.username || "anonymous",
    capabilityCode: params.capabilityCode,
    legacyDecision: legacyAllowed,
    canonicalDecision: canonicalAllowed,
    parityStatus,
    reasonCode: canonicalRes.reasonCode,
    scopeType: canonicalRes.scopeType,
    assignmentId: canonicalRes.assignmentId,
    positionCode: canonicalRes.positionCode,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    details: canonicalRes.reason,
  };

  await sink.record(parityRecord);

  // 5. Invariant: Runtime outcome strictly equals LEGACY outcome
  if (legacyError !== null) {
    throw legacyError;
  }

  return {
    runtimeAllowed: legacyAllowed,
    parityRecord,
    canonicalDecision: canonicalRes,
  };
}
