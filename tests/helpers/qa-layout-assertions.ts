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
 * Opsi konfigurasi umum untuk assertion layout dengan semantik required / optional.
 */
export interface LayoutAssertionOptions {
  required?: boolean; // default true
}

export type StickyCollisionOptions = LayoutAssertionOptions;
export type ContentObscuredOptions = LayoutAssertionOptions;
export type MobileBottomNavOptions = LayoutAssertionOptions;
export interface HeaderOffsetOptions extends LayoutAssertionOptions {
  expectedSticky?: boolean; // default true
}

export interface TouchTargetItem {
  selector: string;
  label: string;
  required?: boolean; // default true
}

export interface CriticalTextItem {
  selector: string;
  label: string;
  required?: boolean; // default true
}

/**
 * Pure helper untuk evaluasi logika collision sticky bar vs bottom nav.
 */
export function evaluateStickyCollision(params: {
  status: "STICKY_NOT_FOUND" | "NAV_NOT_FOUND" | "NOT_BOTH_VISIBLE" | "CHECKED";
  stickySelector: string;
  navSelector: string;
  overlap?: boolean;
  overlapHeight?: number;
  stickyRect?: DOMRectLike;
  navRect?: DOMRectLike;
  isStickyVisible?: boolean;
  isNavVisible?: boolean;
  required?: boolean;
}): { passed: boolean; details: string; issue?: string } {
  const isRequired = params.required !== false;

  if (params.status === "STICKY_NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        details: `required element [${params.stickySelector}] was not found`,
        issue: `Required sticky bar "${params.stickySelector}" tidak ditemukan di DOM`,
      };
    }
    return {
      passed: true,
      details: `Optional sticky element [${params.stickySelector}] tidak ditemukan. Pemeriksaan dilewati.`,
    };
  }

  if (params.status === "NAV_NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        details: `required element [${params.navSelector}] was not found`,
        issue: `Required navigation "${params.navSelector}" tidak ditemukan di DOM`,
      };
    }
    return {
      passed: true,
      details: `Optional nav element [${params.navSelector}] tidak ditemukan. Pemeriksaan dilewati.`,
    };
  }

  if (params.status === "NOT_BOTH_VISIBLE") {
    if (isRequired) {
      const missingVisibility = !params.isStickyVisible
        ? `required element [${params.stickySelector}] is hidden or has 0 dimension`
        : `required element [${params.navSelector}] is hidden or has 0 dimension`;
      return {
        passed: false,
        details: missingVisibility,
        issue: `Elemen wajib tidak terlihat di layar: ${missingVisibility}`,
      };
    }
    return {
      passed: true,
      details: `Elemen opsional tidak aktif bersamaan di viewport ini. Tidak ada overlap.`,
    };
  }

  const overlap = !!params.overlap;
  const overlapHeight = params.overlapHeight ?? 0;
  if (overlap) {
    return {
      passed: false,
      details: `Sticky bar dan Bottom Nav bertabrakan / overlap sebesar ${overlapHeight}px! (sticky.bottom: ${params.stickyRect?.bottom}px > nav.top: ${params.navRect?.top}px)`,
      issue: `Sticky action bar overlaps bottom navigation by ${overlapHeight}px`,
    };
  }

  return {
    passed: true,
    details: `Sticky bar (bottom: ${params.stickyRect?.bottom}px) dan Bottom Nav (top: ${params.navRect?.top}px) tidak overlap.`,
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
  navSelector: string,
  options?: StickyCollisionOptions
): Promise<AssertionResult> {
  const isRequired = options?.required !== false;

  const result = await page.evaluate(
    (stickySel, navSel) => {
      const stickyEl = document.querySelector(stickySel);
      const navEl = document.querySelector(navSel);

      if (!stickyEl) return { status: "STICKY_NOT_FOUND" as const };
      if (!navEl) return { status: "NAV_NOT_FOUND" as const };

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
          status: "NOT_BOTH_VISIBLE" as const,
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
        status: "CHECKED" as const,
        overlap,
        overlapHeight,
        isStickyVisible,
        isNavVisible,
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

  const evaluation = evaluateStickyCollision({
    status: result.status,
    stickySelector,
    navSelector,
    overlap: "overlap" in result ? result.overlap : false,
    overlapHeight: "overlapHeight" in result ? result.overlapHeight : 0,
    stickyRect: "stickyRect" in result ? result.stickyRect : undefined,
    navRect: "navRect" in result ? result.navRect : undefined,
    isStickyVisible: "isStickyVisible" in result ? result.isStickyVisible : false,
    isNavVisible: "isNavVisible" in result ? result.isNavVisible : false,
    required: isRequired,
  });

  return {
    passed: evaluation.passed,
    category: "Sticky vs Bottom Nav Collision",
    page: pageName,
    viewport,
    details: evaluation.details,
    finding: !evaluation.passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: stickySelector,
          issue: evaluation.issue || evaluation.details,
          measurement:
            "overlapHeight" in result
              ? `overlapHeight=${result.overlapHeight}px (stickyBottom=${result.stickyRect?.bottom}px, navTop=${result.navRect?.top}px)`
              : evaluation.details,
          recommendation:
            "Pastikan elemen wajib ada dan tambahkan offset atau safe bottom spacing pada sticky action bar agar tetap berada di atas bottom nav.",
        }
      : undefined,
  };
}

/**
 * Pure helper untuk evaluasi keterjangkauan baris/konten terakhir di atas sticky area.
 */
export function evaluateContentNotObscured(params: {
  status: "TARGET_NOT_FOUND" | "CHECKED";
  targetSelector: string;
  isObscured?: boolean;
  coveredPixels?: number;
  targetBottom?: number;
  highestStickyTop?: number;
  required?: boolean;
}): { passed: boolean; details: string; issue?: string } {
  const isRequired = params.required !== false;

  if (params.status === "TARGET_NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        details: `required target element [${params.targetSelector}] was not found`,
        issue: `Required target element "${params.targetSelector}" tidak ditemukan di DOM`,
      };
    }
    return {
      passed: true,
      details: `Optional target selector ${params.targetSelector} tidak ditemukan pada halaman ini.`,
    };
  }

  if (params.isObscured) {
    const covered = params.coveredPixels ?? 0;
    return {
      passed: false,
      details: `Konten terakhir tertutup oleh sticky area sebesar ${covered}px (target bottom ${params.targetBottom}px > sticky top ${params.highestStickyTop}px).`,
      issue: `Konten terakhir tertutup oleh sticky area sebesar ${covered}px saat scroll di bawah`,
    };
  }

  return {
    passed: true,
    details: `Konten terakhir terlihat penuh: target bottom (${params.targetBottom}px) berada di atas sticky area (${params.highestStickyTop}px).`,
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
  stickySelectors: string[],
  options?: ContentObscuredOptions
): Promise<AssertionResult> {
  const isRequired = options?.required !== false;

  const result = await page.evaluate(
    (targetSel, stickySels) => {
      const targetEl = document.querySelector(targetSel);
      if (!targetEl) return { status: "TARGET_NOT_FOUND" as const };

      targetEl.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });

      const targetRect = targetEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

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
        status: "CHECKED" as const,
        isObscured,
        coveredPixels,
        targetBottom: Math.round(targetRect.bottom),
        highestStickyTop: Math.round(highestStickyTop),
        visibleStickies,
      };
    },
    targetSelector,
    stickySelectors
  );

  const evaluation = evaluateContentNotObscured({
    status: result.status,
    targetSelector,
    isObscured: "isObscured" in result ? result.isObscured : false,
    coveredPixels: "coveredPixels" in result ? result.coveredPixels : 0,
    targetBottom: "targetBottom" in result ? result.targetBottom : 0,
    highestStickyTop: "highestStickyTop" in result ? result.highestStickyTop : 0,
    required: isRequired,
  });

  return {
    passed: evaluation.passed,
    category: "Content Visibility Above Sticky",
    page: pageName,
    viewport,
    details: evaluation.details,
    finding: !evaluation.passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: targetSelector,
          issue: evaluation.issue || evaluation.details,
          measurement:
            "targetBottom" in result
              ? `targetBottom=${result.targetBottom}px, highestStickyTop=${result.highestStickyTop}px`
              : evaluation.details,
          recommendation:
            "Pastikan elemen target ada dan tingkatkan padding-bottom pada container daftar (misal pb-36) agar item terakhir dapat diakses penuh.",
        }
      : undefined,
  };
}

