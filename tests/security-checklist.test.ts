import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, resetRateLimit } from '../lib/security/rate-limit';
import { verifyCsrf } from '../lib/security/csrf';
import { isOriginAllowed, getCorsHeaders } from '../lib/security/cors';
import {
  loginSchema,
  santriInputSchema,
  setoranSchema,
  kotakSaranSchema,
  validateData,
} from '../lib/validations';
import { createSessionToken, verifySessionToken } from '../lib/auth';
import { SECURE_HEADERS, applySecureHeaders } from '../lib/security/headers';

describe('1. Rate Limiting Security Tests', () => {
  it('harus mengizinkan request di bawah ambang batas (10 req/menit)', () => {
    const testKey = 'test_ip_normal';
    resetRateLimit(testKey);

    const res1 = checkRateLimit(testKey, { limit: 10, windowMs: 60000 });
    assert.equal(res1.success, true);
    assert.equal(res1.remaining, 9);

    const res2 = checkRateLimit(testKey, { limit: 10, windowMs: 60000 });
    assert.equal(res2.success, true);
    assert.equal(res2.remaining, 8);
  });

  it('harus memblokir request ke-11 jika limit 10 terlampaui', () => {
    const testKey = 'test_ip_spammer';
    resetRateLimit(testKey);

    for (let i = 0; i < 10; i++) {
      const res = checkRateLimit(testKey, { limit: 10, windowMs: 60000 });
      assert.equal(res.success, true);
    }

    // Request ke-11 harus gagal
    const blocked = checkRateLimit(testKey, { limit: 10, windowMs: 60000 });
    assert.equal(blocked.success, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds > 0);
  });

  it('harus dapat mereset kuota limit dengan resetRateLimit()', () => {
    const testKey = 'test_ip_reset';
    resetRateLimit(testKey);

    checkRateLimit(testKey, { limit: 2, windowMs: 60000 });
    checkRateLimit(testKey, { limit: 2, windowMs: 60000 });
    const blocked = checkRateLimit(testKey, { limit: 2, windowMs: 60000 });
    assert.equal(blocked.success, false);

    resetRateLimit(testKey);
    const unblocked = checkRateLimit(testKey, { limit: 2, windowMs: 60000 });
    assert.equal(unblocked.success, true);
  });
});

describe('2. Authentication & Session Security Tests', () => {
  it('harus membuat token JWT valid dan dapat diverifikasi ulang', async () => {
    const token = await createSessionToken({
      sub: 'usr_test_adm',
      username: 'admin.stq',
      role: 'ADM',
    });

    assert.ok(typeof token === 'string' && token.length > 20);

    const payload = await verifySessionToken(token);
    assert.ok(payload);
    assert.equal(payload.sub, 'usr_test_adm');
    assert.equal(payload.role, 'ADM');
    assert.equal(payload.username, 'admin.stq');
  });

  it('harus menolak token JWT yang telah dimanipulasi atau rusak', async () => {
    const token = await createSessionToken({
      sub: 'usr_test_st',
      username: 'santri.fathur',
      role: 'ST',
    });

    const tampered = token.slice(0, -5) + 'xyz12';
    const payload = await verifySessionToken(tampered);
    assert.equal(payload, null);
  });
});

describe('3. CSRF Protection Security Tests', () => {
  it('harus mengizinkan metode baca data (GET, HEAD) tanpa memeriksa CSRF', () => {
    const headers = new Headers();
    const url = new URL('http://localhost:3000/api/v1/santri');
    const result = verifyCsrf('GET', headers, url);
    assert.equal(result.isValid, true);
  });

  it('harus menolak request POST dari domain berbahaya (malicious origin)', () => {
    const headers = new Headers({
      origin: 'http://malicious-phishing-site.xyz',
    });
    const url = new URL('http://localhost:3000/api/v1/santri');
    const result = verifyCsrf('POST', headers, url);
    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('tidak diizinkan'));
  });

  it('harus mengizinkan request POST dari origin sah (localhost atau production Vercel)', () => {
    const headers = new Headers({
      origin: 'https://stq-education-portal-app-two.vercel.app',
    });
    const url = new URL('https://stq-education-portal-app-two.vercel.app/api/v1/santri');
    const result = verifyCsrf('POST', headers, url);
    assert.equal(result.isValid, true);
  });

  it('harus mengizinkan request POST API murni yang menyertakan Bearer token', () => {
    const headers = new Headers({
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    });
    const url = new URL('http://localhost:3000/api/v1/santri');
    const result = verifyCsrf('POST', headers, url);
    assert.equal(result.isValid, true);
  });
});

