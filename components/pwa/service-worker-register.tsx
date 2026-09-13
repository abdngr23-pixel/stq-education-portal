"use client";

import { useEffect } from "react";
import { cleanupStaleStqServiceWorkers } from "@/lib/pwa-policy";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Pastikan berjalan di lingkungan browser dengan dukungan Service Worker
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Guard isolasi test/dev environment:
    // Service Worker hanya didaftarkan pada production build untuk mencegah polusi cache
    // pada mode pengembangan atau automated test terisolasi (misal P0.1 test-db).
    const isProduction = process.env.NODE_ENV === "production";
    const isExplicitOptIn = process.env.NEXT_PUBLIC_ENABLE_SW === "true";
    const isExplicitDisabled = process.env.NEXT_PUBLIC_DISABLE_SW === "true";

    const shouldRegister = (isProduction || isExplicitOptIn) && !isExplicitDisabled;

    if (!shouldRegister) {
      // Best-effort cleanup: Copot registrasi Service Worker lama milik STQ (/sw.js)
      // dan hapus cache storage STQ (prefix stq-duc-pwa-) agar localhost dev/test tetap bersih.
      // Jangan pernah menyentuh Service Worker atau cache aplikasi/layanan lain.
      cleanupStaleStqServiceWorkers(
        navigator.serviceWorker,
        typeof caches !== "undefined" ? caches : undefined
      ).catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Lifecycle update tracking deterministik
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[PWA] Versi baru aplikasi STQ tersedia.");
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("[PWA] Registrasi Service Worker dibatalkan / gagal:", error);
      });
  }, []);

  return null;
}
