"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { catatPelanggaranAction, putihkanSPAction, getPelanggaranListAction, getSPListAction } from "@/app/actions/kedisiplinan";
import { evaluasiLevelSP } from "@/lib/educational-rules";
import { PrintSP } from "@/components/print/print-sp";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { buildPelanggaranSPWAMessage } from "@/lib/whatsapp";
import {
  AlertTriangle,
  PlusCircle,
  Search,
  ShieldAlert,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
} from "lucide-react";

export interface PelanggaranRecord {
  id: string;
  kode: string;
  santriNama: string;
  santriNis?: string;
  kategori: string;
  poin: number;
  isPengulangan: boolean;
  tanggal: string;
  pencatat: string;
  kronologi?: string;
}

export interface SPRecord {
  id: string;
  nomorSP: string;
  santriNama: string;
  santriNis?: string;
  tingkat: number;
  totalPoin: number;
  tanggal: string;
  status: "AKTIF" | "DIPUTIHKAN";
}

export interface KedisiplinanModuleProps {
  userRole: Role;
  currentUserName: string;
  santriList: DashboardSantriSummary[];
}

export function KedisiplinanModule({
  userRole,
  currentUserName,
  santriList,
}: KedisiplinanModuleProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Data Pelanggaran & SP
  const [pelanggaranList, setPelanggaranList] = useState<PelanggaranRecord[]>([
    {
      id: "p-1",
      kode: "PLG-000001",
      santriNama: "Achmad Sufiyan",
      santriNis: "SAN-0015",
      kategori: "Terlambat Sholat Berjamaah",
      poin: 5,
      isPengulangan: false,
      tanggal: "05/09/2026",
      pencatat: "Ust. Mujaddid (MK)",
      kronologi: "Terlambat tiba di masjid saat qomat sholat subuh.",
    },
    {
      id: "p-2",
      kode: "PLG-000002",
      santriNama: "Achmad Sufiyan",
      santriNis: "SAN-0015",
      kategori: "Terlambat Sholat Berjamaah",
      poin: 10,
      isPengulangan: true,
      tanggal: "07/09/2026",
      pencatat: "Ust. Mujaddid (MK)",
      kronologi: "Pengulangan pelanggaran adab shalat subuh (Poin berlipat x2).",
    },
  ]);

  const [spList, setSpList] = useState<SPRecord[]>([
    {
      id: "sp-1",
      nomorSP: "001/SP-1/DUC/2026",
      santriNama: "Achmad Sufiyan",
      santriNis: "SAN-0015",
      tingkat: 1,
      totalPoin: 25,
      tanggal: "07/09/2026",
      status: "AKTIF",
    },
  ]);

  // Load pelanggaran & SP riil dari server action on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([getPelanggaranListAction(), getSPListAction()]).then(([pRes, spRes]) => {
      if (!isMounted) return;
      if (pRes.success && pRes.data && pRes.data.length > 0) {
        setPelanggaranList(
          pRes.data.map((p) => ({
            id: p.id,
            kode: p.kode,
            santriNama: p.santriNama,
            santriNis: p.santriNis,
            kategori: p.kategori,
            poin: p.poin,
            isPengulangan: p.isPengulangan,
            tanggal: p.tanggal,
            pencatat: p.pencatat,
            kronologi: p.kronologi || "",
          }))
        );
      }
      if (spRes.success && spRes.data && spRes.data.length > 0) {
        setSpList(
          spRes.data.map((sp) => ({
            id: sp.id,
            nomorSP: sp.nomorSP,
            santriNama: sp.santriNama,
            santriNis: sp.santriNis,
            tingkat: sp.tingkat,
            totalPoin: sp.totalPoin,
            tanggal: sp.tanggal,
            status: sp.status as "AKTIF" | "DIPUTIHKAN",
          }))
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Dialog Tambah Pelanggaran
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSantriNis, setSelectedSantriNis] = useState(santriList[0]?.nis || "");
  const [kategoriPelanggaran, setKategoriPelanggaran] = useState<"PLG_SHOLAT" | "PLG_GADGET" | "PLG_PIKET">("PLG_SHOLAT");
  const [kronologi, setKronologi] = useState("");

  // Dialog Detail / Kronologi
  const [selectedDetailPelanggaran, setSelectedDetailPelanggaran] = useState<PelanggaranRecord | null>(null);

  // Modal Cetak SP
  const [showPrintSPModal, setShowPrintSPModal] = useState<SPRecord | null>(null);

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
    title: "Kirim Pemberitahuan SP via WhatsApp",
    description: "Format surat peringatan resmi akan dibuka di WhatsApp wali.",
  });

  const [searchTerm, setSearchTerm] = useState("");

  const filteredPelanggaran = pelanggaranList.filter(
    (p) =>
      p.santriNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.kategori.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handler Submit Pelanggaran
  const handleCatatPelanggaran = () => {
    setFeedback(null);
    const target = santriList.find((s) => s.nis === selectedSantriNis);
    if (!target) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu." });
      return;
    }

    startTransition(async () => {
      const res = await catatPelanggaranAction({
        santriId: target.id,
        kategoriId: kategoriPelanggaran,
        kronologi: kronologi || "Pelanggaran tata tertib asrama tercatat.",
      });

      if (res.success && res.data) {
        const isRepeat = res.data.isPengulangan;
        const poin = res.data.poinFinal;

        const newRecord: PelanggaranRecord = {
          id: res.data.id,
          kode: res.data.kodePelanggaran,
          santriNama: target.nama,
          santriNis: target.nis,
          kategori:
            kategoriPelanggaran === "PLG_SHOLAT"
              ? "Terlambat Sholat Berjamaah"
              : kategoriPelanggaran === "PLG_GADGET"
              ? "Pelanggaran Gadget / HP"
              : "Kelalaian Piket Asrama",
          poin,
          isPengulangan: isRepeat,
          tanggal: new Date().toLocaleDateString("id-ID"),
          pencatat: currentUserName,
          kronologi,
        };

        setPelanggaranList((prev) => [newRecord, ...prev]);

        // Cek apakah menerbitkan SP baru
        const spLevel = res.totalPoin ? evaluasiLevelSP(res.totalPoin) : null;
        if (spLevel) {
          const tingkatNum = spLevel === "SP3" ? 3 : spLevel === "SP2" ? 2 : 1;
          getSPListAction().then((spRes) => {
            if (spRes.success && spRes.data && spRes.data.length > 0) {
              setSpList(
                spRes.data.map((sp) => ({
                  id: sp.id,
                  nomorSP: sp.nomorSP,
                  santriNama: sp.santriNama,
                  santriNis: sp.santriNis,
                  tingkat: sp.tingkat,
                  totalPoin: sp.totalPoin,
                  tanggal: sp.tanggal,
                  status: sp.status as "AKTIF" | "DIPUTIHKAN",
                }))
              );
            }
          });

          // Siapkan WA peringatan dengan nomor wali santri riil
          const waMsg = buildPelanggaranSPWAMessage({
            santriNama: target.nama,
            santriNis: target.nis,
            kelas: target.kelas,
            perihal: `Pemberitahuan Akumulasi Poin Kedisiplinan & Penerbitan ${spLevel}`,
            totalPoin: res.totalPoin || poin,
            kategori: newRecord.kategori,
            tingkatSP: tingkatNum,
            pencatat: currentUserName,
          });

          setWaDialog({
            isOpen: true,
            phone: target.noHpWali || "081234567890",
            recipientName: target.namaWali ? `${target.namaWali} (Wali ${target.nama})` : `Wali dari ${target.nama}`,
            message: waMsg,
            title: `Peringatan ${spLevel} untuk ${target.nama}`,
            description: "Akumulasi poin telah melampaui batas ambang. Hubungi wali santri.",
          });
        }

        setShowAddDialog(false);
        setKronologi("");
        setFeedback({
          type: "success",
          message: `Pelanggaran ${target.nama} (${res.data.kodePelanggaran}) berhasil dicatat. Poin sanksi: ${poin}${isRepeat ? " (Pengulangan x2)" : ""}.`,
        });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal mencatat pelanggaran." });
      }
    });
  };

  // Handler Putihkan SP (Khusus KS/Mudir)
  const handlePutihkanSP = (spId: string, namaSantri: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin memutihkan SP untuk ${namaSantri}? Seluruh poin aktif akan di-reset.`)) {
      return;
    }

    startTransition(async () => {
      const res = await putihkanSPAction({ spId, keterangan: "Pemutihan resmi oleh Mudir Pesantren" });
      if (res.success) {
        setSpList((prev) =>
          prev.map((s) => (s.id === spId ? { ...s, status: "DIPUTIHKAN" } : s))
        );
        setFeedback({ type: "success", message: `SP untuk ${namaSantri} berhasil diputihkan.` });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal memutihkan SP." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Kedisiplinan &amp; Sanksi Berjenjang
          </h2>
          <p className="text-xs text-slate-500">
            Pencatatan pelanggaran santri dengan pelipatgandaan poin otomatis (x2) &amp; penerbitan SP1-SP3
          </p>
        </div>

        {["MK", "PH", "OSDA", "KS"].includes(userRole) && (
          <Button
            variant="primary"
            onClick={() => setShowAddDialog(true)}
            className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs sm:text-sm gap-2 min-h-[44px] shadow-xs shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            + Catat Pelanggaran
          </Button>
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
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Kartu Surat Peringatan (SP) Aktif */}
      {spList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Daftar Surat Peringatan (SP) Diterbitkan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spList.map((sp) => (
              <Card key={sp.id} rounded="2xl" className="border border-rose-200 bg-rose-50/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="ditolak" size="sm" className="font-bold">
                      Surat Peringatan {sp.tingkat} (SP-{sp.tingkat})
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-500 font-semibold">
                      {sp.nomorSP}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{sp.santriNama}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Akumulasi: <strong className="text-rose-700">{sp.totalPoin} Poin</strong> • Diterbitkan: {sp.tanggal}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-rose-200/60">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowPrintSPModal(sp)}
                      className="text-xs font-bold gap-1 text-slate-700 bg-white min-h-[36px]"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Cetak SP
                    </Button>

                    {userRole === "KS" && sp.status === "AKTIF" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePutihkanSP(sp.id, sp.santriNama)}
                        disabled={isPending}
                        className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 min-h-[36px]"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Putihkan SP
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 3. Daftar Pelanggaran Santri Terkini */}
      <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 font-heading">
              Log Pelanggaran Santri
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Riwayat pelanggaran adab, shalat berjamaah, dan tata tertib asrama
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari santri atau sanksi..."
              className="pl-9 min-h-[38px] text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="px-4 py-3">Santri</th>
                <th className="px-3 py-3">Pelanggaran</th>
                <th className="px-3 py-3 text-center">Poin</th>
                <th className="px-3 py-3 text-center">Pengulangan</th>
                <th className="px-3 py-3">Pencatat</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPelanggaran.length > 0 ? (
                filteredPelanggaran.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {item.santriNama}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.kategori}
                    </td>
                    <td className="px-3 py-3 text-center font-extrabold text-rose-700">
                      +{item.poin}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.isPengulangan ? (
                        <Badge variant="ditolak" size="sm">Ya (x2)</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Pertama</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600 font-medium">
                      {item.pencatat}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {item.tanggal}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailPelanggaran(item)}
                        className="text-xs text-[#0E7C3A] font-bold hover:underline"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                    Tidak ada pelanggaran santri yang dicatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* DIALOG FORM CATAT PELANGGARAN BARU */}
      {showAddDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-pelanggaran-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="modal-pelanggaran-title" className="text-base font-bold text-slate-900 font-heading">
                  Catat Pelanggaran Santri
                </h3>
                <p className="text-xs text-slate-500">
                  Sistem otomatis mendeteksi pengulangan dan melipatgandakan poin (x2)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pilih Santri
                </label>
                <select
                  value={selectedSantriNis}
                  onChange={(e) => setSelectedSantriNis(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                >
                  {santriList.map((s) => (
                    <option key={s.nis} value={s.nis}>
                      {s.nama} ({s.kelas}) — Poin Saat Ini: {s.poinPelanggaran}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kategori Pelanggaran
                </label>
                <select
                  value={kategoriPelanggaran}
                  onChange={(e) => setKategoriPelanggaran(e.target.value as "PLG_SHOLAT" | "PLG_GADGET" | "PLG_PIKET")}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                >
                  <option value="PLG_SHOLAT">Terlambat / Masbuk Sholat Berjamaah (5 Poin)</option>
                  <option value="PLG_PIKET">Kelalaian Piket Asrama / Kamar (5 Poin)</option>
                  <option value="PLG_GADGET">Pelanggaran Gadget / HP Terlarang (15 Poin)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kronologi Kejadian
                </label>
                <textarea
                  rows={3}
                  value={kronologi}
                  onChange={(e) => setKronologi(e.target.value)}
                  placeholder="Ceritakan kejadian secara singkat dan objektif..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddDialog(false)}
                  className="min-h-[42px] text-xs font-semibold"
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCatatPelanggaran}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Menyimpan..." : "Catat Pelanggaran"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DETAIL PELANGGARAN */}
      {selectedDetailPelanggaran && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-plg-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="detail-plg-title" className="text-base font-bold text-slate-900 font-heading">
                Detail Catatan Pelanggaran
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDetailPelanggaran(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1.5">
                <p><strong>Santri:</strong> {selectedDetailPelanggaran.santriNama}</p>
                <p><strong>Kategori:</strong> {selectedDetailPelanggaran.kategori}</p>
                <p><strong>Poin Sanksi:</strong> +{selectedDetailPelanggaran.poin} {selectedDetailPelanggaran.isPengulangan ? "(Pengulangan x2)" : ""}</p>
                <p><strong>Pencatat:</strong> {selectedDetailPelanggaran.pencatat}</p>
                <p><strong>Tanggal:</strong> {selectedDetailPelanggaran.tanggal}</p>
              </div>
              <div>
                <strong className="block text-slate-700 mb-1">Kronologi:</strong>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700 border border-slate-100">
                  {selectedDetailPelanggaran.kronologi || "Tidak ada rincian tambahan."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Surat Peringatan (SP) Resmi */}
      {showPrintSPModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-sp-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="print-sp-title" className="text-base font-bold text-slate-900 font-heading">
                Pratinjau Surat Peringatan {showPrintSPModal.tingkat} (SP-{showPrintSPModal.tingkat}) Resmi
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintSPModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white p-4 border rounded-2xl shadow-inner">
              <PrintSP
                nomorSurat={showPrintSPModal.nomorSP}
                tingkatSP={`SP${showPrintSPModal.tingkat}` as "SP1" | "SP2" | "SP3"}
                santriNama={showPrintSPModal.santriNama}
                santriNis={showPrintSPModal.santriNis || "SAN-0015"}
                santriKelas="8B Takhossus"
                totalPoin={showPrintSPModal.totalPoin}
                arahanPembinaan="Diberikan pembinaan tarbiyah intensif, penugasan murojaah juz pilihan, dan peringatan kedisiplinan resmi."
                riwayatPelanggaran={pelanggaranList
                  .filter((p) => p.santriNama === showPrintSPModal.santriNama)
                  .map((p) => ({
                    tanggal: p.tanggal,
                    deskripsi: p.kategori,
                    poin: p.poin,
                    isPengulangan: p.isPengulangan,
                  }))}
              />
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
