# STQ EDUCATION PORTAL — BUSINESS OWNER DIRECTIVES REGISTRY

**Document Path:** `docs/STQ_OWNER_DIRECTIVES.md`
**Purpose:** Canonical Persistent Registry for Newest Explicit Business Owner Decisions
**Authority Level:** Level 0 — Newest Explicit Business Owner Decisions (per `STQ_PROJECT_CONTEXT.md`)
**Status:** ACTIVE CANONICAL REGISTRY (RECONCILED SCOPE)
**Last Updated:** 2026-09-19

```markdown
OWNER_DIRECTIVE_RECONCILIATION:
- STRUCTURE_IDENTITY_AUTH = RECONCILED
- TAHFIZH = RECONCILED
- KEASRAMAAN = RECONCILED
- PENDIDIKAN = RECONCILED
- PORTAL_WALI_SANTRI = DEFERRED
- ORANG_TUA_ASUH_SPONSOR = DEFERRED
- MASTER_DATA_LANJUTAN = DEFERRED
- INSTITUTIONAL_OTHER_DOMAINS = DEFERRED
```

---

## 1. Registry Scope, Purpose & Fundamental Governance Rules

This document serves as the persistent repository registry for authoritative Business Owner decisions and directives.

### Scope & Semantic Rules

1. **Registry Purpose**:
   This registry captures the **NEWEST EXPLICIT BUSINESS OWNER DECISIONS** across the currently reconciled architectural domains:
   - Structure / Identity / Authorization
   - Tahfizh Program
   - Keasramaan & Santri Life
   - Pendidikan (Studi Umum & Kepesantrenan)

   It is **NOT** a universal retrospective archive of all historical STQ requirements. Unreconciled or future domains (Portal Wali Santri, advanced Portal Santri, Orang Tua Asuh / Sponsor, advanced Master Data development, and expanded WhatsApp workflows) remain formally **DEFERRED**.

2. **Non-Cancellation by Omission (Semantic Rule)**:
   The **ABSENCE** of a historical requirement from `STQ_OWNER_DIRECTIVES.md` **DOES NOT** mean it is cancelled. Historical requirements continue to bind according to their foundational source documents (cataloged in [`docs/STQ_REQUIREMENT_SOURCE_MAP.md`](docs/STQ_REQUIREMENT_SOURCE_MAP.md)). Only an explicit newer directive possessing:
   - `SUPERSEDES: <target>` or
   - `SUPERSEDED_BY: <target>`
   may alter or replace an older decision.

3. **Conversational Memory Is NOT a Source of Truth**:
   Conversational agent memory (ChatGPT, Antigravity, Claude, etc.), chat logs, or ephemeral issue comments do NOT constitute project source of truth. All binding business requirements, rule adjustments, account identities, authorities, scopes, workflows, and acceptance criteria must be committed into this repository registry.

4. **Immediate Registration Requirement**:
   Every new decision or clarification by the Business Owner that modifies a requirement, business rule, account identity, authority, scope, workflow, or acceptance criteria must be formally recorded in this file within the **same workstream** prior to implementation.

5. **Ten Mandatory Directive Attributes**:
   Every directive entry in this registry MUST contain all of the following ten attributes:
   - **Directive ID**: Unique, permanent identifier (e.g. `DIR-2026-001`).
   - **Tanggal**: Date of the directive (YYYY-MM-DD).
   - **Keputusan Business Owner**: Faithful, unambiguous formulation of the Business Owner's decision.
   - **Canonical Interpretation**: Clear, unambiguous technical and institutional interpretation.
   - **Affected Domain**: Impacted operational and system domains (e.g., IDENTITY, TAHFIZH, PENDIDIKAN, KEASRAMAAN, AUDIT).
   - **Implementation Status**: Current implementation state based on independent evidence-backed tracking dimensions.
   - **Production Status**: Current state of the live production environment.
   - **Supersedes / Superseded-By**: Explicit cross-references to prior or subsequent directives or foundational sources.
   - **Acceptance Criteria**: Verifiable criteria required to satisfy the directive.
   - **Evidence / Reference**: Concrete file paths, tests, schemas, or documentation references.

6. **Independent Multi-Dimensional State Tracking**:
   Statuses must reflect technical reality truthfully across distinct, independent dimensions rather than being assumed as a mandatory strict linear progression:
   - **Business Rule Status**: e.g., `BUSINESS_DECISION_CONFIRMED`, `TARGET_DESIGNED`, `DEFERRED`.
   - **Code Status**: e.g., `CODE_PARTIAL`, `CODE_COMPLETE`, `TARGET_DESIGNED`.
   - **Backend Authorization Status**: e.g., `BACKEND_AUTHORIZED`, `BACKEND_NOT_AUTHORIZED`, `NOT_APPLICABLE`.
   - **UI Status**: e.g., `UI_COMPLETE`, `UI_NOT_COMPLETE`, `NOT_APPLICABLE`.
   - **Production Status**: e.g., `NOT_LIVE`, `NOT_EXECUTED`, `REQUIRES_FRESH_READ_ONLY_VERIFICATION`, `PRODUCTION_VERIFIED`.

   These tracking dimensions are evaluated independently: backend authorization, UI completeness, provisioning, and production verification can be in different states at any point in time.
   - A directive must **NEVER** be declared universally complete or production-verified merely because types, schemas, or PRs are merged.
   - If runtime logic differs from business source rules, it must be recorded as `IMPLEMENTATION_DRIFT`, not silently softened.

7. **Production Read-Only Default**:
   Production default is strictly **READ ONLY**. This documentation registry authorizes zero production mutations, writes, migrations, seeds, or account provisioning.

8. **Strict Ban on Personal Identity in Authorization**:
   Usernames, employee names, emails, or personal display labels must **NEVER** serve as authorization keys. Operational authorities are modeled strictly through generic Positions, Capabilities, and Scope assignments. Legacy `Role` is compatibility metadata only.

9. **UNIT Account Governance**:
   UNIT accounts (`AccountType.UNIT`) represent shared functional kiosks or desks. Every mutation originating from a UNIT account requires:
   $$\text{Technical Account Login} + \text{VERIFIED HUMAN EXECUTOR}$$
   A manually typed executor name in a form is descriptive metadata only; it is **NOT** sufficient identity proof.

---

## 2. Active Business Owner Directives Registry

### DIR-2026-001 | Canonical Target Username for Ustazah Lisa Dwina Fitri
- **Directive ID:** `DIR-2026-001`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Canonical target username Ustazah Lisa Dwina Fitri = exact `musyirfah.putri`.
- **Canonical Interpretation:** The authoritative production target username for Ustazah Lisa Dwina Fitri is standardized to the exact spelling `musyirfah.putri` (with `-ir-`, not `-ri-`). This is a PERSONAL account. This username represents an identity label and must never be used as an authorization key.
- **Affected Domain:** IDENTITY / AUTH
- **Implementation Status:** `TARGET_DESIGNED` (Target username specified in canonical documentation and release manifests; authority modeled via generic positions)
- **Production Status:** `NOT_EXECUTED / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (Planned rename target unexecuted; historical audit observed legacy `lisa.mt`)
- **Supersedes / Superseded-By:** Supersedes informal references to `lisa.putri`; distinct from legacy placeholder `musyrifah.putri`
- **Acceptance Criteria:** Target production user record for Ustazah Lisa Dwina Fitri has username `musyirfah.putri` without duplicate identity creation.
- **Evidence / Reference:** `docs/STQ_CURRENT_STATE.md`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-STF-02.

---

### DIR-2026-002 | Deprecation of Legacy Username `lisa.mt`
- **Directive ID:** `DIR-2026-002`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `lisa.mt` = legacy/deprecated rename source.
- **Canonical Interpretation:** The username `lisa.mt` is classified as a deprecated legacy origin account destined for renaming to `musyirfah.putri`. The rename has **NOT BEEN EXECUTED** in production. `lisa.mt` must not be treated as a permanent target identity or referenced in new feature contracts.
- **Affected Domain:** IDENTITY / MIGRATION
- **Implementation Status:** `CODE_COMPLETE` (Classified as legacy origin in release manifests, seed files, and test documentation)
- **Production Status:** `NOT_EXECUTED / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (Rename not executed; historical audit point-in-time observed `lisa.mt`)
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
- **Implementation Status:** `REQUIRED` (Audit item REL-STF-02 registered in release manifest; preflight execution pending Gate C2C)
- **Production Status:** `REQUIRES_FRESH_READ_ONLY_VERIFICATION` (HISTORICAL_OBSERVATION: `musyrifah.putri` appeared in historical seed/preflight records without Staff linkage; requires fresh read-only verification before any C2C step)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Preflight audit script executes against production DB, verifying account modality and preventing accidental overwrite or collision with `musyirfah.putri`.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-STF-02, `docs/STQ_M3_RELEASE_DEPENDENCIES.md:160`, `docs/STQ_MILESTONE3_3C2A_PRODUCTION_PREFLIGHT.md:202`.

---

### DIR-2026-004 | Production Rename Status Acknowledgment
- **Directive ID:** `DIR-2026-004`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Rename production belum dilakukan.
- **Canonical Interpretation:** Controlled rename from `lisa.mt` to `musyirfah.putri` has NOT been executed in the release train. Status remains `NOT_EXECUTED` (planned for Gate C2C); fresh read-only verification required prior to execution. No system component, test, or documentation may state or assume that production has completed this rename.
- **Affected Domain:** DATABASE / PRODUCTION / RELEASE
- **Implementation Status:** `TARGET_DESIGNED` (Release control plane tracks this as a pending operational mutation under Gate C2C)
- **Production Status:** `NOT_EXECUTED / REQUIRES_FRESH_READ_ONLY_VERIFICATION`
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Documentation and release manifests truthfully reflect `lisa.mt` as the legacy unrenamed identity until Gate C2C execution (HISTORICAL_OBSERVATION: last known point-in-time).
- **Evidence / Reference:** `docs/STQ_CURRENT_STATE.md`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-01.

