/**
 * Kebijakan Keamanan PWA STQ Education Portal
 * Prinsip: Online-First / Allowlist-Only Caching
 * Menjamin perlindungan data santri, Tahfizh, Akademik, dan privasi user.
 */

export const PWA_CACHE_PREFIX = 'stq-duc-pwa-';
export const PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}v1`;

export const PWA_PRECACHE_ALLOWLIST = [
  '/offline.html',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/icon-maskable-512.png',
  '/pwa/apple-touch-icon.png',
  '/logo.png',
  '/favicon.ico',
] as const;

export interface RequestCheckParams {
  method: string;
  url: string;
  origin: string;
  headers?: Record<string, string | undefined>;
}

/**
 * Menentukan apakah sebuah request diizinkan untuk disimpan ke Cache Storage.
 * Menerapkan allowlist ketat: HANYA aset statis publik offline shell yang boleh dicache.
 */
export function isRequestCacheable(params: RequestCheckParams): { cacheable: boolean; reason: string } {
  if (params.method.toUpperCase() !== 'GET') {
    return { cacheable: false, reason: 'method_not_get' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(params.url, params.origin);
  } catch {
    return { cacheable: false, reason: 'invalid_url' };
  }

  if (parsedUrl.origin !== params.origin) {
    return { cacheable: false, reason: 'cross_origin' };
  }

  const pathname = parsedUrl.pathname;

  // Dilarang mutlak: API, Auth, data user, dan mutasi
  if (pathname.startsWith('/api/')) {
    return { cacheable: false, reason: 'sensitive_api_endpoint' };
  }
  if (pathname.startsWith('/auth/')) {
    return { cacheable: false, reason: 'sensitive_auth_endpoint' };
  }
  if (parsedUrl.searchParams.has('_rsc')) {
    return { cacheable: false, reason: 'sensitive_rsc_payload' };
  }

  const headers = params.headers || {};
  if (headers['rsc'] || headers['RSC']) {
    return { cacheable: false, reason: 'sensitive_rsc_header' };
  }
  if (headers['next-action'] || headers['Next-Action'] || headers['x-action']) {
    return { cacheable: false, reason: 'server_action_call' };
  }

  // Navigation requests: DILARANG menyimpan respons HTML berautentikasi ke cache
  if (headers['sec-fetch-mode'] === 'navigate' || headers['mode'] === 'navigate') {
    return { cacheable: false, reason: 'navigation_network_only' };
  }

  // Hanya aset dalam allowlist precache publik yang boleh dicache
  if ((PWA_PRECACHE_ALLOWLIST as readonly string[]).includes(pathname)) {
    return { cacheable: true, reason: 'precache_allowlist' };
  }

  return { cacheable: false, reason: 'not_in_allowlist' };
}

/**
 * Menentukan apakah Service Worker boleh didaftarkan di lingkungan tertentu.
 * Menjaga isolasi test/dev agar tidak tercemar cache Service Worker.
 */
export function shouldRegisterServiceWorker(params: {
  isBrowser: boolean;
  hasServiceWorker: boolean;
  nodeEnv: string;
  enableSwFlag?: boolean;
  disableSwFlag?: boolean;
}): boolean {
  if (!params.isBrowser || !params.hasServiceWorker) return false;
  if (params.disableSwFlag) return false;
  if (params.enableSwFlag) return true;
  return params.nodeEnv === 'production';
}

/**
 * Mengidentifikasi nama-nama cache kadaluarsa milik STQ yang harus dihapus saat aktivasi Service Worker baru.
 * HANYA cache dengan prefix STQ yang akan ditandai untuk dihapus.
 * Cache sistem/aplikasi lain TIDAK AKAN PERNAH disentuh.
 */
export function getOutdatedCacheNames(
  currentCaches: string[],
  activeCacheName: string = PWA_CACHE_NAME,
  cachePrefix: string = PWA_CACHE_PREFIX
): string[] {
  return currentCaches.filter(
    (name) => name.startsWith(cachePrefix) && name !== activeCacheName
  );
}

/**
 * Memeriksa apakah registration scriptURL adalah milik Service Worker STQ (/sw.js).
 */
export function isStqServiceWorkerRegistration(scriptURL: string): boolean {
  if (!scriptURL) return false;
  try {
    const url = new URL(scriptURL, 'http://localhost');
    return url.pathname === '/sw.js';
  } catch {
    return scriptURL.endsWith('/sw.js');
  }
}

/**
 * Memeriksa apakah nama cache merupakan milik STQ berdasarkan namespace prefix.
 */
export function isStqCacheName(cacheName: string, prefix: string = PWA_CACHE_PREFIX): boolean {
  return typeof cacheName === 'string' && cacheName.startsWith(prefix);
}

export interface MinimalServiceWorkerRegistration {
  active?: { scriptURL?: string } | null;
  waiting?: { scriptURL?: string } | null;
  installing?: { scriptURL?: string } | null;
  unregister(): Promise<boolean>;
}

export interface MinimalServiceWorkerContainer {
  getRegistrations(): Promise<readonly MinimalServiceWorkerRegistration[]>;
}

export interface MinimalCacheStorage {
  keys(): Promise<string[]>;
  delete(cacheName: string): Promise<boolean>;
}

/**
 * Membersihkan stale STQ Service Worker dan STQ Cache Storage di lingkungan non-production (dev/test).
 * HANYA mencopot unregister /sw.js milik STQ dan menghapus cache ber-prefix stq-duc-pwa-.
 * Bersifat best-effort, aman, dan tidak melempar error ke UI.
 */
export async function cleanupStaleStqServiceWorkers(
  swContainer?: MinimalServiceWorkerContainer,
  cacheStorage?: MinimalCacheStorage
): Promise<{ unregisteredCount: number; deletedCacheCount: number }> {
  let unregisteredCount = 0;
  let deletedCacheCount = 0;

  if (swContainer && typeof swContainer.getRegistrations === 'function') {
    try {
      const registrations = await swContainer.getRegistrations();
      for (const reg of registrations) {
        const scriptURL =
          reg.active?.scriptURL ||
          reg.waiting?.scriptURL ||
          reg.installing?.scriptURL ||
          '';
        if (isStqServiceWorkerRegistration(scriptURL)) {
          const ok = await reg.unregister();
          if (ok) unregisteredCount++;
        }
      }
    } catch (err) {
      console.warn('[PWA] Gagal unregister stale STQ service worker:', err);
    }
  }

  if (cacheStorage && typeof cacheStorage.keys === 'function' && typeof cacheStorage.delete === 'function') {
    try {
      const keys = await cacheStorage.keys();
      for (const key of keys) {
        if (isStqCacheName(key)) {
          const ok = await cacheStorage.delete(key);
          if (ok) deletedCacheCount++;
        }
      }
    } catch (err) {
      console.warn('[PWA] Gagal membersihkan stale STQ cache storage:', err);
    }
  }

  return { unregisteredCount, deletedCacheCount };
}
