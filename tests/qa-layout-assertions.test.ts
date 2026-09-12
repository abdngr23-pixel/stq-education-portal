// Unit Test Pengujian Helper Structural QA & Layout Assertions
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import {
  rectanglesOverlap,
  computeOverlap,
  getArtifactDirectories,
  formatFindingsTable,
  VisualFinding,
  DOMRectLike,
} from "./helpers/qa-layout-assertions";
import { formatWitaDateIndonesian } from "../lib/wita-date";

describe("QA Layout Assertions Helper Suite", () => {
  describe("1. Bounding Rectangles Overlap & Intersection Detection", () => {
    it("harus mendeteksi dua kotak yang sepenuhnya terpisah (disjoint) sebagai TIDAK overlap", () => {
      const rectA: DOMRectLike = { top: 0, bottom: 50, left: 0, right: 100, width: 100, height: 50 };
      const rectB: DOMRectLike = { top: 60, bottom: 110, left: 0, right: 100, width: 100, height: 50 }; // Gap vertikal 10px

      assert.equal(rectanglesOverlap(rectA, rectB), false);
      const overlap = computeOverlap(rectA, rectB);
      assert.equal(overlap.overlap, false);
      assert.equal(overlap.overlapArea, 0);

      const rectC: DOMRectLike = { top: 0, bottom: 50, left: 110, right: 200, width: 90, height: 50 }; // Gap horizontal 10px
      assert.equal(rectanglesOverlap(rectA, rectC), false);
    });

    it("harus memperlakukan tepi yang bersentuhan tepat (touching edges) sebagai TIDAK overlap", () => {
      // Sticky bar tepat di atas bottom nav: sticky.bottom === nav.top
      const stickyBar: DOMRectLike = { top: 700, bottom: 750, left: 0, right: 390, width: 390, height: 50 };
      const bottomNav: DOMRectLike = { top: 750, bottom: 810, left: 0, right: 390, width: 390, height: 60 };

      assert.equal(rectanglesOverlap(stickyBar, bottomNav), false);
      const overlap = computeOverlap(stickyBar, bottomNav);
      assert.equal(overlap.overlap, false);
      assert.equal(overlap.overlapArea, 0);
    });

    it("harus mendeteksi tabrakan (collision) ketika sticky bar tumpang tindih dengan bottom nav", () => {
      // Sticky bar tumpang tindih 15px dengan bottom nav
      const stickyBar: DOMRectLike = { top: 710, bottom: 765, left: 0, right: 390, width: 390, height: 55 };
      const bottomNav: DOMRectLike = { top: 750, bottom: 810, left: 0, right: 390, width: 390, height: 60 };

      assert.equal(rectanglesOverlap(stickyBar, bottomNav), true);
      const overlap = computeOverlap(stickyBar, bottomNav);
      assert.equal(overlap.overlap, true);
      assert.equal(overlap.overlapHeight, 15);
      assert.equal(overlap.overlapWidth, 390);
      assert.equal(overlap.overlapArea, 15 * 390);
    });

    it("harus mendeteksi elemen yang sepenuhnya berada di dalam elemen lain (enclosed)", () => {
      const container: DOMRectLike = { top: 0, bottom: 500, left: 0, right: 500, width: 500, height: 500 };
      const inner: DOMRectLike = { top: 50, bottom: 150, left: 50, right: 150, width: 100, height: 100 };

      assert.equal(rectanglesOverlap(container, inner), true);
      const overlap = computeOverlap(container, inner);
      assert.equal(overlap.overlap, true);
      assert.equal(overlap.overlapWidth, 100);
      assert.equal(overlap.overlapHeight, 100);
      assert.equal(overlap.overlapArea, 10000);
    });

    it("harus mengembalikan false jika salah satu rectangle memiliki dimensi nol/tidak terlihat", () => {
      const visible: DOMRectLike = { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 };
      const zeroWidth: DOMRectLike = { top: 0, bottom: 100, left: 50, right: 50, width: 0, height: 100 };
      const zeroHeight: DOMRectLike = { top: 50, bottom: 50, left: 0, right: 100, width: 100, height: 0 };

      assert.equal(rectanglesOverlap(visible, zeroWidth), false);
      assert.equal(rectanglesOverlap(visible, zeroHeight), false);
    });
  });

  describe("2. Touch Target Minimum Threshold Behavior", () => {
    it("harus memvalidasi touch target berukuran >= 44x44 px sebagai valid", () => {
      const validButton: DOMRectLike = { top: 10, bottom: 58, left: 10, right: 58, width: 48, height: 48 };
      const minButton: DOMRectLike = { top: 10, bottom: 54, left: 10, right: 54, width: 44, height: 44 };

      const isMinValid = (rect: DOMRectLike) => rect.width >= 43 && rect.height >= 43; // toleransi 1px subpixel
      assert.equal(isMinValid(validButton), true);
      assert.equal(isMinValid(minButton), true);
    });

    it("harus mendeteksi touch target di bawah 44x44 px sebagai tidak memenuhi standar", () => {
      const smallButton: DOMRectLike = { top: 10, bottom: 42, left: 10, right: 42, width: 32, height: 32 };
      const narrowButton: DOMRectLike = { top: 10, bottom: 58, left: 10, right: 34, width: 24, height: 48 };

      const isMinValid = (rect: DOMRectLike) => rect.width >= 43 && rect.height >= 43;
      assert.equal(isMinValid(smallButton), false);
      assert.equal(isMinValid(narrowButton), false);
    });
  });

  describe("3. Portable Artifact Path Resolution", () => {
    it("harus menghasilkan path portabel tanpa dependensi direktori user lokal hardcoded", () => {
      const { artifactDir, docsDir } = getArtifactDirectories();

      // Path tidak boleh memuat hardcoded nama user tertentu
      assert.equal(artifactDir.includes("C:\\Users\\Lenovo\\.gemini"), false);
      assert.equal(docsDir.includes("C:\\Users\\Lenovo\\.gemini"), false);

      // Path harus berada di dalam workspace atau environment yang didefinisikan
      assert.equal(fs.existsSync(artifactDir), true);
      assert.equal(fs.existsSync(docsDir), true);

      // Memastikan pemisah direktori valid sesuai OS
      assert.equal(path.isAbsolute(artifactDir), true);
      assert.equal(path.isAbsolute(docsDir), true);
    });

    it("harus menghormati override environment variable QA_ARTIFACT_DIR jika disediakan", () => {
      const customDir = path.join(process.cwd(), "artifacts", "test-custom-qa");
      process.env.QA_ARTIFACT_DIR = customDir;
      try {
        const { artifactDir } = getArtifactDirectories();
        assert.equal(artifactDir, customDir);
        assert.equal(fs.existsSync(customDir), true);
      } finally {
        delete process.env.QA_ARTIFACT_DIR;
        try {
          if (fs.existsSync(customDir)) fs.rmdirSync(customDir);
        } catch {}
      }
    });
  });

  describe("4. Visual Findings Table Formatter", () => {
    it("harus mengembalikan pesan sukses jika daftar temuan kosong", () => {
      const table = formatFindingsTable([]);
      assert.equal(table.includes("Tidak ada visual finding"), true);
    });

    it("harus memformat temuan visual menjadi tabel Markdown yang rapi dengan kolom lengkap", () => {
      const findings: VisualFinding[] = [
        {
          severity: "P1",
          page: "Presensi",
          viewport: "mobile_360x800",
          component: "[data-testid=\"floating-save-bar\"]",
          issue: "Sticky action bar overlaps bottom navigation by 12px",
          measurement: "overlapHeight=12px",
          recommendation: "Sesuaikan safe-area bottom offset",
        },
      ];

      const table = formatFindingsTable(findings);
      assert.equal(table.includes("| Severity | Page | Viewport |"), true);
      assert.equal(table.includes("| P1 | Presensi | mobile_360x800 |"), true);
      assert.equal(table.includes("overlapHeight=12px"), true);
    });
  });

  describe("5. Invariant WITA Date Formatting", () => {
    it("harus memformat tanggal cetak rapor konsisten dalam zona Asia/Makassar (WITA)", () => {
      // 2026-09-12T00:00:00.000Z = 12 September 2026 pukul 08:00 WITA
      const testDate = new Date("2026-09-12T00:00:00.000Z");
      const formatted = formatWitaDateIndonesian(testDate);
      assert.equal(formatted, "12 September 2026");

      // Pergantian hari: 2026-09-11T16:00:00.000Z = 2026-09-12T00:00:00 WITA
      const testMidnight = new Date("2026-09-11T16:00:00.000Z");
      const formattedMidnight = formatWitaDateIndonesian(testMidnight);
      assert.equal(formattedMidnight, "12 September 2026");
    });
  });
});
