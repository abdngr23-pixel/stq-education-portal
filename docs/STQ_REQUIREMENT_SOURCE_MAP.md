# STQ EDUCATION PORTAL — REQUIREMENT SOURCE PROVENANCE MAP

**Document Path:** `docs/STQ_REQUIREMENT_SOURCE_MAP.md`
**Purpose:** Canonical Provenance Registry for Foundational Business Requirement Documents
**Authority Level:** Level 0 / Level 4 Source Mapping (per `STQ_PROJECT_CONTEXT.md`)
**Status:** ACTIVE PROVENANCE REGISTRY
**Last Updated:** 2026-09-19

---

## 1. Provenance Registry Governance

This registry documents the authoritative institutional business documents and owner decisions that establish the requirements for STQ Education Portal.

### Repository Source Integrity Rule
- **Physical vs Referenced Sources**: The authoritative institutional business documents listed below were authored by STQ Darul Ulum Cendekia leadership. Unless explicitly committed to the repository, they exist outside the Git working tree. Coding agents and reviewers must **NOT** claim the repository contains physical copies of uncommitted documents.
- **Precedence & Supersedence**:
  $$\text{Newest Explicit Business Owner Decision} \succ \text{STQ\_OWNER\_DIRECTIVES.md} \succ \text{Primary Domain Source} \succ \text{Historical Specs}$$
- **Non-Cancellation by Omission**: The absence of an institutional requirement from summary documents does **NOT** mean it is cancelled. Only an explicit newer directive with `SUPERSEDES` or `SUPERSEDED_BY` may alter or replace an earlier requirement.

---

## 2. Foundational Business Requirement Sources

### SOURCE-TAH-001 | Acuan Program Tahfidz STQ DUC 2026
- **Source ID:** `SOURCE-TAH-001`
- **Title:** ACUAN PROGRAM TAHFIDZ STQ DUC 2026
- **Date:** 2026
- **Physical File in Repo:** No (external institutional reference document).
- **Authority:** **PRIMARY BUSINESS SOURCE FOR TAHFIZH PROGRAM**
- **Rule:** Unless explicitly superseded by a newer Business Owner directive recorded in `docs/STQ_OWNER_DIRECTIVES.md`, all Tahfizh domain implementations must strictly conform to this source.
- **Core Scope:**
  - Purpose: mutqin memorization, muroja'ah habituation, quality evaluation, Qur'anic character and discipline.
  - Program Components: SABAQ, SABAQI, MANZIL, MUFAR, RUBU', TASMI', IKHTIBAR AWWAL, IKHTIBAR TSANI, SIMA'AN.
  - Target Pekanan: 2, 3, 4, or 5 pages/week based on individual santri assessment.
  - SABAQ: minimum 1/2 or 1 page/day; setoran at Subuh halaqoh.
  - SABAQI: cumulative weekly retention (Mon = today; Tue = Mon–Tue; Wed = Mon–Wed; Thu = Mon–Thu; Fri = Mon–Fri).
  - MANZIL: systematic long-term memorization retention.
  - MUFAR: tier-based revision volume (1–5 juz: 1 juz/day; 6–10 juz: 2 juz/day; 11–15 juz: 3 juz/day; 16–20 juz: 4 juz/day; 21–30 juz: 5 juz/day).
  - Kenaikan Juz: Rubu' (1/4 juz) $\rightarrow$ Tasmi' (1 juz) $\rightarrow$ Ikhtibar Awwal (Musyrif Halaqoh) $\rightarrow$ Ikhtibar Tsani (Kepala Sekolah).
  - SIMA'AN: bil-ghaib once sitting for every multiple of 5 juz.
  - Rewards: Tasmi' 1 juz (1 bintang + libur 1 hari); Sima'an 5 juz (1 bintang + libur 1 hari).
  - Sanctions: Daily target failure $\rightarrow$ jalan jongkok keliling lapangan; Monthly target failure $\rightarrow$ kehilangan hak kunjungan bulanan orang tua.

---

### SOURCE-KEA-001 | PRD Keasramaan V2
- **Source ID:** `SOURCE-KEA-001`
- **Title:** PRD KEASRAMAAN V2
- **Date:** 2026
- **Physical File in Repo:** No (institutional PRD; structural aspects reflected in `docs/STQ_MILESTONE3_1_KEASRAMAAN_STRUCTURE.md`).
- **Authority:** **PRIMARY BUSINESS SOURCE FOR KEASRAMAAN**
- **Rule:** Authoritative baseline for Keasramaan workflows, subject to explicitly documented newer Business Owner decisions and architecture/security hardening.
- **Core Scope:**
  - Organizational Hierarchy: Mudir $\rightarrow$ Musyrif/Kepala Keasramaan $\rightarrow$ Mudabbir (Pembina Kamar) $\rightarrow$ OSDA & TKS $\rightarrow$ Usroh / Santri.
  - OSDA Structure: Pengurus Inti (Ketua, Sekretaris, Bendahara, Multimedia) and 5 Divisi (Keamanan, Pendidikan/Ibadah, Kebersihan, Kesehatan, Sarpras).
  - TKS Units: Dapur dan Gizi, Masjid, Kantor Pendidikan, Kantor Yayasan, Air Minum, Air Sumur.
  - Checklist System: Versioned checklist templates, scheduled runs (daily, multiple-times/day, weekly, monthly, incidental), Needs Correction, Completed, offline idempotency via clientRequestId.
  - Perizinan Workflow: Santri self-request (individual pending) vs Mudabbir/Musyrif operational input (individual tickets per santri). Musyrif approvals direct; Mudabbir same-day direct; Mudabbir pulang/menginap escalated to Musyrif.
  - Discipline Baseline: Pasal 7 Revisi 2. Point whitewash monthly; SP/ST tracking separate.
  - Health Baseline: Canonical statuses `DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`. Optional diagnosis; no fake health defaults.
  - Sarpras Baseline: Inventaris and Kerusakan & Perbaikan. Procurement flows to Musyrif Keasramaan (not OSDA Bendahara).

