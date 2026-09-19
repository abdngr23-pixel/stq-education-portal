# STQ EDUCATION PORTAL — M3.3 EVIDENCE PACK STANDARD
**Production Verification Protocols, Mandatory Evidence Artifacts & Privacy/Security Hardening**
**Document**: `docs/STQ_M3_EVIDENCE_PACK_STANDARD.md`
**Status**: `CONTROL_PLANE_ACTIVE`
**Baseline Commit (`main`)**: `8e670491d1ed0c88a480ed90186153e96ca1dea3`
**Protected PR #8**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (**OPEN / DRAFT / UNMERGED**)
**Production Mutations**: `0` (**STRICTLY PROHIBITED**)

---

## 1. Evidence Classification & Privacy/Security Architecture

To guarantee verifiable data integrity, zero undocumented side-effects, and absolute auditability during the M3.3 Release Train while strictly protecting operational credentials and personal privacy, all release evidence is partitioned into two distinct classes:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EVIDENCE CLASSIFICATION MODEL                                  │
│                                                                                                  │
│   CLASS A: REPOSITORY-SAFE EVIDENCE (Committed to Git after Sanitization)                       │
│   • Cryptographic SHA-256 Checksums (MANIFEST.sha256)                                            │
│   • Record counts and relation cardinalities (e.g. dynamic T0 snapshot row counts)               │
│   • Database schema names, table names, column names, enum labels                                │
│   • Migration filenames and execution statuses                                                   │
│   • PASS / FAIL gate diagnostic results                                                          │
│   • Redacted command metadata, non-sensitive public identifiers                                  │
│   • Summarized authorization decisions (ALLOW / DENY + reason code)                              │
│                                                                                                  │
│   CLASS B: RESTRICTED RAW EVIDENCE (STRICTLY FORBIDDEN IN GIT — Secure Vault Storage)           │
│   • Connection strings (`DATABASE_URL`, `DIRECT_URL`, `BACKUP_DATABASE_URL`)                     │
│   • Authentication tokens, session cookies, JWTs, API tokens, private keys                       │
│   • Password hashes (`passwordHash`), PINs, raw credentials                                      │
│   • Secret environment variable values                                                           │
│   • Full unredacted table dumps of `users` or `staff` containing PII / phone numbers             │
│   • Raw unredacted audit-log dumps, raw Authorization headers                                    │
│   • Personally sensitive `beforeState` / `afterState` payloads                                   │
│   • Complete logical SQL database exports (`.sql`, `.sql.sha256`)                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Mandatory Redaction Rules
Every artifact committed to the repository must be strictly sanitized. The following keys and substrings must be replaced with `[REDACTED]` or omitted prior to commit:
- `DATABASE_URL`, `DIRECT_URL`, `BACKUP_DATABASE_URL`
- `password`, `passwordHash`, `pin`, `token`, `secret`, `jwt`
- `cookie`, `set-cookie`, `authorization`, `bearer`
- Phone numbers, personal email addresses, national identity numbers
- Private cryptographic keys and certificates

Evidence integrity is preserved through SHA-256 hashes of the raw restricted artifacts recorded in a sanitized manifest (`MANIFEST.sha256`), allowing independent mathematical verification without exposing sensitive operational data in version control.

---

## 2. Directory Layout & Artifact Registry

Repository-safe evidence is organized within the versioned `evidence/` directory hierarchy:

