# STQ EDUCATION PORTAL — MASTER RELEASE MANIFEST (M3.3)
**Release Train Control Sheet: C2B (Database Migration) through C2E (Live Production UAT)**

- **Repository:** `abdngr23-pixel/stq-education-portal`
- **Canonical Main Checkpoint:** `8e670491d1ed0c88a480ed90186153e96ca1dea3` (Post-PR #24 Merge)
- **Status:** ACTIVE CONTROL PLANE (AUDIT REMEDIATION APPLIED)
- **Control-Plane Drafting:** COMPLETE
- **Control-Plane Audit:** REMEDIATION_COMPLETE_READY_FOR_AUDIT
- **Production Readiness:** BLOCKED (Pending Gate 0 prerequisites and Business Owner authorization)
- **Execution Model:** PARALLEL PREPARATION | SERIAL PRODUCTION EXECUTION | FAIL-CLOSED GATES | MANDATORY EVIDENCE PACKS
- **Current Production Mutation Authorization:** **ZERO PRODUCTION WRITES AUTHORIZED IN THIS PHASE**

---

## 1. Release Manifest Dashboard & Summary

| Stage / Scope | Total Items | PASS | READY | BLOCKED | NOT_READY |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **A. Git & Release Lineage** | 5 | 5 | 0 | 0 | 0 |
| **B. Database & Migration** | 4 | 2 | 0 | 2 | 0 |
| **C. Backup & Restore** | 4 | 0 | 0 | 4 | 0 |
| **D. Staff Linkage** | 3 | 0 | 0 | 1 | 2 |
| **E. Account Cleanup / Decommission** | 4 | 0 | 0 | 3 | 1 |
| **F. Org Units** | 4 | 0 | 0 | 1 | 3 |
| **G. Positions** | 4 | 0 | 0 | 1 | 3 |
| **H. Capabilities** | 3 | 0 | 0 | 1 | 2 |
| **I. Position Capabilities** | 4 | 0 | 0 | 1 | 3 |
| **J. Assignments** | 4 | 0 | 0 | 1 | 3 |
| **K. Assignment Scope Units** | 3 | 0 | 0 | 1 | 2 |
| **L. Account Modality** | 3 | 0 | 0 | 0 | 3 |
| **M. OSDA Putri** | 3 | 0 | 0 | 1 | 2 |
| **N. Tahfizh Domain** | 4 | 1 | 0 | 1 | 2 |
| **O. Keasramaan Domain** | 4 | 0 | 0 | 1 | 3 |
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
| **TOTALS** | **100** | **12** | **0** | **32** | **56** |

### Gate Status Overview:
- **GATE-C2B (Production Migration):** `BLOCKED` (Pending verified backup execution and separate Business Owner C2B authorization).
- **GATE-C2C (Controlled Provisioning):** `BLOCKED` (Strict dependency on C2B completion).
- **GATE-C2D (Capability & Policy Activation):** `BLOCKED` (Strict dependency on C2C completion).
- **GATE-C2E (Live Production UAT):** `BLOCKED` (Strict dependency on C2D completion).

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
  - **Rollback/recovery consideration:** Restore from pre-C2B backup if DDL fails mid-way.
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
  - **Rollback/recovery consideration:** Restore from pre-C2B backup if DDL fails mid-way.
  - **Evidence Pack reference:** `EVID-MIG-C2B`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Zero production writes authorized currently)
  - **Notes / unresolved decision:** Fully additive; no existing student data modified.

---

