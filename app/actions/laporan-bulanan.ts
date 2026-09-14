"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import {
  KategoriCapaian,
  JenisSetoran,
  NilaiSetoran,
  JenisUjiHafalan,
} from "@prisma/client";
import {
  getPekanDariTanggal,
  hitungCapaianSabaq,
  hitungKepatuhanFrekuensi,
  hitungTargetMufar,
  evaluasiCapaianNonTahfizh,
  generateRingkasanTasmiSimaan,
  TARGET_MIN_KOMPONEN,
} from "@/lib/laporan-bulanan";

export interface TargetSantriInput {
  santriId: string;
  jenis: JenisSetoran;
  targetPekanan: number;
  targetBulanan: number;
  ambangKepatuhan?: number;
  bulan: number;
  tahunAjaran: string;
}

export interface CapaianPekananInput {
  santriId: string;
  kategori: KategoriCapaian;
  bulan: number;
  tahunAjaran: string;
  hbl?: number;
  pekan1?: number;
  pekan2?: number;
  pekan3?: number;
  pekan4?: number;
  catatan?: string;
}

export interface RecordTasmiSimaanInput {
  santriId: string;
  jenis: JenisUjiHafalan;
  juz: number;
  halaman?: number;
  nilai: number;
  predikat: NilaiSetoran;
  catatan?: string;
}

/**
 * Helper: Ambil jumlah halaman dari catatan atau default 1 hlm untuk Sabaq
 */
function extractHalamanFromSetoran(catatan: string | null | undefined): number {
  if (!catatan) return 1;
  const match = catatan.match(/(?:hlm|halaman)[:\s]*(\d+)/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    return isNaN(val) || val <= 0 ? 1 : val;
  }
  return 1;
}

/**
 * Server Action: Mengambil data rekap laporan bulanan halaqoh komprehensif (Format Excel DUC)
 * Mengimplementasikan ABAC Ketat:
 * - MT & PH: Dropdown & query DIKUNCI ke halaqoh milik sendiri. Input halaqohId dari client DIABAIKAN.
 * - KS, ADM, YAY: Boleh memilih halaqoh manapun, termasuk opsi "ALL" (Semua Halaqoh / Rekap Gabungan).
 */
