# STQ EDUCATION PORTAL — M3.3 EVIDENCE PACK STANDARD
**Production Verification Protocols, Mandatory Evidence Artifacts & Release Freeze Rules**
**Document**: `docs/STQ_M3_EVIDENCE_PACK_STANDARD.md`
**Status**: `CONTROL_PLANE_ACTIVE`
**Baseline Commit (`main`)**: `8e670491d1ed0c88a480ed90186153e96ca1dea3`
**Protected PR #8**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (**OPEN / DRAFT / UNMERGED**)
**Production Mutations**: `0` (**STRICTLY PROHIBITED**)

---

## 1. Evidence Pack Philosophy & Retention Invariants

To guarantee verifiable data integrity, zero undocumented side-effects, and absolute auditability during the M3.3 Release Train, **no production phase is considered complete without a sealed, immutable Evidence Pack**.

### Core Invariants
1. **Zero Evidence Omission**: Every query, command output, migration log, and database mutation must be captured verbatim without truncation.
2. **Cryptographic Sealing**: All artifact files within an evidence pack must have their SHA-256 checksums recorded in a root `MANIFEST.sha256` file immediately upon completion.
3. **Dual Timestamping**: Every log entry must include UTC and WITA (Asia/Makassar, UTC+8) timestamps.
4. **Executor Attribution**: Evidence files must record the Git SHA, operator system username, IP address, and authenticated database identity.
5. **Fail-Closed Gate Pass**: A downstream stage cannot begin unless the upstream Evidence Pack is complete, validated against its manifest checksums, and signed off by the Business Owner.

---

## 2. Directory Layout & Artifact Registry

All production release evidence is stored within the versioned `evidence/` hierarchy:

```
evidence/
├── C2B_MIGRATION/
│   ├── MANIFEST.sha256
│   ├── 00_PRE_BACKUP_VERIFICATION.json
│   ├── 01_MIGRATION_DEPLOY_RAW.log
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
    ├── UAT_AUDIT_LOG_FULL_DUMP.json
    └── UAT_EXECUTIVE_SUMMARY_AND_ACCEPTANCE.md
```

---

## 3. Detailed Specification by Stage

### 3.1 C2B Migration Evidence Pack
- **`00_PRE_BACKUP_VERIFICATION.json`**:
  - Exact file path, file size in bytes, and SHA-256 hash of the physical database dump (`.dump` or `.tar`).
  - Scratch database restoration log verifying table count, row counts for `users`, `santri`, `halaqoh`, and `audit_events`.
- **`01_MIGRATION_DEPLOY_RAW.log`**:
  - Full verbatim stdout and stderr from `npx prisma migrate deploy`.
  - Exit code (must be `0`).
- **`02_POST_MIGRATION_SCHEMA_CATALOG.json`**:
  - Query output from PostgreSQL `information_schema.tables`, `columns`, and `pg_enum`.
  - Confirms existence of M3.3A tables (`health_cases_v2`, `health_case_v2_events`, enum `HealthStatusV2`).
  - Confirms existence of M3.3B tables (`education_cohorts`, `teaching_assignments`, `education_sessions`, `education_session_participants`, `education_session_attendances`, enums `EducationTrack`, `PedagogicalLevel`, `EducationSessionStatus`, `EducationAttendanceStatus`).
- **`03_PRISMA_MIGRATIONS_TABLE_DUMP.json`**:
  - Query `SELECT id, checksum, migration_name, finished_at FROM _prisma_migrations ORDER BY started_at ASC;`.
  - Verification that migration checksums match repository migration SQL files exactly.
- **`04_AUTOMATED_REGRESSION_TEST_RESULTS.log`**:
  - Output of test suite verifying non-regression of core auth, Tahfizh persistence, and existing endpoints.
