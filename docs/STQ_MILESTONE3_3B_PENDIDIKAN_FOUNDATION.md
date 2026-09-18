# Milestone 3.3B: Pendidikan Foundation (Studi Umum + Kepesantrenan)
**Document Version:** 1.0.0  
**Branch:** `architecture/milestone3-3b-pendidikan-foundation`  
**Base Commit:** `0e12ae9e151577b5caf10b2d3a11c9c2de81e6d9`  
**PR #8 Immutable:** `9068cae5587b7219c394c5c25bf0de07a15b0726`  

---

## 1. Executive Summary

Milestone 3.3B introduces the formal **Pendidikan Foundation** for the STQ Education Portal, establishing complete information architecture and domain modeling for both **Studi Umum** (General Studies) and **Kepesantrenan** (Islamic Boarding Studies).

This milestone operates under strict enterprise safety rules:
- **Zero Production Migrations, Zero Production Writes:** Additive database changes are simulated and verified in an isolated PostgreSQL instance.
- **PR #8 Immutability:** The Tahfizh quality evaluation engine branch remains 100% immutable at commit `9068cae5587b7219c394c5c25bf0de07a15b0726`.
- **Data Honesty & Anti-Corruption:** No invented books or curriculums (Fikih and Aqidah kitab remain `null`/TBD pending official curriculum adoption). No invented assessment formulas or KKM. No unsafe fallback roles.

---

## 2. Information Architecture Separation

The academic domain is divided into two distinct pedagogical tracks (`EducationTrack`):

| Track | Subject Count | Subjects | Delivery Mode |
|---|---|---|---|
| **Studi Umum** | 6 | Matematika, Bahasa Inggris, IPS, IPA, Bahasa Indonesia, TIK | Saturday 3 Jam Pelajaran (JP), 20-week PBL cycles |
| **Kepesantrenan** | 5 | Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid | Monday–Friday 18:30–19:30 WITA (60 min) |

There is zero overlap between tracks. Each subject has a distinct institutional purpose and operational cadence.

---

## 3. Additive Cohort Model (`EducationCohort`)

### 3.1 Domain Decoupling from SMP/SMA
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

### 3.2 Program Level Derivation
Program level (Tingkat 1, 2, or 3) is derived dynamically from cohort entry year relative to the active academic year start year:

$$\text{Program Level} = (\text{activeStartYear} - \text{cohortStartYear}) + 1$$

- Cohort 2026 in Academic Year 2026/2027 $\rightarrow$ **Level 1**
- Cohort 2025 in Academic Year 2026/2027 $\rightarrow$ **Level 2**
- Cohort 2024 in Academic Year 2026/2027 $\rightarrow$ **Level 3**

`Santri.kelas` is completely bypassed for program level determination.

---

## 4. Studi Umum Saturday Schedule & 20-Week PBL Rotation

### 4.1 Saturday 3 JP Schedule Matrix
Studi Umum sessions are scheduled exclusively on Saturdays across three 80-minute Jam Pelajaran (JP) blocks:

- **JP 1:** 08:00 – 09:20 WITA (80 min)
- *Break: 09:20 – 09:35 WITA (15 min)*
- **JP 2:** 09:35 – 10:55 WITA (80 min)
- *Break: 10:55 – 11:05 WITA (10 min)*
- **JP 3:** 11:05 – 12:25 WITA (80 min)

#### Level Matrix:
- **Tingkat 1:** JP 1 Matematika, JP 2 Bahasa Inggris, JP 3 IPS
- **Tingkat 2:** JP 1 IPA, JP 2 Bahasa Indonesia, JP 3 TIK
- **Tingkat 3:** JP 1 TIK, JP 2 Matematika, JP 3 IPA

### 4.2 20-Week Project-Based Learning (PBL) Rotation
Each semester consists of 20 instructional weeks arranged into 4 five-week blocks:
- **Weeks 1–4:** Teori & Penguasaan Konsep (Phase: `TEORI`, Block 1)
- **Week 5:** Eksekusi Proyek Terpadu (Phase: `PROYEK`, Block 1)
- **Weeks 6–9:** Teori & Penguasaan Konsep (Phase: `TEORI`, Block 2)
- **Week 10:** Eksekusi Proyek Terpadu (Phase: `PROYEK`, Block 2)
- **Weeks 11–14:** Teori & Penguasaan Konsep (Phase: `TEORI`, Block 3)
- **Week 15:** Eksekusi Proyek Terpadu (Phase: `PROYEK`, Block 3)
- **Weeks 16–19:** Teori & Penguasaan Konsep (Phase: `TEORI`, Block 4)
- **Week 20:** Eksekusi Proyek Terpadu (Phase: `PROYEK`, Block 4)

