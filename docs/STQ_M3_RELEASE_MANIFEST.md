# STQ EDUCATION PORTAL — MASTER RELEASE MANIFEST (M3.3)
**Release Train Control Sheet: Gate 0 through Gate 5 (Live Production UAT)**

- **Repository:** `abdngr23-pixel/stq-education-portal`
- **Current Main Checkpoint (before PR #34 merge):** `3524f26f6fde8580b91076bb255c4f1417d9e90a`
- **PR #34 Status:** DRAFT / UNMERGED (`chore/gate3-final-blocker-canonicalization`)
- **HISTORICAL_POST_PR24_CHECKPOINT:** `8e670491d1ed0c88a480ed90186153e96ca1dea3`
- **Current Official Gate State:**
  - `PRE-GATE` = CLOSED (Architecture Lock verified)
  - `GATE 0` = CLOSED (Prerequisites Complete)
  - `GATE 1` = CLOSED (Preflight Validation Complete)
  - `GATE 2` = CLOSED (Production Migration Complete)
  - `GATE 3` = PARTIAL / IN PROGRESS (Partial Provisioning Complete; Final Batch Pending Authorization)
  - `GATE 4` = NOT AUTHORIZED / NOT STARTED
  - `GATE 5` = NOT AUTHORIZED / NOT STARTED
- **Status:** ACTIVE CONTROL PLANE (R4.1 CURRENT-STATE RECONCILED)
- **Control-Plane Drafting:** COMPLETE
- **Control-Plane Audit:** READY_FOR_FINAL_INDEPENDENT_MERGE_AUDIT
- **Production Readiness:** Gate 0 prerequisites are CLOSED; Gate 1 and Gate 2 are CLOSED; Gate 3 is PARTIAL / IN PROGRESS; all production mutations strictly governed by explicit Owner Directives.
- **Execution Model:** PARALLEL PREPARATION | SERIAL PRODUCTION EXECUTION | FAIL-CLOSED GATES | MANDATORY EVIDENCE PACKS
- **Current Production Mutation Authorization:** **ZERO PRODUCTION WRITES AUTHORIZED IN THIS PR / PHASE**
- **Field Semantics (`Production write required?`):** Classifies whether the operational target work item itself requires a database/environment write during its execution gate (`FUTURE_OPERATION_REQUIRES_PRODUCTION_WRITE`), NOT whether this documentation PR executes a write (`CURRENT_PR_EXECUTED_PRODUCTION_WRITE = 0`).
- **Current-State Precedence Rule:** `CURRENT_VERIFIED_PRODUCTION_STATE` strictly supersedes `HISTORICAL_PRE_GATE_STATE` for all operational execution decisions. Historical text must NEVER be interpreted as authorization to repeat an already-completed production mutation. Where accepted production evidence proves a catalog, account, unit, or assignment is already provisioned, `Production write required NOW` evaluates to `NO`.

---

## 1. Release Manifest Dashboard & Summary

### A. Authoritative Current Release & Gate Status

> [!IMPORTANT]
> **Operational Execution Authority:**
> Current operational execution authority comes strictly from:
> - **Current Gate 0–9 status** (Gate 0, 1, 2 CLOSED; Gate 3 PARTIAL / IN PROGRESS; Gates 4 and 5 NOT AUTHORIZED)
> - **Accepted production evidence packs** (e.g. `release-handoff/GATE3_COMPLETION_*`)
> - **Current Owner Directives** (`docs/STQ_OWNER_DIRECTIVES.md`)
> - **Architecture lock contracts** (`types/architecture-lock.ts`)
> - **Pendidikan V2 readiness engine** (`lib/server/pendidikan-v2-readiness.ts`)
> 
> Historical C2B/C2C/C2D status MUST NOT override current verified Gate state. Historical text must NEVER be interpreted as authorization to repeat an already-completed production mutation.

| Gate | Phase / Domain | Status | Notes / Current Truth |
| :--- | :--- | :---: | :--- |
| **PRE-GATE** | Pre-Release Architecture Lock | **CLOSED** | All foundational architecture locks verified in main |
| **GATE 0** | Production Prerequisites | **CLOSED** | Prerequisites complete; read-only probes & baseline verified |
| **GATE 1** | Production Preflight | **CLOSED** | Preflight checks and data validation passed |
| **GATE 2** | Production Migration (DDL) | **CLOSED** | 12 migrations applied cleanly; schema verified |
| **GATE 3** | Controlled Provisioning | **PARTIAL / IN PROGRESS** | Foundation topology (`OU-STQ-ROOT`, `OU-TAHFIZH`), Mudir/Kabid/Guru assignments, 12 TeachingAssignments, and account deactivations verified in prod; final batch (`OU-KEASRAMAAN`, 6 MT halaqohs, POT assignment) pending explicit authorization |
| **GATE 4** | Capability & Policy Activation | **NOT AUTHORIZED / NOT STARTED** | Gated by Gate 3 complete closure |
| **GATE 5** | Live Production UAT | **NOT AUTHORIZED / NOT STARTED** | Gated by Gate 4 completion and strict verified human executor proof |

---

### B. Legacy Control-Plane Snapshot (HISTORICAL_CONTROL_PLANE_SNAPSHOT)

> [!NOTE]
> **HISTORICAL_CONTROL_PLANE_SNAPSHOT — NON_AUTHORITATIVE_FOR_CURRENT_EXECUTION**
> The 100-item table and legacy C2B–C2E summary below represent the initial pre-release baseline drafted before the sequential Gate 0–9 release process executed. For current operational execution decisions, refer to the Authoritative Current Release & Gate Status table above and the `CURRENT_VERIFIED_PRODUCTION_STATE` of each individual work item.

| Stage / Scope | Total Items | PASS | READY | BLOCKED | NOT_READY |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **A. Git & Release Lineage** | 5 | 5 | 0 | 0 | 0 |
| **B. Database & Migration** | 4 | 1 | 0 | 3 | 0 |
| **C. Backup & Restore** | 4 | 0 | 0 | 4 | 0 |
| **D. Staff Linkage** | 3 | 0 | 0 | 1 | 2 |
| **E. Account Cleanup / Decommission** | 4 | 0 | 0 | 3 | 1 |
| **F. Org Units** | 4 | 0 | 0 | 3 | 1 |
| **G. Positions** | 4 | 0 | 0 | 2 | 2 |
| **H. Capabilities** | 3 | 0 | 0 | 1 | 2 |
| **I. Position Capabilities** | 4 | 0 | 0 | 2 | 2 |
| **J. Assignments** | 4 | 0 | 0 | 3 | 1 |
| **K. Assignment Scope Units** | 3 | 0 | 0 | 2 | 1 |
| **L. Account Modality** | 3 | 0 | 0 | 0 | 3 |
| **M. OSDA Putri** | 3 | 0 | 0 | 1 | 2 |
| **N. Tahfizh Domain** | 4 | 1 | 0 | 1 | 2 |
| **O. Keasramaan Domain** | 4 | 0 | 0 | 2 | 2 |
| **P. Health Domain (Health V2)** | 3 | 1 | 0 | 1 | 1 |
| **Q. Studi Umum Domain** | 3 | 0 | 0 | 1 | 2 |
| **R. Kepesantrenan Domain** | 3 | 1 | 0 | 0 | 2 |
| **S. Subjects (Mata Pelajaran)** | 3 | 0 | 0 | 1 | 2 |
| **T. Cohorts (Angkatan)** | 3 | 0 | 0 | 2 | 1 |
| **U. Teaching Assignments** | 3 | 0 | 0 | 1 | 2 |
| **V. Feature Flags / Policy Activation** | 3 | 0 | 0 | 1 | 2 |
| **W. Authorization Engine** | 4 | 1 | 0 | 1 | 2 |
| **X. Forensic Audit Logging** | 3 | 1 | 0 | 0 | 2 |
| **Y. Production UAT** | 3 | 0 | 0 | 1 | 2 |
| **Z. Recovery & Final Sign-Off** | 3 | 0 | 0 | 1 | 2 |
| **AA. Unresolved Business Decisions** | 10 | 0 | 0 | 3 | 7 |
| **TOTALS** | **100** | **11** | **0** | **41** | **48** |

### Legacy Gate Status Overview (HISTORICAL_CONTROL_PLANE_SNAPSHOT — NON_AUTHORITATIVE_FOR_CURRENT_EXECUTION):
- **GATE-C2B (Production Migration):** `CLOSED` in Gate 2 (12 migrations executed and verified in production).
- **GATE-C2C (Controlled Provisioning):** `PARTIAL` in Gate 3 (Foundation provisioned; final batch pending authorization).
- **GATE-C2D (Capability & Policy Activation):** `NOT_AUTHORIZED` (Corresponds to Gate 4).
- **GATE-C2E (Live Production UAT):** `NOT_AUTHORIZED` (Corresponds to Gate 5).

---

## 2. Master Item Control Sheet

### A. GIT / RELEASE
- **REL-GIT-01 | PR #8 Immutable Historical Branch Guard**
  - **Domain:** GIT / HISTORICAL
  - **Requirement:** Maintain PR #8 (`review/tahfizh-quality-evaluation`) intact as open, draft, unmerged; zero wholesale merge, zero casual rebasing.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md`, `STQ_PROJECT_CONTEXT.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** OPEN / DRAFT / UNMERGED at HEAD `9068cae5587b7219c394c5c25bf0de07a15b0726`.
  - **Target state:** Maintained intact indefinitely until formal historical retirement.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** YES (to modify or close)
  - **Dry-run evidence:** GitHub API inspection confirms open draft state.
  - **Positive test:** `git ls-remote` confirms branch HEAD matches immutable SHA.
  - **Negative test:** Automated pre-push / audit hook fails if PR #8 HEAD differs.
  - **Reconciliation evidence:** PR #23 ledger reconciliation preserved SHA.
  - **Rollback/recovery consideration:** N/A (read-only branch protection).
  - **Evidence Pack reference:** `EVID-GIT-PR8`
  - **Gate:** ALL GATES
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Non-negotiable repository guard.

- **REL-GIT-02 | PR #22 (M3.3C2A Preflight Closure)**
  - **Domain:** GIT / MILESTONE
  - **Requirement:** Verified closure of M3.3C2A preflight milestone.
  - **Source of truth:** `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** MERGED at commit `8492089a0dedddb05a176c66e941305c80037404`.
  - **Target state:** Closed historical milestone.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** YES (Satisfied)
  - **Dry-run evidence:** Merged git commit in `main` lineage.
  - **Positive test:** Git log contains PR #22 merge commit.
  - **Negative test:** Re-opening PR #22 rejected.
  - **Reconciliation evidence:** Merge commit CI run `35417547600` passed.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-GIT-PR22`
  - **Gate:** BASELINE
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Milestone officially closed.

- **REL-GIT-03 | PR #23 (M3.3C2A.1 Ledger & Schema Reconciliation)**
  - **Domain:** GIT / MIGRATION_LEDGER
  - **Requirement:** Reconcile historical migration `20260915100000_add_tahfizh_quality_engine` into main repo lineage.
  - **Source of truth:** `docs/STQ_MILESTONE3_3C2A1_PR8_LEDGER_RECONCILIATION.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** MERGED at commit `5ba4060f841304a189fce622d39243864b7c453a`.
  - **Target state:** Closed reconciliation milestone.
  - **Dependency:** REL-GIT-02
  - **Production write required?:** NO
  - **Owner authorization required?:** YES (Satisfied)
  - **Dry-run evidence:** Migration file restored with matching checksum `fc96b177...`.
  - **Positive test:** `tests/milestone3-3c2a1-reconciliation.test.ts` passes.
  - **Negative test:** CI verifies checksum cannot drift.
  - **Reconciliation evidence:** Post-merge CI run `35420373515` passed.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-GIT-PR23`
  - **Gate:** BASELINE
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Migration ledger divergence resolved.

- **REL-GIT-04 | PR #24 (Project Context Lock)**
  - **Domain:** GIT / CONTEXT_LOCK
  - **Requirement:** Canonical project bootstrap, authority precedence, and non-self-referential Git HEAD rules locked into persistent memory.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md`, `docs/STQ_CURRENT_STATE.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** MERGED at commit `8e670491d1ed0c88a480ed90186153e96ca1dea3`.
  - **Target state:** Closed bootstrap lock milestone.
  - **Dependency:** REL-GIT-03
  - **Production write required?:** NO
  - **Owner authorization required?:** YES (Satisfied)
  - **Dry-run evidence:** `git diff origin/main...HEAD` restricted strictly to 5 context files.
  - **Positive test:** Post-merge CI run `35422712316` passed; Vercel passed.
  - **Negative test:** No runtime, schema, or test files modified.
  - **Reconciliation evidence:** Merged `main` verified to contain context index and bootstrap rules.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-GIT-PR24`
  - **Gate:** BASELINE
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Context lock canonicalized.

- **REL-GIT-05 | Release Train Branch & Execution Freeze Protocol**
  - **Domain:** GIT / RELEASE_CONTROL
  - **Requirement:** Dedicated release branch `release/m3-3-safe-release-control-plane` created; main frozen for unrelated merges during release operations.
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Branch created from main checkpoint `8e670491d1ed0c88a480ed90186153e96ca1dea3`.
  - **Target state:** PR #25 audited -> remediated -> owner authorized -> merged to canonical main -> post-merge verified -> THEN used as merged control plane on main for Gate 0 onward. (PR #25 is NOT held open during execution of Gates 0-9; future release evidence is tracked in separate follow-up PRs).
  - **Dependency:** REL-GIT-04
  - **Production write required?:** NO
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Branch inspection confirms correct fork point.
  - **Positive test:** Fast-forward or clean merge commit possible.
  - **Negative test:** Divergent base SHA triggers fail-closed abort.
  - **Reconciliation evidence:** Exact base commit SHA verified against GitHub.
  - **Rollback/recovery consideration:** Discard release branch if baseline changes uncoordinatedly.
  - **Evidence Pack reference:** `EVID-GIT-RELTRAIN`
  - **Gate:** GATE-C2B through GATE-C2E
  - **Status:** `PASS` (Branch created and verified)
  - **Notes / unresolved decision:** Governs execution freeze.

---

### B. DATABASE / MIGRATION
- **REL-MIG-01 | Reconciled Historical Migration Parity**
  - **Domain:** DATABASE / MIGRATION_LEDGER
  - **Requirement:** Historical migration `20260915100000_add_tahfizh_quality_engine` present in local migrations with checksum `fc96b177d5219c5b2853c6c86a0fa3d28bce0944890bfde9de2e5d6fe7391467`.
  - **Source of truth:** `prisma/migrations/20260915100000_add_tahfizh_quality_engine/migration.sql`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Present in `main` repository tree and present in production `_prisma_migrations`.
  - **Target state:** Unchanged, permanently synchronized.
  - **Dependency:** REL-GIT-03
  - **Production write required?:** NO
  - **Owner authorization required?:** NO (Reconciliation already authorized and merged)
  - **Dry-run evidence:** SHA-256 computation matches production record exactly.
  - **Positive test:** Unit test `tests/milestone3-3c2a1-reconciliation.test.ts` validates parity.
  - **Negative test:** Tampered SQL fails checksum check.
  - **Reconciliation evidence:** Preflight migration audit verified parity.
  - **Rollback/recovery consideration:** Do not drop or rename migration file.
  - **Evidence Pack reference:** `EVID-MIG-HISTORICAL`
  - **Gate:** GATE-C2B
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Zero further migration work needed for this item.

- **REL-MIG-02 | Production Migration History Preflight Check**
  - **Domain:** DATABASE / PREFLIGHT
  - **Requirement:** Verify `prisma migrate status` against production using direct wire connection before applying any migration.
  - **Source of truth:** `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Last C2A read-only audit observed exactly 2 pending migrations (`m3_3a` and `m3_3b`). Must be re-verified live before C2B.
  - **Target state:** Verified clean status showing only authorized migrations pending.
  - **Dependency:** REL-BCK-04 (Verified Backup Gate PASS)
  - **Production write required?:** NO (Read-only probe)
  - **Owner authorization required?:** YES (Direct DB access)
  - **Dry-run evidence:** `npx prisma migrate status` execution log captured.
  - **Positive test:** Exactly 2 expected pending migrations reported.
  - **Negative test:** Fails closed if unexpected applied migration, unapplied historical migration, or checksum mismatch detected.
  - **Reconciliation evidence:** Log comparison against expected state.
  - **Rollback/recovery consideration:** Abort release immediately if drift detected.
  - **Evidence Pack reference:** `EVID-MIG-STATUS`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Awaiting live wire connection string and backup completion)
  - **Notes / unresolved decision:** Mandatory fail-closed prerequisite.

- **REL-MIG-03 | Migration 20260918120000_m3_3a_health_v2_backend Application**
  - **Domain:** DATABASE / HEALTH_V2
  - **Requirement:** Deploy additive migration creating enum `HealthStatusV2`, tables `health_cases_v2` and `health_case_v2_events`.
  - **Source of truth:** `prisma/migrations/20260918120000_m3_3a_health_v2_backend/migration.sql`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Code complete in repository; NOT APPLIED in production.
  - **Target state:** Applied in production `_prisma_migrations` with matching checksum.
  - **Dependency:** REL-MIG-02, REL-BCK-04, Business Owner C2B Authorization
  - **Production write required?:** YES (DDL execution)
  - **Owner authorization required?:** YES (Explicit C2B authorization)
  - **Dry-run evidence:** Migration SQL audited in C2A as strictly additive.
  - **Positive test:** Catalog probe confirms `to_regclass('health_cases_v2') IS NOT NULL`.
  - **Negative test:** Lock contention or transaction failure triggers rollback.
  - **Reconciliation evidence:** Post-migration schema probe and row count fingerprinting.
  - **Rollback/recovery consideration:** STOP -> inspect database and migration lock state. Do NOT automatically restore production. Restore from backup only if failure state necessitates recovery and action is explicitly authorized according to the release incident procedure.
  - **Evidence Pack reference:** `EVID-MIG-C2B`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Zero production writes authorized currently)
  - **Notes / unresolved decision:** Fully additive; zero existing table drops.

