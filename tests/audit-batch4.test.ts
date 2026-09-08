import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  generateSetoranCode,
  generateSponsorCode,
  generateLaporanSponsorCode,
  generateSuratCode,
} from "../lib/sequence";

describe("Audit STQ 2026-09-08 — Remediasi Batch 4 (P1 System Stability, Concurrency & CI)", () => {
  describe("1. A19: Collision-Resistant Sequence Generator", () => {
    it("harus menghasilkan kode setoran unik tanpa tabrakan saat dieksekusi paralel (100 request simultan)", () => {
      const generatedCodes = new Set<string>();
      const totalRequests = 100;

      for (let i = 0; i < totalRequests; i++) {
        const code = generateSetoranCode(10);
        assert.match(code, /^SET-\d{5}-[A-Z0-9]{4}$/);
        generatedCodes.add(code);
      }

      assert.strictEqual(
        generatedCodes.size,
        totalRequests,
        "Semua kode transaksi setoran yang dihasilkan simultan harus unik (tidak boleh ada tabrakan key)"
      );
    });

    it("harus menghasilkan kode sponsor OTA unik tanpa tabrakan (100 request simultan)", () => {
      const generatedCodes = new Set<string>();
      const totalRequests = 100;

      for (let i = 0; i < totalRequests; i++) {
        const code = generateSponsorCode(5);
        assert.match(code, /^OTA-\d{3}-[A-Z0-9]{4}$/);
        generatedCodes.add(code);
      }

      assert.strictEqual(generatedCodes.size, totalRequests);
    });

    it("harus menghasilkan kode laporan sponsor unik untuk periode yang sama tanpa tabrakan", () => {
      const generatedCodes = new Set<string>();
      const totalRequests = 100;

      for (let i = 0; i < totalRequests; i++) {
        const code = generateLaporanSponsorCode("September 2026", 1);
        assert.match(code, /^LAP-September-2026-\d{3}-[A-Z0-9]{4}$/);
        generatedCodes.add(code);
      }

      assert.strictEqual(generatedCodes.size, totalRequests);
    });

    it("harus menyusun format penomoran surat resmi dengan tahun dan penomoran urut", () => {
      const suratCode = generateSuratCode("SK", 24, "STQ");
      const currentYear = new Date().getFullYear();
      assert.strictEqual(suratCode, `024/STQ/SK/${currentYear}`);
    });
  });

  describe("2. A20: Git Protection & Backup Failsafe", () => {
    it(".gitignore harus secara eksplisit mengabaikan folder /backups/ dan /exports/ untuk mencegah kebocoran data dump", () => {
      const gitignorePath = path.resolve(process.cwd(), ".gitignore");
      assert.ok(fs.existsSync(gitignorePath), ".gitignore harus ada");

      const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
      assert.match(gitignoreContent, /\/backups\//, ".gitignore wajib memuat /backups/");
      assert.match(gitignoreContent, /\/exports\//, ".gitignore wajib memuat /exports/");
    });

    it("scripts/backup-db.ts tidak boleh menulis placeholder dump saat pg_dump gagal", () => {
      const backupScriptPath = path.resolve(process.cwd(), "scripts/backup-db.ts");
      const backupScriptContent = fs.readFileSync(backupScriptPath, "utf-8");

      assert.doesNotMatch(
        backupScriptContent,
        /Database Backup Placeholder/i,
        "Script backup tidak boleh membuat file placeholder fiktif jika pg_dump gagal"
      );
      assert.match(
        backupScriptContent,
        /process\.exit\(1\)/,
        "Script backup harus keluar dengan exit code 1 pada kegagalan"
      );
    });
  });

  describe("3. A21: Kejujuran Angka Ringkasan & Metrik", () => {
    it("dashboard wali santri tidak boleh memakai fallback angka 89.8 jika santri belum memiliki nilai akademik", () => {
      const dashboardWaliPath = path.resolve(process.cwd(), "components/dashboard/dashboard-wali-santri.tsx");
      const dashboardWaliContent = fs.readFileSync(dashboardWaliPath, "utf-8");

      assert.doesNotMatch(
        dashboardWaliContent,
        /:\s*"89\.8"/,
        "Dashboard wali santri tidak boleh memasang hardcoded 89.8 saat nilai kosong"
      );
      assert.match(
        dashboardWaliContent,
        /Belum Ada Data/i,
        "Dashboard wali santri harus menampilkan 'Belum Ada Data' jika belum ada nilai"
      );
    });
  });
});
