"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusHakLibur, JenisTransaksiBintang, StatusSanksiKunjungan } from "@prisma/client";

/**
 * Mengambil konfigurasi kebijakan reward & sanksi aktif
 */
export async function getKebijakanRewardSanksiAction() {
  try {
    let kebijakan = await prisma.kebijakanRewardSanksi.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!kebijakan) {
      // Buat default kebijakan jika belum ada
      kebijakan = await prisma.kebijakanRewardSanksi.create({
        data: {
          nama: "Kebijakan Standar Pesantren STQ DUC",
          minNilaiTasmi: 80.0,
          minNilaiSimaan: 85.0,
          bintangTasmi: 1,
          bintangSimaan: 2,
          hakLiburTasmiHari: 1,
          hakLiburSimaanHari: 2,
          minPersenTargetBulanan: 100.0,
          durasiKehilanganKunjunganHari: 30,
          isActive: true,
        },
      });
    }

    return { success: true, data: kebijakan };
  } catch (error) {
    console.error("Gagal mengambil kebijakan reward sanksi:", error);
    return { success: false, message: "Gagal memuat konfigurasi kebijakan dari database." };
  }
}

/**
 * Memperbarui kebijakan reward & sanksi (Khusus Mudir / Kepala Sekolah - Role KS)
 */
export async function updateKebijakanRewardSanksiAction(params: {
  id?: string;
  nama?: string;
  minNilaiTasmi: number;
  minNilaiSimaan: number;
  bintangTasmi: number;
  bintangSimaan: number;
  hakLiburTasmiHari: number;
  hakLiburSimaanHari: number;
  minPersenTargetBulanan: number;
  durasiKehilanganKunjunganHari: number;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (session.role !== "KS") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Mudir (KS) yang memiliki otoritas mengubah kebijakan reward & sanksi.",
    };
  }

  try {
    const existing = await prisma.kebijakanRewardSanksi.findFirst({
      where: { isActive: true },
    });

    let updated;
    if (existing) {
      updated = await prisma.kebijakanRewardSanksi.update({
        where: { id: existing.id },
        data: {
          nama: params.nama || existing.nama,
          minNilaiTasmi: params.minNilaiTasmi,
          minNilaiSimaan: params.minNilaiSimaan,
          bintangTasmi: params.bintangTasmi,
          bintangSimaan: params.bintangSimaan,
          hakLiburTasmiHari: params.hakLiburTasmiHari,
          hakLiburSimaanHari: params.hakLiburSimaanHari,
          minPersenTargetBulanan: params.minPersenTargetBulanan,
          durasiKehilanganKunjunganHari: params.durasiKehilanganKunjunganHari,
        },
      });
    } else {
      updated = await prisma.kebijakanRewardSanksi.create({
        data: {
          nama: params.nama || "Kebijakan Standar Pesantren STQ DUC",
          minNilaiTasmi: params.minNilaiTasmi,
          minNilaiSimaan: params.minNilaiSimaan,
          bintangTasmi: params.bintangTasmi,
          bintangSimaan: params.bintangSimaan,
          hakLiburTasmiHari: params.hakLiburTasmiHari,
          hakLiburSimaanHari: params.hakLiburSimaanHari,
          minPersenTargetBulanan: params.minPersenTargetBulanan,
          durasiKehilanganKunjunganHari: params.durasiKehilanganKunjunganHari,
          isActive: true,
          createdBy: session.userId,
        },
      });
    }

    await recordAuditLog({
      userId: session.userId,
      action: "UPDATE_KEBIJAKAN_REWARD_SANKSI",
      entity: "KebijakanRewardSanksi",
      entityId: updated.id,
      details: params,
    });

    return {
      success: true,
      message: "Kebijakan reward & sanksi berhasil diperbarui.",
      data: updated,
    };
  } catch (error) {
    console.error("Gagal memperbarui kebijakan:", error);
    return { success: false, message: "Terjadi kesalahan saat menyimpan kebijakan." };
  }
}

