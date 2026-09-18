-- CreateEnum
CREATE TYPE "EducationTrack" AS ENUM ('STUDI_UMUM', 'KEPESANTRENAN');

-- CreateEnum
CREATE TYPE "PedagogicalLevel" AS ENUM ('TINGKAT_1', 'TINGKAT_2', 'TINGKAT_3');

-- CreateEnum
CREATE TYPE "EducationSessionStatus" AS ENUM ('SCHEDULED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EducationAttendanceStatus" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'ALFA');

-- AlterTable
ALTER TABLE "santri" ADD COLUMN "cohort_id" TEXT;

-- CreateTable
CREATE TABLE "education_cohorts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tahun_ajaran_masuk" TEXT NOT NULL,
    "start_year" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" TEXT NOT NULL,
    "mapel_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "education_track" "EducationTrack" NOT NULL,
    "gender_complex" "GenderComplex" NOT NULL,
    "pedagogical_level" "PedagogicalLevel",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_sessions" (
    "id" TEXT NOT NULL,
    "education_track" "EducationTrack" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "planned_start_time" TEXT,
    "planned_end_time" TEXT,
    "cohort_id" TEXT,
    "program_level" INTEGER,
    "gender_group" "GenderComplex",
    "jp" INTEGER,
    "semester_meeting_number" INTEGER,
    "pbl_phase" TEXT,
    "pbl_block_number" INTEGER,
    "scheduled_teacher_assignment_id" TEXT,
    "scheduled_staff_id" TEXT,
    "actual_teacher_user_id" TEXT,
    "actual_teacher_staff_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "EducationSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "materi" TEXT,
    "materi_recorded_at" TIMESTAMP(3),
    "materi_recorded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_session_attendances" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "status" "EducationAttendanceStatus" NOT NULL,
    "note" TEXT,
    "recorded_by_user_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_session_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "education_cohorts_code_key" ON "education_cohorts"("code");

-- CreateIndex
CREATE INDEX "education_cohorts_start_year_idx" ON "education_cohorts"("start_year");

-- CreateIndex
CREATE INDEX "education_cohorts_is_active_idx" ON "education_cohorts"("is_active");

-- CreateIndex
CREATE INDEX "teaching_assignments_mapel_id_idx" ON "teaching_assignments"("mapel_id");

-- CreateIndex
CREATE INDEX "teaching_assignments_staff_id_idx" ON "teaching_assignments"("staff_id");

-- CreateIndex
CREATE INDEX "teaching_assignments_education_track_idx" ON "teaching_assignments"("education_track");

-- CreateIndex
CREATE INDEX "teaching_assignments_gender_complex_idx" ON "teaching_assignments"("gender_complex");

-- CreateIndex
CREATE INDEX "teaching_assignments_is_active_idx" ON "teaching_assignments"("is_active");

-- CreateIndex
CREATE INDEX "education_sessions_education_track_idx" ON "education_sessions"("education_track");

-- CreateIndex
CREATE INDEX "education_sessions_subject_id_idx" ON "education_sessions"("subject_id");

-- CreateIndex
CREATE INDEX "education_sessions_scheduled_date_idx" ON "education_sessions"("scheduled_date");

-- CreateIndex
CREATE INDEX "education_sessions_cohort_id_idx" ON "education_sessions"("cohort_id");

-- CreateIndex
CREATE INDEX "education_sessions_status_idx" ON "education_sessions"("status");

-- CreateIndex
CREATE INDEX "education_sessions_scheduled_staff_id_idx" ON "education_sessions"("scheduled_staff_id");

-- CreateIndex
CREATE INDEX "education_sessions_actual_teacher_user_id_idx" ON "education_sessions"("actual_teacher_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "education_session_attendances_session_id_santri_id_key" ON "education_session_attendances"("session_id", "santri_id");

-- CreateIndex
CREATE INDEX "education_session_attendances_session_id_idx" ON "education_session_attendances"("session_id");

-- CreateIndex
CREATE INDEX "education_session_attendances_santri_id_idx" ON "education_session_attendances"("santri_id");

-- CreateIndex
CREATE INDEX "education_session_attendances_status_idx" ON "education_session_attendances"("status");

-- CreateIndex
CREATE INDEX "santri_cohort_id_idx" ON "santri"("cohort_id");

-- AddForeignKey
ALTER TABLE "santri" ADD CONSTRAINT "santri_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "education_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_mapel_id_fkey" FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajaran"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "mata_pelajaran"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "education_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_scheduled_teacher_assignment_id_fkey" FOREIGN KEY ("scheduled_teacher_assignment_id") REFERENCES "teaching_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_scheduled_staff_id_fkey" FOREIGN KEY ("scheduled_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_actual_teacher_user_id_fkey" FOREIGN KEY ("actual_teacher_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_actual_teacher_staff_id_fkey" FOREIGN KEY ("actual_teacher_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_sessions" ADD CONSTRAINT "education_sessions_materi_recorded_by_user_id_fkey" FOREIGN KEY ("materi_recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_session_attendances" ADD CONSTRAINT "education_session_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "education_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_session_attendances" ADD CONSTRAINT "education_session_attendances_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_session_attendances" ADD CONSTRAINT "education_session_attendances_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "education_session_participants" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "education_session_participants_session_id_santri_id_key" ON "education_session_participants"("session_id", "santri_id");

-- CreateIndex
CREATE INDEX "education_session_participants_session_id_idx" ON "education_session_participants"("session_id");

-- CreateIndex
CREATE INDEX "education_session_participants_santri_id_idx" ON "education_session_participants"("santri_id");

-- AddForeignKey
ALTER TABLE "education_session_participants" ADD CONSTRAINT "education_session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "education_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_session_participants" ADD CONSTRAINT "education_session_participants_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
