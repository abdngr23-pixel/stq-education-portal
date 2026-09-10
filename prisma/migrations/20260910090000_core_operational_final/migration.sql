-- =========================================================================
-- MIGRATION AUDIT TRAIL: CORE OPERATIONAL FEATURES & SAFE CONNECTIVITY
-- Migration: 20260910090000_core_operational_final
-- Target: STQ Darul Ulum Cendekia (PostgreSQL Production)
-- Principle: STRICTLY ADDITIVE & NON-DESTRUCTIVE
-- =========================================================================

-- 1. Pastikan kolom is_petugas_presensi_putri ada pada tabel users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_petugas_presensi_putri" BOOLEAN DEFAULT false;

-- 2. Pastikan kolom target_akhir_program_juz ada pada tabel santri
ALTER TABLE "santri" ADD COLUMN IF NOT EXISTS "target_akhir_program_juz" INTEGER DEFAULT 30;

-- 3. Pastikan tabel catatan_mutabaah_harian ada dengan batasan unik
CREATE TABLE IF NOT EXISTS "catatan_mutabaah_harian" (
    "id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "kategori" "KategoriCapaian" NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nilai" DOUBLE PRECISION NOT NULL,
    "catatan" TEXT,
    "dicatat_oleh" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catatan_mutabaah_harian_pkey" PRIMARY KEY ("id")
);

-- Indeks dan Constraint Unik untuk Mutaba'ah Harian
CREATE UNIQUE INDEX IF NOT EXISTS "catatan_mutabaah_harian_santri_id_kategori_tanggal_key" 
ON "catatan_mutabaah_harian"("santri_id", "kategori", "tanggal");

CREATE INDEX IF NOT EXISTS "catatan_mutabaah_harian_santri_id_tanggal_idx" 
ON "catatan_mutabaah_harian"("santri_id", "tanggal");

-- Foreign key aman dengan CASCADE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'catatan_mutabaah_harian_santri_id_fkey'
    ) THEN
        ALTER TABLE "catatan_mutabaah_harian" 
        ADD CONSTRAINT "catatan_mutabaah_harian_santri_id_fkey" 
        FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Pastikan tabel kebijakan_reward_sanksi ada
CREATE TABLE IF NOT EXISTS "kebijakan_reward_sanksi" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL DEFAULT 'Kebijakan Standar Pesantren',
    "min_nilai_tasmi" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "min_nilai_simaan" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "bintang_tasmi" INTEGER NOT NULL DEFAULT 1,
    "bintang_simaan" INTEGER NOT NULL DEFAULT 2,
    "hak_libur_tasmi_hari" INTEGER NOT NULL DEFAULT 1,
    "hak_libur_simaan_hari" INTEGER NOT NULL DEFAULT 2,
    "min_persen_target_bulanan" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "durasi_kehilangan_kunjungan_hari" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kebijakan_reward_sanksi_pkey" PRIMARY KEY ("id")
);

-- 5. Pastikan tabel finalisasi_bulanan_santri ada
CREATE TABLE IF NOT EXISTS "finalisasi_bulanan_santri" (
    "id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun_ajaran" TEXT NOT NULL,
    "target_halaman" DOUBLE PRECISION NOT NULL,
    "capaian_halaman" DOUBLE PRECISION NOT NULL,
    "persentase" DOUBLE PRECISION NOT NULL,
    "is_tercapai" BOOLEAN NOT NULL,
    "status_sanksi_kunjungan" "StatusSanksiKunjungan" NOT NULL DEFAULT 'BEBAS',
    "tanggal_mulai_sanksi" TIMESTAMP(3),
    "tanggal_selesai_sanksi" TIMESTAMP(3),
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "alasan_override" TEXT,
    "difinalisasi_oleh_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "finalisasi_bulanan_santri_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finalisasi_bulanan_santri_santri_id_bulan_tahun_ajaran_key" 
ON "finalisasi_bulanan_santri"("santri_id", "bulan", "tahun_ajaran");

CREATE INDEX IF NOT EXISTS "finalisasi_bulanan_santri_bulan_tahun_ajaran_idx" 
ON "finalisasi_bulanan_santri"("bulan", "tahun_ajaran");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'finalisasi_bulanan_santri_santri_id_fkey'
    ) THEN
        ALTER TABLE "finalisasi_bulanan_santri" 
        ADD CONSTRAINT "finalisasi_bulanan_santri_santri_id_fkey" 
        FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