/**
 * Memproses reward Tasmi' / Sima'an berdasarkan nilai kelulusan
 */
export async function prosesRewardTasmiSimaanAction(tasmiSimaanId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // Wewenang: Musyrif Tahfizh (MT), Mudir (KS), Admin (ADM)
  if (!["MT", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: "Anda tidak berwenang memproses reward kelulusan hafalan." };
  }

  try {
    const tasmi = await prisma.tasmiSimaan.findUnique({
      where: { id: tasmiSimaanId },
      include: { santri: true },
    });

    if (!tasmi) {
      return { success: false, message: "Data Tasmi'/Sima'an tidak ditemukan." };
    }

    // Ambil kebijakan aktif
    const kebijakan = await prisma.kebijakanRewardSanksi.findFirst({
      where: { isActive: true },
    });

    const minNilai = tasmi.jenis === "TASMI"
      ? (kebijakan?.minNilaiTasmi ?? 80.0)
      : (kebijakan?.minNilaiSimaan ?? 85.0);

    if (tasmi.nilai < minNilai) {
      return {
        success: false,
        message: `Nilai (${tasmi.nilai}) belum memenuhi ambang batas kelulusan (${minNilai}) untuk reward.`,
      };
    }

    // Cek apakah sudah pernah diproses (idempotent)
    const existingLibur = await prisma.hakLiburSantri.findFirst({
      where: { tasmiSimaanId: tasmi.id },
    });
    if (existingLibur) {
      return { success: true, message: "Reward untuk ujian ini sudah pernah diterbitkan sebelumnya." };
    }

    const jlhBintang = tasmi.jenis === "TASMI"
      ? (kebijakan?.bintangTasmi ?? 1)
      : (kebijakan?.bintangSimaan ?? 2);

    const jlhHariLibur = tasmi.jenis === "TASMI"
      ? (kebijakan?.hakLiburTasmiHari ?? 1)
      : (kebijakan?.hakLiburSimaanHari ?? 2);

    // 1. Buat Hak Libur
    const hakLibur = await prisma.hakLiburSantri.create({
      data: {
        santriId: tasmi.santriId,
        tasmiSimaanId: tasmi.id,
        jumlahHari: jlhHariLibur,
        status: StatusHakLibur.TERSEDIA,
        catatan: `Reward kelulusan ${tasmi.jenis} Juz ${tasmi.juz} (Nilai: ${tasmi.nilai})`,
        diverifikasiOlehId: session.userId,
      },
    });

    // 2. Buat Transaksi Bintang
    const jenisBintang = tasmi.jenis === "TASMI"
      ? JenisTransaksiBintang.REWARD_TASMI
      : JenisTransaksiBintang.REWARD_SIMAAN;

    const bintang = await prisma.transaksiBintang.create({
      data: {
        santriId: tasmi.santriId,
        tasmiSimaanId: tasmi.id,
        jumlahBintang: jlhBintang,
        jenis: jenisBintang,
        keterangan: `Reward kelulusan ${tasmi.jenis} Juz ${tasmi.juz} (Nilai: ${tasmi.nilai})`,
        diverifikasiOlehId: session.userId,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "PROSES_REWARD_TASMI_SIMAAN",
      entity: "TasmiSimaan",
      entityId: tasmi.id,
      details: {
        santriId: tasmi.santriId,
        jenis: tasmi.jenis,
        juz: tasmi.juz,
        nilai: tasmi.nilai,
        bintang: jlhBintang,
        hariLibur: jlhHariLibur,
      },
    });

    return {
      success: true,
      message: `Reward berhasil diterbitkan untuk ${tasmi.santri.nama}: +${jlhBintang} Bintang & +${jlhHariLibur} Hari Hak Libur.`,
      data: { hakLibur, bintang },
    };
  } catch (error) {
    console.error("Gagal memproses reward:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses reward." };
  }
}

/**
 * Membatalkan/Mencabut Reward Tasmi' / Sima'an (Khusus Mudir - Role KS)
 */
export async function batalkanRewardTasmiSimaanAction(params: {
  tasmiSimaanId: string;
  alasan: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (session.role !== "KS") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Mudir (KS) yang memiliki kewenangan membatalkan reward santri.",
    };
  }

  if (!params.alasan || params.alasan.trim().length < 5) {
    return { success: false, message: "Alasan pembatalan wajib diisi minimal 5 karakter." };
  }

  try {
    // 1. Update Hak Libur menjadi DIBATALKAN
    await prisma.hakLiburSantri.updateMany({
      where: { tasmiSimaanId: params.tasmiSimaanId },
      data: {
        status: StatusHakLibur.DIBATALKAN,
        alasanPembatalan: params.alasan,
      },
    });

    // 2. Ambil bintang yang sebelumnya didapat dari ujian ini
    const bintangAwal = await prisma.transaksiBintang.findMany({
      where: {
        tasmiSimaanId: params.tasmiSimaanId,
        jenis: { in: [JenisTransaksiBintang.REWARD_TASMI, JenisTransaksiBintang.REWARD_SIMAAN] },
      },
    });

    for (const b of bintangAwal) {
      // Catat transaksi pembatalan reward bintang
      await prisma.transaksiBintang.create({
        data: {
          santriId: b.santriId,
          tasmiSimaanId: params.tasmiSimaanId,
          jumlahBintang: b.jumlahBintang,
          jenis: JenisTransaksiBintang.PEMBATALAN,
          keterangan: `Pembatalan reward: ${params.alasan}`,
          diverifikasiOlehId: session.userId,
        },
      });
    }

    await recordAuditLog({
      userId: session.userId,
      action: "BATALKAN_REWARD_TASMI_SIMAAN",
      entity: "TasmiSimaan",
      entityId: params.tasmiSimaanId,
      details: { alasan: params.alasan, dibatalkanOleh: session.username },
    });

    return {
      success: true,
      message: "Reward berhasil dibatalkan dan dicatat dalam audit trail.",
    };
  } catch (error) {
    console.error("Gagal membatalkan reward:", error);
    return { success: false, message: "Terjadi kesalahan saat membatalkan reward." };
  }
}