- **REL-MIG-04 | Migration 20260918140000_m3_3b_pendidikan_foundation Application**
  - **Domain:** DATABASE / PENDIDIKAN_FOUNDATION
  - **Requirement:** Deploy additive migration creating Pendidikan enums, `education_cohorts`, `teaching_assignments`, `education_sessions`, etc., and nullable column `santri.cohort_id`.
  - **Source of truth:** `prisma/migrations/20260918140000_m3_3b_pendidikan_foundation/migration.sql`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Code complete in repository; NOT APPLIED in production.
  - **Target state:** Applied in production `_prisma_migrations` with matching checksum.
  - **Dependency:** REL-MIG-03, REL-BCK-04, Business Owner C2B Authorization
  - **Production write required?:** YES (DDL execution)
  - **Owner authorization required?:** YES (Explicit C2B authorization)
  - **Dry-run evidence:** Migration SQL audited in C2A as strictly additive (`cohort_id` nullable).
  - **Positive test:** Catalog probe confirms `to_regclass('education_cohorts') IS NOT NULL`.
  - **Negative test:** Nullability constraint prevents santri record corruption.
  - **Reconciliation evidence:** Post-migration schema probe.
  - **Rollback/recovery consideration:** STOP -> inspect database and migration lock state. Do NOT automatically restore production. Restore from backup only if failure state necessitates recovery and action is explicitly authorized according to the release incident procedure.
  - **Evidence Pack reference:** `EVID-MIG-C2B`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Zero production writes authorized currently)
  - **Notes / unresolved decision:** Fully additive; no existing student data modified.

---

### C. BACKUP / RESTORE
- **REL-BCK-01 | Backup Tooling & Binary Availability Audit**
  - **Domain:** BACKUP / TOOLING
  - **Requirement:** Verify `pg_dump` client binary availability and major version compatibility. Before Gate 0: query production PostgreSQL server version READ-ONLY (`SELECT version(), current_setting('server_version_num')`); record `server_version` and `server_version_num`; detect client `pg_dump` major version; require compatible client/server versions; fail closed if client `pg_dump` is older than production server major version (`client_major < server_major => FAIL_CLOSED`); prefer matching production major version (PostgreSQL 17 observed in C2A preflight). Honesty guard: `scripts/backup-db.ts` checks binary presence and version string, but the major version compatibility check (`client_major < server_major => FAIL_CLOSED`) is not currently implemented in `backup-db.ts` itself (`PG_DUMP_MAJOR_COMPATIBILITY_GUARD = REQUIRED / NOT_IMPLEMENTED_IN_BACKUP_SCRIPT`). Gate 0 remains BLOCKED until either: (A) an audited tooling implementation enforces it, or (B) an explicitly defined audited preflight step performs the read-only server/client version comparison before backup execution. Do not provide false automated assurance.
  - **Source of truth:** `scripts/backup-db.ts`, `tests/backup-db.test.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** `pg_dump` binary ABSENT in local Windows PATH; `PG_DUMP_MAJOR_COMPATIBILITY_GUARD = REQUIRED / NOT_IMPLEMENTED_IN_BACKUP_SCRIPT`.
  - **Target state:** Valid binary available in execution environment with client major version matching or exceeding production server major version verified via audited tooling or explicit preflight step.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** CLI probe `pg_dump --version` and read-only production server version query.
  - **Positive test:** Returns valid client version string with `client_major >= server_major`.
  - **Negative test:** Fails closed if missing or if client `pg_dump` major version is older than production server major version.
  - **Reconciliation evidence:** CLI execution output recorded in Evidence Pack.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-BCK-TOOLING`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (pg_dump absent in host environment; version guard not implemented in script)
  - **Notes / unresolved decision:** Mandatory prerequisite before dump capture. Tooling parity honesty enforced.

- **REL-BCK-02 | Direct PostgreSQL Wire Connection Audit**
  - **Domain:** BACKUP / PROTOCOL
  - **Requirement:** Provide direct PostgreSQL connection string via `BACKUP_DATABASE_URL` or `DIRECT_DATABASE_URL`. Rejects Prisma Accelerate (`prisma+postgres://`).
  - **Source of truth:** `scripts/backup-db.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Direct URL not configured in current agent environment; secrets redacted.
  - **Target state:** Valid direct connection string provided to backup runner with credentials redacted in all logs.
  - **Dependency:** REL-BCK-01
  - **Production write required?:** NO (Read-only credential resolution)
  - **Owner authorization required?:** YES (Provisioning of direct connection string)
  - **Dry-run evidence:** Backup script `--verify-only` mode checks wire compatibility.
  - **Positive test:** Auth handshake succeeds against direct endpoint.
  - **Negative test:** Prisma Accelerate URL triggers immediate throw.
  - **Reconciliation evidence:** Redacted log output captured.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-BCK-CONN`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Awaiting direct wire connection string)
  - **Notes / unresolved decision:** Must never use proxy connection for dumps.

- **REL-BCK-03 | Production Cryptographic Backup Execution**
  - **Domain:** BACKUP / EXECUTION
  - **Requirement:** Execute PostgreSQL logical database dump matching executable script `scripts/backup-db.ts`: plain SQL format (`pg_dump -F p`) generating dump file named `stq_backup_<timestamp>.sql`, verify file size $\ge 500$ bytes, compute cryptographic checksum file `stq_backup_<timestamp>.sql.sha256`. Contract: BACKUP_TYPE = PostgreSQL logical dump, FORMAT = plain SQL, PG_DUMP_FORMAT = -F p, ARTIFACT = .sql, CHECKSUM = .sql.sha256. Use terms LOGICAL DATABASE BACKUP / DUMP (not physical PostgreSQL backup).
  - **Source of truth:** `scripts/backup-db.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** NOT EXECUTED. Zero production backups executed yet.
  - **Target state:** Cryptographically verified plain SQL logical dump artifact (`.sql`) and checksum file (`.sql.sha256`) archived.
  - **Dependency:** REL-BCK-01, REL-BCK-02, Explicit Owner Authorization
  - **Production write required?:** NO (Read-only dump against production database)
  - **Owner authorization required?:** YES (Explicit authorization to execute production dump)
  - **Dry-run evidence:** `scripts/backup-db.ts --dry-run` validates path and logic.
  - **Positive test:** Dump file exists, non-empty, SHA-256 verified.
  - **Negative test:** Non-zero exit if dump interrupted or incomplete.
  - **Reconciliation evidence:** File metadata, timestamp, SHA-256 hash.
  - **Rollback/recovery consideration:** Re-run dump if verification fails.
  - **Evidence Pack reference:** `EVID-BCK-DUMP`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Zero production operations authorized currently)
  - **Notes / unresolved decision:** Must precede any DDL execution.

- **REL-BCK-04 | Isolated Test Restore Verification**
  - **Domain:** BACKUP / RESTORE_TEST
  - **Requirement:** Restore verified plain SQL logical dump into an isolated scratch PostgreSQL instance using plain SQL restore mechanism (`psql -f <backup.sql>` against isolated scratch DB, NOT pg_restore/custom-format semantics). Dynamic T0 verification: capture pre-backup T0 READ-ONLY snapshot immediately before backup (table row counts, schema/object inventory, migration ledger, selected integrity fingerprints). Compare restored state against T0 snapshot. Success condition: `RESTORED_T0 == SOURCE_T0`. Historical C2A values (santri = 57, users = 18, staff = 10, mata_pelajaran = 9) remain documented only as checkpoint references.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 12), `scripts/backup-db.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** NOT EXECUTED.
  - **Target state:** Verified successful plain SQL restore with 100% dynamic parity (`RESTORED_T0 == SOURCE_T0`).
  - **Dependency:** REL-BCK-03
  - **Production write required?:** NO (Target is isolated scratch instance; production is never restore target)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Plain SQL restore command simulation (`psql`) against scratch DB.
  - **Positive test:** Database query verifies `RESTORED_T0 == SOURCE_T0` across all tables without data loss.
  - **Negative test:** Schema validation failure or row count drift against T0 snapshot aborts Gate 0.
  - **Reconciliation evidence:** Query outputs from restored scratch database compared against T0 snapshot.
  - **Rollback/recovery consideration:** Abort C2B if backup cannot be restored into scratch instance.
  - **Evidence Pack reference:** `EVID-BCK-RESTORE`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Awaiting dump artifact and restore environment)
  - **Notes / unresolved decision:** Mandatory safety gate before C2B migration.

---

### D. STAFF LINKAGE
- **REL-STF-01 | Baseline Staff Linkage Inventory**
  - **Domain:** IDENTITY / STAFF_LINKAGE
  - **Requirement:** Maintain verified record of linked Staff (`STF-0001` through `STF-0010`) and unlinked operational accounts. Ensure operational accounts link to active Staff records or are decommissioned/suspended.
  - **Source of truth:** `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md`, `lib/server/pendidikan-v2-readiness.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_C2A_BASELINE:** Audited in C2A preflight where 3 unlinked operational accounts (`musyrifah.putri`, `pembina.halaqoh`, `razan.mt`) resulted in `STAFF_LINKAGE_READY = BLOCKED`.
  - **CURRENT_GATE3_STATE:** Verified in production during Gate 3 partial completion. Legacy placeholder and duplicate accounts (`pembina.halaqoh`, `musyrifah.putri`, `razan.mt`) have been deactivated to `SUSPENDED` with zero Staff linkage. Canonical active operational accounts have active linked Staff records (`musyirfah.putri` -> `STF-0005`, `mudir` -> `STF-0001`, `musyrif.tahifzh` -> `STF-0003`, etc.). `STAFF_LINKAGE_READY` evaluates to `READY` in readiness verification (`lib/server/pendidikan-v2-readiness.ts`).
  - **Target state:** All active operational personal accounts maintain valid linked active Staff records; unlinked legacy accounts remain suspended without artificial Staff profiles.
  - **Dependency:** None (Already reconciled and verified in Gate 3)
  - **Production write required NOW?:** NO (Staff linkage reconciled; duplicate/placeholder accounts suspended; zero additional writes required)
  - **Owner authorization required?:** YES (Satisfied via DIR-2026-032, DIR-2026-033)
  - **Dry-run evidence:** C2A preflight table audit and Gate 3 provisioning evidence.
  - **Positive test:** Query confirms active operational accounts link to active Staff; `STAFF_LINKAGE_READY` passes.
  - **Negative test:** Fails closed if unexpected unlinked staff accounts mutate data or if suspended accounts attempt login.
  - **Reconciliation evidence:** Users table audit and `pendidikan-v2-readiness` gate verification.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-STF-AUDIT`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Reconciled per DIR-2026-032 and DIR-2026-033. Baseline accounts resolved; `STAFF_LINKAGE_READY` is READY. Zero additional writes required.

- **REL-STF-02 | Operational Account Linkage Resolution (musyrifah.putri & pembina.halaqoh)**
  - **Domain:** IDENTITY / STAFF_LINKAGE
  - **Requirement:** Authoritative resolution of operational accounts `pembina.halaqoh`, `musyrifah.putri`, and `musyirfah.putri` per DIR-2026-032 and DIR-2026-033:
    - `pembina.halaqoh`: Legacy placeholder account, target status = `SUSPENDED`, no Staff linkage, no hard delete (DIR-2026-032).
    - `musyrifah.putri`: Duplicate legacy account of Ustazah Lisa, target status = `SUSPENDED`, no Staff linkage, no merge, no hard delete (DIR-2026-033).
    - `musyirfah.putri`: Canonical active Lisa account linked to `STF-0005` (DIR-2026-001, DIR-2026-033).
    - [HISTORICAL]: Prior pre-resolution audit noted `ACCOUNT_MODALITY = UNRESOLVED / MUST_VERIFY` with `PolicyDecisionState = PROPOSED_TBD` pending Owner decision.
  - **Source of truth:** `docs/STQ_OWNER_DIRECTIVES.md` (DIR-2026-032, DIR-2026-033), `docs/STQ_CURRENT_STATE.md` (Section 9)
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-032 and DIR-2026-033)
  - **HISTORICAL_PRE_GATE_STATE / HISTORICAL_EXECUTION:** Prior pre-resolution audit recorded these as pending controlled Gate 3 production write; UPDATE `users` status to `SUSPENDED` was executed and verified during the authorized Gate 3 partial production batch.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Verified in production: `musyirfah.putri = AKTIF / STF-0005`, `musyrifah.putri = SUSPENDED`, `pembina.halaqoh = SUSPENDED`.
  - **Target state:** `musyirfah.putri` remains canonical active account for Ustazah Lisa (`STF-0005`); `pembina.halaqoh` and `musyrifah.putri` remain `SUSPENDED` without Staff linkage, without merge, and without hard delete.
  - **Dependency:** None (Already verified in production)
  - **Production write required NOW?:** NO (Already provisioned and verified in production)
  - **Owner authorization required?:** YES (Granted via DIR-2026-032 and DIR-2026-033)
  - **Dry-run evidence:** Gate 3 provisioning dry-run audit plan.
  - **Positive test:** Target status matches SUSPENDED for legacy placeholder / duplicate accounts, while canonical active account retains valid Staff linkage to STF-0005.
  - **Negative test:** Rejects linkage for suspended legacy accounts; rejects hard deletion or merging of duplicate accounts.
  - **Reconciliation evidence:** Users table query diff confirms `musyirfah.putri = AKTIF / STF-0005`, `musyrifah.putri = SUSPENDED`, `pembina.halaqoh = SUSPENDED`.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never blanket-null fields. Never hard delete.
  - **Evidence Pack reference:** `EVID-STF-LINKAGE`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Reconciled per DIR-2026-032 and DIR-2026-033. No unresolved account modality remains for these accounts. Account suspension verified in production. Zero additional production writes required.

- **REL-STF-03 | Non-Staff Account Modality Validation (santri, wali, yayasan, osda)**
  - **Domain:** IDENTITY / MODALITY
  - **Requirement:** Validate that accounts without Staff linkage (`santri.obama`, `santri.fatih`, `walisantri`, `yayasan`, `osda`) correctly adhere to their designated modality and do not trigger fake linkage errors.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 6)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Verified present in production without staff linkage.
  - **Target state:** Formally classified in C2C schema.
  - **Dependency:** GATE-C2B
  - **Production write required?:** NO (or additive `accountType` in C2C)
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Account categorization script.
  - **Positive test:** Modality rules pass for non-staff accounts.
  - **Negative test:** Attempt to assign staff-only position to santri account fails closed.
  - **Reconciliation evidence:** Modality audit report.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-STF-NONSTAFF`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Not every unlinked user is an error.

---

### E. ACCOUNT CLEANUP / DECOMMISSION
- **REL-ACC-01 | razan.mt Deprecation & Linkage Prohibition**
  - **Domain:** IDENTITY / ACCOUNT_DECOMMISSION
  - **Requirement:** Enforce Business Owner decision: `razan.mt` is DEPRECATED / DECOMMISSION TARGET. Strictly PROHIBIT linking to Staff `STF-0003` (or any Staff profile). Strictly PROHIBIT granting Position, Assignment, Capability, or runtime authority. Target implementation is decommission via schema-supported deactivation/revocation (`status = NONAKTIF` or `SUSPENDED`). Hard delete remains prohibited pending read-only dependency audit. Post-decommission evidence must prove: (1) new login denied; (2) existing cookie/JWT cannot obtain a valid server-resolved session (`user.status != AKTIF`); (3) server actions and API operations deny the account; (4) zero canonical assignments/grants; (5) no duplicate Kabid authority.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9), `STQ_PROJECT_CONTEXT.md` (Section 6)
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_GATE_STATE:** `RAZAN_MT_TARGET_STATE = DECOMMISSION`, `RAZAN_MT_STAFF_LINKAGE = PROHIBITED`, pending execution prior to Gate 3.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** `DECOMMISSION_EXECUTED_AND_VERIFIED`. Accepted Gate 3 evidence confirms `razan.mt = SUSPENDED`, staff linkage = `NONE`, and canonical assignments = `0`. Hard delete remains prohibited.
  - **Target state:** Maintained in decommissioned state (`status = SUSPENDED`, zero Staff linkage, zero canonical assignments, login denied).
  - **Dependency:** None (Decommission executed and verified)
  - **Production write required NOW?:** NO (Decommission mutation already executed and verified in production; hard delete remains prohibited)
  - **Owner authorization required?:** YES (Satisfied by owner decision)
  - **Dry-run evidence:** Documentation lock and Gate 3 provisioning evidence.
  - **Positive test:** Automated audit verifies zero canonical assignments granted to `razan.mt`, login denied, and server session resolver rejects deactivated user.
  - **Negative test:** Any attempt to link `razan.mt` to `STF-0003` or authenticate deactivated session throws fatal error.
  - **Reconciliation evidence:** Production audit confirms `razan.mt` is SUSPENDED with 0 staff links and 0 assignments.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ACC-RAZAN`
  - **Gate:** GATE-3
  - **Status:** `DECOMMISSION_EXECUTED_AND_VERIFIED`
  - **Notes / unresolved decision:** Decommission executed and verified; hard delete remains prohibited. Zero additional production writes required.

