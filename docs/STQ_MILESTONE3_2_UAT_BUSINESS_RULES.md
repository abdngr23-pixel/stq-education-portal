# STQ EDUCATION PORTAL — MILESTONE 3.2 SPECIFICATION & TRACEABILITY
**UAT Business Rules & Authorization Closure**  
**Document**: `docs/STQ_MILESTONE3_2_UAT_BUSINESS_RULES.md`  
**Status**: `M3_2_AUDIT_READY`  
**Baseline Main**: `b63e60bf08575d11bcadf4b4c87950273af7f6fb`  
**PR #8 Immutable**: `9068cae5587b7219c394c5c25bf0de07a15b0726`  

---

## 1. Executive Summary & Core Architectural Invariants

Milestone 3 Checkpoint M3.2 operationalizes actual User Acceptance Testing (UAT) feedback into authoritative business rule contracts, capability and scope primitives, domain trust boundary enforcement, and low-risk UX corrections, while preserving all locked architectural boundaries:
1. **Authoritative Runtime Boundary**: Legacy runtime authorization remains 100% authoritative in production. Canonical authorization engine runs strictly in shadow/non-authoritative mode (`CANONICAL_AUTH_SHADOW_ENABLED=false`).
2. **Zero Production Mutation**: 0 production migrations, 0 production seeds, 0 production backfills, 0 production business writes.
3. **Strict Ban on Personal Identity in Authorization**: NEVER authorize using usernames (`lisa.mt`), personal names ("Lisa"), emails, or display names. All operational authorities are modeled strictly via generic reusable primitives:
   $$\text{User} \longrightarrow \text{Assignment} \longrightarrow \text{Position} \longrightarrow \text{PositionCapability} \longrightarrow \text{Scope}$$
4. **Operational Positions Require Real Staff Profile**: Generic operational positions (`PETUGAS_OPERASIONAL_TAHFIZH`, `PETUGAS_OPERASIONAL_KEASRAMAAN`) must never authorize orphan personal users. Active linked Staff profile is strictly required.
5. **Fail-Closed Domain Resolution**: Target domain resolution never guesses `TAHFIZH` from santri identity alone. Unknown namespaces and missing capabilities leave `orgDomain` undefined, causing DOMAIN-scoped grants to fail closed.
6. **Strict Lifecycle Categorization**:
   - `VERIFIED_PRODUCTION`: Observed and verified in live production runtime.
   - `APPROVED_TARGET_PENDING_TECHNICAL`: Formally approved target policy by the Business Owner, pending technical rollout. Confers zero runtime authority in `authorizeCanonical()`.
   - `PROPOSED_TBD`: Proposed architectural pattern; not yet approved for active evaluation.
   - `IMPLEMENTED_IN_PR`: Clean low-risk UX corrections and end-to-end features implemented in this PR.

---

## 2. UAT Business Rules Traceability Matrix

The table below provides 1:1 traceability for each UAT feedback item, preserving original user numbering (`1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13`).

