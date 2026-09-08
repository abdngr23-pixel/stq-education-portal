import React, { useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Award, Send, DollarSign, Check, Printer, FileSpreadsheet, Users } from "lucide-react";
import { RekapLaporanBulanan } from "./rekap-laporan-bulanan";
import { ManajemenHalaqoh } from "./manajemen-halaqoh";

export interface DashboardMudirKSProps {
  totalSantri: number;
  izinEskalasiList: Array<{
    id: string;
    kodeIzin: string;
    santriNama: string;
    kelas: string;
    jenis: string;
    durasi: string;
    alasan: string;
    status: string;
  }>;
  ikhtibarTahap2List: Array<{
    id: string;
    santri: string;
    nis: string;
    juz: number;
    status: string;
    nilaiTahap1?: number | null;
  }>;
  pengajuanAnggaranList: Array<{
    id: string;
    nomor: string;
    pemohon: string;
    keperluan: string;
    nominal: number;
    status: string;
  }>;
  halaqohList?: Array<{
    id: string;
    halaqohCode: string;
    nama: string;
    pembina?: { id: string; nama: string; staffCode?: string } | null;
    tahunAjaran: string;
    _count?: { santriList: number };
  }>;
  staffMusyrifList?: Array<{ id: string; nama: string; staffCode: string }>;
  santriList?: Array<{ id: string; nis: string; nama: string; halaqohId?: string | null }>;
  onApproveIzinPulang: (id: string) => void;
  onSahkanIkhtibar: (id: string) => void;
  onApproveAnggaran: (id: string) => void;
  onPrintLaporan: () => void;
  isPending?: boolean;
}

