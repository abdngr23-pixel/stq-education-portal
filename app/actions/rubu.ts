"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  deriveOverallNilai,
  mistakeCountsSchema,
  DEFAULT_MISTAKE_COUNTS,
} from "@/lib/tahfizh-quality";
import { evaluasiRubuSchema, EvaluasiRubuInput } from "@/lib/validations";

/**
 * Server Action: Input Evaluasi Rubu' Tahfizh Baru
 * Sesuai Business Contract PR #8:
 * - Rubu' adalah entitas milestone terpisah, BUKAN jenis setoran harian
 * - Juz 1-30, Rubu 1-4
 * - Nilai keseluruhan diturunkan (derived) dari dimensi terendah: Tajwid, Fashahah, Kelancaran
 * - Tidak menarik kesimpulan LULUS/GAGAL/boleh Tasmi' secara otomatis
 * - Multiple attempts diizinkan (tidak ada batasan unik santri-juz-rubu)
 * - ABAC fail-closed: MT hanya untuk halaqoh binaan, Kabid/Mudir global internal, Wali ditolak
 */
export async function createEvaluasiRubuAction(input: EvaluasiRubuInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // 1. Internal Tahfizh Only Guard: Wali dan Santri dilarang mengakses evaluasi Rubu' internal
  if (session.role === "WS" || session.role === "ST") {
    return {
      success: false,
      message: "Akses Ditolak: Evaluasi Rubu' hanya dapat diakses oleh staf internal Tahfizh.",
    };
  }

  // Canonical minimum allowed roles: MT (Musyrif Tahfizh) and KS (Mudir Pesantren)
  const ALLOWED_ROLES = ["MT", "KS"];
  if (!ALLOWED_ROLES.includes(session.role)) {
    return {
      success: false,
      message: `Akses Ditolak: Role ${session.role} tidak memiliki wewenang evaluasi kualitas Rubu'.`,
    };
  }

  // 2. Skema Validasi Input
  const parsed = evaluasiRubuSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, message: `Validasi gagal: ${errorMsg}` };
  }

  const data = parsed.data;

  // 3. Validasi Keberadaan Santri
  const santri = await prisma.santri.findUnique({
    where: { id: data.santriId },
    select: { id: true, nama: true, halaqohId: true },
  });

  if (!santri) {
    return { success: false, message: "Data santri tidak ditemukan di pangkalan data." };
  }

  // 4. ABAC Guard: MT dibatasi ke halaqoh binaan, Kabid Tahfizh & Mudir KS memiliki wewenang manajerial
  const isManagerial = Boolean(session.isKepalaBidangTahfidz || session.role === "KS");

  if (!isManagerial) {
    // Ordinary MT: fail-closed jika staffId tidak terhubung
    if (!session.staffId) {
      return {
        success: false,
        message: "Akses Ditolak: Profil staf pembina Anda belum terhubung. Hubungi Administrator.",
      };
    }

    const isBinaan = await prisma.halaqoh.findFirst({
      where: {
        pembinaId: session.staffId,
        santriList: { some: { id: data.santriId } },
      },
    });

    if (!isBinaan) {
      return {
        success: false,
        message: "Akses Ditolak: Anda hanya berwenang mencatat evaluasi Rubu' santri di dalam halaqoh binaan Anda.",
      };
    }
  }

  // 5. Staf Penguji (Fail-closed)
  let musyrifStaffId = session.staffId;
  if (!musyrifStaffId) {
    const userWithStaff = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { staffId: true },
    });
    musyrifStaffId = userWithStaff?.staffId || null;
  }

  if (!musyrifStaffId) {
    return {
      success: false,
      message: "Akses Ditolak: Akun Anda tidak memiliki relasi profil staf resmi untuk mencatat evaluasi.",
    };
  }

  const staffRecord = await prisma.staff.findUnique({ where: { id: musyrifStaffId } });
  if (!staffRecord) {
    return { success: false, message: "Data staf penguji tidak ditemukan di sistem." };
  }

  // 6. Validasi Taksonomi Kesalahan (8 Canonical Keys, Non-negative Integers)
  const mistakeValidation = mistakeCountsSchema.safeParse(
    data.rincianKesalahan || DEFAULT_MISTAKE_COUNTS
  );
  if (!mistakeValidation.success) {
    return {
      success: false,
      message: "Rincian kesalahan tidak valid. Harus memuat 8 kategori resmi dengan nilai bilangan bulat >= 0.",
    };
  }

  // 7. Penurunan Predikat Keseluruhan (Lowest of the Three Dimensions)
  const derivedNilai = deriveOverallNilai({
    tajwid: data.nilaiTajwid,
    fashahah: data.nilaiFashahah,
    kelancaran: data.nilaiKelancaran,
  });

  const parsedTanggal = data.tanggal ? new Date(data.tanggal) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const evaluasi = await tx.evaluasiRubuTahfizh.create({
        data: {
          santriId: data.santriId,
          musyrifId: musyrifStaffId as string,
          tanggal: parsedTanggal,
          juz: data.juz,
          rubuKe: data.rubuKe,
          nilaiTajwid: data.nilaiTajwid,
          nilaiFashahah: data.nilaiFashahah,
          nilaiKelancaran: data.nilaiKelancaran,
          nilai: derivedNilai,
          rincianKesalahan: (data.rincianKesalahan || DEFAULT_MISTAKE_COUNTS) as unknown as Prisma.InputJsonValue,
          catatan: data.catatan?.trim() || null,
          createdBy: session.userId,
        },
        include: {
          santri: { select: { id: true, nama: true, nis: true } },
          musyrif: { select: { id: true, nama: true } },
        },
      });

      // Audit Log dengan structured snapshot (tanpa data PII berlebih)
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CREATE_EVALUASI_RUBU",
          entity: "EvaluasiRubuTahfizh",
          entityId: evaluasi.id,
          details: {
            evaluasiRubuId: evaluasi.id,
            santriId: evaluasi.santriId,
            musyrifId: evaluasi.musyrifId,
            juz: evaluasi.juz,
            rubuKe: evaluasi.rubuKe,
            nilaiTajwid: evaluasi.nilaiTajwid,
            nilaiFashahah: evaluasi.nilaiFashahah,
            nilaiKelancaran: evaluasi.nilaiKelancaran,
            nilai: evaluasi.nilai,
            rincianKesalahan: evaluasi.rincianKesalahan,
            hasCatatan: Boolean(evaluasi.catatan),
          },
        },
      });

      return evaluasi;
    });

    return {
      success: true,
      message: `Evaluasi Rubu' Juz ${result.juz} Rubu ${result.rubuKe} santri ${result.santri.nama} berhasil dicatat dengan predikat ${result.nilai}.`,
      data: result,
    };
  } catch (error) {
    console.error("Gagal menyimpan evaluasi Rubu':", error);
    return {
      success: false,
      message: "Terjadi kesalahan sistem saat menyimpan evaluasi Rubu'. Silakan coba lagi.",
    };
  }
}