---

### DIR-2026-005 | Preservation of Staff Linkage and Zero Duplicate Lisa Identity
- **Directive ID:** `DIR-2026-005`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Preserve Staff linkage, history, sessions/audit relationships according to controlled migration; jangan membuat duplicate Lisa identity.
- **Canonical Interpretation:** The rename of `lisa.mt` to `musyirfah.putri` must be performed as an in-place transactional update on the existing `User` primary record. No duplicate User record for Lisa may be created. All foreign keys (`Staff` relationship via staffCode `STF-0005`, `Halaqoh`, `Setoran`, `AuditLog`, sessions) must be preserved transactionally. Do not state an exact Lisa Staff database ID unless independently proven from authoritative database evidence; do not mislabel `staffCode` (`STF-0005`) as `Staff.id`.
- **Affected Domain:** IDENTITY / DATA INTEGRITY
- **Implementation Status:** `TARGET_DESIGNED` (Transactional update procedure specified in release manifest REL-ACC-01)
- **Production Status:** `PENDING_C2C`
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Post-migration audit proves exactly one User record for Ustazah Lisa Dwina Fitri exists, preserving `Staff` linkage (staffCode `STF-0005`) and all historical relations.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-STF-02, REL-ACC-01, `prisma/seed.ts:102,490`.

---

### DIR-2026-006 | Ustazah Lisa Tahfizh Access (Recap Read vs Setoran & Target Scope)
- **Directive ID:** `DIR-2026-006`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `musyirfah.putri` harus dapat melihat rekap Tahfizh seluruh santri; mutasi setoran dan target tetap dalam scope halaqoh; reward issuance sesuai scope PUTRI operasional [REWARD CLAUSE PARTIALLY SUPERSEDED by DIR-2026-023].
- **Canonical Interpretation:**
  1. Tahfizh Recap: `GLOBAL` READ across all santri via canonical `tahfizh.recap.read`.
  2. Setoran Mutations: strictly restricted to assigned Tahfizh halaqoh scope (`HALAQOH`).
  3. Target Management: may manage assigned halaqoh santri only (`HALAQOH`).
  4. Tasmi'/Sima'an Reward Issuance: [SUPERSEDED by DIR-2026-023] Prior target policy allowed PUTRI operational scope (`ASSIGNED_UNITS`), but `DIR-2026-023` strictly restricts `tahfizh.reward.issue` target authority to `MUDIR` (`GLOBAL`) and `KABID_TAHFIZH` (`DOMAIN: TAHFIZH`). POT / `musyirfah.putri` holds zero reward issuance authority. Runtime server action `prosesRewardTasmiSimaanAction` in `app/actions/reward-sanksi.ts` enforces legacy guard (`session.role === "KS" || Boolean(session.isKepalaBidangTahfidz)`) and evaluates canonical authorization in shadow mode via `shadowAuthorizeIfEnabled` for parity comparison (not live cutover). Runtime action behavior is verified in `tests/reward-abac-fail-closed.test.ts` via success/message assertions and authorized execution; canonical evaluator POT denial (`decision: "DENY"`, `code: "CAPABILITY_NOT_GRANTED"`) is verified in `tests/milestone3-3c1-real-postgres.test.ts` Section 5.1 & 6.1.
- **Affected Domain:** TAHFIZH / AUTHORIZATION
- **Implementation Status:** `CODE_PARTIAL` (Canonical authorization contract models `tahfizh.recap.read` scope `GLOBAL` in `types/architecture-lock.ts:599` and tests; runtime action `prosesRewardTasmiSimaanAction` in `app/actions/reward-sanksi.ts` strictly enforces legacy guard and shadow parity logging per DIR-2026-023 with action behavior verified in `tests/reward-abac-fail-closed.test.ts`; canonical POT denial is verified in `tests/milestone3-3c1-real-postgres.test.ts` Sec 5.1; release train lacks `PositionCapability` seeding in production)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (unverified by this task)
- **Supersedes / Superseded-By:** Supersedes halaqoh-only recap read restrictions for operational putri role; Reward clause PARTIALLY SUPERSEDED by `DIR-2026-023`
- **Acceptance Criteria:** Authenticated session for `musyirfah.putri` reads recap data across all santri; setoran mutations outside assigned halaqoh fail closed; reward issuance for PUTRI operational scope is SUPERSEDED by DIR-2026-023 (runtime action behavior fails closed with error message verified in `tests/reward-abac-fail-closed.test.ts`; canonical evaluator denies POT with `CAPABILITY_NOT_GRANTED` in `tests/milestone3-3c1-real-postgres.test.ts` Sec 5.1 & 6.1).
- **Evidence / Reference:** `types/architecture-lock.ts:599`, `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-023`, `app/actions/reward-sanksi.ts: prosesRewardTasmiSimaanAction`, `tests/reward-abac-fail-closed.test.ts` (runtime action success/message behavior and authorized Mudir/Kabid issuance), `tests/milestone3-3c1-real-postgres.test.ts` Sec 5.1 & 6.1 (canonical POT denial `CAPABILITY_NOT_GRANTED`), `docs/STQ_M3_RELEASE_TRACEABILITY.md` TR-TAHF-01, TR-TAHF-02.

---

### DIR-2026-007 | Santri Picker Display Format (Nama + Kelas Only)
- **Directive ID:** `DIR-2026-007`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Hasil pilihan/pencarian santri cukup Nama + Kelas; jangan NIS/halaqoh di display result kecuali screen lain memang membutuhkan.
- **Canonical Interpretation:** In the Tahfizh santri picker and general search dropdowns, each result item must display only `Nama` and `Kelas` (e.g. "Habiba Asri • Kelas 7B"). NIS and halaqoh name must not be appended to general search results unless a specific administrative screen explicitly mandates NIS display.
- **Affected Domain:** UI / TAHFIZH
- **Implementation Status:** `CODE_PARTIAL` (`components/dashboard/dashboard-musyrif-tahfizh.tsx` lines 783 & 978 currently still display `({santri.nis})` in search result modals; UI cleanup required)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (Production behavior requires fresh verification)
- **Supersedes / Superseded-By:** Supersedes modal search result layouts appending `({santri.nis})`
- **Acceptance Criteria:** Search dropdown and list items render `santri.nama` and `santri.kelas` only; `({santri.nis})` is omitted from general search list.
- **Evidence / Reference:** `components/dashboard/dashboard-musyrif-tahfizh.tsx:783,978`.

---

### DIR-2026-008 | Target Update Authority Restricted to Assigned Scope
- **Directive ID:** `DIR-2026-008`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** MT dan PH dapat update target hanya untuk santri dalam scope/halaqoh yang menjadi tanggung jawabnya.
- **Canonical Interpretation:** Musyrif Tahfizh (MT) and Pembina Halaqoh (PH) hold `tahfizh.target.manage` authority scoped strictly to `HALAQOH`. Target modifications for santri outside caller's assigned halaqoh are denied by backend authorization. The existing server action in codebase is `upsertTargetSantriAction` (`app/actions/laporan-bulanan.ts:558`).
- **Affected Domain:** TAHFIZH / AUTHORIZATION
- **Implementation Status:** `CODE_PARTIAL` (Scope defined in `types/architecture-lock.ts:600` and verified in contract tests; legacy server action `upsertTargetSantriAction` lacks canonical ABAC boundary check)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (PositionCapability and canonical assignments not activated in release train)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Target update permits update for santri in caller's assigned halaqoh; rejects cross-halaqoh target updates with 403 FORBIDDEN.
- **Evidence / Reference:** `types/architecture-lock.ts:600`, `app/actions/laporan-bulanan.ts:558`, `tests/milestone3-2-uat-business-rules.test.ts` (Section 3.1 & 10.2).

---

### DIR-2026-009 | Distinct Dual Tracks (Studi Umum & Kepesantrenan)
- **Directive ID:** `DIR-2026-009`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Studi Umum dan Kepesantrenan adalah dua track berbeda.
- **Canonical Interpretation:** Formal academic education is structured into two distinct tracks: `STUDI_UMUM` and `KEPESANTRENAN` (exact spelling). They operate with separate subject catalogs, curricula, schedule structures, and tracking logic under the `EducationTrack` domain enum. The database migration is `20260918140000_m3_3b_pendidikan_foundation`.
- **Affected Domain:** PENDIDIKAN / ARCHITECTURE
- **Implementation Status:** `CODE_COMPLETE` (Enum `EducationTrack` with values `STUDI_UMUM` and `KEPESANTRENAN` defined in `prisma/schema.prisma:198` and migration `20260918140000_m3_3b_pendidikan_foundation`; service layer tested in `tests/pendidikan-v2-service.test.ts`)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (LAST_KNOWN_POINT_IN_TIME / release-train observation: Prisma migration `20260918140000_m3_3b_pendidikan_foundation` pending deployment at Gate C2B; REQUIRES_FRESH_READ_ONLY_VERIFICATION before Gate execution)
- **Supersedes / Superseded-By:** Supersedes unified single-track academic assumptions
- **Acceptance Criteria:** Database schema and services enforce strict boundary between `STUDI_UMUM` and `KEPESANTRENAN` tracks.
- **Evidence / Reference:** `prisma/schema.prisma:198`, `prisma/migrations/20260918140000_m3_3b_pendidikan_foundation/migration.sql:2`, `lib/server/pendidikan-v2-service.ts`.

---

