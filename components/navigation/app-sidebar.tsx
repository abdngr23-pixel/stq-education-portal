"use client";

import React from "react";
import Link from "next/link";
import {
  AppNavId,
  NavCategory,
  ALL_NAV_ITEMS,
  CATEGORY_LABELS,
} from "@/types/navigation";
import { Role } from "@/types/auth";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

export interface AppSidebarProps {
  activeTab: AppNavId;
  allowedTabs: AppNavId[];
  userRole: Role;
  userName: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectTab: (tab: AppNavId) => void;
  onLogout: () => void;
  className?: string;
}

export function AppSidebar({
  activeTab,
  allowedTabs,
  userRole,
  userName,
  isCollapsed,
  onToggleCollapse,
  onSelectTab,
  onLogout,
  className,
}: AppSidebarProps) {
  // Kelompokkan menu yang diizinkan berdasarkan kategori
  const categories: NavCategory[] = [
    "utama",
    "tahfizh_akademik",
    "kesantrian",
    "manajemen",
    "sistem",
  ];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300 select-none z-30 shrink-0",
        isCollapsed ? "w-[72px]" : "w-[260px]",
        className
      )}
      aria-label="Navigasi Utama Sistem"
    >
      {/* 1. Header Sidebar: Logo & Nama Sekolah */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-200/80 bg-slate-50/50">
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab("beranda");
          }}
          className="flex items-center gap-2.5 overflow-hidden group"
          title={`${INSTITUTION_CONFIG.schoolName} — ${INSTITUTION_CONFIG.yayasanName}`}
        >
          <div className="h-10 w-10 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
            <img
              src="/logo.png"
              alt="Logo DUC"
              width={36}
              height={36}
              className="h-full w-full object-contain"
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-extrabold text-sm text-slate-800 tracking-tight truncate">
                  STQ DUC
                </span>
                <span className="text-[10px] text-[#C9990E] font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60 shrink-0">
                  Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Darul Ulum Cendekia
              </p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title={isCollapsed ? "Buka Navigasi" : "Ringkas Navigasi"}
          aria-label={isCollapsed ? "Buka Navigasi" : "Ringkas Navigasi"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* 2. Daftar Menu Terkelompok */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-4 py-3 custom-scrollbar">
        {categories.map((cat) => {
          const itemsInCat = allowedTabs
            .map((id) => ALL_NAV_ITEMS[id])
            .filter((item) => item && item.category === cat);

          if (itemsInCat.length === 0) return null;

          return (
            <div key={cat} className="space-y-1">
              {!isCollapsed && (
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-2.5 py-1">
                  {CATEGORY_LABELS[cat]}
                </p>
              )}
              {isCollapsed && (
                <div className="h-px bg-slate-100 my-1 mx-2" aria-hidden="true" />
              )}
              <div className="space-y-0.5">
                {itemsInCat.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTab(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-left text-sm min-h-[44px]",
                        isActive
                          ? "bg-[#0E7C3A] text-white font-semibold shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isActive ? "text-white" : "text-slate-500"
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Footer Sidebar: Profil Pengguna & Keluar */}
      <div className="p-2.5 border-t border-slate-200/80 bg-slate-50/40">
        <div
          className={cn(
            "flex items-center gap-2.5 p-2 rounded-xl transition-colors",
            !isCollapsed ? "hover:bg-slate-100/80" : "justify-center"
          )}
        >
          <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
            {userRole}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {userName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Role: {userRole}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Keluar dari Portal"
              aria-label="Keluar dari Portal"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
