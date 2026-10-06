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
 *    conferred EXCLUSIVELY to MUDIR with GLOBAL scope (INSTITUTIONAL domain).
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
  MUDIR_KAMAR_MANAGE_TARGET_POLICY,
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

export interface UpdateKamarParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  kamarId: string;
  name?: string;
  code?: string;
  genderComplex?: GenderComplex;
  isActive?: boolean;
  notes?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface SetKamarActiveParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  kamarId: string;
  isActive: boolean;
  notes?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface AssignMudhabbirParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  kamarId: string;
  mudhabbirUserId: string;
  additionalKamarIds?: string[];
  notes?: string;
  prismaClient?: PrismaClient;
  dataProvider?: ICanonicalDataProvider;
}

export interface ValidateUsrohHierarchyResult {
  valid: boolean;
  code?: string;
  reason?: string;
}

export interface CreateUsrohParams {
  callerIdentity: CanonicalIdentity | UserSession;
  executorContext?: UnitAccountExecutorContext;
  code: string;
  name: string;
  parentId: string;
  genderComplex?: GenderComplex;
  metadata?: Record<string, unknown>;
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
 * Strictly restricted to MUDIR with valid keasramaan.kamar.manage grant at GLOBAL scope.
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
          orgDomain: MUDIR_KAMAR_MANAGE_TARGET_POLICY.domain,
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

  const isMudirAuthorized =
    auth.positionCode === MUDIR_KAMAR_MANAGE_TARGET_POLICY.positionCode &&
    auth.capabilityCode === KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE &&
    auth.scopeType === "GLOBAL";

