"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { UserSession } from "@/types/auth";
import { StatusSP, KategoriBintang, TingkatPelanggaran, Prisma } from "@prisma/client";
import { hitungPoinPelanggaran } from "@/lib/educational-rules";

export interface CatatPelanggaranData {
  santriId: string;
  kategoriId: string;
  kronologi: string;
}

/**
 * Server Action: Mencatat Pelanggaran Baru
 * Memuat Engine Logika Bisnis:
 * 1. Deteksi Pengulangan otomatis (jika pernah melanggar kategori sama -> poin x2)
 * 2. Akumulasi Poin Pelanggaran
 * 3. Penerbitan otomatis Surat Peringatan (SP 1 >= 20, SP 2 >= 40, SP 3 >= 60)
 */
export async function catatPelanggaranAction(input: CatatPelanggaranData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Hak akses: Pembina (PH), Musyrif Keasramaan (MK), Musyrif Tahfizh (MT), Mudir (KS)
  if (!["PH", "MK", "MT", "KS"].includes(session.role)) {
    return {
      success: false,
      message: `Role ${session.role} tidak memiliki kewenangan mencatat pelanggaran santri.`,
    };
  }

  try {
    const kategori = await prisma.kategoriPelanggaran.findUnique({
      where: { id: input.kategoriId },
    });

    if (!kategori) {
      return { success: false, message: "Kategori pelanggaran tidak valid." };
    }

    // 1. Cek apakah ada pengulangan kategori yang sama untuk santri ini
    const existingCount = await prisma.pelanggaranSantri.count({
      where: {
        santriId: input.santriId,
        kategoriId: input.kategoriId,
      },
    });

    const isPengulangan = existingCount > 0;
    // Aturan Bisnis: jika berulang, poin dikalikan dua sesuai educational-rules
    const poinDasarVal = kategori.poinDasar ?? 0;
    const poinFinal = hitungPoinPelanggaran(poinDasarVal, isPengulangan);

    const sanksiSnapshot =
      kategori.sanksi ||
      (poinFinal > 0 ? `${poinFinal} Poin` : "Hukuman Langsung / Pembinaan");

    // Pencatat staff (Fail-Closed, tanpa fallback staf sembarangan)
    let pencatatStaffId = session.staffId;
    if (!pencatatStaffId) {
      const userWithStaff = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { staffId: true },
      });
      pencatatStaffId = userWithStaff?.staffId || null;
    }

    if (!pencatatStaffId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun Anda tidak memiliki relasi staf pencatat resmi di pangkalan data.",
      };
    }

    const pencatatStaff = await prisma.staff.findUnique({ where: { id: pencatatStaffId } });
    if (!pencatatStaff) {
      return { success: false, message: "Data profil staf pencatat tidak ditemukan." };
    }

    const timePart = Date.now().toString(36).toUpperCase();
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const kodePelanggaran = `PLG-${timePart}-${randPart}`;

    // Simpan pelanggaran dengan snapshot identitas
    const newPelanggaran = await prisma.pelanggaranSantri.create({
      data: {
        kodePelanggaran,
        santriId: input.santriId,
        kategoriId: input.kategoriId,
        namaPelanggaranSnapshot: kategori.nama,
        kategoriSnapshot: kategori.tingkat,
        sanksiSnapshot: sanksiSnapshot,
        poinFinal,
        isPengulangan,
        kronologi: input.kronologi,
        pencatatId: pencatatStaff.id,
      },
      include: {
        santri: true,
        kategori: true,
      },
    });

    // 2. Hitung total akumulasi poin aktif santri
    const allPelanggaran = await prisma.pelanggaranSantri.findMany({
      where: { santriId: input.santriId },
    });
    const totalPoin = allPelanggaran.reduce((acc, curr) => acc + curr.poinFinal, 0);

    let spNotice = "";
    // Evaluasi SP HANYA untuk Kategori 3
    // Aturan: Kategori 1 (hukuman langsung) dan Kategori 2 (pemberian point) TIDAK BOLEH memicu SP!
    const isKategori3 =
      kategori.tingkat === TingkatPelanggaran.KATEGORI_3 ||
      kategori.tingkat === TingkatPelanggaran.BERAT;

    if (isKategori3) {
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);

      // Ambil seluruh pelanggaran Kategori 3 yang pernah dilakukan santri ini
      const historicalKat3 = await prisma.pelanggaranSantri.findMany({
        where: {
          santriId: input.santriId,
          kategori: {
            tingkat: { in: [TingkatPelanggaran.KATEGORI_3, TingkatPelanggaran.BERAT] },
          },
          id: { not: newPelanggaran.id },
        },
        select: { id: true, kategoriId: true, createdAt: true },
      });

      // Filter berdasarkan aturan pemutihan:
      // - Pelanggaran sejenis (kategoriId sama): masa aktif 3 tahun
      // - Pelanggaran umum (kategoriId beda): masa aktif 1 tahun
      const activePriorKat3 = historicalKat3.filter((p) => {
        if (p.kategoriId === input.kategoriId) {
          return p.createdAt >= threeYearsAgo;
        } else {
          return p.createdAt >= oneYearAgo;
        }
      });

      // Total Kategori 3 aktif termasuk yang baru dicatat
      const totalActiveKat3 = activePriorKat3.length + 1;
      const spLevel = Math.min(totalActiveKat3, 3); // SP 1, 2, atau 3

      // Cek apakah SP tingkat ini sudah diterbitkan
      const existingSP = await prisma.suratPeringatan.findFirst({
        where: {
          santriId: input.santriId,
          tingkatSP: spLevel,
          status: StatusSP.AKTIF,
        },
      });

      if (!existingSP) {
        const spCount = await prisma.suratPeringatan.count();
        const nomorSP = `00${spCount + 1}/SP-${spLevel}/DUC/${new Date().getFullYear()}`;

        await prisma.suratPeringatan.create({
          data: {
            nomorSP,
            santriId: input.santriId,
            tingkatSP: spLevel,
            totalPoinSaatTerbit: totalPoin,
            status: StatusSP.AKTIF,
          },
        });
        spNotice = ` PERINGATAN: Pelanggaran Kategori 3 ke-${totalActiveKat3}! ${nomorSP} (SP ${spLevel}) otomatis diterbitkan.`;
      }
    }

    // Catat audit trail
    await recordAuditLog({
      userId: session.userId,
      action: "CATAT_PELANGGARAN",
      entity: "PelanggaranSantri",
      entityId: newPelanggaran.id,
      details: {
        kodePelanggaran,
        santriNis: newPelanggaran.santri.nis,
        kategori: kategori.nama,
        poinDasar: kategori.poinDasar,
        poinFinal,
        isPengulangan,
        totalPoinSaatIni: totalPoin,
      },
    });

    const pengulanganText = isPengulangan ? " (Terdeteksi Pengulangan: Poin x2)" : "";

    return {
      success: true,
      message: `Pelanggaran ${newPelanggaran.santri.nama} (${kategori.nama}) berhasil dicatat. Poin sanksi: ${poinFinal}${pengulanganText}.${spNotice}`,
      data: newPelanggaran,
      totalPoin,
    };
  } catch (error) {
    console.error("Gagal mencatat pelanggaran:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses pelanggaran." };
  }
}