- **REL-ACC-02 | razan.mt Pre-Decommission Read-Only Dependency Audit**
  - **Domain:** IDENTITY / AUDIT
  - **Requirement:** Comprehensive read-only dependency audit for legacy account `razan.mt` prior to deactivation/deletion in production (historical records, transactions, audit logs, active sessions, halaqoh ownership, and foreign keys). Hard delete remains prohibited.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9), Gate 3 Completion Evidence
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_DECOMMISSION_AUDIT:** Was required before mutation to evaluate foreign keys and historical transaction dependencies.
  - **CURRENT_STATE:** Decommission already executed and verified in production during Gate 3 partial completion. `razan.mt = SUSPENDED`, staff linkage = `NONE`, canonical assignments = `0`. Zero additional decommission audit or mutation is blocking the final Gate 3 batch. Hard delete remains prohibited.
  - **Target state:** Maintained in decommissioned state (`status = SUSPENDED`, zero Staff linkage, zero canonical assignments); hard delete prohibited.
  - **Dependency:** None (Decommission executed and verified)
  - **Production write required NOW?:** NO (Already executed and verified; zero additional writes required)
  - **Owner authorization required?:** YES (Satisfied)
  - **Dry-run evidence:** Gate 3 provisioning evidence and dependency verification.
  - **Positive test:** Audit verifies `razan.mt` is SUSPENDED with 0 staff links and 0 assignments.
  - **Negative test:** Hard delete rejected; any attempt to link `razan.mt` to Staff or grant canonical authority fails closed.
  - **Reconciliation evidence:** Production audit confirms `razan.mt` is SUSPENDED with 0 staff links and 0 assignments.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ACC-RAZAN-DEP`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Historical prerequisite satisfied. Decommission executed and verified; hard delete remains prohibited. Zero additional production writes required.

- **REL-ACC-03 | musyrif.tahifzh Business Owner Designation & Pre-Provisioning Verification**
  - **Domain:** IDENTITY / KABID_TAHFIZH
  - **Requirement:** Document operational account designation `musyrif.tahifzh` as Business Owner designated canonical identity; verify User -> Staff linkage and operational Kabid assignment. Preserve exact spelling.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9), `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-030`, Gate 3 Completion Evidence
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-030)
  - **HISTORICAL_PRE_GATE_STATE:** Prior to Gate 3 provisioning, Staff linkage was tracked as `UNKNOWN / MUST_VERIFY_READ_ONLY`.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Verified in production: `musyrif.tahifzh` -> linked to `STF-0003` (Ust. Razan Mufli, S.Pd) -> `isKepalaBidangTahfidz = true` -> holds exactly 1 active `KABID_TAHFIZH` Assignment anchored to `OU-TAHFIZH`.
  - **Target state:** Maintained with verified Staff linkage (`STF-0003`) and 1 active canonical `KABID_TAHFIZH` Assignment at `OU-TAHFIZH`.
  - **Dependency:** None (Already verified in production)
  - **Production write required NOW?:** NO for identity/linkage verification (Already verified in production; assignment provisioned; zero additional writes required)
  - **Owner authorization required?:** YES (Granted via DIR-2026-030)
  - **Dry-run evidence:** Gate 3 provisioning write plan and diagnostic evidence.
  - **Positive test:** Query verifies `musyrif.tahifzh` links to `STF-0003` with active `KABID_TAHFIZH` assignment anchored to `OU-TAHFIZH`.
  - **Negative test:** Rejects if target user not confirmed or duplicate Kabid authority detected.
  - **Reconciliation evidence:** Users and assignments table queries confirm verified linkage and assignment.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ACC-MUSYRIF-TAH`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Reconciled per DIR-2026-030. Verified in production; preserve exact spelling `musyrif.tahifzh`. Zero additional writes required.

- **REL-ACC-04 | Duplicate Kabid Authority Prevention**
  - **Domain:** IDENTITY / AUTHORIZATION
  - **Requirement:** Verify that exactly ONE active operational account holds the canonical `KABID_TAHFIZH` position; ensure zero duplicate authority between `razan.mt` and `musyrif.tahifzh`.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 8), Gate 3 Completion Evidence
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_GATE_STATE:** Both accounts had `CANONICAL_ASSIGNMENT_AUTHORITY = ZERO`.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Singular Kabid seat is now provisioned in production: `musyrif.tahifzh` is the canonical Kabid identity (`STF-0003`) holding exactly 1 active `KABID_TAHFIZH` Assignment anchored to `OU-TAHFIZH`. `razan.mt` is `SUSPENDED` with zero Staff linkage and zero canonical Assignment. Zero duplicate authority exists.
  - **Target state:** Exactly one active canonical Assignment for `KABID_TAHFIZH`; zero duplicate authority across legacy and canonical layers.
  - **Dependency:** None (Single Kabid seat verified in production)
  - **Production write required NOW?:** NO (Validation satisfied; assignment already provisioned)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Assignment uniqueness validation query and effective access audit.
  - **Positive test:** Exactly 1 active assignment for position code `KABID_TAHFIZH`.
  - **Negative test:** Multiple active assignments trigger fail-closed error.
  - **Reconciliation evidence:** Audit query of `assignments` table confirms 1 active Kabid Tahfizh assignment.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-ACC-KABID-DUP`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Enforces single leadership seat; satisfied in production.

- **REL-ACC-05 | pembina.halaqoh Legacy Placeholder Account Suspension Target**
  - **Domain:** IDENTITY / ACCOUNT_DECOMMISSION
  - **Requirement:** Enforce Business Owner decision `DIR-2026-032`: `pembina.halaqoh` is a legacy placeholder account destined for `SUSPENDED` status. All 6 active halaqoh have verified active pembina personal accounts. Hard delete is strictly PROHIBITED; Staff linkage is strictly PROHIBITED; historical records preserved.
  - **Source of truth:** `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-032`, `types/architecture-lock.ts:CANONICAL_IDENTITY_RESOLUTION_CONTRACT`
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_GATE_STATE:** `status: AKTIF`, `staff_id: null`, 0 sessions, 0 audit logs.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** `status: SUSPENDED`, `staff_id: null`. Deactivation executed and verified in production during Gate 3 partial completion batch.
  - **Target state:** `status: SUSPENDED` without Staff linkage, without hard delete.
  - **Dependency:** None (Already verified suspended in production)
  - **Production write required NOW?:** NO (Already executed and verified in production)
  - **Owner authorization required?:** YES (Granted via DIR-2026-032)
  - **Evidence Pack reference:** `EVID-ACC-PEMBINA-HALAQOH`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`

- **REL-ACC-06 | musyrifah.putri Ustazah Lisa Duplicate Account Resolution & Suspension Target**
  - **Domain:** IDENTITY / DATA_INTEGRITY
  - **Requirement:** Enforce Business Owner decision `DIR-2026-033`: `musyrifah.putri` is a duplicate legacy account belonging to Ustazah Lisa Dwina Fitri. Canonical active account for Lisa is `musyirfah.putri` (linked to `STF-0005`). Target status for `musyrifah.putri` is `SUSPENDED`. Distinct User rows in DB; zero merge; zero Staff link transfer; zero hard delete.
  - **Source of truth:** `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-033`, `types/architecture-lock.ts:CANONICAL_IDENTITY_RESOLUTION_CONTRACT`
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_GATE_STATE:** `status: AKTIF`, `staff_id: null`, 2 historical logins, 0 transactions.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** `status: SUSPENDED`, `staff_id: null`. Deactivation executed and verified in production during Gate 3 partial completion batch; canonical active account remains `musyirfah.putri` (`AKTIF / STF-0005`).
  - **Target state:** `status: SUSPENDED` without Staff linkage, without merge, and without hard delete.
  - **Dependency:** None (Already verified suspended in production)
  - **Production write required NOW?:** NO (Already executed and verified in production)
  - **Owner authorization required?:** YES (Granted via DIR-2026-033)
  - **Evidence Pack reference:** `EVID-ACC-MUSYRIFAH-PUTRI`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`

---

### F. ORG UNITS
- **REL-OU-01 | Institutional Root & Domain Unit Provisioning**
  - **Domain:** ORG_UNITS / FOUNDATION
  - **Requirement:** Provision approved institutional topology (`DIR-2026-030`): single institutional root `OU-STQ-ROOT` (type `INSTITUTION`, domain `INSTITUTIONAL`, parent `null`, genderComplex `TIDAK_TERIKAT`) and Tahfizh domain unit `OU-TAHFIZH` (type `DOMAIN`, domain `TAHFIZH`, parent `OU-STQ-ROOT`, genderComplex `TIDAK_TERIKAT`). Minimum approved Keasramaan units (`OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT`) preserved. Proposed anchor code `OU-INSTITUTION` is formally superseded. Other units (`OU-AKADEMIK`, `OU-MANAJEMEN`) remain deferred.
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-030`
  - **PolicyDecisionState:** `APPROVED` (for `OU-STQ-ROOT`, `OU-TAHFIZH`, `OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT`; `OU-INSTITUTION` SUPERSEDED)
  - **HISTORICAL_PRE_GATE_STATE:** Unprovisioned prior to Gate 3 provisioning batch.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** `OU-STQ-ROOT` and `OU-TAHFIZH` are PROVISIONED and VERIFIED in production. `OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT` exist in DB. (Note: `OU-KEASRAMAAN` remains separate and pending the final authorized Gate 3 batch per DIR-2026-036).
  - **Target state:** Approved institutional topology provisioned idempotently.
  - **Dependency:** Gate 3 controlled write authorization (executed and verified in production)
  - **Production write required NOW?:** NO (OU-STQ-ROOT and OU-TAHFIZH already provisioned and verified in production; zero additional writes required)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Gate 3 Write Plan.
  - **Positive test:** Query verifies `OU-STQ-ROOT` and `OU-TAHFIZH` exist with correct parent hierarchy.
  - **Negative test:** Duplicate code prevented.
  - **Reconciliation evidence:** Pre/post table row counts.
  - **Rollback/recovery consideration:** Transaction rollback / compensating action.
  - **Evidence Pack reference:** `EVID-OU-ROOT`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Single institutional root `OU-STQ-ROOT` and `OU-TAHFIZH` provisioned; `OU-INSTITUTION` superseded. Zero additional production writes required.

- **REL-OU-02 | OSDA Root & Division Unit Provisioning**
  - **Domain:** ORG_UNITS / KEASRAMAAN
  - **Requirement:** Provision `OU-OSDA-ROOT` (type `ORGANIZATION`) and 5 divisions (`KEAMANAN_KEDISIPLINAN`, `PENDIDIKAN_IBADAH`, `KEBERSIHAN_KERAPIHAN`, `KESEHATAN`, `SARANA_PRASARANA`). Authoritative parent anchor unit `OU-KEASRAMAAN` (type `DOMAIN`, domain `KEASRAMAAN`, parent `OU-STQ-ROOT`) is approved per DIR-2026-036. OSDA divisions remain unprovisioned pending future controlled provisioning; do NOT claim divisions are already provisioned in production.
  - **Source of truth:** `types/architecture-lock.ts` (`CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.KEASRAMAAN_DOMAIN`), `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-036`
  - **PolicyDecisionState:** `APPROVED` (Parent anchor `OU-KEASRAMAAN` approved per DIR-2026-036)
  - **Current state:** Parent anchor `OU-KEASRAMAAN` approved target; divisions unprovisioned in production.
  - **Target state:** Hierarchy provisioned under authorized parent anchor `OU-KEASRAMAAN` in future controlled provisioning batch.
  - **Dependency:** REL-OU-01, DIR-2026-036
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Relational hierarchy verifies `parentId = OU-OSDA-ROOT.id` under approved parent anchor `OU-KEASRAMAAN`.
  - **Negative test:** Rejects creation if parent unit missing or unapproved.
  - **Reconciliation evidence:** OrgUnit tree query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-OU-OSDA`
  - **Gate:** GATE-C2C
  - **Status:** `TARGET_APPROVED_PENDING_PRODUCTION_WRITE`
  - **Notes / unresolved decision:** Parent unit anchor `OU-KEASRAMAAN` approved per DIR-2026-036; divisions pending controlled provisioning.

- **REL-OU-03 | TKS Root & Service Unit Provisioning**
  - **Domain:** ORG_UNITS / KEASRAMAAN
  - **Requirement:** Provision `OU-TKS-ROOT` and 6 service units: `OU-TKS-DAPUR`, `OU-TKS-MASJID`, `OU-TKS-PENDIDIKAN`, `OU-TKS-YAYASAN`, `OU-TKS-AIR-MINUM`, `OU-TKS-AIR-SUMUR`. Authoritative parent anchor unit `OU-KEASRAMAAN` is approved per DIR-2026-036. TKS service units remain unprovisioned pending future controlled provisioning; do NOT claim service units are already provisioned.
  - **Source of truth:** `types/architecture-lock.ts` (`CANONICAL_ORG_UNIT_HIERARCHY_CONTRACT.KEASRAMAAN_DOMAIN`), `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-036`
  - **PolicyDecisionState:** `APPROVED` (Parent anchor `OU-KEASRAMAAN` approved per DIR-2026-036)
  - **Current state:** Parent anchor `OU-KEASRAMAAN` approved target; service units unprovisioned in production.
  - **Target state:** Hierarchy provisioned under authorized parent anchor `OU-KEASRAMAAN` in future controlled provisioning batch.
  - **Dependency:** REL-OU-01, DIR-2026-036
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Service units correctly map to `SERVICE_UNIT` type under approved parent anchor `OU-KEASRAMAAN`.
  - **Negative test:** `hasCentralKetua = false` constraint verified; rejects if parent unapproved.
  - **Reconciliation evidence:** OrgUnit tree query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-OU-TKS`
  - **Gate:** GATE-C2C
  - **Status:** `TARGET_APPROVED_PENDING_PRODUCTION_WRITE`
  - **Notes / unresolved decision:** Parent unit anchor `OU-KEASRAMAAN` approved per DIR-2026-036; service units pending controlled provisioning.

- **REL-OU-04 | Halaqoh & Kamar Unit Backfill Reconciliation**
  - **Domain:** ORG_UNITS / BACKFILL
  - **Requirement:** Reconcile existing production halaqoh circles into OrgUnit representations (`type: HALAQOH`, `domain: TAHFIZH`, `parent: OU-TAHFIZH`). Current verified six halaqoh mappings approved per DIR-2026-035: `HLQ-0001 -> OU-HLQ-0001`, `HLQ-0002 -> OU-HLQ-0002`, `HLQ-0003 -> OU-HLQ-0003`, `HLQ-0004 -> OU-HLQ-0004`, `HLQ-0005 -> OU-HLQ-0005`, `HLQ-0006 -> OU-HLQ-0006`. Kamar units remain deferred when 0 active kamars exist.
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-035`
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-035 for exact current-six halaqohs)
  - **Current state:** Current-six declarative mapping locked in code; pending authorized production write batch.
  - **Target state:** 1:1 OrgUnit representation for each of the six approved halaqoh circles under parent `OU-TAHFIZH`.
  - **Dependency:** REL-OU-01 (OU-TAHFIZH provisioned)
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES (Granted via DIR-2026-035)
  - **Dry-run evidence:** Dry-run mapping existing halaqoh IDs to target OrgUnits.
  - **Positive test:** All 6 current halaqohs have corresponding `OU-HLQ-xxxx` OrgUnits with `parent = OU-TAHFIZH`.
  - **Negative test:** Zero orphaned halaqohs; wrong parent fails closed.
  - **Reconciliation evidence:** Row count match between active 6 `halaqoh` and `org_units WHERE type = 'HALAQOH'`.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-OU-HALAQOH`
  - **Gate:** GATE-3
  - **Status:** `TARGET_APPROVED_PENDING_PRODUCTION_WRITE`
  - **Notes / unresolved decision:** Exact 6 current halaqoh OrgUnit backfill mappings approved per DIR-2026-035.

---

### G. POSITIONS
- **REL-POS-01 | Institutional Leadership Positions Provisioning**
  - **Domain:** POSITIONS / LEADERSHIP
  - **Requirement:** Provision leadership positions strictly limited to approved gate set (`REQUIRED_POSITIONS_READY`): `MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`. Do NOT create duplicate/synonym position codes such as `KEPALA_BIDANG_TAHFIZH`, `MUSYRIF_KEASRAMAAN`, `KEPALA_SEKOLAH` as independent canonical positions. ("Kepala Keasramaan = Musyrif Keasramaan" is terminology equivalence, not permission to seed two duplicate canonical positions; `KEPALA_SEKOLAH` is `PROPOSED_TBD / DEFERRED`).
  - **Source of truth:** `types/architecture-lock.ts`, `lib/server/pendidikan-v2-readiness.ts`
  - **PolicyDecisionState:** `APPROVED` (for approved gate set)
  - **HISTORICAL_PRE_GATE_STATE:** Unseeded in production (`positions = 0`).
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Provisioned and verified in production during Gate 3 provisioning (`REQUIRED_POSITIONS_READY: READY`). All required leadership position templates (`MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`) exist in the production `positions` table.
  - **Target state:** Exact approved leadership positions provisioned with `isLeadership = true`, `requiresPersonalAccount = true`.
  - **Dependency:** REL-OU-01
  - **Production write required?:** NO (Templates already provisioned in production; active user assignments evaluated independently)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Gate 3 provisioning evidence (`BATCH_B3_POSITIONS.log`).
  - **Positive test:** Position query confirms exact approved leadership positions exist with correct allowed unit types and domain.
  - **Negative test:** Duplicate code constraint blocks collision.
  - **Reconciliation evidence:** Position table audit (`REQUIRED_POSITIONS_READY: READY`).
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows.
  - **Evidence Pack reference:** `EVID-POS-LEAD`
  - **Gate:** GATE-3 (C2C)
  - **Status:** `VERIFIED_PRODUCTION` (Templates provisioned in production; user assignments evaluated under `USER_ASSIGNMENTS_READY`)
  - **Notes / unresolved decision:** Musyrif Keasramaan = Kepala Keasramaan.