### C. BACKUP / RESTORE
- **REL-BCK-01 | Backup Tooling & Binary Availability Audit**
  - **Domain:** BACKUP / TOOLING
  - **Requirement:** Authoritative `pg_dump` binary present in execution PATH; minimum sensible version compatible with PostgreSQL 16+.
  - **Source of truth:** `scripts/backup-db.ts`, `tests/backup-db.test.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** `pg_dump` binary ABSENT in local Windows PATH.
  - **Target state:** Valid binary available in execution environment (e.g. Linux CI runner, container, or client tools).
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** CLI probe `pg_dump --version`.
  - **Positive test:** Returns valid version string `>= 16.0`.
  - **Negative test:** Fails closed with exit code 1 if missing.
  - **Reconciliation evidence:** CLI execution output recorded in Evidence Pack.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-BCK-TOOLING`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (pg_dump not available in host environment)
  - **Notes / unresolved decision:** Mandatory prerequisite before dump capture.

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
  - **Requirement:** Execute `pg_dump` against production, generate `.sql` dump file, verify file size $\ge 500$ bytes, compute cryptographic `.sha256` checksum.
  - **Source of truth:** `scripts/backup-db.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** NOT EXECUTED. Zero production backups executed yet.
  - **Target state:** Cryptographically verified dump artifact and `.sha256` file archived.
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
  - **Requirement:** Restore verified dump into an isolated staging/test PostgreSQL instance; verify row counts for `santri` (57), `users` (18), `staff` (10), `mata_pelajaran` (9).
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 12)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** NOT EXECUTED.
  - **Target state:** Verified successful restore with 100% table and row count fidelity.
  - **Dependency:** REL-BCK-03
  - **Production write required?:** NO (Target is isolated non-production instance; production is never restore target)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Restore command simulation.
  - **Positive test:** `SELECT count(*) FROM santri` equals exactly 57 on restore target.
  - **Negative test:** Schema validation failure if dump is corrupt.
  - **Reconciliation evidence:** Query outputs from restored test database.
  - **Rollback/recovery consideration:** Abort C2B if backup cannot be restored.
  - **Evidence Pack reference:** `EVID-BCK-RESTORE`
  - **Gate:** GATE-C2B
  - **Status:** `BLOCKED` (Awaiting dump artifact and restore environment)
  - **Notes / unresolved decision:** Mandatory safety gate before C2B migration.

---

### D. STAFF LINKAGE
- **REL-STF-01 | Baseline Staff Linkage Inventory**
  - **Domain:** IDENTITY / STAFF_LINKAGE
  - **Requirement:** Maintain verified record of 10 linked Staff (`STF-0001` to `STF-0010`) and 8 unlinked users in production.
  - **Source of truth:** `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Audited in C2A; `STAFF_LINKAGE_READY = BLOCKED`.
  - **Target state:** Identified accounts resolved to appropriate modality before assignment.
  - **Dependency:** None
  - **Production write required?:** NO
  - **Owner authorization required?:** NO
  - **Dry-run evidence:** C2A preflight table audit.
  - **Positive test:** Query matches 10 active linked staff.
  - **Negative test:** Fails closed if unexpected unlinked staff accounts mutate data.
  - **Reconciliation evidence:** C2A preflight report.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-STF-AUDIT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY` (Requires C2C provisioning plan)
  - **Notes / unresolved decision:** Baseline for account resolution.

- **REL-STF-02 | Operational Account Linkage Resolution (musyrifah.putri & pembina.halaqoh)**
  - **Domain:** IDENTITY / STAFF_LINKAGE
  - **Requirement:** Resolve account modality for `musyrifah.putri` and `pembina.halaqoh` (link to valid active Staff profile or classify as UNIT account with verified executor).
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unlinked operational accounts in production; zero runtime authority.
  - **Target state:** Explicitly linked to Staff or assigned as UNIT accounts.
  - **Dependency:** GATE-C2B, Explicit Owner Authorization
  - **Production write required?:** YES (Update `users.staff_id` or `AccountType`)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Dry-run SQL script logging target `userId` and `staffId`.
  - **Positive test:** Active Staff linkage verified via foreign key.
  - **Negative test:** Rejects linkage if target Staff status is not `AKTIF`.
  - **Reconciliation evidence:** Pre/post query diff of `users` table.
  - **Rollback/recovery consideration:** Revert `staff_id` to null if invalid.
  - **Evidence Pack reference:** `EVID-STF-LINKAGE`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Zero production writes authorized currently)
  - **Notes / unresolved decision:** Never silently link without explicit mapping.

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
  - **Requirement:** Enforce Business Owner decision: `razan.mt` is DEPRECATED / DECOMMISSION TARGET. Strictly PROHIBIT linking to Staff `STF-0003` (or any Staff profile). Strictly PROHIBIT granting Position, Assignment, Capability, or runtime authority. Target implementation is decommission via schema-supported deactivation/revocation (e.g. status = NONAKTIF or SUSPENDED, login disabled); hard delete remains prohibited pending read-only dependency audit.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9), `STQ_PROJECT_CONTEXT.md` (Section 6)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** `RAZAN_MT_TARGET_STATE = DECOMMISSION`, `RAZAN_MT_STAFF_LINKAGE = PROHIBITED`, `RAZAN_MT_DECOMMISSION_EXECUTION = NOT_STARTED`.
  - **Target state:** Decommissioned in controlled C2C operation via schema-supported deactivation after dependency audit.
  - **Dependency:** REL-ACC-02 (Pre-decommission dependency audit)
  - **Production write required?:** NO in this stage (Enforced in policy/docs)
  - **Owner authorization required?:** YES (Satisfied by owner decision)
  - **Dry-run evidence:** Documentation lock in PR #24.
  - **Positive test:** Automated audit verifies zero assignments granted to `razan.mt`.
  - **Negative test:** Any attempt to link `razan.mt` to `STF-0003` throws fatal error.
  - **Reconciliation evidence:** Project context invariant inspection.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ACC-RAZAN`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Gated by pre-decommission read-only dependency audit)
  - **Notes / unresolved decision:** Do not hard delete yet.