/**
 * Server Action: Pemutihan Surat Peringatan (Khusus Kepala Sekolah / Mudir KS)
 */
export async function putihkanSPAction(params: { spId: string; keterangan: string }) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Hanya Kepala Sekolah/Mudir (KS) yang memiliki otoritas memutihkan SP
  if (session.role !== "KS") {
    return {
      success: false,
      message: "Hanya Kepala Sekolah/Mudir (KS) yang berwenang melakukan pemutihan Surat Peringatan.",
    };
  }

  try {
    const sp = await prisma.suratPeringatan.update({
      where: { id: params.spId },
      data: {
        status: StatusSP.DIPUTIHKAN,
        keteranganPemutihan: params.keterangan,
        tanggalPemutihan: new Date(),
      },
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "PEMUTIHAN_SP",
      entity: "SuratPeringatan",
      entityId: sp.id,
      details: {
        nomorSP: sp.nomorSP,
        santri: sp.santri.nama,
        keterangan: params.keterangan,
        diputihkanOleh: session.username,
      },
    });

    return {
      success: true,
      message: `${sp.nomorSP} atas nama ${sp.santri.nama} telah resmi diputihkan oleh Mudir.`,
      data: sp,
    };
  } catch (error) {
    console.error("Gagal memutihkan SP:", error);
    return { success: false, message: "Gagal memproses pemutihan SP." };
  }
}

