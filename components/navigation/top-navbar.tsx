"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon, LogOut, LogIn, ChevronDown, ShieldCheck, Check } from "lucide-react";
import { ROLE_LABELS, Role } from "@/types/auth";
import { logoutAction } from "@/app/actions/auth";

export interface TopNavbarProps {
  currentRole?: Role;
  userName?: string;
  isLoggedIn?: boolean;
  onRoleChange?: (role: Role) => void;
}

export function TopNavbar({
  currentRole = "MT",
  userName = "Ustadz Pembina",
  isLoggedIn = true,
  onRoleChange,
}: TopNavbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleInfo = ROLE_LABELS[currentRole] || {
    title: "Pengguna",
    badgeVariant: "neutral",
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
      router.push("/login");
      router.refresh();
    });
  };

  const handleSelectRole = (r: Role) => {
    setIsRoleDropdownOpen(false);
    if (onRoleChange) {
      onRoleChange(r);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 p-0.5 sm:p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200 shrink-0">
            <img src="/logo.png" alt="STQ Darul Ulum Cendekia" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-sm sm:text-base md:text-lg text-slate-800 tracking-tight">
                STQ Portal
              </span>
              <span className="text-[9px] sm:text-[10px] text-[#C9990E] font-bold bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-200/60 shrink-0">
                DUC
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden md:block">
              Darul Ulum Cendekia
            </p>
          </div>
        </Link>

        {/* Center/Right: Role Switcher Dropdown & User Info */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Interactive Role Selector */}
          {onRoleChange && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-left group min-h-[36px] sm:min-h-[40px]"
                title="Ganti Peran Pengguna (Role Simulator)"
                aria-label="Pilih Role Pengguna"
              >
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-slate-700 hidden md:inline">Peran:</span>
                  <Badge variant={roleInfo.badgeVariant} size="sm" className="font-bold text-[11px] sm:text-xs px-1.5 sm:px-2.5">
                    {currentRole}
                  </Badge>
                </div>
                <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 group-hover:text-slate-700 transition-transform duration-200 shrink-0" />
              </button>

              {/* Dropdown Menu 10 Roles (Responsive Width) */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <ShieldCheck className="h-4 w-4 text-[#0E7C3A]" />
                      <span>Simulator 10 Peran Pengguna</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Pilih Role</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
                      const isSelected = currentRole === r;
                      const info = ROLE_LABELS[r];
                      return (
                        <button
                          key={r}
                          onClick={() => handleSelectRole(r)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs transition-colors text-left ${
                            isSelected
                              ? "bg-emerald-50 font-bold text-emerald-900 border border-emerald-200"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={info.badgeVariant} size="sm" className="w-12 text-center justify-center font-bold shrink-0">
                              {r}
                            </Badge>
                            <span className="truncate">{info.title}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-[#0E7C3A] shrink-0 ml-1.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="h-5 sm:h-6 w-px bg-slate-200 hidden sm:block" />

          {/* User Profile & Logout */}
          {isLoggedIn ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">{userName}</p>
                <p className="text-[10px] text-slate-500 truncate max-w-[130px]">{roleInfo.title}</p>
              </div>

              <div
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0"
                title={`${userName} (${roleInfo.title})`}
              >
                <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Keluar (Logout)"
                aria-label="Keluar"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl bg-[#0E7C3A] text-white text-xs font-bold hover:bg-[#0B642E] transition-colors"
            >
              <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Masuk</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
