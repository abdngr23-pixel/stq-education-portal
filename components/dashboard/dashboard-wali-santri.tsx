import React from "react";
import { SantriCard } from "@/components/ui/santri-card";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookCheck, Star, Send, ShieldCheck, Printer, HeartHandshake } from "lucide-react";

export interface DashboardWaliSantriProps {
  santri: {
    nama: string;
    nis: string;
    kelas: string;
    halaqoh: string;
    capaianJuz: number;
    targetJuz: number;
    setoranTerakhir: string;
    nilaiTerakhir: string;
    poinPelanggaran: number;
    bintangKebaikan: number;
  };
  izinAktif?: {
    kodeIzin: string;
    jenis: string;
    durasi: string;
    alasan: string;
    status: string;
    diverifikasiOleh: string;
  } | null;
  nilaiAkademikList: Array<{
    mapel: string;
    kategori: string;
    angka: number;
    huruf: string;
    guru: string;
  }>;
  onPrintRapor: () => void;
  onNavigateToIzin: () => void;
}

export function DashboardWaliSantri({
  santri,
  izinAktif,
  nilaiAkademikList,
  onPrintRapor,
  onNavigateToIzin,
}: DashboardWaliSantriProps) {
  const rataRataNum =
    nilaiAkademikList.length > 0
      ? nilaiAkademikList.reduce((acc, curr) => acc + curr.angka, 0) /
        nilaiAkademikList.length
      : null;
  const rataRata = rataRataNum !== null ? rataRataNum.toFixed(1) : "Belum Ada Data";

  return (
    <div className="space-y-6">
      {/* 1. Header Ucapan & Kartu Profil Santri */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 font-heading">
            Perkembangan Ananda
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Pantauan hafalan Al-Qur&apos;an, perizinan, dan nilai akademik santri secara transparan
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrintRapor}
          leftIcon={<Printer className="h-4 w-4 text-[#0E7C3A]" />}
          className="self-start sm:self-auto"
        >
          Cetak Rapor A4
        </Button>
      </div>

      {/* 2. Kartu Santri Utama */}
      <SantriCard
        nama={santri.nama}
        nis={santri.nis}
        kelas={santri.kelas}
        halaqoh={santri.halaqoh}
        capaianJuz={santri.capaianJuz}
        targetJuz={santri.targetJuz}
        setoranTerakhir={santri.setoranTerakhir}
        nilaiTerakhir={santri.nilaiTerakhir}
        poinPelanggaran={santri.poinPelanggaran}
        bintangKebaikan={santri.bintangKebaikan}
        highlight
      />

      {/* 3. Ringkasan Metrik Kunci Ananda */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Hafalan Mutqin"
          value={`${santri.capaianJuz} Juz`}
          description="Capaian dari Target Akhir 30 Juz"
          icon={<BookCheck className="h-5 w-5" />}
          badgeText="Istiqomah"
          badgeVariant="green"
        />
        <StatCard
          title="Bintang Kebaikan"
          value={`${santri.bintangKebaikan} Bintang`}
          description="Apresiasi adab & ibadah"
          icon={<Star className="h-5 w-5" />}
          isAppreciation
          badgeText="Apresiasi"
          badgeVariant="gold"
        />
        <StatCard
          title="Rata-rata Nilai"
          value={rataRata}
          description="Akademik & Diniyah"
          icon={<ShieldCheck className="h-5 w-5" />}
          badgeText={rataRataNum !== null ? (rataRataNum >= 90 ? "Predikat A" : rataRataNum >= 80 ? "Predikat B" : "Predikat C") : "Belum Ada Nilai"}
          badgeVariant={rataRataNum !== null ? "green" : "neutral"}
        />
        <StatCard
          title="Status Izin Aktif"
          value={izinAktif ? izinAktif.jenis : "Di Asrama"}
          description={izinAktif ? izinAktif.durasi : "Tidak ada izin berjalan"}
          icon={<Send className="h-5 w-5" />}
          badgeText={izinAktif ? izinAktif.status : "Hadir"}
          badgeVariant={izinAktif ? "menunggu" : "disetujui"}
        />
      </div>

      {/* 4. Dua Kolom: Pratinjau Nilai Rapor & Status Izin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Kolom Kiri: Rapor Akademik Terkini */}
        <Card rounded="3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Rapor Akademik &amp; Diniyah</CardTitle>
              <CardDescription>Semester Ganjil 2026/2027</CardDescription>
            </div>
            <Badge variant="green" size="sm">Rata-rata {rataRata}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {nilaiAkademikList.map((n, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-800">{n.mapel}</p>
                  <p className="text-[11px] text-slate-500">{n.kategori} • {n.guru}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#0E7C3A]">{n.angka}</span>
                  <span className="text-[11px] text-slate-500 ml-1">({n.huruf})</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Kolom Kanan: Status Izin & Hubungi Pengurus */}
        <div className="space-y-4">
          <Card rounded="3xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Perizinan Santri</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onNavigateToIzin}
                  leftIcon={<Send className="h-3.5 w-3.5" />}
                >
                  Ajukan Izin Baru
                </Button>
              </CardTitle>
              <CardDescription>
                Alur perizinan berjenjang (Izin Lokal via MK, Pulang via Mudir/KS)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {izinAktif ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-900">{izinAktif.kodeIzin} ({izinAktif.jenis})</span>
                    <Badge variant="menunggu" size="sm">{izinAktif.status}</Badge>
                  </div>
                  <p className="text-slate-700 font-medium">Durasi: {izinAktif.durasi}</p>
                  <p className="text-slate-600 italic">&ldquo;{izinAktif.alasan}&rdquo;</p>
                  <p className="text-[11px] text-slate-500 mt-1">Verifikasi: {izinAktif.diverifikasiOleh}</p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1 text-xs">
                  <p className="font-medium text-slate-700">Ananda saat ini berada di asrama STQ</p>
                  <p className="text-slate-500">Tidak ada permohonan izin yang sedang berlangsung.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kotak Info Pembina Halaqoh */}
          <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-white text-[#0E7C3A] flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-bold text-emerald-950 font-heading">
                Musyrif Ketahfidzhan: Ust. Razan Mufli, S.Pd
              </p>
              <p className="text-emerald-800/90 text-[11px] mt-0.5">
                Murojaah terjadwal setiap ba&apos;da Shubuh &amp; Ashar di Masjid Utama STQ DUC.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
