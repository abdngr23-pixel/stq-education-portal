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
}

/**
 * Normalized Identity representation passed to canonical evaluator
 */
export interface CanonicalIdentity {
  userId: string;
  username: string;
  status: "AKTIF" | "NONAKTIF" | string;
  accountType: AccountType;
  staffId?: string | null;
  santriId?: string | null;
  name?: string;
  genderComplex?: GenderComplex;
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
  getUnitAccountPlacement(userId: string): Promise<{ unitId: string } | null>;
  verifyHumanExecutor(executorId: string): Promise<{ id: string; name: string; isActive: boolean } | null>;
  resolveResourceContext(requested: RequestedResourceContext): Promise<ResolvedResourceContext | null>;
}

/**
 * Canonical Authorization Request Input
 */
export interface AuthorizeCanonicalParams {
  identity: CanonicalIdentity | UserSession | null;
  capability: string;
  resourceContext?: RequestedResourceContext;
  resolvedContext?: ResolvedResourceContext; // Optional pre-resolved context (e.g. for pure testing)
  executorContext?: UnitAccountExecutorContext;
  isMutation?: boolean;
  now?: Date;
  dataProvider?: ICanonicalDataProvider;
}

/**
 * Main Authoritative Evaluator
 */
export async function authorizeCanonical(
  params: AuthorizeCanonicalParams
): Promise<CanonicalAuthorizationDecision> {
  const now = params.now || new Date();

  // 1. Validate Identity
  if (!params.identity || !params.identity.userId) {
    return {
      decision: "DENY",
      code: "UNAUTHENTICATED",
      reasonCode: "UNAUTHENTICATED",
      reason: "Session or identity is null, missing, or anonymous.",
    };
  }

  const identity: CanonicalIdentity =
    "accountType" in params.identity
      ? (params.identity as CanonicalIdentity)
      : {
          userId: params.identity.userId,
          username: params.identity.username,
          status: "AKTIF",
          accountType: params.identity.role === "OSDA" ? "UNIT" : "PERSONAL",
          staffId: params.identity.staffId,
          santriId: params.identity.santriId,
          name: params.identity.name,
        };

  if (identity.status !== "AKTIF") {
    return {
      decision: "DENY",
      code: "IDENTITY_INACTIVE",
      reasonCode: "IDENTITY_INACTIVE",
      reason: `User account is suspended or inactive (status: ${identity.status}).`,
    };
  }

  // 2. Unit Account Placements and Executor Attribution (AccountType.UNIT)
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          decision: "ERROR",
          code: "SYSTEM_FAIL_CLOSED",
          reasonCode: "DATABASE_UNAVAILABLE",
          reason: `Database error querying unit account placement: ${msg}`,
        };
      }
    }

    // Mutations on UNIT accounts strictly require verified human executor
    if (params.isMutation) {
      if (!params.executorContext || !params.executorContext.humanExecutorId) {
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

  // 4. Resolve Candidate Effective Grants Matching Requested Capability
  const candidateGrants: Array<{
    assignment: CanonicalAssignmentWithDetails;
    grant: EffectiveCapabilityGrant;
  }> = [];

  for (const a of activeAssignments) {
    // Check Unit Account Anchor Alignment: Assignment anchor unit must match placement unit
    if (identity.accountType === "UNIT" && params.executorContext) {
      if (params.executorContext.unitId && a.unitId !== params.executorContext.unitId) {
        continue; // Mismatch with assigned placement
      }
    }

    for (const pc of a.positionCapabilities) {
      if (pc.capabilityCode === params.capability) {
        // Enforce Activation Triple:
        // Must be VERIFIED_PRODUCTION (never PROPOSED_TBD or unverified)
        if (pc.businessRuleState !== "VERIFIED_PRODUCTION") {
          continue;
        }

        // Must have explicit scopeType
        if (!pc.scopeType) {
          continue;
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
            ...(a.domain ? { orgDomain: a.domain } : {}),
          } as EffectiveCapabilityGrant,
        });
      }
    }
  }

  if (candidateGrants.length === 0) {
    return {
      decision: "DENY",
      code: "CAPABILITY_NOT_GRANTED",
      reasonCode: "CAPABILITY_NOT_GRANTED",
      reason: `Capability '${params.capability}' is not granted to user with VERIFIED_PRODUCTION status.`,
    };
  }

  // 5. Hydrate Authoritative Resource Context
  let resolvedContext: ResolvedResourceContext | undefined = params.resolvedContext;
  if (!resolvedContext && params.resourceContext && params.dataProvider) {
    try {
      const res = await params.dataProvider.resolveResourceContext(params.resourceContext);
      if (res) {
        resolvedContext = res;
      }
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
        include: { staff: true, santri: true },
      });
      if (!user) return null;
      return {
        userId: user.id,
        username: user.username,
        status: user.status,
        accountType: user.accountType,
        staffId: user.staffId,
        santriId: user.santriId,
        name: user.staff?.nama || user.santri?.nama || user.username,
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

    async getUnitAccountPlacement(userId: string): Promise<{ unitId: string } | null> {
      const placement = await prisma.unitAccountPlacement.findUnique({
        where: { userId },
      });
      return placement ? { unitId: placement.unitId } : null;
    },

    async verifyHumanExecutor(executorId: string): Promise<{ id: string; name: string; isActive: boolean } | null> {
      const user = await prisma.user.findUnique({
        where: { id: executorId },
        include: { staff: true },
      });
      if (!user) return null;
      return {
        id: user.id,
        name: user.staff?.nama || user.username,
        isActive: user.status === "AKTIF",
      };
    },

    async resolveResourceContext(requested: RequestedResourceContext): Promise<ResolvedResourceContext | null> {
      let unitGenderComplex: GenderComplex | undefined;
      let orgDomain: OrgDomain | undefined;
      const orgUnitIds: string[] = [];

      if (requested.unitId) {
        orgUnitIds.push(requested.unitId);
        const unit = await prisma.orgUnit.findUnique({ where: { id: requested.unitId } });
        if (unit) {
          unitGenderComplex = unit.genderComplex as GenderComplex;
          orgDomain = unit.domain as OrgDomain;
        }
      }

      return {
        santriId: requested.santriId,
        halaqohId: requested.halaqohId,
        kamarId: requested.kamarId,
        orgUnitIds,
        genderComplex: unitGenderComplex,
        orgDomain,
        targetUserId: requested.targetUserId,
      };
    },
  };
}

