"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role } from "@/types/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  ShieldAlert,
  Star,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit,
  Save,
  Lock,
  UserCheck,
  FileCheck,
} from "lucide-react";
import {
  getKebijakanRewardSanksiAction,
  updateKebijakanRewardSanksiAction,
  getDaftarTasmiSimaanEligibleAction,
  prosesRewardTasmiSimaanAction,
  previewFinalisasiBulananAction,
  finalisasiLaporanBulananAction,
  overrideSanksiBulananAction,
} from "@/app/actions/reward-sanksi";

interface RewardEvaluasiTabProps {
  userRole: Role;
  currentUserName: string;
}

interface KebijakanData {
  id?: string;
  nama: string;
  minNilaiTasmi: number;
  minNilaiSimaan: number;
  bintangTasmi: number;
  bintangSimaan: number;
  hakLiburTasmiHari: number;
  hakLiburSimaanHari: number;
  minPersenTargetBulanan: number;
  durasiKehilanganKunjunganHari: number;
}

interface TasmiItem {
  id: string;
  santriId: string;
  santriNama: string;
  santriNis: string;
  kelas: string;
  penguji: string;
  tanggal: Date;
  jenis: "TASMI" | "SIMAAN";
  juz: number;
  nilai: number;
  predikat: string;
  catatan?: string | null;
  isRewarded: boolean;
}

interface PreviewSantri {
  santriId: string;
  nama: string;
  nis: string;
  halaqohNama: string;
  targetBulanan: number | null;
  hasValidTarget: boolean;
  capaianHalaman: number;
  persentase: number;
  isTercapai: boolean;
  statusSanksi: string;
  statusKeterangan: string;
  isOverride: boolean;
  overrideNote?: string;
  overrideBy?: string;
}

