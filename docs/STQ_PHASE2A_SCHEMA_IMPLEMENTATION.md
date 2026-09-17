# STQ ARCHITECTURE LOCK — PHASE 2A SCHEMA IMPLEMENTATION REPORT
**Additive Database Schema Implementation & Deterministic Local Migration Validation**  
**Repository**: `abdngr23-pixel/stq-education-portal`  
**Baseline `main` Commit**: `49b0796af5b4ebafb3006d036dd65206c0d149e4`  
**Working Branch**: `architecture/stq-lock-phase2a-schema`  
**Architecture Status**: `ARCHITECTURE_LOCKED` (Approved Baseline Date: 2026-09-17)  
**PR #8 Integrity**: Untouched (`HEAD 9068cae5587b7219c394c5c25bf0de07a15b0726`)

---

## 1. Executive Summary & Purpose

Phase 2A implements the pure additive database and Prisma schema foundation defined by the **STQ Architecture Lock Phase 1** master specification. 

This phase establishes the relational schema primitives in `prisma/schema.prisma` and generates the official additive migration (`20260917000000_stq_architecture_lock_phase2a`). It validates schema integrity, client generation, and deterministic migration execution against disposable local/test PostgreSQL instances without mutating production data or switching runtime authorization.

---

## 2. Additive Schema Specification

### 2.1. Canonical PostgreSQL Enums Added (8 Enums)

