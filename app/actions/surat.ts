"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, recordAuditLog } from "@/lib/auth";
import { JenisSurat, StatusSurat } from "@prisma/client";

export interface GenerateSuratInput {
  jenisSurat: JenisSurat;
  perihal: string;
  tujuan: string;
  namaSantri?: string;
  nisSantri?: string;
  kelasSantri?: string;
  isiPokok: string;
}

/**
 * Server Action: Generator Surat Resmi AI (Kop Resmi Pondok, Penomoran Otomatis, Redaksi Formal)
 */
export async function generateSuratAIAction(input: GenerateSuratInput) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Silakan login terlebih dahulu." };
  }

  // Khusus Admin (ADM) dan Mudir (KS)
  if (session.role !== "ADM" && session.role !== "KS") {
    return {
      success: false,
      message: `Role ${session.role} tidak berwenang menerbitkan surat resmi lembaga.`,
    };
  }

  try {
    const count = await prisma.suratResmi.count();
    const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const currentMonth = romanMonths[new Date().getMonth()];
    const currentYear = new Date().getFullYear();

    // Kode jenis surat
    const kodeJenis =
      input.jenisSurat === JenisSurat.SURAT_KETERANGAN_AKTIF
        ? "SK"
        : input.jenisSurat === JenisSurat.SURAT_UNDANGAN_WALI
        ? "UND"
        : input.jenisSurat === JenisSurat.SURAT_IZIN_KEGIATAN
        ? "IZN"
        : "REK";

    const nomorSurat = `${String(count + 1).padStart(3, "0")}/STQ-DUC/${kodeJenis}/${currentMonth}/${currentYear}`;

    // Generator Naskah Surat Resmi AI berbasis template kepesantrenan
    let naskahSurat = "";

    if (input.jenisSurat === JenisSurat.SURAT_KETERANGAN_AKTIF) {
      naskahSurat = `KOP SURAT RESMI
PESANTREN TAHFIZH QUR'AN DARUL ULUM CENDEKIA
Alamat: Jl. Cendekia No. 12, Kompleks Pesantren STQ DUC | Telp: (021) 88997766
================================================================================

SURAT KETERANGAN SANTRI AKTIF
Nomor: ${nomorSurat}

Yang bertanda tangan di bawah ini:
Nama        : Ust. Andi Quarzy Ayatullah, S.H, M.H
Jabatan     : Kepala Sekolah / Mudir STQ Darul Ulum Cendekia

Menerangkan dengan sesungguhnya bahwa:
Nama Santri : ${input.namaSantri || "Muhammad Fatih Al-Ayyubi"}
NIS         : ${input.nisSantri || "SAN-0001"}
Kelas       : ${input.kelasSantri || "7A (Takhossus Tahfizh)"}

Adalah benar santri aktif yang terdaftar dan sedang menempuh pendidikan kepesantrenan serta program tahfizh Al-Qur'an di STQ Darul Ulum Cendekia pada Tahun Ajaran ${currentYear}/${currentYear + 1}.

Surat keterangan ini diterbitkan untuk keperluan:
${input.isiPokok || "Kelengkapan administrasi beasiswa pendidikan dan dokumen resmi santri."}

Demikian surat keterangan ini kami buat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.

Wassalamu'alaikum Warahmatullahi Wabarakatuh.

Diterbitkan di : Bogor
Pada tanggal   : ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}

Mudir STQ Darul Ulum Cendekia,


( Ust. Andi Quarzy Ayatullah, S.H, M.H )`;
    } else if (input.jenisSurat === JenisSurat.SURAT_UNDANGAN_WALI) {
      naskahSurat = `KOP SURAT RESMI
PESANTREN TAHFIZH QUR'AN DARUL ULUM CENDEKIA
================================================================================

SURAT UNDANGAN PERTEMUAN WALI SANTRI
Nomor: ${nomorSurat}

Kepada Yth.
Bapak / Ibu Wali Santri: ${input.tujuan}
Di Tempat

Assalamu'alaikum Warahmatullahi Wabarakatuh,

Segala puji bagi Allah Subhanahu wa Ta'ala atas limpahan rahmat dan karunia-Nya. Sholawat serta salam semoga tercurah kepada Nabi Muhammad Shallallahu 'Alaihi Wasallam.

Sehubungan dengan agenda evaluasi perkembangan capaian tahfizh dan pembinaan akhlak santri, kami mengundang Bapak/Ibu untuk hadir pada:

Perihal : ${input.perihal}
Agenda  : ${input.isiPokok || "Rapat Pleno Laporan Capaian Tahfizh Semester & Pembahasan Agenda Asrama"}

Besar harapan kami Bapak/Ibu dapat hadir tepat pada waktunya demi keberkahan dan keberlanjutan pendidikan ananda santri.

Wassalamu'alaikum Warahmatullahi Wabarakatuh.

Mudir STQ Darul Ulum Cendekia,

( Ust. Andi Quarzy Ayatullah, S.H, M.H )`;
    } else if (input.jenisSurat === JenisSurat.SURAT_REKOMENDASI) {
      naskahSurat = `KOP SURAT RESMI
PESANTREN TAHFIZH QUR'AN DARUL ULUM CENDEKIA
Alamat: Jl. Cendekia No. 12, Kompleks Pesantren STQ DUC | Telp: (021) 88997766
================================================================================

SURAT KETERANGAN SELESAI PENGABDIAN (KHIDMAH)
Nomor: ${nomorSurat}

Yang bertanda tangan di bawah ini:
Nama        : Ust. Andi Quarzy Ayatullah, S.H, M.H
Jabatan     : Mudir / Kepala Sekolah STQ Darul Ulum Cendekia

Menerangkan dengan sesungguhnya bahwa:
Nama Santri : ${input.namaSantri || "Alumni Santri STQ Darul Ulum Cendekia"}
NIS         : ${input.nisSantri || "SAN-ALUMNI"}
Jenjang     : Tamatan SMA Takhossus Tahfizh Qur'an

Telah menyelesaikan masa Pengabdian (Khidmah) selama 1 (satu) tahun penuh di Pesantren Tahfizh Qur'an Darul Ulum Cendekia terhitung sejak tanggal penetapan, dengan dedikasi, integritas, adab, dan kinerja yang AMAT BAIK (MUMTAZ) dalam bidang pendampingan tahfizh dan keasramaan.

Berdasarkan pertimbangan kelulusan dan penuntasan pengabdian tersebut, ananda berhak menerima Ijazah, Transkrip Nilai Akademik-Tahfizh, serta Rekomendasi Resmi Lembaga untuk melanjutkan studi ke jenjang perguruan tinggi maupun berkiprah di tengah masyarakat.

Demikian Surat Keterangan Selesai Pengabdian ini kami terbitkan dengan penuh amanah agar dapat dipergunakan sebagaimana mestinya.

Wassalamu'alaikum Warahmatullahi Wabarakatuh.

Diterbitkan di : Bogor
Pada tanggal   : ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}

Mudir STQ Darul Ulum Cendekia,


( Ust. Andi Quarzy Ayatullah, S.H, M.H )`;
    } else {
      naskahSurat = `KOP SURAT RESMI
PESANTREN TAHFIZH QUR'AN DARUL ULUM CENDEKIA
================================================================================

SURAT RESMI LEMBAGA
Nomor   : ${nomorSurat}
Perihal : ${input.perihal}

Kepada Yth.
${input.tujuan}
Di Tempat

Assalamu'alaikum Warahmatullahi Wabarakatuh,

Dengan hormat, kami sampaikan hal-hal pokok sebagai berikut:
${input.isiPokok}

Demikian surat ini kami sampaikan atas perhatian dan kerjasamanya kami ucapkan jazakumullah khairan katsiran.

Mudir STQ Darul Ulum Cendekia,

( Ust. Andi Quarzy Ayatullah, S.H, M.H )`;
    }

    // Simpan ke database
    const suratRecord = await prisma.suratResmi.create({
      data: {
        nomorSurat,
        jenisSurat: input.jenisSurat,
        perihal: input.perihal,
        tujuan: input.tujuan,
        isiSurat: naskahSurat,
        status: StatusSurat.FINAL,
        dibuatOleh: session.username,
        penandatangan: "Ust. Andi Quarzy Ayatullah, S.H, M.H (Mudir)",
      },
    });

    await recordAuditLog({
      userId: session.userId,
      action: "GENERATE_SURAT_AI",
      entity: "SuratResmi",
      entityId: suratRecord.id,
      details: {
        nomorSurat,
        jenisSurat: input.jenisSurat,
        tujuan: input.tujuan,
      },
    });

    return {
      success: true,
      message: `Surat resmi nomor ${nomorSurat} berhasil digenerate oleh engine AI.`,
      data: suratRecord,
    };
  } catch (error) {
    console.error("Gagal generate surat AI:", error);
    return { success: false, message: "Terjadi kesalahan saat memproses surat resmi AI." };
  }
}

/**
 * Server Action: Mengambil arsip surat resmi
 */
export async function getDaftarSuratAction() {
  try {
    const list = await prisma.suratResmi.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: list };
  } catch (error) {
    console.error("Gagal mengambil daftar surat:", error);
    return { success: false, data: [] };
  }
}
