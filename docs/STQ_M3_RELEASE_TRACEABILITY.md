# STQ EDUCATION PORTAL — M3.3 RELEASE TRACEABILITY MATRIX
**Comprehensive Bidirectional Traceability: Business Rule to Production Evidence**
**Document**: `docs/STQ_M3_RELEASE_TRACEABILITY.md`
**Status**: `CONTROL_PLANE_ACTIVE`
**Baseline Commit (`main`)**: `8e670491d1ed0c88a480ed90186153e96ca1dea3`
**Protected PR #8**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (**OPEN / DRAFT / UNMERGED**)
**Production Mutations**: `0` (**STRICTLY PROHIBITED**)

---

## 1. Traceability Architecture & Guarantee

The STQ Education Portal Release Train enforces end-to-end bidirectional traceability across all release artifacts. Every capability granted, policy evaluated, and record mutated must be anchored to an authoritative Business Owner decision and verified by automated negative/positive tests, schema contracts, and post-execution evidence packs.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BIDIRECTIONAL TRACEABILITY FLOW                                │
│                                                                                                  │
│   Business Rule / Decision                                                                       │
│          ▼                                                                                       │
│   Data Model / Schema Entity (Prisma)                                                            │
│          ▼                                                                                       │
│   Canonical Position & Capability Registration                                                    │
│          ▼                                                                                       │
│   Scope Dimension & Scope Type (GLOBAL / DOMAIN / ASSIGNED_UNITS / HALAQOH)                       │
│          ▼                                                                                       │
│   Server Authorization Policy & Context Resolver (lib/auth, lib/server)                          │
│          ▼                                                                                       │
│   Endpoint Implementation & Concurrency Guard (lib/server/pendidikan-v2-service.ts)              │
│          ▼                                                                                       │
│   Automated Regression & Negative Verification Suite (tests/)                                    │
│          ▼                                                                                       │
│   Live UAT Scenario (UAT-01 .. UAT-09)                                                           │
│          ▼                                                                                       │
│   Mandatory Production Evidence Artifact Pack (evidence/)                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Traceability Rules & Invariants
1. **No Phantom Capabilities**: Every capability evaluated by server policies must be declared in `types/architecture-lock.ts` and registered in the `capabilities` database table.
2. **Canonical Authorization Paths (Personal vs Unit)**:
   - **PERSONAL Account Path**:
     $$\text{User} \longrightarrow \text{verified human identity / Staff where required} \longrightarrow \text{Assignment} \longrightarrow \text{Position} \longrightarrow \text{PositionCapability} \longrightarrow \text{Scope} \longrightarrow \text{Resource Context}$$
   - **UNIT Account Path**:
     $$\text{Technical User} \longrightarrow \text{UnitAccountPlacement} \longrightarrow \text{Assignment} \longrightarrow \text{Position} \longrightarrow \text{PositionCapability} \longrightarrow \text{Scope} \longrightarrow \text{Resource Context}$$
     *(For every mutating UNIT transaction, verified human executor attribution is strictly required; the technical credential itself does not masquerade as a personal Staff profile).*
3. **No Personal Identity Grants**: Usernames (e.g. `lisa.mt`, `razan.mt`), personal names, or email strings must NEVER appear in authorization policies or conditional logic.
4. **Fail-Closed Domain Trust**: Unknown capability namespaces and unassigned resources fail closed with `INVALID_RESOURCE_CONTEXT` or `SCOPE_MISMATCH`.
5. **Exact UAT Capability Coverage**: The 9 canonical capabilities required for UAT activation must maintain 100% complete traceability links before C2D activation:
   1. `academic.schedule.read`
   2. `academic.session.start`
   3. `academic.material.record`
   4. `academic.attendance.record`
   5. `tahfizh.recap.read`
   6. `tahfizh.reward.issue`
   7. `tahfizh.target.manage`
   8. `keasramaan.permission.read`
   9. `keasramaan.permission.create`
