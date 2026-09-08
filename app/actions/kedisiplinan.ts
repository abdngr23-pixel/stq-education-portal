"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusSP, KategoriBintang } from "@prisma/client";
import { hitungPoinPelanggaran, evaluasiLevelSP } from "@/lib/educational-rules";

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
    const poinFinal = hitungPoinPelanggaran(kategori.poinDasar, isPengulangan);

    // Pencatat staff
    const pencatatStaff = session.staffId
      ? await prisma.staff.findUnique({ where: { id: session.staffId } })
      : await prisma.staff.findFirst({ where: { roleStaff: "MK" } });

    if (!pencatatStaff) {
      return { success: false, message: "Data staf pencatat tidak ditemukan." };
    }

    const count = await prisma.pelanggaranSantri.count();
    const kodePelanggaran = `PLG-${String(count + 1).padStart(6, "0")}`;

    // Simpan pelanggaran
    const newPelanggaran = await prisma.pelanggaranSantri.create({
      data: {
        kodePelanggaran,
        santriId: input.santriId,
        kategoriId: input.kategoriId,
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

    // 3. Pemicu Surat Peringatan (SP) Otomatis menggunakan single source of truth
    let spNotice = "";
    const spGrade = evaluasiLevelSP(totalPoin);
    let spLevel = spGrade === "SP3" ? 3 : spGrade === "SP2" ? 2 : spGrade === "SP1" ? 1 : 0;

    if (spLevel > 0) {
      // Cek apakah SP pada tingkat ini sudah ada
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
        spNotice = ` PERINGATAN: Akumulasi poin mencapai ${totalPoin} poin! ${nomorSP} (SP ${spLevel}) otomatis diterbitkan.`;
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
