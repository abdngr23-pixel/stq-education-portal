import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_DEMO !== "true",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return NextResponse.json({
    success: true,
    message: "Berhasil keluar dari sesi.",
  });
}
