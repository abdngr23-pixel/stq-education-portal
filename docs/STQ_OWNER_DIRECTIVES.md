# STQ EDUCATION PORTAL — BUSINESS OWNER DIRECTIVES REGISTRY

**Document Path:** `docs/STQ_OWNER_DIRECTIVES.md`  
**Purpose:** Canonical Persistent Business Owner Directive Registry  
**Authority Level:** Level 0 — Newest Explicit Business Owner Decisions (per `STQ_PROJECT_CONTEXT.md`)  
**Status:** ACTIVE CANONICAL REGISTRY  
**Last Updated:** 2026-09-19  

---

## 1. Registry Purpose & Fundamental Governance Rules

This document serves as the sole persistent repository registry for authoritative Business Owner decisions and directives. 

### Mandatory Governance Rules

1. **Conversational Memory Is NOT a Source of Truth**:
   The conversational memory of coding agents, AI assistants (ChatGPT, Antigravity, Claude, etc.), human chat threads, or ephemeral issue comments does NOT constitute project source of truth. All binding business requirements, rule adjustments, account identities, authorities, scopes, workflows, and acceptance criteria must be committed into this registry.

2. **Immediate Registration Requirement**:
   Every new decision or clarification by the Business Owner that modifies a requirement, business rule, account identity, authority, scope, workflow, or acceptance criteria must be formally recorded in this file within the **same workstream** prior to implementation.

3. **Supersedence Rule**:
   A newer explicit decision from the Business Owner overrides an older decision. Older decisions are **never deleted**; instead, they are preserved with their historical context and explicitly marked with status `SUPERSEDED` and linked via `superseded-by`.

4. **Required Directive Attributes**:
   Every directive entry in this registry MUST contain all of the following ten attributes:
   - **Directive ID**: Unique, permanent identifier (e.g. `DIR-2026-001`).
   - **Tanggal**: Date of the directive (YYYY-MM-DD).
   - **Keputusan Business Owner**: Exact, verbatim or faithful formulation of the Business Owner's decision.
   - **Canonical Interpretation**: Clear, unambiguous technical and institutional interpretation.
   - **Affected Domain**: Impacted operational and system domains (e.g., IDENTITY, TAHFIZH, PENDIDIKAN, KEASRAMAAN, AUDIT).
   - **Implementation Status**: Current codebase implementation state following the mandatory lifecycle progression.
   - **Production Status**: Current state of the live production environment.
   - **Supersedes / Superseded-By**: Explicit cross-references to prior or subsequent directives.
   - **Acceptance Criteria**: Verifiable criteria required to satisfy the directive.
   - **Evidence / Reference**: Concrete file paths, tests, schemas, or documentation references.

5. **Mandatory Implementation Lifecycle Progression**:
   The status of an implementation progresses through these minimal stages:
   $$\text{REQUIRED} \longrightarrow \text{CODE\_COMPLETE} \longrightarrow \text{BACKEND\_AUTHORIZED} \longrightarrow \text{UI\_COMPLETE} \longrightarrow \text{PRODUCTION\_VERIFIED}$$
   - `REQUIRED`: Directive registered; awaiting or undergoing implementation.
   - `CODE_COMPLETE`: Supporting domain logic, schemas, or types exist in codebase.
   - `BACKEND_AUTHORIZED`: Server-side authorization, guards, and backend enforcement are active and verified by tests.
   - `UI_COMPLETE`: User interfaces and client interactions reflect the directive.
   - `PRODUCTION_VERIFIED`: Live production data, migrations, and runtime behavior are independently verified.

6. **Completion Rule**:
   A directive must **NEVER** be declared `COMPLETE` or `PRODUCTION_VERIFIED` merely because code, schemas, or PRs are merged. Production verification requires live deployment, data seeding/migration, and independent confirmation.

7. **Production Read-Only Default**:
   Production default is strictly **READ ONLY**. This documentation registry authorizes zero production mutations, writes, migrations, seeds, or account provisioning.

