"use server";

import prisma from "@/lib/prisma";
import {
  getCurrentSession,
  recordAuditLog,
  resolveUserIsMudabbir,
  getMudabbirAssignedUnitIds,
} from "@/lib/auth";
import { JenisIzin, StatusIzin, StatusAbsensi, Prisma } from "@prisma/client";
import { getWitaDateString } from "@/lib/wita-date";

export interface AjukanIzinData {
  santriId?: string;
  santriIds?: string[];
  jenis: JenisIzin;
  tanggalMulai: string; // ISO string
  tanggalSelesai: string; // ISO string
  alasan: string;
  usesVehicle?: boolean;
  kendaraan?: boolean;
  pakaiKendaraan?: boolean;
  isKendaraan?: boolean;
  menginap?: boolean;
  isMenginap?: boolean;
}

import { UserSession } from "@/types/auth";

async function resolveIsMudabbir(session: UserSession): Promise<boolean> {
  return resolveUserIsMudabbir(session?.userId);
}

/**
 * Server Action: Ajukan / Catat Perizinan Santri
 * Otoritas:
 * 1. Santri (ST) & Wali (WS): Mandiri permohonan santri sendiri -> MENUNGGU_MK
 * 2. Mudir (KS), Musyrif Keasramaan (MK), ADM: Catat izin resmi langsung -> DISETUJUI
 * 3. Mudabbir (OSDA):
 *    - Pulang / keluar hari yang sama (non-overnight) -> DISETUJUI
 *    - Menginap / kendaraan / multi-day -> MENUNGGU_MK
 * Mendukung batch pengajuan banyak santri sekaligus dengan batchId terpadu.
 */
