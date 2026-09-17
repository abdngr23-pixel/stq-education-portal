# STQ COMPATIBILITY MAP — LEGACY TO CANONICAL ARCHITECTURE
**Transitional Bridge, Legacy Field Mapping, and Retirement Roadmap**  
**Document**: `docs/STQ_COMPATIBILITY_MAP.md`  
**Status**: `ARCHITECTURE_LOCKED`  
**Approved Baseline Date**: `2026-09-17`

---

## 1. Transitional Philosophy

The STQ Portal operates a mission-critical production service for 57 santri, their guardians, and 12+ asatidz. To ensure zero disruption:
- **No legacy field or column is removed during Phase 1**.
- All legacy columns remain populated and synchronized during the transition.
- Client applications and existing verified test suites continue to function seamlessly through the **Compatibility Adapter**.

---

## 2. Legacy Role Separation vs. AccountType, Position, and Capabilities

> [!IMPORTANT]
> **Role ≠ AccountType**:
> The existing `Role` enum (`KS`, `MT`, `MK`, `ADM`, `PH`, `OSDA`, `WS`, `ST`, etc.) remains **legacy compatibility metadata** during migration. It is NEVER modified into `STAFF`, `SANTRI`, `WALI`, or `UNIT_ACCOUNT`.
> - **Legacy Role**: Coarse legacy compatibility metadata.
> - **AccountType**: Credential modality (`PERSONAL` | `UNIT`), stored additively on `User.accountType`.
> - **Position**: Organizational functional template (`MUDIR`, `KABID_TAHFIZH`, `MUSYRIF_TAHFIZH`, etc.).
> - **Capability + Scope**: Canonical future authorization mechanism.
>
> `UNIT_ACCOUNT` is **NOT** a `Role` enum value; it is an `AccountType`.

### Legacy Role Mapping Baseline

| Legacy `Role` | AccountType | Default Baseline Position | Canonical Unit Domain | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| `KS` | `PERSONAL` | `MUDIR` | `INSTITUTIONAL` | Full managerial approval, reward policy, budget signoff. |
| `ADM` | `PERSONAL` | `STAF_ADMIN_TU` | `MANAJEMEN` | User administration, official letters, logistics management, system audit. |
| `MK` | `PERSONAL` | `KEPALA_KEASRAMAAN` | `KEASRAMAAN` | Dormitory discipline, global health oversight, tier 1 perizinan approval. |
| `MT` | `PERSONAL` | `MUSYRIF_TAHFIZH` | `TAHFIZH` | Daily setoran creation, halaqoh progress monitoring, mutaba'ah. |
| `PH` | `PERSONAL` | `PEMBINA_HALAQOH` | `TAHFIZH` | Halaqoh mentoring, prayer attendance, halaqoh discipline. |
| `GA` | `PERSONAL` | `GURU_AKADEMIK` | `AKADEMIK` | Grade entry for assigned subjects, academic curriculum. |
| `OSDA` | `UNIT` | `ANGGOTA_OSDA` | `KEASRAMAAN` | Unit operations (division-specific capabilities assigned per account). |
| `WS` | `PERSONAL` | `WALI_SANTRI` | `INSTITUTIONAL` | Own child tahfizh, academic, health, and permission monitoring. |
| `ST` | `PERSONAL` | `SANTRI` | `INSTITUTIONAL` | Personal hafalan target, personal discipline star tracking. |
| `YAY` | `PERSONAL` | `PENGURUS_YAYASAN` | `INSTITUTIONAL` | Executive reports, financial & compliance audit reading. |

---

## 3. Legacy Flags to Canonical Assignments Mapping

### 3.1. `Staff.isKepalaBidangTahfidz`
- **Current Technical Implementation**: Boolean flag on `Staff` table (`default: false`). Loaded into JWT payload as `session.isKepalaBidangTahfidz`.
- **Target Canonical Implementation**:
  - `User` record for Ust. Razan Mufli receives an explicit `Assignment`:
    - `positionCode`: `"KABID_TAHFIZH"`
    - `unitId`: `"unit-bidang-tahfizh"`
    - `status`: `"ACTIVE"`
    - `validFrom`: Active academic year start date
    - `validUntil`: null (ongoing)
  - The position `KABID_TAHFIZH` links to `PositionCapability` records defining scopes (`tahfizh.recap.read` at `DOMAIN`, `tahfizh.reward.issue` at `DOMAIN`). (Notice: `Assignment` contains **NO** `scopeType`).
- **Compatibility Adapter**:
  - `authEngine.hasCapability(session, 'tahfizh.reward.issue')` returns `true` if `session.isKepalaBidangTahfidz === true` OR if an active assignment exists.
- **Retirement Target**: Phase E (after dual-read shadow verification in Phase C and authoritative write switch in Phase D).

### 3.2. `User.isPetugasPresensiPutri`
- **Current Technical Implementation**: Boolean flag on `User` table (`default: false`). Checked in `app/actions/presensi.ts`.
- **Target Canonical Implementation**:
  - Designated female student user receives an `Assignment`:
    - `positionCode`: `"PETUGAS_PRESENSI"`
    - `unitId`: `"unit-asrama-putri"`
    - `status`: `"ACTIVE"`
    - `validFrom`: Active semester start date
    - `validUntil`: Active semester end date
- **Compatibility Adapter**:
  - `hasCapability(session, 'keasramaan.presensi.record')` returns `true` for `unit-asrama-putri`.
- **Retirement Target**: Phase E.