| UAT Item | Business Decision | Capability | Permitted Scope | Implementation Status / State | Test Scenarios |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Perizinan lisa.mt** | Operational staff (e.g. Lisa-equivalent) gets module read/create access via generic position `PETUGAS_OPERASIONAL_KEASRAMAAN`. Approval authority is strictly separated and approval tiers (`approve_mk`, `approve_ks`) remain unresolved. | `keasramaan.permission.read`<br/>`keasramaan.permission.create` | `ASSIGNED_UNITS` / `UNIT` | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 1) |
| **2. Lisa all-santri recap** | Dedicated READ exception: operational staff holding special assignment may read Tahfizh recap across ALL santri using canonical `tahfizh.recap.read` with scope `GLOBAL`. Read breadth is orthogonal to write; zero widening of setoran write (remains `HALAQOH`). | `tahfizh.recap.read` | `GLOBAL` (Read only) | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 2) |
| **3. Search display Nama Only** | Rendered student search results in search modals/cards show **NAMA ONLY** (`formatSantriSearchResult`). Independent filters for Kelas and Halaqoh/Kelompok are provided. Dense metadata (NIS, class, halaqoh, scores) are strictly excluded from display row. | UI Display Contract | N/A (UI Presentation) | **IMPLEMENTED_IN_PR** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 3) |
| **4. Target MT + PH** | Target santri may be updated by Musyrif Tahfizh (MT) and Pembina Halaqoh (PH) strictly within their assigned halaqoh binaan. Cross-halaqoh updates denied. Zero inferred Mudir/Kabid grants. | `tahfizh.target.manage` | `HALAQOH` (MT/PH) | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 4) |
| **5. Studi Umum vs Kepesantrenan** | Information architecture separates Studi Umum (6 canonical subjects: Matematika, Bahasa Inggris, IPS, IPA, Bahasa Indonesia, TIK) from Kepesantrenan (5 canonical subjects: Bahasa Arab, Fikih, Tafsir, Aqidah, Tajwid) under Pendidikan. | Navigation / Module Sub-tabs | Domain `AKADEMIK` | **IMPLEMENTED_IN_PR** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 5) |
| **6. Absensi Guru + Santri Kepesantrenan** | Kepesantrenan student attendance statuses are canonical: `HADIR`, `IZIN`, `SAKIT`, `ALFA` (Strictly NO `MASBUK`). Teacher attendance is evidenced by authenticated session start execution (`SESSION_START_AUTHENTICATED_EXECUTION`). | `KEPESANTRENAN_ATTENDANCE_CONTRACT` | `AKADEMIK` / `KEPESANTRENAN` | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 6) |
| **7. Halaqoh: no MASBUK** | `MASBUK` is removed as a selectable option for NEW halaqoh attendance entries. Historical `MASBUK` records are strictly preserved (no deletion or rewriting). | `HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS` (`HADIR`, `SAKIT`, `IZIN`, `ALFA`) | `HALAQOH` | **IMPLEMENTED_IN_PR** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 7) |
| **8. Tahajjud: SHOLAT / ALFA** | Tahajjud attendance offers exactly two selectable choices for new entry: `SHOLAT` and `ALFA`. Historical records preserved safely. | `TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS` (`SHOLAT`, `ALFA`) | `KEASRAMAAN` | **IMPLEMENTED_IN_PR** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 8) |
| **10. Santriwati OSDA-like account** | Technical operational account for santriwati unit operations (`AccountType.UNIT`) placed in OSDA PUTRI (`genderComplex: "PUTRI"`). Invariants: 1 active placement, mutations require verified human executor, zero PUTRA data access. | `OSDA_PUTRI_UNIT_CONTRACT` | `OU-OSDA-PUTRI` | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 9) |
| **11. Reward issuer** | Business Owner confirmed: special operational reward issuer authority is limited to assigned units/groups only (`ASSIGNED_UNITS`). Lisa-equivalent operational staff (`PETUGAS_OPERASIONAL_TAHFIZH`) may issue Tasmi'/Sima'an rewards ONLY for santri belonging to her authoritative assigned units/halaqoh (NOT `GLOBAL`, NOT `DOMAIN`). Outside assigned units: `DENY SCOPE_MISMATCH`. Existing verified managerial authority preserved: Mudir (`GLOBAL`, `VERIFIED_PRODUCTION`), Kabid Tahfizh (`DOMAIN`, `VERIFIED_PRODUCTION`). Ordinary MT, PH, ADM strictly denied. `GLOBAL` recap read never widens reward issuance scope. | `tahfizh.reward.issue` | `ASSIGNED_UNITS` (Operational issuer) | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 10) |
| **12. Broad Lisa scoped operational access** | Operational staff requiring cross-functional access across Pendidikan, Keasramaan, and OSDA are modeled via multiple generic functional assignments with active Staff linkage, strictly scoped to assigned student/group units. | Multiple granular capabilities | `ASSIGNED_UNITS` / `UNIT` / `HALAQOH` | **APPROVED_TARGET_PENDING_TECHNICAL** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 1) |
| **13. Backdated Tahfizh date picker** | End-to-end date picker on Tahfizh setoran form: default today WITA, past dates allowed, future dates denied. Stored in `tanggal`, immutable `createdAt` preserved. Applies to SABAQ, SABQI, MANZIL, MUFAR. Server action, persistence, and API parity maintained. | `tanggalSetoran` / `occurredAt` | `HALAQOH` | **IMPLEMENTED_IN_PR / PENDING_PRODUCTION_VERIFICATION** | `tests/milestone3-2-uat-business-rules.test.ts` (Section 11) |

---

### 2.1. UAT Item #11 Clarification — Operational Reward Issuance Scope
Business Owner confirmed: special operational reward issuer authority is limited to assigned units/groups only.
- **Position**: `PETUGAS_OPERASIONAL_TAHFIZH` (generic operational position linked to active Staff profile; zero username, name, or email matching).
- **Capability**: `tahfizh.reward.issue`
- **Permitted Scope**: `ASSIGNED_UNITS` (strictly restricted to assigned halaqoh/units; NOT `GLOBAL`, NOT `DOMAIN`, NOT all-santri reward authority).
- **Target Boundary**:
  - Santri in assigned unit $\implies$ `ALLOW` (`ALLOWED`)
  - Santri outside assigned unit $\implies$ `DENY` (`SCOPE_MISMATCH`)
