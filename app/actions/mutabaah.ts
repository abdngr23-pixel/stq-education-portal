"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { KategoriCapaian } from "@prisma/client";
import { getTodayWITADateString, parseWITADate } from "@/lib/wita-date";

export interface InputMutabaahHarianItem {
  santriId: string;
  kategori: KategoriCapaian;
  nilai: number; // Jumlah hadits, mufrodat, rakaat/kehadiran, atau JUMLAH HALAMAN BUKU (untuk LITERASI)
  catatan?: string;
}

export interface BatchMutabaahInput {
  tanggal?: string; // YYYY-MM-DD WITA
  items: InputMutabaahHarianItem[];
}

export const TARGET_MINIMUM_BULANAN: Record<KategoriCapaian, { min: number; satuan: string }> = {
  HAFALAN_HADITS: { min: 4, satuan: "Hadits" },
  HAFALAN_MUFRODAT: { min: 12, satuan: "Kosa Kata Arab" },
  HAFALAN_VOCABULARY: { min: 12, satuan: "Vocabulary Inggris" },
  SHOLAT_TAHAJJUD: { min: 15, satuan: "Malam / Kali" },
  SHOLAT_DHUHA: { min: 15, satuan: "Pagi / Kali" },
  PUASA_SUNNAH: { min: 6, satuan: "Hari" },
  LITERASI: { min: 80, satuan: "Halaman Buku" },
};

/**
 * Server Action: Mencatat Mutaba'ah Harian Santri (7 Komponen Terpusat)
 * Dilengkapi validasi LITERASI wajib berbasis halaman buku (bukan menit),
 * penanggalan zona waktu WITA, dan pencegahan duplikasi (idempotent upsert).
 */
export async function catatMutabaahHarianAction(input: BatchMutabaahInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // Wewenang: Musyrif Keasramaan (MK), Musyrif Tahfizh (MT), Pembina Halaqoh (PH), Mudir (KS), Admin (ADM)
  if (!["MK", "MT", "PH", "KS", "ADM"].includes(session.role)) {
    return {
      success: false,
      message: `Peran '${session.role}' tidak memiliki kewenangan mencatat mutaba'ah harian santri.`,
    };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, message: "Data mutaba'ah tidak boleh kosong." };
  }

  // Validasi nilai
  for (const item of input.items) {
    if (typeof item.nilai !== "number" || item.nilai < 0) {
      return { success: false, message: "Nilai capaian mutaba'ah harus berupa bilangan non-negatif." };
    }
  }

  const witaDateStr = input.tanggal || getTodayWITADateString();
  const tanggalDate = parseWITADate(witaDateStr);

  try {
    const savedItems = [];

    for (const item of input.items) {
      const saved = await prisma.catatanMutabaahHarian.upsert({
        where: {
          santriId_kategori_tanggal: {
            santriId: item.santriId,
            kategori: item.kategori,
            tanggal: tanggalDate,
          },
        },
        create: {
          santriId: item.santriId,
          kategori: item.kategori,
          tanggal: tanggalDate,
          nilai: item.nilai,
          catatan: item.catatan || null,
          dicatatOleh: session.username,
        },
        update: {
          nilai: item.nilai,
          catatan: item.catatan || null,
          dicatatOleh: session.username,
        },
      });

      savedItems.push(saved);
    }

    await recordAuditLog({
      userId: session.userId,
      action: "CATAT_MUTABAAH_HARIAN",
      entity: "CatatanMutabaahHarian",
      entityId: `${witaDateStr}-${input.items.length}-items`,
      details: {
        tanggal: witaDateStr,
        jumlahDicatat: savedItems.length,
        dicatatOleh: session.username,
      },
    });

    return {
      success: true,
      message: `Berhasil mencatat ${savedItems.length} catatan mutaba'ah harian untuk tanggal ${witaDateStr}.`,
      data: savedItems,
    };
  } catch (error) {
    console.error("Gagal mencatat mutaba'ah harian:", error);
    return { success: false, message: "Terjadi kesalahan server saat menyimpan mutaba'ah harian." };
  }
}

