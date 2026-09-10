import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatIndonesianPhone, generateWALink } from "../lib/whatsapp";
import { getAuthSecretKey } from "../lib/auth";

const setNodeEnv = (val: string | undefined) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = val;
};

describe("Audit STQ 2026-09-08 — Remediasi Batch 1 (P0 Security & Access Control)", () => {
  describe("1. A05: Fail-Closed Secret Handling", () => {
    it("harus melempar galat fatal jika dijalankan di production tanpa AUTH_SECRET yang memadai", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.AUTH_SECRET;

      try {
        setNodeEnv("production");
        delete process.env.AUTH_SECRET;

        assert.throws(
          () => getAuthSecretKey(),
          /FATAL SECURITY ERROR: AUTH_SECRET wajib dikonfigurasi minimal 32 karakter di lingkungan produksi/
        );
      } finally {
        setNodeEnv(originalEnv);
        if (originalSecret !== undefined) {
          process.env.AUTH_SECRET = originalSecret;
        } else {
          delete process.env.AUTH_SECRET;
        }
      }
    });

    it("harus menggunakan dev secret key di lingkungan development/test ketika AUTH_SECRET tidak diset", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.AUTH_SECRET;

      try {
        setNodeEnv("development");
        delete process.env.AUTH_SECRET;

        const key = getAuthSecretKey();
        assert.ok(key instanceof Uint8Array);
        assert.ok(key.length >= 32);
      } finally {
        setNodeEnv(originalEnv);
        if (originalSecret !== undefined) {
          process.env.AUTH_SECRET = originalSecret;
        } else {
          delete process.env.AUTH_SECRET;
        }
      }
    });
  });

  describe("2. A09: Eliminasi Nomor Fallback WhatsApp Dummy", () => {
    it("tidak boleh mengembalikan nomor dummy statis 6281299887766 saat nomor kosong atau null", () => {
      assert.equal(formatIndonesianPhone(null), "");
      assert.equal(formatIndonesianPhone(undefined), "");
      assert.equal(formatIndonesianPhone(""), "");
      assert.equal(formatIndonesianPhone("   "), "");
      assert.notEqual(formatIndonesianPhone(null), "6281299887766");
    });

    it("tidak boleh menghasilkan tautan WhatsApp aktif bila nomor tidak valid", () => {
      assert.equal(generateWALink(null, "Pesan Uji"), "");
      assert.equal(generateWALink("", "Pesan Uji"), "");
      assert.equal(generateWALink("12345", "Pesan Uji"), "");
    });

    it("harus menghasilkan tautan WhatsApp yang benar jika nomor valid", () => {
      const link = generateWALink("081234567890", "Halo Ustadz");
      assert.ok(link.startsWith("https://wa.me/6281234567890?text="));
      assert.ok(link.includes(encodeURIComponent("Halo Ustadz")));
    });
  });

  describe("3. A04: Penonaktifkan Quick Demo Login di Production", () => {
    it("quickDemoLoginAction harus menolak login demo tanpa password di mode produksi", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        setNodeEnv("production");
        const { quickDemoLoginAction } = await import("../app/actions/auth");
        const result = await quickDemoLoginAction("KS");
        assert.equal(result.success, false);
        assert.match(result.message || "", /dinonaktifkan pada lingkungan produksi/i);
      } finally {
        setNodeEnv(originalEnv);
      }
    });
  });

  describe("4. ABAC Scoping: Isolasi Data Santri & Setoran pada Endpoint REST API", () => {
    it("GET /api/v1/santri harus menolak wali santri tanpa santriId dengan status 403", async () => {
      const { createSessionToken } = await import("../lib/auth");
      const { GET: getSantriApi } = await import("../app/api/v1/santri/route");

      const token = await createSessionToken({
        sub: "user_ws_unmapped",
        username: "wali.unmapped",
        role: "WS",
      });

      const req = new Request("http://localhost:3000/api/v1/santri", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const res = await getSantriApi(req);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "FORBIDDEN");
    });

    it("GET /api/v1/setoran harus menolak wali santri tanpa santriId dengan status 403", async () => {
      const { createSessionToken } = await import("../lib/auth");
      const { GET: getSetoranApi } = await import("../app/api/v1/setoran/route");

      const token = await createSessionToken({
        sub: "user_ws_unmapped",
        username: "wali.unmapped",
        role: "WS",
      });

      const req = new Request("http://localhost:3000/api/v1/setoran", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const res = await getSetoranApi(req);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "FORBIDDEN");
    });
  });
});
