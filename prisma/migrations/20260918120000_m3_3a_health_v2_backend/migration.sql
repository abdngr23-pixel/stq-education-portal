-- CreateEnum
CREATE TYPE "HealthStatusV2" AS ENUM ('DIPANTAU', 'PULIH', 'DIRUJUK', 'DARURAT');

-- CreateTable
CREATE TABLE "health_cases_v2" (
    "id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "keluhan" TEXT NOT NULL,
    "tindakan_awal" TEXT NOT NULL,
    "diagnosa" TEXT,
    "catatan" TEXT,
    "attachment_url" TEXT,
    "status_v2" "HealthStatusV2" NOT NULL,
    "recorded_by_user_id" TEXT NOT NULL,
    "recorded_by_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_cases_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_cases_v2_santri_id_status_v2_idx" ON "health_cases_v2"("santri_id", "status_v2");

-- CreateIndex
CREATE INDEX "health_cases_v2_santri_id_occurred_at_idx" ON "health_cases_v2"("santri_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "health_cases_v2" ADD CONSTRAINT "health_cases_v2_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
