/**
 * STQ ARCHITECTURE LOCK — UNIT ACCOUNT FOUNDATION
 * Kiosk / Station / Technical Account Management & Executor Binding.
 *
 * Repository: abdngr23-pixel/stq-education-portal
 * References:
 *  - docs/STQ_ASSIGNMENT_MODEL.md
 *  - docs/STQ_AUTHORIZATION_MODEL.md
 *  - types/architecture-lock.ts
 *
 * LOCKED RULES:
 * 1. Technical Account != Human Executor.
 * 2. Exactly ONE active placement per Unit Account (UnitAccountPlacement.userId @unique).
 * 3. Multi-device simultaneous access permitted for station/kiosk workflows.
 * 4. Mutations require a verified human executor (Staff/Santri identity).
 * 5. Anonymous or untracked shared-account mutations are strictly forbidden.
 */

import { UnitAccountExecutorContext, AccountType } from "@/types/architecture-lock";

/**
 * Validation result for unit account execution context
 */
export interface UnitAccountValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Validates the operational executor context for an action performed by a UNIT account.
 * Read-only operations may proceed under station identity; mutations REQUIRE human executor attribution.
 */
export function validateUnitAccountExecutionContext(params: {
  accountType: AccountType;
  isMutation: boolean;
  executorContext?: UnitAccountExecutorContext | null;
  activePlacementUnitId?: string;
}): UnitAccountValidationResult {
  // If account is PERSONAL, unit executor context is not required
  if (params.accountType === "PERSONAL") {
    return { isValid: true };
  }

  // If account is UNIT:
  // 1. Must have a confirmed operational unit placement
  if (!params.activePlacementUnitId) {
    return {
      isValid: false,
      errorCode: "UNIT_PLACEMENT_MISSING",
      errorMessage: "Unit account has no registered operational unit placement.",
    };
  }

  // 2. Read operations do not require human executor context (station display)
  if (!params.isMutation) {
    return { isValid: true };
  }

  // 3. Mutation operations REQUIRE verified human executor context
  if (!params.executorContext) {
    return {
      isValid: false,
      errorCode: "UNIT_EXECUTOR_REQUIRED",
      errorMessage: "Data mutation via UNIT account requires verified human executor context.",
    };
  }

  if (!params.executorContext.humanExecutorId || params.executorContext.humanExecutorId.trim() === "") {
    return {
      isValid: false,
      errorCode: "UNIT_EXECUTOR_ID_EMPTY",
      errorMessage: "humanExecutorId cannot be empty or omitted during unit account mutation.",
    };
  }

  // 4. Anchor unit consistency: executor context unitId must match account placement unitId
  if (
    params.executorContext.unitId &&
    params.executorContext.unitId !== params.activePlacementUnitId
  ) {
    return {
      isValid: false,
      errorCode: "UNIT_PLACEMENT_MISMATCH",
      errorMessage: `Executor context unit (${params.executorContext.unitId}) does not match account placement unit (${params.activePlacementUnitId}).`,
    };
  }

  return { isValid: true };
}

/**
 * Creates an immutable UnitAccountExecutorContext snapshot for audit attribution
 */
export function createUnitAccountExecutorContext(params: {
  technicalAccountId: string;
  technicalAccountUsername: string;
  humanExecutorId: string;
  humanExecutorName: string;
  unitId: string;
  assignmentId: string;
}): UnitAccountExecutorContext {
  if (!params.humanExecutorId || params.humanExecutorId.trim() === "") {
    throw new Error("Cannot create UnitAccountExecutorContext without verified humanExecutorId.");
  }

  return {
    technicalAccountId: params.technicalAccountId,
    technicalAccountUsername: params.technicalAccountUsername,
    humanExecutorId: params.humanExecutorId.trim(),
    humanExecutorName: params.humanExecutorName.trim(),
    unitId: params.unitId,
    assignmentId: params.assignmentId,
  };
}
