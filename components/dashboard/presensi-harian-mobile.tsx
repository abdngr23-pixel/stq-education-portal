"use client";

import React, { useState, useMemo, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { buildRekapPresensiWAMessage } from "@/lib/whatsapp";
import { simpanBatchPresensiAction, type PresensiItemPayload } from "@/app/actions/presensi";
import {
  CheckCircle2,
  Clock,
  HeartPulse,
  FileText,
  AlertCircle,
  Users,
  Calendar,
  Share2,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Filter,
} from "lucide-react";

export interface SantriPresensiItem {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  halaqoh?: string;
  kamar?: string;
  statusIzinAktif?: {
    jenis: string;
    alasan: string;
    status: string;
  } | null;
}

export interface PresensiHarianMobileProps {
  santriList: SantriPresensiItem[];
  currentUserName?: string;
  currentUserRole?: string;
  currentHalaqohName?: string;
  halaqohList?: Array<{ id: string; nama: string; pembina?: string }>;
  onPresensiSaved?: (result: { kegiatan: string; total: number }) => void;
}

type StatusType = "HADIR" | "MASBUK" | "SAKIT" | "IZIN" | "ALFA";

const SESI_SHALAT = [
  { id: "Sholat Subuh", label: "Shalat Subuh (04.45 WITA)", short: "Subuh" },
  { id: "Sholat Dzuhur", label: "Shalat Dzuhur (12.15 WITA)", short: "Dzuhur" },
  { id: "Sholat Ashar", label: "Shalat Ashar (15.30 WITA)", short: "Ashar" },
  { id: "Sholat Maghrib", label: "Shalat Maghrib (18.15 WITA)", short: "Maghrib" },
  { id: "Sholat Isya", label: "Shalat Isya (19.30 WITA)", short: "Isya" },
];

const SESI_HALAQOH = [
  { id: "Halaqah Ba'da Shubuh", label: "Halaqah 1: Ba'da Shubuh (05.00–06.30)", short: "Halaqah Shubuh" },
  { id: "Halaqah Pagi (Dhuha)", label: "Halaqah 2: Pagi / Dhuha (08.00–09.30)", short: "Halaqah Dhuha" },
  { id: "Halaqah Ba'da Ashar", label: "Halaqah 3: Ba'da Ashar (16.00–17.15)", short: "Halaqah Ashar" },
  { id: "Kajian Ba'da Maghrib", label: "Halaqah 4: Ba'da Maghrib / Diniyah (18.30–19.30)", short: "Kajian Maghrib" },
  { id: "Halaqah Ba'da Isya", label: "Halaqah 5: Ba'da Isya (20.00–21.00)", short: "Halaqah Isya" },
];

export function PresensiHarianMobile({
  santriList,
  currentUserName = "Musyrif STQ",
  currentUserRole = "MK",
  currentHalaqohName,
  halaqohList = [],
  onPresensiSaved,
}: PresensiHarianMobileProps) {
  const [kategoriSesi, setKategoriSesi] = useState<"SHALAT" | "HALAQOH">("SHALAT");
  const [selectedSesi, setSelectedSesi] = useState<string>("Sholat Subuh");
  const [tanggal, setTanggal] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });

  // Filter Target
  const [selectedHalaqohFilter, setSelectedHalaqohFilter] = useState<string>(
    currentHalaqohName || "ALL"
  );
  const [selectedKelasFilter, setSelectedKelasFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // State Kehadiran Map: santriId -> { status, catatan }
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: StatusType; catatan?: string }>>(() => {
    const initial: Record<string, { status: StatusType; catatan?: string }> = {};
    santriList.forEach((s) => {
      // Jika santri punya izin aktif yang disetujui, otomatis prefill
      if (s.statusIzinAktif && s.statusIzinAktif.status === "DISETUJUI") {
        if (s.statusIzinAktif.jenis === "SAKIT") {
          initial[s.id] = { status: "SAKIT", catatan: "Izin Sakit Disetujui" };
        } else {
          initial[s.id] = { status: "IZIN", catatan: `Izin Pulang (${s.statusIzinAktif.alasan})` };
        }
      } else {
        initial[s.id] = { status: "HADIR" };
      }
    });
    return initial;
  });

  // Modal WhatsApp state
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter santri yang tampil
  const filteredSantri = useMemo(() => {
    return santriList.filter((s) => {
      if (selectedHalaqohFilter !== "ALL" && s.halaqoh !== selectedHalaqohFilter) {
        return false;
      }
      if (selectedKelasFilter !== "ALL" && !s.kelas.startsWith(selectedKelasFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
      }
      return true;
    });
  }, [santriList, selectedHalaqohFilter, selectedKelasFilter, searchQuery]);

  // Hitung ringkasan status
  const summaryCounts = useMemo(() => {
    const counts = { HADIR: 0, MASBUK: 0, SAKIT: 0, IZIN: 0, ALFA: 0 };
    filteredSantri.forEach((s) => {
      const record = attendanceMap[s.id];
      const status = record ? record.status : "HADIR";
      counts[status]++;
    });
    return counts;
  }, [filteredSantri, attendanceMap]);

  // Toggle status berurutan (Mobile fast tap)
  const handleToggleStatus = (santriId: string) => {
    const currentStatus = attendanceMap[santriId]?.status || "HADIR";
    const statusCycle: StatusType[] = ["HADIR", "MASBUK", "SAKIT", "IZIN", "ALFA"];
    const nextIndex = (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];

    setAttendanceMap((prev) => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        status: nextStatus,
      },
    }));
  };

  // Set status spesifik
  const handleSetStatus = (santriId: string, status: StatusType) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [santriId]: {
        ...prev[santriId],
        status,
      },
    }));
  };

  // 1-Klik Set Semua Hadir
  const handleSetAllHadir = () => {
    setAttendanceMap((prev) => {
      const updated = { ...prev };
      filteredSantri.forEach((s) => {
        // Jangan timpa santri yang sedang izin pulang sah
        if (!s.statusIzinAktif || s.statusIzinAktif.status !== "DISETUJUI") {
          updated[s.id] = { ...updated[s.id], status: "HADIR" };
        }
      });
      return updated;
    });
    setFeedback({ type: "success", text: "Seluruh santri dalam filter ditandai HADIR." });
  };

  // Simpan Batch Presensi
  const handleSimpanPresensi = () => {
    setFeedback(null);
    if (filteredSantri.length === 0) {
      setFeedback({ type: "error", text: "Tidak ada santri dalam daftar yang dipilih." });
      return;
    }

    startTransition(async () => {
      const payloadItems: PresensiItemPayload[] = filteredSantri.map((s) => {
        const record = attendanceMap[s.id] || { status: "HADIR" };
        return {
          santriId: s.id,
          santriNis: s.nis,
          santriNama: s.nama,
          status: record.status,
          catatan: record.catatan,
        };
      });

      const res = await simpanBatchPresensiAction({
        kegiatan: selectedSesi,
        tanggal,
        items: payloadItems,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Alhamdulillah! Presensi ${selectedSesi} (${payloadItems.length} santri) tersimpan rapi.`,
        });

        // Siapkan pesan WA laporan
        const daftarTidakHadir = filteredSantri
          .filter((s) => {
            const st = attendanceMap[s.id]?.status || "HADIR";
            return st !== "HADIR";
          })
          .map((s) => ({
            nama: s.nama,
            kelas: s.kelas,
            status: attendanceMap[s.id]?.status || "ALFA",
            catatan: attendanceMap[s.id]?.catatan || undefined,
          }));

        const waText = buildRekapPresensiWAMessage({
          kegiatan: selectedSesi,
          tanggal,
          petugasNama: currentUserName,
          totalSantri: filteredSantri.length,
          hadir: summaryCounts.HADIR,
          masbuk: summaryCounts.MASBUK,
          sakit: summaryCounts.SAKIT,
          izin: summaryCounts.IZIN,
          alpa: summaryCounts.ALFA,
          daftarTidakHadir,
        });
        setWaMessage(waText);

        if (onPresensiSaved) {
          onPresensiSaved({ kegiatan: selectedSesi, total: payloadItems.length });
        }
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal menyimpan presensi." });
      }
    });
  };

  // Siapkan dan Buka Modal WA Rekap
  const handleOpenWaModal = () => {
    const daftarTidakHadir = filteredSantri
      .filter((s) => {
        const st = attendanceMap[s.id]?.status || "HADIR";
        return st !== "HADIR";
      })
      .map((s) => ({
        nama: s.nama,
        kelas: s.kelas,
        status: attendanceMap[s.id]?.status || "ALFA",
        catatan: attendanceMap[s.id]?.catatan || undefined,
      }));

    const msg = buildRekapPresensiWAMessage({
      kegiatan: selectedSesi,
      tanggal,
      petugasNama: currentUserName,
      totalSantri: filteredSantri.length,
      hadir: summaryCounts.HADIR,
      masbuk: summaryCounts.MASBUK,
      sakit: summaryCounts.SAKIT,
      izin: summaryCounts.IZIN,
      alpa: summaryCounts.ALFA,
      daftarTidakHadir,
    });
    setWaMessage(msg);
    setIsWaModalOpen(true);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border shadow-2xs animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Card 1: Pemilihan Sesi & Waktu */}
      <Card rounded="3xl" className="p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading flex items-center gap-2">
              <span>📋</span> Presensi Harian Santri (Checklist Mobile)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Optimasi layar HP: ketuk untuk beralih status kehadiran shalat berjamaah atau halaqoh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* Tab Jenis: Shalat Berjamaah vs Halaqoh */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100/90 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setKategoriSesi("SHALAT");
              setSelectedSesi("Sholat Subuh");
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              kategoriSesi === "SHALAT"
                ? "bg-[#0E7C3A] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🕌</span>
            <span>Shalat 5 Waktu</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setKategoriSesi("HALAQOH");
              setSelectedSesi("Halaqah Ba'da Shubuh");
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              kategoriSesi === "HALAQOH"
                ? "bg-[#0E7C3A] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📖</span>
            <span>Halaqoh Al-Qur&apos;an</span>
          </button>
        </div>

        {/* Pilihan Sesi Spesifik */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(kategoriSesi === "SHALAT" ? SESI_SHALAT : SESI_HALAQOH).map((sesi) => {
            const isSelected = selectedSesi === sesi.id;
            return (
              <button
                key={sesi.id}
                type="button"
                onClick={() => setSelectedSesi(sesi.id)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                  isSelected
                    ? "bg-emerald-50 text-[#0E7C3A] border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {sesi.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Card 2: Filter Target & Aksi Cepat Massal */}
      <Card rounded="3xl" className="p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Filter Halaqoh */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Kelompok Halaqoh
            </label>
            <select
              value={selectedHalaqohFilter}
              onChange={(e) => setSelectedHalaqohFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="ALL">Semua Kelompok Halaqoh</option>
              {halaqohList.length > 0
                ? halaqohList.map((h) => (
                    <option key={h.id} value={h.nama}>
                      {h.nama}
                    </option>
                  ))
                : [
                    "Halaqoh Ust. Razan Mufli, S.Pd",
                    "Halaqoh Ust. Kamal",
                    "Halaqoh Ust. Rizaldi",
                    "Halaqoh Ust. Abi Hudzaifah",
                    "Halaqoh Ust. Alwan",
                    "Halaqoh Ustadzah Lisa Dwina Fitri",
                  ].map((nama) => (
                    <option key={nama} value={nama}>
                      {nama}
                    </option>
                  ))}
            </select>
          </div>

          {/* Filter Kelas */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Tingkat Kelas
            </label>
            <select
              value={selectedKelasFilter}
              onChange={(e) => setSelectedKelasFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="ALL">Semua Tingkat Kelas</option>
              <option value="7">Kelas VII (7)</option>
              <option value="8">Kelas VIII (8)</option>
              <option value="9">Kelas IX (9)</option>
            </select>
          </div>

          {/* Cari Santri */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Cari Nama / NIS
            </label>
            <input
              type="text"
              placeholder="Cari santri..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>
        </div>

        {/* Counter Ringkasan Metrik */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total</span>
            <span className="text-sm font-extrabold text-slate-800">{filteredSantri.length}</span>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Hadir</span>
            <span className="text-sm font-extrabold text-emerald-800">{summaryCounts.HADIR}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200">
            <span className="text-[10px] uppercase font-bold text-amber-700 block">Masbuk</span>
            <span className="text-sm font-extrabold text-amber-800">{summaryCounts.MASBUK}</span>
          </div>
          <div className="p-2 rounded-xl bg-sky-50/80 border border-sky-200">
            <span className="text-[10px] uppercase font-bold text-sky-700 block">Sakit</span>
            <span className="text-sm font-extrabold text-sky-800">{summaryCounts.SAKIT}</span>
          </div>
          <div className="p-2 rounded-xl bg-purple-50/80 border border-purple-200">
            <span className="text-[10px] uppercase font-bold text-purple-700 block">Izin</span>
            <span className="text-sm font-extrabold text-purple-800">{summaryCounts.IZIN}</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50/80 border border-rose-200">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Alpa</span>
            <span className="text-sm font-extrabold text-rose-800">{summaryCounts.ALFA}</span>
          </div>
        </div>

        {/* Tombol Aksi Massal */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSetAllHadir}
              className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />}
            >
              Semua Hadir (1-Klik)
            </Button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Ketuk nama santri di bawah untuk mengganti status
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleOpenWaModal}
            className="text-xs font-bold text-[#128C7E] bg-[#25D366]/15 hover:bg-[#25D366]/25 border-[#25D366]/30"
            leftIcon={<Share2 className="h-3.5 w-3.5 text-[#25D366]" />}
          >
            Kirim Rekap WA Asatidz
          </Button>
        </div>
      </Card>

      {/* Card 3: Daftar Santri (Touch-Friendly Rows) */}
      <div className="space-y-2.5">
        {filteredSantri.map((s) => {
          const currentRec = attendanceMap[s.id] || { status: "HADIR" };
          const status = currentRec.status;
          const isPermitted = s.statusIzinAktif && s.statusIzinAktif.status === "DISETUJUI";

          return (
            <Card
              key={s.id}
              rounded="2xl"
              onClick={() => handleToggleStatus(s.id)}
              className={`p-3.5 sm:p-4 border transition-all cursor-pointer select-none ${
                status === "HADIR"
                  ? "bg-white border-slate-200/80 hover:border-emerald-300"
                  : status === "MASBUK"
                  ? "bg-amber-50/50 border-amber-300 shadow-2xs"
                  : status === "SAKIT"
                  ? "bg-sky-50/50 border-sky-300 shadow-2xs"
                  : status === "IZIN"
                  ? "bg-purple-50/50 border-purple-300 shadow-2xs"
                  : "bg-rose-50/50 border-rose-300 shadow-2xs"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Info Identitas Santri */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 font-heading border ${
                      status === "HADIR"
                        ? "bg-emerald-100 text-[#0E7C3A] border-emerald-200"
                        : status === "MASBUK"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : status === "SAKIT"
                        ? "bg-sky-100 text-sky-800 border-sky-300"
                        : status === "IZIN"
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {s.nama
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 font-heading">
                        {s.nama}
                      </h4>
                      {isPermitted && (
                        <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">
                          {s.statusIzinAktif?.jenis === "SAKIT" ? "Izin Sakit" : "Izin Pulang Sah"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="font-mono text-[11px] font-semibold text-slate-600">{s.nis}</span>
                      <span>•</span>
                      <span>Kelas {s.kelas}</span>
                      {s.halaqoh && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[180px]">{s.halaqoh}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pill Pilihan Status Cepat (Touch buttons) */}
                <div
                  className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(["HADIR", "MASBUK", "SAKIT", "IZIN", "ALFA"] as const).map((st) => {
                    const isCurrent = status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleSetStatus(s.id, st)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isCurrent
                            ? st === "HADIR"
                              ? "bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-xs"
                              : st === "MASBUK"
                              ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                              : st === "SAKIT"
                              ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                              : st === "IZIN"
                              ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                              : "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {st === "HADIR"
                          ? "Hadir"
                          : st === "MASBUK"
                          ? "Masbuk"
                          : st === "SAKIT"
                          ? "Sakit"
                          : st === "IZIN"
                          ? "Izin"
                          : "Alpa"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}

        {filteredSantri.length === 0 && (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-sm">Tidak ada santri yang sesuai kriteria pencarian.</p>
          </div>
        )}
      </div>

      {/* Floating Bottom Action Bar (Mobile-friendly thumb access) */}
      <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 z-40 max-w-2xl mx-auto px-4 pointer-events-none">
        <div className="p-3.5 rounded-3xl bg-slate-950/90 text-white backdrop-blur-md border border-slate-800 shadow-2xl flex items-center justify-between gap-3 pointer-events-auto">
          <div className="text-xs">
            <p className="font-bold flex items-center gap-1.5 text-emerald-400">
              <span>{selectedSesi}</span>
              <span>•</span>
              <span>{filteredSantri.length} Santri</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Hadir: <strong className="text-white">{summaryCounts.HADIR}</strong> • 
              Masbuk: <strong className="text-amber-400">{summaryCounts.MASBUK}</strong> • 
              Alpa: <strong className="text-rose-400">{summaryCounts.ALFA}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isPending}
              onClick={handleSimpanPresensi}
              className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold px-4 shadow-md"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Simpan Presensi
            </Button>
          </div>
        </div>
      </div>

      {/* Modal WhatsApp Dialog Rekap */}
      <WhatsAppDialog
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        defaultPhone="081299887766"
        defaultRecipientName="Grup Asatidz STQ DUC"
        defaultMessage={waMessage}
        title="Kirim Rekap Presensi ke Grup Asatidz"
        description="Laporan ringkas kehadiran shalat berjamaah atau halaqoh santri siap dikirim via WhatsApp."
      />
    </div>
  );
}
