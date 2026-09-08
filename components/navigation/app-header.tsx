"use client";

import React from "react";
import { AppNavId, ALL_NAV_ITEMS } from "@/types/navigation";
import { Role, ROLE_LABELS } from "@/types/auth";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { Badge } from "@/components/ui/badge";
import { LogOut, Calendar, Menu } from "lucide-react";

export interface AppHeaderProps {
  activeTab: AppNavId;
  userRole: Role;
  userName: string;
  currentHalaqohName?: string | null;
  onLogout: () => void;
  onOpenMobileMenu?: () => void;
}

export function AppHeader({
  activeTab,
  userRole,
  userName,
  currentHalaqohName,
  onLogout,
  onOpenMobileMenu,
}: AppHeaderProps) {
  const currentItem = ALL_NAV_ITEMS[activeTab] || ALL_NAV_ITEMS.beranda;
  const roleInfo = ROLE_LABELS[userRole] || {
    title: "Pengguna",
    badgeVariant: "neutral",
  };

  // Tanggal hari ini dalam format Bahasa Indonesia yang rapi
  const todayFormatted = React.useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Makassar",
    }).format(new Date());
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 shadow-2xs">
      {/* Kiri: Mobile Brand / Desktop Breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Tombol menu drawer di HP */}
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Buka Menu Navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Brand logo di HP */}
        <div className="md:hidden flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt="Logo DUC"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="font-heading font-extrabold text-sm text-slate-900 truncate">
            STQ DUC
          </span>
        </div>

        {/* Breadcrumb & Judul Halaman Desktop */}
        <div className="hidden md:flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-400 shrink-0">
            {INSTITUTION_CONFIG.shortName}
          </span>
          <span className="text-slate-300">/</span>
          <h1 className="text-sm font-bold text-slate-800 truncate font-heading">
            {currentItem.label}
          </h1>
          <span className="text-xs text-slate-400 hidden lg:inline truncate">
            — {currentItem.shortDesc}
          </span>
        </div>
      </div>

      {/* Kanan: Tanggal, Status Halaqoh, Profil & Logout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Halaqoh binaan untuk Musyrif/Pembina */}
        {currentHalaqohName && (
          <span className="hidden lg:inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 max-w-[200px] truncate">
            {currentHalaqohName}
          </span>
        )}

        {/* Tanggal WITA */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200/80">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{todayFormatted} (WITA)</span>
        </div>

        {/* Badge Peran Pengguna */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant={roleInfo.badgeVariant}
            size="sm"
            className="font-bold text-[11px] sm:text-xs"
          >
            {roleInfo.title}
          </Badge>
          <span className="text-xs font-bold text-slate-700 hidden sm:inline max-w-[140px] truncate">
            {userName.split(" ")[0]}
          </span>
        </div>

        {/* Tombol Logout Ramping */}
        <button
          type="button"
          onClick={onLogout}
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200/80 sm:border-transparent hover:border-red-200 transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0"
          title="Keluar dari sesi ini"
          aria-label="Keluar dari sesi ini"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