/**
 * Server Action: Mengambil Daftar Evaluasi Rubu' dengan ABAC Scoping
 */
export async function getEvaluasiRubuListAction(params?: {
  santriId?: string;
  halaqohId?: string;
  juz?: number;
  limit?: number;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir.", data: [] };
  }

  // Wali dan Santri dilarang mengakses data internal evaluasi Rubu'
  if (session.role === "WS" || session.role === "ST") {
    return {
      success: false,
      message: "Akses Ditolak: Evaluasi Rubu' hanya dapat diakses oleh staf internal Tahfizh.",
      data: [],
    };
  }

  // Canonical minimum allowed roles: MT and KS
  const ALLOWED_ROLES = ["MT", "KS"];
  if (!ALLOWED_ROLES.includes(session.role)) {
    return {
      success: false,
      message: `Akses Ditolak: Role ${session.role} tidak memiliki wewenang evaluasi kualitas Rubu'.`,
      data: [],
    };
  }

  const isManagerial = Boolean(session.isKepalaBidangTahfidz || session.role === "KS");

  const whereClause: Prisma.EvaluasiRubuTahfizhWhereInput = {};

  if (!isManagerial) {
    // Ordinary MT: fail-closed jika staffId tidak terhubung
    if (!session.staffId) {
      return {
        success: false,
        message: "Akses Ditolak: Profil staf pembina Anda belum terhubung.",
        data: [],
      };
    }

    if (params?.santriId) {
      // Periksa apakah santri yang diminta berada di halaqoh binaan MT
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: params.santriId } },
        },
      });
      if (!isBinaan) {
        return {
          success: false,
          message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda.",
          data: [],
        };
      }
      whereClause.santriId = params.santriId;
    } else if (params?.halaqohId) {
      // Periksa kepemilikan halaqoh
      const isOwnHalaqoh = await prisma.halaqoh.findFirst({
        where: { id: params.halaqohId, pembinaId: session.staffId },
      });
      if (!isOwnHalaqoh) {
        return {
          success: false,
          message: "Akses Ditolak: Halaqoh ini bukan binaan Anda.",
          data: [],
        };
      }
      whereClause.santri = { halaqohId: params.halaqohId };
    } else {
      // Otomatis batasi hanya santri di halaqoh binaan staf ini
      whereClause.santri = {
        halaqoh: { pembinaId: session.staffId },
      };
    }
  } else {
    // Managerial: filter jika parameter diberikan
    if (params?.santriId) {
      whereClause.santriId = params.santriId;
    }
    if (params?.halaqohId) {
      whereClause.santri = { halaqohId: params.halaqohId };
    }
  }

  if (params?.juz) {
    whereClause.juz = params.juz;
  }

  const limit = Math.min(Math.max(params?.limit || 50, 1), 100);

  try {
    const list = await prisma.evaluasiRubuTahfizh.findMany({
      where: whereClause,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        santri: {
          select: {
            id: true,
            nama: true,
            nis: true,
            kelas: true,
            halaqoh: { select: { id: true, nama: true } },
          },
        },
        musyrif: {
          select: { id: true, nama: true },
        },
      },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil daftar evaluasi Rubu':", error);
    return { success: false, message: "Gagal memuat data evaluasi Rubu'.", data: [] };
  }
}
