# STQ ARCHITECTURE INVARIANTS — CANONICAL SAFETY CONTRACTS
**Non-Negotiable System Invariants, Security Boundaries, and Domain Guarantees**  
**Document**: `docs/STQ_ARCHITECTURE_INVARIANTS.md`  
**Status**: `ARCHITECTURE_LOCKED`

---

## 1. Core Security & System Invariants

1. **INV-SEC-01 (Fail-Closed Default Deny)**:
   Any request lacking an authenticated, active session, or matching an unrecognized capability/scope, MUST be rejected fail-closed. No action may proceed upon exception, undefined state, or database timeout.
2. **INV-SEC-02 (Server Authoritative)**:
   The server action or API route handler is the sole authoritative decision point. Client-side state, hidden buttons, or disabled DOM elements confer zero authorization.
3. **INV-SEC-03 (Untrusted Caller Parameters)**:
   All submitted identifiers (`santriId`, `halaqohId`, `unitId`) must be validated against the caller's server-resolved permissions. Submitting another unit's ID must fail with `SCOPE_MISMATCH`.
4. **INV-SEC-04 (No Person-Name / Username Heuristics)**:
   Authorization must never inspect `session.username`, `session.name`, or staff display names to infer authority. Authority derives strictly from active, verified `Assignments`.
5. **INV-SEC-05 (Audit Immutability & Attribution)**:
   Every mutating action must produce an immutable `AuditLog` entry. Transactions performed via shared kiosk/unit accounts MUST attribute both the `technicalUserId` and the verified `executorId`.

---

## 2. Tahfizh Domain Invariants

1. **INV-TAF-01 (Kabid Institutional Supervision Scope)**:
   Ust. Razan Mufli, S.Pd holds the position of **Kabid Tahfizh**. He is legitimately authorized to read institutional Tahfizh metrics, view halaqoh recaps, and monitor academic progress across all halaqoh.
2. **INV-TAF-02 (Setoran WRITE Enclosure)**:
   Managerial READ access does NOT imply global WRITE access. Every Musyrif—including Kabid Tahfizh—is strictly restricted to creating setoran for students in their own assigned halaqoh (own halaqoh Setoran WRITE only). Any cross-halaqoh setoran write is rejected server-side.
3. **INV-TAF-03 (Tasmi'/Sima'an Reward Issuance)**:
   Issuance of official Tasmi' / Sima'an hafalan rewards is strictly restricted to:
   - **Mudir (`KS`)**
   - **Kabid Tahfizh** (held via verified `Position: KABID_TAHFIZH`)
   Ordinary Musyrif Tahfizh, Admin TU, Musyrif Keasramaan, and other staff are denied reward issuance server-side fail-closed.
4. **INV-TAF-04 (Reward & Sanksi Policy Management)**:
   Editing baseline reward thresholds, star multipliers, leave days, and sanction criteria is strictly restricted to the **Mudir (`KS`)**. Neither Kabid Tahfizh nor ordinary MT may edit policy parameters.
5. **INV-TAF-05 (Ordinary Musyrif Tahfizh Scoping)**:
   Ordinary Musyrif Tahfizh (e.g. Ustadzah Lisa Dwina Fitri) have access strictly confined to their assigned halaqoh binaan (e.g. 10 santriwati for Halaqoh Lisa). They must not see global recaps, student details outside their halaqoh, or administrative controls.
6. **INV-TAF-06 (Legacy / Unlinked Account Protection)**:
   Unlinked or legacy MT accounts (such as `razan.mt`) that lack active halaqoh assignments must fail closed with zero binaan, disabled setoran creation, and zero administrative access.

---

## 3. Health & Poskestren Invariants

1. **INV-HLT-01 (Health Data Honesty & False "Sehat" Elimination)**:
   A failed data fetch, network error, or missing record must NEVER be displayed as `"Sehat"`.
   - Verified healthy $\implies$ `"Sehat"`.
   - Active medical case $\implies$ Formatted condition (e.g. `"RAWAT PONDOK"`).
   - Empty record set $\implies$ `"Belum ada data kesehatan"`.
   - Fetch error / server error $\implies$ `"Gagal memuat data kesehatan"`.
   - Access denied $\implies$ `"Akses data kesehatan tidak tersedia"`.
