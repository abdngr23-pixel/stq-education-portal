import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  parseDatabaseUrl,
  redactDatabaseUrl,
  verifyBackupFile,
  computeSha256,
  runRetentionCleanup,
  checkPgDumpAvailable,
  MIN_BACKUP_SIZE_BYTES,
} from '../scripts/backup-db';

describe('Milestone 3.3C2A — Backup Script Security Hardening Suite', () => {
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

  describe('1. DATABASE_URL Mandatory & Parsing Strictness', () => {
    it('wajib melempar error jika DATABASE_URL undefined atau kosong (tanpa localhost fallback)', () => {
      assert.throws(
        () => parseDatabaseUrl(undefined),
        /DATABASE_URL is mandatory/,
        'Undefined DATABASE_URL wajib ditolak keras'
      );
      assert.throws(
        () => parseDatabaseUrl(''),
        /DATABASE_URL is mandatory/,
        'Empty DATABASE_URL wajib ditolak keras'
      );
      assert.throws(
        () => parseDatabaseUrl('   '),
        /DATABASE_URL is mandatory/,
        'Whitespace-only DATABASE_URL wajib ditolak keras'
      );
    });

    it('wajib mem-parsing format postgresql:// standar dengan benar', () => {
      const config = parseDatabaseUrl('postgresql://admin:supersecret@db.internal:5433/stq_prod?sslmode=require');
      assert.equal(config.user, 'admin');
      assert.equal(config.password, 'supersecret');
      assert.equal(config.host, 'db.internal');
      assert.equal(config.port, '5433');
      assert.equal(config.database, 'stq_prod');
      assert.equal(config.sslmode, 'require');
      assert.equal(config.isPrismaUrl, false);
    });

    it('wajib mendukung dan mem-parsing prisma+postgres:// URL', () => {
      const config = parseDatabaseUrl('prisma+postgres://prisma_user:p_pass123@accelerate.prisma-data.net:5432/postgres?sslmode=verify-full');
      assert.equal(config.user, 'prisma_user');
      assert.equal(config.password, 'p_pass123');
      assert.equal(config.host, 'accelerate.prisma-data.net');
      assert.equal(config.port, '5432');
      assert.equal(config.database, 'postgres');
      assert.equal(config.isPrismaUrl, true);
    });

    it('wajib melempar error jika URL tidak memiliki hostname valid', () => {
      assert.throws(
        () => parseDatabaseUrl('postgresql:///stq_prod'),
        /DATABASE_URL must specify a valid hostname/,
        'URL tanpa hostname wajib ditolak'
      );
    });
  });

  describe('2. Credential Redaction & Log Safety', () => {
    it('wajib menyamarkan password pada postgresql:// dan tidak pernah membocorkannya', () => {
      const secret = 'ultra_confidential_pass_99';
      const raw = `postgresql://stq_operator:${secret}@pg-primary.prod:5432/stq_db`;
      const redacted = redactDatabaseUrl(raw);

      assert.equal(redacted.includes(secret), false, 'Password tidak boleh muncul di string teredaksi');
      assert.equal(redacted.includes('stq_operator:***@pg-primary.prod:5432/stq_db'), true);
    });

    it('wajib menyamarkan password pada prisma+postgres:// dan query parameter rahasia', () => {
      const secret = 'p_secret_token_123';
      const raw = `prisma+postgres://app_user:${secret}@accelerate.prisma-data.net:5432/postgres?sslmode=require`;
      const redacted = redactDatabaseUrl(raw);

      assert.equal(redacted.includes(secret), false);
      assert.equal(redacted.startsWith('prisma+postgres://app_user:***@accelerate.prisma-data.net:5432/postgres'), true);
    });

    it('wajib aman menangani input undefined/kosong tanpa throwing', () => {
      assert.equal(redactDatabaseUrl(undefined), '[UNSET]');
      assert.equal(redactDatabaseUrl(''), '[UNSET]');
      assert.equal(redactDatabaseUrl('invalid-url-string'), '[REDACTED_INVALID_URL]');
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

      // Manipulasi mtime: oldFile 10 hari yang lalu, recentFile 1 hari yang lalu
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000);

      fs.utimesSync(oldFile, tenDaysAgo, tenDaysAgo);
      fs.utimesSync(recentFile, oneDayAgo, oneDayAgo);

      // Jalankan cleanup retensi 7 hari
      const { cleanedCount, preservedCount } = runRetentionCleanup(TEST_SCRATCH_DIR, 7, false);

      assert.equal(cleanedCount, 1, 'Hanya 1 file usang yang dibersihkan');
      assert.equal(preservedCount, 1, '1 file baru dipertahankan');
      assert.equal(fs.existsSync(oldFile), false, 'File usang harus sudah dihapus');
      assert.equal(fs.existsSync(recentFile), true, 'File baru harus tetap ada');
      assert.equal(fs.existsSync(otherFile), true, 'File yang tidak sesuai pola backup tidak boleh disentuh');
    });

    it('dalam mode dry-run tidak melakukan unlink / penghapusan fisik apapun', () => {
      const oldDryFile = path.join(TEST_SCRATCH_DIR, 'stq_backup_2026-08-01_120000.sql');
      fs.writeFileSync(oldDryFile, 'OLD CONTENT', 'utf8');
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldDryFile, twentyDaysAgo, twentyDaysAgo);

      const { cleanedCount } = runRetentionCleanup(TEST_SCRATCH_DIR, 7, true);
      assert.equal(cleanedCount, 1);
      assert.equal(fs.existsSync(oldDryFile), true, 'File usang TIDAK boleh dihapus dalam mode dry-run');
    });
  });

  describe('6. Fail-Closed on pg_dump Absence', () => {
    it('checkPgDumpAvailable menghasilkan boolean status yang valid tanpa crashing', () => {
      const check = checkPgDumpAvailable();
      assert.equal(typeof check.available, 'boolean');
      if (check.available) {
        assert.ok(check.version?.includes('pg_dump'));
      } else {
        assert.ok(check.error !== undefined);
      }
    });
  });
});
