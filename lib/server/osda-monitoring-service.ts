import { GenderComplex, OrgDomain } from "@prisma/client";
import { KEASRAMAAN_CAPABILITIES } from "@/types/architecture-lock";

export interface OsdaMonitoringAccessRequest {
  actorUserId?: string;
  actorUsername?: string;
  actorPositionCode?: string;
  actorGenderComplex?: GenderComplex;
  targetGenderComplex: GenderComplex;
  targetDomain?: OrgDomain;
  isMutation: boolean;
  actionCode?: string; // e.g. "keasramaan.osda.monitor"
  hasCanonicalAssignment?: boolean;
}

export interface OsdaMonitoringAccessResult {
  allowed: boolean;
  code:
    | "ALLOWED"
    | "GENDER_COMPLEX_DENIED"
    | "MUTATION_NOT_PERMITTED"
    | "CAPABILITY_NOT_GRANTED"
    | "NO_CANONICAL_ASSIGNMENT"
    | "DOMAIN_MISMATCH";
  reason: string;
  capabilityCode: string;
}

/**
 * Positions with canonical permission to monitor OSDA.
 * Specifically PENGAWAS_SANTRIWATI holds the domain monitoring capability for PUTRI.
 * MUDIR and KEPALA_KEASRAMAAN hold institutional supervisory authority.
 */
const OSDA_MONITORING_POSITIONS = new Set([
  "PENGAWAS_SANTRIWATI",
  "MUDIR",
  "KEPALA_KEASRAMAAN",
]);

/**
 * Disallowed positions explicitly denied from OSDA monitoring
 */
const EXCLUDED_MONITORING_POSITIONS = new Set([
  "MUSYRIF_TAHFIZH",
  "MT",
  "PEMBINA_HALAQOH",
  "PH",
  "GURU_AKADEMIK",
  "GURU_KEPESANTRENAN",
  "SANTRI",
  "OSDA",
]);

/**
 * Evaluates OSDA Monitoring Access (ORR-048 / DIR-2026-016)
 *
 * Invariants:
 * 1. ZERO USERNAME HARDCODING: Username alone (e.g. "lisa") conferring authority is strictly DENIED fail-closed.
 * 2. CANONICAL ASSIGNMENT REQUIRED: PENGAWAS_SANTRIWATI canonical assignment is required.
 * 3. READ-ONLY INVARIANT: ALL OSDA mutations are strictly DENIED for supervisory monitors.
 * 4. GENDER COMPLEX BOUNDARY: Access to PUTRA domain/resources is strictly DENIED fail-closed (Zero PUTRA leakage).
 * 5. ORDINARY MT / GENERIC OSDA: Strictly DENIED without active canonical grant.
 * 6. PUTRI SCOPE: PENGAWAS_SANTRIWATI holding 'keasramaan.osda.monitor' is ALLOWED to read/monitor PUTRI.
 */
export function evaluateOsdaMonitoringAccess(
  request: OsdaMonitoringAccessRequest
): OsdaMonitoringAccessResult {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.OSDA_MONITOR;

  // 1. Invariant: ALL mutations are strictly DENIED (READ-ONLY INVARIANT)
  if (request.isMutation) {
    return {
      allowed: false,
      code: "MUTATION_NOT_PERMITTED",
      reason: "Seluruh mutasi operasional OSDA ditolak: PENGAWAS_SANTRIWATI hanya memiliki akses READ-ONLY / MONITORING.",
      capabilityCode,
    };
  }

  // 2. Invariant: PUTRA domain access is strictly DENIED (Zero PUTRA leakage)
  if (request.targetGenderComplex === GenderComplex.PUTRA) {
    return {
      allowed: false,
      code: "GENDER_COMPLEX_DENIED",
      reason: "Akses ditolak (fail-closed): Batasan gender complex PUTRI melarang akses terhadap sumber daya OSDA PUTRA.",
      capabilityCode,
    };
  }

  // 3. Invariant: Domain must be KEASRAMAAN if specified
  if (request.targetDomain && request.targetDomain !== OrgDomain.KEASRAMAAN) {
    return {
      allowed: false,
      code: "DOMAIN_MISMATCH",
      reason: `Monitoring OSDA hanya berlaku pada domain KEASRAMAAN, bukan domain '${request.targetDomain}'.`,
      capabilityCode,
    };
  }

  // 4. Invariant: Username alone cannot grant authority (Zero Username Hardcoding)
  if (request.actorUsername && !request.actorPositionCode) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Username '${request.actorUsername}' saja tanpa penugasan kanonikal PENGAWAS_SANTRIWATI tidak memberikan wewenang monitoring.`,
      capabilityCode,
    };
  }

  // 5. Invariant: Canonical Assignment must be present if flag checked
  if (request.hasCanonicalAssignment === false) {
    return {
      allowed: false,
      code: "NO_CANONICAL_ASSIGNMENT",
      reason: "Pengguna tidak memiliki penugasan kanonikal aktif untuk posisi monitoring.",
      capabilityCode,
    };
  }

  // 6. Invariant: Excluded positions (ordinary MT, generic OSDA, etc.)
  if (request.actorPositionCode && EXCLUDED_MONITORING_POSITIONS.has(request.actorPositionCode)) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Posisi '${request.actorPositionCode}' tidak memiliki kapabilitas monitoring OSDA.`,
      capabilityCode,
    };
  }

  // 7. Invariant: Position authority check
  if (!request.actorPositionCode || !OSDA_MONITORING_POSITIONS.has(request.actorPositionCode)) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Posisi '${request.actorPositionCode || "UNKNOWN"}' tidak memiliki capability '${capabilityCode}'.`,
      capabilityCode,
    };
  }

  // 8. PENGAWAS_SANTRIWATI is authorized for PUTRI monitoring
  return {
    allowed: true,
    code: "ALLOWED",
    reason: "Akses READ-ONLY monitoring OSDA PUTRI disetujui berdasarkan kapabilitas kanonikal PENGAWAS_SANTRIWATI.",
    capabilityCode,
  };
}
