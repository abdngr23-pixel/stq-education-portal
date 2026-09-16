# POST-PR11 HOTFIX REPORT — STQ EDUCATION PORTAL
**Focus**: Authorization Scope (Kabid Tahfizh vs Ordinary Musyrif Tahfizh) & Health Data Honesty  
**Baseline Main Commit**: `590f36148394f91443b2ef0eb663712a12fc14bb`  
**Working Branch**: `hotfix/post-pr11-kabid-health-honesty`  
**PR #8 Status**: Untouched (`review/tahfizh-quality-evaluation` HEAD `9068cae5587b7219c394c5c25bf0de07a15b0726`)  
**Implementation Status**: `READY_FOR_INDEPENDENT_PRODUCTION_AUDIT`

---

## 1. Root Cause Analysis

### P0 — Health Data Honesty: False "Sehat"
- **Root Cause**: `components/modules/portal-wali-module.tsx` contained an unconditional fallback expression:
  ```typescript
  (kesehatanList && kesehatanList.length > 0) ? kesehatanList[0].statusKesehatan : "Sehat"
  ```
  Whenever data fetching failed (server action error, unauthenticated session, network failure) or when a student simply had no health records recorded yet, the UI fabricated `"Sehat"`.
- **Impact**: Displayed a false sense of health security to guardians/students when the underlying data source had actually failed or was unavailable.

### P1 — MK Health Session Bug: "Sesi otentikasi tidak ditemukan"
- **Root Cause**: In `lib/auth.ts`, `resolveVerifiedSessionPayload()` executed a PostgreSQL verification query with deep relation `include`s (`halaqohDipimpin`, `halaqoh`, etc.) wrapped in a strict 2000ms `Promise.race([dbPromise, timeoutPromise])` without a `clearTimeout` cleanup. During server action executions or database latency spikes, the query timed out (`DB_TIMEOUT`) or context cookies were detached, causing `getCurrentSession()` to return `null`. The server action `getDaftarKesehatanAction()` then returned `"Akses Ditolak: Sesi otentikasi tidak ditemukan."`.

### P0 — Authorization Ambiguity: Kabid Tahfizh vs Ordinary Musyrif Tahfizh
- **Root Cause**: The independent production audit observed that the operational account Ust. Razan Mufli, S.Pd (`musyrif.tahfizh`, role `MT`) could access all 57 students, recap across halaqoh, and issue rewards. The previous assumption treated this as a leak because `role === "MT"`. However, Ust. Razan is canonically **Kabid Tahfizh**. The existing codebase had already persisted `Staff.isKepalaBidangTahfidz = true`, but lacked explicit separation:
  1. Setoran creation previously had `&& !session.isKepalaBidangTahfidz` allowing Kabid to bypass the halaqoh boundary for setoran write, which contradicted the principle that managerial read authority does not automatically grant cross-halaqoh daily write authority.
  2. The UI Setoran selector in `tahfizh-module.tsx` did not restrict ordinary MT to their own halaqoh.
  3. Reward issuance in `app/actions/reward-sanksi.ts` previously allowed generic `ADM` or lacked explicit Mudir + Kabid restriction.
  4. Header UI displayed generic `"Musyrif Tahfizh"` rather than acknowledging `"Kabid Tahfizh"`.

---

## 2. Exact Files Changed

1. `lib/auth.ts`:
   - Replaced heavy `include` in `resolveVerifiedSessionPayload` with optimized field-level `select`.
   - Replaced rigid 2-second timeout with resilient 8-second timeout guarded by `try/finally { clearTimeout(timeoutId); }`.
   - Added fallback token resolution from Next.js `headers()` (`authorization` and `cookie` headers) when `cookies()` store has transient detachment in server actions.
2. `lib/kesehatan-status.ts` *(NEW)*:
   - Pure semantic status derivation helper `getStatusKesehatanSemantics(kesehatanList, error)` ensuring:
     - SUCCESS + healthy record => `"Sehat"`
     - SUCCESS + active condition => Actual status (e.g., `"RAWAT PONDOK"`)
     - SUCCESS + empty list => `"Belum ada data kesehatan"`
     - FETCH ERROR / SERVER ERROR => `"Gagal memuat data kesehatan"`
     - AUTHORIZATION ERROR => `"Akses data kesehatan tidak tersedia"`
     - UNDEFINED / UNINITIALIZED => `"Data kesehatan tidak tersedia"`
3. `components/modules/portal-wali-module.tsx`:
   - Removed the `: "Sehat"` synthetic fallback and connected `getStatusKesehatanSemantics`.
4. `app/actions/tahfizh.ts`:
   - In `createSetoranAction`: Enforced strict halaqoh binaan boundary (`if (!isBinaan)`) for all musyrif, preventing cross-halaqoh writes even by Kabid unless explicitly assigned.
5. `components/modules/tahfizh-module.tsx`:
   - Filtered `setoranSantriList` by `currentHalaqohName` for MT/PH, ensuring the UI dropdown only contains students in the musyrif's halaqoh.
   - Forwarded `isKepalaBidangTahfidz` to `<RewardEvaluasiTab>`.
