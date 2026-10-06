import { GenderComplex, OrgDomain } from "@prisma/client";
import { KEASRAMAAN_CAPABILITIES } from "@/types/architecture-lock";

export interface OsdaMonitoringAccessRequest {
  actorPositionCode: string;
  actorGenderComplex?: GenderComplex;
  targetGenderComplex: GenderComplex;
  targetDomain?: OrgDomain;
  isMutation: boolean;
  actionCode?: string; // e.g. "keasramaan.osda.monitor", "keasramaan.osda.create_agenda"
}

export interface OsdaMonitoringAccessResult {
  allowed: boolean;
  code:
    | "ALLOWED"
    | "GENDER_COMPLEX_DENIED"
    | "MUTATION_NOT_PERMITTED"
    | "CAPABILITY_NOT_GRANTED"
    | "DOMAIN_MISMATCH";
  reason: string;
  capabilityCode: string;
}

/**
 * Positions with canonical permission to monitor OSDA
 */
const OSDA_MONITORING_POSITIONS = new Set([
  "PENGAWAS_SANTRIWATI",
  "MUDIR",
  "KEPALA_KEASRAMAAN",
]);

/**
 * Evaluates OSDA Monitoring Access (ORR-048 / DIR-2026-016)
 *
 * Rules:
 * 1. ZERO USERNAME HARDCODING: Authority evaluated strictly via Position & Canonical Capability.
 * 2. READ-ONLY INVARIANT: ALL OSDA mutations are strictly DENIED for supervisory monitors.
 * 3. GENDER COMPLEX BOUNDARY: Access to PUTRA domain/resources is strictly DENIED fail-closed.
 * 4. PUTRI SCOPE: PENGAWAS_SANTRIWATI holding 'keasramaan.osda.monitor' is ALLOWED to read/monitor PUTRI.
 */
export function evaluateOsdaMonitoringAccess(
  request: OsdaMonitoringAccessRequest
): OsdaMonitoringAccessResult {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.OSDA_MONITOR;

  // 1. Invariant: ALL mutations are strictly DENIED
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

  // 4. Invariant: Position authority check
  if (!OSDA_MONITORING_POSITIONS.has(request.actorPositionCode)) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Posisi '${request.actorPositionCode}' tidak memiliki capability '${capabilityCode}'.`,
      capabilityCode,
    };
  }

  // 5. PENGAWAS_SANTRIWATI is authorized for PUTRI monitoring
  return {
    allowed: true,
    code: "ALLOWED",
    reason: "Akses READ-ONLY monitoring OSDA PUTRI disetujui berdasarkan kapabilitas kanonikal PENGAWAS_SANTRIWATI.",
    capabilityCode,
  };
}
