import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, TrendingUp, Users, DollarSign, Activity } from "lucide-react";

export interface DashboardYayasanProps {
  totalSantri: number;
  auditLogsCount: number;
  onNavigateToAudit: () => void;
  onNavigateToSponsor: () => void;
}

export function DashboardYayasan({
  totalSantri,
  auditLogsCount,
  onNavigateToAudit,
  onNavigateToSponsor,
}: DashboardYayasanProps) {
  return (
    <div className="space-y-6">
      {/* 1. KPI Strategis Yayasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Santri Binaan"
          value={`${totalSantri} Santri`}
          description="Pesantren Tahfizh DUC"
          icon={<Users className="h-5 w-5" />}
          badgeText="100% Aktif"
          badgeVariant="green"
        />
        <StatCard
          title="Rata-rata Capaian"
          value="4.7 Juz"
          description="Pertumbuhan +0.6 Juz/Bulan"
          icon={<TrendingUp className="h-5 w-5" />}
          isAppreciation
          badgeText="Progres Positif"
          badgeVariant="gold"
        />
        <StatCard
          title="Serapan Anggaran"
          value="84.2%"
          description="Realisasi Semester Ganjil"
          icon={<DollarSign className="h-5 w-5" />}
          badgeText="Sesuai RKAS"
          badgeVariant="sky"
        />
        <StatCard
          title="Integritas Sistem"
          value={`${auditLogsCount} Log`}
          description="Audit Trail Kepatuhan"
          icon={<ShieldCheck className="h-5 w-5" />}
          badgeText="Aman 100%"
          badgeVariant="green"
        />
      </div>

      {/* 2. Dua Kolom: Laporan Strategis & Akses Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card rounded="3xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#0E7C3A]" />
              Laporan Kinerja Kelembagaan &amp; Program Tahfizh
            </CardTitle>
            <CardDescription>
              Ringkasan pemantauan strategis dewan pembina yayasan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-950">Program Ziyadah 30 Juz Mutqin</span>
                <Badge variant="green" size="sm">On-Track</Badge>
              </div>
              <p className="text-emerald-800">
                88% santri memenuhi target bulanan. 2 santri siap mengikuti wisuda juz semester ganjil.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Program Orang Tua Asuh (Sponsor Beasiswa)</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onNavigateToSponsor}
                  className="text-xs h-7 px-2.5"
                >
                  Lihat Donatur
                </Button>
              </div>
              <p className="text-slate-600">
                12 santri dhuafa telah terhubung dengan muhsinin, laporan bulanan tersalurkan berkala via WhatsApp.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card rounded="3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0E7C3A]" />
                Kepatuhan &amp; Pengawasan Audit Trail
              </CardTitle>
              <CardDescription>
                Transparansi seluruh mutasi data dan otorisasi sistem
              </CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateToAudit}
              leftIcon={<Activity className="h-3.5 w-3.5" />}
            >
              Buka Audit Log
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-slate-600">
              Sistem mencatat setiap tindakan kritis (input nilai, pengesahan izin, perubahan user, dan otorisasi anggaran) lengkap dengan IP Address dan Timestamp.
            </p>
            <div className="p-3 rounded-2xl bg-slate-100 font-mono text-[11px] text-slate-700">
              ✓ Database Backup: Otomatis harian ke penyimpanan terisolasi.<br />
              ✓ Proteksi RBAC: 10 Peran terisolasi dengan wewenang deklaratif.<br />
              ✓ Kepatuhan Audit: {auditLogsCount} rekam jejak tersimpan.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
