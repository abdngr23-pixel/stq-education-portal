"use client";

import React, { useState, useTransition } from "react";
import { Role } from "@/types/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { catatMutasiLogistikAction } from "@/app/actions/logistik";
import {
  Package,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

export interface LogistikItem {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  stok: number;
  satuan: string;
  lokasi: string;
}

export interface LogistikModuleProps {
  userRole: Role;
  currentUserName: string;
}

export function LogistikModule({ userRole, currentUserName }: LogistikModuleProps) {
  const [list, setList] = useState<LogistikItem[]>([
    { id: "log-01", kode: "LOG-001", nama: "Beras Rojolele Super", kategori: "SEMBAKO", stok: 450, satuan: "Kg", lokasi: "Gudang Dapur" },
    { id: "log-02", kode: "LOG-002", nama: "Minyak Goreng SunCo", kategori: "SEMBAKO", stok: 80, satuan: "Liter", lokasi: "Gudang Dapur" },
    { id: "log-03", kode: "LOG-003", nama: "Paracetamol 500mg", kategori: "OBAT_P3K", stok: 12, satuan: "Strip", lokasi: "Lemari UKS" },
    { id: "log-04", kode: "LOG-004", nama: "Sabun Mandi Lifebuoy", kategori: "PERLENGKAPAN_ASRAMA", stok: 60, satuan: "Pcs", lokasi: "Koperasi Asrama" },
  ]);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal Mutasi Stok
  const [showMutasiDialog, setShowMutasiDialog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(list[0]?.id || "log-01");
  const [jenisMutasi, setJenisMutasi] = useState<"MASUK" | "KELUAR">("MASUK");
  const [jumlahMutasi, setJumlahMutasi] = useState("10");
  const [keteranganMutasi, setKeteranganMutasi] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const filteredList = list.filter(
    (item) =>
      item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kategori.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedItem = list.find((i) => i.id === selectedItemId) || list[0];

  const handleSimpanMutasi = () => {
    setFeedback(null);
    const qty = parseInt(jumlahMutasi);
    if (isNaN(qty) || qty <= 0) {
      setFeedback({ type: "error", message: "Jumlah mutasi harus lebih dari 0." });
      return;
    }
    if (jenisMutasi === "KELUAR" && selectedItem && qty > selectedItem.stok) {
      setFeedback({ type: "error", message: `Stok tidak mencukupi! Stok saat ini: ${selectedItem.stok} ${selectedItem.satuan}.` });
      return;
    }

    startTransition(async () => {
      const res = await catatMutasiLogistikAction({
        logistikId: selectedItemId,
        jenis: jenisMutasi,
        jumlah: qty,
        keterangan: keteranganMutasi || `Mutasi ${jenisMutasi} oleh ${currentUserName}`,
      });

      if (res.success) {
        setList((prev) =>
          prev.map((item) =>
            item.id === selectedItemId
              ? {
                  ...item,
                  stok: jenisMutasi === "MASUK" ? item.stok + qty : item.stok - qty,
                }
              : item
          )
        );
        setShowMutasiDialog(false);
        setKeteranganMutasi("");
        setFeedback({
          type: "success",
          message: `Mutasi ${jenisMutasi} sebanyak ${qty} ${selectedItem?.satuan} untuk ${selectedItem?.nama} berhasil disimpan.`,
        });
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal mencatat mutasi stok." });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <Package className="h-5 w-5 text-[#0E7C3A]" />
            Logistik &amp; Inventaris Asrama
          </h2>
          <p className="text-xs text-slate-500">
            Pencatatan stok sembako, perlengkapan kamar santri, dan obat UKS
          </p>
        </div>

        {["MK", "OSDA", "KS", "ADM"].includes(userRole) && (
          <Button
            variant="primary"
            onClick={() => setShowMutasiDialog(true)}
            className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs sm:text-sm gap-2 min-h-[44px] shadow-xs shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            + Catat Mutasi Stok
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
          placeholder="Cari barang logistik..."
          className="pl-9 min-h-[42px] text-xs sm:text-sm"
        />
      </div>

      {/* Tabel Inventaris Barang */}
      <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama Barang</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3 text-center">Stok Saat Ini</th>
                <th className="px-3 py-3">Lokasi Penyimpanan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length > 0 ? (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-500">
                      {item.kode}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {item.nama}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="neutral" size="sm">{item.kategori}</Badge>
                    </td>
                    <td className="px-3 py-3 text-center font-extrabold text-slate-900">
                      <span className={item.stok <= 15 ? "text-rose-600" : "text-emerald-700"}>
                        {item.stok} {item.satuan}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.lokasi}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setShowMutasiDialog(true);
                        }}
                        className="text-xs text-[#0E7C3A] font-bold hover:underline"
                      >
                        Mutasi
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    Tidak ada barang logistik yang sesuai pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* DIALOG FORM MUTASI STOK */}
      {showMutasiDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-logistik-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="modal-logistik-title" className="text-base font-bold text-slate-900 font-heading">
                Catat Mutasi Stok Logistik
              </h3>
              <button
                type="button"
                onClick={() => setShowMutasiDialog(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pilih Barang
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                >
                  {list.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama} (Stok: {item.stok} {item.satuan})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Jenis Mutasi
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setJenisMutasi("MASUK")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 min-h-[40px] ${
                        jenisMutasi === "MASUK"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setJenisMutasi("KELUAR")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 min-h-[40px] ${
                        jenisMutasi === "KELUAR"
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Keluar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Jumlah ({selectedItem?.satuan || "Satuan"})
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={jumlahMutasi}
                    onChange={(e) => setJumlahMutasi(e.target.value)}
                    className="min-h-[40px] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Keterangan / Keperluan
                </label>
                <textarea
                  rows={2}
                  value={keteranganMutasi}
                  onChange={(e) => setKeteranganMutasi(e.target.value)}
                  placeholder="Contoh: Pembelian rutin sembako mingguan / Kebutuhan makan santri..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowMutasiDialog(false)}
                  className="min-h-[42px] text-xs font-semibold"
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSimpanMutasi}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Menyimpan..." : "Simpan Mutasi"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
