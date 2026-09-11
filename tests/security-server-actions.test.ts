(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getIkhtibarPendingCountAction } from "../app/actions/ikhtibar";
import { getSantriListAction } from "../app/actions/santri";
import { getIkhtibarPendingCountForSession } from "../lib/server/ikhtibar-pending-service";
import { getSantriListForSession } from "../lib/server/santri-list-service";
import { UserSession } from "../types/auth";
import { PrismaClient } from "@prisma/client";

describe("P0 Security & ABAC Verification for Server Actions & Services", () => {
  it("1. getIkhtibarPendingCountAction signature: 0 parameter (tidak menerima sessionOverride)", () => {
    assert.equal(
      getIkhtibarPendingCountAction.length,
      0,
      "getIkhtibarPendingCountAction wajib memiliki 0 parameter untuk mencegah pemalsuan sesi klien!"
    );
  });

  it("2. getSantriListAction signature: maksimal 1 parameter params (tidak menerima sessionOverride)", () => {
    assert.ok(
      getSantriListAction.length <= 1,
      "getSantriListAction dilarang menerima parameter sessionOverride dari klien!"
    );
  });

  it("3. Fail-closed saat dipanggil tanpa sesi terautentikasi (HTTP public entrypoint)", async () => {
    // Dipanggil di lingkungan pengujian tanpa cookie autentikasi Next.js
    const ikhtibarResult = await getIkhtibarPendingCountAction();
    assert.equal(ikhtibarResult.success, false);
    assert.ok(
      ikhtibarResult.error && (ikhtibarResult.error.includes("Sesi") || ikhtibarResult.error.includes("masuk")),
      "Error harus mengindikasikan otentikasi tidak valid secara aman"
    );

    const santriResult = await getSantriListAction();
    assert.equal(santriResult.success, false);
    assert.ok(
      santriResult.error && (santriResult.error.includes("Sesi") || santriResult.error.includes("masuk")),
      "Error harus mengindikasikan otentikasi tidak valid secara aman"
    );
  });

  it("4. Sanitasi pesan error: tidak membocorkan detail internal DB / Prisma / SQL", async () => {
    // Buat fake mock DB client yang melempar internal database error
    const mockFaultyDb = {
      halaqoh: {
        findFirst: async () => {
          throw new Error("P2002: Unique constraint failed on postgres://secret:pass@cluster.internal:5432/db");
        },
      },
      santri: {
        findMany: async () => {
          throw new Error("SELECT * FROM \"Santri\" WHERE connection error ECONNREFUSED 10.0.0.1:5432");
        },
      },
      ikhtibarTahfizh: {
        count: async () => {
          throw new Error("FATAL database corruption error at /var/lib/postgresql/data");
        },
      },
    } as unknown as PrismaClient;

    const fakeSession: UserSession = {
      userId: "usr-faulty",
      username: "faulty.mt",
      role: "MT",
      staffId: "staff-faulty",
      name: "Musyrif Faulty",
      isKepalaBidangTahfidz: false,
      isPetugasPresensiPutri: false,
    };

    // Test ikhtibar service error sanitization
    const ikhtibarRes = await getIkhtibarPendingCountForSession(fakeSession, mockFaultyDb);
    assert.equal(ikhtibarRes.success, false);
    assert.equal(ikhtibarRes.count, 0);
    assert.equal(ikhtibarRes.error, "Gagal memuat antrean Ikhtibar. Silakan coba kembali.");
    assert.ok(ikhtibarRes.error && !ikhtibarRes.error.includes("P2002"));
    assert.ok(ikhtibarRes.error && !ikhtibarRes.error.includes("postgres://"));
    assert.ok(ikhtibarRes.error && !ikhtibarRes.error.includes("secret"));

    // Test santri list service error sanitization
    const santriRes = await getSantriListForSession(undefined, fakeSession, mockFaultyDb);
    assert.equal(santriRes.success, false);
    assert.equal(santriRes.data.length, 0);
    assert.equal(santriRes.error, "Gagal memuat data santri");
    assert.ok(santriRes.error && !santriRes.error.includes("SELECT"));
    assert.ok(santriRes.error && !santriRes.error.includes("ECONNREFUSED"));
    assert.ok(santriRes.error && !santriRes.error.includes("10.0.0.1"));
  });

  it("5. Fail-closed domain service bila sesi null", async () => {
    const mockDb = {} as PrismaClient;

    // Tanpa sesi
    const resNoSession = await getIkhtibarPendingCountForSession(null, mockDb);
    assert.equal(resNoSession.success, false);
    assert.equal(resNoSession.count, 0);
    assert.ok(resNoSession.error && resNoSession.error.includes("Sesi tidak valid"));

    const santriNoSession = await getSantriListForSession(undefined, null, mockDb);
    assert.equal(santriNoSession.success, false);
    assert.equal(santriNoSession.data.length, 0);
    assert.ok(santriNoSession.error && santriNoSession.error.includes("Sesi tidak valid"));
  });
});
