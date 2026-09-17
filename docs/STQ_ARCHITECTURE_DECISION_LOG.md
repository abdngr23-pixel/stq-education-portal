# STQ ARCHITECTURE DECISION LOG (ADR)
**Authoritative Architectural Decision Records for the STQ Education Portal**  
**Document**: `docs/STQ_ARCHITECTURE_DECISION_LOG.md`  
**Status**: `ARCHITECTURE_LOCKED`

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
  Adopt granular capabilities (`<domain>.<entity>.<action>`) coupled to explicit `ScopeTypes` (`GLOBAL`, `DOMAIN`, `UNIT`, `ASSIGNED_UNITS`, `HALAQOH`, `KAMAR`, `OWN_CHILD`, `SELF`).
- **Consequences**:
  - Positive: Unambiguous, testable, and mathematically provable authorization boundaries.
  - Positive: Complete alignment with SOP and Business Owner directives.

---

## ADR-003: Positional Authority Originates Strictly from Active Assignments

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Authority was previously derived from relational heuristics (e.g. `halaqoh.pembinaId === session.staffId`) or flags (`isKepalaBidangTahfidz`).
- **Decision**:
  An individual holds authority if and only if there exists an active, non-expired `Assignment` linking their identity (`Staff` or `User`) to the relevant `Position` and `OrgUnit`.
- **Consequences**:
  - Positive: Revoking an assignment immediately removes authority without altering master staff records or code.
  - Positive: Full historical tracking of who held which position and when.

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

## ADR-007: Historical Audits Must Capture Technical Account and Human Executor

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Shared operational devices (such as Poskestren kiosk or TKS Dapur tablet) are operated by rotating student petugas or staff on shift.
- **Decision**:
  When mutations originate from a unit/kiosk account, the audit system must capture both the `technicalUserId` (kiosk login) and the verified `executorId` (person on shift).
- **Consequences**:
  - Positive: 100% forensic non-repudiation while supporting multi-user kiosks without repeated device relogin churn.

---

## ADR-008: Additive, Zero-Downtime Migration Phasing

- **Status**: **ACCEPTED**
- **Date**: 2026-09-17
- **Context**:
  Migrating a live educational portal with active students and parents requires zero downtime and zero regressions.
- **Decision**:
  Schema changes must be additive (Phase A). Legacy paths are bridged via Compatibility Adapters (Phase B), verified via shadow execution (Phase C), switched on writes (Phase D), and only cleaned up after full operational stability (Phase E).
- **Consequences**:
  - Positive: Zero risk of production downtime, zero risk of data loss.
