-- =========================================================================
-- MIGRATION AUDIT TRAIL: SETORAN TAHFIZH PAGE-BASED ARCHITECTURE
-- Path: prisma/migrations/20260910083000_setoran_tahfizh_page_based/migration.sql
-- Description: Safe additive migration ensuring pure page-based columns in setoran_tahfizh
-- =========================================================================

-- 1. Pastikan kolom berbasis halaman ada (halaman_mulai, halaman_selesai, jumlah_halaman)
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "halaman_mulai" INTEGER;
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "halaman_selesai" INTEGER;
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "jumlah_halaman" DOUBLE PRECISION;

-- 2. Backfill aman jika ada data lama dengan nilai default
UPDATE "setoran_tahfizh" SET "halaman_mulai" = 1 WHERE "halaman_mulai" IS NULL;
UPDATE "setoran_tahfizh" SET "halaman_selesai" = 1 WHERE "halaman_selesai" IS NULL;
UPDATE "setoran_tahfizh" SET "jumlah_halaman" = 1.0 WHERE "jumlah_halaman" IS NULL;

-- 3. Terapkan NOT NULL setelah data divalidasi
ALTER TABLE "setoran_tahfizh" ALTER COLUMN "halaman_mulai" SET NOT NULL;
ALTER TABLE "setoran_tahfizh" ALTER COLUMN "halaman_selesai" SET NOT NULL;
ALTER TABLE "setoran_tahfizh" ALTER COLUMN "jumlah_halaman" SET NOT NULL;

-- 4. Indeks kinerja untuk query setoran
CREATE INDEX IF NOT EXISTS "setoran_tahfizh_santri_id_tanggal_idx" ON "setoran_tahfizh"("santri_id", "tanggal");
CREATE INDEX IF NOT EXISTS "setoran_tahfizh_musyrif_id_idx" ON "setoran_tahfizh"("musyrif_id");
CREATE INDEX IF NOT EXISTS "setoran_tahfizh_jenis_idx" ON "setoran_tahfizh"("jenis");
