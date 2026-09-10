"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "@/components/modules/beranda-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  catatMutabaahHarianAction,
  getMutabaahHarianListAction,
  type MutabaahHarianItem,
} from "@/app/actions/presensi";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Save,
  Search,
} from "lucide-react";

interface MutabaahHarianTabProps {
  userRole?: Role;
  currentUserName?: string;
  currentHalaqohName?: string | null;
  santriList: DashboardSantriSummary[];
  halaqohList: Array<{ id: string; nama: string }>;
  onSaved?: (info: { total: number }) => void;
}

interface SantriMutabaahFormRow {
  santriId: string;
  nama: string;
  nis: string;
  kelas: string;
  halaqoh: string;
  shalatBerjamaah: boolean;
  qiyamulLail: boolean;
  rawatib: boolean;
  dhuha: boolean;
  dzikirPagiPetang: boolean;
  tilawahMandiri: boolean;
  literasiHalaman: number;
  catatan: string;
}

export function MutabaahHarianTab({
  santriList,
  halaqohList,
  onSaved,
}: MutabaahHarianTabProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tanggal operasional (Format YYYY-MM-DD WITA)
  const [tanggal, setTanggal] = useState<string>(() => {
    const now = new Date();
    const witaOffset = 8 * 60;
    const witaTime = new Date(now.getTime() + (witaOffset + now.getTimezoneOffset()) * 60000);
    return witaTime.toISOString().split("T")[0];
  });

  const [filterHalaqoh, setFilterHalaqoh] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Inisialisasi baris data santri
  const [rows, setRows] = useState<Record<string, SantriMutabaahFormRow>>({});

  const getFallbackRow = (s: DashboardSantriSummary): SantriMutabaahFormRow => ({
    santriId: s.id,
    nama: s.nama,
    nis: s.nis,
    kelas: s.kelas,
    halaqoh: s.halaqoh,
    shalatBerjamaah: true,
    qiyamulLail: false,
    rawatib: true,
    dhuha: false,
    dzikirPagiPetang: true,
    tilawahMandiri: true,
    literasiHalaman: 0,
    catatan: "",
  });

  // Load existing records if available
  useEffect(() => {
    if (!tanggal) return;
    let isMounted = true;
    getMutabaahHarianListAction(tanggal).then((res) => {
      if (!isMounted) return;
      if (res.success && res.data && res.data.length > 0) {
        setRows((prev) => {
          const updated = { ...prev };
          res.data.forEach((rec: { santriId: string; kategori: string; nilai: number; catatan?: string | null }) => {
            const s = santriList.find((item) => item.id === rec.santriId);
            const current = updated[rec.santriId] || (s ? getFallbackRow(s) : {
              santriId: rec.santriId,
              nama: "",
              nis: "",
              kelas: "",
              halaqoh: "",
              shalatBerjamaah: true,
              qiyamulLail: false,
              rawatib: true,
              dhuha: false,
              dzikirPagiPetang: true,
              tilawahMandiri: true,
              literasiHalaman: 0,
              catatan: "",
            });
            if (rec.kategori === "SHOLAT_TAHAJJUD") {
              current.qiyamulLail = rec.nilai > 0;
            } else if (rec.kategori === "SHOLAT_DHUHA") {
              current.dhuha = rec.nilai > 0;
            } else if (rec.kategori === "LITERASI") {
              current.literasiHalaman = rec.nilai;
              if (rec.catatan) current.catatan = rec.catatan;
            }
            updated[rec.santriId] = current;
          });
          return updated;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [tanggal, santriList]);

  // Filter santri
  const filteredSantri = santriList.filter((s) => {
    const matchHalaqoh = filterHalaqoh === "ALL" || s.halaqoh === filterHalaqoh;
    const matchSearch =
      s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nis.toLowerCase().includes(searchTerm.toLowerCase());
    return matchHalaqoh && matchSearch;
  });

  const updateRowField = <K extends keyof SantriMutabaahFormRow>(
    santriId: string,
    field: K,
    val: SantriMutabaahFormRow[K]
  ) => {
    setRows((prev) => {
      const s = santriList.find((item) => item.id === santriId);
      const current = prev[santriId] || (s ? getFallbackRow(s) : null);
      if (!current) return prev;
      return {
        ...prev,
        [santriId]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  const handleCheckAll = (
    field: keyof Omit<SantriMutabaahFormRow, "santriId" | "nama" | "nis" | "kelas" | "halaqoh" | "literasiHalaman" | "catatan">,
    val: boolean
  ) => {
    setRows((prev) => {
      const next = { ...prev };
      filteredSantri.forEach((s) => {
        const current = next[s.id] || getFallbackRow(s);
        next[s.id] = { ...current, [field]: val };
      });
      return next;
    });
  };

  const handleSaveBatch = () => {
    setFeedback(null);
    const itemsToSave: MutabaahHarianItem[] = filteredSantri.map((s) => {
      const row = rows[s.id] || getFallbackRow(s);

      return {
        santriId: s.id,
        shalatBerjamaah: row.shalatBerjamaah,
        qiyamulLail: row.qiyamulLail,
        rawatib: row.rawatib,
        dhuha: row.dhuha,
        dzikirPagiPetang: row.dzikirPagiPetang,
        tilawahMandiri: row.tilawahMandiri,
        literasiHalaman: Number(row.literasiHalaman) || 0,
        catatan: row.catatan,
      };
    });

    if (itemsToSave.length === 0) {
      setFeedback({ type: "error", text: "Tidak ada santri yang dapat disimpan." });
      return;
    }

    startTransition(async () => {
      const res = await catatMutabaahHarianAction({
        tanggal,
        items: itemsToSave,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Alhamdulillah! Catatan mutaba'ah harian untuk ${itemsToSave.length} santri berhasil disimpan ke basis data secara transaksional.`,
        });
        onSaved?.({ total: itemsToSave.length });
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal menyimpan mutaba'ah harian." });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFeedback(null)}>
            Tutup
          </Button>
        </div>
      )}

      {/* Kontrol & Filter */}
      <Card className="shadow-xs border border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 font-medium">WITA</span>
            </div>

            <select
              value={filterHalaqoh}
              onChange={(e) => setFilterHalaqoh(e.target.value)}
              className="text-xs border rounded-xl px-3 py-2 bg-white text-slate-700 font-medium"
            >
              <option value="ALL">Semua Halaqoh</option>
              {halaqohList.map((h) => (
                <option key={h.id} value={h.nama}>
                  {h.nama}
                </option>
              ))}
            </select>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari santri..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveBatch}
              disabled={isPending || filteredSantri.length === 0}
              className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-xs font-bold flex items-center gap-1.5 min-h-[36px]"
            >
              <Save className="w-3.5 h-3.5" />
              {isPending ? "Menyimpan ke Server..." : `Simpan Mutaba'ah (${filteredSantri.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabel 7 Komponen Mutaba'ah */}
      <Card className="shadow-xs border border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              Checklist 7 Komponen Mutaba&apos;ah Harian
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Shalat Berjamaah, Qiyamul Lail, Rawatib, Dhuha, Dzikir Pagi/Petang, Tilawah Mandiri, dan Literasi Kitab/Buku (Halaman).
            </CardDescription>
          </div>

          {/* Quick Check All Controls */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500">
            <span>Set Cepat:</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => handleCheckAll("qiyamulLail", true)}
            >
              +Tahajjud
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => handleCheckAll("dhuha", true)}
            >
              +Dhuha
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => handleCheckAll("shalatBerjamaah", true)}
            >
              +5 Waktu
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSantri.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Tidak ada data santri yang cocok dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-2.5 min-w-[160px]">Santri</th>
                    <th className="p-2.5 text-center min-w-[70px]">1. Berjamaah</th>
                    <th className="p-2.5 text-center min-w-[70px]">2. Qiyamul Lail</th>
                    <th className="p-2.5 text-center min-w-[70px]">3. Rawatib</th>
                    <th className="p-2.5 text-center min-w-[70px]">4. Dhuha</th>
                    <th className="p-2.5 text-center min-w-[70px]">5. Dzikir</th>
                    <th className="p-2.5 text-center min-w-[70px]">6. Tilawah</th>
                    <th className="p-2.5 text-center min-w-[90px]">7. Literasi (Hlm)</th>
                    <th className="p-2.5 min-w-[150px]">Catatan Pembina</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {filteredSantri.map((s) => {
                    const row = rows[s.id] || getFallbackRow(s);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="p-2.5">
                          <span className="font-bold text-slate-900 block">{s.nama}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {s.nis} • {s.kelas}
                          </span>
                        </td>

                        {/* 1. Shalat Berjamaah */}
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.shalatBerjamaah}
                            onChange={(e) => updateRowField(s.id, "shalatBerjamaah", e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>

                        {/* 2. Qiyamul Lail / Tahajjud */}
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.qiyamulLail}
                            onChange={(e) => updateRowField(s.id, "qiyamulLail", e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>

                        {/* 3. Rawatib */}
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.rawatib}
                            onChange={(e) => updateRowField(s.id, "rawatib", e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>

                        {/* 4. Dhuha */}
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.dhuha}
                            onChange={(e) => updateRowField(s.id, "dhuha", e.target.checked)}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                          />
                        </td>

                        {/* 5. Dzikir Pagi Petang */}
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.dzikirPagiPetang}
                            onChange={(e) => updateRowField(s.id, "dzikirPagiPetang", e.target.checked)}
                            className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                          />
                        </td>

                        {/* 6. Tilawah Mandiri */}
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.tilawahMandiri}
                            onChange={(e) => updateRowField(s.id, "tilawahMandiri", e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>

                        {/* 7. Literasi Kitab / Buku (Halaman) */}
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.literasiHalaman}
                            onChange={(e) => updateRowField(s.id, "literasiHalaman", parseFloat(e.target.value) || 0)}
                            className="w-16 text-center border rounded-lg py-1 px-1 text-xs font-semibold bg-white"
                          />
                        </td>

                        {/* Catatan Pembina */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            placeholder="Catatan..."
                            value={row.catatan}
                            onChange={(e) => updateRowField(s.id, "catatan", e.target.value)}
                            className="w-full border rounded-lg py-1 px-2 text-xs bg-white text-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
