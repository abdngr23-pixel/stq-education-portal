# STQ ARCHITECTURE LOCK — MILESTONE 3: CHECKPOINT M3.3A
## HEALTH V2 BACKEND FOUNDATION & CANONICAL DATA MODEL SPECIFICATION

**Repository**: `abdngr23-pixel/stq-education-portal`  
**Document**: `docs/STQ_MILESTONE3_3A_HEALTH_V2_BACKEND.md`  
**Status**: `M3_3A_AUDIT_READY`  
**Canonical Main Baseline**: `f87b53826c660bbaf13ae134a74bfe26ae94a1be`  
**PR #8 Immutable Baseline**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (Strictly Open, Draft, Unmerged)  
**Date**: `2026-09-18`

---

## 1. Executive Summary & Checkpoint Scope

Checkpoint M3.3A establishes the **additive backend foundation** for Health (Poskestren) V2 without altering legacy production runtime execution or mutating historical data.

### Scope Boundaries:
- **IN SCOPE**:
  - Additive database table `health_cases_v2` and enum `HealthStatusV2`.
  - Canonical 4-status vocabulary: `DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`.
  - Legacy action data honesty correction: removal of fake default diagnosis `'Pemeriksaan awal asrama'`.
  - Deterministic read-only status bridge (`mapLegacyHealthStatusToV2`).
  - Server-only domain service (`lib/server/health-v2-service.ts`) with dual attribution and audit logging.
  - Granular privacy separation (aggregate operational statistics vs clinical detail access).
  - Explicit KAMAR-scoped boundary for Pembina Asrama and exclusion of generic OSDA from clinical details.
  - Invariant definitions for referral authority (`PROPOSED_TBD`), daily health checklist, and inventory boundaries.
  - End-to-end migration lineage simulation in `tests/test-db-manager.ts`.
- **STRICTLY OUT OF SCOPE**:
  - Full OSDA workflow, TKS operational actions, and Usroh taskforces.
  - Kepesantrenan attendance implementation.
  - Production authorization cutover (legacy actions remain authoritative; new table is non-active in production).
  - Mutating or backfilling production database tables.

---

## 2. Legacy Health Model vs. Health V2 Model