export function DashboardMudirKS({
  totalSantri,
  izinEskalasiList,
  ikhtibarTahap2List,
  pengajuanAnggaranList,
  halaqohList = [],
  staffMusyrifList = [],
  santriList = [],
  onApproveIzinPulang,
  onSahkanIkhtibar,
  onApproveAnggaran,
  onPrintLaporan,
  isPending = false,
}: DashboardMudirKSProps) {
  const [activeTab, setActiveTab] = useState<"keputusan" | "laporan_bulanan" | "manajemen_halaqoh">("keputusan");
  const pendingIzin = izinEskalasiList.filter((i) => i.status === "MENUNGGU_KS");
  const pendingIkhtibar = ikhtibarTahap2List.filter((i) => i.status === "LULUS_TAHAP_1");
  const pendingAnggaran = pengajuanAnggaranList.filter((a) => a.status === "MENUNGGU_MUDIR");

  return (
    <div className="space-y-6">
      {/* 1. Eksekutif KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Santri Aktif"
          value={`${totalSantri} Santri`}
          description="Takhossus Tahfizh Qur'an"
          icon={<ShieldCheck className="h-5 w-5" />}
          badgeText="100% Berasrama"
          badgeVariant="green"
        />
        <StatCard
          title="Eskalasi Izin Pulang"
          value={`${pendingIzin.length} Permohonan`}
          description="Memerlukan persetujuan Mudir"
          icon={<Send className="h-5 w-5" />}
          badgeText={pendingIzin.length > 0 ? "Perlu Respon" : "Selesai"}
          badgeVariant={pendingIzin.length > 0 ? "menunggu" : "green"}
        />
        <StatCard
          title="Pengesahan Ikhtibar"
          value={`${pendingIkhtibar.length} Santri`}
          description="Lulus Tahap 1 Musyrif"
          icon={<Award className="h-5 w-5" />}
          isAppreciation
          badgeText="Munaqasyah Juz"
          badgeVariant="gold"
        />
        <StatCard
          title="Pengajuan Anggaran"
          value={`${pendingAnggaran.length} Berkas`}
          description="Operasional Lembaga"
          icon={<DollarSign className="h-5 w-5" />}
          badgeText="Persetujuan Biaya"
          badgeVariant="orange"
        />
      </div>

      {/* 2. Subtab Navigasi Eksekutif Mudir */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("keputusan")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "keputusan"
                ? "bg-[#0E7C3A] text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Pusat Keputusan &amp; Approval
          </button>
          <button
            onClick={() => setActiveTab("laporan_bulanan")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "laporan_bulanan"
                ? "bg-[#0E7C3A] text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Laporan Bulanan (Excel Format)
          </button>
          <button
            onClick={() => setActiveTab("manajemen_halaqoh")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "manajemen_halaqoh"
                ? "bg-[#0E7C3A] text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="h-4 w-4" />
            Penugasan Halaqoh
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onPrintLaporan}
          leftIcon={<Printer className="h-4 w-4 text-[#0E7C3A]" />}
          className="text-xs font-semibold mr-1"
        >
          Cetak Dokumen A4
        </Button>
      </div>

      {activeTab === "laporan_bulanan" && (
        <RekapLaporanBulanan
          userRole="KS"
          halaqohList={halaqohList.map((h) => ({ id: h.id, nama: h.nama }))}
        />
      )}

      {activeTab === "manajemen_halaqoh" && (
        <ManajemenHalaqoh
          halaqohList={halaqohList}
          staffMusyrifList={staffMusyrifList}
          santriList={santriList}
        />
      )}

      {activeTab === "keputusan" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Antrian 1: Eskalasi Izin Pulang */}
        <Card rounded="3xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Send className="h-4 w-4 text-[#0E7C3A]" /> Izin Pulang
              </span>
              <Badge variant="menunggu" size="sm">{pendingIzin.length} Berkas</Badge>
            </CardTitle>
            <CardDescription>Persetujuan akhir santri keluar kota / pulang</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {pendingIzin.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Tidak ada antrian izin eskalasi.</p>
            ) : (
              pendingIzin.map((iz) => (
                <div key={iz.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{iz.santriNama} ({iz.kelas})</span>
                    <Badge variant="orange" size="sm">{iz.durasi}</Badge>
                  </div>
                  <p className="text-slate-600 italic">&ldquo;{iz.alasan}&rdquo;</p>
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={isPending}
                    onClick={() => onApproveIzinPulang(iz.id)}
                    leftIcon={<Check className="h-3.5 w-3.5" />}
                    className="text-xs h-8"
                  >
                    Sahkan Izin Mudir
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Antrian 2: Pengesahan Ikhtibar Tahap 2 */}
        <Card rounded="3xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-[#A87E0B]" /> Ujian Ikhtibar
              </span>
              <Badge variant="gold" size="sm">{pendingIkhtibar.length} Siap Diuji</Badge>
            </CardTitle>
            <CardDescription>Pengesahan Munaqasyah Juz santri</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {pendingIkhtibar.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Semua ikhtibar telah tuntas disahkan.</p>
            ) : (
              pendingIkhtibar.map((ikh) => (
                <div key={ikh.id} className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{ikh.santri}</span>
                    <Badge variant="gold" size="sm">Juz {ikh.juz}</Badge>
                  </div>
                  <p className="text-slate-600">
                    Nilai Tahap 1 Musyrif: <strong>{ikh.nilaiTahap1 || 90}</strong> (Lulus)
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={isPending}
                    onClick={() => onSahkanIkhtibar(ikh.id)}
                    leftIcon={<Check className="h-3.5 w-3.5" />}
                    className="text-xs h-8"
                  >
                    Sahkan Kelulusan Juz
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Antrian 3: Persetujuan Anggaran */}
        <Card rounded="3xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-[#0E7C3A]" /> Anggaran Dana
              </span>
              <Badge variant="orange" size="sm">{pendingAnggaran.length} Pengajuan</Badge>
            </CardTitle>
            <CardDescription>Otorisasi pencairan dana operasional TU</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {pendingAnggaran.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Tidak ada pengajuan anggaran menunggu.</p>
            ) : (
              pendingAnggaran.map((ang) => (
                <div key={ang.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{ang.pemohon}</span>
                    <span className="font-mono font-bold text-[#0E7C3A]">
                      Rp {ang.nominal.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="text-slate-600">&ldquo;{ang.keperluan}&rdquo;</p>
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={isPending}
                    onClick={() => onApproveAnggaran(ang.id)}
                    leftIcon={<Check className="h-3.5 w-3.5" />}
                    className="text-xs h-8"
                  >
                    Setujui Pencairan Dana
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