export function RewardEvaluasiTab({ userRole }: RewardEvaluasiTabProps) {
  const isMudir = userRole === "KS";
  const canManage = isMudir || userRole === "ADM";

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // -------------------------------------------------------------
  // 1. KEBIJAKAN REWARD & SANKSI
  // -------------------------------------------------------------
  const [kebijakan, setKebijakan] = useState<KebijakanData>({
    nama: "Kebijakan Standar Pesantren STQ DUC",
    minNilaiTasmi: 80,
    minNilaiSimaan: 85,
    bintangTasmi: 1,
    bintangSimaan: 2,
    hakLiburTasmiHari: 1,
    hakLiburSimaanHari: 2,
    minPersenTargetBulanan: 80,
    durasiKehilanganKunjunganHari: 30,
  });
  const [isEditingKebijakan, setIsEditingKebijakan] = useState(false);
  const [kebijakanForm, setKebijakanForm] = useState<KebijakanData>(kebijakan);

  const handleSaveKebijakan = () => {
    if (!isMudir) return;
    startTransition(async () => {
      const res = await updateKebijakanRewardSanksiAction(kebijakanForm);
      if (res.success) {
        setKebijakan(kebijakanForm);
        setIsEditingKebijakan(false);
        setFeedback({ type: "success", text: "Kebijakan reward & sanksi berhasil diperbarui." });
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal menyimpan kebijakan." });
      }
    });
  };

  // -------------------------------------------------------------
  // 2. DAFTAR TASMI' & SIMA'AN UNTUK REWARD
  // -------------------------------------------------------------
  const [tasmiList, setTasmiList] = useState<TasmiItem[]>([]);
  const [isTasmiLoading, setIsTasmiLoading] = useState(false);

  const loadTasmiList = async () => {
    setIsTasmiLoading(true);
    try {
      const res = await getDaftarTasmiSimaanEligibleAction();
      if (res.success && res.data) {
        setTasmiList(res.data as unknown as TasmiItem[]);
      }
    } catch {
      // ignore
    } finally {
      setIsTasmiLoading(false);
    }
  };

  const handleProsesReward = (tasmiId: string, namaSantri: string) => {
    startTransition(async () => {
      const res = await prosesRewardTasmiSimaanAction(tasmiId);
      if (res.success) {
        setFeedback({
          type: "success",
          text: `Reward untuk ${namaSantri} berhasil diproses: ${res.message}`,
        });
        await loadTasmiList();
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal memproses reward." });
      }
    });
  };

  // -------------------------------------------------------------
  // 3. PRATINJAU & FINALISASI LAPORAN BULANAN
  // -------------------------------------------------------------
  const [bulanPilihan, setBulanPilihan] = useState<number>(9);
  const [tahunAjaranPilihan, setTahunAjaranPilihan] = useState<string>("2026/2027");
  const [previewList, setPreviewList] = useState<PreviewSantri[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // Override modal state
  const [overrideTarget, setOverrideTarget] = useState<PreviewSantri | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>("BEBAS");
  const [overrideAlasan, setOverrideAlasan] = useState<string>("");

  const handleLoadPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const res = await previewFinalisasiBulananAction({
        bulan: bulanPilihan,
        tahunAjaran: tahunAjaranPilihan,
      });
      if (res.success && res.data) {
        setPreviewList(res.data as unknown as PreviewSantri[]);
        setPreviewLoaded(true);
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal memuat pratinjau evaluasi bulanan." });
      }
    } catch {
      setFeedback({ type: "error", text: "Terjadi kesalahan jaringan saat memuat pratinjau." });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleFinalisasi = () => {
    if (!canManage) return;
    const confirmMessage = `Apakah Anda yakin ingin memfinalisasi laporan capaian tahfizh untuk Bulan ${bulanPilihan} (${tahunAjaranPilihan})? Tindakan ini bersifat idempoten dan mencatat sanksi santri yang belum mencapai target.`;
    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const res = await finalisasiLaporanBulananAction({
        bulan: bulanPilihan,
        tahunAjaran: tahunAjaranPilihan,
      });
      if (res.success) {
        setFeedback({
          type: "success",
          text: `Finalisasi bulanan selesai! Diproses: ${res.data?.totalDiproses} santri (${res.data?.totalDisanksi} disanksi, ${res.data?.totalBebas} bebas).`,
        });
        await handleLoadPreview();
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal memfinalisasi laporan bulanan." });
      }
    });
  };

  const handleSaveOverride = () => {
    if (!overrideTarget || !isMudir) return;
    if (!overrideAlasan.trim()) {
      alert("Alasan dispensasi/override wajib diisi oleh Mudir.");
      return;
    }

    startTransition(async () => {
      const res = await overrideSanksiBulananAction({
        santriId: overrideTarget.santriId,
        bulan: bulanPilihan,
        tahunAjaran: tahunAjaranPilihan,
        statusSanksiBaru: overrideStatus as "BEBAS" | "KEHILANGAN_KUNJUNGAN" | "DIKECUALIKAN",
        alasan: overrideAlasan,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Dispensasi Mudir untuk ${overrideTarget.nama} berhasil disimpan ke basis data dan audit log.`,
        });
        setOverrideTarget(null);
        setOverrideAlasan("");
        await handleLoadPreview();
      } else {
        setFeedback({ type: "error", text: res.message || "Gagal menyimpan override Mudir." });
      }
    });
  };

  useEffect(() => {
    let isMounted = true;
    getKebijakanRewardSanksiAction().then((res) => {
      if (isMounted && res.success && res.data) {
        setKebijakan(res.data as KebijakanData);
        setKebijakanForm(res.data as KebijakanData);
      }
    });
    getDaftarTasmiSimaanEligibleAction().then((res) => {
      if (isMounted && res.success && res.data) {
        setTasmiList(res.data as unknown as TasmiItem[]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
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
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFeedback(null)}>
            Tutup
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BAGIAN 1: KEBIJAKAN REWARD & SANKSI RESMI                    */}
      {/* ------------------------------------------------------------- */}
      <Card className="border-emerald-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-emerald-50">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Kebijakan Resmi Reward Bintang, Hak Libur & Sanksi Bulanan
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Acuan standar operasional reward ujian Tasmi&apos;/Sima&apos;an dan ambang batas sanksi kunjungan bulanan STQ DUC 2026.
            </CardDescription>
          </div>
          <div>
            {isMudir ? (
              isEditingKebijakan ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setKebijakanForm(kebijakan);
                      setIsEditingKebijakan(false);
                    }}
                    disabled={isPending}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    onClick={handleSaveKebijakan}
                    disabled={isPending}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Kebijakan
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-1.5 text-slate-700"
                  onClick={() => setIsEditingKebijakan(true)}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Kebijakan (Mudir)
                </Button>
              )
            ) : (
              <Badge variant="neutral" className="text-slate-500 flex items-center gap-1 bg-slate-50">
                <Lock className="w-3 h-3" />
                Read-Only (Hanya Mudir)
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tasmi Reward */}
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  Reward Tasmi&apos; (1 Juz)
                </span>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[11px]">
                  Min. {isEditingKebijakan ? (
                    <input
                      type="number"
                      className="w-12 bg-white px-1 py-0.5 border rounded text-right text-xs"
                      value={kebijakanForm.minNilaiTasmi}
                      onChange={(e) => setKebijakanForm({ ...kebijakanForm, minNilaiTasmi: parseFloat(e.target.value) || 0 })}
                    />
                  ) : kebijakan.minNilaiTasmi}
                </Badge>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Bintang:</span>
                  <span className="font-semibold text-amber-700">
                    {isEditingKebijakan ? (
                      <input
                        type="number"
                        className="w-10 bg-white px-1 py-0.5 border rounded text-right text-xs"
                        value={kebijakanForm.bintangTasmi}
                        onChange={(e) => setKebijakanForm({ ...kebijakanForm, bintangTasmi: parseInt(e.target.value, 10) || 0 })}
                      />
                    ) : `+${kebijakan.bintangTasmi}`} Bintang
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hak Libur:</span>
                  <span className="font-semibold text-emerald-700">
                    {isEditingKebijakan ? (
                      <input
                        type="number"
                        className="w-10 bg-white px-1 py-0.5 border rounded text-right text-xs"
                        value={kebijakanForm.hakLiburTasmiHari}
                        onChange={(e) => setKebijakanForm({ ...kebijakanForm, hakLiburTasmiHari: parseInt(e.target.value, 10) || 0 })}
                      />
                    ) : `+${kebijakan.hakLiburTasmiHari}`} Hari
                  </span>
                </div>
              </div>
            </div>

            {/* Sima'an Reward */}
            <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-900 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-purple-600" />
                  Reward Sima&apos;an (5/10 Juz)
                </span>
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none text-[11px]">
                  Min. {isEditingKebijakan ? (
                    <input
                      type="number"
                      className="w-12 bg-white px-1 py-0.5 border rounded text-right text-xs"
                      value={kebijakanForm.minNilaiSimaan}
                      onChange={(e) => setKebijakanForm({ ...kebijakanForm, minNilaiSimaan: parseFloat(e.target.value) || 0 })}
                    />
                  ) : kebijakan.minNilaiSimaan}
                </Badge>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Bintang:</span>
                  <span className="font-semibold text-purple-700">
                    {isEditingKebijakan ? (
                      <input
                        type="number"
                        className="w-10 bg-white px-1 py-0.5 border rounded text-right text-xs"
                        value={kebijakanForm.bintangSimaan}
                        onChange={(e) => setKebijakanForm({ ...kebijakanForm, bintangSimaan: parseInt(e.target.value, 10) || 0 })}
                      />
                    ) : `+${kebijakan.bintangSimaan}`} Bintang
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hak Libur:</span>
                  <span className="font-semibold text-emerald-700">
                    {isEditingKebijakan ? (
                      <input
                        type="number"
                        className="w-10 bg-white px-1 py-0.5 border rounded text-right text-xs"
                        value={kebijakanForm.hakLiburSimaanHari}
                        onChange={(e) => setKebijakanForm({ ...kebijakanForm, hakLiburSimaanHari: parseInt(e.target.value, 10) || 0 })}
                      />
                    ) : `+${kebijakan.hakLiburSimaanHari}`} Hari
                  </span>
                </div>
              </div>
            </div>

            {/* Ambang Target Bulanan */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/60 space-y-2">
              <span className="text-xs font-semibold text-blue-900 block">
                Ambang Batas Target Bulanan
              </span>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Min. Capaian:</span>
                  <span className="font-bold text-blue-800">
                    {isEditingKebijakan ? (
                      <input
                        type="number"
                        className="w-12 bg-white px-1 py-0.5 border rounded text-right text-xs"
                        value={kebijakanForm.minPersenTargetBulanan}
                        onChange={(e) => setKebijakanForm({ ...kebijakanForm, minPersenTargetBulanan: parseFloat(e.target.value) || 0 })}
                      />
                    ) : kebijakan.minPersenTargetBulanan}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Santri dengan capaian &lt; {kebijakan.minPersenTargetBulanan}% dikenakan evaluasi sanksi.
                </p>
              </div>
            </div>

            {/* Sanksi Kehilangan Kunjungan */}
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-900 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Sanksi Kehilangan Kunjungan
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Durasi Sanksi:</span>
                  <span className="font-bold text-rose-700">
                    {isEditingKebijakan ? (
                      <input
                        type="number"
                        className="w-12 bg-white px-1 py-0.5 border rounded text-right text-xs"
                        value={kebijakanForm.durasiKehilanganKunjunganHari}
                        onChange={(e) => setKebijakanForm({ ...kebijakanForm, durasiKehilanganKunjunganHari: parseInt(e.target.value, 10) || 0 })}
                      />
                    ) : kebijakan.durasiKehilanganKunjunganHari} Hari
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Kehilangan hak kunjungan wali santri pada bulan berikutnya.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* BAGIAN 2: DAFTAR KELULUSAN TASMI' / SIMA'AN & PROSES REWARD   */}
      {/* ------------------------------------------------------------- */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Penerbitan Reward Ujian Tasmi&apos; & Sima&apos;an
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Daftar kelulusan ujian hafalan yang berhak mendapatkan Bintang Kehormatan dan Hak Libur Tambahan.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-1.5"
            onClick={loadTasmiList}
            disabled={isTasmiLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTasmiLoading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {tasmiList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Belum ada data ujian Tasmi&apos; atau Sima&apos;an yang tercatat di sistem.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Santri</th>
                    <th className="p-2.5">Jenis Ujian</th>
                    <th className="p-2.5">Juz</th>
                    <th className="p-2.5">Nilai & Predikat</th>
                    <th className="p-2.5">Penguji</th>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Status Reward</th>
                    <th className="p-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-600">
                  {tasmiList.map((item) => {
                    const minScore = item.jenis === "TASMI" ? kebijakan.minNilaiTasmi : kebijakan.minNilaiSimaan;
                    const isLulus = item.nilai >= minScore;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-medium text-slate-900">
                          {item.santriNama}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {item.santriNis} • {item.kelas}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <Badge
                            className={
                              item.jenis === "TASMI"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[10px]"
                                : "bg-purple-100 text-purple-800 hover:bg-purple-100 border-none text-[10px]"
                            }
                          >
                            {item.jenis}
                          </Badge>
                        </td>
                        <td className="p-2.5 font-semibold">Juz {item.juz}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800">{item.nilai}</span>
                          <span className="ml-1 text-[10px] text-slate-500">({item.predikat})</span>
                        </td>
                        <td className="p-2.5 text-slate-700">{item.penguji}</td>
                        <td className="p-2.5 text-slate-500">
                          {new Date(item.tanggal).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-2.5">
                          {item.isRewarded ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              Reward Diterbitkan
                            </Badge>
                          ) : isLulus ? (
                            <Badge className="bg-amber-50 text-amber-700 border border-amber-300 text-[10px] w-fit">
                              Menunggu Terbit
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-slate-400 text-[10px] w-fit">
                              Belum Capai Nilai ({minScore})
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {!item.isRewarded && isLulus && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5 flex items-center gap-1 ml-auto"
                              onClick={() => handleProsesReward(item.id, item.santriNama)}
                              disabled={isPending}
                            >
                              <Award className="w-3 h-3" />
                              Terbitkan Reward
                            </Button>
                          )}
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

      {/* ------------------------------------------------------------- */}
      {/* BAGIAN 3: PRATINJAU & FINALISASI EVALUASI BULANAN             */}
      {/* ------------------------------------------------------------- */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-base font-semibold text-slate-800">
                Pratinjau & Finalisasi Evaluasi Capaian Bulanan
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Kalkulasi setoran SABAQ riil bulan berjalan vs Target Bulanan. Santri tanpa target valid berstatus &ldquo;Perlu penetapan target&rdquo; tanpa sanksi otomatis.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="text-xs border rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
              value={bulanPilihan}
              onChange={(e) => {
                setBulanPilihan(parseInt(e.target.value, 10));
                setPreviewLoaded(false);
              }}
            >
              {[
                { val: 7, label: "Juli" },
                { val: 8, label: "Agustus" },
                { val: 9, label: "September" },
                { val: 10, label: "Oktober" },
                { val: 11, label: "November" },
                { val: 12, label: "Desember" },
                { val: 1, label: "Januari" },
                { val: 2, label: "Februari" },
                { val: 3, label: "Maret" },
                { val: 4, label: "April" },
                { val: 5, label: "Mei" },
                { val: 6, label: "Juni" },
              ].map((b) => (
                <option key={b.val} value={b.val}>
                  Bulan {b.val} ({b.label})
                </option>
              ))}
            </select>

            <select
              className="text-xs border rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
              value={tahunAjaranPilihan}
              onChange={(e) => {
                setTahunAjaranPilihan(e.target.value);
                setPreviewLoaded(false);
              }}
            >
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
            </select>

            <Button
              size="sm"
              variant="secondary"
              className="text-xs flex items-center gap-1.5 text-slate-700"
              onClick={handleLoadPreview}
              disabled={isPreviewLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? "animate-spin" : ""}`} />
              Muat Pratinjau
            </Button>

            {canManage && previewLoaded && (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5"
                onClick={handleFinalisasi}
                disabled={isPending || previewList.length === 0}
              >
                <FileCheck className="w-3.5 h-3.5" />
                Finalisasi Laporan Bulanan
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {!previewLoaded ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <Calendar className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm">Klik tombol <strong>&ldquo;Muat Pratinjau&rdquo;</strong> untuk menghitung capaian seluruh santri.</p>
            </div>
          ) : previewList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Tidak ada data santri aktif untuk dievaluasi.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Ringkasan Cepat Pratinjau */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <span className="text-slate-500 block">Total Santri Dievaluasi:</span>
                  <span className="text-base font-bold text-slate-800">{previewList.length} Santri</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-emerald-700 block">Target Tercapai (Bebas):</span>
                  <span className="text-base font-bold text-emerald-800">
                    {previewList.filter((p) => p.statusSanksi === "BEBAS").length} Santri
                  </span>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="text-rose-700 block">Kehilangan Kunjungan:</span>
                  <span className="text-base font-bold text-rose-800">
                    {previewList.filter((p) => p.statusSanksi === "KEHILANGAN_KUNJUNGAN").length} Santri
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-amber-700 block">Perlu Penetapan Target / Dikecualikan:</span>
                  <span className="text-base font-bold text-amber-800">
                    {previewList.filter((p) => p.statusSanksi === "DIKECUALIKAN").length} Santri
                  </span>
                </div>
              </div>

              {/* Tabel Detail Santri */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Santri</th>
                      <th className="p-2.5">Halaqoh</th>
                      <th className="p-2.5 text-center">Target (Hlm)</th>
                      <th className="p-2.5 text-center">Capaian SABAQ</th>
                      <th className="p-2.5 text-center">Persentase</th>
                      <th className="p-2.5">Status Evaluasi</th>
                      <th className="p-2.5">Sanksi Kunjungan</th>
                      {isMudir && <th className="p-2.5 text-right">Otoritas Mudir</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-600">
                    {previewList.map((item) => (
                      <tr key={item.santriId} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-medium text-slate-900">
                          {item.nama}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {item.nis}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">{item.halaqohNama}</td>
                        <td className="p-2.5 text-center font-medium">
                          {item.hasValidTarget ? `${item.targetBulanan} Hlm` : (
                            <span className="text-slate-400 italic">Belum Ada</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">
                          {item.capaianHalaman} Hlm
                        </td>
                        <td className="p-2.5 text-center">
                          {item.hasValidTarget ? (
                            <span
                              className={`font-semibold ${
                                item.isTercapai ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              {item.persentase}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {item.hasValidTarget ? (
                            item.isTercapai ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[10px]">
                                Target Tercapai
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-none text-[10px]">
                                Belum Capai Target
                              </Badge>
                            )
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[10px]">
                              Perlu Penetapan Target
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5">
                          {item.statusSanksi === "BEBAS" ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                              Bebas Sanksi
                            </Badge>
                          ) : item.statusSanksi === "KEHILANGAN_KUNJUNGAN" ? (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px]">
                              Kehilangan Kunjungan ({kebijakan.durasiKehilanganKunjunganHari} Hari)
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-slate-500 text-[10px]">
                              Dikecualikan
                            </Badge>
                          )}

                          {item.isOverride && (
                            <span className="block text-[9px] text-purple-600 mt-0.5 font-medium">
                              (Dispensasi Mudir: {item.overrideNote})
                            </span>
                          )}
                        </td>
                        {isMudir && (
                          <td className="p-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-[11px] h-6 px-2"
                              onClick={() => {
                                setOverrideTarget(item);
                                setOverrideStatus(item.statusSanksi);
                                setOverrideAlasan(item.overrideNote || "");
                              }}
                            >
                              Dispensasi
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DISPENSASI / OVERRIDE MUDIR                             */}
      {/* ------------------------------------------------------------- */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Dispensasi / Override Sanksi Mudir
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setOverrideTarget(null)}
              >
                ✕
              </Button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <span className="text-slate-500">Santri:</span>
                <p className="font-semibold text-slate-800">{overrideTarget.nama} ({overrideTarget.nis})</p>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Status Sanksi Baru:
                </label>
                <select
                  className="w-full border rounded-lg px-2.5 py-1.5 bg-white text-xs"
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                >
                  <option value="BEBAS">BEBAS (Dibebaskan dari Sanksi Kunjungan)</option>
                  <option value="DIKECUALIKAN">DIKECUALIKAN (Kondisi Khusus/Sakit/Izin)</option>
                  <option value="KEHILANGAN_KUNJUNGAN">KEHILANGAN_KUNJUNGAN (Tetap Berlaku Sanksi)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Alasan Tertulis Mudir (Wajib Masuk Audit Log):
                </label>
                <textarea
                  className="w-full border rounded-lg p-2 text-xs h-20 resize-none"
                  placeholder="Contoh: Santri sakit rawat inap selama 2 pekan dengan surat dokter resmi, diberikan toleransi."
                  value={overrideAlasan}
                  onChange={(e) => setOverrideAlasan(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setOverrideTarget(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleSaveOverride}
                disabled={isPending}
              >
                Simpan Dispensasi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