export async function ajukanIzinAction(input: AjukanIzinData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Deteksi identitas Mudabbir (secara canonical assignment atau session attribute)
  const isMudabbir = await resolveIsMudabbir(session);

  // Normalisasi target santri
  const targetSantriIds: string[] =
    input.santriIds && input.santriIds.length > 0
      ? input.santriIds
      : input.santriId && input.santriId.trim()
      ? [input.santriId.trim()]
      : [];

  if (targetSantriIds.length === 0) {
    return { success: false, message: "Santri tidak valid atau belum dipilih." };
  }

  // Evaluasi wewenang peran sesuai Owner Lock PR-1:
  // Path A: SANTRI SELF REQUEST (Santri only, individual ticket, status pending decision)
  // Path B: MUSYRIF OPERATIONAL INPUT (MK / KS, one or multiple santri, directly APPROVED)
  // Path C: MUDABBIR OPERATIONAL INPUT (Mudabbir/Pembina Kamar, one or multiple, same-day exit APPROVED, overnight/pulang pending)
  // Path D: OSDA (Generic OSDA role DENIED, Mudabbir is NOT OSDA)
  // Path E: ADM (Generic ADM role DENIED, ADM is not Musyrif)
  // Path F: WS (Wali Santri DENIED from self-request creation)
  let initialStatus: StatusIzin = StatusIzin.MENUNGGU_MK;
  let submissionRole: string = session.role;

  if (session.role === "ST") {
    if (!session.santriId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun Anda belum terhubung dengan data santri resmi.",
      };
    }
    if (targetSantriIds.length > 1) {
      return {
        success: false,
        message: "Akses Ditolak: Santri hanya dapat mengajukan permohonan izin mandiri untuk diri sendiri (maksimal 1 santri per permohonan).",
      };
    }
    if (targetSantriIds[0] !== session.santriId) {
      return {
        success: false,
        message: "Akses Ditolak: Anda hanya berwenang mengajukan perizinan untuk santri Anda sendiri.",
      };
    }
    initialStatus = StatusIzin.MENUNGGU_MK;
    submissionRole = "ST";
  } else if (isMudabbir) {
    // Mudabbir operasional input (Pembina Halaqoh / Mudabbir)
    // 1. Resolve permitted scope from active assignments & halaqoh
    const assignedUnits = await getMudabbirAssignedUnitIds(session.userId);
    const allowedUnitIds = new Set<string>(assignedUnits);

    if (allowedUnitIds.size > 0) {
      const orgUnits = await prisma.orgUnit.findMany({
        where: { id: { in: Array.from(allowedUnitIds) } },
        select: { id: true, code: true },
      });
      for (const ou of orgUnits) {
        if (ou.code) allowedUnitIds.add(ou.code);
        if (ou.id) allowedUnitIds.add(ou.id);
      }
    }

    const halaqohFilter: Prisma.HalaqohWhereInput[] = [];
    if (allowedUnitIds.size > 0) {
      halaqohFilter.push({ id: { in: Array.from(allowedUnitIds) } });
      halaqohFilter.push({ halaqohCode: { in: Array.from(allowedUnitIds) } });
    }
    if (session.staffId) {
      halaqohFilter.push({ pembinaId: session.staffId });
    }

    if (halaqohFilter.length > 0) {
      const matchingHalaqohs = await prisma.halaqoh.findMany({
        where: { OR: halaqohFilter },
        select: { id: true, halaqohCode: true },
      });
      for (const h of matchingHalaqohs) {
        if (h.id) allowedUnitIds.add(h.id);
        if (h.halaqohCode) allowedUnitIds.add(h.halaqohCode);
      }
    }

    // Verify all target santri belong to the Mudabbir's allowed scope
    const targetSantriList = await prisma.santri.findMany({
      where: { id: { in: targetSantriIds } },
      select: {
        id: true,
        nama: true,
        halaqohId: true,
        halaqoh: { select: { id: true, halaqohCode: true } },
        kamarPlacements: { select: { kamarId: true } },
      },
    });

    if (targetSantriList.length !== targetSantriIds.length) {
      return {
        success: false,
        message: "Akses Ditolak: Satu atau lebih santri tidak ditemukan.",
      };
    }

    for (const s of targetSantriList) {
      const inScope =
        (s.halaqohId && allowedUnitIds.has(s.halaqohId)) ||
        (s.halaqoh?.id && allowedUnitIds.has(s.halaqoh.id)) ||
        (s.halaqoh?.halaqohCode && allowedUnitIds.has(s.halaqoh.halaqohCode)) ||
        s.kamarPlacements.some((kp) => allowedUnitIds.has(kp.kamarId));

      if (!inScope) {
        return {
          success: false,
          message: `Akses Ditolak: Santri ${s.nama} berada di luar cakupan binaan Anda.`,
        };
      }
    }

    // Same-day exit WITHOUT vehicle: -> DISETUJUI
    // Pulang: -> MENUNGGU_MK
    // Menginap: -> MENUNGGU_MK
    // Any permit USING VEHICLE: -> MENUNGGU_MK (Vehicle rule overrides same-day auto-approval)
    const d1 = new Date(input.tanggalMulai);
    const d2 = new Date(input.tanggalSelesai);
    const isSameDay =
      d1.toISOString().slice(0, 10) === d2.toISOString().slice(0, 10) ||
      getWitaDateString(d1) === getWitaDateString(d2);

    // Explicit structured vehicle input only (NO keyword/regex text parsing on alasan)
    const usesVehicle = Boolean(
      input.usesVehicle ??
      input.kendaraan ??
      input.pakaiKendaraan ??
      input.isKendaraan ??
      false
    );

    const isMultiDay = !isSameDay;
    const isMenginap = Boolean(input.menginap || input.isMenginap || isMultiDay || input.jenis === JenisIzin.PULANG);

    if (isSameDay && input.jenis === JenisIzin.KELUAR_KOMPLEK && !usesVehicle && !isMenginap) {
      initialStatus = StatusIzin.DISETUJUI;
    } else {
      initialStatus = StatusIzin.MENUNGGU_MK;
    }
    submissionRole = "MUDABBIR";
  } else if (session.role === "MK" || session.role === "KS") {
    // Musyrif operasional input (individual atau batch langsung disetujui)
    initialStatus = StatusIzin.DISETUJUI;
    submissionRole = session.role;
  } else if (session.role === "OSDA") {
    return {
      success: false,
      message: "Akses Ditolak: Akun generic OSDA tidak memiliki kewenangan perizinan santri. Mudabbir bukan OSDA.",
    };
  } else if (session.role === "ADM") {
    return {
      success: false,
      message: "Akses Ditolak: Role ADM tidak memiliki kewenangan operasional pencatatan izin santri secara otomatis. Hanya Musyrif atau Mudabbir yang berwenang.",
    };
  } else if (session.role === "WS") {
    return {
      success: false,
      message: "Akses Ditolak: Wali Santri tidak berwenang mengajukan izin mandiri tanpa persetujuan santri/musyrif.",
    };
  } else {
    return {
      success: false,
      message: `Akses ditolak: Role ${session.role} tidak memiliki kewenangan mengajukan perizinan santri.`,
    };
  }

  try {
    const batchId =
      targetSantriIds.length > 1
        ? `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        : null;

    const createdList = [];

    for (const sId of targetSantriIds) {
      const count = await prisma.perizinanSantri.count();
      const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
      const kodeIzin = `IZN-${String(count + 1).padStart(5, "0")}-${rand}`;

      const newIzin = await prisma.perizinanSantri.create({
        data: {
          kodeIzin,
          batchId,
          santriId: sId,
          jenis: input.jenis,
          tanggalMulai: new Date(input.tanggalMulai),
          tanggalSelesai: new Date(input.tanggalSelesai),
          alasan: input.alasan,
          usesVehicle: Boolean(
            input.usesVehicle ??
            input.kendaraan ??
            input.pakaiKendaraan ??
            input.isKendaraan ??
            false
          ),
          status: initialStatus,
          diajukanOlehRole: submissionRole,
          diajukanOlehUserId: session.userId,
          ...(initialStatus === StatusIzin.DISETUJUI && session.role === "MK" && session.staffId
            ? { disetujuiMKId: session.staffId }
            : {}),
          ...(initialStatus === StatusIzin.DISETUJUI && session.role === "KS" && session.staffId
            ? { disetujuiKSId: session.staffId }
            : {}),
        },
        include: { santri: true },
      });

      await recordAuditLog({
        userId: session.userId,
        action: "AJUKAN_IZIN",
        entity: "PerizinanSantri",
        entityId: newIzin.id,
        details: {
          kodeIzin,
          batchId,
          santriNis: newIzin.santri.nis,
          jenis: input.jenis,
          usesVehicle: newIzin.usesVehicle,
          initialStatus,
          diajukanOleh: session.username,
          diajukanOlehRole: submissionRole,
        },
      });

      createdList.push(newIzin);
    }

    const message =
      initialStatus === StatusIzin.DISETUJUI
        ? `Perizinan ${
            createdList.length > 1
              ? `${createdList.length} santri (Batch ${batchId})`
              : createdList[0].santri.nama
          } berhasil dicatat dan disetujui.`
        : `Permohonan izin ${
            createdList.length > 1
              ? `${createdList.length} santri (Batch ${batchId})`
              : createdList[0].santri.nama
          } berhasil diajukan, menunggu verifikasi Musyrif Keasramaan.`;

    return {
      success: true,
      message,
      data: createdList.length === 1 ? createdList[0] : createdList,
      batchId,
    };
  } catch (error) {
    console.error("Gagal mengajukan izin santri:", error);
    return { success: false, message: "Gagal memproses permohonan izin." };
  }
}

/**
 * Server Action: Konfirmasi Kepulangan Santri dari Perizinan (MK, KS, ADM, OSDA)
 * Menandai kepulangan santri dan mengevaluasi keterlambatan secara informasional.
 * Catatan: Keterlambatan TIDAK otomatis menerbitkan sanksi/pelanggaran.
 */
export async function konfirmasiKembaliIzinAction(params: { izinId: string }) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  const isMudabbir = await resolveIsMudabbir(session);

  if (!["MK", "KS"].includes(session.role) && !isMudabbir) {
    return {
      success: false,
      message: `Akses ditolak: Role ${session.role} tidak memiliki otoritas konfirmasi kepulangan santri.`,
    };
  }

  try {
    const izin = await prisma.perizinanSantri.findUnique({
      where: { id: params.izinId },
      include: { santri: true },
    });

    if (!izin) {
      return { success: false, message: "Data izin tidak ditemukan." };
    }

    if (izin.status !== StatusIzin.DISETUJUI) {
      return {
        success: false,
        message: `Hanya izin berstatus DISETUJUI yang dapat dikonfirmasi kepulangannya (Status saat ini: ${izin.status}).`,
      };
    }

    const now = new Date();
    const isLate = now.getTime() > new Date(izin.tanggalSelesai).getTime();

    const updated = await prisma.perizinanSantri.update({
      where: { id: params.izinId },
      data: {
        status: StatusIzin.KEMBALI_TERKONFIRMASI,
        returnedAt: now,
        returnedBy: session.username,
        isLate,
      },
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "KONFIRMASI_KEMBALI_IZIN",
      entity: "PerizinanSantri",
      entityId: updated.id,
      details: {
        kodeIzin: updated.kodeIzin,
        santriNis: updated.santri.nis,
        returnedAt: now.toISOString(),
        isLate,
        konfirmasiOleh: session.username,
      },
    });

    const lateNotice = isLate ? " (Terlambat kembali)" : " (Tepat waktu)";
    return {
      success: true,
      message: `Kepulangan santri ${updated.santri.nama} (${updated.kodeIzin}) berhasil dikonfirmasi${lateNotice}.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal mengonfirmasi kepulangan santri:", error);
    return { success: false, message: "Gagal mengonfirmasi kepulangan santri." };
  }
}

