# STQ CAPABILITY CATALOG — SPECIFICATION & REGISTRY
**Granular, Domain-Scoped Capability Taxonomy for the STQ Education Portal**  
**Document**: `docs/STQ_CAPABILITY_CATALOG.md`  
**Status**: `ARCHITECTURE_LOCKED`  
**Approved Baseline Date**: `2026-09-17`

---

## 1. Capability Naming Convention & Architectural Boundary

All capabilities in the STQ Portal adhere to a strict 3-tier dot-notated nomenclature:

$$\text{Code} = \langle\text{namespace}\rangle.\langle\text{entity}\rangle.\langle\text{action}\rangle$$

Where:
- **`namespace`**: The functional capability namespace (`CapabilityNamespace`):
  - `"TAHFIZH"`
  - `"KEASRAMAAN"`
  - `"HEALTH"`
  - `"ACADEMIC"`
  - `"LOGISTICS"`
  - `"FINANCE"`
  - `"LETTERS"`
  - `"SPONSOR"`
  - `"SYSTEM"`
- **`entity`**: The target resource noun (`student`, `setoran`, `recap`, `reward`, `policy`, `permission`, `discipline`, `case`, `score`, `stock`, `user`, `assignment`).
- **`action`**: The operation verb (`read`, `create`, `update`, `cancel`, `approve`, `issue`, `inspect`, `mutate`, `manage`, `referral`).

