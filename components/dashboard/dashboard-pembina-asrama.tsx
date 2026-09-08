import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ShieldCheck, Home, AlertTriangle, PlusCircle } from "lucide-react";

export interface DashboardPembinaAsramaProps {
  totalSantri: number;
  onNavigateToBintang: () => void;
  onNavigateToDisiplin: () => void;
  onNavigateToLogistik: () => void;
  onNavigateToPresensi?: () => void;
}

export function DashboardPembinaAsrama({
  totalSantri,
  onNavigateToBintang,
  onNavigateToDisiplin,
  onNavigateToLogistik,
  onNavigateToPresensi,
}: DashboardPembinaAsramaProps) {
  return (
    <div className="space-y-6">
      {/* 1. KPI Asrama & Kedisiplinan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Santri Asrama"
          value={`${totalSantri} Santri`}
          description="Gedung Ali &amp; Utsman"
          icon={<Home className="h-5 w-5" />}
          badgeText="Kamar Terisi"
          badgeVariant="green"
        />
        <StatCard
          title="Bintang Kebaikan"
          value="48 Bintang"
          description="Apresiasi Pekan Ini"
          icon={<Star className="h-5 w-5" />}
          isAppreciation
          badgeText="Apresiasi Positif"
          badgeVariant="gold"
        />
        <div
          onClick={onNavigateToPresensi}
          className={onNavigateToPresensi ? "cursor-pointer transition-transform hover:scale-[1.02]" : ""}
          role="button"
          tabIndex={0}
        >
          <StatCard
            title="Ketertiban Shalat"
            value="96%"
            description="Disiplin Bangun &amp; Shalat"
            icon={<ShieldCheck className="h-5 w-5" />}
            badgeText={onNavigateToPresensi ? "Presensi ➜" : "Kondusif"}
            badgeVariant="green"
          />
        </div>
        <StatCard
          title="Pelanggaran Ringan"
          value="2 Kasus"
          description="Keterlambatan Halaqoh"
          icon={<AlertTriangle className="h-5 w-5" />}
          badgeText="Dalam Pembinaan"
          badgeVariant="orange"
        />
      </div>

      {/* 2. Dua Kolom Aksi Pembina */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card rounded="3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-[#C9990E] fill-[#C9990E]" />
                Program Apresiasi Bintang Kebaikan
              </CardTitle>
              <CardDescription>
                Pemberian poin bintang untuk santri yang berinisiatif dan beradab mulia
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToBintang}
              leftIcon={<PlusCircle className="h-4 w-4 text-[#A87E0B]" />}
            >
              + Beri Bintang
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3 text-xs">
            <p className="text-slate-600">
              Santri yang mengumpulkan 10 Bintang Kebaikan dalam sebulan berhak memperoleh piagam penghargaan teladan dari Mudir Pesantren.
            </p>
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
              <span className="font-bold text-amber-950">Indikator Perolehan Bintang:</span>
              <ul className="list-disc list-inside text-amber-900 space-y-0.5">
                <li>Muadzin shalat rawatib tepat waktu (+1 Bintang)</li>
                <li>Merapikan masjid dan aula tanpa diminta (+1 Bintang)</li>
                <li>Membantu santri junior dalam murojaah tajwid (+1 Bintang)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card rounded="3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0E7C3A]" />
                Pemantauan Tata Tertib &amp; Inventaris
              </CardTitle>
              <CardDescription>
                Pengawasan kamar santri dan mutasi perlengkapan asrama
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToLogistik}
            >
              Cek Logistik
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3 text-xs">
            <p className="text-slate-600">
              Evaluasi kebersihan kamar santri dilakukan setiap hari Ahad pagi bersama perwakilan santri (OSDA).
            </p>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Catat Pelanggaran Kedisiplinan</p>
                <p className="text-[11px] text-slate-500">Pemberlakuan doubling poin sanksi x2 jika pengulangan</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={onNavigateToDisiplin}
                className="text-xs h-8"
              >
                Form Disiplin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
