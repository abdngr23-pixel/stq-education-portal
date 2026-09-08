import React from "react";
import { SantriCard } from "@/components/ui/santri-card";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookCheck, Award, PlusCircle, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";

export interface DashboardMusyrifTahfizhProps {
  santriList: Array<{
    id: string;
    nis: string;
    nama: string;
    kelas: string;
    halaqoh: string;
    capaianJuz: number;
    targetJuz: number;
    setoranTerakhir: string;
    nilaiTerakhir: string;
    poinPelanggaran: number;
    bintangKebaikan?: number;
  }>;
  selectedSantriNis: string;
  onSelectSantriNis: (nis: string) => void;
  inputJenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR";
  onSetInputJenis: (jenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR") => void;
  jumlahHalaman?: string;
  onSetJumlahHalaman?: (hlm: string) => void;
  juz: string;
  onSetJuz: (juz: string) => void;
  surahMulai: string;
  onSetSurahMulai: (surah: string) => void;
  ayatMulai: string;
  onSetAyatMulai: (ayat: string) => void;
  surahSelesai: string;
  onSetSurahSelesai: (surah: string) => void;
  ayatSelesai: string;
  onSetAyatSelesai: (ayat: string) => void;
  nilai: "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF";
  onSetNilai: (nilai: "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF") => void;
  catatan: string;
  onSetCatatan: (catatan: string) => void;
  onSaveSetoran: () => void;
  onOpenLaporanBulanan?: () => void;
  halaqohName?: string;
  isPending?: boolean;
}

export function DashboardMusyrifTahfizh({
  santriList,
  selectedSantriNis,
  onSelectSantriNis,
  inputJenis,
  onSetInputJenis,
  jumlahHalaman = "1",
  onSetJumlahHalaman,
  juz,
  onSetJuz,
  surahMulai,
  onSetSurahMulai,
  ayatMulai,
  onSetAyatMulai,
  surahSelesai,
  onSetSurahSelesai,
  ayatSelesai,
  onSetAyatSelesai,
  nilai,
  onSetNilai,
  catatan,
  onSetCatatan,
  onSaveSetoran,
  onOpenLaporanBulanan,
  halaqohName,
  isPending = false,
}: DashboardMusyrifTahfizhProps) {
  const selectedSantri = santriList.find((s) => s.nis === selectedSantriNis) || santriList[0];

  return (
    <div className="space-y-6">
      {/* Tombol Akses Cepat Laporan Bulanan (Excel DUC Standard) */}
      {onOpenLaporanBulanan && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-emerald-50/80 border border-emerald-200/90 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-[#0E7C3A] text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-emerald-950 font-heading">
                Format Laporan Hafalan STQ Darul Ulum Cendekia (Excel)
              </h4>
              <p className="text-[11px] text-emerald-800">
                Standar konversi 20 Halaman/Juz, Matriks Pekanan P1-P4, Mutaba&apos;ah 7 Komponen, &amp; Ekspor CSV
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenLaporanBulanan}
            className="text-xs font-semibold bg-[#0E7C3A] hover:bg-[#0B642E]"
          >
            Buka Rekap Laporan Bulanan
          </Button>
        </div>
      )}

      {/* 1. KPI Metrik Tahfizh Hari Ini */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Santri Halaqoh"
          value={`${santriList.length} Santri`}
          description={halaqohName || "Kelompok Halaqoh Binaan"}
          icon={<BookCheck className="h-5 w-5" />}
          badgeText="Binaan Aktif"
          badgeVariant="green"
        />
        <StatCard
          title="Setoran Hari Ini"
          value={`${santriList.length} Masuk`}
          description="Sesi Shubuh & Ashar"
          icon={<CheckCircle2 className="h-5 w-5" />}
          badgeText="100% Tercatat"
          badgeVariant="green"
        />
        <StatCard
          title="Mutqin Rate"
          value="88%"
          description="Kelancaran Mumtaz/Jayyid"
          icon={<Award className="h-5 w-5" />}
          isAppreciation
          badgeText="Pencapaian"
          badgeVariant="gold"
        />
        <StatCard
          title="Ujian Ikhtibar"
          value="2 Santri"
          description="Siap diajukan ke Mudir"
          icon={<Award className="h-5 w-5" />}
          badgeText="Juz 29 & 30"
          badgeVariant="sky"
        />
      </div>

      {/* 2. Grid Dua Kolom: Form Input Cepat (Screen 2) & Daftar Santri (Screen 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Form Input Cepat Setoran (Lg: 7 col) */}
        <div className="lg:col-span-7">
          <Card rounded="3xl" className="border border-slate-200/90 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <BookCheck className="h-5 w-5 text-[#0E7C3A]" />
                    Form Input Cepat Setoran
                  </CardTitle>
                  <CardDescription>
                    Pencatatan ziyadah &amp; murojaah langsung saat halaqoh
                  </CardDescription>
                </div>
                <Badge variant="mumtaz" size="sm">
                  {inputJenis}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Pilihan Santri */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Pilih Santri Menyimak</label>
                <select
                  value={selectedSantriNis}
                  onChange={(e) => onSelectSantriNis(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                >
                  {santriList.map((s) => (
                    <option key={s.nis} value={s.nis}>
                      {s.nama} ({s.nis} - Kelas {s.kelas} - Capaian: {s.capaianJuz} Juz)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipe Setoran: Segmented Control (4 Jenis) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Jenis Setoran</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["SABAQ", "SABQI", "MANZIL", "MUFAR"] as const).map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => onSetInputJenis(j)}
                      className={`min-h-[44px] rounded-2xl text-xs font-bold border transition-all ${
                        inputJenis === j
                          ? "bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-2xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {j === "SABAQ"
                        ? "Sabaq (Baru)"
                        : j === "SABQI"
                        ? "Sabqi (Murojaah)"
                        : j === "MANZIL"
                        ? "Manzil (Lancar)"
                        : "Mufar (Khusus)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Jumlah Halaman jika Sabaq */}
              {inputJenis === "SABAQ" && onSetJumlahHalaman && (
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                  <Input
                    label="Jumlah Halaman Sabaq (Standar 20 Hlm/Juz)"
                    type="number"
                    value={jumlahHalaman}
                    onChange={(e) => onSetJumlahHalaman(e.target.value)}
                    placeholder="1"
                    className="bg-white"
                  />
                  <p className="text-[10px] text-emerald-800 mt-1">
                    Akumulasi halaman akan dikonversi ke format <em>&ldquo;X Juz Y Halaman&rdquo;</em> pada laporan bulanan.
                  </p>
                </div>
              )}

              {/* Parameter Ayat & Juz */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="Juz (1-30)"
                  type="number"
                  value={juz}
                  onChange={(e) => onSetJuz(e.target.value)}
                />
                <Input
                  label="Nama Surah"
                  value={surahMulai}
                  onChange={(e) => {
                    onSetSurahMulai(e.target.value);
                    onSetSurahSelesai(e.target.value);
                  }}
                />
                <Input
                  label="Ayat Dari"
                  type="number"
                  value={ayatMulai}
                  onChange={(e) => onSetAyatMulai(e.target.value)}
                />
                <Input
                  label="Ayat Sampai"
                  type="number"
                  value={ayatSelesai}
                  onChange={(e) => onSetAyatSelesai(e.target.value)}
                />
              </div>

              {/* Penilaian Kualitas Bacaan */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Penilaian Kualitas Bacaan (Tajwid &amp; Kelancaran)</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { key: "MUMTAZ", label: "Mumtaz" },
                      { key: "JAYYID_JIDDAN", label: "Jayyid Jiddan" },
                      { key: "JAYYID", label: "Jayyid" },
                      { key: "MAQBUL", label: "Maqbul" },
                      { key: "DHOIF", label: "Perlu Ulang" },
                    ] as const
                  ).map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => onSetNilai(k.key)}
                      className={`min-h-[44px] rounded-2xl text-xs font-bold border transition-all ${
                        nilai === k.key
                          ? "bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-2xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan Musyrif */}
              <Input
                label="Catatan Tajwid / Makharijul Huruf (Opsional)"
                value={catatan}
                onChange={(e) => onSetCatatan(e.target.value)}
                placeholder="misal: Dengung ikhfa di ayat 15 perlu diperpanjang 2 harakat"
              />
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                Santri: <strong className="text-slate-800">{selectedSantri.nama}</strong>
              </div>
              <Button
                variant="primary"
                isLoading={isPending}
                onClick={onSaveSetoran}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                Simpan Setoran
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Kolom Daftar Santri Halaqoh (Lg: 5 col) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              Santri {halaqohName || "Halaqoh"} ({santriList.length})
            </h3>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5 text-[#0E7C3A]" />}
              onClick={() =>
                exportToCSV(
                  "Rekap_Tahfizh_Halaqoh",
                  ["Nama Santri", "NIS", "Kelas", "Halaqoh", "Capaian Juz", "Target Juz", "Setoran Terakhir", "Nilai Terakhir"],
                  santriList.map((s) => [s.nama, s.nis, s.kelas, s.halaqoh, s.capaianJuz, s.targetJuz, s.setoranTerakhir, s.nilaiTerakhir])
                )
              }
            >
              Ekspor CSV
            </Button>
          </div>

          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {santriList.map((s) => {
              const isSelected = s.nis === selectedSantriNis;
              return (
                <SantriCard
                  key={s.nis}
                  nama={s.nama}
                  nis={s.nis}
                  kelas={s.kelas}
                  halaqoh={s.halaqoh}
                  capaianJuz={s.capaianJuz}
                  targetJuz={s.targetJuz}
                  setoranTerakhir={s.setoranTerakhir}
                  nilaiTerakhir={s.nilaiTerakhir}
                  poinPelanggaran={s.poinPelanggaran}
                  bintangKebaikan={s.bintangKebaikan}
                  highlight={isSelected}
                  onClick={() => onSelectSantriNis(s.nis)}
                  actionButton={
                    <Button
                      variant={isSelected ? "primary" : "secondary"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSantriNis(s.nis);
                      }}
                      leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                    >
                      {isSelected ? "Sedang Diisi" : "+ Setor"}
                    </Button>
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
