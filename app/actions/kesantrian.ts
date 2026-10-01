"use server";

import prisma from "@/lib/prisma";
import {
  getCurrentSession,
  recordAuditLog,
} from "@/lib/auth";
import {
  authorizeCanonical,
  createPrismaDataProvider,
  type CanonicalAuthorizationDecision,
} from "@/lib/auth/canonical-evaluator";
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
  menginap?: boolean;
  isMenginap?: boolean;
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

  // Authoritative identity resolution & hard denial for UNIT accounts per DIR-2026-038
  // UNIT accounts (such as osda.putri) are strictly READ-ONLY and must fail closed on ANY mutation.
  // The UNIT must not gain mutation authority via role fallback, username, legacy OSDA semantics, MK/KS fallback, etc.
  let dbUser: { id: string; username: string; status: string; accountType: string; role: string } | null = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, status: true, accountType: true, role: true },
    });
  } catch {
    return { success: false, message: "Database error resolving user identity (FAIL CLOSED)." };
  }

  if (dbUser && dbUser.status !== "AKTIF") {
    return { success: false, message: "Akses Ditolak: Pengguna tidak aktif (FAIL CLOSED)." };
  }

  const isUnitAccount =
    dbUser?.accountType === "UNIT" ||
    (session as unknown as { accountType?: string }).accountType === "UNIT" ||
    session.username === "osda.putri";

  if (isUnitAccount) {
    return {
      success: false,
      message: "Akses Ditolak: Akun UNIT (osda.putri) hanya berwenang untuk monitoring READ-ONLY dan dilarang melakukan pengajuan perizinan (DIR-2026-038).",
    };
  }


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
  const targetAuthorization = new Map<string, CanonicalAuthorizationDecision>();

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
  } else {
    // Operational creation path: evaluate canonical authorization for each target Santri
    const dataProvider = createPrismaDataProvider(prisma);
    let allCanonicalAllowed = true;
    let canonicalDeniedReason = "";
    let canonicalDeniedCode = "";

    for (const santriId of targetSantriIds) {
      const decision = await authorizeCanonical({
        identity: { userId: session.userId },
        capability: "keasramaan.permission.create",
        resourceContext: { santriId },
        isMutation: true,
        dataProvider,
      });
      if (decision.decision === "ALLOW") {
        targetAuthorization.set(santriId, decision);
      } else if (decision.decision === "ERROR") {
        return {
          success: false,
          message: `Database error evaluating canonical authorization: ${decision.reason || "Database unavailable"} (FAIL CLOSED).`,
        };
      } else {
        allCanonicalAllowed = false;
        canonicalDeniedCode = decision.code;
        canonicalDeniedReason = decision.reason;
        break;
      }
    }

    if (allCanonicalAllowed && targetAuthorization.size === targetSantriIds.length) {
      // Authorized via canonical capability
      const firstDecision = targetAuthorization.get(targetSantriIds[0])!;
      if (firstDecision.positionCode === "PEMBINA_HALAQOH") {
        const d1 = new Date(input.tanggalMulai);
        const d2 = new Date(input.tanggalSelesai);
        const isSameDay = getWitaDateString(d1) === getWitaDateString(d2);
        const usesVehicle = Boolean(input.usesVehicle);
        const isMultiDay = !isSameDay;
        const isMenginap = Boolean(input.menginap || input.isMenginap || isMultiDay || input.jenis === JenisIzin.PULANG);

        if (isSameDay && input.jenis === JenisIzin.KELUAR_KOMPLEK && !usesVehicle && !isMenginap) {
          initialStatus = StatusIzin.DISETUJUI;
        } else {
          initialStatus = StatusIzin.MENUNGGU_MK;
        }
        submissionRole = "MUDABBIR";
      } else if (firstDecision.positionCode === "KEPALA_KEASRAMAAN") {
        initialStatus = StatusIzin.DISETUJUI;
        submissionRole = "MK";
      } else if (firstDecision.positionCode === "MUDIR") {
        initialStatus = StatusIzin.DISETUJUI;
        submissionRole = "KS";
      } else {
        initialStatus = StatusIzin.DISETUJUI;
        submissionRole = firstDecision.positionCode || session.role;
      }
    } else {
      // Fail closed: Zero role fallback per DIR-2026-039 (C1).
      if (canonicalDeniedCode === "SCOPE_MISMATCH") {
        return {
          success: false,
          message: "Akses Ditolak: santri berada di luar cakupan binaan (SCOPE_MISMATCH).",
        };
      }
      if (canonicalDeniedCode === "INVALID_RESOURCE_CONTEXT") {
        return {
          success: false,
          message: "Akses Ditolak: santri tidak memiliki penempatan kamar yang aktif (INVALID_RESOURCE_CONTEXT).",
        };
      }
      if (canonicalDeniedCode === "CAPABILITY_NOT_GRANTED") {
        return {
          success: false,
          message: `Akses Ditolak: ${canonicalDeniedReason || "Pengguna tidak memiliki kapabilitas keasramaan.permission.create (CAPABILITY_NOT_GRANTED)." }`,
        };
      }
      if (session.role === "OSDA") {
        return {
          success: false,
          message: "Akses Ditolak: Akun generic OSDA tidak memiliki kewenangan perizinan santri. Mudabbir bukan OSDA.",
        };
      }
      if (session.role === "ADM") {
        return {
          success: false,
          message: "Akses Ditolak: Role ADM tidak memiliki kewenangan operasional pencatatan izin santri secara otomatis. Hanya pemegang kapabilitas canonical yang berwenang.",
        };
      }
      if (session.role === "WS") {
        return {
          success: false,
          message: "Akses Ditolak: Wali Santri tidak berwenang mengajukan izin mandiri tanpa persetujuan santri/musyrif.",
        };
      }
      return {
        success: false,
        message: `Akses ditolak: ${canonicalDeniedReason || `Role ${session.role} tidak memiliki kewenangan mengajukan perizinan santri.`}`,
      };
    }
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
          usesVehicle: Boolean(input.usesVehicle),
          status: initialStatus,
          diajukanOlehRole: submissionRole,
          diajukanOlehUserId: session.userId,
          ...(initialStatus === StatusIzin.DISETUJUI && targetAuthorization.get(sId)?.positionCode === "KEPALA_KEASRAMAAN" && session.staffId
            ? { disetujuiMKId: session.staffId }
            : {}),
          ...(initialStatus === StatusIzin.DISETUJUI && targetAuthorization.get(sId)?.positionCode === "MUDIR" && session.staffId
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
          canonicalAuthorization: targetAuthorization.has(sId)
            ? {
                assignmentId: targetAuthorization.get(sId)?.assignmentId,
                positionCode: targetAuthorization.get(sId)?.positionCode,
                capabilityCode: targetAuthorization.get(sId)?.capabilityCode,
                scopeType: targetAuthorization.get(sId)?.scopeType,
              }
            : undefined,
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

  // Hard denial for UNIT accounts per DIR-2026-038
  let dbUser: { id: string; username: string; status: string; accountType: string; role: string } | null = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, status: true, accountType: true, role: true },
    });
  } catch {
    return { success: false, message: "Database error resolving user identity (FAIL CLOSED)." };
  }

  if (dbUser && dbUser.status !== "AKTIF") {
    return { success: false, message: "Akses Ditolak: Pengguna tidak aktif (FAIL CLOSED)." };
  }

  const isUnitReturn =
    dbUser?.accountType === "UNIT" ||
    (session as unknown as { accountType?: string }).accountType === "UNIT" ||
    session.username === "osda.putri";

  if (isUnitReturn) {
    return {
      success: false,
      message: "Akses Ditolak: Akun UNIT (osda.putri) hanya berwenang untuk monitoring READ-ONLY dan dilarang melakukan konfirmasi kepulangan perizinan (DIR-2026-038).",
    };
  }

  // Authoritative Canonical Authorization Check (DIR-2026-039 / C1)
  const dataProvider = createPrismaDataProvider(prisma);
  const decision = await authorizeCanonical({
    identity: { userId: session.userId },
    capability: "keasramaan.permission.update",
    dataProvider,
  });

  if (decision.decision !== "ALLOW") {
    if (decision.decision === "ERROR") {
      return {
        success: false,
        message: `Database error evaluating canonical authorization: ${decision.reason || "Database unavailable"} (FAIL CLOSED).`,
      };
    }
    return {
      success: false,
      message: `Akses ditolak: ${decision.reason || "Pengguna tidak memiliki otoritas konfirmasi kepulangan santri."}`,
    };
  }

  let izin;
  try {
    izin = await prisma.perizinanSantri.findUnique({
      where: { id: params.izinId },
      include: { santri: true },
    });
  } catch (error) {
    console.error("Gagal membaca data perizinan:", error);
    return { success: false, message: "Database error resolving permission (FAIL CLOSED)." };
  }

  if (!izin) {
    return { success: false, message: "Data izin tidak ditemukan." };
  }

  if (izin.status !== StatusIzin.DISETUJUI) {
    return {
      success: false,
      message: `Hanya izin berstatus DISETUJUI yang dapat dikonfirmasi kepulangannya (Status saat ini: ${izin.status}).`,
    };
  }

  // Scoped check for UNIT-scoped Mudabbir
  if (decision.scopeType === "UNIT" || decision.positionCode === "PEMBINA_HALAQOH") {
    const scopedDecision = await authorizeCanonical({
      identity: { userId: session.userId },
      capability: "keasramaan.permission.update",
      resourceContext: { santriId: izin.santriId },
      isMutation: true,
      dataProvider,
    });
    if (scopedDecision.decision !== "ALLOW") {
      return {
        success: false,
        message: "Akses Ditolak: santri berada di luar cakupan binaan (SCOPE_MISMATCH).",
      };
    }
  }

  try {
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

  // Hard denial for UNIT accounts per DIR-2026-038
  let dbUser: { id: string; username: string; status: string; accountType: string; role: string } | null = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, status: true, accountType: true, role: true },
    });
  } catch {
    return { success: false, message: "Database error resolving user identity (FAIL CLOSED)." };
  }

  if (dbUser && dbUser.status !== "AKTIF") {
    return { success: false, message: "Akses Ditolak: Pengguna tidak aktif (FAIL CLOSED)." };
  }

  const isUnitCancel =
    dbUser?.accountType === "UNIT" ||
    (session as unknown as { accountType?: string }).accountType === "UNIT" ||
    session.username === "osda.putri";

  if (isUnitCancel) {
    return {
      success: false,
      message: "Akses Ditolak: Akun UNIT (osda.putri) hanya berwenang untuk monitoring READ-ONLY dan tidak memiliki hak akses membatalkan perizinan (DIR-2026-038).",
    };
  }

  const cancelReason = (params.alasan || "").trim();
  if (cancelReason.length < 3) {
    return { success: false, message: "Alasan pembatalan izin wajib diisi minimal 3 karakter." };
  }

  // Authorization Evaluation (DIR-2026-039 / C1):
  let izin;
  if (session.role === "ST") {
    // 1. Santri self-service cancellation: own still-pending request only
    try {
      izin = await prisma.perizinanSantri.findUnique({
        where: { id: params.izinId },
        include: { santri: true },
      });
    } catch (error) {
      console.error("Gagal membaca data perizinan:", error);
      return { success: false, message: "Database error resolving permission (FAIL CLOSED)." };
    }

    if (!izin) {
      return { success: false, message: "Data izin tidak ditemukan." };
    }

    if (izin.santriId !== session.santriId || izin.status !== StatusIzin.MENUNGGU_MK) {
      return {
        success: false,
        message:
          "Akses Ditolak: Anda hanya dapat membatalkan permohonan izin Anda yang masih berstatus menunggu verifikasi.",
      };
    }
  } else {
    // 2. Operational staff cancellation: must hold canonical 'keasramaan.permission.update'
    const dataProvider = createPrismaDataProvider(prisma);
    const decision = await authorizeCanonical({
      identity: { userId: session.userId },
      capability: "keasramaan.permission.update",
      dataProvider,
    });

    if (decision.decision !== "ALLOW") {
      if (decision.decision === "ERROR") {
        return {
          success: false,
          message: `Database error evaluating canonical authorization: ${decision.reason || "Database unavailable"} (FAIL CLOSED).`,
        };
      }
      return {
        success: false,
        message: `Akses Ditolak: Anda tidak memiliki hak akses membatalkan perizinan. (${decision.reason || "Pengguna tidak memiliki otoritas membatalkan perizinan santri."})`,
      };
    }

    try {
      izin = await prisma.perizinanSantri.findUnique({
        where: { id: params.izinId },
        include: { santri: true },
      });
    } catch (error) {
      console.error("Gagal membaca data perizinan:", error);
      return { success: false, message: "Database error resolving permission (FAIL CLOSED)." };
    }

    if (!izin) {
      return { success: false, message: "Data izin tidak ditemukan." };
    }

    if (izin.status === StatusIzin.DIBATALKAN) {
      return { success: false, message: "Izin ini telah dibatalkan sebelumnya." };
    }

    if (izin.status === StatusIzin.KEMBALI_TERKONFIRMASI) {
      return { success: false, message: "Izin yang santrinya sudah kembali tidak dapat dibatalkan." };
    }

    // Scoped check for UNIT-scoped Mudabbir
    if (decision.scopeType === "UNIT" || decision.positionCode === "PEMBINA_HALAQOH") {
      const scopedDecision = await authorizeCanonical({
        identity: { userId: session.userId },
        capability: "keasramaan.permission.update",
        resourceContext: { santriId: izin.santriId },
        isMutation: true,
        dataProvider,
      });
      if (scopedDecision.decision !== "ALLOW") {
        return {
          success: false,
          message: "Akses Ditolak: santri berada di luar cakupan binaan (SCOPE_MISMATCH).",
        };
      }

      // Mudabbir operational rule: Mudabbir may only cancel permissions submitted by own account
      if (izin.diajukanOlehUserId !== session.userId) {
        return {
          success: false,
          message: "Akses Ditolak: Mudabbir hanya dapat membatalkan izin yang diajukan oleh akun sendiri.",
        };
      }
    }
  }

  try {
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

  // Hard denial for UNIT accounts per DIR-2026-038
  let dbUser: { id: string; username: string; status: string; accountType: string; role: string } | null = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, status: true, accountType: true, role: true },
    });
  } catch {
    return { success: false, message: "Database error resolving user identity (FAIL CLOSED)." };
  }

  if (dbUser && dbUser.status !== "AKTIF") {
    return { success: false, message: "Akses Ditolak: Pengguna tidak aktif (FAIL CLOSED)." };
  }

  const isUnitVerify =
    dbUser?.accountType === "UNIT" ||
    (session as unknown as { accountType?: string }).accountType === "UNIT" ||
    session.username === "osda.putri";

  if (isUnitVerify) {
    return {
      success: false,
      message: "Akses Ditolak: Akun UNIT (osda.putri) hanya berwenang untuk monitoring READ-ONLY dan dilarang melakukan verifikasi/approval perizinan (DIR-2026-038).",
    };
  }

  let izin;
  try {
    izin = await prisma.perizinanSantri.findUnique({
      where: { id: params.izinId },
      include: { santri: true },
    });
  } catch (error) {
    console.error("Gagal membaca data perizinan:", error);
    return { success: false, message: "Database error resolving permission (FAIL CLOSED)." };
  }

  if (!izin) {
    return { success: false, message: "Data izin tidak ditemukan." };
  }

  // Authoritative Canonical Evaluation for Permission Verification (DIR-2026-039 / C1)
  const dataProvider = createPrismaDataProvider(prisma);

  let ksDecision: CanonicalAuthorizationDecision | null = null;
  let mkDecision: CanonicalAuthorizationDecision | null = null;

  try {
    // Check if actor has Mudir final approval authority (approve_ks)
    ksDecision = await authorizeCanonical({
      identity: { userId: session.userId },
      capability: "keasramaan.permission.approve_ks",
      resourceContext: { santriId: izin.santriId },
      isMutation: true,
      dataProvider,
    });
  } catch (e) {
    console.error("Canonical evaluation error for approve_ks:", e);
    return { success: false, message: "Database error evaluating canonical authorization (FAIL CLOSED)." };
  }

  try {
    // Check if actor has Kepala Keasramaan MK approval authority (approve_mk)
    mkDecision = await authorizeCanonical({
      identity: { userId: session.userId },
      capability: "keasramaan.permission.approve_mk",
      resourceContext: { santriId: izin.santriId },
      isMutation: true,
      dataProvider,
    });
  } catch (e) {
    console.error("Canonical evaluation error for approve_mk:", e);
    return { success: false, message: "Database error evaluating canonical authorization (FAIL CLOSED)." };
  }

  if (ksDecision?.decision === "ERROR" || mkDecision?.decision === "ERROR") {
    return { success: false, message: "Database error evaluating canonical authorization (FAIL CLOSED)." };
  }

  const hasApproveKS = ksDecision?.decision === "ALLOW";
  const hasApproveMK = mkDecision?.decision === "ALLOW";

  if (!hasApproveKS && !hasApproveMK) {
    return {
      success: false,
      message: "Akses Ditolak: Anda tidak memiliki otoritas verifikasi/approval perizinan (keasramaan.permission.approve_mk atau approve_ks).",
    };
  }

  // Enforcement: Kepala Keasramaan cannot exercise approve_ks
  if (izin.status === StatusIzin.MENUNGGU_KS && !hasApproveKS) {
    return {
      success: false,
      message: "Akses Ditolak: Kepala Keasramaan tidak berwenang memberikan persetujuan akhir Mudir (approve_ks).",
    };
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
    // Jika izin PULANG dan aktor hanya memiliki hak approve_mk (bukan approve_ks), eskalasi ke KS
    if (izin.jenis === JenisIzin.PULANG && !hasApproveKS && izin.status !== StatusIzin.MENUNGGU_KS) {
      newStatus = StatusIzin.MENUNGGU_KS;
      if (session.staffId) updateData.disetujuiMK = { connect: { id: session.staffId } };
    } else {
      newStatus = StatusIzin.DISETUJUI;
      if (hasApproveKS && session.staffId) {
        updateData.disetujuiKS = { connect: { id: session.staffId } };
      } else if (hasApproveMK && session.staffId) {
        updateData.disetujuiMK = { connect: { id: session.staffId } };
      }
    }
  }

  updateData.status = newStatus;

  try {
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
 * Server Action: Mengambil daftar perizinan santri (Terkontrol Sesi & ABAC / Canonical Evaluator Fail-Closed)
 * DIR-2026-038: osda.putri is a shared UNIT account for READ-ONLY monitoring across ALL SANTRIWATI PUTRI.
 * Scope model: DOMAIN / KEASRAMAAN + PUTRI gender boundary.
 * PUTRA data must NEVER be returned to this UNIT account.
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

  // Resolve canonical user from DB if present
  let dbUser: {
    id: string;
    username: string;
    status: string;
    accountType: string;
    staffId: string | null;
    santriId: string | null;
    role: string;
  } | null = null;

  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        status: true,
        accountType: true,
        staffId: true,
        santriId: true,
        role: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Database error resolving user identity: ${msg} (FAIL CLOSED).`,
      data: [],
    };
  }

  // If database record exists, verify it is strictly AKTIF
  if (dbUser && dbUser.status !== "AKTIF") {
    return {
      success: false,
      message: "Akses Ditolak: Pengguna tidak aktif (FAIL CLOSED).",
      data: [],
    };
  }

  const effectiveAccountType = dbUser?.accountType || (session as unknown as { accountType?: string }).accountType || (session.username === "osda.putri" ? "UNIT" : "PERSONAL");
  const effectiveRole = dbUser?.role || session.role;
  const isUnitAccount = effectiveAccountType === "UNIT" || session.username === "osda.putri" || session.role === "OSDA";

  const where: Prisma.PerizinanSantriWhereInput = {};
  if (statusFilter) where.status = statusFilter;

  if (isUnitAccount) {
    // 1. UNIT Account (osda.putri) — Canonical Authorization per DIR-2026-038
    // Invariants:
    // - Never authorize from username or legacy role alone.
    // - Resolve canonical identity, assignment, PositionCapability, and scope.
    // - Required capability: keasramaan.permission.read
    // - Required scope: DOMAIN / KEASRAMAAN
    // - Server-resolved target gender MUST be PUTRI.
    // - PUTRA data must never be returned.
    // - Missing gender/resource context: FAIL CLOSED.
    // - Database/resource-resolution failure: FAIL CLOSED.
    if (!dbUser || dbUser.status !== "AKTIF") {
      return {
        success: false,
        message: "Akses Ditolak: Akun UNIT tidak aktif atau tidak ditemukan dalam database (FAIL CLOSED).",
        data: [],
      };
    }

    const dataProvider = createPrismaDataProvider(prisma);
    const authRes = await authorizeCanonical({
      identity: { userId: dbUser.id },
      capability: "keasramaan.permission.read",
      dataProvider,
    });

    if (authRes.decision !== "ALLOW") {
      return {
        success: false,
        message: `Akses Ditolak: ${authRes.reason || "Akun UNIT tidak memiliki kapabilitas keasramaan.permission.read yang aktif dan terverifikasi."}`,
        data: [],
      };
    }

    if (authRes.scopeType !== "DOMAIN") {
      return {
        success: false,
        message: `Akses Ditolak: Cakupan kapabilitas (${authRes.scopeType}) tidak sesuai, diharapkan DOMAIN (DIR-2026-038).`,
        data: [],
      };
    }

    const grantDomain =
      (authRes.grantUsed as unknown as { orgDomain?: string; domain?: string })?.orgDomain ||
      (authRes.grantUsed as unknown as { orgDomain?: string; domain?: string })?.domain;
    if (grantDomain && grantDomain !== "KEASRAMAAN") {
      return {
        success: false,
        message: `Akses Ditolak: Domain kapabilitas (${grantDomain}) tidak sesuai, diharapkan KEASRAMAAN.`,
        data: [],
      };
    }

    // Authoritative verification of actor UNIT gender boundary & operational model (R2-BLOCKER-04 / DIR-2026-038)
    // A hypothetical PUTRA UNIT or unconstrained UNIT with the same capability MUST NOT read PUTRI records.
    const actorUnitIdentity = await dataProvider.getIdentity(dbUser.id);
    const actorUnitPlacement = await dataProvider.getUnitAccountPlacement(dbUser.id);
    const actorUnitGender =
      (authRes.grantUsed as unknown as { genderComplex?: string })?.genderComplex ||
      actorUnitIdentity?.genderComplex ||
      actorUnitPlacement?.genderComplex;

    if (actorUnitGender !== "PUTRI") {
      return {
        success: false,
        message: `Akses Ditolak: Akun UNIT dengan batas gender '${actorUnitGender ?? "TIDAK_TERIKAT"}' tidak berwenang mengakses data santriwati PUTRI (GENDER_COMPLEX_DENIED).`,
        error: "GENDER_COMPLEX_DENIED",
        data: [],
      };
    }

    // Server-side query boundary: strictly limit to female santri (jenisKelamin = 'P')
    where.santri = {
      jenisKelamin: "P",
    };
  } else if (effectiveRole === "WS" || effectiveRole === "ST") {
    // 2. Wali Santri & Santri Self-Service
    const santriId = dbUser?.santriId || session.santriId;
    if (!santriId) {
      return {
        success: false,
        message: "Akses Ditolak: Akun belum terhubung dengan data santri.",
        data: [],
      };
    }
    where.santriId = santriId;
  } else {
    // 3. PERSONAL Staff Accounts: Strictly canonical authorization via 'keasramaan.permission.read'
    // Legacy roles (MK, KS, ADM) and ad-hoc mudabbir flags are strictly eliminated.
    // ADM has no canonical grant (ADM_PERMISSION_READ_POLICY = DEFERRED_UNTIL_FUTURE_OWNER_DECISION / NO_CURRENT_AUTHORITY).
    if (effectiveRole === "ADM") {
      return {
        success: false,
        message: "Akses Ditolak: Role ADM tidak memiliki otorisasi membaca data perizinan (ADM_PERMISSION_READ_POLICY: DEFERRED / NO_CURRENT_AUTHORITY).",
        data: [],
      };
    }

    if (!dbUser || dbUser.status !== "AKTIF") {
      return {
        success: false,
        message: "Akses Ditolak: Akun pengguna tidak aktif atau tidak ditemukan dalam database (FAIL CLOSED).",
        data: [],
      };
    }

    const dataProvider = createPrismaDataProvider(prisma);
    const authRes = await authorizeCanonical({
      identity: { userId: dbUser.id },
      capability: "keasramaan.permission.read",
      dataProvider,
    }).catch(() => null);

    if (!authRes || authRes.decision !== "ALLOW") {
      return {
        success: false,
        message: `Akses Ditolak: ${authRes?.reason || "Pengguna tidak memiliki kapabilitas keasramaan.permission.read yang aktif dan terverifikasi (FAIL CLOSED)."}` ,
        data: [],
      };
    }

    // Evaluate canonical position + scope contracts:
    // A. MUDIR: institutional authority (GLOBAL scope)
    if (authRes.positionCode === "MUDIR") {
      if (authRes.scopeType !== "GLOBAL") {
        return {
          success: false,
          message: `Akses Ditolak: Cakupan kapabilitas Mudir (${authRes.scopeType}) tidak sesuai, diharapkan GLOBAL.`,
          data: [],
        };
      }
      // MUDIR GLOBAL: institutional read of all permissions
    } else if (authRes.positionCode === "KEPALA_KEASRAMAAN") {
      // B. KEPALA_KEASRAMAAN: domain authority (DOMAIN / KEASRAMAAN)
      if (authRes.scopeType !== "DOMAIN") {
        return {
          success: false,
          message: `Akses Ditolak: Cakupan kapabilitas Kepala Keasramaan (${authRes.scopeType}) tidak sesuai, diharapkan DOMAIN.`,
          data: [],
        };
      }
      const grantDomain =
        (authRes.grantUsed as unknown as { orgDomain?: string; domain?: string })?.orgDomain ||
        (authRes.grantUsed as unknown as { orgDomain?: string; domain?: string })?.domain;
      if (grantDomain && grantDomain !== "KEASRAMAAN") {
        return {
          success: false,
          message: `Akses Ditolak: Domain kapabilitas (${grantDomain}) tidak sesuai, diharapkan KEASRAMAAN.`,
          data: [],
        };
      }
      // KEPALA_KEASRAMAAN DOMAIN: domain access to Keasramaan permissions
    } else if (authRes.positionCode === "PEMBINA_HALAQOH") {
      // C. PEMBINA_HALAQOH (Mudabbir / Pembina Kamar): KAMAR scope
      // Resource chain:
      // PERSONAL identity -> ACTIVE PEMBINA_HALAQOH assignment -> VERIFIED_PRODUCTION keasramaan.permission.read
      // -> KAMAR scope -> active SantriKamarPlacement -> permission target santri -> ALLOW
      if (authRes.scopeType !== "KAMAR") {
        return {
          success: false,
          message: `Akses Ditolak: Cakupan kapabilitas Pembina Kamar (${authRes.scopeType}) tidak sesuai, diharapkan KAMAR.`,
          data: [],
        };
      }

      const kamarId = authRes.grantUsed?.anchorUnitId || authRes.grantUsed?.unitIds?.[0];
      if (!kamarId) {
        return {
          success: false,
          message: "Akses Ditolak: Pembina Kamar tidak memiliki unit kamar terdaftar (FAIL CLOSED).",
          data: [],
        };
      }

      // Query active SantriKamarPlacement for this kamar
      try {
        const placements = await prisma.santriKamarPlacement.findMany({
          where: {
            kamarId,
            isActive: true,
          },
          select: {
            santriId: true,
          },
        });

        if (placements.length === 0) {
          // Zero active placements in assigned Kamar -> return empty list
          return { success: true, data: [] };
        }

        const allowedSantriIds = placements.map((p) => p.santriId);
        where.santriId = { in: allowedSantriIds };
      } catch (err) {
        console.error("Gagal memeriksa santriKamarPlacement untuk Pembina Kamar:", err);
        return {
          success: false,
          message: "Gagal memeriksa penempatan kamar santri (FAIL CLOSED).",
          data: [],
        };
      }
    } else {
      // Fail closed for any unexpected position
      return {
        success: false,
        message: `Akses Ditolak: Posisi ${authRes.positionCode} tidak berwenang membaca data perizinan.`,
        data: [],
      };
    }
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
            jenisKelamin: true,
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

    // Defense-in-depth: Server-side validation of retrieved data for UNIT accounts
    // Fail closed if any record has missing gender or non-PUTRI gender
    if (isUnitAccount) {
      for (const item of list) {
        if (!item.santri || !item.santri.jenisKelamin) {
          return {
            success: false,
            message: "FAIL CLOSED: Terdeteksi data perizinan dengan konteks gender santri yang tidak lengkap/hilang.",
            data: [],
          };
        }
        if (item.santri.jenisKelamin !== "P") {
          return {
            success: false,
            message: "FAIL CLOSED: Kebocoran data santri PUTRA terdeteksi pada akun pemantauan PUTRI.",
            data: [],
          };
        }
      }
    }

    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil data perizinan:", error);
    return { success: false, data: [], message: "Gagal mengambil data perizinan santri (FAIL CLOSED)." };
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

  // MK, PH, dan KS yang dapat mencatat absensi asrama (OSDA generic role-only write denied pending canonical policy)
  if (session.role === "OSDA" || session.username === "osda.putri") {
    return { success: false, message: "Akses Ditolak: Akun UNIT (osda.putri) / Generic OSDA dilarang melakukan pencatatan absensi asrama (DIR-2026-038)." };
  }
  if (!["MK", "PH", "KS"].includes(session.role)) {
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
