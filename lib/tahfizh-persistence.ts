import { Prisma, PrismaClient, JenisSetoran, NilaiSetoran } from "@prisma/client";
import { getJuzByPage, JUZ_LIST } from "./quran-metadata";
import {
  allocateSabaqPages,
  validateProposedSabaqAllocation,
  calculateLatestSabaqPosition,
} from "./tahfizh-page-allocation";
import { getStartOfWeekWITA } from "./sabaqi";
import { parseWITADate, getTodayWITADateString, getWITADayRange, getWitaDateString } from "./wita-date";

export interface CreateSetoranCoreInput {
  santriId: string;
  jenis: JenisSetoran;
  juz: number;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  jumlahJuzMufar?: number | null;
  nilai: NilaiSetoran;
  catatan?: string | null;
  clientRequestId?: string | null;
  alasanLompatanHalaman?: string | null;
  occurredAt?: Date | string | null;
  tanggalSetoran?: string | null;
}

export interface SaveSetoranContext {
  userId: string;
  username: string;
  musyrifStaffId: string;
}

export class CapacityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapacityValidationError";
  }
}

/**
 * Service persistensi tunggal untuk Setoran Tahfizh.
 * Menggunakan transaksi atomik PostgreSQL dengan level Serializable dan proteksi konkurensi.
 * Dapat dipanggil langsung dari Server Actions maupun Integration Tests.
 */
