"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role, NilaiSetoran } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  deriveOverallNilai,
  DEFAULT_MISTAKE_COUNTS,
  CANONICAL_MISTAKE_KEYS,
  MISTAKE_LABELS,
  NILAI_LABELS,
  MistakeCounts,
  CanonicalMistakeKey,
} from "@/lib/tahfizh-quality";
import { createEvaluasiRubuAction, getEvaluasiRubuListAction } from "@/app/actions/rubu";
import {
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  History,
} from "lucide-react";

interface EvaluasiRubuTabProps {
  userRole?: Role;
  santriList: Array<{
    id: string;
    nama: string;
    nis: string;
    kelas?: string;
  }>;
  isKepalaBidangTahfidz?: boolean;
}

interface EvaluasiRubuRecord {
  id: string;
  santriId: string;
  santri: { id: string; nama: string; nis: string; kelas?: string };
  musyrif: { id: string; nama: string };
  juz: number;
  rubuKe: number;
  nilaiTajwid: NilaiSetoran;
  nilaiFashahah: NilaiSetoran;
  nilaiKelancaran: NilaiSetoran;
  nilai: NilaiSetoran;
  rincianKesalahan?: unknown;
  catatan?: string | null;
  tanggal: Date | string;
}

export function EvaluasiRubuTab({
  santriList,
}: EvaluasiRubuTabProps) {
  const [selectedSantriId, setSelectedSantriId] = useState<string>(santriList[0]?.id || "");
  const [juz, setJuz] = useState<number>(1);
  const [rubuKe, setRubuKe] = useState<number>(1);
  const [nilaiTajwid, setNilaiTajwid] = useState<NilaiSetoran>("MUMTAZ");
  const [nilaiFashahah, setNilaiFashahah] = useState<NilaiSetoran>("MUMTAZ");
  const [nilaiKelancaran, setNilaiKelancaran] = useState<NilaiSetoran>("MUMTAZ");
  const [mistakeCounts, setMistakeCounts] = useState<MistakeCounts>({ ...DEFAULT_MISTAKE_COUNTS });
  const [isMistakesOpen, setIsMistakesOpen] = useState(false);
  const [catatan, setCatatan] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [records, setRecords] = useState<EvaluasiRubuRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Derived overall predicate (lowest dimension)
  const derivedOverall = deriveOverallNilai({
    tajwid: nilaiTajwid,
    fashahah: nilaiFashahah,
    kelancaran: nilaiKelancaran,
  });

  const totalMistakes = Object.values(mistakeCounts).reduce((acc, c) => acc + (c || 0), 0);

  const fetchRecords = async () => {
    setIsLoadingRecords(true);
    try {
      const res = await getEvaluasiRubuListAction({ limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setRecords(res.data as unknown as EvaluasiRubuRecord[]);
      }
    } catch (e) {
      console.error("Gagal mengambil data evaluasi rubu:", e);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getEvaluasiRubuListAction({ limit: 50 }).then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        setRecords(res.data as unknown as EvaluasiRubuRecord[]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCounterChange = (key: CanonicalMistakeKey, delta: number) => {
    setMistakeCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSantriId) {
      setFeedback({ type: "error", message: "Pilih santri terlebih dahulu." });
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const res = await createEvaluasiRubuAction({
        santriId: selectedSantriId,
        juz,
        rubuKe,
        nilaiTajwid,
        nilaiFashahah,
        nilaiKelancaran,
        rincianKesalahan: mistakeCounts,
        catatan: catatan.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ type: "success", message: res.message });
        setMistakeCounts({ ...DEFAULT_MISTAKE_COUNTS });
        setCatatan("");
        fetchRecords();
      } else {
        setFeedback({ type: "error", message: res.message });
      }
    });
  };

  const getBadgeVariant = (n: NilaiSetoran) => {
    switch (n) {
      case "MUMTAZ":
        return "green";
      case "JAYYID_JIDDAN":
        return "sky";
      case "JAYYID":
        return "gold";
      case "MAQBUL":
        return "orange";
      case "DHOIF":
        return "neutral";
      default:
        return "neutral";
    }
  };

  return (
    <div className="space-y-6" data-testid="evaluasi-rubu-tab">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <BookmarkCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Evaluasi Milestone Rubu&apos; (1/4 Juz)
              </h2>
              <p className="text-xs text-slate-500">
                Pencatatan kualitas per perempat juz resmi (Juz 1–30, Rubu&apos; 1–4). Nilai terendah dari Tajwid, Fashahah, dan Kelancaran menjadi predikat keseluruhan.
              </p>
            </div>
          </div>
          <Badge variant="sky" size="sm" className="font-semibold self-start sm:self-auto">
            Milestone Berkala
          </Badge>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
              : "bg-rose-50 border border-rose-200 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs sm:text-sm font-medium">{feedback.message}</div>
        </div>
      )}

      {/* Form Input Evaluasi Rubu' */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" />
            Formulir Evaluasi Rubu&apos; Baru
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Santri Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Santri Target
                </label>
                <select
                  data-testid="select-rubu-santri"
                  value={selectedSantriId}
                  onChange={(e) => setSelectedSantriId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium min-h-[44px] bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {santriList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.nis}) {s.kelas ? `— Kelas ${s.kelas}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Juz Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Juz (1–30)
                </label>
                <select
                  data-testid="select-rubu-juz"
                  value={juz}
                  onChange={(e) => setJuz(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium min-h-[44px] bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                    <option key={j} value={j}>
                      Juz {j}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rubu' Ke- Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rubu&apos; Ke- (1–4)
                </label>
                <select
                  data-testid="select-rubu-ke"
                  value={rubuKe}
                  onChange={(e) => setRubuKe(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium min-h-[44px] bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value={1}>Rubu&apos; 1 (Perempat Pertama)</option>
                  <option value={2}>Rubu&apos; 2 (Perempat Kedua / Nisf)</option>
                  <option value={3}>Rubu&apos; 3 (Perempat Ketiga)</option>
                  <option value={4}>Rubu&apos; 4 (Perempat Keempat / Khatam Juz)</option>
                </select>
              </div>
            </div>

            {/* 3 Quality Dimensions */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">
                Penilaian Kualitas 3 Dimensi Resmi (Business Contract PR #8)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tajwid */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tajwid
                  </label>
                  <select
                    data-testid="select-rubu-tajwid"
                    value={nilaiTajwid}
                    onChange={(e) => setNilaiTajwid(e.target.value as NilaiSetoran)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium min-h-[44px] bg-white"
                  >
                    <option value="MUMTAZ">Mumtaz (Istimewa)</option>
                    <option value="JAYYID_JIDDAN">Jayyid Jiddan (Baik Sekali)</option>
                    <option value="JAYYID">Jayyid (Baik)</option>
                    <option value="MAQBUL">Maqbul (Cukup)</option>
                    <option value="DHOIF">Dhoif (Perlu Mengulang)</option>
                  </select>
                </div>

                {/* Fashahah */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Fashahah
                  </label>
                  <select
                    data-testid="select-rubu-fashahah"
                    value={nilaiFashahah}
                    onChange={(e) => setNilaiFashahah(e.target.value as NilaiSetoran)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium min-h-[44px] bg-white"
                  >
                    <option value="MUMTAZ">Mumtaz (Istimewa)</option>
                    <option value="JAYYID_JIDDAN">Jayyid Jiddan (Baik Sekali)</option>
                    <option value="JAYYID">Jayyid (Baik)</option>
                    <option value="MAQBUL">Maqbul (Cukup)</option>
                    <option value="DHOIF">Dhoif (Perlu Mengulang)</option>
                  </select>
                </div>

                {/* Kelancaran */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Kelancaran
                  </label>
                  <select
                    data-testid="select-rubu-kelancaran"
                    value={nilaiKelancaran}
                    onChange={(e) => setNilaiKelancaran(e.target.value as NilaiSetoran)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium min-h-[44px] bg-white"
                  >
                    <option value="MUMTAZ">Mumtaz (Istimewa)</option>
                    <option value="JAYYID_JIDDAN">Jayyid Jiddan (Baik Sekali)</option>
                    <option value="JAYYID">Jayyid (Baik)</option>
                    <option value="MAQBUL">Maqbul (Cukup)</option>
                    <option value="DHOIF">Dhoif (Perlu Mengulang)</option>
                  </select>
                </div>
              </div>

              {/* Derived Overall Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  Predikat Keseluruhan (Dihitung otomatis dari dimensi terendah):
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    data-testid="badge-rubu-derived-overall"
                    variant={getBadgeVariant(derivedOverall)}
                    size="sm"
                    className="font-bold text-xs uppercase"
                  >
                    {NILAI_LABELS[derivedOverall]?.label || derivedOverall}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Collapsible Error Taxonomy Counters */}
            <div className="rounded-xl border border-slate-200/80 overflow-hidden">
              <button
                type="button"
                data-testid="btn-toggle-rubu-mistakes"
                onClick={() => setIsMistakesOpen(!isMistakesOpen)}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Rincian Kesalahan &amp; Koreksi ({totalMistakes} tercatat)
                  </span>
                  {totalMistakes > 0 && (
                    <Badge variant="orange" size="sm" className="text-[10px] font-bold">
                      {totalMistakes} Koreksi
                    </Badge>
                  )}
                </div>
                {isMistakesOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {isMistakesOpen && (
                <div className="p-4 bg-white border-t border-slate-200/80 space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Catat frekuensi kekeliruan berdasarkan 8 taksonomi resmi. Nilai minimal 0 (bilangan bulat).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CANONICAL_MISTAKE_KEYS.map((key) => {
                      const val = mistakeCounts[key] || 0;
                      const info = MISTAKE_LABELS[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50"
                        >
                          <div className="pr-2">
                            <span className="text-xs font-semibold text-slate-800 block">
                              {info.label}
                            </span>
                            <span className="text-[10px] text-slate-500 block leading-tight">
                              {info.desc}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              data-testid={`btn-rubu-dec-${key}`}
                              onClick={() => handleCounterChange(key, -1)}
                              disabled={val <= 0}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed min-h-[32px]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span
                              data-testid={`count-rubu-${key}`}
                              className="w-8 text-center text-xs font-bold text-slate-900"
                            >
                              {val}
                            </span>
                            <button
                              type="button"
                              data-testid={`btn-rubu-inc-${key}`}
                              onClick={() => handleCounterChange(key, 1)}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 min-h-[32px]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Catatan Musyrif */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Musyrif (Opsional)
              </label>
              <textarea
                data-testid="input-rubu-catatan"
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan tambahan bimbingan, ayat yang perlu dimantapkan, atau evaluasi tajwid..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                data-testid="btn-submit-rubu"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-[#0E7C3A] text-white text-xs sm:text-sm font-bold hover:bg-[#0b632e] disabled:opacity-50 flex items-center gap-2 min-h-[44px] shadow-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan Evaluasi...
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="h-4 w-4" />
                    Simpan Evaluasi Rubu&apos;
                  </>
                )}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Riwayat Evaluasi Rubu' */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-600" />
            Riwayat Evaluasi Rubu&apos; Terkini
          </CardTitle>
          <button
            type="button"
            onClick={fetchRecords}
            disabled={isLoadingRecords}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            {isLoadingRecords ? "Memuat..." : "Segarkan"}
          </button>
        </CardHeader>
        <CardContent>
          {isLoadingRecords ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
              Memuat data evaluasi Rubu&apos;...
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Belum ada data evaluasi Rubu&apos; tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">Santri</th>
                    <th className="px-3 py-2.5">Juz &amp; Rubu&apos;</th>
                    <th className="px-3 py-2.5">Tajwid</th>
                    <th className="px-3 py-2.5">Fashahah</th>
                    <th className="px-3 py-2.5">Kelancaran</th>
                    <th className="px-3 py-2.5">Predikat</th>
                    <th className="px-3 py-2.5">Penguji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                        {new Date(r.tanggal).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        {r.santri?.nama || "-"}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {r.santri?.nis}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800">
                        Juz {r.juz} — Rubu&apos; {r.rubuKe}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-600">
                        {NILAI_LABELS[r.nilaiTajwid]?.short || r.nilaiTajwid}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-600">
                        {NILAI_LABELS[r.nilaiFashahah]?.short || r.nilaiFashahah}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-600">
                        {NILAI_LABELS[r.nilaiKelancaran]?.short || r.nilaiKelancaran}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={getBadgeVariant(r.nilai)} size="sm" className="font-bold uppercase text-[10px]">
                          {r.nilai}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                        {r.musyrif?.nama || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
