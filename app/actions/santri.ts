"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { SantriStatus, JenisKelamin, Prisma } from "@prisma/client";

export interface CreateSantriInput {
  nis: string;
  nama: string;
  kelas: string;
  jenisKelamin: JenisKelamin;
  isYatimDhuafa?: boolean;
  namaWali?: string;
  noHpWali?: string;
  halaqohId?: string;
}

/**
 * Mengambil daftar santri dengan filter pencarian dan relasi halaqoh
 * Dilengkapi otorisasi sesi dan pembatasan cakupan data (ABAC):
 * - Wali / Santri hanya melihat data diri/anak yang sah
 * - MT / PH hanya melihat santri dalam halaqoh binaannya
 * - Admin / Mudir / Manajemen memiliki akses penuh
 */
export async function getSantriListAction(params?: {
  search?: string;
  kelas?: string;
  halaqohId?: string;
}) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return { success: false, message: "Sesi tidak valid atau belum login.", data: [] };
    }

    const where: Prisma.SantriWhereInput = {};

    // Scoping berdasarkan Role
    if (session.role === "WS" || session.role === "ST") {
      if (!session.santriId) {
        return {
          success: false,
          message: "Akun Anda belum terhubung dengan data santri resmi. Silakan hubungi admin.",
          data: [],
        };
      }
      where.id = session.santriId;
    } else if (session.role === "MT" || session.role === "PH") {
      if (session.staffId) {
        const halaqohDibina = await prisma.halaqoh.findMany({
          where: { pembinaId: session.staffId },
          select: { id: true },
        });
        const halaqohIds = halaqohDibina.map((h) => h.id);
        if (params?.halaqohId && halaqohIds.includes(params.halaqohId)) {
          where.halaqohId = params.halaqohId;
        } else if (halaqohIds.length > 0) {
          where.halaqohId = { in: halaqohIds };
        } else {
          return { success: true, data: [] };
        }
      } else {
        return { success: true, data: [] };
      }
    } else {
      if (params?.halaqohId) {
        where.halaqohId = params.halaqohId;
      }
    }

    if (params?.search) {
      where.OR = [
        { nama: { contains: params.search, mode: "insensitive" } },
        { nis: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params?.kelas) {
      where.kelas = params.kelas;
    }

    const list = await prisma.santri.findMany({
      where,
      orderBy: { nis: "asc" },
      include: {
        halaqoh: {
          include: { pembina: true },
        },
        _count: {
          select: { setoranList: true },
        },
      },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil data santri:", error);
    return { success: false, message: "Gagal mengambil data santri.", data: [] };
  }
}

/**
 * Tambah Santri Baru (Khusus ADM & KS)
 */
export async function createSantriAction(input: CreateSantriInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  if (session.role !== "ADM" && session.role !== "KS") {
    return { success: false, message: "Hanya Admin (ADM) dan Mudir (KS) yang dapat mendaftarkan santri." };
  }

  try {
    // Cek duplikasi NIS
    const existing = await prisma.santri.findUnique({
      where: { nis: input.nis.trim() },
    });

    if (existing) {
      return { success: false, message: `NIS ${input.nis} sudah terdaftar di sistem.` };
    }

    const newSantri = await prisma.santri.create({
      data: {
        nis: input.nis.trim(),
        nama: input.nama.trim(),
        kelas: input.kelas.trim(),
        jenisKelamin: input.jenisKelamin,
        isYatimDhuafa: Boolean(input.isYatimDhuafa),
        namaWali: input.namaWali?.trim(),
        noHpWali: input.noHpWali?.trim(),
        halaqohId: input.halaqohId || null,
        status: SantriStatus.AKTIF,
        createdBy: session.username,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "CREATE_SANTRI",
      entity: "Santri",
      entityId: newSantri.id,
      details: { nis: newSantri.nis, nama: newSantri.nama, kelas: newSantri.kelas },
    });

    return {
      success: true,
      message: `Santri ${newSantri.nama} (${newSantri.nis}) berhasil ditambahkan.`,
      data: newSantri,
    };
  } catch (error) {
    console.error("Gagal membuat santri:", error);
    return { success: false, message: "Gagal menyimpan santri ke database." };
  }
}
