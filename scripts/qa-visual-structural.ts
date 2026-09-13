// Script Verifikasi Struktural Layout QA (Cepat & Portable untuk CI)
import { runVisualQAChecks } from "./qa-runner-core";

async function main() {
  const shouldCapture = process.env.QA_CAPTURE_SCREENSHOTS === "true";
  const result = await runVisualQAChecks({
    captureScreenshots: shouldCapture,
    failOnStructuralError: true,
  });

  if (result.failedChecks > 0) {
    console.error(`\n❌ [GAGAL] Terdapat ${result.failedChecks} layout structural assertion yang tidak lolos.`);
    process.exit(1);
  }

  console.log(`\n🎉 Seluruh ${result.totalChecks} structural layout assertions LOLOS (PASS)!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL ERROR pada QA Visual Structural runner:", err);
  process.exit(1);
});
