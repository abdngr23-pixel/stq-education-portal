import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "stq_portal_super_secret_session_key_min_32_characters_long_2026"
);

const SESSION_COOKIE_NAME = "stq_session_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Cek validitas token jika ada
  let sessionPayload: any = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      sessionPayload = payload;
    } catch {
      // Token tidak valid atau kedaluwarsa
    }
  }

  // Jika sudah login dan membuka halaman /login, alihkan ke dashboard /
  if (pathname === "/login" && sessionPayload) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Daftar rute yang memerlukan login
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/tahfizh") ||
    pathname.startsWith("/santri") ||
    pathname.startsWith("/halaqoh") ||
    pathname.startsWith("/audit-log");

  if (isProtectedRoute && !sessionPayload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Segment guard: /admin hanya untuk ADM dan KS
  if (pathname.startsWith("/admin") && sessionPayload) {
    if (sessionPayload.role !== "ADM" && sessionPayload.role !== "KS") {
      return NextResponse.redirect(new URL("/?forbidden=true", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/tahfizh/:path*",
    "/santri/:path*",
    "/halaqoh/:path*",
    "/audit-log/:path*",
    "/login",
  ],
};