6. **Academic PositionCapability Classification & Operational Boundary**:
   - `ACADEMIC_CAPABILITY_REGISTRATION = REQUIRED` (The four academic capabilities remain in the exact 9 UAT set).
   - `ACADEMIC_POSITION_GRANT_POLICY = PROPOSED_TBD / BLOCKED` (`GURU_AKADEMIK` PositionCapability grants are NOT currently approved by canonical `UAT_ACTIVATION_TARGETS`).
   - `ACADEMIC_SCOPE_POLICY = BLOCKED`
   - `ACADEMIC_ACCOUNT_MODALITY = PROPOSED_TBD` (Teacher account modality: PERSONAL linked Staff vs UNIT + verified human executor remains unresolved).
   - Strictly avoid/remove invented canonical position `GURU_KEPESANTRENAN`.
7. **Honest Readiness Classification**: Any component with missing migrations, unprovisioned accounts, or unapproved policies is classified as `GAP / BLOCKED / NOT_READY`. No speculative "READY" states.
8. **TeachingAssignment vs Canonical Assignment Invariant**:
   - **TeachingAssignment**: Scheduled pedagogical Staff assignment linking a `Staff` profile to subject, track, gender group, and pedagogical level (`TeachingAssignment.staffId`, `mapelId`, etc.). A valid `TeachingAssignment` alone does NOT confer canonical runtime authority.
   - **Canonical Assignment**: Relational authorization anchor linking `User` $\longrightarrow$ `Position` $\longrightarrow$ `OrgUnit` (via `Assignment` and `AssignmentScopeUnit`). A canonical `Assignment` alone does NOT prove a teacher is scheduled for a particular `EducationSession`.
   - Both layers are distinct and independently evaluated; neither implies or replaces the other.

---

## 2. Master Bidirectional Traceability Matrix