- **REL-ACC-02 | razan.mt Pre-Decommission Read-Only Dependency Audit**
  - **Domain:** IDENTITY / AUDIT
  - **Requirement:** Before any deactivation/deletion in production, perform comprehensive read-only dependency audit: historical records, transactions, audit logs, active sessions, halaqoh ownership, and foreign keys.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** NOT EXECUTED.
  - **Target state:** Completed audit report proving whether deactivation vs deletion is safe.
  - **Dependency:** Direct DB access in C2C
  - **Production write required?:** NO (Strictly read-only query)
  - **Owner authorization required?:** YES (Read access)
  - **Dry-run evidence:** SQL audit script querying all tables referencing `users.id` where `username = 'razan.mt'`.
  - **Positive test:** Audit script returns exact row counts across all referencing tables.
  - **Negative test:** Hard delete rejected if foreign key references exist.
  - **Reconciliation evidence:** Dependency audit evidence report.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-ACC-RAZAN-DEP`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting production read-only audit window)
  - **Notes / unresolved decision:** Mandatory before mutating account.

- **REL-ACC-03 | musyrif.tahifzh Business Owner Designation & Pre-Provisioning Verification**
  - **Domain:** IDENTITY / KABID_TAHFIZH
  - **Requirement:** Document operational account designation `musyrif.tahifzh` as Business Owner designated; verify exact username presence and Staff linkage read-only before provisioning canonical Position/Assignment. Preserve exact spelling. REMOVE all unsupported assumptions that `musyrif.tahifzh` -> `STF-0002` or that `STF-0002` is definitively Kabid Tahfizh. Ust. Razan Mufli, S.Pd is Kabid Tahfizh and historically associated with `STF-0003`, BUT do NOT automatically link `musyrif.tahifzh` to `STF-0003` either. Exact production User -> Staff relationship must first be verified read-only.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 9)
  - **PolicyDecisionState:** `APPROVED` (Account designation approved; Staff linkage UNKNOWN / MUST_VERIFY_READ_ONLY)
  - **Current state:** `MUSYRIF_TAHIFZH_ACCOUNT = BUSINESS_OWNER_DESIGNATED`, `MUSYRIF_TAHIFZH_STAFF_LINKAGE = UNKNOWN / MUST_VERIFY_READ_ONLY`.
  - **Target state:** Verified in production database via read-only inspection; provisioned to canonical `KABID_TAHFIZH` position if verified.
  - **Dependency:** Direct DB access in C2C
  - **Production write required?:** NO in this stage
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Pre-provisioning lookup query `SELECT id, username, staff_id FROM users WHERE username = 'musyrif.tahifzh'`.
  - **Positive test:** Query returns exactly 1 valid record.
  - **Negative test:** Fail closed if username not found or linked to invalid staff.
  - **Reconciliation evidence:** Query evidence artifact.
  - **Rollback/recovery consideration:** Abort Kabid Tahfizh assignment if user record invalid.
  - **Evidence Pack reference:** `EVID-ACC-MUSYRIF-TAH`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting live read-only verification)
  - **Notes / unresolved decision:** Do not autocorrect spelling to `musyrif.tahfizh`.

- **REL-ACC-04 | Duplicate Kabid Authority Prevention**
  - **Domain:** IDENTITY / AUTHORIZATION
  - **Requirement:** Verify that exactly ONE active operational account holds the canonical `KABID_TAHFIZH` position; ensure zero duplicate authority between `razan.mt` and `musyrif.tahifzh`.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 8)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Neither holds canonical Assignment in production (zero assignments currently).
  - **Target state:** Exactly one active Assignment for `KABID_TAHFIZH`.
  - **Dependency:** REL-ACC-01, REL-ACC-03
  - **Production write required?:** NO (Validation rule)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Assignment uniqueness validation query.
  - **Positive test:** Exactly 1 active assignment for position code `KABID_TAHFIZH`.
  - **Negative test:** Multiple active assignments trigger fail-closed error.
  - **Reconciliation evidence:** Audit query of `assignments` table.
  - **Rollback/recovery consideration:** Revoke rogue assignment if duplicate detected.
  - **Evidence Pack reference:** `EVID-ACC-KABID-DUP`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Enforces single leadership seat.

---

### F. ORG UNITS
- **REL-OU-01 | Institutional Root & Domain Unit Provisioning**
  - **Domain:** ORG_UNITS / FOUNDATION
  - **Requirement:** Provision canonical root `OU-INSTITUTION` and domain units: `OU-TAHFIZH`, `OU-KEASRAMAAN`, `OU-AKADEMIK`, `OU-MANAJEMEN`.
  - **Source of truth:** `types/architecture-lock.ts`, `docs/STQ_ARCHITECTURE_LOCK.md` (Section 4)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production (`org_units = 0`).
  - **Target state:** Provisioned idempotently in C2C.
  - **Dependency:** GATE-C2B
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL classifying as `CREATE`.
  - **Positive test:** Query verifies 5 top-level units exist with correct `domain` and `type`.
  - **Negative test:** Unique constraint prevents duplicate `code`.
  - **Reconciliation evidence:** Pre/post table row counts.
  - **Rollback/recovery consideration:** Delete created units if batch fails.
  - **Evidence Pack reference:** `EVID-OU-ROOT`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Tree root foundation.

- **REL-OU-02 | OSDA Root & Division Unit Provisioning**
  - **Domain:** ORG_UNITS / KEASRAMAAN
  - **Requirement:** Provision `OU-OSDA-ROOT` (type `ORGANIZATION`) and 5 divisions (`KEAMANAN_KEDISIPLINAN`, `PENDIDIKAN_IBADAH`, `KEBERSIHAN_KERAPIHAN`, `KESEHATAN`, `SARANA_PRASARANA`).
  - **Source of truth:** `types/architecture-lock.ts` (`KEASRAMAAN_STRUCTURE`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Provisioned under `OU-KEASRAMAAN`.
  - **Dependency:** REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Relational hierarchy verifies `parentId = OU-OSDA-ROOT.id`.
  - **Negative test:** Rejects creation if parent unit missing.
  - **Reconciliation evidence:** OrgUnit tree query.
  - **Rollback/recovery consideration:** Delete created units if batch fails.
  - **Evidence Pack reference:** `EVID-OU-OSDA`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Keasramaan sub-structure.

- **REL-OU-03 | TKS Root & Service Unit Provisioning**
  - **Domain:** ORG_UNITS / KEASRAMAAN
  - **Requirement:** Provision `OU-TKS-ROOT` and 6 service units: `OU-TKS-DAPUR`, `OU-TKS-MASJID`, `OU-TKS-PENDIDIKAN`, `OU-TKS-YAYASAN`, `OU-TKS-AIR-MINUM`, `OU-TKS-AIR-SUMUR`.
  - **Source of truth:** `types/architecture-lock.ts` (`TKS_STRUCTURE_CONTRACT`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Provisioned under `OU-KEASRAMAAN`.
  - **Dependency:** REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Service units correctly map to `SERVICE_UNIT` type.
  - **Negative test:** `hasCentralKetua = false` constraint verified.
  - **Reconciliation evidence:** OrgUnit tree query.
  - **Rollback/recovery consideration:** Delete created units if batch fails.
  - **Evidence Pack reference:** `EVID-OU-TKS`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Structured service units.

- **REL-OU-04 | Halaqoh & Kamar Unit Backfill Reconciliation**
  - **Domain:** ORG_UNITS / BACKFILL
  - **Requirement:** Reconcile existing production halaqoh circles and kamar into OrgUnit representations (`type: HALAQOH` and `type: KAMAR`).
  - **Source of truth:** `types/architecture-lock.ts`, production `halaqoh` table
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unlinked/unbackfilled in production.
  - **Target state:** 1:1 OrgUnit representation for each operational circle and room.
  - **Dependency:** REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Dry-run mapping existing halaqoh IDs to target OrgUnits.
  - **Positive test:** All 57 santri assigned halaqohs have corresponding OrgUnits.
  - **Negative test:** Zero orphaned halaqohs.
  - **Reconciliation evidence:** Row count match between `halaqoh` and `org_units WHERE type = 'HALAQOH'`.
  - **Rollback/recovery consideration:** Delete created halaqoh units if batch fails.
  - **Evidence Pack reference:** `EVID-OU-HALAQOH`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Preserves existing halaqoh IDs.

---

### G. POSITIONS
- **REL-POS-01 | Institutional Leadership Positions Provisioning**
  - **Domain:** POSITIONS / LEADERSHIP
  - **Requirement:** Provision positions: `MUDIR`, `KEPALA_SEKOLAH`, `KEPALA_BIDANG_TAHFIZH` / `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN` / `MUSYRIF_KEASRAMAAN`.
  - **Source of truth:** `types/architecture-lock.ts`, `docs/STQ_ARCHITECTURE_LOCK.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production (`positions = 0`).
  - **Target state:** Provisioned with `isLeadership = true`, `requiresPersonalAccount = true`.
  - **Dependency:** REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Position query confirms correct allowed unit types and domain.
  - **Negative test:** Duplicate code constraint blocks collision.
  - **Reconciliation evidence:** Position table audit.
  - **Rollback/recovery consideration:** Delete positions if batch fails.
  - **Evidence Pack reference:** `EVID-POS-LEAD`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Musyrif Keasramaan = Kepala Keasramaan.

