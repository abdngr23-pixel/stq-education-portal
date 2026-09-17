# STQ CAPABILITY CATALOG — SPECIFICATION & REGISTRY
**Granular, Domain-Scoped Capability Taxonomy for the STQ Education Portal**  
**Document**: `docs/STQ_CAPABILITY_CATALOG.md`  
**Status**: `PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW`

---

## 1. Capability Naming Convention & Architectural Boundary

All capabilities in the STQ Portal adhere to a strict 3-tier dot-notated nomenclature:

$$\text{Code} = \langle\text{domain}\rangle.\langle\text{entity}\rangle.\langle\text{action}\rangle$$

Where:
- **`domain`**: The organizational domain (`tahfizh`, `keasramaan`, `health`, `academic`, `logistics`, `finance`, `letters`, `sponsor`, `system`).
- **`entity`**: The noun representing the target resource (`setoran`, `recap`, `reward`, `policy`, `permission`, `discipline`, `case`, `score`, `stock`, `user`, `assignment`).
- **`action`**: The verb describing the operation (`read`, `create`, `update`, `cancel`, `approve`, `issue`, `inspect`, `mutate`, `manage`).

> [!IMPORTANT]
> **Strict Business Rule Boundary**:
> Architecture Phase 1 establishes the canonical authorization mechanism, schema, and API contracts. It does NOT invent or lock institutional policies that have not been decided by the Business Owner. Capabilities are categorized into **VERIFIED / LOCKED** (active production baseline) and **PROPOSED / TBD** (mechanism designed, assignment pending Business Owner approval).

---

## 2. Verified & Locked Capabilities (Production Baseline)

The following capabilities represent verified, independently audited production behaviors (PR #10 through PR #13) that are formally locked into the baseline:

| Capability Code | Description | Verified Authorized Positions | Verified Scope | Invariant Reference |
| :--- | :--- | :--- | :--- | :--- |
| `tahfizh.student.read` | Membaca daftar dan profil capaian hafalan santri | `MUDIR`, `KABID_TAHFIZH`, `MUSYRIF_TAHFIZH` | Kabid: `DOMAIN`; Musyrif: `HALAQOH` | Strict halaqoh enclosure for ordinary MT |
| `tahfizh.setoran.create` | Mencatat setoran hafalan baru (Sabaq/Sabqi/Manzil/Mufar) | `MUSYRIF_TAHFIZH` (in assigned halaqoh) | Strictly `HALAQOH` (Own halaqoh only) | Kabid Tahfizh writes setoran strictly for own halaqoh |
| `tahfizh.recap.read` | Membaca rekapitulasi capaian hafalan | `MUDIR`, `KABID_TAHFIZH`, `ADMIN` (Global); `MUSYRIF_TAHFIZH` (Own) | `GLOBAL` / `DOMAIN` / `HALAQOH` | Ordinary MT restricted to own halaqoh recap |
| `tahfizh.reward.issue` | Menerbitkan reward resmi Tasmi'/Sima'an | `MUDIR`, `KABID_TAHFIZH` | `DOMAIN` / `GLOBAL` | Ordinary MT, ADM, MK strictly denied |
| `tahfizh.policy.manage` | Mengubah ambang nilai, bintang, dan kebijakan reward | `MUDIR` (`KS`) | `GLOBAL` | Kabid Tahfizh and ordinary MT strictly denied |
| `health.case.read_aggregate` | Membaca ringkasan agregat dan tren keluhan sakit Poskestren | Global: `MUDIR`, `KEPALA_KEASRAMAAN`, `PETUGAS_KESEHATAN`. Scoped: `PEMBINA_ASRAMA` (assigned kamar), `WALI_SANTRI` (own child) | `GLOBAL` / `UNIT` / `OWN_CHILD` | Non-clinical overview; honest data states |
| `health.case.read_detail` | Membaca rekam medis klinis detail, keluhan, dan diagnosa santri | Restricted: `MUDIR`, `KEPALA_KEASRAMAAN`, `PETUGAS_KESEHATAN`, `PEMBINA_ASRAMA` (assigned kamar) | `GLOBAL` / `UNIT` | Generic OSDA, Guru Akademik strictly denied |
| `health.case.create` | Menginput kejadian/keluhan awal sakit santri di Poskestren | `MUDIR`, `KEPALA_KEASRAMAAN`, `PETUGAS_KESEHATAN`, `PEMBINA_ASRAMA` | `GLOBAL` / `UNIT` | Generic OSDA denied |
| `health.case.update_status` | Memperbarui status medis (`DIPANTAU`, `PULIH`, `DIRUJUK`, `DARURAT`) | `MUDIR`, `KEPALA_KEASRAMAAN`, `PETUGAS_KESEHATAN` | `GLOBAL` / `UNIT` | Admin TU strictly denied (`DENY`); Generic OSDA denied |
| `health.case.referral` | Menerbitkan surat rujukan klinis ke Puskesmas / Rumah Sakit | `MUDIR`, `PETUGAS_KESEHATAN` | `GLOBAL` / `UNIT` | Admin TU and generic OSDA strictly denied |

### Canonical Keasramaan V2 Health Status Model
In Keasramaan V2, health statuses are canonically defined as:
- `DIPANTAU`: Santri dalam pemantauan medis Poskestren / istirahat kamar.
- `PULIH`: Santri telah dinyatakan sehat dan kembali beraktivitas normal.
- `DIRUJUK`: Pasien dirujuk ke fasilitas kesehatan luar (Puskesmas / Rumah Sakit).
- `DARURAT`: Kondisi gawat darurat medis yang memerlukan tindakan segera.

*Legacy status values (`SEMBUH`, `RAWAT_PONDOK`, `DIRUJUK_PUSKESMAS`, `PULANG`) are retained strictly as read-compatibility bridges and are mapped to V2 canonical statuses.*

---

## 3. Proposed Capabilities (TBD — Pending Business Owner Approval)

The following capability definitions are architecturally standardized, but the specific matrix of who receives them is **TBD — REQUIRES BUSINESS OWNER APPROVAL**:

### 3.1. Ketahfidzhan Lanjutan (`tahfizh.*`)
| Capability Code | Description | Authorized Positions | Status |
| :--- | :--- | :--- | :--- |
| `tahfizh.setoran.cancel` | Membatalkan setoran tahfizh (dengan alasan & audit) | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `tahfizh.target.manage` | Menetapkan target bulanan/pekanan santri | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `tahfizh.ikhtibar.evaluate_s1` | Menilai ujian kenaikan juz Tahap 1 | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `tahfizh.ikhtibar.evaluate_s2` | Menilai munaqasyah akhir Tahap 2 | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |
| `tahfizh.finalization.run` | Finalisasi rekapitulasi bulanan dan sanksi | **TBD — BUSINESS OWNER APPROVAL REQUIRED** | Proposed |

### 3.2. Keasramaan & Kesantrian (`keasramaan.*`)
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
