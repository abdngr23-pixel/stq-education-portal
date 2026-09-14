"use server";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, recordAuditLog, getCurrentSession, isDemoLoginAllowed } from "@/lib/auth";
import {
  Role,
  DEMO_ACCOUNTS,
  ALL_STAFF_ACCOUNTS,
  getHalaqohByStaff,
} from "@/types/auth";

async function setSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
  } catch (cookieErr) {
    if (process.env.NODE_ENV !== "test" && process.env.IS_TEST_RUN !== "true") {
      throw cookieErr;
    }
  }
}

export interface LoginResult {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    role: Role;
    name?: string;
    halaqohName?: string | null;
  };
}

/**
 * Server Action: Login Pengguna (Database-only & Fail-closed)
 */
export async function loginAction(formData: FormData): Promise<LoginResult> {
  const usernameOrEmail = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!usernameOrEmail || !password) {
    return { success: false, message: "Username dan password wajib diisi." };
  }

  const query = usernameOrEmail.trim().toLowerCase();

  let user = null;
  try {
    // 1. Coba cari di PostgreSQL via Prisma dengan timeout 2 detik agar tidak hang jika DB offline
    const dbPromise = prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: query, mode: "insensitive" } },
          { email: { equals: query, mode: "insensitive" } },
          { phone: query },
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
    console.warn("Database offline atau tidak dapat dijangkau pada loginAction:", dbError);
    // FAIL-CLOSED: Dilarang fallback ke katalog statis jika DB offline/error
    return {
      success: false,
      message: "Layanan autentikasi sedang tidak tersedia. Silakan coba beberapa saat lagi.",
    };
  }

  // FAIL-CLOSED: Jika user tidak ditemukan di database, tolak langsung tanpa fallback ke katalog statis
  if (!user) {
    return {
      success: false,
      message: "Kredensial tidak valid. Periksa username dan kata sandi.",
    };
  }

  if (user.status !== "AKTIF") {
    return {
      success: false,
      message: "Akun Anda berstatus nonaktif atau ditangguhkan.",
    };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return {
      success: false,
      message: "Kredensial tidak valid. Periksa username dan kata sandi.",
    };
  }

  const displayName = user.staff?.nama || user.santri?.nama || user.username;
  let halaqohName: string | null = null;
  if (user.staffId) {
    try {
      const h = await prisma.halaqoh.findFirst({
        where: { pembinaId: user.staffId },
        select: { nama: true },
      });
      if (h) halaqohName = h.nama;
    } catch {
      // Abaikan jika query halaqoh gagal
    }
  }

  const isKabid = Boolean(user.staff?.isKepalaBidangTahfidz);
  const isPetugasPresensiPutri = Boolean(user.isPetugasPresensiPutri);

  const token = await createSessionToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    staffId: user.staffId,
    staffCode: user.staff?.staffCode || null,
    santriId: user.santriId,
    name: displayName,
    halaqohName: halaqohName,
    isKepalaBidangTahfidz: isKabid,
    isPetugasPresensiPutri: isPetugasPresensiPutri,
  });

  await setSessionCookie(token);

  await recordAuditLog({
    userId: user.id,
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
    details: { role: user.role, username: user.username, halaqoh: halaqohName },
  });

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: displayName,
      halaqohName,
    },
  };
}

/**
 * Server Action: Quick Demo Login (Mendukung 10 role umum maupun akun spesifik Ustadz Mudhabbir)
 */