/**
 * Preview kalkulasi sanksi bulanan untuk seluruh santri pada bulan berjalan
 */
export async function previewFinalisasiBulananAction(params: {
  bulan: number;
  tahunAjaran: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["KS", "ADM", "MT"].includes(session.role)) {
    return { success: false, message: "Anda tidak memiliki akses ke pratinjau finalisasi bulanan." };
  }

  try {
    const kebijakan = await prisma.kebijakanRewardSanksi.findFirst({
      where: { isActive: true },
    });
    const minPersen = kebijakan?.minPersenTargetBulanan ?? 100.0;
    const durasiHari = kebijakan?.durasiKehilanganKunjunganHari ?? 30;

    // Hitung range tanggal bulan
    const [thnAwalStr, thnAkhirStr] = params.tahunAjaran.split("/");
    const tahunKalender =
      params.bulan >= 7 ? parseInt(thnAwalStr, 10) || 2026 : parseInt(thnAkhirStr, 10) || 2027;

    const startDate = new Date(tahunKalender, params.bulan - 1, 1);
    const endDate = new Date(tahunKalender, params.bulan, 0, 23, 59, 59, 999);

    const santriList = await prisma.santri.findMany({
      where: { status: "AKTIF" },
      include: {
        halaqoh: { select: { nama: true } },
        targetList: {
          where: { jenis: "SABAQ", bulan: params.bulan, tahunAjaran: params.tahunAjaran },
          take: 1,
        },
        finalisasiBulananList: {
          where: { bulan: params.bulan, tahunAjaran: params.tahunAjaran },
          take: 1,
        },
      },
      orderBy: { nama: "asc" },
    });

    const hasilPreview = await Promise.all(
      santriList.map(async (s) => {
        // Target bulanan santri (default target proses bulanan atau proporsional harian x 25 hari)
        const targetBulanan = s.targetList[0]?.targetBulanan ?? 20.0;

        // Ambil setoran riil tersimpan di bulan ini (SABAQ)
        const setoranBulan = await prisma.setoranTahfizh.aggregate({
          where: {
            santriId: s.id,
            jenis: "SABAQ",
            tanggal: { gte: startDate, lte: endDate },
          },
          _sum: { jumlahHalaman: true },
        });

        const capaianHalaman = Number(setoranBulan._sum.jumlahHalaman ?? 0);
        const persentase = targetBulanan > 0
          ? Math.round((capaianHalaman / targetBulanan) * 1000) / 10
          : 0;

        const isTercapai = persentase >= minPersen;
        const finalisasiExisting = s.finalisasiBulananList[0];

        let statusSanksi: StatusSanksiKunjungan = isTercapai
          ? StatusSanksiKunjungan.BEBAS
          : StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN;

        if (finalisasiExisting && finalisasiExisting.isOverride) {
          statusSanksi = finalisasiExisting.statusSanksiKunjungan;
        }

        return {
          santriId: s.id,
          nis: s.nis,
          nama: s.nama,
          halaqoh: s.halaqoh?.nama || "-",
          targetHalaman: targetBulanan,
          capaianHalaman,
          persentase,
          isTercapai,
          statusSanksi,
          isFinalized: Boolean(finalisasiExisting),
          isOverride: finalisasiExisting?.isOverride ?? false,
          alasanOverride: finalisasiExisting?.alasanOverride ?? null,
          durasiSanksiHari: durasiHari,
        };
      })
    );

    return {
      success: true,
      data: {
        bulan: params.bulan,
        tahunAjaran: params.tahunAjaran,
        minPersenTarget: minPersen,
        durasiHariSanksi: durasiHari,
        items: hasilPreview,
      },
    };
  } catch (error) {
    console.error("Gagal memuat pratinjau finalisasi:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses data pratinjau." };
  }
}

