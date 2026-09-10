import puppeteer from "puppeteer-core";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\55dbb3f2-f96d-42d5-a15a-c4b49aeabf22";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  console.log("=== STARTING COMPLETE PUPPETEER P0 E2E VERIFICATION ===");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1366, height: 900 },
  });

  try {
    const page = await browser.newPage();

    // ==========================================
    // 1. LOGIN SEBAGAI MUSYRIF TAHFIZH (MT)
    // ==========================================
    console.log("\n[1] Navigasi ke halaman login...");
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle2" });

    // Hapus cookies jika ada sesi lama
    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCookies");

    console.log("Mengisi formulir login MT: musyrif.tahfizh / password123...");
    const usernameInput = await page.$('input[type="text"], input[name="username"]');
    const passwordInput = await page.$('input[type="password"]');

    if (!usernameInput || !passwordInput) {
      throw new Error("Input username atau password tidak ditemukan!");
    }

    await usernameInput.click({ count: 3 });
    await usernameInput.type("musyrif.tahfizh");
    await passwordInput.click({ count: 3 });
    await passwordInput.type("password123");

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();

    console.log("Menunggu navigasi ke Beranda Dashboard...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    // ==========================================
    // 2. VERIFIKASI MODUL TAHFIZH & 5 METRIK OBAMA
    // ==========================================
    console.log("\n[2] Membuka modul Tahfizh...");
    const allButtons = await page.$$("button, a");
    for (const btn of allButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes("Tahfizh") && !text.includes("Musyrif")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    const tahfizhScreenshot = path.join(ARTIFACT_DIR, "p0_verified_tahfizh_cards.png");
    await page.screenshot({ path: tahfizhScreenshot, fullPage: false });
    console.log(`📸 Screenshot 5 Metrik Tahfizh disimpan: ${tahfizhScreenshot}`);

    // ==========================================
    // 3. UJI LOMPATAN HALAMAN (582) & MODAL PERINGATAN
    // ==========================================
    console.log("\n[3] Menguji sequence jump warning (halaman 582)...");
    const numberInputs = await page.$$('input[type="number"]');
    if (numberInputs.length >= 2) {
      await numberInputs[0].click({ count: 3 });
      await numberInputs[0].type("582");
      await numberInputs[1].click({ count: 3 });
      await numberInputs[1].type("582");
    }

    // Klik tombol Simpan Setoran
    const saveBtns = await page.$$("button");
    for (const b of saveBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Simpan Setoran")) {
        await b.click();
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
    const jumpModalScreenshot = path.join(ARTIFACT_DIR, "p0_verified_jump_modal.png");
    await page.screenshot({ path: jumpModalScreenshot, fullPage: false });
    console.log(`📸 Screenshot Dialog Peringatan Lompatan disimpan: ${jumpModalScreenshot}`);

    // Klik tombol 'Kembali periksa' untuk menutup modal
    const modalBtns = await page.$$("button");
    for (const b of modalBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Kembali periksa")) {
        await b.click();
        console.log("Menutup modal peringatan lompatan...");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));

    // ==========================================
    // 4. VERIFIKASI TAB IKHTIBAR
    // ==========================================
    console.log("\n[4] Memeriksa tab Ujian Ikhtibar di modul Tahfizh...");
    const tabBtns = await page.$$("button");
    for (const b of tabBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Ujian Ikhtibar")) {
        await b.click();
        console.log("Tab Ujian Ikhtibar diklik...");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));

    const ikhtibarScreenshot = path.join(ARTIFACT_DIR, "p0_verified_ikhtibar.png");
    await page.screenshot({ path: ikhtibarScreenshot, fullPage: false });
    console.log(`📸 Screenshot Tab Ikhtibar disimpan: ${ikhtibarScreenshot}`);

    // ==========================================
    // 5. LOGOUT DAN LOGIN SEBAGAI ADMIN / KS
    // ==========================================
    console.log("\n[5] Logout dan login sebagai Administrator...");
    await client.send("Network.clearBrowserCookies");
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle2" });

    const uInput = await page.$('input[type="text"], input[name="username"]');
    const pInput = await page.$('input[type="password"]');
    if (uInput && pInput) {
      await uInput.click({ count: 3 });
      await uInput.type("admin");
      await pInput.click({ count: 3 });
      await pInput.type("password123");
      const sBtn = await page.$('button[type="submit"]');
      if (sBtn) await sBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Navigasi ke Data Santri
    console.log("Navigasi ke Master Data Santri (Akun Admin)...");
    const adminNavs = await page.$$("button, a");
    for (const b of adminNavs) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && (text.includes("Data Santri") || text.includes("Master Data Santri"))) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Ambil screenshot Master Data Santri (Menunjukkan kolom Modal, Sabaq, Total)
    const santriTableScreenshot = path.join(ARTIFACT_DIR, "p0_verified_santri_table.png");
    await page.screenshot({ path: santriTableScreenshot, fullPage: false });
    console.log(`📸 Screenshot Master Data Santri disimpan: ${santriTableScreenshot}`);

    // Buka Modal Atur Baseline Modal
    console.log("Membuka Modal Atur Baseline Modal...");
    const baselineBtns = await page.$$("button");
    for (const b of baselineBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Atur Baseline Modal")) {
        await b.click();
        console.log("Tombol Atur Baseline Modal diklik...");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1200));

    const baselineModalScreenshot = path.join(ARTIFACT_DIR, "p0_verified_baseline_modal.png");
    await page.screenshot({ path: baselineModalScreenshot, fullPage: false });
    console.log(`📸 Screenshot Modal Baseline disimpan: ${baselineModalScreenshot}`);

    console.log("\n=================================================");
    console.log("  SEMUA TAHAP VERIFIKASI VISUAL PUPPETEER SELESAI!");
    console.log("=================================================");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Puppeteer verification error:", err);
  process.exit(1);
});
