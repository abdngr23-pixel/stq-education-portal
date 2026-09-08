/**
 * Proteksi CSRF (Cross-Site Request Forgery)
 * Memverifikasi header Origin & Referer pada metode state-changing (POST, PUT, DELETE, PATCH)
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Daftar host / origin yang diizinkan secara default
 */
const DEFAULT_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'stq-education-portal-app-two.vercel.app',
];

/**
 * Mengecek apakah host diizinkan (termasuk preview deployment vercel)
 */
function isHostAllowed(host: string, requestHost?: string | null): boolean {
  if (!host) return false;

  // Bersihkan port jika ada (contoh: localhost:3000 -> localhost)
  const hostname = host.split(':')[0].toLowerCase();
  const reqHostname = requestHost ? requestHost.split(':')[0].toLowerCase() : null;

  // Izinkan jika cocok dengan host dari request saat ini
  if (reqHostname && hostname === reqHostname) {
    return true;
  }

  // Izinkan jika ada dalam daftar default
  if (DEFAULT_ALLOWED_HOSTS.includes(hostname)) {
    return true;
  }

  // Izinkan seluruh subdomain vercel.app
  if (hostname.endsWith('.vercel.app')) {
    return true;
  }

  // Izinkan host tambahan dari environment variable jika disetel
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    const customList = envOrigins.split(',').map((h) => h.trim().toLowerCase());
    if (customList.includes(hostname)) {
      return true;
    }
  }

  return false;
}

export interface CsrfCheckResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Verifikasi apakah permintaan aman dari serangan CSRF
 */
export function verifyCsrf(
  method: string,
  headers: Headers,
  url: URL
): CsrfCheckResult {
  // Hanya periksa request mutasi data
  if (!MUTATING_METHODS.has(method.toUpperCase())) {
    return { isValid: true };
  }

  const originHeader = headers.get('origin');
  const refererHeader = headers.get('referer');
  const hostHeader = headers.get('x-forwarded-host') || headers.get('host') || url.host;

  // 1. Cek Origin Header (Prioritas Utama untuk Fetch / XHR / Form modern)
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      if (isHostAllowed(originUrl.host, hostHeader)) {
        return { isValid: true };
      }
      return {
        isValid: false,
        reason: `Origin '${originHeader}' tidak diizinkan mengakses portal ini.`,
      };
    } catch {
      return { isValid: false, reason: 'Format header Origin tidak valid.' };
    }
  }

  // 2. Cek Referer Header jika Origin tidak dikirimkan
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      if (isHostAllowed(refererUrl.host, hostHeader)) {
        return { isValid: true };
      }
      return {
        isValid: false,
        reason: `Referer '${refererHeader}' berasal dari domain luar yang tidak diizinkan.`,
      };
    } catch {
      return { isValid: false, reason: 'Format header Referer tidak valid.' };
    }
  }

  // 3. Jika Origin dan Referer sama-sama tidak ada:
  // Cek apakah ada header Authorization Bearer (API client murni / Mobile app)
  const authHeader = headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { isValid: true };
  }

  // Untuk browser yang memanggil mutasi tanpa Origin dan Referer, tolak demi keamanan
  // Kecuali jika dalam lingkungan lokal development murni dan tidak ada header
  if (process.env.NODE_ENV === 'development' && (!hostHeader || hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1'))) {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: 'Permintaan mutasi ditolak: Header Origin atau Referer wajib ada untuk mencegah CSRF.',
  };
}
