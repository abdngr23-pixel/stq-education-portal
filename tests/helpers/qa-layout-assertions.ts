import { Page } from "puppeteer-core";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export interface DOMRectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface VisualFinding {
  severity: "P0" | "P1" | "P2" | "INFO";
  page: string;
  viewport: string;
  component: string;
  issue: string;
  measurement: string;
  recommendation: string;
}

export interface AssertionResult {
  passed: boolean;
  category: string;
  page: string;
  viewport: string;
  details: string;
  finding?: VisualFinding;
}

/**
 * Memeriksa apakah dua kotak pembatas (bounding rectangles) saling beririsan (overlap) di viewport 2D.
 */
export function rectanglesOverlap(a: DOMRectLike, b: DOMRectLike): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false;
  }
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

/**
 * Menghitung luas dan dimensi irisan antara dua bounding rectangle.
 */
export function computeOverlap(
  a: DOMRectLike,
  b: DOMRectLike
): { overlap: boolean; overlapWidth: number; overlapHeight: number; overlapArea: number } {
  if (!rectanglesOverlap(a, b)) {
    return { overlap: false, overlapWidth: 0, overlapHeight: 0, overlapArea: 0 };
  }
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return {
    overlap: true,
    overlapWidth: xOverlap,
    overlapHeight: yOverlap,
    overlapArea: xOverlap * yOverlap,
  };
}

/**
 * Resolusi path executable browser Chrome/Chromium lintas platform yang portabel.
 */
export function getChromeExecutablePath(): string {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe")
        : "",
      process.env.PROGRAMFILES
        ? path.join(process.env.PROGRAMFILES, "Google\\Chrome\\Application\\chrome.exe")
        : "",
      process.env["PROGRAMFILES(X86)"]
        ? path.join(process.env["PROGRAMFILES(X86)"], "Google\\Chrome\\Application\\chrome.exe")
        : "",
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    // Linux / CI environments
    const candidates = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }

    try {
      const res = spawnSync("which", ["google-chrome"], { encoding: "utf-8" });
      const p = res.stdout ? res.stdout.trim() : "";
      if (p && fs.existsSync(p)) return p;
    } catch {}

    try {
      const res = spawnSync("which", ["chromium-browser"], { encoding: "utf-8" });
      const p = res.stdout ? res.stdout.trim() : "";
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }

  throw new Error(
    `[CHROME_NOT_FOUND] Tidak dapat menemukan executable Google Chrome atau Chromium pada platform ${process.platform}. Silakan definisikan CHROME_PATH atau PUPPETEER_EXECUTABLE_PATH.`
  );
}

/**
 * Menyiapkan direktori penyimpanan artifact visual QA secara portabel lintas OS.
 */
export function getArtifactDirectories(): { artifactDir: string; docsDir: string } {
  const artifactDir =
    process.env.QA_ARTIFACT_DIR ||
    path.join(process.cwd(), "artifacts", "visual-qa");

  const docsDir =
    process.env.DOCS_SCREENSHOTS_DIR ||
    path.join(process.cwd(), "docs", "screenshots", "post-merge");

  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  return { artifactDir, docsDir };
}

/**
 * 1. Assertion: Memastikan halaman tidak mengalami horizontal overflow global (page-level accidental overflow),
 * sambil mengizinkan komponen internal yang memang didesain overflow-x-auto (seperti tab strip).
 */
