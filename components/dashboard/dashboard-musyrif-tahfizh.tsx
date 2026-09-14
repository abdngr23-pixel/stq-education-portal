"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Sparkles,
  Layers,
} from "lucide-react";
import { isTodayWita } from "@/lib/wita-date";
import { AppNavId } from "@/types/navigation";
import { TahfizhDailyStatus } from "@/lib/tahfizh-status";
import {
  WeeklySabaqProgress,
  getCompletedJuzCount,
  getDailyMufarTargetJuz,
  HalaqohWorkloadSummary,
} from "@/lib/tahfizh-mufar-tier";

export interface DashboardMusyrifTahfizhSantriItem {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  halaqoh: string;
  halaqohId?: string | null;
  pembina?: string;
  capaianJuz: number;
  targetJuz: number | null;
  setoranTerakhir: string;
  setoranTerakhirAt?: string | null;
  sudahSetorHariIni?: boolean;
  nilaiTerakhir: string;
  poinPelanggaran: number;
  posisiTerakhirHalaman?: number;
  isHalamanTerakhirParsial?: boolean;
  bintangKebaikan?: number;
  targetSabaq?: number | null;
  targetSabaqLabel?: string;
  targetSabaqBulanan?: number | null;
  targetSabaqPekanan?: number | null;
  completedJuzCanonical?: number;
  targetDailyMufarJuz?: number;
  actualDailyMufarJuz?: number;
  weeklySabaqProgress?: WeeklySabaqProgress;
  statusTahfizhHariIni?: TahfizhDailyStatus;
  mufarProgressLabel?: string;
  needsAttention?: boolean;
  attentionReasons?: string[];
}

export type TahfizhDashboardFilter =
  | "ALL"
  | "PERLU_TINDAKAN"
  | "BELUM_SETOR"
  | "SABAQ_BELUM_TERCAPAI"
  | "SABAQ_TERTINGGAL"
  | "MUFAR_BELUM_TERPENUHI"
  | "TARGET_BELUM_DITETAPKAN";

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
  isKabidOrManagerial?: boolean;
  halaqohWorkloads?: HalaqohWorkloadSummary[] | null;
}