8. **Strict Ban on Personal Identity in Authorization**:
   Usernames, employee names, emails, or personal display labels must **NEVER** serve as authorization keys. Operational authorities are modeled strictly through generic Positions, Capabilities, and Scope assignments.

---

## 2. Active Business Owner Directives Registry

### DIR-2026-001 | Canonical Target Username for Ustadzah Lisa Dwina Fitri
- **Directive ID:** `DIR-2026-001`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Canonical target username Ustadzah Lisa Dwina Fitri = exact `musyirfah.putri`.
- **Canonical Interpretation:** The authoritative production target username for Ustadzah Lisa Dwina Fitri is standardized to the exact spelling `musyirfah.putri` (with `-ir-`, not `-ri-`). This username represents an identity label and must never be used as an authorization key.
- **Affected Domain:** IDENTITY / AUTH
- **Implementation Status:** `CODE_COMPLETE` (Target username specified in canonical documentation and release manifests; code models authority via generic positions)
- **Production Status:** `NOT_EXECUTED` (Live production environment currently retains `lisa.mt`)
- **Supersedes / Superseded-By:** Supersedes informal references to `lisa.putri`; distinct from legacy placeholder `musyrifah.putri`
- **Acceptance Criteria:** Target production user record for Ustadzah Lisa Dwina Fitri is named `musyirfah.putri` without duplicate identity creation.
- **Evidence / Reference:** `docs/STQ_CURRENT_STATE.md`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-STF-02.

---

### DIR-2026-002 | Deprecation of Legacy Username `lisa.mt`
- **Directive ID:** `DIR-2026-002`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `lisa.mt` = legacy/deprecated rename source.
- **Canonical Interpretation:** The username `lisa.mt` is classified as a legacy origin account destined for renaming to `musyirfah.putri`. It must not be treated as a permanent target identity or referenced in new feature contracts.
- **Affected Domain:** IDENTITY / MIGRATION
- **Implementation Status:** `CODE_COMPLETE` (Classified as legacy origin in release manifests and test documentation)
- **Production Status:** `NOT_EXECUTED` (Live production still uses `lisa.mt`)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** `lisa.mt` is exclusively used as migration source data; all new capabilities and tests bind to generic roles/positions.
- **Evidence / Reference:** `types/auth.ts:449`, `prisma/seed.ts:490`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-01.

---

### DIR-2026-003 | Independent Verification of `musyrifah.putri` Dependency
- **Directive ID:** `DIR-2026-003`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Existing similar reference `musyrifah.putri` harus diverifikasi sebagai identity/dependency terpisah; jangan diasumsikan sama.
- **Canonical Interpretation:** The pre-existing username `musyrifah.putri` (spelled with `-ri-`) present in historical seed/preflight records is an independent identity/dependency. It must be audited separately and never conflated or assumed identical to the rename target `musyirfah.putri`.
- **Affected Domain:** IDENTITY / PREFLIGHT AUDIT
- **Implementation Status:** `REQUIRED` (Audit item REL-STF-02 registered in release manifest; preflight execution pending C2C)
- **Production Status:** `UNVERIFIED_PENDING_AUDIT` (Present in production without Staff linkage; modality must be audited before C2C execution)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Preflight audit script executes against production DB, verifying account modality and preventing accidental overwrite or collision with `musyirfah.putri`.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-STF-02, `docs/STQ_M3_RELEASE_DEPENDENCIES.md:160`, `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md:202`.

---