6. `app/actions/reward-sanksi.ts`:
   - Restricted `prosesRewardTasmiSimaanAction` issuer authority strictly to `session.role === "KS" || Boolean(session.isKepalaBidangTahfidz)`. Rejects ordinary MT, ADM, MK, PH, OSDA, ST, WS fail-closed.
7. `components/dashboard/reward-evaluasi-tab.tsx`:
   - Added `isKepalaBidangTahfidz` prop.
   - Set `canIssueReward = isMudir || isKabid`.
   - Rendered "Terbitkan Reward" button conditionally only for Mudir and Kabid Tahfizh.
   - Updated explanatory labels from `"Read-Only (Hanya Mudir)"` to `"Penerbitan reward: Mudir / Kabid Tahfizh"`.
8. `lib/server/santri-list-service.ts`:
   - Sanitized guardian phone `noHpWali`, restricting it to `KS`, `ADM`, the assigned pembina halaqoh, or the guardian/student themselves.
9. `app/actions/akademik.ts`:
   - Restricted `getRaporGabunganAction` for ordinary MT/PH to their own halaqoh binaan, and WS/ST to their own student record.
10. `app/actions/mutabaah.ts`:
    - In `getRekapMutabaahBulananAction`: Restricted ordinary MT/PH to their own halaqoh binaan.
11. `components/navigation/app-header.tsx` & `app/page.tsx`:
    - Propagated `isKepalaBidangTahfidz` to `AppHeader`, displaying the functional role badge `"Kabid Tahfizh"` when `userRole === "MT" && isKepalaBidangTahfidz`.
12. `tests/reward-abac-fail-closed.test.ts`:
    - Aligned unit tests to verify that only Mudir and Kabid Tahfizh can issue rewards; ordinary MT and ADM are rejected.
13. `tests/post-pr11-hotfix-abac.test.ts` *(NEW)*:
    - End-to-end unit test suite covering Cases A through G.

---

## 3. Authorization Model: Before vs After

| Area | Before Post-PR11 Hotfix | After Post-PR11 Hotfix |
| :--- | :--- | :--- |
| **Kabid Tahfizh Supervision Scope** | Treated identically to MT in UI labels, creating audit confusion. | Recognized as Kabid Tahfizh via persisted `Staff.isKepalaBidangTahfidz = true`. Granted institution-wide Tahfizh read & supervision scope. |
| **Ordinary MT Read Scope** | Some endpoints (e.g. Rapor, Mutabaah rekap) had loose filters. | Strictly scoped to own halaqoh binaan. Global student list unassigned. |
| **Setoran Creation (Write)** | Bypass allowed if `isKepalaBidangTahfidz` was true; UI dropdown loaded all students. | Strict write boundary: Setoran creation requires student to be in own halaqoh binaan for both ordinary MT and Kabid Tahfizh. UI dropdown filtered to own halaqoh. |
| **Reward Tasmi'/Sima'an Issuance** | `["MT", "KS", "ADM"]` were allowed; UI label stated "Hanya Mudir". | Strictly Mudir (`KS`) and Kabid Tahfizh (`isKepalaBidangTahfidz`). Ordinary MT, ADM, MK, PH rejected server-side and hidden in UI. Explanatory label: "Mudir / Kabid Tahfizh". |
| **Student Health Status** | Fallback to `"Sehat"` on error, empty array, or missing data. | Honest state semantics: "Sehat" only if verified healthy; "Belum ada data kesehatan" if empty; "Gagal memuat data kesehatan" on error. |
| **MK Health Session** | Prone to 2-second timeout and session detachment under load. | Optimized Prisma query, 8-second timeout, `clearTimeout` in `finally`, and header cookie fallback. |

---

## 4. How Kabid Tahfizh is Distinguished from Ordinary MT

The distinction is based on the **safest existing persisted schema field**:
- Database table: `Staff`
- Field: `isKepalaBidangTahfidz: Boolean` (Default: `false`)
- Session token: `session.isKepalaBidangTahfidz` is populated directly during JWT generation from `user.staff.isKepalaBidangTahfidz` and re-verified via `resolveVerifiedSessionPayload()`.
- Operational Account: Ust. Razan Mufli, S.Pd (`musyrif.tahfizh`, staff code `STF002`) has `isKepalaBidangTahfidz = true`.
- Zero database migrations or schema alterations were introduced.

---

## 5. Server-Side Enforcement Points

1. `app/actions/tahfizh.ts` (`createSetoranAction`):
   ```typescript
   if (session.role === "MT" || session.role === "PH") {
     const isBinaan = await prisma.santri.findFirst({
       where: { id: input.santriId, halaqoh: { pembinaId: session.staffId } },
     });
     if (!isBinaan) {
       return { success: false, message: "Akses Ditolak: Anda hanya berwenang mencatat setoran santri di dalam halaqoh binaan Anda." };
     }
   }
   ```