### DIR-2026-010 | Kepesantrenan Teacher Session Start & Student Attendance
- **Directive ID:** `DIR-2026-010`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Kepesantrenan memiliki teacher attendance melalui authenticated Mulai Pembelajaran dan student attendance HADIR/IZIN/SAKIT/ALFA.
- **Canonical Interpretation:** In the `KEPESANTRENAN` track, teacher attendance is verified and recorded when the assigned teacher triggers the authenticated "Mulai Pembelajaran" action (`startEducationSession`). Scheduled teacher and actual authenticated executor are stored separately. Student attendance is recorded under that active session, restricted strictly to `HADIR`, `IZIN`, `SAKIT`, and `ALFA` (NO MASBUK). Server activation is governed by server flag `PENDIDIKAN_V2_UAT_ENABLED`.
- **Affected Domain:** PENDIDIKAN / PRESENSI
- **Implementation Status:** `CODE_COMPLETE` (Implemented in `lib/server/pendidikan-v2-service.ts` methods `startEducationSession` and `recordSessionAttendance`, verified in `tests/pendidikan-v2-service.test.ts`)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (LAST_KNOWN_POINT_IN_TIME / release-train observation: server flag `PENDIDIKAN_V2_UAT_ENABLED` unset/false and schema pending Gate C2B; REQUIRES_FRESH_READ_ONLY_VERIFICATION before Gate execution)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Unauthenticated/unauthorized teacher cannot initiate session; teacher timestamp logged at start; student attendance rejects any status outside `HADIR`, `IZIN`, `SAKIT`, `ALFA`.
- **Evidence / Reference:** `lib/server/pendidikan-v2-service.ts:436,752`, `tests/milestone3-3c1-uat-activation-readiness.test.ts:223`.

---

### DIR-2026-011 | Halaqoh Attendance Forbids MASBUK
- **Directive ID:** `DIR-2026-011`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Absensi halaqoh tidak memiliki MASBUK.
- **Canonical Interpretation:** Halaqoh attendance supports statuses `HADIR`, `IZIN`, `SAKIT`, and `ALFA`. The status `MASBUK` (late arrival) is strictly prohibited for new halaqoh attendance records and must fail validation.
- **Affected Domain:** TAHFIZH / PRESENSI
- **Implementation Status:** `CODE_COMPLETE` (Enforced in `tests/presensi.test.ts:122-137` with `FORBIDDEN_STATUSES: ["MASBUK"]`)
- **Production Status:** `NOT_LIVE` (Pending production runtime rollout and data verification)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Halaqoh attendance submission rejects `MASBUK` with 400 Bad Request; UI form options do not present `MASBUK`.
- **Evidence / Reference:** `tests/presensi.test.ts:122-137`, `prisma/schema.prisma:StatusAbsensi`.

---

### DIR-2026-012 | Tahajjud Attendance Restricted to SHOLAT and ALFA
- **Directive ID:** `DIR-2026-012`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Tahajjud hanya SHOLAT dan ALFA.
- **Canonical Interpretation:** Daily night prayer (Tahajjud) attendance entries allow exactly two valid business choices: `SHOLAT` and `ALFA`. Statuses `HADIR`, `IZIN`, `SAKIT`, and `MASBUK` are invalid for Tahajjud recordings. Technical reality note: At the database persistence layer, the Prisma enum `StatusAbsensi` contains `HADIR`, `IZIN`, `SAKIT`, `ALFA` (it does **NOT** literally contain a `SHOLAT` enum value). The application maps business choice `SHOLAT` to database status `HADIR` with mutaba'ah message/notes indicating "Melaksanakan".
- **Affected Domain:** KEASRAMAAN / IBADAH
- **Implementation Status:** `CODE_COMPLETE` (Enforced in `tests/presensi.test.ts:105-121,134-151` with `TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS: ["SHOLAT", "ALFA"]`)
- **Production Status:** `NOT_LIVE` (Pending production runtime deployment and verification)
- **Supersedes / Superseded-By:** Supersedes multi-status attendance options for Tahajjud
- **Acceptance Criteria:** Tahajjud entry form and server validation reject all values other than `SHOLAT` and `ALFA`.
- **Evidence / Reference:** `tests/presensi.test.ts:105-121`, `prisma/schema.prisma:StatusAbsensi:90`.

---

### DIR-2026-013 | Operational Perizinan Putri Read/Create Authority & Final Workflow
- **Directive ID:** `DIR-2026-013`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `musyirfah.putri` mendapatkan read/create perizinan sesuai scope PUTRI; approval authority tidak otomatis diberikan. Alur perizinan PRD V2 dikonfirmasi FINAL (bukan PROPOSED_TBD).
- **Canonical Interpretation:**
  1. Authority Boundary: `musyirfah.putri` receives `keasramaan.permission.read` and `create` capabilities scoped to `ASSIGNED_UNITS` / `UNIT` (PUTRI). Approval authority (`keasramaan.permission.approve`, `approve_mk`, `approve_ks`) is NOT granted and remains quarantined. Operational read and creation access for PUTRI does NOT automatically grant permit approval authority. This distinction must not be misread as permit approval policy being TBD; the PRD approval flow is confirmed and final.
  2. Two Input Paths:
     - Santri self-request: creates individual permit $\rightarrow$ status: waiting for decision (the Business Owner rule is that self-requests remain waiting for decision; technical enum mapping to legacy `MENUNGGU_MK` is current implementation behavior, not an immutable business rule).
     - Mudabbir or Musyrif operational input: may select one or multiple santri $\rightarrow$ system creates one independent permit record PER santri. No group permit entity in UI. `batchId` is audit metadata only.
  3. Approval Rules:
     - Permit created by Musyrif: directly `APPROVED`.
     - Same-day `Izin Keluar` recorded by Mudabbir: may be directly approved within Mudabbir authority.
     - `Pulang` / `Menginap` / vehicle-related permit recorded by Mudabbir: escalated to Musyrif.
     - Self-requested santri permit: remains pending until decision.
  4. Return Confirmation & Cancellation: Return confirmed per santri. Late return sets automatic late indicator, but does **NOT** automatically generate a discipline violation. Cancellation is soft cancel with actor, timestamp, and reason.
- **Affected Domain:** KEASRAMAAN / PERIZINAN / AUTHORIZATION
- **Implementation Status:** `TARGET_DESIGNED` (Canonical permissions defined in `types/architecture-lock.ts:601-602` and verified in contract tests; legacy runtime `components/modules/perizinan-module.tsx` still uses legacy role switches and lacks multi-student expansion)
- **Production Status:** `NOT_LIVE` (Pending Gate C2B migration and Gate C2C provisioning)
- **Supersedes / Superseded-By:** Supersedes previous documentation regressions labeling permit approval as broadly `PROPOSED_TBD`
- **Acceptance Criteria:** `musyirfah.putri` can view and create permissions for santriwati; cannot approve tickets; multi-santri inputs create independent records per santri; return confirmations tracked per santri.
- **Evidence / Reference:** `types/architecture-lock.ts:601-602`, `tests/milestone3-2-uat-business-rules.test.ts` (Section 1), `SOURCE-KEA-001`.

---

### DIR-2026-014 | Controlled Provisioning for Santriwati Accounts
- **Directive ID:** `DIR-2026-014`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Akun santriwati harus diprovisioning secara controlled, bukan seed production.
- **Canonical Interpretation:** User accounts for santriwati (female students) must be created through an authoritative, controlled provisioning procedure with credential hashing and preflight verification, rather than running development `seed.ts` against production.
- **Affected Domain:** PROVISIONING / SECURITY
- **Implementation Status:** `TARGET_DESIGNED` (Governed by Gate C2C and REL-ACC-03 in Release Manifest)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (HISTORICAL_OBSERVATION: zero santriwati user accounts provisioned in release train; fresh read-only verification scheduled at Gate C2C)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Production provisioning runbook executes controlled batch script; raw `prisma db seed` is never run in production.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-03, `docs/STQ_M3_RELEASE_DEPENDENCIES.md`.

---

### DIR-2026-015 | Tasmi' and Sima'an Reward Issuance Authority (SUPERSEDED)
- **Directive ID:** `DIR-2026-015`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** [SUPERSEDED by DIR-2026-023] Penerbit reward Tasmi'/Sima'an target authority = Mudir + Kabid Tahfizh + `musyirfah.putri` sesuai canonical capability/scope.
- **Canonical Interpretation:** [SUPERSEDED] Prior target policy permitted `PETUGAS_OPERASIONAL_TAHFIZH` (`musyirfah.putri`) to issue rewards with `ASSIGNED_UNITS`. This target policy is formally **SUPERSEDED** by `DIR-2026-023`. Authoritative reward issuance (`tahfizh.reward.issue`) is strictly restricted to `MUDIR` (`GLOBAL`) and `KABID_TAHFIZH` (`DOMAIN`) only. POT, ordinary MT, PH, and ADM are not authorized (`CAPABILITY_NOT_GRANTED`).
- **Affected Domain:** TAHFIZH / REWARD / AUTHORIZATION
- **Implementation Status:** `SUPERSEDED`
- **Production Status:** `NOT_LIVE`
- **Supersedes / Superseded-By:** `SUPERSEDED_BY: DIR-2026-023`
- **Acceptance Criteria:** Historical record preserved; superseded by DIR-2026-023.
- **Evidence / Reference:** `docs/STQ_OWNER_DIRECTIVES.md: DIR-2026-023`, `types/architecture-lock.ts:598`, `tests/milestone3-2-uat-business-rules.test.ts`.

---