export async function saveSetoranTahfizhCore(
  prismaClient: PrismaClient,
  params: {
    input: CreateSetoranCoreInput;
    context: SaveSetoranContext;
  }
) {
  const { input, context } = params;

  // 1a. Validasi Tanggal Setoran (tanggalSetoran / occurredAt) - UAT Rule #13
  let effectiveOccurredAt: Date = new Date();
  const todayWita = getTodayWITADateString();

  if (input.tanggalSetoran !== undefined && input.tanggalSetoran !== null && input.tanggalSetoran !== "") {
    const rawDate = String(input.tanggalSetoran).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return { success: false, message: "Format tanggal setoran tidak valid. Gunakan format YYYY-MM-DD." };
    }
    if (rawDate > todayWita) {
      return { success: false, message: "Tanggal setoran tidak boleh di masa depan." };
    }
    const parsedWita = parseWITADate(rawDate);
    if (isNaN(parsedWita.getTime())) {
      return { success: false, message: "Format tanggal setoran tidak valid." };
    }
    effectiveOccurredAt = parsedWita;
  } else if (input.occurredAt !== undefined && input.occurredAt !== null) {
    if (typeof input.occurredAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.occurredAt.trim())) {
      const rawDate = input.occurredAt.trim();
      if (rawDate > todayWita) {
        return { success: false, message: "Tanggal setoran (occurredAt) tidak boleh di masa depan." };
      }
      effectiveOccurredAt = parseWITADate(rawDate);
    } else {
      const parsed = input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt);
      if (isNaN(parsed.getTime())) {
        return { success: false, message: "Format tanggal setoran (occurredAt) tidak valid." };
      }
      if (parsed.getTime() > Date.now()) {
        return { success: false, message: "Tanggal setoran (occurredAt) tidak boleh di masa depan." };
      }
      effectiveOccurredAt = parsed;
    }
  }

  // 1. Validasi Nilai Halaman, Volume, & Juz
  const halMulai = Number(input.halamanMulai);
  const halSelesai = Number(input.halamanSelesai);
  const jmlHalaman = Number(input.jumlahHalaman);
  const declaredJuz = Number(input.juz);

  if (!Number.isInteger(declaredJuz) || declaredJuz < 1 || declaredJuz > 30) {
    return { success: false, message: "Juz wajib berupa bilangan bulat antara 1 sampai 30." };
  }

  if (!Number.isInteger(halMulai) || halMulai < 1 || halMulai > 604) {
    return { success: false, message: "Halaman mulai harus berupa bilangan bulat antara 1 sampai 604." };
  }
  if (!Number.isInteger(halSelesai) || halSelesai < 1 || halSelesai > 604) {
    return { success: false, message: "Halaman selesai harus berupa bilangan bulat antara 1 sampai 604." };
  }
  if (halSelesai < halMulai) {
    return { success: false, message: "Halaman selesai tidak boleh lebih kecil dari halaman mulai." };
  }

  // Validasi batas Juz (Mushaf Madinah)
  const juzInfo = JUZ_LIST.find((j) => j.juz === declaredJuz);
  if (!juzInfo) {
    return { success: false, message: `Data referensi batas Juz ${declaredJuz} tidak ditemukan.` };
  }
  if (halMulai < juzInfo.startPage || halSelesai > juzInfo.endPage) {
    const juzMulai = getJuzByPage(halMulai);
    const juzSelesai = getJuzByPage(halSelesai);
    if (juzMulai !== juzSelesai) {
      return {
        success: false,
        message: `Rentang halaman ${halMulai}–${halSelesai} melintasi batas Juz (Halaman ${halMulai} adalah Juz ${juzMulai}, sedangkan Halaman ${halSelesai} adalah Juz ${juzSelesai}). Satu transaksi setoran harus dalam satu juz.`,
      };
    }
    return {
      success: false,
      message: `Rentang halaman ${halMulai}–${halSelesai} di luar rentang resmi Juz ${declaredJuz} (Halaman ${juzInfo.startPage}–${juzInfo.endPage}).`,
    };
  }

  if (isNaN(jmlHalaman) || !isFinite(jmlHalaman) || jmlHalaman < 0.5) {
    return { success: false, message: "Jumlah halaman tidak valid. Minimal setoran adalah 0.5 halaman." };
  }
  if (input.jenis === "SABAQ" && jmlHalaman > 1.0) {
    return { success: false, message: "Volume setoran Sabaq tidak boleh melebihi 1.0 halaman per setoran." };
  }

  // 1b. Validasi Khusus MUFAR (Structured Data Contract: wajib integer 1–6)
  let validatedJumlahJuzMufar: number | null = null;
  if (input.jenis === "MUFAR") {
    const rawJuzMufar = Number(input.jumlahJuzMufar);
    if (!Number.isInteger(rawJuzMufar) || rawJuzMufar < 1 || rawJuzMufar > 6) {
      return {
        success: false,
        message: "Untuk setoran MUFAR, jumlah juz wajib berupa bilangan bulat antara 1 sampai 6.",
      };
    }
    validatedJumlahJuzMufar = rawJuzMufar;
  }

  // Hubungan volume dan rentang halaman secara konsisten
  if (input.jenis === "SABAQ") {
    try {
      allocateSabaqPages(halMulai, halSelesai, jmlHalaman);
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message,
      };
    }
  } else {
    const rentangHalaman = halSelesai - halMulai + 1;
    if (jmlHalaman === 0.5) {
      if (halMulai !== halSelesai) {
        return {
          success: false,
          message: "Untuk setoran 0.5 halaman, halaman mulai dan selesai harus sama.",
        };
      }
    } else if (Number.isInteger(jmlHalaman)) {
      if (jmlHalaman !== rentangHalaman) {
        return {
          success: false,
          message: `Jumlah halaman (${jmlHalaman}) tidak sesuai dengan rentang halaman (${halMulai}–${halSelesai} = ${rentangHalaman} halaman).`,
        };
      }
    } else {
      if (rentangHalaman < Math.floor(jmlHalaman) || rentangHalaman > Math.ceil(jmlHalaman)) {
        return {
          success: false,
          message: `Volume halaman (${jmlHalaman}) tidak konsisten dengan rentang halaman ${halMulai}–${halSelesai}.`,
        };
      }
    }
  }

  // 2. Pre-transaction Idempotency Check (dengan verifikasi kepemilikan santri)
  if (input.clientRequestId) {
    const existing = await prismaClient.setoranTahfizh.findUnique({
      where: { clientRequestId: input.clientRequestId },
      include: {
        santri: true,
        musyrif: true,
      },
    });
    if (existing) {
      // Poin 6: Verifikasi kepemilikan record
      if (existing.santriId !== input.santriId) {
        return {
          success: false,
          message: "Akses Ditolak: clientRequestId telah digunakan untuk santri berbeda.",
        };
      }
      return {
        success: true,
        idempotent: true,
        message: `Setoran ${existing.santri.nama} (${existing.setoranCode}) telah tercatat sebelumnya (idempoten).`,
        data: existing,
      };
    }
  }

  // 3. Validasi Sabaqi di Sisi Server (Fail-Closed: derived strictly from UNION of actual stored Sabaq coverage this week)
  if (input.jenis === "SABQI") {
    const refDate = effectiveOccurredAt;
    const startOfWeek = getStartOfWeekWITA(refDate);
    const activeSabaqThisWeek = await prismaClient.setoranTahfizh.findMany({
      where: {
        santriId: input.santriId,
        jenis: "SABAQ",
        status: { not: "DIBATALKAN" },
        tanggal: {
          gte: startOfWeek,
          lte: effectiveOccurredAt,
        },
      },
      select: {
        halamanMulai: true,
        halamanSelesai: true,
        jumlahHalaman: true,
      },
    });

    if (activeSabaqThisWeek.length === 0) {
      return {
        success: false,
        message: "Belum ada setoran Sabaq tersimpan pada pekan berjalan ini. Setoran Sabaqi tidak dapat dicatat sebelum ada setoran Sabaq resmi pekan ini.",
      };
    }

    // Build the UNION of actual active stored SABAQ allocations since Monday WITA
    const storedCoverage: Record<number, number> = {};
    for (const sabaq of activeSabaqThisWeek) {
      let sabaqAlloc: Record<number, number>;
      try {
        sabaqAlloc = allocateSabaqPages(
          sabaq.halamanMulai,
          sabaq.halamanSelesai,
          Number(sabaq.jumlahHalaman)
        );
      } catch {
        return {
          success: false,
          message: "DATA_INTEGRITY_ERROR: Alokasi halaman setoran Sabaq tersimpan tidak dapat direkonstruksi secara aman.",
        };
      }
      for (const [pageStr, vol] of Object.entries(sabaqAlloc)) {
        const page = Number(pageStr);
        storedCoverage[page] = Math.min(1.0, Number(((storedCoverage[page] || 0) + vol).toFixed(2)));
      }
    }

    // Allocate proposed SABAQI pages
    let proposedSabaqiAlloc: Record<number, number>;
    try {
      proposedSabaqiAlloc = allocateSabaqPages(halMulai, halSelesai, jmlHalaman);
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message || "Format halaman setoran Sabaqi tidak valid.",
      };
    }

    for (const [pageStr, reqVol] of Object.entries(proposedSabaqiAlloc)) {
      const page = Number(pageStr);
      const coveredVol = storedCoverage[page] || 0;
      if (coveredVol <= 0) {
        return {
          success: false,
          message: `Halaman ${page} tidak termasuk dalam materi Sabaq sah yang tersimpan pada pekan ini. Setoran Sabaqi harus sepenuhnya tercakup dalam materi Sabaq pekan ini.`,
        };
      }
      if (reqVol > coveredVol + 0.001) {
        return {
          success: false,
          message: `Cakupan halaman ${page} yang diajukan (${reqVol} halaman) melebihi batas Sabaq tersimpan pekan ini (${coveredVol} halaman).`,
        };
      }
    }
  }

  // 4. Verifikasi Keberadaan Santri
  const santri = await prismaClient.santri.findUnique({
    where: { id: input.santriId },
    select: {
      id: true,
      nama: true,
      nis: true,
      modalHafalanAwalHalaman: true,
      tanggalBaselineTahfizh: true,
    },
  });

  if (!santri) {
    return { success: false, message: "Data santri tidak ditemukan di pangkalan data." };
  }

  const baselineDate = santri.tanggalBaselineTahfizh ? new Date(santri.tanggalBaselineTahfizh) : null;
  let newSetoran = null;
  const MAX_RETRIES = 3;

  // 5. Transaksi Atomik dengan Serializable Isolation & Concurrency Protection
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      newSetoran = await prismaClient.$transaction(
        async (tx) => {
          if (input.jenis === "SABAQ") {
            const activeSabaqList = await tx.setoranTahfizh.findMany({
              where: {
                santriId: input.santriId,
                jenis: "SABAQ",
                status: { not: "DIBATALKAN" },
                ...(baselineDate ? { tanggal: { gte: baselineDate } } : {}),
              },
              select: {
                id: true,
                jenis: true,
                status: true,
                halamanMulai: true,
                halamanSelesai: true,
                jumlahHalaman: true,
                tanggal: true,
                createdAt: true,
              },
            });

            // Cek jika santri telah menyelesaikan target hafalan 30 juz (halaman 604)
            const latestPos = calculateLatestSabaqPosition(
              activeSabaqList,
              santri.modalHafalanAwalHalaman || 0,
              baselineDate
            );

            if (latestPos.isKhatam30Juz) {
              throw new CapacityValidationError(
                "Target hafalan 30 juz telah selesai. Tidak ada halaman Sabaq berikutnya."
              );
            }

            // Poin 7: Validasi Server untuk Alasan Lompatan Halaman SABAQ
            if (latestPos.saranHalamanMulai !== null && halMulai !== latestPos.saranHalamanMulai) {
              if (!input.alasanLompatanHalaman || input.alasanLompatanHalaman.trim().length < 5) {
                throw new CapacityValidationError(
                  `Halaman setoran (${halMulai}) berbeda dari urutan resmi (Halaman ${latestPos.saranHalamanMulai}). Alasan lompatan atau pengulangan halaman wajib diisi minimal 5 karakter.`
                );
              }
            }

            // TAHF-02: Validasi akumulasi harian Sabaq per hari kalender WITA (maksimal 1.0 halaman per hari)
            const dateStrWita = getWitaDateString(effectiveOccurredAt);
            const { startOfDayUTC, endOfDayUTC } = getWITADayRange(dateStrWita);
            const dailySabaqList = await tx.setoranTahfizh.findMany({
              where: {
                santriId: input.santriId,
                jenis: "SABAQ",
                status: { not: "DIBATALKAN" },
                tanggal: {
                  gte: startOfDayUTC,
                  lte: endOfDayUTC,
                },
              },
              select: {
                jumlahHalaman: true,
              },
            });
            const dailyAggregate = dailySabaqList.reduce((acc, s) => acc + Number(s.jumlahHalaman), 0);
            if (dailyAggregate + jmlHalaman > 1.0) {
              throw new CapacityValidationError(
                `Akumulasi setoran Sabaq pada hari yang sama (${(dailyAggregate + jmlHalaman).toFixed(1)} halaman) melebihi batas maksimal 1.0 halaman per hari kalender WITA.`
              );
            }

            // Validasi kapasitas halaman maksimal 1.0
            const validation = validateProposedSabaqAllocation(
              activeSabaqList,
              halMulai,
              halSelesai,
              jmlHalaman,
              baselineDate
            );

            if (!validation.valid) {
              throw new CapacityValidationError(
                validation.message || `Akumulasi setoran pada halaman melebihi kapasitas 1 halaman.`
              );
            }
          }

          // Buat record setoran baru
          const timePart = Date.now().toString(36).toUpperCase();
          const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
          const setoranCode = `SET-${timePart}-${randPart}`;

          const created = await tx.setoranTahfizh.create({
            data: {
              setoranCode,
              santriId: input.santriId,
              musyrifId: context.musyrifStaffId,
              tanggal: effectiveOccurredAt,
              jenis: input.jenis,
              juz: declaredJuz,
              halamanMulai: halMulai,
              halamanSelesai: halSelesai,
              jumlahHalaman: jmlHalaman,
              jumlahJuzMufar: input.jenis === "MUFAR" ? validatedJumlahJuzMufar : null,
              nilai: input.nilai,
              catatan: input.catatan?.trim() || null,
              clientRequestId: input.clientRequestId?.trim() || null,
              status: "AKTIF",
              createdBy: context.username,
            },
            include: {
              santri: true,
              musyrif: true,
            },
          });

          // Buat audit log di dalam transaksi atomik
          await tx.auditLog.create({
            data: {
              userId: context.userId,
              action: "CREATE_SETORAN",
              entity: "SetoranTahfizh",
              entityId: created.id,
              details: {
                setoranCode: created.setoranCode,
                databaseId: created.id,
                santriId: created.santriId,
                santriNis: created.santri.nis,
                juz: declaredJuz,
                halaman: `${halMulai}-${halSelesai}`,
                jumlahHalaman: jmlHalaman,
                ...(input.jenis === "MUFAR" ? { jumlahJuzMufar: created.jumlahJuzMufar } : {}),
                nilai: input.nilai,
                clientRequestId: input.clientRequestId || null,
                alasanLompatanHalaman: input.alasanLompatanHalaman || null,
                catatan: input.catatan || null,
                occurredAt: effectiveOccurredAt.toISOString(),
                createdAt: created.createdAt.toISOString(),
                creator: context.username,
              },
            },
          });

          return created;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        }
      );

      // Berhasil disimpan
      break;
    } catch (err: unknown) {
      if (err instanceof CapacityValidationError) {
        return {
          success: false,
          message: err.message,
        };
      }

      const prismaErr = err as { code?: string; message?: string };

      // Poin 6: Handle unique constraint clientRequestId dengan verifikasi kepemilikan santri
      if (prismaErr?.code === "P2002" && input.clientRequestId) {
        const existingRecord = await prismaClient.setoranTahfizh.findUnique({
          where: { clientRequestId: input.clientRequestId },
          include: { santri: true, musyrif: true },
        });
        if (existingRecord) {
          if (existingRecord.santriId !== input.santriId) {
            return {
              success: false,
              message: "Akses Ditolak: clientRequestId telah digunakan untuk santri berbeda.",
            };
          }
          return {
            success: true,
            idempotent: true,
            message: `Setoran ${existingRecord.santri.nama} (${existingRecord.setoranCode}) telah tercatat sebelumnya (idempoten).`,
            data: existingRecord,
          };
        }
      }

      // Handle PostgreSQL serialization failure / deadlock (P2034)
      if (
        prismaErr?.code === "P2034" ||
        prismaErr?.message?.includes("could not serialize access") ||
        prismaErr?.message?.includes("deadlock detected")
      ) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
          continue;
        }
        return {
          success: false,
          message:
            "Posisi hafalan santri baru saja diperbarui dari perangkat lain. Data telah dimuat ulang. Silakan periksa lalu simpan kembali.",
        };
      }

      console.error("Gagal simpan setoran:", err);
      return {
        success: false,
        message: "Gagal menyimpan setoran santri ke pangkalan data.",
      };
    }
  }

  if (!newSetoran) {
    return {
      success: false,
      message:
        "Posisi hafalan santri baru saja diperbarui dari perangkat lain. Data telah dimuat ulang. Silakan periksa lalu simpan kembali.",
    };
  }

  return {
    success: true,
    message: `Setoran ${newSetoran.santri.nama} (${newSetoran.setoranCode}) berhasil dicatat.`,
    data: newSetoran,
  };
}
