"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { catatKesehatanAction, updateStatusKesehatanAction, getDaftarKesehatanAction } from "@/app/actions/kesehatan";
import {
  Stethoscope,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export interface KesehatanRecord {
  id: string;
  santri: string;
  nis: string;
  keluhan: string;
  diagnosa: string;
  tindakan: string;
  status: "RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS" | "SEMBUH";
  tanggal: string;
}

export interface KesehatanModuleProps {
  userRole: Role;
  currentUserName: string;
  santriList: DashboardSantriSummary[];
}

export function KesehatanModule({
  userRole,
  currentUserName,
  santriList,
}: KesehatanModuleProps) {
  const [list, setList] = useState<KesehatanRecord[]>([
    {
      id: "kes-01",
      santri: "Achmad Sufiyan",
      nis: "SAN-0015",
      keluhan: "Demam ringan dan pusing saat halaqoh subuh",
      diagnosa: "Gejala flu & kecapekan",
      tindakan: "Istirahat di UKS Asrama + Paracetamol 500mg & Madu",
      status: "RAWAT_PONDOK",
      tanggal: "07/09/2026",
    },
    {
      id: "kes-02",
      santri: "Muhammad Fardhan",
      nis: "SAN-0002",
      keluhan: "Nyeri lambung / maag kambuh",
      diagnosa: "Gastritis ringan",
      tindakan: "Antasida + bubur hangat dari dapur pesantren",
      status: "SEMBUH",
      tanggal: "06/09/2026",
    },
  ]);

  // Load rekam medis riil dari server action on mount
  useEffect(() => {
    let isMounted = true;
    getDaftarKesehatanAction().then((res) => {
      if (isMounted && res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
        setList(
          (res.data as Array<{
            id: string;
            santri: { nama: string; nis: string };
            keluhan: string;
            diagnosa?: string | null;
            tindakan?: string | null;
            status: "RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS" | "SEMBUH";
            tanggal: Date | string;
          }>).map((item) => ({
            id: item.id,
            santri: item.santri.nama,
            nis: item.santri.nis,
            keluhan: item.keluhan,
            diagnosa: item.diagnosa || "Dalam observasi Poskestren",
            tindakan: item.tindakan || "Istirahat di UKS",
            status: item.status,
            tanggal: new Date(item.tanggal).toLocaleDateString("id-ID"),
          }))
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Dialog Form Tambah
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSantriNis, setSelectedSantriNis] = useState(santriList[0]?.nis || "");
  const [keluhanInput, setKeluhanInput] = useState("");
  const [diagnosaInput, setDiagnosaInput] = useState("");
  const [tindakanInput, setTindakanInput] = useState("");
  const [statusInput, setStatusInput] = useState<"RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS">("RAWAT_PONDOK");

  // Dialog Detail / Update
  const [selectedDetail, setSelectedDetail] = useState<KesehatanRecord | null>(null);
  const [updateStatus, setUpdateStatus] = useState<"RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS" | "SEMBUH">("RAWAT_PONDOK");
  const [updateCatatan, setUpdateCatatan] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const filteredList = list.filter(
    (k) =>
      k.santri.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.keluhan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.diagnosa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handler Catat Kesehatan Baru
  const handleCatatKesehatan = () => {
    setFeedback(null);
    const target = santriList.find((s) => s.nis === selectedSantriNis);
    if (!target) {
      setFeedback({ type: "error", message: "Pilih santri terlebih dahulu." });
      return;
    }
    if (!keluhanInput.trim()) {
      setFeedback({ type: "error", message: "Keluhan medis santri wajib diisi." });
      return;
    }

    startTransition(async () => {
      const res = await catatKesehatanAction({
        santriId: target.id,
        keluhan: keluhanInput,
        diagnosa: diagnosaInput || "Dalam observasi Poskestren",
        tindakan: tindakanInput || "Istirahat di UKS",
        status: statusInput,
      });

      if (res.success && res.data) {
        const recorded = res.data as { id: string };
        const newRecord: KesehatanRecord = {
          id: recorded.id,
          santri: target.nama,
          nis: target.nis,
          keluhan: keluhanInput,
          diagnosa: diagnosaInput || "Dalam observasi Poskestren",
          tindakan: tindakanInput || "Istirahat di UKS",
          status: statusInput,
          tanggal: new Date().toLocaleDateString("id-ID"),
        };
        setList((prev) => [newRecord, ...prev]);
        setShowAddDialog(false);
        setKeluhanInput("");
        setDiagnosaInput("");
        setTindakanInput("");
        setFeedback({ type: "success", message: `Rekam medis untuk ${target.nama} berhasil dicatat.` });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal mencatat rekam medis." });
      }
    });
  };

  // Handler Update Status Kesehatan
  const handleUpdateStatus = () => {
    if (!selectedDetail) return;
    startTransition(async () => {
      const res = await updateStatusKesehatanAction({
        id: selectedDetail.id,
        status: updateStatus,
        tindakanTambahan: updateCatatan,
      });

      if (res.success) {
        setList((prev) =>
          prev.map((k) => (k.id === selectedDetail.id ? { ...k, status: updateStatus } : k))
        );
        setSelectedDetail(null);
        setFeedback({
          type: "success",
          message: `Status kesehatan untuk ${selectedDetail.santri} berhasil diperbarui ke ${updateStatus}.`,
        });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal memperbarui status kesehatan." });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-rose-600" />
            Poskestren &amp; Pelayanan Kesehatan Santri
          </h2>
          <p className="text-xs text-slate-500">
            Pencatatan keluhan sakit santri, observasi UKS, dan rujukan klinik/rumah sakit • Petugas: {currentUserName}
          </p>
        </div>

        {["MK", "OSDA", "KS", "ADM"].includes(userRole) && (
          <Button
            variant="primary"
            onClick={() => setShowAddDialog(true)}
            className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs sm:text-sm gap-2 min-h-[44px] shadow-xs shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            + Catat Keluhan Medis
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

      {/* 2. Toolbar Pencarian */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari santri, keluhan, atau diagnosa..."
          className="pl-9 min-h-[42px] text-xs sm:text-sm"
        />
      </div>

      {/* 3. Daftar Pasien Poskestren */}
      <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {filteredList.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedDetail(item);
                    setUpdateStatus(item.status);
                  }}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{item.santri}</h4>
                      <Badge variant="sky" size="sm">{item.nis}</Badge>
                    </div>
                    <p className="text-xs text-slate-700">
                      <strong>Keluhan:</strong> {item.keluhan}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Diagnosa: {item.diagnosa} • Tindakan: {item.tindakan}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <Badge
                      variant={
                        item.status === "SEMBUH"
                          ? "green"
                          : item.status === "RAWAT_PONDOK"
                          ? "orange"
                          : "ditolak"
                      }
                      size="sm"
                      className="font-bold"
                    >
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {item.tanggal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada data catatan kesehatan santri.
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG TAMBAH KELUHAN MEDIS */}
      {showAddDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-kes-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="modal-kes-title" className="text-base font-bold text-slate-900 font-heading">
                Catat Pemeriksaan Poskestren
              </h3>
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
                  Nama Santri
                </label>
                <select
                  value={selectedSantriNis}
                  onChange={(e) => setSelectedSantriNis(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                >
                  {santriList.map((s) => (
                    <option key={s.nis} value={s.nis}>
                      {s.nama} ({s.kelas})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Keluhan Medis Santri
                </label>
                <Input
                  value={keluhanInput}
                  onChange={(e) => setKeluhanInput(e.target.value)}
                  placeholder="Contoh: Sakit kepala dan demam 38°C..."
                  className="min-h-[44px] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Diagnosa Awal
                </label>
                <Input
                  value={diagnosaInput}
                  onChange={(e) => setDiagnosaInput(e.target.value)}
                  placeholder="Contoh: Gejala ISPA / Flu ringan..."
                  className="min-h-[44px] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tindakan &amp; Obat yang Diberikan
                </label>
                <textarea
                  rows={2}
                  value={tindakanInput}
                  onChange={(e) => setTindakanInput(e.target.value)}
                  placeholder="Contoh: Istirahat di kamar UKS + Paracetamol 500mg 3x1..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Status Penanganan
                </label>
                <select
                  value={statusInput}
                  onChange={(e) =>
                    setStatusInput(
                      e.target.value as "RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS"
                    )
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                >
                  <option value="RAWAT_PONDOK">Rawat di Kamar UKS Pondok</option>
                  <option value="DIRUJUK_PUSKESMAS">Dirujuk ke Puskesmas</option>
                  <option value="DIRUJUK_RS">Dirujuk ke Rumah Sakit</option>
                </select>
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
                  onClick={handleCatatKesehatan}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Menyimpan..." : "Simpan Catatan Medis"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DETAIL & UPDATE STATUS KESEHATAN */}
      {selectedDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-detail-kes-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="modal-detail-kes-title" className="text-base font-bold text-slate-900 font-heading">
                Detail Catatan Medis Santri
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1.5">
                <p><strong>Santri:</strong> {selectedDetail.santri} ({selectedDetail.nis})</p>
                <p><strong>Keluhan:</strong> {selectedDetail.keluhan}</p>
                <p><strong>Diagnosa:</strong> {selectedDetail.diagnosa}</p>
                <p><strong>Tindakan:</strong> {selectedDetail.tindakan}</p>
                <p><strong>Tanggal Masuk UKS:</strong> {selectedDetail.tanggal}</p>
              </div>

              {["MK", "OSDA", "KS"].includes(userRole) && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 block">
                    Perbarui Status Kesehatan:
                  </label>
                  <select
                    value={updateStatus}
                    onChange={(e) =>
                      setUpdateStatus(
                        e.target.value as "RAWAT_PONDOK" | "DIRUJUK_PUSKESMAS" | "DIRUJUK_RS" | "SEMBUH"
                      )
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                  >
                    <option value="RAWAT_PONDOK">Masih Dirawat di UKS</option>
                    <option value="SEMBUH">Sudah Sembuh (Kembali ke Asrama)</option>
                    <option value="DIRUJUK_PUSKESMAS">Dirujuk ke Puskesmas</option>
                    <option value="DIRUJUK_RS">Dirujuk ke Rumah Sakit</option>
                  </select>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Catatan Tindakan Tambahan (Opsional)
                    </label>
                    <Input
                      value={updateCatatan}
                      onChange={(e) => setUpdateCatatan(e.target.value)}
                      placeholder="Misal: Sudah sembuh total / dirujuk pukul 10.00"
                      className="text-xs sm:text-sm min-h-[38px]"
                    />
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleUpdateStatus}
                    disabled={isPending}
                    className="w-full min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E] mt-2"
                  >
                    {isPending ? "Memperbarui..." : "Simpan Perubahan Status"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
