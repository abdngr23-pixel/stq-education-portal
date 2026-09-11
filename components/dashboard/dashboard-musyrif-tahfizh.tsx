"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookCheck,
  CheckCircle2,
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Send,
  GraduationCap,
  Sparkles,
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
  izinPendingCount?: number;
  santriSakitCount?: number;
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
  izinPendingCount = 0,
  santriSakitCount = 0,
  onNavigate,
}: DashboardMusyrifTahfizhProps) {
  const [showCompletedList, setShowCompletedList] = useState(false);
  const [showAllSantriModal, setShowAllSantriModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Penentuan status setoran hari ini berbasis data terstruktur dari server (WITA Asia/Makassar)
  const santriSudahSetor = useMemo(() => {
    return santriList.filter((s) => {
      if (typeof s.sudahSetorHariIni === "boolean") {
        return s.sudahSetorHariIni;
      }
      if (s.setoranTerakhirAt) {
        return isTodayWita(s.setoranTerakhirAt);
      }
      return false;
    });
  }, [santriList]);

  const santriBelumSetor = useMemo(() => {
    return santriList.filter(
      (s) => !santriSudahSetor.some((sudah) => sudah.id === s.id || sudah.nis === s.nis)
    );
  }, [santriList, santriSudahSetor]);

  // Statistik Operasional Riil
  const totalBinaan = santriList.length;
  const countSudahSetor = santriSudahSetor.length;
  const countBelumSetor = santriBelumSetor.length;
  const percentSetor = totalBinaan > 0 ? Math.round((countSudahSetor / totalBinaan) * 100) : 0;
  const perluPerhatianCount = (izinPendingCount || 0) + (santriSakitCount || 0);

  // Filter daftar santri belum setor untuk modal pencarian
  const filteredModalSantri = useMemo(() => {
    if (!searchQuery.trim()) return santriBelumSetor;
    const q = searchQuery.toLowerCase();
    return santriBelumSetor.filter(
      (s) => s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
    );
  }, [santriBelumSetor, searchQuery]);

  // Handler navigasi catat setoran (menjaga single navigation pushState)
  const handleStartSetoran = (santriId?: string) => {
    setShowAllSantriModal(false);
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

  // Maksimal 5 santri di dashboard utama
  const displayedBelumSetor = santriBelumSetor.slice(0, 5);

  return (
    <div data-testid="dashboard-musyrif-tahfizh" className="space-y-5 sm:space-y-6 pb-20 sm:pb-8">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER HIJAU STQ (Identitas Visual Pesantren, Tinggi 120-150px)   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0E7C3A] via-[#0B642E] to-[#074D22] text-white p-5 sm:p-6 shadow-xs border border-emerald-800/40">
        {/* Ornamen Aksen Geometris Halus (Densitas Rendah & Elegan) */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-4">
          <svg className="h-32 w-32 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor">
            <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" strokeWidth="2" />
            <polygon points="50,15 80,30 80,70 50,85 20,70 20,30" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="18" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-emerald-50 backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Sesi Aktif
              </span>
              <span className="text-emerald-100/80 text-xs">
                Zona WITA (UTC+8)
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-heading truncate">
              Assalamu’alaikum, {userName && !userName.startsWith("Memuat") ? userName : "Musyrif Tahfizh"}
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5 truncate">
              {halaqohName} • Sesi Pagi Tahfizh Berjalan
            </p>
          </div>

          <div className="shrink-0">
            <Button
              variant="secondary"
              size="md"
              data-testid="btn-catat-setoran-beranda"
              onClick={() => handleStartSetoran()}
              leftIcon={<BookCheck className="h-4 w-4 text-[#0E7C3A]" />}
              className="bg-white hover:bg-emerald-50 text-[#0E7C3A] hover:text-[#0B642E] font-bold text-xs sm:text-sm shadow-sm rounded-xl min-h-[44px] px-4 sm:px-5 border-0 active:scale-[0.98] transition-all"
            >
              + Catat Setoran
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EMPAT KARTU STATISTIK RINGKAS & HIDUP (1 Baris Desktop / 2x2 Mobile)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metrik 1: Santri Binaan */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">
              Santri Binaan
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              {totalBinaan}
            </div>
            <span className="text-[11px] sm:text-xs text-slate-400 block mt-1 truncate">
              Total santri terdaftar
            </span>
          </div>
        </div>

        {/* Metrik 2: Sudah Setor Hari Ini */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">
              Sudah Setor
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-[#0E7C3A] shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              {countSudahSetor}
              <span className="text-slate-400 text-sm font-normal"> / {totalBinaan}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-[#0E7C3A] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${percentSetor}%` }}
              />
            </div>
            <span className="text-[11px] sm:text-xs text-[#0E7C3A] font-semibold block mt-1.5 truncate">
              {percentSetor}% santri halaqoh
            </span>
          </div>
        </div>

        {/* Metrik 3: Antrean Ikhtibar Riil */}
        <div
          data-testid="card-antrean-ikhtibar"
          className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-1.5 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">
              Antrean Ikhtibar
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <BookCheck className="h-4 w-4" />
            </div>
          </div>
          <div>
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
            <span className="text-[11px] sm:text-xs text-amber-700 font-medium block mt-1 truncate">
              {typeof ikhtibarPendingCount === "number"
                ? `${ikhtibarPendingCount} Antrean Ikhtibar`
                : "0 Antrean Ikhtibar"}
            </span>
          </div>
        </div>

        {/* Metrik 4: Perlu Perhatian atau Izin Menunggu */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">
              Perlu Perhatian
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-orange-50 text-orange-600 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
              {perluPerhatianCount}
            </div>
            <span className="text-[11px] sm:text-xs text-slate-500 block mt-1 truncate">
              {perluPerhatianCount > 0
                ? `${izinPendingCount} izin • ${santriSakitCount} sakit`
                : "Kondisi aman & terpantau"}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. KOMPOSISI DESKTOP GRID (8 Kolom Utama : 4 Kolom Akses Cepat & Info)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* --------------------------------------------------------------------- */}
        {/* KOLOM KIRI (8 Kolom): Fokus Kerja & Santri Belum Setor                */}
        {/* --------------------------------------------------------------------- */}
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          {/* Fokus Kerja Hari Ini (Tugas & Antrean Hari Ini) */}
          <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0E7C3A]" />
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                  Tugas & Antrean Hari Ini
                </CardTitle>
              </div>
              <span className="text-xs text-slate-500 font-medium">Prioritas Sesi</span>
            </CardHeader>

            <CardContent className="pt-2 divide-y divide-slate-100">
              {/* Tugas 1: Setoran Sesi Ini */}
              <div className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A] shrink-0">
                    <BookCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      Setoran Hafalan Halaqoh
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                      {countBelumSetor > 0
                        ? `${countBelumSetor} santri belum menyetorkan hafalan sesi ini.`
                        : "Alhamdulillah, seluruh santri binaan telah menyetorkan hafalan."}
                    </p>
                  </div>
                </div>
                {countBelumSetor > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleStartSetoran()}
                    className="min-h-[44px] px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-[#0E7C3A] hover:bg-[#0E7C3A] hover:text-white transition-colors shrink-0"
                  >
                    Catat Sekarang
                  </button>
                ) : (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Tuntas
                  </span>
                )}
              </div>

              {/* Tugas 2: Antrean Ikhtibar */}
              <div className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      Antrean Ujian Ikhtibar Juz
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                      {(ikhtibarPendingCount || 0) > 0
                        ? `${ikhtibarPendingCount} santri siap mengikuti ujian kelulusan juz.`
                        : "Belum ada antrean pengajuan ujian ikhtibar baru."}
                    </p>
                  </div>
                </div>
                {(ikhtibarPendingCount || 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => onNavigate?.("tahfizh")}
                    className="min-h-[44px] px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-colors shrink-0"
                  >
                    Tinjau Ikhtibar
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">0 Antrean</span>
                )}
              </div>

              {/* Tugas 3: Perizinan & Sakit */}
              <div className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      Perizinan & Kondisi Santri
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                      {izinPendingCount > 0
                        ? `${izinPendingCount} perizinan santri menunggu evaluasi.`
                        : santriSakitCount > 0
                        ? `${santriSakitCount} santri tercatat dalam perawatan medis.`
                        : "Semua santri hadir dan dalam kondisi sehat."}
                    </p>
                  </div>
                </div>
                {izinPendingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => onNavigate?.("perizinan")}
                    className="min-h-[44px] px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors shrink-0"
                  >
                    Tinjau Izin
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">Aman</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Santri Belum Setor Hari Ini (Ringkas Maksimal 5 Santri) */}
          <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                  Santri Belum Setor Hari Ini
                </CardTitle>
                <Badge variant="orange" size="sm">
                  {countBelumSetor}
                </Badge>
              </div>

              {santriBelumSetor.length > 5 && (
                <button
                  type="button"
                  data-testid="btn-lihat-semua-santri"
                  onClick={() => setShowAllSantriModal(true)}
                  className="text-xs font-bold text-[#0E7C3A] hover:text-[#0B642E] flex items-center gap-1 min-h-[44px] px-2"
                >
                  Lihat Semua ({countBelumSetor})
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
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
                displayedBelumSetor.map((santri) => {
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
                          className="text-xs font-bold text-[#0E7C3A] border-emerald-200 hover:bg-emerald-50 min-h-[44px] sm:min-h-[38px] gap-1 rounded-xl"
                        >
                          Catat Setoran
                          <ArrowRight className="h-3.5 w-3.5 text-[#0E7C3A]" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Tautan Footer jika jumlah santri > 5 */}
              {countBelumSetor > 5 && (
                <div className="pt-3 pb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Menampilkan 5 dari {countBelumSetor} santri belum setor</span>
                  <button
                    type="button"
                    onClick={() => setShowAllSantriModal(true)}
                    className="font-bold text-[#0E7C3A] hover:underline flex items-center gap-1 min-h-[44px] px-2"
                  >
                    Buka Daftar Lengkap
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seksi Kolaps: Santri Sudah Setor Hari Ini */}
          {countSudahSetor > 0 && (
            <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs overflow-hidden">
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
                  className="text-slate-500 hover:text-slate-800 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
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

        {/* --------------------------------------------------------------------- */}
        {/* KOLOM KANAN (4 Kolom): Akses Cepat & Ringkasan Halaqoh Operasional   */}
        {/* --------------------------------------------------------------------- */}
        <div className="lg:col-span-4 space-y-5 sm:space-y-6">
          {/* Akses Cepat (4 Shortcuts) */}
          <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                Akses Cepat
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => handleStartSetoran()}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-emerald-50/70 hover:border-emerald-200 text-left transition-colors min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-[#0E7C3A] group-hover:bg-[#0E7C3A] group-hover:text-white transition-colors">
                  <BookCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-[#0E7C3A] truncate">
                    Catat Setoran Baru
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Input sabaq, sabaqi, manzil
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0E7C3A] group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("presensi")}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/70 hover:border-blue-200 text-left transition-colors min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-colors">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                    Presensi Halaqoh
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Kehadiran sesi pagi & sore
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("data_santri")}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-purple-50/70 hover:border-purple-200 text-left transition-colors min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition-colors">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700 truncate">
                    Data & Rapor Santri
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Profil, modal, mutaba&apos;ah
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-700 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("perizinan")}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-orange-50/70 hover:border-orange-200 text-left transition-colors min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-orange-100 text-orange-700 group-hover:bg-orange-700 group-hover:text-white transition-colors">
                  <Send className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-orange-700 truncate">
                    Tinjau Perizinan
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Izin pulang, sakit, syar&apos;i
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-orange-700 group-hover:translate-x-0.5 transition-all" />
              </button>
            </CardContent>
          </Card>

          {/* Ringkasan Sesi Operasional */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200/60">
            <div className="flex items-center gap-2 mb-2 text-[#0E7C3A]">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Info Halaqoh
              </span>
            </div>
            <p className="text-xs text-slate-700 font-semibold truncate">
              {halaqohName}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Target Tahfizh: Juz 28–30 Mutqin
            </p>
            <div className="mt-3 pt-2.5 border-t border-emerald-200/50 flex items-center justify-between text-[11px] text-slate-600">
              <span>Sesi Pagi WITA</span>
              <span className="font-semibold text-emerald-800">06.00 – 07.30</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL/DRAWER AKSESIBEL: DAFTAR LENGKAP SANTRI BELUM SETOR              */}
      {/* ========================================================================= */}
      {showAllSantriModal && (
        <div
          data-testid="modal-semua-santri"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-santri-title"
        >
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden border border-slate-200">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <h3 id="modal-santri-title" className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                  Daftar Lengkap Santri Belum Setor ({countBelumSetor})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {halaqohName} • Pilih santri untuk memulai input hafalan
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-close-modal-santri"
                onClick={() => setShowAllSantriModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Kotak Pencarian Ringkas */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NIS santri..."
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A] min-h-[44px]"
                />
              </div>
            </div>

            {/* Isi Daftar Santri */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-4 divide-y divide-slate-100">
              {filteredModalSantri.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-xs sm:text-sm">Tidak ada santri yang sesuai pencarian.</p>
                </div>
              ) : (
                filteredModalSantri.map((santri) => {
                  const posHalaman = santri.posisiTerakhirHalaman || 1;
                  return (
                    <div
                      key={santri.id || santri.nis}
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
                          className="text-xs font-bold text-[#0E7C3A] border-emerald-200 hover:bg-emerald-50 min-h-[44px] sm:min-h-[38px] gap-1 rounded-xl"
                        >
                          Catat Setoran
                          <ArrowRight className="h-3.5 w-3.5 text-[#0E7C3A]" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
              <span>Menampilkan {filteredModalSantri.length} santri</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSantriModal(false)}
                className="text-xs min-h-[44px]"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