### DIR-2026-016 | Cross-Domain Access Boundaries for Ustazah Lisa (PUTRI Scope, Zero PUTRA Leakage)
- **Directive ID:** `DIR-2026-016`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `musyirfah.putri` mendapatkan akses operasional Kepesantrenan PUTRI + approved Keasramaan PUTRI + Health detail read seluruh santriwati + monitor/supervise OSDA PUTRI; TIDAK otomatis memiliki otoritas Studi Umum; TIDAK boleh bocor ke PUTRA.
- **Canonical Interpretation:**
  1. Pendidikan: Operational access is strictly for **KEPESANTRENAN PUTRI**. Does **NOT** automatically grant Studi Umum authority.
  2. Keasramaan: Operational access according to approved PUTRI capabilities.
  3. OSDA PUTRI: May see, monitor, and supervise OSDA PUTRI; does **NOT** automatically become executor of every OSDA operational function.
  4. Health: Special Business Owner decision permits reading detail Health cases for **ALL SANTRIWATI** (PUTRI only). Broader than default Mudabbir room responsibility, but must still be implemented via Position + Capability + Scope, never username hardcoding.
  5. PUTRA Boundary: All queries and mutations targeting PUTRA halaqoh, kamar, and santri are denied fail-closed.
- **Affected Domain:** CROSS-DOMAIN / AUTHORIZATION / SCOPE
- **Implementation Status:** `CODE_PARTIAL` (Scope boundaries defined in `types/architecture-lock.ts:144,601`; runtime services lack complete multi-domain integration for Lisa; release train lacks assignment seeding in production)
- **Production Status:** `NOT_LIVE` (Pending Gate C2B/C2C assignment activation)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** Access evaluator allows operations on santriwati / PUTRI halaqoh & kamar; strictly denies access to PUTRA halaqoh, kamar, and santri.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-CAP-08, `docs/STQ_ARCHITECTURE_LOCK.md:144`.

---

### DIR-2026-017 | Setoran Date Validation (Past Allowed, Future Denied, Default WITA)
- **Directive ID:** `DIR-2026-017`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Setoran Tahfizh SABAQ/SABQI/MANZIL/MUFAR dapat memilih tanggal lampau; masa depan ditolak; default = tanggal hari ini WITA.
- **Canonical Interpretation:** Memorization entries (Sabaq, Sabqi, Manzil, Mufar) allow historical/backdated date selection with WITA timezone handling and audit trail. Default date is today WITA (`getTodayWITADateString()`). Dates in the future relative to today WITA are strictly rejected before database write. The immutable `createdAt` timestamp is always preserved. Real action source is `app/actions/tahfizh.ts:42` (`createSetoranAction`).
- **Affected Domain:** TAHFIZH / VALIDATION
- **Implementation Status:** `CODE_COMPLETE` (Implemented in `app/actions/tahfizh.ts:42` and `lib/tahfizh-persistence.ts`, verified in `tests/milestone3-2-uat-business-rules.test.ts` Sec 11)
- **Production Status:** `NOT_LIVE` (Awaiting production deployment and verification)
- **Supersedes / Superseded-By:** Supersedes date restrictions that prevented past date entry
- **Acceptance Criteria:** Submitting setoran with valid past date succeeds; submitting setoran with date > today WITA fails with validation message "masa depan"; default date is current WITA.
- **Evidence / Reference:** `app/actions/tahfizh.ts:42`, `tests/milestone3-2-uat-business-rules.test.ts:997-1021`, `docs/STQ_M3_RELEASE_TRACEABILITY.md` TR-OPER-02.

---

### DIR-2026-018 | Preservation and Soft Deactivation of Abdullah Khairun Nizham
- **Directive ID:** `DIR-2026-018`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Abdullah Khairun Nizham = OUT dari STQ; tidak masuk roster aktif September; histori tidak boleh hard-delete.
- **Canonical Interpretation:** Santri Abdullah Khairun Nizham has departed STQ. He must be excluded from active September 2026 rosters. His historical academic, tahfizh, and attendance records must NEVER be hard-deleted from the database.
- **Affected Domain:** SANTRI / ROSTER / AUDIT
- **Implementation Status:** `TARGET_DESIGNED` (Documented in registry; database deactivation migration scheduled for Gate C2C)
- **Production Status:** `NOT_EXECUTED / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (HISTORICAL_OBSERVATION: Abdullah was recorded in historical roster; status update and soft deactivation pending Gate C2C read-only audit)
- **Supersedes / Superseded-By:** Supersedes inclusion of Abdullah in active student roster counts
- **Acceptance Criteria:** Active roster queries exclude Abdullah Khairun Nizham; historical setoran and presensi records remain intact in database.
- **Evidence / Reference:** `prisma/seed.ts:288`, `tests/business-rules.test.ts:226`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-SAN-01. *(UNVERIFIED / TECHNICAL OBSERVATION: Previous working notes referenced NIS `SAN-0041` and Halaqoh Ust. Alwan; these technical attributes remain subject to read-only database verification).*

---

### DIR-2026-019 | Authoritative September 2026 Headcount (56 Active Santri)
- **Directive ID:** `DIR-2026-019`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Roster September 2026 = 56 santri aktif setelah Abdullah OUT.
- **Canonical Interpretation:** The authoritative active student headcount for September 2026 is confirmed by the Business Owner as exactly 56 active santri, reflecting the departure of Abdullah Khairun Nizham. All active halaqoh and academic rosters must reconcile to this count.
- **Affected Domain:** SANTRI / ROSTER / RECONCILIATION
- **Implementation Status:** `TARGET_DESIGNED` (Target established in manifest REL-SAN-02; live database reconciliation scheduled at Gate C2C)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (Active count target = 56 confirmed by Owner; fresh read-only database verification of active roster scheduled at Gate C2C)
- **Supersedes / Superseded-By:** Supersedes historical 57-santri active headcount baseline
- **Acceptance Criteria:** September 2026 active roster queries return exactly 56 santri; halaqoh distributions total 56 active students.
- **Evidence / Reference:** `docs/STQ_CURRENT_STATE.md`, `docs/STQ_M3_RELEASE_MANIFEST.md` REL-SAN-02. *(UNVERIFIED / TECHNICAL OBSERVATION: A gender breakdown of 46 Putra + 10 Putri was noted in working drafts but is an unverified observation until confirmed by a fresh read-only production audit).*

---

### DIR-2026-020 | Deprecation and Decommission Target for `razan.mt`
- **Directive ID:** `DIR-2026-020`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** `razan.mt` = DEPRECATED / DECOMMISSION TARGET; jangan hubungkan ke staffCode STF-0003; jangan berikan otoritas kanonikal baru.
- **Canonical Interpretation:** Account `razan.mt` is designated for controlled decommissioning at Gate C2C. It must not be linked to active Staff record `STF-0003` (Ust. Razan Mufli) in canonical architecture, nor receive new canonical Positions or Capabilities. Post-decommission verification must prove server session resolver rejects non-AKTIF user.
- **Affected Domain:** IDENTITY / GOVERNANCE / DECOMMISSION
- **Implementation Status:** `TARGET_DESIGNED` (Release manifest REL-ACC-02 and dependencies document decommission requirement and prohibition of canonical grants; operational decommission execution is pending Gate C2C)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (LAST_KNOWN_POINT_IN_TIME / release-train observation: decommission mutation pending Gate C2C execution; REQUIRES_FRESH_READ_ONLY_VERIFICATION before Gate execution)
- **Supersedes / Superseded-By:** None
- **Acceptance Criteria:** `razan.mt` is deactivated during C2C; zero canonical assignments granted; sessions fail closed.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-02, `docs/STQ_CURRENT_STATE.md:534`.

---

### DIR-2026-021 | Canonical Kabid Tahfizh Username Designation
- **Directive ID:** `DIR-2026-021`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Business Owner designated canonical Kabid Tahfizh username: `musyrif.tahifzh` (exact spelling).
- **Canonical Interpretation:** The authoritative account username designated by the Business Owner for the Kepala Bidang Tahfizh operational role is exact `musyrif.tahifzh` (note spelling with `-h-` before `-z-`). This exact spelling must be preserved without autocorrection.
- **Affected Domain:** IDENTITY / TAHFIZH
- **Implementation Status:** `TARGET_DESIGNED` (Registered in release manifest REL-ACC-02; operational linkage verified prior to Gate C2C)
- **Production Status:** `NOT_LIVE` (Pending Gate C2C provisioning)
- **Supersedes / Superseded-By:** Supersedes informal references to `musyrif.tahfizh` as Kabid account
- **Acceptance Criteria:** Canonical Kabid Tahfizh account uses exact username `musyrif.tahifzh` linked to approved Kabid Position.
- **Evidence / Reference:** `docs/STQ_M3_RELEASE_MANIFEST.md` REL-ACC-02, `docs/STQ_CURRENT_STATE.md:538`.

---

### DIR-2026-022 | Canonical Authorization Chain and UNIT Account Constraints
- **Directive ID:** `DIR-2026-022`
- **Tanggal:** 2026-09-19
- **Keputusan Business Owner:** Otoritas wajib mengikuti rantai kanonikal; nama/username bukan kunci otorisasi; akun UNIT wajib memiliki human executor terverifikasi.
- **Canonical Interpretation:**
  1. Authoritative Chain:
     $$\text{SESSION} \longrightarrow \text{IDENTITY} \longrightarrow \text{ACTIVE ASSIGNMENT} \longrightarrow \text{POSITION} \longrightarrow \text{CAPABILITY} \longrightarrow \text{SCOPE} \longrightarrow \text{SERVER RESOURCE CONTEXT} \longrightarrow \text{ALLOW / DENY}$$
  2. Legacy `Role` is compatibility metadata only; UI hiding is not authorization.
  3. UNIT accounts: Shared technical account + verified human executor. A manually typed executor name in client UI is descriptive metadata only and does **NOT** constitute sufficient proof of identity.
- **Affected Domain:** ARCHITECTURE / AUTHORIZATION / SECURITY
- **Implementation Status:** `CODE_PARTIAL` (Canonical architecture contracts and pure evaluator exist in `types/architecture-lock.ts` and `lib/auth/canonical-evaluator.ts`, but runtime adoption is incomplete across legacy server actions and production remains in shadow/not-active mode; full enforcement pending controlled Gate C2D activation)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (LAST_KNOWN_POINT_IN_TIME / release-train observation: runtime shadow mode; production enforcement pending Gate C2D; REQUIRES_FRESH_READ_ONLY_VERIFICATION before Gate execution)
- **Supersedes / Superseded-By:** Supersedes legacy role-based conditional logic
- **Acceptance Criteria:** Server actions evaluate canonical capability and scope; UNIT mutations record immutable snapshots of verified human executor.
- **Evidence / Reference:** `types/architecture-lock.ts:58-95`, `docs/STQ_ARCHITECTURE_LOCK.md:58-95`.

---

### DIR-2026-023 | Canonical Reward Issuance Authority Restricted to Mudir and Kabid Tahfizh Only
- **Directive ID:** `DIR-2026-023`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Penerbit reward Tasmi'/Sima'an HANYA Mudir dan Kabid Tahfizh. Petugas Operasional Tahfizh (POT) / `musyirfah.putri`, Musyrif Halaqoh biasa, Pembina Halaqoh, dan ADM TIDAK berwenang menerbitkan reward.
- **Canonical Interpretation:** Authoritative issuance of Tasmi' and Sima'an achievement rewards (`tahfizh.reward.issue`) target policy is strictly restricted to:
  - `MUDIR` (`GLOBAL`)
  - `KABID_TAHFIZH` (`DOMAIN: TAHFIZH`)
  All other positions fail closed in canonical ABAC evaluation:
  - `PETUGAS_OPERASIONAL_TAHFIZH` (`DENY / CAPABILITY_NOT_GRANTED`)
  - `musyirfah.putri` via POT (`DENY / CAPABILITY_NOT_GRANTED`)
  - Ordinary `MUSYRIF_TAHFIZH` (`DENY / CAPABILITY_NOT_GRANTED`)
  - `PEMBINA_HALAQOH` (`DENY / CAPABILITY_NOT_GRANTED`)
  - `ADM` (`DENY / CAPABILITY_NOT_GRANTED`)
  The historical target rule granting POT / `musyirfah.putri` `ASSIGNED_UNITS` reward issuance is formally superseded (partially superseding DIR-2026-006 item 4 and superseding DIR-2026-015). Operational Tahfizh recap read (`tahfizh.recap.read`) remains granted to POT with `GLOBAL` scope, but confers zero reward write authority.
- **Affected Domain:** TAHFIZH / REWARD / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Enforced in runtime server action `prosesRewardTasmiSimaanAction` in `app/actions/reward-sanksi.ts` via legacy guard `session.role === "KS" || Boolean(session.isKepalaBidangTahfidz)` with action behavior verified in `tests/reward-abac-fail-closed.test.ts`; shadow canonical evaluation executed via `shadowAuthorizeIfEnabled` for parity comparison and audit logging without live cutover; target policy verified in canonical ABAC evaluator test `tests/milestone3-3c1-real-postgres.test.ts` Section 5.1 & Section 6.1)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` (unverified by this task; zero production access)
- **Supersedes / Superseded-By:** `SUPERSEDES: DIR-2026-015`, `PARTIALLY SUPERSEDES: DIR-2026-006` (reward issuance clause)
- **Acceptance Criteria:** Runtime action `prosesRewardTasmiSimaanAction` enforces legacy issuer check returning error message on unauthorized role denial and success on Mudir/Kabid issuance (verified in `tests/reward-abac-fail-closed.test.ts`); shadow engine evaluates canonical policy for parity; canonical ABAC test evaluation in `tests/milestone3-3c1-real-postgres.test.ts` Section 5.1 & Section 6.1 confirms MUDIR (GLOBAL) and KABID_TAHFIZH (DOMAIN) are allowed while POT is denied with assertion code `CAPABILITY_NOT_GRANTED`.
- **Evidence / Reference:** `app/actions/reward-sanksi.ts: prosesRewardTasmiSimaanAction`, `lib/auth/shadow-engine.ts: shadowAuthorizeIfEnabled`, `types/architecture-lock.ts`, `tests/reward-abac-fail-closed.test.ts` (runtime action behavior and success/message assertions for authorized and unauthorized callers), `tests/milestone3-3c1-real-postgres.test.ts` Section 5.1 & Section 6.1 (canonical evaluator authorization for Mudir/Kabid and POT denial with `CAPABILITY_NOT_GRANTED`).

