# STQ EDUCATION PORTAL — MILESTONE 3.2 SPECIFICATION & TRACEABILITY
**UAT Business Rules & Authorization Closure**  
**Document**: `docs/STQ_MILESTONE3_2_UAT_BUSINESS_RULES.md`  
**Status**: `ARCHITECTURE_LOCKED`  
**Baseline Main**: `b63e60bf08575d11bcadf4b4c87950273af7f6fb`  
**PR #8 Immutable**: `9068cae5587b7219c394c5c25bf0de07a15b0726`  
**Approved Date**: `2026-09-17`

---

## 1. Executive Summary & Core Architectural Invariants

Milestone 3 Checkpoint M3.2 operationalizes actual User Acceptance Testing (UAT) feedback into authoritative business rule contracts, capability and scope primitives, domain trust boundary enforcement, and low-risk UX corrections, while preserving all locked architectural boundaries:
1. **Authoritative Runtime Boundary**: Legacy runtime authorization remains 100% authoritative in production. Canonical authorization engine runs strictly in shadow/non-authoritative mode (`CANONICAL_AUTH_SHADOW_ENABLED=false`).
2. **Zero Production Mutation**: 0 production migrations, 0 production seeds, 0 production backfills, 0 production business writes.
3. **Strict Ban on Personal Identity in Authorization**: NEVER authorize using usernames (`lisa.mt`), personal names ("Lisa"), emails, or display names. All operational authorities are modeled strictly via generic reusable primitives:
   $$\text{User} \longrightarrow \text{Assignment} \longrightarrow \text{Position} \longrightarrow \text{PositionCapability} \longrightarrow \text{Scope}$$
4. **Three-State Business Rule Categorization**:
   - `VERIFIED_PRODUCTION`: Observed and verified in live production runtime.
   - `APPROVED_TARGET_PENDING_TECHNICAL`: Formally approved target policy by the Business Owner, pending technical rollout.
   - `PROPOSED_TBD`: Proposed architectural pattern; not yet approved for active evaluation.

---

## 2. UAT Business Rules Traceability Matrix

The table below provides 1:1 traceability for each UAT feedback item, preserving original user numbering (`1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13`).

