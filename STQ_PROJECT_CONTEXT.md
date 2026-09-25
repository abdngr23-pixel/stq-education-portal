# STQ EDUCATION PORTAL — MASTER PROJECT CONTEXT

**Repository:** `abdngr23-pixel/stq-education-portal`  
**Purpose:** Persistent project context and bootstrap index for human reviewers, ChatGPT, Antigravity, Claude, and other coding agents.  
**Status:** CANONICAL CONTEXT INDEX  
**Rule:** Read this file before making architecture, business-rule, database, authorization, migration, or production decisions.

---

## 1. Why this file exists

STQ Education Portal is a long-running production project whose business rules, authorization model, database schema, organizational structure, and rollout state evolved across many milestones.

No agent may reconstruct the project from `README.md`, UI labels, usernames, role names, stale milestone text, or assumptions.

This file is the mandatory entry point that tells an agent:

- what the system is;
- which documents are authoritative;
- how conflicts are resolved;
- what is structurally locked;
- which rules are live, approved-but-not-live, or still unresolved;
- what must never be inferred;
- where the current production/release state is recorded.

Dynamic release state belongs in:

`docs/STQ_CURRENT_STATE.md`

Do not duplicate changing SHAs and milestone status throughout this file.

---

## 2. Mandatory bootstrap sequence

Before implementation, refactoring, migration work, authorization changes, production operations, or architecture decisions:

1. Read `STQ_PROJECT_CONTEXT.md`.
2. Read `docs/STQ_OWNER_DIRECTIVES.md`.
3. Read `docs/STQ_REQUIREMENT_SOURCE_MAP.md`.
4. Read `docs/STQ_CURRENT_STATE.md`.
5. Read `types/architecture-lock.ts`.
6. Read `docs/STQ_ARCHITECTURE_LOCK.md`.
7. Read the relevant domain source/specification referenced by this file or `STQ_CURRENT_STATE.md`.
8. Inspect the actual source code and database/migration state relevant to the task.
9. Never infer a missing business rule. If a rule is `PROPOSED_TBD` or explicitly unresolved, keep it unresolved.
10. Never treat UI hiding as authorization.
11. Never treat a name, username, legacy role label, or current screen layout as proof of authority.
12. Never mutate production unless the Business Owner has explicitly authorized that exact class of production write.

If a task begins from a new chat/session, this bootstrap sequence still applies.

---

## 3. Authority and conflict precedence

When information conflicts, use this precedence:

### Level 0 — Newest explicit Business Owner decision
`docs/STQ_OWNER_DIRECTIVES.md`
*(with foundational provenance mapped in `docs/STQ_REQUIREMENT_SOURCE_MAP.md`)*

A newer explicit decision from the Business Owner overrides an older decision.

`docs/STQ_OWNER_DIRECTIVES.md` is the canonical repository representation of Level 0 newest explicit Business Owner decisions. Conversational memory of coding agents (ChatGPT, Antigravity, Claude, etc.) is NOT a source of truth. Do NOT allow a newly-created Owner Directive to fabricate a business decision unsupported by Business Owner input.

When such a decision changes a canonical rule, requirement, business rule, account identity, authority, scope, workflow, or acceptance criteria, it must be recorded in `docs/STQ_OWNER_DIRECTIVES.md` in the same workstream before implementation so repository context does not remain stale. Older decisions are never deleted, but marked as SUPERSEDED. Absence of a historical requirement from `STQ_OWNER_DIRECTIVES.md` does NOT mean it is cancelled; foundational sources in `docs/STQ_REQUIREMENT_SOURCE_MAP.md` remain authoritative unless explicitly superseded.

### Level 1 — Machine-checked technical contract
`types/architecture-lock.ts`

Defines canonical technical vocabulary, data shapes, enums, assignment/scope contracts, and authorization primitives.

### Level 2 — Master architecture and boundary specification
`docs/STQ_ARCHITECTURE_LOCK.md`

Defines approved structural architecture, non-negotiable boundaries, organizational topology, capability policy state, and architecture invariants.

### Level 3 — Current release / production state
`docs/STQ_CURRENT_STATE.md`

Defines verified repository checkpoints, current milestone and production state, migration state, blockers, immutable guards, and the next planned or authorized gate.

