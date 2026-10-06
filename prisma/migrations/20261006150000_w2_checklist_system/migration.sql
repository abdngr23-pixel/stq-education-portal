-- CreateEnum
CREATE TYPE "ChecklistRunStatus" AS ENUM ('DRAFT', 'PERFORMED', 'UNDER_REVIEW', 'COMPLETED', 'NEEDS_CORRECTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" "OrgDomain" NOT NULL DEFAULT 'KEASRAMAAN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "target_org_unit_type" "OrgUnitType",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "schema" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_runs" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "target_unit_id" TEXT,
    "status" "ChecklistRunStatus" NOT NULL DEFAULT 'DRAFT',
    "client_request_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduled_date" TIMESTAMP(3),
    "performed_at" TIMESTAMP(3),
    "performed_by_id" TEXT,
    "checked_at" TIMESTAMP(3),
    "checked_by_id" TEXT,
    "notes" TEXT,
    "correction_notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "photo_url" TEXT,
    "checked_status" "ChecklistItemStatus",
    "checked_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_templates_code_key" ON "checklist_templates"("code");

-- CreateIndex
CREATE INDEX "checklist_templates_domain_is_active_idx" ON "checklist_templates"("domain", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_runs_client_request_id_key" ON "checklist_runs"("client_request_id");

-- CreateIndex
CREATE INDEX "checklist_runs_template_id_status_idx" ON "checklist_runs"("template_id", "status");

-- CreateIndex
CREATE INDEX "checklist_runs_target_unit_id_status_idx" ON "checklist_runs"("target_unit_id", "status");

-- CreateIndex
CREATE INDEX "checklist_runs_client_request_id_idx" ON "checklist_runs"("client_request_id");

-- CreateIndex
CREATE INDEX "checklist_items_run_id_idx" ON "checklist_items"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_run_id_item_key_key" ON "checklist_items"("run_id", "item_key");

-- AddForeignKey
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_target_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "checklist_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