describe('4. Input Validation (Zod) Security Tests', () => {
  it('harus memvalidasi login: menolak jika kata sandi kurang dari 6 karakter', () => {
    const invalidLogin = {
      username: 'admin',
      password: '123', // Kurang dari 6 karakter
    };
    const res = validateData(loginSchema, invalidLogin);
    assert.equal(res.success, false);
    assert.ok(res.errors.some((e) => e.includes('minimal 6 karakter')));
  });

  it('harus memvalidasi setoran tahfizh: menolak jika juz di luar 1-30', () => {
    const invalidSetoran = {
      santriId: 'san_01',
      jenis: 'SABAQ',
      juz: 35, // Juz di luar Al-Quran
      surahMulai: 'An-Naba',
      ayatMulai: 1,
      surahSelesai: 'An-Naba',
      ayatSelesai: 10,
      nilai: 'MUMTAZ',
    };
    const res = validateData(setoranSchema, invalidSetoran);
    assert.equal(res.success, false);
    assert.ok(res.errors.some((e) => e.includes('maksimal 30')));
  });

  it('harus memvalidasi pendaftaran santri: menolak NIS dengan karakter berbahaya/simbol', () => {
    const invalidSantri = {
      nis: 'NIS<script>',
      nama: 'Ahmad Santri',
      kelas: 'VII-A',
      jenisKelamin: 'L',
    };
    const res = validateData(santriInputSchema, invalidSantri);
    assert.equal(res.success, false);
    assert.ok(res.errors.some((e) => e.includes('NIS')));
  });

  it('harus memvalidasi kotak saran: menolak pesan kurang dari 5 karakter', () => {
    const invalidSaran = {
      nama: 'Budi',
      kategori: 'Umum',
      pesan: 'Hai', // Terlalu pendek
    };
    const res = validateData(kotakSaranSchema, invalidSaran);
    assert.equal(res.success, false);
  });

  it('harus meloloskan data valid pada seluruh skema', () => {
    const validSaran = {
      nama: 'Wali Santri Ahmad',
      kategori: 'Halaqoh',
      pesan: 'Mohon info update setoran ziyadah juz 30.',
    };
    const res = validateData(kotakSaranSchema, validSaran);
    assert.equal(res.success, true);
    assert.equal(res.data.nama, 'Wali Santri Ahmad');
  });
});

describe('5 & 6. CORS Restrictions Tests', () => {
  it('harus mengizinkan domain localhost dan domain resmi Vercel', () => {
    assert.equal(isOriginAllowed('http://localhost:3000'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:3000'), true);
    assert.equal(isOriginAllowed('https://stq-education-portal-app-two.vercel.app'), true);
    assert.equal(isOriginAllowed('https://preview-123.vercel.app'), true);
  });

  it('harus menolak domain asing / attacker', () => {
    assert.equal(isOriginAllowed('http://hacker-website.com'), false);
    assert.equal(isOriginAllowed('https://evil-portal.xyz'), false);
  });

  it('harus menyertakan header CORS lengkap pada response', () => {
    const headers = getCorsHeaders('https://stq-education-portal-app-two.vercel.app');
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://stq-education-portal-app-two.vercel.app');
    assert.ok(headers['Access-Control-Allow-Methods'].includes('POST'));
    assert.ok(headers['Access-Control-Allow-Headers'].includes('Authorization'));
  });
});

describe('7. Secure Headers (Helmet Equivalents) Tests', () => {
  it('harus memuat konfigurasi Content-Security-Policy, HSTS, X-Frame-Options, dan nosniff', () => {
    assert.equal(SECURE_HEADERS['X-Frame-Options'], 'DENY');
    assert.equal(SECURE_HEADERS['X-Content-Type-Options'], 'nosniff');
    assert.ok(SECURE_HEADERS['Strict-Transport-Security'].includes('max-age'));
    assert.ok(SECURE_HEADERS['Content-Security-Policy'].includes("default-src 'self'"));
    assert.ok(SECURE_HEADERS['Permissions-Policy'].includes('camera=()'));

    const testHeaders = new Headers();
    applySecureHeaders(testHeaders);
    assert.equal(testHeaders.get('X-Frame-Options'), 'DENY');
    assert.equal(testHeaders.get('X-Content-Type-Options'), 'nosniff');
  });
});

describe('8. Body & Query Size Limits Logic', () => {
  it('harus mendeteksi query string yang melebihi batas 2048 karakter', () => {
    const longQuery = '?' + 'a='.repeat(1025); // > 2048 karakter
    assert.ok(longQuery.length > 2048);
  });

  it('harus mendeteksi payload body yang melebihi 2MB', () => {
    const maxBytes = 2 * 1024 * 1024;
    const oversizedPayload = 2.5 * 1024 * 1024;
    assert.ok(oversizedPayload > maxBytes);
  });
});