- **REL-POS-02 | Operational Staff Positions Provisioning**
  - **Domain:** POSITIONS / OPERATIONAL
  - **Requirement:** Provision operational positions strictly limited to approved gate set: `PETUGAS_OPERASIONAL_TAHFIZH`, `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`, `PETUGAS_OPERASIONAL_KEASRAMAAN`, and canonical position `GURU_KEPESANTRENAN` (formalized in PR #29 / DIR-2026-028). Additional operational positions (`MUDABBIR`, `GURU_AKADEMIK`) are `PROPOSED_TBD / DEFERRED`.
  - **Source of truth:** `types/architecture-lock.ts`, `lib/server/pendidikan-v2-readiness.ts`
  - **PolicyDecisionState:** `APPROVED` (for approved operational gate set; `PROPOSED_TBD` for `GURU_AKADEMIK` and `MUDABBIR`)
  - **HISTORICAL_PRE_GATE_STATE:** Unseeded in production.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Provisioned and verified in production during Gate 3 provisioning (`REQUIRED_POSITIONS_READY: READY`). All 5 approved operational position templates exist in the production `positions` table (8/8 required positions present overall).
  - **Target state:** Exact approved operational positions provisioned with correct domain and unit type constraints.
  - **Dependency:** REL-POS-01
  - **Production write required?:** NO (Templates already provisioned in production; active user assignments evaluated independently)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Gate 3 provisioning evidence (`BATCH_B3_POSITIONS.log`).
  - **Positive test:** `MUSYRIF_TAHFIZH` and `PEMBINA_HALAQOH` allow unit type `HALAQOH`; `PETUGAS_OPERASIONAL_KEASRAMAAN` allows `ORGANIZATION` / `DIVISION`.
  - **Negative test:** Disallowed unit type rejected.
  - **Reconciliation evidence:** Position table audit (`REQUIRED_POSITIONS_READY: READY`).
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows.
  - **Evidence Pack reference:** `EVID-POS-OPS`
  - **Gate:** GATE-3 (C2C)
  - **Status:** `VERIFIED_PRODUCTION` (Templates provisioned in production; user assignments evaluated under `USER_ASSIGNMENTS_READY`)
  - **Notes / unresolved decision:** Operational templates.

- **REL-POS-03 | Student Leadership & Desk Positions Provisioning**
  - **Domain:** POSITIONS / STUDENT
  - **Requirement:** Provision exactly the 4 canonical student leadership core positions: `KETUA_OSDA`, `SEKRETARIS_OSDA`, `BENDAHARA_OSDA`, `MULTIMEDIA_OSDA` (`OSDA_CORE_POSITION_CODES = CANONICAL / APPROVED STRUCTURAL FACT`). `OSDA_DIVISIONS` defines organizational divisions, not automatically Position codes (`OSDA_DIVISION_POSITION_CODES = PROPOSED_TBD / EXACT CODES NOT YET DEFINED`). Exclude any unspecified division-role Position creation; do not seed invented Position codes for divisions until exact canonical codes are approved.
  - **Source of truth:** `types/architecture-lock.ts` (`KEASRAMAAN_STRUCTURE.OSDA_CORE_POSITIONS`)
  - **PolicyDecisionState:** `APPROVED` (for the 4 canonical core positions; `PROPOSED_TBD` for division position codes)
  - **Current state:** Unseeded in production.
  - **Target state:** Provisioned under `KEASRAMAAN` domain for the 4 canonical core positions.
  - **Dependency:** REL-POS-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL for the 4 core positions.
  - **Positive test:** Core positions allow `ORGANIZATION` and `DIVISION` unit types.
  - **Negative test:** Rejects invalid domain binding; blocks unapproved division position codes.
  - **Reconciliation evidence:** Position table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-POS-STUDENT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Student leadership core positions locked; division position codes TBD.

- **REL-POS-04 | Unit Functional Desk Positions Provisioning**
  - **Domain:** POSITIONS / UNIT_DESK
  - **Requirement:** UNIT accounts (`AccountType.UNIT`) represent functional desks and are an account modality, not a Position definition. UNIT accounts may receive canonical Assignments only through an approved Position and must retain verified human executor attribution for mutations.
    - **Approved Canonical Position Template:** `PETUGAS_OPERASIONAL_KEASRAMAAN` is an approved canonical Position template, provisioned and verified in production under `KEASRAMAAN` domain. The technical unit account `osda.putri` belongs to this template but remains `SUSPENDED` per DIR-2026-037; its active Assignment and runtime executor activation are deferred pending independent proof of human executor attribution and assignment scope units.
    - **Unapproved Speculative Position Codes:** Speculative UNIT position codes (e.g. `UNIT_OPERASIONAL_PUTRI`, `UNIT_POSKESTREN`, `UNIT_TKS`) remain `PROPOSED_TBD` in canonical architecture and must NOT be provisioned unless a future explicit Business Owner/canonical contract approves those exact codes. Do not invent a Position merely because `accountType = UNIT`.
  - **Source of truth:** `types/architecture-lock.ts` (`AccountType.UNIT` modality rule, DIR-2026-037)
  - **PolicyDecisionState:** `APPROVED` for `PETUGAS_OPERASIONAL_KEASRAMAAN` template; `PROPOSED_TBD` for speculative/unapproved unit desk position codes
  - **HISTORICAL_PRE_GATE_STATE:** Unapproved / unseeded in production.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** `PETUGAS_OPERASIONAL_KEASRAMAAN` template is provisioned and verified in production (`REQUIRED_POSITIONS_READY: READY`). `osda.putri` account is present with target/current status `SUSPENDED`. Active assignment and runtime activation remain deferred. Other speculative unit position codes remain unseeded and unapproved.
  - **Target state:** Unit credential modality governed; `PETUGAS_OPERASIONAL_KEASRAMAAN` template provisioned; speculative position codes blocked until explicitly approved.
  - **Dependency:** REL-POS-01, Business Owner Decision
  - **Production write required?:** NO for template (already provisioned); speculative codes BLOCKED
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** UNIT account assignment permitted only through explicitly approved Position codes.
  - **Negative test:** Rejects provisioning or assignment to invented/unapproved unit Position codes.
  - **Reconciliation evidence:** Position table audit (`REQUIRED_POSITIONS_READY: READY`).
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-POS-UNIT`
  - **Gate:** GATE-3 (C2C)
  - **Status:** `RESOLVED_TEMPLATE_PROVISIONED_ACCOUNT_DEFERRED` (`PETUGAS_OPERASIONAL_KEASRAMAAN` template provisioned; `osda.putri` suspended; speculative desk position codes remain `PROPOSED_TBD`)
  - **Notes / unresolved decision:** Approved PETUGAS_OPERASIONAL_KEASRAMAAN template distinguished from unapproved future UNIT desk position codes.

---

### H. CAPABILITIES
- **REL-CAP-01 | Canonical Capability Catalog Registration**
  - **Domain:** CAPABILITIES / REGISTRATION
  - **Requirement:** Register exactly the 9 approved canonical capabilities:
    1. `academic.schedule.read`
    2. `academic.session.start`
    3. `academic.material.record`
    4. `academic.attendance.record`
    5. `tahfizh.recap.read`
    6. `tahfizh.reward.issue`
    7. `tahfizh.target.manage`
    8. `keasramaan.permission.read`
    9. `keasramaan.permission.create`
    Canonical distinction: `REGISTERED_CAPABILITY_CATALOG_COUNT = 9` (catalog count in DB) vs `REQUIRED_UAT_ACTIVATION_CAPABILITY_COUNT = 8` (runtime activation capabilities evaluated by `REQUIRED_UAT_ACTIVATION_CAPABILITIES`).
  - **Source of truth:** `types/architecture-lock.ts` (`ACADEMIC_CAPABILITIES`, `TAHFIZH_M32_CAPABILITIES`, `KEASRAMAAN_PERMISSION_CAPABILITIES`)
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_GATE_STATE:** Unseeded in production (`capabilities = 0`).
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Provisioned and verified in production during Gate 3 provisioning (`CAPABILITIES_REGISTERED: READY`). All 9 canonical capabilities are registered in the production `capabilities` table (`REGISTERED_CAPABILITY_CATALOG_COUNT = 9`), and all 8 required activation capabilities are verified at runtime (`REQUIRED_UAT_ACTIVATION_CAPABILITY_COUNT = 8`).
  - **Target state:** Registered in `capabilities` table.
  - **Dependency:** GATE-C2B
  - **Production write required?:** NO (Already provisioned and verified in production)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Gate 3 provisioning evidence (`BATCH_B4_CAPABILITIES.log`).
  - **Positive test:** `SELECT count(*) FROM capabilities` returns 9.
  - **Negative test:** Disallowed arbitrary capability codes rejected.
  - **Reconciliation evidence:** Capabilities catalog audit (`CAPABILITIES_REGISTERED: READY`).
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-CAP-9UAT`
  - **Gate:** GATE-3 (C2C)
  - **Status:** `VERIFIED_PRODUCTION` (Registered catalog present in production)
  - **Notes / unresolved decision:** All 9 catalog capabilities registered; 8 required for UAT activation.

- **REL-CAP-02 | Deferred Academic Capabilities Retention in Code Only**
  - **Domain:** CAPABILITIES / DEFERRED
  - **Requirement:** Keep remaining academic capabilities (`academic.score.input`, `academic.score.read`, `academic.rapor.print`, `academic.curriculum.manage`, `academic.session.complete`, `academic.cohort.manage`, `academic.teaching_assignment.manage`, `academic.session.view`) deferred; do not seed as active UAT targets.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** Defined in TypeScript; unseeded in DB.
  - **Target state:** Retained as deferred.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Inspection of C2C seed manifests confirms absence.
  - **Positive test:** Automated test verifies deferred capabilities are not in UAT active set.
  - **Negative test:** Fail closed if deferred capability grants runtime access.
  - **Reconciliation evidence:** Capabilities catalog audit.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-CAP-DEFERRED`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Prevents premature scope expansion.

- **REL-CAP-03 | Prohibited Approval Capabilities Exclusion**
  - **Domain:** CAPABILITIES / EXCLUSION
  - **Requirement:** Ensure `keasramaan.permission.approve_mk` and `keasramaan.permission.approve_ks` remain strictly excluded from operational position grants.
  - **Source of truth:** `types/architecture-lock.ts` (`UAT_ACTIVATION_TARGETS`)
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** Excluded from target grants.
  - **Target state:** Excluded in production PositionCapability mappings.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Manifest verification in `types/architecture-lock.ts`.
  - **Positive test:** Authorization engine denies approval capabilities for operational staff.
  - **Negative test:** Any attempt to map approval capability to operational position fails closed.
  - **Reconciliation evidence:** Audit query of `position_capabilities`.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-CAP-EXCLUDE`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Keasramaan approval authority remains unresolved.

---

### I. POSITION CAPABILITIES
- **REL-PC-01 | PETUGAS_OPERASIONAL_TAHFIZH Grants Mapping**
  - **Domain:** POSITION_CAPABILITIES / TAHFIZH
  - **Requirement:** Map `tahfizh.recap.read` with `scopeType: GLOBAL`. Note: `tahfizh.reward.issue` for `PETUGAS_OPERASIONAL_TAHFIZH` is formally **SUPERSEDED** per DIR-2026-023 (reward issuance is restricted to Mudir [GLOBAL] and Kabid Tahfizh [DOMAIN] only; POT does not hold reward capability).
  - **Source of truth:** `types/architecture-lock.ts`, `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-023`
  - **BusinessRuleState:** `APPROVED_TARGET_PENDING_TECHNICAL` (for `tahfizh.recap.read`; `tahfizh.reward.issue` is SUPERSEDED)
  - **Current state:** Unmapped in production.
  - **Target state:** Mapped with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL` for `tahfizh.recap.read`.
  - **Dependency:** REL-POS-02, REL-CAP-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Query verifies `scopeType = GLOBAL` for recap.
  - **Negative test:** Engine denies reward issuance for POT (`CAPABILITY_NOT_GRANTED`).
  - **Reconciliation evidence:** PositionCapability table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-PC-OP-TAH`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Reward issuance NEVER global for operational staff.

- **REL-PC-02 | Target Management Grants Mapping (MUSYRIF_TAHFIZH & PEMBINA_HALAQOH)**
  - **Domain:** POSITION_CAPABILITIES / TAHFIZH
  - **Requirement:** Map `tahfizh.target.manage` with `scopeType: HALAQOH` for `MUSYRIF_TAHFIZH` and `PEMBINA_HALAQOH`.
  - **Source of truth:** `types/architecture-lock.ts` (`UAT_ACTIVATION_TARGETS.TARGET_MANAGEMENT`)
  - **BusinessRuleState:** `APPROVED_TARGET_PENDING_TECHNICAL`
  - **Current state:** Unmapped in production.
  - **Target state:** Mapped with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL`.
  - **Dependency:** REL-POS-02, REL-CAP-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Query confirms `scopeType = HALAQOH`.
  - **Negative test:** Engine denies cross-halaqoh target edits.
  - **Reconciliation evidence:** PositionCapability table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-PC-TGT-MGT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Strictly own assigned halaqoh only.

- **REL-PC-03 | PETUGAS_OPERASIONAL_KEASRAMAAN Grants Mapping**
  - **Domain:** POSITION_CAPABILITIES / KEASRAMAAN
  - **Requirement:** Map `keasramaan.permission.read` and `keasramaan.permission.create` with `scopeType: ASSIGNED_UNITS`.
  - **Source of truth:** `types/architecture-lock.ts` (`UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN`)
  - **BusinessRuleState:** `APPROVED_TARGET_PENDING_TECHNICAL`
  - **Current state:** Unmapped in production.
  - **Target state:** Mapped with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL`.
  - **Dependency:** REL-POS-02, REL-CAP-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Query confirms `scopeType = ASSIGNED_UNITS`.
  - **Negative test:** Engine denies create/read outside assigned scope units.
  - **Reconciliation evidence:** PositionCapability table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-PC-OP-KEA`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Read/create only; zero approval authority.

- **REL-PC-04 | Academic Capabilities Policy & Grant Mapping Blocker**
  - **Domain:** POSITION_CAPABILITIES / AKADEMIK
  - **Requirement:** Evaluate academic capabilities (`academic.schedule.read`, `academic.session.start`, `academic.material.record`, `academic.attendance.record`). Canonical classification:
    - `ACADEMIC_CAPABILITY_REGISTRATION = REQUIRED` (The four capabilities must be registered in the `capabilities` table as part of the exact 9 UAT set).
    - `ACADEMIC_POSITION_GRANT_POLICY = RESOLVED` (`GURU_KEPESANTRENAN` formalized under `PERSONAL` modality with `GLOBAL` capability scope and server-side teacher ownership per PR #29 / DIR-2026-028; Studi Umum resolved as `SUBJECT` modality under `AcademicSubjectAccountBinding` per PR #28 / DIR-2026-027; legacy `GURU_AKADEMIK` remains unapproved/deprecated).
    - `ACADEMIC_SCOPE_POLICY = RESOLVED` (`GLOBAL` capability scope for `GURU_KEPESANTRENAN`, where server-side teacher and session ownership `scheduledStaffId === actorStaffId` and `actualTeacherUserId === actorUserId` enforce actual authorization boundaries; `SUBJECT` account binding for Studi Umum).
    - `ACADEMIC_ACCOUNT_MODALITY = RESOLVED` (Studi Umum subject accounts use `SUBJECT` modality per PR #28 / DIR-2026-027; Kepesantrenan teachers use `PERSONAL` modality under canonical position `GURU_KEPESANTRENAN` per PR #29 / DIR-2026-028).
    - `ACADEMIC_UNIT_CONTAINMENT = RESOLVED_VIA_TEACHER_OWNERSHIP` (For `GURU_KEPESANTRENAN`, `GLOBAL` capability scope eliminates artificial OrgUnit containment requirements while server-side teacher/session ownership strictly enforces boundaries; Studi Umum is bound via `AcademicSubjectAccountBinding`).
    - `GURU_KEPESANTRENAN` is an approved canonical position contract under PERSONAL modality (PR #29 / DIR-2026-028).
    Activation remains gated by sequential release controls (C2C provisioning and C2D activation flag).
  - **Source of truth:** `types/architecture-lock.ts`, `lib/server/pendidikan-v2-readiness.ts`, `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-028`
  - **BusinessRuleState:** `APPROVED_TARGET_PENDING_TECHNICAL`
  - **HISTORICAL_PRE_GATE_STATE:** Unmapped prior to Gate 3 provisioning.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Exactly 4 `GURU_KEPESANTRENAN` PositionCapability rows exist in the production database with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL` (`academic.schedule.read`, `academic.session.start`, `academic.material.record`, `academic.attendance.record`; all with `scopeType: GLOBAL`). Runtime activation is `NOT_READY` under `KEPESANTRENAN_ACADEMIC_AUTH_POLICY_READY`. Promotion to `VERIFIED_PRODUCTION` is `NOT EXECUTED / NOT AUTHORIZED` and belongs to a future explicitly authorized activation process outside this PR.
  - **Target state:** Maintained with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL`; runtime activation remains deferred pending owner authorization.
  - **Dependency:** None for creation (rows already exist in production)
  - **Production write required NOW for creation?:** NO (Rows are already present and verified in production; any future promotion write belongs to a later explicitly authorized activation process)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Capability registration script verification and Gate 3 provisioning logs.
  - **Positive test:** Query confirms 4 academic PositionCapability rows exist for `GURU_KEPESANTRENAN` with `scopeType: GLOBAL` and `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL`.
  - **Negative test:** Fail closed if unapproved PositionCapability grant is attempted without resolved modality and containment; runtime activation remains NOT_READY without explicit owner promotion.
  - **Reconciliation evidence:** PositionCapability and Capability catalog table audit in Gate 3 diagnostic.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state.
  - **Evidence Pack reference:** `EVID-PC-GURU-AKAD`
  - **Gate:** GATE-3
  - **Status:** `TARGET_APPROVED_PROVISIONED_PENDING_ACTIVATION` (`GURU_KEPESANTRENAN` PositionCapability rows provisioned; runtime activation remains NOT_READY)
  - **Notes / unresolved decision:** GURU_KEPESANTRENAN contract resolved under PERSONAL modality with 4 approved capabilities and server-side teacher ownership; Studi Umum resolved via SUBJECT accounts with 3 capabilities (attendance deferred). Creation writes are complete.

---

### J. ASSIGNMENTS
- **REL-ASN-01 | Mudir & Leadership Assignment Provisioning**
  - **Domain:** ASSIGNMENTS / LEADERSHIP
  - **Requirement:** Provision active Assignment for Mudir anchored to approved single institutional root `OU-STQ-ROOT` (`DIR-2026-030`). Target operational account verified: `mudir` (linked to `STF-0001`, Ust. Andi Quarzy Ayatullah). Proposed anchor `OU-INSTITUTION` is formally superseded. Assignment for Kabid Tahfizh anchors to `OU-TAHFIZH` under account `musyrif.tahifzh` (linked to `STF-0003`, Ust. Razan Mufli). Assignment for Guru Kepesantrenan anchors to `OU-STQ-ROOT`.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md`, `types/architecture-lock.ts:CANONICAL_ASSIGNMENT_ANCHORS`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-030`
  - **PolicyDecisionState:** `APPROVED` (Anchor `OU-STQ-ROOT` approved; account `mudir` verified; anchor `OU-INSTITUTION` superseded)
  - **HISTORICAL_PRE_GATE_STATE:** Unprovisioned prior to Gate 3 provisioning batch.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** 1 active assignment for `mudir` provisioned and verified in production batch anchored to `OU-STQ-ROOT` (linked to `STF-0001`).
  - **Target state:** Provisioned with `status: ACTIVE` anchored to `OU-STQ-ROOT`.
  - **Dependency:** None (Already provisioned and verified in production)
  - **Production write required NOW?:** NO (Active assignment already exists at OU-STQ-ROOT; zero additional writes required)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Gate 3 Write Plan.
  - **Positive test:** Mudir assignment active in DB query under verified account `mudir` and approved anchor `OU-STQ-ROOT`.
  - **Negative test:** Expired window fails closed; unapproved anchor fails closed.
  - **Reconciliation evidence:** Assignment query confirms 1 active Mudir assignment.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> transaction rollback / compensating action.
  - **Evidence Pack reference:** `EVID-ASN-LEAD`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Anchor `OU-STQ-ROOT` approved; Mudir active assignment provisioned. Zero additional production writes required.

- **REL-ASN-02 | Musyrif Tahfizh Halaqoh Assignments Provisioning**
  - **Domain:** ASSIGNMENTS / TAHFIZH
  - **Requirement:** Provision active Assignments for Musyrif Tahfizh anchored to their respective `HALAQOH` OrgUnits (`OU-HLQ-0001` through `OU-HLQ-0006`). Current-six deterministic mapping approved per DIR-2026-035:
    - `HLQ-0001` -> Ust. Razan Mufli (`musyrif.tahifzh` / `STF-0003`) -> `OU-HLQ-0001` (PUTRA)
    - `HLQ-0002` -> Ust. Kamal (`kamal.ph` / `STF-0006`) -> `OU-HLQ-0002` (PUTRA)
    - `HLQ-0003` -> Ust. Rizaldi (`rizaldi.ph` / `STF-0007`) -> `OU-HLQ-0003` (PUTRA)
    - `HLQ-0004` -> Ust. Abi Hudzaifah (`hudzaifah.ph` / `STF-0008`) -> `OU-HLQ-0004` (PUTRA)
    - `HLQ-0005` -> Ust. Alwan (`alwan.ph` / `STF-0009`) -> `OU-HLQ-0005` (PUTRA)
    - `HLQ-0006` -> Ustazah Lisa Dwina Fitri (`musyirfah.putri` / `STF-0005`) -> `OU-HLQ-0006` (PUTRI)
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_CURRENT_SIX_HALAQOH_MAPPINGS`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-035`
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-035 for exact current-six halaqohs)
  - **Current state:** Declarative deterministic mapping locked in code; pending authorized production write batch.
  - **Target state:** Provisioned with `status: ACTIVE` linking each active musyrif to their canonical `HALAQOH` OrgUnit.
  - **Dependency:** REL-OU-04, REL-POS-02, REL-STF-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES (Granted via DIR-2026-035)
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Each of the 6 active musyrif has assignment matching their halaqoh OrgUnit.
  - **Negative test:** Mismatched halaqoh access denied; unlinked user rejected.
  - **Reconciliation evidence:** Pre/post assignment audit matching exact 6 halaqohs.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-ASN-MT`
  - **Gate:** GATE-3
  - **Status:** `TARGET_APPROVED_PENDING_PRODUCTION_WRITE`
  - **Notes / unresolved decision:** Relational link between musyrif and canonical halaqoh OrgUnits approved per DIR-2026-035.

- **REL-ASN-03 | Kabid Tahfizh Operational Assignment Provisioning**
  - **Domain:** ASSIGNMENTS / TAHFIZH
  - **Requirement:** Provision active Assignment for designated Kabid Tahfizh account (`musyrif.tahifzh`, linked to `STF-0003`, Ust. Razan Mufli). Canonical anchor is `OU-TAHFIZH` (type `DOMAIN`, domain `TAHFIZH`, parent `OU-STQ-ROOT`), formally approved per DIR-2026-030. Unit `OU-TAHFIZH` and active assignment for `musyrif.tahifzh` are now provisioned in production.
  - **Source of truth:** `docs/STQ_OWNER_DIRECTIVES.md` (DIR-2026-030), `types/architecture-lock.ts` (`CANONICAL_ASSIGNMENT_ANCHORS.KABID_TAHFIZH`)
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-030)
  - **HISTORICAL_PRE_GATE_STATE:** Unprovisioned prior to Gate 3 provisioning batch.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Exactly 1 active assignment for `KABID_TAHFIZH` under `musyrif.tahifzh` (linked to `STF-0003`) provisioned and verified in production batch anchored to `OU-TAHFIZH`.
  - **Target state:** Exactly 1 active assignment provisioned for `KABID_TAHFIZH` anchored to `OU-TAHFIZH`.
  - **Dependency:** None (Already provisioned and verified in production)
  - **Production write required NOW?:** NO (KABID_TAHFIZH active assignment already exists at OU-TAHFIZH; zero additional writes required)
  - **Owner authorization required?:** YES (Granted via DIR-2026-030)
  - **Dry-run evidence:** Gate 3 provisioning write plan.
  - **Positive test:** Exactly 1 active assignment for `KABID_TAHFIZH` under approved anchor `OU-TAHFIZH`.
  - **Negative test:** Rejects if target user not confirmed or duplicate exists or anchor unit context is missing/unresolved.
  - **Reconciliation evidence:** Assignment query confirms 1 active Kabid Tahfizh assignment.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-ASN-KABID`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Anchor unit approved as `OU-TAHFIZH` per DIR-2026-030; assignment provisioned. Zero additional production writes required.

- **REL-ASN-04 | Academic Teacher Assignments Provisioning**
  - **Domain:** ASSIGNMENTS / AKADEMIK
  - **Requirement:** Provision active Assignments for academic teachers (`GURU_KEPESANTRENAN` under `PERSONAL` modality). Teacher account modality is resolved for Kepesantrenan as `PERSONAL` under `GURU_KEPESANTRENAN` with `GLOBAL` capability scope and server-side teacher/session ownership (PR #29 / DIR-2026-028), and for Studi Umum as `SUBJECT` modality under `AcademicSubjectAccountBinding` with zero fake Staff profiles (PR #28 / DIR-2026-027). Canonical anchor is `OU-STQ-ROOT`.
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_KEPESANTRENAN_TEACHER_MAPPINGS`, `docs/STQ_M3_RELEASE_DEPENDENCIES.md`, `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-028`
  - **PolicyDecisionState:** `APPROVED` (for `GURU_KEPESANTRENAN` PERSONAL and Studi Umum SUBJECT contracts)
  - **HISTORICAL_PRE_GATE_STATE:** Unprovisioned prior to Gate 3 partial provisioning batch.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Exactly 7 active assignments for `GURU_KEPESANTRENAN` provisioned and verified in production anchored to `OU-STQ-ROOT`. Exactly 12 Kepesantrenan TeachingAssignments provisioned and verified in production (PUTRA = 7, PUTRI = 5). Studi Umum remains SUBJECT binding architecture without Staff linkage.
  - **Target state:** Maintained with 7 active GURU_KEPESANTRENAN Assignments and 12 Kepesantrenan TeachingAssignments provisioned in production.
  - **Dependency:** None for currently provisioned rows
  - **Production write required NOW?:** NO (7 GURU_KEPESANTRENAN active assignments and 12 Kepesantrenan TeachingAssignments are already provisioned and verified in production; zero additional teacher-assignment INSERT is required)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL and Gate 3 provisioning evidence.
  - **Positive test:** Teacher assignments active in query under approved anchor `OU-STQ-ROOT` (7 rows) and 12 TeachingAssignments verified.
  - **Negative test:** Unassigned teacher denied session start; cross-teacher session start denied (`SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`).
  - **Reconciliation evidence:** Assignment table query confirms 7 active GURU_KEPESANTRENAN assignments; TeachingAssignment query confirms 12 active Kepesantrenan rows.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-ASN-TEACHER`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Resolved under approved GURU_KEPESANTRENAN PERSONAL contract and Studi Umum SUBJECT account architecture. 7 active assignments and 12 TeachingAssignments already provisioned; zero additional writes required now.

- **REL-ASN-05 | Petugas Operasional Tahfizh (POT) Assignment Provisioning**
  - **Domain:** ASSIGNMENTS / TAHFIZH
  - **Requirement:** Provision active Assignment for Petugas Operasional Tahfizh (`PETUGAS_OPERASIONAL_TAHFIZH`) anchored to `OU-TAHFIZH` per DIR-2026-034. Designated canonical holder is `musyirfah.putri` (linked to `STF-0005`, Ustazah Lisa Dwina Fitri). Target capability scope is `GLOBAL` for `tahfizh.recap.read`; zero reward issuance authority (`tahfizh.reward.issue` strictly denied per DIR-2026-023).
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_POT_CONTRACT`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-034`
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-034)
  - **Current state:** Account `musyirfah.putri` active and linked to `STF-0005`; unit `OU-TAHFIZH` provisioned; POT assignment pending authorized production write batch.
  - **Target state:** Exactly 1 active assignment for `PETUGAS_OPERASIONAL_TAHFIZH` under `musyirfah.putri` anchored to `OU-TAHFIZH`.
  - **Dependency:** REL-OU-01 (OU-TAHFIZH provisioned), DIR-2026-034
  - **Production write required?:** YES (INSERT in production write batch)
  - **Owner authorization required?:** YES (Granted via DIR-2026-034)
  - **Dry-run evidence:** POT dry-run assignment plan.
  - **Positive test:** Query verifies active POT assignment for `musyirfah.putri` anchored to `OU-TAHFIZH`.
  - **Negative test:** Rejects reward issuance attempt; fails closed if anchor unit missing.
  - **Reconciliation evidence:** Assignment query for `PETUGAS_OPERASIONAL_TAHFIZH`.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> transaction rollback / compensating action.
  - **Evidence Pack reference:** `EVID-ASN-POT`
  - **Gate:** GATE-3
  - **Status:** `TARGET_APPROVED_PENDING_PRODUCTION_WRITE`
  - **Notes / unresolved decision:** Holder and anchor approved per DIR-2026-034; zero reward authority per DIR-2026-023.

- **REL-ASN-06 | Kepala Keasramaan Assignment Provisioning**
  - **Domain:** ASSIGNMENTS / KEASRAMAAN
  - **Requirement:** Provision active Assignment for Kepala Keasramaan (`KEPALA_KEASRAMAAN`) anchored to `OU-KEASRAMAAN` per DIR-2026-036. Designated canonical holder is `musyrif.asrama` (linked to `STF-0004`, Ust. Mujaddid Zhohruddin).
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_KEPALA_KEASRAMAAN_CONTRACT`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-036`
  - **PolicyDecisionState:** `APPROVED` (per DIR-2026-036)
  - **Current state:** Account `musyrif.asrama` active and linked to `STF-0004`; anchor `OU-KEASRAMAAN` approved target; assignment pending authorized production write batch.
  - **Target state:** Exactly 1 active assignment for `KEPALA_KEASRAMAAN` under `musyrif.asrama` anchored to `OU-KEASRAMAAN`.
  - **Dependency:** Provisioning of `OU-KEASRAMAAN` under `OU-STQ-ROOT`, DIR-2026-036
  - **Production write required?:** YES (INSERT in production write batch)
  - **Owner authorization required?:** YES (Granted via DIR-2026-036)
  - **Dry-run evidence:** Kepala Keasramaan assignment plan.
  - **Positive test:** Query verifies active assignment for `musyrif.asrama` anchored to `OU-KEASRAMAAN`.
  - **Negative test:** Fails closed if anchor unit missing or unapproved.
  - **Reconciliation evidence:** Assignment query for `KEPALA_KEASRAMAAN`.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> transaction rollback / compensating action.
  - **Evidence Pack reference:** `EVID-ASN-KEPALA-ASR`
  - **Gate:** GATE-3
  - **Status:** `TARGET_APPROVED_PENDING_PRODUCTION_WRITE`
  - **Notes / unresolved decision:** Holder and anchor approved per DIR-2026-036.

- **REL-ASN-07 | Petugas Operasional Keasramaan Assignment Deferral**
  - **Domain:** ASSIGNMENTS / KEASRAMAAN
  - **Requirement:** Operational account `osda.putri` remains in `SUSPENDED` status per DIR-2026-037; active assignment for `PETUGAS_OPERASIONAL_KEASRAMAAN` is intentionally deferred; zero runtime activation authorized until verified human executor attribution path and scope unit bindings are formally proven.
  - **Source of truth:** `types/architecture-lock.ts:CANONICAL_PETUGAS_OPERASIONAL_KEASRAMAAN_CONTRACT`, `docs/STQ_OWNER_DIRECTIVES.md:DIR-2026-037`
  - **PolicyDecisionState:** `APPROVED` (for deferral and account suspension)
  - **Current state:** Account `osda.putri` target SUSPENDED; assignment deferred; zero active assignments.
  - **Target state:** Account `osda.putri` SUSPENDED; zero active assignments until human executor path is proven.
  - **Dependency:** DIR-2026-037
  - **Production write required?:** NO (zero assignment write; account suspension handled in account state reconciliation)
  - **Owner authorization required?:** YES (Granted via DIR-2026-037)
  - **Dry-run evidence:** Inspection confirms no active assignment for `osda.putri`.
  - **Positive test:** Zero active assignments exist for `osda.putri` or `PETUGAS_OPERASIONAL_KEASRAMAAN`.
  - **Negative test:** Rejects unauthorized activation without human executor attribution.
  - **Reconciliation evidence:** Assignment query confirms zero active assignments.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ASN-OP-KEA-DEF`
  - **Gate:** GATE-3
  - **Status:** `DEFERRED_PENDING_OWNER_ACTIVATION`
  - **Notes / unresolved decision:** Account suspended and assignment deferred per DIR-2026-037.