| UAT Item | Business Decision | Capability | Permitted Scope | Implementation Status | Test Scenarios | Deferred Checkpoint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Perizinan Access** | Operational staff (e.g. `lisa.mt`) must be able to access Perizinan module. Operational access is scoped to assigned student/group units. Approval authority is strictly separated from ordinary module access. | `keasramaan.permission.read`<br/>`keasramaan.permission.create`<br/>`keasramaan.permission.update`<br/>`keasramaan.permission.approve` | `ASSIGNED_UNITS` / `UNIT`<br/>Approval requires `DOMAIN` (`MK`) or `GLOBAL` (`KS`) | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 8, 9) | Full permission workflow redesign deferred to **M3.3** |
| **2. All-Santri Tahfizh Recap Read** | Dedicated READ exception: operational staff holding special assignment may read Tahfizh recap across ALL santri. Read breadth is orthogonal to write; zero widening of setoran write, target edit, or attendance. | `tahfizh.recap.view_all` / `tahfizh.recap.read` | `GLOBAL` (Read only) | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Test 1) | Production assignment seeding deferred to **CUTOVER REQUIRED** |
| **3. Search Display Simplification** | Rendered student search results in search modals/cards are simplified to show only **Nama** and **Kelas**. Underlying searchable fields (NIS, full name) remain searchable. | UI Display Contract (`formatSantriSearchResult`) | N/A (UI Presentation) | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Test 15) | N/A |
| **4. Target Santri Update** | Target santri may be updated by Musyrif Tahfizh (MT) and Pembina Halaqoh (PH) strictly within their assigned halaqoh binaan. Cross-halaqoh updates denied. | `tahfizh.target.manage` | `HALAQOH` (MT/PH), `DOMAIN` (`KABID`), `GLOBAL` (`MUDIR`) | **IMPLEMENTED M3.2** (`APPROVED_TARGET_PENDING_TECHNICAL`) | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 2, 3, 4) | Production activation deferred to **CUTOVER REQUIRED** |
| **5. Studi Umum vs Kepesantrenan** | Information architecture separates Studi Umum (Matematika Terapan, B. Inggris, B. Indonesia) from Kepesantrenan (Bahasa Arab, Fikih, Tafsir, Tajwid, Aqidah Islamiyah) under Pendidikan. | Navigation / Module Sub-tabs | Domain `AKADEMIK` | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` | Complete academic curriculum management deferred to **M4** |
| **6. Kepesantrenan Attendance** | Kepesantrenan sessions require attendance for both Guru and Santri. M3.2 locks the business contract: one session has distinct teacher and student attendance records. | `KEPESANTRENAN_ATTENDANCE_CONTRACT` | `AKADEMIK` / `KEPESANTRENAN` | **IMPLEMENTED M3.2** (Contract locked) | `tests/milestone3-2-uat-business-rules.test.ts` | Complete interactive UI & storage workflows deferred to **M3.3** |
| **7. Halaqoh Attendance** | `MASBUK` is removed as a selectable option for NEW halaqoh attendance entries. Historical `MASBUK` records are strictly preserved (no deletion or rewriting). | `HALAQOH_ATTENDANCE_NEW_ENTRY_OPTIONS` (`HADIR`, `SAKIT`, `IZIN`, `ALFA`) | `HALAQOH` | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 12, 14) | N/A |
| **8. Tahajjud Attendance** | Tahajjud attendance offers exactly two selectable choices for new entry: `SHOLAT` and `ALFA`. No MASBUK, no IZIN, no generic HADIR duplicate. Historical records preserved safely. | `TAHAJJUD_ATTENDANCE_NEW_ENTRY_OPTIONS` (`SHOLAT`, `ALFA`) | `KEASRAMAAN` | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 13, 14) | N/A |
| **10. Santriwati OSDA-like Account** | Technical operational account for santriwati unit operations (`AccountType.UNIT`) placed in OSDA PUTRI (`genderComplex: "PUTRI"`). Invariants: 1 active placement, mutations require verified human executor, zero PUTRA data leakage. | `OSDA_PUTRI_UNIT_CONTRACT` | `OU-OSDA-PUTRI` | **IMPLEMENTED M3.2** (Contract & Structural Invariants) | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 10, 11) | Production account provisioning deferred to **CUTOVER REQUIRED** |
| **11. Tasmi'/Sima'an Reward Issuer** | Authorized issuers: Mudir (`GLOBAL`, `VERIFIED_PRODUCTION`), Kabid Tahfizh (`DOMAIN`, `VERIFIED_PRODUCTION`), and special operational assignment (`PETUGAS_OPERASIONAL_TAHFIZH`, `APPROVED_TARGET_PENDING_TECHNICAL`). Ordinary MT, PH, ADM strictly denied. Scoped strictly to assigned units. | `tahfizh.reward.issue` | `GLOBAL` (Mudir), `DOMAIN` (Kabid), `ASSIGNED_UNITS` (Operational issuer) | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 5, 6, 7) | Production cutover deferred to **CUTOVER REQUIRED** |
| **12. Broad Lisa Scoped Operational Access** | Operational staff requiring cross-functional access across Pendidikan, Keasramaan, and OSDA are modeled via multiple generic functional assignments, strictly scoped to assigned student/group units (not institutional super-admin). | Multiple granular capabilities | `ASSIGNED_UNITS` / `UNIT` / `HALAQOH` | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Test 9) | Production user assignment deferred to **CUTOVER REQUIRED** |
| **13. Backdated Tahfizh Input** | Authorized Tahfizh staff may input setoran with actual occurred date (`occurredAt` / `tanggalSetoran` stored in `tanggal`). Future dates strictly denied (`occurredAt > now` $\to$ DENY). Immutable `createdAt` system entry timestamp is preserved and never rewritten. | `saveSetoranTahfizhCore` with `occurredAt` | `HALAQOH` | **IMPLEMENTED M3.2** | `tests/milestone3-2-uat-business-rules.test.ts` (Tests 16, 17, 18, 19) | N/A |

---

## 3. Capability / Domain Trust Boundary Architecture

In Milestone 3.1, a fundamental domain ambiguity existed: a Santri participates concurrently in multiple strategic domains (e.g. halaqoh under `TAHFIZH`, kamar under `KEASRAMAAN`, class under `AKADEMIK`).

Milestone 3.2 resolves this ambiguity deterministically:
1. **Context-Aware Derivation**: `resolveResourceContext(requested, subjectUserId, capability)` resolves target `orgDomain` from the requested capability's namespace:
   $$\text{Namespace}(capability) \longrightarrow \text{Domain}$$
   - `tahfizh.*` $\implies \text{orgDomain} = \text{"TAHFIZH"}$
   - `keasramaan.*`, `health.*` $\implies \text{orgDomain} = \text{"KEASRAMAAN"}$
   - `academic.*` $\implies \text{orgDomain} = \text{"AKADEMIK"}$
2. **Deterministic Invariant**: For the exact same santri:
   - A Tahfizh capability evaluation evaluates against the santri's Tahfizh halaqoh and yields domain `TAHFIZH`.
   - A Keasramaan capability evaluation evaluates against the santri's Keasramaan kamar and yields domain `KEASRAMAAN`.
3. **Zero Caller Injection**: The caller-supplied `RequestedResourceContext` contains no domain fields; caller cannot inject or synthesize an artificial domain.

---

## 4. Lifecycle Categorization & Future Milestones

### IMPLEMENTED M3.2
- Granular capability definitions in `types/architecture-lock.ts`
- Capability/resource-aware domain resolution in `lib/auth/canonical-evaluator.ts`
- Backdated setoran validation (`occurredAt` vs immutable `createdAt`) in `lib/tahfizh-persistence.ts`
- Halaqoh attendance MASBUK removal (new entries) & Tahajjud SHOLAT/ALFA constraint
- Simplified search display contract (`Nama` + `Kelas`) in `dashboard-musyrif-tahfizh.tsx`
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