- **`05_C2B_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting timestamp, operator, and migration status.

### 3.2 C2C Provisioning Evidence Pack
- **`00_PRE_PROVISIONING_IDENTITY_AUDIT.json`**:
  - Snapshot of all records in `users`, `staff`, `positions`, `assignments`, and `teaching_assignments`.
- **`01_REFERENCE_CATALOG_SEED_OUTPUT.json`**:
  - Record IDs and codes for 6 canonical Studi Umum subjects (`MP-SU-01` to `MP-SU-06`) and 5 Kepesantrenan subjects.
  - Record IDs for `EducationCohort` (Tingkat 1, Tingkat 2, Tingkat 3).
  - Record IDs for `OU-OSDA-ROOT`, `OU-OSDA-PUTRI`, `OU-TKS-ROOT`.
- **`02_POSITIONS_AND_CAPABILITIES_SEED_OUTPUT.json`**:
  - Position records (`MUDIR`, `KABID_TAHFIZH`, `KEPALA_KEASRAMAAN`, `PETUGAS_OPERASIONAL_TAHFIZH`, `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`, `PETUGAS_OPERASIONAL_KEASRAMAAN`, `GURU_AKADEMIK`, `GURU_KEPESANTRENAN`).
  - 9 UAT capability records (`academic.*`, `tahfizh.*`, `keasramaan.*`).
  - `PositionCapability` records with assigned scope types (`GLOBAL`, `DOMAIN`, `ASSIGNED_UNITS`, `HALAQOH`, `UNIT`).
- **`03_STAFF_LINKAGE_VERIFICATION.json`**:
  - Active staff records: `STF-0001` (Mudir), `STF-0002` (Kabid Tahfizh), `STF-0003` (Ust. Razan Mufli, S.Pd).
  - User-to-staff linkages for all provisioned teaching and operational accounts.
- **`04_RAZAN_MT_ISOLATION_PROOF.json`**:
  - Query proof that `razan.mt` has `staffId: null`, 0 `assignments`, 0 `capabilities`, and status `DEPRECATED`.
- **`05_MUSYRIF_TAHIFZH_INSPECTION.json`**:
  - Read-only query proof of `musyrif.tahifzh` user record, role, and linked assignments.
- **`06_TEACHING_ASSIGNMENTS_18_SLOTS.json`**:
  - Verification that all 18 canonical teaching slots (6 Studi Umum, 7 Kps Putra, 5 Kps Putri) are covered by active `TeachingAssignment` records.
- **`07_READINESS_DIAGNOSTIC_11_GATES.json`**:
  - Full output of `checkPendidikanV2ProductionReadiness()` confirming all 11 canonical readiness gates return `READY: true`.
- **`08_C2C_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting completion of provisioning.

### 3.3 C2D Runtime Activation Evidence Pack
- **`00_RUNTIME_ENVIRONMENT_AUDIT.json`**:
  - Non-secret environment variable inspection verifying `PENDIDIKAN_V2_UAT_ENABLED=true` in active process.
- **`01_FEATURE_FLAG_VERIFICATION.log`**:
  - Direct HTTP response confirming API endpoints acknowledge feature enablement without schema errors.
- **`02_AUTHORIZATION_CANONICAL_PROBES.log`**:
  - Successful authorization probe results for all 9 UAT capabilities with authorized credentials.
- **`03_NEGATIVE_SECURITY_PROBES.log`**:
  - Verification that unauthorized tokens, scope violations, and missing staff linkages are rejected with `403 Forbidden` / `SCOPE_MISMATCH`.
  - Substitute teacher probe verifying non-scheduled teacher is rejected with `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`.
- **`04_AUDIT_SINK_LIVENESS_CHECK.json`**:
  - Verification that audit events are written to `canonical_audit_logs` / `audit_events`.
- **`05_C2D_STAGE_SIGN_OFF.md`**:
  - Formal sign-off record documenting successful runtime activation.

### 3.4 C2E Live UAT Evidence Pack
- **`UAT_01` to `UAT_09` Artifacts**:
  - Request and response payloads for each scenario.
  - Pre-state and post-state database diffs for affected records.
  - Screenshots / UI interaction captures demonstrating successful user flow.
- **`UAT_AUDIT_LOG_FULL_DUMP.json`**:
  - Filtered export of all audit log rows generated during the UAT testing window.
- **`UAT_EXECUTIVE_SUMMARY_AND_ACCEPTANCE.md`**:
  - Final acceptance document signed by testing personnel and the Business Owner.

---

## 4. Release Freeze Protocol & Operational Safety Windows

To protect live school operations and avoid data corruption during database migration and provisioning, the following operational window protocol is strictly enforced:

### 4.1 Scheduled Maintenance Window
- **Permitted Execution Window**: 22:00 WITA to 04:00 WITA (outside core school, tahfizh setoran, and academic session hours).
- **Prohibited Hours**: 05:00 WITA to 21:30 WITA (active setoran, classes, and halaqoh sessions).

### 4.2 Maintenance Freeze Procedures
1. **Pre-Freeze Notice**: Post system maintenance notice on portal 2 hours prior to window.
2. **Read-Only Lockout**: Enable maintenance mode banner to prevent concurrent user mutations during migration.
3. **Session Drain**: Allow active HTTP requests to complete; verify no long-running transactions exist in `pg_stat_activity`.
4. **Execution Under Freeze**:
   - Gate 0 (Backup) $\rightarrow$ Gate 1 (Migration) $\rightarrow$ Gate 2 (Reconcile) $\rightarrow$ Gate 3 (Provision) $\rightarrow$ Gate 4 (Reconcile) $\rightarrow$ Gate 5 (Activate).
5. **Emergency Abort Criteria**:
   - Migration takes $> 10$ minutes.
   - Any unhandled SQL constraint violation occurs.
   - Core regression suite fails.
   - If aborted, restore pre-migration backup immediately and unfreeze in legacy state.
6. **Post-Release Unfreeze**: Verify all 11 diagnostic gates pass, release maintenance banner, and re-enable active portal operations.