---

### SOURCE-PEND-001 | Alur Pendidikan Santri STQ DUC
- **Source ID:** `SOURCE-PEND-001`
- **Title:** ALUR PENDIDIKAN SANTRI STQ DARUL ULUM CENDEKIA
- **Date:** 2026
- **Physical File in Repo:** No (foundational curriculum document).
- **Authority:** **FOUNDATIONAL EDUCATION SOURCE**
- **Rule:** Establishes initial academic guidelines, dual-track separation, and cohort progression. Where conflicting with `SOURCE-PEND-002`, `SOURCE-PEND-002` supersedes.
- **Core Scope:**
  - Fundamental dual-track division: Studi Umum and Kepesantrenan.
  - Program Pengabdian: mandatory 1-year service following SMA completion.
  - Academic calendar guidelines and Saturday Studi Umum structure.

---

### SOURCE-PEND-002 | Latest Business Owner Studi Umum & Kepesantrenan Decisions
- **Source ID:** `SOURCE-PEND-002`
- **Title:** LATEST BUSINESS OWNER STUDI UMUM & KEPESANTRENAN DECISIONS
- **Date:** 2026-09-19
- **Physical File in Repo:** Yes (formally registered in `docs/STQ_OWNER_DIRECTIVES.md`).
- **Authority:** **SUPERSEDING EDUCATION DETAIL SOURCE**
- **Rule:** Overrides `SOURCE-PEND-001` wherever conflict exists regarding session schedules, weekly PBL structure, and Kepesantrenan schedule ordering.
- **Supersedences Over `SOURCE-PEND-001`:**
  1. **Studi Umum PBL Schedule**: 20 Saturday meetings total across the semester (5 meetings each for IPS, IPA, Bahasa Indonesia, TIK; meetings 1–4 theory, meeting 5 major project = 4 major projects). Supersedes older interpretations reducing PBL to 18 meetings due to Mukaddimah/UAS calendar wording.
  2. **Kepesantrenan Schedule Ordering (Putra)**:
     - Monday: Bahasa Arab (Tingkat I: Ust. Abi Hudzaifah; Tingkat II: Ust. Kamal Mukhtar; Tingkat III: Ust. Andi Quarzy Ayatullah; Durus al-Lughah)
     - Tuesday: Fikih (Ust. Razan)
     - Wednesday: Tafsir (Ust. Mujaddid; Tafsir Terjemahan Per Kata & Tafsir Jalalain)
     - Thursday: Aqidah (Ust. Alwan)
     - Friday: Tajwid (Ust. Mujaddid; Matan Tuhfatul Athfal)
     - *Supersedes older schedule that had Tuesday Tafsir and Wednesday Fikih.*
  3. **Kepesantrenan Schedule (Putri)**:
     - Monday through Friday: Ustazah Lisa Dwina Fitri teaches all five subjects (Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid) for santriwati. Does NOT grant Studi Umum authority.
  4. **Teacher Attendance**:
     - Verified via authenticated "Mulai Pembelajaran" action (`startEducationSession`), recording actual executor and scheduled staff distinctly. No separate manual teacher Hadir form.
  5. **Grading / Assessment State**:
     - Semester evaluations exist institutionally, but detailed grading scales/formulas (TUGAS, UH, UTS, UAS weights, KKM, A/B/C/D) are **NOT YET APPROVED**.

---

## 3. Provenance & Supersedence Cross-Reference Matrix

| Directive / Topic | Derived From | Supersedes | Reason for Supersedence |
| :--- | :--- | :--- | :--- |
| **Tahfizh Program Rules** | `SOURCE-TAH-001` | Generic memorization tracking | Authoritative 2026 curriculum rules instituted by STQ DUC leadership. |
| **Tahfizh Sima'an Reward** | `SOURCE-TAH-001` | Older 2-star claims for 5 juz | `SOURCE-TAH-001` establishes 1 bintang + 1 hari libur per 5 juz Sima'an. |
| **OSDA Multimedia Placement** | `SOURCE-KEA-001` / BO Decision | PRD V2 6-division structure | Multimedia elevated to Pengurus Inti; Divisi standardized to 5. |
| **Kepesantrenan Tue/Wed Subjects** | `SOURCE-PEND-002` | `SOURCE-PEND-001` (Tue Tafsir, Wed Fikih) | Business Owner aligned subject progression: Tue Fikih, Wed Tafsir. |
| **PBL Saturday 20 Meetings** | `SOURCE-PEND-002` | 18-meeting reduction interpretations | Owner confirmed 4 full 5-week blocks = 20 meetings & 4 projects. |
| **Ustazah Lisa Putri Scope** | BO Decision 2026-09-19 | Legacy broad / undefined access | Strict partitioning: Kepesantrenan Putri + Keasramaan Putri + Health Putri detail read; zero Putra leakage; zero Studi Umum. |
