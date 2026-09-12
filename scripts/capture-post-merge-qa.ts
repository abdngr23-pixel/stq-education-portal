// Script Penangkapan Bukti Visual QA Lintas Platform (Multi-Viewport + Stress Test Rapor)
import { runVisualQAChecks } from "./qa-runner-core";

async function main() {
  const result = await runVisualQAChecks({
    captureScreenshots: true,
    failOnStructuralError: false, // Mencatat temuan visual dan menyimpan bukti screenshot lengkap
  });

  console.log(`\n📸 Penangkapan screenshot QA selesai: ${result.screenshotsCaptured.length} file berhasil disimpan.`);
  if (result.findings.length > 0) {
    console.log(`ℹ️ Ditemukan ${result.findings.length} visual findings yang dicatat untuk review.`);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR pada capture-post-merge-qa:", err);
  process.exit(1);
});
