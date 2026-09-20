import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AuthTokenPayload, Role, UserSession } from "@/types/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL SECURITY ERROR: AUTH_SECRET wajib dikonfigurasi minimal 32 karakter di lingkungan produksi."
      );
    }
    return new TextEncoder().encode("stq_portal_dev_secret_key_min_32_characters_long_2026");
  }
  return new TextEncoder().encode(secret);
}

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
    .sign(getAuthSecretKey());
}

/**
 * Verifikasi dan decode JWT Token
 */
export async function verifySessionToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    return payload as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Predikat keamanan: Mock sesi HANYA diizinkan pada runtime pengujian eksplisit terisolasi.
 * Mencegah kebocoran mock session ke development, staging, maupun production.
 */
export function isExplicitTestRuntime(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.IS_TEST_RUN === "true" &&
    process.env.ALLOW_ISOLATED_TEST_DB === "true"
  );
}

/**
 * Predikat keamanan: Demo login HANYA diizinkan pada runtime non-produksi
 * dengan explicit server opt-in flag STQ_ENABLE_DEMO_LOGIN === "true".
 */
export function isDemoLoginAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.STQ_ENABLE_DEMO_LOGIN === "true";
}

let testSessionMock: UserSession | null | undefined = undefined;

/**
 * Mock sesi untuk lingkungan pengujian (HANYA bekerja pada explicit test runtime)
 */
export function setTestSession(session: UserSession | null | undefined): void {
  if (isExplicitTestRuntime()) {
    testSessionMock = session;
  }
}

/**
 * Unified Session Resolver: Validasi dan hidrasi sesi pengguna dari JWT payload.
 * Menegakkan fail-closed policy dan menghidrasi atribut otorisasi dari database terkini.
 */
export async function resolveVerifiedSessionPayload(
  payload: AuthTokenPayload
): Promise<UserSession | null> {
  if (!payload || !payload.sub) {
    return null;
  }

  const isProd = process.env.NODE_ENV === "production";

  // 1. Tolak seluruh identitas sintetik (user_*, stf_*) di production
  if (payload.sub.startsWith("user_") || payload.sub.startsWith("stf_")) {
    if (isProd || (!isDemoLoginAllowed() && !isExplicitTestRuntime())) {
      return null;
    }
    // Lingkungan non-produksi dengan explicit demo opt-in (STQ_ENABLE_DEMO_LOGIN === "true")
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      staffId: payload.staffId ?? null,
      staffCode: payload.staffCode ?? null,
      santriId: payload.santriId ?? null,
      name: payload.name ?? payload.username,
      halaqohName: payload.halaqohName ?? null,
      isKepalaBidangTahfidz: payload.isKepalaBidangTahfidz ?? false,
      isPetugasPresensiPutri: payload.isPetugasPresensiPutri ?? false,
    };
  }

  // 2. Validasi ke PostgreSQL via Prisma (Optimized select query & 8s timeout with cleanup)
  let user = null;
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const dbPromise = prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        staffId: true,
        santriId: true,
        isPetugasPresensiPutri: true,
        staff: {
          select: {
            nama: true,
            staffCode: true,
            isKepalaBidangTahfidz: true,
            halaqohDipimpin: {
              select: { nama: true },
              take: 1,
            },
          },
        },
        santri: {
          select: {
            nama: true,
            halaqoh: {
              select: { nama: true },
            },
          },
        },
      },
    });
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("DB_TIMEOUT")), 8000);
    });
    user = await Promise.race([dbPromise, timeoutPromise]);
  } catch (dbErr) {
    console.warn("Verifikasi database sesi pengguna gagal atau timeout:", dbErr);
    // FAIL-CLOSED: Jika DB offline, timeout, atau Prisma error, batalkan session
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // 3. User wajib ditemukan di database (User yang dihapus langsung ditolak)
  if (!user) {
    return null;
  }

  // 4. Status akun wajib AKTIF (Revocation akun langsung efektif)
  if (user.status !== "AKTIF") {
    return null;
  }

  // 5. Role database wajib sama persis dengan claim token (Perubahan role langsung membatalkan session lama)
  if (user.role !== payload.role) {
    return null;
  }

  // 6. HYDRATE AUTHORIZATION ATTRIBUTES DARI DATABASE TERKINI
  const isKabid = Boolean(user.staff?.isKepalaBidangTahfidz);
  const isPetugasPresensiPutri = Boolean(user.isPetugasPresensiPutri);
  const staffCode = user.staff?.staffCode ?? null;
  const displayName = user.staff?.nama || user.santri?.nama || user.username;

  let halaqohName: string | null = null;
  if (user.staff?.halaqohDipimpin && user.staff.halaqohDipimpin.length > 0) {
    halaqohName = user.staff.halaqohDipimpin[0].nama;
  } else if (user.santri?.halaqoh) {
    halaqohName = user.santri.halaqoh.nama;
  }

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    staffId: user.staffId ?? null,
    staffCode,
    santriId: user.santriId ?? null,
    name: displayName,
    halaqohName,
    isKepalaBidangTahfidz: isKabid,
    isPetugasPresensiPutri,
  };
}