2. **INV-HLT-02 (Global Health Read Authority)**:
   Global read access to Poskestren medical records is authorized strictly to:
   - Mudir (`KS`)
   - Musyrif Keasramaan (`MK`)
   - Admin TU (`ADM`)
   - Assigned OSDA Petugas Kesehatan (via explicit assignment to `Unit: DIVISI_KESEHATAN`).
3. **INV-HLT-03 (Individual & Guardian Health Read Authority)**:
   - Wali Santri (`WS`) may read health records strictly for their enrolled child (`Scope: OWN_CHILD`).
   - Santri (`ST`) may read health records strictly for themselves (`Scope: SELF`).
   - Other roles (MT, PH, GA, YAY, generic OSDA) are denied health read access fail-closed.
4. **INV-HLT-04 (Health Status Update Authority)**:
   Updating a patient's medical status (e.g., changing from Rawat Pondok to Dirujuk Puskesmas) requires clinical oversight and is restricted to:
   - Mudir (`KS`)
   - Musyrif Keasramaan (`MK`)
   - Assigned OSDA Petugas Kesehatan.
   Admin TU (`ADM`) is strictly denied status updates (`DENY`).
5. **INV-HLT-05 (Generic OSDA Denied Health Access)**:
   A user holding the generic role `OSDA` has ZERO health access unless an explicit active assignment links them to `Unit: DIVISI_KESEHATAN` with capability `health.case.create`.

---

## 4. Keasramaan & Organizational Invariants

1. **INV-KSR-01 (Keasramaan Hierarchy)**:
   The operational hierarchy of Keasramaan is strictly maintained:
   $$\text{Mudir} \longrightarrow \text{Musyrif Keasramaan} \longrightarrow \text{Mudabbir} \longrightarrow \text{OSDA / TKS} \longrightarrow \text{Usroh / Santri}$$
2. **INV-KSR-02 (Mudabbir Non-Aliasing Contract)**:
   Mudabbir is an independent organizational position within Keasramaan:
   - Mudabbir ≠ PH (Pembina Halaqoh).
   - Mudabbir ≠ MT (Musyrif Tahfizh).
   - Mudabbir ≠ generic OSDA.
   Mudabbir authority derives strictly from active assignment to Kamar units, not role aliasing.
3. **INV-KSR-03 (Mudabbir Multi-Kamar Supervision)**:
   A Mudabbir is an assigned position within Keasramaan. One Mudabbir may hold assignments to multiple Kamar units simultaneously. His operational authority dynamically encompasses all assigned rooms.
4. **INV-KSR-04 (Pembina Divisi Reporting Line)**:
   The Pembina Divisi for OSDA wings reports directly to the Musyrif Keasramaan, not to the student Ketua OSDA. A division may have multiple Pembina Divisi.
5. **INV-KSR-05 (TKS Autonomy & Structure)**:
   Tenaga Kebersihan & Servis (TKS) operates separately from OSDA. There is no central "Ketua TKS". Unit Dapur and Unit Masjid operate with a designated Ketua + Anggota; other units operate via assigned individual operators.
6. **INV-KSR-06 (Unit Account Attribution & Human Executor)**:
   Operational kiosk and unit accounts (OSDA, TKS, Poskestren) must require input of the authenticated human executor (`executorId` / `executorName`). Both technical account and human executor must be permanently recorded in `AuditLog`.

---

## 5. Branch & Isolation Invariant

1. **INV-GIT-01 (PR #8 Absolute Integrity)**:
   Branch `review/tahfizh-quality-evaluation` (HEAD `9068cae5587b7219c394c5c25bf0de07a15b0726`) MUST remain completely untouched. No commit, rebase, cherry-pick, or merge may touch PR #8 during the Architecture Lock.