export async function quickDemoLoginAction(
  roleOrKey: Role | string,
  specificStaffName?: string
): Promise<LoginResult> {
  // Keamanan P0: Nonaktifkan login demo tanpa kata sandi jika tidak memenuhi syarat isolasi:
  // NODE_ENV !== "production" AND STQ_ENABLE_DEMO_LOGIN === "true"
  if (!isDemoLoginAllowed()) {
    return {
      success: false,
      message: "Akses login demo tanpa kata sandi dinonaktifkan pada lingkungan produksi demi keamanan data.",
    };
  }

  // Cek apakah target adalah akun staf spesifik (e.g. "kamal.ph", "Ust. Rizaldi", dll)
  const matchedStaff = ALL_STAFF_ACCOUNTS.find(
    (s) =>
      s.username === roleOrKey ||
      s.staffCode === roleOrKey ||
      (specificStaffName && s.name.toLowerCase().includes(specificStaffName.toLowerCase())) ||
      s.name.toLowerCase() === roleOrKey.toLowerCase()
  );

  if (matchedStaff) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: matchedStaff.username },
            { staff: { nama: matchedStaff.name } },
          ],
          status: "AKTIF",
        },
        include: { staff: true, santri: true },
      });

      if (user) {
        const isKabid = Boolean(user.staff?.isKepalaBidangTahfidz ?? matchedStaff.isKepalaBidangTahfidz);
        const isPetugasPresensiPutri = Boolean(user.isPetugasPresensiPutri);

        const token = await createSessionToken({
          sub: user.id,
          username: user.username,
          role: user.role,
          staffId: user.staffId,
          staffCode: user.staff?.staffCode || matchedStaff.staffCode,
          santriId: user.santriId,
          name: user.staff?.nama || matchedStaff.name,
          halaqohName: matchedStaff.halaqohName,
          isKepalaBidangTahfidz: isKabid,
          isPetugasPresensiPutri: isPetugasPresensiPutri,
        });

        await setSessionCookie(token);

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.staff?.nama || matchedStaff.name,
            halaqohName: matchedStaff.halaqohName,
          },
        };
      }
    } catch (e) {
      console.warn("Prisma fallback for specific staff demo login:", e);
    }

    // Fallback akun staf memory
    const isKabidFallback = Boolean(matchedStaff.isKepalaBidangTahfidz);

    const token = await createSessionToken({
      sub: `user_${matchedStaff.id}`,
      username: matchedStaff.username,
      role: matchedStaff.role,
      staffId: matchedStaff.id,
      staffCode: matchedStaff.staffCode,
      santriId: null,
      name: matchedStaff.name,
      halaqohName: matchedStaff.halaqohName,
      isKepalaBidangTahfidz: isKabidFallback,
      isPetugasPresensiPutri: false,
    });

    await setSessionCookie(token);

    return {
      success: true,
      user: {
        id: `user_${matchedStaff.id}`,
        username: matchedStaff.username,
        role: matchedStaff.role,
        name: matchedStaff.name,
        halaqohName: matchedStaff.halaqohName,
      },
    };
  }

  // Jika berupa Role standar (KS, ADM, MT, MK, dll)
  const role = roleOrKey as Role;
  const demo = DEMO_ACCOUNTS[role];

  try {
    const user = await prisma.user.findFirst({
      where: { role, status: "AKTIF" },
      include: { staff: true, santri: true },
    });

    if (user) {
      const displayName = user.staff?.nama || user.santri?.nama || demo?.name || user.username;
      const halaqohName = getHalaqohByStaff(displayName);

      const isKabidRole = Boolean(user.staff?.isKepalaBidangTahfidz);
      const isPetugasPresensiPutri = Boolean(user.isPetugasPresensiPutri);

      const token = await createSessionToken({
        sub: user.id,
        username: user.username,
        role: user.role,
        staffId: user.staffId,
        staffCode: user.staff?.staffCode || null,
        santriId: user.santriId,
        name: displayName,
        halaqohName: halaqohName,
        isKepalaBidangTahfidz: isKabidRole,
        isPetugasPresensiPutri: isPetugasPresensiPutri,
      });

      await setSessionCookie(token);

      await recordAuditLog({
        userId: user.id,
        action: "DEMO_LOGIN",
        entity: "User",
        entityId: user.id,
        details: { role: user.role, username: user.username, halaqoh: halaqohName },
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: displayName,
          halaqohName,
        },
      };
    }
  } catch (error) {
    console.warn("Prisma query skipped for quick demo login fallback:", error);
  }

  // Fallback ke akun demo standar
  if (demo) {
    const halaqohName = getHalaqohByStaff(demo.name);
    const isKabidDemo = Boolean((demo as { isKepalaBidangTahfidz?: boolean }).isKepalaBidangTahfidz);
    const token = await createSessionToken({
      sub: `user_${demo.role.toLowerCase()}`,
      username: demo.username,
      role: demo.role,
      staffId: `stf_${demo.role.toLowerCase()}`,
      santriId: demo.role === "ST" ? "san_0001" : null,
      name: demo.name,
      halaqohName: halaqohName,
      isKepalaBidangTahfidz: isKabidDemo,
    });

    await setSessionCookie(token);

    return {
      success: true,
      user: {
        id: `user_${demo.role.toLowerCase()}`,
        username: demo.username,
        role: demo.role,
        name: demo.name,
        halaqohName: halaqohName,
      },
    };
  }

  return { success: false, message: `Akun demo untuk peran ${roleOrKey} belum terdaftar.` };
}

/**
 * Server Action: Dapatkan Profil Sesi Pengguna Aktif
 */
export async function getCurrentUserAction(): Promise<{
  id: string;
  username: string;
  role: Role;
  name: string;
  staffId?: string | null;
  staffCode?: string | null;
  santriId?: string | null;
  halaqohName?: string | null;
  isKepalaBidangTahfidz?: boolean;
} | null> {
  try {
    const session = await getCurrentSession();
    if (!session) return null;

    return {
      id: session.userId,
      username: session.username,
      role: session.role,
      name: session.name || session.username,
      staffId: session.staffId ?? null,
      staffCode: session.staffCode ?? null,
      santriId: session.santriId ?? null,
      halaqohName: session.halaqohName ?? null,
      isKepalaBidangTahfidz: session.isKepalaBidangTahfidz ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Server Action: Logout
 */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return { success: true };
}