export async function getLaporanBulananHalaqohAction(
  halaqohId: string,
  bulan: number,
  tahunAjaran: string
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
    }

    // 1. ABAC Role Enforcement
    let effectiveHalaqohId = halaqohId || "ALL";

    const isKabidTahfidz = Boolean(session.isKepalaBidangTahfidz);

    if (["KS", "ADM", "YAY"].includes(session.role) || isKabidTahfidz) {
      // KS, ADM, YAY, dan Kepala Bidang Tahfidz: Memiliki otoritas manajerial untuk melihat halaqoh manapun atau agregasi seluruh halaqoh
      effectiveHalaqohId = halaqohId || "ALL";
    } else if (session.role === "MT" || session.role === "PH") {
      // Role Musyrif/Pembina biasa (selain Kabid): PAKSA selalu memakai halaqoh milik sendiri (Fail-closed)
      let staffHalaqohId: string | null = null;

      if (session.staffId) {
        const h = await prisma.halaqoh.findFirst({
          where: { pembinaId: session.staffId },
          select: { id: true, halaqohCode: true },
        });
        if (h) staffHalaqohId = h.id || h.halaqohCode;
      }

      if (!staffHalaqohId) {
        return {
          success: false,
          message: "Akun belum ditugaskan ke halaqoh mana pun. Hubungi Admin.",
        };
      }

      effectiveHalaqohId = staffHalaqohId;
    } else {
      effectiveHalaqohId = halaqohId || "ALL";
    }

    // 2. Tentukan range tanggal bulan
    const [thnAwalStr, thnAkhirStr] = tahunAjaran.split("/");
    const tahunKalender =
      bulan >= 7 ? parseInt(thnAwalStr, 10) || 2026 : parseInt(thnAkhirStr, 10) || 2027;

    const startDate = new Date(tahunKalender, bulan - 1, 1);
    const endDate = new Date(tahunKalender, bulan, 0, 23, 59, 59, 999);

    // 3. Query ke database PostgreSQL
    if (effectiveHalaqohId.toUpperCase() === "ALL") {
      // Mode Agregasi: Seluruh Halaqoh
      const allSantri = await prisma.santri.findMany({
        where: { status: "AKTIF" },
        include: {
          halaqoh: { include: { pembina: true } },
        },
        orderBy: [{ halaqoh: { nama: "asc" } }, { nama: "asc" }],
      });

      const rekapSantri = await Promise.all(
        allSantri.map(async (santri) => {
          const targets = await prisma.targetSantri.findMany({
            where: { santriId: santri.id, bulan, tahunAjaran },
          });
          const targetSabaqRecord = targets.find((t) => t.jenis === "SABAQ");
          const targetSabqiRecord = targets.find((t) => t.jenis === "SABQI");
          const targetManzilRecord = targets.find((t) => t.jenis === "MANZIL");
          const targetMufarRecord = targets.find((t) => t.jenis === "MUFAR");

          const targetSabaq = targetSabaqRecord?.targetBulanan ?? null;
          const targetSabqi = targetSabqiRecord?.targetBulanan ?? null;
          const targetManzil = targetManzilRecord?.targetBulanan ?? null;
          const targetMufar = targetMufarRecord?.targetBulanan ?? null;

          const setoranList = await prisma.setoranTahfizh.findMany({
            where: {
              santriId: santri.id,
              tanggal: { gte: startDate, lte: endDate },
              status: { not: "DIBATALKAN" },
            },
            orderBy: { tanggal: "asc" },
          });

          const sabaqPages = { p1: 0, p2: 0, p3: 0, p4: 0 };
          const sabqiFreq = { p1: 0, p2: 0, p3: 0, p4: 0 };
          const manzilFreq = { p1: 0, p2: 0, p3: 0, p4: 0 };
          const mufarFreq = { p1: 0, p2: 0, p3: 0, p4: 0 };

          setoranList.forEach((s) => {
            const pekan = getPekanDariTanggal(s.tanggal);
            const pKey = `p${pekan}` as const;
            if (s.jenis === "SABAQ") {
              sabaqPages[pKey] += s.jumlahHalaman || extractHalamanFromSetoran(s.catatan);
            } else if (s.jenis === "SABQI") {
              sabqiFreq[pKey] += 1;
            } else if (s.jenis === "MANZIL") {
              manzilFreq[pKey] += 1;
            } else if (s.jenis === "MUFAR") {
              mufarFreq[pKey] += 1;
            }
          });

          const modalAwal = Number(santri.modalHafalanAwalHalaman) || 0;
          const baselineDate = santri.tanggalBaselineTahfizh
            ? new Date(santri.tanggalBaselineTahfizh)
            : null;

          const priorSabaqWhere: {
            santriId: string;
            jenis: JenisSetoran;
            status: { not: string };
            tanggal: { gte?: Date; lt: Date };
          } = {
            santriId: santri.id,
            jenis: "SABAQ",
            status: { not: "DIBATALKAN" },
            tanggal: { lt: startDate },
          };
          if (baselineDate) {
            priorSabaqWhere.tanggal = { gte: baselineDate, lt: startDate };
          }

          const priorSabaq = await prisma.setoranTahfizh.aggregate({
            where: priorSabaqWhere,
            _sum: { jumlahHalaman: true },
          });
          const modalAwalHalaman = modalAwal + (priorSabaq._sum.jumlahHalaman || 0);

          const rekapSabaq = hitungCapaianSabaq(sabaqPages, targetSabaq, modalAwalHalaman);
          const rekapSabqi = hitungKepatuhanFrekuensi(sabqiFreq, targetSabqi, 90.0);
          const rekapManzil = hitungKepatuhanFrekuensi(manzilFreq, targetManzil, 90.0);
          const totalJuzSantri = rekapSabaq.konversiAkumulasi.juz || 1;
          const targetMufarJuzHarian = targetMufar ? hitungTargetMufar(totalJuzSantri) : 0;
          const rekapMufar = hitungKepatuhanFrekuensi(mufarFreq, targetMufar, 90.0);

          const capaianNonTahfizh = await prisma.capaianBulanan.findMany({
            where: { santriId: santri.id, bulan, tahunAjaran },
          });

          const listKategori: KategoriCapaian[] = [
            "HAFALAN_HADITS",
            "HAFALAN_MUFRODAT",
            "HAFALAN_VOCABULARY",
            "SHOLAT_TAHAJJUD",
            "SHOLAT_DHUHA",
            "PUASA_SUNNAH",
            "LITERASI",
          ];

          const rekapNonTahfizh = listKategori.map((kategori) => {
            const record = capaianNonTahfizh.find((c) => c.kategori === kategori);
            const hbl = record?.hbl || 0;
            const p1 = record?.pekan1 || 0;
            const p2 = record?.pekan2 || 0;
            const p3 = record?.pekan3 || 0;
            const p4 = record?.pekan4 || 0;
            const targetMin = record?.targetMin || TARGET_MIN_KOMPONEN[kategori].target;
            const evaluasi = evaluasiCapaianNonTahfizh(kategori, hbl, { p1, p2, p3, p4 }, targetMin);

            return {
              kategori,
              label: TARGET_MIN_KOMPONEN[kategori].label,
              satuan: TARGET_MIN_KOMPONEN[kategori].satuan,
              p1,
              p2,
              p3,
              p4,
              ...evaluasi,
            };
          });

          const riwayatTasmiSimaan = await prisma.tasmiSimaan.findMany({
            where: { santriId: santri.id, tanggal: { gte: startDate, lte: endDate } },
            include: { musyrif: true },
            orderBy: { tanggal: "desc" },
          });
          const ringkasanTasmiSimaan = generateRingkasanTasmiSimaan(riwayatTasmiSimaan);

          return {
            santri: {
              id: santri.id,
              nis: santri.nis,
              nama: santri.nama,
              kelas: santri.kelas,
              halaqoh: santri.halaqoh?.nama || "Halaqoh",
            },
            tahfizh: {
              sabaq: {
                targetBulanan: targetSabaq,
                targetLabel: targetSabaq !== null ? `${targetSabaq} Hlm` : "Target belum ditetapkan",
                pekan: sabaqPages,
                ...rekapSabaq,
              },
              sabqi: {
                targetBulanan: targetSabqi,
                targetLabel: targetSabqi !== null ? `${targetSabqi} Kali` : "Target belum ditetapkan",
                pekan: sabqiFreq,
                ...rekapSabqi,
              },
              manzil: {
                targetBulanan: targetManzil,
                targetLabel: targetManzil !== null ? `${targetManzil} Kali` : "Target belum ditetapkan",
                pekan: manzilFreq,
                ...rekapManzil,
              },
              mufar: {
                targetBulanan: targetMufar,
                targetHarianJuz: targetMufarJuzHarian,
                targetLabel: targetMufar !== null ? `${targetMufarJuzHarian} Juz/hari` : "Target belum ditetapkan",
                pekan: mufarFreq,
                ...rekapMufar,
              },
            },
            nonTahfizh: rekapNonTahfizh,
            tasmiSimaan: { riwayat: riwayatTasmiSimaan, ...ringkasanTasmiSimaan },
          };
        })
      );

      return {
        success: true,
        data: {
          halaqoh: {
            id: "ALL",
            nama: "Semua Halaqoh (Rekap Gabungan Seluruh Pesantren)",
            pembina: "Seluruh Pembina & Musyrif STQ DUC",
            tahunAjaran,
          },
          periode: { bulan, tahunAjaran, tahunKalender },
          rekapSantri,
        },
      };
    } else {
      // Mode Spesifik Halaqoh
      const halaqoh = await prisma.halaqoh.findFirst({
        where: {
          OR: [{ id: effectiveHalaqohId }, { halaqohCode: effectiveHalaqohId }],
        },
        include: {
          pembina: true,
          santriList: {
            where: { status: "AKTIF" },
            orderBy: { nama: "asc" },
          },
        },
      });

      if (!halaqoh) {
        return {
          success: false,
          message: "Data halaqoh tidak ditemukan.",
          error: "Halaqoh tidak ditemukan",
          data: null,
        };
      }

      const rekapSantri = await Promise.all(
        halaqoh.santriList.map(async (santri) => {
          const targets = await prisma.targetSantri.findMany({
            where: { santriId: santri.id, bulan, tahunAjaran },
          });
          const targetSabaqRecord = targets.find((t) => t.jenis === "SABAQ");
          const targetSabqiRecord = targets.find((t) => t.jenis === "SABQI");
          const targetManzilRecord = targets.find((t) => t.jenis === "MANZIL");
          const targetMufarRecord = targets.find((t) => t.jenis === "MUFAR");

          const targetSabaq = targetSabaqRecord?.targetBulanan ?? null;
          const targetSabqi = targetSabqiRecord?.targetBulanan ?? null;
          const targetManzil = targetManzilRecord?.targetBulanan ?? null;
          const targetMufar = targetMufarRecord?.targetBulanan ?? null;

          const setoranList = await prisma.setoranTahfizh.findMany({
            where: {
              santriId: santri.id,
              tanggal: { gte: startDate, lte: endDate },
              status: { not: "DIBATALKAN" },
            },
            orderBy: { tanggal: "asc" },
          });

          const sabaqPages = { p1: 0, p2: 0, p3: 0, p4: 0 };
          const sabqiFreq = { p1: 0, p2: 0, p3: 0, p4: 0 };
          const manzilFreq = { p1: 0, p2: 0, p3: 0, p4: 0 };
          const mufarFreq = { p1: 0, p2: 0, p3: 0, p4: 0 };

          setoranList.forEach((s) => {
            const pekan = getPekanDariTanggal(s.tanggal);
            const pKey = `p${pekan}` as const;
            if (s.jenis === "SABAQ") {
              sabaqPages[pKey] += s.jumlahHalaman || extractHalamanFromSetoran(s.catatan);
            } else if (s.jenis === "SABQI") {
              sabqiFreq[pKey] += 1;
            } else if (s.jenis === "MANZIL") {
              manzilFreq[pKey] += 1;
            } else if (s.jenis === "MUFAR") {
              mufarFreq[pKey] += 1;
            }
          });

          const modalAwal = Number(santri.modalHafalanAwalHalaman) || 0;
          const baselineDate = santri.tanggalBaselineTahfizh
            ? new Date(santri.tanggalBaselineTahfizh)
            : null;

          const priorSabaqWhere: {
            santriId: string;
            jenis: JenisSetoran;
            status: { not: string };
            tanggal: { gte?: Date; lt: Date };
          } = {
            santriId: santri.id,
            jenis: "SABAQ",
            status: { not: "DIBATALKAN" },
            tanggal: { lt: startDate },
          };
          if (baselineDate) {
            priorSabaqWhere.tanggal = { gte: baselineDate, lt: startDate };
          }

          const priorSabaq = await prisma.setoranTahfizh.aggregate({
            where: priorSabaqWhere,
            _sum: { jumlahHalaman: true },
          });
          const modalAwalHalaman = modalAwal + (priorSabaq._sum.jumlahHalaman || 0);

          const rekapSabaq = hitungCapaianSabaq(sabaqPages, targetSabaq, modalAwalHalaman);
          const rekapSabqi = hitungKepatuhanFrekuensi(sabqiFreq, targetSabqi, 90.0);
          const rekapManzil = hitungKepatuhanFrekuensi(manzilFreq, targetManzil, 90.0);
          const totalJuzSantri = rekapSabaq.konversiAkumulasi.juz || 1;
          const targetMufarJuzHarian = targetMufar ? hitungTargetMufar(totalJuzSantri) : 0;
          const rekapMufar = hitungKepatuhanFrekuensi(mufarFreq, targetMufar, 90.0);

          const capaianNonTahfizh = await prisma.capaianBulanan.findMany({
            where: { santriId: santri.id, bulan, tahunAjaran },
          });

          const listKategori: KategoriCapaian[] = [
            "HAFALAN_HADITS",
            "HAFALAN_MUFRODAT",
            "HAFALAN_VOCABULARY",
            "SHOLAT_TAHAJJUD",
            "SHOLAT_DHUHA",
            "PUASA_SUNNAH",
            "LITERASI",
          ];

          const rekapNonTahfizh = listKategori.map((kategori) => {
            const record = capaianNonTahfizh.find((c) => c.kategori === kategori);
            const hbl = record?.hbl || 0;
            const p1 = record?.pekan1 || 0;
            const p2 = record?.pekan2 || 0;
            const p3 = record?.pekan3 || 0;
            const p4 = record?.pekan4 || 0;
            const targetMin = record?.targetMin || TARGET_MIN_KOMPONEN[kategori].target;
            const evaluasi = evaluasiCapaianNonTahfizh(kategori, hbl, { p1, p2, p3, p4 }, targetMin);

            return {
              kategori,
              label: TARGET_MIN_KOMPONEN[kategori].label,
              satuan: TARGET_MIN_KOMPONEN[kategori].satuan,
              p1,
              p2,
              p3,
              p4,
              ...evaluasi,
            };
          });

          const riwayatTasmiSimaan = await prisma.tasmiSimaan.findMany({
            where: { santriId: santri.id, tanggal: { gte: startDate, lte: endDate } },
            include: { musyrif: true },
            orderBy: { tanggal: "desc" },
          });
          const ringkasanTasmiSimaan = generateRingkasanTasmiSimaan(riwayatTasmiSimaan);

          return {
            santri: {
              id: santri.id,
              nis: santri.nis,
              nama: santri.nama,
              kelas: santri.kelas,
              halaqoh: halaqoh.nama,
            },
            tahfizh: {
              sabaq: {
                targetBulanan: targetSabaq,
                targetLabel: targetSabaq !== null ? `${targetSabaq} Hlm` : "Target belum ditetapkan",
                pekan: sabaqPages,
                ...rekapSabaq,
              },
              sabqi: {
                targetBulanan: targetSabqi,
                targetLabel: targetSabqi !== null ? `${targetSabqi} Kali` : "Target belum ditetapkan",
                pekan: sabqiFreq,
                ...rekapSabqi,
              },
              manzil: {
                targetBulanan: targetManzil,
                targetLabel: targetManzil !== null ? `${targetManzil} Kali` : "Target belum ditetapkan",
                pekan: manzilFreq,
                ...rekapManzil,
              },
              mufar: {
                targetBulanan: targetMufar,
                targetHarianJuz: targetMufarJuzHarian,
                targetLabel: targetMufar !== null ? `${targetMufarJuzHarian} Juz/hari` : "Target belum ditetapkan",
                pekan: mufarFreq,
                ...rekapMufar,
              },
            },
            nonTahfizh: rekapNonTahfizh,
            tasmiSimaan: { riwayat: riwayatTasmiSimaan, ...ringkasanTasmiSimaan },
          };
        })
      );

      return {
        success: true,
        data: {
          halaqoh: {
            id: halaqoh.id,
            nama: halaqoh.nama,
            pembina: halaqoh.pembina?.nama || "Belum ditentukan",
            tahunAjaran: halaqoh.tahunAjaran,
          },
          periode: { bulan, tahunAjaran, tahunKalender },
          rekapSantri,
        },
      };
    }
  } catch (error) {
    console.error("Gagal memuat rekap laporan bulanan halaqoh:", error);
    return {
      success: false,
      message: "Gagal memuat rekap laporan bulanan halaqoh dari pangkalan data.",
      error: "Gagal memuat data",
      data: null,
    };
  }
}