### DIR-2026-004 | Production Rename Status Acknowledgment
- **Directive ID:** `DIR-2026-004`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Rename production belum dilakukan.
- **Canonical Interpretation:** The production database has NOT executed the account rename from `lisa.mt` to `musyirfah.putri`. No system component, test, or documentation may state or assume that production has completed this rename.
- **Affected Domain:** DATABASE / PRODUCTION / RELEASE
- **Implementation Status:** `REQUIRED` (Release control plane tracks this as a pending operational mutation under Gate C2C)
- **Production Status:** `NOT_EXECUTED`
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Documentation and release manifests truthfully reflect `lisa.mt` as the live production account until Gate C2C execution.
- **Evidence / Reference:** `docs/STQ_CURRENT_STATE.md`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-01.

---

### DIR-2026-005 | Preservation of Staff Linkage and Zero Duplicate Lisa Identity
- **Directive ID:** `DIR-2026-005`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Preserve Staff linkage, history, sessions/audit relationships according to controlled migration; jangan membuat duplicate Lisa identity.
- **Canonical Interpretation:** The rename of `lisa.mt` to `musyirfah.putri` must be performed as an in-place transactional update on the existing `User` record (`staffId` linking to `STF-005`). No duplicate User or Staff records may be inserted. Historical records, setoran logs, and audit logs must remain attached to the same primary key ID.
- **Affected Domain:** IDENTITY / DATA INTEGRITY
- **Implementation Status:** `REQUIRED` (Transactional update procedure specified in release manifest REL-ACC-01)
- **Production Status:** `PENDING_C2C`
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Post-migration audit proves exactly one User record for Ustadzah Lisa Dwina Fitri exists, retaining `staffId: STF-005` and preserving all foreign key references.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-STF-02, REL-ACC-01, `prisma/seed.ts:490`.

---

### DIR-2026-006 | Institutional Tahfizh Recap Read for `musyirfah.putri`
- **Directive ID:** `DIR-2026-006`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `musyirfah.putri` harus dapat melihat rekap Tahfizh seluruh santri.
- **Canonical Interpretation:** The operational role assigned to `musyirfah.putri` (`PETUGAS_OPERASIONAL_TAHFIZH`) is granted `tahfizh.recap.read` capability with scope `GLOBAL`, allowing institutional recap reads across all santri. This read breadth is orthogonal to mutations; setoran creation remains strictly scoped to assigned halaqoh.
- **Affected Domain:** TAHFIZH / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Implemented in `types/architecture-lock.ts:599` and verified in `tests/milestone3-2-uat-business-rules.test.ts` Sec 2.1 & 10.3)
- **Production Status:** `NOT_LIVE` (PositionCapability table unseeded in live production; pending C2B/C2C)
- **Supersedes / Superseded-By:** Supersedes halaqoh-only recap read restrictions for operational putri role
- **Acceptance Criteria:** `musyirfah.putri` session can read recap data across all santri; setoran mutation attempts outside assigned halaqoh fail closed.
- **Evidence / Reference:** `types/architecture-lock.ts:599`, `tests/milestone3-2-uat-business-rules.test.ts:425`, `docs/STQ_M3_RELEASE_TRACEABILITY.md` TR-TAHF-01.

---

### DIR-2026-007 | Santri Picker Display Format (Nama + Kelas Only)
- **Directive ID:** `DIR-2026-007`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Hasil pilihan/pencarian santri cukup Nama + Kelas; jangan NIS/halaqoh di display result kecuali screen lain memang membutuhkan.
- **Canonical Interpretation:** In the Tahfizh santri picker and search dropdowns, each item display must show only `Nama` and `Kelas` (e.g. "Habiba Asri • Kelas 7B"). NIS and halaqoh name must not be appended to general search results unless a specific administrative view explicitly requires them.
- **Affected Domain:** UI / TAHFIZH
- **Implementation Status:** `REQUIRED` (Currently partial in code: `components/dashboard/dashboard-musyrif-tahfizh.tsx` lines 783 & 978 still display `({santri.nis})`)
- **Production Status:** `NOT_LIVE`
- **Supersedes / Superseded-By:** Supersedes modal search result layouts appending `({santri.nis})`
- **Acceptance Criteria:** Search dropdown and list items render `santri.nama` and `santri.kelas` only; `({santri.nis})` is omitted from general search list.
- **Evidence / Reference:** `components/dashboard/dashboard-musyrif-tahfizh.tsx:783,978`.

