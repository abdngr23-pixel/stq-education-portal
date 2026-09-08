"use client";

import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Role, ROLE_LABELS } from "@/types/auth";
import { AuditLogItem } from "@/app/actions/audit";
import { exportToCSV } from "@/lib/export-csv";
import {
  RotateCcw,
  Download,
  Search,
  Lock,
  Filter,
} from "lucide-react";

export interface AuditModuleProps {
  auditLogsList: AuditLogItem[];
  userRole: Role;
  onRefresh: () => Promise<void> | void;
  onSwitchRole?: (role: Role) => void;
  isPending?: boolean;
}

export function AuditModule({
  auditLogsList,
  userRole,
  onRefresh,
  onSwitchRole,
  isPending = false,
}: AuditModuleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const hasAccess = ["YAY", "KS", "ADM"].includes(userRole);

  const filteredLogs = useMemo(() => {
    return auditLogsList.filter((log) => {
      const matchSearch =
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase());

      const matchAction =
        actionFilter === "ALL" ||
        (actionFilter === "TAHFIZH" && log.action.includes("TAHFIZH")) ||
        (actionFilter === "DISIPLIN" && (log.action.includes("PELANGGARAN") || log.action.includes("SP"))) ||
        (actionFilter === "PERIZINAN" && log.action.includes("PERIZINAN")) ||
        (actionFilter === "SURAT" && log.action.includes("SURAT"));

      return matchSearch && matchAction;
    });
  }, [auditLogsList, searchTerm, actionFilter]);

  const handleExportCSV = () => {
    exportToCSV(
      "Audit_Trail_Log_STQ",
      ["Timestamp", "User", "Email", "Role", "Aksi", "Entitas", "Entity ID", "Rincian"],
      filteredLogs.map((log) => [
        new Date(log.createdAt).toLocaleString("id-ID"),
        log.user.username,
        log.user.email,
        log.user.role,
        log.action,
        log.entity,
        log.entityId || "-",
        JSON.stringify(log.details || {}),
      ])
    );
  };

  if (!hasAccess) {
    return (
      <Card rounded="3xl" className="p-8 text-center bg-amber-50/60 border-amber-200">
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Akses Audit Dibatasi</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Hanya peran eksekutif <strong>Yayasan (YAY)</strong>, <strong>Mudir (KS)</strong>, dan <strong>Tata Usaha (ADM)</strong> yang berwenang memantau catatan jejak audit transaksi.
          </p>
          {onSwitchRole && (
            <div className="pt-2">
              <Button
                variant="gold"
                size="sm"
                onClick={() => onSwitchRole("YAY")}
              >
                Beralih ke Akun Yayasan (YAY)
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">
            Audit Trail & Log Mutasi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catatan jejak aktivitas data, transaksi perizinan, tahfizh, dan surat resmi sistem
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            isLoading={isPending}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Perbarui
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportCSV}
            leftIcon={<Download className="h-3.5 w-3.5 text-emerald-700" />}
          >
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari log aksi, username, entitas..."
            className="pl-9.5 text-xs h-10"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 h-10"
          >
            <option value="ALL">Semua Aksi</option>
            <option value="TAHFIZH">Tahfizh & Ikhtibar</option>
            <option value="DISIPLIN">Kedisiplinan & SP</option>
            <option value="PERIZINAN">Perizinan Santri</option>
            <option value="SURAT">Surat Resmi</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <Card rounded="3xl" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="p-3.5 font-bold text-slate-700">Waktu & Tanggal</th>
                <th className="p-3.5 font-bold text-slate-700">Pengguna (Pelaksana)</th>
                <th className="p-3.5 font-bold text-slate-700">Aksi (Action)</th>
                <th className="p-3.5 font-bold text-slate-700">Entitas</th>
                <th className="p-3.5 font-bold text-slate-700">Rincian Perubahan Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Tidak ada log aktivitas yang cocok dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isTahfizh = log.action.includes("SETORAN") || log.action.includes("IKHTIBAR");
                  const isDisiplin = log.action.includes("PELANGGARAN") || log.action.includes("SP");
                  const isIzin = log.action.includes("PERIZINAN") || log.action.includes("APPROVAL");

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{log.user.username}</span>
                          <Badge variant={ROLE_LABELS[log.user.role as Role]?.badgeVariant || "neutral"} size="sm">
                            {log.user.role}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400">{log.user.email}</span>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            isTahfizh ? "green" : isDisiplin ? "ditolak" : isIzin ? "gold" : "sky"
                          }
                          size="sm"
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-600">
                        {log.entity}
                        {log.entityId && (
                          <span className="block text-[10px] text-slate-400">ID: {log.entityId}</span>
                        )}
                      </td>
                      <td className="p-3.5 max-w-xs truncate text-[11px] text-slate-500 font-mono">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
