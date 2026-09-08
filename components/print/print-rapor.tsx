import React from "react";
import { KopSurat } from "./kop-surat";
import { cn } from "@/lib/utils";

export interface PrintRaporProps {
  santri: {
    nama: string;
    nis: string;
    kelas: string;
    halaqoh: string;
    capaianJuz: number;
    targetJuz: number;
    setoranTerakhir?: string;
    nilaiTerakhir?: string;
  };
  nilaiAkademik: Array<{
    mapel: string;
    kategori: string;
    angka: number;
    huruf: string;
    guru: string;
  }>;
  tahunAjaran?: string;
  semester?: string;
  tanggalCetak?: string;
  className?: string;
}

export function PrintRapor({
  santri,
  nilaiAkademik,
  tahunAjaran = "2026/2027",
  semester = "Ganjil",
  tanggalCetak = "08 September 2026",
  className,
}: PrintRaporProps) {
  const rataRata =
    nilaiAkademik.length > 0
      ? (
          nilaiAkademik.reduce((sum, n) => sum + n.angka, 0) /
          nilaiAkademik.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className={cn("bg-white text-black p-4 max-w-[210mm] mx-auto text-xs font-sans", className)}>
      <KopSurat />

      <div className="text-center my-3">
        <h3 className="text-sm font-bold uppercase tracking-wider underline font-serif">
          Laporan Hasil Belajar Santri (Rapor Terpadu)
        </h3>
        <p className="text-[11px] text-gray-700">
          Semester {semester} — Tahun Ajaran {tahunAjaran}
        </p>
      </div>

      {/* Biodata Santri */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 p-2.5 border border-black text-xs">
        <div className="flex">
          <span className="w-28 font-semibold">Nama Santri</span>
          <span>: <strong>{santri.nama}</strong></span>
        </div>
        <div className="flex">
          <span className="w-28 font-semibold">NIS</span>
          <span>: {santri.nis}</span>
        </div>
        <div className="flex">
          <span className="w-28 font-semibold">Kelas</span>
          <span>: {santri.kelas} (Takhossus Tahfizh)</span>
        </div>
        <div className="flex">
          <span className="w-28 font-semibold">Halaqoh</span>
          <span>: {santri.halaqoh}</span>
        </div>
      </div>

      {/* Bagian 1: Capaian Tahfizh Al-Qur'an */}
      <div className="mb-4">
        <h4 className="font-bold uppercase text-[11px] mb-1">
          I. Capaian Tahfizh Al-Qur&apos;an
        </h4>
        <table className="w-full border-collapse border border-black text-center text-xs">
          <thead>
            <tr className="bg-gray-100 border border-black">
              <th className="border border-black py-1 px-2">Capaian Mutqin</th>
              <th className="border border-black py-1 px-2">Target Kurikulum</th>
              <th className="border border-black py-1 px-2">Setoran Terakhir</th>
              <th className="border border-black py-1 px-2">Kualitas Tajwid & Kelancaran</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black py-1.5 px-2 font-bold">{santri.capaianJuz} Juz</td>
              <td className="border border-black py-1.5 px-2">{santri.targetJuz} Juz</td>
              <td className="border border-black py-1.5 px-2">{santri.setoranTerakhir || "Ali 'Imran: 1-20"}</td>
              <td className="border border-black py-1.5 px-2 font-semibold">
                {santri.nilaiTerakhir || "MUMTAZ (Istimewa)"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bagian 2: Capaian Akademik & Diniyah */}
      <div className="mb-4">
        <h4 className="font-bold uppercase text-[11px] mb-1">
          II. Nilai Akademik & Muatan Diniyah
        </h4>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 text-center">
              <th className="border border-black py-1 px-2 w-10">No</th>
              <th className="border border-black py-1 px-3 text-left">Mata Pelajaran</th>
              <th className="border border-black py-1 px-2">Kategori</th>
              <th className="border border-black py-1 px-2 w-16">Nilai Angka</th>
              <th className="border border-black py-1 px-2 w-16">Predikat</th>
              <th className="border border-black py-1 px-3 text-left">Guru Pengampu</th>
            </tr>
          </thead>
          <tbody>
            {nilaiAkademik.map((n, idx) => (
              <tr key={idx}>
                <td className="border border-black py-1 px-2 text-center">{idx + 1}</td>
                <td className="border border-black py-1 px-3 font-medium">{n.mapel}</td>
                <td className="border border-black py-1 px-2 text-center">{n.kategori}</td>
                <td className="border border-black py-1 px-2 text-center font-bold">{n.angka}</td>
                <td className="border border-black py-1 px-2 text-center font-bold">{n.huruf}</td>
                <td className="border border-black py-1 px-3">{n.guru}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td colSpan={3} className="border border-black py-1.5 px-3 text-right">
                Rata-rata Nilai Akademik:
              </td>
              <td colSpan={3} className="border border-black py-1.5 px-3">
                {rataRata}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Catatan Pembina */}
      <div className="mb-6 p-2.5 border border-black">
        <p className="font-semibold mb-1">Catatan Musyrif & Mudir:</p>
        <p className="italic text-gray-800">
          &quot;Alhamdulillah ananda istiqomah dalam murojaah harian dan memiliki adab yang baik di asrama. Tingkatkan terus ziyadah hafalan pada juz berikutnya.&quot;
        </p>
      </div>

      {/* Tanda Tangan Berjenjang */}
      <div className="grid grid-cols-3 text-center text-xs pt-4 gap-4">
        <div>
          <p>Orang Tua / Wali Santri,</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1 font-semibold mx-4">( .............................. )</p>
        </div>

        <div>
          <p>Musyrif Halaqoh,</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1 font-semibold mx-4">
            ( Ust. Hamzah Ar-Rasyid )
          </p>
        </div>

        <div>
          <p>Mengetahui,</p>
          <p className="font-semibold">Mudir STQ Darul Ulum Cendekia</p>
          <div className="h-12" />
          <p className="border-t border-black pt-1 font-bold mx-4">
            ( Ust. H. Ahmad Fauzi, Lc., M.Pd. )
          </p>
        </div>
      </div>

      <div className="mt-6 text-[9px] text-gray-500 text-right">
        Dicetak secara otomatis melalui STQ Education Portal pada: {tanggalCetak}
      </div>
    </div>
  );
}
