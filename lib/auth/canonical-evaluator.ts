/**
 * STQ ARCHITECTURE LOCK — CANONICAL AUTHORIZATION EVALUATOR
 * Authoritative Server-Side Multi-Grant Evaluator.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_AUTHORIZATION_MODEL.md
 *  - docs/STQ_SCOPE_MODEL.md
 *  - docs/STQ_CAPABILITY_CATALOG.md
 *  - types/architecture-lock.ts
 *
 * THE ACTIVATION TRIPLE (Fail-Closed Default Closure):
 * Authority is conferred if and ONLY IF all three dimensions are deliberate:
 * 1. Assignment.status === 'ACTIVE'
 * 2. PositionCapability.businessRuleState === 'VERIFIED_PRODUCTION'
 * 3. PositionCapability.scopeType is explicit
 * Plus: Target resource context matches canonical scope.
 *
 * UNRESOLVED RULES / PROPOSED_TBD CONFER ZERO RUNTIME AUTHORITY.
 */

import {
  AccountType,
  ScopeType,
  BusinessRuleState,
  AssignmentStatus,
  EffectiveCapabilityGrant,
  RequestedResourceContext,
  ResolvedResourceContext,
  AuthorizationResultCode,
  UnitAccountExecutorContext,
  GenderComplex,
  OrgDomain,
  POSITION_ACCOUNT_MODALITY_CONTRACT,
} from "@/types/architecture-lock";
import { UserSession } from "@/types/auth";
import { evaluateScopePredicate } from "./scope-evaluator";
import type { PrismaClient } from "@prisma/client";

/**
 * Machine-readable structured canonical authorization decision
 */
export interface CanonicalAuthorizationDecision {
  decision: "ALLOW" | "DENY" | "ERROR";
  code: AuthorizationResultCode;
  reasonCode: string;
  reason: string;
  assignmentId?: string;
  positionId?: string;
  positionCode?: string;
  capabilityCode?: string;
  scopeType?: ScopeType;
  evaluatedUnitIds?: string[];
  grantUsed?: EffectiveCapabilityGrant;
  verifiedExecutor?: CanonicalExecutorIdentity;
}

/**
 * Normalized Canonical Executor Identity resolved server-side
 */
export interface CanonicalExecutorIdentity {
  userId: string;
  name: string;
  staffId?: string | null;
  santriId?: string | null;
  isActive: boolean;
  id?: string; // backwards compatibility alias for userId
}

/**
 * Normalized Identity representation passed to canonical evaluator
 */
export interface CanonicalIdentity {
  userId: string;
  username: string;
  status: "AKTIF" | "NONAKTIF" | "SUSPENDED" | string;
  accountType: AccountType;
  role?: string | null;
  staffId?: string | null;
  staffStatus?: string | null;
  santriId?: string | null;
  santriStatus?: string | null;
  name?: string;
  genderComplex?: GenderComplex;
  placementUnitId?: string | null;
  placementUnitCount?: number;
  placementUnitIds?: string[];
}

/**
 * Rich assignment representation with resolved relations
 */
export interface CanonicalAssignmentWithDetails {
  id: string;
  userId: string;
  positionId: string;
  positionCode: string;
  positionName: string;
  domain: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  unitGenderComplex?: GenderComplex;
  status: AssignmentStatus;
  validFrom: Date;
  validUntil: Date | null;
  requiresPersonalAccount?: boolean | null;
  positionCapabilities: Array<{
    capabilityCode: string;
    scopeType: ScopeType;
    businessRuleState: BusinessRuleState;
  }>;
  scopeUnits: Array<{
    unitId: string;
    unitCode?: string;
  }>;
}

/**
 * Pluggable data provider contract for database queries
 */
export interface ICanonicalDataProvider {
  getIdentity(userId: string): Promise<CanonicalIdentity | null>;
  getActiveAssignments(userId: string, now: Date): Promise<CanonicalAssignmentWithDetails[]>;
  getUnitAccountPlacement(userId: string): Promise<{ unitId: string; count?: number } | null>;
  verifyHumanExecutor(executorId: string): Promise<CanonicalExecutorIdentity | null>;
  resolveResourceContext(requested: RequestedResourceContext, subjectUserId?: string, capability?: string): Promise<ResolvedResourceContext | null>;
}

/**
 * Canonical Authorization Request Input
 */
export interface AuthorizeCanonicalParams {
  identity: CanonicalIdentity | UserSession | { userId: string } | null;
  capability: string;
  resourceContext?: RequestedResourceContext;
  resolvedContext?: ResolvedResourceContext; // Optional pre-resolved context (e.g. for pure testing)
  executorContext?: Partial<UnitAccountExecutorContext>;
  isMutation?: boolean;
  now?: Date;
  dataProvider?: ICanonicalDataProvider;
}

/**
 * Positions that strictly require an active linked Staff profile
 * NOTE (Gate 5): PETUGAS_OPERASIONAL_KEASRAMAAN removed (must be AccountType.UNIT, never fake Staff).
 */