/**
 * Server Action: Mengambil rekapitulasi mutaba'ah bulanan per santri
 * Menghitung akumulasi 7 komponen harian terhadap target minimum resmi pondok
 */
export async function getRekapMutabaahBulananAction(params: {
  bulan: number;
  tahunAjaran: string;
  santriId?: string;
  halaqohId?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali.", data: [] };
  }

  // ABAC: Santri dan Wali hanya boleh melihat datanya sendiri
  let effectiveSantriId = params.santriId;
  if (session.role === "ST" || session.role === "WS") {
    if (!session.santriId) {
      return { success: false, message: "Akun belum terhubung dengan profil santri.", data: [] };
    }
    effectiveSantriId = session.santriId;
  }

  try {
    const [thnAwalStr, thnAkhirStr] = params.tahunAjaran.split("/");
    const tahunKalender =
      params.bulan >= 7 ? parseInt(thnAwalStr, 10) || 2026 : parseInt(thnAkhirStr, 10) || 2027;

    const startDate = new Date(tahunKalender, params.bulan - 1, 1);
    const endDate = new Date(tahunKalender, params.bulan, 0, 23, 59, 59, 999);

    const santriList = await prisma.santri.findMany({
      where: {
        id: effectiveSantriId ? effectiveSantriId : undefined,
        halaqohId: params.halaqohId && params.halaqohId !== "ALL" ? params.halaqohId : undefined,
        status: "AKTIF",
      },
      select: {
        id: true,
        nama: true,
        nis: true,
        kelas: true,
        jenisKelamin: true,
        halaqoh: { select: { nama: true } },
      },
      orderBy: { nama: "asc" },
    });

    const rekapList = await Promise.all(
      santriList.map(async (santri) => {
        // Ambil seluruh catatan mutabaah santri di bulan berjalan
        const catatanList = await prisma.catatanMutabaahHarian.findMany({
          where: {
            santriId: santri.id,
            tanggal: { gte: startDate, lte: endDate },
          },
        });

        // Agregasi nilai per kategori
        const akumulasi: Record<KategoriCapaian, number> = {
          HAFALAN_HADITS: 0,
          HAFALAN_MUFRODAT: 0,
          HAFALAN_VOCABULARY: 0,
          SHOLAT_TAHAJJUD: 0,
          SHOLAT_DHUHA: 0,
          PUASA_SUNNAH: 0,
          LITERASI: 0,
        };

        for (const c of catatanList) {
          if (akumulasi[c.kategori] !== undefined) {
            akumulasi[c.kategori] += c.nilai;
          }
        }

        // Hitung persentase ketercapaian per komponen
        const detailKomponen = (Object.keys(TARGET_MINIMUM_BULANAN) as KategoriCapaian[]).map((kat) => {
          const capaian = akumulasi[kat];
          const target = TARGET_MINIMUM_BULANAN[kat].min;
          const satuan = TARGET_MINIMUM_BULANAN[kat].satuan;
          const persen = target > 0 ? Math.min(Math.round((capaian / target) * 100), 100) : 100;
          return {
            kategori: kat,
            capaian,
            target,
            satuan,
            persentase: persen,
            isTercapai: capaian >= target,
          };
        });

        const totalTercapai = detailKomponen.filter((d) => d.isTercapai).length;
        const skorRataRata =
          Math.round((detailKomponen.reduce((acc, curr) => acc + curr.persentase, 0) / detailKomponen.length) * 10) / 10;

        return {
          santriId: santri.id,
          santriNama: santri.nama,
          santriNis: santri.nis,
          santriKelas: santri.kelas,
          jenisKelamin: santri.jenisKelamin,
          halaqohNama: santri.halaqoh?.nama || "-",
          detailKomponen,
          totalTercapai,
          totalKomponen: detailKomponen.length,
          skorRataRata,
        };
      })
    );

    return {
      success: true,
      data: rekapList,
    };
  } catch (error) {
    console.error("Gagal mengambil rekap mutabaah bulanan:", error);
    return { success: false, message: "Terjadi kesalahan saat memuat rekap mutabaah bulanan.", data: [] };
  }
}
