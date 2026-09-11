"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookCheck,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { isTodayWita } from "@/lib/wita-date";
import { AppNavId } from "@/types/navigation";

export interface DashboardMusyrifTahfizhSantriItem {
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
  setoranTerakhirAt?: string | null;
  sudahSetorHariIni?: boolean;
  nilaiTerakhir: string;
  poinPelanggaran: number;
  posisiTerakhirHalaman?: number;
  bintangKebaikan?: number;
}

export interface DashboardMusyrifTahfizhProps {
  santriList: DashboardMusyrifTahfizhSantriItem[];
  selectedSantriId?: string;
  onSelectSantriId?: (santriId: string) => void;
  selectedSantriNis?: string;
  onSelectSantriNis?: (nis: string) => void;
  halaqohName?: string;
  userName?: string;
  ikhtibarPendingCount?: number | null;
  ikhtibarLoading?: boolean;
  ikhtibarError?: string | null;
  onNavigate?: (tab: AppNavId) => void;
}

export function DashboardMusyrifTahfizh({
  santriList,
  selectedSantriId,
  onSelectSantriId,
  onSelectSantriNis,
  halaqohName = "Halaqoh Binaan",
  userName = "Musyrif Tahfizh",
  ikhtibarPendingCount,
  ikhtibarLoading = false,
  ikhtibarError = null,
  onNavigate,
}: DashboardMusyrifTahfizhProps) {
  const [showCompletedList, setShowCompletedList] = useState(false);

  // Penentuan status setoran hari ini berbasis data terstruktur dari server (WITA Asia/Makassar)
  const santriSudahSetor = santriList.filter((s) => {
    if (typeof s.sudahSetorHariIni === "boolean") {
      return s.sudahSetorHariIni;
    }
    if (s.setoranTerakhirAt) {
      return isTodayWita(s.setoranTerakhirAt);
    }
    return false;
  });

  const santriBelumSetor = santriList.filter(
    (s) => !santriSudahSetor.some((sudah) => sudah.id === s.id || sudah.nis === s.nis)
  );

  // Tiga Metrik Utama Riil (tanpa estimasi atau rumus status kesiapan palsu)
  const totalBinaan = santriList.length;
  const countSudahSetor = santriSudahSetor.length;
  const countBelumSetor = santriBelumSetor.length;
  const percentSetor = totalBinaan > 0 ? Math.round((countSudahSetor / totalBinaan) * 100) : 0;

  const handleStartSetoran = (santriId?: string) => {
    const targetId = santriId || selectedSantriId;
    if (targetId && onSelectSantriId) {
      onSelectSantriId(targetId);
      return;
    }
    if (targetId && onSelectSantriNis) {
      onSelectSantriNis(targetId);
      return;
    }
    if (onNavigate) {
      onNavigate("tahfizh");
    }
  };

  return (
    <div data-testid="dashboard-musyrif-tahfizh" className="space-y-6">
      {/* 1. Header Identitas Ringkas & Aksi Primer Tunggal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-heading truncate">
            {halaqohName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {userName && !userName.startsWith("Memuat") ? `${userName} • ` : ""}Zona Operasional WITA (UTC+8)
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          data-testid="btn-catat-setoran-beranda"
          onClick={() => handleStartSetoran()}
          leftIcon={<BookCheck className="h-4 w-4" />}
          className="font-bold text-xs sm:text-sm bg-[#0E7C3A] hover:bg-[#0B642E] shadow-xs shrink-0 self-start sm:self-auto min-h-[44px]"
        >
          + Catat Setoran
        </Button>
      </div>

      {/* 2. Tiga Metrik Operasional Riil (Maksimal 3, tanpa teks berulang) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Metrik 1: Total Santri Binaan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Santri Binaan
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            {totalBinaan}
          </div>
        </div>

        {/* Metrik 2: Sudah Setor Hari Ini */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sudah Setor Hari Ini
            </span>
            <span className="text-xs font-bold text-[#0E7C3A]">{percentSetor}%</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            {countSudahSetor}
            <span className="text-slate-400 text-sm font-normal"> / {totalBinaan}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-[#0E7C3A] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percentSetor}%` }}
            />
          </div>
        </div>

        {/* Metrik 3: Antrean Ikhtibar Riil */}
        <div data-testid="card-antrean-ikhtibar" className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Antrean Ikhtibar
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-heading">
            {ikhtibarLoading ? (
              <span className="text-sm font-normal text-slate-400">Memuat...</span>
            ) : ikhtibarError ? (
              <span className="text-xs font-normal text-rose-500">Gagal</span>
            ) : typeof ikhtibarPendingCount === "number" ? (
              ikhtibarPendingCount
            ) : (
              0
            )}
          </div>
          {ikhtibarLoading && (
            <span className="text-[11px] text-slate-400 block mt-1">
              Menghubungkan ke basis data...
            </span>
          )}
          {ikhtibarError && (
            <span className="text-[11px] text-rose-500 block mt-1">
              {ikhtibarError}
            </span>
          )}
        </div>
      </div>

      {/* 3. Antrean Utama: Santri Belum Setor Hari Ini (Flat List, Fokus Utama) */}
      <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading">
              Santri Belum Setor Hari Ini
            </CardTitle>
            <Badge variant="orange" size="sm">
              {countBelumSetor}
            </Badge>
          </div>
        </CardHeader>

        <CardContent data-testid="santri-belum-setor-list" className="pt-1 divide-y divide-slate-100">
          {countBelumSetor === 0 ? (
            <div className="py-8 text-center text-slate-500 space-y-1">
              <CheckCircle2 className="h-8 w-8 mx-auto text-[#0E7C3A]" />
              <p className="text-sm font-semibold text-slate-800">
                Semua santri telah menyetorkan hafalan hari ini.
              </p>
            </div>
          ) : (
            santriBelumSetor.map((santri) => {
              const posHalaman = santri.posisiTerakhirHalaman || 1;
              return (
                <div
                  key={santri.id || santri.nis}
                  data-testid="santri-belum-setor-item"
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {santri.nama}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        ({santri.nis})
                      </span>
                    </div>
                    {/* Informasi sekunder: tepat satu baris */}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Kelas {santri.kelas} • Capaian: {santri.capaianJuz} Juz (Hlm {posHalaman}) • Terakhir: {santri.setoranTerakhir}
                    </p>
                  </div>

                  <div className="shrink-0 self-start sm:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`btn-catat-setoran-santri-${santri.id || santri.nis}`}
                      onClick={() => handleStartSetoran(santri.id)}
                      className="text-xs font-bold text-[#0E7C3A] border-emerald-200 hover:bg-emerald-50 min-h-[44px] sm:min-h-[38px] gap-1"
                    >
                      Catat Setoran
                      <ArrowRight className="h-3.5 w-3.5 text-[#0E7C3A]" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* 4. Seksi Kolaps: Santri Sudah Setor Hari Ini */}
      {countSudahSetor > 0 && (
        <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs">
          <CardHeader
            className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer select-none"
            onClick={() => setShowCompletedList(!showCompletedList)}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0E7C3A]" />
              <CardTitle className="text-sm font-bold text-slate-900 font-heading">
                Santri Sudah Setor Hari Ini ({countSudahSetor})
              </CardTitle>
            </div>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-800 p-1"
              aria-label={showCompletedList ? "Ciutkan daftar sudah setor" : "Buka daftar sudah setor"}
            >
              {showCompletedList ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CardHeader>

          {showCompletedList && (
            <CardContent data-testid="santri-sudah-setor-list" className="pt-1 divide-y divide-slate-100">
              {santriSudahSetor.map((santri) => (
                <div
                  key={santri.id || santri.nis}
                  data-testid="santri-sudah-setor-item"
                  className="py-2.5 flex items-center justify-between gap-3 px-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 truncate">
                        {santri.nama}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ({santri.nis})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Kelas {santri.kelas} • Terakhir: {santri.setoranTerakhir}
                    </p>
                  </div>
                  <Badge variant="green" size="sm">
                    {santri.nilaiTerakhir || "Selesai"}
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
