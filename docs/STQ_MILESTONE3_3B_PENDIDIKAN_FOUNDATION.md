# Milestone 3.3B: Pendidikan Foundation (Studi Umum + Kepesantrenan)
**Document Version:** 1.1.0 (Remediation Round 1)  
**Branch:** `architecture/milestone3-3b-pendidikan-foundation`  
**Base Commit:** `0e12ae9e151577b5caf10b2d3a11c9c2de81e6d9`  
**PR #8 Immutable:** `9068cae5587b7219c394c5c25bf0de07a15b0726`  

---

## 1. Executive Summary

Milestone 3.3B establishes the formal **Pendidikan Foundation** for the STQ Education Portal, providing complete information architecture, domain modeling, and authorization for both **Studi Umum** (General Studies) and **Kepesantrenan** (Islamic Boarding Studies).

Remediation Round 1 corrects institutional scheduling facts, aligns operational time slots with approved institutional schedules, hardens authorization against race conditions and spoofing, and enforces participant boundary integrity.

Strict enterprise safety guarantees:
- **Zero Production Migrations, Zero Production Writes:** Database changes are additive, verified in isolated PostgreSQL simulations.
- **PR #8 Immutability:** The Tahfizh quality evaluation engine branch remains 100% immutable at commit `9068cae5587b7219c394c5c25bf0de07a15b0726`.
- **Data Honesty & Anti-Corruption:** No invented kitab or curriculums (Fikih and Aqidah kitab remain `null`/TBD). Assessment scoring and passing thresholds (KKM) remain strictly deferred.
- **Fail-Closed Authorization & Audit Provenance:** Zero fabricated fallbacks for positions, scopes, or units. Canonical resource resolution explicitly isolates EducationSession from Tahfizh Tasmi resources.

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

## 6. Authorization Architecture & Audit Provenance

### 6.1 Canonical EducationSession Resource Resolution
Generic `resourceId` in `canonical-evaluator.ts` historically targeted `TasmiSimaan`. To eliminate cross-domain collisions, M3.3B introduces explicit `educationSessionId?: string` in `RequestedResourceContext`.

When evaluating an education session, `createPrismaDataProvider.resolveResourceContext()` authoritatively resolves:
- `orgDomain: "AKADEMIK"`
- `educationSessionId`, `educationTrack`, `subjectId`, `programLevel`, `genderGroup`
- Anchor unit from scheduled teaching assignment if relationally bound.
- If the session does not exist in the database, resource resolution fails closed (returns `null`).

### 6.2 Fail-Closed Audit Provenance
The service function `validateAuditProvenance` eliminates fabricated fallbacks (`GURU_MAPEL`, `GLOBAL`, `ou-madrasah`). The authorization decision must contain:
- `assignmentId`
- `positionCode`
- `capabilityCode`
- `scopeType`
- `unitId` (from `grantUsed.anchorUnitId` or `evaluatedUnitIds[0]`)

If any field is missing, the service immediately throws `AUTH_DECISION_INCOMPLETE`.

### 6.3 Single Canonical Material Capability
The duplicate capability `academic.session.record_materi` is deprecated and removed. The single canonical capability code is:
```typescript
academic.material.record
```

---

## 7. Session Lifecycle & Concurrency Control

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

### 7.2 Actual Teacher Ownership
Once a session is `STARTED`, only the `actualTeacherUserId` who started the session is authorized to record instructional material or student attendance. Unrelated authenticated staff are rejected with `ACTOR_NOT_ACTUAL_TEACHER`.

### 7.3 Atomic Material Mutation & Audit Rollback
`recordSessionMaterial` updates lesson material (`materi`, `materiRecordedAt`, `materiRecordedByUserId`) inside a database transaction alongside the canonical audit record (`academic.material.record`). If the audit persistence fails, the material mutation is completely rolled back.

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
Santri must be an enrolled participant of the session. Recording attendance for an unenrolled santri throws `NON_PARTICIPANT_SANTRI_ATTENDANCE_DENIED`.

---

## 9. Deferred Policies

1. **Assessment & Grading:** KKM thresholds, per-meeting scores, UTS/UAS weighting, and grade calculation algorithms remain deferred. No passing marks are invented.
2. **Substitute Teacher Authorization:** The substitute authorization matrix remains `PROPOSED_TBD` pending formal administrative policy.

---

## 10. Quality Gates & Verification

| Gate | Status | Command / Proof |
|---|---|---|
| Prisma Validate | Passed | `npx prisma validate` |
| Prisma Generate | Passed | `npx prisma generate` |
| TypeScript Project Check | Passed | `npm run typecheck` (0 errors) |
| TypeScript Test Check | Passed | `npm run typecheck:test` (0 errors) |
| ESLint Check | Passed | `npm run lint` (0 errors, 0 warnings) |
| Isolated DB Migration Chain | Passed | `simulateM33bMigrationChain` (PR #8 SHA verified, 18 checks passed) |
| M3.3B Test Suite | Passed | `tests/milestone3-3b-pendidikan-foundation.test.ts` (58/58 proofs pass) |
| Full Workspace Test Suite | Passed | `npm test` (1078/1078 tests pass) |
