/**
 * CORS (Cross-Origin Resource Sharing) Security Handler
 * Membatasi asal domain eksternal yang dapat mengakses endpoint API STQ Portal
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://stq-education-portal-app-two.vercel.app',
];

/**
 * Validasi apakah origin diizinkan
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;

  const normalized = origin.trim().replace(/\/$/, '');

  // Cek daftar default
  if (ALLOWED_ORIGINS.includes(normalized)) {
    return true;
  }

  // Izinkan seluruh preview deployment vercel
  if (/^https:\/\/[a-zA-Z0-9-_]+\.vercel\.app$/.test(normalized)) {
    return true;
  }

  // Cek environment variable kustom jika disetel
  const customEnv = process.env.ALLOWED_ORIGINS;
  if (customEnv) {
    const list = customEnv.split(',').map((o) => o.trim().replace(/\/$/, ''));
    if (list.includes(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Dapatkan header CORS yang aman untuk response
 */
export function getCorsHeaders(origin: string | null | undefined): Record<string, string> {
  const allowed = isOriginAllowed(origin);
  const matchedOrigin = allowed && origin ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 jam cache preflight
  };
}

/**
 * Respons preflight request OPTIONS
 */
export function handleCorsPreflight(origin: string | null | undefined): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