---

### DIR-2026-024 | Sabaqi Automatic Derivation Without Manual Fallback (ORR-067)
- **Directive ID:** `DIR-2026-024`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Sabaqi TIDAK memiliki fallback manual atau fake fallback. Sabaqi diturunkan murni secara otomatis dari data setoran SABAQ valid yang tersimpan sesuai aturan temporal WITA (`isManualAllowed = false`).
- **Canonical Interpretation:** Per ORR-067, Sabaqi is strictly derived from valid stored SABAQ setoran records within the active temporal weekly window (from Monday/Senin 00:00 WITA up to effective reference/input timestamp, with valid stored SABAQ and all applicable temporal/baseline filters enforced). Business semantics require `isManualAllowed = false`. Manual overrides, fake fallbacks, or manual Sabaqi entry with audit reason are prohibited and non-canonical. Server-side automatic calculation remains authoritative.
- **Affected Domain:** TAHFIZH / SABAQI / INTEGRITY
- **Implementation Status:** `CODE_COMPLETE` (Implemented in server derivation logic `lib/tahfizh-persistence.ts` and validated via tests; manual fallback disallowed)
- **Production Status:** `REQUIRES_FRESH_READ_ONLY_VERIFICATION`
- **Supersedes / Superseded-By:** Supersedes stale POSTMERGE_FINAL handoff text that permitted manual Sabaqi with audit reason
- **Acceptance Criteria:** Sabaqi derivation rejects manual input; `isManualAllowed` evaluates to false; system strictly derives sabaqi target from authoritative stored SABAQ.
- **Evidence / Reference:** `ORR-067`, `lib/tahfizh-persistence.ts`, `tests/milestone3-2-uat-business-rules.test.ts`.

---

### DIR-2026-025 | Project-Based Learning (PBL) Rotation Without Invented Phase Semantics (ORR-131)
- **Directive ID:** `DIR-2026-025`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Struktur PBL Semester terdiri dari 20 pertemuan rotasi mata pelajaran yang disetujui (1–5 IPS, 6–10 IPA, 11–15 Bahasa Indonesia, 16–20 TIK). TIDAK ADA aturan owner mengenai pembagian "minggu 1–4 teori / minggu 5 proyek" ataupun enum fase seperti THEORY, PROJECT, INQUIRY.
- **Canonical Interpretation:** Per ORR-131, the approved canonical owner rule for PBL is purely the subject rotation across 20 Saturday sessions (Meetings 1–5: IPS, 6–10: IPA, 11–15: Bahasa Indonesia, 16–20: TIK). Invented pedagogical phases (such as theory vs project weeks or values like `THEORY`, `PROJECT`, `INQUIRY`) are non-canonical. Historical DB schema column `pbl_phase` in migration `20260918140000_m3_3b_pendidikan_foundation` is immutable historical record and must NOT be rewritten; runtime resolvers return approved rotation without asserting phase semantics.
- **Affected Domain:** PENDIDIKAN / STUDI_UMUM / PBL
- **Implementation Status:** `CODE_COMPLETE` (`resolvePblMeeting()` in `lib/server/pendidikan-v2-service.ts` and `lib/pendidikan-v2.ts` returns approved rotation schedule)
- **Production Status:** `REQUIRES_FRESH_READ_ONLY_VERIFICATION`
- **Supersedes / Superseded-By:** Supersedes any prior documentation asserting 1-4 theory / 5 project phase rules
- **Acceptance Criteria:** `resolvePblMeeting()` maps meetings 1-5 to IPS, 6-10 to IPA, 11-15 to Bahasa Indonesia, 16-20 to TIK; no canonical owner validation enforces theory/project phases.
- **Evidence / Reference:** `ORR-131`, `lib/server/pendidikan-v2-service.ts`, `tests/milestone3-3b-pendidikan-foundation.test.ts`.

---

### DIR-2026-026 | Decoupling Institutional Curriculum Taxonomy from Technical Authorization Architecture (ORR-003)
- **Directive ID:** `DIR-2026-026`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Taksonomi kurikulum institusional (Pendidikan memayungi Ketahfidzan, Kepesantrenan, dan Studi Umum) TIDAK BOLEH meruntuhkan arsitektur otorisasi teknis. Domain otorisasi TAHFIZH tetap berdiri sendiri dan independen dari domain PENDIDIKAN.
- **Canonical Interpretation:** Per ORR-003, the institutional/informational curriculum taxonomy groups all educational aspects (Tahfizh, Kepesantrenan, Studi Umum) under the broad concept of "Pendidikan". However, in technical ABAC authorization architecture:
  - `OrgDomain: TAHFIZH` remains an independent authorization domain and capability namespace (`tahfizh.*`).
  - `OrgDomain: AKADEMIK` (current technical enum value in `types/architecture-lock.ts`) encompasses `STUDI_UMUM` and `KEPESANTRENAN` tracks and capability namespace (`academic.*`), while "PENDIDIKAN" serves as the overarching institutional/curriculum classification label.
  Technical evaluators, `OrgDomain` (`AKADEMIK`, `TAHFIZH`, `KEASRAMAAN`, `INSTITUTIONAL`, `MANAJEMEN`), `CapabilityNamespace`, `authorizeCanonical`, and resource-context resolution must NOT be collapsed or redesigned under the guise of taxonomy alignment.