/**
 * Server Action: Atur Target Santri (Sabaq, Sabqi, Manzil, Mufar)
 */
export async function upsertTargetSantriAction(input: TargetSantriInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["MT", "PH", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: "Anda tidak memiliki wewenang mengatur target santri." };
  }

  // ABAC: MT dan PH hanya berwenang mengatur target santri binaannya (kecuali Kepala Bidang Tahfidz)
  if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { success: false, message: "Profil staf pembina Anda belum terhubung." };
    }
    if (!session.isKepalaBidangTahfidz) {
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: input.santriId } },
        },
      });
      if (!isBinaan) {
        return {
          success: false,
          message: "Akses Ditolak: Anda hanya berwenang mengatur target santri di dalam halaqoh binaan Anda.",
        };
      }
    }
  }

  try {
    const record = await prisma.targetSantri.upsert({
      where: {
        santriId_jenis_bulan_tahunAjaran: {
          santriId: input.santriId,
          jenis: input.jenis,
          bulan: input.bulan,
          tahunAjaran: input.tahunAjaran,
        },
      },
      update: {
        targetPekanan: input.targetPekanan,
        targetBulanan: input.targetBulanan,
        ambangKepatuhan: input.ambangKepatuhan ?? 90.0,
      },
      create: {
        santriId: input.santriId,
        jenis: input.jenis,
        targetPekanan: input.targetPekanan,
        targetBulanan: input.targetBulanan,
        ambangKepatuhan: input.ambangKepatuhan ?? 90.0,
        bulan: input.bulan,
        tahunAjaran: input.tahunAjaran,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "UPSERT_TARGET_SANTRI",
      entity: "TargetSantri",
      entityId: record.id,
      details: {
        santriId: input.santriId,
        jenis: input.jenis,
        bulan: input.bulan,
        targetBulanan: input.targetBulanan,
      },
    });

    return { success: true, message: "Target santri berhasil diperbarui.", data: record };
  } catch (error) {
    console.error("Gagal mengatur target santri:", error);
    return { success: false, message: "Gagal menyimpan target santri." };
  }
}

