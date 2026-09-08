import React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Check, X, ArrowUpRight, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface DashboardMusyrifKesantrianProps {
  izinList: Array<{
    id: string;
    kodeIzin: string;
    santriNama: string;
    kelas: string;
    jenis: string;
    durasi: string;
    alasan: string;
    status: string;
    diverifikasiOleh: string;
  }>;
  onApproveIzin: (id: string, isEskalasi: boolean) => void;
  onRejectIzin: (id: string) => void;
  onNavigateToDisiplin: () => void;
  onNavigateToPresensi?: () => void;
  isPending?: boolean;
}

export function DashboardMusyrifKesantrian({
  izinList,
  onApproveIzin,
  onRejectIzin,
  onNavigateToDisiplin,
  onNavigateToPresensi,
  isPending = false,
}: DashboardMusyrifKesantrianProps) {
  const pendingIzin = izinList.filter((i) => i.status === "MENUNGGU_MK");
  const approvedIzin = izinList.filter((i) => i.status === "DISETUJUI");
  const escalatedIzin = izinList.filter((i) => i.status === "MENUNGGU_KS");

  return (
    <div className="space-y-6">
      {/* 1. KPI Kesantrian */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Santri Asrama"
          value="45 Santri"
          description="Gedung Ali & Utsman"
          icon={<ShieldCheck className="h-5 w-5" />}
          badgeText="Kapasitas 100%"
          badgeVariant="green"
        />
        <StatCard
          title="Menunggu Persetujuan"
          value={`${pendingIzin.length} Permohonan`}
          description="Antrian verifikasi MK"
          icon={<Send className="h-5 w-5" />}
          badgeText={pendingIzin.length > 0 ? "Perlu Tindakan" : "Nihil"}
          badgeVariant={pendingIzin.length > 0 ? "menunggu" : "green"}
        />
        <StatCard
          title="Izin Aktif Disetujui"
          value={`${approvedIzin.length} Santri`}
          description="Sedang di luar / izin"
          icon={<ArrowUpRight className="h-5 w-5" />}
          badgeText="Terkontrol"
          badgeVariant="sky"
        />
        <StatCard
          title="Eskalasi ke Mudir"
          value={`${escalatedIzin.length} Berkas`}
          description="Izin Menginap / Pulang"
          icon={<AlertTriangle className="h-5 w-5" />}
          badgeText="Hierarki KS"
          badgeVariant="orange"
        />
      </div>

      {/* 2. Antrian Verifikasi Izin Santri */}
      <Card rounded="3xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-[#0E7C3A]" />
              Antrian Persetujuan Izin Santri Berjenjang
            </CardTitle>
            <CardDescription>
              Izin LOKAL disahkan langsung oleh MK. Izin PULANG/LUAR KOTA dieskalasi ke Mudir (KS).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToPresensi && (
              <Button
                variant="primary"
                size="sm"
                onClick={onNavigateToPresensi}
                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                Presensi Shalat &amp; Halaqoh
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToDisiplin}
              leftIcon={<AlertTriangle className="h-3.5 w-3.5 text-amber-700" />}
            >
              Kedisiplinan &amp; SP
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {izinList.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">Belum ada data perizinan santri.</p>
          ) : (
            izinList.map((iz) => {
              const isMenungguMK = iz.status === "MENUNGGU_MK";
              const isPulang = iz.jenis === "PULANG" || iz.jenis === "KELUAR_KOTA";

              return (
                <div
                  key={iz.id}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors space-y-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600 font-bold">{iz.kodeIzin}</span>
                      <span className="font-bold text-slate-900 text-sm">{iz.santriNama}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">Kelas {iz.kelas}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={iz.jenis === "SAKIT" ? "orange" : "sky"} size="sm">
                        {iz.jenis} ({iz.durasi})
                      </Badge>
                      <Badge
                        variant={
                          iz.status === "DISETUJUI"
                            ? "disetujui"
                            : iz.status === "MENUNGGU_MK"
                            ? "menunggu"
                            : iz.status === "MENUNGGU_KS"
                            ? "sp1"
                            : "ditolak"
                        }
                        size="sm"
                      >
                        {iz.status}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                    &ldquo;{iz.alasan}&rdquo;
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      Verifikasi: <strong>{iz.diverifikasiOleh}</strong>
                    </span>

                    {isMenungguMK && (
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isPending}
                          onClick={() => onRejectIzin(iz.id)}
                          leftIcon={<X className="h-3.5 w-3.5 text-rose-600" />}
                          className="text-xs h-8 px-2.5"
                        >
                          Tolak
                        </Button>

                        {isPulang ? (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isPending}
                            onClick={() => onApproveIzin(iz.id, true)}
                            leftIcon={<ArrowUpRight className="h-3.5 w-3.5" />}
                            className="text-xs h-8 px-3"
                          >
                            Setujui &amp; Eskalasi ke Mudir
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isPending}
                            onClick={() => onApproveIzin(iz.id, false)}
                            leftIcon={<Check className="h-3.5 w-3.5" />}
                            className="text-xs h-8 px-3"
                          >
                            Sahkan Izin Lokal
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