| Enum Name | Canonical Values | Fail-Closed / Architectural Semantics |
| :--- | :--- | :--- |
| `OrgUnitType` | `INSTITUTION`, `DOMAIN`, `ORGANIZATION`, `DIVISION`, `HALAQOH`, `KAMAR`, `SERVICE_UNIT`, `USROH`, `ACADEMIC_CLASS` | Categorizes structural pesantren units into the 9 canonical tiers. |
| `OrgDomain` | `INSTITUTIONAL`, `TAHFIZH`, `KEASRAMAAN`, `AKADEMIK`, `MANAJEMEN` | Top-level organizational domains. Poskestren and TKS are structurally under `KEASRAMAAN`. |
| `CapabilityNamespace` | `TAHFIZH`, `KEASRAMAAN`, `HEALTH`, `ACADEMIC`, `LOGISTICS`, `FINANCE`, `LETTERS`, `SPONSOR`, `SYSTEM` | Functional namespaces decoupled from structural organizational domains. |
| `BusinessRuleState` | `VERIFIED_PRODUCTION`, `APPROVED_TARGET_PENDING_TECHNICAL`, `PROPOSED_TBD` | Governs authorization authority. Defaults fail-closed to `PROPOSED_TBD`. |
| `ScopeType` | `GLOBAL`, `DOMAIN`, `UNIT`, `ASSIGNED_UNITS`, `HALAQOH`, `KAMAR`, `OWN_CHILD`, `SELF` | Authorization scope taxonomy. Mandatory on `PositionCapability`; **NO default**. |
| `AssignmentStatus` | `DRAFT`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED` | Operational assignment lifecycle. Defaults fail-closed to `DRAFT` (zero authority). |
| `AccountType` | `PERSONAL`, `UNIT` | Account model discriminator. Added to `User`; defaults to `PERSONAL`. |
| `GenderComplex` | `PUTRA`, `PUTRI`, `CAMPUR`, `TIDAK_TERIKAT` | Physical and boundary complex. Mandatory on `OrgUnit`; **NO default**. |

### 2.2. Existing Model Update: `User` Table

An additive column and relations were introduced onto the existing `User` model (`users` table):
- `accountType AccountType @default(PERSONAL) @map("account_type")`: Non-null column with default `'PERSONAL'`. Automatically classifies all existing users safely as personal accounts without username heuristics.
- `assignments Assignment[]`: Relation to operational assignments.
- `unitPlacement UnitAccountPlacement?`: Relation to unit kiosk placements (strictly 1:1 via `@unique` on `user_id`).

### 2.3. New Core Relational Models Added (8 Tables)

1. **`OrgUnit` (`org_units`)**:
   - `id`: `String @id @default(cuid())`
   - `code`: `String @unique` (e.g., `OU-TAF-001`)
   - `name`: `String`
   - `type`: `OrgUnitType`
   - `domain`: `OrgDomain`
   - `parentId`: `String? @map("parent_id")`
   - `parent`: `OrgUnit? @relation("OrgUnitHierarchy", fields: [parentId], references: [id], onDelete: Restrict)`
   - `genderComplex`: `GenderComplex @map("gender_complex")` (**NO default**; omission rejected)
   - `isActive`: `Boolean @default(true) @map("is_active")`
   - `metadata`: `Json? @map("metadata")`
   - Indexes: `[domain, type]`, `[parentId]`

2. **`Position` (`positions`)**:
   - `id`: `String @id @default(cuid())`
   - `code`: `String @unique` (e.g., `KABID_TAHFIZH`, `MUDABBIR`)
   - `name`: `String`
   - `domain`: `OrgDomain`
   - `allowedUnitTypes`: `OrgUnitType[] @default([]) @map("allowed_unit_types")`
   - `isLeadership`: `Boolean @default(false) @map("is_leadership")`
   - `requiresPersonalAccount`: `Boolean @default(true) @map("requires_personal_account")`
   - `isActive`: `Boolean @default(true) @map("is_active")`
   - `description`: `String?`

3. **`UnitAccountPlacement` (`unit_account_placements`)**:
   - `id`: `String @id @default(cuid())`
   - `userId`: `String @unique @map("user_id")` (strictly enforces 1 placement per unit account)
   - `unitId`: `String @map("unit_id")`
   - Foreign Keys: `userId -> users(id) ON DELETE RESTRICT`, `unitId -> org_units(id) ON DELETE RESTRICT`
   - Indexes: `[unitId]`

4. **`Capability` (`capabilities`)**:
   - `code`: `String @id` (e.g., `tahfizh.reward.issue`)
   - `namespace`: `CapabilityNamespace`
   - `name`: `String`
   - `description`: `String`
   - `isDangerous`: `Boolean @default(false) @map("is_dangerous")`

5. **`PositionCapability` (`position_capabilities`)**:
   - `id`: `String @id @default(cuid())`
   - `positionId`: `String @map("position_id")`
   - `capabilityCode`: `String @map("capability_code")`
   - `scopeType`: `ScopeType @map("scope_type")` (**NO default**; mandatory security policy)
   - `businessRuleState`: `BusinessRuleState @default(PROPOSED_TBD) @map("business_rule_state")`
   - Unique Constraint: `@@unique([positionId, capabilityCode])`
   - Foreign Keys: `positionId -> positions(id) ON DELETE RESTRICT`, `capabilityCode -> capabilities(code) ON DELETE RESTRICT`

6. **`Assignment` (`assignments`)**:
   - `id`: `String @id @default(cuid())`
   - `userId`: `String @map("user_id")`
   - `positionId`: `String @map("position_id")`
   - `unitId`: `String @map("unit_id")`
   - `status`: `AssignmentStatus @default(DRAFT)` (defaults fail-closed to `DRAFT`)
   - `validFrom`: `DateTime @default(now()) @map("valid_from")`
   - `validUntil`: `DateTime? @map("valid_until")`
   - `notes`: `String?`
   - `createdById`: `String @map("created_by_id")`
   - Foreign Keys: `userId -> users(id) ON DELETE RESTRICT`, `positionId -> positions(id) ON DELETE RESTRICT`, `unitId -> org_units(id) ON DELETE RESTRICT`
   - Indexes: `[userId, status]`, `[unitId, status]`, `[positionId, status]`

7. **`AssignmentScopeUnit` (`assignment_scope_units`)**:
   - `id`: `String @id @default(cuid())`
   - `assignmentId`: `String @map("assignment_id")`
   - `unitId`: `String @map("unit_id")`
   - Unique Constraint: `@@unique([assignmentId, unitId])`
   - Foreign Keys: `assignmentId -> assignments(id) ON DELETE CASCADE`, `unitId -> org_units(id) ON DELETE RESTRICT`

8. **`CanonicalAuditLog` (`canonical_audit_logs`)**:
   - Immutable forensic audit snapshot with 20 columns capturing technical account, human executor, capability code, assignment ID, position code, scope type, unit ID, before/after states, resource context, and request metadata.
   - Indexes: `[technicalAccountId]`, `[humanExecutorId]`, `[action]`, `[createdAt]`

---

## 3. Migration Details & Manual SQL Risk Review

### 3.1. Migration Artifact
- **Path**: `prisma/migrations/20260917000000_stq_architecture_lock_phase2a/migration.sql`
- **Type**: Pure Additive DDL.

### 3.2. Manual SQL Risk Review Checklist
- **Destructive ALTER / DROP**: ZERO. No tables, columns, or legacy enums dropped or renamed.
- **Table Rewrites**: None. Adding `account_type "AccountType" NOT NULL DEFAULT 'PERSONAL'` in PostgreSQL 11+ is an instant catalog metadata operation without full table rewrite.
- **Cascade Deletion Risk**: `Position`, `OrgUnit`, and `User` foreign keys to assignments and placements are strictly `ON DELETE RESTRICT`, preserving historical assignment records against accidental cascade deletion. Only `assignment_scope_units` cascades when an `assignment` is deliberately deleted.
- **Data Deletion**: 0 rows deleted or modified.
- **Nullability Risk**: `account_type` has a safe default (`DEFAULT 'PERSONAL'`), ensuring non-null compliance for all existing and future user records.

---

## 4. Local & Test Database Validation

1. **`npx prisma validate`**: Succeeded. Schema is syntactically valid and relationally sound.
2. **`npx prisma generate`**: Succeeded. Prisma Client v6.19.3 generated with full type coverage for all 8 enums and 8 models.
3. **Isolated Migration Chain Verification**:
   - Tested on fresh isolated temporary PostgreSQL cluster via `runIsolatedMigrationChainVerification()`.
   - Result: All 6 migrations applied successfully from pre-Prisma baseline, 0 failed, database schema up to date.
4. **Contract Verification**:
   - 66/66 tests passed across 19 suites in `tests/architecture-lock-contracts.test.ts`, including 14 dedicated structural and isolated execution tests in Suite 18.
5. **Full Repository Tests**:
   - All 780 tests in 198 suites passing cleanly (100% pass, 0 failures).
6. **Next.js Production Build**:
   - Turbopack compilation succeeded with zero TypeScript and zero ESLint errors.

---

## 5. Existing-Data Upgrade Validation

To prove that the additive migration does not perturb pre-existing production/main data, an isolated upgrade validation (`runIsolatedExistingDataUpgradeVerification()`) was executed against a disposable PostgreSQL instance:

### 5.1. Validation Flow
1. **Isolated Schema Creation**: Empty temporary PostgreSQL instance initialized with pre-Phase 2A baseline schema (`tests/fixtures/baseline_schema.prisma`).
2. **Main Chain Applied**: Migrations 1 through 5 from `main` applied sequentially:
   - `20260910083000_setoran_tahfizh_page_based`
   - `20260910090000_core_operational_final`
   - `20260910103000_p0_tahfizh_persistence`
   - `20260914100000_target_santri_float`
   - `20260914170000_add_jumlah_juz_mufar`
3. **Pre-Existing Legacy Rows Inserted**:
   - Master data: 1 Staff (`Ustadz Ahmad Mudir`, `role_staff: KS`) and 1 Santri (`Abdullah Santri`, `SAN-UPG-001`).
   - 5 Legacy Users across diverse operational roles inserted using the legacy schema *before* `account_type` column exists:
     * `usr-adm-1` (`admin_legacy`, `role: ADM`)
     * `usr-ks-1` (`mudir_legacy`, `role: KS`, linked to staff)
     * `usr-mk-1` (`musyrif_legacy`, `role: MK`)
     * `usr-st-1` (`santri_legacy`, `role: ST`, linked to santri)
     * `usr-ws-1` (`wali_legacy`, `role: WS`)
4. **Pre-Migration Fingerprinting**:
   - Verified that `account_type` column did not exist in PostgreSQL catalog `information_schema.columns`.
   - Fingerprinted all legacy user attributes: `id`, `username`, `email`, `phone`, `password_hash`, `role`, `status`, `staff_id`, `santri_id`.
5. **Phase 2A Additive Migration Applied**:
   - Applied `20260917000000_stq_architecture_lock_phase2a/migration.sql`.
6. **Post-Migration Assertions Verified**:
   - **Legacy Rows Preserved**: Exactly 5 legacy users remain; all IDs, usernames, password hashes, roles, statuses, and relations are 100% identical before and after migration.
   - **Account Type Assigned**: Every pre-existing user received `account_type = PERSONAL` via column default.
   - **Zero Auto-Created Authority**:
     * `assignments`: 0 rows
     * `position_capabilities`: 0 rows
     * `org_units`: 0 rows
     * `positions`: 0 rows
     * `unit_account_placements`: 0 rows
     * `assignment_scope_units`: 0 rows
     * `canonical_audit_logs`: 0 rows
     * `capabilities`: 0 rows
   - Zero `ACTIVE` authority and zero `VERIFIED_PRODUCTION` grants created.

---

## 6. Production Migration-History Precondition

Current `main` migration chain does **NOT** contain the immutable PR #8 migration:
`20260915100000_add_tahfizh_quality_engine`

While PR #8 records that migration as having been applied to the production database previously, the canonical `main` branch only tracks migrations 1 through 5, and Phase 2A introduces migration 6 (`20260917000000_stq_architecture_lock_phase2a`).

### Explicit Deployment Preconditions:
1. **Phase 2A has NOT been applied to production**: `production migrations = 0`, `production seeds = 0`, `production writes = 0`.
2. **Mandatory Read-Only Reconciliation**: Before any future `prisma migrate deploy` to production, migration-history reconciliation must be independently checked.
3. **Catalog Inspection**: Production `_prisma_migrations` table and repository migration directories must be compared **READ-ONLY**.
4. **Zero Blind Re-Execution**: An already-applied migration must **NEVER** be re-run blindly against production.
5. **PR #8 Absolute Immutability**: Branch `review/tahfizh-quality-evaluation` (`9068cae5587b7219c394c5c25bf0de07a15b0726`) must remain completely untouched.
6. **No Reconciliation in Phase 2A**: No migration history reconciliation is performed in Phase 2A; this phase provides pure additive schema definition only.
7. **Separate Explicit Approval Required**: A separate explicit written approval is strictly required before any future production migration execution.

---

## 7. Production-Equivalent Isolated Simulation

To simulate the exact production condition where the PR #8 migration was previously executed, an isolated test simulation (`runIsolatedProductionEquivalentSimulation()`) was conducted:

- **Simulation Flow**:
  1. Temporary isolated PostgreSQL instance initialized with baseline schema (`tests/fixtures/baseline_schema.prisma`).
  2. Main migrations 1 through 5 applied in sequence.
  3. **Fail-Closed Verification of PR #8 Exact SHA**: Commit SHA `9068cae5587b7219c394c5c25bf0de07a15b0726` verified directly from git object store (with shallow clone fetch fallback).
  4. PR #8 migration SQL (`20260915100000_add_tahfizh_quality_engine`) fetched **in-memory** via `git show 9068cae5587b7219c394c5c25bf0de07a15b0726:prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql` (2,334 bytes) and applied cleanly.
  5. Phase 2A migration (`20260917000000_stq_architecture_lock_phase2a`) applied directly on top of the PR #8 schema.
- **Fail-Closed Contract & Verification**:
  * Unconditional assertion of:
    - `baselineApplied === true`
    - `pr8MigrationFetched === true`
    - `pr8ExactShaVerified === true`
    - `pr8MigrationBytes > 1000` (actual: 2,334 bytes)
    - `pr8MigrationApplied === true`
    - `phase2aMigrationApplied === true`
    - `hasPr8Table === true` (`evaluasi_rubu_tahfizh` exists)
    - `hasCanonicalTables === true` (`org_units`, `assignments` exist)
    - `simulationSuccess === true` (no conditional skipping or fallback)
  * Both PR #8 tables (`evaluasi_rubu_tahfizh`) and Phase 2A tables (`org_units`, `positions`, `assignments`, etc.) co-exist cleanly with zero SQL errors or schema conflicts.
- **Safety Boundary**: PR #8 files were **NEVER** committed, cherry-picked, or merged into PR #15.
- **Simulation Status**: **RUN AND PASSED** (Automated unconditionally in `tests/architecture-lock-contracts.test.ts` test 18.14).

---

## 8. Rollback & Recreate Strategy

In accordance with Phase 2A operational safety governance:

### 8.1. For Local & Test Environments
- Disposable database or test schema may be safely dropped:
  ```bash
  # Drop and recreate isolated test database
  dropdb stq_test && createdb stq_test
  # Re-apply complete migration chain
  npx prisma migrate deploy
  # Re-run quality gates
  npm test
  ```

### 8.2. For Production Environments
- **Zero Production Rollback in Phase 2A**: Because Phase 2A production migration count = 0, no rollback is executed or required.
- **No Casual Destructive Rollback**: Destructive rollback scripts (e.g. dropping tables or removing columns) must never be prepared or executed casually.
- **Future Production Deployment Prerequisites**:
  * Mandatory full database snapshot/backup immediately prior to deployment.
  * Explicit read-only verification of `_prisma_migrations` against target migration directory.
  * Verified forward-recovery plan in lieu of blind rollback.
  * Explicit authorization and sign-off before running `prisma migrate deploy`.
- **Down-Migration Policy**: No production down-migration script is generated in Phase 2A to prevent accidental truncation of additive structures.

---

## 9. Security & Invariant Confirmations

| Security Requirement | Status | Verification Mechanism |
| :--- | :--- | :--- |
| **`Assignment.status` default** | `DRAFT` | Verified by schema declaration, migration SQL, and contract test |
| **`PositionCapability.scopeType` default** | **NO DEFAULT** | Schema and migration require explicit scope declaration |
| **`PositionCapability.businessRuleState` default** | `PROPOSED_TBD` | Verified by schema declaration and migration SQL |
| **`OrgUnit.genderComplex` default** | **NO DEFAULT** | Schema and migration require explicit gender complex declaration |
| **Runtime Authorization Switch** | **NO (0% switched)** | Legacy ABAC, `requireRole`, and scope checks remain authoritative |
| **Phase B Backfill Started** | **NO (0 records)** | No active operational assignments created |
| **Keasramaan V2 UI/Workflows** | **NOT STARTED** | No UI, client components, or server actions modified |
| **Production Migrations** | **0** | No migration applied to production database |
| **Production Seeds / Writes** | **0** | Production database untouched |
| **PR #8 Immutability** | **CONFIRMED** | `origin/review/tahfizh-quality-evaluation` unchanged at `9068cae5587b7219c394c5c25bf0de07a15b0726` |

---

## 10. Next Steps (Subsequent Phases)

1. **Phase B (Compatibility Backfill)**:
   - Construct deterministic backfill scripts to generate `OrgUnit` hierarchy, standard `Position` records, verified `PositionCapability` grants (`businessRuleState = VERIFIED_PRODUCTION`), and active `Assignment` records (`status = ACTIVE`) reproducing current production authority.
2. **Phase C (Dual-Read & Shadow Evaluation)**:
   - Deploy `IAuthorizationEngine` and run shadow comparison against legacy authorization guards to prove 0% divergence.
3. **Phase D (Authoritative Switch)**:
   - Switch server actions to authoritative canonical engine evaluation.
4. **Phase E (Legacy Retirement)**:
   - Safely deprecate and retire legacy flags and tables.

