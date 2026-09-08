"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { JenisSetoran, NilaiSetoran } from "@prisma/client";

export interface CreateSetoranInput {
  santriId: string;
  jenis: JenisSetoran;
  juz: number;
  surahMulai: string;
  ayatMulai: number;
  surahSelesai: string;
  ayatSelesai: number;
  nilai: NilaiSetoran;
  catatan?: string;
  jumlahHalaman?: number;
}

/**
 * Server Action: Input Setoran Baru (dengan validasi peran & kepemilikan data ABAC)
 */
export async function createSetoranAction(input: CreateSetoranInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // 1. Role validation: Hanya MT, PH, KS, dan ADM yang boleh input
  if (!["MT", "PH", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: `Role ${session.role} tidak memiliki izin input setoran.` };
  }

  try {
    // 2. Data Ownership ABAC: Jika MT atau PH, verifikasi bahwa santri memang berada di bawah halaqoh binaannya
    if (session.role === "MT" || session.role === "PH") {
      if (!session.staffId) {
        return { success: false, message: "Profil staf pembina Anda belum terhubung." };
      }

      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: input.santriId } },
        },
      });

      if (!isBinaan) {
        return {
          success: false,
          message: "Akses Ditolak: Anda hanya berwenang mencatat setoran santri di dalam halaqoh binaan Anda.",
        };
      }
    }

    // 3. Tentukan Musyrif penilai
    const musyrifStaff = session.staffId
      ? await prisma.staff.findUnique({ where: { id: session.staffId } })
      : await prisma.staff.findFirst({ where: { roleStaff: "MT" } });

    if (!musyrifStaff) {
      return { success: false, message: "Data pengampu/musyrif tidak ditemukan di sistem." };
    }

    // 4. Generate kode setoran unik (e.g. SET-000123)
    const count = await prisma.setoranTahfizh.count();
    const setoranCode = `SET-${String(count + 1).padStart(6, "0")}`;

    // 5. Simpan Setoran ke PostgreSQL
    const hlmPrefix = input.jumlahHalaman ? `[Hlm: ${input.jumlahHalaman}] ` : "";
    const finalCatatan = input.catatan
      ? `${hlmPrefix}${input.catatan}`.trim()
      : (hlmPrefix.trim() || null);

    const newSetoran = await prisma.setoranTahfizh.create({
      data: {
        setoranCode,
        santriId: input.santriId,
        musyrifId: musyrifStaff.id,
        tanggal: new Date(),
        jenis: input.jenis,
        juz: Number(input.juz),
        surahMulai: input.surahMulai,
        ayatMulai: Number(input.ayatMulai),
        surahSelesai: input.surahSelesai,
        ayatSelesai: Number(input.ayatSelesai),
        nilai: input.nilai,
        catatan: finalCatatan,
        createdBy: session.username,
      },
      include: {
        santri: true,
        musyrif: true,
      },
    });

    // 6. Catat Audit Log
    await recordAuditLog({
      userId: session.userId,
      action: "CREATE_SETORAN",
      entity: "SetoranTahfizh",
      entityId: newSetoran.id,
      details: {
        setoranCode,
        santriNis: newSetoran.santri.nis,
        juz: input.juz,
        surah: `${input.surahMulai}:${input.ayatMulai}-${input.surahSelesai}:${input.ayatSelesai}`,
        nilai: input.nilai,
      },
    });

    return {
      success: true,
      message: `Setoran ${newSetoran.santri.nama} (${newSetoran.setoranCode}) berhasil dicatat.`,
      data: newSetoran,
    };
  } catch (error) {
    console.error("Gagal menyimpan setoran:", error);
    return { success: false, message: "Gagal menyimpan setoran ke pangkalan data." };
  }
}

/**
 * Server Action: Mengambil riwayat setoran terbaru
 */
export async function getRecentSetoranAction(limit: number = 10) {
  try {
    const list = await prisma.setoranTahfizh.findMany({
      take: limit,
      orderBy: { tanggal: "desc" },
      include: {
        santri: {
          include: { halaqoh: true },
        },
        musyrif: true,
      },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil riwayat setoran:", error);
    return { success: false, data: [] };
  }
}

/**
 * Server Action: Mengambil data ringkasan progres santri
 */
export async function getSantriProgresAction(santriId: string) {
  try {
    const santri = await prisma.santri.findUnique({
      where: { id: santriId },
      include: {
        halaqoh: { include: { pembina: true } },
        setoranList: {
          orderBy: { tanggal: "desc" },
          take: 5,
        },
      },
    });

    if (!santri) return { success: false, message: "Santri tidak ditemukan" };

    const totalSetoran = await prisma.setoranTahfizh.count({
      where: { santriId },
    });

    return {
      success: true,
      data: {
        ...santri,
        totalSetoran,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil data progres santri:", error);
    return { success: false, message: "Gagal mengambil data progres" };
  }
}
