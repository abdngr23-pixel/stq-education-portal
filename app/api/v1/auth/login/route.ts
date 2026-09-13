import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, createSessionToken, recordAuditLog, SESSION_COOKIE_NAME } from '@/lib/auth';
import { loginSchema, validateData } from '@/lib/validations';
import { Prisma } from '@prisma/client';

/**
 * POST /api/v1/auth/login
 * Kontrak Standar 03_API_ENDPOINTS.md — Database-Only & Fail-Closed
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Input validation (Zod)
    const validation = validateData(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.errors[0] || 'Data login tidak valid.',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const { username, email, password } = validation.data;
    const identifier = (username || email || '').trim();

    let user: Prisma.UserGetPayload<{
      include: { staff: true; santri: true };
    }> | null = null;

    try {
      const dbPromise = prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: identifier, mode: 'insensitive' } },
            { email: { equals: identifier, mode: 'insensitive' } },
            { phone: identifier },
          ],
        },
        include: {
          staff: true,
          santri: true,
        },
      });
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("DB_OFFLINE_TIMEOUT")), 2000)
      );
      user = await Promise.race([dbPromise, timeoutPromise]);
    } catch (dbError) {
      console.error("Database offline atau tidak dapat dijangkau pada REST login:", dbError);
      // FAIL-CLOSED: Database unavailable -> 503 fail closed, tidak mengeluarkan token
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Layanan autentikasi sedang tidak tersedia. Silakan coba beberapa saat lagi.',
          },
        },
        { status: 503 }
      );
    }

    // FAIL-CLOSED: Unknown user -> 401 (tanpa fallback ke katalog statis)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Kredensial login tidak ditemukan atau salah.',
          },
        },
        { status: 401 }
      );
    }

    // Inactive user -> 403
    if (user.status !== "AKTIF") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Akun Anda berstatus nonaktif atau ditangguhkan.',
          },
        },
        { status: 403 }
      );
    }

    // Wrong password -> 401
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Kredensial login tidak valid.',
          },
        },
        { status: 401 }
      );
    }

    // Valid DB user + valid hash -> baru boleh menghasilkan token/session
    const token = await createSessionToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      staffId: user.staffId || undefined,
      santriId: user.santriId || undefined,
    });

    await recordAuditLog({
      userId: user.id,
      action: 'API_LOGIN',
      entity: 'User',
      entityId: user.id,
      details: { role: user.role, client: 'REST_API_V1' },
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Login berhasil.',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            nama: user.staff?.nama || user.santri?.nama || user.username,
            staffId: user.staffId,
            santriId: user.santriId,
          },
        },
      },
      { status: 200 }
    );

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal server';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message },
      },
      { status: 500 }
    );
  }
}
