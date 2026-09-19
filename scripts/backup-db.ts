import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import net from 'net';

/**
 * STQ Education Portal — Hardened PostgreSQL Backup System
 *
 * Requirements (Remediated):
 * 1. Direct connection contract: BACKUP_DATABASE_URL or DIRECT_DATABASE_URL required.
 *    Fails closed if only Prisma Accelerate URL (prisma+postgres://) exists.
 * 2. Mandatory URL: No silent localhost fallback.
 * 3. pg_dump absence or failure: EXIT NON-ZERO. No fake SQL. No success message.
 * 4. Verified backup: exit code 0, file exists, file size >= threshold, SHA-256 generated.
 * 5. Redacted credentials: Passwords AND sensitive query parameters (token, api_key, secret, etc.)
 *    are strictly replaced with '***'.
 * 6. Retention cleanup runs ONLY after newly verified backup succeeds.
 * 7. Preserves existing backups when current backup fails.
 * 8. Zero stale/synthetic SQL placeholders.
 * 9. --dry-run executes zero writes.
 * 10. --verify-only executes real PostgreSQL protocol/auth probe via pg_dump --schema-only without creating a dump.
 */

export const RETENTION_DAYS = 7;
export const MIN_BACKUP_SIZE_BYTES = 500; // Minimum sensible size for valid pg_dump output
export const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export const SAFE_QUERY_PARAMS = new Set([
  'sslmode',
  'ssl',
  'schema',
  'connect_timeout',
  'application_name',
  'target_session_attrs',
]);

export interface ParsedDbConfig {
  user: string;
  password?: string;
  host: string;
  port: string;
  database: string;
  sslmode?: string;
  isPrismaUrl: boolean;
  queryParams: URLSearchParams;
}

export interface BackupTargetResolution {
  url: string;
  source: 'BACKUP_DATABASE_URL' | 'DIRECT_DATABASE_URL' | 'DATABASE_URL';
  isDirect: boolean;
}

/**
 * Resolves the backup database connection URL strictly adhering to the direct connection contract.
 * Never allows Prisma Accelerate proxy (prisma+postgres:// or prisma://) as a valid pg_dump target.
 */
export function resolveBackupConnectionUrl(
  env: Record<string, string | undefined> = process.env
): BackupTargetResolution {
  const explicitDirect = env.BACKUP_DATABASE_URL || env.DIRECT_DATABASE_URL;
  if (explicitDirect && explicitDirect.trim() !== '') {
    const trimmed = explicitDirect.trim();
    if (
      trimmed.startsWith('prisma+postgres://') ||
      trimmed.startsWith('prisma://') ||
      trimmed.includes('accelerate.prisma-data.net')
    ) {
      throw new Error(
        "Explicit backup URL ('BACKUP_DATABASE_URL' or 'DIRECT_DATABASE_URL') must be a direct PostgreSQL wire-compatible endpoint, not a Prisma Accelerate/proxy URL."
      );
    }
    const source = env.BACKUP_DATABASE_URL ? 'BACKUP_DATABASE_URL' : 'DIRECT_DATABASE_URL';
    return { url: trimmed, source, isDirect: true };
  }

  const fallbackUrl = env.DATABASE_URL;
  if (!fallbackUrl || fallbackUrl.trim() === '') {
    throw new Error(
      "No database URL found for backup. An explicit direct PostgreSQL endpoint must be provided via BACKUP_DATABASE_URL or DIRECT_DATABASE_URL."
    );
  }

  const trimmedFallback = fallbackUrl.trim();
  if (
    trimmedFallback.startsWith('prisma+postgres://') ||
    trimmedFallback.startsWith('prisma://') ||
    trimmedFallback.includes('accelerate.prisma-data.net')
  ) {
    throw new Error(
      "DATABASE_URL uses Prisma Accelerate proxy ('prisma+postgres://' or 'prisma://') which is not wire-compatible with pg_dump. A direct PostgreSQL endpoint must be explicitly provided via BACKUP_DATABASE_URL or DIRECT_DATABASE_URL."
    );
  }

  return { url: trimmedFallback, source: 'DATABASE_URL', isDirect: true };
}

/**
 * Parses database URL strictly.
 */
