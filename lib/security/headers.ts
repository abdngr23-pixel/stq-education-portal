/**
 * Standard Security Headers (Helmet Equivalents)
 * Meniru proteksi HTTP helmet untuk mencegah XSS, Clickjacking, MIME-sniffing, dan MITM
 */

export const CSP_HEADER_VALUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const SECURE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP_HEADER_VALUE,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

/**
 * Menerapkan seluruh secure headers ke objek NextResponse / Headers
 */
export function applySecureHeaders(targetHeaders: Headers): void {
  for (const [key, value] of Object.entries(SECURE_HEADERS)) {
    targetHeaders.set(key, value);
  }
}