Total: **4 major integrated projects** per semester.

---

## 5. Kepesantrenan Schedule & Pedagogical Arabic

### 5.1 Weekly Schedule (Mon–Fri 18:30–19:30 WITA)
- **Senin:** Bahasa Arab
- **Selasa:** Fikih
- **Rabu:** Tafsir
- **Kamis:** Aqidah
- **Jumat:** Tajwid

### 5.2 Arabic Levels I, II, III
Bahasa Arab instruction is organized into pedagogical proficiency tiers (`LEVEL_1`, `LEVEL_2`, `LEVEL_3`) rather than age or external grades.

### 5.3 Operational Scheduling Facts vs Authorization Keys
Teacher assignments (e.g. Ust. H. Jupri, Lc., Usth. Fatimah, S.Pd.) represent historical scheduling operational facts. In the application architecture, authorization is scoped strictly via `authorizeCanonical` against assigned organizational units and roles, rather than hardcoded name strings.

---

## 6. Teacher Attendance Mechanism ("Mulai Pembelajaran")

### 6.1 Scheduled vs Actual Teacher Attribution
When an instructional session begins, the system records teacher presence via the "Mulai Pembelajaran" action:
1. The session transitions from `SCHEDULED` to `STARTED`.
2. The **actual teacher** (`actualTeacherUserId`, `actualTeacherStaffId`) is derived securely from the authenticated server session.
3. The **scheduled teacher** (`scheduledStaffId`, `scheduledTeacherAssignmentId`) is preserved untouched.
4. If a substitute teacher leads the session, both scheduled and substitute teachers are accurately attributed.
5. An audit log (`academic.session.start`) is emitted atomically in the same database transaction. If the audit fails, the session start is rolled back.

---

## 7. Session Gating (Anti-Corruption Engine)

To prevent data corruption, teaching records are gated behind session lifecycle state:
- **Material Entry Gated:** Attempting to record instructional material (`materi`) while the session is `SCHEDULED` throws `SESSION_NOT_STARTED`.
- **Attendance Gated:** Attempting to record santri attendance while the session is `SCHEDULED` throws `SESSION_NOT_STARTED`.
- **Manual Material Entry:** Material must be entered manually by the instructor upon completion of the lesson; auto-advancement is prohibited.
- **Attendance Status Domain:** Kepesantrenan attendance permits strictly `HADIR`, `IZIN`, `SAKIT`, `ALFA`. The status `MASBUK` (applicable only to congregational prayer in keasramaan) is strictly rejected with `INVALID_ATTENDANCE_STATUS`.

---

## 8. Data Honesty & Safety

1. **Kitab References:** Fikih and Aqidah book titles are set to `null` and displayed in the UI as "Menunggu penetapan kurikulum".
2. **Assessment Logic:** No invented KKM (Kriteria Ketuntasan Minimal) or arbitrary grade conversion formulas are added. Assessment scoring remains formally deferred.
3. **Legacy Fallback Elimination:** Removed unsafe fallback `roleStaff: "GA"` in `app/actions/akademik.ts`. Operations now fail closed if the user account lacks an authentic staff binding.
4. **Database Lineage:** All legacy tables (`mata_pelajaran`, `nilai_akademik`, `absensi`, `santri`, `staff`, `users`, `health_cases_v2`) remain completely preserved and unmutated.

---

## 9. Verification & Quality Gates

| Gate | Status | Command / Proof |
|---|---|---|
| Prisma Validate | Passed | `npx prisma validate` |
| Prisma Generate | Passed | `npx prisma generate` |
| TypeScript Check | Passed | `npm run typecheck` |
| Isolated DB Migration | Passed | `simulateM33bMigrationChain` (PR #8 SHA verified, 18 checks passed) |
| Business Rule Tests | Passed | `tests/milestone3-3b-pendidikan-foundation.test.ts` (68/68 proofs) |
| Architecture Lock Tests | Passed | `tests/architecture-lock.test.ts` |