const STAFF_PROFILE_REQUIRED_POSITIONS = new Set([
  "MUDIR",
  "KABID_TAHFIZH",
  "MUSYRIF_TAHFIZH",
  "PEMBINA_HALAQOH",
  "KEPALA_KEASRAMAAN",
  "PEMBINA_ASRAMA",
  "GURU_AKADEMIK",
  "GURU_KEPESANTRENAN",
  "STAF_ADMIN_TU",
  "PETUGAS_PRESENSI",
  "PETUGAS_KESEHATAN",
  "PETUGAS_OPERASIONAL_TAHFIZH",
  "MT",
  "KS",
  "MK",
  "ADM",
  "PH",
  "GA",
]);

/**
 * Positions that strictly require an active linked Santri profile
 */
const SANTRI_PROFILE_REQUIRED_POSITIONS = new Set([
  "SANTRI",
  "ST",
]);

/**
 * Main Authoritative Evaluator
 */
export async function authorizeCanonical(
  params: AuthorizeCanonicalParams
): Promise<CanonicalAuthorizationDecision> {
  const now = params.now || new Date();

  // 1. Validate Identity Presence
  if (!params.identity || !params.identity.userId) {
    return {
      decision: "DENY",
      code: "UNAUTHENTICATED",
      reasonCode: "UNAUTHENTICATED",
      reason: "Session or identity is null, missing, or anonymous.",
    };
  }

  // 1.1. Authoritative Identity Hydration via DataProvider (Blocker 1)
  let identity: CanonicalIdentity;

  if (params.dataProvider) {
    try {
      const dbIdentity = await params.dataProvider.getIdentity(params.identity.userId);
      if (!dbIdentity) {
        return {
          decision: "DENY",
          code: "IDENTITY_NOT_LINKED",
          reasonCode: "IDENTITY_NOT_LINKED",
          reason: `No authoritative database identity found for user ${params.identity.userId}.`,
        };
      }
      identity = dbIdentity;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        decision: "ERROR",
        code: "SYSTEM_FAIL_CLOSED",
        reasonCode: "DATABASE_UNAVAILABLE",
        reason: `Database error querying authoritative identity: ${msg}`,
      };
    }
  } else {
    // When no dataProvider is supplied (e.g. pure offline unit testing with pre-built mock identity)
    const raw = params.identity as Record<string, unknown>;
    identity =
      "accountType" in params.identity
        ? (params.identity as CanonicalIdentity)
        : {
            userId: String(raw.userId),
            username: typeof raw.username === "string" ? raw.username : String(raw.userId),
            status: typeof raw.status === "string" ? raw.status : "AKTIF",
            accountType: raw.role === "OSDA" ? "UNIT" : "PERSONAL",
            staffId: typeof raw.staffId === "string" ? raw.staffId : undefined,
            santriId: typeof raw.santriId === "string" ? raw.santriId : undefined,
            name: typeof raw.name === "string" ? raw.name : undefined,
          };
  }

  // 1.2. Verify Database User Status is Strictly AKTIF (do not trust stale session status)
  if (identity.status !== "AKTIF") {
    return {
      decision: "DENY",
      code: "IDENTITY_INACTIVE",
      reasonCode: "IDENTITY_INACTIVE",
      reason: `User account is inactive or suspended in database (status: ${identity.status}).`,
    };
  }

  // 2. Unit Account Placements and Invariants (AccountType.UNIT - Blocker 4 & Section 8)
  let placementUnitId: string | null = null;
  let verifiedExecutor: CanonicalExecutorIdentity | undefined = undefined;
  if (identity.accountType === "UNIT") {
    if (params.dataProvider) {
      try {
        const placement = await params.dataProvider.getUnitAccountPlacement(identity.userId);
        if (!placement || !placement.unitId) {
          return {
            decision: "DENY",
            code: "SYSTEM_FAIL_CLOSED",
            reasonCode: "UNIT_ACCOUNT_NO_PLACEMENT",
            reason: "Unit account has no active UnitAccountPlacement binding.",
          };
        }
        if (placement.count !== undefined && placement.count > 1) {
          return {
            decision: "DENY",
            code: "SYSTEM_FAIL_CLOSED",
            reasonCode: "UNIT_PLACEMENT_MULTIPLE",
            reason: `Unit account has multiple UnitAccountPlacements (${placement.count}), strictly failing closed.`,
          };
        }
        placementUnitId = placement.unitId;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          decision: "ERROR",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "DATABASE_UNAVAILABLE",
          reason: `Database error querying unit account placement: ${msg}`,
        };
      }
    } else {
      if (identity.placementUnitCount && identity.placementUnitCount > 1) {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_PLACEMENT_MULTIPLE",
          reason: `Unit account has multiple UnitAccountPlacements (${identity.placementUnitCount}), strictly failing closed.`,
        };
      }
      if (identity.placementUnitIds && identity.placementUnitIds.length > 1) {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_PLACEMENT_MULTIPLE",
          reason: `Unit account has multiple UnitAccountPlacements (${identity.placementUnitIds.length}), strictly failing closed.`,
        };
      }
      placementUnitId = identity.placementUnitId || null;
      if (!placementUnitId) {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_ACCOUNT_NO_PLACEMENT",
          reason: "Unit account has no active UnitAccountPlacement binding.",
        };
      }
    }

    // Invariant: executorContext.unitId must also match placementUnitId when supplied
    if (params.executorContext) {
      // 1. Executor context unitId must match placementUnitId
      if (params.executorContext.unitId && params.executorContext.unitId !== placementUnitId) {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_PLACEMENT_MISMATCH",
          reason: `Executor context unitId (${params.executorContext.unitId}) does not match placement unitId (${placementUnitId}).`,
        };
      }

      // 2. Technical account ID consistency: if provided, must match authenticated unit account
      if (
        params.executorContext.technicalAccountId &&
        params.executorContext.technicalAccountId !== identity.userId
      ) {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_EXECUTOR_INVALID",
          reason: "Executor context technicalAccountId does not match authenticated unit account.",
        };
      }

      // 3. Human executor cannot be the unit account itself (technical account cannot self-execute)
      if (params.executorContext.humanExecutorId === identity.userId) {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_EXECUTOR_INVALID",
          reason: "Unit account cannot act as its own human executor.",
        };
      }
    }

    // Mutations on UNIT accounts strictly require verified human executor
    if (params.isMutation) {
      if (!params.executorContext || !params.executorContext.humanExecutorId || params.executorContext.humanExecutorId.trim() === "") {
        return {
          decision: "DENY",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "UNIT_EXECUTOR_REQUIRED",
          reason: "State mutation via UNIT account requires verified humanExecutorId context.",
        };
      }

      if (params.dataProvider) {
        try {
          const executor = await params.dataProvider.verifyHumanExecutor(
            params.executorContext.humanExecutorId
          );
          if (!executor || !executor.isActive) {
            return {
              decision: "DENY",
              code: "SYSTEM_FAIL_CLOSED",
              reasonCode: "UNIT_EXECUTOR_INVALID",
              reason: "Human executor profile is not active or could not be verified.",
            };
          }
          if (!executor.userId || executor.userId.trim() === "") {
            return {
              decision: "DENY",
              code: "SYSTEM_FAIL_CLOSED",
              reasonCode: "UNIT_EXECUTOR_INVALID",
              reason: "Human executor does not resolve to a canonical User.id.",
            };
          }
          verifiedExecutor = {
            userId: executor.userId,
            id: executor.userId,
            name: executor.name,
            staffId: executor.staffId || null,
            santriId: executor.santriId || null,
            isActive: executor.isActive,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            decision: "ERROR",
            code: "SYSTEM_FAIL_CLOSED",
            reasonCode: "DATABASE_UNAVAILABLE",
            reason: `Database error verifying human executor: ${msg}`,
          };
        }
      }
    }
  }

  // 3. Hydrate Active Assignments
  let assignments: CanonicalAssignmentWithDetails[] = [];
  if (params.dataProvider) {
    try {
      assignments = await params.dataProvider.getActiveAssignments(identity.userId, now);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        decision: "ERROR",
        code: "SYSTEM_FAIL_CLOSED",
        reasonCode: "DATABASE_UNAVAILABLE",
        reason: `Database error querying assignments: ${msg}`,
      };
    }
  }

  // If no dataProvider was passed, check if identity has mock assignments
  if (!params.dataProvider && (identity as unknown as { mockAssignments?: CanonicalAssignmentWithDetails[] }).mockAssignments) {
    assignments = (identity as unknown as { mockAssignments: CanonicalAssignmentWithDetails[] }).mockAssignments;
  }

  // 3.1. Filter assignments for strictly ACTIVE status and valid time window
  const activeAssignments = assignments.filter((a) => {
    if (a.status !== "ACTIVE") return false;
    if (a.validFrom > now) return false;
    if (a.validUntil !== null && a.validUntil < now) return false;
    return true;
  });

  if (activeAssignments.length === 0) {
    return {
      decision: "DENY",
      code: "CAPABILITY_NOT_GRANTED",
      reasonCode: "NO_ACTIVE_ASSIGNMENTS",
      reason: "User has zero active canonical assignments.",
    };
  }

  // Blocker 4 & Invariant: For AccountType.UNIT, every candidate assignment MUST match placementUnitId.
  // Mixed placements (assignments spanning multiple different units) strictly fail closed.
  if (identity.accountType === "UNIT" && placementUnitId) {
    const hasMismatchedAssignment = activeAssignments.some((a) => a.unitId !== placementUnitId);
    if (hasMismatchedAssignment) {
      const mismatched = activeAssignments.find((a) => a.unitId !== placementUnitId);
      return {
        decision: "DENY",
        code: "SYSTEM_FAIL_CLOSED",
        reasonCode: "UNIT_PLACEMENT_MISMATCH",
        reason: `Every candidate assignment for a UNIT account must match placementUnitId (${placementUnitId}). Found mismatched assignment with unitId: ${mismatched?.unitId}.`,
      };
    }
  }

  // 4. Resolve Candidate Effective Grants Matching Requested Capability
  const candidateGrants: Array<{
    assignment: CanonicalAssignmentWithDetails;
    grant: EffectiveCapabilityGrant;
  }> = [];

  let profileRejection: { code: AuthorizationResultCode; reasonCode: string; reason: string } | null = null;

  for (const a of activeAssignments) {
    // UNIT placement invariant: assignment must match placementUnitId
    if (identity.accountType === "UNIT" && placementUnitId && a.unitId !== placementUnitId) {
      continue;
    }

    for (const pc of a.positionCapabilities) {
      if (pc.capabilityCode === params.capability) {
        // Enforce Activation Triple:
        // Must be strictly VERIFIED_PRODUCTION (never PROPOSED_TBD or APPROVED_TARGET_PENDING_TECHNICAL)
        // APPROVED_TARGET_PENDING_TECHNICAL confers zero runtime authority before formal cutover
        if (pc.businessRuleState !== "VERIFIED_PRODUCTION") {
          continue;
        }

        // Must have explicit scopeType
        if (!pc.scopeType) {
          continue;
        }

        // Account Modality Contract Enforcement (Section 7)
        const expectedModality = POSITION_ACCOUNT_MODALITY_CONTRACT[a.positionCode];
        if (expectedModality === "UNIT") {
          if (identity.accountType !== "UNIT") {
            profileRejection = {
              code: "IDENTITY_NOT_LINKED",
              reasonCode: "ACCOUNT_TYPE_MISMATCH",
              reason: `Position ${a.positionCode} requires a UNIT account (found: ${identity.accountType}).`,
            };
            continue;
          }
          if (a.requiresPersonalAccount === true) {
            profileRejection = {
              code: "SYSTEM_FAIL_CLOSED",
              reasonCode: "POSITION_MODALITY_INCOMPATIBLE",
              reason: `Database position metadata for ${a.positionCode} has requiresPersonalAccount=true, incompatible with approved UNIT modality.`,
            };
            continue;
          }
        } else if (expectedModality === "PERSONAL") {
          if (identity.accountType && identity.accountType !== "PERSONAL") {
            profileRejection = {
              code: "IDENTITY_NOT_LINKED",
              reasonCode: "ACCOUNT_TYPE_MISMATCH",
              reason: `Position ${a.positionCode} requires a PERSONAL account (found: ${identity.accountType}).`,
            };
            continue;
          }
          if (a.requiresPersonalAccount === false) {
            profileRejection = {
              code: "SYSTEM_FAIL_CLOSED",
              reasonCode: "POSITION_MODALITY_INCOMPATIBLE",
              reason: `Database position metadata for ${a.positionCode} has requiresPersonalAccount=false, incompatible with approved PERSONAL modality.`,
            };
            continue;
          }
        }

        // Now that capability grant is verified in production, enforce linked profile requirements (Blocker 1 requirement 5)
        if (STAFF_PROFILE_REQUIRED_POSITIONS.has(a.positionCode)) {
          if (!identity.staffId) {
            profileRejection = {
              code: "IDENTITY_NOT_LINKED",
              reasonCode: "IDENTITY_NOT_LINKED",
              reason: `Position ${a.positionCode} requires a linked Staff profile in database.`,
            };
            continue;
          }
          if (identity.staffStatus && identity.staffStatus !== "AKTIF") {
            profileRejection = {
              code: "IDENTITY_INACTIVE",
              reasonCode: "IDENTITY_INACTIVE",
              reason: `Linked Staff profile is inactive (status: ${identity.staffStatus}).`,
            };
            continue;
          }
        }

        if (SANTRI_PROFILE_REQUIRED_POSITIONS.has(a.positionCode)) {
          if (!identity.santriId) {
            profileRejection = {
              code: "IDENTITY_NOT_LINKED",
              reasonCode: "IDENTITY_NOT_LINKED",
              reason: `Position ${a.positionCode} requires a linked Santri profile in database.`,
            };
            continue;
          }
          if (identity.santriStatus && identity.santriStatus !== "AKTIF") {
            profileRejection = {
              code: "IDENTITY_INACTIVE",
              reasonCode: "IDENTITY_INACTIVE",
              reason: `Linked Santri profile is inactive (status: ${identity.santriStatus}).`,
            };
            continue;
          }
        }

        candidateGrants.push({
          assignment: a,
          grant: {
            assignmentId: a.id,
            positionCode: a.positionCode,
            capabilityCode: pc.capabilityCode,
            scopeType: pc.scopeType,
            anchorUnitId: a.unitId,
            unitIds: a.scopeUnits.map((su) => su.unitId),
            businessRuleState: pc.businessRuleState,
            ...(a.unitGenderComplex ? { genderComplex: a.unitGenderComplex } : {}),
            ...(a.domain ? { orgDomain: a.domain as OrgDomain } : {}),
          } as EffectiveCapabilityGrant,
        });
      }
    }
  }

  if (candidateGrants.length === 0) {
    if (profileRejection) {
      return {
        decision: "DENY",
        code: profileRejection.code,
        reasonCode: profileRejection.reasonCode,
        reason: profileRejection.reason,
      };
    }
    return {
      decision: "DENY",
      code: "CAPABILITY_NOT_GRANTED",
      reasonCode: "CAPABILITY_NOT_GRANTED",
      reason: `Capability '${params.capability}' is not granted to user with VERIFIED_PRODUCTION status.`,
    };
  }

  // 5. Hydrate Authoritative Resource Context (Blocker 2)
  let resolvedContext: ResolvedResourceContext | undefined = params.resolvedContext;
  if (!resolvedContext && params.resourceContext && params.dataProvider) {
    try {
      const res = await params.dataProvider.resolveResourceContext(
        params.resourceContext,
        identity.userId,
        params.capability
      );
      if (res === null) {
        // Resource lookup null must fail closed immediately, even for GLOBAL grants
        return {
          decision: "DENY",
          code: "INVALID_RESOURCE_CONTEXT",
          reasonCode: "INVALID_RESOURCE_CONTEXT",
          reason: "Authoritative target resource lookup returned null or target resource does not exist.",
          capabilityCode: params.capability,
        };
      }
      resolvedContext = res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        decision: "ERROR",
        code: "SYSTEM_FAIL_CLOSED",
        reasonCode: "DATABASE_UNAVAILABLE",
        reason: `Database error hydrating resource context: ${msg}`,
      };
    }
  }

  // 6. Multi-Grant Scope Evaluation: ALLOW if at least one grant matches
  let lastDenyResult: { code: AuthorizationResultCode; reason: string } | null = null;

  for (const { assignment, grant } of candidateGrants) {
    const scopeRes = evaluateScopePredicate(grant, resolvedContext, {
      userId: identity.userId,
      santriId: identity.santriId,
      staffId: identity.staffId,
      accountType: identity.accountType,
      placementUnitId,
      genderComplex: identity.genderComplex,
    });

    if (scopeRes.matches) {
      return {
        decision: "ALLOW",
        code: "ALLOWED",
        reasonCode: "ALLOWED",
        reason: `Access authorized via assignment ${assignment.id} (${assignment.positionCode}) with scope ${grant.scopeType}.`,
        assignmentId: assignment.id,
        positionId: assignment.positionId,
        positionCode: assignment.positionCode,
        capabilityCode: grant.capabilityCode,
        scopeType: grant.scopeType,
        evaluatedUnitIds: grant.unitIds,
        grantUsed: grant,
        verifiedExecutor,
      };
    }

    lastDenyResult = {
      code: scopeRes.code,
      reason: scopeRes.reason,
    };
  }

  return {
    decision: "DENY",
    code: lastDenyResult?.code || "SCOPE_MISMATCH",
    reasonCode: lastDenyResult?.code || "SCOPE_MISMATCH",
    reason: lastDenyResult?.reason || "Target resource is outside user's permitted canonical scope.",
    capabilityCode: params.capability,
  };
}

