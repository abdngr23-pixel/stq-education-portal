# Milestone 3.3B: Pendidikan Foundation (Studi Umum + Kepesantrenan)
**Document Version:** 1.4.0 (Milestone 3.3C1: UAT Activation Readiness & Policy Reconciliation)  
**Branch:** `architecture/milestone3-3b-pendidikan-foundation`  
**Base Commit:** `0e12ae9e151577b5caf10b2d3a11c9c2de81e6d9`  
**PR #8 Immutable:** `9068cae5587b7219c394c5c25bf0de07a15b0726`  

---

## 1. Executive Summary

Milestone 3.3B establishes the formal **Pendidikan Foundation** for the STQ Education Portal, providing complete information architecture, domain modeling, and authorization for both **Studi Umum** (General Studies) and **Kepesantrenan** (Islamic Boarding Studies).

The Final Micro-Fix enforces complete **Assessment Deferral** and **Batch Audit Provenance Closure**:
- **Canonical Kepesantrenan Assessment Formally Deferred:** Business Owner has not finalized assessment frequency, components, test structures, UH/UTS/UAS policies, or report aggregation formulas. All new Kepesantrenan assessment mutation UI is disabled (`Belum diaktifkan — format penilaian belum ditetapkan`). No new scores are created or submitted from the canonical workflow. Legacy `NilaiAkademik` structures and historical records remain preserved and readable for backward compatibility.
- **Batch Attendance Authorization Provenance Consistency:** Attendance batch mutations authorize each distinct santri target and require all targets in the batch to resolve to the exact same canonical provenance (`assignmentId`, `positionCode`, `capabilityCode`, `scopeType`, `unitId`). Mixed-provenance batches fail closed with `ATTENDANCE_BATCH_MIXED_AUTHORIZATION_PROVENANCE` with zero database writes.
- **UI Runtime Honesty:** Teacher session actions, lesson material logging, attendance rosters, and assessment forms are honestly disabled pending formal activation.
- **Fail-Closed Unit-Level Academic Containment:** Prisma models lack an explicit relation between academic sessions/assignments and `OrgUnit`. UNIT-level academic containment remains unresolved and fails closed. Cross-domain borrowing of `halaqohId` or `kamarId` into academic `orgUnitIds` is strictly prohibited.
- **Real Service PostgreSQL Integration:** Tests execute actual `PendidikanV2Service` methods (CAS concurrency, audit failure rollback, batch attendance, forensic before/after state diffs) against isolated PostgreSQL database instances.
- **Zero Production Migrations, Zero Production Writes:** Additive schema verified in isolated PostgreSQL simulations.
- **PR #8 Immutability:** PR #8 remains 100% immutable at commit `9068cae5587b7219c394c5c25bf0de07a15b0726`.

---

## 2. Information Architecture Separation

The academic domain is divided into two distinct pedagogical tracks (`EducationTrack`):

| Track | Subject Count | Subjects | Delivery Mode |
|---|---|---|---|
| **Studi Umum** | 6 | Matematika, Bahasa Inggris, IPS, IPA, Bahasa Indonesia, TIK | Saturday 3 Jam Pelajaran (JP @110 min), 20-week PBL rotation |
| **Kepesantrenan** | 5 | Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid | Monday–Friday 18:30–19:30 WITA (60 min) |

There is zero overlap between tracks. Each subject has a distinct institutional purpose and operational cadence.

---

## 3. Additive Cohort Model (`EducationCohort`)

### 3.1 Domain Decoupling from Formal School Class
The portal previously relied on legacy string attributes like `Santri.kelas` (e.g. "7A", "8B", "9A"). To establish a robust 3-year educational progression independent of external school structures, M3.3B introduces the additive `EducationCohort` (`AngkatanProgram`) model:

```prisma
model EducationCohort {
  id                 String               @id @default(uuid())
  code               String               @unique // e.g. "ANGKATAN-2024"
  tahunAjaranMasuk   String               // e.g. "2024/2025"
  startYear          Int                  // e.g. 2024
  isActive           Boolean              @default(true)
  santriMembers      Santri[]
  teachingSessions   EducationSession[]
  createdAt          DateTime             @default(now()) @map("created_at")
  updatedAt          DateTime             @updatedAt @map("updated_at")

  @@map("education_cohorts")
  @@index([startYear])
  @@index([isActive])
}
```

