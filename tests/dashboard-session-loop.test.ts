import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createSessionToken, verifySessionToken } from "../lib/auth";

describe("Remediasi Bug Kritis: Infinite Loading Loop & Logout Hang", () => {
  // =========================================================================
  // 1. ANALISIS KODE SUMBER: PENCEGAHAN INFINITE RE-RENDER LOOP
  // =========================================================================
  describe("1. app/page.tsx: Dependency Array & State Guard", () => {
    it("useEffect untuk initApp wajib memiliki dependency array kosong [] (hanya mount)", () => {
      const pagePath = path.resolve(process.cwd(), "app/page.tsx");
      assert.ok(fs.existsSync(pagePath), "app/page.tsx harus ditemukan");
      const content = fs.readFileSync(pagePath, "utf-8");

      // Pastikan initApp dijalankan dengan dependency array []
      assert.ok(
        content.includes("}, []); // Run strictly once on mount"),
        "useEffect initApp harus memiliki dependency array [] agar hanya berjalan satu kali saat komponen ter-mount"
      );
    });

    it("placeholder currentUserName tidak boleh diinisialisasi dengan string 'Memuat'", () => {
      const pagePath = path.resolve(process.cwd(), "app/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(
        !content.includes('useState<string>("Memuat profil...")'),
        "currentUserName tidak boleh diinisialisasi dengan 'Memuat profil...' karena mencemari sapaan"
      );
      assert.ok(
        content.includes('useState<string>("")'),
        "currentUserName harus diinisialisasi dengan string kosong"
      );
    });

    it("popstate listener harus didecouple dari initApp dan menggunakan ref stabil", () => {
      const pagePath = path.resolve(process.cwd(), "app/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(
        content.includes("selectedRoleRef = useRef"),
        "Harus menggunakan selectedRoleRef agar listener popstate tidak memicu render ulang effect"
      );
    });
  });

  // =========================================================================
  // 2. ELIMINASI TEKS 'MEMUAT' DI UI (BERANDA, HEADER, SIDEBAR)
  // =========================================================================
  describe("2. UI Rendering Guard: Tidak Merender 'Assalamu'alaikum, Memuat'", () => {
    it("BerandaModule harus menggunakan skeleton loader daripada merender string 'Memuat'", () => {
      const berandaPath = path.resolve(process.cwd(), "components/modules/beranda-module.tsx");
      const content = fs.readFileSync(berandaPath, "utf-8");

      assert.ok(
        content.includes('!userName.startsWith("Memuat")'),
        "BerandaModule harus memfilter string yang diawali 'Memuat'"
      );
      assert.ok(
        content.includes("animate-pulse"),
        "BerandaModule harus menampilkan animasi pulse / skeleton ketika nama belum termuat"
      );
    });

    it("AppHeader harus menampilkan skeleton loader saat nama belum tersedia", () => {
      const headerPath = path.resolve(process.cwd(), "components/navigation/app-header.tsx");
      const content = fs.readFileSync(headerPath, "utf-8");

      assert.ok(
        content.includes('!userName.startsWith("Memuat")'),
        "AppHeader harus memfilter string yang diawali 'Memuat'"
      );
      assert.ok(
        content.includes("animate-pulse"),
        "AppHeader harus menampilkan skeleton loader saat nama belum termuat"
      );
    });

    it("AppSidebar harus menampilkan skeleton loader saat nama belum tersedia", () => {
      const sidebarPath = path.resolve(process.cwd(), "components/navigation/app-sidebar.tsx");
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(
        content.includes('!userName.startsWith("Memuat")'),
        "AppSidebar harus memfilter string yang diawali 'Memuat'"
      );
      assert.ok(
        content.includes("animate-pulse"),
        "AppSidebar harus menampilkan skeleton loader saat nama belum termuat"
      );
    });
  });

  // =========================================================================
  // 3. LOGOUT & ROUTE PROTECTION (ANTI PING-PONG LOOP)
  // =========================================================================
  describe("3. Logout & Loop Breaker", () => {
    it("logoutAction harus menghapus cookie dan menyetel maxAge: 0", () => {
      const authActionsPath = path.resolve(process.cwd(), "app/actions/auth.ts");
      const content = fs.readFileSync(authActionsPath, "utf-8");

      assert.ok(
        content.includes("export async function logoutAction()"),
        "logoutAction harus diekspor dari app/actions/auth.ts"
      );
      assert.ok(
        content.includes("cookieStore.delete(SESSION_COOKIE_NAME)"),
        "logoutAction harus memanggil delete cookie"
      );
      assert.ok(
        content.includes("maxAge: 0"),
        "logoutAction harus menyetel maxAge: 0 untuk memastikan cookie kedaluwarsa"
      );
    });

    it("harus menyediakan API REST POST /api/v1/auth/logout", () => {
      const logoutRoutePath = path.resolve(process.cwd(), "app/api/v1/auth/logout/route.ts");
      assert.ok(fs.existsSync(logoutRoutePath), "Route /api/v1/auth/logout/route.ts wajib ada");
    });

    it("middleware.ts harus memecah loop redirect jika terdapat parameter session_required atau logout", () => {
      const middlewarePath = path.resolve(process.cwd(), "middleware.ts");
      const content = fs.readFileSync(middlewarePath, "utf-8");

      assert.ok(
        content.includes('search.includes("session_required")') ||
        content.includes('search.includes("logout")'),
        "middleware.ts wajib memeriksa parameter pemutus loop pada /login"
      );
    });
  });

  // =========================================================================
  // 4. SESI KRIPTOGRAFIS RESILIEN DI LIB/AUTH.TS
  // =========================================================================
  describe("4. Integritas Kriptografis Token Sesi", () => {
    it("harus dapat membuat dan memverifikasi token JWT sesi staf resmi", async () => {
      const token = await createSessionToken({
        sub: "user_cm_staff_1",
        username: "mudir.ks",
        role: "KS",
        name: "Ust. Andi Quarzy Ayatullah, S.H, M.H",
        staffId: "cm_staff_1",
        staffCode: "STF-001",
        santriId: null,
        halaqohName: null,
      });

      assert.ok(typeof token === "string" && token.length > 50);
      const decoded = await verifySessionToken(token);
      assert.ok(decoded !== null);
      assert.equal(decoded.sub, "user_cm_staff_1");
      assert.equal(decoded.role, "KS");
      assert.equal(decoded.name, "Ust. Andi Quarzy Ayatullah, S.H, M.H");
    });
  });
});
