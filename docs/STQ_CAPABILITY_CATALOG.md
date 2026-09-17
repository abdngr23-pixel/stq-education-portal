# STQ CAPABILITY CATALOG — SPECIFICATION & REGISTRY
**Granular, Domain-Scoped Capability Taxonomy for the STQ Education Portal**  
**Document**: `docs/STQ_CAPABILITY_CATALOG.md`  
**Status**: `ARCHITECTURE_LOCKED`

---

## 1. Capability Naming Convention

All capabilities in the STQ Portal adhere to a strict 3-tier dot-notated nomenclature:

$$\text{Code} = \langle\text{domain}\rangle.\langle\text{entity}\rangle.\langle\text{action}\rangle$$

Where:
- **`domain`**: The organizational domain (`tahfizh`, `keasramaan`, `health`, `academic`, `logistics`, `finance`, `letters`, `sponsor`, `system`).
- **`entity`**: The noun representing the target resource (`setoran`, `recap`, `reward`, `policy`, `permission`, `discipline`, `case`, `score`, `stock`, `user`, `assignment`).
- **`action`**: The verb describing the operation (`read`, `create`, `update`, `cancel`, `approve`, `issue`, `inspect`, `mutate`, `manage`).

---

## 2. Exhaustive Capability Registry

### 2.1. Bidang Ketahfidzhan (`tahfizh.*`)

| Capability Code | Description | Authorized Positions (Default) | Scope Requirement |
| :--- | :--- | :--- | :--- |
| `tahfizh.student.read` | Membaca daftar dan profil capaian santri | `MUDIR`, `KABID_TAHFIZH`, `MUSYRIF_TAHFIZH` | Enclosed by halaqoh assignment (Kabid: Domain) |
| `tahfizh.setoran.create` | Mencatat setoran hafalan baru (Sabaq/Sabqi/Manzil/Mufar) | `MUSYRIF_TAHFIZH` | Strictly `HALAQOH` (Own halaqoh only) |
| `tahfizh.setoran.cancel` | Membatalkan setoran tahfizh (dengan audit log & alasan) | `MUSYRIF_TAHFIZH`, `KABID_TAHFIZH` | `HALAQOH` (Musyrif) / `DOMAIN` (Kabid) |
| `tahfizh.target.manage` | Menetapkan target bulanan/pekanan hafalan santri | `MUSYRIF_TAHFIZH`, `KABID_TAHFIZH` | `HALAQOH` (Musyrif) / `DOMAIN` (Kabid) |
| `tahfizh.recap.read_assigned` | Membaca rekapitulasi capaian halaqoh sendiri | `MUSYRIF_TAHFIZH` | `HALAQOH` |
| `tahfizh.recap.read_global` | Membaca rekapitulasi capaian lintas seluruh halaqoh | `MUDIR`, `KABID_TAHFIZH`, `ADMIN` | `GLOBAL` / `DOMAIN` |
| `tahfizh.ikhtibar.evaluate_s1` | Menguji & menilai ujian kenaikan juz Tahap 1 | `MUSYRIF_TAHFIZH`, `KABID_TAHFIZH` | `DOMAIN` |
| `tahfizh.ikhtibar.evaluate_s2` | Menguji & menilai munaqasyah akhir Tahap 2 | `MUDIR` | `GLOBAL` |
| `tahfizh.reward.issue` | Menerbitkan reward kelulusan Tasmi'/Sima'an | `MUDIR`, `KABID_TAHFIZH` | `DOMAIN` / `GLOBAL` (Ordinary MT strictly denied) |
| `tahfizh.reward.cancel` | Membatalkan penganugerahan reward santri | `MUDIR` | `GLOBAL` |
| `tahfizh.policy.manage` | Mengubah ambang nilai, bintang, dan hak libur | `MUDIR` | `GLOBAL` (Kabid strictly denied) |
| `tahfizh.finalization.run` | Memfinalisasi rekap bulanan dan menghitung sanksi | `MUDIR` | `GLOBAL` |