- **Affected Domain:** ARCHITECTURE / TAXONOMY / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Enforced in `types/architecture-lock.ts` and `lib/auth/canonical-evaluator.ts`)
- **Production Status:** `REQUIRES_FRESH_READ_ONLY_VERIFICATION`
- **Supersedes / Superseded-By:** None (Clarifies taxonomy vs authorization architecture boundary)
- **Acceptance Criteria:** Institutional documents reflect curriculum groupings under Pendidikan while architecture locks maintain strict technical isolation between `OrgDomain: TAHFIZH` and `OrgDomain: AKADEMIK` authorization domains.
- **Evidence / Reference:** `ORR-003`, `types/architecture-lock.ts`, `docs/STQ_ARCHITECTURE_LOCK.md`.

---

### DIR-2026-027 | Formalization of SUBJECT Credential Modality for Studi Umum (PR #28 Reconciled)
- **Directive ID:** `DIR-2026-027`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Akun mata pelajaran Studi Umum menggunakan modalitas kredensial SUBJECT dengan binding kanonikal mata pelajaran aktif, tanpa mensyaratkan profil Staff palsu, dan hak akses strictly scoped ke mata pelajaran terkait.
- **Canonical Interpretation:** Reconciled from PR #28. Canonical credential modalities are `PERSONAL`, `UNIT`, and `SUBJECT`. The `SUBJECT` modality is reserved for Studi Umum subject accounts (e.g. `mapel.matematika`, `mapel.ipa`).
  - Exactly one active binding from subject account to canonical subject.
  - Zero fake Staff profile requirement.
  - Access is fail-closed across subjects (e.g. Matematika account cannot access IPA sessions).
  - Does NOT grant Kepesantrenan, Keasramaan, or consolidated report authority.
  - Modality is evaluated via cryptographic token / session structure, never inferred from username strings.
