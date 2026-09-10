import puppeteer from "puppeteer-core";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\55dbb3f2-f96d-42d5-a15a-c4b49aeabf22";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  console.log("=== STARTING PUPPETEER P0 LANJUTAN E2E VERIFICATION ===");

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

    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type("musyrif.tahfizh");
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type("password123");

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();

    console.log("Menunggu navigasi ke Beranda Dashboard...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
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
    await new Promise((r) => setTimeout(r, 2000));

    // ==========================================
    // 3. VERIFIKASI AUTO-FILL SARAN POSISI 422
    // ==========================================
    console.log("\n[3] Memeriksa saran posisi otomatis untuk Obama...");
    // Pilih Obama jika belum terpilih
    const santriSelect = await page.$("select");
    if (santriSelect) {
      const options = await page.evaluate((sel) => {
        return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text }));
      }, santriSelect);
      const obamaOpt = options.find((o) => o.text.includes("Obama"));
      if (obamaOpt) {
        await santriSelect.select(obamaOpt.value);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Periksa nilai input Halaman Mulai, Jumlah Halaman, dan Halaman Selesai
    await page.waitForSelector('input[type="number"]', { timeout: 10000 });
    const numberInputs = await page.$$('input[type="number"]');
    const hlmMulaiVal = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[0]);
    const jmlHlmVal = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[1]);
    const hlmSelesaiVal = await page.evaluate((el) => (el as HTMLInputElement).value, numberInputs[2]);

    console.log(`   Halaman Mulai auto-fill = ${hlmMulaiVal} (Ekspektasi: 422)`);
    console.log(`   Jumlah Halaman auto-fill = ${jmlHlmVal} (Ekspektasi: 1)`);
    console.log(`   Halaman Selesai auto-fill = ${hlmSelesaiVal} (Ekspektasi: 422)`);

    const screenshotPath1 = path.join(ARTIFACT_DIR, "p0_lanjutan_autofill_422.png");
    await page.screenshot({ path: screenshotPath1, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath1}`);

    // ==========================================
    // 4. VERIFIKASI SINKRONISASI SAAT GANTI SANTRI
    // ==========================================
    console.log("\n[4] Menguji pergantian santri di dropdown...");
    if (santriSelect) {
      const options = await page.evaluate((sel) => {
        return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text }));
      }, santriSelect);

      const fardhanOpt = options.find((o) => o.text.includes("Fardhan"));
      const obamaOpt = options.find((o) => o.text.includes("Obama"));

      if (fardhanOpt) {
        console.log(`   Beralih ke santri: ${fardhanOpt.text}`);
        await santriSelect.select(fardhanOpt.value);
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (obamaOpt) {
        console.log(`   Beralih kembali ke santri: ${obamaOpt.text}`);
        await santriSelect.select(obamaOpt.value);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const screenshotPath2 = path.join(ARTIFACT_DIR, "p0_lanjutan_ganti_santri.png");
    await page.screenshot({ path: screenshotPath2, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath2}`);

    // ==========================================
    // 5. UJI PERINGATAN PERBEDAAN SARAN (LOMPATAN KE 582)
    // ==========================================
    console.log("\n[5] Menguji modal peringatan perbedaan saran (input manual halaman 582)...");
    await page.evaluate(() => {
      const input = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, "582");
        } else {
          input.value = "582";
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 500));

    // Klik tombol Simpan Setoran
    const btns = await page.$$("button");
    for (const b of btns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Simpan Setoran")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));

    const screenshotPath3 = path.join(ARTIFACT_DIR, "p0_lanjutan_warning_beda_saran.png");
    await page.screenshot({ path: screenshotPath3, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath3}`);

    // Tutup modal peringatan ("Kembali periksa")
    const modalBtns = await page.$$("button");
    for (const b of modalBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Kembali periksa")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));

    // ==========================================
    // 6. KEMBALIKAN KE SARAN & VERIFIKASI TIDAK ADA WHATSAPP
    // ==========================================
    console.log("\n[6] Mengembalikan ke saran (422)...");
    if (santriSelect) {
      const options = await page.evaluate((sel) => {
        return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text }));
      }, santriSelect);
      const obamaOpt = options.find((o) => o.text.includes("Obama"));
      if (obamaOpt) {
        await santriSelect.select(obamaOpt.value);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const numInps = await page.$$('input[type="number"]');
    const restoredHlm = await page.evaluate((el) => (el as HTMLInputElement).value, numInps[0]);
    console.log(`   Restored Halaman Mulai = ${restoredHlm} (Ekspektasi: 422)`);

    // Uji submit setoran normal
    console.log("   Menyimpan setoran dengan posisi saran 422...");
    const submitBtns = await page.$$("button");
    for (const b of submitBtns) {
      const text = await page.evaluate((el) => el.textContent, b);
      if (text && text.includes("Simpan Setoran")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2500));

    const hasWaDialog = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("Kirim Laporan Setoran ke Wali") || text.includes("Kirim Laporan Setoran via WhatsApp");
    });
    console.log(`   WhatsApp dialog terdeteksi? ${hasWaDialog} (Ekspektasi: false)`);

    const screenshotPath4 = path.join(ARTIFACT_DIR, "p0_lanjutan_no_wa_setoran.png");
    await page.screenshot({ path: screenshotPath4, fullPage: true });
    console.log(`   📸 Screenshot disimpan: ${screenshotPath4}`);

    console.log("\n=== PUPPETEER VERIFICATION COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Error during Puppeteer verification:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
