'use server';

import prisma from '@/lib/prisma';
import { requireRole, getSession, recordAuditLog } from '@/lib/auth';
import { StatusKesehatan, Prisma } from '@prisma/client';
import { shadowAuthorizeIfEnabled } from '@/lib/auth/shadow-engine';
import { createPrismaDataProvider, authorizeCanonical } from '@/lib/auth/canonical-evaluator';

export interface KesehatanResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Catat Kejadian / Keluhan Sakit Santri (Poskestren)
 * Akses PR #11 Baseline: KS (Mudir), MK (Musyrif Keasramaan), ADM (Admin/TU)
 * Catatan Bisnis: Mudabbir & OSDA Petugas Kesehatan berhak secara bisnis (ALLOW),
 * namun implementasi teknis ditangguhkan (deferred) ke STQ Architecture Lock / Keasramaan V2 assignment model.
 */
export async function catatKesehatanAction(formData: {
  santriId: string;
  keluhan: string;
  diagnosa?: string;
  tindakan: string;
  status?: StatusKesehatan;
}): Promise<KesehatanResponse> {
  try {
    const session = await requireRole(['KS', 'MK', 'ADM']);

    // Representative Milestone 2 shadow evaluation (Safe-by-default: OFF in production)
    await shadowAuthorizeIfEnabled({
      session,
      capabilityCode: 'health.case.create',
      legacyCheck: () => ['KS', 'MK', 'ADM'].includes(session.role),
      resourceContext: { santriId: formData.santriId },
      resourceType: 'CatatanKesehatan',
      resourceId: formData.santriId,
      isMutation: true,
      dataProviderFactory: () => createPrismaDataProvider(prisma),
    });

    if (!formData.tindakan || !formData.tindakan.trim()) {
      return { success: false, message: 'Tindakan medis wajib diisi.' };
    }

    const santri = await prisma.santri.findUnique({
      where: { id: formData.santriId },
      select: { id: true, nama: true },
    });

    if (!santri) {
      return { success: false, message: 'Data santri tidak ditemukan.' };
    }

    const sanitizedDiagnosa = formData.diagnosa?.trim() || null;
    const sanitizedTindakan = formData.tindakan.trim();

    const catatan = await prisma.catatanKesehatan.create({
      data: {
        santriId: formData.santriId,
        keluhan: formData.keluhan.trim(),
        diagnosa: sanitizedDiagnosa,
        tindakan: sanitizedTindakan,
        status: formData.status || StatusKesehatan.RAWAT_PONDOK,
        dicatatOleh: session.username,
      },
    });

    await recordAuditLog(
      session.userId,
      'CATAT_KESEHATAN',
      'CatatanKesehatan',
      catatan.id,
      { santri: santri.nama, keluhan: formData.keluhan, status: catatan.status }
    );

    return {
      success: true,
      message: `Catatan kesehatan untuk ${santri.nama} berhasil disimpan (${catatan.status}).`,
      data: catatan,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Update Status Kesehatan & Rujukan Medis
 * Akses PR #11 Baseline: KS (Mudir), MK (Musyrif Keasramaan)
 * ADM dilarang (DENY update status medis); generic OSDA dilarang (DENY).
 * Catatan Bisnis: Mudabbir & OSDA Petugas Kesehatan berhak secara bisnis (ALLOW),
 * namun implementasi teknis ditangguhkan (deferred) ke STQ Architecture Lock / Keasramaan V2 assignment model.
 */
export async function updateStatusKesehatanAction(formData: {
  id: string;
  status: StatusKesehatan;
  tindakanTambahan?: string;
}): Promise<KesehatanResponse> {
  try {
    const session = await requireRole(['MK', 'KS']);

    const existing = await prisma.catatanKesehatan.findUnique({
      where: { id: formData.id },
      include: { santri: true },
    });

    if (!existing) {
      return { success: false, message: 'Catatan kesehatan tidak ditemukan.' };
    }

    // Representative Milestone 2 shadow evaluation (Safe-by-default: OFF in production)
    await shadowAuthorizeIfEnabled({
      session,
      capabilityCode: 'health.case.update_status',
      legacyCheck: () => ['MK', 'KS'].includes(session.role),
      resourceContext: { santriId: existing.santriId },
      resourceType: 'CatatanKesehatan',
      resourceId: formData.id,
      isMutation: true,
      dataProviderFactory: () => createPrismaDataProvider(prisma),
    });

    const updated = await prisma.catatanKesehatan.update({
      where: { id: formData.id },
      data: {
        status: formData.status,
        tindakan: formData.tindakanTambahan
          ? `${existing.tindakan} | [Update]: ${formData.tindakanTambahan}`
          : existing.tindakan,
      },
    });

    await recordAuditLog(
      session.userId,
      'UPDATE_STATUS_KESEHATAN',
      'CatatanKesehatan',
      existing.id,
      { statusLama: existing.status, statusBaru: formData.status }
    );

    return {
      success: true,
      message: `Status kesehatan ${existing.santri.nama} diperbarui menjadi: ${formData.status}.`,
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Ambil Daftar Catatan Kesehatan Santri (Terkontrol Sesi, RBAC & ABAC Fail-Closed)
 */
export async function getDaftarKesehatanAction(filterStatus?: StatusKesehatan): Promise<KesehatanResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: 'Akses Ditolak: Sesi otentikasi tidak ditemukan.', data: [] };
    }

    const where: Prisma.CatatanKesehatanWhereInput = {};
    if (filterStatus) {
      where.status = filterStatus;
    }

    // Role-based authorization & scoping
    if (session.role === 'WS' || session.role === 'ST') {
      if (!session.santriId) {
        return {
          success: false,
          message: 'Akses Ditolak: Akun belum terhubung dengan data santri.',
          data: [],
        };
      }
      where.santriId = session.santriId;
    } else if (session.role === 'KS' || session.role === 'MK' || session.role === 'ADM') {
      // Otoritas manajerial & medis asrama global (PR #11 Technical Baseline): Mudir (KS), Musyrif Keasramaan (MK), Admin/TU (ADM).
    } else {
      // Canonical authorization evaluation for positions such as PENGAWAS_SANTRIWATI (DIR-2026-016 / ORR-049)
      const dataProvider = createPrismaDataProvider(prisma);
      const authDecision = await authorizeCanonical({
        identity: { userId: session.userId },
        capability: "health.case.read_detail",
        dataProvider,
      });

      if (authDecision.decision === "ALLOW") {
        const grant = authDecision.grantUsed;
        const positionCode = grant?.positionCode || authDecision.positionCode;
        const capabilityCode = grant?.capabilityCode || authDecision.capabilityCode;
        const scopeType = grant?.scopeType || authDecision.scopeType;
        const orgDomain = grant?.orgDomain || grant?.anchorUnit?.domain;
        const genderComplex = grant?.genderComplex || grant?.anchorUnit?.genderComplex;

        // Strict 5-point contract check per DIR-2026-016 / ORR-049:
        // A KAMAR/HALAQOH/UNIT or non-matching domain/gender scoped grant must NEVER silently become all-PUTRI access.
        // For the Owner-approved position, accept ONLY the exact contract:
        // 1. positionCode = PENGAWAS_SANTRIWATI
        // 2. capability = health.case.read_detail
        // 3. scopeType = DOMAIN
        // 4. grant orgDomain = KEASRAMAAN
        // 5. grant genderComplex = PUTRI
        const isAuthorizedPengawasSantriwati =
          positionCode === "PENGAWAS_SANTRIWATI" &&
          capabilityCode === "health.case.read_detail" &&
          scopeType === "DOMAIN" &&
          orgDomain === "KEASRAMAAN" &&
          genderComplex === "PUTRI";

        if (isAuthorizedPengawasSantriwati) {
          where.santri = { jenisKelamin: "P" };
        } else {
          return {
            success: false,
            message: "Akses Ditolak: Lingkup otorisasi kesehatan tidak memenuhi kontrak kanonikal yang diizinkan.",
            data: [],
          };
        }
      } else {
        // Role / principal tanpa hak akses membaca data kesehatan: FAIL-CLOSED
        return {
          success: false,
          message: `Akses Ditolak: Role ${session.role} tidak memiliki otorisasi membaca data kesehatan.`,
          data: [],
        };
      }
    }

    const list = await prisma.catatanKesehatan.findMany({
      where,
      select: {
        id: true,
        santriId: true,
        keluhan: true,
        diagnosa: true,
        tindakan: true,
        status: true,
        tanggal: true,
        santri: {
          select: {
            id: true,
            nis: true,
            nama: true,
            kelas: true,
          },
        },
      },
      orderBy: { tanggal: 'desc' },
      take: 50,
    });

    return {
      success: true,
      message: 'Berhasil memuat data kesehatan santri',
      data: list,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg, data: [] };
  }
}
