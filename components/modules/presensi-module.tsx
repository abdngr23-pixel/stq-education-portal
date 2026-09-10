"use client";

import React, { useState } from "react";
import { Role } from "@/types/auth";
import { PresensiHarianMobile } from "@/components/dashboard/presensi-harian-mobile";
import { MutabaahHarianTab } from "@/components/dashboard/mutabaah-harian-tab";
import { DashboardSantriSummary } from "./beranda-module";
import { Sparkles, BookOpen, CalendarCheck } from "lucide-react";

export interface PresensiModuleProps {
  userRole: Role;
  currentUserName: string;
  currentHalaqohName?: string | null;
  santriList: DashboardSantriSummary[];
  halaqohList: Array<{ id: string; nama: string; pembina: string }>;
  onPresensiSaved?: (info: { kegiatan: string; total: number }) => void;
}

export function PresensiModule({
  userRole,
  currentUserName,
  currentHalaqohName,
  santriList,
  halaqohList,
  onPresensiSaved,
}: PresensiModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"presensi" | "mutabaah">("presensi");

  return (
    <div className="space-y-4">
      {/* Subtab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("presensi")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "presensi"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            Presensi Jamaah &amp; Halaqoh
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("mutabaah")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "mutabaah"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Mutaba&apos;ah Harian
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Waktu Resmi WITA (UTC+8)</span>
        </div>
      </div>

      {/* Content Rendering */}
      {activeSubTab === "presensi" && (
        <PresensiHarianMobile
          santriList={santriList}
          currentUserName={currentUserName}
          currentUserRole={userRole}
          currentHalaqohName={currentHalaqohName || undefined}
          halaqohList={halaqohList}
          onPresensiSaved={onPresensiSaved}
        />
      )}

      {activeSubTab === "mutabaah" && (
        <MutabaahHarianTab
          userRole={userRole}
          currentUserName={currentUserName}
          currentHalaqohName={currentHalaqohName || undefined}
          santriList={santriList}
          halaqohList={halaqohList}
          onSaved={(info) => {
            onPresensiSaved?.({ kegiatan: "Mutaba'ah Harian", total: info.total });
          }}
        />
      )}
    </div>
  );
}