> [!IMPORTANT]
> **Semantic Definition vs. Grant Lifecycle State**:
> A `Capability` record is a **pure semantic action definition** (`code`, `namespace`, `name`, `description`, `isDangerous`).
> Lifecycle state (**`BusinessRuleState`**) belongs to the **policy grant mapping (`PositionCapability`)**, NOT to the semantic capability.
> This allows a single capability (such as `health.case.create`) to simultaneously possess active compatibility grants (`VERIFIED_PRODUCTION` for `MK` and `ADM`) and future approved target grants (`APPROVED_TARGET_PENDING_TECHNICAL` for `PETUGAS_KESEHATAN`).
> 
> The three canonical states:
> 1. **`VERIFIED_PRODUCTION`**: Observed and verified in active production runtime (PR #10 to PR #13 baseline).
> 2. **`APPROVED_TARGET_PENDING_TECHNICAL`**: Formally approved target policy by institutional leadership, pending technical schema/UI implementation (non-authoritative in Phase A/B).
> 3. **`PROPOSED_TBD`**: Architectural design recommendation; receiver/sign-off matrix pending Business Owner approval (never enters active authorization).
>
> **Fail-Closed Default**: Candidate schema enforces `PositionCapability.businessRuleState @default(PROPOSED_TBD)`. Developer omission can never silently create an active `VERIFIED_PRODUCTION` grant. Phase B compatibility backfill requires explicit `VERIFIED_PRODUCTION`.

---

## 2. Capability Catalog & Business Rule State Registry

### 2.1. Ketahfidzhan (`tahfizh.*`)
| Capability Code | Description | Authorized Positions & Scope | Business Rule State | Boundary Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `tahfizh.student.read` | Membaca daftar dan profil capaian hafalan santri | `MUDIR` (`GLOBAL`), `KABID_TAHFIZH` (`DOMAIN`), `MUSYRIF_TAHFIZH` (`HALAQOH`) | **VERIFIED_PRODUCTION** | Strict halaqoh enclosure for ordinary MT |
| `tahfizh.setoran.create` | Mencatat setoran hafalan baru (Sabaq/Sabqi/Manzil/Mufar) | `MUSYRIF_TAHFIZH` (`HALAQOH`) | **VERIFIED_PRODUCTION** | Kabid writes setoran strictly for own halaqoh |
| `tahfizh.recap.read` | Membaca rekapitulasi capaian hafalan | `MUDIR` (`GLOBAL`), `KABID_TAHFIZH` (`DOMAIN`), `ADMIN` (`GLOBAL`); `MUSYRIF_TAHFIZH` (`HALAQOH`, **VERIFIED_PRODUCTION**); `PETUGAS_OPERASIONAL_TAHFIZH` (`GLOBAL`, **APPROVED_TARGET_PENDING_TECHNICAL**) | Mixed (Production + Target) | Operational recap read breadth (GLOBAL) does NOT widen setoran write authority (HALAQOH) |
| `tahfizh.reward.issue` | Menerbitkan reward resmi Tasmi'/Sima'an | `MUDIR` (`GLOBAL`, **VERIFIED_PRODUCTION**), `KABID_TAHFIZH` (`DOMAIN`, **VERIFIED_PRODUCTION**) | **VERIFIED_PRODUCTION** | Restricted to MUDIR and KABID_TAHFIZH only per DIR-2026-023. PETUGAS_OPERASIONAL_TAHFIZH (POT), ordinary MT, PH, ADM are strictly denied (`CAPABILITY_NOT_GRANTED`). Prior target grant to POT with ASSIGNED_UNITS is formally SUPERSEDED. |
| `tahfizh.policy.manage` | Mengubah ambang nilai, bintang, dan kebijakan reward | `MUDIR` (`KS`) (`GLOBAL`) | **VERIFIED_PRODUCTION** | Kabid Tahfizh and ordinary MT strictly denied |
| `tahfizh.target.manage` | Menetapkan target bulanan/pekanan santri | `MUSYRIF_TAHFIZH` (`HALAQOH`), `PEMBINA_HALAQOH` (`HALAQOH`) | **APPROVED_TARGET_PENDING_TECHNICAL** | Approved UAT target policy; scoped strictly to assigned binaan; zero inferred Mudir/Kabid grants |
| `tahfizh.setoran.cancel` | Membatalkan setoran tahfizh (dengan alasan & audit) | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Cancellation audit requirement |
| `tahfizh.ikhtibar.evaluate_s1` | Menilai ujian kenaikan juz Tahap 1 | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Stage 1 exam evaluation |
| `tahfizh.ikhtibar.evaluate_s2` | Menilai munaqasyah akhir Tahap 2 | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Stage 2 exam evaluation |
| `tahfizh.finalization.run` | Finalisasi rekapitulasi bulanan dan sanksi | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Monthly finalization |

---

### 2.2. Kesehatan (`health.*`) — Current Verified Production vs. Target V2 Approved
The 5 granular health capabilities are explicitly demarcated between current verified production and target V2 approved states:

| Capability Code | Description | Current Verified Production Baseline | Target V2 Approved (Pending Technical) | Policy Grant State |
| :--- | :--- | :--- | :--- | :--- |
| `health.case.read_aggregate` | Membaca ringkasan agregat dan tren keluhan sakit Poskestren | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`), `ADMIN` (`ADM`) global read compatibility.<br/>`WALI_SANTRI` (`WS`) dan `SANTRI` (`ST`) scoped to `session.santriId`. | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN` (`GLOBAL`), `PEMBINA_ASRAMA` (`KAMAR`), `WALI_SANTRI` (`OWN_CHILD`). | KS/MK/ADM: `VERIFIED_PRODUCTION`<br/>Target: `APPROVED_TARGET_PENDING_TECHNICAL` |
| `health.case.read_detail` | Membaca rekam medis klinis detail, keluhan, dan diagnosa santri | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`), `ADMIN` (`ADM`) global read compatibility (returns full DTO: keluhan, diagnosa, tindakan, status, identitas santri).<br/>`WALI_SANTRI` (`WS`) dan `SANTRI` (`ST`) scoped to `session.santriId`. | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN` (`GLOBAL`), `PEMBINA_ASRAMA` (`KAMAR` assigned). No generic OSDA access. | KS/MK/ADM: `VERIFIED_PRODUCTION`<br/>Target: `APPROVED_TARGET_PENDING_TECHNICAL` |
| `health.case.create` | Menginput kejadian/keluhan awal sakit santri di Poskestren | **VERIFIED_PRODUCTION**<br/>`catatKesehatanAction` permits `MUDIR` (`KS`), `KEPALA_KEASRAMAAN` (`MK`), `ADMIN` (`ADM`). (ADM is NOT denied). | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN`, `PEMBINA_ASRAMA` (`KAMAR`). | KS/MK/ADM: `VERIFIED_PRODUCTION`<br/>Target: `APPROVED_TARGET_PENDING_TECHNICAL` |
| `health.case.update_status` | Memperbarui status medis (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`) | **VERIFIED_PRODUCTION**<br/>`updateStatusKesehatanAction` permits `MUDIR` (`KS`), `KEPALA_KEASRAMAAN` (`MK`). Admin TU strictly denied (`DENY`). | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN`. Pembina Kamar restricted to internal updates. | KS/MK: `VERIFIED_PRODUCTION`<br/>Target: `APPROVED_TARGET_PENDING_TECHNICAL` |
| `health.case.referral` | Menerbitkan surat rujukan klinis ke Puskesmas / RS | **NONE (NO DEDICATED ACTION)**<br/>Main has NO dedicated action for external referral issuance. Updating status to `DIRUJUK_PUSKESMAS` via `updateStatusKesehatanAction` is not a dedicated referral capability. | `PETUGAS_KESEHATAN` recommends referral. | **PROPOSED_TBD**<br/>Final external referral sign-off receiver matrix is TBD pending Business Owner decision. |

#### Canonical Keasramaan V2 Health Statuses & Legacy Read Bridge (M3.3A Foundation)
Canonical V2 statuses are EXACTLY: `DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`.
- `RAWAT_PONDOK` $\implies$ Maps to `DIPANTAU` (Deterministic)
- `SEMBUH` $\implies$ Maps to `PULIH` (Deterministic)
- `DIRUJUK_PUSKESMAS` $\implies$ Maps to `DIRUJUK` (Deterministic)
- `DIRUJUK_RS` $\implies$ Maps to `DIRUJUK` (Deterministic)
- `PULANG` $\implies$ `REVIEW_REQUIRED` / **AMBIGUOUS_PENDING_REVIEW** (Ambiguous historical status; requires human review, never silently mapped).
- *Unsupported/unknown strings* $\implies$ `UNKNOWN` (Safe fallback; zero speculative data fabrication).

#### Health V2 Boundary Invariants:
1. **Data Honesty**: Diagnosis (`diagnosa`) is optional; absent or empty diagnosis persists as `NULL`. No fake examination string is ever generated.
2. **Read Bridge Immutability**: Legacy status mapping is purely read/translation oriented; it NEVER mutates database rows or rewrites historical records.
3. **Dual Attribution on Unit Writes**: Unit accounts (e.g. Poskestren desk kiosks) require a verified human executor on write (`UNIT_EXECUTOR_REQUIRED`).
4. **Privacy Isolation**: Aggregate operational visibility (`health.case.read_aggregate`) is strictly separated from clinical detail visibility (`health.case.read_detail`). Generic OSDA membership confers zero clinical detail access.
5. **Dormitory Scoping**: Pembina Asrama access to health details is strictly `KAMAR`-scoped. Accessing santri in other rooms is denied (`OUT_OF_SCOPE_ACCESS_DENIED`).
6. **Referral Authority**: External hospital/puskesmas referral issuance remains `PROPOSED_TBD`.
7. **Daily Health Checklist Invariant**: Exactly 1 general checklist per operational day; M3.3A defines the business invariant with zero invented checklist questions in code.
8. **Health Inventory Boundary Invariant**: Health owns inventory records/usage; physical maintenance and repairs are delegated to Sarpras; no premature inventory mutation in M3.3A.

---

### 2.3. Keasramaan & Kesantrian (`keasramaan.*`)
| Capability Code | Description | Authorized Positions & Scope | Business Rule State | Boundary Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `keasramaan.permission.read` | Membaca daftar izin santri | `MUDIR` (`GLOBAL`), `KEPALA_KEASRAMAAN` (`DOMAIN`), `PETUGAS_OPERASIONAL_KEASRAMAAN` (`ASSIGNED_UNITS`), `PEMBINA_ASRAMA` (`KAMAR`) | **APPROVED_TARGET_PENDING_TECHNICAL** | Scoped to assigned units/kamar |
| `keasramaan.permission.create` | Mengajukan permohonan izin santri | `PETUGAS_OPERASIONAL_KEASRAMAAN` (`ASSIGNED_UNITS`), `PEMBINA_ASRAMA` (`KAMAR`) | **APPROVED_TARGET_PENDING_TECHNICAL** | Mutation strictly scoped |
| `keasramaan.permission.update` | Memperbarui catatan permohonan izin | `PETUGAS_OPERASIONAL_KEASRAMAAN` (`ASSIGNED_UNITS`), `PEMBINA_ASRAMA` (`KAMAR`) | **PROPOSED_TBD** | Does not confer approval authority |
| `keasramaan.permission.approve_mk` | Persetujuan izin santri tingkat Musyrif Keasramaan | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Unresolved approval tier |
| `keasramaan.permission.approve_ks` | Persetujuan izin santri tingkat Kepala Sekolah / Mudir | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Unresolved approval tier |
| `keasramaan.presensi.record` | Mencatat presensi sholat & kegiatan asrama | `PEMBINA_ASRAMA` (`KAMAR`), `OSDA` (`UNIT`) | **PROPOSED_TBD** | Presensi scoping rules |
| `keasramaan.discipline.create` | Mencatat poin pelanggaran tata tertib | `PETUGAS_KEDISIPLINAN` (`GLOBAL`), `PEMBINA_ASRAMA` (`KAMAR`) | **PROPOSED_TBD** | Discipline recording |
| `keasramaan.sp.issue` | Menerbitkan Surat Peringatan (SP 1, 2, 3) | `KEPALA_KEASRAMAAN` (`DOMAIN`), `MUDIR` (`GLOBAL`) | **PROPOSED_TBD** | Formal sanction authority |
| `keasramaan.sp.whitewash` | Pemutihan poin pelanggaran santri | `MUDIR` (`GLOBAL`) | **PROPOSED_TBD** | Mudir executive privilege |
| `keasramaan.star.award` | Mencatat penganugerahan bintang kebaikan | `KEPALA_KEASRAMAAN` (`DOMAIN`), `MUDIR` (`GLOBAL`) | **PROPOSED_TBD** | Positive reinforcement |
| `keasramaan.kamar.inspect` | Inspeksi kebersihan dan kerapihan kamar | `PEMBINA_ASRAMA` (`KAMAR`), `OSDA` (`UNIT`) | **PROPOSED_TBD** | Physical room inspection |
| `keasramaan.usroh.supervise` | Pengawasan tugas harian usroh kebersihan | `PEMBINA_ASRAMA` (`KAMAR`), `OSDA` (`UNIT`) | **PROPOSED_TBD** | Taskforce supervision |

### 3.3. Akademik & Kurikulum (`academic.*`)
| Capability Code | Description | Authorized Positions & Scope | Business Rule State | Boundary Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `academic.schedule.read` | Membaca jadwal KBM Studi Umum dan Kepesantrenan | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Read schedule matrix and slot times |
| `academic.session.start` | Memulai sesi pembelajaran (Mulai Pembelajaran) dan mencatat kehadiran guru aktual | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Requires authentic staff identity, CAS concurrency on SCHEDULED state, dual teacher attribution |
| `academic.material.record` | Mencatat materi pelajaran manual yang telah diajarkan pada sesi berlangsung | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Gated on session STARTED, actual teacher ownership enforced, transactional audit rollback |
| `academic.attendance.record` | Mencatat presensi santri peserta sesi pembelajaran (HADIR, IZIN, SAKIT, ALFA) | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Scoped to enrolled participants in EducationSessionParticipant; MASBUK rejected; Studi Umum deferred |
| `academic.session.view` | Melihat detail sesi pembelajaran, materi, dan presensi santri | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Read session execution details |
| `academic.session.complete` | Menyelesaikan dan menutup sesi pembelajaran | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Transition from STARTED to COMPLETED |
| `academic.cohort.manage` | Mengelola data angkatan program dan kalender tahun ajaran | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Cohort management independent of external class labels |
| `academic.teaching_assignment.manage` | Mengelola penetapan penugasan guru pengajar mata pelajaran | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Teaching assignment management |
| `academic.score.input` | Menginput nilai harian/ujian mapel | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Assessment scoring deferred |
| `academic.score.read` | Membaca buku nilai santri | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Assessment scoring deferred |
| `academic.rapor.print` | Mencetak rapor semesteran santri | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Assessment scoring deferred |
| `academic.curriculum.manage` | Mengatur mata pelajaran, KKM, kurikulum | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Assessment scoring deferred |

### 3.4. Logistik, Keuangan, Surat & Donatur (`logistics.*`, `finance.*`, `letters.*`, `sponsor.*`)
| Capability Code | Description | Authorized Positions | Status |
| :--- | :--- | :--- | :--- |
| `logistics.stock.read` | Melihat sisa stok sembako/ATK/obat | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `logistics.stock.mutate` | Menginput barang masuk/keluar gudang | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `finance.budget.propose` | Mengajukan anggaran bulanan unit | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `finance.budget.approve` | Mengesahkan pencairan anggaran | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `letters.official.create` | Membuat draft surat dinas resmi | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `letters.official.sign` | Mengesahkan surat dinas resmi | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `sponsor.donor.manage` | Mengelola database Orang Tua Asuh | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `sponsor.report.send_wa` | Mengirim laporan progres hafalan via WA | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |

### 3.5. Administrasi Sistem (`system.*`)
| Capability Code | Description | Authorized Positions | Status |
| :--- | :--- | :--- | :--- |
| `system.user.manage` | Manajemen akun dan reset password | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `system.assignment.manage` | Manajemen penetapan penugasan (Assignment) | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `system.audit.read` | Memeriksa rekam jejak forensic Audit Log | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `system.calendar.manage` | Mengatur kalender kegiatan & libur pondok | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |

---

## 4. Milestone 3.3C1: Reconciled Business Rules & UAT Activation Manifest

### 4.1. Business Rule Reconciliation Matrix
| Item | Old / Superseded Drafting | Canonical Reconciled Decision (M3.3C1) | Code Manifest / Implementation |
| :--- | :--- | :--- | :--- |
| **UAT #3 (Search)** | "Search result shows Nama + Kelas" | **Nama Only** display; Kelas & Halaqoh are independent filters | `formatSantriSearchResult()` in `types/architecture-lock.ts` |
| **UAT #5 (Subjects)** | Generic curriculum lists | **6 Studi Umum Subjects** (Matematika, B. Inggris, IPS, IPA, B. Indonesia, TIK); **5 Kepesantrenan Subjects** (B. Arab, Fikih, Tafsir, Aqidah, Tajwid) | `CANONICAL_STUDI_UMUM_SUBJECTS`, `CANONICAL_KEPESANTRENAN_SUBJECTS` in `lib/pendidikan-v2.ts` |
| **UAT #6 (Attendance)** | Attendance vocabulary TBD | **HADIR, IZIN, SAKIT, ALFA** (MASBUK strictly forbidden). Teacher attendance evidenced by authenticated session start execution. | `KEPESANTRENAN_APPROVED_ATTENDANCE_STATUSES`, `KEPESANTRENAN_ATTENDANCE_CONTRACT` |
| **Substitute Policy** | Undefined badal handling | **Deferred**: Ordinary start requires authenticated Staff.id == EducationSession.scheduledStaffId; fails closed with `SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED`. | `PendidikanV2Service.startEducationSession()` |
| **Scoring Policy** | Undefined KKM/weighting | **Deferred**: Zero invented KKM or calculation formulas; historical score reading preserved, mutation locked. | `components/modules/akademik-module.tsx` |

### 4.2. Declarative UAT Activation Targets Manifest
Defined in `types/architecture-lock.ts` as `UAT_ACTIVATION_TARGETS`:
- **OPERATIONAL_TAHFIZH**: `tahfizh.recap.read` (`GLOBAL`), `tahfizh.setoran.backdate` (`ASSIGNED_UNITS`). Note: `tahfizh.reward.issue` is SUPERSEDED per DIR-2026-023.
- **TARGET_MANAGEMENT**: `MUSYRIF_TAHFIZH` (`HALAQOH`), `PEMBINA_HALAQOH` (`HALAQOH`).
- **OPERATIONAL_KEASRAMAAN**: `keasramaan.permission.read` (`ASSIGNED_UNITS`), `keasramaan.permission.create` (`ASSIGNED_UNITS`). Denies all approval tiers.
- **OSDA_PUTRI**: Max 1 active placement, `PUTRI` gender boundary enforced, prevents `PUTRA` resource access.

### 4.3. Production Readiness Diagnostic Framework & Runtime Gate
- **11 Pre-Activation Verification Gates** implemented in `lib/server/pendidikan-v2-readiness.ts`. Performs 100% read-only inspections with zero writes/DDL.
- **Explicit Activation Gate**: `process.env.PENDIDIKAN_V2_UAT_ENABLED === "true"`. When disabled, all session starts, material records, and attendance updates fail closed with `PENDIDIKAN_V2_UAT_NOT_ENABLED`.
- **Server Schema Readiness**: `PendidikanV2Service.checkSchemaReadiness()` verifies presence of `education_sessions`, `education_session_participants`, and `education_session_attendances`. Fails closed with `PENDIDIKAN_V2_SCHEMA_NOT_READY`; never fabricates empty arrays or zero counts.
- **Production Migration Safety**: Exact zero migrations applied to production; production writes = 0.

