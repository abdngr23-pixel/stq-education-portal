import React from "react";
import { KopSurat } from "./kop-surat";
import { cn } from "@/lib/utils";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";

export interface PrintSPProps {
  nomorSurat?: string;
  tingkatSP: "SP1" | "SP2" | "SP3";
  santriNama: string;
  santriNis: string;
  santriKelas: string;
  totalPoin: number;
  riwayatPelanggaran: Array<{
    deskripsi: string;
    poin: number;
    tanggal: string;
    isPengulangan?: boolean;
  }>;
  arahanPembinaan: string;
  tanggalSurat?: string;
  className?: string;
}

export function PrintSP({
  nomorSurat = `018/${INSTITUTION_CONFIG.shortName}/SP/IX/2026`,
  tingkatSP = "SP1",
  santriNama,
  santriNis,
  santriKelas,
  totalPoin,
  riwayatPelanggaran,
  arahanPembinaan,
  tanggalSurat = "08 September 2026",
  className,
}: PrintSPProps) {
  const judulSP =
    tingkatSP === "SP3"
      ? "SURAT PERINGATAN KETIGA (SP-3) & PANGGILAN WALI"
      : tingkatSP === "SP2"
      ? "SURAT PERINGATAN KEDUA (SP-2)"
      : "SURAT PERINGATAN PERTAMA (SP-1)";

  return (
    <div className={cn("bg-white text-black p-4 max-w-[210mm] mx-auto text-xs font-serif leading-relaxed", className)}>
      <KopSurat />

      {/* Meta Surat */}
      <div className="flex justify-between items-start mb-4 font-sans text-xs">
        <div className="space-y-0.5">
          <p><span className="inline-block w-20 font-semibold">Nomor</span>: {nomorSurat}</p>
          <p><span className="inline-block w-20 font-semibold">Lampiran</span>: Rekapitulasi Pelanggaran Santri</p>
          <p><span className="inline-block w-20 font-semibold">Perihal</span>: <strong>{judulSP}</strong></p>
        </div>
        <div className="text-right">
          <p>{INSTITUTION_CONFIG.kota}, {tanggalSurat}</p>
          <p className="mt-2 text-left">
            Kepada Yth.<br />
            <strong>Orang Tua / Wali dari {santriNama}</strong><br />
            Di Tempat
          </p>
        </div>
      </div>

      <div className="text-center my-3">
        <h3 className="text-sm font-bold uppercase tracking-wider underline font-sans text-black">
          {judulSP}
        </h3>
        <p className="text-[11px] text-gray-700 font-sans">
          Berdasarkan Buku Panduan Tata Tertib &amp; Kedisiplinan {INSTITUTION_CONFIG.pesantrenName}
        </p>
      </div>

      <p className="mb-3">Assalamu&apos;alaikum Warahmatullahi Wabarakatuh,</p>

      <p className="mb-3 text-justify indent-6">
        Dengan hormat, sehubungan dengan evaluasi ketertiban dan kedisiplinan santri di lingkungan asrama dan kegiatan halaqoh, kami memberitahukan bahwa santri di bawah ini:
      </p>

      <div className="my-3 p-2.5 border border-black font-sans text-xs grid grid-cols-2 gap-2">
        <p><span className="w-24 inline-block font-semibold">Nama</span>: <strong>{santriNama}</strong></p>
        <p><span className="w-24 inline-block font-semibold">NIS</span>: {santriNis}</p>
        <p><span className="w-24 inline-block font-semibold">Kelas</span>: {santriKelas}</p>
        <p><span className="w-24 inline-block font-semibold">Total Poin</span>: <strong>{totalPoin} Poin Akumulasi</strong></p>
      </div>

      <p className="mb-2 font-sans font-semibold text-xs">
        Telah tercatat melakukan pelanggaran tata tertib sebagai berikut:
      </p>

      <table className="w-full border-collapse border border-black text-xs mb-4 font-sans">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th className="border border-black py-1 px-2 w-10">No</th>
            <th className="border border-black py-1 px-3 text-left">Deskripsi Pelanggaran</th>
            <th className="border border-black py-1 px-2 w-28">Tanggal</th>
            <th className="border border-black py-1 px-2 w-20">Poin Sanksi</th>
          </tr>
        </thead>
        <tbody>
          {riwayatPelanggaran.map((p, idx) => (
            <tr key={idx}>
              <td className="border border-black py-1 px-2 text-center">{idx + 1}</td>
              <td className="border border-black py-1 px-3">
                {p.deskripsi} {p.isPengulangan ? "(Pengulangan Poin x2)" : ""}
              </td>
              <td className="border border-black py-1 px-2 text-center">{p.tanggal}</td>
              <td className="border border-black py-1 px-2 text-center font-bold">+{p.poin}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-4 p-2.5 border border-black">
        <p className="font-semibold font-sans mb-1">Arahan &amp; Bentuk Pembinaan Edukatif:</p>
        <p className="italic text-gray-800">
          &ldquo;{arahanPembinaan}&rdquo;
        </p>
      </div>

      <p className="mb-6 text-justify indent-6">
        Surat Peringatan ini diterbitkan bukan sebagai hukuman, melainkan sebagai ikhtiar pembinaan akhlak santri agar lebih bertangung jawab, disiplin, dan beradab mulia. Kami memohon kerja sama dan bimbingan dari Ayahanda/Ibunda wali santri di rumah.
      </p>

      <p className="mb-6">Wassalamu&apos;alaikum Warahmatullahi Wabarakatuh.</p>

      {/* Tanda Tangan */}
      <div className="grid grid-cols-2 text-center text-xs font-sans gap-8 pt-4">
        <div>
          <p>Musyrif Keasramaan (MK),</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1 font-semibold mx-8">
            ( Ust. Mujaddid Zhohruddin )
          </p>
        </div>

        <div>
          <p>Mengetahui,</p>
          <p className="font-semibold">Mudir {INSTITUTION_CONFIG.pesantrenName}</p>
          <div className="h-12" />
          <p className="border-t border-black pt-1 font-bold mx-8">
            ( Ust. Andi Quarzy Ayatullah, S.H, M.H )
          </p>
        </div>
      </div>
    </div>
  );
}
