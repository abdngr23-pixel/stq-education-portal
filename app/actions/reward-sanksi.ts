"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusHakLibur, JenisTransaksiBintang, StatusSanksiKunjungan } from "@prisma/client";

/**
 * Mengambil konfigurasi kebijakan reward & sanksi aktif
 */
export async function getKebijakanRewardSanksiAction() {
  try {
    const kebijakan = await prisma.kebijakanRewardSanksi.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!kebijakan) {
      // Kembalikan konfigurasi default resmi tanpa menulis ke DB pada aksi GET (Read-Only)
      return {
        success: true,
        data: {
          id: "DEFAULT_STQ_DUC",
          nama: "Kebijakan Standar Pesantren STQ DUC",
          minNilaiTasmi: 80.0,
          minNilaiSimaan: 85.0,
          bintangTasmi: 1,
          bintangSimaan: 2,
          hakLiburTasmiHari: 1,
          hakLiburSimaanHari: 2,
          minPersenTargetBulanan: 80.0,
          durasiKehilanganKunjunganHari: 30,
          isActive: true,
        },
      };
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

    // Hitung range tanggal bulan dalam zona WITA (UTC+8)
    const [thnAwalStr, thnAkhirStr] = params.tahunAjaran.split("/");
    const tahunKalender =
      params.bulan >= 7 ? parseInt(thnAwalStr, 10) || 2026 : parseInt(thnAkhirStr, 10) || 2027;

    // Batas Awal Bulan 00:00:00 WITA
    const startDate = new Date(Date.UTC(tahunKalender, params.bulan - 1, 1, -8, 0, 0, 0));
    // Batas Akhir Bulan 23:59:59.999 WITA
    const lastDayOfMonth = new Date(tahunKalender, params.bulan, 0).getDate();
    const endDate = new Date(Date.UTC(tahunKalender, params.bulan - 1, lastDayOfMonth, 15, 59, 59, 999));

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
        // Target bulanan santri: jangan otomatis pakai 20 halaman jika belum ditetapkan
        const rawTarget = s.targetList[0]?.targetBulanan;
        const hasValidTarget = typeof rawTarget === "number" && rawTarget > 0;
        const targetBulanan = hasValidTarget ? rawTarget : null;

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
        let persentase = 0;
        let isTercapai = false;
        let statusSanksi: StatusSanksiKunjungan = StatusSanksiKunjungan.BEBAS;
        let statusKeterangan = "Target Tercapai";

        if (!hasValidTarget) {
          // Aturan: Santri tanpa target valid masuk status 'Perlu penetapan target', bukan disanksi
          statusSanksi = StatusSanksiKunjungan.DIKECUALIKAN;
          statusKeterangan = "Perlu penetapan target";
          isTercapai = false;
        } else {
          persentase = Math.round((capaianHalaman / (targetBulanan as number)) * 1000) / 10;
          isTercapai = persentase >= minPersen;
          statusSanksi = isTercapai
            ? StatusSanksiKunjungan.BEBAS
            : StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN;
          statusKeterangan = isTercapai ? "Target Tercapai" : "Belum Capai Target";
        }

        const finalisasiExisting = s.finalisasiBulananList[0];
        if (finalisasiExisting && finalisasiExisting.isOverride) {
          statusSanksi = finalisasiExisting.statusSanksiKunjungan;
        }

        return {
          santriId: s.id,
          nis: s.nis,
          nama: s.nama,
          halaqoh: s.halaqoh?.nama || "-",
          targetHalaman: targetBulanan,
          hasValidTarget,
          statusKeterangan,
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
        : item.statusSanksi;
      const alasanOverride = override ? override.alasanOverride : null;

      const existingRecord = await prisma.finalisasiBulananSantri.findUnique({
        where: {
          santriId_bulan_tahunAjaran: {
            santriId: item.santriId,
            bulan: params.bulan,
            tahunAjaran: params.tahunAjaran,
          },
        },
      });

      // Aturan: Jangan memperpanjang sanksi jika finalisasi dijalankan ulang (Idempotent date preservation)
      const tglMulai =
        effectiveStatusSanksi === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN
          ? existingRecord?.tanggalMulaiSanksi || now
          : null;
      const tglSelesai =
        effectiveStatusSanksi === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN
          ? existingRecord?.tanggalSelesaiSanksi || tanggalSelesaiSanksi
          : null;

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
          targetHalaman: item.targetHalaman ?? 0,
          capaianHalaman: item.capaianHalaman ?? 0,
          persentase: item.persentase ?? 0,
          isTercapai: item.isTercapai,
          statusSanksiKunjungan: effectiveStatusSanksi,
          tanggalMulaiSanksi: tglMulai,
          tanggalSelesaiSanksi: tglSelesai,
          isOverride,
          alasanOverride,
          difinalisasiOlehId: session.userId,
        },
        update: {
          targetHalaman: item.targetHalaman ?? 0,
          capaianHalaman: item.capaianHalaman ?? 0,
          persentase: item.persentase ?? 0,
          isTercapai: item.isTercapai,
          statusSanksiKunjungan: effectiveStatusSanksi,
          tanggalMulaiSanksi: tglMulai,
          tanggalSelesaiSanksi: tglSelesai,
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

    const totalDiproses = finalizedRecords.length;
    const totalDisanksi = finalizedRecords.filter(
      (r) => r.statusSanksiKunjungan === StatusSanksiKunjungan.KEHILANGAN_KUNJUNGAN
    ).length;
    const totalBebas = finalizedRecords.filter(
      (r) => r.statusSanksiKunjungan === StatusSanksiKunjungan.BEBAS
    ).length;

    return {
      success: true,
      message: `Finalisasi bulanan (Bulan ${params.bulan}, TA ${params.tahunAjaran}) berhasil disimpan secara idempotent untuk ${finalizedRecords.length} santri.`,
      data: {
        records: finalizedRecords,
        totalDiproses,
        totalDisanksi,
        totalBebas,
      },
    };
  } catch (error) {
    console.error("Gagal memfinalisasi bulanan:", error);
    return { success: false, message: "Terjadi kesalahan saat memfinalisasi laporan bulanan." };
  }
}

/**
 * Override/Dispensasi Sanksi Bulanan Santri (Khusus Mudir - Role KS)
 */
export async function overrideSanksiBulananAction(params: {
  santriId: string;
  bulan: number;
  tahunAjaran: string;
  statusSanksiBaru: "BEBAS" | "KEHILANGAN_KUNJUNGAN" | "DIKECUALIKAN";
  alasan: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (session.role !== "KS") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Kepala Sekolah/Mudir (KS) yang memiliki kewenangan override/dispensasi sanksi.",
    };
  }

  if (!params.alasan || params.alasan.trim().length < 5) {
    return { success: false, message: "Alasan dispensasi/override wajib diisi minimal 5 karakter." };
  }

  try {
    const statusEnum = params.statusSanksiBaru as StatusSanksiKunjungan;
    const existing = await prisma.finalisasiBulananSantri.findUnique({
      where: {
        santriId_bulan_tahunAjaran: {
          santriId: params.santriId,
          bulan: params.bulan,
          tahunAjaran: params.tahunAjaran,
        },
      },
    });

    let updated;
    if (existing) {
      updated = await prisma.finalisasiBulananSantri.update({
        where: { id: existing.id },
        data: {
          statusSanksiKunjungan: statusEnum,
          isOverride: true,
          alasanOverride: params.alasan,
          difinalisasiOlehId: session.userId,
        },
      });
    } else {
      updated = await prisma.finalisasiBulananSantri.create({
        data: {
          santriId: params.santriId,
          bulan: params.bulan,
          tahunAjaran: params.tahunAjaran,
          targetHalaman: 0,
          capaianHalaman: 0,
          persentase: 0,
          isTercapai: statusEnum === StatusSanksiKunjungan.BEBAS,
          statusSanksiKunjungan: statusEnum,
          isOverride: true,
          alasanOverride: params.alasan,
          difinalisasiOlehId: session.userId,
        },
      });
    }

    await recordAuditLog({
      userId: session.userId,
      action: "OVERRIDE_SANKSI_BULANAN",
      entity: "FinalisasiBulananSantri",
      entityId: updated.id,
      details: {
        santriId: params.santriId,
        bulan: params.bulan,
        tahunAjaran: params.tahunAjaran,
        statusSanksiBaru: statusEnum,
        alasan: params.alasan,
        overrideOleh: session.username,
      },
    });

    return {
      success: true,
      message: "Dispensasi/override sanksi Mudir berhasil disimpan ke pangkalan data.",
      data: updated,
    };
  } catch (error) {
    console.error("Gagal menyimpan override sanksi bulanan:", error);
    return { success: false, message: "Terjadi kesalahan saat menyimpan override sanksi." };
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

/**
 * Mengambil daftar ujian Tasmi' dan Sima'an untuk panel evaluasi & reward
 */
export async function getDaftarTasmiSimaanEligibleAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali.", data: [] };
  }

  try {
    const list = await prisma.tasmiSimaan.findMany({
      include: {
        santri: {
          select: { id: true, nama: true, nis: true, kelas: true },
        },
        musyrif: {
          select: { id: true, nama: true },
        },
        hakLiburList: {
          select: { id: true, status: true, jumlahHari: true },
        },
        transaksiBintangList: {
          select: { id: true, jenis: true, jumlahBintang: true },
        },
      },
      orderBy: { tanggal: "desc" },
      take: 50,
    });

    return {
      success: true,
      data: list.map((item) => ({
        id: item.id,
        santriId: item.santriId,
        santriNama: item.santri.nama,
        santriNis: item.santri.nis,
        kelas: item.santri.kelas,
        penguji: item.musyrif.nama,
        tanggal: item.tanggal,
        jenis: item.jenis,
        juz: item.juz,
        nilai: item.nilai,
        predikat: item.predikat,
        catatan: item.catatan,
        isRewarded: item.hakLiburList.length > 0 && item.hakLiburList.some((h) => h.status !== "DIBATALKAN"),
        hakLibur: item.hakLiburList[0] || null,
        bintang: item.transaksiBintangList[0] || null,
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil daftar tasmi simaan:", error);
    return { success: false, message: "Gagal memuat data dari database.", data: [] };
  }
}