/**
 * Menjalankan finalisasi bulanan secara IDEMPOTENT (Khusus Mudir - Role KS)
 * Menentukan status sanksi kehilangan hak kunjungan jika tidak mencapai target proses bulanan
 */
export async function finalisasiLaporanBulananAction(params: {
  bulan: number;
  tahunAjaran: string;
  overrides?: Array<{
    santriId: string;
    statusSanksi: StatusSanksiKunjungan;
    alasanOverride: string;
  }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (session.role !== "KS") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Mudir (KS) yang memiliki otoritas memfinalisasi laporan dan sanksi bulanan.",
    };
  }

  try {
    const previewResult = await previewFinalisasiBulananAction({
      bulan: params.bulan,
      tahunAjaran: params.tahunAjaran,
    });

    if (!previewResult.success || !previewResult.data) {
      return { success: false, message: "Gagal menghitung target dan capaian bulanan." };
    }

    const { items, durasiHariSanksi } = previewResult.data;
    const overridesMap = new Map(
      (params.overrides || []).map((o) => [o.santriId, o])
    );

    const now = new Date();
    const tanggalSelesaiSanksi = new Date(now.getTime() + durasiHariSanksi * 24 * 60 * 60 * 1000);

    const finalizedRecords = [];

    for (const item of items) {
      const override = overridesMap.get(item.santriId);
      const isOverride = Boolean(override);
      const effectiveStatusSanksi = override
        ? override.statusSanksi
        : (item.isTercapai ? StatusSanksiKunjungan.BEBAS : StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN);
      const alasanOverride = override ? override.alasanOverride : null;

      const rec = await prisma.finalisasiBulananSantri.upsert({
        where: {
          santriId_bulan_tahunAjaran: {
            santriId: item.santriId,
            bulan: params.bulan,
            tahunAjaran: params.tahunAjaran,
          },
        },
        create: {
          santriId: item.santriId,
          bulan: params.bulan,
          tahunAjaran: params.tahunAjaran,
          targetHalaman: item.targetHalaman,
          capaianHalaman: item.capaianHalaman,
          persentase: item.persentase,
          isTercapai: item.isTercapai,
          statusSanksiKunjungan: effectiveStatusSanksi,
          tanggalMulaiSanksi: effectiveStatusSanksi === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN ? now : null,
          tanggalSelesaiSanksi: effectiveStatusSanksi === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN ? tanggalSelesaiSanksi : null,
          isOverride,
          alasanOverride,
          difinalisasiOlehId: session.userId,
        },
        update: {
          targetHalaman: item.targetHalaman,
          capaianHalaman: item.capaianHalaman,
          persentase: item.persentase,
          isTercapai: item.isTercapai,
          statusSanksiKunjungan: effectiveStatusSanksi,
          tanggalMulaiSanksi: effectiveStatusSanksi === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN ? now : null,
          tanggalSelesaiSanksi: effectiveStatusSanksi === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN ? tanggalSelesaiSanksi : null,
          isOverride,
          alasanOverride,
          difinalisasiOlehId: session.userId,
        },
      });

      finalizedRecords.push(rec);
    }

    await recordAuditLog({
      userId: session.userId,
      action: "FINALISASI_LAPORAN_BULANAN",
      entity: "FinalisasiBulananSantri",
      entityId: `${params.tahunAjaran}-Bulan-${params.bulan}`,
      details: {
        bulan: params.bulan,
        tahunAjaran: params.tahunAjaran,
        totalSantri: items.length,
        sanksiKehilanganHakCount: finalizedRecords.filter(
          (r) => r.statusSanksiKunjungan === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN
        ).length,
      },
    });

    return {
      success: true,
      message: `Finalisasi bulanan (Bulan ${params.bulan}, TA ${params.tahunAjaran}) berhasil disimpan secara idempotent untuk ${finalizedRecords.length} santri.`,
      data: finalizedRecords,
    };
  } catch (error) {
    console.error("Gagal memfinalisasi bulanan:", error);
    return { success: false, message: "Terjadi kesalahan saat memfinalisasi laporan bulanan." };
  }
}