/**
 * Server Action: Menganugerahkan Bintang Santri Teladan
 */
export async function anugerahkanBintangAction(params: {
  santriId: string;
  periode: string;
  kategori: KategoriBintang;
  prestasi: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  if (session.role !== "KS" && session.role !== "ADM") {
    return { success: false, message: "Hanya Mudir (KS) dan Admin (ADM) yang dapat mencatat penganugerahan bintang." };
  }

  try {
    const bintang = await prisma.bintangSantri.create({
      data: {
        santriId: params.santriId,
        periode: params.periode,
        kategori: params.kategori,
        prestasi: params.prestasi,
      },
      include: { santri: true },
    });

    return {
      success: true,
      message: `Bintang penghargaan kategori ${params.kategori} berhasil dianugerahkan kepada ${bintang.santri.nama}.`,
      data: bintang,
    };
  } catch (error) {
    console.error("Gagal menganugerahkan bintang:", error);
    return { success: false, message: "Gagal menyimpan data bintang santri." };
  }
}

/**
 * Server Action: Mengambil data kategori pelanggaran yang tersedia
 */
export async function getKategoriPelanggaranListAction() {
  try {
    const list = await prisma.kategoriPelanggaran.findMany({
      orderBy: { kode: "asc" },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil kategori:", error);
    return { success: false, data: [] };
  }
}

/**
 * Resolusi Lingkup Otorisasi & Filter Data Kedisiplinan (Pelanggaran & SP)
 * Sesuai Tata Kelola Sementara: IDENTITY + ROLE + ASSIGNMENT + DOMAIN + SCOPE = PERMISSION
 */
async function resolveKedisiplinanScope(
  session: UserSession,
  requestedSantriId?: string
): Promise<
  | { authorized: true; santriId?: string; santriWhere?: Prisma.SantriWhereInput }
  | { authorized: false; message: string }
> {
  // 1. Wali Santri & Santri: Hanya dapat membaca data santri binaan/pribadi
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId) {
      return { authorized: false, message: "Akses Ditolak: Akun belum terhubung dengan data santri." };
    }
    if (requestedSantriId && requestedSantriId !== session.santriId) {
      return { authorized: false, message: "Akses Ditolak: Anda tidak memiliki akses ke data santri lain." };
    }
    return { authorized: true, santriId: session.santriId };
  }

  // 2. Musyrif Tahfizh & Pembina Halaqoh: Memerlukan profil staf aktif
  if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { authorized: false, message: "Akses Ditolak: Profil staf pembina Anda belum terhubung." };
    }
    // Kepala Bidang Tahfidz memiliki akses manajerial menyeluruh
    if (session.isKepalaBidangTahfidz) {
      if (requestedSantriId) {
        return { authorized: true, santriId: requestedSantriId };
      }
      return { authorized: true };
    }
    // Staf biasa: hanya santri dalam halaqoh yang dipimpinnya
    if (requestedSantriId) {
      const santri = await prisma.santri.findUnique({
        where: { id: requestedSantriId },
        select: { id: true, halaqoh: { select: { pembinaId: true } } },
      });
      if (!santri || santri.halaqoh?.pembinaId !== session.staffId) {
        return {
          authorized: false,
          message: "Akses Ditolak: Santri berada di luar halaqoh binaan Anda.",
        };
      }
      return { authorized: true, santriId: requestedSantriId };
    }
    return {
      authorized: true,
      santriWhere: {
        halaqoh: {
          pembinaId: session.staffId,
        },
      },
    };
  }

  // 3. Wewenang manajerial & pengawasan (MK, KS, ADM, YAY)
  if (["MK", "KS", "ADM", "YAY"].includes(session.role)) {
    if (requestedSantriId) {
      return { authorized: true, santriId: requestedSantriId };
    }
    return { authorized: true };
  }

  // 4. Role tidak berwenang (GA, OSDA, dll): FAIL-CLOSED
  return {
    authorized: false,
    message: `Akses Ditolak: Role ${session.role} tidak memiliki otorisasi mengakses data kedisiplinan.`,
  };
}