/**
 * Pure helper untuk evaluasi touch target item secara individual.
 */
export function evaluateTouchTargetItem(item: {
  selector: string;
  label: string;
  status: "NOT_FOUND" | "HIDDEN" | "MEASURED";
  width: number;
  height: number;
  minDim: number;
  required?: boolean;
}): { passed: boolean; failureType?: "missing" | "hidden" | "failed-size"; reason?: string } {
  const isRequired = item.required !== false;

  if (item.status === "NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        failureType: "missing",
        reason: `required touch target "${item.label}" (${item.selector}) was not found`,
      };
    }
    return { passed: true };
  }

  if (item.status === "HIDDEN") {
    if (isRequired) {
      return {
        passed: false,
        failureType: "hidden",
        reason: `required touch target "${item.label}" (${item.selector}) is hidden or 0-sized`,
      };
    }
    return { passed: true };
  }

  // Toleransi subpixel 1px
  const sizeOk = item.width >= item.minDim - 1 && item.height >= item.minDim - 1;
  if (!sizeOk) {
    return {
      passed: false,
      failureType: "failed-size",
      reason: `touch target "${item.label}" (${item.selector}) berukuran ${item.width}x${item.height}px (< ${item.minDim}x${item.minDim}px)`,
    };
  }

  return { passed: true };
}