```
evidence/
├── C2B_MIGRATION/
│   ├── MANIFEST.sha256
│   ├── 00_PRE_BACKUP_VERIFICATION.json
│   ├── 01_MIGRATION_DEPLOY_SUMMARY.log
│   ├── 02_POST_MIGRATION_SCHEMA_CATALOG.json
│   ├── 03_PRISMA_MIGRATIONS_TABLE_DUMP.json
│   ├── 04_AUTOMATED_REGRESSION_TEST_RESULTS.log
│   └── 05_C2B_STAGE_SIGN_OFF.md
├── C2C_PROVISIONING/
│   ├── MANIFEST.sha256
│   ├── 00_PRE_PROVISIONING_IDENTITY_AUDIT.json
│   ├── 01_REFERENCE_CATALOG_SEED_OUTPUT.json
│   ├── 02_POSITIONS_AND_CAPABILITIES_SEED_OUTPUT.json
│   ├── 03_STAFF_LINKAGE_VERIFICATION.json
│   ├── 04_RAZAN_MT_ISOLATION_PROOF.json
│   ├── 05_MUSYRIF_TAHIFZH_INSPECTION.json
│   ├── 06_TEACHING_ASSIGNMENTS_18_SLOTS.json
│   ├── 07_READINESS_DIAGNOSTIC_11_GATES.json
│   └── 08_C2C_STAGE_SIGN_OFF.md
├── C2D_ACTIVATION/
│   ├── MANIFEST.sha256
│   ├── 00_RUNTIME_ENVIRONMENT_AUDIT.json
│   ├── 01_FEATURE_FLAG_VERIFICATION.log
│   ├── 02_AUTHORIZATION_CANONICAL_PROBES.log
│   ├── 03_NEGATIVE_SECURITY_PROBES.log
│   ├── 04_AUDIT_SINK_LIVENESS_CHECK.json
│   └── 05_C2D_STAGE_SIGN_OFF.md
└── C2E_LIVE_UAT/
    ├── MANIFEST.sha256
    ├── UAT_01_ACADEMIC_SCHEDULE_READ.json
    ├── UAT_02_ACADEMIC_SESSION_START.json
    ├── UAT_03_ACADEMIC_MATERIAL_RECORD.json
    ├── UAT_04_ACADEMIC_ATTENDANCE_RECORD.json
    ├── UAT_05_TAHFIZH_RECAP_READ.json
    ├── UAT_06_TAHFIZH_REWARD_ISSUE.json
    ├── UAT_07_TAHFIZH_TARGET_MANAGE.json
    ├── UAT_08_KEASRAMAAN_PERMISSION_READ.json
    ├── UAT_09_KEASRAMAAN_PERMISSION_CREATE.json
    ├── UAT_AUDIT_LOG_SANITIZED_EXTRACT.json
    └── UAT_EXECUTIVE_SUMMARY_AND_ACCEPTANCE.md
```

---

## 3. Detailed Specification by Stage