/**
 * Server Action: Mengambil Target Santri (Sabaq, Sabqi, Manzil, Mufar) dengan ABAC ketat
 */
export async function getTargetSantriAction(
  santriId: string,
  bulan?: number,
  tahunAjaran?: string
) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  // ABAC:
  // WS / ST: Hanya boleh melihat target santri miliknya sendiri
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId || session.santriId !== santriId) {
      return { success: false, message: "Akses Ditolak: Anda hanya berhak melihat target anak Anda." };
    }
  } else if (session.role === "MT" || session.role === "PH") {
    // MT / PH: Fail-closed jika belum terhubung staf
    if (!session.staffId) {
      return { success: false, message: "Profil staf pembina Anda belum terhubung." };
    }
    // Jika bukan Kepala Bidang Tahfidz, hanya boleh melihat target santri halaqoh binaan sendiri
    if (!session.isKepalaBidangTahfidz) {
      const isBinaan = await prisma.halaqoh.findFirst({
        where: {
          pembinaId: session.staffId,
          santriList: { some: { id: santriId } },
        },
      });
      if (!isBinaan) {
        return {
          success: false,
          message: "Akses Ditolak: Anda hanya berwenang melihat target santri di dalam halaqoh binaan Anda.",
        };
      }
    }
  }

  try {
    const whereClause: { santriId: string; bulan?: number; tahunAjaran?: string } = { santriId };
    if (typeof bulan === "number") whereClause.bulan = bulan;
    if (tahunAjaran) whereClause.tahunAjaran = tahunAjaran;

    const targets = await prisma.targetSantri.findMany({
      where: whereClause,
      orderBy: { jenis: "asc" },
    });

    return { success: true, data: targets };
  } catch (error) {
    console.error("Gagal mengambil data target santri:", error);
    return { success: false, message: "Gagal mengambil data target santri dari database." };
  }
}