| Requirement / Rule ID | Business Rule Description & Authority Source | Domain | Data Model / Schema Entity | Canonical Position | Canonical Capability | Scope Type | Server Policy & Guard | Resource Context Required | Implementation File | Positive Test Case | Negative / Security Test Case | Live UAT Scenario ID | Evidence Pack Requirement | Traceability Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TR-ACAD-01** | **Academic Schedule Read**: Teachers view scheduled teaching sessions for their assigned classes and subjects. *(M3.2 UAT #5, M3.3B)* | `AKADEMIK` | `EducationSession`, `TeachingAssignment`, `EducationCohort`, `Subject` | `GURU_AKADEMIK` *(PROPOSED_TBD / BLOCKED)* | `academic.schedule.read` | `ASSIGNED_UNITS` *(BLOCKED_TECHNICAL)* | `authorizeCanonical({ capability: 'academic.schedule.read', resourceContext: { educationSessionId } })` + `checkSchemaReadiness()` | `educationSessionId` | `lib/server/pendidikan-v2-service.ts` (`PendidikanV2Service.getEducationSessions`) | `tests/milestone3-3c1-real-postgres.test.ts` (Sec 4.2) | `tests/milestone3-3c1-real-postgres.test.ts` ("missing capability => DENY") | `UAT-ACAD-01` | `EVIDENCE_UAT_ACAD_01.json` (schedule response + query log) | **BLOCKED** *(Grant policy & unit containment unresolved)* |
| **TR-ACAD-02** | **Start Teaching Session & Teacher Attendance**: Authenticated teacher begins scheduled session via atomic CAS. Serves as authentic teacher attendance. Badal/substitute strictly fails closed. *(M3.2 UAT #6, M3.3B, M3.3C1)* | `AKADEMIK` | `EducationSession` (`status`, `scheduledStaffId`, `actualTeacherStaffId`, `startedAt`, `updatedAt`) | `GURU_AKADEMIK` *(PROPOSED_TBD / BLOCKED)* | `academic.session.start` | `ASSIGNED_UNITS` *(BLOCKED_TECHNICAL)* | `PendidikanV2Service.startEducationSession`: CAS status update (`status = SCHEDULED` $\rightarrow$ `updateMany` $\rightarrow$ `STARTED`; count === 1) + substitute guard (`authoritativeScheduledStaffId === staffId`) + server feature flag check | `educationSessionId` | `lib/server/pendidikan-v2-service.ts` (`PendidikanV2Service.startEducationSession`) | `tests/milestone3-3c1-real-postgres.test.ts` (Sec 4.2) | `tests/milestone3-3c1-real-postgres.test.ts` (Sec 4.1: scope mismatch; substitute mismatch => `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`) | `UAT-ACAD-02` | `EVIDENCE_UAT_ACAD_02.json` (session start transition + audit log) | **BLOCKED** *(Grant policy & unit containment unresolved)* |
| **TR-ACAD-03** | **Record Learning Materials**: Authenticated actual teacher records curriculum material (`materi`) on active session with forensic audit log. *(M3.3B)* | `AKADEMIK` | `EducationSession` (`materi`, `materiRecordedAt`, `materiRecordedByUserId`, `updatedAt`), `AuditLog` | `GURU_AKADEMIK` *(PROPOSED_TBD / BLOCKED)* | `academic.material.record` | `ASSIGNED_UNITS` *(BLOCKED_TECHNICAL)* | `PendidikanV2Service.recordSessionMaterial`: Active session check (`status === STARTED`) + actual teacher ownership check (`actualTeacherUserId === actorUserId`) + single transaction update and audit sink | `educationSessionId` | `lib/server/pendidikan-v2-service.ts` (`PendidikanV2Service.recordSessionMaterial`) | `tests/milestone3-3b-pendidikan-foundation.test.ts` (materials record success) | `tests/milestone3-3b-pendidikan-foundation.test.ts` (record on `SCHEDULED` or `COMPLETED` session => `DENY`) | `UAT-ACAD-03` | `EVIDENCE_UAT_ACAD_03.json` (materials update diff + audit event) | **BLOCKED** *(Grant policy & unit containment unresolved)* |
| **TR-ACAD-04** | **Kepesantrenan Student Attendance**: Teacher records student presence with canonical statuses (`HADIR`, `IZIN`, `SAKIT`, `ALFA`). Strictly NO MASBUK. Students must be enrolled in roster. **Track Boundary**: Applies strictly to Kepesantrenan flow. Studi Umum student attendance throws `STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED` (formally deferred). *(M3.2 UAT #6, M3.3B)* | `AKADEMIK` | `EducationSessionAttendance`, `EducationSessionParticipant` | `GURU_AKADEMIK` *(PROPOSED_TBD / BLOCKED)* | `academic.attendance.record` | `ASSIGNED_UNITS` *(BLOCKED_TECHNICAL)* | `PendidikanV2Service.recordSessionAttendance`: Track boundary guard (`KEPESANTRENAN` allowed; `STUDI_UMUM` $\rightarrow$ `STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED`) + roster participant integrity verification + valid status check + audit log | `educationSessionId`, `santriId` | `lib/server/pendidikan-v2-service.ts` (`PendidikanV2Service.recordSessionAttendance`) | `tests/milestone3-3b-pendidikan-foundation.test.ts` (Kepesantrenan attendance mutation success) | `tests/milestone3-3b-pendidikan-foundation.test.ts` (unrostered santri => `DENY`; `MASBUK` status => rejected; Studi Umum attendance => `STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED`) | `UAT-ACAD-04` | `EVIDENCE_UAT_ACAD_04.json` (attendance batch log + audit diff) | **BLOCKED** *(Grant policy, unit containment & track boundary)* |
| **TR-TAHF-01** | **Operational All-Santri Tahfizh Recap Read**: Dedicated operational staff reads institutional memorization recap across ALL santri. Read breadth never widens write authority. *(M3.2 UAT #2, M3.3C)* | `TAHFIZH` | `Santri`, `Halaqoh`, `Setoran` | `PETUGAS_OPERASIONAL_TAHFIZH`, `KABID_TAHFIZH`, `MUDIR` | `tahfizh.recap.read` | `GLOBAL` (Operational / Mudir), `DOMAIN` (Kabid) | `authorizeCanonical(user, 'tahfizh.recap.read', ctx)`: Namespace `tahfizh.*` $\rightarrow$ `TAHFIZH` domain | `santriId`, `halaqohId` | `lib/auth/canonical-evaluator.ts`, `app/actions/tahfizh.ts` | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 2.1) | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 10.3: `GLOBAL` recap read does NOT widen reward or setoran write) | `UAT-TAHF-01` | `EVIDENCE_UAT_TAHF_01.json` (recap query output + timing) | **NOT_READY** *(Pending C2C staff/account provisioning)* |
| **TR-TAHF-02** | **Operational Reward Issuance**: Authorized operational staff issues Tasmi'/Sima'an rewards ONLY for santri within assigned units/halaqoh. Cross-unit issuance strictly denied. *(M3.2 UAT #11)* | `TAHFIZH` | `TahfizhReward` (target) / `AuditLog` | `PETUGAS_OPERASIONAL_TAHFIZH`, `KABID_TAHFIZH`, `MUDIR` | `tahfizh.reward.issue` | `ASSIGNED_UNITS` (Operational), `DOMAIN` (Kabid), `GLOBAL` (Mudir) | `authorizeCanonical(user, 'tahfizh.reward.issue', ctx)`: Evaluates membership in assigned units | `santriId`, `halaqohId`, `assignedOrgUnitIds` | `lib/auth/canonical-evaluator.ts`, target reward handler | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 10.1) | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 10.2: santri outside assigned unit => `DENY SCOPE_MISMATCH`) | `UAT-TAHF-02` | `EVIDENCE_UAT_TAHF_02.json` (reward issuance record + audit sink) | **NOT_READY** *(Pending C2C provisioning)* |
| **TR-TAHF-03** | **Halaqoh Target Management**: Musyrif Tahfizh and Pembina Halaqoh manage memorization targets strictly for santri in their own assigned halaqoh. Cross-halaqoh updates denied. *(M3.2 UAT #4)* | `TAHFIZH` | `SantriTarget` / `Santri` target fields | `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH` | `tahfizh.target.manage` | `HALAQOH` | `authorizeCanonical(user, 'tahfizh.target.manage', ctx)`: Santri halaqoh matches user assigned halaqoh | `santriId`, `halaqohId` | `lib/auth/canonical-evaluator.ts`, `app/actions/laporan-bulanan.ts` (`upsertTargetSantriAction`) | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 4.1) | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 4.2: cross-halaqoh target update => `DENY SCOPE_MISMATCH`) | `UAT-TAHF-03` | `EVIDENCE_UAT_TAHF_03.json` (target mutation log + audit diff) | **NOT_READY** *(Pending C2C provisioning)* |
| **TR-ASR-01** | **Asrama Permission Module Read**: Operational staff views student leave requests strictly within their assigned dormitory units. Cross-unit read denied. *(M3.2 UAT #1)* | `KEASRAMAAN` | `SantriPerizinan` / `Perizinan` | `PETUGAS_OPERASIONAL_KEASRAMAAN` | `keasramaan.permission.read` | `ASSIGNED_UNITS` | `authorizeCanonical(user, 'keasramaan.permission.read', ctx)`: Evaluates santri unit containment | `santriId`, `asramaUnitId` | `lib/auth/canonical-evaluator.ts`, `app/actions/keasramaan-actions.ts` | `tests/milestone3-3c1-real-postgres.test.ts` (Sec 5.6) | `tests/milestone3-3c1-real-postgres.test.ts` (Sec 5.5: resource outside assigned unit => `DENY SCOPE_MISMATCH`) | `UAT-ASR-01` | `EVIDENCE_UAT_ASR_01.json` (permission list read log) | **NOT_READY** *(Pending C2C provisioning)* |
| **TR-ASR-02** | **Asrama Permission Application Create**: Operational staff submits leave request for santri in assigned dormitory units. Approval tiers (`approve_mk`, `approve_ks`) strictly denied. *(M3.2 UAT #1)* | `KEASRAMAAN` | `SantriPerizinan` / `Perizinan` | `PETUGAS_OPERASIONAL_KEASRAMAAN` | `keasramaan.permission.create` | `ASSIGNED_UNITS` | `authorizeCanonical(user, 'keasramaan.permission.create', ctx)`: Unit match + fail-closed approval tier denial | `santriId`, `asramaUnitId` | `lib/auth/canonical-evaluator.ts`, `app/actions/keasramaan-actions.ts` | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 1.2) | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 1.3: approval attempt by operational staff => `DENY CAPABILITY_NOT_GRANTED`) | `UAT-ASR-02` | `EVIDENCE_UAT_ASR_02.json` (permission submission record + audit) | **NOT_READY** *(Pending C2C provisioning)* |

---

## 3. Supporting UAT Business Rules & UI Presentation Contracts

| Rule ID | Business Rule Title & Source | Domain | Impacted Component / Schema Entity | Canonical Rule & Boundary | Implementation File | Verification Test | Evidence Requirement | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TR-UI-01** | **Santri Search / Picker Display Contract (Nama + Kelas Only)** *(M3.2 UAT #3, M3.3C1, BO Decision 2026-09-19)* | `TAHFIZH` / `ALL` | UI Search Modal / Result Card | Rendered search / picker results display **NAMA + KELAS ONLY**. Do NOT append NIS or halaqoh in normal picker result rows. In current codebase, UI still renders `({santri.nis})` in certain Tahfizh modals (e.g. `components/dashboard/dashboard-musyrif-tahfizh.tsx:783,978`); therefore UI completeness remains partial. | `components/dashboard/dashboard-musyrif-tahfizh.tsx`, search helpers | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 3) | Visual UI screenshot + DOM inspection artifact | **PARTIAL / UI_NOT_COMPLETE** *(Business contract confirmed: NAMA + KELAS only; UI cleanup pending)* |
| **TR-CURR-01** | **Studi Umum Canonical 6 Subjects** *(M3.2 UAT #5, M3.3B)* | `AKADEMIK` | `Subject` catalog | Studi Umum comprises exactly 6 canonical subjects: Matematika (`MP-SU-01`), Bahasa Inggris (`MP-SU-02`), IPS (`MP-SU-03`), IPA (`MP-SU-04`), Bahasa Indonesia (`MP-SU-05`), TIK (`MP-SU-06`). | `lib/server/pendidikan-v2-service.ts`, `types/architecture-lock.ts` | `tests/milestone3-3b-pendidikan-foundation.test.ts` | Catalog query verification log | **PASS** *(Code & unit test verified; DB sync in C2C)* |
| **TR-CURR-02** | **Kepesantrenan Canonical 5 Subjects** *(M3.2 UAT #5, M3.3B)* | `AKADEMIK` | `Subject` catalog | Kepesantrenan comprises exactly 5 canonical subjects: Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid. | `lib/server/pendidikan-v2-service.ts`, `types/architecture-lock.ts` | `tests/milestone3-3b-pendidikan-foundation.test.ts` | Catalog query verification log | **PASS** *(Code & unit test verified; DB sync in C2C)* |
| **TR-ATT-01** | **Halaqoh Attendance MASBUK Removal** *(M3.2 UAT #7)* | `TAHFIZH` | `TahfizhAttendance` / UI options | `MASBUK` is strictly removed for NEW entries (`HADIR`, `SAKIT`, `IZIN`, `ALFA`). Historical `MASBUK` records are immutably preserved (no deletion). | `dashboard-musyrif-tahfizh.tsx`, attendance helpers | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 7) | New entry selector options inspection | **PASS** *(Code & unit test verified)* |
| **TR-ATT-02** | **Tahajjud Attendance SHOLAT / ALFA Only** *(M3.2 UAT #8)* | `KEASRAMAAN` | `TahajjudAttendance` / UI options | Tahajjud attendance offers exactly two selectable choices for new entry: `SHOLAT` and `ALFA`. Historical records preserved safely. | `dashboard-musyrif-tahfizh.tsx`, attendance helpers | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 8) | New entry selector options inspection | **PASS** *(Code & unit test verified)* |
| **TR-OPER-01** | **OSDA Putri Technical Account Contract** *(M3.2 UAT #10)* | `KEASRAMAAN` / `OSDA` | `User`, `Assignment`, `OrgUnit` | Technical account for santriwati operations (`AccountType.UNIT`) placed in OSDA PUTRI (`OU-OSDA-PUTRI`, `genderComplex: "PUTRI"`). Single active placement, human executor verification, zero PUTRA data leakage. | `types/architecture-lock.ts`, `lib/auth/canonical-evaluator.ts` | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 9) | Placement audit query + boundary denial test log | **NOT_READY** *(Pending C2C account provisioning)* |
| **TR-OPER-02** | **Backdated Tahfizh Setoran Validation** *(M3.2 UAT #13)* | `TAHFIZH` | `TahfizhSetoran` (`tanggalSetoran`, `occurredAt`, `createdAt`) | Date picker allows default today WITA, permits past dates with audit trail, strictly rejects future dates. Immutable `createdAt` system timestamp preserved. | `lib/tahfizh-persistence.ts`, `app/actions/tahfizh.ts` | `tests/milestone3-2-uat-business-rules.test.ts` (Sec 11) | Setoran mutation log showing valid past date & rejected future date | **PASS** *(Code & unit test verified)* |
| **TR-AUTH-01** | **Substitute / Badal Teacher Fail-Closed Guard** *(M3.3C1)* | `AKADEMIK` | `EducationSession` (`scheduledStaffId`) | Non-scheduled teacher starting a session fails closed with `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED` until Business Owner authorizes badal rules. Code guard and test verified, but runtime remains inactive until production flag activation. | `lib/server/pendidikan-v2-service.ts` (`PendidikanV2Service.startEducationSession`) | `tests/milestone3-3c1-real-postgres.test.ts` (Sec 4.1) | Substitute denial error response log | **PASS / NOT_ACTIVE** *(CODE_GUARD = PASS; TEST_VERIFICATION = PASS; PRODUCTION_RUNTIME_ACTIVATION = NOT_ACTIVE / NOT_READY)* |
| **TR-AUTH-02** | **Pendidikan V2 Server Feature Flag Gate** *(M3.3C1)* | `AKADEMIK` | Runtime Environment Variable | `PENDIDIKAN_V2_UAT_ENABLED` must be `true` on server. When `false`, all session mutations fail closed with `PENDIDIKAN_V2_UAT_NOT_ENABLED`. Client-side hiding alone is never trusted. | Direct server-side check `process.env.PENDIDIKAN_V2_UAT_ENABLED === "true"` in `lib/server/pendidikan-v2-service.ts` | `tests/milestone3-3c1-real-postgres.test.ts` | Server flag denial response log | **PASS** *(Code & test verified; last-known release state / requires fresh production verification)* |
| **TR-AUTH-03** | **Pendidikan V2 Server Schema Readiness Guard** *(M3.3C1)* | `AKADEMIK` | Database Information Schema Catalog | Queries database catalog for required tables and enums. If missing, throws `PENDIDIKAN_V2_SCHEMA_NOT_READY` instead of returning fake empty arrays. | `lib/server/pendidikan-v2-service.ts` (`PendidikanV2Service.checkSchemaReadiness()`) | `tests/milestone3-3c1-real-postgres.test.ts` | Catalog missing error response log | **PASS** *(Code & test verified; last-known point-in-time / requires fresh production verification)* |
| **TR-ACCT-01** | **`razan.mt` Decommission & Linkage Prohibition** *(Owner Decision 2026-09-19)* | `CORE` / `AUTH` | `User` (`razan.mt`), `Staff` (`STF-0003`) | `razan.mt` is targeted for decommission via schema-supported deactivation/revocation (e.g. `status = NONAKTIF` or `SUSPENDED`, login disabled). Strictly PROHIBITED from linking to Staff `STF-0003` (or any Staff profile). Zero canonical capabilities. Pre-decommission read-only audit required. | `docs/STQ_M3_RELEASE_MANIFEST.md`, `tests/milestone3-3c1-real-postgres.test.ts` | Automated linkage prohibition assert | Read-only audit log confirming zero active dependencies | **BLOCKED** *(Pre-decommission audit pending)* |
| **TR-ACCT-02** | **`musyrif.tahifzh` Business Owner Designation** *(Owner Decision 2026-09-19)* | `CORE` / `AUTH` | `User` (`musyrif.tahifzh`), `Staff` | Designated by Business Owner as operational Kabid Tahfizh account. Staff linkage: `UNKNOWN / MUST_VERIFY_READ_ONLY`. Do NOT assume or invent specific Staff ID linkage (`STF-0002` or `STF-0003`). Must be verified read-only before C2C provisioning. Spelling preserved as designated. | `docs/STQ_M3_RELEASE_MANIFEST.md` | Pre-provisioning read-only check | Database user query log confirming existence and exact linkage state | **BLOCKED** *(Read-only verification pending)* |

---

## 4. Capability Registry Traceability Summary

All 9 canonical UAT capabilities are registered in architectural definitions and verified across code and test suites:

```typescript
// types/architecture-lock.ts
export const CANONICAL_UAT_CAPABILITIES = [
  "academic.schedule.read",      // TR-ACAD-01 (Registration: REQUIRED; Grant Policy: PROPOSED_TBD / BLOCKED)
  "academic.session.start",       // TR-ACAD-02 (Registration: REQUIRED; Grant Policy: PROPOSED_TBD / BLOCKED)
  "academic.material.record",     // TR-ACAD-03 (Registration: REQUIRED; Grant Policy: PROPOSED_TBD / BLOCKED)
  "academic.attendance.record",   // TR-ACAD-04 (Registration: REQUIRED; Grant Policy: PROPOSED_TBD / BLOCKED; Kepesantrenan only)
  "tahfizh.recap.read",           // TR-TAHF-01 (Approved UAT Target)
  "tahfizh.reward.issue",         // TR-TAHF-02 (Approved UAT Target)
  "tahfizh.target.manage",        // TR-TAHF-03 (Approved UAT Target)
  "keasramaan.permission.read",   // TR-ASR-01 (Approved UAT Target)
  "keasramaan.permission.create", // TR-ASR-02 (Approved UAT Target)
] as const;
```

### Readiness Gap Classification for UAT Activation
| Capability Code | Code Definition | Test Coverage | Server Guard | Schema Availability (Production) | Position Grant Policy | Overall Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `academic.schedule.read` | **PASS** | **PASS** | **PASS** | **BLOCKED** *(Needs C2B)* | **PROPOSED_TBD / BLOCKED** *(Teacher modality & containment)* | **BLOCKED** |
| `academic.session.start` | **PASS** | **PASS** | **PASS** | **BLOCKED** *(Needs C2B)* | **PROPOSED_TBD / BLOCKED** *(Teacher modality & containment)* | **BLOCKED** |
| `academic.material.record` | **PASS** | **PASS** | **PASS** | **BLOCKED** *(Needs C2B)* | **PROPOSED_TBD / BLOCKED** *(Teacher modality & containment)* | **BLOCKED** |
| `academic.attendance.record`| **PASS** | **PASS** | **PASS** | **BLOCKED** *(Needs C2B)* | **PROPOSED_TBD / BLOCKED** *(Kepesantrenan only; Studi Umum DEFERRED)* | **BLOCKED** |
| `tahfizh.recap.read` | **PASS** | **PASS** | **PASS** | **PASS** *(Core tables exist)* | **APPROVED** *(Pending C2C accounts)* | **NOT_READY** |
| `tahfizh.reward.issue` | **PASS** | **PASS** | **PASS** | **BLOCKED** *(Needs C2B/C2C)*| **APPROVED** *(Pending C2C accounts)* | **NOT_READY** |
| `tahfizh.target.manage` | **PASS** | **PASS** | **PASS** | **PASS** *(Core tables exist)* | **APPROVED** *(Pending C2C accounts)* | **NOT_READY** |
| `keasramaan.permission.read`| **PASS** | **PASS** | **PASS** | **PASS** *(Core tables exist)* | **APPROVED** *(Pending C2C accounts)* | **NOT_READY** |
| `keasramaan.permission.create`| **PASS** | **PASS** | **PASS** | **PASS** *(Core tables exist)* | **APPROVED** *(Pending C2C accounts)* | **NOT_READY** |

---

## 5. Fail-Closed Audit Trail & Evidence Integrity Standard

Every row in this matrix transitions from `NOT_READY` to `PASS` **only** upon generation of an audited, immutable Evidence Pack satisfying:
1. **Cryptographic Checksum**: SHA-256 hash of all input commands, sanitized server responses, and database state records.
2. **Authoritative Timestamp**: Recorded in UTC and WITA (Asia/Makassar, UTC+8).
3. **Execution Identity**: Recorded authenticated user ID and staff ID of executor.
4. **Dual Verification**: Confirmed by both automated diagnostic suite (`checkPendidikanV2ProductionReadiness`) and independent audit inspection.