### 3.1 C2B Migration Evidence Pack
- **`00_PRE_BACKUP_VERIFICATION.json`**:
  - **Backup Tooling Contract**: Matches executable script [`scripts/backup-db.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/scripts/backup-db.ts) producing plain SQL logical dump (`pg_dump -F p`) named `stq_backup_<timestamp>.sql` and SHA-256 file `stq_backup_<timestamp>.sql.sha256`.
  - **pg_dump Version Compatibility Check**:
    - Query production database read-only: `SELECT version(), current_setting('server_version_num');`.
    - Detect client `pg_dump --version`.
    - Fail closed if client major version is older than production server major version (`client_major < server_major => FAIL_CLOSED`).
    - Tooling parity note: `scripts/backup-db.ts` does not currently implement this comparison automatedly (`PG_DUMP_MAJOR_COMPATIBILITY_GUARD = REQUIRED / NOT_IMPLEMENTED_IN_BACKUP_SCRIPT`); verification must be performed via audited preflight step or enhanced tooling prior to Gate 0 exit.
  - **Dynamic T0 Snapshot & Verification**:
    - Pre-backup read-only query captures T0 row counts across all tables (`users`, `santri`, `halaqoh`, `staff`, `audit_events`, etc.).
    - Dry-run restore executes `psql -f <backup.sql>` against an isolated scratch database.
    - Post-restore verification checks `RESTORED_T0 == SOURCE_T0` (table counts, row counts, migration ledger). Historical C2A numbers (57 santri, 18 users, 10 staff) are historical references only.
  - **Least Privilege Confirmation**: Verifies dump used least-privilege read access (`SELECT` on schemas, tables, sequences, views, types) and restore used isolated scratch credentials.
- **`01_MIGRATION_DEPLOY_SUMMARY.log`**:
  - Sanitized stdout and stderr from `npx prisma migrate deploy` (connection strings and credentials redacted).
  - Exit code (must be `0`).
- **`02_POST_MIGRATION_SCHEMA_CATALOG.json`**:
  - Query output from PostgreSQL `information_schema.tables`, `columns`, and `pg_enum`.
  - Confirms presence of M3.3A tables (`health_cases_v2`, `health_case_v2_events`, enum `HealthStatusV2`).
  - Confirms presence of M3.3B tables (`education_cohorts`, `teaching_assignments`, `education_sessions`, `education_session_participants`, `education_session_attendances`, enums `EducationTrack`, `PedagogicalLevel`, `EducationSessionStatus`, `EducationAttendanceStatus`).
- **`03_PRISMA_MIGRATIONS_TABLE_DUMP.json`**:
  - Sanitized query: `SELECT id, checksum, migration_name, finished_at FROM _prisma_migrations ORDER BY started_at ASC;`.
  - Checksums matched 100% against repository migration files.
- **`04_AUTOMATED_REGRESSION_TEST_RESULTS.log`**:
  - Output of test suite verifying non-regression of core auth, Tahfizh persistence, and existing endpoints.
- **`05_C2B_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting timestamp, operator, and migration status.

### 3.2 C2C Provisioning Evidence Pack
- **`00_PRE_PROVISIONING_IDENTITY_AUDIT.json`**:
  - Least-data identity verification: selected non-secret identifiers (`id`, `username`, `role`, `accountType`, `status`), staff linkage state (`staffId != null`), and table row counts. Zero password hashes, PINs, or personal phone numbers.
  - Read-only effective-access inventory distinguishing `CANONICAL_ASSIGNMENT_AUTHORITY` (currently 0) from `LEGACY_RUNTIME_AUTHORITY` (must audit; may exist in production).
- **`01_REFERENCE_CATALOG_SEED_OUTPUT.json`**:
  - Record IDs and codes for 6 canonical Studi Umum subjects (`MP-SU-01` to `MP-SU-06`) and 5 Kepesantrenan subjects.
  - Record IDs for `EducationCohort` representing permanent admission year cohorts (e.g. `2024/2025`, `2025/2026`; strictly NEVER `Tingkat 1/2/3`). Dynamic rule: 100% of authoritatively in-scope active santri captured at C2C preflight must have an approved permanent cohort mapping or the gate remains `BLOCKED`.
  - Record IDs for required OrgUnits (`OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT`). Extra org units (`OU-INSTITUTION`, `OU-TAHFIZH`, `OU-KEASRAMAAN`, `OU-AKADEMIK`, `OU-MANAJEMEN`) are `PROPOSED_TBD` and not part of minimum C2C gate.
- **`02_POSITIONS_AND_CAPABILITIES_SEED_OUTPUT.json`**:
  - Position records strictly limited to approved gate set: `MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`, `PETUGAS_OPERASIONAL_TAHFIZH`, `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`, `PETUGAS_OPERASIONAL_KEASRAMAAN`.
  - 9 UAT capability records registered in database (`academic.*`, `tahfizh.*`, `keasramaan.*`).
  - `PositionCapability` records mapped strictly to approved target scopes (`PETUGAS_OPERASIONAL_TAHFIZH`: recap `GLOBAL`, reward `ASSIGNED_UNITS`; `MUSYRIF_TAHFIZH`/`PEMBINA_HALAQOH`: target `HALAQOH`; `PETUGAS_OPERASIONAL_KEASRAMAAN`: permission `ASSIGNED_UNITS`).
  - Note: Academic position grant policy (`GURU_AKADEMIK` mapping) is `PROPOSED_TBD / BLOCKED` due to unresolved teacher account modality and unresolved unit containment (`orgUnitIds: []`).
- **`03_STAFF_LINKAGE_VERIFICATION.json`**:
  - Active staff records and user-to-staff linkages verified via read-only audit without inventing unverified Staff ID assignments.
  - `musyrif.tahifzh` staff linkage is `UNKNOWN / MUST_VERIFY_READ_ONLY`.
  - `musyrifah.putri` and `pembina.halaqoh` account modality: `ACCOUNT_MODALITY = UNRESOLVED / MUST_VERIFY` (`PolicyDecisionState: PROPOSED_TBD`).
- **`04_RAZAN_MT_ISOLATION_PROOF.json`**:
  - Proof that `razan.mt` has `staffId: null`, 0 `assignments`, 0 `capabilities`, and is targeted for decommission via schema-supported deactivation (`status = NONAKTIF` or `SUSPENDED`).
  - Post-decommission verification proof:
    1. New login denied.
    2. Existing cookie/JWT fails server session resolution (`user.status != AKTIF`).
    3. Server actions and API operations deny the account.
    4. Zero canonical assignments/grants; no duplicate Kabid authority.
- **`05_MUSYRIF_TAHIFZH_INSPECTION.json`**:
  - Read-only query proof of `musyrif.tahifzh` user record, role, and current linkage state. Classified as `BUSINESS_OWNER_DESIGNATED`, staff linkage `UNKNOWN / MUST_VERIFY_READ_ONLY`.
- **`06_TEACHING_ASSIGNMENTS_18_SLOTS.json`**:
  - Verification of teaching assignments modeling subject + education track + gender complex + optional pedagogical level + validity period (Prisma fields: `mapelId`, `staffId`, `educationTrack`, `genderComplex`, `pedagogicalLevel`, `validFrom`, `validUntil`). Note: `TeachingAssignment` does NOT contain `cohortId`.
  - Invariant Distinction: A valid `TeachingAssignment` alone does NOT confer canonical runtime authority. Likewise, canonical `Assignment` alone does not prove a teacher is scheduled for a particular `EducationSession`. Both layers are verified independently.
- **`07_READINESS_DIAGNOSTIC_11_GATES.json`**:
  - Full output of `checkPendidikanV2ProductionReadiness()` evaluating canonical readiness gates.
- **`08_C2C_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting completion of provisioning.

### 3.3 C2D Runtime Activation Evidence Pack
- **`00_RUNTIME_ENVIRONMENT_AUDIT.json`**:
  - Non-secret environment variable inspection verifying `PENDIDIKAN_V2_UAT_ENABLED=true` in active process (all secrets and database URLs redacted).
- **`01_FEATURE_FLAG_VERIFICATION.log`**:
  - Direct HTTP response confirming API endpoints acknowledge feature enablement without schema errors.
- **`02_AUTHORIZATION_CANONICAL_PROBES.log`**:
  - Authorization probe results for approved capabilities with authorized credentials.
- **`03_NEGATIVE_SECURITY_PROBES.log`**:
  - Verification that unauthorized requests, scope violations, and missing staff linkages return `403 Forbidden` / `SCOPE_MISMATCH`.
  - Substitute teacher probe verifying non-scheduled teacher is rejected with `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`.
- **`04_AUDIT_SINK_LIVENESS_CHECK.json`**:
  - Verification that audit events are written to `canonical_audit_logs` / `audit_events`.
- **`05_C2D_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting successful runtime activation.

### 3.4 C2E Live UAT Evidence Pack
- **`UAT_01` to `UAT_09` Artifacts**:
  - Sanitized request and response payloads for each scenario.
  - **`UAT_04_ACADEMIC_ATTENDANCE_RECORD.json`**: Explicitly restricted to Kepesantrenan attendance flow (`HADIR`, `IZIN`, `SAKIT`, `ALFA`, `NO MASBUK`). Studi Umum student attendance mutation remains `DEFERRED / DENY / NOT ACTIVATED`.
  - Pre-state and post-state database diffs for affected non-sensitive fields.
  - UI interaction captures (sanitized DOM inspection or screenshots).
- **`UAT_AUDIT_LOG_SANITIZED_EXTRACT.json`**:
  - Filtered export containing only the specific audit log entries generated by the UAT test actions (personal details and secrets redacted).
- **`UAT_EXECUTIVE_SUMMARY_AND_ACCEPTANCE.md`**:
  - Final acceptance document signed by testing personnel and the Business Owner.

---

## 4. Release Freeze Protocol & Operational Safety Guidelines

### 4.1 Proposed Maintenance Window
- **Proposed Execution Window**: `22:00 WITA to 04:00 WITA` (outside core school, tahfizh setoran, and academic session hours).
- **Policy Decision State**: `PROPOSED_TBD / OWNER_APPROVAL_REQUIRED`
- **Notice**: This window is an engineering proposal. No production deployment may rely on or execute during this window until the Business Owner explicitly authorizes the schedule. (Designated off-hours are proposals, not locked institutional policy).

### 4.2 Maintenance Freeze & Rollback Procedures
1. **Pre-Freeze Notice**: Post system maintenance notice on portal prior to agreed window.
2. **Maintenance Mode Lockout Status**:
   - `MAINTENANCE_MODE = NOT_IMPLEMENTED / PROPOSED`.
   - Critical Invariant: No server-side maintenance write-lock currently exists in the codebase. A UI banner alone is NOT a production write lock. Server-side mutation blocking must be verified or implemented before relying on maintenance mode during release execution.
3. **Session Drain**: Allow active HTTP requests to complete; verify no long-running transactions exist in `pg_stat_activity`.
4. **Execution Under Freeze**:
   - Gate 0 (Backup) $\rightarrow$ Gate 1 (Migration) $\rightarrow$ Gate 2 (Reconcile) $\rightarrow$ Gate 3 (Provision) $\rightarrow$ Gate 4 (Reconcile) $\rightarrow$ Gate 5 (Activate).
5. **Abort & Incident Assessment Trigger**:
   - Unexpected migration duration, transaction stalls, or lock contention acts as an **ABORT/ASSESS** trigger:
     - Stop further release progression immediately.
     - Inspect migration and database connection state.
     - **DO NOT automatically restore production**. Database restore is itself a high-risk production mutation.
     - Restore from backup only if the actual failure state requires it and the recovery action is explicitly authorized according to the release incident procedure.
6. **Non-Destructive Rollback Protocol**:
   - Generic destructive rollback (e.g. automatic deletion of rows, blanket-nulling fields) is strictly prohibited.
   - If an operation fails mid-way: `STOP -> preserve evidence -> inspect transaction state -> compare exact before-state -> use transaction rollback when still possible -> otherwise perform only explicitly authorized compensating action based on exact created/changed IDs and captured before-state.`
7. **Post-Release Unfreeze**: Verify all 11 diagnostic gates pass, release maintenance banner, and re-enable active portal operations.
