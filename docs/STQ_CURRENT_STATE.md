# STQ EDUCATION PORTAL — CURRENT STATE

**Purpose:** Small, frequently updated checkpoint for exact release/production state.  
**Repository:** `abdngr23-pixel/stq-education-portal`  
**Last independently verified:** 2026-09-19  
**Status:** ACTIVE PROJECT CHECKPOINT

> This file is intentionally dynamic. Update it after every major merge, migration, production provisioning step, activation step, or explicit business-policy change.

> [!IMPORTANT]
> The actual current `main` HEAD is an external repository fact and must always be resolved directly from Git/GitHub before implementation, audit, merge, migration, deployment, or production work.
>
> An embedded SHA in this document is a historical/checkpoint reference, not proof of the present live `main` HEAD.

---

## 1. Verified Repository Checkpoint

All commit SHAs recorded below are verified historical checkpoints, not self-updating HEAD declarations. The present live `main` HEAD must always be queried directly from Git/GitHub.

### Verified checkpoints

- **Initial Project Context Lock source baseline:**
  `8492089a0dedddb05a176c66e941305c80037404`
  (Merge commit for PR #22: `M3.3C2A: Production Preflight & Backup Security Hardening`)
  - PR #22 state: MERGED
  - Merge commit: `8492089a0dedddb05a176c66e941305c80037404`
  - Post-merge CI run: `35417547600` (SUCCESS)
  - Vercel `stq-education-portal`: SUCCESS
  - Vercel `stq-education-portal-app`: SUCCESS
  - Classification: `M3_3C2A = OFFICIALLY_CLOSED`

- **M3.3C2A.1 post-reconciliation verified main checkpoint:**
  `5ba4060f841304a189fce622d39243864b7c453a`
  (Merge commit for PR #23: `M3.3C2A.1: PR #8 Migration Ledger + Prisma Schema Parity Reconciliation`)
  - PR #23 state: MERGED
  - Merge commit: `5ba4060f841304a189fce622d39243864b7c453a`
  - Post-merge CI run: `35418182740` (SUCCESS)
  - Vercel `stq-education-portal`: SUCCESS
  - Vercel `stq-education-portal-app`: SUCCESS
  - Classification: `M3.3C2A.1 = MERGED_AND_POSTMERGE_VERIFIED`

---

## 2. PR #8 immutable guard

PR:

`#8 — Tahfizh Quality & Evaluation Engine`

Branch:

`review/tahfizh-quality-evaluation`

Exact HEAD:

`9068cae5587b7219c394c5c25bf0de07a15b0726`

Expected protected state:

- OPEN
- DRAFT
- UNMERGED
- do not modify casually

Do not:

- merge wholesale;
- rebase casually;
- squash;
- cherry-pick wholesale;
- use its runtime/UI/features as an implicit approved release.

---

## 3. Historical PR #8 production migration condition & reconciliation status

Production contains migration:

`20260915100000_add_tahfizh_quality_engine`

Production applied timestamp:

`2026-09-15T00:06:15.307Z`

Exact production checksum:

`fc96b177d5219c5b2853c6c86a0fa3d28bce0944890bfde9de2e5d6fe7391467`

The exact historical migration artifact is now present in canonical `main` repository lineage (restored via PR #23, merged at checkpoint `5ba4060f841304a189fce622d39243864b7c453a`), and its exact checksum remains:

`fc96b177d5219c5b2853c6c86a0fa3d28bce0944890bfde9de2e5d6fe7391467`

Current canonical `main` lineage also includes the required Prisma schema parity declarations.

Reconciliation status:

- `M3.3C2A.1 PR #8 Migration Ledger + Prisma Schema Parity Reconciliation = MERGED_AND_POSTMERGE_VERIFIED`
- `PR #23 = MERGED` (Merge commit checkpoint: `5ba4060f841304a189fce622d39243864b7c453a`)
- `PR8_MIGRATION_LEDGER_RECONCILIATION = COMPLETE`
- `MIGRATION_LEDGER_DIVERGENCE = RESOLVED`

The previous repository condition ("production migration applied but missing locally") has been resolved and is no longer an active blocker.

PR #8 itself was NOT merged and remains:
- OPEN / DRAFT / UNMERGED
- HEAD: `9068cae5587b7219c394c5c25bf0de07a15b0726`

---

## 4. Current next planned gate & operational boundaries

M3.3C2A.1 PR #8 migration ledger + Prisma schema parity reconciliation is COMPLETE (merged via PR #23).

### Current next planned gate:

**REAL PRODUCTION BACKUP READINESS**

Requirements remain:

- direct PostgreSQL wire-compatible connection
- `pg_dump`
- verified dump file
- SHA-256 checksum
- isolated restore verification

IMPORTANT:

- Do NOT execute the backup as part of this PR.
- Do NOT perform any production write.
- Do NOT start C2B.

`M3.3C2B` remains:

`BLOCKED / NOT STARTED`

until backup requirements and separate Business Owner authorization are satisfied.

---

## 5. Production migration state

Production currently has architecture migrations applied including:

- `20260917000000_stq_architecture_lock_phase2a`
- `20260917220000_m3_1_keasramaan_structure`

Production does **not** yet have:

- `20260918120000_m3_3a_health_v2_backend`
- `20260918140000_m3_3b_pendidikan_foundation`

No partial M3.3A/M3.3B production schema drift was detected during M3.3C2A read-only audit.

---

## 6. M3.3A state

Migration:

`20260918120000_m3_3a_health_v2_backend`

Code state:

`CODE_COMPLETE`

Production state:

`NOT_APPLIED`

Creates:

- enum `HealthStatusV2`
- `health_cases_v2`
- `health_case_v2_events`

Migration is additive and is not currently authorized for production deployment.

---

## 7. M3.3B state

Migration:

`20260918140000_m3_3b_pendidikan_foundation`

Code state:

`CODE_COMPLETE`

Production state:

`NOT_APPLIED`

Creates/adds foundation for:

- `EducationTrack`
- `PedagogicalLevel`
- `EducationSessionStatus`
- `EducationAttendanceStatus`
- `santri.cohort_id` nullable
- `education_cohorts`
- `teaching_assignments`
- `education_sessions`
- `education_session_participants`
- `education_session_attendances`

No cohort backfill and no teacher-assignment production provisioning has been performed.

---

## 8. Production data/readiness snapshot from M3.3C2A

Read-only observed counts:

- santri = 57
- users = 18
- staff = 10
- mata_pelajaran = 9
- org_units = 0
- positions = 0
- capabilities = 0
- assignments = 0
- canonical_audit_logs = 0 rows

Readiness gates at C2A:

- `M3_3A_SCHEMA_READY` = NOT_READY
- `M3_3B_SCHEMA_READY` = NOT_READY
- `CANONICAL_AUDIT_READY` = READY
- `STAFF_LINKAGE_READY` = BLOCKED
- `REQUIRED_ORG_UNITS_READY` = NOT_READY
- `REQUIRED_POSITIONS_READY` = NOT_READY
- `CAPABILITIES_REGISTERED` = NOT_READY
- `USER_ASSIGNMENTS_READY` = NOT_READY
- `TEACHING_ASSIGNMENTS_READY` = NOT_READY
- `COHORTS_ASSIGNED` = NOT_READY
- `RUNTIME_ACTIVATION_FLAG` = NOT_READY

These states are expected before controlled production provisioning/activation.

Do not fake readiness.

---

## 9. Current staff-linkage findings

Production contains operational-style accounts without active Staff linkage including:

- `musyrifah.putri`
- `pembina.halaqoh`
- `razan.mt`

Known intended relation:

`razan.mt` corresponds operationally to Ust. Razan Mufli, S.Pd / Staff `STF-0003`.

However, production linkage is a WRITE and requires explicit authorization.

Do not silently repair.

Not every user without Staff linkage is an error: santri, wali, unit/function accounts, and other identities can legitimately use different linkage models.

---

## 10. Current canonical subject gap

Kepesantrenan canonical subjects currently present in production:

- Bahasa Arab
- Fikih
- Tafsir
- Aqidah Islamiyah
- Tajwid

Legacy/ambiguous additional subjects include:

- Bahasa Arab & Nahwu
- Fiqih Ibadah
- Adab & Kepesantrenan

Studi Umum:

- canonical `Matematika` is currently ambiguous because production has `Matematika Terapan`
- Bahasa Inggris = missing
- IPS = missing
- IPA = missing
- Bahasa Indonesia = missing
- TIK = missing

Do not create or rename production subjects without explicit provisioning authorization.

---

## 11. Current cohort production gap

There are 57 active santri.

Production `santri` currently has no authoritative permanent:

- angkatan
- tahun_masuk

Therefore:

`COHORT_MAPPING = NEEDS_BUSINESS_INPUT`

Do not infer permanent cohort from:

- gender
- current class
- age

No `COHORT-PUTRA` / `COHORT-PUTRI`.

---

## 12. Backup state

Backup tooling has been hardened, including fail-closed `pg_dump` requirements, checksum verification, secret redaction, and direct PostgreSQL connection contract.

Current state:

`BACKUP_EXECUTION_READY = BLOCKED`

Reason during C2A:

- `pg_dump` unavailable in the audited environment;
- no confirmed direct PostgreSQL wire-compatible connection was available for actual dump execution.

No real production backup has yet been executed.

Before production M3.3A/M3.3B migration:

A REAL production backup must be completed with:

- direct PostgreSQL connection
- `pg_dump`
- verified dump file
- SHA-256
- isolated restore verification

---

## 13. Required UAT capability set

Current required activation set is 9 capabilities.

Academic:

- `academic.schedule.read`
- `academic.session.start`
- `academic.material.record`
- `academic.attendance.record`

Tahfizh:

- `tahfizh.recap.read`
- `tahfizh.reward.issue`
- `tahfizh.target.manage`

Keasramaan:

- `keasramaan.permission.read`
- `keasramaan.permission.create`

Do not regress documentation to the older “all 12 academic capabilities” assumption.

Deferred capabilities do not block the current activation unless explicitly approved.

---

## 14. Approved target policies not yet live

Examples currently classified `APPROVED_TARGET_PENDING_TECHNICAL` include:

### PETUGAS_OPERASIONAL_TAHFIZH

- `tahfizh.recap.read` → `GLOBAL`
- `tahfizh.reward.issue` → `ASSIGNED_UNITS`

### MUSYRIF_TAHFIZH

- `tahfizh.target.manage` → `HALAQOH`

### PEMBINA_HALAQOH

- `tahfizh.target.manage` → `HALAQOH`

### PETUGAS_OPERASIONAL_KEASRAMAAN

- `keasramaan.permission.read` → `ASSIGNED_UNITS`
- `keasramaan.permission.create` → `ASSIGNED_UNITS`

These are approved targets but grant zero runtime authority until deliberate activation/promotion.

Do not invent approved target policies for:

- `keasramaan.perizinan.approve`
- `health.record.write`
- `tahfizh.halaqoh.manage`

Keasramaan `approve_mk` / `approve_ks` remain `PROPOSED_TBD`.

---

## 15. OSDA Putri target

Canonical target unit:

`OU-OSDA-PUTRI`

Target account modality:

`UNIT`

Gender complex:

`PUTRI`

Maximum active placement:

`1`

Verified human executor required:

`YES`

Must prevent PUTRA data leakage.

Business state:

`APPROVED_TARGET_PENDING_TECHNICAL`

Never hardcode authority from username.

---

## 16. Outstanding business decisions — do not invent

Currently unresolved unless a newer explicit Business Owner decision is documented:

1. permanent Angkatan mapping for all 57 active santri;
2. teacher account modality: PERSONAL linked Staff vs UNIT + verified human executor;
3. badal/substitute teacher authorization matrix;
4. cohort gap/repeater/transfer policy;
5. new canonical Kepesantrenan assessment/grading;
6. Fikih reference;
7. Aqidah reference;
8. Keasramaan `approve_mk` / `approve_ks`;
9. Health external referral authority;
10. exact activation/promotion timing of target PositionCapabilities.

---

## 17. Production rollout roadmap from current checkpoint

Completed:

- Architecture/Foundation ✅
- M3.3A code ✅
- M3.3B code ✅
- M3.3C1 ✅
- M3.3C2A ✅
- M3.3C2A.1 (PR #8 migration ledger + Prisma schema parity reconciliation — PR #23) ✅

Current next step:

### Current next planned gate — REAL PRODUCTION BACKUP READINESS

Requirements remain:

- direct PostgreSQL wire-compatible connection
- `pg_dump`
- verified dump file
- SHA-256 checksum
- isolated restore verification

IMPORTANT:

- Do NOT execute the backup as part of this PR.
- Do NOT perform any production write.
- Do NOT start C2B.

Then, only after backup requirements and separate Business Owner authorization are satisfied:

### STEP 3 — M3.3C2B
Production M3.3A + M3.3B migration. (Currently: BLOCKED / NOT STARTED)

Then:

### STEP 4 — M3.3C2C
Controlled production provisioning:

- canonical subjects
- cohorts
- cohort assignment
- OrgUnits
- Positions
- Capabilities
- PositionCapabilities
- Staff linkages
- Assignments
- ScopeUnits
- teaching assignments
- OSDA Putri
- approved account provisioning

Then:

### STEP 5 — M3.3C2D
Activation of explicitly approved feature flags/policies.

Canonical global authorization cutover is not automatically included.

Then:

### STEP 6 — M3.3C2E
Live production UAT and final sign-off.

---

## 18. Gate before C2B

Gate verification status before C2B:

1. PR #8 migration-ledger/schema reconciliation independently audited
   = SATISFIED

2. Business Owner explicitly authorized reconciliation merge
   = SATISFIED

3. Reconciliation merged and post-merge verified
   = SATISFIED (PR #23 merged at commit checkpoint `5ba4060f841304a189fce622d39243864b7c453a`)

4. Production prisma migrate status
   = Last read-only reconciliation verification showed only:
     - `20260918120000_m3_3a_health_v2_backend`
     - `20260918140000_m3_3b_pendidikan_foundation`
     pending.
     *(Note: This is a point-in-time audit observation, not a permanent truth. Production migrate status must be re-verified from the merged main context before C2B execution.)*

5. Real production backup + SHA-256 + isolated restore
   = NOT SATISFIED / BLOCKED

6. Separate Business Owner authorization for C2B
   = NOT GRANTED

Therefore:

`C2B = BLOCKED`
