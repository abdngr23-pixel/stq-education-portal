"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role } from "@/types/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ajukanKebutuhanAction, verifikasiPengajuanAction, getPengajuanAnggaranListAction } from "@/app/actions/administrasi";
import {
  DollarSign,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export interface PengajuanDanaItem {
  id: string;
  kode: string;
  judul: string;
  kategori: string;
  nominal: number;
  status: "DIAJUKAN" | "DISETUJUI_KS" | "DICAIRKAN" | "DITOLAK";
  diajukanOleh: string;
  catatan?: string;
}

export interface AnggaranModuleProps {
  userRole: Role;
  currentUserName: string;
}

export function AnggaranModule({ userRole, currentUserName }: AnggaranModuleProps) {
  const [list, setList] = useState<PengajuanDanaItem[]>([
    {
      id: "aju-01",
      kode: "AJU-000001",
      judul: "Pengadaan Mushaf Al-Qur'an Pojok & ATK Halaqoh",
      kategori: "LOGISTIK",
      nominal: 3500000,
      status: "DIAJUKAN",
      diajukanOleh: "Siti Aminah, S.Kom. (Admin TU)",
      catatan: "Kebutuhan mendesak untuk santri baru angkatan 2026",
    },
    {
      id: "aju-02",
      kode: "AJU-000002",
      judul: "Konsumsi & Operasional Kajian Bulanan Wali Santri",
      kategori: "KEGIATAN",
      nominal: 1800000,
      status: "DISETUJUI_KS",
      diajukanOleh: "Siti Aminah, S.Kom. (Admin TU)",
      catatan: "Disetujui Mudir/KS untuk pencairan",
    },
  ]);

  // Load pengajuan anggaran riil dari server action on mount
  useEffect(() => {
    let isMounted = true;
    getPengajuanAnggaranListAction().then((res) => {
      if (isMounted && res.success && res.data && res.data.length > 0) {
        setList(
          res.data.map((item) => ({
            id: item.id,
            kode: item.kode,
            judul: item.judul,
            kategori: item.kategori,
            nominal: item.nominal,
            status: item.status as "DIAJUKAN" | "DISETUJUI_KS" | "DICAIRKAN" | "DITOLAK",
            diajukanOleh: item.diajukanOleh,
            catatan: item.keterangan,
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

  // Dialog Form Tambah Pengajuan
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [judulInput, setJudulInput] = useState("");
  const [kategoriInput, setKategoriInput] = useState("LOGISTIK");
  const [nominalInput, setNominalInput] = useState("1000000");
  const [keteranganInput, setKeteranganInput] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const filteredList = list.filter(
    (item) =>
      item.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kategori.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAjukan = () => {
    setFeedback(null);
    if (!judulInput.trim()) {
      setFeedback({ type: "error", message: "Judul pengajuan anggaran wajib diisi." });
      return;
    }
    const nom = parseFloat(nominalInput);
    if (isNaN(nom) || nom <= 0) {
      setFeedback({ type: "error", message: "Nominal pengajuan harus lebih dari Rp 0." });
      return;
    }

    startTransition(async () => {
      const res = await ajukanKebutuhanAction({
        judul: judulInput,
        kategori: kategoriInput,
        nominal: nom,
        keterangan: keteranganInput || "Pengajuan operasional pesantren",
      });

      if (res.success && res.data) {
        const newItem: PengajuanDanaItem = {
          id: res.data.id,
          kode: res.data.kodePengajuan,
          judul: judulInput,
          kategori: kategoriInput,
          nominal: nom,
          status: "DIAJUKAN",
          diajukanOleh: currentUserName,
          catatan: keteranganInput,
        };

        setList((prev) => [newItem, ...prev]);
        setShowAddDialog(false);
        setJudulInput("");
        setKeteranganInput("");
        setFeedback({
          type: "success",
          message: `Pengajuan anggaran "${judulInput}" (${res.data.kodePengajuan}) berhasil diajukan dan menunggu telaah Mudir.`,
        });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal mengajukan anggaran." });
      }
    });
  };

  const handleVerifikasi = (id: string, isApproved: boolean) => {
    startTransition(async () => {
      const status = isApproved ? "DISETUJUI_KS" : "DITOLAK";
      const res = await verifikasiPengajuanAction({
        pengajuanId: id,
        status,
        catatanKS: isApproved ? "Disetujui Mudir" : "Ditolak",
      });

      if (res.success) {
        setList((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: isApproved ? "DISETUJUI_KS" : "DITOLAK" }
              : item
          )
        );
        setFeedback({
          type: "success",
          message: `Pengajuan berhasil ${isApproved ? "disetujui" : "ditolak"}.`,
        });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal memproses verifikasi." });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Pengajuan Anggaran &amp; Kebutuhan Operasional
          </h2>
          <p className="text-xs text-slate-500">
            Pengelolaan dana kegiatan, logistik santri, dan pengadaan sarana pesantren
          </p>
        </div>

        {["ADM", "KS", "YAY"].includes(userRole) && (
          <Button
            variant="primary"
            onClick={() => setShowAddDialog(true)}
            className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs sm:text-sm gap-2 min-h-[44px] shadow-xs shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            + Ajukan Kebutuhan Dana
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

      {/* Toolbar Pencarian */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari pengajuan anggaran..."
          className="pl-9 min-h-[42px] text-xs sm:text-sm"
        />
      </div>

      {/* Daftar Pengajuan Anggaran */}
      <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {filteredList.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.kode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{item.judul}</h4>
                      <Badge variant="sky" size="sm">{item.kategori}</Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      Diajukan oleh: {item.diajukanOleh} • {item.catatan || "Tidak ada catatan."}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span className="text-sm font-extrabold text-emerald-800">
                      Rp {item.nominal.toLocaleString("id-ID")}
                    </span>
                    <Badge
                      variant={
                        item.status === "DISETUJUI_KS" || item.status === "DICAIRKAN"
                          ? "green"
                          : item.status === "DITOLAK"
                          ? "ditolak"
                          : "orange"
                      }
                      size="sm"
                      className="font-bold"
                    >
                      {item.status.replace(/_/g, " ")}
                    </Badge>

                    {/* Tombol Approval Khusus Mudir / KS */}
                    {userRole === "KS" && item.status === "DIAJUKAN" && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleVerifikasi(item.id, false)}
                          disabled={isPending}
                          className="text-[11px] h-7 px-2 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Tolak
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerifikasi(item.id, true)}
                          disabled={isPending}
                          className="text-[11px] h-7 px-2.5 bg-[#0E7C3A] hover:bg-[#0B642E]"
                        >
                          Setujui
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada data pengajuan anggaran yang sesuai.
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG AJUKAN ANGGARAN BARU */}
      {showAddDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-aju-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="modal-aju-title" className="text-base font-bold text-slate-900 font-heading">
                Ajukan Kebutuhan Dana Operasional
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
                  Nama / Keperluan Pengajuan
                </label>
                <Input
                  value={judulInput}
                  onChange={(e) => setJudulInput(e.target.value)}
                  placeholder="Contoh: Pengadaan Mushaf Saku Santri Baru..."
                  className="min-h-[44px] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Kategori Dana
                  </label>
                  <select
                    value={kategoriInput}
                    onChange={(e) => setKategoriInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                  >
                    <option value="LOGISTIK">Logistik Asrama</option>
                    <option value="KEGIATAN">Kegiatan Santri</option>
                    <option value="AKADEMIK">Kurikulum &amp; Ujian</option>
                    <option value="SARANA">Perbaikan Sarana</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nominal (Rupiah)
                  </label>
                  <Input
                    type="number"
                    min={10000}
                    step={50000}
                    value={nominalInput}
                    onChange={(e) => setNominalInput(e.target.value)}
                    className="min-h-[44px] text-sm font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rincian &amp; Justifikasi Kebutuhan
                </label>
                <textarea
                  rows={3}
                  value={keteranganInput}
                  onChange={(e) => setKeteranganInput(e.target.value)}
                  placeholder="Jelaskan spesifikasi kebutuhan dan urgensinya..."
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
                  onClick={handleAjukan}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Mengajukan..." : "Kirim Pengajuan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