---

### K. ASSIGNMENT SCOPE UNITS
- **REL-ASU-01 | Operational Tahfizh Scope Units Binding (SUPERSEDED)**
  - **Domain:** SCOPE_UNITS / TAHFIZH
  - **Requirement:** [SUPERSEDED] Prior requirement to bind halaqoh scope units for operational reward issuance is formally **SUPERSEDED** by DIR-2026-023 because `PETUGAS_OPERASIONAL_TAHFIZH` does not hold `tahfizh.reward.issue`.
  - **Source of truth:** `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-023`
  - **PolicyDecisionState:** `SUPERSEDED`
  - **Current state:** Unseeded in production.
  - **Target state:** SUPERSEDED (no scope unit binding needed for POT reward issuance).
  - **Dependency:** REL-ASN-02, REL-PC-01
  - **Production write required?:** NO (SUPERSEDED by DIR-2026-023; POT does not issue rewards)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Bound unit IDs match approved target units.
  - **Negative test:** Unbound unit ID fails closed.
  - **Reconciliation evidence:** Scope units table query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-ASU-TAH`
  - **Gate:** GATE-C2C
  - **Status:** `SUPERSEDED`
  - **Notes / unresolved decision:** Historical target policy superseded per DIR-2026-023; POT holds zero reward write authority.

- **REL-ASU-02 | Operational Keasramaan Scope Units Binding**
  - **Domain:** SCOPE_UNITS / KEASRAMAAN
  - **Requirement:** For assignments holding `keasramaan.permission.*`, bind permitted dorm/kamar unit IDs relationally in `assignment_scope_units`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Relational scope units bound.
  - **Dependency:** REL-PC-03, REL-OU-02
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Bound unit IDs match approved dormitories.
  - **Negative test:** Cross-unit permission creation denied.
  - **Reconciliation evidence:** Scope units table query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-ASU-KEA`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Scope isolation.