/**
 * Server Action: Input Capaian Pekanan Non-Tahfizh (7 Komponen)
 */
export async function inputCapaianPekananAction(input: CapaianPekananInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["MT", "PH", "MK", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: "Anda tidak memiliki izin mencatat capaian non-tahfizh." };
  }

  // ABAC: MT dan PH hanya berwenang mencatat capaian santri binaannya
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
        message: "Akses Ditolak: Anda hanya berwenang mencatat capaian santri di dalam halaqoh binaan Anda.",
      };
    }
  }

  try {
    const targetMin = TARGET_MIN_KOMPONEN[input.kategori].target;
    const hbl = input.hbl ?? 0;
    const p1 = input.pekan1 ?? 0;
    const p2 = input.pekan2 ?? 0;
    const p3 = input.pekan3 ?? 0;
    const p4 = input.pekan4 ?? 0;
    const penambahan = p1 + p2 + p3 + p4;
    const total = hbl + penambahan;
    const isTuntas = penambahan >= targetMin;

    const record = await prisma.capaianBulanan.upsert({
      where: {
        santriId_kategori_bulan_tahunAjaran: {
          santriId: input.santriId,
          kategori: input.kategori,
          bulan: input.bulan,
          tahunAjaran: input.tahunAjaran,
        },
      },
      update: {
        hbl,
        pekan1: p1,
        pekan2: p2,
        pekan3: p3,
        pekan4: p4,
        total,
        targetMin,
        isTuntas,
        catatan: input.catatan,
      },
      create: {
        santriId: input.santriId,
        kategori: input.kategori,
        bulan: input.bulan,
        tahunAjaran: input.tahunAjaran,
        hbl,
        pekan1: p1,
        pekan2: p2,
        pekan3: p3,
        pekan4: p4,
        total,
        targetMin,
        isTuntas,
        catatan: input.catatan,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "INPUT_CAPAIAN_PEKANAN",
      entity: "CapaianBulanan",
      entityId: record.id,
      details: {
        santriId: input.santriId,
        kategori: input.kategori,
        total,
        isTuntas,
      },
    });

    return { success: true, message: "Capaian pekanan berhasil disimpan.", data: record };
  } catch (error) {
    console.error("Gagal mencatat capaian pekanan:", error);
    return { success: false, message: "Gagal menyimpan capaian pekanan." };
  }
}