---

### DIR-2026-008 | Target Update Authority Restricted to Assigned Scope
- **Directive ID:** `DIR-2026-008`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** MT dan PH dapat update target hanya untuk santri dalam scope/halaqoh yang menjadi tanggung jawabnya.
- **Canonical Interpretation:** Musyrif Tahfizh (MT) and Pembina Halaqoh (PH) hold `tahfizh.target.manage` authority scoped strictly to `HALAQOH`. Target modifications for santri outside the caller's assigned halaqoh are denied by backend authorization.
- **Affected Domain:** TAHFIZH / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Defined in `types/architecture-lock.ts:600` and enforced in `tests/milestone3-2-uat-business-rules.test.ts` Sec 3.1 & 10.2)
- **Production Status:** `NOT_LIVE` (PositionCapability and assignments not yet populated in live production)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Server action `updateTargetHalaqoh` permits update for santri in caller's assigned halaqoh; rejects cross-halaqoh target updates with 403 FORBIDDEN.
- **Evidence / Reference:** `types/architecture-lock.ts:600`, `tests/milestone3-2-uat-business-rules.test.ts` (Section 3.1 & 10.2).

---

### DIR-2026-009 | Distinct Dual Tracks (Studi Umum & Kepesantrenan)
- **Directive ID:** `DIR-2026-009`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Studi Umum dan Kepesantrenan adalah dua track berbeda.
- **Canonical Interpretation:** Formal academic education is structured into two distinct tracks: `STUDI_UMUM` and `KEPESANTREAN`. They operate with separate subject catalogs, curricula, schedule structures, and tracking logic under the `EducationTrack` domain enum.
- **Affected Domain:** PENDIDIKAN / ARCHITECTURE
- **Implementation Status:** `CODE_COMPLETE` (Enum `EducationTrack` added in Prisma schema and `types/architecture-lock.ts:503`; service layer tested in `tests/pendidikan-v2-service.test.ts`)
- **Production Status:** `NOT_LIVE` (Prisma migration `20260918000000_add_pendidikan_v2_foundation` pending deployment at Gate C2B)
- **Supersedes / Superseded-By:** Supersedes unified single-track academic assumptions
- **Acceptance Criteria:** System maintains clear boundary between `STUDI_UMUM` and `KEPESANTREAN` tracks in database and services.
- **Evidence / Reference:** `prisma/schema.prisma:EducationTrack`, `types/architecture-lock.ts:503`, `lib/server/pendidikan-v2-service.ts`.

---

### DIR-2026-010 | Kepesantrenan Teacher Session Start & Student Attendance
- **Directive ID:** `DIR-2026-010`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Kepesantrenan memiliki teacher attendance melalui authenticated Mulai Pembelajaran dan student attendance HADIR/IZIN/SAKIT/ALFA.
- **Canonical Interpretation:** In the `KEPESANTREAN` track, teacher attendance is verified and recorded when the assigned teacher triggers the authenticated "Mulai Pembelajaran" action (`startEducationSession`). Student attendance is recorded under that active session, restricted strictly to `HADIR`, `IZIN`, `SAKIT`, and `ALFA`.
- **Affected Domain:** PENDIDIKAN / PRESENSI
- **Implementation Status:** `CODE_COMPLETE` (Implemented in `PendidikanV2Service` methods `startEducationSession` and `recordEducationAttendance`, verified in `tests/pendidikan-v2-service.test.ts`)
- **Production Status:** `NOT_LIVE` (Feature flag `NEXT_PUBLIC_ENABLE_PENDIDIKAN_V2` inactive; schema pending C2B)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Unauthenticated or unauthorized teacher cannot initiate session; teacher timestamp logged at start; student attendance rejects any status outside `HADIR`, `IZIN`, `SAKIT`, `ALFA`.
- **Evidence / Reference:** `lib/server/pendidikan-v2-service.ts:316,368`, `tests/pendidikan-v2-service.test.ts`.

