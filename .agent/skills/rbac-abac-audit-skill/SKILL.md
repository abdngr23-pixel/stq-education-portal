---
name: rbac-abac-audit-skill
description: Use this skill whenever creating or modifying a Server Action that reads or writes santri, halaqoh, or setoran data. Ensures ownership/role checks are present before any write.
---

# RBAC/ABAC Audit Skill

## Wajib Dicek di Setiap Server Action Penulisan Data Santri
1. Apakah `session.role` diverifikasi sesuai daftar role yang diizinkan untuk aksi ini?
2. Untuk aksi terkait tahfizh/halaqoh: apakah `session.staffId` (musyrif yang login)
   SAMA dengan `santri.halaqoh.pembinaId` sebelum diizinkan menulis data untuk santri
   tersebut?
3. Untuk aksi manajemen halaqoh (`createHalaqohAction`, `assignPembinaHalaqohAction`,
   `pindahkanSantriHalaqohAction`): apakah dibatasi HANYA untuk role `KS`/`ADM`?
4. Apakah ada celah bypass lewat parameter URL/query string (`?role=`) seperti yang
   pernah ditemukan sebelumnya di audit checkpoint?

## Larangan
- Jangan asumsikan validasi role di client-side (UI hide/show) sudah cukup — SEMUA
  validasi wajib diulang di server (Server Action/middleware), karena client-side
  bisa dilewati.
- Jangan buat Server Action baru tanpa eksplisit menyebutkan role apa saja yang boleh
  memanggilnya di komentar kode.
