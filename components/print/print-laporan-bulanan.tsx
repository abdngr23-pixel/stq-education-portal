"use client";

import React from "react";
import { KopSurat } from "./kop-surat";
import { cn } from "@/lib/utils";

export interface PrintLaporanBulananProps {
  laporanData: {
    halaqoh: {
      id: string;
      nama: string;
      pembina: string;
      tahunAjaran: string;
    };
    periode: {
      bulan: number;
      tahunAjaran: string;
      tahunKalender: number;
    };
    rekapSantri: Array<{
      santri: {
        id: string;
        nis: string;
        nama: string;
        kelas: string;
      };
      tahfizh: {
        sabaq: {
          targetBulanan: number;
          pekan: { p1: number; p2: number; p3: number; p4: number };
          totalHalaman: number;
          konversi: { juz: number; sisaHalaman: number; label: string };
          persentase: number;
          isTercapai: boolean;
        };
        sabqi: {
          targetBulanan: number;
          totalFrekuensi: number;
          persentase: number;
          isPatuh: boolean;
        };
        manzil: {
          targetBulanan: number;
          totalFrekuensi: number;
          persentase: number;
          isPatuh: boolean;
        };
        mufar: {
          targetBulanan: number;
          totalFrekuensi: number;
        };
      };
      nonTahfizh: Array<{
        kategori: string;
        label: string;
        hbl: number;
        penambahanBulanIni: number;
        totalKumulatif: number;
        targetMin: number;
        isTuntas: boolean;
      }>;
      tasmiSimaan: {
        countTasmi: number;
        countSimaan: number;
        rataRataNilai: number;
        ringkasanTeks: string;
      };
    }>;
  };
  tanggalCetak?: string;
  className?: string;
}