---

### DIR-2026-011 | Halaqoh Attendance Forbids MASBUK
- **Directive ID:** `DIR-2026-011`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Absensi halaqoh tidak memiliki MASBUK.
- **Canonical Interpretation:** Halaqoh attendance supports statuses `HADIR`, `IZIN`, `SAKIT`, and `ALFA`. The status `MASBUK` (late arrival) is strictly prohibited for new halaqoh attendance records and must fail validation.
- **Affected Domain:** TAHFIZH / PRESENSI
- **Implementation Status:** `CODE_COMPLETE` (Enforced in `tests/presensi.test.ts:122-137` with `FORBIDDEN_STATUSES: ["MASBUK"]`)
- **Production Status:** `NOT_LIVE` (Pending production runtime rollout and verification)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Halaqoh attendance submission rejects `MASBUK` with 400 Bad Request; form options do not render `MASBUK`.
- **Evidence / Reference:** `tests/presensi.test.ts:122-137`, `prisma/schema.prisma:PresensiStatus`.

---

### DIR-2026-012 | Tahajjud Attendance Restricted to SHOLAT and ALFA
- **Directive ID:** `DIR-2026-012`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Tahajjud hanya SHOLAT dan ALFA.
- **Canonical Interpretation:** Daily night prayer (Tahajjud) attendance entries allow exactly two valid statuses: `SHOLAT` and `ALFA`. Statuses `HADIR`, `IZIN`, `SAKIT`, and `MASBUK` are invalid for Tahajjud recordings.
- **Affected Domain:** KEASRAMAAN / IBADAH
- **Implementation Status:** `CODE_COMPLETE` (Enforced in `tests/presensi.test.ts:105-121` with `TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS: ["SHOLAT", "ALFA"]`)
- **Production Status:** `NOT_LIVE` (Pending production migration and deployment)
- **Supersedes / Superseded-By:** Supersedes multi-status attendance options for Tahajjud
- **Acceptance Criteria:** Tahajjud entry form and server validation reject all values other than `SHOLAT` and `ALFA`.
- **Evidence / Reference:** `tests/presensi.test.ts:105-121`.

---

### DIR-2026-013 | Operational Perizinan Putri Read/Create Authority
- **Directive ID:** `DIR-2026-013`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `musyirfah.putri` mendapatkan read/create perizinan sesuai scope PUTRI; approval authority tidak otomatis diberikan.
- **Canonical Interpretation:** Operational account `musyirfah.putri` receives `keasramaan.permission.read` and `keasramaan.permission.create` capabilities scoped to `ASSIGNED_UNITS` / `UNIT` (PUTRI). Approval authority (`keasramaan.permission.approve`, `approve_mk`, `approve_ks`) is NOT granted and remains unresolved/quarantined.
- **Affected Domain:** KEASRAMAAN / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Defined in `types/architecture-lock.ts:601-602` and verified in `tests/milestone3-2-uat-business-rules.test.ts` Sec 1)
- **Production Status:** `NOT_LIVE` (Capabilities pending seeding in live production at C2B/C2C)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** `musyirfah.putri` can view and create permissions for santriwati; cannot approve tickets; approval mutations return 403 FORBIDDEN.
- **Evidence / Reference:** `types/architecture-lock.ts:601-602`, `tests/milestone3-2-uat-business-rules.test.ts` (Section 1), `docs/STQ_MILESTONE3_2_UAT_BUSINESS_RULES.md:33`.

---

