"use client";

import React, { useState } from "react";
import {
  AppNavId,
  ALL_NAV_ITEMS,
  ROLE_MOBILE_PRIMARY,
} from "@/types/navigation";
import { Role } from "@/types/auth";
import { cn } from "@/lib/utils";
import { LayoutGrid, X } from "lucide-react";

export interface MobileBottomNavProps {
  activeTab: AppNavId;
  allowedTabs: AppNavId[];
  userRole: Role;
  onSelectTab: (tab: AppNavId) => void;
  className?: string;
}

export function MobileBottomNav({
  activeTab,
  allowedTabs,
  userRole,
  onSelectTab,
  className,
}: MobileBottomNavProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 1. Tentukan 3 atau 4 tombol primer HP khusus untuk role ini
  const primaryIds = (ROLE_MOBILE_PRIMARY[userRole] || [
    "beranda",
    "tahfizh",
    "presensi",
    "data_santri",
  ]).filter((id) => allowedTabs.includes(id));

  // 2. Modul sekunder untuk drawer "Lainnya" (hanya yang diizinkan)
  const secondaryIds = allowedTabs.filter((id) => !primaryIds.includes(id));
  const hasMore = secondaryIds.length > 0;

  const isMoreTabActive = hasMore && secondaryIds.includes(activeTab);

  return (
    <>
      {/* Primary Mobile Bottom Nav Bar (md:hidden) */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 py-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] shadow-lg select-none",
          className
        )}
        aria-label="Navigasi Menu HP"
      >
        <div
          className={cn(
            "grid gap-1 max-w-lg mx-auto items-center",
            hasMore
              ? primaryIds.length === 3
                ? "grid-cols-4"
                : "grid-cols-5"
              : `grid-cols-${primaryIds.length}`
          )}
        >
          {primaryIds.map((id) => {
            const item = ALL_NAV_ITEMS[id];
            if (!item) return null;
            const Icon = item.icon;
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onSelectTab(id);
                }}
                className={cn(
                  "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[48px] transition-all",
                  isActive
                    ? "text-[#0E7C3A] font-extrabold bg-emerald-50/90"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "stroke-[2.5]" : "stroke-[1.75]"
                  )}
                />
                <span className="text-[11px] mt-0.5 font-medium tracking-tight truncate max-w-[68px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Tombol Lainnya jika role memiliki modul sekunder */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[48px] transition-all",
                isDrawerOpen || isMoreTabActive
                  ? "text-[#0E7C3A] font-extrabold bg-emerald-50/90"
                  : "text-slate-500 hover:text-slate-800"
              )}
              aria-expanded={isDrawerOpen}
              aria-label="Buka Modul Tambahan"
            >
              <LayoutGrid
                className={cn(
                  "h-5 w-5 shrink-0",
                  isDrawerOpen || isMoreTabActive
                    ? "stroke-[2.5]"
                    : "stroke-[1.75]"
                )}
              />
              <span className="text-[11px] mt-0.5 font-medium tracking-tight truncate">
                Lainnya
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Drawer Modul Tambahan (Sheet Modal) */}
      {isDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-drawer-title"
          className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end p-2 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDrawerOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 space-y-3 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-[#0E7C3A]" />
                <h3
                  id="mobile-drawer-title"
                  className="text-sm font-bold text-slate-800 font-heading"
                >
                  Modul &amp; Fungsi Tambahan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Tutup Menu Tambahan"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {secondaryIds.map((id) => {
                const item = ALL_NAV_ITEMS[id];
                if (!item) return null;
                const Icon = item.icon;
                const isActive = activeTab === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onSelectTab(id);
                    }}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-all min-h-[52px]",
                      isActive
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-2xs"
                        : "bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 mt-0.5",
                        isActive ? "text-[#0E7C3A]" : "text-slate-500"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-snug truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {item.shortDesc}
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
