import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  parseDatabaseUrl,
  redactDatabaseUrl,
  redactQueryParams,
  resolveBackupConnectionUrl,
  verifyBackupFile,
  computeSha256,
  runRetentionCleanup,
  checkPgDumpAvailable,
  verifyPostgresAuthWithPgDump,
  MIN_BACKUP_SIZE_BYTES,
  ParsedDbConfig,
} from '../scripts/backup-db';

describe('Milestone 3.3C2A — Hardened Backup Security & Connection Contract Suite', () => {
  const TEST_SCRATCH_DIR = path.resolve(process.cwd(), 'backups-test-scratch');

  before(() => {
    if (!fs.existsSync(TEST_SCRATCH_DIR)) {
      fs.mkdirSync(TEST_SCRATCH_DIR, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
      fs.rmSync(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
  });

  describe('1. Direct Backup Database Connection Contract & Accelerate Rejection', () => {
    it('1. prisma+postgres:// DATABASE_URL tanpa direct backup URL wajib fail-closed', () => {
      const mockEnv: Record<string, string | undefined> = {
        DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=secret_acc_key',
      };

      assert.throws(
        () => resolveBackupConnectionUrl(mockEnv),
        /uses Prisma Accelerate proxy.*not wire-compatible with pg_dump/,
        'Prisma Accelerate URL sebagai satu-satunya URL wajib ditolak keras'
      );
    });

    it('2. prisma:// DATABASE_URL tanpa direct backup URL wajib fail-closed', () => {
      const mockEnv: Record<string, string | undefined> = {
        DATABASE_URL: 'prisma://aws-acc.prisma-data.net/?api_key=secret_acc_key',
      };

      assert.throws(
        () => resolveBackupConnectionUrl(mockEnv),
        /uses Prisma Accelerate proxy.*not wire-compatible with pg_dump/
      );
    });

    it('3. Explicit direct backup URL (BACKUP_DATABASE_URL) diterima dan diprioritaskan', () => {
      const mockEnv: Record<string, string | undefined> = {
        DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=acc_secret',
        BACKUP_DATABASE_URL: 'postgresql://postgres:direct_pass@postgres-direct.internal:5432/stq_db?sslmode=require',
      };

      const res = resolveBackupConnectionUrl(mockEnv);
      assert.equal(res.source, 'BACKUP_DATABASE_URL');
      assert.equal(res.url, mockEnv.BACKUP_DATABASE_URL);
      assert.equal(res.isDirect, true);
    });

    it('4. Explicit direct backup URL (DIRECT_DATABASE_URL) diterima jika BACKUP_DATABASE_URL kosong', () => {
      const mockEnv: Record<string, string | undefined> = {
        DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=acc_secret',
        DIRECT_DATABASE_URL: 'postgresql://postgres:direct_pass@postgres-direct2.internal:5432/stq_db?sslmode=require',
      };

      const res = resolveBackupConnectionUrl(mockEnv);
      assert.equal(res.source, 'DIRECT_DATABASE_URL');
      assert.equal(res.url, mockEnv.DIRECT_DATABASE_URL);
      assert.equal(res.isDirect, true);
    });

    it('5. Menolak jika BACKUP_DATABASE_URL sendiri secara keliru menggunakan Prisma Accelerate', () => {
      const mockEnv: Record<string, string | undefined> = {
        BACKUP_DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=invalid_for_pg_dump',
      };

      assert.throws(
        () => resolveBackupConnectionUrl(mockEnv),
        /must be a direct PostgreSQL wire-compatible endpoint/
      );
    });

    it('6. Fallback ke DATABASE_URL hanya jika DATABASE_URL adalah direct postgresql:// native', () => {
      const mockEnv: Record<string, string | undefined> = {
        DATABASE_URL: 'postgresql://dbadmin:nativepass@direct-db.internal:5432/stq_prod?sslmode=require',
      };

      const res = resolveBackupConnectionUrl(mockEnv);
      assert.equal(res.source, 'DATABASE_URL');
      assert.equal(res.url, mockEnv.DATABASE_URL);
      assert.equal(res.isDirect, true);
    });

    it('7. Wajib fail-closed jika seluruh environment URL kosong', () => {
      assert.throws(
        () => resolveBackupConnectionUrl({}),
        /No database URL found for backup/
      );
    });

    it('8. parseDatabaseUrl mem-parsing host, port, database, dan credentials dengan tepat', () => {
      const parsed = parseDatabaseUrl('postgresql://stq_user:stq_pass@direct.postgres.internal:5433/stq_prod?sslmode=require');
      assert.equal(parsed.host, 'direct.postgres.internal');
      assert.equal(parsed.port, '5433');
      assert.equal(parsed.database, 'stq_prod');
      assert.equal(parsed.user, 'stq_user');
      assert.equal(parsed.password, 'stq_pass');
      assert.equal(parsed.sslmode, 'require');
    });
  });

  describe('2. Secret Query Parameter Redaction & Logging Safety', () => {
    it('1. api_key query parameter value wajib disamarkan menjadi ***', () => {
      const raw = 'postgresql://admin:pass@db.internal:5432/stq?api_key=MY_SUPER_SECRET_API_KEY_99&sslmode=require';
      const redacted = redactDatabaseUrl(raw);

      assert.equal(redacted.includes('MY_SUPER_SECRET_API_KEY_99'), false, 'Nilai api_key tidak boleh muncul');
      assert.equal(redacted.includes('api_key=***'), true, 'api_key wajib disamarkan menjadi ***');
      assert.equal(redacted.includes('sslmode=require'), true, 'sslmode aman dipertahankan');
    });

    it('2. token query parameter value wajib disamarkan menjadi ***', () => {
      const raw = 'postgresql://admin:pass@db.internal:5432/stq?token=gho_SECRET_TOKEN_XYZ&schema=public';
      const redacted = redactDatabaseUrl(raw);

      assert.equal(redacted.includes('gho_SECRET_TOKEN_XYZ'), false);
      assert.equal(redacted.includes('token=***'), true);
      assert.equal(redacted.includes('schema=public'), true);
    });

    it('3. password dan secret dalam query string wajib disamarkan', () => {
      const raw = 'postgresql://admin:pass@db.internal:5432/stq?access_token=TOPSECRET&client_secret=SHHH&sslmode=prefer';
      const redacted = redactDatabaseUrl(raw);

      assert.equal(redacted.includes('TOPSECRET'), false);
      assert.equal(redacted.includes('SHHH'), false);
      assert.equal(redacted.includes('access_token=***'), true);
      assert.equal(redacted.includes('client_secret=***'), true);
      assert.equal(redacted.includes('sslmode=prefer'), true);
    });

    it('4. redactQueryParams unit helper menyamarkan seluruh non-allowlisted / sensitive keys', () => {
      const params = new URLSearchParams('custom_param=secret_val&api_key=123&sslmode=verify-full&connect_timeout=10');
      const result = redactQueryParams(params);

      assert.equal(result.includes('secret_val'), false);
      assert.equal(result.includes('123'), false);
      assert.equal(result.includes('custom_param=***'), true);
      assert.equal(result.includes('api_key=***'), true);
      assert.equal(result.includes('sslmode=verify-full'), true);
      assert.equal(result.includes('connect_timeout=10'), true);
    });
  });

  describe('3. Backup File Integrity & Size Threshold Verification', () => {
    it('wajib menolak backup jika file tidak ditemukan', () => {
      const nonExistent = path.join(TEST_SCRATCH_DIR, 'ghost_backup.sql');
      const result = verifyBackupFile(nonExistent, MIN_BACKUP_SIZE_BYTES);
      assert.equal(result.valid, false);
      assert.equal(result.size, 0);
      assert.match(result.error || '', /does not exist/);
    });

    it('wajib menolak backup jika ukuran di bawah ambang batas minimum sensible', () => {
      const tinyFile = path.join(TEST_SCRATCH_DIR, 'tiny_corrupt_backup.sql');
      fs.writeFileSync(tinyFile, 'corrupt', 'utf8'); // 7 bytes < 500 bytes

      const result = verifyBackupFile(tinyFile, MIN_BACKUP_SIZE_BYTES);
      assert.equal(result.valid, false);
      assert.equal(result.size, 7);
      assert.match(result.error || '', /below minimum required threshold/);
    });

    it('wajib menerima backup yang memenuhi ambang batas minimum ukuran', () => {
      const validFile = path.join(TEST_SCRATCH_DIR, 'valid_backup.sql');
      const validContent = '-- STQ DUMP HEADER\n' + 'SELECT 1;\n'.repeat(100);
      fs.writeFileSync(validFile, validContent, 'utf8');

      const stat = fs.statSync(validFile);
      assert.ok(stat.size >= MIN_BACKUP_SIZE_BYTES);

      const result = verifyBackupFile(validFile, MIN_BACKUP_SIZE_BYTES);
      assert.equal(result.valid, true);
      assert.equal(result.size, stat.size);
      assert.equal(result.error, undefined);
    });
  });

  describe('4. SHA-256 Checksum Accuracy', () => {
    it('wajib menghasilkan checksum SHA-256 deterministik dan sesuai isi file', () => {
      const sampleFile = path.join(TEST_SCRATCH_DIR, 'sample_for_hash.sql');
      const content = 'STQ_POSTGRESQL_BACKUP_INTEGRITY_PAYLOAD_TEST';
      fs.writeFileSync(sampleFile, content, 'utf8');

      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      const calculatedHash = computeSha256(sampleFile);

      assert.equal(calculatedHash, expectedHash);
      assert.equal(calculatedHash.length, 64);
    });
  });

  describe('5. Retention Cleanup Safety Guards', () => {
    it('hanya membersihkan file kadaluarsa dan mempertahankan file dalam batas retensi', () => {
      const now = Date.now();
      const oldFile = path.join(TEST_SCRATCH_DIR, 'stq_backup_2026-09-01_120000.sql');
      const recentFile = path.join(TEST_SCRATCH_DIR, 'stq_backup_2026-09-18_120000.sql');
      const otherFile = path.join(TEST_SCRATCH_DIR, 'unrelated.txt');

      fs.writeFileSync(oldFile, 'OLD DUMP CONTENT', 'utf8');
      fs.writeFileSync(recentFile, 'RECENT DUMP CONTENT', 'utf8');
      fs.writeFileSync(otherFile, 'UNRELATED FILE', 'utf8');

      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000);

      fs.utimesSync(oldFile, tenDaysAgo, tenDaysAgo);
      fs.utimesSync(recentFile, oneDayAgo, oneDayAgo);

      const { cleanedCount, preservedCount } = runRetentionCleanup(TEST_SCRATCH_DIR, 7, false);

      assert.equal(cleanedCount, 1);
      assert.equal(preservedCount, 1);
      assert.equal(fs.existsSync(oldFile), false);
      assert.equal(fs.existsSync(recentFile), true);
      assert.equal(fs.existsSync(otherFile), true);
    });

    it('dalam mode dry-run tidak melakukan unlink / penghapusan fisik apapun', () => {
      const oldDryFile = path.join(TEST_SCRATCH_DIR, 'stq_backup_2026-08-01_120000.sql');
      fs.writeFileSync(oldDryFile, 'OLD CONTENT', 'utf8');
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldDryFile, twentyDaysAgo, twentyDaysAgo);

      const { cleanedCount } = runRetentionCleanup(TEST_SCRATCH_DIR, 7, true);
      assert.equal(cleanedCount, 1);
      assert.equal(fs.existsSync(oldDryFile), true);
    });
  });

  describe('6. Fail-Closed Protocol: pg_dump Absence & Auth Probe Failure', () => {
    it('checkPgDumpAvailable menghasilkan boolean status yang valid tanpa crashing', () => {
      const check = checkPgDumpAvailable();
      assert.equal(typeof check.available, 'boolean');
    });

    it('verifyPostgresAuthWithPgDump fail-closed jika target host tidak valid atau tidak reachable', () => {
      const dummyConfig: ParsedDbConfig = {
        host: '127.0.0.1',
        port: '59999',
        database: 'unreachable_db',
        user: 'invalid_user',
        password: 'invalid_password',
        isPrismaUrl: false,
        queryParams: new URLSearchParams(),
      };

      const res = verifyPostgresAuthWithPgDump(dummyConfig);
      assert.equal(res.success, false);
      assert.ok(res.error !== undefined);
    });
  });
});
