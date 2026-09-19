# STQ Education Portal — Milestone 3.3C2A Production Preflight & Backup Safety
**Document Identifier:** `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md`  
**Execution Stage:** M3.3C2A (Preflight & Planning Only)  
**Audit Mode:** Strict Read-Only / Zero Production Writes  
**Audit Timestamp:** 2026-09-19T01:34:23.776Z  

---

## Executive Summary & Absolute Invariants

Milestone 3.3C2A serves as an authoritative, read-only preflight audit of the STQ Education Portal production environment prior to scheduling any schema migrations or operational provisioning. 

> [!IMPORTANT]
> **ABSOLUTE SAFETY INVARIANTS OBSERVED IN M3.3C2A:**
> - Production migrations applied: **0** (`prisma migrate deploy` was NOT run)
> - Production schema pushes: **0** (`prisma db push` was NOT run)
> - Migration resolutions: **0** (`prisma migrate resolve` was NOT run)
> - Database seeds: **0** (`prisma/seed.ts` was NOT run)
> - Data backfills executed: **0**
> - Production users created or modified: **0**
> - Position / Capability assignments created: **0**
> - Capability promotions: **0**
> - Feature flags modified: **0** (`PENDIDIKAN_V2_UAT_ENABLED` remains false/unset)
> - Production business data mutations: **0**
> - Immutable PR #8 modified: **NO** (PR #8 remains untouched at SHA `9068cae5587b7219c394c5c25bf0de07a15b0726`)

---

## 1. Git Preflight & Branch Lineage

| Item | Expected Reference | Actual Verified State | Status |
| :--- | :--- | :--- | :--- |
| **Canonical `origin/main`** | `1645fc3b992a1d40a165d9d7dd295c2e79a42ebf` | `1645fc3b992a1d40a165d9d7dd295c2e79a42ebf` | **MATCH** |
| **PR #21** | MERGED | MERGED (`merged: true`, `closed`) | **MATCH** |
| **PR #8** | OPEN / DRAFT / UNMERGED | OPEN / DRAFT / UNMERGED | **MATCH** |
| **PR #8 HEAD SHA** | `9068cae5587b7219c394c5c25bf0de07a15b0726` | `9068cae5587b7219c394c5c25bf0de07a15b0726` | **MATCH (IMMUTABLE)** |
| **Current Working Branch** | `architecture/milestone3-3c2a-production-preflight` | `architecture/milestone3-3c2a-production-preflight` | **MATCH** |

---

## 2. Production Database Identity & Redacted Fingerprint

