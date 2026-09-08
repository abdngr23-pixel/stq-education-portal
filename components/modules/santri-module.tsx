"use client";

import React, { useState } from "react";
import { MasterDataSantri, SantriItem } from "@/components/dashboard/master-data-santri";
import { ManajemenHalaqoh } from "@/components/dashboard/manajemen-halaqoh";
import { Role } from "@/types/auth";
import { Users, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SantriModuleProps {
  santriList: SantriItem[];
  userRole: Role;
  halaqohList?: Array<{ id: string; nama: string; pembina?: { nama: string } }>;
  onPrintRapor?: (santri: SantriItem) => void;
  onRefresh?: () => void;
}

export function SantriModule({
  santriList,
  userRole,
  halaqohList = [],
  onPrintRapor,
  onRefresh,
}: SantriModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"santri" | "halaqoh">("santri");

  // Format halaqoh list untuk ManajemenHalaqoh
  const formattedHalaqohList = halaqohList.map((h, idx) => ({
    id: h.id,
    halaqohCode: `HLQ-${String(idx + 1).padStart(4, "0")}`,
    nama: h.nama,
    pembina: h.pembina ? { id: `stf_${idx + 1}`, nama: h.pembina.nama } : null,
    tahunAjaran: "2026/2027",
    _count: {
      santriList: santriList.filter((s) => s.halaqoh === h.nama).length,
    },
    santriList: santriList
      .filter((s) => s.halaqoh === h.nama)
      .map((s) => ({ id: s.id, nis: s.nis, nama: s.nama, kelas: s.kelas })),
  }));

  const staffMusyrifList = [
    { id: "stf-1", nama: "Ust. Razan Mufli, S.Pd", staffCode: "STF-0001" },
    { id: "stf-2", nama: "Ust. Kamal", staffCode: "STF-0002" },
    { id: "stf-3", nama: "Ust. Rizaldi", staffCode: "STF-0003" },
    { id: "stf-4", nama: "Ust. Abi Hudzaifah", staffCode: "STF-0004" },
    { id: "stf-5", nama: "Ust. Alwan", staffCode: "STF-0005" },
    { id: "stf-6", nama: "Ustadzah Lisa Dwina Fitri", staffCode: "STF-0006" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Module & Sub-tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">
            Data Santri & Halaqoh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Master data santri STQ Darul Ulum Cendekia, pembagian kelompok halaqoh tahfizh, dan pembina
          </p>
        </div>

        {/* Sub-tab Navigation (Tahap 5: Pemulihan Manajemen Halaqoh) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab("santri")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              activeSubTab === "santri"
                ? "bg-white text-emerald-800 shadow-xs border border-emerald-100"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Users className="h-4 w-4" />
            Daftar Santri
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("halaqoh")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              activeSubTab === "halaqoh"
                ? "bg-white text-emerald-800 shadow-xs border border-emerald-100"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BookmarkCheck className="h-4 w-4" />
            Kelola Halaqoh
          </button>
        </div>
      </div>

      {activeSubTab === "santri" ? (
        <MasterDataSantri
          santriList={santriList}
          userRole={userRole}
          halaqohList={halaqohList}
          onPrintRapor={onPrintRapor}
          onRefresh={onRefresh}
        />
      ) : (
        <ManajemenHalaqoh
          halaqohList={formattedHalaqohList}
          staffMusyrifList={staffMusyrifList}
          santriList={santriList.map((s) => ({ id: s.id, nis: s.nis, nama: s.nama, halaqohId: s.halaqoh }))}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