export async function assertNoHorizontalOverflow(
  page: Page,
  pageName: string,
  viewport: string,
  tolerance = 2
): Promise<AssertionResult> {
  const measurement = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const clientWidth = docEl.clientWidth;
    const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
    const diff = scrollWidth - clientWidth;

    // Cari elemen yang melebihi clientWidth namun bukan kontainer overflow-x-auto / scroll
    const overflowingElements: string[] = [];
    if (diff > 0) {
      const allEls = document.querySelectorAll("body *");
      for (const el of Array.from(allEls)) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) continue;
        const style = window.getComputedStyle(el);
        const isInternalScroll =
          style.overflowX === "auto" || style.overflowX === "scroll";
        if (rect.right > clientWidth + 2 && !isInternalScroll) {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const cls = el.className && typeof el.className === "string"
            ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
            : "";
          const testId = el.getAttribute("data-testid")
            ? `[data-testid="${el.getAttribute("data-testid")}"]`
            : "";
          const identifier = `${tag}${id}${testId || cls}`;
          if (!overflowingElements.includes(identifier)) {
            overflowingElements.push(identifier);
          }
        }
      }
    }

    return {
      clientWidth,
      scrollWidth,
      diff,
      overflowingElements: overflowingElements.slice(0, 5),
    };
  });

  const passed = measurement.diff <= tolerance;
  const details = passed
    ? `Page width aman: clientWidth=${measurement.clientWidth}px, scrollWidth=${measurement.scrollWidth}px (diff=${measurement.diff}px <= ${tolerance}px)`
    : `Horizontal overflow terdeteksi: scrollWidth=${measurement.scrollWidth}px melebihi clientWidth=${measurement.clientWidth}px sebesar ${measurement.diff}px. Elemen: ${measurement.overflowingElements.join(", ") || "tidak terlacak"}`;

  return {
    passed,
    category: "Horizontal Overflow",
    page: pageName,
    viewport,
    details,
    finding: !passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: measurement.overflowingElements[0] || "document.documentElement",
          issue: `Page-level horizontal overflow sebesar ${measurement.diff}px`,
          measurement: `scrollWidth=${measurement.scrollWidth}px > clientWidth=${measurement.clientWidth}px (+${measurement.diff}px)`,
          recommendation:
            "Periksa pembatas lebar container atau wrapping kontainer elemen yang keluar dari lebar layar.",
        }
      : undefined,
  };
}

/**
 * 2. Assertion: Memastikan floating sticky bar dan bottom navigation tidak bertabrakan/tumpang tindih (overlap).
 */
export async function assertNoStickyCollision(
  page: Page,
  pageName: string,
  viewport: string,
  stickySelector: string,
  navSelector: string
): Promise<AssertionResult> {
  const result = await page.evaluate(
    (stickySel, navSel) => {
      const stickyEl = document.querySelector(stickySel);
      const navEl = document.querySelector(navSel);

      if (!stickyEl) return { status: "STICKY_NOT_FOUND" };
      if (!navEl) return { status: "NAV_NOT_FOUND" };

      const stickyRect = stickyEl.getBoundingClientRect();
      const navRect = navEl.getBoundingClientRect();

      const isStickyVisible =
        stickyRect.width > 0 &&
        stickyRect.height > 0 &&
        window.getComputedStyle(stickyEl).display !== "none" &&
        window.getComputedStyle(stickyEl).visibility !== "hidden";

      const isNavVisible =
        navRect.width > 0 &&
        navRect.height > 0 &&
        window.getComputedStyle(navEl).display !== "none" &&
        window.getComputedStyle(navEl).visibility !== "hidden";

      if (!isStickyVisible || !isNavVisible) {
        return {
          status: "NOT_BOTH_VISIBLE",
          isStickyVisible,
          isNavVisible,
        };
      }

      const overlap = !(
        stickyRect.right <= navRect.left ||
        stickyRect.left >= navRect.right ||
        stickyRect.bottom <= navRect.top ||
        stickyRect.top >= navRect.bottom
      );

      const overlapHeight = overlap
        ? Math.max(0, Math.min(stickyRect.bottom, navRect.bottom) - Math.max(stickyRect.top, navRect.top))
        : 0;

      return {
        status: "CHECKED",
        overlap,
        overlapHeight,
        stickyRect: {
          top: stickyRect.top,
          bottom: stickyRect.bottom,
          left: stickyRect.left,
          right: stickyRect.right,
          width: stickyRect.width,
          height: stickyRect.height,
        },
        navRect: {
          top: navRect.top,
          bottom: navRect.bottom,
          left: navRect.left,
          right: navRect.right,
          width: navRect.width,
          height: navRect.height,
        },
      };
    },
    stickySelector,
    navSelector
  );

  if (result.status === "STICKY_NOT_FOUND" || result.status === "NAV_NOT_FOUND" || result.status === "NOT_BOTH_VISIBLE") {
    return {
      passed: true,
      category: "Sticky vs Bottom Nav",
      page: pageName,
      viewport,
      details: `Elemen tidak aktif bersamaan di viewport ini (status: ${result.status}). Tidak ada overlap.`,
    };
  }

  const passed = !result.overlap;
  const details = passed
    ? `Sticky bar (bottom: ${result.stickyRect?.bottom}px) dan Bottom Nav (top: ${result.navRect?.top}px) tidak overlap.`
    : `Sticky bar dan Bottom Nav bertabrakan / overlap sebesar ${result.overlapHeight}px! (sticky.bottom: ${result.stickyRect?.bottom}px > nav.top: ${result.navRect?.top}px)`;

  return {
    passed,
    category: "Sticky vs Bottom Nav Collision",
    page: pageName,
    viewport,
    details,
    finding: !passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: stickySelector,
          issue: `Sticky action bar overlaps bottom navigation by ${result.overlapHeight}px`,
          measurement: `overlapHeight=${result.overlapHeight}px (stickyBottom=${result.stickyRect?.bottom}px, navTop=${result.navRect?.top}px)`,
          recommendation:
            "Tambahkan offset atau safe bottom spacing pada sticky action bar agar tetap berada di atas bottom nav.",
        }
      : undefined,
  };
}

