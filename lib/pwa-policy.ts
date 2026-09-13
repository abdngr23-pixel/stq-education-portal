/**
 * Kebijakan Keamanan PWA STQ Education Portal
 * Prinsip: Online-First / Allowlist-Only Caching
 * Menjamin perlindungan data santri, Tahfizh, Akademik, dan privasi user.
 */

export const PWA_CACHE_NAME = 'stq-duc-pwa-v1';

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
 * Mengidentifikasi nama-nama cache kadaluarsa yang harus dihapus saat aktivasi Service Worker baru.
 */
export function getOutdatedCacheNames(currentCaches: string[], activeCacheName: string): string[] {
  return currentCaches.filter((name) => name !== activeCacheName);
}
