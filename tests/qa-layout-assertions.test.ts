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
  evaluateStickyCollision,
  evaluateContentNotObscured,
  evaluateTouchTargetItem,
  evaluateMobileBottomNav,
  evaluateHeaderOffset,
  evaluateCriticalTextItem,
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

  describe("6. Fail-Closed Semantics & Decision Logic Tests", () => {
    describe("6.1 Sticky vs Bottom Nav Collision Semantics", () => {
      it("harus FAIL jika elemen sticky bar wajib tidak ditemukan di DOM", () => {
        const res = evaluateStickyCollision({
          status: "STICKY_NOT_FOUND",
          stickySelector: '[data-testid="floating-save-bar"]',
          navSelector: 'nav[data-testid="mobile-bottom-nav"]',
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("required element"), true);
      });

      it("harus FAIL jika elemen bottom nav wajib tidak ditemukan di DOM", () => {
        const res = evaluateStickyCollision({
          status: "NAV_NOT_FOUND",
          stickySelector: '[data-testid="floating-save-bar"]',
          navSelector: 'nav[data-testid="mobile-bottom-nav"]',
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("required element"), true);
      });

      it("harus FAIL jika elemen wajib tersembunyi atau memiliki dimensi 0", () => {
        const res = evaluateStickyCollision({
          status: "NOT_BOTH_VISIBLE",
          stickySelector: '[data-testid="floating-save-bar"]',
          navSelector: 'nav[data-testid="mobile-bottom-nav"]',
          isStickyVisible: false,
          isNavVisible: true,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("is hidden or has 0 dimension"), true);
      });

      it("harus PASS jika elemen opsional tidak ditemukan (pemeriksaan dilewati)", () => {
        const res = evaluateStickyCollision({
          status: "STICKY_NOT_FOUND",
          stickySelector: ".optional-sticky",
          navSelector: "nav",
          required: false,
        });
        assert.equal(res.passed, true);
        assert.equal(res.details.includes("Pemeriksaan dilewati"), true);
      });

      it("harus FAIL jika terjadi overlap nyata antara sticky bar dan bottom nav", () => {
        const res = evaluateStickyCollision({
          status: "CHECKED",
          stickySelector: "sticky",
          navSelector: "nav",
          overlap: true,
          overlapHeight: 18,
          stickyRect: { top: 700, bottom: 768, left: 0, right: 360, width: 360, height: 68 },
          navRect: { top: 750, bottom: 800, left: 0, right: 360, width: 360, height: 50 },
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("18px"), true);
      });

      it("harus PASS jika sticky bar berada aman di atas bottom nav", () => {
        const res = evaluateStickyCollision({
          status: "CHECKED",
          stickySelector: "sticky",
          navSelector: "nav",
          overlap: false,
          overlapHeight: 0,
          stickyRect: { top: 680, bottom: 745, left: 0, right: 360, width: 360, height: 65 },
          navRect: { top: 750, bottom: 800, left: 0, right: 360, width: 360, height: 50 },
        });
        assert.equal(res.passed, true);
      });
    });

    describe("6.2 Content Visibility Above Sticky Semantics", () => {
      it("harus FAIL jika target konten wajib tidak ditemukan di DOM", () => {
        const res = evaluateContentNotObscured({
          status: "TARGET_NOT_FOUND",
          targetSelector: '[data-testid="santri-presensi-list"] > *:last-child',
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("required target element"), true);
      });

      it("harus PASS jika target konten opsional tidak ditemukan", () => {
        const res = evaluateContentNotObscured({
          status: "TARGET_NOT_FOUND",
          targetSelector: ".optional-last-item",
          required: false,
        });
        assert.equal(res.passed, true);
      });

      it("harus FAIL jika baris terakhir tertutup oleh sticky area", () => {
        const res = evaluateContentNotObscured({
          status: "CHECKED",
          targetSelector: "last-item",
          isObscured: true,
          coveredPixels: 24,
          targetBottom: 780,
          highestStickyTop: 756,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("24px"), true);
      });

      it("harus PASS jika baris terakhir terlihat penuh di atas sticky area", () => {
        const res = evaluateContentNotObscured({
          status: "CHECKED",
          targetSelector: "last-item",
          isObscured: false,
          coveredPixels: 0,
          targetBottom: 720,
          highestStickyTop: 740,
        });
        assert.equal(res.passed, true);
      });
    });

    describe("6.3 Touch Target Item Semantics", () => {
      it("harus FAIL jika required touch target tidak ditemukan (missing)", () => {
        const res = evaluateTouchTargetItem({
          selector: 'button[data-testid="primary-action"]',
          label: "Primary Action",
          status: "NOT_FOUND",
          width: 0,
          height: 0,
          minDim: 44,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.failureType, "missing");
        assert.equal(res.reason?.includes("was not found"), true);
      });

      it("harus FAIL jika required touch target tersembunyi / hidden", () => {
        const res = evaluateTouchTargetItem({
          selector: 'button[data-testid="modal-close"]',
          label: "Close Modal",
          status: "HIDDEN",
          width: 0,
          height: 0,
          minDim: 44,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.failureType, "hidden");
      });

      it("harus PASS jika optional touch target tidak ditemukan atau hidden", () => {
        const missingRes = evaluateTouchTargetItem({
          selector: ".optional-filter",
          label: "Optional Filter",
          status: "NOT_FOUND",
          width: 0,
          height: 0,
          minDim: 44,
          required: false,
        });
        assert.equal(missingRes.passed, true);

        const hiddenRes = evaluateTouchTargetItem({
          selector: ".optional-filter",
          label: "Optional Filter",
          status: "HIDDEN",
          width: 0,
          height: 0,
          minDim: 44,
          required: false,
        });
        assert.equal(hiddenRes.passed, true);
      });

      it("harus FAIL jika touch target berukuran di bawah standar minimum", () => {
        const res = evaluateTouchTargetItem({
          selector: "button.small-icon",
          label: "Small Icon",
          status: "MEASURED",
          width: 32,
          height: 32,
          minDim: 44,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.failureType, "failed-size");
      });

      it("harus PASS jika touch target memenuhi standar ukuran (>= 44x44 px)", () => {
        const res = evaluateTouchTargetItem({
          selector: "button.valid",
          label: "Valid Button",
          status: "MEASURED",
          width: 44,
          height: 44,
          minDim: 44,
          required: true,
        });
        assert.equal(res.passed, true);
      });
    });

    describe("6.4 Mobile Bottom Nav Semantics", () => {
      it("harus FAIL jika required mobile bottom nav tidak terlihat / absent", () => {
        const res = evaluateMobileBottomNav({
          status: "NOT_VISIBLE",
          count: 0,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("was not visible"), true);
      });

      it("harus FAIL jika terdeteksi duplicate bottom nav instances", () => {
        const res = evaluateMobileBottomNav({
          status: "VISIBLE",
          count: 2,
          isDuplicate: true,
          clickableCount: 8,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("2 instance bottom nav bersamaan"), true);
      });

      it("harus FAIL jika bottom nav overflow secara horizontal", () => {
        const res = evaluateMobileBottomNav({
          status: "VISIBLE",
          count: 1,
          isOverflowing: true,
          clickableCount: 5,
          rect: { top: 750, bottom: 800, left: 0, right: 380, width: 380, height: 50 },
          windowWidth: 360,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("overflow"), true);
      });

      it("harus FAIL jika required controls kurang dari 4 tombol navigasi", () => {
        const res = evaluateMobileBottomNav({
          status: "VISIBLE",
          count: 1,
          clickableCount: 3,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("Hanya 3 tombol navigasi"), true);
      });

      it("harus PASS jika single instance bottom nav aktif dengan kontrol lengkap", () => {
        const res = evaluateMobileBottomNav({
          status: "VISIBLE",
          count: 1,
          clickableCount: 5,
          isDuplicate: false,
          isOverflowing: false,
          rect: { top: 750, bottom: 800, left: 0, right: 360, width: 360, height: 50 },
          windowWidth: 360,
          required: true,
        });
        assert.equal(res.passed, true);
      });
    });

    describe("6.5 Header Offset Semantics", () => {
      it("harus FAIL jika sticky header wajib tidak ditemukan", () => {
        const res = evaluateHeaderOffset({
          status: "HEADER_NOT_FOUND",
          headingSelector: "h1",
          stickyHeaderSelector: "header",
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("was not found"), true);
      });

      it("harus FAIL jika heading konten wajib tidak ditemukan", () => {
        const res = evaluateHeaderOffset({
          status: "HEADING_NOT_FOUND",
          headingSelector: "h1, h2",
          stickyHeaderSelector: "header",
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("was not found outside header"), true);
      });

      it("harus FAIL jika header wajib tidak memiliki posisi sticky/fixed", () => {
        const res = evaluateHeaderOffset({
          status: "HEADER_NOT_STICKY",
          headingSelector: "h1",
          stickyHeaderSelector: "header",
          required: true,
          expectedSticky: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("bukan sticky atau fixed"), true);
      });

      it("harus FAIL jika judul konten tertutup oleh sticky header", () => {
        const res = evaluateHeaderOffset({
          status: "CHECKED",
          headingSelector: "h1",
          stickyHeaderSelector: "header",
          isUnderHeader: true,
          overlapPixels: 15,
          headingTop: 45,
          headerBottom: 60,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.details.includes("15px"), true);
      });

      it("harus PASS jika judul konten berada di bawah sticky header secara aman", () => {
        const res = evaluateHeaderOffset({
          status: "CHECKED",
          headingSelector: "h1",
          stickyHeaderSelector: "header",
          isUnderHeader: false,
          overlapPixels: 0,
          headingTop: 72,
          headerBottom: 60,
          required: true,
        });
        assert.equal(res.passed, true);
      });
    });

    describe("6.6 Critical Text Item Semantics", () => {
      it("harus FAIL jika teks kritis wajib tidak ditemukan di DOM", () => {
        const res = evaluateCriticalTextItem({
          selector: "h1.page-title",
          label: "Page Title",
          status: "NOT_FOUND",
          diff: 0,
          scrollWidth: 0,
          clientWidth: 0,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.failureType, "missing");
      });

      it("harus FAIL jika teks kritis wajib tersembunyi / hidden", () => {
        const res = evaluateCriticalTextItem({
          selector: "h1.page-title",
          label: "Page Title",
          status: "HIDDEN",
          diff: 0,
          scrollWidth: 0,
          clientWidth: 0,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.failureType, "hidden");
      });

      it("harus FAIL jika teks kritis terpotong secara horizontal (scrollWidth > clientWidth)", () => {
        const res = evaluateCriticalTextItem({
          selector: "h1.page-title",
          label: "Page Title",
          status: "MEASURED",
          diff: 12,
          scrollWidth: 320,
          clientWidth: 308,
          required: true,
        });
        assert.equal(res.passed, false);
        assert.equal(res.failureType, "clipped");
        assert.equal(res.reason?.includes("12px"), true);
      });

      it("harus PASS jika teks kritis terbaca utuh tanpa clipping", () => {
        const res = evaluateCriticalTextItem({
          selector: "h1.page-title",
          label: "Page Title",
          status: "MEASURED",
          diff: 0,
          scrollWidth: 280,
          clientWidth: 280,
          required: true,
        });
        assert.equal(res.passed, true);
      });
    });
  });
});

