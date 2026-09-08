import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, JWTPayload } from "jose";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { verifyCsrf } from "@/lib/security/csrf";
import { getCorsHeaders, handleCorsPreflight } from "@/lib/security/cors";
import { applySecureHeaders } from "@/lib/security/headers";

function getAuthSecretKey(): Uint8Array {
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

const SESSION_COOKIE_NAME = "stq_session_token";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const origin = request.headers.get("origin");
  const clientIp = getClientIp(request.headers);

  // 8. Body & Query Size Limits (Query String Check)
  if (search.length > 2048) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "URI_TOO_LONG",
          message: "Panjang query string URL melampaui batas maksimum 2048 karakter.",
        },
      },
      { status: 414 }
    );
  }

  // 8. Body Size Limit Check via Content-Length header
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Ukuran payload permintaan melampaui batas maksimum 2MB.",
        },
      },
      { status: 413 }
    );
  }

  // 6. CORS Handling: Tangani Preflight OPTIONS request untuk API
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return handleCorsPreflight(origin);
  }

  // 1. Rate Limiting: Khusus Login (10 req/menit) & API umum (100 req/menit)
  if (pathname === "/api/v1/auth/login") {
    const rateLimit = checkRateLimit(`login:${clientIp}`, {
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "Terlalu banyak percobaan login. Silakan tunggu 1 menit.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetTime),
          },
        }
      );
    }
  } else if (pathname.startsWith("/api/")) {
    const rateLimit = checkRateLimit(`api:${clientIp}`, {
      limit: 100,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "Batas permintaan API terlampaui. Silakan tunggu beberapa saat.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetTime),
          },
        }
      );
    }
  }

  // 3. CSRF Protection: Validasi Origin & Referer pada metode state-changing API
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
  ) {
    const csrfCheck = verifyCsrf(request.method, request.headers, request.nextUrl);
    if (!csrfCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CSRF_REJECTED",
            message: csrfCheck.reason || "Permintaan ditolak: indikasi potensi CSRF.",
          },
        },
        { status: 403 }
      );
    }
  }

  // 2. Authentication Middleware: Ekstraksi Token JWT
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let sessionPayload: (JWTPayload & { role?: string }) | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getAuthSecretKey());
      sessionPayload = payload;
    } catch {
      // Token tidak valid atau kedaluwarsa
    }
  }

  // Jika sudah login dan membuka halaman /login, alihkan ke dashboard /
  if (pathname === "/login" && sessionPayload) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Jika membuka root dashboard / tanpa sesi yang sah, alihkan ke /login
  if (pathname === "/" && !sessionPayload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Daftar rute web yang memerlukan login
  const isProtectedWebRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/tahfizh") ||
    pathname.startsWith("/santri") ||
    pathname.startsWith("/halaqoh") ||
    pathname.startsWith("/audit-log");

  if (isProtectedWebRoute && !sessionPayload) {
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

  // Buat respons standar
  const response = NextResponse.next();

  // 6. Terapkan header CORS pada seluruh endpoint API
  if (pathname.startsWith("/api/")) {
    const corsHeaders = getCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  // 7. Terapkan Secure Headers (Helmet Equivalents) pada seluruh respons
  applySecureHeaders(response.headers);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match seluruh route kecuali file aset statis dan icon
     */
    "/((?!_next/static|_next/image|favicon.ico|logo-stq.png|site.webmanifest|icons/).*)",
  ],
};
