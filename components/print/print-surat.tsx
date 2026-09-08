import React from "react";
import { KopSurat } from "./kop-surat";
import { cn } from "@/lib/utils";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";

export interface PrintSuratProps {
  nomorSurat?: string;
  perihal: string;
  tujuan: string;
  santriNama?: string;
  santriNis?: string;
  santriKelas?: string;
  isiPokok: string;
  tanggalSurat?: string;
  className?: string;
}

export function PrintSurat({
  nomorSurat = `024/${INSTITUTION_CONFIG.shortName}/SK/IX/2026`,
  perihal,
  tujuan,
  santriNama = "Muhammad Fatih Al-Ayyubi",
  santriNis = "SAN-0001",
  santriKelas = "7A",
  isiPokok,
  tanggalSurat = "08 September 2026",
  className,
}: PrintSuratProps) {
  return (
    <div className={cn("bg-white text-black p-4 max-w-[210mm] mx-auto text-xs font-serif leading-relaxed", className)}>
      <KopSurat />

      {/* Meta Surat */}
      <div className="flex justify-between items-start mb-6 font-sans text-xs">
        <div className="space-y-0.5">
          <p><span className="inline-block w-20 font-semibold">Nomor</span>: {nomorSurat}</p>
          <p><span className="inline-block w-20 font-semibold">Lampiran</span>: -</p>
          <p><span className="inline-block w-20 font-semibold">Perihal</span>: <strong>{perihal}</strong></p>
        </div>
        <div className="text-right">
          <p>{INSTITUTION_CONFIG.kota}, {tanggalSurat}</p>
          <p className="mt-2 text-left">
            Kepada Yth.<br />
            <strong>{tujuan}</strong><br />
            Di Tempat
          </p>
        </div>
      </div>

      {/* Salam Pembuka */}
      <p className="mb-3">Assalamu&apos;alaikum Warahmatullahi Wabarakatuh,</p>

      <p className="mb-4 text-justify indent-6">
        Segala puji bagi Allah Subhanahu Wa Ta&apos;ala yang senantiasa melimpahkan taufiq dan hidayah-Nya kepada kita semua. Sholawat serta salam semoga tercurah kepada junjungan Nabi Muhammad Shallallahu &apos;Alaihi Wasallam, keluarga, sahabat, dan umat beliau hingga akhir zaman.
      </p>

      <p className="mb-3">
        Yang bertanda tangan di bawah ini, Mudir {INSTITUTION_CONFIG.pesantrenName}, menerangkan dengan sebenarnya bahwa santri berikut:
      </p>

      {/* Identitas Santri */}
      <div className="my-4 mx-6 p-3 border border-black font-sans text-xs space-y-1">
        <p><span className="inline-block w-32 font-semibold">Nama Lengkap</span>: <strong>{santriNama}</strong></p>
        <p><span className="inline-block w-32 font-semibold">Nomor Induk Santri</span>: {santriNis}</p>
        <p><span className="inline-block w-32 font-semibold">Tingkat / Kelas</span>: {santriKelas} (Takhossus Tahfizh Al-Qur&apos;an)</p>
        <p><span className="inline-block w-32 font-semibold">Status</span>: Santri Aktif Pesantren</p>
      </div>

      {/* Isi Pokok */}
      <div className="mb-4 text-justify">
        <p className="font-semibold mb-1">Maksud dan Keperluan:</p>
        <p className="p-3 bg-gray-50 border border-black/20 italic">
          &ldquo;{isiPokok}&rdquo;
        </p>
      </div>

      <p className="mb-6 text-justify indent-6">
        Demikian surat resmi ini kami terbitkan dengan penuh amanah dan tanggung jawab agar dapat dipergunakan sebagaimana mestinya oleh pihak yang berkepentingan. Atas perhatian dan kerja samanya, kami ucapkan jazakumullahu khairan katsiran.
      </p>

      <p className="mb-8">Wassalamu&apos;alaikum Warahmatullahi Wabarakatuh.</p>

      {/* Tanda Tangan */}
      <div className="flex justify-end pt-4">
        <div className="text-center w-64">
          <p>Mudir {INSTITUTION_CONFIG.shortName},</p>
          <div className="h-20 flex items-center justify-center italic text-gray-400">
            ( Cap &amp; Tanda Tangan Basah )
          </div>
          <p className="font-bold underline text-sm">Ust. Andi Quarzy Ayatullah, S.H, M.H</p>
          <p className="text-[10px] text-gray-600 font-sans">NIP. 20210701001</p>
        </div>
      </div>
    </div>
  );
}
