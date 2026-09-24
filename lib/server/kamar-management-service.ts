/**
 * Canonical Kamar Configuration Service (Gate 5 Keasramaan Runtime Remediation)
 * Implements authoritative dormitory room topology and placement operations.
 *
 * References:
 *  - Sections 16, 17, 18, 19, 20, 21
 *  - Types: OrgUnit, Assignment, SantriKamarPlacement, CanonicalAuditLog, Position, User, Staff
 *
 * NON-NEGOTIABLE INVARIANTS:
 * 1. Authorization: strictly requires authorizeCanonical with capability 'keasramaan.kamar.manage'
 *    conferred EXCLUSIVELY to KEPALA_KEASRAMAAN.
 * 2. Room validation: OrgUnit.type === "KAMAR", OrgUnit.domain === "KEASRAMAAN", isActive === true.
 * 3. Gender boundary: room genderComplex must be explicit and strictly compatible with occupant Santri.
 * 4. Mudhabbir assignment: must be PERSONAL User, active User, active Staff, position PEMBINA_HALAQOH anchored to KAMAR.
 * 5. Lifecycle: replacing Mudhabbir deterministically closes previous assignment; moving Santri deterministically closes prior placement.
 * 6. Atomicity & Audit: all multi-step operations execute inside a transaction, recording CanonicalAuditLog atomically.
 *    If any step or audit fails, transaction rolls back.
 */

import defaultPrisma from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  CanonicalAuthorizationDecision,
  CanonicalIdentity,
  ICanonicalDataProvider,
} from "@/lib/auth/canonical-evaluator";
import { UserSession } from "@/types/auth";
import {
  GenderComplex,
  KEASRAMAAN_KAMAR_CAPABILITIES,
  KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY,
  ScopeType,
  UnitAccountExecutorContext,
} from "@/types/architecture-lock";

export interface KamarOperationResult<T = unknown> {
  success: boolean;
  code?: string;
  reason?: string;
  data?: T;
}

