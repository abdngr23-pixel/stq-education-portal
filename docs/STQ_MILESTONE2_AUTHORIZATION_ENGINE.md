# STQ ARCHITECTURE LOCK — MILESTONE 2: COMPATIBILITY & CANONICAL AUTHORIZATION ENGINE

**Status**: `ARCHITECTURE_LOCKED`  
**Approved Baseline Date**: `2026-09-17`  
**Milestone**: `MILESTONE 2 — COMPATIBILITY + AUTHORIZATION ENGINE`  
**Repository**: `abdngr23-pixel/stq-education-portal`  
**Canonical Starting Main Baseline**: `bf2ceba5538734b7a456a41d4115a6ca07756a0f`  
**Immutable PR #8 Anchor**: `9068cae5587b7219c394c5c25bf0de07a15b0726`  

---

## 1. Executive Summary & Mission

Milestone 2 implements the canonical authorization engine and compatibility infrastructure defined by the locked STQ Architecture specification.

### Core Architecture Invariant:
> **LEGACY AUTHORIZATION REMAINS 100% AUTHORITATIVE AT RUNTIME.**  
> The canonical authorization engine operates strictly in **SHADOW / PARITY MODE** during Milestone 2.  
> Real runtime user permissions, session validation, and server action guards (`requireRole`, ABAC helpers) remain completely unchanged and authoritative.

### Milestone 2 Guarantees:
- **Production Migrations**: `0`
- **Production Seeds**: `0`
- **Production Backfills**: `0`
- **Production Business Writes**: `0`
- **Runtime Authority Switch**: `NOT ACTIVATED` (Shadow / Parity Only)
- **PR #8 Immutability**: `VERIFIED & UNTOUCHED` (`9068cae5587b7219c394c5c25bf0de07a15b0726`)

---

## 2. Authorization Engine Pipeline

The canonical authorization architecture evaluates access strictly along the canonical chain:

```
Identity (User / AccountType)
  └── Assignment (Status: ACTIVE, Window: validFrom..validUntil, Anchor Unit)
        └── Position (Code, Domain, Leadership)
              └── PositionCapability (CapabilityCode, ScopeType, BusinessRuleState: VERIFIED_PRODUCTION)
                    └── Scope Predicate (GLOBAL | DOMAIN | UNIT | ASSIGNED_UNITS | HALAQOH | KAMAR | OWN_CHILD | SELF)
                          └── Server-Hydrated Resource Context (orgUnitIds, genderComplex, halaqohId, etc.)
                                └── Dual-Attribution Audit & Parity Telemetry (Zero PII)
```

---

## 3. Component Architecture & File Inventory

All Milestone 2 engine code is cleanly encapsulated under `lib/auth/`:

| Component File | Role & Invariants |
| :--- | :--- |
| [`lib/auth/compatibility.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/compatibility.ts) | Transitional compatibility mapping from 10 legacy roles and operational flags to canonical positions and domains. Non-authoritative by itself. |
| [`lib/auth/scope-evaluator.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/scope-evaluator.ts) | Pure and server-hydrated scope evaluation across all 8 canonical `ScopeType`s plus gender complex containment (`GENDER_COMPLEX_DENIED`). |
| [`lib/auth/canonical-evaluator.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/canonical-evaluator.ts) | Authoritative multi-grant evaluator enforcing **The Activation Triple**. Fail-closed on unauthenticated, inactive, or database error states (`DATABASE_UNAVAILABLE`). |
| [`lib/auth/unit-account.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/unit-account.ts) | `AccountType.UNIT` single placement invariant enforcement, multi-device station semantics, and mandatory verified `humanExecutorId` for mutations. |
| [`lib/auth/canonical-audit.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/canonical-audit.ts) | Forensic execution snapshot logger capturing dual attribution (technical account + human executor). Pluggable in-memory sink prevents production DB writes. |
| [`lib/auth/shadow-engine.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/shadow-engine.ts) | Dual-evaluates legacy check vs canonical authorization. Records structured telemetry (`MATCH_ALLOW`, `MATCH_DENY`, `MISMATCH_LEGACY_ALLOW`, `MISMATCH_CANONICAL_ALLOW`, `ERROR`) while strictly returning legacy authority as runtime outcome. Zero PII. |
| [`lib/auth/backfill-dry-run.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/lib/auth/backfill-dry-run.ts) | Pure deterministic planning engine generating proposed canonical OrgUnits, Positions, Assignments, and Capabilities without database writes. Uncertain mappings default to `DRAFT` and `PROPOSED_TBD`. |

---

## 4. Compatibility Layer Mapping Architecture

The compatibility layer bridges the legacy metadata roles (`KS`, `ADM`, `MK`, `MT`, `PH`, `GA`, `OSDA`, `WS`, `ST`, `YAY`) and operational flags to the canonical positions defined in `STQ_COMPATIBILITY_MAP.md`.

### 4.1. Legacy Role Mapping Table

| Legacy Role | Canonical Default Position | Org Domain | Account Type | Leadership? |
| :--- | :--- | :--- | :--- | :--- |
| `KS` | `MUDIR` | `INSTITUTIONAL` | `PERSONAL` | Yes |
| `ADM` | `STAF_ADMIN_TU` | `MANAJEMEN` | `PERSONAL` | No |
| `MK` | `KEPALA_KEASRAMAAN` | `KEASRAMAAN` | `PERSONAL` | Yes |
| `MT` | `MUSYRIF_TAHFIZH` | `TAHFIZH` | `PERSONAL` | No |
| `PH` | `PEMBINA_HALAQOH` | `TAHFIZH` | `PERSONAL` | No |
| `GA` | `GURU_AKADEMIK` | `AKADEMIK` | `PERSONAL` | No |
| `OSDA` | `ANGGOTA_OSDA` | `KEASRAMAAN` | `UNIT` | No |
| `WS` | `WALI_SANTRI` | `MANAJEMEN` | `PERSONAL` | No |
| `ST` | `SANTRI` | `AKADEMIK` | `PERSONAL` | No |
| `YAY` | `PENGURUS_YAYASAN` | `INSTITUTIONAL` | `PERSONAL` | Yes |

### 4.2. Operational Flag Resolution
- **`Staff.isKepalaBidangTahfidz`**: Elevates subject's effective position to `KABID_TAHFIZH` in domain `TAHFIZH` (Leadership: true). Ordinary `MT` without this flag receives `MUSYRIF_TAHFIZH` without domain-wide leadership.
- **`User.isPetugasPresensiPutri`**: Maps subject to operational position `PETUGAS_PRESENSI` in domain `KEASRAMAAN`.
- **Fail-Closed Boundary**: Any unrecognized or arbitrary role value strictly fails closed to `UNMAPPED_LEGACY_ROLE`.

---

## 5. The Activation Triple & Fail-Closed Closure

Under canonical STQ architecture, authority is never granted by a single scalar role or ad-hoc boolean. A user is permitted access if and **ONLY IF** all three deliberate conditions of **The Activation Triple** are met:

1. **Assignment Status is Strictly `ACTIVE`**:
   - `DRAFT`, `SUSPENDED`, `EXPIRED`, and `REVOKED` assignments confer **ZERO** runtime authority.
   - Assignment time window must satisfy `validFrom <= now` and (`validUntil === null` or `validUntil >= now`).
2. **PositionCapability BusinessRuleState is `VERIFIED_PRODUCTION`**:
   - `PROPOSED_TBD` confers **ZERO** runtime authority.
   - `APPROVED_TARGET_PENDING_TECHNICAL` confers **ZERO** runtime authority in production.
3. **Explicit Canonical `ScopeType` Declared**:
   - Missing, undefined, or pseudo-scopes fail closed (`SCOPE_MISMATCH`).
   - Target resource context must strictly satisfy the scope predicate.

### Database Error Fail-Closed Guarantees:
If the underlying database or data provider fails during assignment resolution, context hydration, or executor verification:
- Evaluator returns `{ decision: "ERROR", code: "SYSTEM_FAIL_CLOSED", reasonCode: "DATABASE_UNAVAILABLE" }`.
- Evaluator **NEVER** silently collapses exceptions to `false`, `0`, or `[]`.

---

## 6. Canonical Scope Evaluation Engine

The scope engine evaluates access across 8 canonical scope types against server-hydrated resource attributes:

| ScopeType | Semantics & Boundaries | Fail-Closed Reject Code |
| :--- | :--- | :--- |
| `GLOBAL` | Institutional breadth for the granted capability code. | `SCOPE_MISMATCH` (if grant invalid) |
| `DOMAIN` | Permitted across all units within the position's strategic domain (e.g. `TAHFIZH`, `KEASRAMAAN`). Cross-domain access is denied. | `SCOPE_MISMATCH` |
| `UNIT` | Direct anchor unit containment. Target must match assignment `unitId`. | `SCOPE_MISMATCH` |
| `ASSIGNED_UNITS` | Relationally bound multi-unit set (via `AssignmentScopeUnit`). Target unit must be contained in permitted set. | `SCOPE_MISMATCH` |
| `HALAQOH` | Ordinary Musyrif Tahfizh bound strictly to assigned halaqoh (`halaqohId`). | `SCOPE_MISMATCH` |
| `KAMAR` | Mudabbir bound strictly to assigned dormitory room (`kamarId`). | `SCOPE_MISMATCH` |
| `OWN_CHILD` | Wali Santri accessing relationally linked children (`guardianLinkedSantriIds`). Access to other students is denied. | `SCOPE_MISMATCH` |
| `SELF` | Subject strictly bound to their personal record (`userId` or `santriId`). Access to other profiles is denied. | `SCOPE_MISMATCH` |

### Gender Complex Boundary Containment:
- A grant bound to `PUTRA` cannot access a `PUTRI` resource unit (`GENDER_COMPLEX_DENIED`).
- A grant bound to `PUTRI` cannot access a `PUTRA` resource unit (`GENDER_COMPLEX_DENIED`).
- `CAMPUR` and `TIDAK_TERIKAT` units permit bidirectional access.

---

## 7. Unit Account Semantics & Dual Attribution

`AccountType.UNIT` addresses shared kiosk, station, or tablet accounts (e.g., dormitory attendance kiosk, clinic intake terminal):

1. **Single Placement Invariant**:
   - Each Unit Account must be bound to exactly **ONE** operational unit via `UnitAccountPlacement` (`userId` `@unique`).
2. **Multi-Device Support**:
   - Simultaneous sessions across multiple physical devices are permitted for station operation.
3. **Read vs Mutation Attribution**:
   - **Read-only operations** (e.g., station attendance display) are permitted under technical account identity.
   - **State mutations** strictly require a verified human executor context:
     * `humanExecutorId` must be non-empty and verified as an `AKTIF` user.
     * Omission of human executor triggers fail-closed rejection: `UNIT_EXECUTOR_REQUIRED`.
     * Inactive human executor triggers: `UNIT_EXECUTOR_INVALID`.
     * Unit placement mismatch triggers: `UNIT_PLACEMENT_MISMATCH`.

---

## 8. Forensic Audit Snapshot Logging

Canonical audit records provide immutable execution history surviving staff reassignments:
- **Dual Attribution**: Captures `technicalAccountId`, `technicalAccountUsername`, `humanExecutorId`, `humanExecutorName`.
- **Granular Context**: Captures `capabilityCode`, `positionCode`, `scopeType`, `unitId`, `beforeState`, `afterState`, `resourceContext`, `reason`.
- **Pluggable Architecture**:
  * `InMemoryAuditSink`: Default sink used during tests and shadow mode to guarantee **zero production database writes**.
  * `PrismaAuditSink`: Production sink gated behind explicit activation flag (`ENABLE_CANONICAL_AUDIT_WRITES=true`).

---

## 9. Shadow Mode & Parity Engine

The shadow engine enables live telemetry and validation without altering existing system behavior:

```ts
const { runtimeAllowed, parityRecord, canonicalDecision } = await evaluateShadowAuthorization({
  session,
  capabilityCode: "tahfizh.setoran.create",
  legacyCheck: () => requireRole(session, ["MT", "PH"]), // 100% authoritative!
  resourceContext: { halaqohId: "hlq-1" },
});
```

### Parity Classifications:
1. `MATCH_ALLOW`: Both legacy and canonical permit access (`runtimeAllowed = true`).
2. `MATCH_DENY`: Both legacy and canonical deny access (`runtimeAllowed = false`).
3. `MISMATCH_LEGACY_ALLOW`: Legacy permits, canonical denies (e.g. unverified business rule or missing assignment). **Legacy authority is strictly preserved** (`runtimeAllowed = true`).
4. `MISMATCH_CANONICAL_ALLOW`: Canonical permits, legacy denies. **Legacy authority is strictly preserved** (`runtimeAllowed = false`).
5. `ERROR`: Database or evaluation exception. **Legacy authority is preserved or fails closed**.

### Privacy Guarantee:
Parity telemetry logs **NEVER** expose student or guardian PII (passwords, phone numbers, NIK, or health diagnoses are excluded).

---

## 10. Automated Parity Matrix (24 Verified Scenarios)

The test suite in [`tests/milestone2-authorization-engine.test.ts`](file:///d:/stq-education-portal-antigravity/stq-education-portal/tests/milestone2-authorization-engine.test.ts) proves full parity across 24 distinct scenarios:

| # | Scenario Description | Position / Role | Capability | Scope | Rule State | Status | Expected | Reason Code |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Mudir Institutional Reward Issue | `MUDIR` (`KS`) | `tahfizh.reward.issue` | `GLOBAL` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 2 | Mudir Reward Policy Edit | `MUDIR` (`KS`) | `tahfizh.reward.policy.edit` | `GLOBAL` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 3 | Kabid Tahfizh Reward Issue in Domain | `KABID_TAHFIZH` (`MT`) | `tahfizh.reward.issue` | `DOMAIN` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 4 | Kabid Tahfizh Policy Edit (Denied) | `KABID_TAHFIZH` (`MT`) | `tahfizh.reward.policy.edit` | `DOMAIN` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `CAPABILITY_NOT_GRANTED` |
| 5 | MT Setoran Create in Assigned Halaqoh | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.setoran.create` | `HALAQOH` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 6 | MT Setoran Create in Other Halaqoh | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.setoran.create` | `HALAQOH` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `SCOPE_MISMATCH` |
| 7 | MT Reward Issue (Denied) | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.reward.issue` | `HALAQOH` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `CAPABILITY_NOT_GRANTED` |
| 8 | KS Health Record Create | `MUDIR` (`KS`) | `health.record.create` | `GLOBAL` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 9 | MK Health Record Update Status | `KEPALA_KEASRAMAAN` (`MK`) | `health.record.update_status` | `DOMAIN` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 10 | ADM Health Record Create | `STAF_ADMIN_TU` (`ADM`) | `health.record.create` | `GLOBAL` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 11 | ADM Health Record Update Status (Denied) | `STAF_ADMIN_TU` (`ADM`) | `health.record.update_status` | `GLOBAL` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `CAPABILITY_NOT_GRANTED` |
| 12 | GA Academic Grade Edit in Assigned Class | `GURU_AKADEMIK` (`GA`) | `academic.grade.edit` | `ASSIGNED_UNITS` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 13 | GA Health Record Create (Denied) | `GURU_AKADEMIK` (`GA`) | `health.record.create` | `ASSIGNED_UNITS` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `CAPABILITY_NOT_GRANTED` |
| 14 | PH Halaqoh View | `PEMBINA_HALAQOH` (`PH`) | `tahfizh.monitoring.view` | `HALAQOH` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 15 | Generic OSDA Health Access (Denied) | `ANGGOTA_OSDA` (`OSDA`) | `health.record.view_scoped` | `UNIT` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `CAPABILITY_NOT_GRANTED` |
| 16 | WS Own Child Rapor View | `WALI_SANTRI` (`WS`) | `santri.rapor.view` | `OWN_CHILD` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 17 | WS Other Child Rapor View (Denied) | `WALI_SANTRI` (`WS`) | `santri.rapor.view` | `OWN_CHILD` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `SCOPE_MISMATCH` |
| 18 | ST Self Profile Read | `SANTRI` (`ST`) | `santri.profile.view` | `SELF` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 19 | ST Other Santri Profile Mutation (Denied) | `SANTRI` (`ST`) | `santri.profile.edit` | `SELF` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `SCOPE_MISMATCH` |
| 20 | Unit Account Kiosk Read without Executor | `ANGGOTA_OSDA` (`OSDA`) | `keasramaan.presensi.view` | `UNIT` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ALLOW** | `ALLOWED` |
| 21 | Cross-Gender Complex Violation | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.setoran.create` | `HALAQOH` | `VERIFIED_PRODUCTION` | `ACTIVE` | **DENY** | `GENDER_COMPLEX_DENIED` |
| 22 | Draft Assignment Status | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.setoran.create` | `HALAQOH` | `VERIFIED_PRODUCTION` | `DRAFT` | **DENY** | `NO_ACTIVE_ASSIGNMENTS` |
| 23 | Unverified Rule State PROPOSED_TBD | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.setoran.create` | `HALAQOH` | `PROPOSED_TBD` | `ACTIVE` | **DENY** | `CAPABILITY_NOT_GRANTED` |
| 24 | DB Failure on Assignment Query | `MUSYRIF_TAHFIZH` (`MT`) | `tahfizh.setoran.create` | `HALAQOH` | `VERIFIED_PRODUCTION` | `ACTIVE` | **ERROR** | `DATABASE_UNAVAILABLE` |

---

## 11. Safety Commitments & Quality Verification

All quality gates have been executed and passed:
- `npx prisma validate`: **PASS** (Schema valid)
- `npx prisma generate`: **PASS** (Prisma Client updated)
- `npm run typecheck`: **PASS** (0 TypeScript errors)
- `npm run typecheck:test`: **PASS** (0 Test TypeScript errors)
- `npx tsx --test tests/milestone2-authorization-engine.test.ts`: **PASS** (58/58 tests passed)
- `npx tsx --test tests/architecture-lock-contracts.test.ts`: **PASS** (Phase 1 and Phase 2A contracts intact)
- PR #8 Immutability: **PASS** (`9068cae5587b7219c394c5c25bf0de07a15b0726` untouched)
- Production Safety: **PASS** (0 production migrations, 0 backfills, 0 seeds, 0 mutations)