export function parseDatabaseUrl(url?: string): ParsedDbConfig {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('Database URL is mandatory. No silent localhost fallback is permitted.');
  }

  const trimmed = url.trim();
  let parseable = trimmed;
  let isPrismaUrl = false;

  if (parseable.startsWith('prisma+postgres://')) {
    parseable = parseable.replace(/^prisma\+postgres:\/\//, 'postgresql://');
    isPrismaUrl = true;
  } else if (parseable.startsWith('prisma://')) {
    parseable = parseable.replace(/^prisma:\/\//, 'postgresql://');
    isPrismaUrl = true;
  }

  let parsed: URL;
  try {
    parsed = new URL(parseable);
  } catch (err) {
    throw new Error(`Invalid Database URL format: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!parsed.hostname) {
    throw new Error('Database URL must specify a valid hostname.');
  }

  const database = parsed.pathname.replace(/^\//, '') || 'postgres';

  return {
    user: decodeURIComponent(parsed.username || ''),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    host: parsed.hostname,
    port: parsed.port || '5432',
    database,
    sslmode: parsed.searchParams.get('sslmode') || undefined,
    isPrismaUrl,
    queryParams: parsed.searchParams,
  };
}

/**
 * Redacts query parameters using an allowlist approach.
 * Sensitive parameters (e.g. api_key, token, password, secret) and non-allowlisted parameters
 * are strictly replaced with '***'.
 */
export function redactQueryParams(searchParams: URLSearchParams): string {
  const redacted = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    const isSensitiveName =
      lowerKey.includes('key') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('pass') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('cred');

    if (SAFE_QUERY_PARAMS.has(lowerKey) && !isSensitiveName) {
      redacted.set(key, value);
    } else {
      redacted.set(key, '***');
    }
  }
  const str = redacted.toString();
  return str ? `?${str}` : '';
}

/**
 * Returns a fully redacted connection URL safe for logging.
 * Never exposes passwords or query credentials (api_key, token, secret, etc.).
 */
export function redactDatabaseUrl(url?: string): string {
  if (!url) return '[UNSET]';
  try {
    let prefix = 'postgresql://';
    let parseable = url;
    if (url.startsWith('prisma+postgres://')) {
      prefix = 'prisma+postgres://';
      parseable = url.replace(/^prisma\+postgres:\/\//, 'http://');
    } else if (url.startsWith('prisma://')) {
      prefix = 'prisma://';
      parseable = url.replace(/^prisma:\/\//, 'http://');
    } else if (url.startsWith('postgresql://')) {
      prefix = 'postgresql://';
      parseable = url.replace(/^postgresql:\/\//, 'http://');
    } else if (url.startsWith('postgres://')) {
      prefix = 'postgres://';
      parseable = url.replace(/^postgres:\/\//, 'http://');
    }

    const parsed = new URL(parseable);
    const userPart = parsed.username ? `${parsed.username}:***@` : '';
    const portPart = parsed.port ? `:${parsed.port}` : '';
    const queryPart = redactQueryParams(parsed.searchParams);
    return `${prefix}${userPart}${parsed.hostname}${portPart}${parsed.pathname}${queryPart}`;
  } catch {
    return '[REDACTED_INVALID_URL]';
  }
}

/**
 * Checks if pg_dump is installed and executable in PATH.
 */
export function checkPgDumpAvailable(): { available: boolean; version?: string; error?: string } {
  try {
    const res = spawnSync('pg_dump', ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    if (res.status === 0 && res.stdout) {
      return { available: true, version: res.stdout.trim() };
    }
    return {
      available: false,
      error: res.stderr ? res.stderr.trim() : `Process exited with code ${res.status}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'pg_dump binary not found';
    return { available: false, error: msg };
  }
}

/**
 * Verifies PostgreSQL authentication and protocol readiness using pg_dump read-only schema probe.
 * Does not write any backup files.
 */
export function verifyPostgresAuthWithPgDump(dbConfig: ParsedDbConfig): { success: boolean; error?: string } {
  const pgEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: dbConfig.host,
    PGPORT: dbConfig.port,
    PGDATABASE: dbConfig.database,
    PGUSER: dbConfig.user,
  };
  if (dbConfig.password) {
    pgEnv.PGPASSWORD = dbConfig.password;
  }
  if (dbConfig.sslmode) {
    pgEnv.PGSSLMODE = dbConfig.sslmode;
  }

  const dumpArgs = [
    '-h', dbConfig.host,
    '-p', dbConfig.port,
    '-U', dbConfig.user,
    '-d', dbConfig.database,
    '--schema-only',
    '--no-owner',
    '--no-privileges',
  ];

  try {
    const res = spawnSync('pg_dump', dumpArgs, {
      env: pgEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 10000,
    });
    if (res.status === 0) {
      return { success: true };
    }
    return {
      success: false,
      error: res.stderr ? res.stderr.trim() : `pg_dump auth probe exited with code ${res.status}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Verifies network connectivity to database host and port without sending secrets.
 */
export async function checkTcpConnectivity(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', (err) => {
      reject(err);
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Connection timeout after ${timeoutMs}ms to ${host}:${port}`));
    });
  });
}