export function DashboardMusyrifTahfizh({
  santriList,
  selectedSantriId,
  onSelectSantriId,
  selectedSantriNis,
  onSelectSantriNis,
  halaqohName = "Halaqoh Binaan",
  userName = "Musyrif Tahfizh",
  ikhtibarPendingCount,
  ikhtibarLoading = false,
  ikhtibarError = null,
  izinPendingCount = 0,
  santriSakitCount = 0,
  onNavigate,
  isKabidOrManagerial = false,
  halaqohWorkloads = null,
}: DashboardMusyrifTahfizhProps) {
  const [showCompletedList, setShowCompletedList] = useState(false);
  const [showAllSantriModal, setShowAllSantriModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<TahfizhDashboardFilter>("ALL");

  // Refs untuk aksesibilitas modal (focus management, focus trap, and restore)
  const modalContentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  // Resolusi data operasional santri (murni presentasi dari authoritative server payload)
  const resolvedSantriList = useMemo(() => {
    return santriList.map((s) => {
      const posHalaman = s.posisiTerakhirHalaman || 1;
      const completedJuz =
        s.completedJuzCanonical !== undefined
          ? s.completedJuzCanonical
          : getCompletedJuzCount(posHalaman, s.isHalamanTerakhirParsial);

      const targetDailyMufar =
        s.targetDailyMufarJuz !== undefined
          ? s.targetDailyMufarJuz
          : getDailyMufarTargetJuz(completedJuz);

      const isSudahSetor =
        typeof s.sudahSetorHariIni === "boolean"
          ? s.sudahSetorHariIni
          : s.setoranTerakhirAt
          ? isTodayWita(s.setoranTerakhirAt)
          : false;

      // Status harian 4 komponen: murni dari server payload, dilarang fabrikasi status di client
      const status: TahfizhDailyStatus | undefined = s.statusTahfizhHariIni;

      // Weekly progress: murni dari server payload, dilarang fabrikasi actual=0 di client
      const weeklyProgress = s.weeklySabaqProgress;

      const needsAttention = Boolean(s.needsAttention);
      const reasons: string[] = s.attentionReasons ? [...s.attentionReasons] : [];

      return {
        ...s,
        sudahSetorHariIni: isSudahSetor,
        completedJuzCanonical: completedJuz,
        targetDailyMufarJuz: targetDailyMufar,
        weeklySabaqProgress: weeklyProgress,
        statusTahfizhHariIni: status,
        needsAttention,
        attentionReasons: reasons,
        mufarProgressLabel: s.mufarProgressLabel,
      };
    });
  }, [santriList]);

  // Santri yang sudah setor hari ini
  const santriSudahSetor = useMemo(() => {
    return resolvedSantriList.filter((s) => s.sudahSetorHariIni);
  }, [resolvedSantriList]);

  // Santri yang belum setor hari ini
  const santriBelumSetor = useMemo(() => {
    return resolvedSantriList.filter((s) => !s.sudahSetorHariIni);
  }, [resolvedSantriList]);

  // Statistik Operasional Riil (Predikat 100% konsisten antara count badge dan daftar item)
  const totalBinaan = resolvedSantriList.length;
  const countSudahSetor = santriSudahSetor.length;
  const countBelumSetor = santriBelumSetor.length;
  const countPerluTindakan = useMemo(() => {
    return resolvedSantriList.filter((s) => s.needsAttention).length;
  }, [resolvedSantriList]);

  const countSabaqBelumTercapai = useMemo(() => {
    return resolvedSantriList.filter(
      (s) => s.weeklySabaqProgress?.status === "BELUM_TERCAPAI"
    ).length;
  }, [resolvedSantriList]);

  const countMufarBelumTerpenuhi = useMemo(() => {
    return resolvedSantriList.filter(
      (s) => s.statusTahfizhHariIni?.mufar === "BELUM_SELESAI"
    ).length;
  }, [resolvedSantriList]);

  const countTargetBelumDitetapkan = useMemo(() => {
    return resolvedSantriList.filter(
      (s) => s.weeklySabaqProgress?.status === "TARGET_BELUM_DITETAPKAN"
    ).length;
  }, [resolvedSantriList]);

  const percentSetor =
    totalBinaan > 0 ? Math.round((countSudahSetor / totalBinaan) * 100) : 0;

  // Filter tabs definition (Identical predicate with activeFilteredList)
  const filterTabs = [
    { id: "ALL" as const, label: "Semua Santri", count: totalBinaan },
    {
      id: "PERLU_TINDAKAN" as const,
      label: "Perlu Tindakan",
      count: countPerluTindakan,
      highlight: countPerluTindakan > 0,
    },
    { id: "BELUM_SETOR" as const, label: "Belum Setor", count: countBelumSetor },
    {
      id: "SABAQ_BELUM_TERCAPAI" as const,
      label: "Target Sabaq Belum Tercapai",
      count: countSabaqBelumTercapai,
    },
    {
      id: "MUFAR_BELUM_TERPENUHI" as const,
      label: "Mufar Belum Tuntas",
      count: countMufarBelumTerpenuhi,
    },
    {
      id: "TARGET_BELUM_DITETAPKAN" as const,
      label: "Target Belum Ada",
      count: countTargetBelumDitetapkan,
    },
  ];

  // Filter daftar santri untuk Action Center (Predikat identik dengan filterTabs)
  const activeFilteredList = useMemo(() => {
    switch (selectedFilter) {
      case "PERLU_TINDAKAN":
        return resolvedSantriList.filter((s) => s.needsAttention);
      case "BELUM_SETOR":
        return santriBelumSetor;
      case "SABAQ_BELUM_TERCAPAI":
      case "SABAQ_TERTINGGAL":
        return resolvedSantriList.filter(
          (s) => s.weeklySabaqProgress?.status === "BELUM_TERCAPAI"
        );
      case "MUFAR_BELUM_TERPENUHI":
        return resolvedSantriList.filter(
          (s) => s.statusTahfizhHariIni?.mufar === "BELUM_SELESAI"
        );
      case "TARGET_BELUM_DITETAPKAN":
        return resolvedSantriList.filter(
          (s) => s.weeklySabaqProgress?.status === "TARGET_BELUM_DITETAPKAN"
        );
      case "ALL":
      default:
        return resolvedSantriList;
    }
  }, [selectedFilter, resolvedSantriList, santriBelumSetor]);

  // Filter daftar santri untuk modal pencarian (berdasarkan filter aktif agar konsisten)
  const filteredModalSantri = useMemo(() => {
    const baseList = activeFilteredList;
    if (!searchQuery.trim()) return baseList;
    const q = searchQuery.toLowerCase();
    return baseList.filter(
      (s) => s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
    );
  }, [activeFilteredList, searchQuery]);

  // Modal handlers
  const handleOpenModal = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e?.currentTarget) {
      triggerButtonRef.current = e.currentTarget;
    }
    setShowAllSantriModal(true);
  };

  const handleCloseModal = () => {
    setShowAllSantriModal(false);
    setSearchQuery("");
    // Kembalikan fokus ke trigger button setelah modal ditutup
    triggerButtonRef.current?.focus();
    const btn =
      triggerButtonRef.current ||
      (typeof document !== "undefined"
        ? document.querySelector<HTMLButtonElement>(
            '[data-testid="btn-lihat-semua-santri"]'
          )
        : null);
    btn?.focus();
    setTimeout(() => {
      triggerButtonRef.current?.focus();
      const b =
        triggerButtonRef.current ||
        (typeof document !== "undefined"
          ? document.querySelector<HTMLButtonElement>(
              '[data-testid="btn-lihat-semua-santri"]'
            )
          : null);
      b?.focus();
    }, 0);
  };

  // Aksesibilitas: Escape key, Focus trap, & Body scroll lock selama modal aktif
  useEffect(() => {
    if (!showAllSantriModal) return;

    // 1. Body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 2. Fokus awal ke input pencarian
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);

    // 3. Escape key & Focus Trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseModal();
        return;
      }

      if (e.key === "Tab" && modalContentRef.current) {
        const focusableElements = modalContentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(focusTimer);
      const b =
        triggerButtonRef.current ||
        (typeof document !== "undefined"
          ? document.querySelector<HTMLButtonElement>(
              '[data-testid="btn-lihat-semua-santri"]'
            )
          : null);
      b?.focus();
    };
  }, [showAllSantriModal]);

  // Handler navigasi catat setoran (menjaga single navigation & fallback aman ID -> NIS)
  const handleStartSetoran = (santriId?: string) => {
    handleCloseModal();
    const targetId = santriId || selectedSantriId;

    if (targetId) {
      if (onSelectSantriId) {
        onSelectSantriId(targetId);
        return;
      }
      if (onSelectSantriNis) {
        // Cari record santri berdasarkan ID untuk mendapatkan santri.nis yang valid
        const matched = santriList.find(
          (s) => s.id === targetId || s.nis === targetId
        );
        const targetNis = matched
          ? matched.nis
          : santriId
          ? undefined
          : selectedSantriNis;
        if (targetNis) {
          onSelectSantriNis(targetNis);
          return;
        }
      }
    } else if (selectedSantriNis && onSelectSantriNis) {
      onSelectSantriNis(selectedSantriNis);
      return;
    }

    if (onNavigate) {
      onNavigate("tahfizh");
    }
  };

  // Tampilan ringkas maksimal 5 santri di dashboard utama
  const displayedBelumSetor = activeFilteredList.slice(0, 5);

  return (
    <div
      data-testid="dashboard-musyrif-tahfizh"
      className="space-y-5 sm:space-y-6 pb-20 sm:pb-8"
    >
      {/* ========================================================================= */}
      {/* 1. HERO BANNER HIJAU STQ (Identitas Visual Pesantren, Tinggi 120-150px)   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0E7C3A] via-[#0B642E] to-[#074D22] text-white p-5 sm:p-6 shadow-xs border border-emerald-800/40">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-4">
          <svg
            className="h-32 w-32 text-white"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
          >
            <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" strokeWidth="2" />
            <polygon
              points="50,15 80,30 80,70 50,85 20,70 20,30"
              strokeWidth="1.5"
            />
            <circle cx="50" cy="50" r="18" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-emerald-50 backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                Halaqoh Tahfizh
              </span>
              <span className="text-emerald-100/80 text-xs">Zona WITA (UTC+8)</span>
            </div>

            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-heading truncate">
              Assalamu’alaikum,{" "}
              {userName && !userName.startsWith("Memuat")
                ? userName
                : "Musyrif Tahfizh"}
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5 truncate">
              {halaqohName}
            </p>
          </div>

          <div className="shrink-0">
            <Button
              variant="secondary"
              size="md"
              data-testid="btn-catat-setoran-beranda"
              onClick={() => handleStartSetoran()}
              leftIcon={<BookCheck className="h-4 w-4 text-[#0E7C3A]" />}
              className="bg-white hover:bg-emerald-50 text-[#0E7C3A] hover:text-[#0B642E] font-bold text-xs sm:text-sm shadow-sm rounded-xl min-h-[44px] px-4 sm:px-5 border-0 active:scale-[0.98] transition-all motion-reduce:transition-none"
            >
              + Catat Setoran
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PANEL STATISTIK OPERASIONAL TERPADU (Single subtle container)           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 sm:divide-x divide-slate-100">
          {/* Metrik 1: Santri Binaan */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
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
              <span className="text-[11px] sm:text-xs text-slate-500 block mt-1 truncate">
                Total santri terdaftar
              </span>
            </div>
          </div>

          {/* Metrik 2: Sudah Setor Hari Ini */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
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
                <span className="text-slate-500 text-sm font-normal">
                  {" "}
                  / {totalBinaan}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-[#0E7C3A] h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none"
                  style={{ width: `${percentSetor}%` }}
                />
              </div>
              <span className="text-[11px] sm:text-xs text-[#0E7C3A] font-semibold block mt-1.5 truncate">
                {percentSetor}% santri halaqoh
              </span>
            </div>
          </div>

          {/* Metrik 3: Perlu Tindakan */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1.5 mb-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">
                Perlu Tindakan
              </span>
              <div
                className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${
                  countPerluTindakan > 0
                    ? "bg-rose-50 text-rose-600"
                    : "bg-slate-50 text-slate-500"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold font-heading ${
                  countPerluTindakan > 0 ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {countPerluTindakan}
              </div>
              <span className="text-[11px] sm:text-xs text-slate-500 block mt-1 truncate">
                {countPerluTindakan > 0
                  ? `${countPerluTindakan} santri butuh perhatian`
                  : "Semua target aman"}
              </span>
            </div>
          </div>

          {/* Metrik 4: Antrean Ikhtibar Riil */}
          <div
            data-testid="card-antrean-ikhtibar"
            className="p-4 sm:p-5 flex flex-col justify-between"
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
                  <span className="text-sm font-normal text-slate-500">Memuat...</span>
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
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                Izin & Kesehatan: {izinPendingCount} izin • {santriSakitCount} sakit
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. KABID TAHFIZH / MUDIR: NEEDS-ATTENTION OVERVIEW (ZERO RANKING)          */}
      {/* ========================================================================= */}
      {isKabidOrManagerial && halaqohWorkloads && halaqohWorkloads.length > 0 && (
        <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#0E7C3A]" />
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                Ringkasan Operasional Antar-Halaqoh
              </CardTitle>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Pemantauan Beban Kerja & Perhatian
            </span>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Halaqoh & Pembina</th>
                  <th className="py-3 px-3 text-center">Santri</th>
                  <th className="py-3 px-3 text-center">Perlu Tindakan</th>
                  <th className="py-3 px-3 text-center">Belum Setor</th>
                  <th className="py-3 px-3 text-center">Sabaq Belum Tercapai</th>
                  <th className="py-3 px-3 text-center">Mufar Belum Tuntas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {halaqohWorkloads.map((hlq) => (
                  <tr key={hlq.halaqohId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{hlq.halaqohNama}</div>
                      <div className="text-[11px] text-slate-400">{hlq.pembinaNama}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {hlq.totalSantri}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          hlq.perluTindakanCount > 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {hlq.perluTindakanCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-amber-700">
                      {hlq.belumSetorCount}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {hlq.sabaqBelumTercapaiCount}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {hlq.mufarBelumTerpenuhiCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. ACTION CENTER & FOKUS KERJA (8 Kolom Utama : 4 Kolom Info)             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* KOLOM KIRI (8 Kolom): Action Center & Filter Tabs */}
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          {/* Action Center Operasional Tahfizh */}
          <Card rounded="2xl" className="border border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                    {selectedFilter === "ALL"
                      ? "Semua Santri Binaan"
                      : selectedFilter === "BELUM_SETOR"
                      ? "Santri Belum Setor Hari Ini"
                      : selectedFilter === "PERLU_TINDAKAN"
                      ? "Santri Perlu Tindakan"
                      : selectedFilter === "SABAQ_BELUM_TERCAPAI" || selectedFilter === "SABAQ_TERTINGGAL"
                      ? "Target Sabaq Belum Tercapai"
                      : selectedFilter === "MUFAR_BELUM_TERPENUHI"
                      ? "Mufar Belum Tuntas"
                      : "Target Belum Ditetapkan"}
                  </CardTitle>
                  <Badge variant="orange" size="sm">
                    {activeFilteredList.length}
                  </Badge>
                </div>

                {activeFilteredList.length > 5 && (
                  <button
                    type="button"
                    ref={triggerButtonRef}
                    data-testid="btn-lihat-semua-santri"
                    onClick={(e) => handleOpenModal(e)}
                    className="text-xs font-bold text-[#0E7C3A] hover:text-[#0B642E] flex items-center gap-1 min-h-[44px] px-2"
                  >
                    Lihat Semua ({activeFilteredList.length})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Operational Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
                {filterTabs.map((tab) => {
                  const isActive = selectedFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl transition-all shrink-0 flex items-center gap-1.5 min-h-[36px] ${
                        isActive
                          ? "bg-[#0E7C3A] text-white shadow-xs"
                          : tab.highlight
                          ? "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          isActive
                            ? "bg-white/20 text-white font-bold"
                            : tab.highlight
                            ? "bg-amber-200 text-amber-900 font-bold"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent
              data-testid="santri-belum-setor-list"
              className="pt-1 divide-y divide-slate-100"
            >
              {displayedBelumSetor.length === 0 ? (
                <div className="py-8 text-center text-slate-500 space-y-1">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-[#0E7C3A]" />
                  <p className="text-sm font-semibold text-slate-800">
                    Tidak ada santri pada filter ini.
                  </p>
                </div>
              ) : (
                displayedBelumSetor.map((santri) => {
                  const posHalaman = santri.posisiTerakhirHalaman || 1;
                  const statusToday = santri.statusTahfizhHariIni;
                  const weekly = santri.weeklySabaqProgress;

                  return (
                    <div
                      key={santri.id || santri.nis}
                      data-testid="santri-belum-setor-item"
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors motion-reduce:transition-none"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {santri.nama}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            ({santri.nis})
                          </span>
                          <span className="text-xs text-slate-400">• Kelas {santri.kelas}</span>
                        </div>

                        {/* Status 4 Komponen Tahfizh */}
                        {statusToday ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* SABAQ */}
                            <span
                              aria-label={`Status Sabaq: ${statusToday.sabaq}`}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                statusToday.sabaq === "SELESAI"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : statusToday.sabaq === "BELUM_SELESAI"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              Sabaq: {statusToday.sabaq === "SELESAI" ? "Selesai" : statusToday.sabaq === "BELUM_SELESAI" ? "Belum" : "Libur/Khatam"}
                            </span>

                            {/* SABQI */}
                            <span
                              aria-label={`Status Sabqi: ${statusToday.sabqi}`}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                statusToday.sabqi === "SELESAI"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : statusToday.sabqi === "BELUM_SELESAI"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              Sabqi: {statusToday.sabqi === "SELESAI" ? "Selesai" : statusToday.sabqi === "BELUM_SELESAI" ? "Belum" : "T/A"}
                            </span>

                            {/* MANZIL */}
                            <span
                              aria-label={`Status Manzil: ${statusToday.manzil}`}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                statusToday.manzil === "SELESAI"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : statusToday.manzil === "BELUM_SELESAI"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              Manzil: {statusToday.manzil === "SELESAI" ? "Selesai" : statusToday.manzil === "BELUM_SELESAI" ? "Belum" : "T/A"}
                            </span>

                            {/* MUFAR */}
                            <span
                              aria-label={`Status Mufar: ${santri.mufarProgressLabel || statusToday.mufar}`}
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                statusToday.mufar === "SELESAI"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : statusToday.mufar === "BELUM_SELESAI"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              Mufar: {santri.mufarProgressLabel || (statusToday.mufar === "SELESAI" ? "Selesai" : statusToday.mufar === "BELUM_SELESAI" ? "Belum" : "T/A")}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 italic">
                            <span>Status harian tidak tersedia</span>
                          </div>
                        )}

                        {/* Progres Target Sabaq Pekanan */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>
                            Capaian: {santri.capaianJuz} Juz (Hlm {posHalaman})
                          </span>
                          <span>•</span>
                          {weekly ? (
                            weekly.status === "TARGET_BELUM_DITETAPKAN" ? (
                              <span className="text-amber-600 font-semibold">
                                Target pekanan belum ditetapkan
                              </span>
                            ) : weekly.status === "TERCAPAI" ? (
                              <span className="text-emerald-700 font-semibold">
                                Pekan Ini: {weekly.actual}/{weekly.target} Halaman (Tercapai)
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                Pekan Ini: {weekly.actual}/{weekly.target} Halaman (Target pekanan belum tercapai)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">Target pekanan: data belum tersedia</span>
                          )}
                        </div>

                        {/* Attention Reasons */}
                        {santri.attentionReasons && santri.attentionReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {santri.attentionReasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                              >
                                <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 self-start sm:self-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          data-testid={`btn-catat-setoran-santri-${santri.id || santri.nis}`}
                          onClick={() => handleStartSetoran(santri.id)}
                          aria-label={`Catat setoran untuk ${santri.nama}`}
                          className="text-xs font-bold text-[#0E7C3A] border-emerald-200 hover:bg-emerald-50 min-h-[44px] sm:min-h-[38px] gap-1 rounded-xl transition-all motion-reduce:transition-none"
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
              {activeFilteredList.length > 5 && (
                <div className="pt-3 pb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Menampilkan 5 dari {activeFilteredList.length} santri pada filter ini
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleOpenModal(e)}
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
                  aria-label={
                    showCompletedList
                      ? "Ciutkan daftar sudah setor"
                      : "Buka daftar sudah setor"
                  }
                >
                  {showCompletedList ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </CardHeader>

              {showCompletedList && (
                <CardContent
                  data-testid="santri-sudah-setor-list"
                  className="pt-1 divide-y divide-slate-100"
                >
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

        {/* KOLOM KANAN (4 Kolom): Akses Cepat & Info Halaqoh Faktual */}
        <div className="lg:col-span-4 space-y-5 sm:space-y-6">
          {/* Akses Cepat */}
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
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-emerald-50/70 hover:border-emerald-200 text-left transition-colors motion-reduce:transition-none min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-[#0E7C3A] group-hover:bg-[#0E7C3A] group-hover:text-white transition-colors motion-reduce:transition-none">
                  <BookCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-[#0E7C3A] truncate">
                    Catat Setoran Baru
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Input sabaq, sabaqi, manzil, mufar
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0E7C3A] group-hover:translate-x-0.5 transition-all motion-reduce:transition-none" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("presensi")}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/70 hover:border-blue-200 text-left transition-colors motion-reduce:transition-none min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-colors motion-reduce:transition-none">
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
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all motion-reduce:transition-none" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("data_santri")}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-purple-50/70 hover:border-purple-200 text-left transition-colors motion-reduce:transition-none min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition-colors motion-reduce:transition-none">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700 truncate">
                    Data Santri
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Profil & mutaba&apos;ah santri
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-700 group-hover:translate-x-0.5 transition-all motion-reduce:transition-none" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("perizinan")}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-orange-50/70 hover:border-orange-200 text-left transition-colors motion-reduce:transition-none min-h-[44px] group"
              >
                <div className="p-2 rounded-lg bg-orange-100 text-orange-700 group-hover:bg-orange-700 group-hover:text-white transition-colors motion-reduce:transition-none">
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
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-orange-700 group-hover:translate-x-0.5 transition-all motion-reduce:transition-none" />
              </button>
            </CardContent>
          </Card>

          {/* Info Halaqoh Faktual */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200/60">
            <div className="flex items-center gap-2 mb-2 text-[#0E7C3A]">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Info Halaqoh
              </span>
            </div>
            <p className="text-xs text-slate-800 font-bold truncate">
              {halaqohName}
            </p>
            <div className="mt-3 pt-2.5 border-t border-emerald-200/50 flex items-center justify-between text-[11px] text-slate-600">
              <span>Total Santri Binaan</span>
              <span className="font-semibold text-emerald-800">
                {totalBinaan} Santri
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL/DRAWER AKSESIBEL: DAFTAR LENGKAP SANTRI BELUM SETOR              */}
      {/* ========================================================================= */}
      {showAllSantriModal && (
        <div
          data-testid="modal-semua-santri"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 motion-reduce:animate-none motion-reduce:transition-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-santri-title"
          aria-describedby="modal-santri-desc"
          onClick={handleCloseModal}
        >
          <div
            ref={modalContentRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden border border-slate-200"
          >
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <h3
                  id="modal-santri-title"
                  className="text-base sm:text-lg font-bold text-slate-900 font-heading"
                >
                  {selectedFilter === "ALL"
                    ? "Daftar Semua Santri"
                    : selectedFilter === "BELUM_SETOR"
                    ? "Daftar Santri Belum Setor"
                    : selectedFilter === "PERLU_TINDAKAN"
                    ? "Daftar Santri Perlu Tindakan"
                    : "Daftar Santri"}{" "}
                  ({activeFilteredList.length})
                </h3>
                <p id="modal-santri-desc" className="text-xs text-slate-500 mt-0.5">
                  {halaqohName} • Pilih santri untuk memulai input hafalan
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-close-modal-santri"
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors motion-reduce:transition-none min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                  ref={searchInputRef}
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
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 px-2 rounded-xl transition-colors motion-reduce:transition-none"
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
                          Kelas {santri.kelas} • Capaian: {santri.capaianJuz} Juz (Hlm{" "}
                          {posHalaman}) • Terakhir: {santri.setoranTerakhir}
                        </p>
                      </div>

                      <div className="shrink-0 self-start sm:self-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          data-testid={`btn-catat-setoran-santri-${santri.id || santri.nis}`}
                          onClick={() => handleStartSetoran(santri.id)}
                          className="text-xs font-bold text-[#0E7C3A] border-emerald-200 hover:bg-emerald-50 min-h-[44px] sm:min-h-[38px] gap-1 rounded-xl transition-all motion-reduce:transition-none"
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
                onClick={handleCloseModal}
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