/**
 * Ambil sesi pengguna saat ini dari HTTP-only Cookie
 * Menvalidasi token JWT dan status keaktifan akun terkini di database
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  if (isExplicitTestRuntime() && testSessionMock !== undefined) {
    return testSessionMock;
  }
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      try {
        const { headers } = await import("next/headers");
        const headerStore = await headers();
        const authHeader = headerStore.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7).trim();
        } else {
          const cookieHeader = headerStore.get("cookie");
          if (cookieHeader) {
            const cookiesList = cookieHeader.split(";").map((c) => c.trim());
            const sessionCookie = cookiesList.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
            if (sessionCookie) {
              token = sessionCookie.substring(SESSION_COOKIE_NAME.length + 1).trim();
            }
          }
        }
      } catch {
        // Abaikan fallback header jika tidak didukung di konteks saat ini
      }
    }

    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    return await resolveVerifiedSessionPayload(payload);
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
    // 1. Cek Header Authorization (Bearer <token>)
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const payload = await verifySessionToken(token);
      if (!payload) return null;

      return await resolveVerifiedSessionPayload(payload);
    }

    // 2. Cek Cookie dari Header Request (req.headers.get("cookie"))
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const cookiesList = cookieHeader.split(";").map((c) => c.trim());
      const sessionCookie = cookiesList.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      if (sessionCookie) {
        const token = sessionCookie.substring(SESSION_COOKIE_NAME.length + 1).trim();
        const payload = await verifySessionToken(token);
        if (!payload) return null;

        return await resolveVerifiedSessionPayload(payload);
      }
    }

    // 3. Fallback ke Next.js cookies() store
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
        details: (payload.details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
  }
}

/**
 * Canonical Mudhabbir Authorization Resolver (PEMBINA_HALAQOH)
 * Derived strictly from SESSION -> IDENTITY -> ACTIVE ASSIGNMENT -> Position PEMBINA_HALAQOH.
 * Session boolean (session.isMudabbir) may exist as derived metadata, but confers ZERO authority.
 */
export async function resolveUserIsMudabbir(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const asg = await prisma.assignment.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        position: { code: "PEMBINA_HALAQOH" },
      },
    });
    return Boolean(asg);
  } catch {
    return false;
  }
}

/**
 * Resolves permitted unit IDs assigned to a Mudabbir (PEMBINA_HALAQOH)
 */
export async function getMudabbirAssignedUnitIds(userId?: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        userId,
        status: "ACTIVE",
        position: { code: "PEMBINA_HALAQOH" },
      },
      include: {
        scopedUnits: true,
      },
    });
    const unitIds = new Set<string>();
    for (const asg of assignments) {
      if (asg.unitId) unitIds.add(asg.unitId);
      if (asg.scopedUnits) {
        for (const su of asg.scopedUnits) {
          if (su.unitId) unitIds.add(su.unitId);
        }
      }
    }
    return Array.from(unitIds);
  } catch {
    return [];
  }
}

