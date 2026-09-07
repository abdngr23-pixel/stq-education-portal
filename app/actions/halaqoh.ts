"use server";

import prisma from "@/lib/prisma";

export async function getHalaqohListAction() {
  try {
    const list = await prisma.halaqoh.findMany({
      orderBy: { nama: "asc" },
      include: {
        pembina: true,
        _count: {
          select: { santriList: true },
        },
      },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil data halaqoh:", error);
    return { success: false, data: [] };
  }
}