/**
 * 4. Assertion: Touch target minimum 44 x 44 px untuk primary clickable controls.
 */
export async function assertTouchTargets(
  page: Page,
  pageName: string,
  viewport: string,
  targets: TouchTargetItem[],
  minDimension = 44
): Promise<AssertionResult> {
  const measurements = await page.evaluate(
    (targetList) => {
      return targetList.map((t) => {
        const el = document.querySelector(t.selector);
        if (!el) {
          return { ...t, status: "NOT_FOUND" as const, width: 0, height: 0 };
        }

        let clickableEl: Element = el;
        if (el.tagName.toLowerCase() === "svg" || el.tagName.toLowerCase() === "path") {
          const parentBtn = el.closest("button, a, [role='button']");
          if (parentBtn) clickableEl = parentBtn;
        }

        const rect = clickableEl.getBoundingClientRect();
        const style = window.getComputedStyle(clickableEl);
        if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
          return { ...t, status: "HIDDEN" as const, width: 0, height: 0 };
        }

        return {
          ...t,
          status: "MEASURED" as const,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
    },
    targets
  );

  let measuredCount = 0;
  let missingCount = 0;
  let hiddenCount = 0;
  let failedSizeCount = 0;
  const failureReasons: string[] = [];
  const failedSelectors: string[] = [];

  for (const m of measurements) {
    if (m.status === "MEASURED") measuredCount++;

    const evaluation = evaluateTouchTargetItem({
      selector: m.selector,
      label: m.label,
      status: m.status,
      width: m.width,
      height: m.height,
      minDim: minDimension,
      required: m.required,
    });

    if (!evaluation.passed) {
      if (evaluation.failureType === "missing") missingCount++;
      else if (evaluation.failureType === "hidden") hiddenCount++;
      else if (evaluation.failureType === "failed-size") failedSizeCount++;

      if (evaluation.reason) failureReasons.push(evaluation.reason);
      failedSelectors.push(m.selector);
    }
  }

  const passed = failureReasons.length === 0;
  const summary = `measured: ${measuredCount}, missing: ${missingCount}, hidden: ${hiddenCount}, failed-size: ${failedSizeCount}`;
  const details = passed
    ? `Seluruh target sentuh yang dievaluasi memenuhi kriteria (${summary}, standar: ${minDimension}x${minDimension}px).`
    : `Touch target check FAILED (${summary}). Alasan: ${failureReasons.join("; ")}`;

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
          component: failedSelectors[0] || "interactive-controls",
          issue: `Kontrol sentuh tidak memenuhi standar ukuran atau tidak ditemukan (${summary})`,
          measurement: failureReasons[0] || summary,
          recommendation:
            `Pastikan tombol wajib ada, terlihat, dan memiliki ukuran sentuh minimal ${minDimension}x${minDimension}px.`,
        }
      : undefined,
  };
}

/**
 * Pure helper untuk evaluasi status dan integritas Mobile Bottom Navigation.
 */
