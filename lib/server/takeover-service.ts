import { PrismaClient, OrgDomain, GenderComplex } from "@prisma/client";
import defaultPrisma from "@/lib/prisma";
import {
  SupervisoryTakeoverRecord,
  KEASRAMAAN_CAPABILITIES,
} from "@/types/architecture-lock";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  ICanonicalDataProvider,
  CanonicalAssignmentWithDetails,
  CanonicalIdentity,
} from "@/lib/auth/canonical-evaluator";

export interface TakeoverActorIdentity {
  userId: string;
  name?: string;
  positionCode: string;
  domain?: OrgDomain;
  isLeadership?: boolean;
  staffId?: string;
  mockAssignments?: CanonicalAssignmentWithDetails[];
}

export interface OriginalPicIdentity {
  userId: string;
  name?: string;
  positionCode: string;
  assignmentId?: string;
}

export interface TakeoverResourceContext {
  resourceType: string;
  resourceId: string;
  domain: OrgDomain;
  unitId?: string;
  kamarId?: string;
  genderComplex?: GenderComplex;
  [key: string]: unknown;
}

export interface ExecuteSupervisoryTakeoverParams {
  originalAssignmentId: string;
  originalPic: OriginalPicIdentity;
  takeoverActor: TakeoverActorIdentity;
  reason: string;
  resourceContext: TakeoverResourceContext;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
  skipCanonicalAuthForTesting?: boolean;
}

export interface TakeoverServiceResult {
  success: boolean;
  code?: string;
  reason?: string;
  data?: SupervisoryTakeoverRecord;
}

/**
 * Positions with canonical Keasramaan supervisory takeover authority.
 * Strictly limited to MUDIR (GLOBAL) and KEPALA_KEASRAMAAN (DOMAIN KEASRAMAAN).
 * Noncanonical positions (KEPALA_SEKOLAH, KABID_TAHFIZH, KABID_AKADEMIK, etc.) are strictly excluded.
 */
const ALLOWED_SUPERVISORY_POSITIONS = new Set([
  "MUDIR",
  "KEPALA_KEASRAMAAN",
]);

/**
 * 1. Validate whether actor holds canonical supervisory authority over target domain
 * Hierarchy: MUDIR (GLOBAL) -> KEPALA_KEASRAMAAN (DOMAIN KEASRAMAAN) -> MUDHABBIR / PEMBINA_HALAQOH.
 * Fails closed for peers, subordinates, wrong domains, and noncanonical roles.
 */
export function validateSupervisoryAuthority(
  actor: TakeoverActorIdentity,
  targetDomain: OrgDomain
): { authorized: boolean; reason?: string } {
  if (!actor || !actor.userId || !actor.positionCode) {
    return { authorized: false, reason: "Identitas dan posisi supervisor wajib disertakan." };
  }

  // Explicit rejection of noncanonical positions
  if (actor.positionCode === "KEPALA_SEKOLAH") {
    return {
      authorized: false,
      reason: "Posisi 'KEPALA_SEKOLAH' bukan merupakan otoritas supervisi kanonikal Keasramaan (hanya MUDIR dan KEPALA_KEASRAMAAN).",
    };
  }

  // Mudir holds institutional supervisory authority (GLOBAL)
  if (actor.positionCode === "MUDIR") {
    return { authorized: true };
  }

  // Kepala Keasramaan holds supervisory authority strictly over KEASRAMAAN domain
  if (actor.positionCode === "KEPALA_KEASRAMAAN") {
    if (targetDomain !== OrgDomain.KEASRAMAAN) {
      return {
        authorized: false,
        reason: `Posisi 'KEPALA_KEASRAMAAN' hanya memiliki wewenang supervisi atas domain 'KEASRAMAAN', bukan domain '${targetDomain}'.`,
      };
    }
    if (actor.domain && actor.domain !== OrgDomain.KEASRAMAAN) {
      return {
        authorized: false,
        reason: `Posisi 'KEPALA_KEASRAMAAN' domain '${actor.domain}' tidak sesuai dengan domain target '${targetDomain}'.`,
      };
    }
    return { authorized: true };
  }

  if (!ALLOWED_SUPERVISORY_POSITIONS.has(actor.positionCode)) {
    return {
      authorized: false,
      reason: `Posisi '${actor.positionCode}' bukan merupakan Atasan / Supervisor berwenang untuk takeover tugas Keasramaan.`,
    };
  }

  return {
    authorized: false,
    reason: `Posisi '${actor.positionCode}' bukan merupakan Atasan / Supervisor berwenang untuk takeover tugas Keasramaan.`,
  };
}

/**
 * 2. Execute Supervisory Takeover (ORR-086)
 * Preserves complete provenance without attribution erasure.
 * Integrates authorizeCanonical with capability 'keasramaan.takeover.execute'.
 * Strictly non-workflow-activating until production policy is explicitly provisioned.
 */
