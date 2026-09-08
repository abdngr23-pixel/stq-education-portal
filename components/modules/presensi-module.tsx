"use client";

import React from "react";
import { Role } from "@/types/auth";
import { PresensiHarianMobile } from "@/components/dashboard/presensi-harian-mobile";
import { DashboardSantriSummary } from "./beranda-module";
import { CheckCircle2, Sparkles } from "lucide-react";

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
  return (
    <div className="space-y-4">
      {/* Header Penjelas Ringkas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/80">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#0E7C3A] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-heading">
              Presensi Shalat Berjamaah &amp; Sesi Halaqoh
            </h2>
            <p className="text-xs text-slate-600">
              Checklist kehadiran santri 1-tap mobile-first dengan integrasi izin aktif &amp; rekap WA asatidz.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-white/80 px-2.5 py-1 rounded-xl border border-emerald-200 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Waktu Resmi WITA (UTC+8)</span>
        </div>
      </div>

      {/* Komponen Presensi Mobile Harian Terpadu */}
      <PresensiHarianMobile
        santriList={santriList}
        currentUserName={currentUserName}
        currentUserRole={userRole}
        currentHalaqohName={currentHalaqohName || undefined}
        halaqohList={halaqohList}
        onPresensiSaved={onPresensiSaved}
      />
    </div>
  );
}