### 3.3. Current Health Server Actions Compatibility Baseline (`app/actions/kesehatan.ts`)
The current production server baseline (commit `4c73317ba8d32924d1e86da2a7f2ef29f6aa0986`) governs live health operations without retrospective revision:
1. **`catatKesehatanAction`**:
   - Authorized roles: `KS`, `MK`, `ADM` (`requireRole(['KS', 'MK', 'ADM'])`).
   - Compatibility Baseline: `health.case.create` includes `KS`, `MK`, and `ADM`. ADM is **NOT** denied in current production.
2. **`getDaftarKesehatanAction`**:
   - Authorized roles: `KS`, `MK`, `ADM` (global health list returned, containing keluhan, diagnosa, tindakan, status, tanggal, and santri identity).
   - Scoped compatibility: `WS` and `ST` (strictly scoped to `session.santriId`).
   - Compatibility Baseline: `health.case.read_aggregate` and `health.case.read_detail` compatibility grants cover `KS`, `MK`, `ADM` (global) and `WS`, `ST` (scoped). ADM has full read access in current production.
3. **`updateStatusKesehatanAction`**:
   - Authorized roles: `MK`, `KS` (`requireRole(['MK', 'KS'])`).
   - Denied roles: `ADM` (strictly denied).
   - Compatibility Baseline: `health.case.update_status` is granted to `MK` and `KS`, denied to `ADM`.
4. **Dedicated Referral Action**:
   - Current main does **NOT** possess a dedicated server action representing `health.case.referral`.
   - Legacy status transitions to `DIRUJUK_PUSKESMAS` occur through `updateStatusKesehatanAction`, which is not an external referral issuance capability.
   - Compatibility Baseline: Dedicated referral is classified as **`PROPOSED_TBD`**.
5. **Separation from Target V2**:
   - Target V2 restrictions (e.g. separating aggregate from clinical detail, restricting clinical detail to assigned Poskestren staff, room-scoped Pembina Kamar intake) belong to future approved phases and MUST NOT be backfilled prematurely.

---

## 4. Operational Relational Linkages Mapping

| Current Relational Column | Current Meaning | Target Canonical Representation | Migration Handling |
| :--- | :--- | :--- | :--- |
| `Halaqoh.pembinaId` | Points to `Staff.id` as halaqoh leader. | Retained as primary foreign key; reflected as an `Assignment` (`Position: MUSYRIF_TAHFIZH`, `Unit: Halaqoh`). | **RETAINED PERMANENTLY**. Fast, direct FK; synchronized with `Assignment` records. |
| `PerizinanSantri.disetujuiMKId` | Points to `Staff.id` who approved Tier 1. | Retained as audit foreign key; validated via `hasCapability('keasramaan.permission.approve_mk')`. | **RETAINED PERMANENTLY**. Preserves historical approval audit trail. |
| `PerizinanSantri.disetujuiKSId` | Points to `Staff.id` who approved Tier 2. | Retained as audit foreign key; validated via `hasCapability('keasramaan.permission.approve_ks')`. | **RETAINED PERMANENTLY**. Preserves historical approval audit trail. |
| `PelanggaranSantri.pencatatId` | Points to `Staff.id` recording infraction. | Retained as audit foreign key; validated via `hasCapability('keasramaan.discipline.create')`. | **RETAINED PERMANENTLY**. Preserves historical recording attribution. |
| `CatatanKesehatan.dicatatOleh` | String recording username of reporter. | Enhanced to store `userId` and verified `humanExecutorId` (for unit accounts). | Upgraded to structured attribution in `CanonicalAuditRecord`. |

---

## 5. Navigation Compatibility Adapter Strategy

Currently, navigation menus are derived from `ROLE_NAV_MAP: Record<Role, AppNavId[]>` in `types/navigation.ts`. During the transition:

1. **Compatibility Adapter Layer**:
   ```typescript
   export function getEffectiveAllowedNavTabs(session: UserSession): AppNavId[] {
     // 1. Get baseline tabs from legacy ROLE_NAV_MAP
     const baseTabs = new Set<AppNavId>(ROLE_NAV_MAP[session.role] || []);

     // 2. Additive capability augmentation
     if (session.isKepalaBidangTahfidz || hasCapabilitySync(session, "tahfizh.recap.read")) {
       baseTabs.add("tahfizh");
     }
     if (hasCapabilitySync(session, "health.case.read_aggregate") || hasCapabilitySync(session, "health.case.read_detail")) {
       baseTabs.add("kesehatan");
     }
     if (hasCapabilitySync(session, "keasramaan.permission.create")) {
       baseTabs.add("perizinan");
     }

     return Array.from(baseTabs);
   }
   ```
2. **Zero Breaking Changes**:
   - `AppSidebar`, `TopNavbar`, and `MobileBottomNav` consume `getEffectiveAllowedNavTabs()`.
   - Existing users see their familiar UI tabs; users with newly assigned capabilities (e.g. Mudabbir gaining perizinan or OSDA Kesehatan gaining kesehatan) automatically see the relevant tab enabled without hardcoded role expansion.

---

## 6. Legacy Health Status Bridge

Phase 1 candidate models define canonical V2 statuses (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`). Legacy database records bridge as follows:

| Legacy Health Status | Canonical V2 Status | Determinism Status | Migration Rule |
| :--- | :--- | :--- | :--- |
| `SEMBUH` | `PULIH` | **DETERMINISTIC** | Direct 1:1 translation. |
| `RAWAT_PONDOK` | `DIPANTAU` | **DETERMINISTIC** | Direct 1:1 translation. |
| `DIRUJUK_PUSKESMAS` | `DIRUJUK` | **DETERMINISTIC** | Direct 1:1 translation. |
| `PULANG` | *None* | **AMBIGUOUS_PENDING_REVIEW** | **DO NOT BACKFILL**. "PULANG" does not cleanly map to "PULIH" because it frequently indicates active convalescence at home or excused leave due to sickness. Requires manual business owner review. |