- **REL-ASU-03 | Academic Teacher Scope Units Binding**
  - **Domain:** SCOPE_UNITS / AKADEMIK
  - **Requirement:** Binding academic teachers to scope units. Under the canonical education model (PR #28 / DIR-2026-027 and PR #29 / DIR-2026-028), `AssignmentScopeUnit` is **intentionally NOT required** for academic flows:
    - For `GURU_KEPESANTRENAN`, authorization is resolved using `GLOBAL` capability scope combined with server-side teacher and session ownership (`scheduledStaffId === actorStaffId` and `actualTeacherUserId === actorUserId`).
    - For `Studi Umum`, teachers use `SUBJECT` modality governed by `AcademicSubjectAccountBinding` directly binding subject accounts to canonical subjects.
    - `AssignmentScopeUnit.unitId` strictly references `OrgUnit.id`. Cohort IDs and Subject IDs are NOT OrgUnit IDs, and no obsolete pseudo-OrgUnit requirement is needed or used.
  - **Source of truth:** `types/architecture-lock.ts`, `prisma/schema.prisma`, `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-027, DIR-2026-028`
  - **PolicyDecisionState:** `RESOLVED_VIA_TEACHER_OWNERSHIP_AND_SUBJECT_BINDING` (AssignmentScopeUnit intentionally not required)
  - **HISTORICAL_PRE_GATE_STATE:** Classified as `BLOCKED_TECHNICAL` pending containment model resolution.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Resolved. `AssignmentScopeUnit` is intentionally not required for academic flows. 7 active `GURU_KEPESANTRENAN` assignments are anchored at `OU-STQ-ROOT` without scope units.
  - **Target state:** Academic teacher authorization enforced via `GLOBAL` capability scope + server-side teacher/session ownership (Kepesantrenan) and `AcademicSubjectAccountBinding` (Studi Umum).
  - **Dependency:** REL-ASN-04, REL-PC-04
  - **Production write required?:** NO (AssignmentScopeUnit intentionally not required for academic flows)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Schema and architecture lock verification.
  - **Positive test:** Teacher session ownership and subject bindings verified by test suite.
  - **Negative test:** Non-scheduled teacher starting session fails closed with `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`; unauthenticated teacher denied.
  - **Reconciliation evidence:** Academic session authorization test suite.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ASU-AKAD`
  - **Gate:** GATE-3 (C2C)
  - **Status:** `RESOLVED_NOT_REQUIRED` (`AssignmentScopeUnit` intentionally not required; authorization enforced via server-side session ownership and subject bindings)
  - **Notes / unresolved decision:** Pseudo-OrgUnit requirement eliminated; containment resolved via teacher ownership and subject binding.

---

### L. ACCOUNT MODALITY
- **REL-MOD-01 | PERSONAL Account Modality Invariants**
  - **Domain:** ACCOUNT_MODALITY / PERSONAL
  - **Requirement:** Asatidz and staff operational roles enforce `AccountType: PERSONAL`; sensitive positions require verified Staff profile linkage (`staff_id` not null).
  - **Source of truth:** `types/architecture-lock.ts`, `STQ_PROJECT_CONTEXT.md` (Section 6)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Policy locked in documentation and types.
  - **Target state:** Enforced across all active personal assignments.
  - **Dependency:** REL-STF-01
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Type definition in `types/architecture-lock.ts`.
  - **Positive test:** Personal accounts have active human linkage.
  - **Negative test:** Unlinked personal account rejected from sensitive position assignment.
  - **Reconciliation evidence:** Assignment engine unit tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-MOD-PERSONAL`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Core identity invariant.

- **REL-MOD-02 | UNIT Account Modality Invariants**
  - **Domain:** ACCOUNT_MODALITY / UNIT
  - **Requirement:** Unit accounts (`AccountType: UNIT`) represent functional desks; max active placement = 1; every mutating transaction must record verified `humanExecutorId` and immutable snapshot.
  - **Source of truth:** `types/architecture-lock.ts` (`UnitAccountPlacement`, `UnitAccountExecutorContext`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Defined in architecture lock; unseeded in DB.
  - **Target state:** Enforced in runtime execution and audit logger.
  - **Dependency:** REL-POS-04
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Unit tests in `tests/milestone2-authorization-engine.test.ts`.
  - **Positive test:** Audit log records both technical account and verified human executor.
  - **Negative test:** Mutating action without human executor fails closed.
  - **Reconciliation evidence:** Audit log schema check.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-MOD-UNIT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Non-repudiation contract.

- **REL-MOD-03 | Zero Username Authority Invariant**
  - **Domain:** ACCOUNT_MODALITY / INVARIANT
  - **Requirement:** Username and display name patterns must NEVER confer authority; authority derives strictly from active Assignment + PositionCapability + Scope + server-resolved resource context.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 5)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced across server actions and authorization engine.
  - **Target state:** Maintained indefinitely.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Architecture lock invariants.
  - **Positive test:** Renaming user account does not alter authority.
  - **Negative test:** Fails closed if username heuristic attempted in code.
  - **Reconciliation evidence:** Grep audit shows zero username matching in authorization logic.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-MOD-NOUSERNAME`
  - **Gate:** ALL GATES
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Universal invariant.

---

### M. OSDA PUTRI
- **REL-OPU-01 | OSDA Putri Unit Account Contract Enforcement**
  - **Domain:** OSDA_PUTRI / IDENTITY
  - **Requirement:** Account code `OU-OSDA-PUTRI`, `accountType: UNIT`, `genderComplex: PUTRI`, `maxActivePlacements: 1`, requires verified human executor.
  - **Source of truth:** `types/architecture-lock.ts` (`OSDA_PUTRI_UNIT_CONTRACT`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Defined in contract; unseeded in DB.
  - **Target state:** Provisioned in C2C.
  - **Dependency:** GATE-C2B, REL-OU-02
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Unit account placement strictly equals 1.
  - **Negative test:** Second simultaneous placement rejected.
  - **Reconciliation evidence:** UnitAccountPlacement table query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-OPU-CONTRACT`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Approved target pending technical.

- **REL-OPU-02 | PUTRA Data Leakage Prevention (Strict Isolation)**
  - **Domain:** OSDA_PUTRI / SECURITY
  - **Requirement:** `OU-OSDA-PUTRI` transactions and queries strictly fail closed on PUTRA santri data (`preventPutraAccess = true`).
  - **Source of truth:** `types/architecture-lock.ts` (`OSDA_PUTRI_UNIT_CONTRACT.INVARIANTS`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Contract verified in unit tests.
  - **Target state:** Enforced in production queries.
  - **Dependency:** REL-OPU-01
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Test suite `tests/milestone3-2-uat-business-rules.test.ts`.
  - **Positive test:** Query against santriwati succeeds.
  - **Negative test:** Query against santri putra throws `GENDER_COMPLEX_DENIED`.
  - **Reconciliation evidence:** Unit test execution logs.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-OPU-ISOLATION`
  - **Gate:** GATE-C2D / GATE-C2E
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Non-negotiable gender boundary.

- **REL-OPU-03 | Verified Human Executor Attribution for OSDA Putri**
  - **Domain:** OSDA_PUTRI / AUDIT
  - **Requirement:** All operational mutations executed via `OU-OSDA-PUTRI` must log verified `humanExecutorId` referencing active santriwati profile.
  - **Source of truth:** `types/architecture-lock.ts` (`UnitAccountExecutorContext`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Supported in canonical audit logging schema.
  - **Target state:** Active in production Server Actions.
  - **Dependency:** REL-OPU-01
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Audit test cases.
  - **Positive test:** Audit log row contains verified student executor.
  - **Negative test:** Null executor throws error on write.
  - **Reconciliation evidence:** Audit log schema check.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-OPU-EXEC`
  - **Gate:** GATE-C2C / GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Attribution enforcement.

---

### N. TAHFIZH
- **REL-TAH-01 | Tahfizh Single-Page Focus & UX Simplicity**
  - **Domain:** TAHFIZH / UX
  - **Requirement:** Setoran entry remains a focused single-page workflow; do not reintroduce unnecessary wizards or steppers.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 8)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Implemented in production UI.
  - **Target state:** Maintained intact.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** UI component inspection.
  - **Positive test:** Setoran form loads on single screen.
  - **Negative test:** Regression tests prevent stepper injection.
  - **Reconciliation evidence:** Component code check.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TAH-UX`
  - **Gate:** ALL GATES
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Operational ergonomics.

- **REL-TAH-02 | Halaqoh Attendance Vocabulary Invariant**
  - **Domain:** TAHFIZH / ATTENDANCE
  - **Requirement:** New halaqoh attendance entries strictly restricted to `HADIR`, `SAKIT`, `IZIN`, `ALFA`. `MASBUK` is strictly forbidden for new records.
  - **Source of truth:** `types/architecture-lock.ts` (`HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced in code and schema.
  - **Target state:** Maintained in production.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Validation in `types/architecture-lock.ts`.
  - **Positive test:** Submission with `HADIR` succeeds.
  - **Negative test:** Submission with `MASBUK` throws validation error.
  - **Reconciliation evidence:** Attendance test suite.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TAH-ATTEND`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Historical MASBUK records remain readable.

- **REL-TAH-03 | Timezone Invariant (WITA / Asia-Makassar)**
  - **Domain:** TAHFIZH / TIMEZONE
  - **Requirement:** Backdated tahfizh entries and operational dates strictly adhere to WITA (Asia-Makassar / UTC+8) semantics.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 8)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced in date parsing utilities.
  - **Target state:** Maintained in production.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Date utility unit tests.
  - **Positive test:** Date calculation matches WITA midnight boundary.
  - **Negative test:** UTC midnight mismatch caught.
  - **Reconciliation evidence:** Date utility tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TAH-TZ`
  - **Gate:** ALL GATES
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Operational location standard.

- **REL-TAH-04 | Tahajjud Attendance Choices Invariant**
  - **Domain:** TAHFIZH / TAHAJJUD
  - **Requirement:** Tahajjud attendance strictly limited to exactly two choices: `SHOLAT` and `ALFA`.
  - **Source of truth:** `types/architecture-lock.ts` (`TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced in code.
  - **Target state:** Maintained in production.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Enum export in `types/architecture-lock.ts`.
  - **Positive test:** `SHOLAT` and `ALFA` accepted.
  - **Negative test:** Any third option rejected.
  - **Reconciliation evidence:** Unit test suite.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TAH-TAHAJJUD`
  - **Gate:** GATE-C2D
  - **Status:** `BLOCKED` (Requires C2D activation)
  - **Notes / unresolved decision:** Locked attendance contract.

---

### O. KEASRAMAAN
- **REL-KEA-01 | Mudir -> Kepala Keasramaan -> Mudabbir Hierarchy Lock**
  - **Domain:** KEASRAMAAN / TOPOLOGY
  - **Requirement:** Canonical hierarchy locked: Mudir -> Kepala Keasramaan -> Mudabbir -> OSDA & TKS -> Usroh / Santri. Mudabbir is pembina kamar using personal account.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 7)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Locked in documentation and architecture types.
  - **Target state:** Enforced in C2C OrgUnit and Position trees.
  - **Dependency:** REL-OU-02, REL-POS-01
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Org tree verification.
  - **Positive test:** Hierarchy queries reflect approved nesting.
  - **Negative test:** Direct subordinate layer under Mudabbir rejected.
  - **Reconciliation evidence:** Architecture lock tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-KEA-HIERARCHY`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Mudabbir may supervise >1 kamar.

- **REL-KEA-02 | Operational Keasramaan Permission Read/Create Policy**
  - **Domain:** KEASRAMAAN / PERMISSION
  - **Requirement:** `PETUGAS_OPERASIONAL_KEASRAMAAN` holds read and create authority over permissions for assigned units only; approval capabilities excluded.
  - **Source of truth:** `types/architecture-lock.ts` (`UAT_ACTIVATION_TARGETS.OPERATIONAL_KEASRAMAAN`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Defined in architecture lock; unseeded in DB.
  - **Target state:** Active in C2D.
  - **Dependency:** REL-PC-03, REL-ASU-02
  - **Production write required?:** NO
  - **Owner authorization required?:** YES (Activation in C2D)
  - **Dry-run evidence:** Authorization engine unit tests.
  - **Positive test:** Create permission in assigned room succeeds.
  - **Negative test:** Create permission outside assigned room denied.
  - **Reconciliation evidence:** UAT test results.
  - **Rollback/recovery consideration:** Demote capability state to `PROPOSED_TBD` if bug detected.
  - **Evidence Pack reference:** `EVID-KEA-PERM`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Excludes `approve_mk` and `approve_ks`.

- **REL-KEA-03 | Usroh Cleaning Taskforce Structure**
  - **Domain:** KEASRAMAAN / USROH
  - **Requirement:** Usroh taskforces represent functional cleaning groups under OSDA; cleanliness functionally supervised by Divisi Kebersihan.
  - **Source of truth:** `types/architecture-lock.ts` (`OrgUnitType: USROH`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Defined in types; unseeded in DB.
  - **Target state:** Seeded in C2C.
  - **Dependency:** REL-OU-02
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Usroh units bound under `OU-OSDA-ROOT`.
  - **Negative test:** Invalid parent rejected.
  - **Reconciliation evidence:** OrgUnit table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-KEA-USROH`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Functional supervision model.

- **REL-KEA-04 | Kamar Dormitory Unit Integrity**
  - **Domain:** KEASRAMAAN / KAMAR
  - **Requirement:** Kamar units (`type: KAMAR`) strictly model physical boarding rooms within domain `KEASRAMAAN`; santri resident assignment is 1:1. Their exact authoritative parent OrgUnit must be resolved and approved before C2C provisioning. Fail closed if exact parent remains unresolved. Do not provision rooms bound to unapproved speculative parent code `OU-KEASRAMAAN`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED` (for KAMAR semantic/domain rule; `PROPOSED_TBD` for exact parent OrgUnit code)
  - **Current state:** Unseeded in DB; exact parent OrgUnit unresolved.
  - **Target state:** Seeded in C2C once authoritative parent OrgUnit is approved.
  - **Dependency:** REL-OU-01, Business Owner Decision
  - **Production write required?:** YES (INSERT; BLOCKED)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Kamar units use domain `KEASRAMAAN`; resident santri mapping is 1:1.
  - **Negative test:** Fail closed if exact parent OrgUnit remains unresolved; reject invalid gender complex binding.
  - **Reconciliation evidence:** OrgUnit table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-KEA-KAMAR`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting authoritative parent OrgUnit resolution; fail-closed)
  - **Notes / unresolved decision:** Physical dorm structure; exact parent OrgUnit anchor TBD.

---

### P. HEALTH
- **REL-HLT-01 | Health V2 Status Vocabulary Lock**
  - **Domain:** HEALTH / VOCABULARY
  - **Requirement:** Canonical statuses are exactly `DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`. Zero fake diagnosis, zero mock data.
  - **Source of truth:** `types/architecture-lock.ts` (`CANONICAL_HEALTH_STATUSES_V2`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Code complete; DB migration pending C2B.
  - **Target state:** Active in production database enum `HealthStatusV2`.
  - **Dependency:** REL-MIG-03
  - **Production write required?:** NO (Governed by migration)
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Unit tests in `tests/milestone3-3a-health-v2-backend.test.ts`.
  - **Positive test:** All 4 valid statuses accepted in health case events.
  - **Negative test:** Legacy status strings (`RAWAT_PONDOK`, etc.) rejected for new entries.
  - **Reconciliation evidence:** Enum catalog check.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-HLT-STATUS`
  - **Gate:** GATE-C2B
  - **Status:** `PASS` (Code contract locked)
  - **Notes / unresolved decision:** Non-negotiable data honesty.

- **REL-HLT-02 | Poskestren Structural Enclosure Under Keasramaan**
  - **Domain:** HEALTH / TOPOLOGY
  - **Requirement:** Poskestren / Health is structurally enclosed under the `KEASRAMAAN` domain (`HEALTH_STRUCTURAL_ENCLOSURE = APPROVED`). However, exact production OrgUnit codes (`EXACT_POSKESTREN_ORGUNIT_CODE = PROPOSED_TBD`) and parent codes (`EXACT_KEASRAMAAN_PARENT_CODE = PROPOSED_TBD`) are not approved canonical records. Do NOT provision speculative OrgUnit records such as `OU-POSKESTREN` under `OU-KEASRAMAAN`. Zero Health/Poskestren OrgUnit insertion until exact code and parent relationship are authoritatively approved. The business fact that Health/Poskestren belongs structurally inside `KEASRAMAAN` remains preserved.
  - **Source of truth:** `types/architecture-lock.ts` (`OrgDomain: KEASRAMAAN`)
  - **PolicyDecisionState:** `PROPOSED_TBD` (for exact topology provisioning; `APPROVED` for structural domain enclosure)
  - **Current state:** Unseeded in DB; exact unit and parent codes unresolved.
  - **Target state:** Structural enclosure preserved; exact DB insertion blocked pending code approval.
  - **Dependency:** REL-OU-01, Business Owner Decision
  - **Production write required?:** YES (INSERT; BLOCKED)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Health domain operations validate structural enclosure under `KEASRAMAAN` once exact unit and parent codes are approved.
  - **Negative test:** Rejects standalone top-level health domain; blocks insertion of unapproved speculative OrgUnit codes.
  - **Reconciliation evidence:** OrgUnit query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-HLT-TOPOLOGY`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Exact OrgUnit code and parent code not approved; zero insertion authorized)
  - **Notes / unresolved decision:** Decouples domain enclosure from speculative database codes.

- **REL-HLT-03 | External Health Referral Authority Decision**
  - **Domain:** HEALTH / GOVERNANCE
  - **Requirement:** External referral authority remains `PROPOSED_TBD` until explicit Business Owner approval. Zero operational write granted.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 18)
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** Unresolved; no capability activated.
  - **Target state:** Maintained unresolved/fail-closed.
  - **Dependency:** Business Owner Decision
  - **Production write required?:** NO
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Invariant check in `types/architecture-lock.ts`.
  - **Positive test:** Referral attempts without explicit grant fail closed.
  - **Negative test:** System blocks unauthorized external referrals.
  - **Reconciliation evidence:** Architecture lock tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-HLT-REFERRAL`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Unresolved business policy #9.

---

### Q. STUDI UMUM
- **REL-STU-01 | Studi Umum 6 Canonical Subjects Gap**
  - **Domain:** STUDI_UMUM / SUBJECTS
  - **Requirement:** Required 6 subjects: Matematika, Bahasa Inggris, IPS, IPA, Bahasa Indonesia, TIK. Currently production only contains ambiguous `Matematika Terapan`; remaining 5 missing.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 10)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** 5 missing, 1 ambiguous (`Matematika Terapan`).
  - **Target state:** Resolved and seeded in C2C.
  - **Dependency:** GATE-C2B, Explicit Owner Authorization
  - **Production write required?:** YES (INSERT / UPDATE in C2C)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL classifying as `CREATE` (5) and `CONFLICT/RENAME` (1).
  - **Positive test:** Query verifies 6 canonical subjects present.
  - **Negative test:** Duplicate code constraint prevents collision.
  - **Reconciliation evidence:** `mata_pelajaran` table query.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-STU-SUBJECTS`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion and owner decision)
  - **Notes / unresolved decision:** Do not mutate production subjects without authorization.

- **REL-STU-02 | Tingkat Studi Umum Position Semantics**
  - **Domain:** STUDI_UMUM / COHORTS
  - **Requirement:** Tingkat Studi Umum 1/2/3 represents current student program position. Formal school grade is separate and must NEVER define EducationCohort.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 10)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Locked in documentation and tests.
  - **Target state:** Enforced in cohort mapping logic.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Unit test in `tests/milestone3-3b-pendidikan-foundation.test.ts`.
  - **Positive test:** Cohort creation does not use school grade strings.
  - **Negative test:** Attempt to bind cohort by grade rejected.
  - **Reconciliation evidence:** Test suite verification.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-STU-TINGKAT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Wording clarified in PR #22.

- **REL-STU-03 | Studi Umum Pedagogical Level Mapping**
  - **Domain:** STUDI_UMUM / PEDAGOGY
  - **Requirement:** Map educational tracks to enum `PedagogicalLevel`: `TAHFIDZ_INTENSIF`, `DIROSAH_ISLAMIYAH`, `PBL`, `BAHASA_ARAB`, `BAHASA_INGGRIS`, `MATEMATIKA`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Code complete; DB migration pending C2B.
  - **Target state:** Active in production database enum `PedagogicalLevel`.
  - **Dependency:** REL-MIG-04
  - **Production write required?:** NO (Governed by migration)
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Migration SQL check.
  - **Positive test:** Query verifies enum values in database catalog.
  - **Negative test:** Disallowed level strings rejected.
  - **Reconciliation evidence:** Catalog inspection.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-STU-LEVELS`
  - **Gate:** GATE-C2B
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Pedagogical track definitions.

---

### R. KEPESANTRENAN
- **REL-KPS-01 | 5 Canonical Kepesantrenan Subjects Presence**
  - **Domain:** KEPESANTRENAN / SUBJECTS
  - **Requirement:** 5 canonical subjects verified present in production: Bahasa Arab (`KPS-ARB`), Fikih (`KPS-FQH`), Tafsir (`KPS-TFS`), Aqidah Islamiyah (`KPS-AQD`), Tajwid (`KPS-TJW`).
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 10)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Verified present in production database during C2A preflight audit.
  - **Target state:** Maintained intact.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** C2A preflight table audit.
  - **Positive test:** Query confirms all 5 rows exist with `status = KEPESANTRENAN`.
  - **Negative test:** Renaming or deleting blocked.
  - **Reconciliation evidence:** `mata_pelajaran` table query.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-KPS-SUBJECTS`
  - **Gate:** BASELINE
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Production reality verified.