Embedded commit SHAs are checkpoint references only. The actual live `main` HEAD must always be resolved directly from Git/GitHub.

This file is intentionally updated more frequently than the master context.

### Level 4 — Domain and milestone specifications
Examples include:

- `docs/STQ_COMPATIBILITY_MAP.md`
- `docs/STQ_MILESTONE3_3A_HEALTH_V2_BACKEND.md`
- Pendidikan milestone documents
- UAT activation/readiness documents
- production preflight documents
- other `docs/STQ_*.md` domain specifications

These inherit Levels 0–3 and may not silently override them.

### Level 5 — Historical/product decision records
`PROJECT_DECISIONS.md`

Still binding where not superseded, but it is not a complete description of the current system.

### Level 6 — Implementation and tests
Current implementation and tests are evidence of technical behavior, but legacy behavior does not automatically become approved target policy.

### Level 7 — README
`README.md` is an overview/onboarding document only.

**README IS NOT AN AUTHORITATIVE BUSINESS-RULE OR AUTHORIZATION SOURCE.**

If README conflicts with any higher level, ignore the conflicting README statement and use the higher-level source.

---

## 4. System identity and architectural purpose

STQ Education Portal is the integrated operational portal for STQ Darul Ulum Cendekia.

The system includes or is evolving toward these operational domains:

- Tahfizh and halaqoh
- Keasramaan / kesantrian
- Health / Poskestren
- Pendidikan — Studi Umum
- Pendidikan — Kepesantrenan
- Wali/Santri portals
- Sponsor / Orang Tua Asuh
- Administration and institutional operations
- Audit and authorization infrastructure

The application uses Next.js, TypeScript, Prisma, and PostgreSQL.

Production safety takes precedence over implementation speed.

---

## 5. Canonical authorization architecture

The canonical authorization chain is:

`SESSION`
→ `IDENTITY`
→ `ACTIVE ASSIGNMENTS`
→ `POSITIONS`
→ `CAPABILITIES`
→ `SCOPE`
→ `RESOURCE CONTEXT`
→ `ALLOW / DENY`

Canonical primitives:

- Identity
- Organizational Unit
- Position
- Assignment
- Capability
- Scope
- Server Policy
- UI Derivation
- Audit

### Non-negotiable authorization invariants

- Legacy `Role` is compatibility metadata, not canonical authority.
- Position is not Role.
- AccountType is not Role.
- Names and usernames never grant authority.
- Server-side authorization is authoritative.
- UI hiding is ergonomic only.
- Capability and scope are orthogonal.
- Assignment has an anchor organizational unit.
- `PositionCapability.scopeType` is the source of capability scope.
- `ASSIGNED_UNITS` may use `AssignmentScopeUnit`.
- Multi-grant evaluation is allowed.
- Caller-provided resource IDs are untrusted.
- Resource context must be resolved server-side.
- Missing, invalid, unknown, or unresolved resource context fails closed.
- Data-fetch failure must not be converted into fake healthy values, `[]`, or `0`.
- `Assignment.status` defaults to `DRAFT`.
- `PositionCapability.scopeType` is mandatory and has no implicit permissive default.
- `businessRuleState` defaults to `PROPOSED_TBD`.

Runtime authority requires all of:

- ACTIVE Assignment
- VERIFIED_PRODUCTION PositionCapability
- explicit scope
- matching server-resolved resource context

Otherwise: DENY / FAIL CLOSED.

### BusinessRuleState semantics

`VERIFIED_PRODUCTION`
= approved and live runtime authority.

`APPROVED_TARGET_PENDING_TECHNICAL`
= approved target business policy but **zero runtime authority until deliberately promoted/activated**.

`PROPOSED_TBD`
= proposal or unresolved policy. It grants **zero authority**.

Never promote a state implicitly.

---

## 6. Account model and audit attribution

Canonical account modalities:

- `PERSONAL`
- `UNIT`
- `SUBJECT`

`PERSONAL` represents a human credential. Sensitive operational positions generally require valid active human/Staff linkage.

`UNIT` represents a functional desk, organization, or operational unit credential.