/**
 * Creates an authoritative Prisma-backed ICanonicalDataProvider instance.
 */
export function createPrismaDataProvider(prisma: PrismaClient): ICanonicalDataProvider {
  return {
    async getIdentity(userId: string): Promise<CanonicalIdentity | null> {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff: true,
          santri: true,
          unitPlacement: {
            include: { unit: true },
          },
        },
      });
      if (!user) return null;
      return {
        userId: user.id,
        username: user.username,
        status: user.status,
        accountType: user.accountType,
        role: user.role,
        staffId: user.staffId,
        staffStatus: user.staff?.status,
        santriId: user.santriId,
        santriStatus: user.santri?.status,
        name: user.staff?.nama || user.santri?.nama || user.username,
        placementUnitId: user.unitPlacement?.unitId || null,
        genderComplex: (user.unitPlacement?.unit?.genderComplex as GenderComplex) || undefined,
      };
    },

    async getActiveAssignments(userId: string, now: Date): Promise<CanonicalAssignmentWithDetails[]> {
      const assignments = await prisma.assignment.findMany({
        where: {
          userId,
          status: "ACTIVE",
          validFrom: { lte: now },
          OR: [
            { validUntil: null },
            { validUntil: { gte: now } },
          ],
        },
        include: {
          position: {
            include: {
              capabilities: true,
            },
          },
          unit: true,
          scopedUnits: {
            include: {
              unit: true,
            },
          },
        },
      });

      return assignments.map((a) => ({
        id: a.id,
        userId: a.userId,
        positionId: a.positionId,
        positionCode: a.position.code,
        positionName: a.position.name,
        domain: a.position.domain,
        unitId: a.unitId,
        unitCode: a.unit.code,
        unitName: a.unit.name,
        unitGenderComplex: a.unit.genderComplex,
        status: a.status,
        validFrom: a.validFrom,
        validUntil: a.validUntil,
        requiresPersonalAccount: a.position.requiresPersonalAccount,
        positionCapabilities: a.position.capabilities.map((pc) => ({
          capabilityCode: pc.capabilityCode,
          scopeType: pc.scopeType,
          businessRuleState: pc.businessRuleState,
        })),
        scopeUnits: a.scopedUnits.map((su) => ({
          unitId: su.unitId,
          unitCode: su.unit.code,
        })),
      }));
    },

    async getUnitAccountPlacement(userId: string): Promise<{ unitId: string; count?: number } | null> {
      const placements = await prisma.unitAccountPlacement.findMany({
        where: { userId },
      });
      if (placements.length === 0) return null;
      return { unitId: placements[0].unitId, count: placements.length };
    },

    async verifyHumanExecutor(executorId: string): Promise<CanonicalExecutorIdentity | null> {
      // Find human executor: support lookup by User.id, User.staffId, or User.santriId
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: executorId },
            { staffId: executorId },
            { santriId: executorId },
          ],
        },
        include: { staff: true, santri: true },
      });

      if (user) {
        // Must be AccountType.PERSONAL and User.status === "AKTIF"
        if (user.accountType !== "PERSONAL" || user.status !== "AKTIF") {
          return {
            userId: user.id,
            id: user.id,
            name: user.username,
            staffId: user.staffId || null,
            santriId: user.santriId || null,
            isActive: false,
          };
        }

        // Must have linked active Staff OR linked active Santri profile
        if (user.staff) {
          return {
            userId: user.id,
            id: user.id,
            name: user.staff.nama,
            staffId: user.staff.id,
            santriId: user.santriId || null,
            isActive: user.staff.status === "AKTIF",
          };
        }

        if (user.santri) {
          return {
            userId: user.id,
            id: user.id,
            name: user.santri.nama,
            staffId: user.staffId || null,
            santriId: user.santri.id,
            isActive: user.santri.status === "AKTIF",
          };
        }

        // Active personal User with neither Staff nor Santri human profile -> REJECT
        return {
          userId: user.id,
          id: user.id,
          name: user.username,
          staffId: null,
          santriId: null,
          isActive: false,
        };
      }

      // Check direct Staff table if executorId is a Staff ID without direct User relation
      const staff = await prisma.staff.findUnique({
        where: { id: executorId },
        include: { user: true },
      });

      if (staff) {
        const linkedUser = staff.user;
        if (!linkedUser || linkedUser.accountType !== "PERSONAL" || linkedUser.status !== "AKTIF") {
          return {
            userId: linkedUser?.id || "",
            id: linkedUser?.id || "",
            name: staff.nama,
            staffId: staff.id,
            santriId: null,
            isActive: false,
          };
        }
        return {
          userId: linkedUser.id,
          id: linkedUser.id,
          name: staff.nama,
          staffId: staff.id,
          santriId: null,
          isActive: staff.status === "AKTIF",
        };
      }

      // Check direct Santri table if executorId is a Santri ID without direct User relation
      const santri = await prisma.santri.findUnique({
        where: { id: executorId },
        select: {
          id: true,
          nama: true,
          status: true,
          user: true,
        },
      });

      if (santri) {
        const linkedUser = santri.user;
        if (!linkedUser || linkedUser.accountType !== "PERSONAL" || linkedUser.status !== "AKTIF") {
          return {
            userId: linkedUser?.id || "",
            id: linkedUser?.id || "",
            name: santri.nama,
            staffId: null,
            santriId: santri.id,
            isActive: false,
          };
        }
        return {
          userId: linkedUser.id,
          id: linkedUser.id,
          name: santri.nama,
          staffId: null,
          santriId: santri.id,
          isActive: santri.status === "AKTIF",
        };
      }

      return null;
    },

    async resolveResourceContext(requested: RequestedResourceContext, subjectUserId?: string, capability?: string): Promise<ResolvedResourceContext | null> {
      let unitGenderComplex: GenderComplex | undefined;
      let orgDomain: OrgDomain | undefined;
      const orgUnitIds: string[] = [];

      let halaqohId: string | undefined = undefined;
      let kamarId: string | undefined = undefined;
      let targetSantriId: string | undefined = requested.santriId;

      // 1. Cross-Identifier Consistency & Resource-level Validation
      // If requested.resourceId is supplied, authoritatively resolve its owning santri
      if (requested.resourceId) {
        const tasmi = await prisma.tasmiSimaan.findUnique({
          where: { id: requested.resourceId },
          select: { id: true, santriId: true, santri: { select: { halaqohId: true, jenisKelamin: true } } },
        });
        if (!tasmi) {
          // Explicit resourceId not found in database -> fail closed
          return null;
        }

        // Consistency check: If both santriId and resourceId are supplied, they must match!
        // Do NOT union attributes from unrelated resource identifiers.
        if (requested.santriId && tasmi.santriId !== requested.santriId) {
          return null;
        }

        orgDomain = "TAHFIZH";
        if (!targetSantriId) {
          targetSantriId = tasmi.santriId;
        }
      }

      let educationSession:
        | {
            id: string;
            educationTrack: string;
            subjectId: string;
            cohortId: string | null;
            programLevel: number | null;
            genderGroup: GenderComplex | null;
            scheduledStaffId: string | null;
            actualTeacherUserId: string | null;
            scheduledTeacherAssignmentId: string | null;
          }
        | undefined;

      // 1b. Authoritative Education Session Resolution
      if (requested.educationSessionId) {
        const sessionDelegate = (prisma as unknown as {
          educationSession?: {
            findUnique: (args: {
              where: { id: string };
              include?: {
                subject?: boolean;
                cohort?: boolean;
                scheduledTeacherAssignment?: boolean;
              };
            }) => Promise<{
              id: string;
              educationTrack: string;
              subjectId: string;
              cohortId: string | null;
              programLevel: number | null;
              genderGroup: GenderComplex | null;
              scheduledStaffId: string | null;
              actualTeacherUserId: string | null;
              scheduledTeacherAssignmentId: string | null;
            } | null>;
          };
        }).educationSession;

        if (sessionDelegate) {
          const session = await sessionDelegate.findUnique({
            where: { id: requested.educationSessionId },
            include: {
              subject: true,
              cohort: true,
              scheduledTeacherAssignment: true,
            },
          });
          if (!session) {
            // Explicit educationSessionId not found in database -> fail closed
            return null;
          }

          educationSession = {
            id: session.id,
            educationTrack: session.educationTrack,
            subjectId: session.subjectId,
            cohortId: session.cohortId,
            programLevel: session.programLevel,
            genderGroup: session.genderGroup as GenderComplex | null,
            scheduledStaffId: session.scheduledStaffId,
            actualTeacherUserId: session.actualTeacherUserId,
            scheduledTeacherAssignmentId: session.scheduledTeacherAssignmentId,
          };

          orgDomain = "AKADEMIK";
          if (session.genderGroup === "PUTRA") {
            unitGenderComplex = "PUTRA";
          } else if (session.genderGroup === "PUTRI") {
            unitGenderComplex = "PUTRI";
          }
        } else {
          return null;
        }
      }

      // 1c. Trust Boundary Closure: EducationSession + Santri Participant Consistency
      if (requested.educationSessionId && targetSantriId) {
        const participantDelegate = (prisma as unknown as {
          educationSessionParticipant?: {
            findUnique: (args: {
              where: {
                sessionId_santriId: {
                  sessionId: string;
                  santriId: string;
                };
              };
            }) => Promise<{ id: string; sessionId: string; santriId: string } | null>;
          };
        }).educationSessionParticipant;

        if (participantDelegate) {
          const participant = await participantDelegate.findUnique({
            where: {
              sessionId_santriId: {
                sessionId: requested.educationSessionId,
                santriId: targetSantriId,
              },
            },
          });
          if (!participant) {
            // Santri is NOT an enrolled participant of this EducationSession -> fail closed
            return null;
          }
        } else {
          return null;
        }
      }

      // 2. Target Santri Hydration (Authoritative containment trust boundary)
      if (targetSantriId) {
        const targetSantri = await prisma.santri.findUnique({
          where: { id: targetSantriId },
          select: {
            id: true,
            jenisKelamin: true,
            halaqohId: true,
            halaqoh: true,
          },
        });

        if (!targetSantri) {
          // Target santri was requested/resolved but does not exist in DB -> fail closed
          return null;
        }

        const santriGenderComplex: GenderComplex | undefined =
          targetSantri.jenisKelamin === "L" ? "PUTRA" : targetSantri.jenisKelamin === "P" ? "PUTRI" : undefined;

        // Session Participant Gender Consistency (Fail closed on mismatch)
        if (educationSession) {
          if (educationSession.genderGroup === "PUTRA" && santriGenderComplex !== "PUTRA") {
            // PUTRA session cannot contain PUTRI santri -> fail closed
            return null;
          }
          if (educationSession.genderGroup === "PUTRI" && santriGenderComplex !== "PUTRI") {
            // PUTRI session cannot contain PUTRA santri -> fail closed
            return null;
          }
        }

        const isAcademicContext = orgDomain === "AKADEMIK" || Boolean(requested.educationSessionId);

        // Cross-domain scope containment: Do NOT turn Tahfizh halaqoh into authorization scope for academic capabilities
        if (!isAcademicContext) {
          halaqohId = targetSantri.halaqohId || undefined;
          if (targetSantri.halaqohId) {
            orgUnitIds.push(targetSantri.halaqohId);
          }
        }

        if (!unitGenderComplex) {
          unitGenderComplex = santriGenderComplex;
        }

        // Capability-aware domain resolution: Derive strategic domain strictly from target capability namespace
        // Fails closed if namespace is unknown or capability is not supplied (zero guessing)
        if (!orgDomain) {
          if (capability) {
            const capLower = capability.toLowerCase();
            if (capLower.startsWith("tahfizh.")) {
              orgDomain = "TAHFIZH";
            } else if (capLower.startsWith("keasramaan.") || capLower.startsWith("health.")) {
              orgDomain = "KEASRAMAAN";
            } else if (capLower.startsWith("academic.")) {
              orgDomain = "AKADEMIK";
            }
            // Unknown capability namespace: DO NOT GUESS -> orgDomain remains undefined
          }
          // No capability supplied: DO NOT GUESS -> orgDomain remains undefined
        }

        // Authoritative Kamar Placement Hydration
        // Invariant: Caller-supplied requested.kamarId is strictly ignored and MUST NEVER override actual placement.
        // Invariant: Academic context does NOT borrow Keasramaan kamar into academic scope.
        if (prisma.santriKamarPlacement && !isAcademicContext) {
          const activePlacement = await prisma.santriKamarPlacement.findFirst({
            where: {
              santriId: targetSantri.id,
              isActive: true,
            },
            include: {
              kamar: true,
            },
          });

          if (activePlacement && activePlacement.kamar) {
            const kamar = activePlacement.kamar;
            const isAuthoritativeKamar =
              kamar.type === "KAMAR" &&
              kamar.domain === "KEASRAMAAN" &&
              kamar.isActive === true;

            if (isAuthoritativeKamar) {
              const kamarGender = kamar.genderComplex as GenderComplex;
              const isGenderCompatible =
                !unitGenderComplex ||
                !kamarGender ||
                kamarGender === "CAMPUR" ||
                kamarGender === "TIDAK_TERIKAT" ||
                unitGenderComplex === kamarGender;

              if (isGenderCompatible) {
                kamarId = kamar.id;
                orgUnitIds.push(kamar.id);
                if (!targetSantri.halaqohId && kamar.domain) {
                  orgDomain = kamar.domain as OrgDomain;
                }
              } else {
                // Room placement violates gender boundary -> fail closed
                kamarId = undefined;
              }
            } else {
              // Room placement target is not an active KEASRAMAAN KAMAR OrgUnit -> fail closed
              kamarId = undefined;
            }
          } else {
            // Santri has no active Kamar placement -> fail closed for KAMAR-scoped operations
            kamarId = undefined;
          }
        } else {
          kamarId = undefined;
        }
      } else {
        // If santriId is NOT provided (e.g. standalone room/unit inspection):
        // Only accept halaqohId/kamarId if authoritatively verified against OrgUnit table
        if (requested.halaqohId) {
          const halaqohUnit = await prisma.orgUnit.findFirst({
            where: { id: requested.halaqohId, type: "HALAQOH", isActive: true },
          });
          if (halaqohUnit) {
            halaqohId = halaqohUnit.id;
            orgUnitIds.push(halaqohUnit.id);
            if (!unitGenderComplex) unitGenderComplex = halaqohUnit.genderComplex as GenderComplex;
            if (!orgDomain) orgDomain = halaqohUnit.domain as OrgDomain;
          } else {
            return null;
          }
        }

        if (requested.kamarId) {
          const kamarUnit = await prisma.orgUnit.findFirst({
            where: { id: requested.kamarId, type: "KAMAR", domain: "KEASRAMAAN", isActive: true },
          });
          if (kamarUnit) {
            kamarId = kamarUnit.id;
            orgUnitIds.push(kamarUnit.id);
            if (!unitGenderComplex) unitGenderComplex = kamarUnit.genderComplex as GenderComplex;
            if (!orgDomain) orgDomain = kamarUnit.domain as OrgDomain;
          } else {
            // Standalone kamar identifier was provided but does not exist as an authoritative KAMAR OrgUnit -> fail closed
            return null;
          }
        }
      }

      // 3. Authoritative OrgUnit Trust-Boundary Validation
      // Caller-supplied unitId may NEVER create an authorization boundary merely because the row exists.
      if (requested.unitId) {
        const unit = await prisma.orgUnit.findUnique({ where: { id: requested.unitId } });
        if (!unit || unit.isActive !== true) {
          // Unit does not exist or is inactive -> fail closed
          return null;
        }

        if (targetSantriId) {
          // When a target santri is present:
          // Prove server-side that unitId is an authoritative enclosing unit of that exact target.
          // Enclosing units of a santri are strictly their halaqohId and/or kamarId.
          const isEnclosingUnit =
            (halaqohId !== undefined && requested.unitId === halaqohId) ||
            (kamarId !== undefined && requested.unitId === kamarId);

          if (!isEnclosingUnit) {
            // Caller-supplied unitId does not authoritatively contain the target santri -> fail closed!
            return null;
          }

          if (!orgUnitIds.includes(unit.id)) {
            orgUnitIds.push(unit.id);
          }
        } else {
          // Standalone unit lookup (or alongside standalone kamarId/halaqohId):
          // resourceId / kamarId / halaqohId + unitId must not create a synthetic combined context
          // unless server-side containment is explicitly verified.
          if ((kamarId && requested.unitId !== kamarId) || (halaqohId && requested.unitId !== halaqohId)) {
            return null;
          }

          if (!orgUnitIds.includes(unit.id)) {
            orgUnitIds.push(unit.id);
          }
          if (!unitGenderComplex) unitGenderComplex = unit.genderComplex as GenderComplex;
          if (!orgDomain) orgDomain = unit.domain as OrgDomain;
        }
      }

      if (requested.targetUserId) {
        const targetUser = await prisma.user.findUnique({ where: { id: requested.targetUserId } });
        if (!targetUser) {
          return null;
        }
      }

      // 3. OWN_CHILD Server-Side Relation Resolution:
      // For Milestone 2 VERIFIED_PRODUCTION compatibility, use strictly the verified legacy relationship: User.santriId
      // Phone-based multi-child discovery (User.phone -> Santri.noHpWali) is deferred to future milestones (PROPOSED_TBD).
      let guardianLinkedSantriIds: string[] | undefined;
      if (subjectUserId) {
        const user = await prisma.user.findUnique({
          where: { id: subjectUserId },
          select: { id: true, santriId: true },
        });
        if (user && user.santriId) {
          guardianLinkedSantriIds = [user.santriId];
        } else {
          guardianLinkedSantriIds = [];
        }
      }

      return {
        santriId: targetSantriId,
        halaqohId,
        kamarId,
        orgUnitIds,
        genderComplex: unitGenderComplex,
        orgDomain,
        targetUserId: requested.targetUserId,
        guardianLinkedSantriIds,
        educationSessionId: requested.educationSessionId,
        educationSession,
      };
    },
  };
}

