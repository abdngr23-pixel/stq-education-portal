'use server';

import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export interface UsersResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Dedicated Safe User Projection DTO (SEV-0 Blocker Remediation AUDIT-R1_3-001)
 * Strictly excludes: passwordHash, password, sessionToken, sessions, email, phone, staff.noHp, internal authorization relations.
 */
export interface SafeUserItemDTO {
  id: string;
  username: string;
  role: string;
  status: string;
  isPetugasPresensiPutri: boolean;
  staff: { nama: string } | null;
  santri: { id: string; nama: string; nis: string; jenisKelamin: string } | null;
}

/**
 * Mengambil daftar pengguna & staf sistem dengan safe projection
 * Akses: ADM, KS, YAY (05_ROLE_PERMISSION_MATRIX.md)
 */
export async function getUsersListAction(): Promise<UsersResponse<SafeUserItemDTO[]>> {
  try {
    await requireRole(['ADM', 'KS', 'YAY']);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        isPetugasPresensiPutri: true,
        staff: { select: { nama: true } },
        santri: { select: { id: true, nama: true, nis: true, jenisKelamin: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      success: true,
      message: 'Berhasil memuat daftar pengguna',
      data: users as SafeUserItemDTO[],
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes('UNAUTHORIZED') || err.message.toLowerCase().includes('login')) {
        return { success: false, message: 'Silakan login terlebih dahulu', error: 'UNAUTHORIZED', errorCode: 'UNAUTHORIZED' };
      }
      if (err.message.includes('FORBIDDEN') || err.message.toLowerCase().includes('tidak memiliki akses') || err.message.toLowerCase().includes('akses ditolak')) {
        return { success: false, message: 'Akses Ditolak: Anda tidak memiliki kewenangan untuk melihat daftar pengguna.', error: 'UNAUTHORIZED', errorCode: 'UNAUTHORIZED' };
      }
    }
    // Error Sanitization (AUDIT-R1_3-001): Never expose raw Prisma/database internal errors to client
    console.error('[UsersAction Error: getUsersListAction]', err);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat daftar pengguna.',
      error: 'INTERNAL_ERROR',
      errorCode: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Toggle status aktif/nonaktif akun pengguna (POST_LAUNCH_LOCKED)
 * Menolak mutasi pada Day-1 karena wewenang mutasi system.user.manage belum aktif (AUDIT-R1_3-003).
 */
export async function toggleUserStatusAction(userId: string): Promise<UsersResponse> {
  void userId;
  return {
    success: false,
    message: 'Fitur perubahan status pengguna belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).',
    errorCode: 'POLICY_NOT_ACTIVE',
    error: 'POLICY_NOT_ACTIVE',
  };
}

/**
 * Reset kata sandi pengguna (POST_LAUNCH_LOCKED)
 * Menolak mutasi pada Day-1 karena wewenang mutasi system.user.manage belum aktif (AUDIT-R1_3-003).
 */
export async function resetUserPasswordAction(userId: string, newPassword?: string): Promise<UsersResponse> {
  void userId;
  void newPassword;
  return {
    success: false,
    message: 'Fitur reset kata sandi pengguna belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).',
    errorCode: 'POLICY_NOT_ACTIVE',
    error: 'POLICY_NOT_ACTIVE',
  };
}

/**
 * Toggle hak akses Petugas Presensi Putri (POST_LAUNCH_LOCKED)
 * Menolak mutasi pada Day-1 karena wewenang mutasi system.user.manage belum aktif (AUDIT-R1_3-003).
 */
export async function togglePetugasPresensiPutriAction(userId: string): Promise<UsersResponse> {
  void userId;
  return {
    success: false,
    message: 'Fitur pengaturan hak akses khusus pengguna belum diaktifkan pada tahap peluncuran ini (Post-Launch Locked).',
    errorCode: 'POLICY_NOT_ACTIVE',
    error: 'POLICY_NOT_ACTIVE',
  };
}
