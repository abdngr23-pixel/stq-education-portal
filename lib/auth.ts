import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AuthTokenPayload, Role, UserSession } from "@/types/auth";
import prisma from "@/lib/prisma";

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "stq_portal_super_secret_session_key_min_32_characters_long_2026"
);

export const SESSION_COOKIE_NAME = "stq_session_token";

/**
 * Hash password baru dengan salt
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

/**
 * Verifikasi password
 */
export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

/**
 * Buat JWT Session Token (Masa berlaku 7 hari)
 */
export async function createSessionToken(payload: Omit<AuthTokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

/**
 * Verifikasi dan decode JWT Token
 */
export async function verifySessionToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Ambil sesi pengguna saat ini dari HTTP-only Cookie
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      staffId: payload.staffId,
      staffCode: payload.staffCode,
      santriId: payload.santriId,
      name: payload.name,
      halaqohName: payload.halaqohName,
    };
  } catch {
    return null;
  }
}

export const getSession = getCurrentSession;

/**
 * Ekstrak sesi pengguna dari Request (Header Authorization Bearer <token> atau Cookie)
 */
export async function getAuthFromRequest(req: Request): Promise<UserSession | null> {
  try {
    // 1. Cek Header Authorization
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const payload = await verifySessionToken(token);
      if (payload) {
        return {
          userId: payload.sub,
          username: payload.username,
          role: payload.role,
          staffId: payload.staffId,
          staffCode: payload.staffCode,
          santriId: payload.santriId,
          name: payload.name,
          halaqohName: payload.halaqohName,
        };
      }
    }

    // 2. Fallback ke Cookie
    return getCurrentSession();
  } catch {
    return null;
  }
}

/**
 * Guard Helper: Mengharuskan login dengan role tertentu
 */
export async function requireRole(allowedRoles: Role[]): Promise<UserSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: Silakan login terlebih dahulu");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN: Anda tidak memiliki akses untuk tindakan ini");
  }

  return session;
}

/**
 * API-Level Auth + Role Check Guard
 * Memastikan request memiliki token valid dan wewenang role yang tepat.
 * Mengembalikan objek { session } jika sah, atau { errorResponse } jika gagal.
 */
export async function apiGuard(
  req: Request,
  allowedRoles?: Role[]
): Promise<{ session: UserSession; errorResponse?: never } | { session?: never; errorResponse: NextResponse }> {
  const session = await getAuthFromRequest(req);

  if (!session) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Akses API ditolak: Token sesi tidak ditemukan atau telah kedaluwarsa.',
          },
        },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Akses API ditolak: Role '${session.role}' tidak memiliki izin untuk endpoint ini.`,
          },
        },
        { status: 403 }
      ),
    };
  }

  return { session };
}

/**
 * Helper Pencatatan Audit Trail (Mendukung Objek maupun Argumen Posisi)
 */
export async function recordAuditLog(
  paramsOrUserId:
    | {
        userId?: string | null;
        action: string;
        entity: string;
        entityId?: string | null;
        details?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
      }
    | string
    | null
    | undefined,
  action?: string,
  entity?: string,
  entityId?: string | null,
  details?: Record<string, unknown>
) {
  try {
    let payload: {
      userId?: string | null;
      action: string;
      entity: string;
      entityId?: string | null;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    };

    if (typeof paramsOrUserId === "object" && paramsOrUserId !== null) {
      payload = paramsOrUserId;
    } else {
      payload = {
        userId: paramsOrUserId,
        action: action || "UNKNOWN",
        entity: entity || "UNKNOWN",
        entityId,
        details,
      };
    }

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        details: payload.details as any,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
  }
}