`SUBJECT` represents a technical credential modality for Studi Umum subject accounts (e.g. `mapel.matematika`, `mapel.ipa`). Governed by PR #28 and DIR-2026-027: requires exactly one active binding to a canonical subject, zero fake Staff requirement, subject-scoped access only, and fails closed across subjects.

Every mutating `UNIT` transaction must retain verified human executor attribution.

Canonical mutation audit must preserve, where applicable:

- technical account
- human executor
- action
- entity/resource
- capability
- assignment
- position
- scope
- before state
- after state
- reason
- clientRequestId
- timestamp

Never authorize based on username.

### Stable account invariant: `razan.mt` deprecation & Kabid Tahfizh operational account designation

- `razan.mt` is not the canonical Kabid Tahfizh account.
- Never link or provision `razan.mt` as STF-0003.
- Business Owner designated Kabid Tahfizh operational account: `musyrif.tahifzh`.
- `razan.mt` decommissioning is a controlled production operation, not a documentation-time deletion.
- Preserve historical/audit integrity; dependency audit precedes destructive deletion.

Names/usernames still do NOT grant authority by themselves. Actual authority remains Assignment + Position + Capability + Scope + server-resolved resource context.

---

## 7. Organizational structure — Keasramaan lock

Canonical hierarchy:

Mudir
→ Kepala Keasramaan / Musyrif Keasramaan
→ Mudabbir
→ OSDA & TKS
→ Usroh / Santri

Definitions:

- Kepala Keasramaan = Musyrif Keasramaan.
- Musyrif is not Mudabbir.
- If Kepala Keasramaan exists, do not invent an additional Musyrif layer beneath it.
- Mudabbir is also pembina kamar.
- A Mudabbir may supervise more than one kamar.
- Mudabbir uses one PERSONAL account with authority derived from assignment and scope.
- Higher hierarchy may audit/take over neglected duties, but takeover must preserve the original PIC in audit/context.

### OSDA core

- Ketua
- Sekretaris
- Bendahara
- Multimedia

### OSDA divisions — exact set

- Keamanan & Kedisiplinan
- Pendidikan & Ibadah
- Kebersihan & Kerapihan
- Kesehatan
- Sarpras

Pembina Divisi:

- directly under Musyrif/Kepala Keasramaan;
- outside the OSDA structural hierarchy;
- not the superior of Mudabbir.

Usroh:

- belongs under OSDA generally;
- performs cleaning based on checklist;
- cleanliness division supervises cleanliness execution;
- Usroh is not a structural child exclusively of Divisi Kebersihan.

### TKS — exact service units

TKS = Tugas Khusus Santri.

There is no central Ketua TKS.

Exact service units:

- Dapur dan Gizi
- Masjid
- Kantor Pendidikan
- Kantor Yayasan
- Air Minum
- Air Sumur

TKS Dapur and Masjid may have a local ketua + anggota. Other TKS units may be handled by one designated petugas.

OSDA/TKS/Usroh operational functions may use UNIT accounts only under canonical executor-attribution rules.

---

## 8. Tahfizh core rules

Tahfizh contains legacy production behavior plus canonical target architecture. Do not widen authority from managerial read access into operational write access.

Key current business boundaries:

- Kabid Tahfizh is an organizational position, not a person-name permission.
- Mudir has existing GLOBAL reward authority (`tahfizh.reward.issue` + `GLOBAL`).
- Kabid Tahfizh has existing DOMAIN managerial reward authority (`tahfizh.reward.issue` + `DOMAIN`).
- Reward issuance (`tahfizh.reward.issue`) is strictly restricted to `MUDIR` and `KABID_TAHFIZH` ONLY. `PETUGAS_OPERASIONAL_TAHFIZH` (`musyirfah.putri`), ordinary `MUSYRIF_TAHFIZH`, `PEMBINA_HALAQOH`, and `ADM` are NOT authorized (`CAPABILITY_NOT_GRANTED`). The prior target rule granting POT `ASSIGNED_UNITS` reward issuance is formally SUPERSEDED per `DIR-2026-023`.
- `tahfizh.recap.read` breadth (`GLOBAL` for POT) does not widen reward, target, or setoran write scope.
- Sabaqi is automatically derived from authoritative valid stored SABAQ setoran records within the active temporal weekly window (Monday–Friday). Business semantics require `isManualAllowed = false`. Manual overrides, fake fallbacks, or manual Sabaqi entry with audit reason are strictly prohibited (ORR-067 / DIR-2026-024).
- `MUSYRIF_TAHFIZH` target management scope is `HALAQOH`.
- `PEMBINA_HALAQOH` target management scope is `HALAQOH`.
- Target management is only for assigned halaqoh.
- Institutional/Kabid read breadth does not imply cross-halaqoh setoran write.
- Reward policy editing is Mudir-only.

