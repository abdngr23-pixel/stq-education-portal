/**
 * In-Memory Sliding Window / Token Bucket Rate Limiter
 * Ringan, tanpa dependensi eksternal, kompatibel dengan Edge / Serverless / Node.js
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Global cache untuk menyimpan hitungan request per IP / kunci
const rateLimitStore = new Map<string, RateLimitRecord>();

// Bersihkan rekaman kedaluwarsa secara berkala (setiap 60 detik) untuk mencegah memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000).unref?.();
}

export interface RateLimitOptions {
  limit: number;       // Jumlah maksimum permintaan
  windowMs: number;    // Durasi jendela waktu (dalam milidetik)
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

/**
 * Periksa dan perbarui kuota request untuk pengenal tertentu (misal IP address)
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    // Window baru
    const resetTime = now + options.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      resetTime,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  // Masih dalam jendela aktif
  existing.count += 1;
  rateLimitStore.set(key, existing);

  const remaining = Math.max(0, options.limit - existing.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetTime - now) / 1000));

  return {
    success: existing.count <= options.limit,
    limit: options.limit,
    remaining,
    resetTime: existing.resetTime,
    retryAfterSeconds,
  };
}

/**
 * Reset rate limit untuk key tertentu (berguna untuk testing atau unblock)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Helper untuk mengekstrak IP client dari NextRequest headers
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return '127.0.0.1';
}