- **Isolation Invariant**: Lisa's authorities remain strictly orthogonal:
  - Tahfizh recap READ: `tahfizh.recap.read` (scope: `GLOBAL`)
  - Reward issuance: `tahfizh.reward.issue` (scope: `ASSIGNED_UNITS`)
  - Setoran WRITE: `tahfizh.setoran.create` (scope: `HALAQOH`)
  - *Invariant*: `GLOBAL` recap READ must NEVER cause `GLOBAL` reward WRITE.
- **Managerial Authority**: Preserves existing verified rules: Mudir (`GLOBAL`, `VERIFIED_PRODUCTION`) and Kabid Tahfizh (`DOMAIN`, `VERIFIED_PRODUCTION`). Ordinary MT, PH, and ADM strictly denied.

---

## 3. Capability / Domain Trust Boundary Architecture

In Milestone 3.1, a fundamental domain ambiguity existed: a Santri participates concurrently in multiple strategic domains (e.g. halaqoh under `TAHFIZH`, kamar under `KEASRAMAAN`, class under `AKADEMIK`).

Milestone 3.2 resolves this ambiguity deterministically and fails closed:
1. **Context-Aware Derivation**: `resolveResourceContext(requested, subjectUserId, capability)` resolves target `orgDomain` strictly from the requested capability's namespace:
   $$\text{Namespace}(capability) \longrightarrow \text{Domain}$$
   - `tahfizh.*` $\implies \text{orgDomain} = \text{"TAHFIZH"}$
   - `keasramaan.*`, `health.*` $\implies \text{orgDomain} = \text{"KEASRAMAAN"}$
   - `academic.*` $\implies \text{orgDomain} = \text{"AKADEMIK"}$
   - Unknown namespace $\implies \text{orgDomain} = \text{undefined}$ (DO NOT GUESS)
   - Missing capability $\implies \text{orgDomain} = \text{undefined}$ (DO NOT GUESS from santriId alone)
2. **Fail-Closed DOMAIN Scope**: When `orgDomain` cannot be authoritatively determined, any DOMAIN-scoped evaluation immediately returns `INVALID_RESOURCE_CONTEXT` and is denied.
3. **Deterministic Invariant**: For the exact same santri:
   - A Tahfizh capability evaluation evaluates against the santri's Tahfizh halaqoh and yields domain `TAHFIZH`.
   - A Keasramaan capability evaluation evaluates against the santri's Keasramaan kamar and yields domain `KEASRAMAAN`.
4. **Zero Caller Injection**: The caller-supplied `RequestedResourceContext` contains no domain fields; caller cannot inject or synthesize an artificial domain.

---

## 4. Lifecycle Categorization & Future Milestones

### IMPLEMENTED M3.2
- Granular capability definitions in `types/architecture-lock.ts`
- Capability/resource-aware domain resolution in `lib/auth/canonical-evaluator.ts`
- Backdated setoran validation (`occurredAt` vs immutable `createdAt`) in `lib/tahfizh-persistence.ts`
- Halaqoh attendance MASBUK removal (new entries) & Tahajjud SHOLAT/ALFA constraint
- Simplified search display contract (NAMA ONLY, separate Kelas + Halaqoh filters) in `dashboard-musyrif-tahfizh.tsx`
- Separation of Studi Umum vs Kepesantrenan in `akademik-module.tsx`
- Complete test suite `tests/milestone3-2-uat-business-rules.test.ts` (22 required tests)

### DEFERRED M3.3 (Operational Workflows)
- Full interactive Kepesantrenan attendance UI and persistence backend
- Discipline / Surat Peringatan (SP) operational workflow and escalation
- Health V2 multi-step clinical examination and external referral workflow
- Sarana dan Prasarana (Sarpras) complete inventory workflow

### DEFERRED M4 (Institutional Administration)
- Full multi-semester academic curriculum planning and gradebook redesign
- Comprehensive historical student transcript generation

### CUTOVER REQUIRED (Production Rollout)
- Production database seed of `OU-OSDA-PUTRI` and functional position templates
- Assignment of operational staff to `PETUGAS_OPERASIONAL_TAHFIZH` and `PETUGAS_OPERASIONAL_KEASRAMAAN`
- Promotion of `APPROVED_TARGET_PENDING_TECHNICAL` to `VERIFIED_PRODUCTION` upon live verification