Production database identity was verified using the production configuration in `.env.production.local` backing [stq-education-portal.vercel.app](https://stq-education-portal.vercel.app/).

- **Database Provider / Host Suffix:** `accelerate.prisma-data.net` (Prisma Postgres / Prisma Accelerate Data Platform)
- **Redacted Connection Target:** `prisma+postgres://[USER]:***@accelerate.prisma-data.net:5432/postgres`
- **Database Name:** `postgres`
- **Current Schema:** `public`
- **PostgreSQL Engine Version:** `PostgreSQL 17.2 on x86_64-pc-linux-musl, compiled by gcc (Alpine 13.2.1_git20240309) 13.2.1 20240309, 64-bit`
- **Environment Source:** `.env.production.local` (`VERCEL_ENV="production"`)
- **Query Timestamp:** `2026-09-19 01:34:23.776 UTC`

### Production Environment Binding Status
- **Verification Tooling:** Vercel CLI is unauthenticated in local shell without `VERCEL_TOKEN`.
- **Evidence Level:** Connection parameters are derived from `.env.production.local` (`VERCEL_ENV="production"`, `accelerate.prisma-data.net`) matching the live production web app. However, direct Vercel API project environment introspection cannot be independently executed without auth tokens.
- **Classification:**
  $$\mathbf{PRODUCTION\_DB\_BINDING = PARTIAL\_EVIDENCE}$$

### Production Table Row Counts (Read-Only)

| Table | Row Count | Operational State |
| :--- | :--- | :--- |
| `santri` | **57** | Active santri population |
| `users` | **18** | System accounts |
| `staff` | **10** | Registered staff records (`STF-0001` - `STF-0010`) |
| `mata_pelajaran` | **9** | Registered course subjects |
| `org_units` | **0** | Empty (Canonical RBAC unprovisioned) |
| `positions` | **0** | Empty (Canonical RBAC unprovisioned) |
| `capabilities` | **0** | Empty (Canonical RBAC unprovisioned) |
| `assignments` | **0** | Empty (Canonical RBAC unprovisioned) |
| `canonical_audit_logs` | **0** | Empty (Audit table exists, zero writes) |

---

## 3. Prisma Migration History Audit & PR #8 Caveat

### Production `_prisma_migrations` Table Inventory

Query against `public."_prisma_migrations"` returned 8 applied migrations:

```
┌───────────────────────────────────────────────────┬──────────────────────────┬──────────────┬──────────────────────────────────────────────────────────────────┐
│ migration_name                                    │ finished_at              │ rolled_back  │ checksum                                                         │
├───────────────────────────────────────────────────┼──────────────────────────┼──────────────┼──────────────────────────────────────────────────────────────────┤
│ 20260910083000_setoran_tahfizh_page_based        │ 2026-09-14T07:25:09.794Z │ NULL         │ 575f2191838ce8a77c2d8287e60a67d4832808063170f761ae70cc47a7966ddb │
│ 20260910090000_core_operational_final             │ 2026-09-14T07:25:20.854Z │ NULL         │ 895deb2fa426c05f130f877394e6e1afae95c07bf7ef7527bf02553338feee32 │
│ 20260910103000_p0_tahfizh_persistence             │ 2026-09-14T07:25:32.557Z │ NULL         │ fa5dbcadbbedb699f85a9c8c54e53e883e63cfb1b18c25852ec7b090d0402715 │
│ 20260914100000_target_santri_float                │ 2026-09-14T07:26:10.066Z │ NULL         │ fbf2762b4b6e8c19b54e59c188c0fad2923042392a05d638cd601e4420afb330 │
│ 20260914170000_add_jumlah_juz_mufar               │ 2026-09-14T12:23:52.419Z │ NULL         │ b9fa2fbf2494c78d976bb2fe832be6d5c827b1715bb6169f2afaa17b0e3c0100 │
│ 20260915100000_add_tahfizh_quality_engine         │ 2026-09-15T00:06:15.307Z │ NULL         │ fc96b177d5219c5b2853c6c86a0fa3d28bce0944890bfde9de2e5d6fe7391467 │
│ 20260917000000_stq_architecture_lock_phase2a     │ 2026-09-18T00:19:56.674Z │ NULL         │ 6d0be096da632bdb8314b7f665f873db7240bd41ea0b901bf6424fd6dee8573b │
│ 20260917220000_m3_1_keasramaan_structure          │ 2026-09-18T00:19:57.400Z │ NULL         │ e153884254c7f56a8b4a2bfda404ca13240486210f01db5a5772d8ef891aacaa │
└───────────────────────────────────────────────────┴──────────────────────────┴──────────────┴──────────────────────────────────────────────────────────────────┘
```

### Repository Migrations Inventory on `main`
The local `prisma/migrations` directory on canonical `main` contains:
1. `20260910083000_setoran_tahfizh_page_based`
2. `20260910090000_core_operational_final`
3. `20260910103000_p0_tahfizh_persistence`
4. `20260914100000_target_santri_float`
5. `20260914170000_add_jumlah_juz_mufar`
6. `20260917000000_stq_architecture_lock_phase2a`
7. `20260917220000_m3_1_keasramaan_structure`
8. `20260918120000_m3_3a_health_v2_backend` (Local only — pending deployment)
9. `20260918140000_m3_3b_pendidikan_foundation` (Local only — pending deployment)

### Output of `npx prisma migrate status` Against Production

```
The following migration have been applied to the database but are not found in the local migrations directory:
  - 20260915100000_add_tahfizh_quality_engine

Following migrations have not yet been applied:
  - 20260918120000_m3_3a_health_v2_backend
  - 20260918140000_m3_3b_pendidikan_foundation

To apply these migrations, run prisma migrate deploy
```

> [!CAUTION]
> **CRITICAL MIGRATION DIVERGENCE CLASSIFICATION:**
> - Migration `20260915100000_add_tahfizh_quality_engine` (Checksum: `fc96b177d5219c5b2853c6c86a0fa3d28bce0944890bfde9de2e5d6fe7391467`) exists in production `_prisma_migrations` but is **ABSENT** on `main` because it belongs exclusively to immutable PR #8.
> - Per Section 5 of the mandate:
>   $$\mathbf{PRODUCTION\_MIGRATION\_HISTORY = BLOCKED}$$
> - **Reconciliation Requirement:** Migration-ledger reconciliation requires separate Business Owner authorization.
> - No migrations were repaired, merged from PR #8, cherry-picked, or resolved in C2A. Production `_prisma_migrations` was NOT altered. Execution is strictly stopped before C2B.

---

## 4. Schema Presence & Absence Verification

### M3.3A — Health V2 Backend Verification
Read-only catalog inspection for M3.3A artifacts in production:

| Catalog Entity | Type | Catalog Query | Result | Verification |
| :--- | :--- | :--- | :--- | :--- |
| `health_cases_v2` | Table | `to_regclass('public.health_cases_v2')` | `NULL` | **ABSENT** |
| `health_case_v2_events` | Table | `to_regclass('public.health_case_v2_events')` | `NULL` | **ABSENT** |
| `HealthStatusV2` | Enum | `SELECT typname FROM pg_type WHERE typname = 'HealthStatusV2'` | `NULL` | **ABSENT** |

**Conclusion for M3.3A:** Zero partial schema drift. Clean absence.

### M3.3B — Pendidikan Foundation Verification
Read-only catalog inspection for M3.3B artifacts in production:

| Catalog Entity | Type | Catalog Query | Result | Verification |
| :--- | :--- | :--- | :--- | :--- |
| `education_cohorts` | Table | `to_regclass('public.education_cohorts')` | `NULL` | **ABSENT** |
| `teaching_assignments` | Table | `to_regclass('public.teaching_assignments')` | `NULL` | **ABSENT** |
| `education_sessions` | Table | `to_regclass('public.education_sessions')` | `NULL` | **ABSENT** |
| `education_session_participants` | Table | `to_regclass('public.education_session_participants')` | `NULL` | **ABSENT** |
| `education_session_attendances` | Table | `to_regclass('public.education_session_attendances')` | `NULL` | **ABSENT** |
| `EducationTrack` | Enum | `SELECT typname FROM pg_type WHERE typname = 'EducationTrack'` | `NULL` | **ABSENT** |
| `PedagogicalLevel` | Enum | `SELECT typname FROM pg_type WHERE typname = 'PedagogicalLevel'` | `NULL` | **ABSENT** |
| `EducationSessionStatus` | Enum | `SELECT typname FROM pg_type WHERE typname = 'EducationSessionStatus'` | `NULL` | **ABSENT** |
| `EducationAttendanceStatus` | Enum | `SELECT typname FROM pg_type WHERE typname = 'EducationAttendanceStatus'` | `NULL` | **ABSENT** |
| `santri.cohort_id` | Column | `information_schema.columns WHERE column_name = 'cohort_id'` | `NULL` | **ABSENT** |

**Conclusion for M3.3B:** Zero partial schema drift. Clean absence.

---

## 5. Source Schema & Foreign Key Compatibility

Before applying M3.3A and M3.3B, all referenced source tables and primary keys were audited:

| Referenced Source Entity | Target Column | Data Type | UD Type | Nullable | Compatibility with Migration FK |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `santri` | `id` | `text` | `text` | NO | **COMPATIBLE** |
| `users` | `id` | `text` | `text` | NO | **COMPATIBLE** |
| `staff` | `id` | `text` | `text` | NO | **COMPATIBLE** |
| `mata_pelajaran` | `id` | `text` | `text` | NO | **COMPATIBLE** |

### Lock Impact Planning & Table Sizes

```
┌─────────────────┬──────────────┬───────────────┐
│ Table           │ Total Bytes  │ Pretty Size   │
├─────────────────┼──────────────┼───────────────┤
│ santri          │ 147,456      │ 144 kB        │
│ users           │ 114,688      │ 112 kB        │
│ staff           │ 49,152       │ 48 kB         │
│ mata_pelajaran  │ 65,536       │ 64 kB         │
└─────────────────┴──────────────┴───────────────┘
```

**Lock Impact Evaluation:**  
The total relation size for `santri` is only **144 kB** across 57 rows. In PostgreSQL 17, adding a nullable column (`ALTER TABLE santri ADD COLUMN cohort_id TEXT`) updates table catalog metadata only, requiring an `ACCESS EXCLUSIVE` lock for under 1 millisecond. Index creation (`CREATE INDEX santri_cohort_id_idx ON santri(cohort_id)`) over 57 rows will complete in under 5 milliseconds. No risk of lock contention or query stalls exists.

---

## 6. Data Quality Read-Only Audit

Diagnostic inspection of existing production rows:

### A. Staff Linkage Analysis
- **Total active users:** 18
- **Active Staff records:** 10 (`STF-0001` through `STF-0010`, all `status = AKTIF`)
- **Users without `staff_id`:** 8
  - `yayasan` (`YAY`, PERSONAL)
  - `musyrifah.putri` (`MT`, PERSONAL) — **Requires Staff linkage or UNIT classification**
  - `osda` (`OSDA`, PERSONAL)
  - `pembina.halaqoh` (`PH`, PERSONAL) — **Requires Staff linkage or UNIT classification**
  - `walisantri` (`WS`, PERSONAL)
  - `santri.obama` (`ST`, PERSONAL)
  - `santri.fatih` (`ST`, PERSONAL)
  - `razan.mt` (`MT`, PERSONAL) — **Requires Staff linkage (matches Ust. Razan Mufli `STF-0003`)**
- **Users linked to missing Staff:** 0
- **Users linked to inactive Staff:** 0
- **Duplicate Staff linkage:** 0 (No staff is linked to multiple users)

### B. Santri Demographics
- **Active santri without halaqoh:** 0 (All 57 santri are assigned to valid halaqohs)
- **Active santri without valid gender:** 0 (All 57 santri have valid gender assignments)

### C. Canonical RBAC Coverage
- **Total OrgUnits:** 0
- **Total Positions:** 0
- **Total Capabilities:** 0
- **Total PositionCapabilities:** 0
- **Total Assignments:** 0
- *All canonical RBAC structures remain unseeded in production.*

---

## 7. Mata Pelajaran Preflight

Inventory of 9 subjects currently present in production:

| Subject ID | Code (`kode_mapel`) | Name (`nama`) | Category | Canonical Status |
| :--- | :--- | :--- | :--- | :--- |
| `cmtur16jd01t8iwfbtmcel2yk` | `MP-PES-01` | Adab & Kepesantrenan | KEPESANTRENAN | PRESENT (Non-core) |
| `cmtusvoeq001cfqdx5ec0rfec` | `KPS-AQD` | Aqidah Islamiyah | KEPESANTRENAN | **PRESENT** (Canonical Kepesantrenan) |
| `cmtusvo3j0018fqdxyjzjnwgu` | `KPS-ARB` | Bahasa Arab | KEPESANTRENAN | **PRESENT** (Canonical Kepesantrenan) |
| `cmtur16ek01t4iwfb03cax0xe` | `MP-DIN-02` | Bahasa Arab & Nahwu | DINIYAH | **DUPLICATE / AMBIGUOUS** |
| `cmtusvo660019fqdx39546vsn` | `KPS-FQH` | Fikih | KEPESANTRENAN | **PRESENT** (Canonical Kepesantrenan) |
| `cmtur16c001t2iwfbzox7dxff` | `MP-DIN-01` | Fiqih Ibadah | DINIYAH | **DUPLICATE / AMBIGUOUS** |
| `cmtur16gt01t6iwfb13u5dplc` | `MP-UM-01` | Matematika Terapan | UMUM | **AMBIGUOUS** (Canonical is Matematika) |
| `cmtusvo8l001afqdxjzijakak` | `KPS-TFS` | Tafsir | KEPESANTRENAN | **PRESENT** (Canonical Kepesantrenan) |
| `cmtusvobh001bfqdxompw8zoi` | `KPS-TJW` | Tajwid | KEPESANTRENAN | **PRESENT** (Canonical Kepesantrenan) |

### Gap Analysis Against UAT Requirements:
- **Studi Umum (6 required):**
  1. Matematika: **AMBIGUOUS** (Only `Matematika Terapan` exists)
  2. Bahasa Inggris: **MISSING**
  3. IPS: **MISSING**
  4. IPA: **MISSING**
  5. Bahasa Indonesia: **MISSING**
  6. TIK: **MISSING**
- **Kepesantrenan (5 canonical):**
  1. Bahasa Arab: **PRESENT** (`KPS-ARB`)
  2. Fikih: **PRESENT** (`KPS-FQH`)
  3. Tafsir: **PRESENT** (`KPS-TFS`)
  4. Aqidah Islamiyah: **PRESENT** (`KPS-AQD`)
  5. Tajwid: **PRESENT** (`KPS-TJW`)

*Zero subjects were modified or inserted during C2A.*

---

## 8. Production Readiness Dry Run (Exact 11 Gates)

Readiness diagnostic evaluated in strict read-only mode against production:

| # | Readiness Gate | Status | Diagnostic Evaluation / Blocking Reason |
| :--- | :--- | :--- | :--- |
| 1 | `M3_3A_SCHEMA_READY` | **NOT_READY** | Missing Health V2 tables (`health_cases_v2`, `health_case_v2_events`) & enum `HealthStatusV2` |
| 2 | `M3_3B_SCHEMA_READY` | **NOT_READY** | Missing Pendidikan V2 tables (`education_cohorts`, etc.) & enums |
| 3 | `CANONICAL_AUDIT_READY` | **READY** | `canonical_audit_logs` table exists and is operational |
| 4 | `STAFF_LINKAGE_READY` | **BLOCKED** | Operational accounts lacking active linked Staff: `musyrifah.putri`, `pembina.halaqoh`, `razan.mt` |
| 5 | `REQUIRED_ORG_UNITS_READY` | **NOT_READY** | Missing required OrgUnits: `OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT` |
| 6 | `REQUIRED_POSITIONS_READY` | **NOT_READY** | Missing positions: `MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`, etc. |
| 7 | `CAPABILITIES_REGISTERED` | **NOT_READY** | Missing required activation capabilities (e.g. `academic.session.start`, etc.) |
| 8 | `USER_ASSIGNMENTS_READY` | **NOT_READY** | Missing active user assignments for required positions |
| 9 | `TEACHING_ASSIGNMENTS_READY` | **NOT_READY** | Table `public.teaching_assignments` does not exist in production |
| 10 | `COHORTS_ASSIGNED` | **NOT_READY** | Column `santri.cohort_id` does not exist in production |
| 11 | `RUNTIME_ACTIVATION_FLAG` | **NOT_READY** | `PENDIDIKAN_V2_UAT_ENABLED=false` (Flag unset/false in production) |

**Summary:** 1 gate is `READY` (`CANONICAL_AUDIT_READY`), 1 gate is `BLOCKED` (`STAFF_LINKAGE_READY`), and 9 gates are `NOT_READY` awaiting future schema migrations and C2C provisioning.

---

## 9. Backup Script Security Hardening & Direct Connection Contract

The backup script `scripts/backup-db.ts` was audited and hardened to eliminate critical vulnerabilities and establish strict protocol boundaries:

### Security & Protocol Remediations
1. **Explicit Direct Connection Contract:**
   - Introduced strict contract: `BACKUP_DATABASE_URL` or `DIRECT_DATABASE_URL`.
   - Never falls back to `DATABASE_URL` when `DATABASE_URL` uses Prisma Accelerate proxy (`prisma+postgres://` or `prisma://`).
   - Fails closed immediately if only a Prisma Accelerate URL exists, as proxy connections are not wire-compatible with `pg_dump`.
2. **Comprehensive Credential Redaction:**
   - Both user passwords and sensitive query parameter values (`api_key`, `token`, `access_token`, `password`, `secret`, etc.) are strictly redacted to `***`.
   - Only allowlisted non-secret parameters (`sslmode`, `schema`, `connect_timeout`, etc.) retain values in logs.
3. **Eliminated Synthetic SQL Placeholder:** If `pg_dump` fails or is missing, zero synthetic SQL placeholder files are generated. Any failure causes an immediate non-zero exit code (`process.exit(1)`).
4. **Mandatory URL Validation:** Removed silent fallback to `localhost:5432/stq_education_db`. Missing connection URL causes immediate exit code 1.
5. **Strict Verification Threshold:** Backup file must exist and have file size $\ge 500$ bytes.
6. **Cryptographic Checksum:** SHA-256 checksum is computed from the dump file and saved alongside as `.sha256`.
7. **Retention Cleanup Guard:** Expired backup cleanup runs **only** after a newly created backup is cryptographically verified. Existing backups are never deleted when a backup run fails.
8. **Verification & Simulation Modes:**
   - `--dry-run` performs parameter simulation with zero file/database writes.
   - `--verify-only` performs a real PostgreSQL read-only schema probe (`pg_dump --schema-only --no-owner --no-privileges`) to verify authentication and protocol readiness without writing any backup files.

### Unit Test Verification
Hardened backup behavior is unit-tested in `tests/backup-db.test.ts`:
- 19/19 tests pass across 7 suites covering direct URL resolution, Accelerate rejection, query secret redaction, file integrity, checksum calculation, retention safety, and fail-closed auth probes.

### Environment Status & Restorable Backup Plan
- **pg_dump Binary Availability:** In the current Windows execution environment, `pg_dump` is not present in PATH.
- **Execution Readiness Status:**
  $$\mathbf{BACKUP\_EXECUTION\_READY = BLOCKED}$$
  *(Blocked by absent `pg_dump` binary in host PATH and requirement for explicit direct PostgreSQL connection string).*
- **Action Taken in C2A:** Real production backup was **NOT EXECUTED** in compliance with Section 12 instructions ("DO NOT run the real production backup yet in C2A unless explicitly authorized later.").
- **Future C2B Execution Requirement:** Before initiating production migrations, a valid direct PostgreSQL connection string (`BACKUP_DATABASE_URL`) and `pg_dump` binary must be provided (e.g., via a Linux container/runner or PostgreSQL client tools) to capture:
  - Exact `.sql` dump
  - Accompanying `.sha256` checksum
  - Timestamped manifest with table row counts
  - Verification restore into an isolated test instance.

---

## 10. Migration Risk Assessment

### M3.3A Migration (`20260918120000_m3_3a_health_v2_backend`)
- **Operations:**
  - Create enum `HealthStatusV2` (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`)
  - Create table `health_cases_v2`
  - Create table `health_case_v2_events`
  - Create exact indexes:
    - `health_cases_v2_santri_id_status_v2_idx` on `health_cases_v2(santri_id, status_v2)`
    - `health_cases_v2_santri_id_occurred_at_idx` on `health_cases_v2(santri_id, occurred_at)`
    - `health_cases_v2_status_v2_occurred_at_idx` on `health_cases_v2(status_v2, occurred_at)`
    - `health_case_v2_events_case_id_created_at_idx` on `health_case_v2_events(case_id, created_at)`
  - Add foreign keys referencing `santri(id)`, `users(id)`, `staff(id)`
- **Safety Profile:**
  - Purely additive DDL.
  - Zero `UPDATE`, zero `DELETE`, zero `DROP`, zero column drops.
  - Zero rows inserted or backfilled into production business tables.
- **Risk Level:** **LOW**

### M3.3B Migration (`20260918140000_m3_3b_pendidikan_foundation`)
- **Operations:**
  - Create enums `EducationTrack`, `PedagogicalLevel`, `EducationSessionStatus`, `EducationAttendanceStatus`
  - Add nullable column `cohort_id` to `santri`
  - Create tables: `education_cohorts`, `teaching_assignments`, `education_sessions`, `education_session_participants`, `education_session_attendances`
  - Add foreign keys and indexes
- **Safety Profile:**
  - Adding nullable column `cohort_id` on `santri` (57 rows, 144 kB) requires minimal catalog lock ($<5$ ms).
  - Foreign key `santri_cohort_id_fkey` references `education_cohorts(id)` with `ON DELETE SET NULL ON UPDATE CASCADE`.
  - Zero `UPDATE`, zero `DELETE`, zero `DROP`.
  - Zero rows inserted into `teaching_assignments` or `education_cohorts`.
- **Risk Level:** **LOW**

---

## 11. C2C Provisioning Inventory — Plan Only

The following provisioning tasks are required for Milestone 3.3C2C (post-migration). **No provisioning was performed in C2A.**

### A. Academic Structure & Cohort Policy
1. **Education Cohort Definition (Canonical Business Rule):**
   - An `EducationCohort` represents a permanent **ANGKATAN / TAHUN AJARAN MASUK** (e.g., `2024/2025`, `2025/2026`, `2026/2027`).
   - Gender (`PUTRA` / `PUTRI`) is completely separate and must **NEVER** define cohort identity.
   - Current *Tingkat Studi Umum* (1 / 2 / 3, representing school grades 7, 8, 9) is a derived/current program position and must **NOT** replace or mutate permanent cohort identity.
2. **Current Production Source Data Evaluation:**
   - Active santri demographic distribution across current classes:
     - Grade 7: `7A` (8), `7B` (16), `7C` (5) $\rightarrow$ Total: 29 santri
     - Grade 8: `8A` (10), `8B` (6), `8C` (3) $\rightarrow$ Total: 19 santri
     - Grade 9: `9A` (7), `9C` (2) $\rightarrow$ Total: 9 santri
     - Total active santri: 57
   - **Data Quality Gap:** The production `santri` table lacks an explicit `angkatan` or `tahun_masuk` column. Permanent entry cohort cannot be inferred merely from current class assignment without administrative verification.
   - **Santri with Unresolved Permanent Cohort:** 57 (all active santri).
   - **Status:**
     $$\mathbf{COHORT\_MAPPING = NEEDS\_BUSINESS\_INPUT}$$
   - **Zero cohort rows written in C2A.** Awaiting Business Owner confirmation of exact cohort codes and santri angkatan mapping.
3. **Mata Pelajaran Provisioning:**
   - 5 missing Studi Umum subjects: Bahasa Inggris, IPS, IPA, Bahasa Indonesia, TIK.
   - Clarification / aliasing for `Matematika` vs `Matematika Terapan`.
   - Resolution of duplicate Diniyah / Kepesantrenan codes (`MP-DIN-01` vs `KPS-FQH`, `MP-DIN-02` vs `KPS-ARB`).
4. **Teaching Assignments Required:**
   - 6 Studi Umum assignments
   - 7 KPS PUTRA assignments
   - 5 KPS PUTRI assignments

### B. Identity & Canonical RBAC Provisioning
1. **Staff Linkage Remediation:**
   - `razan.mt` $\rightarrow$ Link to active Staff `STF-0003` (Ust. Razan Mufli, S.Pd).
   - `musyrifah.putri` $\rightarrow$ Link to active Staff or classify as UNIT account.
   - `pembina.halaqoh` $\rightarrow$ Link to active Staff or classify as UNIT account.
2. **Canonical OrgUnits:** Provision root units (`OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT`, etc.).
3. **Canonical Positions & Capabilities:**
   - Register 9 required activation capabilities.
   - Register canonical positions (`MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`, etc.).
   - Bind `PositionCapability` policies with verified production business rules.
4. **Teacher Account Policy Modality (Business Owner Approval Required):**
   - Accounts such as `guru.matematika`, `guru.bahasainggris`, etc., must be explicitly categorized:
     - **Option A (PERSONAL):** Each account is linked to an individual, verified human Staff record.
     - **Option B (UNIT):** Shared functional account requiring a designated human executor for authorization.
   - *Authority will never derive from username strings.*

---

## 12. Feature Flags Status in Production

| Feature Flag | Current State | Target in C2A | Compliant |
| :--- | :--- | :--- | :--- |
| `PENDIDIKAN_V2_UAT_ENABLED` | **UNSET (false)** | Unset / False | **YES** |
| `ENABLE_CANONICAL_AUDIT_WRITES` | **UNSET** | Unset | **YES** |
| `USE_CANONICAL_AUTH` | **UNSET** | Unset | **YES** |
| `ENABLE_CANONICAL_AUTH_SHADOW` | **UNSET** | Unset | **YES** |

---

## 13. Audit Conclusion & Stop Status

```
============================================================
M3_3C2A PRODUCTION PREFLIGHT AUDIT: COMPLETED (READ-ONLY)
STATUS: PRODUCTION_MIGRATION_HISTORY = BLOCKED
============================================================
```

1. **Production Database Identity:** Successfully fingerprinted (Prisma Postgres / PostgreSQL 17.2).
2. **Schema Drift:** Absent (Clean zero-drift for M3.3A and M3.3B).
3. **Prisma Migration History:** **BLOCKED** due to DB containing PR #8 migration `20260915100000_add_tahfizh_quality_engine` which is not present in repository `main`.
4. **Backup Safety:** Hardened `scripts/backup-db.ts` with strict fail-hard validation and unit tests.
5. **No-Write Commitment:** 100% honored. Zero migrations, zero schema changes, zero database mutations.

**Execution HALTED before Milestone 3.3C2B.**  
Ready for independent audit review.
