import { PrismaClient, GenderComplex, OrgDomain, BusinessRuleState } from "@prisma/client";
import defaultPrisma from "@/lib/prisma";
import { KEASRAMAAN_CAPABILITIES } from "@/types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalAssignmentWithDetails,
  CanonicalIdentity,
} from "@/lib/auth/canonical-evaluator";

export interface AuthorizeOsdaMonitoringParams {
  actorUserId: string;
  actorUsername?: string;
  targetResource: {
    resourceId?: string;
    unitId?: string;
    // Untrusted caller claims (ignored; server resolves actual unit from DB)
    domain?: OrgDomain;
    genderComplex?: GenderComplex;
  };
  isMutation: boolean;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
  mockAssignments?: CanonicalAssignmentWithDetails[];
  mockOrgUnits?: Array<{
    id: string;
    code?: string;
    name?: string;
    domain: OrgDomain | string;
    genderComplex?: GenderComplex | string;
    isActive: boolean;
    parentId?: string | null;
  }>;
}

export interface AuthorizeOsdaMonitoringResult {
  allowed: boolean;
  code:
    | "ALLOWED"
    | "GENDER_COMPLEX_DENIED"
    | "MUTATION_NOT_PERMITTED"
    | "CAPABILITY_NOT_GRANTED"
    | "NO_CANONICAL_ASSIGNMENT"
    | "DOMAIN_MISMATCH"
    | "ZERO_PRODUCTION_GRANTS"
    | "RESOURCE_NOT_FOUND"
    | "UNIT_INACTIVE"
    | "NON_OSDA_UNIT";
  reason: string;
  capabilityCode: string;
  positionCode?: string;
}

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

/**
 * Server-side True Canonical Authorization Service for OSDA Monitoring (ORR-048 / DIR-2026-016)
 *
 * TRACK F: SERVER-RESOLVED OSDA CONTEXT
 * Does NOT trust caller-supplied targetResource.domain or targetResource.genderComplex.
 * Resolves actual OrgUnit/resource from the database / mock entity store.
 * Validates:
 * 1. isMutation === false (read-only invariant)
 * 2. actual unit exists
 * 3. actual unit active
 * 4. actual domain = KEASRAMAAN
 * 5. actual resource belongs to OSDA structure
 * 6. actual genderComplex = PUTRI
 * Then invokes authorizeCanonical with server-resolved context.
 */
