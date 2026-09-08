"use client";

import React, { useState } from "react";
import { Role, DEMO_ACCOUNTS } from "@/types/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, UserCheck, ArrowRight, Check } from "lucide-react";

export interface DemoAccountSwitcherProps {
  onSelectRole: (role: Role) => void;
  onAutofill: (role: Role) => void;
  isPending?: boolean;
  selectedRole?: Role | null;
  copiedRole?: Role | null;
}

type DemoCategory = "ALL" | "LEADERSHIP" | "ASATIDZ" | "WALI";

/**
 * Komponen Evaluasi Akses Cepat Peran (Demo Switcher)
 * HANYA aktif pada lingkungan pengembangan / demonstrasi terisolasi.
 * Tidak dipasang atau dirender pada lingkungan produksi.
 */
export function DemoAccountSwitcher({
  onSelectRole,
  onAutofill,
  isPending = false,
  selectedRole = null,
  copiedRole = null,
}: DemoAccountSwitcherProps) {
  const [categoryFilter, setCategoryFilter] = useState<DemoCategory>("ALL");

  // Penyaring peran dengan identifier konsisten (Temuan 1 Remediasi)
  const filteredRoles = (Object.keys(DEMO_ACCOUNTS) as Role[]).filter((r) => {
    if (categoryFilter === "ALL") return true;
    if (categoryFilter === "LEADERSHIP") return ["KS", "ADM", "YAY"].includes(r);
    if (categoryFilter === "ASATIDZ") return ["MT", "MK", "GA", "PH", "OSDA"].includes(r);
    if (categoryFilter === "WALI") return ["WS", "ST"].includes(r);
    return false;
  });

  return (
    <Card rounded="3xl" className="shadow-2xl p-5 sm:p-7 bg-slate-800/90 border border-slate-700/80 backdrop-blur-sm text-white">
      <CardHeader className="text-left pb-4 px-0 pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-400" />
              Pintasan Akun Evaluasi (Khusus Lingkungan Demo)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Gunakan akun simulasi di bawah untuk menguji hak akses RBAC/ABAC masing-masing pengguna
            </CardDescription>
          </div>
        </div>

        {/* Filter Kategori Peran yang Konsisten */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3" role="tablist" aria-label="Filter Kategori Akun Demo">
          <button
            type="button"
            id="filter-demo-all"
            onClick={() => setCategoryFilter("ALL")}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all min-h-[38px] ${
              categoryFilter === "ALL"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "bg-slate-700/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Semua Akun ({Object.keys(DEMO_ACCOUNTS).length})
          </button>
          <button
            type="button"
            id="filter-demo-leadership"
            onClick={() => setCategoryFilter("LEADERSHIP")}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all min-h-[38px] ${
              categoryFilter === "LEADERSHIP"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "bg-slate-700/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Pimpinan (KS/ADM/YAY)
          </button>
          <button
            type="button"
            id="filter-demo-asatidz"
            onClick={() => setCategoryFilter("ASATIDZ")}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all min-h-[38px] ${
              categoryFilter === "ASATIDZ"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "bg-slate-700/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Asatidz &amp; Guru
          </button>
          <button
            type="button"
            id="filter-demo-wali"
            onClick={() => setCategoryFilter("WALI")}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all min-h-[38px] ${
              categoryFilter === "WALI"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "bg-slate-700/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Wali &amp; Santri
          </button>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0 max-h-[460px] overflow-y-auto pr-1 space-y-2.5">
        {filteredRoles.map((r) => {
          const acc = DEMO_ACCOUNTS[r];
          const isSelectedPending = isPending && selectedRole === r;
          const isFormCopied = copiedRole === r;

          return (
            <div
              key={r}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={acc.badgeVariant} size="sm" className="font-extrabold text-[10px] px-2 py-0.5">
                    {acc.role}
                  </Badge>
                  <span className="font-bold text-xs sm:text-sm text-white font-heading">
                    {acc.roleTitle}
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>{acc.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>User: <strong className="text-emerald-300">{acc.username}</strong></span>
                  <span>•</span>
                  <span>Pass: <strong className="text-emerald-300">{acc.password}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onAutofill(r)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all flex items-center gap-1 min-h-[40px]"
                >
                  {isFormCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <span>Isi Form</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectRole(r)}
                  disabled={isPending}
                  className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs transition-all flex items-center gap-1 min-h-[40px] disabled:opacity-50"
                >
                  {isSelectedPending ? (
                    <span className="animate-pulse">Masuk...</span>
                  ) : (
                    <>
                      <span>Masuk</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