2. `app/actions/reward-sanksi.ts` (`prosesRewardTasmiSimaanAction`):
   ```typescript
   const isAuthorizedIssuer = session.role === "KS" || Boolean(session.isKepalaBidangTahfidz);
   if (!isAuthorizedIssuer) {
     return { success: false, message: "Akses Ditolak: Anda tidak berwenang. Penerbitan reward Tasmi'/Sima'an hanya berwenang dilakukan oleh Mudir atau Kabid Tahfizh." };
   }
   ```
3. `app/actions/akademik.ts` (`getRaporGabunganAction`):
   ```typescript
   if ((session.role === "MT" || session.role === "PH") && !session.isKepalaBidangTahfidz) {
     const isBinaan = await prisma.santri.findFirst({
       where: { id: santriId, halaqoh: { pembinaId: session.staffId } },
     });
     if (!isBinaan) {
       return { success: false, message: "Akses Ditolak: Anda hanya berwenang melihat rapor santri di dalam halaqoh binaan Anda." };
     }
   }
   ```
4. `app/actions/mutabaah.ts` (`getRekapMutabaahBulananAction`):
   Enforces halaqoh filter where `pembinaId === session.staffId` for ordinary MT/PH.

---

## 6. Reward Authorization Implementation

- **Issuer Authority**: Only Mudir (`KS`) and Kabid Tahfizh (`session.isKepalaBidangTahfidz === true`).
- **Server Action**: `prosesRewardTasmiSimaanAction` enforces `isAuthorizedIssuer`. All other roles (ordinary MT, ADM, MK, PH, OSDA, etc.) are rejected with an explicit error message.
- **Client UI**:
  - `<RewardEvaluasiTab>` receives `isKepalaBidangTahfidz`.
  - `canIssueReward = isMudir || isKabid`.
  - The "Terbitkan Reward" button is only displayed for authorized issuers. Non-issuers see `"Penerbitan reward: Mudir / Kabid Tahfizh"`.

---

## 7. Health False-"Sehat" Fix

Implemented pure semantics in `lib/kesehatan-status.ts` and integrated into `components/modules/portal-wali-module.tsx`:
- Data empty (`kesehatanList.length === 0`): Displays `"Belum ada data kesehatan"`.
- Fetch failed (`error !== null`): Displays `"Gagal memuat data kesehatan"`.
- Auth error: Displays `"Akses data kesehatan tidak tersedia"`.
- Uninitialized / undefined: Displays `"Data kesehatan tidak tersedia"`.
- Real medical status: Displays formatted status (e.g., `"RAWAT PONDOK"`).
- Normal status: Displays `"Sehat"` **only** when data exists and `statusKesehatan === "SEHAT"`.

---

## 8. MK Session Bug Fix

In `lib/auth.ts`:
1. Switched `resolveVerifiedSessionPayload` Prisma query from relational `include` to lean `select`.
2. Extended query timeout from 2000ms to 8000ms and added `clearTimeout(timeoutId)` inside a `finally` block to prevent hanging timers.
3. Added cookie/header fallback in `getCurrentSession` to recover session tokens passed via authorization headers or request cookie headers during Server Action invocations.

---

## 9. Tests Executed and Results

| Test Suite | Tests Run | Passed | Failed | Duration |
| :--- | :---: | :---: | :---: | :---: |
| `tests/post-pr11-hotfix-abac.test.ts` (Cases A through G) | 16 | 16 | 0 | 9.39s |
| `tests/reward-abac-fail-closed.test.ts` | 14 | 14 | 0 | 28.77s |
| `tests/akademik-data-honesty.test.ts` | 19 | 19 | 0 | 0.01s |
| `npm run typecheck` (`tsc --noEmit`) | Full | PASS | 0 | 7.12s |
| `npm run lint` (`eslint`) | Full | PASS | 0 | 27.28s |

All test cases verified:
- **Case A**: Kabid Tahfizh (`isKepalaBidangTahfidz = true`) is authorized to issue rewards and read managerial scope.
- **Case B**: Ordinary MT (`isKepalaBidangTahfidz = false`) is strictly rejected from issuing rewards and restricted in setoran selection.
- **Case C**: Mudir (`role = KS`) remains authorized to issue rewards.
- **Case D**: Unauthorized roles (`ADM`, `MK`, `PH`) are strictly rejected from issuing rewards.
- **Case E**: MK session resolution uses safe timeout and payload query.
- **Case F**: Health data honesty eliminates all synthetic "Sehat" fallbacks.
- **Case G**: Legacy account (`razan.mt`) remains unlinked and fail-closed.

---

## 10. Unresolved Ambiguity
None. The canonical decisions of the Business Owner have been fully implemented without requiring schema alterations.

---

## 11. Confirmation Checklist

- **Database Migrations**: `0`
- **Database Seeds**: `0`
- **Production Business-Data Writes**: `0`
- **PR #8 Touched**: `NO` (`HEAD 9068cae5587b7219c394c5c25bf0de07a15b0726` unchanged)

---

## 12. Final Status

```
READY_FOR_INDEPENDENT_PRODUCTION_AUDIT
```
*(Notice: Do NOT declare SAFE_TO_START_STQ_ARCHITECTURE_LOCK until the independent production audit in ChatGPT Work / Cloud Browser confirms clean production behavior).*
