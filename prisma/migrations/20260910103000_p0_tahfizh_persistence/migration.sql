-- Migration aditif untuk P0 Tahfizh Persistence
-- Menambahkan baseline modal hafalan santri dan proteksi idempotency setoran tahfizh

-- 1. Tambah kolom baseline modal hafalan pada santri
ALTER TABLE "santri" ADD COLUMN IF NOT EXISTS "modal_hafalan_awal_halaman" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "santri" ADD COLUMN IF NOT EXISTS "tanggal_baseline_tahfizh" TIMESTAMP(3);

-- 2. Tambah kolom idempotency dan status pembatalan pada setoran_tahfizh
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "client_request_id" TEXT;
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'AKTIF';
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "alasan_pembatalan" TEXT;
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "dibatalkan_at" TIMESTAMP(3);
ALTER TABLE "setoran_tahfizh" ADD COLUMN IF NOT EXISTS "dibatalkan_by" TEXT;

-- 3. Tambah unique index dan index status
CREATE UNIQUE INDEX IF NOT EXISTS "setoran_tahfizh_client_request_id_key" ON "setoran_tahfizh"("client_request_id");
CREATE INDEX IF NOT EXISTS "setoran_tahfizh_status_idx" ON "setoran_tahfizh"("status");
