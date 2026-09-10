'use server';

import crypto from 'crypto';
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
        santri: { select: { id: true, nama: true, nis: true, kelas: true, jenisKelamin: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

    // Jika akun dinonaktifkan, cabut seluruh sesi aktif
    if (newStatus === UserStatus.NONAKTIF) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
    }

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
 * Reset kata sandi pengguna dengan password acak sementara & pencabutan sesi lama
 * Akses: ADM, KS
 */
export async function resetUserPasswordAction(userId: string): Promise<UsersResponse> {
  try {
    const session = await requireRole(['ADM', 'KS']);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    // Generate sandi sementara acak (bukan default statis)
    const tempPassword = `DUC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const newHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Cabut seluruh sesi aktif lama pengguna
    await prisma.session.deleteMany({ where: { userId: user.id } });

    // Jangan catat plain password ke log audit
    await recordAuditLog(
      session.userId,
      'RESET_PASSWORD',
      'User',
      user.id,
      { targetUser: user.username, reason: 'RESET_BY_ADMIN' }
    );

    return {
      success: true,
      message: `Kata sandi akun ${user.username} berhasil di-reset dengan sandi acak: "${tempPassword}". Seluruh sesi lama telah dicabut.`,
      data: { temporaryPassword: tempPassword },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}

/**
 * Toggle hak akses Petugas Presensi Putri untuk santri putri
 * Akses: ADM, KS (05_ROLE_PERMISSION_MATRIX.md)
 * Aturan Bisnis:
 * - Hanya santri dengan jenisKelamin === "P" yang dapat dijadikan Petugas Presensi Putri.
 * - Server re-check memastikan tidak dapat diberikan kepada santri putra atau non-santri.
 */
export async function togglePetugasPresensiPutriAction(userId: string): Promise<UsersResponse> {
  try {
    const session = await requireRole(['ADM', 'KS']);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        santri: { select: { id: true, nama: true, nis: true, jenisKelamin: true } },
      },
    });

    if (!user) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    if (user.role !== 'ST' || !user.santri) {
      return {
        success: false,
        message: 'Akses Ditolak: Wewenang Petugas Presensi Putri hanya dapat diberikan kepada akun santri.',
      };
    }

    if (user.santri.jenisKelamin !== 'P') {
      return {
        success: false,
        message: `Validasi Gagal: Santri ${user.santri.nama} berjenis kelamin laki-laki (L). Petugas Presensi Putri khusus santriwati (P).`,
      };
    }

    const newStatus = !user.isPetugasPresensiPutri;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isPetugasPresensiPutri: newStatus },
    });

    await recordAuditLog(
      session.userId,
      'TOGGLE_PETUGAS_PRESENSI_PUTRI',
      'User',
      user.id,
      {
        username: user.username,
        santriNama: user.santri.nama,
        santriNis: user.santri.nis,
        isPetugasPresensiPutri: newStatus,
        assignedBy: session.username,
      }
    );

    return {
      success: true,
      message: `Status Petugas Presensi Putri untuk ${user.santri.nama} (${user.username}) berhasil diubah menjadi: ${newStatus ? 'AKTIF' : 'NONAKTIF'}.`,
      data: updated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { success: false, message: errorMsg, error: errorMsg };
  }
}
