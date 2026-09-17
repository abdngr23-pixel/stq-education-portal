# STQ ARCHITECTURE DECISION LOG (ADR)
**Authoritative Architectural Decision Records for the STQ Education Portal**  
**Document**: `docs/STQ_ARCHITECTURE_DECISION_LOG.md`  
**Status**: `PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW`

---

## ADR-001: Global Role Is a Coarse Identity Category, Not an Organizational Position

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  The portal previously attempted to map every responsibility (e.g. Pembina Halaqoh, Guru Akademik, Musyrif Keasramaan) into the PostgreSQL `enum Role`. When new positions like Mudabbir and OSDA Petugas Kesehatan emerged, adding them to `enum Role` would cause database migrations, schema rigidities, and an unmanageable matrix explosion.
- **Decision**:
  The global `Role` enum is frozen as a coarse technical identity category (`STAFF`, `SANTRI`, `WALI`, `UNIT_ACCOUNT`). All functional duties, leadership titles, and specializations are modeled as `Positions` linked via `Assignments`.
- **Consequences**:
  - Positive: Zero schema migrations when institutional positions change or new divisions are established.
  - Positive: Natural support for staff holding multiple positions.
  - Negative: Requires looking up active assignments in addition to the base session role.

---

## ADR-002: Capability-and-Scope Based Authorization Architecture

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  The existing 5-level `PERMISSION_MATRIX` (`NONE`, `READ`, `CRUD`, `OWN_CHILD`, `OWN_SELF`) could not express fine-grained requirements (e.g., Admin TU can read and create health records, but cannot update medical statuses; Kabid Tahfizh can read global recaps but cannot write cross-halaqoh setorans).
- **Decision**:
  Adopt granular capabilities (`<domain>.<entity>.<action>`) coupled to explicit `ScopeTypes` (`GLOBAL`, `DOMAIN`, `UNIT`, `ASSIGNED_UNITS`, `HALAQOH`, `KAMAR`, `OWN_CHILD`, `SELF`). Capability evaluation strictly precedes scope evaluation; holding `GLOBAL` scope on a capability confers zero authority over unrelated capabilities.
- **Consequences**:
  - Positive: Unambiguous, testable, and mathematically provable authorization boundaries.
  - Positive: Complete alignment with SOP and Business Owner directives.

---

## ADR-003: Positional Authority Originates Strictly from Active Assignments & Deterministic Subject

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Authority was previously derived from relational heuristics or flags. Furthermore, early assignment designs allowed nullable dual ownership (`userId?`, `staffId?`), leading to ambiguous subject integrity.
- **Decision**:
  An individual holds authority if and only if there exists an active, non-expired `Assignment` linking their authenticated `User` record (`userId: String` required foreign key) to the relevant `Position` and `OrgUnit`. Multi-unit assignments are modeled relationally via `AssignmentScopeUnit` instead of free-form string arrays.
- **Consequences**:
  - Positive: Deterministic subject integrity. Revoking an assignment immediately removes authority.
  - Positive: Full relational FK constraints on multi-unit scope bindings.

---

## ADR-004: Server-Side Enforcement Is Strictly Authoritative Over UI Presentation

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  In earlier versions, some restrictions relied partially on conditional UI rendering, creating vulnerabilities if API endpoints were called directly.
- **Decision**:
  All authorization checks MUST be enforced server-side inside Server Actions and Route Handlers. UI hiding is strictly an ergonomic feature for user experience.
- **Consequences**:
  - Positive: Absolute resistance against API tampering, direct POST submissions, or client state manipulation.

---

## ADR-005: Functional Specializations Must Not Proliferate Global Enums

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Requests frequently arise to add special flags or roles (e.g., "Role: MUDABBIR", "Role: OSDA_KESEHATAN", "isPetugasPresensiPutri").
- **Decision**:
  Specialized roles must be created as records in the `Position` table with appropriate capability sets, assigned to specific `OrgUnits`. No new enum values or table boolean columns may be introduced for operational roles.
- **Consequences**:
  - Positive: Clean, stable database schema with zero schema drift.

---

## ADR-006: Personal Names and Usernames Must Never Confer Authority

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  During rapid audits, heuristics checking `username === 'musyrif.tahfizh'` or `name.includes('Razan')` were tempted.
- **Decision**:
  It is strictly forbidden to inspect personal names, usernames, or email strings to authorize operations. Authority derives strictly from database-backed `Assignments`.
- **Consequences**:
  - Positive: Eliminates impersonation, typo vulnerability, and fragile hardcoded logic.

---

## ADR-007: Historical Audits Must Capture Technical Account and Verified Human Executor

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Shared operational devices (such as Poskestren kiosk or TKS Dapur tablet) are operated by rotating student petugas or staff on shift. Free-text name entry alone is insufficient for non-repudiation.
- **Decision**:
  When mutations originate from a unit/kiosk account, the audit system must capture both the `technicalAccountId` (kiosk login) and the verified `humanExecutorId` (verified against active staff/santri records). Additionally, audit records capture an immutable snapshot of `positionCode`, `capabilityCode`, `unitId`, and `scopeType` at execution time so that future organizational reorganizations cannot alter historical audit meaning.
- **Consequences**:
  - Positive: 100% forensic non-repudiation and permanent historical audit integrity.

---

## ADR-008: Additive, Controlled Migration Phasing

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Migrating a live educational portal with active students and parents requires zero downtime and zero regressions.
- **Decision**:
  Schema changes must be additive (Phase A, classified as LOW / CONTROLLED operational risk). Legacy paths are bridged via Compatibility Adapters (Phase B), verified via shadow execution (Phase C), switched on writes with a feature-flag rollback path (Phase D), and only cleaned up after full operational stability (Phase E).
- **Consequences**:
  - Positive: Controlled risk, verified data parity before authoritative switch, and instant zero-deployment feature-flag fallback.

---

## ADR-009: Canonical Hierarchy of Authority & Health Granularity Standard

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Multiple documentation artifacts and type definitions must maintain absolute consistency without specification drift. Furthermore, health capabilities previously conflated aggregate dashboard visibility with detailed clinical record access, and status updates used non-standard naming.
- **Decision**:
  1. Establish a 3-level Hierarchy of Authority: Level 1 (TypeScript contracts in `types/architecture-lock.ts`) is the executable source of truth; Level 2 (Master specification in `docs/STQ_ARCHITECTURE_LOCK.md`) is authoritative for system boundaries; Level 3 (Domain docs) provides specialized deep-dives.
  2. Health capabilities are standardized to 5 granular capabilities strictly following `<domain>.<entity>.<action>`: `health.case.read_aggregate`, `health.case.read_detail`, `health.case.create`, `health.case.update_status`, and `health.case.referral`.
  3. Candidate Prisma models must mirror runtime contracts with 100% parity, utilizing native database enums rather than bare strings.
- **Consequences**:
  - Positive: Guarantees zero divergence across all documents, schemas, and contract tests. Protects sensitive medical records while enabling aggregate operational dashboards.