### 3.2 Program Level Derivation (Strict Fail-Closed)
Program level is derived dynamically from cohort entry year relative to the active academic year start year:

$$\text{Program Level} = (\text{activeStartYear} - \text{cohortStartYear}) + 1$$

- Cohort 2026 in Academic Year 2026/2027 $\rightarrow$ **Level 1**
- Cohort 2025 in Academic Year 2026/2027 $\rightarrow$ **Level 2**
- Cohort 2024 in Academic Year 2026/2027 $\rightarrow$ **Level 3**

**Fail-Closed Invariant:** Only levels 1, 2, and 3 are valid. Out-of-program cohorts (e.g. 2026 cohort in 2029/2030 $\rightarrow$ 4, or 2027 cohort in 2026/2027 $\rightarrow$ 0) are strictly rejected with `COHORT_OUT_OF_PROGRAM_BOUNDS`. `Santri.kelas` is never used to infer program level.

---

## 4. Studi Umum Saturday Schedule & 20-Week PBL Rotation

### 4.1 Approved Institutional Saturday Time Slots (110 Minutes)
Studi Umum instructional sessions run on Saturdays across three 110-minute Jam Pelajaran (JP) blocks (Asia/Makassar, WITA):

- **JP I:** 08:00 – 09:50 WITA (110 min)
- *Break: 09:50 – 10:00 WITA (10 min)*
- **JP II:** 10:00 – 11:50 WITA (110 min)
- *Break: 11:50 – 13:30 WITA (100 min - Ishoma)*
- **JP III:** 13:30 – 15:20 WITA (110 min)

### 4.2 Approved Saturday JP Matrix
The schedule matrix forms a Latin square ensuring every cohort receives exactly **1 Mathematics, 1 English, and 1 PBL session** every Saturday:

| Slot | Time (WITA) | Tingkat 1 (Level 1) | Tingkat 2 (Level 2) | Tingkat 3 (Level 3) |
|---|---|---|---|---|
| **JP I** | 08:00 – 09:50 | **Bahasa Inggris** | **Matematika** | **PBL** |
| **JP II** | 10:00 – 11:50 | **Matematika** | **PBL** | **Bahasa Inggris** |
| **JP III** | 13:30 – 15:20 | **PBL** | **Bahasa Inggris** | **Matematika** |

### 4.3 20-Week Project-Based Learning (PBL) Rotation
"PBL" is a dynamic slot type resolved via `resolvePblMeeting()` across the 20-week semester:
- **Meetings 1–5 (Block 1):** IPS (Weeks 1–4 Theory, Week 5 Integrated Project)
- **Meetings 6–10 (Block 2):** IPA (Weeks 6–9 Theory, Week 10 Integrated Project)
- **Meetings 11–15 (Block 3):** Bahasa Indonesia (Weeks 11–14 Theory, Week 15 Integrated Project)
- **Meetings 16–20 (Block 4):** TIK (Weeks 16–19 Theory, Week 20 Integrated Project)

Total: **4 major integrated projects** per semester. No cohort receives 2 or 3 PBL sessions in a single Saturday.

---

## 5. Kepesantrenan Schedule & Single Canonical Facts

### 5.1 Weekly Schedule (Mon–Fri 18:30–19:30 WITA)
- **Senin:** Bahasa Arab (KPS-ARB)
- **Selasa:** Fikih (KPS-FQH)
- **Rabu:** Tafsir (KPS-TFS)
- **Kamis:** Aqidah (KPS-AQD)
- **Jumat:** Tajwid (KPS-TJW)

### 5.2 Canonical Teaching Scheduling Facts
Teacher facts represent operational scheduling information (never authorization keys). Duplicate and contradictory lowercase/uppercase representations have been unified into `KEPESANTRENAN_SCHEDULED_FACTS`:

#### PUTRA:
- **Bahasa Arab:**
  - Tingkat I: Ust. Abi Hudzaifah (Durus al-Lughah)
  - Tingkat II: Ust. Kamal Mukhtar (Durus al-Lughah)
  - Tingkat III: Ust. Andi Quarzy Ayatullah (Durus al-Lughah)