---

### 2.2. Bidang Keasramaan & Kesantrian (`keasramaan.*`)

| Capability Code | Description | Authorized Positions (Default) | Scope Requirement |
| :--- | :--- | :--- | :--- |
| `keasramaan.permission.create` | Mencatat pengajuan perizinan santri | `KEPALA_KEASRAMAAN`, `MUDIR`, `MUDABBIR` | `GLOBAL` (MK/KS) / `KAMAR` (Mudabbir) |
| `keasramaan.permission.approve_mk` | Verifikasi & persetujuan izin operasional pondok (Tier 1) | `KEPALA_KEASRAMAAN` | `DOMAIN` |
| `keasramaan.permission.approve_ks` | Pengesahan izin pulang ke rumah / luar kota (Tier 2) | `MUDIR` | `GLOBAL` |
| `keasramaan.presensi.record` | Mencatat presensi sholat berjamaah & kegiatan pondok | `KEPALA_KEASRAMAAN`, `MUDABBIR`, `PETUGAS_PRESENSI` | `UNIT` (Kamar / Asrama Putri) |
| `keasramaan.discipline.create` | Mencatat pelanggaran kedisiplinan santri | `KEPALA_KEASRAMAAN`, `MUDIR`, `MUDABBIR` | `DOMAIN` (MK) / `KAMAR` (Mudabbir) |
| `keasramaan.sp.issue` | Menerbitkan Surat Peringatan (SP 1, SP 2, SP 3) | `KEPALA_KEASRAMAAN`, `MUDIR` | `DOMAIN` / `GLOBAL` |
| `keasramaan.sp.whitewash` | Melakukan pemutihan poin pelanggaran / SP santri | `MUDIR` | `GLOBAL` |
| `keasramaan.star.award` | Mencatat penganugerahan bintang kebaikan | `MUDIR`, `ADMIN` | `GLOBAL` |
| `keasramaan.kamar.inspect` | Memeriksa kebersihan, kerapihan, dan inventaris kamar | `MUDABBIR`, `KEPALA_KEASRAMAAN` | `ASSIGNED_UNITS` |
| `keasramaan.usroh.supervise` | Mengawasi pembagian tugas kebersihan harian santri | `PEMBINA_DIVISI_KEBERSIHAN`, `KETUA_OSDA` | `UNIT` (Divisi Kebersihan) |

---

### 2.3. Poskestren & Kesehatan Santri (`health.*`)

| Capability Code | Description | Authorized Positions (Default) | Scope Requirement |
| :--- | :--- | :--- | :--- |
| `health.case.read_global` | Membaca rekapitulasi keluhan sakit santri menyeluruh | `MUDIR`, `KEPALA_KEASRAMAAN`, `ADMIN`, `PETUGAS_KESEHATAN` | `GLOBAL` |
| `health.case.read_assigned` | Membaca catatan kesehatan santri anak sendiri / pribadi | `WALI_SANTRI` (own child), `SANTRI` (self) | `OWN_CHILD` / `SELF` |
| `health.case.create` | Menginput keluhan sakit santri di Poskestren | `MUDIR`, `KEPALA_KEASRAMAAN`, `ADMIN`, `MUDABBIR`, `PETUGAS_KESEHATAN` | `GLOBAL` |
| `health.status.update` | Memperbarui status rawat (Pondok, Pulang, Rujuk) | `MUDIR`, `KEPALA_KEASRAMAAN`, `PETUGAS_KESEHATAN` | `GLOBAL` (Admin TU strictly denied) |
| `health.referral.create` | Menerbitkan surat pengantar rujukan ke Puskesmas/RS | `KEPALA_KEASRAMAAN`, `MUDIR` | `GLOBAL` |

---

### 2.4. Bidang Akademik & Kurikulum (`academic.*`)

