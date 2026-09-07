'use server';

import prisma from '@/lib/prisma';
import { requireRole, recordAuditLog, hashPassword } from '@/lib/auth';
import { UserStatus } from '@prisma/client';

export interface UsersResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Mengambil daftar pengguna & staf sistem
 * Akses: ADM, KS, YAY (05_ROLE_PERMISSION_MATRIX.md)
 */
export async function getUsersListAction(): Promise<UsersResponse> {
  try {
    await requireRole(['ADM', 'KS', 'YAY']);

    const users = await prisma.user.findMany({
      include: {
        staff: { select: { nama: true, staffCode: true, noHp: true } },
        santri: { select: { nama: true, nis: true, kelas: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      success: true,
      message: 'Berhasil memuat daftar pengguna',
      data: users,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Toggle status aktif/nonaktif akun pengguna
 * Akses: ADM, KS
 */
export async function toggleUserStatusAction(userId: string): Promise<UsersResponse> {
  try {
    const session = await requireRole(['ADM', 'KS']);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    const newStatus = user.status === UserStatus.AKTIF ? UserStatus.NONAKTIF : UserStatus.AKTIF;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });

    await recordAuditLog(
      session.userId,
      'TOGGLE_USER_STATUS',
      'User',
      user.id,
      { username: user.username, statusLama: user.status, statusBaru: newStatus }
    );

    return {
      success: true,
      message: `Status akun ${user.username} berhasil diubah menjadi ${newStatus}.`,
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Reset kata sandi pengguna ke password default ("password123")
 * Akses: ADM, KS
 */
export async function resetUserPasswordAction(userId: string): Promise<UsersResponse> {
  try {
    const session = await requireRole(['ADM', 'KS']);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    const newHash = await hashPassword('password123');

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await recordAuditLog(
      session.userId,
      'RESET_PASSWORD',
      'User',
      user.id,
      { targetUser: user.username }
    );

    return {
      success: true,
      message: `Kata sandi akun ${user.username} berhasil di-reset ke "password123".`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
