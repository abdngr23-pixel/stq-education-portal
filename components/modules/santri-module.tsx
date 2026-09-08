"use client";

import React from "react";
import { MasterDataSantri, SantriItem } from "@/components/dashboard/master-data-santri";
import { Role } from "@/types/auth";

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
  return (
    <div className="space-y-6">
      {/* Header Module */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 font-heading">
          Data Santri & Halaqoh
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Master data santri STQ Darul Ulum Cendekia, pembagian halaqoh, dan status santri aktif
        </p>
      </div>

      <MasterDataSantri
        santriList={santriList}
        userRole={userRole}
        halaqohList={halaqohList}
        onPrintRapor={onPrintRapor}
        onRefresh={onRefresh}
      />
    </div>
  );
}
