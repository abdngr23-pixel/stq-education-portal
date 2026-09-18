/**
 * STQ ARCHITECTURE LOCK — HEALTH V2 DOMAIN FOUNDATION & LEGACY BRIDGE
 * Checkpoint M3.3A: Backend Foundation & Canonical Health Model
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_MILESTONE3_3A_HEALTH_V2_BACKEND.md
 *  - docs/STQ_CAPABILITY_CATALOG.md
 *  - types/architecture-lock.ts
 *
 * CORE INVARIANTS:
 * 1. Canonical V2 Statuses are EXACTLY: DIPANTAU, PULIH, DIRUJUK, DARURAT.
 * 2. Diagnosis is OPTIONAL: persist actual diagnosis if provided, or NULL if omitted/empty.
 *    Never generate a fake or default diagnosis.
 * 3. Legacy Status Bridge is READ/translation ONLY:
 *    - RAWAT_PONDOK -> DIPANTAU
 *    - SEMBUH -> PULIH
 *    - DIRUJUK_PUSKESMAS -> DIRUJUK
 *    - DIRUJUK_RS -> DIRUJUK
 *    - Unsupported/unknown -> REVIEW_REQUIRED / UNKNOWN
 *    Zero destructive mutations or historical rewrites.
 * 4. Privacy: Aggregate operational read is strictly separated from clinical detail read.
 *    Generic OSDA membership alone confers zero detail access.
 * 5. Unit accounts require verified human executor on mutations.
 * 6. External referral authority (health.case.referral) remains PROPOSED_TBD.
 * 7. Daily health checklist: 1 general checklist per operational day (zero invented items in M3.3A).
 * 8. Inventory ownership belongs to Health (maintenance tasks delegated to Sarpras).
 */

import type { ICanonicalDataProvider } from "@/lib/auth/canonical-evaluator";
import type { IAuditSink } from "@/lib/auth/canonical-audit";

export const CANONICAL_HEALTH_STATUSES_V2 = [
  "DIPANTAU",
  "PULIH",
  "DIRUJUK",
  "DARURAT",
] as const;

export type HealthStatusV2 = (typeof CANONICAL_HEALTH_STATUSES_V2)[number];

export type LegacyHealthStatus =
  | "RAWAT_PONDOK"
  | "DIRUJUK_PUSKESMAS"
  | "DIRUJUK_RS"
  | "SEMBUH";

export type HealthStatusLegacy = LegacyHealthStatus | "PULANG";

export type HealthStatusBridgeResult = HealthStatusV2 | "UNKNOWN" | "REVIEW_REQUIRED";

/**
 * Validates if a string is one of the exact four canonical Health V2 statuses.
 */
export function isCanonicalHealthStatusV2(status: unknown): status is HealthStatusV2 {
  return typeof status === "string" && (CANONICAL_HEALTH_STATUSES_V2 as readonly string[]).includes(status);
}

/**
 * Deterministic Compatibility Helper: Legacy Status Read Bridge.
 * Maps legacy StatusKesehatan values to HealthStatusV2.
 * Never mutates database rows or rewrites historical records.
 */
export function mapLegacyHealthStatusToV2(
  legacyStatus: string | null | undefined
): HealthStatusBridgeResult {
  if (!legacyStatus) {
    return "UNKNOWN";
  }

  const normalized = legacyStatus.trim().toUpperCase();

  switch (normalized) {
    case "RAWAT_PONDOK":
      return "DIPANTAU";
    case "SEMBUH":
      return "PULIH";
    case "DIRUJUK_PUSKESMAS":
    case "DIRUJUK_RS":
      return "DIRUJUK";
    case "PULANG":
      // Historical/ambiguous status from early mock data
      return "REVIEW_REQUIRED";
    default:
      return "UNKNOWN";
  }
}

/**
 * Health V2 Invariant Metadata & Policy Constants
 */
export const HEALTH_V2_INVARIANTS = {
  CANONICAL_STATUSES: CANONICAL_HEALTH_STATUSES_V2,
  NO_FAKE_DIAGNOSIS: "Diagnosis is optional; absent or empty diagnosis must persist as NULL",
  STATUS_BRIDGE_MUTATION_ALLOWED: false,
  REFERRAL_AUTHORITY_STATE: "PROPOSED_TBD",
  DAILY_CHECKLIST_POLICY: "EXACTLY_ONE_PER_DAY_NO_INVENTED_ITEMS",
  INVENTORY_OWNERSHIP_POLICY: "HEALTH_OWNED_MAINTENANCE_DELEGATED_TO_SARPRAS",
  GUARDIAN_NOTIFICATION_POLICY: "CONTROLLED_BY_AUTHORIZED_KEASRAMAAN_FOR_DIRUJUK_AND_DARURAT",
} as const;

/**
 * DTO and Input Types for Health V2 Core Operations
 */
export interface CreateHealthCaseV2Input {
  santriId: string;
  occurredAt?: Date | string | null;
  keluhan: string;
  tindakanAwal: string;
  diagnosa?: string | null;
  catatan?: string | null;
  attachmentUrl?: string | null;
  statusV2?: HealthStatusV2;
  clientRequestId?: string | null;
}

export interface UpdateHealthCaseV2StatusInput {
  id: string;
  newStatus: HealthStatusV2;
  tindakanTambahan?: string | null;
  tindakanLanjutan?: string | null;
  catatan?: string | null;
  clientRequestId?: string | null;
}

export interface HealthCaseV2EventDTO {
  id: string;
  caseId: string;
  previousStatus: HealthStatusV2 | null;
  newStatus: HealthStatusV2;
  tindakanLanjutan: string | null;
  catatan: string | null;
  recordedByUserId: string;
  recordedByStaffId: string | null;
  humanExecutorId: string | null;
  createdAt: Date;
}

export interface HealthCaseV2DTO {
  id: string;
  santriId: string;
  occurredAt: Date;
  keluhan: string;
  tindakanAwal: string;
  diagnosa: string | null;
  catatan: string | null;
  attachmentUrl: string | null;
  statusV2: HealthStatusV2;
  recordedByUserId: string;
  recordedByStaffId: string | null;
  createdAt: Date;
  updatedAt: Date;
  events?: HealthCaseV2EventDTO[];
}

export interface HealthCaseV2AuditContext {
  userId: string;
  username?: string;
  staffId?: string | null;
  accountType?: "PERSONAL" | "UNIT";
  humanExecutorId?: string | null;
  humanExecutorUsername?: string | null;
  clientRequestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
  dataProvider?: ICanonicalDataProvider;
  auditSink?: IAuditSink;
}