- **Fikih:** Ust. Razan (Reference: `null` / TBD)
- **Tafsir:** Ust. Mujaddid (References: Tafsir Terjemahan Per Kata, Tafsir Jalalain)
- **Aqidah:** Ust. Alwan (Reference: `null` / TBD)
- **Tajwid:** Ust. Mujaddid (Reference: Matan Tuhfatul Athfal)

#### PUTRI:
- **All Five Subjects:** Ustazah Lisa Dwina Fitri (Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid)
- References: Bahasa Arab (Durus al-Lughah), Tafsir (Tafsir Terjemahan Per Kata, Tafsir Jalalain), Tajwid (Matan Tuhfatul Athfal), Fikih & Aqidah (`null` / TBD).

*Historical legacy names (Ust. H. Jupri, Lc., Usth. Fatimah, S.Pd.) are removed from M3.3B scheduling facts.*

---

## 6. Authorization Architecture & Trust Boundary Closure

### 6.1 Canonical EducationSession Resource Resolution
Generic `resourceId` in `canonical-evaluator.ts` historically targeted `TasmiSimaan`. To eliminate cross-domain collisions, M3.3B introduces explicit `educationSessionId?: string` in `RequestedResourceContext`.

When evaluating an education session, `createPrismaDataProvider.resolveResourceContext()` authoritatively resolves:
- `orgDomain: "AKADEMIK"`
- `educationSessionId`, `educationTrack`, `subjectId`, `programLevel`, `genderGroup`
- If the session does not exist in the database, resource resolution fails closed (returns `null`).

### 6.2 Fail-Closed Unit Containment & Domain Isolation
- **Unit Containment Status:** In the current schema, `EducationSession` and `EducationTeachingAssignment` do not have an explicit foreign key relation to `OrgUnit`. Consequently, `targetUnitId` is `undefined` and `orgUnitIds` is empty (`[]`). UNIT-level academic containment remains unresolved and fails closed.
- **Cross-Domain Scope Isolation:** To prevent privilege escalation, the canonical evaluator strictly isolates academic evaluations: Tahfizh `halaqohId` and Keasramaan `kamarId` are never borrowed into `orgUnitIds` when evaluating an `AKADEMIK` domain resource or session.
- **Participant Roster and Gender Integrity:** When both `educationSessionId` and `santriId` are supplied, the data provider validates enrollment in `EducationSessionParticipant`. Unenrolled santri fail closed (`return null`). Furthermore, participant gender must strictly match session `genderGroup` (`PUTRA` vs `PUTRI`); mismatched evaluations return `null`.

### 6.3 Fail-Closed Audit Provenance
The service function `validateAuditProvenance` eliminates fabricated fallbacks (`GURU_MAPEL`, `GLOBAL`, `ou-madrasah`). The authorization decision must contain:
- `assignmentId`
- `positionCode`
- `capabilityCode`
- `scopeType`
- `unitId` (from `grantUsed.anchorUnitId` or `evaluatedUnitIds[0]`)

If any field is missing, the service immediately throws `AUTH_DECISION_INCOMPLETE`.

### 6.4 Single Canonical Material Capability
The duplicate capability `academic.session.record_materi` is deprecated and removed. The single canonical capability code is:
```typescript
academic.material.record
```
All 12 academic capabilities are formally cataloged in `docs/STQ_CAPABILITY_CATALOG.md` with `PROPOSED_TBD` status.

---

## 7. Session Lifecycle & Real Concurrency Control

### 7.1 Compare-And-Swap (CAS) Concurrency Protection on Start
To prevent race conditions where two concurrent instructors attempt to start the same scheduled session, `startEducationSession` executes an atomic CAS update:
```typescript
const updateResult = await tx.educationSession.updateMany({
  where: {
    id: sessionId,
    status: "SCHEDULED",
  },
  data: {
    status: "STARTED",
    actualTeacherUserId: actorUserId,
    actualTeacherStaffId: staffId,
    startedAt: new Date(),
  },
});

if (updateResult.count === 0) {
  throw new Error("EDUCATION_SESSION_CONCURRENT_START: Sesi telah dimulai oleh pengajar lain");
}
```
Exactly one teacher wins; the loser receives `EDUCATION_SESSION_CONCURRENT_START` and zero start audit records are created for the losing attempt.