- **Affected Domain:** IDENTITY / PENDIDIKAN / STUDI_UMUM / AUTH
- **Implementation Status:** `CODE_COMPLETE` (Merged in PR #28; verified in `lib/server/pendidikan-v2-readiness.ts` and test suites)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION`
- **Supersedes / Superseded-By:** Supersedes older requirements assuming all academic actors must have Staff profiles
- **Acceptance Criteria:** Accounts with `AccountType.SUBJECT` access their bound subject only; cross-subject mutations denied fail-closed.
- **Evidence / Reference:** PR #28, `lib/server/pendidikan-v2-readiness.ts`, `types/architecture-lock.ts`.

---

### DIR-2026-028 | GURU_KEPESANTRENAN Canonical Contract and Server-Derived Teacher Attendance (PR #29 Reconciled)
- **Directive ID:** `DIR-2026-028`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Posisi GURU_KEPESANTRENAN adalah kontrak kanonikal resmi dengan modalitas PERSONAL; kehadiran guru dibuktikan melalui server-derived start pada aksi Mulai Pembelajaran (`academic.session.start`).
- **Canonical Interpretation:** Reconciled from PR #29. `GURU_KEPESANTRENAN` is an approved canonical position contract:
  - Account modality is strictly `PERSONAL` (linked to verified human Staff).
  - Teacher attendance is proven automatically when the authenticated assigned teacher initiates "Mulai Pembelajaran" (`academic.session.start`) for their scheduled session; no separate manual Hadir/Alfa form.
  - Scheduled teacher and actual authenticated executor are stored distinctly in session logs.
  - Badal/substitute teacher authorization remains quarantined pending explicit owner rules.
  - SUBJECT modality is prohibited for Kepesantrenan.
- **Affected Domain:** PENDIDIKAN / KEPESANTRENAN / AUTHORIZATION
- **Implementation Status:** `CODE_COMPLETE` (Merged in PR #29; implemented in `lib/server/pendidikan-v2-service.ts` and tested)
- **Production Status:** `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION`
- **Supersedes / Superseded-By:** Supersedes stale release document text stating GURU_KEPESANTRENAN is invented or deferred
- **Acceptance Criteria:** `GURU_KEPESANTRENAN` evaluates under PERSONAL modality; `academic.session.start` validates teacher assignment and records attendance evidence.
- **Evidence / Reference:** PR #29, `lib/server/pendidikan-v2-service.ts`, `types/architecture-lock.ts`.

---

### DIR-2026-029 | Official Release Gate Model (Gates 0–9) and Gate 0 Artifact Contracts
- **Directive ID:** `DIR-2026-029`
- **Tanggal:** 2026-09-25
- **Keputusan Business Owner:** Urutan rilis resmi adalah Gate 0 hingga Gate 9. Titik siklus saat ini adalah PRE-GATE RECONCILIATION. Gate 0 mewajibkan artefak dump PostgreSQL logical (`STQ_PRODUCTION_T0.sql`) dan snapshot workbook T0 (`STQ_PRODUCTION_SNAPSHOT_T0.xlsx`) dengan tepat 15 sheet wajib.
- **Canonical Interpretation:** The release lifecycle is formally governed by sequential Gates 0 through 9:
  - **Gate 0:** Backup + checksum + isolated restore + restored-T0 XLSX snapshot
  - **Gate 1:** Production migrations (`prisma migrate deploy`)
  - **Gate 2:** Post-migration schema reconciliation
  - **Gate 3:** Foundation / provisioning
  - **Gate 4:** Post-provision reconciliation
  - **Gate 5:** Runtime activation
  - **Gate 6:** Readiness verification
  - **Gate 7:** Live UAT
  - **Gate 8:** Final gap / decommission verification
  - **Gate 9:** Evidence / sign-off / release baseline
  The current repository point is **PRE-GATE RECONCILIATION**. PR #29 and PR #30 code hardening ("Gate 5 remediation") do NOT constitute execution of Release Gate 5.
  Gate 0 companion artifact `STQ_PRODUCTION_SNAPSHOT_T0.xlsx` requires EXACTLY these 15 sheets:
  1. Manifest, 2. Santri, 3. User, 4. Staff, 5. Halaqoh, 6. SetoranTahfizh, 7. TargetSantri, 8. PerizinanSantri, 9. PelanggaranSantri, 10. MataPelajaran, 11. NilaiAkademik, 12. Assignments, 13. PositionCapabilities, 14. OrgUnits, 15. PrismaMigrations.
  No sheets may be omitted, renamed, or consolidated. This PRE-GATE task only documents this contract; zero production actions or Gate 0 executions are authorized.
- **Affected Domain:** GOVERNANCE / RELEASE_MANAGEMENT / AUDIT
- **Implementation Status:** `DOCUMENTED / RECONCILED`
- **Production Status:** `NOT_EXECUTED` (Gate 0 has not yet been executed; pending explicit authorization)
- **Supersedes / Superseded-By:** Supersedes ad-hoc release gate naming (e.g. Gate C2B, C2C, C2D) by standardizing on Gate 0–9
- **Acceptance Criteria:** Release documentation and runbooks uniformly reflect the Gate 0–9 execution sequence; Gate 0 artifact requirements define exactly 15 required sheets.
- **Evidence / Reference:** `STQ_Owner_Request_Register_2026-09-20.xlsx`, `docs/STQ_CURRENT_STATE.md`, `docs/STQ_M3_RELEASE_MANIFEST.md`.

---

## 3. 12-Point Owner Acceptance Matrix

This matrix evaluates Points 2 through 13 of the Business Owner directives, reporting current status across all dimensions truthfully and without false inflation.

| Point | Directive / Subject | Business Rule Status | Code Status | Backend Auth Status | UI Status | Production Status | Canonical Evidence & Technical Reality |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P02** | `musyirfah.putri` can see Tahfizh recap for ALL santri | `BUSINESS_DECISION_CONFIRMED` | `CODE_PARTIAL` | `BACKEND_NOT_AUTHORIZED` | `UI_NOT_COMPLETE` | `NOT_LIVE / UNVERIFIED` | `tahfizh.recap.read` scope `GLOBAL` defined in `types/architecture-lock.ts:599` and contract tests; server action `app/actions/tahfizh.ts` still uses legacy role checks; release train lacks `PositionCapability` seeding in production. |
| **P03** | Santri search/picker display = NAMA + KELAS only (no NIS/halaqoh) | `BUSINESS_DECISION_CONFIRMED` | `CODE_PARTIAL` | `N/A` | `UI_NOT_COMPLETE` | `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Code in `components/dashboard/dashboard-musyrif-tahfizh.tsx:783,978` still renders `({santri.nis})` in search result modals. Client UI cleanup required. Production behavior requires fresh verification. |
| **P04** | MT & PH update target in assigned halaqoh/scope only | `BUSINESS_DECISION_CONFIRMED` | `CODE_PARTIAL` | `BACKEND_NOT_AUTHORIZED` | `UI_COMPLETE` | `NOT_LIVE / UNVERIFIED` | Legacy halaqoh check exists in `app/actions/laporan-bulanan.ts:558` (`upsertTargetSantriAction`), but canonical ABAC capability `tahfizh.target.manage` evaluator is not yet wired to runtime action. |
| **P05** | Studi Umum & Kepesantrenan two distinct tracks | `BUSINESS_DECISION_CONFIRMED` | `CODE_COMPLETE` | `BACKEND_AUTHORIZED` | `UI_COMPLETE` | `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Enum `EducationTrack` (`STUDI_UMUM`, `KEPESANTRENAN`) defined in `prisma/schema.prisma:198` and tested. LAST_KNOWN_POINT_IN_TIME / release-train observation: server flag unset/false and migration `20260918140000_m3_3b_pendidikan_foundation` pending deployment at Gate C2B; REQUIRES_FRESH_READ_ONLY_VERIFICATION before Gate execution. |
| **P06** | Kepesantrenan teacher session start + HADIR/IZIN/SAKIT/ALFA | `BUSINESS_DECISION_CONFIRMED` | `CODE_COMPLETE` | `BACKEND_AUTHORIZED` | `UI_COMPLETE` | `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Implemented in `PendidikanV2Service` methods `startEducationSession` and `recordSessionAttendance` with tests. LAST_KNOWN_POINT_IN_TIME / release-train observation: production schema unapplied and server flag unset; REQUIRES_FRESH_READ_ONLY_VERIFICATION before Gate execution. |
| **P07** | Halaqoh attendance has NO MASBUK for new entries | `BUSINESS_DECISION_CONFIRMED` | `CODE_COMPLETE` | `N/A` | `UI_COMPLETE` | `REQUIRES_FRESH_READ_ONLY_VERIFICATION` | `FORBIDDEN_STATUSES: ["MASBUK"]` enforced in `tests/presensi.test.ts:122-137` and UI components. Production state requires fresh verification. |
| **P08** | Tahajjud business choices: SHOLAT & ALFA | `BUSINESS_DECISION_CONFIRMED` | `CODE_COMPLETE` | `BACKEND_AUTHORIZED` | `UI_COMPLETE` | `REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Enforced in `tests/presensi.test.ts:105-121`. Database enum `StatusAbsensi` contains `HADIR, IZIN, SAKIT, ALFA` (does not literally contain `SHOLAT`); persistence maps `SHOLAT` to `HADIR` with report notes. Production state requires fresh verification. |
| **P09** | `musyirfah.putri` perizinan PUTRI access (final workflow) | `BUSINESS_DECISION_CONFIRMED` | `CODE_PARTIAL` | `BACKEND_NOT_AUTHORIZED` | `UI_NOT_COMPLETE` | `NOT_LIVE / UNVERIFIED` | `keasramaan.permission.read` and `create` scoped to PUTRI; approval authority excluded (`types/architecture-lock.ts:601`). Legacy UI `perizinan-module.tsx` still uses legacy role switches and lacks multi-santri ticket expansion. |
| **P10** | Santriwati accounts created through controlled provisioning | `BUSINESS_DECISION_CONFIRMED` | `TARGET_DESIGNED` | `N/A` | `N/A` | `REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Governed by Gate C2C runbook (REL-ACC-03 in Release Manifest). HISTORICAL_OBSERVATION: zero santriwati accounts provisioned in release train; fresh read-only verification required. |
| **P11** | Tasmi'/Sima'an reward issuer: Mudir + Kabid ONLY (Lisa / POT superseded) | `BUSINESS_DECISION_CONFIRMED` | `CODE_COMPLETE` | `BACKEND_AUTHORIZED` | `UI_COMPLETE` | `NOT_LIVE / REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Enforced in `app/actions/reward-sanksi.ts` (`prosesRewardTasmiSimaanAction`) via legacy guard (`session.role === "KS" || Boolean(session.isKepalaBidangTahfidz)`) with feature-gated `shadowAuthorizeIfEnabled` parity evaluation (not live canonical cutover); runtime action behavior (success/message and unauthorized denial) is verified in `tests/reward-abac-fail-closed.test.ts`. Mudir (GLOBAL) and Kabid Tahfizh (DOMAIN) are authorized in target policy; canonical POT denial (`decision: "DENY"`, `code: "CAPABILITY_NOT_GRANTED"`) is verified in `tests/milestone3-3c1-real-postgres.test.ts` Section 5.1 (and Section 6.1). Prior target rule granting POT `ASSIGNED_UNITS` reward authority is formally SUPERSEDED per DIR-2026-023. Production status unverified by this task. |
| **P12** | Lisa cross-domain: Kepesantrenan PUTRI, Keasramaan PUTRI, Health PUTRI detail, OSDA monitor; no Studi Umum; no PUTRA | `BUSINESS_DECISION_CONFIRMED` | `CODE_PARTIAL` | `BACKEND_NOT_AUTHORIZED` | `UI_NOT_COMPLETE` | `NOT_LIVE / UNVERIFIED` | Scope boundaries modeled in architecture contracts; multi-domain services lack integrated runtime authorization for Lisa; release train lacks assignment seeding in production. |
| **P13** | Tahfizh setoran past date allowed, future rejected, default WITA | `BUSINESS_DECISION_CONFIRMED` | `CODE_COMPLETE` | `BACKEND_AUTHORIZED` | `UI_COMPLETE` | `REQUIRES_FRESH_READ_ONLY_VERIFICATION` | Implemented in `app/actions/tahfizh.ts:42` (`createSetoranAction`) and tested in `tests/milestone3-2-uat-business-rules.test.ts` Sec 11. Production state requires fresh live verification. |

---

## 4. Tahfizh — Primary Business Source Lock (`SOURCE-TAH-001`)

The Business Owner explicitly affirms that **`ACUAN PROGRAM TAHFIDZ STQ DUC 2026` (`SOURCE-TAH-001`)** is the primary business source for the Tahfizh program. Implementation must conform to it unless an explicit newer Business Owner decision supersedes it.

### Core Program Structure
1. **Program Objectives**: Mutqin memorization, muroja'ah habituation, quality evaluation, Qur'anic discipline and character.
2. **Program Components**:
   - `SABAQ`: Daily new memorization. Minimum 1/2 page or 1 page per day. Setoran conducted at Subuh halaqoh. Individual santri targets may differ.
   - `SABAQI`: Weekly revision of newly memorized material, automatically derived from authoritative valid stored SABAQ setoran records within the active temporal weekly window (from Monday/Senin 00:00 WITA up to effective reference/input timestamp, with valid stored SABAQ and all applicable temporal/baseline filters enforced). Business semantics require `isManualAllowed = false`. Manual overrides, fake fallbacks, or manual Sabaqi entry with audit reason are strictly prohibited and non-canonical (ORR-067 / DIR-2026-024):
     - Monday: Monday's memorization
     - Tuesday: Monday–Tuesday memorization
     - Wednesday: Monday–Wednesday memorization
     - Thursday: Monday–Thursday memorization
     - Friday: Monday–Friday memorization
   - `MANZIL`:
     - murojaah seluruh hafalan baru dari halaman pertama sampai halaman terakhir yang dihafal sebelum masuk proses Tasmi'
     - murojaah seluruh hafalan baru dari pekan pertama menghafal juz baru sampai pekan terakhir sebelum proses Tasmi'
   - `MUFAR`: Tiered volume repetition based on total memorization:
     - 1–5 Juz: 1 juz/day
     - 6–10 Juz: 2 juz/day
     - 11–15 Juz: 3 juz/day
     - 16–20 Juz: 4 juz/day
     - 21–30 Juz: 5 juz/day
   - `RUBU'`: Milestone evaluation per 1/4 juz.
   - `TASMI'`: Full 1 juz recitation.
   - `IKHTIBAR AWWAL`: First formal examination, administered by Musyrif Halaqoh.
   - `IKHTIBAR TSANI`: Second formal examination, administered by **Kepala Sekolah** (do NOT automatically translate "Kepala Sekolah" into Mudir or another Position unless separately approved/mapped).
   - `SIMA'AN`: Major milestone recitation conducted for every multiple of 5 juz, recited bil-ghaib in a single sitting.
3. **Weekly Targets (`Target Pekanan`)**:
   Determined according to each santri's assessment: 2 pages/week, 3 pages/week, 4 pages/week, or 5 pages/week.
4. **Rewards & Incentives**:
   - Tasmi' 1 Juz: 1 Bintang + Libur 1 Hari.
   - Sima'an 5 Juz: 1 Bintang + Libur 1 Hari.
   - Menyelesaikan target bulanan (Hafalan & keasamaan [sic; keasramaan]): libur di akhir bulan menyesuaikan variabel yang tercapai.
   - *Architecture Invariant*: Tahfizh reward ledger remains strictly independent from the Keasramaan reward ledger.
5. **Sanctions for Non-Achievement**:
   - Daily memorization target not achieved: **Jalan jongkok keliling lapangan pondok**.
   - Monthly memorization target not achieved: **Kehilangan hak kunjungan bulanan orang tua**.
   - *Governance Rule*: Do **NOT** silently soften, delete, or replace these sanctions merely because application code differs. Differences must be cataloged as `IMPLEMENTATION_DRIFT`.

---

## 5. Keasramaan & Santri Life Final Reconciliation (`SOURCE-KEA-001`)

### Organizational Hierarchy
$$\text{Mudir} \longrightarrow \text{Musyrif / Kepala Keasramaan} \longrightarrow \text{Mudabbir (Pembina Kamar)} \longrightarrow \text{OSDA \& TKS} \longrightarrow \text{Usroh / Santri}$$
- **Kepala Keasramaan** = Musyrif Keasramaan.
- **Musyrif $\neq$ Mudabbir**. Musyrif oversees the dormitories; Mudabbir serves as the room pembina (Pembina Kamar).
- A Mudabbir may hold multiple room/unit assignments.
- Takeover by a higher authority preserves the original assigned PIC in audit records.

### OSDA Structure (Final)
- **Pengurus Inti**: Ketua, Sekretaris, Bendahara, **Multimedia**.
- **Divisi** (Standardized to 5 Divisi):
  1. Keamanan & Kedisiplinan
  2. Pendidikan & Ibadah
  3. Kebersihan & Kerapihan
  4. Kesehatan
  5. Sarpras
  *(This SUPERSEDES older PRD structures where Multimedia was modeled as a 6th division).*
- **Pembina Divisi**: Appointed under Musyrif Keasramaan; outside formal OSDA student hierarchy; not subordinate to Ketua OSDA.
- **Usroh**: Structurally under OSDA. Divisi Kebersihan supervises cleaning functions only.

### TKS Units (Final)
- Exactly 6 units: **Dapur dan Gizi**, **Masjid**, **Kantor Pendidikan**, **Kantor Yayasan**, **Air Minum**, **Air Sumur**.
- No central "Ketua TKS".
- Dapur and Masjid may have local Ketua + Anggota. Other units may use one designated active petugas.
- Air Minum and Air Sumur remain strictly separate units.

### Checklist & Finding System
- Versioned checklist templates with scheduled runs (daily, multiple-times-per-day, weekly, monthly, incidental).
- Execution states: One official verification, Needs Correction, Completed. Late tasks remain open.
- Finding does **NOT** automatically become a discipline violation.
- Takeover preserves initial PIC.
- Offline flow uses `clientRequestId` for idempotency. Offline requirement belongs to checklist workflow; do not infer unrestricted offline storage for sensitive personal data.

### Discipline System
- **Baseline Source**: Pasal 7 Revisi 2 remains the immutable initial official baseline.
- **Rule Evolution**: Future changes by Musyrif require: new effective version, effective date, actor, reason, before/after diff, historical preservation.
- No automatic point multiplication for repeated violations unless source explicitly specifies it.
- Finding, late return, property damage, or loss does **NOT** automatically become a violation.
- **PJ Kategori 2**: Modeled as an Assignment, not a new Role or personal name permission.
- **Point Whitewash**: Performed monthly according to Pasal 7.
- **Surat Peringatan (ST)**: 3 active ST $\rightarrow$ SP1. Converted ST history is preserved. Unconverted active ST lifecycle/whitewash follows the agreed six-month/semester process.
- *Point monthly whitewash and ST semester lifecycle are SEPARATE processes.*

### Perizinan (Permit) Workflow (Final, NOT TBD)
- **Two Input Paths**:
  1. Santri self-request: individual permit ticket $\rightarrow$ status: waiting for decision (the Business Owner rule is that self-requests remain waiting for decision; technical enum mapping to legacy `MENUNGGU_MK` is current implementation behavior, not an immutable business rule).
  2. Mudabbir or Musyrif operational input: may select one or multiple santri $\rightarrow$ system generates one independent permit record **PER SANTRI**. No group permit entity in UI. `batchId` is audit metadata only.
- **Approval Authority**:
  - Created by Musyrif: directly `APPROVED`.
  - Same-day `Izin Keluar` recorded by Mudabbir: directly approved within Mudabbir authority.
  - `Pulang` / `Menginap` / vehicle-related permit recorded by Mudabbir: escalated to Musyrif.
  - Self-requested permit: remains pending until decision.
- **Lisa Access Scope**: `musyirfah.putri` receives operational permit read and submission capabilities strictly scoped to PUTRI. Operational read/create authority does NOT automatically grant permit approval authority. This distinction must not be misread as permit approval policy being TBD; the PRD approval flow is confirmed and final.
- **Return Confirmation**: Confirmed per santri. Late return sets an automatic late indicator, but does **NOT** automatically generate a discipline violation. Soft cancellation preserves actor, timestamp, and reason.

### Health (Poskestren)
- **Statuses**: `DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`.
- Diagnosis is optional; no fake diagnosis; error/empty states must **NEVER** be converted to fake "healthy".
- **Detail Access**: Health authorized operator, responsible Mudabbir, Musyrif Keasramaan. Ketua/Sekretaris OSDA receive aggregate statistics only by default.
- **Special Owner Decision**: `musyirfah.putri` may read detailed Health cases for **ALL SANTRIWATI** (PUTRI only).
- **Notifications**: `DIRUJUK` and `DARURAT` trigger notifications to Wali Santri under authorized control.
- **Inventory**: Health owns medical inventory. Sarpras handles repairs, but ownership remains with Health.

### Sarpras
- Main functions: Inventaris, Kerusakan & Perbaikan.
- Procurement workflow: Sarpras $\rightarrow$ Musyrif Keasramaan. Bendahara OSDA is **NOT** an approval or processing stage for Sarpras procurement.
- Kas Masjid belongs to TKS Masjid, not Bendahara OSDA.

---

## 6. Pendidikan Final Reconciliation (`SOURCE-PEND-001`, `SOURCE-PEND-002`)

### Dual Track Separation
Formal academic education is architecturally split into two distinct tracks: **STUDI UMUM** and **KEPESANTRENAN**.

### Studi Umum (Final)
1. **Session Schedule (Every Saturday)**:
   - JP I: 08:00–09:50 WITA
   - JP II: 10:00–11:50 WITA
   - JP III: 13:30–15:20 WITA
2. **Weekly Structure**:
   Every Saturday, each pedagogical level receives: Matematika, Bahasa Inggris, and PBL (Project-Based Learning).
3. **PBL Semester Sequence (20 Saturday Meetings, 4 Approved Subject Rotations)**:
   - Meetings 1–5: IPS
   - Meetings 6–10: IPA
   - Meetings 11–15: Bahasa Indonesia
   - Meetings 16–20: TIK
   *(Per ORR-131 / DIR-2026-025, approved canonical owner rule is purely this subject rotation. Invented pedagogical phases such as theory vs project weeks or phase enums are non-canonical).*
4. **Canonical Subjects**: Matematika, Bahasa Inggris, IPS, IPA, Bahasa Indonesia, TIK.
5. **Pedagogical Level & Cohort Definitions**:
   - `EducationCohort`: Permanent intake/year cohort (NOT gender, NOT SMP/SMA class, NOT age).
   - `PedagogicalLevel`: 1, 2, or 3 represents current Studi Umum learning level (not equivalent to SMP class 7/8/9). Levels outside 1–3 fail closed.
6. **Class Rotation Matrix**:
   - JP I: Level 1 English, Level 2 Math, Level 3 PBL
   - JP II: Level 1 Math, Level 2 PBL, Level 3 English
   - JP III: Level 1 PBL, Level 2 English, Level 3 Math
7. **Attendance Policy**: Studi Umum student attendance remains **DEFERRED** pending explicit policy.

### Kepesantrenan (Final)
1. **Schedule**: Monday through Friday, approximately 18:30–19:30 WITA (after Maghrib before Isya).
2. **Putra Schedule**:
   - **Monday**: Bahasa Arab (Tingkat I: Ust. Abi Hudzaifah; Tingkat II: Ust. Kamal Mukhtar; Tingkat III: Ust. Andi Quarzy Ayatullah; Book: *Durus al-Lughah*)
   - **Tuesday**: Fikih (Ust. Razan; reference currently unspecified unless separate authoritative source exists)
   - **Wednesday**: Tafsir (Ust. Mujaddid; Books: *Tafsir Terjemahan Per Kata*, *Tafsir Jalalain*)
   - **Thursday**: Aqidah (Ust. Alwan; reference currently unspecified unless separate authoritative source exists)
   - **Friday**: Tajwid (Ust. Mujaddid; Book: *Matan Tuhfatul Athfal*)
   *(This ordering SUPERSEDES older text having Tuesday Tafsir and Wednesday Fikih).*
3. **Putri Schedule**:
   All five Kepesantrenan subjects are taught by **Ustazah Lisa Dwina Fitri** for santriwati (Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid). This does **NOT** grant Lisa Studi Umum authority.
4. **Teacher Attendance**:
   - No separate manual teacher Hadir/Alfa form.
   - Canonical workflow: Authenticated assigned teacher sees scheduled session $\rightarrow$ clicks "Mulai Pembelajaran" $\rightarrow$ server evaluates canonical capability `academic.session.start` $\rightarrow$ session status becomes `STARTED` $\rightarrow$ teacher attendance proven.
   - Scheduled teacher and actual authenticated executor are stored separately.
   - Badal authorization matrix remains unresolved/quarantined.
5. **Lesson Material**:
   Only the actual authorized teacher of the active session may record lesson material (`academic.material.record`). No AI auto-completion of curriculum materials.
6. **Student Attendance**:
   Recorded under the active session; valid options are strictly: `HADIR`, `IZIN`, `SAKIT`, `ALFA` (NO MASBUK). Student must be an enrolled participant.
7. **Grading & Assessment**:
   Semester evaluations exist institutionally, but detailed grading contracts (TUGAS, UH, UTS, UAS weights, KKM, A/B/C/D, score formulas) are **NOT YET APPROVED**. Do not invent formulas in application logic.
8. **Program Pengabdian**:
   Institutional requirement of 1-year service following SMA completion is confirmed from education source, but application module for Pengabdian is **DEFERRED / NOT YET SPECIFIED**.

---

## 7. Maintenance & Evolution Protocol

When a new Business Owner directive is communicated:
1. Verify whether the directive alters or supersedes an entry in this registry or [`docs/STQ_REQUIREMENT_SOURCE_MAP.md`](docs/STQ_REQUIREMENT_SOURCE_MAP.md).
2. Assign the next sequential Directive ID (`DIR-YYYY-NNN`).
3. Record all ten mandatory attributes in Section 2 before writing application code.
4. If the directive supersedes an earlier entry, mark the earlier entry as `SUPERSEDED` and link both entries' `supersedes`/`superseded-by` fields.
5. Update affected technical contracts (`types/architecture-lock.ts`) and release manifests accordingly.
6. Never treat code availability as proof of production completion; maintain honest lifecycle statuses.
