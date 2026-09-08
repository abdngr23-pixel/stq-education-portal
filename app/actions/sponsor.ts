"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusKirimWA } from "@prisma/client";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { formatIndonesianPhone, generateWALink } from "@/lib/whatsapp";
import { generateSponsorCode, generateLaporanSponsorCode } from "@/lib/sequence";

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
    const kodeSponsor = generateSponsorCode(count + 1);

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
  catatanMusyrif?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  try {
    const sponsor = await prisma.orangTuaAsuh.findUnique({
      where: { id: params.sponsorId },
    });

    if (!sponsor) {
      return { success: false, message: "Data orang tua asuh / donatur tidak ditemukan." };
    }

    if (sponsor.santriId && sponsor.santriId !== params.santriId) {
      return {
        success: false,
        message: `Donatur ${sponsor.nama} tidak terhubung sebagai orang tua asuh santri yang dipilih.`,
      };
    }

    const santri = await prisma.santri.findUnique({
      where: { id: params.santriId },
      include: {
        halaqoh: { include: { pembina: true } },
      },
    });

    if (!santri) {
      return { success: false, message: "Data santri tidak ditemukan." };
    }

    // Parse bulan e.g. "2026-09" or "September 2026"
    let startDate: Date;
    let endDate: Date;
    const matchYearMonth = params.bulan.match(/(\d{4})[/-](\d{1,2})/) || params.bulan.match(/(\d{1,2})[/-](\d{4})/);
    if (matchYearMonth) {
      const year = parseInt(matchYearMonth[1].length === 4 ? matchYearMonth[1] : matchYearMonth[2]);
      const month = parseInt(matchYearMonth[1].length === 4 ? matchYearMonth[2] : matchYearMonth[1]);
      startDate = new Date(Date.UTC(year, month - 1, 1));
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    }

    // Ambil setoran khusus periode bulan tersebut
    const setoranBulanIni = await prisma.setoranTahfizh.findMany({
      where: {
        santriId: params.santriId,
        tanggal: { gte: startDate, lte: endDate },
      },
      orderBy: { tanggal: "desc" },
    });

    const totalSetoran = setoranBulanIni.length;

    // Hitung capaian juz yang sah teruji / lulus sempurna melalui ikhtibar
    const lulusIkhtibarCount = await prisma.ikhtibarTahfizh.count({
      where: {
        santriId: params.santriId,
        status: "LULUS_SEMPURNA_TAHAP_2",
      },
    });

    const setoranTerakhir = setoranBulanIni[0]
      ? `${setoranBulanIni[0].surahMulai}: ${setoranBulanIni[0].ayatMulai}-${setoranBulanIni[0].ayatSelesai} (${setoranBulanIni[0].nilai})`
      : "Belum ada setoran pada periode ini";

    const snapshotTahfizh = {
      santriNama: santri.nama,
      nis: santri.nis,
      kelas: santri.kelas,
      capaianJuz: lulusIkhtibarCount,
      totalSetoran,
      setoranTerakhir,
      pembina: santri.halaqoh?.pembina.nama || "Ustadz Pembina Halaqoh",
    };

    const count = await prisma.laporanBulananSponsor.count();
    const kodeLaporan = generateLaporanSponsorCode(params.bulan, count + 1);

    const laporan = await prisma.laporanBulananSponsor.create({
      data: {
        kodeLaporan,
        sponsorId: params.sponsorId,
        santriId: params.santriId,
        bulan: params.bulan,
        snapshotTahfizh,
        catatanMusyrif: params.catatanMusyrif?.trim() || "Santri istiqomah dalam mengikuti halaqoh tahfizh dan murojaah.",
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
      details: { kodeLaporan, bulan: params.bulan, santri: santri.nama },
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
 * Server Action: Buka Tautan WhatsApp Laporan Donatur (Honest Dispatcher)
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

    // Format pesan WhatsApp resmi STQ
    const pesanWA = `*LAPORAN PERKEMBANGAN TAHFIZH SANTRI*
*${INSTITUTION_CONFIG.pesantrenName.toUpperCase()}*
Periode: ${laporan.bulan}

Kepada Yth. Bapak/Ibu Donatur/Orang Tua Asuh:
*${laporan.sponsor.nama}*

Berikut ringkasan capaian ananda asuh:
• Nama Santri: *${laporan.santri.nama}* (${laporan.santri.nis})
• Kelas: ${laporan.santri.kelas}
• Capaian Teruji: *${snapshot.capaianJuz} Juz Selesai*
• Setoran Terakhir: ${snapshot.setoranTerakhir}
• Pembina: ${snapshot.pembina}

*Catatan Musyrif:*
_"${laporan.catatanMusyrif || "Santri istiqomah dalam murojaah dan tahsin."}"_

Jazakumullah Khairan Katsiran atas dukungan dan doa Bapak/Ibu. Semoga menjadi amal jariyah yang terus mengalir pahalanya.

_${INSTITUTION_CONFIG.pesantrenName}_`;

    const formattedPhone = formatIndonesianPhone(laporan.sponsor.noHp);
    const waLink = formattedPhone ? generateWALink(formattedPhone, pesanWA) : "";

    await recordAuditLog({
      userId: session.userId,
      action: "PREPARE_WA_LAPORAN",
      entity: "LaporanBulananSponsor",
      entityId: laporan.id,
      details: {
        nomorTujuan: formattedPhone || "TIDAK_VALID",
        santri: laporan.santri.nama,
      },
    });

    return {
      success: true,
      message: formattedPhone
        ? `Laporan santri asuh siap dikirimkan ke ${laporan.sponsor.nama} via WhatsApp.`
        : `Nomor telepon donatur belum valid. Mohon periksa kembali nomor WhatsApp donatur.`,
      pesanPreview: pesanWA,
      waLink,
      phone: formattedPhone,
    };
  } catch (error) {
    console.error("Gagal menyiapkan WhatsApp:", error);
    return { success: false, message: "Gagal memproses pesan WhatsApp laporan donatur." };
  }
}

/**
 * Server Action: Mengambil daftar Orang Tua Asuh
 */
export async function getDaftarSponsorAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu.", data: [] };
  }

  if (session.role !== "ADM" && session.role !== "KS") {
    return {
      success: false,
      message: "Akses Ditolak: Hanya Admin (ADM) dan Mudir (KS) yang dapat mengakses daftar Orang Tua Asuh.",
      data: [],
    };
  }

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
