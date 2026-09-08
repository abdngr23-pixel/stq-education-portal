"use client";

import React from "react";
import {
  Home,
  BookCheck,
  GraduationCap,
  Award,
  Send,
  AlertTriangle,
  Stethoscope,
  Package,
  DollarSign,
  FileText,
  HeartHandshake,
  Calendar,
  UserCog,
  ShieldCheck,
  Building2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavClusterId = "tahfizh" | "kesantrian" | "manajemen" | "wali" | "sistem";

export interface DualTierNavProps {
  activeCluster: NavClusterId;
  activeTab: string;
  allowedClusters: NavClusterId[];
  allowedTabs: string[];
  onSelectCluster: (cluster: NavClusterId) => void;
  onSelectTab: (tab: string) => void;
  className?: string;
}

export function DualTierNav({
  activeCluster,
  activeTab,
  allowedClusters,
  allowedTabs,
  onSelectCluster,
  onSelectTab,
  className,
}: DualTierNavProps) {
  // Kluster Tier 1
  const clusterDefinitions = [
    {
      id: "tahfizh" as NavClusterId,
      label: "Tahfizh & Nilai",
      icon: BookCheck,
      tabs: ["tahfizh", "akademik", "ikhtibar"],
    },
    {
      id: "kesantrian" as NavClusterId,
      label: "Kesantrian & Asrama",
      icon: Send,
      tabs: ["kesantrian", "kedisiplinan", "kesehatan", "logistik"],
    },
    {
      id: "manajemen" as NavClusterId,
      label: "Manajemen & Kantor",
      icon: Building2,
      tabs: ["data_santri", "administrasi", "sponsor", "surat", "agenda"],
    },
    {
      id: "wali" as NavClusterId,
      label: "Portal Wali & Santri",
      icon: Users,
      tabs: ["portal_wali"],
    },
    {
      id: "sistem" as NavClusterId,
      label: "Sistem & Keamanan",
      icon: ShieldCheck,
      tabs: ["users", "audit"],
    },
  ];

  // Sub-Modul Tier 2 dengan ikon 1 makna yang konsisten
  const allSubModules: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    beranda: { label: "Beranda Ringkasan", icon: Home },
    data_santri: { label: "Data Santri", icon: Users },
    tahfizh: { label: "Setoran Tahfizh", icon: BookCheck },
    akademik: { label: "Nilai & Rapor", icon: GraduationCap },
    ikhtibar: { label: "Ujian Ikhtibar", icon: Award },
    kesantrian: { label: "Perizinan Santri", icon: Send },
    kedisiplinan: { label: "Kedisiplinan & Bintang", icon: AlertTriangle },
    kesehatan: { label: "Poskestren", icon: Stethoscope },
    logistik: { label: "Logistik Asrama", icon: Package },
    administrasi: { label: "Anggaran & Kebutuhan", icon: DollarSign },
    surat: { label: "Surat Resmi AI", icon: FileText },
    sponsor: { label: "Orang Tua Asuh", icon: HeartHandshake },
    agenda: { label: "Kalender Akademik", icon: Calendar },
    portal_wali: { label: "Perkembangan Anak", icon: Users },
    users: { label: "Manajemen Pengguna", icon: UserCog },
    audit: { label: "Audit Trail", icon: ShieldCheck },
  };

  const filteredClusters = clusterDefinitions.filter((c) =>
    allowedClusters.includes(c.id)
  );

  const currentClusterObj = clusterDefinitions.find((c) => c.id === activeCluster);
  const activeClusterTabs = currentClusterObj
    ? currentClusterObj.tabs.filter((t) => allowedTabs.includes(t))
    : [];

  return (
    <div
      className={cn(
        "bg-white rounded-3xl p-2 sm:p-2.5 border border-slate-200/80 shadow-xs space-y-2",
        className
      )}
    >
      {/* Tier 1: Kluster Utama */}
      <div
        className={cn(
          "grid gap-1.5",
          filteredClusters.length === 1
            ? "grid-cols-1"
            : filteredClusters.length === 2
            ? "grid-cols-2"
            : filteredClusters.length === 3
            ? "grid-cols-3"
            : filteredClusters.length === 4
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-5"
        )}
      >
        {filteredClusters.map((cluster) => {
          const Icon = cluster.icon;
          const isActive = activeCluster === cluster.id;
          return (
            <button
              key={cluster.id}
              type="button"
              onClick={() => {
                onSelectCluster(cluster.id);
                // Switch to first permitted tab in this cluster
                const available = cluster.tabs.filter((t) =>
                  allowedTabs.includes(t)
                );
                if (available.length > 0 && !available.includes(activeTab)) {
                  onSelectTab(available[0]);
                }
              }}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all min-h-[44px]",
                isActive
                  ? "bg-[#0E7C3A] text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{cluster.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tier 2: Sub-Modul Navigasi Konsisten */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-50/80 rounded-2xl overflow-x-auto border border-slate-100/90 scrollbar-none">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab("beranda");
          }}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[38px]",
            activeTab === "beranda"
              ? "bg-[#0E7C3A] text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          )}
        >
          <Home className={cn("h-3.5 w-3.5 shrink-0", activeTab === "beranda" ? "text-white" : "text-slate-500")} />
          <span>Dashboard Peran</span>
        </button>
        {activeClusterTabs.map((tabKey) => {
            const item = allSubModules[tabKey];
            if (!item) return null;
            const Icon = item.icon;
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onSelectTab(tabKey);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[38px]",
                  isActive
                    ? "bg-white text-[#0E7C3A] shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-[#0E7C3A]" : "text-slate-500")} />
                <span>{item.label}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