export interface CreateKamarParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  code: string;
  name: string;
  genderComplex: GenderComplex;
  parentId?: string;
  metadata?: Record<string, unknown>;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface RenameKamarParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  kamarId: string;
  newName: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface AssignMudhabbirParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  kamarId: string;
  mudhabbirUserId: string;
  notes?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface AssignSantriParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  kamarId: string;
  santriIds: string[];
  notes?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface MoveSantriParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  santriId: string;
  targetKamarId: string;
  notes?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface InspectKamarParams {
  callerIdentity: CanonicalIdentity | UserSession;
  kamarId?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

type KamarManageAuthorizationResult =
  | {
      allowed: false;
      code: string;
      reason: string;
      auth: CanonicalAuthorizationDecision;
    }
  | {
      allowed: true;
      auth: CanonicalAuthorizationDecision;
      provenance: {
        assignmentId: string;
        positionCode: string;
        capabilityCode: string;
        scopeType: ScopeType;
      };
    };

/**
 * Validates canonical authority for kamar management.
 * Strictly restricted to KEPALA_KEASRAMAAN with valid keasramaan.kamar.manage grant.
 */
async function authorizeKamarManage(
  callerIdentity: CanonicalIdentity | UserSession,
  executorContext: UnitAccountExecutorContext | undefined,
  kamarId: string | undefined,
  dataProvider: ICanonicalDataProvider,
  isMutation = true
): Promise<KamarManageAuthorizationResult> {
  const auth = await authorizeCanonical({
    identity: callerIdentity,
    capability: KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE,
    executorContext,
    isMutation,
    resourceContext: kamarId ? { kamarId } : undefined,
    resolvedContext: kamarId
      ? undefined
      : {
          orgUnitIds: [],
          orgDomain: KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY.domain,
          genderComplex: "TIDAK_TERIKAT",
        },
    dataProvider,
  });

  if (auth.decision !== "ALLOW") {
    return {
      allowed: false,
      code: auth.code,
      reason: auth.reason || "Canonical Kamar authorization denied.",
      auth,
    };
  }

  if (
    !auth.assignmentId ||
    !auth.positionCode ||
    !auth.capabilityCode ||
    !auth.scopeType
  ) {
    return {
      allowed: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: "Canonical Kamar authorization returned incomplete audit provenance.",
      auth,
    };
  }

  if (
    auth.positionCode !== KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY.positionCode ||
    auth.capabilityCode !== KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY.capabilityCode ||
    (auth.scopeType !== "DOMAIN" && auth.scopeType !== "GLOBAL")
  ) {
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Only KEPALA_KEASRAMAAN is authorized to manage Kamar configuration (requires ${KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY.positionCode} + ${KEASRAMAAN_KAMAR_MANAGE_TARGET_POLICY.capabilityCode} @ DOMAIN or GLOBAL scope).`,
      auth,
    };
  }

  return {
    allowed: true,
    auth,
    provenance: {
      assignmentId: auth.assignmentId,
      positionCode: auth.positionCode,
      capabilityCode: auth.capabilityCode,
      scopeType: auth.scopeType as ScopeType,
    },
  };
}

/**
 * 1. Create Kamar
 */
export async function createKamar(params: CreateKamarParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Validate authorization
  const authCheck = await authorizeKamarManage(
    params.callerIdentity,
    params.executorContext,
    undefined,
    dataProvider
  );
  if (!authCheck.allowed) {
    return { success: false, code: authCheck.code, reason: authCheck.reason };
  }

  // Input validation
  if (!params.code || !params.code.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Kamar code is required." };
  }
  if (!params.name || !params.name.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Kamar name is required." };
  }
  if (!params.genderComplex || (params.genderComplex !== "PUTRA" && params.genderComplex !== "PUTRI" && params.genderComplex !== "CAMPUR")) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Explicit genderComplex (PUTRA/PUTRI/CAMPUR) is required." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Check existing code uniqueness
      const existing = await tx.orgUnit.findUnique({ where: { code: params.code.trim() } });
      if (existing) {
        throw new Error(`OrgUnit with code ${params.code} already exists.`);
      }

      // Create OrgUnit
      const kamar = await tx.orgUnit.create({
        data: {
          code: params.code.trim(),
          name: params.name.trim(),
          type: "KAMAR",
          domain: "KEASRAMAAN",
          genderComplex: params.genderComplex,
          parentId: params.parentId || null,
          isActive: true,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        },
      });

      // Write CanonicalAuditLog
      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "KAMAR_CREATE",
          entity: "OrgUnit",
          entityId: kamar.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: kamar.id,
          afterState: JSON.parse(JSON.stringify(kamar)),
        },
      });

      return {
        success: true,
        data: kamar,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to create Kamar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 2. Rename Kamar
 */
export async function renameKamar(params: RenameKamarParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Validate authorization
  const authCheck = await authorizeKamarManage(
    params.callerIdentity,
    params.executorContext,
    params.kamarId,
    dataProvider
  );
  if (!authCheck.allowed) {
    return { success: false, code: authCheck.code, reason: authCheck.reason };
  }

  if (!params.newName || !params.newName.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "New Kamar name is required." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const kamar = await tx.orgUnit.findUnique({ where: { id: params.kamarId } });
      if (!kamar || kamar.type !== "KAMAR" || kamar.domain !== "KEASRAMAAN" || !kamar.isActive) {
        throw new Error(`Authoritative KEASRAMAAN KAMAR with ID ${params.kamarId} not found.`);
      }

      const beforeState = JSON.parse(JSON.stringify(kamar));

      const updated = await tx.orgUnit.update({
        where: { id: params.kamarId },
        data: { name: params.newName.trim() },
      });

      const afterState = JSON.parse(JSON.stringify(updated));

      // Record audit
      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "KAMAR_RENAME",
          entity: "OrgUnit",
          entityId: kamar.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: kamar.id,
          beforeState,
          afterState,
        },
      });

      return {
        success: true,
        data: updated,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to rename Kamar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 3. Assign or Replace Mudhabbir
 */
export async function assignMudhabbir(params: AssignMudhabbirParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Validate authorization
  const authCheck = await authorizeKamarManage(
    params.callerIdentity,
    params.executorContext,
    params.kamarId,
    dataProvider
  );
  if (!authCheck.allowed) {
    return { success: false, code: authCheck.code, reason: authCheck.reason };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify Kamar exists and is active
      const kamar = await tx.orgUnit.findUnique({ where: { id: params.kamarId } });
      if (!kamar || kamar.type !== "KAMAR" || kamar.domain !== "KEASRAMAAN" || !kamar.isActive) {
        throw new Error(`Authoritative active KEASRAMAAN KAMAR with ID ${params.kamarId} not found.`);
      }

      // 2. Verify selected Mudhabbir candidate identity: must be PERSONAL, User AKTIF, Staff AKTIF
      const user = await tx.user.findUnique({
        where: { id: params.mudhabbirUserId },
        include: { staff: true },
      });
      if (!user) {
        throw new Error(`Candidate user ${params.mudhabbirUserId} not found.`);
      }
      if (user.accountType !== "PERSONAL") {
        throw new Error(`Mudhabbir identity must be AccountType.PERSONAL (found: ${user.accountType}).`);
      }
      if (user.status !== "AKTIF") {
        throw new Error(`Mudhabbir user account must be status AKTIF (found: ${user.status}).`);
      }
      if (!user.staff) {
        throw new Error(`Mudhabbir user must have a linked Staff profile in database.`);
      }
      if (user.staff.status !== "AKTIF") {
        throw new Error(`Mudhabbir linked Staff profile must be status AKTIF (found: ${user.staff.status}).`);
      }

      // 3. Find canonical PEMBINA_HALAQOH position
      const position = await tx.position.findUnique({
        where: { code: "PEMBINA_HALAQOH" },
      });
      if (!position || !position.isActive) {
        throw new Error("Canonical position PEMBINA_HALAQOH not found or inactive.");
      }

      const now = new Date();

      // 4. Deterministically close previous active Mudhabbir assignment for this Kamar
      const previousAssignments = await tx.assignment.findMany({
        where: {
          unitId: kamar.id,
          positionId: position.id,
          status: "ACTIVE",
        },
      });

      for (const prev of previousAssignments) {
        await tx.assignment.update({
          where: { id: prev.id },
          data: {
            status: "REVOKED",
            validUntil: now,
            notes: `Superceded by new Mudhabbir assignment to user ${user.id} at ${now.toISOString()}`,
          },
        });
      }

      // 5. Create new canonical Assignment
      const newAssignment = await tx.assignment.create({
        data: {
          userId: user.id,
          positionId: position.id,
          unitId: kamar.id,
          status: "ACTIVE",
          validFrom: now,
          validUntil: null,
          notes: params.notes || "Canonical Mudhabbir Room Assignment",
          createdById: authCheck.auth.verifiedExecutor?.userId || params.callerIdentity.userId,
        },
      });

      // 6. Record audit atomically
      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "MUDHABBIR_ASSIGN",
          entity: "Assignment",
          entityId: newAssignment.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: kamar.id,
          beforeState: previousAssignments.length > 0 ? JSON.parse(JSON.stringify(previousAssignments)) : null,
          afterState: JSON.parse(JSON.stringify(newAssignment)),
        },
      });

      return {
        success: true,
        data: newAssignment,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to assign Mudhabbir: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 4. Assign Occupant Santri
 */
export async function assignSantri(params: AssignSantriParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Validate authorization
  const authCheck = await authorizeKamarManage(
    params.callerIdentity,
    params.executorContext,
    params.kamarId,
    dataProvider
  );
  if (!authCheck.allowed) {
    return { success: false, code: authCheck.code, reason: authCheck.reason };
  }

  if (!params.santriIds || params.santriIds.length === 0) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "At least one santriId must be provided." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const kamar = await tx.orgUnit.findUnique({ where: { id: params.kamarId } });
      if (!kamar || kamar.type !== "KAMAR" || kamar.domain !== "KEASRAMAAN" || !kamar.isActive) {
        throw new Error(`Authoritative active KEASRAMAAN KAMAR with ID ${params.kamarId} not found.`);
      }

      const now = new Date();
      const createdPlacements = [];

      for (const santriId of params.santriIds) {
        const santri = await tx.santri.findUnique({ where: { id: santriId } });
        if (!santri || (santri.status && santri.status !== "AKTIF")) {
          throw new Error(`Active Santri with ID ${santriId} not found.`);
        }

        // Gender boundary validation
        const santriGender = santri.jenisKelamin === "L" ? "PUTRA" : santri.jenisKelamin === "P" ? "PUTRI" : "CAMPUR";
        if (
          kamar.genderComplex !== "CAMPUR" &&
          kamar.genderComplex !== "TIDAK_TERIKAT" &&
          santriGender !== kamar.genderComplex
        ) {
          throw new Error(
            `Gender boundary violation: Santri ${santri.nama} (${santriGender}) cannot be placed in ${kamar.genderComplex} room.`
          );
        }

        // Check active placements
        const activePlacements = await tx.santriKamarPlacement.findMany({
          where: { santriId: santri.id, isActive: true },
        });

        if (activePlacements.length > 1) {
          throw new Error(`Santri ${santri.id} has multiple active placements, strictly failing closed.`);
        }

        // Close existing active placement if moving
        for (const prev of activePlacements) {
          if (prev.kamarId === kamar.id) {
            // Already actively placed in this room
            continue;
          }
          await tx.santriKamarPlacement.update({
            where: { id: prev.id },
            data: {
              isActive: false,
              endDate: now,
              notes: `Moved to kamar ${kamar.name} (${kamar.id}) at ${now.toISOString()}`,
            },
          });
        }

        // If not already in this room, create placement
        const alreadyInRoom = activePlacements.some((p) => p.kamarId === kamar.id);
        if (!alreadyInRoom) {
          const placement = await tx.santriKamarPlacement.create({
            data: {
              santriId: santri.id,
              kamarId: kamar.id,
              isActive: true,
              startDate: now,
              notes: params.notes || "Canonical Room Placement",
              createdById: authCheck.auth.verifiedExecutor?.userId || params.callerIdentity.userId,
            },
          });
          createdPlacements.push(placement);
        }
      }

      // Record audit
      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "SANTRI_KAMAR_ASSIGN",
          entity: "SantriKamarPlacement",
          entityId: kamar.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: kamar.id,
          afterState: JSON.parse(JSON.stringify(createdPlacements)),
        },
      });

      return {
        success: true,
        data: createdPlacements,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to assign Santri to Kamar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 5. Move Santri between Kamar
 */
export async function moveSantri(params: MoveSantriParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Validate authorization
  const authCheck = await authorizeKamarManage(
    params.callerIdentity,
    params.executorContext,
    params.targetKamarId,
    dataProvider
  );
  if (!authCheck.allowed) {
    return { success: false, code: authCheck.code, reason: authCheck.reason };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Target kamar validation
      const targetKamar = await tx.orgUnit.findUnique({ where: { id: params.targetKamarId } });
      if (!targetKamar || targetKamar.type !== "KAMAR" || targetKamar.domain !== "KEASRAMAAN" || !targetKamar.isActive) {
        throw new Error(`Target KEASRAMAAN KAMAR with ID ${params.targetKamarId} not found or inactive.`);
      }

      // 2. Santri validation
      const santri = await tx.santri.findUnique({ where: { id: params.santriId } });
      if (!santri || (santri.status && santri.status !== "AKTIF")) {
        throw new Error(`Active Santri with ID ${params.santriId} not found.`);
      }

      // 3. Gender boundary validation
      const santriGender = santri.jenisKelamin === "L" ? "PUTRA" : santri.jenisKelamin === "P" ? "PUTRI" : "CAMPUR";
      if (
        targetKamar.genderComplex !== "CAMPUR" &&
        targetKamar.genderComplex !== "TIDAK_TERIKAT" &&
        santriGender !== targetKamar.genderComplex
      ) {
        throw new Error(
          `Gender boundary violation: Santri ${santri.nama} (${santriGender}) cannot be moved to ${targetKamar.genderComplex} room.`
        );
      }

      const now = new Date();

      // 4. Find active placements
      const activePlacements = await tx.santriKamarPlacement.findMany({
        where: { santriId: santri.id, isActive: true },
      });

      if (activePlacements.length > 1) {
        throw new Error(`Santri ${santri.id} has multiple active placements, failing closed.`);
      }

      // Close previous placement
      let previousPlacement = null;
      if (activePlacements.length > 0) {
        previousPlacement = activePlacements[0];
        if (previousPlacement.kamarId === targetKamar.id) {
          await tx.canonicalAuditLog.create({
            data: {
              technicalAccountId: params.callerIdentity.userId,
              technicalAccountUsername: params.callerIdentity.username,
              humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
              humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
              action: "SANTRI_KAMAR_MOVE_NO_CHANGE",
              entity: "SantriKamarPlacement",
              entityId: santri.id,
              capabilityCode: authCheck.provenance.capabilityCode,
              assignmentId: authCheck.provenance.assignmentId,
              positionCode: authCheck.provenance.positionCode,
              scopeType: authCheck.provenance.scopeType,
              unitId: targetKamar.id,
              beforeState: JSON.parse(JSON.stringify(previousPlacement)),
              afterState: JSON.parse(JSON.stringify(previousPlacement)),
              reason: "NO_CHANGE: Santri already has an active placement in target Kamar.",
            },
          });
          return {
            success: true,
            code: "NO_CHANGE",
            reason: "Santri already has an active placement in target Kamar; no move was performed.",
            data: previousPlacement,
          };
        }
        await tx.santriKamarPlacement.update({
          where: { id: previousPlacement.id },
          data: {
            isActive: false,
            endDate: now,
            notes: `Moved to kamar ${targetKamar.name} (${targetKamar.id}) at ${now.toISOString()}`,
          },
        });
      }

      // Create new placement
      const newPlacement = await tx.santriKamarPlacement.create({
        data: {
          santriId: santri.id,
          kamarId: targetKamar.id,
          isActive: true,
          startDate: now,
          notes: params.notes || "Canonical Room Move",
          createdById: authCheck.auth.verifiedExecutor?.userId || params.callerIdentity.userId,
        },
      });

      // Record audit
      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "SANTRI_KAMAR_MOVE",
          entity: "SantriKamarPlacement",
          entityId: santri.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: targetKamar.id,
          beforeState: previousPlacement ? JSON.parse(JSON.stringify(previousPlacement)) : null,
          afterState: JSON.parse(JSON.stringify(newPlacement)),
        },
      });

      return {
        success: true,
        data: newPlacement,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to move Santri: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 6. Inspect Current Kamar Configuration
 */
export async function inspectKamarConfiguration(params: InspectKamarParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Authorize inspection: accepts keasramaan.kamar.inspect or keasramaan.kamar.manage
  let auth = await authorizeCanonical({
    identity: params.callerIdentity,
    capability: KEASRAMAAN_KAMAR_CAPABILITIES.INSPECT,
    resourceContext: params.kamarId ? { kamarId: params.kamarId } : undefined,
    dataProvider,
  });

  if (params.kamarId && auth.decision !== "ALLOW") {
    const manage = await authorizeKamarManage(
      params.callerIdentity,
      undefined,
      params.kamarId,
      dataProvider,
      false
    );
    if (!manage.allowed) {
      return { success: false, code: manage.code, reason: manage.reason };
    }
    auth = manage.auth;
  } else if (!params.kamarId) {
    const manage = await authorizeKamarManage(
      params.callerIdentity,
      undefined,
      undefined,
      dataProvider,
      false
    );
    if (!manage.allowed) {
      return { success: false, code: manage.code, reason: manage.reason };
    }
    auth = manage.auth;
  }

  if (auth.decision !== "ALLOW") {
    return {
      success: false,
      code: auth.code,
      reason: auth.reason,
    };
  }

  try {
    const kamars = await prisma.orgUnit.findMany({
      where: {
        type: "KAMAR",
        domain: "KEASRAMAAN",
        isActive: true,
        ...(params.kamarId ? { id: params.kamarId } : {}),
      },
      include: {
        assignments: {
          where: {
            status: "ACTIVE",
            position: { code: "PEMBINA_HALAQOH" },
          },
          include: {
            user: {
              include: { staff: true },
            },
            position: true,
          },
        },
        santriKamarPlacements: {
          where: { isActive: true },
          include: { santri: true },
        },
      },
    });

    return {
      success: true,
      data: kamars,
    };
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to inspect Kamar configuration: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
