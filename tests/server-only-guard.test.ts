import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Static Guard: Perlindungan Server-Only dan Integritas Konfigurasi", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("1. tsconfig.json utama tidak memetakan alias 'server-only'", () => {
    const tsconfigPath = path.join(rootDir, "tsconfig.json");
    const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf-8");
    let tsconfig: { compilerOptions?: { paths?: Record<string, unknown> } };
    try {
      tsconfig = JSON.parse(tsconfigRaw);
    } catch {
      // If tsconfig has comments, remove only pure comment lines
      const stripped = tsconfigRaw.replace(/^\s*\/\/.*$/gm, "");
      tsconfig = JSON.parse(stripped);
    }

    const paths = tsconfig.compilerOptions?.paths || {};
    assert.equal(
      paths["server-only"],
      undefined,
      "tsconfig.json tidak boleh memiliki mapping alias 'server-only'"
    );
    assert.ok(
      !tsconfigRaw.includes('"server-only"'),
      "tsconfig.json raw tidak boleh menyebut 'server-only'"
    );
  });

  it("2. lib/server/server-only-mock.ts tidak ada di repositori", () => {
    const mockFile = path.join(rootDir, "lib", "server", "server-only-mock.ts");
    assert.equal(
      fs.existsSync(mockFile),
      false,
      "File lib/server/server-only-mock.ts harus telah dihapus permanen"
    );
  });

  it("3. lib/server/ikhtibar-pending-service.ts dan lib/server/santri-list-service.ts mengimpor server-only asli", () => {
    const ikhtibarServicePath = path.join(rootDir, "lib", "server", "ikhtibar-pending-service.ts");
    const santriServicePath = path.join(rootDir, "lib", "server", "santri-list-service.ts");

    assert.ok(fs.existsSync(ikhtibarServicePath), "File ikhtibar-pending-service.ts harus ada");
    assert.ok(fs.existsSync(santriServicePath), "File santri-list-service.ts harus ada");

    const ikhtibarContent = fs.readFileSync(ikhtibarServicePath, "utf-8");
    const santriContent = fs.readFileSync(santriServicePath, "utf-8");

    const serverOnlyRegex = /import\s+["']server-only["'];?/;

    assert.match(
      ikhtibarContent,
      serverOnlyRegex,
      "ikhtibar-pending-service.ts wajib mengimpor 'server-only'"
    );
    assert.match(
      santriContent,
      serverOnlyRegex,
      "santri-list-service.ts wajib mengimpor 'server-only'"
    );
  });

  it("4. Tidak ada Client Component ('use client') yang mengimpor dari lib/server", () => {
    const dirsToScan = [
      path.join(rootDir, "components"),
      path.join(rootDir, "app"),
      path.join(rootDir, "lib"),
    ];

    function getFiles(dir: string): string[] {
      if (!fs.existsSync(dir)) return [];
      let results: string[] = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          // Abaikan lib/server itu sendiri
          if (fullPath === path.join(rootDir, "lib", "server")) continue;
          if (item.name === "node_modules" || item.name === ".next") continue;
          results = results.concat(getFiles(fullPath));
        } else if (/\.(tsx|ts|jsx|js)$/.test(item.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = dirsToScan.flatMap(getFiles);
    const clientViolations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      // Check if file is a client component
      const trimmed = content.trim();
      const isClient =
        trimmed.startsWith('"use client"') ||
        trimmed.startsWith("'use client'");

      if (isClient) {
        // Check for imports from server directory or server-only
        if (
          /from\s+["'][^"']*\/server(\/|["'])/.test(content) ||
          /import\s+["'][^"']*\/server(\/|["'])/.test(content) ||
          /from\s+["']@\/lib\/server/.test(content) ||
          /import\s+["']server-only["']/.test(content)
        ) {
          const relPath = path.relative(rootDir, file).replace(/\\/g, "/");
          clientViolations.push(relPath);
        }
      }
    }

    assert.deepEqual(
      clientViolations,
      [],
      `Client component tidak boleh mengimpor dari lib/server. Pelanggaran ditemukan pada: ${clientViolations.join(", ")}`
    );
  });
});
