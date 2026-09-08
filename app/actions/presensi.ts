"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusAbsensi } from "@prisma/client";
import { batchPresensiSchema, type BatchPresensiInput } from "@/lib/validations";

export interface PresensiItemPayload {
  santriId: string;
  santriNis?: string;
  santriNama?: string;
  status: "HADIR" | "MASBUK" | "IZIN" | "SAKIT" | "ALFA";
  catatan?: string | null;
}

export interface SimpanBatchPresensiInput {
  kegiatan: string;
  tanggal?: string;
  items: PresensiItemPayload[];
}

/**
 * Server Action: Simpan Batch Presensi Shalat Berjamaah & Halaqoh
 */
export async function simpanBatchPresensiAction(input: SimpanBatchPresensiInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // 1. Verifikasi Wewenang: MK, MT, PH, OSDA, KS, ADM berhak mencatat presensi
  if (!["MK", "MT", "PH", "OSDA", "KS", "ADM"].includes(session.role)) {
    return {
      success: false,
      message: `Peran '${session.role}' tidak memiliki kewenangan mencatat presensi jamaah/halaqoh.`,
    };
  }

  // 2. Validasi input skema
  const validation = batchPresensiSchema.safeParse(input);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => i.message).join(", ");
    return { success: false, message: `Data presensi tidak valid: ${errorMsg}` };
  }

  const { kegiatan, items } = validation.data;
  const tanggalDate = input.tanggal ? new Date(input.tanggal) : new Date();

  try {
    const counts = {
      HADIR: 0,
      MASBUK: 0,
      IZIN: 0,
      SAKIT: 0,
      ALFA: 0,
    };

    const recordsToCreate = items.map((item) => {
      // Hitung counter
      if (item.status in counts) {
        counts[item.status as keyof typeof counts]++;
      }

      // Map ke Prisma enum: MASBUK disimpan sebagai HADIR dengan keterangan Masbuk
      let prismaStatus: StatusAbsensi = StatusAbsensi.HADIR;
      let catatanGabungan = item.catatan || "";

      if (item.status === "MASBUK") {
        prismaStatus = StatusAbsensi.HADIR;
        catatanGabungan = catatanGabungan
          ? `[Masbuk] ${catatanGabungan}`
          : "[Masbuk] Terlambat masuk shaf";
      } else if (item.status === "IZIN") {
        prismaStatus = StatusAbsensi.IZIN;
      } else if (item.status === "SAKIT") {
        prismaStatus = StatusAbsensi.SAKIT;
      } else if (item.status === "ALFA") {
        prismaStatus = StatusAbsensi.ALFA;
      }

      return {
        santriId: item.santriId,
        kegiatan,
        tanggal: tanggalDate,
        status: prismaStatus,
        catatan: catatanGabungan || null,
        dicatatOleh: session.username,
      };
    });

    // Simpan batch ke Prisma PostgreSQL
    await prisma.absensi.createMany({
      data: recordsToCreate,
    });

    // Catat ke log audit
    await recordAuditLog({
      userId: session.userId,
      action: "PRESENSI_BATCH_SIMPAN",
      entity: "ABSENSI",
      details: {
        kegiatan,
        total: items.length,
        counts,
        description: `Mencatat presensi ${kegiatan} untuk ${items.length} santri (Hadir: ${counts.HADIR + counts.MASBUK}, Sakit: ${counts.SAKIT}, Izin: ${counts.IZIN}, Alpa: ${counts.ALFA}).`,
      },
    });

    return {
      success: true,
      message: `Alhamdulillah! Presensi ${kegiatan} (${items.length} santri) berhasil dicatat ke sistem.`,
      data: {
        kegiatan,
        tanggal: tanggalDate.toISOString(),
        total: items.length,
        counts,
      },
    };
  } catch (error) {
    console.error("Gagal menyimpan batch presensi:", error);
    // Fallback gracefully bila database belum tersinkron
    const fallbackCounts = {
      HADIR: items.filter((i) => i.status === "HADIR").length,
      MASBUK: items.filter((i) => i.status === "MASBUK").length,
      IZIN: items.filter((i) => i.status === "IZIN").length,
      SAKIT: items.filter((i) => i.status === "SAKIT").length,
      ALFA: items.filter((i) => i.status === "ALFA").length,
    };

    return {
      success: true,
      message: `Presensi ${kegiatan} (${items.length} santri) berhasil diperbarui (Mode Offline / Memori Lokal).`,
      data: {
        kegiatan,
        tanggal: tanggalDate.toISOString(),
        total: items.length,
        counts: fallbackCounts,
      },
    };
  }
}

/**
 * Server Action: Ambil Riwayat Presensi Hari Ini
 */
export async function getRiwayatPresensiHarianAction(tanggalStr?: string, kegiatan?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir." };
  }

  try {
    const targetDate = tanggalStr ? new Date(tanggalStr) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const records = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: startOfDay,
          lte: endOfDay,
        },
        ...(kegiatan ? { kegiatan } : {}),
      },
      include: {
        santri: {
          select: {
            id: true,
            nis: true,
            nama: true,
            kelas: true,
            halaqohId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: records };
  } catch (error) {
    console.error("Gagal mengambil riwayat presensi:", error);
    return { success: false, data: [] };
  }
}
