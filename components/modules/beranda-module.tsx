"use client";

import React from "react";
import { Role, ROLE_LABELS } from "@/types/auth";
import { AppNavId } from "@/types/navigation";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookCheck,
  CheckCircle2,
  Send,
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  GraduationCap,
  Sparkles,
  DollarSign,
  HeartHandshake,
} from "lucide-react";

export interface DashboardSantriSummary {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  halaqoh: string;
  capaianJuz: number;
  targetJuz: number;
  setoranTerakhir: string;
  status: string;
  nilaiTerakhir: string;
  poinPelanggaran: number;
  namaWali?: string | null;
  noHpWali?: string | null;
  totalHalaman?: number;
  modalHalamanAwal?: number;
  modalHafalanAwalHalaman?: number;
  tanggalBaselineTahfizh?: string | null;
  tambahanSabaq?: number;
  totalHafalan?: number;
  posisiTerakhirHalaman?: number;
  isHalamanTerakhirParsial?: boolean;
  bintangKebaikan?: number;
}

export interface BerandaModuleProps {
  userRole: Role;
  userName: string;
  currentHalaqohName?: string | null;
  santriList: DashboardSantriSummary[];
  izinPendingCount: number;
  ikhtibarPendingCount: number;
  santriSakitCount: number;
  onNavigate: (tab: AppNavId) => void;
  onOpenSetoranQuick?: () => void;
}

