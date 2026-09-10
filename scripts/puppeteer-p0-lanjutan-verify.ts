import { runIsolatedE2EVerification } from "./puppeteer-p0-1-verify";

if (require.main === module) {
  runIsolatedE2EVerification().catch(() => {
    process.exit(1);
  });
}