export async function authorizeOsdaMonitoring(
  params: AuthorizeOsdaMonitoringParams
): Promise<AuthorizeOsdaMonitoringResult> {
  const capabilityCode = KEASRAMAAN_CAPABILITIES.OSDA_MONITOR;

  // 1. Invariant: ALL mutations are strictly DENIED (READ-ONLY INVARIANT)
  if (params.isMutation) {
    return {
      allowed: false,
      code: "MUTATION_NOT_PERMITTED",
      reason: "Seluruh mutasi operasional OSDA ditolak: PENGAWAS_SANTRIWATI hanya memiliki akses READ-ONLY / MONITORING.",
      capabilityCode,
    };
  }

  // 2. Resolve target unit identifier
  const targetUnitId = params.targetResource.unitId || params.targetResource.resourceId;
  if (!targetUnitId || !targetUnitId.trim()) {
    return {
      allowed: false,
      code: "RESOURCE_NOT_FOUND",
      reason: "unitId atau resourceId target wajib disertakan untuk resolusi sumber daya.",
      capabilityCode,
    };
  }

  // 3. Server loads actual OrgUnit/resource from database or mock entity store
  const prisma = params.prismaClient || defaultPrisma;
  interface OsdaTargetUnitEntity {
    id: string;
    code?: string | null;
    name?: string | null;
    domain?: string | OrgDomain;
    genderComplex?: string | GenderComplex | null;
    isActive?: boolean;
    parentId?: string | null;
  }
  let actualUnit: OsdaTargetUnitEntity | null = null;

  if (params.mockOrgUnits) {
    actualUnit = (params.mockOrgUnits.find(
      (u) => u.id === targetUnitId || u.code === targetUnitId
    ) as OsdaTargetUnitEntity) || null;
  }

  if (!actualUnit && prisma?.orgUnit) {
    try {
      actualUnit = await prisma.orgUnit.findFirst({
        where: {
          OR: [
            { id: targetUnitId },
            { code: targetUnitId },
          ],
        },
      });
    } catch {
      // Ignored in minimal mock prisma environments
    }
  }

  // Validation 1: actual unit exists
  if (!actualUnit) {
    return {
      allowed: false,
      code: "RESOURCE_NOT_FOUND",
      reason: `Target unit '${targetUnitId}' tidak ditemukan di database.`,
      capabilityCode,
    };
  }

  // Validation 2: actual unit active
  if (actualUnit.isActive === false) {
    return {
      allowed: false,
      code: "UNIT_INACTIVE",
      reason: `Target unit '${actualUnit.code || actualUnit.id}' berstatus tidak aktif.`,
      capabilityCode,
    };
  }

  // Validation 3: actual domain = KEASRAMAAN
  if (actualUnit.domain !== OrgDomain.KEASRAMAAN && actualUnit.domain !== "KEASRAMAAN") {
    return {
      allowed: false,
      code: "DOMAIN_MISMATCH",
      reason: `Target unit '${actualUnit.code || actualUnit.id}' domain '${actualUnit.domain}', bukan KEASRAMAAN.`,
      capabilityCode,
    };
  }

  // Validation 4: actual resource belongs to OSDA structure
  const unitCode = (actualUnit.code || "").toUpperCase();
  const unitName = (actualUnit.name || "").toUpperCase();
  const unitParentId = (actualUnit.parentId || "").toUpperCase();
  const belongsToOsda = Boolean(
    (unitCode.startsWith("OU-OSDA") || unitCode === "OSDA" || unitCode.startsWith("OSDA-")) ||
    (unitParentId.startsWith("OU-OSDA") || unitParentId === "OU-OSDA-ROOT" || unitParentId === "OU-OSDA-PUTRI") ||
    (unitName.startsWith("OSDA") || unitName.includes("ORGANISASI SANTRI"))
  );
  if (!belongsToOsda) {
    return {
      allowed: false,
      code: "NON_OSDA_UNIT",
      reason: `Target unit '${actualUnit.code || actualUnit.id}' bukan merupakan bagian struktur OSDA.`,
      capabilityCode,
    };
  }

  // Validation 5: actual genderComplex = PUTRI
  if (actualUnit.genderComplex !== GenderComplex.PUTRI && actualUnit.genderComplex !== "PUTRI") {
    return {
      allowed: false,
      code: "GENDER_COMPLEX_DENIED",
      reason: `Akses ditolak (fail-closed): Batasan gender complex PUTRI melarang akses terhadap unit OSDA ${actualUnit.genderComplex || "NON_PUTRI"}.`,
      capabilityCode,
    };
  }

  // Validation 6: Invariant: User ID mandatory
  if (!params.actorUserId || !params.actorUserId.trim()) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: "actorUserId wajib disertakan untuk evaluasi kanonikal.",
      capabilityCode,
    };
  }

  // 4. True canonical authorization from database / dataProvider
  const dataProvider =
    params.dataProvider ||
    (params.mockAssignments ? undefined : (prisma ? createPrismaDataProvider(prisma) : undefined));

  const authIdentity: CanonicalIdentity & { mockAssignments?: CanonicalAssignmentWithDetails[] } = {
    userId: params.actorUserId,
    username: params.actorUsername || params.actorUserId,
    status: "AKTIF",
    accountType: "PERSONAL",
    staffId: `staff-${params.actorUserId}`,
    staffStatus: "AKTIF",
    mockAssignments: params.mockAssignments,
  };

  const authDecision = await authorizeCanonical({
    identity: authIdentity,
    capability: capabilityCode,
    resourceContext: {
      unitId: actualUnit.id,
    },
    resolvedContext: {
      resourceType: "OSDA_RESOURCE",
      resourceId: actualUnit.id,
      orgDomain: OrgDomain.KEASRAMAAN,
      genderComplex: GenderComplex.PUTRI,
      orgUnitIds: [actualUnit.id],
    },
    dataProvider,
    isMutation: false,
  });

  if (authDecision.decision !== "ALLOW") {
    const code: AuthorizeOsdaMonitoringResult["code"] =
      authDecision.code === "ASSIGNMENT_NOT_ACTIVE"
        ? "NO_CANONICAL_ASSIGNMENT"
        : ((authDecision.code as AuthorizeOsdaMonitoringResult["code"]) || "CAPABILITY_NOT_GRANTED");
    return {
      allowed: false,
      code,
      reason: authDecision.reason || "Pengguna tidak memiliki kapabilitas kanonikal 'keasramaan.osda.monitor'.",
      capabilityCode,
    };
  }

  // 5. Enforce allowed positions: PENGAWAS_SANTRIWATI (or institutional MUDIR / KEPALA_KEASRAMAAN)
  const positionCode = authDecision.positionCode;
  if (!positionCode || !OSDA_MONITORING_POSITIONS.has(positionCode)) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Posisi '${positionCode || "UNKNOWN"}' tidak memiliki kapabilitas monitoring OSDA.`,
      capabilityCode,
    };
  }

  // 6. Enforce VERIFIED_PRODUCTION businessRuleState
  if (
    authDecision.grantUsed &&
    authDecision.grantUsed.businessRuleState !== BusinessRuleState.VERIFIED_PRODUCTION
  ) {
    return {
      allowed: false,
      code: "ZERO_PRODUCTION_GRANTS",
      reason: `Kapabilitas berstatus '${authDecision.grantUsed.businessRuleState}', belum VERIFIED_PRODUCTION.`,
      capabilityCode,
      positionCode,
    };
  }

  return {
    allowed: true,
    code: "ALLOWED",
    reason: "Akses READ-ONLY monitoring OSDA PUTRI disetujui berdasarkan kapabilitas kanonikal PENGAWAS_SANTRIWATI.",
    capabilityCode,
    positionCode,
  };
}
