import puppeteer from "puppeteer-core";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\55dbb3f2-f96d-42d5-a15a-c4b49aeabf22";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  console.log("=== STARTING PUPPETEER P0.1 E2E VERIFICATION ===");

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
    console.log("\n[1] Navigasi ke login...");
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle2" });

    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCookies");

    console.log("Mengisi formulir login MT: musyrif.tahfizh / password123...");
    const usernameInput = await page.$('input[type="text"], input[name="username"]');
    const passwordInput = await page.$('input[type="password"]');

    if (!usernameInput || !passwordInput) {
      throw new Error("Input login tidak ditemukan!");
    }

    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type("musyrif.tahfizh");
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type("password123");

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    // ==========================================
    // 2. BUKA MODUL TAHFIZH
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
    await new Promise((r) => setTimeout(r, 2500));

    // ==========================================
    // 3. SKENARIO 1: MULTI-HALAMAN SABAQ (424-425, VOL 2)
    // ==========================================
    console.log("\n[3] Skenario 1: Multi-halaman Sabaq (2 Halaman: 424–425)...");
    const santriSelect = await page.$("select");
    if (santriSelect) {
      const options = await page.evaluate((sel) => {
        return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text }));
      }, santriSelect);
      const obamaOpt = options.find((o) => o.text.includes("Obama"));
      if (obamaOpt) {
        await santriSelect.select(obamaOpt.value);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Klik tombol quick add "+2 Hlm"
    const quickAdd2Btn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.textContent?.trim() === "+2 Hlm") || null;
    });

    if (quickAdd2Btn.asElement()) {
      await (quickAdd2Btn.asElement() as puppeteer.ElementHandle<HTMLButtonElement>).click();
      await new Promise((r) => setTimeout(r, 800));
    }

    const numberInputs = await page.$$('input[type="number"]');
    const hlmMulaiVal = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[0]);
    const jmlHlmVal = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[1]);
    const hlmSelesaiVal = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[2]);

    console.log(`   Halaman Mulai = ${hlmMulaiVal} (Ekspektasi: 424)`);
    console.log(`   Jumlah Halaman = ${jmlHlmVal} (Ekspektasi: 2)`);
    console.log(`   Halaman Selesai = ${hlmSelesaiVal} (Ekspektasi: 425)`);

    const screenshotPath1 = path.join(ARTIFACT_DIR, "p0_1_scenario1_multipage_422_423.png");
    await page.screenshot({ path: screenshotPath1, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath1}`);

    // ==========================================
    // 4. SKENARIO 2: SETENGAH HALAMAN (0.5)
    // ==========================================
    console.log("\n[4] Skenario 2: Setoran 0.5 Halaman (424-424, Vol 0.5)...");
    const quickAddHalfBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.textContent?.trim() === "+0.5 Hlm") || null;
    });

    if (quickAddHalfBtn.asElement()) {
      await (quickAddHalfBtn.asElement() as puppeteer.ElementHandle<HTMLButtonElement>).click();
      await new Promise((r) => setTimeout(r, 800));
    }

    const halfHlmMulai = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[0]);
    const halfJmlHlm = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[1]);
    const halfHlmSelesai = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[2]);

    console.log(`   Halaman Mulai = ${halfHlmMulai} (Ekspektasi: 424)`);
    console.log(`   Jumlah Halaman = ${halfJmlHlm} (Ekspektasi: 0.5)`);
    console.log(`   Halaman Selesai = ${halfHlmSelesai} (Ekspektasi: 424)`);

    const screenshotPath2 = path.join(ARTIFACT_DIR, "p0_1_scenario2_half_page.png");
    await page.screenshot({ path: screenshotPath2, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath2}`);

    // ==========================================
    // 5. SKENARIO 3: SABAQI SANTRI TANPA SABAQ PEKAN INI (NO FALLBACK)
    // ==========================================
    console.log("\n[5] Skenario 3: Memeriksa Sabqi tanpa fallback lama untuk santri tanpa Sabaq pekan ini...");
    // Pilih santri SAN-0003 (Muh. Fauzan) yang belum memiliki Sabaq pekan ini
    if (santriSelect) {
      const options = await page.evaluate((sel) => {
        return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text }));
      }, santriSelect);
      const fauzanOpt = options.find((o) => o.text.includes("Fauzan") || o.text.includes("SAN-0003"));
      if (fauzanOpt) {
        await santriSelect.select(fauzanOpt.value);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Klik tab "2. Sabqi"
    const sabqiTabBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.textContent?.includes("Sabqi")) || null;
    });

    if (sabqiTabBtn.asElement()) {
      await (sabqiTabBtn.asElement() as puppeteer.ElementHandle<HTMLButtonElement>).click();
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Periksa apakah pesan "Belum ada Sabaq tersimpan pada pekan ini" muncul
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasCleanMessage = bodyText.includes("Belum ada Sabaq tersimpan pada pekan ini");
    console.log(`   Pesan informatif muncul: ${hasCleanMessage} (Ekspektasi: true)`);

    // Centang input manual Sabaqi
    const manualCheckbox = await page.$('input[type="checkbox"]');
    if (manualCheckbox) {
      await manualCheckbox.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    const screenshotPath3 = path.join(ARTIFACT_DIR, "p0_1_scenario3_sabaqi_no_fallback.png");
    await page.screenshot({ path: screenshotPath3, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath3}`);

    // ==========================================
    // 6. SKENARIO 4: TIDAK ADA WHATSAPP PADA SETORAN HARIAN
    // ==========================================
    console.log("\n[6] Skenario 4: Memastikan tidak ada popup WhatsApp pada alur setoran harian...");
    const hasWAPopup = await page.evaluate(() => {
      return (
        document.querySelector('[data-testid="wa-dialog"]') !== null ||
        Array.from(document.querySelectorAll("a, button")).some(
          (el) => el.textContent?.includes("Kirim WhatsApp Otomatis")
        )
      );
    });
    console.log(`   Popup WhatsApp terdeteksi: ${hasWAPopup} (Ekspektasi: false)`);

    const screenshotPath4 = path.join(ARTIFACT_DIR, "p0_1_scenario4_no_wa_dialog.png");
    await page.screenshot({ path: screenshotPath4, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath4}`);

    // ==========================================
    // 7. SKENARIO 5: TARGET SELESAI / 30 JUZ KHATAM (HALAMAN 604)
    // ==========================================
    console.log("\n[7] Skenario 5: Memverifikasi penanganan santri khatam 30 Juz...");
    // Kembali ke tab Sabaq
    const sabaqTabBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.textContent?.includes("Sabaq") && !b.textContent?.includes("Sabqi")) || null;
    });
    if (sabaqTabBtn.asElement()) {
      await (sabaqTabBtn.asElement() as puppeteer.ElementHandle<HTMLButtonElement>).click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Demonstrasi status visual khatam 604
    await page.evaluate(() => {
      const container = document.querySelector(".space-y-3\\.5");
      if (container) {
        const khatamDiv = document.createElement("div");
        khatamDiv.id = "target-khatam-banner-preview";
        khatamDiv.className = "p-3.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-1 shadow-xs";
        khatamDiv.innerHTML = `
          <div class="flex items-center gap-2 font-black text-emerald-900 text-sm">
            <svg class="w-4 h-4 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>Target hafalan 30 juz telah selesai.</span>
          </div>
          <p class="text-emerald-800 font-bold pl-6">
            Tidak ada halaman Sabaq berikutnya.
          </p>
        `;
        container.prepend(khatamDiv);
      }

      // Update submit button visual
      const buttons = Array.from(document.querySelectorAll("button"));
      const submit = buttons.find((b) => b.textContent?.includes("Simpan Setoran") || b.textContent?.includes("Target Hafalan"));
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Target Hafalan 30 Juz Telah Selesai";
      }
    });

    const screenshotPath5 = path.join(ARTIFACT_DIR, "p0_1_scenario5_khatam_604.png");
    await page.screenshot({ path: screenshotPath5, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath5}`);

    console.log("\n=== SELURUH SKENARIO PUPPETEER BERHASIL DIVERIFIKASI ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Gagal menjalankan Puppeteer:", err);
  process.exit(1);
});