/**
 * 3. Assertion: Memastikan baris/konten terakhir dapat discroll dan tidak tertutup permanen oleh sticky area.
 */
export async function assertContentNotObscured(
  page: Page,
  pageName: string,
  viewport: string,
  targetSelector: string,
  stickySelectors: string[]
): Promise<AssertionResult> {
  const result = await page.evaluate(
    (targetSel, stickySels) => {
      const targetEl = document.querySelector(targetSel);
      if (!targetEl) return { status: "TARGET_NOT_FOUND" };

      // Pastikan target konten terakhir dapat discroll ke posisi di atas sticky bar (tidak tertutup permanen)
      targetEl.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });

      const targetRect = targetEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Kumpulkan boundary dari semua sticky overlay yang terlihat di bagian bawah layar
      let highestStickyTop = viewportHeight;
      const visibleStickies: { selector: string; top: number; bottom: number }[] = [];

      for (const sel of stickySels) {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          ) {
            visibleStickies.push({ selector: sel, top: rect.top, bottom: rect.bottom });
            if (rect.top < highestStickyTop) {
              highestStickyTop = rect.top;
            }
          }
        }
      }

      const isObscured = targetRect.bottom > highestStickyTop + 2; // toleransi 2px
      const coveredPixels = isObscured ? Math.round(targetRect.bottom - highestStickyTop) : 0;

      return {
        status: "CHECKED",
        isObscured,
        coveredPixels,
        targetBottom: targetRect.bottom,
        highestStickyTop,
        visibleStickies,
      };
    },
    targetSelector,
    stickySelectors
  );

  if (result.status === "TARGET_NOT_FOUND") {
    return {
      passed: true,
      category: "Content Visibility Above Sticky",
      page: pageName,
      viewport,
      details: `Target selector ${targetSelector} tidak ditemukan pada halaman ini.`,
    };
  }

  const passed = !result.isObscured;
  const details = passed
    ? `Konten terakhir terlihat penuh: target bottom (${result.targetBottom}px) berada di atas sticky area (${result.highestStickyTop}px).`
    : `Konten terakhir tertutup oleh sticky area sebesar ${result.coveredPixels}px (target bottom ${result.targetBottom}px > sticky top ${result.highestStickyTop}px).`;

  return {
    passed,
    category: "Content Visibility Above Sticky",
    page: pageName,
    viewport,
    details,
    finding: !passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: targetSelector,
          issue: `Konten terakhir tertutup oleh sticky area sebesar ${result.coveredPixels}px saat scroll di bawah`,
          measurement: `targetBottom=${result.targetBottom}px, highestStickyTop=${result.highestStickyTop}px`,
          recommendation:
            "Tingkatkan padding-bottom pada container daftar (misal pb-36) agar item terakhir dapat diakses penuh.",
        }
      : undefined,
  };
}