export function evaluateMobileBottomNav(params: {
  status: "NOT_VISIBLE" | "VISIBLE";
  count: number;
  isDuplicate?: boolean;
  isOverflowing?: boolean;
  clickableCount?: number;
  rect?: DOMRectLike;
  windowWidth?: number;
  navSelector?: string;
  required?: boolean;
}): { passed: boolean; details: string; issue?: string } {
  const isRequired = params.required !== false;

  if (params.status === "NOT_VISIBLE" || params.count === 0) {
    if (isRequired) {
      return {
        passed: false,
        details: `[FAIL] Required mobile bottom nav "${params.navSelector || "nav"}" was not visible (visible instances = 0)`,
        issue: "Mobile bottom navigation tidak ditemukan atau tersembunyi pada viewport mobile",
      };
    }
    return {
      passed: true,
      details: "Optional mobile bottom nav tidak aktif di tampilan ini.",
    };
  }

  if (params.count > 1 || params.isDuplicate) {
    return {
      passed: false,
      details: `[FAIL] Terdeteksi ${params.count} instance bottom nav bersamaan!`,
      issue: `Terdeteksi duplicate (${params.count}) bottom nav instances`,
    };
  }

  if (params.isOverflowing) {
    return {
      passed: false,
      details: `[FAIL] Bottom nav overflow di luar layar (right=${params.rect?.right}px > winWidth=${params.windowWidth}px)`,
      issue: "Mobile bottom navigation mengalami overflow horizontal",
    };
  }

  const clickable = params.clickableCount ?? 0;
  if (clickable < 4) {
    return {
      passed: false,
      details: `[FAIL] Hanya ${clickable} tombol navigasi yang aktif/terlihat (minimum 4).`,
      issue: `Required controls hilang: hanya ${clickable} tombol navigasi aktif`,
    };
  }

  return {
    passed: true,
    details: `Satu instance bottom nav aktif (${clickable} tombol, lebar ${params.rect?.width}px aman).`,
  };
}

/**
 * 5. Assertion: Single Mobile Bottom Navigation instance, non-overflowing & clickable.
 */
export async function assertMobileBottomNav(
  page: Page,
  pageName: string,
  viewport: string,
  navSelector = 'nav[data-testid="mobile-bottom-nav"]',
  options?: MobileBottomNavOptions
): Promise<AssertionResult> {
  const isRequired = options?.required !== false;

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
      return { status: "NOT_VISIBLE" as const, count: 0 };
    }

    const nav = visibleNavs[0];
    const rect = nav.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    const isDuplicate = visibleNavs.length > 1;
    const isOverflowing = rect.left < -1 || rect.right > windowWidth + 1;
    const buttons = Array.from(nav.querySelectorAll("button, a"));
    const clickableCount = buttons.filter((b) => {
      const bRect = b.getBoundingClientRect();
      const bStyle = window.getComputedStyle(b);
      return (
        bRect.width > 0 &&
        bRect.height > 0 &&
        bStyle.display !== "none" &&
        bStyle.visibility !== "hidden"
      );
    }).length;

    return {
      status: "VISIBLE" as const,
      count: visibleNavs.length,
      isDuplicate,
      isOverflowing,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
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

  const evaluation = evaluateMobileBottomNav({
    status: result.status,
    count: result.count,
    isDuplicate: "isDuplicate" in result ? result.isDuplicate : false,
    isOverflowing: "isOverflowing" in result ? result.isOverflowing : false,
    clickableCount: "clickableCount" in result ? result.clickableCount : 0,
    rect: "rect" in result ? result.rect : undefined,
    windowWidth: "windowWidth" in result ? result.windowWidth : undefined,
    navSelector,
    required: isRequired,
  });

  return {
    passed: evaluation.passed,
    category: "Mobile Bottom Nav",
    page: pageName,
    viewport,
    details: evaluation.details,
    finding: !evaluation.passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: navSelector,
          issue: evaluation.issue || evaluation.details,
          measurement:
            "rect" in result
              ? `instances=${result.count}, clickable=${result.clickableCount}, width=${result.rect?.width}px`
              : evaluation.details,
          recommendation:
            "Pastikan bottom navigation hanya dirender satu kali dan memiliki lebar w-full dengan inset-x-0.",
        }
      : undefined,
  };
}

/**
 * Pure helper untuk evaluasi header offset / scroll padding.
 */