### 2.1. Comparison Matrix
| Architectural Aspect | Legacy Health Model (`CatatanKesehatan`) | Health V2 Foundation (`HealthCaseV2`) |
| :--- | :--- | :--- |
| **Primary Table** | `catatan_kesehatan` | `health_cases_v2` (Additive) |
| **Status Vocabulary** | `StatusKesehatan` (`RAWAT_PONDOK`, `DIRUJUK_PUSKESMAS`, `DIRUJUK_RS`, `SEMBUH`) | `HealthStatusV2` (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`) |
| **Diagnosis Field** | Required by UI action fallback (`'Pemeriksaan awal asrama'`) | Optional by design: persists actual diagnosis if entered, or `NULL` if omitted. Zero fake defaults. |
| **Attribution** | Implicit / untracked recorded by staff | Explicit dual attribution: `recordedByUserId` (technical account) + verified `humanExecutorId` when using `UNIT` accounts. |
| **Audit Context** | None | Full audit trail: actor, assignment, capability, scope, target santri, previous status, new status, occurredAt, createdAt. |
| **Production State** | Authoritative in live production | Non-active backend foundation; tested in isolation; ready for Phase B cutover. |

### 2.2. Data Honesty Correction on Legacy Action
In `app/actions/kesehatan.ts`, `catatKesehatanAction` previously defaulted an empty diagnosis to `'Pemeriksaan awal asrama'`. This violated data honesty by attributing an unperformed clinical examination.
**Correction applied**:
```typescript
diagnosa: formData.diagnosa?.trim() || null,
```
If diagnosis is omitted or blank, `NULL` is persisted. No fake clinical examination is ever fabricated.

---

## 3. Deterministic Legacy Status Bridge

The helper `mapLegacyHealthStatusToV2(legacyStatus)` in `lib/health-v2.ts` provides a deterministic, read-only compatibility mapping between legacy `StatusKesehatan` and canonical `HealthStatusV2`:

$$\text{Legacy Status} \longrightarrow \text{V2 Canonical Result}$$

| Legacy Value | Mapped V2 Result | Determinism Guarantee | Semantic Rationale |
| :--- | :--- | :--- | :--- |
| `RAWAT_PONDOK` | `DIPANTAU` | **Deterministic** | Patient is actively being monitored inside pondok UKS / dormitory. |
| `SEMBUH` | `PULIH` | **Deterministic** | Recovery completed; returned to normal santri routines. |
| `DIRUJUK_PUSKESMAS` | `DIRUJUK` | **Deterministic** | Patient transferred to primary local health clinic. |
| `DIRUJUK_RS` | `DIRUJUK` | **Deterministic** | Patient transferred to secondary/tertiary hospital. |
| `PULANG` | `REVIEW_REQUIRED` | **Explicit Flag** | Ambiguous historical status; requires clinical and administrative review before classification. |
| *Null / Undefined / Unknown* | `UNKNOWN` | **Safe Fallback** | Prevents speculative mapping or data fabrication. |

> [!IMPORTANT]
> **Strict Read-Only Invariant**:
> The status bridge is strictly for read-time interpretation and analytical reporting. It **NEVER** mutates existing database rows or rewrites historical records.

---

## 4. Privacy Boundaries & Scope Matrix

Health information contains sensitive, protected personal medical details. Access control enforces strict separation between aggregate visibility and clinical detail visibility.

### 4.1. Granular Capabilities
1. `health.case.read_aggregate`: View anonymized statistical metrics (total cases, counts by status, gender trends). Zero clinical notes, zero diagnoses, zero attachments.
2. `health.case.read_detail`: View full clinical case history (complaints, initial treatment, diagnosis, medical notes, documents).
3. `health.case.create`: Record new illness/incident case.
4. `health.case.update_status`: Transition status between canonical statuses (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`).
5. `health.case.referral`: External referral authorization (`PROPOSED_TBD`).

### 4.2. Position & Scope Authorization Matrix
| Position / Role | Capability Grants | Scope Type | Scope Boundary Rules |
| :--- | :--- | :--- | :--- |
| `PETUGAS_KESEHATAN` | `health.case.read_detail`<br/>`health.case.read_aggregate`<br/>`health.case.create`<br/>`health.case.update_status` | `GLOBAL` | Dedicated clinical health staff. Authorized across entire institution. Target grant state: `APPROVED_TARGET_PENDING_TECHNICAL`. |
| `PEMBINA_ASRAMA` | `health.case.read_detail`<br/>`health.case.read_aggregate`<br/>`health.case.create` | `KAMAR` | Dormitory room supervisors. Strictly scoped to santri with active placement in their assigned `kamarId`. Attempting to view cases for santri in other rooms triggers `OUT_OF_SCOPE_ACCESS_DENIED`. |
| `OSDA` Generic | `health.case.read_aggregate` (if assigned) | `UNIT` | Generic student organization members possess **ZERO** clinical detail capability (`DETAIL_ACCESS_DENIED`). |
| `OSDA_KESEHATAN` Unit Account | `health.case.create`<br/>`health.case.update_status` | `GLOBAL` (operational) | Multi-device tablet account for Poskestren. Requires verified human executor on every mutation (`UNIT_EXECUTOR_REQUIRED`). |
| `MUDIR` (`KS`) / `KEPALA_KEASRAMAAN` (`MK`) | Full administrative oversight | `GLOBAL` / `DOMAIN` | Institutional leadership oversight. |

> [!CAUTION]
> **Aggregate Does NOT Imply Detail**:
> Possessing `health.case.read_aggregate` confers **zero** access to clinical details. Any request to `getHealthCaseV2DetailCore` without explicit `health.case.read_detail` capability is immediately rejected with `DETAIL_ACCESS_DENIED`.

---

## 5. Dual Attribution & Unit Account Security