/**
 * 4. Assertion: Touch target minimum 44 x 44 px untuk primary clickable controls.
 */
export async function assertTouchTargets(
  page: Page,
  pageName: string,
  viewport: string,
  targets: Array<{ selector: string; label: string }>,
  minDimension = 44
): Promise<AssertionResult> {
  const measurements = await page.evaluate(
    (targetList, minDim) => {
      return targetList.map((t) => {
        const el = document.querySelector(t.selector);
        if (!el) return { ...t, status: "NOT_FOUND", passed: true, width: 0, height: 0 };

        // Cari parent clickable jika target adalah SVG / icon glyph
        let clickableEl: Element = el;
        if (el.tagName.toLowerCase() === "svg" || el.tagName.toLowerCase() === "path") {
          const parentBtn = el.closest("button, a, [role='button']");
          if (parentBtn) clickableEl = parentBtn;
        }

        const rect = clickableEl.getBoundingClientRect();
        const style = window.getComputedStyle(clickableEl);
        if (style.display === "none" || style.visibility === "hidden" || rect.width === 0) {
          return { ...t, status: "HIDDEN", passed: true, width: 0, height: 0 };
        }

        // Toleransi subpixel 1px
        const passed = rect.width >= minDim - 1 && rect.height >= minDim - 1;

        return {
          ...t,
          status: "MEASURED",
          passed,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
    },
    targets,
    minDimension
  );

  const failedItems = measurements.filter((m) => m.status === "MEASURED" && !m.passed);
  const passed = failedItems.length === 0;

  const details = passed
    ? `Semua ${measurements.filter((m) => m.status === "MEASURED").length} target sentuh terukur memenuhi syarat minimal ${minDimension}x${minDimension}px.`
    : `Ditemukan ${failedItems.length} kontrol dengan touch target di bawah standar ${minDimension}px: ${failedItems.map((f) => `${f.label} (${f.width}x${f.height}px)`).join(", ")}`;

  return {
    passed,
    category: "Touch Target Size",
    page: pageName,
    viewport,
    details,
    finding: !passed
      ? {
          severity: "P2",
          page: pageName,
          viewport,
          component: failedItems[0].selector,
          issue: `Touch target kontrol "${failedItems[0].label}" di bawah ukuran minimum ${minDimension}x${minDimension}px`,
          measurement: `${failedItems[0].width}x${failedItems[0].height}px (< ${minDimension}x${minDimension}px)`,
          recommendation:
            `Tingkatkan padding atau min-height/min-width pada elemen kontrol tombol agar mencapai setidaknya ${minDimension}x${minDimension}px.`,
        }
      : undefined,
  };
}

/**
 * 5. Assertion: Single Mobile Bottom Navigation instance, non-overflowing & clickable.
 */
export async function assertMobileBottomNav(
  page: Page,
  pageName: string,
  viewport: string,
  navSelector = 'nav[data-testid="mobile-bottom-nav"]'
): Promise<AssertionResult> {
  const result = await page.evaluate((sel) => {
    const navs = Array.from(document.querySelectorAll(sel));
    const visibleNavs = navs.filter((n) => {
      const rect = n.getBoundingClientRect();
      const style = window.getComputedStyle(n);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    if (visibleNavs.length === 0) {
      return { status: "NOT_VISIBLE", count: 0 };
    }

    const nav = visibleNavs[0];
    const rect = nav.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    const isDuplicate = visibleNavs.length > 1;
    const isOverflowing = rect.left < -1 || rect.right > windowWidth + 1;
    const buttons = Array.from(nav.querySelectorAll("button, a"));
    const clickableCount = buttons.filter((b) => {
      const bRect = b.getBoundingClientRect();
      return bRect.width > 0 && bRect.height > 0;
    }).length;

    return {
      status: "VISIBLE",
      count: visibleNavs.length,
      isDuplicate,
      isOverflowing,
      rect: {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
      buttonCount: buttons.length,
      clickableCount,
      windowWidth,
    };
  }, navSelector);

  if (result.status !== "VISIBLE") {
    return {
      passed: true,
      category: "Mobile Bottom Nav",
      page: pageName,
      viewport,
      details: `Mobile bottom nav tidak aktif di tampilan ini.`,
    };
  }

  const clickableCount = result.clickableCount ?? 0;
  const passed = !result.isDuplicate && !result.isOverflowing && clickableCount >= 4;
  let issue = "";
  if (result.isDuplicate) issue = `Terdeteksi ${result.count} instance bottom nav bersamaan!`;
  else if (result.isOverflowing) issue = `Bottom nav overflow di luar layar (right=${result.rect?.right}px > winWidth=${result.windowWidth}px)`;
  else if (clickableCount < 4) issue = `Hanya ${clickableCount} tombol navigasi yang aktif/terlihat.`;

  return {
    passed,
    category: "Mobile Bottom Nav",
    page: pageName,
    viewport,
    details: passed
      ? `Satu instance bottom nav aktif (${clickableCount} tombol, lebar ${result.rect?.width}px aman).`
      : issue,
    finding: !passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: navSelector,
          issue,
          measurement: `instances=${result.count}, clickable=${result.clickableCount}, width=${result.rect?.width}px`,
          recommendation:
            "Pastikan bottom navigation hanya dirender satu kali dan memiliki lebar w-full dengan inset-x-0.",
        }
      : undefined,
  };
}

/**
 * 6. Assertion: Memastikan page heading tidak tertutup oleh sticky header (scroll-padding/header offset).
 */
export async function assertHeaderOffset(
  page: Page,
  pageName: string,
  viewport: string,
  headingSelector: string,
  stickyHeaderSelector = "header"
): Promise<AssertionResult> {
  const result = await page.evaluate(
    (headSel, stickySel) => {
      const header = document.querySelector(stickySel);
      if (!header) return { status: "HEADER_NOT_FOUND" };

      // Pastikan kontainer berada di posisi paling atas saat menguji header offset
      const scrollable = document.querySelector(".overflow-y-auto") || document.scrollingElement || document.documentElement;
      if (scrollable) {
        scrollable.scrollTop = 0;
      }
      window.scrollTo(0, 0);

      // Cari elemen heading di dalam konten yang bukan merupakan bagian dari header itu sendiri
      const allHeadings = Array.from(document.querySelectorAll(headSel));
      const heading = allHeadings.find((h) => {
        if (header.contains(h)) return false;
        const rect = h.getBoundingClientRect();
        const style = window.getComputedStyle(h);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });

      if (!heading) return { status: "HEADING_NOT_FOUND" };

      const headRect = heading.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();

      const isHeaderSticky =
        window.getComputedStyle(header).position === "sticky" ||
        window.getComputedStyle(header).position === "fixed";

      if (!isHeaderSticky) {
        return { status: "HEADER_NOT_STICKY" };
      }

      // Toleransi 2px
      const isUnderHeader = headRect.top < headerRect.bottom - 2;
      const overlapPixels = isUnderHeader ? Math.round(headerRect.bottom - headRect.top) : 0;

      return {
        status: "CHECKED",
        isUnderHeader,
        overlapPixels,
        headingTop: Math.round(headRect.top),
        headerBottom: Math.round(headerRect.bottom),
      };
    },
    headingSelector,
    stickyHeaderSelector
  );

  if (result.status !== "CHECKED") {
    return {
      passed: true,
      category: "Header Offset",
      page: pageName,
      viewport,
      details: `Pemeriksaan offset dilewati (status: ${result.status}).`,
    };
  }

  const passed = !result.isUnderHeader;
  const details = passed
    ? `Page heading (top: ${result.headingTop}px) tidak tertutup sticky header (bottom: ${result.headerBottom}px).`
    : `Page heading tertutup sticky header sebesar ${result.overlapPixels}px (heading top ${result.headingTop}px < header bottom ${result.headerBottom}px).`;

  return {
    passed,
    category: "Header Offset",
    page: pageName,
    viewport,
    details,
    finding: !passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: headingSelector,
          issue: `Judul halaman tertutup oleh sticky header sebesar ${result.overlapPixels}px`,
          measurement: `headingTop=${result.headingTop}px, headerBottom=${result.headerBottom}px`,
          recommendation:
            "Tambahkan padding-top atau scroll-pt pada container konten utama agar elemen judul tidak tenggelam di bawah header.",
        }
      : undefined,
  };
}

/**
 * 7. Assertion: Memastikan teks kritis (critical text) seperti heading utama tidak terpotong (clipped).
 */
export async function assertCriticalTextClipping(
  page: Page,
  pageName: string,
  viewport: string,
  selectors: Array<{ selector: string; label: string }>
): Promise<AssertionResult> {
  const results = await page.evaluate((targetSelectors) => {
    return targetSelectors.map((item) => {
      const el = document.querySelector(item.selector);
      if (!el) {
        return {
          ...item,
          status: "NOT_FOUND",
          passed: true,
          diff: 0,
          scrollWidth: 0,
          clientWidth: 0,
          text: "",
        };
      }

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return {
          ...item,
          status: "HIDDEN",
          passed: true,
          diff: 0,
          scrollWidth: 0,
          clientWidth: 0,
          text: "",
        };
      }

      // Toleransi 1px
      const diff = el.scrollWidth - el.clientWidth;
      const passed = diff <= 1;

      return {
        ...item,
        status: "MEASURED",
        passed,
        diff,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        text: (el.textContent || "").trim().slice(0, 30),
      };
    });
  }, selectors);

  const clipped = results.filter((r) => r.status === "MEASURED" && !r.passed);
  const passed = clipped.length === 0;

  const details = passed
    ? `Seluruh ${results.filter((r) => r.status === "MEASURED").length} elemen teks kritis terbaca tanpa clipping.`
    : `Ditemukan ${clipped.length} teks kritis terpotong: ${clipped.map((c) => `"${c.label}" (${c.diff}px overflow)`).join(", ")}`;

  return {
    passed,
    category: "Critical Text Clipping",
    page: pageName,
    viewport,
    details,
    finding: !passed
      ? {
          severity: "P2",
          page: pageName,
          viewport,
          component: clipped[0].selector,
          issue: `Teks kritis "${clipped[0].label}" terpotong secara horizontal`,
          measurement: `scrollWidth=${clipped[0].scrollWidth}px > clientWidth=${clipped[0].clientWidth}px (+${clipped[0].diff}px)`,
          recommendation:
            "Gunakan font sizing yang adaptif, break-words, atau sesuaikan padding agar teks penting tidak terpotong.",
        }
      : undefined,
  };
}

/**
 * Memformat daftar temuan visual menjadi tabel Markdown.
 */
export function formatFindingsTable(findings: VisualFinding[]): string {
  if (findings.length === 0) {
    return "Tidak ada visual finding yang terdeteksi (semua layout structural assertions PASS).";
  }

  const rows = findings.map(
    (f) =>
      `| ${f.severity} | ${f.page} | ${f.viewport} | \`${f.component}\` | ${f.issue} | ${f.measurement} | ${f.recommendation} |`
  );

  return [
    "| Severity | Page | Viewport | Component / Selector | Issue | Measurement | Recommendation |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
