---
name: git-verification-skill
description: Use this skill whenever reporting that code changes are complete, committed, or pushed to GitHub, or before claiming any task is "done"/"selesai". Enforces raw command output as proof instead of narrative summaries.
---

# Git Verification Skill

## Aturan Wajib
Sebelum melaporkan tugas apapun sebagai "selesai", "berhasil di-push", atau "sudah
di-deploy", JALANKAN dan TAMPILKAN OUTPUT MENTAH (bukan ringkasan/parafrase) dari:

```bash
git status
git add .
git commit -m "<pesan commit deskriptif>"
git push origin main
git log --oneline -5
```

## Larangan
- JANGAN menulis "berhasil di-push ke GitHub" tanpa menyertakan output asli `git push`
- JANGAN meringkas output git menjadi kalimat naratif — tampilkan apa adanya, termasuk
  jika ada error
- JANGAN mengklaim commit hash tertentu tanpa itu benar-benar muncul di `git log`
- Jika `git push` gagal (auth error, rejected, dll.), LAPORKAN error itu APA ADANYA,
  jangan coba "menyembunyikan" kegagalan dengan bahasa yang ambigu

## Verifikasi Tambahan (jika memungkinkan)
Setelah push, cek ulang dengan `git log origin/main --oneline -1` atau fetch remote
(`git fetch && git log origin/main -1`) untuk konfirmasi commit benar-benar sampai ke
remote, bukan cuma tersimpan di HEAD lokal.