const BULAN_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function PrintLaporanBulanan({
  laporanData,
  tanggalCetak = "08 September 2026",
  className,
}: PrintLaporanBulananProps) {
  const { halaqoh, periode, rekapSantri } = laporanData;
  const namaBulan = BULAN_NAMES[periode.bulan - 1] || "Bulan Berjalan";

  return (
    <div
      className={cn(
        "bg-white text-black p-6 max-w-[297mm] mx-auto text-[11px] font-serif leading-tight print:p-0 print:max-w-none print:w-full",
        className
      )}
    >
      {/* Kop Surat Darul Ulum Cendekia */}
      <KopSurat />

      {/* Judul & Metadata Laporan */}
      <div className="text-center my-3 border-b-2 border-slate-900 pb-2">
        <h2 className="text-base font-bold uppercase tracking-wider font-sans">
          REKAPITULASI LAPORAN HAFALAN &amp; MUTABA&apos;AH SANTRI
        </h2>
        <p className="text-xs font-sans text-slate-700">
          Pesantren Tahfizh Qur&apos;an Darul Ulum Cendekia (DUC)
        </p>
      </div>

      <div className="flex justify-between items-center mb-3 font-sans text-xs">
        <div>
          <p>
            <span className="font-semibold inline-block w-24">Halaqoh</span>: {halaqoh.nama}
          </p>
          <p>
            <span className="font-semibold inline-block w-24">Musyrif Pembina</span>: {halaqoh.pembina}
          </p>
        </div>
        <div className="text-right">
          <p>
            <span className="font-semibold inline-block w-24">Periode</span>: {namaBulan} {periode.tahunKalender}
          </p>
          <p>
            <span className="font-semibold inline-block w-24">Tahun Ajaran</span>: {periode.tahunAjaran}
          </p>
        </div>
      </div>

      {/* Tabel Matriks Laporan Komprehensif */}
      <div className="overflow-x-auto my-3">
        <table className="w-full border-collapse border border-slate-800 text-[10px] font-sans">
          <thead>
            <tr className="bg-slate-200 text-center font-bold">
              <th rowSpan={2} className="border border-slate-700 px-1 py-1 w-7">No</th>
              <th rowSpan={2} className="border border-slate-700 px-2 py-1 text-left min-w-[130px]">Nama Santri</th>
              <th colSpan={7} className="border border-slate-700 px-1 py-1 bg-emerald-100">
                SABAQ (Hafalan Baru - 20 Hlm/Juz)
              </th>
              <th colSpan={2} className="border border-slate-700 px-1 py-1 bg-sky-100">SABQI</th>
              <th colSpan={2} className="border border-slate-700 px-1 py-1 bg-amber-100">MANZIL</th>
              <th colSpan={3} className="border border-slate-700 px-1 py-1 bg-purple-100">MUTABA&apos;AH (Hadits/Arab/Inggris)</th>
              <th rowSpan={2} className="border border-slate-700 px-2 py-1 text-left min-w-[160px]">
                Ringkasan Ujian (Tasmi&apos; / Sima&apos;an)
              </th>
            </tr>
            <tr className="bg-slate-100 text-[9px] text-center font-semibold">
              {/* Sabaq */}
              <th className="border border-slate-700 px-1 py-0.5">Tgt</th>
              <th className="border border-slate-700 px-1 py-0.5">P1</th>
              <th className="border border-slate-700 px-1 py-0.5">P2</th>
              <th className="border border-slate-700 px-1 py-0.5">P3</th>
              <th className="border border-slate-700 px-1 py-0.5">P4</th>
              <th className="border border-slate-700 px-1 py-0.5 font-bold">Halaman</th>
              <th className="border border-slate-700 px-1 py-0.5 font-bold text-emerald-900">Konversi</th>

              {/* Sabqi */}
              <th className="border border-slate-700 px-1 py-0.5">Freq</th>
              <th className="border border-slate-700 px-1 py-0.5">%</th>

              {/* Manzil */}
              <th className="border border-slate-700 px-1 py-0.5">Freq</th>
              <th className="border border-slate-700 px-1 py-0.5">%</th>

              {/* Mutaba'ah */}
              <th className="border border-slate-700 px-1 py-0.5">Hadits</th>
              <th className="border border-slate-700 px-1 py-0.5">Arab</th>
              <th className="border border-slate-700 px-1 py-0.5">Inggris</th>
            </tr>
          </thead>
          <tbody>
            {rekapSantri.map((r, idx) => {
              const getK = (cat: string) => r.nonTahfizh.find((n) => n.kategori === cat);
              const hadits = getK("HAFALAN_HADITS");
              const mufrodat = getK("HAFALAN_MUFRODAT");
              const vocab = getK("HAFALAN_VOCABULARY");

              return (
                <tr key={r.santri.id} className="text-center">
                  <td className="border border-slate-700 px-1 py-1">{idx + 1}</td>
                  <td className="border border-slate-700 px-2 py-1 text-left font-bold">
                    {r.santri.nama}
                    <div className="text-[9px] font-normal text-slate-600">{r.santri.nis} • Kelas {r.santri.kelas}</div>
                  </td>

                  {/* Sabaq */}
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.sabaq.targetBulanan}</td>
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.sabaq.pekan.p1}</td>
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.sabaq.pekan.p2}</td>
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.sabaq.pekan.p3}</td>
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.sabaq.pekan.p4}</td>
                  <td className="border border-slate-700 px-1 py-1 font-bold">{r.tahfizh.sabaq.totalHalaman}</td>
                  <td className="border border-slate-700 px-1 py-1 font-bold text-emerald-900 bg-emerald-50/40">
                    {r.tahfizh.sabaq.konversi.label}
                  </td>

                  {/* Sabqi */}
                  <td className="border border-slate-700 px-1 py-1 font-semibold">{r.tahfizh.sabqi.totalFrekuensi}x</td>
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.sabqi.persentase}%</td>

                  {/* Manzil */}
                  <td className="border border-slate-700 px-1 py-1 font-semibold">{r.tahfizh.manzil.totalFrekuensi}x</td>
                  <td className="border border-slate-700 px-1 py-1">{r.tahfizh.manzil.persentase}%</td>

                  {/* Mutaba'ah */}
                  <td className="border border-slate-700 px-1 py-1">
                    +{hadits?.penambahanBulanIni || 0} (Tot: {hadits?.totalKumulatif || 0})
                  </td>
                  <td className="border border-slate-700 px-1 py-1">
                    +{mufrodat?.penambahanBulanIni || 0} (Tot: {mufrodat?.totalKumulatif || 0})
                  </td>
                  <td className="border border-slate-700 px-1 py-1">
                    +{vocab?.penambahanBulanIni || 0} (Tot: {vocab?.totalKumulatif || 0})
                  </td>

                  {/* Ringkasan Ujian */}
                  <td className="border border-slate-700 px-2 py-1 text-left text-[9px] italic">
                    {r.tasmiSimaan.ringkasanTeks}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lembar Pengesahan Resmi Bertingkat */}
      <div className="grid grid-cols-2 gap-8 mt-6 pt-4 font-sans text-xs">
        <div className="text-center">
          <p>Mengetahui / Memeriksa,</p>
          <p className="font-bold">Musyrif Pembina Halaqoh</p>
          <div className="h-16 flex items-center justify-center">
            {/* Ruang Tanda Tangan */}
          </div>
          <p className="font-bold underline">{halaqoh.pembina}</p>
          <p className="text-[10px] text-slate-500">NIP / ID Staf: STQ-MT-003</p>
        </div>

        <div className="text-center">
          <p>Depok, {tanggalCetak}</p>
          <p className="font-bold">Mudir / Kepala Sekolah</p>
          <div className="h-16 flex items-center justify-center">
            {/* Ruang Tanda Tangan & Cap Lembaga */}
          </div>
          <p className="font-bold underline">Ust. H. Ahmad Fauzi, Lc., M.Pd.</p>
          <p className="text-[10px] text-slate-500">NIP: STQ-KS-001</p>
        </div>
      </div>
    </div>
  );
}