export function evaluateHeaderOffset(params: {
  status: "HEADER_NOT_FOUND" | "HEADING_NOT_FOUND" | "HEADER_NOT_STICKY" | "CHECKED";
  headingSelector: string;
  stickyHeaderSelector: string;
  isUnderHeader?: boolean;
  overlapPixels?: number;
  headingTop?: number;
  headerBottom?: number;
  required?: boolean;
  expectedSticky?: boolean;
}): { passed: boolean; details: string; issue?: string } {
  const isRequired = params.required !== false;
  const isExpectedSticky = params.expectedSticky !== false;

  if (params.status === "HEADER_NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        details: `[FAIL] Required sticky header "${params.stickyHeaderSelector}" was not found`,
        issue: `Required header "${params.stickyHeaderSelector}" tidak ditemukan`,
      };
    }
    return {
      passed: true,
      details: `Optional header "${params.stickyHeaderSelector}" tidak ditemukan. Pemeriksaan dilewati.`,
    };
  }

  if (params.status === "HEADING_NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        details: `[FAIL] Required heading element "${params.headingSelector}" was not found outside header`,
        issue: `Heading konten "${params.headingSelector}" tidak ditemukan`,
      };
    }
    return {
      passed: true,
      details: `Optional heading "${params.headingSelector}" tidak ditemukan. Pemeriksaan dilewati.`,
    };
  }

  if (params.status === "HEADER_NOT_STICKY") {
    if (isRequired && isExpectedSticky) {
      return {
        passed: false,
        details: `[FAIL] Header "${params.stickyHeaderSelector}" bukan sticky atau fixed`,
        issue: `Posisi header "${params.stickyHeaderSelector}" bukan sticky atau fixed`,
      };
    }
    return {
      passed: true,
      details: `Header tidak berposisi sticky (sesuai konfigurasi). Pemeriksaan offset dilewati.`,
    };
  }

  if (params.isUnderHeader) {
    const overlap = params.overlapPixels ?? 0;
    return {
      passed: false,
      details: `Page heading tertutup sticky header sebesar ${overlap}px (heading top ${params.headingTop}px < header bottom ${params.headerBottom}px).`,
      issue: `Judul halaman tertutup oleh sticky header sebesar ${overlap}px`,
    };
  }

  return {
    passed: true,
    details: `Page heading (top: ${params.headingTop}px) tidak tertutup sticky header (bottom: ${params.headerBottom}px).`,
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
  stickyHeaderSelector = "header",
  options?: HeaderOffsetOptions
): Promise<AssertionResult> {
  const isRequired = options?.required !== false;
  const isExpectedSticky = options?.expectedSticky !== false;

  const result = await page.evaluate(
    (headSel, stickySel) => {
      const header = document.querySelector(stickySel);
      if (!header) return { status: "HEADER_NOT_FOUND" as const };

      const scrollable = document.querySelector(".overflow-y-auto") || document.scrollingElement || document.documentElement;
      if (scrollable) {
        scrollable.scrollTop = 0;
      }
      window.scrollTo(0, 0);

      const allHeadings = Array.from(document.querySelectorAll(headSel));
      const heading = allHeadings.find((h) => {
        if (header.contains(h)) return false;
        const rect = h.getBoundingClientRect();
        const style = window.getComputedStyle(h);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });

      if (!heading) return { status: "HEADING_NOT_FOUND" as const };

      const headRect = heading.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();

      const isHeaderSticky =
        window.getComputedStyle(header).position === "sticky" ||
        window.getComputedStyle(header).position === "fixed";

      if (!isHeaderSticky) {
        return { status: "HEADER_NOT_STICKY" as const };
      }

      const isUnderHeader = headRect.top < headerRect.bottom - 2;
      const overlapPixels = isUnderHeader ? Math.round(headerRect.bottom - headRect.top) : 0;

      return {
        status: "CHECKED" as const,
        isUnderHeader,
        overlapPixels,
        headingTop: Math.round(headRect.top),
        headerBottom: Math.round(headerRect.bottom),
      };
    },
    headingSelector,
    stickyHeaderSelector
  );

  const evaluation = evaluateHeaderOffset({
    status: result.status,
    headingSelector,
    stickyHeaderSelector,
    isUnderHeader: "isUnderHeader" in result ? result.isUnderHeader : false,
    overlapPixels: "overlapPixels" in result ? result.overlapPixels : 0,
    headingTop: "headingTop" in result ? result.headingTop : 0,
    headerBottom: "headerBottom" in result ? result.headerBottom : 0,
    required: isRequired,
    expectedSticky: isExpectedSticky,
  });

  return {
    passed: evaluation.passed,
    category: "Header Offset",
    page: pageName,
    viewport,
    details: evaluation.details,
    finding: !evaluation.passed
      ? {
          severity: "P1",
          page: pageName,
          viewport,
          component: headingSelector,
          issue: evaluation.issue || evaluation.details,
          measurement:
            "overlapPixels" in result
              ? `headingTop=${result.headingTop}px, headerBottom=${result.headerBottom}px (overlap=${result.overlapPixels}px)`
              : evaluation.details,
          recommendation:
            "Pastikan header dan heading wajib ada serta tambahkan padding-top atau scroll-pt pada container konten utama agar elemen judul tidak tenggelam di bawah header.",
        }
      : undefined,
  };
}

