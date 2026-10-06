"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import {
  createKamar,
  updateKamar,
  setKamarActive,
  assignMudhabbir,
  assignSantri,
  moveSantri,
  inspectKamarConfiguration,
  validateUsrohHierarchy,
  createUsrohOrgUnit,
} from "@/lib/server/kamar-management-service";
import { GenderComplex } from "@/types/architecture-lock";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 1. Get List of Kamar with Mudhabbir and Placed Santri
 */
export async function getKamarListAction(): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await inspectKamarConfiguration({
      callerIdentity: session,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal memuat data kamar." };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Gagal mengambil data kamar:", error);
    return { success: false, message: "Terjadi kesalahan internal saat memuat data kamar." };
  }
}

/**
 * 2. Create Kamar OrgUnit (Mudir-only canonical authority)
 */
export async function createKamarAction(input: {
  code: string;
  name: string;
  genderComplex: GenderComplex;
  parentId?: string;
  notes?: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await createKamar({
      callerIdentity: session,
      code: input.code,
      name: input.name,
      genderComplex: input.genderComplex,
      parentId: input.parentId,
      metadata: input.notes ? { notes: input.notes } : undefined,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal membuat kamar baru." };
    }

    return { success: true, data: result.data, message: "Kamar berhasil dibuat." };
  } catch (error) {
    console.error("Gagal membuat kamar:", error);
    return { success: false, message: "Terjadi kesalahan internal saat membuat kamar." };
  }
}

/**
 * 3. Update Kamar (Edit name, code, genderComplex, or soft-disable)
 */
export async function updateKamarAction(input: {
  kamarId: string;
  name?: string;
  code?: string;
  genderComplex?: GenderComplex;
  isActive?: boolean;
  notes?: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await updateKamar({
      callerIdentity: session,
      kamarId: input.kamarId,
      name: input.name,
      code: input.code,
      genderComplex: input.genderComplex,
      isActive: input.isActive,
      notes: input.notes,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal memperbarui kamar." };
    }

    return { success: true, data: result.data, message: "Kamar berhasil diperbarui." };
  } catch (error) {
    console.error("Gagal memperbarui kamar:", error);
    return { success: false, message: "Terjadi kesalahan internal saat memperbarui kamar." };
  }
}

/**
 * 4. Soft-disable or re-activate Kamar
 */
export async function setKamarActiveAction(input: {
  kamarId: string;
  isActive: boolean;
  notes?: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await setKamarActive({
      callerIdentity: session,
      kamarId: input.kamarId,
      isActive: input.isActive,
      notes: input.notes,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal mengubah status kamar." };
    }

    return {
      success: true,
      data: result.data,
      message: `Kamar berhasil ${input.isActive ? "diaktifkan" : "dinonaktifkan (soft-disable)"}.`,
    };
  } catch (error) {
    console.error("Gagal mengubah status aktif kamar:", error);
    return { success: false, message: "Terjadi kesalahan internal saat mengubah status kamar." };
  }
}

/**
 * 5. Assign Mudhabbir (PEMBINA_HALAQOH) to Kamar
 * Supports multi-kamar scoping via AssignmentScopeUnit
 * Strictly personal staff account, never inferred.
 */
export async function assignMudhabbirAction(input: {
  kamarId: string;
  mudhabbirUserId: string;
  additionalKamarIds?: string[];
  notes?: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await assignMudhabbir({
      callerIdentity: session,
      kamarId: input.kamarId,
      mudhabbirUserId: input.mudhabbirUserId,
      additionalKamarIds: input.additionalKamarIds,
      notes: input.notes,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal menetapkan mudhabbir." };
    }

    return { success: true, data: result.data, message: "Mudhabbir kamar berhasil ditetapkan." };
  } catch (error) {
    console.error("Gagal menetapkan mudhabbir:", error);
    return { success: false, message: "Terjadi kesalahan internal saat menetapkan mudhabbir." };
  }
}

/**
 * 6. Assign Santri to Kamar
 */
export async function assignSantriToKamarAction(input: {
  kamarId: string;
  santriIds: string[];
  notes?: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await assignSantri({
      callerIdentity: session,
      kamarId: input.kamarId,
      santriIds: input.santriIds,
      notes: input.notes,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal menempatkan santri ke kamar." };
    }

    return { success: true, data: result.data, message: "Santri berhasil ditempatkan ke kamar." };
  } catch (error) {
    console.error("Gagal menempatkan santri ke kamar:", error);
    return { success: false, message: "Terjadi kesalahan internal saat menempatkan santri." };
  }
}

/**
 * 7. Transfer Santri to another Kamar (closes old placement, preserves history)
 */
export async function transferSantriKamarAction(input: {
  santriId: string;
  targetKamarId: string;
  notes?: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await moveSantri({
      callerIdentity: session,
      santriId: input.santriId,
      targetKamarId: input.targetKamarId,
      notes: input.notes,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal memindahkan santri." };
    }

    return { success: true, data: result.data, message: "Santri berhasil dipindahkan ke kamar baru." };
  } catch (error) {
    console.error("Gagal memindahkan santri:", error);
    return { success: false, message: "Terjadi kesalahan internal saat memindahkan santri." };
  }
}

/**
 * 8. Get Candidates for Mudhabbir
 * Strictly active PERSONAL accounts linked to active Staff
 */
export async function getAvailableMudhabbirListAction(): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        accountType: "PERSONAL",
        status: "AKTIF",
        staff: {
          status: "AKTIF",
        },
      },
      select: {
        id: true,
        username: true,
        staff: {
          select: {
            id: true,
            nama: true,
            staffCode: true,
            status: true,
          },
        },
      },
      orderBy: { username: "asc" },
    });

    return { success: true, data: users };
  } catch (error) {
    console.error("Gagal mengambil daftar kandidat mudhabbir:", error);
    return { success: false, message: "Gagal memuat data staf." };
  }
}

/**
 * 9. Get Active Santri for Placement
 */
export async function getActiveSantriForPlacementAction(): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const santriList = await prisma.santri.findMany({
      where: {
        status: "AKTIF",
      },
      select: {
        id: true,
        nis: true,
        nama: true,
        kelas: true,
        jenisKelamin: true,
        kamarPlacements: {
          where: { isActive: true },
          select: {
            id: true,
            kamarId: true,
            kamar: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { nama: "asc" },
    });

    return { success: true, data: santriList };
  } catch (error) {
    console.error("Gagal memuat santri untuk penempatan kamar:", error);
    return { success: false, message: "Gagal memuat data santri." };
  }
}

/**
 * 10. Validate Usroh Hierarchy (ORR-091)
 */
export async function validateUsrohHierarchyAction(input: {
  parentId: string;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const parent = await prisma.orgUnit.findUnique({
      where: { id: input.parentId },
    });

    if (!parent) {
      return { success: false, message: "Parent OrgUnit tidak ditemukan." };
    }

    const validation = validateUsrohHierarchy({
      type: "USROH",
      domain: "KEASRAMAAN",
      parentOrgUnit: parent,
    });

    return {
      success: validation.valid,
      message: validation.valid ? "Struktur Usroh valid." : validation.reason,
      data: validation,
    };
  } catch (error) {
    console.error("Gagal validasi hierarki Usroh:", error);
    return { success: false, message: "Gagal memvalidasi hierarki Usroh." };
  }
}

/**
 * 11. Create Usroh OrgUnit (ORR-091)
 */
export async function createUsrohAction(input: {
  code: string;
  name: string;
  parentId: string;
  genderComplex?: GenderComplex;
  metadata?: Record<string, unknown>;
}): Promise<ActionResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  try {
    const result = await createUsrohOrgUnit({
      callerIdentity: session,
      code: input.code,
      name: input.name,
      parentId: input.parentId,
      genderComplex: input.genderComplex,
      metadata: input.metadata,
      prismaClient: prisma,
    });

    if (!result.success) {
      return { success: false, message: result.reason || "Gagal membuat Usroh." };
    }

    return { success: true, data: result.data, message: "Usroh berhasil dibuat." };
  } catch (error) {
    console.error("Gagal membuat Usroh:", error);
    return { success: false, message: "Terjadi kesalahan internal saat membuat Usroh." };
  }
}
