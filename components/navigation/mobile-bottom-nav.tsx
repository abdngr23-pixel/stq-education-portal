"use client";

import React, { useState } from "react";
import {
  Home,
  BookCheck,
  Send,
  LayoutGrid,
  X,
  GraduationCap,
  Award,
  AlertTriangle,
  Stethoscope,
  Package,
  DollarSign,
  FileText,
  HeartHandshake,
  Calendar,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTabId =
  | "data_santri"
  | "tahfizh"
  | "akademik"
  | "kesantrian"
  | "kedisiplinan"
  | "administrasi"
  | "sponsor"
  | "surat"
  | "ikhtibar"
  | "kesehatan"
  | "logistik"
  | "portal_wali"
  | "agenda"
  | "users"
  | "audit";

export interface MobileBottomNavProps {
  activeTab: NavTabId | "beranda";
  allowedTabs: string[];
  onSelectTab: (tab: NavTabId | "beranda") => void;
}

export function MobileBottomNav({
  activeTab,
  allowedTabs,
  onSelectTab,
}: MobileBottomNavProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Modul sekunder yang dapat diakses lewat "Lainnya"
  const moreModules = [
    {
      id: "akademik" as NavTabId,
      label: "Nilai Akademik & Rapor",
      desc: "Penilaian kurikulum & rapor terpadu",
      icon: GraduationCap,
    },
    {
      id: "ikhtibar" as NavTabId,
      label: "Ujian Ikhtibar Tahfizh",
      desc: "Ujian komprehensif kelulusan juz 2-tahap",
      icon: Award,
    },
    {
      id: "kedisiplinan" as NavTabId,
      label: "Kedisiplinan & Bintang",
      desc: "Poin sanksi berlipat x2 & Surat Peringatan",
      icon: AlertTriangle,
    },
    {
      id: "kesehatan" as NavTabId,
      label: "Poskestren & Klinik",
      desc: "Rekam keluhan medis santri & riwayat obat",
      icon: Stethoscope,
    },
    {
      id: "logistik" as NavTabId,
      label: "Logistik Asrama",
      desc: "Inventaris & mutasi stok perlengkapan",
      icon: Package,
    },
    {
      id: "administrasi" as NavTabId,
      label: "Anggaran & Kebutuhan",
      desc: "Pengajuan dana berjenjang operasional",
      icon: DollarSign,
    },
    {
      id: "surat" as NavTabId,
      label: "Surat Resmi AI",
      desc: "Generator otomatis naskah surat resmi",
      icon: FileText,
    },
    {
      id: "sponsor" as NavTabId,
      label: "Laporan Orang Tua Asuh",
      desc: "Laporan santri beasiswa via WhatsApp",
      icon: HeartHandshake,
    },
    {
      id: "agenda" as NavTabId,
      label: "Kalender Akademik",
      desc: "Agenda kegiatan pesantren & ujian",
      icon: Calendar,
    },
    {
      id: "users" as NavTabId,
      label: "Manajemen Pengguna",
      desc: "Kelola akun & aktivasi akses portal",
      icon: UserCog,
    },
    {
      id: "audit" as NavTabId,
      label: "Audit Trail Sistem",
      desc: "Rekam jejak kepatuhan & log aktivitas",
      icon: ShieldCheck,
    },
  ].filter((m) => allowedTabs.includes(m.id));

  const isMoreActive =
    activeTab !== "beranda" &&
    activeTab !== "tahfizh" &&
    activeTab !== "kesantrian";

  return (
    <>
      {/* 4-Item Primary Bottom Navigation Bar (≤ 390px safe) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1 safe-area-pb shadow-lg">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {/* 1. Beranda */}
          <button
            type="button"
            onClick={() => onSelectTab("beranda")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[46px] transition-all",
              activeTab === "beranda"
                ? "text-[#0E7C3A] font-extrabold bg-emerald-50/80"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Home className={cn("h-5 w-5", activeTab === "beranda" ? "stroke-[2.5]" : "stroke-[1.75]")} />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Beranda</span>
          </button>

          {/* 2. Hafalan */}
          <button
            type="button"
            onClick={() => onSelectTab("tahfizh")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[46px] transition-all",
              activeTab === "tahfizh"
                ? "text-[#0E7C3A] font-extrabold bg-emerald-50/80"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <BookCheck className={cn("h-5 w-5", activeTab === "tahfizh" ? "stroke-[2.5]" : "stroke-[1.75]")} />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Hafalan</span>
          </button>

          {/* 3. Izin */}
          <button
            type="button"
            onClick={() => onSelectTab("kesantrian")}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[46px] transition-all",
              activeTab === "kesantrian"
                ? "text-[#0E7C3A] font-extrabold bg-emerald-50/80"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Send className={cn("h-5 w-5", activeTab === "kesantrian" ? "stroke-[2.5]" : "stroke-[1.75]")} />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Izin</span>
          </button>

          {/* 4. Lainnya (Akses Modul Tambahan Sesuai Role) */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[46px] transition-all relative",
              isMoreActive
                ? "text-[#0E7C3A] font-extrabold bg-emerald-50/80"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <LayoutGrid className={cn("h-5 w-5", isMoreActive ? "stroke-[2.5]" : "stroke-[1.75]")} />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">Lainnya</span>
            {isMoreActive && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-[#0E7C3A]" />
            )}
          </button>
        </div>
      </nav>

      {/* Slide-Up Bottom Sheet Panel "Lainnya" */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 max-h-[80vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-250">
            {/* Header Sheet */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 font-heading">
                  Modul Portal Lainnya
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih modul yang diizinkan untuk peran aktif Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List Menu Tambahan */}
            <div className="grid grid-cols-1 gap-2">
              {moreModules.map((item) => {
                const Icon = item.icon;
                const isItemActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsMoreOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all border",
                      isItemActive
                        ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-bold"
                        : "bg-slate-50/70 hover:bg-slate-100 text-slate-700 border-slate-200/70"
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
                        isItemActive
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-[#0E7C3A] border border-slate-200/80 shadow-2xs"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{item.label}</p>
                      <p className="text-[11px] text-slate-500 font-normal truncate">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
