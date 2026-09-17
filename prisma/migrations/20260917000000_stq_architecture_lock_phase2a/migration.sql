-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('INSTITUTION', 'DOMAIN', 'ORGANIZATION', 'DIVISION', 'HALAQOH', 'KAMAR', 'SERVICE_UNIT', 'USROH', 'ACADEMIC_CLASS');

-- CreateEnum
CREATE TYPE "OrgDomain" AS ENUM ('INSTITUTIONAL', 'TAHFIZH', 'KEASRAMAAN', 'AKADEMIK', 'MANAJEMEN');

-- CreateEnum
CREATE TYPE "CapabilityNamespace" AS ENUM ('TAHFIZH', 'KEASRAMAAN', 'HEALTH', 'ACADEMIC', 'LOGISTICS', 'FINANCE', 'LETTERS', 'SPONSOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BusinessRuleState" AS ENUM ('VERIFIED_PRODUCTION', 'APPROVED_TARGET_PENDING_TECHNICAL', 'PROPOSED_TBD');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('GLOBAL', 'DOMAIN', 'UNIT', 'ASSIGNED_UNITS', 'HALAQOH', 'KAMAR', 'OWN_CHILD', 'SELF');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'UNIT');

-- CreateEnum
CREATE TYPE "GenderComplex" AS ENUM ('PUTRA', 'PUTRI', 'CAMPUR', 'TIDAK_TERIKAT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'PERSONAL';

-- CreateTable
CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgUnitType" NOT NULL,
    "domain" "OrgDomain" NOT NULL,
    "parent_id" TEXT,
    "gender_complex" "GenderComplex" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" "OrgDomain" NOT NULL,
    "allowed_unit_types" "OrgUnitType"[] DEFAULT ARRAY[]::"OrgUnitType"[],
    "is_leadership" BOOLEAN NOT NULL DEFAULT false,
    "requires_personal_account" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_account_placements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_account_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilities" (
    "code" TEXT NOT NULL,
    "namespace" "CapabilityNamespace" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_dangerous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "position_capabilities" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "capability_code" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "business_rule_state" "BusinessRuleState" NOT NULL DEFAULT 'PROPOSED_TBD',

    CONSTRAINT "position_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_scope_units" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_scope_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_audit_logs" (
    "id" TEXT NOT NULL,
    "technical_account_id" TEXT NOT NULL,
    "technical_account_username" TEXT NOT NULL,
    "human_executor_id" TEXT,
    "human_executor_name" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "capability_code" TEXT NOT NULL,
    "assignment_id" TEXT,
    "position_code" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "unit_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "resource_context" JSONB,
    "reason" TEXT,
    "client_request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_units_code_key" ON "org_units"("code");

-- CreateIndex
CREATE INDEX "org_units_domain_type_idx" ON "org_units"("domain", "type");

-- CreateIndex
CREATE INDEX "org_units_parent_id_idx" ON "org_units"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_account_placements_user_id_key" ON "unit_account_placements"("user_id");

-- CreateIndex
CREATE INDEX "unit_account_placements_unit_id_idx" ON "unit_account_placements"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_capabilities_position_id_capability_code_key" ON "position_capabilities"("position_id", "capability_code");

-- CreateIndex
CREATE INDEX "assignments_user_id_status_idx" ON "assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "assignments_unit_id_status_idx" ON "assignments"("unit_id", "status");

-- CreateIndex
CREATE INDEX "assignments_position_id_status_idx" ON "assignments"("position_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_scope_units_assignment_id_unit_id_key" ON "assignment_scope_units"("assignment_id", "unit_id");

-- CreateIndex
CREATE INDEX "canonical_audit_logs_technical_account_id_idx" ON "canonical_audit_logs"("technical_account_id");

-- CreateIndex
CREATE INDEX "canonical_audit_logs_human_executor_id_idx" ON "canonical_audit_logs"("human_executor_id");

-- CreateIndex
CREATE INDEX "canonical_audit_logs_action_idx" ON "canonical_audit_logs"("action");

-- CreateIndex
CREATE INDEX "canonical_audit_logs_created_at_idx" ON "canonical_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_account_placements" ADD CONSTRAINT "unit_account_placements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_account_placements" ADD CONSTRAINT "unit_account_placements_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_capabilities" ADD CONSTRAINT "position_capabilities_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_capabilities" ADD CONSTRAINT "position_capabilities_capability_code_fkey" FOREIGN KEY ("capability_code") REFERENCES "capabilities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_scope_units" ADD CONSTRAINT "assignment_scope_units_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_scope_units" ADD CONSTRAINT "assignment_scope_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