### DIR-2026-014 | Controlled Provisioning for Santriwati Accounts
- **Directive ID:** `DIR-2026-014`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Akun santriwati harus diprovisioning secara controlled, bukan seed production.
- **Canonical Interpretation:** Accounts for santriwati (female students) must be created through an authoritative, controlled provisioning procedure with credential hashing and preflight verification, rather than running development `seed.ts` against production.
- **Affected Domain:** PROVISIONING / SECURITY
- **Implementation Status:** `REQUIRED` (Governed by Gate C2C and REL-ACC-03 in Release Manifest)
- **Production Status:** `NOT_LIVE` (Production database contains zero seeded santriwati user accounts)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Production provisioning runbook executes controlled batch script; raw `prisma db seed` is never run in production.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-03, `docs/STQ_M3_RELEASE_DEPENDENCIES.md`.

---

### DIR-2026-015 | Tasmi' and Sima'an Reward Issuance Authority
- **Directive ID:** `DIR-2026-015`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Penerbit reward Tasmi'/Sima'an target authority = Mudir + Kabid Tahfizh + `musyirfah.putri` sesuai canonical capability/scope.
- **Canonical Interpretation:** Issuance of Tasmi' and Sima'an achievement rewards (`tahfizh.reward.issue`) is authorized only for `MUDIR` (`GLOBAL`), `KABID_TAHFIZH` (`DOMAIN`), and `musyirfah.putri` via `PETUGAS_OPERASIONAL_TAHFIZH` (`ASSIGNED_UNITS` / PUTRI). Standard halaqoh teachers do not possess reward issuance authority.
- **Affected Domain:** TAHFIZH / REWARD / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Canonical authorization contract verified in `tests/milestone3-2-uat-business-rules.test.ts:483`)
- **Production Status:** `NOT_LIVE` (Pending capability seeding at C2B/C2C)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Reward issuance allowed for Mudir, Kabid Tahfizh, and operational putri role; rejected for unassigned musyrif.
- **Evidence / Reference:** `types/architecture-lock.ts:598`, `tests/milestone3-2-uat-business-rules.test.ts:483`, `docs/STQ_M3_RELEASE_TRACEABILITY.md` TR-TAHF-02.

---

### DIR-2026-016 | Operational Scope Partitioning (No Leakage to PUTRA)
- **Directive ID:** `DIR-2026-016`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `musyirfah.putri` mendapatkan akses operasional Pendidikan + Keasramaan + fungsi OSDA PUTRI sesuai scope PUTRI; tidak boleh bocor ke PUTRA.
- **Canonical Interpretation:** Operational capabilities granted to `musyirfah.putri` encompass Pendidikan, Keasramaan, and OSDA PUTRI functional desk, strictly scoped to unit `PUTRI`. Any data access or mutation affecting `PUTRA` units or male students is prevented by ABAC/scope evaluation.
- **Affected Domain:** CROSS-DOMAIN / AUTHORIZATION / SCOPE
- **Implementation Status:** `CODE_COMPLETE` (Scope resolution verifies unit assignment; cross-gender data is filtered out)
- **Production Status:** `NOT_LIVE` (Pending C2B/C2C assignment activation)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Queries and mutations for `musyirfah.putri` allow access to PUTRI units and santriwati; strictly deny access to PUTRA halaqoh, kamar, and santri.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-CAP-08, `docs/STQ_ARCHITECTURE_LOCK.md:144`.

---