- **REL-KPS-02 | Kepesantrenan Attendance Separation Contract**
  - **Domain:** KEPESANTRENAN / ATTENDANCE
  - **Requirement:** Structural separation between Teacher and Student attendance. Teacher attendance evidence = `SESSION_START_AUTHENTICATED_EXECUTION`. Student attendance options = `HADIR`, `IZIN`, `SAKIT`, `ALFA` (`MASBUK` forbidden).
  - **Source of truth:** `types/architecture-lock.ts` (`KEPESANTRENAN_ATTENDANCE_CONTRACT`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Locked in contract; runtime activation pending C2D.
  - **Target state:** Enforced in Pendidikan V2 Server Actions.
  - **Dependency:** REL-MIG-04
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Attendance contract types.
  - **Positive test:** Starting session authenticates teacher; recording student attendance validates statuses.
  - **Negative test:** Rejects `MASBUK` in student attendance.
  - **Reconciliation evidence:** Unit test suite.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-KPS-ATTEND`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Attendance vocabulary reconciled.

- **REL-KPS-03 | Kepesantrenan Reference Curricula Decision**
  - **Domain:** KEPESANTRENAN / CURRICULUM
  - **Requirement:** Reference textbooks/curricula for Fikih and Aqidah remain `PROPOSED_TBD` / unresolved business decision. Zero canonical curriculum locked.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 18)
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** Unresolved.
  - **Target state:** Maintained unresolved until owner decision.
  - **Dependency:** Business Owner Decision
  - **Production write required?:** NO
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Contract metadata fields nullable.
  - **Positive test:** System operates with reference = null.
  - **Negative test:** Hardcoded curriculum rejected.
  - **Reconciliation evidence:** Architecture lock tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-KPS-CURR`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Unresolved business decisions #6 & #7.

---

### S. SUBJECTS
- **REL-SBJ-01 | Ambiguous & Legacy Subject Deduplication Plan**
  - **Domain:** SUBJECTS / DEDUPLICATION
  - **Requirement:** Production contains legacy duplicates: `Bahasa Arab & Nahwu` vs `Bahasa Arab`, `Fiqih Ibadah` vs `Fikih`, `Matematika Terapan` vs `Matematika`. Design safe reconciliation plan without silent deletion.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 10)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Present in production.
  - **Target state:** Reconciled in C2C after dependency audit.
  - **Dependency:** GATE-C2B, Explicit Owner Authorization
  - **Production write required?:** YES (UPDATE / MERGE in C2C)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL checking foreign key references from grades.
  - **Positive test:** Historical grades retain FK integrity.
  - **Negative test:** Rejects hard delete if referencing grades exist.
  - **Reconciliation evidence:** Pre/post subject audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-SBJ-DEDUP`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion and owner authorization)
  - **Notes / unresolved decision:** Never silently mutate subject rows.

- **REL-SBJ-02 | Subject Category Separation (UMUM vs KEPESANTRENAN)**
  - **Domain:** SUBJECTS / CATEGORIES
  - **Requirement:** Strict separation in `mata_pelajaran.category`: `UMUM` vs `KEPESANTRENAN`.
  - **Source of truth:** `prisma/schema.prisma`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Verified in production schema.
  - **Target state:** Maintained.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Schema validation.
  - **Positive test:** Query verifies enum mapping.
  - **Negative test:** Invalid category string rejected.
  - **Reconciliation evidence:** Schema inspection.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-SBJ-CAT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Foundational subject classification.

- **REL-SBJ-03 | Subject Seed Idempotency Specification**
  - **Domain:** SUBJECTS / SEED_DESIGN
  - **Requirement:** Provisioning script for missing Studi Umum subjects must classify every record as `CREATE`, `EXISTS_MATCH`, `CONFLICT`, or `SKIP`.
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Design complete.
  - **Target state:** Executed in C2C.
  - **Dependency:** REL-SBJ-01
  - **Production write required?:** YES (in C2C)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Dry-run SQL simulation.
  - **Positive test:** Running seed twice results in 0 duplicate rows (`EXISTS_MATCH`).
  - **Negative test:** Unique `kode_mapel` prevents duplicate insertion.
  - **Reconciliation evidence:** Seed execution log.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows. Never blanket-null fields. Never run corrective production writes from a validation step alone.
  - **Evidence Pack reference:** `EVID-SBJ-IDEM`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Idempotent provisioning design.

---

### T. COHORTS
- **REL-COH-01 | Permanent Cohort Mapping Gap Specification**
  - **Domain:** COHORTS / DATA_GAP
  - **Requirement:** All 57 active santri lack authoritative permanent `angkatan` and `tahun_masuk` in production. Do NOT infer from gender, current class, or age.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 11)
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** `COHORT_MAPPING = NEEDS_BUSINESS_INPUT`.
  - **Target state:** Authoritative mapping table provided by Business Owner before backfill.
  - **Dependency:** Explicit Business Owner Decision
  - **Production write required?:** NO in this stage
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Audit query shows zero permanent cohort fields.
  - **Positive test:** System accepts external authoritative mapping file.
  - **Negative test:** Automatic inference from gender/class throws validation error.
  - **Reconciliation evidence:** Santri demographic audit.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-COH-GAP`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting Business Owner mapping)
  - **Notes / unresolved decision:** Unresolved business decision #1.

- **REL-COH-02 | EducationCohort Table Provisioning**
  - **Domain:** COHORTS / DDL_PROVISION
  - **Requirement:** Table `education_cohorts` created via migration M3.3B. Cohort rows represent permanent admission cohorts / year of entry (e.g. `2024/2025`, `2025/2026`), NEVER `Tingkat 1/2/3`. Do NOT plan automatic cohort creation from Tingkat, class, gender, or age. Seeding remains BLOCKED until authoritative business owner admission cohort data is provided.
  - **Source of truth:** `prisma/migrations/20260918140000_m3_3b_pendidikan_foundation/migration.sql`, Canonical Business Rule
  - **PolicyDecisionState:** `PROPOSED_TBD` (Awaiting authoritative admission year data from Business Owner)
  - **Current state:** DDL pending C2B; cohort seed definition BLOCKED pending admission year data.
  - **Target state:** Seeded in C2C after admission year data is provided.
  - **Dependency:** REL-MIG-04, REL-COH-01
  - **Production write required?:** YES (INSERT in C2C)
  - **Owner authorization required?:** YES (Admission cohort data sign-off)
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Cohort records queryable via Prisma with admission year labels.
  - **Negative test:** EducationCohort.code unique constraint blocks duplicate cohort codes (and verify tahunAjaranMasuk/startYear consistency separately).
  - **Reconciliation evidence:** Cohorts table audit.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows.
  - **Evidence Pack reference:** `EVID-COH-PROVISION`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting authoritative admission cohort data)
  - **Notes / unresolved decision:** Admission year semantics; Tingkat is current position only.

