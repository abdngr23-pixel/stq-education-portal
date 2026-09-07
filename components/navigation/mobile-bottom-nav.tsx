"use client";

import React from "react";
import { BookCheck, Home, Building2, HeartHandshake, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavClusterId = "tahfizh" | "kesantrian" | "manajemen" | "wali" | "sistem";

export interface MobileBottomNavProps {
  activeCluster?: NavClusterId;
  allowedClusters?: NavClusterId[];
  onSelectCluster?: (cluster: NavClusterId) => void;
}

export function MobileBottomNav({
  activeCluster = "tahfizh",
  allowedClusters,
  onSelectCluster,
}: MobileBottomNavProps) {
  const allClusters = [
    {
      id: "tahfizh" as NavClusterId,
      label: "Tahfizh",
      icon: BookCheck,
    },
    {
      id: "kesantrian" as NavClusterId,
      label: "Asrama",
      icon: Home,
    },
    {
      id: "manajemen" as NavClusterId,
      label: "Kantor",
      icon: Building2,
    },
    {
      id: "wali" as NavClusterId,
      label: "Wali",
      icon: HeartHandshake,
    },
    {
      id: "sistem" as NavClusterId,
      label: "Sistem",
      icon: ShieldCheck,
    },
  ];

  const clusters = allowedClusters
    ? allClusters.filter((c) => allowedClusters.includes(c.id))
    : allClusters;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 py-1 safe-area-pb shadow-lg">
      <div className="flex items-center justify-around">
        {clusters.map((item) => {
          const Icon = item.icon;
          const isActive = activeCluster === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCluster && onSelectCluster(item.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl min-h-[46px] transition-all",
                isActive
                  ? "text-[#0E7C3A] font-extrabold bg-emerald-50/80 scale-105"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5]" : "stroke-[1.75]")} />
              <span className="text-[10px] mt-0.5 font-medium tracking-tight leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
