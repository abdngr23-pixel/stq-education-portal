/**
 * STQ ARCHITECTURE LOCK — CANONICAL SCOPE EVALUATOR
 * Authoritative Resource Scoping and Boundary Containment Engine.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_SCOPE_MODEL.md
 *  - docs/STQ_AUTHORIZATION_MODEL.md
 *  - types/architecture-lock.ts
 *
 * NON-NEGOTIABLE INVARIANTS:
 * 1. ScopeType is orthogonal to Capability: Capability evaluation strictly precedes Scope.
 * 2. GLOBAL scope does NOT mean unrestricted application access; it means institutional
 *    breadth for the specific granted capability only.
 * 3. NO arbitrary concatenated pseudo-scopes.
 * 4. NO username matching, display name matching, or client-supplied boundaries.
 * 5. Server-hydrated context is the single source of authoritative boundary truth.
 */

import {
  ScopeType,
  GenderComplex,
  EffectiveCapabilityGrant,
  ResolvedResourceContext,
  AuthorizationResultCode,
} from "@/types/architecture-lock";

/**
 * Result of scope evaluation against resource context
 */
export interface ScopeEvaluationResult {
  matches: boolean;
  code: AuthorizationResultCode;
  reason: string;
  evaluatedScope?: ScopeType;
  evaluatedAnchorUnitId?: string;
}

/**
 * Evaluates whether a subject's gender complex is permitted to access a target unit's gender complex.
 * PUTRA cannot access PUTRI (and vice-versa) unless either complex is CAMPUR or TIDAK_TERIKAT.
 */
export function evaluateGenderComplexBoundary(
  actorComplex: GenderComplex | undefined,
  targetComplex: GenderComplex | undefined
): boolean {
  if (!actorComplex || !targetComplex) {
    // If either complex is unconstrained/unspecified, allow regular scope check to govern
    return true;
  }

  if (actorComplex === "TIDAK_TERIKAT" || targetComplex === "TIDAK_TERIKAT") {
    return true;
  }

  if (actorComplex === "CAMPUR" || targetComplex === "CAMPUR") {
    return true;
  }

  return actorComplex === targetComplex;
}

/**
 * Pure scope predicate evaluator.
 * Tests an EffectiveCapabilityGrant against server-resolved resource attributes.
 */