Operational invariants retained from project decisions:

- Setoran form is a focused single-page workflow; do not reintroduce unnecessary wizard/stepper UX.
- Sabaq starting position follows authoritative previous progress.
- Tahfizh calculations use real stored progress; do not fabricate fallback progress.
- Daily setoran save does not automatically launch WhatsApp.
- Parent messaging is reserved for important events according to approved policy.
- Backdated Tahfizh dates use WITA / Asia-Makassar semantics.
- Halaqoh attendance has no `MASBUK`.

Historical PR #8 has a special migration condition. Always read `docs/STQ_CURRENT_STATE.md` before touching migration history or Tahfizh quality schema.

---

## 9. Health V2 lock

No fake or mock diagnosis may be written in production.

Canonical Health V2 statuses are exactly:

- `DIPANTAU`
- `PULIH`
- `DIRUJUK`
- `DARURAT`

Core health case semantics:

- santri
- complaint / keluhan
- occurred time
- initial treatment
- status
- optional notes
- optional attachment
- optional diagnosis

Detail-access target boundary:

- Health Division / authorized health operator
- responsible Mudabbir / room supervisor within scope
- Musyrif / authorized leadership according to canonical policy

Ketua/Sekretaris OSDA do not receive full clinical detail merely from organizational status.

Wali notification is only for significant statuses/events approved by business policy, including `DIRUJUK` and `DARURAT`, under Musyrif control.

Health checklist policy:

- one general checklist per operational day.

Health inventory ownership:

- Health owns medical inventory and usage records.
- technical repair/maintenance is handed to Sarpras;
- ownership of health inventory does not transfer.

External health-referral authority remains `PROPOSED_TBD` until explicitly approved.

Legacy status bridges are read/translation mechanisms only. They must never silently rewrite historical production rows.

---

## 10. Pendidikan information architecture

PENDIDIKAN contains two distinct domains:

PENDIDIKAN
→ STUDI UMUM

PENDIDIKAN
→ KEPESANTRENAN

They are not generic tabs over one academic model.

They may have separate:

- schedules
- session types
- teacher assignments
- grouping logic
- attendance rules
- assessment rules

Do not mix their canonical subjects or grading policies.

---

## 11. Studi Umum locked rules

Schedule:

Every Saturday.

- JP I: 08.00–09.50
- JP II: 10.00–11.50
- JP III: 13.30–15.20

Weekly fixed subjects:

- Matematika
- Bahasa Inggris

PBL rotation across the 20-week semester (approved canonical subject rotation):

- meetings 1–5: IPS
- meetings 6–10: IPA
- meetings 11–15: Bahasa Indonesia
- meetings 16–20: TIK

*(Per ORR-131 / DIR-2026-025, approved canonical owner rule is purely this 4-block subject rotation across 20 Saturday meetings. Invented pedagogical phases such as theory vs project weeks or phase enums are non-canonical).*

Canonical Studi Umum subjects — exact:

1. Matematika
2. Bahasa Inggris
3. IPS
4. IPA
5. Bahasa Indonesia
6. TIK

Do not use formal SMP/SMA class as the canonical determinant of Studi Umum schedule.

### Cohort / Tingkat model

`EducationCohort` is permanent admission cohort / academic year of entry.

Examples:

- 2024/2025
- 2025/2026
- 2026/2027

Gender does not define cohort.
Formal school class does not define cohort.

Current Studi Umum level is:

- 1
- 2
- 3

It is current program position, not canonically equivalent to school grades 7/8/9.

Permanent cohort never mutates merely because a santri advances level.

Saturday rotation:

JP I:
- Level 1 → Bahasa Inggris
- Level 2 → Matematika
- Level 3 → PBL

JP II:
- Level 1 → Matematika
- Level 2 → PBL
- Level 3 → Bahasa Inggris

