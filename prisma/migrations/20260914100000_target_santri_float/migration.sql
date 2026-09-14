-- Migration aditif non-destruktif untuk target santri pecahan 0.5
-- Mengubah tipe kolom target_pekanan dan target_bulanan menjadi DOUBLE PRECISION
ALTER TABLE "target_santri" ALTER COLUMN "target_pekanan" TYPE DOUBLE PRECISION USING "target_pekanan"::DOUBLE PRECISION;
ALTER TABLE "target_santri" ALTER COLUMN "target_bulanan" TYPE DOUBLE PRECISION USING "target_bulanan"::DOUBLE PRECISION;
