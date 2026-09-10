"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookCheck,
  CheckCircle2,
  Users,
  Award,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface DashboardMusyrifTahfizhProps {
  santriList: Array<{
    id: string;
    nis: string;
    nama: string;
    kelas: string;
    halaqoh: string;
    namaWali?: string | null;
    noHpWali?: string | null;
    capaianJuz: number;
    targetJuz: number;
    setoranTerakhir: string;
    nilaiTerakhir: string;
    poinPelanggaran: number;
    posisiTerakhirHalaman?: number;
    bintangKebaikan?: number;
  }>;
  selectedSantriNis?: string;
  onSelectSantriNis?: (nis: string) => void;
  inputJenis?: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR";
  onSetInputJenis?: (jenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR") => void;
  jumlahHalaman?: string;
  onSetJumlahHalaman?: (hlm: string) => void;
  juz?: string;
  onSetJuz?: (juz: string) => void;
  halamanMulai?: string;
  onSetHalamanMulai?: (hlm: string) => void;
  halamanSelesai?: string;
  onSetHalamanSelesai?: (hlm: string) => void;
  nilai?: "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF";
  onSetNilai?: (nilai: "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF") => void;
  catatan?: string;
  onSetCatatan?: (catatan: string) => void;
  onSaveSetoran?: () => void;
  onOpenLaporanBulanan?: () => void;
  halaqohName?: string;
  userName?: string;
  isPending?: boolean;
  onNavigate?: (tab: "tahfizh" | "presensi" | "data_santri" | string) => void;
}

export function DashboardMusyrifTahfizh({
  santriList,
  selectedSantriNis,
  onSelectSantriNis,
  halaqohName = "Halaqoh Binaan",
  userName = "Musyrif Tahfizh",
  onOpenLaporanBulanan,
  onNavigate,
}: DashboardMusyrifTahfizhProps) {
  const [showCompletedList, setShowCompletedList] = useState(false);

  // Pisahkan santri berdasarkan status setoran hari ini
  // Santri yang memiliki tanggal setoran hari ini (atau setoranTerakhir valid)
  const todayStr = new Date().toISOString().split("T")[0];
  const santriSudahSetor = santriList.filter((s) => s.setoranTerakhir && s.setoranTerakhir.startsWith(todayStr));
  const santriBelumSetor = santriList.filter((s) => !s.setoranTerakhir || !s.setoranTerakhir.startsWith(todayStr));

  // Metrik Utama
  const totalBinaan = santriList.length;
  const countSudahSetor = santriSudahSetor.length;
  const percentSetor = totalBinaan > 0 ? Math.round((countSudahSetor / totalBinaan) * 100) : 0;
  const countSiapTasmi = santriList.filter((s) => s.capaianJuz > 0 && s.capaianJuz % 1 === 0).length;

  const handleStartSetoran = (nis?: string) => {
    const targetNis = nis || selectedSantriNis;
    if (targetNis && onSelectSantriNis) {
      onSelectSantriNis(targetNis);
    }
    if (onNavigate) {
      onNavigate("tahfizh");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Identity & Singular Primary Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#0E7C3A] text-xs font-bold border border-emerald-200/70">
              <span className="w-2 h-2 rounded-full bg-[#0E7C3A] animate-pulse" />
              Sesi Aktif
            </span>
            <span className="text-xs text-slate-500 font-medium">
              WITA Makassar (UTC+8)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-heading">
            {halaqohName}
            {userName && !userName.startsWith("Memuat") && (
              <span className="text-base font-normal text-slate-500 ml-2">
                ({userName})
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Sesi Halaqoh Subuh &amp; Ashar • Target Kelulusan: 30 Juz Mutqin Bersanad
          </p>
        </div>

        {/* Singular Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={() => handleStartSetoran()}
            leftIcon={<BookCheck className="h-4 w-4" />}
            className="font-bold text-xs sm:text-sm bg-[#0E7C3A] hover:bg-[#0B642E] shadow-xs"
          >
            + Catat Setoran
          </Button>
          {onOpenLaporanBulanan && (
            <Button
              variant="secondary"
              size="md"
              onClick={onOpenLaporanBulanan}
              className="text-xs font-semibold"
            >
              Rekap Bulanan
            </Button>
          )}
        </div>
      </div>

      {/* 2. Top 3 Key Metrics Section (Tenang, Bersih, WCAG AA) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Metric 1: Halaqoh Binaan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Halaqoh Aktif</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A]">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
                {totalBinaan}
              </span>
              <span className="text-xs font-semibold text-slate-500">Santri Binaan</span>
            </div>
            <p className="text-xs text-slate-500">
              Terdaftar aktif di kelompok {halaqohName}
            </p>
          </div>
        </div>

        {/* Metric 2: Setoran Hari Ini */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Setoran Hari Ini</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A]">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
                {countSudahSetor}
                <span className="text-slate-400 text-base font-normal"> / {totalBinaan}</span>
              </span>
              <span className="text-xs font-semibold text-slate-500">Sudah Menyimak</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#0E7C3A] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${percentSetor}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3: Ujian Siap Diuji */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ujian Siap Diuji</span>
            <span className="p-2 rounded-xl bg-amber-50 text-[#B8860B]">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#B8860B] font-heading">
                {countSiapTasmi}
              </span>
              <span className="text-xs font-semibold text-slate-500">Siap Tasmi&apos; / Ikhtibar</span>
            </div>
            <p className="text-xs text-slate-500">
              {countSiapTasmi > 0 ? "Memenuhi syarat tasmi' juz bil-ghoib" : "Belum ada antrean tasmi'"}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Antrean Utama: Santri Belum Setor Hari Ini (Clean Flat List, No Nested Cards) */}
      <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                Santri Belum Setor Hari Ini
              </CardTitle>
              <Badge variant="orange" size="sm">
                {santriBelumSetor.length} Antrean
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Daftar santri binaan yang belum menyetorkan ziyadah atau muroja&apos;ah hari ini
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2 divide-y divide-slate-100">
          {santriBelumSetor.length === 0 ? (
            <div className="py-8 text-center text-slate-500 space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-emerald-50 text-[#0E7C3A] flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Alhamdulillah, semua santri telah menyetorkan hafalan hari ini!
              </p>
              <p className="text-xs text-slate-500">
                Seluruh {totalBinaan} santri binaan halaqoh telah tuntas tercatat.
              </p>
            </div>
          ) : (
            santriBelumSetor.map((santri) => {
              const posHalaman = santri.posisiTerakhirHalaman || 1;
              return (
                <div
                  key={santri.id || santri.nis}
                  className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100/80 text-[#0E7C3A] font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200/80">
                      {santri.nama.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 tracking-tight truncate">
                          {santri.nama}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({santri.nis})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Kelas {santri.kelas} • Posisi: Halaman {posHalaman} (Capaian: {santri.capaianJuz} Juz)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-13 sm:pl-0">
                    <Badge variant="gold" size="sm">
                      {santri.capaianJuz} Juz
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStartSetoran(santri.nis)}
                      className="text-xs font-bold text-[#0E7C3A] border-emerald-200 hover:bg-emerald-50 min-h-[38px]"
                    >
                      Catat Setoran
                      <ArrowRight className="h-3.5 w-3.5 ml-1 text-[#0E7C3A]" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* 4. Seksi Kolaps: Santri Selesai Setor Hari Ini */}
      {santriSudahSetor.length > 0 && (
        <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs">
          <CardHeader
            className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer select-none"
            onClick={() => setShowCompletedList(!showCompletedList)}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0E7C3A]" />
              <CardTitle className="text-base font-bold text-slate-900 font-heading">
                Santri Selesai Setor Hari Ini ({santriSudahSetor.length})
              </CardTitle>
            </div>
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={showCompletedList ? "Tutup daftar selesai" : "Buka daftar selesai"}
            >
              {showCompletedList ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CardHeader>

          {showCompletedList && (
            <CardContent className="pt-2 divide-y divide-slate-100">
              {santriSudahSetor.map((santri) => (
                <div
                  key={santri.id || santri.nis}
                  className="py-2.5 flex items-center justify-between gap-3 px-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-[#0E7C3A] shrink-0" />
                    <div className="min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate block">
                        {santri.nama}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Kelas {santri.kelas} • Capaian {santri.capaianJuz} Juz
                      </span>
                    </div>
                  </div>
                  <Badge variant="green" size="sm">
                    {santri.nilaiTerakhir || "MUMTAZ"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