/**
 * Server Action: Batalkan Izin Santri (Soft Cancellation)
 */
export async function batalkanIzinAction(params: { izinId: string; alasan: string }) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  const cancelReason = (params.alasan || "").trim();
  if (cancelReason.length < 3) {
    return { success: false, message: "Alasan pembatalan izin wajib diisi minimal 3 karakter." };
  }

  const isMudabbir = await resolveIsMudabbir(session);

  if (!["MK", "KS", "ST"].includes(session.role) && !isMudabbir) {
    return { success: false, message: `Role ${session.role} tidak memiliki hak akses membatalkan perizinan.` };
  }

  try {
    const izin = await prisma.perizinanSantri.findUnique({
      where: { id: params.izinId },
      include: { santri: true },
    });

    if (!izin) {
      return { success: false, message: "Data izin tidak ditemukan." };
    }

    if (izin.status === StatusIzin.DIBATALKAN) {
      return { success: false, message: "Izin ini telah dibatalkan sebelumnya." };
    }

    if (izin.status === StatusIzin.KEMBALI_TERKONFIRMASI) {
      return { success: false, message: "Izin yang santrinya sudah kembali tidak dapat dibatalkan." };
    }

    if (session.role === "ST") {
      if (izin.santriId !== session.santriId || izin.status !== StatusIzin.MENUNGGU_MK) {
        return {
          success: false,
          message:
            "Akses Ditolak: Anda hanya dapat membatalkan permohonan izin Anda yang masih berstatus menunggu verifikasi.",
        };
      }
    } else if (isMudabbir) {
      if (izin.diajukanOlehUserId !== session.userId && !["MK", "KS"].includes(session.role)) {
        return {
          success: false,
          message: "Akses Ditolak: Mudabbir hanya dapat membatalkan izin yang diajukan oleh akun sendiri.",
        };
      }
    } else if (!["MK", "KS"].includes(session.role)) {
      return { success: false, message: `Role ${session.role} tidak memiliki hak akses membatalkan perizinan.` };
    }

    const updated = await prisma.perizinanSantri.update({
      where: { id: params.izinId },
      data: {
        status: StatusIzin.DIBATALKAN,
        cancelledAt: new Date(),
        cancelledBy: session.username,
        cancelReason,
      },
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "BATALKAN_IZIN",
      entity: "PerizinanSantri",
      entityId: updated.id,
      details: {
        kodeIzin: updated.kodeIzin,
        santriNis: updated.santri.nis,
        cancelReason,
        dibatalkanOleh: session.username,
      },
    });

    return {
      success: true,
      message: `Izin ${updated.kodeIzin} berhasil dibatalkan.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal membatalkan izin:", error);
    return { success: false, message: "Gagal membatalkan izin santri." };
  }
}

/**
 * Server Action: Verifikasi / Approval Perizinan Santri Berjenjang (MK & KS)
 */
export async function verifikasiIzinAction(params: {
  izinId: string;
  action: "APPROVE" | "REJECT" | "ESCALATE_KS";
  catatan?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Hanya MK dan KS yang berhak memberikan approval
  if (session.role !== "MK" && session.role !== "KS") {
    return {
      success: false,
      message: `Role ${session.role} tidak memiliki otoritas untuk memverifikasi perizinan santri.`,
    };
  }

  try {
    const izin = await prisma.perizinanSantri.findUnique({
      where: { id: params.izinId },
      include: { santri: true },
    });

    if (!izin) {
      return { success: false, message: "Data izin tidak ditemukan." };
    }

    let newStatus: StatusIzin = izin.status;
    const updateData: Prisma.PerizinanSantriUpdateInput = {
      catatan: params.catatan || izin.catatan,
    };

    if (params.action === "REJECT") {
      newStatus = StatusIzin.DITOLAK;
    } else if (params.action === "ESCALATE_KS") {
      newStatus = StatusIzin.MENUNGGU_KS;
      if (session.staffId) updateData.disetujuiMK = { connect: { id: session.staffId } };
    } else if (params.action === "APPROVE") {
      // Jika izin PULANG, butuh persetujuan KS
      if (izin.jenis === JenisIzin.PULANG && session.role !== "KS" && izin.status !== StatusIzin.MENUNGGU_KS) {
        newStatus = StatusIzin.MENUNGGU_KS;
        if (session.staffId) updateData.disetujuiMK = { connect: { id: session.staffId } };
      } else {
        newStatus = StatusIzin.DISETUJUI;
        if (session.role === "KS" && session.staffId) {
          updateData.disetujuiKS = { connect: { id: session.staffId } };
        } else if (session.role === "MK" && session.staffId) {
          updateData.disetujuiMK = { connect: { id: session.staffId } };
        }
      }
    }

    updateData.status = newStatus;

    const updated = await prisma.perizinanSantri.update({
      where: { id: params.izinId },
      data: updateData,
      include: { santri: true },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "VERIFIKASI_IZIN",
      entity: "PerizinanSantri",
      entityId: updated.id,
      details: {
        kodeIzin: updated.kodeIzin,
        actionTaken: params.action,
        statusAkhir: newStatus,
        diverifikasiOleh: session.username,
      },
    });

    return {
      success: true,
      message: `Status izin ${updated.kodeIzin} berhasil diperbarui menjadi: ${newStatus}.`,
      data: updated,
    };
  } catch (error) {
    console.error("Gagal memverifikasi izin:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses verifikasi izin." };
  }
}

/**
 * Server Action: Mengambil daftar perizinan santri (Terkontrol Sesi & ABAC Fail-Closed)
 */
export async function getPerizinanListAction(statusFilter?: StatusIzin) {
  const session = await getCurrentSession();
  if (!session) {
    return {
      success: false,
      message: "Akses Ditolak: Sesi otentikasi tidak ditemukan.",
      data: [],
    };
  }

  const where: Prisma.PerizinanSantriWhereInput = {};
  if (statusFilter) where.status = statusFilter;

  // ABAC: Wali Santri & Santri hanya dapat melihat perizinan santri sendiri
  if (session.role === "WS" || session.role === "ST") {
    if (!session.santriId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun belum terhubung dengan data santri.",
        data: [],
      };
    }
    where.santriId = session.santriId;
  } else if (["MK", "KS", "ADM"].includes(session.role) || (await resolveIsMudabbir(session))) {
    // Wewenang operasional kesantrian & perizinan pesantren (Mudir, MK, ADM, Mudabbir)
    // Generic OSDA is NOT Mudabbir and has NO authority
  } else {
    // Fail-Closed: Role di luar MK, KS, ADM, OSDA, WS, ST tidak berwenang membaca data perizinan
    return {
      success: false,
      message: `Akses Ditolak: Role ${session.role} tidak memiliki otorisasi membaca data perizinan.`,
      data: [],
    };
  }

  try {
    const list = await prisma.perizinanSantri.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kodeIzin: true,
        batchId: true,
        tanggalMulai: true,
        tanggalSelesai: true,
        jenis: true,
        alasan: true,
        status: true,
        santriId: true,
        returnedAt: true,
        returnedBy: true,
        isLate: true,
        usesVehicle: true,
        cancelledAt: true,
        cancelledBy: true,
        cancelReason: true,
        santri: {
          select: {
            id: true,
            nama: true,
            nis: true,
            kelas: true,
          },
        },
        disetujuiMK: {
          select: {
            nama: true,
          },
        },
        disetujuiKS: {
          select: {
            nama: true,
          },
        },
      },
    });

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil data perizinan:", error);
    return { success: false, data: [], message: "Gagal mengambil data perizinan santri." };
  }
}

/**
 * Server Action: Catat Absensi Kegiatan Asrama
 */
export async function catatAbsensiAction(params: {
  santriId: string;
  kegiatan: string;
  status: StatusAbsensi;
  catatan?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // MK, OSDA, dan PH yang dapat mencatat absensi asrama
  if (!["MK", "OSDA", "PH", "KS"].includes(session.role)) {
    return { success: false, message: `Role ${session.role} tidak berhak mencatat absensi asrama.` };
  }

  try {
    const record = await prisma.absensi.create({
      data: {
        santriId: params.santriId,
        kegiatan: params.kegiatan,
        status: params.status,
        catatan: params.catatan,
        dicatatOleh: session.username,
      },
      include: { santri: true },
    });

    return {
      success: true,
      message: `Absensi ${record.kegiatan} untuk ${record.santri.nama} (${params.status}) berhasil dicatat.`,
      data: record,
    };
  } catch (error) {
    console.error("Gagal mencatat absensi:", error);
    return { success: false, message: "Gagal mencatat absensi ke pangkalan data." };
  }
}