### 7.2 Real PostgreSQL Concurrency Verification
Rather than relying on sequential mock SQL statements, concurrency verification executes `Promise.all([service.startEducationSession(...), service.startEducationSession(...)])` against a live isolated PostgreSQL database instance. The test verifies:
1. Exactly one execution succeeds.
2. The concurrent competitor throws `EDUCATION_SESSION_CONCURRENT_START`.
3. Exactly one `academic.session.start` audit record exists in `audit_events`.
4. Exactly one `actualTeacherUserId` is persisted on the session.

### 7.3 Actual Teacher Ownership
Once a session is `STARTED`, only the `actualTeacherUserId` who started the session is authorized to record instructional material or student attendance. Unrelated authenticated staff are rejected with `ACTOR_NOT_ACTUAL_TEACHER`.

### 7.4 Atomic Material Mutation & Real Audit Rollback
`recordSessionMaterial` updates lesson material (`materi`, `materiRecordedAt`, `materiRecordedByUserId`) inside a database transaction alongside the canonical audit record (`academic.material.record`).
In isolated PostgreSQL verification, when the audit sink is deliberately configured to fail:
- The transaction rolls back completely.
- Material fields on `EducationSession` remain `null` in PostgreSQL.
- Zero audit records are committed.

---

## 8. Attendance Policy & Target Participant Integrity

### 8.1 Track-Safe Attendance Policy
- **Kepesantrenan:** Student attendance is enabled after the session is `STARTED`. Permitted statuses are strictly: `HADIR`, `IZIN`, `SAKIT`, `ALFA`. The status `MASBUK` is strictly rejected.
- **Studi Umum:** Student attendance workflow remains formally **deferred** in M3.3B by Business Owner directive. Calling `recordSessionAttendance` on a `STUDI_UMUM` session throws `STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED`.

### 8.2 Additive Participant Model (`EducationSessionParticipant`)
To prevent arbitrary `santriId` values from being recorded, M3.3B introduces the authoritative roster model:
```prisma
model EducationSessionParticipant {
  id        String           @id @default(uuid())
  sessionId String           @map("session_id")
  santriId  String           @map("santri_id")
  createdAt DateTime         @default(now()) @map("created_at")

  session   EducationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  santri    Santri           @relation(fields: [santriId], references: [id], onDelete: Cascade)

  @@unique([sessionId, santriId])
  @@map("education_session_participants")
  @@index([sessionId])
  @@index([santriId])
}
```

### 8.3 Batch Attendance Atomic Authorization & Forensic Audit
When recording session attendance:
1. **Canonical Human Executor Verification:** Rejects unauthenticated or inactive actor contexts (`HUMAN_EXECUTOR_VERIFICATION_FAILED`).
2. **Per-Target Pre-Transaction Authorization:** The service validates canonical authorization (`academic.attendance.record`) for every santri in the batch *prior* to opening the database transaction. If any santri evaluation fails or is unenrolled, the entire batch is rejected.
3. **Uniform Canonical Provenance Consistency:** Requires every target santri evaluation in the batch to resolve to the exact same canonical authorization provenance (`assignmentId`, `positionCode`, `capabilityCode`, `scopeType`, `unitId`). If multiple targets resolve to divergent provenances, the service fails closed with `ATTENDANCE_BATCH_MIXED_AUTHORIZATION_PROVENANCE` before the database transaction opens, guaranteeing zero database writes and preserving single-audit semantic integrity.
4. **Forensic Before/After State Capture:** The service queries existing attendance records prior to upserting, recording complete before/after status diffs (`{ records: [{ santriId, status }] }`) in the audit payload.
5. **All-or-Nothing Transaction:** If an audit recording error occurs, all attendance upserts in the transaction roll back atomically.

---

## 9. Deferred Policies

### 9.1 Canonical Kepesantrenan Assessment Policy: Formally Deferred
- **Canonical Status:** DEFERRED.
- **Legacy Compatibility:** Existing legacy `NilaiAkademik` structures and historical database records are preserved intact for compatibility and historical audit purposes. Existing records remain readable in read-only tables.
- **Non-Invention Guarantee:** Milestone 3.3B does NOT approve or establish:
  - `TUGAS`, `UH`, `UTS`, or `UAS` as approved Kepesantrenan policy (these exist solely as legacy schema enum values).
  - Numeric 0–100 scale requirements.
  - Automatic letter grade predicate conversions (`A`, `B`, `C`, `D`).
  - Passing thresholds (KKM).
  - Score weighting or semester report aggregation formulas.
