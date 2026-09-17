# STQ COMPATIBILITY MAP — LEGACY TO CANONICAL ARCHITECTURE
**Transitional Bridge, Legacy Field Mapping, and Retirement Roadmap**  
**Document**: `docs/STQ_COMPATIBILITY_MAP.md`  
**Status**: `PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW`

---

## 1. Transitional Philosophy

The STQ Portal operates a mission-critical production service for 57 santri, their guardians, and 12+ asatidz. To ensure zero disruption:
- **No legacy field or column is removed during Phase 1**.
- All legacy columns remain populated and synchronized during the transition.
- Client applications and existing verified test suites continue to function seamlessly through the **Compatibility Adapter**.

---

## 2. Legacy Role to Coarse Identity Category Mapping

| Legacy `Role` | Coarse Category | Default Baseline Position | Canonical Unit | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| `KS` | `STAFF` | `MUDIR` | `INSTITUTION` | Full managerial approval, reward policy, budget signoff. |
| `ADM` | `STAFF` | `STAF_ADMIN_TU` | `TATA_USAHA` | User administration, official letters, logistics management, system audit. |
| `MK` | `STAFF` | `KEPALA_KEASRAMAAN` | `BIDANG_KEASRAMAAN` | Dormitory discipline, global health oversight, tier 1 perizinan approval. |
| `MT` | `STAFF` | `MUSYRIF_TAHFIZH` | `HALAQOH` (Assigned) | Daily setoran creation, halaqoh progress monitoring, mutaba'ah. |
| `PH` | `STAFF` | `PEMBINA_HALAQOH` | `HALAQOH` (Assigned) | Halaqoh mentoring, prayer attendance, halaqoh discipline. |
| `GA` | `STAFF` | `GURU_AKADEMIK` | `BIDANG_AKADEMIK` | Grade entry for assigned subjects, academic curriculum. |
| `OSDA` | `UNIT_ACCOUNT` | `ANGGOTA_OSDA` | `OSDA` | Unit operations (division-specific capabilities assigned per account). |
| `WS` | `WALI` | `WALI_SANTRI` | `INDIVIDUAL` | Own child tahfizh, academic, health, and permission monitoring. |
| `ST` | `SANTRI` | `SANTRI` | `INDIVIDUAL` | Personal hafalan target, personal discipline star tracking. |
| `YAY` | `STAKEHOLDER` | `PENGURUS_YAYASAN` | `YAYASAN` | Executive reports, financial & compliance audit reading. |

---

## 3. Legacy Flags to Canonical Assignments Mapping

### 3.1. `Staff.isKepalaBidangTahfidz`
- **Current Technical Implementation**: Boolean flag on `Staff` table (`default: false`). Loaded into JWT payload as `session.isKepalaBidangTahfidz`.
- **Target Canonical Implementation**:
  - `User` record for Ust. Razan Mufli receives an explicit `Assignment`:
    - `positionCode`: `"KABID_TAHFIZH"`
    - `unitId`: `"unit-bidang-tahfizh"`
    - `scopeType`: `"DOMAIN"`
    - `status`: `"ACTIVE"`
    - `validFrom`: Active academic year start date
    - `validUntil`: null (ongoing)
- **Compatibility Adapter**:
  - `authEngine.hasCapability(session, 'tahfizh.reward.issue')` returns `true` if `session.isKepalaBidangTahfidz === true` OR if an active assignment exists.
- **Retirement Target**: Phase E (after dual-read shadow verification in Phase C and authoritative write switch in Phase D).

### 3.2. `User.isPetugasPresensiPutri`
- **Current Technical Implementation**: Boolean flag on `User` table (`default: false`). Checked in `app/actions/presensi.ts`.
- **Target Canonical Implementation**:
  - Designated female student user receives an `Assignment`:
    - `positionCode`: `"PETUGAS_PRESENSI"`
    - `unitId`: `"unit-asrama-putri"`
    - `scopeType`: `"UNIT"`
    - `status`: `"ACTIVE"`
    - `validFrom`: Active semester start date
    - `validUntil`: Active semester end date
- **Compatibility Adapter**:
  - `hasCapability(session, 'keasramaan.presensi.record')` returns `true` for `unit-asrama-putri`.
- **Retirement Target**: Phase E.

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
     if (hasCapabilitySync(session, "health.case.read")) {
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
