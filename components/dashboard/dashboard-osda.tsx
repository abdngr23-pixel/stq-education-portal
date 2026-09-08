import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Stethoscope, Users, CheckCircle2 } from "lucide-react";

export interface DashboardOSDAProps {
  onNavigateToDisiplin: () => void;
  onNavigateToKesehatan: () => void;
  onNavigateToPresensi?: () => void;
}

export function DashboardOSDA({
  onNavigateToDisiplin,
  onNavigateToKesehatan,
  onNavigateToPresensi,
}: DashboardOSDAProps) {
  return (
    <div className="space-y-6">
      {/* 1. KPI Organisasi Santri */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Tugas Piket Hari Ini"
          value="Divisi Keamanan"
          description="Piket Masjid &amp; Asrama"
          icon={<Users className="h-5 w-5" />}
          badgeText="Bertugas"
          badgeVariant="green"
        />
        <div
          onClick={onNavigateToPresensi}
          className={onNavigateToPresensi ? "cursor-pointer transition-transform hover:scale-[1.02]" : ""}
          role="button"
          tabIndex={0}
        >
          <StatCard
            title="Absensi Shalat Jamaah"
            value="98.5%"
            description="Subuh, Maghrib, Isya"
            icon={<CheckCircle2 className="h-5 w-5" />}
            badgeText={onNavigateToPresensi ? "Buka Presensi ➜" : "Sangat Tertib"}
            badgeVariant="green"
          />
        </div>
        <StatCard
          title="Laporan Kedisiplinan"
          value="1 Catatan"
          description="Keterlambatan Masuk Kelas"
          icon={<AlertTriangle className="h-5 w-5" />}
          badgeText="Verifikasi MK"
          badgeVariant="orange"
        />
        <StatCard
          title="Santri Sakit (UKS)"
          value="1 Santri"
          description="Istirahat di Poskestren"
          icon={<Stethoscope className="h-5 w-5" />}
          badgeText="Pengawasan"
          badgeVariant="sky"
        />
      </div>

      {/* 2. Menu Input Cepat OSDA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4 border-emerald-200/80 bg-emerald-50/20">
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-5 w-5 text-[#0E7C3A]" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Presensi Shalat Berjamaah &amp; Shaf
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Checklist cepat kehadiran santri 5 waktu sholat berjamaah di masjid (Subuh s.d Isya) dengan deteksi masbuk &amp; izin.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToPresensi}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            Buka Checklist Shalat
          </Button>
        </Card>

        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Pencatatan Pelanggaran Kedisiplinan
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Catat santri yang terlambat shalat berjamaah, tidak mengenakan atribut lengkap, atau melanggar jam malam asrama untuk diverifikasi Musyrif Keasramaan.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateToDisiplin}
            leftIcon={<AlertTriangle className="h-4 w-4" />}
          >
            Buka Form Pelanggaran
          </Button>
        </Card>

        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-800 flex items-center justify-center font-bold">
              <Stethoscope className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Piket Poskestren &amp; UKS Santri
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Catat santri yang mengeluhkan sakit ringan (demam, pusing, luka) dan catat obat pertolongan pertama yang diberikan di Poskestren.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateToKesehatan}
            leftIcon={<Stethoscope className="h-4 w-4 text-[#0E7C3A]" />}
          >
            Buka Catatan Poskestren
          </Button>
        </Card>
      </div>
    </div>
  );
}