/**
 * Server Action: Mencatat Ujian Tasmi' atau Sima'an Harian
 */
export async function recordTasmiSimaanAction(input: RecordTasmiSimaanInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Sesi telah berakhir. Silakan login kembali." };
  }

  if (!["MT", "PH", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: "Anda tidak berhak menguji Tasmi' atau Sima'an." };
  }

  // ABAC: MT dan PH hanya menguji santri binaannya
  if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return { success: false, message: "Profil staf penguji Anda belum terhubung." };
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
        message: "Akses Ditolak: Anda hanya berwenang menguji santri di dalam halaqoh binaan Anda.",
      };
    }
  }

  try {
    const musyrifStaff = session.staffId
      ? await prisma.staff.findUnique({ where: { id: session.staffId } })
      : await prisma.staff.findFirst({ where: { roleStaff: "MT" } });

    if (!musyrifStaff) {
      return { success: false, message: "Profil penguji staf tidak ditemukan." };
    }

    const testRecord = await prisma.tasmiSimaan.create({
      data: {
        santriId: input.santriId,
        musyrifId: musyrifStaff.id,
        tanggal: new Date(),
        jenis: input.jenis,
        juz: Number(input.juz),
        halaman: input.halaman ? Number(input.halaman) : null,
        nilai: Number(input.nilai),
        predikat: input.predikat,
        catatan: input.catatan,
      },
      include: {
        santri: true,
        musyrif: true,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "RECORD_TASMI_SIMAAN",
      entity: "TasmiSimaan",
      entityId: testRecord.id,
      details: {
        santriNis: testRecord.santri.nis,
        jenis: input.jenis,
        juz: input.juz,
        nilai: input.nilai,
        predikat: input.predikat,
      },
    });

    return {
      success: true,
      message: `Ujian ${input.jenis} santri ${testRecord.santri.nama} berhasil dicatat.`,
      data: testRecord,
    };
  } catch (error) {
    console.error("Gagal mencatat ujian Tasmi/Simaan:", error);
    return { success: false, message: "Gagal mencatat data ujian." };
  }
}

export type LaporanBulananData = NonNullable<Awaited<ReturnType<typeof getLaporanBulananHalaqohAction>>["data"]>;
export type RekapSantriBulananItem = LaporanBulananData["rekapSantri"][number];