- **REL-COH-03 | santri.cohort_id Nullable Backfill Guard**
  - **Domain:** COHORTS / BACKFILL
  - **Requirement:** Backfill `santri.cohort_id` ONLY after authoritative mapping is approved; preserve nullability until 100% verified. Dynamic rule: 100% of the authoritatively in-scope active santri population captured at C2C preflight must either (A) have an approved permanent cohort mapping, or (B) cause the cohort gate to remain BLOCKED. Do not infer or silently exclude unmatched active santri.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 11)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Column absent in prod; backfill not started.
  - **Target state:** Backfilled in C2C after owner decision.
  - **Dependency:** REL-COH-01, REL-COH-02
  - **Production write required?:** YES (Future C2C UPDATE; CURRENT PR #25 EXECUTES ZERO PRODUCTION WRITES)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Backfill script `--dry-run` output.
  - **Positive test:** 100% of authoritatively in-scope active santri captured at C2C preflight linked to approved permanent cohorts (historical C2A count: 57).
  - **Negative test:** Abort if unmapped or unmatched active santri detected.
  - **Reconciliation evidence:** Pre/post santri table diff.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never blanket-null fields.
  - **Evidence Pack reference:** `EVID-COH-BACKFILL`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** High-risk data update; gated.

---

### U. TEACHING ASSIGNMENTS
- **REL-TEA-01 | TeachingAssignment Table Provisioning**
  - **Domain:** TEACHING_ASSIGNMENTS / DDL_PROVISION
  - **Requirement:** Table `teaching_assignments` created via migration M3.3B to model teacher ownership/assignment for subject + education track + gender complex + optional pedagogical level + validity period (Prisma fields: `mapelId`, `staffId`, `educationTrack`, `genderComplex`, `pedagogicalLevel`, `validFrom`, `validUntil`). Note: `TeachingAssignment` does NOT contain `cohortId` (`EducationSession` holds `cohortId` independently). Do not invent a TeachingAssignment -> cohort relation.
  - **Source of truth:** `prisma/migrations/20260918140000_m3_3b_pendidikan_foundation/migration.sql`
  - **PolicyDecisionState:** `APPROVED`
  - **HISTORICAL_PRE_GATE_STATE:** Table creation and seeding had not occurred prior to C2B execution.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** C2B / schema migration = COMPLETE; `teaching_assignments` table = PRESENT; exactly 12 canonical Kepesantrenan TeachingAssignments = PROVISIONED / VERIFIED in production (PUTRA = 7, PUTRI = 5). Future new teaching assignments are normal future business data, not a missing launch bootstrap task.
  - **Target state:** Maintained with table present and 12 canonical Kepesantrenan rows provisioned.
  - **Dependency:** None (Migration complete and 12 rows provisioned)
  - **Production write required NOW for those 12?:** NO (C2B schema migration complete and 12 canonical Kepesantrenan TeachingAssignments are already provisioned and verified in production)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL and Gate 3 provisioning evidence.
  - **Positive test:** Table queryable via Prisma with valid field bindings; 12 active Kepesantrenan TeachingAssignments verified.
  - **Negative test:** Invalid foreign keys or schema violations rejected.
  - **Reconciliation evidence:** TeachingAssignment table audit confirms 12 active Kepesantrenan rows.
  - **Rollback/recovery consideration:** STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state. Never delete pre-existing rows.
  - **Evidence Pack reference:** `EVID-TEA-PROVISION`
  - **Gate:** GATE-3
  - **Status:** `PROVISIONED_VERIFIED_IN_PROD`
  - **Notes / unresolved decision:** Relational teacher binding; 12 canonical rows provisioned; zero launch bootstrap writes required now.

- **REL-TEA-02 | Teacher Account Modality Decision Specification**
  - **Domain:** TEACHING_ASSIGNMENTS / GOVERNANCE
  - **Requirement:** Teacher account modality is resolved: Studi Umum resolved as SUBJECT via `AcademicSubjectAccountBinding` with zero fake Staff profiles (DIR-2026-027 / PR #28); Kepesantrenan resolved as PERSONAL Staff/User via `GURU_KEPESANTRENAN` with server-side teacher ownership (DIR-2026-028 / PR #29).
  - **Source of truth:** `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-027, DIR-2026-028`, `types/architecture-lock.ts`
  - **PolicyDecisionState:** `RESOLVED`
  - **HISTORICAL_PRE_GATE_STATE:** Previously tracked as unresolved business decision #2.
  - **CURRENT_VERIFIED_PRODUCTION_STATE:** Formally resolved in code and architecture contracts: Studi Umum = SUBJECT via `AcademicSubjectAccountBinding`; Kepesantrenan = PERSONAL Staff/User via `GURU_KEPESANTRENAN`.
  - **Target state:** Maintained as resolved architecture contract.
  - **Dependency:** None
  - **Production write required NOW?:** NO
  - **Owner authorization required?:** YES (Granted via DIR-2026-027 and DIR-2026-028)
  - **Dry-run evidence:** TypeScript interfaces and architecture lock tests.
  - **Positive test:** System enforces SUBJECT modality for Studi Umum and PERSONAL modality for Kepesantrenan.
  - **Negative test:** Unverified anonymous teacher credential rejected; fake Staff profile for subject account rejected.
  - **Reconciliation evidence:** Architecture lock tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TEA-MODALITY`
  - **Gate:** GATE-3
  - **Status:** `RESOLVED`
  - **Notes / unresolved decision:** Teacher account modality resolved; no unresolved business decision remains for teacher modality.

- **REL-TEA-03 | Substitute Teacher (Badal) Authorization Matrix**
  - **Domain:** TEACHING_ASSIGNMENTS / BADAL
  - **Requirement:** Substitute teacher authorization matrix remains `PROPOSED_TBD`. Actual authenticated teacher derived server-side.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 18)
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** Unresolved business decision #3.
  - **Target state:** Maintained unresolved until owner authorization.
  - **Dependency:** Explicit Business Owner Decision
  - **Production write required?:** NO
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Session start Server Action derivation logic.
  - **Positive test:** Scheduled teacher can start session.
  - **Negative test:** Arbitrary non-teacher user blocked from starting session.
  - **Reconciliation evidence:** Server Action unit tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TEA-BADAL`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Unresolved business decision #3.

---

### V. FEATURE FLAGS / POLICY ACTIVATION
- **REL-FLG-01 | PENDIDIKAN_V2_UAT_ENABLED Feature Flag Guard**
  - **Domain:** FEATURE_FLAGS / PENDIDIKAN_V2
  - **Requirement:** Runtime flag `PENDIDIKAN_V2_UAT_ENABLED` defaults to `false` in production. Must remain false through C2B and C2C; activated strictly in C2D under explicit owner authorization. Gate 5 C2D Pendidikan activation requires ALL of: (1) C2B schema reconciliation PASS; (2) C2C prerequisite provisioning PASS; (3) academic capability registration complete; (4) academic PositionCapability policy explicitly approved; (5) teacher account modality resolved; (6) teacher User/Staff identity linkage verified; (7) academic resource/unit containment resolved; (8) required academic Assignments resolved; (9) relevant TeachingAssignments verified; (10) Business Owner explicit C2D authorization. If ANY remains PROPOSED_TBD / BLOCKED: PENDIDIKAN_V2_UAT_ENABLED MUST REMAIN FALSE. Upstream generic Gate 4 status cannot bypass explicit academic blockers.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 8), `docs/STQ_M3_RELEASE_DEPENDENCIES.md` (Rule 9)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** `RUNTIME_ACTIVATION_FLAG = NOT_READY` (`false` in production).
  - **Target state:** Activated (`true`) in C2D only after ALL academic prerequisites pass.
  - **Dependency:** GATE-C2B, GATE-C2C, REL-PC-04, REL-ASN-04, REL-ASU-03, Explicit Owner Authorization
  - **Production write required?:** YES (Environment variable or flag toggle in C2D)
  - **Owner authorization required?:** YES (Explicit C2D authorization)
  - **Dry-run evidence:** Flag check in `lib/server/pendidikan-v2-service.ts`.
  - **Positive test:** When true and all prerequisites satisfied, Pendidikan V2 UI and actions unlock.
  - **Negative test:** When false or blockers persist, all V2 endpoints return fail-closed response.
  - **Reconciliation evidence:** Deployment environment inspection.
  - **Rollback/recovery consideration:** Toggle flag back to `false` to instantly disable V2 runtime.
  - **Evidence Pack reference:** `EVID-FLG-PENDIDIKAN`
  - **Gate:** GATE-C2D
  - **Status:** `BLOCKED` (Academic grant, teacher modality, containment, and assignment blockers persist)
  - **Notes / unresolved decision:** Master runtime kill-switch; strictly fails closed while academic blockers persist.

- **REL-FLG-02 | PositionCapabilities BusinessRuleState Promotion in C2D**
  - **Domain:** FEATURE_FLAGS / CAPABILITY_PROMOTION
  - **Requirement:** Capabilities remain `APPROVED_TARGET_PENDING_TECHNICAL` (zero runtime authority) until promoted in C2D to `VERIFIED_PRODUCTION` via explicit database UPDATE.
  - **Source of truth:** `types/architecture-lock.ts` (`BusinessRuleState`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Zero capabilities in `VERIFIED_PRODUCTION`.
  - **Target state:** Promoted in C2D.
  - **Dependency:** GATE-C2C, Explicit Owner Authorization
  - **Production write required?:** YES (UPDATE in C2D)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2D promotion script dry-run.
  - **Positive test:** Engine allows action when grant is `VERIFIED_PRODUCTION`.
  - **Negative test:** Engine denies action when grant is `APPROVED_TARGET_PENDING_TECHNICAL`.
  - **Reconciliation evidence:** `position_capabilities` table query.
  - **Rollback/recovery consideration:** UPDATE `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL` to instantly revoke.
  - **Evidence Pack reference:** `EVID-FLG-CAP-PROMOTE`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Granular authority kill-switch.

- **REL-FLG-03 | Global Authorization Cutover Exclusion**
  - **Domain:** FEATURE_FLAGS / CUTOVER
  - **Requirement:** Global authorization cutover is NOT included in M3.3. Legacy authorization compatibility paths remain active for unmigrated domains.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 17)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Hybrid compatibility active.
  - **Target state:** Maintained throughout M3.3 release train.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Auth compatibility layer code check.
  - **Positive test:** Legacy roles function for unmigrated features.
  - **Negative test:** Unauthorized widening prevented.
  - **Reconciliation evidence:** Auth regression tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-FLG-CUTOVER`
  - **Gate:** ALL GATES
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Explicit boundary protection.

---

### W. AUTHORIZATION
- **REL-AUT-01 | Canonical Authorization Chain Enforcement**
  - **Domain:** AUTHORIZATION / ENGINE
  - **Requirement:** Enforce canonical chain: `SESSION -> IDENTITY -> ACTIVE ASSIGNMENTS -> POSITIONS -> CAPABILITIES -> SCOPE -> RESOURCE CONTEXT -> ALLOW/DENY`.
  - **Source of truth:** `types/architecture-lock.ts` (`IAuthorizationEngine`), `STQ_PROJECT_CONTEXT.md` (Section 5)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Fully implemented and unit tested (`tests/milestone2-authorization-engine.test.ts`).
  - **Target state:** Enforced across all production endpoints.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** 28 passing unit tests in auth engine test suite.
  - **Positive test:** Valid assignment and scope returns `ALLOWED`.
  - **Negative test:** Missing context returns `INVALID_RESOURCE_CONTEXT`; expired assignment returns `ASSIGNMENT_EXPIRED`.
  - **Reconciliation evidence:** Unit test execution logs.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUT-CHAIN`
  - **Gate:** ALL GATES
  - **Status:** `PASS` (Core engine implemented and tested)
  - **Notes / unresolved decision:** Fail-closed core.

- **REL-AUT-02 | Untrusted Caller Context Boundary**
  - **Domain:** AUTHORIZATION / RESOURCE_CONTEXT
  - **Requirement:** Caller-provided resource parameters (`RequestedResourceContext`) are strictly untrusted IDs; engine must hydrate server-side authoritative context (`ResolvedResourceContext`).
  - **Source of truth:** `types/architecture-lock.ts` (`RequestedResourceContext`, `ResolvedResourceContext`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced in engine implementation.
  - **Target state:** Maintained in production.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Engine implementation in `lib/server/authorization-engine.ts`.
  - **Positive test:** Server-hydrated org unit matches DB truth.
  - **Negative test:** Client-tampered context parameters ignored.
  - **Reconciliation evidence:** Unit test suite.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUT-CONTEXT`
  - **Gate:** ALL GATES
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Prevents spoofing.

- **REL-AUT-03 | Multi-Grant Evaluation Support**
  - **Domain:** AUTHORIZATION / MULTI_GRANT
  - **Requirement:** User holding multiple active assignments evaluating same capability across different scopes evaluates all grants; ALLOW if at least one matches.
  - **Source of truth:** `types/architecture-lock.ts` (`IAuthorizationEngine.authorize`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Implemented in engine.
  - **Target state:** Maintained in production.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Test suite covers multi-grant evaluation.
  - **Positive test:** User with halaqoh A and halaqoh B can access both.
  - **Negative test:** Access denied to halaqoh C.
  - **Reconciliation evidence:** Unit test logs.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUT-MULTIGRANT`
  - **Gate:** GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Multi-responsibility support.

- **REL-AUT-04 | Fail-Closed System Guard**
  - **Domain:** AUTHORIZATION / FAIL_CLOSED
  - **Requirement:** Any unexpected exception, unmapped capability, missing assignment, or database query error returns `SYSTEM_FAIL_CLOSED` and denies access. Never return fake healthy or empty data.
  - **Source of truth:** `types/architecture-lock.ts` (`SYSTEM_FAIL_CLOSED`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Implemented in engine error handlers.
  - **Target state:** Maintained in production.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Test suite error handling tests.
  - **Positive test:** Normal execution returns expected code.
  - **Negative test:** Injected DB error causes fail-closed DENY.
  - **Reconciliation evidence:** Unit test logs.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUT-FAILCLOSED`
  - **Gate:** ALL GATES
  - **Status:** `BLOCKED` (Awaiting C2D activation)
  - **Notes / unresolved decision:** Data honesty protection.

---

### X. AUDIT LOGGING
- **REL-AUD-01 | Canonical Audit Log Model Parity**
  - **Domain:** AUDIT / SCHEMA
  - **Requirement:** Table `canonical_audit_logs` present in production; captures technical account, human executor, action, entity, before/after states, capability, position, unit, scope, client IP, timestamp.
  - **Source of truth:** `types/architecture-lock.ts` (`CanonicalAuditRecord`), `prisma/schema.prisma`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Table present in production database (`CANONICAL_AUDIT_READY = READY` in C2A).
  - **Target state:** Fully utilized by all M3.3 mutating actions.
  - **Dependency:** None
  - **Production write required?:** NO (Table already exists)
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** C2A preflight table audit verified table presence.
  - **Positive test:** Server Actions insert audit records upon mutation.
  - **Negative test:** Unauthenticated mutation blocked before audit insertion.
  - **Reconciliation evidence:** Production catalog query confirms table.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUD-SCHEMA`
  - **Gate:** BASELINE
  - **Status:** `PASS`
  - **Notes / unresolved decision:** Audit infrastructure verified.

- **REL-AUD-02 | Non-Repudiation for UNIT Account Mutations**
  - **Domain:** AUDIT / NON_REPUDIATION
  - **Requirement:** Every mutating transaction executed by a UNIT account (`AccountType: UNIT`) MUST record non-null `humanExecutorId` and `humanExecutorName`.
  - **Source of truth:** `types/architecture-lock.ts` (`UnitAccountExecutorContext`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced in architecture contracts.
  - **Target state:** Active in production Server Actions.
  - **Dependency:** REL-AUD-01, REL-MOD-02
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Server Action unit tests.
  - **Positive test:** Audit row contains both technical username and human executor ID.
  - **Negative test:** Rejects mutation if human executor is missing.
  - **Reconciliation evidence:** Audit query inspection.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUD-UNIT`
  - **Gate:** GATE-C2C / GATE-C2D
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Accountability contract.

- **REL-AUD-03 | Zero Silent Production Repair Rule**
  - **Domain:** AUDIT / INTEGRITY
  - **Requirement:** Never execute hidden background mutations to "repair" data to satisfy green test results. All migrations, linkages, and state changes must be auditable and authorized.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 14)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Enforced across all PR workflows.
  - **Target state:** Maintained throughout release train.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Project context invariant rules.
  - **Positive test:** All database writes traceable to explicit PR or authorized runbook.
  - **Negative test:** Automated check fails if rogue SQL detected.
  - **Reconciliation evidence:** CI and audit log review.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-AUD-NOSILENT`
  - **Gate:** ALL GATES
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Trust model invariant.

---

### Y. PRODUCTION UAT
- **REL-UAT-01 | Pre-UAT Verification Gate (GATE-C2E)**
  - **Domain:** PRODUCTION_UAT / GATE
  - **Requirement:** Live production UAT commences ONLY after GATE-C2B, GATE-C2C, and GATE-C2D are 100% satisfied and verified with evidence packs.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 17)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Preceding gates blocked/not ready; UAT blocked.
  - **Target state:** Executed in C2E window.
  - **Dependency:** GATE-C2D
  - **Production write required?:** NO (Read and controlled test transactions only)
  - **Owner authorization required?:** YES (Owner UAT sign-off)
  - **Dry-run evidence:** Pre-UAT checklist.
  - **Positive test:** All gate criteria confirmed PASS.
  - **Negative test:** Any unverified gate blocks UAT commencement.
  - **Reconciliation evidence:** Gate sign-off matrix.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-UAT-GATE`
  - **Gate:** GATE-C2E
  - **Status:** `BLOCKED` (Awaiting preceding gates)
  - **Notes / unresolved decision:** Serial execution discipline.

- **REL-UAT-02 | Core Positive UAT Scenarios (Exact 9 Capabilities)**
  - **Domain:** PRODUCTION_UAT / POSITIVE
  - **Requirement:** Execute approved positive scenarios:
    1. Musyrif Tahfizh manages target in own halaqoh (`ALLOW`).
    2. Operational Tahfizh views global halaqoh recap (`ALLOW`).
    3. Operational Tahfizh issues reward in assigned unit (`ALLOW`).
    4. Operational Keasramaan creates permission in assigned room (`ALLOW`).
    5. Academic teacher starts session for assigned cohort/subject (`ALLOW`).
    6. OSDA Putri accesses permitted PUTRI dashboard (`ALLOW`).
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Prepared in test matrix; pending C2E.
  - **Target state:** Executed live by users/testers with PASS evidence.
  - **Dependency:** REL-UAT-01
  - **Production write required?:** YES (Test mutations in designated test halaqoh/cohort)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Staging/local UAT runbook passes.
  - **Positive test:** All 6 scenarios succeed as expected.
  - **Negative test:** N/A
  - **Rollback/recovery consideration:** ZERO UNEXPECTED PRODUCTION DATA MUTATION. UAT positive scenarios may create controlled production test mutations only after explicit C2E authorization. Every mutation must have captured pre-state/post-state and audit attribution. No unrelated production data may be modified. Test records must not be automatically deleted merely to restore a "clean" result. Any cleanup/compensating mutation requires explicit authorization and exact record identification.
  - **Evidence Pack reference:** `EVID-UAT-POS`
  - **Gate:** GATE-C2E
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** User verification.

- **REL-UAT-03 | Core Negative UAT Scenarios (Fail-Closed Boundaries)**
  - **Domain:** PRODUCTION_UAT / NEGATIVE
  - **Requirement:** Execute mandatory negative boundary scenarios:
    1. Musyrif Tahfizh attempts target edit in cross-halaqoh (`DENY`).
    2. Operational Tahfizh attempts global reward issuance (`DENY`).
    3. Operational Tahfizh attempts setoran creation (`DENY`).
    4. Operational Keasramaan attempts permission approval (`DENY`).
    5. OSDA Putri attempts access to santri putra records (`DENY`).
    6. Unassigned teacher attempts session start (`DENY`).
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Prepared in test matrix; pending C2E.
  - **Target state:** Executed live with verified DENY results.
  - **Dependency:** REL-UAT-01
  - **Production write required?:** NO (Blocked transactions)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Staging/local UAT negative tests pass.
  - **Positive test:** N/A
  - **Negative test:** All 6 scenarios return explicit DENY result codes.
  - **Reconciliation evidence:** Server audit logs capturing denied attempts.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-UAT-NEG`
  - **Gate:** GATE-C2E
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Boundary defense verification.

---

### Z. RECOVERY / FINAL SIGN-OFF
- **REL-REC-01 | Rollback & Disaster Recovery Runbook**
  - **Domain:** RECOVERY / RUNBOOK
  - **Requirement:** Comprehensive fail-closed rollback protocol (FAILURE -> STOP further release progression -> preserve evidence -> inspect actual database/environment state -> compare against captured before-state -> use transaction rollback only if transaction is still safely open -> determine whether any compensating action is actually necessary -> require explicit Business Owner authorization for any new production mutation -> execute only exact compensating actions based on known changed IDs and captured before-state -> independently reconcile after recovery):
    - Pre-C2B failure: Zero recovery mutation needed; verify zero production writes occurred.
    - C2B DDL failure: DO NOT automatically restore production. Inspect actual migration/database state first (production restore is a high-risk mutation). Restore only if actual failure state strictly requires it AND explicit recovery authorization is granted.
    - C2C provisioning failure: DO NOT automatically execute reverse DML. Never delete pre-existing rows; never blanket-null fields. Prefer transaction rollback if still possible; otherwise perform only explicitly authorized compensating actions based on exact rows created/changed during the failed operation and captured before-state.
    - C2D activation failure: Stop release progression. Feature flag may be disabled if required as a fail-safe and explicitly authorized according to runbook. Do NOT blindly reset `businessRuleState`; any `businessRuleState` compensation must use captured before-state and explicit authorization.
    - C2E failure: Stop UAT/release progression. Preserve test data and audit evidence. Do NOT automatically revoke/delete assignments or test records; determine exact recovery actions from captured before-state and explicit authorization.
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`, `docs/STQ_M3_RELEASE_DEPENDENCIES.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Documented in control plane; non-destructive recovery policy enforced.
  - **Target state:** Ready for execution if triggered; zero automated destructive mutations.
  - **Dependency:** None
  - **Production write required?:** YES (`FUTURE_RECOVERY_MAY_REQUIRE_PRODUCTION_WRITE = YES; CURRENT_PR_EXECUTED_PRODUCTION_WRITE = 0`)
  - **Owner authorization required?:** YES (Mandatory for any recovery mutation)
  - **Dry-run evidence:** Rollback procedure walkthrough.
  - **Positive test:** Verified clean abort and evidence preservation at each gate.
  - **Negative test:** Recovery drill tested in isolated staging environment without data loss.
  - **Reconciliation evidence:** Rollback drill documentation and before/after state comparison.
  - **Rollback/recovery consideration:** Built into each stage; fail-closed and non-destructive.
  - **Evidence Pack reference:** `EVID-REC-RUNBOOK`
  - **Gate:** ALL GATES
  - **Status:** `BLOCKED` (Requires backup gate completion)
  - **Notes / unresolved decision:** Incident safety net; zero automated destructive mutations.

- **REL-REC-02 | Post-Release Integrity & Drift Audit**
  - **Domain:** RECOVERY / DRIFT_AUDIT
  - **Requirement:** Post-C2E audit checking: zero orphaned rows, zero unexpected table count changes, zero drift between Prisma schema and production catalog, PR #8 untouched.
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Audit queries prepared.
  - **Target state:** Executed post-C2E.
  - **Dependency:** REL-UAT-02, REL-UAT-03
  - **Production write required?:** NO (Read-only queries)
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** Audit query script.
  - **Positive test:** All drift checks return 0 deviations.
  - **Negative test:** Non-zero drift triggers investigation.
  - **Reconciliation evidence:** Final audit report.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-REC-DRIFT`
  - **Gate:** GATE-C2E
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Post-release verification.

- **REL-REC-03 | Business Owner Final Institutional Sign-Off**
  - **Domain:** RECOVERY / SIGN_OFF
  - **Requirement:** Formal institutional closure and sign-off by Business Owner upon successful completion of C2E UAT evidence pack.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Milestone train open.
  - **Target state:** Formal closure of M3.3 milestone.
  - **Dependency:** REL-REC-02
  - **Production write required?:** NO
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Formal sign-off template.
  - **Positive test:** Written confirmation from Business Owner.
  - **Negative test:** Milestone remains open without sign-off.
  - **Reconciliation evidence:** Signed release record.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-REC-SIGNOFF`
  - **Gate:** GATE-C2E
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Milestone train completion.

---

### AA. UNRESOLVED BUSINESS DECISIONS
- **REL-DEC-01 | Decision #1: Permanent Angkatan Mapping for 57 Santri**
  - **Scope Impact:** Blocks `C2C` student cohort backfill. Safely deferred for C2B.
  - **Classification:** `BLOCKED_BEFORE_C2C_STUDENT_ASSIGNMENT`
  - **Resolution Requirement:** Business Owner provides definitive student -> angkatan list.
  - **Status:** `BLOCKED`

- **REL-DEC-02 | Decision #2: Teacher Account Modality (PERSONAL vs UNIT)**
  - **Scope Impact:** Formally resolved (DIR-2026-027, DIR-2026-028). Studi Umum = SUBJECT via `AcademicSubjectAccountBinding`; Kepesantrenan = PERSONAL Staff/User via `GURU_KEPESANTRENAN`.
  - **Classification:** `RESOLVED`
  - **Resolution Requirement:** Resolved by Owner Directives DIR-2026-027 and DIR-2026-028.
  - **Status:** `RESOLVED`

- **REL-DEC-03 | Decision #3: Substitute / Badal Teacher Authorization Matrix**
  - **Scope Impact:** Blocks `C2D` substitute teacher activation. Does NOT block C2B or primary C2C provisioning.
  - **Classification:** `SAFELY_DEFERRED_FOR_INITIAL_ACTIVATION`
  - **Resolution Requirement:** Business Owner specifies who may substitute for whom.
  - **Status:** `NOT_READY`

- **REL-DEC-04 | Decision #4: Cohort Gap / Repeater / Transfer Policy**
  - **Scope Impact:** Does NOT block C2B, C2C, or initial UAT (standard progression only).
  - **Classification:** `SAFELY_DEFERRED_POST_UAT`
  - **Resolution Requirement:** Business Owner defines multi-year retention rules.
  - **Status:** `NOT_READY`

- **REL-DEC-05 | Decision #5: Canonical Kepesantrenan Assessment & Grading**
  - **Scope Impact:** Does NOT block C2B, C2C, or initial UAT (attendance and sessions only).
  - **Classification:** `SAFELY_DEFERRED_POST_UAT`
  - **Resolution Requirement:** Business Owner defines letter/number grading scale.
  - **Status:** `NOT_READY`

- **REL-DEC-06 | Decision #6: Fikih Curriculum & Textbook Reference**
  - **Scope Impact:** Does NOT block C2B or C2C (nullable reference in sessions).
  - **Classification:** `SAFELY_DEFERRED_FOR_INITIAL_ACTIVATION`
  - **Resolution Requirement:** Business Owner provides syllabus book title.
  - **Status:** `NOT_READY`

- **REL-DEC-07 | Decision #7: Aqidah Curriculum & Textbook Reference**
  - **Scope Impact:** Does NOT block C2B or C2C (nullable reference in sessions).
  - **Classification:** `SAFELY_DEFERRED_FOR_INITIAL_ACTIVATION`
  - **Resolution Requirement:** Business Owner provides syllabus book title.
  - **Status:** `NOT_READY`

- **REL-DEC-08 | Decision #8: Keasramaan Permission Approval Authority (`approve_mk` / `approve_ks`)**
  - **Scope Impact:** Blocks permission approval activation in `C2D`. Operational read/create proceeds independently.
  - **Classification:** `BLOCKED_FOR_APPROVAL_FEATURES_ONLY`
  - **Resolution Requirement:** Business Owner specifies exact tier 1/2 approval roles.
  - **Status:** `BLOCKED`

- **REL-DEC-09 | Decision #9: Health External Hospital/Puskesmas Referral Authority**
  - **Scope Impact:** Blocks external referral capability in `C2D`. Case read/create proceeds independently.
  - **Classification:** `SAFELY_DEFERRED_FOR_INITIAL_ACTIVATION`
  - **Resolution Requirement:** Business Owner defines who can refer santri outside pesantren.
  - **Status:** `NOT_READY`

- **REL-DEC-10 | Decision #10: Exact Activation Timing of Target PositionCapabilities**
  - **Scope Impact:** Blocks `C2D` promotion. Does NOT block C2B migration or C2C provisioning.
  - **Classification:** `BLOCKED_BEFORE_C2D_PROMOTION`
  - **Resolution Requirement:** Business Owner explicitly authorizes timing for capability activation.
  - **Status:** `NOT_READY`

---

## 3. Pre-Flight Diagnostic Summary

- **Total Release Items Cataloged:** 100
- **PASS (Verified Baseline / Guard Invariants):** 11
- **READY (Ready for Execution):** 0 (Zero items ready for mutation without prerequisites)
- **BLOCKED (Hard Gated by Backup, Decisions, or Dependencies):** 41
- **NOT_READY (Waiting on Upstream Gate Completion):** 48
- **Current Authorization State:** **ZERO PRODUCTION WRITES AUTHORIZED**
- **C2B Execution Status:** `STRICTLY BLOCKED` until backup verification and owner authorization.
