# STQ CAPABILITY CATALOG — SPECIFICATION & REGISTRY
**Granular, Domain-Scoped Capability Taxonomy for the STQ Education Portal**  
**Document**: `docs/STQ_CAPABILITY_CATALOG.md`  
**Status**: `PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW`

---

## 1. Capability Naming Convention & Architectural Boundary

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
- **`entity`**: The target resource noun (`setoran`, `recap`, `reward`, `policy`, `permission`, `discipline`, `case`, `score`, `stock`, `user`, `assignment`).
- **`action`**: The operation verb (`read`, `create`, `update`, `cancel`, `approve`, `issue`, `inspect`, `mutate`, `manage`, `referral`).

> [!IMPORTANT]
> **The Three Canonical Business Rule States**:
> Every capability entry in this catalog is strictly classified into one of three states:
> 1. **`VERIFIED_PRODUCTION`**: Observed and verified in active production (PR #10 to PR #13 baseline).
> 2. **`APPROVED_TARGET_PENDING_TECHNICAL`**: Formally approved target policy by institutional leadership, pending technical schema/UI implementation.
> 3. **`PROPOSED_TBD`**: Architectural design recommendation; assignment matrix is not yet approved by the Business Owner.

---

## 2. Capability Catalog & Business Rule State Registry

### 2.1. Ketahfidzhan (`tahfizh.*`)
| Capability Code | Description | Authorized Positions & Scope | Business Rule State | Boundary Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `tahfizh.student.read` | Membaca daftar dan profil capaian hafalan santri | `MUDIR` (`GLOBAL`), `KABID_TAHFIZH` (`DOMAIN`), `MUSYRIF_TAHFIZH` (`HALAQOH`) | **VERIFIED_PRODUCTION** | Strict halaqoh enclosure for ordinary MT |
| `tahfizh.setoran.create` | Mencatat setoran hafalan baru (Sabaq/Sabqi/Manzil/Mufar) | `MUSYRIF_TAHFIZH` (`HALAQOH`) | **VERIFIED_PRODUCTION** | Kabid writes setoran strictly for own halaqoh |
| `tahfizh.recap.read` | Membaca rekapitulasi capaian hafalan | `MUDIR` (`GLOBAL`), `KABID_TAHFIZH` (`DOMAIN`), `ADMIN` (`GLOBAL`); `MUSYRIF_TAHFIZH` (`HALAQOH`) | **VERIFIED_PRODUCTION** | Ordinary MT restricted to own halaqoh recap |
| `tahfizh.reward.issue` | Menerbitkan reward resmi Tasmi'/Sima'an | `MUDIR` (`GLOBAL`), `KABID_TAHFIZH` (`DOMAIN`) | **VERIFIED_PRODUCTION** | Ordinary MT, ADM, MK strictly denied |
| `tahfizh.policy.manage` | Mengubah ambang nilai, bintang, dan kebijakan reward | `MUDIR` (`KS`) (`GLOBAL`) | **VERIFIED_PRODUCTION** | Kabid Tahfizh and ordinary MT strictly denied |
| `tahfizh.setoran.cancel` | Membatalkan setoran tahfizh (dengan alasan & audit) | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Cancellation audit requirement |
| `tahfizh.target.manage` | Menetapkan target bulanan/pekanan santri | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Target setting workflow |
| `tahfizh.ikhtibar.evaluate_s1` | Menilai ujian kenaikan juz Tahap 1 | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Stage 1 exam evaluation |
| `tahfizh.ikhtibar.evaluate_s2` | Menilai munaqasyah akhir Tahap 2 | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Stage 2 exam evaluation |
| `tahfizh.finalization.run` | Finalisasi rekapitulasi bulanan dan sanksi | *TBD — Business Owner approval required* | **PROPOSED_TBD** | Monthly finalization |

---

### 2.2. Kesehatan (`health.*`) — Current Verified Production vs. Target V2 Approved
The 5 granular health capabilities are explicitly demarcated between current verified production and target V2 approved states:

| Capability Code | Description | Current Verified Production | Target V2 Approved (Pending Technical) | Receiver / Sign-off Matrix |
| :--- | :--- | :--- | :--- | :--- |
| `health.case.read_aggregate` | Membaca ringkasan agregat dan tren keluhan sakit Poskestren | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`), `ADMIN` (`ADM`). | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN` (`GLOBAL`), `PEMBINA_ASRAMA` (`KAMAR`), `WALI_SANTRI` (`OWN_CHILD`). | Approved |
| `health.case.read_detail` | Membaca rekam medis klinis detail, keluhan, dan diagnosa santri | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`). Admin denied. | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN` (`GLOBAL`), `PEMBINA_ASRAMA` (`KAMAR` assigned). | Approved |
| `health.case.create` | Menginput kejadian/keluhan awal sakit santri di Poskestren | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`). | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN`, `PEMBINA_ASRAMA` (`KAMAR`). | Approved |
| `health.case.update_status` | Memperbarui status medis (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`) | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`). Admin TU strictly denied (`DENY`). | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN`. Pembina Kamar restricted to internal updates. | Approved |
| `health.case.referral` | Menerbitkan surat rujukan klinis ke Puskesmas / RS | **VERIFIED_PRODUCTION**<br/>`MUDIR`, `KEPALA_KEASRAMAAN` (`MK`). | **APPROVED_TARGET_PENDING_TECHNICAL**<br/>`PETUGAS_KESEHATAN` recommends referral. | **PROPOSED_TBD**<br/>Final referral sign-off receiver matrix is TBD pending Business Owner decision. |

#### Canonical Keasramaan V2 Health Statuses & Legacy Read Bridge
Canonical V2 statuses: `DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`.
- `SEMBUH` $\implies$ Maps to `PULIH` (Deterministic)
- `RAWAT_PONDOK` $\implies$ Maps to `DIPANTAU` (Deterministic)
- `DIRUJUK_PUSKESMAS` $\implies$ Maps to `DIRUJUK` (Deterministic)
- `PULANG` $\implies$ **AMBIGUOUS_PENDING_REVIEW** (Do NOT backfill; requires human business review).

---

### 2.3. Keasramaan & Kesantrian (`keasramaan.*`)
| Capability Code | Description | Authorized Positions | Status |
| :--- | :--- | :--- | :--- |
| `keasramaan.permission.create` | Mengajukan permohonan izin santri | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.permission.approve_mk` | Persetujuan izin pondok operasional (Tier 1) | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.permission.approve_ks` | Pengesahan izin pulang / luar kota (Tier 2) | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.presensi.record` | Mencatat presensi sholat & kegiatan asrama | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.discipline.create` | Mencatat poin pelanggaran tata tertib | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.sp.issue` | Menerbitkan Surat Peringatan (SP 1, 2, 3) | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.sp.whitewash` | Pemutihan poin pelanggaran santri | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.star.award` | Mencatat penganugerahan bintang kebaikan | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.kamar.inspect` | Inspeksi kebersihan dan kerapihan kamar | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `keasramaan.usroh.supervise` | Pengawasan tugas harian usroh kebersihan | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |

### 3.3. Akademik & Kurikulum (`academic.*`)
| Capability Code | Description | Authorized Positions | Status |
| :--- | :--- | :--- | :--- |
| `academic.score.input` | Menginput nilai harian/ujian mapel | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `academic.score.read` | Membaca buku nilai santri | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `academic.rapor.print` | Mencetak rapor semesteran santri | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `academic.curriculum.manage`| Mengatur mata pelajaran, KKM, kurikulum | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |

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