export function evaluateScopePredicate(
  grant: EffectiveCapabilityGrant,
  context: ResolvedResourceContext | undefined,
  subjectIdentity: {
    userId: string;
    santriId?: string | null;
    staffId?: string | null;
  }
): ScopeEvaluationResult {
  if (!grant || !grant.scopeType) {
    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: "Grant is missing explicit scopeType.",
    };
  }

  const { scopeType, anchorUnitId, unitIds } = grant;

  // 1. GLOBAL Scope: Institutional breadth for the granted capability
  if (scopeType === "GLOBAL") {
    return {
      matches: true,
      code: "ALLOWED",
      reason: "GLOBAL scope matches institutional resource.",
      evaluatedScope: "GLOBAL",
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // All subsequent scopes require valid resolved context
  if (!context) {
    return {
      matches: false,
      code: "INVALID_RESOURCE_CONTEXT",
      reason: "Scoped capability requires non-empty resource context.",
      evaluatedScope: scopeType,
    };
  }

  // Gender boundary check
  if (
    context.genderComplex &&
    grant.anchorUnitId &&
    !evaluateGenderComplexBoundary(
      (grant as unknown as { genderComplex?: GenderComplex }).genderComplex,
      context.genderComplex
    )
  ) {
    return {
      matches: false,
      code: "GENDER_COMPLEX_DENIED",
      reason: `Access denied across gender boundary (${context.genderComplex}).`,
      evaluatedScope: scopeType,
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // 2. DOMAIN Scope: All units within the strategic domain (e.g. TAHFIZH, KEASRAMAAN)
  if (scopeType === "DOMAIN") {
    // If resource specifies domain, it must match
    if (context.orgDomain) {
      const grantDomain = (grant as unknown as { orgDomain?: string }).orgDomain;
      if (grantDomain && grantDomain !== context.orgDomain) {
        return {
          matches: false,
          code: "SCOPE_MISMATCH",
          reason: `Target domain (${context.orgDomain}) does not match grant domain (${grantDomain}).`,
          evaluatedScope: "DOMAIN",
        };
      }
    }
    return {
      matches: true,
      code: "ALLOWED",
      reason: "DOMAIN scope matches target domain resource.",
      evaluatedScope: "DOMAIN",
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // 3. UNIT Scope: Direct anchor unit containment
  if (scopeType === "UNIT") {
    if (!anchorUnitId) {
      return {
        matches: false,
        code: "SCOPE_MISMATCH",
        reason: "UNIT scope grant has no anchorUnitId.",
        evaluatedScope: "UNIT",
      };
    }
    const unitMatch =
      context.orgUnitIds && context.orgUnitIds.includes(anchorUnitId);
    if (unitMatch) {
      return {
        matches: true,
        code: "ALLOWED",
        reason: `Target unit matched anchor unit (${anchorUnitId}).`,
        evaluatedScope: "UNIT",
        evaluatedAnchorUnitId: anchorUnitId,
      };
    }
    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: `Target resource is outside anchor unit (${anchorUnitId}).`,
      evaluatedScope: "UNIT",
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // 4. ASSIGNED_UNITS Scope: Relationally bound multi-unit set (via AssignmentScopeUnit)
  if (scopeType === "ASSIGNED_UNITS") {
    const permittedUnits = new Set<string>([
      ...(anchorUnitId ? [anchorUnitId] : []),
      ...(unitIds || []),
    ]);

    if (permittedUnits.size === 0) {
      return {
        matches: false,
        code: "SCOPE_MISMATCH",
        reason: "ASSIGNED_UNITS grant has zero permitted units bound.",
        evaluatedScope: "ASSIGNED_UNITS",
      };
    }

    const hasMatch = (context.orgUnitIds || []).some((u) => permittedUnits.has(u));
    if (hasMatch) {
      return {
        matches: true,
        code: "ALLOWED",
        reason: "Target resource matched relationally assigned units.",
        evaluatedScope: "ASSIGNED_UNITS",
        evaluatedAnchorUnitId: anchorUnitId,
      };
    }

    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: "Target resource does not match any relationally assigned units.",
      evaluatedScope: "ASSIGNED_UNITS",
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // 5. HALAQOH Scope: Ordinary Musyrif Tahfizh bound strictly to assigned halaqoh
  if (scopeType === "HALAQOH") {
    if (!context.halaqohId) {
      return {
        matches: false,
        code: "INVALID_RESOURCE_CONTEXT",
        reason: "Target student has no assigned halaqoh (halaqohId is null).",
        evaluatedScope: "HALAQOH",
      };
    }
    const rawHalaqoh = context["assignedHalaqohIds"];
    const assignedIds = Array.isArray(rawHalaqoh)
      ? (rawHalaqoh.filter((x): x is string => typeof x === "string"))
      : [];
    const permittedHalaqoh = new Set<string>([
      ...(anchorUnitId ? [anchorUnitId] : []),
      ...(unitIds || []),
      ...assignedIds,
    ]);

    if (permittedHalaqoh.has(context.halaqohId)) {
      return {
        matches: true,
        code: "ALLOWED",
        reason: `Target student belongs to assigned halaqoh (${context.halaqohId}).`,
        evaluatedScope: "HALAQOH",
        evaluatedAnchorUnitId: anchorUnitId,
      };
    }
    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: `Target student halaqoh (${context.halaqohId}) does not match assigned halaqoh (${anchorUnitId}).`,
      evaluatedScope: "HALAQOH",
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // 6. KAMAR Scope: Mudabbir bound strictly to assigned dormitory room
  if (scopeType === "KAMAR") {
    if (!context.kamarId) {
      return {
        matches: false,
        code: "INVALID_RESOURCE_CONTEXT",
        reason: "Target student has no assigned kamar (kamarId is null).",
        evaluatedScope: "KAMAR",
      };
    }
    const rawKamar = context["assignedKamarIds"];
    const assignedKamar = Array.isArray(rawKamar)
      ? (rawKamar.filter((x): x is string => typeof x === "string"))
      : [];
    const permittedKamar = new Set<string>([
      ...(anchorUnitId ? [anchorUnitId] : []),
      ...(unitIds || []),
      ...assignedKamar,
    ]);

    if (permittedKamar.has(context.kamarId)) {
      return {
        matches: true,
        code: "ALLOWED",
        reason: `Target student belongs to assigned kamar (${context.kamarId}).`,
        evaluatedScope: "KAMAR",
        evaluatedAnchorUnitId: anchorUnitId,
      };
    }
    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: `Target student kamar (${context.kamarId}) does not match assigned kamar (${anchorUnitId}).`,
      evaluatedScope: "KAMAR",
      evaluatedAnchorUnitId: anchorUnitId,
    };
  }

  // 7. OWN_CHILD Scope: Wali Santri accessing relationally linked children
  if (scopeType === "OWN_CHILD") {
    if (!context.santriId) {
      return {
        matches: false,
        code: "INVALID_RESOURCE_CONTEXT",
        reason: "OWN_CHILD scope evaluation requires target santriId.",
        evaluatedScope: "OWN_CHILD",
      };
    }
    const linkedIds = context.guardianLinkedSantriIds || [];
    if (linkedIds.includes(context.santriId)) {
      return {
        matches: true,
        code: "ALLOWED",
        reason: `Target student (${context.santriId}) is confirmed child of guardian.`,
        evaluatedScope: "OWN_CHILD",
      };
    }
    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: `Target student (${context.santriId}) is NOT linked to guardian profile.`,
      evaluatedScope: "OWN_CHILD",
    };
  }

  // 8. SELF Scope: Subject strictly bound to their personal record
  if (scopeType === "SELF") {
    // Check santri self access
    if (subjectIdentity.santriId && context.santriId) {
      if (subjectIdentity.santriId === context.santriId) {
        return {
          matches: true,
          code: "ALLOWED",
          reason: "Subject santriId matches resource santriId.",
          evaluatedScope: "SELF",
        };
      }
    }
    // Check user self access
    if (context.targetUserId && subjectIdentity.userId === context.targetUserId) {
      return {
        matches: true,
        code: "ALLOWED",
        reason: "Subject userId matches resource targetUserId.",
        evaluatedScope: "SELF",
      };
    }
    return {
      matches: false,
      code: "SCOPE_MISMATCH",
      reason: "Resource target does not match subject personal record.",
      evaluatedScope: "SELF",
    };
  }

  return {
    matches: false,
    code: "SCOPE_MISMATCH",
    reason: `Unsupported or unknown scopeType: ${String(scopeType)}.`,
    evaluatedScope: scopeType,
  };
}
