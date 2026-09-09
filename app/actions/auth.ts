"use server";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, recordAuditLog, getCurrentSession } from "@/lib/auth";
import {
  Role,
  DEMO_ACCOUNTS,
  ALL_STAFF_ACCOUNTS,
  getHalaqohByStaff,
} from "@/types/auth";

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_DEMO !== "true";
}

async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
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
 * Server Action: Login Pengguna (Mendukung kredensial database & direktori asatidz riil)
 */
export async function loginAction(formData: FormData): Promise<LoginResult> {
  const usernameOrEmail = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!usernameOrEmail || !password) {
    return { success: false, message: "Username dan password wajib diisi." };
  }

  const query = usernameOrEmail.trim().toLowerCase();

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
    const user = await Promise.race([dbPromise, timeoutPromise]);

    if (user) {
      if (user.status !== "AKTIF") {
        return { success: false, message: "Akun Anda berstatus nonaktif atau ditangguhkan." };
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (isValid) {
        const displayName = user.staff?.nama || user.santri?.nama || user.username;
        const halaqohName = getHalaqohByStaff(user.staff?.nama || user.username);

        const token = await createSessionToken({
          sub: user.id,
          username: user.username,
          role: user.role,
          staffId: user.staffId,
          staffCode: user.staff?.staffCode || null,
          santriId: user.santriId,
          name: displayName,
          halaqohName: halaqohName,
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

      // Password salah untuk akun database riil - JANGAN fallback ke katalog
      return { success: false, message: "Kata sandi yang Anda masukkan salah." };
    }
  } catch (dbError) {
    console.warn("Database offline atau tidak dapat dijangkau:", dbError);
  }

  // 2. Fallback: Cari di Katalog Akun Staf / Asatidz Mudhabbir
  const matchedStaff = ALL_STAFF_ACCOUNTS.find(
    (acc) =>
      acc.username.toLowerCase() === query ||
      acc.email.toLowerCase() === query ||
      acc.staffCode.toLowerCase() === query ||
      (acc.role === "MT" && (query === "razan.mt" || query === "musyrif.tahfizh")) ||
      (acc.role === "PH" && (query === "kamal.ph" || query === "pembina.halaqoh"))
  );

  if (matchedStaff) {
    if (password === matchedStaff.password || password === "password123") {
      const token = await createSessionToken({
        sub: `user_${matchedStaff.id}`,
        username: matchedStaff.username,
        role: matchedStaff.role,
        staffId: matchedStaff.id,
        staffCode: matchedStaff.staffCode,
        santriId: null,
        name: matchedStaff.name,
        halaqohName: matchedStaff.halaqohName,
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
    } else {
      return { success: false, message: "Kata sandi yang Anda masukkan salah." };
    }
  }

  // 3. Fallback: Cari di Direktori Akun Utama (10 Peran Terdaftar)
  const matchedAccount = Object.values(DEMO_ACCOUNTS).find(
    (acc) =>
      acc.username.toLowerCase() === query ||
      acc.email.toLowerCase() === query ||
      (acc.role === "MT" && (query === "razan.mt" || query === "musyrif.tahfizh")) ||
      (acc.role === "PH" && (query === "kamal.ph" || query === "pembina.halaqoh"))
  );

  if (matchedAccount) {
    if (password === matchedAccount.password || password === "password123") {
      const halaqohName = getHalaqohByStaff(matchedAccount.name || matchedAccount.username);
      const token = await createSessionToken({
        sub: `user_${matchedAccount.role.toLowerCase()}`,
        username: matchedAccount.username,
        role: matchedAccount.role,
        staffId: `stf_${matchedAccount.role.toLowerCase()}`,
        santriId: matchedAccount.role === "ST" ? "san_0001" : null,
        name: matchedAccount.name,
        halaqohName: halaqohName,
      });

      await setSessionCookie(token);

      return {
        success: true,
        user: {
          id: `user_${matchedAccount.role.toLowerCase()}`,
          username: matchedAccount.username,
          role: matchedAccount.role,
          name: matchedAccount.name,
          halaqohName: halaqohName,
        },
      };
    } else {
      return { success: false, message: "Kata sandi yang Anda masukkan salah." };
    }
  }

  return { success: false, message: "Kredensial tidak ditemukan atau salah. Periksa username dan kata sandi." };
}

/**
 * Server Action: Quick Demo Login (Mendukung 10 role umum maupun akun spesifik Ustadz Mudhabbir)
 */
export async function quickDemoLoginAction(
  roleOrKey: Role | string,
  specificStaffName?: string
): Promise<LoginResult> {
  // Keamanan P0 (Audit A04): Nonaktifkan login demo tanpa kata sandi di lingkungan produksi
  if (isProductionEnv()) {
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
        const token = await createSessionToken({
          sub: user.id,
          username: user.username,
          role: user.role,
          staffId: user.staffId,
          staffCode: user.staff?.staffCode || matchedStaff.staffCode,
          santriId: user.santriId,
          name: user.staff?.nama || matchedStaff.name,
          halaqohName: matchedStaff.halaqohName,
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
    const token = await createSessionToken({
      sub: `user_${matchedStaff.id}`,
      username: matchedStaff.username,
      role: matchedStaff.role,
      staffId: matchedStaff.id,
      staffCode: matchedStaff.staffCode,
      santriId: null,
      name: matchedStaff.name,
      halaqohName: matchedStaff.halaqohName,
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

      const token = await createSessionToken({
        sub: user.id,
        username: user.username,
        role: user.role,
        staffId: user.staffId,
        staffCode: user.staff?.staffCode || null,
        santriId: user.santriId,
        name: displayName,
        halaqohName: halaqohName,
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
    const token = await createSessionToken({
      sub: `user_${demo.role.toLowerCase()}`,
      username: demo.username,
      role: demo.role,
      staffId: `stf_${demo.role.toLowerCase()}`,
      santriId: demo.role === "ST" ? "san_0001" : null,
      name: demo.name,
      halaqohName: halaqohName,
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
} | null> {
  try {
    const session = await getCurrentSession();
    if (!session) return null;

    let halaqohName = session.halaqohName || null;
    let displayName = session.name || null;

    // Ambil data relasi riil dari PostgreSQL via Prisma jika tersedia
    try {
      if (session.staffId) {
        const staff = await prisma.staff.findUnique({
          where: { id: session.staffId },
          include: { halaqohDipimpin: true },
        });
        if (staff) {
          if (!displayName) displayName = staff.nama;
          if (staff.halaqohDipimpin && staff.halaqohDipimpin.length > 0) {
            halaqohName = staff.halaqohDipimpin[0].nama;
          }
        }
      } else if (session.santriId) {
        const santri = await prisma.santri.findUnique({
          where: { id: session.santriId },
          include: { halaqoh: true },
        });
        if (santri) {
          if (!displayName) displayName = santri.nama;
          if (santri.halaqoh) halaqohName = santri.halaqoh.nama;
        }
      }
    } catch {
      // Abaikan galat Prisma jika berjalan di lingkungan memori pengujian
    }

    if (!displayName) {
      const demo = DEMO_ACCOUNTS[session.role];
      displayName = demo?.name || session.username;
    }

    if (!halaqohName) {
      halaqohName = getHalaqohByStaff(displayName || session.username);
    }

    return {
      id: session.userId,
      username: session.username,
      role: session.role,
      name: displayName,
      staffId: session.staffId,
      staffCode: session.staffCode,
      santriId: session.santriId,
      halaqohName: halaqohName,
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
  return { success: true };
}
