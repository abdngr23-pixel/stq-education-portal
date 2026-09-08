import React, { useState } from "react";
import { SantriCard } from "@/components/ui/santri-card";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookCheck, Award, PlusCircle, CheckCircle2, Download, FileSpreadsheet, Share2 } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { buildSetoranTahfizhWAMessage, buildProgressSantriWAMessage } from "@/lib/whatsapp";

export interface DashboardMusyrifTahfizhProps {
  santriList: Array<{
    id: string;
    nis: string;
    nama: string;
    kelas: string;
    halaqoh: string;
    namaWali?: string;
    noHpWali?: string;
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

  const [waDialog, setWaDialog] = useState<{
    isOpen: boolean;
    phone: string;
    recipientName: string;
    message: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    phone: "",
    recipientName: "Wali Santri",
    message: "",
    title: "Kirim Laporan via WhatsApp",
    description: "Kirim pesan resmi laporan santri langsung ke nomor WhatsApp wali.",
  });

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

            <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                Santri: <strong className="text-slate-800">{selectedSantri.nama}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const msg = buildSetoranTahfizhWAMessage({
                      santriNama: selectedSantri.nama,
                      santriNis: selectedSantri.nis,
                      kelas: selectedSantri.kelas,
                      namaWali: selectedSantri.namaWali,
                      noHpWali: selectedSantri.noHpWali,
                      jenisSetoran: inputJenis,
                      juz,
                      surah: surahMulai,
                      ayatMulai,
                      ayatSelesai,
                      nilai,
                      catatan,
                      jumlahHalaman: inputJenis === "SABAQ" ? jumlahHalaman : undefined,
                      pembinaNama: halaqohName || "Musyrif Tahfizh STQ DUC",
                    });
                    setWaDialog({
                      isOpen: true,
                      phone: selectedSantri.noHpWali || "",
                      recipientName: selectedSantri.namaWali || `Wali ${selectedSantri.nama}`,
                      message: msg,
                      title: `Kirim Laporan Setoran ke Wali ${selectedSantri.nama}`,
                      description: "Laporan setoran hari ini akan dibuka langsung di WhatsApp resmi Anda.",
                    });
                  }}
                  className="bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 font-bold"
                  leftIcon={
                    <svg className="h-4 w-4 fill-current text-[#25D366]" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                  }
                >
                  Kirim WA Wali
                </Button>
                <Button
                  variant="primary"
                  isLoading={isPending}
                  onClick={onSaveSetoran}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                >
                  Simpan Setoran
                </Button>
              </div>
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
                  onShareWA={() => {
                    const msg = buildProgressSantriWAMessage({
                      santriNama: s.nama,
                      santriNis: s.nis,
                      kelas: s.kelas,
                      halaqoh: s.halaqoh,
                      namaWali: s.namaWali,
                      noHpWali: s.noHpWali,
                      capaianJuz: s.capaianJuz,
                      targetJuz: s.targetJuz,
                      setoranTerakhir: s.setoranTerakhir,
                      nilaiTerakhir: s.nilaiTerakhir,
                      pembinaNama: halaqohName || "Musyrif Tahfizh STQ DUC",
                    });
                    setWaDialog({
                      isOpen: true,
                      phone: s.noHpWali || "",
                      recipientName: s.namaWali || `Wali ${s.nama}`,
                      message: msg,
                      title: `Kirim Progres Hafalan ${s.nama}`,
                      description: "Ringkasan capaian juz dan hafalan santri akan dikirim via WhatsApp.",
                    });
                  }}
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

      {/* Modal Dialog WhatsApp Direct */}
      <WhatsAppDialog
        isOpen={waDialog.isOpen}
        onClose={() => setWaDialog((prev) => ({ ...prev, isOpen: false }))}
        defaultPhone={waDialog.phone}
        defaultRecipientName={waDialog.recipientName}
        defaultMessage={waDialog.message}
        title={waDialog.title}
        description={waDialog.description}
      />
    </div>
  );
}