/**
 * Pure helper untuk evaluasi teks kritis (clipping / missing / hidden).
 */
export function evaluateCriticalTextItem(item: {
  selector: string;
  label: string;
  status: "NOT_FOUND" | "HIDDEN" | "MEASURED";
  diff: number;
  scrollWidth: number;
  clientWidth: number;
  required?: boolean;
}): { passed: boolean; failureType?: "missing" | "hidden" | "clipped"; reason?: string } {
  const isRequired = item.required !== false;

  if (item.status === "NOT_FOUND") {
    if (isRequired) {
      return {
        passed: false,
        failureType: "missing",
        reason: `required critical text "${item.label}" (${item.selector}) was not found`,
      };
    }
    return { passed: true };
  }

  if (item.status === "HIDDEN") {
    if (isRequired) {
      return {
        passed: false,
        failureType: "hidden",
        reason: `required critical text "${item.label}" (${item.selector}) is hidden or has 0 dimensions`,
      };
    }
    return { passed: true };
  }

  if (item.diff > 1) {
    return {
      passed: false,
      failureType: "clipped",
      reason: `critical text "${item.label}" (${item.selector}) clipped horizontally by ${item.diff}px (scrollWidth=${item.scrollWidth}px > clientWidth=${item.clientWidth}px)`,
    };
  }

  return { passed: true };
}

/**
 * 7. Assertion: Memastikan teks kritis (critical text) seperti heading utama tidak terpotong (clipped) dan wajib ada.
 */
export async function assertCriticalTextClipping(
  page: Page,
  pageName: string,
  viewport: string,
  selectors: CriticalTextItem[]
): Promise<AssertionResult> {
  const results = await page.evaluate((targetSelectors) => {
    return targetSelectors.map((item) => {
      const el = document.querySelector(item.selector);
      if (!el) {
        return {
          ...item,
          status: "NOT_FOUND" as const,
          diff: 0,
          scrollWidth: 0,
          clientWidth: 0,
          text: "",
        };
      }

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") {
        return {
          ...item,
          status: "HIDDEN" as const,
          diff: 0,
          scrollWidth: 0,
          clientWidth: 0,
          text: "",
        };
      }

      const diff = el.scrollWidth - el.clientWidth;

      return {
        ...item,
        status: "MEASURED" as const,
        diff,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        text: (el.textContent || "").trim().slice(0, 30),
      };
    });
  }, selectors);

  const failureReasons: string[] = [];
  const failedSelectors: string[] = [];

  for (const r of results) {
    const evaluation = evaluateCriticalTextItem({
      selector: r.selector,
      label: r.label,
      status: r.status,
      diff: r.diff,
      scrollWidth: r.scrollWidth,
      clientWidth: r.clientWidth,
      required: r.required,
    });

    if (!evaluation.passed) {
      if (evaluation.reason) failureReasons.push(evaluation.reason);
      failedSelectors.push(r.selector);
    }
  }

  const passed = failureReasons.length === 0;
  const details = passed
    ? `Seluruh ${results.filter((r) => r.status === "MEASURED").length} elemen teks kritis terukur dan terbaca tanpa clipping.`
    : `Critical text check FAILED: ${failureReasons.join("; ")}`;

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
          component: failedSelectors[0] || "critical-text",
          issue: `Teks kritis gagal verifikasi layout (${failureReasons[0]})`,
          measurement: failureReasons.join("; "),
          recommendation:
            "Pastikan elemen teks kritis wajib ada dan gunakan font sizing yang adaptif, break-words, atau sesuaikan padding agar teks penting tidak terpotong.",
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
