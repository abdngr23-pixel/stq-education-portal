# STQ EDUCATION PORTAL — MILESTONE 3: CHECKPOINT M3.3C1
## UAT ACTIVATION READINESS: FINAL POLICY RECONCILIATION & SERVER WIRING

**Document Version**: `1.0.0`  
**Milestone**: `M3.3C1` (UAT Activation Readiness)  
**Status**: `READY_FOR_M3_3C1_INDEPENDENT_AUDIT`  
**Working Branch**: `architecture/milestone3-3c1-uat-activation-readiness`  
**Base Commit (`main`)**: `9fbe99863b731c407fcc4fdce5cb1f4c93b9e117`  
**PR #8 Baseline**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (**100% Immutable & Untouched**)  

---

### 1. Milestone Demarcation: M3.3C1 vs M3.3C2

Milestone 3.3C is partitioned into two distinct phases to ensure institutional data safety and operational integrity:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 3.3C1 (CURRENT PR) — UAT ACTIVATION READINESS                 │
│ • Canonical business rule reconciliation (UAT #3, UAT #5, UAT #6)       │
│ • Server-side activation gates (PENDIDIKAN_V2_UAT_ENABLED)              │
│ • Server-side schema readiness check (PENDIDIKAN_V2_SCHEMA_NOT_READY)   │
│ • Request-boundary server actions with authoritative read DTO           │
│ • Fail-closed substitute teacher denial                                 │
│ • Declarative UAT activation target policy manifest                     │
│ • Isolated PostgreSQL simulation proofs                                 │
│ • ZERO production migrations, ZERO production account writes            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (Requires explicit Business Owner authorization)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MILESTONE 3.3C2 (DEFERRED) — PRODUCTION PROVISIONING & LIVE UAT         │
│ • Production database migration execution (M3.3A, M3.3B)                │
│ • Production teacher account provisioning (Personal vs Shared)          │
│ • Live UAT walkthroughs on production infrastructure                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Context Consolidation: Architecture State Matrix

#### 2.1 Implemented & Locked (M3.3A & M3.3B)
- **Health V2 Backend Foundation**: Additive schema, biometric metrics, clinic visits, medicine inventory, atomic audits, and multi-tenant isolation.
- **Pendidikan Foundation**: Additive schema (`education_sessions`, `education_session_participants`, `education_session_attendances`), 6 canonical Studi Umum subjects, 5 Kepesantrenan subjects.
- **Studi Umum Saturday JP Matrix & PBL 20-Week Rotation**: Canonical derivation of theory vs project weeks without manual tampering.
- **Kepesantrenan Daily Schedule**: Monday–Friday 18:30–19:30 WITA schedule windows with Arabic 3-tier pedagogical level facts.
- **Session Lifecycle & CAS Concurrency**: Atomic transition `SCHEDULED -> STARTED` using Compare-And-Swap to eliminate race conditions.
- **Participant Roster Verification**: Trust boundary enforcement requiring santri to be officially enrolled in session participants before attendance mutations.
- **Forensic Audit Logging**: Single transaction rollback on audit sink failure; before/after diff tracking for materials and attendance.
- **Tahfizh Operational Safety**: Backdated Tahfizh entries permitted with audit trail; zero MASBUK status in Halaqoh attendance; Tahajjud limited to `SHOLAT` and `ALFA`.

#### 2.2 Approved Target Pending Technical (Declarative Manifest)
- **UAT #1: Operational Keasramaan (`PETUGAS_OPERASIONAL_KEASRAMAAN`)**: Scoped read and create permissions for `ASSIGNED_UNITS`. No approval capabilities (`approve_mk` / `approve_ks`).
- **UAT #2: Tahfizh Recap Operational Read**: `tahfizh.recap.read` scoped to `GLOBAL`. Does not widen setoran mutations or reward issuance.
- **UAT #4: Target Management (`MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`)**: `tahfizh.target.manage` scoped to `HALAQOH` (own assigned halaqoh only). Cross-halaqoh modifications denied.
- **UAT #10: OSDA Putri Account Contract (`OU-OSDA-PUTRI`)**: `accountType: UNIT`, `genderComplex: PUTRI`, single active placement, human executor verification required, zero PUTRA data leakage.
- **UAT #11: Special Operational Reward Issuance**: `tahfizh.reward.issue` scoped strictly to `ASSIGNED_UNITS`. Never GLOBAL reward issuance for operational roles.
- **UAT #12: Scoped Cross-Functional Access**: Orthogonal capability assignment without "superuser" roles or identity-based bypasses.

#### 2.3 Formally Deferred Scope
- **Kepesantrenan Assessment / Grading**: Formal evaluation format, components, KKM thresholds, score weighting, and letter conversions remain intentionally unapproved. Active UI displays honest disabled notice.
- **Substitute / Badal Teacher Policy**: Business Owner has not authorized which teacher may substitute for another. Any non-scheduled teacher start fails closed with `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`.
- **Academic Unit Containment**: Prisma schema models currently lack explicit relations between `EducationSession` / `EducationTeachingAssignment` and `OrgUnit`. Academic unit containment remains fail-closed (`orgUnitIds: []`).
- **Teacher Account Provisioning**: Creation of personal or shared teacher accounts (`guru.matematika`, etc.) is deferred to M3.3C2.
- **Production Canonical Cutover**: Legacy authorization and ABAC compatibility paths remain active. Canonical engine is NOT cut over globally in production.

---

### 3. Business Rule Reconciliations

#### 3.1 UAT #3: Student Search Result Display Contract (Nama Only)
- **Previous Stale Contract**: Displayed `Nama • Kelas` in search result dropdowns.
- **Latest Business Owner Decision (Superseding)**: Search result display must show **NAMA ONLY** (`displayText: santri.nama`).
- **Independent Filtering**: Kelas and Halaqoh/Kelompok are independent filter controls and must NOT clutter the search result card with dense metadata (NIS, class, halaqoh, score).
- **Implementation**: Updated `formatSantriSearchResult(santri)`:
  ```typescript
  export function formatSantriSearchResult(santri: { nama: string; kelas?: string }): {
    nama: string;
    displayText: string;
    kelas?: string;
  } {
    return {
      nama: santri.nama,
      displayText: santri.nama,
      kelas: santri.kelas,
    };
  }
  ```

#### 3.2 UAT #5: Studi Umum Canonical Subjects
- **Previous Stale Contract**: Early M3.2 draft documents referenced 3 general subjects.
- **Canonical Decision**: Canonical Studi Umum subjects are **exactly 6**:
  1. *Matematika* (`MP-SU-01`)
  2. *Bahasa Inggris* (`MP-SU-02`)
  3. *IPS* (`MP-SU-03`)
  4. *IPA* (`MP-SU-04`)
  5. *Bahasa Indonesia* (`MP-SU-05`)
  6. *TIK* (`MP-SU-06`)
- Canonical Kepesantrenan subjects are **exactly 5**: *Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid*.

#### 3.3 UAT #6: Kepesantrenan Attendance & Teacher Attendance Evidence
- **Previous Stale Contract**: Status vocabulary listed as `TBD / M3.3 BUSINESS DECISION`.
- **Canonical Decision**:
  - Student attendance statuses: `HADIR`, `IZIN`, `SAKIT`, `ALFA` (Strictly **NO MASBUK**).
  - Teacher attendance: Not a separate manual status. Evidenced authoritatively when an authenticated teacher successfully executes **"MULAI PEMBELAJARAN"**.
  - Persists: `scheduledStaffId`, `actualTeacherUserId`, `actualTeacherStaffId`, `startedAt`.

---

### 4. Server-Side Activation & Schema Readiness Gates

#### 4.1 Server Feature Flag Gate (`PENDIDIKAN_V2_UAT_ENABLED`)
- Evaluated on the server before processing any session mutation. Default is `false`.
- When `false`, mutation endpoints immediately throw / return:
  `PENDIDIKAN_V2_UAT_NOT_ENABLED: Fitur aktivasi UAT Pendidikan V2 belum diaktifkan di tingkat server`
- Client feature hiding is NOT relied upon for authorization.
- Feature flag alone never grants authority; requests still require canonical capabilities, active staff linkage, roster membership, and valid session state.

#### 4.2 Server Schema Readiness Gate (`PENDIDIKAN_V2_SCHEMA_NOT_READY`)
- Prior to executing operations, queries the database catalog to verify existence of required M3.3B tables:
  `education_sessions`, `education_session_participants`, `education_session_attendances`.
- If tables do not exist in the database (as in production prior to M3.3C2), returns:
  `PENDIDIKAN_V2_SCHEMA_NOT_READY: Tabel schema Pendidikan V2 belum tersedia di database`
- Never converts missing tables or schema errors into fake empty arrays (`[]`), zero counts, or false "healthy" statuses.

#### 4.3 Substitute Teacher Fail-Closed Guard
- When `startEducationSession` is invoked, compares authenticated `staffId` with `currentSession.scheduledStaffId`.
- If `scheduledStaffId` exists and does not match the authenticated staff member:
  `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED: Kebijakan guru pengganti (badal) belum disahkan. Sesi hanya dapat dimulai oleh guru terjadwal resmi.`
- Preserves `scheduledStaffId` immutably.

---

### 5. Production Readiness Diagnostic Framework (`M3_3C_PRODUCTION_READINESS`)

A non-writing, read-only diagnostic engine (`checkPendidikanV2ProductionReadiness`) evaluates 11 critical readiness gates:
1. `M3_3A_SCHEMA_APPLIED`: `health_biometrics`, `health_clinic_visits`, `health_medicine_inventory` exist.
2. `M3_3B_SCHEMA_APPLIED`: `education_sessions`, `education_session_participants`, `education_session_attendances` exist.
3. `CANONICAL_AUDIT_TABLE_READY`: `canonical_audit_logs` exists.
4. `STAFF_LINKAGE_READY`: Operational personal accounts have active linked `Staff` records. Accounts lacking linkage (such as `razan.mt`) are reported as `BLOCKED_IDENTITY_LINKAGE`.
5. `REQUIRED_ORG_UNITS_EXIST`: Required organizational units exist.
6. `POSITION_TEMPLATES_EXIST`: Required Position records exist.
7. `CAPABILITIES_REGISTERED`: All 12 academic capabilities registered.
8. `USER_ASSIGNMENTS_EXIST`: Active teaching/operational assignments exist.
9. `TEACHING_ASSIGNMENTS_EXIST`: `education_teaching_assignments` populated.
10. `COHORTS_ASSIGNED`: Santri have explicit `cohort_id` assigned (never backfilled from class names).
11. `FEATURE_FLAG_ENABLED`: `PENDIDIKAN_V2_UAT_ENABLED` is configured as `true`.

---

### 6. Safety Commitments & Production Invariants
- **Production Migrations Executed**: `0`
- **Production Seeds / Backfills**: `0`
- **Production User / Account Writes**: `0`
- **Canonical Authorization Cutover**: `NO`
- **PR #8 Immutability**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (**Untouched**)
- **PR**: Created as **DRAFT**, unmerged, awaiting independent audit review.