- **UI Mutation Gating:** All new Kepesantrenan assessment mutation UI is disabled in `components/modules/akademik-module.tsx`. The interface displays an honest disabled card: *"PENILAIAN KEPESANTRENAN: Belum diaktifkan — format penilaian belum ditetapkan."* with no editable score inputs, no evaluation type selectors, and no mutation submit buttons. No new Kepesantrenan scores can be submitted from the M3.3B canonical workflow.

### 9.2 Studi Umum Assessment Boundary
- Studi Umum grading and assessment redesign is excluded from M3.3B and remains deferred. Legacy academic functionality is strictly preserved where it exists, cleanly decoupled from the new canonical Pendidikan session foundation.

### 9.3 Substitute Teacher Authorization Matrix
- The substitute authorization matrix remains `PROPOSED_TBD` pending formal administrative policy and business owner sign-off.

### 9.4 UI Dynamic Session Action Activation
- Dynamic UI session lifecycle mutations (starting session, inputting material, taking attendance) remain disabled in `AkademikModule` until Milestone 3.3C activation.

---

## 10. Quality Gates & Verification

| Gate | Status | Command / Proof |
|---|---|---|
| Prisma Validate | Passed | `npx prisma validate` |
| Prisma Generate | Passed | `npx prisma generate` |
| TypeScript Project Check | Passed | `npm run typecheck` (0 errors) |
| TypeScript Test Check | Passed | `npm run typecheck:test` (0 errors) |
| ESLint Check | Passed | `npm run lint` (0 errors, 0 warnings) |
| Isolated DB Migration Chain | Passed | `simulateM33bMigrationChain` (PR #8 SHA verified, 20+ checks passed including real PostgreSQL service tests) |
| M3.3B Test Suite | Passed | `tests/milestone3-3b-pendidikan-foundation.test.ts` (All proofs pass) |
| M3.3C1 Test Suite | Passed | `tests/milestone3-3c1-uat-activation-readiness.test.ts` (51/51 tests pass) |
| Full Workspace Test Suite | Passed | `npm test` (All tests pass) |

---

## 11. Milestone 3.3C1: UAT Activation Readiness & Policy Reconciliation

### 11.1. Business Rule Reconciliation Matrix
1. **UAT #3 (Search Result Display):** Latest Business Owner decision dictates **Nama Only** display (`Muhammad Fatih`). Search rows/cards do not include `kelas`, `NIS`, or halaqoh. `Kelas` and `Halaqoh` are provided as independent filter controls.
2. **UAT #5 (Curriculum Separation):** 6 canonical Studi Umum subjects (`Matematika`, `Bahasa Inggris`, `IPS`, `IPA`, `Bahasa Indonesia`, `TIK`) and 5 canonical Kepesantrenan subjects (`Bahasa Arab`, `Fikih`, `Tafsir`, `Aqidah`, `Tajwid`).
3. **UAT #6 (Attendance Vocabulary & Teacher Attendance):** Canonical student attendance statuses are strictly `HADIR`, `IZIN`, `SAKIT`, `ALFA` (`MASBUK` is rejected with zero tolerance). Teacher attendance is not recorded via a manual status dropdown; rather, it is evidenced by the authenticated teacher successfully executing the server action *"Mulai Pembelajaran"*.
4. **Declarative UAT Activation Targets Manifest:** Encoded in `types/architecture-lock.ts` under `UAT_ACTIVATION_TARGETS` with all policies kept in `APPROVED_TARGET_PENDING_TECHNICAL` to guarantee zero unapproved runtime authorization privilege escalation.
5. **Production Readiness Diagnostic Framework:** Implemented in `lib/server/pendidikan-v2-readiness.ts` containing 11 pre-activation safety gates. Inspects schema, unlinked staff accounts, and placement invariants with 100% read-only operations and zero writes.
6. **Explicit Runtime Activation Gate:** `process.env.PENDIDIKAN_V2_UAT_ENABLED === "true"`. When disabled (default), all session start, lesson material, and student attendance mutations fail closed with `PENDIDIKAN_V2_UAT_NOT_ENABLED`.
7. **Production Migration Safety:** 0 production migrations applied; 0 production writes performed. PR #8 commit `9068cae5587b7219c394c5c25bf0de07a15b0726` remains 100% untouched.