### DIR-2026-017 | Setoran Date Validation (Past Allowed, Future Denied)
- **Directive ID:** `DIR-2026-017`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Setoran Tahfizh SABAQ/SABQI/MANZIL/MUFAR dapat memilih tanggal lampau; masa depan ditolak.
- **Canonical Interpretation:** Memorization entries (Sabaq, Sabqi, Manzil, Mufar) allow historical/backdated date selection with WITA timezone handling and audit trail. Dates in the future relative to today WITA are strictly rejected before database write. The immutable `createdAt` timestamp is always preserved.
- **Affected Domain:** TAHFIZH / VALIDATION
- **Implementation Status:** `CODE_COMPLETE` (Implemented in `lib/tahfizh-persistence.ts` and `app/actions/tahfizh-actions.ts`, verified in `tests/milestone3-2-uat-business-rules.test.ts` Sec 11)
- **Production Status:** `NOT_LIVE` (Awaiting production deployment and verification)
- **Supersedes / Superseded-By:** Supersedes date restrictions that prevented past date entry
- **Acceptance Criteria:** Submitting setoran with valid past date succeeds; submitting setoran with date > today WITA fails with validation message "masa depan".
- **Evidence / Reference:** `tests/milestone3-2-uat-business-rules.test.ts:997-1021`, `docs/STQ_M3_RELEASE_TRACEABILITY.md` TR-OPER-02.

---

### DIR-2026-018 | Preservation and Soft Deactivation of Abdullah Khairun Nizham
- **Directive ID:** `DIR-2026-018`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Abdullah Khairun Nizham = OUT dari STQ; tidak masuk roster aktif September; histori tidak boleh hard-delete.
- **Canonical Interpretation:** Santri Abdullah Khairun Nizham (NIS: `SAN-0041`, formerly Halaqoh Ust. Alwan) has departed STQ. He must be excluded from active September 2026 rosters. His historical academic, tahfizh, and attendance records must NEVER be hard-deleted from the database.
- **Affected Domain:** SANTRI / ROSTER / AUDIT
- **Implementation Status:** `REQUIRED` (Documented in registry; database deactivation migration scheduled for Gate C2C)
- **Production Status:** `NOT_EXECUTED` (Present in production database; status update pending C2C)
- **Supersedes / Superseded-By:** Supersedes inclusion of Abdullah in active student roster counts
- **Acceptance Criteria:** Active roster queries exclude Abdullah Khairun Nizham; historical setoran and presensi records remain intact in database.
- **Evidence / Reference:** `prisma/seed.ts:288`, `tests/business-rules.test.ts:226`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-HLQ-01.

---

### DIR-2026-019 | Authoritative September 2026 Headcount (56 Active Santri)
- **Directive ID:** `DIR-2026-019`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Roster September 2026 = 56 santri aktif setelah Abdullah OUT.
- **Canonical Interpretation:** The authoritative active student headcount for September 2026 is exactly 56 santri (46 Putra + 10 Putri), reflecting the departure of Abdullah Khairun Nizham. All active halaqoh and academic rosters must reconcile to this count.
- **Affected Domain:** SANTRI / ROSTER / RECONCILIATION
- **Implementation Status:** `REQUIRED` (Target established in manifest REL-HLQ-01; live database reconciliation scheduled at Gate C2C)
- **Production Status:** `NOT_LIVE` (Live production active count audit scheduled during C2C preflight)
- **Supersedes / Superseded-By:** Supersedes historical 57-santri active headcount baseline
- **Acceptance Criteria:** September 2026 active roster queries return exactly 56 santri; halaqoh distributions total 56 active students.
- **Evidence / Reference:** `tests/business-rules.test.ts:226-245`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-HLQ-01.

---

## 3. 12-Point Owner Acceptance Matrix

This matrix evaluates Points 2 through 13 of the Business Owner directives, stating current code and current production statuses truthfully and without false inflation.