  if (!isMudirAuthorized) {
    if (auth.positionCode === "KEPALA_KEASRAMAAN") {
      return {
        allowed: false,
        code: "CAPABILITY_NOT_GRANTED",
        reason: "Otoritas KEPALA_KEASRAMAAN untuk mengelola kamar telah DIBATALKAN/SUPERSEDED oleh keputusan Business Owner. Manajemen kamar, penempatan santri, dan penetapan Mudhabbir merupakan prerogatif mutlak MUDIR (MUDIR + keasramaan.kamar.manage @ GLOBAL scope).",
        auth,
      };
    }
    return {
      allowed: false,
      code: "CAPABILITY_NOT_GRANTED",
      reason: `Manajemen struktur Kamar, penempatan santri, dan penetapan Mudhabbir merupakan hak prerogatif MUDIR (memerlukan ${MUDIR_KAMAR_MANAGE_TARGET_POLICY.positionCode} + ${KEASRAMAAN_KAMAR_CAPABILITIES.MANAGE} @ GLOBAL scope). Posisi '${auth.positionCode}' ditolak.`,
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
  if (!params.genderComplex || (params.genderComplex !== "PUTRA" && params.genderComplex !== "PUTRI")) {
    return {
      success: false,
      code: "INVALID_ARGUMENT",
      reason: "Explicit genderComplex (PUTRA atau PUTRI) wajib ditentukan. Kamar asrama santri CAMPUR dilarang keras.",
    };
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
 * 2. Update Kamar (Edit name, code, genderComplex, or soft-disable isActive)
 */
export async function updateKamar(params: UpdateKamarParams): Promise<KamarOperationResult> {
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
      const kamar = await tx.orgUnit.findUnique({ where: { id: params.kamarId } });
      if (!kamar || kamar.type !== "KAMAR" || kamar.domain !== "KEASRAMAAN" || (!kamar.isActive && params.isActive === undefined)) {
        throw new Error(`Authoritative active KEASRAMAAN KAMAR with ID ${params.kamarId} not found.`);
      }

      const beforeState = JSON.parse(JSON.stringify(kamar));

      const updateData: {
        name?: string;
        code?: string;
        genderComplex?: GenderComplex;
        isActive?: boolean;
      } = {};

      if (params.name !== undefined) {
        if (!params.name.trim()) {
          throw new Error("Kamar name cannot be empty.");
        }
        updateData.name = params.name.trim();
      }

      if (params.code !== undefined && params.code.trim() !== kamar.code) {
        if (!params.code.trim()) {
          throw new Error("Kamar code cannot be empty.");
        }
        const existing = await tx.orgUnit.findUnique({ where: { code: params.code.trim() } });
        if (existing) {
          throw new Error(`OrgUnit with code ${params.code.trim()} already exists.`);
        }
        updateData.code = params.code.trim();
      }

      if (params.genderComplex !== undefined) {
        if (params.genderComplex !== "PUTRA" && params.genderComplex !== "PUTRI") {
          throw new Error("Explicit genderComplex (PUTRA atau PUTRI) wajib ditentukan. Kamar asrama santri CAMPUR dilarang keras.");
        }
        updateData.genderComplex = params.genderComplex;
      }

      if (params.isActive !== undefined) {
        updateData.isActive = params.isActive;
      }

      const updated = await tx.orgUnit.update({
        where: { id: params.kamarId },
        data: updateData,
      });

      const afterState = JSON.parse(JSON.stringify(updated));

      // Record audit
      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "KAMAR_UPDATE",
          entity: "OrgUnit",
          entityId: kamar.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: kamar.id,
          beforeState,
          afterState,
          reason: params.notes || undefined,
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
      reason: `Failed to update Kamar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Soft-disable or re-activate Kamar
 */
export async function setKamarActive(params: SetKamarActiveParams): Promise<KamarOperationResult> {
  return updateKamar({
    callerIdentity: params.callerIdentity,
    executorContext: params.executorContext,
    kamarId: params.kamarId,
    isActive: params.isActive,
    notes: params.notes || `Kamar ${params.isActive ? "activated" : "soft-disabled"}`,
    prismaClient: params.prismaClient,
    dataProvider: params.dataProvider,
  });
}

/**
 * 2b. Rename Kamar
 */
export async function renameKamar(params: RenameKamarParams): Promise<KamarOperationResult> {
  return updateKamar({
    callerIdentity: params.callerIdentity,
    executorContext: params.executorContext,
    kamarId: params.kamarId,
    name: params.newName,
    prismaClient: params.prismaClient,
    dataProvider: params.dataProvider,
  });
}

/**
 * 3. Assign or Replace Mudhabbir (supports multi-Kamar scoping via AssignmentScopeUnit)
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
      // 1. Verify primary Kamar exists and is active
      const kamar = await tx.orgUnit.findUnique({ where: { id: params.kamarId } });
      if (!kamar || kamar.type !== "KAMAR" || kamar.domain !== "KEASRAMAAN" || !kamar.isActive) {
        throw new Error(`Authoritative active KEASRAMAAN KAMAR with ID ${params.kamarId} not found.`);
      }

      // Collect all target room IDs (primary + additional), deduplicated
      const targetRoomIds = Array.from(new Set([params.kamarId, ...(params.additionalKamarIds || [])]));

      // Verify all additional rooms exist and are active KAMAR in KEASRAMAAN
      for (const roomId of targetRoomIds) {
        if (roomId === params.kamarId) continue;
        const additionalRoom = await tx.orgUnit.findUnique({ where: { id: roomId } });
        if (!additionalRoom || additionalRoom.type !== "KAMAR" || additionalRoom.domain !== "KEASRAMAAN" || !additionalRoom.isActive) {
          throw new Error(`Additional KEASRAMAAN KAMAR with ID ${roomId} not found or inactive.`);
        }
      }

      // 2. Verify selected Mudhabbir candidate identity: must be PERSONAL, User AKTIF, Staff AKTIF
      // Never infer Mudhabbir from username, role, Halaqoh, or name.
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

      // 4. Deterministically close previous active Mudhabbir assignment for ALL target rooms
      const previousAssignments = await tx.assignment.findMany({
        where: {
          unitId: targetRoomIds.length === 1 ? targetRoomIds[0] : { in: targetRoomIds },
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

      // 5. Create new canonical Assignment with multi-kamar scoping via AssignmentScopeUnit
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
          scopedUnits: {
            create: targetRoomIds.map((uId) => ({ unitId: uId })),
          },
        },
        include: {
          scopedUnits: {
            include: { unit: true },
          },
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

        // Gender boundary validation: Kamar must be strictly PUTRA or PUTRI (no CAMPUR for dorms)
        if (kamar.genderComplex !== "PUTRA" && kamar.genderComplex !== "PUTRI") {
          throw new Error(
            `Kamar genderComplex invalid: Kamar ${kamar.name} has genderComplex ${kamar.genderComplex}. Active dorm rooms strictly require PUTRA or PUTRI.`
          );
        }
        const santriGender = santri.jenisKelamin === "L" ? "PUTRA" : santri.jenisKelamin === "P" ? "PUTRI" : "CAMPUR";
        if (santriGender !== kamar.genderComplex) {
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

      // 3. Gender boundary validation: Kamar must be strictly PUTRA or PUTRI (no CAMPUR for dorms)
      if (targetKamar.genderComplex !== "PUTRA" && targetKamar.genderComplex !== "PUTRI") {
        throw new Error(
          `Kamar genderComplex invalid: Target Kamar ${targetKamar.name} has genderComplex ${targetKamar.genderComplex}. Active dorm rooms strictly require PUTRA or PUTRI.`
        );
      }
      const santriGender = santri.jenisKelamin === "L" ? "PUTRA" : santri.jenisKelamin === "P" ? "PUTRI" : "CAMPUR";
      if (santriGender !== targetKamar.genderComplex) {
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
            scopedUnits: {
              include: { unit: true },
            },
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

/**
 * 7. Validate Usroh Hierarchy (ORR-091)
 * Enforces structural invariants:
 * - type = USROH
 * - domain = KEASRAMAAN
 * - parent = OSDA (OU-OSDA-ROOT)
 * - MUST NOT use Divisi Kebersihan as structural parent
 */
export function validateUsrohHierarchy(params: {
  type: string;
  domain: string;
  parentOrgUnit: {
    id: string;
    code: string;
    name: string;
    type: string;
    domain: string;
    isActive: boolean;
  };
}): ValidateUsrohHierarchyResult {
  if (params.type !== "USROH") {
    return {
      valid: false,
      code: "INVALID_ORG_UNIT_TYPE",
      reason: `Usroh OrgUnit must have type USROH (found: ${params.type}).`,
    };
  }

  if (params.domain !== "KEASRAMAAN") {
    return {
      valid: false,
      code: "INVALID_ORG_DOMAIN",
      reason: `Usroh OrgUnit must belong to domain KEASRAMAAN (found: ${params.domain}).`,
    };
  }

  if (!params.parentOrgUnit || !params.parentOrgUnit.isActive) {
    return {
      valid: false,
      code: "PARENT_NOT_FOUND_OR_INACTIVE",
      reason: "Parent OrgUnit not found or inactive.",
    };
  }

  // Reject KAMAR as structural parent
  if (params.parentOrgUnit.type === "KAMAR") {
    return {
      valid: false,
      code: "FORBIDDEN_PARENT_KAMAR",
      reason: "STRUCTURAL VIOLATION: Usroh must NOT use KAMAR as structural parent. Usroh must be parented under OU-OSDA-ROOT.",
    };
  }

  // Reject Divisi Kebersihan as structural parent
  const parentCodeUpper = (params.parentOrgUnit.code || "").toUpperCase();
  const parentNameUpper = (params.parentOrgUnit.name || "").toUpperCase();
  if (
    parentCodeUpper.includes("KEBERSIHAN") ||
    parentNameUpper.includes("KEBERSIHAN")
  ) {
    return {
      valid: false,
      code: "FORBIDDEN_PARENT_DIVISI_KEBERSIHAN",
      reason: "STRUCTURAL VIOLATION: Usroh must NOT use Divisi Kebersihan as structural parent.",
    };
  }

  // Must have parent OSDA
  const isOsdaParent =
    parentCodeUpper === "OU-OSDA-ROOT" ||
    (params.parentOrgUnit.type === "ORGANIZATION" &&
      params.parentOrgUnit.domain === "KEASRAMAAN" &&
      parentNameUpper.includes("OSDA"));

  if (!isOsdaParent) {
    return {
      valid: false,
      code: "INVALID_USROH_PARENT",
      reason: `Usroh must have OSDA (OU-OSDA-ROOT) as structural parent (found parent: ${params.parentOrgUnit.code}).`,
    };
  }

  return { valid: true };
}

/**
 * 8. Create Usroh OrgUnit (ORR-091)
 */
export async function createUsrohOrgUnit(params: CreateUsrohParams): Promise<KamarOperationResult> {
  const prisma = params.prismaClient || defaultPrisma;
  const dataProvider = params.dataProvider || createPrismaDataProvider(prisma as PrismaClient);

  // Authorization check (Mudir or authorized Keasramaan)
  const authCheck = await authorizeKamarManage(
    params.callerIdentity,
    params.executorContext,
    undefined,
    dataProvider
  );
  if (!authCheck.allowed) {
    return { success: false, code: authCheck.code, reason: authCheck.reason };
  }

  if (!params.code || !params.code.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Usroh code is required." };
  }
  if (!params.name || !params.name.trim()) {
    return { success: false, code: "INVALID_ARGUMENT", reason: "Usroh name is required (unnamed Usroh strictly prohibited)." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const parent = await tx.orgUnit.findUnique({ where: { id: params.parentId } });
      if (!parent) {
        throw new Error(`Parent OrgUnit with ID ${params.parentId} not found.`);
      }

      const validation = validateUsrohHierarchy({
        type: "USROH",
        domain: "KEASRAMAAN",
        parentOrgUnit: parent,
      });

      if (!validation.valid) {
        throw new Error(validation.reason || "Usroh hierarchy validation failed.");
      }

      const existingCode = await tx.orgUnit.findUnique({ where: { code: params.code.trim() } });
      if (existingCode) {
        throw new Error(`OrgUnit with code ${params.code.trim()} already exists.`);
      }

      const usroh = await tx.orgUnit.create({
        data: {
          code: params.code.trim(),
          name: params.name.trim(),
          type: "USROH",
          domain: "KEASRAMAAN",
          genderComplex: params.genderComplex || "CAMPUR",
          parentId: parent.id,
          isActive: true,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        },
      });

      await tx.canonicalAuditLog.create({
        data: {
          technicalAccountId: params.callerIdentity.userId,
          technicalAccountUsername: params.callerIdentity.username,
          humanExecutorId: authCheck.auth.verifiedExecutor?.userId || null,
          humanExecutorName: authCheck.auth.verifiedExecutor?.name || null,
          action: "USROH_CREATE",
          entity: "OrgUnit",
          entityId: usroh.id,
          capabilityCode: authCheck.provenance.capabilityCode,
          assignmentId: authCheck.provenance.assignmentId,
          positionCode: authCheck.provenance.positionCode,
          scopeType: authCheck.provenance.scopeType,
          unitId: usroh.id,
          afterState: JSON.parse(JSON.stringify(usroh)),
        },
      });

      return {
        success: true,
        data: usroh,
      };
    });
  } catch (err) {
    return {
      success: false,
      code: "SYSTEM_FAIL_CLOSED",
      reason: `Failed to create Usroh: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
