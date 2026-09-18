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

-- CreateTable
CREATE TABLE "health_case_v2_events" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "previous_status" "HealthStatusV2",
    "new_status" "HealthStatusV2" NOT NULL,
    "tindakan_lanjutan" TEXT,
    "catatan" TEXT,
    "recorded_by_user_id" TEXT NOT NULL,
    "recorded_by_staff_id" TEXT,
    "human_executor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_case_v2_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_cases_v2_santri_id_status_v2_idx" ON "health_cases_v2"("santri_id", "status_v2");

-- CreateIndex
CREATE INDEX "health_cases_v2_santri_id_occurred_at_idx" ON "health_cases_v2"("santri_id", "occurred_at");

-- CreateIndex
CREATE INDEX "health_cases_v2_status_v2_occurred_at_idx" ON "health_cases_v2"("status_v2", "occurred_at");

-- CreateIndex
CREATE INDEX "health_case_v2_events_case_id_created_at_idx" ON "health_case_v2_events"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "health_cases_v2" ADD CONSTRAINT "health_cases_v2_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_cases_v2" ADD CONSTRAINT "health_cases_v2_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_cases_v2" ADD CONSTRAINT "health_cases_v2_recorded_by_staff_id_fkey" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_case_v2_events" ADD CONSTRAINT "health_case_v2_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "health_cases_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_case_v2_events" ADD CONSTRAINT "health_case_v2_events_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_case_v2_events" ADD CONSTRAINT "health_case_v2_events_recorded_by_staff_id_fkey" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_case_v2_events" ADD CONSTRAINT "health_case_v2_events_human_executor_id_fkey" FOREIGN KEY ("human_executor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