| Capability Code | Description | Authorized Positions (Default) | Scope Requirement |
| :--- | :--- | :--- | :--- |
| `academic.score.input` | Menginput nilai harian, UTS, UAS mata pelajaran | `GURU_AKADEMIK` (assigned mapel), `MUDIR` | `UNIT` (Kelas/Mapel) |
| `academic.score.read` | Membaca nilai santri | `GURU_AKADEMIK`, `MUDIR`, `WALI_SANTRI`, `SANTRI` | `GLOBAL` (Guru/Mudir), `OWN_CHILD`, `SELF` |
| `academic.rapor.print` | Mencetak rapor gabungan semesteran | `ADMIN`, `MUDIR`, `WALI_SANTRI` (own child) | `GLOBAL` / `OWN_CHILD` |
| `academic.curriculum.manage`| Mengatur mata pelajaran, KKM, dan kurikulum | `MUDIR`, `ADMIN` | `GLOBAL` |

---

### 2.5. Manajemen, Logistik & Eksternal (`logistics.*`, `finance.*`, `letters.*`, `sponsor.*`)

| Capability Code | Description | Authorized Positions (Default) | Scope Requirement |
| :--- | :--- | :--- | :--- |
| `logistics.stock.read` | Melihat sisa stok sembako, ATK, obat UKS | `ADMIN`, `OPERATOR_TKS`, `MUDIR` | `GLOBAL` |
| `logistics.stock.mutate` | Menginput barang masuk dan keluar gudang | `ADMIN`, `OPERATOR_TKS` | `GLOBAL` |
| `finance.budget.propose` | Mengajukan permohonan dana operasional bulanan | `ADMIN`, `KEPALA_KEASRAMAAN`, `KABID_TAHFIZH` | `UNIT` |
| `finance.budget.approve` | Mengesahkan pencairan anggaran pesantren | `MUDIR` | `GLOBAL` |
| `letters.official.create` | Membuat draft surat dinas/pemberitahuan resmi | `ADMIN` | `GLOBAL` |
| `letters.official.sign` | Menandatangani & menerbitkan surat keputusan | `MUDIR` | `GLOBAL` |
| `sponsor.donor.manage` | Mengelola data donatur Orang Tua Asuh | `ADMIN` | `GLOBAL` |
| `sponsor.report.send_wa` | Mengirim laporan bulanan santri via WhatsApp API | `ADMIN` | `GLOBAL` |

---

### 2.6. Administrasi Sistem & Keamanan (`system.*`)

| Capability Code | Description | Authorized Positions (Default) | Scope Requirement |
| :--- | :--- | :--- | :--- |
| `system.user.manage` | Mengelola akun login, reset password, nonaktifkan | `ADMIN`, `MUDIR` | `GLOBAL` |
| `system.assignment.manage` | Menetapkan dan mencabut Assignment staf/santri | `MUDIR` (Approved by Mudir) | `GLOBAL` |
| `system.audit.read` | Memeriksa rekam jejak aktivitas (Audit Log) | `MUDIR`, `ADMIN`, `YAYASAN` | `GLOBAL` |
| `system.calendar.manage` | Mengatur kalender agenda dan jadwal libur | `ADMIN`, `MUDIR` | `GLOBAL` |

---

## 3. Position Capability Template Mapping

When an assignment is created, it inherits its baseline capabilities from the assigned `Position`:

```json
{
  "positionCode": "KABID_TAHFIZH",
  "capabilities": [
    "tahfizh.student.read",
    "tahfizh.recap.read_global",
    "tahfizh.target.manage",
    "tahfizh.ikhtibar.evaluate_s1",
    "tahfizh.reward.issue",
    "finance.budget.propose"
  ]
}
```

Notice that `tahfizh.setoran.create` is intentionally **NOT** included in the `KABID_TAHFIZH` template. Ust. Razan gains setoran writing capability solely through his secondary assignment as `MUSYRIF_TAHFIZH` for his own halaqoh. This provides absolute mathematical protection against accidental cross-halaqoh setoran writing!