/**
 * Computes SHA-256 checksum of a file.
 */
export function computeSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Validates that a backup file exists and exceeds minimum size.
 */
export function verifyBackupFile(filePath: string, minSize = MIN_BACKUP_SIZE_BYTES): { valid: boolean; size: number; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, size: 0, error: `Backup file does not exist: ${filePath}` };
  }
  const stat = fs.statSync(filePath);
  if (stat.size < minSize) {
    return {
      valid: false,
      size: stat.size,
      error: `Backup file size (${stat.size} bytes) is below minimum required threshold (${minSize} bytes).`,
    };
  }
  return { valid: true, size: stat.size };
}

/**
 * Rotates and removes expired backup files.
 * MUST only be invoked after a verified backup is confirmed.
 */
export function runRetentionCleanup(
  backupDir = BACKUP_DIR,
  retentionDays = RETENTION_DAYS,
  isDry = false
): { cleanedCount: number; preservedCount: number } {
  if (!fs.existsSync(backupDir)) {
    return { cleanedCount: 0, preservedCount: 0 };
  }

  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupDir);
  let cleanedCount = 0;
  let preservedCount = 0;

  for (const file of files) {
    if (
      (file.startsWith('stq_backup_') && file.endsWith('.sql')) ||
      (file.startsWith('stq_backup_') && file.endsWith('.sql.sha256'))
    ) {
      const filePath = path.join(backupDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < cutoffTime) {
          if (!isDry) {
            fs.unlinkSync(filePath);
          }
          console.log(`  🗑 Dihapus (Usang > ${retentionDays} hari): ${file}`);
          cleanedCount++;
        } else {
          preservedCount++;
        }
      } catch (e) {
        console.warn(`  ⚠ Gagal memeriksa file ${file}:`, e);
      }
    }
  }

  return { cleanedCount, preservedCount };
}

/**
 * Main backup execution entrypoint.
 */
