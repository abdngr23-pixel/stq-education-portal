"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { StatusAbsensi, KategoriCapaian } from "@prisma/client";
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

  // 1. Verifikasi Wewenang: MK, MT, PH, OSDA, KS, ADM atau Petugas Presensi Putri (ST berstatus perempuan)
  const isStaffPresensi = ["MK", "MT", "PH", "OSDA", "KS", "ADM"].includes(session.role);
  let isPetugasPutri = Boolean(session.isPetugasPresensiPutri);

  if (!isPetugasPutri && session.role === "ST" && session.userId && !session.userId.startsWith("user_")) {
    try {
      const userDb = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { isPetugasPresensiPutri: true, santri: { select: { jenisKelamin: true } } },
      });
      if (userDb?.isPetugasPresensiPutri && userDb?.santri?.jenisKelamin === "P") {
        isPetugasPutri = true;
      }
    } catch {
      // DB offline fallback
    }
  }

  if (!isStaffPresensi && !isPetugasPutri) {
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

  // Proteksi Fail-Closed Petugas Presensi Putri: HANYA santriwati (P), tolak keras jika ada santri ikhwan (L)
  if (isPetugasPutri && !isStaffPresensi) {
    const santriTargets = await prisma.santri.findMany({
      where: { id: { in: items.map((i) => i.santriId) } },
      select: { id: true, nama: true, jenisKelamin: true },
    });
    const santriLakiLaki = santriTargets.filter((s) => s.jenisKelamin === "L");
    if (santriLakiLaki.length > 0) {
      return {
        success: false,
        message: `Akses Ditolak: Petugas Presensi Putri hanya berwenang mencatat presensi santriwati (perempuan). Ditemukan santri laki-laki (${santriLakiLaki.map((s) => s.nama).join(", ")}).`,
      };
    }
  }

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

export interface MutabaahHarianItem {
  santriId: string;
  shalatBerjamaah: boolean;
  qiyamulLail: boolean;
  rawatib: boolean;
  dhuha: boolean;
  dzikirPagiPetang: boolean;
  tilawahMandiri: boolean;
  literasiHalaman: number;
  catatan?: string;
}

export interface CatatMutabaahHarianInput {
  tanggal?: string;
  items: MutabaahHarianItem[];
}

/**
 * Server Action: Catat Mutaba'ah Harian Santri (7 Komponen)
 * Batch transaksional, fail-closed authorization, dukungan angka halaman literasi
 */
export async function catatMutabaahHarianAction(input: CatatMutabaahHarianInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // Wewenang: MT, MK, PH, Petugas Putri, KS, ADM (fail-closed)
  const isStaffPresensi = ["MK", "MT", "PH", "OSDA", "KS", "ADM"].includes(session.role);
  let isPetugasPutri = Boolean(session.isPetugasPresensiPutri);

  if (!isPetugasPutri && session.role === "ST" && session.userId && !session.userId.startsWith("user_")) {
    try {
      const userDb = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { isPetugasPresensiPutri: true, santri: { select: { jenisKelamin: true } } },
      });
      if (userDb?.isPetugasPresensiPutri && userDb?.santri?.jenisKelamin === "P") {
        isPetugasPutri = true;
      }
    } catch {
      // DB offline fallback
    }
  }

  if (!isStaffPresensi && !isPetugasPutri) {
    return {
      success: false,
      message: `Akses Ditolak: Peran '${session.role}' tidak memiliki kewenangan mencatat Mutaba'ah Harian.`,
    };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, message: "Tidak ada data santri yang dikirimkan." };
  }

  // Fail-closed untuk Petugas Presensi Putri: hanya boleh santriwati
  if (isPetugasPutri && !isStaffPresensi) {
    const santriTargets = await prisma.santri.findMany({
      where: { id: { in: input.items.map((i) => i.santriId) } },
      select: { id: true, nama: true, jenisKelamin: true },
    });
    const santriLakiLaki = santriTargets.filter((s) => s.jenisKelamin === "L");
    if (santriLakiLaki.length > 0) {
      return {
        success: false,
        message: `Akses Ditolak: Petugas Presensi Putri hanya berwenang mencatat santriwati (perempuan).`,
      };
    }
  }

  const tanggalStr = input.tanggal || getTodayWITADateString();
  const targetDate = parseWITADate(tanggalStr);

  try {
    const dicatatOleh = session.username || session.name || "Staf Presensi";

    // Transactional Batch Save
    const results = await prisma.$transaction(async (tx) => {
      const createdRecords = [];

      for (const item of input.items) {
        // 1. Qiyamul Lail / Tahajjud
        const tahajjudRecord = await tx.catatanMutabaahHarian.upsert({
          where: {
            santriId_kategori_tanggal: {
              santriId: item.santriId,
              kategori: KategoriCapaian.SHOLAT_TAHAJJUD,
              tanggal: targetDate,
            },
          },
          update: {
            nilai: item.qiyamulLail ? 1 : 0,
            catatan: `[Qiyamul Lail: ${item.qiyamulLail ? "Ya" : "Tidak"}] [Shalat Berjamaah: ${item.shalatBerjamaah ? "Ya" : "Tidak"}] [Rawatib: ${item.rawatib ? "Ya" : "Tidak"}]`,
            dicatatOleh,
          },
          create: {
            santriId: item.santriId,
            kategori: KategoriCapaian.SHOLAT_TAHAJJUD,
            tanggal: targetDate,
            nilai: item.qiyamulLail ? 1 : 0,
            catatan: `[Qiyamul Lail: ${item.qiyamulLail ? "Ya" : "Tidak"}] [Shalat Berjamaah: ${item.shalatBerjamaah ? "Ya" : "Tidak"}] [Rawatib: ${item.rawatib ? "Ya" : "Tidak"}]`,
            dicatatOleh,
          },
        });
        createdRecords.push(tahajjudRecord);

        // 2. Sholat Dhuha
        const dhuhaRecord = await tx.catatanMutabaahHarian.upsert({
          where: {
            santriId_kategori_tanggal: {
              santriId: item.santriId,
              kategori: KategoriCapaian.SHOLAT_DHUHA,
              tanggal: targetDate,
            },
          },
          update: {
            nilai: item.dhuha ? 1 : 0,
            catatan: `[Dhuha: ${item.dhuha ? "Ya" : "Tidak"}] [Dzikir: ${item.dzikirPagiPetang ? "Ya" : "Tidak"}] [Tilawah: ${item.tilawahMandiri ? "Ya" : "Tidak"}]`,
            dicatatOleh,
          },
          create: {
            santriId: item.santriId,
            kategori: KategoriCapaian.SHOLAT_DHUHA,
            tanggal: targetDate,
            nilai: item.dhuha ? 1 : 0,
            catatan: `[Dhuha: ${item.dhuha ? "Ya" : "Tidak"}] [Dzikir: ${item.dzikirPagiPetang ? "Ya" : "Tidak"}] [Tilawah: ${item.tilawahMandiri ? "Ya" : "Tidak"}]`,
            dicatatOleh,
          },
        });
        createdRecords.push(dhuhaRecord);

        // 3. Literasi Kitab / Buku (Halaman)
        const literasiRecord = await tx.catatanMutabaahHarian.upsert({
          where: {
            santriId_kategori_tanggal: {
              santriId: item.santriId,
              kategori: KategoriCapaian.LITERASI,
              tanggal: targetDate,
            },
          },
          update: {
            nilai: item.literasiHalaman || 0,
            catatan: item.catatan || null,
            dicatatOleh,
          },
          create: {
            santriId: item.santriId,
            kategori: KategoriCapaian.LITERASI,
            tanggal: targetDate,
            nilai: item.literasiHalaman || 0,
            catatan: item.catatan || null,
            dicatatOleh,
          },
        });
        createdRecords.push(literasiRecord);
      }

      return createdRecords;
    });

    await recordAuditLog({
      userId: session.userId,
      action: "CATAT_MUTABAAH_HARIAN",
      entity: "CatatanMutabaahHarian",
      entityId: `${tanggalStr}-${input.items.length}_santri`,
      details: {
        tanggal: tanggalStr,
        totalSantri: input.items.length,
        totalRecords: results.length,
      },
    });

    return {
      success: true,
      message: `Mutaba'ah Harian untuk ${input.items.length} santri berhasil disimpan.`,
      data: { totalDiproses: input.items.length, totalRecords: results.length },
    };
  } catch (error) {
    console.error("Gagal mencatat mutabaah harian:", error);
    return { success: false, message: "Terjadi kesalahan saat menyimpan mutaba'ah harian ke basis data." };
  }
}

/**
 * Mengambil rekap catatan Mutaba'ah Harian pada tanggal tertentu
 */
export async function getMutabaahHarianListAction(tanggalStr?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir.", data: [] };
  }

  const dateStr = tanggalStr || getTodayWITADateString();
  const targetDate = parseWITADate(dateStr);

  try {
    const list = await prisma.catatanMutabaahHarian.findMany({
      where: {
        tanggal: targetDate,
      },
      include: {
        santri: {
          select: { id: true, nama: true, nis: true, kelas: true, halaqohId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil catatan mutabaah:", error);
    return { success: false, data: [] };
  }
}
