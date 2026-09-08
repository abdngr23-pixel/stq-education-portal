"use client";

import React, { useState, useTransition } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { RekapLaporanBulanan } from "@/components/dashboard/rekap-laporan-bulanan";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createSetoranAction } from "@/app/actions/tahfizh";
import { inputHasilTahap1Action, inputHasilTahap2Action } from "@/app/actions/ikhtibar";
import { type LaporanBulananData } from "@/app/actions/laporan-bulanan";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { buildSetoranTahfizhWAMessage } from "@/lib/whatsapp";
import {
  BookCheck,
  Award,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  X,
  Check,
} from "lucide-react";

export interface TahfizhModuleProps {
  userRole: Role;
  currentUserName: string;
  currentHalaqohName?: string | null;
  santriList: DashboardSantriSummary[];
  halaqohList: Array<{ id: string; nama: string }>;
  initialOpenForm?: boolean;
  onPrintPreview?: (data: LaporanBulananData) => void;
}

export function TahfizhModule({
  userRole,
  currentUserName,
  currentHalaqohName,
  santriList,
  halaqohList,
  initialOpenForm = false,
  onPrintPreview,
}: TahfizhModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"setoran" | "laporan" | "ikhtibar">(
    initialOpenForm ? "setoran" : "setoran"
  );

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // -------------------------------------------------------------
  // FORM INPUT SETORAN TUNGGAL
  // -------------------------------------------------------------
  const [selectedSantriNis, setSelectedSantriNis] = useState<string>(
    santriList[0]?.nis || ""
  );
  const [inputJenis, setInputJenis] = useState<"SABAQ" | "SABQI" | "MANZIL" | "MUFAR">("SABAQ");
  const [juz, setJuz] = useState("30");
  const [jumlahHalaman, setJumlahHalaman] = useState("1");
  const [surahMulai, setSurahMulai] = useState("An-Naba'");
  const [ayatMulai, setAyatMulai] = useState("1");
  const [surahSelesai, setSurahSelesai] = useState("An-Naba'");
  const [ayatSelesai, setAyatSelesai] = useState("20");
  const [nilai, setNilai] = useState<"MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF">("MUMTAZ");
  const [catatan, setCatatan] = useState("");

  // Riwayat setoran lokal dalam memori (disinkronkan dengan server)
  const [recentSetoran, setRecentSetoran] = useState<Array<{
    id: string;
    santriNama: string;
    santriNis: string;
    kelas: string;
    jenis: string;
    juz: number;
    surah: string;
    ayat: string;
    nilai: string;
    tanggal: string;
  }>>([
    {
      id: "set-1",
      santriNama: santriList[0]?.nama || "Obama Ozearld",
      santriNis: santriList[0]?.nis || "SAN-0001",
      kelas: santriList[0]?.kelas || "9A",
      jenis: "SABAQ",
      juz: 22,
      surah: "Al-Ahzab",
      ayat: "1 - 35",
      nilai: "MUMTAZ",
      tanggal: "Hari Ini, 07:15 WITA",
    },
    {
      id: "set-2",
      santriNama: santriList[1]?.nama || "Muhammad Fardhan",
      santriNis: santriList[1]?.nis || "SAN-0002",
      kelas: santriList[1]?.kelas || "9A",
      jenis: "SABQI",
      juz: 16,
      surah: "An-Nahl",
      ayat: "50 - 80",
      nilai: "JAYYID_JIDDAN",
      tanggal: "Hari Ini, 07:40 WITA",
    },
  ]);

  // WhatsApp Dialog State
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
    title: "Kirim Laporan Setoran via WhatsApp",
    description: "Format laporan resmi DUC akan dikirimkan kepada wali santri.",
  });

  // Santri yang sedang dipilih
  const activeSantri = santriList.find((s) => s.nis === selectedSantriNis) || santriList[0];

  // Handler Simpan Setoran (Single source of truth)
  const handleSaveSetoran = () => {
    setFeedback(null);
    if (!["MT", "PH", "KS"].includes(userRole)) {
      setFeedback({ type: "error", message: `Role '${userRole}' tidak berhak input setoran tahfizh.` });
      return;
    }
    if (!activeSantri) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu." });
      return;
    }

    startTransition(async () => {
      const res = await createSetoranAction({
        santriId: activeSantri.id,
        jenis: inputJenis,
        juz: parseInt(juz) || 1,
        surahMulai,
        ayatMulai: parseInt(ayatMulai) || 1,
        surahSelesai,
        ayatSelesai: parseInt(ayatSelesai) || 1,
        nilai,
        catatan: inputJenis === "SABAQ" ? `hlm: ${jumlahHalaman}. ${catatan}` : catatan,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Alhamdulillah! Setoran ${inputJenis} untuk ${activeSantri.nama} (Juz ${juz}) berhasil disimpan di server.`,
        });

        // Tambah ke riwayat lokal
        setRecentSetoran((prev) => [
          {
            id: `set-${Date.now()}`,
            santriNama: activeSantri.nama,
            santriNis: activeSantri.nis,
            kelas: activeSantri.kelas,
            jenis: inputJenis,
            juz: parseInt(juz) || 1,
            surah: `${surahMulai} - ${surahSelesai}`,
            ayat: `${ayatMulai} - ${ayatSelesai}`,
            nilai,
            tanggal: "Baru saja",
          },
          ...prev,
        ]);

        // Siapkan pesan WA
        const waMsg = buildSetoranTahfizhWAMessage({
          santriNama: activeSantri.nama,
          santriNis: activeSantri.nis,
          kelas: activeSantri.kelas,
          pembinaNama: currentUserName,
          jenisSetoran: inputJenis,
          juz: parseInt(juz) || 1,
          surah: surahMulai === surahSelesai ? surahMulai : `${surahMulai} s/d ${surahSelesai}`,
          ayatMulai: parseInt(ayatMulai) || 1,
          ayatSelesai: parseInt(ayatSelesai) || 1,
          nilai,
          catatan,
          jumlahHalaman: inputJenis === "SABAQ" ? parseInt(jumlahHalaman) || 1 : undefined,
        });

        setWaDialog({
          isOpen: true,
          phone: "081299887766", // fallback jika kosong di UI
          recipientName: `Wali dari ${activeSantri.nama}`,
          message: waMsg,
          title: "Kirim Laporan Setoran ke Wali Santri",
          description: `Kirim laporan mutaba'ah setoran resmi untuk ${activeSantri.nama} via WhatsApp.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal menyimpan setoran. Silakan periksa kembali isian.",
        });
      }
    });
  };

  // -------------------------------------------------------------
  // TAB IKHTIBAR: ALUR NILAI UJIAN BERDASARKAN BARIS TERPILIH
  // -------------------------------------------------------------
  const [ikhtibarList, setIkhtibarList] = useState<Array<{
    id: string;
    santriNama: string;
    santriNis: string;
    santriId: string;
    kelas: string;
    juz: number;
    status: string;
    tahap: 1 | 2;
    penguji: string;
    nilai: number | null;
    catatan: string | null;
  }>>([
    {
      id: "ikh-1",
      santriNama: "Obama Ozearld Egberted Turizqi",
      santriNis: "SAN-0001",
      santriId: "cm_santri_1",
      kelas: "9A",
      juz: 22,
      status: "MENUNGGU_TAHAP_1",
      tahap: 1,
      penguji: "Ust. Razan Mufli, S.Pd",
      nilai: null,
      catatan: null,
    },
    {
      id: "ikh-2",
      santriNama: "Muhammad Fardhan",
      santriNis: "SAN-0002",
      santriId: "cm_santri_2",
      kelas: "9A",
      juz: 16,
      status: "LULUS_TAHAP_1",
      tahap: 2,
      penguji: "Mudir Pesantren (Ust. Andi Quarzy)",
      nilai: 92,
      catatan: "Tajwid & kelancaran sangat baik pada Tahap 1",
    },
    {
      id: "ikh-3",
      santriNama: "Muh. Fauzan",
      santriNis: "SAN-0003",
      santriId: "cm_santri_3",
      kelas: "9A",
      juz: 19,
      status: "LULUS_SEMPURNA_TAHAP_2",
      tahap: 2,
      penguji: "Mudir Pesantren",
      nilai: 95,
      catatan: "Disahkan Mudir Pesantren. Sah tuntas Juz 19.",
    },
  ]);

  const [gradingUjian, setGradingUjian] = useState<{
    id: string;
    santriNama: string;
    santriNis: string;
    juz: number;
    tahap: 1 | 2;
    penguji: string;
  } | null>(null);

  const [inputNilaiIkhtibar, setInputNilaiIkhtibar] = useState("90");
  const [inputCatatanIkhtibar, setInputCatatanIkhtibar] = useState("Kelancaran sangat baik, makhraj sempurna");

  const handleSimpanNilaiIkhtibar = () => {
    if (!gradingUjian) return;
    const numNilai = parseFloat(inputNilaiIkhtibar) || 0;
    const isLulus = numNilai >= 75;

    startTransition(async () => {
      let res;
      if (gradingUjian.tahap === 1) {
        res = await inputHasilTahap1Action({
          ikhtibarId: gradingUjian.id,
          nilai: numNilai,
          catatan: inputCatatanIkhtibar,
          lulus: isLulus,
        });
      } else {
        res = await inputHasilTahap2Action({
          ikhtibarId: gradingUjian.id,
          nilai: numNilai,
          catatan: inputCatatanIkhtibar,
          lulus: isLulus,
        });
      }

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Nilai ujian Juz ${gradingUjian.juz} untuk ${gradingUjian.santriNama} berhasil disimpan (${isLulus ? "LULUS" : "MENGULANG"}).`,
        });
        setIkhtibarList((prev) =>
          prev.map((item) =>
            item.id === gradingUjian.id
              ? {
                  ...item,
                  status: isLulus
                    ? gradingUjian.tahap === 1
                      ? "LULUS_TAHAP_1"
                      : "LULUS_SEMPURNA_TAHAP_2"
                    : "MENGULANG",
                  nilai: numNilai,
                  catatan: inputCatatanIkhtibar,
                }
              : item
          )
        );
        setGradingUjian(null);
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal menyimpan nilai ujian." });
      }
    });
  };

  // Pencarian riwayat setoran
  const [searchFilter, setSearchFilter] = useState("");
  const filteredRecentSetoran = recentSetoran.filter(
    (s) =>
      s.santriNama.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.santriNis.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Sub-Navigasi Tahfizh: Setoran | Laporan Bulanan | Ujian Ikhtibar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("setoran")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "setoran"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <BookCheck className="h-4 w-4" />
            Setoran Harian
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("laporan")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "laporan"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Rekap Bulanan DUC
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("ikhtibar")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "ikhtibar"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Award className="h-4 w-4" />
            Ujian Ikhtibar
          </button>
        </div>

        {currentHalaqohName && (
          <span className="hidden lg:inline text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {currentHalaqohName}
          </span>
        )}
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border flex items-start gap-3 text-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-[#0E7C3A] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{feedback.type === "success" ? "Berhasil" : "Perhatian"}</p>
            <p className="text-xs opacity-90 mt-0.5">{feedback.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
            aria-label="Tutup Notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. TAB 1: FORM INPUT SETORAN & RIWAYAT TERKINI */}
      {activeSubTab === "setoran" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Formulir Setoran Terpadu (Satu Lokasi Utama) */}
          <div className="lg:col-span-1">
            <Card rounded="3xl" className="border border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                  <BookCheck className="h-5 w-5 text-[#0E7C3A]" />
                  Catat Setoran Hafalan
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Input setoran sabaq, sabqi, manzil, atau mufar santri
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Pilih Santri */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nama Santri
                  </label>
                  <select
                    value={selectedSantriNis}
                    onChange={(e) => setSelectedSantriNis(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20"
                  >
                    {santriList.map((s) => (
                      <option key={s.nis} value={s.nis}>
                        {s.nama} ({s.kelas}) — {s.capaianJuz} Juz
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jenis Setoran */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Jenis Setoran
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["SABAQ", "SABQI", "MANZIL", "MUFAR"] as const).map((j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setInputJenis(j)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center min-h-[40px] ${
                          inputJenis === j
                            ? "bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {j === "SABAQ"
                          ? "Sabaq (Baru)"
                          : j === "SABQI"
                          ? "Sabqi (Muroja'ah Baru)"
                          : j === "MANZIL"
                          ? "Manzil (Muroja'ah Lama)"
                          : "Mufar"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Juz & Jumlah Halaman (Khusus Sabaq) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Juz (1 - 30)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={juz}
                      onChange={(e) => setJuz(e.target.value)}
                      className="min-h-[44px] font-semibold text-sm"
                    />
                  </div>
                  {inputJenis === "SABAQ" && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Jumlah Halaman
                      </label>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={jumlahHalaman}
                        onChange={(e) => setJumlahHalaman(e.target.value)}
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Surah & Ayat Mulai */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Surah Mulai
                    </label>
                    <Input
                      value={surahMulai}
                      onChange={(e) => setSurahMulai(e.target.value)}
                      placeholder="e.g. Al-Baqarah"
                      className="min-h-[44px] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Ayat Mulai
                    </label>
                    <Input
                      type="number"
                      value={ayatMulai}
                      onChange={(e) => setAyatMulai(e.target.value)}
                      className="min-h-[44px] text-sm"
                    />
                  </div>
                </div>

                {/* Surah & Ayat Selesai */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Surah Selesai
                    </label>
                    <Input
                      value={surahSelesai}
                      onChange={(e) => setSurahSelesai(e.target.value)}
                      className="min-h-[44px] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Ayat Selesai
                    </label>
                    <Input
                      type="number"
                      value={ayatSelesai}
                      onChange={(e) => setAyatSelesai(e.target.value)}
                      className="min-h-[44px] text-sm"
                    />
                  </div>
                </div>

                {/* Nilai Setoran */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Predikat Kelancaran
                  </label>
                  <select
                    value={nilai}
                    onChange={(e) =>
                      setNilai(
                        e.target.value as "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF"
                      )
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white"
                  >
                    <option value="MUMTAZ">Mumtaz (Istimewa / Sangat Lancar)</option>
                    <option value="JAYYID_JIDDAN">Jayyid Jiddan (Baik Sekali)</option>
                    <option value="JAYYID">Jayyid (Baik)</option>
                    <option value="MAQBUL">Maqbul (Cukup)</option>
                    <option value="DHOIF">Dhoif (Perlu Mengulang)</option>
                  </select>
                </div>

                {/* Catatan Musyrif */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Catatan Pembina (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Contoh: Makhraj huruf fa' dan kelancaran sangat tartil..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:bg-white"
                  />
                </div>

                <Button
                  variant="primary"
                  onClick={handleSaveSetoran}
                  disabled={isPending}
                  className="w-full min-h-[48px] font-bold text-sm bg-[#0E7C3A] hover:bg-[#0B642E] shadow-xs gap-2"
                >
                  <BookCheck className="h-4 w-4" />
                  {isPending ? "Menyimpan ke Server..." : "Simpan Setoran Santri"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Kolom Kanan: Feed Riwayat Setoran Terkini */}
          <div className="lg:col-span-2 space-y-4">
            <Card rounded="3xl" className="border border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 font-heading">
                      Riwayat Setoran Terkini
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Daftar hafalan santri yang telah direkam ke server
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Cari santri..."
                      className="pl-9 min-h-[38px] text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredRecentSetoran.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredRecentSetoran.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#0E7C3A] font-bold text-xs shrink-0 border border-emerald-100">
                            Juz {item.juz}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {item.santriNama}
                              </h4>
                              <Badge variant="green" size="sm">
                                {item.jenis}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {item.surah} (Ayat {item.ayat})
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {item.tanggal}
                            </p>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
                          <Badge
                            variant={
                              item.nilai === "MUMTAZ"
                                ? "green"
                                : item.nilai === "JAYYID_JIDDAN"
                                ? "sky"
                                : "gold"
                            }
                            size="sm"
                            className="font-bold"
                          >
                            {item.nilai}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Belum ada riwayat setoran yang cocok dengan pencarian.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. TAB 2: REKAP LAPORAN BULANAN DUC (DESKTOP TABEL + HP ACCORDION) */}
      {activeSubTab === "laporan" && (
        <RekapLaporanBulanan
          halaqohList={halaqohList}
          userRole={userRole}
          onPrintPreview={onPrintPreview}
        />
      )}

      {/* 4. TAB 3: IKHTIBAR DENGAN PENILAIAN BERDASARKAN BARIS UJIAN */}
      {activeSubTab === "ikhtibar" && (
        <div className="space-y-4">
          <Card rounded="3xl" className="border border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 font-heading">
                    Antrean Ujian Ikhtibar Komprehensif (2-Tahap)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Ujian kelulusan juz: Tahap 1 oleh Musyrif Tahfizh, Tahap 2 Munaqasyah oleh Mudir Pesantren (Ambang Lulus: ≥ 75).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="px-4 py-3">Nama Santri</th>
                    <th className="px-3 py-3 text-center">Juz</th>
                    <th className="px-3 py-3">Tahap Ujian</th>
                    <th className="px-3 py-3">Penguji</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Nilai</th>
                    <th className="px-4 py-3 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ikhtibarList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {item.santriNama}
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {item.santriNis} • {item.kelas}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-extrabold text-[#0E7C3A]">
                        Juz {item.juz}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        Tahap {item.tahap}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {item.penguji}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant={
                            item.status === "LULUS_SEMPURNA_TAHAP_2"
                              ? "green"
                              : item.status === "LULUS_TAHAP_1"
                              ? "gold"
                              : "orange"
                          }
                          size="sm"
                        >
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">
                        {item.nilai !== null ? item.nilai : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status !== "LULUS_SEMPURNA_TAHAP_2" ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setGradingUjian({
                                id: item.id,
                                santriNama: item.santriNama,
                                santriNis: item.santriNis,
                                juz: item.juz,
                                tahap: item.tahap,
                                penguji: item.penguji,
                              })
                            }
                            className="text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E] min-h-[36px]"
                          >
                            Nilai Ujian
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-semibold flex items-center justify-center gap-1">
                            <Check className="h-4 w-4" /> Sah
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DIALOG PENILAIAN UJIAN BERDASARKAN BARIS TERPILIH (POINT 7) */}
      {gradingUjian && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="grading-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="grading-modal-title" className="text-base font-bold text-slate-900 font-heading">
                  Nilai Ujian Ikhtibar Tahap {gradingUjian.tahap}
                </h3>
                <p className="text-xs text-slate-500">
                  {gradingUjian.santriNama} ({gradingUjian.santriNis}) — Juz {gradingUjian.juz}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGradingUjian(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Tutup Dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <p><strong>Penguji:</strong> {gradingUjian.penguji}</p>
                <p><strong>Ambang Kelulusan:</strong> Nilai minimal 75</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nilai Angka Ujian (0 - 100)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={inputNilaiIkhtibar}
                  onChange={(e) => setInputNilaiIkhtibar(e.target.value)}
                  className="min-h-[44px] text-base font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Catatan Penguji
                </label>
                <textarea
                  rows={3}
                  value={inputCatatanIkhtibar}
                  onChange={(e) => setInputCatatanIkhtibar(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setGradingUjian(null)}
                  className="min-h-[42px] text-xs font-semibold"
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSimpanNilaiIkhtibar}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Menyimpan..." : "Simpan Keputusan Ujian"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Dialog */}
      <WhatsAppDialog
        isOpen={waDialog.isOpen}
        defaultPhone={waDialog.phone}
        defaultRecipientName={waDialog.recipientName}
        defaultMessage={waDialog.message}
        title={waDialog.title}
        description={waDialog.description}
        onClose={() => setWaDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