export async function runBackup(args: string[] = process.argv.slice(2)): Promise<void> {
  const isDryRun = args.includes('--dry-run');
  const isVerifyOnly = args.includes('--verify-only');

  console.log('=====================================================');
  console.log('🕌 STQ EDUCATION PORTAL — HARDENED POSTGRESQL BACKUP');
  console.log('=====================================================');

  // Resolve target connection URL adhering to the direct connection contract
  let resolution: BackupTargetResolution;
  try {
    resolution = resolveBackupConnectionUrl(process.env);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ERROR FATAL KONTRAK KONEKSI BACKUP: ${errorMsg}`);
    console.error('BACKUP_EXECUTION_READY = BLOCKED');
    process.exit(1);
  }

  let dbConfig: ParsedDbConfig;
  try {
    dbConfig = parseDatabaseUrl(resolution.url);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ERROR FATAL saat mem-parsing Database URL: ${errorMsg}`);
    console.error('BACKUP_EXECUTION_READY = BLOCKED');
    process.exit(1);
  }

  const redactedUrl = redactDatabaseUrl(resolution.url);
  console.log(`[1] Connection Source: ${resolution.source}`);
  console.log(`[2] Target Host     : ${dbConfig.host}:${dbConfig.port}`);
  console.log(`[3] Target Database : ${dbConfig.database}`);
  console.log(`[4] Target User     : ${dbConfig.user || '[DEFAULT]'}`);
  console.log(`[5] Redacted Target : ${redactedUrl}`);
  console.log(`[6] Direktori Arsip : ${BACKUP_DIR}`);
  console.log(`[7] Retensi Hari    : ${RETENTION_DAYS} hari`);
  console.log(`[8] Mode Operasi    : ${isVerifyOnly ? 'VERIFIKASI SAJA (--verify-only)' : isDryRun ? 'SIMULASI (--dry-run)' : 'PRODUKSI'}\n`);

  // 1. Verify pg_dump binary
  const pgDumpCheck = checkPgDumpAvailable();
  if (!pgDumpCheck.available) {
    if (!isDryRun) {
      console.error(`❌ Biner 'pg_dump' TIDAK TERSEDIA atau gagal dieksekusi: ${pgDumpCheck.error}`);
      console.error('Pencadangan database TIDAK DAPAT DILANJUTKAN. Tidak ada file snapshot palsu yang akan dibuat.');
      console.error('BACKUP_EXECUTION_READY = BLOCKED');
      process.exit(1);
    } else {
      console.log(`⚠ [DRY-RUN] Biner 'pg_dump' tidak terdeteksi di PATH: ${pgDumpCheck.error}`);
    }
  } else {
    console.log(`✔ Biner pg_dump terdeteksi: ${pgDumpCheck.version}`);
  }

  // 2. Verify connectivity
  console.log(`⏳ Memverifikasi konektivitas TCP ke ${dbConfig.host}:${dbConfig.port}...`);
  try {
    await checkTcpConnectivity(dbConfig.host, Number(dbConfig.port), 7000);
    console.log(`✔ Konektivitas TCP ke database host BERHASIL.`);
  } catch (netErr: unknown) {
    const netErrMsg = netErr instanceof Error ? netErr.message : String(netErr);
    if (!isDryRun) {
      console.error(`❌ GAGAL terhubung ke database host (${dbConfig.host}:${dbConfig.port}): ${netErrMsg}`);
      console.error('BACKUP_EXECUTION_READY = BLOCKED');
      process.exit(1);
    } else {
      console.log(`⚠ [DRY-RUN] Konektivitas TCP tidak tercapai: ${netErrMsg}`);
    }
  }

  // Handle --verify-only mode (Must execute real PostgreSQL auth probe)
  if (isVerifyOnly) {
    console.log('\n⏳ Menjalankan probe autentikasi dan protokol PostgreSQL via pg_dump...');
    const authCheck = verifyPostgresAuthWithPgDump(dbConfig);
    if (!authCheck.success) {
      console.error(`❌ Gagal memvalidasi autentikasi / protokol PostgreSQL: ${authCheck.error}`);
      console.error('BACKUP_EXECUTION_READY = BLOCKED');
      process.exit(1);
    }

    console.log('\n=====================================================');
    console.log('✅ VERIFIKASI SELESAI: SEMUA PRASYARAT BACKUP TERPENUHI');
    console.log('=====================================================');
    console.log(`- Connection Source: ${resolution.source} (Direct PostgreSQL)`);
    console.log(`- pg_dump Binary   : Tersedia (${pgDumpCheck.version})`);
    console.log('- TCP Connectivity : Host database dapat dihubungi');
    console.log('- Auth & Protocol  : Terverifikasi via read-only schema probe');
    console.log('BACKUP_EXECUTION_READY = READY');
    return;
  }

  // Ensure backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    if (!isDryRun) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`✔ Direktori arsip backup berhasil dibuat: ${BACKUP_DIR}`);
    } else {
      console.log(`[DRY-RUN] Direktori arsip backup akan dibuat di: ${BACKUP_DIR}`);
    }
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '').slice(0, 15);
  const backupFileName = `stq_backup_${timestamp}.sql`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);
  const checksumFilePath = `${backupFilePath}.sha256`;

  // Handle --dry-run mode
  if (isDryRun) {
    console.log('\n--- Mode Simulasi (--dry-run) ---');
    console.log(`Target file simulasi : ${backupFilePath}`);
    console.log(
      `Command simulasi     : pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F p -f "${backupFilePath}"`
    );
    console.log('✔ [DRY-RUN] Zero database writes. Zero backup files created.');
    console.log('\n--- Menjalankan Simulasi Rotasi Retensi ---');
    const { cleanedCount, preservedCount } = runRetentionCleanup(BACKUP_DIR, RETENTION_DAYS, true);
    console.log(`[DRY-RUN] File usang yang akan dihapus: ${cleanedCount}, File yang dipertahankan: ${preservedCount}`);
    console.log('\n=====================================================');
    console.log('✅ SIMULASI BACKUP BERHASIL DILAKSANAKAN DENGAN SUKSES');
    console.log('=====================================================');
    return;
  }

  // Execute pg_dump
  console.log(`\n⏳ Menjalankan pg_dump ke ${backupFileName}...`);
  const pgEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: dbConfig.host,
    PGPORT: dbConfig.port,
    PGDATABASE: dbConfig.database,
    PGUSER: dbConfig.user,
  };
  if (dbConfig.password) {
    pgEnv.PGPASSWORD = dbConfig.password;
  }
  if (dbConfig.sslmode) {
    pgEnv.PGSSLMODE = dbConfig.sslmode;
  }

  const dumpArgs = [
    '-h', dbConfig.host,
    '-p', dbConfig.port,
    '-U', dbConfig.user,
    '-d', dbConfig.database,
    '-F', 'p',
    '-f', backupFilePath,
  ];

  const dumpResult = spawnSync('pg_dump', dumpArgs, {
    env: pgEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (dumpResult.status !== 0) {
    console.error(`❌ pg_dump GAGAL dengan exit code ${dumpResult.status}!`);
    if (dumpResult.stderr) {
      console.error(`Error details: ${dumpResult.stderr.trim()}`);
    }
    // Clean up partial invalid file if any
    if (fs.existsSync(backupFilePath)) {
      try {
        fs.unlinkSync(backupFilePath);
      } catch {}
    }
    console.error('Pencadangan GAGAL. File backup palsu DILARANG keras.');
    console.error('BACKUP_EXECUTION_READY = BLOCKED');
    process.exit(1);
  }

  // Verify backup file integrity
  const fileCheck = verifyBackupFile(backupFilePath, MIN_BACKUP_SIZE_BYTES);
  if (!fileCheck.valid) {
    console.error(`❌ Verifikasi integritas backup GAGAL: ${fileCheck.error}`);
    if (fs.existsSync(backupFilePath)) {
      try {
        fs.unlinkSync(backupFilePath);
      } catch {}
    }
    console.error('BACKUP_EXECUTION_READY = BLOCKED');
    process.exit(1);
  }

  // Generate SHA-256
  const sha256 = computeSha256(backupFilePath);
  fs.writeFileSync(checksumFilePath, `${sha256}  ${backupFileName}\n`, 'utf8');

  console.log(`✔ Backup berhasil disimpan  : ${backupFilePath}`);
  console.log(`✔ Ukuran file               : ${fileCheck.size} bytes`);
  console.log(`✔ SHA-256 Checksum          : ${sha256}`);
  console.log(`✔ Checksum file disimpan    : ${checksumFilePath}`);

  // Run retention cleanup ONLY AFTER verified backup success
  console.log('\n--- Menjalankan Rotasi Pembersihan Arsip Usang ---');
  const { cleanedCount, preservedCount } = runRetentionCleanup(BACKUP_DIR, RETENTION_DAYS, false);
  console.log(`✔ File usang dibersihkan: ${cleanedCount}, File dipertahankan: ${preservedCount}`);

  console.log('\n=====================================================');
  console.log('✅ OPERASI PENCADANGAN DATABASE SELESAI DENGAN SUKSES');
  console.log('=====================================================');
}

// Auto-run when executed directly via CLI
if (typeof process !== 'undefined' && process.argv && process.argv[1]) {
  const scriptName = path.basename(process.argv[1]);
  if (scriptName === 'backup-db.ts' || scriptName === 'backup-db.js') {
    runBackup().catch((err) => {
      console.error('❌ Terjadi kesalahan tak terduga pada proses backup:', err);
      process.exit(1);
    });
  }
}
