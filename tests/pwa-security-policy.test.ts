import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PWA_CACHE_NAME,
  PWA_PRECACHE_ALLOWLIST,
  isRequestCacheable,
  shouldRegisterServiceWorker,
  getOutdatedCacheNames,
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

  it('10. Pembersihan cache versi lama (Cache Cleanup Lifecycle)', () => {
    const allCaches = ['stq-duc-pwa-v0', 'stq-duc-old-test', PWA_CACHE_NAME];
    const outdated = getOutdatedCacheNames(allCaches, PWA_CACHE_NAME);
    assert.deepEqual(outdated, ['stq-duc-pwa-v0', 'stq-duc-old-test']);
    assert.equal(outdated.includes(PWA_CACHE_NAME), false);
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
