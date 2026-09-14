import { Prisma, PrismaClient, JenisSetoran, NilaiSetoran } from "@prisma/client";
import { getJuzByPage, JUZ_LIST } from "./quran-metadata";
import {
  allocateSabaqPages,
  validateProposedSabaqAllocation,
  calculateLatestSabaqPosition,
} from "./tahfizh-page-allocation";
import { getStartOfWeekWITA } from "./laporan-bulanan";
import {
  deriveOverallNilai,
  MistakeCounts,
  mistakeCountsSchema,
} from "./tahfizh-quality";

export interface CreateSetoranCoreInput {
  santriId: string;
  jenis: JenisSetoran;
  juz: number;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  jumlahJuzMufar?: number | null;
  nilaiTajwid: NilaiSetoran;
  nilaiFashahah: NilaiSetoran;
  nilaiKelancaran: NilaiSetoran;
  rincianKesalahan: MistakeCounts | Record<string, unknown>;
  nilai?: NilaiSetoran;
  catatan?: string | null;
  clientRequestId?: string | null;
  alasanLompatanHalaman?: string | null;
  isManualSabaqi?: boolean;
  alasanManualSabaqi?: string | null;
}

export interface SaveSetoranContext {
  userId: string;
  username: string;
  musyrifStaffId: string;
}

export interface ExecuteSetoranSession {
  userId: string;
  username: string;
  role: string;
  staffId?: string | null;
  isKepalaBidangTahfidz?: boolean;
}

export class CapacityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapacityValidationError";
  }
}

export type CanonicalSetoranResult = {
  success: boolean;
  message: string;
  data?: unknown;
  idempotent?: boolean;
};

/**
 * Eksekutor kanonikal tunggal untuk Setoran Tahfizh (digunakan bersama oleh Server Action & API Route)
 */