export function BerandaModule({
  userRole,
  userName,
  currentHalaqohName,
  santriList,
  izinPendingCount,
  ikhtibarPendingCount,
  santriSakitCount,
  onNavigate,
  onOpenSetoranQuick,
}: BerandaModuleProps) {
  const roleInfo = ROLE_LABELS[userRole] || {
    title: "Pengguna",
    badgeVariant: "neutral",
  };

  // Hitung metrik esensial (maksimal 4 kartu)
  const totalSantri = santriList.length;
  const santriAktif = santriList.filter((s) => s.status === "AKTIF").length;
  const avgCapaian = totalSantri > 0
    ? (santriList.reduce((acc, s) => acc + s.capaianJuz, 0) / totalSantri).toFixed(1)
    : "0";
  const santriSpCount = santriList.filter((s) => s.poinPelanggaran >= 20).length;

  return (
    <div className="space-y-6">
      {/* 1. Sambutan Singkat & Hangat (Hanya di Beranda!) */}
      <div className="bg-gradient-to-r from-[#0E7C3A] via-[#0A6830] to-[#0E7C3A] text-white rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute -right-8 -top-8 w-60 h-60 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-emerald-100 backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-[#C9990E]" />
            <span>Portal Pendidikan Pesantren STQ DUC</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-heading text-white flex items-center gap-2 flex-wrap min-h-[36px]">
            <span>Assalamu&apos;alaikum</span>
            {userName && !userName.startsWith("Memuat") ? (
              <span>, {userName.split(" ")[0]}</span>
            ) : (
              <span className="inline-block h-7 w-28 bg-white/20 animate-pulse rounded-lg align-middle" />
            )}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
            Anda masuk sebagai <strong>{roleInfo.title}</strong> di{" "}
            {INSTITUTION_CONFIG.schoolName} ({INSTITUTION_CONFIG.yayasanName}).
            {currentHalaqohName && ` Mengampu ${currentHalaqohName}.`}
          </p>
        </div>

        {/* Shortcut CTA Cepat di Banner */}
        <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2.5">
          {["MT", "PH", "KS"].includes(userRole) && (
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                if (onOpenSetoranQuick) onOpenSetoranQuick();
                onNavigate("tahfizh");
              }}
              className="gap-2 font-bold shadow-xs text-xs sm:text-sm min-h-[44px]"
            >
              <BookCheck className="h-4 w-4" />
              Catat Setoran
            </Button>
          )}
          {["MK", "PH", "KS"].includes(userRole) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate("presensi")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 gap-2 font-bold text-xs sm:text-sm min-h-[44px]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Isi Presensi
            </Button>
          )}
          {userRole === "GA" && (
            <Button
              variant="gold"
              size="sm"
              onClick={() => onNavigate("akademik")}
              className="gap-2 font-bold shadow-xs text-xs sm:text-sm min-h-[44px]"
            >
              <GraduationCap className="h-4 w-4" />
              Input Nilai
            </Button>
          )}
        </div>
      </div>

      {/* 2. Maksimal 4 Indikator Utama Relevan (KPI) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Santri Binaan */}
        <StatCard
          title={currentHalaqohName ? "Santri Binaan" : "Total Santri"}
          value={`${totalSantri} Santri`}
          description={`${santriAktif} santri berstatus aktif`}
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          badgeVariant="green"
        />

        {/* KPI 2: Rata-rata Hafalan */}
        <StatCard
          title="Rata-rata Hafalan"
          value={`${avgCapaian} Juz`}
          description="Target kelulusan: 30 Juz Mutqin"
          icon={<BookCheck className="h-5 w-5 text-amber-600" />}
          badgeVariant="gold"
        />

        {/* KPI 3: Antrean Tugas / Izin */}
        <StatCard
          title="Izin Menunggu"
          value={`${izinPendingCount} Berkas`}
          description="Perlu verifikasi & pengesahan"
          icon={<Send className="h-5 w-5 text-sky-600" />}
          badgeVariant={izinPendingCount > 0 ? "orange" : "sky"}
        />

        {/* KPI 4: Disiplin & Kesehatan */}
        <StatCard
          title="Perlu Perhatian"
          value={`${santriSpCount + santriSakitCount} Kasus`}
          description={`${santriSpCount} SP aktif • ${santriSakitCount} dirawat`}
          icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
          badgeVariant={santriSpCount + santriSakitCount > 0 ? "ditolak" : "sky"}
        />
      </div>

      {/* 3. Pekerjaan & Persetujuan Yang Perlu Ditindaklanjuti (Task Queue) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Kolom Kiri & Tengah: Antrean Tindak Lanjut */}
        <div className="lg:col-span-2 space-y-4">
          <Card rounded="3xl">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 font-heading">
                    Tugas &amp; Antrean Tindak Lanjut
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Aktivitas operasional yang memerlukan tindakan Anda hari ini
                  </CardDescription>
                </div>
                <Badge variant={izinPendingCount > 0 ? "orange" : "green"} size="sm">
                  {izinPendingCount + ikhtibarPendingCount > 0
                    ? `${izinPendingCount + ikhtibarPendingCount} Tugas Aktif`
                    : "Semua Tuntas"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {/* Item 1: Izin Pulang / Keluar */}
              {izinPendingCount > 0 ? (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {izinPendingCount} Permohonan Izin Menunggu Persetujuan
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Santri mengajukan izin pulang/keluar yang membutuhkan validasi.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onNavigate("perizinan")}
                    className="shrink-0 text-xs font-bold gap-1 min-h-[38px]"
                  >
                    Buka Perizinan
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-[#0E7C3A] shrink-0" />
                  <span>Tidak ada permohonan izin santri yang tertunda.</span>
                </div>
              )}

              {/* Item 2: Ikhtibar Munaqasyah */}
              {ikhtibarPendingCount > 0 ? (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-800 shrink-0">
                      <BookCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {ikhtibarPendingCount} Antrean Ujian Ikhtibar Tahfizh
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Santri telah menyelesaikan juz dan siap diuji kelulusan.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onNavigate("tahfizh")}
                    className="shrink-0 text-xs font-bold gap-1 min-h-[38px]"
                  >
                    Uji Santri
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-[#0E7C3A] shrink-0" />
                  <span>Tidak ada antrean ujian ikhtibar saat ini.</span>
                </div>
              )}

              {/* Item 3: Presensi Harian */}
              {["MT", "PH", "MK", "KS"].includes(userRole) && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Presensi Sholat &amp; Halaqoh Hari Ini
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Pastikan seluruh santri telah diverifikasi kehadirannya di sesi berjalan.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onNavigate("presensi")}
                    className="shrink-0 text-xs font-bold gap-1 min-h-[38px]"
                  >
                    Buka Presensi
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Akses Cepat ke Fungsi Utama (Shortcuts) */}
        <div className="space-y-4">
          <Card rounded="3xl">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 font-heading">
                Akses Cepat Modul
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pintasan langsung ke menu kerja Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-3">
              <button
                type="button"
                onClick={() => onNavigate("tahfizh")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition-all text-left group min-h-[48px]"
              >
                <div className="flex items-center gap-2.5">
                  <BookCheck className="h-4 w-4 text-[#0E7C3A]" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                    Modul Tahfizh &amp; Laporan
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("presensi")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition-all text-left group min-h-[48px]"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0E7C3A]" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                    Presensi Sholat &amp; Halaqoh
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("perizinan")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition-all text-left group min-h-[48px]"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-sky-900">
                    Perizinan &amp; Antrean Santri
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-700 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("data_santri")}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition-all text-left group min-h-[48px]"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900">
                    Master Data Santri
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-700 transition-transform group-hover:translate-x-0.5" />
              </button>

              {["KS", "ADM", "YAY"].includes(userRole) && (
                <button
                  type="button"
                  onClick={() => onNavigate("anggaran")}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition-all text-left group min-h-[48px]"
                >
                  <div className="flex items-center gap-2.5">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                      Anggaran &amp; Kebutuhan
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              {["KS", "ADM", "YAY"].includes(userRole) && (
                <button
                  type="button"
                  onClick={() => onNavigate("sponsor")}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-200 transition-all text-left group min-h-[48px]"
                >
                  <div className="flex items-center gap-2.5">
                    <HeartHandshake className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-purple-900">
                      Orang Tua Asuh Beasiswa
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-700 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
