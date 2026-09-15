import crypto from "crypto";

export interface SeedGuardConfig {
  nodeEnv?: string;
  allowDestructiveSeed?: string;
  databaseUrl?: string;
  seedPassword?: string;
}

export class SeedSecurityError extends Error {
  constructor(message: string) {
    super(`[SEED_SECURITY_VIOLATION] ${message}`);
    this.name = "SeedSecurityError";
  }
}

/**
 * Memeriksa apakah URL database mengarah ke target lokal atau test yang terbukti aman.
 * Menolak keras host produksi, database cloud (Supabase, Neon, AWS RDS, Prisma Accelerate, dll.).
 */
export function isDemonstrablyLocalOrTestDatabase(databaseUrl?: string): boolean {
  if (!databaseUrl || typeof databaseUrl !== "string") {
    return false;
  }

  const lowerUrl = databaseUrl.toLowerCase();

  // Indikator layanan cloud / remote / production yang dilarang mutlak
  const forbiddenCloudIndicators = [
    "accelerate.prisma-data.net",
    "supabase.co",
    "neon.tech",
    "rds.amazonaws.com",
    "cloudsql",
    "azure.com",
    "cockroachlabs.cloud",
    "aivencloud.com",
    "railway.app",
    "render.com",
    "koyeb.app",
    "upstash.io",
    "cleardb.net",
    "pooler.supabase.com",
  ];

  for (const indicator of forbiddenCloudIndicators) {
    if (lowerUrl.includes(indicator)) {
      return false;
    }
  }

  // Ekstraksi hostname dari URL database
  try {
    const normalized = lowerUrl.replace(/^prisma:\/\//, "postgresql://");
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    const allowedLocalHosts = [
      "localhost",
      "127.0.0.1",
      "::1",
      "0.0.0.0",
    ];

    if (allowedLocalHosts.includes(host)) {
      return true;
    }

    // Hostname khusus test container lokal
    if (host.startsWith("stq-test") || host === "test-db" || host === "local-postgres") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export interface SeedGuardResult {
  targetDatabaseHost: string;
  resolvedSeedPassword: string;
  isEphemeralPassword: boolean;
}

/**
 * Memvalidasi keamanan eksekusi seeding database.
 * Melempar SeedSecurityError jika terdeteksi risiko eksekusi di lingkungan produksi.
 */
export function validateSeedExecutionSafety(config: SeedGuardConfig = {}): SeedGuardResult {
  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV;
  const allowDestructive = config.allowDestructiveSeed ?? process.env.ALLOW_DESTRUCTIVE_SEED;
  const dbUrl = config.databaseUrl ?? process.env.DATABASE_URL;
  const explicitPassword = config.seedPassword ?? process.env.STQ_SEED_DEFAULT_PASSWORD;

  // 1. Larangan mutlak di lingkungan produksi
  if (nodeEnv === "production") {
    throw new SeedSecurityError("Seed execution is strictly forbidden when NODE_ENV is 'production'.");
  }

  // 2. Persyaratan eksplisit izin seeding destruktif
  if (allowDestructive !== "true") {
    throw new SeedSecurityError(
      "Destructive seed execution blocked. ALLOW_DESTRUCTIVE_SEED='true' is required to proceed in development/test."
    );
  }

  // 3. Validasi target database
  if (!dbUrl) {
    throw new SeedSecurityError("DATABASE_URL is not configured.");
  }

  if (!isDemonstrablyLocalOrTestDatabase(dbUrl)) {
    throw new SeedSecurityError(
      "Seed execution blocked: DATABASE_URL does not resolve to an approved local, test, or development database host."
    );
  }

  // 4. Resolusi kredensial seed aman (tanpa hardcoded default plaintext)
  let resolvedSeedPassword = "";
  let isEphemeralPassword = false;

  if (explicitPassword) {
    if (explicitPassword.length < 12) {
      throw new SeedSecurityError("STQ_SEED_DEFAULT_PASSWORD must be at least 12 characters long.");
    }
    resolvedSeedPassword = explicitPassword;
  } else {
    // Generate ephemeral password acak untuk workflow dev/test lokal
    resolvedSeedPassword = crypto.randomBytes(16).toString("hex");
    isEphemeralPassword = true;
  }

  let hostDisplay = "localhost";
  try {
    const parsed = new URL(dbUrl.replace(/^prisma:\/\//, "postgresql://"));
    hostDisplay = parsed.hostname;
  } catch {
    // fallback
  }

  return {
    targetDatabaseHost: hostDisplay,
    resolvedSeedPassword,
    isEphemeralPassword,
  };
}
