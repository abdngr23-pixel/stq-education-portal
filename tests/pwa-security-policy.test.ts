import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PWA_CACHE_PREFIX,
  PWA_CACHE_NAME,
  PWA_PRECACHE_ALLOWLIST,
  isRequestCacheable,
  shouldRegisterServiceWorker,
  getOutdatedCacheNames,
  isStqServiceWorkerRegistration,
  isStqCacheName,
  cleanupStaleStqServiceWorkers,
} from '../lib/pwa-policy';
import manifest from '../app/manifest';

describe('PWA Security & Caching Policy Guard', () => {
  const ORIGIN = 'http://localhost:3000';

  it('1. Precache allowlist hanya memuat aset publik aman', () => {
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/offline.html'));
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/pwa/icon-192.png'));
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/pwa/icon-512.png'));
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/pwa/icon-maskable-512.png'));
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/pwa/apple-touch-icon.png'));
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/logo.png'));
    assert.ok(PWA_PRECACHE_ALLOWLIST.includes('/favicon.ico'));

    // Pastikan tidak ada endpoint data pada precache
    for (const item of PWA_PRECACHE_ALLOWLIST) {
      assert.equal(item.startsWith('/api/'), false, 'Aset precache tidak boleh memuat API');
      assert.equal(item.includes('santri'), false, 'Aset precache tidak boleh memuat data santri');
      assert.equal(item.includes('tahfizh'), false, 'Aset precache tidak boleh memuat data tahfizh');
    }
  });

  it('2. Request non-GET dilarang dicache', () => {
    const methods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    for (const method of methods) {
      const res = isRequestCacheable({
        method,
        url: `${ORIGIN}/pwa/icon-192.png`,
        origin: ORIGIN,
      });
      assert.equal(res.cacheable, false);
      assert.equal(res.reason, 'method_not_get');
    }
  });

  it('3. Request cross-origin dilarang dicache', () => {
    const res = isRequestCacheable({
      method: 'GET',
      url: 'https://cdn.external.com/logo.png',
      origin: ORIGIN,
    });
    assert.equal(res.cacheable, false);
    assert.equal(res.reason, 'cross_origin');
  });

  it('4. Endpoint API dan Auth sensitif dilarang dicache', () => {
    const sensitiveUrls = [
      `${ORIGIN}/api/v1/santri`,
      `${ORIGIN}/api/v1/setoran`,
      `${ORIGIN}/api/v1/auth/login`,
      `${ORIGIN}/api/v1/rapor/12345`,
      `${ORIGIN}/api/v1/kotak-saran`,
      `${ORIGIN}/auth/session`,
    ];

    for (const url of sensitiveUrls) {
      const res = isRequestCacheable({
        method: 'GET',
        url,
        origin: ORIGIN,
      });
      assert.equal(res.cacheable, false);
      assert.ok(
        res.reason === 'sensitive_api_endpoint' || res.reason === 'sensitive_auth_endpoint',
        `URL ${url} harus ditolak karena endpoint sensitif`
      );
    }
  });

  it('5. RSC payloads dan Server Actions dilarang dicache', () => {
    // A. Query parameter _rsc
    const rscQueryRes = isRequestCacheable({
      method: 'GET',
      url: `${ORIGIN}/?_rsc=abc123xyz`,
      origin: ORIGIN,
    });
    assert.equal(rscQueryRes.cacheable, false);
    assert.equal(rscQueryRes.reason, 'sensitive_rsc_payload');

    // B. Header RSC
    const rscHeaderRes = isRequestCacheable({
      method: 'GET',
      url: `${ORIGIN}/`,
      origin: ORIGIN,
      headers: { RSC: '1' },
    });
    assert.equal(rscHeaderRes.cacheable, false);
    assert.equal(rscHeaderRes.reason, 'sensitive_rsc_header');

    // C. Server Action Header
    const actionHeaderRes = isRequestCacheable({
      method: 'GET',
      url: `${ORIGIN}/`,
      origin: ORIGIN,
      headers: { 'Next-Action': 'c9e377...' },
    });
    assert.equal(actionHeaderRes.cacheable, false);
    assert.equal(actionHeaderRes.reason, 'server_action_call');
  });

  it('6. Respons navigasi HTML dilarang disimpan ke cache (Network-Only / Offline Fallback)', () => {
    const navRes = isRequestCacheable({
      method: 'GET',
      url: `${ORIGIN}/dashboard`,
      origin: ORIGIN,
      headers: { mode: 'navigate' },
    });
    assert.equal(navRes.cacheable, false);
    assert.equal(navRes.reason, 'navigation_network_only');
  });

  it('7. Aset dalam precache allowlist diizinkan untuk dicache', () => {
    for (const path of PWA_PRECACHE_ALLOWLIST) {
      const res = isRequestCacheable({
        method: 'GET',
        url: `${ORIGIN}${path}`,
        origin: ORIGIN,
      });
      assert.equal(res.cacheable, true, `Aset ${path} harus diizinkan dicache`);
      assert.equal(res.reason, 'precache_allowlist');
    }
  });

  it('7B. Query variant pada aset allowlist dilarang dicache (Strict URL Isolation)', () => {
    const queryVariants = [
      `${ORIGIN}/logo.png?token=abc123secret`,
      `${ORIGIN}/favicon.ico?v=2`,
      `${ORIGIN}/offline.html?query=test`,
      `${ORIGIN}/pwa/icon-192.png?cacheBust=999`,
    ];

    for (const url of queryVariants) {
      const res = isRequestCacheable({
        method: 'GET',
        url,
        origin: ORIGIN,
      });
      assert.equal(
        res.cacheable,
        false,
        `URL ${url} dengan query string harus dilarang dicache`
      );
      assert.equal(
        res.reason,
        'allowlisted_asset_with_query',
        `Alasan penolakan harus 'allowlisted_asset_with_query' untuk ${url}`
      );
    }
  });

  it('8. Aset di luar allowlist tidak dicache (Allowlist Strictness)', () => {
    const nonAllowlisted = [
      `${ORIGIN}/dashboard`,
      `${ORIGIN}/profil`,
      `${ORIGIN}/login`,
      `${ORIGIN}/assets/custom-font.woff2`,
    ];
    for (const url of nonAllowlisted) {
      const res = isRequestCacheable({
        method: 'GET',
        url,
        origin: ORIGIN,
      });
      assert.equal(res.cacheable, false);
      assert.equal(res.reason, 'not_in_allowlist');
    }
  });

  it('9. Service Worker registration policy melindungi isolasi test/dev', () => {
    // Bukan browser -> false
    assert.equal(
      shouldRegisterServiceWorker({ isBrowser: false, hasServiceWorker: true, nodeEnv: 'production' }),
      false
    );

    // Browser tanpa SW support -> false
    assert.equal(
      shouldRegisterServiceWorker({ isBrowser: true, hasServiceWorker: false, nodeEnv: 'production' }),
      false
    );

    // Explicitly disabled -> false
    assert.equal(
      shouldRegisterServiceWorker({
        isBrowser: true,
        hasServiceWorker: true,
        nodeEnv: 'production',
        disableSwFlag: true,
      }),
      false
    );

    // Test environment -> false (mencegah polusi test isolation)
    assert.equal(
      shouldRegisterServiceWorker({ isBrowser: true, hasServiceWorker: true, nodeEnv: 'test' }),
      false
    );

    // Development environment -> false
    assert.equal(
      shouldRegisterServiceWorker({ isBrowser: true, hasServiceWorker: true, nodeEnv: 'development' }),
      false
    );

    // Production environment -> true
    assert.equal(
      shouldRegisterServiceWorker({ isBrowser: true, hasServiceWorker: true, nodeEnv: 'production' }),
      true
    );

    // Explicit opt-in flag -> true (untuk testing dedicated PWA)
    assert.equal(
      shouldRegisterServiceWorker({
        isBrowser: true,
        hasServiceWorker: true,
        nodeEnv: 'test',
        enableSwFlag: true,
      }),
      true
    );
  });

  it('10. Pembersihan cache versi lama terisolasi prefix STQ (Cache Namespace Isolation)', () => {
    // Sesuai audit reviewer:
    // - stq-duc-pwa-v0 -> deleted
    // - stq-duc-pwa-v1 active -> retained
    // - third-party-cache -> retained
    // - unrelated-app-v2 -> retained
    const allCaches = [
      'stq-duc-pwa-v0',
      PWA_CACHE_NAME, // 'stq-duc-pwa-v1'
      'third-party-cache',
      'unrelated-app-v2',
      'workbox-precache-v2',
    ];

    const outdated = getOutdatedCacheNames(allCaches, PWA_CACHE_NAME, PWA_CACHE_PREFIX);

    // HANYA stq-duc-pwa-v0 yang ditandai untuk dihapus
    assert.deepEqual(outdated, ['stq-duc-pwa-v0']);

    // Cache aktif STQ tidak boleh dihapus
    assert.equal(outdated.includes(PWA_CACHE_NAME), false, 'Active STQ cache harus dipertahankan');

    // Cache pihak ketiga atau aplikasi lain TIDAK BOLEH disentuh
    assert.equal(outdated.includes('third-party-cache'), false, 'Third party cache tidak boleh dihapus');
    assert.equal(outdated.includes('unrelated-app-v2'), false, 'Unrelated app cache tidak boleh dihapus');
    assert.equal(outdated.includes('workbox-precache-v2'), false, 'Workbox/other cache tidak boleh dihapus');
  });

  it('12. Identifikasi script registrasi STQ Service Worker (/sw.js) secara ketat', () => {
    assert.equal(isStqServiceWorkerRegistration('http://localhost:3000/sw.js'), true);
    assert.equal(isStqServiceWorkerRegistration('https://portal.stqduc.sch.id/sw.js'), true);
    assert.equal(isStqServiceWorkerRegistration('/sw.js'), true);

    // Ditolak: file lain atau subpath lain
    assert.equal(isStqServiceWorkerRegistration('http://localhost:3000/other/sw.js'), false);
    assert.equal(isStqServiceWorkerRegistration('http://localhost:3000/firebase-messaging-sw.js'), false);
    assert.equal(isStqServiceWorkerRegistration('http://localhost:3000/worker.js'), false);
    assert.equal(isStqServiceWorkerRegistration(''), false);
  });

  it('13. Identifikasi namespace cache STQ (stq-duc-pwa-)', () => {
    assert.equal(isStqCacheName('stq-duc-pwa-v1'), true);
    assert.equal(isStqCacheName('stq-duc-pwa-v0'), true);
    assert.equal(isStqCacheName('stq-duc-pwa-temp'), true);

    assert.equal(isStqCacheName('third-party-cache'), false);
    assert.equal(isStqCacheName('unrelated-app-v2'), false);
    assert.equal(isStqCacheName('my-custom-cache'), false);
  });

  it('14. Dev/test cleanupStaleStqServiceWorkers hanya membersihkan STQ dan tidak menyentuh sistem lain', async () => {
    const unregisterCalls: string[] = [];
    const deleteCacheCalls: string[] = [];

    // Mock swContainer dengan 1 STQ SW dan 1 Third-party SW
    const mockSwContainer = {
      async getRegistrations() {
        return [
          {
            active: { scriptURL: 'http://localhost:3000/sw.js' },
            async unregister() {
              unregisterCalls.push('stq-sw');
              return true;
            },
          },
          {
            active: { scriptURL: 'http://localhost:3000/other-app/sw.js' },
            async unregister() {
              unregisterCalls.push('other-sw');
              return true;
            },
          },
          {
            active: { scriptURL: 'https://cdn.example.com/firebase-messaging-sw.js' },
            async unregister() {
              unregisterCalls.push('firebase-sw');
              return true;
            },
          },
        ];
      },
    };

    // Mock CacheStorage dengan STQ caches dan unrelated caches
    const mockCacheStorage = {
      async keys() {
        return [
          'stq-duc-pwa-v0',
          'stq-duc-pwa-v1',
          'third-party-cache',
          'unrelated-app-v2',
        ];
      },
      async delete(name: string) {
        deleteCacheCalls.push(name);
        return true;
      },
    };

    const res = await cleanupStaleStqServiceWorkers(mockSwContainer, mockCacheStorage);

    // Verifikasi Service Worker unregister: HANYA stq-sw
    assert.equal(res.unregisteredCount, 1);
    assert.deepEqual(unregisterCalls, ['stq-sw']);

    // Verifikasi Cache Storage delete: HANYA cache berprefix stq-duc-pwa-
    assert.equal(res.deletedCacheCount, 2);
    assert.deepEqual(deleteCacheCalls, ['stq-duc-pwa-v0', 'stq-duc-pwa-v1']);
    assert.equal(deleteCacheCalls.includes('third-party-cache'), false);
    assert.equal(deleteCacheCalls.includes('unrelated-app-v2'), false);
  });

  it('11. Verifikasi kelengkapan konfigurasi manifest.webmanifest', () => {
    const data = manifest();
    assert.equal(data.name, 'STQ Education Portal — STQ Darul Ulum Cendekia');
    assert.equal(data.short_name, 'STQ DUC');
    assert.equal(data.display, 'standalone');
    assert.equal(data.id, '/');
    assert.equal(data.start_url, '/');
    assert.equal(data.scope, '/');
    assert.equal(data.theme_color, '#0E7C3A');
    assert.equal(data.background_color, '#F7F9F7');
    assert.equal(data.lang, 'id');

    // Cek keberadaan icon 192, 512, maskable, dan apple
    const icons = data.icons || [];
    assert.ok(icons.some((i) => i.sizes === '192x192' && i.src === '/pwa/icon-192.png'));
    assert.ok(icons.some((i) => i.sizes === '512x512' && i.purpose === 'any' && i.src === '/pwa/icon-512.png'));
    assert.ok(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable' && i.src === '/pwa/icon-maskable-512.png'));
    assert.ok(icons.some((i) => i.sizes === '180x180' && i.src === '/pwa/apple-touch-icon.png'));
  });
});