JP III:
- Level 1 → PBL
- Level 2 → Bahasa Inggris
- Level 3 → Matematika

Only levels 1–3 are currently supported. Unsupported levels fail closed.

Gap/repeater/transfer policy remains unresolved.

---

## 12. Teacher session / attendance architecture

There is no separate teacher-attendance form in the canonical target flow.

Teacher:

login
→ scheduled session
→ click `Mulai Pembelajaran`

Successful server-authorized start-session action is the attendance evidence.

Persist separately:

- scheduled teacher
- actual authenticated executor
- actual Staff
- startedAt
- session

If a substitute starts a session, never pretend the scheduled teacher attended.

Substitute/badal authorization architecture may exist, but the exact authorization matrix remains unresolved unless `STQ_CURRENT_STATE.md` says otherwise.

Actual teacher identity is derived server-side. Caller may not submit arbitrary teacher identity as proof.

After a valid start, session actions such as attendance/material entry may be unlocked according to approved domain policy and actual-teacher ownership.

---

## 13. Kepesantrenan foundation

Schedule:

Monday–Friday, ba'da Maghrib until before Isya, approximately 18.30–19.30 WITA.

Canonical Kepesantrenan subjects — exact:

- Bahasa Arab
- Fikih
- Tafsir
- Aqidah / Aqidah Islamiyah
- Tajwid

Putra baseline scheduling:

Monday — Bahasa Arab:
- Tingkat I: Ust. Abi Hudzaifah — Durus al-Lughah
- Tingkat II: Ust. Kamal Mukhtar — Durus al-Lughah
- Tingkat III: Ust. Andi Quarzy Ayatullah — Durus al-Lughah

Tuesday — Fikih:
- Ust. Razan
- reference currently unresolved unless updated in current state

Wednesday — Tafsir:
- Ust. Mujaddid
- Tafsir Terjemahan Per Kata + Tafsir Jalalain

Thursday — Aqidah:
- Ust. Alwan
- reference currently unresolved unless updated in current state

Friday — Tajwid:
- Ust. Mujaddid
- Matan Tuhfatul Athfal

Bahasa Arab Tingkat I/II/III are pedagogical ability levels, not SMP/SMA levels.

Other putra Kepesantrenan subjects do not inherit a Tingkat split unless explicitly defined.

Putri scheduling baseline is handled as defined by the approved Pendidikan specification; person names are scheduling data, never authorization proof.

Material is entered by the actual authorized teacher. Do not auto-generate curriculum progression.

### Kepesantrenan attendance

Exact student-attendance vocabulary:

- `HADIR`
- `IZIN`
- `SAKIT`
- `ALFA`

No `MASBUK`.

### Kepesantrenan grading

Canonical new Kepesantrenan grading remains deferred unless explicitly approved later.

Do not invent:

- TUGAS
- UH
- UTS
- UAS
- 0–100 canonical grading
- letter grades
- KKM
- weighting
- final-grade formula

Legacy academic-grade structures may remain for compatibility but do not become new canonical Kepesantrenan policy automatically.

---

## 14. Product/data honesty invariants

Across all modules:

- no fake diagnosis;
- no fake healthy state;
- no mock production data;
- no fake empty arrays or zeros on query failure;
- no automatic old-point duplication;
- no automatic SP unless current canonical policy explicitly approves it;
- no hidden production writes to “repair” data;
- no automatic cohort inference from gender, current class, or age;
- no authorization inferred from display name or username;
- no business rule inferred merely because legacy code once implemented it.

Error/loading/empty/permission/offline states must remain honest.

---

## 15. Mobile/UI invariants

Current institutional UI principles include:

- true mobile reflow;
- no horizontal overflow;
- approximately 44×44 minimum touch targets;
- no hover-only critical controls;
- one canonical mobile bottom navigation;
- respect safe-area insets;
- avoid decorative UI patterns that harm clarity;
- official logos must not be distorted.

UI may reflect authorization but never replaces server enforcement.

---

## 16. Production safety and trust model

Standing workflow:

Antigravity implements
→ Antigravity reports
→ independent GitHub audit
→ compare report against actual repository
→ audit security and business rules
→ explicit Business Owner authorization
→ merge/release action

