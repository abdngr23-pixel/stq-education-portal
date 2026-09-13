(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import test, { describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  startTestDatabase,
  setupTestFixtures,
  cleanupTestFixtures,
  stopTestDatabase,
  FIXTURES,
} from "./test-db-manager";
import {
  loginAction,
  quickDemoLoginAction,
} from "../app/actions/auth";
import { POST as postRestLogin } from "../app/api/v1/auth/login/route";
import { DEMO_ACCOUNTS, ALL_STAFF_ACCOUNTS } from "../types/auth";
import {
  SESSION_COOKIE_NAME,
  isDemoLoginAllowed,
  createSessionToken,
  verifySessionToken,
  resolveVerifiedSessionPayload,
  getAuthFromRequest,
} from "../lib/auth";

describe("PR #5 P0 Authentication Production Hardening — Security Regression Tests", () => {
  let prisma: PrismaClient;

  before(async () => {
    prisma = await startTestDatabase();
  });

  beforeEach(async () => {
    await setupTestFixtures(prisma);
  });

  after(async () => {
    if (prisma) {
      await cleanupTestFixtures(prisma);
      await stopTestDatabase();
    }
  });

  // --------------------------------------------------------------------------
  // 1. Production + DB unavailable: loginAction gagal & tidak membuat session
  // --------------------------------------------------------------------------
  test("1. Production + DB unavailable: loginAction fail-closed, tidak membuat session", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFindFirst = prisma.user.findFirst;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      (prisma.user as unknown as { findFirst: () => Promise<unknown> }).findFirst = () =>
        Promise.reject(new Error("P1001: Can't reach database server at 127.0.0.1:5432"));

      const formData = new FormData();
      formData.append("username", FIXTURES.USERNAME);
      formData.append("password", FIXTURES.PASSWORD);

      const result = await loginAction(formData);
      assert.equal(result.success, false);
      assert.match(result.message || "", /tidak tersedia/i);
      assert.equal(result.user, undefined);
    } finally {
      (prisma.user as unknown as { findFirst: typeof originalFindFirst }).findFirst = originalFindFirst;
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 2. Production + username hanya ada di DEMO_ACCOUNTS: login gagal
  // --------------------------------------------------------------------------
  test("2. Production + username hanya ada di DEMO_ACCOUNTS: login gagal tanpa fallback", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const demoMT = DEMO_ACCOUNTS["MT"];

      const formData = new FormData();
      formData.append("username", demoMT.username);
      formData.append("password", demoMT.password);

      const result = await loginAction(formData);
      assert.equal(result.success, false);
      assert.match(result.message || "", /kredensial tidak valid/i);
      assert.equal(result.user, undefined);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 3. Production + username hanya ada di ALL_STAFF_ACCOUNTS: login gagal
  // --------------------------------------------------------------------------
  test("3. Production + username hanya ada di ALL_STAFF_ACCOUNTS: login gagal tanpa fallback", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const staff = ALL_STAFF_ACCOUNTS[0];

      const formData = new FormData();
      formData.append("username", staff.username);
      formData.append("password", staff.password);

      const result = await loginAction(formData);
      assert.equal(result.success, false);
      assert.match(result.message || "", /kredensial tidak valid/i);
      assert.equal(result.user, undefined);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 4. Production + password 'password123': tidak menjadi universal password
  // --------------------------------------------------------------------------
  test("4. Production + password 'password123': tidak menjadi universal password", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const customHashed = await bcrypt.hash("CustomSecretPass#2026", 10);
      await prisma.user.upsert({
        where: { username: "custom.user" },
        update: { passwordHash: customHashed, status: "AKTIF" },
        create: {
          id: "TEST_USR_CUSTOM",
          username: "custom.user",
          passwordHash: customHashed,
          role: "MT",
          status: "AKTIF",
        },
      });

      const formData = new FormData();
      formData.append("username", "custom.user");
      formData.append("password", "password123");

      const result = await loginAction(formData);
      assert.equal(result.success, false);
      assert.match(result.message || "", /kredensial tidak valid/i);
      assert.equal(result.user, undefined);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 5. REST API production: demo/static account tidak mendapat token
  // --------------------------------------------------------------------------
  test("5. REST API production: demo/static account tidak mendapat token (401)", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const demoMT = DEMO_ACCOUNTS["MT"];

      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: demoMT.username,
          password: demoMT.password,
        }),
      });

      const res = await postRestLogin(req);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "UNAUTHORIZED");
      assert.equal(body.data, undefined);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 6. REST API production + DB unavailable: fail closed (503), tidak mendapat token
  // --------------------------------------------------------------------------
  test("6. REST API production + DB unavailable: fail closed (503), tidak mendapat token", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFindFirst = prisma.user.findFirst;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      (prisma.user as unknown as { findFirst: () => Promise<unknown> }).findFirst = () =>
        Promise.reject(new Error("Connection timed out"));

      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: FIXTURES.USERNAME,
          password: FIXTURES.PASSWORD,
        }),
      });

      const res = await postRestLogin(req);
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "SERVICE_UNAVAILABLE");
      assert.equal(body.data, undefined);
    } finally {
      (prisma.user as unknown as { findFirst: typeof originalFindFirst }).findFirst = originalFindFirst;
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 7. quickDemoLoginAction production: selalu ditolak
  // --------------------------------------------------------------------------
  test("7. quickDemoLoginAction production: selalu ditolak", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDemoLogin = process.env.STQ_ENABLE_DEMO_LOGIN;
    const originalPublicDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.STQ_ENABLE_DEMO_LOGIN = "true"; // Bahkan jika ada miskonfigurasi flag server!
      process.env.NEXT_PUBLIC_ENABLE_DEMO = "true";

      const result = await quickDemoLoginAction("KS");
      assert.equal(result.success, false);
      assert.match(result.message || "", /dinonaktifkan pada lingkungan produksi/i);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      process.env.STQ_ENABLE_DEMO_LOGIN = originalDemoLogin;
      process.env.NEXT_PUBLIC_ENABLE_DEMO = originalPublicDemo;
    }
  });

  // --------------------------------------------------------------------------
  // 8. Demo local: hanya aktif jika NODE_ENV !== production DAN STQ_ENABLE_DEMO_LOGIN=true
  // --------------------------------------------------------------------------
  test("8. Demo local: hanya aktif jika NODE_ENV !== production DAN STQ_ENABLE_DEMO_LOGIN=true", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDemo = process.env.STQ_ENABLE_DEMO_LOGIN;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";

      // 8a. Tanpa STQ_ENABLE_DEMO_LOGIN -> Harus ditolak
      delete process.env.STQ_ENABLE_DEMO_LOGIN;
      assert.equal(isDemoLoginAllowed(), false);
      let result = await quickDemoLoginAction("KS");
      assert.equal(result.success, false);

      // 8b. STQ_ENABLE_DEMO_LOGIN = 'false' -> Harus ditolak
      process.env.STQ_ENABLE_DEMO_LOGIN = "false";
      assert.equal(isDemoLoginAllowed(), false);
      result = await quickDemoLoginAction("KS");
      assert.equal(result.success, false);

      // 8c. STQ_ENABLE_DEMO_LOGIN = 'true' -> Diizinkan
      process.env.STQ_ENABLE_DEMO_LOGIN = "true";
      assert.equal(isDemoLoginAllowed(), true);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      process.env.STQ_ENABLE_DEMO_LOGIN = originalDemo;
    }
  });

  // --------------------------------------------------------------------------
  // 9. Valid database user: login tetap berhasil
  // --------------------------------------------------------------------------
  test("9. Valid database user: loginAction & REST login berhasil dan menghasilkan token", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // 9a. Server Action loginAction
      const formData = new FormData();
      formData.append("username", FIXTURES.USERNAME);
      formData.append("password", FIXTURES.PASSWORD);

      const actionResult = await loginAction(formData);
      assert.equal(actionResult.success, true);
      assert.equal(actionResult.user?.username, FIXTURES.USERNAME);
      assert.equal(actionResult.user?.role, "MT");

      // 9b. REST API login POST
      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: FIXTURES.USERNAME,
          password: FIXTURES.PASSWORD,
        }),
      });

      const restRes = await postRestLogin(req);
      assert.equal(restRes.status, 200);
      const restBody = await restRes.json();
      assert.equal(restBody.success, true);
      assert.ok(restBody.data?.token);
      assert.equal(restBody.data?.user?.username, FIXTURES.USERNAME);

      // Verifikasi cookie keamanan
      const setCookieHeader = restRes.headers.get("set-cookie");
      assert.ok(setCookieHeader, "Header Set-Cookie harus ada pada respons login");
      assert.ok(setCookieHeader.includes(SESSION_COOKIE_NAME), "Nama cookie harus sesuai");
      assert.ok(setCookieHeader.toLowerCase().includes("httponly"), "Cookie wajib HttpOnly");
      assert.ok(setCookieHeader.toLowerCase().includes("samesite=lax"), "Cookie wajib SameSite=Lax");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 10. Invalid password: login gagal tanpa fallback
  // --------------------------------------------------------------------------
  test("10. Invalid password untuk user database valid: login gagal tanpa fallback", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // 10a. Server Action
      const formData = new FormData();
      formData.append("username", FIXTURES.USERNAME);
      formData.append("password", "salah_total_password_123");

      const actionResult = await loginAction(formData);
      assert.equal(actionResult.success, false);
      assert.match(actionResult.message || "", /kredensial tidak valid/i);
      assert.equal(actionResult.user, undefined);

      // 10b. REST API
      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: FIXTURES.USERNAME,
          password: "salah_total_password_123",
        }),
      });

      const restRes = await postRestLogin(req);
      assert.equal(restRes.status, 401);
      const restBody = await restRes.json();
      assert.equal(restBody.success, false);
      assert.equal(restBody.error?.code, "UNAUTHORIZED");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 11. Inactive user: tetap ditolak (403 pada REST, message status pada action)
  // --------------------------------------------------------------------------
  test("11. Inactive user: ditolak baik pada server action maupun REST API", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const hashed = await bcrypt.hash("InactivePassword#123", 10);
      await prisma.user.upsert({
        where: { username: "inactive.user" },
        update: { passwordHash: hashed, status: "NONAKTIF" },
        create: {
          id: "TEST_USR_INACTIVE",
          username: "inactive.user",
          passwordHash: hashed,
          role: "MT",
          status: "NONAKTIF",
        },
      });

      // 11a. Server Action
      const formData = new FormData();
      formData.append("username", "inactive.user");
      formData.append("password", "InactivePassword#123");

      const actionResult = await loginAction(formData);
      assert.equal(actionResult.success, false);
      assert.match(actionResult.message || "", /nonaktif atau ditangguhkan/i);

      // 11b. REST API
      const req = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "inactive.user",
          password: "InactivePassword#123",
        }),
      });

      const restRes = await postRestLogin(req);
      assert.equal(restRes.status, 403);
      const restBody = await restRes.json();
      assert.equal(restBody.success, false);
      assert.equal(restBody.error?.code, "FORBIDDEN");
      assert.match(restBody.error?.message || "", /nonaktif atau ditangguhkan/i);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 12. Production session JWT untuk user yang sudah dihapus -> ditolak (fail-closed)
  // --------------------------------------------------------------------------
  test("12. Production session JWT untuk user yang sudah dihapus -> ditolak (fail-closed)", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const delHashed = await bcrypt.hash("PassToDelete#2026", 10);
      const delUser = await prisma.user.create({
        data: {
          id: "TEST_USR_TO_DELETE",
          username: "user.to.delete",
          passwordHash: delHashed,
          role: "MT",
          status: "AKTIF",
        },
      });

      const token = await createSessionToken({
        sub: delUser.id,
        username: delUser.username,
        role: delUser.role,
      });

      // Verifikasi saat user masih ada -> sesi valid
      const payloadBefore = await verifySessionToken(token);
      assert.ok(payloadBefore);
      const sessionBefore = await resolveVerifiedSessionPayload(payloadBefore);
      assert.ok(sessionBefore);
      assert.equal(sessionBefore.userId, delUser.id);

      // Hapus user dari PostgreSQL
      await prisma.user.delete({ where: { id: delUser.id } });

      // Verifikasi setelah user dihapus -> sesi ditolak fail-closed
      const sessionAfter = await resolveVerifiedSessionPayload(payloadBefore);
      assert.equal(sessionAfter, null, "User yang dihapus wajib ditolak fail-closed");

      // Verifikasi via Bearer path
      const req = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const authReq = await getAuthFromRequest(req);
      assert.equal(authReq, null, "Bearer request untuk user yang dihapus wajib null");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 13. Production session verification ketika DB unavailable -> ditolak
  // --------------------------------------------------------------------------
  test("13. Production session verification ketika DB unavailable -> ditolak, bukan mempertahankan JWT", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFindUnique = prisma.user.findUnique;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const token = await createSessionToken({
        sub: FIXTURES.USER_ID,
        username: FIXTURES.USERNAME,
        role: "MT",
      });
      const payload = await verifySessionToken(token);
      assert.ok(payload);

      // Simulasikan DB offline / timeout
      (prisma.user as unknown as { findUnique: () => Promise<unknown> }).findUnique = () =>
        Promise.reject(new Error("Database connection closed"));

      const session = await resolveVerifiedSessionPayload(payload);
      assert.equal(session, null, "Sesi wajib null (fail-closed) jika database tidak dapat dijangkau");

      const req = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const authReq = await getAuthFromRequest(req);
      assert.equal(authReq, null, "Bearer auth wajib null jika database offline");
    } finally {
      (prisma.user as unknown as { findUnique: typeof originalFindUnique }).findUnique = originalFindUnique;
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 14. Production valid JWT tetapi user status NONAKTIF -> ditolak
  // --------------------------------------------------------------------------
  test("14. Production valid JWT tetapi user status NONAKTIF -> ditolak", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const inactHashed = await bcrypt.hash("PassInactive#2026", 10);
      const inactUser = await prisma.user.upsert({
        where: { username: "user.deactivated" },
        update: { status: "NONAKTIF" },
        create: {
          id: "TEST_USR_DEACTIVATED",
          username: "user.deactivated",
          passwordHash: inactHashed,
          role: "MT",
          status: "NONAKTIF",
        },
      });

      const token = await createSessionToken({
        sub: inactUser.id,
        username: inactUser.username,
        role: inactUser.role,
      });
      const payload = await verifySessionToken(token);
      assert.ok(payload);

      const session = await resolveVerifiedSessionPayload(payload);
      assert.equal(session, null, "User berstatus nonaktif wajib ditolak");

      const req = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const authReq = await getAuthFromRequest(req);
      assert.equal(authReq, null);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 15. Production valid JWT tetapi role DB berubah -> ditolak
  // --------------------------------------------------------------------------
  test("15. Production valid JWT tetapi role DB berubah -> ditolak", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // Token dibuat dengan role "ADM"
      const token = await createSessionToken({
        sub: FIXTURES.USER_ID,
        username: FIXTURES.USERNAME,
        role: "ADM",
      });
      const payload = await verifySessionToken(token);
      assert.ok(payload);

      // Namun di database, user memiliki role "MT"
      const session = await resolveVerifiedSessionPayload(payload);
      assert.equal(session, null, "Sesi dengan role berbeda dari DB wajib ditolak fail-closed");

      const req = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const authReq = await getAuthFromRequest(req);
      assert.equal(authReq, null);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 16. Production JWT dibuat saat isKepalaBidangTahfidz=true, lalu DB diubah false -> session HARUS false
  // --------------------------------------------------------------------------
  test("16. Production JWT dibuat saat isKepalaBidangTahfidz=true, lalu DB diubah false -> session HARUS false", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // Pastikan di DB staff memiliki isKepalaBidangTahfidz = false
      await prisma.staff.update({
        where: { id: FIXTURES.STAFF_ID },
        data: { isKepalaBidangTahfidz: false },
      });

      // Token memuat claim lama isKepalaBidangTahfidz = true
      const token = await createSessionToken({
        sub: FIXTURES.USER_ID,
        username: FIXTURES.USERNAME,
        role: "MT",
        staffId: FIXTURES.STAFF_ID,
        isKepalaBidangTahfidz: true, // Klaim kadaluarsa / palsu
      });
      const payload = await verifySessionToken(token);
      assert.ok(payload);
      assert.equal(payload.isKepalaBidangTahfidz, true);

      // Validasi sesi harus menghidrasi dari database terkini (harus false!)
      const session = await resolveVerifiedSessionPayload(payload);
      assert.ok(session);
      assert.equal(
        session.isKepalaBidangTahfidz,
        false,
        "isKepalaBidangTahfidz wajib mengikuti DB terkini (false), dilarang mempertahankan true dari JWT"
      );

      // Verifikasi melalui Bearer request
      const req = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const authReq = await getAuthFromRequest(req);
      assert.ok(authReq);
      assert.equal(authReq.isKepalaBidangTahfidz, false);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 17. staffId / santriId / isPetugasPresensiPutri harus mengikuti DB terkini
  // --------------------------------------------------------------------------
  test("17. staffId / santriId / isPetugasPresensiPutri harus mengikuti DB terkini", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // Set atribut di DB
      await prisma.user.update({
        where: { id: FIXTURES.USER_ID },
        data: {
          staffId: FIXTURES.STAFF_ID,
          santriId: null,
          isPetugasPresensiPutri: true,
        },
      });

      // Token memuat data palsu/lama: staffId beda, santriId ada, isPetugasPresensiPutri false
      const token = await createSessionToken({
        sub: FIXTURES.USER_ID,
        username: FIXTURES.USERNAME,
        role: "MT",
        staffId: "STF_EXPLOIT_ID",
        santriId: "SAN_EXPLOIT_ID",
        isPetugasPresensiPutri: false,
      });
      const payload = await verifySessionToken(token);
      assert.ok(payload);

      const session = await resolveVerifiedSessionPayload(payload);
      assert.ok(session);
      assert.equal(session.staffId, FIXTURES.STAFF_ID, "staffId wajib mengikuti database terkini");
      assert.equal(session.santriId, null, "santriId wajib mengikuti database terkini");
      assert.equal(session.isPetugasPresensiPutri, true, "isPetugasPresensiPutri wajib mengikuti database terkini");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 18. Cookie path dan Bearer path harus memiliki policy fail-closed yang konsisten
  // --------------------------------------------------------------------------
  test("18. Cookie path dan Bearer path harus memiliki policy fail-closed yang konsisten", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // 18a. Token valid DB user
      const validToken = await createSessionToken({
        sub: FIXTURES.USER_ID,
        username: FIXTURES.USERNAME,
        role: "MT",
      });

      // Bearer request
      const bearerReq = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const bearerSession = await getAuthFromRequest(bearerReq);
      assert.ok(bearerSession);

      // Cookie request
      const cookieReq = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });
      const cookieSession = await getAuthFromRequest(cookieReq);
      assert.ok(cookieSession);

      // Atribut harus identik 100%
      assert.equal(bearerSession.userId, cookieSession.userId);
      assert.equal(bearerSession.role, cookieSession.role);
      assert.equal(bearerSession.staffId, cookieSession.staffId);
      assert.equal(bearerSession.isKepalaBidangTahfidz, cookieSession.isKepalaBidangTahfidz);

      // 18b. Token invalid/unknown user
      const fakeToken = await createSessionToken({
        sub: "user_non_existent_random_id",
        username: "ghost.user",
        role: "MT",
      });

      const fakeBearerReq = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Authorization: `Bearer ${fakeToken}` },
      });
      assert.equal(await getAuthFromRequest(fakeBearerReq), null);

      const fakeCookieReq = new Request("http://localhost:3000/api/v1/santri", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${fakeToken}` },
      });
      assert.equal(await getAuthFromRequest(fakeCookieReq), null);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 19. Synthetic identity tetap ditolak production di semua jalur
  // --------------------------------------------------------------------------
  test("19. Synthetic identity tetap ditolak production di semua jalur", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const syntheticSubList = ["user_ks", "user_adm", "stf_mt", "stf_001"];

      for (const syntheticSub of syntheticSubList) {
        const token = await createSessionToken({
          sub: syntheticSub,
          username: "synthetic.user",
          role: "KS",
        });
        const payload = await verifySessionToken(token);
        assert.ok(payload);

        // Resolver langsung
        const session = await resolveVerifiedSessionPayload(payload);
        assert.equal(session, null, `Synthetic sub ${syntheticSub} harus ditolak resolver di production`);

        // Bearer
        const bearerReq = new Request("http://localhost:3000/api/v1/santri", {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(await getAuthFromRequest(bearerReq), null);

        // Cookie
        const cookieReq = new Request("http://localhost:3000/api/v1/santri", {
          headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
        });
        assert.equal(await getAuthFromRequest(cookieReq), null);
      }
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });
});
