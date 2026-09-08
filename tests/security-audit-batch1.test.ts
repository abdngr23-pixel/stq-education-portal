import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatIndonesianPhone, generateWALink } from "../lib/whatsapp";
import { getAuthSecretKey } from "../lib/auth";

describe("Audit STQ 2026-09-08 — Remediasi Batch 1 (P0 Security & Access Control)", () => {
  describe("1. A05: Fail-Closed Secret Handling", () => {
    it("harus melempar galat fatal jika dijalankan di production tanpa AUTH_SECRET yang memadai", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.AUTH_SECRET;

      try {
        process.env.NODE_ENV = "production";
        delete process.env.AUTH_SECRET;

        assert.throws(
          () => getAuthSecretKey(),
          /FATAL SECURITY ERROR: AUTH_SECRET wajib dikonfigurasi minimal 32 karakter di lingkungan produksi/
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
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
        process.env.NODE_ENV = "development";
        delete process.env.AUTH_SECRET;

        const key = getAuthSecretKey();
        assert.ok(key instanceof Uint8Array);
        assert.ok(key.length >= 32);
      } finally {
        process.env.NODE_ENV = originalEnv;
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
        process.env.NODE_ENV = "production";
        const { quickDemoLoginAction } = await import("../app/actions/auth");
        const result = await quickDemoLoginAction("KS");
        assert.equal(result.success, false);
        assert.match(result.message || "", /dinonaktifkan pada lingkungan produksi/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
