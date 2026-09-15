"use client";

import React, { useState, useEffect, useMemo } from "react";
import { MasterDataSantri, SantriItem } from "@/components/dashboard/master-data-santri";
import { ManajemenHalaqoh } from "@/components/dashboard/manajemen-halaqoh";
import { Role } from "@/types/auth";
import { Users, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssignableStaffAction } from "@/app/actions/halaqoh";

export interface SantriModuleProps {
  santriList: SantriItem[];
  userRole: Role;
  halaqohList?: Array<{
    id: string;
    halaqohCode?: string;
    nama: string;
    pembina?: { id?: string; nama: string; staffCode?: string } | null;
    tahunAjaran?: string;
  }>;
  onPrintRapor?: (santri: SantriItem) => void;
  onRefresh?: () => void;
  loadError?: string | null;
}

export function SantriModule({
  santriList,
  userRole,
  halaqohList = [],
  onPrintRapor,
  onRefresh,
  loadError = null,
}: SantriModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"santri" | "halaqoh">("santri");

  // Otoritas Manajemen Halaqoh: Hanya KS dan ADM
  const canManageHalaqoh = userRole === "KS" || userRole === "ADM";

  // State staf pembina dinamis dari server untuk KS/ADM
  const [assignableStaff, setAssignableStaff] = useState<
    Array<{ id: string; staffCode: string; nama: string; roleStaff: string; status: string }>
  >([]);

  useEffect(() => {
    if (!canManageHalaqoh) return;

    let isMounted = true;
    getAssignableStaffAction()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setAssignableStaff(res.data);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat staf pembina:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [canManageHalaqoh]);

  // Format halaqoh list untuk ManajemenHalaqoh (menggunakan data authoritative pangkalan data)
  const formattedHalaqohList = useMemo(() => {
    return halaqohList.map((h) => ({
      id: h.id,
      halaqohCode: h.halaqohCode || "-",
      nama: h.nama,
      pembina: h.pembina
        ? {
            id: h.pembina.id || null,
            nama: h.pembina.nama,
            staffCode: h.pembina.staffCode || null,
          }
        : null,
      tahunAjaran: h.tahunAjaran || "-",
      _count: {
        santriList: santriList.filter((s) => s.halaqoh === h.nama).length,
      },
      santriList: santriList
        .filter((s) => s.halaqoh === h.nama)
        .map((s) => ({ id: s.id, nis: s.nis, nama: s.nama, kelas: s.kelas })),
    }));
  }, [halaqohList, santriList]);

  // Staf musyrif list dari pangkalan data resmi (tanpa hardcoded/synthetic IDs)
  const staffMusyrifList = useMemo(() => {
    return assignableStaff.map((s) => ({
      id: s.id,
      nama: s.nama,
      staffCode: s.staffCode,
    }));
  }, [assignableStaff]);

  return (
    <div className="space-y-6">
      {/* Header Module & Sub-tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">
            Data Santri &amp; Halaqoh
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Master data santri STQ Darul Ulum Cendekia, pembagian kelompok halaqoh tahfizh, dan pembina
          </p>
        </div>

        {/* Sub-tab Navigation: Hanya ditampilkan untuk KS & ADM */}
        {canManageHalaqoh && (
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
        )}
      </div>

      {activeSubTab === "santri" || !canManageHalaqoh ? (
        <MasterDataSantri
          santriList={santriList}
          userRole={userRole}
          halaqohList={halaqohList.map((h) => ({
            id: h.id,
            nama: h.nama,
            pembina: h.pembina ? { nama: h.pembina.nama } : undefined,
          }))}
          onPrintRapor={onPrintRapor}
          onRefresh={onRefresh}
          loadError={loadError}
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