To support shared kiosk/tablet devices at the Poskestren desk while maintaining non-repudiation:
1. **Technical Account Attribution**: `recordedByUserId` captures the user account authenticated to the session (e.g., `osda.kesehatan.putra`).
2. **Human Executor Attribution**: `humanExecutorId` and `humanExecutorUsername` capture the verified individual operating the terminal.
3. **Fail-Closed Policy (`UNIT_EXECUTOR_REQUIRED`)**:
   Any mutation (`create` or `update_status`) originating from an account with `accountType === "UNIT"` without a verified human executor throws:
   ```
   UNIT_EXECUTOR_REQUIRED: Unit accounts recording health cases require a verified human executor.
   ```

---

## 6. Institutional Invariants & Deferred Policies

### 6.1. Referral Authority (`health.case.referral`)
- **Current State**: `PROPOSED_TBD`.
- **Policy Invariant**: The external hospital/puskesmas referral sign-off matrix (requiring formal parental notification, financial authorization, and transport logistics) is not yet finalized by institutional leadership. Updating an operational status to `DIRUJUK` does NOT constitute formal external referral issuance.

### 6.2. Daily Health Checklist Invariant
- **Business Rule**: Exactly **one general health checklist per operational day** across dormitories.
- **M3.3A Boundary**: Checkpoint M3.3A defines the business invariant only (`HEALTH_V2_INVARIANTS.DAILY_CHECKLIST_POLICY`). Code introduces **zero** invented checklist questions or premature schema tables until approved by institutional leadership.

### 6.3. Health Inventory Boundary Invariant
- **Business Rule**: Poskestren/Health owns all medical supplies, first-aid kits, and medicine inventory records and logs operational consumption.
- **Maintenance Boundary**: Any maintenance, repair, or physical equipment infrastructure tasks are delegated to **Sarpras** (Sarana & Prasarana). No premature inventory mutation tables are introduced in M3.3A.

---

## 7. Migration Safety & Lineage Verification

### 7.1. Additive DDL Specification
The migration `prisma/migrations/20260918120000_m3_3a_health_v2_backend/migration.sql` performs strictly non-destructive operations:
1. Creates enum `HealthStatusV2` with exact labels: `'DIPANTAU'`, `'PULIH'`, `'DIRUJUK'`, `'DARURAT'`.
2. Creates table `health_cases_v2` with foreign key `fk_health_cases_v2_santri` referencing `santri(id)` with `ON DELETE RESTRICT ON UPDATE CASCADE`.
3. Creates compound indexes on `[santri_id, occurred_at]` and `[status_v2, occurred_at]`.

### 7.2. Lineage Simulation (`simulateM33aMigrationChain`)
In `tests/test-db-manager.ts`, the automated simulation executes:
1. Baseline schema creation.
2. Main migrations 1..5.
3. PR #8 migration from exact commit `9068cae5587b7219c394c5c25bf0de07a15b0726`.
4. Phase 2A migration (`stq_architecture_lock_phase2a`).
5. Insertion of pre-existing records (staff, users, santri, PR #8 evaluation, org units, catatan kesehatan).
6. M3.1 migration (`m3_1_keasramaan_structure`).
7. Insertion of active room placement (`santri_kamar_placements`).
8. M3.3A migration (`m3_3a_health_v2_backend`).
9. Verification that all pre-existing records remain 100% byte-identical, `health_cases_v2` table is created, enum values are strictly enforced, `diagnosa = NULL` persists correctly, and invalid enum values are rejected by PostgreSQL.

---

## 8. Production Cutover Prerequisites

M3.3A is **backend foundation only**. To promote Health V2 to live production in future milestones:
1. **Approval**: Institutional Business Owner signs off on UAT testing of the Health V2 service.
2. **UI Integration**: Frontend pages in `/kesehatan` migrated from legacy actions to V2 server actions.
3. **Activation Triple**: PositionCapability grants for `PETUGAS_KESEHATAN` transitioned from `APPROVED_TARGET_PENDING_TECHNICAL` to `VERIFIED_PRODUCTION`.
4. **Referral Decision**: Leadership resolves `health.case.referral` sign-off workflow from `PROPOSED_TBD`.
5. **Database Migration**: `prisma migrate deploy` executed against production staging during authorized maintenance window.
