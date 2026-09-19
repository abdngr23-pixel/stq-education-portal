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
│   • Record counts and relation cardinalities (e.g. 57 santri, 10 staff)                          │
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
│   • Complete physical SQL database exports (`.dump`, `.tar`, `.sql`)                             │
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
  - File size in bytes and SHA-256 hash of the physical database dump (`.dump`).
  - Scratch database restoration verification log confirming table count, row count checksums for `users`, `santri`, `halaqoh`, and `audit_events` without logging raw row contents.
  - Confirmation that dump connection used least-privilege read access (`SELECT` on required objects) and restore used isolated scratch credentials.
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
- **`01_REFERENCE_CATALOG_SEED_OUTPUT.json`**:
  - Record IDs and codes for 6 canonical Studi Umum subjects (`MP-SU-01` to `MP-SU-06`) and 5 Kepesantrenan subjects.
  - Record IDs for `EducationCohort` representing permanent admission year cohorts (e.g. `2024/2025`, `2025/2026`; strictly NEVER `Tingkat 1/2/3`). Note: Cohort creation remains `BLOCKED` until authoritative Business Owner admission data is provided.
  - Record IDs for `OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT`.
- **`02_POSITIONS_AND_CAPABILITIES_SEED_OUTPUT.json`**:
  - Position records (`MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`, `PETUGAS_OPERASIONAL_TAHFIZH`, `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`, `PETUGAS_OPERASIONAL_KEASRAMAAN`, `GURU_AKADEMIK`, `GURU_KEPESANTRENAN`).
  - 9 UAT capability records (`academic.*`, `tahfizh.*`, `keasramaan.*`).
  - `PositionCapability` records with assigned canonical scopes (`GLOBAL`, `DOMAIN`, `ASSIGNED_UNITS`, `HALAQOH`).
- **`03_STAFF_LINKAGE_VERIFICATION.json`**:
  - Active staff records and user-to-staff linkages verified via read-only audit.
  - Note: `musyrif.tahifzh` staff linkage is `UNKNOWN / MUST_VERIFY_READ_ONLY`. Do not invent specific Staff IDs (`STF-0001`, `STF-0002`, `STF-0003`, `STF-0004`).
- **`04_RAZAN_MT_ISOLATION_PROOF.json`**:
  - Proof that `razan.mt` has `staffId: null`, 0 `assignments`, 0 `capabilities`, and is targeted for decommission via schema-supported deactivation (e.g. status `NONAKTIF` or `SUSPENDED`, login disabled).
- **`05_MUSYRIF_TAHIFZH_INSPECTION.json`**:
  - Read-only query proof of `musyrif.tahifzh` user record, role, and current linkage state. Classified as `BUSINESS_OWNER_DESIGNATED`, staff linkage `UNKNOWN / MUST_VERIFY_READ_ONLY`.
- **`06_TEACHING_ASSIGNMENTS_18_SLOTS.json`**:
  - Verification that all 18 canonical teaching slots (6 Studi Umum, 7 Kps Putra, 5 Kps Putri) are covered by active `TeachingAssignment` records.
- **`07_READINESS_DIAGNOSTIC_11_GATES.json`**:
  - Full output of `checkPendidikanV2ProductionReadiness()` confirming all 11 canonical readiness gates return `READY: true`.
- **`08_C2C_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting completion of provisioning.

### 3.3 C2D Runtime Activation Evidence Pack
- **`00_RUNTIME_ENVIRONMENT_AUDIT.json`**:
  - Non-secret environment variable inspection verifying `PENDIDIKAN_V2_UAT_ENABLED=true` in active process (all secrets and database URLs redacted).
- **`01_FEATURE_FLAG_VERIFICATION.log`**:
  - Direct HTTP response confirming API endpoints acknowledge feature enablement without schema errors.
- **`02_AUTHORIZATION_CANONICAL_PROBES.log`**:
  - Authorization probe results for the 9 UAT capabilities with authorized credentials.
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
  - Pre-state and post-state database diffs for affected non-sensitive fields.
  - UI interaction captures (sanitized DOM inspection or screenshots).
- **`UAT_AUDIT_LOG_SANITIZED_EXTRACT.json`**:
  - Filtered export containing only the specific audit log entries generated by the UAT test actions (personal details and secrets redacted).
- **`UAT_EXECUTIVE_SUMMARY_AND_ACCEPTANCE.md`**:
  - Final acceptance document signed by testing personnel and the Business Owner.

---

## 4. Release Freeze Protocol & Safety Guidelines

### 4.1 Proposed Maintenance Window
- **Proposed Execution Window**: `22:00 WITA to 04:00 WITA` (outside core school, tahfizh setoran, and academic session hours).
- **Policy Decision State**: `PROPOSED_TBD / OWNER_APPROVAL_REQUIRED`
- **Notice**: This window is an engineering proposal. No production deployment may rely on or execute during this window until the Business Owner explicitly authorizes the schedule. (Likewise, designated off-hours are proposals, not locked institutional policy).

### 4.2 Maintenance Freeze Procedures
1. **Pre-Freeze Notice**: Post system maintenance notice on portal prior to agreed window.
2. **Read-Only Lockout**: Enable maintenance mode banner to prevent concurrent user mutations during migration.
3. **Session Drain**: Allow active HTTP requests to complete; verify no long-running transactions exist in `pg_stat_activity`.
4. **Execution Under Freeze**:
   - Gate 0 (Backup) $\rightarrow$ Gate 1 (Migration) $\rightarrow$ Gate 2 (Reconcile) $\rightarrow$ Gate 3 (Provision) $\rightarrow$ Gate 4 (Reconcile) $\rightarrow$ Gate 5 (Activate).
5. **Abort & Incident Assessment Trigger**:
   - Unexpected migration duration, transaction stalls, or lock contention acts as an **ABORT/ASSESS** trigger:
     - Stop further release progression immediately.
     - Inspect migration and database connection state.
     - **DO NOT automatically restore production**. Database restore is itself a high-risk production mutation.
     - Restore from backup only if the actual failure state requires it and the recovery action is explicitly authorized according to the release incident procedure.
6. **Post-Release Unfreeze**: Verify all 11 diagnostic gates pass, release maintenance banner, and re-enable active portal operations.
