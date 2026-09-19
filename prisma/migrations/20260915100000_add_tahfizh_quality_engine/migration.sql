-- AlterTable
ALTER TABLE "setoran_tahfizh" ADD COLUMN "nilai_tajwid" "NilaiSetoran",
ADD COLUMN "nilai_fashahah" "NilaiSetoran",
ADD COLUMN "nilai_kelancaran" "NilaiSetoran",
ADD COLUMN "rincian_kesalahan" JSONB;

-- AlterTable
ALTER TABLE "tasmi_simaan" ADD COLUMN "nilai_tajwid" "NilaiSetoran",
ADD COLUMN "nilai_fashahah" "NilaiSetoran",
ADD COLUMN "nilai_kelancaran" "NilaiSetoran",
ADD COLUMN "rincian_kesalahan" JSONB;

-- AlterTable
ALTER TABLE "ikhtibar_tahfizh" ADD COLUMN "nilai_tajwid_tahap_1" "NilaiSetoran",
ADD COLUMN "nilai_fashahah_tahap_1" "NilaiSetoran",
ADD COLUMN "nilai_kelancaran_tahap_1" "NilaiSetoran",
ADD COLUMN "rincian_kesalahan_tahap_1" JSONB,
ADD COLUMN "nilai_tajwid_tahap_2" "NilaiSetoran",
ADD COLUMN "nilai_fashahah_tahap_2" "NilaiSetoran",
ADD COLUMN "nilai_kelancaran_tahap_2" "NilaiSetoran",
ADD COLUMN "rincian_kesalahan_tahap_2" JSONB;

-- CreateTable
CREATE TABLE "evaluasi_rubu_tahfizh" (
    "id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "musyrif_id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "juz" INTEGER NOT NULL,
    "rubu_ke" INTEGER NOT NULL,
    "nilai_tajwid" "NilaiSetoran" NOT NULL,
    "nilai_fashahah" "NilaiSetoran" NOT NULL,
    "nilai_kelancaran" "NilaiSetoran" NOT NULL,
    "nilai" "NilaiSetoran" NOT NULL,
    "rincian_kesalahan" JSONB,
    "catatan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "evaluasi_rubu_tahfizh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluasi_rubu_tahfizh_santri_id_tanggal_idx" ON "evaluasi_rubu_tahfizh"("santri_id", "tanggal");

-- CreateIndex
CREATE INDEX "evaluasi_rubu_tahfizh_santri_id_juz_rubu_ke_idx" ON "evaluasi_rubu_tahfizh"("santri_id", "juz", "rubu_ke");

-- CreateIndex
CREATE INDEX "evaluasi_rubu_tahfizh_musyrif_id_idx" ON "evaluasi_rubu_tahfizh"("musyrif_id");

-- AddForeignKey
ALTER TABLE "evaluasi_rubu_tahfizh" ADD CONSTRAINT "evaluasi_rubu_tahfizh_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluasi_rubu_tahfizh" ADD CONSTRAINT "evaluasi_rubu_tahfizh_musyrif_id_fkey" FOREIGN KEY ("musyrif_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
