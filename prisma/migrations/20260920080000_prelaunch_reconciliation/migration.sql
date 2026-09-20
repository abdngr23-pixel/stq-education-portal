-- AlterEnum
ALTER TYPE "StatusIzin" ADD VALUE 'DIBATALKAN';

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'SUBJECT';

-- AlterTable
ALTER TABLE "kebijakan_reward_sanksi" ALTER COLUMN "bintang_simaan" SET DEFAULT 1,
ALTER COLUMN "hak_libur_simaan_hari" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "nilai_akademik" ALTER COLUMN "guru_id" DROP NOT NULL,
ADD COLUMN "nama_pengajar_snapshot" TEXT,
ADD COLUMN "dicatat_oleh_user_id" TEXT;

-- AlterTable
ALTER TABLE "perizinan_santri" ADD COLUMN "batch_id" TEXT,
ADD COLUMN "diajukan_oleh_role" TEXT,
ADD COLUMN "diajukan_oleh_user_id" TEXT,
ADD COLUMN "returned_at" TIMESTAMP(3),
ADD COLUMN "returned_by" TEXT,
ADD COLUMN "is_late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "uses_vehicle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancelled_by" TEXT,
ADD COLUMN "cancel_reason" TEXT;

-- AlterTable
ALTER TABLE "education_sessions" ADD COLUMN "actual_teacher_name" TEXT;

-- CreateTable
CREATE TABLE "academic_subject_account_bindings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_subject_account_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_subject_account_bindings_user_id_key" ON "academic_subject_account_bindings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_subject_account_bindings_subject_id_key" ON "academic_subject_account_bindings"("subject_id");

-- CreateIndex
CREATE INDEX "nilai_akademik_dicatat_oleh_user_id_idx" ON "nilai_akademik"("dicatat_oleh_user_id");

-- CreateIndex
CREATE INDEX "perizinan_santri_batch_id_idx" ON "perizinan_santri"("batch_id");

-- AddForeignKey
ALTER TABLE "academic_subject_account_bindings" ADD CONSTRAINT "academic_subject_account_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_subject_account_bindings" ADD CONSTRAINT "academic_subject_account_bindings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "mata_pelajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai_akademik" ADD CONSTRAINT "nilai_akademik_dicatat_oleh_user_id_fkey" FOREIGN KEY ("dicatat_oleh_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