/**
 * Server Action: Mengambil daftar riwayat pelanggaran santri (Terkontrol Sesi & ABAC Fail-Closed)
 */
export async function getPelanggaranListAction(santriId?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi kedaluwarsa. Silakan login kembali.", data: [] };
  }

  const scope = await resolveKedisiplinanScope(session, santriId);
  if (!scope.authorized) {
    return { success: false, message: scope.message, data: [] };
  }

  const where: Prisma.PelanggaranSantriWhereInput = scope.santriId
    ? { santriId: scope.santriId }
    : scope.santriWhere
    ? { santri: scope.santriWhere }
    : {};

  try {
    const records = await prisma.pelanggaranSantri.findMany({
      where,
      include: {
        santri: { select: { id: true, nama: true, nis: true, kelas: true } },
        kategori: { select: { id: true, nama: true, tingkat: true, poinDasar: true } },
        pencatat: { select: { id: true, nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        kode: r.kodePelanggaran,
        santriId: r.santriId,
        santriNama: r.santri?.nama || "Santri",
        santriNis: r.santri?.nis || "",
        santriKelas: r.santri?.kelas || "",
        kategori: r.namaPelanggaranSnapshot || r.kategori?.nama || "Pelanggaran",
        kategoriId: r.kategoriId,
        tingkat: r.kategoriSnapshot || r.kategori?.tingkat || "KATEGORI_2",
        sanksi: r.sanksiSnapshot || (r.poinFinal > 0 ? `${r.poinFinal} Poin` : "-"),
        poin: r.poinFinal,
        isPengulangan: r.isPengulangan,
        kronologi: r.kronologi,
        tanggal: r.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
        pencatat: r.pencatat?.nama || "Musyrif",
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data pelanggaran:", error);
    return { success: false, message: "Gagal memuat catatan pelanggaran dari server.", data: [] };
  }
}

/**
 * Server Action: Mengambil daftar Surat Peringatan / SP resmi (Terkontrol Sesi & ABAC Fail-Closed)
 */
export async function getSPListAction(santriId?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi kedaluwarsa. Silakan login kembali.", data: [] };
  }

  const scope = await resolveKedisiplinanScope(session, santriId);
  if (!scope.authorized) {
    return { success: false, message: scope.message, data: [] };
  }

  const where: Prisma.SuratPeringatanWhereInput = scope.santriId
    ? { santriId: scope.santriId }
    : scope.santriWhere
    ? { santri: scope.santriWhere }
    : {};

  try {
    const records = await prisma.suratPeringatan.findMany({
      where,
      include: {
        santri: { select: { id: true, nama: true, nis: true, kelas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: records.map((sp) => ({
        id: sp.id,
        nomorSP: sp.nomorSP,
        santriId: sp.santriId,
        santriNama: sp.santri?.nama || "Santri",
        santriNis: sp.santri?.nis || "",
        santriKelas: sp.santri?.kelas || "",
        tingkat: sp.tingkatSP,
        totalPoin: sp.totalPoinSaatTerbit,
        status: sp.status,
        keteranganPemutihan: sp.keteranganPemutihan,
        tanggalPemutihan: sp.tanggalPemutihan?.toISOString(),
        tanggal: sp.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
        createdAt: sp.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data SP:", error);
    return { success: false, message: "Gagal memuat data SP dari server.", data: [] };
  }
}

/**
 * Server Action: Mengambil 44 Master Data Kategori Pelanggaran Resmi STQ DUC dari Database
 */
export async function getMasterPelanggaranListAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi kedaluwarsa. Silakan login kembali.", data: [] };
  }

  try {
    const list = await prisma.kategoriPelanggaran.findMany({
      orderBy: [{ tingkat: "asc" }, { kode: "asc" }],
    });

    return {
      success: true,
      data: list.map((k) => ({
        id: k.id, // Primary Key DB asli
        kode: k.kode,
        nama: k.nama,
        tingkat: k.tingkat,
        sanksi: k.sanksi,
        poinDasar: k.poinDasar,
        deskripsi: k.sanksi || "",
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil master kategori pelanggaran:", error);
    return { success: false, message: "Gagal memuat master pelanggaran dari pangkalan data.", data: [] };
  }
}