Rules:

- Never treat an Antigravity report as proof of PASS.
- Local test PASS is not production PASS.
- Verify actual main HEAD, PR HEAD, diff/files, CI on exact HEAD, deployment state, merge status, and protected PR integrity.
- Production default is READ ONLY.
- Do not run migration, seed, backfill, capability promotion, account provisioning, feature-flag activation, or other production writes without explicit authorization.
- Before a major transition, consolidate implemented state, decisions, unresolved items, audit findings, no-touch invariants, and exact baseline.
- Prompts to coding agents must define scope, business rules, acceptance tests, git constraints, production constraints, and final report format.

### Sequential Release Gate Model (Gates 0–9)
Per DIR-2026-029, the official production release sequence is strictly governed by sequential Gates 0 through 9:
- **Gate 0:** Production backup + checksum + isolated restore + restored-T0 XLSX snapshot (`STQ_PRODUCTION_T0.sql`, `STQ_PRODUCTION_SNAPSHOT_T0.xlsx` with exactly 15 required sheets)
- **Gate 1:** Production migrations (`prisma migrate deploy`)
- **Gate 2:** Post-migration schema reconciliation
- **Gate 3:** Foundation / provisioning
- **Gate 4:** Post-provision reconciliation
- **Gate 5:** Runtime activation
- **Gate 6:** Readiness verification
- **Gate 7:** Live UAT
- **Gate 8:** Final gap / decommission verification
- **Gate 9:** Evidence / sign-off / release baseline

Current lifecycle point: **PRE-GATE RECONCILIATION**. PR #29 and PR #30 code hardening ("Gate 5 remediation") do NOT constitute execution of Release Gate 5. Production actions = 0.

---

## 17. PR #8 special guard

PR #8 is a protected historical branch/PR with a production-applied migration special condition.

Do not:

- merge PR #8 wholesale;
- rebase it casually;
- squash it;
- cherry-pick its feature/runtime implementation wholesale;
- modify it merely to simplify migration history.

The exact current PR #8 state, SHA, migration checksum, and authorized reconciliation scope are recorded in:

`docs/STQ_CURRENT_STATE.md`

Always read that file before migration work.

---

## 18. Current unresolved business decisions

Unless a newer explicit Business Owner decision is documented, do not invent answers for unresolved areas such as:

- permanent cohort mapping for current active santri;
- teacher account modality where still undecided (resolved for Studi Umum as `SUBJECT` modality per PR #28 / DIR-2026-027, and for Kepesantrenan as `PERSONAL` modality under `GURU_KEPESANTRENAN` per PR #29 / DIR-2026-028; other academic modalities remain pending explicit policy);
- badal/substitute teacher authorization matrix;
- cohort gap/repeater/transfer policy;
- new canonical Kepesantrenan grading;
- Fikih reference;
- Aqidah reference;
- Keasramaan approval authority (`approve_mk` / `approve_ks`);
- Health external referral authority;
- exact activation/promotion timing of target PositionCapabilities.

The list may evolve. `docs/STQ_CURRENT_STATE.md` is the release-time authority for what remains unresolved.

---

## 19. README and stale-document rule

README and old milestone documents may contain accurate historical context but can also contain superseded policies.

Do not delete history solely because it is stale.

Instead:

- preserve historical evidence where useful;
- clearly classify what is authoritative now;
- use document precedence;
- update canonical context when policy changes;
- never resurrect a superseded rule just because it exists in an older file.

---

## 20. Context maintenance rule

### Invariant: Non-self-referential Git HEAD truth

- Actual Git refs/HEAD must always be queried directly from Git/GitHub before implementation, audit, merge, migration, deployment, or production operations.
- Repository documents record verified checkpoints, not self-updating Git HEAD truth.
- Never trust an embedded SHA as proof that it is still the live `main` HEAD.

After every major milestone merge, migration, production provisioning step, or business-policy change:

1. update `docs/STQ_CURRENT_STATE.md`;
2. update this file only if a stable architectural/business invariant changed;
3. update the relevant domain specification;
4. do not duplicate volatile SHAs across many documents;
5. keep unresolved decisions explicit;
6. keep production safety state explicit.

The repository, not conversational memory, is the persistent project brain.
