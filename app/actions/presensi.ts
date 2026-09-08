"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusAbsensi } from "@prisma/client";
import { batchPresensiSchema } from "@/lib/validations";
import { getTodayWITADateString, getWITADayRange, parseWITADate } from "@/lib/wita-date";

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
 * Dilengkapi pencegahan duplikasi (idempotent upsert), proteksi izin aktif,
 * dan kalkulasi tanggal operasional zona waktu WITA (Asia/Makassar).
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

  // ABAC Scoping: MT/PH hanya boleh mencatat santri di halaqoh binaannya saat kegiatan halaqoh
  if ((session.role === "MT" || session.role === "PH") && kegiatan.toLowerCase().includes("halaqoh")) {
    if (!session.staffId) {
      return { success: false, message: "Profil staf pembina Anda belum terhubung." };
    }
    const santriBinaan = await prisma.santri.findMany({
      where: {
        id: { in: items.map((i) => i.santriId) },
        halaqoh: { pembinaId: session.staffId },
      },
      select: { id: true },
    });
    if (santriBinaan.length !== items.length) {
      return {
        success: false,
        message: "Akses Ditolak: Anda hanya berwenang mencatat presensi santri di dalam halaqoh binaan Anda.",
      };
    }
  }

  const witaDateStr = input.tanggal || getTodayWITADateString();
  const { startOfDayUTC, endOfDayUTC } = getWITADayRange(witaDateStr);
  const tanggalDate = parseWITADate(witaDateStr);

  try {
    // 3. Ambil data izin aktif santri yang telah disetujui (A14: Mencegah santri izin menjadi ALFA)
    const santriIds = items.map((i) => i.santriId);
    const izinAktifList = await prisma.perizinanSantri.findMany({
      where: {
        santriId: { in: santriIds },
        status: "DISETUJUI",
        tanggalMulai: { lte: endOfDayUTC },
        tanggalSelesai: { gte: startOfDayUTC },
      },
    });
    const izinMap = new Map(izinAktifList.map((iz) => [iz.santriId, iz]));

    const counts = {
      HADIR: 0,
      MASBUK: 0,
      IZIN: 0,
      SAKIT: 0,
      ALFA: 0,
    };

    const recordsToCreate = items.map((item) => {
      let effectiveStatus = item.status;
      let catatanGabungan = item.catatan || "";

      // Aturan Bisnis A14: Santri dengan izin resmi disetujui tidak boleh dihitung ALFA
      if (izinMap.has(item.santriId) && (effectiveStatus === "ALFA" || effectiveStatus === "HADIR")) {
        const izin = izinMap.get(item.santriId)!;
        effectiveStatus = izin.jenis === "SAKIT" ? "SAKIT" : "IZIN";
        catatanGabungan = catatanGabungan
          ? `[Izin Resmi: ${izin.jenis} - ${izin.alasan}] ${catatanGabungan}`
          : `[Izin Resmi: ${izin.jenis} - ${izin.alasan}]`;
      }

      // Hitung counter
      if (effectiveStatus in counts) {
        counts[effectiveStatus as keyof typeof counts]++;
      }

      // Map ke Prisma enum: MASBUK disimpan sebagai HADIR dengan catatan [Masbuk]
      let prismaStatus: StatusAbsensi = StatusAbsensi.HADIR;

      if (effectiveStatus === "MASBUK") {
        prismaStatus = StatusAbsensi.HADIR;
        catatanGabungan = catatanGabungan
          ? `[Masbuk] ${catatanGabungan}`
          : "[Masbuk] Terlambat masuk shaf";
      } else if (effectiveStatus === "IZIN") {
        prismaStatus = StatusAbsensi.IZIN;
      } else if (effectiveStatus === "SAKIT") {
        prismaStatus = StatusAbsensi.SAKIT;
      } else if (effectiveStatus === "ALFA") {
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

    // 4. Atomic Transaction A13: Hapus rekaman presensi sebelumnya pada tanggal & sesi yang sama lalu simpan data baru
    await prisma.$transaction(async (tx) => {
      await tx.absensi.deleteMany({
        where: {
          santriId: { in: santriIds },
          kegiatan,
          tanggal: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });

      await tx.absensi.createMany({
        data: recordsToCreate,
      });
    });

    // Catat ke log audit
    await recordAuditLog({
      userId: session.userId,
      action: "PRESENSI_BATCH_SIMPAN",
      entity: "ABSENSI",
      details: {
        kegiatan,
        tanggalWITA: witaDateStr,
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
        tanggal: witaDateStr,
        total: items.length,
        counts,
      },
    };
  } catch (error) {
    console.error("Gagal menyimpan batch presensi ke database:", error);
    return {
      success: false,
      message: `Gagal menyimpan data presensi ke server. Silakan periksa koneksi database atau coba beberapa saat lagi.`,
      error: error instanceof Error ? error.message : "DATABASE_WRITE_ERROR",
    };
  }
}

/**
 * Server Action: Ambil Riwayat Presensi Hari Ini (Zona Waktu Asia/Makassar)
 */
export async function getRiwayatPresensiHarianAction(tanggalStr?: string, kegiatan?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir." };
  }

  try {
    const targetWitaStr = tanggalStr || getTodayWITADateString();
    const { startOfDayUTC, endOfDayUTC } = getWITADayRange(targetWitaStr);

    const isWaliOrSantri = session.role === "WS" || session.role === "ST";
    if (isWaliOrSantri && !session.santriId) {
      return { success: true, data: [] };
    }

    const records = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
        ...(kegiatan ? { kegiatan } : {}),
        ...(isWaliOrSantri ? { santriId: session.santriId! } : {}),
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