export async function executeCanonicalCreateSetoran(
  prismaClient: PrismaClient,
  params: {
    input: CreateSetoranCoreInput;
    session: ExecuteSetoranSession;
  }
): Promise<CanonicalSetoranResult> {
  const { input, session } = params;

  // 1. Role validation: Hanya MT, PH, KS, dan ADM yang boleh input
  if (!["MT", "PH", "KS", "ADM"].includes(session.role)) {
    return { success: false, message: `Role ${session.role} tidak memiliki izin input setoran.` };
  }

  // 2. Validasi Jenis Setoran
  const VALID_JENIS: JenisSetoran[] = ["SABAQ", "SABQI", "MANZIL", "MUFAR"];
  if (!input.jenis || !VALID_JENIS.includes(input.jenis)) {
    return {
      success: false,
      message: "Jenis setoran tidak valid. Harus salah satu dari: SABAQ, SABQI, MANZIL, atau MUFAR.",
    };
  }

  // 3. Verifikasi Keberadaan Santri di Database
  const santri = await prismaClient.santri.findUnique({
    where: { id: input.santriId },
    select: {
      id: true,
      nama: true,
      nis: true,
      halaqohId: true,
      modalHafalanAwalHalaman: true,
      tanggalBaselineTahfizh: true,
    },
  });

  if (!santri) {
    return { success: false, message: "Data santri tidak ditemukan di pangkalan data." };
  }

  // 4. Data Ownership ABAC: MT/PH hanya boleh input santri binaannya (fail-closed)
  if (session.role === "MT" || session.role === "PH") {
    if (!session.staffId) {
      return {
        success: false,
        message: "Akses Ditolak: Profil staf pembina Anda belum terhubung. Hubungi Administrator.",
      };
    }

    const isBinaan = await prismaClient.halaqoh.findFirst({
      where: {
        pembinaId: session.staffId,
        santriList: { some: { id: input.santriId } },
      },
    });

    if (!isBinaan && !session.isKepalaBidangTahfidz) {
      return {
        success: false,
        message: "Akses Ditolak: Anda hanya berwenang mencatat setoran santri di dalam halaqoh binaan Anda.",
      };
    }
  }

  // 5. Staf Penilai / Pencatat: Fail-closed (Tanpa fallback staf acak)
  let musyrifStaffId = session.staffId;
  if (!musyrifStaffId) {
    const userWithStaff = await prismaClient.user.findUnique({
      where: { id: session.userId },
      select: { staffId: true },
    });
    musyrifStaffId = userWithStaff?.staffId || null;
  }

  if (!musyrifStaffId) {
    return {
      success: false,
      message: "Akses Ditolak: Akun Anda tidak memiliki relasi profil staf resmi untuk mencatat setoran.",
    };
  }

  const musyrifStaff = await prismaClient.staff.findUnique({ where: { id: musyrifStaffId } });
  if (!musyrifStaff) {
    return { success: false, message: "Data staf pengampu/pencatat tidak ditemukan di sistem." };
  }

  return await saveSetoranTahfizhCore(prismaClient, {
    input,
    context: {
      userId: session.userId,
      username: session.username,
      musyrifStaffId: musyrifStaff.id,
    },
  });
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
  if (isNaN(jmlHalaman) || !isFinite(jmlHalaman) || jmlHalaman < 0.5) {
    return { success: false, message: "Jumlah halaman tidak valid. Minimal setoran adalah 0.5 halaman." };
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

  // 1c. Validasi Dimensi Kualitas (Tajwid, Fashahah, Kelancaran & Rincian Kesalahan)
  // CONTRACT LOCK: legacy overall `nilai` MUST NEVER infer Tajwid/Fashahah/Kelancaran.
  // Seluruh 3 dimensi kualitas dan rincian kesalahan 8 kunci kanonikal wajib disertakan lengkap.
  const validPredicates = Object.values(NilaiSetoran);

  if (!input.nilaiTajwid || !validPredicates.includes(input.nilaiTajwid)) {
    return { success: false, message: "Nilai Tajwid wajib diisi dengan predikat resmi." };
  }
  if (!input.nilaiFashahah || !validPredicates.includes(input.nilaiFashahah)) {
    return { success: false, message: "Nilai Fashahah wajib diisi dengan predikat resmi." };
  }
  if (!input.nilaiKelancaran || !validPredicates.includes(input.nilaiKelancaran)) {
    return { success: false, message: "Nilai Kelancaran wajib diisi dengan predikat resmi." };
  }

  if (!input.rincianKesalahan) {
    return { success: false, message: "Rincian kesalahan kanonikal (8 kunci) wajib disertakan lengkap." };
  }

  const parseRes = mistakeCountsSchema.safeParse(input.rincianKesalahan);
  if (!parseRes.success) {
    const errorMsg = parseRes.error.issues.map((e) => e.message).join(", ");
    return { success: false, message: `Rincian kesalahan tidak valid: ${errorMsg}` };
  }
  const validatedRincianKesalahan: MistakeCounts = parseRes.data;

  // Canonical server derivation: overall nilai = lowest of the 3 dimensions
  const derivedOverallNilai = deriveOverallNilai({
    tajwid: input.nilaiTajwid,
    fashahah: input.nilaiFashahah,
    kelancaran: input.nilaiKelancaran,
  });

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

  // 3. Validasi Sabaqi di Sisi Server
  if (input.jenis === "SABQI") {
    const refDate = new Date();
    const startOfWeek = getStartOfWeekWITA(refDate);
    const activeSabaqThisWeek = await prismaClient.setoranTahfizh.findMany({
      where: {
        santriId: input.santriId,
        jenis: "SABAQ",
        status: { not: "DIBATALKAN" },
        tanggal: {
          gte: startOfWeek,
          lte: refDate,
        },
      },
    });

    if (activeSabaqThisWeek.length === 0) {
      if (!input.isManualSabaqi) {
        return {
          success: false,
          message: "Belum ada Sabaq tersimpan pada pekan ini. Input manual Sabaqi memerlukan konfirmasi dan alasan tertulis.",
        };
      }
      if (!input.alasanManualSabaqi || input.alasanManualSabaqi.trim().length < 5) {
        return {
          success: false,
          message: "Alasan input manual Sabaqi wajib diisi minimal 5 karakter.",
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
              tanggal: new Date(),
              jenis: input.jenis,
              juz: declaredJuz,
              halamanMulai: halMulai,
              halamanSelesai: halSelesai,
              jumlahHalaman: jmlHalaman,
              jumlahJuzMufar: input.jenis === "MUFAR" ? validatedJumlahJuzMufar : null,
              nilaiTajwid: input.nilaiTajwid,
              nilaiFashahah: input.nilaiFashahah,
              nilaiKelancaran: input.nilaiKelancaran,
              nilai: derivedOverallNilai,
              rincianKesalahan: validatedRincianKesalahan,
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
                nilai: derivedOverallNilai,
                nilaiTajwid: input.nilaiTajwid,
                nilaiFashahah: input.nilaiFashahah,
                nilaiKelancaran: input.nilaiKelancaran,
                rincianKesalahan: validatedRincianKesalahan,
                clientRequestId: input.clientRequestId || null,
                alasanLompatanHalaman: input.alasanLompatanHalaman || null,
                alasanManualSabaqi: input.alasanManualSabaqi || null,
                catatan: input.catatan || null,
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
