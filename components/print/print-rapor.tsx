import React from "react";
import { KopSurat } from "./kop-surat";
import { cn } from "@/lib/utils";
import { konversiPredikatNilai } from "@/lib/educational-rules";

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
    catatanPembina?: string;
  };
  nilaiAkademik: Array<{
    mapel: string;
    kategori: string;
    angka: number;
    huruf: string;
    guru: string;
  }>;
  musyrifHalaqoh?: string;
  catatanPembina?: string;
  keputusanKenaikan?: string;
  tahunAjaran?: string;
  semester?: string;
  tanggalCetak?: string;
  className?: string;
}

export function PrintRapor({
  santri,
  nilaiAkademik,
  musyrifHalaqoh = "Musyrif Halaqoh",
  catatanPembina,
  keputusanKenaikan,
  tahunAjaran = "2026/2027",
  semester = "Ganjil",
  tanggalCetak = "08 September 2026",
  className,
}: PrintRaporProps) {
  // Pisahkan nilai berdasarkan kategori kurikulum resmi Bab VI & VII
  const nilaiKepesantrenan = nilaiAkademik.filter(
    (n) => n.kategori.toLowerCase().includes("pesantren") || n.kategori.toLowerCase().includes("diniyah")
  );
  const nilaiStudiUmum = nilaiAkademik.filter(
    (n) => !n.kategori.toLowerCase().includes("pesantren") && !n.kategori.toLowerCase().includes("diniyah")
  );

  const avgKepesantrenan =
    nilaiKepesantrenan.length > 0
      ? (nilaiKepesantrenan.reduce((sum, n) => sum + n.angka, 0) / nilaiKepesantrenan.length).toFixed(1)
      : "-";

  const avgStudiUmum =
    nilaiStudiUmum.length > 0
      ? (nilaiStudiUmum.reduce((sum, n) => sum + n.angka, 0) / nilaiStudiUmum.length).toFixed(1)
      : "-";

  return (
    <div className={cn("bg-white text-black p-4 max-w-[210mm] mx-auto text-xs font-sans", className)}>
      <KopSurat />

      <div className="text-center my-3">
        <h3 className="text-sm font-bold uppercase tracking-wider underline font-serif">
          Laporan Hasil Belajar Santri (Rapor Terpadu Kurikulum Pesantren)
        </h3>
        <p className="text-[11px] text-gray-700">
          Semester {semester} — Tahun Ajaran {tahunAjaran}
        </p>
      </div>

      {/* Biodata Santri */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 p-2.5 border border-black text-xs">
        <div className="flex">
          <span className="w-28 font-semibold">Nama Santri</span>
          <span>: <strong>{santri.nama}</strong></span>
        </div>
        <div className="flex">
          <span className="w-28 font-semibold">NIS</span>
          <span>: {santri.nis}</span>
        </div>
        <div className="flex">
          <span className="w-28 font-semibold">Jenjang / Kelas</span>
          <span>: {santri.kelas} (Takhossus Tahfizh Qur&apos;an)</span>
        </div>
        <div className="flex">
          <span className="w-28 font-semibold">Kelompok Halaqoh</span>
          <span>: {santri.halaqoh}</span>
        </div>
      </div>

      {/* Aspek 1: Tahfizh Al-Qur'an (Metode Al-Pakistani) */}
      <div className="mb-3">
        <div className="bg-gray-100 border border-black px-2 py-1 flex justify-between items-center">
          <h4 className="font-bold uppercase text-[11px]">
            I. Aspek Tahfiz Al-Qur&apos;an (Metode Al-Pakistani: Sabaq, Sabqi, Manzil, Mufar)
          </h4>
          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
            Predikat: {santri.nilaiTerakhir || "-"}
          </span>
        </div>
        <table className="w-full border-collapse border border-black text-center text-xs">
          <thead>
            <tr className="bg-gray-50 border border-black">
              <th className="border border-black py-1 px-2">Capaian Mutqin</th>
              <th className="border border-black py-1 px-2">Target Akhir Program</th>
              <th className="border border-black py-1 px-2">Setoran Sabaq Terakhir</th>
              <th className="border border-black py-1 px-2">Kepatuhan Sabqi &amp; Manzil</th>
              <th className="border border-black py-1 px-2">Tajwid &amp; Fashahah</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black py-1.5 px-2 font-bold text-emerald-800">Capaian {santri.capaianJuz} Juz dari Target Akhir 30 Juz</td>
              <td className="border border-black py-1.5 px-2 font-bold">30 Juz</td>
              <td className="border border-black py-1.5 px-2 font-medium">{santri.setoranTerakhir || "-"}</td>
              <td className="border border-black py-1.5 px-2 text-gray-500 font-medium">-</td>
              <td className="border border-black py-1.5 px-2 font-semibold">
                {santri.nilaiTerakhir || "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Aspek 2: Program Kepesantrenan (Senin-Jumat) */}
      <div className="mb-3">
        <div className="bg-gray-100 border border-black px-2 py-1 flex justify-between items-center">
          <h4 className="font-bold uppercase text-[11px]">
            II. Aspek Program Kepesantrenan (Senin–Jumat 18.30–19.30 WITA)
          </h4>
          <span className="text-[10px] font-semibold">
            Rata-rata: {avgKepesantrenan}{avgKepesantrenan !== "-" ? ` (${konversiPredikatNilai(parseFloat(avgKepesantrenan))})` : ""}
          </span>
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-50 text-center">
              <th className="border border-black py-1 px-2 w-8">No</th>
              <th className="border border-black py-1 px-3 text-left">Mata Pelajaran Kepesantrenan</th>
              <th className="border border-black py-1 px-2 w-20">Nilai Angka</th>
              <th className="border border-black py-1 px-2 w-16">Predikat</th>
              <th className="border border-black py-1 px-3 text-left">Guru Pengampu</th>
            </tr>
          </thead>
          <tbody>
            {nilaiKepesantrenan.length > 0 ? (
              nilaiKepesantrenan.map((n, idx) => (
                <tr key={idx}>
                  <td className="border border-black py-1 px-2 text-center">{idx + 1}</td>
                  <td className="border border-black py-1 px-3 font-medium">{n.mapel}</td>
                  <td className="border border-black py-1 px-2 text-center font-bold">{n.angka}</td>
                  <td className="border border-black py-1 px-2 text-center font-bold">{n.huruf}</td>
                  <td className="border border-black py-1 px-3">{n.guru}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="border border-black py-2 px-3 text-center italic text-gray-500">
                  Belum ada rekaman nilai mata pelajaran kepesantrenan untuk semester ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Aspek 3: Program Studi Umum & PBL (Sabtu) */}
      <div className="mb-3">
        <div className="bg-gray-100 border border-black px-2 py-1 flex justify-between items-center">
          <h4 className="font-bold uppercase text-[11px]">
            III. Aspek Program Studi Umum &amp; PBL (Sabtu 08.00–15.30 WITA)
          </h4>
          <span className="text-[10px] font-semibold">Rata-rata: {avgStudiUmum}</span>
        </div>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-50 text-center">
              <th className="border border-black py-1 px-2 w-8">No</th>
              <th className="border border-black py-1 px-3 text-left">Mata Pelajaran Umum / Proyek PBL</th>
              <th className="border border-black py-1 px-2 w-20">Nilai Angka</th>
              <th className="border border-black py-1 px-2 w-16">Predikat</th>
              <th className="border border-black py-1 px-3 text-left">Guru Pengampu</th>
            </tr>
          </thead>
          <tbody>
            {nilaiStudiUmum.length > 0 ? (
              nilaiStudiUmum.map((n, idx) => (
                <tr key={idx}>
                  <td className="border border-black py-1 px-2 text-center">{idx + 1}</td>
                  <td className="border border-black py-1 px-3 font-medium">{n.mapel}</td>
                  <td className="border border-black py-1 px-2 text-center font-bold">{n.angka}</td>
                  <td className="border border-black py-1 px-2 text-center font-bold">{n.huruf}</td>
                  <td className="border border-black py-1 px-3">{n.guru}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="border border-black py-2 px-3 text-center italic text-gray-500">
                  Belum ada rekaman nilai mata pelajaran umum/PBL untuk semester ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="mt-1 flex items-center justify-between text-[9px] text-gray-600 italic">
          <span>Skala Predikat: A (&ge;90 Sangat Baik) | B (80–89 Baik) | C (70–79 Cukup) | D (&lt;70 Perlu Bimbingan/Remedial)</span>
          <span>Status Standar: Menunggu Konfirmasi Pengurus</span>
        </div>
      </div>

      {/* Aspek 4: Kriteria Kenaikan Semester (6 Faktor Pertimbangan Bab VIII) */}
      <div className="mb-3 p-2 border border-black bg-gray-50 text-[11px]">
        <h4 className="font-bold uppercase text-[11px] mb-1 text-black">
          IV. Kriteria Kelayakan &amp; Kenaikan Semester (6 Faktor Bab VIII)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">1. Tahfiz Al-Qur&apos;an:</span>
            <span className="text-gray-500 font-medium">Belum dinilai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">2. Kepesantrenan:</span>
            <span className="text-gray-500 font-medium">Belum dinilai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">3. Studi Umum &amp; PBL:</span>
            <span className="text-gray-500 font-medium">Belum dinilai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">4. Presensi Kehadiran:</span>
            <span className="text-gray-500 font-medium">Belum dinilai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">5. Adab &amp; Kedisiplinan:</span>
            <span className="text-gray-500 font-medium">Belum dinilai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">6. Ibadah Yaumiyah:</span>
            <span className="text-gray-500 font-medium">Belum dinilai</span>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-gray-300 flex justify-between items-center text-xs font-bold">
          <span>Keputusan Dewan Penguji &amp; Asatidz:</span>
          <span className={cn(
            "px-3 py-1 rounded border uppercase tracking-wider font-semibold",
            keputusanKenaikan
              ? "text-emerald-800 bg-emerald-100 border-emerald-300"
              : "text-slate-700 bg-slate-100 border-slate-300"
          )}>
            {keputusanKenaikan || "Belum ditetapkan"}
          </span>
        </div>
      </div>

      {/* Catatan Pembina */}
      <div className="mb-4 p-2 border border-black">
        <p className="font-semibold text-[11px] mb-0.5">Catatan Pembina Halaqoh &amp; Mudir:</p>
        <p className="italic text-gray-500 text-[11px]">
          {santri.catatanPembina || catatanPembina || "Belum ada catatan pembina."}
        </p>
      </div>

      {/* Tanda Tangan Berjenjang */}
      <div className="grid grid-cols-3 text-center text-xs pt-2 gap-4">
        <div>
          <p>Orang Tua / Wali Santri,</p>
          <div className="h-14" />
          <p className="border-t border-black pt-1 font-semibold mx-4">( .............................. )</p>
        </div>

        <div>
          <p>Musyrif Halaqoh,</p>
          <div className="h-14" />
          <p className="border-t border-black pt-1 font-semibold mx-4">
            ( {musyrifHalaqoh} )
          </p>
        </div>

        <div>
          <p>Mengetahui,</p>
          <p className="font-semibold">Mudir STQ Darul Ulum Cendekia</p>
          <div className="h-10" />
          <p className="border-t border-black pt-1 font-bold mx-4">
            ( Ust. Andi Quarzy Ayatullah, S.H, M.H )
          </p>
        </div>
      </div>

      <div className="mt-4 text-[9px] text-gray-500 text-right">
        Dicetak secara otomatis melalui STQ Education Portal pada: {tanggalCetak}
      </div>
    </div>
  );
}