| Point | Subject / Directive | Current Code Status | Current Production Status | Canonical Technical Reality & Gap Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **P02** | `lisa.mt` = legacy/deprecated rename source | `REFERENCED / DEPRECATED` | `NOT_EXECUTED` | Referenced as legacy origin account in `types/auth.ts`, `prisma/seed.ts`, and test fixtures. Production database still has `lisa.mt` active; rename to `musyirfah.putri` not yet performed. |
| **P03** | `musyrifah.putri` verified as separate identity | `AUDITED / SPECIFIED` | `UNVERIFIED_PENDING_AUDIT` | Documented as separate dependency in release manifest REL-STF-02. Production has unlinked `musyrifah.putri` account whose modality must be audited before C2C execution. |
| **P04** | Rename production not yet performed | `SPECIFIED` | `NOT_EXECUTED` | Release manifest and current state docs track rename as pending operational task. Zero production rename writes executed. |
| **P05** | Preserve Staff linkage, history, zero duplicate Lisa | `SPECIFIED / PLANNED` | `PENDING_C2C` | Specified in release manifest REL-STF-02 and REL-ACC-01. Execution requires transactional migration script preserving `staffId: STF-005` without creating duplicate records. |
| **P06** | `musyirfah.putri` reads Tahfizh recap for all santri | `CODE_COMPLETE` | `NOT_LIVE` | `tahfizh.recap.read` scope `GLOBAL` implemented and unit-tested (`tests/milestone3-2-uat-business-rules.test.ts` Sec 2.1). Live production database lacks `PositionCapability` seeding; pending C2B/C2C. |
| **P07** | Santri search result: Nama + Kelas only | `PARTIAL / NOT_LIVE` | `NOT_LIVE` | Code currently displays `({santri.nis})` in `components/dashboard/dashboard-musyrif-tahfizh.tsx:783,978`. UI cleanup required to remove NIS from search item display. Production runs legacy UI. |
| **P08** | MT & PH update target in assigned halaqoh only | `CODE_COMPLETE` | `NOT_LIVE` | `tahfizh.target.manage` scope `HALAQOH` defined and tested (`tests/milestone3-2-uat-business-rules.test.ts` Sec 3.1). Live production lacks capability table and assignments; pending C2B/C2C. |
| **P09** | Studi Umum & Kepesantrenan two distinct tracks | `CODE_COMPLETE` | `NOT_LIVE` | `EducationTrack` enum (`STUDI_UMUM`, `KEPESANTREAN`) implemented in schema and tested in services. Prisma migration `20260918000000_add_pendidikan_v2_foundation` pending production deployment at Gate C2B. |
| **P10** | Kepesantrenan teacher session start + HADIR/IZIN/SAKIT/ALFA | `CODE_COMPLETE` | `NOT_LIVE` | Implemented in `PendidikanV2Service` methods `startEducationSession` and `recordEducationAttendance` with tests. Production schema not applied; feature flag `NEXT_PUBLIC_ENABLE_PENDIDIKAN_V2` disabled. |
| **P11** | Absensi halaqoh forbids MASBUK | `CODE_COMPLETE` | `NOT_LIVE` | `FORBIDDEN_STATUSES: ["MASBUK"]` enforced in `tests/presensi.test.ts:122-137`. Production runtime and data migration pending rollout. |
| **P12** | Tahajjud attendance restricted to SHOLAT & ALFA | `CODE_COMPLETE` | `NOT_LIVE` | `TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS: ["SHOLAT", "ALFA"]` enforced in `tests/presensi.test.ts:105-121`. Production runtime pending rollout. |
| **P13** | `musyirfah.putri` perizinan PUTRI read/create only | `CODE_COMPLETE` | `NOT_LIVE` | `keasramaan.permission.read` and `create` scoped to PUTRI; approval authority excluded (`tests/milestone3-2-uat-business-rules.test.ts` Sec 1). Capabilities pending seeding in production DB at C2B/C2C. |

---

## 4. Maintenance & Evolution Protocol

When a new Business Owner directive is communicated:
1. Assign the next sequential Directive ID (`DIR-YYYY-NNN`).
2. Record all ten mandatory attributes in Section 2 before writing application code.
3. If the directive supersedes an earlier entry, mark the earlier entry as `SUPERSEDED` and update both entries' `supersedes`/`superseded-by` fields.
4. Update affected technical contracts (`types/architecture-lock.ts`) and release manifests accordingly.
5. Never treat code availability as proof of production completion; keep `Production Status` as `NOT_LIVE` or `NOT_EXECUTED` until live verification is performed.
