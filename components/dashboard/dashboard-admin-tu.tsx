import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, Users, UserCog, PlusCircle } from "lucide-react";

export interface DashboardAdminTUProps {
  totalSantri: number;
  totalUsers: number;
  onNavigateToSantri?: () => void;
  onNavigateToSurat: () => void;
  onNavigateToAnggaran: () => void;
  onNavigateToUsers: () => void;
}

export function DashboardAdminTU({
  totalSantri,
  totalUsers,
  onNavigateToSantri,
  onNavigateToSurat,
  onNavigateToAnggaran,
  onNavigateToUsers,
}: DashboardAdminTUProps) {
  return (
    <div className="space-y-6">
      {/* 1. KPI Tata Usaha */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={onNavigateToSantri}
          className="cursor-pointer transition-transform hover:-translate-y-0.5"
        >
          <StatCard
            title="Master Data Santri"
            value={`${totalSantri} Santri`}
            description="Klik untuk Buka Direktori"
            icon={<Users className="h-5 w-5" />}
            badgeText="57 Santri"
            badgeVariant="green"
            accentBorder
          />
        </div>
        <StatCard
          title="Akun Pengguna"
          value={`${totalUsers} Akun`}
          description="10 Role Aktif"
          icon={<UserCog className="h-5 w-5" />}
          badgeText="Terkontrol"
          badgeVariant="green"
        />
        <StatCard
          title="Arsip Surat Keluar"
          value="24 Berkas"
          description="Surat Keterangan &amp; SP"
          icon={<FileText className="h-5 w-5" />}
          badgeText="Terdokumentasi"
          badgeVariant="sky"
        />
        <StatCard
          title="Pengajuan Anggaran"
          value="3 Berkas"
          description="Operasional Bulan Ini"
          icon={<DollarSign className="h-5 w-5" />}
          badgeText="Terkonfirmasi"
          badgeVariant="orange"
        />
      </div>

      {/* 2. Menu Aksi Cepat Administrasi Lembaga */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4 border-2 border-emerald-200 bg-emerald-50/40">
          <div className="space-y-1.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center font-bold">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Direktori Data Santri
            </h4>
            <p className="text-xs text-slate-500">
              Kelola 57 data santri aktif, pencarian NIS/nama, filter halaqoh/kelas, dan ekspor CSV.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToSantri}
            leftIcon={<Users className="h-4 w-4" />}
            className="bg-[#0E7C3A] hover:bg-[#0B642E]"
          >
            Buka Data Santri
          </Button>
        </Card>
        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center font-bold">
              <FileText className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Administrasi &amp; Surat AI
            </h4>
            <p className="text-xs text-slate-500">
              Terbitkan surat keterangan aktif, pengantar, atau surat peringatan formal standar A4.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToSurat}
            leftIcon={<PlusCircle className="h-4 w-4" />}
          >
            Buat Surat Resmi
          </Button>
        </Card>

        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center font-bold">
              <DollarSign className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Pengajuan Anggaran Biaya
            </h4>
            <p className="text-xs text-slate-500">
              Formulir pengajuan dana operasional asrama dan kegiatan halaqoh ke Mudir.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateToAnggaran}
            leftIcon={<PlusCircle className="h-4 w-4 text-[#0E7C3A]" />}
          >
            Ajukan Anggaran
          </Button>
        </Card>

        <Card rounded="3xl" className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center font-bold">
              <UserCog className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm font-heading">
              Kelola Akun &amp; Kata Sandi
            </h4>
            <p className="text-xs text-slate-500">
              Aktivasi akun ustaz, wali santri, dan reset kata sandi mandiri terpadu.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateToUsers}
            leftIcon={<Users className="h-4 w-4 text-[#0E7C3A]" />}
          >
            Kelola Pengguna
          </Button>
        </Card>
      </div>
    </div>
  );
}