/**
 * Membatalkan finalisasi bulanan (Khusus Mudir - Role KS)
 */
export async function batalkanFinalisasiBulananAction(params: {
  bulan: number;
  tahunAjaran: string;
  alasan: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (session.role !== "KS") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Mudir (KS) yang memiliki hak membatalkan finalisasi bulanan.",
    };
  }

  if (!params.alasan || params.alasan.trim().length < 5) {
    return { success: false, message: "Alasan pembatalan wajib diisi minimal 5 karakter." };
  }

  try {
    const deleted = await prisma.finalisasiBulananSantri.deleteMany({
      where: {
        bulan: params.bulan,
        tahunAjaran: params.tahunAjaran,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "BATALKAN_FINALISASI_BULANAN",
      entity: "FinalisasiBulananSantri",
      entityId: `${params.tahunAjaran}-Bulan-${params.bulan}`,
      details: {
        bulan: params.bulan,
        tahunAjaran: params.tahunAjaran,
        jumlahDihapus: deleted.count,
        alasan: params.alasan,
      },
    });

    return {
      success: true,
      message: `Finalisasi bulanan untuk Bulan ${params.bulan} berhasil dibatalkan (${deleted.count} catatan santri dikembalikan ke status draf).`,
    };
  } catch (error) {
    console.error("Gagal membatalkan finalisasi bulanan:", error);
    return { success: false, message: "Terjadi kesalahan saat membatalkan finalisasi." };
  }
}