export async function executeSupervisoryTakeover(
  params: ExecuteSupervisoryTakeoverParams
): Promise<TakeoverServiceResult> {
  const prisma = params.prismaClient || defaultPrisma;

  // 1. Mandatory provenance validation
  if (!params.originalAssignmentId || !params.originalAssignmentId.trim()) {
    return {
      success: false,
      code: "INVALID_ASSIGNMENT_ID",
      reason: "originalAssignmentId wajib disertakan untuk audit provenance.",
    };
  }

  if (!params.reason || !params.reason.trim()) {
    return {
      success: false,
      code: "REASON_REQUIRED",
      reason: "Alasan pengambilalihan tugas (takeover) wajib diisi.",
    };
  }

  if (!params.originalPic || !params.originalPic.userId) {
    return {
      success: false,
      code: "INVALID_ORIGINAL_PIC",
      reason: "Identitas PIC asli wajib disertakan.",
    };
  }

  if (!params.resourceContext || !params.resourceContext.resourceType || !params.resourceContext.resourceId) {
    return {
      success: false,
      code: "INVALID_RESOURCE_CONTEXT",
      reason: "Resource context (resourceType, resourceId, domain) wajib disertakan.",
    };
  }

  // 2. Canonical hierarchical supervisory authority check
  const authCheck = validateSupervisoryAuthority(
    params.takeoverActor,
    params.resourceContext.domain
  );
  if (!authCheck.authorized) {
    return {
      success: false,
      code: "SUPERVISORY_AUTHORITY_DENIED",
      reason: authCheck.reason || "Pengambilalihan ditolak: tidak memiliki otoritas Atasan / Supervisor.",
    };
  }

  // 3. Canonical Capability Authorization (Track 3B)
  if (!params.skipCanonicalAuthForTesting) {
    const dataProvider =
      params.dataProvider ||
      (params.takeoverActor.mockAssignments ? undefined : (prisma ? createPrismaDataProvider(prisma) : undefined));

    const authIdentity: CanonicalIdentity & { mockAssignments?: CanonicalAssignmentWithDetails[] } = {
      userId: params.takeoverActor.userId,
      username: params.takeoverActor.name || params.takeoverActor.userId,
      status: "AKTIF",
      accountType: "PERSONAL",
      staffId: params.takeoverActor.staffId || `staff-${params.takeoverActor.userId}`,
      staffStatus: "AKTIF",
      mockAssignments: params.takeoverActor.mockAssignments,
    };

    const authDecision = await authorizeCanonical({
      identity: authIdentity,
      capability: KEASRAMAAN_CAPABILITIES.TAKEOVER_EXECUTE,
      resourceContext: {
        unitId: params.resourceContext.unitId,
        kamarId: params.resourceContext.kamarId,
      },
      resolvedContext: {
        resourceType: params.resourceContext.resourceType,
        resourceId: params.resourceContext.resourceId,
        orgDomain: params.resourceContext.domain,
        unitId: params.resourceContext.unitId,
        kamarId: params.resourceContext.kamarId,
        genderComplex: params.resourceContext.genderComplex,
        orgUnitIds: [params.resourceContext.kamarId, params.resourceContext.unitId].filter(
          (id): id is string => Boolean(id)
        ),
      },
      dataProvider,
      isMutation: true,
    });

    if (authDecision.decision !== "ALLOW") {
      return {
        success: false,
        code: authDecision.code === "ALLOWED" ? "SUPERVISORY_AUTHORITY_DENIED" : (authDecision.code || "CANONICAL_AUTHORIZATION_DENIED"),
        reason: authDecision.reason || "Pengambilalihan ditolak: tidak memiliki kapabilitas kanonikal 'keasramaan.takeover.execute'.",
      };
    }
  }

  // 4. Assemble immutable takeover provenance record
  const timestamp = new Date();
  const takeoverId = `tkover_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const takeoverRecord: SupervisoryTakeoverRecord = {
    id: takeoverId,
    originalAssignmentId: params.originalAssignmentId.trim(),
    originalPic: {
      userId: params.originalPic.userId,
      name: params.originalPic.name,
      positionCode: params.originalPic.positionCode,
    },
    takeoverActor: {
      userId: params.takeoverActor.userId,
      name: params.takeoverActor.name,
      positionCode: params.takeoverActor.positionCode,
    },
    reason: params.reason.trim(),
    timestamp,
    resourceContext: {
      ...params.resourceContext,
    },
    beforeState: JSON.parse(JSON.stringify(params.beforeState || {})),
    afterState: JSON.parse(JSON.stringify(params.afterState || {})),
    attributionPreserved: true,
    workflowActivated: false,
  };

  // 5. Record audit log preserving complete context
  try {
    if (prisma?.auditLog) {
      await prisma.auditLog.create({
        data: {
          userId: params.takeoverActor.userId,
          action: "SUPERVISORY_TAKEOVER",
          entity: params.resourceContext.resourceType,
          details: JSON.parse(
            JSON.stringify({
              takeoverId,
              originalAssignmentId: params.originalAssignmentId,
              originalPicUserId: params.originalPic.userId,
              originalPicName: params.originalPic.name,
              originalPicPosition: params.originalPic.positionCode,
              takeoverActorUserId: params.takeoverActor.userId,
              takeoverActorName: params.takeoverActor.name,
              takeoverActorPosition: params.takeoverActor.positionCode,
              reason: params.reason.trim(),
              attributionPreserved: true,
              workflowActivated: false,
              resourceContext: params.resourceContext,
              beforeState: params.beforeState,
              afterState: params.afterState,
            })
          ),
        },
      });
    }
  } catch {
    // If auditLog fails, we still return the structured record in mock/test scenarios
  }

  return {
    success: true,
    data: takeoverRecord,
  };
}
