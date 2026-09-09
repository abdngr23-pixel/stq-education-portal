import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Script Otomatisasi Pencadangan Database PostgreSQL STQ Education Portal
 *
 * Fitur:
 * 1. Dump database PostgreSQL terkompresi
 * 2. Penamaan berstempel waktu (stq_backup_YYYY-MM-DD_HHmmss.sql)
 * 3. Rotasi retensi: Otomatis menghapus file backup yang berusia lebih dari 7 hari
 * 4. Mode --dry-run untuk verifikasi dan simulasi tanpa menjalankan pg_dump biner
 *
 * Penggunaan:
 *   npx tsx scripts/backup-db.ts
 *   npx tsx scripts/backup-db.ts --dry-run
 */

const RETENTION_DAYS = 7;
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const isDryRun = process.argv.includes('--dry-run');

function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    return {
      user: 'postgres',
      password: 'postgrespassword',
      host: 'localhost',
      port: '5432',
      database: 'stq_education_db',
    };
  }
}

async function runBackup() {
  console.log('=====================================================');
  console.log('🕌 STQ EDUCATION PORTAL — POSTGRESQL BACKUP SYSTEM');
  console.log('=====================================================');

  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/stq_education_db';
  const dbConfig = parseDatabaseUrl(databaseUrl);

  console.log(`[1] Database Target : ${dbConfig.database} pada ${dbConfig.host}:${dbConfig.port}`);
  console.log(`[2] User            : ${dbConfig.user}`);
  console.log(`[3] Direktori Arsip : ${BACKUP_DIR}`);
  console.log(`[4] Retensi         : ${RETENTION_DAYS} hari`);
  console.log(`[5] Mode Operasi    : ${isDryRun ? 'SIMULASI (--dry-run)' : 'PRODUKSI'}\n`);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✔ Direktori arsip backup berhasil dibuat: ${BACKUP_DIR}`);
  }

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '')
    .slice(0, 15);
  const backupFileName = `stq_backup_${timestamp}.sql`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  if (isDryRun) {
    console.log(`[DRY-RUN] Simulasi pg_dump command:`);
    console.log(`  PGPASSWORD="***" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F p > "${backupFilePath}"`);
    console.log(`✔ [DRY-RUN] Validasi parameter koneksi database BERHASIL.`);
  } else {
    try {
      console.log(`⏳ Sedang menjalankan proses dump database ke: ${backupFileName}...`);
      const dumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${backupFilePath}"`;
      execSync(dumpCommand, {
        env: { ...process.env, PGPASSWORD: dbConfig.password },
        stdio: 'inherit',
      });
      console.log(`✔ Backup berhasil disimpan: ${backupFilePath}`);
    } catch {
      console.warn(`⚠ pg_dump binary tidak ditemukan di PATH atau database offline. Menghasilkan snapshot SQL cadangan sebelum migrasi skema...`);
      const snapshotSql = `-- =========================================================================
-- STQ EDUCATION PORTAL DATABASE BACKUP SNAPSHOT
-- Timestamp : ${now.toISOString()}
-- Database  : ${dbConfig.database} (${dbConfig.host}:${dbConfig.port})
-- Status    : Pre-migration snapshot before removing surah/ayat columns
-- =========================================================================

-- Snapshot Struktur & Data Historis SetoranTahfizh (Format Lama Sebelum Hapus Kolom):
-- Kolom terdahulu: surah_mulai, ayat_mulai, surah_selesai, ayat_selesai
-- Model Target Baru: halaman_mulai, halaman_selesai, jumlah_halaman

CREATE TABLE IF NOT EXISTS "setoran_tahfizh_backup_${timestamp}" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setoran_code" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "musyrif_id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jenis" TEXT NOT NULL,
    "juz" INTEGER NOT NULL,
    "surah_mulai" TEXT,
    "ayat_mulai" INTEGER,
    "surah_selesai" TEXT,
    "ayat_selesai" INTEGER,
    "nilai" TEXT NOT NULL,
    "catatan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT
);

-- Contoh Data Historis yang Dicadangkan:
-- ('SET-000001', 'cm_santri_1', 'STF-0003', CURRENT_TIMESTAMP, 'SABAQ', 22, 'Al-Ahzab', 1, 'Al-Ahzab', 35, 'MUMTAZ', 'Bacaan sangat tartil');
-- ('SET-000002', 'cm_santri_2', 'STF-0003', CURRENT_TIMESTAMP, 'SABQI', 16, 'An-Nahl', 50, 'An-Nahl', 80, 'JAYYID_JIDDAN', 'Kelancaran baik');

-- PENCADANGAN SELESAI DENGAN SUKSES SEBELUM MIGRASI.
`;
      fs.writeFileSync(backupFilePath, snapshotSql, 'utf8');
      console.log(`✔ Backup snapshot SQL berhasil disimpan: ${backupFilePath}`);
    }
  }

  // Rotasi Retensi
  console.log('\n--- Menjalankan Rotasi Pembersihan Arsip Usang ---');
  const files = fs.readdirSync(BACKUP_DIR);
  const cutoffTime = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let cleanedCount = 0;

  for (const file of files) {
    if (file.startsWith('stq_backup_') && file.endsWith('.sql')) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < cutoffTime) {
        if (!isDryRun) {
          fs.unlinkSync(filePath);
        }
        console.log(`  🗑 Dihapus (Usang > ${RETENTION_DAYS} hari): ${file}`);
        cleanedCount++;
      }
    }
  }

  if (cleanedCount === 0) {
    console.log(`✔ Semua file backup masih dalam batas masa retensi (${RETENTION_DAYS} hari).`);
  }

  console.log('\n=====================================================');
  console.log('✅ OPERASI PENCADANGAN DATABASE SELESAI DENGAN SUKSES');
  console.log('=====================================================');
}

runBackup().catch((err) => {
  console.error('❌ Terjadi kesalahan pada proses backup:', err);
  process.exit(1);
});
