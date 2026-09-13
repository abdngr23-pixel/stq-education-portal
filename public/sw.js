// Service Worker STQ Education Portal — STQ Darul Ulum Cendekia
// Policy: STRICT ALLOWLIST-ONLY / ONLINE-FIRST
// Data pendidikan, santri, Tahfizh, Akademik, Presensi, dan API DILARANG dicache ke Cache Storage.

const CACHE_PREFIX = 'stq-duc-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

// Daftar mutlak aset publik aman yang boleh di-precache
const PRECACHE_ALLOWLIST = [
  '/offline.html',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/icon-maskable-512.png',
  '/pwa/apple-touch-icon.png',
  '/logo.png',
  '/favicon.ico',
];

// 1. Install Event: Precache safe public shell assets fail-closed
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ALLOWLIST);
      })
      .catch((err) => {
        console.error('[SW] FATAL: Precache mandatory gagal. Membatalkan instalasi Service Worker:', err);
        throw err; // FAIL-CLOSED: Gagalkan instalasi agar tidak mengaktifkan broken offline shell
      })
  );
});

// 2. Activate Event: Clean up outdated caches owned by STQ and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            // HANYA hapus cache yang ber-prefix STQ dan bukan versi aktif.
            // JANGAN PERNAH menyentuh cache sistem/aplikasi lain.
            if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) {
              console.log('[SW] Menghapus cache versi lama milik STQ:', name);
              return caches.delete(name);
            }
            return Promise.resolve();
          })
        );
      }),
    ])
  );
});

// 3. Fetch Event: Strict allowlist policy
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Hanya proses method GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Hanya proses same-origin
  if (url.origin !== self.location.origin) {
    return;
  }

  // DILARANG CACHE: API, Auth, Server Actions, dan RSC data
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') ||
    request.headers.get('Next-Action') ||
    request.headers.get('x-action')
  ) {
    return;
  }

  // A. Navigation Requests: Network-First / Network-Only dengan Fallback ke offline.html
  // JANGAN simpan respons navigasi/HTML terautentikasi ke cache!
  const isNavigation =
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match('/offline.html');
        if (fallback) {
          return fallback;
        }
        return new Response('Anda sedang offline. Koneksi internet diperlukan.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    return;
  }

  // B. Precache Whitelist: Cache-First untuk aset publik offline shell murni TANPA query string.
  // HANYA cari dan simpan ke active STQ cache (CACHE_NAME), JANGAN gunakan caches.match global!
  if (PRECACHE_ALLOWLIST.includes(url.pathname) && (!url.search || url.search === '')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          cache.put(request, clone);
        }
        return networkResponse;
      })
    );
    return;
  }

  // C. Seluruh request lainnya: Lewatkan langsung ke jaringan (tanpa caching)
});
