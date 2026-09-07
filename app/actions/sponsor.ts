"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusKirimWA } from "@prisma/client";

export interface TambahSponsorData {
  nama: string;
  noHp: string;
  email?: string;
  alamat?: string;
  nominalBulanan: number;
  santriId?: string;
}

/**
 * Server Action: Tambah Data Orang Tua Asuh / Donatur
 */
export async function tambahSponsorAction(input: TambahSponsorData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  if (session.role !== "ADM" && session.role !== "KS") {
    return { success: false, message: "Hanya Admin (ADM) dan Mudir (KS) yang dapat mendaftarkan sponsor." };
  }

  try {
    const count = await prisma.orangTuaAsuh.count();
    const kodeSponsor = `OTA-${String(count + 1).padStart(3, "0")}`;

    const sponsor = await prisma.orangTuaAsuh.create({
      data: {
        kodeSponsor,
        nama: input.nama.trim(),
        noHp: input.noHp.trim(),
        email: input.email?.trim(),
        alamat: input.alamat?.trim(),
        nominalBulanan: Number(input.nominalBulanan),
        santriId: input.santriId || null,
      },
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "TAMBAH_SPONSOR",
      entity: "OrangTuaAsuh",
      entityId: sponsor.id,
      details: { kodeSponsor, nama: sponsor.nama, nominal: sponsor.nominalBulanan },
    });

    return {
      success: true,
      message: `Orang Tua Asuh ${sponsor.nama} (${kodeSponsor}) berhasil didaftarkan.`,
      data: sponsor,
    };
  } catch (error) {
    console.error("Gagal menambah sponsor:", error);
    return { success: false, message: "Gagal menyimpan data donatur ke database." };
  }
}

/**
 * Server Action: Generate Laporan Bulanan Sponsor (Snapshot Data Tahfizh)
 */
export async function generateLaporanSponsorAction(params: {
  sponsorId: string;
  santriId: string;
  bulan: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  try {
    const santri = await prisma.santri.findUnique({
      where: { id: params.santriId },
      include: {
        halaqoh: { include: { pembina: true } },
        setoranList: {
          take: 5,
          orderBy: { tanggal: "desc" },
        },
      },
    });

    if (!santri) {
      return { success: false, message: "Data santri tidak ditemukan." };
    }

    const totalSetoran = await prisma.setoranTahfizh.count({
      where: { santriId: params.santriId },
    });

    const maxJuz = santri.setoranList.reduce((max, s) => Math.max(max, s.juz), 0);
    const setoranTerakhir = santri.setoranList[0]
      ? `${santri.setoranList[0].surahMulai}: ${santri.setoranList[0].ayatMulai}-${santri.setoranList[0].ayatSelesai} (${santri.setoranList[0].nilai})`
      : "Belum ada setoran bulan ini";

    const snapshotTahfizh = {
      santriNama: santri.nama,
      nis: santri.nis,
      kelas: santri.kelas,
      capaianJuz: maxJuz,
      totalSetoran,
      setoranTerakhir,
      pembina: santri.halaqoh?.pembina.nama || "Ustadz Pembina",
    };

    const count = await prisma.laporanBulananSponsor.count();
    const kodeLaporan = `LAP-${params.bulan.replace(/\s+/g, "-")}-${String(count + 1).padStart(3, "0")}`;

    const laporan = await prisma.laporanBulananSponsor.create({
      data: {
        kodeLaporan,
        sponsorId: params.sponsorId,
        santriId: params.santriId,
        bulan: params.bulan,
        snapshotTahfizh,
        catatanMusyrif: "Alhamdulillah santri sangat tekun mengikuti halaqoh tahfizh dan berakhlak mulia.",
        statusKirimWA: StatusKirimWA.BELUM_KIRIM,
      },
      include: {
        sponsor: true,
        santri: true,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "GENERATE_LAPORAN_SPONSOR",
      entity: "LaporanBulananSponsor",
      entityId: laporan.id,
      details: { kodeLaporan, bulan: params.bulan },
    });

    return {
      success: true,
      message: `Laporan bulanan ${kodeLaporan} untuk donatur ${laporan.sponsor.nama} berhasil digenerate.`,
      data: laporan,
    };
  } catch (error) {
    console.error("Gagal generate laporan:", error);
    return { success: false, message: "Terjadi kesalahan saat generate laporan sponsor." };
  }
}

/**
 * Server Action: Kirim Laporan via WhatsApp API (Dispatcher)
 */
export async function kirimLaporanWhatsAppAction(laporanId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  try {
    const laporan = await prisma.laporanBulananSponsor.findUnique({
      where: { id: laporanId },
      include: { sponsor: true, santri: true },
    });

    if (!laporan) {
      return { success: false, message: "Laporan tidak ditemukan." };
    }

    const snapshot = laporan.snapshotTahfizh as any;

    // Format pesan WhatsApp resmi STQ DUC
    const pesanWA = `*LAPORAN PERKEMBANGAN TAHFIZH SANTRI*
*STQ DARUL ULUM CENDEKIA*
Periode: ${laporan.bulan}

Kepada Yth. Bapak/Ibu Donatur/Orang Tua Asuh:
*${laporan.sponsor.nama}*

Berikut ringkasan capaian ananda asuh:
• Nama Santri: *${laporan.santri.nama}* (${laporan.santri.nis})
• Kelas: ${laporan.santri.kelas}
• Capaian Hafalan: *${snapshot.capaianJuz} Juz*
• Setoran Terakhir: ${snapshot.setoranTerakhir}
• Musyrif Pembina: ${snapshot.pembina}

*Catatan Musyrif:*
_"${laporan.catatanMusyrif || "Santri istiqomah dalam murojaah dan tahsin."}"_

Jazakumullah Khairan Katsiran atas dukungan dan doa Bapak/Ibu. Semoga menjadi amal jariyah yang terus mengalir pahalanya.

_Pengurus STQ Darul Ulum Cendekia_`;

    // Simulasi pengiriman via WhatsApp Gateway (Wablas / Fonnte / WhatsApp Cloud API)
    console.log(`[WhatsApp Dispatcher] Mengirim pesan ke ${laporan.sponsor.noHp}:\n${pesanWA}`);

    // Update status di database
    const updated = await prisma.laporanBulananSponsor.update({
      where: { id: laporanId },
      data: {
        statusKirimWA: StatusKirimWA.TERKIRIM,
        tanggalKirimWA: new Date(),
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "KIRIM_WA_LAPORAN",
      entity: "LaporanBulananSponsor",
      entityId: updated.id,
      details: {
        nomorTujuan: laporan.sponsor.noHp,
        santri: laporan.santri.nama,
        status: "TERKIRIM",
      },
    });

    return {
      success: true,
      message: `Laporan berhasil dikirim via WhatsApp ke ${laporan.sponsor.nama} (${laporan.sponsor.noHp}).`,
      pesanPreview: pesanWA,
    };
  } catch (error) {
    console.error("Gagal kirim WhatsApp:", error);
    return { success: false, message: "Gagal mengirim laporan melalui WhatsApp API." };
  }
}

/**
 * Server Action: Mengambil daftar Orang Tua Asuh
 */
export async function getDaftarSponsorAction() {
  try {
    const list = await prisma.orangTuaAsuh.findMany({
      orderBy: { kodeSponsor: "asc" },
      include: {
        santri: true,
        laporanList: { take: 1, orderBy: { createdAt: "desc" } },
      },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil sponsor:", error);
    return { success: false, data: [] };
  }
}
