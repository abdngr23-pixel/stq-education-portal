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
   - 64/64 tests passed across 19 suites in `tests/architecture-lock-contracts.test.ts`, including 12 dedicated structural tests in Suite 18.
5. **Full Repository Tests**:
   - All 766 tests in 197 suites passing cleanly.
6. **Next.js Production Build**:
   - Turbopack compilation succeeded with zero TypeScript and zero ESLint errors.

---

## 5. Security & Invariant Confirmations

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

## 6. Next Steps (Subsequent Phases)

1. **Phase B (Compatibility Backfill)**:
   - Construct deterministic backfill scripts to generate `OrgUnit` hierarchy, standard `Position` records, verified `PositionCapability` grants (`businessRuleState = VERIFIED_PRODUCTION`), and active `Assignment` records (`status = ACTIVE`) reproducing current production authority.
2. **Phase C (Dual-Read & Shadow Evaluation)**:
   - Deploy `IAuthorizationEngine` and run shadow comparison against legacy authorization guards to prove 0% divergence.
3. **Phase D (Authoritative Switch)**:
   - Switch server actions to authoritative canonical engine evaluation.
4. **Phase E (Legacy Retirement)**:
   - Safely deprecate and retire legacy flags and tables.