- **REL-POS-02 | Operational Staff Positions Provisioning**
  - **Domain:** POSITIONS / OPERATIONAL
  - **Requirement:** Provision operational positions: `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`, `MUDABBIR`, `GURU_AKADEMIK`, `PETUGAS_OPERASIONAL_TAHFIZH`, `PETUGAS_OPERASIONAL_KEASRAMAAN`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Provisioned with correct domain and unit type constraints.
  - **Dependency:** REL-POS-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** `MUSYRIF_TAHFIZH` allows unit type `HALAQOH`; `MUDABBIR` allows `KAMAR`.
  - **Negative test:** Disallowed unit type rejected.
  - **Reconciliation evidence:** Position table audit.
  - **Rollback/recovery consideration:** Delete positions if batch fails.
  - **Evidence Pack reference:** `EVID-POS-OPS`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Operational templates.

- **REL-POS-03 | Student Leadership & Desk Positions Provisioning**
  - **Domain:** POSITIONS / STUDENT
  - **Requirement:** Provision student positions: `KETUA_OSDA`, `SEKRETARIS_OSDA`, `BENDAHARA_OSDA`, `MULTIMEDIA_OSDA`, and OSDA division roles.
  - **Source of truth:** `types/architecture-lock.ts` (`KEASRAMAAN_STRUCTURE`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Provisioned under `KEASRAMAAN` domain.
  - **Dependency:** REL-POS-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Positions allow `ORGANIZATION` and `DIVISION` unit types.
  - **Negative test:** Rejects invalid domain binding.
  - **Reconciliation evidence:** Position table audit.
  - **Rollback/recovery consideration:** Delete positions if batch fails.
  - **Evidence Pack reference:** `EVID-POS-STUDENT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Student leadership roles.

- **REL-POS-04 | Unit Functional Desk Positions Provisioning**
  - **Domain:** POSITIONS / UNIT_DESK
  - **Requirement:** Provision positions designated for `AccountType = UNIT`: `UNIT_OPERASIONAL_PUTRI`, `UNIT_POSKESTREN`, `UNIT_TKS`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Provisioned with `requiresPersonalAccount = false`.
  - **Dependency:** REL-POS-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** `requiresPersonalAccount` is false.
  - **Negative test:** Rejects personal account assignment if position restricted.
  - **Reconciliation evidence:** Position table audit.
  - **Rollback/recovery consideration:** Delete positions if batch fails.
  - **Evidence Pack reference:** `EVID-POS-UNIT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Enforces unit credential modality.

---

### H. CAPABILITIES
- **REL-CAP-01 | Canonical 9 UAT Capabilities Registration**
  - **Domain:** CAPABILITIES / REGISTRATION
  - **Requirement:** Register exactly the 9 approved UAT capabilities:
    1. `academic.schedule.read`
    2. `academic.session.start`
    3. `academic.material.record`
    4. `academic.attendance.record`
    5. `tahfizh.recap.read`
    6. `tahfizh.reward.issue`
    7. `tahfizh.target.manage`
    8. `keasramaan.permission.read`
    9. `keasramaan.permission.create`
  - **Source of truth:** `types/architecture-lock.ts` (`ACADEMIC_CAPABILITIES`, `TAHFIZH_M32_CAPABILITIES`, `KEASRAMAAN_PERMISSION_CAPABILITIES`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production (`capabilities = 0`).
  - **Target state:** Registered in `capabilities` table.
  - **Dependency:** GATE-C2B
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script verifying exact 9 codes and namespaces.
  - **Positive test:** `SELECT count(*) FROM capabilities` returns 9.
  - **Negative test:** Disallowed arbitrary capability codes rejected.
  - **Reconciliation evidence:** Pre/post capabilities query.
  - **Rollback/recovery consideration:** Delete capabilities if batch fails.
  - **Evidence Pack reference:** `EVID-CAP-9UAT`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Do NOT register unapproved speculative capabilities.

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
  - **Rollback/recovery consideration:** Delete invalid mapping immediately.
  - **Evidence Pack reference:** `EVID-CAP-EXCLUDE`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Keasramaan approval authority remains unresolved.

---

### I. POSITION CAPABILITIES
- **REL-PC-01 | PETUGAS_OPERASIONAL_TAHFIZH Grants Mapping**
  - **Domain:** POSITION_CAPABILITIES / TAHFIZH
  - **Requirement:** Map `tahfizh.recap.read` with `scopeType: GLOBAL` and `tahfizh.reward.issue` with `scopeType: ASSIGNED_UNITS`.
  - **Source of truth:** `types/architecture-lock.ts` (`UAT_ACTIVATION_TARGETS.OPERATIONAL_TAHFIZH`)
  - **BusinessRuleState:** `APPROVED_TARGET_PENDING_TECHNICAL` (Conferring ZERO runtime authority until C2D promotion)
  - **Current state:** Unmapped in production.
  - **Target state:** Mapped with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL`.
  - **Dependency:** REL-POS-02, REL-CAP-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Query verifies `scopeType = GLOBAL` for recap and `ASSIGNED_UNITS` for reward.
  - **Negative test:** Engine denies reward issuance outside assigned units.
  - **Reconciliation evidence:** PositionCapability table audit.
  - **Rollback/recovery consideration:** Delete mappings if batch fails.
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
  - **Rollback/recovery consideration:** Delete mappings if batch fails.
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
  - **Rollback/recovery consideration:** Delete mappings if batch fails.
  - **Evidence Pack reference:** `EVID-PC-OP-KEA`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Read/create only; zero approval authority.

- **REL-PC-04 | GURU_AKADEMIK Academic Capabilities Mapping**
  - **Domain:** POSITION_CAPABILITIES / AKADEMIK
  - **Requirement:** Map `academic.schedule.read`, `academic.session.start`, `academic.material.record`, `academic.attendance.record` with `scopeType: ASSIGNED_UNITS` for `GURU_AKADEMIK`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **BusinessRuleState:** `APPROVED_TARGET_PENDING_TECHNICAL`
  - **Current state:** Unmapped in production.
  - **Target state:** Mapped with `businessRuleState = APPROVED_TARGET_PENDING_TECHNICAL`.
  - **Dependency:** REL-POS-02, REL-CAP-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Query confirms assigned academic capability set.
  - **Negative test:** Engine denies session start for non-assigned subject/cohort.
  - **Reconciliation evidence:** PositionCapability table audit.
  - **Rollback/recovery consideration:** Delete mappings if batch fails.
  - **Evidence Pack reference:** `EVID-PC-GURU-AKAD`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Tied to teaching assignment ownership.

---

### J. ASSIGNMENTS
- **REL-ASN-01 | Mudir & Leadership Assignment Provisioning**
  - **Domain:** ASSIGNMENTS / LEADERSHIP
  - **Requirement:** Provision active Assignment for Mudir (`mudir` -> `MUDIR` anchored to `OU-INSTITUTION`).
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md`, `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unassigned in production (`assignments = 0`).
  - **Target state:** Provisioned with `status: ACTIVE`, valid time window.
  - **Dependency:** GATE-C2B, REL-POS-01, REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Mudir assignment active in DB query.
  - **Negative test:** Expired window fails closed.
  - **Reconciliation evidence:** Assignment query.
  - **Rollback/recovery consideration:** Set `status = REVOKED` if invalid.
  - **Evidence Pack reference:** `EVID-ASN-LEAD`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Top leadership anchor.

- **REL-ASN-02 | Musyrif Tahfizh Halaqoh Assignments Provisioning**
  - **Domain:** ASSIGNMENTS / TAHFIZH
  - **Requirement:** Provision active Assignments for Musyrif Tahfizh anchored to their respective `HALAQOH` OrgUnits.
  - **Source of truth:** Production `halaqoh` table and staff linkage evidence
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unassigned in production.
  - **Target state:** Provisioned with `status: ACTIVE`.
  - **Dependency:** REL-OU-04, REL-POS-02, REL-STF-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run script.
  - **Positive test:** Each active musyrif has assignment matching their halaqoh.
  - **Negative test:** Mismatched halaqoh access denied.
  - **Reconciliation evidence:** Pre/post assignment audit.
  - **Rollback/recovery consideration:** Revoke assignment if misallocated.
  - **Evidence Pack reference:** `EVID-ASN-MT`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Relational link between musyrif and circle.

- **REL-ASN-03 | Kabid Tahfizh Operational Assignment Provisioning**
  - **Domain:** ASSIGNMENTS / TAHFIZH
  - **Requirement:** Provision active Assignment for designated Kabid Tahfizh account (`musyrif.tahifzh` if verified) anchored to `OU-TAHFIZH`.
  - **Source of truth:** REL-ACC-03, `docs/STQ_CURRENT_STATE.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unassigned in production.
  - **Target state:** Provisioned after verified pre-provisioning audit.
  - **Dependency:** REL-ACC-03, REL-ACC-04, REL-POS-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Exactly 1 active assignment for `KABID_TAHFIZH`.
  - **Negative test:** Rejects if target user not confirmed or duplicate exists.
  - **Reconciliation evidence:** Assignment table query.
  - **Rollback/recovery consideration:** Revoke assignment if misconfigured.
  - **Evidence Pack reference:** `EVID-ASN-KABID`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Conditional on read-only account verification.

- **REL-ASN-04 | Academic Teacher Assignments Provisioning**
  - **Domain:** ASSIGNMENTS / AKADEMIK
  - **Requirement:** Provision active Assignments for academic teachers (`GURU_AKADEMIK`) anchored to `OU-AKADEMIK`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unassigned in production.
  - **Target state:** Provisioned with `status: ACTIVE`.
  - **Dependency:** REL-POS-02, REL-OU-01, REL-STF-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Teacher assignments active in query.
  - **Negative test:** Unassigned teacher denied session start.
  - **Reconciliation evidence:** Assignment table query.
  - **Rollback/recovery consideration:** Revoke assignment if misconfigured.
  - **Evidence Pack reference:** `EVID-ASN-TEACHER`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Teacher accounts require linkage resolution.

---

### K. ASSIGNMENT SCOPE UNITS
- **REL-ASU-01 | Operational Tahfizh Scope Units Binding**
  - **Domain:** SCOPE_UNITS / TAHFIZH
  - **Requirement:** For assignments holding `tahfizh.reward.issue`, bind permitted halaqoh unit IDs relationally in `assignment_scope_units`.
  - **Source of truth:** `types/architecture-lock.ts` (`AssignmentScopeUnit`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Relational scope units bound.
  - **Dependency:** REL-ASN-02, REL-PC-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Bound unit IDs match approved target units.
  - **Negative test:** Unbound unit ID fails closed.
  - **Reconciliation evidence:** Scope units table query.
  - **Rollback/recovery consideration:** Delete scope unit rows if invalid.
  - **Evidence Pack reference:** `EVID-ASU-TAH`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Prevents global reward issuance.

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
  - **Rollback/recovery consideration:** Delete scope unit rows if invalid.
  - **Evidence Pack reference:** `EVID-ASU-KEA`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Scope isolation.

- **REL-ASU-03 | Academic Teacher Scope Units Binding**
  - **Domain:** SCOPE_UNITS / AKADEMIK
  - **Requirement:** For `GURU_AKADEMIK` assignments, bind assigned cohort/subject unit IDs relationally in `assignment_scope_units`.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in production.
  - **Target state:** Relational scope units bound.
  - **Dependency:** REL-ASN-04, REL-PC-04
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Scope units match authorized cohorts.
  - **Negative test:** Access denied to unassigned cohorts.
  - **Reconciliation evidence:** Scope units table query.
  - **Rollback/recovery consideration:** Delete scope unit rows if invalid.
  - **Evidence Pack reference:** `EVID-ASU-AKAD`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Scope isolation for academic sessions.

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
  - **Rollback/recovery consideration:** Delete placement if invalid.
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
  - **Rollback/recovery consideration:** Delete usroh units if batch fails.
  - **Evidence Pack reference:** `EVID-KEA-USROH`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Functional supervision model.

- **REL-KEA-04 | Kamar Dormitory Unit Integrity**
  - **Domain:** KEASRAMAAN / KAMAR
  - **Requirement:** Kamar units (`type: KAMAR`) strictly model physical boarding rooms; santri resident assignment is 1:1.
  - **Source of truth:** `types/architecture-lock.ts`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in DB.
  - **Target state:** Seeded in C2C.
  - **Dependency:** REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Rooms bound to `OU-KEASRAMAAN`.
  - **Negative test:** Rejects invalid gender complex binding.
  - **Reconciliation evidence:** OrgUnit table audit.
  - **Rollback/recovery consideration:** Delete kamar units if batch fails.
  - **Evidence Pack reference:** `EVID-KEA-KAMAR`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Physical dorm structure.

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
  - **Requirement:** Poskestren unit `OU-POSKESTREN` is structurally enclosed under `OU-KEASRAMAAN`.
  - **Source of truth:** `types/architecture-lock.ts` (`OrgDomain: KEASRAMAAN`)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Unseeded in DB.
  - **Target state:** Seeded in C2C.
  - **Dependency:** REL-OU-01
  - **Production write required?:** YES (INSERT)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Parent unit verified as `OU-KEASRAMAAN`.
  - **Negative test:** Top-level health domain rejected.
  - **Reconciliation evidence:** OrgUnit query.
  - **Rollback/recovery consideration:** Delete unit if batch fails.
  - **Evidence Pack reference:** `EVID-HLT-TOPOLOGY`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Decouples domain from capability.

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
  - **Rollback/recovery consideration:** Revert subject mutations if batch fails.
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
  - **Rollback/recovery consideration:** Revert subject renames if batch fails.
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
  - **Rollback/recovery consideration:** Delete created rows if batch fails.
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
  - **Negative test:** Unique name constraint blocks duplicate cohorts.
  - **Reconciliation evidence:** Cohorts table audit.
  - **Rollback/recovery consideration:** Delete cohorts if batch fails.
  - **Evidence Pack reference:** `EVID-COH-PROVISION`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting authoritative admission cohort data)
  - **Notes / unresolved decision:** Admission year semantics; Tingkat is current position only.

- **REL-COH-03 | santri.cohort_id Nullable Backfill Guard**
  - **Domain:** COHORTS / BACKFILL
  - **Requirement:** Backfill `santri.cohort_id` ONLY after authoritative mapping is approved; preserve nullability until 100% verified.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 11)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Column absent in prod; backfill not started.
  - **Target state:** Backfilled in C2C after owner decision.
  - **Dependency:** REL-COH-01, REL-COH-02
  - **Production write required?:** YES (UPDATE in C2C)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** Backfill script `--dry-run` output.
  - **Positive test:** Exactly 57 santri linked to valid cohorts.
  - **Negative test:** Abort if unmapped santri detected.
  - **Reconciliation evidence:** Pre/post santri table diff.
  - **Rollback/recovery consideration:** Set `cohort_id = NULL` to revert.
  - **Evidence Pack reference:** `EVID-COH-BACKFILL`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** High-risk data update; gated.

---

### U. TEACHING ASSIGNMENTS
- **REL-TEA-01 | TeachingAssignment Table Provisioning**
  - **Domain:** TEACHING_ASSIGNMENTS / DDL_PROVISION
  - **Requirement:** Table `teaching_assignments` created via migration M3.3B to model teacher ownership of subject + cohort.
  - **Source of truth:** `prisma/migrations/20260918140000_m3_3b_pendidikan_foundation/migration.sql`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Pending C2B.
  - **Target state:** Seeded in C2C.
  - **Dependency:** REL-MIG-04
  - **Production write required?:** YES (in C2C)
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** C2C dry-run SQL.
  - **Positive test:** Table queryable via Prisma.
  - **Negative test:** Invalid foreign keys rejected.
  - **Reconciliation evidence:** Pre/post table row counts.
  - **Rollback/recovery consideration:** Delete teaching assignments if batch fails.
  - **Evidence Pack reference:** `EVID-TEA-PROVISION`
  - **Gate:** GATE-C2C
  - **Status:** `BLOCKED` (Awaiting C2B completion)
  - **Notes / unresolved decision:** Relational teacher binding.

- **REL-TEA-02 | Teacher Account Modality Decision Specification**
  - **Domain:** TEACHING_ASSIGNMENTS / GOVERNANCE
  - **Requirement:** Teacher account modality (PERSONAL linked Staff vs UNIT + verified human executor) remains an unresolved business decision. Design supports both.
  - **Source of truth:** `STQ_PROJECT_CONTEXT.md` (Section 18)
  - **PolicyDecisionState:** `PROPOSED_TBD`
  - **Current state:** Unresolved business decision #2.
  - **Target state:** Resolved by Business Owner before teacher assignment provisioning.
  - **Dependency:** Explicit Business Owner Decision
  - **Production write required?:** NO in this stage
  - **Owner authorization required?:** YES
  - **Dry-run evidence:** TypeScript interfaces supporting both.
  - **Positive test:** System accepts either valid personal or valid unit credential.
  - **Negative test:** Unverified anonymous teacher credential rejected.
  - **Reconciliation evidence:** Architecture lock tests.
  - **Rollback/recovery consideration:** N/A
  - **Evidence Pack reference:** `EVID-TEA-MODALITY`
  - **Gate:** GATE-C2C
  - **Status:** `NOT_READY`
  - **Notes / unresolved decision:** Unresolved business decision #2.

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
  - **Requirement:** Runtime flag `PENDIDIKAN_V2_UAT_ENABLED` defaults to `false` in production. Must remain false through C2B and C2C; activated strictly in C2D under explicit owner authorization.
  - **Source of truth:** `docs/STQ_CURRENT_STATE.md` (Section 8)
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** `RUNTIME_ACTIVATION_FLAG = NOT_READY` (`false` in production).
  - **Target state:** Activated (`true`) in C2D.
  - **Dependency:** GATE-C2B, GATE-C2C
  - **Production write required?:** YES (Environment variable or flag toggle in C2D)
  - **Owner authorization required?:** YES (Explicit C2D authorization)
  - **Dry-run evidence:** Flag check in `lib/server/pendidikan-v2-readiness.ts`.
  - **Positive test:** When true, Pendidikan V2 UI and actions unlock.
  - **Negative test:** When false, all V2 endpoints return fail-closed maintenance response.
  - **Reconciliation evidence:** Deployment environment inspection.
  - **Rollback/recovery consideration:** Toggle flag back to `false` to instantly disable V2 runtime.
  - **Evidence Pack reference:** `EVID-FLG-PENDIDIKAN`
  - **Gate:** GATE-C2D
  - **Status:** `BLOCKED` (Awaiting C2B & C2C completion)
  - **Notes / unresolved decision:** Master runtime kill-switch.

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
  - **Reconciliation evidence:** UAT evidence log with timestamps and session IDs.
  - **Rollback/recovery consideration:** Clean up test data after UAT.
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
  - **Requirement:** Comprehensive fail-closed rollback protocol:
    - Pre-C2B failure: zero rollback needed (zero writes executed).
    - C2B DDL failure: restore pre-C2B backup into production.
    - C2C provisioning failure: execute reverse compensating DML script.
    - C2D activation failure: toggle `PENDIDIKAN_V2_UAT_ENABLED=false` and reset `businessRuleState`.
    - C2E failure: disable feature flags, revoke test assignments.
  - **Source of truth:** `docs/STQ_M3_RELEASE_MANIFEST.md`
  - **PolicyDecisionState:** `APPROVED`
  - **Current state:** Documented in control plane.
  - **Target state:** Ready for execution if triggered.
  - **Dependency:** None
  - **Production write required?:** NO (Activated only upon incident)
  - **Owner authorization required?:** YES (To trigger rollback)
  - **Dry-run evidence:** Rollback procedure walkthrough.
  - **Positive test:** Verified clean abort at each gate.
  - **Negative test:** Recovery tested in isolated environment.
  - **Reconciliation evidence:** Rollback drill documentation.
  - **Rollback/recovery consideration:** Built into each stage.
  - **Evidence Pack reference:** `EVID-REC-RUNBOOK`
  - **Gate:** ALL GATES
  - **Status:** `BLOCKED` (Requires backup gate completion)
  - **Notes / unresolved decision:** Incident safety net.

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
  - **Scope Impact:** Blocks `C2C` teacher assignment provisioning. Safely deferred for C2B.
  - **Classification:** `BLOCKED_BEFORE_C2C_TEACHER_PROVISIONING`
  - **Resolution Requirement:** Business Owner decides personal linked vs shared unit desk.
  - **Status:** `BLOCKED`

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
- **PASS (Verified Baseline / Guard Invariants):** 12
- **READY (Ready for Execution):** 0 (Zero items ready for mutation without prerequisites)
- **BLOCKED (Hard Gated by Backup, Credentials, or Decisions):** 30
- **NOT_READY (Waiting on Upstream Gate Completion):** 58
- **Current Authorization State:** **ZERO PRODUCTION WRITES AUTHORIZED**
- **C2B Execution Status:** `STRICTLY BLOCKED` until backup verification and owner authorization.
